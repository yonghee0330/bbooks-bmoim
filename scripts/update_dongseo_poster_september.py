#!/usr/bin/env python3
"""동서남북 9월 클래식 감상 모임 포스터 — 사진 배경 + 텍스트 오버레이."""
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "images", "dongseo_seoga_september_source.jpg")
POSTER = os.path.join(ROOT, "images", "dongseo_seoga_september.jpg")
OUT_W, OUT_H = 819, 1024
F_SANS = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def font(size, index=0):
    return ImageFont.truetype(F_SANS, size, index=index)


def text_w(draw, text, fnt):
    if hasattr(draw, "textlength"):
        return draw.textlength(text, font=fnt)
    return fnt.getsize(text)[0]


def main():
    base = ImageOps.fit(
        Image.open(SOURCE).convert("RGB"),
        (OUT_W, OUT_H),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.42),
    ).convert("RGBA")

    w, h = base.size
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    box_top = int(h * 0.34)
    box_bottom = int(h * 0.78)
    od.rectangle([40, box_top, w - 40, box_bottom], fill=(14, 14, 12, 210))
    im = Image.alpha_composite(base, overlay)
    d = ImageDraw.Draw(im)

    white = (255, 255, 255, 255)
    white_dim = (255, 255, 255, 225)
    line_col = (255, 255, 255, 130)

    f_badge = font(24, index=5)
    f_title = font(44, index=5)
    f_sub = font(26)
    f_body = font(30, index=5)
    f_fee = font(28, index=5)
    f_foot = font(19)

    y = box_top + 28
    badge = "9월 · 9/19(토)"
    d.text(((w - text_w(d, badge, f_badge)) // 2, y), badge, fill=white_dim, font=f_badge)
    y += 52

    title = "클래식 음악 감상 모임"
    d.text(((w - text_w(d, title, f_title)) // 2, y), title, fill=white, font=f_title)
    y += 58

    sub = "너라면 · 동서남북book"
    d.text(((w - text_w(d, sub, f_sub)) // 2, y), sub, fill=white_dim, font=f_sub)
    y += 42

    d.line([(w // 2 - 130, y), (w // 2 + 130, y)], fill=line_col, width=1)
    y += 30

    for line in ["9/19 (토)", "오후 2:00 – 4:00", "세미나실"]:
        d.text(((w - text_w(d, line, f_body)) // 2, y), line, fill=white, font=f_body)
        y += 42

    y += 8
    fee = "회비 10,000원"
    d.text(((w - text_w(d, fee, f_fee)) // 2, y), fee, fill=white, font=f_fee)
    y += 48

    foot = "b.moim · b.books"
    d.text(((w - text_w(d, foot, f_foot)) // 2, y), foot, fill=white_dim, font=f_foot)

    im.convert("RGB").save(POSTER, "JPEG", quality=92, optimize=True)
    print("wrote", POSTER)


if __name__ == "__main__":
    main()
