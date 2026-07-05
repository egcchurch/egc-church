// functions/index.js
const functions = require('firebase-functions/v1');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

const { computeEffectiveClaims, permissionFieldsChanged } = require('./computePermissions');
const { DEFAULT_ROLES } = require('./rolesData');
const { Resend } = require('resend');

// functions.config() was removed in firebase-functions v7 — migrated to the
// params module. Set with `firebase functions:secrets:set YOUTUBE_APIKEY`
// and `firebase functions:secrets:set YOUTUBE_CHANNELID` (each prompts for
// the value interactively, so it never appears in shell history or logs).
const youtubeApiKey = defineSecret('YOUTUBE_APIKEY');
const youtubeChannelId = defineSecret('YOUTUBE_CHANNELID');

// SMSPortal (cottage meeting SMS confirmations — Phase 2). Set with:
//   firebase functions:secrets:set SMSPORTAL_CLIENT_ID
//   firebase functions:secrets:set SMSPORTAL_API_SECRET
// These MUST exist in Secret Manager before deploying registerForCottageMeeting
// (it lists them in runWith). If unset, SMS is silently skipped.
const smsPortalClientId = defineSecret('SMSPORTAL_CLIENT_ID');
const smsPortalApiSecret = defineSecret('SMSPORTAL_API_SECRET');

// Same migration for the Resend email alert in onNewConnectForm. This feature
// is not currently in use, so RESEND_APIKEY is a plain string param (default
// '') rather than a Secret Manager secret — that avoids the deploy needing a
// value that doesn't exist. If the church starts using Resend, switch this to
// `defineSecret('RESEND_APIKEY')` (set via `firebase functions:secrets:set`)
// and add it to onNewConnectForm's runWith({ secrets: [...] }) list.
// RESEND_FROM_EMAIL and CHURCH_DOMAIN keep the previous functions.config()
// fallback defaults — no setup needed unless overriding them.
const resendApiKey = defineString('RESEND_APIKEY', { default: '' });
const resendFromEmail = defineString('RESEND_FROM_EMAIL', { default: 'noreply@egc.church' });
const churchDomain = defineString('CHURCH_DOMAIN', { default: 'app.egc.church' });

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

    // Permissions live in the ID token, so a change only takes effect on the
    // user's next sign-in (or auto-refresh within ~1h). Nudge them in-app.
    // Skip on initial account creation (beforeData === null) — only fire when an
    // existing user's roles/permissions actually changed.
    if (beforeData !== null) {
      await db.collection('users').doc(uid).collection('notifications').add({
        title: 'Your access has been updated',
        body: 'Please sign out and back in for your new permissions to take effect. They will also refresh automatically within an hour.',
        type: 'access',
        linkUrl: null,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    }
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

// ── welcomeNewMember ──────────────────────────────────────────────────────────
// Triggered on any write to /users/{uid}.
// When membership is promoted to 'member' for the first time, writes a
// welcome in-app notification so the user sees it on their next visit.

exports.welcomeNewMember = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const after  = change.after.data();
    const before = change.before.exists ? change.before.data() : null;

    const wasMember = before && before.membership === 'member';
    const isMember  = after.membership === 'member';

    if (!wasMember && isMember) {
      const { uid } = context.params;
      await db.collection('users').doc(uid).collection('notifications').add({
        title: 'Welcome to the members area!',
        body: 'Your account has been approved. Explore the members area, join a group, or share a prayer request.',
        type: 'welcome',
        linkUrl: '/members/index.html',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      console.log(`welcomeNewMember: sent welcome notification to ${uid}`);
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

  // Notify all admins with users.approve permission:
  //   1. isSuperadmin === true
  //   2. 'users.approve' in extraPermissions (direct grant)
  //   3. roles array contains a role whose permissions includes 'users.approve'
  const displayName = userData.displayName || userData.email || 'A user';
  const notifPayload = {
    title: 'Membership Request',
    body: `${displayName} has requested member access.`,
    type: 'membership_request',
    linkUrl: '/admin/users.html',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
  };

  // Step 1: find role IDs that grant users.approve
  const rolesSnap = await db.collection('roles')
    .where('permissions', 'array-contains', 'users.approve')
    .get();
  const approveRoleIds = rolesSnap.docs.map(d => d.id);

  // Step 2: query all three approval paths in parallel
  const queries = [
    db.collection('users').where('isSuperadmin', '==', true).get(),
    db.collection('users').where('extraPermissions', 'array-contains', 'users.approve').get(),
  ];
  // Firestore array-contains-any supports up to 30 values
  if (approveRoleIds.length > 0) {
    queries.push(
      db.collection('users').where('roles', 'array-contains-any', approveRoleIds).get()
    );
  }

  const snaps = await Promise.all(queries);
  const adminUids = new Set(snaps.flatMap(s => s.docs.map(d => d.id)));
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
      notifyWhatsApp: false,
      prayerNotifications: true,
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

  // Collect FCM tokens (keep docRef so we can clean up invalid ones)
  const tokenSnaps = await Promise.all(docs.map(d => db.collection('users').doc(d.id).collection('fcmTokens').get()));
  const tokenEntries = []; // { token, ref }
  tokenSnaps.forEach(snap => snap.docs.forEach(d => { if (d.data().token) tokenEntries.push({ token: d.data().token, ref: d.ref }); }));

  if (!tokenEntries.length) return { sent: 0, inApp: docs.length };

  // Send FCM in batches of 500
  let sent = 0;
  for (let i = 0; i < tokenEntries.length; i += 500) {
    const chunk = tokenEntries.slice(i, i + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map(e => e.token),
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: '/assets/images/icons/icon-192.png', badge: '/assets/images/icons/icon-72.png', data: { linkUrl: '/' } },
        fcmOptions: { link: '/' },
      },
      data: { linkUrl: '/' },
    });
    sent += result.successCount;

    if (result.failureCount > 0) {
      const batch = db.batch();
      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            batch.delete(chunk[idx].ref);
          }
        }
      });
      await batch.commit().catch(e => console.warn('sendBroadcast token cleanup:', e));
    }
  }

  console.log(`Broadcast sent: ${sent} push, ${docs.length} in-app`);
  return { sent, inApp: docs.length };
});

