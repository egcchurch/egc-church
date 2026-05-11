# Environment: church-website-pwa

> Everything needed to set up or recreate this project's environment from scratch.

---

## This is a static website — no build step required

No Python, no Node, no compiler. Just a browser and a local web server.

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

## Dependencies (all CDN — nothing to install)

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
- Authorised domains: 127.0.0.1, egcchurch.github.io

---

## Known Issues / Quirks

- firebase-config.js must contain the real Firebase config (not the fake key)
- Firebase Auth requires http:// or https:// — cannot test via file://
- Always use Live Server, never open HTML files directly in the browser
