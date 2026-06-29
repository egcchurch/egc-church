# Phase 7 — Adaptive Homepage & Engagement Surface

> **Status: Complete and deployed.** Reference only — implementation is in the code.
> Planning document. Source of truth for the adaptive home surface.

---

## Overview

Today's site is navigation-first: every page is a destination, and even authenticated members must hunt for live streams, notices, and updates. For a church PWA where engagement matters more than browseability, this is the wrong model.

Phase 7 turns `/` into an **adaptive home surface** — same URL, different content per auth state — so members land somewhere that already has what they came for. Visitors still get a welcoming public landing page. Logged-in members get a personalised dashboard with live stream, notices, devotional, and quick links front and centre.

This phase also formalises three related changes that fall out of the same model:

1. A consistent **gated-content prompt** pattern (replace silent redirects with helpful messages)
2. A **"Request member access"** flow so `public` users can convert to `member` without admin chasing
3. Tightening **FCM token registration** to members only (no notifications for `pending` or `public`)

---

## Design principles

- **One URL, four states.** `/` adapts based on auth + membership; visitors are never redirected away from the front door.
- **Members feel like the site came to them.** Live stream, notices, devotional, and unread message indicators appear without navigating.
- **Visitors see what exists, not just marketing.** Stream and notices are visible (in summary form) so non-members understand what membership unlocks.
- **No silent redirects.** Every gated-content denial is a clear message with a next step (sign in, request access, or wait for approval).
- **Membership is the upgrade.** Notifications, messages, directory, prayer wall, devotional, full live stream — all unlock at `member`. `public` is a passive state by design.
- **Admin shortcuts on the home surface respect Phase 6 permissions.** A deacon sees pending approvals on their home dashboard; the media helper next to them doesn't.

---

## The four home-surface states

Same `/` URL. The content block renders one of these four state templates based on `auth + user.membership`.

| State   | Trigger                            | Headline behaviour                                                                                    |
| ------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Visitor | Not logged in                      | Public landing — hero, service times, notice teaser, live stream teaser, CTAs to register/sign in     |
| Pending | Logged in, `membership: "pending"` | Holding state — "awaiting approval" message, resend-verification option, public content below         |
| Public  | Logged in, `membership: "public"`  | Personalised welcome, same content as visitor, "Become a member" card with [Request access]           |
| Member  | Logged in, `membership: "member"`  | Full dashboard — LIVE NOW banner, notice board feed, today's devotional, unread messages, quick links |

A member who is also an editor or superadmin sees the Member dashboard PLUS an "Admin shortcuts" strip — pending approvals count, recent connect submissions, recent prayer requests — each item filtered via `hasPermission()` from Phase 6.

---

## State details

### Visitor (not logged in)

- Hero with tagline (existing)
- Service times grid (existing)
- Announcement banner if active (existing)
- **Live stream teaser** — if stream is active: "We're live now — sign in to watch" with a static thumbnail; if not: "Next service: Sunday 10:00 AM" with countdown
- **Latest announcements** — read-only feed, 2 most recent items, snippets only
- Explore cards (existing: Sermons, Events, Music, Connect)
- Footer CTA: "Become part of the community — [Register]"

### Pending

- Large card: "Your account is awaiting approval"
- Subtext: "Approvals usually happen within 24 hours. We'll email you when you're in."
- If `emailVerified == false`: prominent "Resend verification email" button
- Sign out option visible
- Public content (service times, announcements) below — not personalised, no CTAs to engage further

### Public

- Personalised greeting ("Welcome, {firstName}")
- Same content blocks as Visitor (announcements, live teaser, service times, explore cards)
- **New "Become a member" card** — explains what membership unlocks (live stream, messages, directory, prayer wall, notifications), button: "Request member access"
- Profile link in nav (existing)
- **No notification bell** — public users have no FCM tokens and no in-app notifications

### Member

