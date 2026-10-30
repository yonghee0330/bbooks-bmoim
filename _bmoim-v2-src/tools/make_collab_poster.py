#!/usr/bin/env python3
"""예스24 × 동네책방 콜라보 「작가와의 만남」 포스터 (1080×1350) — 2026-10 서귤 북토크에서 처음 씀

  python3 make_collab_poster.py <책표지.jpg> <작가 원형 이미지.png> <저장할 파일.jpg> <Pretendard OTF 폴더>

문구(부제·제목·콜라보 알약·일정)는 아래 코드에서 바꾼다. 폰트: npm pack pretendard@1.3.9 후 package/dist/public/static
오른쪽 위 220×300(남은 자리 책갈피 자리)은 비워 두려고 알약을 그 아래에 둔다.
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
cover_p, avatar_p, out = sys.argv[1:4]
FD = sys.argv[4]
F = lambda w, s: ImageFont.truetype(f'{FD}/Pretendard-{w}.otf', s)
W, H = 1080, 1350
BG, WHITE, SUB, INK = (61, 74, 116), (255, 255, 255), (214, 220, 236), (28, 28, 34)
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)

# 1) 오른쪽 위 콜라보 알약 (책갈피 자리 220×300 아래로)
pill_y, pill_h = 306, 64
parts = [('비북스 b.books', 'Bold'), (' × ', 'Light'), ('위즈덤하우스', 'Bold'), (' × ', 'Light'), ('YES24', 'Black')]
tw = sum(d.textlength(t, font=F(w, 30)) for t, w in parts)
x0 = W - tw - 64
d.rounded_rectangle([x0 - 34, pill_y, W + 40, pill_y + pill_h], radius=pill_h // 2, fill=WHITE)
x = x0
for t, w in parts:
    d.text((x, pill_y + pill_h // 2), t, font=F(w, 30), fill=INK if w != 'Black' else (0, 82, 204), anchor='lm')
    x += d.textlength(t, font=F(w, 30))

# 2) 부제 + 큰 제목
L = 72
d.text((L, 418), '조선에서 제일 질긴 여자, 채달금의 파란만장 생존기', font=F('Medium', 34), fill=SUB)
d.text((L, 470), '《채달금전》', font=F('ExtraBold', 74), fill=WHITE)
d.text((L, 558), '서귤 작가와의 만남', font=F('ExtraBold', 74), fill=WHITE)

# 3) 오른쪽 책 (책등 쪽 종이 결 + 그림자)
cov = Image.open(cover_p).convert('RGB')
ch = 500; cw = round(cov.width * ch / cov.height)
cov = cov.resize((cw, ch), Image.LANCZOS)
bx, by = W - cw - 76, 694
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh).rectangle([bx - 6, by + 18, bx + cw + 22, by + ch + 22], fill=(10, 14, 30, 150))
im.paste(sh.filter(ImageFilter.GaussianBlur(18)), (0, 0), sh.filter(ImageFilter.GaussianBlur(18)))
for i in range(14):  # 책장 결
    c = 236 - (i % 3) * 10
    d.rectangle([bx - 16 + i, by + 6 - i * 0.4, bx - 15 + i, by + ch + 4], fill=(c, c, c - 4))
im.paste(cov, (bx, by))
d = ImageDraw.Draw(im)
d.line([bx + 6, by, bx + 6, by + ch], fill=(255, 255, 255), width=1)

# 4) 왼쪽 작가 원형 이미지 + 캡션
av = Image.open(avatar_p).convert('RGBA').resize((330, 330), Image.LANCZOS)
ax, ay = 140, 740
im.paste(av, (ax, ay), av)
d.text((L, 1112), '《채달금전》, 서귤', font=F('Regular', 34), fill=(176, 186, 212))

# 5) 아래 일정
d.line([L, 1236, W - L, 1236], fill=(98, 112, 156), width=2)
d.text((L, 1262), '11.28 토 오후 4시', font=F('Bold', 38), fill=WHITE)
right = '부천 원미동 비북스 · 회비 10,000원'
d.text((W - L, 1266), right, font=F('Medium', 30), fill=SUB, anchor='ra')
im.save(out, quality=92)
