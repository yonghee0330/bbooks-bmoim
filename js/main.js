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

/* ══════════════════════════════════════
   신청 현황 실시간 연동
══════════════════════════════════════ */
const RESPONSE_SHEET_ID = '1C64dZrpedaMX26oPPwDOkG1SJ-IvfADnIH5loE-qYQ4';
const RESPONSE_GID = '1930206116';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${RESPONSE_SHEET_ID}/export?format=csv&gid=${RESPONSE_GID}&t=${Date.now()}`;

// 폼 선택지 텍스트 → data-meeting ID 매핑
const MEETING_MAP = {
  '1-1': '0514-1',
  '1-2': '0521-1',
  '2 ':  '0515',
  '3 ':  '0516',
  '4 ':  '0517',
  '5 ':  '0518',
  '6-1': '0520a',
  '6-2': '0520b',
  '7 ':  '0520c',
  '8 ':  '0522',
  '9 ':  '0523',
  '10 ': '0527a',
  '11 ': '0527b',
  '12 ': '0529',
  '13 ': '0530',
};

function getMeetingId(text) {
  for (const [prefix, id] of Object.entries(MEETING_MAP)) {
    if (text.trim().startsWith(prefix)) return id;
  }
  return null;
}

function parseCSVLine(line) {
  const cells = [];
  let cell = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cell += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

async function loadCapacity() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    // 모임별 신청자 수 카운팅
    const counts = {};
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 4) continue;
      const meetingCell = cells[3] || '';
      // 복수 신청: 줄바꿈 구분
      for (const m of meetingCell.split('\n')) {
        const id = getMeetingId(m.trim());
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
    }

    // 각 카드에 반영
    document.querySelectorAll('[data-meeting]').forEach(card => {
      const mid = card.dataset.meeting;
      const capacity = parseInt(card.dataset.capacity) || 0;
      const applied = counts[mid] || 0;
      const remaining = capacity - applied;
      const pct = capacity > 0 ? Math.min(100, Math.round(applied / capacity * 100)) : 0;

      // 기존 capacity-bar 제거 후 새로 삽입
      const old = card.querySelector('.capacity-bar');
      if (old) old.remove();

      const fillClass = pct >= 100 ? 'full-bar' : pct >= 70 ? 'almost' : '';
      const isFull = applied >= capacity;

      const bar = document.createElement('div');
      bar.className = 'capacity-bar';
      bar.innerHTML = `
        <div class="capacity-label">
          <span>신청 현황 <span class="count">${applied}/${capacity}명</span>${isFull ? '<span class="full-badge">마감</span>' : ''}</span>
          <span style="color:${isFull ? '#dc2626' : '#64748b'}">${isFull ? '신청 마감' : `잔여 ${remaining}자리`}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
      `;

      // card-bottom 앞에 삽입
      const cardBottom = card.querySelector('.card-bottom');
      if (cardBottom) card.insertBefore(bar, cardBottom);

      // 마감 시 신청 버튼 비활성화
      const applyBtn = card.querySelector('.apply-btn');
      if (applyBtn && isFull) {
        applyBtn.classList.add('disabled');
        applyBtn.textContent = '신청 마감';
      } else if (applyBtn) {
        applyBtn.classList.remove('disabled');
        applyBtn.textContent = '신청하기 →';
      }
    });

    console.log('신청 현황 업데이트 완료', counts);
  } catch(e) {
    console.warn('신청 현황 로드 실패:', e);
  }
}

// 페이지 로드 시 + 3분마다 자동 갱신
loadCapacity();
setInterval(loadCapacity, 3 * 60 * 1000);
