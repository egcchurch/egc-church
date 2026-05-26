# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.
> Older sessions are in `PROGRESS-archive.md` — only read it if you need historical detail.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-26
**Current milestone:** Phase 6 — Permissions & Roles (complete — all 8 PRs merged)

---

## Session: Phase 6 PR 8 — adminRole cleanup (Session 33)

**Date:** 2026-05-26
**Branch:** `phase6/remove-adminrole`
**Status:** PR open

### What was done

**`firestore.rules`**
- Removed the migration-window comment about `adminRole` (already unused in rules since PR 7).

**`storage.rules`**
- Replaced `isEditor()` helper (Firestore read on `adminRole`) with `isAdminUser()` using custom claims: `request.auth.token.superadmin == true || (request.auth.token.perms is list && perms.size() > 0)`. No more Firestore read on every storage write.

**`js/admin-auth.js`**
- Removed the Firestore read for `adminRole` check.
- Replaced with a single `user.getIdTokenResult()` call. Base check (no `data-require-perm`): `superadmin === true || (perms is non-empty array)`. Per-page check (with `data-require-perm`): `superadmin === true || perms.includes(requiredPerm)`. One async step instead of two.

**`js/main.js`**
- `isAdmin` computed from `userData.isSuperadmin === true || userData.roles.length > 0 || userData.extraPermissions.length > 0` (Phase 6 fields) instead of `userData.adminRole`.

**`admin/users.html`**
- `isSuperadmin` detected from `doc.data().isSuperadmin === true` (was `adminRole === 'superadmin'`).
- Removed `roleBadge` (displayed the `adminRole` value as a blue badge). `isSABadge` already covers the superadmin indicator.
- Removed `roleButtons` section ("Make Editor / Make Superadmin / Remove Role" buttons).
- Removed `setRole()` function and its section comment. Permissions are now managed exclusively via the expandable Permissions section (roles + extraPermissions + isSuperadmin toggle).
- Renamed "Membership / legacy role helpers" comment to "Membership helpers".

**`admin/roles.html`**
- `isSuperadmin` detected from `doc.data().isSuperadmin === true`.

**`functions/index.js`**
- `onUserCreate`: removed `adminRole: null` from the provisioned doc; added `isSuperadmin: false`, `roles: []`, `extraPermissions: []` as the Phase 6 defaults.
- `sendBroadcast`: auth check now uses `context.auth.token.superadmin / perms` (custom claims) — removed the Firestore read of the caller doc. `audience === 'admins'` query replaced: fetches all users and filters for `isSuperadmin || roles.length > 0 || extraPermissions.length > 0` (covers all variants of admin capability).
- `onNewPrayerRequest`: private prayer → admins query uses same fetch-all-and-filter approach.
- `onNewConnectForm`: admins query uses same fetch-all-and-filter approach.
- `migrateRolesV1`: auth check now uses `context.auth.token.superadmin` (claims populated since migration ran). Removed Firestore read of caller doc. Removed comment about `adminRole` fallback.

**`tests/firestore.rules.test.js`**
- Removed `adminRole` from all user seed data. Replaced `adminRole: 'editor'` with `isSuperadmin: false, roles: ['content_editor']` and `adminRole: 'superadmin'` with `isSuperadmin: true, roles: []`. All 57 tests pass unchanged.

**`CLAUDE.md`**
- Removed `adminRole` from `/users/{uid}` schema; added `isSuperadmin`, `roles`, `extraPermissions` fields.
- Updated Admin Pages table: added `Required permission` column, removed old "editor or superadmin" heading.
- Replaced "Admin Role" section in Role & Permission Model with Phase 6 model description (custom claims, `docs/PERMISSIONS.md` pointer).
- Updated Combined Access Matrix column headers.
- Updated Approval Flow, `onUserCreate` description, `migrateRolesV1` description, group leader description, and Member Directory "Never shown" list.
- Updated `admin/` folder comment and `admin/groups.html` line to reference permissions instead of `adminRole`.

### Notes / decisions

