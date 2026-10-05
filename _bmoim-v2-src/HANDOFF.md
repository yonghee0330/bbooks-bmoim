# 비모임 v2 인수인계 (Cursor용)

2026-09-30 기준. 10월 비모임 페이지를 새 디자인(v2 '서가')으로 이관하는 작업의 현재 상태와 이어서 할 일입니다.

> **2026-10-05 주소 이전:** 아래 §1~§2는 옛 구조(저장소 루트 = moim.bbooks.co.kr) 설명입니다. **지금은 https://bbooks.co.kr/moim/** 이고, 사이트 파일은 메인 저장소 `~/Documents/bbooks/moim/` 에 생성됩니다. 배포 = `sh _bmoim-v2-src/deploy.sh "메시지"`, 이 저장소 루트의 옛 페이지들은 새 주소로 넘기는 페이지입니다. 최신 절차는 `.claude/CLAUDE.md` 의 §0~§2 를 따르세요. (Apps Script 배포 버전 15)

## 1. 지금 구조 (2026-09-30 루트 전환)

**비모임은 이제 https://moim.bbooks.co.kr/ 한 주소로 운영합니다.** 월이 바뀌어도 주소는 그대로이고, 페이지 안의 내용만 바뀝니다.

```
bbooks-bmoim/  (GitHub Pages · Cursor 규칙상 작업 후 자동 커밋·푸시)
├─ index.html  m/  space/  open/  open/status/  my/  cards/    ← 비모임 사이트  ※ 생성물 — 직접 고치지 말 것
├─ assets/  data/  exports/  bmoim.ics  sitemap.xml  robots.txt ← 생성물
├─ june~october.html, october-old.html  → 첫 화면으로 넘겨 주는 페이지 (옛 월별 주소 유지용)  ※ 생성물
├─ host.html → open/status/ 로 넘김  ※ 생성물
├─ v2/  → 새 주소로 넘겨 주는 페이지만 있음  ※ 생성물
├─ host/  ← 옛 호스트 현황 페이지들 (그대로 둠, 새 현황은 open/status/)
├─ images/  ← 포스터·공간 사진
├─ apps-script/live/  ← 운영 중인 Apps Script 코드 (배포 버전 13)
└─ _bmoim-v2-src/     ← 원본 (밑줄 폴더라 사이트에 공개되지 않음)
   ├─ data/moims.json · spaces.json · site.json
   ├─ assets/app.css app.js rent.js cards.js
   └─ build.py
```

주소: 첫 화면 `/`, 일정 달력 `/#cal`, 모임 `/m/<slug>/`, 대관 `/space/`, 모임 열기 `/open/`(포스터 규격 `/open/#poster`), 호스트 현황 `/open/status/`(점주코드), 홍보 카드 `/cards/`.

**원칙: 생성물은 직접 고치지 말고 `_bmoim-v2-src/`를 고친 뒤 다시 빌드.**
그 밖의 페이지(voice, btalk, moonlight, store-directory, bbooks-guide, apply/, host/)는 빌드와 무관 — 평소처럼 직접 수정.

## 2. 수정 → 반영

```bash
python3 _bmoim-v2-src/build.py --sheet
```
- 저장소 루트의 비모임 파일들을 다시 만듭니다. 지우고 다시 만드는 폴더는 `m space open my cards assets data exports v2` 뿐이고, 다른 파일은 건드리지 않습니다.
- 커밋·푸시 → https://moim.bbooks.co.kr/ 반영. 미리보기: 루트에서 `python3 -m http.server 8000` → http://localhost:8000/
- 빌드가 알려 주는 것: 데이터 오류, 같은 공간·시간 일정 겹침, 규격(1080×1350)과 다른 포스터.

자주 하는 일
| 할 일 | 고칠 곳 |
|---|---|
| 모임 추가·수정 | `data/moims.json` 의 `items` |
| **새 달로 넘어가기** | `moims.json`에 새 달 모임 추가(지난 모임은 `"status": "hidden"` 또는 삭제), `site.json`의 `month`(제목·부제·이미지·`calendarMonths`), `sheet.month`(시트 B열에 쓸 달), 이어지는 모임은 `sheetMonths` 확인. 주소는 그대로 |
| 계좌·환불·개인정보 문구 | `site.json` (운영 문구는 `build.py` 상단 `if '--sheet'` 블록에서 덮어씀) |
| 디자인 | `assets/app.css` (색은 맨 위 `:root`) |

## 3. 구글 시트 연결 (중요)

