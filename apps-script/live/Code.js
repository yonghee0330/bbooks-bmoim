/**
 * 비북스 b.moim Web App (모임 · 행사 · 대관 · 점주현황)
 *
 * 스프레드시트: 186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM
 *
 * 배포 방법
 * 1. 스프레드시트 → 확장 프로그램 → Apps Script
 * 2. Code.gs 내용을 이 파일 전체로 교체
 * 3. 배포 → 새 배포 → 웹 앱 → 액세스: 모든 사용자
 * 4. 배포 URL이 july.html / june.html / host.html 의 API 와 같으면 HTML 수정 불필요
 */

var SPREADSHEET_ID = '186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM';
var SHEET_APPLY = '모임신청';
var SHEET_RENT = '대관신청';
var SHEET_EVENT = '행사';
var SHEET_CODES = '점주코드';
var EVENT_HEADERS = ['신청일시', '월', '유형', '행사명', '회차', '이름', '연락처', '금액', '접수일', '비고', '도서주문'];

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Apps Script 편집기에서 1회 실행 → 권한 허용 (doGet 대신 이 함수 선택) */
function authorizeSetup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return 'OK: ' + ss.getName();
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'hostStatus') {
      return jsonOutput(getHostStatus_(e.parameter.code, e.parameter.month));
    }
    if (action === 'count') {
      return jsonOutput(getCounts_(e.parameter.month));
    }
    return jsonOutput({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var data = parseBody_(e);
    var action = data.action || '';

    if (action === 'lookup') {
      return jsonOutput(v3Lookup_(data));
    }
    if (action === 'cancelRequest') {
      return jsonOutput(v3CancelRequest_(data));
    }
    if (action === 'resend') {
      return jsonOutput(v3Resend_(data));
    }
    if (action === 'applyV2') {
      return jsonOutput(appendApplyV2_(data));
    }
    if (action === 'rentV2') {
      return jsonOutput(appendRentV2_(data));
    }
    if (action === 'hostApply') {
      return jsonOutput(appendHostApply_(data));
    }
    if (action === 'apply') {
      return jsonOutput(appendApply_(data));
    }
    if (action === 'rent') {
      return jsonOutput(appendRent_(data));
    }
    if (action === 'eventApply') {
      return jsonOutput(appendEventApply_(data));
    }
    return jsonOutput({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function appendApply_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var month = String(data.month || '').trim();
  var reqDate = data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss');
  var sheet = ss.getSheetByName(SHEET_APPLY);
  if (!sheet) throw new Error('모임신청 시트 없음');

  sheet.appendRow([
    new Date(),
    month,
    data.moimName || '',
    data.session || '',
    data.name || '',
    data.phone || '',
    data.amount != null ? data.amount : '',
    reqDate,
    ''
  ]);
  return { ok: true };
}

function appendRent_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_RENT);
  if (!sheet) throw new Error('대관신청 시트 없음');

  sheet.appendRow([
    new Date(),
    data.month || '',
    data.space || '',
    data.date || '',
    data.time || '',
    data.name || '',
    data.phone || '',
    data.purpose || '',
    data.count || '',
    '',
    data.reqDate || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss')
  ]);
  return { ok: true };
}

function ensureEventSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_EVENT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EVENT);
  }
  if (sheet.getLastRow() === 0 || !String(sheet.getRange(1, 1).getValue() || '').trim()) {
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
  } else if (String(sheet.getRange(1, EVENT_HEADERS.length).getValue() || '').trim() !== '도서주문') {
    sheet.getRange(1, EVENT_HEADERS.length).setValue('도서주문');
  }
  return sheet;
}

function appendEventApply_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ensureEventSheet_(ss);

  sheet.appendRow([
    new Date(),
    data.month || '',
    data.eventType || '',
    data.eventName || '',
    data.session || '',
    data.name || '',
    data.phone || '',
    data.amount != null ? data.amount : '',
    data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss'),
    data.note || '',
    data.books || ''
  ]);
  return { ok: true };
}

function getCounts_(month) {
  month = String(month || '7월').trim();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_APPLY);
  if (!sheet) return { counts: {} };

  var rows = sheet.getDataRange().getValues();
  var counts = {};
  var statusCol = rows.length ? rows[0].map(function (h) { return String(h || '').trim(); }).indexOf('상태') : -1;
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[1] || '').trim() !== month) continue;
    var note = String(row[7] || '');
    if (note.indexOf('취소') !== -1) continue;
    if (statusCol > -1 && String(row[statusCol] || '').indexOf('취소') === 0) continue;
    var moimName = String(row[2] || '').trim();
    var session = String(row[3] || '').trim();
    var name = String(row[4] || '').trim();
    if (!moimName || !name) continue;
    if (session) {
      counts[moimName + '_' + session] = (counts[moimName + '_' + session] || 0) + 1;
    }
    counts[moimName] = (counts[moimName] || 0) + 1;
  }
  return { counts: counts };
}

