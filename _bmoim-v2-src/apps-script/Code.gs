/**
 * 비북스 b.moim v2 — Apps Script 백엔드
 *
 * ▸ 반드시 "테스트용 새 스프레드시트"에 연결해서 쓰세요. (운영 중인 기존 시트·스크립트와 분리)
 * ▸ 스프레드시트는 공유 설정을 "제한됨"으로 두세요. 페이지는 이 스크립트를 통해서만
 *   '인원 수'와 '대관 시간대'를 받아 가며, 이름·연락처는 절대 밖으로 나가지 않습니다.
 * ▸ 설정은 [프로젝트 설정 → 스크립트 속성]에 넣습니다. 목록은 SETUP.md 참고.
 */

// ── 시트 정의 ─────────────────────────────────────
const SHEETS = {
  apps: {
    name: '신청',
    head: ['신청번호', '신청일시', 'slug', '모임명', '옵션종류', '옵션ID', '옵션명', '회차ID', '이름', '연락처', '이메일',
      '금액', '상태', '입금기한', '호스트메모', '추가입력', '개인정보동의', '환불규정확인', '소식수신동의', '유입', '알림톡', '메일', '비고']
  },
  rents: {
    name: '대관',
    head: ['신청번호', '신청일시', '공간', '날짜', '시간', '이름', '연락처', '이메일', '인원', '목적', '예상금액', '상태',
      '개인정보동의', '소식수신동의', '유입', '알림톡', '메일', '비고']
  },
  hosts: {
    name: '개설신청',
    head: ['접수번호', '접수일시', '호스트', '연락처', '이메일', '인스타', '호스트소개', '모임제목', '한줄소개', '분야', '대상',
      '상세소개', '희망일정1', '희망일정2', '진행시간', '희망공간', '정원', '참가비', '재료', '정기', '포스터', '요청',
      '개인정보동의', '소식수신동의', '유입', '상태']
  },
  tokens: { name: '호스트링크', head: ['토큰', 'slug', '호스트명', '연락처공개', '활성', '발급일', '메모'] },
  log: { name: '발송로그', head: ['일시', '종류', '대상', '채널', '결과', '내용'] }
};
const CANCELLED = s => String(s || '').indexOf('취소') === 0;
const WD = ['일', '월', '화', '수', '목', '금', '토'];

// ── 진입점 ───────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'counts') return json_({ counts: counts_() });
    if (action === 'rentBlocks') return json_({ blocks: rentBlocks_() });
    return json_({ ok: true, service: 'bmoim-v2' });
  } catch (err) {
    return json_({ error: String(err.message || err) });
  }
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: '잘못된 요청입니다.' }); }
  try {
    if (d.website) throw new Error('잘못된 요청입니다.'); // 스팸 봇 함정 필드
    switch (d.action) {
      case 'apply': return json_(apply_(d));
      case 'lookup': return json_(lookup_(d));
      case 'resend': return json_(resend_(d));
      case 'cancelRequest': return json_(cancelRequest_(d));
      case 'rent': return json_(rent_(d));
      case 'hostApply': return json_(hostApply_(d));
      case 'hostDashboard': return json_(hostDashboard_(d));
      default: throw new Error('알 수 없는 요청입니다.');
    }
  } catch (err) {
    return json_({ error: String(err.message || err) });
  }
}

// ── 공개 조회: 인원 수 · 대관 시간대 (개인정보 없음) ───────
function counts_() {
  const out = {};
  rows_('apps').forEach(r => {
    if (CANCELLED(r['상태'])) return;
    String(r['회차ID'] || '').split(',').filter(String).forEach(sid => {
      const k = r['slug'] + ':' + sid.trim();
      out[k] = (out[k] || 0) + 1;
    });
  });
  return out;
}

function rentBlocks_() {
  return rows_('rents').filter(r => !CANCELLED(r['상태']) && r['날짜'] && r['시간']).map(r => ({
    date: ymd_(r['날짜']), space: String(r['공간'] || ''), time: String(r['시간'])
  }));
}

