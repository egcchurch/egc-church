// js/branham-sermons.js — renders the William Branham sermon list on
// fulfillment-of-prophecy.html. Recordings/transcripts are courtesy of
// Voice of God Recordings; pdfUrl/audioUrl are filled in once a superadmin
// uploads each file via /admin/media.html and provides the resulting URL —
// until then a sermon's button shows as "Coming soon".
//
// Metadata only (date/title/location) — no sermon text lives in this file.

(function () {
  const SERMONS = [
    { date: '1959-04-19', title: 'My Life Story', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1960-12-04', title: 'The Revelation of Jesus Christ', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1962-03-18', title: 'The Spoken Word Is The Original Seed', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1962-09-08', title: 'Present Stage Of My Ministry', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1962-12-30', title: 'Is This The Sign Of The End, Sir?', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1963-03-17', title: 'The Breach Between The Seven Church Ages And The Seven Seals', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1963-03-24', title: 'The Seventh Seal', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1963-06-27', title: 'Jesus Christ The Same Yesterday, Today And Forever', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1963-07-28', title: 'Christ Is The Mystery Of God Revealed', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
    { date: '1965-06-26', title: 'The Rapture', location: 'Jeffersonville', pdfUrl: null, audioUrl: null },
  ];

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function downloadButton(label, icon, url) {
    if (!url) {
      return `<span title="Coming soon" class="text-xs text-gray-300 border border-gray-100 px-3 py-1.5 rounded-full cursor-not-allowed">
        <i class="fas ${icon} mr-1"></i>${label}
      </span>`;
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener"
               class="text-xs text-amber-600 hover:text-amber-700 font-medium border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-full transition-all">
      <i class="fas ${icon} mr-1"></i>${label}
    </a>`;
  }

  function renderSermonRow(s) {
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 rounded-xl p-4">
        <div class="min-w-0">
          <p class="font-semibold text-[#0A3D62]">${esc(s.title)}</p>
          <p class="text-xs text-gray-400 mt-0.5">${formatDate(s.date)} &middot; ${esc(s.location)}</p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          ${downloadButton('PDF', 'fa-file-pdf', s.pdfUrl)}
          ${downloadButton('Audio', 'fa-headphones', s.audioUrl)}
        </div>
      </div>`;
  }

  function init() {
    const list = document.getElementById('sermon-list');
    if (!list) return;
    const sorted = SERMONS.slice().sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = sorted.map(renderSermonRow).join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
