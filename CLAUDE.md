# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static marketing website for "Dhamaka Blocks" (India-themed block puzzle game), deployed via Cloudflare Workers. No build step, no package manager, no framework — HTML/CSS/JS files are served directly from the repository root.

## Deployment

```bash
wrangler deploy
```

There are no build, lint, or test commands. Files are served as-is.

## Architecture

All pages are self-contained HTML files with inline `<style>` and `<script>` tags — no shared templates or component system. Changes to shared UI (nav, footer) must be replicated across all files manually.

- `index.html` — Main landing page (hero, features, blog preview, footer)
- `privacy.html` — Privacy policy
- `blog/index.html` — Blog hub; individual posts are separate HTML files
- `_headers` — Cloudflare-enforced security and caching headers
- `wrangler.jsonc` — Cloudflare Workers deployment config (assets served from root)

## Security Headers (`_headers`)

The CSP is hardened with a deny-by-default posture: `form-action: none`, `frame-ancestors: none`, COOP/CORP isolation. Allowed origins are limited to self, Google Fonts, and Cloudflare Insights. Any new external resource (script, font, image CDN) requires a corresponding CSP directive update in `_headers`.

## Performance Patterns

From `.jules/bolt.md` — patterns already established in the codebase:
- Use `<link rel="preload">` for fonts, not `@import` in CSS
- Images use `decoding="async"` with explicit `width`/`height` attributes
- Scroll handlers use `requestAnimationFrame` with state-tracking to avoid redundant DOM writes (FSL prevention)
- Cache DOM references outside scroll/event callbacks

## UX/Accessibility Conventions

From `.jules/palette.md`:
- Dark theme secondary text: minimum 0.6 opacity for contrast
- Animations must respect `prefers-reduced-motion`
- Navigation should always include a home link (logo or explicit link)

## Project Journals (`.jules/`)

The `.jules/` directory contains three running logbooks for this project. **Update the relevant logbook** when making significant changes:
- `bolt.md` — Performance learnings
- `palette.md` — UX and accessibility learnings
- `sentinel.md` — Security learnings
