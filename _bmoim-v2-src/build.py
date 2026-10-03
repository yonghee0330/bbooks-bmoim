#!/usr/bin/env python3
"""비모임 v2 빌드 — data/*.json(단일 원천) → dist/ (여러 출력)

  python3 build.py            # dist/ 생성
  python3 build.py --serve    # 생성 후 http://localhost:8790 미리보기

출력
  dist/index.html                 허브 (분야 · 상태 · 정렬 · 목록 ⇄ 캘린더)
  dist/m/<slug>/index.html        모임 개별 페이지 (OG + schema.org Event)
  dist/m/<slug>/event.ics         모임별 캘린더 파일
  dist/space/index.html           대관
  dist/host/index.html            모임 개설 신청 + 포스터 규격 안내
  dist/host/dashboard/index.html  호스트 비공개 현황 (#k=토큰)
  dist/my/index.html              내 신청 확인
  dist/cards/index.html           인스타 카드 · QR 생성기
  dist/bmoim.ics                  캘린더 구독 피드
  dist/exports/lineup.txt         블로그·뉴스레터·카톡 채널용 라인업 텍스트
  dist/data/catalog.json          외부 도구용 공개 데이터
  dist/sitemap.xml, robots.txt
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import struct
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
ASSETS = os.path.join(ROOT, 'assets')
SHARE = '--share' in sys.argv  # 공유용(클로드 아티팩트 등): 폴더 주소 대신 index.html, 허용된 폰트만
SHEET = '--sheet' in sys.argv  # 운영 빌드: 구글 시트 연결 + 저장소 루트(moim.bbooks.co.kr/)에 바로 생성
DIST = os.path.abspath(os.path.join(ROOT, '..')) if SHEET else os.path.join(ROOT, 'share' if SHARE else 'dist')
# 운영 사이트 루트에는 기존 host/ 폴더(옛 호스트 현황)가 있어서 '모임 열기'는 open/ 에 둡니다
HOST_DIR = 'open/' if SHEET else 'host/'
DASH_DIR = 'open/status/' if SHEET else 'host/dashboard/'
# 운영 빌드가 루트에 만드는 폴더·파일 (다시 만들기 전에 이것만 지움)
GENERATED = ['m', 'space', 'open', 'my', 'cards', 'assets', 'data', 'exports', 'v2']
KST = timezone(timedelta(hours=9))
WD = '월화수목금토일'
ASSET_VER = datetime.now().strftime('%m%d%H%M')


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


SITE = load('site.json')
if '--sheet' in sys.argv:
    # 저장소 루트의 images/ 폴더를 그대로 사용
    SITE['images']['baseUrl'] = 'images/'
    SITE['baseUrl'] = SITE['sheet'].get('siteUrl', 'https://moim.bbooks.co.kr')
    SITE['indexable'] = SITE['sheet'].get('indexable', True)
    SITE['apiUrl'] = SITE['sheet']['apiUrl']
    SITE['refund']['contact'] = '취소는 ‘내 신청’에서 요청하거나 비북스 인스타그램 DM으로 문의해 주세요.'
    SITE['privacy'].update({
        'items': '이름, 휴대폰 번호, 이메일(선택), 요청사항(선택)',
        'purpose': '모임·대관 신청 접수, 신청번호 발급·조회, 입금 확인, 일정 안내(메일·카카오 알림톡·문자), 취소·환불 처리',
        'hostShare': '모임 개설자(호스트)에게 참가 확인 목적으로 신청자 이름과 연락처가 공유될 수 있습니다.',
        'marketing': '비북스 뉴스레터(이메일)와 문자로 다음 달 비모임·행사 소식을 받습니다. 언제든 수신 거부할 수 있습니다.'})
MOIMS = load('moims.json')
SPACES = load('spaces.json')
BASE = SITE['baseUrl'].rstrip('/')
POSTER = SITE['poster']
TAG_COLORS = MOIMS.get('tagColors', {})


# ── 아이콘 (선 아이콘 하나의 스타일로 통일) ─────────────
def _svg(body):
    return f'<svg class="i" viewBox="0 0 24 24" aria-hidden="true">{body}</svg>'


ICON = {
    'pin': _svg('<path d="M12 21s7-6.1 7-11.5a7 7 0 1 0-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    'clock': _svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    'user': _svg('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.6-4 3.8-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/>'),
    'won': _svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
    'share': _svg('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>'),
    'cal': _svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    'grid': _svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
    'filter': _svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    'insta': _svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/>'),
    'arrow': _svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    'back': _svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    'check': _svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    'ticket': _svg('<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5z"/><path d="M14 6v12" stroke-dasharray="1.5 2"/>'),
    'list': _svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    'map': _svg('<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14"/>'),
}


# ── 포맷 유틸 ─────────────────────────────────────────
def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def dt(s):
    return datetime.strptime(s, '%Y-%m-%dT%H:%M').replace(tzinfo=KST)


def fdate(d):
    return f'{d.month}월 {d.day}일 ({WD[d.weekday()]})'


def fshort(d):
    return f'{d.month}/{d.day}({WD[d.weekday()]})'


def ftime(d):
    return d.strftime('%H:%M')


def won(n):
    return f'{n:,}원'


def iso(d):
    return d.isoformat()


def img_rel(name, rel):
    base = SITE['images']['baseUrl']
    if base.startswith('http'):
        return base.rstrip('/') + '/' + name
    return rel + base + name


def img_abs(name):
    base = SITE['images']['baseUrl']
    if base.startswith('http'):
        return base.rstrip('/') + '/' + name
    return f'{BASE}/{base}{name}'


def page_abs(path=''):
    return f'{BASE}/{path}'


def json_script(obj):
    return json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')


# ── 포스터 규격 검사 ──────────────────────────────────
def image_size(path):
    """PNG/JPEG 헤더에서 가로·세로 픽셀 읽기 (외부 라이브러리 없이)"""
    try:
        with open(path, 'rb') as f:
            head = f.read(26)
            if head[:8] == b'\x89PNG\r\n\x1a\n':
                return struct.unpack('>II', head[16:24])
            if head[:2] != b'\xff\xd8':
                return None
            f.seek(2)
            while True:
                b = f.read(1)
                while b and b != b'\xff':
                    b = f.read(1)
                while b == b'\xff':
                    b = f.read(1)
                if not b:
                    return None
                marker = b[0]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)
                    h, w = struct.unpack('>HH', f.read(4))
                    return w, h
                seg = struct.unpack('>H', f.read(2))[0]
                f.seek(seg - 2, 1)
    except (OSError, struct.error):
        return None


def image_src_dir():
    src = SITE['images'].get('copyFrom')
    if not src:
        return None
    return src if os.path.isabs(src) else os.path.join(ROOT, src)


POSTER_INFO = {}


def poster_info(name):
    """규격(4:5)에 맞으면 cover, 아니면 contain(+흐린 배경)"""
    if name in POSTER_INFO:
        return POSTER_INFO[name]
    d = image_src_dir()
    size = image_size(os.path.join(d, name)) if d else None
    target = POSTER['width'] / POSTER['height']
    info = {'size': size, 'ok': True, 'fit': 'cover', 'kb': None}
    if size:
        ratio = size[0] / size[1]
        info['ok'] = abs(ratio - target) <= POSTER['tolerance'] and size[0] >= POSTER['width'] * 0.75
        info['fit'] = 'cover' if abs(ratio - target) <= POSTER['tolerance'] else 'contain'
        try:
            info['kb'] = os.path.getsize(os.path.join(d, name)) // 1024
        except OSError:
            pass
    POSTER_INFO[name] = info
    return info


def fit_of(it):
    return it.get('posterFit') or poster_info(it['poster'])['fit']


def cat_color(it):
    if it['kind'] == 'event':
        return TAG_COLORS.get('_event', '#1F2633')
    for t in it.get('tags', []):
        if t in TAG_COLORS:
            return TAG_COLORS[t]
    return '#555555'


# ── 데이터 정규화 ─────────────────────────────────────
def occurrences(item):
    out = []
    for s in item['sessions']:
        for d in s['dates']:
            out.append({'session': s['id'], 'start': dt(d['start']), 'end': dt(d['end']), 'space': d['space']})
    return sorted(out, key=lambda o: o['start'])


def date_text(item, long=True):
    occ = occurrences(item)
    if len(occ) == 1:
        o = occ[0]
        return f'{fdate(o["start"]) if long else fshort(o["start"])} {ftime(o["start"])}–{ftime(o["end"])}'
    times = {(ftime(o['start']), ftime(o['end'])) for o in occ}
    days = ' · '.join(fshort(o['start']) for o in occ)
    if len(times) == 1:
        a, b = times.pop()
        return f'{days} {a}–{b}'
    return days


def card_date(item):
    """카드용 (도서 목록 카드 표기): 10.15 (목) 19:00  /  10.25 · 11.29 · 12.27 (일) 16:00"""
    occ = occurrences(item)
    o = occ[0]
    if len(occ) == 1:
        return f'{o["start"].month}.{o["start"].day:02d} ({WD[o["start"].weekday()]}) {ftime(o["start"])}'
    wds = {x['start'].weekday() for x in occ}
    days = ' · '.join(f'{x["start"].month}.{x["start"].day:02d}' for x in occ)
    wd = f' ({WD[wds.pop()]})' if len(wds) == 1 else ''
    return f'{days}{wd} {ftime(o["start"])}'


def space_text(item):
    seen = []
    for o in occurrences(item):
        if o['space'] not in seen:
            seen.append(o['space'])
    return ' · '.join(seen)


def price_text(item):
    prices = sorted({s['price'] for s in item['sessions']} | {p['price'] for p in item.get('packages', [])})
    if len(prices) == 1:
        return won(prices[0])
    return f'{won(prices[0])}~'


def capacity_text(item):
    caps = {s['capacity'] for s in item['sessions']}
    if len(caps) == 1:
        c = caps.pop()
        return f'{c}명' if len(item['sessions']) == 1 else f'회차별 {c}명'
    return '회차별 상이'


def kind_label(it):
    if it['kind'] == 'event':
        return '행사'
    if it.get('regular'):
        return '정기 모임'
    if '챌린지' in it.get('tags', []):
        return '챌린지'
    return '비모임'


def strip_text(it):
    if it.get('partner'):
        return it['partner']
    return ' · '.join(it.get('tags', [])[:2])


def blocks():
    """대관 차단 구간 — 모임·행사 일정에서 자동 생성"""
    out = []
    for it in MOIMS['items']:
        if it.get('status') == 'hidden':
            continue
        for o in occurrences(it):
            out.append({'date': o['start'].strftime('%Y-%m-%d'), 'space': o['space'],
                        'start': ftime(o['start']), 'end': ftime(o['end']), 'tag': it['title']})
    return sorted(out, key=lambda b: (b['date'], b['start']))


ITEMS = sorted([i for i in MOIMS['items'] if i.get('status') != 'hidden'],
               key=lambda i: occurrences(i)[0]['start'])


def catalog():
    cfg = {k: SITE[k] for k in ('siteName', 'baseUrl', 'apiUrl', 'kakaoJsKey', 'testNow', 'bank',
                                'payDeadlineHours', 'refund', 'privacy', 'store', 'month', 'demo', 'poster')}
    cfg['imageBase'] = SITE['images']['baseUrl']
    cfg['indexFile'] = 'index.html' if SHARE else ''
    if SHEET:
        cfg['apiMode'] = 'sheet'
        cfg['sheet'] = SITE['sheet']
    items = []
    for it in ITEMS:
        c = {k: v for k, v in it.items() if not k.startswith('_')}
        c['url'] = f'm/{it["slug"]}/'
        c['dateText'] = date_text(it, long=False)
        c['cardDate'] = card_date(it)
        c['spaceText'] = space_text(it)
        c['priceText'] = price_text(it)
        c['fit'] = fit_of(it)
        c['color'] = cat_color(it)
        c['kindLabel'] = kind_label(it)
        items.append(c)
    return {'config': cfg, 'tags': MOIMS['tags'], 'tagColors': TAG_COLORS, 'items': items, 'spaces': SPACES, 'blocks': blocks()}


CATALOG = catalog()


# ── 공통 레이아웃 ─────────────────────────────────────
NAV = [('hub', '', '이번 달 모임'), ('cal', '#cal', '일정 달력'), ('space', 'space/', '공간 대관'), ('host', HOST_DIR, '모임 열기')]


def layout(*, page_id, title, desc, body, depth, path, og_image=None, og_type='website',
           jsonld=None, private=False, extra_scripts=(), head_extra='', after_main=''):
    rel = '../' * depth
    index = SITE['indexable'] and not private
    og_image = og_image or img_abs(SITE['month']['heroImage'])
    active = 'hub' if page_id == 'detail' else ('host' if page_id == 'dashboard' else page_id)

    def nav_href(href):
        if href.startswith('#'):
            return f'{rel}./{href}' if rel else href
        return f'{rel}{href or "./"}'
    nav = ''.join(
        f'<a class="nav{" on" if pid == active else ""}" data-nav="{pid}" href="{nav_href(href)}"{" aria-current=page" if pid == active else ""}>{label}</a>'
        for pid, href, label in NAV)
    ld = f'<script type="application/ld+json" id="jsonld">{json_script(jsonld)}</script>' if jsonld else ''
    scripts = ''.join(f'<script src="{rel}assets/{s}?v={ASSET_VER}" defer></script>' for s in ('app.js',) + tuple(extra_scripts))
    st = SITE['store']
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="{"index,follow" if index else "noindex,nofollow"}">
<link rel="canonical" href="{esc(page_abs(path))}">
<meta property="og:site_name" content="{esc(SITE["siteName"])}">
<meta property="og:locale" content="ko_KR">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(page_abs(path))}">
<meta property="og:image" content="{esc(og_image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Noto+Serif+KR:wght@600;700&display=swap">
<link rel="stylesheet" href="{rel}assets/app.css?v={ASSET_VER}">
<link rel="alternate" type="text/calendar" title="비북스 b.moim 일정" href="{rel}bmoim.ics">
{head_extra}{ld}
</head>
<body data-page="{page_id}" data-rel="{rel}">
<a class="skip" href="#main">본문 바로가기</a>
<header class="gnb">
  <div class="gnb-in">
    <a class="logo" href="{rel}./"><span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="logo-ko">비북스</span><span class="logo-en">b<i>.</i>moim</span></a>
    <nav class="gnb-nav" aria-label="주요 메뉴">{nav}</nav>
    <a class="gnb-my{" on" if page_id == "my" else ""}" href="{rel}my/">{ICON["ticket"]}<span>내 신청</span></a>
  </div>
</header>
<div id="demoBar"></div>
{body}
<footer class="foot">
  <div class="foot-in">
    <p class="foot-brand"><span class="logo-ko">비북스</span> <span class="logo-en">b<i>.</i>moim</span></p>
    <p>{esc(st["address"])}</p>
    <p class="foot-links"><a href="https://instagram.com/{esc(st["instagram"])}" target="_blank" rel="noopener">인스타그램 @{esc(st["instagram"])}</a><a href="{rel}bmoim.ics">캘린더 구독</a><a href="{rel}my/">내 신청 확인</a><a href="{rel}host/">모임 열기</a><a href="#privacy" data-open-privacy>개인정보 처리 안내</a></p>
  </div>
</footer>
{after_main}
<script id="catalog" type="application/json">{json_script(CATALOG)}</script>
{scripts}
</body>
</html>
'''


def page_head(eyebrow, title, desc, extra=''):
    return f'''
  <section class="page-head">
    {f'<p class="eyebrow">{esc(eyebrow)}</p>' if eyebrow else ''}
    <h1 class="page-title">{esc(title)}</h1>
    {f'<p class="page-desc">{desc}</p>' if desc else ''}
    {extra}
  </section>'''


# ── 카드 ────────────────────────────────────────────
def moim_card(it, rel):
    """도서 목록 카드: 왼쪽 책등 색 · 포스터 · 오른쪽 위 책갈피 · 목록표(일시/장소/참가비)"""
    fit = fit_of(it)
    src = esc(img_rel(it['poster'], rel))
    bg = f'<img class="card-bg" src="{src}" alt="" aria-hidden="true" loading="lazy">' if fit == 'contain' else ''
    occ = occurrences(it)
    label = it.get('partner') if it.get('partner') else ' · '.join(it.get('tags', [])[:2])
    return f'''
<article class="card" data-slug="{esc(it["slug"])}" style="--cat:{cat_color(it)}">
  <a class="card-link" href="{rel}m/{esc(it["slug"])}/">
    <div class="card-media fit-{fit}">
      {bg}<img class="card-img" src="{src}" alt="{esc(it["title"])} 포스터" loading="lazy">
      <span class="ribbon" data-badge hidden></span>
      <span class="card-dim" data-dim hidden></span>
    </div>
    <div class="card-body">
      <p class="card-cat"><span class="card-kind">{esc(kind_label(it))}</span><span class="card-tags">{esc(label)}</span></p>
      <h3 class="card-title">{esc(it["title"])}</h3>
      <p class="card-host">{esc(it["host"]["name"])}</p>
      <dl class="card-rows">
        <div><dt>일시</dt><dd><time datetime="{iso(occ[0]["start"])}">{esc(card_date(it))}</time></dd></div>
        <div><dt>장소</dt><dd>{esc(space_text(it))}</dd></div>
        <div><dt>참가비</dt><dd><b>{esc(price_text(it))}</b></dd></div>
      </dl>
      <p class="card-foot"><span class="seats" data-seats>정원 {esc(capacity_text(it))}</span></p>
    </div>
  </a>
</article>'''


def refund_block(materials):
    rows = SITE['refund']['materials' if materials else 'noMaterials']
    kind = '재료 준비가 있는 모임' if materials else '재료 준비가 없는 모임'
    lis = ''.join(f'<li>{esc(r)}</li>' for r in rows)
    return f'<p class="refund-kind">{kind}</p><ul class="refund-list">{lis}</ul><p class="muted small">{esc(SITE["refund"]["contact"])}</p>'


# ── 허브 ────────────────────────────────────────────
SPINE_H = [100, 88, 94, 82, 97, 86, 91, 84]  # 책등 높이(%) — 서가처럼 들쭉날쭉하게


def build_hub():
    rel = ''
    m = SITE['month']
    n_moim = sum(1 for i in ITEMS if i['kind'] == 'moim')
    n_event = sum(1 for i in ITEMS if i['kind'] == 'event')
    y, mo = m['key'].split('-')

    # 분야 = 서가에 꽂힌 책등
    spines = [f'<button type="button" class="spine on" data-cat="all" aria-pressed="true" style="--cat:#2b211b;--h:{SPINE_H[0]}%"><span class="spine-t">전체</span><span class="spine-n">{len(ITEMS)}</span></button>']
    k = 1
    for t in MOIMS['tags']:
        n = sum(1 for i in ITEMS if t in i.get('tags', []))
        if not n:
            continue
        spines.append(f'<button type="button" class="spine" data-cat="{esc(t)}" aria-pressed="false" style="--cat:{TAG_COLORS.get(t, "#555")};--h:{SPINE_H[k % len(SPINE_H)]}%"><span class="spine-t">{esc(t)}</span><span class="spine-n">{n}</span></button>')
        k += 1

    cards = ''.join(moim_card(i, rel) for i in ITEMS)
    desc = f'{m["title"]} — 부천 원미동 독립서점 비북스의 독서모임·글쓰기·음악·어린이 모임 {n_moim}개와 행사 {n_event}개. 일정 확인과 신청을 한 곳에서.'
    body = f'''
<main id="main" class="wrap">
  <section class="hub-head">
    <div class="hub-copy">
      <p class="eyebrow">이달의 서가 · {y}.{mo}</p>
      <h1 class="page-title">{esc(m["title"])}</h1>
      <p class="page-desc">{esc(m["sub"])}<br>{esc(m.get("desc", ""))}</p>
    </div>
    <dl class="stamp">
      <div><dt>모임</dt><dd>{n_moim}</dd></div>
      <div><dt>행사</dt><dd>{n_event}</dd></div>
      <div><dt>모집 중</dt><dd data-stat="seats">–</dd></div>
    </dl>
  </section>

  <nav class="shelf" aria-label="분야별로 보기">
    <p class="shelf-label">분야별로 꺼내 보기</p>
    <div class="shelf-row">{"".join(spines)}</div>
  </nav>

  <div class="itabs" role="group" aria-label="신청 상태">
    <button type="button" class="itab on" data-status="open" aria-pressed="true">모집 중 <b data-count="open"></b></button>
    <button type="button" class="itab" data-status="all" aria-pressed="false">이번 달 전체 <b data-count="all">{len(ITEMS)}</b></button>
    <button type="button" class="itab" data-status="closed" aria-pressed="false">마감·지난 모임 <b data-count="closed"></b></button>
  </div>

  <div class="toolbar" id="toolbar">
    <label class="sortsel"><span>정렬</span>
      <select data-sort-select aria-label="정렬">
        <option value="date">빠른 날짜순</option>
        <option value="hot">마감 임박 순</option>
        <option value="price">낮은 가격순</option>
      </select>
    </label>
    <div class="whens" role="group" aria-label="언제">
      <button type="button" class="when" data-when="week" aria-pressed="false">이번 주</button>
      <button type="button" class="when" data-when="weekend" aria-pressed="false">주말</button>
      <button type="button" class="when" data-when="evening" aria-pressed="false">평일 저녁</button>
    </div>
    <div class="viewsw" role="group" aria-label="보기 방식">
      <button type="button" class="vs on" data-view="list" aria-pressed="true">{ICON["list"]}<span>목록</span></button>
      <button type="button" class="vs" data-view="cal" aria-pressed="false">{ICON["cal"]}<span>일정 달력</span></button>
    </div>
  </div>

  <section id="viewList" class="grid" aria-label="모임 목록">{cards}
  </section>
  <div class="empty" id="emptyNote" hidden><p>조건에 맞는 모임이 없어요.</p><button type="button" class="btn ghost sm" data-show-all>이번 달 전체 보기</button></div>
  <section id="viewCal" class="calbox" aria-label="모임 전체 일정 달력" hidden></section>

  <section class="guide" aria-labelledby="guideH">
    <h2 class="sec-title" id="guideH">비모임 이용 안내</h2>
    <div class="guide-grid">
      <div class="guide-card">
        <h3>환불 규정</h3>
        <p class="refund-kind">재료 준비가 있는 모임</p>
        <ul class="refund-list">{"".join(f"<li>{esc(r)}</li>" for r in SITE["refund"]["materials"])}</ul>
        <p class="refund-kind">재료 준비가 없는 모임</p>
        <ul class="refund-list">{"".join(f"<li>{esc(r)}</li>" for r in SITE["refund"]["noMaterials"])}</ul>
      </div>
      <a class="guide-card link" href="space/">
        <h3>공간 대관</h3>
        <p>세미나실 · 매장 테이블 · 계단 좌석 · 1인실 · 전체 대관. 사진과 요금을 보고 바로 시간을 골라 신청하세요.</p>
        <span class="go">대관 보러 가기 {ICON["arrow"]}</span>
      </a>
      <a class="guide-card link" href="{HOST_DIR}">
        <h3>모임 열기</h3>
        <p>비북스에서 나만의 모임을 열어 보세요. 공간·신청 관리·홍보 페이지를 함께 준비합니다.</p>
        <span class="go">개설 신청하기 {ICON["arrow"]}</span>
      </a>
      <a class="guide-card link" href="bmoim.ics">
        <h3>캘린더 구독</h3>
        <p>휴대폰·구글 캘린더에 비모임 일정을 구독해 두면 새 모임이 자동으로 들어와요.</p>
        <span class="go">구독 링크 열기 {ICON["arrow"]}</span>
      </a>
    </div>
  </section>
</main>'''
    jsonld = [
        {
            '@context': 'https://schema.org', '@type': 'BookStore',
            'name': f'{SITE["store"]["name"]} ({SITE["store"]["nameEn"]})', 'url': page_abs(''),
            'image': img_abs(m['heroImage']),
            'address': postal_address(),
            'sameAs': [f'https://instagram.com/{SITE["store"]["instagram"]}'],
        },
        {
            '@context': 'https://schema.org', '@type': 'ItemList', 'name': m['title'],
            'itemListElement': [
                {'@type': 'ListItem', 'position': n + 1, 'url': page_abs(f'm/{i["slug"]}/'), 'name': i['title']}
                for n, i in enumerate(ITEMS)],
        },
    ]
    write('index.html', layout(page_id='hub', title=f'{m["title"]} · 비북스 b.moim', desc=desc, body=body,
                               depth=0, path='', jsonld=jsonld))


def postal_address():
    s = SITE['store']
    return {'@type': 'PostalAddress', 'streetAddress': s['streetAddress'], 'addressLocality': s['locality'],
            'addressRegion': s['region'], 'addressCountry': s['country']}


# ── 개별 페이지 ─────────────────────────────────────
def event_jsonld(it):
    url = page_abs(f'm/{it["slug"]}/')
    host = it['host']
    out = []
    occ = occurrences(it)
    sessions = {s['id']: s for s in it['sessions']}
    for o in occ:
        s = sessions[o['session']]
        name = it['title'] if len(occ) == 1 else f'{it["title"]} ({fshort(o["start"])})'
        out.append({
            '@context': 'https://schema.org', '@type': 'Event',
            'name': name,
            'description': it.get('summary') or it.get('oneLiner', ''),
            'startDate': iso(o['start']), 'endDate': iso(o['end']),
            'eventStatus': 'https://schema.org/EventScheduled',
            'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
            'location': {'@type': 'Place', 'name': f'{SITE["store"]["name"]} {SITE["store"]["nameEn"]} · {o["space"]}',
                         'address': postal_address()},
            'image': [img_abs(it['poster'])],
            'organizer': {'@type': 'Organization', 'name': f'{SITE["store"]["name"]} ({SITE["store"]["nameEn"]})', 'url': page_abs('')},
            'performer': {'@type': 'PerformingGroup' if '·' in host['name'] else 'Person', 'name': host['name']},
            'offers': {'@type': 'Offer', 'price': s['price'], 'priceCurrency': 'KRW',
                       'availability': 'https://schema.org/InStock', 'url': it.get('applyUrl') or url},
            'maximumAttendeeCapacity': s['capacity'],
            'inLanguage': 'ko',
            'url': url,
        })
    return out


def build_detail(it, others):
    rel = '../../'
    slug = it['slug']
    occ = occurrences(it)
    price_label = it.get('priceLabel', '참가비')
    host = it['host']
    color = cat_color(it)

    multi_space = len(set(x['space'] for x in occ)) > 1
    when = ''.join(
        f'<li><time datetime="{iso(o["start"])}">{fdate(o["start"])} {ftime(o["start"])}–{ftime(o["end"])}</time>'
        f'{" · " + esc(o["space"]) if multi_space else ""}</li>' for o in occ)
    if it.get('period'):
        when = f'<li class="muted">{esc(it["period"])}</li>' + when
    if it.get('regular'):
        when += f'<li class="muted">{esc(it["regular"])}</li>'
    price_rows = ''.join(
        f'<li>{esc(s.get("name") or fshort(dt(s["dates"][0]["start"])))} · <b>{won(s["price"])}</b></li>' for s in it['sessions']) if (len(it['sessions']) > 1 or it.get('packages')) else ''
    price_rows += ''.join(f'<li>{esc(p["name"])} · <b>{won(p["price"])}</b></li>' for p in it.get('packages', []))
    price_html = f'<b>{esc(price_text(it))}</b>'
    if price_rows:
        price_html += f'<ul class="plain small">{price_rows}</ul>'
    if it.get('priceNote'):
        price_html += ('' if price_rows else ' ') + f'<small class="muted">{esc(it["priceNote"])}</small>'

    highlights = ''
    if it.get('highlights'):
        highlights = '<dl class="hl">' + ''.join(
            f'<div><dt>{esc(h["label"])}</dt><dd>{esc(h["value"])}</dd></div>' for h in it['highlights']) + '</dl>'
    notes = ''
    if it.get('notes'):
        notes = '<ul class="notes">' + ''.join(f'<li>{esc(n)}</li>' for n in it['notes']) + '</ul>'
    temp = '<p class="poster-note">임시 포스터 · 확정 포스터로 곧 교체돼요</p>' if it.get('posterTemp') else ''
    contact = f'<div><dt>문의</dt><dd>{esc(it["contact"])}</dd></div>' if it.get('contact') else ''
    insta = f'<a class="btn outline sm" href="https://instagram.com/{esc(host["insta"])}" target="_blank" rel="noopener">{ICON["insta"]} @{esc(host["insta"])}</a>' if host.get('insta') else ''

    if it.get('applyUrl'):
        apply_btn = f'<a class="btn primary" href="{esc(it["applyUrl"])}" target="_blank" rel="noopener" data-apply-ext>{esc(it.get("applyLabel", "신청하러 가기"))}</a>'
        apply_note = '이 행사는 파트너 페이지에서 신청합니다.'
    else:
        apply_btn = '<button type="button" class="btn primary" data-apply>신청하기</button>'
        apply_note = f'신청하면 신청번호가 나와요 · {SITE["payDeadlineHours"]}시간 안에 입금하면 확정' if SHEET else f'신청 후 {SITE["payDeadlineHours"]}시간 안에 입금하면 확정돼요 · 알림톡·메일로 안내'

    # 판권면 표기 (일시)
    if len(occ) == 1:
        o = occ[0]
        when_short = f'{fdate(o["start"])} {ftime(o["start"])}–{ftime(o["end"])}'
    else:
        when_short = f'{card_date(it)} 시작 · 총 {len(occ)}회'
    others_html = ''.join(moim_card(o, rel) for o in others)
    tags_html = ''.join(f'<span class="tagchip" style="--cat:{TAG_COLORS.get(t, "#555")}">{esc(t)}</span>' for t in it.get('tags', [])[:2])
    host_sec = ''
    if host.get('bio') or host.get('insta'):
        host_sec = f"""
  <section class="d-sec">
    <h2>호스트 소개</h2>
    <div class="author">
      <span class="host-ava" aria-hidden="true">{esc(host["name"].lstrip("@")[:1])}</span>
      <div class="author-txt"><b>{esc(host["name"])}</b>{f'<p>{esc(host["bio"])}</p>' if host.get("bio") else ''}</div>
      {insta}
    </div>
  </section>"""
    body = f"""
