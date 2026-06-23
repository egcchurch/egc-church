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
| Styling       | Tailwind CSS (CDN browser build)                                     |
| Icons         | Font Awesome 6.5.1 (CDN)                                             |
| Backend       | Firebase (Auth, Firestore, Storage, FCM)                             |
| Hosting       | Firebase Hosting (multi-site: egc-staging777, egc-app777)            |
| CI/CD         | GitHub Actions — PR preview, security rules tests, link/cache checks |
| Source ctrl   | GitHub — `main` is protected production branch                       |
| Notifications | Firebase Cloud Messaging (FCM)                                       |
| Functions     | Firebase Cloud Functions v1 (broadcasts, DM push, alerts)            |
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
├── connect.html                ← Visitor connect form (public)
├── gallery.html                ← Public gallery (public)
├── music.html                  ← Music library (public)
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
│   └── roles.html              ← Define and manage permission roles (Phase 6)
│
├── functions/                  ← Firebase Cloud Functions
│   ├── index.js                ← Function entry — auth, Firestore, scheduled, callable triggers
│   ├── computePermissions.js   ← Pure helper: computeEffectiveClaims, permissionFieldsChanged
│   ├── rolesData.js            ← Shared role data: ALL_PERMISSIONS, DEFAULT_ROLES (used by seed + migrate)
│   ├── seedRoles.js            ← One-time seed script for /roles collection (Phase 6, manual run)
│   ├── package.json            ← Node dependencies (firebase-admin, firebase-functions)
│   └── .gitignore              ← Excludes node_modules
│
├── firebase-config.js          ← Firebase init (committed, public)
├── firebase.json               ← Firebase Hosting multi-site config (manifest.json and
│                                  service-worker.js get an explicit no-cache header —
│                                  see Sermon Media Strategy / orientation note for why)
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
│   └── firestore.rules.test.js ← Firestore security rules tests (mocha + emulator)
│
├── assets/
│   ├── css/                    ← Custom stylesheets
│   ├── images/
│   │   ├── icons/              ← PWA icons (8 sizes, 72-512px)
│   │   └── logo.png            ← EGC logo source
│   └── videos/
│       └── CloudVideo.mp4      ← Hero background video (not cached — too large)
│
├── js/
│   ├── auth.js                 ← Firebase auth logic
│   ├── admin-auth.js           ← Auth guard for admin pages (role check)
│   ├── member-auth.js          ← Auth guard for member pages (membership check)
│   ├── main.js                 ← Global nav, auth state, mobile menu, SW reg
│   ├── sermons.js              ← Sermons page (Firestore)
│   ├── events.js               ← Events page (Firestore)
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

| Page                 | URL      |
| -------------------- | -------- |
| Homepage             | /        |
| Sermons archive      | /sermons |
| Events / calendar    | /events  |
| Blog / announcements | /blog    |
| About / leadership   | /about   |
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

### Direct Messaging (member to member)

- One-to-one only (current scope) — `participants` array supports two UIDs
- Firestore real-time listeners on `/conversations/{conversationId}/messages/`
- Conversation list and message thread both update live
- New message triggers a Cloud Function that pushes FCM to recipient

### Broadcast Types

| Type                 | Audience    | Delivery                    |
| -------------------- | ----------- | --------------------------- |
| Service reminder     | All members | FCM push + in-app           |
| Public event notice  | All members | FCM push + in-app           |
| Emergency notice     | All members | FCM push + in-app           |
| Weekly digest        | All members | FCM push (Sunday scheduled) |
| Direct message       | Individual  | FCM push + in-app           |
| Prayer request alert | All members | In-app only                 |
| Connect form alert   | Admins      | In-app only                 |

---

## Cloud Functions Architecture

All Cloud Functions live in `/functions/index.js` and are deployed separately from the static site.

**Important:** Functions use **firebase-functions v1** API (`functions.auth.user().onCreate`). The v2 `beforeUserCreated` blocking function trigger requires Google Cloud Identity Platform (GCIP) — a paid upgrade beyond standard Firebase Auth.

Functions are organised by trigger type:

### HTTP / Callable Functions (Phase 4)

- `sendBroadcast` — called from `/admin/notifications.html` — accepts notification payload and audience, fans out to matching FCM tokens, also writes per-user copies to `/users/{uid}/notifications/`

### Firestore Triggers (Phase 4)

- `onNewMessage` — trigger: `/conversations/{conversationId}/messages/{messageId}` created — pushes FCM to recipient (with `webpush.notification.data: { linkUrl: '/members/messages.html?conv={convId}' }` for `notificationclick` tap navigation) and writes in-app notification
- `onNewPrayerRequest` — trigger: `/prayerRequests/{requestId}` created — if `isPrivate: false`, writes in-app notification to all members; if `isPrivate: true`, writes in-app notification to admins only
- `onNewConnectForm` — trigger: `/connectForms/{submissionId}` created — writes in-app notification to all admins

