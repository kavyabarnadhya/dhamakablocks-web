# Palette's Journal - Critical UX/Accessibility Learnings Only

## 2025-05-14 - Navigation and Accessibility Baseline
**Learning:** For single-page landing sites, navigation should not only be sticky but also functional as a "return to home" mechanism. Keyboard users often struggle with long-scrolling pages without "Skip to Content" links and clear focus indicators.
**Action:** Always ensure the navigation logo is a link and that a Skip Link is provided for accessibility.

## 2026-04-14 - Dark Theme Contrast and Motion
**Learning:** Dark-themed interfaces often struggle with WCAG contrast requirements for secondary text. Low-opacity text on dark backgrounds significantly impacts legibility. Additionally, smooth scrolling and decorative animations must be explicitly opt-in for users without motion sensitivities.
**Action:** Use opacities of at least 0.6 for secondary text on dark backgrounds and always wrap motion-based styles in `@media (prefers-reduced-motion: no-preference)`.