// ── 모임 신청 ────────────────────────────────────
function apply_(d) {
  requireFields_(d, ['slug', 'optionType', 'optionId', 'name', 'phone']);
  requireConsent_(d.consent, true);
  const phone = phone_(d.phone);
  rateLimit_(phone);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cat = catalog_();
    let title = d.title, label = d.optionLabel, sessionIds = [].concat(d.sessionIds || []), amount = Number(d.amount) || 0;
    let schedule = label;
    if (cat) {
      const item = cat.items.filter(i => i.slug === d.slug)[0];
      if (!item) throw new Error('모임 정보를 찾을 수 없어요.');
      if (item.applyUrl) throw new Error('이 행사는 파트너 페이지에서 신청해 주세요.');
      const opt = findOption_(item, d.optionType, d.optionId);
      if (!opt) throw new Error('선택한 회차를 찾을 수 없어요.');
      title = item.title; label = opt.label; sessionIds = opt.sessionIds; amount = opt.price; schedule = opt.schedule;
      const now = Date.now();
      const c = counts_();
      opt.sessions.forEach(s => {
        const until = s.applyUntil ? kst_(s.applyUntil) : kst_(s.dates[0].start);
        if (item.status === 'closed' || now > until) throw new Error('신청이 마감된 회차예요.');
        if ((c[item.slug + ':' + s.id] || 0) >= s.capacity) throw new Error('방금 모집이 완료됐어요. 다른 회차를 골라 주세요.');
      });
    }
    const code = uniqueCode_('BM');
    const now = new Date();
    const deadline = new Date(now.getTime() + Number(prop_('PAY_DEADLINE_HOURS', '24')) * 3600e3);
    append_('apps', {
      '신청번호': code, '신청일시': now, 'slug': d.slug, '모임명': title, '옵션종류': d.optionType, '옵션ID': d.optionId,
      '옵션명': label, '회차ID': sessionIds.join(','), '이름': clean_(d.name, 30), '연락처': fmtPhone_(phone),
      '이메일': clean_(d.email, 80), '금액': amount, '상태': amount > 0 ? '입금대기' : '확정', '입금기한': amount > 0 ? deadline : '',
      '호스트메모': clean_(d.memo, 300), '추가입력': clean_(d.extra, 300), '개인정보동의': consentStamp_(d.consent.privacy),
      '환불규정확인': consentStamp_(d.consent.refund), '소식수신동의': d.consent.marketing ? 'Y' : 'N', '유입': clean_(d.ref, 40)
    });
    SpreadsheetApp.flush();
    lock.releaseLock();

    const vars = {
      '#{이름}': clean_(d.name, 30), '#{모임명}': title, '#{일정}': schedule, '#{신청번호}': code,
      '#{금액}': won_(amount), '#{계좌}': prop_('BANK_TEXT', ''), '#{기한}': fmtDateTime_(deadline),
      '#{확인링크}': siteUrl_('my/?code=' + code)
    };
    const at = sendAlimtalk_(phone, 'TPL_APPLY', vars, 'apply', code);
    const em = d.email ? sendMail_(d.email, `[비북스 b.moim] ${title} 신청이 접수됐어요`, mailApply_(vars, amount), 'apply', code) : 'none';
    setByCode_('apps', code, { '알림톡': at, '메일': em });
    notifyOperator_(`[신청] ${title} · ${clean_(d.name, 30)}`, `${title}\n${label}\n${clean_(d.name, 30)} ${fmtPhone_(phone)}\n${won_(amount)} · 신청번호 ${code}\n유입: ${d.ref || '-'}`);
    return { ok: true, code: code, amount: amount, deadline: deadline.getTime(), notified: { alimtalk: at, email: em } };
  } finally {
    try { lock.releaseLock(); } catch (err) { /* 이미 해제됨 */ }
  }
}

function findOption_(item, type, id) {
  const sessDate = s => s.dates.map(x => shortDate_(kst_(x.start))).join(' · ') + ' ' + x2hm_(s.dates[0].start) + '–' + x2hm_(s.dates[0].end);
  if (type === 'session') {
    const s = item.sessions.filter(x => x.id === id)[0];
    if (!s) return null;
    return { label: s.name || sessDate(s), price: s.price, sessionIds: [s.id], sessions: [s], schedule: sessDate(s) };
  }
  const p = (item.packages || []).filter(x => x.id === id)[0];
  if (!p) return null;
  const ss = p.sessions.map(sid => item.sessions.filter(x => x.id === sid)[0]).filter(Boolean);
  return { label: p.name, price: p.price, sessionIds: p.sessions, sessions: ss, schedule: ss.map(sessDate).join(' / ') };
}

