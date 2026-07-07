# Equipment Register + Moves

> Design doc for the church-wide equipment register. Originally built as Serving Teams
> Phase 2 (Session 195, nested under a team); restructured as its own church-wide section
> in Session 197 — see "History" at the bottom for why.

---

## What it is (and isn't)

Not a booking/reservation calendar. The register answers two questions:

1. **What does the church own?** — name, category, condition, photo, and (privileged)
   purchase cost/date per item. Enough for "what would we claim on insurance" or "what
   needs replacing" without becoming full asset-management software: no maintenance
   history, no custodian assignment, no depreciation.
2. **Where is each item right now?** (e.g. "Elands" vs "Nestpark") — kept accurate via a
   **move**: pick a destination venue and a checklist of items, check them off as they're
   packed, and on completion each **checked-off** item's known location updates to the
   destination. Unpacked items are left as-is, so a partially-completed move doesn't
   wrongly relocate things that never actually moved. The move *is* the checklist — no
   separate data-entry step beyond what a move naturally produces.

Lives at `/members/equipment.html`, linked from the members nav. Designed to be used from
a phone mid-move.

---

## Access model — two tiers, deliberately different mechanisms

| Tier | Mechanism | Can do |
| --- | --- | --- |
| **Equipment manager** | `equipment.manage` permission key (custom claim, assigned via a role on `/admin/roles.html`) | Everything: add/edit/retire/delete items, see and edit purchase costs, manage the equipment-users list, cancel anyone's move |
| **Equipment user** | uid listed on `/equipmentAccess/users` (managed by managers from the page's Users tab — live member search, add/remove chips) | Open the register; see items, locations, conditions (NOT costs); start moves, check items off, complete moves; cancel their own moves |

Everyone else — including ordinary church members — sees an access-denied card telling
them to ask an equipment manager.

**Why the user tier is a uid list, not a permission key:** several places in this codebase
treat any role-holder as an admin (admin notification fan-outs like connect-form alerts,
admin nav visibility). That's right for the coordinator, wrong for the six helpers who
just pack trailers on a Saturday. A plain list on a Firestore doc grants access without
making anyone an "admin".

**Why costs live on a separate subdoc:** Firestore rules can't hide individual fields of a
readable document — if cost sat on the item doc, any equipment user could read it with dev
tools regardless of the UI. `purchaseCost`/`purchaseDate` therefore live on
`/equipment/{itemId}/private/finance`, readable/writable only by `equipment.manage`
holders. The privilege is rules-enforced, not cosmetic.

---

## Data model

```
/equipmentAccess/users                  ← singleton access-list doc, manager-only read/write
  uids: [uid]                           ← checked by rules (isEquipmentUser()) on every
                                           equipment/move read and write
  names: { [uid]: displayName }         ← denormalized for the Users tab chips; stale on
                                           rename, same trade-off as slot assignedName

/equipment/{itemId}
  name: string
  category: string|null                 ← free text, datalist autocomplete from existing items
  description, notes: string|null
  condition: "good" | "fair" | "needs repair" | "retired"   ← default "good"
  currentLocation: string|null          ← free text, datalist autocomplete
  photoUrl: string|null                 ← Firebase Storage, /equipment/{itemId}/photo.jpg
  lastMovedAt, lastMovedBy: timestamp|null, uid|null   ← set only by completing a move
  createdBy, createdAt, updatedAt

/equipment/{itemId}/private/finance     ← manager-only subdoc (see access model above)
  purchaseCost: number|null
  purchaseDate: string (YYYY-MM-DD)|null

/equipmentMoves/{moveId}
  fromLocation: string|null             ← optional (not always known/relevant)
  toLocation: string                    ← required
  scheduledFor: string (YYYY-MM-DD)|null
  status: "in-progress" | "complete"
  items: [{ equipmentId, name, packed: bool }]   ← name denormalized for checklist display
  createdBy, createdByName, createdAt, completedAt: timestamp|null
```

## Rules highlights

- An equipment user's ONLY write on an item doc is the location-fields set
  (`currentLocation`, `lastMovedAt`, `lastMovedBy`, `updatedAt`) — exactly what completing
  a move batches in. Everything else is manager-only.
- Moves are a collaborative checklist: any equipment user can create/update any move
  (checking off items is a shared job). Deleting (cancelling) a move is restricted to the
  creator or a manager.
- Checkbox toggles run in a `db.runTransaction()` (re-read fresh, flip one index) so two
  people packing simultaneously don't clobber each other's checkmarks.
- Deleting an item referenced by an in-progress move is blocked client-side — otherwise
  `completeMove()`'s batch would throw NOT_FOUND and the move could never complete.

---

## History

- **Session 195 (PR #324):** built as Serving Teams Phase 2 — data nested under
  `/servingTeams/{teamId}/equipment`, access tied to team membership, reached via an
  Equipment button on the team card.
- **Session 197:** restructured church-wide after the user pointed out equipment belongs
  to the church, not a team — team-scoped data fragmented the register (a second team's
  gear would be invisible to the first), gated visibility on team membership (a treasurer
  couldn't see asset values without joining the team), and trapped the data under a doc
  that could be renamed/dissolved. The per-team version was removed in the same PR that
  added this one; the only data lost was test data. Also added in the restructure, on user
  request: costs became a rules-enforced privilege rather than visible to every viewer.
