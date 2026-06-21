// js/sermons.js

const db = firebase.firestore();
let allSermons = [];
let allSeries = [];
let currentView = 'table';

// ── Load from Firestore ───────────────────────────────────────────────────────
// Sermons and series are loaded independently — a failure fetching series
// (e.g. a missing Firestore index) must not also blank out the sermon list,
// since the two are related but separate pieces of content.
function loadSermons() {
  const sermonsPromise = db.collection('sermons').where('published', '==', true).orderBy('date', 'desc').get();
  const seriesPromise = db.collection('series').where('published', '==', true).orderBy('order').get()
    .catch((err) => {
      console.error('Error loading series:', err);
      return null;
    });

  Promise.all([sermonsPromise, seriesPromise])
    .then(([sermonsSnap, seriesSnap]) => {
      allSermons = sermonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allSeries  = seriesSnap ? seriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];
      filterAndRender();
    })
    .catch((err) => {
      console.error('Error loading sermons:', err);
      document.getElementById('table-body').innerHTML = `
        <tr><td colspan="4" class="px-8 py-12 text-center text-gray-400">
          Unable to load sermons. Please try again later.
        </td></tr>`;
    });
}

function setView(view) {
  currentView = view;
  const views = ['card', 'table', 'series'];
  views.forEach(v => {
    document.getElementById(v + '-view').classList.toggle('hidden', v !== view);
    const btn = document.getElementById(v + '-btn');
    if (btn) btn.classList.toggle('active-view', v === view);
  });
  // Hide search for series view when in drill-down mode (keep for grid)
  filterAndRender();
}

function createResourceButtons(sermon) {
  let html = '';

  if (sermon.youtubeId) {
    html += `
      <a href="https://www.youtube.com/watch?v=${sermon.youtubeId}" target="_blank"
         class="resource-btn bg-red-100 hover:bg-red-200 text-red-700">
        <i class="fab fa-youtube"></i> Watch
      </a>`;
  }

  if (sermon.audioUrl) {
    html += `
      <a href="${sermon.audioUrl}" target="_blank"
         class="resource-btn bg-amber-100 hover:bg-amber-200 text-amber-700">
        <i class="fas fa-headphones"></i> Audio
      </a>`;
  }

  if (sermon.notesUrl) {
    html += `
      <a href="${sermon.notesUrl}" target="_blank"
         class="resource-btn bg-blue-100 hover:bg-blue-200 text-blue-700">
        <i class="fas fa-file-pdf"></i> Notes
      </a>`;
  }

  return html || '<span class="text-gray-400 text-xs italic">No resources yet</span>';
}

function renderCardView(filtered) {
  const container = document.getElementById('card-view');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-3 text-center py-12 text-gray-400">No sermons found.</div>`;
    return;
  }

  filtered.forEach(s => {
    const thumb = s.youtubeId
      ? `<img src="https://img.youtube.com/vi/${s.youtubeId}/mqdefault.jpg"
              class="w-full h-48 object-cover rounded-t-3xl" alt="${s.title}">`
      : '';

    container.innerHTML += `
      <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-all">
        ${thumb}
        <div class="p-7">
          <div class="flex justify-between mb-4">
            <span class="text-sm text-amber-600">${s.date}</span>
            ${s.duration ? `<span class="text-xs bg-amber-100 px-3 py-1 rounded-full">${s.duration}</span>` : ''}
          </div>
          <h3 class="font-semibold text-xl leading-tight mb-3">${s.title}</h3>
          <p class="text-gray-600 mb-6">${s.speaker}</p>
          <div class="flex flex-wrap gap-2 mb-6">${createResourceButtons(s)}</div>
          ${s.audioUrl ? `
          <audio controls class="w-full accent-amber-500 rounded-2xl">
            <source src="${s.audioUrl}" type="audio/mpeg">
          </audio>` : ''}
        </div>
      </div>`;
  });
}

function renderTableView(filtered) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-12 text-center text-gray-400">No sermons found.</td></tr>`;
    return;
  }

  const grouped = groupByMonthYear(filtered);

  Object.keys(grouped).forEach(monthYear => {
    const header = document.createElement('tr');
    header.className = 'bg-amber-50';
    header.innerHTML = `<td colspan="4" class="px-8 py-4 font-semibold text-[#0A3D62]">${monthYear}</td>`;
    tbody.appendChild(header);

    grouped[monthYear].forEach(s => {
      const row = `
        <tr class="hover:bg-amber-50 transition">
          <td class="px-8 py-5">${s.date}</td>
          <td class="px-8 py-5">${s.speaker}</td>
          <td class="px-8 py-5 font-medium">${s.title}</td>
          <td class="px-8 py-5">
            <div class="flex flex-wrap gap-2">${createResourceButtons(s)}</div>
          </td>
        </tr>`;
      tbody.innerHTML += row;
    });
  });
}