// ── onNewPrayerRequest ────────────────────────────────────────────────────────
// Triggered when a prayer request is created.
// Notifies moderators/superadmins so they can review and approve.
// Member-facing notifications fire only after approval (see onPrayerRequestApproved).

exports.onNewPrayerRequest = functions.firestore
  .document('prayer/{requestId}')
  .onCreate(async (snap) => {
    const prayer = snap.data();
    const sentAt = admin.firestore.FieldValue.serverTimestamp();
    const authorLabel = prayer.isAnonymous ? 'Anonymous' : (prayer.authorName || 'a member');
    const title = `New prayer request from ${authorLabel} (pending approval)`;
    const body  = (prayer.body || '').substring(0, 120);

    // Notify moderators and superadmins
    const allSnap = await db.collection('users').get();
    const moderators = allSnap.docs.filter((d) => {
      const u = d.data();
      return u.isSuperadmin === true ||
             (Array.isArray(u.extraPermissions) && u.extraPermissions.includes('prayer.moderate')) ||
             (Array.isArray(u.roles) && u.roles.length > 0);
    });
    if (!moderators.length) return;

    const batch = db.batch();
    moderators.forEach((userDoc) => {
      const ref = db.collection('users').doc(userDoc.id).collection('notifications').doc();
      batch.set(ref, { title, body, type: 'prayer_pending', sentAt, read: false, linkUrl: '/admin/prayer.html' });
    });
    await batch.commit();
  });

// ── onPrayerRequestApproved ───────────────────────────────────────────────────
// Triggered when a prayer request is updated.
// When approved flips to true and the request is public, notify all members
// who have prayerNotifications enabled (default true).

exports.onPrayerRequestApproved = functions.firestore
  .document('prayer/{requestId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();

    // Only act when approved transitions false → true
    if (before.approved === true || after.approved !== true) return;
    // Private requests stay within the admin view — no member notification
    if (after.isPrivate === true) return;

    const sentAt = admin.firestore.FieldValue.serverTimestamp();
    const title  = after.isAnonymous ? 'New Prayer Request' : `Prayer request from ${after.authorName || 'a member'}`;
    const body   = (after.body || '').substring(0, 120);
    const link   = '/members/prayer.html';

    const usersSnap = await db.collection('users').where('membership', '==', 'member').get();
    if (usersSnap.empty) return;

    const docs = usersSnap.docs.filter((d) => {
      const u = d.data();
      return d.id !== after.uid && u.prayerNotifications !== false;
    });
    if (!docs.length) return;

    // Batch in chunks of 450 to stay under the 500-write limit
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach((userDoc) => {
        const ref = db.collection('users').doc(userDoc.id).collection('notifications').doc();
        batch.set(ref, { title, body, type: 'prayer', sentAt, read: false, linkUrl: link });
      });
      await batch.commit();
    }
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

    // Fetch config and users in parallel
    const [configSnap, allUsersSnap] = await Promise.all([
      db.doc('config/notifications').get(),
      db.collection('users').get(),
    ]);

    // ── Email alert ──────────────────────────────────────────────────────────
    const connectAlertEmail = configSnap.exists
      ? (configSnap.data().connectAlertEmail || null)
      : null;
    const apiKey = resendApiKey.value();

    if (connectAlertEmail && apiKey) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from:    `Connect Form <${resendFromEmail.value()}>`,
          to:      connectAlertEmail,
          subject: `New connect form submission from ${form.name || 'Visitor'}`,
          text: [
            'A visitor has submitted a connect form.',
            '',
            `Name:  ${form.name  || 'Not provided'}`,
            `Email: ${form.email || 'Not provided'}`,
            `Phone: ${form.phone || 'Not provided'}`,
            '',
            'Message:',
            form.message || '(no message)',
            '',
            `View submissions: https://${churchDomain.value()}/admin/connect.html`,
          ].join('\n'),
        });
      } catch (err) {
        console.error('onNewConnectForm: email alert failed:', err.message);
      }
    }

    // ── In-app notification to all admins ────────────────────────────────────
    const adminDocs = allUsersSnap.docs.filter((d) => {
      const u = d.data();
      return u.isSuperadmin === true ||
             (Array.isArray(u.roles) && u.roles.length > 0) ||
             (Array.isArray(u.extraPermissions) && u.extraPermissions.length > 0);
    });
    if (adminDocs.length === 0) return;

    const batch = db.batch();
    adminDocs.forEach((adminDoc) => {
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
    const tokenEntries = [];
    tokenSnaps.forEach(snap => snap.docs.forEach(d => { if (d.data().token) tokenEntries.push({ token: d.data().token, ref: d.ref }); }));

    if (tokenEntries.length) {
      for (let i = 0; i < tokenEntries.length; i += 500) {
        const chunk = tokenEntries.slice(i, i + 500);
        const result = await admin.messaging().sendEachForMulticast({
          tokens: chunk.map(e => e.token),
          notification: { title, body },
          webpush: {
            notification: { title, body, icon: '/assets/images/icons/icon-192.png', badge: '/assets/images/icons/icon-72.png', data: { linkUrl: '/members/' } },
            fcmOptions: { link: '/members/' },
          },
          data: { linkUrl: '/members/' },
        });

        if (result.failureCount > 0) {
          const batch = db.batch();
          result.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const code = resp.error?.code;
              if (code === 'messaging/registration-token-not-registered' ||
                  code === 'messaging/invalid-registration-token') {
                batch.delete(chunk[idx].ref);
              }
            }
          });
          await batch.commit().catch(e => console.warn('weeklyDigest token cleanup:', e));
        }
      }
    }

    console.log(`Weekly digest: ${docs.length} members, ${tokenEntries.length} push tokens`);
    return null;
  });