- Personalised greeting
- **LIVE NOW banner** (if active) — large, prominent, embedded thumbnail, "Watch live" button → `/members/live.html` (full player)
- Otherwise: "Next service: Sunday 10:00 AM" with live countdown
- **Notice board feed** — 3–5 most recent announcements (blog posts with `kind: "announcement"`), full snippets, link to `/blog` for archive
- **Today's devotional** snippet — title, scripture, first ~100 words, link to full devotional
- **Quick links strip** — Messages (with unread count badge), Prayer wall, Directory, Groups
- **Upcoming events** — next 2 events
- Notification bell in nav (with unread count, real-time)
- Explore cards (existing, less prominent on this state)

### Member + admin/editor

Everything Member sees, plus an **Admin shortcuts strip** above the notice board:

- Pending user approvals count → `/admin/users` (visible only with `users.approve`)
- New connect submissions count → `/admin/connect` (visible only with `connect.view`)
- New prayer requests count → `/admin/prayer` (visible only with `prayer.moderate`)
- Recent membership requests → `/admin/users?filter=requested` (visible only with `users.approve`)

Strip uses the same `hasPermission()` helper from Phase 6 PR #6. If a user has zero admin permissions on the home surface, the strip is hidden entirely.

---

## Live stream surfacing

### Backing data

Extend the existing `/homepage/content` Firestore doc (created in Phase 5):

```
/homepage/content
  tagline: "..."
  announcement: { ... }
  serviceTimes: [ ... ]
  liveStream: {                          // NEW
    active: true | false,
    title: "Sunday Service — May 31",    // displayed in banner
    youtubeId: "abc123",                 // for thumbnail + embed
    startedAt: timestamp,                // for "live for 23 min" display
    updatedBy: uid,
    updatedAt: timestamp
  }
```

No new collection. Same security rules as the existing `/homepage/content` (public read, `homepage.manage` write).

### Display logic

The home surface reads `liveStream.active` and renders accordingly:

- `active: true` → LIVE NOW banner with thumbnail from YouTube (`https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg`)
- `active: false` → "Next service" card based on `serviceTimes` (pick next future occurrence by day-of-week + time, accounting for Africa/Johannesburg timezone)

Visitor sees the banner but the Watch button prompts sign-in. Member sees the working banner.

### Admin toggle UI

Add a "Live stream" section to `/admin/homepage.html`:

- Toggle: Active / Inactive
- Text inputs (visible when active): Title, YouTube video ID
- "Set live" button writes `active: true`, `startedAt: serverTimestamp()`, current `updatedAt/By`
- "End stream" button writes `active: false`, clears `startedAt`

Permission: `homepage.manage` (existing). No new role permission needed.

### Future enhancement (out of scope)

Auto-detect live status via YouTube API rather than manual toggle. Defer — manual is simpler and reliable.

---

## Notice board (announcement vs article)

### Schema change

Add `kind` field to `/blog/{postId}` documents:

```
/blog/{postId}
  title, body, author, imageUrl, publishedAt, published
  kind: "announcement" | "article"      // NEW, default "article"
```

**Migration:** all existing posts default to `"article"` (preserves current behaviour — they appear on `/blog`, not on home).

### Admin UX

In `/admin/blog.html`, add a radio selector at the top of the create/edit form:

- ○ Announcement — short, time-sensitive, appears on member home feed
- ● Article — longer-form, appears on /blog only

Default selection: Article (matches migration default).

### Public display

- `/blog.html` (unchanged behaviour) — lists both announcements and articles, sorted by `publishedAt` desc, with an optional filter chip ("All / Announcements / Articles")
- Member home — queries `kind == "announcement" && published == true`, sorted by `publishedAt` desc, top 5
- Visitor home — same query, top 2

A composite index may be required: `kind ASC, publishedAt DESC, published ASC`. Confirm during PR #2.

---

## Gated content prompts

Replace today's silent `window.location = '/login.html'` redirects with a brief modal/page that explains why and offers a next step.