- `storage.rules` `isAdminUser()` uses `perms.size() > 0` rather than checking a specific permission per path. This is consistent with how any admin-role user previously had blanket storage write access. If finer-grained storage rules are needed later (e.g. only `sermons.manage` can write to `/sermons/`), that can be done without a schema change.
- Cloud Functions `audience === 'admins'` query now fetches all users and filters in code. At church scale (< 200 users) this is negligible. A dedicated `isAdmin` boolean field would enable a Firestore query but was out of scope for this cleanup PR.
- The `migrateRolesV1` function retains the `adminRole`-to-Phase6 mapping logic internally (the batch reads still access `u.adminRole` on existing docs). This is fine — the function is idempotent and only runs against docs that haven't been migrated yet. Those docs still have `adminRole` present as historical data.

---

## Session: Phase 6 PR 7 — rules migration + nav/dashboard permission filtering (Session 32)

**Date:** 2026-05-26
**Branch:** `phase6/migrate-rules-and-pages`
**Status:** PR open

### What was done

**Firestore rules (`firestore.rules`)**
- Replaced `isEditor()` and `isSuperAdmin()` Firestore-read helpers with claims-based `isSuperadmin()` (`request.auth.token.superadmin == true`) and `hasPermission(p)` (`superadmin || perms list contains p`). `isMember()` and `isOwner()` unchanged.
- Every collection's write rule now uses `hasPermission('<area>.manage|send|moderate|view')` — one permission key per admin area.
- `/users/{uid}` update rule: `isOwner || isSuperadmin || hasPermission('users.approve') || (hasPermission('users.assign_roles') && !affectedKeys.hasAny(['isSuperadmin']))` — enforces the privilege-escalation boundary at the rules layer.
- Added missing `/team/{id}` rules block (public read, `team.manage` write) — previously no rule existed for this collection.

**Tests (`tests/firestore.rules.test.js`)**
- `editorUser()`: updated to pass `{ perms: [all 14 keys] }` custom claims (was empty `{}`).
- `superAdmin()`: updated to pass `{ superadmin: true }` (was empty `{}`).
- All 57 tests pass (41 rules tests + 16 unit tests).

**`js/permissions.js`**
- Added `filterAdminNav()`: hides `<a data-perm>` links in `#admin-nav-panel` and `#mobile-menu` where the user lacks the permission; hides `#admin-nav-wrapper` entirely if no links remain visible.

**`js/main.js`**
- `updateLoginButtons()` now calls `Permissions.init(user).then(() => Permissions.filterAdminNav())` after auth settles, guarded by `typeof Permissions !== 'undefined'` so it is a no-op on non-admin pages.

**`admin-nav.html`**
- All 14 admin nav links (desktop dropdown + mobile menu) now carry `data-perm="<key>"` attributes. `filterAdminNav()` uses these to show/hide links and the dropdown trigger.

**`admin/index.html`**
- Added `permissions.js` script tag. Added `id="dashboard-grid"` and `data-perm` on all 14 cards. Inline script runs `Permissions.init(user).then(...)` and hides cards the user cannot access.

**All 14 admin content pages** (`sermons`, `events`, `blog`, `team`, `gallery`, `music`, `devotional`, `groups`, `homepage`, `notifications`, `prayer`, `connect`, `users`, `roles`)
- Added `<script src="/js/permissions.js"></script>` before `admin-auth.js`.
- Added `data-require-perm="<key>"` to the `admin-auth.js` script tag so the guard enforces the per-page permission via custom claims in addition to the existing `adminRole` check.

### Notes / decisions

- `isSuperadmin()` in rules now reads from `request.auth.token.superadmin` (custom claim), not from the Firestore user doc. This eliminates the extra Firestore read on every admin write and aligns with the Phase 6 design principle.
- `adminRole` field kept in Firestore user docs — removed in PR 8 cleanup.
- `isMember()` still reads from Firestore (`membership` field) — membership is intentionally NOT in custom claims; it's content-access, not capability-access.
- The `PERMISSION_DENIED` log lines in test output are expected — they come from `assertFails` tests confirming denials.
- Flash of all-links-visible before auth settles is acceptable (admin nav, not a public surface). Firestore rules and page-level guards are the real security boundary.

