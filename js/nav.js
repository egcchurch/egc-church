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
        initHeroOverlay();
        // Load notifications and search in parallel, then fire nav-loaded.
        let loaded = 0;
        const onReady = () => { if (++loaded === 2) document.dispatchEvent(new CustomEvent('nav-loaded')); };

        const notifScript = document.createElement('script');
        notifScript.src = '/js/notifications.js';
        notifScript.onload = onReady;
        notifScript.onerror = onReady;
        document.head.appendChild(notifScript);

        const searchScript = document.createElement('script');
        searchScript.src = '/js/search.js';
        searchScript.onload = onReady;
        searchScript.onerror = onReady;
        document.head.appendChild(searchScript);
      })
      .catch((err) => {
        // Don't crash the page if the nav fails to load.
        console.error('Failed to load navigation:', err);
      });

    initFooter();
  }

  // Shared footer — public pages only. /admin/ and /members/ pages don't get
  // it, and only opt in by having a #footer-placeholder element at all.
  function initFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;

    const path = window.location.pathname;
    if (path.includes('/admin/') || path.includes('/members/')) return;

    fetch('/footer.html', { headers: { Accept: 'text/html' } })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((html) => {
        placeholder.innerHTML = html;
        const footerScript = document.createElement('script');
        footerScript.src = '/js/footer.js';
        document.head.appendChild(footerScript);
      })
      .catch((err) => {
        console.error('Failed to load footer:', err);
      });
  }

  function highlightActiveLink() {
    let current = window.location.pathname;
    if (current === '/' || current === '') current = '/index.html';

    document.querySelectorAll('#nav-placeholder a[href]').forEach((link) => {
      const linkPath = new URL(link.getAttribute('href'), window.location.origin).pathname;
      if (linkPath === current) {
        // nav.html (navy bg) uses amber-400; admin-nav.html/members-nav.html
        // (white bg) use amber-600 — pick the matching active-state shade.
        const isDarkNav = link.classList.contains('hover:text-amber-400');
        link.classList.remove('hover:text-amber-600', 'hover:text-amber-400', 'hover:bg-amber-50', 'transition-colors');
        link.classList.add(isDarkNav ? 'text-amber-400' : 'text-amber-600', 'font-semibold');
      }
    });

    // Highlight the dropdown trigger when browsing within that section
    const membersBtn = document.getElementById('members-nav-btn');
    if (membersBtn && current.startsWith('/members/')) {
      membersBtn.classList.add('text-amber-600', 'font-semibold');
    }
    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn && current.startsWith('/admin/')) {
      adminBtn.classList.add('text-amber-600', 'font-semibold');
    }
  }

  // On pages with a [data-hero-banner] element (a video/image/navy banner
  // sitting right under the nav, pulled up underneath it via a negative
  // margin in CSS — see the per-page <header> markup), nav.html starts
  // transparent and turns solid navy once that banner scrolls past it.
  // Pages without one (login, story, 404) just keep the solid navy default.
  function initHeroOverlay() {
    const nav = document.querySelector('#nav-placeholder nav');
    const hero = document.querySelector('[data-hero-banner]');
    if (!nav || !hero) return;

    const SOLID = ['bg-[#0A3D62]', 'border-white/10'];
    const TRANSPARENT = ['bg-transparent', 'border-transparent'];

    function update() {
      const solid = hero.getBoundingClientRect().bottom <= nav.offsetHeight;
      nav.classList.remove(...(solid ? TRANSPARENT : SOLID));
      nav.classList.add(...(solid ? SOLID : TRANSPARENT));
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
