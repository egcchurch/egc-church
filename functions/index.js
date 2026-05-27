// functions/index.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

const { computeEffectiveClaims, permissionFieldsChanged } = require('./computePermissions');
const { DEFAULT_ROLES } = require('./rolesData');

// ── syncUserClaims ────────────────────────────────────────────────────────────
// Triggered on any write to /users/{uid}.
// Recomputes effective permissions from roles + extraPermissions and writes
// them to Firebase Auth custom claims so security rules can use them without
// an extra Firestore read on every request.
// Skips the write if none of the permission-relevant fields changed.

exports.syncUserClaims = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const { uid } = context.params;

    // Doc deleted — clear claims (Auth account may already be gone; ignore that error)
    if (!change.after.exists) {
      try {
        await admin.auth().setCustomUserClaims(uid, null);
      } catch (e) {
        console.warn(`syncUserClaims: could not clear claims for ${uid}:`, e.message);
      }
      return null;
    }

    const afterData  = change.after.data() || {};
    const beforeData = change.before.exists ? (change.before.data() || {}) : null;

    if (!permissionFieldsChanged(beforeData, afterData)) {
      console.log(`syncUserClaims: no permission change for ${uid}, skipping`);
      return null;
    }

    const isSuperadmin     = afterData.isSuperadmin === true;
    const roleIds          = afterData.roles || [];
    const extraPermissions = afterData.extraPermissions || [];

    // Fetch all assigned role documents in parallel
    const roleSnaps = await Promise.all(
      roleIds.map((id) => db.collection('roles').doc(id).get())
    );
    const roleDocs = roleSnaps.filter((s) => s.exists).map((s) => s.data());

    const claims = computeEffectiveClaims(isSuperadmin, roleDocs, extraPermissions);
    await admin.auth().setCustomUserClaims(uid, claims);

    console.log(`syncUserClaims: set claims for ${uid}:`, JSON.stringify(claims));
    return null;
  });

// ── syncUserNotificationEligibility ──────────────────────────────────────────
// Triggered on any write to /users/{uid}.
// When membership changes away from 'member', deletes all FCM tokens so the
// user stops receiving push notifications immediately.
// The inverse (member promotion) is handled client-side — the next sign-in
// after approval calls registerFCMToken() and registers a fresh token.

exports.syncUserNotificationEligibility = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null; // deleteUserAccount handles token cleanup on full deletion

    const after  = change.after.data();
    const before = change.before.exists ? change.before.data() : null;

    const wasMember = before && before.membership === 'member';
    const isMember  = after.membership === 'member';

    if (wasMember && !isMember) {
      const { uid } = context.params;
      const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
      if (!tokensSnap.empty) {
        const batch = db.batch();
        tokensSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`syncUserNotificationEligibility: deleted ${tokensSnap.size} FCM tokens for ${uid}`);
      }
    }
    return null;
  });

// ── cleanupNonMemberTokens ────────────────────────────────────────────────────
// Callable — superadmin only. One-time migration for Phase 7 PR 6.
// Iterates all users and deletes fcmTokens subcollections for any user whose
// membership is not 'member'. Run on staging then prod after deploying this PR.

exports.cleanupNonMemberTokens = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  if (context.auth.token.superadmin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Superadmin required.');
  }

  const usersSnap = await db.collection('users').get();
  let tokensDeleted = 0;
  let usersProcessed = 0;

  for (const userDoc of usersSnap.docs) {
    if (userDoc.data().membership !== 'member') {
      const tokensSnap = await db.collection('users').doc(userDoc.id).collection('fcmTokens').get();
      if (!tokensSnap.empty) {
        const batch = db.batch();
        tokensSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        tokensDeleted  += tokensSnap.size;
        usersProcessed += 1;
      }
    }
  }

  console.log(`cleanupNonMemberTokens: ${tokensDeleted} tokens deleted across ${usersProcessed} non-member users`);
  return { tokensDeleted, usersProcessed };
});

