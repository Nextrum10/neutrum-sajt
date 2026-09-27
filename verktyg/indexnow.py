#!/usr/bin/env python3
"""Säger till Bing (och Yandex, Seznam, Naver) att sidor har ändrats.

    python3 verktyg/indexnow.py --fore <gammal sitemap.xml>   # det som ändrats
    python3 verktyg/indexnow.py --alla                        # allt i kartan
    lägg till --torrt för att bara skriva ut adresserna

VARFÖR

Google hämtar kartan i sin egen takt, och det finns inget sätt att
knuffa på den utan Search Console. Bing har IndexNow: ett anrop, och
adressen står i kön inom minuter. Bings index är det som ChatGPT:s
sökning, Copilot och DuckDuckGo läser, så det är mer än Bing självt.

VAD SOM SKICKAS

Bara adresser vars innehåll ändrats, alltså de där summan i
sitemap.xml skiljer sig från förra driftsättningens karta (se
verktyg/bygg-sitemap.py). IndexNow ber uttryckligen om att inte få
samma oförändrade adress om och om igen, och den här sajten
driftsätts flera gånger om dagen för saker som inte syns på sidorna.

Körs av .github/workflows/indexnow.yml när Vercel meddelat att en
produktionsdriftsättning är klar. Före det finns inte nyckelfilen
eller de nya sidorna på nextrum.se, och då hade Bing hämtat en 404.

NYCKELN

Ligger i roten som <nyckel>.txt och är offentlig med flit: den bevisar
bara att den som skickar äger domänen. Byts den, byt båda ställena.
"""

import json
import re
import sys
import urllib.request
import os

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARD = 'nextrum.se'
NYCKEL = '1ba8bf8c04595e17dff19c8eaf340825'
SLUTPUNKT = 'https://api.indexnow.org/indexnow'


def poster(xml):
    """{loc: summa} ur en karta. En karta utan summor (före
    bygg-sitemap.py) ger None för varje adress, alltså 'ändrad'."""
    ut = {}
    for block in re.findall(r'<url>(.*?)</url>', xml, re.S):
        loc = re.search(r'<loc>([^<]+)</loc>', block)
        sm = re.search(r'<!-- summa ([0-9a-f]+) -->', block)
        if loc:
            ut[loc.group(1)] = sm.group(1) if sm else None
    return ut


def andrade(ny, fore):
    return sorted(u for u, s in ny.items() if s is None or fore.get(u) != s)


def skicka(adresser):
    kropp = json.dumps({
        'host': VARD,
        'key': NYCKEL,
        'keyLocation': f'https://{VARD}/{NYCKEL}.txt',
        'urlList': adresser,
    }).encode('utf-8')
    req = urllib.request.Request(SLUTPUNKT, data=kropp, method='POST',
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as svar:
        # 200 och 202 betyder mottaget. 202 är det vanliga för en ny
        # nyckel: Bing har inte hunnit hämta nyckelfilen än.
        return svar.status


def main():
    arg = sys.argv[1:]
    ny = poster(open(os.path.join(ROT, 'sitemap.xml'), encoding='utf-8').read())
    if '--alla' in arg:
        adresser = sorted(ny)
    elif '--fore' in arg:
        fore_fil = arg[arg.index('--fore') + 1]
        fore = poster(open(fore_fil, encoding='utf-8').read()) if os.path.exists(fore_fil) else {}
        adresser = andrade(ny, fore)
    else:
        sys.exit(__doc__)

    if not adresser:
        print('inget har ändrats, inget skickas')
        return
    print('\n'.join(adresser))
    if '--torrt' in arg:
        print(f'{len(adresser)} adresser (torrkörning, inget skickat)')
        return
    status = skicka(adresser)
    print(f'{len(adresser)} adresser skickade, svar {status}')


if __name__ == '__main__':
    main()
