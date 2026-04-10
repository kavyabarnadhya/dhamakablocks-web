## 2026-04-10 - Font Loading Optimization
**Learning:** Using `@import` in CSS blocks is an anti-pattern for performance as it hides the resource from the browser's preload scanner, leading to sequential loading of the HTML, then the CSS, and then the font. Standardizing font weights across pages also improves cache hit rates.
**Action:** Always prefer `<link rel="stylesheet">` over `@import` for external fonts, and use `preconnect` hints for font origins to reduce connection latency. Standardize assets across different routes of a static site to maximize caching efficiency.
