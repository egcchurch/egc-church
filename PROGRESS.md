# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.
> Older sessions are in `PROGRESS-archive.md` — only read it if you need historical detail.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-28
**Current milestone:** Post-Phase 7 fix — DM push notification tap handling

---

## Session: fix/dm-notification-click — DM push notification tap (Session 44)

**Date:** 2026-05-28
**Branch:** `fix/dm-notification-click`
**Status:** PR open

### What was done

**`service-worker.js`** — added `notificationclick` event handler. When a user taps an FCM push notification on their phone, the handler closes the notification, reads `event.notification.data.linkUrl`, and navigates the app to that URL (re-using an existing open window on the same origin rather than opening a new tab). Falls back to `/` if no `linkUrl` is present. Cache bumped `v24 → v25` (service-worker.js is cache-first).

**`functions/index.js`** — `onNewMessage` FCM payload updated to include `data: { linkUrl: link }` where `link` is `/members/messages.html?conv=${convId}`. This passes the conversation ID through to the service worker so tapping the notification opens the exact conversation, not just the messages list.

### Notes / decisions

- The `notificationclick` handler uses `clients.matchAll` to re-use any already-open window on the origin rather than `clients.openWindow` unconditionally — avoids duplicate tabs.
- `link` already carried the conversation ID (`?conv=${convId}`) from the original PR 4 implementation; the `data` payload just makes it available to the SW handler.
- **Deploy reminder:** after this PR merges, manually run `firebase deploy --only functions` to deploy the updated `onNewMessage`.
- iOS requires PWA installed to home screen (Add to Home Screen in Safari) + iOS 16.4+ for web push to work at all. Android Chrome works without installation.

---

## Session: Phase 7 PR 7 — Request member access flow (Session 43)

