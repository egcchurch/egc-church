# Progress: church-website-pwa

> Update this file at the end of every coding session. Paste it with AI_CONTEXT.md to resume quickly.

---

## Current Status

**Status:** `Active`
**Last worked on:** 2026-05-12
**Current milestone:** Foundation complete — PWA layer next

---

## Next Steps

1. Add manifest.json and service-worker.js (PWA layer)
2. Connect sermons to Firestore (replace hardcoded data)
3. Build out homepage sections below the hero
4. Notice board page

---

## Blockers

- None

---

## Session Log

### 2026-05-12

**What was done:**

- Audited old project (church-website-pwaold)
- Set up clean new repo at https://github.com/egcchurch/egc-church
- Removed Python scaffold, copied website files across
- Configured GitHub Pages (main branch, root)
- Fixed Firebase authorised domains (127.0.0.1, egcchurch.github.io)
- Committed firebase-config.js (intentional — public-facing config)
- Verified live site working at https://egcchurch.github.io/egc-church/

**What worked:**

- Clean git history from scratch
- GitHub Pages deployment working
- Firebase auth working locally and on live site

**What didn't work / needs revisiting:**

- Video hero may be slow on GitHub Pages (large file, no CDN)

**Decisions made:**

- Committed firebase-config.js rather than using GitHub Secrets (appropriate for public church site)
- Tailwind CDN build acceptable for now (no build step complexity)
- Serve from root of main branch (simplest GitHub Pages setup)

---

<!-- Copy the session block above for each new session -->
<!-- Most recent session should always be at the TOP -->