// ── onNewMessage ──────────────────────────────────────────────────────────────
// Triggered when a message is created in /conversations/{convId}/messages/{msgId}.
// Fans out FCM + in-app notifications to ALL participants except the sender.
// Supports group (type:'group') and team (type:'team') conversations.

exports.onNewMessage = functions.firestore
  .document('conversations/{convId}/messages/{msgId}')
  .onCreate(async (snap, context) => {
    const message  = snap.data();
    const { convId } = context.params;
    const senderId = message.senderId;

    if (!senderId) return;

    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return;

    const conv         = convSnap.data();
    const participants = conv.participants || [];
    const recipientIds = participants.filter(uid => uid !== senderId);
    if (!recipientIds.length) return;

    const senderSnap = await db.collection('users').doc(senderId).get();
    const senderName = senderSnap.data()?.displayName || 'Someone';

    // Include group/team name in the title for group conversations
    const groupName = conv.groupName || '';
    const title = groupName ? `${senderName} in ${groupName}` : `Message from ${senderName}`;
    const body  = (message.body || '').substring(0, 120);
    const link  = `/members/messages.html?conv=${convId}`;
    const sentAt = admin.firestore.FieldValue.serverTimestamp();

    // Write in-app notification to all recipients
    await Promise.all(recipientIds.map(uid =>
      db.collection('users').doc(uid).collection('notifications').add({
        title, body, type: 'message', sentAt, read: false, linkUrl: link,
      })
    ));

    // Collect FCM tokens from all recipients
    const tokenSnapshots = await Promise.all(
      recipientIds.map(uid => db.collection('users').doc(uid).collection('fcmTokens').get())
    );
    const allTokenDocs = tokenSnapshots.flatMap(s => s.docs.filter(d => d.data().token));
    if (!allTokenDocs.length) return;

    const result = await admin.messaging().sendEachForMulticast({
      tokens: allTokenDocs.map(d => d.data().token),
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: '/assets/images/icons/icon-192.png', badge: '/assets/images/icons/icon-72.png', data: { linkUrl: link } },
        fcmOptions: { link },
      },
      data: { linkUrl: link },
    });

    // Delete tokens FCM reports as invalid
    if (result.failureCount > 0) {
      const batch = db.batch();
      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            batch.delete(allTokenDocs[idx].ref);
          }
        }
      });
      await batch.commit().catch(e => console.warn('onNewMessage token cleanup:', e));
    }
  });

// ── purgeDirectMessages ───────────────────────────────────────────────────────
// One-time callable (superadmin only) — deletes all conversation docs that are
// NOT type:'group' or type:'team', including their /messages subcollections.
// Run once after deploying the group/team-only messaging redesign.

