> 저장소 안에서의 운영 방법은 **HANDOFF.md** 를 보세요. 이 저장소에서는 `python3 _bmoim-v2-src/build.py --sheet` 가 저장소 루트의 `v2/`·`october.html` 을 바로 갱신합니다 (아래의 deploy/ 복사 단계는 필요 없음).

# 비북스 b.moim v2 — 10월 테스트 버전

기존 `moim.bbooks.co.kr`(= `~/Documents/bbooks-bmoim`)는 **건드리지 않았습니다.**
v2는 이 폴더에서 따로 만들어지고, 배포하면 `moim.bbooks.co.kr/v2/`에 나란히 올라가도록 설계했습니다.

## 핵심 구조: 데이터 한 곳 → 출력 여러 개

```
data/moims.json   ← 모임·행사 (단일 원천)          ┌ dist/index.html           허브 (목록 ⇄ 캘린더, 필터)
data/spaces.json  ← 대관 공간·요금·사진            ├ dist/m/<slug>/            모임 개별 페이지 (OG 미리보기 + 구글 Event 구조화 데이터)
data/site.json    ← 계좌·환불·개인정보·API 주소    ├ dist/m/<slug>/event.ics   모임별 캘린더 파일
        │                                         ├ dist/space/               대관 (사진·요금·계산기·30분 시간표)
        └──── python3 build.py ──────────────────▶ ├ dist/host/                모임 개설 신청
                                                  ├ dist/host/dashboard/      호스트 비공개 현황 (#k=열쇠)
                                                  ├ dist/my/                  내 신청 확인·취소 요청
                                                  ├ dist/cards/               인스타 피드·스토리·라인업 카드, 매장 QR (PNG 저장)
                                                  ├ dist/bmoim.ics            캘린더 구독 피드
                                                  ├ dist/exports/lineup.txt   블로그·뉴스레터·카톡 채널용 텍스트
                                                  ├ dist/data/catalog.json    외부 도구·Apps Script용 공개 데이터
                                                  └ dist/sitemap.xml, robots.txt
```

예전에는 모임 하나를 카드 HTML · `MOIMS` · 캘린더 셀 · `SCHEDULED_MOIM_BLOCKS` · 큐레이션 메타 **다섯 군데**에 적었습니다.
이제는 `moims.json`에 한 번만 적으면 캘린더, 대관 차단 시간, 남은 자리, 구글용 데이터, 홍보 카드가 모두 거기서 나옵니다.
같은 공간·시간에 모임이 겹치면 빌드할 때 경고가 뜹니다.

## 포스터 규격 (호스트 제출용)
**1080 × 1350 px (세로 4:5)**, JPG/PNG 2MB 이하, 가장자리 64px 여백, 오른쪽 위 220×300px는 책갈피(남은 자리) 자리로 비워 두기.
자세한 안내와 도식은 `/host/#poster` 페이지에 있으니 호스트에게 그 링크를 보내면 됩니다. 값은 `site.json`의 `poster`에서 바꿀 수 있어요.
빌드하면 규격과 다른 포스터 목록이 출력되고, 그런 포스터는 흐린 배경 위에 맞춰 표시됩니다.

## 디자인 원칙
- 모티프는 **서가(書架)**: 분야 = 선반의 책등, 상태 = 색인 탭, 카드 = 도서 목록 카드(책등 색 테두리·점선 목록표), 남은 자리 = 책갈피, 상세 = 판권면
- 종이 흰 바탕 + 원목 잉크(`--ink`) + 비북스 호박색(`--accent`), 분야 색(`tagColors`)은 가장자리에만. 제목은 명조(Noto Serif KR)
- 계절감은 포스터와 '전체' 원형 썸네일(`month.heroImage`)이 담당 → 달이 바뀌어도 화면 틀은 그대로
- 모든 페이지가 같은 머리(작은 영문 라벨 · 큰 제목 · 설명)와 같은 카드·버튼·선 아이콘을 씁니다

