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
  gtag('js', new Date());
  gtag('config', GA_ID);

  function loadGtagScript() {
    if (scriptLoaded) return;
    scriptLoaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
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
      (reduceMotion ? '' : 'transition:transform 0.3s ease;');

    var text = document.createElement('span');
    text.style.cssText = 'flex:1;min-width:200px;opacity:0.9;';
    text.textContent = 'We use Google Analytics to understand site traffic. See our ';

    var link = document.createElement('a');
    link.href = '/privacy.html';
    link.textContent = 'Privacy Policy';
    link.style.cssText = 'color:#f5c542;text-decoration:underline;';
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    function closeBanner() {
      banner.remove();
      document.removeEventListener('keydown', onKeydown, true);
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    function makeButton(label, onClick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      var isPrimary = label === 'Accept';
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
    loadGtagScript();
  } else if (stored !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
