#!/usr/bin/env node
'use strict';

// Auto-merge eligibility + content lint for content PRs (added 2026-11-25).
//
// The owner chose to let the content loop merge its own content PRs once every
// check is green and an independent reviewer sub-agent has posted a PASS. This
// script is the deterministic half of that gate. It runs in CI on every PR:
//
//   - Non-content PRs (any head branch outside content/*) pass with a notice:
//     they are never auto-merged; the owner merges them.
//   - Content PRs (content/queue-refresh-*, content/post-<slug>,
//     content/edit-<target>, content/revert-<target>-*) must:
//       * touch only the files their kind allows (never scripts/, .github/,
//         .jules/, _headers, privacy.html, js/, wrangler.jsonc, ...);
//       * respect the owner's switch and caps in .jules/automerge.json, read
//         from the BASE branch so a PR cannot change them;
//       * pass the content lint below for every changed blog page.
//
// Content lint (per changed blog/<slug>.html):
//   one <h1>; <title>, og:title, twitter:title and the Article headline agree;
//   title <= 70 chars; meta description <= 160 chars and equal to og/twitter;
//   canonical is https://dhamakablocks.com/blog/<slug>; every JSON-LD block
//   parses and Article + BreadcrumbList are present; FAQPage present when the
//   page has an FAQ section; dateModified and article:modified_time agree;
//   internal /blog/ links resolve; no solver/cheat/hack/MOD APK wording; no
//   sentence calls Dhamaka Blocks ad-free; combo multipliers are only the
//   confirmed tiers; no stale "+75" 3-line bonus. New posts must also be
//   registered in sitemap.xml, llms.txt, blog/index.html and _redirects.
//
// Usage: node scripts/check-automerge.js --base <ref> --head-ref <branch> [--root <dir>]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = 'https://dhamakablocks.com';
const CONFIG_PATH = '.jules/automerge.json';
const CONFIG_DEFAULTS = Object.freeze({
  enabled: false, max_article_merges_per_7_days: 4, top_page: 'block-blast-alternatives', top_page_min_days_between_edits: 7,
});
const COMBO_TIERS = new Set([1, 2, 3.5, 5, 7, 10]);
const MAX_TITLE = 70;
const MAX_DESC = 160;

// Files each kind of content PR may touch. Anything else fails the check.
const SHARED_REGISTRY = ['sitemap.xml', 'llms.txt', 'blog/index.html', 'index.html', 'content-queue.json'];
const NEVER = [/^scripts\//, /^\.github\//, /^\.jules\//, /^js\//, /^_headers$/, /^privacy\.html$/, /^wrangler\.jsonc$/,
  /^robots\.txt$/, /^\.well-known\//, /^\.assetsignore$/, /^app-ads\.txt$/, /^blog\/_TEMPLATE\.html$/, /^CLAUDE\.md$/, /^LICENSE$/];

// ---------- helpers ----------

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).trim();

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name.replace(/[:]/g, '\\$&')}"\\s+content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? decode(m[1]) : null;
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function collectTypes(node, acc) {
  if (Array.isArray(node)) node.forEach((n) => collectTypes(n, acc));
  else if (node && typeof node === 'object') {
    const t = node['@type'];
    (Array.isArray(t) ? t : [t]).filter(Boolean).forEach((x) => acc.push({ type: x, node }));
    Object.values(node).forEach((v) => collectTypes(v, acc));
  }
  return acc;
}

