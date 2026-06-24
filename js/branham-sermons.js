// js/branham-sermons.js — renders the William Branham sermon grids on
// fulfillment-of-prophecy.html, styled to mirror the equivalent page on the
// previous site (www.egc.church/fulfillment-of-prophecy): a gold card per
// sermon with month/day/year stacked, an inline audio player, and Audio/PDF
// download links. pdfUrl/audioUrl are filled in once a superadmin uploads
// each file via /admin/media.html and provides the resulting URL — until
// then a sermon's download links show as disabled.
//
// Metadata only (date/title/location) — no sermon text lives in this file.
//
// CORE_SERMONS are grouped and ordered deliberately: preached 1962-1963,
// they trace the growth of Brother Branham's revelation (the Spoken Word as
// the original seed, through to the opening of the Seventh Seal) and are
// not meant to be swapped out. MORE_SERMONS is the rotating/supplementary
// set and is expected to change over time.

(function () {
  const CORE_SERMONS = [
    { date: '1962-03-18', title: 'The Spoken Word Is The Original Seed', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290914568_62-0318_The_Spoken_Word_Is_The_Original_Seed.pdf?alt=media&token=999f62f5-f91e-442a-b6ad-9418f4ec3266',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290879672_62-0318_The_Spoken_Word_Is_The_Original_Seed.m4a?alt=media&token=6518fc63-da4d-4abd-85c6-3992a373ccac' },
    { date: '1962-09-08', title: 'Present Stage Of My Ministry', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290117667_62-0908_Present_Stage_Of_My_Ministry.pdf?alt=media&token=7a621f2a-e4b2-4e3f-a98d-94777ab98677',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290121874_62-0908_Present_Stage_Of_My_Ministry.m4a?alt=media&token=a6a2d0fd-0503-4738-a048-e0687635d79f' },
    { date: '1962-12-30', title: 'Is This The Sign Of The End, Sir?', location: 'Jeffersonville', service: 'Evening Service',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290113582_62-1230E_Is_This_The_Sign_Of_The_End_Sir.pdf?alt=media&token=d3f0bbbd-89d9-459d-a51f-6fcc0bf2da31',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290075878_62-1230E_Is_This_The_Sign_Of_The_End_Sir.m4a?alt=media&token=52a597e4-f8c3-4eda-8359-24f25390f9a6' },
    { date: '1963-03-17', title: 'The Breach Between The Seven Church Ages And The Seven Seals', location: 'Jeffersonville', service: 'Evening Service',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290034407_63-0317E_The_Breach_Between_The_Seven_Church_Ages_And_The_Seven_Seals.pdf?alt=media&token=391ebfd8-a0ef-4e02-857a-9e3825bbb879',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290040305_63-0317E_The_Breach_Between_The_Seven_Church_Ages_And_The_Seven_Seals.m4a?alt=media&token=3468e1aa-b00b-4b7c-bbf2-49119e31c402' },
    { date: '1963-03-24', title: 'The Seventh Seal', location: 'Jeffersonville', service: 'Evening Service',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290030387_63-0324E_The_Seventh_Seal.pdf?alt=media&token=fc96189a-9e37-4a7a-9e67-7ae7befb21f8',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290007980_63-0324E_The_Seventh_Seal.m4a?alt=media&token=2c20b8e4-cbce-4890-a23a-d2515240497d' },
    { date: '1963-07-28', title: 'Christ Is The Mystery Of God Revealed', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290002044_63-0728_Christ_Is_The_Mystery_Of_God_Revealed.pdf?alt=media&token=a465d1b9-eef2-4335-95e1-4e930882bad1',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289974666_63-0728_Christ_Is_The_Mystery_Of_God_Revealed.m4a?alt=media&token=dc432199-af0e-4340-9424-6d8dae6ecee6' },
  ];

  const MORE_SERMONS = [
    { date: '1959-04-19', title: 'My Life Story', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289970808_59-0419A_My_Life_Story.pdf?alt=media&token=ee36eb6a-398f-4c6a-93ad-ffb60f4056a4',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289953711_59-0419A_My_Life_Story.m4a?alt=media&token=f0750e77-0adf-42d3-b88d-f409b4f82ca7' },
    { date: '1960-12-04', title: 'The Revelation of Jesus Christ', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289928236_60-1204M_The_Revelation_Of_Jesus_Christ.pdf?alt=media&token=ea8fdca6-b61c-4db9-92e6-fd74b620d6aa',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289932588_60-1204M_The_Revelation_Of_Jesus_Christ.m4a?alt=media&token=8ab69e5d-fec9-40a2-b70a-dcdeb9b74c85' },
    { date: '1963-06-27', title: 'Jesus Christ The Same Yesterday, Today And Forever', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289922948_63-0627_Jesus_Christ_The_Same_Yesterday_Today_And_Forever.pdf?alt=media&token=5d61f439-1213-4011-b974-b687a1c57dd1',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782289901794_63-0627_Jesus_Christ_The_Same_Yesterday_Today_And_Forever.m4a?alt=media&token=247e85da-3165-4f1d-b56b-fe494bb9c146' },
    // The old site showed 26 June 1965, but the church confirmed 4 Dec 1965 is correct
    // (matches the uploaded file's "65-1204" VGR numbering).
    { date: '1965-12-04', title: 'The Rapture', location: 'Jeffersonville',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290146546_65-1204_The_Rapture.pdf?alt=media&token=043b1e62-edf2-4ec1-ae43-f4d9367f252f',
      audioUrl: 'https://firebasestorage.googleapis.com/v0/b/egc-church.firebasestorage.app/o/site-media%2F1782290150089_65-1204_The_Rapture.m4a?alt=media&token=bbae960e-9877-4097-b2c6-84818ac58976' },
  ];

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function miniLink(label, icon, url) {
    if (!url) {
      return `<span class="flex flex-col items-center gap-1 text-[#0A3D62]/30 cursor-not-allowed">
        <i class="fas ${icon}"></i><span class="text-xs">${label}</span>
      </span>`;
    }
    return `<a href="${esc(url)}" target="_blank" rel="noopener"
               class="flex flex-col items-center gap-1 text-[#0A3D62] hover:text-amber-700 transition-colors">
      <i class="fas ${icon}"></i><span class="text-xs">${label}</span>
    </a>`;
  }

  function renderSermonCard(s) {
    const d = new Date(s.date + 'T00:00:00');
    const month = d.toLocaleDateString('en-ZA', { month: 'long' });
    const day = d.toLocaleDateString('en-ZA', { day: 'numeric' });
    const year = d.toLocaleDateString('en-ZA', { year: 'numeric' });
    return `
      <div class="bg-amber-300 rounded-2xl px-5 py-8 flex flex-col items-center text-center">
        <p class="text-[#0A3D62] font-semibold text-sm">${esc(month)}</p>
        <p class="text-[#0A3D62] font-bold text-3xl leading-tight">${esc(day)}</p>
        <p class="text-[#0A3D62] font-bold text-xl mb-2">${esc(year)}</p>
        ${s.service ? `<p class="text-amber-800 text-[11px] font-semibold uppercase tracking-wide mb-3">${esc(s.service)}</p>` : ''}
        <p class="font-bold text-amber-800 uppercase leading-snug mb-4">${esc(s.title)}</p>
        <p class="text-[#0A3D62]/70 text-sm mb-4">${esc(s.location)}</p>
        ${s.audioUrl ? `<audio controls class="w-full mb-4" style="height:2.25rem" src="${esc(s.audioUrl)}"></audio>` : ''}
        <div class="flex gap-6 justify-center mt-auto">
          ${miniLink('Audio Download', 'fa-download', s.audioUrl)}
          ${miniLink('PDF Download', 'fa-file-pdf', s.pdfUrl)}
        </div>
      </div>`;
  }

  function renderGrid(containerId, sermons) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    const sorted = sermons.slice().sort((a, b) => a.date.localeCompare(b.date));
    grid.innerHTML = sorted.map(renderSermonCard).join('');
  }

  function init() {
    renderGrid('core-sermon-grid', CORE_SERMONS);
    renderGrid('more-sermon-grid', MORE_SERMONS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
