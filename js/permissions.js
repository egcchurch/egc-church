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

  return { init, refresh, hasPermission, isSuperadmin };
})();
