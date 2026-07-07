const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } = require('firebase/firestore');

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

function servingTeamsManagerUser() {
  return testEnv.authenticatedContext('stmanager-uid', { perms: ['servingTeams.manage'] });
}

function equipmentManagerUser() {
  return testEnv.authenticatedContext('eqmanager-uid', { perms: ['equipment.manage'] });
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

  describe('Ignored YouTube imports collection', () => {
    it('sermons.manage holder can write an ignored video', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      const db = editorUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'ignoredYoutubeVideos', 'yt1'), {
        youtubeId: 'yt1', title: 'Funeral Service', ignoredBy: 'editor-uid',
      }));
    });

    it('sermons.manage holder can read the ignored videos list', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'ignoredYoutubeVideos', 'yt1'), { youtubeId: 'yt1', title: 'Funeral Service' });
      });
      const db = editorUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'ignoredYoutubeVideos', 'yt1')));
    });

    it('plain member cannot read or write ignored videos', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'ignoredYoutubeVideos', 'yt1'), { youtubeId: 'yt1', title: 'Funeral Service' });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'ignoredYoutubeVideos', 'yt1')));
      await assertFails(setDoc(doc(db, 'ignoredYoutubeVideos', 'yt2'), { youtubeId: 'yt2' }));
    });

    it('unauthenticated user cannot read or write ignored videos', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'ignoredYoutubeVideos', 'yt1'), { youtubeId: 'yt1', title: 'Funeral Service' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'ignoredYoutubeVideos', 'yt1')));
      await assertFails(setDoc(doc(db, 'ignoredYoutubeVideos', 'yt2'), { youtubeId: 'yt2' }));
    });

    it('sermons.manage holder can delete (restore) an ignored video', async () => {
      await seedUser('editor-uid', { membership: 'public', isSuperadmin: false, roles: ['content_editor'] });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'ignoredYoutubeVideos', 'yt1'), { youtubeId: 'yt1', title: 'Funeral Service' });
      });
      const db = editorUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'ignoredYoutubeVideos', 'yt1')));
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

  describe('Serving Teams collection', () => {
    it('any member can read a team', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'servingTeams', 'team1')));
    });

    it('plain member cannot create a team', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'servingTeams', 'team1'), {
        name: 'Hack Team', leaders: ['member-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [],
      }));
    });

    it('servingTeams.manage holder can create a team', async () => {
      const db = servingTeamsManagerUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'servingTeams', 'team1'), {
        name: 'Equipment Team', leaders: [], members: [], pendingMembers: [], memberTiers: {}, functions: [],
      }));
    });

    it('team leader can update members/pendingMembers/memberTiers/functions but not name', async () => {
      await seedUser('leader-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: ['leader-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const leaderDb = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(leaderDb, 'servingTeams', 'team1'), {
        members: ['leader-uid'], memberTiers: { 'leader-uid': 'qualified' }, functions: ['Sound'],
      }));
      await assertFails(updateDoc(doc(leaderDb, 'servingTeams', 'team1'), { name: 'Hacked' }));
    });

    it('team leader can assign a member\'s functions', async () => {
      await seedUser('leader-uid', { membership: 'member' });
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: ['leader-uid'], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound', 'Video'],
        });
      });
      const leaderDb = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(leaderDb, 'servingTeams', 'team1'), {
        memberFunctions: { 'member-uid': ['Sound', 'Video'] },
      }));
    });

    it('non-leader member cannot assign functions (their own or anyone else\'s)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
      });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1'), {
        memberFunctions: { 'member-uid': ['Sound'] },
      }));
    });

    it('team member can set their own availability (their key in memberAvailability only)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
      });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      // Team doc predates the memberAvailability field entirely — first write creates it
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1'), {
        'memberAvailability.member-uid': ['0|Morning'],
      }));
      // Ticking everything back stores an absent key (no restriction) via deleteField
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1'), {
        'memberAvailability.member-uid': deleteField(),
      }));
    });

    it('team member cannot set another member\'s availability', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid', 'other-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
      });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1'), {
        'memberAvailability.other-uid': ['0|Morning'],
      }));
    });

    it('team leader can set any member\'s availability', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: ['leader-uid'], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
      });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1'), {
        memberAvailability: { 'member-uid': ['0|Morning', '3|'] },
      }));
    });

    it('a member not on the team cannot write availability at all', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['other-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1'), {
        'memberAvailability.member-uid': ['0|Morning'],
      }));
    });

    it('team leader cannot write rosterPatterns (superseded by /schedules)', async () => {
      await seedUser('leader-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: ['leader-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const leaderDb = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertFails(updateDoc(doc(leaderDb, 'servingTeams', 'team1'), {
        rosterPatterns: [{ id: 'pat1', dayOfWeek: 0, label: 'Morning', functions: ['Sound'] }],
      }));
    });

    it('member (non-leader) can join an open team', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Open Team', leaders: ['other-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [], joinPolicy: 'open',
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1'), { members: ['member-uid'] }));
    });

    it('non-leader member cannot change the team name', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Team', leaders: ['other-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1'), { name: 'Hacked' }));
    });

    it('servingTeams.manage holder can delete a team', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Team', leaders: [], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const db = servingTeamsManagerUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'servingTeams', 'team1')));
    });
  });

  describe('Serving Teams slots subcollection', () => {
    async function seedTeamAndSlot({ leaders = [], members = [], memberFunctions = {} } = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders, members, pendingMembers: [], memberTiers: {}, functions: ['Sound'], memberFunctions,
        });
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1', 'slots', 'slot1'), {
          date: '2026-07-05', functions: ['Sound'], assignedUid: null, assignedName: null,
          trainingEnabled: true, traineeUid: null, traineeName: null, status: 'open', notes: null,
        });
      });
    }

    it('team member can read slots; an outsider cannot', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedUser('outsider-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'] });
      const memberDb = testEnv.authenticatedContext('member-uid', {}).firestore();
      const outsiderDb = testEnv.authenticatedContext('outsider-uid', {}).firestore();
      await assertSucceeds(getDoc(doc(memberDb, 'servingTeams', 'team1', 'slots', 'slot1')));
      await assertFails(getDoc(doc(outsiderDb, 'servingTeams', 'team1', 'slots', 'slot1')));
    });

    it('servingTeams.manage holder can read slots without being a team member', async () => {
      await seedTeamAndSlot({});
      const db = servingTeamsManagerUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1')));
    });

    it('leader can create and fully edit a slot', async () => {
      await seedTeamAndSlot({ leaders: ['leader-uid'] });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        functions: ['Sound', 'Camera'], notes: 'bring extra cable',
      }));
      await assertSucceeds(setDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot2'), {
        date: '2026-07-06', functions: ['Words'], assignedUid: null, assignedName: null,
        trainingEnabled: false, traineeUid: null, traineeName: null, status: 'open', notes: null,
      }));
    });

    it('a member assigned the matching function can claim an open slot for themselves', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'], memberFunctions: { 'member-uid': ['Sound'] } });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: 'member-uid', assignedName: 'Member', status: 'filled',
      }));
    });

    it('a member with no functions assigned is locked out of claiming (default until a leader assigns one)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: 'member-uid', assignedName: 'Member', status: 'filled',
      }));
    });

    it('a member assigned a non-matching function cannot claim a slot', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'], memberFunctions: { 'member-uid': ['Video'] } });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: 'member-uid', assignedName: 'Member', status: 'filled',
      }));
    });

    it('a member cannot assign someone else to an open slot', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: 'someone-else', assignedName: 'Someone Else', status: 'filled',
      }));
    });

    it('a member cannot claim an already-filled slot out from under someone', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1', 'slots', 'slot1'), {
          date: '2026-07-05', functions: ['Sound'], assignedUid: 'other-uid', assignedName: 'Other',
          trainingEnabled: false, traineeUid: null, traineeName: null, status: 'filled', notes: null,
        });
      });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: 'member-uid', assignedName: 'Member', status: 'filled',
      }));
    });

    it('a member can release their own slot back to open even without a matching function assignment, but not someone else\'s', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedUser('other-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        // Deliberately no memberFunctions entry — release must not be gated by
        // qualification, only claiming a NEW slot is.
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid', 'other-uid'], pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1', 'slots', 'slot1'), {
          date: '2026-07-05', functions: ['Sound'], assignedUid: 'member-uid', assignedName: 'Member',
          trainingEnabled: false, traineeUid: null, traineeName: null, status: 'filled', notes: null,
        });
      });
      const otherDb = testEnv.authenticatedContext('other-uid', {}).firestore();
      await assertFails(updateDoc(doc(otherDb, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: null, assignedName: null, status: 'open',
      }));
      const ownerDb = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(ownerDb, 'servingTeams', 'team1', 'slots', 'slot1'), {
        assignedUid: null, assignedName: null, status: 'open',
      }));
    });

    it('a member can claim the trainee position independently of the lead position', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'], memberFunctions: { 'member-uid': ['Sound'] } });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        traineeUid: 'member-uid', traineeName: 'Member',
      }));
    });

    it('a member with no functions assigned cannot claim the trainee position either', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1'), {
        traineeUid: 'member-uid', traineeName: 'Member',
      }));
    });

    it('a member cannot delete a slot (leader/admin only)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSlot({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(deleteDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1')));
    });

    it('leader can delete a slot', async () => {
      await seedTeamAndSlot({ leaders: ['leader-uid'] });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(deleteDoc(doc(db, 'servingTeams', 'team1', 'slots', 'slot1')));
    });
  });

  describe('Serving Teams schedules subcollection', () => {
    async function seedTeamAndSchedule({ leaders = [], members = [] } = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders, members, pendingMembers: [], memberTiers: {}, functions: ['Sound'],
        });
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1', 'schedules', 'sched1'), {
          name: 'EGC Elands',
          patterns: [{ id: 'pat1', dayOfWeek: 0, label: 'Morning', functions: ['Sound'] }],
          startDate: '2026-01-04', endDate: '2026-06-28',
        });
      });
    }

    it('team member can read schedules; an outsider cannot', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedUser('outsider-uid', { membership: 'member' });
      await seedTeamAndSchedule({ members: ['member-uid'] });
      const memberDb = testEnv.authenticatedContext('member-uid', {}).firestore();
      const outsiderDb = testEnv.authenticatedContext('outsider-uid', {}).firestore();
      await assertSucceeds(getDoc(doc(memberDb, 'servingTeams', 'team1', 'schedules', 'sched1')));
      await assertFails(getDoc(doc(outsiderDb, 'servingTeams', 'team1', 'schedules', 'sched1')));
    });

    it('servingTeams.manage holder can read schedules without being a team member', async () => {
      await seedTeamAndSchedule({});
      const db = servingTeamsManagerUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1')));
    });

    it('leader can create a schedule', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: ['leader-uid'], members: [], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(setDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1'), {
        name: 'EGC Elands',
        patterns: [{ id: 'pat1', dayOfWeek: 0, label: 'Morning', functions: ['Sound'] }],
        startDate: '2026-01-04', endDate: '2026-06-28',
      }));
    });

    it('non-leader member cannot create a schedule', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'servingTeams', 'team1'), {
          name: 'Equipment Team', leaders: [], members: ['member-uid'], pendingMembers: [], memberTiers: {}, functions: [],
        });
      });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(setDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1'), {
        name: 'Hack Schedule', patterns: [], startDate: '2026-01-04', endDate: '2026-06-28',
      }));
    });

    it('leader can update (edit) a schedule', async () => {
      await seedTeamAndSchedule({ leaders: ['leader-uid'] });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1'), {
        patterns: [{ id: 'pat1', dayOfWeek: 0, label: 'Morning', functions: ['Sound', 'Video'] }],
      }));
    });

    it('non-leader member cannot update a schedule', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSchedule({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(updateDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1'), {
        name: 'Hacked',
      }));
    });

    it('leader can delete a schedule', async () => {
      await seedTeamAndSchedule({ leaders: ['leader-uid'] });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(deleteDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1')));
    });

    it('non-leader member cannot delete a schedule', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await seedTeamAndSchedule({ members: ['member-uid'] });
      const db = testEnv.authenticatedContext('member-uid', {}).firestore();
      await assertFails(deleteDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1')));
    });

    it('servingTeams.manage holder can create/update/delete schedules without being a leader', async () => {
      await seedTeamAndSchedule({});
      const db = servingTeamsManagerUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1'), { name: 'Renamed' }));
      await assertSucceeds(deleteDoc(doc(db, 'servingTeams', 'team1', 'schedules', 'sched1')));
    });
  });

  describe('Equipment register (church-wide)', () => {
    // 'user-uid' is on the equipment-users access list; 'outsider-uid' is a
    // church member who is NOT — the register should be invisible to them.
    async function seedEquipment({ moveCreatedBy = 'someone-else' } = {}) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'equipmentAccess', 'users'), {
          uids: ['user-uid'], names: { 'user-uid': 'Equipment User' },
        });
        await setDoc(doc(ctx.firestore(), 'equipment', 'item1'), {
          name: 'Main Projector', category: 'Projector', condition: 'good', currentLocation: 'Elands',
          description: null, notes: null, photoUrl: null, lastMovedAt: null, lastMovedBy: null,
        });
        await setDoc(doc(ctx.firestore(), 'equipment', 'item1', 'private', 'finance'), {
          purchaseCost: 12500, purchaseDate: '2025-01-15',
        });
        await setDoc(doc(ctx.firestore(), 'equipmentMoves', 'move1'), {
          fromLocation: 'Elands', toLocation: 'Nestpark', scheduledFor: null, status: 'in-progress',
          items: [{ equipmentId: 'item1', name: 'Main Projector', packed: false }],
          createdBy: moveCreatedBy, createdByName: 'Someone', completedAt: null,
        });
      });
    }

    function equipmentUser() { return testEnv.authenticatedContext('user-uid', {}); }
    function nonListedMember() { return testEnv.authenticatedContext('outsider-uid', {}); }

    it('listed equipment user can read items; a non-listed member cannot', async () => {
      await seedEquipment();
      await assertSucceeds(getDoc(doc(equipmentUser().firestore(), 'equipment', 'item1')));
      await assertFails(getDoc(doc(nonListedMember().firestore(), 'equipment', 'item1')));
    });

    it('equipment user CANNOT read the private finance subdoc; manager and superadmin can', async () => {
      await seedEquipment();
      await assertFails(getDoc(doc(equipmentUser().firestore(), 'equipment', 'item1', 'private', 'finance')));
      await assertSucceeds(getDoc(doc(equipmentManagerUser().firestore(), 'equipment', 'item1', 'private', 'finance')));
      await assertSucceeds(getDoc(doc(superAdmin().firestore(), 'equipment', 'item1', 'private', 'finance')));
    });

    it('manager can create an item + finance subdoc; equipment user cannot create', async () => {
      await seedEquipment();
      const managerDb = equipmentManagerUser().firestore();
      await assertSucceeds(setDoc(doc(managerDb, 'equipment', 'item2'), {
        name: 'Mixer', category: 'Mixer', condition: 'good', currentLocation: null,
      }));
      await assertSucceeds(setDoc(doc(managerDb, 'equipment', 'item2', 'private', 'finance'), {
        purchaseCost: 900, purchaseDate: null,
      }));
      await assertFails(setDoc(doc(equipmentUser().firestore(), 'equipment', 'item3'), {
        name: 'Hack Item', condition: 'good',
      }));
    });

    it('manager can fully edit an item; equipment user cannot edit arbitrary fields', async () => {
      await seedEquipment();
      await assertSucceeds(updateDoc(doc(equipmentManagerUser().firestore(), 'equipment', 'item1'), {
        name: 'Main Projector (renamed)', condition: 'fair',
      }));
      await assertFails(updateDoc(doc(equipmentUser().firestore(), 'equipment', 'item1'), {
        name: 'Hacked',
      }));
    });

    it('equipment user CAN update only location fields (what completing a move writes)', async () => {
      await seedEquipment();
      await assertSucceeds(updateDoc(doc(equipmentUser().firestore(), 'equipment', 'item1'), {
        currentLocation: 'Nestpark', lastMovedAt: serverTimestamp(), lastMovedBy: 'user-uid', updatedAt: serverTimestamp(),
      }));
    });

    it('manager can delete an item; equipment user cannot', async () => {
      await seedEquipment();
      await assertFails(deleteDoc(doc(equipmentUser().firestore(), 'equipment', 'item1')));
      await assertSucceeds(deleteDoc(doc(equipmentManagerUser().firestore(), 'equipment', 'item1')));
    });

    it('access list is manager-only: equipment user cannot read or write it', async () => {
      await seedEquipment();
      const userDb = equipmentUser().firestore();
      await assertFails(getDoc(doc(userDb, 'equipmentAccess', 'users')));
      await assertFails(setDoc(doc(userDb, 'equipmentAccess', 'users'), { uids: ['user-uid', 'friend-uid'] }, { merge: true }));
      const managerDb = equipmentManagerUser().firestore();
      await assertSucceeds(getDoc(doc(managerDb, 'equipmentAccess', 'users')));
      await assertSucceeds(setDoc(doc(managerDb, 'equipmentAccess', 'users'), {
        uids: ['user-uid', 'new-uid'], names: { 'user-uid': 'Equipment User', 'new-uid': 'New Person' },
      }, { merge: true }));
    });

    it('equipment user can read and update moves; a non-listed member cannot read them', async () => {
      await seedEquipment();
      await assertFails(getDoc(doc(nonListedMember().firestore(), 'equipmentMoves', 'move1')));
      const userDb = equipmentUser().firestore();
      await assertSucceeds(getDoc(doc(userDb, 'equipmentMoves', 'move1')));
      await assertSucceeds(updateDoc(doc(userDb, 'equipmentMoves', 'move1'), {
        items: [{ equipmentId: 'item1', name: 'Main Projector', packed: true }],
      }));
    });

    it('equipment user can start a move; a non-listed member cannot', async () => {
      await seedEquipment();
      await assertSucceeds(setDoc(doc(equipmentUser().firestore(), 'equipmentMoves', 'move2'), {
        fromLocation: null, toLocation: 'Nestpark', scheduledFor: null, status: 'in-progress',
        items: [], createdBy: 'user-uid', createdByName: 'Equipment User', completedAt: null,
      }));
      await assertFails(setDoc(doc(nonListedMember().firestore(), 'equipmentMoves', 'move3'), {
        fromLocation: null, toLocation: 'Nestpark', scheduledFor: null, status: 'in-progress',
        items: [], createdBy: 'outsider-uid', createdByName: 'Outsider', completedAt: null,
      }));
    });

    it('move creator can delete their own move; a non-creator equipment user cannot', async () => {
      await seedEquipment({ moveCreatedBy: 'user-uid' });
      await assertSucceeds(deleteDoc(doc(equipmentUser().firestore(), 'equipmentMoves', 'move1')));

      await seedEquipment({ moveCreatedBy: 'someone-else' });
      await assertFails(deleteDoc(doc(equipmentUser().firestore(), 'equipmentMoves', 'move1')));
    });

    it('manager can delete a move they did not create', async () => {
      await seedEquipment({ moveCreatedBy: 'someone-else' });
      await assertSucceeds(deleteDoc(doc(equipmentManagerUser().firestore(), 'equipmentMoves', 'move1')));
    });
  });

  describe('Prayer collection', () => {
    it('member can submit a prayer request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'prayer', 'p1'), {
        uid: 'member-uid', body: 'Please pray for me', isAnonymous: false, isPrivate: false, approved: false, prayedFor: []
      }));
    });

    it('unauthenticated user cannot read prayer requests', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'member-uid', body: 'Prayer' });
      });
      const db = unauthUser().firestore();
      await assertFails(getDoc(doc(db, 'prayer', 'p1')));
    });

    it('member can read approved public prayer requests', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'other-uid', body: 'Prayer', isPrivate: false, approved: true });
      });
      const db = memberUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'prayer', 'p1')));
    });

    it('member cannot read unapproved prayer request from another member', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'other-uid', body: 'Prayer', isPrivate: false, approved: false });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'prayer', 'p1')));
    });

    it('member can read own unapproved prayer request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), { uid: 'member-uid', body: 'Prayer', isPrivate: false, approved: false });
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

    it('any member can toggle prayedFor on someone else\'s approved request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, approved: true, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'prayer', 'p1'), { prayedFor: ['member-uid'] }));
    });

    it('member cannot toggle prayedFor on an unapproved request', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, approved: false, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'prayer', 'p1'), { prayedFor: ['member-uid'] }));
    });

    it('member cannot piggyback other fields onto a prayedFor update', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'prayer', 'p1'), {
          uid: 'other-uid', body: 'Pray for me', isAnonymous: false, isPrivate: false, approved: true, prayedFor: [], status: 'active'
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'prayer', 'p1'), { prayedFor: ['member-uid'], status: 'answered' }));
    });

    it('member cannot create a prayer request spoofing another author', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'prayer', 'p1'), {
        uid: 'other-uid', body: 'Not mine', isAnonymous: false, isPrivate: false, approved: false, prayedFor: []
      }));
    });

    it('member cannot create a prayer request with approved:true', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'prayer', 'p1'), {
        uid: 'member-uid', body: 'Please pray for me', isAnonymous: false, isPrivate: false, approved: true, prayedFor: []
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

  describe('Event Registrations subcollection (Event Registration Phase B1)', () => {
    it('unauthenticated visitor cannot create a registration directly (function-only)', async () => {
      const db = unauthUser().firestore();
      await assertFails(setDoc(doc(db, 'events', 'e1', 'registrations', 'r1'), {
        firstName: 'Jane', lastName: 'Smith', submittedAt: new Date(),
      }));
    });

    it('member cannot create a registration directly (function-only)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'events', 'e1', 'registrations', 'r1'), {
        firstName: 'Jane', lastName: 'Smith', submittedAt: new Date(),
      }));
    });

    it('events.manage holder can read registrations', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), { firstName: 'Jane', lastName: 'Smith' });
      });
      const db = editorUser().firestore();
      await assertSucceeds(getDoc(doc(db, 'events', 'e1', 'registrations', 'r1')));
    });

    it('a plain member cannot read registrations', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), { firstName: 'Jane', lastName: 'Smith' });
      });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'events', 'e1', 'registrations', 'r1')));
    });

    it('events.manage holder can delete a registration (admin cleanup)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), { firstName: 'Jane', lastName: 'Smith' });
      });
      const db = editorUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'events', 'e1', 'registrations', 'r1')));
    });

    it('a plain member cannot delete a registration', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), { firstName: 'Jane', lastName: 'Smith' });
      });
      const db = memberUser().firestore();
      await assertFails(deleteDoc(doc(db, 'events', 'e1', 'registrations', 'r1')));
    });

    it('events.manage holder can toggle paymentConfirmed (Phase B3)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), {
          firstName: 'Jane', lastName: 'Smith', paymentConfirmed: false,
        });
      });
      const db = editorUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'events', 'e1', 'registrations', 'r1'), { paymentConfirmed: true }));
    });

    it('events.manage holder cannot change other fields via update (only paymentConfirmed)', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), {
          firstName: 'Jane', lastName: 'Smith', paymentConfirmed: false,
        });
      });
      const db = editorUser().firestore();
      await assertFails(updateDoc(doc(db, 'events', 'e1', 'registrations', 'r1'), { firstName: 'Hacked' }));
    });

    it('a plain member cannot toggle paymentConfirmed', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'events', 'e1', 'registrations', 'r1'), {
          firstName: 'Jane', lastName: 'Smith', paymentConfirmed: false,
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'events', 'e1', 'registrations', 'r1'), { paymentConfirmed: true }));
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

    it('member can post to an open group chat (chatMode: open)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid'], chatMode: 'open'
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['member-uid', 'leader-uid']
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        senderId: 'member-uid', body: 'Hello', sentAt: null
      }));
    });

    it('member cannot post to a leaders-only group chat', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid'], chatMode: 'leaders_only'
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['member-uid', 'leader-uid']
        });
      });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        senderId: 'member-uid', body: 'Hello', sentAt: null
      }));
    });

    it('leader can post to a leaders-only group chat', async () => {
      await seedUser('leader-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid'], chatMode: 'leaders_only'
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['member-uid', 'leader-uid']
        });
      });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(setDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        senderId: 'leader-uid', body: 'Announcement', sentAt: null
      }));
    });

    it('sender can edit their own message (body + editedAt only)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['member-uid', 'other-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'member-uid', body: 'Hello', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        body: 'Hello (edited)', editedAt: null
      }));
    });

    it('sender cannot edit fields other than body/editedAt', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'member-uid', body: 'Hello', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        body: 'Edited', senderId: 'hacked-uid'
      }));
    });

    it('non-sender cannot edit someone else message', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'other-uid', body: 'Hello', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        body: 'Tampered', editedAt: null
      }));
    });

    it('sender can delete their own message', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          participants: ['member-uid', 'other-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'member-uid', body: 'Hello', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(deleteDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1')));
    });

    it('group leader can delete any message in their group chat', async () => {
      await seedUser('leader-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['leader-uid', 'member-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'member-uid', body: 'Oops', sentAt: null
        });
      });
      const db = testEnv.authenticatedContext('leader-uid', {}).firestore();
      await assertSucceeds(deleteDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1')));
    });

    it('non-leader cannot delete someone else message', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['leader-uid', 'member-uid']
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1', 'messages', 'msg1'), {
          senderId: 'leader-uid', body: 'Hello', sentAt: null
        });
      });
      const db = memberUser().firestore();
      await assertFails(deleteDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1')));
    });

    it('group without chatMode field defaults to open (no regression)', async () => {
      await seedUser('member-uid', { membership: 'member' });
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'group1'), {
          name: 'Youth', leaders: ['leader-uid'], members: ['member-uid']
          // chatMode deliberately absent — legacy group
        });
        await setDoc(doc(ctx.firestore(), 'conversations', 'conv1'), {
          type: 'group', groupId: 'group1', participants: ['member-uid', 'leader-uid']
        });
      });
      const db = memberUser().firestore();
      await assertSucceeds(setDoc(doc(db, 'conversations', 'conv1', 'messages', 'msg1'), {
        senderId: 'member-uid', body: 'Hello', sentAt: null
      }));
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

    it('users.assign_roles holder cannot assign roles to themselves', async () => {
      await seedUser('assignroles-uid', { membership: 'member', roles: [], extraPermissions: [] });
      const db = assignRolesUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'assignroles-uid'), { roles: ['administrator'] }));
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

    it('users.approve holder cannot approve themselves', async () => {
      await seedUser('approve-uid', { membership: 'pending' });
      const db = approveOnlyUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'approve-uid'), { membership: 'member' }));
    });

    it('member cannot update their own roles via self-update', async () => {
      await seedUser('member-uid', { membership: 'member', roles: [], extraPermissions: [] });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'member-uid'), { roles: ['administrator'] }));
    });

    it('member cannot update their own membership via self-update', async () => {
      await seedUser('member-uid', { membership: 'pending', roles: [], extraPermissions: [] });
      const db = memberUser().firestore();
      await assertFails(updateDoc(doc(db, 'users', 'member-uid'), { membership: 'member' }));
    });

    it('member can update their own safe profile fields', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertSucceeds(updateDoc(doc(db, 'users', 'member-uid'), {
        displayName: 'New Name', phone: '0821234567', directoryVisible: false,
      }));
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

    it('superadmin can read and write the non-sensitive config/email doc', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      const db = superAdmin().firestore();
      await assertSucceeds(setDoc(doc(db, 'config', 'email'), { smtpHost: 'mail.egc.church', smtpPort: 465 }));
      await assertSucceeds(getDoc(doc(db, 'config', 'email')));
    });

    it('superadmin cannot read or write config/emailCredentials directly', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      const db = superAdmin().firestore();
      await assertFails(setDoc(doc(db, 'config', 'emailCredentials'), { smtpUser: 'hack@egc.church', smtpPassword: 'hack' }));
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'config', 'emailCredentials'), { smtpUser: 'communications@egc.church', smtpPassword: 'secret' });
      });
      await assertFails(getDoc(doc(db, 'config', 'emailCredentials')));
    });

    it('member cannot read or write config/emailCredentials', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(setDoc(doc(db, 'config', 'emailCredentials'), { smtpUser: 'hack@egc.church', smtpPassword: 'hack' }));
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'config', 'emailCredentials'), { smtpUser: 'communications@egc.church', smtpPassword: 'secret' });
      });
      await assertFails(getDoc(doc(db, 'config', 'emailCredentials')));
    });
  });

  describe('Site Media collection', () => {
    it('member cannot read or write siteMedia', async () => {
      await seedUser('member-uid', { membership: 'member' });
      const db = memberUser().firestore();
      await assertFails(getDoc(doc(db, 'siteMedia', 'file1')));
      await assertFails(setDoc(doc(db, 'siteMedia', 'file1'), { name: 'hack.pdf', url: 'https://example.com/hack.pdf' }));
    });

    it('servingTeams.manage holder (a non-superadmin permission) cannot read or write siteMedia', async () => {
      const db = servingTeamsManagerUser().firestore();
      await assertFails(getDoc(doc(db, 'siteMedia', 'file1')));
    });

    it('superadmin can read and write siteMedia', async () => {
      await seedUser('admin-uid', { membership: 'public', isSuperadmin: true, roles: [] });
      const db = superAdmin().firestore();
      await assertSucceeds(setDoc(doc(db, 'siteMedia', 'file1'), {
        name: 'sermon.pdf', url: 'https://storage.example.com/sermon.pdf', sizeBytes: 12345,
      }));
      await assertSucceeds(getDoc(doc(db, 'siteMedia', 'file1')));
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