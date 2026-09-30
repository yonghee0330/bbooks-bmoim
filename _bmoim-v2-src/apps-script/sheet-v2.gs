/**
 * 비북스 b.moim v2 — 기존 웹앱(webapp.gs)에 "추가"하는 파일
 *
 * 기존 apply / rent 는 그대로 두고, 새 액션 3개를 더합니다.
 *   applyV2   : 모임신청 탭 (기존 A~I열 그대로 + J 이메일 · K 소식수신동의 · L 개인정보동의)
 *   rentV2    : 대관신청 탭 (기존 A~K열 그대로 + L 이메일 · M 소식수신동의 · N 개인정보동의)
 *   hostApply : 개설신청 탭 (없으면 자동 생성)
 * 그리고 뉴스레터용 이메일 목록을 모으는 함수 buildNewsletterList() 가 있습니다.
 *
 * ── 설치 (5분) ───────────────────────────────────
 * 1. 모임신청 스프레드시트 → 확장 프로그램 → Apps Script
 * 2. 왼쪽 ＋ → 스크립트 → 이름 sheet-v2 → 이 파일 내용 전체 붙여넣기
 * 3. 기존 webapp.gs 의 doPost 안, `if (action === 'apply') {` 바로 위에 아래 3줄 추가
 *
 *      if (action === 'applyV2')   return jsonOutput(appendApplyV2_(data));
 *      if (action === 'rentV2')    return jsonOutput(appendRentV2_(data));
 *      if (action === 'hostApply') return jsonOutput(appendHostApply_(data));
 *
 * 4. 저장 → 배포 → 배포 관리 → (기존 배포) 편집 → 버전: 새 버전 → 배포
 *    ※ "새 배포"가 아니라 기존 배포를 새 버전으로 올려야 주소가 그대로 유지됩니다.
 * 5. (선택) 편집기에서 setupSheetV2() 한 번 실행 → 새 열 제목·개설신청 탭을 미리 만들어 둠
 *
 * 설치 전에도 페이지는 동작합니다: 새 액션이 없으면 기존 apply/rent 로 보내고 이메일은 비고 칸에 남깁니다.
 */

var V2_APPLY_EXTRA = ['이메일', '소식수신동의', '개인정보동의'];   // 모임신청 J~L
var V2_RENT_EXTRA = ['이메일', '소식수신동의', '개인정보동의'];    // 대관신청 L~N
var V2_HOST_HEADERS = ['접수일시', '월', '호스트', '연락처', '이메일', '인스타', '호스트소개', '모임제목', '한줄소개', '분야', '대상',
  '상세소개', '희망일정1', '희망일정2', '진행시간', '희망공간', '정원', '참가비', '재료', '정기', '포스터', '요청',
  '개인정보동의', '소식수신동의', '유입', '상태'];
var V2_NEWS_HEADERS = ['이메일', '이름', '연락처', '최근 신청', '출처', '동의 기록'];

function v2Sheet_(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error(name + ' 시트 없음');
  return sh;
}

/** 기존 열 뒤에 새 열 제목이 없으면 채워 넣기 */
function v2EnsureHeaders_(sheet, startCol, headers) {
  var cur = sheet.getRange(1, startCol, 1, headers.length).getValues()[0];
  var need = headers.some(function (h, i) { return String(cur[i] || '').trim() !== h; });
  if (need) sheet.getRange(1, startCol, 1, headers.length).setValues([headers]);
}

function v2Clean_(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, max || 300);
}

