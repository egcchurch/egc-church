// js/homepage.js — loads /homepage/content from Firestore and populates dynamic homepage sections

(function () {
  const DEFAULT_SERVICE_TIMES = [
    { label: 'Morning Service', day: 'Sunday', time: '10:00 AM' },
    { label: 'Prayer Meeting', day: 'Wednesday', time: '7:00 PM' },
  ];

  function waitForFirebase(cb) {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      cb();
    } else {
      setTimeout(() => waitForFirebase(cb), 100);
    }
  }

  function renderServiceTimes(times) {
    const grid = document.getElementById('service-times-grid');
    if (!grid) return;
    const list = times && times.length ? times : DEFAULT_SERVICE_TIMES;
    grid.innerHTML = list.map(t => `
      <div class="bg-white/10 rounded-2xl p-6">
        <p class="text-amber-300 font-semibold text-sm uppercase tracking-wider">${escHtml(t.day)}</p>
        <p class="text-2xl font-bold mt-2">${escHtml(t.time)}</p>
        <p class="text-blue-200 text-sm mt-1">${escHtml(t.label)}</p>
      </div>
    `).join('');
    document.getElementById('service-times-section')?.classList.remove('hidden');
  }

  function applyContent(data) {
    // Hero tagline
    const taglineEl = document.getElementById('hero-tagline');
    if (taglineEl && data.tagline) taglineEl.textContent = data.tagline;

    // Announcement
    if (data.announcement && data.announcement.visible) {
      const section = document.getElementById('announcement-section');
      const titleEl = document.getElementById('announcement-title');
      const bodyEl  = document.getElementById('announcement-body');
      if (section) {
        if (titleEl) titleEl.textContent = data.announcement.title || '';
        if (bodyEl)  bodyEl.textContent  = data.announcement.body  || '';
        section.classList.remove('hidden');
      }
    }

    renderServiceTimes(data.serviceTimes || []);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Render defaults immediately so the service times section is never blank
    renderServiceTimes([]);

    waitForFirebase(() => {
      firebase.firestore().collection('homepage').doc('content').get()
        .then(doc => { if (doc.exists) applyContent(doc.data()); })
        .catch(err => console.warn('Could not load homepage content:', err));
    });
  });
})();
