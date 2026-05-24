// js/about.js

let teamMembers = [];

document.addEventListener('DOMContentLoaded', () => {
  waitForFirebase(() => loadTeam());
});

function waitForFirebase(callback) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    callback();
  } else {
    setTimeout(() => waitForFirebase(callback), 100);
  }
}

function loadTeam() {
  const db = firebase.firestore();

  db.collection('team')
    .orderBy('order', 'asc')
    .get()
    .then((snapshot) => {
      teamMembers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      document.getElementById('loading').classList.add('hidden');
      render();
    })
    .catch((err) => {
      console.error('Error loading team:', err);
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('error-msg').classList.remove('hidden');
    });
}

function render() {
  const grid = document.getElementById('team-grid');
  const empty = document.getElementById('team-empty');

  grid.innerHTML = '';

  if (teamMembers.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  teamMembers.forEach((member) => {
    grid.insertAdjacentHTML('beforeend', buildCard(member));
  });
}

function buildCard(member) {
  const photoHtml = member.photoUrl
    ? `<img src="${member.photoUrl}" alt="${escHtml(member.name)}" class="w-32 h-32 rounded-full object-cover mx-auto mb-5 shadow">`
    : `<div class="w-32 h-32 rounded-full bg-gradient-to-br from-[#0A3D62] to-amber-500 flex items-center justify-center mx-auto mb-5 shadow">
         <i class="fas fa-user text-white text-4xl opacity-70"></i>
       </div>`;

  return `
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center flex flex-col">
      ${photoHtml}
      <h3 class="text-lg font-bold text-[#0A3D62]">${escHtml(member.name)}</h3>
      ${member.role ? `<p class="text-sm font-medium text-amber-600 mb-3">${escHtml(member.role)}</p>` : '<div class="mb-3"></div>'}
      ${member.bio ? `<p class="text-sm text-gray-600 leading-relaxed">${escHtml(member.bio)}</p>` : ''}
    </div>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