// ── requestMemberAccess ───────────────────────────────────────────────────────
// Callable — any authenticated user with membership === 'public'.
// Writes membershipRequestedAt to the user's doc (idempotent: 24h cooldown).
// Writes an in-app notification to all users with users.approve permission.

exports.requestMemberAccess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = context.auth.uid;

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User record not found.');
  }
  const userData = userDoc.data();

  if (userData.membership !== 'public') {
    throw new functions.https.HttpsError('failed-precondition', 'Only public users may request member access.');
  }

  // 24h idempotency — ignore if a request was already sent within the last 24 hours
  if (userData.membershipRequestedAt) {
    const requestedMs = userData.membershipRequestedAt.toDate().getTime();
    if (Date.now() - requestedMs < 24 * 60 * 60 * 1000) {
      return { success: true, alreadyRequested: true };
    }
  }

  await db.collection('users').doc(uid).update({
    membershipRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Notify all admins with users.approve permission (superadmins + extraPermissions holders)
  const displayName = userData.displayName || userData.email || 'A user';
  const notifPayload = {
    title: 'Membership Request',
    body: `${displayName} has requested member access.`,
    type: 'membership_request',
    linkUrl: '/admin/users.html',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
  };

  const [superadminSnap, extraPermSnap] = await Promise.all([
    db.collection('users').where('isSuperadmin', '==', true).get(),
    db.collection('users').where('extraPermissions', 'array-contains', 'users.approve').get(),
  ]);

  const adminUids = new Set([
    ...superadminSnap.docs.map(d => d.id),
    ...extraPermSnap.docs.map(d => d.id),
  ]);
  adminUids.delete(uid); // don't notify the requester

  const batch = db.batch();
  adminUids.forEach(adminUid => {
    const ref = db.collection('users').doc(adminUid).collection('notifications').doc();
    batch.set(ref, notifPayload);
  });
  await batch.commit();

  return { success: true, alreadyRequested: false };
});

// ── onUserCreate ──────────────────────────────────────────────────────────────
// Triggered when a new user registers via Firebase Auth.
// Auto-provisions a /users/{uid} document with default membership = 'pending'.

exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL, emailVerified } = user;

  try {
    await db.collection('users').doc(uid).set({
      uid,
      email,
      displayName: displayName || '',
      photoURL: photoURL || '',
      emailVerified: emailVerified || false,
      membership: 'pending',
      isSuperadmin: false,
      roles: [],
      extraPermissions: [],
      phone: '',
      directoryVisible: true,
      directoryShowEmail: false,
      directoryShowPhone: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`User doc created for ${email} (${uid})`);
  } catch (err) {
    console.error(`Failed to create user doc for ${uid}:`, err);
  }
});

// ── sendBroadcast ─────────────────────────────────────────────────────────────
// Callable from /admin/notifications.html.
// Fans out FCM push + writes in-app notifications to all matching users.

