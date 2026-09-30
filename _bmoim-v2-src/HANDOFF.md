# 비모임 v2 인수인계 (Cursor용)

2026-09-30 기준. 10월 비모임 페이지를 새 디자인(v2 '서가')으로 이관하는 작업의 현재 상태와 이어서 할 일입니다.

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
├─ apps-script/live/  ← 운영 중인 Apps Script 코드 (배포 버전 7)
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

## 4. Apps Script (배포 완료 · 2026-09-30)

- 웹앱은 **다른 구글 파일(`1XM5bF5…`)에 연결된 스크립트 프로젝트**에 있음 (신청 시트의 확장 프로그램 메뉴에서는 안 보일 수 있음). 시트는 ID로 열어서 씀.
- 운영 코드 = `apps-script/live/Code.js` (배포 버전 **7**, 배포 ID `AKfycbx7…6HQ` 유지). 버전 6 코드에 추가만 한 것:
  `applyV2` · `rentV2` · `hostApply` · `setupSheetV2()` · `buildNewsletterList()`
- 모임신청 A~I, 대관신청 A~K는 기존과 동일하게 기록. 새 항목은 **제목으로 찾는 오른쪽 새 열**:
  모임신청 `신청 메모 · 도서 요청 · 이메일 · 소식수신동의 · 개인정보동의 · 유입`, 대관신청 `이메일 · 소식수신동의 · 개인정보동의 · 유입`.
  (H열은 기존처럼 접수일 — '취소' 표시도 H열에 하던 대로)
- `개설신청` 탭: 첫 개설 신청 때 자동 생성. `뉴스레터` 탭: 편집기에서 `buildNewsletterList` 실행 시 생성·갱신.
- 코드 수정 배포(clasp): `apps-script/live/` 기준으로 push → `clasp version "설명"` → `clasp deploy -i AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ -V <새 버전>`.
  되돌리기: 같은 명령에 `-V 6` (이관 전 코드).
- 참고: `apps-script/webapp.gs`·`Code.gs`는 옛 복사본으로 운영 코드와 다름. 옛 알리고 문자 코드는 저장소 밖 백업에만 있음.

## 5. 알려진 문제 · 다음 단계
1. **개인정보 노출**: `대관신청`·`모임신청` 탭을 gviz(공개 링크)로 읽는 구조라, 시트가 "링크가 있는 모든 사용자" 공유면 신청자 이름·연락처가 노출될 수 있음. 해결: 대관 시간대만 돌려주는 `rentBlocks` 액션을 스크립트에 추가 → `app.js` `sheetApi.rentBlocks`를 그 액션으로 교체 → 시트 공유를 "제한됨"으로.
2. **호스트 코드**: `점주코드` 탭의 코드(TOJI2026 등)가 추측 가능하고 `host/moims.js`에 공개돼 있음. 무작위 코드로 교체 권장.
3. 신청번호·내 신청 조회/취소·알림톡: `_bmoim-v2-src/apps-script/Code.gs`(+ `SETUP.md`)에 새 백엔드가 준비돼 있음. 쓰려면 새 스크립트로 배포 후 `site.json` `apiUrl` 지정, `--sheet` 없이 빌드하는 구조로 전환 (별도 작업).
4. 토지·필사·써니 모임은 `모임신청` 탭에 신청 기록이 없음 (다른 경로로 접수됐는지 확인 필요).
5. 포스터 9개 중 7개가 4:5 규격이 아님 → 호스트에게 `/v2/host/#poster` 가이드로 재제출 요청.

## 6. 하지 말 것
- `v2/` 파일 직접 수정 (다음 빌드에서 덮어써짐)
- 신청자 개인정보(시트 내용)를 저장소에 커밋
- `apps-script/Code.gs` 커밋 (알리고 문자 API 키가 들어 있어 .gitignore 처리함)
- Apps Script "새 배포" (주소 변경 → 모든 페이지 연결 끊김). 항상 기존 배포 ID에 새 버전으로
- `sheetName`/`sheetSession` 임의 변경 (기존 신청 인원 집계가 끊김)
