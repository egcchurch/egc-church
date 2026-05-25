# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.
> Older sessions are in `PROGRESS-archive.md` — only read it if you need historical detail.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-25
**Current milestone:** Phase 6 — Permissions & Roles (planning)

---

## Session: Phase 6 & 7 planning docs (Session 25)

**Date:** 2026-05-25
**Branch:** `docs/phase-6-7-planning`
**Status:** Merged (PR #30)

### What was done

- **`docs/PERMISSIONS.md`** — Full design spec for Phase 6: granular per-area permission keys, 7 default roles, Firestore `/roles/` schema, `syncUserClaims` Cloud Function, security rules sketch, migration plan, and 8-PR sequencing plan.
- **`docs/HOMEPAGE.md`** — Full design spec for Phase 7: four-state adaptive home surface (visitor / pending / public / member), live stream surfacing via `/homepage/content`, notice board `kind` field, gated-content prompts replacing silent redirects, "Request member access" flow, FCM token registration scoped to members only. 7-PR sequencing plan.

### Notes / decisions

- Phase 6 must land before Phase 7 PR #5 (admin shortcuts strip) — `hasPermission()` helper is a dependency.
- `adminRole` field kept during Phase 6 migration window; removed in cleanup PR #8.

---

## Session: Nav dropdown fix (Session 24)

**Date:** 2026-05-25
**Branch:** `fix/nav-dropdown`
**Status:** Merged (PR #29)

### What was done

- **`members-nav.html`** — Replaced 8 individual desktop links with a single `MEMBERS ▾` dropdown (click to open, Escape/outside-click to close, chevron rotates 180° when open). Mobile nav untouched.
- **`admin-nav.html`** — Replaced 13 individual desktop links (SERMONS … USERS) with a single `ADMIN ▾` dropdown. Same behaviour. Mobile nav untouched.
- **`js/main.js`** — Added `initNavDropdowns()`: binds click-toggle on each dropdown button; closes all nav dropdowns before opening one; closes on outside click and Escape key. Called from `nav-loaded` handler.
- **`js/nav.js`** — Updated `highlightActiveLink()` to also highlight the dropdown trigger button (`text-amber-600 font-semibold`) when the current path starts with `/members/` or `/admin/`. Also removes `hover:bg-amber-50` from the matched dropdown link (consistent active state).

### Notes / decisions

- No new pages added — SW cache list and cache version unchanged.
- Dropdown open/close uses the same outside-click pattern already used for the user account dropdown (`!wrapper.contains(e.target)`), so the two are naturally mutually exclusive without extra coupling.
- Chevron rotation uses Tailwind's `rotate-180` + `transition-transform duration-200` classes, toggled in JS.

---

## Session: Phase 5 — Docs housekeeping (Session 23)

**Date:** 2026-05-25
**Branch:** `chore/update-docs-phase5`
**Status:** Merged (PR #28)

### What was done

- **`CLAUDE.md`** — Added sequential branching rule to Constraints & Rules and a "Multi-PR sessions" callout to Development Workflow. Marked Phase 5 complete.
- **`PROGRESS.md`** — Updated current milestone; updated Session 22 status to show all three PRs merged. Archived sessions 1–21 to `PROGRESS-archive.md`.

### Notes / decisions

- Rule added after Phase 5 merge conflict incident: two branches both appended to `functions/index.js` from the same base commit, causing a rebase conflict. Rule: wait for each PR to merge before branching the next.

---

## Session: Phase 5 — Polish (Session 22)

**Date:** 2026-05-25
**Branches:** `phase5/homepage` (PR #25, merged), `phase5/account-deletion` (PR #26, merged), `phase5/podcast-rss` (PR #27, merged)
**Status:** All three PRs merged

### What was done

**PR #25 — `phase5/homepage` (merged):**
- **`js/homepage.js`** — IIFE. Waits for Firebase, loads `/homepage/content` doc, populates `#hero-tagline`, shows/hides announcement banner, renders service times grid. Falls back to default service times (Sunday 10:00 AM, Wednesday 7:00 PM) if no Firestore doc exists; renders defaults immediately on DOMContentLoaded to avoid flash of empty content.
- **`index.html`** — three new sections below hero: announcement banner (amber, `hidden` by default), service times grid (navy, "Join Us"), static Explore cards (Sermons, Events, Music, Connect). `id="hero-tagline"` added to tagline. Loads `js/homepage.js`.
- **`admin/homepage.html`** — editor-gated. Edit tagline; toggle announcement with title + body; add/remove service time rows (label/day/time). Saves to `/homepage/content` with `set({ merge: true })`.
- **`admin-nav.html`** — HOMEPAGE link added to desktop + mobile.
- **`admin/index.html`** — Homepage card (cyan, house icon).
- **`firestore.rules`** — `/homepage/{id}`: public read, editor write.
- **`tests/firestore.rules.test.js`** — 3 new homepage tests.
- **`service-worker.js`** — cache v15 → v16; `admin/homepage.html` + `js/homepage.js` added.

**PR #26 — `phase5/account-deletion` (merged):**
- **`functions/index.js`** — `deleteUserAccount` (callable): deletes profile photo from Storage (best-effort), FCM tokens subcollection, notifications subcollection (batched 400), anonymises prayer requests + gallery entries, removes user from group arrays, deletes `/users/{uid}` doc, then deletes Firebase Auth account.
- **`profile.html`** — Danger Zone card: user types their email to confirm + `confirm()` dialog. Calls Cloud Function, signs out, redirects to `/index.html`. Loads `firebase-functions-compat.js`.

**PR #27 — `phase5/podcast-rss` (merged):**
- **`functions/index.js`** — `podcastFeed` (HTTP): queries `published == true` sermons, filters for `audioUrl`, sorts by `date` desc client-side (no composite index), returns RSS 2.0 + iTunes XML (up to 100 items, 1-hour cache). `xmlEsc()` and `toRFC822()` helpers.
- **`firebase.json`** — `rewrites` added to both staging and production: `{ "source": "/feed.xml", "function": "podcastFeed" }`.
- Feed URL: `https://app.egc.church/feed.xml`

### Notes / decisions

- Homepage defaults rendered immediately (before Firestore) so the service times section is never blank.
- Account deletion ordering: Auth account deleted last — earlier deletions use admin SDK (unaffected by Auth state), but deleting Auth first would invalidate the callable context.
- Podcast `enclosure length="0"`: file sizes not stored in Firestore; length="0" is broadly accepted by podcast clients.
- `/feed.xml` via Hosting rewrite: routes transparently to the Cloud Function; GET-only (405 for others).

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

### Phase 2 — Core Public Site (COMPLETE)

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
- [x] Update service-worker.js cache list with new pages and bump cache version

### Phase 3 — Members Area (COMPLETE)

- [x] `/members/live.html` — live stream (member-gated)
- [x] `/members/prayer.html` — prayer request submission and listing
- [x] `/members/groups.html` — browse and join groups, leader-only sections for managing own group
- [x] `/members/directory.html` — membership directory (respects privacy flags)
- [x] `/members/devotional.html` — daily devotional
- [x] `/members/gallery.html` — members + youth galleries
- [x] `/admin/prayer.html` — moderate prayer requests
- [x] `/admin/groups.html` — full group management (editor/superadmin only)
- [x] `/admin/devotional.html`
- [x] Update service-worker.js cache list and bump cache version (v12)

### Phase 4 — Notifications & Messaging (COMPLETE)

- [x] FCM token registration on login
- [x] In-app notification bell (nav, real-time Firestore listener)
- [x] `/admin/notifications.html` — compose and send broadcasts
- [x] Cloud Function: `sendBroadcast` (HTTP/callable, FCM fan-out)
- [x] Cloud Function: `onNewMessage` (Firestore trigger, DM push)
- [x] Cloud Function: `onNewPrayerRequest` (Firestore trigger, alert fan-out)
- [x] Cloud Function: `onNewConnectForm` (Firestore trigger, admin alert)
- [x] Cloud Function: `weeklyDigest` (scheduled, Sunday)
- [x] `/members/messages.html` — direct messaging between members

### Phase 5 — Polish (COMPLETE)

- [x] Homepage dynamic content from Firestore
- [x] `/admin/homepage.html` — manage homepage content blocks
- [x] Podcast RSS feed (`/feed.xml` via Cloud Function)
- [x] Cloud Function: `deleteUserAccount` (GDPR-compliant account deletion)
- [x] Account deletion UI on `/profile.html`
- [ ] Cloudflare R2 / Internet Archive backup for sermon media (deferred)
- [ ] Cloudflare R2 migration path for music if approaching 4GB (deferred)
