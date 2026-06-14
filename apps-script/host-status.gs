/**
 * b.moim 점주 신청 현황 — Apps Script 추가 코드
 *
 * 기존 june.html API 프로젝트(스프레드시트 연동 Web App)에 아래 내용을 추가하세요.
 * 1. 스프레드시트에 「점주코드」 시트 생성
 * 2. doGet 에 hostStatus 분기 추가
 * 3. 배포 > 새 배포 (또는 기존 Web App 버전 업데이트)
 *
 * 스프레드시트:
 * https://docs.google.com/spreadsheets/d/186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM/edit
 */

var HOST_STATUS_SHEET_ID = '186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM';
var HOST_CODE_SHEET_NAME = '점주코드';
var HOST_APPLY_SHEET_NAME = '모임신청';

/**
 * doGet 예시 — 기존 분기 아래에 추가
 *
 * if (action === 'hostStatus') {
 *   return jsonOutput(getHostStatus_(e.parameter.code, e.parameter.month));
 * }
 */

function getHostStatus_(code, month) {
  code = String(code || '').trim();
  month = String(month || '6월').trim();

  if (!code) {
    return { error: '코드를 입력해주세요.' };
  }

  var ss = SpreadsheetApp.openById(HOST_STATUS_SHEET_ID);
  var codeSheet = ss.getSheetByName(HOST_CODE_SHEET_NAME);
  if (!codeSheet) {
    return { error: '점주코드 시트가 없습니다. 비북스 매니저에게 문의해주세요.' };
  }

  var codeRows = codeSheet.getDataRange().getValues();
  var hostName = '';
  var moimNames = {};

  for (var i = 1; i < codeRows.length; i++) {
    var rowCode = String(codeRows[i][0] || '').trim();
    if (rowCode !== code) continue;

    hostName = hostName || String(codeRows[i][1] || '').trim();
    var moimName = String(codeRows[i][2] || '').trim();
    var rowMonth = String(codeRows[i][3] || '').trim();

    if (rowMonth && rowMonth !== month) continue;
    if (moimName) moimNames[moimName] = true;
  }

  var moimNameList = Object.keys(moimNames);
  if (!moimNameList.length) {
    return { error: '코드를 확인해주세요.' };
  }

  var applySheet = ss.getSheetByName(HOST_APPLY_SHEET_NAME);
  if (!applySheet) {
    return { error: '모임신청 시트를 찾을 수 없습니다.' };
  }

  var applyRows = applySheet.getDataRange().getValues();
  var grouped = {};
  var totalAll = 0;
  var totalActive = 0;
  var totalCancelled = 0;

  moimNameList.forEach(function(name) {
    grouped[name] = {};
  });

  for (var j = 1; j < applyRows.length; j++) {
    var row = applyRows[j];
    var rowMonth = String(row[1] || '').trim();
    var rowMoim = String(row[2] || '').trim();
    var session = String(row[3] || '').trim();

    if (rowMonth !== month) continue;
    if (!grouped[rowMoim]) continue;
    if (!session) continue;

    if (!grouped[rowMoim][session]) grouped[rowMoim][session] = [];

    var note = String(row[7] || '').trim();
    var cancelled = /취소/.test(note);
    var app = {
      appliedAt: String(row[0] || ''),
      name: String(row[4] || ''),
      phone: String(row[5] || ''),
      amount: Number(row[6] || 0),
      note: note,
      cancelled: cancelled
    };

    grouped[rowMoim][session].push(app);
    totalAll++;
    if (cancelled) totalCancelled++;
    else totalActive++;
  }

  var moims = moimNameList.map(function(name) {
    var sessions = Object.keys(grouped[name]).sort().map(function(sessionKey) {
      var apps = grouped[name][sessionKey];
      var activeCount = apps.filter(function(a) { return !a.cancelled; }).length;
      return {
        label: sessionKey,
        activeCount: activeCount,
        applications: apps
      };
    });

    var activeCount = sessions.reduce(function(sum, s) { return sum + s.activeCount; }, 0);
    return {
      name: name,
      activeCount: activeCount,
      sessions: sessions
    };
  });

  moims.sort(function(a, b) {
    return a.name.localeCompare(b.name, 'ko');
  });

  return {
    hostName: hostName,
    month: month,
    moims: moims,
    totalAll: totalAll,
    totalActive: totalActive,
    totalCancelled: totalCancelled
  };
}

/**
 * 점주코드 시트 예시 (1행 헤더)
 *
 * | A 코드     | B 점주명              | C 모임명                         | D 월 |
 * |------------|----------------------|----------------------------------|-----|
 * | NORA2026   | 너라면               | 슬기로운 영화 속 클래식          | 6월 |
 * | DAON2026   | 다온글방             | 책 숲에서 즐기는 애프터눈 티     | 6월 |
 * | LOVEY2026  | 영국정원 Lovey       | Creative Writing Club            | 6월 |
 * | LOVEY2026  | 영국정원 Lovey       | 영어 북클럽                      | 6월 |
 * | STAMP2026  | 모퉁이 우표점        | 한 사람을 위한 편지              | 6월 |
 *
 * - 같은 코드에 모임을 여러 줄로 추가하면 한 점주가 여러 모임 현황을 볼 수 있습니다.
 * - C열 모임명은 「모임신청」 시트 C열과 정확히 일치해야 합니다.
 */
