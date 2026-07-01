// js/events.js

let allEvents = [];
let activeCategory = 'all';
let currentUser = null;
let userIsMember = false;

const CATEGORY_LABELS = {
  service: 'Service',
  group: 'Group',
  special: 'Special',
  other: 'Other',
};

const CATEGORY_COLORS = {
  service: 'bg-blue-100 text-blue-700',
  group: 'bg-green-100 text-green-700',
  special: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
};

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
      if (allEvents.length > 0) render();
    });
    loadEvents();
  });
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

function loadEvents() {
  const db = firebase.firestore();

  db.collection('events')
    .where('published', '==', true)
    .orderBy('startDate', 'asc')
    .get()
    .then((snapshot) => {
      allEvents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('content').classList.remove('hidden');
      render();
    })
    .catch((err) => {
      console.error('Error loading events:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

function setCategory(cat) {
  activeCategory = cat;

  document.querySelectorAll('.category-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.getElementById('filter-' + cat).classList.add('active');

  render();
}

function render() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(todayStart.getDate() + 7);

  // Upcoming events only, filtered by audience and category
  const upcoming = allEvents
    .filter((e) => e.audience !== 'members' || userIsMember)
    .filter((e) => activeCategory === 'all' || e.category === activeCategory)
    .filter((e) => toDate(e.startDate) >= todayStart);

  const [hero, ...rest] = upcoming;

  // Hero card
  const heroSection = document.getElementById('hero-section');
  const heroCard    = document.getElementById('hero-card');
  if (hero) {
    heroCard.innerHTML = buildHeroCard(hero);
    heroSection.classList.remove('hidden');
  } else {
    heroSection.classList.add('hidden');
    heroCard.innerHTML = '';
  }

  // Section grids
  const todayEvents  = rest.filter((e) => toDate(e.startDate) <= todayEnd);
  const weekEvents   = rest.filter((e) => { const d = toDate(e.startDate); return d > todayEnd && d < weekEnd; });
  const comingEvents = rest.filter((e) => toDate(e.startDate) >= weekEnd);

  renderSection('today-section',  'today-grid',  todayEvents);
  renderSection('week-section',   'week-grid',   weekEvents);
  renderSection('coming-section', 'coming-grid', comingEvents);

  // Empty state — shown only when there is no hero and no section events
  const emptyState = document.getElementById('empty-state');
  if (!hero) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }
}

function renderSection(sectionId, gridId, events) {
  const section = document.getElementById(sectionId);
  const grid    = document.getElementById(gridId);
  if (!events.length) {
    section.classList.add('hidden');
    return;
  }
  grid.innerHTML = '';
  events.forEach((event) => grid.insertAdjacentHTML('beforeend', buildCard(event)));
  section.classList.remove('hidden');
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function buildHeroCard(event) {
  const start = toDate(event.startDate);
  const end   = event.endDate ? toDate(event.endDate) : null;
  const dateStr = formatDateRange(start, end);
  const timeStr = formatTime(start);

  const categoryLabel = CATEGORY_LABELS[event.category] || event.category || '';
  const badgeClass    = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-600';

  const imageHtml = event.imageUrl
    ? `<div class="md:w-2/5 min-h-52 md:min-h-full bg-[#0A3D62] overflow-hidden flex-shrink-0">
         <img src="${event.imageUrl}" alt="${escHtml(event.title)}" class="w-full h-full object-cover">
       </div>`
    : `<div class="md:w-2/5 min-h-52 md:min-h-full bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center flex-shrink-0">
         <i class="fas fa-calendar-alt text-white text-5xl opacity-40"></i>
       </div>`;

  const rsvpHtml = buildRsvpButtons(event, true);

  return `
    <div class="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-100 flex flex-col md:flex-row" id="event-card-${event.id}">
      ${imageHtml}
      <div class="flex-1 p-8 flex flex-col">
        <div class="flex items-center gap-2 flex-wrap mb-4">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-amber-500 text-white uppercase tracking-wide">Next Up</span>
          ${categoryLabel ? `<span class="text-xs font-semibold px-3 py-1 rounded-full ${badgeClass}">${categoryLabel}</span>` : ''}
        </div>
        <h2 class="text-2xl font-bold text-[#0A3D62] mb-4 leading-snug">${escHtml(event.title)}</h2>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <i class="fas fa-calendar text-amber-500 w-4"></i>
          <span>${dateStr}${timeStr ? ` &bull; ${timeStr}` : ''}</span>
        </div>
        ${event.location ? `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <i class="fas fa-map-marker-alt text-amber-500 w-4"></i>
          <span>${escHtml(event.location)}</span>
        </div>` : '<div class="mb-4"></div>'}
        ${event.description ? `<p class="text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1 mb-4">${escHtml(event.description)}</p>` : '<div class="flex-1"></div>'}
        ${rsvpHtml}
      </div>
    </div>`;
}

// ─── Standard card ────────────────────────────────────────────────────────────

function buildCard(event) {
  const start = toDate(event.startDate);
  const end   = event.endDate ? toDate(event.endDate) : null;
  const dateStr = formatDateRange(start, end);
  const timeStr = formatTime(start);

  const categoryLabel = CATEGORY_LABELS[event.category] || event.category || '';
  const badgeClass    = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-600';

  const imageHtml = event.imageUrl
    ? `<img src="${event.imageUrl}" alt="${escHtml(event.title)}" class="w-full h-48 object-cover">`
    : `<div class="w-full h-48 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
         <i class="fas fa-calendar-alt text-white text-4xl opacity-60"></i>
       </div>`;

  const rsvpHtml = buildRsvpButtons(event, false);

  return `
    <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 flex flex-col" id="event-card-${event.id}">
      ${imageHtml}
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-start justify-between gap-2 mb-3">
          ${categoryLabel ? `<span class="text-xs font-semibold px-3 py-1 rounded-full ${badgeClass}">${categoryLabel}</span>` : '<span></span>'}
        </div>
        <h3 class="text-lg font-bold text-[#0A3D62] mb-2 leading-snug">${escHtml(event.title)}</h3>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <i class="fas fa-calendar text-amber-500 w-4"></i>
          <span>${dateStr}${timeStr ? ` &bull; ${timeStr}` : ''}</span>
        </div>
        ${event.location ? `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <i class="fas fa-map-marker-alt text-amber-500 w-4"></i>
          <span>${escHtml(event.location)}</span>
        </div>` : '<div class="mb-3"></div>'}
        ${event.description ? `<p class="text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">${escHtml(event.description)}</p>` : ''}
        ${rsvpHtml}
      </div>
    </div>`;
}

// ─── RSVP buttons ─────────────────────────────────────────────────────────────

function buildRsvpButtons(event, isHero) {
  const rsvps    = event.rsvps || [];
  const rsvpCount = rsvps.length;
  const hasRsvped = currentUser && rsvps.includes(currentUser.uid);

  const countLabel = rsvpCount > 0
    ? `<span class="text-${isHero ? 'sm' : 'xs'} text-gray-400">${rsvpCount} attending</span>`
    : '';

  let rsvpBtn = '';
  if (userIsMember) {
    const sizeClass = isHero
      ? 'text-sm font-medium px-5 py-2.5'
      : 'text-xs font-medium px-3 py-1.5';
    if (hasRsvped) {
      rsvpBtn = `<button onclick="toggleRsvp('${event.id}', true)"
                         class="${sizeClass} rounded-full border transition-all bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
                   <i class="fas fa-check mr-1"></i>Going
                 </button>`;
    } else {
      rsvpBtn = `<button onclick="toggleRsvp('${event.id}', false)"
                         class="${sizeClass} rounded-full border transition-all border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-amber-600">
                   <i class="fas fa-calendar-plus mr-1"></i>RSVP
                 </button>`;
    }
  }

  if (!rsvpBtn && !countLabel) return '';

  const wrapClass = isHero
    ? 'flex items-center gap-3 pt-4 border-t border-gray-100'
    : 'mt-3 flex items-center gap-3';

  return `<div class="${wrapClass}">${rsvpBtn}${countLabel}</div>`;
}

async function toggleRsvp(eventId, hasRsvped) {
  if (!currentUser) return;
  const db = firebase.firestore();
  const op = hasRsvped
    ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    : firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
  try {
    await db.collection('events').doc(eventId).update({ rsvps: op });
    const evt = allEvents.find((e) => e.id === eventId);
    if (evt) {
      if (hasRsvped) {
        evt.rsvps = (evt.rsvps || []).filter((uid) => uid !== currentUser.uid);
      } else {
        evt.rsvps = [...(evt.rsvps || []), currentUser.uid];
      }
      render();
    }
  } catch (err) {
    console.error('RSVP failed:', err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const startStr = start.toLocaleDateString('en-ZA', opts);
  if (!end) return startStr;
  if (start.toDateString() === end.toDateString()) return startStr;
  return `${startStr} &ndash; ${end.toLocaleDateString('en-ZA', opts)}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
