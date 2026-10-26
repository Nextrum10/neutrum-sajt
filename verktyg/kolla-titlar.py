# -*- coding: utf-8 -*-
"""Kollar att varje öppen sida syns hel i en sökträff.

       python3 verktyg/kolla-titlar.py

Sedan 2026-10-26. En förhandsvisning av sökträffarna visade att Google
kortade beskrivningen på 24 av 52 sidor och titeln på två, och att det
som föll bort på nio läxhjälpssidor var priset, som stod sist. Det här
ser till att det inte glider tillbaka, för en titel som blivit för lång
syns inte på sidan, bara i sökresultatet.

För varje sida i sitemap.xml:

  · titeln får plats på 600 px och beskrivningen på 920 px i Arial
    (verktyg/textbredd.py, samma mått som områdesgeneratorn skriver mot)
  · ingen annan sida har samma titel eller samma beskrivning
  · og:title och twitter:title är titeln, og:description och
    twitter:description är beskrivningen: en delning säger samma sak
    som sökträffen

Faller den: korta texten. För en sida som byggs av
verktyg/bygg-omradessidor.py står titeln och beskrivningen där.
"""
import html
import io
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textbredd  # noqa: E402

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def las(p):
    return io.open(os.path.join(ROT, p), encoding='utf-8').read()


def sidor_i_kartan():
    for v in re.findall(r'<loc>https://nextrum\.se/([^<]*)</loc>', las('sitemap.xml')):
        yield 'index.html' if v == '' else 'en/index.html' if v == 'en/' else v + '.html'


def meta(s, attr, namn):
    m = re.search(r'<meta %s="%s" content="([^"]*)">' % (attr, re.escape(namn)), s)
    return html.unescape(m.group(1)) if m else None


def main():
    fel = []
    titlar, beskrivningar = Counter(), Counter()
    sidor = {}
    for fil in sidor_i_kartan():
        s = las(fil)
        huvud = s[:s.find('</head>')]
        t = re.search(r'<title>(.*?)</title>', huvud, re.S)
        titel = html.unescape(t.group(1)).strip() if t else ''
        besk = meta(huvud, 'name', 'description') or ''
        sidor[fil] = (titel, besk)
        titlar[titel] += 1
        beskrivningar[besk] += 1

        if not titel:
            fel.append('%s har ingen titel' % fil)
        if not besk:
            fel.append('%s har ingen beskrivning' % fil)
        tb, bb = textbredd.titel(titel), textbredd.beskrivning(besk)
        if tb > textbredd.TITEL_GRANS:
            fel.append('%s: titeln är %.0f px, Google kortar efter %d: "%s"'
                       % (fil, tb, textbredd.TITEL_GRANS, titel))
        if bb > textbredd.BESKRIVNING_GRANS:
            fel.append('%s: beskrivningen är %.0f px, Google kortar efter %d: "%s"'
                       % (fil, bb, textbredd.BESKRIVNING_GRANS, besk))
        for attr, namn, ska in (('property', 'og:title', titel), ('name', 'twitter:title', titel),
                                ('property', 'og:description', besk),
                                ('name', 'twitter:description', besk)):
            v = meta(huvud, attr, namn)
            if v is not None and v != ska:
                fel.append('%s: %s säger "%s", sidan "%s"' % (fil, namn, v, ska))

    for fil, (titel, besk) in sidor.items():
        if titel and titlar[titel] > 1:
            fel.append('%s: samma titel som en annan sida: "%s"' % (fil, titel))
        if besk and beskrivningar[besk] > 1:
            fel.append('%s: samma beskrivning som en annan sida' % fil)

    if fel:
        print('FEL i titlarna och beskrivningarna:')
        for f in fel:
            print('  ' + f)
        return 1
    print('ok: %d sidor, titlarna högst %d px och beskrivningarna högst %d px'
          % (len(sidor), textbredd.TITEL_GRANS, textbredd.BESKRIVNING_GRANS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
