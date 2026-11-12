'use strict';

// Proves the write-eligibility gate: only an approved, evidence-complete,
// overlap-checked, human-approved, due entry can be written. Everything else
// (due-but-unapproved, legacy "queued", retired, missing evidence, overlap
// failure, tampered or stale approvals) cannot. No network, no real approvals,
// no article output.

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
const REF = 'https://github.com/kavyabarnadhya/dhamakablocks-web/issues/200#issuecomment-123456';

const published = (slug, intent) => ({
  slug, title: slug, intent, angle: 'x', internal_links: [], status: 'published', publish_after: '2026-10-01',
});

function approvedEntry(over = {}) {
  const rec = {
    slug: 'new-topic',
    title: 'A New Topic',
    intent: 'new topic query, another new topic phrase',
    angle: 'A distinct angle that no existing page covers.',
    internal_links: ['alpha-post', 'beta-post'],
    status: 'approved',
    publish_after: '2026-11-20',
    evidence: {
      items: [{
        kind: 'web-search',
        url: 'https://example.com/search-result',
        fetched_at: '2026-11-18',
        quote: 'Query "new topic query" shows 120 impressions in the cited result.',
      }],
      summary: 'Recurring query seen in the cited source; limits stated here.',
    },
    overlap_check: {
      result: 'distinct',
      checked_at: '2026-11-19',
      checked_against: [...BLOG],
      notes: 'Compared against every existing page; none covers this intent.',
    },
    ...over,
  };
  rec.approval = {
    approved_by: 'kavyabarnadhya',
    approved_at: '2026-11-20',
    ref: REF,
    content_hash: gate.contentHash(rec),
    ...(over.approval || {}),
  };
  return rec;
}

const baseQueue = () => [published('alpha-post', 'alpha query'), published('beta-post', 'beta query')];
const run = (entry, extra = []) => gate.evaluate([...baseQueue(), ...extra, entry], { today: TODAY, blogSlugs: BLOG })
  .find((r) => r.slug === entry.slug);

// Rebuilds the approval hash after a deliberate change, so a test isolates ONE defect.
const rehash = (rec) => ({ ...rec, approval: { ...rec.approval, content_hash: gate.contentHash(rec) } });

test('positive control: approved + complete evidence + distinct overlap + human approval + due is eligible', () => {
  const r = run(approvedEntry());
  assert.equal(r.eligible, true, r.reasons.join('; '));
  assert.deepEqual(gate.validateQueue([...baseQueue(), approvedEntry()]), []);
});

test('due but only proposed: date alone never permits writing', () => {
  const r = run({ ...approvedEntry(), status: 'proposed', approval: undefined });
  assert.equal(r.eligible, false);
  assert.match(r.reasons[0], /not write-eligible/);
});

test('a proposal carrying full-looking evidence is still not eligible without status approved', () => {
  const rec = { ...approvedEntry(), status: 'proposed' };
  assert.equal(run(rec).eligible, false);
  assert.ok(gate.validateQueue([...baseQueue(), rec]).some((e) => /must not carry an approval/.test(e)));
});

test('legacy status "queued" is invalid and never eligible, however overdue', () => {
  const rec = { ...approvedEntry(), status: 'queued', publish_after: '2026-01-01' };
  assert.equal(run(rec).eligible, false);
  assert.ok(gate.validateQueue([...baseQueue(), rec]).some((e) => /"queued" is no longer valid/.test(e)));
});

test('retired entries cannot be written and need a recorded reason', () => {
  const rec = { ...approvedEntry(), status: 'retired', retired_reason: 'Unsupported.', retired_at: '2026-11-12' };
  assert.equal(run(rec).eligible, false);
  const bare = { ...rec, retired_reason: undefined };
  assert.ok(gate.validateQueue([...baseQueue(), bare]).some((e) => /retired_reason/.test(e)));
});

test('approved but missing evidence: not eligible', () => {
  const rec = rehash({ ...approvedEntry(), evidence: undefined });
  const r = run(rec);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /evidence/.test(x)));
});

test('approved with uncited evidence (no URL / no quote): not eligible', () => {
  const rec = approvedEntry();
  rec.evidence.items[0] = { kind: 'web-search', fetched_at: '2026-11-18' };
  const r = run(rehash(rec));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /url/.test(x)) && r.reasons.some((x) => /quote/.test(x)));
});

