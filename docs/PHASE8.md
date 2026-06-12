# Phase 8 — Multi-Church Template

> Planning document. Source of truth for the church template and customisation system.
> Save to the repo as `docs/PHASE8.md`. Keep updated as PRs land.

---

## Overview

All 7 phases were built for Emmanuel Gospel Centre specifically. Phase 8 makes the
codebase a reusable template — any church can fork the repo, run a one-time setup
script, point it at their own Firebase project, and have a fully working site.
Ongoing customisation (branding, content, feature toggles) is done entirely through
an admin settings UI with no code changes required after initial setup.

Phase 9 (Page Composition) builds on this foundation to add a visual section
manager for individual pages. Phase 8 must land first.

---

## Design Principles

- **Each church owns their own Firebase project.** No shared infrastructure, no
  cross-church data risk. Each site is fully isolated.
- **Two-layer config.** Deploy-time constants live in a committed file; everything
  a non-developer admin might want to change lives in Firestore and is editable
  from the admin UI.
- **No build step added.** The site stays plain static files. The one-time setup
  script is a utility, not a build tool.
- **Admin UI is the control surface.** After initial deploy, a superadmin should
  never need the Firebase console, CLI, or a code editor to customise their site.
- **EGC remains fully functional throughout.** Every sub-phase ships working code.
  Nothing regresses on the live site.

---

## Two-Layer Config Architecture

### Layer 1 — Deploy-time (`church-config.js`)

A new file at the repo root. Edited once at setup time, committed to the fork.
Contains values that must exist before Firebase initialises, or that Cloud
Functions need at deploy/runtime:

```js
// church-config.js
const churchConfig = {
  name:      "Emmanuel Gospel Centre",
  shortName: "EGC",
  timezone:  "Africa/Johannesburg",   // used by weeklyDigest scheduled function
  domain:    "app.egc.church",
};
```

The `weeklyDigest` Cloud Function currently hardcodes `'Africa/Johannesburg'`.
It will read `functions.config().church.timezone` instead, set via:

```
firebase functions:config:set church.timezone="Africa/Johannesburg"
```

### Layer 2 — Runtime (Firestore `/config/` collection)

Managed by a superadmin through `/admin/settings.html`. No redeploy needed to
change any of these values.

```
/config/church
  displayName:   string        — shown in nav, footer, page headings
  tagline:       string        — hero / homepage subtitle
  address:       string
  phone:         string | null
  email:         string | null
  socialLinks:   { facebook, youtube, instagram }  — null if not set

/config/branding
  primaryColor:  string        — hex, default "#0A3D62" (navy)
  accentColor:   string        — hex, default "#F59E0B" (amber)
  logoUrl:       string | null — Firebase Storage URL

/config/notifications
  connectAlertEmail: string | null  — destination for connect form email alerts

/config/features
  music:        boolean   — default true
  gallery:      boolean   — default true
  liveStream:   boolean   — default true
  messaging:    boolean   — default true
  groups:       boolean   — default true
  devotional:   boolean   — default true
  youthGallery: boolean   — default true
```

`/config/features` flags control nav visibility and admin page availability.
A flag set to `false` hides the nav item and redirects the admin page — the
Firestore data for that module is untouched, so re-enabling it restores all
prior content.

---

## Branding / Theming

Tailwind utility classes are scattered across all HTML files and cannot be
templated without a build step. The solution uses CSS custom properties:

1. Add to `assets/css/custom.css`:
   ```css
   :root {
     --color-primary: #0A3D62;
     --color-accent:  #F59E0B;
   }
   ```

2. `main.js` reads `/config/branding` after auth initialises and overwrites the
   CSS vars on `:root`:
   ```js
   document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
   document.documentElement.style.setProperty('--color-accent',  branding.accentColor);
   ```

3. Elements that should respect the theme use `var(--color-primary)` /
   `var(--color-accent)` via inline styles or custom CSS classes rather than
   Tailwind colour classes. Tailwind classes stay for structural layout only.

**Accepted trade-off:** There is a brief flash before Firestore responds and the
CSS vars are applied on first load. After the first visit the service worker
caches static assets and the vars are applied from the cached `custom.css`
defaults immediately.

---

## HTML Titles and `manifest.json`

Every HTML file has a hardcoded `<title>EGC Church — ...</title>`. `manifest.json`
has the church name and short name. With no build step these cannot be templated
at build time.

**Solution: one-time setup scripts (`setup.ps1` / `setup.sh`)**

A new church runs one of these after forking. The script takes the church name
and short name as arguments and does a safe find-and-replace across all HTML
files and `manifest.json`. This is a setup utility, not a build tool — it runs
once and is never needed again.

