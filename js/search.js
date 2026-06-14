// js/search.js
// Global content search overlay.
// Opens on Ctrl+K / Cmd+K, the "/" key (when not in a text field), or the nav magnifier button.
// Fetches published sermons, events, and blog posts from Firestore on first open (session-cached).
// Client-side substring match — no external search service needed at church scale.

(function () {
  let overlay      = null;
  let searchInput  = null;
  let resultsEl    = null;
  let cache        = null;   // { sermons, events, blog }
  let activeIndex  = -1;
  let currentItems = [];     // flat list of result objects for keyboard nav

  // ── Overlay DOM ───────────────────────────────────────────────────────────────

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 z-[200] flex items-start justify-center pt-20 px-4 hidden';
    overlay.innerHTML = `
      <div id="search-modal"
           class="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-zinc-100">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          <i class="fas fa-magnifying-glass text-gray-400 shrink-0 text-sm"></i>
          <input id="search-input" type="search" placeholder="Search sermons, events, blog posts…"
                 autocomplete="off" spellcheck="false"
                 class="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400">
          <kbd class="hidden md:inline-flex text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>
        <div id="search-results" class="max-h-[26rem] overflow-y-auto py-2"></div>
      </div>`;

    document.body.appendChild(overlay);
    searchInput = overlay.querySelector('#search-input');
    resultsEl   = overlay.querySelector('#search-results');

    overlay.addEventListener('click', (e) => {
      if (!document.getElementById('search-modal').contains(e.target)) close();
    });

    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(searchInput.value.trim()), 150);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape')    { e.preventDefault(); close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); moveActive(-1); }
      if (e.key === 'Enter')     { e.preventDefault(); activateCurrent(); }
    });
  }

  // ── Open / close ──────────────────────────────────────────────────────────────

  function open() {
    createOverlay();
    overlay.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
    currentItems = [];
    activeIndex  = -1;
    showEmpty();
    if (!cache) loadData();
  }

  function close() {
    overlay?.classList.add('hidden');
    activeIndex = -1;
  }

  // ── Data loading (session-cached) ─────────────────────────────────────────────

  async function loadData() {
    resultsEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Loading…</p>';
    try {
      if (typeof firebase === 'undefined') return;
      const db = firebase.firestore();
      const [sermonsSnap, eventsSnap, blogSnap] = await Promise.all([
        db.collection('sermons').where('published', '==', true).orderBy('date', 'desc').limit(200).get(),
        db.collection('events').where('published', '==', true).orderBy('startDate', 'asc').limit(100).get(),
        db.collection('blog').where('published', '==', true).orderBy('publishedAt', 'desc').limit(100).get(),
      ]);
      cache = {
        sermons: sermonsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        events:  eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        blog:    blogSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      };
      if (searchInput && searchInput.value.trim()) {
        runSearch(searchInput.value.trim());
      } else {
        showEmpty();
      }
    } catch {
      resultsEl.innerHTML = '<p class="text-xs text-red-400 text-center py-6">Could not load content.</p>';
    }
  }

  // ── Search logic ──────────────────────────────────────────────────────────────

  function hits(item, q) {
    const lq = q.toLowerCase();
    return [item.title, item.speaker, item.author, item.description, item.body, item.location]
      .some(f => typeof f === 'string' && f.toLowerCase().includes(lq));
  }

  function runSearch(q) {
    if (!q) { showEmpty(); return; }
    if (!cache) {
      resultsEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Loading…</p>';
      return;
    }

    const sermons = cache.sermons.filter(s => hits(s, q)).slice(0, 4);
    const events  = cache.events.filter(e => hits(e, q)).slice(0, 4);
    const blog    = cache.blog.filter(b => hits(b, q)).slice(0, 4);

    currentItems = [];
    let html = '';

    if (sermons.length) html += section('Sermons', sermons.map(s => ({
      icon: 'fa-microphone', label: 'Sermon',
      title: s.title,
      sub:   [s.speaker, s.date].filter(Boolean).join(' · '),
      url:   '/sermons.html',
      iconBg: 'bg-blue-50 text-blue-600',
    })));

    if (events.length) html += section('Events', events.map(e => ({
      icon: 'fa-calendar-days', label: 'Event',
      title: e.title,
      sub:   e.startDate?.toDate ? e.startDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      url:   '/events.html',
      iconBg: 'bg-amber-50 text-amber-600',
    })));

    if (blog.length) html += section('Blog', blog.map(b => ({
      icon: 'fa-newspaper', label: 'Post',
      title: b.title,
      sub:   b.publishedAt?.toDate ? b.publishedAt.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      url:   '/blog.html',
      iconBg: 'bg-green-50 text-green-600',
    })));

    if (!html) {
      html = `<p class="text-xs text-gray-400 text-center py-8">No results for "<strong>${esc(q)}</strong>"</p>`;
    }

    resultsEl.innerHTML = html;
    activeIndex = -1;

    resultsEl.querySelectorAll('[data-idx]').forEach(el => {
      el.addEventListener('click', () => go(parseInt(el.dataset.idx, 10)));
      el.addEventListener('mouseenter', () => setActive(parseInt(el.dataset.idx, 10)));
    });
  }

  function section(label, items) {
    const rows = items.map(item => {
      const idx = currentItems.push(item) - 1;
      return `
        <button data-idx="${idx}"
                class="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50 transition-colors text-left">
          <div class="w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0">
            <i class="fas ${item.icon} text-xs"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">${esc(item.title || '')}</p>
            <p class="text-xs text-gray-400 truncate">${esc(item.sub || '')}</p>
          </div>
          <span class="text-[10px] text-gray-400 shrink-0 border border-gray-100 rounded px-1.5 py-0.5">${esc(item.label)}</span>
        </button>`;
    }).join('');
    return `
      <p class="px-5 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">${label}</p>
      ${rows}`;
  }

  function showEmpty() {
    resultsEl.innerHTML = `
      <div class="text-center py-10 text-gray-400">
        <i class="fas fa-magnifying-glass text-2xl mb-2.5 block opacity-25"></i>
        <p class="text-xs">Search sermons, events, and blog posts</p>
        <p class="text-[10px] mt-1 opacity-60">
          Press <kbd class="border border-gray-200 rounded px-1 font-mono">↵</kbd> to go to the top result
          &nbsp;·&nbsp;
          <kbd class="border border-gray-200 rounded px-1 font-mono">ESC</kbd> to close
        </p>
      </div>`;
    currentItems = [];
    activeIndex  = -1;
  }

  // ── Keyboard nav ──────────────────────────────────────────────────────────────

  function moveActive(dir) {
    if (!currentItems.length) return;
    setActive(Math.max(0, Math.min(currentItems.length - 1, activeIndex + dir)));
  }

  function setActive(idx) {
    activeIndex = idx;
    resultsEl.querySelectorAll('[data-idx]').forEach(el => {
      el.classList.toggle('bg-zinc-100', parseInt(el.dataset.idx, 10) === idx);
    });
    resultsEl.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function activateCurrent() {
    const target = activeIndex >= 0 ? currentItems[activeIndex] : currentItems[0];
    if (target?.url) go(currentItems.indexOf(target));
  }

  function go(idx) {
    const item = currentItems[idx];
    if (item?.url) { close(); window.location.href = item.url; }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }

  // ── Global keyboard shortcuts ─────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      overlay && !overlay.classList.contains('hidden') ? close() : open();
      return;
    }
    if (e.key === '/' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA' &&
        document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      open();
    }
  });

  window.openSearch = open;
})();
