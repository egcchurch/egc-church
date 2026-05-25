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
const { DEFAULT_ROLES } = require('./rolesData');

admin.initializeApp();
const db = admin.firestore();

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