---

## Session: Phase 6 PR 6 — permissions helper + admin-auth refactor (Session 31)

**Date:** 2026-05-25
**Branch:** `phase6/permission-helper`
**Status:** PR open

### What was done

- **`js/permissions.js`** — New module. Exposes `Permissions.init(user)` (Promise, fetches and caches custom claims from `user.getIdTokenResult()`), `Permissions.hasPermission(key)` (synchronous after init), `Permissions.isSuperadmin()` (synchronous), and `Permissions.refresh(user)` (force token refresh then re-cache — call after saving role changes so new claims are immediately visible). Claims format: `{ superadmin: true }` for superadmins; `{ superadmin: false, perms: [...] }` for everyone else.
- **`js/admin-auth.js`** — Refactored to optionally accept `data-require-perm="<key>"` on the script tag. Captures `document.currentScript.dataset.requirePerm` synchronously at IIFE start (before any async callbacks). After the existing `adminRole` check passes, if a perm is specified, calls `user.getIdTokenResult()` and checks `claims.superadmin === true || claims.perms.includes(requiredPerm)`. Without the attribute the guard behaves exactly as before. All existing pages remain unaffected.
- **`service-worker.js`** — Cache bumped `v17 → v18`; `/js/permissions.js` added to precache list.

### Notes / decisions

- `permissions.js` is not loaded by any page yet — that happens in PR 7. The module is created now so PR 7 can add `<script src="/js/permissions.js">` alongside the nav/dashboard filtering changes in a single coherent commit.
- `document.currentScript` is captured synchronously at the top of the `admin-auth.js` IIFE before the `waitForFirebase` / `onAuthStateChanged` callbacks run — the only window where it is reliably non-null for a synchronously-parsed `<script>` tag.
- `Permissions.refresh(user)` calls `getIdToken(true)` (force refresh) before re-fetching claims — this is necessary after `syncUserClaims` writes new custom claims, since the local token is cached and won't reflect the update until refreshed.

---

## Session: Phase 6 PR 5 — admin/users.html permissions UI (Session 30)

**Date:** 2026-05-25
**Branch:** `phase6/admin-users-ui`
**Status:** PR open

### What was done

- **`admin/users.html`** — Added expandable "Permissions" section to every user card (both Pending and All Members tabs).
  - Roles fetched from `/roles/` collection on page load (parallel with current-user doc fetch).
  - Each card has a "Permissions ▾" toggle bar (chevron rotates on open). Collapsed by default.
  - Inside: two-column grid — **Roles** checklist (one checkbox per `/roles/` doc, pre-checked from `u.roles`) and **Extra Permissions** checklist (all 14 permission keys, pre-checked from `u.extraPermissions`).
  - **Superadmin override toggle** (amber toggle switch): rendered only when the viewing user is a superadmin AND the card is not their own record (prevents self-lockout). Pre-set from `u.isSuperadmin`.
  - **Save Permissions** button writes `roles`, `extraPermissions`, and optionally `isSuperadmin` to the user doc. `syncUserClaims` function fires automatically on the write — no extra work needed.
  - Status indicator ("Saving…" / "Saved" / error) inline next to the Save button.
  - Added `escHtml()` utility (same as roles.html) — all Firestore strings escaped before DOM insertion.
  - Existing Approve / Revoke / Make Editor / Make Superadmin / Remove Role buttons retained unchanged (still write `adminRole` for backward compatibility during migration window).
  - Removed the `DOMContentLoaded → loadUsers()` call; users now load after auth settles and roles are cached.

### Notes / decisions

- `isSuperadmin` is detected from `adminRole === 'superadmin'` on the user's own Firestore doc — consistent with the pattern in admin/roles.html. This is the correct approach during the Phase 6 migration window before rules switch to custom claims.
- Roles and current-user doc fetched in parallel (`Promise.all`) so page load is not serialised.
- `rolesCache` gracefully handles the pre-migration state (empty `/roles/` collection) — shows a "run migration" message instead of empty checkboxes.
- The "assigned" badge on the Permissions toggle bar gives a quick visual cue that a user has non-default permissions without needing to expand every card.
- No SW cache change — `admin/users.html` was already in the precache list.

