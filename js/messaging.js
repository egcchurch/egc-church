// js/messaging.js
// Group and team messaging — conversation list + real-time message thread.
// Loaded by members/messages.html. Requires Firebase auth + Firestore.

(function () {
  let currentUser    = null;
  let currentConvId  = null;
  let currentConvData  = null;
  let currentGroupData = null;
  let unsubMessages  = null;
  let unsubConvs     = null;
  let pendingConvId  = null;
  let editingMsgId   = null; // message currently being edited (blocks snapshot re-render)
  let msgBodyCache   = {};   // msgId → raw body string, refreshed on each snapshot
  let msgMineCache   = {};   // msgId → boolean (did current user send it)

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

  // If URL has ?conv=<id>, defer opening until the conv-list has rendered so
  // the thread title and active-item highlight are both correct.
  function checkURLParam() {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    if (convId) pendingConvId = convId;
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
              <i class="fas fa-comments text-2xl mb-2 block"></i>
              No chats yet.<br>Join a group or serving team to start chatting.
            </div>`;
          return;
        }

        convList.innerHTML = snap.docs.map(d => {
          const c      = d.data();
          const uid    = d.id;
          const isGroup = c.type === 'group' || c.type === 'team';
          const other   = (c.participants || []).find(p => p !== currentUser.uid) || '';
          const displayName = isGroup ? (c.groupName || 'Group') : (c.otherName || other);
          const unread = (c.unreadBy || []).includes(currentUser.uid);
          const time   = c.lastMessageAt?.toDate
            ? relativeTime(c.lastMessageAt.toDate())
            : '';

          const avatarIcon = isGroup
            ? `<i class="fas fa-${c.type === 'team' ? 'user-friends' : 'users'} text-xs"></i>`
            : esc(displayName ? displayName[0] : '?');
          const avatarBg = isGroup ? 'bg-indigo-600' : 'bg-[#0A3D62]';

          return `
            <button class="conv-item w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-amber-50 transition-colors border-b border-zinc-50 last:border-0
                           ${currentConvId === uid ? 'bg-amber-50' : ''}
                           ${unread ? 'bg-amber-50' : ''}"
                    data-id="${uid}" data-other="${esc(other)}" data-name="${esc(displayName)}" data-group="${isGroup ? '1' : '0'}">
              <div class="w-9 h-9 rounded-full ${avatarBg} text-white text-sm font-bold flex items-center justify-center shrink-0 uppercase">
                ${avatarIcon}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline gap-1">
                  <p class="text-sm font-semibold text-gray-800 truncate">${esc(displayName)}</p>
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

        // Open the conversation from ?conv= URL param now that the list is ready
        if (pendingConvId) {
          const id = pendingConvId;
          pendingConvId = null;
          openConversation(id);
        }
      }, err => console.warn('Conversation list error:', err));
  }

  // ── Open a conversation ──────────────────────────────────────────────────────

  async function openConversation(convId) {
    currentConvId    = convId;
    currentGroupData = null;
    editingMsgId     = null;
    msgBodyCache     = {};
    msgMineCache     = {};
    // Cache conversation metadata for group chat sender name display
    try {
      const snap = await firebase.firestore().collection('conversations').doc(convId).get();
      currentConvData = snap.exists ? snap.data() : null;
    } catch (_) {
      currentConvData = null;
    }
    // For group conversations, fetch the group doc so we can enforce chatMode
    if (currentConvData?.type === 'group' && currentConvData?.groupId) {
      try {
        const gSnap = await firebase.firestore().collection('groups').doc(currentConvData.groupId).get();
        currentGroupData = gSnap.exists ? gSnap.data() : null;
      } catch (_) {
        currentGroupData = null;
      }
    }

    // Highlight in list
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('bg-amber-50', el.dataset.id === convId);
    });

    // Show thread panel, hide empty state
    document.getElementById('thread-panel')?.classList.remove('hidden');
    document.getElementById('empty-state')?.classList.add('hidden');

    // Mobile: swap panels via custom CSS classes (plain <style> block, no Tailwind).
    if (window.innerWidth < 768) {
      document.getElementById('conv-panel')?.classList.add('mobile-hidden');
      document.getElementById('thread-wrapper')?.classList.add('mobile-active');
    }

    // Set mobile back-bar title
    const titleEl = document.getElementById('thread-title');
    if (titleEl) {
      const item = document.querySelector(`.conv-item[data-id="${convId}"]`);
      titleEl.textContent = item?.dataset.name || '';
    }

    // Mark as read
    firebase.firestore().collection('conversations').doc(convId).update({
      unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
    }).catch(() => {});

    // Show/hide compose box based on group chatMode
    updateComposeBox();

    // Load messages
    loadMessages(convId);
  }

  // Show the send form for leaders/open chats; replace with a notice for
  // members in a leaders_only group chat.
  function updateComposeBox() {
    const composeArea = document.getElementById('send-form')?.parentElement;
    if (!composeArea) return;

    const isLeadersOnly = currentGroupData?.chatMode === 'leaders_only';
    const isLeader = isLeadersOnly &&
      (currentGroupData?.leaders || []).includes(currentUser?.uid);

    // Remove any existing read-only notice
    const existing = document.getElementById('chat-readonly-notice');
    if (existing) existing.remove();

    if (isLeadersOnly && !isLeader) {
      document.getElementById('send-form').style.display = 'none';
      const notice = document.createElement('p');
      notice.id = 'chat-readonly-notice';
      notice.style.cssText = 'text-align:center;font-size:0.75rem;color:#a1a1aa;padding:0.75rem 1rem;';
      notice.textContent = 'Only group leaders can post in this channel.';
      composeArea.appendChild(notice);
    } else {
      document.getElementById('send-form').style.display = '';
    }
  }

  function loadMessages(convId) {
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }

    const feed = document.getElementById('msg-feed');
    if (!feed) return;

    feed.onclick = handleFeedClick;

    unsubMessages = firebase.firestore()
      .collection('conversations').doc(convId)
      .collection('messages')
      .orderBy('sentAt', 'asc')
      .onSnapshot((snap) => {
        // Don't clobber an active inline edit — the save/cancel will clear editingMsgId
        // and the next snapshot (triggered by the Firestore write) will re-render cleanly.
        if (editingMsgId) return;

        if (snap.empty) {
          feed.innerHTML = '<p class="text-xs text-gray-400 text-center py-8">No messages yet. Say hello!</p>';
          msgBodyCache = {};
          msgMineCache = {};
          return;
        }

        const isGroup  = currentConvData?.type === 'group' || currentConvData?.type === 'team';
        const isLeader = (currentGroupData?.leaders || []).includes(currentUser?.uid);

        // Refresh per-message caches used by startEdit / cancelEdit
        snap.docs.forEach(d => {
          msgBodyCache[d.id] = d.data().body || '';
          msgMineCache[d.id] = d.data().senderId === currentUser?.uid;
        });

        feed.innerHTML = snap.docs.map(d => {
          const m    = d.data();
          const mine = m.senderId === currentUser.uid;
          const time = m.sentAt?.toDate
            ? m.sentAt.toDate().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
            : '';

          const senderLabel = isGroup && !mine && m.senderName
            ? `<p class="text-[10px] font-semibold text-indigo-600 mb-0.5 pl-1">${esc(m.senderName)}</p>`
            : '';
          const avatarHtml  = isGroup && !mine
            ? `<div class="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 self-end mb-4 uppercase">
                 ${esc((m.senderName || '?')[0])}
               </div>`
            : '';

          const canEdit   = mine;
          const canDelete = mine || isLeader;
          const actionBtns = (canEdit || canDelete) ? `
            <span class="msg-acts" style="display:inline-flex;gap:2px;opacity:0;transition:opacity 0.15s;vertical-align:middle;margin-left:4px;">
              ${canEdit   ? `<button data-action="edit"   data-msg-id="${d.id}" style="background:none;border:none;cursor:pointer;color:#a1a1aa;padding:0 3px;font-size:11px;" title="Edit message"><i class="fas fa-pencil-alt"></i></button>` : ''}
              ${canDelete ? `<button data-action="delete" data-msg-id="${d.id}" style="background:none;border:none;cursor:pointer;color:#a1a1aa;padding:0 3px;font-size:11px;" title="Delete message"><i class="fas fa-trash-alt"></i></button>` : ''}
            </span>` : '';

          return `
            <div data-msg-id="${d.id}" data-mine="${mine ? '1' : '0'}"
                 class="flex ${mine ? 'justify-end' : 'justify-start'} items-end gap-1.5 mb-2"
                 onmouseenter="this.querySelector('.msg-acts')&&(this.querySelector('.msg-acts').style.opacity='1')"
                 onmouseleave="this.querySelector('.msg-acts')&&(this.querySelector('.msg-acts').style.opacity='0')">
              ${avatarHtml}
              <div class="max-w-[75%]">
                ${senderLabel}
                <div data-msg-body class="px-3.5 py-2 rounded-2xl text-sm leading-relaxed
                            ${mine
                              ? 'bg-[#0A3D62] text-white rounded-br-sm'
                              : 'bg-white border border-zinc-200 text-gray-800 rounded-bl-sm'}">
                  ${esc(m.body || '')}
                </div>
                <p class="text-[10px] text-gray-400 mt-0.5 ${mine ? 'text-right' : 'text-left'}">
                  ${time}${m.editedAt ? ' · edited' : ''}${actionBtns}
                </p>
              </div>
            </div>`;
        }).join('');

        feed.scrollTop = feed.scrollHeight;
      }, err => console.warn('Message feed error:', err));
  }

  // ── Message actions (edit / delete) ─────────────────────────────────────────

  function handleFeedClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, msgId } = btn.dataset;
    if (action === 'edit')   startEdit(msgId);
    if (action === 'delete') deleteMessage(btn, msgId);
  }

  function startEdit(msgId) {
    if (editingMsgId) cancelEdit(editingMsgId);
    editingMsgId = msgId;

    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!wrapper) return;
    const bodyEl = wrapper.querySelector('[data-msg-body]');
    if (!bodyEl) return;

    const body = msgBodyCache[msgId] || '';

    const editWrap = document.createElement('div');
    editWrap.innerHTML = `
      <textarea id="edit-ta-${msgId}"
                maxlength="2000"
                style="width:100%;padding:8px 12px;border-radius:12px;border:2px solid #f59e0b;font-size:14px;line-height:1.5;resize:none;outline:none;box-sizing:border-box;min-height:52px;color:#111827;background:#fff;">${esc(body)}</textarea>
      <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end;">
        <button data-edit-cancel style="font-size:12px;padding:4px 12px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;cursor:pointer;color:#52525b;">Cancel</button>
        <button data-edit-save  style="font-size:12px;padding:4px 12px;border-radius:999px;background:#f59e0b;border:none;cursor:pointer;color:#fff;font-weight:600;">Save</button>
      </div>`;

    bodyEl.replaceWith(editWrap);

    const ta = editWrap.querySelector('textarea');
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;

    editWrap.querySelector('[data-edit-save]').addEventListener('click', () => {
      const newBody = ta.value.trim();
      if (newBody) saveEdit(msgId, newBody); else cancelEdit(msgId);
    });
    editWrap.querySelector('[data-edit-cancel]').addEventListener('click', () => cancelEdit(msgId));
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const newBody = ta.value.trim();
        if (newBody) saveEdit(msgId, newBody);
      }
      if (e.key === 'Escape') cancelEdit(msgId);
    });
  }

  function cancelEdit(msgId) {
    editingMsgId = null;
    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!wrapper) return;
    const editWrap = wrapper.querySelector(`#edit-ta-${msgId}`)?.closest('div');
    if (!editWrap) return;

    const mine = wrapper.dataset.mine === '1';
    const bodyDiv = document.createElement('div');
    bodyDiv.setAttribute('data-msg-body', '');
    bodyDiv.className = `px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${mine
      ? 'bg-[#0A3D62] text-white rounded-br-sm'
      : 'bg-white border border-zinc-200 text-gray-800 rounded-bl-sm'}`;
    bodyDiv.innerHTML = esc(msgBodyCache[msgId] || '');
    editWrap.replaceWith(bodyDiv);
  }

  async function saveEdit(msgId, newBody) {
    editingMsgId = null; // allow snapshot to re-render after the write
    try {
      await firebase.firestore()
        .collection('conversations').doc(currentConvId)
        .collection('messages').doc(msgId)
        .update({ body: newBody, editedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error('Edit failed:', err);
      cancelEdit(msgId);
    }
  }

  async function deleteMessage(btn, msgId) {
    // Two-click confirmation: first click turns the icon red; second click deletes.
    if (!btn.dataset.confirming) {
      btn.dataset.confirming = '1';
      btn.style.color = '#ef4444';
      btn.title = 'Click again to confirm delete';
      setTimeout(() => {
        if (btn.isConnected && btn.dataset.confirming) {
          delete btn.dataset.confirming;
          btn.style.color = '#a1a1aa';
          btn.title = 'Delete message';
        }
      }, 3000);
      return;
    }
    try {
      await firebase.firestore()
        .collection('conversations').doc(currentConvId)
        .collection('messages').doc(msgId)
        .delete();
    } catch (err) {
      console.error('Delete failed:', err);
    }
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
        const convRef  = firebase.firestore().collection('conversations').doc(currentConvId);
        const conv     = currentConvData || {};
        const participants  = conv.participants || [];
        const otherUids = participants.filter(uid => uid !== currentUser.uid);

        // Resolve sender display name (use cached conv data or fetch)
        let senderName = currentUser.displayName || '';
        if (!senderName) {
          const meSnap = await firebase.firestore().collection('users').doc(currentUser.uid).get();
          senderName = meSnap.data()?.displayName || 'Member';
        }

        // Add message
        await convRef.collection('messages').add({
          senderId  : currentUser.uid,
          senderName,
          body,
          sentAt    : firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Update conversation summary — mark ALL other participants as unread
        const unreadUpdate = otherUids.length > 0
          ? firebase.firestore.FieldValue.arrayUnion(...otherUids)
          : firebase.firestore.FieldValue.arrayRemove();
        await convRef.update({
          lastMessage   : body,
          lastMessageAt : firebase.firestore.FieldValue.serverTimestamp(),
          unreadBy      : unreadUpdate,
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

  // ── Init when nav is ready ───────────────────────────────────────────────────

  document.addEventListener('nav-loaded', () => {
    bindSendForm();

    document.getElementById('back-to-list')?.addEventListener('click', () => {
      document.getElementById('conv-panel')?.classList.remove('mobile-hidden');
      document.getElementById('thread-wrapper')?.classList.remove('mobile-active');
      document.getElementById('thread-panel')?.classList.add('hidden');
      document.getElementById('empty-state')?.classList.remove('hidden');
      currentConvId = null;
    });
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
