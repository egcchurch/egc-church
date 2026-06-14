# Roadmap — Future Improvements

> Tracked ideas and improvements beyond Phase 7. Items move to a formal phase doc
> (like `docs/PERMISSIONS.md`) once they are scoped and ready to build.
> Updated: 2026-06-14 (all phases and Priority 1/2/3 items completed)

---

## Completed Phases

### Phase 8 — Multi-Church Template (`docs/PHASE8.md`)

Makes the codebase a reusable template. Any church can fork the repo, run a
one-time setup script, and have a fully working site. Ongoing customisation
(branding, feature toggles, contact info, notification routing) done entirely
through an admin settings UI — no CLI or code changes needed after initial deploy.

Sub-phases: 8a config foundation → 8b admin settings UI → 8c branding/theming →
8d feature flags → 8e template packaging (setup scripts, `SETUP.md`, GitHub template flag).

**Status:** Done — see `docs/PHASE8.md`

### Phase 9 — Page Composition (`docs/PHASE9.md`)

Builds on Phase 8's `/config/` infrastructure. Adds a visual section manager for
key pages (homepage, about, members dashboard): superadmins can toggle predefined
sections on/off and reorder them. Each section has its own content editor. No
free-form layout — sections are fixed in design, composable in order.

**Status:** Done — see `docs/PHASE9.md`

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
**Status:** Done (PR #106, 2026-06-14)
New `/series/{seriesId}` collection + `/admin/series.html`. Series picker in `/admin/sermons.html`. Series view tab on `/sermons.html` with drill-down to series sermon list.

### Event RSVP
**Status:** Done (PR #105, 2026-06-14)
`rsvps: [uid array]` on events; Firestore rule allows members to update `rsvps` only; RSVP button on `/events.html` (member-only); RSVP count visible to all; admin expandable RSVP viewer.

### Email / password self-registration
**Status:** Done (PR #101, 2026-06-14)
Three-panel `/login.html` (Sign In / Create Account / Forgot Password).
`createUserWithEmailAndPassword` → `updateProfile` → `sendEmailVerification`.
`onUserCreate` Cloud Function auto-provisions with `membership: pending`.
Superadmin approval flow unchanged.

### Group chat
**Status:** Done (PR #108, 2026-06-14)
"Group Chat" button in leader section of `/members/groups.html`. Creates group conversation (`type: 'group'`) with all leaders + members as participants; idempotent. Group convs show group name + indigo icon in messages sidebar; sender name + avatar shown in thread.

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
**Status:** Done (PR #112, 2026-06-14)
Replace the manual "Set Live / End Stream" admin toggle with automatic detection
via the YouTube Data API v3 (`liveBroadcasts.list` with `broadcastStatus=active`).
Eliminates the risk of forgetting to end the stream (which would show a stale
LIVE NOW banner to members). Requires YouTube Data API key set via
`firebase functions:config:set youtube.apikey="..."` and YouTube channel ID set
via `firebase functions:config:set youtube.channelid="..."`.

Quota: 10,000 units/day free; polling every 5 minutes uses ~288 units/day — well within free tier.

### Global content search
**Status:** Done (PR #113, 2026-06-14)
Search overlay (⌘K / Ctrl+K or nav magnifier) that searches sermons, events, and
blog posts fetched from Firestore. Client-side fuzzy match, debounced, keyboard
navigable. Results link directly to the content page.

### Offline Firestore content
**Status:** Done (PR #107, 2026-06-14)
`enablePersistence({ synchronizeTabs: true })` in `js/main.js`, module scope, skipped on `/admin/*` pages. Members can now browse previously-loaded content when offline.

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
- **Tailwind CDN → compiled CSS** — CLAUDE.md prohibits a build step; Tailwind
  classes are also generated dynamically in JS, so static CLI scanning would miss
  them. CDN runtime is acceptable at current traffic.
