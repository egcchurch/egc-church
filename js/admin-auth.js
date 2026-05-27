// js/admin-auth.js
// Auth guard for admin pages. Unauthenticated users are redirected to home;
// authenticated users without the required permission see an access-denied card.
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
  var requiredPerm = document.currentScript ? document.currentScript.dataset.requirePerm : null;

  function showAccessDenied(reason) {
    var configs = {
      'no-permission': {
        icon: 'fa-shield-halved',
        title: 'No admin access',
        body: 'You don\'t have permission to access the admin area. Contact a superadmin if you need access.',
        buttons: [
          { href: '/index.html', label: 'Go to Home', primary: true }
        ]
      },
      'insufficient-permission': {
        icon: 'fa-lock',
        title: 'Permission not granted',
        body: 'You don\'t have permission for this admin page. You may have access to other admin sections.',
        buttons: [
          { href: '/admin/', label: 'Admin Dashboard', primary: true },
          { href: '/index.html', label: 'Go to Home', primary: false }
        ]
      }
    };

    var cfg = configs[reason] || configs['no-permission'];

    var btnHtml = cfg.buttons.map(function (b) {
      var base = 'display:inline-block;padding:.5rem 1.25rem;border-radius:.5rem;font-weight:600;font-size:.9375rem;cursor:pointer;text-decoration:none;transition:opacity .15s;';
      var style = b.primary
        ? base + 'background:#F59E0B;color:#fff;border:none;'
        : base + 'background:#fff;color:#374151;border:1.5px solid #d1d5db;';
      return '<a href="' + b.href + '" style="' + style + '">' + b.label + '</a>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#f9fafb;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.12);max-width:26rem;width:100%;padding:2.5rem;text-align:center;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;">' +
          '<i class="fas ' + cfg.icon + '" style="font-size:1.75rem;color:#d97706;"></i>' +
        '</div>' +
        '<h2 style="font-size:1.25rem;font-weight:700;color:#111827;margin:0 0 .5rem;">' + cfg.title + '</h2>' +
        '<p style="color:#6b7280;margin:0 0 1.75rem;font-size:.9375rem;line-height:1.5;">' + cfg.body + '</p>' +
        '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">' + btnHtml + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function waitForFirebase(callback) {
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
        window.location.href = '/index.html';
        return;
      }

      user.getIdTokenResult()
        .then(function (result) {
          var claims = result.claims;
          var isSuperadmin = claims.superadmin === true;
          var hasPerms = Array.isArray(claims.perms) && claims.perms.length > 0;

          if (!isSuperadmin && !hasPerms) {
            showAccessDenied('no-permission');
            return;
          }

          if (requiredPerm) {
            var ok = isSuperadmin || (Array.isArray(claims.perms) && claims.perms.includes(requiredPerm));
            if (!ok) showAccessDenied('insufficient-permission');
          }
        })
        .catch(function (err) {
          console.error('Admin auth check failed:', err);
          window.location.href = '/index.html';
        });
    });
  });
})();
