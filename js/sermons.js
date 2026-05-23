// js/sermons.js

const db = firebase.firestore();
let allSermons = [];
let currentView = 'table';

// ── Load from Firestore ───────────────────────────────────────────────────────
function loadSermons() {
  db.collection('sermons')
    .where('published', '==', true)
    .orderBy('date', 'desc')
    .get()
    .then((snapshot) => {
      allSermons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  document.getElementById('card-view').classList.toggle('hidden', view !== 'card');
  document.getElementById('table-view').classList.toggle('hidden', view !== 'table');
  document.getElementById('card-btn').classList.toggle('active-view', view === 'card');
  document.getElementById('table-btn').classList.toggle('active-view', view === 'table');
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

function groupByMonthYear(sermonsList) {
  const groups = {};
  sermonsList.forEach(s => {
    const [year, month] = s.date.split('-');
    const key = `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function filterAndRender() {
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