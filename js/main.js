// js/main.js

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('hero-video');
  if (video) {
    video.play().catch(() => console.log("Video autoplay prevented"));
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

  checkAuthState();
});

// ==================== AUTH STATE ====================

function checkAuthState() {
  if (typeof firebase === 'undefined' || typeof auth === 'undefined') {
    console.log("Firebase not loaded");
    return;
  }
  auth.onAuthStateChanged((user) => {
    updateLoginButtons(user);
  });
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

    const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Member';
    const isAdmin  = userData.adminRole === 'editor' || userData.adminRole === 'superadmin';
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
    <a href="/members/" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
      <i class="fas fa-users text-gray-400 w-4 text-center"></i> Members Area
    </a>`;
  }

  if (isAdmin) {
    html += `
    <a href="/admin/" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 transition-colors">
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
    <div class="border-t border-gray-100 mt-2 pt-4">
      <p class="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Signed in as ${displayName}</p>
      <a href="/profile.html" class="flex items-center gap-3 py-2.5 text-gray-700 hover:text-amber-600 transition-colors">
        <i class="fas fa-user w-5 text-center text-gray-400"></i> My Profile
      </a>`;

  if (isMember) {
    html += `
      <a href="/members/" class="flex items-center gap-3 py-2.5 text-gray-700 hover:text-amber-600 transition-colors">
        <i class="fas fa-users w-5 text-center text-gray-400"></i> Members Area
      </a>`;
  }

  if (isAdmin) {
    html += `
      <a href="/admin/" class="flex items-center gap-3 py-2.5 text-gray-700 hover:text-amber-600 transition-colors">
        <i class="fas fa-shield-alt w-5 text-center text-gray-400"></i> Admin Dashboard
      </a>`;
  }

  html += `
      <button id="mobile-logout-btn" class="mt-4 w-full bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-full font-medium transition-colors">
        Sign Out
      </button>
    </div>`;

  return html;
}

// ── Logout ──

function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    auth.signOut().then(() => {
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
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.error('SW registration failed:', err));
  });
}
