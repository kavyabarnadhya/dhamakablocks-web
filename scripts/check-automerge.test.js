'use strict';

// Proves the deterministic half of the self-merge gate: non-content PRs are never
// eligible for auto-merge but do not fail; content PRs may touch only their
// allowed files, obey the owner's switch and caps read from the base branch, and
// pass the content lint. Fixtures only: temp git repos, no network.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const am = require('./check-automerge.js');

const CLI = path.join(__dirname, 'check-automerge.js');
const SITE = 'https://dhamakablocks.com';

function page(slug, over = {}) {
  const o = {
    title: 'Games Like Alpha (2026): Free Picks Compared',
    desc: 'Looking for games like Alpha? Compare free picks on grid, offline play and combos, with an honest look at Dhamaka Blocks ads.',
    h1: '<h1>Games Like Alpha (2026): Free Picks Compared</h1>',
    body: '<p>Dhamaka Blocks is not ad-free. Combos climb from 1.0× to 10.0× on an 8×8 grid.</p><a href="/blog/beta-post">Beta</a>',
    faq: '<h2>Frequently Asked Questions</h2>',
    ld: null,
    modified: '2026-11-25',
    canonical: `${SITE}/blog/${slug}`,
    ...over,
  };
  const ld = o.ld || JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: o.title.replace(/&amp;/g, '&'), dateModified: `${o.modified}T00:00:00+05:30` },
    { '@type': 'BreadcrumbList', itemListElement: [] },
    { '@type': 'FAQPage', mainEntity: [] },
  ] });
  return `<!doctype html><html><head><title>${o.title}</title>
<meta name="description" content="${o.desc}" />
<script type="application/ld+json">${ld}</script>
<link rel="canonical" href="${o.canonical}" />
<meta property="og:title" content="${o.title}" />
<meta property="og:description" content="${o.desc}" />
<meta property="article:modified_time" content="${o.modified}T00:00:00+05:30" />
<meta name="twitter:title" content="${o.title}" />
<meta name="twitter:description" content="${o.desc}" />
</head><body>${o.h1}${o.body}${o.faq}</body></html>`;
}

const SLUGS = ['alpha-post', 'beta-post', 'block-blast-alternatives'];
const lint = (html, slug = 'alpha-post', ctx = {}) => am.lintPage(html, slug, { blogSlugs: SLUGS, ...ctx });
const has = (errs, re) => errs.some((e) => re.test(e));

test('a well-formed page passes the lint', () => {
  assert.deepEqual(lint(page('alpha-post')), []);
});

test('structure: one h1, matching titles, canonical, JSON-LD types, FAQPage, dates', () => {
  assert.ok(has(lint(page('alpha-post', { h1: '<h1>A</h1><h1>B</h1>' })), /2 <h1>/));
  assert.ok(has(lint(page('alpha-post', { canonical: `${SITE}/blog/other` })), /canonical must be/));
  assert.ok(has(lint(page('alpha-post', { ld: '{not json' })), /does not parse/));
  assert.ok(has(lint(page('alpha-post', { ld: JSON.stringify({ '@type': 'WebPage' }) })), /no Article/));
  const noFaq = JSON.stringify({ '@graph': [{ '@type': 'Article', headline: 'Games Like Alpha (2026): Free Picks Compared', dateModified: '2026-11-25' }, { '@type': 'BreadcrumbList' }] });
  assert.ok(has(lint(page('alpha-post', { ld: noFaq })), /FAQ section but no FAQPage/));
  const html = page('alpha-post').replace('<meta property="og:title" content="Games Like Alpha (2026): Free Picks Compared" />', '<meta property="og:title" content="Something else" />');
  assert.ok(has(lint(html), /og:title "Something else" differs/));
  const dates = page('alpha-post').replace('content="2026-11-25T00:00:00+05:30" />', 'content="2026-10-01T00:00:00+05:30" />');
  assert.ok(has(lint(dates), /dateModified 2026-11-25 differs from article:modified_time 2026-10-01/));
});