**Date:** 2026-05-27
**Branch:** `phase7/request-access-flow`
**Status:** Merged (PR #53)

### What was done

**`functions/index.js`** — new callable function `requestMemberAccess`. Authenticated users with `membership === 'public'` can call it to write `membershipRequestedAt` (server timestamp) to their user doc. 24h idempotency: if `membershipRequestedAt` is already set within the last 24 hours, returns `{ success: true, alreadyRequested: true }` without re-notifying. Notifies all superadmins and users with `users.approve` in `extraPermissions` via in-app notification with `linkUrl: '/admin/users.html'`.

**`profile.html`** — new "Membership" card section inserted between the pending banner and the profile details card. Shows for `public` users (with or without a pending request) and for `member` users. Public users without a request see a "Request Member Access" button that calls the new callable function. Public users who already requested see the request date. Members see a green check with their join date.

**`admin/users.html`** — added "Pending Requests" third tab. `loadUsers()` uses `where('membershipRequestedAt', '!=', null).orderBy('membershipRequestedAt', 'desc')` for that tab. `renderUserCard()` shows Approve + Decline buttons when `currentTab === 'requests'`. New `approveRequest` (sets `membership: 'member'`, deletes `membershipRequestedAt`) and `declineRequest` (deletes `membershipRequestedAt` only) functions.

### Notes / decisions

- `declineRequest` clears `membershipRequestedAt` without changing membership, allowing the user to request again after 24h.
- The `!= null` query on `membershipRequestedAt` may need a single-field index if Firestore doesn't auto-create it — if a console index error appears after deploy, add it to `firestore.indexes.json`.
- **Deploy reminder:** after this PR merges, manually run `firebase deploy --only functions` to deploy both PR 6 functions (if not yet done) and `requestMemberAccess`.

---

## Session: Phase 7 — Fix preview channel cleanup (Session 42)

**Date:** 2026-05-27
**Branch:** `phase7/fix-preview-channel-cleanup`
**Status:** PR open

### What was done

**`.github/workflows/preview.yml`** — added a "Clean up stale PR preview channels" step before the deploy step. On each PR, it authenticates via `gcloud auth activate-service-account` using `FIREBASE_SERVICE_ACCOUNT`, fetches the list of all channels on `egc-staging777`, and deletes any `pr-*` channel that is NOT the current PR number. Uses Python to parse the JSON and issue DELETE requests via the Firebase Hosting REST API. Cleanup failure does not fail the workflow (`|| true` on auth commands, graceful Python exception handling).

### Notes / decisions

- Root cause of PR 6 failure: 50 stale `pr-*` channels accumulated (all within 7d TTL), hitting the per-site channel quota (~40 channels). Manually deleted pr-6 through pr-50 to unblock.
- The cleanup step runs before the deploy to guarantee a slot is free before `action-hosting-deploy` tries to create the channel.
- `|| true` on `gcloud auth` and `gcloud print-access-token` prevents workflow failure if the service account lacks the `cloudbuild.builds.list` role; the step just skips silently.

---

## Session: Phase 7 PR 6 — FCM members-only gate (Session 41)

**Date:** 2026-05-27
**Branch:** `phase7/fcm-members-only`
**Status:** PR open

### What was done

**`js/notifications.js`** — `onAuthStateChanged` callback made async; reads the user's Firestore doc before calling `registerFCMToken`. Token registration only proceeds if `membership === 'member'`. Pending and public users get the notification bell (harmless, shows empty) but never register an FCM token.

**`functions/index.js`** — two new Cloud Functions:
- `syncUserNotificationEligibility` — Firestore onWrite trigger on `users/{uid}`. Checks if `membership` changed FROM `'member'` TO anything else; if so, deletes all docs in `fcmTokens` subcollection. No-ops on new user creation and document deletion (handled by `deleteUserAccount`).
- `cleanupNonMemberTokens` — callable, superadmin only. One-time migration: iterates all users, deletes `fcmTokens` subcollection for any user where `membership !== 'member'`. Run on staging then prod after deploying.

**`CLAUDE.md`** — updated broadcast types table ("Public event notice" audience changed from "All users" to "All members") and FCM delivery caveat updated to reflect members-only token registration.

**`service-worker.js`** — cache version bumped `v23 → v24` (`notifications.js` is cache-first).

### Notes / decisions

- The notification bell (`setupBell`) is not gated — public/pending users see an empty bell, which is harmless. Gating the bell would require a separate membership check before calling `setupBell`, adding complexity for negligible benefit.
- `syncUserNotificationEligibility` shares the same trigger path as `syncUserClaims` — Firebase runs both independently, which is fine.
- Token promotion (pending/public → member) is handled naturally: at next sign-in after approval, `onAuthStateChanged` fires, the membership check passes, and `registerFCMToken` runs.
- **Deploy reminder:** after this PR merges, manually run `firebase deploy --only functions`, then call `cleanupNonMemberTokens` from a superadmin session (e.g. browser console on admin page using `firebase.functions().httpsCallable('cleanupNonMemberTokens')({})`).

---

## Session: Phase 7 PR 5 — admin shortcuts strip (Session 40)

**Date:** 2026-05-27
**Branch:** `phase7/admin-shortcuts-strip`
**Status:** PR open

### What was done

**`index.html`** — added `<script src="/js/permissions.js">` before `homepage.js` so `Permissions` global is available when the homepage renderer runs.

**`js/homepage.js`** — admin shortcuts strip for member+admin users:
- `loadAdminCounts()` — async function, runs only when `Permissions.init(user)` has resolved. Conditionally fires one Firestore query per relevant permission:
  - `users.approve`: count of `users` where `membership == 'pending'`
  - `connect.view`: count of `connect` where `read == false`
  - `prayer.moderate`: count of `prayer` where `submittedAt >= 7 days ago`
- `buildAdminShortcutsStrip(adminCounts)` — renders a light-blue band with count cards (amber icon for approvals, blue for connect, purple for prayer). Returns `''` if `adminCounts` is null or all keys are absent (i.e. user has no matching perms — regular members see nothing).
- `renderMember` — added 6th param `adminCounts`; strip inserted between quick links and notice board.
- Member branch in `onAuthStateChanged` — calls `Permissions.init(user)` before rendering, determines `hasAdminPerm`, fires `loadAdminCounts()` in parallel with other data loads via `Promise.all`.

**`service-worker.js`** — cache version bumped `v22 → v23` (`homepage.js` is cache-first).

### Notes / decisions

- `Permissions.init(user)` is guarded with `typeof Permissions !== 'undefined'` in case the script tag is ever missing — strip degrades to hidden rather than crashing.
- Prayer count uses a 7-day window (not an unread flag) since prayer docs have no `read` field.
- `connect.read == false` query works because the Firestore rule `allow read: if hasPermission('connect.view')` permits collection queries for users with that claim.
- Strip is positioned after quick links and before notice board — admins want to action tasks before reading notices.

---

## Session: Phase 7 PR 4 — gated prompts (Session 39)

**Date:** 2026-05-27
**Branch:** `phase7/gated-prompts`
**Status:** PR open

### What was done

**`js/member-auth.js`** — rewritten from silent-redirect to contextual access-denied card.
- `showAccessDenied(reason, user)` injects a fixed full-page overlay with a centred card. No redirect; page rendering is blocked by the overlay.
- Four reasons: `not-logged-in` (Sign In + Create Account buttons → `/login.html`), `verify-email` (Resend verification + Sign out), `pending` (Sign out only), `public` (Request member access → `/profile.html` + Sign out).
- Global handlers `window._memberAuthSignOut` and `window._memberAuthResend` wired to the card buttons.
- All inline styles — no dependency on Tailwind scanning dynamically injected HTML.

**`js/admin-auth.js`** — unauthenticated path still redirects to `/index.html`; authenticated-but-unauthorised paths now show access-denied card.
- `showAccessDenied(reason)` with two reasons: `no-permission` (user has zero admin claims → Home button) and `insufficient-permission` (user has some perms but not the required one → Admin Dashboard + Home buttons).
- Amber (#F59E0B) primary button, neutral secondary, consistent with member-auth card design.

**`service-worker.js`** — cache version bumped `v21 → v22` (both auth JS files are cache-first).

### Notes / decisions

- Admin pages redirect unauthenticated users without a card — admin page existence is not publicly hinted.
- "Request member access" on the public card links to `/profile.html` now; the actual request form lands in PR 7.
- Card uses inline styles rather than Tailwind classes to avoid relying on the Tailwind Play CDN scanning dynamically-injected nodes.
- `onAuthStateChanged` still fires on every sign-in/sign-out cycle — if a user signs in while the overlay is visible (unlikely but possible), the overlay stays. A page reload would pick up the new auth state. Acceptable for now.

---

## Session: Phase 7 PR 3 — adaptive home renderer (Session 38)

**Date:** 2026-05-27
**Branch:** `phase7/adaptive-home-render`
**Status:** PR open

### What was done

**`index.html`**
- Added `<div id="adaptive-section"></div>` between the service times section and the Explore cards. Populated by `js/homepage.js` once auth state resolves.

**`js/homepage.js`** — full rewrite into an auth-aware four-state renderer.
- `firebase.auth().onAuthStateChanged` drives the render. On each state change: (1) loads `/homepage/content`, (2) calls `applyContent()` (tagline, announcement banner, service times — identical for all states), (3) loads state-specific data, (4) renders the adaptive section.
- **Visitor** (not logged in): `loadAnnouncements(2)` → live stream teaser (if active, links to `/login.html`) + latest 2 announcement cards + "Register or Sign In" CTA.
- **Pending** (`membership: "pending"`): "Awaiting approval" card with clock icon; if `user.emailVerified == false`, amber prompt with "Resend verification email" button; sign-out button.
- **Public** (`membership: "public"`): personalised greeting + live teaser + 2 announcements + "Become a church member" card linking to `/profile.html`.
- **Member** (`membership: "member"`): personalised greeting + full live banner (LIVE NOW if active, "Next service" fallback from serviceTimes[0]) + quick links grid (Messages, Prayer, Directory, Groups) + Notice Board (top 5 announcements) + today's devotional snippet (if today's devotional exists) + upcoming events (next 2).
- `loadTodaysDevotional()`: fetches latest devotional by date desc, checks date components in local time — only shows if it is actually today's entry.
- `loadUpcomingEvents(2)`: uses existing `published + startDate` composite index.
- `loadAnnouncements(n)`: uses the `published + kind + publishedAt` composite index from PR 1.
- `window._resendVerification`: exposed globally for the pending state's inline onclick.
- Service worker bumped `v20 → v21` — `homepage.js` is cache-first so clients need a new cache name.

### Notes / decisions

- The hero, announcement banner, and service times sections remain static HTML and are populated for all auth states (no state divergence there). The adaptive section adds state-specific content below them.
- The `firebase.auth().onAuthStateChanged` listener re-fires on sign-in and sign-out, so the adaptive section automatically updates without a page reload.
- Events query uses the existing `events(published ASC, startDate ASC)` composite index — already deployed. No new index needed.
- Devotional query uses `orderBy('date', 'desc').limit(1)` + local-time date comparison rather than a range query — avoids timezone boundary issues with Firestore Timestamps.
- Messages quick link has no unread count badge in this PR — the conversation/message query structure makes this non-trivial for a one-shot home-page fetch. Can be added in a follow-up.

---

## Session: Phase 7 PR 2 — live stream toggle (Session 37)

**Date:** 2026-05-27
**Branch:** `phase7/live-stream-toggle`
**Status:** PR open

### What was done

**`admin/homepage.html`**
- Added "Live Stream" section between Service Times and Save Changes.
- UI: Stream Title input, YouTube Video ID input, pulsing "LIVE NOW" badge (hidden when inactive), "Set Live" button (red, shown when inactive), "End Stream" button (gray, shown when active).
- `renderLiveStatus(ls)` — called from `loadContent()` to reflect current Firestore state on page load. Toggles badge and buttons; populates title/youtubeId inputs.
- `setLive()` — validates title + youtubeId, writes `liveStream: { active: true, title, youtubeId, startedAt: serverTimestamp(), updatedAt, updatedBy }` via `set({ merge: true })`. Updates UI immediately on success.
- `endStream()` — confirm dialog, writes `liveStream: { active: false, startedAt: null, updatedAt, updatedBy }` via `set({ merge: true })`. Updates UI immediately.
- Live stream actions are independent of the main "Save Changes" button — time-sensitive, one-click operation.

### Notes / decisions

- No front-end display in this PR — the homepage banner that reads `liveStream.active` is wired in PR 3.
- `set({ merge: true })` on `liveStream` as a nested object writes the whole sub-object, which is correct — Firestore merges at the document level, not field level for nested maps.
- `firebase.auth().currentUser?.uid` used for `updatedBy` — reliable at click time since admin-auth.js has already confirmed auth before the page renders.
- No SW cache bump — `admin/homepage.html` uses network-first; no new files added.

---

## Session: Phase 7 PR 1 — blog kind field (Session 36)

**Date:** 2026-05-27
**Branch:** `phase7/blog-kind-field`
**Status:** PR open

### What was done

**Schema prep for Phase 7 notice board feed**
- Added `kind: "announcement" | "article"` field to `/blog/{postId}`. Existing posts without the field default to `"article"` at render time (no migration needed — `|| 'article'` fallback in all display code).
- Added composite index to `firestore.indexes.json`: `blog` collection, `published ASC + kind ASC + publishedAt DESC`. Required for the Phase 7 home surface query `.where('published', '==', true).where('kind', '==', 'announcement').orderBy('publishedAt', 'desc')`.

**`admin/blog.html`**
- Added "Type" radio selector at the top of the create/edit form: Announcement (appears on member home feed) / Article (appears on /blog only). Defaults to Article.
- `openForm()` pre-selects the correct radio when editing an existing post (`post.kind || 'article'`).
- `savePost()` includes `kind` in the Firestore write.
- Post list cards now show an Announcement (amber) or Article (blue) badge alongside the published/draft badge.

**`blog.html` + `js/blog.js`**
- Added filter chips row (All / Announcements / Articles) above the post grid.
- Active chip is navy-filled; inactive chips are outlined with hover state.
- `render()` filters `allPosts` by `(p.kind || 'article') === activeFilter` when a filter is selected.
- Announcement cards on the public blog page show an amber "Announcement" badge; articles show no badge.
- Service worker bumped `v19 → v20`.

### Notes / decisions

- No homepage changes in this PR — purely preparatory. The home surface queries `kind == "announcement"` in PR 3.
- Existing posts without a `kind` field are treated as `"article"` everywhere via `|| 'article'` fallback — no Firestore migration or backfill required.
- The composite index must be deployed (`firebase deploy --only firestore:indexes`) after this PR merges before the Phase 7 home surface PR can use the filtered query.

---

## Session: Post-launch fixes — indexes, storage, roles seed (Session 35)

**Date:** 2026-05-26
**Branches:** `fix/firestore-indexes`
**Status:** PR open

### What was done

**Bug: Messages page spinner stuck on mobile**
- Root cause: `conversations` query uses `.where('participants', 'array-contains', uid).orderBy('lastMessageAt', 'desc')` which requires a composite index. Index was missing from `firestore.indexes.json`. Desktop worked from local Firestore cache; mobile (no cache) failed silently — spinner never cleared.
- Fix: added composite index to `firestore.indexes.json` for `conversations` (participants + lastMessageAt).
- Also added `events` (published + startDate) and `sermons` (published + date) indexes which existed in Firebase but were missing from the file, and `users` (membership + directoryVisible) for the member picker in messaging.
- Deployed via `firebase deploy --only firestore:indexes`.

**Bug: Storage rules not deployed (gallery upload unauthorized)**
- Firebase Storage had never been initialised on the project. Enabled via Firebase Console (central-1, production mode).
- `firebase deploy --only storage` failed to update rules — Storage was brand new and the deploy didn't propagate. Fixed by pasting rules directly into Firebase Console → Storage → Rules.

**Bug: Admin roles page — delete button not working (stale state)**
- Resolved by refreshing the page. Timing issue with `isSuperadmin` flag not set on first render; not a code bug.

**Bug: Creating roles gave "missing or insufficient permissions"**
- Firestore rules had never been deployed after Phase 6 changes. Fixed by running `firebase deploy --only firestore:rules`.

**Superadmin setup**
- `migrateRolesV1` and `syncUserClaims` had never been deployed — `deploy.yml` only deploys Hosting.
- Ran `firebase deploy --only functions` to deploy all Cloud Functions.
- Manually added `isSuperadmin: true`, `roles: []`, `extraPermissions: []` to superadmin user doc in Firebase Console.
- Seeded default roles by deleting test role, then running `node seedRoles.js` with service account credentials from `functions/` directory.

### Notes / decisions

- `firebase deploy --only firestore:indexes` will prompt to delete indexes in Firebase not present in the file — always answer **No** unless intentionally removing an index.
- All Phase 6 backend resources (Functions, Firestore rules, Storage rules, indexes) required manual deployment. Only static Hosting auto-deploys via CI.

---

## Session: Phase 6 hotfix — Permissions.init guard + function deploy (Session 34)

**Date:** 2026-05-26
**Branch:** `fix/permissions-init-guard`
**Status:** Merged (PRs #40 and #41)

### What was done

**Bug: Member login button dead on all non-admin pages**
- Error: `Uncaught (in promise) TypeError: Permissions.init is not a function` at `main.js:112`
- Root cause: browsers expose a built-in global `window.Permissions` (Web Permissions API). On non-admin pages that don't load `js/permissions.js`, the `typeof Permissions !== 'undefined'` check passed against the browser's native object, then `Permissions.init(user)` threw synchronously inside the async `updateLoginButtons` — aborting the function before the login button's `onclick` was wired up.
- Fix (`js/main.js`): tightened guard to `typeof Permissions !== 'undefined' && typeof Permissions.init === 'function'`.
- Service worker bumped `v18 → v19` so existing cached clients pick up the fixed `main.js`.

**Bug: Admin dashboard cards loading then disappearing**
- Root cause: `syncUserClaims` Cloud Function had never been deployed — only `onUserCreate` was live. No custom claims were being written for any user, so the `admin-auth.js` guard (which checks claims) rejected everyone and redirected away.
- Fix: ran `firebase deploy --only functions` to deploy all functions including `syncUserClaims`.

**Superadmin account setup (manual)**
- The superadmin user doc (`fHupKxXg92WOlHSWAwm6kJ9bktM2`) was missing Phase 6 fields — `migrateRolesV1` had not run for it.
- Manually added `isSuperadmin: true`, `roles: []`, `extraPermissions: []` to the Firestore doc via Firebase Console.
- This triggered `syncUserClaims`, which wrote `{ superadmin: true }` as custom claims.
- Signed out and back in to get a fresh token — admin dashboard working.

### Notes / decisions

- The browser `Permissions` global conflict is a subtle gotcha — the guard pattern `typeof X !== 'undefined' && typeof X.method === 'function'` should be used any time a module name could clash with a browser API.
- Functions must be explicitly deployed (`firebase deploy --only functions`) — the `deploy.yml` workflow uses `action-hosting-deploy` which only covers Firebase Hosting (static site). Cloud Functions are never auto-deployed by CI; every functions change requires a manual deploy after merge.
- Phase 6 is now fully operational on production.

---

## Session: Phase 6 PR 8 — adminRole cleanup (Session 33)

**Date:** 2026-05-26
**Branch:** `phase6/remove-adminrole`
**Status:** Merged (PR #39)

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