- 스프레드시트: `186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM`
- 웹앱 주소: `site.json` → `sheet.apiUrl` (기존 october-old.html과 같은 주소)
- v2가 쓰는 액션: `count`(인원 집계), `hostStatus`(호스트 현황), `apply`/`applyV2`(모임 신청), `rent`/`rentV2`(대관), `hostApply`(개설 신청). 대관 현황은 `대관신청` 탭을 gviz로 읽음(기존과 동일).
- **모임 ↔ 시트 값 연결**: `moims.json` 각 모임의 `sheetName`(모임신청 C열), 회차의 `sheetSession`(D열), `sheetMonths`(B열, 집계할 달). 기존 신청 인원·호스트 현황이 이 값으로 이어지므로 **이미 신청이 들어온 모임은 바꾸지 말 것.**
- 시트가 `10월10일` 같은 회차 값을 날짜로 바꿔 저장하는 문제가 있어, 인원 집계는 날짜로도 맞춥니다 (`app.js` → `sheetApi.counts`).
- 새 액션(`applyV2` 등)이 서버에 없으면 페이지가 자동으로 기존 `apply`/`rent`로 보냅니다. 이때 이메일·소식수신 동의는 **비고(H열)** 에 들어갑니다. 개설 신청은 인스타 DM용 복사 문구로 안내됩니다.

## 4. Apps Script (배포 버전 13 · 2026-10)

