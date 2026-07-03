# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.
> Older sessions are in `PROGRESS-archive.md` — only read it if you need historical detail.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-07-03
**Current milestone:** Session 170 — footer/nav wording standardized to Notices/Reports (PR #286). Pending features: WhatsApp Stage 2 (blocked on number); Serving Teams Phase 1.7 (not started).

### To do — old-site comparison follow-ups (Session 168)

1. **Content fill-in via admin UI** — needs a **superadmin** login (agent's account lacked it):
   - `/admin/settings.html` → address: "Buffel St, Elandsfontein Rail, Germiston, 1429, South Africa";
     tagline: "We are a Bible believing, non-denominational church preaching Christ, building strong
     families, and raising a people prepared for His coming." (footer renders both automatically —
     code already supports it, fields are just empty). No public phone/email exists on the old site.
   - `/admin/homepage.html` → add service time "Sunday School — Sunday — 09:15 AM" (old site lists it).
   - `/admin/team.html` → leadership photos (all five about-page cards show placeholder avatars).
2. ~~**Branded 404 page + old-URL redirects**~~ — done (this session's first PR).
3. ~~**Homepage identity sections**~~ — done (this session's second PR).

Dropped by decision: Missions page + Youth Calendar (old /missions is itself broken — redirects to a
Google login) — not required.

---

## Session: fix — Standardize footer wording to Notices/Reports (Session 170)

**Date:** 2026-07-03
**PR:** #286
**Status:** Merged, deployed (hosting-only — no rules change)

### What was done

User caught a wording mismatch: the footer's Explore column labeled the `/events.html` and
`/blog.html` links "Events" and "Blog", while the nav bar (top of every page) labels the same two
links "NOTICES" and "REPORTS". Standardized the footer to match the nav bar's existing wording
(the user's explicit choice — an initial pass in the other direction, toward "Events"/"Blog"
site-wide, was corrected and reverted before committing anything).

`footer.html` only — two link labels changed, no href/behavior changes. Verified via a local
static server that the nav bar was untouched and the footer now reads "Notices"/"Reports".

### Deploy

Hosting-only — no rules/functions change, auto-deployed on merge.

---

## Session: feat — Homepage "Our Testimony" + sermon quote sections (Session 169)

**Date:** 2026-07-03
**PR:** #285
**Status:** Merged, deployed

### What was done

Ported the two identity sections from the old www.egc.church homepage that had no equivalent on the
new site (item 3 of the Session 168 to-do list):

- **"Our Testimony — God's Prophet for the Last Day"** — two-column section (text left, the same
  Branham portrait used on william-branham.html right), with the church's testimony text taken
  verbatim from the old homepage and an amber "Sermons of the Prophet" button linking to
  `/fulfillment-of-prophecy.html` (the sermon download library).
- **Sermon quote card** — parchment-style (`bg-amber-50`) rounded card with the 64-0122
  *"Looking Unto Jesus"* excerpt and citation, matching the old homepage's quote block.

Both are **fixed sections** (like "A Warm Welcome"), placed between the Join Us service times and
the composable `data-sections-container` — deliberately NOT added to the Phase 9 composable set,
since an existing `/config/pages/homepage` doc without the new section id could silently hide it.

No SW cache bump: only `index.html` changed (HTML is network-first, not cache-first), and the
portrait is an already-committed asset newly referenced (runtime-cached on first fetch). Every
Tailwind class used was verified present in the committed `assets/css/tailwind.css` (swapped
`mt-14`/`mt-16` for `mt-10`, which exists) so local dev renders identically to the CI-built CSS.

### Verification

Rendered via a local static server in a real browser: both sections lay out correctly on desktop;
the portrait, button, quote icon, and citation all render on-brand; section alternation
(navy → zinc-50 → white) preserved.

---

## Session: fix — Branded 404 page + redirects for old-site/extensionless URLs (Session 168)

**Date:** 2026-07-03
**PR:** #284
**Status:** Merged, deployed

### Context

Compared the live site against the original www.egc.church (real browser, not WebFetch — the old
site is JS-rendered and WebFetch has fabricated content for it before, see Session 125). Two site
defects found during the comparison, fixed here:

1. **`/fulfillment-of-prophecy` (and every extensionless URL) 404'd on production.** `firebase.json`
   has no `cleanUrls`, the old site's public URLs are extensionless, and CLAUDE.md's own site map
   documents extensionless paths — so old bookmarks/shared links died. Fixed with explicit `301`
   redirects (not `cleanUrls: true`, which would 301 every internal `.html` navigation and interact
   badly with the SW precache list): all 11 public pages plus old-site paths `/contact` →
   `/connect.html`, `/notice-board` → `/events.html`, `/live-stream` → `/members/live.html`.
   Added identically to both hosting targets.

2. **`404.html` was the stock Firebase CLI placeholder** ("This page was generated by the Firebase
   Command-Line Interface…") — unbranded, no way back into the site. Replaced with a branded navy
   page (logo, amber Go-to-Homepage + Contact buttons, quick links row) matching the design system.
   `404.html` is deliberately standalone — no Firebase SDK, no nav injection — so it renders even
   when everything else is broken. No SW cache bump needed: 404.html is excluded from the CI
   sw-cache-check and never precached, and HTML is network-first anyway.

### Note for the record

A suspected third bug (backslash hrefs `\index.html` in nav.html) turned out to be a display
artifact of the search tooling on Windows — the file on disk is clean. No change made.

---

## Session: fix — Cache bump and touch support for message edit/delete (Session 167)

**Date:** 2026-07-02
**PR:** #283
**Status:** Merged

### What was done

Two bugs from PR #282 (message edit/delete):

1. **Service worker cache not bumped** — `messaging.js` is a `.js` file cached by the service worker with a cache-first strategy. The v79 → v80 bump forces all devices to fetch the new file on their next visit. Previously, users who had visited the app before the PR merged were still served the old `messaging.js` from the service worker cache.

2. **Touch-only devices (phones/tablets)** — the edit/delete icons used `onmouseenter`/`onmouseleave` to reveal, which doesn't fire reliably on tap. Added `canHover` detection (`window.matchMedia('(hover: hover)').matches`) at IIFE initialisation. On touch-only devices, the icons are always visible (slightly larger tap target); on hover-capable devices (desktop), the existing reveal-on-hover behaviour is unchanged.

---

## Session: feat — Message edit and delete for group chat (Session 166)

**Date:** 2026-07-02
**PR:** #282
**Status:** Merged

### What was done

Added inline message editing and deletion to the group/team chat in `js/messaging.js`.

**Edit** — any sender can fix their own message. A pencil icon appears on hover beside the timestamp. Clicking it replaces the bubble with an inline textarea (amber border, amber Save button) pre-populated with the current body. Save updates Firestore (`body` + `editedAt` serverTimestamp); the onSnapshot re-renders the bubble with a "· edited" label. Cancel/Escape/Ctrl+Enter are all handled. The snapshot handler skips re-rendering while an edit is in-progress so new messages don't clobber the textarea.

**Delete** — sender can delete their own message; group leaders can delete any message (moderation). The trash icon turns red on first click ("click again to confirm") and reverts after 3 s if not confirmed. Second click deletes the Firestore doc; the onSnapshot removes it from the feed in real time.

**Firestore rules** — two new rules on `/conversations/{convId}/messages/{msgId}`:
- `allow update` — sender only, `affectedKeys()` must be `['body', 'editedAt']`
- `allow delete` — sender OR group leader (new `isGroupLeaderOfConversation(convId)` helper reads the conversation doc then the group's `leaders` array)

Six new rules tests added (sender edit, bad field edit blocked, non-sender edit blocked, sender delete, leader delete of other's message, non-leader blocked). 195 tests total, all passing.

**No Cloud Function changes** — no manual `firebase deploy --only functions` needed.

---

## Session: feat — Leaders-only group chat mode (Session 165)

**Date:** 2026-07-02
**PR:** #280
**Status:** Merged

### What was done

Added `chatMode: "open" | "leaders_only"` field to group docs. In `leaders_only` mode, group members can read the chat but not post — the compose box is replaced with a notice; only leaders see the send form.

Enforced at three layers:
- **`admin/groups.html`** — "Chat Mode" dropdown in the create/edit form; "Leaders-only chat" badge on the admin group card
- **`js/messaging.js`** — fetches the group doc when opening a group conversation; hides the compose box for non-leaders and shows "Only group leaders can post in this channel." Leaders see the form as normal
- **`firestore.rules`** — new `canPostToConversation(convId)` helper reads the conversation doc (participant check) and, for group chats, the group doc (`chatMode` + `leaders` check). Uses `||` short-circuit so the group doc is only fetched for group-type conversations. Firestore memoizes `get()` per request so the two group doc references cost at most one read

CI failure on first push: Firestore Rules do not support `if/else` inside functions — rewrote as a single boolean expression. Four new rules tests added (open chat, leaders-only deny, leaders-only allow, legacy group without chatMode defaults to open). 189 tests total, all passing.

---

## Session: fix — Private group visibility (Session 164)

**Date:** 2026-07-02
**PR:** #278
**Status:** Merged

### What was done

- **`members/groups.html`** — private groups (`isPublic: false`) were invisible to everyone on the members groups page, including the group's own leaders
- Replaced the single `where('isPublic', '==', true)` query with three parallel `onSnapshot` listeners: all public groups, any group where the current user is a leader, and any group where the current user is a member
- Results are merged and deduplicated client-side — public groups a leader also belongs to appear only once
- Loading spinner is hidden on the first callback to arrive; no regression to the loading UX
- No new Firestore indexes or rules changes needed — single-field `array-contains` queries use automatic indexes

---

## Session: feat — Notify members when added to a group (Session 163)

**Date:** 2026-07-02
**PR:** #277
**Status:** Merged, Cloud Functions deployed

### What was done

- **`functions/index.js`** — added `onGroupMemberAdded` Firestore trigger on `/groups/{groupId}` updates
- When new UIDs appear in the `members` array, each added member receives an in-app notification and FCM push via the existing `sendUserNotification` helper
- Two message variants: if the UID was in `pendingMembers` before the update → "Your request to join [group] has been approved"; if added directly by a leader → "You've been added to [group] by a group leader"
- Covers all three join policies: open join, approval-request approval, and invite-only direct add
- No client-side changes needed — hooks into existing write paths transparently

---

## Session: fix — Remove Member ID / UID display (Session 162)

**Date:** 2026-07-02
**PR:** #275
**Status:** Merged

### What was done

- **`profile.html`** — removed "Member ID" field (read-only UID input, copy button, helper text "Share this with a team leader if they ask you to join a serving team"), the `f-uid` value assignment in `loadProfile()`, and the `copyMemberUid()` function
- **`admin/users.html`** — removed the monospace UID span and "Copy UID" button from each user card, and the `copyUid()` utility function

The UID was exposed so members could share it with team leaders for manual lookup. All add-leader and add-member flows (groups, serving teams) now use name-based autocomplete search, making manual UID sharing redundant.

---

## Session: security — Scope Storage rules to per-feature permissions (Session 161)

**Date:** 2026-07-02
**PR:** #273
**Status:** Merged, deployed to production

### What was done

Full site security audit followed by targeted fix for the highest-priority finding.

**Security audit findings (summary):**
- **MEDIUM — Fixed (this PR):** Storage rules used a blanket `isAdminUser()` check (any non-empty `perms` array), granting upload access to all Storage paths regardless of which specific permission the user held (e.g. `prayer.moderate` could upload to gallery)
- **MEDIUM — Open:** Draft/unpublished content (`published: false`) is readable by unauthenticated users via the Firestore API — Firestore rules have `allow read: if true` on sermons, events, blog, music, team; the `published` flag is UI-enforced only
- **LOW — Open:** Full user document (including `isSuperadmin`, `roles`, `extraPermissions`) is readable by any member when `directoryVisible == true` — Firestore does not support field-level read restrictions
- **LOW — Open:** Member/youth gallery images are publicly accessible via Storage URL (audience gate is Firestore-only); Storage read is `if true`
- **LOW — Open:** Any member can create a `/conversations` doc with arbitrary participants (`allow create: if isMember()` with no participant validation)
- **FUTURE:** `javascript:` URI not stripped from notification `linkUrl` before `window.location.href` assignment — safe today (linkUrl only written by Cloud Functions) but worth hardening

**`storage.rules`:**
- Removed `isAdminUser()` (any non-empty perms array)
- Added `hasPermission(p)` helper matching the Firestore rules model (`superadmin` claim OR specific key in `perms` array)
- Each path now enforces the correct permission: `sermons.manage` (sermons + series + materials), `gallery.manage`, `music.manage`, `blog.manage`, `events.manage`, `team.manage`
- `/branding/` and `/site-media/` were already superadmin-only — unchanged

**`tests/storage.rules.test.js`:**
- Replaced single `permsAdmin()` helper with per-role helpers (`sermonsAdmin`, `galleryAdmin`, `musicAdmin`, `blogAdmin`, `eventsAdmin`, `teamAdmin`, `prayerAdmin`)
- Added cross-permission denial tests for every path
- 51 tests, all passing

### Deploy note
Required after merge (already done):
```
firebase deploy --only storage
```

---

## Session: fix — UI guard for own-account permissions panel (Session 160)

**Date:** 2026-07-02
**PR:** #268
**Status:** Merged

### What was done

- **`admin/users.html`** — added a UI guard so an admin cannot use the Permissions panel to modify their own roles or extra permissions. When the expandable panel is opened on the current user's own row, it shows a lock notice ("You cannot modify your own roles or permissions. Ask another administrator to make changes to your account.") instead of the editable checkboxes and Save button. The superadmin toggle was already guarded with `uid !== currentUid`; refactored to use the shared `isSelf` variable for consistency. Defence-in-depth complement to the Firestore rules fix in PR #266.

---

## Session: fix — Role self-assignment privilege escalation (Session 159)

**Date:** 2026-07-02
**PR:** #266
**Status:** Merged, deployed to production

### What was done

- **`firestore.rules`** — closed privilege escalation on `/users/{uid}` update:
  - `isOwner` branch restricted to safe self-service fields only (`displayName`, `photoURL`, `phone`, directory prefs, notification prefs). Previously unrestricted, allowing any user to write `roles`, `extraPermissions`, or `isSuperadmin` to their own doc.
  - `users.approve` branch now requires `!isOwner(uid)` — a user cannot approve themselves.
  - `users.assign_roles` branch now requires `!isOwner(uid)` — a user cannot assign roles to themselves even if they hold that permission.
  - Superadmin retains unrestricted update access.
- **`tests/firestore.rules.test.js`** — five new tests: `users.assign_roles` holder cannot self-assign; `users.approve` holder cannot self-approve; member cannot escalate own roles or membership; member can still update safe profile fields.

### Deploy note
Required after merge (already done):
```
firebase deploy --only firestore:rules
```

---

## Session: feat — Prayer request approval workflow + notification opt-out (Session 158)

**Date:** 2026-07-02
**PR:** #264
**Status:** Merged, deployed to production

### What was done

- **`members/prayer.html`** — new requests include `approved: false` on create; submit success message updated to say "awaiting moderator review". Page now uses two Firestore queries (approved public requests + own requests) merged client-side. "My Requests" tab shows all own requests including pending ones with an amber "Pending approval" badge. Community tabs (All / Active / Answered) show only approved public requests. "Praying" button hidden on pending requests.
- **`admin/prayer.html`** — page opens on a new **Pending** tab. Header badge shows the count of pending requests. Each pending card has **Approve** (one click) and **Edit & Approve** (inline text editor) actions. Trash icon relabelled "Reject / Delete". Approved requests retain the existing Active / Answered workflow.
- **`profile.html`** — new "Prayer request notifications" checkbox in the Notifications section (default on). Loads `prayerNotifications` from the user doc; saves it alongside `notifyWhatsApp`.
- **`functions/index.js`**:
  - `onUserCreate` — now sets `prayerNotifications: true` on new user docs.
  - `onNewPrayerRequest` — changed to notify moderators/superadmins only (not members) so they know a request needs review.
  - `onPrayerRequestApproved` (new update trigger) — fires when `approved` flips `false → true` on a public request; fans out in-app notifications to all members, skipping the author and anyone with `prayerNotifications === false`.
- **`firestore.rules`** — prayer read rule: members can read `approved == true && isPrivate == false` OR their own requests. Create enforces `approved == false`. `prayedFor` toggle now only allowed on approved requests.
- **`firestore.indexes.json`** — two new composite indexes: `prayer(approved, isPrivate, submittedAt)` and `prayer(uid, submittedAt)`.
- **`tests/firestore.rules.test.js`** — updated all prayer tests to include `approved` field; added tests for unapproved read denial, own-unapproved read permission, prayedFor toggle denied on unapproved, and member cannot self-approve.
- **`service-worker.js`** — bumped cache to v79.

### Deploy note
Required after merge (already done):
```
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## Session: fix — Calendar legend dots invisible on mobile (Session 157c)

**Date:** 2026-07-02
**PR:** #262
**Status:** Merged, deployed to production

### What was done

- **`events.html`** — replaced Tailwind colour classes (`bg-blue-400`, `bg-green-400`, `bg-amber-400`, `bg-gray-400`) on the legend dot spans with inline styles using the same hex values as the JS dot indicators. Those classes were absent from the committed Tailwind CSS (not used elsewhere in the project) so the dots were invisible on mobile.

---

## Session: fix — Calendar grid collapses to list on mobile (Session 157b)

**Date:** 2026-07-02
**PR:** #260
**Status:** Merged, deployed to production

### What was done

- **`events.html`** — replaced `class="grid grid-cols-7"` with `style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))"` on the day-header row and `#cal-grid` container; replaced `class="grid grid-cols-1 sm:grid-cols-2 gap-4"` on `#day-events` with inline `auto-fill` grid. `grid-cols-7` was never used in the project before PR #259 so it was absent from the committed Tailwind CSS — mobile devices saw a vertical list instead of a calendar.

---

## Session: feat — Notices page as monthly calendar (Session 157)

**Date:** 2026-07-01
**PR:** #259
**Status:** Merged, deployed to production

### What was done

- **`events.html`** — rebuilt as a monthly calendar view. Header, category filter, and footer unchanged. Calendar features:
  - Month navigation (prev/next arrows + "Today" pill that appears when not on the current month)
  - 7-column grid (Sun–Sat headers, day cells with day number + coloured dots for events)
  - Today highlighted with amber circle; selected date with navy circle + light blue cell bg
  - Colour-coded dots by category (blue = Service, green = Group, amber = Special, grey = Other); up to 3 dots then "+N" overflow
  - Tapping a date with events opens a detail panel below the calendar showing event cards with image, title, date/time, location, description, and RSVP button
  - Legend below the grid explaining dot colours
  - Empty state for months with no events
  - Category filter updates dot display in real time
- **`js/events.js`** — complete rewrite. Removed hero card, Today/This Week/Coming Up sections. Added `currentMonth`, `selectedDate`, `renderCalendar()`, `selectDay()`, `renderDayPanel()`, `buildDayCard()`, `prevMonth()`, `nextMonth()`, `goToToday()`, `eventOnDate()`, `eventOverlapsMonth()`, `isoDate()`. Multi-day events show dots on every day they span. All published events loaded (past + future) so past months are browsable.
- **`service-worker.js`** — bumped cache to v78.

---

## Session: fix — Notification delete rule (Session 156c)

**Date:** 2026-07-01
**PR:** #257
**Status:** Merged, deployed to production

### What was done

- **`firestore.rules`** — added `allow delete: if isOwner(uid)` to `/users/{uid}/notifications/{notifId}`. The missing rule was silently rejecting client-side deletes, causing the `onSnapshot` listener to immediately restore cleared notifications.

### Deploy note
Required `firebase deploy --only firestore:rules` after merge.

---

## Session: fix — Clear all notifications deletes full collection (Session 156b)

**Date:** 2026-07-01
**PR:** #255
**Status:** Merged, deployed to production

### What was done

- **`js/notifications.js`** — `clearAllNotifications` now does a one-shot `get()` on the full `/users/{uid}/notifications` collection and batch-deletes in chunks of 450. Previously only deleted the 20 docs loaded by the `onSnapshot` limit, causing the next 20 to reload immediately after clearing. Button shows "Clearing…" and disables during the operation.
- **`service-worker.js`** — bumped cache to v77.

---

## Session: feat — Notification auto-prune + "Clear all" button (Session 156)

**Date:** 2026-07-01
**PR:** #254
**Status:** Merged, deployed to production

### What was done

- **`functions/index.js`** — added `pruneOldNotifications` scheduled function (nightly, 02:00 SAST). Queries `collectionGroup('notifications')` for docs older than 30 days and batch-deletes them across all users.
- **`nav.html`** — added "Clear all" button (`#notif-clear-btn`) to the notification panel header; hidden until the panel has at least one notification.
- **`js/notifications.js`** — wired up "Clear all" button: binds click handler in `setupBell()`, shows/hides button in `renderPanel()`, added `clearAllNotifications()` which deletes all current notification docs for the user.
- **`firestore.indexes.json`** — added a fieldOverride enabling `COLLECTION_GROUP` scope for `sentAt` on the `notifications` collection group (required for the scheduled prune query).
- **`service-worker.js`** — bumped cache to v76.

### Deploy note
Cloud Functions and Firestore indexes changed — after this PR merges, run:
```
firebase deploy --only functions
firebase deploy --only firestore:indexes
```

---

## Session: feat — Group/team-only messaging redesign (Session 155)

**Date:** 2026-07-01
**PR:** #251
**Status:** Merged, deployed to production

### What was done

- **`functions/index.js`** — two changes:
  - **`onNewMessage`** — updated to fan out FCM push + in-app notification to **all** participants except the sender (was: single recipient only). Title now includes `groupName` for group/team conversations (e.g. "Edwin in Youth Team"). Tokens collected from all recipients via `Promise.all`; invalid tokens cleaned up as before.
  - **`purgeDirectMessages`** (new callable, superadmin only) — deletes all `/conversations` docs where `type` is not `'group'` or `'team'` using `db.recursiveDelete()`. Trigger once after deploying: `firebase.functions().httpsCallable('purgeDirectMessages')()` from a superadmin browser session.
- **`members/messages.html`** — removed "New Message" DM button and its modal entirely; subtitle changed from "Direct messages between members" to "Group and team conversations"; empty state updated to "Select a conversation from the list".
- **`js/messaging.js`** — removed `bindNewConv()` and `startConversation()` (DM creation); updated empty-state message to "Join a group or serving team to start chatting"; updated `type` check to cover both `'group'` and `'team'` for avatar icons and sender-label display.
- **`members/serving-teams.html`** — added `startTeamChat(teamId, teamName)` function; added "Team Chat" button alongside "Leave Team" in `renderActionButton` for all team members and leaders.
- **`service-worker.js`** — bumped cache to v75.
- **`CLAUDE.md`** — updated messaging architecture section, `onNewMessage` description, Broadcast Types table, and Architecture/Design Decisions note.

### Deploy note
Cloud Functions changed — after this PR merges, run:
```
firebase deploy --only functions
```
Then purge old DMs (once, from a superadmin browser session):
```javascript
firebase.functions().httpsCallable('purgeDirectMessages')()
```

---

## Session: feat — Group member management + group chat access (Session 154)

**Date:** 2026-07-01
**PR:** #248
**Status:** Merged, deployed to production

### What was done

- **`members/groups.html`** — two improvements:
  - **Add Member (leader only):** "Add Member" button added next to "Group Chat" in the leader section. Opens a modal with live member search (2+ chars); excludes existing members, leaders, and pending members from results; clicking a name adds the member directly via `arrayUnion` (bypasses join policy — leader override); error shown inline in the modal.
  - **Group Chat (all members):** Group Chat button was previously only visible to leaders via `renderLeaderSection`. Regular joined members now see a "Group Chat" button in their card action area. Both paths call the same `startGroupChat()`, which re-uses an existing group conversation rather than creating a duplicate.
  - Added `allGroups` variable to track the live snapshot data so the add-member modal can exclude current group members from search results.
- **`service-worker.js`** — bumped cache to v74.

### Also in this session (PR #247 — merged prior)

- **`admin/groups.html`** — replaced "Leader UIDs (comma separated)" text input with the same chip-based member name autocomplete used in `admin/serving-teams.html`. Existing leaders resolved to display names on edit.

---

## Session: refactor — Rename events to Notices, blog to Reports (Session 153)

**Date:** 2026-07-01
**PR:** #245
**Status:** Merged, deployed to production

### What was done

- **`events.html`** — page title and H1 changed from "What's On" to "Notices"; subtitle updated to "Current and upcoming events for the congregation".
- **`blog.html`** — page title and H1 changed from "Notice Board" to "Reports"; subtitle updated to "Stories and reports from church life".
- **`nav.html`** — desktop and mobile nav links updated: WHAT'S ON → NOTICES, BLOG → REPORTS.
- **`admin-nav.html`** — admin nav link updated: BLOG → REPORTS.
- **`post.html`**, **`story.html`** — all "Back to Notice Board" back-links updated to "Back to Reports".
- **`js/homepage.js`** — homepage announcement feed section heading updated from "Notice Board" to "Reports".
- **`service-worker.js`** — bumped cache to v73 (nav.html, blog.html, events.html, post.html, story.html, js/homepage.js all modified).

---

## Session: feat — Events page redesigned as "What's On" notice board (Session 152)

**Date:** 2026-07-01
**PR:** #243
**Status:** Merged, deployed to production

### What was done

- **`events.html`** — complete page restructure: removed Upcoming/Past split; added hero card slot (next upcoming event) above the category filter; replaced content area with Today / This Week / Coming Up sections plus an empty state.
- **`js/events.js`** — full rewrite of render logic: upcoming events only (past hidden); first/soonest event rendered as a large hero card with "Next Up" badge; remaining events split into Today (today's date), This Week (next 7 days), and Coming Up (beyond); RSVP system preserved and works for both hero and grid cards; `toggleRsvp` now calls `render()` instead of surgically replacing a single card so hero+grid stay in sync.
- **`nav.html`** — renamed "EVENTS" to "WHAT'S ON" in both desktop and mobile nav (avoids naming conflict with blog's existing "Notice Board" page title). Name subject to change — see Session 153.
- **`service-worker.js`** — bumped cache to v72 (events.html, js/events.js, nav.html all modified).

---

## Session: fix — Events and blog UX improvements (Session 151)

**Date:** 2026-07-01
**PR:** #241
**Status:** Merged, deployed to production

### What was done

- **`js/events.js`** — show start time on public event cards (inline with date, `•` separator; midnight times suppressed); filter members-only events (`audience: "members"`) from the public `/events` page for non-members.
- **`admin/events.html`** — replaced the raw image URL field with a file upload + preview (same pattern as blog story cover). Adds Firebase Storage SDK and `storage-upload.js`; compresses image to 1920px/85% before upload to `events/{id}/cover`.
- **`js/blog.js`** — article and announcement cards now link to a new `/post.html?id=` detail page (whole card is an `<a>`, hover shadow + title colour change, "Read more" link); body preview trimmed from 4-line to 3-line clamp.
- **`post.html`** — new detail page for articles and announcements. Fetches the Firestore doc, renders plain-text body as paragraphs, shows cover image if present, displays kind badge (Announcement / Article), date, author. Stories (`kind === "story"`) are explicitly rejected and redirect to `/blog.html`.
- **`service-worker.js`** — added `/post.html` to PRECACHE_URLS; bumped cache to v71.
- **`CLAUDE.md`** — corrected `/blog` schema note: `kind` is `"announcement" | "article" | "story"` (was missing `"story"`).

---

## Session: perf — Auth flash fix + Tailwind pre-built CSS + preconnect hints (Session 150)

**Date:** 2026-07-01
**PR:** #236
**Status:** Merged, deployed to production

### What was done

- **Auth flash fix (`js/member-auth.js`, `js/admin-auth.js`)** — both auth guard scripts now inject `<style>body{visibility:hidden}</style>` into `document.head` synchronously (before `<body>` renders), preventing any flash of protected content. The style is removed on the access-granted path or just before the access-denied overlay is shown.
- **Tailwind CDN → pre-built CSS** — replaced `@tailwindcss/browser@4` CDN script with a locally-built static CSS file (`assets/css/tailwind.css`). Input file: `assets/css/tailwind-input.css` (`@import "tailwindcss"`). Both `deploy.yml` and `preview.yml` now run `npm install && npx @tailwindcss/cli -i ... -o ... --minify` before the Firebase deploy. CSS committed to repo for local dev. File size: ~60KB (vs ~400KB CDN runtime build). Updated 43 HTML files.
- **Preconnect hints** — added `<link rel="preconnect" href="https://www.gstatic.com" crossorigin>` and `<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>` to all 43 HTML files, establishing early connections to Firebase SDK and Font Awesome CDN origins.
- **`service-worker.js`** — added `/assets/css/tailwind.css` to PRECACHE_URLS, removed `cdn.jsdelivr.net` from CDN_ORIGINS (no longer used), bumped cache to v67.
- **`package.json`** — added `@tailwindcss/cli` and `tailwindcss` as devDependencies.
- **`CLAUDE.md`** — updated Tech Stack and Design System Tailwind entries to reflect pre-built approach.

---

## Session: feat — Serving slot morning-of notifications (Session 149)

**Date:** 2026-06-30
**PR:** #234
**Status:** Merged, deployed to production (Cloud Functions deployed manually after merge)

### What was done

- **`functions/index.js`** — added two new Cloud Functions:
  - `sendServingSlotReminders` (scheduled, 07:00 SAST daily) — queries `collectionGroup('slots')` for today's date; sends each assigned member and trainee a FCM push + in-app notification linking to their specific slot (`?team=X&slot=Y` deep link); sends each team's leaders one aggregated notification per team for any unassigned slots (avoids per-slot spam).
  - `onServingSlotReleased` (Firestore trigger on `/servingTeams/{teamId}/slots/{slotId}` updates) — fires when `assignedUid` changes from set to null; notifies all team leaders with a FCM push + in-app: "[Name] can't make it for [function] on [date] — slot is now open." Deep link goes to the specific slot.
- **`firestore.indexes.json`** — added a `COLLECTION_GROUP` index on `slots/date` (PR #234), then removed it in PR #235 — the Firebase CLI rejected it with "this index is not necessary"; Firestore handles single-field collection group queries automatically.
- **`members/serving-teams.html`** — added `data-slot-id` attribute to each slot row; added `highlightSlotFromUrl()` which reads `?slot=` from the URL, finds the slot element, scrolls to it, and applies a 6-second amber highlight; called at the end of `renderRosterSection` for teams matching the URL's `?team=` param.
- **`CLAUDE.md`** — updated function count (18 → 21), documented both new functions in the Cloud Functions Architecture section.

### Deploy note

After merging, run: `firebase deploy --only functions`
No Firestore index changes needed — single-field collection group queries are handled automatically.

---

## Session: feat+fix — Serving Teams schedule cadence + member functions fix (Sessions 146–148)

**Date:** 2026-06-30
**PRs:** #228 (week-of-month), #229 (CLAUDE.md no-attribution), #230 (closed — superseded), #231 (interval-based repeat), #232 (member functions from slots)
**Status:** Merged, deployed to production

### What was done

- **`members/serving-teams.html`** (PR #228, superseded by #231) — added week-of-month checkboxes (1st–5th) to schedule pattern rows. Replaced by PR #231 after the calendar-month approach was found to drift.
- **`CLAUDE.md`** (PR #229) — added rule: no Claude/AI attribution in commit messages or PR bodies.
- **`members/serving-teams.html`** (PR #231) — replaced week-of-month checkboxes with a "Repeat every N week(s)" number input per pattern row. Generator now steps by exactly N × 7 days from the first matching date — no calendar drift. Existing weekly schedules (no `repeatEveryWeeks` field) default to 1, backward compatible.
- **`members/serving-teams.html`** (PR #232) — fixed member functions modal showing stale functions from deleted schedules. `team.functions` is additive-only and retains entries from deleted schedules/slots. Modal now derives the function list from `teamSlotsCache` (active slots in memory) instead, so only currently-used functions appear.

---

## Session: feat+fix — Serving Teams UX polish (Sessions 143–145)

**Date:** 2026-06-30
**PRs:** #223 (member name search), #225 (add-member DOM crash fix), #226 (admin leader name search)
**Status:** Merged, deployed to production

### What was done

- **`members/serving-teams.html`** (PR #223) — replaced the "Member UID" text input with a type-ahead name search for the leader "Add Member" flow. Leader types ≥ 2 characters → dropdown of matching directory-visible members → click to select → click Add. Uses `membership + directoryVisible` composite index; roster cached in-session.
- **`members/serving-teams.html`** (PR #225) — fixed crash `TypeError: can't access property "value", document.getElementById(...) is null` after a successful member add. Root cause: `loadTeams()` uses `onSnapshot`; the Firestore update triggers the listener which rebuilds the card DOM before the `await` resolves, destroying the input element. Fix: removed the redundant post-add `getElementById(...).value = ''` line — the card rebuild already gives a blank input.
- **`admin/serving-teams.html`** (PR #226) — replaced the "Leader UIDs (comma separated)" text field with a name search + chip UI. Type ≥ 2 characters → dropdown → select → navy chip with × remove button. Multiple leaders supported; existing leaders resolve to names when the edit form opens. Same Firestore query pattern as the members page.

---

## Session: feat — Serving Teams member name search (Session 142)

**Date:** 2026-06-29
**PR:** #223
**Status:** Merged, deployed to production

### What was done

- **`members/serving-teams.html`** — replaced the "Member UID" text input with a type-ahead name search. Leader types ≥ 2 characters → dropdown of matching directory-visible members → click to select → click Add. No UID sharing needed. Uses the existing `membership + directoryVisible` composite index (same query as `/members/directory.html`); results cached in-session, cache invalidated after a successful add. Also fixed a pre-existing bug where the member list didn't refresh after an add (now calls `reloadTeamCard`).

---

## Session: fix — remove redundant Connect CTA from homepage (Session 141)

**Date:** 2026-06-29
**PR:** #221
**Status:** Merged, deployed to production

### What was done

- **`index.html`** — removed the "Plan your first visit / Get in touch" CTA section (`data-section="connectCta"`). Redundant with the "A Warm Welcome" section's "Contact Us" button above it, and Connect is also reachable from the Explore grid, the nav, and the footer.
- **`admin/pages.html`** — removed the `connectCta` entry from the Page Layout section list so it no longer appears as a toggleable option for a section that no longer exists.

---

## Session: docs — environment file cleanup (Session 140)

**Date:** 2026-06-29
**PR:** #219
**Status:** Merged, deployed to production

### What was done

- **`PROGRESS.md`** — archived Sessions 22–119 to `PROGRESS-archive.md` (3,612 → 769 lines); fixed four stale "Committed locally, PR pending" statuses on Sessions 133–136
- **`PROGRESS-archive.md`** — updated header to reflect Sessions 1–119; Sessions 22–119 prepended in newest-first order before the existing Sessions 1–21 content
- **`CLAUDE.md`** — added `branham-sermons.js` to project structure (static sermon grid for `fulfillment-of-prophecy.html`); replaced 9-bullet phase checklist in Current Phase with 4-line active-work summary (all phases done; WhatsApp Stage 2 and Serving Teams 1.7/2 called out as pending); condensed two long narrative Architecture/Design Decisions bullets (no-cache header story, storage.rules split story) to single-line rules; removed stale Phase 1/4/5/6/7 labels from Cloud Functions section headers
- **`docs/PERMISSIONS.md`, `docs/HOMEPAGE.md`, `docs/PHASE8.md`, `docs/PHASE9.md`** — added "Complete and deployed — reference only" banner to each
- **`docs/ROADMAP.md`** — updated byline to state all items complete; pointed to CLAUDE.md Current Phase for active pending work

---

## Session: fix — CI/CD deploy pipeline hardening (Sessions 137–139)

**Date:** 2026-06-27
**PRs:** #214 (CI preview fix), #215 (LIVE nav), #216 (deploy.yml CLI fix), #217 (noop 400 handling)
**Status:** Deployed to production

### Context
After Session 136 merged, the preview CI workflow started consistently failing with `exit code 1` on the `FirebaseExtended/action-hosting-deploy@v0` step. Separately, the user asked for the live stream link to be more prominent — currently buried as a card on the members dashboard. Also fixed the production deploy workflow which had the same underlying issue.

### What was done

**CI workflow fixes (PRs #214, #216, #217):**
- **`preview.yml`** — replaced `action-hosting-deploy@v0` with direct `npx firebase-tools@latest hosting:channel:deploy` CLI. The action internally calls `cloudfunctions.functions.list`, which the service account lacks permission for, causing the job to exit 1 even though hosting files uploaded successfully. The direct CLI is hosting-only and never triggers that API call. Also resolves the Node 20 deprecation warning.
- **`deploy.yml`** — same fix: replaced the action with `npx firebase-tools@latest deploy --only hosting:production`. Additionally, added output parsing so Firebase's `HTTP 400: current active version` response (which fires on workflow-only PRs where no static files changed) is treated as a success exit (production is already up to date) rather than a failure. Real upload errors still cause exit 1.

**LIVE nav link (PR #215):**
- **`nav.html`** — added `● LIVE` pill button (desktop, `hidden lg:flex`) and `LIVE STREAM` entry with dot (mobile menu). Both use `href="#"` so click is intercepted by `js/main.js`.
- **`members-nav.html`** — added LIVE pill (desktop, direct `href="/members/live.html"`, no interception needed) and updated mobile entry with the same dot indicator.
- **`js/main.js`** — added `initLiveNavLink()`: reads `homepage/content.liveStream.active` and pulses the dot red when a stream is live; wires click handlers on public nav links that check `window._egcUserIsMember` and either navigate to `/members/live.html` (members) or show a members-only overlay (non-members). `showLiveMembersOnlyMessage()` renders a navy card with amber icon, a "Log In" CTA, auto-dismisses after 6 s, and has a Dismiss button. Also set `window._egcUserIsMember` in `updateLoginButtons()` so the click handler always has an up-to-date value regardless of auth state timing.
- **`service-worker.js`** — bumped cache version (js/main.js changed).

### Notes
- Production confirmed serving correct content: Firebase's "current active version" 400 on the workflow-only PRs proved the PR #215 files were already released before the action's functions.list step failed
- `deploy.yml` no longer uses any GitHub Action for the actual deploy — both preview and production now use direct firebase-tools CLI, which removes the dependency on `action-hosting-deploy` entirely

---

## Session: fix — Mobile nav: white top bar on menu open + unreadable signed-in links (Session 136)

**Date:** 2026-06-25
**Status:** Merged, deployed to production

### Context
User shared a phone screenshot: opening the hamburger menu on any page turns the top bar (where the logo sits) white instead of navy/transparent, making the white logo nearly invisible. Same screenshot also showed "My Profile"/"Members Area"/"Admin Dashboard" in barely-legible dark text against the navy menu background.

### Investigation
Reproduced live on `app.egc.church` (Playwright, mobile viewport) before touching anything. Confirmed via computed styles: at the point of the bug, `<nav>` correctly had `bg-transparent` (the homepage hero-overlay state working as designed) — so the white wasn't a colour-class bug. The actual cause: `#mobile-menu` was a normal-flow child of `<nav>`. Opening it made `<nav>`'s own height balloon from ~64px to ~600px+ (top bar + full expanded menu). The hero banner's `-mt-16` negative margin is a *fixed* offset, calibrated only to cancel the *collapsed* nav height — with the menu open, that fixed offset under-compensates by (expanded height − 64px), leaving a gap between `#nav-placeholder`'s now-much-taller reserved flow space and where the hero actually starts rendering. Nothing else occupies that gap, so the plain `<body class="bg-zinc-50">` background shows through it — confirmed by screenshotting the reproduction: the hero video was visible peeking out far lower on the page than normal, exactly the size of the gap.

The second issue was simpler: `js/main.js`'s `buildMobileHTML()` (builds the "Signed in as…" section injected into the mobile menu) was never updated when the mobile menu's background changed from white to navy in an earlier session — still used `text-gray-700`/`text-gray-400`/`border-gray-100`, the old light-background palette, with the contrast only "fixed" by a `hover:text-amber-600` that has no effect on touch devices.

### What was done
- **`nav.html`** — `#mobile-menu` changed from a normal block child to `absolute top-full left-0 right-0` (plus `max-h-[calc(100vh-4rem)] overflow-y-auto shadow-lg`), so opening it can never change `<nav>`'s own flow height again — the hero offset math stays valid regardless of menu state. As a side benefit, the menu now overlays the page (standard mobile-nav pattern) instead of pushing it down.
- **`js/main.js`** — `buildMobileHTML()` recoloured to the navy palette already used everywhere else in the mobile menu: `text-white/90` links, `text-white/50` icons and the "Signed in as" label, `border-white/10` divider, `hover:text-amber-400`.

### Verification
Reproduced the bug live on production first (confirmed `bg-transparent` + the height-mismatch theory), then verified the fix locally: homepage mobile menu now shows the dark hero video correctly through the transparent top bar (logo clearly visible) instead of white, and `nav.offsetHeight` stays at the collapsed ~65px with the menu open (confirmed via `getComputedStyle`). Verified the signed-in links by calling `buildMobileHTML()` directly with test data on a local page (no real auth available) — "My Profile", "Members Area", "Admin Dashboard" all render clearly legible in white against navy, matching the rest of the menu.

---

## Session: fix — Second bug behind the same gallery report: date Timestamp vs. localeCompare crash (Session 135)

**Date:** 2026-06-25
**Status:** Merged, deployed to production

### Context
After Session 134's index fix deployed, user reported the galleries still weren't showing. Ruled out several things together with the user before finding the real cause: confirmed `published: true` on both galleries directly in the Firestore console, confirmed the `audience` field value was exactly `"members"` (and separately confirmed this is correctly a *different* field/value from the user's own `membership: "member"` — two intentionally different but similarly-named fields, not a bug). A planned diagnostic using the Firebase Admin SDK to read the live `gallery` collection (bypassing security rules, to rule out a data/rules issue directly) was blocked by a safety check requiring explicit authorization for unattended production reads — correctly so, since it wasn't yet confirmed with the user. Asked the user to check the browser console directly instead, which gave the real answer immediately:
```
Gallery load failed: TypeError: (intermediate value).localeCompare is not a function
```

### Investigation
This is a *second*, previously-hidden bug, independent of the Session 134 index issue. `members/gallery.html`'s `loadGalleries()` sorted results with `(b.date || '').localeCompare(a.date || '')` — but `admin/gallery.html` saves `date` via `buildTimestamp()` as a Firestore `Timestamp` object, never a string. `Timestamp || ''` evaluates to the Timestamp itself (truthy), which has no `.localeCompare()` method, so the sort throws and the existing `.catch()` swallows it before `renderGalleries()` ever runs — meaning the page has been silently broken for *any* members/youth gallery with a date, not just these two. (Before the index fix, the query itself failed first with a different error, which is why this second bug was never reached/visible until now.) The public `/gallery.html` page already had the correct fix for this exact problem — a `toDate()` helper that calls `.toDate()` on a Timestamp or falls back to `new Date(value)` for a plain string — `members/gallery.html` just never got the same treatment. Also found a second, non-crashing instance of the same wrong assumption in the card-rendering code (`new Date(g.date + 'T00:00:00')`, string concatenation onto a Timestamp object), which would have silently rendered "Invalid Date" once the sort crash was fixed.

### What was done
- **`members/gallery.html`** — added the same `toDate()` helper used by `js/gallery.js`, and used it in both the sort comparator (`toDate(b.date) - toDate(a.date)`) and the card date display (`toDate(g.date).toLocaleDateString(...)`).

### Verification
Couldn't reproduce the authenticated member path locally (no test credentials), but verified the fix removes the crash: loaded `/members/gallery.html` locally against the real Firebase backend anonymously (member-auth.js's redirect neutralized via Playwright route mocking) and confirmed the console now shows only the *expected* `permission-denied` error for an anonymous session — the `localeCompare` TypeError is gone. A real member session has no such permission barrier, so with both the index (Session 134) and this fix in place, the galleries should now render.

---

## Session: fix — Members/youth galleries not showing on members/gallery.html (missing composite index) (Session 134)

**Date:** 2026-06-25
**PR:** #211 (squash-merged)
**Status:** Merged, deployed to production

### Context
User published two galleries (one `audience: "youth"`, one `audience: "members"`) and confirmed via screenshots both show "Published" in `/admin/gallery.html`. Logged in as a member, visited `/members/gallery.html` — page loaded fine (nav, tabs, header all rendered) but the gallery grid was completely empty under every tab (All/Members/Youth), despite two matching published galleries existing.

### Investigation
`members/gallery.html`'s `loadGalleries()` runs:
```js
db.collection('gallery')
  .where('audience', 'in', ['members', 'youth'])
  .where('published', '==', true)
  .get()
```
This combines an `in` filter with an `==` filter on a *different* field — exactly the query shape that needs an explicit Firestore composite index in this project (confirmed by every other multi-field query already having one registered: `sermons: published+date`, `events: published+startDate`, `blog: published+kind+publishedAt`, etc.). `firestore.indexes.json` had no entry at all for the `gallery` collection. A missing-index error on `.get()` lands in the existing `.catch()` block, which just logs to console and shows "Failed to load galleries" — except the screenshot showed a silently empty grid with no visible error text, consistent with the catch firing but the error message rendering somewhere not visually obvious, or the specific error path landing slightly differently. Either way, the query shape itself was the clear, confirmed gap — every other collection in this codebase needed one for the equivalent pattern, and gallery was the one collection that didn't have it.

### What was done
- **`firestore.indexes.json`** — added `gallery: audience ASC, published ASC` (the `in` clause is indexed the same as an ascending equality field).
- **`CLAUDE.md`** — added the missing entry to the "Required composite indexes" list (it was already out of sync before this bug, since this index need predates this session).
- Deployed manually via `firebase deploy --only firestore:indexes` — **not** part of the automatic CI hosting deploy (`deploy.yml` only deploys static hosting; indexes, like Cloud Functions, need a manual deploy after merge, per existing project convention).

### Verification
No member test credentials available to reproduce the exact authenticated query locally. Verified the index entry is syntactically valid (`JSON.parse`) and structurally consistent with every other composite index already working in this project for the identical equality+filter pattern. Deployed directly to the production Firestore project (already authenticated via `firebase-tools` in this environment) — `firebase deploy --only firestore:indexes` reported success, and `firebase firestore:indexes` afterward confirms the new `gallery: audience ASC, published ASC` entry is registered alongside the rest. The `gallery` collection only has 2 documents total, so the index build (normally the slow part for larger collections) should already be complete. Still asked the user to confirm both galleries now actually appear on `/members/gallery.html`, since no member credentials were available here to check directly.

---

## Session: fix — Member-only content lingering after logout (stale Firestore cache) (Session 133)

**Date:** 2026-06-25
**Status:** Merged, deployed to production

### Context
User reported: setting a gallery's audience to "members" still showed it on a public page even after logging out. Asked a clarifying question (which page exactly, and same-browser vs. fresh-incognito test) before assuming anything — user confirmed it was the same browser, and that a fresh/different browser correctly showed nothing.

### Investigation
Traced every code path touching the `/gallery` collection before concluding anything:
- `js/gallery.js` (public `/gallery.html`) queries `.where('audience', '==', 'public')` — correctly scoped.
- `firestore.rules`: `allow read: if resource.data.audience == 'public' || isMember();` — correctly scoped.
- `index.html` (the actual homepage) has no gallery code or Firestore query at all — ruled out as the literal location.
- `js/search.js` doesn't index galleries. `js/welcome-carousel.js` is purely static, no Firestore involvement.
- `admin/blog.html`'s "From Gallery" photo-reuse picker queries all published galleries with no audience filter, but that's an admin-only convenience tool that copies specific photo URLs into a blog post on deliberate admin action — not an automatic leak, and not what the user described.

The "fresh browser shows nothing, same browser still shows it" report pointed straight at `enablePersistence({ synchronizeTabs: true })` (`js/main.js`) — Firestore's offline cache persists across sign-out by design (it's not session-scoped), so a member-audience document fetched while logged in stays in that browser's IndexedDB and keeps rendering on a public page after logout, even though the server would correctly refuse to serve it to a logged-out request.

### What was done
- **`js/main.js`** — new shared `signOutAndClearCache()`: calls `auth.signOut()`, then best-effort `firebase.firestore().terminate()` followed by `.clearPersistence()` (swallows errors — this fails whenever another tab/connection is still open, which is expected and shouldn't block sign-out).
- Routed all four sign-out entry points through it, replacing each one's direct `auth.signOut()`/`firebase.auth().signOut()` call: `logoutUser()` (main nav), `window._memberAuthSignOut` (`js/member-auth.js`, the gated-content "Sign out" prompt), the account-deletion flow (`profile.html`), and the pending-approval homepage state's sign-out button (`js/homepage.js`).
- **`service-worker.js`** — cache v64 → v65 (`js/main.js`, `js/member-auth.js`, `js/homepage.js` all changed; missed this in the first commit on this branch, caught before merge).

### Verification
No real Firebase test credentials available in this environment to reproduce the full login→cache→logout cycle end-to-end. Verified what's checkable: `node --check` on all three changed `.js` files, and a local Playwright pass confirming `signOutAndClearCache` is defined and globally callable on `index.html` and `members/groups.html` (profile.html redirects unauthenticated visitors to `/login.html` before the check can run, as expected — confirmed via `grep` that `js/main.js` is still included in its `<script>` tags). No new console errors introduced on any of the three pages.

---

## Session: feat — Site-wide icon-colour unification (Session 132)

**Date:** 2026-06-25
**PR:** #208 (squash-merged)
**Status:** Merged, deployed to production, verified live

### Context
User reviewed the Session 131 members-dashboard redesign ("looks good") and asked to apply the same fix to the homepage and admin page, "and any other page where these might exist."

### What was done
- **Audited first.** Grepped for every `bg-{color}-100`-style class site-wide (28 files matched). Checked each one's actual usage, not just the class name:
  - `members/index.html` — already fixed in Session 131.
  - `admin/index.html` — confirmed the identical anti-pattern: 19 dashboard cards, each a different colour (`blue-100`, `purple-100`, `rose-100`, `indigo-100`, `sky-100`, `teal-100`, `emerald-100`, `cyan-100`, `orange-100`, `lime-100`, `violet-100`, `red-100`, `amber-100`, `gray-100`).
  - `index.html` — the Explore section (4 tiles) alternated two treatments (amber-tint+amber-icon for two cards, navy-tint+navy-icon for the other two) per a since-superseded design rule — not random, but still inconsistent with the now-unified convention.
  - Every other hit (`story.html`, `members/cottage.html`, `members/gallery.html`, `members/groups.html`, `members/prayer.html`, `members/serving-teams.html`, and 19 other `admin/*.html` files) turned out to be unrelated UI: status badges/pills (Open/Approval Required, Answered, Joined, capacity-remaining counts), native file-input styling (`file:bg-amber-100`), secondary/cancel buttons, or the single access-denied lock icon repeated identically on every admin page. Confirmed these use different colours *intentionally* (to convey different states) and left them untouched.
- **`index.html`** — Explore section's 4 tiles unified to `bg-[#0A3D62]/10` + `text-amber-500`, dropping the old amber/navy alternation. Kept the tile shape (icon-on-top, label below, no description text) since these are simple quick-link tiles, not description-bearing dashboard cards — no chevron added here, unlike the dashboard treatment.
- **`admin/index.html`** — all 19 cards converted to the same compact-row layout as `members/index.html`: uniform `bg-[#0A3D62]/10` + `text-amber-500` icon, horizontal row (icon left, title+description right), trailing `fa-chevron-right`. Grid narrowed from `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` to `grid-cols-1 lg:grid-cols-2` for the same reason as Session 131 (wider rows need more room per card than the old square cards did). Confirmed the permission-filtering JS at the bottom of the file (`[data-perm]`/`[data-superadmin]` → `classList.add('hidden')`) only touches the outer `<a>` element, unaffected by the internal restructure.
- **`CLAUDE.md`** — updated the Design System note that previously documented two different icon conventions (member-area uniform vs. marketing-grid alternating) to describe the single unified rule, and pointed at `members/index.html` as the reference markup for the dashboard-card row+chevron pattern.

### Verification
Screenshotted the homepage Explore section and the full admin dashboard locally after the change — confirmed uniform colour across all tiles/cards in both, chevrons present on the admin dashboard, no layout breakage, and that the existing permission-filtering script still finds and hides cards by `data-perm`/`data-superadmin` correctly (verified the attribute is still on the right element, not exercised against a real logged-in session in this offline test).

---

## Session: feat — Members dashboard card redesign (Session 131)

**Date:** 2026-06-25
**PR:** #207 (squash-merged)
**Status:** Merged, deployed to production, verified live

### Context
User shared two/three design mockups generated in Claude Desktop (`members_dashboard_mobile_preview.html`, a phone-mockup comparison of 3 card styles) and asked for suggestions on making the dashboard icons "look more like the site." Compared the mockups against the live dashboard and against this file's own Design System notes, which already documented the live cards' problem: each card used a different pastel tint (`bg-amber-100`/`bg-blue-100`/`bg-emerald-100`/`bg-purple-100`/`bg-green-100`/`bg-rose-100`/`bg-red-100`) instead of the established uniform `bg-[#0A3D62]/10` + `text-amber-500` convention. The user's preferred mockup ("Option A — Accent bar") already matched that convention closely. User dropped the mockup's left accent bar (Claude Desktop's idea, not a requirement), liked the trailing-chevron suggestion, and said they didn't mind keeping a grid-of-cards layout as long as the look was consistent — left the specific call to the agent.

### What was done
- **`members/index.html`** — all 7 dashboard cards (Directory, Groups, Cottage Meetings, Prayer Requests, Daily Devotional, Members Gallery, Live Stream) converted from tall vertical cards (icon-on-top, multi-coloured per card) to compact horizontal rows: icon left (`bg-[#0A3D62]/10 rounded-xl` + `text-amber-500`, uniform across all 7), title + description stacked to the right, a muted `fa-chevron-right` on the far right as a tap affordance. Grid wrapper changed from `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` to `grid-cols-1 lg:grid-cols-2 gap-4` — the wider/shorter row shape needs more width per card than the old square-ish cards did, so 3 narrow columns would have cramped the description text; kept the "grid of cards" structure the user said they didn't mind, just fewer/wider columns.
- Did **not** touch `admin/index.html`, which has the exact same anti-pattern on its 14 dashboard cards (`bg-amber-100`/`bg-blue-100`/`bg-emerald-100`/etc., confirmed via grep) — flagged to the user as a candidate for the identical fix rather than silently expanding scope to a page that wasn't part of this conversation.
- Audited every other file matching the same colour-class grep (28 files, mostly `admin/*.html`) before concluding scope — confirmed all the public/member-area hits (`story.html`, `members/cottage.html`, `members/gallery.html`, `members/groups.html`, `members/prayer.html`, `members/serving-teams.html`) are legitimate status badges (Open/Approval Required, Answered, Joined, capacity remaining) where different colours per state are intentional and correct — not the same bug, left untouched.

### Verification
Rendered the three Claude Desktop mockups locally (Playwright, file:// URL) to compare directly against a live screenshot of the production mobile dashboard before deciding anything. After implementing, screenshotted the new layout at both mobile (390px, single column) and desktop (1280px, 2-column grid) against the real local dev server — confirmed uniform icon colour, chevron, spacing, and that the grid behaves correctly at both breakpoints. (Fewer than 7 cards rendered in the test screenshots because the local server's pages still load the real `firebase-config.js` and hit the live `egc-church` Firestore project for `/config/features` and `/config/pages` — an unrelated, pre-existing feature-flag/page-composition state, not a markup bug.)

---

## Session: fix — Admin/members nav consistency + stale shared-partial caching bug (Session 130)

**Date:** 2026-06-25
**PR:** #206 (squash-merged)
**Status:** Merged, deployed to production, verified live

### Context
User reported two issues on `/admin/connect.html`: the nav bar was light/white instead of navy (admin-nav.html and members-nav.html were never updated in Session 129 — only the public `nav.html` was), and the old fake-logo placeholder still showed briefly on page load before being replaced. Asked whether the real logo could just be the default everywhere, and gave a blanket go-ahead for the changes.

### What was done
- **`admin-nav.html` / `members-nav.html`** — same treatment as Session 129's `nav.html`: real `<img src="/assets/images/logo.png">` instead of the fake amber-circle + text placeholder, navy background (`bg-[#0A3D62]`) instead of white, white/amber text and icon colours throughout (nav links, search icon, notification bell, hamburger, mobile dropdown menu). The Admin/Members dropdown panels themselves stay white cards (same pattern as the notification panel and user dropdown on the public nav) — only the top-level bar changed colour. No transparent-over-hero behavior here — admin/member pages don't have a hero banner concept, so these two navs are just always solid navy, simpler than the public nav's scroll-driven transparency.
- **`firebase.json`** — added explicit `Cache-Control: no-cache` headers for `/nav.html`, `/footer.html`, `/admin-nav.html`, `/members-nav.html` (both staging and production targets), mirroring the existing `/js/**`/`manifest.json`/`service-worker.js` rules. Root cause: these four files had no header rule at all, so Firebase Hosting's default `max-age=3600` could serve a browser a stale, pre-deploy copy of a shared nav/footer partial for up to an hour after every deploy — independent of the service worker, which already does the right thing (`networkFirst()` on any `Accept: text/html` request) but is itself subject to the browser's own HTTP cache when it calls `fetch()`. No service-worker cache version bump needed — confirmed by reading the actual fetch handler that HTML partials are already served network-first at the SW layer; this was purely an HTTP-cache-layer gap.

### Verification
Real Firebase auth isn't available in the local test harness, and the admin/member auth guards (`admin-auth.js`/`member-auth.js`) redirect unauthenticated visitors away almost immediately — too fast to screenshot normally. Verified by intercepting and neutralizing the guard script's network request (Playwright route mocking) so the page stays put long enough to render: confirmed `admin-nav.html` (on `/admin/connect.html`) and `members-nav.html` (on `/members/groups.html`, including opening the MEMBERS dropdown panel) both render with the real logo, navy background, and correct active-link highlighting, on both desktop and the mobile hamburger menu.

### Notes / decisions
- Deliberately did not extend the transparent-hero-overlay treatment to admin/members pages — there's no hero banner concept there, and it would have been scope creep beyond what was asked.
- `js/nav.js`'s existing `highlightActiveLink()` (amber-400 vs amber-600 shade selection, added in Session 129) needed no changes — it already branches on which hover class is present, and now correctly picks amber-400 for these two navs too since they use the same convention as the public nav.

---

## Session: fix + feat — Real logo in nav/footer, transparent hero overlay, site-wide sticky-nav bug fix (Session 129)

**Date:** 2026-06-24
**PR:** #204 (squash-merged)
**Status:** Merged, deployed to production, verified live

### Context
User is replicating their old site (www.egc.church) ahead of decommissioning it. First-impression feedback on the homepage: the nav showed a placeholder amber-circle + text lockup instead of the real church logo, the real logo (`assets/images/logo.png`) is white-on-transparent so it only reads on a dark background, the old site centers its logo in a transparent nav that floats over a dark hero banner on every page (not just home), and the footer was missing the logo entirely. Did a live visual comparison against www.egc.church via a throwaway local Playwright install (not a project dependency) before making changes.

### What was done
- **`nav.html`** — replaced the fake icon+text lockup with the real `<img src="/assets/images/logo.png">`, absolutely centered in the bar regardless of how wide the link list is either side. Default nav background is solid navy (`bg-[#0A3D62]`) — always safe. `logo.png` already has "EMMANUEL / GOSPEL CENTRE" baked into the graphic (confirmed by rendering it at native resolution), so no separate text span is added — an earlier pass that added one caused a visible duplicate wordmark, caught via screenshot and removed. `#nav-logo-area` id preserved so `applyBranding()` (js/main.js, Phase 8 multi-church template) still correctly swaps in a superadmin-uploaded custom logo for forks of this template.
- **`js/nav.js`** — new `initHeroOverlay()`: on any page with a `[data-hero-banner]` element, toggles the nav between transparent and solid navy based on whether that banner has scrolled past the nav's own height (`getBoundingClientRect().bottom <= nav.offsetHeight`). Pages without one (`login.html`, `story.html`, `404.html`) just keep the solid navy default — no transparency, nothing to overlay. Also fixed `highlightActiveLink()` to pick the right active-link color (amber-400 on the navy public nav vs. the unchanged amber-600 on the white admin/members navs) instead of hardcoding one shade for all three nav partials.
- **`footer.html`** — added the real logo image above the church name text (was pure Font Awesome icon + text before, no logo).
- **`index.html`** — hero header tagged `data-hero-banner`, changed from `h-[calc(100vh-65px)]` (a prior mobile-overflow fix, see Session 124) to a plain `-mt-16 h-screen`, since the negative margin now cancels the nav's reserved flow space directly — same end result, no more magic-number height subtraction.
- **9 inner-page banners** (`sermons.html`, `events.html`, `blog.html`, `about.html`, `connect.html`, `gallery.html`, `music.html`, `william-branham.html`, `fulfillment-of-prophecy.html`) and **`profile.html`**'s page header — each tagged `data-hero-banner`, given `-mt-16` to pull up underneath the nav, and extra top padding so the title text still clears it.
- **Site-wide sticky-nav bug** — discovered while testing the new scroll-to-solid behavior: nav never actually stuck on any page, on any browser, because `#nav-placeholder` (nav's containing block) has zero extra height beyond the nav itself, so sticky has no room to operate and the nav just scrolls away like a normal element. Reproduced in complete isolation (a blank HTML file with no project code) to confirm it wasn't something introduced by this session's changes. Fixed by adding `class="contents"` to `#nav-placeholder` across all 41 pages that have it (`display: contents` removes the wrapper's own box, so `<nav>`'s containing block becomes `<body>` — full page height — instead of the placeholder div). One-line change, identical everywhere, applied via a bulk find-and-replace rather than 41 individual edits.
- **`service-worker.js`** — cache v63 → v64 (`js/nav.js` changed; HTML partials are network-first and don't need a version bump).

### Verification
No unit/integration tests cover visual layout, so verified by serving the repo locally (a throwaway static file server, not `firebase serve`) and driving it with a throwaway local Playwright install — both desktop and mobile viewports, homepage and an inner page (`sermons.html`), scrolled and unscrolled, plus a no-banner page (`story.html`) and the mobile hamburger menu. Confirmed: logo renders once (no duplication), nav is transparent over the homepage video and turns solid navy past it, nav now genuinely stays stuck on scroll on every page tested, admin/members nav partials (not touched) are unaffected.

### Deferred follow-up (not built this session)
Per-page custom hero images (e.g. a photo banner per page like the old site's "Notice Board"), admin-uploadable via an extended `/admin/pages.html`, falling back to the navy banner automatically when unset. Scoped in conversation but not built — this session shipped the navy-fallback nav/logo fix only.

### Notes / decisions
- `assets/css/custom.css` is not linked from any HTML file currently (Phase 8c's branding CSS variables only ever get applied via direct inline `style` writes from `applyBranding()`/`applyFeatures()` in `js/main.js`, never from the stylesheet itself) — noticed in passing, not fixed, since it wasn't blocking anything in this session.

### Follow-up fix (same session) — logo overlapping the link list
User caught this live on the PR #204 preview (a real browser, not my sandboxed test): the absolutely-centered logo (`left-1/2 -translate-x-1/2`) overlapped the link list on their actual machine even though it looked fine in my own 1440px headless screenshot — the absolute-centering approach ignores sibling content width entirely, so it was always one font-metrics/viewport-width combination away from colliding, regardless of what I'd already screenshotted. Replaced it with a real fix: links are now split into two groups in normal flex flow either side of the logo (HOME/SERMONS/EVENTS/BLOG/ABOUT on the left, WILLIAM BRANHAM/GALLERY/MUSIC/CONNECT on the right) — no absolute positioning at all, so overlap is structurally impossible regardless of width or font rendering. Also moved the desktop-links breakpoint from `md:` (768px) to `lg:` (1024px) to keep enough room for both split groups plus the logo plus the icons/login button, and updated the hamburger button + mobile dropdown panel to match the new `lg:` breakpoint (they were still gated on `md:`, which would have left a gap between 768–1023px with neither the desktop links nor the hamburger menu visible). Verified by screenshotting the nav at 8 widths from 390px to 1600px — no overlap at any of them.

### Deploy notes
PR #204 merged to `main` clean (all CI checks passed: lint-links, sw-cache-check, security-rules, preview deploy). The auto-triggered production deploy (`deploy.yml`) failed its first three attempts with `Error: Invalid response body while trying to fetch https://www.googleapis.com/oauth2/v4/token: Premature close` / `Failed to authenticate` — a transient Google OAuth/network hiccup on GitHub's runners, not a code or secrets problem (the identical error and recovery-on-retry had already happened once on this same PR's preview deploy earlier the same session, and a similar transient Google Cloud auth failure is documented in Session 128 too). Succeeded on a later retry. Verified live on production directly: `curl`'d `app.egc.church/nav.html` and `/footer.html` to confirm the new markup is actually being served, and screenshotted the live homepage to visually confirm the centered logo + transparent hero nav render correctly in production.

---

## Session: fix + feat — Storage delete bug, PWA caching bugs, full Media Library (Session 128)

**Date:** 2026-06-24
**PRs:** #197 (Rapture date), #198 (SW cache bump), #199 (JS no-cache header), #200 (Storage delete rules fix), #201 (Media Library), #202 (bulk orphan select)
**Status:** Merged, deployed, verified live

### Rapture date resolved (PR #197)
Church confirmed the uploaded file's `65-1204` naming is correct — updated the date from 1965-06-26
(what the old site showed) to 1965-12-04. The William Branham sermon library is now fully accurate.

### Two PWA caching bugs, found via real user reports

User reported sermons not showing on `/fulfillment-of-prophecy.html` on their installed Android PWA,
then on a second mobile browser, even after uninstalling/reinstalling the PWA. Two separate, stacked
caching layers were responsible — fixing the first wasn't enough on its own:

1. **PR #198** — `service-worker.js` uses cache-first for `.js` files. Several PRs had edited
   `js/branham-sermons.js` without bumping `CACHE_NAME`, so installed PWAs kept serving an old cached
   copy. Bumped v62 → v63.
2. **PR #199** — bumping the SW cache version still wasn't enough: Firebase Hosting's default
   `Cache-Control: max-age=3600` on static files means a phone's plain **HTTP cache** (a layer below
   the Service Worker entirely) can hold a stale `.js` file for up to an hour — independent of the SW,
   and not cleared by reinstalling the PWA or switching browsers (on Android, the PWA and "normal
   browser" share the same underlying Chrome storage). Added an explicit `no-cache` header for
   `/js/**` in `firebase.json`, mirroring the existing `manifest.json`/`service-worker.js` precedent.

Root cause of the user's "still nothing" after both fixes turned out to be a third, unrelated thing:
Chrome's own per-site cache on that specific device hadn't picked up either fix yet. Walked the user
through Settings → Site settings → All sites → egc.church → **Delete & reset**, which resolved it.
Both fixes are still correct and necessary going forward — they prevent this from recurring, the
manual clear was just to unstick that one already-stale device.

Both gotchas are now documented in CLAUDE.md's Architecture / Design Decisions so they don't get
rediscovered the hard way again.

### Storage delete rules silently denied every delete, forever (PR #200)

User asked for a site-wide media library "browsable... to maintain it in one place." While building
the planned orphan-cleanup feature, discovered every path in `storage.rules` combined a
content-validator helper (`isValidImage()`/`isValidAudio()`/`isValidDocument()`) into a single
`allow write` rule. `request.resource` doesn't exist on a `delete` request, so those helpers throw
when reading `request.resource.contentType`, and the whole rule silently denies — confirmed against
the Storage emulator (upload succeeded, delete on the identical file failed with
`storage/unauthorized`). This means **every "deleted" gallery photo, music track, sermon file, team
photo, branding logo, etc. has likely left its actual file behind in Storage for the project's entire
history**, with zero error ever surfaced to the admin (the client-side `deleteMedia()` helper swallows
errors by design).

Fixed by splitting every combined rule into `allow create, update: if ... && validator();` plus a
separate `allow delete: if ...;` (no validator needed for removal). Added
`tests/storage.rules.test.js` (27 tests: one full pattern check per distinct rule shape, plus a delete
regression sweep across every remaining path) and wired the Storage emulator into the existing
`security-rules` CI job alongside Firestore (168 tests total now). Deployed manually
(`firebase deploy --only storage`) since CI never auto-deploys rules.

### Media Library (PR #201) + bulk orphan select (PR #202)

Turned `/admin/media.html` into a real Media Library:
- **Browse/search**: aggregates files from `/siteMedia`, `/gallery`, `/music`, `/sermons` (incl.
  `materials[]`), `/series`, `/events`, `/blog` (incl. `galleryUrls[]`/`videos[]`), `/team`, and
  `/config/branding` into one list, tabbed by source (All / General Uploads / Gallery / Music /
  Sermons / Events & Blog / Team / Orphaned), searchable by name/category/source.
- **Category tagging**: free-text tag, **General Uploads only** — everything else is already
  organised by its own admin page, so no redundant tagging was added there.
- **Safety guardrail**: files actively referenced elsewhere can only be deleted from that feature's
  own admin page (a "Manage" link points there) — never from the aggregator, so a deletion can't
  leave a dangling Firestore reference behind. Only General Uploads and confirmed orphans are
  deletable here.
- **`scanOrphanedMedia`** — new callable Cloud Function (superadmin only), deployed after several
  retries due to a transient Google Cloud `cloudbilling.googleapis.com` rate limit (~25 min of
  retries, unrelated to our code). Walks the actual Storage bucket via `bucket.getFiles()` and
  cross-references every file against every URL field across all the collections above; anything
  referenced nowhere comes back as an orphan. Always excludes `users/{uid}/photo` regardless of
  orphan status (personal data, not site content).
- **First real run found 125 orphaned files out of 619 scanned** — concrete confirmation of the
  Storage-delete-bug's impact; per the user, mostly leftovers from removing images during blog-post
  editing that never actually got cleaned up. Deleting 125 files one at a time wasn't practical, so
  PR #202 added a "Select all" checkbox + per-row checkboxes + "Delete selected", so the workflow is
  select-all → uncheck anything you want to keep/reuse → delete the rest in one batch.

Verified via mocked-Firebase Playwright passes throughout (tab switching, search, category editing,
orphan scan, select-all/uncheck/bulk-delete semantics, and resilience when one collection's query
fails) rather than against live Firebase, since the full aggregation logic across 9 collections + a
Cloud Function was impractical to hand-test exhaustively.

### Deploy notes for next session
Everything above is merged, deployed, and confirmed live in production as of this entry — Storage
rules, the `scanOrphanedMedia` function, and all static site changes. No outstanding manual deploy
steps.

### Still open / next session
- No outstanding bugs or deferred items from this session. The "browse/organize as it grows" need
  raised last session is now fully addressed by the Media Library.

---

## Session: feat — William Branham sermon library wired up + page redesign (Session 127)

**Date:** 2026-06-24
**Branches:** PR #192 (show URL as text in admin/media.html), #193/#194 (wire up sermon URLs), #195 (redesign)
**Status:** Merged

### Context
User uploaded all 10 William Branham sermon files (PDF + audio) via `/admin/media.html` built last
session, and pasted the resulting list of Storage URLs. Matched each by filename's VGR date code to
the sermon metadata already in `js/branham-sermons.js` and wired them in (PR #193, then #194 for the
last one — "The Spoken Word Is The Original Seed" — which arrived in a follow-up message).

Also made a small upload-tool improvement first (PR #192): the file list only had a "Copy URL" button
per file, which is tedious for a ~19-file batch. Now the URL also renders as plain text so the whole
list can be select-all + copied in one go.

**Found a discrepancy**: the uploaded "The Rapture" file is named with VGR's standard `65-1204`
code (4 Dec 1965), but our existing metadata had `1965-06-26` (scraped from the old site earlier).
Initially "corrected" the date to match the filename — turned out to be the wrong call (see below).

### Redesign (PR #195)
User then compared our page to the old site's actual `/fulfillment-of-prophecy` page and asked to
mimic its look closely, specifically calling out that 6 of the 10 sermons (Spoken Word → Present
Stage → Is This The Sign → The Breach → The Seventh Seal → Christ Is The Mystery) are deliberately
grouped together because they trace the growth of Brother Branham's revelation, and are not meant to
be swapped — unlike the other 4, which the church plans to rotate over time.

Investigated the live old site with Playwright (real browser, not WebFetch — this exact page already
caused a WebFetch hallucination earlier in the project) to get ground truth on layout: a gold card per
sermon with month/day/year stacked, an inline native `<audio controls>` player, and icon-above-label
Audio/PDF download links. Rebuilt `js/branham-sermons.js` and `fulfillment-of-prophecy.html` to mirror
this: split into `CORE_SERMONS` (six, fixed) and `MORE_SERMONS` (four, rotating) with separate
section headings, and reordered the page flow to match the old site (sermons grid → Five Comings
table → Elijah content → rotating recordings grid).

**While inspecting, resolved the date discrepancy**: a zoomed screenshot of the live old site's actual
card confirmed it reads "June 26 1965" for The Rapture (matching the original scrape, not the
uploaded file's `65-1204` filename). Reverted the date back to `1965-06-26` to match what's being
mimicked, and left a code comment + flagged it to the user that the uploaded file's name still
disagrees — worth the church confirming which is actually correct.

### Verification
Visual check via Playwright screenshots (desktop core grid, desktop "more recordings" grid, full
mobile viewport) against a local static server before shipping. `node -c` syntax checks on all JS.
No Firestore/Storage rules touched in any of these four PRs, so no manual deploy step was needed —
all four went out automatically via the normal merge-to-main pipeline.

### Still open / next session
- Confirm "The Rapture"'s correct date with the church (old site vs. uploaded filename).
- User flagged a future need: `/admin/media.html` currently has no way to browse/organize files as
  the library grows past a handful of items — explicitly deferred as "another topic," not yet scoped.

---

## Session: feat — general site media upload tool + William Branham sermon list (Session 126)

**Date:** 2026-06-24
**Branch:** `feat/william-branham-and-welcome-carousel` (PR #189, extended) + `fix/william-branham-prophecy-nav-link` (PR #190)
**Status:** Merged

### Context
User reviewed PR #189 and asked for two fixes plus a scope addition: (1) some content was missing
from `/fulfillment-of-prophecy.html`, (2) there was no way to navigate to it from the site itself (had
to type the URL), (3) wanted **all** William Branham content copied over, **including the sermons**.

Re-investigated the old site thoroughly and found the complete picture: a "WILLIAM BRANHAM SERMONS"
section with 6 sermons that each have both a PDF transcript (~130–395KB) and an audio recording
(~30–97MB, `.m4a`), plus a second list of 4 more sermons with audio only (one of which, "The Rapture,"
has a broken link even on the old site itself).

This surfaced a real blocker: the audio files are far too large to commit to git (GitHub's hard limit
is 100MB per file; one is already at 97MB). Re-hosting them properly means Firebase Storage, which
needs either a service account key or a fresh CI auth token — attempting to mint one
(`firebase login:ci`) was correctly blocked by Claude Code's safety layer as an unauthorized
credential-creation action outside the scope of what was asked. Stopped and asked the user rather than
working around it.

**Also course-corrected mid-session on the PDFs specifically:** had already downloaded all 6 PDF
transcripts intending to commit them directly (the user's own stated preference), but on reflection
reversed that — these are complete copyrighted works (Voice of God Recordings holds the rights), not
excerpts, and bulk-copying complete copyrighted files isn't a call to make unilaterally just because a
file is small enough to fit in a git repo. Deleted the downloaded PDFs rather than commit them, and
proposed treating PDFs and audio the same way: the user transfers both themselves through a tool built
for that purpose, rather than either being downloaded and re-hosted automatically.

User's resolution: build a general-purpose site media upload page (like the existing gallery upload,
but not tied to one content type), so they can upload any file themselves and get a copyable URL to
use anywhere on the site.

### What was built
- **`admin/media.html`** (new, superadmin only) — file picker → `uploadMedia()` (the existing,
  unchanged `js/storage-upload.js` abstraction) → Firestore manifest at `/siteMedia/{id}` (name, url,
  sizeBytes, contentType, uploadedAt, uploadedBy) so uploaded files and their URLs stay discoverable
  later, with copy-URL and delete actions per file.
- **Firestore rules**: new `/siteMedia/{id}` match block, superadmin read/write only. New rules test
  block (3 tests: member denied, a non-superadmin permission holder denied, superadmin succeeds).
- **Storage rules**: new `/site-media/{fileName}` path, superadmin-only write, images/documents via
  the existing validators plus a dedicated audio branch allowing up to 150MB (comfortably covers the
  ~97MB sermon file).
- **`fulfillment-of-prophecy.html`** — added a "William Branham Sermons" section listing all 10
  sermons found on the old site (title, date, location — factual metadata only, no sermon text
  reproduced). New `js/branham-sermons.js` renders the list with PDF/Audio buttons that show as
  "Coming soon" until a URL is filled in — once the user uploads each file via `/admin/media.html` and
  shares the resulting URL, those buttons get wired up in a follow-up edit.
- **Admin dashboard card**: added a "Site Media" card to `/admin/index.html` (superadmin-only,
  matching the existing Settings/Page Layout card pattern — confirmed via the earlier CLAUDE.md audit
  that superadmin-only tools live as dashboard cards, not nav dropdown entries).
- `service-worker.js`: added `admin/media.html` and `js/branham-sermons.js` to the precache list,
  bumped v61 → v62.
- **Navigation fix (PR #190, follow-up)**: the user's original complaint — "I wasn't sure how to
  navigate to /fulfillment-of-prophecy.html I ended up just adding that to the base url" — was still
  unresolved after PR #189 merged; the only path there was a link buried mid-paragraph on
  `william-branham.html`. No reusable hover-dropdown nav component exists anywhere in the codebase
  (the only "dropdown" pattern is the click-triggered account menu), so rather than build new nav
  infrastructure for one case, added a one-click pill-style quick-link bar right under
  `william-branham.html`'s header (Deep Calleth to the Deep / Fulfillment of Prophecy / Sermons).

### Verification
Firestore rules test suite: 125 passing (was 122, +3 for the new `/siteMedia` rules). Confirmed the
`sw-cache-check` CI logic passes locally. Syntax-checked all new/modified JS and inline scripts.

### Deploy
PR #189 added a Firestore + Storage rules change — **not auto-deployed by CI.** Ran
`firebase deploy --only firestore:rules,storage` manually after merge; confirmed live. PR #190
(static-only) deployed automatically via the normal merge-to-main pipeline.

### Still open / next session
- User to upload the 10 sermon files (6 PDFs + up to 9 working audio recordings — "The Rapture" has no
  functioning link even on the old site) via `/admin/media.html`, then share the URLs so
  `js/branham-sermons.js` can be wired up with real download links.
- Worth the user separately confirming the church's actual redistribution rights/relationship with
  Voice of God Recordings for this material — not blocking, just flagged.

---

## Session: feat — William Branham content + homepage welcome carousel (Session 125)

**Date:** 2026-06-24
**Branch:** `feat/william-branham-and-welcome-carousel` (PR pending)
**Status:** Open

### Context
User asked me to confirm I could browse `www.egc.church` (the old site this one replaces), then asked
for two things based on what's there: (1) feature William Branham content, since it's core to the
church's belief and currently has no home on the new site; (2) bring back "the welcome look with the
image carousel" they remembered from the old site.

Verified both carefully before building anything:
- `WebFetch` (which passes content through a summarizing model) twice reported "no carousel, just a
  static image" — and **fabricated** an unrelated contact block ("Scarborough Spoken Word Christian
  Fellowship... Ontario") that doesn't exist anywhere on the actual page. A real-browser check (Playwright,
  with JS executing) found the carousel immediately: a 4-slide rotating photo panel
  (`d-ext-mediaSlider`) in a separate "A Warm Welcome" section below the top hero banner, not a hero
  replacement. Re-extracted the William Branham page text the same way (`page.evaluate(() =>
  document.body.innerText)`) instead of trusting WebFetch's summary, specifically because doctrinal
  quotes need to be exact, not paraphrased — and that re-check is what caught the fabricated contact
  block.
- Confirmed via the old site directly that "Sunday School 9:15 AM" (flagged a few sessions ago) is a
  real, current service time there — not an invented suggestion.

Asked 4 clarifying questions before writing any code (new pages vs. folding into About; adapt the old
text vs. user-provided wording; carousel placement — replace the hero or add a new section; photo
sourcing). User chose the recommended option on all four.

### What was built
- **`william-branham.html`** (new public page) — The Pillar of Fire account (with the Library of
  Congress authentication note), Life & Ministry biographical section with a YouTube embed, Fulfillment
  of Malachi 4:5,6 section, and a Deep Calleth to the Deep sermon excerpt (`#deep-calleth-to-the-deep`
  anchor) with two more YouTube embeds under "More Recordings." Content adapted from the old site,
  extracted via direct DOM text rather than an AI summary, to keep scripture/quotes exact.
- **`fulfillment-of-prophecy.html`** (new public page) — the "Five Comings of the Spirit of Elijah"
  table and supporting doctrinal explanation. **Deliberately did not** replicate the old site's sermon
  PDF/audio download library on this page — that's a separate, larger scope (re-hosting many files) and
  needs its own decision, not something to fold into this PR.
- **Homepage "A Warm Welcome" section** — new section right after `#adaptive-section` (text + "Contact
  Us" button + a 3-photo auto-rotating carousel). New `js/welcome-carousel.js`: plain CSS opacity
  crossfade, pagination dots, no animation library, no-ops if the carousel isn't on the page.
- Downloaded and re-hosted the actual photos from the old site (`assets/images/welcome/`,
  `assets/images/william-branham/`) — the church's own existing brand photography, not third-party content.
- Added "William Branham" to `nav.html` (desktop + mobile) and `footer.html`'s Explore column.
- `service-worker.js`: added both new pages + `js/welcome-carousel.js` to the precache list, bumped
  v60 → v61.

### Verification
Playwright-verified against the real source files (local static server): zero console/page errors on
all three pages; the carousel renders with 3 pagination dots; both YouTube embeds load real thumbnails;
the Five Comings table renders cleanly; confirmed the `sw-cache-check` CI logic passes locally.

### Deploy
Hosting-only — no rules/functions change. Will auto-deploy on merge.

### Still open / next session
- Sermon PDF/audio download library from `/fulfillment-of-prophecy` on the old site — not built. Needs
  a decision on hosting (re-host every file vs. link out) before it's worth doing.
- Photos are large (400-590KB each, no resizing/compression pass) — fine for now, worth optimizing if
  this becomes a pattern.

---

## Session: fix — hero was 65px taller than the viewport on mobile (Session 124)

**Date:** 2026-06-23
**Branch:** `fix/hero-height-nav-offset` (PR #187, merged)
**Status:** Merged, deployed (hosting-only — no rules change)

### Context
Asked to check the staging preview on mobile after the homepage redesign (PR #185). Found two things
worth separating clearly:
1. The PR #185 preview channel was already gone (Firebase cleans up old `pr-N` channels when a newer PR
   opens its own preview), and the persistent `staging.egc.church` site is stale — it 404s on
   `/footer.html`, meaning it hasn't been redeployed since before PR #185 landed.
2. The user relayed a bug report from "cowork" (their other Claude instance) claiming
   `#footer-placeholder` was missing from `index.html`, causing a missing footer and a blank gap at the
   bottom of the page, plus a separate claim that the scroll chevron wasn't visible on a full-height
   browser window.

Verified each claim against **production** (not staging) before acting: the footer-placeholder claim was
false — `curl` confirmed the div is present, and Playwright confirmed the footer renders correctly with
real Firestore data on both desktop and mobile. The footer/blank-space reports were almost certainly
from checking the stale staging site, not production — nothing to fix there. The chevron claim, however,
held up under direct measurement and turned out to be a real, separate, pre-existing bug.

### Root cause (the one real bug)
The nav bar sits in normal document flow above the hero `<header>` (not overlapping it) at a fixed
`h-16` + 1px border = 65px. The header used a plain `h-screen` (100vh), so nav + header together were
65px taller than the actual viewport on every page load. This predates PR #185 entirely — it just had
nothing living at the very bottom edge of the header before, so the 65px overflow was invisible. Adding
the scroll chevron there in PR #185 exposed it directly: the chevron rendered almost entirely below the
fold on first load, on both mobile and desktop.

### Fix
`h-screen` → `h-[calc(100vh-65px)]` on the hero `<header>` in `index.html`, with a comment explaining
the 65px constant.

### Verification
Playwright-verified on a 390×664 mobile viewport and a 1440×900 desktop viewport: `header`'s bottom edge
now lands exactly on `window.innerHeight` in both cases (previously 65px past it), and the chevron's full
bounding box is within the visible viewport on first load — confirmed via screenshot.

### Deploy
Hosting-only — no rules/functions change, auto-deployed on merge.

---

## Session: design — homepage hero/explore/footer + CLAUDE.md design-accuracy pass (Session 123)

**Date:** 2026-06-23
**Branches:** `design/homepage-and-footer` (PR #185, merged); doc updates direct to `main` this session
**Status:** Merged, deployed

### Context
User wants to start visual redesign work and had another Claude instance ("cowork") compare this site
against the old one it's replacing, producing a design-change prompt. Before acting on it, verified every
claim against the actual current code rather than applying it blindly — several didn't hold up: no
scripture-quote section exists on this site's homepage (describes the old site), the cache-version bump
target (v25→v26) was based on a stale number, the "iOS emoji" quick-link icons are already Font Awesome,
and a "5th service-time card" request was actually a Firestore content change disguised as styling. User
confirmed: apply what's valid, flag/skip what isn't — then, after approving the result, asked specifically
that the doc updates help that other Claude instance avoid the same mistakes on future design prompts.

### What shipped (PR #185)
- Hero: bottom gradient fade, bouncing scroll-down chevron, larger tagline.
- Moved `#adaptive-section` to right after the hero — a logged-in member's greeting/quick-links are now
  the first thing reached on scroll, ahead of public visitor content.
- Service times grid: responsive up to 5 columns + amber accent border (styling only — did not fabricate
  a new service-time entry, since that's Firestore data, not markup).
- Quick-links (Messages/Prayer/Directory/Groups) and homepage Explore-grid icons restyled from multi-
  coloured tints to the on-brand navy/amber palette.
- Notice Board now hides entirely when there are no announcements, instead of an empty-state message.
- New `footer.html` + `js/footer.js`: shared public-pages footer reading `/config/church` +
  `/homepage/content.serviceTimes` (`Promise.all`, graceful per-field fallback to `church-config.js`).
  `js/nav.js` now also injects it, public pages only. `service-worker.js` precache bumped v59 → v60.
- Verified in a real browser via Playwright against the actual served files (not a mock) — confirmed the
  hero gradient/chevron computed styles, the Explore-grid colour pairing, and that the footer correctly
  pulls real service times from the live Firestore project with graceful fallback.

### Doc-accuracy fixes (direct to CLAUDE.md, per the user's explicit ask)
Root-caused exactly where the bad design suggestions came from and fixed the source, not just the
symptom:
- Found the literal line in CLAUDE.md that caused the wrong cache-version suggestion
  (`current: egc-cache-v25`, long stale — actual was v59 at the time). Replaced with an explicit
  instruction never to hardcode the current version in prose; always read `CACHE_NAME` in
  `service-worker.js`.
- Added a **Design System** section to CLAUDE.md: colour/icon/shape conventions, the Tailwind CDN setup,
  and — most importantly — an explicit, permanent note on the shared-partial script-execution limitation
  (`<script>` tags inside an `innerHTML`'d partial never run; any partial's dynamic JS must be a separate
  file appended after injection, per the established `js/nav.js` pattern) so this doesn't get
  rediscovered/broken by a future change.
- Documented how to add the footer to a new public page (one `<div id="footer-placeholder">`, nav.js
  does the rest).
- Documented which homepage sections are fixed-order HTML vs. superadmin-configurable via
  `/admin/pages.html` (Phase 9) — relevant for any future "reorder this section" request.
- Filled in a long-standing gap unrelated to this session's symptom but caught while in this section: the
  Project Structure file tree was missing `nav.html`, `admin-nav.html`, `members-nav.html`, `footer.html`,
  `story.html`, `404.html`, and roughly half of the actual `js/*.js` files. All added with accurate
  one-line descriptions verified against the real files.

### Deploy
Hosting-only — no rules/functions change, auto-deployed on merge. Doc-only changes need no deploy.

---

## Session: fix — function order within a roster tile was random, not consistent (Session 122)

**Date:** 2026-06-23
**Branch:** `fix/serving-teams-slot-order-within-tile` (PR #182, merged)
**Status:** Merged, deployed (hosting-only — no rules change)

### Bug reported
A tile with multiple functions on the same date (e.g. Sound + Words) sometimes showed
Sound first, sometimes Words first.

### Root cause
Slots on the same date/label have no defined order from Firestore — their doc IDs are
random auto-generated strings, and the roster tile rendering looped over them in
whatever order the query happened to return, with no explicit sort.

### Fix
Sort a tile's slots alphabetically by function label before rendering, so the order is
identical every time regardless of Firestore's return order.

### Verification
Playwright-verified against the real source file: rendered the same 3-function group
with two different insertion orders (Words/Sound/Camera vs Camera/Words/Sound) —
confirmed both produce the identical final rendered order (Camera, Sound, Words).

### Deploy
Hosting-only — no rules/functions change, auto-deployed on merge.

---

## Session: fix — saveSlot() crashed after closeSlotModal() nulled the team id (Session 121)

**Date:** 2026-06-23
**Branch:** `fix/save-slot-null-teamid-after-close` (PR #180, merged)
**Status:** Merged, deployed (hosting-only — no rules change)

### Bug reported (testing Session 120's function-eligibility feature)
Assigning a user to a slot and clicking Save Slot threw `Uncaught (in promise)
FirebaseError: Function CollectionReference.doc() cannot be called with an empty path`
in the console. The roster didn't update itself — only a manual page refresh showed the
change had actually gone through.

### Root cause
`closeSlotModal()` resets `slotModalTeamId` to `null`. `saveSlot()` called it *before*
reading that same global for the post-save re-render:
`closeSlotModal(); reloadTeamCard(slotModalTeamId);` — by the second statement,
`slotModalTeamId` was already `null`, so `reloadTeamCard(null)` called `.doc(null)`
internally and threw. The slot write itself had already completed successfully by that
point (which is why a refresh showed the correct data) — the crash was purely in the
post-save re-render.

### Fix
Captured `teamId`/`slotId` into local consts at the top of `saveSlot()`, before any
modal-closing happens — the same safe pattern already used in `saveAndGenerateSchedule()`
and `saveMemberFunctions()`. Audited the rest of the file for the same read-after-reset
pattern; no other instances found.

### Verification
Playwright-verified against the real source file: opened an existing slot, assigned a
member, clicked Save Slot — confirmed zero page errors, the slot doc updated correctly,
the modal closed, and the roster tile updated immediately to show the new assignment
without needing a refresh.

### Deploy
Hosting-only — no rules/functions change, auto-deployed on merge.

---

## Session: feat — per-member function eligibility for Serving Teams (Session 120)

**Date:** 2026-06-23
**Branch:** `feat/serving-teams-member-functions` (PR pending)
**Status:** Open

### Context
Asked how to manually allocate a user to a slot (already possible — the slot editor's
"Assign to" dropdown) and how to put a member "in a role" (e.g. Sound or Video) so they
can only enrol for matching slots and their roster view only shows what's relevant to
them. Confirmed one policy decision before building: a member with no functions assigned
yet should be **locked out** (sees/claims nothing) rather than unrestricted-by-default —
the user explicitly chose this since no one has been assigned anything yet, and they'll
do the assignment pass themselves right after this ships.

### What was built
- **`memberFunctions: { [uid]: [string] }`** on the team doc — leader-assigned function
  eligibility per member.
- **`firestore.rules`** — new `isQualifiedForFunctions(teamId, slotFunctions)` helper;
  applied to both self-claim branches (lead position, trainee position) on
  `/servingTeams/{teamId}/slots/{slotId}` — a member can only claim a slot whose
  `functions` overlaps their assigned set. Release branches are untouched (releasing your
  own slot is never gated by current eligibility). Added `memberFunctions` to the
  leader-update allowlist on the team doc.
- **`members/serving-teams.html`** — a small "Functions" modal per member chip (gear
  icon) where a leader checks which of the team's functions that member can do; each
  chip now also shows their currently assigned functions inline. Non-leader roster views
  now filter to only slots matching the viewer's assigned functions, **plus** any slot
  they're already personally on (lead or trainee) so a later function change never hides
  a commitment they still need to track or release. Leaders/admins are never filtered.
  A locked-out member sees a clear explanatory message instead of a bare "no slots."
- **`tests/firestore.rules.test.js`** — updated the two existing claim-success tests to
  seed a matching `memberFunctions` entry (their premise was "any member can claim,"
  which is now intentionally false by default); added 5 new tests: locked-out-by-default
  for both lead and trainee positions, non-matching-function denial, leader-can-assign,
  non-leader-cannot-assign. Full suite: **122 passing** (was 117).

### Verification
- Firestore rules compiled clean and the full suite passes against the emulator.
- Playwright-verified against the real source file: leader assigns "Sound" only to a
  member via the new modal → `team.memberFunctions` updated correctly → switched
  perspective to that member (non-leader) → roster view correctly showed only the Sound
  slot, with the Video slot hidden → revoked all functions → confirmed the locked-out
  explanatory message appears instead of an empty roster.
- Caught and fixed a bug in the test mock itself (not the product): dot-path update keys
  like `memberFunctions.uid123` need expanding into a nested map, same class of issue as
  an earlier session's mock bug — confirmed by symptom (write silently landing under a
  literal dotted key instead of nesting) before fixing the mock, not the product code.

### Deploy
Adds a Firestore rules change — **not auto-deployed by CI.** After this PR merges, run
`firebase deploy --only firestore:rules`.

### Still open / next session
- Phase 1.7: day/time availability layered on top of function eligibility, and an
  auto-assign rotation option on Generate/Regenerate.
- Phase 2: Equipment Register — still not started.

---

