#!/usr/bin/env node
'use strict';

// Proposal gate for content-queue.json.
//
// The scheduled routine proposes topics (new posts) and page edits (changes to an
// existing post) in batches, as `status: "proposed"` entries on a
// `content/queue-refresh-YYYY-MM-DD` branch, and opens a PR. APPROVAL = THE OWNER
// MERGING THAT PR. The owner removes or edits any entry they do not want before
// merging. Only entries that the merged PR itself added or changed count as
// approved, and only while they are still exactly (by fingerprint) the revision
// that was merged. `--approved` checks this against GitHub's own record of who
// merged the PR (fetched by the routine with `gh pr list --json ...`), so nothing
// written inside the queue, a PR body or a comment can approve anything. Each
// approved entry is then written as its own PR, which needs its own merge.
// Legacy "queued" and "approved" statuses are invalid; so is an `approval` block.
//
// What this script enforces on every `proposed` entry (CI + the routine):
//   - FIRST-PARTY evidence is cited: Search Console (live or the stored digest)
//     or GA4/traffic, with source, date, window and quoted rows (a zero result is
//     quoted too). Public web search, competitor research and AI-question research
//     are SUPPLEMENTARY and are never counted as first-party data.
//   - an honest demand label (widened 2026-11-25 by the owner to unblock growth;
//     before that only "observed" was allowed):
//       observed         a matching first-party query row with a real CLICK
//       impressions-only a matching first-party query row with impressions
//       unproven         no first-party match (the zero result is still quoted),
//                        but supplementary research is required: a competitor or
//                        keyword gap, web search, or an AI-question.
//     impressions-only and unproven entries also carry `review_after_weeks`
//     (4-12): the published page is checked against first-party data that long
//     after publishing and retired if it earned nothing.
//   - new posts: an intent-overlap check covering every existing blog page,
//     marked "distinct", and no exact intent term shared with a published or
//     proposed entry. A retired/rejected/skipped topic may only be re-proposed
//     with an explicit `addresses_retirement` note.
//   - page edits (`type: "edit"`): an existing `target` page, a list of concrete
//     `changes`, and at least one first-party PAGE row for the target with
//     impressions. At most one proposed edit per target at a time.
//
// Usage:
//   node scripts/check-queue-gate.js                      validate the queue
//   node scripts/check-queue-gate.js --proposals          list proposals as JSON
//   node scripts/check-queue-gate.js --check-writable <slug>
//        completeness check before drafting; prints the fingerprint of the exact
//        revision. It does NOT check the owner's approval.
//   node scripts/check-queue-gate.js --approved --prs <file>
//        list entries the owner approved by merging a batch PR. <file> is the
//        output of `gh pr list --state merged --base main --limit 50
//        --json number,headRefName,baseRefName,mergedBy,mergeCommit`. Each merge
//        commit and its first parent must be in local git history; the script
//        runs `git fetch --depth=2 origin <sha>` for any it lacks. Use merge or
//        squash merges for batch PRs (with a rebase merge only the last commit's
//        entries are seen, so earlier ones are safely treated as unapproved).
//   options: --today YYYY-MM-DD   --root <repo dir>   --no-fetch

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Safety default, not an SEO requirement and not a demand threshold. It reuses the
// owner's existing 10-day rule for the weekly digest: each first-party evidence item
// must be fetched at most this many days BEFORE the entry's `proposed_at` date, so a
// reviewer sees current numbers. It changes only by a reviewed PR, never at run time.
const POLICY_DEFAULTS = Object.freeze({ maxEvidenceAgeDaysAtProposal: 10 });
const MIN_REVIEW_DAYS = 3; // existing rule: publish_after is at least 3 days after the proposal

// The only GitHub account whose merge of a batch PR approves its entries.
const APPROVER_LOGIN = 'kavyabarnadhya';
const BATCH_BRANCH_PREFIX = 'content/queue-refresh-';

