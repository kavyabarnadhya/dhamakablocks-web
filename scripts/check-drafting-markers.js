#!/usr/bin/env node
// Fails the build if a drafting marker is left in PUBLIC authored copy, so a
// reviewer's note to self ("[LEGAL: ...]", TODO, TBD, FIXME, "[CONFIRM ...")
// can't ship on the live site or in the privacy policy. It happened once
// already (#122) and again in the feedback-survey notice.
//
// What is scanned (the copy the deployed site actually serves):
//   * every .html page, including text inside <!-- comments --> (visible in
//     view-source, so a "do not merge until ..." comment is a leak too)
//   * llms.txt
// What is NOT scanned: dot-directories (.git, .github, .jules), node_modules,
// scripts/ (this checker and its tests name the markers on purpose), and
// anything listed in .assetsignore (deploy-time exclusions such as
// blog/_TEMPLATE.html and content-queue.json, which are not public).
//
// Markers (case-insensitive, whole words / tags, never substrings):
//   [LEGAL   [CONFIRM   TODO   TBD   FIXME
// "[LEGAL" and "[CONFIRM" must be followed by a word boundary, so "[LEGALITY]"
// and "[Confirmed]" are not flagged; TODO/TBD/FIXME must stand alone, so
// "Todoist" or "mastodon" are not flagged.
//
// Usage: node scripts/check-drafting-markers.js [--root DIR]
// Exit:  0 clean, 1 markers found (or nothing to scan), 2 bad usage.

'use strict';

const fs = require('fs');
const path = require('path');

const MARKERS = [
  { name: '[LEGAL', pattern: /\[\s*LEGAL\b/gi },
  { name: '[CONFIRM', pattern: /\[\s*CONFIRM\b/gi },
  { name: 'TODO', pattern: /\bTODO\b/gi },
  { name: 'TBD', pattern: /\bTBD\b/gi },
  { name: 'FIXME', pattern: /\bFIXME\b/gi },
];

// Top-level plain-text files served as public copy (HTML is found by walking).
const EXTRA_TEXT_FILES = ['llms.txt'];
const SKIPPED_DIRS = new Set(['node_modules', 'scripts']);

/** All marker hits in `text`: [{ line, col, marker, excerpt }] (1-based). */
function scanText(text) {
  const hits = [];
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((lineText, i) => {
    for (const { name, pattern } of MARKERS) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(lineText))) {
        hits.push({ line: i + 1, col: m.index + 1, marker: name, excerpt: excerptAround(lineText, m.index) });
      }
    }
  });
  return hits.sort((a, b) => a.line - b.line || a.col - b.col);
}

function excerptAround(lineText, index) {
  const start = Math.max(0, index - 30);
  const end = Math.min(lineText.length, index + 90);
  return (start > 0 ? '...' : '') + lineText.slice(start, end).trim() + (end < lineText.length ? '...' : '');
}

/** Entries of .assetsignore: directories (trailing "/") and exact paths. */
function loadAssetsIgnore(root) {
  const file = path.join(root, '.assetsignore');
  if (!fs.existsSync(file)) return { dirs: [], files: new Set() };
  const dirs = [];
  const files = new Set();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith('/')) dirs.push(line.replace(/\/+$/, ''));
    else files.add(line);
  }
  return { dirs, files };
}

function isIgnored(rel, ignore) {
  if (ignore.files.has(rel)) return true;
  return ignore.dirs.some((d) => rel === d || rel.startsWith(d + '/'));
}

/** Public copy files under `root`, as sorted POSIX-style relative paths. */
function findPublicCopyFiles(root) {
  const ignore = loadAssetsIgnore(root);
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (isIgnored(rel, ignore)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) out.push(rel);
    }
  })(root);
  for (const extra of EXTRA_TEXT_FILES) {
    const full = path.join(root, extra);
    if (fs.existsSync(full) && !isIgnored(extra, ignore)) out.push(extra);
  }
  return out.sort();
}

/** Scan `root`; returns { files, findings: [{ file, line, col, marker, excerpt }] }. */
function checkRoot(root) {
  const files = findPublicCopyFiles(root);
  const findings = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const hit of scanText(text)) findings.push({ file, ...hit });
  }
  return { files, findings };
}

// GitHub workflow-command values must escape %, CR and LF.
function escapeCommand(s) {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function formatFinding(f) {
  const message =
    `Drafting marker "${f.marker}" in public copy at ${f.file}:${f.line}:${f.col}: ${f.excerpt} ` +
    `-- remove it, or resolve the open item and then remove it, before merging.`;
  return `::error file=${f.file},line=${f.line},col=${f.col},title=Drafting marker::${escapeCommand(message)}`;
}

function main(argv) {
  let root = path.join(__dirname, '..');
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
    else {
      console.error(`Unknown argument: ${args[i]}\nUsage: node scripts/check-drafting-markers.js [--root DIR]`);
      return 2;
    }
  }

  const { files, findings } = checkRoot(root);

  if (files.length === 0) {
    console.error('No public copy files found to scan -- check the root / site structure.');
    return 1;
  }

  if (findings.length > 0) {
    for (const f of findings) console.error(formatFinding(f));
    console.error(`\n${findings.length} drafting marker(s) in ${new Set(findings.map((f) => f.file)).size} file(s). ` +
      'Public pages must not carry reviewer notes; put open questions in the PR description instead.');
    return 1;
  }

  console.log(`No drafting markers in ${files.length} public copy file(s).`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { MARKERS, scanText, findPublicCopyFiles, checkRoot, formatFinding, main };