<main id="main" class="wrap detail" data-slug="{esc(slug)}" style="--cat:{color}">
  <a class="back" href="{rel}./">{ICON["back"]} {esc(SITE["month"]["title"])}</a>

  <div class="d-grid">
    <div class="d-left">
      <button type="button" class="d-poster" data-zoom="{esc(img_rel(it["poster"], rel))}" aria-label="포스터 크게 보기">
        <img src="{esc(img_rel(it["poster"], rel))}" alt="{esc(it["title"])} 포스터">
        <span class="ribbon" data-badge hidden></span>
      </button>
      {temp}
    </div>
    <div class="d-main">
      <p class="d-cat"><span class="d-kind">{esc(kind_label(it))}</span>{tags_html}{f'<span class="muted small">{esc(it["partner"])}</span>' if it.get("partner") else ""}</p>
      <h1 class="d-title">{esc(it["title"])}</h1>
      <p class="d-one">{esc(it.get("oneLiner", ""))}</p>
      <dl class="colophon">
        <div><dt>일시</dt><dd>{esc(when_short)}</dd></div>
        <div><dt>장소</dt><dd>비북스 {esc(space_text(it))}</dd></div>
        <div><dt>대상</dt><dd>{esc(it.get("audience", "누구나"))}</dd></div>
        <div><dt>정원</dt><dd>{esc(capacity_text(it))}</dd></div>
        <div><dt>{esc(price_label)}</dt><dd>{price_html}</dd></div>
        <div><dt>호스트</dt><dd>{esc(host["name"])}</dd></div>
      </dl>
      <div class="seatbar" data-seatbar hidden><div class="seatbar-top"><b data-seat-text></b><span data-seat-sub></span></div><div class="seatbar-track"><i data-seat-fill></i></div></div>
      <div class="d-tools">
        <button type="button" class="btn outline" data-addcal>{ICON["cal"]} 캘린더에 추가</button>
        <button type="button" class="btn outline" data-share>{ICON["share"]} 공유하기</button>
      </div>
    </div>
  </div>

  <section class="d-sec">
    <h2>모임 소개</h2>
    <div class="d-body">{"".join(f"<p>{esc(p)}</p>" for p in it.get("body", []))}</div>
    {highlights}
    {notes}
  </section>
  {host_sec}

  <section class="d-sec" id="sessions" {"hidden" if it.get("applyUrl") else ""}>
    <h2>회차 · 남은 자리</h2>
    <div class="sess-list" data-sessions></div>
  </section>

  <section class="d-sec">
    <h2>일시와 장소</h2>
    <dl class="facts">
      <div><dt>일시</dt><dd><ul class="plain">{when}</ul></dd></div>
      <div><dt>장소</dt><dd>비북스 · {esc(space_text(it))}<br><small class="muted">{esc(SITE["store"]["address"])}</small><br><a class="link" href="{esc(SITE["store"]["mapUrl"])}" target="_blank" rel="noopener">네이버 지도에서 보기</a></dd></div>
      {contact}
    </dl>
  </section>

  <section class="d-sec">
    <h2>환불 규정</h2>
    {refund_block(it.get("materials"))}
  </section>

  <section class="d-sec more">
    <h2>이번 달 서가의 다른 모임</h2>
    <div class="grid grid-3">{others_html}</div>
  </section>
