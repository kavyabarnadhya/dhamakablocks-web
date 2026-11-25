'use strict';

// Proves the proposal gate. Every proposed entry needs first-party evidence
// (public search, competitor and AI-question research are supplementary only)
// and an honest demand label: "observed" needs a matching click,
// "impressions-only" a matching impression, "unproven" supplementary research;
// the weaker two need a review date. Page edits need the target's own page data.
// Legacy "queued", "approved" and any approval block are invalid; retired topics
// are protected from silent re-proposal. Approval is only the owner merging a
// batch PR, proved against git history and GitHub's merged-by record. Fixtures
// only: no network, no article output.

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
        rows: [{ query: 'new topic query', clicks: 3, impressions: 40 }],
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

test('"thin" and "none-observed" are no longer valid demand labels: a real click is required', () => {
  assert.ok(has(validate(proposal((x) => { x.evidence.demand_label = 'thin'; })), /demand_label must be one of/));
  assert.ok(has(validate(proposal((x) => { x.evidence.demand_label = 'none-observed'; })), /demand_label must be one of/));
});

test('impressions alone no longer qualify a topic: a matching row needs at least one real click', () => {
  const oneImpressionNoClick = proposal((x) => {
    x.evidence.first_party[0].quote = 'new topic query 0 clicks / 1 impression / pos 9.0 (query table).';
    x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 1 }];
    x.evidence.summary = 'Only a single impression was observed; no clicks.';
  });
  assert.ok(has(validate(oneImpressionNoClick), /needs at least one first-party query row with a real click/));
  const manyImpressionsNoClicks = proposal((x) => {
    x.evidence.first_party[0].quote = 'new topic query 0 clicks / 400 impressions (query table).';
    x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 400 }];
  });
  assert.ok(has(validate(manyImpressionsNoClicks), /needs at least one first-party query row with a real click/), 'a high impression count still does not substitute for a click');
});

test('observed needs a matching first-party row with a real click: the label alone is not enough', () => {
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].rows = []; })), /needs at least one first-party query row/));
  assert.ok(has(validate(proposal((x) => { delete x.evidence.first_party[0].rows; })), /needs at least one first-party query row/));
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 0 }]; })), /needs at least one first-party query row/));
  const unrelated = proposal((x) => {
    x.evidence.first_party[0].quote = 'totally different words 3 clicks / 40 impressions (query table).';
    x.evidence.first_party[0].rows = [{ query: 'totally different words', clicks: 3, impressions: 40 }];
  });
  assert.ok(has(validate(unrelated), /matches the entry's intent/));
});

test('row data must be consistent with the quoted text', () => {
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 9, impressions: 4 }]; })), /more clicks than impressions/));
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 3.5, impressions: 40 }]; })), /clicks must be a non-negative integer/));
  assert.ok(has(validate(proposal((x) => { x.evidence.first_party[0].rows = [{ query: 'a query not in the quote', clicks: 1, impressions: 5 }]; })), /must appear in the quoted rows/));
});

test('the old "exploratory" field is refused: weak evidence is labelled instead', () => {
  assert.ok(has(validate(proposal((x) => { x.exploratory = true; })), /"exploratory" field is not used/));
  const noDataWithExploratory = proposal((x) => {
    x.evidence.first_party[0].rows = [];
    x.evidence.first_party[0].quote = 'Query filter returned 0 rows: 0 clicks, 0 impressions in the window.';
    x.exploratory = true;
  });
  const errs = validate(noDataWithExploratory);
  assert.ok(has(errs, /"exploratory" field is not used/));
  assert.ok(has(errs, /needs at least one first-party query row/), 'an "observed" label with no click is still refused');
});

// ---------- weaker, honestly labelled evidence (added 2026-11-25) ----------

const impressionsOnly = (mutate) => proposal((x) => {
  x.evidence.first_party[0].quote = 'new topic query 0 clicks / 40 impressions / pos 6.1 (query table).';
  x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 40 }];
  x.evidence.demand_label = 'impressions-only';
  x.evidence.review_after_weeks = 8;
  x.evidence.summary = 'The query shows impressions but no clicks yet; reviewed 8 weeks after publishing.';
  if (mutate) mutate(x);
});
const unproven = (mutate) => proposal((x) => {
  x.evidence.first_party[0].quote = 'Query filter for "new topic" returned 0 rows (0 clicks, 0 impressions) in the window.';
  x.evidence.first_party[0].rows = [];
  x.evidence.supplementary = [{ kind: 'competitor-research', url: 'https://example.com/c', fetched_at: '2026-11-18', quote: 'Three competitor pages rank for this question; the site has none.' }];
  x.evidence.demand_label = 'unproven';
  x.evidence.review_after_weeks = 6;
  x.evidence.summary = 'No first-party data; a competitor gap suggests the question exists. Reviewed after 6 weeks.';
  if (mutate) mutate(x);
});

