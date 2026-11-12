#!/usr/bin/env node
'use strict';

// Write-eligibility gate for content-queue.json.
//
// A queue entry is a PROPOSAL until the site owner approves it. Neither a due
// `publish_after` date, nor queue prose, nor an agent's say-so makes a topic
// eligible to be written as an article. A topic is write-eligible only when
// ALL of these hold (see evaluate()):
//   - status is "approved" (never "proposed", legacy "queued", "retired", ...)
//   - FIRST-PARTY evidence is cited: Search Console (live or the stored digest)
//     or GA4/traffic, with window and quoted rows. Public web search and
//     competitor research are SUPPLEMENTARY only and can never satisfy this.
//   - the evidence carries an honest demand label (observed / thin /
//     none-observed) and written limits. Thin or absent data is labelled,
//     never described as validation, and there is NO minimum-impression cutoff.
//   - an intent-overlap check against every existing page is recorded and says
//     "distinct", and no exact intent term collides with another entry
//   - an approval record points at the owner's message in the Claude
//     conversation channel (session id + event uuid + the exact approval line,
//     bound to this entry's content hash and demand label)
//   - publish_after has been reached (necessary, never sufficient)
//
// What this file does NOT do: it cannot prove who typed a message. The
// approval record is only a reference. At run time the referenced event must be
// fetched and checked by --verify-event, and unless the event data carries an
// origin marker listed in HUMAN_ORIGIN_VALUES (empty by default, because none
// has been established) the result is "trusted-channel verification needed" and
// the run must STOP. This is a fail-closed bridge, not a human firewall.
//
// Usage:
//   node scripts/check-queue-gate.js                       validate the queue
//   node scripts/check-queue-gate.js --eligible            list structurally eligible slugs (JSON)
//   node scripts/check-queue-gate.js --hash <slug>         print the content hash and approval line
//   node scripts/check-queue-gate.js --verify-event <slug> < get_event.json
//   options: --today YYYY-MM-DD   --root <repo dir>

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Safety defaults, NOT SEO requirements and NOT demand thresholds. They bound how
// stale the evidence behind a decision, and the decision itself, may be. They are
// changed only by editing this file in a reviewed PR; they cannot be overridden at
// run time. Exact semantics:
//   maxEvidenceAgeDaysAtApproval: each first-party evidence item's fetched_at must
//     be within this many days BEFORE approval.approved_at (freshness relative to
//     the approval).
//   maxApprovalAgeDaysAtRun: the run date (--today) must be within this many days
//     AFTER approval.approved_at (freshness relative to execution).
// So evidence can be up to the sum of both (44 days with these defaults) older
// than the run date. Neither number says anything about search demand.
const POLICY_DEFAULTS = Object.freeze({ maxEvidenceAgeDaysAtApproval: 14, maxApprovalAgeDaysAtRun: 30 });

// Origin values of get_event data that positively denote a message typed by a
// person in the owner's authenticated Claude conversation. EMPTY on purpose: the
// event data available when this was written (client_platform, role, session_id,
// timestamps) does not distinguish a person from a relayed or spawned message.
// Add a value only in a reviewed PR after the owner confirms what it means.
const HUMAN_ORIGIN_VALUES = Object.freeze([]);

const STATUSES = new Set(['published', 'proposed', 'approved', 'retired', 'rejected', 'skipped']);
const BASE_KEYS = ['slug', 'title', 'intent', 'angle', 'internal_links', 'status', 'publish_after'];
const FIRST_PARTY_KINDS = new Set(['gsc-live', 'gsc-digest', 'ga4']);
const SUPPLEMENTARY_KINDS = new Set(['web-search', 'competitor-research']);
const DEMAND_LABELS = new Set(['observed', 'thin', 'none-observed']);
const COLLISION_STATUSES = new Set(['published', 'proposed', 'approved']);
const APPROVAL_CHANNEL = 'claude-session-event';
const SESSION_ID_RE = /^(?:session|cse)_[A-Za-z0-9]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALIDATION_CLAIM_RE = /\bvalidat(?:e|ed|es|ing|ion)\b|\bproves?\b|\bproven\b|\bconfirms? (?:the )?demand\b/i;

// ---------- helpers ----------

function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const t = Date.parse(s + 'T00:00:00Z');
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return NaN;
  return t;
}

function daysBetween(a, b) {
  return (parseDate(b) - parseDate(a)) / 86400000;
}

