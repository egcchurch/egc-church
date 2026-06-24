const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egc-church',
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: fs.readFileSync('storage.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function superAdmin() {
  return testEnv.authenticatedContext('admin-uid', { superadmin: true });
}

function permsAdmin() {
  // Any non-empty perms array satisfies isAdminUser(), regardless of which keys.
  return testEnv.authenticatedContext('editor-uid', { perms: ['sermons.manage'] });
}

function memberUser() {
  return testEnv.authenticatedContext('member-uid', {});
}

function otherUser() {
  return testEnv.authenticatedContext('other-uid', {});
}

function unauthUser() {
  return testEnv.unauthenticatedContext();
}

async function seedFile(path, contentType, bytes = 'seed-content') {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(path).put(Buffer.from(bytes), { contentType });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
//
// The combined `allow write: if isAdminUser() && isValidImage();` style rule
// silently denied every delete, because request.resource doesn't exist on a
// delete request and isValidImage() reads request.resource.contentType.
// These tests guard the create/update vs delete split that fixes this.

describe('Storage Security Rules', () => {

  describe('Team photos (isAdminUser pattern)', () => {
    it('admin can upload a valid image', async () => {
      const ref = permsAdmin().storage().ref('team/photo.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('non-admin cannot upload', async () => {
      const ref = memberUser().storage().ref('team/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('admin can delete', async () => {
      await seedFile('team/photo.jpg', 'image/jpeg');
      await assertSucceeds(permsAdmin().storage().ref('team/photo.jpg').delete());
    });

    it('non-admin cannot delete', async () => {
      await seedFile('team/photo.jpg', 'image/jpeg');
      await assertFails(memberUser().storage().ref('team/photo.jpg').delete());
    });

    it('anyone can read', async () => {
      await seedFile('team/photo.jpg', 'image/jpeg');
      await assertSucceeds(unauthUser().storage().ref('team/photo.jpg').getDownloadURL());
    });
  });

  describe('Profile photos (isOwner pattern)', () => {
    it('owner can upload their own photo', async () => {
      const ref = memberUser().storage().ref('users/member-uid/photo');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('a different user cannot upload to someone else\'s photo path', async () => {
      const ref = otherUser().storage().ref('users/member-uid/photo');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('owner can delete their own photo', async () => {
      await seedFile('users/member-uid/photo', 'image/jpeg');
      await assertSucceeds(memberUser().storage().ref('users/member-uid/photo').delete());
    });

    it('a different user cannot delete it', async () => {
      await seedFile('users/member-uid/photo', 'image/jpeg');
      await assertFails(otherUser().storage().ref('users/member-uid/photo').delete());
    });

    it('unauthenticated user cannot read', async () => {
      await seedFile('users/member-uid/photo', 'image/jpeg');
      await assertFails(unauthUser().storage().ref('users/member-uid/photo').getDownloadURL());
    });
  });

  describe('Sermon audio (combined OR validator pattern)', () => {
    it('admin can upload audio', async () => {
      const ref = permsAdmin().storage().ref('sermons/sermon1/audio.mp3');
      await assertSucceeds(ref.put(Buffer.from('audio'), { contentType: 'audio/mpeg' }));
    });

    it('admin can delete despite the OR-combined validator', async () => {
      await seedFile('sermons/sermon1/audio.mp3', 'audio/mpeg');
      await assertSucceeds(permsAdmin().storage().ref('sermons/sermon1/audio.mp3').delete());
    });

    it('non-admin cannot delete', async () => {
      await seedFile('sermons/sermon1/audio.mp3', 'audio/mpeg');
      await assertFails(memberUser().storage().ref('sermons/sermon1/audio.mp3').delete());
    });
  });

  describe('Site media (superadmin-only pattern, stricter than isAdminUser)', () => {
    it('superadmin can upload', async () => {
      const ref = superAdmin().storage().ref('site-media/file.pdf');
      await assertSucceeds(ref.put(Buffer.from('doc'), { contentType: 'application/pdf' }));
    });

    it('a non-superadmin admin (perms only) cannot upload', async () => {
      const ref = permsAdmin().storage().ref('site-media/file.pdf');
      await assertFails(ref.put(Buffer.from('doc'), { contentType: 'application/pdf' }));
    });

    it('superadmin can delete', async () => {
      await seedFile('site-media/file.pdf', 'application/pdf');
      await assertSucceeds(superAdmin().storage().ref('site-media/file.pdf').delete());
    });

    it('a non-superadmin admin (perms only) cannot delete', async () => {
      await seedFile('site-media/file.pdf', 'application/pdf');
      await assertFails(permsAdmin().storage().ref('site-media/file.pdf').delete());
    });
  });

  describe('Branding logo (superadmin-only pattern)', () => {
    it('superadmin can delete', async () => {
      await seedFile('branding/logo.png', 'image/png');
      await assertSucceeds(superAdmin().storage().ref('branding/logo.png').delete());
    });

    it('a non-superadmin admin (perms only) cannot delete', async () => {
      await seedFile('branding/logo.png', 'image/png');
      await assertFails(permsAdmin().storage().ref('branding/logo.png').delete());
    });
  });

  describe('Delete regression sweep — every remaining admin-gated path', () => {
    const paths = [
      ['sermons/sermon1/materials/notes.pdf', 'application/pdf'],
      ['gallery/gallery1/photo.jpg', 'image/jpeg'],
      ['series/series1/cover.jpg', 'image/jpeg'],
      ['music/track.mp3', 'audio/mpeg'],
      ['music/covers/cover.jpg', 'image/jpeg'],
      ['blog/cover.jpg', 'image/jpeg'],
      ['blog/post1/gallery1.jpg', 'image/jpeg'],
      ['events/cover.jpg', 'image/jpeg'],
    ];

    paths.forEach(([path, contentType]) => {
      it(`admin can delete ${path}`, async () => {
        await seedFile(path, contentType);
        await assertSucceeds(permsAdmin().storage().ref(path).delete());
      });
    });
  });
});
