# WhatsApp Notifications (Phase 3)

> Design + status for the WhatsApp messaging channel. Keep updated as stages land.

## Status

- **Stage 1 — Opt-in: DONE.** Profile "Notifications" card with a `notifyWhatsApp`
  toggle on `/users/{uid}` (default off = the Meta-required consent), using the
  member's profile phone. Shipped session 99 (PR #155).
- **Stage 2 — Sending: ON HOLD (Session 193).** The church is getting a dedicated
  prepaid SIM for the sender number and will set up the Meta Business/developer
  account — see "Getting started" below for the exact steps. Nothing further is
  built (no code changes this session) until that account exists and hands back
  the two secrets listed below; the earlier "number doesn't exist yet" blocker
  itself is now resolved/in progress.

## Getting started (Meta/business side — not this codebase)

Do these once the prepaid SIM is active, in order:

1. **Get the SIM able to receive an OTP, with no existing WhatsApp account on it.**
   A number that has ever been opened in the WhatsApp app (personal or business)
   must have that account deleted first — Meta won't let you register it on the
   Cloud API otherwise. Needs to receive an SMS or voice-call verification code
   during setup.
2. **Create a Meta Business Account** at business.facebook.com for EGC (legal
   name, address — church registration details are fine).
3. **Business verification** — upload documentation (e.g. NPO/church
   registration, a utility bill or similar proof of address). Meta states
   2–10 business days. Test messages work before this completes; production
   sending needs it.
4. **Create a Meta App** (type: Business) at developers.facebook.com, add the
   **WhatsApp** product — this generates a test WABA (WhatsApp Business Account).
5. **Add the real phone number** to that WABA and verify it via the OTP from
   step 1.
6. **Create a System User** in Meta Business Suite, grant it
   `whatsapp_business_messaging` permission, and generate a **permanent access
   token** from it (the quick-start temporary token expires in 24h — not usable
   here; see Secrets below).
7. **Submit the message template for approval** — see Template section below.
   Usually fast (minutes to a few hours) once the business is verified.
8. **Add a payment method** to the Meta Business Account for billing.

Once done, hand back `WHATSAPP_TOKEN` (the permanent System User token) and
`WHATSAPP_PHONE_NUMBER_ID` (shown on the app's WhatsApp > API Setup page) to
resume the Stage 2 build steps below.

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

**Pricing model (corrected Session 193):** Meta moved off per-24h-conversation billing
in mid-2025 — WhatsApp is now billed **per delivered template message**. Our template
(`egc_notification`, see below) is **Utility** category, which is priced roughly
80-90% cheaper than Marketing-category messages, and is **free entirely** when sent
within 24h of the customer's last message to us (a "customer service window") — unlikely
to apply to most of our broadcasts, which are business-initiated, not replies. Check
[Meta's current rate card](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
for South Africa's per-message utility rate before enabling any high-volume fan-out
(digests, prayer alerts) — rates are updated periodically (next update noted for
2026-07-01) and vary by recipient's country, not the sender's.

Regardless of the exact rate, sending is still never automatic: the admin send form
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

## Stage 2 build steps (when the secrets are ready)

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
