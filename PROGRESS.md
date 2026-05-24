# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-24
**Current milestone:** Phase 3 Members Area — branch pushed, awaiting PR review

---

## Session: Phase 3 Members Area (Session 18)

**Date:** 2026-05-24
**Branch:** `phase3/members-foundation`
**Status:** Branch pushed, awaiting PR review

### What was done

**Navigation & foundation:**
- `members-nav.html` — shared partial for /members/ pages (Back to Site, HOME, DIRECTORY, GROUPS, PRAYER, DEVOTIONAL, GALLERY, LIVE)
- `js/nav.js` — updated to detect `/members/` path and load `members-nav.html` (alongside existing `/admin/` detection)
- `members/index.html` — dashboard with icon cards linking to all member features; personalises welcome message via auth state

**Member pages (all gated by member-auth.js):**
- `members/directory.html` — searchable member grid querying `membership==member && directoryVisible==true`; shows email/phone only if user has opted in; client-side name search
- `members/prayer.html` — real-time prayer feed (onSnapshot); submit with anonymous + private toggles; pray-for button (arrayUnion/Remove); own-request delete; filter My Requests/All
- `members/groups.html` — browse public groups with join/request/leave actions per joinPolicy; leader section shows current members with remove buttons; pending-requests modal for leaders to approve/deny
- `members/devotional.html` — loads today's devotional by date string; past-devotionals archive list (click to switch display); shows scripture blockquote + body
- `members/gallery.html` — audience filter (All/Members/Youth); queries `audience in ['members','youth'] && published==true`; lightbox with keyboard navigation (same pattern as public gallery.html)
- `members/live.html` — reads `/config/liveStream` Firestore doc for `youtubeId`, `isLive`, title, description; shows static service-times card if no stream configured

**Admin pages:**
- `admin/prayer.html` — moderate all prayer requests including private; filter tabs (All/Public/Private); delete with confirm
- `admin/groups.html` — full CRUD: create/edit groups with name, description, join policy, meeting day/time, location, leader UIDs, visibility; real-time list
- `admin/devotional.html` — write/edit/delete devotionals; date, title, scripture ref, scripture text, body; "Today" badge on current date; real-time list

**Infrastructure:**
- `admin-nav.html` — added PRAYER, GROUPS, DEVOTIONAL links (desktop + mobile)
- `firestore.rules` — three changes: (1) users read now allows `isMember() && directoryVisible==true`; (2) groups update now allows members to change only members/pendingMembers (join/leave); (3) new `/devotionals/{id}` block (isMember read, isEditor write)
- `tests/firestore.rules.test.js` — 11 new tests covering groups join, prayer CRUD, devotional CRUD, directory visibility. 23 total, all passing
- `service-worker.js` — cache bumped to v12 (done in first commit on this branch); all new pages added to PRECACHE_URLS

### Notes / decisions

- Live stream page reads from `/config/liveStream` Firestore doc — admin sets `youtubeId` and `isLive` directly in Firestore Console for now; a dedicated admin/livestream.html page could be added in Phase 5 if needed
- Groups member query uses `isPublic==true` filter; admin/groups.html queries all groups (no filter) so admins see hidden groups too
- `members/gallery.html` uses `audience in ['members','youth']` — Firestore `in` operator, no composite index needed (published filter client-side)
- Prayer real-time listener excludes private requests from the member feed (JS filter); admin sees all including private

### Phase 3 — Members Area

- [x] `members-nav.html` + nav.js routing
- [x] `members/index.html` — dashboard
- [x] `members/directory.html` — member directory
- [x] `members/prayer.html` + `admin/prayer.html`
- [x] `members/groups.html` + `admin/groups.html`
- [x] `members/devotional.html` + `admin/devotional.html`
- [x] `members/gallery.html` — members + youth galleries
- [x] `members/live.html` — live stream