function visibleText(html) {
  return decode(html
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

// ---------- content lint ----------

function lintPage(html, slug, ctx = {}) {
  const p = [];
  const blogSlugs = new Set(ctx.blogSlugs || []);
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) p.push(`has ${h1s} <h1> elements (exactly one required)`);

  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleM ? decode(titleM[1]) : null;
  if (!title) p.push('has no <title>');
  else if (title.length > MAX_TITLE && (!ctx.base || ctx.base.title !== title)) p.push(`title is ${title.length} characters (max ${MAX_TITLE}): "${title}"`);

  const blocks = jsonLdBlocks(html);
  const types = [];
  blocks.forEach((b, i) => {
    try { collectTypes(JSON.parse(b), types); } catch (e) { p.push(`JSON-LD block ${i + 1} does not parse: ${e.message}`); }
  });
  const has = (t) => types.some((x) => x.type === t);
  if (!has('Article') && !has('BlogPosting')) p.push('JSON-LD has no Article');
  if (!has('BreadcrumbList')) p.push('JSON-LD has no BreadcrumbList');
  if (/>\s*Frequently Asked Questions\s*</i.test(html) && !has('FAQPage')) p.push('has an FAQ section but no FAQPage JSON-LD');
  const article = types.find((x) => x.type === 'Article' || x.type === 'BlogPosting');
  const headline = article && article.node.headline;

  const og = metaContent(html, 'property', 'og:title');
  const tw = metaContent(html, 'name', 'twitter:title');
  for (const [label, v] of [['og:title', og], ['twitter:title', tw], ['Article headline', headline]]) {
    if (title && v != null && decode(v) !== title) p.push(`${label} "${decode(v)}" differs from <title> "${title}"`);
  }

  const desc = metaContent(html, 'name', 'description');
  if (!desc) p.push('has no meta description');
  else {
    if (desc.length > MAX_DESC && (!ctx.base || ctx.base.desc !== desc)) p.push(`meta description is ${desc.length} characters (max ${MAX_DESC})`);
    for (const [label, v] of [['og:description', metaContent(html, 'property', 'og:description')], ['twitter:description', metaContent(html, 'name', 'twitter:description')]]) {
      if (v != null && v !== desc) p.push(`${label} differs from the meta description`);
    }
  }

  const canon = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!canon || canon[1] !== `${SITE}/blog/${slug}`) p.push(`canonical must be ${SITE}/blog/${slug}${canon ? ` (found ${canon[1]})` : ''}`);

  const dm = article && typeof article.node.dateModified === 'string' ? article.node.dateModified.slice(0, 10) : null;
  const amt = metaContent(html, 'property', 'article:modified_time');
  if (dm && amt && amt.slice(0, 10) !== dm) p.push(`dateModified ${dm} differs from article:modified_time ${amt.slice(0, 10)}`);

  const linkRe = /href="\/blog\/([a-z0-9-]+)(?:\.html)?(?:[#?][^"]*)?"/gi;
  let m;
  const missing = new Set();
  while ((m = linkRe.exec(html))) if (!blogSlugs.has(m[1])) missing.add(m[1]);
  missing.forEach((s) => p.push(`internal link /blog/${s} has no page`));

  const text = visibleText(html);
  const NEGATION = /\bnot\b|n't\b|\bnever\b|\bno,/i;
  const WARNING = /\b(avoid|skip|never|not|don't|aren't|isn't|risk|unofficial|unsafe)\b/i;
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const banned = sentence.match(/\b(solvers?|cheats?|cheating|hacks?|hacked|mod apk|modded)\b/i);
    if (banned && !WARNING.test(sentence)) {
      p.push(`uses off-limits wording "${banned[0]}" outside a warning (no solver/cheat/hack/MOD content): "${sentence.slice(0, 120)}"`);
    }
    if (/dhamaka/i.test(sentence) && /\b(ad-free|ads-free|no ads|without ads|zero ads)\b/i.test(sentence) && !NEGATION.test(sentence)) {
      p.push(`may claim Dhamaka Blocks is ad-free: "${sentence.slice(0, 120)}"`);
    }
  }
  const multRe = /(\d+(?:\.\d+)?)\s?×(?!\s?\d)/g;
  while ((m = multRe.exec(text))) {
    if (!COMBO_TIERS.has(Number(m[1]))) p.push(`multiplier "${m[0]}" is not a confirmed combo tier (1.0, 2.0, 3.5, 5.0, 7.0, 10.0)`);
  }
  if (/\+75\b/.test(text)) p.push('mentions "+75" (the 3-line bonus is +85 since v2.8.0)');

  if (ctx.isNew) {
    const reg = ctx.registry || {};
    if (!String(reg.sitemap || '').includes(`<loc>${SITE}/blog/${slug}</loc>`)) p.push('new post is not in sitemap.xml');
    if (!String(reg.llms || '').includes(`${SITE}/blog/${slug}`)) p.push('new post is not in llms.txt');
    if (!String(reg.blogIndex || '').includes(`href="/blog/${slug}"`)) p.push('new post is not linked from blog/index.html');
    if (!String(reg.redirects || '').split('\n').some((l) => l.trim() === `/blog/${slug}.html /blog/${slug} 301`)) p.push('new post has no 301 line in _redirects');
  }
  return p;
}

// ---------- eligibility ----------

function classifyBranch(head) {
  const h = String(head || '');
  if (h.startsWith('content/queue-refresh-')) return 'batch';
  if (/^content\/post-[a-z0-9-]+$/.test(h)) return 'post';
  if (/^content\/edit-[a-z0-9-]+$/.test(h)) return 'edit';
  if (/^content\/revert-[a-z0-9-]+$/.test(h)) return 'revert';
  if (h.startsWith('content/')) return 'unknown-content';
  return null;
}

// files: [{ status: 'A'|'M'|'D'|'R', path }]
function pathProblems(kind, files, head) {
  const p = [];
  for (const f of files) {
    if (NEVER.some((re) => re.test(f.path))) { p.push(`${f.path}: content PRs may never change this file (owner merges only)`); continue; }
    const isBlogPage = /^blog\/[a-z0-9-]+\.html$/.test(f.path) && f.path !== 'blog/index.html';
    const isImage = /^images\/blog\/[a-z0-9._-]+\.(png|jpe?g|webp|svg)$/.test(f.path);
    let ok = false;
    if (kind === 'batch') ok = f.path === 'content-queue.json';
    else if (kind === 'post') {
      const slug = head.slice('content/post-'.length);
      ok = SHARED_REGISTRY.includes(f.path) || f.path === '_redirects' || (isImage && f.status === 'A')
        || (f.path === `blog/${slug}.html` && f.status === 'A');
    } else if (kind === 'edit') {
      const target = head.slice('content/edit-'.length);
      ok = SHARED_REGISTRY.includes(f.path) || (isImage && f.status === 'A') || (f.path === `blog/${target}.html` && f.status === 'M');
    } else if (kind === 'revert') {
      ok = SHARED_REGISTRY.includes(f.path) || (isBlogPage && f.status === 'M');
    }
    if (f.status === 'D') ok = false;
    if (!ok) p.push(`${f.path} (${f.status}): not allowed in a ${kind} PR`);
  }
  return p;
}