function getHostStatus_(code, month) {
  code = String(code || '').trim().toUpperCase();
  month = String(month || '6월').trim();
  if (!code) {
    return { error: '코드를 입력해주세요.' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var codeSheet = ss.getSheetByName(SHEET_CODES);
  if (!codeSheet) {
    return { error: '점주코드 시트가 없습니다. 비북스 담당자에게 문의해주세요.' };
  }

  var codeRows = codeSheet.getDataRange().getValues();
  var matches = [];
  for (var i = 1; i < codeRows.length; i++) {
    var row = codeRows[i];
    var rowCode = String(row[0] || '').trim().toUpperCase();
    var rowMonth = String(row[3] || '6월').trim();
    if (!rowCode) continue;
    if (rowCode === code && rowMonth === month) {
      matches.push({
        hostName: String(row[1] || '').trim(),
        moimName: String(row[2] || '').trim()
      });
    }
  }

  if (!matches.length) {
    return { error: '코드가 올바르지 않거나 해당 월에 등록된 모임이 없습니다.' };
  }

  var hostName = matches[0].hostName || '점주';
  var moimNames = [];
  matches.forEach(function(m) {
    if (m.moimName && moimNames.indexOf(m.moimName) === -1) {
      moimNames.push(m.moimName);
    }
  });

  var applySheet = ss.getSheetByName(SHEET_APPLY);
  if (!applySheet) {
    return { error: '모임신청 시트를 찾을 수 없습니다.' };
  }

  var applyRows = applySheet.getDataRange().getValues();
  var applicants = [];

  for (var j = 1; j < applyRows.length; j++) {
    var r = applyRows[j];
    var rMonth = String(r[1] || '').trim();
    if (rMonth !== month) continue;

    var rMoim = String(r[2] || '').trim();
    var sessionRaw = r[3];
    var rName = String(r[4] || '').trim();
    var phoneRaw = r[5];
    var amountRaw = r[6];
    var note = String(r[7] || '').trim();

    if (!rMoim || !rName) continue;
    if (moimNames.indexOf(rMoim) === -1) continue;

    applicants.push({
      appliedAt: formatAppliedAt_(r[0]),
      moimName: rMoim,
      session: formatSession_(sessionRaw),
      name: rName,
      phone: formatPhone_(phoneRaw),
      amount: amountRaw || 0,
      note: note,
      cancelled: note.indexOf('취소') !== -1
    });
  }

  var total = applicants.length;
  var cancelled = applicants.filter(function(a) { return a.cancelled; }).length;
  var active = total - cancelled;

  var groups = moimNames.map(function(moimName) {
    var moimApps = applicants.filter(function(a) { return a.moimName === moimName; });
    var sessionKeys = [];
    moimApps.forEach(function(a) {
      var key = a.session || '(회차 미지정)';
      if (sessionKeys.indexOf(key) === -1) sessionKeys.push(key);
    });

    var sessions = sessionKeys.map(function(session) {
      var list = moimApps.filter(function(a) {
        return (a.session || '(회차 미지정)') === session;
      });
      return {
        session: session,
        count: list.length,
        applicants: list
      };
    });

    return {
      moimName: moimName,
      totalCount: moimApps.length,
      activeCount: moimApps.filter(function(a) { return !a.cancelled; }).length,
      sessions: sessions
    };
  });

  return {
    ok: true,
    hostName: hostName,
    month: month,
    moimNames: moimNames,
    stats: {
      total: total,
      active: active,
      cancelled: cancelled
    },
    groups: groups
  };
}

function formatAppliedAt_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss');
  }
  return String(value).trim();
}

function formatSession_(value) {
  if (!value && value !== 0) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    var m = value.getMonth() + 1;
    var d = value.getDate();
    return m + '월' + d + '일';
  }
  var s = String(value).trim();
  if (!s) return '';
  var dateMatch = s.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (dateMatch) {
    return (parseInt(dateMatch[2], 10) + 1) + '월' + parseInt(dateMatch[3], 10) + '일';
  }
  return s.replace(/_bvoice$/, ' (b.voice)').replace(/_영어북클럽$/, ' (영어북클럽)').replace(/_책잇기$/, ' (책잇기)');
}

