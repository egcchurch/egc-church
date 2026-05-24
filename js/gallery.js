// js/gallery.js

let galleries = [];
const galleryById = {};

document.addEventListener('DOMContentLoaded', () => {
  waitForFirebase(() => loadGalleries());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

function loadGalleries() {
  const db = firebase.firestore();

  // Single equality filter (no composite index needed); published + sort handled client-side.
  db.collection('gallery')
    .where('audience', '==', 'public')
    .get()
    .then((snapshot) => {
      galleries = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((g) => g.published)
        .sort((a, b) => toDate(b.date) - toDate(a.date));

      galleries.forEach((g) => { galleryById[g.id] = g; });

      document.getElementById('loading').classList.add('hidden');
      render();
    })
    .catch((err) => {
      console.error('Error loading galleries:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

function render() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');

  grid.innerHTML = '';

  if (galleries.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  galleries.forEach((g) => {
    grid.insertAdjacentHTML('beforeend', buildCard(g));
  });
}

function buildCard(gallery) {
  const cover = gallery.thumbnailUrl || (gallery.imageUrls && gallery.imageUrls[0]) || '';
  const count = (gallery.imageUrls || []).length;
  const dateStr = gallery.date ? formatDate(toDate(gallery.date)) : '';

  const coverHtml = cover
    ? `<img src="${cover}" alt="${escHtml(gallery.title)}" class="w-full h-56 object-cover">`
    : `<div class="w-full h-56 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
         <i class="fas fa-images text-white text-4xl opacity-60"></i>
       </div>`;

  return `
    <button onclick="openLightbox('${gallery.id}')"
            class="text-left bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition group">
      <div class="relative">
        ${coverHtml}
        <span class="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          <i class="fas fa-image mr-1"></i>${count}
        </span>
      </div>
      <div class="p-5">
        <h3 class="text-lg font-bold text-[#0A3D62] leading-snug group-hover:text-amber-600 transition">${escHtml(gallery.title)}</h3>
        ${dateStr ? `<p class="text-sm text-gray-400 mt-1">${dateStr}</p>` : ''}
        ${gallery.description ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${escHtml(gallery.description)}</p>` : ''}
      </div>
    </button>
  `;
}

function openLightbox(id) {
  const gallery = galleryById[id];
  if (!gallery) return;

  document.getElementById('lightbox-title').textContent = gallery.title || 'Gallery';
  const count = (gallery.imageUrls || []).length;
  const dateStr = gallery.date ? formatDate(toDate(gallery.date)) : '';
  document.getElementById('lightbox-meta').textContent =
    [dateStr, count + (count === 1 ? ' photo' : ' photos')].filter(Boolean).join(' · ');

  const container = document.getElementById('lightbox-images');
  container.innerHTML = (gallery.imageUrls || [])
    .map((url) => `<img src="${url}" alt="${escHtml(gallery.title)}" class="w-full rounded-2xl" loading="lazy">`)
    .join('');

  if (count === 0) {
    container.innerHTML = '<p class="text-center text-gray-400 py-8">No images in this gallery yet.</p>';
  }

  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(value) {
  if (!value) return new Date(0);
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

function formatDate(date) {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
