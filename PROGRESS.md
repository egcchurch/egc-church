# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with AI_CONTEXT.md to resume quickly.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-12
**Current milestone:** Architecture and planning complete — ready to begin Phase 1 build

---

## Build Phases

### Phase 1 — Foundation (current)
- [ ] Firestore security rules (all collections)
- [ ] Storage security rules
- [ ] Auth guard + role system (membership + adminRole)
- [ ] `js/admin-auth.js` — shared role-checking guard
- [ ] `js/member-auth.js` — shared membership-checking guard
- [ ] Email verification flow (Firebase Auth `sendEmailVerification`)
- [ ] Firebase Cloud Functions setup (`firebase init functions`)
- [ ] `onUserCreate` Cloud Function — auto-create `/users/{uid}` doc on registration
- [ ] `/admin/users.html` — approvals queue + role management (superadmin)
- [ ] `/admin/sermons.html` — add/edit sermons with YouTube URL + metadata
- [ ] `/sermons.html` — connected to Firestore (replace hardcoded data)
- [ ] `/profile.html` — user self-service (display name, photo, password, privacy toggles, resend verification email)
- [ ] Update service-worker.js cache list with new pages and bump cache version

### Phase 2 — Core Public Site
- [ ] `/events.html` — church calendar (public events) with cover images
- [ ] `/blog.html` — announcements with featured images
- [ ] `/connect.html` — visitor connect form
- [ ] `/about.html` — leadership team from Firestore
- [ ] `/gallery.html` — public gallery page
- [ ] `/music.html` — public music library (stream + download)
- [ ] `/admin/events.html`
- [ ] `/admin/blog.html`
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

## Next Steps (immediate)

1. Write Firestore security rules covering all planned collections
2. Write Firebase Storage security rules
3. Build `js/admin-auth.js` — shared role-checking guard for admin pages
4. Build `js/member-auth.js` — shared membership-checking guard for member pages
5. Set up Firebase Cloud Functions project (`firebase init functions`)
6. Build `onUserCreate` function to auto-provision `/users/{uid}` docs
7. Build `/admin/users.html` — pending approvals queue, set membership and adminRole
8. Build `/admin/sermons.html` — YouTube URL paste, metadata form, Firebase Storage upload
9. Update `/sermons.html` to pull from Firestore
10. Build `/profile.html` — user self-service settings with verification resend
11. Update service-worker.js cache list with new Phase 1 pages

---

## Blockers

- None

---

## Architecture Decisions Log

### 2026-05-12 (Session 7) — Sanity fixes for consistency

**Decisions made:**

- Added `"admins"` to the `/notifications/{notificationId}` audience enum — was missing despite Connect form alert targeting admins
- Group leader permissions resolved: leaders manage their own group from `/members/groups.html`, NOT from `/admin/groups.html`. The admin guard checks `adminRole` only — no special cases for leaders.
- Added `pendingMembers: [uid array]` field to /groups for the "approval" joinPolicy flow
- Defined Firestore security rule pattern for groups: editors write any field; leaders write only members/pendingMembers on their own group; members add/remove their own UID
- Email verification edge case handled: /profile.html includes a "resend verification email" action for any user with `emailVerified: false`
- Cloud Functions setup moved into Phase 1 (just `onUserCreate`) — was incorrectly documented as Phase 4 in ENVIRONMENT.md
- ENVIRONMENT.md rewritten to clarify Cloud Functions timing across phases and include emulator instructions
- Service worker cache update task added to Phase 1 (new pages introduced: admin/users, admin/sermons, profile)
- /functions/ folder structure clarified: includes package.json and .eslintrc.js, not just index.js
- /team and /users explicitly noted as independent — team members are content records, not user accounts
- Architecture decision logged: group leaders manage from members area, not admin area

### 2026-05-12 (Session 6) — Privacy, self-service, alert triggers, and account deletion

**Decisions made:**

- Added `/profile.html` for user self-service (display name, photo, password, privacy controls) — any logged-in user
- Added image fields to events (`imageUrl`) and blog (`imageUrl`) schemas with corresponding Storage paths
- Added `coverArtUrl` to music schema for optional album/track artwork
- Member directory privacy: opt-out for visibility, opt-in for email/phone — protects contact details by default
- Added directory privacy fields to /users: `directoryVisible`, `directoryShowEmail`, `directoryShowPhone`
- Added `phone` and `photoUrl` to /users schema
- Email verification required before member approval — uses Firebase Auth built-in
- Group join policy made per-group via `joinPolicy: "open" | "approval" | "invite-only"` field
- Direct messaging confirmed as 1-on-1 initially, but `participants` is an array allowing group chat expansion later without schema change
- Cloud Functions architecture expanded — not just admin broadcasts:
  - `onUserCreate` — auto-provision user doc on registration
  - `onNewMessage` — push FCM for direct messages
  - `onNewPrayerRequest` — alert members (public) or admins (private)
  - `onNewConnectForm` — alert admins of new visitor submissions
  - `sendBroadcast` — admin-triggered broadcast fan-out
  - `weeklyDigest` — scheduled Sunday digest
  - `deleteUserAccount` — GDPR-compliant account deletion
