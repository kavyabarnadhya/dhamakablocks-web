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
    // Security: Validate that url is a safe HTTP(S) URL to prevent clipboard
    // poisoning or malicious scheme injection (e.g. javascript:, data:, file:)
    if (!url || !/^https?:\/\//i.test(url.trim())) return;

    const label = btn.querySelector('.share-copy-label');
    if (!btn._originalText && label) {
      btn._originalText = label.textContent;
    }
    const originalText = btn._originalText;

    if (btn._copyTimeout) {
      clearTimeout(btn._copyTimeout);
    }

    const showCopied = () => {
      if (label) {
        label.setAttribute('aria-live', 'polite');
        label.textContent = 'Copied!';
      }
      btn.classList.add('copied');
      btn._copyTimeout = setTimeout(() => {
        if (label && originalText) {
          label.textContent = originalText;
          label.removeAttribute('aria-live');
        }
        btn.classList.remove('copied');
        btn._copyTimeout = null;
      }, 1800);
    };

    const fallbackCopy = (text) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success ? Promise.resolve() : Promise.reject();
      } catch (err) {
        return Promise.reject(err);
      }
    };

    const copyToClipboard = (text) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      }
      return fallbackCopy(text);
    };

    copyToClipboard(url).then(showCopied, () => {});
  });
})();
