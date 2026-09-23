# -*- coding: utf-8 -*-
"""Stämplar ?v=<innehållssumma> på varje egen .js och .css i sidorna.

       python3 verktyg/satt-version.py            # skriver
       python3 verktyg/satt-version.py --kolla    # bara rapport, ändrar inget

VARFÖR DET HÄR FINNS

klientfel i driften bär fyra rader

    Uncaught TypeError: NX.initDrag is not a function
    at https://nextrum.se/:987:6

från fyra olika dagar. Raden det gäller är NX.initDrag() i startsidans
egna skript, och funktionen står i exportlistan i nextrum-app.js. Båda
kom i SAMMA commit. I en riktig driftsättning kan det alltså inte kasta.

Det som kan hända är att en besökare får NY html och GAMMAL javascript.
vercel.json ger .js och .css `max-age=300`, html revalideras alltid, och
filnamnen är oförändrade mellan versioner. Efter varje driftsättning
finns därför ett fönster där webbläsaren anser sin kopia av
nextrum-app.js färsk nog att återanvända, medan sidan runt den är ny.
Då dör hela det inline-skriptet på första raden som rör det som saknas,
och ALLT under den raden slutar köras — på startsidan initVagval,
bildIntoning och stegsektionen.

Med ?v=<summa> är adressen en annan så fort filens innehåll ändrats.
Den gamla kopian i cachen kan då inte längre matcha den nya sidan, och
hela felklassen försvinner. Ändras filen inte ändras inte heller
summan, så cachen behålls.

VAD SOM STÄMPLAS

Bara våra egna nextrum-*.js och nextrum-*.css. bibliotek/ och typsnitt/
bär redan version i filnamnet och är `immutable` i vercel.json, och
bilderna cachas en månad utan att någon sida beror på deras innehåll.

Verktyget är idempotent: en befintlig ?v= skrivs över, inte staplas.
CI kör det och gör `git diff --exit-code`, precis som för maskotsvaren
och FAQ-schemat. Ändrar du en js- eller css-fil utan att köra det blir
bygget rött — vilket är hela poängen, för annars är stämpeln gammal och
gör ingen nytta.
"""
import hashlib, io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# src="nextrum-app.js"  eller  href="../nextrum-vy.css", med eller utan
# en gammal ?v=. Gruppen (prefix)(fil)(ev. gammal fråga).
MONSTER = re.compile(r'(?P<attr>\b(?:src|href)=")(?P<pre>(?:\.\./)?)(?P<fil>nextrum-[a-z0-9-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(?=")')


def summa(sokvag):
    with open(sokvag, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def sidor():
    ut = [f for f in sorted(os.listdir(ROT)) if f.endswith('.html')]
    en = os.path.join(ROT, 'en')
    if os.path.isdir(en):
        ut += [os.path.join('en', f) for f in sorted(os.listdir(en)) if f.endswith('.html')]
    return ut


def main():
    kolla = '--kolla' in sys.argv
    saknade, andrade, stamplar = [], [], 0

    for sida in sidor():
        full = os.path.join(ROT, sida)
        s = io.open(full, encoding='utf-8').read()

        def byt(m):
            global_fil = os.path.join(ROT, m.group('fil'))
            if not os.path.exists(global_fil):
                saknade.append('%s → %s' % (sida, m.group('fil')))
                return m.group(0)
            return '%s%s%s?v=%s' % (m.group('attr'), m.group('pre'),
                                    m.group('fil'), summa(global_fil))

        ny, n = MONSTER.subn(byt, s)
        stamplar += n
        if ny != s:
            andrade.append(sida)
            if not kolla:
                io.open(full, 'w', encoding='utf-8').write(ny)

    if saknade:
        print('FILER SOM INTE FINNS:')
        for r in saknade:
            print('  ' + r)
        return 1

    if kolla:
        if andrade:
            print('INAKTUELL VERSIONSSTÄMPEL i %d sidor:' % len(andrade))
            for f in andrade:
                print('  ' + f)
            print('\nKör: python3 verktyg/satt-version.py')
            return 1
        print('ok   %d versionsstämplar är aktuella' % stamplar)
        return 0

    print('ok   %d versionsstämplar i %d sidor (%d sidor ändrade)'
          % (stamplar, len(sidor()), len(andrade)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
