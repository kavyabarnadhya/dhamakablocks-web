// Copy-link button for blog post share bars. WhatsApp/Twitter share links
// are plain <a href> navigations (no JS needed); this only handles the
// clipboard-copy affordance, which requires script.
(function () {
  function initShareCopyButtons() {
    var buttons = document.querySelectorAll('.share-copy-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = btn.getAttribute('data-share-url');
        if (!url) return;
        var label = btn.querySelector('.share-copy-label');
        var originalText = label ? label.textContent : null;

        function showCopied() {
          if (label) label.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            if (label && originalText) label.textContent = originalText;
            btn.classList.remove('copied');
          }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showCopied, function () {
            // Clipboard write can fail (permissions, insecure context edge
            // cases) — fall back silently rather than throwing.
          });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareCopyButtons);
  } else {
    initShareCopyButtons();
  }
})();
