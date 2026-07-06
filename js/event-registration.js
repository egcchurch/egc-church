// js/event-registration.js — public registration modal for events.html
// (Event Registration, see docs/EVENT_REGISTRATION.md).
//
// Separate from RSVP (member-only, direct client write to the rsvps array):
// registration must also work for people from other assemblies with no
// account on this app at all, so submission goes through the registerForEvent
// Cloud Function rather than a client Firestore write, and the audience gate
// (public vs members) is enforced there, not just in this UI.
//
// Party model (Phase C1): one contact (whoever is filling in the form) can
// register one or more attendees in a single submission — e.g. a parent
// registering their 3 children. The contact isn't assumed to be an attendee
// themselves. Each attendee gets their own copy of the event's dynamic
// questions (a T-shirt size or dietary need is per-child, not per-family).
//
// Reads currentUser / userIsMember / allEvents — globals owned by js/events.js,
// which always loads before this file and resolves them before a user could
// possibly click a Register button (auth state settles well before any
// interaction is possible).

let regModalEventId = null;
let attendeeIdx = 0; // running counter for unique attendee block IDs, never reused

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

// "Find my registration" (Phase C3) — shown whenever registration is enabled,
// regardless of capacity/full state, since an existing registrant still
// needs a way back in to attach proof-of-payment even after the event fills
// up. Most registrants have no account on this app, so this is the only path
// back — there's no email-sent link to click (Phase B4/real email deferred).
function buildFindRegistrationLink(event) {
  const reg = event.registration || {};
  if (!reg.enabled) return '';
  return `
    <button onclick="openFindRegistrationModal('${event.id}')"
            class="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 mt-1">
      Already registered? Attach payment proof
    </button>`;
}

function openRegistrationModal(eventId) {
  const event = allEvents.find((e) => e.id === eventId);
  if (!event) return;
  regModalEventId = eventId;
  attendeeIdx = 0;

  document.getElementById('registration-modal-title').textContent = `Register — ${event.title}`;
  document.getElementById('registration-modal-body').innerHTML = buildRegistrationForm();
  addAttendeeRow(); // every registration starts with at least one attendee
  document.getElementById('registration-modal').classList.remove('hidden');
}

function closeRegistrationModal() {
  document.getElementById('registration-modal').classList.add('hidden');
  regModalEventId = null;
  findRegModalEventId = null;
}

function buildRegistrationForm() {
  return `
    <div class="space-y-3 mt-4">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your details</p>
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
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
          <input id="reg-phone" type="tel" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
          <input id="reg-email" type="email" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
      </div>
      <p class="text-xs text-gray-400">At least a phone number or email is required, so we can find your registration again if needed.</p>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Home assembly (if not EGC)</label>
        <input id="reg-assembly" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>

      <div class="pt-2 border-t border-gray-100">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Who's attending</p>
        <div id="reg-attendees-container" class="space-y-3"></div>
        <button type="button" onclick="addAttendeeRow()" class="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 hover:border-indigo-300 px-3 py-1 rounded-full transition-all">
          <i class="fas fa-plus mr-1"></i>Add another person
        </button>
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Proof of payment (optional)</label>
        <label class="flex items-center gap-2 cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm px-4 py-2.5 rounded-xl transition w-fit">
          <i class="fas fa-paperclip"></i> <span id="reg-proof-filename">Choose file</span>
          <input id="reg-proof-file" type="file" accept="image/*,application/pdf" class="hidden" onchange="onProofFileSelected(event)">
        </label>
        <p class="text-xs text-gray-400 mt-1">A photo or scan of your deposit slip/EFT confirmation, if you've already paid. You can also send this later.</p>
      </div>
      <div id="registration-form-msg" class="hidden text-sm font-medium text-red-500"></div>
      <div id="registration-duplicate-msg" class="hidden text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3"></div>
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

function addAttendeeRow() {
  const idx = attendeeIdx++;
  const event = allEvents.find((e) => e.id === regModalEventId);
  const fields = (event && event.registration && event.registration.fields) || [];
  const dynamicHtml = fields.map((f) => buildDynamicField(f, idx)).join('');

  const block = document.createElement('div');
  block.className = 'attendee-block border border-gray-100 rounded-xl p-3 space-y-2';
  block.id = 'attendee-block-' + idx;
  block.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold text-gray-600">Person ${document.querySelectorAll('.attendee-block').length + 1}</p>
      <button type="button" onclick="removeAttendeeRow(${idx})" class="text-gray-300 hover:text-red-500 text-xs"><i class="fas fa-trash"></i></button>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">First name *</label>
        <input id="reg-att-${idx}-first-name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last name *</label>
        <input id="reg-att-${idx}-last-name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
    </div>
    ${dynamicHtml}`;
  document.getElementById('reg-attendees-container').appendChild(block);
}

