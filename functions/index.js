// functions/index.js
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

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
      adminRole: null,
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

  const callerSnap = await db.collection('users').doc(context.auth.uid).get();
  const caller = callerSnap.data() || {};
  if (!['editor', 'superadmin'].includes(caller.adminRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin role required.');
  }

  const { title, body, type = 'broadcast', audience = 'all' } = data;
  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'title and body are required.');
  }

  const sentAt = admin.firestore.FieldValue.serverTimestamp();

  // Write global notification log
  await db.collection('notifications').add({ title, body, type, audience, sentBy: context.auth.uid, sentAt });

  // Query users matching audience
  let usersQuery = db.collection('users');
  if (audience === 'members') {
    usersQuery = usersQuery.where('membership', '==', 'member');
  } else if (audience === 'admins') {
    usersQuery = usersQuery.where('adminRole', 'in', ['editor', 'superadmin']);
  } else {
    usersQuery = usersQuery.where('membership', 'in', ['member', 'public']);
  }

  const usersSnap = await usersQuery.get();
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

    let usersQuery = isPrivate
      ? db.collection('users').where('adminRole', 'in', ['editor', 'superadmin'])
      : db.collection('users').where('membership', '==', 'member');

    const usersSnap = await usersQuery.get();
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

    const adminsSnap = await db.collection('users')
      .where('adminRole', 'in', ['editor', 'superadmin'])
      .get();

    if (adminsSnap.empty) return;

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
    });
  });