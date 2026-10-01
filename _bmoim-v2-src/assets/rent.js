/* 비북스 b.moim v2 — 대관 페이지
 * 기존 30분 시간표 · 공간 충돌 규칙을 그대로 살리고, 차단 구간은 모임 데이터(CAT.blocks)에서 자동으로 만듭니다.
 * 기존 대관 내역은 이름·연락처 없이 날짜·공간·시간만 받아옵니다 (action=rentBlocks).
 */
(() => {
  'use strict';
  const BM = window.BM;
  if (!BM || document.body.dataset.page !== 'space') return;
  const { CAT, api, kst, kp, ymd, pad, nowMs, won, esc, toast, setBusy, formAlert, validPhone, validEmail, markInvalid, readConsent, refOut, sentChips, rememberCode, REL } = BM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SP = CAT.spaces;
  const SPACE = Object.fromEntries(SP.spaces.map(s => [s.id, s]));
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const OPEN = toMin(SP.hours.open), CLOSE = toMin(SP.hours.close), STEP = SP.hours.stepMin;
  const WD = '일월화수목금토';

  let rentBlocks = [];
  let space = '', date = '', selA = null, selB = null;

  // ── 사진 슬라이드 점 ──
  $$('[data-photos]').forEach(ph => {
    const n = ph.children.length;
    if (n < 2) return;
    const dots = document.createElement('div');
    dots.className = 'ph-dots';
    dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('');
    ph.after(dots);
    ph.addEventListener('scroll', () => {
      const i = Math.round(ph.scrollLeft / ph.clientWidth);
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
  });

  // ── 공간 갤러리: 썸네일 → 큰 사진, 큰 사진 → 전체 화면 보기 ──
  function galleryOf(sec) {
    return $$('.sc-th', sec).map(t => ({ src: t.dataset.src, cap: t.dataset.cap, portrait: t.dataset.portrait === '1' }));
  }
  function showPhoto(sec, i) {
    const list = galleryOf(sec);
    const p = list[i];
    if (!p) return;
    const main = $('.sc-main', sec);
    $('.sc-img', main).src = p.src;
    $('.sc-img', main).alt = p.cap;
    $('.sc-bg', main).src = p.src;
    $('.sc-cap', main).textContent = p.cap;
    $('.sc-count', main).textContent = `${i + 1} / ${list.length}`;
    main.classList.toggle('is-portrait', p.portrait);
    main.dataset.i = i;
    $$('.sc-th', sec).forEach((t, k) => t.classList.toggle('on', k === i));
  }
  function openViewer(sec, start) {
    const list = galleryOf(sec);
    let i = start || 0;
    const name = sec.querySelector('.sc-kicker')?.textContent || '';
    const v = document.createElement('div');
    v.className = 'gv';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-label', `${name} 사진`);
    v.innerHTML = `<button type="button" class="gv-x" aria-label="닫기">✕</button>
      <button type="button" class="gv-nav prev" aria-label="이전 사진">‹</button>
      <figure class="gv-fig"><img alt=""><figcaption></figcaption></figure>
      <button type="button" class="gv-nav next" aria-label="다음 사진">›</button>`;
    const render = () => {
      $('img', v).src = list[i].src;
      $('img', v).alt = list[i].cap;
      $('figcaption', v).textContent = `${name} · ${list[i].cap}  (${i + 1}/${list.length})`;
    };
    const go = d => { i = (i + d + list.length) % list.length; render(); showPhoto(sec, i); };
    const close = () => { v.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    $('.gv-x', v).addEventListener('click', close);
    $('.prev', v).addEventListener('click', e => { e.stopPropagation(); go(-1); });
    $('.next', v).addEventListener('click', e => { e.stopPropagation(); go(1); });
    v.addEventListener('click', e => { if (e.target === v) close(); });
    let sx = 0;
    v.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
    v.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }, { passive: true });
    document.addEventListener('keydown', key);
    document.body.appendChild(v);
    document.body.style.overflow = 'hidden';
    render();
    $('.gv-x', v).focus();
  }
  $$('.showcase').forEach(sec => {
    $$('.sc-th', sec).forEach((t, i) => t.addEventListener('click', () => showPhoto(sec, i)));
    $('[data-gallery-open]', sec).addEventListener('click', e => openViewer(sec, Number(e.currentTarget.dataset.i || 0)));
    $('[data-gallery-open-btn]', sec)?.addEventListener('click', () => openViewer(sec, 0));
  });

  // ── 예상 금액 ──
  // 1인실처럼 '2시간 단위 + 종일권' 요금: 10–18시 안에서는 더 싼 쪽(종일권)으로
  function blockPrice(p, hours, startMin) {
    const byBlock = p.unit * Math.ceil(hours / (p.blockHours || 2));
    const dp = p.dayPass;
    if (!dp) return { amount: byBlock, dayPass: false };
    const inWindow = startMin == null || (startMin >= toMin(dp.from) && startMin + hours * 60 <= toMin(dp.to));
    return inWindow && dp.price < byBlock ? { amount: dp.price, dayPass: true } : { amount: byBlock, dayPass: false };
  }
  function estimate(spId, people, hours, startMin) {
    const sp = SPACE[spId];
    if (!sp) return null;
    const p = sp.pricing;
    if (p.type === 'inquiry') return null; // 요금 문의 공간
    if (p.type === 'block') return blockPrice(p, hours, startMin).amount;
    if (p.type === 'perPerson') return p.unit * Math.max(1, people) * Math.ceil(hours / (p.blockHours || 2));
    return p.unit * hours;
  }
  function renderCalc() {
    const spId = $('#calcSpace').value;
    const people = Math.max(1, Number($('#calcPeople').value) || 1);
    const hours = Number($('#calcHours').value);
    const sp = SPACE[spId];
    const est = estimate(spId, people, hours);
    if (est == null) { $('#calcOut').innerHTML = `<b>${esc(sp.name)}</b>은 요금을 따로 안내드려요. 예약 신청을 남겨 주시면 담당자가 연락드릴게요.`; return; }
    if (sp.pricing.type === 'block') {
      const p = sp.pricing, r = blockPrice(p, hours), dp = p.dayPass;
      const how = r.dayPass ? `종일권 ${dp.from}–${dp.to} 적용` : `${p.blockHours}시간 ${won(p.unit)} × ${Math.ceil(hours / p.blockHours)}구간`;
      const promo = dp ? `<br><small class="muted">종일권(${dp.from}–${dp.to}) ${dp.regular ? `<del>${won(dp.regular)}</del> ` : ''}<b>${won(dp.price)}</b>${dp.label ? ` · ${esc(dp.label)}` : ''}</small>` : '';
      $('#calcOut').innerHTML = `예상 <b>${won(r.amount)}</b> <small class="muted">(${how})</small>${promo}`;
      return;
    }
    const over = people > sp.maxPeople ? `<br><small style="color:var(--danger)">${esc(sp.name)}은 최대 ${sp.maxPeople}인이에요. 더 넓은 공간을 골라 보세요.</small>` : '';
    const how = sp.pricing.type === 'perPerson'
      ? `1인 ${won(sp.pricing.unit)} × ${people}명 × ${Math.ceil(hours / sp.pricing.blockHours)}구간(2시간 단위)`
      : `시간당 ${won(sp.pricing.unit)} × ${hours}시간`;
    $('#calcOut').innerHTML = `예상 <b>${won(est)}</b> <small class="muted">(${how})</small>${over}<br><small class="muted">정확한 금액은 신청 후 담당자가 안내드려요.</small>`;
  }
  ['#calcSpace', '#calcPeople', '#calcHours'].forEach(s => $(s).addEventListener('input', renderCalc));
  renderCalc();

  // ── 공간 선택 ──
  function pickSpace(id, scroll) {
    space = id; selA = selB = null;
    $$('[data-space-opt]').forEach(b => { const on = b.dataset.spaceOpt === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $('#calcSpace').value = id; renderCalc();
    renderMiniCal(); renderTimes();
    if (scroll) $('#book').scrollIntoView({ behavior: 'smooth' });
  }
  $$('[data-space-opt]').forEach(b => b.addEventListener('click', () => pickSpace(b.dataset.spaceOpt)));
  $$('[data-pick-space]').forEach(b => b.addEventListener('click', () => pickSpace(b.dataset.pickSpace, true)));

  // ── 차단 구간 ──
  const conflictsOf = id => new Set([id, ...(SPACE[id]?.conflicts || [])]);
  function blocksFor(d, spId) {
    if (!spId) return [];
    const cs = conflictsOf(spId);
    const moim = CAT.blocks.filter(b => b.date === d && cs.has(b.space))
      .map(b => ({ kind: 'moim', a: toMin(b.start), b: toMin(b.end), tag: b.tag, space: b.space }));
    const rent = rentBlocks.filter(b => b.date === d && (!b.space || !SPACE[b.space] || cs.has(b.space)))
      .map(b => {
        const m = String(b.time).replace(/[~\-—]/g, '–').match(/(\d{1,2}:\d{2})\s*–\s*(\d{1,2}:\d{2})/);
        return m ? { kind: 'rent', a: toMin(m[1]), b: toMin(m[2]), tag: '대관', space: b.space || '공간 미정' } : null;
      }).filter(Boolean);
    return [...moim, ...rent];
  }
  function cellKind(d, t, list) {
    const now = nowMs();
    if (kst(`${d}T${toHM(t)}`) < now) return { kind: 'past' };
    const hit = list.find(x => t >= x.a && t < x.b);
    return hit || null;
  }

  // ── 미니 달력 ──
  const months = SP.bookableMonths;
  let mi = Math.max(0, months.indexOf(ymd(nowMs()).slice(0, 7)));
  function renderMiniCal() {
    const [y, m] = months[mi].split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = ymd(nowMs());
    let html = `<div class="mc-head"><button type="button" class="cal-nav" data-mc="-1" ${mi === 0 ? 'disabled' : ''} aria-label="이전 달">‹</button><b>${y}년 ${m}월</b><button type="button" class="cal-nav" data-mc="1" ${mi === months.length - 1 ? 'disabled' : ''} aria-label="다음 달">›</button></div><div class="mc-grid">`;
    html += [...WD].map(w => `<div class="mc-dow">${w}</div>`).join('');
    for (let i = 0; i < first; i++) html += '<span class="mc-empty"></span>';
    for (let d = 1; d <= days; d++) {
      const key = `${months[mi]}-${pad(d)}`;
      const past = key < today;
      const busy = space && blocksFor(key, space).length;
      html += `<button type="button" class="mc-day${key === date ? ' sel' : ''}${busy ? ' busy' : ''}" data-date="${key}" ${past ? 'disabled' : ''} aria-label="${m}월 ${d}일${busy ? ', 일부 예약 있음' : ''}">${d}</button>`;
    }
    html += '</div>';
    $('#rentCal').innerHTML = html;
  }
  $('#rentCal').addEventListener('click', e => {
    const nav = e.target.closest('[data-mc]');
    if (nav) { mi = Math.min(months.length - 1, Math.max(0, mi + Number(nav.dataset.mc))); renderMiniCal(); return; }
    const d = e.target.closest('[data-date]');
    if (d && !d.disabled) { date = d.dataset.date; selA = selB = null; renderMiniCal(); renderTimes(); }
  });

  // ── 시간표 ──
  function renderTimes() {
    const grid = $('#timeGrid');
    const busyBox = $('#dayBusy');
    if (!space || !date) {
      grid.innerHTML = `<p class="muted small">${!space ? '공간을 먼저 골라 주세요.' : '날짜를 골라 주세요.'}</p>`;
      busyBox.hidden = true;
      return renderSummary();
    }
    const list = blocksFor(date, space);
    busyBox.hidden = !list.length;
    busyBox.innerHTML = list.length ? `이 날 이미 잡힌 일정 <ul>${list.sort((a, b) => a.a - b.a).map(x => `<li>${toHM(x.a)}–${toHM(x.b)} · ${x.kind === 'moim' ? '비모임 ' + esc(x.tag) : '대관'} (${esc(x.space)})</li>`).join('')}</ul>` : '';
    let html = '';
    for (let t = OPEN; t < CLOSE; t += STEP) {
      const k = cellKind(date, t, list);
      const inSel = selA != null && t >= selA && t < (selB ?? selA + STEP);
      const edge = selA != null && (t === selA || (selB != null && t + STEP === selB));
      const cls = ['tc', k?.kind || '', inSel ? 'in' : '', edge ? 'edge' : ''].filter(Boolean).join(' ');
      const tag = k?.kind === 'moim' ? `<small>${esc(k.tag)}</small>` : k?.kind === 'rent' ? '<small>대관 있음</small>' : '';
      html += `<button type="button" class="${cls}" data-t="${t}" ${k ? 'disabled' : ''} title="${k?.tag ? esc(k.tag) : ''}">${toHM(t)}${tag}</button>`;
    }
    grid.innerHTML = html;
    renderSummary();
  }
  $('#timeGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b || b.disabled) return;
    const t = Number(b.dataset.t);
    const list = blocksFor(date, space);
    if (selA == null || selB != null) { selA = t; selB = null; }
    else {
      const a = Math.min(selA, t), z = Math.max(selA, t) + STEP;
      for (let x = a; x < z; x += STEP) {
        if (cellKind(date, x, list)) { toast('선택 구간에 이미 잡힌 일정이 있어요'); selA = t; selB = null; renderTimes(); return; }
      }
      selA = a; selB = z;
    }
    renderTimes();
  });

  function renderSummary() {
    const box = $('#rentSummary');
    const note = $('#timeNote');
    if (!box) return; // 신청 완료 후에는 폼이 사라짐
    if (selA != null && selB == null) note.textContent = `시작 ${toHM(selA)} · 끝나는 칸을 눌러 주세요 (30분만 쓰려면 같은 칸을 한 번 더)`;
    else note.textContent = '시작 칸과 끝 칸을 차례로 눌러 주세요';
    const ready = space && date && selA != null && selB != null && $('#rentForm');
    box.classList.toggle('ready', !!ready);
    if (!ready) { box.textContent = [space ? SPACE[space].name : '공간', date || '날짜', '시간'].join(' · ') + ' 을 골라 주세요'; return; }
    const p = kp(kst(date));
    const hours = (selB - selA) / 60;
    const people = Number($('#rentForm').elements.namedItem('count').value) || (SPACE[space].pricing.type === 'perPerson' ? 1 : 0);
    const est = estimate(space, people || 1, hours, selA);
    const pr = SPACE[space].pricing;
    const dpNote = pr.type === 'block' && blockPrice(pr, hours, selA).dayPass ? ' · 종일권 적용' : '';
    const estText = est == null ? '요금은 담당자가 안내드려요' : `예상 ${won(est)}${pr.type === 'perPerson' ? ` · ${people || 1}명 기준` : ''}${dpNote}`;
    box.innerHTML = `${esc(SPACE[space].name)} · ${p.m}월 ${p.d}일 (${WD[p.wd]}) ${toHM(selA)}–${toHM(selB)} <span class="muted">(${hours}시간)</span><br><small>${estText}</small>`;
  }
  $('#rentForm').elements.namedItem('count').addEventListener('input', renderSummary);

  // ── 신청 ──
  $('#rentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const F = n => f.elements.namedItem(n);
    const alertEl = $('#rentAlert');
    formAlert(alertEl, '');
    if (!space || !date || selA == null || selB == null) { $('#book').scrollIntoView({ behavior: 'smooth' }); return formAlert(alertEl, '공간 · 날짜 · 시간을 먼저 골라 주세요.'); }
    if (!F('name').value.trim()) { markInvalid(F('name')); return formAlert(alertEl, '이름을 입력해 주세요.'); }
    if (!validPhone(F('phone').value)) { markInvalid(F('phone')); return formAlert(alertEl, '휴대폰 번호를 확인해 주세요.'); }
    if (!validEmail(F('email').value.trim())) { markInvalid(F('email')); return formAlert(alertEl, '이메일 형식을 확인해 주세요.'); }
    const count = Number(F('count').value) || 0;
    if (count > SPACE[space].maxPeople) { markInvalid(F('count')); return formAlert(alertEl, `${SPACE[space].name}은 최대 ${SPACE[space].maxPeople}인이에요.`); }
    const consent = readConsent($('[data-consent-box]', f));
    if (!consent.ok) return formAlert(alertEl, '필수 동의 항목에 체크해 주세요.');
    const btn = $('#rentSubmit');
    setBusy(btn, true, '신청 중…');
    const time = `${toHM(selA)}–${toHM(selB)}`;
    try {
      const res = await api('rent', {
        space, date, time, name: F('name').value.trim(), phone: F('phone').value.trim(), email: F('email').value.trim(),
        purpose: F('purpose').value.trim(), count, estimate: estimate(space, count || 1, (selB - selA) / 60, selA) || '',
        consent, ref: refOut(), website: F('website').value
      });
      if (res.code) rememberCode({ code: res.code, title: `대관 · ${space}`, at: Date.now() });
      const p = kp(kst(date));
      f.outerHTML = `<div class="card-form done"><div class="done-icon">✓</div><h3>대관 신청이 접수됐어요</h3>
        <p class="muted">${esc(SPACE[space].name)} · ${p.m}월 ${p.d}일 (${WD[p.wd]}) ${time}</p>
        ${res.code ? `<div class="codecard">
          <span class="codecard-label">신청번호</span>
          <div class="code-box">${esc(res.code)} <button type="button" class="btn ghost sm" data-copy="${esc(res.code)}">복사</button></div>
          <p class="codecard-hint">이 번호와 휴대폰 번호로 상단 ‘내 신청’에서 대관 신청 상태를 확인하고 취소를 요청할 수 있어요.</p>
        </div>` : ''}
        <p class="muted small">담당자가 일정 확인 후 금액과 입금 방법을 안내드려요. 입금이 확인되면 예약이 확정됩니다.</p>
        ${res.code ? sentChips(res.notified, true) : ''}
        ${res.code ? `<a class="btn outline" href="${esc(BM.page('my/', `?code=${encodeURIComponent(res.code)}`))}">내 신청 확인</a>` : ''}</div>`;
      $('.book .done [data-copy]')?.addEventListener('click', e => BM.copy(e.currentTarget.dataset.copy, '신청번호를 복사했어요'));
      await loadBlocks();
    } catch (err) { formAlert(alertEl, err.message); setBusy(btn, false); }
  });

  async function loadBlocks() {
    try { rentBlocks = (await api('rentBlocks')).blocks || []; }
    catch (e) { console.warn('대관 현황 로딩 실패', e); toast('대관 현황을 불러오지 못했어요. 신청 후 담당자가 확인해 드려요.'); }
    renderMiniCal(); renderTimes();
  }

  // 모임 페이지 등에서 ?space=세미나실&date=2026-10-12 로 들어오면 미리 선택
  const q = new URLSearchParams(location.search);
  if (q.get('space') && SPACE[q.get('space')]) pickSpace(q.get('space'));
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '')) { date = q.get('date'); const i = months.indexOf(date.slice(0, 7)); if (i >= 0) mi = i; }
  renderMiniCal(); renderTimes();
  loadBlocks();
})();