test('impressions-only: a matching row with impressions and no click is accepted, with a review date', () => {
  assert.deepEqual(validate(impressionsOnly()), []);
  assert.ok(has(validate(impressionsOnly((x) => { delete x.evidence.review_after_weeks; })), /review_after_weeks/));
  assert.ok(has(validate(impressionsOnly((x) => { x.evidence.review_after_weeks = 52; })), /review_after_weeks/));
  const zero = impressionsOnly((x) => { x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 0 }]; });
  assert.ok(has(validate(zero), /"impressions-only" needs at least one first-party query row with impressions/));
  const unrelated = impressionsOnly((x) => {
    x.evidence.first_party[0].quote = 'totally different words 0 clicks / 40 impressions.';
    x.evidence.first_party[0].rows = [{ query: 'totally different words', clicks: 0, impressions: 40 }];
  });
  assert.ok(has(validate(unrelated), /matches the entry's intent/));
});

test('unproven: no first-party match, but supplementary research and a review date are required', () => {
  assert.deepEqual(validate(unproven()), []);
  for (const kind of ['web-search', 'ai-question']) {
    assert.deepEqual(validate(unproven((x) => { x.evidence.supplementary[0].kind = kind; })), [], kind);
  }
  assert.ok(has(validate(unproven((x) => { delete x.evidence.supplementary; })), /"unproven" needs at least one supplementary item/));
  assert.ok(has(validate(unproven((x) => { delete x.evidence.review_after_weeks; })), /review_after_weeks/));
  assert.ok(has(validate(unproven((x) => { x.evidence.first_party = []; })), /first_party is empty/), 'the zero first-party result must still be quoted');
});

test('weaker labels are never described as validation', () => {
  assert.ok(has(validate(unproven((x) => { x.evidence.summary = 'Competitor rankings prove the demand.'; })), /must not be overstated/));
});

// ---------- page edits (added 2026-11-25) ----------

function edit(mutate) {
  const rec = {
    slug: 'edit-alpha-post-2026-11-19',
    type: 'edit',
    target: 'alpha-post',
    title: 'Sharpen the search snippet of Alpha Post',
    intent: 'alpha query',
    angle: 'Page 1 position, low click-through: rewrite title and meta description.',
    internal_links: [],
    status: 'proposed',
    proposed_at: '2026-11-19',
    publish_after: '2026-11-22',
    changes: [
      { element: 'title', proposed: 'Alpha Query: The Short, Direct Answer (2026)', reason: 'Title does not match the top query wording.' },
      { element: 'meta-description', proposed: 'Opens by answering the searcher directly.', reason: 'Low click-through at position 5.' },
    ],
    evidence: {
      first_party: [{
        kind: 'gsc-digest',
        source: '.jules/gsc-digest.md at commit abc1234',
        fetched_at: '2026-11-17',
        window: '3 months to 2026-11-07',
        quote: '/blog/alpha-post 2/600/0.3%/5.4 (page table); alpha query 1/200 (query table).',
        rows: [{ page: '/blog/alpha-post', clicks: 2, impressions: 600 }, { query: 'alpha query', clicks: 1, impressions: 200 }],
      }],
      demand_label: 'observed',
      limits: 'One stored digest; page and query rows are not joined; small numbers.',
      summary: 'The page ranks on page 1 with low click-through; a snippet rewrite may lift it.',
    },
  };
  if (mutate) mutate(rec);
  return rec;
}

test('a page edit with a target, concrete changes and the target page\'s own data is valid (no overlap check needed)', () => {
  assert.deepEqual(validate(edit()), []);
});

test('a page edit needs an edit- slug, an existing target and concrete changes', () => {
  assert.ok(has(validate(edit((x) => { x.slug = 'alpha-rewrite'; })), /must start with "edit-"/));
  assert.ok(has(validate(edit((x) => { x.target = 'ghost-post'; x.evidence.first_party[0].rows[0].page = '/blog/ghost-post'; x.evidence.first_party[0].quote += ' /blog/ghost-post'; })), /edit target "ghost-post" has no blog page/));
  assert.ok(has(validate(edit((x) => { x.changes = []; })), /non-empty "changes"/));
  assert.ok(has(validate(edit((x) => { x.changes[0].element = 'everything'; })), /element must be one of/));
  assert.ok(has(validate(edit((x) => { x.type = 'rewrite'; })), /type must be one of new\/edit/));
});

