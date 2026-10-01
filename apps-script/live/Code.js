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
    '입금기한': follow || amount <= 0 ? '' : deadline,
    '메일정보': follow ? '' : JSON.stringify(v3MailInfo_(data))
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
  v3Ops_({ kind: '개설 신청', headline: String(d.title || '') + ' · ' + String(d.hostName || ''), sub: String(d.oneLiner || ''),
    rows: [['호스트', d.hostName], ['연락처', d.phone], ['이메일', v2Email_(d.email)], ['인스타', d.insta || ''], ['분야', d.category || ''], ['희망 일정', [d.date1, d.date2].filter(String).join(' / ')],
      ['공간', d.space || ''], ['정원', d.capacity ? d.capacity + '명' : ''], ['참가비', d.price ? v3Won_(d.price) : ''], ['재료', d.materials || ''], ['포스터', d.posterUrl || ''], ['요청', d.request || '']],
    todo: '개설신청 탭에서 상세 소개를 확인하고 호스트에게 연락해 주세요.' });
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
/** 운영자·매니저 받는 사람: OPERATOR_EMAIL(기본: 스크립트 소유 계정) + MANAGER_EMAILS(기본: yorokobi720@gmail.com) */
function v3OpsTo_() {
  var list = [];
  var owner = '';
  try { owner = Session.getEffectiveUser().getEmail(); } catch (e) { /* 무시 */ }
  String(v3Prop_('OPERATOR_EMAIL', owner) + ',' + v3Prop_('MANAGER_EMAILS', 'yorokobi720@gmail.com')).split(',').forEach(function (x) {
    var e = v2Email_(x);
    if (e && list.indexOf(e.toLowerCase()) === -1) list.push(e.toLowerCase());
  });
  return list.join(',');
}

/** 운영자 알림 (디자인 메일). o = { kind, headline, sub, rows: [[항목, 값]], todo } */
function v3Ops_(o) {
  try {
    var to = v3OpsTo_();
    if (!to) return;
    var m = m4OperatorMail_({ kind: o.kind, headline: o.headline, sub: o.sub, rows: o.rows, todo: o.todo,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID });
    MailApp.sendEmail({ to: to, subject: m.subject, htmlBody: m.html, name: '비모임 알림' });
  } catch (e) { /* 무시 */ }
}

/** (예전 형식 호환) 글자만 있는 운영자 알림 */
function v3Operator_(subject, text) {
  v3Ops_({ kind: '알림', headline: subject, rows: String(text || '').split('\n').filter(String).map(function (l) { return ['', l]; }) });
}

