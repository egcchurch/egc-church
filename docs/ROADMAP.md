# Roadmap — Future Improvements

> Tracked ideas and improvements beyond Phase 7. Items move to a formal phase doc
> (like `docs/PERMISSIONS.md`) once they are scoped and ready to build.
> Updated: 2026-06-12

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
**Status:** Not started
New connect form submissions currently only trigger an in-app notification.
Most admins aren't actively watching the bell. A Cloud Function that sends an
email (via SendGrid, Resend, or Firebase Extensions) when `onNewConnectForm`
fires would provide a more reliable admin alert. Low code cost — the trigger
already exists; just add an email send alongside the in-app write.

### `requestMemberAccess` — notify role-based `users.approve` holders
**Status:** Not started
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
Currently new members can only self-register via Google sign-in. Members without
Google accounts must be admin-created. A standard sign-up form (email, password,
display name) on `/login.html` would open registration to everyone.

**Considerations:**
- Firebase Auth `createUserWithEmailAndPassword` — same `onUserCreate` trigger fires
- `sendEmailVerification` already called for new users
- Superadmin approval flow unchanged (new users start as `pending`)

### Group chat
The `participants` array on conversations already supports N UIDs — the data model
is ready for group chat. Extend `/members/messages.html` to support group
conversations created from a small group's member list.

**Scope:** Group conversations only creatable by a group leader or admin. Members
can be added/removed by the group leader. Messages display sender name + avatar.

### Prayer request updates / answered prayers
No way to mark a request answered or add a testimony. Closes the loop for the
prayer wall.

**Schema change:** Add `status: "active" | "answered"` and
`testimony: string | null` to `/prayer/{id}`.

**UI:** Request author (and admins) can update status and add a testimony.
Filter chips on `/members/prayer.html`: All / Active / Answered.

### Member onboarding
When a superadmin approves a pending user, there is no welcome message or
orientation. A triggered in-app notification + welcome email when
`membership` changes from `pending` to `member` would improve first-day experience.

**Implementation:** `syncUserClaims` or a new Firestore trigger on the `membership`
field change in `onUserCreate` — or extend the existing `syncUserNotificationEligibility`
trigger to also send a welcome notification when membership *rises* to `member`.

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
