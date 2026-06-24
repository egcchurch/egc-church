// js/welcome-carousel.js — simple auto-rotating photo carousel for the
// homepage's "A Warm Welcome" section. Plain CSS opacity crossfade, no
// animation library. No-ops if #welcome-carousel isn't on the page.

(function () {
  const container = document.getElementById('welcome-carousel');
  const dotsContainer = document.getElementById('welcome-carousel-dots');
  if (!container || !dotsContainer) return;

  const slides = [...container.querySelectorAll('.welcome-carousel-slide')];
  if (!slides.length) return;

  let current = 0;
  let timer = null;

  function renderDots() {
    dotsContainer.innerHTML = slides.map((_, i) => `
      <button class="welcome-carousel-dot w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40'}"
              data-index="${i}" aria-label="Go to slide ${i + 1}"></button>
    `).join('');
  }

  function showSlide(index) {
    slides[current].classList.replace('opacity-100', 'opacity-0');
    current = index;
    slides[current].classList.replace('opacity-0', 'opacity-100');
    renderDots();
  }

  function startTimer() {
    timer = setInterval(() => showSlide((current + 1) % slides.length), 5000);
  }

  dotsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.welcome-carousel-dot');
    if (!btn) return;
    clearInterval(timer);
    showSlide(parseInt(btn.dataset.index, 10));
    startTimer();
  });

  renderDots();
  startTimer();
})();