## 매달 할 일
1. `data/moims.json`에서 모임 추가·수정 (포스터 파일은 `~/Documents/bbooks-bmoim/images/`에 두면 자동 복사)
2. `data/site.json`의 `month` (제목·부제·히어로 이미지·캘린더 달) 수정
3. `python3 build.py --serve` → http://localhost:8790 에서 확인
4. 괜찮으면 배포 (아래)

## 모임 데이터 필드 (`moims.json`)
| 필드 | 설명 |
|---|---|
| `slug` | 주소가 됩니다 → `/m/<slug>/`. 영문·숫자·하이픈. **공개 후에는 바꾸지 마세요** (공유 링크가 깨짐) |
| `kind` | `moim` 또는 `event` |
| `status` | `open` / `closed`(신청 마감) / `hidden`(목록에서 숨김). 종료·모집 완료는 날짜·인원으로 자동 판단 |
| `title` · `short` · `oneLiner` | 제목 · 캘린더용 짧은 이름 · 한 줄 소개 |
| `summary` | 검색·카톡 미리보기 설명 (120자 안팎) |
| `tags` | 필터 칩 (`독서` `글쓰기` `음악·차` `어린이` `언어` `챌린지`) |
| `host` | `{ name, insta, bio }` |
| `poster` · `posterFit` · `posterTemp` | 이미지 파일명 · `contain`(여백 있는 포스터) · 임시 포스터 표시 |
| `sessions[]` | 신청 단위. `{ id, name?, dates:[{start,end,space}], capacity, price, applyUntil? }` — 한 회차에 날짜가 여러 개일 수 있음 (예: 토지 챌린지 오프라인 3회) |
| `packages[]` | 묶음 신청 `{ id, name, price, sessions:[회차id…] }` — 포함 회차 모두에 인원이 잡힘 |
| `materials` | `true`면 '재료 준비 있는 모임' 환불 규정 적용 |
| `applyUrl` · `applyLabel` | 외부 신청 (예: 디에잇 OFF-BOOK) |
| `extraField` | 추가 입력칸 (예: 토지 도서 구매 신청) |
| `regular` · `period` · `highlights` · `notes` · `contact` | 정기 표시 · 기간 · 강조 정보 · 안내 · 문의 |

## 테스트 방법
- **테스트 모드**: `site.json`의 `apiUrl`이 비어 있으면 신청·대관·개설 신청이 이 브라우저에만 저장됩니다. 상단 띠의 "테스트 데이터 초기화"로 지울 수 있어요.
- **시간 여행**: 주소 뒤에 `?now=2026-10-16`을 붙이면 그날 기준으로 "모임 종료·신청 마감"이 어떻게 보이는지 확인할 수 있어요.
- **호스트 현황 체험**: `/host/dashboard/#k=demo`
- **유입 추적**: 링크 뒤에 `?ref=insta_story`, `?ref=kakao`, `?ref=qr_store` 등을 붙이면 신청 시트 `유입` 칸에 기록됩니다 (공유 버튼·카드·QR에는 자동으로 붙음).

## 실제 연결 (알림톡·메일·시트)
`apps-script/SETUP.md` 참고 — 테스트용 새 스프레드시트에 `Code.gs`를 붙이고, 배포 URL을 `site.json`의 `apiUrl`에 넣은 뒤 다시 빌드하면 됩니다.
카카오 공유 버튼을 쓰려면 카카오 디벨로퍼스에서 JavaScript 키를 받아 `kakaoJsKey`에 넣고, 사이트 도메인을 등록하세요. (없으면 기기 공유·링크 복사로 동작)

## 공유용 페이지 (검토용 링크)
`python3 build.py --share` → `share/` 폴더가 만들어집니다 (폴더 주소 대신 `index.html` 링크, 허용된 폰트만 사용).
현재 공유본: https://claude.ai/artifact/LkJJQAQL4zW3sWkJagY3un — 같은 대화에서 다시 게시하면 같은 주소가 갱신됩니다.