// ── 내 신청 확인 · 재안내 · 취소 요청 ─────────────────
function lookup_(d) {
  const phone = phone_(d.phone);
  const code = String(d.code || '').trim().toUpperCase();
  rateLimit_('lookup:' + phone);
  const all = myRows_(phone);
  if (!all.some(r => r.code === code)) throw new Error('일치하는 신청이 없어요. 신청번호와 휴대폰 번호를 확인해 주세요.');
  return { apps: all.map(r => r.pub) };
}

function myRows_(phone) {
  const out = [];
  rows_('apps').forEach(r => {
    if (digits_(r['연락처']) !== phone) return;
    out.push({ code: r['신청번호'], key: 'apps', row: r, pub: {
      kind: 'moim', code: r['신청번호'], at: ms_(r['신청일시']), slug: r['slug'], title: r['모임명'], optionLabel: r['옵션명'],
      amount: Number(r['금액']) || 0, status: r['상태'], name: r['이름'], deadline: ms_(r['입금기한'])
    } });
  });
  rows_('rents').forEach(r => {
    if (digits_(r['연락처']) !== phone) return;
    out.push({ code: r['신청번호'], key: 'rents', row: r, pub: {
      kind: 'rent', code: r['신청번호'], at: ms_(r['신청일시']), slug: '', title: '대관 · ' + r['공간'],
      optionLabel: ymd_(r['날짜']) + ' ' + r['시간'], amount: 0, status: r['상태'], name: r['이름'], deadline: 0
    } });
  });
  return out;
}

function resend_(d) {
  const phone = phone_(d.phone);
  rateLimit_('resend:' + phone, 3);
  const name = String(d.name || '').trim();
  const mine = rows_('apps').filter(r => digits_(r['연락처']) === phone && String(r['이름']).trim() === name && !CANCELLED(r['상태']));
  if (mine.length) {
    const list = mine.map(r => `${r['모임명']} ${r['신청번호']}`).join('\n');
    sendAlimtalk_(phone, 'TPL_RESEND', { '#{이름}': name, '#{신청목록}': list, '#{확인링크}': siteUrl_('my/') }, 'resend', mine[0]['신청번호']);
    const email = mine.map(r => r['이메일']).filter(String)[0];
    if (email) sendMail_(email, '[비북스 b.moim] 신청번호 안내', `<p>${esc_(name)}님의 신청번호입니다.</p><pre>${esc_(list)}</pre><p><a href="${siteUrl_('my/')}">내 신청 확인</a></p>`, 'resend', mine[0]['신청번호']);
  }
  return { ok: true }; // 존재 여부는 알려주지 않습니다
}

function cancelRequest_(d) {
  const phone = phone_(d.phone);
  const mine = myRows_(phone);
  const auth = String(d.code || '').trim().toUpperCase();
  if (!mine.some(r => r.code === auth)) throw new Error('본인 확인에 실패했어요.');
  const target = mine.filter(r => r.code === String(d.target || auth).toUpperCase())[0];
  if (!target) throw new Error('신청을 찾지 못했어요.');
  if (CANCELLED(target.row['상태'])) return { ok: true, status: target.row['상태'] };
  setByCode_(target.key, target.code, { '상태': '취소요청', '비고': appendNote_(target.row['비고'], '취소요청 ' + fmtDateTime_(new Date())) });
  notifyOperator_(`[취소요청] ${target.pub.title} · ${target.row['이름']}`, `${target.pub.title}\n${target.pub.optionLabel}\n${target.row['이름']} ${target.row['연락처']}\n신청번호 ${target.code}\n\n시트에서 환불 처리 후 상태를 '취소'로 바꿔 주세요.`);
  return { ok: true, status: '취소요청' };
}

