// tests/syncUserClaims.test.js
// Pure unit tests for the permission computation helpers.
// No Firebase emulator required — these test only computePermissions.js.

const assert = require('assert');
const { computeEffectiveClaims, permissionFieldsChanged } = require('../functions/computePermissions');

describe('computeEffectiveClaims', () => {

  it('superadmin flag returns { superadmin: true } with no perms array', () => {
    const claims = computeEffectiveClaims(true, [], []);
    assert.deepStrictEqual(claims, { superadmin: true });
  });

  it('no roles and no extras returns empty perms array', () => {
    const claims = computeEffectiveClaims(false, [], []);
    assert.deepStrictEqual(claims, { superadmin: false, perms: [] });
  });

  it('permissions from a single role are included', () => {
    const roles = [{ permissions: ['sermons.manage', 'events.manage'] }];
    const claims = computeEffectiveClaims(false, roles, []);
    assert.strictEqual(claims.superadmin, false);
    assert.deepStrictEqual([...claims.perms].sort(), ['events.manage', 'sermons.manage']);
  });

  it('permissions from multiple roles are unioned', () => {
    const roles = [
      { permissions: ['sermons.manage', 'events.manage'] },
      { permissions: ['events.manage', 'blog.manage'] },
    ];
    const claims = computeEffectiveClaims(false, roles, []);
    assert.deepStrictEqual(
      [...claims.perms].sort(),
      ['blog.manage', 'events.manage', 'sermons.manage']
    );
  });

  it('extraPermissions are included in the union', () => {
    const roles = [{ permissions: ['sermons.manage'] }];
    const claims = computeEffectiveClaims(false, roles, ['connect.view']);
    assert.deepStrictEqual(
      [...claims.perms].sort(),
      ['connect.view', 'sermons.manage']
    );
  });

  it('duplicates across roles and extras are deduplicated', () => {
    const roles = [{ permissions: ['prayer.moderate'] }];
    const claims = computeEffectiveClaims(false, roles, ['prayer.moderate']);
    assert.deepStrictEqual(claims.perms, ['prayer.moderate']);
  });

  it('role with missing permissions array does not throw', () => {
    const claims = computeEffectiveClaims(false, [{}], []);
    assert.deepStrictEqual(claims, { superadmin: false, perms: [] });
  });

  it('superadmin flag overrides roles and extras (no perms computed)', () => {
    const roles = [{ permissions: ['sermons.manage'] }];
    const claims = computeEffectiveClaims(true, roles, ['connect.view']);
    assert.deepStrictEqual(claims, { superadmin: true });
  });

});

describe('permissionFieldsChanged', () => {

  it('returns true when before is null (doc creation)', () => {
    assert.strictEqual(permissionFieldsChanged(null, {}), true);
  });

  it('returns false when no permission fields changed (only displayName changed)', () => {
    const before = { roles: ['deacon'], extraPermissions: [], isSuperadmin: false, displayName: 'Alice' };
    const after  = { roles: ['deacon'], extraPermissions: [], isSuperadmin: false, displayName: 'Bob' };
    assert.strictEqual(permissionFieldsChanged(before, after), false);
  });

  it('returns true when roles array gains an entry', () => {
    const before = { roles: ['deacon'], extraPermissions: [], isSuperadmin: false };
    const after  = { roles: ['deacon', 'pastor'], extraPermissions: [], isSuperadmin: false };
    assert.strictEqual(permissionFieldsChanged(before, after), true);
  });

  it('returns true when roles array is cleared', () => {
    const before = { roles: ['deacon'], extraPermissions: [], isSuperadmin: false };
    const after  = { roles: [], extraPermissions: [], isSuperadmin: false };
    assert.strictEqual(permissionFieldsChanged(before, after), true);
  });

  it('returns true when isSuperadmin is promoted to true', () => {
    const before = { roles: [], extraPermissions: [], isSuperadmin: false };
    const after  = { roles: [], extraPermissions: [], isSuperadmin: true };
    assert.strictEqual(permissionFieldsChanged(before, after), true);
  });

  it('returns true when isSuperadmin is demoted to false', () => {
    const before = { roles: [], extraPermissions: [], isSuperadmin: true };
    const after  = { roles: [], extraPermissions: [], isSuperadmin: false };
    assert.strictEqual(permissionFieldsChanged(before, after), true);
  });

  it('returns true when extraPermissions gains an entry', () => {
    const before = { roles: [], extraPermissions: [], isSuperadmin: false };
    const after  = { roles: [], extraPermissions: ['connect.view'], isSuperadmin: false };
    assert.strictEqual(permissionFieldsChanged(before, after), true);
  });

  it('returns false when permission fields are absent in both before and after', () => {
    const before = { displayName: 'Alice', membership: 'member' };
    const after  = { displayName: 'Bob',   membership: 'member' };
    assert.strictEqual(permissionFieldsChanged(before, after), false);
  });

});
