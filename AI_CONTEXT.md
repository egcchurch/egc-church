# Project: church-website-pwa

> Paste this file (along with GLOBAL_CONTEXT.md and PROGRESS.md) at the start of any AI session.

---

## Purpose

A Progressive Web App (PWA) for Emmanuel Gospel Centre (EGC) church website.
Hosted on GitHub Pages with Firebase as the backend. Designed to be simple,
maintainable, and expandable by non-developers over time.

**Live site:** https://egcchurch.github.io/egc-church/
**GitHub repo:** https://github.com/egcchurch/egc-church

---

## Tech Stack

| Layer       | Technology                                   |
| ----------- | -------------------------------------------- |
| Frontend    | HTML5, CSS3, Vanilla JavaScript (ES6)        |
| Styling     | Tailwind CSS (CDN browser build)             |
| Icons       | Font Awesome 6.5.1 (CDN)                     |
| Backend     | Firebase (Authentication, Firestore planned) |
| Hosting     | GitHub Pages (static, root of main branch)   |
| Environment | No build step — plain static files           |

---

## Project Structure

```
church-website-pwa/
├── index.html              ← Homepage (video hero, nav)
├── login.html              ← Firebase auth page (Google + email)
├── sermons.html            ← Sermons archive (card/table view)
├── firebase-config.js      ← Firebase init (committed, public)
├── manifest.json           ← PWA manifest (to be added)
├── service-worker.js       ← PWA service worker (to be added)
│
├── assets/
│   ├── css/                ← Custom stylesheets (to be added)
│   ├── images/             ← Church images (to be added)
│   └── videos/
│       └── CloudVideo.mp4  ← Hero background video
│
├── js/
│   ├── auth.js             ← Firebase auth logic
│   ├── main.js             ← Global nav, auth state, mobile menu
│   └── sermons.js          ← Sermons page (hardcoded data for now)
│
├── .gitignore
├── README.md
├── AI_CONTEXT.md           ← This file (not committed)
├── ENVIRONMENT.md
└── PROGRESS.md

```

---

## Key Files

| File                 | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `firebase-config.js` | Initialises Firebase app and auth                      |
| `js/auth.js`         | Google login, email/password login, logout             |
| `js/main.js`         | Mobile menu, auth state listener, login button updates |
| `js/sermons.js`      | Renders sermons in card/table view with search         |

---

## Architecture / Design Decisions

- No frontend frameworks — vanilla HTML, CSS, JS only
- Tailwind CSS via CDN (acceptable trade-off for simplicity over compiled build)
- Firebase is the only approved external dependency
- GitHub Pages serves from root of main branch
- firebase-config.js is committed (Firebase web configs are public-facing by design)
- Navigation is duplicated across pages (to be refactored into a component later)
- Colour scheme: amber (#F59E0B) + navy (#0A3D62)

---

## Current Goal

PWA layer next — manifest.json and service worker — then connect sermons to Firestore.

---

## Constraints & Rules

- Do not introduce frontend frameworks
- Do not change the folder structure without asking
- No build tools or bundlers — must remain plain static files
- Firebase is the only approved CDN dependency (plus Tailwind and Font Awesome)
- Keep nav consistent across all pages

---

## Firebase

- Project ID: egc-church
- Auth domain: egc-church.firebaseapp.com
- Google Authentication: enabled
- Email/Password Authentication: enabled
- Firestore: planned
- Cloud Messaging: planned
- Authorised domains: 127.0.0.1, egcchurch.github.io

---

## How to Run Locally

Open in VSCode, then click Go Live (Live Server extension).
Site serves at http://127.0.0.1:5500
