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
