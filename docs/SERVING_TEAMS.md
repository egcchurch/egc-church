# Serving Teams

> Design doc for the rostered-volunteer-team module. Keep updated as phases land.
> Distinct from `/groups` — Groups is for ongoing fellowship/Bible-study groups with no
> rostering need; Serving Teams is for anything that needs a schedule (who's on duty when).

---

## Why this exists, and why it's not just "Groups"

The church has volunteer teams that need to be **scheduled per service/event** — an
Equipment/AV team, a Worship band, Youth meeting helpers — not just "a list of people who
are part of this thing." Groups (`/groups`) models a standing, recurring weekly meeting
with persistent membership and no concept of capacity, scheduling, or per-date roles. None
of that fits a team where the actual question each week is "who's on sound, who's on
camera, who couldn't make it, who's filling in."

Serving Teams is a **separate, general-purpose framework** — any rostered team (Equipment,
Worship, Youth Helpers, future teams like Ushers/Security) gets its own team entry, its own
member list, its own roster — without rebuilding anything per team. The first team set up
in it is the **Equipment Team**.

---

## Core concepts

### Team
A named group of volunteers with a leader (or leaders), a member list, and its own
self-growing list of **functions** (see below). Mirrors `/groups`' `joinPolicy` pattern
(open / approval / invite-only) so people can discover and request to join.

### Member tier
Each member is tagged `trainee` or `qualified`. A trainee shadows a qualified person on a
slot until the leader manually "graduates" them — no automatic graduation logic.

### Functions (atomic skills, not fixed roles)
A small, **per-team**, self-growing list of skill names — e.g. for Equipment: Sound,
Camera, Video Mixing, Streaming Sound, Words. For Worship: Piano, Bass, Drums, Organ, Keys,
Violin, Cello, Guitar, Clarinet, Sax, Song Leader. For Youth Helpers: Food Helper, Sound,
Words.

Functions are picked via the same `<input list="...">` + `<datalist>` autocomplete pattern
already used for Speaker/Series on the sermons admin page — pick an existing one, or type a
new one and it's just added to that team's list. No separate "manage functions" admin
screen; the list grows from what's typed, scoped per team (a Worship leader's autocomplete
never shows "Camera").

**Critically: roles are not fixed.** A slot can bundle **one or more** functions onto a
single person, and how many slots/which functions are needed varies service to service:

- Camera + Video Mixing handled by one person some weeks, split into two slots other weeks
  (e.g. the venue layout puts the camera too far from the mixing desk).
- Needing more than one person for the *same* function (2 Food Helpers, 4 Violins, 2
  Guitars) is just **multiple slots tagged with the same function** — no special case. The
  UI auto-numbers same-function slots for readability ("Violin 1", "Violin 2"...) since any
  qualified person can fill any of them.
- A slot's display label is just its functions joined ("Camera + Video Mixing") — no
  separate name field.

### Roster slot
One person's assignment for one date. A slot is **open** (`assignedUid == null`) or
**filled**. Filling happens either by the leader pre-assigning someone, or by a member
self-claiming an open slot — same data, two habits, no separate "mode" setting per team.
"I can't make it" simply reverts the slot to open, which is also the swap mechanism — no
separate cancel/reopen flow needed.

### Training pairing
**Opt-in per slot at creation time** (a static checkbox the leader sets when creating that
slot), not automatic/dynamic. Most slots are single-position; a leader explicitly flags the
specific slots where a trainee is being paired with a mentor that day. Each training-enabled
slot always has exactly two fixed positions (lead + trainee) regardless of who's assigned —
no dynamic spawning/despawning of a second slot based on the assignee's tier, since that
just moves the same validation problem around (what happens to an orphaned mentor slot if
the trainee cancels?) without saving any complexity.

