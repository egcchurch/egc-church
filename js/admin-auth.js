// js/admin-auth.js
// Shared auth guard for admin pages.
// Include this script on every /admin/*.html page.
// It redirects non-admins away before the page loads.

(function () {
  const ADMIN_ROLES = ['editor', 'superadmin'];
  const REDIRECT_URL = '/index.html';

  function waitForFirebase(callback) {
    if (typeof firebase !== 'undefined' && typeof auth !== 'undefined') {
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
          if (!doc.exists) {
            window.location.href = REDIRECT_URL;
            return;
          }

          const data = doc.data();
          if (!ADMIN_ROLES.includes(data.adminRole)) {
            window.location.href = REDIRECT_URL;
          }
        })
        .catch((err) => {
          console.error('Admin auth check failed:', err);
          window.location.href = REDIRECT_URL;
        });
    });
  });
})();