- Account deletion strategy defined: remove personal data, anonymise content authorship as "deleted-user"
- Added "Connect form alert" as new broadcast type (in-app only, audience: admins)
- Storage rules added as Phase 1 task — was implicit before
- Service worker cache list maintenance flagged in Phases 2 and 3

### 2026-05-12 (Session 5) — Galleries, music, and admin moderation pages added

**Decisions made:**

- Galleries use a single `/gallery` collection with an `audience` field ("public" | "members" | "youth") rather than separate collections — simpler admin UX and one moderation flow
- Youth gallery is member-gated (not a separate user role — just a content tag)
- Music is fully public — anyone can stream and download, no login required
- Music categories: worship, choir, original, instrumental
- Music files stored in Firebase Storage; flagged Cloudflare R2 migration path when library approaches 5GB free tier
- Added `/admin/connect.html` to view visitor form submissions (previously orphaned collection)
- Added `/admin/prayer.html` to moderate prayer requests (private ones need a review surface)
- Moved gallery from Phase 5 to Phase 2 — user prioritised it as core public content
- Music admin and public pages also placed in Phase 2 alongside galleries

### 2026-05-12 (Session 4) — Full site architecture designed

**Decisions made:**

- Role model split into two dimensions: `membership` (content access) and `adminRole` (content management)
- Membership tiers: `pending`, `public`, `member`
- Admin roles: `null`, `editor`, `superadmin`
- New registrations default to `pending` — manual superadmin approval required (intentional for congregation context)
- Live stream restricted to `member` tier — not visible to public or pending users
- Admin section is separate from members area — a member is not automatically an editor
- Sermon video delivery via YouTube (youtubeId stored in Firestore) — not self-hosted
- Audio files and PDFs stored in Firebase Storage
- YouTube thumbnail fetched client-side via public URL — no API key needed
- FCM (Firebase Cloud Messaging) confirmed for push notifications
- Cloud Functions confirmed for FCM fan-out and scheduled weekly digest — minimal usage
- Firestore Security Rules are the enforcement layer — JS role checks are UX only
- `published` flag on all content types — supports draft workflow
- Cloudflare R2 or Internet Archive as long-term backup for sermon media (YouTube redundancy)

---

## Session Log

### 2026-05-12 (Session 7)

**What was done:**

- Sanity pass on the full spec — looking for logical inconsistencies and contradictions rather than missing features
- Found and fixed: notifications audience missing "admins"; ENVIRONMENT.md contradicted PROGRESS.md on Cloud Functions timing; Phase 1 missing SW cache update; group leader permission model created edge case in admin guard; email verification edge case unhandled
- Moved group-leader-of-own-group management out of `/admin/groups.html` and into `/members/groups.html` — admin guard stays clean
- Added `pendingMembers` array to /groups for the "approval" join policy flow
- Documented Firestore security rule pattern for groups
- Rewrote ENVIRONMENT.md with correct Cloud Functions timing and Firebase emulator setup
- Added "Logged-In Pages" tier with /profile.html in site map
- Clarified /functions/ folder structure (includes package.json, .eslintrc.js)
- Explicitly noted /team entries are independent of /users — team members may not have user accounts

**What worked:**

- Planning session — gap analysis at this stage prevents painful retrofits when building begins

**What didn't work / needs revisiting:**

- Nothing — clean planning session

**Decisions made:**

- See Architecture Decisions Log above

---

### 2026-05-12 (Session 6)

**What was done:**

- Gap analysis identified missing pieces: no image fields on events/blog, no user self-service page, no directory privacy controls, incomplete Cloud Functions architecture, no group join flow, no music cover art, no account deletion path
- Added `/profile.html` for user self-service
- Added `imageUrl` to events and blog schemas; added Storage paths
- Added `coverArtUrl` to music schema
- Expanded /users schema: phone, photoUrl, emailVerified, directoryVisible, directoryShowEmail, directoryShowPhone
- Defined member directory privacy model (opt-out visibility, opt-in contact details)
- Added `joinPolicy` field to groups
- Added new Cloud Functions section listing all triggers: HTTP, Firestore, scheduled, auth
- Documented account deletion / GDPR flow
- Added new "Connect form alert" broadcast type
- Added "Logged-In Pages" tier to site map for /profile.html
- Updated build phases — added Storage rules to Phase 1, added cache list maintenance to Phases 2 and 3, added account deletion to Phase 5

