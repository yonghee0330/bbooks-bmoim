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
 *
 * 모임신청 시트: A 신청일시 | B 월 | C 모임명 | D 회차 | E 이름 | F 연락처 | G 금액 | H 비고 | I 도서주문
 */

var SPREADSHEET_ID = '186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM';
var SHEET_APPLY = '모임신청';
var SHEET_RENT = '대관신청';
var SHEET_EVENT = '행사';
var SHEET_MOONLIGHT = '달빛리딩클럽';
var SHEET_CODES = '점주코드';
var ALADIN_TTB_KEY = 'ttbpctspark1248002';
var EVENT_HEADERS = ['신청일시', '월', '유형', '행사명', '회차', '이름', '연락처', '금액', '접수일', '비고', '도서주문'];
var APPLY_HEADERS = ['신청일시', '월', '모임명', '회차', '이름', '연락처', '금액', '비고', '도서주문'];
var MOONLIGHT_HEADERS = [
  '신청일시', '월', '참여회차', '이름', '연락처',
  '합계금액', '참가비', '도서비', '도서쿠폰', '도서주문', '비고'
];

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
    if (action === 'aladinSearch') {
      return jsonOutput(searchAladin_(e.parameter.q, e.parameter.start, e.parameter.max));
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

    if (action === 'apply') {
      return jsonOutput(appendApply_(data));
    }
    if (action === 'rent') {
      return jsonOutput(appendRent_(data));
    }
    if (action === 'eventApply') {
      return jsonOutput(appendEventApply_(data));
    }
    if (action === 'moonlightApply') {
      return jsonOutput(appendMoonlightApply_(data));
    }
    return jsonOutput({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function appendApply_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ensureApplySheet_(ss);
  var nextRow = sheet.getLastRow() + 1;

  var values = [[
    new Date(),
    String(data.month || '').trim(),
    String(data.moimName || ''),
    String(data.session || ''),
    String(data.name || ''),
    String(data.phone || ''),
    data.amount != null && data.amount !== '' ? data.amount : '',
    String(data.note || '').trim(),
    String(data.books || '').trim()
  ]];

  sheet.getRange(nextRow, 1, nextRow, APPLY_HEADERS.length).setValues(values);
  return { ok: true, row: nextRow };
}

function ensureApplySheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_APPLY);
  if (!sheet) throw new Error('모임신청 시트 없음');
  if (sheet.getLastRow() === 0 || !String(sheet.getRange(1, 1).getValue() || '').trim()) {
    sheet.getRange(1, 1, 1, APPLY_HEADERS.length).setValues([APPLY_HEADERS]);
    return sheet;
  }
  if (String(sheet.getRange(1, 8).getValue() || '').trim() !== '비고') {
    sheet.getRange(1, 8).setValue('비고');
  }
  if (String(sheet.getRange(1, 9).getValue() || '').trim() !== '도서주문') {
    sheet.getRange(1, 9).setValue('도서주문');
  }
  return sheet;
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

function ensureMoonlightSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_MOONLIGHT);
  if (!sheet) sheet = ss.getSheetByName('달빛독서클럽');
  if (!sheet) sheet = ss.insertSheet(SHEET_MOONLIGHT);
  if (sheet.getLastRow() === 0 || !String(sheet.getRange(1, 1).getValue() || '').trim()) {
    sheet.getRange(1, 1, 1, MOONLIGHT_HEADERS.length).setValues([MOONLIGHT_HEADERS]);
    sheet.getRange(1, 1, 1, MOONLIGHT_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#12163a')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    for (var i = 0; i < MOONLIGHT_HEADERS.length; i++) {
      var cell = sheet.getRange(1, i + 1);
      if (!String(cell.getValue() || '').trim()) cell.setValue(MOONLIGHT_HEADERS[i]);
    }
  }
  return sheet;
}

function moonlightRoundLabel_(data) {
  var books = String(data.books || '').trim();
  if (data.plan === 'season') {
    return data.bammilon ? '시즌권(1개월)+밤밀온할인' : '시즌권(1개월)';
  }
  if (Object.prototype.toString.call(data.days) === '[object Array]' && data.days.length) {
    return data.days.join(', ');
  }
  if (Number(data.freeCount) > 0 || Number(data.deepCount) > 0) {
    var parts = [];
    if (Number(data.freeCount) > 0) parts.push('참가 ' + data.freeCount + '회');
    if (Number(data.deepCount) > 0) parts.push('달리클럽×' + data.deepCount);
    return parts.join(', ');
  }
  if (data.booksOnly || books) return '도서주문만';
  return '추후결정';
}

function appendMoonlightApply_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ensureMoonlightSheet_(ss);
  var round = moonlightRoundLabel_(data);
  sheet.appendRow([
    new Date(),
    String(data.month || '').trim(),
    round,
    String(data.name || ''),
    String(data.phone || ''),
    data.fee != null && data.fee !== '' ? data.fee : '',
    data.moimFee != null && data.moimFee !== '' ? data.moimFee : '',
    data.bookFee != null && data.bookFee !== '' ? data.bookFee : '',
    data.coupon != null && data.coupon !== '' ? data.coupon : '',
    String(data.books || '').trim(),
    String(data.note || '').trim()
  ]);
  return { ok: true, name: data.name || '', round: round };
}

