# Event Registration

> Design doc for optional per-event RSVP toggle + dynamic registration forms.
> Keep updated as phases land — mirrors the phasing style of `docs/SERVING_TEAMS.md`.

---

## Why this exists

`/events` already has a simple RSVP feature (members tap "Going" / "RSVP", Event Management
shows a count) — but it's always-on for every event, with no way to turn it off. Not every
calendar entry needs it: an announcement like "a visiting minister will be with us next
Wednesday" is just informational — there's nothing to reserve, and showing an RSVP button on
it is misleading.

Separately, the church has historically used Google Forms for anything that actually needs
**registration** — youth camps, family camps — collecting attendee details (and, for other
assemblies attending, which assembly they're from), confirming by email/SMS, and referencing
a payment made outside the app (EFT/deposit slip) against a reference code. Google Forms
doesn't integrate with the rest of the site (no capacity awareness, no shared attendee data,
separate confirmation flow per form). This is a **different, bigger feature** than RSVP, not
an extension of it: RSVP requires a member login; registration must also work for people from
other assemblies who have no account on this app at all.

---

## Core concepts

### RSVP toggle (`rsvpEnabled`)
A simple boolean on the event doc. Default `true` (matches today's always-on behavior for
every event that existed before this shipped). When `false`, `events.js` renders no RSVP UI
at all for that event — it still appears as a normal upcoming item.

### Registration (`registration` map on the event doc)
A **separate, optional** subsystem, off by default. When enabled, the event gets:

- **Audience gating independent from the event's own visibility.** An event's `audience`
  field (`public`/`members`) controls whether the event is *listed* at all. `registration.audience`
  controls who can *submit* — a members-only family camp could still be listed publicly for
  awareness while only members can actually register, and conversely a publicly-listed event
  could restrict registration to members only. Two separate knobs, deliberately.
- **Optional capacity.** `registration.capacity` is `null` for unlimited (family camp — bring
  your own tent, space isn't the constraint) or a number for a hard limit (youth camp — beds/
  space actually run out). When set, `registration.seatsTaken` is maintained transactionally,
  identical in spirit to Cottage Meetings' `capacity`/`seatsTaken` pattern — a plain client
  write can't safely enforce a hard cap under concurrent submissions.
- **Dynamic questions.** `registration.fields` is an admin-defined list of questions
  (`{ id, label, type, required, options }`) — the exact "questions vary per event" need from
  the old Google Forms. A handful of common fields (name, phone, email, home assembly) are
  always present as built-ins rather than re-typed as custom questions every time, since they
  were universal on every past form.
- **Reference codes.** Each submission gets `referenceCode = refPrefix + '-' + lastName`
  (e.g. `YC-202603-SMITH`), built from an admin-set `registration.refPrefix` (e.g.
  `"YC-202603"` for "Youth Camp, 2026 March"). Payment itself stays fully outside the app
  (proof is emailed or, once Phase B3 ships, uploaded) — the reference code is just what the
  church quotes back when reconciling an EFT/deposit against a name.
- **Proof-of-payment upload (Phase B3).** An optional file attached to a submission, since
  a scanned deposit slip alongside the reference code is how this has always worked. Uploaded
  to Storage at a path scoped to that one registration; admin views it and marks
  `paymentConfirmed`.

### Party model — contact + attendees (Phase C1)
A registration is **one contact registering a party of one or more attendees**, not one
document per person. This came directly from a real need: a mother registering her 3
children for a youth camp should submit once, get **one** reference code covering all three,
and have the event's capacity correctly charged 3 seats — not 1. `contact` is who to reach
(name, phone, email, home assembly); `attendees[]` is who's actually going, and the contact
isn't assumed to be one of them (a parent registering only their kids, not themselves, is the
common case). Each attendee answers the event's dynamic questions **individually** (a T-shirt
size or dietary need is per-child, not per-family) — the questions themselves are still
defined once per event, only the *answers* repeat per attendee.

