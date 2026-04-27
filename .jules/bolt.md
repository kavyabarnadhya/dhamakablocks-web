## 2026-04-10 - Font Loading Optimization
**Learning:** Using `@import` in CSS blocks is an anti-pattern for performance as it hides the resource from the browser's preload scanner, leading to sequential loading of the HTML, then the CSS, and then the font. Standardizing font weights across pages also improves cache hit rates.
**Action:** Always prefer `<link rel="stylesheet">` over `@import` for external fonts, and use `preconnect` hints for font origins to reduce connection latency. Standardize assets across different routes of a static site to maximize caching efficiency.

## 2026-04-12 - Scroll Performance & Rendering Efficiency
**Learning:** Reading layout properties like `offsetTop` during scroll events causes "Forced Synchronous Layout" (FSL) or "layout thrashing" because the browser must calculate the layout to provide the value. Adding `decoding="async"` to images allows the browser to decode them off the main thread, reducing main thread jank during initial load or scroll.
**Action:** Cache layout-dependent values (like `offsetTop`) outside of high-frequency event handlers (scroll, resize) and update them only when necessary (load, resize). Always provide `width` and `height` to images to prevent Layout Shift (CLS) and use `decoding="async"` for non-critical below-the-fold images.

## 2026-04-13 - High-Frequency Scroll Event Optimization
**Learning:** Even when using `requestAnimationFrame`, redundant DOM writes (like toggling classes that are already present) and DOM reads (like `getAttribute`) inside the scroll handler can cause main thread pressure. Backward iteration for section lookup is more efficient as the active section is typically the one further down.
**Action:** Cache DOM metadata (element references and attributes) outside the scroll handler. Use state tracking to skip redundant DOM updates. Implement backward iteration with early-exit for active section detection.

## 2026-04-15 - Reading Progress Bar Optimization
**Learning:** Calculating `document.documentElement.scrollHeight` inside a scroll handler is a "Forced Synchronous Layout" (FSL) trigger. Even if the calculation is wrapped in `requestAnimationFrame`, performing it on every scroll frame when the document height hasn't changed is wasteful. Additionally, updating `style.width` and `aria-valuenow` on every scroll event, even when the rounded percentage hasn't changed, causes unnecessary DOM pressure.
**Action:** Cache the maximum scrollable height outside the scroll handler (update on `resize` and `load`). Implement a state check (`rounded !== lastScrolled`) to ensure DOM writes only occur when the user has scrolled significantly enough to change the percentage.
