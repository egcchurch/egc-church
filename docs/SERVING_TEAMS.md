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

### Member functions (eligibility + visibility)
A leader assigns each member a subset of the team's functions they're qualified for (e.g.
Sound + Video, but not Piano). This gates two things at once: a member can only **claim**
a slot whose function is in their assigned set (enforced in Firestore rules, not just the
UI), and a member's roster view is **filtered** to only those slots — decluttering a large
team's roster down to what's actually relevant to them.

**Default is locked out, not unrestricted.** A member with no functions assigned yet sees
nothing and can claim nothing, until a leader explicitly assigns at least one. This was a
deliberate choice over "open by default, restrict later" — the latter would have silently
changed behavior for every existing member the moment this shipped (they'd keep seeing
everything until a leader thought to narrow them down); locked-out-by-default means the
leader does a one-time pass assigning functions to their existing roster instead.

A member still sees any slot they're already personally on (lead or trainee), even if a
later function change would otherwise hide it — so a function edit never makes someone
lose track of a commitment they still need to fulfil or release. Leaders/admins are never
filtered — they need full visibility to manage the roster regardless of their own
function assignments.

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

### Schedules (named, persistent recurrence definitions)
A team that meets on a recurring weekly schedule (e.g. Sunday Morning, Sunday Evening,
Wednesday) doesn't want to hand-create every slot for a 6-month run (3 services/week ×
~26 weeks × several functions each = hundreds of slots). A **Schedule** (e.g. "EGC
Elands") is a named, persistent doc holding: one or more pattern rows (day of week + an
optional free-text **label**, e.g. "Morning"/"Evening" — only needed when more than one
service lands on the same calendar date + the functions that service needs) and a
start/end date range. Creating a schedule bulk-creates one open slot per function per
matching date across the range in a single action, and every slot it creates is tagged
with that schedule's id.

Schedules can be **edited and regenerated**: a leader fixes a mistake (e.g. picked
Saturday instead of Sunday) and saves — this deletes every slot tagged with that schedule
and recreates them fresh from the corrected definition, in one action, instead of
manually hunting down every wrongly-dated slot. A standalone **Regenerate** action re-rolls
from whatever's already saved without reopening the editor. Both regenerate and **delete
schedule** (which cascades to delete its slots too) warn with a count before doing
anything destructive — and specifically flag how many of the affected slots already have
a volunteer assigned, since that's the one case where this could silently discard real
work. This is a backstop for the rare case a mistake is caught late, not the common path
(it's normally caught immediately, before anyone's claimed anything), so it informs
rather than blocks.

Generated slots carry the pattern's `label` so the roster view can show same-date
services (e.g. two Sundays) as distinguishable sub-groups instead of one merged list.

This superseded an earlier, anonymous "single list of patterns on the team doc" design —
patterns had no name, couldn't be told apart from each other, and slots had no
back-reference to whatever generated them, which is exactly what made fixing a mistake
require a manual hunt-and-delete. It also replaced an even earlier, narrower "save a
template, apply it to one date" idea — the date-range generator covers that case too
(a 1-day range), so a separate single-date template concept wasn't needed either.

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
  memberFunctions: { [uid]: [string] }  ← leader-assigned eligibility; absent/empty for a uid
                                          means locked out of claiming and seeing slots until
                                          a leader assigns at least one function
  functions: [string]                 ← this team's own grown autocomplete list
  joinPolicy: "open" | "approval" | "invite-only"
  pendingMembers: [uid]                ← for "approval" joinPolicy, mirrors /groups
  createdAt, updatedAt, createdBy

/servingTeams/{teamId}/schedules/{scheduleId}
  name: string                         ← e.g. "EGC Elands"
  patterns: [{ id, dayOfWeek: 0-6, label: string|null, functions: [string] }]
                                        ← dayOfWeek matches Date#getDay() (0=Sunday)
  startDate, endDate: string (YYYY-MM-DD)   ← persisted so Edit/Regenerate know what to recreate
  createdAt, updatedAt, createdBy

/servingTeams/{teamId}/slots/{slotId}
  date: string (YYYY-MM-DD)
  label: string|null                   ← optional service-time label (e.g. "Morning"), copied
                                          from the schedule pattern that generated this slot, or
                                          set manually for a one-off slot on a multi-service day
  scheduleId: string|null              ← which /schedules doc generated this slot; null for a
                                          manually-added slot (via "Add Slot") — untouched by any
                                          schedule's regenerate/delete
  functions: [string]                  ← 1+ function names bundled onto this slot
  assignedUid, assignedName: uid|null, string|null     ← lead/primary position
  trainingEnabled: boolean             ← opt-in, set at creation, static
  traineeUid, traineeName: uid|null, string|null
  status: "open" | "filled"            ← derived from assignedUid, stored for query convenience
  notes
  createdBy, createdAt, updatedAt

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

- **Phase 1 (delivered):** Teams (CRUD, join/leave/approve), members + tier, functions,
  roster slots (leader-create, leader-assign, training-pairing flag), member-facing roster
  view, self-claim + "can't make it" release. Plus: add a member by UID (covers
  invite-only teams), and a "Member ID" copy field on `/profile.html` so members can
  self-serve their own UID.
- **Phase 1.5 (delivered):** Schedules — named, persistent recurrence definitions
  (day-of-week patterns + optional service-time label + date range) that bulk-create
  slots in one action and tag every slot they create, so a mistake can be fixed by
  editing the schedule and regenerating — delete + recreate exactly its own slots —
  instead of a manual hunt-and-delete. Delete-schedule cascades to its slots. Both
  regenerate and delete warn with a count, flagging how many affected slots already
  have a volunteer assigned.
- **Phase 1.6 (delivered):** Member functions — leader-assigned per-member function
  eligibility (`memberFunctions`). Gates claiming (enforced in rules) and filters a
  member's roster view to only their assigned functions. Locked out by default (no
  functions assigned = sees/claims nothing) rather than open-by-default, so this doesn't
  silently change behavior for existing members the moment it ships.
- **Phase 1.7 (planned next):** Day/time availability on top of function eligibility
  (e.g. "Sound, but only Sunday mornings") and an auto-assign rotation option on a
  schedule's generate/regenerate that fills slots from the available+eligible pool
  instead of leaving everything open.
- **Phase 2 (future):** Equipment Register + Moves, scoped to the Equipment Team.
- **Explicitly deferred / not in scope yet:** push notifications when a slot opens up
  (claiming is currently "check the roster," not pushed); a personal "my upcoming slots
  across all teams I'm on" combined view.
