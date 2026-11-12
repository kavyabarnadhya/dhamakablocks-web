#!/usr/bin/env node
'use strict';

// Write-eligibility gate for content-queue.json.
//
// A queue entry is a PROPOSAL until a human approves it. Neither a due
// `publish_after` date nor anything an agent writes in the queue prose makes a
// topic eligible to be written as an article. An entry is write-eligible only
// when ALL of these hold (see evaluate()):
//   - status is "approved" (never "proposed", "queued", "retired", ...)
//   - cited, fresh search evidence is recorded
//   - an intent-overlap check against every existing page is recorded and says
//     "distinct", and no exact intent term collides with another entry
//   - a human approval is recorded with a recoverable reference (a GitHub
//     comment URL), bound to the entry's content by hash
//   - publish_after has been reached (necessary, never sufficient)
//
// The approval comment itself is checked separately with --verify-comment,
// because that needs the comment JSON from GitHub. This file does no network I/O.
//
// Usage:
//   node scripts/check-queue-gate.js                      validate the queue
//   node scripts/check-queue-gate.js --eligible           list write-eligible slugs (JSON)
//   node scripts/check-queue-gate.js --hash <slug>        print the content hash to approve
//   node scripts/check-queue-gate.js --verify-comment <slug> < comment.json
//   options: --today YYYY-MM-DD   --root <repo dir>

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUSES = new Set(['published', 'proposed', 'approved', 'retired', 'rejected', 'skipped']);
const BASE_KEYS = ['slug', 'title', 'intent', 'angle', 'internal_links', 'status', 'publish_after'];
const EVIDENCE_KINDS = new Set(['gsc-live', 'gsc-digest', 'web-search']);
const MAX_EVIDENCE_AGE_DAYS = 14; // evidence must be this fresh when approval is given
const MAX_APPROVAL_AGE_DAYS = 30; // approval expires; re-approve after this
const COLLISION_STATUSES = new Set(['published', 'proposed', 'approved']);
const REF_RE = /^https:\/\/github\.com\/kavyabarnadhya\/dhamakablocks-web\/(?:issues|pull)\/\d+#issuecomment-\d+$/;
const AGENT_NAME_RE = /claude|jules|agent|\bbot\b|\[bot\]|assistant|\bai\b/i;
const AGENT_BODY_RE = /generated (?:with|by)|co-authored-by|claude-session|🤖/i;
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

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

// Everything the human approves. Editing any of it after approval changes the
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

function isHuman(name) {
  return typeof name === 'string' && name.trim() !== '' && !AGENT_NAME_RE.test(name);
}

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
      const bad = approvalProblems(rec);
      bad.forEach((b) => errors.push(`${id}: approved entry incomplete: ${b}`));
    }
  });
  return errors;
}

// Shape and internal-consistency problems for the evidence/overlap/approval blocks.
function approvalProblems(rec) {
  const p = [];
  const ev = rec.evidence;
  if (!ev || !Array.isArray(ev.items) || ev.items.length === 0) {
    p.push('evidence.items is missing or empty');
  } else {
    ev.items.forEach((it, n) => {
      if (!EVIDENCE_KINDS.has(it.kind)) p.push(`evidence.items[${n}].kind must be one of ${[...EVIDENCE_KINDS].join('/')}`);
      if (typeof it.url !== 'string' || !/^https:\/\/\S+$/.test(it.url)) p.push(`evidence.items[${n}].url must be an https URL`);
      if (Number.isNaN(parseDate(it.fetched_at))) p.push(`evidence.items[${n}].fetched_at must be YYYY-MM-DD`);
      if (typeof it.quote !== 'string' || it.quote.trim().length < 20) p.push(`evidence.items[${n}].quote must quote the rows or text relied on`);
    });
    if (typeof ev.summary !== 'string' || ev.summary.trim().length < 20) p.push('evidence.summary is missing (state what the evidence shows and its limits)');
  }
  const oc = rec.overlap_check;
  if (!oc || typeof oc !== 'object') {
    p.push('overlap_check is missing');
  } else {
    if (oc.result !== 'distinct') p.push('overlap_check.result must be "distinct"');
    if (!Array.isArray(oc.checked_against) || oc.checked_against.length === 0) p.push('overlap_check.checked_against is empty');
    if (Number.isNaN(parseDate(oc.checked_at))) p.push('overlap_check.checked_at must be YYYY-MM-DD');
    if (typeof oc.notes !== 'string' || oc.notes.trim().length < 20) p.push('overlap_check.notes is missing');
  }
  const ap = rec.approval;
  if (!ap || typeof ap !== 'object') {
    p.push('approval is missing');
  } else {
    if (!isHuman(ap.approved_by)) p.push('approval.approved_by must name a human (not an agent or bot)');
    if (Number.isNaN(parseDate(ap.approved_at))) p.push('approval.approved_at must be YYYY-MM-DD');
    if (typeof ap.ref !== 'string' || !REF_RE.test(ap.ref)) p.push('approval.ref must be a GitHub issue/PR comment URL in this repository');
    if (ap.content_hash !== contentHash(rec)) p.push('approval.content_hash does not match the entry (edited after approval?)');
  }
  return p;
}

