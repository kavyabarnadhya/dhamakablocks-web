'use strict';

// Proves the proposal gate. The scheduled routine only proposes: every proposed
// entry needs first-party evidence (public search is supplementary only), an
// honest demand label with limits, and a clean intent-overlap check; legacy
// "queued", "approved" and any approval block are invalid; retired topics are
// protected from silent re-proposal. Fixtures only: no network, no approval, no
// article output.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const gate = require('./check-queue-gate.js');

const BLOG = ['alpha-post', 'beta-post', 'gamma-post'];
const CLI = path.join(__dirname, 'check-queue-gate.js');
const TODAY = '2026-11-20';

const published = (slug, intent) => ({
  slug, title: slug, intent, angle: 'x', internal_links: [], status: 'published', publish_after: '2026-10-01',
});

function proposal(mutate) {
  const rec = {
    slug: 'new-topic',
    title: 'A New Topic',
    intent: 'new topic query, another new topic phrase',
    angle: 'A distinct angle that no existing page covers.',
    internal_links: ['alpha-post', 'beta-post'],
    status: 'proposed',
    proposed_at: '2026-11-19',
    publish_after: '2026-11-22',
    evidence: {
      first_party: [{
        kind: 'gsc-digest',
        source: '.jules/gsc-digest.md at commit abc1234',
        fetched_at: '2026-11-17',
        window: '3 months to 2026-11-07',
        quote: 'new topic query 3 clicks / 40 impressions / pos 6.1 (query table).',
      }],
      supplementary: [{
        kind: 'web-search', url: 'https://example.com/result', fetched_at: '2026-11-18',
        quote: 'A public page discusses the same subject at length.',
      }],
      demand_label: 'observed',
      limits: 'One stored digest; query rows are not attributed to pages; small numbers.',
      summary: 'The query appears in the stored digest with a few clicks; this does not predict traffic.',
    },
    overlap_check: {
      result: 'distinct',
      checked_at: '2026-11-19',
      checked_against: [...BLOG],
      notes: 'Compared against every existing page; none covers this intent.',
    },
  };
  if (mutate) mutate(rec);
  return rec;
}

const base = () => [published('alpha-post', 'alpha query'), published('beta-post', 'beta query')];
const validate = (entry, extra = [], ctx = {}) => gate.validateQueue([...base(), ...extra, entry], { blogSlugs: BLOG, ...ctx });
const has = (errs, re) => errs.some((e) => re.test(e));

test('positive control: a complete proposal with first-party evidence and a clean overlap check is valid', () => {
  assert.deepEqual(validate(proposal()), []);
});

// ---------- status protections ----------

test('legacy "queued" is invalid (the scheduled routine only proposes)', () => {
  const rec = proposal((x) => { x.status = 'queued'; });
  assert.ok(has(validate(rec), /"queued" is no longer valid/));
});

test('"approved" is not a queue status and an approval block must not appear in the queue', () => {
  assert.ok(has(validate(proposal((x) => { x.status = 'approved'; })), /"approved" is not used/));
  assert.ok(has(validate(proposal((x) => { x.approval = { approved_by: 'anyone' }; })), /approval block must not appear/));
});

test('--check-writable reports completeness and a fingerprint only; it never claims the owner approved', () => {
  const root = fixtureRoot([...base(), proposal()]);
  const out = JSON.parse(cli(root, ['--check-writable', 'new-topic', '--today', TODAY]).stdout);
  assert.equal(out.writable_checks_passed, true);
  assert.match(out.approval, /NOT checked here/);
  assert.match(out.fingerprint, /^[0-9a-f]{12}$/);
});

test('a long-overdue publish_after changes nothing: the date is only the earliest review date', () => {
  const overdue = proposal((x) => { x.proposed_at = '2025-12-20'; x.publish_after = '2026-01-01'; x.evidence.first_party[0].fetched_at = '2025-12-18'; });
  assert.deepEqual(validate(overdue), []); // still just a valid proposal
  const root = fixtureRoot([...base(), overdue]);
  assert.match(JSON.parse(cli(root, ['--check-writable', 'new-topic']).stdout).approval, /NOT checked here/);
});

