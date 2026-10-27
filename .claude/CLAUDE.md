# 비모임 (bbooks.co.kr/moim) — Claude 작업 지침

비북스(부천 원미동, 104개 0.1평 서가 서점)의 모임·대관 사이트. 사용자는 비북스 운영자(사장님), 한국어로 대화한다.
상세 구조·이력은 `_bmoim-v2-src/HANDOFF.md`. 이 파일은 Claude가 바로 작업할 수 있게 핵심만 모은 것이다.

## 0. 2026-10-05 주소 이전 (가장 먼저 읽을 것)

**비모임은 이제 https://bbooks.co.kr/moim/ 에 있다.** 사이트 파일은 메인 사이트 저장소 `~/Documents/bbooks`(repo yonghee0330/bbooks, CNAME bbooks.co.kr)의 `moim/` 폴더로 나간다.
이 저장소(`bbooks-bmoim`, CNAME moim.bbooks.co.kr)는 **원본(`_bmoim-v2-src/`)과 Apps Script 코드를 보관**하고, 사이트 파일은 옛 주소 `moim.bbooks.co.kr/...` 를 새 주소로 넘겨 주는 페이지(`--stubs`)만 남아 있다. 이 저장소 루트의 `index.html m/ space/ open/ my/ cards/ v2/ *.html` 은 전부 넘김 페이지이니 **고치지 말 것.**

## 1. 한눈에

| 무엇 | 어디 |
|---|---|
| 운영 사이트 | https://bbooks.co.kr/moim/ — 파일은 `~/Documents/bbooks/moim/` (생성물, 직접 수정 금지) |
| 원본 | 이 저장소 `_bmoim-v2-src/` — `data/moims.json · spaces.json · site.json`, `assets/app.js · rent.js · app.css · cards.js`, `build.py`, `deploy.sh` |
| 옛 주소 | moim.bbooks.co.kr → 이 저장소(GitHub Pages)가 새 주소로 넘김. 지우지 말 것(이미 퍼진 링크·메일) |
| Apps Script 운영 코드 사본 | `apps-script/live/Code.js` (현재 배포 **버전 22**) |
| Apps Script 배포 도구 | `/Users/mac/Desktop/INBOX-B/bmoim-v2/apps-script/clasp/deploy.sh` |
| 구글 시트 | `186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM` (탭: 모임신청 · 대관신청 · 점주코드 · 개설신청), 공유 "제한됨" |
| 로컬 미리보기 | launch.json `bmoim-root` (port 8799) — 아래 4번 |

주요 주소(모두 /moim/ 아래): `/moim/` 이번 달 모임·달력, `/moim/m/<slug>/` 모임, `/moim/space/` 대관, `/moim/open/` 모임 열기, `/moim/open/status/#k=<링크키>` 호스트 현황, `/moim/my/` 내 신청, `/moim/cards/` 홍보 카드.
메인 랜딩(bbooks.co.kr, 소스 `INBOX-B/bbooks-home`)은 `/moim/`, `/moim/space/` 로 링크한다.

## 2. 수정 → 배포 (사이트)

1. `_bmoim-v2-src/` 의 JSON·JS·CSS·build.py 를 고친다.
2. 확인용 빌드: `python3 _bmoim-v2-src/build.py --sheet --out /private/tmp/bmoim-preview/site/moim` (운영 폴더를 건드리지 않음). 빌드가 알려 주는 것: 데이터 오류, 일정 겹침, 포스터 규격, **깨진 링크 검사**, 이미지 복사 수. 경고는 사용자에게 알린다.
3. JS를 고쳤으면 `node --check _bmoim-v2-src/assets/app.js` 등으로 문법 확인.
4. **운영 배포: `sh _bmoim-v2-src/deploy.sh "커밋 메시지"`** — 빌드 → `~/Documents/bbooks/moim/` → bbooks 저장소 커밋·푸시(메인 사이트 저장소라 다른 파일은 건드리지 않음). 문구·요금처럼 사용자 확인이 필요한 내용은 먼저 보여 주고 "배포해"를 받은 뒤 올린다.
5. 이 저장소(원본)도 커밋·푸시: `git add _bmoim-v2-src apps-script/live/Code.js .claude && git commit && git push` (`.DS_Store`, `node_modules/`, `apps-script/Code.gs`(옛 문자 API 키), 사용자가 만든 `scripts/*` 같은 미추적 파일은 넣지 말 것). 커밋 메시지는 한국어 한 줄 + 빈 줄 + `Co-Authored-By` 줄. push 출력의 토큰(ghp_…)은 `sed -E 's/ghp_[A-Za-z0-9]+/ghp_***/g'` 로 가린다.
6. 반영 확인: `until curl -s "https://bbooks.co.kr/moim/<경로>?t=$RANDOM" | grep -q '<바뀐 문구>'; do sleep 10; done` (긴 `sleep` 이어 붙이기는 막힘 — until 루프).
7. 옛 주소 넘김 페이지를 다시 만들 일(모임 slug 추가 등)은 거의 없다 — 없는 주소는 `404.html` 이 같은 경로의 새 주소로 넘긴다. 필요하면 `python3 _bmoim-v2-src/build.py --stubs` 후 이 저장소만 커밋.
- **이미지**: 포스터·공간 사진 원본은 이 저장소 `images/` 에 둔다. 빌드가 페이지에서 쓰는 것만 골라 `moim/images/` 로 복사한다(새 모임 포스터는 `images/` 에 넣고 `moims.json` 에 파일명만 적으면 됨).

