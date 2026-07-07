// js/footer.js — populates the shared public footer (footer.html) with
// church identity, contact info, and service times.
// Loaded dynamically by js/nav.js, only on public pages, after footer.html
// has been injected into #footer-placeholder. Firestore reads only — never
// blocks rendering, and falls back gracefully if /config/church or
// /homepage/content doesn't exist (or church-config.js isn't on the page).

(function () {
  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function waitForFirebase(cb) {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      cb();
    } else {
      setTimeout(() => waitForFirebase(cb), 100);
    }
  }

  function applyChurchInfo(data) {
    const fallbackName  = (typeof churchConfig !== 'undefined' && churchConfig.name) || 'Emmanuel Gospel Centre';
    const fallbackShort = (typeof churchConfig !== 'undefined' && churchConfig.shortName) || 'EGC';

    const nameEl = document.getElementById('footer-church-name');
    if (nameEl) nameEl.textContent = (data && data.displayName) || fallbackName;

    const taglineEl = document.getElementById('footer-tagline');
    if (taglineEl) taglineEl.textContent = (data && data.tagline) || fallbackShort;

    if (!data) return;

    if (data.address) {
      const addrEl = document.getElementById('footer-address');
      if (addrEl) { addrEl.textContent = data.address; addrEl.classList.remove('hidden'); }
      const dirEl = document.getElementById('footer-directions');
      if (dirEl) { dirEl.href = 'https://maps.google.com/?q=' + encodeURIComponent(data.address); dirEl.classList.remove('hidden'); }
    }
    if (data.secondAddress) {
      const labelEl = document.getElementById('footer-second-address-label');
      if (labelEl) { labelEl.textContent = data.secondAddressLabel || 'Second Location'; labelEl.classList.remove('hidden'); }
      const addrEl = document.getElementById('footer-second-address');
      if (addrEl) { addrEl.textContent = data.secondAddress; addrEl.classList.remove('hidden'); }
      const dirEl = document.getElementById('footer-second-directions');
      if (dirEl) { dirEl.href = 'https://maps.google.com/?q=' + encodeURIComponent(data.secondAddress); dirEl.classList.remove('hidden'); }
    }
    if (data.phone) {
      const phoneEl = document.getElementById('footer-phone');
      if (phoneEl) { phoneEl.textContent = data.phone; phoneEl.classList.remove('hidden'); }
    }
    if (data.email) {
      const emailEl = document.getElementById('footer-email');
      if (emailEl) { emailEl.textContent = data.email; emailEl.href = 'mailto:' + data.email; emailEl.classList.remove('hidden'); }
    }
  }

  function applyServiceTimes(times) {
    const el = document.getElementById('footer-service-times');
    if (!el || !times || !times.length) return;
    el.innerHTML = times.map((t) =>
      `<p class="text-blue-200 text-sm">${esc(t.day)} &middot; ${esc(t.time)}</p>`
    ).join('');
  }

  function applyYear() {
    const el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  applyYear();

  waitForFirebase(() => {
    const db = firebase.firestore();
    Promise.all([
      db.collection('config').doc('church').get().catch(() => null),
      db.collection('homepage').doc('content').get().catch(() => null),
    ]).then(([churchSnap, homepageSnap]) => {
      applyChurchInfo(churchSnap && churchSnap.exists ? churchSnap.data() : null);
      const homepageData = homepageSnap && homepageSnap.exists ? homepageSnap.data() : null;
      if (homepageData) applyServiceTimes(homepageData.serviceTimes);
    });
  });
})();
