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
 *    | TOJI2026    | 비북스    | 《토지》 완독 챌린지               | 9월  |
 *
 * 전용 링크: https://moim.bbooks.co.kr/host/toji.html
 * 에디터에서 setupTojiHostCode() 한 번 실행하면 점주코드 행을 자동 추가합니다.
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
 * 《토지》 완독 챌린지 점주코드 행을 「점주코드」시트에 추가합니다.
 * Apps Script 에디터에서 이 함수만 한 번 실행하면 됩니다.
 */
function setupTojiHostCode() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CODES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CODES);
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['코드', '점주명', '모임명', '월']);
  }

  var code = 'TOJI2026';
  var hostName = '비북스';
  var moimName = '《토지》 완독 챌린지';
  var month = '9월';
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowCode = String(rows[i][0] || '').trim().toUpperCase();
    var rowMonth = String(rows[i][3] || '').trim();
    if (rowCode === code && rowMonth === month) {
      return '이미 등록됨: ' + code + ' / ' + month;
    }
  }
  sheet.appendRow([code, hostName, moimName, month]);
  return '추가됨: ' + code + ' · ' + hostName + ' · ' + moimName + ' · ' + month;
}