## 3. Apps Script (구글 시트 백엔드)

- 배포: `apps-script/live/Code.js` 수정 → `node -e "new Function(require('fs').readFileSync('apps-script/live/Code.js','utf8'))"` 로 문법 확인 →
  `bash /Users/mac/Desktop/INBOX-B/bmoim-v2/apps-script/clasp/deploy.sh "변경 설명"` (push → 새 버전 → 기존 배포 ID 갱신을 한 번에 함).
- **절대 "새 배포"를 만들지 않는다.** 배포 ID `AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ` 가 사이트에 박혀 있다. 롤백은 `deploy -V <이전 버전>`.
- 새 권한(스코프)이 필요한 코드는 사용자가 편집기에서 함수를 한 번 실행해 승인한 뒤에 배포해야 한다. 편집기: https://script.google.com/d/1La7qXwWHKPVus9equlZi672_PUF0YtKwhohz6EYq7UcjUPu8fj61WmFD/edit
- 웹앱 호출 테스트: `curl -sL -H 'Content-Type: text/plain' -d '{"action":"..."}' "https://script.google.com/macros/s/<배포ID>/exec"` (`-X POST` 쓰지 말 것 — 리다이렉트에서 깨짐).
- 버전 이력: 6 이관 전 · 7 이메일/동의 · 8 신청번호·조회/취소·메일 · 9 메일 디자인·매니저 알림 · 10 솔라피 문자 · 11 입금 후 신청 완료·상태 드롭다운 · 12–13 호스트 현황 링크 · 14 대관 시간대 조회(rentBlocks, 시트 비공개 전환) · 15 사이트 주소 bbooks.co.kr/moim · 16 개설 신청 진행 상태 · 17 호스트 링크 즉시 동기화 · 18 개설 안내 모임 매칭 · 19 도서 결제 내역(payNote) · 20 참가자 이름·나이 열 · 21 참가 인원(여러 명) 집계 · 22 개설 안내 일정 문구.
- 스크립트 속성(키·비밀번호)은 사용자가 편집기에서 직접 넣는다. **API 키·토큰을 채팅으로 받거나 파일에 쓰지 않는다.** (SOLAPI_API_KEY/SECRET/SENDER 는 아직 미설정 — 문자는 "추후 연동")