/** 디자인 메일을 그대로 보내기 */
function v3MailHtml_(to, m) {
  var email = v2Email_(to);
  if (!email) return 'none';
  try {
    var opts = { to: email, subject: m.subject, htmlBody: m.html, name: '비북스 b.moim' };
    var reply = v3Prop_('OPERATOR_EMAIL', '');
    if (reply) opts.replyTo = reply;
    MailApp.sendEmail(opts);
    return 'sent';
  } catch (e) { return 'failed'; }
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
function v3MailInfo_(data) {
  return { title: String(data.title || data.moimName || ''), kindLabel: String(data.kindLabel || '비모임'), when: String(data.optionLabel || data.session || ''),
    place: String(data.place || ''), poster: String(data.poster || ''), pageUrl: String(data.pageUrl || '') };
}

function v3NotifyApply_(data, code, deadline, sheetRow) {
  var amount = Number(data.amount) || 0;
  var info = v3MailInfo_(data);
  var vars = {
    '#{이름}': String(data.name || ''), '#{모임명}': info.title, '#{일정}': info.when,
    '#{신청번호}': code, '#{금액}': v3Won_(amount), '#{계좌}': v3Bank_(), '#{기한}': v3Fmt_(deadline), '#{확인링크}': v3Site_('my/?code=' + code)
  };
  var mail = m4ApplyMail_({
    name: vars['#{이름}'], title: info.title, kindLabel: info.kindLabel, when: info.when, place: info.place, poster: info.poster, pageUrl: info.pageUrl,
    code: code, myUrl: vars['#{확인링크}'], amount: vars['#{금액}'], amountNum: amount, bank: vars['#{계좌}'], deadline: vars['#{기한}'],
    memo: String(data.memo || ''), refund: String(data.refund || ''), instagram: v3Insta_(), siteUrl: v3Site_('')
  });
  var n = { email: v3MailHtml_(data.email, mail), alimtalk: v3Alimtalk_(data.phone, 'TPL_APPLY', vars) };
  v3Ops_({
    kind: '신청', headline: info.title + ' · ' + vars['#{이름}'], sub: info.when,
    rows: [['신청번호', code], ['이름', vars['#{이름}']], ['연락처', data.phone], ['이메일', v2Email_(data.email)], ['금액', vars['#{금액}']],
      ['입금 기한', amount > 0 ? vars['#{기한}'] : ''], ['메모', data.memo || ''], ['도서 요청', data.books || ''], ['유입', data.ref || '']],
    todo: amount > 0 ? '입금이 확인되면 모임신청 탭 <b>상태</b>를 <b>입금확인</b>으로 바꿔 주세요. 참가 확정 메일이 자동으로 나가요.<br>기한까지 입금이 없으면 <b>취소</b>로 바꾸면 남은 자리로 돌아가요.' : ''
  });
  v3Log_(SHEET_APPLY, sheetRow, '접수 메일 ' + n.email + ' · 알림톡 ' + n.alimtalk);
  return n;
}

function v3NotifyRent_(data, code, sheetRow) {
  var vars = { '#{이름}': String(data.name || ''), '#{공간}': String(data.space || ''), '#{일정}': String(data.date || '') + ' ' + String(data.time || ''), '#{신청번호}': code, '#{확인링크}': v3Site_('my/?code=' + code) };
  var mail = m4RentMail_({ name: vars['#{이름}'], code: code, myUrl: vars['#{확인링크}'], space: vars['#{공간}'], date: String(data.date || ''), time: String(data.time || ''),
    count: data.count || '', purpose: String(data.purpose || ''), instagram: v3Insta_(), siteUrl: v3Site_('') });
  var n = { email: v3MailHtml_(data.email, mail), alimtalk: v3Alimtalk_(data.phone, 'TPL_RENT', vars) };
  v3Ops_({
    kind: '대관', headline: vars['#{공간}'] + ' · ' + vars['#{일정}'], sub: vars['#{이름}'] + '님 신청',
    rows: [['신청번호', code], ['이름', vars['#{이름}']], ['연락처', data.phone], ['이메일', v2Email_(data.email)], ['공간', vars['#{공간}']], ['일정', vars['#{일정}']],
      ['인원', data.count ? data.count + '명' : ''], ['목적', data.purpose || ''], ['유입', data.ref || '']],
    todo: '일정을 확인한 뒤 신청자에게 금액과 입금 방법을 안내해 주세요. 대관신청 탭 <b>상태</b>에 진행 상황(확정·취소 등)을 적어 두면 내 신청 조회에 그대로 보여요.'
  });
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
  v3Ops_({ kind: '취소요청', headline: p.title + ' · ' + p.name, sub: p.optionLabel,
    rows: [['신청번호', target], ['이름', p.name], ['연락처', data.phone], ['금액', p.amount ? v3Won_(p.amount) : ''], ['신청일', v3Fmt_(p.at)]],
    todo: '환불 규정에 맞춰 환불한 뒤 <b>상태</b>를 <b>취소</b>로 바꿔 주세요. 취소로 시작하는 상태는 남은 자리에서 빠져요.' });
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
    if (email) v3MailHtml_(email, m4ResendMail_({ name: name, list: mine.map(function (m) { return { code: m.pub.code, title: m.pub.title + ' · ' + m.pub.optionLabel }; }), myUrl: v3Site_('my/'), instagram: v3Insta_(), siteUrl: v3Site_('') }));
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
    var info = {};
    try { info = JSON.parse(r[head.indexOf('메일정보')] || '{}'); } catch (x) { info = {}; }
    if (info.when) vars['#{일정}'] = info.when;
    var em = v3MailHtml_(r[head.indexOf('이메일')], m4PaidMail_({ name: vars['#{이름}'], title: info.title || vars['#{모임명}'], kindLabel: info.kindLabel, when: vars['#{일정}'],
      place: info.place || '', poster: info.poster || '', pageUrl: info.pageUrl || '', code: String(code), myUrl: vars['#{확인링크}'], instagram: v3Insta_(), siteUrl: v3Site_('') }));
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

// ══ v4 메일 디자인 (2026-10) ═════════════════════════════════════════
// 순수 문자열 함수만 있습니다 (Apps Script 서비스 호출 없음) → 미리보기에서도 그대로 실행됩니다.
// 메일 프로그램 호환을 위해 표(table) + 인라인 스타일로 작성합니다.

var M4 = {
  ink: '#2b211b', ink2: '#4a3e36', muted: '#85766a', line: '#ebe3d7', paper: '#f7f2ea', bg: '#f3eee6',
  accent: '#d2642a', accentInk: '#a8491a', accentSoft: '#fbeee4', ok: '#3e7c59', okSoft: '#e8f2ea', wood: '#8b5e3c',
  font: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif",
  serif: "'Noto Serif KR','AppleMyungjo','Nanum Myeongjo',serif",
  address: '경기도 부천시 원미구 부천로136번길 24 지하 B02호',
  mapUrl: 'https://map.naver.com/p/search/%EB%B9%84%EB%B6%81%EC%8A%A4%20%EB%B6%80%EC%B2%9C'
};

function m4Esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

/** 공통 틀: 머리(로고·배지) · 본문 · 꼬리 */
function m4Layout_(o) {
  var c = M4;
  var badge = o.badge ? '<td align="right" style="font:700 12px ' + c.font + ';color:' + (o.badgeColor || c.accentInk) + ';">' +
    '<span style="display:inline-block;padding:5px 10px;border:1px solid ' + (o.badgeColor || c.accentInk) + ';border-radius:999px;">' + m4Esc_(o.badge) + '</span></td>' : '<td></td>';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><title>' + m4Esc_(o.title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + c.bg + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + m4Esc_(o.preheader || '') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + c.bg + ';"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ' + c.line + ';">' +
    // 머리
    '<tr><td style="padding:20px 24px;border-bottom:1px solid ' + c.line + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font:700 18px ' + c.serif + ';color:' + c.ink + ';">' +
    '<span style="display:inline-block;width:5px;height:15px;background:' + c.wood + ';border-radius:1px;vertical-align:-1px;"></span>' +
    '<span style="display:inline-block;width:5px;height:20px;background:' + c.accent + ';border-radius:1px;margin:0 2px;vertical-align:-1px;"></span>' +
    '<span style="display:inline-block;width:5px;height:12px;background:' + c.ink + ';border-radius:1px;margin-right:8px;vertical-align:-1px;"></span>' +
    '비북스 <span style="font-family:Georgia,serif;">b<span style="color:' + c.accent + ';">.</span>moim</span></td>' + badge +
    '</tr></table></td></tr>' +
    // 본문
    '<tr><td style="padding:28px 24px 8px;font:15px/1.7 ' + c.font + ';color:' + c.ink + ';">' + o.body + '</td></tr>' +
    // 꼬리
    '<tr><td style="padding:20px 24px 26px;background:' + c.paper + ';font:12.5px/1.7 ' + c.font + ';color:' + c.muted + ';">' +
    '<b style="color:' + c.ink2 + ';">비북스 BeeBooks</b> · 느슨하고 단단하게 함께 자라가는 모임<br>' +
    m4Esc_(c.address) + ' · <a href="' + c.mapUrl + '" style="color:' + c.accentInk + ';">지도</a><br>' +
    '문의 인스타그램 <a href="https://instagram.com/' + m4Esc_(String(o.instagram || '@b_books2026').replace('@', '')) + '" style="color:' + c.accentInk + ';">' + m4Esc_(o.instagram || '@b_books2026') + '</a>' +
    ' · <a href="' + m4Esc_(o.siteUrl || 'https://moim.bbooks.co.kr/') + '" style="color:' + c.accentInk + ';">moim.bbooks.co.kr</a><br>' +
    '<span style="font-size:11.5px;">' + m4Esc_(o.footnote || '이 메일은 비모임 신청 안내를 위해 발송되었습니다.') + '</span>' +
    '</td></tr></table></td></tr></table></body></html>';
}

function m4H1_(text, sub) {
  return '<h1 style="margin:0 0 6px;font:700 24px/1.35 ' + M4.serif + ';color:' + M4.ink + ';">' + m4Esc_(text) + '</h1>' +
    (sub ? '<p style="margin:0 0 22px;font:15px/1.7 ' + M4.font + ';color:' + M4.ink2 + ';">' + sub + '</p>' : '');
}

/** 포스터 썸네일 + 모임 이름 + 일정 */
function m4Moim_(d) {
  var img = d.poster ? '<td width="96" valign="top" style="padding-right:16px;"><a href="' + m4Esc_(d.pageUrl || '#') + '">' +
    '<img src="' + m4Esc_(d.poster) + '" width="96" alt="" style="display:block;width:96px;height:auto;border-radius:6px;border:1px solid ' + M4.line + ';"></a></td>' : '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>' + img +
    '<td valign="top" style="font:14px/1.6 ' + M4.font + ';color:' + M4.ink2 + ';">' +
    '<div style="font:12px ' + M4.font + ';font-weight:700;color:' + M4.accentInk + ';letter-spacing:.04em;">' + m4Esc_(d.kindLabel || '비모임') + '</div>' +
    '<div style="font:700 19px/1.4 ' + M4.serif + ';color:' + M4.ink + ';margin:2px 0 6px;">' + m4Esc_(d.title) + '</div>' +
    (d.when ? '<div>' + m4Esc_(d.when) + '</div>' : '') +
    (d.place ? '<div>비북스 ' + m4Esc_(d.place) + '</div>' : '') +
    (d.pageUrl ? '<div style="margin-top:6px;"><a href="' + m4Esc_(d.pageUrl) + '" style="color:' + M4.accentInk + ';font-weight:700;text-decoration:none;">모임 페이지 보기 →</a></div>' : '') +
    '</td></tr></table>';
}

function m4Code_(code, hint) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:' + M4.paper + ';border-radius:12px;"><tr>' +
    '<td align="center" style="padding:16px 16px 14px;font:13px/1.6 ' + M4.font + ';color:' + M4.ink2 + ';">' +
    '<div style="font-weight:700;color:' + M4.accentInk + ';letter-spacing:.06em;">신청번호</div>' +
    '<div style="display:inline-block;margin:6px 0 8px;padding:8px 18px;background:#fff;border:1px dashed #d8cdbd;border-radius:10px;font:800 22px ' + M4.font + ';letter-spacing:.08em;color:' + M4.ink + ';">' + m4Esc_(code) + '</div>' +
    '<div>' + (hint || '이 번호와 휴대폰 번호로 <b>내 신청</b>에서 확인·취소할 수 있어요.') + '</div>' +
    '</td></tr></table>';
}

function m4Rows_(rows) {
  var html = rows.filter(function (r) { return r && r[1] !== '' && r[1] != null; }).map(function (r) {
    return '<tr><td width="88" valign="top" style="padding:9px 0;border-top:1px dotted #d8cdbd;font:13px ' + M4.font + ';color:' + M4.muted + ';">' + m4Esc_(r[0]) + '</td>' +
      '<td valign="top" style="padding:9px 0;border-top:1px dotted #d8cdbd;font:14.5px/1.55 ' + M4.font + ';color:' + M4.ink + ';">' + (r[2] ? r[1] : m4Esc_(r[1])) + '</td></tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-bottom:1px solid ' + M4.ink + ';border-top:3px double ' + M4.ink + ';">' + html + '</table>';
}

function m4Pay_(d) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:' + M4.accentSoft + ';border-radius:12px;"><tr><td style="padding:18px 18px 16px;font:14px/1.6 ' + M4.font + ';color:' + M4.ink2 + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font:13px ' + M4.font + ';color:' + M4.muted + ';">입금할 금액</td>' +
    '<td align="right" style="font:13px ' + M4.font + ';color:' + M4.accentInk + ';font-weight:700;">' + m4Esc_(d.deadline) + '까지</td></tr></table>' +
    '<div style="font:800 28px ' + M4.font + ';color:' + M4.ink + ';margin:2px 0 12px;letter-spacing:-.02em;">' + m4Esc_(d.amount) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;"><tr><td style="padding:12px 14px;font:14px/1.6 ' + M4.font + ';color:' + M4.ink + ';">' +
    '<b>' + m4Esc_(d.bank) + '</b><br><span style="color:' + M4.muted + ';font-size:13px;">입금자명은 <b style="color:' + M4.ink + ';">' + m4Esc_(d.name) + '</b>(신청자 이름)으로 해 주세요</span>' +
    '</td></tr></table></td></tr></table>';
}

function m4Steps_(steps) {
  var cells = steps.map(function (s, i) {
    var on = s.on;
    return '<td valign="top" width="' + Math.floor(100 / steps.length) + '%" style="padding:0 4px;text-align:center;font:12.5px/1.5 ' + M4.font + ';color:' + (on ? M4.ink : M4.muted) + ';">' +
      '<div style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:' + (on ? M4.ink : '#e9e2d6') + ';color:' + (on ? '#fff' : M4.muted) + ';font-weight:800;font-size:13px;">' + (i + 1) + '</div>' +
      '<div style="margin-top:6px;font-weight:' + (on ? 700 : 500) + ';">' + m4Esc_(s.t) + '</div></td>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>' + cells + '</tr></table>';
}

function m4Button_(href, label, secondary) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 10px;"><tr><td align="center" style="border-radius:10px;background:' + (secondary ? '#fff' : M4.accent) + ';border:1px solid ' + (secondary ? '#d8cdbd' : M4.accent) + ';">' +
    '<a href="' + m4Esc_(href) + '" style="display:inline-block;padding:13px 26px;font:700 15px ' + M4.font + ';color:' + (secondary ? M4.ink : '#fff') + ';text-decoration:none;">' + m4Esc_(label) + '</a></td></tr></table>';
}

function m4Small_(title, html) {
  return '<div style="margin:22px 0 0;padding:16px 0 0;border-top:1px solid ' + M4.line + ';font:13px/1.7 ' + M4.font + ';color:' + M4.ink2 + ';">' +
    '<div style="font-weight:700;color:' + M4.ink + ';margin-bottom:4px;">' + m4Esc_(title) + '</div>' + html + '</div>';
}

// ── 신청자에게 ────────────────────────────────────────

/** 모임 신청 접수 (입금 안내) */
function m4ApplyMail_(d) {
  var paid = Number(d.amountNum) > 0;
  var body = m4H1_('신청이 접수됐어요', m4Esc_(d.name) + '님, 비모임에 함께해 주셔서 고마워요.' + (paid ? '<br>아래 계좌로 입금해 주시면 자리가 확정돼요.' : '')) +
    m4Moim_(d) +
    m4Code_(d.code) +
    (paid ? m4Pay_(d) : '') +
    m4Steps_(paid ? [{ t: '신청 접수', on: true }, { t: '입금', on: false }, { t: '확정 메일', on: false }, { t: '비북스에서 만나요', on: false }]
      : [{ t: '신청 접수', on: true }, { t: '비북스에서 만나요', on: false }]) +
    m4Button_(d.myUrl, '내 신청 확인하기') +
    (d.memo ? m4Small_('남겨 주신 메모', m4Esc_(d.memo)) : '') +
    m4Small_('오시는 길', m4Esc_(M4.address) + '<br><a href="' + M4.mapUrl + '" style="color:' + M4.accentInk + ';">네이버 지도에서 보기</a>') +
    (d.refund ? m4Small_('환불 규정', m4Esc_(d.refund) + '<br>취소는 내 신청에서 요청하거나 인스타그램 DM으로 알려 주세요.') : '');
  return { subject: '[비북스 b.moim] ' + d.title + ' 신청이 접수됐어요 (' + d.code + ')',
    html: m4Layout_({ title: '신청 접수', badge: '신청 접수', preheader: (paid ? d.amount + ' 입금 안내 · ' : '') + '신청번호 ' + d.code, body: body, instagram: d.instagram, siteUrl: d.siteUrl }) };
}

/** 입금 확인 → 참가 확정 */
function m4PaidMail_(d) {
  var body = m4H1_('참가가 확정됐어요', m4Esc_(d.name) + '님, 입금이 확인되었어요.<br>모임 날 비북스에서 반갑게 만나요.') +
    m4Moim_(d) +
    m4Rows_([['신청번호', d.code], ['일시', d.when], ['장소', '비북스 ' + (d.place || '') + ' · ' + M4.address]]) +
    m4Steps_([{ t: '신청 접수', on: true }, { t: '입금', on: true }, { t: '확정', on: true }, { t: '비북스에서 만나요', on: false }]) +
    m4Button_(d.myUrl, '내 신청 확인하기') +
    m4Small_('오시는 길', m4Esc_(M4.address) + '<br><a href="' + M4.mapUrl + '" style="color:' + M4.accentInk + ';">네이버 지도에서 보기</a>');
  return { subject: '[비북스 b.moim] ' + d.title + ' 참가가 확정됐어요',
    html: m4Layout_({ title: '참가 확정', badge: '참가 확정', badgeColor: M4.ok, preheader: d.when + ' · 비북스에서 만나요', body: body, instagram: d.instagram, siteUrl: d.siteUrl }) };
}

/** 대관 신청 접수 */
function m4RentMail_(d) {
  var body = m4H1_('대관 신청이 접수됐어요', m4Esc_(d.name) + '님, 비북스 공간을 찾아 주셔서 고마워요.<br>담당자가 일정을 확인한 뒤 금액과 입금 방법을 안내드려요.') +
    m4Code_(d.code, '이 번호와 휴대폰 번호로 <b>내 신청</b>에서 대관 신청 상태를 확인할 수 있어요.') +
    m4Rows_([['공간', d.space], ['날짜', d.date], ['시간', d.time], ['인원', d.count ? d.count + '명' : ''], ['사용 목적', d.purpose]]) +
    m4Steps_([{ t: '신청 접수', on: true }, { t: '담당자 확인', on: false }, { t: '입금', on: false }, { t: '이용', on: false }]) +
    m4Button_(d.myUrl, '내 신청 확인하기') +
    m4Small_('오시는 길', m4Esc_(M4.address) + '<br><a href="' + M4.mapUrl + '" style="color:' + M4.accentInk + ';">네이버 지도에서 보기</a>');
  return { subject: '[비북스] 대관 신청이 접수됐어요 (' + d.date + ' ' + d.time + ')',
    html: m4Layout_({ title: '대관 신청 접수', badge: '대관 접수', preheader: d.space + ' · ' + d.date + ' ' + d.time, body: body, instagram: d.instagram, siteUrl: d.siteUrl }) };
}

/** 신청번호 다시 받기 */
function m4ResendMail_(d) {
  var rows = d.list.map(function (x) { return [x.code, x.title, false]; });
  var body = m4H1_('신청번호를 보내드려요', m4Esc_(d.name) + '님이 요청하신 신청번호예요.') + m4Rows_(rows) + m4Button_(d.myUrl, '내 신청 확인하기');
  return { subject: '[비북스 b.moim] 신청번호 안내', html: m4Layout_({ title: '신청번호 안내', badge: '신청번호', preheader: '요청하신 신청번호입니다', body: body, instagram: d.instagram, siteUrl: d.siteUrl }) };
}

// ── 운영자(매니저)에게 ─────────────────────────────────

/** 운영자 알림: 한눈에 보는 표 + 시트 바로가기 + 처리 방법 */
function m4OperatorMail_(d) {
  var body = '<div style="font:12px ' + M4.font + ';font-weight:700;color:' + M4.accentInk + ';letter-spacing:.06em;">' + m4Esc_(d.kind) + '</div>' +
    m4H1_(d.headline, d.sub ? m4Esc_(d.sub) : '') +
    m4Rows_(d.rows) +
    m4Button_(d.sheetUrl, '구글 시트에서 보기') +
    (d.todo ? m4Small_('처리 방법', d.todo) : '');
  return { subject: '[비모임 ' + d.kind + '] ' + d.headline, html: m4Layout_({ title: d.kind, badge: d.kind, preheader: d.headline, body: body, footnote: '비모임 운영자 알림 메일입니다.' }) };
}
