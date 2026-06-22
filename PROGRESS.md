# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with CLAUDE.md to resume quickly.
> **Rule:** Newest sessions at the TOP. Agent appends an entry on every PR.
> Older sessions are in `PROGRESS-archive.md` — only read it if you need historical detail.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-06-22
**Current milestone:** Maintenance — all phases complete; Cottage Meetings (Phase 1) shipped to replace the Google Form

---

## Session: fix — Cottage meetings discoverability on members dashboard (Session 95)

**Date:** 2026-06-22
**Branch:** `fix/cottage-dashboard-card` (PR pending)
**Status:** Open

### What was done

User reported not seeing cottage meetings in the "members area". Deployment verified live via curl (nav link + `/members/cottage.html` both present, HTTP 200), so it wasn't a deploy issue. Two causes: (1) the link was only in the MEMBERS nav dropdown, not a tile on the `/members/index.html` dashboard; (2) the member list intentionally hides past-dated meetings (`date >= today`), so a test meeting dated in the past (e.g. the sample "11 June 2026", before today 22 June) is visible to the admin but hidden from members.

- Added a **Cottage Meetings** tile to the members dashboard (`data-section="cottage"`, emerald house icon) for discoverability.
- SW cache v48 → v49.
- No change to the date filter — hiding past meetings is correct; the empty list during testing was the past date.

### Verification
curl confirmed nav link + page already deployed. Dashboard tile is a static markup addition matching the existing card pattern.

---

## Session: feat — Cottage meeting fields parity with the old Google Form (Session 94)

**Date:** 2026-06-22
**Branch:** `feat/cottage-meeting-fields` (PR pending)
**Status:** Open

### What was done

Follow-up to Session 93. The user listed the fields their Google Form used and asked to make sure they're all catered for. Capacity/date/time were already done; added the rest:

