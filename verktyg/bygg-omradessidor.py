#!/usr/bin/env python3
"""Bygger områdessidorna: /laxhjalp-stockholm och sex stadsdelssidor.

VARFÖR DE GENERERAS OCH INTE SKRIVS FÖR HAND

Sju sidor delar exakt samma skal — huvud, meny, footer, inloggnings-
rutan, skriptraderna. Skrivs de för hand är de sju kopior som ska
hållas i takt med resten av sajten för alltid, och de kommer inte att
hållas i takt. Det har redan hänt en gång med /en/ (se
project-nextrum-engelska i minnet).

Därför: skalet LÄSES UR var-ide.html vid varje körning. Ändrar någon
menyn eller footern där, kör om det här skriptet så följer de sju med.
Det som är eget per sida står i OMRADEN nedan och ingen annanstans.

    python3 verktyg/bygg-omradessidor.py

VAD SOM FÅR STÅ PÅ SIDORNA

Ingenting som inte är sant. Inga antal studiehjälpare, inga betyg,
inga "vi har hjälpt N elever i Farsta", inga skolnamn vi inte
kontrollerat. Stadsdelsnamn och tunnelbanelinjer är kontrollerbara
fakta och står därför; allt annat är samma löfte som resten av sajten
ger, formulerat för ett område.

Det här är avsiktligt tråkigare än vad en SEO-mall hade föreslagit.
Sju sidor som säger samma sak med utbytt ortnamn är precis det Google
kallar doorway pages, och en påhittad siffra på en sådan sida är
dessutom en påhittad siffra.
"""

import os
import re
import sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKAL = os.path.join(ROT, 'var-ide.html')

PRIS_KR = 379
EXTRA_KR = 69

PRIS = f'{PRIS_KR} kr'
EXTRA_BARN = f'{EXTRA_KR} kr'

# Tillägget är FAST när fler än ett barn sitter med, inte per barn:
# två barn och tre barn kostar samma sak, och tre är taket. Så räknar
# servern (familjebelopp() i fakturering lägger på extraOre en gång
# när antalBarn > 1), och sidorna ska säga vad som faktiskt
# faktureras. Summan räknas fram här i stället för att skrivas ut, så
# att ett ändrat pris inte lämnar kvar ett belopp som inte går ihop —
# det var precis så '517 kr' blev kvar när tillägget slutade vara per
# barn.
FLERA_BARN = f'{PRIS_KR + EXTRA_KR} kr'


# ============================================================
# OMRÅDENA
#
# `delar` är stadsdelar och kvarter som folk faktiskt säger när de
# beskriver var de bor. De är sidans lokala substans — och de är
# också vad någon skriver i sökfältet.
#
# `transport` är hur en studiehjälpare tar sig dit. Det är det enda
# stället där sidorna säger något om praktiken som skiljer dem åt på
# riktigt, och det är sant för alla sju.
# ============================================================

