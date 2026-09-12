#!/usr/bin/env node
// Warns (does not fail the build) when a blog post's body content changed in
// this diff but its own dateModified/article:modified_time did not move —
// a stale freshness signal search engines and AEO crawlers penalize.
//
// Deliberately does not auto-fix or block: whether a diff is "real content"
// vs cosmetic (e.g. a footer link added site-wide) is an editorial call, not
// a mechanical one. This only flags the mismatch for a human to judge.
//
// Usage: node scripts/check-modified-dates.js <base-ref>
// Compares each changed blog/*.html file against <base-ref>.

const { execSync } = require('child_process');

const baseRef = process.argv[2];
if (!baseRef) {
  console.error('Usage: node scripts/check-modified-dates.js <base-ref>');
  process.exit(2);
}

const DATE_LINE_PATTERN = /"dateModified"|article:modified_time|<lastmod>/;

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

let changedFiles;
try {
  changedFiles = sh(`git diff --name-only ${baseRef}...HEAD -- "blog/*.html"`)
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f && !f.endsWith('_TEMPLATE.html'));
} catch (err) {
  console.error('Could not diff against base ref:', err.message);
  process.exit(2);
}

if (changedFiles.length === 0) {
  console.log('No blog post files changed — nothing to check.');
  process.exit(0);
}

let flagged = [];

for (const file of changedFiles) {
  let oldContent, newContent;
  try {
    oldContent = sh(`git show ${baseRef}:${file}`);
  } catch {
    // New file in this diff — no prior version to compare dates against.
    continue;
  }
  try {
    newContent = sh(`git show HEAD:${file}`);
  } catch {
    continue; // File deleted in this diff.
  }

  const stripDateLines = (text) =>
    text
      .split('\n')
      .filter((line) => !DATE_LINE_PATTERN.test(line))
      .join('\n');

  const bodyChanged = stripDateLines(oldContent) !== stripDateLines(newContent);
  if (!bodyChanged) continue;

  const extractDates = (text) => {
    const m1 = text.match(/"dateModified":\s*"([^"]+)"/);
    const m2 = text.match(/article:modified_time"\s+content="([^"]+)"/);
    return { dateModified: m1 && m1[1], articleModified: m2 && m2[1] };
  };

  const oldDates = extractDates(oldContent);
  const newDates = extractDates(newContent);

  const dateModifiedBumped = oldDates.dateModified !== newDates.dateModified;
  const articleModifiedBumped = oldDates.articleModified !== newDates.articleModified;

  if (!dateModifiedBumped || !articleModifiedBumped) {
    flagged.push({ file, oldDates, newDates, dateModifiedBumped, articleModifiedBumped });
  }
}

if (flagged.length === 0) {
  console.log('All changed blog posts with body edits have an updated dateModified/article:modified_time.');
  process.exit(0);
}

console.log('::warning::Some changed blog posts may need their dateModified/article:modified_time bumped:');
for (const f of flagged) {
  console.log(`\n  ${f.file}`);
  if (!f.dateModifiedBumped) {
    console.log(`    JSON-LD dateModified unchanged: ${f.newDates.dateModified || '(not found)'}`);
  }
  if (!f.articleModifiedBumped) {
    console.log(`    article:modified_time unchanged: ${f.newDates.articleModified || '(not found)'}`);
  }
}
console.log('\nIf this diff is a real content/fact change, bump the date(s) above and the matching <lastmod> in sitemap.xml.');
console.log('If this diff is cosmetic (e.g. a site-wide footer/nav change), no action needed — this is a warning, not a failure.');

// Warn-only: never fail the build. Editorial judgment call, not a mechanical one.
process.exit(0);
