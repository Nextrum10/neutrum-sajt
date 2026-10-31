#!/usr/bin/env python3
"""Bygger llms.txt ur sidorna själva.

    python3 verktyg/bygg-llms.py

VARFÖR

ChatGPT, Perplexity, Claude och Googles AI-svar läser sajten för att svara
på frågor som "vad kostar läxhjälp i Stockholm". De läser HTML som allt
annat, men en kort textfil i roten med vad Nextrum är och vilka sidor som
svarar på vad är lättare att citera rätt än tusen rader markup med
animationer. llms.txt är förslaget till den filen (llmstxt.org). Ingen
motor har lovat att läsa den, så den gör ingen skada och kostar lite.

VAD SOM STÅR DÄR

Överst några rader fakta, bara sådant som redan står på sajten: priset,
planerna, syskontillägget, gången från intresseanmälan till pass, den sena
avbokningen och betalningen. Siffrorna läses ur nextrum-config.js och
prissidans text, så filen kan inte säga ett annat pris än sidan. Under
dem en länk per sida i sitemap.xml, med sidans egen titel och
beskrivning, i grupper. Inga antal, omdömen eller löften som sajten inte
ger (CLAUDE.md avsnitt 8).

CI kör skriptet och gör git diff --exit-code, som med sitemapen. Kör det
efter bygg-sitemap.py.
"""

import html
import os
import re
import sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KARTA = os.path.join(ROT, 'sitemap.xml')
UT = os.path.join(ROT, 'llms.txt')
DOMAN = 'https://nextrum.se'

AMNEN = {'matematik', 'svenska', 'engelska', 'moderna-sprak', 'no', 'so'}
STADIER = {'lagstadiet', 'mellanstadiet', 'hogstadiet', 'gymnasiet'}
# Läxhjälpssidor som är guider och inte en ort.
LAX_GUIDER = {'eller-privatlarare', 'efter-sommarlovet', 'online'}
KARNA = ['/', '/sa-fungerar-nextrum', '/priser', '/faq', '/for-elever-och-foraldrar',
         '/var-ide', '/om-oss', '/prova-nexlax', '/intresseanmalan', '/bli-studiehjalpare',
         '/laxhjalp-stockholm', '/vad-kostar-laxhjalp']
JURIDIK = {'/anvandarvillkor', '/integritetspolicy', '/lagring'}


def las(p):
    return open(p, encoding='utf-8').read()


def fil_for(sokvag):
    if sokvag == '/':
        return 'index.html'
    if sokvag == '/en/':
        return 'en/index.html'
    return sokvag.lstrip('/') + '.html'


def meta(s, namn):
    m = re.search(r'<meta name="%s" content="([^"]*)"' % namn, s)
    return html.unescape(m.group(1)) if m else ''


def titel(s):
    m = re.search(r'<title>(.*?)</title>', s, re.S)
    t = html.unescape(m.group(1)).strip() if m else ''
    return re.sub(r'\s*\|\s*Nextrum$', '', t)


def konfig(namn):
    m = re.search(r'\b%s:\s*(\d+)' % namn, las(os.path.join(ROT, 'nextrum-config.js')))
    if not m:
        sys.exit('bygg-llms: hittar inte %s i nextrum-config.js' % namn)
    return int(m.group(1))


def planpris():
    # Planernas pris står i databasen (erbjudanden_pris); prissidans text
    # säger det i en mening, och filen följer sidan i stället för att gissa.
    m = re.search(r'kostar\s+alla\s+paket\s+(\d+)\s+kr\s+i\s+timmen', las(os.path.join(ROT, 'priser.html')))
    if not m:
        sys.exit('bygg-llms: hittar inte planernas pris i priser.html')
    return int(m.group(1))


def kolla_schemapriser(timpris, plan):
    # Prissidornas Offer-märkning (pass för pass och planen) skrivs för hand.
    # AI-sökmotorerna läser den lika gärna som texten, så den får inte säga
    # ett annat pris än configen och prissidans mening.
    for fil in ('priser.html', 'en/priser.html'):
        s = las(os.path.join(ROT, fil))
        priser = set()
        for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
            priser |= {int(p) for p in re.findall(r'"price":\s*"(\d+)"', block)}
        if priser != {timpris, plan}:
            sys.exit('bygg-llms: Offer-märkningen i %s säger %s, sajten %d och %d'
                     % (fil, sorted(priser), timpris, plan))


