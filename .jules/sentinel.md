# Sentinel's Journal - Critical Security Learnings Only

This journal contains only CRITICAL security learnings as per the Sentinel's mission. Routine work is not logged here.

## 2026-04-10 - Baseline Hardening for Static Pages
**Vulnerability:** Exposure to cross-origin isolation attacks (Spectre) and potential form-action hijacking.
**Learning:** Static landing pages without interactive forms can be significantly hardened using 'form-action none' and 'frame-ancestors none' alongside isolation headers like COOP/CORP.
**Prevention:** Always enforce a 'deny-by-default' posture for forms and framing in the security header baseline for static assets.