test('length limits apply to new or changed titles and descriptions only', () => {
  const longT = 'A'.repeat(71);
  assert.ok(has(lint(page('alpha-post', { title: longT, h1: '<h1>x</h1>' })), /title is 71 characters/));
  assert.deepEqual(lint(page('alpha-post', { title: longT, h1: '<h1>x</h1>' }), 'alpha-post', { base: { title: longT, desc: page('alpha-post').match(/name="description" content="([^"]*)"/)[1] } }), []);
  const longD = 'D'.repeat(161);
  assert.ok(has(lint(page('alpha-post', { desc: longD })), /meta description is 161 characters/));
});

test('broken internal links are refused', () => {
  assert.ok(has(lint(page('alpha-post', { body: '<a href="/blog/ghost-post">x</a> Dhamaka Blocks is not ad-free.' })), /\/blog\/ghost-post has no page/));
});

test('hard rules: ad-free claims about Dhamaka Blocks, solver/cheat wording, wrong multipliers, stale +75', () => {
  assert.ok(has(lint(page('alpha-post', { body: '<p>Dhamaka Blocks has no ads at all.</p>' })), /may claim Dhamaka Blocks is ad-free/));
  assert.deepEqual(lint(page('alpha-post', { body: "<p>Dhamaka Blocks isn't ad-free: it shows banners.</p>" })), []);
  assert.deepEqual(lint(page('alpha-post', { body: "<p>Unlike the parts that aren't ad-free, Dhamaka Blocks shows banners.</p>" })), []);
  assert.ok(has(lint(page('alpha-post', { body: '<p>Use this solver to win.</p>' })), /off-limits wording "solver"/));
  assert.deepEqual(lint(page('alpha-post', { body: '<p>Skip anything claiming to be a hacked version; it carries risk.</p>' })), []);
  assert.ok(has(lint(page('alpha-post', { body: '<p>Combos reach 12.0× quickly.</p>' })), /12\.0×" is not a confirmed combo tier/));
  assert.deepEqual(lint(page('alpha-post', { body: '<p>A 10×10 grid, an 8×8 grid and a 3×3 bomb; combos reach 3.5× then 7.0×.</p>' })), []);
  assert.ok(has(lint(page('alpha-post', { body: '<p>Three lines give +75 points.</p>' })), /\+75/));
});

test('new posts must be registered in sitemap, llms.txt, blog index and _redirects', () => {
  const errs = lint(page('alpha-post'), 'alpha-post', { isNew: true, registry: {} });
  for (const re of [/sitemap\.xml/, /llms\.txt/, /blog\/index\.html/, /_redirects/]) assert.ok(has(errs, re), re);
  const registry = {
    sitemap: `<loc>${SITE}/blog/alpha-post</loc>`, llms: `${SITE}/blog/alpha-post`,
    blogIndex: '<a href="/blog/alpha-post">', redirects: '/blog/alpha-post.html /blog/alpha-post 301\n',
  };
  assert.deepEqual(lint(page('alpha-post'), 'alpha-post', { isNew: true, registry }), []);
});

test('the real blog pages all pass the lint as they stand today', () => {
  const root = path.join(__dirname, '..');
  const slugs = fs.readdirSync(path.join(root, 'blog')).filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_')).map((f) => f.slice(0, -5));
  for (const s of slugs) {
    const html = fs.readFileSync(path.join(root, 'blog', `${s}.html`), 'utf8');
    const t = html.match(/<title>([\s\S]*?)<\/title>/i)[1].replace(/&amp;/g, '&').trim();
    const d = (html.match(/name="description" content="([^"]*)"/) || [])[1];
    const base = { title: t, desc: d && d.replace(/&amp;/g, '&').trim() };
    assert.deepEqual(am.lintPage(html, s, { blogSlugs: slugs, base }), [], s);
  }
});

// ---------- branch kinds and allowed files ----------

test('branch kinds', () => {
  assert.equal(am.classifyBranch('content/queue-refresh-2026-11-26'), 'batch');
  assert.equal(am.classifyBranch('content/post-new-topic'), 'post');
  assert.equal(am.classifyBranch('content/edit-block-blast-alternatives'), 'edit');
  assert.equal(am.classifyBranch('content/revert-alpha-post-2026-12-20'), 'revert');
  assert.equal(am.classifyBranch('content/whatever'), 'unknown-content');
  assert.equal(am.classifyBranch('claude/seo-growth-rules'), null);
});

test('allowed files per kind; protected files are never allowed', () => {
  const f = (status, p) => ({ status, path: p });
  assert.deepEqual(am.pathProblems('batch', [f('M', 'content-queue.json')], 'content/queue-refresh-x'), []);
  assert.ok(am.pathProblems('batch', [f('M', 'blog/alpha-post.html')], 'content/queue-refresh-x').length);
  assert.deepEqual(am.pathProblems('post', [f('A', 'blog/new-topic.html'), f('M', 'sitemap.xml'), f('M', 'llms.txt'), f('M', 'blog/index.html'), f('M', 'index.html'), f('M', '_redirects'), f('M', 'content-queue.json')], 'content/post-new-topic'), []);
  assert.ok(am.pathProblems('post', [f('M', 'blog/alpha-post.html')], 'content/post-new-topic').length, 'a post PR cannot modify another page');
  assert.deepEqual(am.pathProblems('edit', [f('M', 'blog/alpha-post.html'), f('M', 'sitemap.xml')], 'content/edit-alpha-post'), []);
  assert.ok(am.pathProblems('edit', [f('M', 'blog/beta-post.html')], 'content/edit-alpha-post').length, 'an edit PR touches only its target');
  for (const p of ['scripts/check-queue-gate.js', '.github/workflows/x.yml', '.jules/automerge.json', '.jules/content-style.md', '_headers', 'privacy.html', 'js/analytics.js', 'wrangler.jsonc', 'blog/_TEMPLATE.html']) {
    assert.match(am.pathProblems('revert', [f('M', p)], 'content/revert-x')[0], /may never change/, p);
  }
  assert.ok(am.pathProblems('edit', [f('D', 'blog/alpha-post.html')], 'content/edit-alpha-post').length, 'no deletions');
});

// ---------- CLI against a temp repo ----------

function repo(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'automerge-'));
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' }).trim();
  fs.mkdirSync(path.join(root, 'blog'));
  fs.mkdirSync(path.join(root, '.jules'));
  for (const s of SLUGS) fs.writeFileSync(path.join(root, 'blog', `${s}.html`), page(s));
  fs.writeFileSync(path.join(root, 'blog', 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'content-queue.json'), '[]');
  if (config) fs.writeFileSync(path.join(root, '.jules', 'automerge.json'), JSON.stringify(config));
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  g('add', '-A'); g('commit', '-q', '-m', 'base', '--date', '2026-01-01T00:00:00Z');
  execFileSync('git', ['-C', root, 'commit', '--amend', '-q', '--no-edit'], { env: { ...process.env, GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } });
  return { root, g };
}
const run = (root, head) => spawnSync(process.execPath, [CLI, '--root', root, '--base', 'main', '--head-ref', head], { encoding: 'utf8' });
const ON = { enabled: true, max_article_merges_per_7_days: 4, top_page: 'block-blast-alternatives', top_page_min_days_between_edits: 7 };

function editBranch({ root, g }, branch, file, mutate) {
  g('checkout', '-q', '-b', branch);
  const p = path.join(root, file);
  fs.writeFileSync(p, mutate(fs.readFileSync(p, 'utf8')));
  g('commit', '-q', '-am', 'edit');
}

test('CLI: a non-content PR passes with a notice and is never auto-merge eligible', () => {
  const r = repo(ON);
  const res = run(r.root, 'claude/seo-growth-rules');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /never auto-merged/);
});

test('CLI: an allowed edit passes; the pause switch, a missing config or a protected file fail it', () => {
  const r = repo(ON);
  editBranch(r, 'content/edit-alpha-post', 'blog/alpha-post.html', (s) => s.replace('Beta</a>', 'Beta guide</a>'));
  assert.equal(run(r.root, 'content/edit-alpha-post').status, 0, run(r.root, 'content/edit-alpha-post').stderr);

  const off = repo({ ...ON, enabled: false });
  editBranch(off, 'content/edit-alpha-post', 'blog/alpha-post.html', (s) => s.replace('Beta</a>', 'Beta guide</a>'));
  assert.match(run(off.root, 'content/edit-alpha-post').stderr, /switched off/);

  const none = repo(null);
  editBranch(none, 'content/edit-alpha-post', 'blog/alpha-post.html', (s) => s.replace('Beta</a>', 'Beta guide</a>'));
  assert.match(run(none.root, 'content/edit-alpha-post').stderr, /missing on the base branch/);

  const sneaky = repo(ON);
  editBranch(sneaky, 'content/edit-alpha-post', '.jules/automerge.json', () => JSON.stringify({ ...ON, max_article_merges_per_7_days: 999 }));
  const res = run(sneaky.root, 'content/edit-alpha-post');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /may never change/);
});

test('CLI: the lint runs on changed pages', () => {
  const r = repo(ON);
  editBranch(r, 'content/edit-alpha-post', 'blog/alpha-post.html', (s) => s.replace('<p>Dhamaka Blocks is not ad-free.', '<p>Dhamaka Blocks has no ads.'));
  assert.match(run(r.root, 'content/edit-alpha-post').stderr, /may claim Dhamaka Blocks is ad-free/);
});

test('CLI: top-page edits are spaced at least 7 days apart', () => {
  const r = repo(ON);
  // a top-page change landed on main just now
  const p = path.join(r.root, 'blog', 'block-blast-alternatives.html');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Beta</a>', 'Beta now</a>'));
  r.g('commit', '-q', '-am', 'recent top-page edit');
  editBranch(r, 'content/edit-block-blast-alternatives', 'blog/block-blast-alternatives.html', (s) => s.replace('Beta now</a>', 'Beta again</a>'));
  assert.match(run(r.root, 'content/edit-block-blast-alternatives').stderr, /min 7 days between top-page edits/);
});

test('CLI: the weekly cap counts merged article PRs on the base branch', () => {
  const r = repo({ ...ON, max_article_merges_per_7_days: 1 });
  r.g('checkout', '-q', '-b', 'content/post-one');
  fs.writeFileSync(path.join(r.root, 'content-queue.json'), '[1]');
  r.g('commit', '-q', '-am', 'x');
  r.g('checkout', '-q', 'main');
  r.g('merge', '-q', '--no-ff', '-m', 'Merge pull request #1 from kavyabarnadhya/content/post-one', 'content/post-one');
  editBranch(r, 'content/edit-alpha-post', 'blog/alpha-post.html', (s) => s.replace('Beta</a>', 'Beta guide</a>'));
  assert.match(run(r.root, 'content/edit-alpha-post').stderr, /1 article PRs merged in the last 7 days \(cap 1\)/);
});
