# Phase 6 — Permissions & Roles

> Planning document. Source of truth for the granular permissions system.
> Save to the repo as `docs/PERMISSIONS.md`. Keep updated as PRs land.

---

## Overview

The current model has two axes: `membership` (content access) and `adminRole` (`null | editor | superadmin`). It works but is too coarse — any `editor` can do everything in every admin section, which doesn't match how a church actually operates. A deacon should be able to approve users without being able to publish sermons; a media volunteer should manage galleries without seeing prayer requests.

Phase 6 introduces granular per-area permissions, organised into editable roles, with multiple roles assignable per user.

---

## Design principles

- **Multiple roles per user, additive.** Effective permissions = union of all assigned roles' permissions.
- **Optional per-user extra permissions** for one-off exceptions, so we don't proliferate combo-roles.
- **Flat roles**, no hierarchy, no per-user denials. Resolution model must be explainable in one sentence.
- **`isSuperadmin` is a separate boolean override.** It's the emergency hatch, kept outside the permission system.
- **Permissions live in Firebase Auth custom claims** for fast security-rule checks (no extra Firestore read per rule eval).
- **Firestore is the source of truth** for role definitions and user assignments. Cloud Function syncs to claims.
- **Nav and dashboard surfaces filter to show only items the user has permission to use.** This is a UX concern, not a security one — Firestore rules and page-level auth guards remain the real boundary. A user with DevTools could un-hide a link, click it, and still be bounced by the auth guard.
- `membership` ("pending" | "public" | "member") stays as-is — it's a different axis (content access) and doesn't need to change.

---

## Permission keys

Naming convention: `{area}.{action}`, lowercase, dot-separated.

| Key                  | Description                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `sermons.manage`     | Create, edit, delete, publish sermons                                                                                               |
| `events.manage`      | Create, edit, delete, publish events                                                                                                |
| `blog.manage`        | Create, edit, delete, publish blog posts                                                                                            |
| `team.manage`        | Manage leadership team profiles                                                                                                     |
| `gallery.manage`     | Create, edit, delete galleries (any audience)                                                                                       |
| `music.manage`       | Upload, edit, delete music tracks                                                                                                   |
| `devotional.manage`  | Create, edit, delete devotionals                                                                                                    |
| `groups.manage`      | Manage all groups from /admin/groups                                                                                                |
| `homepage.manage`    | Edit homepage content (tagline, banner, service times)                                                                              |
| `notifications.send` | Send broadcast notifications                                                                                                        |
| `prayer.moderate`    | View and delete prayer requests                                                                                                     |
| `connect.view`       | View visitor connect form submissions                                                                                               |
| `users.approve`      | Approve pending users, set membership tier, handle "Request member access" submissions from `public` users (see `docs/HOMEPAGE.md`) |
| `users.assign_roles` | Assign roles + extras to users (does NOT include `isSuperadmin` toggle)                                                             |
| `youtube.update`     | Push corrected sermon metadata (title, description) back to YouTube from `/admin/sermons`. Gates a client-side OAuth flow, not a Firestore write — see "YouTube write-back" below |

**15 keys total.** Easy to extend later if `.manage` ever needs to split into `.create / .edit / .delete`, but start coarse.

### YouTube write-back (`youtube.update`)

Unlike every other key, `youtube.update` does not gate a Firestore collection — it gates a client-side feature on `/admin/sermons.html` that calls the YouTube Data API v3 directly from the browser using an OAuth access token, not a Firestore write. The permission only controls whether the "Connect YouTube" / "Push to YouTube" UI is shown (checked via decoded ID token claims, same `hasPermission()` pattern as everywhere else) — there is no corresponding Firestore or Storage rule, since the side effect lands on YouTube's servers, not ours.

The OAuth token is acquired via `linkWithPopup` (or `reauthenticateWithPopup`, if Google is already linked) on the signed-in admin's own `firebase.auth().currentUser` — never a bare `signInWithPopup` — so a mismatched Google account is rejected by Firebase rather than silently swapping the admin's active site session. The token lives in page memory only (not `localStorage`, not Firestore) and expires after about an hour; each volunteer with `youtube.update` connects their own YouTube-manager Google account independently.

---

## Default roles (seed data)

Ship as seed when the roles collection is first created. Superadmin can edit display names, descriptions, and permissions, or add new roles. The `isSystem: true` flag prevents deletion of these baseline roles.

| Role ID          | Display name     | Permissions                                                                                 |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `administrator`  | Administrator    | All permissions (equivalent role for non-superadmin admins)                                 |
| `pastor`         | Pastor           | `sermons.manage`, `devotional.manage`, `events.manage`, `blog.manage`, `notifications.send` |
| `deacon`         | Deacon           | `users.approve`, `prayer.moderate`, `connect.view`                                          |
| `media_helper`   | Media helper     | `sermons.manage`, `music.manage`, `gallery.manage`                                          |
| `communications` | Communications   | `blog.manage`, `homepage.manage`, `notifications.send`, `events.manage`                     |
| `prayer_lead`    | Prayer team lead | `prayer.moderate`, `notifications.send`                                                     |
| `content_editor` | Content editor   | All `.manage` permissions (migration target for existing `editor` users)                    |

