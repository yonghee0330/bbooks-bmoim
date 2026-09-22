/**
 * b.moim 점주 신청 현황 API
 *
 * ── 스프레드시트 설정 ──
 * 1. 시트 「점주코드」 추가 (첫 행 = 헤더)
 *    | A 코드      | B 점주명   | C 모임명                         | D 월  |
 *    |-------------|-----------|----------------------------------|------|
 *    | DRAW2026    | 슥슥      | 드로잉 슥슥                       | 6월  |
 *    | TUES2026    | 화요      | 화요일오후두시                    | 6월  |
 *    | VOICE2026   | 느린호수  | 어쩌다보니, 독립출판              | 6월  |
 *    | TOJI2026     | 비북스     | 《토지》 완독 챌린지               | 9월  |
 *    | STORY2026    | @sammycomma| 그림책 읽어주는 이모               | 9월  |
 *    | … (setupSeptemberHostCodes 참고)
 *
 * 전용 링크 목록: https://moim.bbooks.co.kr/host/
 * 에디터에서 setupSeptemberHostCodes() 한 번 실행하면 9월 점주코드가 일괄 등록됩니다.
 *
 *    ※ C열 모임명은 「모임신청」시트 C열과 글자 하나까지 동일해야 합니다.
 *    ※ 한 점주가 여러 모임이면 같은 코드로 행을 여러 줄 추가하세요.
 *
 * 2. 아래 함수를 기존 Web App 프로젝트에 붙여넣기
 * 3. doGet 맨 위에 action 파라미터 읽기 + hostStatus 분기 추가 (아래 예시 참고)
 * 4. 배포 → 새 버전 → Web App 재배포
 *
 * ── doGet 예시 (action undefined 버그 수정 포함) ──
 *
 * function doGet(e) {
 *   const action = (e && e.parameter && e.parameter.action) || '';
 *   if (action === 'hostStatus') {
 *     return jsonOutput(getHostStatus_(e.parameter.code, e.parameter.month));
 *   }
 *   if (action === 'count') {
 *     return jsonOutput(getCounts_(e.parameter.month));
 *   }
 *   return jsonOutput({ error: 'unknown action' });
 * }
 *
 * function jsonOutput(obj) {
 *   return ContentService
 *     .createTextOutput(JSON.stringify(obj))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 */

var SPREADSHEET_ID = '186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM';
var SHEET_APPLY = '모임신청';
var SHEET_CODES = '점주코드';

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
    var rMoim = String(r[2] || '').trim();
    var rName = String(r[4] || '').trim();
    if (!rMoim || !rName) continue;
    if (rMonth !== month) continue;
    if (moimNames.indexOf(rMoim) === -1) continue;

    var note = String(r[7] || '').trim();
    applicants.push({
      appliedAt: formatAppliedAt_(r[0]),
      moimName: rMoim,
      session: formatSession_(r[3]),
      name: rName,
      phone: formatPhone_(r[5]),
      amount: r[6] || 0,
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
    ['DAON2026', '다온 글방', '중국차 블렌딩 다회', '10월']
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