### Scheduled Functions (Phase 4)

- `weeklyDigest` — runs every Sunday morning — compiles recent sermons, events, and announcements, fans out FCM push to all members

### Auth Triggers (Phase 1 — DEPLOYED)

- `onUserCreate` — trigger: new Firebase Auth user — creates `/users/{uid}` doc with `membership: "pending"`, `isSuperadmin: false`, `roles: []`, `extraPermissions: []`, `emailVerified: false`, default privacy flags

### Phase 5

- `deleteUserAccount` — callable from `/profile.html` — performs GDPR-compliant account deletion (see Account Deletion section)

### Phase 6

- `syncUserClaims` — trigger: `/users/{uid}` write — recomputes effective permissions from `user.roles` + `user.extraPermissions`, writes to Firebase Auth custom claims (`{ superadmin: true }` or `{ superadmin: false, perms: [...] }`). Skips if no permission-relevant fields changed. Helper logic in `functions/computePermissions.js` (pure module, tested independently).
- `migrateRolesV1` — callable (superadmin only) — one-time Phase 6 migration: (1) seeds `/roles/` with 7 default roles if empty; (2) iterates all user docs in batches of 100 and sets `isSuperadmin`, `roles`, `extraPermissions` (idempotent — skips users where all three fields already exist). Returns `{ usersUpdated, rolesSeeded, errors }`. Already run on staging and production.

### Phase 7

- `requestMemberAccess` — callable from `/profile.html` — allows `public` users to request membership; writes `membershipRequestedAt: serverTimestamp()` to their user doc and sends in-app notification to all users with `users.approve` permission. 24h idempotency guard prevents repeat notifications.
- `syncUserNotificationEligibility` — trigger: `/users/{uid}` write — if `membership` drops from `member` to anything else, deletes all docs in `/users/{uid}/fcmTokens` subcollection so the user stops receiving push notifications.
- `cleanupNonMemberTokens` — callable (superadmin only) — one-time migration: deletes FCM token subcollections for all users where `membership !== 'member'`. Already run on production.

### Cottage Meetings (Phase 1)

