// js/permissions.js
// Reads Firebase Auth custom claims and exposes hasPermission(key).
//
// Usage:
//   1. Load this script after firebase-auth-compat.js.
//   2. In your onAuthStateChanged handler call Permissions.init(user).
//   3. After the returned Promise resolves, hasPermission() is synchronous.
//
// After saving new roles to a user doc (which triggers syncUserClaims),
// call Permissions.refresh(user) to force a token refresh and reload claims.

const Permissions = (() => {
  let _superadmin = false;
  let _perms = [];

  function init(user) {
    if (!user) {
      _superadmin = false;
      _perms = [];
      return Promise.resolve();
    }
    return user.getIdTokenResult().then((result) => {
      _superadmin = result.claims.superadmin === true;
      _perms = Array.isArray(result.claims.perms) ? result.claims.perms : [];
    });
  }

  // Force a fresh token then re-cache — call after role changes so new claims are visible.
  function refresh(user) {
    if (!user) return Promise.resolve();
    return user.getIdToken(true).then(() => init(user));
  }

  // Synchronous — only reliable after init() has resolved.
  function hasPermission(key) {
    return _superadmin || _perms.includes(key);
  }

  function isSuperadmin() {
    return _superadmin;
  }

  // Filter admin nav links and dashboard cards based on current user's permissions.
  // Hides any <a data-perm="..."> element where the user lacks the permission.
  // Hides the entire #admin-nav-wrapper if no dropdown links remain visible.
  function filterAdminNav() {
    const panel = document.getElementById('admin-nav-panel');
    if (panel) {
      let anyVisible = false;
      panel.querySelectorAll('a[data-perm]').forEach((link) => {
        if (!hasPermission(link.dataset.perm)) {
          link.classList.add('hidden');
        } else {
          anyVisible = true;
        }
      });
      if (!anyVisible) {
        const wrapper = document.getElementById('admin-nav-wrapper');
        if (wrapper) wrapper.classList.add('hidden');
      }
    }

    const mobile = document.getElementById('mobile-menu');
    if (mobile) {
      mobile.querySelectorAll('a[data-perm]').forEach((link) => {
        if (!hasPermission(link.dataset.perm)) {
          link.classList.add('hidden');
        }
      });
    }
  }

  return { init, refresh, hasPermission, isSuperadmin, filterAdminNav };
})();