test('retired entries need a reason and cannot be written', () => {
  const retired = { ...proposal(), status: 'retired', retired_at: '2026-11-12' };
  assert.ok(has(validate(retired), /retired_reason/));
  const root = fixtureRoot([...base(), { ...retired, retired_reason: 'Unsupported.' }]);
  const res = cli(root, ['--check-writable', 'new-topic', '--today', TODAY]);
  assert.equal(res.status, 1);
  assert.match(JSON.parse(res.stdout).reasons[0], /only a "proposed" entry can be written/);
});

test('published entries cannot be written again', () => {
  const root = fixtureRoot([...base(), proposal()]);
  assert.equal(cli(root, ['--check-writable', 'alpha-post']).status, 1);
});

// ---------- first-party evidence required; public research supplementary ----------

test('missing evidence is invalid', () => {
  assert.ok(has(validate(proposal((x) => { delete x.evidence; })), /evidence is missing/));
});

test('public web search ALONE does not pass: first-party evidence is required', () => {
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party = []; })), /first_party is empty/));
});

test('public search or competitor research cannot be entered as first-party evidence', () => {
  for (const kind of ['web-search', 'competitor-research']) {
    assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].kind = kind; })), /first_party\[0\]\.kind must be one of gsc-live\/gsc-digest\/ga4/), kind);
  }
});

test('first-party items must name source, window and quoted rows', () => {
  const errs = validate(proposal((x) => { x.evidence.first_party[0] = { kind: 'gsc-live', fetched_at: '2026-11-17' }; }));
  assert.ok(has(errs, /source/) && has(errs, /window/) && has(errs, /quote/));
});

test('supplementary research is allowed but never counted; a first-party kind cannot hide there', () => {
  assert.deepEqual(validate(proposal((x) => { x.evidence.supplementary.push({ kind: 'competitor-research', url: 'https://example.com/c', fetched_at: '2026-11-18', quote: 'A competitor page covers a similar subject.' }); })), []);
  assert.ok(has(validate(proposal((x) => { x.evidence.supplementary[0].kind = 'gsc-live'; })), /supplementary\[0\]\.kind/));
});

test('missing demand label or limits is invalid', () => {
  assert.ok(has(validate(proposal((x) => { delete x.evidence.limits; })), /limits is missing/));
  assert.ok(has(validate(proposal((x) => { delete x.evidence.demand_label; })), /demand_label must be one of/));
  assert.ok(has(validate(proposal((x) => { x.evidence.demand_label = 'validated'; })), /demand_label must be one of/));
});

test('thin and absent first-party data are accepted only as labelled; there is no minimum-impression cutoff', () => {
  assert.deepEqual(validate(proposal((x) => { x.evidence.demand_label = 'thin'; x.evidence.summary = 'Only a handful of impressions were observed; no clicks.'; })), []);
  assert.deepEqual(validate(proposal((x) => {
    x.evidence.demand_label = 'none-observed';
    x.evidence.first_party[0].quote = 'Query filter returned 0 rows: 0 clicks, 0 impressions in the window.';
    x.evidence.summary = 'No matching queries were observed; this is an editorial suggestion, not demand.';
  })), []);
  assert.ok(!/min|threshold|cutoff/i.test(Object.keys(gate.POLICY_DEFAULTS).join(' ')), 'policy must contain no demand threshold');
});

test('thin or absent data described as validation is refused', () => {
  for (const label of ['thin', 'none-observed']) {
    for (const words of ['This validates the topic.', 'The data proves demand exists.', 'It confirms demand for the article.']) {
      const errs = validate(proposal((x) => { x.evidence.demand_label = label; x.evidence.summary = `${words} A few rows were seen.`; }));
      assert.ok(has(errs, /must not be described as validation/), `${label}: ${words}`);
    }
  }
});

