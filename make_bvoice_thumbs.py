#!/usr/bin/env python3
"""b.voice event thumbnails with moim details (date, capacity, fee, intro)."""
from PIL import Image, ImageDraw, ImageFont, ImageStat
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images")
SIZE = 800

DRIVE_REF = os.path.join(OUT, "bvoice_ep02_drive.jpg")
BOOK_REF = os.path.join(OUT, "bvoice_ep03_book.jpg")
ASSET_DRIVE = "/Users/mac/.cursor/projects/Users-mac-Documents-bbooks-bmoim/assets/_______________-cbc275af-191e-48d6-84ba-183494dff0fd.png"
ASSET_BOOK = "/Users/mac/.cursor/projects/Users-mac-Documents-bbooks-bmoim/assets/_______________-aa2c4da0-e70e-4429-856e-3e35e0d61d16.png"

F_SANS = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
F_SERIF = "/System/Library/Fonts/Supplemental/AppleMyungjo.ttf"


def load_ref(path, fallback):
    p = path if os.path.exists(path) else fallback
    return Image.open(p).convert("RGB")


def avg_color(img, box):
    region = img.crop(box)
    stat = ImageStat.Stat(region)
    return tuple(int(x) for x in stat.mean[:3])


def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.load_default()


def text_width(draw, text, fnt):
    if hasattr(draw, "textlength"):
        return draw.textlength(text, font=fnt)
    return fnt.getsize(text)[0]


def wrap_lines(draw, text, fnt, max_width):
    words = text.split()
    if not words:
        return []
    lines = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if text_width(draw, trial, fnt) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, fnt, fill, max_width, line_gap=8):
    x, y = xy
    lines = wrap_lines(draw, text, fnt, max_width)
    for line in lines:
        draw.text((x, y), line, fill=fill, font=fnt)
        y += fnt.size + line_gap
    return y


def draw_info_panel(draw, box, bg, border, lines, label_font, value_font, label_fill, value_fill):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=16, fill=bg, outline=border, width=2)
    y = y0 + 18
    x_label = x0 + 20
    x_value = x0 + 92
    max_value_w = x1 - x_value - 20
    for label, value in lines:
        draw.text((x_label, y), label, fill=label_fill, font=label_font)
        if isinstance(value, list):
            for part in value:
                y = draw_wrapped(draw, (x_value, y), part, value_font, value_fill, max_value_w, line_gap=6)
                y += 2
        else:
            y = draw_wrapped(draw, (x_value, y), value, value_font, value_fill, max_value_w, line_gap=6)
        y += 10