exports.sendBroadcast = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const token = context.auth.token;
  if (token.superadmin !== true && !(Array.isArray(token.perms) && token.perms.includes('notifications.send'))) {
    throw new functions.https.HttpsError('permission-denied', 'notifications.send permission required.');
  }

  const { title, body, type = 'broadcast', audience = 'all' } = data;
  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'title and body are required.');
  }

  const sentAt = admin.firestore.FieldValue.serverTimestamp();

  // Write global notification log
  await db.collection('notifications').add({ title, body, type, audience, sentBy: context.auth.uid, sentAt });

  // Query users matching audience
  let usersSnap;
  if (audience === 'members') {
    usersSnap = await db.collection('users').where('membership', '==', 'member').get();
  } else if (audience === 'admins') {
    // Fetch all users and filter those with any admin capability (isSuperadmin, roles, or extraPermissions).
    const allSnap = await db.collection('users').get();
    const adminDocs = allSnap.docs.filter((d) => {
      const u = d.data();
      return u.isSuperadmin === true ||
             (Array.isArray(u.roles) && u.roles.length > 0) ||
             (Array.isArray(u.extraPermissions) && u.extraPermissions.length > 0);
    });
    usersSnap = { docs: adminDocs, empty: adminDocs.length === 0 };
  } else {
    usersSnap = await db.collection('users').where('membership', 'in', ['member', 'public']).get();
  }

  if (usersSnap.empty) return { sent: 0, inApp: 0 };

  // Write in-app notifications (batched — max 500 ops per batch)
  const BATCH_SIZE = 400;
  const docs = usersSnap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((userDoc) => {
      const ref = db.collection('users').doc(userDoc.id).collection('notifications').doc();
      batch.set(ref, { title, body, type, sentAt, read: false, linkUrl: null });
    });
    await batch.commit();
  }

  // Collect FCM tokens
  const tokenSnaps = await Promise.all(docs.map(d => db.collection('users').doc(d.id).collection('fcmTokens').get()));
  const tokens = [];
  tokenSnaps.forEach(snap => snap.docs.forEach(d => { if (d.data().token) tokens.push(d.data().token); }));

  if (!tokens.length) return { sent: 0, inApp: docs.length };

  // Send FCM in batches of 500
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: { notification: { icon: '/assets/images/icons/icon-192.png' } },
    });
    sent += result.successCount;
  }

  console.log(`Broadcast sent: ${sent} push, ${docs.length} in-app`);
  return { sent, inApp: docs.length };
});

// ── onNewPrayerRequest ────────────────────────────────────────────────────────
// Triggered when a prayer request is created.
// Private → notify admins only.  Public → notify all members.

exports.onNewPrayerRequest = functions.firestore
  .document('prayer/{requestId}')
  .onCreate(async (snap) => {
    const prayer = snap.data();
    const sentAt = admin.firestore.FieldValue.serverTimestamp();
    const isPrivate = prayer.isPrivate === true;

    const title = prayer.isAnonymous ? 'New Prayer Request' : `Prayer request from ${prayer.authorName || 'a member'}`;
    const body  = (prayer.body || '').substring(0, 120);
    const link  = isPrivate ? '/admin/prayer.html' : '/members/prayer.html';

    let usersSnap;
    if (isPrivate) {
      const allSnap = await db.collection('users').get();
      const adminDocs = allSnap.docs.filter((d) => {
        const u = d.data();
        return u.isSuperadmin === true ||
               (Array.isArray(u.roles) && u.roles.length > 0) ||
               (Array.isArray(u.extraPermissions) && u.extraPermissions.length > 0);
      });
      usersSnap = { docs: adminDocs, empty: adminDocs.length === 0 };
    } else {
      usersSnap = await db.collection('users').where('membership', '==', 'member').get();
    }
    if (usersSnap.empty) return;

    const batch = db.batch();
    usersSnap.docs.forEach((userDoc) => {
      const ref = db.collection('users').doc(userDoc.id).collection('notifications').doc();
      batch.set(ref, { title, body, type: 'prayer', sentAt, read: false, linkUrl: link });
    });
    await batch.commit();
  });

// ── onNewConnectForm ──────────────────────────────────────────────────────────
// Triggered when a visitor submits a connect form.
// Writes an in-app notification to all editors and superadmins.

exports.onNewConnectForm = functions.firestore
  .document('connect/{submissionId}')
  .onCreate(async (snap) => {
    const form = snap.data();
    const sentAt = admin.firestore.FieldValue.serverTimestamp();

    const title = 'New Connect Form Submission';
    const body  = `From ${form.name || 'Visitor'}: ${(form.message || '').substring(0, 100)}`;

    const allUsersSnap = await db.collection('users').get();
    const adminDocs = allUsersSnap.docs.filter((d) => {
      const u = d.data();
      return u.isSuperadmin === true ||
             (Array.isArray(u.roles) && u.roles.length > 0) ||
             (Array.isArray(u.extraPermissions) && u.extraPermissions.length > 0);
    });
    if (adminDocs.length === 0) return;
    const adminsSnap = { docs: adminDocs };

    const batch = db.batch();
    adminsSnap.docs.forEach((adminDoc) => {
      const ref = db.collection('users').doc(adminDoc.id).collection('notifications').doc();
      batch.set(ref, { title, body, type: 'connect', sentAt, read: false, linkUrl: '/admin/connect.html' });
    });
    await batch.commit();
  });