**What worked:**

- Planning session — surfaced gaps that would have caused painful retrofits later

**What didn't work / needs revisiting:**

- Nothing — clean planning session

**Decisions made:**

- See Architecture Decisions Log above

---

### 2026-05-12 (Session 5)

**What was done:**

- Added galleries: single collection with `audience` field (public, members, youth)
- Added music: new `/music` collection, public access with streaming + downloads, four categories
- Added `/admin/connect.html` to view visitor form submissions
- Added `/admin/prayer.html` to moderate prayer requests
- Updated Firestore schema, Firebase Storage paths, site map, project structure
- Added Music & Gallery Strategy section to AI_CONTEXT.md
- Resequenced build phases — galleries and music moved up to Phase 2

**What worked:**

- Planning session — gap analysis surfaced missing admin pages for orphaned collections

**What didn't work / needs revisiting:**

- Music storage will need migration plan to Cloudflare R2 once library grows past ~5GB

**Decisions made:**

- See Architecture Decisions Log above

---

### 2026-05-12 (Session 4)

**What was done:**

- Full site architecture planned and documented
- Complete site map defined (public, member, admin pages)
- Role and permission model designed (membership tier + adminRole, independent dimensions)
- Member approval flow designed (pending → approved by superadmin)
- Notification and messaging architecture designed (FCM push + Firestore real-time)
- Full Firestore schema defined for all collections
- Firebase Storage path structure defined
- Sermon media strategy finalised (YouTube primary, Storage for audio/PDF, backup TBD)
- Build phases 1-5 sequenced
- AI_CONTEXT.md and PROGRESS.md fully updated

**What worked:**

- Planning session — no code written

**What didn't work / needs revisiting:**

- Nothing — clean planning session

**Decisions made:**

- See Architecture Decisions Log above

---

### 2026-05-12 (Session 3)

**What was done:**

- Added service-worker.js at project root
- Implemented cache-first strategy for static assets and CDN resources
- Implemented network-first strategy for HTML pages with offline fallback
- Excluded hero video from caching (too large for Cache Storage)
- Excluded Firebase auth/API calls from SW interception
- Added SW registration to js/main.js

**What worked:**

- SW registration pattern using /egc-church/ scope to match GitHub Pages subdirectory

**What didn't work / needs revisiting:**

- Nothing — straightforward implementation

**Decisions made:**

- Cache name set to egc-cache-v1 — bump version string on each deploy with breaking changes
- Video excluded by URL pattern match on 'CloudVideo' filename
- CDN origins (jsdelivr, cdnjs, gstatic) cached at runtime on first fetch

---

### 2026-05-12 (Session 2)

**What was done:**

- Added PWA manifest.json
- Generated icon set from EGC logo (8 sizes: 72 to 512px)
- Added manifest link, theme-color, apple-touch-icon meta tags to all HTML pages
- Committed and pushed — PWA now installable from live site

**What worked:**

- Icon generation via PowerShell System.Drawing script
- PWA install prompt appearing on live site

**What didn't work / needs revisiting:**

- Initial logo.png was corrupt — had to re-save from browser before icons generated correctly

**Decisions made:**

- Used logo from egc.church as PWA icon source
- manifest start_url and scope set to /egc-church/ to match GitHub Pages subdirectory

---

### 2026-05-12 (Session 1)

**What was done:**

- Audited old project (church-website-pwaold)
- Set up clean new repo at https://github.com/egcchurch/egc-church
- Removed Python scaffold, copied website files across
- Configured GitHub Pages (main branch, root)
- Fixed Firebase authorised domains (127.0.0.1, egcchurch.github.io)
- Committed firebase-config.js (intentional — public-facing config)
- Verified live site working at https://egcchurch.github.io/egc-church/

**What worked:**

- Clean git history from scratch
- GitHub Pages deployment working
- Firebase auth working locally and on live site

**What didn't work / needs revisiting:**

- Video hero may be slow on GitHub Pages (large file, no CDN)

**Decisions made:**

- Committed firebase-config.js rather than using GitHub Secrets (appropriate for public church site)
- Tailwind CDN build acceptable for now (no build step complexity)
- Serve from root of main branch (simplest GitHub Pages setup)

---

<!-- Copy the session block above for each new session -->
<!-- Most recent session should always be at the TOP -->
