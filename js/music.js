// js/music.js

let allTracks = [];
let activeCategory = 'all';

const CATEGORY_LABELS = {
  worship: 'Worship',
  choir: 'Choir',
  original: 'Original',
  instrumental: 'Instrumental',
};

const CATEGORY_COLORS = {
  worship: 'bg-blue-100 text-blue-700',
  choir: 'bg-green-100 text-green-700',
  original: 'bg-amber-100 text-amber-700',
  instrumental: 'bg-purple-100 text-purple-700',
};

document.addEventListener('DOMContentLoaded', () => {
  waitForFirebase(() => loadTracks());
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

function loadTracks() {
  const db = firebase.firestore();

  // Single equality filter (no composite index); sort client-side.
  db.collection('music')
    .where('published', '==', true)
    .get()
    .then((snapshot) => {
      allTracks = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => toDate(b.releaseDate) - toDate(a.releaseDate));
      document.getElementById('loading').classList.add('hidden');
      render();
    })
    .catch((err) => {
      console.error('Error loading music:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

function setCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.category-btn').forEach((btn) => btn.classList.remove('active'));
  document.getElementById('filter-' + cat).classList.add('active');
  render();
}

function render() {
  const grid = document.getElementById('music-grid');
  const empty = document.getElementById('music-empty');

  const tracks = activeCategory === 'all'
    ? allTracks
    : allTracks.filter((t) => t.category === activeCategory);

  grid.innerHTML = '';

  if (tracks.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tracks.forEach((track) => {
    grid.insertAdjacentHTML('beforeend', buildCard(track));
  });
}

function buildCard(track) {
  const badge = CATEGORY_LABELS[track.category] || track.category || '';
  const badgeClass = CATEGORY_COLORS[track.category] || 'bg-gray-100 text-gray-600';

  const coverHtml = track.coverArtUrl
    ? `<img src="${track.coverArtUrl}" alt="${escHtml(track.title)}" class="w-full h-48 object-cover">`
    : `<div class="w-full h-48 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
         <i class="fas fa-music text-white text-4xl opacity-60"></i>
       </div>`;

  const albumLine = [track.albumName, track.durationSeconds ? formatDuration(track.durationSeconds) : '']
    .filter(Boolean).join(' · ');

  const download = (track.downloadable !== false && track.audioUrl)
    ? `<a href="${track.audioUrl}" target="_blank" rel="noopener" download
          class="text-sm text-amber-600 hover:text-amber-700 font-medium whitespace-nowrap">
         <i class="fas fa-download mr-1"></i>Download
       </a>`
    : '';

  return `
    <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 flex flex-col">
      ${coverHtml}
      <div class="p-5 flex flex-col flex-1">
        <span class="self-start text-xs font-semibold px-3 py-1 rounded-full ${badgeClass} mb-3">${badge}</span>
        <h3 class="text-lg font-bold text-[#0A3D62] leading-snug">${escHtml(track.title)}</h3>
        ${track.artist ? `<p class="text-sm text-gray-500">${escHtml(track.artist)}</p>` : ''}
        ${albumLine ? `<p class="text-xs text-gray-400 mt-1">${escHtml(albumLine)}</p>` : ''}
        ${track.description ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${escHtml(track.description)}</p>` : ''}
        ${track.audioUrl ? `<audio controls preload="none" src="${track.audioUrl}" class="w-full mt-4"></audio>` : ''}
        <div class="mt-3">${download}</div>
      </div>
    </div>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(value) {
  if (!value) return new Date(0);
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