```powershell
# example
./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC"
```

Runtime display name (nav, footer, headings) is served from Firestore
`/config/church.displayName` and does not depend on the HTML title.

---

## Firestore Security Rules Addition

```
match /config/{document} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && get(
    /databases/$(database)/documents/users/$(request.auth.uid)
  ).data.isSuperadmin == true;
}
```

Public pages that display church info (address, service times) require the user
to be authenticated. Public-facing config values (tagline, logo) that need to
render for unauthenticated visitors are already covered by the homepage
`/homepage/content` document — no change needed there.

---

## Admin Settings UI (`/admin/settings.html`)

New page, superadmin only. No new permission key — superadmin gate is sufficient.
Organised into four sections, all backed by the `/config/` Firestore documents:

| Section | Fields |
|---|---|
| **Church Info** | Display name, tagline, address, phone, email, social links (Facebook, YouTube, Instagram) |
| **Branding** | Primary colour (hex picker), accent colour (hex picker), logo upload |
| **Notifications** | Connect alert email |
| **Features** | Toggle switch per module (music, gallery, live stream, messaging, groups, devotional, youth gallery) |

Each section saves independently (its own Save button) to avoid wiping
unsaved changes in other sections on error.

The existing service times editor on `/admin/homepage.html` stays where it is —
it is content management, not site configuration. Only the above fields move to
the new settings page.

---

## Connect Form Email Alert

The connect form email is the **first deliverable of Phase 8** (sub-phase 8a).
It is designed as part of this architecture rather than as a one-off change,
so it lands in the right place from the start.

`onNewConnectForm` in `functions/index.js` already fires on every submission.
The change adds:
1. A read of `/config/notifications.connectAlertEmail` at function start.
2. If the value is set, send a plain email to that address via the chosen
   email provider (Resend recommended — simplest Node SDK, 3,000/month free).
3. The API key is stored as a Firebase Functions environment variable
   (`firebase functions:config:set resend.api_key="..."`).

No Firestore schema change. Only `functions/index.js` changes (~15 lines).

**Email provider:** Resend (`npm install resend` in `functions/`).

---

## Setup Process for a New Church

Steps a new church follows after forking the repo:

1. Click **"Use this template"** on GitHub → creates a clean repo (no EGC history)
2. Create a Firebase project (Blaze plan required for Cloud Functions)
3. Enable: Auth (Google + Email/Password), Firestore, Storage, Hosting, Functions
4. Download `firebase-config.js` from the Firebase console and replace the one in the repo
5. Run `setup.ps1` or `setup.sh` with their church name and short name
6. Edit `church-config.js` — set timezone and domain
7. Set Firebase Functions config vars (timezone, Resend API key if using email alerts)
8. `firebase deploy`
9. Open `/admin/settings` → fill in branding, contact info, notification email, feature toggles
10. Set the first superadmin directly in Firestore console: set `isSuperadmin: true` on their user doc
11. Done — no further code or CLI changes needed for ongoing customisation

A `SETUP.md` at the repo root will walk through all 10 steps.

---

## Sub-Phases

| Sub-phase | Scope | Dependencies |
|---|---|---|
| **8a — Config foundation** | `/config/` Firestore structure + security rules, `church-config.js`, connect form email alert (Resend) | None — first PR |
| **8b — Admin settings UI** | `/admin/settings.html` — Church Info and Notifications sections | 8a |
| **8c — Branding/theming** | CSS custom properties in `custom.css`, colour pickers in settings, JS applies vars at load, logo upload | 8b |
| **8d — Feature flags** | Toggle switches in settings, nav shows/hides per flag, admin pages redirect if feature disabled | 8b |
| **8e — Template packaging** | `setup.ps1`, `setup.sh`, `SETUP.md`, mark repo as GitHub template | 8c, 8d |

Each sub-phase is one or two PRs. Branch sequentially — wait for each to merge
before starting the next (standard project rule).

---

## What Stays Hardcoded (Not Configurable in Phase 8)

- Firestore collection names and data model
- URL structure (`/members/`, `/admin/`, etc.)
- Auth flow and approval process
- Security rules logic
- Navigation structure (which pages exist)

Page layout and section composition are addressed in Phase 9 (Page Composition),
which builds on the `/config/` infrastructure established here.

---

## Status

| Sub-phase | Status |
|---|---|
| 8a — Config foundation | Not started |
| 8b — Admin settings UI | Not started |
| 8c — Branding/theming | Not started |
| 8d — Feature flags | Not started |
| 8e — Template packaging | Not started |