// ── Series View ───────────────────────────────────────────────────────────────

function renderSeriesView() {
  const grid   = document.getElementById('series-grid');
  const detail = document.getElementById('series-detail');
  grid.classList.remove('hidden');
  detail.classList.add('hidden');
  grid.innerHTML = '';

  if (allSeries.length === 0) {
    grid.innerHTML = `<div class="col-span-3 text-center py-12 text-gray-400">No series available.</div>`;
    return;
  }

  allSeries.forEach(s => {
    const sermonCount = allSermons.filter(m => m.seriesId === s.id).length;
    const thumb = s.imageUrl
      ? `<img src="${s.imageUrl}" class="w-full h-40 object-cover" alt="">`
      : `<div class="w-full h-40 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
           <i class="fas fa-layer-group text-white text-3xl opacity-60"></i>
         </div>`;

    grid.innerHTML += `
      <div onclick="showSeriesDetail('${s.id}')"
           class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-all cursor-pointer">
        ${thumb}
        <div class="p-6">
          <h3 class="font-bold text-lg text-[#0A3D62] mb-1">${s.title}</h3>
          ${s.description ? `<p class="text-sm text-gray-500 line-clamp-2 mb-3">${s.description}</p>` : ''}
          <span class="text-xs text-amber-600 font-medium">${sermonCount} sermon${sermonCount !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
  });
}

function showSeriesDetail(seriesId) {
  const s = allSeries.find(x => x.id === seriesId);
  if (!s) return;

  const grid   = document.getElementById('series-grid');
  const detail = document.getElementById('series-detail');
  grid.classList.add('hidden');
  detail.classList.remove('hidden');

  document.getElementById('series-detail-title').textContent = s.title;
  document.getElementById('series-detail-desc').textContent  = s.description || '';

  const seriesSermons = allSermons
    .filter(m => m.seriesId === seriesId)
    .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0) || (b.date || '').localeCompare(a.date || ''));

  const listEl = document.getElementById('series-sermons-list');
  if (seriesSermons.length === 0) {
    listEl.innerHTML = `<p class="text-gray-400 text-center py-8">No sermons in this series yet.</p>`;
    return;
  }

  listEl.innerHTML = '';
  seriesSermons.forEach((m, i) => {
    const thumb = m.youtubeId
      ? `<img src="https://img.youtube.com/vi/${m.youtubeId}/default.jpg" class="w-24 h-16 object-cover rounded-xl flex-shrink-0" alt="">`
      : `<div class="w-24 h-16 bg-gradient-to-br from-[#0A3D62] to-amber-500 rounded-xl flex-shrink-0 flex items-center justify-center">
           <i class="fas fa-play text-white text-xl opacity-60"></i>
         </div>`;
    listEl.innerHTML += `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <span class="text-2xl font-bold text-gray-200 w-8 text-center flex-shrink-0">${m.seriesOrder || (i + 1)}</span>
        ${thumb}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-900 truncate">${m.title}</p>
          <p class="text-sm text-gray-500">${m.speaker} · ${m.date}</p>
          <div class="flex flex-wrap gap-2 mt-2">${createResourceButtons(m)}</div>
        </div>
      </div>`;
  });
}

function showSeriesList() {
  document.getElementById('series-grid').classList.remove('hidden');
  document.getElementById('series-detail').classList.add('hidden');
}

// ── Shared render ─────────────────────────────────────────────────────────────

function monthYearKey(dateStr) {
  // A blank/missing date (e.g. an unrecognised YouTube import title left
  // unedited) would otherwise throw on .split() and blank out the whole
  // list — group those under "Undated" instead.
  if (!dateStr) return 'Undated';
  const [year, month] = dateStr.split('-');
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  return `${monthName} ${year}`;
}

function groupByMonthYear(sermonsList) {
  const groups = {};
  sermonsList.forEach(s => {
    const key = monthYearKey(s.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function filterAndRender() {
  if (currentView === 'series') {
    renderSeriesView();
    return;
  }
  const term = document.getElementById('search-input').value.toLowerCase().trim();
  const filtered = allSermons.filter(s =>
    s.title.toLowerCase().includes(term) ||
    s.speaker.toLowerCase().includes(term)
  );

  if (currentView === 'card') renderCardView(filtered);
  else renderTableView(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  setView('table');
  document.getElementById('search-input').addEventListener('input', filterAndRender);
  loadSermons();
});