</main>"""
    cta = f'''
<div class="cta-bar" data-cta>
  <div class="cta-in">
    <div class="cta-info"><b class="cta-title">{esc(it["title"])}</b><span class="cta-sub"><b>{esc(price_text(it))}</b><span class="cta-sep"> · </span><span data-cta-state>{esc(date_text(it, long=False))}</span></span></div>
    <div class="cta-btns">
      <button type="button" class="btn icon" data-share aria-label="공유하기">{ICON["share"]}</button>
      {apply_btn}
    </div>
  </div>
  <p class="cta-note">{esc(apply_note)}</p>
</div>'''
    title = f'{it["title"]} · {date_text(it, long=False)} | 비북스 b.moim'
    desc = it.get('summary') or it.get('oneLiner', '')
    write(f'm/{slug}/index.html', layout(page_id='detail', title=title, desc=desc, body=body, depth=2,
                                          path=f'm/{slug}/', og_image=img_abs(it['poster']), og_type='article',
                                          jsonld=event_jsonld(it), after_main=cta))
    write(f'm/{slug}/event.ics', ics([it], name=it['title']))


# ── 대관 ────────────────────────────────────────────
SPACE_SLUG = {'세미나실': 'seminar', '매장 테이블': 'table', '계단 좌석': 'stairs', '1인실': 'solo', '전체 대관': 'whole'}


def photo_is_portrait(src):
    d = image_src_dir()
    size = image_size(os.path.join(d, src)) if d else None
    return bool(size and size[1] > size[0])


def price_dd_daypass(sp):
    """2시간권 + 종일권(할인가) 표기"""
    pr = sp['pricing']
    dp = pr['dayPass']
    regular = f'<del>{won(dp["regular"])}</del>' if dp.get('regular') else ''
    label = f'<em>{esc(dp["label"])}</em>' if dp.get('label') else ''
    return (f'<div><dt>요금</dt><dd><b>{pr["blockHours"]}시간 {won(pr["unit"])}</b>'
            f'<span class="daypass"><span class="dp-name">종일권 {esc(dp["from"])}–{esc(dp["to"])}</span>'
            f'{regular}<b>{won(dp["price"])}</b>{label}</span></dd></div>')


def build_space():
    rel = '../'
    h = SPACES['hours']
    spaces = SPACES['spaces']
    hero = SPACES.get('heroPhotos') or {}

    # ① 첫 화면: 사진 모자이크 (큰 사진 1 + 공간별 4)
    tiles = ''.join(
        f'<a class="sh-tile" href="#sp-{slug}"><img src="{esc(img_rel(src, rel))}" alt="{esc(label)}" loading="lazy"><span>{esc(label)}</span></a>'
        for slug, label, src in hero.get('tiles', []))
    min_p = min(sp['maxPeople'] for sp in spaces)
    max_p = max(sp['maxPeople'] for sp in spaces)
    main_src = hero.get('main') or spaces[-1]['photos'][0]['src']
    intro = SPACES.get('intro') or {}
    kw = ''.join(f'<span>{esc(k)}</span>' for k in intro.get('keywords', []))
    hero_html = (
        '<section class="space-hero">'
        '<div class="sh-copy">'
        f'<p class="eyebrow">{esc(intro.get("eyebrow", "Space · 공간 대관"))}</p>'
        + (f'<p class="sh-kw">{kw}</p>' if kw else '') +
        f'<h1 class="page-title">{intro.get("title", "공간 대관")}</h1>'
        f'<p class="page-desc">{esc(intro.get("desc", ""))}</p>'
        f'<ul class="sh-facts"><li><b>{len(spaces)}</b>곳의 공간</li><li><b>{min_p}~{max_p}</b>인</li>'
        f'<li><b>{esc(h["open"])}–{esc(h["close"])}</b></li><li><b>30분</b> 단위 예약</li></ul>'
        '<div class="sh-cta"><a class="btn primary" href="#book">예약하러 가기</a><a class="btn outline" href="#priceH">요금 보기</a></div>'
        '</div>'
        '<div class="sh-mosaic">'
        f'<a class="sh-main" href="#sp-whole"><img src="{esc(img_rel(main_src, rel))}" alt="비북스 매장 전체" fetchpriority="high"><span>매장 전체</span></a>'
        f'{tiles}'
        '</div></section>')

    # 비북스에서 모이면 좋은 점 + 기본 제공
    perks = ''.join(f'<li><b>{esc(x["t"])}</b><span>{esc(x["d"])}</span></li>' for x in intro.get('perks', []))
    amen = ''.join(f'<li>{ICON["check"]}{esc(x)}</li>' for x in intro.get('amenities', []))
    why_html = ('<section class="space-why" aria-labelledby="whyH">'
                '<h2 class="sec-title" id="whyH">비북스에서 모이면 좋은 점</h2>'
                f'<ol class="why-list">{perks}</ol>'
                '<div class="amenities"><p class="am-title">기본으로 드려요</p>'
                f'<ul>{amen}</ul><p class="muted small">{esc(intro.get("amenitiesNote", ""))}</p></div>'
                '</section>') if perks else ''

    # 공간별로 실제 열린 비모임 (모임 데이터에서 자동)
    held = {}
    for it in ITEMS:
        for o in occurrences(it):
            lst = held.setdefault(o['space'], [])
            if it['slug'] not in [x['slug'] for x in lst]:
                lst.append(it)

    # ② 공간 바로가기
    jump = ''
    for sp in spaces:
        slug = SPACE_SLUG.get(sp['id'], 'x')
        th = sp['photos'][0].get('thumb', sp['photos'][0]['src'])
        new = ' <i>NEW</i>' if sp.get('new') else ''
        jump += (f'<a class="sj" href="#sp-{slug}"><img src="{esc(img_rel(th, rel))}" alt="" loading="lazy">'
                 f'<span><b>{esc(sp["name"])}{new}</b><small>최대 {sp["maxPeople"]}인 · {esc(sp["priceText"])}</small></span></a>')

    # ③ 공간별 쇼케이스 (큰 사진 + 썸네일 + 정보)
    shows = ''
    for n, sp in enumerate(spaces):
        slug = SPACE_SLUG.get(sp['id'], f'sp{n}')
        photos = sp['photos']
        first = photos[0]
        thumbs = ''
        for i, p in enumerate(photos):
            thumbs += (f'<button type="button" class="sc-th{" on" if i == 0 else ""}" data-i="{i}" '
                       f'data-src="{esc(img_rel(p["src"], rel))}" data-cap="{esc(p["caption"])}" '
                       f'data-portrait="{1 if photo_is_portrait(p["src"]) else 0}" aria-label="{esc(p["caption"])}">'
                       f'<img src="{esc(img_rel(p.get("thumb", p["src"]), rel))}" alt="" loading="lazy"></button>')
        feats = ''.join(f'<li>{ICON["check"]}{esc(f)}</li>' for f in sp['features'])
        portrait = ' is-portrait' if photo_is_portrait(first['src']) else ''
        rev = ' rev' if n % 2 else ''
        new = ' <i>NEW</i>' if sp.get('new') else ''
        shows += (
            f'<section class="showcase{rev}" id="sp-{slug}" data-space="{esc(sp["id"])}" aria-labelledby="h-{slug}">'
            '<div class="sc-gallery">'
            f'<button type="button" class="sc-main{portrait}" data-gallery-open aria-label="{esc(sp["name"])} 사진 크게 보기">'
            f'<img class="sc-bg" src="{esc(img_rel(first["src"], rel))}" alt="" aria-hidden="true">'
            f'<img class="sc-img" src="{esc(img_rel(first["src"], rel))}" alt="{esc(first["caption"])}" loading="lazy">'
            f'<span class="sc-cap">{esc(first["caption"])}</span><span class="sc-count">1 / {len(photos)}</span></button>'
            f'<div class="sc-thumbs">{thumbs}</div>'
            '</div>'
            '<div class="sc-info">'
            f'<p class="sc-kicker">{esc(sp["name"])}{new}</p>'
            f'<h2 class="sc-title" id="h-{slug}">{esc(sp.get("tagline", sp["name"]))}</h2>'
            f'<p class="sc-desc">{esc(sp["desc"])}</p>'
            '<dl class="sc-facts">'
            f'<div><dt>인원</dt><dd>최대 <b>{sp["maxPeople"]}</b>인</dd></div>'
            + (price_dd_daypass(sp) if (sp.get('pricing') or {}).get('dayPass') else
               f'<div><dt>요금</dt><dd><b>{esc(sp["priceText"])}</b> <small>{esc(sp["priceUnit"])}</small></dd></div>') +
            '</dl>'
            f'<p class="sc-fits"><b>이런 모임에</b>{esc(sp["fits"])}</p>'
            f'<ul class="sc-feats">{feats}</ul>'
            + (f'<div class="sc-suggest"><b>비북스의 제안</b><p>{esc(sp["suggest"])}</p></div>' if sp.get('suggest') else '')
            + (('<div class="sc-held"><b>이 공간에서 열린 비모임</b><div>' + ''.join(
                f'<a href="{rel}m/{esc(x["slug"])}/">{esc(x.get("short") or x["title"])}</a>' for x in held.get(sp['id'], [])[:6]) + '</div></div>')
               if held.get(sp['id']) else '') +
            f'<div class="sc-btns"><button type="button" class="btn primary" data-pick-space="{esc(sp["id"])}">이 공간 예약하기</button>'
            f'<button type="button" class="btn outline" data-gallery-open-btn>사진 {len(photos)}장 보기</button></div>'
            '</div></section>')

    def price_cell(sp):
        dp = (sp.get('pricing') or {}).get('dayPass')
        if dp:
            reg = f'<del>{won(dp["regular"])}</del> ' if dp.get('regular') else ''
            return f'<b>{esc(sp["priceText"])}</b><small>종일권({esc(dp["from"])}–{esc(dp["to"])}) {reg}<b class="dp-price">{won(dp["price"])}</b> · {esc(dp.get("label", ""))}</small>'
        return f'<b>{esc(sp["priceText"])}</b><small>{esc(sp["priceUnit"])}</small>'
    price_rows = ''.join(
        f'<tr><th scope="row">{esc(sp["name"])}</th><td>{sp["maxPeople"]}인</td><td>{price_cell(sp)}</td></tr>'
        for sp in spaces)
    steps = ''.join(f'<li><b>{esc(s["title"])}</b><span>{esc(s["desc"])}</span></li>' for s in SPACES['steps'])
    space_opts = ''.join(f'<button type="button" class="pick" data-space-opt="{esc(sp["id"])}"><b>{esc(sp["name"])}</b><small>{esc(sp["priceText"])} · {sp["maxPeople"]}인</small></button>' for sp in spaces)
    body = f'''
<main id="main" class="wrap space-page">
  {hero_html}

  <nav class="space-jump" aria-label="공간 바로가기">{jump}</nav>

  {why_html}

  {shows}

  <section aria-labelledby="priceH">
    <h2 class="sec-title" id="priceH">한눈에 보는 요금</h2>
    <div class="table-wrap"><table class="ptable"><thead><tr><th>공간</th><th>인원</th><th>요금</th></tr></thead><tbody>{price_rows}</tbody></table></div>
    <p class="muted small">{esc(SPACES.get("billingNote", ""))}<br>세미나실과 매장 테이블은 같은 요금이에요. 모든 비품은 무료이고, 정확한 금액은 신청 후 담당자가 안내드려요.</p>
  </section>

  <section class="calc" aria-labelledby="calcH">
    <h2 class="sec-title" id="calcH">예상 금액 계산</h2>
    <div class="calc-row">
      <label>공간<select id="calcSpace">{"".join(f'<option value="{esc(sp["id"])}">{esc(sp["name"])}</option>' for sp in SPACES["spaces"])}</select></label>
      <label>인원<input id="calcPeople" type="number" min="1" value="6" inputmode="numeric"></label>
      <label>시간<select id="calcHours">{"".join(f'<option value="{x}"{" selected" if x == 2 else ""}>{x:g}시간</option>' for x in [1, 1.5, 2, 2.5, 3, 4, 5, 6])}</select></label>
    </div>
    <p class="calc-out" id="calcOut"></p>
  </section>

  <section aria-labelledby="howH">
    <h2 class="sec-title" id="howH">이용 방법</h2>
    <ol class="steps">{steps}</ol>
  </section>

  <section class="book" id="book" aria-labelledby="bookH">
    <h2 class="sec-title" id="bookH">대관 예약하기</h2>
    <div class="book-step"><span class="num">1</span><div><b>공간 선택</b><div class="picks" id="spacePicks">{space_opts}</div></div></div>
    <div class="book-step"><span class="num">2</span><div><b>날짜 선택</b> <small class="muted">점이 있는 날은 일부 시간이 이미 예약돼 있어요</small><div id="rentCal" class="minical"></div></div></div>
    <div class="book-step"><span class="num">3</span><div><b>시간 선택</b> <small class="muted" id="timeNote">시작 칸과 끝 칸을 차례로 눌러 주세요</small>
      <p class="bill-note">{esc(SPACES.get("billingNote", ""))}</p>
      <div id="dayBusy" class="daybusy" hidden></div>
      <div id="timeGrid" class="timegrid"><p class="muted small">공간과 날짜를 먼저 골라 주세요.</p></div>
      <div class="legend"><span><i class="lg free"></i>예약 가능</span><span><i class="lg moim"></i>비모임</span><span><i class="lg rent"></i>대관 있음</span><span><i class="lg sel"></i>선택</span></div>
    </div></div>
    <div class="book-step"><span class="num">4</span><div><b>신청자 정보</b>
      <form id="rentForm" class="form" novalidate>
        <div class="summary" id="rentSummary">공간 · 날짜 · 시간을 골라 주세요</div>
        <div class="row2">
          <label class="field"><span>이름 *</span><input name="name" autocomplete="name" required></label>
          <label class="field"><span>휴대폰 *</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" required></label>
        </div>
        <div class="row2">
          <label class="field"><span>이메일 <small>(안내 메일)</small></span><input name="email" type="email" autocomplete="email" placeholder="선택"></label>
          <label class="field"><span>인원</span><input name="count" type="number" min="1" inputmode="numeric" placeholder="예: 6"></label>
        </div>
        <label class="field"><span>사용 목적</span><input name="purpose" placeholder="독서모임, 스터디, 북토크 등"></label>
        <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div data-consent></div>
        <div class="paybox" id="rentPay" hidden></div>
        <div class="form-alert" id="rentAlert" role="alert"></div>
        <button class="btn primary big" id="rentSubmit" type="submit">대관 신청하기</button>
        <p class="muted small pay-rule">입금이 확인되면 신청이 완료돼요. 아래 계좌로 먼저 입금하고 신청하셔도 되고, 신청 후 기한 안에 입금하셔도 돼요.</p>
      </form>
    </div></div>
  </section>

  <section class="plain-card" aria-labelledby="rfH">
    <h2 class="sec-title" id="rfH">대관 환불 규정</h2>
    {refund_block(True)}
  </section>
</main>'''
    write('space/index.html', layout(page_id='space', title='공간 대관 · 비북스 b.moim',
                                     desc='부천 원미동 독립서점 비북스 공간 대관 — 세미나실·매장 테이블·계단 좌석·1인실·전체 대관. 사진과 요금을 보고 예약 가능한 시간을 바로 신청하세요.',
                                     body=body, depth=1, path='space/', extra_scripts=('rent.js',),
                                     og_image=img_abs((SPACES.get('heroPhotos') or {}).get('main') or SPACES['spaces'][0]['photos'][0]['src'])))


# ── 모임 열기 ────────────────────────────────────────
def poster_guide():
    p = POSTER
    sw, sh = p['width'], p['height']
    safe_x = p['safe'] / sw * 100
    safe_y = p['safe'] / sh * 100
    bw = p['badgeW'] / sw * 100
    bh = p['badgeH'] / sh * 100
    br = p.get('badgeRight', 0) / sw * 100
    return f'''
  <section class="poster-guide" id="poster" aria-labelledby="pgH">
    <h2 class="sec-title" id="pgH">포스터 제출 가이드</h2>
    <p class="muted">포스터는 호스트님이 직접 만들어 주세요. 아래 규격에 맞추면 목록·상세 페이지·인스타 카드에 모두 같은 모양으로 깔끔하게 들어갑니다.</p>
    <div class="pg-grid">
      <figure class="pg-figure" aria-label="포스터 규격 도식">
        <div class="pg-canvas">
          <div class="pg-safe" style="inset:{safe_y:.2f}% {safe_x:.2f}%"><span>글자는 이 안쪽에</span></div>
          <div class="pg-badge" style="width:{bw:.2f}%;height:{bh:.2f}%;right:{br:.2f}%"><span>책갈피<br>자리</span></div>
          <div class="pg-center"><span>핵심 이미지·제목은<br>가운데</span></div>
        </div>
        <figcaption>{sw} × {sh} px · 세로 4:5</figcaption>
      </figure>
      <dl class="pg-spec">
        <div><dt>크기</dt><dd><b>{sw} × {sh} px</b> (세로 4:5)<br><small class="muted">인스타그램 피드 게시물과 같은 비율이라 그대로 올려도 돼요</small></dd></div>
        <div><dt>파일</dt><dd>{esc(p["formats"])} · {p["maxMB"]}MB 이하 · RGB</dd></div>
        <div><dt>여백</dt><dd>가장자리 <b>{p["safe"]}px</b> 안쪽에 글자를 배치해 주세요</dd></div>
        <div><dt>책갈피 자리</dt><dd>오른쪽 위 <b>{p["badgeW"]} × {p["badgeH"]}px</b>에는 ‘2자리 남음’ 책갈피가 걸려요. 중요한 글자는 피해 주세요</dd></div>
        <div><dt>글자 크기</dt><dd>목록에서는 폭 약 170~260px로 작게 보여요. 제목은 <b>크고 짧게</b> (1080px 기준 80px 이상)</dd></div>
        <div><dt>담을 내용</dt><dd>제목 · 분위기 · 호스트 중심으로. 날짜·가격·장소는 페이지가 글자로 따로 보여 주니 포스터에 없어도 괜찮아요</dd></div>
        <div><dt>파일 이름</dt><dd>모임이름_년월 (예: <code>daon_bookclub_2611.jpg</code>)</dd></div>
      </dl>
    </div>
    <p class="muted small">규격이 다른 포스터도 올릴 수는 있지만, 여백이 흐린 배경으로 채워져요. 스토리(9:16)·라인업 이미지는 비북스가 자동으로 만들어 드립니다.</p>
  </section>'''


def build_host():
    rel = '../'
    tag_opts = ''.join(f'<option>{esc(t)}</option>' for t in MOIMS['tags']) + '<option>기타</option>'
    space_opts = ''.join(f'<option>{esc(sp["id"])}</option>' for sp in SPACES['spaces']) + '<option>상의 후 결정</option>'
    body = f'''
<main id="main" class="wrap narrow">
  {page_head('Host', '모임 열기', '비북스에서 모임을 열어 보세요.<br>공간은 물론, 신청 받기·입금 확인·홍보 페이지까지 함께 준비합니다.')}
  <section class="perks">
    <div class="perk"><b>나만의 모임 페이지</b><p>공유용 링크, 카톡·인스타 미리보기, 구글 검색용 정보까지 자동으로 만들어져요.</p></div>
    <div class="perk"><b>신청·입금 관리</b><p>신청 접수와 입금 확인, 알림톡 안내는 비북스가 맡아요.</p></div>
    <div class="perk"><b>실시간 신청 현황</b><p>호스트 전용 비공개 링크로 신청 인원과 입금 상태를 언제든 확인하세요.</p></div>
    <div class="perk"><b>함께 홍보</b><p>비모임 월간 라인업, 인스타 카드, 매장 QR로 함께 알립니다.</p></div>
  </section>

  <section>
    <h2 class="sec-title">진행 순서</h2>
    <ol class="steps">
      <li><b>개설 신청</b><span>아래 양식을 보내 주세요.</span></li>
      <li><b>일정·공간 협의</b><span>담당자가 연락드려 세부 사항을 정해요.</span></li>
      <li><b>포스터 제출</b><span>아래 규격에 맞춰 보내 주세요.</span></li>
      <li><b>페이지 오픈</b><span>공유 링크와 호스트 현황 링크를 드려요.</span></li>
      <li><b>모임 · 정산</b><span>모임을 진행하고 참가비를 정산해요.</span></li>
    </ol>
    <p class="muted small">공간 이용료는 <a href="{rel}space/">대관 페이지</a>의 요금을 참고해 주세요.</p>
  </section>

  {poster_guide()}

  <section>
    <h2 class="sec-title">모임 개설 신청서</h2>
    <form id="hostForm" class="form" novalidate>
      <fieldset><legend>호스트 정보</legend>
        <div class="row2">
          <label class="field"><span>호스트 이름·활동명 *</span><input name="hostName" required></label>
          <label class="field"><span>인스타그램</span><input name="insta" placeholder="@계정"></label>
        </div>
        <div class="row2">
          <label class="field"><span>휴대폰 *</span><input name="phone" type="tel" inputmode="tel" placeholder="010-0000-0000" required></label>
          <label class="field"><span>이메일 *</span><input name="email" type="email" required></label>
        </div>
        <label class="field"><span>호스트 소개</span><textarea name="hostBio" rows="2" placeholder="어떤 분인지 짧게 소개해 주세요. 모임 페이지에 실려요."></textarea></label>
      </fieldset>
      <fieldset><legend>모임 정보</legend>
        <label class="field"><span>모임 제목 *</span><input name="title" required></label>
        <label class="field"><span>한 줄 소개 *</span><input name="oneLiner" maxlength="40" placeholder="예) 천천히 깊어지는 목요일 저녁" required></label>
        <div class="row2">
          <label class="field"><span>분야</span><select name="category">{tag_opts}</select></label>
          <label class="field"><span>대상</span><input name="audience" placeholder="예) 성인 누구나 / 초등 저학년"></label>
        </div>
        <label class="field"><span>상세 소개 *</span><textarea name="description" rows="5" required placeholder="무엇을, 어떻게 하는 모임인지 알려 주세요."></textarea></label>
      </fieldset>
      <fieldset><legend>일정 · 공간 · 비용</legend>
        <div class="row2">
          <label class="field"><span>희망 일정 1 *</span><input name="date1" type="datetime-local" required></label>
          <label class="field"><span>희망 일정 2</span><input name="date2" type="datetime-local"></label>
        </div>
        <div class="row3">
          <label class="field"><span>진행 시간</span><select name="duration"><option>1시간</option><option>1시간 30분</option><option selected>2시간</option><option>2시간 30분</option><option>3시간 이상</option></select></label>
          <label class="field"><span>희망 공간</span><select name="space">{space_opts}</select></label>
          <label class="field"><span>정원 *</span><input name="capacity" type="number" min="1" inputmode="numeric" required></label>
        </div>
        <div class="row3">
          <label class="field"><span>참가비(1인) *</span><input name="price" type="number" min="0" step="1000" inputmode="numeric" required placeholder="원"></label>
          <label class="field"><span>재료 준비</span><select name="materials"><option value="없음">없음</option><option value="있음">있음</option></select><small class="muted">환불 규정이 달라져요</small></label>
          <label class="field"><span>정기 모임</span><select name="regular"><option>1회</option><option>매주</option><option>격주</option><option>매월</option><option>기타</option></select></label>
        </div>
        <label class="field"><span>포스터 링크</span><input name="posterUrl" type="url" placeholder="구글 드라이브 등 · {POSTER["width"]}×{POSTER["height"]}px (없으면 비워 두세요)"><small class="muted"><a href="#poster">포스터 규격 보기</a></small></label>
        <label class="field"><span>요청 · 문의</span><textarea name="request" rows="3"></textarea></label>
      </fieldset>
      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div data-consent data-consent-kind="host"></div>
      <div class="form-alert" id="hostAlert" role="alert"></div>
      <button class="btn primary big" type="submit" id="hostSubmit">개설 신청 보내기</button>
    </form>
  </section>
</main>'''
    write(HOST_DIR + 'index.html', layout(page_id='host', title='모임 열기 · 비북스 b.moim',
                                    desc='비북스에서 독서모임·글쓰기·클래스를 열어 보세요. 공간, 신청 관리, 홍보 페이지까지 함께 준비합니다.',
                                    body=body, depth=1, path=HOST_DIR))


def build_dashboard():
    body = f'''
<main id="main" class="wrap narrow">
  {page_head('Host · 비공개', '호스트 신청 현황', '이 페이지 주소에는 호스트 전용 열쇠가 들어 있어요. 다른 사람과 공유하지 마세요.')}
  <form id="tokenForm" class="form inline" hidden>
    <label class="field"><span>{'호스트 코드' if SHEET else '호스트 링크 코드'}</span><input name="token" autocomplete="off" required{' style="text-transform:uppercase"' if SHEET else ''}></label>
    <button class="btn primary" type="submit">현황 보기</button>
  </form>
  <div id="dash" aria-live="polite"><p class="muted">불러오는 중…</p></div>
</main>'''
    write(DASH_DIR + 'index.html', layout(page_id='dashboard', title='호스트 신청 현황 · 비북스 b.moim',
                                              desc='호스트 전용 신청 현황', body=body, depth=2,
                                              path=DASH_DIR, private=True,
                                              head_extra='<meta name="referrer" content="no-referrer">\n'))


def build_my():
    body = f'''
<main id="main" class="wrap narrow">
  {page_head('My', '내 신청 확인', '신청번호와 휴대폰 번호로 입금 상태를 확인하고, 취소를 요청할 수 있어요.')}
  <div id="recent"></div>
  <form id="lookupForm" class="form card-form" novalidate>
    <div class="row2">
      <label class="field"><span>신청번호</span><input name="code" placeholder="예) BM-7K2Q9D" autocomplete="off" required style="text-transform:uppercase"></label>
      <label class="field"><span>휴대폰</span><input name="phone" type="tel" inputmode="tel" placeholder="010-0000-0000" required></label>
    </div>
    <div class="form-alert" id="lookupAlert" role="alert"></div>
    <button class="btn primary big" type="submit">신청 내역 보기</button>
  </form>
  <details class="forgot">
    <summary>신청번호를 잊으셨나요?</summary>
    <form id="resendForm" class="form" novalidate>
      <p class="muted small">신청할 때 쓴 이름과 휴대폰 번호를 넣으면, 등록된 알림톡·메일로 신청번호를 다시 보내 드려요. (화면에는 표시하지 않아요)</p>
      <div class="row2">
        <label class="field"><span>이름</span><input name="name" required></label>
        <label class="field"><span>휴대폰</span><input name="phone" type="tel" inputmode="tel" required></label>
      </div>
      <div class="form-alert" id="resendAlert" role="alert"></div>
      <button class="btn outline" type="submit">신청번호 다시 받기</button>
    </form>
  </details>
  <div id="myResult" aria-live="polite"></div>
</main>'''
    write('my/index.html', layout(page_id='my', title='내 신청 확인 · 비북스 b.moim',
                                  desc='비모임·대관 신청 내역과 입금 상태를 확인하세요.', body=body, depth=1,
                                  path='my/', private=True))


def build_cards():
    body = f'''
<main id="main" class="wrap">
  {page_head('Promo · 운영자용', '홍보 카드 · QR', '모임 데이터로 바로 만들어지는 홍보 이미지예요. 형식을 고르고 ‘PNG 저장’을 누르세요. 남은 자리는 실시간 신청 현황으로 채워집니다.')}
  <div class="sorts cards-tabs" role="group" aria-label="카드 형식">
    <button type="button" class="sort on" data-format="feed" aria-pressed="true">피드 4:5</button>
    <button type="button" class="sort" data-format="story" aria-pressed="false">스토리 9:16</button>
    <button type="button" class="sort" data-format="lineup" aria-pressed="false">월간 라인업</button>
    <button type="button" class="sort" data-format="qr" aria-pressed="false">매장 QR</button>
  </div>
  <div id="cardStage" class="card-stage"></div>
</main>'''
    write('cards/index.html', layout(
        page_id='cards', title='홍보 카드 · 비북스 b.moim', desc='비모임 홍보 카드 생성기', body=body, depth=1,
        path='cards/', private=True,
        extra_scripts=('cards.js',),
        head_extra='<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>\n'
                   '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" defer></script>\n'))


# ── .ics / 텍스트 / sitemap ──────────────────────────
def ics_escape(s):
    return str(s).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')


def ics_fold(line):
    out, cur, size = [], '', 0
    for ch in line:
        b = len(ch.encode('utf-8'))
        if size + b > 73:
            out.append(cur)
            cur, size = ' ', 1
        cur += ch
        size += b
    out.append(cur)
    return '\r\n'.join(out)


def ics(items, name='비북스 b.moim'):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BeeBooks//bmoim//KO', 'CALSCALE:GREGORIAN',
             'METHOD:PUBLISH', f'X-WR-CALNAME:{ics_escape(name)}', 'X-WR-TIMEZONE:Asia/Seoul',
             'REFRESH-INTERVAL;VALUE=DURATION:PT12H']
    for it in items:
        url = page_abs(f'm/{it["slug"]}/')
        for n, o in enumerate(occurrences(it)):
            lines += ['BEGIN:VEVENT',
                      f'UID:{it["slug"]}-{o["session"]}-{n}@bmoim.bbooks',
                      f'DTSTAMP:{stamp}',
                      f'DTSTART:{o["start"].astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}',
                      f'DTEND:{o["end"].astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}',
                      f'SUMMARY:{ics_escape(it["title"] + " · 비북스")}',
                      f'LOCATION:{ics_escape("비북스 " + o["space"] + ", " + SITE["store"]["address"])}',
                      f'DESCRIPTION:{ics_escape((it.get("summary") or "") + chr(10) + url)}',
                      f'URL:{url}',
                      'END:VEVENT']
    lines.append('END:VCALENDAR')
    return '\r\n'.join(ics_fold(l) for l in lines) + '\r\n'


def lineup_text():
    m = SITE['month']
    out = [f'🍂 {m["title"]} 라인업 · 비북스 b.moim', m['sub'], '']
    for n, it in enumerate(ITEMS, 1):
        kind = '[행사] ' if it['kind'] == 'event' else ''
        out.append(f'{n}. {kind}{it["title"]}')
        out.append(f'   {date_text(it, long=False)} · {space_text(it)} · {price_text(it)}')
        out.append(f'   {it.get("oneLiner", "")}')
        out.append(f'   👉 {page_abs("m/" + it["slug"] + "/")}?ref=lineup')
        out.append('')
    out.append(f'📍 {SITE["store"]["address"]}')
    out.append(f'📅 전체 일정 {page_abs("")}?ref=lineup')
    return '\n'.join(out) + '\n'


def sitemap():
    today = datetime.now(KST).strftime('%Y-%m-%d')
    urls = ['', 'space/', HOST_DIR] + [f'm/{i["slug"]}/' for i in ITEMS]
    body = ''.join(f'<url><loc>{esc(page_abs(u))}</loc><lastmod>{today}</lastmod></url>' for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n'


def robots():
    return (f'User-agent: *\nAllow: /\nDisallow: /my/\nDisallow: /{DASH_DIR}\nDisallow: /cards/\nDisallow: /_bmoim-v2-src/\n'
            f'Sitemap: {page_abs("sitemap.xml")}\n')


# ── 파일 쓰기 ────────────────────────────────────────
HREF_DIR = re.compile(r'href="((?!https?:|#|mailto:|data:)[^"?#]*/)((?:[?#][^"]*)?)"')
PRETENDARD = re.compile(r'<link rel="preconnect" href="https://cdn\.jsdelivr\.net"[^>]*>\n<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/gh/orioncactus/pretendard[^>]*>\n')


def share_html(rel_path, content):
    """공유용 변환: 폴더 링크 → index.html, Pretendard → Google Fonts(Noto Sans KR), 첫 페이지는 문서 틀 없이"""
    content = HREF_DIR.sub(lambda m: f'href="{m.group(1)}index.html{m.group(2)}"', content)
    content = PRETENDARD.sub('', content)
    content = content.replace('family=Noto+Serif+KR:wght@600;700&display=swap',
                              'family=Noto+Serif+KR:wght@600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap')
    content = re.sub(r'(assets/[\w.-]+)\?v=\d+', r'\1', content)
    if rel_path == 'index.html':
        content = re.sub(r'<title>[^<]*</title>', f'<title>{SITE["month"]["title"]} v2</title>', content, count=1)
        m = re.search(r'<body data-page="([^"]*)" data-rel="([^"]*)">', content)
        content = re.sub(r'<!DOCTYPE html>\n<html lang="ko">\n<head>\n', '', content)
        content = content.replace('</head>\n', '').replace('</body>\n</html>\n', '')
        content = content.replace(m.group(0), f'<script>document.documentElement.lang="ko";document.body.dataset.page="{m.group(1)}";document.body.dataset.rel="{m.group(2)}";</script>')
    return content


def write(rel_path, content):
    if SHARE and rel_path.endswith('.html'):
        content = share_html(rel_path, content)
    p = os.path.join(DIST, rel_path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(content)


def copy_assets():
    shutil.copytree(ASSETS, os.path.join(DIST, 'assets'))
    src = image_src_dir()
    if not src or SHEET:
        return []
    names = {SITE['month']['heroImage']} | {i['poster'] for i in ITEMS} | {
        p['src'] for sp in SPACES['spaces'] for p in sp['photos']}
    missing = []
    dst = os.path.join(DIST, SITE['images']['baseUrl'])
    os.makedirs(dst, exist_ok=True)
    for n in sorted(names):
        if os.path.exists(os.path.join(src, n)):
            shutil.copy2(os.path.join(src, n), os.path.join(dst, n))
        else:
            missing.append(n)
    return missing


def validate():
    errs = []
    slugs = set()
    for it in MOIMS['items']:
        s = it.get('slug', '?')
        if s in slugs:
            errs.append(f'slug 중복: {s}')
        slugs.add(s)
        for k in ('title', 'kind', 'poster', 'sessions', 'host'):
            if k not in it:
                errs.append(f'{s}: {k} 없음')
        ids = set()
        for se in it.get('sessions', []):
            if se['id'] in ids:
                errs.append(f'{s}: 회차 id 중복 {se["id"]}')
            ids.add(se['id'])
            for d in se['dates']:
                if dt(d['end']) <= dt(d['start']):
                    errs.append(f'{s}/{se["id"]}: 끝 시간이 시작보다 빠름')
                if d['space'] not in {sp['id'] for sp in SPACES['spaces']}:
                    errs.append(f'{s}/{se["id"]}: 알 수 없는 공간 "{d["space"]}"')
        for p in it.get('packages', []):
            for sid in p['sessions']:
                if sid not in ids:
                    errs.append(f'{s}: 패키지 {p["id"]}가 없는 회차 {sid}를 가리킴')
    bl = blocks()
    conflicts = {sp['id']: set(sp['conflicts']) | {sp['id']} for sp in SPACES['spaces']}
    for a in range(len(bl)):
        for b in range(a + 1, len(bl)):
            x, y = bl[a], bl[b]
            if x['date'] == y['date'] and y['space'] in conflicts[x['space']] and x['start'] < y['end'] and y['start'] < x['end']:
                errs.append(f'⚠ 일정 겹침: {x["date"]} {x["tag"]}({x["space"]}) ↔ {y["tag"]}({y["space"]})')
    return errs


def poster_report():
    lines = []
    for it in ITEMS:
        info = poster_info(it['poster'])
        if not info['size']:
            continue
        w, h = info['size']
        probs = []
        if abs(w / h - POSTER['width'] / POSTER['height']) > POSTER['tolerance']:
            probs.append(f'비율 {w}×{h}')
        elif w < POSTER['width'] * 0.75:
            probs.append(f'해상도 낮음 {w}×{h}')
        if info['kb'] and info['kb'] > POSTER['maxMB'] * 1024:
            probs.append(f'{info["kb"]}KB')
        if probs:
            lines.append(f'   · {it["title"]} ({it["poster"]}): {", ".join(probs)} → 흐린 배경으로 맞춰 표시')
    return lines


def redirect_page(target, note='비모임 페이지가 한곳으로 모였어요.'):
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>비북스 b.moim</title>
<link rel="canonical" href="{esc(page_abs(target.lstrip('./').replace('../', '')))}">
<meta http-equiv="refresh" content="0; url={esc(target)}">
<script>location.replace({json.dumps(target)});</script>
</head>
<body style="font-family:sans-serif;padding:40px;text-align:center">
<p>{esc(note)} <a href="{esc(target)}">여기를 눌러 이동하세요</a>.</p>
</body>
</html>
'''


def write_legacy_redirects():
    """예전 월별 주소(june.html…october.html)와 /v2/ 주소를 새 첫 화면·새 주소로 연결"""
    for name in SITE['sheet'].get('legacyPages', []):
        write(name, redirect_page(DASH_DIR if name == 'host.html' else './'))
    write('v2/index.html', redirect_page('../'))
    for it in ITEMS:
        write(f'v2/m/{it["slug"]}/index.html', redirect_page(f'../../../m/{it["slug"]}/'))
    write('v2/space/index.html', redirect_page('../../space/'))
    write('v2/host/index.html', redirect_page('../../open/'))
    write('v2/host/dashboard/index.html', redirect_page('../../../open/status/'))
    write('v2/my/index.html', redirect_page('../../my/'))


def october_redirect():
    """저장소 루트의 october.html을 v2로 넘겨 주는 페이지 (기존 링크·인스타 링크 유지)"""
    return '''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>10월 비모임 · 비북스 b.moim</title>
<link rel="canonical" href="https://moim.bbooks.co.kr/v2/">
<meta http-equiv="refresh" content="0; url=v2/">
<script>location.replace('v2/' + location.search + location.hash);</script>
</head>
<body style="font-family:sans-serif;padding:40px;text-align:center">
<p>10월 비모임 페이지가 새로워졌어요. <a href="v2/">여기를 눌러 이동하세요</a>.</p>
</body>
</html>
'''


def main():
    errs = validate()
    hard = [e for e in errs if not e.startswith('⚠')]
    for e in errs:
        print(e)
    if hard:
        sys.exit('데이터 오류로 빌드를 멈춥니다.')
    if SHEET:
        for g in GENERATED:
            gp = os.path.join(DIST, g)
            if os.path.isdir(gp):
                shutil.rmtree(gp)
    else:
        if os.path.exists(DIST):
            shutil.rmtree(DIST)
        os.makedirs(DIST)
    missing = copy_assets()
    build_hub()
    for it in ITEMS:
        others = [o for o in ITEMS if o['slug'] != it['slug']][:3]
        build_detail(it, others)
    build_space()
    build_host()
    build_dashboard()
    build_my()
    build_cards()
    write('bmoim.ics', ics(ITEMS))
    write('exports/lineup.txt', lineup_text())
    write('data/catalog.json', json.dumps(CATALOG, ensure_ascii=False, indent=1))
    write('sitemap.xml', sitemap())
    write('robots.txt', robots())
    if SHEET:
        write_legacy_redirects()
    print(f'✓ {os.path.basename(DIST)}/ 생성 — 모임·행사 {len(ITEMS)}개, 개별 페이지 {len(ITEMS)}개')
    rep = poster_report()
    if rep:
        print(f'ℹ 포스터 규격({POSTER["width"]}×{POSTER["height"]}, 4:5)과 다른 포스터 {len(rep)}개:')
        print('\n'.join(rep))
    if missing:
        print('⚠ 이미지 없음:', ', '.join(missing))
    if SHEET:
        print('ℹ 운영 빌드 → 저장소 루트(moim.bbooks.co.kr/) 갱신 + 예전 월별·v2 주소 연결')
    elif not SITE['apiUrl']:
        print('ℹ apiUrl 비어 있음 → 테스트(데모) 모드: 신청은 브라우저에만 저장됩니다.')
    if '--serve' in sys.argv:
        import http.server
        import functools
        port = 8790
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIST)
        print(f'→ http://localhost:{port}/')
        http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()


if __name__ == '__main__':
    main()