exports.purgeDirectMessages = functions.https.onCall(async (data, context) => {
  if (!context.auth?.token?.superadmin) {
    throw new functions.https.HttpsError('permission-denied', 'Superadmin only.');
  }

  const snap = await db.collection('conversations').get();
  const toDelete = snap.docs.filter(d => {
    const type = d.data().type;
    return type !== 'group' && type !== 'team';
  });

  let deleted = 0;
  for (const doc of toDelete) {
    await db.recursiveDelete(doc.ref);
    deleted++;
  }

  return { deleted, message: `Deleted ${deleted} direct message conversation(s).` };
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

// ── checkYoutubeLiveStatus ────────────────────────────────────────────────────
// Scheduled every 10 minutes (was 30 — a stream that started mid-window could
// go undetected for up to half an hour, which reads as "the site didn't
// update" to anyone checking during the service).
// Only calls the YouTube Data API during a service window: 30 minutes before
// a scheduled service through 3 hours after its start time. All other times
// the function exits immediately — zero API quota used outside service hours.
//
// Service windows are read dynamically from /homepage/content serviceTimes so
// they stay in sync with whatever the admin has configured.
//
// Requires the YOUTUBE_APIKEY and YOUTUBE_CHANNELID secrets (functions.config()
// was removed in firebase-functions v7):
//   firebase functions:secrets:set YOUTUBE_APIKEY
//   firebase functions:secrets:set YOUTUBE_CHANNELID
//
// search.list costs 100 quota units per call regardless of part. Polling is
// ~21 calls per service window (10-min ticks across 3.5 hours) — a two-service
// Sunday is ~4,200 units, still under the 10,000 units/day free quota.
//
// Skips Firestore write if live status hasn't changed.
// When a stream goes live, the title is taken from the YouTube video itself
// (search.list part=snippet) so it never shows a stale admin-set title from a
// previous stream (e.g. "Wednesday Prayermeeting" during a Sunday service).
// When the stream ends, title and youtubeId are preserved so the last stream
// stays referenced. Manual Set Live / End Stream on admin/homepage.html works
// as an override for one-off or unscheduled streams between ticks.

function parseTime12(timeStr) {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// search.list snippet titles come back HTML-escaped from the YouTube API
// (unlike videos.list) — decode the common entities so the frontend, which
// escapes on render, doesn't show literal "&amp;#39;".
function decodeYoutubeTitle(str) {
  return String(str || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isInServiceWindow(serviceTimes) {
  // South Africa Standard Time = UTC+2, no DST
  const sast = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today    = dayNames[sast.getUTCDay()];
  const nowMins  = sast.getUTCHours() * 60 + sast.getUTCMinutes();

  return (serviceTimes || []).some(st => {
    if ((st.day || '').toLowerCase() !== today.toLowerCase()) return false;
    const svcMins = parseTime12(st.time);
    if (svcMins === null) return false;
    // Window: 30 min before start → 3 hours (180 min) after start
    return nowMins >= svcMins - 30 && nowMins <= svcMins + 180;
  });
}

exports.checkYoutubeLiveStatus = functions
  .runWith({ secrets: [youtubeApiKey, youtubeChannelId] })
  .pubsub.schedule('every 10 minutes')
  .onRun(async () => {
    const apiKey    = youtubeApiKey.value();
    const channelId = youtubeChannelId.value();

    if (!apiKey || !channelId) {
      // Config not set — silent skip. Admin can use manual toggle instead.
      return null;
    }

    // Read service schedule and homepage state in one fetch
    const homepageRef  = db.doc('homepage/content');
    const homepageSnap = await homepageRef.get();
    const homepageData = homepageSnap.exists ? homepageSnap.data() : {};
    const serviceTimes = homepageData.serviceTimes || [];

    if (!isInServiceWindow(serviceTimes)) {
      console.log('checkYoutubeLiveStatus: outside service window, skipping');
      return null;
    }

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
      const resp = await fetch(url);
      const json = await resp.json();

      if (!resp.ok) {
        console.error('checkYoutubeLiveStatus: YouTube API error', json.error?.message || resp.status);
        return null;
      }

      const isLive    = Array.isArray(json.items) && json.items.length > 0;
      const youtubeId = isLive ? json.items[0].id.videoId : null;
      const current   = homepageData.liveStream || {};

      // Skip write if status unchanged
      if (current.active === isLive && (!isLive || current.youtubeId === youtubeId)) {
        return null;
      }

      await homepageRef.set({
        liveStream: {
          active:    isLive,
          title:     isLive
            ? (decodeYoutubeTitle(json.items[0].snippet?.title) || current.title || 'Live Service')
            : (current.title || ''),
          youtubeId: isLive ? youtubeId : (current.youtubeId || ''),
          startedAt: isLive && !current.active
            ? admin.firestore.FieldValue.serverTimestamp()
            : (current.startedAt || null),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'system',
        },
      }, { merge: true });

      console.log(`checkYoutubeLiveStatus: set active=${isLive}${isLive ? `, youtubeId=${youtubeId}` : ''}`);
    } catch (err) {
      console.error('checkYoutubeLiveStatus:', err.message);
    }

    return null;
  });

// ── fetchYouTubeVideos ─────────────────────────────────────────────────────────
// Callable — requires sermons.manage. Used by the "Import from YouTube" panel
// on admin/sermons.html to browse the church channel without exposing the
// YouTube API key to the browser.
//
// Reuses the same YOUTUBE_APIKEY / YOUTUBE_CHANNELID secrets as
// checkYoutubeLiveStatus (PR #112).
//
// data: { pageToken? } — one page of videos from the channel's uploads
// playlist (resolved via channels.list, 1 quota unit). playlistItems.list
// costs 1 unit/call regardless of maxResults.
//
// A "Monthly Playlist" browsing mode (playlists.list + playlistItems.list by
// playlistId) existed here briefly but wasn't useful in practice — removed.

async function youtubeApiGet(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, value);
  });
  const resp = await fetch(url.toString());
  const json = await resp.json();
  if (!resp.ok) {
    throw new functions.https.HttpsError('internal', json.error?.message || `YouTube API error (${resp.status})`);
  }
  return json;
}

function mapVideoItem(item) {
  const snippet = item.snippet || {};
  const thumbs = snippet.thumbnails || {};
  return {
    youtubeId: item.contentDetails?.videoId || snippet.resourceId?.videoId,
    title: snippet.title || '',
    publishedAt: item.contentDetails?.videoPublishedAt || snippet.publishedAt || null,
    thumbnail: thumbs.medium?.url || thumbs.default?.url || '',
  };
}

async function getUploadsPlaylistId(apiKey, channelId) {
  const json = await youtubeApiGet('channels', { part: 'contentDetails', id: channelId, key: apiKey });
  const uploadsId = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) {
    throw new functions.https.HttpsError('not-found', 'Could not resolve the channel uploads playlist.');
  }
  return uploadsId;
}