function removeAttendeeRow(idx) {
  const blocks = document.querySelectorAll('.attendee-block');
  if (blocks.length <= 1) {
    const msgEl = document.getElementById('registration-form-msg');
    msgEl.textContent = 'At least one attendee is required.';
    msgEl.classList.remove('hidden');
    return;
  }
  document.getElementById('attendee-block-' + idx)?.remove();
  // Renumber the visible "Person N" labels left to right.
  document.querySelectorAll('.attendee-block').forEach((el, i) => {
    const label = el.querySelector('p');
    if (label) label.textContent = `Person ${i + 1}`;
  });
}

function onProofFileSelected(e) {
  const file = e.target.files[0];
  document.getElementById('reg-proof-filename').textContent = file ? file.name : 'Choose file';
}

function buildDynamicField(f, idx) {
  const req = f.required ? ' *' : '';
  const id = `reg-att-${idx}-dyn-${f.id}`;
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

// Reads the current form state into { contact, attendees } — used both for
// the initial submit attempt and for the resubmit-with-confirmDuplicate retry,
// so the two stay perfectly in sync.
function collectRegistrationPayload(event) {
  const fields = (event.registration && event.registration.fields) || [];
  const attendees = [];
  document.querySelectorAll('.attendee-block').forEach((block) => {
    const idx = block.id.replace('attendee-block-', '');
    const firstName = document.getElementById(`reg-att-${idx}-first-name`).value.trim();
    const lastName = document.getElementById(`reg-att-${idx}-last-name`).value.trim();
    const answers = {};
    fields.forEach((f) => {
      const el = document.getElementById(`reg-att-${idx}-dyn-${f.id}`);
      if (!el) return;
      const val = f.type === 'checkbox' ? (el.checked ? 'Yes' : '') : el.value.trim();
      if (val) answers[f.id] = val;
    });
    attendees.push({ firstName, lastName, answers });
  });

  return {
    contact: {
      firstName: document.getElementById('reg-first-name').value.trim(),
      lastName: document.getElementById('reg-last-name').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      assembly: document.getElementById('reg-assembly').value.trim(),
    },
    attendees,
  };
}

function validateRegistrationPayload(payload, event) {
  if (!payload.contact.firstName || !payload.contact.lastName) {
    return 'Your first and last name are required.';
  }
  if (!payload.contact.phone && !payload.contact.email) {
    return 'A phone number or email address is required.';
  }
  const fields = (event.registration && event.registration.fields) || [];
  for (const a of payload.attendees) {
    if (!a.firstName || !a.lastName) {
      return 'Each attendee needs a first and last name.';
    }
    for (const f of fields) {
      if (f.required && !a.answers[f.id]) {
        return `"${f.label}" is required for ${a.firstName}.`;
      }
    }
  }
  return null;
}

async function submitRegistration(confirmDuplicate) {
  const event = allEvents.find((e) => e.id === regModalEventId);
  if (!event) return;
  const msgEl = document.getElementById('registration-form-msg');
  const dupEl = document.getElementById('registration-duplicate-msg');
  msgEl.classList.add('hidden');
  dupEl.classList.add('hidden');

  const payload = collectRegistrationPayload(event);
  const validationError = validateRegistrationPayload(payload, event);
  if (validationError) {
    msgEl.textContent = validationError;
    msgEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('registration-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-1"></i>Submitting…';

  const proofFile = document.getElementById('reg-proof-file').files[0] || null;

  try {
    const registerFn = firebase.functions().httpsCallable('registerForEvent');
    const result = await registerFn({
      eventId: regModalEventId,
      contact: payload.contact,
      attendees: payload.attendees,
      confirmDuplicate: !!confirmDuplicate,
    });

    const ref = result.data.referenceCode;
    const registrationId = result.data.registrationId;
    const isPending = result.data.status === 'pending';

    // Proof-of-payment upload (Phase B3) — best-effort, never blocks the
    // registration itself, which already succeeded by this point. Uploaded
    // directly to Storage (js/storage-upload.js, the only module that talks
    // to Storage) then attached to the registration doc via a callable,
    // since clients can't write to that collection directly. Still attached
    // even while pending (Phase C2) — useful for an admin reviewing the
    // request to see payment was already made, even though no reference
    // code has been given out yet for a pending registration.
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
        <i class="fas ${isPending ? 'fa-clock text-4xl text-amber-500' : 'fa-circle-check text-4xl text-green-500'} mb-4"></i>
        <p class="text-gray-700 font-medium">${isPending ? "You're registered — pending review." : "You're registered!"}</p>
        ${isPending
          ? '<p class="text-sm text-gray-500 mt-2">We\'ll be in touch once your registration is approved.</p>'
          : (ref ? `<p class="text-sm text-gray-500 mt-2">Quote this reference for any payment:</p>
                 <p class="text-lg font-mono font-bold text-[#0A3D62] mt-1">${escHtml(ref)}</p>` : '')}
        ${proofWarning}
        <button onclick="closeRegistrationModal()"
                class="mt-6 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Done
        </button>
      </div>`;
  } catch (err) {
    // Deduplication (Phase C1) — a soft warn, not a hard failure. The server
    // returns 'already-exists' (with the existing registration's submission
    // date in err.details) instead of a plain rejection; show a confirm
    // prompt and, if accepted, resubmit the identical payload with
    // confirmDuplicate: true rather than treating it as an error.
    const code = err && (err.code || '').replace(/^functions\//, '');
    if (code === 'already-exists') {
      const details = err.details || (err.customData && err.customData.details) || null;
      const submittedAt = details && details.submittedAt
        ? new Date(details.submittedAt).toLocaleDateString('en-ZA', { dateStyle: 'medium' })
        : null;
      dupEl.innerHTML = `
        There's already a registration for this phone number or email${submittedAt ? `, submitted on ${escHtml(submittedAt)}` : ''}.
        Are you sure you want to create another one?
        <div class="flex gap-3 mt-3">
          <button onclick="submitRegistration(true)" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-full text-xs font-medium transition-all">Yes, register anyway</button>
          <button onclick="document.getElementById('registration-duplicate-msg').classList.add('hidden')" class="border border-zinc-200 hover:border-zinc-300 text-zinc-600 px-4 py-1.5 rounded-full text-xs font-medium transition-all">Cancel</button>
        </div>`;
      dupEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Submit';
      return;
    }
    msgEl.textContent = err.message || 'Failed to submit. Please try again.';
    msgEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Submit';
  }
}

// ── Find my registration (Phase C3) ─────────────────────────────────────────
// Reuses the same #registration-modal container as the main registration
// flow — just swaps its title/body content.

let findRegModalEventId = null;

function openFindRegistrationModal(eventId) {
  const event = allEvents.find((e) => e.id === eventId);
  if (!event) return;
  findRegModalEventId = eventId;

  document.getElementById('registration-modal-title').textContent = `Find my registration — ${event.title}`;
  document.getElementById('registration-modal-body').innerHTML = `
    <div class="space-y-3 mt-4">
      <p class="text-xs text-gray-500">Enter your reference code and the phone number or email you registered with.</p>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reference code *</label>
        <input id="find-reg-code" type="text" placeholder="e.g. YC-202603-SMITH" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
          <input id="find-reg-phone" type="tel" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
          <input id="find-reg-email" type="email" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
        </div>
      </div>
      <p class="text-xs text-gray-400">At least one of phone or email is required.</p>
      <div id="find-reg-msg" class="hidden text-sm font-medium text-red-500"></div>
      <div class="flex gap-3 pt-2">
        <button onclick="submitFindRegistration()" id="find-reg-submit-btn"
                class="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Find registration
        </button>
        <button onclick="closeRegistrationModal()"
                class="border border-zinc-200 hover:border-zinc-300 text-zinc-600 px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Cancel
        </button>
      </div>
    </div>`;
  document.getElementById('registration-modal').classList.remove('hidden');
}

async function submitFindRegistration() {
  const msgEl = document.getElementById('find-reg-msg');
  msgEl.classList.add('hidden');

  const referenceCode = document.getElementById('find-reg-code').value.trim();
  const phone = document.getElementById('find-reg-phone').value.trim();
  const email = document.getElementById('find-reg-email').value.trim();
  if (!referenceCode || (!phone && !email)) {
    msgEl.textContent = 'A reference code and a phone number or email are required.';
    msgEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('find-reg-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-1"></i>Searching…';

  try {
    const lookupFn = firebase.functions().httpsCallable('lookupRegistration');
    const result = await lookupFn({ eventId: findRegModalEventId, referenceCode, phone, email });
    renderFindRegistrationResult(result.data);
  } catch (err) {
    msgEl.textContent = err.message || 'No matching registration found.';
    msgEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Find registration';
  }
}

function renderFindRegistrationResult(data) {
  const event = allEvents.find((e) => e.id === findRegModalEventId);
  const statusLine = {
    pending: '<p class="text-xs text-amber-600 mt-1"><i class="fas fa-clock mr-1"></i>Still pending review.</p>',
    approved: '<p class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle mr-1"></i>Approved.</p>',
    declined: '<p class="text-xs text-red-600 mt-1"><i class="fas fa-times-circle mr-1"></i>This registration was declined.</p>',
  }[data.status] || '';

  document.getElementById('registration-modal-body').innerHTML = `
    <div class="mt-4">
      <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
        <p class="text-sm text-gray-700">Found it — ${escHtml(data.contactFirstName || 'your registration')}'s registration for ${escHtml(event ? event.title : 'this event')} (${data.attendeeCount} ${data.attendeeCount === 1 ? 'attendee' : 'attendees'}).</p>
        ${statusLine}
        ${data.hasProof ? '<p class="text-xs text-gray-400 mt-1"><i class="fas fa-paperclip mr-1"></i>Proof of payment already on file.</p>' : ''}
      </div>
      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">${data.hasProof ? 'Replace proof of payment' : 'Attach proof of payment'}</label>
      <label class="flex items-center gap-2 cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm px-4 py-2.5 rounded-xl transition w-fit">
        <i class="fas fa-paperclip"></i> <span id="find-reg-proof-filename">Choose file</span>
        <input id="find-reg-proof-file" type="file" accept="image/*,application/pdf" class="hidden" onchange="document.getElementById('find-reg-proof-filename').textContent = (this.files[0] && this.files[0].name) || 'Choose file'">
      </label>
      <div id="find-reg-attach-msg" class="hidden text-sm font-medium text-red-500 mt-3"></div>
      <div class="flex gap-3 pt-4">
        <button onclick="submitAttachProof('${data.registrationId}')" id="find-reg-attach-btn"
                class="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Upload
        </button>
        <button onclick="closeRegistrationModal()"
                class="border border-zinc-200 hover:border-zinc-300 text-zinc-600 px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Close
        </button>
      </div>
    </div>`;
}

async function submitAttachProof(registrationId) {
  const msgEl = document.getElementById('find-reg-attach-msg');
  msgEl.classList.add('hidden');
  const file = document.getElementById('find-reg-proof-file').files[0];
  if (!file) {
    msgEl.textContent = 'Choose a file first.';
    msgEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('find-reg-attach-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-1"></i>Uploading…';

  try {
    const path = `events/${findRegModalEventId}/registrations/${registrationId}/${Date.now()}_${file.name}`;
    const proofUrl = await uploadMedia(path, file);
    const attachFn = firebase.functions().httpsCallable('attachRegistrationProof');
    await attachFn({ eventId: findRegModalEventId, registrationId, proofUrl });

    document.getElementById('registration-modal-body').innerHTML = `
      <div class="text-center py-6">
        <i class="fas fa-circle-check text-4xl text-green-500 mb-4"></i>
        <p class="text-gray-700 font-medium">Uploaded — thank you!</p>
        <button onclick="closeRegistrationModal()"
                class="mt-6 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
          Done
        </button>
      </div>`;
  } catch (err) {
    msgEl.textContent = err.message || 'Upload failed. Please try again.';
    msgEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Upload';
  }
}

// escHtml() is already defined globally by js/events.js, which always loads
// before this file — reused here rather than redeclared.