OMRADEN = [
    {
        # HANDSKRIVEN, GENERERAS INTE. Posten står kvar för att
        # stadsdelssidornas korslänkar ska kunna peka hit och hämta
        # namn och stadsdelslista härifrån — men main() hoppar över
        # den, se 'handskriven' nedan.
        'handskriven': True,
        'slug': 'laxhjalp-stockholm',
        'namn': 'Stockholm',
        # i_namn bär prepositionen, för den skiljer sig: "i Farsta" men
        # "på Södermalm". Den sätts ihop med "Läxhjälp " på fem ställen,
        # så ett saknat "i" här blev "Läxhjälp Stockholm" i rubriker,
        # korslänkar, breadcrumbs och Service-namnet på en gång.
        'i_namn': 'i Stockholm',
        'nav': 'Stockholm',
        'hub': True,
        'titel': 'Läxhjälp i Stockholm — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Stockholm med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid. '
            'Studieplan och rapport efter varje pass.'
        ),
        'etikett': 'Läxhjälp i Stockholm',
        'h1': 'Läxhjälp i<br><em>Stockholm.</em>',
        'lede': (
            'Vi matchar elever i Stockholm med en studiehjälpare som nyligen läst samma '
            'kurser själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '05-av-unga-for-unga',
        'tint': '#8E8C84',
        'focal': '60% 42%',
        'alt': 'Fyra unga studiehjälpare sitter runt ett bord och arbetar tillsammans i ett ljust rum.',
        'delar': [
            'Södermalm', 'Hammarby Sjöstad', 'Vasastan', 'Östermalm', 'Kungsholmen',
            'Norrmalm', 'Årsta', 'Enskede', 'Farsta', 'Hägersten', 'Liljeholmen',
            'Bromma', 'Solna', 'Nacka',
        ],
        'transport': (
            'Stockholm är stort, och det är den praktiska frågan som avgör om ett pass blir '
            'av på plats eller online. Vi utgår från var eleven bor när vi matchar, så att '
            'resan dit är rimlig för studiehjälparen varje vecka — inte bara första gången.'
        ),
        'faq': [
            ('Vilka delar av Stockholm tar ni pass i?',
             'Vi matchar elever i hela Stockholms stad och i närkommunerna. Om det ska ske '
             'hemma hos er beror på om vi hittar en studiehjälpare som kan ta sig dit med '
             'rimlig restid. Gör vi inte det börjar ni online, och passen fungerar likadant '
             'i övrigt.'),
            ('Kostar det mer om vi bor långt från centrum?',
             f'Nej. Timpriset är {PRIS} oavsett var i Stockholm passet hålls och oavsett ämne. '
             f'Sitter syskon med i samma pass kostar det {EXTRA_BARN} extra i timmen totalt, '
             f'upp till tre barn.'),
            ('Kan vi byta mellan på plats och online?',
             'Ja. Format väljs per pass när ni bokar, så ni kan ta ett pass hemma i veckan och '
             'ett online veckan efter utan att ändra något i avtalet — det finns inget avtal '
             'att ändra.'),
        ],
    },
    {
        'slug': 'laxhjalp-sodermalm',
        'namn': 'Södermalm',
        'i_namn': 'på Södermalm',
        'nav': 'Södermalm',
        'titel': 'Läxhjälp på Södermalm — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp på Södermalm med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp på Södermalm',
        'h1': 'Läxhjälp på<br><em>Södermalm.</em>',
        'lede': (
            'Vi matchar elever på Södermalm med en studiehjälpare som nyligen läst samma '
            'kurser själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '01-en-till-en',
        'tint': '#ACA193',
        'focal': '68% 44%',
        'alt': 'En studiehjälpare och en elev sitter mitt emot varandra vid ett ljust träbord och går igenom en uppgift.',
        'delar': [
            'Mariatorget', 'Hornstull', 'Zinkensdamm', 'Skanstull', 'Medborgarplatsen',
            'Slussen', 'Katarina', 'Sofia', 'Åsö', 'Tanto', 'Reimersholme', 'Långholmen',
        ],
        'transport': (
            'Södermalm är den enklaste delen av stan att ta sig till: röda och gröna linjen '
            'går genom hela ön, och de flesta adresser ligger inom tio minuters promenad från '
            'Slussen, Medborgarplatsen, Mariatorget, Zinkensdamm, Hornstull eller Skanstull. '
            'Det gör att ett pass hemma hos er sällan är en resefråga.'
        ),
        'faq': [
            ('Kommer ni hem till oss på Södermalm?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig hit. Södermalm är väl '
             'täckt av tunnelbanan, så det brukar gå. Kan vi inte lösa det börjar ni online.'),
            ('Vilka ämnen och årskurser gäller det?',
             'Grundskola och gymnasium, och samma timpris oavsett ämne. Matematik är det '
             'vanligaste, men studiehjälparen väljs efter ämnet eleven behöver hjälp med — '
             'inte tvärtom.'),
            ('Hur snabbt kan vi komma igång?',
             'Ni skickar en intresseanmälan, vi går igenom behovet med er och väljer sedan ut '
             'en studiehjälpare. Att fråga kostar ingenting och binder er inte till något.'),
        ],
    },
    {
        'slug': 'laxhjalp-farsta',
        'namn': 'Farsta',
        'i_namn': 'i Farsta',
        'nav': 'Farsta',
        'titel': 'Läxhjälp i Farsta — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Farsta med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Farsta',
        'h1': 'Läxhjälp i<br><em>Farsta.</em>',
        'lede': (
            'Vi matchar elever i Farsta med en studiehjälpare som nyligen läst samma kurser '
            'själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '06-forklaringen',
        'tint': '#9A8E79',
        'focal': '62% 44%',
        'alt': 'En studiehjälpare pekar i ett räknehäfte och förklarar ett steg för eleven bredvid.',
        'delar': [
            'Farsta centrum', 'Farsta strand', 'Hökarängen', 'Gubbängen', 'Sköndal',
            'Fagersjö', 'Larsboda', 'Tallkrogen', 'Svedmyra',
        ],
        'transport': (
            'Gröna linjens södra gren går rakt genom området — Gubbängen, Hökarängen, Farsta '
            'och Farsta strand ligger på rad — och Sköndal och Fagersjö nås med buss därifrån. '
            'En studiehjälpare som bor någonstans längs gröna linjen har alltså en resa utan '
            'byten, vilket är skillnaden mellan ett pass som blir av varje vecka och ett som '
            'inte gör det.'
        ),
        'faq': [
            ('Täcker ni hela Farsta?',
             'Vi matchar elever i Farsta centrum, Farsta strand, Hökarängen, Gubbängen, '
             'Sköndal, Fagersjö och Larsboda. Om passet kan ske hemma hos er avgörs av '
             'matchningen; annars börjar ni online.'),
            ('Går det att få hjälp inför ett nationellt prov?',
             'Ja. Studieplanen skrivs utifrån vad eleven behöver, och ett mål som "trygg med '
             'ekvationer inför provet" är precis den sortens mål den är gjord för. Efter varje '
             'pass får ni en rapport om hur det gick.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, plus {EXTRA_BARN} i timmen om syskon sitter med i samma pass — '
             'samma tillägg upp till tre barn. Ingen bindningstid och ingen månadsavgift. '
             'Se prissidan för vad som ingår.'),
        ],
    },
    {
        'slug': 'laxhjalp-nacka',
        'namn': 'Nacka',
        'i_namn': 'i Nacka',
        'nav': 'Nacka',
        'titel': 'Läxhjälp i Nacka — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Nacka med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Nacka',
        'h1': 'Läxhjälp i<br><em>Nacka.</em>',
        'lede': (
            'Vi matchar elever i Nacka med en studiehjälpare som nyligen läst samma kurser '
            'själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '12-pa-vag',
        'tint': '#73746C',
        'focal': '34% 48%',
        'alt': 'En ung studiehjälpare går med sin väska över axeln på en lugn gata en tidig kväll.',
        'delar': [
            'Sickla', 'Finntorp', 'Järla', 'Nacka Forum', 'Ektorp', 'Orminge', 'Boo',
            'Saltsjöbaden', 'Fisksätra', 'Älta', 'Saltsjö-Duvnäs',
        ],
        'transport': (
            'Nacka nås med Saltsjöbanan från Slussen, med tvärbanan till Sickla, och med '
            'bussarna över Danvikstull. Sickla, Finntorp och Järla ligger nära nog att räknas '
            'som en förlängning av Södermalm restidsmässigt; Orminge, Boo och Saltsjöbaden är '
            'en längre resa, och där är online ofta det som gör att passen blir av varje vecka '
            'i stället för ibland.'
        ),
        'faq': [
            ('Tar ni pass i hela Nacka kommun?',
             'Vi matchar elever i Sickla, Finntorp, Järla, Ektorp, Orminge, Boo, Saltsjöbaden, '
             'Fisksätra och Älta. Hur långt ut passet kan ske hemma hos er beror på vem '
             'matchningen ger — restiden måste hålla varje vecka, inte bara första gången.'),
            ('Är online sämre än att ses?',
             'Nej, men det är annorlunda. Samma studiehjälpare, samma studieplan och samma '
             'rapport efteråt. För de flesta ämnen fungerar det lika bra; för de yngsta eleverna '
             'brukar på plats fungera bättre.'),
            ('Kan ett syskon vara med på samma pass?',
             f'Ja. Tillägget är {EXTRA_BARN} i timmen totalt och gäller upp till tre barn, så två '
             f'barn en timme blir {FLERA_BARN} — och tre barn kostar lika mycket. Det förutsätter '
             'att de kan arbeta med ungefär samma sak.'),
        ],
    },
    {
        'slug': 'laxhjalp-hammarby-sjostad',
        'namn': 'Hammarby Sjöstad',
        'i_namn': 'i Hammarby Sjöstad',
        'nav': 'Hammarby Sjöstad',
        'titel': 'Läxhjälp i Hammarby Sjöstad — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Hammarby Sjöstad med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Hammarby Sjöstad',
        'h1': 'Läxhjälp i<br><em>Hammarby Sjöstad.</em>',
        'lede': (
            'Vi matchar elever i Hammarby Sjöstad med en studiehjälpare som nyligen läst samma '
            'kurser själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '13-kvallsplugg',
        'tint': '#453B28',
        'focal': '46% 44%',
        'alt': 'En elev pluggar vid ett bord i lampsken en mörk kväll, med en studiehjälpare bredvid sig.',
        'delar': [
            'Sickla Udde', 'Sickla Kaj', 'Lumaparken', 'Henriksdal', 'Lugnet',
            'Sjöstadsparterren', 'Hammarbyhöjden', 'Hammarby Allé',
        ],
        'transport': (
            'Tvärbanan går genom hela Sjöstaden, och till Södermalm är det Hammarbyslussen '
            'eller bussen. Det gör området till ett av de enklare att ta sig till på kvällstid, '
            'vilket är när läxhjälp faktiskt sker — efter skolan, före middagen.'
        ),
        'faq': [
            ('Vilka delar av Sjöstaden gäller det?',
             'Sickla Udde, Sickla Kaj, Lumaparken, Lugnet, Henriksdal och Sjöstadsparterren, och '
             'Hammarbyhöjden strax intill. Om passet sker hemma hos er eller online avgörs av '
             'matchningen.'),
            ('Hur sent på kvällen går det att boka?',
             'Ni föreslår en tid mellan sju på morgonen och tio på kvällen, och '
             'studiehjälparen accepterar den eller föreslår en annan. Eftersom '
             'studiehjälparna är gymnasie- och högskolestudenter blir det oftast '
             'eftermiddagar och kvällar.'),
            ('Hur vet vi vad som hände på passet?',
             'Studiehjälparen skriver en rapport efteråt: vad ni gick igenom, hur det gick och '
             'vad som är nästa steg. Ett pass räknas som genomfört först när rapporten är '
             'skriven. Både elev och förälder ser samma rapport i studievyn.'),
        ],
    },
    {
        'slug': 'laxhjalp-bromma',
        'namn': 'Bromma',
        'i_namn': 'i Bromma',
        'nav': 'Bromma',
        'titel': 'Läxhjälp i Bromma — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Bromma med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Bromma',
        'h1': 'Läxhjälp i<br><em>Bromma.</em>',
        'lede': (
            'Vi matchar elever i Bromma med en studiehjälpare som nyligen läst samma kurser '
            'själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '10-forsta-motet',
        'tint': '#948979',
        'focal': '50% 42%',
        'alt': 'En studiehjälpare och en elev hälsar på varandra vid ett köksbord inför sitt första pass.',
        'delar': [
            'Alvik', 'Traneberg', 'Abrahamsberg', 'Åkeshov', 'Brommaplan', 'Ålsten',
            'Höglandet', 'Nockeby', 'Bromma Kyrka', 'Riksby', 'Ulvsunda', 'Mariehäll',
        ],
        'transport': (
            'Gröna linjen går till Alvik, Abrahamsberg, Åkeshov och Brommaplan, och därifrån '
            'tar Nockebybanan vid ut mot Ålsten, Höglandet och Nockeby. Villaområdena västerut '
            'är alltså närmare än de ser ut på kartan, så länge man åker kollektivt och inte '
            'räknar i kilometer.'
        ),
        'faq': [
            ('Vilka delar av Bromma?',
             'Alvik, Traneberg, Abrahamsberg, Åkeshov, Brommaplan, Ålsten, Höglandet, Nockeby, '
             'Bromma Kyrka, Riksby, Ulvsunda och Mariehäll. Om passet sker hemma hos er avgörs '
             'av matchningen.'),
            ('Kan vi få samma studiehjälpare varje gång?',
             'Ja, det är hela poängen. Matchningen är en person, inte en pool — den som kommer '
             'nästa vecka vet vad som var svårt förra veckan, för hen var där.'),
            ('Vad händer om det inte funkar mellan eleven och studiehjälparen?',
             'Säg till oss. Fel match är värre än ingen match, och det är därför vi gör '
             'matchningen åt er i stället för att låta er bläddra i en katalog. Det finns ingen '
             'bindningstid som gör det krångligt att byta.'),
        ],
    },
    {
        'slug': 'laxhjalp-solna',
        'namn': 'Solna',
        'i_namn': 'i Solna',
        'nav': 'Solna',
        'titel': 'Läxhjälp i Solna — hemma hos er eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i Solna med unga studiehjälpare som nyligen läst samma kurser. '
            f'Hemma hos er eller online, {PRIS} i timmen, ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Solna',
        'h1': 'Läxhjälp i<br><em>Solna.</em>',
        'lede': (
            'Vi matchar elever i Solna med en studiehjälpare som nyligen läst samma kurser '
            'själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '07-genombrottet',
        'tint': '#898268',
        'focal': '38% 40%',
        'alt': 'En elev lutar sig tillbaka och ler åt sitt papper i det ögonblick uppgiften lossnar.',
        'delar': [
            'Solna centrum', 'Råsunda', 'Hagalund', 'Huvudsta', 'Bergshamra',
            'Ulriksdal', 'Järvastaden', 'Arenastaden', 'Frösunda', 'Skytteholm',
        ],
        'transport': (
            'Blå linjen går till Solna centrum, Näckrosen och Hallonbergen, pendeltåget stannar '
            'vid Solna station och Ulriksdal, och tvärbanan binder ihop Solna med Sundbyberg och '
            'Alvik. Få områden i Stockholm har fler sätt att ta sig till, vilket gör att en '
            'studiehjälpare sällan behöver bo i Solna för att kunna komma hit varje vecka.'
        ),
        'faq': [
            ('Vilka delar av Solna?',
             'Solna centrum, Råsunda, Hagalund, Huvudsta, Bergshamra, Ulriksdal, Järvastaden, '
             'Arenastaden, Frösunda och Skytteholm. Om passet sker hemma hos er avgörs av '
             'matchningen.'),
            ('Hjälper ni gymnasieelever?',
             'Ja. Studiehjälparna går själva på gymnasiet eller högskolan och har läst kurserna '
             'nyligen — det är särskilt märkbart på gymnasienivå, där den som läste kursen i '
             'fjol minns vilket steg som är det svåra.'),
            ('Måste vi binda upp oss?',
             'Nej. Ingen bindningstid, ingen månadsavgift. Ni betalar för de pass som hålls, '
             f'{PRIS} i timmen, och fakturan kommer från Nextrum.'),
        ],
    },
]


# ============================================================
# SKALET
#
# Allt mellan </head> och <main> är headern; allt mellan </main> och
# </body> är footern, inloggningsrutan och skriptraderna. Båda läses
# ur var-ide.html så att de sju sidorna aldrig kan hamna ur fas med
# resten av sajten utan att någon märker det.
#
# Ikonlänkarna i <head> läses därifrån av samma skäl. De stod förut
# inskrivna i head() nedan, så när verktyg/satt-logga.py lade till
# PNG-ikonerna på alla sidor tog nästa körning av det här skriptet
# bort dem från områdessidorna igen — tyst, för ingen kontroll tittar
# på vilka ikoner en sida har.
# ============================================================

def skal():
    s = open(SKAL, encoding='utf-8').read()
    huvud = s[s.index('<body>') + len('<body>'):s.index('<main id="innehall">')]
    fot = s[s.index('</main>') + len('</main>'):s.index('</body>')]
    return huvud, fot


def ikoner():
    """Blocket från favicon.svg till mask-icon, precis som det står i skalet."""
    s = open(SKAL, encoding='utf-8').read()
    m = re.search(r'<link rel="icon" href="/favicon\.svg"[^\n]*\n'
                  r'(?:<link rel="(?:icon|apple-touch-icon)"[^\n]*\n)*'
                  r'<link rel="mask-icon"[^\n]*\n', s)
    if not m:
        # Hellre inget bygge än sju sidor utan ikon.
        sys.exit(f'hittar inte ikonlänkarna i {SKAL}')
    return m.group(0)


def sprakvaxlare(huvud, slug):
    """Områdessidorna finns bara på svenska.

    Växlaren ska då inte påstå att det finns en engelsk version. Den
    pekar på /en/ i stället — en engelsk besökare hamnar på den
    engelska startsidan i stället för på en 404.
    """
    return huvud.replace('href="/en/var-ide"', 'href="/en/"')


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&quot;'))


def jsonld(o, andra):
    """Service + FAQPage + BreadcrumbList.

    INGEN LocalBusiness och ingen postadress. Nextrum åker hem till
    eleven; ett sådant företag ska enligt Googles egen vägledning
    ange sitt område som serviceområde, inte en besöksadress. En
    adress i markupen hade dessutom varit ett beslut om att lägga ut
    en bostadsadress publikt, och det är inte ett beslut den här
    filen ska fatta.
    """
    fragor = ',\n'.join(
        '        {"@type":"Question","name":%s,'
        '"acceptedAnswer":{"@type":"Answer","text":%s}}' % (jstr(q), jstr(a))
        for q, a in o['faq'])

    omr = ',\n'.join('          {"@type":"Place","name":%s}' % jstr(d)
                     for d in o['delar'])

    return f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "Service",
      "@id": "https://nextrum.se/{o['slug']}#tjanst",
      "name": {jstr('Läxhjälp ' + o['i_namn'])},
      "serviceType": "Läxhjälp",
      "description": {jstr(o['beskrivning'])},
      "provider": {{ "@id": "https://nextrum.se/#org" }},
      "areaServed": [
        {{"@type":"Place","name":{jstr(o['namn'])}}},
{omr}
      ],
      "availableChannel": [
        {{"@type":"ServiceChannel","name":"På plats","serviceLocation":{{"@type":"Place","name":{jstr(o['namn'])}}}}},
        {{"@type":"ServiceChannel","name":"Online","serviceUrl":"https://nextrum.se/intresseanmalan"}}
      ],
      "offers": {{
        "@type": "Offer",
        "priceCurrency": "SEK",
        "price": "379",
        "unitText": "timme",
        "url": "https://nextrum.se/priser",
        "availability": "https://schema.org/InStock"
      }},
      "audience": {{"@type":"EducationalAudience","educationalRole":"student"}}
    }},
    {{
      "@type": "FAQPage",
      "@id": "https://nextrum.se/{o['slug']}#faq",
      "mainEntity": [
{fragor}
      ]
    }},
    {{
      "@type": "BreadcrumbList",
      "itemListElement": [
        {{"@type":"ListItem","position":1,"name":"Nextrum","item":"https://nextrum.se/"}},
        {{"@type":"ListItem","position":2,"name":"Läxhjälp i Stockholm","item":"https://nextrum.se/laxhjalp-stockholm"}}{breadcrumb3(o)}
      ]
    }}
  ]
}}
</script>"""


def breadcrumb3(o):
    if o.get('hub'):
        return ''
    return (',\n        {"@type":"ListItem","position":3,"name":%s,"item":"https://nextrum.se/%s"}'
            % (jstr('Läxhjälp ' + o['i_namn']), o['slug']))


def jstr(t):
    return '"' + t.replace('\\', '\\\\').replace('"', '\\"') + '"'


def head(o):
    bild = f"https://nextrum.se/bilder/{o['bild']}-1280.jpg"
    return f"""<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

{ikoner()}
<title>{esc(o['titel'])}</title>
<meta name="description" content="{esc(o['beskrivning'])}">
<link rel="canonical" href="https://nextrum.se/{o['slug']}">
<!-- Sidan finns bara på svenska. Ingen hreflang="en" här: att peka ut
     en engelsk version som inte finns är sämre än att inte peka alls. -->
<link rel="alternate" hreflang="sv" href="https://nextrum.se/{o['slug']}">
<link rel="alternate" hreflang="x-default" href="https://nextrum.se/{o['slug']}">
<meta name="theme-color" content="#FBFAF8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0C0B" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="geo.region" content="SE-AB">
<meta name="geo.placename" content="{esc(o['namn'])}">

<!-- delning -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Nextrum">
<meta property="og:locale" content="sv_SE">
<meta property="og:title" content="{esc(o['titel'])}">
<meta property="og:description" content="{esc(o['beskrivning'])}">
<meta property="og:url" content="https://nextrum.se/{o['slug']}">
<meta property="og:image" content="{bild}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:image:alt" content="{esc(o['alt'])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(o['titel'])}">
<meta name="twitter:description" content="{esc(o['beskrivning'])}">
<meta name="twitter:image" content="{bild}">

<link rel="stylesheet" href="nextrum-typsnitt.css">

<!-- ordningen spelar roll: bas → startsida → cinema -->
<link rel="stylesheet" href="nextrum.css">
<link rel="stylesheet" href="nextrum-home.css">
<link rel="stylesheet" href="nextrum-cinema.css">
</head>
<body>"""


def andra_omraden(o):
    """Korslänkarna.

    De finns för läsaren som bor i grannområdet, och för att Google
    ska hitta alla sju från vilken som helst av dem. Navsidan länkar
    till alla; en stadsdelssida länkar tillbaka till navet och till
    sina syskon.
    """
    andra = [a for a in OMRADEN if a['slug'] != o['slug']]
    kort = '\n'.join(
        f"""      <a class="nx-omr-kort" href="/{a['slug']}">
        <b>{esc('Läxhjälp ' + a['i_namn'])}</b>
        <span>{esc(', '.join(a['delar'][:4]))} med flera</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
      </a>""" for a in andra)

    rubrik = ('Läxhjälp i resten av Stockholm' if o.get('hub')
              else 'Andra områden')

    return f"""
<section class="sec wrap">
  <div class="rv">
    <span class="nx-et acc">Områden</span>
    <h2 class="nx-d2" style="margin-top:18px">{rubrik}</h2>
    <div class="nx-omr-rutnat" style="margin-top:clamp(24px,3vw,34px)">
{kort}
    </div>
  </div>
</section>
"""


def faq_sektion(o):
    poster = '\n'.join(
        f"""        <div class="faq-item">
          <button class="faq-q" aria-expanded="false">{esc(q)}<span class="pm"></span></button>
          <div class="faq-a"><p>{esc(a)}</p></div>
        </div>""" for q, a in o['faq'])

    return f"""
<section class="sec wrap">
  <div class="rv">
    <span class="nx-et acc">Vanliga frågor</span>
    <h2 class="nx-d2" style="margin-top:18px">{esc('Läxhjälp ' + o['i_namn'])} — det ni brukar undra</h2>
    <div class="faq" style="margin-top:clamp(24px,3vw,34px)">
{poster}
    </div>
    <p class="xsmall" style="margin-top:26px">
      Fler frågor och svar finns på <a href="/faq">FAQ-sidan</a>.
    </p>
  </div>
</section>
"""


def sida(o):
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, o['slug'])

    delar = ''.join(f'<span>{esc(d)}</span>' for d in o['delar'])
    tillbaka = ('<a class="nx-back" href="/"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Till startsidan</a>'
                if o.get('hub') else
                '<a class="nx-back" href="/laxhjalp-stockholm"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Läxhjälp i Stockholm</a>')

    return f"""{head(o)}{huvud}<main id="innehall">

<section class="wrap nx-page-hero">
  {tillbaka}
  <span class="nx-et acc" data-stig style="margin-top:22px">{esc(o['etikett'])}</span>
  <h1 class="nx-d1" data-avslöj>{o['h1']}</h1>
  <p class="nx-lede" data-stig data-fördröj="1">{esc(o['lede'])}</p>
  <figure class="nx-fig nx-page-hero-foto" data-parallax="-6" style="--tint:{o['tint']}">
    <picture><source type="image/webp" srcset="bilder/{o['bild']}-640.webp 640w, bilder/{o['bild']}-960.webp 960w, bilder/{o['bild']}-1280.webp 1280w, bilder/{o['bild']}-1600.webp 1600w, bilder/{o['bild']}-1920.webp 1920w" sizes="(max-width: 900px) 100vw, 92vw"><img class="nx-img" src="bilder/{o['bild']}-1280.jpg"
         srcset="bilder/{o['bild']}-640.jpg 640w, bilder/{o['bild']}-960.jpg 960w, bilder/{o['bild']}-1280.jpg 1280w, bilder/{o['bild']}-1600.jpg 1600w, bilder/{o['bild']}-1920.jpg 1920w"
         sizes="(max-width: 900px) 100vw, 92vw" width="2048" height="1152" fetchpriority="high" decoding="async"
         style="object-position:{o['focal']}" alt="{esc(o['alt'])}"></picture>
  </figure>
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Så går det till</span>
      <h2 class="nx-d2" style="margin-top:18px">En person,<br>inte en katalog.</h2>
    </div>
    <div class="nx-text rv">
      <p>Ni skickar in en intresseanmälan och berättar vad eleven behöver hjälp med. Vi går igenom behovet tillsammans med er och väljer sedan ut den studiehjälpare som passar bäst — utifrån ämne, nivå och person. Ni bläddrar alltså inte bland profiler: fel match är värre än ingen match.</p>
      <p>När matchningen är klar låses studievyn upp. Där ligger studieplanen, kommande pass, meddelanden och rapporten från varje tillfälle. Rapporten skrivs av studiehjälparen efteråt och beskriver vad ni gick igenom och hur det gick — ett pass räknas som genomfört först när den är skriven.</p>
      <p>{esc(o['transport'])}</p>
    </div>
  </div>
</section>

<section class="sec wrap">
  <div class="rv">
    <span class="nx-et acc">Området</span>
    <h2 class="nx-d2" style="margin-top:18px">Var vi matchar elever</h2>
    <div class="nx-omr-chips" style="margin-top:clamp(20px,2.4vw,28px)">{delar}</div>
    <p class="xsmall" style="margin-top:22px;max-width:62ch">
      Om ett pass sker hemma hos er eller online avgörs av matchningen, inte av adressen.
      Hittar vi ingen studiehjälpare som kan ta sig till er varje vecka börjar ni online —
      samma person, samma studieplan, samma rapport efteråt.
    </p>
  </div>
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Priset</span>
      <h2 class="nx-d2" style="margin-top:18px">{PRIS}<br>i timmen.</h2>
    </div>
    <div class="nx-text rv">
      <p>Samma timpris oavsett ämne och oavsett var i Stockholm passet hålls. Sitter syskon med i samma pass kostar det {EXTRA_BARN} extra i timmen totalt — lika mycket för tre barn som för två. Två eller tre barn en timme blir alltså {FLERA_BARN}.</p>
      <p>Ingen bindningstid och ingen månadsavgift. Studieplanen, matchningen och rapporten efter varje pass ingår i timpriset — det är inga tillval. All betalning går genom Nextrum, samlat på ett ställe.</p>
      <p><a href="/priser">Se hela prissidan</a> för vad som ingår och hur faktureringen fungerar.</p>
    </div>
  </div>
</section>
{faq_sektion(o)}{andra_omraden(o)}
<section class="nx-mork nx-final-cinema">
  <div class="nx-wrap-bred">
    <div class="nx-final-inner">
      <span class="nx-et" data-stig>Nästa steg</span>
      <h2 class="nx-final-rubrik" data-avslöj>Redo att ta nästa <em>steg</em>?</h2>
      <p class="nx-lede" data-stig data-fördröj="1" style="margin-top:24px">För dig som vill lära dig mer.
        För dig som vill hjälpa andra.</p>

      <div class="nx-story-ctas" data-stig data-fördröj="2" style="margin-top:clamp(32px,4vw,46px)">
        <span class="nx-magnet">
          <a class="btn btn-primary btn-lg" href="/intresseanmalan">
            Skicka intresseanmälan
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </a>
        </span>
        <a class="btn btn-ghost btn-lg" href="/bli-studiehjalpare">
          Bli studiehjälpare
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </a>
      </div>

      <ul class="nx-hero-trust" data-stig data-fördröj="3">
        <li>Ingen bindningstid</li>
        <li>Kostar ingenting att fråga</li>
      </ul>
    </div>
  </div>
</section>

</main>{fot}{jsonld(o, OMRADEN)}
</body>
</html>
"""


def skriv_sitemap():
    p = os.path.join(ROT, 'sitemap.xml')
    s = open(p, encoding='utf-8').read()
    nya = [o['slug'] for o in OMRADEN if f'<loc>https://nextrum.se/{o["slug"]}</loc>' not in s]
    if not nya:
        return 0
    block = '\n'.join(
        f'  <url>\n    <loc>https://nextrum.se/{slug}</loc>\n'
        f'    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>'
        for slug in nya)
    s = s.replace('</urlset>', block + '\n</urlset>')
    open(p, 'w', encoding='utf-8').write(s)
    return len(nya)


def main():
    if not os.path.exists(SKAL):
        sys.exit(f'hittar inte skalsidan {SKAL}')
    for o in OMRADEN:
        if o.get('handskriven'):
            print(f'  hoppar över {o["slug"]}.html (handskriven)')
            continue
        p = os.path.join(ROT, o['slug'] + '.html')
        open(p, 'w', encoding='utf-8').write(sida(o))
        print(f'  skrev {o["slug"]}.html')
    n = skriv_sitemap()
    print(f'  sitemap.xml: {n} nya adresser')
    print(f'{len(OMRADEN)} områdessidor byggda.')


if __name__ == '__main__':
    main()
