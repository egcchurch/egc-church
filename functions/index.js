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