test('stale evidence (older than 14 days at approval): not eligible', () => {
  const rec = approvedEntry();
  rec.evidence.items[0].fetched_at = '2026-10-01';
  const r = run(rehash(rec));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /more than 14 days/.test(x)));
});

test('approval older than 30 days expires', () => {
  const r = gate.evaluate([...baseQueue(), approvedEntry()], { today: '2027-01-15', blogSlugs: BLOG }).pop();
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /older than 30 days/.test(x)));
});

test('overlap check missing: not eligible', () => {
  const r = run(rehash({ ...approvedEntry(), overlap_check: undefined }));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /overlap_check is missing/.test(x)));
});

test('overlap failure recorded by the checker: not eligible', () => {
  const rec = approvedEntry();
  rec.overlap_check.result = 'overlap';
  const r = run(rehash(rec));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /must be "distinct"/.test(x)));
});

test('mechanical overlap: an exact intent term shared with a published page blocks it even if marked distinct', () => {
  const clash = published('gamma-post', 'new topic query, something else');
  const r = run(approvedEntry(), [clash]);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /intent collides with "gamma-post"/.test(x)));
});

test('overlap check that skipped existing pages is incomplete: not eligible', () => {
  const rec = approvedEntry();
  rec.overlap_check.checked_against = ['alpha-post'];
  const r = run(rehash(rec));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /does not cover existing pages: beta-post, gamma-post/.test(x)));
});

test('approved and complete but publish_after not reached: date is necessary, not sufficient', () => {
  const rec = approvedEntry();
  const r = gate.evaluate([...baseQueue(), rec], { today: '2026-11-19', blogSlugs: BLOG }).pop();
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /publish_after .* has not been reached/.test(x)));
});

test('entry edited after approval (hash mismatch): not eligible', () => {
  const rec = approvedEntry();
  rec.angle = 'Quietly changed after the human approved it.';
  const r = run(rec);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /content_hash does not match/.test(x)));
});

test('approval attributed to an agent or bot is refused', () => {
  for (const name of ['claude', 'jules-bot', 'github-actions[bot]', 'content agent']) {
    const rec = approvedEntry();
    rec.approval.approved_by = name;
    const r = run(rec);
    assert.equal(r.eligible, false, name);
    assert.ok(r.reasons.some((x) => /must name a human/.test(x)), name);
  }
});

test('approval without a recoverable GitHub comment reference is refused', () => {
  for (const ref of ['', 'queue prose says approved', 'https://example.com/x#issuecomment-1',
    'https://github.com/other/repo/issues/1#issuecomment-1',
    'https://github.com/kavyabarnadhya/dhamakablocks-web/issues/1']) {
    const rec = approvedEntry();
    rec.approval.ref = ref;
    assert.equal(run(rec).eligible, false, ref);
  }
});

test('approved entry whose page already exists is never written again', () => {
  const rec = approvedEntry({ slug: 'alpha-post' });
  assert.equal(run(rec).eligible, false);
});

test('internal links must be 2-3 existing posts', () => {
  const rec = approvedEntry();
  rec.internal_links = ['alpha-post', 'ghost-post'];
  const r = run(rehash(rec));
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => /ghost-post/.test(x)));
});

// ---------- approval-comment verification (the online half, fed fixtures) ----------

const NOW = '2026-11-21T00:00:00Z';
function goodComment(rec) {
  return {
    html_url: rec.approval.ref,
    user: { login: rec.approval.approved_by, type: 'User' },
    author_association: 'OWNER',
    created_at: '2026-11-20T10:00:00Z',
    updated_at: '2026-11-20T10:00:00Z',
    body: `Reviewed the evidence.\nAPPROVE-WRITE ${rec.slug} ${gate.contentHash(rec).slice(0, 12)}\n`,
  };
}

test('comment check: a genuine human approval comment passes', () => {
  const rec = approvedEntry();
  assert.deepEqual(gate.verifyApprovalComment(goodComment(rec), rec, NOW), { ok: true, reasons: [] });
});

