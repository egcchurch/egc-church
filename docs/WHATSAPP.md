# WhatsApp Notifications (Phase 3)

> Design + status for the WhatsApp messaging channel. Keep updated as stages land.

## Status

- **Stage 1 — Opt-in: DONE.** Profile "Notifications" card with a `notifyWhatsApp`
  toggle on `/users/{uid}` (default off = the Meta-required consent), using the
  member's profile phone. Shipped session 99 (PR #155).
- **Stage 2 — Sending: BLOCKED** on the church obtaining a dedicated **WhatsApp
  Business sender number**, plus the Meta WABA, an approved template, and the
  secrets below. Nothing further is built until the number exists (untestable and
  potentially throwaway without it).

## Provider

**Meta WhatsApp Cloud API** (direct). SMSPortal has no WhatsApp; Twilio ruled out
on USD pricing for South African volume.

## Channel model

| Message type | Channels |
| --- | --- |
| Event registration (cottage; future youth camps/banquets) | in-app + push + **SMS** (opt-in at registration) — already shipped |
| General messaging (announcements/notices, prayer alerts, digests) | in-app + push + **WhatsApp** (per profile opt-in) |

WhatsApp also carries event confirmations for members who opted in. In-app is always on.

## Recipients & de-duplication (key design)

For any WhatsApp send, recipients are a **union, de-duplicated by normalised number**
(`27XXXXXXXXX`):

1. **App members** with `notifyWhatsApp == true` and a `phone`.
2. **Imported external contacts** — older members on the existing church WhatsApp
   groups who won't install/use the app — **minus** any number that matches an app
   user's phone.

Rationale: app users receive in-app (and WhatsApp only if opted in); they must never
be double-messaged. The imported list reaches only non-app people. So when a broadcast
goes out: app users → in-app (+ WhatsApp if opted in); imported non-app numbers → WhatsApp.

## Per-broadcast channel selection (cost control)

WhatsApp is billed **per conversation**, so it is never automatic. The admin send form
(`admin/notifications.html`) gains channel toggles; a broadcast goes to WhatsApp only
when explicitly selected. `sendBroadcast` takes a channel flag and only runs the
WhatsApp fan-out when set. (We can also trim which *automatic* notices — prayer alerts,
digests — go to WhatsApp if volume/cost is high.)

## Imported contact list

- Collection `whatsappContacts/{id}`: `{ name?, phone, addedBy, addedAt }`,
  managed by `notifications.send` / superadmin.
- Admin UI to add / import / remove numbers.
- **POPIA:** only import numbers from people who have consented (existing church
  WhatsApp group members).
- Open questions for build time: import mechanism (manual add vs CSV/paste), and
  whether the list needs grouping/segmentation (e.g. youth vs whole-church).

## Template

- Category **Utility**, language **en_US**, name **`egc_notification`**.
- Body: `Hi! You have an update from Emmanuel Gospel Centre:` *(blank line)* `{{1}}`.
- Each notice's text is passed as `{{1}}`. Per Meta rules, template parameters cannot
  contain newlines, tabs, or 4+ consecutive spaces — the sender flattens the body text.

## Secrets

- `WHATSAPP_TOKEN` (System User permanent token, `whatsapp_business_messaging`)
- `WHATSAPP_PHONE_NUMBER_ID`

Both must exist in Secret Manager **before** deploying any function that lists them in
`runWith` (same constraint as the SMSPortal secrets).

## Stage 2 build steps (when the number is ready)

1. `sendWhatsApp(toNumber, bodyText)` — Graph `POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages`,
   Bearer token, `type: template` with the `egc_notification` body parameter. Reuses
   `normaliseSaNumber()`. Best-effort (logs + returns false; never blocks the caller);
   no-op when secrets unset.
2. **Recipient resolver** — app opted-in members + imported contacts, de-duped by
   normalised number (drop imported numbers that belong to an app user).
3. Wire into `sendUserNotification` (cottage/per-user) and the fan-outs
   (`sendBroadcast`, `onNewPrayerRequest`, `weeklyDigest`), gated per-broadcast where
   applicable. Add the WhatsApp secrets to those functions' `runWith`.
4. Admin UI: per-broadcast channel toggles on `admin/notifications.html`; contact-list
   management.
5. Verify against a mocked Graph API (as done for SMSPortal); **validate live on the
   cottage path first** before enabling the broadcast/prayer/digest fan-outs.
