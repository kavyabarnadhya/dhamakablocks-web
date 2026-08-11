# Sentinel's Journal - Critical Security Learnings Only

This journal contains only CRITICAL security learnings as per the Sentinel's mission. Routine work is not logged here.

## 2026-04-10 - Baseline Hardening for Static Pages
**Vulnerability:** Exposure to cross-origin isolation attacks (Spectre) and potential form-action hijacking.
**Learning:** Static landing pages without interactive forms can be significantly hardened using 'form-action none' and 'frame-ancestors none' alongside isolation headers like COOP/CORP.
**Prevention:** Always enforce a 'deny-by-default' posture for forms and framing in the security header baseline for static assets.

## 2026-04-11 - Permissions-Policy Hardening and Tooling Constraints
**Vulnerability:** Unnecessarily broad browser feature permissions increasing the potential attack surface.
**Learning:** Hardening `Permissions-Policy` to disable modern browser features (e.g., `shared-storage`, `captured-surface-control`) is an effective defense-in-depth measure. However, managing extremely long header lines (1200+ characters) in configuration files like `_headers` can exceed LLM tool output limits, requiring targeted string manipulation (e.g., `sed`, `cut`) to read and verify the state accurately.
**Prevention:** Standardize a comprehensive `Permissions-Policy` deny-list for all static projects and use robust line-parsing techniques for header configuration management.

## 2026-05-18 - Enhanced Permissions-Policy Hardening
**Vulnerability:** Potential attack surface from modern browser features (fenced frames) and legacy SOP bypasses (document.domain).
**Learning:** Hardening the `Permissions-Policy` beyond the standard set to include `document-domain`, `fenced-frame-api`, and execution throttling directives (`execution-while-not-rendered`, `execution-while-out-of-viewport`) provides a more robust defense-in-depth posture for static sites.
**Prevention:** Explicitly disable `document-domain`, `fenced-frame-api`, and background execution in the global security header configuration.

## 2026-07-22 - Inline JSON-LD is Safe Under Trusted Types
**Vulnerability:** Uncertainty over whether adding `<script type="application/ld+json">` structured-data blocks (for SEO/AEO — Article, FAQPage, HowTo, BreadcrumbList, VideoGame schemas) would be blocked by this site's `require-trusted-types-for 'script'` CSP directive, or require a `_headers`/CSP change.
**Learning:** Trusted Types governs *executable* script sinks (`innerHTML`, `eval`, dynamically injected `<script>` with executable content) — it does not gate static inline JSON-LD data blocks already present at parse time, and `script-src 'self' 'unsafe-inline'` already permits inline `<script>` tags regardless. JSON-LD added no new external origin and required zero `_headers` changes.
**Prevention:** When adding schema.org structured data to a Trusted-Types-hardened page, confirm the CSP already allows inline script (`'unsafe-inline'` or a matching nonce/hash) and remember Trusted Types only restricts sinks that execute strings as code — data blocks are unaffected.

## 2026-08-11 - Complete Elimination of Inline Script Execution (XSS Mitigation)
**Vulnerability:** Retention of the 'unsafe-inline' CSP directive for script-src to support inline interactive scripts on index.html, leaving the site susceptible to potential inline script injection (XSS) attacks.
**Learning:** Consolidating and moving all executable inline scripts from HTML pages to standalone, deferred JavaScript files (e.g. `/js/home.js`) enables the total removal of 'unsafe-inline' from Content-Security-Policy (CSP) script-src, providing robust XSS mitigation and improved page load performance through browser caching.
**Prevention:** Enforce a strict zero-inline-scripts standard for all static landing and marketing pages, allowing 'unsafe-inline' to be completely removed from the CSP script-src directive.