### 시트 운영 규칙 (사용자가 시트에서 하는 일)
- `상태` 칸 드롭다운: **입금대기 → 입금확인**(= 신청 완료) / 취소요청 / 취소. 입금확인으로 바꾸면 신청자에게 완료 메일·문자 자동 발송(설치형 트리거 `onStatusEditV3`). "신청완료"라고 적어도 같은 처리.
- 내 신청(`/my/`) 표시: 입금확인·신청완료 → "신청 완료", 입금대기 → "입금 대기", 접수 → "담당자 확인 중".
- 대관도 예상 금액이 `금액` 열에 들어가고 `입금대기`로 시작. 원칙: **입금 확인 후 신청 완료**(먼저 입금하고 신청해도 됨).
- 호스트 현황: 점주코드 탭 `현황 링크` 열을 호스트에게 보냄. 같은 호스트·같은 달은 링크 하나. **`deploy.sh` 가 사이트 반영을 확인한 직후 자동으로 `syncHostLinks` 를 호출**해 사이트 `data/catalog.json` 의 이번 달(`config.sheet.month`) 모임 중 빠진 행·링크를 채우고, 새 링크가 생기면 운영자(사장님·매니저)에게만 메일로 알림(링크는 호스트에게 사람이 전달). 수동: `{"action":"syncHostLinks"}`(항상 최신 catalog 사용). 매일 9시 `syncHostLinksV12` 는 안전망으로 남아 있음. 링크 교체: 링크키 칸 비우고 동기화.
- **모임 개설 신청 진행 (v16)**: 시트 `개설신청` 탭 `상태` 드롭다운 **접수 → 접수완료 → 모임등록**(+ 보류=안내 없음). 신청 직후 신청자(이메일 필수)에게 접수 확인 메일(+`신청번호` BH-…, 시트 `신청번호` 열). `접수완료`·`모임등록`으로 바꾸면 안내 메일 자동 발송(`v16HostStatusEdit_`, onStatusEditV3 트리거). `모임등록` 메일에는 제목이 사이트 모임과 정확히 한 곳만 맞을 때 모임 페이지 링크가 들어감. **호스트 전용 현황 링크는 자동으로 보내지 않는다**(개인정보 — 점주코드 탭에서 사람이 확인해 따로 전달). 문자는 솔라피 키가 설정되면 같이 나감. 탭 준비 재실행: `{"action":"setupHostFlow"}`(안내 발송 없음, 멱등). 메일 문구 = `m4HostMail_`(Code.js 맨 아래 + `_bmoim-v2-src/apps-script/mail-templates.js`).
- **오래 진행되는 모임/외부 신청 모임(예: 부천 AI 특공대 `ai-club-1gi`)**: `moims.json` 항목에 `applyUrl`(신청은 그쪽 페이지에서 받음) + 표시용 선택 필드 — `dateLabel`(일시 문구), `cardDateLabel`(카드 일시), `whenShort`, `compactDates:true`(상세에서 날짜 나열 대신 `period`·`regular`만), `badge`(포스터 리본, 짧게: 한 줄에 4글자 안팎), `stateLabel`, `seatsText`, `applyNote`, `refundNote`(문장 배열, 모임별 환불 규정). `applyUrl` 모임은 시트 집계·호스트 현황 링크 동기화에서 제외된다. `sessions[].dates` 는 **앞으로 남은 회차만** 넣는다(지난 날짜가 대관 캘린더·일정 겹침 검사에 걸리지 않게). AI 특공대 문구 근거는 `INBOX-B/ai-club/assets/config.js`(참가비 50,000원 일괄, 정규 합류는 4회차(11/7)까지, 1회 참관 10,000원, 정원 8명). 합류 마감(11/7) 뒤에는 `highlights`의 "중간 합류" 문구를 "1회 참관만"으로 고칠 것.
- **월 전환·첫 화면 제목 규칙 (사용자 확정 2026-10-26)**: 다음 달 모임을 등록하기 시작하면 `site.json` `month.title` 을 "A-B월 비모임"(예: 10-11월 비모임)으로 바꾸고, A월이 끝나면 "B월 비모임"으로, B월 중순이 되면 다시 "B-C월 비모임"(11-12월 비모임)으로 바꾼다. **제목만 바꾼다** — `month.key`·`sub`·`desc`·`heroImage`·`sheet.month`·`countMonths`·`hostMonths` 등 다른 값은 사용자가 시키기 전에는 건드리지 않는다. 다음 달 모임은 새 항목(slug `…-YYMM`, 새 포스터)으로 추가하고, 같은 모임의 반복이면 `sheetName` 을 "모임명 N월"처럼 달라지게 하고 `sheetMonths`(예: ["10월","11월"])를 넣어 시트 집계·호스트 현황이 이전 달과 섞이지 않게 한다. 반복 모임의 소개·재료·정원은 직전 달 항목을 복사하되, 포스터에 없는 값은 "직전 달과 같다고 가정"한 것이므로 사용자에게 알린다.
- **모임에 책 붙이기 (`books`, `bookNote`)**: `moims.json` 항목에 `books:[{id,title,author,publisher,pages,age,price,isbn,cover,summary}]`. 상세 페이지에 "함께 읽는 책"(표지·소개·정가)이 생기고, 신청창에 책별 수량(−/+, 최대 9권) 고르기 + 도서비 결제 선택(회비와 함께 미리 입금 / 모임 날 현장 결제)이 나온다. 시트에는 `금액`=회비(+선입금 도서비), `도서 요청`=고른 책·도서비·결제 방식, 메일·운영자 알림에 "결제 내역(payNote)"이 들어간다. `price`는 정가이고 비북스 판매가를 정하면 그 값으로 고친다. 표지는 `images/books/<isbn13>.jpg`(교보 CDN `contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/<isbn13>.jpg`에서 한 번 받아 저장), 소개 `summary`는 서점 책소개를 읽고 **내 말로 짧게** 쓴다(그대로 복사 금지). 서점 사이트는 예의 있게: 교보 검색 4초 이상 간격, 알라딘 검색 금지(상품 페이지만).
- **참가자 정보 입력칸 (`applyFields`, `nameLabel`, `applyFieldsNote`)**: 아동 모임처럼 신청자(보호자)와 참가자가 다를 때 `moims.json` 항목에 `nameLabel`(예: "입금자 이름 (보호자)") + `applyFields:[{id,label,required,placeholder}]`(앞의 두 칸 = 참가자 이름·나이)를 둔다. `applyCount:{label,max}` 를 더하면 신청할 때 참가 인원을 고르고(남은 자리를 넘지 않게) 아이마다 이름·나이를 받으며, 참가비는 **1인 × 인원**이다. 시트 `모임신청` 탭의 **`참가 인원`·`참가자 이름`·`참가자 나이`** 열(자동 생성, 서버가 이 열들만 허용; 이름·나이는 쉼표로 이어 붙임)과 `신청 메모`("참가 아이 …")에 기록되고, **정원 집계(`getCounts_`)와 호스트 현황의 인원은 `참가 인원`으로 센다**. 그 정보는, 접수 메일·운영자 알림·호스트 현황(참가 아이 열)에 나온다. 개인정보 수집 항목에 "참가 아동의 이름·나이(보호자가 대신 입력)"가 추가돼 있다(`build.py` SHEET 블록).
- **개설 신청서 일정 칸 (2026-10-27 사용자 결정)**: "첫 회차 일정"(필수) + "추가 회차 일정"(여러 번 열 때만). 1순위·2순위 같은 **희망 후보가 아니라, 적은 날짜는 모두 회차로 연다.** 개설신청 탭 열 이름(`희망일정1`·`희망일정2`)은 그대로 두었다. 모임을 등록할 때 날짜가 둘이면 회차 둘, 하나면 하나로 `sessions`를 만든다.
- 이미 신청이 들어온 모임의 `sheetName`/`sheetSession`/`sheetMonths` 는 바꾸지 않는다(집계·현황 키).

