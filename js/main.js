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
    if (raw.includes(prefix)) found.push(id);
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
