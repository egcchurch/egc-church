# Phase 9 — Page Composition

> Planning document. Source of truth for the section manager system.
> Save to the repo as `docs/PHASE9.md`. Keep updated as PRs land.

---

## Overview

Phase 8 introduced `/config/` Firestore documents and the admin settings UI.
Phase 9 builds on top of it: a visual section manager that lets superadmins
toggle predefined page sections on/off and reorder them — no code changes required.

Sections are fixed in design. The superadmin cannot change how a section looks,
only which sections appear and in what order.

---

## Scope

Three pages are in scope:

| Page | URL | Sections managed |
|---|---|---|
| Homepage | `/` | 6 sections (see below) |
| About | `/about` | 2 sections |
| Members dashboard | `/members/` | 6 dashboard cards |

---

## Data Model

Section config lives in `/config/pages/{pageId}` — one doc per managed page.
This extends the existing `/config/` collection (Phase 8a) with no schema change
to the security rules (superadmin write, signed-in read).

```
/config/pages/homepage
  sections: [
    { id: "hero",           enabled: true,  order: 1 },
    { id: "serviceTimes",   enabled: true,  order: 2 },
    { id: "latestSermons",  enabled: true,  order: 3 },
    { id: "upcomingEvents", enabled: true,  order: 4 },
    { id: "explore",        enabled: true,  order: 5 },
    { id: "connectCta",     enabled: true,  order: 6 },
  ]

/config/pages/about
  sections: [
    { id: "mission",    enabled: true, order: 1 },
    { id: "leadership", enabled: true, order: 2 },
  ]

/config/pages/members
  sections: [
    { id: "directory",   enabled: true, order: 1 },
    { id: "groups",      enabled: true, order: 2 },
    { id: "prayer",      enabled: true, order: 3 },
    { id: "devotional",  enabled: true, order: 4 },
    { id: "gallery",     enabled: true, order: 5 },
    { id: "liveStream",  enabled: true, order: 6 },
  ]
```

**Default behaviour:** if no `/config/pages/{pageId}` doc exists, all sections
are shown in their natural HTML order. Safe default — no doc needed for EGC
until a superadmin explicitly customises a page.

**Sections are applied client-side** after auth resolves (same pattern as
`applyBranding()` and `applyFeatures()` in `js/main.js`). Each page calls a
shared `applySections(pageId)` function from `js/main.js`.

---

## Homepage Sections

The homepage currently has: hero, announcement, service times, adaptive (live
stream / devotional), and an explore grid. Phase 9 restructures it with named
section IDs and adds two new dynamic sections.

| Section ID | Description | Hideable? | Content source |
|---|---|---|---|
| `hero` | Full-screen video hero with tagline | No — always shown | `/admin/homepage` |
| `serviceTimes` | "Join Us" schedule grid | Yes | `/admin/homepage` |
| `latestSermons` | 3 most recent published sermons | Yes | `/admin/sermons` |
| `upcomingEvents` | 3 nearest upcoming events | Yes | `/admin/events` |
| `explore` | 4-card quick-links grid (Sermons, Events, Music, Connect) | Yes | Static |
| `connectCta` | "Plan a Visit" full-width call-to-action banner | Yes | `/admin/settings` → church info |

Notes:
- The **announcement banner** (`#announcement-section`) is already conditional
  on Firestore content (only appears when `homepage/content.announcement.active`
  is true). It is not managed by Phase 9 section composition — it stays exactly
  as-is and renders between hero and whatever comes first in the section order.
- The **adaptive section** (live stream / devotional for logged-in members) is
  also not managed by Phase 9 — it is auth-state driven and always injects after
  the announcement.
- `hero` is excluded from the section order because removing it would make the
  page unusable. The toggle is hidden in the admin UI for this section.

---

## About Page Sections

| Section ID | Description | Content source |
|---|---|---|
| `mission` | Intro text and church mission statement | Firestore `/config/church.tagline` + static copy |
| `leadership` | Leadership team profile grid | `/admin/team` |

---

## Members Dashboard Sections

