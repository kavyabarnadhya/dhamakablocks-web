'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'festival/diwali.html'), 'utf8');
test('festival route has one title, canonical, main landmark and home navigation', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes('<main id="main">'));
  assert.ok(html.includes('href="#main"'));
  assert.ok(html.includes('rel="canonical" href="https://dhamakablocks.com/festival/diwali"'));
  assert.ok(html.includes('class="brand" href="/"'));
});
test('does not advertise an unreleased event or unapproved economy', () => {
  assert.doesNotMatch(html, /125 coins|25 coins|175 coins|limited-time theme|claim your|bonus coins|event is live/i);
  assert.match(html, /Contains ads/);
});
test('share card is a real 1200 by 630 PNG with OG and download references', () => {
  const img = fs.readFileSync(path.join(root, 'images/festival/diwali-share-2026.png'));
  assert.equal(img.subarray(1, 4).toString(), 'PNG');
  assert.equal(img.readUInt32BE(16), 1200);
  assert.equal(img.readUInt32BE(20), 630);
  assert.match(html, /og:image.*diwali-share-2026.png/);
  assert.match(html, /download="dhamaka-diwali-2026.png"/);
});
test('WhatsApp shares exact page and stays a user-initiated link', () => {
  const href = html.match(/id="whatsapp-share" href="([^"]+)"/)[1];
  const url = new URL(href);
  assert.equal(url.hostname, 'wa.me');
  assert.match(url.searchParams.get('text'), /https:\/\/dhamakablocks.com\/festival\/diwali$/);
  assert.doesNotMatch(html, /window\.open|location\.href|sendMessage/);
});
test('reuses consent and copy helpers and exposes cookie preferences', () => {
  assert.match(html, /src="\/js\/analytics.js" defer/);
  assert.match(html, /src="\/js\/share.js" defer/);
  assert.match(html, /id="cookie-prefs-link"/);
  assert.match(html, /data-share-url="https:\/\/dhamakablocks.com\/festival\/diwali"/);
});
test('exact brand fonts and palette, responsive styles and no inline script execution', () => {
  assert.match(html, /family=Baloo\+2/); assert.match(html, /family=Poppins/);
  for (const hex of ['#FF9933','#FFD700','#8B0000','#00827F','#1A0A00','#2D1400','#FFFFF0','#CCBB99']) assert.ok(html.includes(hex));
  assert.match(html, /@media\(max-width:700px\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
});
test('Diwali weekday is correct and page is discoverable in sitemap', () => {
  assert.equal(new Date('2026-11-08T00:00:00Z').getUTCDay(), 0);
  assert.match(html, /Sunday, 8 November 2026/);
  assert.ok(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes('<loc>https://dhamakablocks.com/festival/diwali</loc>'));
});
