// js/events.js — Monthly calendar view for the Notices page.

let allEvents      = [];
let activeCategory = 'all';
let currentUser    = null;
let userIsMember   = false;
let currentMonth   = new Date();   // always kept at the 1st of the displayed month
let selectedDate   = null;

currentMonth.setDate(1);
currentMonth.setHours(0, 0, 0, 0);

const CATEGORY_LABELS = {
  service: 'Service',
  group:   'Group',
  special: 'Special',
  other:   'Other',
};

const CATEGORY_COLORS = {
  service: 'bg-blue-100 text-blue-700',
  group:   'bg-green-100 text-green-700',
  special: 'bg-amber-100 text-amber-700',
  other:   'bg-gray-100 text-gray-600',
};

const DOT_COLORS = {
  service: '#3B82F6',
  group:   '#22C55E',
  special: '#F59E0B',
  other:   '#9CA3AF',
};

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      currentUser = user;
      if (user) {
        try {
          const snap = await firebase.firestore().collection('users').doc(user.uid).get();
          userIsMember = snap.exists && snap.data().membership === 'member';
        } catch (_) {
          userIsMember = false;
        }
      } else {
        userIsMember = false;
      }
      if (allEvents.length > 0) renderCalendar();
    });
    loadEvents();
  });
});

function waitForFirebase(cb) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) cb();
  else setTimeout(() => waitForFirebase(cb), 100);
}