### Deduplication — warn and let the registrant decide, not a hard block (Phase C1)
Before creating a registration, `registerForEvent` checks whether this event already has a
registration from a matching phone or email. Rather than rejecting outright, it returns a
distinguishable signal (an `already-exists` error carrying the existing registration's
submission date) that the client turns into a confirmation prompt: *"There's already a
registration for this phone number, submitted on [date]. Are you sure you want to create
another one?"* If confirmed, the client resubmits the identical data with
`confirmDuplicate: true`, which the function honors and creates the second registration
anyway. This is deliberately **not** an admin-mediated override — the scenario that needs it
(a mother registering her own kids in one submission and separately her nephews in another)
is the registrant's own legitimate call to make, not something that should need a superadmin
to unblock after the fact.

### Moderation (Phase C2)
An optional per-event "Require approval" toggle (off by default, alongside the existing
Registration toggles). When on, a submission lands as `status: "pending"` rather than being
auto-accepted — its seats are still reserved immediately against capacity (so a pile-up of
unreviewed pending requests can't be over-approved past the limit later), but the
reference-code confirmation doesn't go out until an admin approves it. Declining releases the
reserved seats (re-approving re-reserves them, re-checking capacity in case seats filled up in
the meantime). Mirrors the existing pending-member approve/decline pattern already used by
Groups and Serving Teams, though as a Cloud Function rather than a direct client write — unlike
a plain pending-member array, this has to keep `seatsTaken` correct transactionally.

### Find my registration (Phase C3)
Since most registrations are anonymous by design (no login required), there's no "my
registrations" view the way a logged-in member gets one elsewhere on the site. A small public
lookup — reference code + a matching phone or email (whichever the contact originally gave;
`registerForEvent` only requires one of the two, so the lookup can't demand phone specifically)
— lets a registrant reach their own submission again to attach (or replace) a proof-of-payment
file via the existing `attachRegistrationProof` flow, without needing a real email confirmation
link (still not wired up — Phase B4) or an account. Shown as an "Already registered? Attach
payment proof" link next to the Register button on any event with registration enabled —
including once the event is full, since an existing registrant still needs this regardless of
current capacity.

### First/last name split
Built-in `firstName`/`lastName` fields rather than a single "name" box — needed to reliably
extract a surname for the reference code without guessing at word order.

### Public submissions
When `registration.audience === "public"`, anyone can submit with no login — modeled directly
on `/connect.html`'s existing public-unauthenticated-write pattern (validated shape/size in
Firestore rules, no ability to read others' submissions). This is the only way "someone from
another assembly with no account on this app" can register at all.

### Why a Cloud Function, not a direct client write
`registerForEvent` (callable) does the actual submission — mirrors `registerForCottageMeeting`'s
reasoning exactly: a public, possibly-unauthenticated form can't be trusted to self-validate
which fields are required, and capacity enforcement needs a transaction, not a client-side
read-then-write.

### Email — provisioned, not wired (deferred to Phase B4)
No email-sending capability exists anywhere in this codebase yet (Firebase Auth only sends
its own fixed templates — verification, password reset — nothing custom). SMS reuses the
already-working SMSPortal integration from Cottage Meetings immediately. A `sendEmail()`
helper is added now as a no-op (mirrors exactly how `sendSms` already no-ops when the
SMSPortal secrets aren't configured) so that once the church's own domain and a dedicated
communications mailbox exist post-launch, wiring in a real provider (Brevo was the pick when
this happens) is filling in one function body — not a schema or flow change.

---

## Data model

```
/events/{eventId}
  ...existing fields (title, description, location, category, audience, startDate, endDate,
     imageUrl, published, rsvps — unchanged)...

  rsvpEnabled: boolean                 ← Phase A. Default true (absent = true, so every
                                          pre-existing event keeps behaving exactly as before)

  registration: {                      ← Phase B1+, absent/enabled:false = no registration UI
    enabled: boolean
    audience: "public" | "members"     ← who may submit (independent of the event's own audience)
    capacity: number | null            ← null = unlimited; set = hard cap (Phase B2 enforces it)
    seatsTaken: number                 ← Phase B2 — maintained transactionally by registerForEvent;
                                          Phase C1 changed this to count attendees, not
                                          registrations (a 3-child party uses 3 seats, not 1)
    refPrefix: string | null           ← e.g. "YC-202603" — admin sets once when enabling
    requiresApproval: boolean          ← Phase C2 — default false; when true, new registrations
                                          start status: "pending" instead of "approved"
    fields: [                          ← admin-defined dynamic questions, Phase B1, answered
                                          per-attendee since Phase C1
      { id, label, type: "text"|"email"|"phone"|"number"|"textarea"|"select"|"checkbox",
        required: boolean, options: [string] (only for "select") }
    ]
  }

/events/{eventId}/registrations/{id}   ← Phase B1, restructured in Phase C1
  contact: {                          ← who to reach — not assumed to be an attendee themselves
    firstName, lastName               ← lastName drives referenceCode
    phone, email (nullable — at least one of the two is required, for dedup + SMS)
    assembly (nullable string)        ← "which assembly are you from"
  }
  attendees: [                        ← Phase C1 — one or more people, e.g. a parent's 3 children
    { firstName, lastName, answers: { [fieldId]: string } }  ← per-attendee dynamic answers
  ]
  seatsUsed: number                   ← Phase C1 — attendees.length; what capacity actually counts
                                         against (a party of 3 uses 3 seats, not 1)
  status: "pending" | "approved" | "declined"   ← Phase C2. "pending"/"approved" both count
                                         toward registration.seatsTaken; "declined" releases them.
                                         Set by registerForEvent at creation and by
                                         setRegistrationStatus (events.manage) afterwards
  referenceCode: string               ← refPrefix + "-" + uppercased contact.lastName; covers
                                         the whole party, one code regardless of attendee count
  proofOfPaymentUrl: string | null    ← Phase B3 — Storage URL if uploaded
  paymentConfirmed: boolean           ← Phase B3 — admin marks true after checking the proof
  uid: string | null                  ← set if submitted while signed in; null for public/anonymous
  submittedAt (timestamp)

Storage (Phase B3):
/events/{eventId}/registrations/{registrationId}/{fileName}
  ← proof-of-payment upload; public create (size/type validated only — no auth requirement,
    since a public submitter may have no account); admin-only read/delete
```

---

## Permission model

- **`rsvpEnabled`** — set via the existing event editor, gated by the existing `events.manage`
  permission. No new permission key.
- **`registration` config** (enable/audience/capacity/refPrefix/fields) — same, gated by
  `events.manage`. No new permission key.
- **Submitting a registration** — gated by `registration.audience`, not by any admin
  permission: `"public"` = anyone (including signed-out visitors), `"members"` = signed-in
  members only. Enforced inside `registerForEvent`, mirroring how `registerForCottageMeeting`
  enforces membership today.
- **Reading registrations / marking paid / approving / declining** — `events.manage` only. A
  registrant never has read access to any submission (including their own, currently) — same
  posture as `/connect`, where a submitter can't read back their own form either.

---

## Phasing

All planned phases (A, B1-B3, C1-C3) are now delivered — only Phase B4 (real email) remains,
deliberately deferred until the church has its own domain and a comms mailbox post-launch.

- **Phase A (delivered):** `rsvpEnabled` toggle. Admin checkbox on the event form (default
  checked), `events.js` skips all RSVP rendering when `false`. No new permission, no Cloud
  Function, no rules change.
- **Phase B1 (delivered):** `registration` config block in the admin event form incl. a
  dynamic question builder (add/remove rows — same UX pattern as Serving Teams' schedule-pattern
  builder); `registerForEvent` callable (public/members gating, required-field validation,
  reference code generation, SMS confirmation via the existing SMSPortal integration,
  `seatsTaken` running count for the admin badge but no capacity *enforcement* yet); a public
  registration modal (`js/event-registration.js`) on `events.html`; an admin registrations list
  per event (view answers + reference code).
- **Phase B2 (delivered):** `capacity`/`seatsTaken` transactional enforcement in
  `registerForEvent`, mirroring `registerForCottageMeeting`'s transaction exactly. Optional per
  event — events with `capacity: null` (the default, blank in the admin form) are unaffected. The
  admin form shows a "Registered so far" count (`N / capacity` or `N (unlimited)`), the admin
  list badge turns red once full, and the public "Register" button is replaced with a
  "Registration full" pill (a courtesy display only — `registerForEvent` is still the actual
  enforcement, since the displayed count can be stale under concurrent registrations).
- **Phase B3 (delivered):** Storage path `/events/{eventId}/registrations/{registrationId}/{fileName}`
  — public create (size/type validated only, no auth requirement), admin-only read/delete. The
  registrant optionally attaches a proof-of-payment file at submission (uploaded client-side via
  `js/storage-upload.js`, the only module that talks to Storage) — since a public submitter may
  have no account, a new `attachRegistrationProof` callable persists the resulting URL on the
  registration doc afterwards (the collection otherwise denies all client writes). The admin
  registrations list shows a "View proof" link and a "Mark Paid" toggle (`paymentConfirmed`) —
  the one field on a registration doc `events.manage` can write directly, since it's a plain
  boolean with no business logic to enforce, unlike everything `registerForEvent` does.
- **Phase B4 (deferred — blocked on the church's own domain/mailbox existing post-launch):**
  wire a real email provider (Brevo) into the `sendEmail()` stub added in Phase B1.
- **Phase C1 (in progress):** party model — `contact` + `attendees[]` replaces one-doc-per-person;
  per-attendee dynamic answers; capacity now charges `attendees.length` seats per registration,
  not 1; dedup check on phone/email with a soft warn-and-confirm flow (not a hard block) that
  shows the existing registration's submission date and lets the registrant proceed anyway with
  `confirmDuplicate: true`.
- **Phase C2 (delivered):** per-event "Require approval" toggle (`registration.requiresApproval`,
  off by default). A submission's `status` starts `"pending"` when on, `"approved"` otherwise
  (unchanged behavior for every event that doesn't use moderation). Pending reserves seats
  immediately — capacity can't be over-approved later by a pile-up of unreviewed requests — and
  the reference code is withheld from the registrant until approved (asking someone to pay
  against a registration that might still be declined would be premature); a holding SMS/email is
  sent instead. New `setRegistrationStatus` callable (`events.manage`) does the approve/decline —
  unlike `paymentConfirmed`, this goes through a Cloud Function rather than a direct client write
  because declining has to release the reserved seats transactionally (re-approving re-reserves
  them, re-checking capacity). Approving sends the real reference-code confirmation for the first
  time; declining sends a polite "could not be accepted" notice. Admin registrations list shows a
  Pending/Approved/Declined badge and Approve/Decline buttons per registration.
- **Phase C3 (delivered):** public "Find my registration" lookup — new `lookupRegistration`
  callable, requires the reference code plus a matching phone or email (accepts either, since
  only one is guaranteed on the original submission). Returns just enough (contact first name,
  attendee count, status, whether proof is already on file) to render an attach/replace-proof
  step reusing `attachRegistrationProof`. Shown as a link next to the Register button on any
  event with registration enabled, including once full.
- **Explicitly out of scope for now:** real-time online payment collection (a full payment
  gateway integration — e.g. PayFast — would be a separate project on its own); registration
  deadlines/close dates; waitlists once a capacity-limited event is full (may follow the same
  pattern as capacity itself later if needed).
