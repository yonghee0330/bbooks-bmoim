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
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[1] || '').trim() !== month) continue;
    var note = String(row[7] || '');
    if (note.indexOf('취소') !== -1) continue;
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
    '유입': v2Clean_(data.ref, 40)
  });
  return { ok: true, v: 2 };
}

/** 대관 신청 v2 — A~K는 기존 rent와 똑같이 */
function appendRentV2_(data) {
  v2RequirePrivacy_(data);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_RENT);
  if (!sheet) throw new Error('대관신청 시트 없음');
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
    '유입': v2Clean_(data.ref, 40)
  });
  return { ok: true, v: 2 };
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