function v2Email_(s) {
  var e = String(s || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.slice(0, 120) : '';
}

function v2Consent_(c, key) {
  if (!c || !c[key]) return 'N';
  return 'Y ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
}

function appendApplyV2_(data) {
  if (!data.consent || !data.consent.privacy) throw new Error('개인정보 수집·이용에 동의해 주세요.');
  var sheet = v2Sheet_(SHEET_APPLY);
  v2EnsureHeaders_(sheet, 10, V2_APPLY_EXTRA);
  sheet.appendRow([
    new Date(),
    v2Clean_(data.month, 10),
    v2Clean_(data.moimName, 120),
    v2Clean_(data.session, 60),
    v2Clean_(data.name, 40),
    v2Clean_(data.phone, 20),
    data.amount != null && data.amount !== '' ? data.amount : '',
    v2Clean_(data.note, 500),
    v2Clean_(data.books, 300),
    v2Email_(data.email),
    v2Consent_(data.consent, 'marketing'),
    v2Consent_(data.consent, 'privacy')
  ]);
  return { ok: true, v: 2 };
}

function appendRentV2_(data) {
  if (!data.consent || !data.consent.privacy) throw new Error('개인정보 수집·이용에 동의해 주세요.');
  var sheet = v2Sheet_(SHEET_RENT);
  v2EnsureHeaders_(sheet, 12, V2_RENT_EXTRA);
  sheet.appendRow([
    new Date(),
    v2Clean_(data.month, 10),
    v2Clean_(data.space, 20),
    v2Clean_(data.date, 20),
    v2Clean_(data.time, 20),
    v2Clean_(data.name, 40),
    v2Clean_(data.phone, 20),
    v2Clean_(data.purpose, 300),
    v2Clean_(data.count, 10),
    '',
    data.reqDate || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss'),
    v2Email_(data.email),
    v2Consent_(data.consent, 'marketing'),
    v2Consent_(data.consent, 'privacy')
  ]);
  return { ok: true, v: 2 };
}

function v2HostSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName('개설신청');
  if (!sh) {
    sh = ss.insertSheet('개설신청');
    sh.getRange(1, 1, 1, V2_HOST_HEADERS.length).setValues([V2_HOST_HEADERS]).setFontWeight('bold').setBackground('#f3e8d8');
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendHostApply_(data) {
  if (!data.consent || !data.consent.privacy) throw new Error('개인정보 수집·이용에 동의해 주세요.');
  ['hostName', 'phone', 'title', 'oneLiner', 'description', 'date1', 'capacity'].forEach(function (k) {
    if (!String(data[k] || '').trim()) throw new Error('필수 항목이 비어 있어요.');
  });
  var sh = v2HostSheet_();
  var d = data;
  sh.appendRow([
    new Date(), v2Clean_(d.month, 10), v2Clean_(d.hostName, 40), v2Clean_(d.phone, 20), v2Email_(d.email), v2Clean_(d.insta, 40),
    v2Clean_(d.hostBio, 500), v2Clean_(d.title, 100), v2Clean_(d.oneLiner, 60), v2Clean_(d.category, 20), v2Clean_(d.audience, 60),
    v2Clean_(d.description, 3000), v2Clean_(d.date1, 20), v2Clean_(d.date2, 20), v2Clean_(d.duration, 20), v2Clean_(d.space, 20),
    v2Clean_(d.capacity, 10), v2Clean_(d.price, 10), v2Clean_(d.materials, 10), v2Clean_(d.regular, 10), v2Clean_(d.posterUrl, 300),
    v2Clean_(d.request, 1000), v2Consent_(d.consent, 'privacy'), v2Consent_(d.consent, 'marketing'), v2Clean_(d.ref, 40), '접수'
  ]);
  return { ok: true, v: 2 };
}

/** 새 열 제목과 개설신청 탭을 미리 만들어 두기 (편집기에서 한 번 실행) */
function setupSheetV2() {
  v2EnsureHeaders_(v2Sheet_(SHEET_APPLY), 10, V2_APPLY_EXTRA);
  v2EnsureHeaders_(v2Sheet_(SHEET_RENT), 12, V2_RENT_EXTRA);
  v2HostSheet_();
}

/**
 * 뉴스레터 명단 만들기 — 소식수신동의가 Y인 이메일만, 중복 없이 '뉴스레터' 탭에 정리
 * (편집기에서 실행하거나, 트리거로 매주 1회 자동 실행)
 */
function buildNewsletterList() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var list = {};
  function collect(sheetName, cols, source) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var email = v2Email_(r[cols.email]);
      var consent = String(r[cols.consent] || '');
      if (!email || consent.indexOf('Y') !== 0) continue;
      var key = email.toLowerCase();
      var at = r[0] instanceof Date ? r[0] : new Date(r[0]);
      if (!list[key] || at > list[key].at) {
        list[key] = { email: email, name: r[cols.name] || '', phone: r[cols.phone] || '', at: at, source: source + (cols.what != null ? ' · ' + (r[cols.what] || '') : ''), consent: consent };
      }
    }
  }
  collect(SHEET_APPLY, { email: 9, consent: 10, name: 4, phone: 5, what: 2 }, '모임');
  collect(SHEET_RENT, { email: 11, consent: 12, name: 5, phone: 6, what: 2 }, '대관');
  collect('개설신청', { email: 4, consent: 23, name: 2, phone: 3, what: 7 }, '개설');

  var out = Object.keys(list).map(function (k) { var x = list[k]; return [x.email, x.name, x.phone, x.at, x.source, x.consent]; });
  out.sort(function (a, b) { return b[3] - a[3]; });
  var sh = ss.getSheetByName('뉴스레터') || ss.insertSheet('뉴스레터');
  sh.clearContents();
  sh.getRange(1, 1, 1, V2_NEWS_HEADERS.length).setValues([V2_NEWS_HEADERS]).setFontWeight('bold');
  if (out.length) sh.getRange(2, 1, out.length, V2_NEWS_HEADERS.length).setValues(out);
  sh.setFrozenRows(1);
  return out.length;
}