// ── 대관 ─────────────────────────────────────────
function rent_(d) {
  requireFields_(d, ['space', 'date', 'time', 'name', 'phone']);
  requireConsent_(d.consent, true);
  const phone = phone_(d.phone);
  rateLimit_(phone);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let code;
  try {
    const m = String(d.time).match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/);
    if (!m) throw new Error('시간 형식을 확인해 주세요.');
    const a = toMin_(m[1]), b = toMin_(m[2]);
    // 같은 날 겹치는 대관이 있는지 (공간 충돌 규칙은 페이지와 동일)
    const conflicts = {
      '세미나실': ['세미나실', '전체 대관'], '매장 테이블': ['매장 테이블', '계단 좌석', '전체 대관'],
      '계단 좌석': ['계단 좌석', '매장 테이블', '전체 대관'], '전체 대관': ['전체 대관', '세미나실', '매장 테이블', '계단 좌석']
    }[d.space] || [d.space];
    rentBlocks_().forEach(x => {
      if (x.date !== d.date || conflicts.indexOf(x.space) < 0) return;
      const mm = x.time.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/);
      if (mm && a < toMin_(mm[2]) && toMin_(mm[1]) < b) throw new Error('방금 다른 대관이 잡힌 시간이에요. 다른 시간을 골라 주세요.');
    });
    code = uniqueCode_('BR');
    append_('rents', {
      '신청번호': code, '신청일시': new Date(), '공간': d.space, '날짜': d.date, '시간': d.time, '이름': clean_(d.name, 30),
      '연락처': fmtPhone_(phone), '이메일': clean_(d.email, 80), '인원': Number(d.count) || '', '목적': clean_(d.purpose, 200),
      '예상금액': Number(d.estimate) || '', '상태': '접수', '개인정보동의': consentStamp_(d.consent.privacy),
      '소식수신동의': d.consent.marketing ? 'Y' : 'N', '유입': clean_(d.ref, 40)
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  const vars = { '#{이름}': clean_(d.name, 30), '#{공간}': d.space, '#{일정}': `${shortDate_(kst_(d.date + 'T00:00'))} ${d.time}`, '#{신청번호}': code, '#{확인링크}': siteUrl_('my/?code=' + code) };
  const at = sendAlimtalk_(phone, 'TPL_RENT', vars, 'rent', code);
  const em = d.email ? sendMail_(d.email, `[비북스] 대관 신청이 접수됐어요 (${d.date})`, mailRent_(vars), 'rent', code) : 'none';
  setByCode_('rents', code, { '알림톡': at, '메일': em });
  notifyOperator_(`[대관] ${d.space} ${d.date} ${d.time}`, `${d.space}\n${d.date} ${d.time}\n${clean_(d.name, 30)} ${fmtPhone_(phone)}\n인원 ${d.count || '-'} · 목적 ${d.purpose || '-'}\n예상 ${won_(Number(d.estimate) || 0)}\n신청번호 ${code}`);
  return { ok: true, code: code, notified: { alimtalk: at, email: em } };
}

// ── 모임 개설 신청 ───────────────────────────────
function hostApply_(d) {
  requireFields_(d, ['hostName', 'phone', 'email', 'title', 'oneLiner', 'description', 'date1', 'capacity', 'price']);
  requireConsent_(d.consent, false);
  const phone = phone_(d.phone);
  rateLimit_('host:' + phone, 3);
  const code = uniqueCode_('BH');
  append_('hosts', {
    '접수번호': code, '접수일시': new Date(), '호스트': clean_(d.hostName, 40), '연락처': fmtPhone_(phone), '이메일': clean_(d.email, 80),
    '인스타': clean_(d.insta, 40), '호스트소개': clean_(d.hostBio, 500), '모임제목': clean_(d.title, 80), '한줄소개': clean_(d.oneLiner, 60),
    '분야': clean_(d.category, 20), '대상': clean_(d.audience, 60), '상세소개': clean_(d.description, 3000),
    '희망일정1': clean_(d.date1, 20), '희망일정2': clean_(d.date2, 20), '진행시간': clean_(d.duration, 20), '희망공간': clean_(d.space, 20),
    '정원': Number(d.capacity) || '', '참가비': Number(d.price) || 0, '재료': clean_(d.materials, 10), '정기': clean_(d.regular, 10),
    '포스터': clean_(d.posterUrl, 300), '요청': clean_(d.request, 1000), '개인정보동의': consentStamp_(d.consent.privacy),
    '소식수신동의': d.consent.marketing ? 'Y' : 'N', '유입': clean_(d.ref, 40), '상태': '접수'
  });
  notifyOperator_(`[모임 개설 신청] ${d.title} · ${d.hostName}`, `${d.title}\n${d.oneLiner}\n호스트 ${d.hostName} ${fmtPhone_(phone)} ${d.email}\n희망 ${d.date1} ${d.date2 || ''} · ${d.space} · 정원 ${d.capacity} · ${won_(Number(d.price) || 0)}\n접수번호 ${code}`);
  sendMail_(d.email, '[비북스 b.moim] 모임 개설 신청이 접수됐어요',
    `<p>${esc_(d.hostName)}님, 비북스에서 모임을 열어 주셔서 고맙습니다.</p><p><b>${esc_(d.title)}</b> 개설 신청이 접수되었어요. 담당자가 확인 후 연락드릴게요.</p><p>접수번호 ${code}</p>`, 'host', code);
  return { ok: true, code: code };
}

// ── 호스트 비공개 현황 ───────────────────────────
function hostDashboard_(d) {
  const token = String(d.token || '').trim();
  if (token.length < 16) throw new Error('유효하지 않은 링크예요. 비북스에 새 링크를 요청해 주세요.');
  rateLimit_('dash:' + token, 30);
  const t = rows_('tokens').filter(r => String(r['토큰']) === token && String(r['활성']).toUpperCase() !== 'N')[0];
  if (!t) throw new Error('유효하지 않은 링크예요. 비북스에 새 링크를 요청해 주세요.');
  const showContact = String(t['연락처공개']).toUpperCase() === 'Y';
  const slugs = String(t['slug']).split(',').map(s => s.trim()).filter(String);
  const cat = catalog_();
  const apps = rows_('apps');
  const moims = slugs.map(slug => {
    const mine = apps.filter(r => r['slug'] === slug);
    const item = cat ? cat.items.filter(i => i.slug === slug)[0] : null;
    const sessions = item ? item.sessions.map(s => ({ id: s.id, label: s.name || s.dates.map(x => shortDate_(kst_(x.start))).join(' · ') + ' ' + x2hm_(s.dates[0].start), capacity: s.capacity }))
      : uniq_(mine.map(r => String(r['회차ID']).split(',')).reduce((a, b) => a.concat(b), [])).map(id => ({ id: id, label: id, capacity: 0 }));
    return {
      slug: slug, title: item ? item.title : (mine[0] ? mine[0]['모임명'] : slug),
      sessions: sessions.map(s => ({
        id: s.id, label: s.label, capacity: s.capacity,
        applicants: mine.filter(r => String(r['회차ID']).split(',').indexOf(s.id) >= 0).map(r => ({
          name: showContact ? r['이름'] : mask_(r['이름']),
          phone: showContact ? r['연락처'] : '***-' + digits_(r['연락처']).slice(-4),
          status: r['상태'], at: ms_(r['신청일시']), option: r['옵션명'], memo: r['호스트메모'] || ''
        }))
      }))
    };
  });
  return { host: { name: t['호스트명'] }, updatedAt: Date.now(), moims: moims };
}

// ── 운영자 도구 (스프레드시트 메뉴) ──────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('비모임')
    .addItem('① 시트 탭 만들기', 'setupSheets')
    .addItem('② 호스트 현황 링크 발급', 'issueHostLink')
    .addSeparator()
    .addItem('미입금 신청 자동 취소 (지금 실행)', 'expireUnpaid')
    .addItem('알림 발송 테스트 (내 번호·메일로)', 'testNotify')
    .addToUi();
}

