// js/admin-auth.js
// Shared auth guard for admin pages.
// Include this script on every /admin/*.html page.
// It redirects non-admins away before the page loads.
//
// Optional: add data-require-perm="<key>" on the script tag to enforce
// a specific permission from custom claims.
//
//   <script src="/js/admin-auth.js" data-require-perm="sermons.manage"></script>
//
// Without data-require-perm the guard allows any user with superadmin claim
// or a non-empty perms list (admin dashboard page uses this form).

(function () {
  // Capture synchronously — document.currentScript is null inside async callbacks.
  const requiredPerm = document.currentScript ? document.currentScript.dataset.requirePerm : null;

  const REDIRECT_URL = '/index.html';

  function waitForFirebase(callback) {
    if (typeof firebase !== 'undefined' &&
        typeof auth !== 'undefined' &&
        typeof firebase.firestore === 'function') {
      callback();
    } else {
      setTimeout(() => waitForFirebase(callback), 50);
    }
  }

  waitForFirebase(() => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = REDIRECT_URL;
        return;
      }

      user.getIdTokenResult()
        .then(({ claims }) => {
          const isSuperadmin = claims.superadmin === true;
          const hasPerms     = Array.isArray(claims.perms) && claims.perms.length > 0;

          // Base check: user must be superadmin or have at least one permission.
          if (!isSuperadmin && !hasPerms) {
            window.location.href = REDIRECT_URL;
            return;
          }

          // Per-page check: if a specific permission is required, enforce it.
          if (requiredPerm) {
            const ok = isSuperadmin || (Array.isArray(claims.perms) && claims.perms.includes(requiredPerm));
            if (!ok) window.location.href = REDIRECT_URL;
          }
        })
        .catch((err) => {
          console.error('Admin auth check failed:', err);
          window.location.href = REDIRECT_URL;
        });
    });
  });
})();
