const CACHE_NAME = 'egc-cache-v6';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/sermons.html',
  '/events.html',
  '/blog.html',
  '/login.html',
  '/profile.html',
  '/admin/users.html',
  '/admin/sermons.html',
  '/admin/events.html',
  '/admin/blog.html',
  '/firebase-config.js',
  '/js/main.js',
  '/js/auth.js',
  '/js/sermons.js',
  '/js/events.js',
  '/js/blog.js',
  '/js/admin-auth.js',
  '/js/member-auth.js',
  '/manifest.json',
  '/assets/images/icons/icon-192.png',
  '/assets/images/icons/icon-512.png',
];

// CDN origins to cache on first fetch (runtime caching)
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'www.gstatic.com',
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip the hero video — too large to cache
  if (url.pathname.includes('CloudVideo')) return;

  // Skip Firebase auth/API calls — always need to be live
  if (url.hostname.includes('firebaseapp.com') || url.hostname.includes('googleapis.com')) return;

  // CDN assets — cache-first (they are versioned and don't change)
  if (CDN_ORIGINS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Local static assets (images, JS, manifest) — cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|js|json|css|webp)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages — network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
});

// ─── Strategies ──────────────────────────────────────────────────────────────

// Cache-first: serve from cache, fall back to network and update cache
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Asset not in cache and network failed — nothing to return
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

// Network-first: try network, fall back to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback: serve the homepage if the specific page isn't cached
    return caches.match('/index.html');
  }
}