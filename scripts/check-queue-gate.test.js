'use strict';

// Proves the write-eligibility gate. Only an approved, first-party-evidenced,
// overlap-checked, owner-approved, due entry can be written; everything else
// (due-but-unapproved, legacy "queued", retired, public-search-only evidence,
// missing limits, overlap failures, tampered or stale approvals, unprovable
// approval origin) cannot. All ids below are obvious fixtures. No real approval
// exists or is created, there is no network, and no article is produced.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const gate = require('./check-queue-gate.js');

const TODAY = '2026-12-01';
const BLOG = ['alpha-post', 'beta-post', 'gamma-post'];
const CLI = path.join(__dirname, 'check-queue-gate.js');
const SESSION = 'session_TESTFIXTURE0001';
const EVENT = '11111111-2222-4333-8444-555555555555';

const published = (slug, intent) => ({
  slug, title: slug, intent, angle: 'x', internal_links: [], status: 'published', publish_after: '2026-10-01',
});

// Recompute the approval line and hash after a deliberate change, so a test isolates ONE defect.
function seal(rec) {
  rec.approval = {
    approved_by: 'owner-label',
    approved_at: '2026-11-20',
    channel: 'claude-session-event',
    session_id: SESSION,
    event_uuid: EVENT,
    recorded_by: 'interactive-session',
    recorded_at: '2026-11-20',
    ...(rec.approval || {}),
  };
  rec.approval.message_line = gate.approvalLine(rec);
  rec.approval.content_hash = gate.contentHash(rec);
  return rec;
}

