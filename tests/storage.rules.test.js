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

// Per-permission admin contexts — each holds exactly one permission key.
function sermonsAdmin()  { return testEnv.authenticatedContext('sermons-uid',  { perms: ['sermons.manage']  }); }
function galleryAdmin()  { return testEnv.authenticatedContext('gallery-uid',  { perms: ['gallery.manage']  }); }
function musicAdmin()    { return testEnv.authenticatedContext('music-uid',    { perms: ['music.manage']    }); }
function blogAdmin()     { return testEnv.authenticatedContext('blog-uid',     { perms: ['blog.manage']     }); }
function eventsAdmin()   { return testEnv.authenticatedContext('events-uid',   { perms: ['events.manage']   }); }
function teamAdmin()     { return testEnv.authenticatedContext('team-uid',     { perms: ['team.manage']     }); }
function prayerAdmin()   { return testEnv.authenticatedContext('prayer-uid',   { perms: ['prayer.moderate'] }); }

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
//
// The former blanket `isAdminUser()` (any non-empty perms array) has been
// replaced with per-path `hasPermission(p)` checks. Tests also verify that
// a user holding the wrong permission is rejected (cross-permission denial).

describe('Storage Security Rules', () => {

  describe('Team photos — team.manage', () => {
    it('team.manage admin can upload a valid image', async () => {
      const ref = teamAdmin().storage().ref('team/photo.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('superadmin can upload a valid image', async () => {
      const ref = superAdmin().storage().ref('team/photo.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('sermons.manage admin cannot upload to team path', async () => {
      const ref = sermonsAdmin().storage().ref('team/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('prayer.moderate admin cannot upload to team path', async () => {
      const ref = prayerAdmin().storage().ref('team/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('non-admin cannot upload', async () => {
      const ref = memberUser().storage().ref('team/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('team.manage admin can delete', async () => {
      await seedFile('team/photo.jpg', 'image/jpeg');
      await assertSucceeds(teamAdmin().storage().ref('team/photo.jpg').delete());
    });

    it('sermons.manage admin cannot delete from team path', async () => {
      await seedFile('team/photo.jpg', 'image/jpeg');
      await assertFails(sermonsAdmin().storage().ref('team/photo.jpg').delete());
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

  describe('Profile photos — isOwner pattern', () => {
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

  describe('Sermon audio — sermons.manage', () => {
    it('sermons.manage admin can upload audio', async () => {
      const ref = sermonsAdmin().storage().ref('sermons/sermon1/audio.mp3');
      await assertSucceeds(ref.put(Buffer.from('audio'), { contentType: 'audio/mpeg' }));
    });

    it('gallery.manage admin cannot upload to sermon path', async () => {
      const ref = galleryAdmin().storage().ref('sermons/sermon1/audio.mp3');
      await assertFails(ref.put(Buffer.from('audio'), { contentType: 'audio/mpeg' }));
    });

    it('sermons.manage admin can delete despite the OR-combined validator', async () => {
      await seedFile('sermons/sermon1/audio.mp3', 'audio/mpeg');
      await assertSucceeds(sermonsAdmin().storage().ref('sermons/sermon1/audio.mp3').delete());
    });

    it('non-admin cannot delete', async () => {
      await seedFile('sermons/sermon1/audio.mp3', 'audio/mpeg');
      await assertFails(memberUser().storage().ref('sermons/sermon1/audio.mp3').delete());
    });
  });

  describe('Gallery images — gallery.manage', () => {
    it('gallery.manage admin can upload an image', async () => {
      const ref = galleryAdmin().storage().ref('gallery/gallery1/photo.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('sermons.manage admin cannot upload to gallery path', async () => {
      const ref = sermonsAdmin().storage().ref('gallery/gallery1/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('prayer.moderate admin cannot upload to gallery path', async () => {
      const ref = prayerAdmin().storage().ref('gallery/gallery1/photo.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('gallery.manage admin can delete', async () => {
      await seedFile('gallery/gallery1/photo.jpg', 'image/jpeg');
      await assertSucceeds(galleryAdmin().storage().ref('gallery/gallery1/photo.jpg').delete());
    });

    it('sermons.manage admin cannot delete from gallery path', async () => {
      await seedFile('gallery/gallery1/photo.jpg', 'image/jpeg');
      await assertFails(sermonsAdmin().storage().ref('gallery/gallery1/photo.jpg').delete());
    });
  });

  describe('Music — music.manage', () => {
    it('music.manage admin can upload audio', async () => {
      const ref = musicAdmin().storage().ref('music/track.mp3');
      await assertSucceeds(ref.put(Buffer.from('audio'), { contentType: 'audio/mpeg' }));
    });

    it('sermons.manage admin cannot upload to music path', async () => {
      const ref = sermonsAdmin().storage().ref('music/track.mp3');
      await assertFails(ref.put(Buffer.from('audio'), { contentType: 'audio/mpeg' }));
    });

    it('music.manage admin can delete', async () => {
      await seedFile('music/track.mp3', 'audio/mpeg');
      await assertSucceeds(musicAdmin().storage().ref('music/track.mp3').delete());
    });

    it('music.manage admin can upload a cover image', async () => {
      const ref = musicAdmin().storage().ref('music/covers/cover.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('music.manage admin can delete a cover image', async () => {
      await seedFile('music/covers/cover.jpg', 'image/jpeg');
      await assertSucceeds(musicAdmin().storage().ref('music/covers/cover.jpg').delete());
    });

    it('gallery.manage admin cannot delete from music path', async () => {
      await seedFile('music/track.mp3', 'audio/mpeg');
      await assertFails(galleryAdmin().storage().ref('music/track.mp3').delete());
    });
  });

  describe('Blog images — blog.manage', () => {
    it('blog.manage admin can upload a cover image', async () => {
      const ref = blogAdmin().storage().ref('blog/cover.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('sermons.manage admin cannot upload to blog path', async () => {
      const ref = sermonsAdmin().storage().ref('blog/cover.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('blog.manage admin can delete', async () => {
      await seedFile('blog/cover.jpg', 'image/jpeg');
      await assertSucceeds(blogAdmin().storage().ref('blog/cover.jpg').delete());
    });

    it('blog.manage admin can upload a nested post image', async () => {
      const ref = blogAdmin().storage().ref('blog/post1/gallery1.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('blog.manage admin can delete a nested post image', async () => {
      await seedFile('blog/post1/gallery1.jpg', 'image/jpeg');
      await assertSucceeds(blogAdmin().storage().ref('blog/post1/gallery1.jpg').delete());
    });

    it('events.manage admin cannot delete from blog path', async () => {
      await seedFile('blog/cover.jpg', 'image/jpeg');
      await assertFails(eventsAdmin().storage().ref('blog/cover.jpg').delete());
    });
  });

  describe('Event images — events.manage', () => {
    it('events.manage admin can upload a cover image', async () => {
      const ref = eventsAdmin().storage().ref('events/cover.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('blog.manage admin cannot upload to events path', async () => {
      const ref = blogAdmin().storage().ref('events/cover.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('events.manage admin can delete', async () => {
      await seedFile('events/cover.jpg', 'image/jpeg');
      await assertSucceeds(eventsAdmin().storage().ref('events/cover.jpg').delete());
    });

    it('sermons.manage admin cannot delete from events path', async () => {
      await seedFile('events/cover.jpg', 'image/jpeg');
      await assertFails(sermonsAdmin().storage().ref('events/cover.jpg').delete());
    });
  });

  describe('Sermon series covers — sermons.manage', () => {
    it('sermons.manage admin can upload a series cover', async () => {
      const ref = sermonsAdmin().storage().ref('series/series1/cover.jpg');
      await assertSucceeds(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('gallery.manage admin cannot upload to series path', async () => {
      const ref = galleryAdmin().storage().ref('series/series1/cover.jpg');
      await assertFails(ref.put(Buffer.from('img'), { contentType: 'image/jpeg' }));
    });

    it('sermons.manage admin can delete a series cover', async () => {
      await seedFile('series/series1/cover.jpg', 'image/jpeg');
      await assertSucceeds(sermonsAdmin().storage().ref('series/series1/cover.jpg').delete());
    });
  });

  describe('Sermon materials — sermons.manage', () => {
    it('sermons.manage admin can upload a PDF', async () => {
      const ref = sermonsAdmin().storage().ref('sermons/sermon1/materials/notes.pdf');
      await assertSucceeds(ref.put(Buffer.from('doc'), { contentType: 'application/pdf' }));
    });

    it('sermons.manage admin can delete a material', async () => {
      await seedFile('sermons/sermon1/materials/notes.pdf', 'application/pdf');
      await assertSucceeds(sermonsAdmin().storage().ref('sermons/sermon1/materials/notes.pdf').delete());
    });

    it('blog.manage admin cannot delete from sermon materials path', async () => {
      await seedFile('sermons/sermon1/materials/notes.pdf', 'application/pdf');
      await assertFails(blogAdmin().storage().ref('sermons/sermon1/materials/notes.pdf').delete());
    });
  });

  describe('Site media — superadmin only', () => {
    it('superadmin can upload', async () => {
      const ref = superAdmin().storage().ref('site-media/file.pdf');
      await assertSucceeds(ref.put(Buffer.from('doc'), { contentType: 'application/pdf' }));
    });

    it('a non-superadmin admin (any perms) cannot upload', async () => {
      const ref = sermonsAdmin().storage().ref('site-media/file.pdf');
      await assertFails(ref.put(Buffer.from('doc'), { contentType: 'application/pdf' }));
    });

    it('superadmin can delete', async () => {
      await seedFile('site-media/file.pdf', 'application/pdf');
      await assertSucceeds(superAdmin().storage().ref('site-media/file.pdf').delete());
    });

    it('a non-superadmin admin (any perms) cannot delete', async () => {
      await seedFile('site-media/file.pdf', 'application/pdf');
      await assertFails(sermonsAdmin().storage().ref('site-media/file.pdf').delete());
    });
  });

  describe('Branding logo — superadmin only', () => {
    it('superadmin can delete', async () => {
      await seedFile('branding/logo.png', 'image/png');
      await assertSucceeds(superAdmin().storage().ref('branding/logo.png').delete());
    });

    it('a non-superadmin admin (any perms) cannot delete', async () => {
      await seedFile('branding/logo.png', 'image/png');
      await assertFails(sermonsAdmin().storage().ref('branding/logo.png').delete());
    });
  });
});