---

## Session: Phase 6 PR 4 — admin/roles.html UI (Session 29)

**Date:** 2026-05-25
**Branch:** `phase6/admin-roles-ui`
**Status:** PR open

### What was done

- **`admin/roles.html`** — New page. Lists all `/roles/` docs (any admin). Superadmin-only: Add Role button, Edit button per card, Delete button (disabled for `isSystem: true` roles). Create/edit via modal with display name, description, and 14 permission checkboxes. `escHtml()` sanitises all Firestore strings into the DOM.
- **`admin-nav.html`** — Added "Roles" link to desktop dropdown and mobile menu.
- **`admin/index.html`** — Added Roles dashboard card (amber shield icon).
- **`service-worker.js`** — Cache bumped `v16 → v17`; `/admin/roles.html` added to precache list.
- **`CLAUDE.md`** — Added `admin/roles.html` to project structure and site map.

### Notes / decisions

- Auth pattern: `admin-auth.js` gates to any adminRole; the page JS reads the user doc to set `isSuperadmin` and conditionally renders write controls. Firestore rules are the real enforcement.
- Roles list sorted by `displayName` — consistent, predictable order.
- System roles (`isSystem: true`) show a "system" badge and have no Delete button — matches the Firestore rule that blocks deleting system roles.
- Modal closes on Escape key and backdrop click, consistent with other modals in the project.

---

## Session: Phase 6 PR 3 — migrateRolesV1 function (Session 28)

**Date:** 2026-05-25
**Branch:** `phase6/migration-function`
**Status:** PR open

### What was done

- **`functions/rolesData.js`** — New shared module exporting `ALL_PERMISSIONS` (14 keys) and `DEFAULT_ROLES` (7 roles). Previously these were inlined in `seedRoles.js`; extracted so both the seed script and the callable migration share one source of truth.
- **`functions/seedRoles.js`** — Updated to `require('./rolesData')` instead of duplicating the arrays.
- **`functions/index.js`** — Added `migrateRolesV1` callable. Superadmin-only. Step 1: seeds `/roles/` with 7 default roles if empty. Step 2: paginates all user docs (100 per batch via `orderBy(__name__).startAfter(cursor)`), sets `isSuperadmin`, `roles`, `extraPermissions` based on legacy `adminRole`, skips docs that already have all three fields. Each user write triggers `syncUserClaims` automatically. Returns `{ usersUpdated, rolesSeeded, errors }`.
- **`CLAUDE.md`** — Added `functions/rolesData.js` to project structure; added `migrateRolesV1` to Cloud Functions Architecture section.

### Notes / decisions

- Auth check uses Firestore `adminRole` (not custom claims) — at migration time, claims haven't been populated yet.
- Idempotency guard: skips users where `isSuperadmin`, `roles`, and `extraPermissions` are all already present. Safe to run twice without overwriting manually-set roles from the admin UI.
- `adminRole` field is NOT removed — stays as fallback until Phase 6 PR #8 cleanup.
- No new unit tests — the pure computation logic (`computeEffectiveClaims`, `permissionFieldsChanged`) is already tested in `tests/syncUserClaims.test.js`. The migration's user-mapping logic is straightforward imperative code.
- Run order: staging first → verify counts → production.

---

## Session: Phase 6 PR 2 — syncUserClaims function (Session 27)

**Date:** 2026-05-25
**Branch:** `phase6/sync-claims-function`
**Status:** PR open

### What was done

