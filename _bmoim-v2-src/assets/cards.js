/* 비북스 b.moim v2 — 홍보 카드 · QR 생성기 (운영자용)
 * 같은 모임 데이터로 인스타 피드(4:5) · 스토리(9:16) · 월간 라인업 · 매장 QR을 만들고 PNG로 저장합니다.
 */
(() => {
  'use strict';
  const BM = window.BM;
  if (!BM || document.body.dataset.page !== 'cards') return;
  const { CFG, ITEMS, BY_SLUG, loadCounts, itemInfo, stateLabel, occ, esc, imgUrl, itemUrl, toast } = BM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const q = new URLSearchParams(location.search);
  const onlySlug = q.get('slug');
  let format = ['feed', 'story', 'lineup', 'qr'].includes(q.get('format')) ? q.get('format') : 'feed';
  let counts = null;
  const stage = $('#cardStage');
  const bare = u => u.replace(/^https?:\/\//, '').replace(/\?.*$/, '').replace(/\/$/, '');
  const hubUrl = bare(new URL(BM.REL || './', location.href).href);

  const items = () => ITEMS.filter(i => !onlySlug || i.slug === onlySlug);

  function seatBadge(item) {
    const info = itemInfo(item, counts);
    if (info.external || ['ended', 'closed'].includes(info.state)) return '';
    const label = stateLabel(info, item);
    return `<span class="promo-seat ${info.state === 'hot' || info.state === 'full' ? '' : 'calm'}">${esc(label)}</span>`;
  }
  function promoCard(item, kind) {
    return `<div class="promo ${kind}">
      <div class="promo-poster ${item.fit === 'contain' ? 'contain' : ''}">${item.fit === 'contain' ? `<img class="promo-bg" src="${esc(imgUrl(item.poster))}" alt="">` : ''}<img class="promo-img" src="${esc(imgUrl(item.poster))}" alt=""></div>
      <div class="promo-info">
        <div class="promo-brand">비북스 b.moim</div>
        <div class="promo-title">${esc(item.title)}</div>
        <div class="promo-meta">${esc(item.dateText)} · ${esc(item.spaceText)} · ${esc(item.priceText)}</div>
        ${seatBadge(item)}
        <div class="promo-url">${esc(bare(itemUrl(item)))}</div>
      </div>
    </div>`;
  }
  function lineupCard() {
    const rows = ITEMS.filter(i => occ(i).some(o => BM.ymd(o.start).startsWith(CFG.month.key))).map(i => {
      const first = occ(i).find(o => BM.ymd(o.start).startsWith(CFG.month.key));
      return `<div class="lu-row"><div class="lu-date">${esc(BM.fshort(first.start))}</div><div class="lu-name">${esc(i.title)}<small>${esc(BM.hm(first.start))} · ${esc(i.priceText)}${i.kind === 'event' ? ' · 행사' : ''}</small></div></div>`;
    }).join('');
    return `<div class="promo lineup">
      <div class="promo-brand">비북스 b.moim</div>
      <div class="lu-head">${esc(CFG.month.title)}</div>
      <div class="lu-sub">${esc(CFG.month.sub)}</div>
      <div class="lu-list">${rows}</div>
      <div class="lu-foot"><span>📍 부천 원미동 비북스</span><span>${esc(hubUrl)}</span></div>
    </div>`;
  }

  function fit() {
    $$('.card-frame').forEach(fr => {
      const card = fr.firstElementChild;
      const s = fr.clientWidth / 1080;
      card.style.transform = `scale(${s})`;
      fr.style.height = `${card.offsetHeight * s}px`;
    });
  }
  async function savePng(card, name) {
    if (!window.html2canvas) return toast('이미지 저장 도구를 불러오는 중이에요. 잠시 후 다시 눌러 주세요.');
    const clone = card.cloneNode(true);
    clone.style.transform = 'none';
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-20000px;top:0;';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      await Promise.all([...clone.querySelectorAll('img')].map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; })));
      const canvas = await window.html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#faf5ea', width: clone.offsetWidth, height: clone.offsetHeight });
      const a = document.createElement('a');
      a.download = `${name}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      console.warn(e);
      toast('이미지를 만들지 못했어요. 화면을 캡처해 주세요.');
    } finally { holder.remove(); }
  }

  function render() {
    $$('[data-format]').forEach(c => { const on = c.dataset.format === format; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    stage.classList.toggle('one', format === 'lineup' || !!onlySlug);
    if (format === 'qr') {
      const list = [{ title: `${CFG.month.title} 전체`, url: new URL(BM.page('', '?ref=qr_store'), location.href).href, slug: 'all' },
        ...items().map(i => ({ title: i.title, url: itemUrl(i, 'qr_store'), slug: i.slug }))];
      stage.innerHTML = list.map(x => `<div class="qr-card"><div class="qr" data-qr="${esc(x.url)}"></div><b>${esc(x.title)}</b><small class="muted">${esc(x.url.replace(/^https?:\/\//, ''))}</small><button type="button" class="btn ghost sm" data-qrsave="${esc(x.slug)}">QR 저장</button></div>`).join('');
      $$('[data-qr]').forEach(el => {
        if (window.QRCode) new window.QRCode(el, { text: el.dataset.qr, width: 360, height: 360, correctLevel: window.QRCode.CorrectLevel.M });
        else el.textContent = 'QR 도구 로딩 실패';
      });
      return;
    }
    const cells = format === 'lineup'
      ? [{ html: lineupCard(), name: `bmoim-${CFG.month.key}-lineup` }]
      : items().map(i => ({ html: promoCard(i, format), name: `bmoim-${i.slug}-${format}` }));
    stage.innerHTML = cells.map(c => `<div class="card-cell"><div class="card-frame">${c.html}</div><button type="button" class="btn ghost" data-save="${esc(c.name)}">⬇ PNG 저장</button></div>`).join('');
    requestAnimationFrame(fit);
    $$('.card-frame img').forEach(img => img.addEventListener('load', fit));
  }

  stage.addEventListener('click', e => {
    const b = e.target.closest('[data-save]');
    if (b) savePng(b.previousElementSibling.firstElementChild, b.dataset.save);
    const qb = e.target.closest('[data-qrsave]');
    if (qb) {
      const c = qb.parentElement.querySelector('canvas');
      if (!c) return;
      const a = document.createElement('a');
      a.download = `bmoim-qr-${qb.dataset.qrsave}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
    }
  });
  $$('[data-format]').forEach(c => c.addEventListener('click', () => { format = c.dataset.format; render(); }));
  window.addEventListener('resize', fit);
  if (onlySlug && BY_SLUG[onlySlug]) {
    const back = document.createElement('p');
    back.className = 'small';
    back.innerHTML = `‘${esc(BY_SLUG[onlySlug].title)}’ 카드만 보는 중 · <a href="./">전체 보기</a>`;
    $('.subhead').appendChild(back);
  }
  render();
  loadCounts().then(c => { counts = c; if (format !== 'qr') render(); });
})();
