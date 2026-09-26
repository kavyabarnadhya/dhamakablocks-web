#!/usr/bin/env node
// Fails the build if any Play Store link on the site is missing UTM tracking
// params, so a new page/post can't ship a bare, unattributed store link.
//
// Convention (see CLAUDE.md / homepage CTA):
//   Homepage:    utm_source=home  utm_medium=cta                     utm_campaign=homepage
//   Blog posts:  utm_source=blog  utm_medium=nav|cta|sticky|...      utm_campaign=<post-slug>
//   Other pages: any non-empty utm_source/utm_medium/utm_campaign
//
// Usage: node scripts/check-play-store-utm.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HREF_PATTERN = /<a\s+[^>]*href="([^"]*play\.google\.com[^"]*)"/g;

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== '_TEMPLATE.html') {
      out.push(full);
    }
  }
  return out;
}

function checkLink(relFile, href) {
  const problems = [];
  const query = href.split('?')[1] || '';
  const params = new URLSearchParams(query);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');

  if (!utmSource) problems.push('missing utm_source');
  if (!utmMedium) problems.push('missing utm_medium');
  if (!utmCampaign) problems.push('missing utm_campaign');
  if (problems.length) return problems;

  if (relFile === 'index.html') {
    if (utmSource !== 'home') problems.push(`utm_source="${utmSource}" (expected "home")`);
    if (utmCampaign !== 'homepage') problems.push(`utm_campaign="${utmCampaign}" (expected "homepage")`);
  } else if (relFile.startsWith('blog' + path.sep)) {
    if (utmSource !== 'blog') problems.push(`utm_source="${utmSource}" (expected "blog")`);
    const slug = path.basename(relFile, '.html');
    const expectedCampaign = slug === 'index' ? 'blog-index' : slug;
    if (utmCampaign !== expectedCampaign) {
      problems.push(`utm_campaign="${utmCampaign}" (expected "${expectedCampaign}")`);
    }
  }

  return problems;
}

const files = findHtmlFiles(ROOT);
let failures = 0;
let linksChecked = 0;

for (const file of files) {
  const relFile = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  let match;
  HREF_PATTERN.lastIndex = 0;
  while ((match = HREF_PATTERN.exec(content))) {
    const href = match[1];
    linksChecked++;
    const problems = checkLink(relFile, href);
    if (problems.length) {
      failures++;
      console.error(`::error file=${relFile}::Play Store link missing/incorrect UTM tags: ${problems.join(', ')}\n    ${href}`);
    }
  }
}

if (linksChecked === 0) {
  console.error('No Play Store links found on the site — check HREF_PATTERN / site structure.');
  process.exit(1);
}

if (failures > 0) {
  console.error(`\n${failures} of ${linksChecked} Play Store link(s) failed UTM validation.`);
  process.exit(1);
}

console.log(`All ${linksChecked} Play Store link(s) across ${files.length} page(s) carry correct UTM tags.`);
