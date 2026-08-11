/* ── Floating particles ──────────────────────────────────── */
(function () {
  /**
   * Performance Optimization: Decorative Particles
   * 1. Skips particles if user prefers reduced motion for accessibility.
   * 2. Defers execution using requestIdleCallback to prioritize critical rendering.
   * 3. Implements adaptive count (12 for mobile, 22 for desktop) to save memory.
   * Expected Impact: Reduces Long Tasks during load by moving non-critical DOM work.
   */
  const initParticles = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const colors = ['#FF9933', '#FFD700', '#00827F', '#C41E3A', '#FF6B35'];
    const wrap = document.getElementById('particles');
    if (!wrap) return;

    const frag = document.createDocumentFragment();
    // Adaptive count: 12 on small screens, 22 on desktop
    const count = window.innerWidth < 480 ? 12 : 22;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 6 + 3;
      p.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration: ${Math.random() * 12 + 8}s;
        animation-delay: ${Math.random() * 10}s;
      `;
      frag.appendChild(p);
    }
    wrap.appendChild(frag);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initParticles, { timeout: 2000 });
  } else {
    setTimeout(initParticles, 500);
  }
})();

/* ── Sticky nav & Scroll-Spy ─────────────────────────────── */
(function () {
  const nav = document.getElementById('nav');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  // Cache nav link data to avoid repeated DOM reads during scroll
  const linkData = Array.from(navLinks).map(link => ({
    el: link,
    href: link.getAttribute('href'),
    active: false // State tracking: avoid redundant DOM reads
  }));
  let ticking = false;
  let lastCurrent = null;
  let navVisible = false;

  // Cache section offsets to avoid Forced Synchronous Layout (FSL) during scroll
  let sectionOffsets = [];
  function updateOffsets() {
    sectionOffsets = Array.from(sections).map(section => ({
      id: section.id, // Direct property access is faster than getAttribute
      top: section.offsetTop - 100
    }));
  }

  // Performance: Debounce resize events to prevent layout thrashing
  function debounce(fn, ms) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  updateOffsets();
  window.addEventListener('resize', debounce(updateOffsets, 100));
  window.addEventListener('load', updateOffsets);
  // Ensure accurate offsets after typography is settled
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateOffsets);
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        const scrollY = window.scrollY;

        // Visibility toggle: Only update DOM when state changes
        const shouldBeVisible = scrollY > 100;
        if (shouldBeVisible !== navVisible) {
          nav.classList.toggle('visible', shouldBeVisible);
          navVisible = shouldBeVisible;
        }

        // Scroll-Spy using cached offsets and backward iteration for early exit
        let current = "";
        for (let i = sectionOffsets.length - 1; i >= 0; i--) {
          if (scrollY >= sectionOffsets[i].top) {
            current = sectionOffsets[i].id;
            break;
          }
        }

        // Only update link classes if the active section has changed
        if (current !== lastCurrent) {
          lastCurrent = current;
          const hash = '#' + current;

          for (let i = 0; i < linkData.length; i++) {
            const item = linkData[i];
            const shouldBeActive = item.href === hash;

            // Only update DOM if the state has changed (state tracking)
            if (item.active !== shouldBeActive) {
              item.active = shouldBeActive;
              if (shouldBeActive) {
                item.el.classList.add('active');
                item.el.setAttribute('aria-current', 'page');
              } else {
                item.el.classList.remove('active');
                item.el.removeAttribute('aria-current');
              }
            }
          }
        }

        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

/* ── Smooth scroll: hero arrow → beta section ────────────── */
(function () {
  const arrow = document.getElementById('scrollArrow');
  const beta  = document.getElementById('beta');
  if (!arrow || !beta) return;
  function scrollToBeta() {
    // Performance & Accessibility: Respect user motion preferences
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    beta.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth' });
  }
  arrow.addEventListener('click', scrollToBeta);
  arrow.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') scrollToBeta();
  });
})();


/* ── Scroll reveal (IntersectionObserver) ────────────────── */
(function () {
  /**
   * Performance Optimization: Scroll Reveal
   * 1. Uses IntersectionObserver for efficient scroll tracking.
   * 2. Defers initialization using requestIdleCallback to move non-critical DOM work out of the load sequence.
   * 3. Calls unobserve() after reveal to stop tracking and reduce main thread overhead.
   * Expected Impact: Reduces TBT during load by prioritizing critical rendering over decorative reveals.
   */
  const initReveal = () => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => observer.observe(el));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initReveal, { timeout: 2000 });
  } else {
    setTimeout(initReveal, 500);
  }
})();
