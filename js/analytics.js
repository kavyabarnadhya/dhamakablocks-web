// Google Analytics (GA4) loader with Consent Mode v2.
// Analytics storage defaults to denied; only granted after explicit user action.
// Consent choice persists in localStorage so the banner shows once.
(function () {
  var GA_ID = 'G-2QXVHNP2J4';
  var CONSENT_KEY = 'dhamaka-ga-consent';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    wait_for_update: 500
  });

  gtag('js', new Date());
  gtag('config', GA_ID);

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(script);

  var stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  if (stored === 'denied') {
    return;
  }

  function showBanner() {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var banner = document.createElement('div');
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
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

    function makeButton(label, granted) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText =
        'padding:8px 16px;border-radius:6px;border:none;cursor:pointer;font-size:14px;font-weight:600;' +
        (granted ? 'background:#f5c542;color:#1a1a1a;' : 'background:transparent;color:#f5f5f5;border:1px solid #666;');
      btn.addEventListener('click', function () {
        localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
        if (granted) {
          gtag('consent', 'update', { analytics_storage: 'granted' });
        }
        banner.remove();
      });
      return btn;
    }

    actions.appendChild(makeButton('Reject', false));
    actions.appendChild(makeButton('Accept', true));

    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
