# Church Website PWA Template

A ready-to-deploy Progressive Web App for churches. Built for Emmanuel Gospel Centre (EGC) and designed to be forked by any congregation. After a one-time setup, everything is managed from an admin panel — no code editing required.

**Live site:** [app.egc.church](https://app.egc.church)

---

## What It Includes

**Public site**
- Homepage with service times, announcements, and live stream banner
- Sermons archive (YouTube embeds + audio + PDF notes)
- Events calendar
- Blog / notice board
- About / leadership team
- Photo gallery
- Music library (stream and download)
- Visitor connect form

**Members area** (login required, approved members only)
- Members dashboard
- Live stream page
- Member directory with privacy controls
- Small groups (browse, join, leader management)
- Prayer requests
- Daily devotional
- Members and youth photo galleries
- Direct messaging (member to member)

**Admin panel** (permission-based)
- Manage all content: sermons, events, blog, team, gallery, music, devotional
- User approvals and role management
- Send push notifications and broadcasts
- Homepage and settings management

**PWA features**
- Installable on Android and iOS (home screen icon, offline support)
- Push notifications via Firebase Cloud Messaging
- Service worker with offline caching

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Styling | Tailwind CSS (CDN) |
| Icons | Font Awesome 6 |
| Backend | Firebase (Auth, Firestore, Storage, Functions, FCM) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions |

No build step. No npm install required to run the site.

---

## Getting Started

See **[SETUP.md](SETUP.md)** for the full 10-step guide.

The short version:

1. Click **"Use this template"** on GitHub to create your own repo
2. Create a Firebase project and enable Auth, Firestore, Storage, Hosting, and Functions
3. Replace `firebase-config.js` with your project's config
4. Run the setup script with your church name:
   - Windows: `./setup.ps1 -ChurchName "Your Church" -ShortName "YC"`
   - Mac/Linux: `./setup.sh "Your Church" YC`
5. Edit `church-config.js` with your timezone and domain
6. Run `firebase deploy`
7. Set the first superadmin in Firestore and log in to `/admin/settings`

---

## Customisation

After the initial deploy, everything is managed from the admin panel at `/admin/settings`:

- **Church info** — name, tagline, address, contact details, social links
- **Branding** — primary and accent colours (colour pickers), logo upload
- **Features** — enable/disable modules (music, gallery, live stream, messaging, groups, devotional, youth gallery) with toggle switches
- **Notifications** — connect form alert email

No redeployment needed for any of these changes.

---

## Access Control

| Area | Who can access |
|---|---|
| Public pages | Anyone |
| Profile page | Any logged-in user |
| Members area | Approved members |
| Admin panel | Users with admin permissions |
| User management | Superadmin only |

New users register and wait for a superadmin to approve them. Approval is intentionally manual — appropriate for a church context.

---

## Project Layout

```
/                   Public site (homepage, sermons, events, etc.)
/login.html         Registration and sign-in
/profile.html       User profile and privacy settings
/members/           Members-only area
/admin/             Admin panel
/functions/         Firebase Cloud Functions
/js/                Shared JavaScript
/assets/            CSS, images, icons, video
```

Full structure in [CLAUDE.md](CLAUDE.md).

---

## Documentation

| Document | Contents |
|---|---|
| [SETUP.md](SETUP.md) | New church setup guide (10 steps) |
| [CLAUDE.md](CLAUDE.md) | Full technical reference (architecture, data model, CI/CD) |
| [docs/PHASE8.md](docs/PHASE8.md) | Multi-church template design decisions |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | Role and permission model |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Planned future improvements |

---

## Requirements for a New Church

- A Firebase account ([free to sign up](https://firebase.google.com))
- Firebase Blaze plan (pay-as-you-go) — required for Cloud Functions; usage at church scale stays within the free tier
- Firebase CLI: `npm install -g firebase-tools`
- A domain name (optional — Firebase provides a free `.web.app` subdomain)

---

## Licence

MIT — free to use, modify, and deploy for your church.
