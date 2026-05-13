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
   신청 현황 - 공통 설정
══════════════════════════════════════ */
const RESPONSE_SHEET_ID = '1C64dZrpedaMX26oPPwDOkG1SJ-IvfADnIH5loE-qYQ4';
const RESPONSE_GID = '1930206116';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${RESPONSE_SHEET_ID}/export?format=csv&gid=${RESPONSE_GID}`;

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

/* ══════════════════════════════════════
   신청 현황 v3 - prefix 직접 검색 (정확)
══════════════════════════════════════ */
const MEETING_PREFIXES_V3 = [
  { prefix: "1-1 ", id: "0514-1" },
  { prefix: "1-2 ", id: "0521-1" },
  { prefix: "6-1 ", id: "0520a"  },
  { prefix: "6-2 ", id: "0520b"  },
  { prefix: "2 ",   id: "0515"   },
  { prefix: "3 ",   id: "0516"   },
  { prefix: "4 책방", id: "0517" },
  { prefix: "5 ",   id: "0518"   },
  { prefix: "7 ",   id: "0520c"  },
  { prefix: "8 ",   id: "0522"   },
  { prefix: "9 ",   id: "0523"   },
  { prefix: "10 ",  id: "0527a"  },
  { prefix: "11 ",  id: "0527b"  },
  { prefix: "12 ",  id: "0529"   },
  { prefix: "13 ",  id: "0530"   },
];

function getAllMeetingIds(raw) {
  const found = [];
  for (const { prefix, id } of MEETING_PREFIXES_V3) {
    // 텍스트 시작이거나 ", " 뒤에 오는 경우만 매칭 (부분 포함 오탐 방지)
    const pattern = new RegExp('(?:^|,\\s*)' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (pattern.test(raw)) found.push(id);
  }
  return found;
}

async function loadCapacityV3() {
  try {
    const res = await fetch(CSV_URL + '&v3=' + Date.now());
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    // 모임별 신청자 카운팅
    const counts = {};
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 4) continue;
      const ids = getAllMeetingIds(cells[3] || '');
      for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    }
    console.log('신청 현황 v3:', counts);

    // ① 단일 카드
    document.querySelectorAll('[data-meeting]:not([data-meeting="multi"])').forEach(card => {
      const mid = card.dataset.meeting;
      const capacity = parseInt(card.dataset.capacity) || 0;
      const applied = counts[mid] || 0;
      const remaining = Math.max(0, capacity - applied);
      const pct = capacity > 0 ? Math.min(100, Math.round(applied / capacity * 100)) : 0;
      const isFull = applied >= capacity;
      const fillClass = pct >= 100 ? 'full-bar' : pct >= 70 ? 'almost' : '';

      let bar = card.querySelector('.capacity-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'capacity-bar';
        const cb = card.querySelector('.card-bottom');
        if (cb) card.insertBefore(bar, cb);
      }
      bar.innerHTML = `
        <div class="capacity-label">
          <span>신청 현황 <span class="count">${applied}/${capacity}명</span>${isFull ? '<span class="full-badge">마감</span>' : ''}</span>
          <span style="color:${isFull ? '#dc2626' : '#64748b'}">${isFull ? '신청 마감' : '잔여 ' + remaining + '자리'}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>`;

      const btn = card.querySelector('.apply-btn');
      if (btn) {
        if (isFull) { btn.classList.add('disabled'); btn.textContent = '신청 마감'; }
        else { btn.classList.remove('disabled'); btn.textContent = '신청하기 →'; }
      }
    });

    // ② 회차별 (data-sub-meeting)
    document.querySelectorAll('[data-sub-meeting]').forEach(item => {
      const mid = item.dataset.subMeeting;
      const capacity = parseInt(item.dataset.subCapacity) || 0;
      const applied = counts[mid] || 0;
      const pct = capacity > 0 ? Math.min(100, Math.round(applied / capacity * 100)) : 0;
      const isFull = applied >= capacity;
      const fillClass = pct >= 100 ? 'full-bar' : pct >= 70 ? 'almost' : '';

      let bar = item.querySelector('.sub-capacity-bar');
      if (!bar) { bar = document.createElement('div'); bar.className = 'sub-capacity-bar'; item.appendChild(bar); }
      bar.innerHTML = `
        <div class="sub-progress-track">
          <div class="sub-progress-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <span class="sub-count ${isFull ? 'full' : ''}">${applied}/${capacity}명${isFull ? ' 마감' : ''}</span>`;
    });

    // ③ multi 카드 전체 바 제거
    document.querySelectorAll('[data-meeting="multi"] > .capacity-bar').forEach(b => b.remove());

  } catch(e) { console.warn('신청 현황 v3 오류:', e); }
}

loadCapacityV3();
setInterval(loadCapacityV3, 3 * 60 * 1000);

/* ===========================
   CALENDAR → CARD SCROLL
=========================== */
function scrollToCard(index, venue) {
  const filterBtn = document.querySelector(`.filter-btn[data-filter="${venue}"]`);
  if (filterBtn) filterBtn.click();
  const card = document.querySelector(`[data-venue="${venue}"][data-index="${index}"]`);
  if (card) {
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.outline = '2px solid #2a3d2a';
      card.style.outlineOffset = '4px';
      setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 1800);
    }, 120);
  }
}

/* ===========================
   BOOKING MODAL
=========================== */
let selectedVenue = '세미나실';
let selectedTime  = '오전 (10:00~13:00)';
let selectedDate  = null;