// ---------- CLI ----------

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readConfig(root, base) {
  try { return { ...CONFIG_DEFAULTS, ...JSON.parse(git(root, ['show', `${base}:${CONFIG_PATH}`])) }; } catch (e) { return { ...CONFIG_DEFAULTS, missing: true }; }
}

// Article PRs (post/edit/revert) merged into base in the last 7 days, from merge-commit subjects.
function recentArticleMerges(root, base, now) {
  const since = new Date(now - 7 * 86400000).toISOString();
  const out = git(root, ['log', '--first-parent', '--merges', `--since=${since}`, '--format=%s', base]);
  return out.split('\n').filter((s) => /Merge pull request #\d+ from [^/\s]+\/content\/(post|edit|revert)-/.test(s)).length;
}

function lastChangeDays(root, base, file, now) {
  const out = git(root, ['log', '-1', '--format=%cI', base, '--', file]).trim();
  if (!out) return Infinity;
  return (now - Date.parse(out)) / 86400000;
}

function main(argv) {
  const args = argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  const root = path.resolve(opt('--root') || path.join(__dirname, '..'));
  const base = opt('--base');
  const head = opt('--head-ref');
  if (!base || head === undefined) { console.error('Usage: check-automerge.js --base <ref> --head-ref <branch>'); return 2; }
  const kind = classifyBranch(head);
  if (!kind) {
    console.log(`Not a content PR (${head}): never auto-merged; the owner reviews and merges it.`);
    return 0;
  }
  const problems = [];
  if (kind === 'unknown-content') problems.push(`branch "${head}" is not a known content branch (queue-refresh-*, post-*, edit-*, revert-*)`);

  const files = git(root, ['diff', '--name-status', '--no-renames', `${base}...HEAD`]).split('\n').filter(Boolean)
    .map((l) => { const [status, p] = l.split('\t'); return { status: status[0], path: p }; });
  pathProblems(kind, files, head).forEach((x) => problems.push(x));

  const cfg = readConfig(root, base);
  const now = Date.now();
  if (cfg.missing) problems.push(`${CONFIG_PATH} is missing on the base branch: auto-merge is off`);
  else if (cfg.enabled !== true) problems.push(`auto-merge is switched off in ${CONFIG_PATH} (owner's pause switch)`);
  if (kind === 'post' || kind === 'edit') {
    const n = recentArticleMerges(root, base, now);
    if (n >= cfg.max_article_merges_per_7_days) problems.push(`${n} article PRs merged in the last 7 days (cap ${cfg.max_article_merges_per_7_days})`);
  }
  const topFile = `blog/${cfg.top_page}.html`;
  if (kind === 'edit' && files.some((f) => f.path === topFile)) {
    const d = lastChangeDays(root, base, topFile, now);
    if (d < cfg.top_page_min_days_between_edits) problems.push(`${topFile} last changed ${d.toFixed(1)} days ago (min ${cfg.top_page_min_days_between_edits} days between top-page edits)`);
  }

  const blogDir = path.join(root, 'blog');
  const blogSlugs = fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_')).map((f) => f.slice(0, -5));
  const read = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { return ''; } };
  const registry = { sitemap: read('sitemap.xml'), llms: read('llms.txt'), blogIndex: read('blog/index.html'), redirects: read('_redirects') };
  for (const f of files) {
    const m = f.path.match(/^blog\/([a-z0-9-]+)\.html$/);
    if (!m || f.status === 'D') continue;
    let baseMeta = null;
    if (f.status === 'M') {
      try {
        const b = git(root, ['show', `${base}:${f.path}`]);
        const t = b.match(/<title>([\s\S]*?)<\/title>/i);
        baseMeta = { title: t ? decode(t[1]) : null, desc: metaContent(b, 'name', 'description') };
      } catch (e) { baseMeta = null; }
    }
    lintPage(read(f.path), m[1], { blogSlugs, registry, isNew: f.status === 'A', base: baseMeta }).forEach((x) => problems.push(`${f.path}: ${x}`));
  }

  if (problems.length) {
    console.error(`Content PR (${kind}) is NOT eligible for auto-merge:\n  - ${problems.join('\n  - ')}`);
    return 1;
  }
  console.log(`Content PR (${kind}) passes the deterministic auto-merge checks. It still needs the independent reviewer's PASS before the loop merges it.`);
  return 0;
}

module.exports = { lintPage, classifyBranch, pathProblems, readConfig, CONFIG_DEFAULTS, COMBO_TIERS };

if (require.main === module) process.exit(main(process.argv));
