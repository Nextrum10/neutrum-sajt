#!/usr/bin/env python3
"""Bygger sitemap.xml ur sidorna själva.

    python3 verktyg/bygg-sitemap.py

VARFÖR DEN GENERERAS

Kartan skrevs för hand och hade glidit isär från sajten:
/laxhjalp-stockholm stod två gånger, sex områdessidor saknade lastmod,
och resten sa 2026-09-09 fast startsidan ändrats efter det.
bygg-omradessidor.py lade till nya adresser sist i filen men tog
aldrig bort eller rättade något. En karta som säger fel är inte
farlig, men den är bortkastad: Google slutar läsa det som inte
stämmer.

VAD SOM KOMMER MED

Varje .html i roten och i en/ som har en <link rel="canonical"> och
inte är noindex. <loc> är sidans canonical och alternativen är sidans
egna hreflang-länkar, så kartan och sidan kan aldrig säga olika saker
om vilka språkversioner som finns.

LASTMOD

Google använder lastmod bara så länge det stämmer. Det räknas därför
INTE ur git eller filens datum: satt-version.py stämplar om varje sida
när ett skript eller en stilmall ändras, och då hade hela sajten sett
nyskriven ut efter varje ändring i en js-fil. I stället räknas en summa
av det man faktiskt läser (titel, beskrivning och texten i <main>), och
lastmod flyttas bara när summan ändras. Summan står som en kommentar i
kartan, så att nästa körning har något att jämföra med.

En ny sida får dagens datum. Git hade inte hjälpt: stämplarna gör att
varje sida har en commit från i går.

changefreq och priority står inte med. Google läser inte dem.

CI kör skriptet och gör git diff --exit-code. Rött betyder att någon
ändrat vad en sida säger, lagt till en sida eller tagit bort en, utan
att bygga om kartan.
"""

import datetime
import glob
import hashlib
import html
import os
import re
import sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KARTA = os.path.join(ROT, 'sitemap.xml')


def las(p):
    return open(p, encoding='utf-8').read()


def text(s):
    s = re.sub(r'<(script|style)\b.*?</\1>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def summa(s):
    """Det en läsare ser: titel, beskrivning och huvudinnehållet."""
    titel = re.search(r'<title>(.*?)</title>', s, re.S)
    beskr = re.search(r'<meta name="description" content="([^"]*)"', s)
    main = re.search(r'<main\b.*?</main>', s, re.S)
    delar = [titel.group(1) if titel else '', beskr.group(1) if beskr else '',
             text(main.group(0)) if main else text(s)]
    return hashlib.sha1('\n'.join(delar).encode('utf-8')).hexdigest()[:12]


def forra():
    """{loc: (lastmod, summa)} ur kartan som ligger där nu."""
    if not os.path.exists(KARTA):
        return {}
    ut = {}
    for block in re.findall(r'<url>(.*?)</url>', las(KARTA), re.S):
        loc = re.search(r'<loc>([^<]+)</loc>', block)
        mod = re.search(r'<lastmod>([^<]+)</lastmod>', block)
        sum_ = re.search(r'<!-- summa ([0-9a-f]+) -->', block)
        if loc and mod and sum_:
            ut[loc.group(1)] = (mod.group(1), sum_.group(1))
    return ut


def sidor():
    filer = sorted(glob.glob(os.path.join(ROT, '*.html'))) + \
        sorted(glob.glob(os.path.join(ROT, 'en', '*.html')))
    ut = []
    for p in filer:
        s = las(p)
        if re.search(r'<meta name="robots" content="[^"]*noindex', s):
            continue
        kanon = re.search(r'<link rel="canonical" href="([^"]+)"', s)
        if not kanon:
            continue
        alt = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', s)
        ut.append({'loc': kanon.group(1), 'alt': alt, 'summa': summa(s)})
    return ut


def ordning(sida):
    """Svenska och engelska versionen av samma sida bredvid varandra,
    startsidan först."""
    vag = sida['loc'].replace('https://nextrum.se/', '')
    en = vag.startswith('en/')
    if en:
        vag = vag[3:]
    return (vag != '', vag, en)


def main():
    gamla = forra()
    rader = []
    for sida in sorted(sidor(), key=ordning):
        mod, sum_ = gamla.get(sida['loc'], (None, None))
        if sum_ != sida['summa']:
            mod = datetime.date.today().isoformat()
        alt = ''.join(
            f'    <xhtml:link rel="alternate" hreflang="{h}" href="{u}"/>\n'
            for h, u in sida['alt'])
        rader.append(
            f'  <url>\n    <loc>{sida["loc"]}</loc>\n{alt}'
            f'    <lastmod>{mod}</lastmod>\n'
            f'    <!-- summa {sida["summa"]} -->\n  </url>\n')

    ut = ('<?xml version="1.0" encoding="UTF-8"?>\n'
          '<!-- Genererad av verktyg/bygg-sitemap.py ur sidornas canonical och\n'
          '     hreflang. Ändra sidan och kör om skriptet, inte den här filen.\n'
          '     Summan under varje adress är vad lastmod jämförs mot. -->\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
          '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
          + ''.join(rader) + '</urlset>\n')

    locs = [re.search(r'<loc>([^<]+)</loc>', r).group(1) for r in rader]
    if len(locs) != len(set(locs)):
        sys.exit('två sidor har samma canonical')

    open(KARTA, 'w', encoding='utf-8').write(ut)
    print(f'ok   sitemap.xml: {len(rader)} adresser')


if __name__ == '__main__':
    main()
