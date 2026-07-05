// js/homepage.js — auth-aware adaptive homepage renderer

(function () {
  const DEFAULT_SERVICE_TIMES = [
    { label: 'Morning Service', day: 'Sunday',    time: '10:00 AM' },
    { label: 'Prayer Meeting',  day: 'Wednesday', time: '7:00 PM'  },
  ];

  let db;

  function waitForFirebase(cb) {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      cb();
    } else {
      setTimeout(() => waitForFirebase(cb), 100);
    }
  }

  // ── Static section renderers (service times + announcement) ───────────────
  // Called for all auth states so the hero area always has content.

  function renderServiceTimes(times) {
    const grid = document.getElementById('service-times-grid');
    if (!grid) return;
    const list = times && times.length ? times : DEFAULT_SERVICE_TIMES;
    grid.innerHTML = list.map(t => `
      <div class="bg-white/10 rounded-2xl p-6 border-l-2 border-amber-400">
        <p class="text-amber-300 font-semibold text-sm uppercase tracking-wider">${esc(t.day)}</p>
        <p class="text-2xl font-bold mt-2">${esc(t.time)}</p>
        <p class="text-blue-200 text-sm mt-1">${esc(t.label)}</p>
      </div>
    `).join('');
    document.getElementById('service-times-section')?.classList.remove('hidden');
  }

  function applyContent(data) {
    const taglineEl = document.getElementById('hero-tagline');
    if (taglineEl && data.tagline) taglineEl.textContent = data.tagline;

    if (data.announcement?.visible) {
      const section = document.getElementById('announcement-section');
      if (section) {
        document.getElementById('announcement-title').textContent = data.announcement.title || '';
        document.getElementById('announcement-body').textContent  = data.announcement.body  || '';
        section.classList.remove('hidden');
      }
    }

    renderServiceTimes(data.serviceTimes || []);
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  function loadAnnouncements(limit) {
    return db.collection('blog')
      .where('published', '==', true)
      .where('kind', '==', 'announcement')
      .orderBy('publishedAt', 'desc')
      .limit(limit)
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(() => []);
  }

  function loadTodaysDevotional() {
    return db.collection('devotionals')
      .orderBy('date', 'desc')
      .limit(1)
      .get()
      .then(snap => {
        if (snap.empty) return null;
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const docDate = toDate(d.date);
        const now     = new Date();
        const isToday = docDate.getFullYear() === now.getFullYear() &&
                        docDate.getMonth()     === now.getMonth()   &&
                        docDate.getDate()      === now.getDate();
        return isToday ? d : null;
      })
      .catch(() => null);
  }

  // Loads per-permission counts for the admin shortcuts strip.
  // Only called when Permissions.init(user) has already resolved.
  async function loadAdminCounts() {
    const counts = {};
    const jobs   = [];

    if (Permissions.hasPermission('users.approve')) {
      jobs.push(
        db.collection('users').where('membership', '==', 'pending').get()
          .then(s => { counts.pendingUsers = s.size; })
          .catch(() => {})
      );
    }
    if (Permissions.hasPermission('connect.view')) {
      jobs.push(
        db.collection('connect').where('read', '==', false).get()
          .then(s => { counts.unreadConnect = s.size; })
          .catch(() => {})
      );
    }
    if (Permissions.hasPermission('prayer.moderate')) {
      const cutoff = firebase.firestore.Timestamp.fromDate(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      jobs.push(
        db.collection('prayer').where('submittedAt', '>=', cutoff).get()
          .then(s => { counts.recentPrayer = s.size; })
          .catch(() => {})
      );
    }

    await Promise.all(jobs);
    return counts;
  }

  function loadLatestSermons(limit) {
    return db.collection('sermons')
      .where('published', '==', true)
      .orderBy('date', 'desc')
      .limit(limit)
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(() => []);
  }

  function renderLatestSermons(sermons) {
    const grid = document.getElementById('latest-sermons-grid');
    if (!grid) return;
    if (!sermons || !sermons.length) {
      grid.closest('[data-section="latestSermons"]').style.display = 'none';
      return;
    }
    grid.innerHTML = sermons.map(s => {
      const thumb = s.youtubeId
        ? `https://img.youtube.com/vi/${esc(s.youtubeId)}/hqdefault.jpg`
        : 'assets/images/icons/icon-192.png';
      return `
        <a href="/sermons.html" class="group bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 hover:shadow-md hover:border-amber-300 transition-all">
          <div class="aspect-video w-full overflow-hidden bg-zinc-200">
            <img src="${thumb}" alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          </div>
          <div class="p-4">
            <p class="font-semibold text-[#0A3D62] leading-snug line-clamp-2">${esc(s.title)}</p>
            <p class="text-xs text-gray-500 mt-1">${esc(s.speaker || '')}${s.speaker && s.date ? ' · ' : ''}${esc(s.date || '')}</p>
          </div>
        </a>`;
    }).join('');
  }

  function loadUpcomingEvents(limit) {
    const now = firebase.firestore.Timestamp.fromDate(new Date());
    return db.collection('events')
      .where('published', '==', true)
      .where('startDate', '>=', now)
      .orderBy('startDate', 'asc')
      .limit(limit)
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(() => []);
  }

  // ── Adaptive section ──────────────────────────────────────────────────────

  function setAdaptive(html) {
    const el = document.getElementById('adaptive-section');
    if (el) el.innerHTML = html;
  }

  // Visitor — not logged in
  function renderVisitor(content, announcements) {
    setAdaptive(
      buildLiveTeaser(content.liveStream, false) +
      buildAnnouncementsFeed(announcements) +
      `<section class="bg-[#0A3D62] py-14 px-6">
        <div class="max-w-4xl mx-auto text-center">
          <p class="text-amber-300 uppercase tracking-widest text-xs mb-3">Community</p>
          <h2 class="text-3xl font-bold text-white mb-4">Become part of the EGC family</h2>
          <p class="text-blue-200 mb-8 max-w-md mx-auto">Join us for worship, fellowship, and community. Register to access member resources.</p>
          <a href="/login.html"
             class="inline-block bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-medium transition-all">
            <i class="fas fa-user-plus mr-2"></i>Register or Sign In
          </a>
        </div>
      </section>`
    );
  }

  // Pending — logged in, awaiting approval
  function renderPending(user) {
    const verifyHtml = user.emailVerified ? '' :
      `<div class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 text-left">
        <i class="fas fa-envelope mr-2"></i>
        Your email address hasn't been verified yet.
        <button onclick="window._resendVerification()"
                class="ml-2 underline font-medium hover:text-amber-900 transition-colors">
          Resend verification email
        </button>
      </div>`;

    setAdaptive(
      `<section class="bg-zinc-50 py-14 px-6">
        <div class="max-w-2xl mx-auto">
          <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fas fa-clock text-amber-500 text-2xl"></i>
            </div>
            <h2 class="text-2xl font-bold text-[#0A3D62] mb-3">Your account is awaiting approval</h2>
            <p class="text-gray-500 max-w-sm mx-auto">Approvals usually happen within 24 hours. We'll email you when you're in.</p>
            ${verifyHtml}
            <button onclick="signOutAndClearCache()"
                    class="mt-8 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-sign-out-alt mr-1"></i>Sign out
            </button>
          </div>
        </div>
      </section>`
    );
  }

  // Public — logged in, approved but not yet member
  function renderPublic(user, content, announcements) {
    setAdaptive(
      buildLiveTeaser(content.liveStream, false) +
      buildAnnouncementsFeed(announcements) +
      `<section class="bg-amber-50 border-y border-amber-100 py-12 px-6">
        <div class="max-w-4xl mx-auto">
          <div class="bg-white rounded-3xl border border-amber-200 shadow-sm p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
            <div class="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <i class="fas fa-star text-amber-500 text-2xl"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-bold text-[#0A3D62] mb-2">Become a church member</h3>
              <p class="text-gray-500 text-sm mb-4">Members get access to live stream, direct messages, the prayer wall, devotionals, and the member directory.</p>
              <a href="/profile.html"
                 class="inline-block bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all">
                Request member access
              </a>
            </div>
          </div>
        </div>
      </section>`
    );
  }

  // Member — full dashboard (+ optional admin shortcuts strip)
  function renderMember(user, content, announcements, devotional, events, adminCounts) {
    setAdaptive(
      buildLiveBanner(content.liveStream, content.serviceTimes) +
      buildQuickLinks() +
      buildAdminShortcutsStrip(adminCounts) +
      buildNoticeBoardFeed(announcements) +
      buildDevotionalSnippet(devotional) +
      buildUpcomingEvents(events)
    );
  }

  // ── Component builders ────────────────────────────────────────────────────

  // Live stream teaser for visitor/public — compact bar
  function buildLiveTeaser(ls, isMember) {
    if (!ls || !ls.active) return '';
    const thumb   = `https://img.youtube.com/vi/${esc(ls.youtubeId)}/hqdefault.jpg`;
    const ctaText = isMember ? 'Watch Live' : 'Sign in to watch';
    const ctaHref = isMember ? '/members/live.html' : '/login.html';
    return `
      <section class="bg-red-600 py-4 px-6">
        <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <img src="${thumb}" alt="" class="w-24 h-16 object-cover rounded-lg shrink-0">
          <div class="flex-1 text-center sm:text-left">
            <p class="text-red-200 text-xs font-semibold uppercase tracking-widest mb-1">
              <i class="fas fa-circle animate-pulse mr-1"></i>Live Now
            </p>
            <p class="text-white font-bold">${esc(ls.title || 'Live Stream')}</p>
          </div>
          <a href="${ctaHref}"
             class="shrink-0 bg-white text-red-600 hover:bg-red-50 px-5 py-2 rounded-full text-sm font-semibold transition-all">
            ${ctaText}
          </a>
        </div>
      </section>`;
  }

  // Returns the next upcoming occurrence of a service time entry.
  // day is a string like "Sunday" / "Wednesday"; time is "10:00 AM" / "7:00 PM".
  function nextOccurrence(dayStr, timeStr) {
    const DAY_MAP = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
    const targetDay = DAY_MAP[dayStr.toLowerCase()];
    if (targetDay === undefined) return Infinity;

    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return Infinity;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;

    const now = new Date();
    const nowDay = now.getDay();
    let daysAhead = (targetDay - nowDay + 7) % 7;
    // If it's the same day, check if the time has already passed
    if (daysAhead === 0) {
      const serviceMinutes = h * 60 + m;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes >= serviceMinutes) daysAhead = 7;
    }
    const next = new Date(now);
    next.setDate(now.getDate() + daysAhead);
    next.setHours(h, m, 0, 0);
    return next;
  }

  // Full live banner for member state — larger, with next-service fallback
  function buildLiveBanner(ls, serviceTimes) {
    if (ls && ls.active) {
      const thumb = `https://img.youtube.com/vi/${esc(ls.youtubeId)}/hqdefault.jpg`;
      return `
        <section class="bg-red-600 py-6 px-6">
          <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-5">
            <img src="${thumb}" alt="" class="w-32 h-20 object-cover rounded-xl shrink-0 shadow-lg">
            <div class="flex-1 text-center sm:text-left">
              <p class="text-red-200 text-xs font-semibold uppercase tracking-widest mb-1">
                <i class="fas fa-circle animate-pulse mr-1"></i>Live Now
              </p>
              <p class="text-white text-xl font-bold">${esc(ls.title || 'Live Stream')}</p>
            </div>
            <a href="/members/live.html"
               class="shrink-0 bg-white text-red-600 hover:bg-red-50 px-6 py-3 rounded-full font-semibold transition-all">
              <i class="fas fa-play mr-2"></i>Watch Live
            </a>
          </div>
        </section>`;
    }

    // Filter to streamed services only, then pick the soonest upcoming one.
    // DEFAULT_SERVICE_TIMES have no streamed field — treat all as streamed.
    // Firestore times with streamed:false are filtered out; if none are streamed, show nothing.
    const allTimes = serviceTimes && serviceTimes.length ? serviceTimes : DEFAULT_SERVICE_TIMES;
    const usingFirestore = !!(serviceTimes && serviceTimes.length);
    const eligible = usingFirestore ? allTimes.filter(t => t.streamed === true) : allTimes;
    if (!eligible.length) return '';
    const candidates = eligible.map(t => ({ t, next: nextOccurrence(t.day, t.time) }));
    candidates.sort((a, b) => a.next - b.next);
    const next = candidates[0].t;

    return `
      <section class="bg-[#0A3D62] py-8 px-6">
        <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p class="text-blue-300 text-sm uppercase tracking-widest mb-1">Next service</p>
            <p class="text-white text-xl font-bold">${esc(next.day)} — ${esc(next.time)}</p>
            <p class="text-blue-200 text-sm">${esc(next.label)}</p>
          </div>
          <a href="/members/live.html"
             class="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-full text-sm font-medium transition-all">
            <i class="fas fa-tv mr-2"></i>Go to live page
          </a>
        </div>
      </section>`;
  }

  function buildAnnouncementsFeed(announcements) {
    if (!announcements || !announcements.length) return '';
    return `
      <section class="bg-white py-12 px-6">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-[#0A3D62]">Latest Announcements</h2>
            <a href="/blog.html" class="text-sm text-amber-600 hover:text-amber-700 font-medium">View all →</a>
          </div>
          <div class="space-y-4">
            ${announcements.map(p => `
              <div class="border border-gray-100 rounded-2xl p-5">
                <p class="font-semibold text-[#0A3D62]">${esc(p.title)}</p>
                ${p.body ? `<p class="text-sm text-gray-500 mt-1 line-clamp-2">${esc(p.body)}</p>` : ''}
                <p class="text-xs text-gray-400 mt-2">${formatDate(toDate(p.publishedAt))}</p>
              </div>`).join('')}
          </div>
        </div>
      </section>`;
  }

  function buildNoticeBoardFeed(announcements) {
    if (!announcements || !announcements.length) return '';

    const items = announcements.map(p => `
          <div class="border border-gray-100 rounded-2xl p-5">
            <p class="font-semibold text-[#0A3D62]">${esc(p.title)}</p>
            ${p.body ? `<p class="text-sm text-gray-500 mt-1 line-clamp-3">${esc(p.body)}</p>` : ''}
            <p class="text-xs text-gray-400 mt-2">${formatDate(toDate(p.publishedAt))}</p>
          </div>`).join('');

    return `
      <section class="bg-white py-12 px-6">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-[#0A3D62]">Reports</h2>
            <a href="/blog.html" class="text-sm text-amber-600 hover:text-amber-700 font-medium">View all →</a>
          </div>
          <div class="space-y-4">${items}</div>
        </div>
      </section>`;
  }

  function buildDevotionalSnippet(d) {
    if (!d) return '';
    const words   = (d.body || '').split(' ');
    const snippet = words.slice(0, 30).join(' ') + (words.length > 30 ? '…' : '');
    return `
      <section class="bg-amber-50 border-y border-amber-100 py-12 px-6">
        <div class="max-w-4xl mx-auto">
          <p class="text-amber-600 text-xs font-semibold uppercase tracking-widest mb-3">Today's Devotional</p>
          <h3 class="text-xl font-bold text-[#0A3D62] mb-2">${esc(d.title)}</h3>
          ${d.scripture ? `<p class="text-sm text-amber-700 italic mb-3">${esc(d.scripture)}</p>` : ''}
          ${snippet     ? `<p class="text-gray-600 text-sm leading-relaxed mb-4">${esc(snippet)}</p>` : ''}
          <a href="/members/devotional.html" class="text-amber-600 hover:text-amber-700 text-sm font-medium">
            Read full devotional →
          </a>
        </div>
      </section>`;
  }

  function buildQuickLinks() {
    return `
      <section class="bg-zinc-50 py-8 px-6 border-b border-gray-100">
        <div class="max-w-4xl mx-auto">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <a href="/members/messages.html"
               class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-amber-300 transition-all text-center group">
              <div class="w-10 h-10 bg-[#0A3D62]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0A3D62]/20 transition-colors">
                <i class="fas fa-comment-dots text-amber-500"></i>
              </div>
              <span class="text-xs font-semibold text-[#0A3D62]">Messages</span>
            </a>
            <a href="/members/prayer.html"
               class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-amber-300 transition-all text-center group">
              <div class="w-10 h-10 bg-[#0A3D62]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0A3D62]/20 transition-colors">
                <i class="fas fa-praying-hands text-amber-500"></i>
              </div>
              <span class="text-xs font-semibold text-[#0A3D62]">Prayer</span>
            </a>
            <a href="/members/directory.html"
               class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-amber-300 transition-all text-center group">
              <div class="w-10 h-10 bg-[#0A3D62]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0A3D62]/20 transition-colors">
                <i class="fas fa-users text-amber-500"></i>
              </div>
              <span class="text-xs font-semibold text-[#0A3D62]">Directory</span>
            </a>
            <a href="/members/groups.html"
               class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-amber-300 transition-all text-center group">
              <div class="w-10 h-10 bg-[#0A3D62]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0A3D62]/20 transition-colors">
                <i class="fas fa-layer-group text-amber-500"></i>
              </div>
              <span class="text-xs font-semibold text-[#0A3D62]">Groups</span>
            </a>
          </div>
        </div>
      </section>`;
  }

  function buildAdminShortcutsStrip(adminCounts) {
    if (!adminCounts) return '';
    const items = [];

    if ('pendingUsers' in adminCounts) {
      items.push(`
        <a href="/admin/users.html"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-amber-300 transition-all group">
          <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
            <i class="fas fa-user-check text-amber-600 text-sm"></i>
          </div>
          <div>
            <p class="text-2xl font-bold text-[#0A3D62] leading-none">${adminCounts.pendingUsers}</p>
            <p class="text-xs text-gray-500 mt-0.5">Pending approvals</p>
          </div>
        </a>`);
    }
    if ('unreadConnect' in adminCounts) {
      items.push(`
        <a href="/admin/connect.html"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-amber-300 transition-all group">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
            <i class="fas fa-inbox text-blue-600 text-sm"></i>
          </div>
          <div>
            <p class="text-2xl font-bold text-[#0A3D62] leading-none">${adminCounts.unreadConnect}</p>
            <p class="text-xs text-gray-500 mt-0.5">Unread connect forms</p>
          </div>
        </a>`);
    }
    if ('recentPrayer' in adminCounts) {
      items.push(`
        <a href="/admin/prayer.html"
           class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-amber-300 transition-all group">
          <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-purple-200 transition-colors">
            <i class="fas fa-praying-hands text-purple-600 text-sm"></i>
          </div>
          <div>
            <p class="text-2xl font-bold text-[#0A3D62] leading-none">${adminCounts.recentPrayer}</p>
            <p class="text-xs text-gray-500 mt-0.5">Prayer requests (7 days)</p>
          </div>
        </a>`);
    }

    if (!items.length) return '';
    return `
      <section class="bg-blue-50 border-b border-blue-100 py-6 px-6">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center gap-2 mb-4">
            <i class="fas fa-bolt text-amber-500 text-sm"></i>
            <span class="text-xs font-semibold text-gray-500 uppercase tracking-widest">Admin Overview</span>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">${items.join('')}</div>
        </div>
      </section>`;
  }

  function buildUpcomingEvents(events) {
    if (!events || !events.length) return '';
    return `
      <section class="bg-white py-12 px-6 border-b border-gray-100">
        <div class="max-w-4xl mx-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-[#0A3D62]">Upcoming Events</h2>
            <a href="/events.html" class="text-sm text-amber-600 hover:text-amber-700 font-medium">View all →</a>
          </div>
          <div class="space-y-3">
            ${events.map(e => {
              const d = toDate(e.startDate);
              return `
                <div class="flex items-start gap-4 p-4 border border-gray-100 rounded-2xl">
                  <div class="bg-amber-100 rounded-xl p-3 shrink-0 text-center min-w-[52px]">
                    <p class="text-amber-700 font-bold text-sm leading-none">${d.getDate()}</p>
                    <p class="text-amber-600 text-xs">${d.toLocaleString('en-ZA', { month: 'short' })}</p>
                  </div>
                  <div>
                    <p class="font-semibold text-[#0A3D62]">${esc(e.title)}</p>
                    ${e.location ? `<p class="text-sm text-gray-500"><i class="fas fa-map-marker-alt text-amber-400 mr-1"></i>${esc(e.location)}</p>` : ''}
                    <p class="text-xs text-gray-400 mt-1">${formatDate(d)}</p>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </section>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  window._resendVerification = function () {
    const user = firebase.auth().currentUser;
    if (!user) return;
    user.sendEmailVerification()
      .then(() => alert('Verification email sent. Please check your inbox.'))
      .catch(err => alert('Could not send email: ' + err.message));
  };

  function toDate(value) {
    if (!value) return new Date(0);
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
  }

  function formatDate(date) {
    return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  // The adaptive section depends on BOTH auth state and /homepage/content, and
  // the content doc is watched with a real-time listener (not a one-time get)
  // so the live-stream banner appears/disappears the moment
  // checkYoutubeLiveStatus writes — including on an already-open page or a PWA
  // resumed from memory. Whichever of the two arrives last triggers the
  // render; later snapshots re-render with the same auth state. A sequence
  // counter drops the results of a superseded in-flight render so overlapping
  // async renders can't finish out of order.

  let latestContent = null;   // null = first snapshot not yet received
  let authUser = null;
  let authKnown = false;      // onAuthStateChanged fired at least once
  let renderSeq = 0;

  function maybeRenderAdaptive() {
    if (!authKnown || latestContent === null) return;
    renderAdaptive(authUser, latestContent);
  }

  async function renderAdaptive(user, content) {
    const seq = ++renderSeq;
    try {
      if (!user) {
        const announcements = await loadAnnouncements(2);
        if (seq !== renderSeq) return;
        renderVisitor(content, announcements);
        return;
      }

      const userSnap = await db.collection('users').doc(user.uid).get();
      const userData  = userSnap.exists ? userSnap.data() : {};
      const membership = userData.membership || 'pending';

      if (membership === 'pending') {
        if (seq !== renderSeq) return;
        renderPending(user);
      } else if (membership === 'public') {
        const announcements = await loadAnnouncements(2);
        if (seq !== renderSeq) return;
        renderPublic(user, content, announcements);
      } else {
        // member
        await (typeof Permissions !== 'undefined' ? Permissions.init(user) : Promise.resolve());
        const hasAdminPerm = typeof Permissions !== 'undefined' && (
          Permissions.hasPermission('users.approve') ||
          Permissions.hasPermission('connect.view')  ||
          Permissions.hasPermission('prayer.moderate')
        );
        const [announcements, devotional, events, adminCounts] = await Promise.all([
          loadAnnouncements(5),
          loadTodaysDevotional(),
          loadUpcomingEvents(2),
          hasAdminPerm ? loadAdminCounts() : Promise.resolve(null),
        ]);
        if (seq !== renderSeq) return;
        renderMember(user, content, announcements, devotional, events, adminCounts);
      }
    } catch (err) {
      console.warn('Homepage render error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderServiceTimes([]); // show defaults immediately; Firestore data replaces shortly after

    waitForFirebase(() => {
      db = firebase.firestore();

      // Public sections — load for all visitors regardless of auth state
      loadLatestSermons(3).then(renderLatestSermons);

      db.collection('homepage').doc('content').onSnapshot((doc) => {
        latestContent = doc.exists ? doc.data() : {};
        applyContent(latestContent);
        maybeRenderAdaptive();
      }, () => {
        // Listener failed (offline, rules) — render with empty content rather
        // than leaving the adaptive section blank forever.
        if (latestContent === null) latestContent = {};
        maybeRenderAdaptive();
      });

      firebase.auth().onAuthStateChanged((user) => {
        authUser = user;
        authKnown = true;
        maybeRenderAdaptive();
      });
    });
  });
})();