test('a page edit needs a first-party page row for its own target with impressions', () => {
  const noPage = edit((x) => { x.evidence.first_party[0].rows = [{ query: 'alpha query', clicks: 1, impressions: 200 }]; });
  assert.ok(has(validate(noPage), /page edit needs at least one first-party page row for \/blog\/alpha-post/));
  const otherPage = edit((x) => {
    x.evidence.first_party[0].quote = '/blog/beta-post 2/600 (page table); alpha query 1/200.';
    x.evidence.first_party[0].rows[0].page = '/blog/beta-post';
  });
  assert.ok(has(validate(otherPage), /page row for \/blog\/alpha-post/));
  const fullUrl = edit((x) => {
    x.evidence.first_party[0].quote = 'https://dhamakablocks.com/blog/alpha-post 2/600; alpha query 1/200.';
    x.evidence.first_party[0].rows[0].page = 'https://dhamakablocks.com/blog/alpha-post';
  });
  assert.deepEqual(validate(fullUrl), []);
});

test('only one proposed edit per target at a time', () => {
  const second = edit((x) => { x.slug = 'edit-alpha-post-2026-11-20'; });
  assert.ok(has(validate(edit(), [second]), /another proposed edit .* already targets "alpha-post"/));
});

test('--check-writable applies the same evidence rule', () => {
  const noData = proposal((x) => { x.evidence.first_party[0].rows = []; });
  const res = cli(fixtureRoot([...base(), noData]), ['--check-writable', 'new-topic', '--today', TODAY]);
  assert.equal(res.status, 1);
  assert.ok(JSON.parse(res.stdout).reasons.some((r) => /needs at least one first-party query row/.test(r)));
  const impressionsOnly = proposal((x) => { x.evidence.first_party[0].rows = [{ query: 'new topic query', clicks: 0, impressions: 50 }]; });
  const res2 = cli(fixtureRoot([...base(), impressionsOnly]), ['--check-writable', 'new-topic', '--today', TODAY]);
  assert.equal(res2.status, 1);
  assert.ok(JSON.parse(res2.stdout).reasons.some((r) => /real click/.test(r)));
});

test('a small, real click count described as validation is refused', () => {
  for (const words of ['This validates the topic.', 'The data proves demand exists.', 'It confirms demand for the article.']) {
    const errs = validate(proposal((x) => { x.evidence.summary = `${words} A few real clicks were seen.`; }));
    assert.ok(has(errs, /must not be overstated as proof or validation/), words);
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

test('the module exposes the proposal checks, the merge-based approval check and a single policy default', () => {
  assert.deepEqual(Object.keys(gate).sort(), [
    'APPROVER_LOGIN', 'BATCH_BRANCH_PREFIX', 'POLICY_DEFAULTS', 'approvedEntries', 'contentHash', 'fingerprint',
    'listBlogSlugs', 'parseDate', 'prRejection', 'proposalContextProblems', 'proposalShapeProblems', 'validateQueue',
  ]);
  assert.deepEqual(Object.keys(gate.POLICY_DEFAULTS), ['maxEvidenceAgeDaysAtProposal']);
  assert.equal(gate.APPROVER_LOGIN, 'kavyabarnadhya');
});

test('adding page-edit fields did not change the fingerprint of a new-post entry; edit changes are fingerprinted', () => {
  // Value produced by the pre-2026-11-25 script for the same record.
  const rec = { slug: 'new-topic', title: 'A New Topic', intent: 'x', angle: 'y', internal_links: ['a'], publish_after: '2026-11-22', evidence: { a: 1 }, overlap_check: { b: 2 } };
  assert.equal(gate.fingerprint(rec), '84128be29db7');
  assert.notEqual(gate.fingerprint(edit()), gate.fingerprint(edit((x) => { x.changes[0].proposed = 'A different proposed title text.'; })));
});

// ---------- approval = the owner merging a batch PR ----------

const { execFileSync } = require('child_process');
function gitRepo(initialQueue) {
  const root = fixtureRoot(initialQueue);
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  g('add', '-A'); g('commit', '-q', '-m', 'base');
  return { root, g };
}
const writeQueue = (root, q) => fs.writeFileSync(path.join(root, 'content-queue.json'), JSON.stringify(q, null, 2));
const readQueue = (root) => JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
function mergeBatch({ root, g }, queue, branch = 'content/queue-refresh-2026-11-19') {
  g('checkout', '-q', '-b', branch);
  writeQueue(root, queue);
  g('commit', '-q', '-am', 'batch');
  g('checkout', '-q', 'main');
  g('merge', '-q', '--no-ff', '-m', 'merge batch', branch);
  return g('rev-parse', 'HEAD');
}
const pr = (sha, over = {}) => ({
  number: 7, baseRefName: 'main', headRefName: 'content/queue-refresh-2026-11-19',
  mergedBy: { login: 'kavyabarnadhya' }, mergeCommit: { oid: sha }, ...over,
});
const approvedSlugs = (root, prs) => gate.approvedEntries(root, readQueue(root), prs, { fetch: false }).approved.map((a) => a.slug).sort();

test('approval: entries added by a batch PR the owner merged into main are approved; each carries its fingerprint', () => {
  const repo = gitRepo(base());
  const sha = mergeBatch(repo, [...base(), proposal(), edit()]);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha)]), ['edit-alpha-post-2026-11-19', 'new-topic']);
  const one = gate.approvedEntries(repo.root, readQueue(repo.root), [pr(sha)], { fetch: false }).approved.find((a) => a.slug === 'new-topic');
  assert.equal(one.fingerprint, gate.fingerprint(proposal()));
  assert.equal(one.pr, 7);
});

