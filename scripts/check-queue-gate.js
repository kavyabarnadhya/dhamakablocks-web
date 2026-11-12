#!/usr/bin/env node
'use strict';

// Proposal gate for content-queue.json.
//
// The scheduled routine is PROPOSALS-ONLY. It researches topics and appends them
// to content-queue.json as `status: "proposed"`; it never writes an article and
// never approves, promotes or edits an existing entry. The site owner approves a
// specific topic and revision (named by its slug and fingerprint); only then is
// the article drafted for review, and its PR needs its own merge approval.
// Nothing in the queue file records or implies an approval, and this script does
// not check one: a `publish_after` date or anything written in the queue never
// permits writing.
//
// What this script enforces on every `proposed` entry (CI + the routine):
//   - FIRST-PARTY evidence is cited: Search Console (live or the stored digest)
//     or GA4/traffic, with source, date, window and quoted rows (a zero result is
//     quoted too). Public web search and competitor research are SUPPLEMENTARY
//     only and can never satisfy this.
//   - an honest demand label (observed / thin / none-observed) and written
//     limits. Thin or absent data is labelled, never described as validation,
//     and there is NO minimum-impression cutoff.
//   - an intent-overlap check covering every existing blog page, marked
//     "distinct", and no exact intent term shared with a published or proposed
//     entry. A retired/rejected/skipped topic may only be re-proposed with an
//     explicit `addresses_retirement` note.
// Legacy "queued" and "approved" statuses are invalid; so is an `approval` block.
//
// Usage:
//   node scripts/check-queue-gate.js                      validate the queue
//   node scripts/check-queue-gate.js --proposals          list proposals as JSON (the routine's no-op test)
//   node scripts/check-queue-gate.js --check-writable <slug>
//        completeness check before drafting; prints the fingerprint of the exact
//        revision. It does NOT check the owner's approval.
//   options: --today YYYY-MM-DD   --root <repo dir>

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Safety default, not an SEO requirement and not a demand threshold. It reuses the
// owner's existing 10-day rule for the weekly digest: each first-party evidence item
// must be fetched at most this many days BEFORE the entry's `proposed_at` date, so a
// reviewer sees current numbers. It changes only by a reviewed PR, never at run time.
const POLICY_DEFAULTS = Object.freeze({ maxEvidenceAgeDaysAtProposal: 10 });
const MIN_REVIEW_DAYS = 3; // existing rule: publish_after is at least 3 days after the proposal

const STATUSES = new Set(['published', 'proposed', 'retired', 'rejected', 'skipped']);
const BASE_KEYS = ['slug', 'title', 'intent', 'angle', 'internal_links', 'status', 'publish_after'];
const FIRST_PARTY_KINDS = new Set(['gsc-live', 'gsc-digest', 'ga4']);
const SUPPLEMENTARY_KINDS = new Set(['web-search', 'competitor-research']);
const DEMAND_LABELS = new Set(['observed', 'thin', 'none-observed']);
const VALIDATION_CLAIM_RE = /\bvalidat(?:e|ed|es|ing|ion)\b|\bproves?\b|\bproven\b|\bconfirms? (?:the )?demand\b/i;

// ---------- helpers ----------

function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const t = Date.parse(s + 'T00:00:00Z');
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return NaN;
  return t;
}

const daysBetween = (a, b) => (parseDate(b) - parseDate(a)) / 86400000;
const nonEmpty = (s, min = 1) => typeof s === 'string' && s.trim().length >= min;

function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

// Identifies the exact revision of a proposal (topic, angle, links, evidence and
// overlap check). The owner's approval message and the writing request should name
// it, so an entry edited after approval no longer matches.
function contentHash(rec) {
  const subject = {
    slug: rec.slug, title: rec.title, intent: rec.intent, angle: rec.angle,
    internal_links: rec.internal_links, publish_after: rec.publish_after,
    evidence: rec.evidence, overlap_check: rec.overlap_check,
  };
  return crypto.createHash('sha256').update(canonical(subject)).digest('hex');
}
const fingerprint = (rec) => contentHash(rec).slice(0, 12);