// ---------- freshness (one configurable default, reusing the owner's 10-day digest rule) ----------

test('first-party evidence must be at most 10 days older than the proposal; the limit is a parameter, not a verdict on demand', () => {
  assert.deepEqual({ ...gate.POLICY_DEFAULTS }, { maxEvidenceAgeDaysAtProposal: 10 });
  assert.deepEqual(validate(proposal((x) => { x.evidence.first_party[0].fetched_at = '2026-11-09'; })), []); // exactly 10 days
  const stale = proposal((x) => { x.evidence.first_party[0].fetched_at = '2026-11-08'; });
  assert.ok(has(validate(stale), /days older than proposed_at/));
  assert.deepEqual(validate(stale, [], { policy: { maxEvidenceAgeDaysAtProposal: 30 } }), []);
});

test('evidence fetched after the proposal date is refused', () => {
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].fetched_at = '2026-11-25'; })), /fetched after proposed_at/));
});

test('proposed_at is required and publish_after must be at least 3 days later (never backdated)', () => {
  assert.ok(has(validate(proposal((x) => { delete x.proposed_at; })), /proposed_at must be a real/));
  assert.ok(has(validate(proposal((x) => { x.publish_after = '2026-11-20'; })), /at least 3 days after proposed_at/));
});

// ---------- overlap and retired-topic protection ----------

test('overlap check missing, failed, or incomplete is invalid', () => {
  assert.ok(has(validate(proposal((x) => { delete x.overlap_check; })), /overlap_check is missing/));
  assert.ok(has(validate(proposal((x) => { x.overlap_check.result = 'overlap'; })), /must be "distinct"/));
  assert.ok(has(validate(proposal((x) => { x.overlap_check.checked_against = ['alpha-post']; })), /does not cover existing pages: beta-post, gamma-post/));
});

test('mechanical overlap: an exact intent term shared with a published or proposed entry is refused even if marked distinct', () => {
  assert.ok(has(validate(proposal(), [published('gamma-post', 'new topic query, something else')]), /intent collides with published "gamma-post"/));
  const other = proposal((x) => { x.slug = 'other-proposal'; });
  assert.ok(has(validate(proposal(), [other]), /intent collides with proposed "other-proposal"/));
});

test('a retired topic cannot be silently re-proposed: same intent needs an explicit addresses_retirement note', () => {
  const retired = { ...published('old-topic', 'new topic query'), status: 'retired', retired_at: '2026-11-12', retired_reason: 'Unsupported by first-party data.' };
  assert.ok(has(validate(proposal(), [retired]), /collides with retired "old-topic".*addresses_retirement/));
  const ok = proposal((x) => { x.addresses_retirement = { slug: 'old-topic', note: 'New first-party rows show a distinct query the retirement did not cover.' }; });
  assert.deepEqual(validate(ok, [retired]), []);
  const wrong = proposal((x) => { x.addresses_retirement = { slug: 'someone-else', note: 'New first-party rows show a distinct query.' }; });
  assert.ok(has(validate(wrong, [retired]), /addresses_retirement/));
});

test('slug that already has a page, and internal links that do not, are refused', () => {
  assert.ok(has(validate(proposal((x) => { x.slug = 'alpha-post'; })), /already exists/));
  assert.ok(has(validate(proposal((x) => { x.internal_links = ['alpha-post', 'ghost-post']; })), /ghost-post/));
  assert.ok(has(validate(proposal((x) => { x.internal_links = ['alpha-post']; })), /2-3 existing posts/));
});

// ---------- fingerprint ----------

