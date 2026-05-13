# Palette's Journal - Critical UX/Accessibility Learnings Only

## 2025-05-14 - Navigation and Accessibility Baseline
**Learning:** For single-page landing sites, navigation should not only be sticky but also functional as a "return to home" mechanism. Keyboard users often struggle with long-scrolling pages without "Skip to Content" links and clear focus indicators.
**Action:** Always ensure the navigation logo is a link and that a Skip Link is provided for accessibility.

## 2026-04-14 - Dark Theme Contrast and Motion
**Learning:** Dark-themed interfaces often struggle with WCAG contrast requirements for secondary text. Low-opacity text on dark backgrounds significantly impacts legibility. Additionally, smooth scrolling and decorative animations must be explicitly opt-in for users without motion sensitivities.
**Action:** Use opacities of at least 0.65 for secondary text on dark backgrounds to ensure WCAG AA compliance and always wrap motion-based styles in `@media (prefers-reduced-motion: no-preference)`.

## 2025-05-15 - Blog UX and Reading Indicators
**Learning:** For content-heavy pages like blog posts, providing a visual reading progress indicator adds a touch of delight and helps users manage their expectations. High-contrast secondary text (0.65+ opacity) is essential for long-form readability in dark themes.
**Action:** Implement a performant (rAF-based) progress bar in the sticky header for all blog posts and ensure all meta-text meets contrast standards.

## 2025-05-16 - Tactile Feedback and A11y Consistency
**Learning:** Secondary navigation hubs (like the Blog index) often lag behind the main landing page in terms of accessibility and interaction polish. Tactile `:active` states (slight transforms) significantly improve the perceived responsiveness of buttons and cards.
**Action:** Ensure all interactive elements have `:focus-visible` and `:active` states, and always provide a "Skip to main content" link on every top-level page.

## 2026-05-17 - Breadcrumbs and Content Expectations
**Learning:** For content-driven hubs, a simple "Back" link is often insufficient for hierarchical navigation. Users benefit from breadcrumbs that clearly define the path (e.g., Home / All Guides). Additionally, providing estimated reading times on both index cards and individual posts helps users commit to long-form content by setting clear expectations.
**Action:** Implement breadcrumb patterns in the header of nested pages and include reading time estimates (approx. 200 wpm) for all editorial content.
