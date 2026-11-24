#!/usr/bin/env python3
"""카톡·메신저 미리보기(OG) 이미지 — 사진 없이 글자(타이포)만으로. 1200×630.
실행: python3 _bmoim-v2-src/tools/make_og.py   → 저장소 images/og_*.png 를 만든다 (월이 바뀌면 site.json 제목을 읽어 다시 실행)
"""
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
REPO = os.path.dirname(SRC)
OUT = os.path.join(REPO, 'images')
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'   # idx: 0 Regular · 2 Medium · 4 SemiBold · 6 Bold
INK, PAPER, ORANGE, BROWN, MUTED = '#2b211b', '#f3eee6', '#d2642a', '#8b5e3c', '#85766a'
W, H, S = 1200, 630, 2   # S: 2배로 그린 뒤 줄여서 선을 매끈하게

site = json.load(open(os.path.join(SRC, 'data', 'site.json'), encoding='utf-8'))
period = site['month'].get('period') or site['month']['title'].replace('비모임', '').strip()

def font(size, idx=6):
    return ImageFont.truetype(FONT, int(size * S), index=idx)

def make(name, title_lines, label, sub):
    im = Image.new('RGB', (W * S, H * S), PAPER)
    d = ImageDraw.Draw(im)
    pad = 84 * S
    # 로고 막대 세 개 + 이름
    x, base = pad, 92 * S
    for w_, h_, c in ((10, 30, BROWN), (10, 40, ORANGE), (10, 24, INK)):
        d.rectangle([x, base - h_ * S, x + w_ * S, base], fill=c); x += 16 * S
    d.text((x + 8 * S, base + 3 * S), '비북스  b.moim', font=font(34), fill=INK, anchor='ls')
    # 라벨 (작은 글씨 + 주황 밑줄)
    d.text((pad, 188 * S), label, font=font(30, 4), fill=ORANGE, anchor='ls')
    # 큰 제목 — 줄 수에 맞춰 글자 크기를 줄여 가며 맞춘다
    size = 190
    while size > 70:
        f = font(size)
        if max(d.textlength(t, font=f) for t in title_lines) <= (W - 2 * 84) * S and size * 1.12 * len(title_lines) <= 300:
            break
        size -= 6
    y = 205 * S + int(size * 0.92 * S)
    for t in title_lines:
        d.text((pad, y), t, font=f, fill=INK, anchor='ls')
        y += int(size * 1.1 * S)
    # 아래: 한 줄 설명 + 주소
    d.rectangle([pad, 520 * S, pad + 64 * S, 524 * S], fill=ORANGE)
    d.text((pad, 568 * S), sub, font=font(30, 2), fill=INK, anchor='ls')
    d.text((W * S - pad, 568 * S), 'bbooks.co.kr/moim', font=font(28, 2), fill=MUTED, anchor='rs')
    im = im.resize((W, H), Image.LANCZOS)
    im.save(os.path.join(OUT, name), optimize=True)
    print('✓', name)

make('og_hub.png', [f'{period}', '비모임'], '부천 원미동 · 비북스', '책과 차, 글과 이야기가 모이는 동네 모임')
make('og_events.png', [f'{period}', '행사'], '부천 원미동 · 비북스', '작가와 만나고 함께 배우는 동네 행사')
make('og_host.png', ['모임 열기'], '비모임 호스트', '내 모임을 비북스에서 열어 보세요')
make('og_dashboard.png', ['신청 현황'], '호스트 전용', '내 모임에 들어온 신청자를 확인해요')
make('og_my.png', ['내 신청', '확인'], '비모임', '신청번호와 휴대폰 번호로 조회해요')
make('og_cards.png', ['홍보 카드'], '비모임', '모임 소식을 한 장으로 공유해요')
