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
    ' · <a href="' + m4Esc_(o.siteUrl || 'https://bbooks.co.kr/moim/') + '" style="color:' + c.accentInk + ';">bbooks.co.kr/moim</a><br>' +
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