function loadEvents() {
  firebase.firestore()
    .collection('events')
    .where('published', '==', true)
    .orderBy('startDate', 'asc')
    .get()
    .then((snap) => {
      allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('content').classList.remove('hidden');
      renderCalendar();
      jumpToDeepLinkedEvent();
    })
    .catch((err) => {
      console.error('Error loading events:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

// ─── Category filter ──────────────────────────────────────────────────────────

function setCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-' + cat).classList.add('active');
  selectedDate = null;
  renderCalendar();
}

// ─── Month navigation ─────────────────────────────────────────────────────────

function prevMonth() {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  selectedDate = null;
  renderCalendar();
}

function nextMonth() {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  selectedDate = null;
  renderCalendar();
}

function goToToday() {
  currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  selectedDate = null;
  renderCalendar();
}

// ─── Calendar render ──────────────────────────────────────────────────────────

function renderCalendar() {
  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = new Date();
  const todayStr = isoDate(today);

  // Month / year label
  document.getElementById('month-label').textContent =
    new Date(year, month, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  // Show/hide "Today" button
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  document.getElementById('today-btn').classList.toggle('hidden', isCurrentMonth);

  const filtered      = getFilteredEvents();
  const firstWeekday  = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const grid          = document.getElementById('cal-grid');
  grid.innerHTML      = '';

  // Leading blank cells
  for (let i = 0; i < firstWeekday; i++) {
    grid.insertAdjacentHTML('beforeend', '<div style="min-height:60px;border-right:1px solid #f4f4f5;border-bottom:1px solid #f4f4f5;"></div>');
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(year, month, day);
    const dateStr = isoDate(date);
    const isToday    = dateStr === todayStr;
    const isSelected = selectedDate && isoDate(selectedDate) === dateStr;
    const dayEvents  = filtered.filter(e => eventOnDate(e, date));

    // Dot indicators (max 3 visible, then +N)
    const visible = dayEvents.slice(0, 3);
    const extra   = dayEvents.length - visible.length;
    const dotsHtml = visible.map(e =>
      `<span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:${DOT_COLORS[e.category] || '#9CA3AF'};flex-shrink:0"></span>`
    ).join('') + (extra > 0 ? `<span style="font-size:8px;color:#6B7280;line-height:1">+${extra}</span>` : '');

    const numStyle = isToday
      ? 'background:#F59E0B;color:#fff;border-radius:9999px;'
      : isSelected
        ? 'background:#0A3D62;color:#fff;border-radius:9999px;'
        : '';

    const cellBg  = isSelected ? '#EFF6FF' : '';
    const cursor  = dayEvents.length ? 'cursor:pointer;' : '';
    const hoverJs = isSelected
      ? ''
      : `onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''"`;

    grid.insertAdjacentHTML('beforeend', `
      <div onclick="selectDay(${day})"
           ${hoverJs}
           style="min-height:60px;padding:6px 4px 4px;border-right:1px solid #f4f4f5;border-bottom:1px solid #f4f4f5;background:${cellBg};${cursor}">
        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;margin:0 auto;${numStyle}">
          ${day}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:2px;flex-wrap:wrap;margin-top:4px;min-height:8px;">
          ${dotsHtml}
        </div>
      </div>`);
  }

  // Trailing blank cells
  const totalCells = firstWeekday + daysInMonth;
  const trail = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trail; i++) {
    grid.insertAdjacentHTML('beforeend', '<div style="min-height:60px;border-right:1px solid #f4f4f5;border-bottom:1px solid #f4f4f5;"></div>');
  }

  // Day panel
  if (selectedDate && selectedDate.getMonth() === month && selectedDate.getFullYear() === year) {
    renderDayPanel(selectedDate, filtered);
  } else {
    document.getElementById('day-panel').classList.add('hidden');
  }

  // Empty state — no events at all this month
  const monthHasEvents = filtered.some(e => eventOverlapsMonth(e, year, month));
  const emptyState = document.getElementById('empty-state');
  emptyState.classList.toggle('hidden', monthHasEvents);
}

// ─── Day selection ────────────────────────────────────────────────────────────

function selectDay(day) {
  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const date  = new Date(year, month, day);
  const dayEvents = getFilteredEvents().filter(e => eventOnDate(e, date));
  if (!dayEvents.length) return;

  if (selectedDate && isoDate(selectedDate) === isoDate(date)) {
    selectedDate = null;
  } else {
    selectedDate = date;
  }
  renderCalendar();
}

// Deep link from the homepage's "Register" shortcut on an Upcoming Events
// card (?register={eventId}) — jumps the calendar straight to that event's
// month/day and opens its registration modal, rather than making the
// visitor hunt through months of the calendar to find it themselves.
function jumpToDeepLinkedEvent() {
  const eventId = new URLSearchParams(window.location.search).get('register');
  if (!eventId) return;
  const event = allEvents.find((e) => e.id === eventId);
  if (!event) return;

  const start = toDate(event.startDate);
  currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  selectedDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  renderCalendar();

  // Mirrors buildRegisterButton()'s own gating (js/event-registration.js) —
  // openRegistrationModal() itself has no audience/capacity gate of its own,
  // it only relies on that button never being rendered for an ineligible
  // viewer. Since this bypasses the button, re-check the same conditions
  // before auto-opening so a deep link can't show a form to someone who
  // shouldn't see it, or that's certain to be rejected as already full.
  const reg = event.registration || {};
  const capacityFull = typeof reg.capacity === 'number' && reg.capacity > 0 && (reg.seatsTaken || 0) >= reg.capacity;
  const eligible = reg.enabled && !(reg.audience === 'members' && !userIsMember) && !capacityFull;
  if (eligible && typeof openRegistrationModal === 'function') {
    setTimeout(() => openRegistrationModal(eventId), 150);
  }
}

// ─── Day panel ────────────────────────────────────────────────────────────────

function renderDayPanel(date, filtered) {
  const panel     = document.getElementById('day-panel');
  const titleEl   = document.getElementById('day-panel-title');
  const container = document.getElementById('day-events');

  const dayEvents = filtered
    .filter(e => eventOnDate(e, date))
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate));

  if (!dayEvents.length) { panel.classList.add('hidden'); return; }

  titleEl.textContent = date.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  container.innerHTML = dayEvents.map(e => buildDayCard(e)).join('');
  panel.classList.remove('hidden');

  // Scroll the panel into view smoothly
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function buildDayCard(event) {
  const start       = toDate(event.startDate);
  const end         = event.endDate ? toDate(event.endDate) : null;
  const timeStr     = formatTime(start);
  const dateStr     = formatDateRange(start, end);
  const catLabel    = CATEGORY_LABELS[event.category] || '';
  const badgeClass  = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-600';
  const rsvpHtml    = buildRsvpButtons(event);
  // buildRegisterButton / buildFindRegistrationLink live in
  // js/event-registration.js (loaded after this file), separate from RSVP —
  // see docs/EVENT_REGISTRATION.md.
  const registerBtn = buildRegisterButton(event);
  const findRegLink = buildFindRegistrationLink(event);
  const registerHtml = registerBtn || findRegLink
    ? `<div class="flex flex-col items-start gap-1 mt-2 pt-3 border-t border-zinc-50">${registerBtn}${findRegLink}</div>`
    : '';

  const imageHtml = event.imageUrl
    ? `<img src="${event.imageUrl}" alt="${escHtml(event.title)}" class="w-full h-40 object-cover rounded-xl mb-3">`
    : '';

  return `
    <div class="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col gap-1.5" id="event-card-${event.id}">
      ${imageHtml}
      <div class="flex items-center gap-2 flex-wrap">
        ${catLabel ? `<span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${badgeClass}">${catLabel}</span>` : ''}
      </div>
      <h3 class="font-bold text-[#0A3D62] text-lg leading-snug">${escHtml(event.title)}</h3>
      <p class="text-sm text-gray-500">
        <i class="fas fa-calendar text-amber-500 mr-1.5 w-4"></i>${dateStr}${timeStr ? ` &bull; ${timeStr}` : ''}
      </p>
      ${event.location ? `<p class="text-sm text-gray-500"><i class="fas fa-map-marker-alt text-amber-500 mr-1.5 w-4"></i>${escHtml(event.location)}</p>` : ''}
      ${event.description ? `<p class="text-sm text-gray-600 leading-relaxed line-clamp-3 mt-1">${escHtml(event.description)}</p>` : ''}
      ${rsvpHtml}
      ${registerHtml}
    </div>`;
}

// ─── RSVP ─────────────────────────────────────────────────────────────────────

function buildRsvpButtons(event) {
  // Absent field = enabled, so every event that existed before this toggle
  // shipped keeps behaving exactly as it did (Event Registration Phase A).
  if (event.rsvpEnabled === false) return '';

  const rsvps    = event.rsvps || [];
  const count    = rsvps.length;
  const hasRsvped = currentUser && rsvps.includes(currentUser.uid);
  const countLabel = count > 0 ? `<span class="text-xs text-gray-400">${count} attending</span>` : '';

  if (!userIsMember && !countLabel) return '';

  let btn = '';
  if (userIsMember) {
    btn = hasRsvped
      ? `<button onclick="toggleRsvp('${event.id}', true)"
                 class="text-xs font-medium px-3 py-1.5 rounded-full border transition-all bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
           <i class="fas fa-check mr-1"></i>Going
         </button>`
      : `<button onclick="toggleRsvp('${event.id}', false)"
                 class="text-xs font-medium px-3 py-1.5 rounded-full border transition-all border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-amber-600">
           <i class="fas fa-calendar-plus mr-1"></i>RSVP
         </button>`;
  }

  if (!btn && !countLabel) return '';
  return `<div class="flex items-center gap-3 mt-2 pt-3 border-t border-zinc-50">${btn}${countLabel}</div>`;
}

async function toggleRsvp(eventId, hasRsvped) {
  if (!currentUser) return;
  const op = hasRsvped
    ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    : firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
  try {
    await firebase.firestore().collection('events').doc(eventId).update({ rsvps: op });
    const evt = allEvents.find(e => e.id === eventId);
    if (evt) {
      evt.rsvps = hasRsvped
        ? (evt.rsvps || []).filter(uid => uid !== currentUser.uid)
        : [...(evt.rsvps || []), currentUser.uid];
      renderCalendar();
    }
  } catch (err) {
    console.error('RSVP failed:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFilteredEvents() {
  return allEvents
    .filter(e => e.audience !== 'members' || userIsMember)
    .filter(e => activeCategory === 'all' || e.category === activeCategory);
}

function eventOnDate(event, date) {
  const dayStr   = isoDate(date);
  const startStr = isoDate(toDate(event.startDate));
  const endStr   = event.endDate ? isoDate(toDate(event.endDate)) : startStr;
  return startStr <= dayStr && dayStr <= endStr;
}

function eventOverlapsMonth(event, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  const s = toDate(event.startDate);
  const e = event.endDate ? toDate(event.endDate) : s;
  return s <= monthEnd && e >= monthStart;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDate(value) {
  if (!value) return new Date(0);
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

function formatTime(date) {
  const h = date.getHours(), m = date.getMinutes();
  if (h === 0 && m === 0) return '';
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function formatDateRange(start, end) {
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  const s = start.toLocaleDateString('en-ZA', opts);
  if (!end || start.toDateString() === end.toDateString()) return s;
  return `${s} &ndash; ${end.toLocaleDateString('en-ZA', opts)}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