// ---------- eligibility ----------

// Returns one result per entry: { slug, status, eligible, reasons }.
// ctx: { today: 'YYYY-MM-DD', blogSlugs: [...] }
function evaluate(queue, ctx) {
  const blog = new Set(ctx.blogSlugs);
  const out = [];
  for (const rec of queue) {
    const reasons = [];
    if (rec.status === 'published') {
      out.push({ slug: rec.slug, status: rec.status, eligible: false, reasons: ['already published'] });
      continue;
    }
    if (rec.status !== 'approved') {
      reasons.push(`status "${rec.status}" is not write-eligible; only "approved" entries can be written, and publish_after never changes that`);
      out.push({ slug: rec.slug, status: rec.status, eligible: false, reasons });
      continue;
    }
    // From here on the entry claims to be approved: every requirement must hold.
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
      else if (daysBetween(ap.approved_at, ctx.today) > MAX_APPROVAL_AGE_DAYS) {
        reasons.push(`approval is older than ${MAX_APPROVAL_AGE_DAYS} days; re-approve with fresh evidence`);
      }
      if (ev && Array.isArray(ev.items)) {
        for (const it of ev.items) {
          if (Number.isNaN(parseDate(it.fetched_at))) continue;
          const age = daysBetween(it.fetched_at, ap.approved_at);
          if (age < 0) reasons.push('evidence was fetched after the approval date');
          else if (age > MAX_EVIDENCE_AGE_DAYS) reasons.push(`evidence from ${it.fetched_at} is more than ${MAX_EVIDENCE_AGE_DAYS} days older than the approval`);
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

// ---------- approval-comment verification ----------

// comment: the JSON of a GitHub issue comment (gh api repos/OWNER/REPO/issues/comments/ID).
function verifyApprovalComment(comment, rec, nowIso) {
  const reasons = [];
  const ap = rec && rec.approval;
  if (!rec || rec.status !== 'approved' || !ap) return { ok: false, reasons: ['entry is not approved'] };
  if (!comment || typeof comment !== 'object') return { ok: false, reasons: ['no comment JSON supplied'] };
  if (comment.html_url !== ap.ref) reasons.push('comment URL does not match approval.ref');
  const user = comment.user || {};
  if (user.login !== ap.approved_by) reasons.push('comment author is not approval.approved_by');
  if (user.type !== 'User') reasons.push('comment author is not a User account (bots are refused)');
  if (!isHuman(user.login)) reasons.push('comment author name looks like an agent');
  if (!TRUSTED_ASSOCIATIONS.has(comment.author_association)) reasons.push('comment author is not an owner, member or collaborator');
  if (comment.updated_at !== comment.created_at) reasons.push('comment was edited after it was posted');
  const created = Date.parse(comment.created_at);
  if (Number.isNaN(created) || created > Date.parse(nowIso)) reasons.push('comment timestamp is missing or in the future');
  const body = String(comment.body || '');
  if (AGENT_BODY_RE.test(body)) reasons.push('comment carries an agent/attribution marker');
  const full = contentHash(rec);
  if (ap.content_hash !== full) reasons.push('approval.content_hash does not match the entry');
  const line = `APPROVE-WRITE ${rec.slug} ${full.slice(0, 12)}`;
  if (!body.split(/\r?\n/).some((l) => l.trim() === line)) reasons.push(`comment lacks the exact line: ${line}`);
  return { ok: reasons.length === 0, reasons };
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
    const h = contentHash(rec);
    console.log(JSON.stringify({ slug: rec.slug, content_hash: h, approval_line: `APPROVE-WRITE ${rec.slug} ${h.slice(0, 12)}` }));
    return 0;
  }
  if (args.includes('--verify-comment')) {
    const rec = queue.find((r) => r.slug === opt('--verify-comment'));
    if (!rec) { console.error('no such slug'); return 1; }
    let comment;
    try { comment = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { console.error('stdin is not comment JSON'); return 1; }
    const res = verifyApprovalComment(comment, rec, new Date().toISOString());
    console.log(JSON.stringify(res));
    return res.ok ? 0 : 1;
  }
  if (args.includes('--eligible')) {
    const results = evaluate(queue, { today, blogSlugs });
    const eligible = results.filter((r) => r.eligible).map((r) => r.slug);
    const blocked = results.filter((r) => !r.eligible && r.status !== 'published');
    console.log(JSON.stringify({ today, eligible, requires_comment_verification: true, blocked }, null, 2));
    return 0;
  }
  const counts = queue.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`content-queue.json valid: ${queue.length} entries ${JSON.stringify(counts)}`);
  return 0;
}

module.exports = { validateQueue, evaluate, verifyApprovalComment, contentHash, listBlogSlugs, parseDate, approvalProblems };

if (require.main === module) process.exit(main(process.argv));