function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

// Everything the owner approves. Editing any of it after approval changes the
// hash and invalidates the approval.
function contentHash(rec) {
  const subject = {
    slug: rec.slug,
    title: rec.title,
    intent: rec.intent,
    angle: rec.angle,
    internal_links: rec.internal_links,
    publish_after: rec.publish_after,
    evidence: rec.evidence,
    overlap_check: rec.overlap_check,
  };
  return crypto.createHash('sha256').update(canonical(subject)).digest('hex');
}

// The exact line the owner sends in the conversation. It binds the topic (slug),
// the full content (hash) and the owner's acknowledgement of the demand label.
function approvalLine(rec) {
  const label = rec.evidence && rec.evidence.demand_label;
  return `APPROVE-WRITE ${rec.slug} ${contentHash(rec).slice(0, 12)} signal=${label}`;
}

function intentTerms(rec) {
  return String(rec.intent || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function listBlogSlugs(root) {
  const dir = path.join(root, 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'))
    .map((f) => f.slice(0, -5))
    .sort();
}

const nonEmpty = (s, min = 1) => typeof s === 'string' && s.trim().length >= min;

// ---------- structural validation (CI) ----------

function validateQueue(queue) {
  const errors = [];
  if (!Array.isArray(queue)) return ['content-queue.json must be a JSON array'];
  const seen = new Set();
  queue.forEach((rec, i) => {
    const id = rec && rec.slug ? rec.slug : `#${i}`;
    for (const k of BASE_KEYS) if (!(k in rec)) errors.push(`${id}: missing "${k}"`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(rec.slug))) errors.push(`${id}: slug must be lowercase-hyphenated`);
    if (seen.has(rec.slug)) errors.push(`${id}: duplicate slug`);
    seen.add(rec.slug);
    if (Number.isNaN(parseDate(rec.publish_after))) errors.push(`${id}: publish_after must be a real YYYY-MM-DD date`);
    if (!Array.isArray(rec.internal_links)) errors.push(`${id}: internal_links must be an array`);
    if (rec.status === 'queued') {
      errors.push(`${id}: status "queued" is no longer valid; use "proposed" (a proposal is never write-eligible) or "approved"`);
    } else if (!STATUSES.has(rec.status)) {
      errors.push(`${id}: unknown status "${rec.status}"`);
    }
    if (rec.status === 'proposed' && rec.approval) errors.push(`${id}: a proposed entry must not carry an approval`);
    if (rec.status === 'retired') {
      if (!rec.retired_reason) errors.push(`${id}: retired entry needs retired_reason`);
      if (Number.isNaN(parseDate(rec.retired_at))) errors.push(`${id}: retired entry needs retired_at (YYYY-MM-DD)`);
    }
    if (rec.status === 'approved') {
      approvalProblems(rec).forEach((b) => errors.push(`${id}: approved entry incomplete: ${b}`));
    }
  });
  return errors;
}

// Shape and internal-consistency problems for the evidence / overlap / approval blocks.
function approvalProblems(rec) {
  const p = [];
  const ev = rec.evidence;
  if (!ev || typeof ev !== 'object') {
    p.push('evidence is missing');
  } else {
    if (!Array.isArray(ev.first_party) || ev.first_party.length === 0) {
      p.push('evidence.first_party is empty: cite Search Console or GA4/traffic data (public search alone is not enough)');
    } else {
      ev.first_party.forEach((it, n) => {
        const at = `evidence.first_party[${n}]`;
        if (!FIRST_PARTY_KINDS.has(it.kind)) p.push(`${at}.kind must be one of ${[...FIRST_PARTY_KINDS].join('/')}`);
        if (!nonEmpty(it.source, 10)) p.push(`${at}.source must name where the data came from (URL, or digest path and commit)`);
        if (Number.isNaN(parseDate(it.fetched_at))) p.push(`${at}.fetched_at must be YYYY-MM-DD`);
        if (!nonEmpty(it.window, 7)) p.push(`${at}.window must state the date window`);
        if (!nonEmpty(it.quote, 20)) p.push(`${at}.quote must quote the rows relied on (including a zero result)`);
      });
    }
    if (ev.supplementary !== undefined) {
      if (!Array.isArray(ev.supplementary)) p.push('evidence.supplementary must be an array');
      else ev.supplementary.forEach((it, n) => {
        const at = `evidence.supplementary[${n}]`;
        if (!SUPPLEMENTARY_KINDS.has(it.kind)) p.push(`${at}.kind must be one of ${[...SUPPLEMENTARY_KINDS].join('/')}`);
        if (typeof it.url !== 'string' || !/^https:\/\/\S+$/.test(it.url)) p.push(`${at}.url must be an https URL`);
        if (Number.isNaN(parseDate(it.fetched_at))) p.push(`${at}.fetched_at must be YYYY-MM-DD`);
        if (!nonEmpty(it.quote, 20)) p.push(`${at}.quote must quote the text relied on`);
      });
    }
    if (!DEMAND_LABELS.has(ev.demand_label)) p.push(`evidence.demand_label must be one of ${[...DEMAND_LABELS].join('/')}`);
    if (!nonEmpty(ev.limits, 20)) p.push('evidence.limits is missing (state the limits of the first-party data honestly)');
    if (!nonEmpty(ev.summary, 20)) p.push('evidence.summary is missing');
    if (ev.demand_label === 'thin' || ev.demand_label === 'none-observed') {
      if (VALIDATION_CLAIM_RE.test(`${ev.summary || ''} ${ev.limits || ''} ${rec.angle || ''}`)) {
        p.push('thin or absent first-party data must not be described as validation');
      }
    }
  }
  const oc = rec.overlap_check;
  if (!oc || typeof oc !== 'object') {
    p.push('overlap_check is missing');
  } else {
    if (oc.result !== 'distinct') p.push('overlap_check.result must be "distinct"');
    if (!Array.isArray(oc.checked_against) || oc.checked_against.length === 0) p.push('overlap_check.checked_against is empty');
    if (Number.isNaN(parseDate(oc.checked_at))) p.push('overlap_check.checked_at must be YYYY-MM-DD');
    if (!nonEmpty(oc.notes, 20)) p.push('overlap_check.notes is missing');
  }
  const ap = rec.approval;
  if (!ap || typeof ap !== 'object') {
    p.push('approval is missing');
  } else {
    if (!nonEmpty(ap.approved_by)) p.push('approval.approved_by (a label for the approver) is missing');
    if (Number.isNaN(parseDate(ap.approved_at))) p.push('approval.approved_at must be YYYY-MM-DD');
    if (ap.channel !== APPROVAL_CHANNEL) p.push(`approval.channel must be "${APPROVAL_CHANNEL}" (a GitHub comment or queue text is not an approval channel)`);
    if (typeof ap.session_id !== 'string' || !SESSION_ID_RE.test(ap.session_id)) p.push('approval.session_id must be a Claude session id');
    if (typeof ap.event_uuid !== 'string' || !UUID_RE.test(ap.event_uuid)) p.push('approval.event_uuid must be the uuid of the owner\'s message event');
    if (ap.message_line !== approvalLine(rec)) p.push('approval.message_line does not equal the exact approval line for this entry');
    if (ap.content_hash !== contentHash(rec)) p.push('approval.content_hash does not match the entry (edited after approval?)');
    if (!nonEmpty(ap.recorded_by)) p.push('approval.recorded_by (who wrote this record into the queue) is missing');
    if (Number.isNaN(parseDate(ap.recorded_at))) p.push('approval.recorded_at must be YYYY-MM-DD');
  }
  return p;
}

// ---------- eligibility (structural; the event check is separate) ----------

// ctx: { today: 'YYYY-MM-DD', blogSlugs: [...], policy?: {...} }
function evaluate(queue, ctx) {
  const policy = { ...POLICY_DEFAULTS, ...(ctx.policy || {}) };
  const blog = new Set(ctx.blogSlugs);
  const out = [];
  for (const rec of queue) {
    if (rec.status === 'published') {
      out.push({ slug: rec.slug, status: rec.status, eligible: false, reasons: ['already published'] });
      continue;
    }
    if (rec.status !== 'approved') {
      out.push({
        slug: rec.slug, status: rec.status, eligible: false,
        reasons: [`status "${rec.status}" is not write-eligible; only "approved" entries can be written, and publish_after never changes that`],
      });
      continue;
    }
    const reasons = [];
    if (blog.has(rec.slug)) reasons.push(`blog/${rec.slug}.html already exists`);
    if (Number.isNaN(parseDate(rec.publish_after)) || parseDate(rec.publish_after) > parseDate(ctx.today)) {
      reasons.push(`publish_after ${rec.publish_after} has not been reached (today ${ctx.today})`);
    }
    if (!Array.isArray(rec.internal_links) || rec.internal_links.length < 2 || rec.internal_links.length > 3) {
      reasons.push('internal_links must list 2-3 existing posts');
    } else {
      rec.internal_links.filter((l) => !blog.has(l)).forEach((l) => reasons.push(`internal link "${l}" has no blog page`));
    }
    approvalProblems(rec).forEach((b) => reasons.push(b));

    const oc = rec.overlap_check;
    if (oc && Array.isArray(oc.checked_against)) {
      const covered = new Set(oc.checked_against);
      const missing = ctx.blogSlugs.filter((s) => !covered.has(s));
      if (missing.length) reasons.push(`overlap_check.checked_against does not cover existing pages: ${missing.join(', ')}`);
    }
    const mine = new Set(intentTerms(rec));
    for (const other of queue) {
      if (other === rec || !COLLISION_STATUSES.has(other.status)) continue;
      const shared = intentTerms(other).filter((t) => mine.has(t));
      if (shared.length) reasons.push(`intent collides with "${other.slug}" on: ${shared.join(', ')}`);
    }

    const ev = rec.evidence;
    const ap = rec.approval;
    if (ap && !Number.isNaN(parseDate(ap.approved_at))) {
      if (parseDate(ap.approved_at) > parseDate(ctx.today)) reasons.push('approval is dated in the future');
      else if (daysBetween(ap.approved_at, ctx.today) > policy.maxApprovalAgeDaysAtRun) {
        reasons.push(`approval is more than ${policy.maxApprovalAgeDaysAtRun} days before the run date; re-approve with fresh evidence`);
      }
      if (ev && Array.isArray(ev.first_party)) {
        for (const it of ev.first_party) {
          if (Number.isNaN(parseDate(it.fetched_at))) continue;
          const age = daysBetween(it.fetched_at, ap.approved_at);
          if (age < 0) reasons.push('first-party evidence was fetched after the approval date');
          else if (age > policy.maxEvidenceAgeDaysAtApproval) {
            reasons.push(`first-party evidence from ${it.fetched_at} is more than ${policy.maxEvidenceAgeDaysAtApproval} days before the approval`);
          }
        }
      }
      if (oc && !Number.isNaN(parseDate(oc.checked_at)) && parseDate(oc.checked_at) > parseDate(ap.approved_at)) {
        reasons.push('overlap check is dated after the approval');
      }
    }
    out.push({ slug: rec.slug, status: rec.status, eligible: reasons.length === 0, reasons: [...new Set(reasons)] });
  }
  return out;
}

// ---------- event verification (the run-time half) ----------

// Accepts the JSON returned by the get_event tool (any wrapper depth) and pulls
// out the fields that matter. Unknown fields are reported as null, never guessed.
function normalizeEvent(raw) {
  let u = raw;
  if (u && u.ccr) u = u.ccr;
  if (u && Array.isArray(u.data)) u = u.data[0];
  if (u && u.user) u = u.user;
  if (!u || typeof u !== 'object') return null;
  const c = u.internal_anthropic_catchall || u;
  const msg = c.message || u.message || {};
  let content = msg.content;
  if (Array.isArray(content)) content = content.map((b) => (typeof b === 'string' ? b : b && b.type === 'text' ? b.text : '')).join('\n');
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null);
  return {
    uuid: pick(u.uuid, c.uuid) ?? null,
    session_id: pick(c.session_id, u.session_id) ?? null,
    role: pick(msg.role, u.role) ?? null,
    content: typeof content === 'string' ? content : '',
    client_platform: pick(c.client_platform, u.client_platform) ?? null,
    inbound_origin: pick(c.inbound_origin, u.inbound_origin, raw && raw.inbound_origin) ?? null,
    synthetic: pick(c.isSynthetic, c.is_synthetic, u.isSynthetic, u.is_synthetic, raw && raw.isSynthetic) ?? null,
  };
}

// result: { ok, needs_trusted_channel_verification, reasons, observed }
function verifyEvent(raw, rec, opts = {}) {
  const humanOrigins = opts.humanOrigins || HUMAN_ORIGIN_VALUES;
  const ap = rec && rec.approval;
  if (!rec || rec.status !== 'approved' || !ap) {
    return { ok: false, needs_trusted_channel_verification: false, reasons: ['entry is not approved'], observed: null };
  }
  const ev = normalizeEvent(raw);
  if (!ev) return { ok: false, needs_trusted_channel_verification: false, reasons: ['no event data supplied'], observed: null };
  const observed = { client_platform: ev.client_platform, inbound_origin: ev.inbound_origin, synthetic: ev.synthetic, role: ev.role };

  const hard = [];
  if (ev.uuid !== ap.event_uuid) hard.push('event uuid does not match approval.event_uuid');
  if (ev.session_id !== ap.session_id) hard.push('event session does not match approval.session_id');
  if (ev.role !== 'user') hard.push('event is not a user-role message');
  if (ev.synthetic === true) hard.push('event is marked synthetic');
  if (ap.message_line !== approvalLine(rec)) hard.push('recorded approval line does not match this entry');
  if (ap.content_hash !== contentHash(rec)) hard.push('approval.content_hash does not match the entry');
  if (!ev.content.split(/\r?\n/).some((l) => l.trim() === approvalLine(rec))) {
    hard.push(`event does not contain the exact line: ${approvalLine(rec)}`);
  }
  if (hard.length) return { ok: false, needs_trusted_channel_verification: false, reasons: hard, observed };

  if (ev.inbound_origin !== null && humanOrigins.includes(ev.inbound_origin)) {
    return { ok: true, needs_trusted_channel_verification: false, reasons: [], observed };
  }
  return {
    ok: false,
    needs_trusted_channel_verification: true,
    reasons: [
      'the event exists and contains the exact approval line, but its origin cannot be established from the event data available ' +
      `(client_platform=${ev.client_platform}, inbound_origin=${ev.inbound_origin}); do not infer approval`,
    ],
    observed,
  };
}

// ---------- CLI ----------

function main(argv) {
  const args = argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const root = path.resolve(opt('--root') || path.join(__dirname, '..'));
  const today = opt('--today') || new Date().toISOString().slice(0, 10);
  if (Number.isNaN(parseDate(today))) {
    console.error(`--today must be YYYY-MM-DD, got "${today}"`);
    return 2;
  }
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
  } catch (e) {
    console.error(`cannot read content-queue.json: ${e.message}`);
    return 2;
  }
  const errors = validateQueue(queue);
  if (errors.length) {
    console.error('content-queue.json is invalid:\n  - ' + errors.join('\n  - '));
    return 1;
  }
  const blogSlugs = listBlogSlugs(root);

  if (args.includes('--hash')) {
    const rec = queue.find((r) => r.slug === opt('--hash'));
    if (!rec) { console.error('no such slug'); return 1; }
    if (!rec.evidence || !DEMAND_LABELS.has(rec.evidence.demand_label)) {
      console.error('entry has no evidence.demand_label yet, so there is no approval line to print');
      return 1;
    }
    console.log(JSON.stringify({ slug: rec.slug, content_hash: contentHash(rec), approval_line: approvalLine(rec) }));
    return 0;
  }
  if (args.includes('--verify-event')) {
    const rec = queue.find((r) => r.slug === opt('--verify-event'));
    if (!rec) { console.error('no such slug'); return 1; }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { console.error('stdin is not event JSON'); return 1; }
    const res = verifyEvent(raw, rec);
    console.log(JSON.stringify(res));
    return res.ok ? 0 : 1;
  }
  if (args.includes('--eligible')) {
    const results = evaluate(queue, { today, blogSlugs });
    const eligible = results.filter((r) => r.eligible).map((r) => r.slug);
    const blocked = results.filter((r) => !r.eligible && r.status !== 'published');
    console.log(JSON.stringify({
      today,
      eligible,
      policy: { ...POLICY_DEFAULTS, note: 'safety defaults, not SEO or demand thresholds; evidence age is measured at approval, approval age at the run date' },
      next_step: 'eligible means structurally complete only; run --verify-event on the approval event before writing',
      blocked,
    }, null, 2));
    return 0;
  }
  const counts = queue.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`content-queue.json valid: ${queue.length} entries ${JSON.stringify(counts)}`);
  return 0;
}

module.exports = {
  validateQueue, evaluate, verifyEvent, normalizeEvent, contentHash, approvalLine,
  listBlogSlugs, parseDate, approvalProblems, POLICY_DEFAULTS, HUMAN_ORIGIN_VALUES,
};

if (require.main === module) process.exit(main(process.argv));
