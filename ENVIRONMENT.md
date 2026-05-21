# Environment: church-website-pwa

> Everything needed to set up or recreate this project's environment from scratch.

---

## This is a static website — no build step required for the frontend

No Python, no Node, no compiler needed for the static site. Just a browser and a local web server.

Firebase Cloud Functions are introduced in Phase 1 and require Node.js — see the Cloud Functions section below.

---

## Setup From Scratch

1. Clone the repo:
   git clone https://github.com/egcchurch/egc-church.git
   cd egc-church

2. Open in VSCode:
   code .

3. Install the Live Server extension if not already installed

4. Click Go Live in the VSCode status bar
   Site serves at http://127.0.0.1:5500

---

## Dependencies (all CDN — nothing to install for the static site)

| Dependency   | Version          | URL                  |
| ------------ | ---------------- | -------------------- |
| Tailwind CSS | v4 browser build | cdn.jsdelivr.net     |
| Font Awesome | 6.5.1            | cdnjs.cloudflare.com |
| Firebase SDK | 9.22.0           | gstatic.com          |

---

## Firebase

- Project ID: egc-church
- Console: https://console.firebase.google.com
- Auth providers: Google, Email/Password
- Email verification: required before member approval
- Authorised domains: 127.0.0.1, egcchurch.github.io

---

## Known Issues / Quirks

- firebase-config.js must contain the real Firebase config (not the fake key)
- Firebase Auth requires http:// or https:// — cannot test via file://
- Always use Live Server, never open HTML files directly in the browser
- Service worker scope on localhost will be http://127.0.0.1:5500/ — this is normal and expected
- To verify SW in Chrome: DevTools → Application → Service Workers
- To inspect cache contents: DevTools → Application → Cache Storage → egc-cache-v1
- When deploying changes, bump CACHE_NAME in service-worker.js (e.g. v1 → v2) to bust the old cache
- Service worker cache list must be updated whenever a new page is added — applies to every phase

---

## Firebase Cloud Functions

Cloud Functions are introduced in Phase 1 (one function: `onUserCreate`) and expand in Phase 4 (broadcasts, DM push, alert triggers, weekly digest) and Phase 5 (account deletion).

### One-time setup (Phase 1)

```
npm install -g firebase-tools
firebase login
firebase init functions          # select JavaScript, not TypeScript
                                 # when prompted: install dependencies = yes
```

This creates the `functions/` folder with `package.json`, `index.js`, and `.eslintrc.js`.

### Deploying functions

```
cd functions
firebase deploy --only functions
```

Functions deploy separately from the static site — they do not affect GitHub Pages.

### Local emulation (optional but recommended)

```
firebase emulators:start --only functions,firestore,auth
```

Runs Firebase locally so you can test functions without deploying.

### Cost note

Cloud Functions has a generous free tier (2M invocations/month, 400k GB-seconds compute). A church-scale site stays well within free at all phases. The only paid risk is unbounded loops, so review function logic before deploying.
