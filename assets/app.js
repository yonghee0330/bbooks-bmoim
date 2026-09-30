/* 비북스 b.moim v2 — 공통 스크립트
 * 데이터: 페이지에 인라인된 #catalog (build.py가 data/*.json에서 생성)
 * 백엔드: config.apiUrl (Apps Script). 비어 있으면 테스트(데모) 모드 → 이 브라우저 localStorage에만 저장
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CAT = JSON.parse($('#catalog').textContent);
  const CFG = CAT.config;
  const ITEMS = CAT.items;
  const BY_SLUG = Object.fromEntries(ITEMS.map(i => [i.slug, i]));
  const REL = document.body.dataset.rel || '';
  const PAGE = document.body.dataset.page;
  const DEMO = !CFG.apiUrl;
  const SHEET = CFG.apiMode === 'sheet'; // 기존 구글 시트(webapp.gs) 연결 모드
  const WD = '일월화수목금토';
  const params = new URLSearchParams(location.search);
  // 폴더 주소(m/slug/)를 파일 주소로 바꿔야 하는 환경(공유용 페이지)에서는 indexFile='index.html'
  const page = (path = '', q = '') => REL + path + (CFG.indexFile && (path === '' || path.endsWith('/')) ? CFG.indexFile : '') + q;

  // ── 시간 (모든 계산은 한국 시간 기준) ─────────────────
  const pad = n => String(n).padStart(2, '0');
  function kst(s) {
    const [d, t = '00:00'] = s.split('T');
    const [y, m, dd] = d.split('-').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return Date.UTC(y, m - 1, dd, hh - 9, mm);
  }
  function kp(ms) {
    const d = new Date(ms + 9 * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
  }
  const NOW_OVERRIDE = params.get('now') || CFG.testNow || '';
  const nowMs = () => NOW_OVERRIDE ? kst(NOW_OVERRIDE.length === 10 ? NOW_OVERRIDE + 'T09:00' : NOW_OVERRIDE) : Date.now();
  const ymd = ms => { const p = kp(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
  const hm = ms => { const p = kp(ms); return `${pad(p.hh)}:${pad(p.mm)}`; };
  const fshort = ms => { const p = kp(ms); return `${p.m}/${p.d}(${WD[p.wd]})`; };
  const flong = ms => { const p = kp(ms); return `${p.m}월 ${p.d}일 (${WD[p.wd]})`; };
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = body => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const IC = {
    share: svg('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>'),
    link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
    image: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="m20.5 15-4.5-4.5L5 20.5"/>'),
    cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    down: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0"/>'),
    kakao: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.3-9-7.3z"/></svg>'
  };

  // ── 저장소 (실패해도 동작) ─────────────────────────
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 무시 */ } }
  };

  // 유입 경로 기록 (?ref=insta_story, ?utm_source=kakao …)
  const refIn = params.get('ref') || params.get('utm_source');
  if (refIn) store.sset('bmoim-ref', refIn.slice(0, 40));
  function refOut() {
    const r = store.sget('bmoim-ref');
    if (r) return r;
    try { const h = document.referrer && new URL(document.referrer).host; return h && h !== location.host ? h : 'direct'; } catch { return 'direct'; }
  }

  // ── 일정 · 정원 상태 ──────────────────────────────
  function occ(item) {
    return item.sessions.flatMap(s => s.dates.map(d => ({ sid: s.id, start: kst(d.start), end: kst(d.end), space: d.space })))
      .sort((a, b) => a.start - b.start);
  }
  function sessDateText(s) {
    const starts = s.dates.map(d => kst(d.start));
    return `${starts.map(fshort).join(' · ')} ${hm(starts[0])}–${hm(kst(s.dates[0].end))}`;
  }
  function sessInfo(item, s, counts) {
    const cap = s.capacity;
    const filled = counts ? (counts[`${item.slug}:${s.id}`] || 0) : 0;
    const remaining = Math.max(0, cap - filled);
    const first = kst(s.dates[0].start);
    const last = Math.max(...s.dates.map(d => kst(d.end)));
    const until = s.applyUntil ? kst(s.applyUntil) : first;
    const now = nowMs();
    const ended = now > last;
    const closed = item.status === 'closed' || now > until;
    const full = counts ? remaining <= 0 : false;
    return { cap, filled, remaining, ended, closed, full, open: !ended && !closed && !full, known: !!counts };
  }
  function itemInfo(item, counts) {
    const infos = item.sessions.map(s => sessInfo(item, s, item.applyUrl ? null : counts));
    const live = infos.filter(i => !i.ended);
    const open = infos.filter(i => i.open);
    const known = !!counts && !item.applyUrl;
    let state = 'open';
    if (!live.length) state = 'ended';
    else if (!open.length) state = live.some(i => i.full) ? 'full' : 'closed';
    else if (known && open.some(i => i.filled >= 3 && (i.remaining <= 2 || i.filled / i.cap >= 0.7))) state = 'hot';
    return {
      state, infos, known, external: !!item.applyUrl,
      remaining: open.reduce((a, i) => a + i.remaining, 0),
      single: open.length === 1 ? open[0] : null
    };
  }
  function stateLabel(info, item) {
    const ev = item.kind === 'event';
    if (info.state === 'ended') return ev ? '행사 종료' : '모임 종료';
    if (info.state === 'full') return '모집 완료';
    if (info.state === 'closed') return info.external ? '접수 마감' : '신청 마감';
    if (info.external) return '파트너 신청';
    if (!info.known) return '모집 중';
    const showSeats = info.single ? info.single.filled >= 3 : false;
    if (!showSeats) return '모집 중';
    if (info.state === 'hot') return info.single.remaining === 1 ? '마지막 1자리' : `마감 임박 · ${info.single.remaining}자리`;
    return `${info.single.remaining}자리 남음`;
  }
  function optionsOf(item, counts) {
    const opts = item.sessions.map(s => {
      const i = sessInfo(item, s, counts);
      return {
        type: 'session', id: s.id, price: s.price, sessionIds: [s.id], info: i,
        label: s.name || sessDateText(s),
        sub: s.name ? `${sessDateText(s)} · ${[...new Set(s.dates.map(d => d.space))].join('·')}` : [...new Set(s.dates.map(d => d.space))].join('·')
      };
    });
    (item.packages || []).forEach(p => {
      const infos = p.sessions.map(id => sessInfo(item, item.sessions.find(s => s.id === id), counts));
      opts.push({
        type: 'package', id: p.id, label: p.name, price: p.price, sessionIds: p.sessions,
        sub: p.sessions.map(id => fshort(kst(item.sessions.find(s => s.id === id).dates[0].start))).join(' + ') + ' 일괄',
        info: {
          open: infos.every(i => i.open), full: infos.some(i => i.full), ended: infos.some(i => i.ended),
          closed: infos.some(i => i.closed), remaining: Math.min(...infos.map(i => i.remaining)),
          filled: Math.max(0, ...infos.map(i => i.filled)), known: !!counts
        }
      });
    });
    return opts;
  }
  const optStatus = i => i.ended ? '종료' : i.full ? '모집 완료' : i.closed ? '신청 마감' : (i.known && i.filled >= 3 ? `${i.remaining}자리 남음` : '모집 중');
  // 포스터 왼쪽 위 배지 (동행클럽식 'n자리 남음')
  function badgeText(info) {
    if (info.state !== 'hot') return '';
    if (info.single) return info.single.remaining === 1 ? '마지막 1자리' : `${info.single.remaining}자리 남음`;
    return '마감 임박';
  }

  // ── API (실서버 / 데모) ────────────────────────────
  async function api(action, data = {}) {
    if (DEMO) { await sleep(350 + Math.random() * 300); return demo[action](data); }
    if (SHEET) {
      if (!sheetApi[action]) throw new Error('이 기능은 아직 준비 중이에요. 비북스 인스타그램 DM으로 문의해 주세요.');
      return sheetApi[action](data);
    }
    if (action === 'counts' || action === 'rentBlocks') {
      const r = await fetch(`${CFG.apiUrl}?${new URLSearchParams({ action, ...data })}`, { redirect: 'follow' });
      const out = await r.json();
      if (out.error) throw new Error(out.error);
      return out;
    }
    const r = await fetch(CFG.apiUrl, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data })
    });
    let out;
    try { out = await r.json(); } catch { throw new Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    if (out.error) throw new Error(out.error);
    return out;
  }


  // ── 기존 구글 시트 연결 (webapp.gs: apply · rent · count · hostStatus) ──
  // 기존 october.html과 같은 값(월·모임명·회차)을 같은 시트 열에 기록합니다.
  const SH = CFG.sheet || {};
  const sheetGet = async params => {
    const r = await fetch(`${CFG.apiUrl}?${new URLSearchParams(params)}`, { redirect: 'follow' });
    const out = await r.json();
    if (out.error) throw new Error(out.error);
    return out;
  };
  const sheetPost = async body => {
    const r = await fetch(CFG.apiUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    let out;
    try { out = JSON.parse(await r.text()); } catch { throw new Error('서버 응답을 읽을 수 없어요. 인스타그램 DM으로 문의해 주세요.'); }
    if (out.error) throw new Error(out.error);
    return out;
  };
  const sheetNow = () => new Date().toLocaleString('ko-KR');
  const isUnknown = e => /unknown action/i.test(String(e && e.message));
  // 새 액션(applyV2 등)을 먼저 보내고, 스크립트가 아직 업데이트 전이면 기존 액션으로 보냅니다
  async function sheetPostV2(v2body, legacyBody) {
    try { return await sheetPost(v2body); }
    catch (e) { if (legacyBody && isUnknown(e)) return sheetPost(legacyBody); throw e; }
  }
  const sheetName = item => item.sheetName || item.title;
  const sheetSession = s => s.sheetSession || s.id;
  const sheetPhone = p => { const d = normPhone(p); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : p; };
  const sheetApi = {
    async counts() {
      const monthsOf = item => item.sheetMonths || [SH.month];
      const months = [...new Set(ITEMS.flatMap(monthsOf))];
      const byMonth = {};
      for (const month of months) byMonth[month] = (await sheetGet({ action: 'count', month })).counts || {};
      // 시트 키(모임명_회차) → v2 키(slug:회차id). '10월10일'처럼 날짜로 바뀐 회차값은 날짜로 맞춥니다.
      const counts = {};
      ITEMS.forEach(item => {
        const nm = sheetName(item);
        item.sessions.forEach(s => {
          const day = ymd(kst(s.dates[0].start));
          let n = 0;
          monthsOf(item).forEach(month => {
            const c = byMonth[month] || {};
            if (c[`${nm}_${sheetSession(s)}`] != null) { n += c[`${nm}_${sheetSession(s)}`]; return; }
            Object.entries(c).forEach(([k, v]) => {
              if (!k.startsWith(nm + '_')) return;
              const t = Date.parse(k.slice(nm.length + 1));
              if (!Number.isNaN(t) && ymd(t) === day) n += v;
            });
          });
          counts[`${item.slug}:${s.id}`] = n;
        });
      });
      return { counts };
    },
    async apply(d) {
      const item = BY_SLUG[d.slug];
      const pkg = d.optionType === 'package' ? (item.packages || []).find(p => p.id === d.optionId) : null;
      const noteBase = [
        pkg ? (pkg.sheetNote || pkg.name) : '',
        d.memo ? `요청: ${d.memo}` : '',
        d.consent?.marketing ? '소식수신 동의' : '',
        d.ref && d.ref !== 'direct' ? `유입 ${d.ref}` : ''
      ].filter(Boolean).join(' · ');
      const sessions = d.sessionIds.map(id => item.sessions.find(s => s.id === id));
      for (let i = 0; i < sessions.length; i++) {
        const row = {
          month: SH.month, moimName: sheetName(item), session: sheetSession(sessions[i]),
          name: d.name, phone: sheetPhone(d.phone), amount: i === 0 ? d.amount : '',
          note: noteBase, books: i === 0 ? (d.extra || '') : '', date: sheetNow()
        };
        await sheetPostV2(
          { action: 'applyV2', ...row, email: d.email || '', consent: d.consent, ref: d.ref || '' },
          { action: 'apply', ...row, note: [noteBase, d.email ? `메일 ${d.email}` : ''].filter(Boolean).join(' · ') }
        );
      }
      return { ok: true, code: '', amount: d.amount, deadline: Date.now() + CFG.payDeadlineHours * 3600e3, notified: {} };
    },
    async rent(d) {
      const m = Number(d.date.slice(5, 7));
      const base = {
        month: `${m}월`, space: d.space, date: d.date, time: d.time,
        name: d.name, phone: sheetPhone(d.phone), count: d.count || '', reqDate: sheetNow()
      };
      const extra = [d.ref && d.ref !== 'direct' ? `유입 ${d.ref}` : ''];
      await sheetPostV2(
        { action: 'rentV2', ...base, purpose: d.purpose || '', email: d.email || '', consent: d.consent, ref: d.ref || '' },
        { action: 'rent', ...base, purpose: [d.purpose, d.consent?.marketing ? '소식수신 동의' : '', d.email ? `메일 ${d.email}` : '', ...extra].filter(Boolean).join(' · ') }
      );
      return { ok: true, code: '', notified: {} };
    },
    async hostApply(d) {
      try {
        await sheetPost({ action: 'hostApply', month: SH.month, ...d });
      } catch (e) {
        if (isUnknown(e)) { const err = new Error('fallback'); err.fallback = true; throw err; }
        throw e;
      }
      return { ok: true, code: '' };
    },
    async rentBlocks() {
      // 기존 페이지와 같은 방식(대관신청 탭)으로 날짜·공간·시간만 읽습니다
      const r = await fetch(SH.rentGviz, { redirect: 'follow' });
      const m = String(await r.text()).match(/setResponse\(([\s\S]*)\);/);
      const data = m ? JSON.parse(m[1]) : null;
      const blocks = [];
      (data?.table?.rows || []).forEach(row => {
        const c = row.c || [];
        if (!(SH.rentMonths || []).includes(c[1]?.v)) return;
        if (String(c[9]?.v || '').includes('취소')) return;
        const date = sheetDate(c[3]?.f || c[3]?.v);
        const time = String(c[4]?.v || '');
        if (date && time) blocks.push({ date, space: sheetSpace(c[2]?.v), time });
      });
      return { blocks };
    },
    async hostDashboard(d) {
      const code = String(d.token || '').trim();
      const groups = {};
      let hostName = '';
      let found = false;
      for (const month of SH.hostMonths || [SH.month]) {
        let r;
        try { r = await sheetGet({ action: 'hostStatus', code, month }); } catch { continue; }
        found = true;
        hostName = r.hostName || hostName;
        (r.groups || []).forEach(g => {
          (groups[g.moimName] ||= []).push(...(g.sessions || []).flatMap(s => s.applicants.map(a => ({ ...a, session: s.session }))));
        });
      }
      if (!found) throw new Error('코드가 올바르지 않거나 등록된 모임이 없어요. 비북스에 확인해 주세요.');
      return {
        host: { name: hostName }, updatedAt: Date.now(),
        moims: Object.entries(groups).map(([moimName, apps]) => {
          const item = ITEMS.find(i => sheetName(i) === moimName);
          const sess = item ? item.sessions : [{ id: '_', sheetSession: '', capacity: 0 }];
          return {
            slug: item?.slug || '', title: moimName,
            sessions: sess.map(s => ({
              id: s.id, label: item ? (s.name || sessDateText(s)) : '신청자', capacity: s.capacity,
              applicants: apps.filter(a => !item || item.sessions.length === 1 || String(a.session) === sheetSession(s)).map(a => ({
                name: maskName(a.name), phone: `***-${normPhone(a.phone).slice(-4)}`,
                status: a.cancelled ? '취소' : '신청', at: Date.parse(String(a.appliedAt).replace(/\./g, '/')) || nowMs(), memo: a.note || ''
              }))
            }))
          };
        })
      };
    }
  };
  function sheetDate(v) {
    const s = String(v || '').trim();
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) || s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (m) return `${m[1]}-${pad(Number(m[2]) + 1)}-${pad(m[3])}`;
    m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/); // 기존 코드는 7~9월만 인식하던 부분 — 모든 달로 확장
    if (m) return `${kp(nowMs()).y}-${pad(m[1])}-${pad(m[2])}`;
    return null;
  }
  function sheetSpace(v) {
    const s = String(v || '');
    if (s.includes('전체')) return '전체 대관';
    if (s.includes('계단') || s.includes('매장홀')) return '계단 좌석';
    if (s.includes('세미나')) return '세미나실';
    if (s.includes('테이블') || s.includes('매장')) return '매장 테이블';
    return s;
  }

  let countsPromise = null;
  function loadCounts(force) {
    if (!force && countsPromise) return countsPromise;
    if (!force) {
      const cached = store.sget('bmoim-counts');
      if (cached) {
        try {
          const c = JSON.parse(cached);
          if (Date.now() - c.at < 60e3) return (countsPromise = Promise.resolve(c.counts));
        } catch { /* 무시 */ }
      }
    }
    countsPromise = api('counts').then(r => {
      store.sset('bmoim-counts', JSON.stringify({ at: Date.now(), counts: r.counts }));
      return r.counts;
    }).catch(e => { console.warn('신청 현황 로딩 실패', e); return null; });
    return countsPromise;
  }

  // 데모 백엔드 — Apps Script와 같은 응답 형태를 흉내 냅니다
  const DEMO_KEY = 'bmoim-demo-v1';
  const demoDb = () => store.get(DEMO_KEY, { apps: [], rents: [], hosts: [] });
  const demoSave = db => store.set(DEMO_KEY, db);
  const normPhone = p => String(p || '').replace(/\D/g, '');
  const newCode = (prefix = 'BM') => prefix + '-' + Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const demo = {
    counts() {
      const c = { ...(CFG.demo?.counts || {}) };
      demoDb().apps.filter(a => !a.status.startsWith('취소')).forEach(a => a.sessionIds.forEach(sid => {
        const k = `${a.slug}:${sid}`; c[k] = (c[k] || 0) + 1;
      }));
      return { counts: c };
    },
    apply(d) {
      if (d.website) throw new Error('잘못된 요청입니다.');
      const item = BY_SLUG[d.slug];
      const counts = demo.counts().counts;
      const opt = optionsOf(item, counts).find(o => o.type === d.optionType && o.id === d.optionId);
      if (!opt || !opt.info.open) throw new Error('선택한 회차는 신청할 수 없어요. (모집 완료 또는 마감)');
      const db = demoDb();
      const code = newCode();
      const at = Date.now();
      db.apps.push({
        kind: 'moim', code, at, slug: d.slug, title: item.title, optionLabel: opt.label, sessionIds: opt.sessionIds,
        name: d.name, phone: normPhone(d.phone), email: d.email, amount: opt.price, status: '입금대기',
        memo: d.memo, extra: d.extra, marketing: d.consent?.marketing, ref: d.ref
      });
      demoSave(db);
      return { ok: true, code, amount: opt.price, deadline: at + CFG.payDeadlineHours * 3600e3, notified: { alimtalk: 'demo', email: d.email ? 'demo' : 'none' } };
    },
    lookup(d) {
      const db = demoDb();
      const phone = normPhone(d.phone);
      const code = String(d.code || '').trim().toUpperCase();
      const all = [...db.apps, ...db.rents].filter(a => a.phone === phone);
      if (!all.some(a => a.code === code)) throw new Error('일치하는 신청이 없어요. 신청번호와 휴대폰 번호를 확인해 주세요.');
      return { apps: all.map(publicApp) };
    },
    resend() { return { ok: true }; },
    cancelRequest(d) {
      const db = demoDb();
      const phone = normPhone(d.phone);
      const a = [...db.apps, ...db.rents].find(x => x.code === d.target && x.phone === phone);
      if (!a) throw new Error('신청을 찾지 못했어요.');
      a.status = '취소요청';
      demoSave(db);
      return { ok: true, status: a.status };
    },
    rentBlocks() {
      return { blocks: [...(CFG.demo?.rentBlocks || []), ...demoDb().rents.filter(r => !r.status.startsWith('취소')).map(r => ({ date: r.date, space: r.space, time: r.time }))] };
    },
    rent(d) {
      if (d.website) throw new Error('잘못된 요청입니다.');
      const db = demoDb();
      const code = newCode('BR');
      db.rents.push({ kind: 'rent', code, at: Date.now(), title: `대관 · ${d.space}`, optionLabel: `${d.date} ${d.time}`, space: d.space, date: d.date, time: d.time, name: d.name, phone: normPhone(d.phone), email: d.email, amount: 0, status: '접수' });
      demoSave(db);
      return { ok: true, code, notified: { alimtalk: 'demo', email: d.email ? 'demo' : 'none' } };
    },
    hostApply(d) {
      if (d.website) throw new Error('잘못된 요청입니다.');
      const db = demoDb();
      db.hosts.push({ at: Date.now(), ...d });
      demoSave(db);
      return { ok: true, code: newCode('BH') };
    },
    hostDashboard(d) {
      if (String(d.token).trim() !== (CFG.demo?.hostToken || 'demo')) throw new Error('유효하지 않은 링크예요. 비북스에 새 링크를 요청해 주세요.');
      const mine = ITEMS.filter(i => i.host?.insta === 'daon_gulbang');
      const counts = demo.counts().counts;
      const fakeNames = ['김*연', '이*준', '박*아', '최*호', '정*린', '한*솔', '윤*서', '조*우'];
      return {
        host: { name: '다온 글방 (체험용)' },
        updatedAt: Date.now(),
        moims: mine.map(item => ({
          slug: item.slug, title: item.title,
          sessions: item.sessions.map(s => {
            const n = counts[`${item.slug}:${s.id}`] || 0;
            const real = demoDb().apps.filter(a => a.slug === item.slug && a.sessionIds.includes(s.id));
            const list = Array.from({ length: n - real.length }, (_, k) => ({
              name: fakeNames[k % fakeNames.length], phone: `***-${String(1000 + k * 1379).slice(-4)}`,
              status: k % 3 === 2 ? '입금대기' : '입금확인', at: nowMs() - (k + 1) * 86400e3 / 2, option: s.name || sessDateText(s), memo: ''
            })).concat(real.map(a => ({ name: maskName(a.name), phone: `***-${a.phone.slice(-4)}`, status: a.status, at: a.at, option: a.optionLabel, memo: a.memo || '' })));
            return { id: s.id, label: s.name || sessDateText(s), capacity: s.capacity, applicants: list };
          })
        }))
      };
    }
  };
  function publicApp(a) {
    return { kind: a.kind, code: a.code, at: a.at, slug: a.slug, title: a.title, optionLabel: a.optionLabel, amount: a.amount, status: a.status, name: a.name, deadline: a.at + CFG.payDeadlineHours * 3600e3 };
  }
  const maskName = n => { n = String(n || ''); return n.length <= 1 ? n : n.length === 2 ? n[0] + '*' : n[0] + '*'.repeat(n.length - 2) + n.slice(-1); };

  // ── UI 도우미 ────────────────────────────────────
  function toast(msg) {
    $$('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }
  async function copy(text, msg = '복사했어요') {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* 무시 */ }
      ta.remove();
    }
    toast(msg);
  }
  function openSheet({ title, sub = '', html = '' }) {
    const prevFocus = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
      <div class="sheet-head"><div><h2 id="sheetTitle">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button type="button" class="x" aria-label="닫기">✕</button></div>
      <div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const close = () => {
      ov.remove();
      if (!$('.ov')) document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('.x', ov).addEventListener('click', close);
    setTimeout(() => ($('input,select,textarea,button:not(.x)', ov) || $('.x', ov)).focus({ preventScroll: true }), 30);
    return { ov, body: $('.sheet-body', ov), close };
  }
  function lightbox(src, alt = '') {
    const lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', '포스터 크게 보기');
    lb.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}">`;
    const close = () => { lb.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
    const k = e => { if (e.key === 'Escape') close(); };
    lb.addEventListener('click', close);
    document.addEventListener('keydown', k);
    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
  }
  const imgUrl = name => (/^https?:/.test(CFG.imageBase) ? CFG.imageBase.replace(/\/?$/, '/') : REL + CFG.imageBase) + name;
  const absUrl = path => new URL(path, location.href).href;
  function setBusy(btn, busy, label) {
    if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label || '처리 중…')}`; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.label || label || ''; }
  }
  function formAlert(el, msg, ok) { el.className = 'form-alert' + (ok ? ' ok' : ''); el.textContent = msg || ''; }

  // 휴대폰 자동 하이픈
  function fmtPhone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  }
  const validPhone = v => /^01[016789]\d{7,8}$/.test(normPhone(v));
  const validEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  document.addEventListener('input', e => {
    if (e.target.matches('input[type="tel"]')) {
      const pos = e.target.value.length;
      e.target.value = fmtPhone(e.target.value);
      if (pos === e.target.value.length) e.target.setSelectionRange?.(pos, pos);
    }
    e.target.closest?.('.field')?.classList.remove('invalid');
  });
  function markInvalid(input) { input.closest('.field')?.classList.add('invalid'); input.focus(); }

  // ── 개인정보 동의 블록 ─────────────────────────────
  let cid = 0;
  function consentHTML(kind) {
    const p = CFG.privacy;
    const id = ++cid;
    const host = kind === 'host';
    const items = host ? '이름·활동명, 휴대폰 번호, 이메일, 인스타그램 계정, 모임 정보' : p.items;
    const purpose = host ? '모임 개설 협의, 모임 페이지 제작, 신청 현황 공유, 정산 연락' : p.purpose;
    return `<div class="consent" data-consent-box>
      <label class="consent-all"><input type="checkbox" data-c="all"> 아래 내용에 모두 동의해요</label>
      <div class="consent-row"><input type="checkbox" id="cp${id}" data-c="privacy"><label for="cp${id}"><span class="req">[필수]</span> 개인정보 수집·이용 동의</label><button type="button" class="consent-more" aria-expanded="false" aria-controls="cpd${id}">보기</button></div>
      <dl class="consent-detail" id="cpd${id}" hidden>
        <dt>수집 항목</dt><dd>${esc(items)}</dd>
        <dt>이용 목적</dt><dd>${esc(purpose)}</dd>
        <dt>보유 기간</dt><dd>${esc(p.retention)}</dd>
        ${kind === 'apply' ? `<dt>호스트 공유</dt><dd>${esc(p.hostShare)}</dd>` : ''}
        <dd class="muted">${esc(p.refuse)}</dd>
      </dl>
      ${host ? '' : `<div class="consent-row"><input type="checkbox" id="cr${id}" data-c="refund"><label for="cr${id}"><span class="req">[필수]</span> 환불 규정을 확인했어요</label></div>`}
      <div class="consent-row"><input type="checkbox" id="cm${id}" data-c="marketing"><label for="cm${id}"><span class="opt-tag">[선택]</span> 다음 모임·행사 소식 받기</label><button type="button" class="consent-more" aria-expanded="false" aria-controls="cmd${id}">보기</button></div>
      <dl class="consent-detail" id="cmd${id}" hidden><dd>${esc(p.marketing)}</dd></dl>
    </div>`;
  }
  function bindConsent(root) {
    const all = $('[data-c="all"]', root);
    const boxes = $$('input[data-c]:not([data-c="all"])', root);
    all.addEventListener('change', () => boxes.forEach(b => { b.checked = all.checked; }));
    boxes.forEach(b => b.addEventListener('change', () => { all.checked = boxes.every(x => x.checked); root.classList.remove('invalid'); }));
    $$('.consent-more', root).forEach(btn => btn.addEventListener('click', () => {
      const d = document.getElementById(btn.getAttribute('aria-controls'));
      d.hidden = !d.hidden;
      btn.setAttribute('aria-expanded', String(!d.hidden));
      btn.textContent = d.hidden ? '보기' : '접기';
    }));
  }
  function readConsent(root) {
    const v = k => !!$(`[data-c="${k}"]`, root)?.checked;
    const need = $$('[data-c="refund"]', root).length ? ['privacy', 'refund'] : ['privacy'];
    return { privacy: v('privacy'), refund: v('refund'), marketing: v('marketing'), ok: need.every(v), at: new Date().toISOString() };
  }
  function mountConsents(scope = document) {
    $$('[data-consent]', scope).forEach(el => {
      if (el.dataset.mounted) return;
      el.innerHTML = consentHTML(el.dataset.consentKind || (PAGE === 'space' ? 'rent' : 'apply'));
      el.dataset.mounted = '1';
      bindConsent(el);
    });
  }

  function privacySheet() {
    const p = CFG.privacy;
    openSheet({
      title: '개인정보 처리 안내', sub: '비북스 b.moim 신청 시 수집하는 정보',
      html: `<dl class="consent-detail" style="margin:0">
        <dt>수집 항목</dt><dd>${esc(p.items)}</dd><dt>이용 목적</dt><dd>${esc(p.purpose)}</dd>
        <dt>보유 기간</dt><dd>${esc(p.retention)}</dd><dt>호스트 공유</dt><dd>${esc(p.hostShare)}</dd>
        <dt>동의 거부</dt><dd>${esc(p.refuse)}</dd><dt>소식 받기(선택)</dt><dd>${esc(p.marketing)}</dd>
        <dt>문의 · 삭제 요청</dt><dd>비북스 인스타그램 @${esc(CFG.store.instagram)} DM</dd></dl>`
    });
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-privacy]')) { e.preventDefault(); privacySheet(); }
  });

  // ── 데모 안내 띠 ──────────────────────────────────
  if (DEMO) {
    $('#demoBar').innerHTML = `<div class="demo-bar"><b>테스트 모드</b> 신청·알림은 실제로 접수·발송되지 않고 이 브라우저에만 저장돼요 · <a href="#" data-demo-reset>테스트 데이터 초기화</a>${NOW_OVERRIDE ? ` · 기준 시각 ${esc(NOW_OVERRIDE)}` : ''}</div>`;
    $('[data-demo-reset]').addEventListener('click', e => {
      e.preventDefault();
      store.set(DEMO_KEY, { apps: [], rents: [], hosts: [] }); store.set('bmoim-recent', []);
      try { sessionStorage.removeItem('bmoim-counts'); } catch { /* 무시 */ }
      location.reload();
    });
  } else if (NOW_OVERRIDE) {
    $('#demoBar').innerHTML = `<div class="demo-bar">기준 시각 ${esc(NOW_OVERRIDE)} 로 보는 중</div>`;
  }

  // ── 공유 · 캘린더 추가 ─────────────────────────────
  function itemUrl(item, ref) {
    const u = new URL(page(item.url), location.href);
    if (ref) u.searchParams.set('ref', ref);
    return u.href;
  }
  let kakaoReady = null;
  function loadKakao() {
    if (!CFG.kakaoJsKey) return Promise.reject(new Error('no key'));
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = () => { try { if (!window.Kakao.isInitialized()) window.Kakao.init(CFG.kakaoJsKey); res(window.Kakao); } catch (e) { rej(e); } };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return kakaoReady;
  }
  function openShare(item) {
    const url = itemUrl(item, 'share');
    const text = `${item.title} · ${item.dateText}\n${item.oneLiner || ''}`;
    const canNative = !!navigator.share;
    const { body, close } = openSheet({
      title: '공유하기', sub: '링크를 받은 사람은 바로 모임 페이지로 들어와요',
      html: `<div class="share-preview"><img src="${esc(imgUrl(item.poster))}" alt=""><div><b>${esc(item.title)}</b><small>${esc(item.dateText)} · ${esc(item.priceText)}</small></div></div>
      <div class="share-list">
        ${CFG.kakaoJsKey ? `<button type="button" class="share-item" data-s="kakao"><span class="share-ico kakao">${IC.kakao}</span><span>카카오톡으로 보내기<small>포스터 카드와 신청 버튼이 함께 가요</small></span></button>` : ''}
        ${canNative ? `<button type="button" class="share-item" data-s="native"><span class="share-ico">${IC.share}</span><span>다른 앱으로 공유<small>인스타 DM · 문자 · 카톡 등</small></span></button>` : ''}
        <button type="button" class="share-item" data-s="copy"><span class="share-ico">${IC.link}</span><span>링크 복사<small>${esc(url.replace(/^https?:\/\//, ''))}</small></span></button>
        <a class="share-item" href="${esc(page('cards/', `?slug=${encodeURIComponent(item.slug)}&format=story`))}"><span class="share-ico">${IC.image}</span><span>인스타 스토리 이미지 만들기<small>남은 자리가 들어간 9:16 이미지를 저장해요</small></span></a>
      </div>`
    });
    body.addEventListener('click', async e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'copy') { copy(url, '링크를 복사했어요'); close(); }
      if (b.dataset.s === 'native') { try { await navigator.share({ title: item.title, text, url }); close(); } catch { /* 취소 */ } }
      if (b.dataset.s === 'kakao') {
        try {
          const K = await loadKakao();
          const kurl = itemUrl(item, 'kakao');
          K.Share.sendDefault({
            objectType: 'feed',
            content: { title: item.title, description: `${item.dateText} · ${item.priceText}`, imageUrl: absUrl(imgUrl(item.poster)), link: { mobileWebUrl: kurl, webUrl: kurl } },
            buttons: [{ title: '모임 보고 신청하기', link: { mobileWebUrl: kurl, webUrl: kurl } }]
          });
          close();
        } catch { toast('카카오톡 공유를 열지 못했어요. 링크 복사를 이용해 주세요.'); }
      }
    });
  }
  function gcalUrl(item, o) {
    const f = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const q = new URLSearchParams({
      action: 'TEMPLATE', text: `${item.title} · 비북스`, dates: `${f(o.start)}/${f(o.end)}`,
      details: `${item.summary || item.oneLiner || ''}\n${itemUrl(item)}`, location: `비북스 ${o.space}, ${CFG.store.address}`, ctz: 'Asia/Seoul'
    });
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  function openAddCal(item) {
    const list = occ(item).map(o => `<a class="share-item" href="${esc(gcalUrl(item, o))}" target="_blank" rel="noopener"><span class="share-ico">${IC.cal}</span><span>구글 캘린더 · ${esc(flong(o.start))} ${hm(o.start)}<small>${esc(o.space)}</small></span></a>`).join('');
    openSheet({
      title: '캘린더에 추가', sub: item.title,
      html: `<div class="share-list">${list}
        <a class="share-item" href="${esc(REL + item.url)}event.ics" download><span class="share-ico">${IC.down}</span><span>아이폰 · 아웃룩 캘린더 (.ics)<small>일정 파일을 내려받아 열면 추가돼요</small></span></a>
        <a class="share-item" href="${esc(REL)}bmoim.ics"><span class="share-ico">${IC.bell}</span><span>비모임 전체 일정 구독<small>새 모임이 생기면 캘린더에 자동으로 들어와요</small></span></a>
      </div>`
    });
  }

  // ── 신청 시트 ─────────────────────────────────────
  const recentKey = 'bmoim-recent';
  function rememberCode(entry) {
    const list = store.get(recentKey, []).filter(x => x.code !== entry.code);
    list.unshift(entry);
    store.set(recentKey, list.slice(0, 6));
  }
  async function openApply(item, preselect) {
    const counts = await loadCounts();
    const opts = optionsOf(item, counts);
    const openOpts = opts.filter(o => o.info.open);
    if (!openOpts.length) { toast('지금은 신청할 수 있는 회차가 없어요'); return; }
    const pick = opts.length > 1;
    const defaultOpt = (preselect && openOpts.find(o => o.id === preselect)) || (openOpts.length === 1 ? openOpts[0] : null);
    const optHtml = pick ? `<div class="field"><span>회차 선택 *</span><div class="opts" role="radiogroup">${opts.map(o => `
      <label class="opt${o.info.open ? '' : ' disabled'}"><input type="radio" name="opt" value="${o.type}:${o.id}" ${o.info.open ? '' : 'disabled'} ${defaultOpt === o ? 'checked' : ''}>
        <span class="opt-main"><b>${esc(o.label)}</b><small>${esc(o.sub)} · ${esc(optStatus(o.info))}</small></span><span class="opt-price">${won(o.price)}</span></label>`).join('')}</div></div>` : '';
    const ex = item.extraField;
    const { body, close } = openSheet({
      title: item.title, sub: pick ? `${item.dateText}` : `${opts[0].label}${opts[0].sub ? ' · ' + opts[0].sub : ''}`,
      html: `<form class="form" novalidate>
        ${optHtml}
        <div class="row2">
          <label class="field"><span>이름 *</span><input name="name" autocomplete="name" required></label>
          <label class="field"><span>휴대폰 *</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" required></label>
        </div>
        <label class="field"><span>이메일 <small class="muted">${SHEET ? '(선택 · 모임 안내와 비북스 소식을 메일로 받아요)' : '(선택 · 안내 메일을 함께 받아요)'}</small></span><input name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
        ${ex ? `<label class="field"><span>${esc(ex.label)}</span>${ex.hint ? `<p class="hint">${esc(ex.hint)}</p>` : ''}<textarea name="extra" rows="2" placeholder="${esc(ex.placeholder || '')}"></textarea></label>` : ''}
        <label class="field"><span>호스트에게 한마디 <small class="muted">(선택)</small></span><textarea name="memo" rows="2" placeholder="알레르기, 동반 인원, 궁금한 점 등"></textarea></label>
        <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div data-consent data-consent-kind="apply"></div>
        <div class="paybox" data-paybox hidden>
          <div class="paybox-row"><span>입금할 금액</span><span class="muted">신청 후 ${CFG.payDeadlineHours}시간 안에</span></div>
          <div class="paybox-amount" data-amount></div>
          <div class="paybox-bank"><span>${esc(CFG.bank.name)} <b>${esc(CFG.bank.number)}</b><br><small class="muted">예금주 ${esc(CFG.bank.holder)} · 입금자명은 신청자 이름으로</small></span></div>
        </div>
        <div class="form-alert" role="alert"></div>
        <button class="btn primary big" type="submit">신청하기</button>
        <p class="muted small" style="text-align:center;margin:0">${SHEET ? '입금이 확인되면 비북스가 연락드려요. 문의는 인스타그램 DM으로 해 주세요.' : '신청 직후 카카오 알림톡으로 신청번호와 입금 안내를 보내드려요.'}</p>
      </form>`
    });
    const form = $('form', body);
    mountConsents(form);
    const alertEl = $('.form-alert', form);
    const submitBtn = $('button[type="submit"]', form);
    const current = () => {
      if (!pick) return opts[0];
      const v = $('input[name="opt"]:checked', form)?.value;
      return v ? opts.find(o => `${o.type}:${o.id}` === v) : null;
    };
    const refresh = () => {
      const o = current();
      $('[data-paybox]', form).hidden = !o;
      if (o) { $('[data-amount]', form).textContent = won(o.price); submitBtn.textContent = `신청하기 · ${won(o.price)}`; }
    };
    form.addEventListener('change', e => { if (e.target.name === 'opt') refresh(); });
    refresh();

    const F = n => form.elements.namedItem(n);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      formAlert(alertEl, '');
      const o = current();
      const name = F('name').value.trim();
      const phone = F('phone').value.trim();
      const email = F('email').value.trim();
      if (!o) return formAlert(alertEl, '회차를 선택해 주세요.');
      if (!name) { markInvalid(F('name')); return formAlert(alertEl, '이름을 입력해 주세요.'); }
      if (!validPhone(phone)) { markInvalid(F('phone')); return formAlert(alertEl, '휴대폰 번호를 확인해 주세요. (알림톡이 이 번호로 가요)'); }
      if (!validEmail(email)) { markInvalid(F('email')); return formAlert(alertEl, '이메일 형식을 확인해 주세요.'); }
      const consentBox = $('[data-consent-box]', form);
      const consent = readConsent(consentBox);
      if (!consent.ok) { consentBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); return formAlert(alertEl, '필수 동의 항목에 체크해 주세요.'); }
      setBusy(submitBtn, true, '신청 중…');
      try {
        const res = await api('apply', {
          slug: item.slug, title: item.title, optionType: o.type, optionId: o.id, optionLabel: o.label, sessionIds: o.sessionIds,
          amount: o.price, name, phone, email, extra: F('extra')?.value.trim() || '', memo: F('memo').value.trim(),
          consent, ref: refOut(), website: F('website').value
        });
        if (res.code) rememberCode({ code: res.code, title: item.title, at: Date.now() });
        store.sset('bmoim-counts', '');
        countsPromise = null;
        showDone(body, item, o, res, name, close);
        document.dispatchEvent(new CustomEvent('bmoim:applied'));
      } catch (err) {
        formAlert(alertEl, err.message || '신청 중 문제가 생겼어요. 인스타그램 DM으로 문의해 주세요.');
        setBusy(submitBtn, false);
      }
    });
  }
  function sentChips(n, demoNote) {
    const lab = { sent: '보냄', demo: '테스트', skipped: '미설정', failed: '실패', none: '' };
    const chips = [];
    if (n?.alimtalk) chips.push(`<span class="${n.alimtalk === 'sent' ? 'ok' : ''}">알림톡 ${lab[n.alimtalk] || n.alimtalk}</span>`);
    if (n?.email && n.email !== 'none') chips.push(`<span class="${n.email === 'sent' ? 'ok' : ''}">메일 ${lab[n.email] || n.email}</span>`);
    return `<div class="sent">${chips.join('')}</div>${DEMO && demoNote ? '<p class="muted small">테스트 모드라 실제 알림은 발송되지 않았어요.</p>' : ''}`;
  }
  function showDone(body, item, o, res, name, close) {
    const deadline = res.deadline ? `${flong(res.deadline)} ${hm(res.deadline)}까지` : `${CFG.payDeadlineHours}시간 안에`;
    body.innerHTML = `<div class="done">
      <div class="done-icon">✓</div>
      <h3>신청이 접수됐어요</h3>
      <p class="muted">입금이 확인되면 신청이 확정돼요.</p>
      ${res.code ? `<div class="code-box">${esc(res.code)} <button type="button" class="btn ghost sm" data-copy="${esc(res.code)}">복사</button></div>` : '<div style="height:12px"></div>'}
      <div class="paybox">
        <div class="paybox-row"><span>입금할 금액</span><span class="muted">${esc(deadline)}</span></div>
        <div class="paybox-amount">${won(res.amount ?? o.price)}</div>
        <div class="paybox-bank"><span>${esc(CFG.bank.name)} <b>${esc(CFG.bank.number)}</b><br><small class="muted">예금주 ${esc(CFG.bank.holder)} · 입금자명 <b>${esc(name)}</b></small></span>
          <button type="button" class="btn dark sm" data-copy="${esc(CFG.bank.name + ' ' + CFG.bank.number)}">계좌 복사</button></div>
      </div>
      ${res.code ? sentChips(res.notified, true) : `<p class="muted small" style="margin-top:12px">입금 확인 후 비북스가 연락드려요. 취소·변경은 인스타그램 <a href="https://instagram.com/${esc(CFG.store.instagram)}" target="_blank" rel="noopener">@${esc(CFG.store.instagram)}</a> DM으로 알려 주세요.</p>`}
      <div class="done-actions"${res.code ? '' : ' style="grid-template-columns:1fr"'}>
        <button type="button" class="btn outline" data-a="cal">${IC.cal} 캘린더에 추가</button>
        ${res.code ? `<a class="btn outline" href="${esc(page('my/', `?code=${encodeURIComponent(res.code)}`))}">내 신청 확인</a>` : ''}
      </div>
      <button type="button" class="btn primary big" style="margin-top:8px" data-a="share">함께 갈 친구에게 공유하기</button>
    </div>`;
    body.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]');
      if (c) copy(c.dataset.copy);
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'cal') { close(); openAddCal(item); }
      if (a?.dataset.a === 'share') { close(); openShare(item); }
    });
  }

  // ── 카드 상태 표시 (허브 · 다른 모임) ─────────────────
  function paintCards(counts) {
    $$('.card[data-slug]').forEach(card => {
      const item = BY_SLUG[card.dataset.slug];
      if (!item) return;
      const info = itemInfo(item, counts);
      const label = stateLabel(info, item);
      const closed = ['ended', 'full', 'closed'].includes(info.state);
      const badge = $('[data-badge]', card);
      const bt = info.external && !closed ? '파트너 신청' : badgeText(info);
      badge.hidden = !bt;
      badge.textContent = bt;
      badge.className = 'ribbon' + (info.external ? ' dark' : '');
      const dim = $('[data-dim]', card);
      dim.hidden = !closed;
      dim.textContent = label;
      card.classList.toggle('is-closed', closed);
      const seats = $('[data-seats]', card);
      seats.className = 'seats';
      if (info.external) seats.textContent = `선착순 ${item.sessions[0].capacity}명`;
      else if (closed) { seats.textContent = label; seats.classList.add('off'); }
      else if (info.known && info.single && info.single.filled >= 3) {
        seats.textContent = `남은 자리 ${info.single.remaining}/${info.single.cap}`;
        if (info.state === 'hot') seats.classList.add('hot');
      } else if (info.known) seats.textContent = '모집 중';
      card.dataset.state = info.state;
    });
  }

  // ── 허브 ──────────────────────────────────────────
  function initHub() {
    const main = $('#main');
    const listEl = $('#viewList');
    const calEl = $('#viewCal');
    const emptyEl = $('#emptyNote');
    let counts = null;
    const st = { cat: 'all', status: 'open', sort: 'date', when: '', view: 'list' };

    const weekRange = () => {
      const p = kp(nowMs());
      const todayStart = kst(`${p.y}-${pad(p.m)}-${pad(p.d)}T00:00`);
      const monday = todayStart - ((p.wd + 6) % 7) * 86400e3;
      return [nowMs(), monday + 7 * 86400e3];
    };
    const isOpen = item => ['open', 'hot'].includes(itemInfo(item, counts).state);
    function matchBase(item) {
      if (st.cat !== 'all' && !(item.tags || []).includes(st.cat)) return false;
      if (!st.when) return true;
      const os = occ(item).filter(o => o.end > nowMs());
      if (st.when === 'week') { const [a, b] = weekRange(); return os.some(o => o.start < b && o.end > a); }
      if (st.when === 'weekend') return os.some(o => [0, 6].includes(kp(o.start).wd));
      if (st.when === 'evening') return os.some(o => ![0, 6].includes(kp(o.start).wd) && kp(o.start).hh >= 18);
      return true;
    }
    function match(item) {
      if (!matchBase(item)) return false;
      if (st.status === 'open') return isOpen(item);
      if (st.status === 'closed') return !isOpen(item);
      return true;
    }
    const nextStart = item => (occ(item).find(o => o.end > nowMs()) || occ(item)[0]).start;
    const minPrice = item => Math.min(...item.sessions.map(s => s.price), ...(item.packages || []).map(p => p.price));
    const scarcity = item => {
      const info = itemInfo(item, counts);
      if (!info.known || !isOpen(item)) return 999;
      return Math.min(...info.infos.filter(i => i.open).map(i => i.remaining));
    };
    function cmp(a, b) {
      const ia = BY_SLUG[a.dataset.slug], ib = BY_SLUG[b.dataset.slug];
      const oa = isOpen(ia) ? 0 : 1, ob = isOpen(ib) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      if (st.sort === 'hot') { const d = scarcity(ia) - scarcity(ib); if (d) return d; }
      if (st.sort === 'price') { const d = minPrice(ia) - minPrice(ib); if (d) return d; }
      return nextStart(ia) - nextStart(ib);
    }
    function apply() {
      const cards = $$('.card', listEl);
      cards.sort(cmp).forEach(c => listEl.appendChild(c));
      let shown = 0;
      cards.forEach(c => { const ok = match(BY_SLUG[c.dataset.slug]); c.hidden = !ok; if (ok) shown++; });
      const base = ITEMS.filter(matchBase);
      $('[data-count="open"]').textContent = base.filter(isOpen).length;
      $('[data-count="all"]').textContent = base.length;
      $('[data-count="closed"]').textContent = base.filter(i => !isOpen(i)).length;
      const cal = st.view === 'cal';
      main.classList.toggle('is-cal', cal);
      $$('.nav[data-nav="hub"], .nav[data-nav="cal"]').forEach(n => {
        const on = (n.dataset.nav === 'cal') === cal;
        n.classList.toggle('on', on);
        if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
      });
      listEl.hidden = cal; calEl.hidden = !cal;
      emptyEl.hidden = shown > 0 || cal;
      if (cal) renderCal();
    }
    const press = (sel, attr, val) => $$(sel).forEach(b => { const on = b.dataset[attr] === val; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });

    $$('.spine[data-cat]').forEach(b => b.addEventListener('click', () => {
      st.cat = b.dataset.cat; press('.spine[data-cat]', 'cat', st.cat);
      b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      apply();
    }));
    $$('.itab[data-status]').forEach(b => b.addEventListener('click', () => { st.status = b.dataset.status; press('.itab[data-status]', 'status', st.status); apply(); }));
    $('[data-sort-select]').addEventListener('change', e => { st.sort = e.target.value; apply(); });
    $$('.when[data-when]').forEach(b => b.addEventListener('click', () => {
      st.when = st.when === b.dataset.when ? '' : b.dataset.when;
      press('.when[data-when]', 'when', st.when); apply();
    }));
    $('[data-show-all]').addEventListener('click', () => {
      st.cat = 'all'; st.status = 'all'; st.when = '';
      press('.spine[data-cat]', 'cat', 'all'); press('.itab[data-status]', 'status', 'all'); press('.when[data-when]', 'when', '');
      apply();
    });
    function setView(v) {
      st.view = v;
      press('.vs[data-view]', 'view', v);
      store.set('bmoim-view', v);
      history.replaceState(null, '', v === 'cal' ? '#cal' : location.pathname + location.search);
      apply();
    }
    $$('.vs[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    // 상단 메뉴 '이번 달 모임' / '일정 달력' — 같은 페이지 안에서 전환
    $$('.nav[data-nav="hub"], .nav[data-nav="cal"]').forEach(n => n.addEventListener('click', e => {
      e.preventDefault();
      setView(n.dataset.nav === 'cal' ? 'cal' : 'list');
      $('#toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    window.addEventListener('hashchange', () => setView(location.hash === '#cal' ? 'cal' : 'list'));

    // 캘린더 (상태 구분 없이 분야·언제 필터만 적용, 마감은 흐리게)
    const months = CFG.month.calendarMonths;
    const todayYmd = ymd(nowMs());
    let mi = Math.max(0, months.indexOf(todayYmd.slice(0, 7)));
    let selDay = null;
    function dayEvents() {
      const map = {};
      ITEMS.filter(matchBase).forEach(item => {
        const info = itemInfo(item, counts);
        occ(item).forEach(o => {
          const sInfo = item.applyUrl ? { full: false } : sessInfo(item, item.sessions.find(s => s.id === o.sid), counts);
          (map[ymd(o.start)] ||= []).push({ item, o, off: sInfo.full || ['ended', 'closed', 'full'].includes(info.state), state: info.state });
        });
      });
      Object.values(map).forEach(l => l.sort((a, b) => a.o.start - b.o.start));
      return map;
    }
    function renderCal() {
      const [y, m] = months[mi].split('-').map(Number);
      const map = dayEvents();
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (!selDay || !selDay.startsWith(months[mi])) {
        const withEv = Object.keys(map).filter(d => d.startsWith(months[mi]) && d >= todayYmd).sort();
        selDay = todayYmd.startsWith(months[mi]) && map[todayYmd] ? todayYmd : (withEv[0] || Object.keys(map).filter(d => d.startsWith(months[mi])).sort()[0] || null);
      }
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<div class="cal-cell out" aria-hidden="true"></div>';
      for (let d = 1; d <= days; d++) {
        const key = `${months[mi]}-${pad(d)}`;
        const wd = (first + d - 1) % 7;
        const evs = map[key] || [];
        const cls = ['cal-cell', wd === 0 ? 'sun' : '', wd === 6 ? 'sat' : '', key === todayYmd ? 'today' : '', key < todayYmd ? 'past' : '', key === selDay ? 'sel' : ''].filter(Boolean).join(' ');
        const evHtml = evs.slice(0, 3).map(e => `<span class="cal-ev${e.off ? ' off' : ''}" style="--cat:${e.item.color}">${hm(e.o.start)} ${esc(e.item.short || e.item.title)}</span>`).join('') + (evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : '');
        const dots = evs.map(e => `<i style="--cat:${e.item.color}"></i>`).join('');
        cells += `<button type="button" class="${cls}" data-day="${key}" aria-label="${m}월 ${d}일${evs.length ? `, 일정 ${evs.length}개` : ''}" aria-pressed="${key === selDay}"><span class="cal-d">${d}</span>${evHtml}<span class="cal-dots">${dots}</span></button>`;
      }
      const tail = (7 - ((first + days) % 7)) % 7;
      for (let i = 0; i < tail; i++) cells += '<div class="cal-cell out" aria-hidden="true"></div>';
      const agenda = selDay ? (map[selDay] || []) : [];
      const sp = selDay ? kp(kst(selDay)) : null;
      calEl.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav" data-nav="-1" ${mi === 0 ? 'disabled' : ''} aria-label="이전 달">‹</button>
          <strong>${y}년 ${m}월</strong>
          <button type="button" class="cal-nav" data-nav="1" ${mi === months.length - 1 ? 'disabled' : ''} aria-label="다음 달">›</button>
        </div>
        <div class="cal-grid">${[...WD].map((w, i) => `<div class="cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('')}${cells}</div>
        <div class="cal-agenda" aria-live="polite">
          ${selDay ? `<h3>${sp.m}월 ${sp.d}일 ${WD[sp.wd]}요일</h3>` : ''}
          ${agenda.length ? `<ul class="agenda-list">${agenda.map(e => `<li class="agenda-item${e.off ? ' off' : ''}" style="--cat:${e.item.color}"><a href="${esc(page(e.item.url))}">
            <span class="agenda-time">${hm(e.o.start)}<small>${hm(e.o.end)}</small></span>
            <img src="${esc(imgUrl(e.item.poster))}" alt="" loading="lazy">
            <span class="agenda-txt"><span class="agenda-name">${esc(e.item.title)}</span><span class="agenda-sub">${esc(e.o.space)} · ${esc(stateLabel(itemInfo(e.item, counts), e.item))}</span></span></a></li>`).join('')}</ul>`
            : `<p class="muted small">${selDay ? '이 날은 예정된 모임이 없어요.' : '이 달에는 조건에 맞는 모임이 없어요.'}</p>`}
          ${selDay ? `<p class="agenda-rent"><a href="${esc(page('space/', `?date=${selDay}`))}">이 날 공간 대관 신청하기 →</a></p>` : ''}
        </div>`;
    }
    calEl.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { mi = Math.min(months.length - 1, Math.max(0, mi + Number(nav.dataset.nav))); selDay = null; renderCal(); return; }
      const cell = e.target.closest('[data-day]');
      if (cell) { selDay = cell.dataset.day; renderCal(); }
    });

    const startView = location.hash === '#cal' ? 'cal' : (store.get('bmoim-view', 'list') === 'cal' ? 'cal' : 'list');
    paintCards(null);
    setView(startView);
    const paint = c => {
      counts = c;
      paintCards(c);
      if (c) {
        const el = $('[data-stat="seats"]');
        if (el) el.textContent = ITEMS.filter(i => ['open', 'hot'].includes(itemInfo(i, c).state)).length;
      }
      apply();
    };
    loadCounts().then(paint);
    document.addEventListener('bmoim:applied', () => loadCounts(true).then(paint));
  }

  // ── 개별 페이지 ───────────────────────────────────
  function initDetail() {
    const item = BY_SLUG[$('main.detail').dataset.slug];
    if (!item) return;
    document.body.classList.add('has-cta');
    $$('[data-zoom]').forEach(b => b.addEventListener('click', () => lightbox(b.dataset.zoom, item.title)));
    $$('[data-share]').forEach(b => b.addEventListener('click', () => openShare(item)));
    $$('[data-addcal]').forEach(b => b.addEventListener('click', () => openAddCal(item)));
    $$('[data-apply]').forEach(b => b.addEventListener('click', () => openApply(item)));

    const paint = counts => {
      paintCards(counts);
      const info = itemInfo(item, counts);
      const label = stateLabel(info, item);
      const closed = ['ended', 'full', 'closed'].includes(info.state);
      const badge = $('.d-poster [data-badge]');
      const bt = closed ? label : badgeText(info);
      badge.hidden = !bt;
      badge.textContent = bt;
      badge.className = 'ribbon' + (closed ? ' dark' : '');

      $$('[data-apply], [data-apply-ext]').forEach(b => {
        if (closed) {
          b.textContent = label;
          if (b.tagName === 'A') { b.setAttribute('aria-disabled', 'true'); b.removeAttribute('href'); } else b.disabled = true;
        }
      });
      const ctaState = $('[data-cta-state]');
      if (ctaState) ctaState.textContent = info.external ? item.dateText : `${item.dateText} · ${label}`;

      const bar = $('[data-seatbar]');
      const s0 = info.infos[0];
      if (info.known && item.sessions.length === 1 && !closed && s0.filled >= 3) {
        bar.hidden = false;
        bar.classList.toggle('hot', info.state === 'hot');
        $('[data-seat-text]', bar).textContent = s0.remaining === 1 ? '마지막 1자리 남았어요' : `${s0.remaining}자리 남았어요`;
        $('[data-seat-sub]', bar).textContent = `정원 ${s0.cap}명 중 ${s0.filled}명 신청`;
        requestAnimationFrame(() => { $('[data-seat-fill]', bar).style.width = `${Math.min(100, s0.filled / s0.cap * 100)}%`; });
      } else bar.hidden = true;

      const box = $('[data-sessions]');
      if (box && !item.applyUrl) {
        box.innerHTML = optionsOf(item, counts).map(o => {
          const low = o.info.open && o.info.known && o.info.filled >= 3 && o.info.remaining <= 2;
          return `<div class="sess${o.info.open ? '' : ' off'}">
            <div class="sess-l"><div class="sess-name">${esc(o.label)}</div><div class="sess-sub">${esc(o.sub)}</div></div>
            <div class="sess-r"><b>${won(o.price)}</b><span class="${low ? 'hot' : ''}">${esc(optStatus(o.info))}</span></div>
            ${o.info.open ? `<button type="button" class="btn outline sm" data-apply-opt="${o.type}:${o.id}">신청</button>` : ''}
          </div>`;
        }).join('');
      }

      const ld = $('#jsonld');
      if (ld && counts) {
        try {
          const data = JSON.parse(ld.textContent);
          const occs = occ(item);
          (Array.isArray(data) ? data : [data]).forEach((ev, idx) => {
            const sid = occs[idx]?.sid;
            const si = info.infos[item.sessions.findIndex(s => s.id === sid)];
            if (ev.offers && si) ev.offers.availability = si.ended || si.closed || si.full ? 'https://schema.org/SoldOut' : (si.filled >= 3 && si.remaining <= 2) ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock';
          });
          ld.textContent = JSON.stringify(data);
        } catch { /* 무시 */ }
      }
    };
    $('[data-sessions]')?.addEventListener('click', e => {
      const b = e.target.closest('[data-apply-opt]');
      if (b) openApply(item, b.dataset.applyOpt.split(':')[1]);
    });
    paint(null);
    loadCounts().then(paint);
    document.addEventListener('bmoim:applied', () => loadCounts(true).then(paint));
    if (params.get('apply') === '1') openApply(item);
  }

  // ── 내 신청 확인 ──────────────────────────────────
  function initMy() {
    const form = $('#lookupForm');
    const result = $('#myResult');
    const recent = store.get(recentKey, []);
    if (recent.length) {
      $('#recent').innerHTML = `<div class="recent">이 기기에서 신청한 번호: ${recent.map(r => `<button type="button" data-code="${esc(r.code)}" title="${esc(r.title)}">${esc(r.code)}</button>`).join('')}</div>`;
      $('#recent').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) { form.code.value = b.dataset.code; form.phone.focus(); } });
    }
    if (params.get('code')) form.code.value = params.get('code');
    let last = null;
    const statusCls = s => s === '입금확인' || s === '확정' ? 'st-paid' : s === '취소요청' ? 'st-cancelreq' : s?.startsWith('취소') ? 'st-cancel' : 'st-pending';
    function render(apps, phone) {
      result.innerHTML = `<div class="app-list">${apps.sort((a, b) => b.at - a.at).map(a => {
        const item = BY_SLUG[a.slug];
        const pending = a.status === '입금대기';
        const canCancel = ['입금대기', '입금확인', '접수', '확정'].includes(a.status);
        return `<article class="app">
          <div class="app-top"><div><div class="app-title">${esc(a.title)}</div><div class="app-sub">${esc(a.optionLabel || '')}</div></div><span class="st ${statusCls(a.status)}">${esc(a.status)}</span></div>
          <div class="app-sub">신청번호 <b>${esc(a.code)}</b> · ${esc(flong(a.at))} ${hm(a.at)} 신청${a.amount ? ` · ${won(a.amount)}` : ''}</div>
          ${pending && a.amount ? `<div class="paybox"><div class="paybox-row"><span>입금 기한</span><span>${esc(flong(a.deadline))} ${hm(a.deadline)}까지</span></div>
            <div class="paybox-bank" style="margin-top:6px"><span>${esc(CFG.bank.name)} <b>${esc(CFG.bank.number)}</b><br><small class="muted">예금주 ${esc(CFG.bank.holder)} · 입금자명 ${esc(a.name || '')}</small></span><button type="button" class="btn dark sm" data-copy="${esc(CFG.bank.name + ' ' + CFG.bank.number)}">계좌 복사</button></div></div>` : ''}
          <div class="app-actions">
            ${item ? `<a class="btn ghost sm" href="${esc(page(item.url))}">모임 페이지</a>` : ''}
            ${canCancel ? `<button type="button" class="btn ghost sm" data-cancel="${esc(a.code)}">취소 요청</button>` : ''}
          </div>
          ${canCancel && item ? `<p class="muted small" style="margin:0">환불: ${esc(CFG.refund[item.materials ? 'materials' : 'noMaterials'].join(' · '))}</p>` : ''}
        </article>`;
      }).join('')}</div>`;
      last = { phone };
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const alertEl = $('#lookupAlert');
      formAlert(alertEl, '');
      const code = form.code.value.trim().toUpperCase();
      const phone = form.phone.value.trim();
      if (!code) { markInvalid(form.code); return formAlert(alertEl, '신청번호를 입력해 주세요.'); }
      if (!validPhone(phone)) { markInvalid(form.phone); return formAlert(alertEl, '휴대폰 번호를 확인해 주세요.'); }
      const btn = $('button[type="submit"]', form);
      setBusy(btn, true, '확인 중…');
      try {
        const res = await api('lookup', { code, phone });
        render(res.apps, phone);
      } catch (err) { formAlert(alertEl, err.message); result.innerHTML = ''; }
      setBusy(btn, false);
    });
    result.addEventListener('click', async e => {
      const c = e.target.closest('[data-copy]');
      if (c) copy(c.dataset.copy);
      const b = e.target.closest('[data-cancel]');
      if (!b || !last) return;
      // 브라우저 확인창 대신 버튼을 한 번 더 누르게 합니다
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1';
        b.textContent = '한 번 더 누르면 취소 요청';
        b.classList.add('dark');
        setTimeout(() => { if (b.isConnected && b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = '취소 요청'; b.classList.remove('dark'); } }, 5000);
        return;
      }
      setBusy(b, true, '요청 중…');
      try {
        await api('cancelRequest', { code: form.code.value.trim().toUpperCase(), phone: last.phone, target: b.dataset.cancel });
        toast('취소 요청을 보냈어요');
        form.requestSubmit();
      } catch (err) { toast(err.message); setBusy(b, false); }
    });
    $('#resendForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const nm = f.elements.namedItem('name').value.trim();
      const ph = f.elements.namedItem('phone').value.trim();
      const alertEl = $('#resendAlert');
      if (!nm || !validPhone(ph)) return formAlert(alertEl, '이름과 휴대폰 번호를 확인해 주세요.');
      const btn = $('button[type="submit"]', f);
      setBusy(btn, true, '보내는 중…');
      try {
        await api('resend', { name: nm, phone: ph });
        formAlert(alertEl, '등록된 신청이 있다면 알림톡·메일로 신청번호를 보냈어요.', true);
      } catch (err) { formAlert(alertEl, err.message); }
      setBusy(btn, false);
    });
  }

  // ── 모임 열기 ─────────────────────────────────────
  function initHost() {
    const form = $('#hostForm');
    mountConsents(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const alertEl = $('#hostAlert');
      formAlert(alertEl, '');
      for (const el of $$('[required]', form)) {
        if (!el.value.trim()) { markInvalid(el); return formAlert(alertEl, `‘${el.closest('.field').querySelector('span').textContent.replace(' *', '')}’ 항목을 채워 주세요.`); }
      }
      if (!validPhone(form.phone.value)) { markInvalid(form.phone); return formAlert(alertEl, '휴대폰 번호를 확인해 주세요.'); }
      if (!validEmail(form.email.value.trim())) { markInvalid(form.email); return formAlert(alertEl, '이메일 형식을 확인해 주세요.'); }
      const consentBox = $('[data-consent-box]', form);
      const consent = readConsent(consentBox);
      if (!consent.ok) return formAlert(alertEl, '개인정보 수집·이용에 동의해 주세요.');
      const data = Object.fromEntries(new FormData(form).entries());
      const btn = $('#hostSubmit');
      let hostFallback = false;
      if (SHEET) {
        try {
          setBusy(btn, true, '보내는 중…');
          await api('hostApply', { ...data, consent, ref: refOut() });
          form.outerHTML = `<div class="card-form done"><div class="done-icon">✓</div><h3>개설 신청이 접수됐어요</h3>
            <p class="muted">담당자가 확인 후 연락드릴게요. 포스터는 <a href="#poster">포스터 규격</a>에 맞춰 준비해 주세요.</p>
            <a class="btn outline" href="${esc(page(''))}">비모임 둘러보기</a></div>`;
          return;
        } catch (err) {
          setBusy(btn, false);
          if (!err.fallback) { formAlert($('#hostAlert'), err.message); return; }
          hostFallback = true;
        }
      }
      if (hostFallback) {
        const label = { hostName: '호스트', insta: '인스타', phone: '연락처', email: '이메일', hostBio: '소개', title: '모임 제목', oneLiner: '한 줄 소개', category: '분야', audience: '대상', description: '상세 소개', date1: '희망 일정1', date2: '희망 일정2', duration: '진행 시간', space: '희망 공간', capacity: '정원', price: '참가비', materials: '재료 준비', regular: '정기', posterUrl: '포스터', request: '요청' };
        const text = '[비모임 개설 신청]\n' + Object.entries(label).filter(([k]) => String(data[k] || '').trim()).map(([k, l]) => `${l}: ${String(data[k]).trim()}`).join('\n');
        form.outerHTML = `<div class="card-form" id="hostDone"><h3 style="margin-bottom:8px">신청 내용을 비북스에 보내 주세요</h3>
          <p class="muted small">아래 내용을 복사해 인스타그램 DM으로 보내 주시면 담당자가 확인 후 연락드려요.</p>
          <textarea readonly rows="10" style="width:100%;font:inherit;font-size:14px;padding:12px;border:1px solid var(--line-2);border-radius:8px;margin:10px 0">${esc(text)}</textarea>
          <div class="done-actions"><button type="button" class="btn primary" data-copy-text>내용 복사</button><a class="btn outline" href="https://instagram.com/${esc(CFG.store.instagram)}" target="_blank" rel="noopener">인스타그램 DM 열기</a></div></div>`;
        $('#hostDone [data-copy-text]').addEventListener('click', () => copy($('#hostDone textarea').value, '신청 내용을 복사했어요'));
        return;
      }
      setBusy(btn, true, '보내는 중…');
      try {
        const res = await api('hostApply', { ...data, consent, ref: refOut() });
        form.outerHTML = `<div class="card-form done"><div class="done-icon">✓</div><h3>개설 신청이 접수됐어요</h3>
          <p class="muted">접수번호 <b>${esc(res.code || '')}</b><br>담당자가 확인 후 연락드릴게요. 모임 페이지가 열리면 호스트 전용 현황 링크를 함께 보내드려요.</p>
          <a class="btn ghost" href="${esc(page(''))}">비모임 둘러보기</a></div>`;
      } catch (err) { formAlert(alertEl, err.message); setBusy(btn, false); }
    });
  }

  // ── 호스트 현황 (비공개 링크) ───────────────────────
  function initDashboard() {
    const box = $('#dash');
    const tf = $('#tokenForm');
    const hashToken = new URLSearchParams(location.hash.slice(1)).get('k') || params.get('k');
    async function load(token) {
      box.innerHTML = '<p class="muted">불러오는 중…</p>';
      try {
        const d = await api('hostDashboard', { token });
        tf.hidden = true;
        render(d, token);
      } catch (err) {
        box.innerHTML = `<div class="form-alert">${esc(err.message)}</div>`;
        tf.hidden = false;
      }
    }
    function render(d, token) {
      let total = 0, paid = 0, cap = 0;
      d.moims.forEach(m => m.sessions.forEach(s => {
        const act = s.applicants.filter(a => !String(a.status).startsWith('취소'));
        total += act.length; paid += act.filter(a => a.status === '입금확인').length; cap += s.capacity;
      }));
      box.innerHTML = `
        <p><b>${esc(d.host?.name || '')}</b> 님의 모임 · <span class="muted small">${esc(flong(d.updatedAt))} ${hm(d.updatedAt)} 기준</span>
          <button type="button" class="btn ghost sm" data-reload style="margin-left:6px">새로고침</button></p>
        <div class="dash-cards">
          <div class="kpi"><b>${total}</b><span>전체 신청</span></div>
          <div class="kpi"><b>${paid}</b><span>입금 확인</span></div>
          <div class="kpi"><b>${Math.max(0, cap - total)}</b><span>남은 자리</span></div>
        </div>
        ${d.moims.map(m => {
          const item = BY_SLUG[m.slug];
          const share = item ? itemUrl(item, 'host') : '';
          return `<section class="dash-moim"><h2>${esc(m.title)}</h2>
            ${share ? `<p class="small muted" style="margin:6px 0 0">호스트 공유 링크 (신청 경로가 ‘호스트’로 집계돼요) <button type="button" class="btn ghost sm" data-copy="${esc(share)}">링크 복사</button></p>` : ''}
            ${m.sessions.map(s => {
              const act = s.applicants.filter(a => !String(a.status).startsWith('취소'));
              return `<div class="dash-sess"><h3><span>${esc(s.label)}</span><span class="muted small">${act.length} / ${s.capacity}명</span></h3>
                ${s.applicants.length ? `<div class="table-wrap" style="border:0"><table class="dtable"><thead><tr><th>이름</th><th>연락처</th><th>상태</th><th>신청일</th><th>메모</th></tr></thead><tbody>
                ${s.applicants.sort((a, b) => a.at - b.at).map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.phone)}</td><td><span class="st ${a.status === '입금확인' ? 'st-paid' : String(a.status).startsWith('취소') ? 'st-cancel' : 'st-pending'}">${esc(a.status)}</span></td><td>${esc(fshort(a.at))}</td><td>${esc(a.memo || '')}</td></tr>`).join('')}
                </tbody></table></div>` : '<p class="dash-empty">아직 신청이 없어요.</p>'}</div>`;
            }).join('')}</section>`;
        }).join('')}
        <p class="muted small" style="margin-top:16px">개인정보 보호를 위해 이름 일부와 연락처 뒷자리만 보여요. 참가자에게 연락이 필요하면 비북스에 요청해 주세요.</p>`;
      $('[data-reload]', box).addEventListener('click', () => load(token));
    }
    box.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy, '공유 링크를 복사했어요'); });
    tf.addEventListener('submit', e => {
      e.preventDefault();
      const t = tf.token.value.trim();
      history.replaceState(null, '', '#k=' + encodeURIComponent(t));
      load(t);
    });
    if (hashToken) load(hashToken);
    else {
      tf.hidden = false;
      box.innerHTML = DEMO ? `<p class="muted small">체험하려면 코드 <b>${esc(CFG.demo?.hostToken || 'demo')}</b> 를 넣어 보세요.</p>` : '';
    }
  }

  // ── 공개 API (rent.js · cards.js에서 사용) ──────────
  window.BM = {
    CAT, CFG, ITEMS, BY_SLUG, REL, DEMO, page, api, loadCounts, itemInfo, stateLabel, sessInfo, occ,
    kst, kp, ymd, hm, fshort, flong, won, esc, pad, nowMs, toast, copy, imgUrl, itemUrl, setBusy, formAlert,
    validPhone, validEmail, markInvalid, mountConsents, readConsent, refOut, sentChips, rememberCode
  };

  mountConsents();
  ({ hub: initHub, detail: initDetail, my: initMy, host: initHost, dashboard: initDashboard }[PAGE] || (() => {}))();
})();