- **`functions/computePermissions.js`** — New pure module (no Firebase deps). Exports two functions: `computeEffectiveClaims(isSuperadmin, roleDocs, extraPermissions)` → custom claims object; `permissionFieldsChanged(before, after)` → boolean guard to skip unnecessary claim writes.
- **`functions/index.js`** — Added `syncUserClaims` Firestore trigger on `users/{uid}` writes. On delete: clears claims (best-effort). On create/update: checks if permission fields changed; if so, fetches role docs in parallel, computes claims via helper, writes to Firebase Auth custom claims.
- **`tests/syncUserClaims.test.js`** — 16 pure unit tests covering `computeEffectiveClaims` (superadmin override, role union, deduplication, extras, missing permissions array) and `permissionFieldsChanged` (creation, changed/unchanged fields). No emulator required. All 57 tests pass (41 rules + 16 unit).
- **`CLAUDE.md`** — Added `syncUserClaims` to Cloud Functions Architecture section.

### Notes / decisions

- Pure helper module pattern: keeps the trigger thin, makes the logic fully testable without mocking Firebase Admin.
- Claims format: `{ superadmin: true }` for superadmins (no perms array); `{ superadmin: false, perms: [...] }` for everyone else. `superadmin: false` is explicit so demoting a superadmin clears the claim.
- Trigger fires on every user doc write; idempotency guard skips unless `roles`, `extraPermissions`, or `isSuperadmin` changed. Non-permission updates (displayName, photoURL, etc.) are free.
- Custom claims budget: 14 keys × ~20 bytes ≈ 280 bytes — well within the 1000-byte limit.
- `isSuperadmin`, `roles`, `extraPermissions` fields don't exist on user docs yet — added in Phase 6 PR #3 (migration). Function defaults all three to empty/false, so it's safe to deploy before migration runs.

---

## Session: Phase 6 PR 1 — Roles collection (Session 26)

**Date:** 2026-05-25
**Branch:** `phase6/roles-collection`
**Status:** PR open

### What was done

- **`firestore.rules`** — Added `/roles/{roleId}` rules block: any signed-in user can read; only superadmin can create/update; superadmin can delete only if `isSystem != true`.
- **`tests/firestore.rules.test.js`** — Added `deleteDoc` to imports; added 7 new roles tests (unauth read denied, auth read allowed, member/editor create denied, superadmin create allowed, superadmin delete system role denied, superadmin delete non-system role allowed). All 41 tests pass.
- **`functions/seedRoles.js`** — New standalone Node script. Seeds 7 default roles (`administrator`, `pastor`, `deacon`, `media_helper`, `communications`, `prayer_lead`, `content_editor`) in a single batch. Aborts if the collection already has documents. Run with `GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node seedRoles.js` from within `functions/`.
- **`CLAUDE.md`** — Added `functions/seedRoles.js` to project structure; added `/roles/{roleId}` to Firestore Data Structure section; fixed Phase 6 & 7 in Current Phase list (from housekeeping PR that was pushed but not merged).

### Notes / decisions

- `isSuperAdmin()` in rules still reads the user doc (`adminRole == 'superadmin'`). This changes in Phase 6 PR #7 when rules switch to custom claims. The roles rules are forward-compatible.
- Seed script lives in `functions/` to reuse the already-installed `firebase-admin` package without needing a new folder.
- No SW cache changes — no new HTML pages.

---

## Session: Phase 6 & 7 planning docs (Session 25)

**Date:** 2026-05-25
**Branch:** `docs/phase-6-7-planning`
**Status:** Merged (PR #30)

### What was done

- **`docs/PERMISSIONS.md`** — Full design spec for Phase 6: granular per-area permission keys, 7 default roles, Firestore `/roles/` schema, `syncUserClaims` Cloud Function, security rules sketch, migration plan, and 8-PR sequencing plan.
- **`docs/HOMEPAGE.md`** — Full design spec for Phase 7: four-state adaptive home surface, live stream surfacing, notice board `kind` field, gated-content prompts, "Request member access" flow, FCM token registration scoped to members only. 7-PR sequencing plan.

### Notes / decisions

- Phase 6 must land before Phase 7 PR #5 (admin shortcuts strip).
- `adminRole` field kept during Phase 6 migration window; removed in cleanup PR #8.

---

## Session: Docs housekeeping — Phase 6 roadmap (Session 24b)

**Date:** 2026-05-25
**Branch:** `chore/update-docs-phase6`
**Status:** Pushed, not merged (superseded — housekeeping rolled into Session 26)

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