def grupp(sokvag):
    if sokvag.startswith('/en/'):
        return 'en'
    if sokvag in JURIDIK:
        return 'juridik'
    if sokvag in KARNA:
        return 'karna'
    namn = sokvag.lstrip('/')
    if namn.startswith('laxhjalp-'):
        rest = namn[len('laxhjalp-'):]
        if rest in AMNEN:
            return 'amnen'
        if rest in STADIER:
            return 'stadier'
        if rest in LAX_GUIDER:
            return 'guider'
        return 'orter'
    return 'guider'


RUBRIKER = [
    ('karna', 'Om Nextrum, pris och hur det går till'),
    ('amnen', 'Läxhjälp per ämne'),
    ('stadier', 'Läxhjälp per stadium'),
    ('orter', 'Läxhjälp per område i Stockholms län'),
    ('guider', 'Guider för föräldrar'),
    ('en', 'In English'),
    ('juridik', 'Villkor och integritet'),
]


def main():
    adresser = re.findall(r'<loc>([^<]+)</loc>', las(KARTA))
    grupper = {k: [] for k, _ in RUBRIKER}
    for url in adresser:
        sokvag = url[len(DOMAN):] or '/'
        s = las(os.path.join(ROT, fil_for(sokvag)))
        grupper[grupp(sokvag)].append((sokvag, titel(s), meta(s, 'description')))
    grupper['karna'].sort(key=lambda r: KARNA.index(r[0]))

    timpris = konfig('PRIS_PER_TIMME')
    syskon = konfig('PRIS_SYSKON_TILLAGG_KR_PER_TIMME')
    plan = planpris()
    kolla_schemapriser(timpris, plan)

    rader = [
        '# Nextrum',
        '',
        '> Nextrum är läxhjälp i Stockholm och online för elever från lågstadiet till gymnasiet. '
        'Nextrum matchar varje elev med en studiehjälpare som själv nyligen läst samma kurser, '
        'och eleven får en studieplan och en rapport efter varje pass. '
        'Avtalspart är Nextrum AB (org.nr 559609-3269).',
        '',
        '## Fakta',
        '',
        '- Pris pass för pass: %d kr i timmen, samma pris oavsett ämne och var i Stockholm, utan bindning. '
        'Det är priset, inte ett från-pris.' % timpris,
        '- Planer: 4, 8 eller 12 timmar i månaden för %d kr i timmen, en månad i taget. '
        'Timmarna betalas i förväg och gäller i 30 dagar. Den första planen en familj köper får en timme gratis.' % plan,
        '- Syskon på samma pass: %d kr i timmen extra, lika mycket för ett som för två syskon.' % syskon,
        '- Matchning, studieplan, bokning och rapport efter varje pass ingår i priset.',
        '- Betalning: ett pass betalas med kort eller Klarna när studiehjälparen har bekräftat tiden, '
        'eller med timmarna i en plan.',
        '- Avbokning: ett pass som avbokas mindre än 12 timmar före start räknas som hållet i halva tiden.',
        '- Betygsgaranti finns, med villkor: https://nextrum.se/anvandarvillkor#betygsgaranti',
        '- Studiehjälparna har minst börjat gymnasiet. På sajten heter de studiehjälpare, inte lärare.',
        '- Så börjar man: familjen skickar en intresseanmälan, Nextrum ringer upp och väljer studiehjälpare, '
        'och sedan bokas passen i familjens inloggade vy. Det finns ingen katalog att välja studiehjälpare ur.',
        '- Mellan passen övar eleven i NexLäx, uppgifter i familjens inloggade vy.',
        '- Kontakt: info@nextrum.se. Intresseanmälan: https://nextrum.se/intresseanmalan',
        '',
    ]
    for nyckel, rubrik in RUBRIKER:
        if not grupper[nyckel]:
            continue
        rader += ['## ' + rubrik, '']
        for sokvag, t, beskrivning in grupper[nyckel]:
            rad = '- [%s](%s%s)' % (t, DOMAN, sokvag)
            if beskrivning:
                rad += ': ' + beskrivning
            rader.append(rad)
        rader.append('')

    text = '\n'.join(rader).rstrip('\n') + '\n'
    with open(UT, 'w', encoding='utf-8') as f:
        f.write(text)


if __name__ == '__main__':
    main()
