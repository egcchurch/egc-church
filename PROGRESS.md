# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-24
**Current milestone:** Phase 2 in progress — blog (public + admin) built, pending review

---

## Session: Blog Page (Session 12)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- Built `/blog.html` — public Notice Board page listing published `/blog` posts, sorted by publishedAt descending, card grid mirroring events.html (navy header, amber accents, image-or-gradient cover)
- Added `js/blog.js` — Firestore-driven rendering (waitForFirebase, published filter, excerpt cards) mirroring js/events.js
- Built `/admin/blog.html` — full CRUD for the `/blog` collection, mirroring admin/events.html: admin-auth guard, inline add/edit form (title, body, author, publish date, imageUrl, published toggle), list with published/draft badge, edit/delete with confirm(), toast notifications
- publishDate stored as a Firestore Timestamp (publishedAt); split back to a date input on edit; defaults to today for new posts
- Wired public NOTICE BOARD nav links to `/blog.html` in index.html, sermons.html, events.html (were `href="#"`)
- Added BLOG to admin nav (after EVENTS, before USERS) in sermons.html, events.html, users.html — order now HOME | SERMONS | EVENTS | BLOG | USERS
- Added `/blog.html`, `/admin/blog.html`, `/js/blog.js` to SW precache; bumped cache version v5 -> v6

### Note