## 4. 확인 (미리보기)

미리보기 서버는 `~/Documents`·`~/Desktop` 을 읽지 못하므로 `/private/tmp/bmoim-preview/` 에 사본을 둔다(재부팅하면 지워지니 매번 다시 만든다).
```
mkdir -p /private/tmp/bmoim-preview && cp /Users/mac/Desktop/INBOX-B/bmoim-v2/preview/serve.py /private/tmp/bmoim-preview/
python3 _bmoim-v2-src/build.py --sheet --out /private/tmp/bmoim-preview/site/moim
```
그다음 `preview_start {name: "bmoim-root"}` → http://localhost:8799/moim/ (서버가 꺼져 있으면 다시 start). 미리보기도 실제 시트/웹앱에 연결돼 있으니 **신청 제출 버튼은 누르지 않는다**(실제 행·메일이 생김). 스크린샷이 이전 화면으로 남는 일이 있어, `scrollIntoView({behavior:'instant'})` 후 다시 찍는다.

## 5. 지켜야 할 것

- 신청자 이름·연락처 등 시트 데이터를 저장소에 넣거나 커밋하지 않는다. 확인용으로 읽어도 화면 출력은 개수·상태만.
- 실제 신청·테스트 행을 만들거나, 메일·문자를 보내는 동작은 사용자에게 먼저 묻는다.
- 요금 규칙(대관): 30분 단위 선택, 요금은 1시간 단위 올림. 세미나실·매장 테이블 1인 2시간 5,000원(시간 비례, 최소 2시간), 1인실 2시간 10,000원 + 종일권(10–18시) 20,000원(오픈 프로모션, 정가 40,000원), 계단 좌석 50,000원/시간, 전체 대관 100,000원/시간. 비품(모니터·프로젝터·앰프·복합기) 무료, 개인 노트북 지참.
- 문구는 "사장님 말투"(따뜻하고 짧게, ~해요체).

## 6. 남은 일 (사용자 결정 대기)

1. **개인정보 (v14, 2026-10-04)**: 사이트는 더 이상 시트를 직접(gviz) 읽지 않는다. 대관 시간대는 웹앱 `rentBlocks`(GET, 날짜·공간·시간만). 옛 `/apply/` 는 `/open/` 으로 리다이렉트. **시트 공유는 "제한됨"이어야 한다(2026-10-04 적용 완료, 편집자: 소유자 + 매니저)** — 다시 "링크가 있는 모든 사용자"로 바꾸지 말 것. 새 기능도 시트를 브라우저에서 직접 읽게 만들지 말고 웹앱 액션으로 필요한 값만 내보낸다.
2. 솔라피 문자 키 입력(사용자), 알림톡 템플릿.
3. 토스페이먼츠 카드 결제(미결정).
4. 10월 대관 프로모션(얼리버드 30%·1인실 무료 체험·다회 20%·친구 추천)은 기획안만 있음 — 사이트 반영은 사용자가 혜택 확정 후.
5. 시트의 테스트 행('테스트(삭제)') 삭제는 사용자가.