/** 편집기에서 1회 실행 → 달빛리딩클럽 탭 헤더 준비 */
function setupMoonlightSheet() {
  var sheet = ensureMoonlightSheet_(SpreadsheetApp.openById(SPREADSHEET_ID));
  return 'OK: ' + sheet.getName();
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

/**
 * 9월 개설 모임 점주코드를 「점주코드」시트에 일괄 등록합니다.
 * Apps Script 에디터에서 setupSeptemberHostCodes() 한 번 실행하세요.
 * 전용 링크: https://moim.bbooks.co.kr/host/
 */
function setupSeptemberHostCodes() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CODES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CODES);
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }

  var rows = [
    ['TOJI2026', '비북스', '《토지》 완독 챌린지', '9월'],
    ['STORY2026', '@sammycomma', '그림책 읽어주는 이모', '9월'],
    ['DONGSEO2026', '너라면 · 동서남북book', '클래식 음악 감상 모임', '9월'],
    ['MOVIE2026', '앗트', '영화 한편, 이야기 한잔', '9월'],
    ['SUDDENLY2026', '써든리', '써든리와 함께하는 일본어 명대사 필사 모임', '9월'],
    ['DAONHWA2026', '다온 글방', '[화요다회] · 세계의 차를 만나다', '9월'],
    ['DAONBOOK2026', '다온 글방', '월간 목요 북클럽: Little Friday Salon [9월 웰컴 데이]', '9월'],
    ['SUNNY2026', 'B-19 선이와 병수', '써니와 함께 고전 읽고 글쓰기', '9월'],
    ['LETTER2026', '모퉁이 우표점', '한 사람을 위한 편지', '9월']
  ];

  var existing = sheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < existing.length; i++) {
    var k = String(existing[i][0] || '').trim().toUpperCase() + '|' + String(existing[i][3] || '').trim();
    existingKeys[k] = true;
  }

  var added = [];
  var skipped = [];
  rows.forEach(function(row) {
    var key = String(row[0]).toUpperCase() + '|' + row[3];
    if (existingKeys[key]) {
      skipped.push(row[0]);
      return;
    }
    sheet.appendRow(row);
    added.push(row[0]);
  });

  return '추가 ' + added.length + '건' + (added.length ? ': ' + added.join(', ') : '')
    + (skipped.length ? ' / 이미 있음: ' + skipped.join(', ') : '');
}

/**
 * 10월 개설 모임 점주코드를 「점주코드」시트에 일괄 등록합니다.
 * 다온 글방은 DAON2026 코드 하나로 두 모임을 함께 조회합니다.
 */
function setupOctoberHostCodes() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CODES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CODES);
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }

  var rows = [
    ['DONGSEO2026', '너라면 · 동서남북book', '클래식 음악 감상 모임', '10월'],
    ['DAON2026', '다온 글방', '목요 독서모임', '10월'],
    ['DAON2026', '다온 글방', '중국차 블렌딩 다회', '10월'],
    ['STORY2026', '@sammycomma', '그림책 읽어주는 이모', '10월']
  ];

  var existing = sheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < existing.length; i++) {
    var k = String(existing[i][0] || '').trim().toUpperCase() + '|'
      + String(existing[i][3] || '').trim() + '|'
      + String(existing[i][2] || '').trim();
    existingKeys[k] = true;
  }

  var added = [];
  var skipped = [];
  rows.forEach(function(row) {
    var key = String(row[0]).toUpperCase() + '|' + row[3] + '|' + row[2];
    if (existingKeys[key]) {
      skipped.push(row[0] + '/' + row[2]);
      return;
    }
    sheet.appendRow(row);
    added.push(row[0] + '·' + row[2]);
  });

  return '추가 ' + added.length + '건' + (added.length ? ': ' + added.join(', ') : '')
    + (skipped.length ? ' / 이미 있음: ' + skipped.join(', ') : '');
}

/** @deprecated setupSeptemberHostCodes 사용 */
function setupTojiHostCode() {
  return setupSeptemberHostCodes();
}

function cleanAladinTitle_(title) {
  return String(title || '').replace(/\s*-\s*$/, '').trim();
}

function searchAladin_(query, start, max) {
  query = String(query || '').trim();
  if (!query) {
    return { ok: true, items: [], total: 0 };
  }

  start = parseInt(start, 10) || 1;
  max = Math.min(parseInt(max, 10) || 8, 20);

  var url = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx'
    + '?ttbkey=' + encodeURIComponent(ALADIN_TTB_KEY)
    + '&Query=' + encodeURIComponent(query)
    + '&QueryType=Keyword'
    + '&MaxResults=' + max
    + '&start=' + start
    + '&SearchTarget=Book'
    + '&output=js'
    + '&Version=20131101'
    + '&Cover=Big';

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var text = res.getContentText();
  if (res.getResponseCode() !== 200) {
    return { ok: false, error: '알라딘 검색 요청 실패 (' + res.getResponseCode() + ')' };
  }

  var data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: '알라딘 응답을 읽을 수 없습니다.' };
  }

  var rawItems = data.item || [];
  if (!Array.isArray(rawItems)) rawItems = [rawItems];

  var items = rawItems.map(function(it) {
    var itemId = String(it.itemId || '').trim();
    var priceStandard = Number(it.priceStandard) || 0;
    var priceSales = Number(it.priceSales) || 0;
    return {
      id: 'aladin_' + itemId,
      itemId: itemId,
      title: cleanAladinTitle_(it.title),
      author: String(it.author || '').trim(),
      price: priceStandard || priceSales || 0,
      priceSales: priceSales,
      url: String(it.link || ('https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=' + itemId)).replace(/&amp;/g, '&'),
      cover: String(it.cover || '').trim()
    };
  }).filter(function(it) {
    return it.itemId && it.title && it.price > 0;
  });

  return {
    ok: true,
    items: items,
    total: Number(data.totalResults) || items.length,
    query: query
  };
}
