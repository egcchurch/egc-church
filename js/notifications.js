// js/notifications.js
// In-app notification bell (Firestore real-time) + FCM token registration.
// Loaded dynamically by nav.js after the nav partial is in the DOM.
// Self-initializing — no external calls required.
//
// To enable push notifications:
//   1. Go to Firebase Console > Project Settings > Cloud Messaging
//   2. Under "Web Push certificates", generate a key pair
//   3. Replace the placeholder below with your VAPID public key

(function () {
  const VAPID_KEY = 'BKucjFII0q8tQZh2zwQbHmF3d7fV6cvw2n9M56q1qG2Hk-KE04lu5WYQtJZLumWmueGwudfVNvP5bGbxkzpeOT4';

  let unsubscribeNotifs = null;

  // Wait for Firebase auth before setting up listeners
  function waitForAuth(cb) {
    if (typeof firebase !== 'undefined' && typeof auth !== 'undefined') {
      cb();
    } else {
      setTimeout(() => waitForAuth(cb), 50);
    }
  }

  waitForAuth(() => {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        setupBell(user.uid);
        // FCM token registration is gated on membership === 'member'.
        // Pending and public users do not receive push notifications.
        try {
          const snap = await firebase.firestore().collection('users').doc(user.uid).get();
          if (snap.exists && snap.data().membership === 'member') {
            registerFCMToken(user.uid);
          }
        } catch (e) {
          console.warn('FCM eligibility check failed:', e);
        }
      } else {
        teardownBell();
      }
    });
  });

  // ── Notification bell ────────────────────────────────────────────────────────

  function setupBell(uid) {
    const wrapper = document.getElementById('notif-bell-wrapper');
    if (!wrapper) return;
    wrapper.classList.remove('hidden');

    const badge = document.getElementById('notif-badge');
    const panel = document.getElementById('notif-panel');
    const btn   = document.getElementById('notif-bell-btn');

    let currentItems = [];

    unsubscribeNotifs = firebase.firestore()
      .collection('users').doc(uid)
      .collection('notifications')
      .orderBy('sentAt', 'desc')
      .limit(20)
      .onSnapshot((snap) => {
        currentItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const unread = currentItems.filter(n => !n.read).length;

        if (badge) {
          badge.textContent = unread > 9 ? '9+' : String(unread);
          badge.classList.toggle('hidden', unread === 0);
        }
        if (panel) renderPanel(panel, currentItems, uid);
        // If panel is already open when a new notification arrives, mark it read immediately.
        if (panel && !panel.classList.contains('hidden')) {
          markAllRead(uid, currentItems);
        }
      }, (err) => {
        console.warn('Notification listener error:', err);
      });

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpening = panel?.classList.contains('hidden');
        panel?.classList.toggle('hidden');
        if (isOpening) markAllRead(uid, currentItems);
      });
    }

    const clearBtn = document.getElementById('notif-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllNotifications(uid, currentItems);
      });
    }

    document.addEventListener('click', handleOutsideClick);
  }

  function handleOutsideClick(e) {
    const wrapper = document.getElementById('notif-bell-wrapper');
    const panel   = document.getElementById('notif-panel');
    if (panel && wrapper && !wrapper.contains(e.target)) {
      panel.classList.add('hidden');
    }
  }

  function teardownBell() {
    if (unsubscribeNotifs) { unsubscribeNotifs(); unsubscribeNotifs = null; }
    document.removeEventListener('click', handleOutsideClick);
    const wrapper = document.getElementById('notif-bell-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
  }

  // ── Panel rendering ──────────────────────────────────────────────────────────

  function renderPanel(panel, items, uid) {
    const content  = panel.querySelector('#notif-panel-content');
    const clearBtn = document.getElementById('notif-clear-btn');
    if (!content) return;

    if (clearBtn) clearBtn.classList.toggle('hidden', items.length === 0);

    if (!items.length) {
      content.innerHTML = '<p class="text-sm text-gray-400 text-center py-8 px-4">No notifications yet</p>';
      return;
    }

    content.innerHTML = items.map(n => {
      const hasLink = !!(n.linkUrl);
      return `
      <div class="notif-item flex flex-col gap-0.5 px-4 py-3 transition-colors
                  ${hasLink ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}
                  border-b border-gray-50 last:border-0
                  ${n.read ? '' : 'bg-amber-50'}"
           data-id="${n.id}" data-link="${esc(n.linkUrl || '')}">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold text-gray-800 leading-snug flex-1">${esc(n.title || '')}</p>
          ${!n.read ? '<span class="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>' : ''}
        </div>
        ${n.body ? `<p class="text-xs text-gray-500 line-clamp-2">${esc(n.body)}</p>` : ''}
        <p class="text-[10px] text-gray-400 mt-0.5">${relativeTime(n.sentAt)}</p>
      </div>
    `}).join('');

    content.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        const link = el.dataset.link;
        if (link) window.location.href = link;
        else document.getElementById('notif-panel')?.classList.add('hidden');
      });
    });
  }

  function markAllRead(uid, items) {
    items.filter(n => !n.read).forEach(n => {
      firebase.firestore()
        .collection('users').doc(uid)
        .collection('notifications').doc(n.id)
        .update({ read: true }).catch(() => {});
    });
  }

  function clearAllNotifications(uid, items) {
    if (!items.length) return;
    items.forEach(n => {
      firebase.firestore()
        .collection('users').doc(uid)
        .collection('notifications').doc(n.id)
        .delete().catch(() => {});
    });
  }

  // ── FCM token registration ───────────────────────────────────────────────────

  async function registerFCMToken(uid) {
    // Only register push tokens from the installed PWA (standalone mode).
    // Browser Chrome and PWA have separate localStorage on Android, so both
    // would generate different deviceIds and accumulate duplicate tokens.
    if (!window.matchMedia('(display-mode: standalone)').matches) return;
    if (!('Notification' in window)) return;
    if (VAPID_KEY === 'YOUR_VAPID_KEY_HERE') return;
    if (Notification.permission === 'denied') return;

    try {
      if (!window._fcmSdkLoaded) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        window._fcmSdkLoaded = true;
      }

      if (!firebase.messaging.isSupported()) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const messaging = firebase.messaging();
      const swReg = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

      if (token) {
        // Use a stable deviceId (persisted in localStorage) as the Firestore doc key.
        // Browser Chrome and installed PWA share localStorage for the same origin, so
        // both contexts resolve to the same doc — preventing duplicate tokens accumulating
        // from reinstalls or PWA installation alongside an existing browser session.
        let deviceId = localStorage.getItem('egcDeviceId');
        if (!deviceId) {
          deviceId = Math.random().toString(36).substring(2, 24);
          localStorage.setItem('egcDeviceId', deviceId);
          // First time on this scheme — delete the old token-keyed doc if one exists.
          const prevToken = localStorage.getItem('egcFcmToken');
          if (prevToken) {
            firebase.firestore()
              .collection('users').doc(uid)
              .collection('fcmTokens').doc(prevToken.substring(0, 22))
              .delete().catch(() => {});
          }
        }

        await firebase.firestore()
          .collection('users').doc(uid)
          .collection('fcmTokens').doc(deviceId)
          .set({
            token,
            device: navigator.userAgent.substring(0, 200),
            registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
          });

        localStorage.setItem('egcFcmToken', token);
      }

      messaging.onMessage((payload) => {
        const title = payload.notification?.title || '';
        const body  = payload.notification?.body  || '';
        if (title) showToast(title, body);
      });

    } catch (e) {
      console.warn('FCM registration failed:', e);
    }
  }

  // ── Foreground toast ─────────────────────────────────────────────────────────

  function showToast(title, body) {
    const el = document.createElement('div');
    el.className = 'fixed top-20 right-4 z-[9999] bg-[#0A3D62] text-white rounded-xl shadow-xl p-4 max-w-xs w-72';
    el.innerHTML = `
      <div class="flex gap-3 items-start">
        <i class="fas fa-bell text-amber-400 mt-0.5 shrink-0"></i>
        <div>
          <p class="font-semibold text-sm">${esc(title)}</p>
          ${body ? `<p class="text-xs opacity-80 mt-0.5">${esc(body)}</p>` : ''}
        </div>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function relativeTime(ts) {
    if (!ts) return '';
    const d    = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000)   return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
})();
