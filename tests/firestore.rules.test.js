const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

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
  return testEnv.authenticatedContext('editor-uid', {});
}

function superAdmin() {
  return testEnv.authenticatedContext('admin-uid', {});
}

function unauthUser() {
  return testEnv.unauthenticatedContext();
}

async function seedUser(uid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Firestore Security Rules', () => {

  describe('Users collection', () => {
    it('pending user cannot read another user doc', async () => {
      await seedUser('pending-uid', { membership: 'pending', adminRole: null });
      await seedUser('other-uid', { membership: 'member', adminRole: null });
      const db = pendingUser().firestore();
      await assertFails(getDoc(doc(db, 'users', 'other-uid')));
    });

    it('user can read their own doc', async () => {
      await seedUser('member-uid', { membership: 'member', adminRole: null });
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
      await seedUser('member-uid', { membership: 'member', adminRole: null });
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
      await seedUser('member-uid', { membership: 'member', adminRole: null });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'gallery', 'g1'), { audience: 'members' });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'gallery', 'g1')));
    });
  });

  describe('Groups collection', () => {
    it('group leader can update members but not title', async () => {
      await seedUser('member-uid', { membership: 'member', adminRole: null });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
          title: 'Youth',
          leaders: ['member-uid'],
          members: [],
          pendingMembers: []
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { members: ['member-uid'] }));
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { title: 'Hacked' }));
    });
  });

  describe('Messages collection', () => {
    it('user cannot read message they are not a participant of', async () => {
      await seedUser('member-uid', { membership: 'member', adminRole: null });
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

  describe('Connect collection', () => {
    it('anyone (unauthenticated) can submit a connect form', async () => {
      const db = unauthUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'connect', 'c1'), {
        name: 'Visitor', email: 'v@example.com', message: 'Hello', read: false
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
      await seedUser('editor-uid', { membership: 'public', adminRole: 'editor' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'connect', 'c1'), { name: 'Visitor', read: false });
      });
      const db = editorUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'connect', 'c1')));
      await assertSucceeds(updateDoc(doc(db, 'connect', 'c1'), { read: true }));
    });

    it('member cannot read submissions', async () => {
      await seedUser('member-uid', { membership: 'member', adminRole: null });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'connect', 'c1'), { name: 'Visitor', read: false });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'connect', 'c1')));
    });
  });

});