test('comment check: refuses bot, agent footer, wrong author, outsider, edited, wrong hash, missing line, wrong URL', () => {
  const rec = approvedEntry();
  const cases = {
    bot: (c) => { c.user.type = 'Bot'; },
    footer: (c) => { c.body += '\n---\n_Generated by Claude Code_'; },
    coauthor: (c) => { c.body += '\nCo-Authored-By: someone'; },
    wrongAuthor: (c) => { c.user.login = 'someone-else'; },
    outsider: (c) => { c.author_association = 'NONE'; },
    edited: (c) => { c.updated_at = '2026-11-20T11:00:00Z'; },
    wrongHash: (c) => { c.body = `APPROVE-WRITE ${rec.slug} 000000000000`; },
    noLine: (c) => { c.body = 'looks good to me'; },
    wrongUrl: (c) => { c.html_url = 'https://github.com/kavyabarnadhya/dhamakablocks-web/issues/9#issuecomment-9'; },
    future: (c) => { c.created_at = c.updated_at = '2027-01-01T00:00:00Z'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const c = goodComment(rec);
    mutate(c);
    assert.equal(gate.verifyApprovalComment(c, rec, NOW).ok, false, name);
  }
});

test('comment check: refuses an entry that is not approved', () => {
  const rec = { ...approvedEntry(), status: 'proposed' };
  assert.equal(gate.verifyApprovalComment(goodComment(approvedEntry()), rec, NOW).ok, false);
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
const cli = (root, ...a) => spawnSync(process.execPath, [CLI, '--root', root, ...a], { encoding: 'utf8' });

test('CLI --eligible lists only the approved, complete, due entry', () => {
  const dueUnapproved = { ...approvedEntry({ slug: 'due-unapproved', intent: 'due unapproved q' }), status: 'proposed', approval: undefined };
  const root = fixtureRoot([...baseQueue(), dueUnapproved, approvedEntry()]);
  const res = cli(root, '--eligible', '--today', TODAY);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.eligible, ['new-topic']);
  assert.ok(out.blocked.some((b) => b.slug === 'due-unapproved'));
  assert.equal(out.requires_comment_verification, true);
});

test('CLI --eligible lists nothing when the only due entry is unapproved', () => {
  const root = fixtureRoot([...baseQueue(), { ...approvedEntry(), status: 'proposed', approval: undefined }]);
  assert.deepEqual(JSON.parse(cli(root, '--eligible', '--today', '2099-01-01').stdout).eligible, []);
});

test('CLI exits non-zero on an invalid queue (legacy queued) so the routine must stop', () => {
  const root = fixtureRoot([...baseQueue(), { ...approvedEntry(), status: 'queued', approval: undefined }]);
  assert.equal(cli(root, '--eligible').status, 1);
  assert.equal(cli(root).status, 1);
});

test('CLI --verify-comment reads GitHub comment JSON from stdin', () => {
  const rec = approvedEntry();
  const root = fixtureRoot([...baseQueue(), rec]);
  const ok = spawnSync(process.execPath, [CLI, '--root', root, '--verify-comment', rec.slug], {
    // The CLI judges "future" against the real clock, so date the fixture comment well in the past.
    input: JSON.stringify({ ...goodComment(rec), created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z' }), encoding: 'utf8',
  });
  assert.equal(ok.status, 0, ok.stdout);
  const bad = spawnSync(process.execPath, [CLI, '--root', root, '--verify-comment', rec.slug], {
    input: JSON.stringify({ ...goodComment(rec), body: 'approved' }), encoding: 'utf8',
  });
  assert.equal(bad.status, 1);
});

test('the real content-queue.json is valid and nothing in it is write-eligible, whatever today is', () => {
  const root = path.join(__dirname, '..');
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'content-queue.json'), 'utf8'));
  assert.deepEqual(gate.validateQueue(queue), []);
  assert.equal(queue.filter((r) => r.status === 'queued').length, 0);
  const blogSlugs = gate.listBlogSlugs(root);
  for (const today of ['2026-11-16', '2026-12-31', '2030-01-01']) {
    assert.deepEqual(gate.evaluate(queue, { today, blogSlugs }).filter((r) => r.eligible), [], today);
  }
  const retired = queue.find((r) => r.slug === 'indian-themed-block-puzzle-games');
  assert.equal(retired.status, 'retired');
  assert.equal(retired.retired_evidence.ga4_used, false);
});