function setupSheets() {
  Object.keys(SHEETS).forEach(sheet_);
  SpreadsheetApp.getUi().alert('탭을 만들었어요. 신청 탭의 "상태"를 "입금확인"으로 바꾸면 확정 알림이 나가도록 트리거를 설정해 주세요 (SETUP.md 4단계).');
}

function issueHostLink() {
  const ui = SpreadsheetApp.getUi();
  const s = ui.prompt('호스트 링크 발급', '모임 slug를 입력하세요 (여러 개면 쉼표로)\n예) daon-bookclub-2610, daon-teablend-2610', ui.ButtonSet.OK_CANCEL);
  if (s.getSelectedButton() !== ui.Button.OK) return;
  const h = ui.prompt('호스트 이름', '예) 다온 글방', ui.ButtonSet.OK_CANCEL);
  if (h.getSelectedButton() !== ui.Button.OK) return;
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  append_('tokens', { '토큰': token, 'slug': s.getResponseText().trim(), '호스트명': h.getResponseText().trim(), '연락처공개': 'N', '활성': 'Y', '발급일': new Date() });
  ui.alert('호스트 링크', siteUrl_('host/dashboard/#k=' + token) + '\n\n이 링크를 호스트에게만 전달하세요. 중지하려면 호스트링크 탭의 "활성"을 N으로 바꾸면 됩니다.', ui.ButtonSet.OK);
}

/** 시간 트리거로 1시간마다 실행 권장: 입금기한이 지난 '입금대기'를 '취소(미입금)'로 */
function expireUnpaid() {
  const now = Date.now();
  rows_('apps').forEach(r => {
    if (r['상태'] === '입금대기' && r['입금기한'] && ms_(r['입금기한']) < now) {
      setCell_('apps', r._row, '상태', '취소(미입금)');
      setCell_('apps', r._row, '비고', appendNote_(r['비고'], '자동취소 ' + fmtDateTime_(new Date())));
    }
  });
}