// ── weeklyDigest ──────────────────────────────────────────────────────────────
// Runs every Sunday at 09:00 SAST.
// Sends a weekly summary push + in-app notification to all members.

exports.weeklyDigest = functions.pubsub
  .schedule('every sunday 09:00')
  .timeZone('Africa/Johannesburg')
  .onRun(async () => {
    const now    = admin.firestore.Timestamp.now();
    const sentAt = admin.firestore.FieldValue.serverTimestamp();

    const [sermonsSnap, eventsSnap] = await Promise.all([
      db.collection('sermons').where('published', '==', true).orderBy('createdAt', 'desc').limit(2).get(),
      db.collection('events').where('published', '==', true).where('startDate', '>=', now).orderBy('startDate').limit(2).get(),
    ]);

    const sermonSummary = sermonsSnap.docs.map(d => d.data().title).join(' · ') || 'See latest sermons';
    const eventSummary  = eventsSnap.docs.map(d => d.data().title).join(' · ')  || 'Check upcoming events';

    const title = 'Weekly Digest — EGC';
    const body  = `Sermons: ${sermonSummary}. Upcoming: ${eventSummary}`;

    const membersSnap = await db.collection('users').where('membership', '==', 'member').get();
    if (membersSnap.empty) return null;

    // In-app notifications
    const BATCH_SIZE = 400;
    const docs = membersSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      docs.slice(i, i + BATCH_SIZE).forEach((memberDoc) => {
        const ref = db.collection('users').doc(memberDoc.id).collection('notifications').doc();
        batch.set(ref, { title, body, type: 'digest', sentAt, read: false, linkUrl: '/members/index.html' });
      });
      await batch.commit();
    }

    // FCM push
    const tokenSnaps = await Promise.all(docs.map(d => db.collection('users').doc(d.id).collection('fcmTokens').get()));
    const tokens = [];
    tokenSnaps.forEach(snap => snap.docs.forEach(d => { if (d.data().token) tokens.push(d.data().token); }));

    if (tokens.length) {
      for (let i = 0; i < tokens.length; i += 500) {
        await admin.messaging().sendEachForMulticast({
          tokens: tokens.slice(i, i + 500),
          notification: { title, body },
          webpush: { notification: { icon: '/assets/images/icons/icon-192.png' } },
        });
      }
    }

    console.log(`Weekly digest: ${docs.length} members, ${tokens.length} push tokens`);
    return null;
  });

// ── onNewMessage ──────────────────────────────────────────────────────────────
// Triggered when a message is created in /conversations/{convId}/messages/{msgId}.
// Pushes an FCM notification + in-app notification to the recipient.

exports.onNewMessage = functions.firestore
  .document('conversations/{convId}/messages/{msgId}')
  .onCreate(async (snap, context) => {
    const message  = snap.data();
    const { convId } = context.params;
    const senderId = message.senderId;

    if (!senderId) return;

    // Get conversation to find the recipient
    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return;

    const participants = convSnap.data().participants || [];
    const recipientId  = participants.find(uid => uid !== senderId);
    if (!recipientId) return;

    // Get sender display name
    const senderSnap = await db.collection('users').doc(senderId).get();
    const senderName = senderSnap.data()?.displayName || 'Someone';

    const title = `Message from ${senderName}`;
    const body  = (message.body || '').substring(0, 120);
    const link  = `/members/messages.html?conv=${convId}`;
    const sentAt = admin.firestore.FieldValue.serverTimestamp();

    // Write in-app notification
    await db.collection('users').doc(recipientId).collection('notifications').add({
      title, body, type: 'direct', sentAt, read: false, linkUrl: link,
    });

    // FCM push to recipient's tokens
    const tokensSnap = await db.collection('users').doc(recipientId).collection('fcmTokens').get();
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (!tokens.length) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { notification: { icon: '/assets/images/icons/icon-192.png' } },
      data: { linkUrl: link },
    });
  });