exports.fetchYouTubeVideos = functions
  .runWith({ secrets: [youtubeApiKey, youtubeChannelId] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const token = context.auth.token;
    if (token.superadmin !== true && !(Array.isArray(token.perms) && token.perms.includes('sermons.manage'))) {
      throw new functions.https.HttpsError('permission-denied', 'sermons.manage permission required.');
    }

    const apiKey = youtubeApiKey.value();
    const channelId = youtubeChannelId.value();
    if (!apiKey || !channelId) {
      throw new functions.https.HttpsError('failed-precondition', 'YouTube API key/channel ID not configured.');
    }

    const { pageToken } = data || {};
    const uploadsPlaylistId = await getUploadsPlaylistId(apiKey, channelId);

    const json = await youtubeApiGet('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
      key: apiKey,
    });

    return {
      videos: (json.items || []).map(mapVideoItem),
      nextPageToken: json.nextPageToken || null,
    };
  });

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

// ── Cottage Meetings (Phase 1) ──────────────────────────────────────────────
// Members register for a cottage meeting (limited seats, hosted at members'
// homes). Registration and cancellation run as transactions here — never from
// the client — so seats can't be oversold and a member can hold only one
// active registration at a time. Confirmation is delivered in-app + push
// (the primary channel); SMS/WhatsApp are planned later phases.

// Send a single-user in-app notification + FCM push (reuses the broadcast
// payload shape). Best-effort: push failures never block the caller.
async function sendUserNotification(uid, { title, body, type, linkUrl }) {
  const sentAt = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).collection('notifications').add({
    title, body, type: type || 'info', sentAt, read: false, linkUrl: linkUrl || null,
  });

  const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
  const tokenDocs = tokensSnap.docs.filter(d => d.data().token);
  if (!tokenDocs.length) return;

  const result = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map(d => d.data().token),
    notification: { title, body },
    webpush: {
      notification: { title, body, icon: '/assets/images/icons/icon-192.png', badge: '/assets/images/icons/icon-72.png', data: { linkUrl: linkUrl || '/' } },
      fcmOptions: { link: linkUrl || '/' },
    },
    data: { linkUrl: linkUrl || '/' },
  });

  if (result.failureCount > 0) {
    const batch = db.batch();
    result.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token') {
          batch.delete(tokenDocs[idx].ref);
        }
      }
    });
    await batch.commit().catch(e => console.warn('sendUserNotification token cleanup:', e));
  }
}

// ── sendServingSlotReminders ───────────────────────────────────────────────────
// Scheduled daily at 07:00 SAST (05:00 UTC).
// Queries all slots across every serving team for today's date.
// - Each assigned member gets a push + in-app reminder linking directly to their slot.
// - Each trainee (when trainingEnabled) gets the same.
// - Team leaders receive one aggregated push + in-app per team for any open slots,
//   rather than one notification per slot, to avoid alert fatigue.

