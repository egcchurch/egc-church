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
│   ├── prayer.html             ← Prayer requests
│   ├── devotional.html         ← Daily devotional
│   ├── gallery.html            ← Members + youth galleries
│   └── messages.html           ← In-app direct messaging
│
├── admin/                      ← Admin-gated pages (adminRole required)
│   ├── index.html              ← Admin dashboard
│   ├── users.html              ← superadmin only — approvals and role management
│   ├── sermons.html            ← Manage sermons
│   ├── events.html             ← Manage calendar events
│   ├── blog.html               ← Manage announcements
│   ├── team.html               ← Manage leadership profiles
│   ├── groups.html             ← Manage ALL groups (editor/superadmin only)
│   ├── devotional.html         ← Manage devotional content
│   ├── gallery.html            ← Manage photo galleries (all audiences)
│   ├── music.html              ← Manage music library
│   ├── connect.html            ← View visitor connect form submissions
│   ├── prayer.html             ← Moderate prayer requests
│   ├── homepage.html           ← Manage homepage content
│   └── notifications.html      ← Send broadcasts and notifications
│
├── functions/                  ← Firebase Cloud Functions
│   ├── index.js                ← Function entry — auth, Firestore, scheduled, callable triggers
│   ├── package.json            ← Node dependencies (firebase-admin, firebase-functions)
│   └── .gitignore              ← Excludes node_modules
│
├── firebase-config.js          ← Firebase init (committed, public)
├── firebase.json               ← Firebase Hosting multi-site config
├── .firebaserc                 ← Firebase project + site target aliases
├── firestore.rules             ← Firestore security rules
├── firestore.indexes.json      ← Firestore composite indexes
├── storage.rules               ← Firebase Storage security rules
├── manifest.json               ← PWA manifest (start_url and scope = /)
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
| Prayer requests         | /members/prayer     |
| Daily devotional        | /members/devotional |
| Members & youth gallery | /members/gallery    |
| Direct messages         | /members/messages   |

### Admin Pages (adminRole: "editor" or "superadmin")

| Page                     | URL                  | Notes           |
| ------------------------ | -------------------- | --------------- |
| Admin dashboard          | /admin/              |                 |
| Manage sermons           | /admin/sermons       |                 |
| Manage events            | /admin/events        |                 |
| Manage blog              | /admin/blog          |                 |
| Manage team              | /admin/team          |                 |
| Manage groups            | /admin/groups        |                 |
| Manage devotional        | /admin/devotional    |                 |
| Manage gallery           | /admin/gallery       |                 |
| Manage music             | /admin/music         |                 |
| View connect submissions | /admin/connect       |                 |
| Moderate prayer requests | /admin/prayer        |                 |
| Manage homepage          | /admin/homepage      |                 |
| Send notifications       | /admin/notifications |                 |
| User management          | /admin/users         | superadmin only |

---

## Role & Permission Model

Two independent role dimensions per user:

### Membership Tier (controls content access)

| Value     | Access                                                 |
| --------- | ------------------------------------------------------ |
| `pending` | Registered but not yet approved — sees waiting message |
| `public`  | Approved general user — public pages only              |
| `member`  | Approved church member — public + all member pages     |

### Admin Role (controls content management)

| Value        | Access                                           |
| ------------ | ------------------------------------------------ |
| `null`       | No admin access                                  |
| `editor`     | Add and edit content across all admin sections   |
| `superadmin` | Everything — plus user approvals and role grants |

### Combined Access Matrix

| Page / Feature  | Public (pending) | Public (approved) | Member | Editor | Superadmin |
| --------------- | ---------------- | ----------------- | ------ | ------ | ---------- |
| Public pages    | Yes              | Yes               | Yes    | Yes    | Yes        |
| Profile page    | Yes              | Yes               | Yes    | Yes    | Yes        |
| Live stream     | No               | No                | Yes    | Yes    | Yes        |
| Members area    | No               | No                | Yes    | Yes    | Yes        |
| Admin section   | No               | No                | No     | Yes    | Yes        |
| User management | No               | No                | No     | No     | Yes        |