- 웹앱 = 구글 파일 `1XM5bF5…`에 연결된 스크립트 프로젝트 (편집기: https://script.google.com/d/1La7qXwWHKPVus9equlZi672_PUF0YtKwhohz6EYq7UcjUPu8fj61WmFD/edit). 배포 ID `AKfycbx7…6HQ` 유지.
- 운영 코드 사본 = `apps-script/live/Code.js`. 버전 이력: 6 이관 전 · 7 이메일/동의/개설신청 · 8 신청번호·조회/취소·메일/알림톡 · 9 안내 메일 디자인 + 매니저 수신 · 10 솔라피 문자(SMS/LMS) · 11 입금 후 신청 완료·상태 드롭다운 · **12–13 호스트 현황 링크**.
- 배포 도구: `bash /Users/mac/Desktop/INBOX-B/bmoim-v2/apps-script/clasp/deploy.sh "설명"` (push → 버전 → 기존 배포 갱신). Claude용 요약 지침: `.claude/CLAUDE.md`.
- 메일 디자인 = `Code.js` 맨 아래 `m4…Mail_` 함수들 (같은 내용 `_bmoim-v2-src/apps-script/mail-templates.js` — 미리보기용). 운영자 알림 받는 사람 = 스크립트 속성 `OPERATOR_EMAIL`(기본: 소유 계정) + `MANAGER_EMAILS`(기본: yorokobi720@gmail.com, 쉼표로 여러 명).
- 액션: GET `count`·`hostStatus` / POST `applyV2`·`rentV2`·`hostApply`·`lookup`·`cancelRequest`·`resend` (+ 옛 `apply`·`rent`·`eventApply`).
- 모임신청 탭 오른쪽 열(제목으로 찾음): 신청 메모 · 도서 요청 · 이메일 · 소식수신동의 · 개인정보동의 · 유입 · **신청번호 · 상태 · 입금기한 · 알림**. 대관신청도 신청번호·상태·알림.
- 운영자 흐름: `상태`를 **입금확인**으로 바꾸면 확정 메일(트리거 onStatusEditV3) / 취소요청이 오면 환불 후 **취소**로 (취소로 시작하면 남은 자리에서 빠짐. H열 '취소'도 계속 인정).
- 스크립트 속성(선택): OPERATOR_EMAIL, BANK_TEXT, INSTAGRAM, PAY_DEADLINE_HOURS, SOLAPI_* 와 TPL_APPLY/TPL_PAID/TPL_RENT/TPL_RESEND (알림톡 — 없으면 건너뜀. 템플릿 문구는 `_bmoim-v2-src/apps-script/SETUP.md`).
- 배포(clasp): `apps-script/live/` 를 push → `clasp version "설명"` → `clasp deploy -i AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ -V <버전>`.
  새 권한(메일·외부요청 등)을 쓰는 코드는 **배포 전에 편집기에서 한 번 실행해 권한 승인**부터. 되돌리기: `-V 7` 또는 `-V 6`.

## 4-1. 대관 페이지 (`/space/`) 고치는 법
- 문구·사진·요금은 모두 `data/spaces.json`에서 고침 → `python3 _bmoim-v2-src/build.py --sheet` → 커밋·푸시.
  - `intro`: 첫 화면 제목·소개, 좋은 점 3개(`perks`), 기본 제공 목록(`amenities`, 마지막 항목 '개인 노트북 지참 필요'), `amenitiesNote`
  - 공간별: `tagline`(큰 제목) · `desc`(사장님 소개) · `fits` · `suggest`(비북스의 제안) · `features` · `photos`(src·thumb·caption)
  - `billingNote`: 요금표·예약 화면에 나오는 올림 안내
- "이 공간에서 열린 비모임"은 `moims.json` 일정의 장소로 자동 생성.
- 요금 계산(`assets/rent.js`): 30분 단위 선택, 요금은 1시간 단위 올림. 2시간 기준 요금(세미나실·매장 테이블 1인 5,000원, 1인실 10,000원)은 시간당 비례 + 최소 2시간. 1인실 종일권(10–18시) 20,000원(오픈 프로모션, 정가 40,000원)은 더 싸면 자동 적용. 계단 50,000원/시간, 전체 100,000원/시간.
- 사진 추가: `images/space/<slug>-n.jpg`(긴 변 1800px, EXIF 제거) + `images/space/thumb/`.

## 4-2. 신청 상태 관리 (Apps Script v11)
- 모임·대관 모두 신청 화면에 금액·계좌가 나옴. 원칙: **입금 확인 후 신청 완료** (먼저 입금하고 신청해도, 신청 후 기한 안에 입금해도 됨).
- 대관도 예상 금액을 `금액` 열에 저장하고 상태 `입금대기`로 시작 (금액 없으면 `접수`).
- 시트 `모임신청`·`대관신청`의 `상태` 칸은 드롭다운: 입금대기 / 입금확인 / 취소요청 / 취소 (색 표시). `입금확인`(또는 `신청완료`)으로 바꾸면 완료 메일·문자가 자동 발송.
- 내 신청(`/my/`) 표시: 입금확인·신청완료 → "신청 완료", 입금대기 → "입금 대기", 접수 → "담당자 확인 중".
- 드롭다운 다시 적용: 웹앱에 `{"action":"setupStatusUi"}` POST (멱등).

## 4-3. 호스트 현황 링크 (Apps Script v13)
- 시트 `점주코드` 탭: 코드 · 점주명 · 모임명 · 월 + **링크키 · 현황 링크**. 호스트에게는 `현황 링크`(https://moim.bbooks.co.kr/open/status/#k=링크키)만 보내면 됨.
- 같은 호스트·같은 달 모임은 같은 링크 하나로 모두 보임. 신청자 이름·연락처·상태·메모·도서 요청 표시.
- 매일 9시 `syncHostLinksV12` 트리거가 사이트 `data/catalog.json`의 이번 달(`config.sheet.month`) 모임 중 빠진 행을 추가하고 링크를 채움. 즉시 돌리려면 웹앱에 `{"action":"syncHostLinks"}` POST.
- 링크를 바꾸려면 링크키 칸을 지우고 동기화. 외부 신청(applyUrl) 모임은 제외.
- 예전 방식(코드 직접 입력)은 그대로 동작하지만 이름·연락처가 가려져 보임.

## 5. 알려진 문제 · 다음 단계
1. **개인정보 노출**: `대관신청`·`모임신청` 탭을 gviz(공개 링크)로 읽는 구조라, 시트가 "링크가 있는 모든 사용자" 공유면 신청자 이름·연락처가 노출될 수 있음. 해결: 대관 시간대만 돌려주는 `rentBlocks` 액션을 스크립트에 추가 → `app.js` `sheetApi.rentBlocks`를 그 액션으로 교체 → 시트 공유를 "제한됨"으로.
2. **호스트 코드**: `점주코드` 탭의 코드(TOJI2026 등)가 추측 가능하고 `host/moims.js`에 공개돼 있음. 무작위 코드로 교체 권장.
3. 문자·알림톡(솔라피): 스크립트 속성 SOLAPI_API_KEY · SOLAPI_API_SECRET · SOLAPI_SENDER 를 넣으면 신청 접수·확정·대관 접수·재안내 문자가 자동 발송 (편집기 함수 testSmsV5 로 발신번호에 테스트 문자). 알림톡은 SOLAPI_PFID + TPL_* 템플릿까지 넣으면 알림톡 우선·실패 시 문자. 문자 끄기: SMS_ENABLED=N. 시트 '알림' 열에 발송 결과 기록.
4. 토지·필사·써니 모임은 `모임신청` 탭에 신청 기록이 없음 (다른 경로로 접수됐는지 확인 필요).
5. 포스터 9개 중 7개가 4:5 규격이 아님 → 호스트에게 `/v2/host/#poster` 가이드로 재제출 요청.
6. 카드 결제: 토스페이먼츠 결제위젯 연동 예정 (테스트 키로 먼저).
7. 시트의 테스트 행(이름 '테스트(삭제)', 월 '테스트') 삭제.

## 6. 하지 말 것
- `v2/` 파일 직접 수정 (다음 빌드에서 덮어써짐)
- 신청자 개인정보(시트 내용)를 저장소에 커밋
- `apps-script/Code.gs` 커밋 (알리고 문자 API 키가 들어 있어 .gitignore 처리함)
- Apps Script "새 배포" (주소 변경 → 모든 페이지 연결 끊김). 항상 기존 배포 ID에 새 버전으로
- `sheetName`/`sheetSession` 임의 변경 (기존 신청 인원 집계가 끊김)
