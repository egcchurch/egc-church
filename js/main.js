// js/main.js

document.addEventListener('DOMContentLoaded', () => {
  
  // Mobile menu toggle
  const mobileBtn = document.getElementById('mobile-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Hero video
  const video = document.getElementById('hero-video');
  if (video) {
    video.play().catch(() => console.log("Video autoplay prevented"));
  }

  // Check login state
  checkAuthState();
});

// ==================== AUTH STATE MANAGEMENT (Desktop + Mobile) ====================
function checkAuthState() {
  if (typeof firebase === 'undefined' || typeof auth === 'undefined') {
    console.log("Firebase not loaded");
    return;
  }

  auth.onAuthStateChanged((user) => {
    updateLoginButtons(user);
  });
}

function updateLoginButtons(user) {
  // Desktop button
  const desktopBtn = document.getElementById('login-btn');
  
  // Mobile button inside hamburger menu
  const mobileBtn = document.getElementById('mobile-login-btn');

  if (user) {
    // === USER IS LOGGED IN ===
    const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Member';

    // Update Desktop Button
    if (desktopBtn) {
      desktopBtn.innerHTML = `
        Welcome, ${displayName}
        <span class="text-xs block text-amber-200">(${user.email})</span>
      `;
      desktopBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
      desktopBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'cursor-default');
      desktopBtn.onclick = logoutUser;
    }

    // Update Mobile Button
    if (mobileBtn) {
      mobileBtn.innerHTML = `Welcome, ${displayName} <span class="text-xs block">(${user.email})</span>`;
      mobileBtn.classList.remove('bg-amber-500');
      mobileBtn.classList.add('bg-green-600');
      mobileBtn.onclick = logoutUser;
    }

  } else {
    // === USER IS LOGGED OUT ===
    if (desktopBtn) {
      desktopBtn.textContent = 'Member Login';
      desktopBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'cursor-default');
      desktopBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
      desktopBtn.onclick = () => window.location.href = 'login.html';
    }

    if (mobileBtn) {
      mobileBtn.textContent = 'Member Login';
      mobileBtn.classList.remove('bg-green-600');
      mobileBtn.classList.add('bg-amber-500');
      mobileBtn.onclick = () => window.location.href = 'login.html';
    }
  }
}

// Logout function
function logoutUser() {
  if (confirm("Are you sure you want to logout?")) {
    auth.signOut().then(() => {
      window.location.href = "index.html";
    }).catch((error) => {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
    });
  }
}