def draw_drive_thumb():
    ref = load_ref(ASSET_DRIVE, DRIVE_REF)
    bg = avg_color(ref, (0, 0, ref.width, int(ref.height * 0.35)))
    bg = tuple(int(bg[i] * 0.85 + c * 0.15) for i, c in enumerate((122, 141, 154)))

    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)

    faint = tuple(int(c * 0.55 + 80) for c in bg)
    f_xs = font(F_SANS, 16)
    d.text((40, 36), "거기로 보내면", fill=faint, font=f_xs)
    w = text_width(d, "이곳에 없는 것", f_xs)
    d.text((SIZE - 40 - w, 36), "이곳에 없는 것", fill=faint, font=f_xs)

    badge_bg = (245, 158, 11)
    f_badge = font(F_SANS, 18)
    badge = "b.voice  EPISODE 02"
    bw = text_width(d, badge, f_badge)
    bx, by = (SIZE - bw) // 2, 78
    d.rounded_rectangle([bx - 16, by - 8, bx + bw + 16, by + 28], radius=16, fill=badge_bg)
    d.text((bx, by), badge, fill=(255, 255, 255), font=f_badge)

    cx, cy = SIZE // 2, 210
    silver = (168, 174, 178)
    dark = (110, 118, 124)
    body = (cx - 130, cy - 24, cx + 130, cy + 30)
    d.rounded_rectangle(body, radius=8, fill=silver, outline=dark, width=2)
    d.polygon([(cx - 62, cy - 24), (cx - 18, cy - 68), (cx + 48, cy - 68), (cx + 86, cy - 24)], fill=silver, outline=dark)
    d.line([(cx - 130, cy - 8), (cx - 162, cy - 46)], fill=dark, width=3)
    d.line([(cx + 130, cy - 6), (cx + 165, cy - 42)], fill=dark, width=3)
    d.rectangle([cx - 98, cy + 28, cx - 72, cy + 36], fill=dark)
    d.rectangle([cx + 72, cy + 28, cx + 98, cy + 36], fill=dark)

    f_ko = font(F_SERIF, 58)
    title = "드라이브"
    tw = text_width(d, title, f_ko)
    d.text(((SIZE - tw) // 2, 300), title, fill=(255, 255, 255), font=f_ko)

    f_en = font(F_SANS, 24)
    en = "D R I V E"
    ew = text_width(d, en, f_en)
    d.text(((SIZE - ew) // 2, 370), en, fill=(230, 236, 240), font=f_en)

    f_sub = font(F_SANS, 21)
    sub = "상영 + 정연 감독 GV"
    sw = text_width(d, sub, f_sub)
    d.text(((SIZE - sw) // 2, 408), sub, fill=(210, 220, 228), font=f_sub)

    f_host = font(F_SANS, 17)
    host = "스튜디오 이상한 나라의 원더랜드 · 정연 감독"
    hw = text_width(d, host, f_host)
    d.text(((SIZE - hw) // 2, 438), host, fill=(190, 200, 210), font=f_host)

    panel_bg = tuple(min(255, c + 18) for c in bg)
    panel_border = tuple(min(255, c + 42) for c in bg)
    label_font = font(F_SANS, 17, index=5)
    value_font = font(F_SANS, 17)
    intro_font = font(F_SANS, 18)
    intro = (
        "영화 <드라이브> 상영 후 정연 감독과 GV. "
        "시나리오·촬영·편집·개봉까지, 영화 제작 이야기를 편하게 나눕니다."
    )
    intro_y = draw_wrapped(
        d, (48, 468), intro, intro_font, (235, 242, 248), SIZE - 96, line_gap=7
    )

    draw_info_panel(
        d,
        (36, intro_y + 8, SIZE - 36, SIZE - 28),
        panel_bg,
        panel_border,
        [
            ("날짜", "7/19(일) 16:00–18:00"),
            ("인원", "15명"),
            ("참가비", "10,000원"),
            ("장소", "비북스 세미나실"),
        ],
        label_font,
        value_font,
        (170, 185, 195),
        (255, 255, 255),
    )

    out = os.path.join(OUT, "bvoice_ep02_drive.jpg")
    img.save(out, "JPEG", quality=88, optimize=True)
    print("wrote", out)


def draw_book_thumb():
    ref = load_ref(ASSET_BOOK, BOOK_REF)
    mx, my = ref.width // 2, ref.height // 2
    red = avg_color(ref, (mx - 80, my - 120, mx + 80, my + 80))
    red = tuple(min(255, int(red[i] * 1.05)) for i in range(3))

    img = Image.new("RGB", (SIZE, SIZE), red)
    d = ImageDraw.Draw(img)

    fold = tuple(min(255, c + 28) for c in red)
    d.line([(0, 0), (SIZE, SIZE)], fill=fold, width=2)
    d.line([(SIZE, 0), (0, SIZE)], fill=fold, width=2)

    f_badge = font(F_SANS, 18)
    badge = "b.voice  EPISODE 03"
    bw = text_width(d, badge, f_badge)
    d.text(((SIZE - bw) // 2, 52), badge, fill=(255, 245, 240), font=f_badge)

    f_title = font(F_SANS, 44)
    part_a = "소중한 "
    part_b = " 에게"
    wa = text_width(d, part_a, f_title)
    wb = text_width(d, part_b, f_title)
    blank_w = 148
    total = wa + blank_w + wb
    x0 = (SIZE - total) // 2
    y0 = 250
    d.text((x0, y0), part_a, fill=(255, 255, 255), font=f_title)
    d.line([(x0 + wa, y0 + 46), (x0 + wa + blank_w, y0 + 46)], fill=(255, 255, 255), width=3)
    d.text((x0 + wa + blank_w, y0), part_b, fill=(255, 255, 255), font=f_title)

    f_ref = font(F_SANS, 20)
    refline = "〈소중한 나에게〉  ·  이유진 작가"
    rw = text_width(d, refline, f_ref)
    d.text(((SIZE - rw) // 2, 360), refline, fill=(255, 240, 235), font=f_ref)

    f_sub = font(F_SANS, 21)
    sub = "북토크"
    sw = text_width(d, sub, f_sub)
    d.text(((SIZE - sw) // 2, 394), sub, fill=(255, 248, 245), font=f_sub)

    f_host = font(F_SANS, 17)
    host = "이유진 서가"
    hw = text_width(d, host, f_host)
    d.text(((SIZE - hw) // 2, 424), host, fill=(255, 235, 230), font=f_host)

    panel_bg = tuple(max(0, c - 18) for c in red)
    panel_border = tuple(min(255, c + 36) for c in red)
    label_font = font(F_SANS, 17, index=5)
    value_font = font(F_SANS, 17)
    intro_font = font(F_SANS, 18)
    intro = (
        "이유진 작가와 함께 〈소중한 나에게〉를 읽고, "
        "나와 소중한 이에게 전하는 편지를 나누는 북토크입니다."
    )
    intro_y = draw_wrapped(
        d, (48, 452), intro, intro_font, (255, 248, 245), SIZE - 96, line_gap=7
    )

    draw_info_panel(
        d,
        (36, intro_y + 8, SIZE - 36, SIZE - 28),
        panel_bg,
        panel_border,
        [
            ("날짜", "7/25(토) 13:00–15:00"),
            ("인원", "15명"),
            ("참가비", "10,000원"),
            ("장소", "비북스 세미나실"),
        ],
        label_font,
        value_font,
        (255, 220, 215),
        (255, 255, 255),
    )

    out = os.path.join(OUT, "bvoice_ep03_book.jpg")
    img.save(out, "JPEG", quality=88, optimize=True)
    print("wrote", out)


if __name__ == "__main__":
    draw_drive_thumb()
    draw_book_thumb()
