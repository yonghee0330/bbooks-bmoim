#!/usr/bin/env python3
"""모임 책 표지를 알라딘 상품 페이지에서 받아 images/books/<isbn13>.jpg 로 저장

  python3 _bmoim-v2-src/tools/fetch_covers.py                 # 표지 파일이 없는 책만
  python3 _bmoim-v2-src/tools/fetch_covers.py btalk-seogyul-2611   # 이 모임 책만
  python3 _bmoim-v2-src/tools/fetch_covers.py --force         # 이미 있어도 다시 받기

- 알라딘 '검색'은 쓰지 않고, ISBN(또는 moims.json 의 aladinId)으로 상품 페이지만 연다. 요청 사이 4초 쉰다.
- 받은 파일이 있으면 build.py 가 바깥 표지 주소 대신 그 파일을 쓴다. 받은 뒤 deploy.sh 로 배포.
"""
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(ROOT)
OUT = os.path.join(REPO, 'images', 'books')
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'}


def get(url):
    req = urllib.request.Request(url, headers={**UA, 'Referer': 'https://www.aladin.co.kr/'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    data = json.load(open(os.path.join(ROOT, 'data', 'moims.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    first = True
    for it in data['items']:
        if args and it['slug'] not in args:
            continue
        for b in it.get('books', []):
            isbn, aid = b.get('isbn'), b.get('aladinId')
            if not (isbn or aid):
                print(f'· {b["title"]}: ISBN·aladinId 가 없어 건너뜀 (images/books/ 에 직접 넣어 주세요)')
                continue
            dst = os.path.join(OUT, f'{isbn or aid}.jpg')
            if os.path.exists(dst) and not force:
                print(f'· {b["title"]}: 이미 있음')
                continue
            if not first:
                time.sleep(4)
            first = False
            page = f'https://www.aladin.co.kr/shop/wproduct.aspx?{"ItemId=" + str(aid) if aid else "ISBN=" + isbn}'
            try:
                html = get(page).decode('utf-8', 'ignore')
                m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
                if not m:
                    print(f'✗ {b["title"]}: 표지를 찾지 못함 ({page})')
                    continue
                img = re.sub(r'/(coversum|cover150|cover200)/', '/cover500/', m.group(1))
                with open(dst, 'wb') as f:
                    f.write(get(img))
                print(f'✓ {b["title"]} → images/books/{os.path.basename(dst)}')
            except Exception as e:  # 한 권이 실패해도 나머지는 계속
                print(f'✗ {b["title"]}: {e}')


if __name__ == '__main__':
    main()
