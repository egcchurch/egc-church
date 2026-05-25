# Progress Archive: church-website-pwa

> Sessions 1–21. Moved here to keep PROGRESS.md lean.
> Only read this if you need historical session detail or architecture decision rationale.

---

## Session: Phase 4 — Notifications & Messaging (Session 21)

**Date:** 2026-05-25
**Branches:** `phase4/notifications`, `phase4/messaging`
**Status:** Both PRs merged (PR #22 and #23)

### What was done

**PR 1 — `phase4/notifications`:**
- **`js/notifications.js`** — self-initialising IIFE. Registers `auth.onAuthStateChanged`. When signed in: shows the notification bell, starts a Firestore `onSnapshot` listener on `/users/{uid}/notifications/` (ordered by `sentAt` desc, limit 20), renders a dropdown panel with unread count badge and mark-read-on-click. When signed out: tears down listener, hides bell. Also registers FCM token: lazy-loads `firebase-messaging-compat.js`, requests `Notification` permission, calls `messaging.getToken({ vapidKey, serviceWorkerRegistration })` (uses the existing caching SW rather than a separate `firebase-messaging-sw.js`), stores token in `/users/{uid}/fcmTokens/`. Handles foreground push via `messaging.onMessage()` toast.
- **`js/nav.js`** — updated to load `notifications.js` dynamically after the nav partial is injected, then dispatch `nav-loaded`. This makes the notification bell available on every page without adding a script tag to every HTML file.
- **`nav.html` / `members-nav.html` / `admin-nav.html`** — right-side of header refactored to a flex container holding `#notif-bell-wrapper` (bell + badge + dropdown panel), `#user-menu-wrapper` (login/user button), and `#mobile-btn`. Bell is `hidden` by default; `notifications.js` shows it on login.
- **`admin-nav.html`** — NOTIFICATIONS link added to desktop and mobile menus.
- **`admin/notifications.html`** — broadcast compose form (title, body, type, audience) + live history list. Calls `sendBroadcast` Cloud Function via `firebase.functions().httpsCallable()`. Loads `firebase-functions-compat.js`.
- **`admin/index.html`** — Notifications card added (violet accent, bell icon).
- **`functions/index.js`** — 4 new Cloud Functions:
  - `sendBroadcast` (callable): verifies admin role, writes to `/notifications/`, fans out in-app notifications to matching users (batched 400/write-batch), collects FCM tokens and sends via `sendEachForMulticast` (batched 500).
  - `onNewPrayerRequest` (Firestore trigger on `prayer/{requestId}`): private requests notify admins; public notify all members.
  - `onNewConnectForm` (Firestore trigger on `connect/{submissionId}`): notifies all editors/superadmins.
  - `weeklyDigest` (pubsub, every Sunday 09:00 SAST): compiles recent sermons + upcoming events into digest, writes in-app + sends FCM to all members.
- **`firestore.rules`** — added subcollection rules: `/users/{uid}/notifications/{id}` (owner read/update), `/users/{uid}/fcmTokens/{id}` (owner read/write).
- **`tests/firestore.rules.test.js`** — 4 new tests: own-notifications read, mark-read update, cross-user denied, FCM token write.
- **`service-worker.js`** — Firebase Messaging SDK added via `importScripts` for background push handling (reuses caching SW, no separate `firebase-messaging-sw.js` needed). Cache bumped v13 → v14. `admin/notifications.html` and `js/notifications.js` added to precache.

**PR 2 — `phase4/messaging`** (stacked on PR 1):
- **`members/messages.html`** — split-pane DM UI: conversation list (left sidebar, 280px) + message thread (right, flex-1). "New Message" button opens a member picker modal. Thread auto-scrolls to latest. Auto-opens conversation from `?conv=<id>` URL param (used by notification deep links from `onNewMessage`).
- **`js/messaging.js`** — self-initialising IIFE. Loads conversation list with `onSnapshot` (`participants array-contains`), renders conversation rows with last message preview and unread indicator. Opens conversation: loads nested `messages` sub-collection with `onSnapshot`, renders bubbles (mine right/navy, theirs left/white). Send form: adds message to `/conversations/{convId}/messages/`, updates `lastMessage`/`lastMessageAt`/`unreadBy` on the conversation doc. Start new conversation: queries `directoryVisible==true` members, checks for existing conversation before creating, creates `/conversations/{convId}` with `participants` array.
- **`members-nav.html`** — MESSAGES link added to desktop + mobile nav.
- **`functions/index.js`** — `onNewMessage` Firestore trigger on `conversations/{convId}/messages/{msgId}`: finds recipient, writes in-app notification, sends FCM push to recipient's tokens.
- **`firestore.rules`** — `/conversations/{convId}` (participants can read/update) + nested `/messages/{msgId}` (participants can read/create, no update/delete). Legacy `/messages` flat collection rules preserved.
- **`tests/firestore.rules.test.js`** — 4 new conversation tests: participant read, non-participant denied, nested message read, nested message denied.
- **`service-worker.js`** — cache bumped v14 → v15; `members/messages.html` and `js/messaging.js` added to precache.

### Notes / decisions

- **VAPID key required for FCM push**: `js/notifications.js` has `const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'`. Get from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates > Generate key pair. In-app notification bell works without it; FCM push activates once filled in.
- **Single service worker for both caching and FCM**: passing `serviceWorkerRegistration: await navigator.serviceWorker.ready` to `messaging.getToken()` reuses the caching SW. Firebase Messaging compat SDK is loaded via `importScripts` at the top of `service-worker.js`. Avoids the two-SW-per-scope conflict.
- **Conversations schema**: used `/conversations/{convId}/messages/{msgId}` (nested) rather than the flat `/messages/{messageId}` in the original schema. This matches the Cloud Function trigger path referenced in CLAUDE.md and makes the conversation UI much simpler. Old `/messages` rules are preserved.
- **`onNewPrayerRequest` does not send FCM** — in-app only, matching the broadcast type table in CLAUDE.md.
- **`onNewConnectForm` does not send FCM** — in-app only.
- **`weeklyDigest` uses `Africa/Johannesburg` timezone** (UTC+2, SAST) — inferred from domains.co.za domain registrar.

---

## Session: Admin Dashboard + Nav Dropdown Fixes (Session 20)

**Date:** 2026-05-24
**Branch:** `fix/admin-dashboard`
**Status:** Merged

### What was done

- **`admin/index.html`** — created the missing admin dashboard (was 404). Card grid linking to all 11 admin sections. Gated by `admin-auth.js`.
- **`admin-nav.html`** — added `#user-menu-wrapper` / `#user-dropdown` / `#mobile-user-links` slots (same pattern as `nav.html` and `members-nav.html`). The dropdown was missing from the admin nav entirely.
- **`service-worker.js`** — added `/admin/index.html` to precache; bumped cache version v12 → v13.

---

## Session: Nav User Dropdown (Session 19)

**Date:** 2026-05-24
**Branch:** `fix/nav-user-dropdown`
**Status:** Merged

### What was done

- **`nav.html`** — wrapped desktop `#login-btn` in a `relative` container (`#user-menu-wrapper`) with a hidden `#user-dropdown` div. Added `#mobile-user-links` div for role-aware links when logged in.
- **`js/main.js`** — `updateLoginButtons` made async; fetches `/users/{uid}` Firestore doc on auth state change to read `membership` and `adminRole`. Desktop button changes to `[Name] ▾` and toggles a dropdown. Mobile: inline links in hamburger menu. Links: My Profile (always), Members Area (member+), Admin Dashboard (editor+), Sign Out (always).

### Notes / decisions

- Previously the logged-in button just showed "Welcome, [Name]" and triggered logout — no way to reach `/profile`, `/members/`, or `/admin/` from the UI.
- Fixed 404 on Admin Dashboard link — `firebase.json` has no `cleanUrls`, so switched to explicit `/admin/index.html` and `/members/index.html`.
- Fixed dropdown not appearing on members area pages — `members-nav.html` was missing the wrapper div.

---

## Session: Phase 3 Members Area (Session 18)

**Date:** 2026-05-24
**Branch:** `phase3/members-foundation`
**Status:** Merged

### What was done

- `members-nav.html` — shared partial for /members/ pages
- `js/nav.js` — updated to detect `/members/` path and load `members-nav.html`
- `members/index.html` — dashboard with icon cards
- `members/directory.html` — searchable member grid; shows email/phone only if opted in
- `members/prayer.html` — real-time prayer feed; submit with anonymous + private toggles; pray-for button; own-request delete
- `members/groups.html` — browse/join/leave per joinPolicy; leader section with member management and pending approval modal
- `members/devotional.html` — today's devotional + past-devotionals archive
- `members/gallery.html` — audience filter (All/Members/Youth); lightbox with keyboard navigation
- `members/live.html` — reads `/config/liveStream` Firestore doc for `youtubeId`, `isLive`
- `admin/prayer.html` — moderate all prayer requests including private
- `admin/groups.html` — full CRUD for groups
- `admin/devotional.html` — write/edit/delete devotionals
- `firestore.rules` — users directoryVisible read, groups member join/leave, devotionals (isMember read, isEditor write)
- `tests/firestore.rules.test.js` — 11 new tests (23 total, all passing)
- `service-worker.js` — cache bumped to v12; all new pages added

### Notes

- Live stream page reads from `/config/liveStream` — admin sets values directly in Firestore Console for now
- `members/gallery.html` uses `audience in ['members','youth']` — Firestore `in` operator, no composite index needed

---

## Session: Music Library (Session 17)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **`/music.html` + `js/music.js`** — public music library: category filters, track cards, inline HTML5 `<audio>` player, download link. Query `published == true`, sorted client-side by releaseDate desc.
- **`/admin/music.html`** — full CRUD reusing `js/storage-upload.js`. Audio goes to `music/{trackId}_{file}`, cover to `music/covers/{trackId}_{file}`.
- Added MUSIC to public nav and admin nav.
- SW precache updated; cache version v10 → v11.

### Notes

- Storage path mismatch: CLAUDE.md shows `/music/{trackId}/audio.mp3` but deployed `storage.rules` only allow `music/{fileName}`. Followed the rules (enforcement layer). CLAUDE.md path list should be reconciled.

---

## Session: Gallery + Media Storage Pattern (Session 16)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **CLAUDE.md** — added "Media Storage — Designed for Migration" section.
- **`js/storage-upload.js`** — single module that touches Firebase Storage. `uploadMedia(path, file)` returns HTTPS URL string. `deleteMedia(url)` via `refFromURL`. Migrating hosts = rewrite this one file.
- **`/gallery.html` + `js/gallery.js`** — public gallery: published `audience: "public"` galleries; lightbox. No Storage SDK on the public page.
- **`/admin/gallery.html`** — full CRUD for all audiences (public/members/youth). Multi-image upload; stores `imageUrls[]` + `thumbnailUrl` as strings.
- SW precache updated; cache version v9 → v10.

### Notes

- First real Firebase Storage usage in the project. `uploadMedia`/`deleteMedia` is now the template for all uploads.
- Storage rules already allowed `gallery/{galleryId}/{fileName}` — no storage.rules change needed.

---

## Session: Connect Form (Session 15)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **`/connect.html`** — public visitor connect form. Writes `{name, email, phone, message, read: false, submittedAt}` to `/connect`.
- **`js/connect.js`** — form validation, submit-to-Firestore, disabled/sending state.
- **`/admin/connect.html`** — admin triage view: lists newest-first, unread highlighted, mark-read and delete actions.
- Firestore rules: added `allow update: if isEditor()` to `/connect`. 4 new tests (12 total, all passing).
- SW precache updated; cache version v8 → v9.

### Notes

- Collection is `/connect`. The `onNewConnectForm` Cloud Function in CLAUDE.md references `/connectForms` — inconsistency in the doc; using `/connect`.
- Public create is `allow create: if true` (unauthenticated) — spam-exposed; future hardening option.

---

## Session: About + Team (Session 14)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **`/about.html`** — public About page: static intro + leadership grid from `/team` sorted by `order`.
- **`js/about.js`** — Firestore-driven rendering.
- **`/admin/team.html`** — full CRUD for `/team`: name, role, bio, photoUrl, order.
- Added ABOUT to public nav and TEAM to admin nav.
- SW precache updated; cache version v7 → v8.

---

## Session: Shared Navigation Refactor (Session 13)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- Created `/nav.html` — public nav markup partial. Absolute paths so it works from root, /admin/, and /members/.
- Created `/admin-nav.html` — admin nav markup partial.
- Created `js/nav.js` — fetches the right partial, injects into `#nav-placeholder`, highlights active link, dispatches `nav-loaded` event.
- Updated `js/main.js` — mobile-menu toggle and `checkAuthState()` moved into `nav-loaded` listener.
- Replaced inline nav blocks with `<div id="nav-placeholder"></div>` on all pages.
- SW precache updated; cache version v6 → v7.

### Notes

- `login.html` intentionally skipped — has no nav (full-screen login card).
- Branch was stacked on `phase2/blog-page`.

---

## Session: Blog Page (Session 12)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **`/blog.html`** — public Notice Board listing published `/blog` posts sorted by publishedAt descending.
- **`js/blog.js`** — Firestore-driven rendering.
- **`/admin/blog.html`** — full CRUD: title, body, author, publish date, imageUrl, published toggle. Published badge vs draft badge.
- Admin nav updated across all pages; NOTICE BOARD nav links wired up.
- SW precache updated; cache version v5 → v6.

---

## Session: Admin Events Page (Session 11)

**Date:** 2026-05-24
**Status:** Merged

### What was done

- **`/admin/events.html`** — full CRUD for `/events` collection. All schema fields including Timestamps split to date/time inputs. Events sorted by startDate desc. Toast notifications.
- Admin nav updated (added EVENTS link, reordered to HOME | SERMONS | EVENTS | USERS).
- SW precache updated; cache version v4 → v5.

---

## Session: Phase 2 Started + Agent Workflow Live (Session 10)

**Date:** 2026-05-24
**Status:** Merged (PR #7)

### What was done

- Decided against the GitHub Claude agent (`anthropics/claude-code-action`) — using local Claude Code instead (subscription, not API).
- Built `/events.html` — pulls from `/events` Firestore collection, category filters, respects `published` flag.
- Added `js/events.js` with Firestore-driven event rendering.
- Updated SW cache list; bumped cache version.
- Updated CLAUDE.md to reflect Firebase Hosting, multi-site setup, CI/CD pipeline, and Phase 1 completion.

---

## Session: Phase 1 Build & Testing (Session 9)

**Date:** 2026-05-24
**Status:** Complete

### What was done

- `storage.rules` — file type and size validation for all storage paths
- `js/admin-auth.js` — admin page guard (editor/superadmin only)
- `js/member-auth.js` — member page guard (member tier only)
- Firebase Cloud Functions setup (`firebase init functions`)
- `onUserCreate` Cloud Function — auto-provisions `/users/{uid}` on registration
- `/admin/users.html` — pending approvals queue + role management
- `/admin/sermons.html` — add/edit/delete sermons with YouTube + audio + PDF
- `/sermons.html` updated to pull from Firestore (replaced hardcoded array)
- `js/sermons.js` — Firestore-driven, YouTube thumbnails, card + table views
- `/profile.html` — display name, phone, password change, directory privacy, email verification resend
- SW cache updated to v3; all new pages added

### Issues encountered and resolved

| Issue | Fix |
| --- | --- |
| `firebase-functions v2` `beforeUserCreated` requires GCIP | Switched to `v1` `auth.user().onCreate` |
| Cloud Build missing permissions | Added Logs Writer role to compute service account |
| Firestore not yet created | Created database via Firebase Console |
| SW registration using old `/egc-church/` path | Fixed in `main.js` |
| Admin auth guard redirecting before Firestore ready | Added `firebase.firestore` check to `waitForFirebase` |
| Users not showing — missing `createdAt` field | Added timestamp field manually to user doc |
| Query requires composite index | Created index via Firebase Console error link |

---

## Session: Environment & CI/CD Setup (Session 8)

**Date:** 2026-05-21
**Status:** Complete

### What was done

- Installed Firebase CLI (v14.11.0) via winget
- Ran `firebase init hosting` — linked to egc-church project
- Created two Firebase Hosting sites: `egc-staging777` (pre-prod), `egc-app777` (prod)
- Configured `firebase.json` multi-site config; updated `.firebaserc`
- Fixed `/egc-church/` → `/` paths in `service-worker.js` (cache v1 → v2) and `manifest.json`
- Added custom domain DNS records (CNAME) at domains.co.za for both subdomains
- Created GitHub Actions workflows: preview, deploy, ci
- Set up Firebase service account secret in GitHub; enabled branch protection on `main`
- Initialised Firestore + Storage; wrote security rules
- Set up mocha + `@firebase/rules-unit-testing`; all 8 security rules tests passing
- Renamed `AI_CONTEXT.md` → `CLAUDE.md`

### Architecture decisions made

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | Firebase Hosting (multi-site) over GitHub Pages | Per-PR preview channels, CDN, SSL, same Firebase project |
| 2 | Sites: `egc-staging777` + `egc-app777` | Clean environment separation |
| 3 | `main` protected; merge = human approval gate | Nothing reaches prod without explicit reviewer action |
| 4 | Every prod release deploys static site + Functions together | Keeps hosting and functions in sync |
| 5 | DNS: only add subdomains now | `www`/apex stay on AWS until full cutover decision |
| 6 | Fix `/egc-church/` → `/` in SW + manifest | Firebase Hosting serves from root `/` |
| 7 | `AI_CONTEXT.md` → `CLAUDE.md` | Repo-aware agents auto-load `CLAUDE.md` |
| 8 | CI gates: rules tests, link check, SW cache check | All must pass before merge unlocks |

---

## Sessions 1–7 (Planning & Setup)

### 2026-05-12 (Session 7) — Sanity fixes

- Gap analysis on full spec — no code written
- Fixed: notifications audience missing "admins"; ENVIRONMENT.md contradicted PROGRESS.md on Functions timing; Phase 1 missing SW cache update; group leader edge case in admin guard
- Moved group-leader management to `/members/groups.html`
- Added `pendingMembers` array to `/groups`
- Rewrote ENVIRONMENT.md

### 2026-05-12 (Session 6) — Privacy, self-service, account deletion

- Added `/profile.html` for user self-service
- Added image fields to events (`imageUrl`) and blog (`imageUrl`) schemas; added `coverArtUrl` to music schema
- Member directory privacy: opt-out visibility, opt-in contact details; fields added to `/users`
- Email verification required before member approval
- Group join policy: per-group `joinPolicy: "open" | "approval" | "invite-only"`
- Direct messaging: 1-on-1 initially, `participants` array allows group chat later without schema change
- Cloud Functions architecture expanded; account deletion: remove personal data, anonymise content authorship

### 2026-05-12 (Session 5) — Galleries, music, admin moderation

- Galleries: single `/gallery` collection with `audience` field ("public" | "members" | "youth")
- Music is fully public — stream and download, no login required; categories: worship, choir, original, instrumental
- Added `/admin/connect.html` and `/admin/prayer.html`
- Gallery moved from Phase 5 to Phase 2

### 2026-05-12 (Session 4) — Full site architecture

- Role model: `membership` (content access) + `adminRole` (content management) — two independent dimensions
- Membership tiers: `pending`, `public`, `member`; Admin roles: `null`, `editor`, `superadmin`
- New registrations default to `pending` — manual superadmin approval required
- Live stream restricted to `member` tier
- Sermon video via YouTube (`youtubeId` in Firestore) — not self-hosted
- FCM confirmed for push notifications
- Firestore Security Rules are the enforcement layer — JS role checks are UX only
- `published` flag on all content types (draft workflow)

### 2026-05-12 (Session 3) — Service Worker

- Added `service-worker.js` — cache-first for static/CDN, network-first for HTML
- Excluded hero video and Firebase auth calls from SW
- Added SW registration to `main.js`; cache name: `egc-cache-v1`

### 2026-05-12 (Session 2) — PWA Manifest

- Added `manifest.json`
- Generated icon set (8 sizes: 72–512px) from EGC logo
- Added manifest link, theme-color, apple-touch-icon to all HTML pages

### 2026-05-12 (Session 1) — Repo Setup

- Audited old project, set up clean repo at github.com/egcchurch/egc-church
- Configured GitHub Pages (main branch, root) — later migrated to Firebase Hosting in Session 8
- Fixed Firebase authorised domains