function formatPhone_(value) {
  if (!value && value !== 0) return '';
  var s = String(value).trim();
  if (s.indexOf('-') !== -1) return s;
  var d = s.replace(/\D/g, '');
  if (d.length === 11) {
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }
  if (d.length === 10) {
    return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  }
  return s;
}


// ══ v2 추가 (2026-09-30): 이메일·동의 수집 / 모임 개설 신청 / 뉴스레터 명단 ══════════
// 기존 열(모임신청 A~I, 대관신청 A~K)은 그대로 두고, 새 항목은 '제목으로 찾는 열'에 씁니다.
// 제목이 없으면 맨 오른쪽에 새로 만듭니다. (H열 '취소' 표시 등 기존 운영 방식에 영향 없음)

var V2_APPLY_COLS = ['신청 메모', '도서 요청', '이메일', '소식수신동의', '개인정보동의', '유입'];
var V2_RENT_COLS = ['이메일', '소식수신동의', '개인정보동의', '유입'];
var V2_HOST_SHEET = '개설신청';
var V2_HOST_HEADERS = ['접수일시', '월', '호스트', '연락처', '이메일', '인스타', '호스트소개', '모임제목', '한줄소개', '분야', '대상',
  '상세소개', '희망일정1', '희망일정2', '진행시간', '희망공간', '정원', '참가비', '재료', '정기', '포스터', '요청',
  '개인정보동의', '소식수신동의', '유입', '상태'];
var V2_NEWS_SHEET = '뉴스레터';
var V2_NEWS_HEADERS = ['이메일', '이름', '연락처', '최근 신청', '출처', '동의 기록'];

function v2Clean_(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, max || 300);
}
function v2Email_(s) {
  var e = String(s || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.slice(0, 120) : '';
}
function v2Stamp_(yes) {
  return yes ? 'Y ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : 'N';
}
function v2RequirePrivacy_(data) {
  if (!data.consent || !data.consent.privacy) throw new Error('개인정보 수집·이용에 동의해 주세요.');
}

/** 1행 제목에서 열 위치 찾기 — 없으면 오른쪽 끝에 제목 추가. { 제목: 열번호(1부터) } */
function v2Columns_(sheet, names) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var head = sheet.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var map = {};
  names.forEach(function (n) {
    var i = head.indexOf(n);
    if (i === -1) {
      head.push(n);
      i = head.length - 1;
      sheet.getRange(1, i + 1).setValue(n);
    }
    map[n] = i + 1;
  });
  return map;
}

/** 기존 앞부분 열(base) + 제목으로 찾은 뒷부분 열(extra)을 한 줄로 기록 */
function v2Append_(sheet, base, extra) {
  var cols = v2Columns_(sheet, Object.keys(extra));
  var width = base.length;
  Object.keys(cols).forEach(function (k) { width = Math.max(width, cols[k]); });
  var row = [];
  for (var i = 0; i < width; i++) row.push(i < base.length ? base[i] : '');
  Object.keys(extra).forEach(function (k) { row[cols[k] - 1] = extra[k]; });
  sheet.appendRow(row);
}

/** 모임 신청 v2 — A~I는 기존 apply와 똑같이, 새 항목은 제목 열에 */
function appendApplyV2_(data) {
  v2RequirePrivacy_(data);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_APPLY);
  if (!sheet) throw new Error('모임신청 시트 없음');
  var reqDate = data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss');
  // 패키지처럼 여러 줄로 기록되는 신청은 같은 신청번호를 공유 (두 번째 줄부터는 안내를 다시 보내지 않음)
  var follow = /^BM-[A-Z2-9]{6}$/.test(String(data.code || ''));
  var code = follow ? String(data.code) : v3NewCode_('BM');
  var amount = Number(data.amount) || 0;
  var deadline = new Date(Date.now() + Number(v3Prop_('PAY_DEADLINE_HOURS', '24')) * 3600e3);
  v2Append_(sheet, [
    new Date(),
    v2Clean_(data.month, 10),
    v2Clean_(data.moimName, 120),
    v2Clean_(data.session, 60),
    v2Clean_(data.name, 40),
    v2Clean_(data.phone, 20),
    data.amount != null ? data.amount : '',
    reqDate,
    ''
  ], {
    '신청 메모': v2Clean_(data.note, 500),
    '도서 요청': v2Clean_(data.books, 300),
    '이메일': v2Email_(data.email),
    '소식수신동의': v2Stamp_(data.consent.marketing),
    '개인정보동의': v2Stamp_(true),
    '유입': v2Clean_(data.ref, 40),
    '신청번호': code,
    '상태': follow ? '' : (amount > 0 ? '입금대기' : '신청확정'),
    '입금기한': follow || amount <= 0 ? '' : deadline
  });
  var notified = follow ? {} : v3NotifyApply_(data, code, deadline, sheet.getLastRow());
  return { ok: true, v: 3, code: code, amount: amount, deadline: deadline.getTime(), notified: notified };
}

