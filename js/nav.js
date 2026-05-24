// js/nav.js
// Loads the shared navigation partial into #nav-placeholder so the nav lives
// in ONE file (nav.html / admin-nav.html) instead of being duplicated on every page.

(function () {
  function initNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    const path = window.location.pathname;
    let navFile;
    if (path.includes('/admin/')) {
      navFile = '/admin-nav.html';
    } else if (path.includes('/members/')) {
      navFile = '/members-nav.html';
    } else {
      navFile = '/nav.html';
    }

    // Request as text/html so the service worker's network-first HTML strategy
    // handles it — that's what serves the partial from cache when offline.
    fetch(navFile, { headers: { Accept: 'text/html' } })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((html) => {
        placeholder.innerHTML = html;
        highlightActiveLink();
        // Tell main.js the nav DOM now exists so it can bind the mobile
        // toggle and auth-state buttons.
        document.dispatchEvent(new CustomEvent('nav-loaded'));
      })
      .catch((err) => {
        // Don't crash the page if the nav fails to load.
        console.error('Failed to load navigation:', err);
      });
  }

  function highlightActiveLink() {
    let current = window.location.pathname;
    if (current === '/' || current === '') current = '/index.html';

    document.querySelectorAll('#nav-placeholder a[href]').forEach((link) => {
      const linkPath = new URL(link.getAttribute('href'), window.location.origin).pathname;
      if (linkPath === current) {
        link.classList.remove('hover:text-amber-600', 'transition-colors');
        link.classList.add('text-amber-600', 'font-semibold');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