---

## Firestore schema

### New collection: `/roles/{roleId}`

```
{
  id: "deacon",                          // matches doc ID
  displayName: "Deacon",
  description: "Approves members, moderates prayer, views connect forms",
  permissions: ["users.approve", "prayer.moderate", "connect.view"],
  isSystem: true,                        // system roles cannot be deleted
  createdAt: timestamp,
  updatedAt: timestamp,
  updatedBy: uid
}
```

### Updates to `/users/{uid}`

**Add:**

- `roles: [string]` — array of role IDs (default `[]`)
- `extraPermissions: [string]` — array of permission keys for one-off grants (default `[]`)
- `isSuperadmin: boolean` — overrides everything (default `false`)

**Keep for migration window:**

- `adminRole` — leave in place until all pages migrated, then remove in cleanup PR

Effective permissions are **never stored on the user doc** — they live in custom claims, computed by Cloud Function.

---

## Permission resolution

The full algorithm, in four steps:

1. Start with empty set
2. Union in permissions from all roles in `user.roles`
3. Union in any `user.extraPermissions`
4. If `user.isSuperadmin == true`, override to "all permissions"

That's it. No inheritance, no denials, no priority order.

---

## Cloud Function: `syncUserClaims`

**Trigger:** Firestore document write on `/users/{uid}` (v1: `functions.firestore.document('users/{uid}').onWrite`)

**Action:**

1. Read the (updated) user doc
2. If `isSuperadmin: true` → set custom claims to `{ superadmin: true }`
3. Else: fetch all role docs referenced in `user.roles` (parallel reads)
4. Compute union of role permissions + `user.extraPermissions`
5. Write to custom claims: `{ perms: [...effective permissions] }`
6. On the client, force token refresh after role changes: `firebase.auth().currentUser.getIdToken(true)`

**Idempotency:** Only run if `roles`, `extraPermissions`, or `isSuperadmin` actually changed (compare before/after). Avoids loops.

**Custom claims budget:** 1000 bytes. 14 keys × ~20 bytes = ~280 bytes. Plenty of headroom even with 2× future growth.

**Trigger condition guard:** Skip if the only field that changed is `updatedAt` or similar non-permission fields, to avoid unnecessary token invalidation.

---

## Security rules sketch

```
function isSuperadmin() {
  return request.auth != null
      && request.auth.token.superadmin == true;
}

function hasPermission(p) {
  return isSuperadmin()
      || (request.auth != null
          && request.auth.token.perms is list
          && p in request.auth.token.perms);
}

match /sermons/{id} {
  allow read: if resource.data.published == true
              || hasPermission('sermons.manage');
  allow write: if hasPermission('sermons.manage');
}

match /roles/{roleId} {
  allow read: if request.auth != null;
  allow create, update: if isSuperadmin();
  allow delete: if isSuperadmin()
                && resource.data.isSystem != true;
}

match /users/{uid} {
  // existing user self-write rules unchanged
  // role/permission writes:
  allow update: if isSuperadmin()
                || (hasPermission('users.assign_roles')
                    && !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['isSuperadmin']));
  // users.assign_roles can change roles + extras but NOT isSuperadmin
}
```

Note the deliberate split: `users.assign_roles` is a regular permission, but granting `isSuperadmin` requires being a superadmin yourself. Prevents privilege escalation.

---

## Nav and dashboard filtering

After migration, the admin nav and the `/admin/index.html` dashboard cards filter to show only items the current user can use. This applies to four surfaces:

1. Desktop Admin dropdown (from the Option A nav refactor)
2. Mobile hamburger admin section
3. Admin dashboard cards on `/admin/index.html`
4. Admin shortcuts strip on the member home dashboard (see `docs/HOMEPAGE.md` — Phase 7)

The pattern is a small data restructure plus one filter call:

```
// Each admin nav/dashboard item gets a required-permission tag
const adminItems = [
  { label: 'Sermons',       url: '/admin/sermons',       perm: 'sermons.manage' },
  { label: 'Events',        url: '/admin/events',        perm: 'events.manage' },
  { label: 'Blog',          url: '/admin/blog',          perm: 'blog.manage' },
  { label: 'Team',          url: '/admin/team',          perm: 'team.manage' },
  { label: 'Gallery',       url: '/admin/gallery',       perm: 'gallery.manage' },
  { label: 'Music',         url: '/admin/music',         perm: 'music.manage' },
  { label: 'Devotional',    url: '/admin/devotional',    perm: 'devotional.manage' },
  { label: 'Groups',        url: '/admin/groups',        perm: 'groups.manage' },
  { label: 'Homepage',      url: '/admin/homepage',      perm: 'homepage.manage' },
  { label: 'Notifications', url: '/admin/notifications', perm: 'notifications.send' },
  { label: 'Prayer',        url: '/admin/prayer',        perm: 'prayer.moderate' },
  { label: 'Connect',       url: '/admin/connect',       perm: 'connect.view' },
  { label: 'Users',         url: '/admin/users',         perm: 'users.approve' },
  { label: 'Roles',         url: '/admin/roles',         perm: 'users.assign_roles' },
];

// Render only what this user can use:
adminItems.filter(item => hasPermission(item.perm))
```