/** 설치형 onEdit 트리거로 연결: 상태를 '입금확인'으로 바꾸면 확정 알림 발송 */
function onStatusEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEETS.apps.name || e.range.getRow() < 2) return;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (head[e.range.getColumn() - 1] !== '상태' || e.value !== '입금확인') return;
  const vals = sh.getRange(e.range.getRow(), 1, 1, head.length).getValues()[0];
  const r = {};
  head.forEach((h, i) => { r[h] = vals[i]; });
  const vars = { '#{이름}': r['이름'], '#{모임명}': r['모임명'], '#{일정}': r['옵션명'], '#{신청번호}': r['신청번호'], '#{확인링크}': siteUrl_('my/?code=' + r['신청번호']) };
  const at = sendAlimtalk_(digits_(r['연락처']), 'TPL_PAID', vars, 'paid', r['신청번호']);
  const em = r['이메일'] ? sendMail_(r['이메일'], `[비북스 b.moim] ${r['모임명']} 참가가 확정됐어요`,
    `<p>${esc_(r['이름'])}님, 입금이 확인되어 참가가 확정되었어요.</p><p><b>${esc_(r['모임명'])}</b><br>${esc_(r['옵션명'])}</p><p>장소: 비북스 (${esc_(prop_('STORE_ADDRESS', '경기도 부천시 원미구 부천로136번길 24 지하 B02호'))})</p><p><a href="${siteUrl_('my/?code=' + r['신청번호'])}">내 신청 확인</a></p>`, 'paid', r['신청번호']) : 'none';
  setCell_('apps', e.range.getRow(), '비고', appendNote_(r['비고'], `확정알림 ${at}/${em}`));
}