### Approval Flow

- New registrations default to `membership: "pending"`, `adminRole: null`, `emailVerified: false`
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
- User grants notification permission on first visit
- FCM token stored in `/users/{uid}/fcmTokens/{tokenId}`
- Admin sends broadcast from `/admin/notifications`
- A Cloud Function fans out to all relevant FCM tokens
- **Cloud Functions are required here** — client-side JS cannot send to other users' devices
- **Delivery caveat:** FCM push only reaches logged-in approved users with registered tokens. Non-registered visitors will not receive push notifications even for "public" broadcasts.

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
| Public event notice  | All users   | FCM push + in-app           |
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

- `onNewMessage` — trigger: `/conversations/{conversationId}/messages/{messageId}` created — pushes FCM to recipient and writes in-app notification
- `onNewPrayerRequest` — trigger: `/prayerRequests/{requestId}` created — if `isPrivate: false`, writes in-app notification to all members; if `isPrivate: true`, writes in-app notification to admins only
- `onNewConnectForm` — trigger: `/connectForms/{submissionId}` created — writes in-app notification to all admins

### Scheduled Functions (Phase 4)

- `weeklyDigest` — runs every Sunday morning — compiles recent sermons, events, and announcements, fans out FCM push to all members

### Auth Triggers (Phase 1 — DEPLOYED)

- `onUserCreate` — trigger: new Firebase Auth user — creates `/users/{uid}` doc with `membership: "pending"`, `adminRole: null`, `emailVerified: false`, default privacy flags

### Phase 5

- `deleteUserAccount` — callable from `/profile.html` — performs GDPR-compliant account deletion (see Account Deletion section)

---

## Firestore Data Structure

```
/users/{uid}
  uid, email, displayName
  photoURL (nullable)
  phone (nullable)
  membership: "pending" | "public" | "member"
  adminRole: null | "editor" | "superadmin"
  emailVerified: true | false
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
  notesUrl (nullable — Firebase Storage)
  published: true | false
  createdAt, updatedAt

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
via YouTube public URLs.

---

## Sermon Media Strategy

- **Video delivery:** YouTube (primary) — store `youtubeId` in Firestore
- **Video backup:** Cloudflare R2 or Internet Archive (originals preserved off YouTube)
- **Audio files:** Firebase Storage at `/sermons/{sermonId}/audio.mp3`
- **Sermon notes (PDF):** Firebase Storage at `/sermons/{sermonId}/notes.pdf`
- **Thumbnails:** YouTube public thumbnail URL — no API key required
  - `https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg`

### Sermon Admin Upload Flow

1. Paste YouTube URL → script extracts video ID
2. Thumbnail auto-previews from YouTube
3. Fill in metadata (title, speaker, date, scripture, description)
4. Optional: upload audio file and/or PDF notes
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
- Never shown: `adminRole`, internal flags, approval metadata

---

## Group Membership Flow

### Permission Model

Group management is split between two surfaces to keep the admin guard simple:

- **`/admin/groups.html`** — editor or superadmin only — full management of ALL groups (create, delete, edit, change leaders)
- **`/members/groups.html`** — any member — browse and join groups, AND leader-only sections to manage their own group's members

This means a group leader who is NOT an admin manages their group from the members area, not the admin area. The admin auth guard checks `adminRole` only — no special cases needed.

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
- Firebase Storage: in use (audio, PDFs, images, music, cover art)
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
/sermons/{sermonId}/notes.pdf
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
- PDFs: 20MB max, `application/pdf` only

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
- Cache version: bump on each deploy with breaking changes (current: `egc-cache-v3`)
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
- Every prod release deploys static site + Cloud Functions together
- Append a session entry to `PROGRESS.md` on every PR

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

---

## Current Phase

- [x] **Phase 1 — Foundation** — complete and deployed
- [x] **Phase 2 — Core Public Site** — complete and deployed
- [x] **Phase 3 — Members Area** — complete and deployed
- [x] **Phase 4 — Notifications & Messaging** — complete and deployed
- [ ] **Phase 5 — Polish** — next
