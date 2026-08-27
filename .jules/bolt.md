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

## 2026-04-16 - Resize Event Debouncing & Font-Ready Timing
**Learning:** Frequent `resize` events can trigger expensive layout calculations (like `offsetTop` or `scrollHeight`) dozens of times per second, causing layout thrashing and main-thread pressure. Additionally, calculating offsets before fonts are loaded can lead to inaccurate values after typography reflows.
**Action:** Always debounce `resize` event handlers that perform layout reads. Use `document.fonts.ready.then()` to ensure layout-dependent metadata is recalculated as soon as the text layout is stable.

## 2026-04-18 - Compositor Layer Promotion & Deferred Rendering
**Learning:** Promoting fixed backgrounds with `will-change: transform` prevents expensive full-page repaints during scroll by creating a separate compositor layer. `content-visibility: auto` with `contain-intrinsic-size: auto [height]` significantly reduces initial rendering cost by skipping the layout and paint of below-the-fold sections until they are needed.
**Action:** Use `will-change: transform` on fixed/sticky elements that don't change frequently to isolate them from scroll repaints. Apply `content-visibility: auto` to heavy below-the-fold sections and provide a plausible intrinsic size to prevent layout shifts.

## 2026-04-20 - Decorative Script Deferral & Adaptive Workloads
**Learning:** Initializing non-critical decorative elements (like particles) during the load sequence increases Total Blocking Time (TBT) and delays the First Contentful Paint. Deferring this work using `requestIdleCallback` allows the browser to prioritize critical path rendering. Additionally, implementing adaptive resource counts for mobile devices reduces the number of compositor layers and memory pressure on lower-end hardware.
**Action:** Always defer non-essential DOM manipulations using `requestIdleCallback` (with a `setTimeout` fallback). Use viewport-based conditional logic to scale the complexity of decorative effects, ensuring a smooth experience across all device tiers.

## 2026-04-22 - Strategic Resource Prioritization
**Learning:** Using `fetchpriority="high"` on render-blocking font stylesheets allows the browser to prioritize them over other non-critical assets (like background images or deferred scripts), reducing the Time to First Meaningful Paint. Combining this with `dns-prefetch` for the font origin further reduces the critical path latency by resolving the domain early.
**Action:** Use `fetchpriority="high"` for critical CSS and fonts in the `<head>`. Always implement `dns-prefetch` for external font providers (e.g., `fonts.gstatic.com`) to minimize DNS resolution time during the resource discovery phase.

## 2026-04-24 - Content Visibility & Font-Aware Progress Bars
**Learning:** `content-visibility: auto` is highly effective for deferring the rendering of heavy footer components and related article grids, reducing initial paint costs. For scroll-progress indicators, calculating offsets must wait for `document.fonts.ready` to prevent inaccuracies caused by font-related layout shifts. Layer promotion (`will-change: transform`) on sticky CTAs prevents redundant repaints of the article content during scroll.
**Action:** Default to `content-visibility: auto` for complex below-the-fold components like footers and article grids. Wrap all layout-dependent initialization logic for progress bars or scroll-spy in `document.fonts.ready`. Use `will-change: transform` to promote sticky call-to-action elements to their own compositor layers.

## 2026-08-10 - Initial Page Load Layout Deferral
**Learning:** Querying layout-dependent properties like `offsetTop` or `scrollHeight` immediately during page load or script execution (even with `defer` scripts) forces the browser to run a synchronous layout and style calculation pass during the HTML parsing phase, increasing First Contentful Paint (FCP) and blocking the main thread.
**Action:** Always wrap initial, immediate layout and viewport queries inside `window.requestAnimationFrame()` or defer them until after the DOM parsing is completed to protect the critical rendering path.

## 2026-08-24 - Static JavaScript Immutable Caching
**Learning:** External JavaScript assets served without explicit `Cache-Control` headers force browser revalidation requests (`304 Not Modified`) on every page navigation or return visit. Enforcing immutable long-term caching (`max-age=31536000, immutable`) for static `/js/*` bundles eliminates redundant HTTP revalidation round-trips across all routes.
**Action:** Always configure `Cache-Control: public, max-age=31536000, immutable` in `_headers` for static JavaScript assets (`/js/*`) alongside image assets (`/images/*`) to maximize browser cache utilization across sessions.