- **`title`** (optional) — e.g. "EGC: Cottage Meeting East Rand"; falls back to the region name when blank.
- **Multi-line venue** — `address` changed from a single-line input to a textarea; rendered with `whitespace-pre-line` on the member card and admin list (no need for the form's 4 separate VENUE_LINE fields).
- **`mapsLink`** — Google Maps URL; shown as a "Get directions" link (new-tab) on the member card. Guarded by a `safeHttpUrl()` helper so only `http(s)` links render (blocks `javascript:` etc.).
- **`contactName` / `contactNumber`** — on-the-night contact; number rendered as a sanitised `tel:` link.

Updated `admin/cottage.html` (form fields + save + edit-populate + list row), `members/cottage.html` (card render + helpers), and the **`registerForCottageMeeting`** confirmation message in `functions/index.js` now includes the maps link and contact (multi-line address flattened to commas for the notification body). SW cache v47 → v48; CLAUDE.md data model updated.

### Verification
TBD — syntax checks, functions load, and a stubbed-browser check that the new fields render (title, multi-line address, directions link, tel link) before merge.

### Still pending (manual after merge — CI deploys Hosting only)
- `firebase deploy --only functions` — the confirmation-body change.
- (No rules change this session — field additions live within the existing `cottageMeetings` doc rules.)

---

## Session: feat — Cottage Meetings registration, Phase 1 (Session 93)

**Date:** 2026-06-22
**Branch:** `feat/cottage-meetings` (PR pending)
**Status:** Open

### What was done

Replaces the church's Google Form for cottage-meeting sign-ups with a site-native, capacity-limited registration system. Cottage meetings run in members' homes across regions (East Rand ×2, North, West Rand, South) with limited seats; members register a party size for their region's meeting and get a confirmation.

**Data model**
- `/config/cottageRegions` — singleton `{ regions: [{id,name}] }`, superadmin-managed (existing `/config/` rule, no rule change). Drives the region dropdown and member grouping.
- `/cottageMeetings/{id}` — `regionId`/`regionName`, `hostUid`/`hostName` (the deacon), `address`, `date`, `time`, `capacity`, `seatsTaken`, `open`, `notes`. Address/date/time are member-visible (not secret — hosts can change).
- `/cottageRegistrations/{uid}` — keyed by member UID, so **one active registration per member** is structurally enforced. Holds `meetingId`, `partySize`, contact info.

**Permission** — new `cottage.manage` key (added to `functions/rolesData.js` ALL_PERMISSIONS + the existing **deacon** default role, and to `admin/roles.html`). A deacon manages only the meetings they host; superadmins manage all + the region list.

**Cloud Functions** (`functions/index.js`)
- `registerForCottageMeeting` — transactional seat reservation (no overselling), enforces one-per-member, writes the registration + increments `seatsTaken`, then sends an **in-app + push confirmation** (the primary channel) with venue/date/time via a new `sendUserNotification` helper.
- `cancelCottageRegistration` — transactional seat release + registration delete + cancellation notice.

**Pages**
- `/members/cottage.html` — open meetings grouped by region, "X of Y seats left", Register (party size) / Cancel via the callables; one-per-member UX (shows where you're registered, blocks others until you cancel).
- `/admin/cottage.html` — gated on `cottage.manage`; create/edit/delete meetings, capacity, open toggle, expandable registrant list; superadmin-only "Regions" manager. Save button uses `finally` (no stuck-Saving regression). Delete cleans up the meeting's registrations first (so no member is left pointing at a deleted meeting).

**Security rules** — `/cottageMeetings` (read: member; create: `cottage.manage` + self-host or superadmin; update/delete: host or superadmin). `/cottageRegistrations` (read: owner / host-of-meeting / superadmin; create+update: **denied** to clients — Cloud Functions only; delete: host/superadmin for cleanup).

**Plumbing** — members-nav + admin-nav links, admin dashboard card, SW cache v46 → v47 (both new pages precached), docs (`PERMISSIONS.md` → 16 keys; `CLAUDE.md` site map / data model / functions).

### Phasing
- **Phase 1 (this):** in-app + push confirmation (free, already built).
- **Phase 2 (planned):** SMS via SMSPortal (their existing provider) — store API creds as Firebase secrets, add to the `sendUserNotification`-style dispatch.
- **Phase 3 (planned):** WhatsApp + per-member preferred-channel opt-in.

### Verification
TBD — syntax checks, Firestore rules tests (emulator), and a stubbed-browser run of the member register/cancel flow before merge.

### Still pending (manual after merge — CI deploys Hosting only)
- `firebase deploy --only functions` — new callables.
- `firebase deploy --only firestore:rules` — cottage rules.
- Superadmin must add the five regions in `/admin/cottage.html`, and add `cottage.manage` to the live **Deacon** role in `/admin/roles.html` (DEFAULT_ROLES only seeds an empty collection; prod's role docs don't auto-update), then assign the Deacon role to the responsible deacons.

---

## Session: fix — Save button stuck on "Saving..." after successful save (Session 92)

**Date:** 2026-06-22
**Branch:** `fix/save-button-stuck-saving` (PR pending)
**Status:** Open

### What was done

User-reported bug: in `admin/gallery.html`, after uploading images and saving, the Save button stays in its disabled "Saving..." state. The list reloads fine, but reopening the form via "Add Gallery" still shows the stuck button — only a page refresh cleared it.

**Root cause:** `setSaving(false)` (and the blog equivalent `setSaveProgress(false)`) was called only in the `catch` block. On the success path the button was never reset, so the disabled/"Saving..." state persisted until the page reloaded.

**Fix:** moved the reset into a `finally` block so it always runs, success or failure. Applied to all three admin pages with the same pattern:
- `admin/gallery.html` — `saveGallery()`
- `admin/music.html` — `saveTrack()`
- `admin/blog.html` — `savePost()` (`setSaveProgress(false)` in `finally`)

(`admin/sermons.html` already used `finally` — unaffected.)

### Verification
Inline-script syntax check on all three. End-to-end browser test (Playwright, Firebase stubbed) on the reported gallery page: after a successful save the button returns to "Save Gallery" and is re-enabled, and stays correct when the form is reopened with no page refresh — 4/4 checks pass, no page errors.

### Notes
- HTML-only change — Hosting auto-deploys on merge; no rules/functions/storage/index deploy needed.

---

## Session: feat — Inline sermon series (remove separate series screen) (Session 91)

**Date:** 2026-06-22
**Branch:** `feat/inline-sermon-series` (PR pending)
**Status:** Open

### What was done

Reworked sermon series management so series are created/managed without leaving the sermon admin page. User feedback: the separate `/admin/series.html` screen was cumbersome and redundant — you had to create a series there before you could pick it on the sermon form.

**`admin/sermons.html`**
- Series field changed from a read-only `<select>` (existing series only) to a **type-to-search text input backed by a `<datalist>`**. Pick an existing series or type a new name — it's created automatically on save via `resolveSeriesId()` (case/whitespace-insensitive match to avoid accidental duplicates; new docs get the next `order`).
- New collapsible **"Manage Series" panel** (header button) for the occasional tasks that can't live on a single sermon: set a **cover image** (uploaded + compressed to `series/{id}/cover.jpg`), edit **title/description** (inline, save on blur — renaming fixes every sermon at once since they reference the series by ID), **drag-and-drop reorder** (reuses the story-gallery drag pattern; writes `order` from final DOM position), and **delete**.
- `loadSeriesDropdown()` → `loadSeries()` (loads full series docs, single-field `orderBy('order')` + client-side title tiebreaker, so no composite index is needed).

**`js/sermons.js` (public)**
- Series query drops the `published` filter (the flag is gone). A series now appears on the public Series tab **only if it contains at least one published sermon** — empty/draft series simply don't render.

**Removed**
- `/admin/series.html` (deleted) + its admin dashboard card.
- The series `published` checkbox and the numeric "Sort Order" field (replaced by drag-and-drop).
- The `series (published, order)` composite index from `firestore.indexes.json` (no longer used).

**`storage.rules`**
- Added `match /series/{seriesId}/{fileName}` — public read, admin write (image only) — for series cover uploads.

**`service-worker.js`**
- Removed `/admin/series.html` from precache; cache v45 → v46.

### Verification
- Inline-script syntax checked. End-to-end browser test (Playwright, Firebase stubbed in-memory) — 11/11 behavioural checks pass, no page errors: datalist populated from existing series; Manage panel rows + accurate sermon counts; typing a new series name auto-creates it with the next order and links the sermon; case/space variant reuses the existing series (no duplicate); rename persists; drag-reorder writes `order` from final DOM order.

### Still pending (manual after merge — CI deploys Hosting only)
- `firebase deploy --only storage` — new series cover rule.
- `firebase deploy --only firestore:indexes` — removes the now-unused series index.

---

## Session: review — End-to-end bug & security pass (Session 90)

**Date:** 2026-06-21
**Branch:** `fix/prayer-rules-and-security-hardening` (PR pending)
**Status:** Open

### What was done

A full end-to-end review of security rules, Cloud Functions, auth guards, and client render paths. Findings and fixes:

- **Prayer "Praying" button broken for non-authors (functional bug):** `members/prayer.html` shows the `prayedFor` toggle to every member, but `firestore.rules` only allowed the author/moderator to update `prayedFor`, so the write was denied (and the error swallowed) for everyone else. Added a member-only `prayedFor`-only update branch (mirrors the events-RSVP rule).
- **Members couldn't delete their own prayer requests (functional bug):** delete was moderator-only despite the UI showing a delete button on own requests. `allow delete` now also permits `isOwner(resource.data.uid)`.
- **Prayer authorship spoofing (hardening):** `prayer` create now requires `request.resource.data.uid == request.auth.uid`.
- **Unvalidated public `connect` create (hardening):** the only unauthenticated write (triggers admin email + notifications) was `allow create: if true`. Now validates allowed keys, bounds name/email/message sizes, and requires `read == false`. Matches `js/connect.js` exactly.
- **`member-auth.js` Firestore-readiness race:** guard now waits for `firebase.firestore` like `admin-auth.js` does (per CLAUDE.md constraint).
- **`main.js` top-level `enablePersistence()`:** added `firebase.firestore` guard so it can't throw and halt nav/SW registration on a page where the SDK isn't ready.
- **`.gitignore` secret-leak gap:** `functions/.env.egc-church` (Firebase project-specific params env, where the Resend key would live) was untracked but not ignored on a public repo. Added `.env.*` while preserving the tracked `functions/.env` defaults via `!functions/.env`. (File was empty — nothing leaked.)

Reviewed and found OK: XSS escaping across all user-controlled renders, Cloud Function permission gates, composite indexes vs live queries, SW cache list.

### Verification

Added 9 rules tests (prayer `prayedFor`/delete/spoofing; connect read-flag/size/extra-field). Full suite run against the Firestore emulator: **70 passing**. `node -c` clean on both modified JS files.

### Still pending

- **`firebase deploy --only firestore:rules` must be run manually after merge** — the prayer and connect rule fixes do not take effect until then (CI deploys Hosting only).

---

## Session: fix — Missing series Firestore index breaking public sermons page; Publish Immediately on import (Session 89)

**Date:** 2026-06-21
**Branches:** `fix/missing-series-index-and-resilience` (PR #141), `fix/conversations-index-drift` (PR #142), `feat/publish-on-import` (PR #143)
**Status:** Merged

### What was done

Triggered by the first real end-to-end use of the new import feature: the user imported and published a sermon via `admin/sermons.html` but it didn't appear on `/sermons.html` (it did show correctly on the homepage's separate "Latest Sermons" widget).

**Diagnosis**
- Verified the sermon document itself first, using the `sermons` collection's public `allow read: if true` rule (an unauthenticated REST read, not an admin-privileged one) — `published: true`, valid `date`, all fields correct. Ruled out a data problem before chasing anything else.
- `js/sermons.js`'s `loadSermons()` fetches `sermons` and `series` together via `Promise.all`. Replicated the exact `series` query (`where('published','==',true).orderBy('order')`) against the Firestore REST `runQuery` endpoint and got `FAILED_PRECONDITION: The query requires an index` — `firestore.indexes.json` never had a composite index for `series`. Since `Promise.all` rejects as a whole when either promise rejects, the *entire* sermons list (not just the series tab) was being replaced with "Unable to load sermons." This has been broken since the series feature shipped (PR #106, 2026-06-14) — nobody noticed because the `sermons` collection had no real content to visibly miss until this session's import.
- User independently hit the same `FAILED_PRECONDITION` in their own browser console, with an identical `create_composite` link — confirmed the diagnosis matched reality exactly.

**PR #141 — fix**
- Added the missing `series` composite index to `firestore.indexes.json`
- Hardened `loadSermons()` so a `series` failure only empties the series tab instead of taking sermons down with it too
- Hardened `groupByMonthYear()` (extracted `monthYearKey()`) so a blank/missing sermon `date` — possible from an unedited YouTube-import row whose title didn't match any of the four parser formats — groups under "Undated" instead of throwing and blanking the list

**PR #142 — fix (discovered while deploying #141)**
- `firebase deploy --only firestore:indexes` aborted with `HTTP 409: index already exists` on `conversations`, before ever reaching the new `series` entry. Root cause: `firestore.indexes.json` was missing the explicit `__name__` tiebreaker field on the `conversations` (`groupId`/`type`) and `users` (`membership`/`directoryVisible`) indexes, even though the live indexes already have it — pure pre-existing drift, unrelated to anything else this session. Deploy processes entries in file order and stops at the first mismatch, so this silently blocked the real fix until found and corrected.
- After merging this, `firebase deploy --only firestore:indexes` completed cleanly; the new index took a few minutes to finish building, then the `series` query (and the public sermons page) started working — confirmed via the same `runQuery` replication.

**PR #143 — feature request**
- User: "I want a way to directly publish from the admin/sermons import from YouTube, I don't want to have to edit an individual video to publish it."
- Added a "Publish immediately" checkbox next to "Select all" in the import results header. Unchecked by default (preserves the existing draft-first behavior); when checked, the batch write sets `published: true` for every selected row instead of `false`. Resets to unchecked each time "Load Videos" runs.

### Verification
PR #141/#142: `node -c` + isolated logic tests for `monthYearKey()`/`groupByMonthYear()` against valid/blank/undefined dates; confirmed via the Firestore REST API that the `conversations`/`users` fixes matched the live index state exactly before merging. PR #143: end-to-end browser test (Playwright, Firebase stubbed) confirming the checkbox's unchecked/checked states write `published: false`/`true` respectively and reset correctly between loads.

### Notes
- The blocked-permission system correctly stopped a direct Firebase Admin SDK query against production Firestore and a raw GCP access-token print; both were resolved by asking the user directly (approved the read) or by using the collection's own public read rule instead of privileged credentials. Worth remembering: this collection is public-read, so diagnosing data issues here doesn't need admin credentials at all.

---

## Session: fix — Remove Monthly Playlist import, exclude audio-duplicate uploads (Session 88)

**Date:** 2026-06-21
**Branch:** `feat/simplify-youtube-import-exclude-audio` (PR #140)
**Status:** Open

### What was done

Two user-reported refinements to the just-shipped YouTube bulk import (Part 2):

1. **Removed the "Monthly Playlist" tab/mode entirely.** Turned out not useful in practice, and the underlying `playlists.list?channelId=` call has a known YouTube API inconsistency — it can return `channelNotFound` even though `channels.list`/`playlistItems.list` succeed for the identical channel ([googleapis/google-api-php-client#2026](https://github.com/googleapis/google-api-php-client/issues/2026)), which is exactly the bug fixed in PR #139 earlier today. Removing the feature makes that fix dead code, so it went too.
   - `admin/sermons.html`: dropped the tabs UI and playlist picker; the panel is now just a single "Load Videos" button + results table (previously the "All Videos" tab content, unwrapped)
   - `functions/index.js`: `fetchYouTubeVideos` no longer takes a `mode`/`playlistId` — it always resolves the channel's uploads playlist and pages through it. Deleted `fetchAllPlaylists` and the `channelNotFound`-handling code from PR #139 along with it

2. **Excludes audio-only stream duplicates from import results.** Every service gets uploaded as two YouTube videos — the real one and a black-screen, lowest-bitrate "audio" version for low-bandwidth viewers. The audio duplicate's title always contains "Audio" or "Aud" as a standalone word (confirmed with real examples: `25-0615E Audio - Br Tim Dodd - Human Weakness`, `26-0617W Aud - Br Danie Poolman - ...`, `Br. Danie Poolman - Sunday Morning- 2025-06-08 (Audio Stream)`). Added `isAudioVariant()` (`\baud(io)?\b`, case-insensitive, word-bounded so it doesn't false-positive on words like "applaud" or "audience") and filter videos through it in `appendImportRows()` before they're parsed or rendered.
   - This also clarified that the "Current" title format's `Aud` marker — previously assumed in the Part 2 spec to mean "Auditorium" and silently skipped during parsing — actually means "Audio" and signals the whole video should be excluded, not just have one word stripped. Updated `parseSermonTitle()`'s comment accordingly; the regex's optional `(?:Aud(?:io)?)?` group stays as a harmless fallback in case a row somehow slips past the filter.

Also updated `docs/ROADMAP.md` to mark the full Sermon Management & YouTube Integration plan (Parts 1–3, all merged) as Done, with a condensed summary replacing the original pre-implementation spec, and folded in the post-launch fixes (PRs #136–139).

### Verification
`node -c` + isolated `require()` load test + `npm test` (16 tests) on `functions/index.js`. Unit-tested `isAudioVariant()` against the three real audio-duplicate examples plus a real (non-audio) title and two false-positive guards ("applauding", "Audience Engagement") — all correct. End-to-end browser test (Playwright, Firebase stubbed) confirmed: the panel has no tabs/playlist picker, "Load Videos" returns only the 2 real videos out of 5 mocked (3 audio duplicates correctly filtered), and Load More appends page 2 without reintroducing any duplicates.

### Still pending
- `firebase deploy --only functions` after merge (functions/index.js changed)

---

## Session: feat — YouTube write-back for sermon admin (Session 87)

**Date:** 2026-06-21
**Branch:** `feat/youtube-write-back` (PR #135)
**Status:** Open

### What was done

Part 3 (final part) of the YouTube Sermon Management plan (`docs/ROADMAP.md`). Depends on Parts 1 (PR #133) and 2 (PR #134), both merged.

**New permission `youtube.update`**
- Added to `ALL_PERMISSIONS` in `functions/rolesData.js` and to the checkbox list/labels in `admin/roles.html`; documented in `docs/PERMISSIONS.md` with a note that it's unusual — it gates a client-side OAuth feature, not a Firestore/Storage rule
- Not bundled into any default role except `administrator` (which spreads `ALL_PERMISSIONS`) — meant to be granted individually to trusted volunteers who also hold YouTube channel-manager access
- **No functions redeploy needed** — `ALL_PERMISSIONS` only feeds the already-run `migrateRolesV1` migration and the non-deployed manual `seedRoles.js` script. A superadmin must manually check "YouTube Push" on the relevant role(s) from `/admin/roles.html` once Hosting deploys — existing role docs in Firestore don't pick up new keys automatically

**`admin/sermons.html`**
- "Connect YouTube" header button, visible only with `youtube.update`
- "Push to YouTube" button per sermon card, visible only with the permission *and* the sermon having a `youtubeId`
- Push fetches the video's current `snippet` via `videos.list`, merges in the website's `title` and a built `description` (speaker/scripture/series/description), then calls `videos.update` — sending only title/description without the rest of the snippet would otherwise strip `categoryId`/`tags`/etc., a `videos.update` API quirk
- OAuth token lives in a page-scope variable only (never `localStorage`/Firestore), expires ~1hr; pushing with an expired/missing token shows a reconnect toast instead of attempting a doomed call

**Deliberate deviation from the roadmap doc:** it specifies `firebase.auth().signInWithPopup(GoogleAuthProvider)` for "Connect YouTube". That call replaces the admin's *active* Firebase session with whichever Google account is picked in the popup — a mismatch would silently swap who's signed into the site mid-session. Implemented with `linkWithPopup` (first connect) / `reauthenticateWithPopup` (subsequent connects) on the signed-in admin's own `currentUser` instead — same OAuth token and scope, but Firebase rejects the popup if the chosen account's email doesn't match the admin's own, so it can't hijack the session. Confirmed this approach with the user before implementing.

**Scope decision:** skipped the roadmap doc's mention of a *batch* "Push to YouTube" action "on selected sermons in the import table" — that table holds videos not yet imported into Firestore, so batch-pushing doesn't apply there; read as a likely drafting artifact rather than a clear requirement. Implemented the unambiguous per-sermon push only.

### Verification
`npm test` (`tests/syncUserClaims.test.js`, 16 tests) unaffected. Then verified end-to-end in a real headless browser (Playwright) with Firebase auth/firestore/functions stubbed (no live Google OAuth available in this environment): Connect button correctly gated on `youtube.update` (visible for superadmin, hidden for a `sermons.manage`-only user); first connect calls `linkWithPopup` with the `youtube.force-ssl` scope, a second call correctly switches to `reauthenticateWithPopup`; Push button renders only on the sermon with a `youtubeId`; pushing does GET-then-PUT against the YouTube videos endpoint with `categoryId`/`tags`/`channelId` preserved from the original video alongside the new title/description; an expired/missing token shows the reconnect toast and makes no network call.

### Still pending
- This closes out all three parts of the YouTube Sermon Management plan once merged
- Possible follow-up if requested: a batch "Push to YouTube" picker on the sermon list itself (see scope decision above)

---

## Session: feat — YouTube bulk import panel for sermon admin (Session 86)

**Date:** 2026-06-21
**Branch:** `feat/youtube-bulk-import` (PR #134)
**Status:** Open

### What was done

Part 2 of the YouTube Sermon Management plan (`docs/ROADMAP.md`). Depends on Part 1 (PR #133, merged).

**`functions/index.js`**
- Added callable `fetchYouTubeVideos` — requires `sermons.manage` (same gate as the admin page), reuses the existing `functions.config().youtube.apikey` / `.channelid` (set for the PR #112 live-stream feature) so the API key never reaches the browser
- `mode: 'playlists'` loops internally over all pages and returns every playlist on the channel (`playlists.list` is 1 quota unit/call, cheap enough to fetch in full)
- `mode: 'playlist'` / `'channel'` return one page of videos from the given playlist or the channel's uploads playlist (resolved via `channels.list`), with `nextPageToken` for pagination

**`admin/sermons.html`**
- Added `firebase-functions-compat.js` and an "Import from YouTube" panel next to "Add Sermon"
- Two tabs: **Monthly Playlist** (load playlists → pick one → its videos) and **All Videos** (paginated channel uploads) — switching tabs resets the results table so the two browsing modes never mix
- `parseSermonTitle()` handles all four documented historical title formats (current `YY-MMDD[letter] Aud - Speaker - Title`, mid-era A `Title - Speaker (Day YYYY-MM-DD)`, mid-era B `EGC Day Group YY-MM-DD - notes`, old `EGC Day YYYY-MM-DD`); the old (4-digit year) format is checked before mid-era B's 2-digit-year pattern, since the latter's lazy "group word" capture would otherwise misparse a 4-digit year by splitting it across the group and year captures. Unrecognised titles fall back to the full raw string with date/speaker left blank for manual edit
- Each result row is editable (date/service/title/speaker) before import — built with `createElement` + `.value` assignment rather than `innerHTML`, so arbitrary YouTube title text (quotes, apostrophes, HTML-looking characters) can't break the row
- Videos whose `youtubeId` already exists in Firestore are greyed out, checkbox disabled, labelled "Already imported" — checked against the sermon list already loaded by the page, no extra query
- "Load More" appends new rows without rebuilding existing ones, so in-progress edits to already-loaded rows are never lost
- "Import Selected" reads the (possibly hand-edited) live DOM values and batch-writes them as `published: false` drafts for the admin to review before publishing

### Verification
Unit-checked `parseSermonTitle()` directly against all four documented formats plus an unrecognised-title fallback — all correct, including the deliberately-tested year-format collision between the two EGC-prefixed formats. Then verified end-to-end in a real headless browser (Playwright) against the actual file, with only the Firebase SDK boundary mocked (auth/firestore/storage/functions stubbed; no live admin credentials or YouTube API access available) — confirmed: panel open/close, mocked playlist loading and selection, parsed rows with one already-imported (disabled) and one new (editable), editing a title before import, batch-import flipping the row to "Already imported", the no-selection error toast (no native `alert()`), tab-switch correctly resetting results, and Load More appending page 2 without dropping page 1's rows.

### Still pending
- `firebase deploy --only functions` must be run manually after this PR merges (CI's `deploy.yml` only deploys Hosting)
- Part 3 (YouTube write-back) of the roadmap plan is not started

---

## Session: feat — Sermon admin upload fields, YouTube parsing, toasts (Session 85)

**Date:** 2026-06-21
**Branch:** `feat/admin-sermons-upload-fields` (PR #133)
**Status:** Open

### What was done

**`admin/sermons.html`** — Part 1 of the YouTube Sermon Management plan (`docs/ROADMAP.md`)
- Added `description` (textarea), `scripture`, and `service` (free text) fields
- YouTube field now accepts a full URL or bare ID — pasting a URL (`youtube.com/watch`, `youtu.be/`, `/embed/`, `/shorts/`) strips it to the bare 11-char video ID and shows an inline thumbnail preview (`img.youtube.com/vi/{id}/hqdefault.jpg`). Stripping only happens on the `paste` event — `oninput` just toggles the thumbnail — so ordinary typing/editing of the field isn't touched
- Audio (MP3) and PDF notes are now real file pickers instead of plain text URL inputs — uploaded via `uploadMedia()` to `sermons/{sermonId}/audio.mp3` and `sermons/{sermonId}/notes.pdf`; editing a sermon shows the existing file as a link with a Remove option; removing + saving deletes the old Storage object and clears the field
- Added `firebase-storage-compat.js` and `/js/storage-upload.js` to the page (previously missing)
- All `alert()` calls replaced with the toast pattern used elsewhere in admin
- Switched sermon list rendering from inline `onclick="openForm(${JSON.stringify(s)}, ...)"` to a `sermonsCache` + `openForm(id)` lookup (same pattern as `admin/gallery.html`) — the old approach silently dropped the Edit/Delete handlers for any sermon whose title/speaker/description contained an apostrophe, since the JSON-encoded string closed the single-quoted `onclick` attribute early. This was latent before (title/speaker) and would have become much more likely to bite with the new free-text description/scripture fields
- `deleteSermon` now also cleans up the sermon's audio/notes files from Storage (it didn't before, because before this PR those fields were never real Storage uploads)

**`storage.rules`**
- Fixed sermon audio/notes rules to match the path structure CLAUDE.md documents and the form now uses. The old rules (`match /sermons/{fileName}` and `match /sermon-notes/{fileName}`) only matched single-segment paths and would have rejected every upload to `sermons/{sermonId}/audio.mp3` / `sermons/{sermonId}/notes.pdf` with permission-denied. Replaced with a single `match /sermons/{sermonId}/{fileName}` rule accepting either audio or PDF content type.

### Verification
No live admin credentials were available this session, so the page was driven end-to-end in a real headless browser (Playwright) against the actual file, with only the Firebase SDK boundary mocked (auth/firestore/storage stubbed via an injected init script; real CDN scripts blocked) — all DOM/JS logic in `admin/sermons.html` ran unmodified. Confirmed: edit-form field population, toast-based validation (no native `alert()`), YouTube paste-to-ID stripping + thumbnail, audio/PDF staging and upload calls with correct Storage paths, remove-existing-file + cleanup on save, delete confirm/cancel behavior, and the apostrophe-safety fix. Found and fixed one real bug during this verification pass: the original `oninput`-based YouTube parsing rewrote the field on every keystroke, which silently ate spaces and corrupted in-progress typing — moved the URL-stripping logic to the `paste` event only.

### Still pending
- `firebase deploy --only storage` must be run manually after this PR merges (CI's `deploy.yml` only deploys Hosting) — otherwise the rule fix won't take effect and uploads will keep failing with permission-denied
- Parts 2 (YouTube bulk import) and 3 (YouTube write-back) of the roadmap plan are not started

---

## Session: feat — Lightbox viewer and drag-to-reorder for story gallery (Session 84)

**Date:** 2026-06-17
**Branch:** `feat/story-gallery-lightbox-reorder` (PR #129)
**Status:** Merged

### What was done

**`admin/blog.html`**
- Click any story gallery thumbnail to open a full-screen lightbox overlay
- Lightbox shows the full-resolution image with a counter (e.g. "3 / 8")
- Prev/Next buttons and keyboard navigation (←/→ arrows, Esc to close)
- "Remove" button inside the lightbox removes the photo from the gallery (same effect as the X thumbnail button) — useful when thumbnails are too small to judge quality
- Drag-and-drop reordering of gallery thumbnails — drag any photo to a new position; the save order reflects the final DOM order
- `isDragging` flag prevents the drag-release from triggering the click-to-lightbox handler
- Save logic updated to walk the `#gallery-preview` DOM in order (using `data-gallery-key`) so reordered positions are preserved in Firestore

### Notes / decisions
- Lightbox `lightboxItems[]` snapshot is taken at open time; `removeLightboxItem()` syncs both the DOM and the array so indices stay correct during multi-remove sessions
- DOM-as-truth pattern: instead of maintaining separate arrays with correct order, the save walks `#gallery-preview` children and decodes each item's `data-gallery-key` to build `galleryUrls`
- No new CDN dependencies

---

## Session: fix — Quill rich text editor overlapping form fields on story edit (Session 83)

**Date:** 2026-06-17
**Branch:** `fix/story-quill-editor-overlap` (PR #128)
**Status:** Merged

### What was done

**`admin/blog.html`**
- `.ql-container.ql-snow` style override: added `height: auto` so the editor container does not collapse in CSS grid and `.ql-editor`'s `min-height: 180px` no longer overflows into the Author / Publish Date row

### Root cause
Quill 1.3.7 sets `.ql-container { height: 100% }`. In a CSS grid with no explicit row height the parent resolves to 0px, causing the container to collapse; the editor's `min-height: 180px` then overflows and overlaps the next grid row.

---

## Session: feat — Gallery picker and X button fix for story photos (Sessions 81–82)

**Date:** 2026-06-17
**Branch:** `fix/story-gallery-x-button` (PR #125), `feat/story-gallery-picker` (PR #126)
**Status:** Merged

### What was done

**X button fix (`admin/blog.html`, PR #125)**
- `renderGalleryThumbnail` rebuilt with `createElement` + `addEventListener` instead of `innerHTML` + inline `onclick`
- Root cause: `JSON.stringify(url)` produces a double-quoted string that closes the `onclick="..."` HTML attribute early, silently dropping the handler
- `removeGalleryItem` now receives the wrapper `div` directly (no `.closest()` needed)
- `isStoryOwnedUrl(url)` helper: checks Firebase Storage path prefix (`blog/` = story-owned, `gallery/` = borrowed) so only story-owned files are deleted from Storage when a story is deleted

**Gallery picker (`admin/blog.html`, PR #126)**
- "From Gallery" button opens a modal listing all published photo galleries
- Click a gallery to expand its photos; click a photo to toggle selection (pre-checks already-added photos)
- Selected gallery photos are added to the story's photo list as URL references — no re-upload, no Storage duplication
- Borrowed gallery photos are excluded from Storage deletion when a story is deleted (guarded by `isStoryOwnedUrl()`)
- Thumbnail height bumped from `h-20` to `h-24` for better visibility

---

## Session: feat — Image compression for gallery and story uploads (Sessions 79–80)

**Date:** 2026-06-17
**Branch:** `feat/gallery-image-compression` (PR #122), `feat/story-gallery-compression` (PR #123)
**Status:** Merged

### What was done

Added client-side image compression using the native Canvas API — no new CDN dependencies.

**`js/storage-upload.js`**
- Added `compressImage(file, maxPx = 1920, quality = 0.85)` — resizes to 1920px max on longest side, re-encodes as JPEG at 85% quality; returns a Blob
- `uploadMedia()` now accepts `File | Blob` so compressed blobs upload transparently

**`admin/gallery.html`**
- Added "High resolution (no compression)" checkbox inline next to the file picker — unchecked by default
- Checkbox resets to unchecked after each save

**`admin/blog.html`**
- Story cover photo is always compressed (display-only hero, not a download target)
- Story gallery photos get the same "High resolution (no compression)" checkbox next to "Add Photos"
- Hi-res flag is captured per batch at file-selection time and stored on each staged item — different batches within the same save can have different quality settings
- Checkbox auto-resets after each batch

### Notes / decisions
- Compression is purely client-side — no server changes, no Cloud Function, no new CDN dependencies
- Typical savings: 5MB phone photo → ~300KB at 1920px / JPEG 85%
- Hi-res option retained for use cases where downloads matter (banquets, portraits)
- Cover photo on stories is always compressed — consistent display quality, no admin decision needed

---

## Session: feat — Multi-source video gallery for stories (Session 76)

**Date:** 2026-06-17
**Branch:** `feat/story-multi-video` (PR #118)
**Status:** Merged

### What was done

Extended story posts to support multiple videos from any source — YouTube, S3, R2, or any direct video URL.

**`admin/blog.html`**
- Replaced the single YouTube ID field with a dynamic multi-video list
- Each row has a URL/ID field and an optional title field (e.g. "Sunday Message", "Camp Highlights")
- "Add Video" button appends a new row; × removes it
- Accepts: full YouTube URLs, raw YouTube video IDs, or any direct `https://` link
- `openForm()` migrates legacy `videoId` string into the list automatically on edit
- `savePost()` collects rows into `videos: [{ url, title }]` and nulls out legacy `videoId`

**`story.html`**
- `parseVideoUrl(raw)` detects YouTube (full URL, youtu.be, embed URL, or raw 11-char ID) vs direct URL
- Video section renders as a thumbnail grid (1–2 cols)
  - YouTube: real thumbnail from `img.youtube.com/vi/{id}/hqdefault.jpg` with YouTube play icon
  - Direct video: dark card with play icon
- Clicking any thumbnail opens a full-width 16:9 video modal
  - YouTube → autoplay iframe; direct URL → HTML5 `<video>` with native controls
- Modal closes on Escape, backdrop click, or ×
- Backward compatible with legacy `videoId` field
- SW cache bumped v42 → v43

### Notes / decisions
- `parseVideoUrl` handles all common YouTube URL formats plus raw IDs
- YouTube thumbnails from YouTube CDN — no API key required
- `videos` and `videoId` coexist in Firestore; new saves always write `videos` and null `videoId`

---

## Session: feat — Story post type (Session 75)

**Date:** 2026-06-17
**Branch:** `feat/story-posts` (PR #117)
**Status:** Merged

### What was done

Added a "Story" post type to the blog — purpose-built for photo reports of church activities (youth camps, outreach, missionary trips). Stories are a third `kind` value alongside existing `announcement` and `article`.

**`admin/blog.html`**
- Added Story radio option to the Type selector with description
- When Story is selected: Quill rich text editor replaces the plain textarea; cover photo file upload replaces the URL field; story-specific fields appear (YouTube video ID + multi-photo gallery picker)
- When Announcement/Article is selected: existing textarea and URL field behaviour unchanged
- Quill 1.3.7 loaded from CDN (only on this admin page) — toolbar covers headings, bold/italic/underline, lists, links
- Gallery picker: select multiple photos at once; staged thumbnails shown with individual remove buttons; uploads happen on save
- Cover image uploaded to `blog/{docId}/cover` in Firebase Storage
- Gallery images uploaded to `blog/{docId}/gallery/{timestamp}_{index}_{name}`
- `savePost()` made async — uploads cover and gallery in sequence before Firestore write, with live progress indicator ("Uploading cover photo...", "Uploading N photos...", "Saving post...")
- Story list rows show cover image thumbnail, emerald "Story" badge, video/photo count indicators
- `deletePost()` cleans up Storage files (cover + gallery) when a story is deleted
- Added `firebase-storage-compat.js` and `storage-upload.js` to admin/blog.html

**`blog.html`**
- Added "Stories" filter chip alongside All / Announcements / Articles

**`js/blog.js`**
- Story cards rendered differently from standard cards: taller cover image (h-56), emerald "Story" badge overlay, video/photo count indicators, "Read story →" link — entire card is an anchor to `/story.html?id=xxx`
- Standard card rendering unchanged

**`story.html`** (new public page)
- Reads `?id=` query param, loads `blog/{id}` doc; shows error if not found or not a story
- Layout: full-width hero image, back link, meta (Story badge + date + author), title, rich text body, YouTube embed (responsive 16:9 iframe), photo gallery grid
- Photo gallery: 2–3 column responsive grid; clicking any photo opens a lightbox overlay with prev/next navigation, keyboard (← → Esc) support
- Rich text body rendered via `innerHTML` (admin-only writes, Firestore security rules enforced)
- CSS prose styles for Quill HTML output (h2, h3, p, ul, ol, strong, em, a, blockquote)

**`storage.rules`**
- Added `match /blog/{postId}/{allPaths=**}` rule: public read, admin write — covers both cover images and gallery images at any nesting depth under a blog post

**`service-worker.js`**
- Added `/story.html` to precache list
- Cache bumped v41 → v42

### Deploy checklist
- `firebase deploy --only storage` — new storage rule for blog nested paths

### Notes / decisions
- Quill 1.3.7 is admin-only (loaded only on admin/blog.html) — no impact on public page bundle
- `kind: 'story'` is a new value in the existing `/blog/{postId}` collection — no schema migration needed, no new Firestore collection
- Story body stored as Quill HTML; rendered with `innerHTML` on story.html — safe because only users with `blog.manage` custom claim can write to the blog collection (enforced by Firestore rules, not just the admin UI)
- Cover image for stories is required on save; URL field shown for announcement/article only
- Gallery item removal during edit: existing URLs are tracked separately from staged files; save writes the surviving set

---

## Session: fix — YouTube polling service-window gate (Session 74)

**Date:** 2026-06-17
**Branch:** `fix/youtube-service-window-polling` (PR #116)
**Status:** Merged

### What was done

- `checkYoutubeLiveStatus` updated to read `serviceTimes` from `/homepage/content` before calling the YouTube API
- Added `isInServiceWindow(serviceTimes)` and `parseTime12(timeStr)` helpers — SAST (UTC+2, no DST) day + minute comparison against each service entry
- Function now skips the YouTube API call entirely outside service windows (30 min before start → 3 hours after start); logs "outside service window, skipping"
- Saves the separate Firestore read that was previously done later (homepage content fetched once and reused)
- Updated `docs/ROADMAP.md` quota note to reflect service-window-only polling (~800 units per service day vs 4,800 previously)
- Added "discussion must conclude before coding" constraint to `CLAUDE.md` Constraints & Rules
- Updated memory: `feedback-wait-for-go-ahead.md`

### Deploy checklist
- `firebase deploy --only functions` — required after merge

---

## Session: backlog — YouTube auto-detect, content search, roadmap cleanup (Session 73)

**Date:** 2026-06-14
**Branches:** `chore/update-roadmap-phases` (PR #112), `feat/youtube-livestream-autodetect` (PR #113), `feat/content-search` (PR #114)
**Status:** Merged

### What was done

**ROADMAP.md update (PR #112)**
- Marked Phase 8 and Phase 9 as Done in ROADMAP.md (were still showing "Not started")
- Added YouTube auto-detection and content search entries
- Moved Tailwind CDN → compiled CSS to "Out of Scope" (build step prohibited; dynamic JS classes can't be statically scanned)

**YouTube live stream auto-detection (PR #113)**
- `checkYoutubeLiveStatus` Cloud Function — scheduled every 5 minutes; calls YouTube Data API v3 `search.list` with `eventType=live, type=video`; if a live broadcast is found, sets `/homepage/content` liveStream to `active: true` with the `youtubeId`; if not, sets `active: false`
- Reads `youtube.apikey` and `youtube.channelid` from Firebase Functions config
- Skips update if live status hasn't changed (avoids unnecessary writes)
- Admin UI note on `/admin/homepage.html` explaining auto-detection is active
- To activate: `firebase functions:config:set youtube.apikey="YOUR_KEY" youtube.channelid="UCxxxxxxxx"` then `firebase deploy --only functions`

**Global content search (PR #114)**
- Search overlay triggered by `/` key, `Ctrl+K`/`⌘K`, or nav magnifier icon
- Fetches published sermons, events, and blog posts from Firestore on first open (cached for session)
- Client-side fuzzy match on title, speaker, author, description
- Results grouped by type with icons, keyboard navigable (↑↓ arrows, Enter, Esc)
- Clicking a result navigates to the correct page/anchor
- Works on all public pages via `js/search.js` loaded in `js/main.js`

---

## Session: chore — sync firestore.indexes.json with production (Session 72)

**Date:** 2026-06-14
**Branch:** `chore/sync-firestore-indexes` (PR #109)
**Status:** Merged

### What was done

- Added missing `blog (published ASC, publishedAt DESC)` composite index to `firestore.indexes.json`
- This index existed in production (auto-created by Firestore) but was absent from the local file, causing `firebase deploy --only firestore:indexes` to offer to delete it
- Local file now matches production — future index deploys will not prompt about this index

### Deploy checklist (manual — still outstanding from sessions 70–71)
- `firebase deploy --only firestore:rules` — RSVP rule change (PR #105)
- `firebase deploy --only functions` — welcomeNewMember (PR #103)
- `firebase deploy --only firestore:indexes` — group chat index + blog index

---

## Session: backlog — event RSVP, sermon series, offline persistence, group chat (Session 71)

**Date:** 2026-06-14
**Branches:** `feat/event-rsvp` (PR #105), `feat/sermon-series` (PR #106), `feat/offline-persistence` (PR #107), `feat/group-chat` (PR #108)
**Status:** Merged (deploy steps pending)

### What was done

**Event RSVP (PR #105)**
- `firestore.rules` — events rule split: create/delete restricted to `events.manage`; update allows members to change only `rsvps` field
- `js/events.js` — tracks auth state + membership; RSVP count shown to all visitors; RSVP toggle button shown to members on upcoming events; local card refresh after toggle
- `admin/events.html` — RSVP count badge on each event row; "RSVPs" button expands inline panel with member name lookup
- 4 new security rule tests for RSVP: member can update rsvps, member cannot update title, unauth denied, editor can update title

**Sermon Series (PR #106)**
- New `/series/{seriesId}` Firestore collection (public read, `sermons.manage` write)
- `/admin/series.html` — create/edit/delete series, image + sort order + published toggle
- `/admin/sermons.html` — series picker dropdown + part number; series badge in sermon list
- `/sermons.html` + `js/sermons.js` — "Series" view tab; grid of series cards; drill-down to series sermon list ordered by `seriesOrder`
- `admin/index.html` — "Sermon Series" dashboard card (indigo)
- `service-worker.js` — cache v39 → v40, added `/admin/series.html`

**Offline Persistence (PR #107)**
- `js/main.js` — `firebase.firestore().enablePersistence({ synchronizeTabs: true })` at module scope; skipped on `/admin/*` pages; errors ignored silently

**Group Chat (PR #108)**
- `members/groups.html` — "Group Chat" button in leader section; `startGroupChat()` creates group conversation (idempotent) and navigates to messages page
- `js/messaging.js` — group convs show group name + indigo icon in list; sender name + avatar initial in thread; send stores `senderName`; marks ALL other participants unread
- `firestore.indexes.json` — composite index for `groupId + type` query

### Deploy checklist (manual after this session)
- `firebase deploy --only firestore:rules` — RSVP rule change
- `firebase deploy --only functions` — welcomeNewMember (PR #103)
- `firebase deploy --only firestore:indexes` — group chat index (PR #108)

---

## Session: backlog — prayer updates, member onboarding, email registration (Session 70)

**Date:** 2026-06-14
**Branches:** `feat/prayer-updates` (PR #102), `feat/member-onboarding` (PR #103)
**Status:** Merged (functions deploy pending)

### What was done

- **`members/prayer.html`** — filter tabs (All / Active / Answered / My Requests); mark-as-answered flow with inline testimony textarea; mark-as-active revert for own requests; answered badge + testimony display.
- **`admin/prayer.html`** — filter tabs (All / Active / Answered / Public / Private); admin status toggle for any request; answered badge + testimony display.
- **`firestore.rules`** — prayer rule tightened: author may only update `status`, `testimony`, `prayedFor`; moderators retain full update access.
- **`tests/firestore.rules.test.js`** — 4 new tests: author can update own status/testimony; author cannot update body; other member cannot update someone else's status; moderator can update any request.
- **`functions/index.js`** — new `welcomeNewMember` Firestore trigger: when `membership` changes to `'member'`, writes a welcome in-app notification to the user's notification subcollection.

### Notes / decisions

- Prayer status defaults to `'active'` on create; `null` status treated as active.
- Testimony field is optional — left empty, `confirmAnswered` passes `null`.
- `welcomeNewMember` is a separate trigger from `syncUserNotificationEligibility` for clarity — each function has a single clear responsibility.
- Cloud Functions need manual deploy: `firebase deploy --only functions`

---

## Session: fix requestMemberAccess role-based notify (Session 69)

**Date:** 2026-06-14
**Branch:** `fix/request-member-access-role-notify` (PR #99)
**Status:** Merged + deployed

### What was done

- **`functions/index.js`** — `requestMemberAccess` now correctly notifies users who hold `users.approve` via a role assignment, not just via `isSuperadmin` or `extraPermissions`.
- Fix: query `/roles` for docs whose `permissions` array contains `'users.approve'`, collect the role IDs, then add a third parallel users query using `array-contains-any` on the `roles` field. All three result sets merged into a `Set` for deduplication. Role query is guarded (`approveRoleIds.length > 0`) to avoid Firestore error on empty `array-contains-any`.
- Deployed manually: `firebase deploy --only functions`

### Notes / decisions

- `array-contains-any` supports up to 30 values — no practical limit risk at church scale
- Adds one extra Firestore read (the `/roles` query) per invocation — negligible
- This was the last Priority 1 backlog item from `docs/ROADMAP.md`

---

## Session: Phase 9 — page composition (Session 68)

**Date:** 2026-06-14
**Branches:** `feat/phase9-page-composition` (PR #96), `feat/phase9b-admin-pages-ui` (PR #97)
**Status:** Merged

### What was done

**9a — Foundation (PR #96)**

- **`js/main.js`** — `applySections(pageId)` added. Reads `/config/pages` Firestore doc (publicly readable), sorts sections by `order`, hides disabled `[data-section]` elements, reorders sections within `[data-sections-container]`; called on `nav-loaded` for all visitors
- **`index.html`** — restructured with `data-page-sections="homepage"` on `<body>`. Service times section tagged `data-section="serviceTimes"`. New `<div data-sections-container="homepage">` wraps three composable sections: `latestSermons`, `explore`, `connectCta`. `latestSermons` is a new section populated by `homepage.js`; `connectCta` is a new "Plan a visit" CTA banner.
- **`about.html`** — `data-page-sections="about"` on body. Both sections (mission + leadership) wrapped in `<div data-sections-container="about">` with `data-section` attributes.
- **`members/index.html`** — `data-page-sections="members"` on body. Grid gets `data-sections-container="members"`. Each card gets `data-section` + `data-feature` (Groups, Devotional, Gallery, LiveStream).
- **`js/homepage.js`** — `loadLatestSermons(3)` + `renderLatestSermons(sermons)` added. Populates `#latest-sermons-grid` with YouTube thumbnail, title, speaker, date for 3 most recent published sermons. Runs for all visitors (not gated behind auth).
- **`firestore.rules`** — `/config/{document}` rule updated: `allow read: if isSignedIn() || document == 'pages'` — makes section order publicly readable for unauthenticated visitors.
- **`service-worker.js`** — cache v37 → v38
- **`docs/PHASE9.md`** — full spec created

**9b — Admin UI (PR #97)**

- **`admin/pages.html`** — new superadmin-only page. Three tabs (Homepage, About, Members). Each section row shows: name, description, "Edit content" link, toggle switch (hero non-hideable), up/down reorder buttons. Changes save to `/config/pages` on every action with a "Saved" toast. Non-superadmins see an access-denied state.
- **`admin/index.html`** — "Page Layout" dashboard card added (teal icon, `data-superadmin` gate, hidden for non-superadmins)
- **`service-worker.js`** — `/admin/pages.html` added to precache; cache v38 → v39

### Notes / decisions

- `/config/pages` is a single Firestore doc (not subcollections): `{ homepage: { sections: [...] }, about: {...}, members: {...} }` — one write per tab update
- Hero section is excluded from toggle in the admin UI (non-hideable by design — removing it would break the page)
- `latestSermons` query uses `orderBy('date','desc')` — `date` is a string field (YYYY-MM-DD), so lexicographic sort is correct
- `members/index.html` dashboard cards now have both `data-section` (section composition) and `data-feature` (feature flags) — feature flags take precedence (hiding a feature also hides its card regardless of section config)
- Kept `upcomingEvents` out of the homepage composable sections (adaptive section already shows upcoming events for members; adding a public version would cause visible duplication)

---

## Session: Phase 8e template packaging (Session 67)

**Date:** 2026-06-14
**Branch:** `feat/phase8e-template-packaging` (PR #92)
**Status:** Merged

### What was done

- **`setup.ps1`** — Windows PowerShell setup script. Takes `-ChurchName`, `-ShortName`, and optional `-Domain` parameters. Replaces all EGC/Emmanuel Gospel Centre placeholder text in: HTML page titles, nav logo spans (`>EMMANUEL<` / `>GOSPEL CENTRE<`), `manifest.json` name/short_name/description, `church-config.js` name/shortName/domain, and the PWA install prompt in `js/main.js`. Uses `UTF8Encoding(false)` to preserve file encoding without BOM. Idempotent.
- **`setup.sh`** — Bash equivalent for Mac/Linux. Auto-detects BSD (`macOS`) vs GNU (`Linux`) `sed` for cross-platform in-place edits. Produces identical replacements.
- **`SETUP.md`** — 10-step new-church setup guide: Firebase project creation, Auth/Firestore/Storage/Hosting/Functions enablement, `firebase-config.js` replacement, running the setup script, editing `church-config.js`, setting Functions config vars, updating `.firebaserc`/`firebase.json`, `firebase deploy`, first superadmin via Firestore console, and completing branding/features via `/admin/settings`.
- **Repo marked as GitHub template** — `is_template: true` set via GitHub API. "Use this template" button now appears on the repo page.

### Notes / decisions

- Single-word church names (e.g. "Bethel") use the short name as the nav logo second line to avoid an empty span
- Script is a one-time utility, not a build tool — run once at fork time and never again
- `setup.sh` uses `cksum` to detect whether each file changed (prints "Updated" only for modified files)
- `setup.ps1` stores the UTF-8 no-BOM encoder in a variable and reuses it across all file writes
- No SW cache change needed — no new HTML pages added in this phase

---

## Session: Phase 8d feature flags (Session 66)

**Date:** 2026-06-13
**Branch:** `feat/phase8d-feature-flags` (PR #90)
**Status:** Merged

### What was done

- **`admin/settings.html`** — new Features section with 7 toggle switches (music, gallery, youthGallery, liveStream, messaging, groups, devotional); loads from `/config/features`; `saveFeatures()` writes the full flag set with `.set()` (not merge — full document is authoritative)
- **`js/main.js`** — `applyFeatures()` reads `/config/features` after auth: hides `[data-feature]` nav links for disabled features, hides `[data-feature-tab]` elements (e.g. Youth tab), redirects the current page to `/admin/` or `/members/` if `document.body.dataset.featureGate` is set and that feature is disabled
- **`nav.html`** — `data-feature="gallery"` and `data-feature="music"` on Gallery and Music links (desktop + mobile)
- **`members-nav.html`** — `data-feature` on Groups, Devotional, Gallery, Live Stream, Messages (desktop dropdown + mobile menu)
- **`admin-nav.html`** — `data-feature` on Gallery, Music, Groups, Devotional (desktop + mobile)
- **4 admin pages** (`music`, `gallery`, `groups`, `devotional`) — `data-feature-gate` added to `<body>` tag
- **5 member pages** (`live`, `messages`, `groups`, `devotional`, `gallery`) — `data-feature-gate` added to `<body>` tag
- **`members/gallery.html`** — `data-feature-tab="youthGallery"` on the Youth tab button (independent of main gallery flag)
- **`service-worker.js`** — cache v36 → v37

### Notes / decisions

- No `/config/features` Firestore doc needs to exist — missing doc means all features enabled (safe default, no action required for EGC)
- `saveFeatures()` uses `.set()` not `.set({ merge: true })` — the full 7-flag document is always written so the stored state exactly matches the UI
- Nav hiding applies to authenticated users only (Firestore `/config/` requires auth to read). Unauthenticated visitors see all nav items — acceptable since all EGC features are enabled
- Page-level `data-feature-gate` redirect fires after auth resolves — there is a brief flash of page content before redirect for disabled pages, consistent with the existing auth guard behaviour
- `applyFeatures()` called alongside `applyBranding()` in `updateLoginButtons(user)`

---

## Session: Phase 8c branding — colour pickers, logo upload, CSS vars (Session 65)

**Date:** 2026-06-12
**Branch:** `feat/phase8c-branding` (PR #89)
**Status:** Merged and deployed

### What was done

- **`assets/css/custom.css`** — new file with `--color-primary` (`#0A3D62`) and `--color-accent` (`#F59E0B`) CSS custom properties
- **`admin/settings.html`** — new Branding section: primary/accent colour inputs synced bidirectionally with `<input type="color">` pickers; logo upload with live preview; backed by `/config/branding`; added `firebase-storage-compat.js` and `storage-upload.js`
- **`js/main.js`** — `applyBranding()` reads `/config/branding` after auth, sets CSS vars on `:root`, swaps `#nav-logo-area` to a custom `<img>` when `logoUrl` is set
- **`nav.html` / `admin-nav.html` / `members-nav.html`** — `id="nav-logo-area"` on logo wrapper div in all three nav files
- **`storage.rules`** — `/branding/{fileName}` path: public read, superadmin-only write
- **`service-worker.js`** — cache v35 → v36; `/assets/css/custom.css` added to precache

### Notes / decisions

- Branding applies for authenticated users only — `/config/` requires auth to read
- Logo stored at `branding/logo` in Firebase Storage; uploading a new file overwrites the same path
- `firebase deploy --only storage` run after merge

---

## Session: Phase 8b admin settings UI (Session 64)

**Date:** 2026-06-12
**Branch:** `feat/phase8b-admin-settings-ui` (PR #87)
**Status:** Merged

### What was done

- Added `/admin/settings.html` — superadmin-only page with two independently saving sections:
  - **Church Info** → `/config/church`: display name, tagline, address, phone, email, Facebook/YouTube/Instagram social links
  - **Notifications** → `/config/notifications`: connect alert email
- Superadmin gate enforced both on the page (token claim check, shows access-denied card for non-superadmins) and on the admin dashboard (Settings card hidden via `data-superadmin` attribute)
- Added Settings card to `/admin/index.html`
- Bumped SW cache v34 → v35, added `/admin/settings.html` to precache list

### Notes / decisions

- Each section saves independently with its own Save button — no risk of wiping unsaved changes in another section on error
- Saving `connectAlertEmail` via the UI replaces the manually created Firestore doc from Phase 8a — same document, now editable from the admin UI as intended
- No new permission key needed — superadmin claim is the gate

---

## Session: Phase 8 design + Phase 8a config foundation (Session 63)

**Date:** 2026-06-12
**Branch:** `feat/phase8a-config-foundation` (PR #86)
**Status:** Merged and deployed

### What was done

**Phase 8 + Phase 9 designed**
Designed the full multi-church template architecture across two phases:
- Phase 8 — two-layer config (deploy-time `church-config.js` + runtime Firestore `/config/`), branding via CSS custom properties, one-time setup scripts, admin settings UI, GitHub template packaging
- Phase 9 — page composition / section manager (depends on Phase 8)
Documented in `docs/PHASE8.md`. `docs/ROADMAP.md` updated with both phases. `CLAUDE.md` updated with phase checklist.

**Phase 8a — config foundation (PR #86)**
- Added `/config/{document}` Firestore security rule: signed-in users can read, superadmin only can write
- Created `church-config.js` at repo root with deploy-time constants and inline instructions for Firebase Functions config vars
- Updated `onNewConnectForm` Cloud Function: parallel-fetches `/config/notifications` + users, sends Resend email to `connectAlertEmail` if configured, silently skips if not. In-app notification unchanged.
- Added `resend@^4.0.0` to `functions/package.json`
- Added 5 `/config/` security rule tests (54 total, all passing)
- Created `/config/notifications` Firestore doc with `connectAlertEmail: "egcstreaming@gmail.com"`
- Connect form submission verified end-to-end via Playwright (success state confirmed)

### Notes / decisions

- Email provider (Resend) is wired but config vars (`resend.api_key`, `resend.from_email`, `church.domain`) are intentionally not set yet — email sending is silently skipped until a mail provider is chosen and configured. The Firestore `connectAlertEmail` field and all function code are in place as the placeholder.
- Email provider decision deferred — options discussed: Resend (domain verified, emails appear from `egc.church`), or Nodemailer via existing SMTP (Google Workspace, M365, etc.). No new service required if existing email hosting is used.
- `firebase deploy --only functions` and `firebase deploy --only firestore:rules` both run after merge.

---

## Session: Roadmap quick wins — PWA install prompt + security tests (Session 62)

**Date:** 2026-06-12
**Branches:** `feat/pwa-install-prompt` (PR #81), `test/security-rule-escalation-tests` (PR #82), `chore/add-roadmap` (PR #83)
**Status:** All merged

### What was done

**`docs/ROADMAP.md` created**
Tracks all future improvement ideas across three priority tiers (quick wins, feature additions, technical improvements) plus explicit out-of-scope decisions. Also updated `CLAUDE.md` to mark Phase 6 complete (was still showing "in progress") and added a pointer to the roadmap.

**PWA install prompt (`feat/pwa-install-prompt`)**
Added a dismissible bottom banner to `js/main.js` that appears when the browser fires `beforeinstallprompt` (i.e. the app is installable and not already running in standalone mode). Navy background, amber Install button, × dismiss button. Dismissal stored in `localStorage` under `egcInstallDismissed` so it doesn't reappear. Uses inline styles — Tailwind CDN cannot reliably style dynamically injected HTML. SW cache bumped v33 → v34.

**Security rule tests (`test/security-rule-escalation-tests`)**
Added 8 targeted tests to `tests/firestore.rules.test.js` covering the three vulnerability paths fixed in the June 2026 security review (49 tests total, all passing):
- `users.approve` can set membership (allowed) but not `isSuperadmin` or `roles` (denied)
- `users.assign_roles` can set roles + extraPermissions (allowed) but not `membership` or `isSuperadmin` (denied)
- Conversation participant can update metadata (allowed) but not overwrite `participants` array (denied)
Added `approveOnlyUser()` and `assignRolesUser()` helper contexts.

### Notes / decisions

- No SW cache bump needed for the test file (tests are not served by the SW).
- The install prompt is intentionally shown to all visitors (not just members) — installing the PWA benefits everyone, and the member-only FCM gating is handled separately in `js/notifications.js`.

---

## Session: Security review, code cleanup, branch housekeeping (Session 61)

**Date:** 2026-06-12
**Branches:** `chore/cleanup-debug-code` (PR #79), `fix/firestore-security-rules` (PR #80)
**Status:** Both merged and deployed

### What was done

**Branch housekeeping**
- Deleted 54 stale merged branches both locally and from GitHub remote, leaving only `main`.

**Code cleanup (PR #79 — `chore/cleanup-debug-code`)**
- Removed debug `console.log` calls from `js/auth.js` (login success messages that also leaked user email addresses to the browser console) and `js/main.js` (video autoplay notice, Firebase not loaded, SW registered).
- Fixed `login.html` manifest path: `/egc-church/manifest.json` → `/manifest.json` — was the only page still using the old GitHub Pages subpath from before the Firebase Hosting migration.
- Removed the dead `showRegister()` stub function (which showed a "not implemented" alert). Replaced the "Register here" link with plain text pointing new visitors to Google sign-in, which creates accounts automatically via `onUserCreate`.

**Security review + fixes (PR #80 — `fix/firestore-security-rules`)**

A full security audit was conducted across `firestore.rules`, `storage.rules`, `functions/index.js`, and all auth/messaging JS. Three confirmed vulnerabilities were found and fixed in `firestore.rules`. Firestore rules deployed manually after merge.

**Vuln 1 (Critical) — `users.approve` privilege escalation:**
The `users.approve` branch in the `/users/{uid}` update rule had no `affectedKeys()` restriction. A holder could write `{ isSuperadmin: true }` to any user doc via the Firestore SDK, triggering `syncUserClaims` server-side and gaining full superadmin custom claims. Fixed: locked to `hasOnly(['membership', 'membershipRequestedAt', 'updatedAt'])`.

**Vuln 2 (High) — `users.assign_roles` field bypass:**
The `users.assign_roles` branch only blocked `isSuperadmin` but allowed writing any other field. A holder could bypass the membership approval workflow (writing `membership: 'member'` directly), self-grant permissions via `extraPermissions`, or overwrite PII on other users. Fixed: locked to `hasOnly(['roles', 'extraPermissions', 'updatedAt'])`.

**Vuln 3 (Medium) — Conversation participant swap exposing private messages:**
The conversations `allow update` rule had no `affectedKeys` guard. Any participant could overwrite the `participants` array to inject a third party. The messages subcollection read rule resolves access via a live `get()` on the conversation doc (not a snapshot), so the injected user immediately gained read access to all historical messages. Fixed: `!affectedKeys().hasAny(['participants'])` added to the update rule.

All 41 existing Firestore rules tests passed after the changes. No new test cases were added (existing tests do not cover the specific escalation paths — a follow-up could add targeted denial tests for each fixed branch).

### Notes / decisions

- Two findings were evaluated and dismissed as false positives by independent review:
  - `javascript:` URL in `window.location.href` (notifications.js) — not independently exploitable; Firestore rules block client-side writes to notification subcollections and Cloud Functions use hardcoded `linkUrl` values only.
  - Gallery Storage `allow read: if true` — not exploitable by unauthenticated users; Storage URLs are only discoverable via Firestore gallery documents, which are gated on membership. The design is documented and intentional.
- `firebase deploy --only firestore:rules` was run manually after PR #80 merged (rules are never auto-deployed by CI).

---

## Session: FCM push notification overhaul — background delivery, duplicates, click nav (Sessions 52–60)

**Date:** 2026-05-28
**Branches:** fix/fcm-restore-notification-field, fix/fcm-debug-logging, fix/fcm-webpush-notification, fix/fcm-restore-top-level-notification, fix/fcm-device-id-token-key, fix/sw-cache-bump-v31, fix/fcm-standalone-only, fix/fcm-remove-background-handler, chore/remove-fcm-debug-logs
**Status:** All merged and deployed (functions deployed manually after each functions PR)

### What was done

A series of interconnected FCM bugs were diagnosed and fixed across 9 PRs:

**Root cause chain:**
- Data-only FCM payload (from a prior PR) broke background delivery — Android Chrome won't wake from a closed state for data-only messages
- Top-level `notification` alone (no `webpush.notification`) reports FCM success=1 but Chrome on Android still doesn't display when fully closed
- Adding `webpush.notification` made Chrome wake and auto-display, BUT `onBackgroundMessage` in the service worker also fires a handler → two notifications per push
- Browser Chrome and installed PWA have separate `localStorage` on Android despite same origin → different `deviceId`s → two FCM tokens → two push deliveries
- `event.notification.data.linkUrl` in `notificationclick` reads from `webpush.notification.data`, not from FCM top-level `data` → tapping a notification opened home instead of the correct page

**Final FCM payload structure (all three sends: onNewMessage, sendBroadcast, weeklyDigest):**
```js
{
  notification: { title, body },           // top-level: feeds onMessage foreground toast
  webpush: {
    notification: {
      title, body,
      icon: '/assets/images/icons/icon-192.png',
      badge: '/assets/images/icons/icon-72.png',
      data: { linkUrl },                   // for notificationclick handler
    },
    fcmOptions: { link },
  },
  data: { linkUrl },                       // backup
}
```

**`service-worker.js`** — Removed `onBackgroundMessage` entirely. Chrome auto-displays from `webpush.notification` (one notification). `notificationclick` reads `event.notification.data?.linkUrl`. Cache bumped v29→v33.

**`js/notifications.js`** — Two changes:
1. Token registration gated to standalone PWA mode (`display-mode: standalone`) — prevents browser Chrome from registering a separate token alongside the installed PWA
2. Stable `deviceId` (random string in localStorage under key `egcDeviceId`) replaces `token.substring(0,22)` as Firestore doc key — token rotation overwrites the same doc instead of accumulating stale entries; migrates old token-keyed docs on first run

**`functions/index.js`** — `webpush.notification` with icon, badge, and `data:{linkUrl}` added to all three multicast sends. Temporary debug logging added then removed. Invalid token cleanup already present.

### Notes / decisions

- **`onBackgroundMessage` removal is intentional** — Firebase Messaging SDK calls `onBackgroundMessage` AND Chrome auto-displays from `webpush.notification` when both are present → two notifications. Removing the handler leaves display entirely to Chrome (one notification). Do not re-add it.
- **Standalone-only token registration** — push notifications are a PWA-native feature. Browser Chrome visitors still get the in-app bell (Firestore listener) and foreground toasts via `onMessage`; background system push requires the installed PWA.
- **SW cache must be bumped for any precached file change**, not only when `service-worker.js` itself changes. A missed bump on the `deviceId` PR required a follow-up v30→v31 bump PR.
- **Confirmed working:** broadcast arrives with PWA closed; tapping the notification opens the app at the correct page.
- **Not re-confirmed after all fixes:** DM notification tap → correct conversation; foreground toast when DM arrives while app is open.

---

## Session: fix/messages-mobile-v3 — messages mobile panel swap (final fix) (Session 51)

**Date:** 2026-05-28
**Branch:** `fix/messages-mobile-v3`
**Status:** Merged — confirmed working

### What was done

**Root cause:** Tailwind v4 CDN compiles classes at page-scan time. Dynamically adding `flex` or toggling `hidden` via JS class manipulation or `style.display` was being overridden by Tailwind's stylesheet ordering. Two prior attempts failed for this reason.

**Fix:** Replaced all JS class/style toggling for the panel swap with a plain `<style>` block in `members/messages.html` using a `@media (max-width: 767px)` rule with `!important` — completely outside Tailwind's control. `#thread-wrapper { display: none !important }` by default on mobile; `.mobile-active` shows it; `#conv-panel.mobile-hidden` hides the list. JS adds/removes `.mobile-hidden` and `.mobile-active` class names. Also removed `hidden md:flex` from `thread-wrapper`'s Tailwind classes since the custom CSS owns mobile visibility.

**`service-worker.js`** — cache bumped `v28 → v29`.

### Notes / decisions

- The `!important` in the plain `<style>` block guarantees no CSS framework can interfere regardless of load order or scan timing.
- Desktop layout (≥768px) is unaffected — the media query doesn't apply and Tailwind's flex classes govern normally.

---

## Session: fix/messages-mobile-swap — messages mobile panel swap attempt 2 (Session 50)

**Date:** 2026-05-28
**Branch:** `fix/messages-mobile-swap`
**Status:** Merged — did not fix (Tailwind CDN timing issue persisted)

Replaced `classList.add('hidden')`/`classList.remove('hidden')` with `style.display = 'flex'`/`style.display = 'none'` to bypass Tailwind. Still failed — root cause not yet identified. Cache bumped `v27 → v28`.

---

## Session: fix/messages-mobile-layout — messages page mobile layout (Session 48)

**Date:** 2026-05-28
**Branch:** `fix/messages-mobile-layout`
**Status:** PR open

### What was done

**`members/messages.html`** — classic mobile two-panel pattern: one panel at a time on small screens, side-by-side on desktop.
- Added `id="conv-panel"` to the conversation list wrapper.
- Added `id="thread-wrapper"` to the thread column; changed its classes to `hidden md:flex flex-1 flex-col min-w-0` so it's hidden on mobile by default and shown by Tailwind on md+.
- Added a mobile-only back bar as the first child of `#thread-panel`: arrow-left button (`#back-to-list`) and a `#thread-title` paragraph showing the other participant's name.

**`js/messaging.js`**:
- `conv-item` buttons get `data-name` attribute (other participant's display name) for the back bar title.
- `openConversation()` — on mobile (`window.innerWidth < 768`): hides `#conv-panel`, shows `#thread-wrapper` (`hidden` removed, `flex` added). Also sets `#thread-title` from the clicked `conv-item`'s `data-name`.
- `nav-loaded` handler — wires `#back-to-list` click: restores `#conv-panel`, hides `#thread-wrapper`, hides `#thread-panel`, shows `#empty-state`.

**`service-worker.js`** — cache bumped `v26 → v27` (`messaging.js` is cache-first).

### Notes / decisions

- `thread-wrapper` starts as `hidden` (mobile) / `md:flex` (desktop) via Tailwind. JS adds/removes `flex` alongside `hidden` on mobile so the display value is explicit when toggling — avoids relying on Tailwind's responsive class being re-evaluated after class mutation.
- `checkURLParam()` (opens a conv from `?conv=` URL) calls `openConversation()` which now handles the mobile swap, so deep-linked DM notifications work correctly on mobile too.

---

## Session: fix/notif-panel-mobile — notification panel off-screen on mobile (Session 47)

**Date:** 2026-05-28
**Branch:** `fix/notif-panel-mobile`
**Status:** PR open

### What was done

**`nav.html`** — `#notif-panel` div: added `max-sm:` responsive overrides so the panel uses fixed viewport positioning on screens narrower than 640px instead of absolute positioning relative to the bell wrapper. On mobile: `fixed`, `inset-x-2` (8px side margins, full usable width), `top-16` (below the 64px nav bar), `w-auto mt-0` (overrides desktop width/margin). Desktop layout unchanged.

### Notes / decisions

- Root cause: `absolute right-0` is relative to the bell wrapper div, which is near the right edge of the nav. On a narrow phone the panel extends left off-screen. `max-w-[calc(100vw-1rem)]` limits width but doesn't fix the anchor point.
- No SW cache bump needed — `nav.html` is network-first.
- Tailwind v4 CDN (in use) supports `max-sm:` variants natively.

---

## Session: fix/notif-bell-ux — notification bell UX polish (Session 46)

**Date:** 2026-05-28
**Branch:** `fix/notif-bell-ux`
**Status:** PR open

### What was done

**`js/notifications.js`** — two UX improvements to the notification bell panel:
- `renderPanel()` — notification items without a `linkUrl` now use `cursor-default` (no pointer, no hover highlight) instead of always showing `cursor-pointer hover:bg-gray-50`. The map callback changed from an arrow expression to a block body so `hasLink` can be computed per item.
- Auto-mark-as-read on panel open — removed the per-click mark-as-read write from the item click handler. Instead, `markAllRead(uid, items)` is called (1) when the bell button is clicked to open the panel, and (2) in the `onSnapshot` callback when the panel is already visible (so newly-arrived notifications are marked read immediately without requiring a click).
- New `markAllRead(uid, items)` helper iterates unread items and fires individual `update({ read: true })` writes.
- Item click handler simplified to navigate (if `linkUrl`) or close the panel.

**`service-worker.js`** — cache bumped `v25 → v26` (`notifications.js` is cache-first).

### Notes / decisions

- `currentItems` is a closure variable inside `setupBell` — captured by both the `onSnapshot` callback and the bell click handler so the latest item list is always available without threading it through function arguments.
- The `onSnapshot` + panel-visible guard handles the edge case where a notification arrives while the panel is open — it gets marked read without the user having to close and reopen.

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