Next milestone: Phase 4 — Notifications & Messaging (`members/messages.html`, `admin/notifications.html`, Cloud Functions for FCM broadcasts and DM push).

---

## Session: Music Library (Session 17)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- **`/music.html` + `js/music.js`** — public music library: shared nav, category filters (worship/choir/original/instrumental), track cards with cover art, title, artist, album/duration, an inline HTML5 `<audio>` player, and a download link (all tracks downloadable per policy). No Storage SDK on the public page. Query `published == true` (single equality, no composite index), sorted client-side by releaseDate desc, category filtered client-side.
- **`/admin/music.html`** — full CRUD reusing `js/storage-upload.js`. Form: title, artist, description, category, album, track #, release date, published; audio upload (required for new) + optional cover art. Audio goes to `music/{trackId}_{file}`, cover to `music/covers/{trackId}_{file}` (matching the deployed storage.rules layout). Best-effort `durationSeconds` read from the audio file's metadata before upload. Edit replaces audio/cover (old files cleaned via `deleteMedia`); delete removes the doc + both files. `downloadable: true` stored per policy.
- Added MUSIC to the public nav and admin nav (admin order now Gallery → Music → Connect, matching CLAUDE.md).
- Added the new pages + `js/music.js` to the SW precache; bumped cache version v10 -> v11. CI sw-cache-check passes.

### Notes / decisions

- **Storage path mismatch flagged:** CLAUDE.md's "Firebase Storage Paths" list shows `/music/{trackId}/audio.mp3` and `/music/{trackId}/cover.jpg`, but the deployed `storage.rules` only allow `music/{fileName}` (audio) and `music/covers/{fileName}` (image) — single-segment paths. I followed the rules (enforcement layer) and used `music/{trackId}_{ts}_{name}` + `music/covers/{trackId}_{ts}_{name}`. The CLAUDE.md path list should be reconciled to match (or the rules changed) — did not touch deployed rules.
- Reused the migration-ready `uploadMedia`/`deleteMedia` module from the gallery work — no new Storage knowledge added outside it.

### Phase 2 — Core Public Site: COMPLETE

- [x] `/events.html` + `/admin/events.html`
- [x] `/blog.html` + `/admin/blog.html`
- [x] `/about.html` + `/admin/team.html`
- [x] `/connect.html` + `/admin/connect.html`
- [x] `/gallery.html` + `/admin/gallery.html`
- [x] `/music.html` + `/admin/music.html`

Next milestone: Phase 3 — Members Area.

---

## Session: Gallery + Media Storage Pattern (Session 16)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- **CLAUDE.md:** added a "Media Storage — Designed for Migration" section (Firestore stores plain HTTPS URL strings, host-agnostic rendering, a single swappable upload module, no `gs://`). Fixed the migration trigger from 5GB to 4GB / first egress charge.
- **`js/storage-upload.js`** — the ONLY module that touches Firebase Storage. Exposes `uploadMedia(path, file)` (returns the `getDownloadURL()` HTTPS string) and `deleteMedia(url)` (via `refFromURL`, safely ignores non-Firebase URLs). Migrating hosts = rewrite this one file.
- **`/gallery.html` + `js/gallery.js`** — public gallery: grid of published `audience: "public"` galleries (cover, title, date, image count); clicking opens a lightbox of the gallery's images. Pure URL rendering — **no Storage SDK on the public page**. Query uses a single equality filter (`audience == 'public'`) with published-filter + date-sort client-side, so no composite index is needed.
- **`/admin/gallery.html`** — full CRUD for all audiences (public/members/youth). Multi-image upload via `uploadMedia` to `gallery/{galleryId}/{file}`; stores `imageUrls[]` + `thumbnailUrl` (first image) as strings. Edit adds/removes images (removed ones cleaned from Storage via `deleteMedia`); delete removes the doc + all its Storage images. Save button shows a Saving... state during upload.
- Added GALLERY to the public nav and admin nav.
- Added the new pages + `js/gallery.js` + `js/storage-upload.js` to the SW precache; bumped cache version v9 -> v10. CI sw-cache-check passes.

