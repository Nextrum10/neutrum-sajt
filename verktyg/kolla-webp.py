# -*- coding: utf-8 -*-
"""Kollar att varje bilder/*.jpg har en webp bredvid sig, och att den
   inte är äldre än sin jpg.

       python3 verktyg/kolla-webp.py

Sidorna serverar bilderna genom <picture>: en <source type="image/webp">
först, <img> med jpg som reserv. Saknas webp-filen faller webbläsaren
tillbaka på jpg:en och INGENTING GÅR SÖNDER — sidan blir bara tre gånger
tyngre, tyst, på precis de bilder man glömde. Det är den sortens fel
ingen upptäcker, för den enda symptomet är en siffra ingen tittar på.

Bara ATT filen finns kontrolleras. Två saker gör INTE det:

· Innehållet. En bildkodare ger inte samma bytes mellan versioner, så
  `git diff --exit-code` — tricket som vaktar maskotsvaren och
  FAQ-schemat — hade blivit rött av sig självt vid varje uppgradering
  av cwebp.

· Åldern. En jämförelse av mtime hade varit frestande, men i CI är
  varje fil lika gammal: `actions/checkout` skriver dem i godtycklig
  ordning inom samma sekunder, så en webp kan se äldre ut än sin jpg
  utan att något är fel. Ett prov som är rött ungefär var tredje gång
  slutar man läsa, och då hade det varit värre än inget prov.
  Att webp:en är FÄRSK vaktas i stället av bygg-webp.py, som bygger om
  allt som är äldre än sin jpg. Kör den när du rört en bild.
"""
import os, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'bilder')


def main():
    if not os.path.isdir(MAPP):
        print('bilder/ finns inte.')
        return 1

    saknas, tomma, n = [], [], 0
    for f in sorted(os.listdir(MAPP)):
        if not f.endswith('.jpg'):
            continue
        n += 1
        jpg = os.path.join(MAPP, f)
        webp = jpg[:-4] + '.webp'
        if not os.path.exists(webp):
            saknas.append(f)
        elif os.path.getsize(webp) == 0:
            tomma.append(f)

    if saknas:
        print('SAKNAR WEBP (%d):' % len(saknas))
        for f in saknas:
            print('  bilder/' + f)
    if tomma:
        print('TOM WEBP (%d):' % len(tomma))
        for f in tomma:
            print('  bilder/' + f[:-4] + '.webp')
    if saknas or tomma:
        print('\nKör: python3 verktyg/bygg-webp.py')
        return 1

    print('ok   %d jpg, alla med en webp bredvid sig' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