test('approval: a merge by anyone else, into another branch, or from a non-batch branch approves nothing', () => {
  const repo = gitRepo(base());
  const sha = mergeBatch(repo, [...base(), proposal()]);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha, { mergedBy: { login: 'someone-else' } })]), []);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha, { mergedBy: null })]), []);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha, { baseRefName: 'dev' })]), []);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha, { headRefName: 'feature/sneaky' })]), []);
  assert.deepEqual(approvedSlugs(repo.root, []), []);
  const res = gate.approvedEntries(repo.root, readQueue(repo.root), [pr(sha, { mergedBy: { login: 'x' } })], { fetch: false });
  assert.match(res.ignored[0].reason, /not kavyabarnadhya/);
});

test('approval: an entry edited after the merge is no longer approved (fingerprint mismatch)', () => {
  const repo = gitRepo(base());
  const sha = mergeBatch(repo, [...base(), proposal()]);
  writeQueue(repo.root, [...base(), proposal((x) => { x.angle = 'Quietly changed after approval.'; })]);
  repo.g('commit', '-q', '-am', 'edit after merge');
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha)]), []);
});

test('approval: an entry already on main before the batch PR is not approved by merging that PR', () => {
  const repo = gitRepo([...base(), proposal()]); // pushed to main some other way
  const sha = mergeBatch(repo, [...base(), proposal(), edit()]);
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha)]), ['edit-alpha-post-2026-11-19']);
});

test('approval: an entry already written (status published) is not listed again', () => {
  const repo = gitRepo(base());
  const sha = mergeBatch(repo, [...base(), proposal()]);
  writeQueue(repo.root, [...base(), { ...proposal(), status: 'published' }]);
  repo.g('commit', '-q', '-am', 'written');
  assert.deepEqual(approvedSlugs(repo.root, [pr(sha)]), []);
});

test('approval: a merge commit missing from local history is reported, not trusted', () => {
  const repo = gitRepo(base());
  const res = gate.approvedEntries(repo.root, readQueue(repo.root), [pr('0'.repeat(40))], { fetch: false });
  assert.deepEqual(res.approved, []);
  assert.match(res.ignored[0].reason, /not in local history/);
});

test('CLI --approved reads the gh pr list output and lists approved entries', () => {
  const repo = gitRepo(base());
  const sha = mergeBatch(repo, [...base(), proposal()]);
  const prsFile = path.join(repo.root, 'prs.json');
  fs.writeFileSync(prsFile, JSON.stringify([pr(sha), pr(sha, { number: 8, mergedBy: { login: 'bot' } })]));
  const res = cli(repo.root, ['--approved', '--prs', prsFile, '--no-fetch', '--today', TODAY]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.approved.map((a) => a.slug), ['new-topic']);
  assert.equal(out.ignored_prs[0].pr, 8);
  assert.equal(cli(repo.root, ['--approved']).status, 2, '--prs is required');
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

test('CLI --proposals lists proposals and states that the list alone never permits writing', () => {
  const root = fixtureRoot([...base(), proposal(), edit()]);
  const res = cli(root, ['--proposals', '--today', TODAY]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.proposals.map((p) => [p.slug, p.type]), [['new-topic', 'new'], ['edit-alpha-post-2026-11-19', 'edit']]);
  assert.match(out.note, /never written on the strength of this list/);
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