| User state                   | Tries to access                           | Sees                                                                         |
| ---------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Not logged in                | Member-only page                          | "Sign in or register to access this" → [Sign in] [Register]                  |
| Pending                      | Member-only page                          | "Your account is awaiting approval (usually within 24 hours)"                |
| Public                       | Member-only page                          | "This is for church members. [Request access]"                               |
| Member                       | Admin-only page                           | Bounce to home with a brief toast: "You don't have permission for that page" |
| Member with some admin perms | Admin page they don't have permission for | Same as above                                                                |

Implementation: both `js/member-auth.js` and `js/admin-auth.js` get a unified `showAccessDenied(reason)` helper that injects a centred card and stops further page rendering, rather than redirecting. The card includes one or two action buttons appropriate to the reason.

The home surface itself never triggers these prompts — it adapts content rather than denying it.

---

## Request member access flow

A `public` user has a way to convert without an admin chasing them.

### User side

- New section on `/profile.html`: "Membership"
- If `membership: "public"`: button "Request member access"
- Clicking calls `requestMemberAccess` Cloud Function
- After call: button is replaced with "Requested on {date} — we'll email you when approved"
- If `membership: "member"`: section shows "Member since {createdAt}" (read-only)

### Cloud Function

`requestMemberAccess` (callable, v1):

1. Verify auth context exists and `user.membership == "public"`
2. Update `/users/{uid}`: set `membershipRequestedAt: serverTimestamp()`
3. Write in-app notification to every user with `users.approve` permission:
   `"{displayName} requested member access"`, linking to `/admin/users?uid={uid}`
4. Return `{ success: true }`

Idempotent — calling twice within 24h returns success without re-notifying admins (rate-limit check on `membershipRequestedAt`).

### Admin side

`/admin/users.html` gets a new filter chip: "Pending requests" (`where membershipRequestedAt != null && membership == "public"`). Approve button promotes them to `member` and clears the `membershipRequestedAt` field. Decline button clears the field without promotion (they can request again later).

---

## FCM token registration scope change

### Current behaviour (Phase 4)

Per CLAUDE.md, FCM tokens are registered for any logged-in user who grants notification permission. This means `pending` and `public` users may have tokens stored — which contradicts the "members only get notifications" decision from this session.

### New behaviour

`js/notifications.js` token registration is guarded on `membership === "member"`:

```
async function registerFcmTokenIfEligible(user, userDoc) {
  if (userDoc.membership !== 'member') return;
  // ... existing token registration logic
}
```

### Membership transition handling

- `pending → member` or `public → member`: register token at first sign-in after promotion (handled by the auth state listener)
- `member → public` or `member → pending`: a `syncUserNotificationEligibility` Firestore trigger on `/users/{uid}` deletes all docs in `/users/{uid}/fcmTokens` when membership drops below member
- Cloud Functions that fan out broadcasts (`sendBroadcast`, `weeklyDigest`, `onNewPrayerRequest`, `onNewMessage`) already query token subcollections — they'll naturally skip downgraded users once tokens are deleted

### Migration

One-time callable function (`cleanupNonMemberTokens`, superadmin only): iterate `/users/`, delete `fcmTokens` subcollection for any user where `membership !== 'member'`. Run on staging then prod.

### CLAUDE.md update required

The broadcast types table in CLAUDE.md needs updating — all rows currently saying "All users" become "All members". The notification delivery caveat ("FCM push only reaches logged-in approved users with registered tokens") becomes "logged-in members with registered tokens". Capture in PR #6 of the sequencing below.

---

## Implementation

### Files affected

