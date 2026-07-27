/**
 * Dhamaka Blocks - Blog Performance Utilities
 * This file handles performance-optimized features across all blog pages:
 * 1. Reading Progress Bar: Uses compositor-thread scaleX transforms instead of layouts/repaints with width.
 *    Caches maxScroll height and debounces resize events to avoid Forced Synchronous Layout (FSL).
 * 2. Scroll Reveal (IntersectionObserver): Defers scroll-tracking with requestIdleCallback,
 *    and unobserves elements after they reveal to minimize scroll-event CPU cost.
 *
 * This consolidated script is deferred and cached by the browser, reducing initial HTML document size
 * and network load for returning users.
 */

(() => {
  // ── 1. Reading Progress Bar ──
  const bar = document.getElementById('reading-progress');
  if (bar) {
    let ticking = false;
    let lastScrolled = -1;
    let maxScroll = 0;

    const updateMaxScroll = () => {
      maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    };

    const debounce = (fn, ms) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
      };
    };

    updateMaxScroll();
    window.addEventListener('resize', debounce(updateMaxScroll, 100));
    window.addEventListener('load', updateMaxScroll);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateMaxScroll);
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const winScroll = window.scrollY;
          const scrolled = maxScroll > 0 ? (winScroll / maxScroll) * 100 : 0;
          const rounded = Math.round(scrolled);

          if (rounded !== lastScrolled) {
            bar.style.transform = `scaleX(${(scrolled / 100).toFixed(3)})`;
            bar.setAttribute('aria-valuenow', rounded);
            lastScrolled = rounded;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ── 2. Scroll Reveal ──
  const initReveal = () => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    els.forEach((el) => observer.observe(el));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initReveal, { timeout: 2000 });
  } else {
    setTimeout(initReveal, 500);
  }
})();