function testNotify() {
  const ui = SpreadsheetApp.getUi();
  const p = ui.prompt('알림 테스트', '받을 휴대폰 번호', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const vars = { '#{이름}': '테스트', '#{모임명}': '테스트 모임', '#{일정}': '10/15(목) 19:00–21:00', '#{신청번호}': 'BM-TEST00', '#{금액}': '20,000원', '#{계좌}': prop_('BANK_TEXT', ''), '#{기한}': fmtDateTime_(new Date()), '#{확인링크}': siteUrl_('my/') };
  const at = sendAlimtalk_(phone_(p.getResponseText()), 'TPL_APPLY', vars, 'test', 'BM-TEST00');
  const em = prop_('OPERATOR_EMAIL', '') ? sendMail_(prop_('OPERATOR_EMAIL', ''), '[테스트] 신청 안내 메일', mailApply_(vars, 20000), 'test', 'BM-TEST00') : 'none';
  ui.alert(`알림톡: ${at}\n메일: ${em}\n자세한 결과는 발송로그 탭을 보세요.`);
}

// ── 알림: 카카오 알림톡 (솔라피) ──────────────────────
/**
 * 솔라피(SOLAPI) 기준. 다른 발송 대행사(NHN Cloud, 알리고 등)를 쓰면 이 함수만 바꾸면 됩니다.
 * 필요한 스크립트 속성: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PFID, SOLAPI_SENDER, TPL_APPLY 등
 * 결과: 'sent' | 'skipped'(설정 없음) | 'failed'
 */
function sendAlimtalk_(to, tplKey, vars, kind, ref) {
  const key = prop_('SOLAPI_API_KEY', ''), secret = prop_('SOLAPI_API_SECRET', ''), pfId = prop_('SOLAPI_PFID', ''), tpl = prop_(tplKey, '');
  if (!key || !secret || !pfId || !tpl) { log_(kind, ref, '알림톡', 'skipped', tplKey + ' 설정 없음'); return 'skipped'; }
  const date = new Date().toISOString();
  const salt = Utilities.getUuid().replace(/-/g, '');
  const sig = Utilities.computeHmacSha256Signature(date + salt, secret).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  const body = {
    message: {
      to: digits_(to), from: prop_('SOLAPI_SENDER', ''),
      kakaoOptions: { pfId: pfId, templateId: tpl, variables: vars, disableSms: prop_('SMS_FALLBACK', 'Y') !== 'Y' }
    }
  };
  try {
    const res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${sig}` },
      payload: JSON.stringify(body)
    });
    const ok = res.getResponseCode() < 300;
    log_(kind, ref, '알림톡', ok ? 'sent' : 'failed', res.getContentText().slice(0, 300));
    return ok ? 'sent' : 'failed';
  } catch (err) {
    log_(kind, ref, '알림톡', 'failed', String(err));
    return 'failed';
  }
}

// ── 알림: 메일 ───────────────────────────────────
function sendMail_(to, subject, html, kind, ref) {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) return 'none';
    const opts = { to: String(to), subject: subject, htmlBody: wrapMail_(html), name: '비북스 b.moim' };
    if (prop_('OPERATOR_EMAIL', '')) opts.replyTo = prop_('OPERATOR_EMAIL', '');
    MailApp.sendEmail(opts);
    log_(kind, ref, '메일', 'sent', subject);
    return 'sent';
  } catch (err) {
    log_(kind, ref, '메일', 'failed', String(err));
    return 'failed';
  }
}

function mailApply_(v, amount) {
  const pay = amount > 0 ? `<table style="width:100%;background:#f8eadf;border-radius:12px;padding:14px;margin:14px 0">
      <tr><td style="color:#7d6a5a">입금할 금액</td><td style="text-align:right;font-size:20px;font-weight:800">${esc_(v['#{금액}'])}</td></tr>
      <tr><td style="color:#7d6a5a">입금 계좌</td><td style="text-align:right">${esc_(v['#{계좌}'])}</td></tr>
      <tr><td style="color:#7d6a5a">입금 기한</td><td style="text-align:right">${esc_(v['#{기한}'])}</td></tr>
      <tr><td style="color:#7d6a5a">입금자명</td><td style="text-align:right">${esc_(v['#{이름}'])}</td></tr></table>
      <p>입금이 확인되면 확정 안내를 다시 보내드려요.</p>` : '';
  return `<h2 style="font-size:20px;margin:0 0 8px">신청이 접수됐어요</h2>
    <p>${esc_(v['#{이름}'])}님, <b>${esc_(v['#{모임명}'])}</b> 신청이 접수되었습니다.</p>
    <p>일정: ${esc_(v['#{일정}'])}<br>신청번호: <b>${esc_(v['#{신청번호}'])}</b></p>${pay}
    <p><a href="${v['#{확인링크}']}" style="display:inline-block;background:#c45c26;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">내 신청 확인 · 취소</a></p>`;
}

function mailRent_(v) {
  return `<h2 style="font-size:20px;margin:0 0 8px">대관 신청이 접수됐어요</h2>
    <p>${esc_(v['#{이름}'])}님, ${esc_(v['#{공간}'])} 대관 신청이 접수되었습니다.</p>
    <p>일정: ${esc_(v['#{일정}'])}<br>신청번호: <b>${esc_(v['#{신청번호}'])}</b></p>
    <p>담당자가 일정 확인 후 금액과 입금 방법을 안내드려요.</p>
    <p><a href="${v['#{확인링크}']}">내 신청 확인</a></p>`;
}

function wrapMail_(inner) {
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2f241d;line-height:1.6">
    <p style="font-weight:700;color:#9e4018;margin:0 0 16px">비북스 b.moim</p>${inner}
    <hr style="border:0;border-top:1px solid #eadfcb;margin:24px 0 12px">
    <p style="font-size:12px;color:#7d6a5a">비북스 · ${esc_(prop_('STORE_ADDRESS', '경기도 부천시 원미구 부천로136번길 24 지하 B02호'))}<br>이 메일은 신청 안내를 위해 발송되었습니다.</p></div>`;
}

function notifyOperator_(subject, text) {
  const to = prop_('OPERATOR_EMAIL', '');
  if (!to) return;
  try { MailApp.sendEmail(to, subject, text + '\n\n' + SpreadsheetApp.getActive().getUrl(), { name: '비모임 알림' }); } catch (err) { log_('operator', '', '메일', 'failed', String(err)); }
}

// ── 모임 데이터 (사이트의 data/catalog.json) ─────────
function catalog_() {
  const url = prop_('CATALOG_URL', '');
  if (!url) return null;
  const cache = CacheService.getScriptCache();
  const hit = cache.get('catalog');
  if (hit) return JSON.parse(hit);
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const txt = res.getContentText();
    const data = JSON.parse(txt);
    if (txt.length < 95000) cache.put('catalog', txt, 600);
    return data;
  } catch (err) {
    return null;
  }
}

// ── 시트 유틸 ────────────────────────────────────
function sheet_(key) {
  const def = SHEETS[key];
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#f3e8d8');
    sh.setFrozenRows(1);
  }
  return sh;
}
function rows_(key) {
  const v = sheet_(key).getDataRange().getValues();
  const head = v.shift() || [];
  return v.map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, j) => { o[h] = r[j]; }); return o; });
}
function append_(key, obj) {
  const sh = sheet_(key);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(head.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : ''));
}
function setCell_(key, row, header, value) {
  const sh = sheet_(key);
  const c = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf(header) + 1;
  if (c) sh.getRange(row, c).setValue(value);
}
function setByCode_(key, code, values) {
  const r = rows_(key).filter(x => x[SHEETS[key].head[0]] === code)[0];
  if (!r) return;
  Object.keys(values).forEach(h => setCell_(key, r._row, h, values[h]));
}
function uniqueCode_(prefix) {
  const used = {};
  ['apps', 'rents', 'hosts'].forEach(k => rows_(k).forEach(r => { used[r[SHEETS[k].head[0]]] = 1; }));
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let n = 0; n < 50; n++) {
    let c = prefix + '-';
    for (let i = 0; i < 6; i++) c += abc[Math.floor(Math.random() * abc.length)];
    if (!used[c]) return c;
  }
  throw new Error('신청번호 생성에 실패했어요. 다시 시도해 주세요.');
}
function log_(kind, ref, channel, result, detail) {
  try { append_('log', { '일시': new Date(), '종류': kind, '대상': ref, '채널': channel, '결과': result, '내용': detail }); } catch (err) { /* 무시 */ }
}