Additional rules:

- If `filtered.length === 0`, hide the Admin dropdown trigger in the desktop nav and the entire admin section in the mobile menu — no empty dropdown stubs
- The Members dropdown is NOT filtered — all members see all member pages
- The dashboard cards on `/admin/index.html` use the same `adminItems` array, just rendered as cards instead of links — single source of truth

This is **UX, not security.** A user with DevTools could un-hide a link, click it, and still be bounced by the page auth guard from PR #6. Both layers must be in place; nav filtering alone is not a security boundary.

---

## Migration plan

A one-time migration via callable Cloud Function (`migrateRolesV1`, superadmin only):

1. **Seed `/roles/{roleId}`** with the 7 default roles if collection is empty
2. **Iterate `/users/`** in batches of 100:
   - `adminRole: "superadmin"` → set `isSuperadmin: true`, `roles: []`, `extraPermissions: []`
   - `adminRole: "editor"` → set `roles: ["content_editor"]`, `isSuperadmin: false`, `extraPermissions: []`
   - `adminRole: null` → set `roles: []`, `isSuperadmin: false`, `extraPermissions: []`
3. Each user write triggers `syncUserClaims` automatically
4. Return summary: `{ usersUpdated, rolesSeeded, errors }`
5. **`adminRole` field is NOT removed** — left in place as fallback. Cleanup happens in the final PR after all pages are confirmed working.

**Run order:** staging first → verify → production.

---

## PR sequencing

Sequential per the repo rule — each PR merges to `main` before the next branches off.

| #   | Branch                           | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `phase6/roles-collection`        | Firestore schema doc updates, security rules for `/roles/`, seed script (manual run for now), rules tests                                                                                                                                                                                                                                                                                                                                                     |
| 2   | `phase6/sync-claims-function`    | `syncUserClaims` Cloud Function + unit tests                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | `phase6/migration-function`      | `migrateRolesV1` callable; run on staging, verify, then prod                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `phase6/admin-roles-ui`          | New `/admin/roles.html` — list, create, edit, delete (non-system) roles. Bump SW cache, update precache                                                                                                                                                                                                                                                                                                                                                       |
| 5   | `phase6/admin-users-ui`          | Update `/admin/users.html` — assign roles checkbox list, expandable "extra permissions" section, `isSuperadmin` toggle (superadmin-only)                                                                                                                                                                                                                                                                                                                      |
| 6   | `phase6/permission-helper`       | Shared `js/permissions.js` exposing `hasPermission(key)`; refactor `js/admin-auth.js` to accept required-permission param                                                                                                                                                                                                                                                                                                                                     |
| 7   | `phase6/migrate-rules-and-pages` | Three changes shipped together so the system flips coherently: (1) swap every admin page's auth guard to require specific permissions; (2) swap Firestore rules from `adminRole` checks to `hasPermission()` checks; (3) make the desktop Admin dropdown, mobile admin menu, and `/admin/index.html` dashboard cards permission-aware — only show items the user can use, and hide the Admin dropdown trigger entirely if the user has zero admin permissions |
| 8   | `phase6/remove-adminrole`        | Cleanup: remove `adminRole` from rules, schema docs, user docs (migration write), all JS references                                                                                                                                                                                                                                                                                                                                                           |

**Estimated:** 8 PRs over roughly 2–3 working sessions.

---

## Open questions

- **Audit log for role changes?** Suggest yes — append-only entries in `/users/{uid}/auditLog/{entryId}` written by `syncUserClaims` whenever roles/extras change. Cheap insurance.
- **Self-lockout prevention for `isSuperadmin`?** Suggest yes — security rule denies removing the last superadmin. Implementation: count remaining superadmins in the function before allowing the write.
- **Role display order in UI?** Suggest alphabetical by `displayName`. Add a `sortOrder` field only if a real need emerges.

---

## Explicitly out of scope (Phase 6)

These are reasonable future asks but not in this phase:

- Time-bounded role assignments (e.g. "deacon until 2027-01-01")
- Resource-scoped permissions (e.g. "media helper only for youth gallery")
- Permission groups separate from roles
- Splitting `.manage` into `.create / .edit / .delete` (revisit only if a real use case emerges)
- Self-service role requests by members
