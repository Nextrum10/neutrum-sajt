# -*- coding: utf-8 -*-
"""
Jämför de engelska sidorna mot de svenska.

VARFÖR INTE BARA TITTA: engelskan är genererad genom att textnoder
byts ut, en och en, i en kopia av den svenska filen. Taggsekvensen är
alltså identisk i de två — textnod nummer i på svenska ÄR samma nod på
engelska. Det gör att varje mening går att ställa mot sin översättning
oavsett hur olika de låter.

Skiljer sig antalet noder är det i sig fyndet: då har den svenska
sidan ändrats utan att engelskan följt med, och det syns inte på
sidan. Inga konsolfel, inga trasiga länkar, bara innehåll som inte
finns.

    python3 verktyg/jamfor-sprak.py            # alla sidpar
    python3 verktyg/jamfor-sprak.py index.html # ett par
"""
import io, os, re, sys
from html.parser import HTMLParser

# Script och style innehåller kod, inte innehåll. Generatorn maskerar
# dem, så deras text ska INTE jämföras här — den skillnaden är
# avsiktlig och skulle dränka de riktiga fynden.
HOPPA = {'script', 'style'}


class Noder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.taggar = []      # sekvensen av starttaggar
        self.texter = []      # (index i taggsekvensen, text)
        self._djup_hoppa = 0

    def handle_starttag(self, tag, attrs):
        self.taggar.append(tag)
        if tag in HOPPA:
            self._djup_hoppa += 1

    def handle_endtag(self, tag):
        if tag in HOPPA and self._djup_hoppa:
            self._djup_hoppa -= 1

    def handle_data(self, data):
        if self._djup_hoppa:
            return
        s = re.sub(r'\s+', ' ', data).strip()
        if s:
            self.texter.append((len(self.taggar), s))


def las(sokvag):
    n = Noder()
    n.feed(io.open(sokvag, encoding='utf-8').read())
    return n


def jamfor(sv_fil, en_fil):
    sv, en = las(sv_fil), las(en_fil)
    fynd = []

    if sv.taggar != en.taggar:
        # var skiljer de sig först?
        for i, (a, b) in enumerate(zip(sv.taggar, en.taggar)):
            if a != b:
                fynd.append('STRUKTUR skiljer sig vid tagg %d: sv <%s> vs en <%s>' % (i, a, b))
                break
        else:
            fynd.append('STRUKTUR: olika antal taggar, sv %d vs en %d'
                        % (len(sv.taggar), len(en.taggar)))

    if len(sv.texter) != len(en.texter):
        fynd.append('TEXTNODER: sv %d vs en %d — engelskan har inte följt med'
                    % (len(sv.texter), len(en.texter)))

    # Identisk text på båda språken är ofta en oöversatt mening.
    # Egennamn, siffror och adresser är undantagen och sållas bort.
    ooversatt = []
    for (i_sv, a), (i_en, b) in zip(sv.texter, en.texter):
        if a != b:
            continue
        if re.fullmatch(r'[\W\d\s·—–:/|,.·]+', a):
            continue
        if a.lower() in ('nextrum', 'sv', 'eng', 'e-post', 'ok', 'cv', 'faq',
                         'info@nextrum.se', 'stockholm'):
            continue
        if len(a) < 12:
            continue
        ooversatt.append(a)
    if ooversatt:
        fynd.append('SVENSKA KVAR i engelskan, %d stycken:' % len(ooversatt))
        for s in ooversatt[:12]:
            fynd.append('    ' + (s[:110] + ('…' if len(s) > 110 else '')))

    return fynd


def main():
    if len(sys.argv) > 1:
        par = [(a, os.path.join('en', a)) for a in sys.argv[1:]]
    else:
        par = [(f, os.path.join('en', f))
               for f in sorted(os.listdir('.'))
               if f.endswith('.html') and os.path.exists(os.path.join('en', f))]

    total = 0
    for sv_fil, en_fil in par:
        fynd = jamfor(sv_fil, en_fil)
        if fynd:
            total += 1
            print('\n=== %s  ->  %s' % (sv_fil, en_fil))
            for f in fynd:
                print('  ' + f)
        else:
            print('ok   %s' % sv_fil)
    print('\n%d av %d sidpar har avvikelser.' % (total, len(par)))
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
