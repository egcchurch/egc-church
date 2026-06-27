// js/main.js

// Enable Firestore offline persistence on public/member pages.
// Skipped on admin pages to avoid excessive IndexedDB use with large result sets.
// Errors are ignored — persistence is best-effort (multi-tab or unsupported browser).
if (typeof firebase !== 'undefined' &&
    typeof firebase.firestore === 'function' &&
    !window.location.pathname.startsWith('/admin/')) {
  firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('hero-video');
  if (video) {
    video.play().catch(() => {});
  }
});

// The nav is injected asynchronously by js/nav.js, so anything that touches
// nav elements must wait for the nav-loaded event.
document.addEventListener('nav-loaded', () => {
  const mobileBtn = document.getElementById('mobile-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Close user dropdown when clicking outside the wrapper
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('user-menu-wrapper');
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && wrapper && !wrapper.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  initNavDropdowns();
  checkAuthState();

  // Section composition — publicly readable, fires for all visitors
  const pageSectionId = document.body.dataset.pageSections;
  if (pageSectionId && typeof firebase !== 'undefined') applySections(pageSectionId);
});

// ==================== NAV DROPDOWNS ====================

function initNavDropdowns() {
  const configs = [
    { btnId: 'members-nav-btn', panelId: 'members-nav-panel', chevronId: 'members-nav-chevron', wrapperId: 'members-nav-wrapper' },
    { btnId: 'admin-nav-btn',   panelId: 'admin-nav-panel',   chevronId: 'admin-nav-chevron',   wrapperId: 'admin-nav-wrapper'   },
  ];

  configs.forEach(({ btnId, panelId, chevronId }) => {
    const btn    = document.getElementById(btnId);
    const panel  = document.getElementById(panelId);
    const chevron = document.getElementById(chevronId);
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const isOpen = !panel.classList.contains('hidden');
      // Close all nav dropdowns
      configs.forEach(({ panelId: p, chevronId: c }) => {
        document.getElementById(p)?.classList.add('hidden');
        document.getElementById(c)?.classList.remove('rotate-180');
      });
      if (!isOpen) {
        panel.classList.remove('hidden');
        chevron?.classList.add('rotate-180');
      }
    });
  });

  // Close on outside click (each wrapper checked independently so they close each other)
  document.addEventListener('click', (e) => {
    configs.forEach(({ panelId, chevronId, wrapperId }) => {
      const wrapper = document.getElementById(wrapperId);
      if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById(panelId)?.classList.add('hidden');
        document.getElementById(chevronId)?.classList.remove('rotate-180');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    configs.forEach(({ panelId, chevronId }) => {
      document.getElementById(panelId)?.classList.add('hidden');
      document.getElementById(chevronId)?.classList.remove('rotate-180');
    });
  });
}

// ==================== AUTH STATE ====================

function checkAuthState() {
  if (typeof firebase === 'undefined' || typeof auth === 'undefined') return;
  auth.onAuthStateChanged((user) => {
    if (user) ensureUserDoc(user);
    updateLoginButtons(user);
  });
}

// Self-heal: create the /users/{uid} record if it's missing. onUserCreate handles
// brand-new accounts, but it only fires once at creation — an account whose record
// was later removed (or any case where the trigger didn't fire) would otherwise be
// stuck with no member record (invisible in admin, can't be approved). Created with
// safe 'pending' defaults; the hardened create rule enforces those server-side.
async function ensureUserDoc(user) {
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
  try {
    const ref = firebase.firestore().collection('users').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return;
    await ref.set({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      emailVerified: user.emailVerified || false,
      membership: 'pending',
      isSuperadmin: false,
      roles: [],
      extraPermissions: [],
      phone: '',
      directoryVisible: true,
      directoryShowEmail: false,
      directoryShowPhone: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    console.warn('ensureUserDoc: created missing user record for', user.uid);
  } catch (e) {
    console.warn('ensureUserDoc failed:', e.message);
  }
}

async function updateLoginButtons(user) {
  const desktopBtn   = document.getElementById('login-btn');
  const mobileBtn    = document.getElementById('mobile-login-btn');
  const mobileLinks  = document.getElementById('mobile-user-links');

  if (user) {
    // Fetch role info from Firestore
    let userData = {};
    try {
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (doc.exists) userData = doc.data();
    } catch (e) {
      console.warn('Could not load user profile for nav', e);
    }

    // Filter admin nav links by permission (admin pages only; Permissions defined by permissions.js)
    if (typeof Permissions !== 'undefined' && typeof Permissions.init === 'function') {
      Permissions.init(user).then(() => Permissions.filterAdminNav());
    }

    applyBranding();
    applyFeatures();

    const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Member';
    const isAdmin  = userData.isSuperadmin === true ||
                    (Array.isArray(userData.roles) && userData.roles.length > 0) ||
                    (Array.isArray(userData.extraPermissions) && userData.extraPermissions.length > 0);
    const isMember = userData.membership === 'member' || isAdmin;

    // ── Desktop: turn button into dropdown trigger ──
    if (desktopBtn) {
      desktopBtn.innerHTML = `${displayName} <i class="fas fa-chevron-down text-xs ml-1 opacity-70"></i>`;
      desktopBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
      desktopBtn.classList.add('bg-[#0A3D62]', 'hover:bg-[#083352]');

      const dropdown = document.getElementById('user-dropdown');
      if (dropdown) {
        dropdown.innerHTML = buildDropdownHTML(isMember, isAdmin);
        desktopBtn.onclick = (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('hidden');
        };
        dropdown.querySelector('#logout-btn')?.addEventListener('click', logoutUser);
      }
    }

    // ── Mobile: hide login button, show role-aware links ──
    if (mobileBtn) mobileBtn.classList.add('hidden');
    if (mobileLinks) {
      mobileLinks.innerHTML = buildMobileHTML(displayName, isMember, isAdmin);
      mobileLinks.classList.remove('hidden');
      mobileLinks.querySelector('#mobile-logout-btn')?.addEventListener('click', logoutUser);
    }

  } else {
    // ── Logged out: restore defaults ──
    if (desktopBtn) {
      desktopBtn.textContent = 'Member Login';
      desktopBtn.classList.remove('bg-[#0A3D62]', 'hover:bg-[#083352]');
      desktopBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
      desktopBtn.onclick = () => window.location.href = '/login.html';
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    if (mobileBtn) {
      mobileBtn.textContent = 'Member Login';
      mobileBtn.classList.remove('hidden');
      mobileBtn.onclick = () => window.location.href = '/login.html';
    }
    if (mobileLinks) {
      mobileLinks.classList.add('hidden');
      mobileLinks.innerHTML = '';
    }
  }
}

// ── Dropdown HTML builders ──

function buildDropdownHTML(isMember, isAdmin) {
  let html = `
    <a href="/profile.html" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
      <i class="fas fa-user text-gray-400 w-4 text-center"></i> My Profile
    </a>`;

  if (isMember) {
    html += `
    <a href="/members/index.html" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
      <i class="fas fa-users text-gray-400 w-4 text-center"></i> Members Area
    </a>`;
  }

  if (isAdmin) {
    html += `
    <a href="/admin/index.html" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
      <i class="fas fa-shield-alt text-gray-400 w-4 text-center"></i> Admin Dashboard
    </a>`;
  }

  html += `
    <div class="border-t border-gray-100 my-1"></div>
    <button id="logout-btn" class="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
      <i class="fas fa-sign-out-alt w-4 text-center"></i> Sign Out
    </button>`;

  return html;
}

function buildMobileHTML(displayName, isMember, isAdmin) {
  let html = `
    <div class="border-t border-white/10 mt-2 pt-4">
      <p class="text-xs text-white/50 font-semibold uppercase tracking-wide mb-3">Signed in as ${displayName}</p>
      <a href="/profile.html" class="flex items-center gap-3 py-2.5 text-white/90 hover:text-amber-400 transition-colors">
        <i class="fas fa-user w-5 text-center text-white/50"></i> My Profile
      </a>`;

  if (isMember) {
    html += `
      <a href="/members/index.html" class="flex items-center gap-3 py-2.5 text-white/90 hover:text-amber-400 transition-colors">
        <i class="fas fa-users w-5 text-center text-white/50"></i> Members Area
      </a>`;
  }

  if (isAdmin) {
    html += `
      <a href="/admin/index.html" class="flex items-center gap-3 py-2.5 text-white/90 hover:text-amber-400 transition-colors">
        <i class="fas fa-shield-alt w-5 text-center text-white/50"></i> Admin Dashboard
      </a>`;
  }

  html += `
      <button id="mobile-logout-btn" class="mt-4 w-full bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-full font-medium transition-colors">
        Sign Out
      </button>
    </div>`;

  return html;
}

// ── Branding ──

async function applyBranding() {
  if (typeof firebase === 'undefined') return;
  try {
    const doc = await firebase.firestore().doc('config/branding').get();
    if (!doc.exists) return;
    const b = doc.data();
    if (b.primaryColor) document.documentElement.style.setProperty('--color-primary', b.primaryColor);
    if (b.accentColor)  document.documentElement.style.setProperty('--color-accent',  b.accentColor);
    if (b.logoUrl) {
      const area = document.getElementById('nav-logo-area');
      if (area) {
        const img = document.createElement('img');
        img.src   = b.logoUrl;
        img.alt   = 'Church Logo';
        img.style.cssText = 'height:40px;width:auto;object-fit:contain;';
        area.innerHTML = '';
        area.appendChild(img);
      }
    }
  } catch (_) {
    // fail silently — defaults remain
  }
}

// ── Feature flags ──

async function applyFeatures() {
  if (typeof firebase === 'undefined') return;
  try {
    const doc = await firebase.firestore().doc('config/features').get();
    const flags = doc.exists ? doc.data() : {};

    // Hide nav links and any element tagged with a disabled feature
    document.querySelectorAll('[data-feature]').forEach(el => {
      if (flags[el.dataset.feature] === false) el.style.display = 'none';
    });

    // Hide tabs/sections within a page (e.g. Youth tab in members/gallery.html)
    document.querySelectorAll('[data-feature-tab]').forEach(el => {
      if (flags[el.dataset.featureTab] === false) el.style.display = 'none';
    });

    // Redirect away from a page whose feature is disabled
    const gate = document.body.dataset.featureGate;
    if (gate && flags[gate] === false) {
      window.location.replace(
        window.location.pathname.startsWith('/admin/') ? '/admin/' : '/members/'
      );
    }
  } catch (_) {
    // fail silently — all features default to enabled
  }
}

// ── Section composition ──
// Reads /config/pages (publicly readable) and applies section order + visibility
// to [data-section] elements. Standalone sections (outside any container) are
// toggled only. Sections inside [data-sections-container] are also reordered.

async function applySections(pageId) {
  if (typeof firebase === 'undefined') return;
  try {
    const doc = await firebase.firestore().doc('config/pages').get();
    if (!doc.exists) return;
    const cfg = doc.data()[pageId];
    if (!cfg || !Array.isArray(cfg.sections)) return;

    const sorted = [...cfg.sections].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Toggle visibility for all [data-section] elements on the page
    sorted.forEach(s => {
      const el = document.querySelector(`[data-section="${s.id}"]`);
      if (el && s.enabled === false) el.style.display = 'none';
    });

    // Reorder sections within their container (container sections only)
    const container = document.querySelector(`[data-sections-container="${pageId}"]`);
    if (!container) return;
    sorted.forEach(s => {
      if (s.enabled === false) return;
      const el = container.querySelector(`[data-section="${s.id}"]`);
      if (el) container.appendChild(el);
    });
  } catch (_) {}
}

// ── Logout ──

// Shared by every sign-out entry point on the site (the main nav logout
// button, the gated-content "Sign out" prompt, account deletion, and the
// pending-approval homepage state). Signs out, then best-effort wipes the
// offline Firestore cache so member-only content already cached in this
// browser (e.g. a members-audience gallery) doesn't keep appearing on
// public pages after logout — enablePersistence() doesn't clear itself on
// sign-out. clearPersistence() requires no other open Firestore
// connections/tabs, so it routinely fails; that's fine, it's cache
// hygiene, not required for sign-out to succeed.
function signOutAndClearCache() {
  return auth.signOut().then(() => {
    if (typeof firebase.firestore !== 'function') return;
    return firebase.firestore().terminate()
      .then(() => firebase.firestore().clearPersistence())
      .catch(() => {});
  });
}

function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    signOutAndClearCache().then(() => {
      window.location.href = '/index.html';
    }).catch((error) => {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
    });
  }
}

// ── Service worker registration ──

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch((err) => console.error('SW registration failed:', err));
  });
}