/** 대관 신청 v2 — A~K는 기존 rent와 똑같이 */
function appendRentV2_(data) {
  v2RequirePrivacy_(data);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_RENT);
  if (!sheet) throw new Error('대관신청 시트 없음');
  var code = v3NewCode_('BR');
  v2Append_(sheet, [
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
    data.reqDate || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss')
  ], {
    '이메일': v2Email_(data.email),
    '소식수신동의': v2Stamp_(data.consent.marketing),
    '개인정보동의': v2Stamp_(true),
    '유입': v2Clean_(data.ref, 40),
    '신청번호': code,
    '상태': '접수'
  });
  var notified = v3NotifyRent_(data, code, sheet.getLastRow());
  return { ok: true, v: 3, code: code, notified: notified };
}

/** 모임 개설 신청 — '개설신청' 탭 (없으면 생성) */
function v2HostSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(V2_HOST_SHEET);
  if (!sh) {
    sh = ss.insertSheet(V2_HOST_SHEET);
    sh.getRange(1, 1, 1, V2_HOST_HEADERS.length).setValues([V2_HOST_HEADERS]).setFontWeight('bold').setBackground('#f3e8d8');
    sh.setFrozenRows(1);
  }
  return sh;
}
function appendHostApply_(data) {
  v2RequirePrivacy_(data);
  ['hostName', 'phone', 'title', 'oneLiner', 'description', 'date1', 'capacity'].forEach(function (k) {
    if (!String(data[k] || '').trim()) throw new Error('필수 항목이 비어 있어요.');
  });
  var d = data;
  v2HostSheet_().appendRow([
    new Date(), v2Clean_(d.month, 10), v2Clean_(d.hostName, 40), v2Clean_(d.phone, 20), v2Email_(d.email), v2Clean_(d.insta, 40),
    v2Clean_(d.hostBio, 500), v2Clean_(d.title, 100), v2Clean_(d.oneLiner, 60), v2Clean_(d.category, 20), v2Clean_(d.audience, 60),
    v2Clean_(d.description, 3000), v2Clean_(d.date1, 20), v2Clean_(d.date2, 20), v2Clean_(d.duration, 20), v2Clean_(d.space, 20),
    v2Clean_(d.capacity, 10), v2Clean_(d.price, 10), v2Clean_(d.materials, 10), v2Clean_(d.regular, 10), v2Clean_(d.posterUrl, 300),
    v2Clean_(d.request, 1000), v2Stamp_(true), v2Stamp_(d.consent.marketing), v2Clean_(d.ref, 40), '접수'
  ]);
  return { ok: true, v: 2 };
}

/** 새 열 제목·개설신청 탭 미리 만들기 (편집기에서 한 번 실행해도 되고, 첫 신청 때 자동으로도 생김) */
function setupSheetV2() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  v2Columns_(ss.getSheetByName(SHEET_APPLY), V2_APPLY_COLS);
  v2Columns_(ss.getSheetByName(SHEET_RENT), V2_RENT_COLS);
  v2HostSheet_();
}

/** 뉴스레터 명단 — 소식수신동의가 Y인 이메일만, 중복 없이 '뉴스레터' 탭에 정리 (편집기에서 실행 / 주 1회 트리거 권장) */
function buildNewsletterList() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var list = {};
  function collect(sheetName, nameCol, phoneCol, whatCol, source) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;
    var rows = sh.getDataRange().getValues();
    var head = rows[0].map(function (h) { return String(h || '').trim(); });
    var ei = head.indexOf('이메일'), ci = head.indexOf('소식수신동의');
    if (ei === -1 || ci === -1) return;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var email = v2Email_(r[ei]);
      var consent = String(r[ci] || '');
      if (!email || consent.indexOf('Y') !== 0) continue;
      var key = email.toLowerCase();
      var at = r[0] instanceof Date ? r[0] : new Date(r[0]);
      if (!list[key] || at > list[key].at) {
        list[key] = { email: email, name: r[nameCol] || '', phone: r[phoneCol] || '', at: at, source: source + ' · ' + (r[whatCol] || ''), consent: consent };
      }
    }
  }
  collect(SHEET_APPLY, 4, 5, 2, '모임');
  collect(SHEET_RENT, 5, 6, 2, '대관');
  collect(V2_HOST_SHEET, 2, 3, 7, '개설');
  var out = Object.keys(list).map(function (k) { var x = list[k]; return [x.email, x.name, x.phone, x.at, x.source, x.consent]; });
  out.sort(function (a, b) { return b[3] - a[3]; });
  var sh = ss.getSheetByName(V2_NEWS_SHEET) || ss.insertSheet(V2_NEWS_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, 1, V2_NEWS_HEADERS.length).setValues([V2_NEWS_HEADERS]).setFontWeight('bold');
  if (out.length) sh.getRange(2, 1, out.length, V2_NEWS_HEADERS.length).setValues(out);
  sh.setFrozenRows(1);
  return out.length;
}


