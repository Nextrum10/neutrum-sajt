# -*- coding: utf-8 -*-
"""Kopplar in Nextrums riktiga logotyp överallt Google och webbläsare
   letar efter den.

   ANVÄNDNING

     1. Spara den kvadratiska loggan som  bilder/nextrum-logo.png
        (helst minst 512x512, gärna 1024x1024)
     2. python3 verktyg/satt-logga.py

   Skriptet gör resten: skalar fram de storlekar som behövs, lägger in
   ikonlänkarna på alla sidor och pekar om den strukturerade datan.

   VARFÖR FLERA STORLEKAR

   Google visar faviconen bredvid söketräffen och vill ha minst 48x48,
   helst en multipel av 48. Safari på iOS använder apple-touch-icon i
   180x180 när sidan sparas på hemskärmen. Android hämtar 192 och 512.
   En enda fil i fel storlek blir suddig i minst ett av lägena.

   Den strukturerade datans "logo" är en annan sak än faviconen: den
   går till kunskapspanelen, inte till ikonen bredvid träffen. Båda
   pekas om här.
"""
import io, os, re, sys, glob, json, subprocess

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KÄLLA = os.path.join(ROT, 'bilder', 'nextrum-logo.png')

# (filnamn, storlek, vad den används till)
STORLEKAR = [
    ('bilder/nextrum-logo-512.png', 512, 'strukturerad data, delning'),
    ('bilder/nextrum-logo-192.png', 192, 'Android'),
    ('apple-touch-icon.png',        180, 'iOS hemskärm'),
    ('favicon-96.png',               96, 'favicon, hög upplösning'),
    ('favicon-48.png',               48, 'favicon, Googles minimum'),
]

IKONLÄNKAR = (
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
    '<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">\n'
    '<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
    '<link rel="mask-icon" href="/favicon.svg" color="#2E2A20">\n'
)


def mått(p):
    ut = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', p],
                        capture_output=True, text=True).stdout
    b = re.search(r'pixelWidth:\s*(\d+)', ut)
    h = re.search(r'pixelHeight:\s*(\d+)', ut)
    return (int(b.group(1)), int(h.group(1))) if b and h else (0, 0)


def main():
    if not os.path.exists(KÄLLA):
        sys.exit('Saknar %s\n\nSpara den kvadratiska loggan där först, minst 512x512.'
                 % os.path.relpath(KÄLLA, ROT))

    b, h = mått(KÄLLA)
    if b < 512 or h < 512:
        print('VARNING: källan är %dx%d. Under 512x512 blir de stora '
              'storlekarna uppskalade och suddiga.' % (b, h))
    if abs(b - h) > 2:
        print('VARNING: källan är inte kvadratisk (%dx%d). Google beskär '
              'faviconen till en kvadrat, så något kommer att kapas.' % (b, h))

    for namn, px, vad in STORLEKAR:
        mål = os.path.join(ROT, namn)
        os.makedirs(os.path.dirname(mål), exist_ok=True)
        subprocess.run(['sips', '-s', 'format', 'png', '-z', str(px), str(px),
                        KÄLLA, '--out', mål], capture_output=True)
        print('  %-32s %4d px   %s' % (namn, px, vad))

    # --- ikonlänkarna på alla sidor
    gammal = re.compile(
        r'<link rel="icon" href="/favicon\.svg" type="image/svg\+xml">\n'
        r'(?:<link rel="icon"[^>]*>\n|<link rel="apple-touch-icon"[^>]*>\n)*'
        r'<link rel="mask-icon"[^>]*>\n')
    n = 0
    for p in sorted(glob.glob(os.path.join(ROT, '*.html'))
                    + glob.glob(os.path.join(ROT, 'en', '*.html'))):
        s = io.open(p, encoding='utf-8').read()
        ny = gammal.sub(IKONLÄNKAR, s, count=1)
        if ny != s:
            io.open(p, 'w', encoding='utf-8').write(ny)
            n += 1
    print('\n  ikonlänkar uppdaterade på %d sidor' % n)

    # --- strukturerad data pekar om till den riktiga loggan
    for p in ('index.html', 'en/index.html'):
        full = os.path.join(ROT, p)
        s = io.open(full, encoding='utf-8').read()
        m = re.search(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', s, re.S)
        if not m:
            continue
        d = json.loads(m.group(2))
        d['@graph'][0]['logo'] = {
            '@type': 'ImageObject',
            'url': 'https://nextrum.se/bilder/nextrum-logo-512.png',
            'width': 512, 'height': 512,
        }
        io.open(full, 'w', encoding='utf-8').write(
            s[:m.start(2)] + json.dumps(d, ensure_ascii=False, indent=2) + s[m.end(2):])
        print('  strukturerad data: %s -> nextrum-logo-512.png' % p)

    print('\nKlart. Commita, pusha, och begär omindexering i Search Console —\n'
          'Google hämtar om faviconen först när den kryper sidan på nytt.')


if __name__ == '__main__':
    main()
