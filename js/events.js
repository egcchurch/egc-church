// js/events.js

let allEvents = [];
let activeCategory = 'all';

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
  waitForFirebase(() => loadEvents());
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
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const filtered = activeCategory === 'all'
    ? allEvents
    : allEvents.filter((e) => e.category === activeCategory);

  const upcoming = filtered.filter((e) => toDate(e.startDate) >= now);
  const past = filtered.filter((e) => toDate(e.startDate) < now);

  renderGrid('upcoming-grid', upcoming);
  renderGrid('past-grid', past);

  // Toggle empty state for upcoming
  const upcomingEmpty = document.getElementById('upcoming-empty');
  if (upcoming.length === 0) {
    upcomingEmpty.classList.remove('hidden');
  } else {
    upcomingEmpty.classList.add('hidden');
  }

  // Show past section only when there are past events
  const pastSection = document.getElementById('past-section');
  if (past.length > 0) {
    pastSection.classList.remove('hidden');
  } else {
    pastSection.classList.add('hidden');
  }
}

function renderGrid(gridId, events) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';

  events.forEach((event) => {
    grid.insertAdjacentHTML('beforeend', buildCard(event));
  });
}

function buildCard(event) {
  const start = toDate(event.startDate);
  const end = event.endDate ? toDate(event.endDate) : null;
  const isPast = start < (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const dateStr = formatDateRange(start, end);
  const categoryBadge = CATEGORY_LABELS[event.category] || event.category || '';
  const badgeClass = CATEGORY_COLORS[event.category] || 'bg-gray-100 text-gray-600';

  const imageHtml = event.imageUrl
    ? `<img src="${event.imageUrl}" alt="${escHtml(event.title)}" class="w-full h-48 object-cover">`
    : `<div class="w-full h-48 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
         <i class="fas fa-calendar-alt text-white text-4xl opacity-60"></i>
       </div>`;

  const opacityClass = isPast ? 'opacity-60' : '';

  return `
    <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 flex flex-col ${opacityClass}">
      ${imageHtml}
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-start justify-between gap-2 mb-3">
          <span class="text-xs font-semibold px-3 py-1 rounded-full ${badgeClass}">${categoryBadge}</span>
          ${isPast ? '<span class="text-xs text-gray-400 font-medium">Past</span>' : ''}
        </div>
        <h3 class="text-lg font-bold text-[#0A3D62] mb-2 leading-snug">${escHtml(event.title)}</h3>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <i class="fas fa-calendar text-amber-500 w-4"></i>
          <span>${dateStr}</span>
        </div>
        ${event.location ? `
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <i class="fas fa-map-marker-alt text-amber-500 w-4"></i>
          <span>${escHtml(event.location)}</span>
        </div>` : '<div class="mb-3"></div>'}
        ${event.description ? `
        <p class="text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">${escHtml(event.description)}</p>
        ` : ''}
      </div>
    </div>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(value) {
  if (!value) return new Date(0);
  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate();
  // Plain JS Date or ISO string
  return new Date(value);
}

function formatDateRange(start, end) {
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  const startStr = start.toLocaleDateString('en-ZA', opts);

  if (!end) return startStr;

  // Same day — omit end date
  if (start.toDateString() === end.toDateString()) return startStr;

  const endStr = end.toLocaleDateString('en-ZA', opts);
  return `${startStr} &ndash; ${endStr}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