// ══ v3 추가 (2026-10): 신청번호 · 내 신청 조회/취소 · 메일·알림톡 ══════════════════
// 설정은 [프로젝트 설정 → 스크립트 속성]. 없으면 기본값을 씁니다.
//   OPERATOR_EMAIL   운영자 알림 메일 (기본: 이 스크립트를 배포한 계정)
//   SITE_URL         https://moim.bbooks.co.kr/
//   BANK_TEXT        카카오뱅크 7942-33-45474 (예금주 경규환)
//   INSTAGRAM        @b_books2026
//   PAY_DEADLINE_HOURS  24
//   알림톡(솔라피): SOLAPI_API_KEY · SOLAPI_API_SECRET · SOLAPI_PFID · SOLAPI_SENDER · TPL_APPLY · TPL_PAID · TPL_RENT · TPL_RESEND
//                  (없으면 알림톡은 건너뛰고 메일만 보냅니다)
// 처음 한 번: 편집기에서 setupV3 실행 → 메일·외부요청·트리거 권한 승인 + '상태' 변경 알림 트리거 생성

var V3_APPLY_COLS = ['신청번호', '상태', '입금기한', '알림'];
var V3_RENT_COLS = ['신청번호', '상태', '알림'];
var V3_WD = ['일', '월', '화', '수', '목', '금', '토'];

function v3Prop_(k, d) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v === null || v === '' ? d : v;
}
function v3Site_(path) { return String(v3Prop_('SITE_URL', 'https://moim.bbooks.co.kr/')).replace(/\/?$/, '/') + (path || ''); }
function v3Bank_() { return v3Prop_('BANK_TEXT', '카카오뱅크 7942-33-45474 (예금주 경규환)'); }
function v3Insta_() { return v3Prop_('INSTAGRAM', '@b_books2026'); }
function v3Digits_(s) { return String(s || '').replace(/\D/g, ''); }
function v3Won_(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
function v3Esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function v3Fmt_(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d)) return '';
  var k = new Date(d.getTime() + 9 * 3600e3);
  return (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일 (' + V3_WD[k.getUTCDay()] + ') ' +
    ('0' + k.getUTCHours()).slice(-2) + ':' + ('0' + k.getUTCMinutes()).slice(-2);
}
function v3Session_(v) {
  if (v instanceof Date) { var k = new Date(v.getTime() + 9 * 3600e3); return (k.getUTCMonth() + 1) + '월' + k.getUTCDate() + '일'; }
  return String(v || '');
}
function v3NewCode_(prefix) {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = prefix + '-';
  for (var i = 0; i < 6; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}
function v3RateLimit_(key, max) {
  var cache = CacheService.getScriptCache(), k = 'rl:' + key, n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 600);
  if (n > (max || 8)) throw new Error('요청이 너무 많아요. 10분 뒤 다시 시도해 주세요.');
}
function v3Log_(sheetKey, row, text) {
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetKey);
    var col = v2Columns_(sh, ['알림'])['알림'];
    var prev = String(sh.getRange(row, col).getValue() || '');
    sh.getRange(row, col).setValue(prev ? prev + ' / ' + text : text);
  } catch (e) { /* 기록 실패는 무시 */ }
}