const STATUSES = new Set(['published', 'proposed', 'retired', 'rejected', 'skipped']);
const TYPES = new Set(['new', 'edit']);
const BASE_KEYS = ['slug', 'title', 'intent', 'angle', 'internal_links', 'status', 'publish_after'];
const FIRST_PARTY_KINDS = new Set(['gsc-live', 'gsc-digest', 'ga4']);
const SUPPLEMENTARY_KINDS = new Set(['web-search', 'competitor-research', 'ai-question']);
const DEMAND_LABELS = new Set(['observed', 'impressions-only', 'unproven']);
const EDIT_ELEMENTS = new Set(['title', 'meta-description', 'h1', 'intro', 'section', 'faq', 'table', 'schema', 'internal-links', 'cta']);
const REVIEW_WEEKS = Object.freeze({ min: 4, max: 12 });
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

// Identifies the exact revision of a proposal (topic, angle, links, evidence,
// overlap check and, for page edits, the target and changes). Approval is tied to
// it: an entry edited after the owner merged it no longer matches.
function contentHash(rec) {
  const subject = {
    slug: rec.slug, title: rec.title, intent: rec.intent, angle: rec.angle,
    internal_links: rec.internal_links, publish_after: rec.publish_after,
    evidence: rec.evidence, overlap_check: rec.overlap_check,
  };
  // Added only when present, so fingerprints of older new-post entries are unchanged.
  for (const k of ['type', 'target', 'changes']) if (rec[k] !== undefined) subject[k] = rec[k];
  return crypto.createHash('sha256').update(canonical(subject)).digest('hex');
}
const fingerprint = (rec) => contentHash(rec).slice(0, 12);

const intentTerms = (rec) => String(rec.intent || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
const entryType = (rec) => (rec && rec.type !== undefined ? rec.type : 'new');

function pageMatchesTarget(page, target) {
  const p = String(page || '').trim().toLowerCase()
    .replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '').replace(/\.html$/, '').replace(/\/$/, '');
  return p === `/blog/${String(target).toLowerCase()}`;
}

