// js/event-registration.js — public registration modal for events.html
// (Event Registration Phase B1, see docs/EVENT_REGISTRATION.md).
//
// Separate from RSVP (member-only, direct client write to the rsvps array):
// registration must also work for people from other assemblies with no
// account on this app at all, so submission goes through the registerForEvent
// Cloud Function rather than a client Firestore write, and the audience gate
// (public vs members) is enforced there, not just in this UI.
//
// Reads currentUser / userIsMember / allEvents — globals owned by js/events.js,
// which always loads before this file and resolves them before a user could
// possibly click a Register button (auth state settles well before any
// interaction is possible).

let regModalEventId = null;

function buildRegisterButton(event) {
  const reg = event.registration || {};
  if (!reg.enabled) return '';
  if (reg.audience === 'members' && !userIsMember) return '';

  // Capacity (Phase B2) — proactively show "Full" rather than only failing on
  // submit. This is a courtesy display only; registerForEvent still enforces
  // the actual limit server-side (this count can be stale by the time of
  // submission under concurrent registrations).
  if (typeof reg.capacity === 'number' && reg.capacity > 0 && (reg.seatsTaken || 0) >= reg.capacity) {
    return `<span class="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-400"><i class="fas fa-ban mr-1"></i>Registration full</span>`;
  }

  return `
    <button onclick="openRegistrationModal('${event.id}')"
            class="text-xs font-medium px-3 py-1.5 rounded-full border transition-all border-indigo-300 text-indigo-700 hover:bg-indigo-50">
      <i class="fas fa-clipboard-list mr-1"></i>Register
    </button>`;
}

function openRegistrationModal(eventId) {
  const event = allEvents.find((e) => e.id === eventId);
  if (!event) return;
  regModalEventId = eventId;

  document.getElementById('registration-modal-title').textContent = `Register — ${event.title}`;
  document.getElementById('registration-modal-body').innerHTML = buildRegistrationForm(event);
  document.getElementById('registration-modal').classList.remove('hidden');
}

function closeRegistrationModal() {
  document.getElementById('registration-modal').classList.add('hidden');
  regModalEventId = null;
}

function buildRegistrationForm(event) {
  const fields = (event.registration && event.registration.fields) || [];
  const dynamicHtml = fields.map((f) => buildDynamicField(f)).join('');

  return `
    <div class="space-y-3 mt-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">First name *</label>
          <input id="reg-first-name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last name *</label>
          <input id="reg-last-name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
        <input id="reg-phone" type="tel" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
        <input id="reg-email" type="email" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Home assembly (if not EGC)</label>
        <input id="reg-assembly" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      ${dynamicHtml}
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Proof of payment (optional)</label>
        <label class="flex items-center gap-2 cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm px-4 py-2.5 rounded-xl transition w-fit">
          <i class="fas fa-paperclip"></i> <span id="reg-proof-filename">Choose file</span>
          <input id="reg-proof-file" type="file" accept="image/*,application/pdf" class="hidden" onchange="onProofFileSelected(event)">
        </label>
        <p class="text-xs text-gray-400 mt-1">A photo or scan of your deposit slip/EFT confirmation, if you've already paid. You can also send this later.</p>
      </div>
      <div id="registration-form-msg" class="hidden text-sm font-medium text-red-500"></div>
      <div class="flex gap-3 pt-2">
        <button onclick="submitRegistration()" id="registration-submit-btn"
                class="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Submit
        </button>
        <button onclick="closeRegistrationModal()"
                class="border border-zinc-200 hover:border-zinc-300 text-zinc-600 px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Cancel
        </button>
      </div>
    </div>`;
}

function onProofFileSelected(e) {
  const file = e.target.files[0];
  document.getElementById('reg-proof-filename').textContent = file ? file.name : 'Choose file';
}

