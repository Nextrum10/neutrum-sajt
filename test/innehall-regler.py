# -*- coding: utf-8 -*-
"""Om oss säger bara det som är sant.

       python3 test/innehall-regler.py

Om oss (/om-oss) skrevs 2026-10-22 efter en regel: varje påstående ska gå att visa i koden
eller i sajtens egen text, och det vi inte kan visa står inte där. Vi är
nya, så det finns inga antal, inga omdömen och inga resultat att peka på,
och en mening som låter som om de fanns är ett löfte vi inte kan hålla.

Det här faller på det som brukar smyga sig in när någon putsar en text:

  · namn och titlar (vem som driver Nextrum står inte på sidorna)
  · procent, och siffror före elever, familjer, timmar eller betyg
  · bevisat, garanterat och garanti, "forskning visar", tusentals, bäst
  · kronbelopp (priset står på prissidan och läses ur konfigen)
  · tankstreck
  · bakgrundskontroll och registerutdrag (vi gör inga)
  · omdöme, utom i rutan Vi är nya, som säger att det inte finns några

En platshållare ([data-platshallare]) prövas inte: den ska bytas ut och
skrivs ut som en påminnelse.

Startsidans exempel, "Så ser ni att det funkar" (#exempel), prövades här
också, med ekvationerna omräknade, tills det togs bort 2026-10-26 (Leo:
"ta bort den").
"""
import html
import io
import os
import re
import sys
from html.parser import HTMLParser

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TOMMA = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
         'source', 'track', 'wbr'}
# Attribut som läses upp eller syns, och prövas som texten.
LASES = ('aria-label', 'alt', 'title', 'placeholder')

# Namn som står i repot och inte hör hemma på sidorna, och titlar som
# säger vem som driver Nextrum.
NAMN = ['Leo', 'Alex', 'Alexandar', 'Thriskos', 'Trikke', 'Constantinos', 'Zayan']
TITLAR = ['grundare', 'grundarna', 'medgrundare', 'vd', 'ägare', 'delägare', 'ordförande',
          'styrelse', 'styrelsen', 'founder', 'founders', 'ceo', 'rektor']
# Ord med stor bokstav mitt i en mening som är våra egna eller vyns
# knappar. Allt annat med stor bokstav mitt i en mening är ett namn
# tills någon säger annat, och läggs då till här.
EGNA = {'Nextrum', 'NexLäx', 'Stockholm', 'Passar', 'Avböj', 'Öva', 'Nästa', 'Google', 'Meet'}

REGLER = [
    ('procent', r'%|\bprocent\b'),
    ('ett antal elever, familjer, timmar eller betyg',
     r'\d[\d\s.,]*\s*(?:st\.?\s*)?(?:nöjda\s+|glada\s+)?(?:elever|elev|familjer|familj|timmar|timme|betyg)\b'),
    ('bevisat', r'\bbevis'),
    ('garanterat eller garanti', r'garant'),
    ('"forskning visar"', r'forskning(?:en)?\s+visar|studier\s+visar'),
    ('tusentals', r'tusentals|hundratals'),
    ('bäst', r'\bbäst'),
    ('ett kronbelopp', r'\d[\d\s.,]*\s*(?:kr\b|kronor|:-|sek\b)|\bsek\s*\d'),
    ('tankstreck', '[–—]|\\s-\\s'),
    ('bakgrundskontroll', r'bakgrundskontroll'),
    ('registerutdrag', r'registerutdrag|belastningsregist'),
]
OMDOME = r'omdöme'


class Block:
    def __init__(self, var):
        self.var = var          # var i sidan, för felmeddelandet
        self.delar = []         # texten, bit för bit
        self.vi_ar_nya = False
        self.platshallare = False