function listBlogSlugs(root) {
  const dir = path.join(root, 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'))
    .map((f) => f.slice(0, -5))
    .sort();
}

// ---------- per-entry checks ----------

// First-party rows are query rows (`query`) or page rows (`page`, e.g.
// "/blog/some-post"). A matching query row's query matches one of the entry's
// intent terms. The demand label must honestly describe what matched. Weaker
// labels also need `review_after_weeks`, when the published page is checked and
// retired if first-party data shows it earned nothing.
function demandProblems(rec, ev) {
  const p = [];
  const rows = [];
  (Array.isArray(ev.first_party) ? ev.first_party : []).forEach((it, n) => {
    if (it.rows === undefined) return;
    const at = `evidence.first_party[${n}].rows`;
    if (!Array.isArray(it.rows)) { p.push(`${at} must be an array`); return; }
    it.rows.forEach((r, k) => {
      const w = `${at}[${k}]`;
      const isQuery = nonEmpty(r.query);
      const key = isQuery ? r.query : r.page;
      if (!isQuery && !nonEmpty(r.page)) p.push(`${w}.query (or .page for a page row) is missing`);
      if (!Number.isInteger(r.clicks) || r.clicks < 0) p.push(`${w}.clicks must be a non-negative integer`);
      if (!Number.isInteger(r.impressions) || r.impressions < 0) p.push(`${w}.impressions must be a non-negative integer`);
      if (Number.isInteger(r.clicks) && Number.isInteger(r.impressions) && r.clicks > r.impressions) {
        p.push(`${w} has more clicks than impressions`);
      }
      if (nonEmpty(key) && !String(it.quote || '').toLowerCase().includes(key.trim().toLowerCase())) {
        p.push(`${w}.${isQuery ? 'query' : 'page'} must appear in the quoted rows of the same item`);
      }
      rows.push(r);
    });
  });
  const terms = intentTerms(rec).filter((t) => t.length >= 3);
  const matches = (q) => {
    const x = q.trim().toLowerCase();
    return x.length >= 3 && terms.some((t) => x === t || x.includes(t) || t.includes(x));
  };
  const matchingQueries = rows.filter((r) => nonEmpty(r.query) && matches(r.query));
  const label = ev.demand_label;
  if (label === 'observed' && !matchingQueries.some((r) => Number.isInteger(r.clicks) && r.clicks >= 1)) {
    p.push("demand_label \"observed\" needs at least one first-party query row with a real click that matches the entry's intent (otherwise label it \"impressions-only\" or \"unproven\")");
  }
  if (label === 'impressions-only' && !matchingQueries.some((r) => Number.isInteger(r.impressions) && r.impressions >= 1)) {
    p.push("demand_label \"impressions-only\" needs at least one first-party query row with impressions that matches the entry's intent (otherwise label it \"unproven\")");
  }
  if (label === 'unproven') {
    const sup = Array.isArray(ev.supplementary) ? ev.supplementary : [];
    if (!sup.some((s) => s && SUPPLEMENTARY_KINDS.has(s.kind))) {
      p.push('demand_label "unproven" needs at least one supplementary item (competitor-research, web-search or ai-question) showing the gap');
    }
  }
  if (label === 'impressions-only' || label === 'unproven') {
    const w = ev.review_after_weeks;
    if (!Number.isInteger(w) || w < REVIEW_WEEKS.min || w > REVIEW_WEEKS.max) {
      p.push(`evidence.review_after_weeks must be an integer from ${REVIEW_WEEKS.min} to ${REVIEW_WEEKS.max} for a "${label}" entry`);
    }
  }
  if (entryType(rec) === 'edit' && !rows.some((r) => nonEmpty(r.page) && pageMatchesTarget(r.page, rec.target)
      && Number.isInteger(r.impressions) && r.impressions >= 1)) {
    p.push(`a page edit needs at least one first-party page row for /blog/${rec.target} with impressions`);
  }
  if (rec.exploratory !== undefined) {
    p.push('the "exploratory" field is not used: label weak evidence with demand_label "impressions-only" or "unproven" instead');
  }
  return p;
}

function editShapeProblems(rec) {
  const p = [];
  if (!/^edit-[a-z0-9]+(-[a-z0-9]+)*$/.test(String(rec.slug))) p.push('a page edit\'s slug must start with "edit-" (e.g. edit-<target>-YYYY-MM-DD)');
  if (!nonEmpty(rec.target)) p.push('a page edit needs a "target" (an existing blog slug)');
  if (!Array.isArray(rec.changes) || rec.changes.length === 0) {
    p.push('a page edit needs a non-empty "changes" list');
  } else {
    rec.changes.forEach((c, n) => {
      const at = `changes[${n}]`;
      if (!c || !EDIT_ELEMENTS.has(c.element)) p.push(`${at}.element must be one of ${[...EDIT_ELEMENTS].join('/')}`);
      if (!c || !nonEmpty(c.proposed, 10)) p.push(`${at}.proposed must describe the new text or change`);
      if (!c || !nonEmpty(c.reason, 10)) p.push(`${at}.reason must say why, tied to the evidence`);
    });
  }
  return p;
}

// Structural problems for a proposed entry's own fields (no repo context needed).
function proposalShapeProblems(rec, policy) {
  const p = [];
  if (!TYPES.has(entryType(rec))) p.push(`type must be one of ${[...TYPES].join('/')} (omit it for a new post)`);
  if (entryType(rec) === 'edit') editShapeProblems(rec).forEach((b) => p.push(b));
  if (Number.isNaN(parseDate(rec.proposed_at))) p.push('proposed_at must be a real YYYY-MM-DD date');
  else if (parseDate(rec.publish_after) - parseDate(rec.proposed_at) < MIN_REVIEW_DAYS * 86400000) {
    p.push(`publish_after must be at least ${MIN_REVIEW_DAYS} days after proposed_at (never backdate)`);
  }
  const ev = rec.evidence;
  if (!ev || typeof ev !== 'object') {
    p.push('evidence is missing');
  } else {
    if (!Array.isArray(ev.first_party) || ev.first_party.length === 0) {
      p.push('evidence.first_party is empty: cite Search Console or GA4/traffic data, quoting a zero result if there is one (public search alone is not enough)');
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
    if (VALIDATION_CLAIM_RE.test(`${ev.summary || ''} ${ev.limits || ''} ${rec.angle || ''}`)) {
      p.push('evidence must not be overstated as proof or validation of demand');
    }
    demandProblems(rec, ev).forEach((b) => p.push(b));
  }
  if (entryType(rec) !== 'edit') {
    const oc = rec.overlap_check;
    if (!oc || typeof oc !== 'object') {
      p.push('overlap_check is missing');
    } else {
      if (oc.result !== 'distinct') p.push('overlap_check.result must be "distinct"');
      if (!Array.isArray(oc.checked_against) || oc.checked_against.length === 0) p.push('overlap_check.checked_against is empty');
      if (Number.isNaN(parseDate(oc.checked_at))) p.push('overlap_check.checked_at must be YYYY-MM-DD');
      if (!nonEmpty(oc.notes, 20)) p.push('overlap_check.notes is missing');
    }
  }
  return p;
}

// Problems that need the rest of the repo: existing pages, other entries.
function proposalContextProblems(rec, queue, blogSlugs) {
  const p = [];
  const blog = new Set(blogSlugs);
  const isEdit = entryType(rec) === 'edit';
  if (blog.has(rec.slug)) p.push(`blog/${rec.slug}.html already exists`);
  const links = rec.internal_links;
  const [minLinks, maxLinks] = isEdit ? [0, 3] : [2, 3];
  if (!Array.isArray(links) || links.length < minLinks || links.length > maxLinks) {
    p.push(isEdit ? 'internal_links must list 0-3 existing posts' : 'internal_links must list 2-3 existing posts');
  } else {
    links.filter((l) => !blog.has(l)).forEach((l) => p.push(`internal link "${l}" has no blog page`));
  }
  if (isEdit) {
    if (nonEmpty(rec.target) && !blog.has(rec.target)) p.push(`edit target "${rec.target}" has no blog page`);
    queue.filter((o) => o !== rec && o.status === 'proposed' && entryType(o) === 'edit' && o.target === rec.target)
      .forEach((o) => p.push(`another proposed edit ("${o.slug}") already targets "${rec.target}"`));
    return p;
  }
  const oc = rec.overlap_check;
  if (oc && Array.isArray(oc.checked_against)) {
    const covered = new Set(oc.checked_against);
    const missing = blogSlugs.filter((s) => !covered.has(s));
    if (missing.length) p.push(`overlap_check.checked_against does not cover existing pages: ${missing.join(', ')}`);
  }
  const mine = new Set(intentTerms(rec));
  for (const other of queue) {
    if (other === rec || entryType(other) === 'edit') continue;
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
      errors.push(`${id}: status "queued" is no longer valid; use "proposed"`);
    } else if (rec.status === 'approved') {
      errors.push(`${id}: status "approved" is not used; approval is the owner merging the batch PR, checked with --approved`);
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

// ---------- owner approval (merge of a batch PR) ----------

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function hasCommit(root, ref) {
  try { git(root, ['cat-file', '-e', `${ref}^{commit}`]); return true; } catch (e) { return false; }
}
function queueAt(root, ref) {
  let text;
  try { text = git(root, ['show', `${ref}:content-queue.json`]); } catch (e) { return []; }
  try { const q = JSON.parse(text); return Array.isArray(q) ? q : []; } catch (e) { return []; }
}

// Why a merged PR does or does not count as the owner's approval of a batch.
function prRejection(pr) {
  if (!pr || typeof pr !== 'object') return 'not a PR record';
  if (pr.baseRefName !== 'main') return `base is "${pr.baseRefName}", not main`;
  if (typeof pr.headRefName !== 'string' || !pr.headRefName.startsWith(BATCH_BRANCH_PREFIX)) return `head "${pr.headRefName}" is not a ${BATCH_BRANCH_PREFIX}* batch branch`;
  const login = pr.mergedBy && pr.mergedBy.login;
  if (login !== APPROVER_LOGIN) return `merged by "${login || 'nobody'}", not ${APPROVER_LOGIN}`;
  const oid = pr.mergeCommit && pr.mergeCommit.oid;
  if (typeof oid !== 'string' || !/^[0-9a-f]{40}$/.test(oid)) return 'no merge commit';
  return null;
}

// Entries the owner approved: proposed now, added or changed by a batch PR that
// the owner merged into main, and unchanged (same fingerprint) since that merge.
function approvedEntries(root, queueNow, prs, opts = {}) {
  const approved = new Map();
  const ignored = [];
  const errors = validateQueue(queueNow, { blogSlugs: listBlogSlugs(root) });
  const current = new Map(queueNow.filter((r) => r && r.status === 'proposed').map((r) => [r.slug, r]));
  for (const pr of Array.isArray(prs) ? prs : []) {
    const why = prRejection(pr);
    if (why) { ignored.push({ pr: pr && pr.number, reason: why }); continue; }
    const sha = pr.mergeCommit.oid;
    if ((!hasCommit(root, sha) || !hasCommit(root, `${sha}^1`)) && opts.fetch !== false) {
      try { git(root, ['fetch', '--quiet', '--depth=2', 'origin', sha]); } catch (e) { /* reported below */ }
    }
    if (!hasCommit(root, sha) || !hasCommit(root, `${sha}^1`)) {
      ignored.push({ pr: pr.number, reason: `merge commit ${sha.slice(0, 7)} or its parent is not in local history` });
      continue;
    }
    const before = new Map(queueAt(root, `${sha}^1`).map((r) => [r.slug, fingerprint(r)]));
    for (const rec of queueAt(root, sha)) {
      if (!rec || rec.status !== 'proposed') continue;
      const fp = fingerprint(rec);
      if (before.get(rec.slug) === fp) continue; // already there before this PR: not approved by it
      const now = current.get(rec.slug);
      if (!now || fingerprint(now) !== fp) continue; // gone, written, or edited since the merge
      if (errors.some((e) => e.startsWith(`${rec.slug}:`))) continue;
      approved.set(rec.slug, { slug: rec.slug, type: entryType(rec), fingerprint: fp, pr: pr.number, merge_commit: sha });
    }
  }
  return { approved: [...approved.values()], ignored };
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
  const proposals = Array.isArray(queue) ? queue.filter((r) => r.status === 'proposed') : [];
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
      approval: 'NOT checked here. Approval is the owner merging the batch PR; check it with --approved --prs <file>.',
    }, null, 2));
    return ok ? 0 : 1;
  }

  if (errors.length) {
    console.error('content-queue.json is invalid:\n  - ' + errors.join('\n  - '));
    return 1;
  }

  if (args.includes('--approved')) {
    const file = opt('--prs');
    if (!file) { console.error('--approved needs --prs <file> (gh pr list --state merged --json ...)'); return 2; }
    let prs;
    try { prs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`cannot read --prs file: ${e.message}`); return 2; }
    const res = approvedEntries(root, queue, prs, { fetch: !args.includes('--no-fetch') });
    console.log(JSON.stringify({
      approver: APPROVER_LOGIN,
      approved: res.approved,
      ignored_prs: res.ignored,
      note: 'Only entries added or changed by a content/queue-refresh-* PR that the approver merged into main, and unchanged since, are approved. Write each as its own PR; never merge it yourself.',
    }, null, 2));
    return 0;
  }

  if (args.includes('--proposals')) {
    console.log(JSON.stringify({
      today,
      policy: { ...POLICY_DEFAULTS, note: 'safety default reusing the existing 10-day digest rule; not an SEO or demand threshold' },
      proposals: proposals.map((r) => ({
        slug: r.slug,
        type: entryType(r),
        proposed_at: r.proposed_at,
        demand_label: r.evidence && r.evidence.demand_label,
        fingerprint: fingerprint(r),
      })),
      note: 'Proposed entries on main are approved only if --approved lists them. A proposal is never written on the strength of this list.',
    }, null, 2));
    return 0;
  }
  const counts = queue.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`content-queue.json valid: ${queue.length} entries ${JSON.stringify(counts)}`);
  return 0;
}

module.exports = {
  validateQueue, proposalShapeProblems, proposalContextProblems, contentHash, fingerprint,
  listBlogSlugs, parseDate, approvedEntries, prRejection,
  POLICY_DEFAULTS, APPROVER_LOGIN, BATCH_BRANCH_PREFIX,
};

if (require.main === module) process.exit(main(process.argv));
