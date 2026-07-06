# Project: church-website-pwa

> Paste this file (along with PROGRESS.md) at the start of any AI session.
> Repo-aware agents auto-load this file from the repo root.

---

## Purpose

A Progressive Web App (PWA) for Emmanuel Gospel Centre (EGC) church website.
Hosted on Firebase Hosting with Firebase as the backend. Designed to be simple,
maintainable, and expandable by non-developers over time.

**Production:** https://app.egc.church (https://egc-app777.web.app)
**Staging:** https://staging.egc.church (https://egc-staging777.web.app)
**GitHub repo:** https://github.com/egcchurch/egc-church

---

## Tech Stack

| Layer         | Technology                                                           |
| ------------- | -------------------------------------------------------------------- |
| Frontend      | HTML5, CSS3, Vanilla JavaScript (ES6)                                |
| Styling       | Tailwind CSS v4 (pre-built static CSS via `@tailwindcss/cli`, CI step) |
| Icons         | Font Awesome 6.5.1 (CDN)                                             |
| Backend       | Firebase (Auth, Firestore, Storage, FCM)                             |
| Hosting       | Firebase Hosting (multi-site: egc-staging777, egc-app777)            |
| CI/CD         | GitHub Actions — PR preview, security rules tests, link/cache checks |
| Source ctrl   | GitHub — `main` is protected production branch                       |
| Notifications | Firebase Cloud Messaging (FCM)                                       |
| Functions     | Firebase Cloud Functions v1 (broadcasts, group/team push, alerts)    |
| Environment   | No build step — plain static files                                   |

---

## Project Structure

```
church-website-pwa/
├── index.html                  ← Homepage (video hero, nav, dynamic content)
├── login.html                  ← Firebase auth page (Google + email)
├── profile.html                ← User self-service: name, photo, password, privacy, verification
├── sermons.html                ← Sermons archive (public, Firestore-driven)
├── events.html                 ← Church calendar (public, Firestore-driven)
├── blog.html                   ← Announcements / news (public)
├── about.html                  ← Leadership team, about EGC (public)
├── william-branham.html        ← Pillar of Fire, Life & Ministry, Deep Calleth to the Deep (public,
│                                  static content adapted from www.egc.church — core doctrinal page)
├── fulfillment-of-prophecy.html ← Five Comings of the Spirit of Elijah (public, static content)
├── connect.html                ← Visitor connect form (public)
├── gallery.html                ← Public gallery (public)
├── music.html                  ← Music library (public)
├── story.html                  ← Single blog post detail view (?id=, public) — reads /blog/{id}
├── 404.html                    ← Not-found page
│
├── nav.html                    ← Shared public-page nav partial — injected into #nav-placeholder
│                                  by js/nav.js (script tags inside it never execute; see
│                                  "Shared partials" note below)
├── admin-nav.html              ← Shared admin nav partial, same injection mechanism
├── members-nav.html            ← Shared members nav partial, same injection mechanism
├── footer.html                 ← Shared public-page footer partial — injected into
│                                  #footer-placeholder by js/nav.js; admin/members pages excluded.
│                                  Pure markup only (placeholder ids), populated by js/footer.js
│
├── members/                    ← Member-gated pages (membership: "member" required)
│   ├── index.html              ← Members area dashboard
│   ├── live.html               ← Live stream
│   ├── directory.html          ← Membership directory
│   ├── groups.html             ← Small groups (browse + join + leader management for own group)
│   ├── cottage.html            ← Cottage meetings (register with party size; capacity-limited)
│   ├── serving-teams.html      ← Rostered volunteer teams (Equipment, Worship, Youth Helpers...)
│   ├── prayer.html             ← Prayer requests
│   ├── devotional.html         ← Daily devotional
│   ├── gallery.html            ← Members + youth galleries
│   └── messages.html           ← In-app direct messaging
│
├── admin/                      ← Admin-gated pages (custom claims required)
│   ├── index.html              ← Admin dashboard
│   ├── users.html              ← superadmin only — approvals and role management
│   ├── sermons.html            ← Manage sermons
│   ├── events.html             ← Manage calendar events
│   ├── blog.html               ← Manage announcements
│   ├── team.html               ← Manage leadership profiles
│   ├── groups.html             ← Manage ALL groups (groups.manage permission)
│   ├── cottage.html            ← Manage cottage meetings (cottage.manage; deacon hosts own, superadmin all)
│   ├── serving-teams.html      ← Create serving teams (servingTeams.manage); leaders manage their own
│   ├── devotional.html         ← Manage devotional content
│   ├── gallery.html            ← Manage photo galleries (all audiences)
│   ├── music.html              ← Manage music library
│   ├── connect.html            ← View visitor connect form submissions
│   ├── prayer.html             ← Moderate prayer requests
│   ├── homepage.html           ← Manage homepage content
│   ├── notifications.html      ← Send broadcasts and notifications
│   ├── roles.html              ← Define and manage permission roles (Phase 6)
│   ├── settings.html           ← superadmin only — church info, branding, notification routing,
│   │                              feature flags (Phase 8, see docs/PHASE8.md)
│   ├── pages.html              ← superadmin only — toggle/reorder sections on homepage, about,
│   │                              members dashboard (Phase 9, see docs/PHASE9.md)
│   └── media.html              ← superadmin only — Media Library: upload general files (with a
│                                  copyable URL) plus a browsable, searchable aggregate of every
│                                  media file across the site (gallery, music, sermons, events,
│                                  blog, team, branding), tagged by source; an on-demand orphan
│                                  scan flags Storage files referenced nowhere — see "Media
│                                  Library" under Architecture / Design Decisions
│
├── functions/                  ← Firebase Cloud Functions
│   ├── index.js                ← Function entry — auth, Firestore, scheduled, callable triggers
│   ├── computePermissions.js   ← Pure helper: computeEffectiveClaims, permissionFieldsChanged
│   ├── rolesData.js            ← Shared role data: ALL_PERMISSIONS, DEFAULT_ROLES (used by seed + migrate)
│   ├── seedRoles.js            ← One-time seed script for /roles collection (Phase 6, manual run)
│   ├── package.json            ← Node dependencies (firebase-admin, firebase-functions)
│   └── .gitignore              ← Excludes node_modules
│
├── church-config.js           ← Deploy-time constants (name, shortName, timezone, domain) for
│                                  the multi-church template — edited once per fork (Phase 8)
├── firebase-config.js          ← Firebase init (committed, public)
├── firebase.json               ← Firebase Hosting multi-site config (manifest.json,
│                                  service-worker.js, and everything under /js/ get an explicit
│                                  no-cache header — see the cache-version note under
│                                  Architecture / Design Decisions for why)
├── .firebaserc                 ← Firebase project + site target aliases
├── firestore.rules             ← Firestore security rules
├── firestore.indexes.json      ← Firestore composite indexes
├── storage.rules               ← Firebase Storage security rules
├── manifest.json               ← PWA manifest (start_url and scope = /; orientation: "any" — see Sermon Media Strategy for why)
├── service-worker.js           ← PWA service worker
│
├── .github/
│   └── workflows/
│       ├── preview.yml         ← PR preview deploy to Firebase staging
│       ├── deploy.yml          ← Prod deploy on merge to main
│       └── ci.yml              ← Link check, SW cache check, security rules tests
│
├── tests/
│   ├── firestore.rules.test.js ← Firestore security rules tests (mocha + emulator)
│   └── storage.rules.test.js   ← Storage security rules tests (mocha + emulator) — see
│                                  the request.resource-on-delete note under Architecture /
│                                  Design Decisions for why this exists
│
├── assets/
│   ├── css/                    ← Custom stylesheets
│   ├── images/
│   │   ├── icons/              ← PWA icons (8 sizes, 72-512px)
│   │   ├── logo.png            ← EGC logo source
│   │   ├── welcome/            ← Homepage "Warm Welcome" carousel photos (3), sourced from
│   │   │                          www.egc.church when that section was added
│   │   └── william-branham/    ← Pillar of Fire + preaching photos for william-branham.html
│   └── videos/
│       └── CloudVideo.mp4      ← Hero background video (not cached — too large)
│
├── js/
│   ├── auth.js                 ← Firebase auth logic
│   ├── admin-auth.js           ← Auth guard for admin pages (role check)
│   ├── member-auth.js          ← Auth guard for member pages (membership check)
│   ├── permissions.js          ← Reads custom claims, exposes hasPermission(key) — load after
│   │                              firebase-auth-compat.js
│   ├── main.js                 ← Global nav, auth state, mobile menu, SW reg, applyBranding()/
│   │                              applyFeatures() (Phase 8 /config/* client-side application)
│   ├── nav.js                  ← Injects nav.html/admin-nav.html/members-nav.html into
│   │                              #nav-placeholder, and footer.html into #footer-placeholder
│   │                              (public pages only) — see "Shared partials" note below
│   ├── footer.js               ← Populates footer.html's placeholder ids from /config/church +
│   │                              /homepage/content.serviceTimes; loaded dynamically by nav.js
│   ├── welcome-carousel.js     ← Auto-rotating photo carousel for index.html's "Warm Welcome"
│   │                              section — plain CSS opacity crossfade, no library, no-ops if
│   │                              #welcome-carousel isn't on the page
│   ├── homepage.js             ← Adaptive homepage renderer (Phase 7) — auth-state templates,
│   │                              service times, quick links, notice board; see docs/HOMEPAGE.md
│   ├── sermons.js              ← Sermons page (Firestore)
│   ├── events.js               ← Events page (Firestore)
│   ├── blog.js                 ← Blog/announcements list page (Firestore)
│   ├── about.js                ← About/leadership page (Firestore)
│   ├── connect.js              ← Visitor connect form submission
│   ├── gallery.js              ← Public gallery page (Firestore)
│   ├── music.js                ← Music library page (Firestore)
│   ├── branham-sermons.js      ← Static sermon grid for fulfillment-of-prophecy.html — hardcoded
│   │                              metadata with inline audio player + PDF/audio download links;
│   │                              URLs filled in via /admin/media.html uploads
│   ├── storage-upload.js       ← The ONLY module that knows about Firebase Storage — see
│   │                              "Media Storage" section below
│   ├── search.js               ← Global ⌘K/Ctrl+K content search overlay (sermons/events/blog)
│   ├── notifications.js        ← FCM token registration, in-app notification centre
│   └── messaging.js            ← Direct messaging (Firestore real-time)
│
├── package.json                ← Test dependencies (mocha, @firebase/rules-unit-testing)
├── .gitignore
├── README.md
├── CLAUDE.md                   ← This file (committed for repo-aware agents)
├── ENVIRONMENT.md
└── PROGRESS.md
```