## 기존 구글 시트 그대로 쓰기 (moim.bbooks.co.kr 이관)
`python3 build.py --sheet` → `deploy/` 폴더가 만들어집니다.
- `deploy/v2/` : 새 비모임 페이지 전체. 기존 Apps Script(webapp.gs)의 `apply`·`rent`·`count`·`hostStatus`를 그대로 씀 → **모임신청·대관신청 탭에 기존과 같은 열로 기록**
- `deploy/october.html` : 기존 주소(october.html)로 들어오면 `v2/`로 넘겨 주는 파일
- 포스터·공간 사진은 저장소 루트의 `images/` 폴더를 그대로 사용 (복사하지 않음)
- 모임과 시트 값 연결: `moims.json`의 `sheetName`(C열 모임명) · `sheetSession`(D열 회차) · `sheetMonths`(집계할 B열 월)

저장소에 넣는 순서
1. `october.html` → `october-old.html` 로 이름 바꿔 보관
2. `deploy/v2/` 폴더를 저장소 루트에 `v2/` 로 복사
3. `deploy/october.html` 을 저장소 루트에 복사
4. 커밋·푸시 → https://moim.bbooks.co.kr/october.html 이 새 페이지로 열리는지 확인

이 모드에서 꺼지는 기능 (새 백엔드 연결 전까지): 신청번호·내 신청 조회/취소, 알림톡·메일, 개설 신청 저장(→ 인스타 DM용 복사 문구로 대체).
호스트 현황은 기존 점주코드(예: STORY2026)로 `v2/host/dashboard/`에서 볼 수 있어요.

## 배포 (moim.bbooks.co.kr/v2/)
기존 저장소의 `v2/` 폴더로 복사한 뒤 평소처럼 커밋·푸시하면 됩니다. 기존 페이지 파일은 바뀌지 않습니다.
```
rsync -a --delete dist/ ~/Documents/bbooks-bmoim/v2/
```
- 테스트 기간에는 `site.json`의 `"indexable": false` → 검색엔진에 노출되지 않고 기존 페이지와 경쟁하지 않습니다.
  구조화 데이터는 [리치 결과 테스트](https://search.google.com/test/rich-results)에 v2 주소를 넣어 미리 확인할 수 있어요.
- 운영 전환 시 `"indexable": true`로 바꾸고, 구글 서치 콘솔에 `https://moim.bbooks.co.kr/v2/sitemap.xml`을 제출하세요.

## 기존 버전과 달라진 점 (요약)
| | 기존 | v2 |
|---|---|---|
| 데이터 | 모임마다 5곳에 수기 입력 | `moims.json` 한 곳 |
| 개인정보 | 신청 시트를 공개 gviz로 직접 읽음 (이름·연락처 노출 가능) | 시트 비공개, 서버가 인원 수·시간대만 반환 |
| 신청 | 동의 없음, 계좌 안내로 끝 | 개인정보·환불 동의, 신청번호, 입금 기한, 알림톡·메일, 내 신청 확인·취소 요청 |
| 정원 | 페이지에서만 확인 | 서버에서 잠금 후 재확인 (동시 신청으로 초과 방지) |
| 공유 | `#id` 스크롤만 | 모임별 주소 + OG 미리보기 + 공유 시트 + 유입 추적 |
| 검색 | 없음 | schema.org Event, sitemap |
| 캘린더 | 8px 글씨, 셀마다 [대관] | 목록 ⇄ 캘린더 토글, 모바일은 점 + 그날 일정 목록 |
| 대관 | 모달 하나에 전부 | 별도 탭: 요금표 · 공간 사진 · 계산기 · 단계별 예약 |
| 호스트 | 추측 가능한 코드 (공개 JS) | 40자 무작위 열쇠, 이름·연락처 마스킹, 호스트 공유 링크 |
| 홍보 | 포스터 수작업 | 인스타 카드·스토리·라인업·QR·캘린더 구독·라인업 텍스트 자동 생성 |