// ── 알림: 메일 ──
function v3Mail_(to, subject, inner) {
  var email = v2Email_(to);
  if (!email) return 'none';
  try {
    var opts = {
      to: email, subject: subject, name: '비북스 b.moim',
      htmlBody: '<div style="font-family:-apple-system,\'Apple SD Gothic Neo\',\'Noto Sans KR\',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2b211b;line-height:1.65">' +
        '<p style="font-weight:700;color:#a8491a;margin:0 0 16px">비북스 b.moim</p>' + inner +
        '<hr style="border:0;border-top:1px solid #ebe3d7;margin:24px 0 12px"><p style="font-size:12px;color:#85766a">비북스 · 경기도 부천시 원미구 부천로136번길 24 지하 B02호 · 문의 인스타그램 ' + v3Esc_(v3Insta_()) + '</p></div>'
    };
    var reply = v3Prop_('OPERATOR_EMAIL', '');
    if (reply) opts.replyTo = reply;
    MailApp.sendEmail(opts);
    return 'sent';
  } catch (e) { return 'failed'; }
}
function v3Operator_(subject, text) {
  try {
    var to = v3Prop_('OPERATOR_EMAIL', Session.getEffectiveUser().getEmail());
    if (to) MailApp.sendEmail(to, '[비모임] ' + subject, text + '\n\nhttps://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID, { name: '비모임 알림' });
  } catch (e) { /* 무시 */ }
}

// ── 알림: 카카오 알림톡 (솔라피). 설정이 없으면 'skipped' ──
function v3Alimtalk_(phone, tplKey, vars) {
  var key = v3Prop_('SOLAPI_API_KEY', ''), secret = v3Prop_('SOLAPI_API_SECRET', ''), pfId = v3Prop_('SOLAPI_PFID', ''), tpl = v3Prop_(tplKey, '');
  if (!key || !secret || !pfId || !tpl) return 'skipped';
  try {
    var date = new Date().toISOString(), salt = Utilities.getUuid().replace(/-/g, '');
    var sig = Utilities.computeHmacSha256Signature(date + salt, secret).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + sig },
      payload: JSON.stringify({ message: { to: v3Digits_(phone), from: v3Prop_('SOLAPI_SENDER', ''), kakaoOptions: { pfId: pfId, templateId: tpl, variables: vars, disableSms: v3Prop_('SMS_FALLBACK', 'Y') !== 'Y' } } })
    });
    return res.getResponseCode() < 300 ? 'sent' : 'failed';
  } catch (e) { return 'failed'; }
}

// ── 신청 직후 안내 ──
function v3NotifyApply_(data, code, deadline, sheetRow) {
  var amount = Number(data.amount) || 0;
  var vars = {
    '#{이름}': String(data.name || ''), '#{모임명}': String(data.moimName || ''), '#{일정}': String(data.optionLabel || data.session || ''),
    '#{신청번호}': code, '#{금액}': v3Won_(amount), '#{계좌}': v3Bank_(), '#{기한}': v3Fmt_(deadline), '#{확인링크}': v3Site_('my/?code=' + code)
  };
  var pay = amount > 0 ? '<table style="width:100%;background:#fbeee4;border-radius:10px;padding:14px;margin:14px 0">' +
    '<tr><td style="color:#85766a">입금할 금액</td><td style="text-align:right;font-size:20px;font-weight:800">' + v3Esc_(vars['#{금액}']) + '</td></tr>' +
    '<tr><td style="color:#85766a">입금 계좌</td><td style="text-align:right">' + v3Esc_(vars['#{계좌}']) + '</td></tr>' +
    '<tr><td style="color:#85766a">입금 기한</td><td style="text-align:right">' + v3Esc_(vars['#{기한}']) + '</td></tr>' +
    '<tr><td style="color:#85766a">입금자명</td><td style="text-align:right">' + v3Esc_(vars['#{이름}']) + '</td></tr></table>' +
    '<p>입금이 확인되면 참가 확정 안내를 다시 보내드려요.</p>' : '';
  var n = {
    email: v3Mail_(data.email, '[비북스 b.moim] ' + vars['#{모임명}'] + ' 신청이 접수됐어요',
      '<h2 style="font-size:20px;margin:0 0 8px">신청이 접수됐어요</h2><p>' + v3Esc_(vars['#{이름}']) + '님, <b>' + v3Esc_(vars['#{모임명}']) + '</b> 신청이 접수되었습니다.</p>' +
      '<p>일정: ' + v3Esc_(vars['#{일정}']) + '<br>신청번호: <b>' + code + '</b></p>' + pay +
      '<p><a href="' + vars['#{확인링크}'] + '" style="display:inline-block;background:#d2642a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">내 신청 확인 · 취소 요청</a></p>'),
    alimtalk: v3Alimtalk_(data.phone, 'TPL_APPLY', vars)
  };
  v3Operator_('신청 · ' + vars['#{모임명}'] + ' · ' + vars['#{이름}'],
    vars['#{모임명}'] + '\n' + vars['#{일정}'] + '\n' + vars['#{이름}'] + ' ' + data.phone + '\n' + vars['#{금액}'] + ' · 신청번호 ' + code);
  v3Log_(SHEET_APPLY, sheetRow, '접수 메일 ' + n.email + ' · 알림톡 ' + n.alimtalk);
  return n;
}