const intentTerms = (rec) => String(rec.intent || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

function listBlogSlugs(root) {
  const dir = path.join(root, 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'))
    .map((f) => f.slice(0, -5))
    .sort();
}

// ---------- per-entry checks ----------

// Structural problems for a proposed entry's own fields (no repo context needed).
function proposalShapeProblems(rec, policy) {
  const p = [];
  if (Number.isNaN(parseDate(rec.proposed_at))) p.push('proposed_at must be a real YYYY-MM-DD date');
  else if (parseDate(rec.publish_after) - parseDate(rec.proposed_at) < MIN_REVIEW_DAYS * 86400000) {
    p.push(`publish_after must be at least ${MIN_REVIEW_DAYS} days after proposed_at (never backdate)`);
  }
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
        if (!nonEmpty(it.window, 7)) p.push(`${at}.window must state the date window`);
        if (!nonEmpty(it.quote, 20)) p.push(`${at}.quote must quote the rows relied on (including a zero result)`);
        if (Number.isNaN(parseDate(it.fetched_at))) p.push(`${at}.fetched_at must be YYYY-MM-DD`);
        else if (!Number.isNaN(parseDate(rec.proposed_at))) {
          const age = daysBetween(it.fetched_at, rec.proposed_at);
          if (age < 0) p.push(`${at} was fetched after proposed_at`);
          else if (age > policy.maxEvidenceAgeDaysAtProposal) {
            p.push(`${at} is ${age} days older than proposed_at (default limit ${policy.maxEvidenceAgeDaysAtProposal})`);
          }
        }
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
    if ((ev.demand_label === 'thin' || ev.demand_label === 'none-observed')
      && VALIDATION_CLAIM_RE.test(`${ev.summary || ''} ${ev.limits || ''} ${rec.angle || ''}`)) {
      p.push('thin or absent first-party data must not be described as validation');
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
  return p;
}

// Problems that need the rest of the repo: existing pages, other entries.
function proposalContextProblems(rec, queue, blogSlugs) {
  const p = [];
  const blog = new Set(blogSlugs);
  if (blog.has(rec.slug)) p.push(`blog/${rec.slug}.html already exists`);
  if (!Array.isArray(rec.internal_links) || rec.internal_links.length < 2 || rec.internal_links.length > 3) {
    p.push('internal_links must list 2-3 existing posts');
  } else {
    rec.internal_links.filter((l) => !blog.has(l)).forEach((l) => p.push(`internal link "${l}" has no blog page`));
  }
  const oc = rec.overlap_check;
  if (oc && Array.isArray(oc.checked_against)) {
    const covered = new Set(oc.checked_against);
    const missing = blogSlugs.filter((s) => !covered.has(s));
    if (missing.length) p.push(`overlap_check.checked_against does not cover existing pages: ${missing.join(', ')}`);
  }
  const mine = new Set(intentTerms(rec));
  for (const other of queue) {
    if (other === rec) continue;
    const shared = intentTerms(other).filter((t) => mine.has(t));
    if (!shared.length) continue;
    if (other.status === 'published' || other.status === 'proposed') {
      p.push(`intent collides with ${other.status} "${other.slug}" on: ${shared.join(', ')}`);
    } else if (other.status === 'retired' || other.status === 'rejected' || other.status === 'skipped') {
      const a = rec.addresses_retirement;
      const ok = a && a.slug === other.slug && nonEmpty(a.note, 20);
      if (!ok) p.push(`intent collides with ${other.status} "${other.slug}" on: ${shared.join(', ')}; re-proposing needs addresses_retirement {slug, note} explaining the new evidence`);
    }
  }
  return p;
}

// ---------- queue validation (CI + routine) ----------

// ctx (optional): { blogSlugs, policy }. Without it only the structural checks run.
function validateQueue(queue, ctx = {}) {
  const policy = { ...POLICY_DEFAULTS, ...(ctx.policy || {}) };
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
      errors.push(`${id}: status "queued" is no longer valid; use "proposed" (the scheduled routine only proposes)`);
    } else if (rec.status === 'approved') {
      errors.push(`${id}: status "approved" is not used; the owner's approval is not recorded in the queue`);
    } else if (!STATUSES.has(rec.status)) {
      errors.push(`${id}: unknown status "${rec.status}"`);
    }
    if ('approval' in rec) errors.push(`${id}: an approval block must not appear in the queue`);
    if (rec.status === 'retired') {
      if (!rec.retired_reason) errors.push(`${id}: retired entry needs retired_reason`);
      if (Number.isNaN(parseDate(rec.retired_at))) errors.push(`${id}: retired entry needs retired_at (YYYY-MM-DD)`);
    }
    if (rec.status === 'proposed') {
      proposalShapeProblems(rec, policy).forEach((b) => errors.push(`${id}: ${b}`));
      if (Array.isArray(ctx.blogSlugs)) {
        proposalContextProblems(rec, queue, ctx.blogSlugs).forEach((b) => errors.push(`${id}: ${b}`));
      }
    }
  });
  return errors;
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
  if (Number.isNaN(parseDate(today))) { console.error(`--today must be YYYY-MM-DD, got "${today}"`); return 2; }
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
  } catch (e) {
    console.error(`cannot read content-queue.json: ${e.message}`);
    return 2;
  }
  const blogSlugs = listBlogSlugs(root);
  const errors = validateQueue(queue, { blogSlugs });
  const proposals = queue.filter((r) => r.status === 'proposed');
  for (const r of proposals) {
    if (parseDate(r.proposed_at) > parseDate(today)) errors.push(`${r.slug}: proposed_at is in the future`);
  }

  if (args.includes('--check-writable')) {
    const slug = opt('--check-writable');
    const rec = queue.find((r) => r.slug === slug);
    if (!rec) { console.error('no such slug'); return 1; }
    const reasons = [];
    if (rec.status !== 'proposed') reasons.push(`status is "${rec.status}"; only a "proposed" entry can be written`);
    errors.filter((e) => e.startsWith(`${slug}:`)).forEach((e) => reasons.push(e));
    const ok = reasons.length === 0;
    console.log(JSON.stringify({
      slug, writable_checks_passed: ok, fingerprint: ok ? fingerprint(rec) : null, reasons,
      approval: 'NOT checked here. The owner approves a specific topic and revision; this check only confirms the entry is complete and prints its fingerprint.',
    }, null, 2));
    return ok ? 0 : 1;
  }

  if (errors.length) {
    console.error('content-queue.json is invalid:\n  - ' + errors.join('\n  - '));
    return 1;
  }
  if (args.includes('--proposals')) {
    console.log(JSON.stringify({
      today,
      policy: { ...POLICY_DEFAULTS, note: 'safety default reusing the existing 10-day digest rule; not an SEO or demand threshold' },
      proposals: proposals.map((r) => ({ slug: r.slug, proposed_at: r.proposed_at, fingerprint: fingerprint(r) })),
      note: 'The scheduled routine only proposes. If any proposal is listed it is waiting for the owner: do not research and do not write.',
    }, null, 2));
    return 0;
  }
  const counts = queue.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`content-queue.json valid: ${queue.length} entries ${JSON.stringify(counts)}`);
  return 0;
}

module.exports = {
  validateQueue, proposalShapeProblems, proposalContextProblems, contentHash, fingerprint,
  listBlogSlugs, parseDate, POLICY_DEFAULTS,
};

if (require.main === module) process.exit(main(process.argv));