- Public nav on index.html and sermons.html is still missing an EVENTS link (pre-existing — the events build only added EVENTS to events.html's public nav). Not addressed here to keep scope to blog.

### Phase 2 progress

- [x] `/events.html` — public events page
- [x] `/admin/events.html` — manage events
- [x] `/blog.html` — public announcements page
- [x] `/admin/blog.html` — manage announcements
- [ ] `/connect.html` + `/admin/connect.html`
- [ ] `/about.html` + `/admin/team.html`
- [ ] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: Admin Events Page (Session 11)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- Built `/admin/events.html` — full CRUD management for the `/events` Firestore collection
- Inline add/edit form (matching admin/sermons.html pattern) with all schema fields:
  title, description, location, startDate + startTime, endDate + endTime, audience, category, imageUrl, published
- Firestore Timestamps split into separate date/time inputs on edit; recombined on save
- Events list sorted by startDate descending — each row shows title, formatted date, location, category badge, audience badge, published/draft badge
- Edit button loads event into form via in-memory cache (avoids JSON.stringify Timestamp issue)
- Delete button uses `confirm()` dialog then removes the Firestore document
- Toast notifications for save success, save error, and delete success
- Updated admin nav in sermons.html and users.html — added EVENTS link; reordered to HOME | SERMONS | EVENTS | USERS
- Added `/admin/events.html` to SW precache list; bumped cache version v4 → v5

### Phase 2 progress

- [x] `/events.html` — public events page
- [x] `/admin/events.html` — manage events
- [ ] `/blog.html` + `/admin/blog.html`
- [ ] `/connect.html` + `/admin/connect.html`
- [ ] `/about.html` + `/admin/team.html`
- [ ] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: Phase 2 Started + Agent Workflow Live (Session 10)

**Date:** 2026-05-24
**Status:** In progress

### What was done

- Decided against the GitHub Claude agent (`anthropics/claude-code-action`) to avoid API costs — going with the local Claude Code workflow instead (uses subscription, not API)
- Set up agentic-style local workflow: describe feature → Claude Code builds on branch → push → CI → review preview → merge → auto-deploy
- Built `/events.html` (Phase 2) via Claude Code in one shot — pulls from `/events` Firestore collection, sorted by startDate, category filters (service/group/special/other), respects `published` flag
- Added `js/events.js` with Firestore-driven event rendering
- Updated SW cache list to include `/events.html` and bumped cache version
- PR #7 merged and deployed to production at app.egc.church/events.html
- Updated CLAUDE.md to reflect Firebase Hosting, multi-site setup, CI/CD pipeline, and Phase 1 completion
- Cleaned up stray `chore/update-claude-md` branch that contained the abandoned `claude.yml` GitHub agent workflow

### Workflow established

1. Pull main, create feature branch (or let Claude Code do it)
2. Run `claude` in terminal — it auto-loads CLAUDE.md
3. Describe the feature in plain English
4. Claude Code writes the code, shows diffs for approval, commits and pushes
5. Open PR on GitHub — CI runs automatically (preview deploy + 3 checks)
6. Review preview URL, merge if good
7. Production auto-deploys
8. Delete branch locally and remotely

### Phase 2 progress

- [x] `/events.html` — public events page
- [ ] `/admin/events.html` — manage events (next)
- [ ] `/blog.html` + `/admin/blog.html`
- [ ] `/connect.html` + `/admin/connect.html`
- [ ] `/about.html` + `/admin/team.html`
- [ ] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: Phase 1 Build & Testing (Session 9)

**Date:** 2026-05-24
**Status:** Complete

### What was done

- Built `storage.rules` — file type and size validation for all storage paths
- Built `js/admin-auth.js` — admin page guard (editor/superadmin only)
- Built `js/member-auth.js` — member page guard (member tier only)
- Set up Firebase Cloud Functions (`firebase init functions`)
- Built `onUserCreate` Cloud Function — auto-provisions /users/{uid} on registration
- Built `/admin/users.html` — pending approvals queue + role management
- Built `/admin/sermons.html` — add/edit/delete sermons with YouTube + audio + PDF
- Updated `/sermons.html` to pull from Firestore (replaced hardcoded array)
- Updated `js/sermons.js` — Firestore-driven, YouTube thumbnails, card + table views
- Built `/profile.html` — display name, phone, password change, directory privacy, email verification resend
- Updated SW cache list to v3 with all new pages
- Upgraded Firebase Functions to v1 auth trigger (v2 blocking functions require GCIP paid upgrade)
- Deployed Cloud Functions to Firebase (Blaze plan required and activated)
- Created Firestore database (nam5, production mode)
- Deployed Firestore security rules
- Fixed SW registration path `/egc-church/` → `/`
- Fixed `admin-auth.js` to wait for Firestore to initialize before running guard
- Manually created superadmin user doc in Firestore for egcstreaming@gmail.com
- Created Firestore composite index for users query
- End-to-end tested: admin guard, user management page, role display all working

### Issues encountered and resolved

| Issue                                                     | Fix                                                   |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `firebase-functions v2` `beforeUserCreated` requires GCIP | Switched to `v1` `auth.user().onCreate`               |
| Cloud Build missing permissions                           | Added Logs Writer role to compute service account     |
| Firestore not yet created                                 | Created database via Firebase Console                 |
| SW registration using old `/egc-church/` path             | Fixed in `main.js`                                    |
| Admin auth guard redirecting before Firestore ready       | Added `firebase.firestore` check to `waitForFirebase` |
| Users not showing — missing `createdAt` field             | Added timestamp field manually to user doc            |
| Query requires composite index                            | Created index via Firebase Console link in error      |

### Current status

- [x] Phase 1 complete and tested on production (app.egc.church)
- [ ] Phase 2 — Core Public Site (next)

---

## Session: Environment & CI/CD Setup (Session 8)

**Date:** 2026-05-21
**Status:** Complete

### What was done

- Installed Firebase CLI (v14.11.0) via winget on Windows
- Ran `firebase init hosting` — linked to egc-church project
- Created two Firebase Hosting sites: `egc-staging777` (pre-prod), `egc-app777` (prod)
- Configured `firebase.json` multi-site config (staging + production targets)
- Updated `.firebaserc` with site target mappings
- Applied hosting targets via `firebase target:apply`
- Test deploy to `egc-staging777.web.app` succeeded (113 files)
- Fixed `/egc-church/` → `/` paths in `service-worker.js` (cache bumped v1 → v2) and `manifest.json`
- Confirmed `staging.egc.church` and `app.egc.church` already in Firebase authorised domains
- Added custom domain DNS records (CNAME) at domains.co.za for both subdomains
- Created GitHub Actions workflows: preview, deploy, ci
- Set up Firebase service account secret in GitHub
- Enabled branch protection on `main` with required status checks
- Initialised Firestore + Storage and wrote security rules
- Set up mocha + @firebase/rules-unit-testing for security rules testing
- All 8 security rules tests passing
- Renamed `AI_CONTEXT.md` → `CLAUDE.md` and committed

### Architecture decisions made

| #   | Decision                                                             | Rationale                                                                    |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Move hosting from GitHub Pages → Firebase Hosting (multi-site)       | Per-PR preview channels, CDN, official GH Action, SSL, same Firebase project |
| 2   | Hosting sites: `egc-staging777` (pre-prod) + `egc-app777` (prod)     | Clean environment separation; PR previews use auto-URLs                      |
| 3   | `main` = protected branch; merge = human approval gate               | Nothing reaches prod without explicit reviewer action                        |
| 4   | Every prod release deploys static site + Firebase Functions together | Keeps hosting and functions in sync                                          |
| 5   | DNS: only add `staging.egc.church` + `app.egc.church` subdomains now | `www`/apex stay on AWS until full cutover decision is made                   |
| 6   | Fix `/egc-church/` → `/` in SW + manifest                            | Firebase Hosting serves from root `/`, not a subpath                         |
| 7   | `AI_CONTEXT.md` renamed to `CLAUDE.md`                               | Repo-aware agents auto-load `CLAUDE.md`                                      |
| 8   | CI gates: Firestore rules tests, HTML/link check, SW cache check     | All must pass before merge unlocks                                           |
| 9   | Firestore security rules tests are highest-value CI check            | JS role checks are UX only; rules are real enforcement                       |

### Setup sequence — all complete

- [x] Step 1 — Rename `AI_CONTEXT.md` → `CLAUDE.md`; keep `PROGRESS.md` committed
- [x] Step 2 — `firebase.json` multi-site config + `firebase init hosting`
- [x] Step 3 — Fix `/egc-church/` → `/` in `service-worker.js` and `manifest.json`; update authorised domains
- [x] Step 4 — Add custom domains in Firebase Console + DNS records at domains.co.za
- [x] Step 5 — GitHub Actions: PR preview deploy + security-rules tests + link/SW-cache checks; branch protection on `main`
- [x] Step 6 — Firestore security-rules test scaffold
- [x] Step 7 — Run Phase 1 build through this pipeline (Phase 1 complete in Session 9)

### Notes

- `firebase-config.js` is gitignored — will be injected at deploy time via GitHub Actions secret
- Long-term DNS cutover (repointing apex + www) deferred until new stack is trusted — one reversible change when ready

---

## Build Phases

### Phase 1 — Foundation (COMPLETE)

- [x] Firestore security rules (all collections)
- [x] Storage security rules
- [x] Auth guard + role system (membership + adminRole)
- [x] `js/admin-auth.js` — shared role-checking guard
- [x] `js/member-auth.js` — shared membership-checking guard
- [x] Email verification flow (Firebase Auth `sendEmailVerification`)
- [x] Firebase Cloud Functions setup (`firebase init functions`)
- [x] `onUserCreate` Cloud Function — auto-create `/users/{uid}` doc on registration
- [x] `/admin/users.html` — approvals queue + role management (superadmin)
- [x] `/admin/sermons.html` — add/edit sermons with YouTube URL + metadata
- [x] `/sermons.html` — connected to Firestore (replaced hardcoded data)
- [x] `/profile.html` — user self-service (display name, photo, password, privacy toggles, resend verification email)
- [x] Update service-worker.js cache list with new pages and bump cache version

### Phase 2 — Core Public Site (IN PROGRESS)

- [x] `/events.html` — church calendar (public events) with cover images
- [x] `/blog.html` — announcements with featured images
- [ ] `/connect.html` — visitor connect form
- [ ] `/about.html` — leadership team from Firestore
- [ ] `/gallery.html` — public gallery page
- [ ] `/music.html` — public music library (stream + download)
- [x] `/admin/events.html`
- [x] `/admin/blog.html`
- [ ] `/admin/team.html`
- [ ] `/admin/gallery.html` — manage galleries (with audience selector)
- [ ] `/admin/music.html` — upload and manage music tracks
- [ ] `/admin/connect.html` — view visitor connect form submissions
- [ ] Update service-worker.js cache list with new pages and bump cache version

### Phase 3 — Members Area

- [ ] `/members/live.html` — live stream (member-gated)
- [ ] `/members/prayer.html` — prayer request submission and listing
- [ ] `/members/groups.html` — browse and join groups, leader-only sections for managing own group
- [ ] `/members/directory.html` — membership directory (respects privacy flags)
- [ ] `/members/devotional.html` — daily devotional
- [ ] `/members/gallery.html` — members + youth galleries
- [ ] `/admin/prayer.html` — moderate prayer requests
- [ ] `/admin/groups.html` — full group management (editor/superadmin only)
- [ ] `/admin/devotional.html`
- [ ] Update service-worker.js cache list and bump cache version

### Phase 4 — Notifications & Messaging

- [ ] FCM token registration on login
- [ ] In-app notification bell (nav, real-time Firestore listener)
- [ ] `/admin/notifications.html` — compose and send broadcasts
- [ ] Cloud Function: `sendBroadcast` (HTTP/callable, FCM fan-out)
- [ ] Cloud Function: `onNewMessage` (Firestore trigger, DM push)
- [ ] Cloud Function: `onNewPrayerRequest` (Firestore trigger, alert fan-out)
- [ ] Cloud Function: `onNewConnectForm` (Firestore trigger, admin alert)
- [ ] Cloud Function: `weeklyDigest` (scheduled, Sunday)
- [ ] `/members/messages.html` — direct messaging between members

### Phase 5 — Polish

- [ ] Homepage dynamic content pulled from Firestore
- [ ] `/admin/homepage.html` — manage homepage content blocks
- [ ] Podcast RSS feed
- [ ] Cloudflare R2 or Internet Archive backup for sermon media
- [ ] Cloudflare R2 migration path for music if Firebase Storage approaches 5GB
- [ ] Cloud Function: `deleteUserAccount` (GDPR-compliant account deletion)
- [ ] Account deletion UI on `/profile.html`

---

## Architecture Decisions Log

### 2026-05-24 (Session 10) — Agentic local workflow

- Chose local Claude Code over the GitHub Claude agent (`anthropics/claude-code-action`) — avoids API costs since Claude Code runs on subscription
- Established the agentic-style feature flow: describe → Claude Code builds branch → push → CI → review preview → merge
- Confirmed full pipeline works end-to-end with the `/events.html` build

### 2026-05-24 (Session 9) — Phase 1 build details

- `onUserCreate` must use firebase-functions v1 — v2 blocking functions require GCIP (paid)
- Cloud Build service account needs Logs Writer role explicitly
- Auth guards must wait for `firebase.firestore` to be ready, not just `firebase` + `auth`
- Firestore queries that filter + sort by different fields need composite indexes (created on demand via Firebase Console error link)

### 2026-05-21 (Session 8) — CI/CD pipeline and Firebase Hosting migration

See session entry above.

### 2026-05-12 (Session 7) — Sanity fixes for consistency

- Added `"admins"` to the `/notifications/{notificationId}` audience enum
- Group leader permissions: leaders manage their own group from `/members/groups.html`, NOT `/admin/groups.html`
- Added `pendingMembers: [uid array]` field to /groups for "approval" joinPolicy flow
- Defined Firestore security rule pattern for groups
- Email verification edge case: /profile.html includes "resend verification email" for `emailVerified: false`
- Cloud Functions setup moved into Phase 1 (just `onUserCreate`)
- ENVIRONMENT.md rewritten with correct Cloud Functions timing and emulator instructions
- Service worker cache update task added to Phase 1
- /functions/ folder structure clarified
- /team and /users explicitly noted as independent

### 2026-05-12 (Session 6) — Privacy, self-service, alert triggers, account deletion

- Added `/profile.html` for user self-service
- Added image fields to events (`imageUrl`) and blog (`imageUrl`) schemas
- Added `coverArtUrl` to music schema
- Member directory privacy: opt-out visibility, opt-in contact details
- Added directory privacy fields to /users: `directoryVisible`, `directoryShowEmail`, `directoryShowPhone`
- Added `phone` and `photoURL` to /users schema
- Email verification required before member approval
- Group join policy: per-group `joinPolicy: "open" | "approval" | "invite-only"`
- Direct messaging: 1-on-1 initially, `participants` array allows group chat later
- Cloud Functions architecture expanded (onUserCreate, onNewMessage, onNewPrayerRequest, onNewConnectForm, sendBroadcast, weeklyDigest, deleteUserAccount)
- Account deletion: remove personal data, anonymise content authorship as "deleted-user"

### 2026-05-12 (Session 5) — Galleries, music, admin moderation pages

- Galleries: single `/gallery` collection with `audience` field ("public" | "members" | "youth")
- Youth gallery is member-gated (content tag, not a separate role)
- Music is fully public — stream and download, no login required
- Music categories: worship, choir, original, instrumental
- Added `/admin/connect.html` and `/admin/prayer.html`
- Gallery moved from Phase 5 to Phase 2

### 2026-05-12 (Session 4) — Full site architecture

- Role model: `membership` (content access) + `adminRole` (content management) — two independent dimensions
- Membership tiers: `pending`, `public`, `member`
- Admin roles: `null`, `editor`, `superadmin`
- New registrations default to `pending` — manual superadmin approval required
- Live stream restricted to `member` tier
- Sermon video via YouTube (youtubeId in Firestore) — not self-hosted
- Audio + PDFs in Firebase Storage
- YouTube thumbnail fetched client-side via public URL — no API key needed
- FCM confirmed for push notifications
- Firestore Security Rules are the enforcement layer — JS role checks are UX only
- `published` flag on all content types (draft workflow)

---

## Session Log

### 2026-05-24 (Session 10)

See session entry at top of file.

### 2026-05-24 (Session 9)

See session entry at top of file.

### 2026-05-21 (Session 8)

See session entry at top of file.

### 2026-05-12 (Session 7)

- Sanity pass on full spec — gap analysis, no code written
- Fixed: notifications audience missing "admins"; ENVIRONMENT.md contradicted PROGRESS.md on Functions timing; Phase 1 missing SW cache update; group leader edge case in admin guard
- Moved group-leader management to /members/groups.html
- Added `pendingMembers` array to /groups
- Rewrote ENVIRONMENT.md

### 2026-05-12 (Session 6)

- Gap analysis: missing image fields, no user self-service, no directory privacy, incomplete Functions architecture
- Added /profile.html, expanded /users schema, defined directory privacy model
- Added `joinPolicy` to groups, documented all Cloud Functions, GDPR account deletion flow

### 2026-05-12 (Session 5)

- Added galleries (single collection + audience field) and music (public, streaming)
- Added /admin/connect.html and /admin/prayer.html
- Resequenced build phases — galleries and music moved to Phase 2

### 2026-05-12 (Session 4)

- Full site architecture planned and documented
- Complete site map, role/permission model, notification architecture, Firestore schema, Storage paths, build phases 1-5

### 2026-05-12 (Session 3)

- Added service-worker.js — cache-first for static/CDN, network-first for HTML
- Excluded hero video and Firebase auth calls from SW
- Added SW registration to main.js
- Cache name: egc-cache-v1 (now v3 after path fix in Session 8 and new pages in Session 9)

### 2026-05-12 (Session 2)

- Added PWA manifest.json
- Generated icon set (8 sizes: 72–512px) from EGC logo
- Added manifest link, theme-color, apple-touch-icon to all HTML pages
- PWA installable from live site

### 2026-05-12 (Session 1)

- Audited old project, set up clean repo at github.com/egcchurch/egc-church
- Configured GitHub Pages (main branch, root) — later migrated to Firebase Hosting in Session 8
- Fixed Firebase authorised domains
- Verified live site at egcchurch.github.io/egc-church/ (since superseded by app.egc.church)