function sastDateStr() {
  const sast = new Date(Date.now() + 2 * 60 * 60 * 1000); // UTC+2, no DST
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sast.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

exports.sendServingSlotReminders = functions.pubsub
  .schedule('0 5 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const today = sastDateStr();
    const slotsSnap = await db.collectionGroup('slots').where('date', '==', today).get();

    if (slotsSnap.empty) {
      console.log(`sendServingSlotReminders: no slots for ${today}`);
      return null;
    }

    // Fetch each team doc once
    const teamIds = new Set(slotsSnap.docs.map(d => d.ref.parent.parent.id));
    const teamDocs = {};
    await Promise.all([...teamIds].map(async (teamId) => {
      const doc = await db.collection('servingTeams').doc(teamId).get();
      if (doc.exists) teamDocs[teamId] = doc.data();
    }));

    const sends = [];
    // Aggregate open-slot counts per team for leader notifications
    const teamLeaderAlerts = {}; // teamId -> { teamName, leaders, openCount }

    slotsSnap.docs.forEach(doc => {
      const slot = doc.data();
      const slotId = doc.id;
      const teamId = doc.ref.parent.parent.id;
      const team = teamDocs[teamId];
      if (!team) return;

      const teamName = team.name || 'Serving Team';
      const fnLabel = (slot.functions || []).join(' + ') || 'your position';
      const slotUrl = `/members/serving-teams.html?team=${teamId}&slot=${slotId}`;

      if (slot.assignedUid) {
        sends.push(sendUserNotification(slot.assignedUid, {
          title: `Serving today — ${teamName}`,
          body: `You're on ${fnLabel}. Tap to view your slot or release if you can't make it.`,
          type: 'serving_reminder',
          linkUrl: slotUrl,
        }));
      }

      if (slot.trainingEnabled && slot.traineeUid) {
        sends.push(sendUserNotification(slot.traineeUid, {
          title: `Serving today — ${teamName}`,
          body: `You're the trainee for ${fnLabel}. Tap to view your slot or release if you can't make it.`,
          type: 'serving_reminder',
          linkUrl: slotUrl,
        }));
      }

      // Collect open main slots per team so leaders get one aggregated notification
      if (!slot.assignedUid && (team.leaders || []).length) {
        if (!teamLeaderAlerts[teamId]) {
          teamLeaderAlerts[teamId] = { teamName, leaders: team.leaders || [], openCount: 0 };
        }
        teamLeaderAlerts[teamId].openCount++;
      }
    });

    // One notification per leader per team with open slots
    for (const [teamId, info] of Object.entries(teamLeaderAlerts)) {
      const linkUrl = `/members/serving-teams.html?team=${teamId}`;
      const n = info.openCount;
      const body = `${n} slot${n !== 1 ? 's are' : ' is'} unassigned for today's service. Tap to view the roster.`;
      for (const leaderUid of info.leaders) {
        sends.push(sendUserNotification(leaderUid, {
          title: `${info.teamName} — open slot${n !== 1 ? 's' : ''} today`,
          body,
          type: 'serving_open',
          linkUrl,
        }));
      }
    }

    await Promise.allSettled(sends);
    console.log(`sendServingSlotReminders: ${slotsSnap.size} slots for ${today}, ${sends.length} sends queued`);
    return null;
  });

// ── pruneOldNotifications ─────────────────────────────────────────────────────
// Scheduled nightly at 02:00 SAST (00:00 UTC).
// Deletes in-app notifications older than 30 days across all users.

exports.pruneOldNotifications = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const snap = await db.collectionGroup('notifications')
      .where('sentAt', '<', cutoff)
      .get();

    if (snap.empty) {
      console.log('pruneOldNotifications: nothing to delete');
      return null;
    }

    // Batch delete in chunks of 450 (Firestore limit is 500)
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = db.batch();
      snap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    console.log(`pruneOldNotifications: deleted ${snap.docs.length} notifications`);
    return null;
  });

// ── onServingSlotReleased ─────────────────────────────────────────────────────
// Triggered when a serving slot is updated.
// When the assigned member releases their slot (assignedUid set → null),
// notifies all team leaders so they can arrange a replacement.

exports.onServingSlotReleased = functions.firestore
  .document('servingTeams/{teamId}/slots/{slotId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    const { teamId, slotId } = context.params;

    // Only fire when the lead position is released (not trainee releases)
    if (!before.assignedUid || after.assignedUid) return null;

    const releasedName = before.assignedName || 'A team member';
    const fnLabel = (after.functions || before.functions || []).join(' + ') || 'their slot';
    const date = after.date || before.date || '';
    let formattedDate = 'today';
    if (date) {
      try {
        formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-ZA', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
      } catch (_) { formattedDate = date; }
    }

    const teamDoc = await db.collection('servingTeams').doc(teamId).get();
    if (!teamDoc.exists) return null;
    const team = teamDoc.data();
    const leaders = team.leaders || [];
    if (!leaders.length) return null;

    const teamName = team.name || 'Serving Team';
    const linkUrl = `/members/serving-teams.html?team=${teamId}&slot=${slotId}`;

    await Promise.allSettled(leaders.map(leaderUid =>
      sendUserNotification(leaderUid, {
        title: `${teamName} — slot released`,
        body: `${releasedName} can't make it for ${fnLabel} on ${formattedDate}. The slot is now open.`,
        type: 'serving_released',
        linkUrl,
      })
    ));

    console.log(`onServingSlotReleased: notified ${leaders.length} leader(s) for team ${teamId}`);
    return null;
  });

// ── onGroupMemberAdded ────────────────────────────────────────────────────────
// Triggered when a /groups/{groupId} document is updated.
// When new UIDs appear in the members array, notifies each added member.
// Distinguishes between two paths:
//   - UID was in pendingMembers before → request was approved
//   - UID was not in pendingMembers    → leader added them directly (invite-only or otherwise)

exports.onGroupMemberAdded = functions.firestore
  .document('groups/{groupId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();

    const beforeMembers = new Set(before.members || []);
    const afterMembers  = new Set(after.members  || []);
    const beforePending = new Set(before.pendingMembers || []);

    const added = [...afterMembers].filter(uid => !beforeMembers.has(uid));
    if (!added.length) return null;

    const groupName = after.name || 'a group';

    await Promise.allSettled(added.map(uid => {
      const wasRequesting = beforePending.has(uid);
      return sendUserNotification(uid, {
        title: wasRequesting ? `You're in — ${groupName}` : `Added to ${groupName}`,
        body:  wasRequesting
          ? `Your request to join ${groupName} has been approved.`
          : `You've been added to ${groupName} by a group leader.`,
        type:    'group_added',
        linkUrl: '/members/groups.html',
      });
    }));

    console.log(`onGroupMemberAdded: notified ${added.length} new member(s) for group "${after.name}"`);
    return null;
  });

