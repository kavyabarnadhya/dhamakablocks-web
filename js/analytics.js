// Google Analytics (GA4) loader with Consent Mode v2.
// gtag.js itself is only fetched once the user grants consent (Basic Consent
// Mode) — no request to Google happens before a decision is made. Consent
// choice persists in localStorage and can be reopened via any element with
// id="cookie-prefs-link" (see footer link on every page).
(function () {
  var GA_ID = 'G-8RS9296QXS';
  var CONSENT_KEY = 'dhamaka-ga-consent';
  var scriptLoaded = false;
  var lastFocused = null;

  // Attached first, before anything that can throw (e.g. localStorage in
  // Safari private mode), so the reopen link always works even if consent
  // persistence fails.
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'cookie-prefs-link') {
      e.preventDefault();
      showBanner();
    }
  });

  // Dynamically decorate the Cookie Preferences footer link to be a semantic
  // dialog trigger for screen readers and keyboard users.
  function setupPrefsLink() {
    var prefsLink = document.getElementById('cookie-prefs-link');
    if (prefsLink) {
      prefsLink.setAttribute('role', 'button');
      prefsLink.setAttribute('aria-haspopup', 'dialog');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPrefsLink);
  } else {
    setupPrefsLink();
  }

  function readConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (err) {
      // Storage unavailable (private browsing, blocked cookies, etc.) —
      // consent still applies for this page load via Consent Mode below.
    }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('consent', 'default', { analytics_storage: 'denied' });

  var GTAG_URL = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  var ttPolicy = null;
  if (window.trustedTypes && trustedTypes.createPolicy) {
    // _headers CSP sets trusted-types to this exact policy name — the
    // createScriptURL check below is the only thing allowed to produce a
    // script URL on this page, and it only ever accepts this one GA URL.
    ttPolicy = trustedTypes.createPolicy('dhamaka-ga-loader', {
      createScriptURL: function (url) {
        if (url !== GTAG_URL) throw new Error('Blocked unexpected script URL');
        return url;
      }
    });
  }

  // gtag('js'/'config') are only queued once consent is actually granted —
  // they must come *after* the 'consent update: granted' call in dataLayer,
  // otherwise gtag.js processes 'config' while still seeing denied consent
  // (queue order, not real time, is what the library replays) and never
  // sends the initial page_view even after consent flips to granted.
  function loadGtagScript() {
    if (scriptLoaded) return;
    scriptLoaded = true;
    gtag('js', new Date());
    gtag('config', GA_ID);
    var script = document.createElement('script');
    script.async = true;
    script.src = ttPolicy ? ttPolicy.createScriptURL(GTAG_URL) : GTAG_URL;
    document.head.appendChild(script);
  }

  function grant() {
    writeConsent('granted');
    gtag('consent', 'update', { analytics_storage: 'granted' });
    loadGtagScript();
  }

  function deny() {
    writeConsent('denied');
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  function showBanner() {
    if (document.getElementById('dhamaka-cookie-banner')) return;
    lastFocused = document.activeElement;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Insert dynamic styles for hover, active, focus states and smooth entrance/exit transitions
    var style = document.createElement('style');
    style.id = 'dhamaka-cookie-styles';
    style.textContent =
      '#dhamaka-cookie-banner button { transition: background 0.25s ease, border-color 0.25s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease, outline-color 0.25s ease; }' +
      '#dhamaka-cookie-banner button:hover { transform: translateY(-1.5px); }' +
      '#dhamaka-cookie-banner button:active { transform: translateY(0) scale(0.96); }' +
      '#dhamaka-cookie-banner button.primary:hover { background: #ffe066 !important; box-shadow: 0 4px 12px rgba(245, 197, 66, 0.35); }' +
      '#dhamaka-cookie-banner button.secondary:hover { background: rgba(255,255,255,0.08) !important; color: #ffffff !important; border-color: #f5c542 !important; }' +
      '#dhamaka-cookie-banner button:focus-visible { outline: 3px solid #f5c542 !important; outline-offset: 3px !important; }' +
      '#dhamaka-cookie-banner a { transition: color 0.25s ease; }' +
      '#dhamaka-cookie-banner a:hover, #dhamaka-cookie-banner a:focus-visible { color: #ffe066 !important; }';
    document.head.appendChild(style);

    var banner = document.createElement('div');
    banner.id = 'dhamaka-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('tabindex', '-1');
    banner.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'background:#1a1a1a;color:#f5f5f5;padding:16px 20px;' +
      'display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;' +
      'font-family:system-ui,sans-serif;font-size:14px;line-height:1.4;' +
      'box-shadow:0 -2px 12px rgba(0,0,0,0.3);' +
      (reduceMotion ? '' : 'transition:transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);transform:translateY(100%);');

    var text = document.createElement('span');
    text.style.cssText = 'flex:1;min-width:200px;opacity:0.9;';
    text.textContent = 'We use Google Analytics to understand site traffic. See our ';

    var link = document.createElement('a');
    link.href = '/privacy';
    link.textContent = 'Privacy Policy';
    link.style.cssText = 'color:#f5c542;text-decoration:underline;';
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    function closeBanner() {
      if (reduceMotion) {
        banner.remove();
        cleanup();
      } else {
        banner.style.transform = 'translateY(100%)';
        banner.addEventListener('transitionend', function handler() {
          banner.remove();
          cleanup();
        }, { once: true });
      }
    }

    function cleanup() {
      document.removeEventListener('keydown', onKeydown, true);
      var styleEl = document.getElementById('dhamaka-cookie-styles');
      if (styleEl) styleEl.remove();
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    function makeButton(label, onClick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      var isPrimary = label === 'Accept';
      btn.className = isPrimary ? 'primary' : 'secondary';
      btn.style.cssText =
        'padding:8px 16px;border-radius:6px;border:none;cursor:pointer;font-size:14px;font-weight:600;' +
        (isPrimary ? 'background:#f5c542;color:#1a1a1a;' : 'background:transparent;color:#f5f5f5;border:1px solid #666;');
      btn.addEventListener('click', function () {
        onClick();
        closeBanner();
      });
      return btn;
    }

    var rejectBtn = makeButton('Reject', deny);
    var acceptBtn = makeButton('Accept', grant);
    actions.appendChild(rejectBtn);
    actions.appendChild(acceptBtn);

    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);

    if (!reduceMotion) {
      // Force a browser reflow/layout pass to ensure the start state (translateY(100%)) is registered
      banner.offsetHeight;
      banner.style.transform = 'translateY(0)';
    }

    var focusable = [link, rejectBtn, acceptBtn];

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        deny();
        closeBanner();
        return;
      }
      if (e.key !== 'Tab') return;
      var currentIndex = focusable.indexOf(document.activeElement);
      var lastIndex = focusable.length - 1;
      if (e.shiftKey && (currentIndex <= 0)) {
        e.preventDefault();
        focusable[lastIndex].focus();
      } else if (!e.shiftKey && currentIndex === lastIndex) {
        e.preventDefault();
        focusable[0].focus();
      }
    }
    document.addEventListener('keydown', onKeydown, true);

    banner.focus();
  }

  var stored = readConsent();
  if (stored === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    /**
     * Performance Optimization: Google Analytics Deferral
     * 1. Defers script execution and DOM insertion using requestIdleCallback
     *    with a timeout and fallback to minimize Total Blocking Time (TBT).
     * 2. Uses ES6 arrow functions for internal callbacks.
     */
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        loadGtagScript();
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        loadGtagScript();
      }, 500);
    }
  } else if (stored !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
