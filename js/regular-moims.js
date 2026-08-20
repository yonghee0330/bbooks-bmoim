/**
 * 매월 고정 등록 모임
 * - 한 사람을 위한 편지 (모퉁이 우표점): 매월 마지막 주 수요일 11:00–13:00 · 세미나실
 *
 * 새 월 페이지를 만들 때 letterSessionForMonth(year, monthIndex)로 회차·일정을 채우면 됩니다.
 */
(function (global) {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ymd(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /** @param {number} year @param {number} monthIndex 0–11 @param {number} weekday 0=일 … 3=수 */
  function lastWeekdayOfMonth(year, monthIndex, weekday) {
    const d = new Date(year, monthIndex + 1, 0);
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return d;
  }

  const LETTER = {
    key: 'letter',
    name: '한 사람을 위한 편지',
    host: '모퉁이 우표점 · 호스트 온수',
    poster: 'images/letter_motungi.jpg',
    regularLabel: '매월 마지막 주 수요일 정기모임 · 정원 1명',
    descHtml:
      '안녕하세요. 모퉁이 우표점입니다. 한 사람을 위한 편지 모임을 엽니다.<br>' +
      '타자기로 편지를 쓰고, 보내는 마음처럼 우표를 붙입니다.',
    space: '세미나실',
    start: '11:00',
    end: '13:00',
    capacity: 1,
    amount: 30000,
    weekday: 3
  };

  function letterSessionForMonth(year, monthIndex) {
    const d = lastWeekdayOfMonth(year, monthIndex, LETTER.weekday);
    const month = monthIndex + 1;
    const day = d.getDate();
    const [eh, em] = LETTER.end.split(':').map(Number);
    return {
      date: ymd(d),
      label: `${month}/${day}(수) ${LETTER.start}–${LETTER.end}`,
      value: `${month}월${day}일_편지`,
      endMs: new Date(year, monthIndex, day, eh, em, 0).getTime(),
      displayDate: `${month}월 ${day}일 (수) ${LETTER.start} – ${LETTER.end}`
    };
  }

  /** start/end month are 1-based inclusive */
  function letterBlocksFromTo(startYear, startMonth, endYear, endMonth) {
    const blocks = [];
    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const s = letterSessionForMonth(y, m - 1);
      blocks.push({
        date: s.date,
        space: LETTER.space,
        start: LETTER.start,
        end: LETTER.end,
        tag: LETTER.name,
        kind: 'moim'
      });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return blocks;
  }

  global.REGULAR_LETTER = LETTER;
  global.letterSessionForMonth = letterSessionForMonth;
  global.letterBlocksFromTo = letterBlocksFromTo;
})(typeof window !== 'undefined' ? window : globalThis);