// ── 검증 · 포맷 유틸 ─────────────────────────────
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function prop_(k, d) { const v = PropertiesService.getScriptProperties().getProperty(k); return v === null ? d : v; }
function siteUrl_(path) { return String(prop_('SITE_URL', '')).replace(/\/$/, '') + '/' + path; }
function digits_(s) { return String(s || '').replace(/\D/g, ''); }
function phone_(s) {
  const p = digits_(s);
  if (!/^01[016789]\d{7,8}$/.test(p)) throw new Error('휴대폰 번호를 확인해 주세요.');
  return p;
}
function fmtPhone_(p) { p = digits_(p); return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`; }
function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, max || 200); }
function requireFields_(d, keys) { keys.forEach(k => { if (!String(d[k] || '').trim()) throw new Error('필수 항목이 비어 있어요.'); }); }
function requireConsent_(c, needRefund) {
  if (!c || !c.privacy) throw new Error('개인정보 수집·이용에 동의해 주세요.');
  if (needRefund && !c.refund) throw new Error('환불 규정 확인에 동의해 주세요.');
}
function consentStamp_(v) { return v ? 'Y ' + fmtDateTime_(new Date()) : 'N'; }
function rateLimit_(key, max) {
  const c = CacheService.getScriptCache();
  const k = 'rl:' + key;
  const n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 600);
  if (n > (max || 6)) throw new Error('요청이 너무 많아요. 10분 뒤 다시 시도해 주세요.');
}
function mask_(n) { n = String(n || ''); return n.length <= 1 ? n : n.length === 2 ? n[0] + '*' : n[0] + '*'.repeat(n.length - 2) + n.slice(-1); }
function esc_(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function won_(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
function uniq_(a) { return a.filter((x, i) => x && a.indexOf(x) === i); }
function appendNote_(prev, add) { return prev ? prev + ' / ' + add : add; }
function toMin_(t) { const p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function kst_(s) {
  const dt = String(s).split('T'), d = dt[0].split('-').map(Number), t = (dt[1] || '00:00').split(':').map(Number);
  return Date.UTC(d[0], d[1] - 1, d[2], t[0] - 9, t[1]);
}
function x2hm_(s) { return String(s).split('T')[1]; }
function kparts_(ms) { const d = new Date(ms + 9 * 3600e3); return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() }; }
function shortDate_(ms) { const p = kparts_(ms); return `${p.m}/${p.d}(${WD[p.wd]})`; }
function fmtDateTime_(date) { const p = kparts_(date.getTime()); return `${p.m}월 ${p.d}일 (${WD[p.wd]}) ${('0' + p.hh).slice(-2)}:${('0' + p.mm).slice(-2)}`; }
function ms_(v) { return v instanceof Date ? v.getTime() : (v ? new Date(v).getTime() : 0); }
function ymd_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v).slice(0, 10); }