function approvedEntry(mutate) {
  const rec = {
    slug: 'new-topic',
    title: 'A New Topic',
    intent: 'new topic query, another new topic phrase',
    angle: 'A distinct angle that no existing page covers.',
    internal_links: ['alpha-post', 'beta-post'],
    status: 'approved',
    publish_after: '2026-11-20',
    evidence: {
      first_party: [{
        kind: 'gsc-digest',
        source: '.jules/gsc-digest.md at commit abc1234',
        fetched_at: '2026-11-18',
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
  return seal(rec);
}

const baseQueue = () => [published('alpha-post', 'alpha query'), published('beta-post', 'beta query')];
const run = (entry, extra = [], ctx = {}) => gate
  .evaluate([...baseQueue(), ...extra, entry], { today: TODAY, blogSlugs: BLOG, ...ctx })
  .find((r) => r.slug === entry.slug);
const has = (r, re) => r.reasons.some((x) => re.test(x));

test('positive control: approved + first-party evidence + distinct overlap + owner approval record + due is structurally eligible', () => {
  const r = run(approvedEntry());
  assert.equal(r.eligible, true, r.reasons.join('; '));
  assert.deepEqual(gate.validateQueue([...baseQueue(), approvedEntry()]), []);
});

// ---------- status gates ----------

test('due but only proposed: date alone never permits writing', () => {
  const rec = approvedEntry();
  rec.status = 'proposed';
  delete rec.approval;
  const r = run(rec);
  assert.equal(r.eligible, false);
  assert.match(r.reasons[0], /not write-eligible/);
});

test('a proposed entry cannot carry an approval block', () => {
  const rec = approvedEntry();
  rec.status = 'proposed';
  assert.ok(gate.validateQueue([...baseQueue(), rec]).some((e) => /must not carry an approval/.test(e)));
  assert.equal(run(rec).eligible, false);
});

test('legacy status "queued" is invalid and never eligible, however overdue', () => {
  const rec = approvedEntry();
  rec.status = 'queued';
  rec.publish_after = '2026-01-01';
  assert.equal(run(rec).eligible, false);
  assert.ok(gate.validateQueue([...baseQueue(), rec]).some((e) => /"queued" is no longer valid/.test(e)));
});

test('retired entries cannot be written and need a recorded reason', () => {
  const rec = approvedEntry();
  rec.status = 'retired';
  rec.retired_reason = 'Unsupported.';
  rec.retired_at = '2026-11-12';
  assert.equal(run(rec).eligible, false);
  delete rec.retired_reason;
  assert.ok(gate.validateQueue([...baseQueue(), rec]).some((e) => /retired_reason/.test(e)));
});

// ---------- evidence: first-party required, public research supplementary only ----------

test('missing evidence: not eligible', () => {
  const r = run(approvedEntry((x) => { delete x.evidence; }));
  assert.equal(r.eligible, false);
  assert.ok(has(r, /evidence is missing/));
});

test('public web search ALONE does not pass: no first-party evidence', () => {
  const r = run(approvedEntry((x) => { x.evidence.first_party = []; }));
  assert.equal(r.eligible, false);
  assert.ok(has(r, /first_party is empty/));
});

test('public web search cannot be smuggled in as first-party evidence', () => {
  for (const kind of ['web-search', 'competitor-research']) {
    const r = run(approvedEntry((x) => { x.evidence.first_party[0].kind = kind; }));
    assert.equal(r.eligible, false, kind);
    assert.ok(has(r, /first_party\[0\]\.kind must be one of gsc-live\/gsc-digest\/ga4/), kind);
  }
});

test('first-party evidence must name its source, window and quoted rows', () => {
  const r = run(approvedEntry((x) => { x.evidence.first_party[0] = { kind: 'gsc-live', fetched_at: '2026-11-18' }; }));
  assert.equal(r.eligible, false);
  assert.ok(has(r, /source/) && has(r, /window/) && has(r, /quote/));
});

test('supplementary public research is allowed but never counted', () => {
  const rec = approvedEntry((x) => { x.evidence.supplementary.push({ kind: 'competitor-research', url: 'https://example.com/c', fetched_at: '2026-11-18', quote: 'A competitor page covers a similar subject.' }); });
  assert.equal(run(rec).eligible, true);
  const bad = approvedEntry((x) => { x.evidence.supplementary[0].kind = 'gsc-live'; });
  assert.equal(run(bad).eligible, false);
});

test('missing honest limits or demand label: not eligible', () => {
  assert.ok(has(run(approvedEntry((x) => { delete x.evidence.limits; })), /limits is missing/));
  assert.ok(has(run(approvedEntry((x) => { delete x.evidence.demand_label; })), /demand_label must be one of/));
  assert.ok(has(run(approvedEntry((x) => { x.evidence.demand_label = 'validated'; })), /demand_label must be one of/));
});

test('thin first-party data is allowed only when labelled and acknowledged in the approval line', () => {
  const rec = approvedEntry((x) => { x.evidence.demand_label = 'thin'; x.evidence.summary = 'Only a handful of impressions were observed; no clicks.'; });
  assert.equal(run(rec).eligible, true);
  assert.match(rec.approval.message_line, /signal=thin$/);
});

test('absent first-party demand is allowed only as an explicit zero-result citation; there is no minimum-impression cutoff', () => {
  const rec = approvedEntry((x) => {
    x.evidence.demand_label = 'none-observed';
    x.evidence.first_party[0].quote = 'Query filter returned 0 rows: 0 clicks, 0 impressions in the window.';
    x.evidence.summary = 'No matching queries were observed; this is an editorial choice, not demand.';
  });
  assert.equal(run(rec).eligible, true);
  assert.ok(!/min|threshold|cutoff/i.test(Object.keys(gate.POLICY_DEFAULTS).join(' ')), 'policy must contain no demand threshold');
});

test('thin or absent data described as validation is refused', () => {
  for (const label of ['thin', 'none-observed']) {
    for (const words of ['This validates the topic.', 'The data proves demand exists.', 'It confirms demand for the article.']) {
      const rec = approvedEntry((x) => { x.evidence.demand_label = label; x.evidence.summary = words + ' A few rows were seen.'; });
      const r = run(rec);
      assert.equal(r.eligible, false, `${label}: ${words}`);
      assert.ok(has(r, /must not be described as validation/));
    }
  }
});

test('the owner must acknowledge the demand label: a line that says a different signal is refused', () => {
  const rec = approvedEntry((x) => { x.evidence.demand_label = 'thin'; });
  rec.approval.message_line = rec.approval.message_line.replace('signal=thin', 'signal=observed');
  const r = run(rec);
  assert.equal(r.eligible, false);
  assert.ok(has(r, /message_line does not equal the exact approval line/));
});

// ---------- freshness: configurable safety defaults, exact semantics ----------

test('freshness is measured at approval for evidence, and at the run date for the approval', () => {
  assert.deepEqual({ ...gate.POLICY_DEFAULTS }, { maxEvidenceAgeDaysAtApproval: 14, maxApprovalAgeDaysAtRun: 30 });
  // Evidence 14 days before approval, approval 30 days before the run: still eligible, evidence 44 days old at run.
  const edge = approvedEntry((x) => { x.evidence.first_party[0].fetched_at = '2026-11-06'; });
  const r = gate.evaluate([...baseQueue(), edge], { today: '2026-12-20', blogSlugs: BLOG }).pop();
  assert.equal(r.eligible, true, r.reasons.join('; '));
  // One day more on either side fails.
  const old = approvedEntry((x) => { x.evidence.first_party[0].fetched_at = '2026-11-05'; });
  assert.ok(has(gate.evaluate([...baseQueue(), old], { today: TODAY, blogSlugs: BLOG }).pop(), /more than 14 days before the approval/));
  assert.ok(has(gate.evaluate([...baseQueue(), approvedEntry()], { today: '2026-12-21', blogSlugs: BLOG }).pop(), /more than 30 days before the run date/));
});

test('the policy is a configurable parameter, not a hard-coded verdict', () => {
  const old = approvedEntry((x) => { x.evidence.first_party[0].fetched_at = '2026-10-01'; });
  assert.equal(run(old).eligible, false);
  assert.equal(run(old, [], { policy: { maxEvidenceAgeDaysAtApproval: 90 } }).eligible, true);
});

test('first-party evidence fetched after the approval date is refused', () => {
  const r = run(approvedEntry((x) => { x.evidence.first_party[0].fetched_at = '2026-11-25'; }));
  assert.ok(has(r, /fetched after the approval/));
});

// ---------- overlap ----------

test('overlap check missing, failed, or incomplete: not eligible', () => {
  assert.ok(has(run(approvedEntry((x) => { delete x.overlap_check; })), /overlap_check is missing/));
  assert.ok(has(run(approvedEntry((x) => { x.overlap_check.result = 'overlap'; })), /must be "distinct"/));
  const r = run(approvedEntry((x) => { x.overlap_check.checked_against = ['alpha-post']; }));
  assert.ok(has(r, /does not cover existing pages: beta-post, gamma-post/));
});

test('mechanical overlap: an exact intent term shared with a published page blocks it even if marked distinct', () => {
  const r = run(approvedEntry(), [published('gamma-post', 'new topic query, something else')]);
  assert.equal(r.eligible, false);
  assert.ok(has(r, /intent collides with "gamma-post"/));
});

// ---------- dates, scope, structure ----------

test('approved and complete but publish_after not reached: date is necessary, not sufficient', () => {
  const r = gate.evaluate([...baseQueue(), approvedEntry()], { today: '2026-11-19', blogSlugs: BLOG }).pop();
  assert.ok(has(r, /publish_after .* has not been reached/));
});

test('entry edited after approval (hash mismatch): not eligible', () => {
  const rec = approvedEntry();
  rec.angle = 'Quietly changed after the owner approved it.';
  const r = run(rec);
  assert.equal(r.eligible, false);
  assert.ok(has(r, /content_hash does not match/));
});

test('editing the evidence after approval also invalidates it', () => {
  const rec = approvedEntry();
  rec.evidence.first_party[0].quote = 'new topic query 300 clicks / 4000 impressions (edited after approval).';
  assert.ok(has(run(rec), /content_hash does not match/));
});

test('approval must reference the Claude conversation channel, not a GitHub comment or queue prose', () => {
  for (const channel of ['github-comment', 'queue-prose', 'agent', '']) {
    const r = run(approvedEntry((x) => { x.approval = { channel }; }));
    assert.equal(r.eligible, false, channel);
    assert.ok(has(r, /approval\.channel must be/), channel);
  }
});

test('approval must carry a plausible session id and event uuid', () => {
  assert.ok(has(run(approvedEntry((x) => { x.approval = { session_id: 'trust-me' }; })), /session_id/));
  assert.ok(has(run(approvedEntry((x) => { x.approval = { event_uuid: 'not-a-uuid' }; })), /event_uuid/));
});

test('approved entry whose page already exists is never written again', () => {
  assert.equal(run(approvedEntry((x) => { x.slug = 'alpha-post'; })).eligible, false);
});

test('internal links must be 2-3 existing posts', () => {
  const r = run(approvedEntry((x) => { x.internal_links = ['alpha-post', 'ghost-post']; }));
  assert.ok(has(r, /ghost-post/));
});

// ---------- run-time event verification ----------

function eventFor(rec, over = {}) {
  return {
    ccr: { data: [{
      created_at: '2026-11-20T10:00:00Z',
      user: {
        uuid: rec.approval.event_uuid,
        internal_anthropic_catchall: {
          client_platform: 'web_claude_ai',
          message: { content: `Reviewed the evidence.\n${rec.approval.message_line}\n`, role: 'user' },
          session_id: rec.approval.session_id,
          ...over,
        },
      },
    }] },
  };
}

test('default: a perfect-looking event still cannot establish origin; the run must stop and ask for trusted-channel verification', () => {
  const rec = approvedEntry();
  const res = gate.verifyEvent(eventFor(rec), rec);
  assert.equal(res.ok, false);
  assert.equal(res.needs_trusted_channel_verification, true);
  assert.match(res.reasons[0], /origin cannot be established/);
  assert.equal(res.observed.client_platform, 'web_claude_ai');
  assert.deepEqual([...gate.HUMAN_ORIGIN_VALUES], [], 'no origin marker has been established, so the allowlist ships empty');
});

test('verification can pass only when an origin marker is positively established in the (reviewed) allowlist', () => {
  const rec = approvedEntry();
  const ev = eventFor(rec, { inbound_origin: 'fixture-human-origin' });
  assert.equal(gate.verifyEvent(ev, rec, { humanOrigins: ['fixture-human-origin'] }).ok, true);
  assert.equal(gate.verifyEvent(ev, rec).ok, false);
  const other = eventFor(rec, { inbound_origin: 'peer-session' });
  assert.equal(gate.verifyEvent(other, rec, { humanOrigins: ['fixture-human-origin'] }).ok, false);
});

test('event mismatches are hard failures, not "needs verification"', () => {
  const rec = approvedEntry();
  const opts = { humanOrigins: ['fixture-human-origin'] };
  const mk = (o) => eventFor(rec, { inbound_origin: 'fixture-human-origin', ...o });
  const cases = {
    wrongSession: mk({ session_id: 'session_OTHERFIXTURE0002' }),
    assistantRole: mk({ message: { content: rec.approval.message_line, role: 'assistant' } }),
    synthetic: mk({ isSynthetic: true }),
    noLine: mk({ message: { content: 'looks good to me', role: 'user' } }),
    otherTopicLine: mk({ message: { content: 'APPROVE-WRITE other-topic 000000000000 signal=observed', role: 'user' } }),
    wrongHash: mk({ message: { content: `APPROVE-WRITE ${rec.slug} 000000000000 signal=observed`, role: 'user' } }),
  };
  for (const [name, ev] of Object.entries(cases)) {
    const res = gate.verifyEvent(ev, rec, opts);
    assert.equal(res.ok, false, name);
    assert.equal(res.needs_trusted_channel_verification, false, name);
  }
  const wrongUuid = mk({}); wrongUuid.ccr.data[0].user.uuid = '99999999-2222-4333-8444-555555555555';
  assert.equal(gate.verifyEvent(wrongUuid, rec, opts).ok, false);
  const tampered = approvedEntry(); tampered.angle = 'changed'; // approval.content_hash now stale
  assert.equal(gate.verifyEvent(eventFor(rec), tampered, opts).ok, false);
});

test('verification refuses an entry that is not approved, and missing event data', () => {
  const rec = approvedEntry();
  const proposed = { ...rec, status: 'proposed' };
  assert.equal(gate.verifyEvent(eventFor(rec), proposed).ok, false);
  assert.equal(gate.verifyEvent(null, rec).ok, false);
});

test('event JSON is accepted in the wrapper shapes the tools return', () => {
  const rec = approvedEntry();
  const wrapped = eventFor(rec);
  const inner = wrapped.ccr.data[0].user;
  for (const shape of [wrapped, { data: wrapped.ccr.data }, wrapped.ccr.data[0], inner]) {
    const n = gate.normalizeEvent(shape);
    assert.equal(n.role, 'user');
    assert.equal(n.session_id, SESSION);
    assert.equal(n.uuid, EVENT);
  }
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
const cli = (root, args, input) => spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8', input });

test('CLI --eligible lists only the structurally complete, due, approved entry and prints the policy semantics', () => {
  const unapproved = approvedEntry((x) => { x.slug = 'due-unapproved'; x.intent = 'due unapproved q'; });
  unapproved.status = 'proposed';
  delete unapproved.approval; // approvedEntry() seals an approval after mutating, so strip it afterwards
  const root = fixtureRoot([...baseQueue(), unapproved, approvedEntry()]);
  const res = cli(root, ['--eligible', '--today', TODAY]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.eligible, ['new-topic']);
  assert.ok(out.blocked.some((b) => b.slug === 'due-unapproved'));
  assert.equal(out.policy.maxEvidenceAgeDaysAtApproval, 14);
  assert.match(out.policy.note, /not SEO or demand thresholds/);
  assert.match(out.next_step, /verify-event/);
});

test('CLI --verify-event exits 1 with needs_trusted_channel_verification when origin is unprovable', () => {
  const rec = approvedEntry();
  const root = fixtureRoot([...baseQueue(), rec]);
  const res = cli(root, ['--verify-event', rec.slug], JSON.stringify(eventFor(rec)));
  assert.equal(res.status, 1);
  assert.equal(JSON.parse(res.stdout).needs_trusted_channel_verification, true);
  const bad = cli(root, ['--verify-event', rec.slug], 'not json');
  assert.equal(bad.status, 1);
});

test('CLI exposes no switch to loosen the policy or the origin allowlist at run time', () => {
  const rec = approvedEntry((x) => { x.evidence.first_party[0].fetched_at = '2026-10-01'; });
  const root = fixtureRoot([...baseQueue(), rec]);
  const res = cli(root, ['--eligible', '--today', TODAY, '--max-evidence-age-days', '9999', '--human-origin', 'web_claude_ai']);
  assert.deepEqual(JSON.parse(res.stdout).eligible, []);
  const ev = cli(root, ['--verify-event', rec.slug, '--human-origin', 'web_claude_ai'], JSON.stringify(eventFor(rec)));
  assert.equal(ev.status, 1);
});

test('CLI exits non-zero on an invalid queue (legacy queued) so the routine must stop', () => {
  const legacy = approvedEntry();
  legacy.status = 'queued';
  delete legacy.approval;
  const root = fixtureRoot([...baseQueue(), legacy]);
  assert.equal(cli(root, ['--eligible']).status, 1);
  assert.equal(cli(root, []).status, 1);
});

test('CLI --hash prints the exact approval line, including the demand label', () => {
  const rec = approvedEntry();
  const root = fixtureRoot([...baseQueue(), rec]);
  const out = JSON.parse(cli(root, ['--hash', rec.slug]).stdout);
  assert.equal(out.approval_line, rec.approval.message_line);
  assert.match(out.approval_line, /^APPROVE-WRITE new-topic [0-9a-f]{12} signal=observed$/);
});

test('the real content-queue.json is valid and nothing in it is write-eligible, whatever today is', () => {
  const root = path.join(__dirname, '..');
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
  assert.deepEqual(gate.validateQueue(queue), []);
  assert.equal(queue.filter((r) => r.status === 'queued').length, 0);
  assert.equal(queue.filter((r) => r.status === 'approved').length, 0, 'no agent-created approval may exist in the repo');
  const blogSlugs = gate.listBlogSlugs(root);
  for (const today of ['2026-11-16', '2026-12-31', '2030-01-01']) {
    assert.deepEqual(gate.evaluate(queue, { today, blogSlugs }).filter((r) => r.eligible), [], today);
  }
  const retired = queue.find((r) => r.slug === 'indian-themed-block-puzzle-games');
  assert.equal(retired.status, 'retired');
  assert.equal(retired.retired_evidence.ga4_used, false);
});