function v3NotifyRent_(data, code, sheetRow) {
  var vars = { '#{이름}': String(data.name || ''), '#{공간}': String(data.space || ''), '#{일정}': String(data.date || '') + ' ' + String(data.time || ''), '#{신청번호}': code, '#{확인링크}': v3Site_('my/?code=' + code) };
  var n = {
    email: v3Mail_(data.email, '[비북스] 대관 신청이 접수됐어요 (' + vars['#{일정}'] + ')',
      '<h2 style="font-size:20px;margin:0 0 8px">대관 신청이 접수됐어요</h2><p>' + v3Esc_(vars['#{이름}']) + '님, ' + v3Esc_(vars['#{공간}']) + ' 대관 신청이 접수되었습니다.</p>' +
      '<p>일정: ' + v3Esc_(vars['#{일정}']) + '<br>신청번호: <b>' + code + '</b></p><p>담당자가 일정 확인 후 금액과 입금 방법을 안내드려요.</p>' +
      '<p><a href="' + vars['#{확인링크}'] + '">내 신청 확인</a></p>'),
    alimtalk: v3Alimtalk_(data.phone, 'TPL_RENT', vars)
  };
  v3Operator_('대관 · ' + vars['#{공간}'] + ' ' + vars['#{일정}'], vars['#{이름}'] + ' ' + data.phone + '\n인원 ' + (data.count || '-') + ' · 목적 ' + (data.purpose || '-') + '\n신청번호 ' + code);
  v3Log_(SHEET_RENT, sheetRow, '접수 메일 ' + n.email + ' · 알림톡 ' + n.alimtalk);
  return n;
}

// ── 시트 읽기 (신청번호가 있는 줄만) ──
function v3Rows_(sheetName) {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return { sh: sh, head: [], rows: [] };
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h || '').trim(); });
  return { sh: sh, head: head, rows: v.slice(1).map(function (r, i) { r._row = i + 2; return r; }) };
}
function v3Mine_(phone) {
  var out = [];
  var a = v3Rows_(SHEET_APPLY), ai = { code: a.head.indexOf('신청번호'), st: a.head.indexOf('상태'), dl: a.head.indexOf('입금기한'), em: a.head.indexOf('이메일') };
  if (ai.code > -1) a.rows.forEach(function (r) {
    if (!r[ai.code] || v3Digits_(r[5]) !== phone) return;
    out.push({ sheet: SHEET_APPLY, row: r._row, email: ai.em > -1 ? r[ai.em] : '', name: r[4], pub: {
      kind: 'moim', code: String(r[ai.code]), at: new Date(r[0]).getTime(), title: String(r[2] || ''), optionLabel: v3Session_(r[3]),
      amount: Number(r[6]) || 0, status: String(r[ai.st] || '입금대기'), name: String(r[4] || ''), deadline: ai.dl > -1 && r[ai.dl] ? new Date(r[ai.dl]).getTime() : 0 } });
  });
  var b = v3Rows_(SHEET_RENT), bi = { code: b.head.indexOf('신청번호'), st: b.head.indexOf('상태'), em: b.head.indexOf('이메일') };
  if (bi.code > -1) b.rows.forEach(function (r) {
    if (!r[bi.code] || v3Digits_(r[6]) !== phone) return;
    var d = r[3] instanceof Date ? Utilities.formatDate(r[3], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[3] || '');
    out.push({ sheet: SHEET_RENT, row: r._row, email: bi.em > -1 ? r[bi.em] : '', name: r[5], pub: {
      kind: 'rent', code: String(r[bi.code]), at: new Date(r[0]).getTime(), title: '대관 · ' + r[2], optionLabel: d + ' ' + r[4],
      amount: 0, status: String(r[bi.st] || '접수'), name: String(r[5] || ''), deadline: 0 } });
  });
  return out;
}

/** 내 신청 조회: 신청번호 + 휴대폰이 맞으면 그 번호로 한 신청 전체 */
function v3Lookup_(data) {
  var phone = v3Digits_(data.phone), code = String(data.code || '').trim().toUpperCase();
  if (!/^01\d{8,9}$/.test(phone) || !code) throw new Error('신청번호와 휴대폰 번호를 확인해 주세요.');
  v3RateLimit_('lookup:' + phone, 10);
  var mine = v3Mine_(phone);
  if (!mine.some(function (m) { return m.pub.code === code; })) throw new Error('일치하는 신청이 없어요. 신청번호와 휴대폰 번호를 확인해 주세요.');
  return { ok: true, apps: mine.map(function (m) { return m.pub; }) };
}

