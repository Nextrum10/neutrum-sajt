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

ATTRIBUTNAMNEN JÄMFÖRS OCKSÅ, och det är en dyrköpt rad. Generatorn
byter textnoder, inte attribut — men den som översätter för hand gör
det, och skriver då ibland fel attribut. Den engelska startsidan hade
<div role="img" alt="..."> där svenskan hade aria-label: alt betyder
ingenting på en div, så illustrationen var en namnlös bild för
skärmläsare på ett av två språk. Taggsekvensen var identisk, texten
var översatt, och verktyget sa ok. Det enda som såg det var axe, och
axe körs inte i CI.
"""
import difflib, io, os, re, sys
from html.parser import HTMLParser

# Script och style innehåller kod, inte innehåll. Generatorn maskerar
# dem, så deras text ska INTE jämföras här — den skillnaden är
# avsiktlig och skulle dränka de riktiga fynden.
HOPPA = {'script', 'style'}


class Noder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.taggar = []      # sekvensen av starttaggar
        self.attribut = []    # samma index: mängden attributNAMN på taggen
        self.texter = []      # (index i taggsekvensen, text)
        self._djup_hoppa = 0

    def handle_starttag(self, tag, attrs):
        self.taggar.append(tag)
        self.attribut.append(frozenset(a for a, _ in attrs))
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

    # Attributnamnen, tagg för tagg. Sekvenserna radas upp med difflib
    # först: språkväljaren skiljer sig med flit (<b>SV</b> mot <a>), och
    # utan uppradning hade allt efter den punkten förskjutits ett steg
    # och gett en sida full av falska fynd.
    lika = difflib.SequenceMatcher(None, sv.taggar, en.taggar, autojunk=False)
    for op, i1, i2, j1, _ in lika.get_opcodes():
        if op != 'equal':
            continue
        for k in range(i2 - i1):
            a, b = sv.attribut[i1 + k], en.attribut[j1 + k]
            if a == b:
                continue
            fynd.append('ATTRIBUT <%s>: bara sv %s, bara en %s'
                        % (sv.taggar[i1 + k], sorted(a - b) or '—', sorted(b - a) or '—'))

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
        # En webbadress, som adressraden i studievyns illustration
        # ("nextrum.se/foralder"), är densamma på båda språken.
        if re.fullmatch(r'[a-z0-9.-]+\.[a-z]{2,}(/[\w./-]*)?', a):
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

    # En svensk sida utan engelsk tvilling hoppades TYST över: villkoret
    # os.path.exists ovan sållar bort den, och CI-steget "Engelskan har
    # följt med" blev grönt på en sajt som tappat ett språk. De tio som
    # saknar tvilling i dag gör det med flit — de tre inloggade vyerna
    # och de sju områdessidorna, som är svenska av SEO-skäl. De listas
    # därför i stället för att fällas, och listan ligger i baslinjen:
    # dyker en ny upp blir diffen röd, och någon måste ta ställning.
    # Det är precis vad som händer den dag en lanseringssida byggs.
    utan_tvilling = [f for f in sorted(os.listdir('.'))
                     if f.endswith('.html') and not f.startswith('_prov')
                     and not os.path.exists(os.path.join('en', f))]

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

    if len(sys.argv) <= 1:
        print('\n=== svenska sidor utan engelsk tvilling: %d' % len(utan_tvilling))
        for f in utan_tvilling:
            print('  ' + f)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
