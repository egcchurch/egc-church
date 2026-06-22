const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egc-church',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: require('fs').readFileSync('firestore.rules', 'utf8')
    }
  });
});

after(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function pendingUser() {
  return testEnv.authenticatedContext('pending-uid', {});
}

function memberUser() {
  return testEnv.authenticatedContext('member-uid', {});
}

function editorUser() {
  // All 14 permission keys — mirrors the content_editor role after migration
  return testEnv.authenticatedContext('editor-uid', {
    perms: [
      'sermons.manage', 'events.manage', 'blog.manage', 'team.manage',
      'gallery.manage', 'music.manage', 'devotional.manage', 'groups.manage',
      'homepage.manage', 'notifications.send', 'prayer.moderate', 'connect.view',
      'users.approve', 'users.assign_roles',
    ],
  });
}

function superAdmin() {
  return testEnv.authenticatedContext('admin-uid', { superadmin: true });
}

function unauthUser() {
  return testEnv.unauthenticatedContext();
}

function approveOnlyUser() {
  return testEnv.authenticatedContext('approve-uid', { perms: ['users.approve'] });
}

function assignRolesUser() {
  return testEnv.authenticatedContext('assignroles-uid', { perms: ['users.assign_roles'] });
}

function cottageUser() {
  return testEnv.authenticatedContext('cottage-uid', { perms: ['cottage.manage'] });
}

async function seedUser(uid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Firestore Security Rules', () => {

  describe('Users collection', () => {
    it('user can self-provision their own doc as pending', async () => {
      const db = pendingUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'users', 'pending-uid'), {
        uid: 'pending-uid', email: 'p@e.com', membership: 'pending',
        isSuperadmin: false, roles: [], extraPermissions: [],
      }));
    });

    it('user cannot self-provision as a member', async () => {
      const db = pendingUser().firestore();
      await assertFails(setDoc(doc(db, 'users', 'pending-uid'), {
        uid: 'pending-uid', email: 'p@e.com', membership: 'member',
        isSuperadmin: false, roles: [], extraPermissions: [],
      }));
    });

    it('user cannot self-provision as superadmin', async () => {
      const db = pendingUser().firestore();
      await assertFails(setDoc(doc(db, 'users', 'pending-uid'), {
        uid: 'pending-uid', email: 'p@e.com', membership: 'pending',
        isSuperadmin: true, roles: [], extraPermissions: [],
      }));
    });

    it('user cannot self-provision with roles', async () => {
      const db = pendingUser().firestore();
      await assertFails(setDoc(doc(db, 'users', 'pending-uid'), {
        uid: 'pending-uid', email: 'p@e.com', membership: 'pending',
        isSuperadmin: false, roles: ['administrator'], extraPermissions: [],
      }));
    });

    it('pending user cannot read another user doc', async () => {
      await seedUser('pending-uid', { membership: 'pending' });
      await seedUser('other-uid', { membership: 'member' });
      const db = pendingUser().firestore();
      await assertFails(getDoc(doc(db, 'users', 'other-uid')));
    });

    it('user can read their own doc', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'users', 'member-uid')));
    });
  });

  describe('Sermons collection', () => {
    it('anyone can read sermons', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'sermons', 's1'), { title: 'Test' });
      });
      const db = unauthUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'sermons', 's1')));
    });

    it('member cannot write sermons', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'sermons', 's1'), { title: 'Hack' }));
    });
  });

  describe('Gallery collection', () => {
    it('public user cannot read members-only gallery', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'gallery', 'g1'), { audience: 'members' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'gallery', 'g1')));
    });

    it('member can read members-only gallery', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'gallery', 'g1'), { audience: 'members' });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'gallery', 'g1')));
    });
  });

  describe('Groups collection', () => {
    it('group leader can update members but not name', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
          name: 'Youth',
          leaders: ['member-uid'],
          members: [],
          pendingMembers: []
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { members: ['member-uid'] }));
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { name: 'Hacked' }));
    });

    it('member (non-leader) can join an open group', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
          name: 'Open Group',
          leaders: ['other-uid'],
          members: [],
          pendingMembers: [],
          joinPolicy: 'open'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { members: ['member-uid'] }));
    });

    it('member cannot change group name', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
          name: 'Group',
          leaders: ['other-uid'],
          members: [],
          pendingMembers: []
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { name: 'Hacked' }));
    });
  });

  describe('Prayer collection', () => {
    it('member can submit a prayer request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'prayer', 'p1'), {
        uid: 'member-uid', body: 'Please pray for me', isAnonymous: false, isPrivate: false, prayedFor: []
      }));
    });

    it('unauthenticated user cannot read prayer requests', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'member-uid', body: 'Prayer' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'prayer', 'p1')));
    });

    it('member can read prayer requests', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'other-uid', body: 'Prayer', isPrivate: false });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'prayer', 'p1')));
    });

    it('author can update status and testimony on own request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'member-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'prayer', 'p1'), { status: 'answered', testimony: 'God provided!' }));
    });

    it('author cannot update body or uid on own request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'member-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'prayer', 'p1'), { body: 'Changed text' }));
    });

    it('other member cannot update status on someone else\'s request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'prayer', 'p1'), { status: 'answered' }));
    });

    it('moderator can update status on any prayer request', async () => {
      await seedUser('editor-uid', { membership: 'member', isSuperadmin: false });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = editorUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'prayer', 'p1'), { status: 'answered' }));
    });

    it('any member can toggle prayedFor on someone else\'s request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'prayer', 'p1'), { prayedFor: ['member-uid'] }));
    });

    it('member cannot piggyback other fields onto a prayedFor update', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'prayer', 'p1'), { prayedFor: ['member-uid'], status: 'answered' }));
    });

    it('member cannot create a prayer request spoofing another author', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'prayer', 'p1'), {
        uid: 'other-uid', body: 'Not mine', isAnonymous: false, isPrivate: false, prayedFor: []
      }));
    });

    it('author can delete own prayer request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'member-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'prayer', 'p1')));
    });

    it('member cannot delete someone else\'s prayer request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(deleteDoc(doc(db, 'prayer', 'p1')));
    });
  });

  describe('Events collection — RSVP', () => {
    it('member can add their own UID to rsvps', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1'), { title: 'Service', published: true, rsvps: [] });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'events', 'e1'), { rsvps: ['member-uid'] }));
    });

    it('member cannot update event title', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1'), { title: 'Service', published: true, rsvps: [] });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'events', 'e1'), { title: 'Hacked' }));
    });

    it('unauthenticated user cannot update rsvps', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1'), { title: 'Service', published: true, rsvps: [] });
      });
      const db = unauthUser().firestore();
      await assertFails(updateDoc(doc(db, 'events', 'e1'), { rsvps: ['anon'] }));
    });

    it('editor can update event title', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1'), { title: 'Service', published: true, rsvps: [] });
      });
      const db = editorUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'events', 'e1'), { title: 'Updated Service' }));
    });
  });

  describe('Devotionals collection', () => {
    it('member can read devotionals', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'devotionals', 'd1'), { date: '2026-05-24', title: 'Test', body: 'Content' });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'devotionals', 'd1')));
    });

    it('unauthenticated user cannot read devotionals', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'devotionals', 'd1'), { date: '2026-05-24', title: 'Test' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'devotionals', 'd1')));
    });

    it('member cannot write devotionals', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'devotionals', 'd1'), { date: '2026-05-24', title: 'Hack' }));
    });

    it('editor can write devotionals', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      const db = editorUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'devotionals', 'd1'), { date: '2026-05-24', title: 'Devotional', body: 'Content' }));
    });
  });

  describe('Users directory', () => {
    it('member can read a directory-visible member profile', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedUser('other-uid', { membership: 'member', directoryVisible: true });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'users', 'other-uid')));
    });

    it('member cannot read a profile with directoryVisible false', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedUser('other-uid', { membership: 'member', directoryVisible: false });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'users', 'other-uid')));
    });
  });

  describe('Messages collection', () => {
    it('user cannot read message they are not a participant of', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'messages', 'm1'), {
          participants: ['other-uid', 'another-uid'],
          text: 'secret'
        });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'messages', 'm1')));
    });
  });

  describe('Conversations collection', () => {
    it('participant can read their conversation', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid'],
          lastMessage: 'Hello'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'conversations', 'conv1')));
    });

    it('non-participant cannot read conversation', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['other-uid', 'another-uid'],
          lastMessage: 'Secret'
        });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'conversations', 'conv1')));
    });

    it('participant can read messages in their conversation', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'other-uid', body: 'Hi there', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1')));
    });

    it('non-participant cannot read messages in someone else conversation', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['other-uid', 'another-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'other-uid', body: 'Private', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1')));
    });
  });

  describe('User notifications subcollection', () => {
    it('user can read their own notifications', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'member-uid', 'notifications', 'n1'), {
          title: 'Test', body: 'Hello', read: false
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'users', 'member-uid', 'notifications', 'n1')));
    });

    it('user can mark their own notification as read', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'member-uid', 'notifications', 'n1'), {
          title: 'Test', body: 'Hello', read: false
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'users', 'member-uid', 'notifications', 'n1'), { read: true }));
    });

    it('user cannot read another user notification', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'other-uid', 'notifications', 'n1'), {
          title: 'Secret', read: false
        });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'users', 'other-uid', 'notifications', 'n1')));
    });

    it('user can write their own FCM token', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'users', 'member-uid', 'fcmTokens', 'tok1'), {
        token: 'abc123', device: 'Chrome', registeredAt: null
      }));
    });
  });

  describe('Connect collection', () => {
    it('anyone (unauthenticated) can submit a connect form', async () => {
      const db = unauthUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'connect', 'c1'), {
        name: 'Visitor', email: 'v@example.com', message: 'Hello', read: false
      }));
    });

    it('connect submission cannot pre-mark itself as read', async () => {
      const db = unauthUser().firestore();
      await assertFails(setDoc(doc(db, 'connect', 'c1'), {
        name: 'Visitor', email: 'v@example.com', message: 'Hello', read: true
      }));
    });

    it('connect submission with an oversized message is rejected', async () => {
      const db = unauthUser().firestore();
      await assertFails(setDoc(doc(db, 'connect', 'c1'), {
        name: 'Visitor', email: 'v@example.com', message: 'x'.repeat(5001), read: false
      }));
    });

    it('connect submission with an unexpected field is rejected', async () => {
      const db = unauthUser().firestore();
      await assertFails(setDoc(doc(db, 'connect', 'c1'), {
        name: 'Visitor', email: 'v@example.com', message: 'Hello', read: false, isSuperadmin: true
      }));
    });

    it('unauthenticated user cannot read submissions', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'connect', 'c1'), { name: 'Visitor', read: false });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'connect', 'c1')));
    });

    it('editor can read and mark a submission read', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'connect', 'c1'), { name: 'Visitor', read: false });
      });
      const db = editorUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'connect', 'c1')));
      await assertSucceeds(updateDoc(doc(db, 'connect', 'c1'), { read: true }));
    });

    it('member cannot read submissions', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'connect', 'c1'), { name: 'Visitor', read: false });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'connect', 'c1')));
    });
  });

  describe('Roles collection', () => {
    it('unauthenticated user cannot read roles', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'roles', 'deacon'), { displayName: 'Deacon', isSystem: true, permissions: [] });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'roles', 'deacon')));
    });

    it('authenticated member can read roles', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'roles', 'deacon'), { displayName: 'Deacon', isSystem: true, permissions: [] });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'roles', 'deacon')));
    });

    it('member cannot create a role', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'roles', 'new-role'), { displayName: 'Hacker', permissions: [], isSystem: false }));
    });

    it('editor cannot create a role', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      const db = editorUser().firestore();
      await assertFails(setDoc(doc(db, 'roles', 'new-role'), { displayName: 'Editor Role', permissions: [], isSystem: false }));
    });

    it('superadmin can create a role', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      const db = superAdmin().firestore();
      await assertSucceeds(setDoc(doc(db, 'roles', 'new-role'), { displayName: 'New Role', permissions: [], isSystem: false }));
    });

    it('superadmin cannot delete a system role', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'roles', 'deacon'), { displayName: 'Deacon', isSystem: true, permissions: [] });
      });
      const db = superAdmin().firestore();
      await assertFails(deleteDoc(doc(db, 'roles', 'deacon')));
    });

    it('superadmin can delete a non-system role', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'roles', 'custom-role'), { displayName: 'Custom', isSystem: false, permissions: [] });
      });
      const db = superAdmin().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'roles', 'custom-role')));
    });
  });

  describe('User document — privilege escalation guards', () => {
    it('users.approve holder can set membership on another user', async () => {
      await seedUser('approve-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'pending', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = approveOnlyUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'users', 'target-uid'), { membership: 'member' }));
    });

    it('users.approve holder cannot set isSuperadmin on another user', async () => {
      await seedUser('approve-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'pending', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = approveOnlyUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'target-uid'), { isSuperadmin: true }));
    });

    it('users.approve holder cannot set roles on another user', async () => {
      await seedUser('approve-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'pending', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = approveOnlyUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'target-uid'), { roles: ['administrator'] }));
    });

    it('users.assign_roles holder can set roles and extraPermissions on another user', async () => {
      await seedUser('assignroles-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'member', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = assignRolesUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'users', 'target-uid'), { roles: ['deacon'], extraPermissions: [] }));
    });

    it('users.assign_roles holder cannot set membership on another user', async () => {
      await seedUser('assignroles-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'pending', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = assignRolesUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'target-uid'), { membership: 'member' }));
    });

    it('users.assign_roles holder cannot set isSuperadmin on another user', async () => {
      await seedUser('assignroles-uid', { membership: 'member' });
      await seedUser('target-uid', { membership: 'member', isSuperadmin: false, roles: [], extraPermissions: [] });
      const db = assignRolesUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'target-uid'), { isSuperadmin: true }));
    });
  });

  describe('Conversation — participant write restrictions', () => {
    it('participant can update conversation metadata', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid'],
          lastMessage: 'Hello',
          lastMessageAt: null,
          unreadBy: []
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'conversations', 'conv1'), { lastMessage: 'Updated', unreadBy: ['other-uid'] }));
    });

    it('participant cannot overwrite participants array', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid'],
          lastMessage: 'Hello'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'conversations', 'conv1'), { participants: ['member-uid', 'intruder-uid'] }));
    });
  });

  describe('Homepage collection', () => {
    it('unauthenticated user can read homepage content', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'homepage', 'content'), { tagline: 'Welcome' });
      });
      const db = unauthUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'homepage', 'content')));
    });

    it('member cannot write homepage content', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'homepage', 'content'), { tagline: 'Hack' }));
    });

    it('editor can write homepage content', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      const db = editorUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'homepage', 'content'), {
        tagline: 'Welcome to EGC',
        serviceTimes: [],
        announcement: { visible: false, title: '', body: '' }
      }));
    });
  });

  describe('Config collection', () => {
    it('unauthenticated user cannot read config', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'config', 'notifications'), { connectAlertEmail: 'office@egc.church' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'config', 'notifications')));
    });

    it('authenticated member can read config', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'config', 'notifications'), { connectAlertEmail: 'office@egc.church' });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'config', 'notifications')));
    });

    it('member cannot write config', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'config', 'notifications'), { connectAlertEmail: 'hack@example.com' }));
    });

    it('editor cannot write config', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      const db = editorUser().firestore();
      await assertFails(setDoc(doc(db, 'config', 'notifications'), { connectAlertEmail: 'hack@example.com' }));
    });

    it('superadmin can read and write config', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      const db = superAdmin().firestore();
      await assertSucceeds(setDoc(doc(db, 'config', 'notifications'), { connectAlertEmail: 'office@egc.church' }));
      await assertSucceeds(getDoc(doc(db, 'config', 'notifications')));
    });
  });

  describe('Cottage meetings', () => {
    async function seedMeeting(id, hostUid) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'cottageMeetings', id), {
          regionId: 'north', regionName: 'North', hostUid, address: '1 Main Rd',
          date: '2026-07-01', capacity: 20, seatsTaken: 0, open: true,
        });
      });
    }

    it('member can read a cottage meeting', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedMeeting('m1', 'cottage-uid');
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'cottageMeetings', 'm1')));
    });

    it('non-member cannot read a cottage meeting', async () => {
      await seedUser('pending-uid', { membership: 'pending' });
      await seedMeeting('m1', 'cottage-uid');
      const db = pendingUser().firestore();
      await assertFails(getDoc(doc(db, 'cottageMeetings', 'm1')));
    });

    it('cottage.manage holder can create a meeting they host', async () => {
      const db = cottageUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'cottageMeetings', 'm2'), {
        regionId: 'north', hostUid: 'cottage-uid', address: '2 Rd', date: '2026-07-01', capacity: 10, seatsTaken: 0, open: true,
      }));
    });

    it('cottage.manage holder cannot create a meeting hosted by someone else', async () => {
      const db = cottageUser().firestore();
      await assertFails(setDoc(doc(db, 'cottageMeetings', 'm3'), {
        regionId: 'north', hostUid: 'someone-else', address: '3 Rd', date: '2026-07-01', capacity: 10, seatsTaken: 0, open: true,
      }));
    });

    it('plain member cannot create a cottage meeting', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'cottageMeetings', 'm4'), {
        regionId: 'north', hostUid: 'member-uid', address: '4 Rd', date: '2026-07-01', capacity: 10, seatsTaken: 0, open: true,
      }));
    });

    it('host can update their own meeting', async () => {
      await seedMeeting('m1', 'cottage-uid');
      const db = cottageUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'cottageMeetings', 'm1'), { capacity: 30 }));
    });

    it('cottage holder cannot update a meeting hosted by someone else', async () => {
      await seedMeeting('m1', 'other-host');
      const db = cottageUser().firestore();
      await assertFails(updateDoc(doc(db, 'cottageMeetings', 'm1'), { capacity: 30 }));
    });

    it('client cannot create a registration directly (function-only)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'cottageRegistrations', 'member-uid'), {
        uid: 'member-uid', meetingId: 'm1', partySize: 2,
      }));
    });

    it('member can read their own registration', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'cottageRegistrations', 'member-uid'), { uid: 'member-uid', meetingId: 'm1', partySize: 2 });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'cottageRegistrations', 'member-uid')));
    });

    it('host can delete a registration for their meeting (cleanup)', async () => {
      await seedMeeting('m1', 'cottage-uid');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'cottageRegistrations', 'member-uid'), { uid: 'member-uid', meetingId: 'm1', partySize: 2 });
      });
      const db = cottageUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'cottageRegistrations', 'member-uid')));
    });

    it('member cannot delete their own registration directly (must use the function)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedMeeting('m1', 'cottage-uid');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'cottageRegistrations', 'member-uid'), { uid: 'member-uid', meetingId: 'm1', partySize: 2 });
      });
      const db = memberUser().firestore();
      await assertFails(deleteDoc(doc(db, 'cottageRegistrations', 'member-uid')));
    });
  });

});