/** 취소 요청: 상태를 '취소요청'으로, 운영자에게 알림 (환불·최종 취소는 운영자가 처리) */
function v3CancelRequest_(data) {
  var phone = v3Digits_(data.phone), auth = String(data.code || '').trim().toUpperCase(), target = String(data.target || auth).trim().toUpperCase();
  v3RateLimit_('cancel:' + phone, 6);
  var mine = v3Mine_(phone);
  if (!mine.some(function (m) { return m.pub.code === auth; })) throw new Error('본인 확인에 실패했어요.');
  var rows = mine.filter(function (m) { return m.pub.code === target; });
  if (!rows.length) throw new Error('신청을 찾지 못했어요.');
  rows.forEach(function (m) {
    if (m.pub.status.indexOf('취소') === 0) return;
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(m.sheet);
    sh.getRange(m.row, v2Columns_(sh, ['상태'])['상태']).setValue('취소요청');
    v3Log_(m.sheet, m.row, '취소요청 ' + v3Fmt_(new Date()));
  });
  var p = rows[0].pub;
  v3Operator_('취소요청 · ' + p.title + ' · ' + p.name, p.title + '\n' + p.optionLabel + '\n' + p.name + ' ' + data.phone + '\n신청번호 ' + target +
    '\n\n환불 처리 후 상태를 "취소"로 바꿔 주세요. (상태가 취소로 시작하면 남은 자리에서 빠집니다)');
  return { ok: true, status: '취소요청' };
}

/** 신청번호 다시 받기: 이름+휴대폰이 맞는 신청이 있으면 메일·알림톡으로만 보냄 (화면엔 표시 안 함) */
function v3Resend_(data) {
  var phone = v3Digits_(data.phone), name = String(data.name || '').trim();
  v3RateLimit_('resend:' + phone, 3);
  var mine = v3Mine_(phone).filter(function (m) { return String(m.name).trim() === name && m.pub.status.indexOf('취소') !== 0; });
  if (mine.length) {
    var list = mine.map(function (m) { return m.pub.title + ' ' + m.pub.code; }).join('\n');
    v3Alimtalk_(phone, 'TPL_RESEND', { '#{이름}': name, '#{신청목록}': list, '#{확인링크}': v3Site_('my/') });
    var email = mine.map(function (m) { return v2Email_(m.email); }).filter(String)[0];
    if (email) v3Mail_(email, '[비북스 b.moim] 신청번호 안내', '<p>' + v3Esc_(name) + '님의 신청번호입니다.</p><pre style="font-size:15px">' + v3Esc_(list) + '</pre><p><a href="' + v3Site_('my/') + '">내 신청 확인</a></p>');
  }
  return { ok: true };
}

/** 설치형 트리거: 모임신청 '상태'를 '입금확인'으로 바꾸면 참가 확정 안내 */
function onStatusEditV3(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEET_APPLY || e.range.getRow() < 2 || String(e.value || '') !== '입금확인') return;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    if (head[e.range.getColumn() - 1] !== '상태') return;
    var r = sh.getRange(e.range.getRow(), 1, 1, head.length).getValues()[0];
    var code = r[head.indexOf('신청번호')] || '';
    var vars = { '#{이름}': String(r[4] || ''), '#{모임명}': String(r[2] || ''), '#{일정}': v3Session_(r[3]), '#{신청번호}': String(code), '#{확인링크}': v3Site_('my/?code=' + code) };
    var em = v3Mail_(r[head.indexOf('이메일')], '[비북스 b.moim] ' + vars['#{모임명}'] + ' 참가가 확정됐어요',
      '<h2 style="font-size:20px;margin:0 0 8px">참가가 확정됐어요</h2><p>' + v3Esc_(vars['#{이름}']) + '님, 입금이 확인되어 <b>' + v3Esc_(vars['#{모임명}']) + '</b> 참가가 확정되었습니다.</p>' +
      '<p>일정: ' + v3Esc_(vars['#{일정}']) + '<br>장소: 비북스 (부천로136번길 24 지하 B02호)</p><p><a href="' + vars['#{확인링크}'] + '">내 신청 확인</a></p>');
    var at = v3Alimtalk_(r[5], 'TPL_PAID', vars);
    v3Log_(SHEET_APPLY, e.range.getRow(), '확정 메일 ' + em + ' · 알림톡 ' + at);
  } catch (err) { /* 무시 */ }
}

/** 처음 한 번 편집기에서 실행: 권한 승인(메일·외부 요청·트리거) + 새 열 + 트리거 생성 */
function setupV3() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  v2Columns_(ss.getSheetByName(SHEET_APPLY), V2_APPLY_COLS.concat(V3_APPLY_COLS));
  v2Columns_(ss.getSheetByName(SHEET_RENT), V2_RENT_COLS.concat(V3_RENT_COLS));
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'onStatusEditV3') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onStatusEditV3').forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  UrlFetchApp.fetch('https://api.solapi.com', { muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();
  return 'ok';
}
