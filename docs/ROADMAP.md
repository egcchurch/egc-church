# Roadmap — Future Improvements

> Tracked ideas and improvements beyond Phase 7. Items move to a formal phase doc
> (like `docs/PERMISSIONS.md`) once they are scoped and ready to build.
> Updated: 2026-06-12 (Phase 8 and 9 added)

---

## Upcoming Phases

### Phase 8 — Multi-Church Template (`docs/PHASE8.md`)

Makes the codebase a reusable template. Any church can fork the repo, run a
one-time setup script, and have a fully working site. Ongoing customisation
(branding, feature toggles, contact info, notification routing) done entirely
through an admin settings UI — no CLI or code changes needed after initial deploy.

Sub-phases: 8a config foundation → 8b admin settings UI → 8c branding/theming →
8d feature flags → 8e template packaging (setup scripts, `SETUP.md`, GitHub template flag).

**Status:** Not started

### Phase 9 — Page Composition

Builds on Phase 8's `/config/` infrastructure. Adds a visual section manager for
key pages (homepage, about, members dashboard): superadmins can toggle predefined
sections on/off and reorder them. Each section has its own content editor. No
free-form layout — sections are fixed in design, composable in order. Scope and
page list to be defined in `docs/PHASE9.md` before starting.

**Status:** Not started (depends on Phase 8)

---

## Priority 1 — Quick Wins

Small effort, immediate value. Do these next.

### PWA install prompt
**Status:** Done (PR #81, 2026-06-12)
Encourage members to install the PWA to their home screen. FCM push notifications
only work from standalone (installed) mode, so prompt visibility directly drives
push delivery rates. Show a one-time dismissible banner when the browser fires the
`beforeinstallprompt` event. Store dismissal in `localStorage` so it doesn't
reappear on every visit.

### Security rule tests for the three fixed vulnerabilities
**Status:** Done (PR #82, 2026-06-12)
The existing 41-test suite does not cover the specific denial paths fixed in the
June 2026 security review. Add targeted tests:
- `users.approve` holder cannot write `isSuperadmin: true`
- `users.assign_roles` holder cannot write `membership`
- Conversation participant cannot overwrite `participants` array
See `tests/firestore.rules.test.js` for the existing test pattern.

### Connect form email alert
**Status:** Moved to Phase 8a (`docs/PHASE8.md`)
Will be implemented as the first deliverable of Phase 8, using Resend and
the `/config/notifications.connectAlertEmail` Firestore field so the
destination address is changeable from the admin UI without a redeploy.

### `requestMemberAccess` — notify role-based `users.approve` holders
**Status:** Done (PR #99, 2026-06-14)
`functions/index.js` `requestMemberAccess` only notifies superadmins and users
with `users.approve` in `extraPermissions`. Users who hold `users.approve` via
a *role* assignment are silently missed. Fix: after fetching the two existing
snapshots, also fetch all role docs that include `users.approve` in their
`permissions` array, then fetch users whose `roles` array intersects that set.
See PROGRESS.md Session 61 for full description.

---

## Priority 2 — Feature Additions

Medium effort. Each would need a scoped plan doc before starting.

### Sermon series / playlists
Group sermons into a named series (e.g. "Foundations — Part 3 of 5").

**Schema change:**
- New `/series/{seriesId}` collection: `title`, `description`, `imageUrl`, `order`, `published`
- Add `seriesId` (nullable) and `seriesOrder` (nullable int) to `/sermons/{id}`

**UI:**
- `/admin/sermons.html` — series picker dropdown when creating/editing a sermon
- `/sermons.html` — series grouping view alongside the existing flat list
- `/admin/series.html` — new page to create and manage series

### Event RSVP
Let members indicate attendance for events.

**Schema change:** Add `rsvps: [uid array]` to `/events/{id}`.

**Firestore rule:** Members can add/remove their own UID from `rsvps` only
(same `affectedKeys` pattern as group join).

**UI:** RSVP button on `/events.html` (member-only, shows count to all).
Admin events page shows RSVP list per event.

### Email / password self-registration
**Status:** Done (PR #101, 2026-06-14)
Three-panel `/login.html` (Sign In / Create Account / Forgot Password).
`createUserWithEmailAndPassword` → `updateProfile` → `sendEmailVerification`.
`onUserCreate` Cloud Function auto-provisions with `membership: pending`.
Superadmin approval flow unchanged.

### Group chat
The `participants` array on conversations already supports N UIDs — the data model
is ready for group chat. Extend `/members/messages.html` to support group
conversations created from a small group's member list.

**Scope:** Group conversations only creatable by a group leader or admin. Members
can be added/removed by the group leader. Messages display sender name + avatar.

### Prayer request updates / answered prayers
**Status:** Done (PR #102, 2026-06-14)
Filter tabs (All / Active / Answered / My Requests) on members prayer page.
Mark-as-answered flow with optional testimony textarea. Admin prayer page with
All / Active / Answered / Public / Private tabs. Firestore rule tightened so
authors can only update `status`, `testimony`, `prayedFor`.

### Member onboarding
**Status:** Done (PR #103, 2026-06-14)
New `welcomeNewMember` Cloud Function (Firestore trigger on `/users/{uid}`).
When `membership` changes to `'member'`, writes a welcome in-app notification
to the user pointing them to the members area.

---

## Priority 3 — Technical Improvements

Worth doing when the relevant area is being touched anyway.

### Cloudflare R2 migration (media storage)
Already documented in CLAUDE.md. Check Firebase Storage usage monthly.
Migrate to R2 when approaching **4 GB used** or when egress charges first appear.
Migration is a zero-schema-change operation — rewrite only `js/storage-upload.js`.

### YouTube API live stream auto-detection
Replace the manual "Set Live / End Stream" admin toggle with automatic detection
via the YouTube Data API v3 (`liveBroadcasts.list` with `broadcastStatus=active`).
Eliminates the risk of forgetting to end the stream (which would show a stale
LIVE NOW banner to members).

**Consideration:** Requires a YouTube Data API key (server-side in Cloud Functions
to avoid exposing the key client-side). Quota: 10,000 units/day free; a polling
function every 5 minutes uses ~288 units/day — well within free tier.

### Offline Firestore content
The service worker caches static assets but Firestore data (sermons, events, blog
posts) always requires a live connection. Enabling Firestore's built-in offline
persistence (`firebase.firestore().enablePersistence()`) would let members browse
previously-loaded content when offline with no code changes to data-fetching logic.

**Caveat:** Persistence uses IndexedDB. Disable on pages with large result sets
(e.g. admin pages) to avoid excessive local storage use.

### Tailwind CDN → compiled CSS
The Tailwind v4 browser CDN build scans the DOM at runtime, which adds ~50–100ms
to first render. A one-time `npx @tailwindcss/cli build` step producing a static
`assets/css/tailwind.css` would eliminate this. Requires a build step to be added
to the CI workflow and to the local dev process.

**Only worth doing if page load time becomes a real concern** — at current traffic
the CDN build is acceptable.

---

## Out of Scope (decided against)

These were considered and deliberately excluded:

- **Giving / tithing feature** — out of scope for this app; the church uses an
  external giving platform. No plans to replicate it here.
- **Attendance tracking / check-in** — requires a physical scanning workflow that
  is better handled by a dedicated tool.
- **Membership tiers beyond pending / public / member** — current three-tier model
  covers the church's needs. Adding tiers would complicate the auth guard logic
  significantly.
- **Auto-detecting YouTube live status** — deferred pending API key management
  decision. Manual toggle is working reliably.
