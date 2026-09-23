# -*- coding: utf-8 -*-
"""Gör en .webp bredvid varje bilder/*.jpg.

       python3 verktyg/bygg-webp.py            # bara det som saknas
       python3 verktyg/bygg-webp.py --alla     # gör om allt

VARFÖR

Mätt i webbläsaren, startsidan på en telefon 390px bred med DPR 3:
1,06 MB bilder, alltså MER än samma sida på en 1440px-skärm hämtar.
srcset och sizes är rätt satta — det är inte ett fel i markupen, det
är formatet. Samma foton som WebP q82 väger 69 % mindre, och de två
går inte att skilja åt med ögat (prövat sida vid sida på
05-av-unga-for-unga-1280: 199 kB mot 51 kB).

Sidorna serverar båda genom <picture>: webbläsare som inte kan WebP
får JPG:en som förut. Det är därför jpg-filerna ligger kvar.

KVALITETEN ÄR 82, INTE 78. 78 vägde 40 kB i stället för 51 och såg
också bra ut, men originalen är redan komprimerade en gång och varje
omkodning kostar. Marginalen är billigare än en bild som ser trött ut
på en retinaskärm.

VERKTYGET

Samma sort som satt-logga.py: körs för hand när bilder läggs till,
inte i CI. Det behöver en kodare på maskinen och tar den första som
finns av cwebp, magick och sips (den sista bara på macOS 13+).

Att den INTE körs i CI är med flit. En bildkodare ger inte samma
bytes mellan versioner, så `git diff --exit-code` — tricket som
vaktar maskotsvaren och FAQ-schemat — hade blivit rött av sig självt
vid varje uppgradering. I stället vaktar verktyg/kolla-webp.py att
varje jpg HAR en webp och att den inte är äldre än sin jpg. Innehållet
litar vi på; att filen finns gör vi inte.
"""
import os, subprocess, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'bilder')
KVALITET = 82


def kodare():
    """Den första kodaren som finns på maskinen, som en lista argument
       där {in} och {ut} byts ut."""
    for namn, arg in (
        ('cwebp',  ['cwebp', '-q', str(KVALITET), '-m', '5', '-quiet', '{in}', '-o', '{ut}']),
        ('magick', ['magick', '{in}', '-quality', str(KVALITET), '{ut}']),
        ('sips',   ['sips', '-s', 'format', 'webp', '-s', 'formatOptions', str(KVALITET),
                    '{in}', '--out', '{ut}']),
    ):
        try:
            subprocess.run([namn, '--version'], capture_output=True, check=False)
        except FileNotFoundError:
            continue
        return namn, arg
    return None, None


def main():
    alla = '--alla' in sys.argv
    namn, mall = kodare()
    if not mall:
        print('Hittar ingen bildkodare. Installera en:\n'
              '  brew install webp        (cwebp)\n'
              '  brew install imagemagick (magick)\n'
              'På macOS 13+ duger också sips, som följer med systemet.')
        return 1

    gjorda, hoppade, fel = 0, 0, []
    for f in sorted(os.listdir(MAPP)):
        if not f.endswith('.jpg'):
            continue
        källa = os.path.join(MAPP, f)
        mål = källa[:-4] + '.webp'
        if not alla and os.path.exists(mål) and os.path.getmtime(mål) >= os.path.getmtime(källa):
            hoppade += 1
            continue
        cmd = [a.replace('{in}', källa).replace('{ut}', mål) for a in mall]
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode != 0 or not os.path.exists(mål):
            fel.append(f + ': ' + (r.stderr.decode('utf-8', 'replace').strip() or 'okänt fel'))
        else:
            gjorda += 1

    if fel:
        print('\n'.join(fel))
        print('\n%d bilder gick inte att koda.' % len(fel))
        return 1

    print('ok   %s: %d bilder kodade, %d var redan aktuella' % (namn, gjorda, hoppade))
    return 0


if __name__ == '__main__':
    sys.exit(main())
