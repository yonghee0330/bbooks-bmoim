const API = 'https://script.google.com/macros/s/AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ/exec';

const q = sel => document.querySelector(sel);

function getMoimConfig() {
  const slug = window.HOST_MOIM_SLUG;
  const map = window.HOST_MOIMS || {};
  if (!slug || !map[slug]) return null;
  return map[slug];
}

function showAlert(msg, type) {
  q('#alertBox').innerHTML = msg
    ? `<div class="alert ${type || 'error'}">${msg}</div>`
    : '';
}

function formatPhoneDisplay(phone) {
  const s = String(phone || '').trim();
  if (!s) return '—';
  if (s.includes('-')) return s;
  const d = s.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return s;
}

function phoneHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:${d}` : null;
}

function statusBadge(applicant) {
  if (applicant.cancelled) return '<span class="badge cancel">취소</span>';
  return '';
}

function displayNote(note) {
  const s = String(note || '').trim();
  if (!s) return '';
  // 개설자 화면에서는 입금확인 메모는 숨김
  if (/입금\s*확인/.test(s) && !/취소/.test(s)) return '';
  return s;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderApplicants(applicants) {
  if (!applicants.length) {
    return '<div class="empty">아직 신청자가 없습니다.</div>';
  }
  return applicants.map(a => {
    const href = phoneHref(a.phone);
    const phoneHtml = href
      ? `<a class="applicant-phone" href="${href}">${formatPhoneDisplay(a.phone)}</a>`
      : `<span class="applicant-phone">${formatPhoneDisplay(a.phone)}</span>`;
    const noteText = displayNote(a.note);
    const note = noteText ? `<div class="applicant-meta">비고: ${escapeHtml(noteText)}</div>` : '';
    const applied = a.appliedAt ? `<div class="applicant-meta">신청: ${escapeHtml(a.appliedAt)}</div>` : '';
    const books = a.books ? `<div class="applicant-meta">도서: ${escapeHtml(a.books)}</div>` : '';
    return `<div class="applicant${a.cancelled ? ' cancelled' : ''}">
      <div class="applicant-name">${escapeHtml(a.name || '—')}</div>
      ${statusBadge(a)}
      ${phoneHtml}
      <div class="applicant-meta">${Number(a.amount || 0).toLocaleString()}원</div>
      ${applied}${note}${books}
    </div>`;
  }).join('');
}

function renderResult(data) {
  q('#hostTitle').textContent = data.hostName || '개설자';
  q('#hostSub').textContent = `${data.month} · ${(data.moimNames || []).join(', ')}`;

  const stats = data.stats || {};
  q('#statTotal').textContent = stats.total ?? 0;
  q('#statActive').textContent = stats.active ?? 0;
  q('#statCancelled').textContent = stats.cancelled ?? 0;

  const groups = data.groups || [];
  if (!groups.length) {
    q('#moimList').innerHTML = '<div class="empty">표시할 신청 내역이 없습니다.</div>';
    return;
  }

  q('#moimList').innerHTML = groups.map(g => {
    const sessions = (g.sessions || []).map(s => `
      <div class="session-block">
        <div class="session-head">${escapeHtml(s.session || '회차 미지정')} · ${s.count}명</div>
        ${renderApplicants(s.applicants || [])}
      </div>
    `).join('');
    return `
      <div class="moim-block">
        <div class="moim-block-head">
          <div class="moim-block-name">${escapeHtml(g.moimName)}</div>
          <div class="moim-block-meta">유효 ${g.activeCount}명 / 전체 ${g.totalCount}명</div>
        </div>
        ${sessions}
      </div>`;
  }).join('');
}

function fillSetupBox(cfg) {
  const box = q('#setupBox');
  if (!box || !cfg) return;
  box.innerHTML = `<strong>처음 한 번만 설정이 필요합니다.</strong><br>
    구글 시트 「점주코드」 탭에 아래 행을 추가한 뒤 이 페이지를 새로고침하세요.<br><br>
    <code>${escapeHtml(cfg.code)}</code> · <code>${escapeHtml(cfg.hostName)}</code> · <code>${escapeHtml(cfg.moimName)}</code> · <code>${escapeHtml(cfg.month)}</code><br>
    ※ 모임명은 「모임신청」시트의 모임명과 글자 하나까지 같아야 합니다.<br>
    ※ Apps Script에서 <code>setupSeptemberHostCodes()</code>를 한 번 실행하면 9월 전체가 등록됩니다.`;
}

async function loadStatus() {
  const cfg = getMoimConfig();
  if (!cfg) {
    showAlert('모임 설정을 찾을 수 없습니다.', 'error');
    q('#statusLine').textContent = '설정 오류';
    return;
  }

  showAlert('');
  q('#setupBox').classList.remove('on');
  q('#statusLine').textContent = '불러오는 중…';
  const btn = q('#refreshBtn');
  if (btn) btn.disabled = true;

  try {
    const url = `${API}?action=hostStatus&code=${encodeURIComponent(cfg.code)}&month=${encodeURIComponent(cfg.month)}`;
    const res = await fetch(url, { redirect: 'follow' });
    const data = await res.json();

    if (data.error) {
      q('#result').classList.remove('on');
      const needsSetup = /코드가 올바르지 않|점주코드 시트|등록된 모임/.test(data.error);
      if (needsSetup) {
        fillSetupBox(cfg);
        q('#setupBox').classList.add('on');
      }
      showAlert(escapeHtml(data.error), 'error');
      q('#statusLine').textContent = '조회 실패';
      return;
    }

    renderResult(data);
    q('#result').classList.add('on');
    const active = data.stats?.active ?? 0;
    q('#statusLine').textContent = `유효 신청 ${active}명 · 방금 갱신됨`;
  } catch (e) {
    q('#result').classList.remove('on');
    showAlert('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    q('#statusLine').textContent = '조회 오류';
    console.warn(e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function initHostPage() {
  const cfg = getMoimConfig();
  if (!cfg) return;
  document.title = `${cfg.title} 신청 현황 · b.moim`;
  const h1 = q('.hero h1');
  if (h1) h1.textContent = cfg.title;
  const back = q('#backLink');
  if (back) {
    const page = cfg.month === '10월' ? 'october' : 'september';
    back.href = `../${page}.html#${cfg.anchor || ''}`;
  }
  fillSetupBox(cfg);
  loadStatus();
}

window.loadStatus = loadStatus;
window.addEventListener('DOMContentLoaded', initHostPage);