### Notes / decisions

- This is the project's **first real Firebase Storage usage** — everything before stored pasted URL strings. The `uploadMedia`/`deleteMedia` module is now the template for Music and any future uploads.
- Storage rules already allowed `gallery/{galleryId}/{fileName}` (editor write, image/* ≤5MB, public read) — no storage.rules change needed.
- Gallery `date` stored as a Firestore Timestamp (consistent with events/blog).
- Members/youth galleries are created here but only surface publicly on `/members/gallery.html` (Phase 3); the public page intentionally shows `public` only.

### Phase 2 progress

- [x] `/events.html` + `/admin/events.html`
- [x] `/blog.html` + `/admin/blog.html`
- [x] `/about.html` + `/admin/team.html`
- [x] `/connect.html` + `/admin/connect.html`
- [x] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: Connect Form (Session 15)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- Built `/connect.html` — public visitor connect form (shared nav, navy header). Fields: name (required), email (required), phone (optional), message (required). On submit writes `{name, email, phone, message, read: false, submittedAt}` to `/connect`, then shows a thank-you state with a "send another" reset
- Added `js/connect.js` — form validation, submit-to-Firestore, disabled/sending button state, error handling
- Built `/admin/connect.html` — admin triage view (no add form): lists `/connect` newest-first, unread submissions highlighted (amber ring + Unread badge), Mark-read and Delete actions, clickable mailto/tel links, toasts, Refresh button
- **Firestore rules:** added `allow update: if isEditor();` to `/connect` so admins can mark submissions read (previously only create/read/delete were allowed). Added a "Connect collection" describe block to tests/firestore.rules.test.js (public create ok, unauth read denied, editor read+update ok, member read denied)
- **Ran the security-rules suite locally against the emulator — all 12 tests pass** (4 new Connect tests included)
- Added CONNECT to the public nav (`nav.html`, replacing the commented CONTACT placeholder) and to the admin nav (`admin-nav.html`, after TEAM)
- Added `/connect.html`, `/admin/connect.html`, `/js/connect.js` to the SW precache; bumped cache version v8 -> v9
- Verified the CI sw-cache-check passes

### Notes / decisions

- Collection is `/connect` (matches the Firestore Data Structure section and firestore.rules). The `onNewConnectForm` Cloud Function in CLAUDE.md references `/connectForms` — that's an inconsistency in the doc; flagged, using `/connect`.
- Public create rule is `allow create: if true` (unauthenticated). This is by design but is spam-exposed — a future hardening option is field validation in rules and/or a Cloud Function with abuse protection.

### Phase 2 progress

- [x] `/events.html` + `/admin/events.html`
- [x] `/blog.html` + `/admin/blog.html`
- [x] `/about.html` + `/admin/team.html`
- [x] `/connect.html` + `/admin/connect.html`
- [ ] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: About + Team (Session 14)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- Built `/about.html` — public About page: shared nav, navy header, short static "Who We Are" intro, and a leadership grid loaded from `/team` sorted by `order` ascending (photo or gradient-avatar fallback, name, role, bio)
- Added `js/about.js` — Firestore-driven rendering mirroring js/blog.js
- Built `/admin/team.html` — full CRUD for `/team`, mirroring admin/blog.html: shared admin nav, admin-auth guard, inline add/edit form (name, role, bio, photoUrl, order), list sorted by order asc with avatar + order badge, edit/delete with confirm(), toasts
- Added ABOUT to the public nav (`nav.html`) and TEAM to the admin nav (`admin-nav.html`) — one-line edits each, the payoff of the Session 13 shared-nav refactor
- Added `/about.html`, `/admin/team.html`, `/js/about.js` to the SW precache; bumped cache version v7 -> v8
- Verified the CI sw-cache-check passes

### Notes

- Followed the events/blog convention: team photos use a `photoUrl` text field (not a Storage upload). Storage-backed uploads are deferred to the gallery/music work.
- `/team` has no `published` flag in the schema, so the public page shows all team entries (no draft state).
- Branch `phase2/about-team` is stacked on `refactor/shared-nav` (which is stacked on `phase2/blog-page`). Merge order for the PRs: blog -> shared-nav -> about-team.

### Phase 2 progress

- [x] `/events.html` + `/admin/events.html`
- [x] `/blog.html` + `/admin/blog.html`
- [x] `/about.html` + `/admin/team.html`
- [ ] `/connect.html` + `/admin/connect.html`
- [ ] `/gallery.html` + `/admin/gallery.html`
- [ ] `/music.html` + `/admin/music.html`

---

## Session: Shared Navigation Refactor (Session 13)

**Date:** 2026-05-24
**Status:** In progress — branch pushed, awaiting PR review

### What was done

- Refactored the duplicated per-page nav into shared partials so a new link is edited in ONE place instead of ~26 nav blocks
- Created `/nav.html` — public nav markup only (HOME, SERMONS, EVENTS, BLOG; LIVE STREAM, NOTICE BOARD, CONTACT commented out until those pages exist). Absolute paths so it works from root, /admin/, and future /members/
- Created `/admin-nav.html` — admin nav markup (Back to Site, SERMONS, EVENTS, BLOG, USERS)
- Created `js/nav.js` — fetches the right partial (admin-nav.html when path contains /admin/, else nav.html), injects it into `#nav-placeholder`, highlights the active link by pathname, and dispatches a `nav-loaded` event. Fetches with `Accept: text/html` so the SW network-first HTML strategy serves it offline. Fails gracefully (logs, doesn't crash) if the partial can't load
- Updated `js/main.js` — moved the mobile-menu toggle and `checkAuthState()` into a `nav-loaded` listener (registered at top level) so they bind only after the nav DOM exists; hero video stays on DOMContentLoaded, SW registration on window load
- Replaced the full nav+mobile-menu block with `<div id="nav-placeholder"></div>` and added `<script src="/js/nav.js"></script>` before main.js on: index, profile, sermons, events, blog, admin/users, admin/sermons, admin/events, admin/blog
- Added `/nav.html`, `/admin-nav.html`, `/js/nav.js` to the SW precache; bumped cache version v6 -> v7
- Verified the CI sw-cache-check passes (nav.html + admin-nav.html are root-level HTML, so they must be precached — they are)

### Decisions / notes

- **login.html was intentionally skipped** — it has no nav (full-screen login card), no main.js, and no login-btn. Injecting the shared nav would add a nav bar that wasn't there before. Flagged for the reviewer to decide.
- Branch `refactor/shared-nav` is stacked on `phase2/blog-page` (the blog pages aren't on main yet), so until the blog PR merges, this PR will also show the blog commit.
- profile.html previously had a unique "MY PROFILE" nav link; the shared nav doesn't include it, so profile now shows the standard public nav with no active item (profile is reached via the login/welcome button, not a top-nav link).
- Pre-existing, not addressed: login.html still references the old `/egc-church/manifest.json` path; public nav on index/sermons lacked an EVENTS link before this refactor (the shared nav now gives every public page the same links, which fixes that as a side effect).

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
- [x] `/connect.html` — visitor connect form
- [x] `/about.html` — leadership team from Firestore
- [x] `/gallery.html` — public gallery page
- [x] `/music.html` — public music library (stream + download)
- [x] `/admin/events.html`
- [x] `/admin/blog.html`
- [x] `/admin/team.html`
- [x] `/admin/gallery.html` — manage galleries (with audience selector)
- [x] `/admin/music.html` — upload and manage music tracks
- [x] `/admin/connect.html` — view visitor connect form submissions
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
