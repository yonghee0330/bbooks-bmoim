/* ===========================
   FILTER FUNCTIONALITY
=========================== */
const filterBtns = document.querySelectorAll('.filter-btn');
const seminarSection = document.getElementById('seminar-section');
const tableSection = document.getElementById('table-section');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;

    if (filter === 'all') {
      seminarSection.classList.remove('hidden');
      tableSection.classList.remove('hidden');
    } else if (filter === 'seminar') {
      seminarSection.classList.remove('hidden');
      tableSection.classList.add('hidden');
    } else if (filter === 'table') {
      seminarSection.classList.add('hidden');
      tableSection.classList.remove('hidden');
    }
  });
});

/* ===========================
   CARD CLICK → GOOGLE FORM
=========================== */
const GOOGLE_FORM_URL = 'https://forms.gle/uoTLg9tv8wX5LP8p8';

document.querySelectorAll('.meeting-card').forEach(card => {
  card.addEventListener('click', (e) => {
    // 신청하기 버튼 자체 클릭은 버블링 방지 (링크가 직접 처리)
    if (e.target.closest('.apply-btn')) return;
    window.open(GOOGLE_FORM_URL, '_blank', 'noopener');
  });
});
