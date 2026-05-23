// js/member-auth.js
// Shared auth guard for member pages.
// Include this script on every /members/*.html page.
// It redirects non-members away before the page loads.

(function () {
  const MEMBER_TIERS = ['member'];
  const REDIRECT_URL = '/login.html';

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

      if (!user.emailVerified) {
        window.location.href = '/login.html?verify=1';
        return;
      }

      firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
          if (!doc.exists) {
            window.location.href = REDIRECT_URL;
            return;
          }

          const data = doc.data();
          if (!MEMBER_TIERS.includes(data.membership)) {
            window.location.href = '/login.html?pending=1';
          }
        })
        .catch((err) => {
          console.error('Member auth check failed:', err);
          window.location.href = REDIRECT_URL;
        });
    });
  });
})();