// js/blog.js

let allPosts = [];

document.addEventListener('DOMContentLoaded', () => {
  waitForFirebase(() => loadPosts());
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
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
  const grid = document.getElementById('blog-grid');
  const empty = document.getElementById('blog-empty');

  grid.innerHTML = '';

  if (allPosts.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  allPosts.forEach((post) => {
    grid.insertAdjacentHTML('beforeend', buildCard(post));
  });
}

function buildCard(post) {
  const dateStr = formatDate(toDate(post.publishedAt));

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
