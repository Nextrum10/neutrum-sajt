# -*- coding: utf-8 -*-
"""Kollar att varje öppen sida delas med sin egen delningsbild.

       python3 verktyg/kolla-delningsbilder.py

Sedan 2026-10-07 har varje sida i sitemap.xml en bild i delning/ med
sidans rubrik och en rad med priset (verktyg/bygg-delningsbilder.js).
Bilden byggs för hand, så den kan bli kvar med en gammal rubrik eller
ett gammalt pris utan att någon ser det: den syns först när någon
delar länken. Det här ser till att

  · varje sida i kartan har og:image och twitter:image på sin bild
    i delning/, 1200 × 630, och att filen finns
  · rubriken i delning/innehall.json är sidans <h1>
  · priset i bilderna är PRIS_PER_TIMME i nextrum-config.js

Faller den: kör NODE_PATH="$(npm root -g)" node verktyg/bygg-delningsbilder.js
och, för en handskriven sida, sätt taggarna som de andra sidorna har dem.
"""
import html, io, json, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def las(p):
    return io.open(os.path.join(ROT, p), encoding='utf-8').read()


def rubrik_ur(sida):
    """Samma regel som bygg-delningsbilder.js."""
    m = re.search(r'<h1[^>]*>(.*?)</h1>', sida, re.S)
    if not m:
        return None
    t = re.sub(r'<br\s*/?>', ' ', m.group(1), flags=re.I)
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    return re.sub(r'\s+', ' ', t).strip()


def sidor_i_kartan():
    for v in re.findall(r'<loc>https://nextrum\.se/([^<]*)</loc>', las('sitemap.xml')):
        yield 'index.html' if v == '' else 'en/index.html' if v == 'en/' else v + '.html'


def main():
    fel = []
    pris = int(re.search(r'PRIS_PER_TIMME:\s*(\d+)', las('nextrum-config.js')).group(1))
    try:
        innehall = json.loads(las('delning/innehall.json'))
    except (OSError, ValueError) as e:
        print('FEL: delning/innehall.json går inte att läsa (%s)' % e)
        return 1
    if innehall.get('pris') != pris:
        fel.append('bilderna är byggda med %s kr i timmen, nextrum-config.js säger %d'
                   % (innehall.get('pris'), pris))

    sidor = list(sidor_i_kartan())
    for fil in sidor:
        sida = las(fil)
        e = innehall.get('sidor', {}).get(fil)
        if not e:
            fel.append('%s har ingen delningsbild' % fil)
            continue
        url = 'https://nextrum.se/' + e['bild']
        for tagg in ('<meta property="og:image" content="%s">' % url,
                     '<meta name="twitter:image" content="%s">' % url,
                     '<meta property="og:image:width" content="1200">',
                     '<meta property="og:image:height" content="630">'):
            if tagg not in sida:
                fel.append('%s saknar %s' % (fil, tagg))
        if not os.path.exists(os.path.join(ROT, e['bild'])):
            fel.append('%s finns inte' % e['bild'])
        if rubrik_ur(sida) != e['rubrik']:
            fel.append('%s: bilden säger "%s", sidan "%s"' % (fil, e['rubrik'], rubrik_ur(sida)))
        tal = re.findall(r'\d+', e['rad'])
        if tal and int(tal[0]) != pris:
            fel.append('%s: bilden säger %s, priset är %d' % (fil, tal[0], pris))

    if fel:
        print('FEL i delningsbilderna:')
        for f in fel:
            print('  ' + f)
        print('Kör NODE_PATH="$(npm root -g)" node verktyg/bygg-delningsbilder.js')
        return 1
    print('ok   %d sidor delas med sin egen bild, med sidans rubrik och %d kr i timmen' % (len(sidor), pris))
    return 0


if __name__ == '__main__':
    sys.exit(main())