---

## Site Map & Access Control

### Public Pages (no login required)

> **Nav/footer/admin label note:** the table below describes each page's *purpose* — the
> visitor-facing nav bar, footer, and admin dashboard label `/events.html` as **"Notices"** and
> `/blog.html` as **"Reports"** (standardized in Sessions 170-171), not "Events"/"Blog". URLs,
> filenames, and Firestore collections are still `events`/`blog` throughout — only the on-screen
> label changed. Don't assume the visible page name matches this table's "Page" column.

| Page                 | URL      |
| -------------------- | -------- |
| Homepage             | /        |
| Sermons archive      | /sermons |
| Events / calendar    | /events  |
| Blog / announcements | /blog    |
| About / leadership   | /about   |
| William Branham      | /william-branham |
| Fulfillment of Prophecy | /fulfillment-of-prophecy |
| Visitor connect form | /connect |
| Photo gallery        | /gallery |
| Music library        | /music   |
| Login / register     | /login   |

### Logged-In Pages (any authenticated user)

| Page               | URL      | Notes                                                              |
| ------------------ | -------- | ------------------------------------------------------------------ |
| Profile / settings | /profile | Update display name, photo, password, privacy, resend verification |

### Member Pages (membership: "member" required)

| Page                    | URL                 |
| ----------------------- | ------------------- |
| Members dashboard       | /members/           |
| Live stream             | /members/live       |
| Membership directory    | /members/directory  |
| Small groups            | /members/groups     |
| Cottage meetings        | /members/cottage    |
| Serving teams           | /members/serving-teams |
| Prayer requests         | /members/prayer     |
| Daily devotional        | /members/devotional |
| Members & youth gallery | /members/gallery    |
| Direct messages         | /members/messages   |

### Admin Pages (custom claims — `isSuperadmin` or specific permission required)

| Page                     | URL                  | Required permission        |
| ------------------------ | -------------------- | -------------------------- |
| Admin dashboard          | /admin/              | any admin (superadmin or perms) |
| Manage sermons           | /admin/sermons       | `sermons.manage`           |
| Manage events            | /admin/events        | `events.manage`            |
| Manage blog              | /admin/blog          | `blog.manage`              |
| Manage team              | /admin/team          | `team.manage`              |
| Manage groups            | /admin/groups        | `groups.manage`            |
| Manage cottage meetings  | /admin/cottage       | `cottage.manage`           |
| Create serving teams     | /admin/serving-teams | `servingTeams.manage` (leaders manage their own team without this permission) |
| Manage devotional        | /admin/devotional    | `devotional.manage`        |
| Manage gallery           | /admin/gallery       | `gallery.manage`           |
| Manage music             | /admin/music         | `music.manage`             |
| View connect submissions | /admin/connect       | `connect.view`             |
| Moderate prayer requests | /admin/prayer        | `prayer.moderate`          |
| Manage homepage          | /admin/homepage      | `homepage.manage`          |
| Send notifications       | /admin/notifications | `notifications.send`       |
| User management          | /admin/users         | `users.approve`            |
| Manage roles             | /admin/roles         | `users.assign_roles`; superadmin for create/edit/delete |
| Site settings            | /admin/settings      | superadmin only (Phase 8 — church info, branding, notification routing, feature flags) |
| Page layout              | /admin/pages         | superadmin only (Phase 9 — toggle/reorder sections on homepage, about, members dashboard) |
| Media Library            | /admin/media         | superadmin only — upload + site-wide browsable/searchable media aggregate + orphan scan |

---

## Role & Permission Model

Two independent dimensions per user:

### Membership Tier (controls content access)

| Value     | Access                                                 |
| --------- | ------------------------------------------------------ |
| `pending` | Registered but not yet approved — sees waiting message |
| `public`  | Approved general user — public pages only              |
| `member`  | Approved church member — public + all member pages     |

### Admin Permissions (controls content management — Phase 6)

Permissions are stored as Firebase Auth custom claims computed by the `syncUserClaims` Cloud Function.

- `isSuperadmin: true` on the user doc → custom claim `{ superadmin: true }` → all permissions
- `roles: [roleIds]` + `extraPermissions: [keys]` → custom claim `{ superadmin: false, perms: [...] }` → additive union
- See `docs/PERMISSIONS.md` for the full 17-key permission model and default roles

### Combined Access Matrix

| Page / Feature  | Public (pending) | Public (approved) | Member | Has permission | Superadmin |
| --------------- | ---------------- | ----------------- | ------ | -------------- | ---------- |
| Public pages    | Yes              | Yes               | Yes    | Yes            | Yes        |
| Profile page    | Yes              | Yes               | Yes    | Yes            | Yes        |
| Live stream     | No               | No                | Yes    | Yes            | Yes        |
| Members area    | No               | No                | Yes    | Yes            | Yes        |
| Admin section   | No               | No                | No     | Yes (per perm) | Yes        |
| User management | No               | No                | No     | users.approve  | Yes        |

### Approval Flow

- New registrations default to `membership: "pending"`, `isSuperadmin: false`, `emailVerified: false`
- Auto-provisioning handled by `onUserCreate` Cloud Function (Firebase Auth trigger)
- Firebase Auth's built-in `sendEmailVerification()` sends a verification email on registration
- Forgotten passwords handled via Firebase Auth's `sendPasswordResetEmail()` — triggered from a "Forgot password?" link on `/login.html`
- User can resend the verification email anytime from `/profile.html`
- A user must have `emailVerified: true` before a superadmin can approve them
- User sees a "your account is awaiting approval" message until approved
- Superadmin reviews pending users in `/admin/users` and sets membership tier
- Approval is intentionally manual — appropriate for a church congregation context

---

## CI/CD Pipeline

Every feature follows this flow:

```
Create branch -> write code -> push -> PR opens
      |
      v
CI checks run automatically:
  - lint-links (Lychee)
  - sw-cache-check (HTML pages vs SW cache list)
  - security-rules (Firestore rules tests against emulator)
  - PR preview deploy to staging (auto-generated URL)
      |
      v
Reviewer tests preview URL -> merges
      |
      v
Auto-deploy to production (Firebase Hosting + Cloud Functions)
```

Branch protection on `main` requires all checks to pass. Direct pushes to `main` are blocked.

GitHub Secrets used by workflows:

- `FIREBASE_SERVICE_ACCOUNT` — for Firebase deploys (service account JSON)
- `FIREBASE_CONFIG` — to inject firebase-config.js at deploy time

Workflow files:

- `.github/workflows/preview.yml` — PR preview deploy
- `.github/workflows/deploy.yml` — Production deploy on merge to main
- `.github/workflows/ci.yml` — Lint, SW cache check, security rules tests

---

## Notifications & Messaging Architecture

### Push Notifications (works when app/browser is closed)

- Firebase Cloud Messaging (FCM)
- User grants notification permission on first visit (from the installed PWA only — see below)
- FCM token stored in `/users/{uid}/fcmTokens/{deviceId}` — keyed by a stable `deviceId` string (stored in `localStorage` as `egcDeviceId`), not by the FCM token itself, so token rotation overwrites the same doc
- Admin sends broadcast from `/admin/notifications`
- A Cloud Function fans out to all relevant FCM tokens
- **Cloud Functions are required here** — client-side JS cannot send to other users' devices
- **Delivery caveat:** FCM push only reaches logged-in **members** with registered tokens. Pending and public users do not register FCM tokens (gated in `js/notifications.js` on `membership === 'member'` AND `display-mode: standalone`). The `syncUserNotificationEligibility` Cloud Function deletes tokens immediately when a user's membership drops below member.
- **Standalone-only token registration:** `js/notifications.js` returns early if `!window.matchMedia('(display-mode: standalone)').matches`. Browser Chrome and the installed PWA have separate `localStorage` on Android (same origin, different contexts) and would generate different `deviceId`s and accumulate two tokens. Token registration is restricted to the installed PWA to avoid this. Browser Chrome visitors still get the in-app bell and foreground toasts.
- **FCM payload structure** (all three sends — `onNewMessage`, `sendBroadcast`, `weeklyDigest`):
  - `notification: { title, body }` — top-level field; feeds the `onMessage` foreground toast handler
  - `webpush.notification: { title, body, icon, badge, data: { linkUrl } }` — Chrome on Android uses this field to wake from a closed state and auto-display; `data.linkUrl` is read by the `notificationclick` handler for tap navigation
  - `webpush.fcmOptions: { link }` — fallback navigation
  - `data: { linkUrl }` — backup
