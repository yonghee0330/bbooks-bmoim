#!/usr/bin/env python3
"""임시 포스터(글자만) 1080×1350 — 확정 포스터가 오기 전까지 쓰는 타이포 포스터.
실행: python3 _bmoim-v2-src/tools/make_temp_poster.py   → images/ 에 PNG 저장
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'images')
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'   # 0 Regular · 2 Medium · 4 SemiBold · 6 Bold
INK, PAPER, ORANGE, BROWN, MUTED = '#2b211b', '#f3eee6', '#d2642a', '#8b5e3c', '#85766a'
W, H, S = 1080, 1350, 2

def font(size, idx=6): return ImageFont.truetype(FONT, int(size * S), index=idx)

def make(name, kicker, title_lines, tagline, chips, foot_lines):
    im = Image.new('RGB', (W * S, H * S), PAPER); d = ImageDraw.Draw(im)
    pad = 96 * S
    x, base = pad, 130 * S
    for w_, h_, c in ((12, 36, BROWN), (12, 48, ORANGE), (12, 28, INK)):
        d.rectangle([x, base - h_ * S, x + w_ * S, base], fill=c); x += 19 * S
    d.text((x + 10 * S, base + 4 * S), '비북스  b.moim', font=font(40), fill=INK, anchor='ls')
    d.text((pad, 290 * S), kicker, font=font(36, 4), fill=ORANGE, anchor='ls')
    size = 196
    while size > 90 and max(d.textlength(t, font=font(size)) for t in title_lines) > (W - 2 * 96) * S: size -= 6
    f = font(size); y = 330 * S + int(size * 0.92 * S)
    for i, t in enumerate(title_lines):
        d.text((pad, y), t, font=f, fill=INK, anchor='ls')
        if i < len(title_lines) - 1: y += int(size * 1.08 * S)
    y += 70 * S
    d.rectangle([pad, y, pad + 84 * S, y + 6 * S], fill=ORANGE)
    d.text((pad, y + 70 * S), tagline, font=font(40, 2), fill=INK, anchor='ls')
    cx, cy = pad, y + 150 * S
    for c in chips:
        w_ = d.textlength(c, font=font(32, 4)) / S + 44
        d.rounded_rectangle([cx, cy, cx + w_ * S, cy + 64 * S], radius=32 * S, outline=BROWN, width=3 * S)
        d.text((cx + 22 * S, cy + 43 * S), c, font=font(32, 4), fill=BROWN, anchor='ls'); cx += int((w_ + 16) * S)
    yy = H * S - 168 * S - 60 * S * (len(foot_lines) - 1)
    for i, t in enumerate(foot_lines):
        d.text((pad, yy + i * 60 * S), t, font=font(44 if i == 0 else 34, 6 if i == 0 else 2), fill=INK if i == 0 else MUTED, anchor='ls')
    d.text((pad, H * S - 70 * S), 'bbooks.co.kr/moim', font=font(30, 2), fill=MUTED, anchor='ls')
    im = im.resize((W, H), Image.LANCZOS); im.save(os.path.join(OUT, name), optimize=True); print('✓', name)

make('modada_music_dec2026_temp.png', '12월 어린이 모임', ['모두다', '음악'], '일상생활 속 소음이 음악이 된다',
     ['미취학~초등 고학년', '그림책 · 음악 · 신체활동'], ['12.12 SAT', '비북스 계단 좌석 · 참가비 10,000원'])
make('story_aunt_dec2026_temp.png', '12월 어린이 모임', ['그림책', '읽어주는 이모'], '겨울 · 크리스마스 그림책을 읽고 독후활동',
     ['유치원생~초등 저학년', '그림책 · 독후활동'], ['12.19 SAT', '비북스 계단 좌석 · 참가비 10,000원'])
