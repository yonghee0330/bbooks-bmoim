#!/bin/sh
# 비모임 운영 배포 (https://bbooks.co.kr/moim/)
# 빌드 → ~/Documents/bbooks/moim/ 에 생성 → bbooks 저장소(메인 사이트)에 커밋·푸시
# 사용: sh _bmoim-v2-src/deploy.sh "커밋 메시지"
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="$HOME/Documents/bbooks"
MSG="${1:-비모임 업데이트}"
EXEC="https://script.google.com/macros/s/AKfycbx7-YcNCpiwlEsIMBTvWAReULt_bNTZgLV908XNsBqv-bnurJZ5u-6sg32MgQIHWZW6HQ/exec"
cd "$DST" && git pull -q --ff-only
python3 "$SRC/build.py" --sheet --out "$DST/moim"
cd "$DST" && git add moim
if git diff --cached --quiet; then echo "변경 없음 — 올릴 것이 없어요"; exit 0; fi
git commit -q -m "$MSG

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push 2>&1 | sed -E 's/ghp_[A-Za-z0-9]+/ghp_***/g' | tail -1
echo "→ https://bbooks.co.kr/moim/ 반영 대기 중…"
# 사이트가 실제로 반영되면 호스트 현황 링크를 바로 동기화 (점주코드 탭에 새 모임 행·링크 생성 + 운영자 메일 알림)
i=0
until curl -s "https://bbooks.co.kr/moim/data/catalog.json?t=$$.$i" | cmp -s - "$DST/moim/data/catalog.json"; do
  i=$((i+1))
  if [ "$i" -gt 36 ]; then echo "반영이 늦어요 — 잠시 뒤 아래 명령으로 동기화하세요:"; echo "  curl -sL -H 'Content-Type: text/plain' -d '{\"action\":\"syncHostLinks\"}' $EXEC"; exit 0; fi
  sleep 10
done
echo "✓ 사이트 반영됨 — 호스트 현황 링크 동기화:"
curl -sL -H 'Content-Type: text/plain' -d '{"action":"syncHostLinks"}' "$EXEC"; echo
