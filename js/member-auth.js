// js/member-auth.js
// Auth guard for member pages. Shows a contextual access-denied card instead
// of silently redirecting when a user lacks member access.
// Include on every /members/*.html page.

(function () {
  var MEMBER_TIERS = ['member'];

  function showAccessDenied(reason, user) {
    var configs = {
      'not-logged-in': {
        icon: 'fa-lock',
        iconColor: '#d97706',
        iconBg: '#fef3c7',
        title: 'Sign in to access this page',
        body: 'This content is available to registered church members.',
        buttons: [
          { href: '/login.html', label: 'Sign In', primary: true },
          { href: '/login.html', label: 'Create Account', primary: false }
        ]
      },
      'verify-email': {
        icon: 'fa-envelope',
        iconColor: '#2563eb',
        iconBg: '#dbeafe',
        title: 'Verify your email first',
        body: 'We sent a verification link to your email address. Check your inbox and click the link, then return here.',
        buttons: [
          { action: 'resend', label: 'Resend verification email', primary: true },
          { action: 'signout', label: 'Sign out', primary: false }
        ]
      },
      'pending': {
        icon: 'fa-clock',
        iconColor: '#d97706',
        iconBg: '#fef3c7',
        title: 'Account awaiting approval',
        body: 'Your account is being reviewed. Approvals usually happen within 24 hours — we’ll email you when you’re in.',
        buttons: [
          { action: 'signout', label: 'Sign out', primary: false }
        ]
      },
      'public': {
        icon: 'fa-users',
        iconColor: '#0A3D62',
        iconBg: '#dbeafe',
        title: 'Members only',
        body: 'This page is available to church members. You can request member access from your profile.',
        buttons: [
          { href: '/profile.html', label: 'Request member access', primary: true },
          { action: 'signout', label: 'Sign out', primary: false }
        ]
      }
    };

    var cfg = configs[reason] || configs['not-logged-in'];

    window._memberAuthSignOut = function () {
      signOutAndClearCache().then(function () { window.location.href = '/index.html'; });
    };
    window._memberAuthResend = function () {
      if (!user) return;
      user.sendEmailVerification()
        .then(function () { alert('Verification email sent. Please check your inbox.'); })
        .catch(function (err) { alert('Could not send email: ' + err.message); });
    };

    var btnHtml = cfg.buttons.map(function (b) {
      var base = 'display:inline-block;padding:.5rem 1.25rem;border-radius:.5rem;font-weight:600;font-size:.9375rem;cursor:pointer;text-decoration:none;transition:opacity .15s;';
      var style = b.primary
        ? base + 'background:#F59E0B;color:#fff;border:none;'
        : base + 'background:#fff;color:#374151;border:1.5px solid #d1d5db;';
      if (b.href) {
        return '<a href="' + b.href + '" style="' + style + '">' + b.label + '</a>';
      }
      var fn = b.action === 'signout' ? '_memberAuthSignOut()' : '_memberAuthResend()';
      return '<button onclick="' + fn + '" style="' + style + '">' + b.label + '</button>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#f9fafb;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.12);max-width:26rem;width:100%;padding:2.5rem;text-align:center;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:' + cfg.iconBg + ';display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">' +
          '<i class="fas ' + cfg.icon + '" style="font-size:1.75rem;color:' + cfg.iconColor + ';"></i>' +
        '</div>' +
        '<h2 style="font-size:1.25rem;font-weight:700;color:#111827;margin:0 0 .5rem;">' + cfg.title + '</h2>' +
        '<p style="color:#6b7280;margin:0 0 1.75rem;font-size:.9375rem;line-height:1.5;">' + cfg.body + '</p>' +
        '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">' + btnHtml + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function waitForFirebase(callback) {
    // Must wait for firestore too — the guard reads /users/{uid} below, and
    // calling firebase.firestore() before the SDK loads throws (see CLAUDE.md).
    if (typeof firebase !== 'undefined' &&
        typeof auth !== 'undefined' &&
        typeof firebase.firestore === 'function') {
      callback();
    } else {
      setTimeout(function () { waitForFirebase(callback); }, 50);
    }
  }

  waitForFirebase(function () {
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        showAccessDenied('not-logged-in', null);
        return;
      }

      if (!user.emailVerified) {
        showAccessDenied('verify-email', user);
        return;
      }

      firebase.firestore().collection('users').doc(user.uid).get()
        .then(function (doc) {
          if (!doc.exists) {
            showAccessDenied('not-logged-in', user);
            return;
          }
          var data = doc.data();
          if (!MEMBER_TIERS.includes(data.membership)) {
            showAccessDenied(data.membership === 'pending' ? 'pending' : 'public', user);
          }
        })
        .catch(function (err) {
          console.error('Member auth check failed:', err);
          showAccessDenied('not-logged-in', null);
        });
    });
  });
})();
