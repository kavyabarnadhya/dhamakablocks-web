// Regression tests for scripts/check-drafting-markers.js.
// Run: node --test scripts/check-drafting-markers.test.js   (Node's built-in runner, no dependencies)
//
// Fixtures are written to a temp directory at test time, never committed, so a
// marker-bearing fixture can't be picked up by this guard or by the other
// site checkers (they walk the repo for .html files).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const guard = require('./check-drafting-markers.js');
const SCRIPT = path.join(__dirname, 'check-drafting-markers.js');

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drafting-markers-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function runGuard(root) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const CLEAN_PAGE = '<!doctype html>\n<html><body>\n<h1>Privacy</h1>\n<p>We keep things simple.</p>\n</body></html>\n';

// ── scanText: what is flagged ────────────────────────────────────────────

test('flags each marker with its line and column', () => {
  const cases = [
    ['[LEGAL: confirm controller wording]', '[LEGAL'],
    ['[CONFIRM with counsel]', '[CONFIRM'],
    ['TODO: write this', 'TODO'],
    ['TBD', 'TBD'],
    ['FIXME later', 'FIXME'],
  ];
  for (const [text, marker] of cases) {
    const hits = guard.scanText(`line one\n  ${text}\n`);
    assert.equal(hits.length, 1, text);
    assert.equal(hits[0].marker, marker);
    assert.equal(hits[0].line, 2, text);
    assert.equal(hits[0].col, 3, text);
  }
});

test('is case-insensitive', () => {
  for (const text of ['[legal: x]', '[Legal]', 'todo: x', 'Tbd', 'fixme', '[confirm x]']) {
    assert.equal(guard.scanText(text).length, 1, text);
  }
});

test('flags markers inside HTML comments and tags, not only visible text', () => {
  const html = '<p>ok</p>\n<!-- DRAFT: do not merge until [LEGAL] is resolved -->\n<mark>[LEGAL: x]</mark>\n<span>TODO</span>';
  const hits = guard.scanText(html);
  assert.deepEqual(hits.map((h) => [h.line, h.marker]), [[2, '[LEGAL'], [3, '[LEGAL'], [4, 'TODO']]);
});

test('flags several markers on one line, in column order', () => {
  const hits = guard.scanText('TODO fix this, TBD, and [LEGAL: x]');
  assert.deepEqual(hits.map((h) => h.marker), ['TODO', 'TBD', '[LEGAL']);
});

test('reports correct line numbers with CRLF line endings', () => {
  const hits = guard.scanText('a\r\nb\r\nTODO\r\n');
  assert.equal(hits[0].line, 3);
});

test('tolerates whitespace after the bracket', () => {
  assert.equal(guard.scanText('[ LEGAL ]').length, 1);
  assert.equal(guard.scanText('[ CONFIRM ]').length, 1);
});

// ── scanText: legitimate substrings are not flagged ──────────────────────

test('does not flag legitimate words that merely contain a marker', () => {
  const fine = [
    'Todoist and mastodon are apps',
    'autodoc and Tbdisplay',
    'fixmeup',
    'See the [Legality] section',
    'Legal basis for processing',
    'We [confirmed] this',
    'Please confirm your email',
    'to-do list',
    'Terms of Use and Legal notices',
  ];
  for (const text of fine) assert.deepEqual(guard.scanText(text), [], text);
});

// ── file discovery: scope is public authored copy ────────────────────────

test('scans html pages (any depth) and llms.txt only', () => {
  const root = makeTree({
    'index.html': CLEAN_PAGE,
    'privacy.html': CLEAN_PAGE,
    'blog/post.html': CLEAN_PAGE,
    'llms.txt': '# Dhamaka Blocks\n',
    'README.md': 'TODO write readme',
    'js/app.js': '// TODO tidy',
    'sitemap.xml': '<urlset/>',
  });
  assert.deepEqual(guard.findPublicCopyFiles(root), ['blog/post.html', 'index.html', 'llms.txt', 'privacy.html']);
});