- `registerForCottageMeeting` — callable from `/members/cottage.html` — transactionally reserves seats (no overselling), enforces one active registration per member, writes `/cottageRegistrations/{uid}` (incl. the member's phone, captured at registration), increments the meeting's `seatsTaken`, and sends an in-app + push confirmation with the venue/date/time. **Phase 2:** also sends an **SMS via SMSPortal** (`POST rest.smsportal.com/v3/BulkMessages`, Basic auth) when the member **opts in** (a checkbox on the register form, default off) and a number is available, and the `SMSPORTAL_CLIENT_ID` / `SMSPORTAL_API_SECRET` secrets are set — best-effort, never blocks registration. The member's profile number is authoritative (edited on `/profile.html`); a number is only typed at registration when the profile has none, and that number **back-fills the profile** (only when empty). WhatsApp + per-member channel preferences are a planned later phase. **Deploy note:** both SMSPORTAL secrets must exist in Secret Manager before deploying this function (listed in its `runWith`).
- `cancelCottageRegistration` — callable from `/members/cottage.html` — transactionally frees the seats and deletes the member's registration.

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
  published: true | false
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
  audience: "public" | "members"
  category: "service" | "group" | "special" | "other"
  published: true | false

/blog/{postId}
  title, body, author
  imageUrl (nullable — Firebase Storage)
  kind: "announcement" | "article"    ← Phase 7 — announcements surface on home feed; articles on /blog only; defaults to "article"
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
  announcement: { active: bool, title: string, body: string }
  serviceTimes: [{ label, day, time }]
  liveStream: {                             ← Phase 7 — managed from admin/homepage.html
    active: true | false,
    title: string,
    youtubeId: string,
    startedAt: timestamp | null,
    updatedAt: timestamp,
    updatedBy: uid
  }

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
  functions: [string array]                  ← growing free-text list of skills/roles used by this team's slots (e.g. "Sound", "Piano", "Food Helper")
  rosterPatterns: [{ id, dayOfWeek: 0-6, label: string|null, functions: [string] }]
                                              ← saved recurrence rules for the Generate Roster bulk-create
                                                tool, reused across runs; dayOfWeek matches Date#getDay()
  isPublic: true | false
  joinPolicy: "open" | "approval" | "invite-only"
  createdAt, updatedAt

/servingTeams/{teamId}/slots/{slotId}        ← one roster slot for one date
  date (YYYY-MM-DD)
  label (nullable string)                    ← optional service-time label (e.g. "Morning"/"Evening")
                                                for dates with more than one service; copied from the
                                                roster pattern that generated this slot, or set manually
  functions: [string array]                  ← 1+ function names bundled onto this slot
  assignedUid, assignedName (nullable — open until claimed)
  trainingEnabled: true | false              ← opt-in at creation; when true, slot also carries a trainee position
  traineeUid, traineeName (nullable — independent claim/release from the lead position)
  status: "open" | "filled"                  ← derived from assignedUid, stored for query convenience
  notes (nullable)
  createdAt, updatedAt, createdBy (uid)
  ← claim/release done client-side via db.runTransaction() for race-safety — no Cloud Function needed
  ← bulk-created across a date range by Generate Roster (members/serving-teams.html), chunked
    into Firestore batches of <=450 writes (limit is 500) to handle a 6-month, 3-services/week roster
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
- Cloud Functions: `onUserCreate`, `sendBroadcast`, `onNewMessage`, `onNewPrayerRequest`, `onNewConnectForm`, `weeklyDigest` deployed; account deletion (Phase 5)
- Authorised domains: localhost, 127.0.0.1, egcchurch.github.io, egc-church.firebaseapp.com, egc-church.web.app, staging.egc.church, app.egc.church
- Billing plan: **Blaze (pay-as-you-go)** — required for Cloud Functions; usage stays within free tier at church scale
- Required composite indexes:
  - `users` collection: `membership ASC, createdAt DESC` (for admin user listing)

---

## Firebase Storage Paths

```
/sermons/{sermonId}/audio.mp3
/sermons/{sermonId}/materials/{timestamp}_{index}_{filename}  ← 0+ files, mixed pdf/doc/docx/ppt/pptx
/team/{memberId}/photo.jpg
/users/{uid}/photo               ← user profile photos (separate from /team photos)
/events/{eventId}/cover.jpg      ← event hero image
/blog/{postId}/cover.jpg         ← blog featured image
/gallery/{galleryId}/{imageId}.jpg
/music/{trackId}/audio.mp3
/music/{trackId}/cover.jpg       ← optional cover art
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
- Tailwind CSS via CDN (acceptable trade-off for simplicity)
- Firebase is the only approved external dependency (plus Tailwind and Font Awesome)
- Firebase Hosting (not GitHub Pages) — supports per-PR preview channels, CDN, custom domains, multi-site
- All paths use `/` as root (not `/egc-church/` — that was the old GitHub Pages subpath)
- firebase-config.js is committed (Firebase web configs are public-facing by design)
- Colour scheme: amber (#F59E0B) + navy (#0A3D62)
- Service worker: cache-first for static assets, network-first for HTML pages
- Hero video (CloudVideo.mp4) excluded from caching — too large
- Firebase auth/API calls excluded from SW interception — must always be live
- Cache version: bump on each deploy with breaking changes (current: `egc-cache-v25`)
- Service worker cache list must be updated whenever a new page is added — CI check enforces this
- Role checks in JS are UX only — Firestore Security Rules are the real enforcement layer
- Firestore security rules are tested in CI via `@firebase/rules-unit-testing` against the Firebase emulator
- `published` flag on all content — editors can save drafts without going live
- Cloud Functions used for any operation that requires touching another user's data (broadcasts, DM push, alert fan-out, scheduled tasks, auto-create user docs, account deletion)
- Cloud Functions use firebase-functions **v1** API — v2 blocking functions require GCIP paid upgrade
- Galleries use a single collection with an `audience` field rather than separate collections per audience — simpler admin UX
- All music is public-access and downloadable — reflects current church policy
- Member directory privacy is opt-out for visibility, opt-in for contact details — protects member contact info by default
- Group join policy is per-group, not a global setting — different groups have different needs
- Group leaders manage their own group from `/members/groups.html`, not `/admin/` — keeps admin guard simple
- Direct messaging is 1-on-1 initially but `participants` is an array so group chat is possible later without schema change
- `/team` entries are independent of `/users` — team members are content records, not user accounts
- Auth guards (`admin-auth.js`, `member-auth.js`) must wait for both `firebase` AND `firebase.firestore` to be ready before running — otherwise they redirect before Firestore is initialised
- Development uses local Claude Code (not the GitHub Claude agent) — uses subscription instead of API costs

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
firebase emulators:start --only firestore
```

In a second terminal:

```
npx mocha --timeout 10000 tests/firestore.rules.test.js
```

Or via npm:

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

- [x] **Phase 1 — Foundation** — complete and deployed
- [x] **Phase 2 — Core Public Site** — complete and deployed
- [x] **Phase 3 — Members Area** — complete and deployed
- [x] **Phase 4 — Notifications & Messaging** — complete and deployed
- [x] **Phase 5 — Polish** — complete and deployed
- [x] **Phase 6 — Permissions & Roles** — complete and deployed (`docs/PERMISSIONS.md`)
- [x] **Phase 7 — Adaptive Homepage** — complete and deployed (`docs/HOMEPAGE.md`)
- [x] **Phase 8 — Multi-Church Template** — complete and deployed (`docs/PHASE8.md`)
- [x] **Phase 9 — Page Composition** — complete and deployed (`docs/PHASE9.md`)

Future improvements and backlog tracked in `docs/ROADMAP.md`.
