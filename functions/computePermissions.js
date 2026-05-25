'use strict';

// Pure permission computation — no Firebase dependencies.
// Imported by index.js (trigger) and tested directly in tests/syncUserClaims.test.js.

/**
 * Compute the Firebase Auth custom claims object for a user.
 *
 * @param {boolean}                         isSuperadmin
 * @param {Array<{permissions: string[]}>}  roleDocs       — hydrated role data objects
 * @param {string[]}                        extraPermissions
 * @returns {{ superadmin: true } | { superadmin: false, perms: string[] }}
 */
function computeEffectiveClaims(isSuperadmin, roleDocs, extraPermissions) {
  if (isSuperadmin) return { superadmin: true };

  const permsSet = new Set();
  (roleDocs || []).forEach((role) => {
    (role.permissions || []).forEach((p) => permsSet.add(p));
  });
  (extraPermissions || []).forEach((p) => permsSet.add(p));

  return { superadmin: false, perms: [...permsSet] };
}

/**
 * Returns true if any permission-relevant field changed between snapshots.
 * Pass null for `before` when the document is being created.
 *
 * @param {object|null} before
 * @param {object}      after
 */
function permissionFieldsChanged(before, after) {
  if (before === null) return true;
  const fields = ['isSuperadmin', 'roles', 'extraPermissions'];
  return fields.some(
    (f) => JSON.stringify(after[f] ?? null) !== JSON.stringify(before[f] ?? null)
  );
}

module.exports = { computeEffectiveClaims, permissionFieldsChanged };
