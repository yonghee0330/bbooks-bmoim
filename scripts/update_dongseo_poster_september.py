#!/usr/bin/env python3
"""동서남북 9월 클래식 감상 모임 포스터 텍스트를 본문과 맞게 수정."""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTER = os.path.join(ROOT, "images", "dongseo_seoga_september.jpg")
F_SANS = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def font(size, index=0):
    return ImageFont.truetype(F_SANS, size, index=index)


def text_w(draw, text, fnt):
    if hasattr(draw, "textlength"):
        return draw.textlength(text, font=fnt)
    return fnt.getsize(text)[0]


def main():
    im = Image.open(POSTER).convert("RGBA")
    w, h = im.size

    # 기존 텍스트 전체 덮기 (상단 뱃지·하단 잔여 텍스트 포함)
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([36, 218, w - 36, 940], fill=(16, 16, 14, 255))
    im = Image.alpha_composite(im, overlay)
    d = ImageDraw.Draw(im)

    white = (255, 255, 255, 255)
    white_dim = (255, 255, 255, 220)
    line_col = (255, 255, 255, 130)

    f_badge = font(22, index=5)
    f_title = font(40, index=5)
    f_sub = font(24)
    f_body = font(28, index=5)
    f_fee = font(26, index=5)
    f_foot = font(18)

    y = 252
    badge = "9월 · 9/19(토)"
    d.text(((w - text_w(d, badge, f_badge)) // 2, y), badge, fill=white_dim, font=f_badge)
    y += 48

    title = "클래식 음악 감상 모임"
    d.text(((w - text_w(d, title, f_title)) // 2, y), title, fill=white, font=f_title)
    y += 54

    sub = "너라면 · 동서남북book"
    d.text(((w - text_w(d, sub, f_sub)) // 2, y), sub, fill=white_dim, font=f_sub)
    y += 40

    d.line([(w // 2 - 120, y), (w // 2 + 120, y)], fill=line_col, width=1)
    y += 28

    for line in [
        "9/19 (토)",
        "오후 2:00 – 4:00",
        "세미나실",
    ]:
        d.text(((w - text_w(d, line, f_body)) // 2, y), line, fill=white, font=f_body)
        y += 38

    y += 6
    fee = "회비 10,000원"
    d.text(((w - text_w(d, fee, f_fee)) // 2, y), fee, fill=white, font=f_fee)
    y += 46

    foot = "b.moim · b.books"
    d.text(((w - text_w(d, foot, f_foot)) // 2, y), foot, fill=white_dim, font=f_foot)

    im.convert("RGB").save(POSTER, "JPEG", quality=92, optimize=True)
    print("updated", POSTER)


if __name__ == "__main__":
    main()
