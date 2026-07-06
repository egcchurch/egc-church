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
    seatsTaken: number                 ← Phase B2 — maintained transactionally by registerForEvent
    refPrefix: string | null           ← e.g. "YC-202603" — admin sets once when enabling
    fields: [                          ← admin-defined dynamic questions, Phase B1
      { id, label, type: "text"|"email"|"phone"|"number"|"textarea"|"select"|"checkbox",
        required: boolean, options: [string] (only for "select") }
    ]
  }

/events/{eventId}/registrations/{id}   ← Phase B1
  firstName, lastName                 ← built-in, always present (lastName drives referenceCode)
  phone, email (nullable)             ← built-in
  assembly (nullable string)          ← built-in — "which assembly are you from"
  answers: { [fieldId]: string }      ← dynamic question answers, keyed by registration.fields[].id
  referenceCode: string               ← refPrefix + "-" + uppercased lastName
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
- **Reading registrations / marking paid** — `events.manage` only. A registrant never has read
  access to any submission (including their own, currently) — same posture as `/connect`,
  where a submitter can't read back their own form either.

---

## Phasing

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
- **Explicitly out of scope for now:** real-time online payment collection (a full payment
  gateway integration — e.g. PayFast — would be a separate project on its own); registration
  deadlines/close dates; waitlists once a capacity-limited event is full (may follow the same
  pattern as capacity itself later if needed).