test('skips dot-directories, node_modules, scripts/ and .assetsignore entries', () => {
  const root = makeTree({
    'index.html': CLEAN_PAGE,
    '.assetsignore': '# internal\ncontent-queue.json\n.jules/\nblog/_TEMPLATE.html\ndrafts/\n',
    'blog/_TEMPLATE.html': '<p>fill every {{PLACEHOLDER}} TODO</p>',
    'blog/real.html': CLEAN_PAGE,
    'drafts/wip.html': '<p>TODO</p>',
    '.jules/notes.html': '<p>TODO</p>',
    '.github/page.html': '<p>TODO</p>',
    'node_modules/pkg/readme.html': '<p>TODO</p>',
    'scripts/fixture.html': '<p>TODO</p>',
  });
  assert.deepEqual(guard.findPublicCopyFiles(root), ['blog/real.html', 'index.html']);
});

// ── CLI: fail / pass fixtures ────────────────────────────────────────────

test('PASS fixture: a clean tree exits 0', () => {
  const root = makeTree({ 'index.html': CLEAN_PAGE, 'privacy.html': CLEAN_PAGE, 'llms.txt': '# ok\n' });
  const r = runGuard(root);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /No drafting markers in 3 public copy file\(s\)/);
});

test('FAIL fixture: the exact leak that shipped (visible [LEGAL] note) exits 1 with file:line', () => {
  const page = CLEAN_PAGE.replace(
    '<p>We keep things simple.</p>',
    "<p>We keep things simple. <mark>[LEGAL: confirm the existing privacy policy's controller/identity wording and age rules; I did not verify them.]</mark></p>"
  );
  const root = makeTree({ 'index.html': CLEAN_PAGE, 'privacy.html': page });
  const r = runGuard(root);
  assert.equal(r.code, 1);
  assert.match(r.err, /::error file=privacy\.html,line=4,col=\d+,title=Drafting marker::/);
  assert.match(r.err, /Drafting marker "\[LEGAL" in public copy at privacy\.html:4:\d+/);
  assert.match(r.err, /1 drafting marker\(s\) in 1 file\(s\)/);
});

test('FAIL fixture: a stale "do not merge until [LEGAL]" HTML comment exits 1', () => {
  const page = '<!-- DRAFT (not live): do not merge until\n     the [LEGAL] item is resolved -->\n<p>x</p>\n';
  const r = runGuard(makeTree({ 'privacy.html': page }));
  assert.equal(r.code, 1);
  assert.match(r.err, /file=privacy\.html,line=2,/);
});

test('FAIL fixture: markers in a blog post and in llms.txt are both reported', () => {
  const r = runGuard(makeTree({
    'index.html': CLEAN_PAGE,
    'blog/post.html': '<p>ok</p>\n<p>TBD: add stats</p>\n',
    'llms.txt': '# Dhamaka Blocks\nFIXME describe\n',
  }));
  assert.equal(r.code, 1);
  assert.match(r.err, /file=blog\/post\.html,line=2,/);
  assert.match(r.err, /file=llms\.txt,line=2,/);
  assert.match(r.err, /2 drafting marker\(s\) in 2 file\(s\)/);
});

test('an ignored or out-of-scope file with a marker does not fail the build', () => {
  const r = runGuard(makeTree({
    'index.html': CLEAN_PAGE,
    '.assetsignore': 'blog/_TEMPLATE.html\n',
    'blog/_TEMPLATE.html': '<p>TODO</p>',
    'README.md': 'TODO',
    'js/app.js': '// TODO',
  }));
  assert.equal(r.code, 0, r.err);
});

test('an empty tree is an error, not a silent pass', () => {
  const r = runGuard(makeTree({ 'notes.txt': 'nothing public here' }));
  assert.equal(r.code, 1);
  assert.match(r.err, /No public copy files found/);
});

test('unknown arguments are rejected with exit 2', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('workflow-command output escapes %, CR and LF in the excerpt', () => {
  const out = guard.formatFinding({ file: 'a.html', line: 1, col: 1, marker: 'TODO', excerpt: '100% done\nnext' });
  assert.ok(!out.includes('\n'));
  assert.match(out, /100%25 done%0Anext/);
});
