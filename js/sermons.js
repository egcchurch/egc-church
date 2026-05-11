// js/sermons.js

const sermons = [
  {
    id: 1,
    title: "Walking by Faith, Not by Sight",
    date: "2025-04-06",
    speaker: "Pastor John Doe",
    audioUrl: "assets/audio/walking-by-faith.mp3",     // Change to your real file later
    notesUrl: "assets/notes/walking-by-faith.pdf",
    duration: "45 min"
  },
  {
    id: 2,
    title: "The Power of the Resurrection",
    date: "2025-04-02",
    speaker: "Pastor John Doe",
    audioUrl: "assets/audio/power-of-resurrection.mp3",
    notesUrl: null,
    duration: "52 min"
  },
  {
    id: 3,
    title: "Grace Upon Grace",
    date: "2025-03-23",
    speaker: "Evangelist Mark Smith",
    audioUrl: "assets/audio/grace-upon-grace.mp3",
    notesUrl: "assets/notes/grace-upon-grace.pdf",
    duration: "38 min"
  },
  {
    id: 4,
    title: "The Just Shall Live by Faith",
    date: "2025-03-16",
    speaker: "Pastor John Doe",
    audioUrl: "assets/audio/just-shall-live.mp3",
    notesUrl: null,
    duration: "41 min"
  }
];

let currentView = 'table';

function setView(view) {
  currentView = view;
  document.getElementById('card-view').classList.toggle('hidden', view !== 'card');
  document.getElementById('table-view').classList.toggle('hidden', view !== 'table');

  document.getElementById('card-btn').classList.toggle('active-view', view === 'card');
  document.getElementById('table-btn').classList.toggle('active-view', view === 'table');

  filterAndRender();
}

// Create Resource Buttons
function createResourceButtons(sermon) {
  let html = '';

  // Audio Button
  if (sermon.audioUrl && sermon.audioUrl !== "#") {
    html += `
      <a href="${sermon.audioUrl}" target="_blank" 
         class="resource-btn bg-amber-100 hover:bg-amber-200 text-amber-700">
        <i class="fas fa-headphones"></i> Audio
      </a>`;
  }

  // Notes Button
  if (sermon.notesUrl) {
    html += `
      <a href="${sermon.notesUrl}" target="_blank" 
         class="resource-btn bg-blue-100 hover:bg-blue-200 text-blue-700">
        <i class="fas fa-file-pdf"></i> Notes
      </a>`;
  }

  return html || '<span class="text-gray-400 text-xs italic">No resources available yet</span>';
}

function renderCardView(filtered) {
  const container = document.getElementById('card-view');
  container.innerHTML = '';

  filtered.forEach(s => {
    const card = `
      <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-all">
        <div class="p-7">
          <div class="flex justify-between mb-4">
            <span class="text-sm text-amber-600">${s.date}</span>
            <span class="text-xs bg-amber-100 px-3 py-1 rounded-full">${s.duration}</span>
          </div>
          <h3 class="font-semibold text-xl leading-tight mb-3">${s.title}</h3>
          <p class="text-gray-600 mb-6">${s.speaker}</p>

          <div class="flex flex-wrap gap-2 mb-6">
            ${createResourceButtons(s)}
          </div>

          ${s.audioUrl ? `
          <audio controls class="w-full accent-amber-500 rounded-2xl">
            <source src="${s.audioUrl}" type="audio/mpeg">
          </audio>` : ''}
        </div>
      </div>`;
    container.innerHTML += card;
  });
}

function renderTableView(filtered) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const grouped = groupByMonthYear(filtered);

  Object.keys(grouped).forEach(monthYear => {
    const header = document.createElement('tr');
    header.className = "bg-amber-50";
    header.innerHTML = `<td colspan="4" class="px-8 py-4 font-semibold text-[#0A3D62]">${monthYear}</td>`;
    tbody.appendChild(header);

    grouped[monthYear].forEach(s => {
      const row = `
        <tr class="hover:bg-amber-50 transition">
          <td class="px-8 py-5">${s.date}</td>
          <td class="px-8 py-5">${s.speaker}</td>
          <td class="px-8 py-5 font-medium">${s.title}</td>
          <td class="px-8 py-5">
            <div class="flex flex-wrap gap-2">
              ${createResourceButtons(s)}
            </div>
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
    const key = `${new Date(year, month-1).toLocaleString('default', { month: 'long' })} ${year}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return groups;
}

function filterAndRender() {
  const term = document.getElementById('search-input').value.toLowerCase().trim();
  const filtered = sermons.filter(s => 
    s.title.toLowerCase().includes(term) || 
    s.speaker.toLowerCase().includes(term)
  );

  if (currentView === 'card') renderCardView(filtered);
  else renderTableView(filtered);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setView('table');   // Default to Table View
  document.getElementById('search-input').addEventListener('input', filterAndRender);
});