The 6 dashboard navigation cards. Each card maps to a member feature.
Phase 9 also fixes the existing gap where the Phase 8d feature flags hide nav
links but NOT the dashboard cards — section composition and feature flags are
unified here.

| Section ID | Card | Feature flag |
|---|---|---|
| `directory` | Member Directory | — (always available) |
| `groups` | Small Groups | `groups` |
| `prayer` | Prayer Requests | — (always available) |
| `devotional` | Daily Devotional | `devotional` |
| `gallery` | Members Gallery | `gallery` |
| `liveStream` | Live Stream | `liveStream` |

If a feature flag is `false` in `/config/features`, the corresponding dashboard
card is hidden regardless of the section config. Feature flags take precedence.

---

## Admin UI — `/admin/pages.html`

New page, superadmin only. Three tabs (Homepage, About, Members Dashboard).

Each tab shows the page's sections as a list:
- Section name and description
- Toggle switch (enabled / disabled)
- Up / Down buttons to reorder
- A label showing where to edit the section's content ("Edit content → /admin/sermons")

Sections are persisted to Firestore on every reorder/toggle (no separate Save
button — each action is instant).

The `hero` section row shows the toggle as disabled/greyed out with a tooltip
explaining it cannot be hidden.

---

## `js/main.js` addition — `applySections(pageId)`

```js
async function applySections(pageId) {
  // Reads /config/pages/{pageId} and applies section order + visibility
  // to elements with matching [data-section] attributes.
  // If no doc exists, does nothing (natural HTML order preserved).
}
```

Each managed section in the HTML gets `data-section="{id}"` on its wrapper
element. `applySections` sorts visible `[data-section]` elements by their
configured order and removes from DOM (or hides) disabled ones.

Called once per page after auth resolves, immediately after `applyFeatures()`.

---

## New Homepage Sections (HTML)

Two sections are added to `index.html`:

**`latestSermons`** — below service times:
```html
<section data-section="latestSermons" id="latest-sermons-section" class="bg-white py-14 px-6">
  <div class="max-w-7xl mx-auto">
    <h2>Latest Sermons</h2>
    <!-- 3-card grid populated from /sermons, published=true, sorted by date desc -->
    <a href="/sermons.html">View all sermons</a>
  </div>
</section>
```

**`upcomingEvents`** — below sermons:
```html
<section data-section="upcomingEvents" id="upcoming-events-section" class="bg-zinc-50 py-14 px-6">
  <div class="max-w-7xl mx-auto">
    <h2>Upcoming Events</h2>
    <!-- 3-card grid populated from /events, published=true, startDate >= today -->
    <a href="/events.html">View all events</a>
  </div>
</section>
```

**`connectCta`** — at the bottom:
```html
<section data-section="connectCta" id="connect-cta-section" class="bg-[#0A3D62] text-white py-16 px-6">
  <!-- "We'd love to meet you" message + link to /connect -->
</section>
```

---

## Firestore Rules

No change needed. `/config/{document}` already covers `/config/pages/{pageId}`
with the existing rule:
```
match /config/{document} {
  allow read: if isSignedIn();
  allow write: if isSuperadmin();
}
```

However, sub-collections (`/config/pages/{pageId}`) are a sub-path and require
a separate rule:
```
match /config/pages/{pageId} {
  allow read: if isSignedIn();
  allow write: if isSuperadmin();
}
```

---

## Sub-Phases

| Sub-phase | Scope | Dependencies |
|---|---|---|
| **9a — Foundation** | `applySections()` in `js/main.js`; add `data-section` attrs + new sections to `index.html`; add `data-section` to `about.html` + `members/index.html`; update `firestore.rules` | Phase 8 complete |
| **9b — Admin pages UI** | New `/admin/pages.html` — section manager with toggle and reorder for all 3 pages | 9a |

Two PRs. 9a wires the client-side plumbing; 9b adds the admin control surface.

---

## Status

| Sub-phase | Status |
|---|---|
| 9a — Foundation | Complete — PR #96 |
| 9b — Admin pages UI | Complete — PR #97 |
