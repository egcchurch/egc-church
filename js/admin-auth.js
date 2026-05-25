// js/admin-auth.js
// Shared auth guard for admin pages.
// Include this script on every /admin/*.html page.
// It redirects non-admins away before the page loads.
//
// Optional: add data-require-perm="<key>" on the script tag to also enforce
// a specific permission from custom claims (used from Phase 6 PR 7 onward).
//
//   <script src="/js/admin-auth.js" data-require-perm="sermons.manage"></script>
//
// Without data-require-perm the guard behaves exactly as before (adminRole check only).

(function () {
  // Capture synchronously — document.currentScript is null inside async callbacks.
  const requiredPerm = document.currentScript ? document.currentScript.dataset.requirePerm : null;

  const ADMIN_ROLES  = ['editor', 'superadmin'];
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

      firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
          if (!doc.exists || !ADMIN_ROLES.includes(doc.data().adminRole)) {
            window.location.href = REDIRECT_URL;
            return null;
          }
          // If a specific permission is required, fetch the ID token to check claims.
          return requiredPerm ? user.getIdTokenResult() : null;
        })
        .then((tokenResult) => {
          if (!tokenResult) return;  // no per-permission check needed
          const { claims } = tokenResult;
          const ok = claims.superadmin === true ||
                     (Array.isArray(claims.perms) && claims.perms.includes(requiredPerm));
          if (!ok) window.location.href = REDIRECT_URL;
        })
        .catch((err) => {
          console.error('Admin auth check failed:', err);
          window.location.href = REDIRECT_URL;
        });
    });
  });
})();