// ── deleteUserAccount ─────────────────────────────────────────────────────────
// Callable from /profile.html.
// Performs GDPR-compliant account deletion:
//   - removes personal data (auth account, user doc, subcollections, photo)
//   - anonymises authored content (prayer requests, gallery entries)
//   - removes user from group member lists

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = context.auth.uid;

  try {
    const bucket = admin.storage().bucket();

    // 1. Delete profile photo — best-effort, no error if absent
    await bucket.file(`users/${uid}/photo`).delete().catch(() => {});

    // 2. Delete FCM tokens subcollection
    const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
    if (!tokensSnap.empty) {
      const batch = db.batch();
      tokensSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Delete notifications subcollection (batched for large counts)
    const notifsSnap = await db.collection('users').doc(uid).collection('notifications').get();
    if (!notifsSnap.empty) {
      const CHUNK = 400;
      for (let i = 0; i < notifsSnap.docs.length; i += CHUNK) {
        const batch = db.batch();
        notifsSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 4. Anonymise prayer requests authored by this user
    const prayerSnap = await db.collection('prayer').where('uid', '==', uid).get();
    if (!prayerSnap.empty) {
      const batch = db.batch();
      prayerSnap.docs.forEach(d => batch.update(d.ref, { uid: 'deleted-user', authorName: 'Deleted User' }));
      await batch.commit();
    }

    // 5. Anonymise gallery entries created by this user
    const gallerySnap = await db.collection('gallery').where('createdBy', '==', uid).get();
    if (!gallerySnap.empty) {
      const batch = db.batch();
      gallerySnap.docs.forEach(d => batch.update(d.ref, { createdBy: 'deleted-user' }));
      await batch.commit();
    }

    // 6. Remove user from group member/leader/pending lists
    const groupsSnap = await db.collection('groups').where('members', 'array-contains', uid).get();
    if (!groupsSnap.empty) {
      const batch = db.batch();
      groupsSnap.docs.forEach(d => batch.update(d.ref, {
        members:        admin.firestore.FieldValue.arrayRemove(uid),
        pendingMembers: admin.firestore.FieldValue.arrayRemove(uid),
        leaders:        admin.firestore.FieldValue.arrayRemove(uid),
      }));
      await batch.commit();
    }

    // 7. Delete /users/{uid} document
    await db.collection('users').doc(uid).delete();

    // 8. Delete Firebase Auth account (must be last — invalidates context.auth.uid)
    await admin.auth().deleteUser(uid);

    console.log(`Account deleted: ${uid}`);
    return { success: true };

  } catch (err) {
    console.error(`Failed to delete account for ${uid}:`, err);
    throw new functions.https.HttpsError('internal', 'Account deletion failed. Please try again.');
  }
});

// ── podcastFeed ───────────────────────────────────────────────────────────────
// HTTP function — routed from /feed.xml via firebase.json rewrites.
// Returns a valid RSS 2.0 / iTunes podcast feed of published sermons with audio.

exports.podcastFeed = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Single equality filter avoids composite index requirement; sort client-side.
    const snap = await db.collection('sermons')
      .where('published', '==', true)
      .get();

    const sermons = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(s => s.audioUrl && s.audioUrl.trim())
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 100);

    const items = sermons.map(s => {
      const pubDate   = toRFC822(s.date);
      const duration  = s.duration || '';
      const speaker   = s.speaker  || 'Emmanuel Gospel Centre';
      const desc      = [speaker, duration].filter(Boolean).join(' | ');
      return `
    <item>
      <title>${xmlEsc(s.title || '')}</title>
      <guid isPermaLink="false">${xmlEsc(s.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEsc(desc)}</description>
      <enclosure url="${xmlEsc(s.audioUrl)}" length="0" type="audio/mpeg"/>
      <itunes:title>${xmlEsc(s.title || '')}</itunes:title>
      <itunes:author>${xmlEsc(speaker)}</itunes:author>
      <itunes:duration>${xmlEsc(duration)}</itunes:duration>
      <itunes:summary>${xmlEsc(desc)}</itunes:summary>
    </item>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Emmanuel Gospel Centre Sermons</title>
    <link>https://app.egc.church/sermons.html</link>
    <language>en</language>
    <description>Sermon recordings from Emmanuel Gospel Centre (EGC).</description>
    <itunes:author>Emmanuel Gospel Centre</itunes:author>
    <itunes:image href="https://app.egc.church/assets/images/icons/icon-512.png"/>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(xml);

  } catch (err) {
    console.error('podcastFeed error:', err);
    res.status(500).send('Internal server error');
  }
});

function xmlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRFC822(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date().toUTCString().replace('GMT', '+0000');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 8, 0, 0))
    .toUTCString()
    .replace('GMT', '+0000');
}

// ── migrateRolesV1 ────────────────────────────────────────────────────────────
// Callable — superadmin only. One-time migration for Phase 6.
//
// Step 1: Seed /roles if the collection is empty.
// Step 2: For every user doc that does not yet have the Phase 6 permission
//         fields (isSuperadmin, roles, extraPermissions), set them based on
//         the legacy adminRole value:
//           "superadmin" → isSuperadmin: true,  roles: []
//           "editor"     → isSuperadmin: false, roles: ["content_editor"]
//           null / other → isSuperadmin: false, roles: []
//
// Each user write triggers syncUserClaims automatically.
// Idempotent: skips users that already have all three fields.

exports.migrateRolesV1 = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  if (context.auth.token.superadmin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Superadmin required.');
  }

  const { FieldPath, FieldValue } = admin.firestore;
  const BATCH_SIZE = 100;
  let rolesSeeded = 0;
  let usersUpdated = 0;
  const errors = [];

  // Step 1: seed /roles if empty
  const existingRoles = await db.collection('roles').limit(1).get();
  if (existingRoles.empty) {
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    for (const role of DEFAULT_ROLES) {
      const { id, ...fields } = role;
      batch.set(db.collection('roles').doc(id), { ...fields, createdAt: now, updatedAt: now });
    }
    await batch.commit();
    rolesSeeded = DEFAULT_ROLES.length;
    console.log(`migrateRolesV1: seeded ${rolesSeeded} roles`);
  } else {
    console.log('migrateRolesV1: roles collection already populated, skipping seed');
  }

  // Step 2: migrate user docs in cursor-paginated batches of 100
  let lastDoc = null;

  while (true) {
    let query = db.collection('users').orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const u = doc.data();

      // Skip users already migrated (all three permission fields present)
      if ('isSuperadmin' in u && Array.isArray(u.roles) && Array.isArray(u.extraPermissions)) {
        continue;
      }

      let update;
      if (u.adminRole === 'superadmin') {
        update = { isSuperadmin: true,  roles: [],                  extraPermissions: [] };
      } else if (u.adminRole === 'editor') {
        update = { isSuperadmin: false, roles: ['content_editor'],  extraPermissions: [] };
      } else {
        update = { isSuperadmin: false, roles: [],                  extraPermissions: [] };
      }

      batch.update(doc.ref, { ...update, updatedAt: FieldValue.serverTimestamp() });
      batchCount++;
    }

    if (batchCount > 0) {
      try {
        await batch.commit();
        usersUpdated += batchCount;
      } catch (err) {
        console.error('migrateRolesV1: batch commit failed:', err.message);
        errors.push(err.message);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(`migrateRolesV1: complete — ${usersUpdated} users updated, ${rolesSeeded} roles seeded`);
  return { usersUpdated, rolesSeeded, errors };
});
