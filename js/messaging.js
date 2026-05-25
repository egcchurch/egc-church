// js/messaging.js
// Direct messaging — conversation list + real-time message thread.
// Loaded by members/messages.html. Requires Firebase auth + Firestore.

(function () {
  let currentUser   = null;
  let currentConvId = null;
  let unsubMessages = null;
  let unsubConvs    = null;

  // ── Entry point ──────────────────────────────────────────────────────────────

  function waitForFirebase(cb) {
    if (typeof firebase !== 'undefined' && typeof auth !== 'undefined') { cb(); }
    else { setTimeout(() => waitForFirebase(cb), 50); }
  }

  waitForFirebase(() => {
    auth.onAuthStateChanged((user) => {
      if (!user) { window.location.href = '/login.html'; return; }
      currentUser = user;
      loadConversations();
      checkURLParam();
    });
  });

  // If URL has ?conv=<id>, open that conversation immediately
  function checkURLParam() {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    if (convId) openConversation(convId);
  }

  // ── Conversation list ────────────────────────────────────────────────────────

  function loadConversations() {
    const convList = document.getElementById('conv-list');
    if (!convList) return;

    if (unsubConvs) { unsubConvs(); unsubConvs = null; }

    unsubConvs = firebase.firestore()
      .collection('conversations')
      .where('participants', 'array-contains', currentUser.uid)
      .orderBy('lastMessageAt', 'desc')
      .onSnapshot((snap) => {
        if (snap.empty) {
          convList.innerHTML = `
            <div class="p-6 text-center text-sm text-gray-400">
              <i class="fas fa-comment-slash text-2xl mb-2 block"></i>
              No conversations yet.<br>Start one by clicking a member below.
            </div>`;
          return;
        }

        convList.innerHTML = snap.docs.map(d => {
          const c   = d.data();
          const uid = d.id;
          const other = (c.participants || []).find(p => p !== currentUser.uid) || '';
          const unread = (c.unreadBy || []).includes(currentUser.uid);
          const time  = c.lastMessageAt?.toDate
            ? relativeTime(c.lastMessageAt.toDate())
            : '';

          return `
            <button class="conv-item w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-amber-50 transition-colors border-b border-zinc-50 last:border-0
                           ${currentConvId === uid ? 'bg-amber-50' : ''}
                           ${unread ? 'bg-amber-50' : ''}"
                    data-id="${uid}" data-other="${esc(other)}">
              <div class="w-9 h-9 rounded-full bg-[#0A3D62] text-white text-sm font-bold flex items-center justify-center shrink-0 uppercase">
                ${esc(c.otherName ? c.otherName[0] : '?')}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline gap-1">
                  <p class="text-sm font-semibold text-gray-800 truncate">${esc(c.otherName || other)}</p>
                  <span class="text-[10px] text-gray-400 shrink-0">${time}</span>
                </div>
                <p class="text-xs text-gray-500 truncate mt-0.5">${esc(c.lastMessage || '')}</p>
              </div>
              ${unread ? '<span class="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>' : ''}
            </button>`;
        }).join('');

        convList.querySelectorAll('.conv-item').forEach(el => {
          el.addEventListener('click', () => {
            openConversation(el.dataset.id);
          });
        });
      }, err => console.warn('Conversation list error:', err));
  }

  // ── Open a conversation ──────────────────────────────────────────────────────

  function openConversation(convId) {
    currentConvId = convId;

    // Highlight in list
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('bg-amber-50', el.dataset.id === convId);
    });

    // Show thread panel, hide empty state
    document.getElementById('thread-panel')?.classList.remove('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');

    // Mark as read
    firebase.firestore().collection('conversations').doc(convId).update({
      unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
    }).catch(() => {});

    // Load messages
    loadMessages(convId);
  }

  function loadMessages(convId) {
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }

    const feed = document.getElementById('msg-feed');
    if (!feed) return;

    unsubMessages = firebase.firestore()
      .collection('conversations').doc(convId)
      .collection('messages')
      .orderBy('sentAt', 'asc')
      .onSnapshot((snap) => {
        if (snap.empty) {
          feed.innerHTML = '<p class="text-xs text-gray-400 text-center py-8">No messages yet. Say hello!</p>';
          return;
        }

        feed.innerHTML = snap.docs.map(d => {
          const m    = d.data();
          const mine = m.senderId === currentUser.uid;
          const time = m.sentAt?.toDate
            ? m.sentAt.toDate().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
            : '';

          return `
            <div class="flex ${mine ? 'justify-end' : 'justify-start'} mb-2">
              <div class="max-w-[75%]">
                <div class="px-3.5 py-2 rounded-2xl text-sm leading-relaxed
                            ${mine
                              ? 'bg-[#0A3D62] text-white rounded-br-sm'
                              : 'bg-white border border-zinc-200 text-gray-800 rounded-bl-sm'}">
                  ${esc(m.body || '')}
                </div>
                <p class="text-[10px] text-gray-400 mt-0.5 ${mine ? 'text-right' : 'text-left'}">${time}</p>
              </div>
            </div>`;
        }).join('');

        // Scroll to bottom
        feed.scrollTop = feed.scrollHeight;
      }, err => console.warn('Message feed error:', err));
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  function bindSendForm() {
    const form  = document.getElementById('send-form');
    const input = document.getElementById('msg-input');
    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body || !currentConvId) return;

      input.value = '';
      input.disabled = true;

      try {
        const convRef = firebase.firestore().collection('conversations').doc(currentConvId);
        const convSnap = await convRef.get();
        const conv = convSnap.data() || {};
        const participants = conv.participants || [];
        const recipientId = participants.find(uid => uid !== currentUser.uid);

        // Add message
        await convRef.collection('messages').add({
          senderId: currentUser.uid,
          body,
          sentAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Update conversation summary
        await convRef.update({
          lastMessage: body,
          lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
          unreadBy: recipientId
            ? firebase.firestore.FieldValue.arrayUnion(recipientId)
            : firebase.firestore.FieldValue.arrayRemove(),
        });
      } catch (err) {
        console.error('Send failed:', err);
        input.value = body; // restore on error
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
  }

  // ── New conversation ─────────────────────────────────────────────────────────

  function bindNewConv() {
    const btn   = document.getElementById('new-conv-btn');
    const modal = document.getElementById('new-conv-modal');
    const close = document.getElementById('close-modal');
    const form  = document.getElementById('new-conv-form');
    const list  = document.getElementById('member-picker');
    if (!btn || !modal) return;

    btn.addEventListener('click', async () => {
      modal.classList.remove('hidden');
      list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Loading members…</p>';

      const snap = await firebase.firestore()
        .collection('users')
        .where('membership', '==', 'member')
        .where('directoryVisible', '==', true)
        .get();

      const others = snap.docs.filter(d => d.id !== currentUser.uid);

      if (!others.length) {
        list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No other members found.</p>';
        return;
      }

      list.innerHTML = others.map(d => {
        const u = d.data();
        return `
          <button type="button" class="member-pick w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-50 transition-colors"
                  data-uid="${d.id}" data-name="${esc(u.displayName || d.id)}">
            <div class="w-8 h-8 rounded-full bg-[#0A3D62] text-white text-xs font-bold flex items-center justify-center uppercase shrink-0">
              ${esc(u.displayName?.[0] || '?')}
            </div>
            <span class="text-sm font-medium text-gray-800">${esc(u.displayName || d.id)}</span>
          </button>`;
      }).join('');

      list.querySelectorAll('.member-pick').forEach(el => {
        el.addEventListener('click', () => startConversation(el.dataset.uid, el.dataset.name));
      });
    });

    close?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  }

  async function startConversation(otherUid, otherName) {
    const modal = document.getElementById('new-conv-modal');

    // Check if a conversation between these two users already exists
    const existingSnap = await firebase.firestore()
      .collection('conversations')
      .where('participants', 'array-contains', currentUser.uid)
      .get();

    const existing = existingSnap.docs.find(d => {
      const p = d.data().participants || [];
      return p.includes(otherUid);
    });

    let convId;
    if (existing) {
      convId = existing.id;
    } else {
      // Create conversation
      const meSnap = await firebase.firestore().collection('users').doc(currentUser.uid).get();
      const myName = meSnap.data()?.displayName || 'Member';

      const convRef = await firebase.firestore().collection('conversations').add({
        participants: [currentUser.uid, otherUid],
        myName,
        otherName,
        lastMessage: '',
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        unreadBy: [],
      });
      convId = convRef.id;
    }

    modal?.classList.add('hidden');
    openConversation(convId);
  }

  // ── Init when nav is ready ───────────────────────────────────────────────────

  document.addEventListener('nav-loaded', () => {
    bindSendForm();
    bindNewConv();
  });

  // ── Utility ──────────────────────────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function relativeTime(date) {
    const diff = Date.now() - date.getTime();
    if (diff < 60000)    return 'Just now';
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
})();