### Templates
A named, reusable slot **shape** (e.g. "Full Band", "Youth Band", "Equipment — Split
Camera") — a saved list of `{ functions, trainingEnabled, defaultAssigneeUid? }` entries.
Applying a template to a date creates that exact set of slots. A template slot can
optionally pin a **default assignee** for positions that are essentially always the same
person (e.g. Violin 1 = Sister Jane, since there are only a few people who can play it),
while leaving genuinely-rotating positions (Piano, Drums, Bass, Organ, Keys) blank for the
leader to fill each time.

### Visibility
- **Team existence** (name, description, join policy) — visible to all members, same as
  Groups, so people can discover and request to join.
- **Roster/slots** — visible only to that team's own members, that team's leaders, and
  admins holding `servingTeams.manage`. Nobody sees another team's schedule.

### Equipment Register + Moves (Phase 2 — not yet built)
Not a booking/reservation calendar. The actual need is **knowing where a piece of
equipment currently is** (e.g. "Elands" vs "Nestpark"), kept accurate via a **move**: pick
a destination venue and a checklist of items, check them off as they're packed, and on
completion each item's known location updates to the destination. The move *is* the
checklist — there's no separate "equipment register" data entry step beyond what a move
naturally produces. Scoped under the Equipment Team specifically (not every team has
equipment), but reachable from its own dedicated page rather than buried in a tab, since
it's the kind of thing checked from a phone mid-move.

---

## Data model

```
/servingTeams/{teamId}
  name, description
  leaders: [uid]
  members: [uid]                       ← plain array, mirrors /groups exactly (arrayUnion/Remove)
  memberTiers: { [uid]: "trainee" | "qualified" }   ← map, decoupled from members[] so join/
                                          leave stays a simple array op; new joiners default
                                          to "trainee" until a leader promotes them
  functions: [string]                 ← this team's own grown autocomplete list
  joinPolicy: "open" | "approval" | "invite-only"
  pendingMembers: [uid]                ← for "approval" joinPolicy, mirrors /groups
  createdAt, updatedAt, createdBy

/servingTeams/{teamId}/slots/{slotId}
  date: string (YYYY-MM-DD)
  functions: [string]                  ← 1+ function names bundled onto this slot
  assignedUid, assignedName: uid|null, string|null     ← lead/primary position
  trainingEnabled: boolean             ← opt-in, set at creation, static
  traineeUid, traineeName: uid|null, string|null
  status: "open" | "filled"            ← derived from assignedUid, stored for query convenience
  notes
  createdBy, createdAt, updatedAt

/servingTeams/{teamId}/templates/{templateId}
  name: string                         ← e.g. "Full Band"
  slots: [{ functions: [string], trainingEnabled: bool, defaultAssigneeUid?, defaultAssigneeName? }]
  createdAt, updatedAt, createdBy

(Phase 2 — not yet built)
/servingTeams/{teamId}/equipment/{itemId}
  name, description, category, currentLocation, lastMovedAt, lastMovedBy
/servingTeams/{teamId}/moves/{moveId}
  fromLocation, toLocation, scheduledFor, status: "in-progress" | "complete"
  items: [{ equipmentId, packed: bool }]
  createdBy, completedAt
```

---

## Permission model

New permission key: **`servingTeams.manage`** — admin-level "create/edit/delete any team,
reassign leaders across teams." This is deliberately **not** bundled into any existing
default role (deacon, media_helper, etc.) — a superadmin assigns it via `/admin/roles.html`
to whichever role makes sense for the church (could be its own small role, e.g. a "Serving
Teams Coordinator").

**Team leaders don't need this permission at all.** Leading a specific team is just being
listed in that team's `leaders` array — managing your own team's roster/members/functions/
templates is scoped by that, independent of any custom claim. This mirrors exactly how
Group leaders manage their own group today.

---

## Phasing

- **Phase 1 (this work):** Teams (CRUD, join/leave/approve), members + tier, functions,
  roster slots (leader-create, leader-assign, training-pairing flag), member-facing roster
  view, self-claim + "can't make it" release.
- **Phase 1.5:** Templates (save current slot shape, apply to a new date).
- **Phase 2 (future):** Equipment Register + Moves, scoped to the Equipment Team.
- **Explicitly deferred / not in scope yet:** push notifications when a slot opens up
  (claiming is currently "check the roster," not pushed); a personal "my upcoming slots
  across all teams I'm on" combined view; recurring slot auto-generation (vs. one-off
  manual/template-based creation).
