## 2026-04-10 - Font Loading Optimization
**Learning:** Using `@import` in CSS blocks is an anti-pattern for performance as it hides the resource from the browser's preload scanner, leading to sequential loading of the HTML, then the CSS, and then the font. Standardizing font weights across pages also improves cache hit rates.
**Action:** Always prefer `<link rel="stylesheet">` over `@import` for external fonts, and use `preconnect` hints for font origins to reduce connection latency. Standardize assets across different routes of a static site to maximize caching efficiency.

## 2026-04-12 - Scroll Performance & Rendering Efficiency
**Learning:** Reading layout properties like `offsetTop` during scroll events causes "Forced Synchronous Layout" (FSL) or "layout thrashing" because the browser must calculate the layout to provide the value. Adding `decoding="async"` to images allows the browser to decode them off the main thread, reducing main thread jank during initial load or scroll.
**Action:** Cache layout-dependent values (like `offsetTop`) outside of high-frequency event handlers (scroll, resize) and update them only when necessary (load, resize). Always provide `width` and `height` to images to prevent Layout Shift (CLS) and use `decoding="async"` for non-critical below-the-fold images.
