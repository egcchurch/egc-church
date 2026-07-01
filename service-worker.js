// Firebase Messaging SDK — handles push notifications when the browser tab is in the background.
// The client passes serviceWorkerRegistration to messaging.getToken() so Firebase uses this SW
// instead of looking for a separate firebase-messaging-sw.js at the root.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

if (!self.firebase?.apps?.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyAly2rtcYlwmk-TyhMqBcybUzupB76DCY8',
    authDomain: 'egc-church.firebaseapp.com',
    projectId: 'egc-church',
    storageBucket: 'egc-church.firebasestorage.app',
    messagingSenderId: '1062334725558',
    appId: '1:1062334725558:web:6ba21350d61b55c6515517',
  });
}

// Initialise Firebase Messaging so the SDK can receive push events.
// Display is handled automatically by the browser from webpush.notification —
// registering onBackgroundMessage would cause a second duplicate display.
firebase.messaging();

// Open/focus the app and navigate to the notification's linkUrl when tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const linkUrl   = event.notification.data?.linkUrl || '/';
  const targetUrl = new URL(linkUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Re-use any open window on this origin rather than opening a new tab.
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

const CACHE_NAME = 'egc-cache-v72';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/sermons.html',
  '/events.html',
  '/blog.html',
  '/post.html',
  '/story.html',
  '/about.html',
  '/william-branham.html',
  '/fulfillment-of-prophecy.html',
  '/connect.html',
  '/gallery.html',
  '/music.html',
  '/login.html',
  '/profile.html',
  '/nav.html',
  '/admin-nav.html',
  '/members-nav.html',
  '/footer.html',
  '/members/index.html',
  '/members/directory.html',
  '/members/prayer.html',
  '/members/groups.html',
  '/members/cottage.html',
  '/members/serving-teams.html',
  '/members/devotional.html',
  '/members/gallery.html',
  '/members/live.html',
  '/members/messages.html',
  '/admin/index.html',
  '/admin/users.html',
  '/admin/roles.html',
  '/admin/sermons.html',
  '/admin/events.html',
  '/admin/blog.html',
  '/admin/team.html',
  '/admin/prayer.html',
  '/admin/groups.html',
  '/admin/cottage.html',
  '/admin/serving-teams.html',
  '/admin/devotional.html',
  '/admin/connect.html',
  '/admin/homepage.html',
  '/admin/notifications.html',
  '/admin/settings.html',
  '/admin/pages.html',
  '/admin/media.html',
  '/admin/gallery.html',
  '/admin/music.html',
  '/church-config.js',
  '/firebase-config.js',
  '/js/nav.js',
  '/js/main.js',
  '/js/auth.js',
  '/js/sermons.js',
  '/js/events.js',
  '/js/blog.js',
  '/js/about.js',
  '/js/connect.js',
  '/js/gallery.js',
  '/js/music.js',
  '/js/storage-upload.js',
  '/js/admin-auth.js',
  '/js/member-auth.js',
  '/js/permissions.js',
  '/js/homepage.js',
  '/js/notifications.js',
  '/js/messaging.js',
  '/js/search.js',
  '/js/footer.js',
  '/js/welcome-carousel.js',
  '/js/branham-sermons.js',
  '/assets/css/tailwind.css',
  '/assets/css/custom.css',
  '/manifest.json',
  '/assets/images/icons/icon-192.png',
  '/assets/images/icons/icon-512.png',
];

// CDN origins to cache on first fetch (runtime caching)
const CDN_ORIGINS = [
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