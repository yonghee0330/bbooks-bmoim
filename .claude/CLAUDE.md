# 비모임 (moim.bbooks.co.kr) — Claude 작업 지침

비북스(부천 원미동, 104개 0.1평 서가 서점)의 모임·대관 사이트. 사용자는 비북스 운영자(사장님), 한국어로 대화한다.
상세 구조·이력은 `_bmoim-v2-src/HANDOFF.md`. 이 파일은 Claude가 바로 작업할 수 있게 핵심만 모은 것이다.

## 1. 한눈에

| 무엇 | 어디 |
|---|---|
| 사이트 저장소 (GitHub Pages, main 푸시 = 배포) | `~/Documents/bbooks-bmoim` |
| 원본 (사이트에 공개 안 됨) | `_bmoim-v2-src/` — `data/moims.json · spaces.json · site.json`, `assets/app.js · rent.js · app.css · cards.js`, `build.py` |
| 생성물 (직접 수정 금지) | 루트 `index.html`, `m/ space/ open/ my/ cards/ assets/ data/ exports/ v2/`, `bmoim.ics`, 옛 월별 `*.html` 리다이렉트 |
| Apps Script 운영 코드 사본 | `apps-script/live/Code.js` (현재 배포 **버전 14**) |
| Apps Script 배포 도구 | `/Users/mac/Desktop/INBOX-B/bmoim-v2/apps-script/clasp/deploy.sh` |
| 구글 시트 | `186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM` (탭: 모임신청 · 대관신청 · 점주코드 · 개설신청) |
| 로컬 미리보기 | launch.json `bmoim-root` (port 8799) — 아래 4번 |

주요 주소: `/` 이번 달 모임·달력, `/m/<slug>/` 모임, `/space/` 대관, `/open/` 모임 열기, `/open/status/#k=<링크키>` 호스트 현황, `/my/` 내 신청, `/cards/` 홍보 카드.

## 2. 수정 → 배포 (사이트)

1. `_bmoim-v2-src/` 의 JSON·JS·CSS·build.py 를 고친다.
2. `python3 _bmoim-v2-src/build.py --sheet` (반드시 `--sheet`. 루트에 생성됨). 빌드 경고(일정 겹침·포스터 규격)는 사용자에게 알린다.
3. JS를 고쳤으면 `node --check _bmoim-v2-src/assets/app.js` 등으로 문법 확인.
4. 커밋·푸시. 스테이징은 관련 경로만:
   `git add _bmoim-v2-src apps-script/live/Code.js assets bmoim.ics cards data index.html m my open space`
   - 넣지 말 것: `.DS_Store`, `node_modules/`, `apps-script/Code.gs`(옛 문자 API 키), `scripts/*` 등 사용자가 따로 만든 미추적 파일.
   - 커밋 메시지는 한국어 한 줄 요약 + 빈 줄 + `Co-Authored-By` 줄.
   - **push 출력에 GitHub 토큰(ghp_…)이 보일 수 있으니** `git push 2>&1 | sed -E 's/ghp_[A-Za-z0-9]+/ghp_***/g'` 로 가린다.
5. 반영 확인: `until curl -s "https://moim.bbooks.co.kr/<경로>?t=$RANDOM" | grep -q '<바뀐 문구>'; do sleep 10; done`
   (`sleep` 을 길게 이어 붙이면 막힘 — until 루프로 기다린다.)

저장소의 Cursor 규칙(`.cursor/rules/auto-deploy.mdc`)대로, 사용자가 요청한 사이트 수정은 끝나면 커밋·푸시까지 한다. 단, 문구·요금처럼 사용자 확인이 필요한 내용은 먼저 보여 주고 "배포해"를 받은 뒤 올린다.

## 3. Apps Script (구글 시트 백엔드)

- 배포: `apps-script/live/Code.js` 수정 → `node -e "new Function(require('fs').readFileSync('apps-script/live/Code.js','utf8'))"` 로 문법 확인 →
  `bash /Users/mac/Desktop/INBOX-B/bmoim-v2/apps-script/clasp/deploy.sh "변경 설명"` (push → 새 버전 → 기존 배포 ID 갱신을 한 번에 함).
- **절대 "새 배포"를 만들지 않는다.** 배포 ID `AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ` 가 사이트에 박혀 있다. 롤백은 `deploy -V <이전 버전>`.
- 새 권한(스코프)이 필요한 코드는 사용자가 편집기에서 함수를 한 번 실행해 승인한 뒤에 배포해야 한다. 편집기: https://script.google.com/d/1La7qXwWHKPVus9equlZi672_PUF0YtKwhohz6EYq7UcjUPu8fj61WmFD/edit
- 웹앱 호출 테스트: `curl -sL -H 'Content-Type: text/plain' -d '{"action":"..."}' "https://script.google.com/macros/s/<배포ID>/exec"` (`-X POST` 쓰지 말 것 — 리다이렉트에서 깨짐).
- 버전 이력: 6 이관 전 · 7 이메일/동의 · 8 신청번호·조회/취소·메일 · 9 메일 디자인·매니저 알림 · 10 솔라피 문자 · 11 입금 후 신청 완료·상태 드롭다운 · 12–13 호스트 현황 링크 · 14 대관 시간대 조회(rentBlocks, 시트 비공개 전환).
- 스크립트 속성(키·비밀번호)은 사용자가 편집기에서 직접 넣는다. **API 키·토큰을 채팅으로 받거나 파일에 쓰지 않는다.** (SOLAPI_API_KEY/SECRET/SENDER 는 아직 미설정 — 문자는 "추후 연동")