// Normalise a SA mobile number to international digits (no +): 0XXXXXXXXX -> 27XXXXXXXXX.
function normaliseSaNumber(raw) {
  const d = String(raw || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('27')) return d;
  if (d.startsWith('0')) return '27' + d.slice(1);
  return d;
}

// Send a single SMS via the SMSPortal REST API v3 (direct Basic-auth method).
// Best-effort: returns false and logs on any failure — never throws to the caller.
// No-op (returns false) when the SMSPORTAL_* secrets are not configured.
async function sendSms(destination, content) {
  let clientId = '';
  let apiSecret = '';
  try { clientId = smsPortalClientId.value(); apiSecret = smsPortalApiSecret.value(); } catch (_) { /* secret not bound */ }
  if (!clientId || !apiSecret) {
    console.log('sendSms: SMSPortal not configured — skipping SMS.');
    return false;
  }
  const dest = normaliseSaNumber(destination);
  if (!dest) return false;

  const auth = Buffer.from(`${clientId}:${apiSecret}`).toString('base64');
  try {
    const resp = await fetch('https://rest.smsportal.com/v3/BulkMessages', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ content, destination: dest }] }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('sendSms: SMSPortal returned', resp.status, txt.slice(0, 200));
      return false;
    }
    console.log(`sendSms: sent to ${dest}`);
    return true;
  } catch (err) {
    console.error('sendSms failed:', err.message);
    return false;
  }
}