function openBooking(date) {
  const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdYHRxPmGLufs2MeRrQZRplQRJSC9LJDCoIZ8ykx_qDNkoEOg/viewform';
  const params = new URLSearchParams({ 'entry.308776795': `5월 ${date}일` });
  window.open(`${FORM}?${params.toString()}`, '_blank', 'noopener');
}

function closeBookingModal(event, force) {
  if (force || (event && event.target === document.getElementById('booking-modal'))) {
    document.getElementById('booking-modal').classList.remove('open');
    document.body.style.overflow = '';
  }
}

function selectVenue(btn) {
  document.querySelectorAll('.toggle-group').forEach((grp, i) => {
    if (i === 0) grp.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  });
  btn.classList.add('active');
  selectedVenue = btn.dataset.val;
}

function selectTime(btn) {
  document.querySelectorAll('.toggle-group').forEach((grp, i) => {
    if (i === 1) grp.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  });
  btn.classList.add('active');
  selectedTime = btn.dataset.val;
}

function submitBooking() {
  const purpose = document.getElementById('book-purpose').value.trim();
  const people  = document.getElementById('book-people').value.trim();
  const name    = document.getElementById('book-name').value.trim();
  const phone   = document.getElementById('book-phone').value.trim();
  const memo    = document.getElementById('book-memo').value.trim();

  if (!purpose || !people || !name || !phone) {
    alert('사용 목적, 인원, 성함, 연락처는 필수 입력 항목입니다 😊');
    return;
  }

  // 구글 폼 pre-fill URL 생성
  const BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSdYHRxPmGLufs2MeRrQZRplQRJSC9LJDCoIZ8ykx_qDNkoEOg/viewform';
  const params = new URLSearchParams({
    'entry.308776795':  `5월 ${selectedDate}일`,   // 대관 날짜
    'entry.1548099271': selectedVenue,               // 대관 장소
    'entry.257892746':  selectedTime,                // 시간대
    'entry.351736836':  purpose,                     // 사용 목적
    'entry.1186703695': people,                      // 인원
    'entry.311018962':  name,                        // 성함
    'entry.280868670':  phone,                       // 연락처
    'entry.400647263':  memo,                        // 요청사항
  });

  window.open(`${BASE}?${params.toString()}`, '_blank', 'noopener');

  closeBookingModal(null, true);
  showToast();
}

function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBookingModal(null, true);
});

/* ===========================
   CALENDAR TAB FILTER
=========================== */
function switchCalTab(tab, btn) {
  // 탭 버튼 활성화
  document.querySelectorAll('.cal-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const cells = document.querySelectorAll('.cal-grid .cal-cell:not(.empty)');

  cells.forEach(cell => {
    cell.classList.remove('hide-cell');

    const hasBmoim  = cell.classList.contains('has-event');  // 비모임(점주 모임)
    const hasBooking = cell.querySelector('.booking-badge');  // 대관 신청

    if (tab === 'all') {
      // 전체 — 모두 보이기
      cell.classList.remove('hide-cell');
    } else if (tab === 'bmoim') {
      // 비모임만 — has-event 있는 셀만
      if (!hasBmoim) cell.classList.add('hide-cell');
    } else if (tab === 'booking') {
      // 대관만 — booking-badge 있는 셀만
      if (!hasBooking) cell.classList.add('hide-cell');
    }
  });
}

/* ===========================
   SPACE GALLERY SLIDER
=========================== */
let slideIndex = 0;
let visibleSlides = [];
let autoTimer = null;

function initSlider() {
  visibleSlides = Array.from(document.querySelectorAll('.slide'));
  buildDots();
  goToSlide(0);
  startAuto();
}

function startAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => moveSlide(1), 4000);
}

function buildDots() {
  const dots = document.getElementById('sliderDots');
  if (!dots) return;
  dots.innerHTML = visibleSlides.map((_, i) =>
    `<button class="dot ${i===0?'active':''}" onclick="goToSlide(${i})"></button>`
  ).join('');
}

function goToSlide(idx) {
  if (visibleSlides.length === 0) return;
  slideIndex = (idx + visibleSlides.length) % visibleSlides.length;
  // 현재 보여야 할 슬라이드 기준으로 transform 계산
  // 전체 트랙에서 visibleSlides[slideIndex]의 실제 위치 찾기
  const allSlides = Array.from(document.querySelectorAll('.slide'));
  const targetSlide = visibleSlides[slideIndex];
  const realIdx = allSlides.indexOf(targetSlide);
  const track = document.getElementById('sliderTrack');
  if (track) track.style.transform = `translateX(-${realIdx * 100}%)`;
  document.querySelectorAll('.dot').forEach((d,i) => d.classList.toggle('active', i===slideIndex));
}

function moveSlide(dir) {
  goToSlide(slideIndex + dir);
  startAuto();
}

function filterSpace(type, btn) {
  document.querySelectorAll('.space-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const allSlides = Array.from(document.querySelectorAll('.slide'));
  allSlides.forEach(s => {
    const match = type === 'all' || s.dataset.space === type;
    // display:none 대신 width:0 + overflow:hidden 방식으로 숨김
    if (match) {
      s.classList.remove('hidden-slide');
      s.style.minWidth = '100%';
    } else {
      s.classList.add('hidden-slide');
      s.style.minWidth = '0';
    }
  });
  visibleSlides = allSlides.filter(s => !s.classList.contains('hidden-slide'));
  slideIndex = 0;
  buildDots();
  goToSlide(0);
  startAuto();
}

window.addEventListener('load', initSlider);