class Las(HTMLParser):
    """Delar upp ett utsnitt i block: ett per textnod och attribut, med
    vetskap om de omslutande elementen (rutan Vi är nya, platshållare)."""

    def __init__(self, namn):
        super().__init__(convert_charrefs=True)
        self.namn = namn
        self.stack = []         # (tagg, vi_ar_nya, platshallare)
        self.block = []
        self.hoppa = 0

    def lage(self):
        nya = any(s[1] for s in self.stack)
        plats = any(s[2] for s in self.stack)
        return nya, plats

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style', 'svg'):
            self.hoppa += 1
        nya = 'data-vi-ar-nya' in a
        plats = 'data-platshallare' in a
        if tag not in TOMMA:
            self.stack.append((tag, nya, plats))
        nya_nu, plats_nu = self.lage()
        nya_nu = nya_nu or nya
        plats_nu = plats_nu or plats
        for k in LASES:
            if a.get(k):
                b = Block('%s, %s på <%s>' % (self.namn, k, tag))
                b.delar.append(a[k])
                b.vi_ar_nya, b.platshallare = nya_nu, plats_nu
                self.block.append(b)

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'svg') and self.hoppa:
            self.hoppa -= 1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.hoppa:
            return
        s = re.sub(r'\s+', ' ', data).strip()
        if not s:
            return
        b = Block(self.namn)
        b.delar.append(s)
        b.vi_ar_nya, b.platshallare = self.lage()
        self.block.append(b)


def las(p):
    return io.open(os.path.join(ROT, p), encoding='utf-8').read()


def utan_kommentarer(s):
    return re.sub(r'<!--.*?-->', ' ', s, flags=re.S)


def huvudet(s, namn):
    """Titeln och beskrivningarna: det man ser i en sökträff och en delning."""
    ut = []
    t = re.search(r'<title>(.*?)</title>', s, re.S)
    if t:
        b = Block(namn + ', <title>')
        b.delar.append(html.unescape(t.group(1)))
        ut.append(b)
    for m in re.finditer(r'<meta (?:name|property)="([^"]*(?:description|title|image:alt))" content="([^"]*)"', s):
        b = Block('%s, <meta %s>' % (namn, m.group(1)))
        b.delar.append(html.unescape(m.group(2)))
        ut.append(b)
    return ut


def block_i(utsnitt, namn):
    p = Las(namn)
    p.feed(utan_kommentarer(utsnitt))
    return p.block


def prova(blocken, fel, platser):
    for b in blocken:
        text = ' '.join(b.delar)
        if b.platshallare:
            platser.append('%s: %s' % (b.var, text))
            continue
        liten = text.lower()
        for namn, rx in REGLER:
            m = re.search(rx, liten)
            if m:
                fel.append('%s: %s ("%s") i "%s"' % (b.var, namn, m.group(0).strip(), text))
        if re.search(OMDOME, liten) and not b.vi_ar_nya:
            fel.append('%s: omdöme utanför rutan Vi är nya i "%s"' % (b.var, text))
        for ord_ in re.findall(r'[\wåäöÅÄÖ]+', text):
            if ord_ in NAMN or ord_.rstrip('s') in NAMN:
                fel.append('%s: namnet %s i "%s"' % (b.var, ord_, text))
            if ord_.lower() in TITLAR:
                fel.append('%s: titeln %s i "%s"' % (b.var, ord_, text))
        # Stor bokstav mitt i en mening: efter ett ord med liten bokstav
        # eller ett kommatecken, inte efter punkt, kolon eller radens början.
        for m in re.finditer(r'(?<=[a-zåäö,]) ([A-ZÅÄÖ][\wåäö]+)', text):
            if m.group(1) not in EGNA:
                fel.append('%s: "%s" ser ut som ett namn i "%s"' % (b.var, m.group(1), text))


def main():
    fel, platser = [], []

    om = las('om-oss.html')
    main_ = re.search(r'<main\b.*?</main>', om, re.S)
    if not main_:
        print('FEL: om-oss.html har ingen <main>')
        return 1
    prova(huvudet(om, 'om-oss.html'), fel, platser)
    prova(block_i(main_.group(0), 'om-oss.html'), fel, platser)
    # Footern är sajtens, men platshållaren för bolagsuppgifterna står där.
    fot = re.search(r'<footer\b.*?</footer>', om, re.S)
    if fot:
        for b in block_i(fot.group(0), 'om-oss.html, footern'):
            if b.platshallare:
                platser.append('%s: %s' % (b.var, ' '.join(b.delar)))
    if 'data-vi-ar-nya' not in main_.group(0):
        fel.append('om-oss.html: rutan Vi är nya ([data-vi-ar-nya]) saknas')

    for p in platser:
        print('PLATSHÅLLARE  ' + p)
    if fel:
        print('FEL i innehållet:')
        for f in fel:
            print('  ' + f)
        return 1
    print('ok   Om oss följer innehållsreglerna, %d platshållare kvar' % len(platser))
    return 0


if __name__ == '__main__':
    sys.exit(main())