exports.registerForCottageMeeting = functions
  .runWith({ secrets: [smsPortalClientId, smsPortalApiSecret] })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = context.auth.uid;
  const meetingId = (data && data.meetingId ? String(data.meetingId) : '').trim();
  const partySize = parseInt(data && data.partySize, 10);
  const providedPhone = (data && data.phone ? String(data.phone) : '').trim();
  const smsOptIn = !!(data && data.sms === true);

  if (!meetingId) {
    throw new functions.https.HttpsError('invalid-argument', 'meetingId is required.');
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    throw new functions.https.HttpsError('invalid-argument', 'Party size must be between 1 and 50.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? userSnap.data() : null;
  if (!user || user.membership !== 'member') {
    throw new functions.https.HttpsError('permission-denied', 'Cottage meetings are for approved members.');
  }

  // The member's saved profile number is authoritative; a number is only typed
  // in at registration when the profile has none.
  const effectivePhone = providedPhone || user.phone || '';

  const meetingRef = db.collection('cottageMeetings').doc(meetingId);
  const regRef = db.collection('cottageRegistrations').doc(uid);

  const result = await db.runTransaction(async (t) => {
    const meetingSnap = await t.get(meetingRef);
    if (!meetingSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'That cottage meeting no longer exists.');
    }
    const meeting = meetingSnap.data();
    if (meeting.open === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Registration for this meeting is closed.');
    }

    const regSnap = await t.get(regRef);
    const existing = regSnap.exists ? regSnap.data() : null;

    // One active registration per member.
    if (existing && existing.meetingId !== meetingId) {
      throw new functions.https.HttpsError('failed-precondition',
        'You are already registered for another cottage meeting. Please cancel that one first.');
    }

    const capacity = meeting.capacity || 0;
    const seatsTaken = meeting.seatsTaken || 0;
    const prevParty = (existing && existing.meetingId === meetingId) ? (existing.partySize || 0) : 0;
    const newSeatsTaken = seatsTaken - prevParty + partySize;
    if (capacity > 0 && newSeatsTaken > capacity) {
      const left = Math.max(capacity - (seatsTaken - prevParty), 0);
      throw new functions.https.HttpsError('resource-exhausted',
        `Not enough seats — only ${left} left for this meeting.`);
    }

    t.set(regRef, {
      uid,
      meetingId,
      regionId: meeting.regionId || null,
      name: user.displayName || user.email || 'Member',
      phone: effectivePhone || null,
      smsRequested: smsOptIn,
      email: user.email || null,
      partySize,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    t.update(meetingRef, { seatsTaken: newSeatsTaken });
    return { meeting, newSeatsTaken, capacity };
  });

  const m = result.meeting;
  const when = [m.date, m.time].filter(Boolean).join(' at ');
  const venue = (m.address || 'to be confirmed').replace(/\s*\n\s*/g, ', ');
  const lines = [
    `You're registered (${partySize} attending) for ${m.title || m.regionName || 'your cottage meeting'}${when ? ' on ' + when : ''}.`,
    `Venue: ${venue}.`,
  ];
  if (m.mapsLink) lines.push(`Map: ${m.mapsLink}`);
  if (m.contactName || m.contactNumber) {
    lines.push(`Contact: ${[m.contactName, m.contactNumber].filter(Boolean).join(' ')}`);
  }
  await sendUserNotification(uid, {
    title: 'Cottage Meeting — Registration Confirmed',
    body: lines.join(' '),
    type: 'cottage',
    linkUrl: '/members/cottage.html',
  });

  // Back-fill the member's profile number when it was empty, so they only ever
  // type it once (and it becomes available to the directory/future features).
  if (!user.phone && providedPhone) {
    await db.collection('users').doc(uid)
      .update({ phone: providedPhone, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      .catch(e => console.warn('cottage profile phone back-fill failed:', e.message));
  }

  // SMS confirmation (Phase 2) — only when the member opted in and a number is
  // available. Best-effort; no-op if SMSPortal isn't configured.
  if (smsOptIn && effectivePhone) {
    // Newline-separated for SMS readability (in-app/push stay space-joined).
    await sendSms(effectivePhone, `EGC Cottage Meeting\n\n${lines.join('\n')}`);
  }

  return { success: true, seatsTaken: result.newSeatsTaken, capacity: result.capacity };
});

exports.cancelCottageRegistration = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = context.auth.uid;
  const regRef = db.collection('cottageRegistrations').doc(uid);

  const removed = await db.runTransaction(async (t) => {
    const regSnap = await t.get(regRef);
    if (!regSnap.exists) return null;
    const reg = regSnap.data();

    if (reg.meetingId) {
      const meetingRef = db.collection('cottageMeetings').doc(reg.meetingId);
      const meetingSnap = await t.get(meetingRef);
      if (meetingSnap.exists) {
        const seatsTaken = meetingSnap.data().seatsTaken || 0;
        t.update(meetingRef, { seatsTaken: Math.max(0, seatsTaken - (reg.partySize || 0)) });
      }
    }
    t.delete(regRef);
    return reg;
  });

  if (removed) {
    await sendUserNotification(uid, {
      title: 'Cottage Meeting — Registration Cancelled',
      body: 'Your cottage meeting registration has been cancelled and your seats released.',
      type: 'cottage',
      linkUrl: '/members/cottage.html',
    });
  }
  return { success: true, cancelled: !!removed };
});

// ── scanOrphanedMedia ───────────────────────────────────────────────────────────
// Callable, superadmin only — used by the Media Library tab on /admin/media.html.
// Walks every file in the Storage bucket and cross-references it against every
// Firestore collection that stores a media URL. Files that exist in Storage but
// aren't referenced anywhere are returned as "orphaned" candidates for cleanup.
// Profile photos (users/{uid}/photo) are always excluded, even if genuinely
// orphaned — this tool is for site content, not personal data.
function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

exports.scanOrphanedMedia = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  if (context.auth.token.superadmin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Superadmin required.');
  }

  const inUse = new Set();
  const addUrl = (url) => {
    const path = storagePathFromUrl(url);
    if (path) inUse.add(path);
  };

  const [siteMediaSnap, gallerySnap, musicSnap, sermonsSnap, seriesSnap,
         eventsSnap, blogSnap, teamSnap, brandingDoc, usersSnap] = await Promise.all([
    db.collection('siteMedia').get(),
    db.collection('gallery').get(),
    db.collection('music').get(),
    db.collection('sermons').get(),
    db.collection('series').get(),
    db.collection('events').get(),
    db.collection('blog').get(),
    db.collection('team').get(),
    db.collection('config').doc('branding').get(),
    db.collection('users').get(),
  ]);

  siteMediaSnap.forEach(doc => addUrl(doc.data().url));
  gallerySnap.forEach(doc => {
    const d = doc.data();
    (d.imageUrls || []).forEach(addUrl);
    addUrl(d.thumbnailUrl);
  });
  musicSnap.forEach(doc => {
    const d = doc.data();
    addUrl(d.audioUrl);
    addUrl(d.coverArtUrl);
  });
  sermonsSnap.forEach(doc => {
    const d = doc.data();
    addUrl(d.audioUrl);
    (d.materials || []).forEach(m => addUrl(m.url));
  });
  seriesSnap.forEach(doc => addUrl(doc.data().imageUrl));
  eventsSnap.forEach(doc => addUrl(doc.data().imageUrl));
  blogSnap.forEach(doc => {
    const d = doc.data();
    addUrl(d.imageUrl);
    (d.galleryUrls || []).forEach(addUrl);
    (d.videos || []).forEach(v => { addUrl(v.url); addUrl(v.thumbnail); });
  });
  teamSnap.forEach(doc => addUrl(doc.data().photoUrl));
  if (brandingDoc.exists) addUrl(brandingDoc.data().logoUrl);
  usersSnap.forEach(doc => addUrl(doc.data().photoURL));

  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles();

  const orphans = [];
  for (const file of files) {
    if (file.name.startsWith('users/')) continue; // never surface personal photos here
    if (inUse.has(file.name)) continue;
    orphans.push({
      path: file.name,
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`,
      sizeBytes: Number(file.metadata.size) || 0,
      contentType: file.metadata.contentType || null,
      updatedAt: file.metadata.updated || null,
    });
  }

  console.log(`scanOrphanedMedia: ${orphans.length} orphaned files out of ${files.length} scanned`);
  return { orphans, totalScanned: files.length };
});