- **`onBackgroundMessage` is intentionally NOT registered** in `service-worker.js`. When `onBackgroundMessage` is registered alongside `webpush.notification`, Chrome auto-displays AND the handler fires — two notifications per push. Removing the handler leaves display entirely to Chrome (one notification). Do not re-add it.

### In-App Notifications (app open)

- Firestore real-time listener on `/users/{uid}/notifications/`
- Notification bell in nav updates instantly without refresh
- Unread count badge driven by Firestore `read: false` documents

### Group & Team Messaging (member to group / team)

- Group chats (`type: 'group'`) started from `/members/groups.html` — all group members + leaders are participants
- Team chats (`type: 'team'`) started from `/members/serving-teams.html` — all team members + leaders are participants
- No 1-to-1 direct messaging — messaging is broadcast within a group or team only
- Firestore real-time listeners on `/conversations/{conversationId}/messages/`
- Conversation list and message thread both update live
- New message triggers `onNewMessage` Cloud Function that fans out FCM + in-app notifications to **all** participants except the sender
- `purgeDirectMessages` callable (superadmin) — one-time migration that deletes all conversation docs where `type !== 'group'` and `type !== 'team'`

### Broadcast Types

| Type                 | Audience       | Delivery                    |
| -------------------- | -------------- | --------------------------- |
| Service reminder     | All members    | FCM push + in-app           |
| Public event notice  | All members    | FCM push + in-app           |
| Emergency notice     | All members    | FCM push + in-app           |
| Weekly digest        | All members    | FCM push (Sunday scheduled) |
| Group message        | Group members  | FCM push + in-app           |
| Team message         | Team members   | FCM push + in-app           |
| Prayer request alert | All members    | In-app only                 |
| Connect form alert   | Admins         | In-app only                 |

---

## Cloud Functions Architecture

All Cloud Functions live in `/functions/index.js` and are deployed separately from the static site.

**Important:** Functions use **firebase-functions v1** API (`functions.auth.user().onCreate`). The v2 `beforeUserCreated` blocking function trigger requires Google Cloud Identity Platform (GCIP) — a paid upgrade beyond standard Firebase Auth.

Functions are organised by trigger type:

### HTTP / Callable Functions

- `sendBroadcast` — called from `/admin/notifications.html` — accepts notification payload and audience, fans out to matching FCM tokens, also writes per-user copies to `/users/{uid}/notifications/` (each stamped with `broadcastId` = the `/notifications` log doc ID). Accepts optional `linkUrl` (site-relative only, used for in-app + push tap-through) and `eventId` (records a calendar event created alongside the broadcast — the "also add to calendar" toggle creates the `/events` doc client-side under normal `events.manage` rules, then passes its ID here; the event is independent afterwards)
- `updateBroadcast` — callable (requires `notifications.send`) — edits a sent broadcast's title/body on the `/notifications` log doc AND on every user's in-app copy (collectionGroup query on `broadcastId`). Cannot change push notifications already delivered to phones. Copies sent before `broadcastId` stamping existed are untouched
- `deleteBroadcast` — callable (requires `notifications.send`) — retracts a sent broadcast: deletes the log doc and every user's in-app copy (same `broadcastId` collectionGroup query, same legacy caveat)

### Firestore Triggers

- `onNewMessage` — trigger: `/conversations/{conversationId}/messages/{messageId}` created — fans out FCM push + in-app notification to **all** participants except the sender; title includes `groupName` for group/team conversations
- `onNewPrayerRequest` — trigger: `/prayerRequests/{requestId}` created — if `isPrivate: false`, writes in-app notification to all members; if `isPrivate: true`, writes in-app notification to admins only
- `onNewConnectForm` — trigger: `/connectForms/{submissionId}` created — writes in-app notification to all admins
- `onGroupMemberAdded` — trigger: `/groups/{groupId}` updated — when new UIDs appear in `members`, sends each added member an in-app + FCM notification; message distinguishes between "request approved" (UID was in `pendingMembers` before) and "added by leader" (direct add)
- `onServingSlotReleased` — trigger: `/servingTeams/{teamId}/slots/{slotId}` updated — fires when `assignedUid` changes from set to null (member released their slot); sends FCM push + in-app notification to all team leaders so they can arrange a replacement. Deep link: `?team={teamId}&slot={slotId}` on `/members/serving-teams.html`.

### Scheduled Functions

- `weeklyDigest` — runs every Sunday morning — compiles recent sermons, events, and announcements, fans out FCM push to all members
- `sendServingSlotReminders` — runs every morning at 07:00 SAST (05:00 UTC) — queries `collectionGroup('slots')` for today's date; sends each assigned member a FCM push + in-app reminder linking to their specific slot (`?team=X&slot=Y`); sends each team's leaders one aggregated notification listing how many slots are unassigned (avoids per-slot alert fatigue). Requires the `slots`/`date` `fieldOverrides` entry in `firestore.indexes.json` (see the `collectionGroup()` note under Firebase below) — without it this fails silently every run; confirmed broken this way from deployment until fixed in Session 179.

### Auth Triggers

- `onUserCreate` — trigger: new Firebase Auth user — creates `/users/{uid}` doc with `membership: "pending"`, `isSuperadmin: false`, `roles: []`, `extraPermissions: []`, `emailVerified: false`, default privacy flags

### Account Management

- `deleteUserAccount` — callable from `/profile.html` — performs GDPR-compliant account deletion (see Account Deletion section)
- `podcastFeed` — HTTP function, served at `/feed.xml` via a Firebase Hosting rewrite (both staging and production) — queries published sermons with a non-empty `audioUrl`, sorts by date desc client-side (single equality filter, no composite index needed), returns an RSS 2.0 + iTunes-tagged XML feed (up to 100 items, 1-hour cache)

### Permissions

- `syncUserClaims` — trigger: `/users/{uid}` write — recomputes effective permissions from `user.roles` + `user.extraPermissions`, writes to Firebase Auth custom claims (`{ superadmin: true }` or `{ superadmin: false, perms: [...] }`). Skips if no permission-relevant fields changed. Helper logic in `functions/computePermissions.js` (pure module, tested independently).
- `migrateRolesV1` — callable (superadmin only) — one-time Phase 6 migration: (1) seeds `/roles/` with 7 default roles if empty; (2) iterates all user docs in batches of 100 and sets `isSuperadmin`, `roles`, `extraPermissions` (idempotent — skips users where all three fields already exist). Returns `{ usersUpdated, rolesSeeded, errors }`. Already run on staging and production.

### Membership

- `requestMemberAccess` — callable from `/profile.html` — allows `public` users to request membership; writes `membershipRequestedAt: serverTimestamp()` to their user doc and sends in-app notification to all users with `users.approve` permission. 24h idempotency guard prevents repeat notifications.
- `welcomeNewMember` — trigger: `/users/{uid}` write — when `membership` changes to `"member"`, writes a welcome in-app notification pointing the user to the members area.
- `syncUserNotificationEligibility` — trigger: `/users/{uid}` write — if `membership` drops from `member` to anything else, deletes all docs in `/users/{uid}/fcmTokens` subcollection so the user stops receiving push notifications.
- `cleanupNonMemberTokens` — callable (superadmin only) — one-time migration: deletes FCM token subcollections for all users where `membership !== 'member'`. Already run on production.
- `purgeDirectMessages` — callable (superadmin only) — one-time migration: deletes all `/conversations` docs where `type` is not `'group'` or `'team'` (i.e. removes old 1-to-1 DMs). Run once after deploying the group/team messaging redesign: `firebase.functions().httpsCallable('purgeDirectMessages')()`.

### Cottage Meetings

