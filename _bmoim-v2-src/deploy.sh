#!/bin/sh
# 비모임 운영 배포 (https://bbooks.co.kr/moim/)
# 빌드 → ~/Documents/bbooks/moim/ 에 생성 → bbooks 저장소(메인 사이트)에 커밋·푸시
# 사용: sh _bmoim-v2-src/deploy.sh "커밋 메시지"
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="$HOME/Documents/bbooks"
MSG="${1:-비모임 업데이트}"
cd "$DST" && git pull -q --ff-only
python3 "$SRC/build.py" --sheet --out "$DST/moim"
cd "$DST" && git add moim
if git diff --cached --quiet; then echo "변경 없음 — 올릴 것이 없어요"; exit 0; fi
git commit -q -m "$MSG

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push 2>&1 | sed -E 's/ghp_[A-Za-z0-9]+/ghp_***/g' | tail -1
echo "→ https://bbooks.co.kr/moim/ (1~2분 뒤 반영)"