### 시트 운영 규칙 (사용자가 시트에서 하는 일)
- `상태` 칸 드롭다운: **입금대기 → 입금확인**(= 신청 완료) / 취소요청 / 취소. 입금확인으로 바꾸면 신청자에게 완료 메일·문자 자동 발송(설치형 트리거 `onStatusEditV3`). "신청완료"라고 적어도 같은 처리.
- 내 신청(`/my/`) 표시: 입금확인·신청완료 → "신청 완료", 입금대기 → "입금 대기", 접수 → "담당자 확인 중".
- 대관도 예상 금액이 `금액` 열에 들어가고 `입금대기`로 시작. 원칙: **입금 확인 후 신청 완료**(먼저 입금하고 신청해도 됨).
- 호스트 현황: 점주코드 탭 `현황 링크` 열을 호스트에게 보냄. 같은 호스트·같은 달은 링크 하나. 매일 9시 `syncHostLinksV12` 가 사이트 `data/catalog.json` 의 이번 달(`config.sheet.month`) 모임 중 빠진 행·링크를 채움. 즉시: `{"action":"syncHostLinks"}`. 링크 교체: 링크키 칸 비우고 동기화.
- 이미 신청이 들어온 모임의 `sheetName`/`sheetSession`/`sheetMonths` 는 바꾸지 않는다(집계·현황 키).

## 4. 확인 (미리보기)

미리보기 서버는 `~/Documents`·`~/Desktop` 을 읽지 못하므로 `/private/tmp/bmoim-preview/` 에 사본을 두고 서빙한다(재부팅하면 지워지니 매번 다시 만든다).
```
mkdir -p /private/tmp/bmoim-preview && cp /Users/mac/Desktop/INBOX-B/bmoim-v2/preview/serve.py /private/tmp/bmoim-preview/
rsync -a --delete --exclude .git --exclude _bmoim-v2-src --exclude apps-script --exclude node_modules ~/Documents/bbooks-bmoim/ /private/tmp/bmoim-preview/site/
```
그다음 `preview_start {name: "bmoim-root"}` → http://localhost:8799/. 미리보기도 실제 시트/웹앱에 연결돼 있으니 **신청 제출 버튼은 누르지 않는다**(실제 행·메일이 생김). 스크린샷이 이전 화면으로 남는 일이 있어, `scrollIntoView({behavior:'instant'})` 후 다시 찍는다.

## 5. 지켜야 할 것

- 신청자 이름·연락처 등 시트 데이터를 저장소에 넣거나 커밋하지 않는다. 확인용으로 읽어도 화면 출력은 개수·상태만.
- 실제 신청·테스트 행을 만들거나, 메일·문자를 보내는 동작은 사용자에게 먼저 묻는다.
- 요금 규칙(대관): 30분 단위 선택, 요금은 1시간 단위 올림. 세미나실·매장 테이블 1인 2시간 5,000원(시간 비례, 최소 2시간), 1인실 2시간 10,000원 + 종일권(10–18시) 20,000원(오픈 프로모션, 정가 40,000원), 계단 좌석 50,000원/시간, 전체 대관 100,000원/시간. 비품(모니터·프로젝터·앰프·복합기) 무료, 개인 노트북 지참.
- 문구는 "사장님 말투"(따뜻하고 짧게, ~해요체).

## 6. 남은 일 (사용자 결정 대기)

1. **개인정보 (v14, 2026-10-04)**: 사이트는 더 이상 시트를 직접(gviz) 읽지 않는다. 대관 시간대는 웹앱 `rentBlocks`(GET, 날짜·공간·시간만). 옛 `/apply/` 는 `/open/` 으로 리다이렉트. **시트 공유는 "제한됨"이어야 한다** — 다시 "링크가 있는 모든 사용자"로 바꾸지 말 것. 새 기능도 시트를 브라우저에서 직접 읽게 만들지 말고 웹앱 액션으로 필요한 값만 내보낸다.
2. 솔라피 문자 키 입력(사용자), 알림톡 템플릿.
3. 토스페이먼츠 카드 결제(미결정).
4. 10월 대관 프로모션(얼리버드 30%·1인실 무료 체험·다회 20%·친구 추천)은 기획안만 있음 — 사이트 반영은 사용자가 혜택 확정 후.
5. 시트의 테스트 행('테스트(삭제)') 삭제는 사용자가.
