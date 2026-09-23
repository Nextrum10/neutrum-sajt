# -*- coding: utf-8 -*-
"""Kollar att varje bilder/*.jpg har en webp bredvid sig, och att den
   inte är äldre än sin jpg.

       python3 verktyg/kolla-webp.py

Sidorna serverar bilderna genom <picture>: en <source type="image/webp">
först, <img> med jpg som reserv. Saknas webp-filen faller webbläsaren
tillbaka på jpg:en och INGENTING GÅR SÖNDER — sidan blir bara tre gånger
tyngre, tyst, på precis de bilder man glömde. Det är den sortens fel
ingen upptäcker, för den enda symptomet är en siffra ingen tittar på.

Innehållet kontrolleras INTE, bara att filen finns och är minst lika ny
som sin jpg. En bildkodare ger inte samma bytes mellan versioner, så
`git diff --exit-code` — tricket som vaktar maskotsvaren och
FAQ-schemat — hade blivit rött av sig självt vid varje uppgradering av
cwebp. Se verktyg/bygg-webp.py.
"""
import os, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'bilder')


def main():
    if not os.path.isdir(MAPP):
        print('bilder/ finns inte.')
        return 1

    saknas, gamla, n = [], [], 0
    for f in sorted(os.listdir(MAPP)):
        if not f.endswith('.jpg'):
            continue
        n += 1
        jpg = os.path.join(MAPP, f)
        webp = jpg[:-4] + '.webp'
        if not os.path.exists(webp):
            saknas.append(f)
        elif os.path.getmtime(webp) < os.path.getmtime(jpg) - 1:
            gamla.append(f)

    if saknas:
        print('SAKNAR WEBP (%d):' % len(saknas))
        for f in saknas:
            print('  bilder/' + f)
    if gamla:
        print('WEBP ÄLDRE ÄN SIN JPG (%d):' % len(gamla))
        for f in gamla:
            print('  bilder/' + f)
    if saknas or gamla:
        print('\nKör: python3 verktyg/bygg-webp.py')
        return 1

    print('ok   %d jpg, alla med en webp bredvid sig' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
