/**
 * Copy-link button for blog post share bars.
 * WhatsApp/Twitter share links are plain <a href> navigations (no JS needed);
 * this script handles the clipboard-copy affordance.
 *
 * Performance Optimization: Event Delegation
 * 1. Uses a single delegated click listener on `document` instead of scanning
 *    the DOM with `querySelectorAll` and binding separate listeners to each button.
 * 2. Eliminates DOM queries during script parsing/execution and works seamlessly
 *    for dynamic content without timing or `DOMContentLoaded` state checks.
 * 3. Uses ES6 arrow functions for internal callbacks.
 */
(() => {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest('.share-copy-btn');
    if (!btn) return;

    const url = btn.getAttribute('data-share-url');
    if (!url) return;

    const label = btn.querySelector('.share-copy-label');
    const originalText = label ? label.textContent : null;

    const showCopied = () => {
      if (label) label.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        if (label && originalText) label.textContent = originalText;
        btn.classList.remove('copied');
      }, 1800);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopied, () => {
        // Clipboard write can fail (permissions, insecure context edge
        // cases) — fall back silently rather than throwing.
      });
    }
  });
})();
