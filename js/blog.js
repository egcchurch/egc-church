// js/blog.js

let allPosts = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initFilterChips();
  waitForFirebase(() => loadPosts());
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

function initFilterChips() {
  document.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach((b) => {
        const active = b === btn;
        b.className = 'filter-chip px-4 py-1.5 rounded-full text-sm font-medium transition-all '
          + (active
            ? 'bg-[#0A3D62] text-white'
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50');
      });
      render();
    });
  });
}

function loadPosts() {
  const db = firebase.firestore();

  db.collection('blog')
    .where('published', '==', true)
    .orderBy('publishedAt', 'desc')
    .get()
    .then((snapshot) => {
      allPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      document.getElementById('loading').classList.add('hidden');
      render();
    })
    .catch((err) => {
      console.error('Error loading blog posts:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

function render() {
  const grid  = document.getElementById('blog-grid');
  const empty = document.getElementById('blog-empty');

  const filtered = activeFilter === 'all'
    ? allPosts
    : allPosts.filter((p) => (p.kind || 'article') === activeFilter);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach((post) => {
    grid.insertAdjacentHTML('beforeend', buildCard(post));
  });
}

function buildCard(post) {
  const dateStr = formatDate(toDate(post.publishedAt));
  const isAnnouncement = (post.kind || 'article') === 'announcement';

  const kindBadge = isAnnouncement
    ? `<span class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Announcement</span>`
    : '';

  const imageHtml = post.imageUrl
    ? `<img src="${post.imageUrl}" alt="${escHtml(post.title)}" class="w-full h-48 object-cover">`
    : `<div class="w-full h-48 bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center">
         <i class="fas fa-newspaper text-white text-4xl opacity-60"></i>
       </div>`;

  return `
    <div class="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100 flex flex-col">
      ${imageHtml}
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <i class="fas fa-calendar text-amber-500 w-4"></i>
          <span>${dateStr}</span>
          ${post.author ? `<span class="text-gray-300">&bull;</span><span>${escHtml(post.author)}</span>` : ''}
        </div>
        ${kindBadge ? `<div class="mb-2">${kindBadge}</div>` : ''}
        <h3 class="text-lg font-bold text-[#0A3D62] mb-2 leading-snug">${escHtml(post.title)}</h3>
        ${post.body ? `
        <p class="text-sm text-gray-600 leading-relaxed line-clamp-4 flex-1">${escHtml(post.body)}</p>
        ` : ''}
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

function formatDate(date) {
  return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
