// functions/seedRoles.js
// Seeds the /roles collection with the 7 default Phase 6 roles.
// Run once on an empty roles collection — aborts if any roles already exist.
//
// Usage (from the functions/ directory):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node seedRoles.js
//
// Get your service account key from:
//   Firebase Console → Project settings → Service accounts → Generate new private key
//
// Against the local emulator instead:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seedRoles.js

'use strict';

const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const ALL_PERMISSIONS = [
  'sermons.manage',
  'events.manage',
  'blog.manage',
  'team.manage',
  'gallery.manage',
  'music.manage',
  'devotional.manage',
  'groups.manage',
  'homepage.manage',
  'notifications.send',
  'prayer.moderate',
  'connect.view',
  'users.approve',
  'users.assign_roles',
];

const DEFAULT_ROLES = [
  {
    id: 'administrator',
    displayName: 'Administrator',
    description: 'Full access to all admin sections (equivalent to the old editor role)',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    id: 'pastor',
    displayName: 'Pastor',
    description: 'Sermons, devotionals, events, blog, and notifications',
    permissions: ['sermons.manage', 'devotional.manage', 'events.manage', 'blog.manage', 'notifications.send'],
    isSystem: true,
  },
  {
    id: 'deacon',
    displayName: 'Deacon',
    description: 'Approves members, moderates prayer requests, views connect form submissions',
    permissions: ['users.approve', 'prayer.moderate', 'connect.view'],
    isSystem: true,
  },
  {
    id: 'media_helper',
    displayName: 'Media Helper',
    description: 'Manages sermons, music library, and photo galleries',
    permissions: ['sermons.manage', 'music.manage', 'gallery.manage'],
    isSystem: true,
  },
  {
    id: 'communications',
    displayName: 'Communications',
    description: 'Blog, homepage content, notifications, and events',
    permissions: ['blog.manage', 'homepage.manage', 'notifications.send', 'events.manage'],
    isSystem: true,
  },
  {
    id: 'prayer_lead',
    displayName: 'Prayer Team Lead',
    description: 'Moderates prayer requests and sends notifications',
    permissions: ['prayer.moderate', 'notifications.send'],
    isSystem: true,
  },
  {
    id: 'content_editor',
    displayName: 'Content Editor',
    description: 'All content management permissions — migration target for existing editor users',
    permissions: [
      'sermons.manage', 'events.manage', 'blog.manage', 'team.manage',
      'gallery.manage', 'music.manage', 'devotional.manage', 'groups.manage',
      'homepage.manage',
    ],
    isSystem: true,
  },
];

async function seed() {
  const existing = await db.collection('roles').limit(1).get();
  if (!existing.empty) {
    console.error('Roles collection already contains documents. Aborting to avoid overwrite.');
    console.error('Delete the /roles collection in Firestore first if you want to re-seed.');
    process.exit(1);
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const role of DEFAULT_ROLES) {
    const { id, ...fields } = role;
    batch.set(db.collection('roles').doc(id), { ...fields, createdAt: now, updatedAt: now });
  }

  await batch.commit();
  console.log(`Seeded ${DEFAULT_ROLES.length} roles:`);
  DEFAULT_ROLES.forEach((r) => console.log(`  ${r.id} — ${r.displayName}`));
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
