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

/* ── 신청 현황 패치: 파싱 버그 수정 + 다온글방 6-2 매핑 ── */
// 기존 loadCapacity 덮어쓰기
const MEETING_MAP_V2 = [
  { prefix: '1-1', id: '0514-1' },
  { prefix: '1-2', id: '0521-1' },
  { prefix: '2 ', id: '0515' },
  { prefix: '3 ', id: '0516' },
  { prefix: '4 책방', id: '0517' },  // "책방,파도" 쉼표 포함
  { prefix: '5 ', id: '0518' },
  { prefix: '6-1', id: '0520a' },
  { prefix: '6-2', id: '0520a' },   // 다온글방 오후도 같은 카드
  { prefix: '7 ', id: '0520c' },
  { prefix: '8 ', id: '0522' },
  { prefix: '9 ', id: '0523' },
  { prefix: '10 ', id: '0527a' },
  { prefix: '11 ', id: '0527b' },
  { prefix: '12 ', id: '0529' },
  { prefix: '13 ', id: '0530' },
];

function getMeetingIdV2(text) {
  const t = text.trim();
  for (const { prefix, id } of MEETING_MAP_V2) {
    if (t.startsWith(prefix)) return id;
  }
  return null;
}

// 모임 선택지를 올바르게 분리 (쉼표로 분리하되, 모임 번호 "숫자 " 앞에서만 분리)
function splitMeetings(raw) {
  // "숫자-숫자 " 또는 "숫자 " 패턴 앞에서 분리
  const parts = raw.split(/(?=\d+-\d+\s|\b\d{1,2}\s(?:동서|앗트|사소|책방|새미|다온|달뒤|또봐|해피|모퉁|영국|썬북))/);
  return parts.map(p => p.trim()).filter(Boolean);
}

async function loadCapacityV2() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    const counts = {};
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 4) continue;
      const meetingCell = cells[3] || '';
      const meetings = splitMeetings(meetingCell);
      for (const m of meetings) {
        const id = getMeetingIdV2(m);
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
    }

    document.querySelectorAll('[data-meeting]').forEach(card => {
      const mid = card.dataset.meeting;
      const capacity = parseInt(card.dataset.capacity) || 0;
      const applied = counts[mid] || 0;
      const remaining = capacity - applied;
      const pct = capacity > 0 ? Math.min(100, Math.round(applied / capacity * 100)) : 0;

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

      const cardBottom = card.querySelector('.card-bottom');
      if (cardBottom) card.insertBefore(bar, cardBottom);

      const applyBtn = card.querySelector('.apply-btn');
      if (applyBtn && isFull) {
        applyBtn.classList.add('disabled');
        applyBtn.textContent = '신청 마감';
      } else if (applyBtn) {
        applyBtn.classList.remove('disabled');
        applyBtn.textContent = '신청하기 →';
      }
    });

    console.log('신청 현황 v2 업데이트:', counts);
  } catch(e) {
    console.warn('신청 현황 로드 실패:', e);
  }
}

// 기존 타이머 교체
loadCapacityV2();
setInterval(loadCapacityV2, 3 * 60 * 1000);

/* ── 회차별 신청 현황 (다온글방, 동서남북) ── */
async function loadSubCapacity() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    // 전체 카운트 (v2 방식)
    const counts = {};
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 4) continue;
      const meetingCell = cells[3] || '';
      const meetings = splitMeetings(meetingCell);
      for (const m of meetings) {
        const id = getMeetingIdV2(m);
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
    }

    // 회차별 sub-meeting 처리
    document.querySelectorAll('[data-sub-meeting]').forEach(item => {
      const mid = item.dataset.subMeeting;
      const capacity = parseInt(item.dataset.subCapacity) || 0;
      const applied = counts[mid] || 0;
      const pct = capacity > 0 ? Math.min(100, Math.round(applied / capacity * 100)) : 0;
      const isFull = applied >= capacity;
      const fillClass = pct >= 100 ? 'full-bar' : pct >= 70 ? 'almost' : '';

      // 기존 sub-bar 제거
      const old = item.querySelector('.sub-capacity-bar');
      if (old) old.remove();

      const bar = document.createElement('div');
      bar.className = 'sub-capacity-bar';
      bar.innerHTML = `
        <div class="sub-progress-track">
          <div class="sub-progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <span class="sub-count ${isFull ? 'full' : ''}">${applied}/${capacity}명${isFull ? ' 마감' : ''}</span>
      `;
      item.appendChild(bar);
    });

    // data-meeting="multi" 카드는 전체 현황 바 숨기기 (회차별로만 표시)
    document.querySelectorAll('[data-meeting="multi"]').forEach(card => {
      const old = card.querySelector('.capacity-bar');
      if (old) old.remove();
    });

    console.log('회차별 현황 업데이트:', counts);
  } catch(e) {
    console.warn('회차별 현황 로드 실패:', e);
  }
}

loadSubCapacity();
setInterval(loadSubCapacity, 3 * 60 * 1000);