test('the fingerprint changes when the proposal (including evidence) is edited, so an approval of an older revision no longer matches', () => {
  const a = proposal();
  const b = proposal((x) => { x.evidence.first_party[0].quote = 'new topic query 300 clicks / 4000 impressions (edited).'; });
  const c = proposal((x) => { x.angle = 'Changed angle.'; });
  assert.notEqual(gate.fingerprint(a), gate.fingerprint(b));
  assert.notEqual(gate.fingerprint(a), gate.fingerprint(c));
  assert.equal(gate.fingerprint(a), gate.fingerprint(proposal()));
});

test('the module exposes only the proposal checks: no approval handling and a single policy default', () => {
  assert.deepEqual(Object.keys(gate).sort(), [
    'POLICY_DEFAULTS', 'contentHash', 'fingerprint', 'listBlogSlugs', 'parseDate',
    'proposalContextProblems', 'proposalShapeProblems', 'validateQueue',
  ]);
  assert.deepEqual(Object.keys(gate.POLICY_DEFAULTS), ['maxEvidenceAgeDaysAtProposal']);
});

// ---------- CLI + real queue ----------

function fixtureRoot(queue) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-gate-'));
  fs.mkdirSync(path.join(root, 'blog'));
  for (const s of BLOG) fs.writeFileSync(path.join(root, 'blog', `${s}.html`), '<html></html>');
  fs.writeFileSync(path.join(root, 'blog', 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'content-queue.json'), JSON.stringify(queue));
  return root;
}
const cli = (root, args) => spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8' });

test('CLI --proposals lists waiting proposals (the routine\'s "do nothing" signal) and states that it only proposes', () => {
  const root = fixtureRoot([...base(), proposal()]);
  const res = cli(root, ['--proposals', '--today', TODAY]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.proposals.map((p) => p.slug), ['new-topic']);
  assert.match(out.note, /only proposes/);
  assert.match(out.policy.note, /not an SEO or demand threshold/);
});

test('CLI --proposals is empty when nothing is waiting', () => {
  const root = fixtureRoot(base());
  assert.deepEqual(JSON.parse(cli(root, ['--proposals']).stdout).proposals, []);
});

test('CLI exits non-zero on an invalid queue so the routine must stop', () => {
  const root = fixtureRoot([...base(), proposal((x) => { x.status = 'queued'; })]);
  assert.equal(cli(root, []).status, 1);
  assert.equal(cli(root, ['--proposals']).status, 1);
  const noEvidence = fixtureRoot([...base(), proposal((x) => { x.evidence.first_party = []; })]);
  assert.equal(cli(noEvidence, []).status, 1);
});

test('CLI --check-writable refuses an incomplete proposal and prints no fingerprint', () => {
  const root = fixtureRoot([...base(), proposal((x) => { x.evidence.first_party = []; })]);
  const res = cli(root, ['--check-writable', 'new-topic']);
  assert.equal(res.status, 1);
  const out = JSON.parse(res.stdout);
  assert.equal(out.fingerprint, null);
  assert.ok(out.reasons.some((r) => /first_party is empty/.test(r)));
});

test('CLI offers no switch to loosen the evidence-age default', () => {
  const root = fixtureRoot([...base(), proposal((x) => { x.evidence.first_party[0].fetched_at = '2026-10-01'; })]);
  assert.equal(cli(root, ['--max-evidence-age-days', '9999']).status, 1);
});

test('the real content-queue.json is valid; nothing is queued, approved or proposed; the Indian-theming topic stays retired', () => {
  const root = path.join(__dirname, '..');
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
  assert.deepEqual(gate.validateQueue(queue, { blogSlugs: gate.listBlogSlugs(root) }), []);
  assert.equal(queue.filter((r) => ['queued', 'approved'].includes(r.status)).length, 0);
  assert.equal(queue.filter((r) => 'approval' in r).length, 0);
  const retired = queue.find((r) => r.slug === 'indian-themed-block-puzzle-games');
  assert.equal(retired.status, 'retired');
  assert.equal(retired.retired_evidence.ga4_used, false);
  const out = JSON.parse(cli(root, ['--proposals']).stdout);
  assert.deepEqual(out.proposals, []);
});