- `registerForCottageMeeting` — callable from `/members/cottage.html` — transactionally reserves seats (no overselling), enforces one active registration per member, writes `/cottageRegistrations/{uid}` (incl. the member's phone, captured at registration), increments the meeting's `seatsTaken`, and sends an in-app + push confirmation with the venue/date/time. **Phase 2:** also sends an **SMS via SMSPortal** (`POST rest.smsportal.com/v3/BulkMessages`, Basic auth) when the member **opts in** (a checkbox on the register form, default off) and a number is available, and the `SMSPORTAL_CLIENT_ID` / `SMSPORTAL_API_SECRET` secrets are set — best-effort, never blocks registration. The member's profile number is authoritative (edited on `/profile.html`); a number is only typed at registration when the profile has none, and that number **back-fills the profile** (only when empty). WhatsApp + per-member channel preferences are a planned later phase. **Deploy note:** both SMSPORTAL secrets must exist in Secret Manager before deploying this function (listed in its `runWith`).
- `cancelCottageRegistration` — callable from `/members/cottage.html` — transactionally frees the seats and deletes the member's registration.

### Event Registration (Phases B1-C3, all planned phases delivered — see `docs/EVENT_REGISTRATION.md`)

- `registerForEvent` — callable from `events.html`'s registration modal — may be called by a
  signed-in member OR a fully unauthenticated visitor depending on the event's
  `registration.audience` setting, since this must also work for people from other assemblies
  with no account on this app (unlike RSVP, which is member-only and writes directly from the
  client). Party model (Phase C1): one `contact` registers one or more `attendees` in a single
  submission (e.g. a parent registering 3 children) — one `referenceCode` and one Storage folder
  cover the whole party, and capacity is charged `attendees.length` seats, not 1. Validates the
  audience gate up front, checks for a duplicate registration by `contact.phoneKey`/`emailKey`
  (soft warn via an `already-exists` error carrying the existing submission date, not a hard
  block — the client resubmits with `confirmDuplicate: true` if the registrant confirms), then
  runs the actual write inside a transaction that re-reads `registration.enabled`, each attendee's
  required dynamic answers, and `registration.capacity` vs `seatsTaken`, rejecting with
  `resource-exhausted` once a capacity-limited event would be oversold; mirrors
  `registerForCottageMeeting`'s transaction exactly. `capacity` is optional (`null`/absent =
  unlimited). Moderation (Phase C2): if `registration.requiresApproval` is set, the new doc's
  `status` starts `"pending"` (still reserves seats) instead of `"approved"`, and the SMS/email
  sent is a holding message with no reference code — the real confirmation is deferred to
  `setRegistrationStatus`. Email confirmation is provisioned (`sendEmail()`) but no-ops until a
  real provider is wired in (Phase B4, blocked on the church's own comms mailbox existing).
- `attachRegistrationProof` — callable from the same registration modal (Phase B3) — the
  registrant uploads a proof-of-payment file directly to Storage client-side
  (`js/storage-upload.js`), then calls this to persist the resulting URL on their registration
  doc, since `/events/{eventId}/registrations/{id}` otherwise denies client writes entirely. No
  auth requirement (same posture as `registerForEvent`); validates the URL's path actually points
  at that specific registration's own Storage folder so a submitter can't attach a URL to someone
  else's registration.
- `setRegistrationStatus` — callable, requires `events.manage` (Phase C2) — approves or declines
  a pending (or previously declined) registration. Unlike `paymentConfirmed` (a direct client
  write, no business logic), this goes through a transaction because declining releases the
  registration's reserved capacity seats and re-approving re-reserves them, re-checking capacity
  in case seats filled up in the meantime. Approving sends the registrant their reference-code
  confirmation for the first time (withheld while pending); declining sends a "could not be
  accepted" notice. Both best-effort SMS/email, same as `registerForEvent`.
- `lookupRegistration` — callable, no auth requirement (Phase C3) — "Find my registration" for
  registrants with no account on this app. Requires the reference code plus a matching phone or
  email (either, since a registration only guarantees one of the two) — a single field alone
  would make this too easy to guess at church scale. Returns just enough (contact first name,
  attendee count, status, whether proof is already on file) to render an attach/replace-proof
  step that reuses `attachRegistrationProof` — not the full registration.

### YouTube Integration (Sermon Tools)

- `checkYoutubeLiveStatus` — scheduled, every 10 minutes — reads `/homepage/content.serviceTimes` and skips entirely outside a service window (~30 min before to 3 hours after a scheduled service) to conserve API quota; when inside a window, polls the YouTube Data API v3 (`search.list part=id,snippet`, `eventType=live`) for an active broadcast on the configured channel and updates `/homepage/content.liveStream` automatically — including setting `title` from the live video's own YouTube title (HTML entities decoded) so it never shows a stale title from a previous stream. **Exception to the window gate:** if `liveStream.active` is already `true`, ticks keep polling past the window close (capped at 6 hours since `startedAt`) until the stream is confirmed ended — otherwise a broadcast that runs long or ends after the window closes gets stuck showing LIVE until the next scheduled service, possibly days later (this happened in Session 177). Requires the `youtubeApiKey` / `youtubeChannelId` secrets — silently no-ops if unset, leaving the manual "Set Live / End Stream" toggle on `/admin/homepage.html` as the fallback. Frontend consumers of `liveStream` (`members/live.html`, homepage adaptive section, nav LIVE dot) use real-time `onSnapshot` listeners, not one-time gets — pages flip to/from live without a reload, incl. a PWA resumed from memory.
- `fetchYouTubeVideos` — callable, requires `sermons.manage` — pages through the configured channel's uploads playlist via the YouTube Data API v3 (`playlistItems.list`) without exposing the API key to the browser; used by the bulk-import panel on `/admin/sermons.html`. Requires the same `youtubeApiKey` / `youtubeChannelId` secrets as `checkYoutubeLiveStatus`.

### Media Library

- `scanOrphanedMedia` — callable, superadmin only — used by the "Orphaned" tab on `/admin/media.html`. Lists every file actually in the Storage bucket (`bucket.getFiles()`) and cross-references each against every URL/URL-array field across `/siteMedia`, `/gallery`, `/music`, `/sermons` (incl. `materials[]`), `/series`, `/events`, `/blog` (incl. `galleryUrls[]`/`videos[]`), `/team`, and `/config/branding` — anything in Storage but referenced nowhere comes back as an "orphan" candidate. Always excludes `users/{uid}/photo` paths, even if genuinely orphaned (this tool is for site content, not personal data). Run on-demand from the UI, not scheduled — a full bucket listing on every page load isn't worth it at church scale.

---

## Firestore Data Structure

```
/users/{uid}
  uid, email, displayName
  photoURL (nullable)
  phone (nullable)
  membership: "pending" | "public" | "member"
  isSuperadmin: boolean               ← Phase 6 — overrides all permissions
  roles: [string]                     ← Phase 6 — array of /roles/ doc IDs
  extraPermissions: [string]          ← Phase 6 — one-off per-user permission keys
  emailVerified: true | false
  membershipRequestedAt: timestamp | null  ← Phase 7 — set when public user requests membership; cleared on approve/decline
  notifyWhatsApp: true | false        ← Phase 3 — opt-in to receive notifications on WhatsApp (uses phone)
  directoryVisible: true | false      ← appear in /members/directory at all
  directoryShowEmail: true | false    ← expose email in directory
  directoryShowPhone: true | false    ← expose phone in directory
  createdAt, updatedAt (timestamps)

/users/{uid}/notifications/{notificationId}
  title, body, type, sentAt, read: false
  linkUrl (nullable — deep link to relevant page)
  broadcastId (nullable — /notifications log doc ID; lets updateBroadcast/
               deleteBroadcast find every copy; absent on pre-Session-176 copies
               and on non-broadcast notifications)

/users/{uid}/fcmTokens/{tokenId}
  token, device, registeredAt

/sermons/{sermonId}
  title, speaker, date (string YYYY-MM-DD)
  duration (string, e.g. "45 min")
  youtubeId (nullable)
  audioUrl (nullable — Firebase Storage or external)
  materials: [{ url, name }]     ← sermon notes/slides, any mix of PDF/Word/PowerPoint, 0 or more files
  notesUrl: null                 ← legacy single-file field, retired — always null on new saves;
                                    a non-null value only exists on sermons saved before multi-file
                                    support and is read as a 1-item materials[] fallback for display
  seriesId (nullable)            ← references /series/{seriesId}; set via the Series autocomplete
                                    on admin/sermons.html, which creates the series doc on the fly
                                    if the typed name doesn't match an existing one
  seriesOrder (nullable int)     ← this sermon's position within its series
  published: true | false
  createdAt, updatedAt

/series/{seriesId}
  title, description (nullable), imageUrl (nullable — Firebase Storage)
  order (int — display order in the series list/admin panel)
  createdAt, updatedAt

/ignoredYoutubeVideos/{youtubeId}             ← admin tool, sermons.manage gated, no public read
  youtubeId, title (raw YouTube title, for display in the management list)
  ignoredAt, ignoredBy (uid)
  ← permanently excludes a channel video (e.g. a funeral service) from the
    bulk YouTube import results; "Restore" in admin/sermons.html deletes the doc

/events/{eventId}
  title, description, location
  startDate, endDate (timestamps)
  imageUrl (nullable — Firebase Storage)
  audience: "public" | "members"      ← who can SEE this event listed at all
  category: "service" | "group" | "special" | "other"
  published: true | false
  rsvps: [uid array]                  ← members who tapped RSVP/"Going"; written directly by the
                                         client (rules allow a member to touch only this field)
  rsvpEnabled: boolean                ← Phase A (Event Registration) — default true (absent =
                                         enabled) so pre-existing events keep behaving as before;
                                         off hides all RSVP UI for purely informational events
  registration: {                     ← Phase B1 (Event Registration) — off by default, a
                                         separate subsystem from RSVP, see docs/EVENT_REGISTRATION.md
    enabled: boolean
    audience: "public" | "members"    ← who can SUBMIT — independent of the event's own audience
                                         above; enforced server-side in registerForEvent
    refPrefix: string | null          ← e.g. "YC-202603", used to build each registrant's
                                         referenceCode
    capacity: number | null           ← Phase B2 — null/absent = unlimited; set = hard limit,
                                         enforced transactionally in registerForEvent
    requiresApproval: boolean         ← Phase C2 — default false; true starts new registrations
                                         at status: "pending" instead of "approved"
    confirmationTemplate: string | null  ← optional per-event override for the confirmation
                                         SMS/email (null = built-in default); {{title}},
                                         {{referenceCode}}, {{firstName}}, {{lastName}},
                                         {{seatsUsed}} tokens, rendered by renderConfirmationMessage()
    fields: [{ id, label, type, required, options }]  ← admin-defined dynamic questions,
                                         answered per-attendee (Phase C1), not once per registration
    seatsTaken: number                ← Phase B2 capacity check; Phase C1 changed this to count
                                         attendees, not registrations (a 3-child party = 3 seats);
                                         "pending" and "approved" registrations both count,
                                         "declined" releases (Phase C2)
  }

/events/{eventId}/registrations/{id}  ← Event Registration (Phases B1-C3) — created ONLY by
                                         registerForEvent; admin reads/deletes via events.manage,
                                         mirrors /cottageRegistrations. The one client-writable
                                         field is paymentConfirmed (events.manage only, plain
                                         boolean toggle) — status and everything else is
                                         create-only / Cloud-Function-only
  contact: {                          ← Phase C1 — who to reach; NOT assumed to be an attendee
    firstName, lastName               ← lastName drives referenceCode
    phone, phoneKey (nullable)        ← phoneKey = normaliseSaNumber(phone), dedup query key
    email, emailKey (nullable)        ← emailKey = lowercased email, dedup query key
    assembly (nullable)               ← "which assembly are you from"
  }                                   ← at least one of phone/email is required
  attendees: [                        ← Phase C1 — one or more people, e.g. a parent's 3 children
    { firstName, lastName, answers: { [fieldId]: string } }  ← per-attendee dynamic answers
  ]
  seatsUsed: number                   ← Phase C1 — attendees.length
  status: "pending" | "approved" | "declined"  ← Phase C2 — set by registerForEvent at creation,
                                         changed afterwards only via setRegistrationStatus
  referenceCode: string | null        ← refPrefix + "-" + uppercased contact.lastName; one code
                                         covers the whole party regardless of attendee count;
                                         withheld from the registrant (not from this field) while
                                         status is "pending"
  proofOfPaymentUrl: string | null    ← Phase B3 — set via attachRegistrationProof after the
                                         registrant uploads directly to Storage
  paymentConfirmed: boolean           ← Phase B3 — admin toggles after checking the proof
  uid: string | null                  ← set if submitted while signed in; null for public/anonymous
  submittedAt (timestamp)

/blog/{postId}
  title, body, author
  imageUrl (nullable — Firebase Storage)
  kind: "announcement" | "article" | "story"    ← announcements surface on home feed; articles on /blog only; stories link to /story.html detail page; defaults to "article"
  publishedAt, published: true | false

/team/{memberId}
  name, role, bio, photoUrl, order (for sort)
  ← /team entries are independent of /users; team members may not have user accounts

/gallery/{galleryId}
  title, description, date
  audience: "public" | "members" | "youth"
  imageUrls: [array of Storage URLs]
  thumbnailUrl
  published: true | false
  createdAt, createdBy (uid)

/music/{trackId}
  title, artist (performer)
  description (nullable)
  category: "worship" | "choir" | "original" | "instrumental"
  audioUrl (Firebase Storage)
  coverArtUrl (nullable — Firebase Storage)
  durationSeconds (nullable)
  albumName (nullable)
  trackNumber (nullable)
  releaseDate (timestamp)
  downloadable: true        ← all music is downloadable per current policy
  published: true | false
  createdAt, createdBy (uid)

/groups/{groupId}
  name, description
  leaders: [uid array]
  meetingDay, meetingTime, location
  members: [uid array]
  pendingMembers: [uid array]   ← for "approval" joinPolicy
  isPublic: true | false
  joinPolicy: "open" | "approval" | "invite-only"
  chatMode: "open" | "leaders_only"              ← default "open"; "leaders_only" restricts posting to leaders; members can still read

/devotionals/{devotionalId}
  title, body, scripture, scriptureText
  date (one per day)
  publishedBy (uid)

/connect/{submissionId}
  name, email, phone (nullable)
  message, submittedAt
  read: false   ← admin can track unread submissions

/prayer/{requestId}
  uid (author), authorName
  body
  isAnonymous: true | false
  isPrivate: true | false
  submittedAt
  prayedFor: [uid array]

/notifications/{notificationId}
  title, body
  type: "broadcast" | "emergency" | "digest" | "direct"
  audience: "all" | "members" | "admins"
  sentBy (uid), sentAt
  eventId (nullable — /events doc created alongside via the "also add to
           calendar" toggle; informational, the event is independent after creation)
  editedAt, editedBy (nullable — set by updateBroadcast)

/messages/{messageId}
  participants: [uid array]
  senderId, body, sentAt, read: true | false

/roles/{roleId}                             ← Phase 6 — granular permissions
  id: string                                ← matches doc ID
  displayName: string
  description: string
  permissions: [string]                     ← array of permission keys (e.g. "sermons.manage")
  isSystem: true | false                    ← system roles cannot be deleted
  createdAt, updatedAt (timestamps)
  updatedBy: uid (nullable)

/homepage/content                           ← singleton doc (Phase 5 + Phase 7)
  tagline: string
  announcement: { visible: bool, title: string, body: string, expiresOn: "YYYY-MM-DD" | null }
                                             ← expiresOn is optional (Session 190) — js/homepage.js
                                               hides the banner client-side once past this date,
                                               even if visible is still true; admin/homepage.html
                                               shows an "Expired" badge as a reminder to turn it
                                               off, since Firestore's visible flag itself never
                                               auto-flips (no Cloud Function involved)
  serviceTimes: [{ label, day, time }]
  liveStream: {                             ← Phase 7 — managed from admin/homepage.html
    active: true | false,
    title: string,
    youtubeId: string,
    startedAt: timestamp | null,
    updatedAt: timestamp,
    updatedBy: uid
  }

/config/church                              ← singleton doc (Phase 8 — Multi-Church Template)
  displayName, tagline, address, phone (nullable), email (nullable)
  socialLinks: { facebook, youtube, instagram }  ← any may be null if not set
  ← managed from admin/settings.html (superadmin only); see docs/PHASE8.md

/config/branding                            ← singleton doc (Phase 8)
  primaryColor (hex, default "#0A3D62"), accentColor (hex, default "#F59E0B")
  logoUrl (nullable — Firebase Storage)
  ← applied client-side via applyBranding() in js/main.js

/config/notifications                       ← singleton doc (Phase 8)
  connectAlertEmail (nullable)               ← destination for connect form email alerts

/config/features                            ← singleton doc (Phase 8)
  music, gallery, liveStream, messaging, groups, devotional, youthGallery: true | false
                                              ← default true; a false flag hides the nav item and
                                                redirects the admin page, but leaves underlying
                                                Firestore data untouched (re-enabling restores it)
  ← applied client-side via applyFeatures() in js/main.js

/config/pages/{pageId}                      ← one doc per managed page (Phase 9 — Page Composition)
  sections: [{ id, enabled: true | false, order: int }]
  ← pageId is "homepage" | "about" | "members"; toggles/reorders fixed page sections from
    admin/pages.html (superadmin only). No doc for a page = all its sections shown in natural
    HTML order (safe default, no doc needed until a superadmin customises it). See docs/PHASE9.md

/siteMedia/{id}                             ← admin/media.html "General Uploads" — file manifest, superadmin only
  name, url (Storage HTTPS URL), sizeBytes, contentType
  category (nullable string)                ← free-text tag, admin-assignable from the Media
                                                Library's General Uploads tab; the only collection
                                                with a category field — gallery/music/sermons/etc.
                                                are already organised by their own admin pages
  uploadedAt, uploadedBy (uid)
  ← general-purpose upload-and-copy-the-URL tool, not tied to one content type; not read by
    any public page directly — a superadmin uploads here, copies the URL, and pastes it
    wherever it's needed (a page, a download link, an admin field that takes a URL)

/config/cottageRegions                      ← singleton doc (Cottage Meetings)
  regions: [{ id, name }]                   ← superadmin-managed area list

/cottageMeetings/{meetingId}                ← Cottage Meetings
  title (nullable)                          ← optional display title; falls back to regionName
  regionId, regionName
  hostUid, hostName                         ← the deacon running this meeting
  address (multi-line — rendered as typed), date (YYYY-MM-DD), time
  mapsLink (nullable)                       ← Google Maps URL; shown as "Get directions"
  contactName, contactNumber (nullable)     ← on-the-night contact; number shown as tel: link
  capacity (int), seatsTaken (int)          ← seatsTaken maintained by Cloud Functions
  open: true | false                        ← registration open?
  notes (nullable)
  createdAt, createdBy, updatedAt

/cottageRegistrations/{uid}                 ← keyed by member UID (one active registration each)
  uid, meetingId, regionId
  name, phone (nullable), email (nullable)
  partySize (int — total people incl. registrant)
  registeredAt
  ← written ONLY by register/cancel Cloud Functions (transactional capacity); host/superadmin may delete for cleanup

/servingTeams/{teamId}                      ← Serving Teams (see docs/SERVING_TEAMS.md)
  name, description
  leaders: [uid array]
  members: [uid array]
  pendingMembers: [uid array]                ← for "approval" joinPolicy
  memberTiers: { [uid]: "trainee" | "qualified" }  ← per-member training tier, leader-managed
  memberFunctions: { [uid]: [string array] }  ← leader-assigned function eligibility; absent/empty
                                              for a uid = locked out of claiming/seeing slots until
                                              a leader assigns at least one function (enforced in rules)
  memberAvailability: { [uid]: [string array] }  ← Phase 1.7 — "dayOfWeek|label" keys (e.g.
                                              "0|Morning", "3|") for services the member can make;
                                              ABSENT key = no restriction (opposite default from
                                              memberFunctions). Member writes own key (rules-
                                              enforced), leaders write anyone's. Soft — filters the
                                              member's roster view + auto-assign pool only, never
                                              blocks claims or leader assignment
  functions: [string array]                  ← growing free-text list of skills/roles used by this team's slots (e.g. "Sound", "Piano", "Food Helper")
  isPublic: true | false
  joinPolicy: "open" | "approval" | "invite-only"
  createdAt, updatedAt

/servingTeams/{teamId}/schedules/{scheduleId}  ← named, persistent recurrence definition (e.g. "EGC Elands")
  name (string)
  patterns: [{ id, dayOfWeek: 0-6, label: string|null, functions: [string] }]
                                              ← dayOfWeek matches Date#getDay() (0=Sunday)
  startDate, endDate (YYYY-MM-DD)            ← persisted so Edit/Regenerate know what to recreate
  autoAssign (boolean)                       ← Phase 1.7 — generate/regenerate fills lead positions
                                                by rotating qualified + eligible + available members
                                                (fewest assignments first; unfillable slots stay open)
  createdAt, updatedAt, createdBy (uid)
  ← leader/admin only — bulk-creates slots tagged with this schedule's id; editing and saving
    regenerates (deletes its slots, recreates from the corrected definition); deleting cascades
    to its slots too. Both warn with a count, flagging how many affected slots already have a
    volunteer assigned, before doing anything destructive

/servingTeams/{teamId}/slots/{slotId}        ← one roster slot for one date
  date (YYYY-MM-DD)
  label (nullable string)                    ← optional service-time label (e.g. "Morning"/"Evening")
                                                for dates with more than one service; copied from the
                                                schedule pattern that generated this slot, or set manually
  scheduleId (nullable string)               ← which /schedules doc generated this slot; null for a
                                                manually-added slot ("Add Slot") — untouched by any
                                                schedule's regenerate/delete
  functions: [string array]                  ← 1+ function names bundled onto this slot
  assignedUid, assignedName (nullable — open until claimed)
  trainingEnabled: true | false              ← opt-in at creation; when true, slot also carries a trainee position
  traineeUid, traineeName (nullable — independent claim/release from the lead position)
  status: "open" | "filled"                  ← derived from assignedUid, stored for query convenience
  notes (nullable)
  createdAt, updatedAt, createdBy (uid)
  ← claim/release done client-side via db.runTransaction() for race-safety — no Cloud Function needed
  ← bulk-created by a /schedules doc (members/serving-teams.html), chunked into Firestore batches
    of <=450 writes (limit is 500) to handle a 6-month, 3-services/week roster
```

---

## Media Storage — Designed for Migration

ALL media files (gallery images, music, sermon audio, blog/event covers, profile
photos, etc.) follow this pattern so that migrating to Cloudflare R2 (or any other
host) is a zero-schema-change operation:

1. **Firestore stores URLs as plain strings** — never Storage SDK references or
   `gs://` URIs. Always the public HTTPS URL returned by `getDownloadURL()`.
2. **Render code is host-agnostic** — `<img src={url}>` / `<audio src={url}>` works
   with any public URL (Firebase, R2, CDN). Public pages never load the Storage SDK.
3. **Upload is the only swappable layer** — only `js/storage-upload.js`
   (`uploadMedia(path, file)` → HTTPS URL, and `deleteMedia(url)`) knows about Firebase
   Storage. Admin pages call it and store the returned string. To migrate hosts, rewrite
   that one module — no Firestore documents, rendering code, or admin form logic change.

### Migration trigger

Monitor Firebase Storage usage monthly. Migrate to Cloudflare R2 when approaching
**4GB used** OR when bandwidth (egress) charges first appear on the bill:

- R2: 10GB free storage, **zero egress (bandwidth) fees**
- Migration: copy files to R2 → update the URL strings in Firestore → done
- Existing rendering code requires no changes

Sermon video stays on YouTube (primary) — `youtubeId` in Firestore, thumbnails/embeds
via YouTube public URLs. Playback on `/sermons.html` is in-page (a modal with a YouTube
`embed` iframe) rather than navigating to youtube.com — see Sermon Media Strategy below.

---

## Sermon Media Strategy

- **Video delivery:** YouTube (primary) — store `youtubeId` in Firestore
- **Playback:** in-page modal (`openVideoModal()` in `js/sermons.js`) loads a YouTube
  `embed` iframe with `autoplay=1` — visitors never leave `/sermons.html`. Triggered from
  the "Watch" button (table/card/series-detail views) and the card/series-detail
  thumbnails. Closes on the × button, backdrop click, or Escape; closing clears the
  iframe `src` so playback actually stops. Same pattern as `story.html`'s video modal
  (both share the identical CSS/JS — keep them in sync if one changes).
  - **Modal sizing** fits within both viewport width AND height (`width: min(56rem,
    100vw-2rem, (100vh-6rem)*16/9)`) — a width-only cap would let a 16:9 box exceed the
    screen height on a landscape phone (wide but short).
  - **Fullscreen + rotation:** the iframe's `allow` list includes `fullscreen`; on
    `fullscreenchange`, `handleVideoFullscreenChange()` attempts
    `screen.orientation.lock('landscape')` so a physical rotation fills the screen.
    Android Chrome only — iOS Safari has no Screen Orientation API and fails silently;
    rotation behavior there depends on the device's own OS-level rotation-lock setting.
  - **`manifest.json`'s `orientation` must stay `"any"`** (not `"portrait"`) for this to
    work at all in the **installed PWA**. When installed on Android, the OS hosts the app
    as its own Activity with the manifest's `orientation` baked in as a native,
    OS-enforced constraint — no in-page JS (including `screen.orientation.lock()`) can
    override it. This is why rotation worked in a regular Chrome tab (manifest
    `orientation` doesn't apply there) but not in the installed app, before this was
    changed. Trade-off: this also lets every *other* page rotate to landscape when
    installed, not just the video player — there's no per-page manifest setting.
    `manifest.json` and `service-worker.js` get an explicit `Cache-Control: no-cache`
    header in `firebase.json` (Firebase Hosting's default was caching them for 1 hour) so
    a change like this reaches browsers/CDN immediately — separate from, and not a fix
    for, Android's own WebAPK rebuild delay (the native app wrapper for an *already
    installed* PWA can take a while to pick up a manifest change; Chrome periodically
    re-checks in the background, independent of our cache headers).
- **Video backup:** Cloudflare R2 or Internet Archive (originals preserved off YouTube)
- **Audio files:** Firebase Storage at `/sermons/{sermonId}/audio.mp3`
- **Sermon notes/materials (PDF, Word, or PowerPoint, multiple files allowed):** Firebase Storage at `/sermons/{sermonId}/materials/{timestamp}_{index}_{filename}` — original filenames/extensions preserved; the sermon doc's `materials[]` array stores `{ url, name }` per file
- **Thumbnails:** YouTube public thumbnail URL — no API key required
  - `https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg`

### Sermon Admin Upload Flow

1. Paste YouTube URL → script extracts video ID
2. Thumbnail auto-previews from YouTube
3. Fill in metadata (title, speaker, date, scripture, description)
4. Optional: upload audio file and/or one or more sermon notes/materials (PDF, Word, or PowerPoint)
5. Toggle published on/off before saving
6. Save writes to Firestore — page updates immediately

---

## Music & Gallery Strategy

### Music

- All music files stored in Firebase Storage at `/music/{trackId}/audio.mp3`
- Optional cover art at `/music/{trackId}/cover.jpg`
- Public access — anyone can stream or download (no login required)
- Categories: worship, choir, original, instrumental
- HTML5 `<audio>` player on the public music page for inline streaming
- Direct download link beside each track
- Optional album grouping via `albumName` and `trackNumber` fields
- **Storage cost note:** music libraries grow quickly. See [Media Storage — Designed for Migration](#media-storage--designed-for-migration) — migrate to Cloudflare R2 when approaching 4GB used or when egress charges appear; store the R2 public URL string in Firestore (no schema change).

### Galleries

- Single `/gallery` collection serves three contexts via the `audience` field
- Images stored at `/gallery/{galleryId}/{imageId}.jpg` in Firebase Storage
- **Public galleries** (`audience: "public"`): visible on `/gallery.html`, no login required
- **Member galleries** (`audience: "members"`): visible on `/members/gallery.html` for approved members
- **Youth galleries** (`audience: "youth"`): visible on `/members/gallery.html` under a "Youth" tab — also requires member access
- Single admin page at `/admin/gallery.html` handles all three — editor selects audience when creating a gallery
- `thumbnailUrl` field stores the cover image used in gallery listings (one image per gallery)

---

## Member Directory Privacy

- Directory at `/members/directory.html` shows only members who have `directoryVisible: true`
- New members default to `directoryVisible: true` but `directoryShowEmail: false`, `directoryShowPhone: false`
- Each member controls their own visibility settings from `/profile.html`
- Always shown to other members: `displayName`, `photoURL`, `membership` status
- Optionally shown (per user opt-in): `email`, `phone`
- Never shown: `isSuperadmin`, `roles`, `extraPermissions`, internal flags, approval metadata

---

## Group Membership Flow

### Permission Model

Group management is split between two surfaces to keep the admin guard simple:

- **`/admin/groups.html`** — editor or superadmin only — full management of ALL groups (create, delete, edit, change leaders)
- **`/members/groups.html`** — any member — browse and join groups, AND leader-only sections to manage their own group's members

This means a group leader who is NOT an admin manages their group from the members area, not the admin area. The admin auth guard checks custom claims only — no special cases needed.

### Join Policy

`joinPolicy` field on each group controls how members join:

- `open` — any member can join immediately, no approval
- `approval` — member requests via `pendingMembers` array, group leader approves (moves UID from `pendingMembers` to `members`)
- `invite-only` — only group leader or admin can add members

### Security Rules

Firestore rules for `/groups/{groupId}` updates:

- Editors and superadmins can write any field
- A group's leader can write only `members` and `pendingMembers` for their own group
- Members can add/remove their own UID from `pendingMembers` or `members`

---

## Firebase

- Project ID: `egc-church`
- Auth domain: `egc-church.firebaseapp.com`
- Google Authentication: enabled
- Email/Password Authentication: enabled
- Email verification: required before member approval — resend supported from /profile.html
- Password reset: handled by Firebase Auth's built-in `sendPasswordResetEmail()` — link on /login.html
- Firestore database: `(default)` in nam5 region (production mode)
- Firebase Storage: in use (audio, sermon notes/materials, images, music, cover art)
- Cloud Messaging (FCM): deployed — VAPID key configured, token registration in js/notifications.js
- Cloud Functions: deployed — don't trust any hardcoded count (it drifts); see "Cloud Functions Architecture" above for the full, current list
- Authorised domains: localhost, 127.0.0.1, egcchurch.github.io, egc-church.firebaseapp.com, egc-church.web.app, staging.egc.church, app.egc.church
- Billing plan: **Blaze (pay-as-you-go)** — required for Cloud Functions; usage stays within free tier at church scale
- Required composite indexes (defined in `firestore.indexes.json`):
  - `users`: `membership ASC, createdAt DESC` (admin user listing)
  - `users`: `membership ASC, directoryVisible ASC` (member directory)
  - `sermons`: `published ASC, date DESC` (public sermons list)
  - `events`: `published ASC, startDate ASC` (public events list)
  - `blog`: `published ASC, publishedAt DESC` (public blog list)
  - `blog`: `published ASC, kind ASC, publishedAt DESC` (homepage announcements vs articles split)
  - `conversations`: `participants CONTAINS, lastMessageAt DESC` (messages inbox)
  - `conversations`: `groupId ASC, type ASC` (group chat lookup)
  - `gallery`: `audience IN, published ASC` (members/gallery.html — members + youth galleries)
- **`collectionGroup()` queries need an explicit field override, always** — despite what a couple of
  code comments used to claim, Firestore does NOT auto-index a field for `COLLECTION_GROUP` scope
  just because it's auto-indexed for `COLLECTION` scope; a bare `db.collectionGroup(x).where(field, ...)`
  with no matching override throws `FAILED_PRECONDITION` at call time — no compile-time or deploy-time
  warning. Confirmed the hard way in Session 179: `sendServingSlotReminders`'s `collectionGroup('slots')
  .where('date', ...)` had been silently failing on **every single run since it was deployed** (no slot
  reminders ever sent), and `updateBroadcast`/`deleteBroadcast`'s new `collectionGroup('notifications')
  .where('broadcastId', ...)` failed on first real use. `fieldOverrides` in `firestore.indexes.json` fixes
  this — see the `notifications`/`sentAt` entry (already correct, from `pruneOldNotifications`) and the
  `notifications`/`broadcastId` and `slots`/`date` entries added in Session 179. **Whenever adding a new
  `collectionGroup()` query on a field that doesn't already have a `fieldOverrides` entry, add one and
  deploy it (`firebase deploy --only firestore:indexes`) before relying on the query working.** A field
  override REPLACES that field's default indexing, not adds to it — always re-list the `COLLECTION`
  ASCENDING/DESCENDING entries alongside the new `COLLECTION_GROUP` one if anything already queries that
  field within a single collection (e.g. `slots`/`date`'s existing per-team `orderBy('date','asc')`).

---

## Firebase Storage Paths

```
/sermons/{sermonId}/audio.mp3
/sermons/{sermonId}/materials/{timestamp}_{index}_{filename}  ← 0+ files, mixed pdf/doc/docx/ppt/pptx
/team/{memberId}/photo.jpg
/users/{uid}/photo               ← user profile photos (separate from /team photos)
/events/{eventId}/cover.jpg      ← event hero image
/events/{eventId}/registrations/{registrationId}/{timestamp}_{filename}  ← Event Registration
                                       Phase B3 — proof-of-payment upload; public create (no
                                       auth required), admin-only read/delete
/blog/{postId}/cover.jpg         ← blog featured image
/gallery/{galleryId}/{imageId}.jpg
/music/{trackId}/audio.mp3
/music/{trackId}/cover.jpg       ← optional cover art
/site-media/{timestamp}_{filename}  ← admin/media.html general uploads (superadmin only);
                                       images/audio/documents, 150MB max for audio
```

Storage rules enforce file size and type per path (see `storage.rules`):

- Images: 5MB max, `image/*` only
- Audio: 100MB max, `audio/*` only
- Sermon notes/materials: 50MB max — PDF, Word (`.doc`/`.docx`), or PowerPoint (`.ppt`/`.pptx`) only

---

## Account Deletion / GDPR

- Users can request account deletion from `/profile.html`
- Deletion is a Cloud Function (`deleteUserAccount`) that removes:
  - Firebase Auth account
  - `/users/{uid}` document and all subcollections (notifications, fcmTokens)
  - User's profile photo from Storage
  - User's UID is anonymised in shared content (sermons they created, prayer requests, etc.) — content remains but `createdBy` is replaced with "deleted-user"
- Connect form submissions, gallery uploads, and other content authored by the user remain visible — only personal identifying data is removed

---

## Architecture / Design Decisions

- No frontend frameworks — vanilla HTML, CSS, JS only
- Tailwind CSS v4 pre-built static CSS — generated at CI deploy time by `@tailwindcss/cli`, committed to repo for local dev
- Firebase is the only approved external dependency (plus Tailwind and Font Awesome)
- Firebase Hosting (not GitHub Pages) — supports per-PR preview channels, CDN, custom domains, multi-site
- All paths use `/` as root (not `/egc-church/` — that was the old GitHub Pages subpath)
- firebase-config.js is committed (Firebase web configs are public-facing by design)
- Colour scheme: amber (#F59E0B) + navy (#0A3D62) — see "Design System" below for the full convention set
- Service worker: cache-first for static assets, network-first for HTML pages
- Hero video (CloudVideo.mp4) excluded from caching — too large
- Firebase auth/API calls excluded from SW interception — must always be live
- Cache version: bump on each deploy with breaking changes. **Don't hardcode the current version number
  in prose anywhere** (including this file) — it drifts immediately and silently every time someone bumps
  it without updating the doc. Always read `CACHE_NAME` at the top of `service-worker.js` for the actual
  current value.
- **Bump the cache version on ANY content edit to an already-precached `.js`/`.css`/image file, not just
  when adding a new page.** Static assets matching `\.(png|jpg|jpeg|svg|ico|js|json|css|webp)$` use
  cache-first in `service-worker.js` — once a path is cached under a `CACHE_NAME`, that strategy serves
  the cached copy forever and never re-checks the network for that path, no matter how many times the
  underlying file is redeployed.
- **`/js/**` gets an explicit `no-cache` header in `firebase.json`** (same as `manifest.json` and `service-worker.js`). Firebase Hosting defaults to `max-age=3600`, so a phone's plain HTTP cache can serve stale JS for up to an hour — independent of the Service Worker, and not cleared by reinstalling the PWA or switching browsers. `no-cache` still caches; it forces a cheap `304` revalidation instead of blindly trusting the local copy.
- Service worker cache list must be updated whenever a new page is added — CI check enforces this
- Role checks in JS are UX only — Firestore Security Rules are the real enforcement layer
- Firestore security rules are tested in CI via `@firebase/rules-unit-testing` against the Firebase emulator
- **In `storage.rules`, never use a combined `allow write: if isAdminUser() && isValidImage();` rule.** `request.resource` does not exist on `delete`, so the content-validator throws and the whole rule is denied silently — the file stays in Storage with no error shown. Always split: `allow create, update: if isAdminUser() && isValidImage();` plus a separate `allow delete: if isAdminUser();`. `tests/storage.rules.test.js` guards this for every path.
- `published` flag on all content — editors can save drafts without going live
- Cloud Functions used for any operation that requires touching another user's data (broadcasts, DM push, alert fan-out, scheduled tasks, auto-create user docs, account deletion)
- Cloud Functions use firebase-functions **v1** API — v2 blocking functions require GCIP paid upgrade
- Galleries use a single collection with an `audience` field rather than separate collections per audience — simpler admin UX
- All music is public-access and downloadable — reflects current church policy
- Member directory privacy is opt-out for visibility, opt-in for contact details — protects member contact info by default
- Group join policy is per-group, not a global setting — different groups have different needs
- Group leaders manage their own group from `/members/groups.html`, not `/admin/` — keeps admin guard simple
- Messaging is group/team broadcast only — no 1-to-1 direct messaging; `participants` is an array covering all group or team members
- `/team` entries are independent of `/users` — team members are content records, not user accounts
- Auth guards (`admin-auth.js`, `member-auth.js`) must wait for both `firebase` AND `firebase.firestore` to be ready before running — otherwise they redirect before Firestore is initialised
- **Media Library** (`/admin/media.html`) aggregates files from every content collection into one browsable/searchable view, but **only lets you delete a file from the "General Uploads" (siteMedia) and "Orphaned" tabs** — never a file actively referenced by a gallery, sermon, music track, etc. Deleting those stays on that feature's own admin page, where the Storage delete and the Firestore reference removal happen together; deleting straight from the aggregator would leave a dangling reference (e.g. a gallery doc whose `imageUrls[]` still points at a file that no longer exists). The "Manage" link on every non-general row goes to the right admin page instead.
- **Category tagging is scoped to `/siteMedia` only**, not a site-wide folder system — gallery/music/sermons/events/blog/team are already organised by their own titles, dates, and admin pages; `/siteMedia` is the one collection that's an unstructured dropbox by design (general one-off uploads), so it's the one place tagging actually solves a real "this is getting messy" problem.
- Development uses local Claude Code (not the GitHub Claude agent) — uses subscription instead of API costs

---

## Design System

For any visual/design work — read this before proposing changes, and verify every specific claim
(a class, a section, a cache version, a page) against the actual current files rather than against
memory of an earlier version of this site or a comparison to the old site. This codebase has diverged
substantially from earlier iterations; several things that used to exist no longer do (e.g. there is no
scripture-quote section on the homepage), and some things assumed to be missing already exist (e.g.
`/admin/settings.html`). A wrong assumption here is the single most common source of bad design
suggestions seen so far — always grep/read first.

- **Colours:** navy `#0A3D62` (primary — header bars, nav, dark sections), amber `#F59E0B` (accent —
  CTAs, active states, highlights). Both are also runtime-editable via `/config/branding`
  (`primaryColor`/`accentColor`, Phase 8) and applied client-side by `applyBranding()` in `js/main.js` —
  but the hardcoded Tailwind classes (`bg-[#0A3D62]`, `text-amber-500`, etc.) throughout the static HTML
  are the actual default/fallback values and what's used in 95% of places; don't assume every navy/amber
  usage reads from Firestore.
- **Icons:** Font Awesome 6.5.1 via CDN, **never emoji**. An icon sits in a tinted square/circle container;
  the established, **site-wide** pattern (quick links, dashboard cards, marketing grids alike) is
  `bg-[#0A3D62]/10` container + `text-amber-500` icon, uniformly — never a different colour per card
  (`blue-100`/`purple-100`/`green-100`/etc.). This used to vary by context (member-area dashboards one way,
  the homepage Explore grid alternating two treatments another way) but was unified in Session 131 across
  `index.html`, `members/index.html`, and `admin/index.html` — if you find a per-item-coloured icon
  anywhere else, it predates this and should be fixed to match, not treated as an intentional exception.
  Dashboard-style cards with a title + description (member/admin dashboards) also get a trailing
  `fa-chevron-right` (`text-zinc-300`) on the far right as a tap affordance, in a compact horizontal row
  (icon left, text right) rather than icon-on-top — see `members/index.html` for the reference markup.
  Simple icon-tiles with no description text (homepage Explore grid) keep the icon-on-top, label-below,
  centered tile shape — just with the colour unified.
- **Corners/shape:** `rounded-2xl` for cards/panels, `rounded-xl` for icon containers, `rounded-full` for
  buttons and pills.
- **Tailwind:** v4 pre-built static CSS (`assets/css/tailwind.css`) — built at deploy time by the
  `@tailwindcss/cli` step in `deploy.yml` and `preview.yml` (input: `assets/css/tailwind-input.css`
  which just contains `@import "tailwindcss";`; Tailwind v4 auto-scans all HTML files). The built
  CSS is also committed to the repo for local development (no build step required locally). Arbitrary-
  value classes like `bg-[#0A3D62]/10` work fine — just make sure any dynamically inserted element
  with new Tailwind classes also has those classes somewhere in the static HTML source so they get
  picked up at build time. Bump the cache version when the CSS changes (see cache-version note).
  **⚠ CLI scanner limitation:** the scanner only reads static source files — it cannot see Tailwind
  classes added at runtime by JavaScript. A class used only in `element.classList.add('...')` or
  a template string in JS will be absent from the built CSS and silently have no effect. Two safe
  approaches: (1) **preferred** — use inline `style` / `style.cssText` for any element created or
  heavily modified in JS (this is already the pattern in the auth overlays, notification toasts,
  and slot highlights — keep it); (2) if you must use a Tailwind class in a JS-generated element,
  ensure that exact class string also appears verbatim somewhere in a static HTML file so the
  scanner picks it up.
- **Shared partials (nav.html, admin-nav.html, members-nav.html, footer.html):** injected into a
  placeholder div via `fetch(file).then(html => placeholder.innerHTML = html)` in `js/nav.js`. **A
  `<script>` tag inside a partial fetched this way will never execute** — script tags inserted via
  `innerHTML` don't run, by browser design. Any JS needed to populate a partial's dynamic content
  (`js/notifications.js`, `js/search.js`, `js/footer.js`) is a separate file, dynamically appended via
  `document.createElement('script')` *after* the partial is injected — see `js/nav.js` for the established
  pattern. Follow it for any new shared partial; don't add inline scripts to the partial file itself.
- **Adding the footer to a new public page:** add `<div id="footer-placeholder"></div>` before `</body>`
  — `js/nav.js` handles the rest automatically (and skips injection entirely on `/admin/` and
  `/members/` paths). No other wiring needed.
- **Homepage section order is partly fixed, partly admin-configurable:** the hero, live stream
  banner, announcement banner, adaptive section, and service times are fixed HTML order (not
  configurable) — in that order (Session 178: the live banner and announcement banner both sit
  directly below the hero, ahead of the adaptive section, so neither is delayed by whatever an
  auth state needs to fetch). Everything inside `<div data-sections-container="homepage">`
  (Latest Sermons, Explore, Connect CTA) can be toggled/reordered by a superadmin via
  `/admin/pages.html` → `/config/pages/homepage` (Phase 9). Check which bucket a section is in
  before assuming a reorder is a simple HTML edit.
- **The homepage live stream banner is NOT part of the adaptive section** — it's a separate
  top-level `#live-banner-section` div, populated by `renderLiveBannerSection()` in
  `js/homepage.js`, called from `renderAdaptive()` as soon as membership is known (before any of
  that state's own announcements/devotional/events fetches). Members get the full banner
  (`buildLiveBanner` — also shows a "next service" fallback when nothing is live); visitors/public
  get the compact teaser (`buildLiveTeaser`) only while something is actually live; pending users
  get nothing. This split exists so the live banner and the admin-set announcement banner are
  always the first two things after the hero, regardless of auth state — see Session 178.

---

## Constraints & Rules

- Do not introduce frontend frameworks
- Do not change the folder structure without asking
- No build tools or bundlers — must remain plain static files
- Firebase is the only approved CDN dependency (plus Tailwind and Font Awesome)
- Keep nav consistent across all pages
- PowerShell scripts must use ASCII only — no Unicode or emoji
- Update service-worker.js cache list AND bump cache version whenever a new page is added (CI check enforces this)
- All paths must use `/` as root (not `/egc-church/`)
- Cloud Functions use firebase-functions **v1** (`functions.auth.user().onCreate`) — v2 `beforeUserCreated` requires GCIP paid upgrade
- All changes go through a Pull Request — `main` is protected, CI checks must pass before merge
- **`deploy.yml` only deploys Firebase Hosting (static site)** — Cloud Functions are NEVER auto-deployed by CI. After merging any PR that changes `functions/`, manually run `firebase deploy --only functions`
- Append a session entry to `PROGRESS.md` on every PR
- **Branch sequentially, never in parallel** — when a session produces multiple PRs, wait for each to merge to `main` before creating the next branch. Never create two branches from the same base commit when they modify the same files (e.g. `functions/index.js`). This avoids merge conflicts on rebase.
- **Discussion must conclude before coding** — when the user asks a question or is describing a requirement, answer the question and wait. Only start writing or deploying code when the user explicitly signals to proceed (e.g. "go ahead", "fix it", "do it"). Do not jump into implementation while the user is still providing context.
- **No Claude attribution in commits or PRs** — do not add "Co-Authored-By: Claude", "Generated with Claude Code", or any similar AI attribution to commit messages or pull request bodies.

---

## How to Run Locally

Two options:

**Option 1: Firebase Hosting emulator** (closest to production)

```
firebase serve
```

Site serves at http://localhost:5000

**Option 2: Live Server** (faster reload, but auth and Firestore still hit live Firebase)
Open in VSCode, click Go Live. Site serves at http://127.0.0.1:5500

---

## Running Security Rules Tests

```
firebase emulators:start --only firestore,storage
```

In a second terminal:

```
npx mocha --timeout 10000 tests/firestore.rules.test.js tests/storage.rules.test.js
```

Or via npm (runs every `tests/**/*.test.js` file, Firestore + Storage + the pure
`computePermissions.js` tests):

```
npm test
```

---

## Deploying

Deploys happen automatically via GitHub Actions on merge to `main`. Manual deploys:

```
firebase deploy --only hosting:production    ← static site to prod
firebase deploy --only hosting:staging       ← static site to staging
firebase deploy --only functions             ← Cloud Functions
firebase deploy --only firestore:rules       ← Firestore security rules
firebase deploy --only storage               ← Storage security rules
```

---

## Development Workflow

The agentic-style local workflow:

1. Pull latest `main` and create a feature branch
2. Run `claude` in the terminal — it auto-loads CLAUDE.md
3. Describe the feature in plain English
4. Claude Code writes the code, shows diffs for approval, commits and pushes
5. Open PR on GitHub — CI runs automatically (preview deploy + 3 checks)
6. Review the preview URL, merge if good
7. Production auto-deploys
8. Delete branch locally and remotely

> **Multi-PR sessions:** If a session needs more than one PR, do them one at a time — wait for each PR to merge before creating the next branch. Never branch multiple features from the same base commit when they touch overlapping files. This keeps rebases conflict-free.

---

## Current Phase

All 9 phases (Foundation through Page Composition) are complete and deployed. Design docs in `docs/`.

**Active / pending:**
- **Event Registration** — per-event RSVP toggle + dynamic registration forms for camps/special
  events, in progress (`docs/EVENT_REGISTRATION.md`); Phase B4 (real email) blocked on the
  church's own domain/comms mailbox existing post-launch
- **WhatsApp Stage 2** — blocked on church obtaining a WhatsApp Business sender number (`docs/WHATSAPP.md`)
- **Serving Teams Phase 2** — Equipment Register + Moves (future; `docs/SERVING_TEAMS.md`)
