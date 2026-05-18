# dhamakablocks.com

[![Live](https://img.shields.io/badge/Site-dhamakablocks.com-FF6B00?style=flat)](https://dhamakablocks.com)
[![Cloudflare](https://img.shields.io/badge/Deployed_on-Cloudflare-F38020?style=flat&logo=cloudflare)](https://cloudflare.com)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat)](LICENSE)

Marketing site and blog for [Dhamaka Blocks](https://github.com/kavyabarnadhya/dhamaka-blocks) — an Indian-themed block puzzle game on Google Play.

🌐 **Live:** [dhamakablocks.com](https://dhamakablocks.com)
🎮 **Game:** [Google Play](https://play.google.com/store/apps/details?id=com.dhamakagames.dhamakablocks)

---

## Structure

```
dhamakablocks-web/
├── index.html          # Landing page
├── privacy.html        # Privacy policy
├── app-ads.txt         # AdMob ads.txt
├── blog/               # SEO blog articles
│   ├── index.html      # Blog hub
│   ├── how-to-play.html
│   ├── tips-and-tricks.html
│   ├── score-optimization.html
│   └── block-puzzle-games-india.html
├── images/             # Game screenshots and assets
├── _headers            # Cloudflare security headers (CSP)
└── wrangler.jsonc      # Cloudflare deployment config
```

## Tech

- Static HTML5 + CSS — no build step, no framework
- Fonts: Google Fonts (Cinzel, Rajdhani)
- Deployed on **Cloudflare Pages/Workers** via Wrangler
- Security: strict CSP headers via `_headers`
- Secret scanning: `detect-secrets` pre-commit + GitHub Actions

## Deploy

```bash
# Install Wrangler
npm install -g wrangler

# Preview locally
wrangler pages dev .

# Deploy to Cloudflare
wrangler deploy
```

## Social

- Instagram: [@dhamakablocks](https://instagram.com/dhamakablocks)
- YouTube: [@DhamakaBlocksGame](https://youtube.com/@DhamakaBlocksGame)

---

© 2026 Kavya Barnadhya Hazarika. All Rights Reserved.
This repository is proprietary — see [LICENSE](LICENSE) for details.