| File                     | Change                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`             | Major rework — render container that swaps between four state templates                                                                        |
| `js/homepage.js`         | Becomes auth-state-aware; loads appropriate state template; renders content blocks                                                             |
| `admin/homepage.html`    | Add Live Stream section to existing controls                                                                                                   |
| `admin/blog.html`        | Add kind radio selector                                                                                                                        |
| `blog.html`              | Add optional filter chip (announcement / article / all)                                                                                        |
| `profile.html`           | Add Membership section with Request access button                                                                                              |
| `admin/users.html`       | Add "Pending requests" filter chip; show membershipRequestedAt                                                                                 |
| `js/notifications.js`    | Gate token registration on membership === 'member'                                                                                             |
| `js/member-auth.js`      | Replace silent redirect with showAccessDenied helper                                                                                           |
| `js/admin-auth.js`       | Same                                                                                                                                           |
| `firestore.rules`        | Confirm `homepage/content` write permission covers liveStream field; rules for membershipRequestedAt writes (only function or `users.approve`) |
| `firestore.indexes.json` | Add composite index for `kind + published + publishedAt` if needed                                                                             |
| `functions/index.js`     | Add `requestMemberAccess`, `syncUserNotificationEligibility`, `cleanupNonMemberTokens`                                                         |
| `service-worker.js`      | Bump cache version, no new HTML pages added                                                                                                    |
| `CLAUDE.md`              | Update broadcast types table + FCM delivery caveat                                                                                             |

### New Firestore fields

- `/homepage/content.liveStream: { active, title, youtubeId, startedAt, updatedAt, updatedBy }`
- `/blog/{id}.kind: "announcement" | "article"`
- `/users/{uid}.membershipRequestedAt: timestamp | null`

No new collections.

---

## PR sequencing

Sequential per the repo rule. Default assumption: this phase ships after Phase 6 (so admin shortcuts can use `hasPermission()` from day one). It is technically possible to ship most of this before Phase 6 — only PR #5 (admin shortcuts strip) actually depends on Phase 6 being done.

| #   | Branch                         | Scope                                                                                                                                                        |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `phase7/blog-kind-field`       | Add `kind` field + admin radio + blog filter chip + composite index. No home changes yet — preparatory work                                                  |
| 2   | `phase7/live-stream-toggle`    | Extend `/homepage/content` with liveStream block; add admin toggle UI; no front-end display yet                                                              |
| 3   | `phase7/adaptive-home-render`  | Rework `index.html` + `js/homepage.js` into the four-state template renderer. Wire live stream + notice feed + devotional + quick links into Member state    |
| 4   | `phase7/gated-prompts`         | `showAccessDenied` helper in member-auth + admin-auth; replace silent redirects across all gated pages                                                       |
| 5   | `phase7/admin-shortcuts-strip` | Add admin shortcuts strip to member home for users with admin permissions. **Depends on Phase 6 PR #6 (permission helper)**                                  |
| 6   | `phase7/fcm-members-only`      | Guard token registration on membership; add `syncUserNotificationEligibility` trigger + `cleanupNonMemberTokens` migration; update CLAUDE.md broadcast table |
| 7   | `phase7/request-access-flow`   | `requestMemberAccess` callable + profile UI + admin filter chip                                                                                              |

7 PRs, roughly 2–3 working sessions.

---

## Open questions

- **Should the LIVE NOW banner embed the YouTube player inline, or just link to the live page?** Suggest link-only — embedding costs bandwidth on every home view and many users won't click. Watch button takes them to `/members/live.html` where the embed lives.
- **Should pending users see the public content blocks (announcements, service times) below their "awaiting approval" notice, or a pure holding screen?** Suggest yes — they're not getting anything they couldn't see logged out, and it makes the wait feel less stark.
- **How long before a `public` user's "Request access" can be re-submitted if no admin acts?** Suggest 24h cooldown — prevents spam, gives admins reasonable response window.

---

## Explicitly out of scope (Phase 7)

- Auto-detecting YouTube live status via API (manual toggle is fine)
- Push notifications for non-members via web push or email digest (matches the "members only get notifications" decision)
- Personalised content recommendations on member home
- A separate notice board archive page (use `/blog` with the announcement filter)
- Profile activity feed
- Membership tiers beyond pending/public/member
