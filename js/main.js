/* ===========================
   FILTER FUNCTIONALITY
=========================== */
const filterBtns = document.querySelectorAll('.filter-btn');
const cards = document.querySelectorAll('.meeting-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    cards.forEach(card => {
      if (filter === 'all' || card.dataset.venue === filter) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

/* ===========================
   CARD CLICK → GOOGLE FORM
=========================== */
const GOOGLE_FORM_URL = 'https://forms.gle/uoTLg9tv8wX5LP8p8';

document.querySelectorAll('.meeting-card').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.apply-btn')) return;
    if (e.target.closest('.poster-thumb')) return;
    window.open(GOOGLE_FORM_URL, '_blank', 'noopener');
  });
});

/* ===========================
   LIGHTBOX
=========================== */
function openLightbox(src, alt) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  img.alt = alt || '';
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

// ESC 키로 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