// ── PWA install prompt ──
// Shows a dismissible bottom banner when the browser signals the app can be
// installed. Skipped if already running in standalone mode or previously dismissed.

(function initPwaInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem('egcInstallDismissed')) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.setAttribute('style',
      'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
      'background:#0A3D62;color:#fff;padding:12px 16px;' +
      'display:flex;align-items:center;gap:12px;' +
      'font-family:sans-serif;font-size:14px;line-height:1.4;' +
      'box-shadow:0 -2px 10px rgba(0,0,0,0.25);'
    );
    banner.innerHTML =
      '<span style="flex:1">' +
        '<strong>Add EGC to your home screen</strong> — get push notifications and faster access.' +
      '</span>' +
      '<button id="pwa-install-btn" style="' +
        'background:#F59E0B;color:#fff;border:none;padding:8px 18px;' +
        'border-radius:20px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:14px' +
      '">Install</button>' +
      '<button id="pwa-dismiss-btn" aria-label="Dismiss" style="' +
        'background:transparent;color:#fff;border:none;padding:8px;' +
        'cursor:pointer;font-size:20px;line-height:1;opacity:0.7;flex-shrink:0' +
      '">&times;</button>';

    document.body.appendChild(banner);

    function dismiss() {
      localStorage.setItem('egcInstallDismissed', '1');
      banner.remove();
    }

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      dismiss();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', dismiss);
  });
}());
