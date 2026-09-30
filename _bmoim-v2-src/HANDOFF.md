# 비모임 v2 인수인계 (Cursor용)

2026-09-30 기준. 10월 비모임 페이지를 새 디자인(v2 '서가')으로 이관하는 작업의 현재 상태와 이어서 할 일입니다.

## 1. 지금 구조

```
bbooks-bmoim/                     ← GitHub Pages (moim.bbooks.co.kr), Cursor 규칙상 작업 후 자동 커밋·푸시
├─ october.html                   ← v2/ 로 넘겨 주는 페이지 (기존 링크·인스타 링크 유지)  ※ 생성물
├─ october-old.html               ← 이관 전 10월 페이지 원본 (보관)
├─ v2/                            ← 새 비모임 사이트 (정적 HTML)  ※ 생성물 — 직접 고치지 말 것
├─ images/                        ← 포스터·공간 사진 (v2가 ../images/ 로 그대로 사용)
├─ apps-script/webapp-v2-full.gs  ← 구글 시트 Apps Script 통합본 (아직 배포 전, 아래 4번)
└─ _bmoim-v2-src/                 ← v2 원본 (밑줄 폴더라 GitHub Pages에 공개되지 않음)
   ├─ data/moims.json             ← 모임·행사 (단일 원천)
   ├─ data/spaces.json            ← 대관 공간·요금·사진
   ├─ data/site.json              ← 계좌·환불·개인정보 문구·포스터 규격·시트 연결 설정
   ├─ assets/app.css app.js rent.js cards.js
   ├─ build.py                    ← data → HTML 생성 (Python 3 표준 라이브러리만)
   └─ apps-script/Code.gs         ← (다음 단계용) 신청번호·알림톡이 있는 새 백엔드. 아직 미사용
```

**원칙: `v2/`와 `october.html`은 생성물입니다. 내용·디자인을 바꿀 때는 `_bmoim-v2-src/`를 고치고 다시 빌드하세요.**

## 2. 수정 → 반영

```bash
python3 _bmoim-v2-src/build.py --sheet
```
- 저장소 `v2/` 전체와 `october.html`을 다시 만듭니다 (기존 v2/는 지우고 새로 생성).
- 끝나면 커밋·푸시 → https://moim.bbooks.co.kr/v2/ 반영.
- 미리보기: `python3 -m http.server 8000` (저장소 루트) → http://localhost:8000/v2/
- 빌드가 알려 주는 것: 데이터 오류(회차 id 중복, 없는 공간 등), 같은 공간·시간 일정 겹침, 규격(1080×1350)과 다른 포스터 목록.

자주 하는 일
| 할 일 | 고칠 곳 |
|---|---|
| 모임 추가·수정 | `data/moims.json` 의 `items` (필드 설명은 `_bmoim-v2-src/README.md`) |
| 새 달로 넘어가기 | `site.json` 의 `month`(제목·부제·이미지·캘린더 달), `sheet.month`, `sheet.countMonths` |
| 계좌·환불·개인정보 문구 | `site.json` (`--sheet` 모드용 문구는 `build.py` 상단 `if '--sheet'` 블록에서 덮어씀) |
| 디자인 | `assets/app.css` (색은 맨 위 `:root` 토큰) |

## 3. 구글 시트 연결 (중요)

- 스프레드시트: `186sx_pR2M2chevM3HJtCNWnK0LJLrQGGCKj6YEjbYWM`
- 웹앱 주소: `site.json` → `sheet.apiUrl` (기존 october-old.html과 같은 주소)
- v2가 쓰는 액션: `count`(인원 집계), `hostStatus`(호스트 현황), `apply`/`applyV2`(모임 신청), `rent`/`rentV2`(대관), `hostApply`(개설 신청). 대관 현황은 `대관신청` 탭을 gviz로 읽음(기존과 동일).
- **모임 ↔ 시트 값 연결**: `moims.json` 각 모임의 `sheetName`(모임신청 C열), 회차의 `sheetSession`(D열), `sheetMonths`(B열, 집계할 달). 기존 신청 인원·호스트 현황이 이 값으로 이어지므로 **이미 신청이 들어온 모임은 바꾸지 말 것.**
- 시트가 `10월10일` 같은 회차 값을 날짜로 바꿔 저장하는 문제가 있어, 인원 집계는 날짜로도 맞춥니다 (`app.js` → `sheetApi.counts`).
- 새 액션(`applyV2` 등)이 서버에 없으면 페이지가 자동으로 기존 `apply`/`rent`로 보냅니다. 이때 이메일·소식수신 동의는 **비고(H열)** 에 들어갑니다. 개설 신청은 인스타 DM용 복사 문구로 안내됩니다.

## 4. 남은 일 — Apps Script 배포 (사용자가 구글 편집기에서 해야 함)

`apps-script/webapp-v2-full.gs` = 기존 webapp.gs 전체 + 새 기능. 배포하면:
- 모임신청 J 이메일 · K 소식수신동의 · L 개인정보동의 / 대관신청 L~N 같은 항목 / `개설신청` 탭 / 시트 상단 '비모임' 메뉴(뉴스레터 명단 만들기)

순서
1. 스프레드시트 → 확장 프로그램 → Apps Script → **지금 코드를 다른 이름으로 백업**
2. doGet/doPost 있는 파일에 통합본 전체를 덮어쓰기 (다른 파일에 doGet·doPost·onOpen이 또 있으면 삭제)
3. 배포 → 배포 관리 → **기존 배포 편집 → 새 버전** (새 배포 금지: 주소가 바뀜). 배포 URL이 `sheet.apiUrl`과 같은지 확인
4. 함수 `setupSheetV2` 한 번 실행 (권한 승인)
5. 사이트에서 테스트 신청 1건 → J~L열 확인 후 그 줄 삭제

주의: 저장소의 `apps-script/webapp.gs`는 배포본과 다를 수 있음 (그 복사본의 `appendApply_`에는 범위 오류가 있었고 통합본에서 고침). 배포 전 반드시 백업.

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
- Apps Script "새 배포" (주소 변경 → 모든 페이지 연결 끊김)
- `sheetName`/`sheetSession` 임의 변경 (기존 신청 인원 집계가 끊김)