function buildDynamicField(f) {
  const req = f.required ? ' *' : '';
  const id = 'reg-dyn-' + f.id;
  let control;
  if (f.type === 'textarea') {
    control = `<textarea id="${id}" rows="3" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"></textarea>`;
  } else if (f.type === 'select') {
    const opts = (f.options || []).map((o) => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('');
    control = `<select id="${id}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">Select…</option>${opts}</select>`;
  } else if (f.type === 'checkbox') {
    return `
      <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input id="${id}" type="checkbox" class="w-4 h-4 accent-amber-500">
        ${escHtml(f.label)}${req}
      </label>`;
  } else {
    const inputType = f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : f.type === 'number' ? 'number' : 'text';
    control = `<input id="${id}" type="${inputType}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">`;
  }
  return `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">${escHtml(f.label)}${req}</label>
      ${control}
    </div>`;
}

async function submitRegistration() {
  const event = allEvents.find((e) => e.id === regModalEventId);
  if (!event) return;
  const msgEl = document.getElementById('registration-form-msg');
  msgEl.classList.add('hidden');

  const firstName = document.getElementById('reg-first-name').value.trim();
  const lastName  = document.getElementById('reg-last-name').value.trim();
  if (!firstName || !lastName) {
    msgEl.textContent = 'First and last name are required.';
    msgEl.classList.remove('hidden');
    return;
  }

  const fields = (event.registration && event.registration.fields) || [];
  const answers = {};
  for (const f of fields) {
    const el = document.getElementById('reg-dyn-' + f.id);
    if (!el) continue;
    const val = f.type === 'checkbox' ? (el.checked ? 'Yes' : '') : el.value.trim();
    if (f.required && !val) {
      msgEl.textContent = `"${f.label}" is required.`;
      msgEl.classList.remove('hidden');
      return;
    }
    if (val) answers[f.id] = val;
  }

  const btn = document.getElementById('registration-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-1"></i>Submitting…';

  const proofFile = document.getElementById('reg-proof-file').files[0] || null;

  try {
    const registerFn = firebase.functions().httpsCallable('registerForEvent');
    const result = await registerFn({
      eventId: regModalEventId,
      firstName, lastName,
      phone: document.getElementById('reg-phone').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      assembly: document.getElementById('reg-assembly').value.trim(),
      answers,
    });

    const ref = result.data.referenceCode;
    const registrationId = result.data.registrationId;

    // Proof-of-payment upload (Phase B3) — best-effort, never blocks the
    // registration itself, which already succeeded by this point. Uploaded
    // directly to Storage (js/storage-upload.js, the only module that talks
    // to Storage) then attached to the registration doc via a callable,
    // since clients can't write to that collection directly.
    let proofWarning = '';
    if (proofFile) {
      try {
        const path = `events/${regModalEventId}/registrations/${registrationId}/${Date.now()}_${proofFile.name}`;
        const proofUrl = await uploadMedia(path, proofFile);
        const attachFn = firebase.functions().httpsCallable('attachRegistrationProof');
        await attachFn({ eventId: regModalEventId, registrationId, proofUrl });
      } catch (uploadErr) {
        console.error('Proof of payment upload failed:', uploadErr);
        proofWarning = '<p class="text-xs text-amber-600 mt-3">Your registration is confirmed, but the proof-of-payment file didn\'t upload — you can email it instead.</p>';
      }
    }

    document.getElementById('registration-modal-body').innerHTML = `
      <div class="text-center py-6">
        <i class="fas fa-circle-check text-4xl text-green-500 mb-4"></i>
        <p class="text-gray-700 font-medium">You're registered!</p>
        ${ref ? `<p class="text-sm text-gray-500 mt-2">Quote this reference for any payment:</p>
                 <p class="text-lg font-mono font-bold text-[#0A3D62] mt-1">${escHtml(ref)}</p>` : ''}
        ${proofWarning}
        <button onclick="closeRegistrationModal()"
                class="mt-6 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Done
        </button>
      </div>`;
  } catch (err) {
    msgEl.textContent = err.message || 'Failed to submit. Please try again.';
    msgEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Submit';
  }
}

// escHtml() is already defined globally by js/events.js, which always loads
// before this file — reused here rather than redeclared.
