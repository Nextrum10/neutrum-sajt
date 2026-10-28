#!/usr/bin/env python3
"""Bygger områdessidorna och ämnessidorna.

Sex stadsdelssidor (/laxhjalp-farsta …), fyra ämnessidor
(/laxhjalp-matematik, -svenska, -engelska, -no), tre stadiesidor
(/laxhjalp-mellanstadiet, -hogstadiet, -gymnasiet), /laxhjalp-online,
guiderna och 404.html. Navet,
/laxhjalp-stockholm, är handskrivet men får sina ämneskort härifrån.
Kör verktyg/bygg-sitemap.py och sist verktyg/satt-version.py efteråt.

VARFÖR DE GENERERAS OCH INTE SKRIVS FÖR HAND

Sju sidor delar exakt samma skal — huvud, meny, footer, inloggnings-
rutan, skriptraderna. Skrivs de för hand är de sju kopior som ska
hållas i takt med resten av sajten för alltid, och de kommer inte att
hållas i takt. Det har redan hänt en gång med /en/ (se
project-nextrum-engelska i minnet).

Därför: skalet LÄSES UR var-ide.html vid varje körning. Ändrar någon
menyn eller footern där, kör om det här skriptet så följer de sju med.
Det som är eget per sida står i OMRADEN och AMNEN nedan och ingen
annanstans, utom bildens alt-text: den läses ur nextrum-images.js.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textbredd  # noqa: E402

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKAL = os.path.join(ROT, 'var-ide.html')

# Timpriset utan bindning (399 sedan 2026-10-08, Leo). Samma tal som
# PRIS_PER_TIMME i nextrum-config.js och läxhjälpens pris i tjanster.
# Paketens pris (379 kr i timmen, en månad i taget) står bara i
# erbjudanden_pris och skrivs aldrig in i sidorna härifrån.
PRIS_KR = 399
EXTRA_KR = 69

PRIS = f'{PRIS_KR} kr'
EXTRA_BARN = f'{EXTRA_KR} kr'

# Tillägget är FAST när fler än ett barn sitter med, inte per barn:
# två barn och tre barn kostar samma sak, och tre är taket. Så räknar
# servern (familjebelopp() i _delad/pris.ts, som stripe-checkout
# använder, lägger på extraOre en gång när antalBarn > 1), och sidorna
# ska säga vad som faktiskt dras. Summan räknas fram här i stället för att skrivas ut, så
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
#
# `region` är var orten står i navets katalog, och `grannar` är de
# orter sidan länkar till under Andra områden i närheten. Sedan
# 2026-10-26 (Leo: "lägg till landningssidor för varje ort i
# Stockholm") får stadsdelarna och kommunerna i länet egna sidor, en
# ort när dess trafik och bibliotek är kontrollerade (tio kommuner
# väntade den dagen, och åtta kom 2026-10-27), och då kan en sida inte
# länka till alla andra: de närmaste och navet räcker, och navet
# listar alla.
# ============================================================

# Navets regioner, i den ordning de står där. Footern länkar till dem
# i stället för till varje ort, och ämnessidorna visar dem som kort.
# Raden under rubriken står på ämnessidornas kort; varje ort i den har
# en sida (Årsta och Liljeholmen står på sina stadsdelsområdens).
REGIONER = [
    ('innerstaden', 'Innerstaden', 'Läxhjälp i innerstaden',
     'Södermalm, Kungsholmen, Vasastan och Östermalm'),
    ('soderort', 'Söderort', 'Läxhjälp i söderort',
     'Hammarby Sjöstad, Årsta, Liljeholmen, Farsta med flera'),
    ('vasterort', 'Västerort', 'Läxhjälp i västerort',
     'Bromma, Vällingby, Spånga och Kista'),
    ('norr-och-vaster', 'Norr och väster om stan', 'Läxhjälp norr och väster om stan',
     'Solna, Sundbyberg, Täby, Sollentuna med flera'),
    ('soder-och-oster', 'Söder och öster om stan', 'Läxhjälp söder och öster om stan',
     'Nacka, Huddinge, Haninge, Tyresö med flera'),
]

# Frågor som gäller överallt, med samma svar som på de första sju
# sidorna. Orterna från 2026-10-26 tar två var, olika för grannar, och
# har sedan två egna: om området och om biblioteket. Betalningsmeningen
# står inte här: verktyg/kolla-betalningsvillkor.py räknar var den står.
F_AMNEN = ('Vilka ämnen och årskurser gäller det?',
           'Hela grundskolan och gymnasiet, och samma timpris oavsett ämne. Studiehjälparen '
           'väljs efter ämnet och nivån eleven behöver hjälp med, inte tvärtom.')
F_IGANG = ('Hur snabbt kan vi komma igång?',
           'Vi hör av oss inom 24 timmar efter intresseanmälan och går igenom behovet. Hur '
           'snart första passet blir av beror på när vi hittar rätt person, och det säger vi '
           'när vi har pratats vid. Att fråga kostar ingenting.')
F_PROV = ('Går det att få hjälp inför ett nationellt prov?',
          'Ja. Studieplanen skrivs utifrån vad eleven behöver, och ett mål som "trygg med '
          'ekvationer inför provet" är precis den sortens mål den är gjord för. Efter varje '
          'pass får ni en rapport om hur det gick.')
F_PRIS = ('Vad kostar det?',
          f'{PRIS} i timmen, plus {EXTRA_BARN} i timmen om syskon sitter med i samma pass, '
          'samma tillägg upp till tre barn. Ingen bindningstid och ingen månadsavgift. '
          'Se prissidan för vad som ingår.')
F_ONLINE = ('Är online sämre än att ses?',
            'Nej, men det är annorlunda. Samma studiehjälpare, samma studieplan och samma '
            'rapport efteråt. För de flesta ämnen fungerar det lika bra; för de yngsta eleverna '
            'brukar på plats fungera bättre.')
F_SYSKON = ('Kan ett syskon vara med på samma pass?',
            f'Ja. Tillägget är {EXTRA_BARN} i timmen totalt och gäller upp till tre barn, så två '
            f'barn en timme blir {FLERA_BARN}, och tre barn kostar lika mycket. Det förutsätter '
            'att de kan arbeta med ungefär samma sak.')
F_KVALL = ('Hur sent på kvällen går det att boka?',
           'Ni föreslår en tid mellan elva på förmiddagen och tio på kvällen på vardagar, '
           'och mellan nio på morgonen och tio på kvällen på helger, och studiehjälparen '
           'accepterar den eller föreslår en annan. Läxhjälp blir för det mesta efter '
           'skolan, alltså eftermiddagar och kvällar.')
F_RAPPORT = ('Hur vet vi vad som hände på passet?',
             'Studiehjälparen skriver en rapport efteråt: vad ni gick igenom, hur det gick och '
             'vad som är nästa steg. Både elev och förälder ser samma rapport i studievyn.')
F_SAMMA = ('Kan vi få samma studiehjälpare varje gång?',
           'Ja, det är hela poängen. Matchningen är en person, inte en pool: den som kommer '
           'nästa vecka vet vad som var svårt förra veckan, för hen var där.')
F_BYTA = ('Vad händer om det inte funkar mellan eleven och studiehjälparen?',
          'Säg till oss. Fel match är värre än ingen match, och det är därför vi gör '
          'matchningen åt er i stället för att låta er bläddra i en katalog. Det finns ingen '
          'bindningstid som gör det krångligt att byta.')
F_GYMNASIET = ('Hjälper ni gymnasieelever?',
               'Ja. Vi letar efter en studiehjälpare som har läst samma kurs nyligen, och det '
               'märks särskilt på gymnasienivå, där den som läste kursen i fjol minns vilket '
               'steg som är det svåra.')

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
        'titel': 'Läxhjälp i Stockholm: stadsdelar och kranskommuner | Nextrum',
        'beskrivning': (
            f'Läxhjälp i hela Stockholm för {PRIS} i timmen, från innerstaden till kranskommunerna: '
            'hemma hos er, på biblioteket eller online. Välj ert område.'
        ),
        'etikett': 'Läxhjälp i Stockholm',
        'h1': 'Läxhjälp i<br><em>Stockholm.</em>',
        'lede': (
            'Vi matchar elever i Stockholm med en studiehjälpare som nyligen läst samma '
            'kurser själv. Passen sker hemma hos er eller online.'
        ),
        'bild': '22-skolvag-hostlov',
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
        'region': 'innerstaden',
        'grannar': [
            'laxhjalp-hammarby-sjostad', 'laxhjalp-kungsholmen',
            'laxhjalp-hagersten-liljeholmen', 'laxhjalp-enskede-arsta-vantor',
            'laxhjalp-ostermalm', 'laxhjalp-nacka',
        ],
        'beskrivning': (
            f'Läxhjälp på Södermalm för {PRIS} i timmen, från Hornstull till Skanstull: hemma hos er, '
            'på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp på Södermalm',
        'h1': 'Läxhjälp på<br><em>Södermalm.</em>',
        'lede': (
            'Från Hornstull till Skanstull. Vi matchar elever på Södermalm med en '
            'studiehjälpare som nyligen läst samma kurser själv, och passen hålls hemma hos er, '
            'på biblioteket eller online.'
        ),
        'bild': '01-en-till-en',
        'delar': [
            'Mariatorget', 'Hornstull', 'Zinkensdamm', 'Skanstull', 'Medborgarplatsen',
            'Slussen', 'Katarina', 'Sofia', 'Åsö', 'Tanto', 'Reimersholme', 'Långholmen',
        ],
        'transport': (
            'Röda och gröna linjen går genom hela ön, med stationer vid Slussen, Mariatorget, '
            'Zinkensdamm och Hornstull på den röda och Medborgarplatsen och Skanstull på den '
            'gröna. En studiehjälpare som bor längs någon av linjerna når er utan byten, och '
            'då blir ett pass hemma hos er sällan en resefråga.'
        ),
        'bibliotek': ['Hornstulls bibliotek', 'Tranströmerbiblioteket vid Medborgarplatsen'],
        'faq': [
            ('Kommer ni hem till oss på Södermalm?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig hit varje vecka. '
             'Södermalm har tunnelbana på båda linjerna, så restiden är sällan problemet. Går '
             'det inte börjar ni online.'),
            ('Vilka ämnen och årskurser gäller det?',
             'Hela grundskolan och gymnasiet, och samma timpris oavsett ämne. Studiehjälparen '
             'väljs efter ämnet och nivån eleven behöver hjälp med, inte tvärtom.'),
            ('Hur snabbt kan vi komma igång?',
             'Vi hör av oss inom 24 timmar efter intresseanmälan och går igenom behovet. Hur '
             'snart första passet blir av beror på när vi hittar rätt person, och det säger vi '
             'när vi har pratats vid. Att fråga kostar ingenting.'),
            ('Kan vi ses på biblioteket i stället för hemma?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Hornstulls bibliotek eller '
             'Tranströmerbiblioteket vid Medborgarplatsen. Det passar den som vill ha lugn och '
             'ro men inte besök hemma.'),
        ],
    },
    {
        'slug': 'laxhjalp-farsta',
        'namn': 'Farsta',
        'i_namn': 'i Farsta',
        'nav': 'Farsta',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-skarpnack', 'laxhjalp-enskede-arsta-vantor', 'laxhjalp-alvsjo',
            'laxhjalp-huddinge', 'laxhjalp-tyreso', 'laxhjalp-haninge',
        ],
        'beskrivning': (
            f'Läxhjälp i Farsta, Hökarängen och Gubbängen för {PRIS} i timmen: hemma hos er, på '
            'Farsta bibliotek eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Farsta',
        'h1': 'Läxhjälp i<br><em>Farsta.</em>',
        'lede': (
            'Längs gröna linjen från Gubbängen till Farsta strand. Vi matchar elever i Farsta '
            'med en studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på '
            'biblioteket eller online.'
        ),
        'bild': '06-forklaringen',
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
        'bibliotek': ['Farsta bibliotek i Kulturhuset Fanfaren i Farsta centrum'],
        'faq': [
            ('Täcker ni hela Farsta?',
             'Vi matchar elever i Farsta centrum, Farsta strand, Hökarängen, Gubbängen, '
             'Sköndal, Fagersjö och Larsboda. Hemma hos er går när matchningen ger en '
             'studiehjälpare som kan ta sig dit varje vecka; annars börjar ni online.'),
            ('Går det att få hjälp inför ett nationellt prov?',
             'Ja. Studieplanen skrivs utifrån vad eleven behöver, och ett mål som "trygg med '
             'ekvationer inför provet" är precis den sortens mål den är gjord för. Efter varje '
             'pass får ni en rapport om hur det gick.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, plus {EXTRA_BARN} i timmen om syskon sitter med i samma pass — '
             'samma tillägg upp till tre barn. Ingen bindningstid och ingen månadsavgift. '
             'Se prissidan för vad som ingår.'),
            ('Kan passen hållas på Farsta bibliotek?',
             'Ja. Skriv platsen när ni föreslår tiden. Biblioteket ligger i Kulturhuset Fanfaren '
             'i Farsta centrum, så en studiehjälpare som åker gröna linjen har inte långt dit.'),
        ],
    },
    {
        'slug': 'laxhjalp-nacka',
        'namn': 'Nacka',
        'i_namn': 'i Nacka',
        'nav': 'Nacka',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-hammarby-sjostad', 'laxhjalp-sodermalm', 'laxhjalp-skarpnack',
            'laxhjalp-farsta', 'laxhjalp-tyreso', 'laxhjalp-varmdo',
        ],
        'beskrivning': (
            f'Läxhjälp i Nacka för {PRIS} i timmen, från Sickla till Orminge och Saltsjöbaden: hemma '
            'hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Nacka',
        'h1': 'Läxhjälp i<br><em>Nacka.</em>',
        'lede': (
            'Från Sickla till Orminge. Vi matchar elever i Nacka med en studiehjälpare som '
            'nyligen läst samma kurser själv, och längre ut är online ofta det som gör att '
            'passen blir av varje vecka.'
        ),
        'bild': '12-pa-vag',
        'delar': [
            'Sickla', 'Finntorp', 'Järla', 'Nacka Forum', 'Ektorp', 'Orminge', 'Boo',
            'Saltsjöbaden', 'Fisksätra', 'Älta', 'Saltsjö-Duvnäs',
        ],
        'transport': (
            'Nacka nås med tvärbanan till Sickla och med bussarna från Slussen över '
            'Danvikstull. Sickla, Finntorp och Järla ligger nära nog att räknas '
            'som en förlängning av Södermalm restidsmässigt; Orminge, Boo och Saltsjöbaden är '
            'en längre resa, och där är online ofta det som gör att passen blir av varje vecka '
            'i stället för ibland.'
        ),
        'bibliotek': ['Nacka Forum bibliotek', 'Dieselverkstadens bibliotek i Sickla'],
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
            ('Kan vi ses på biblioteket i stället?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Nacka Forum bibliotek eller '
             'Dieselverkstadens bibliotek i Sickla, som båda ligger nära tvärbanan eller bussarna.'),
        ],
    },
    {
        'slug': 'laxhjalp-hammarby-sjostad',
        'namn': 'Hammarby Sjöstad',
        'i_namn': 'i Hammarby Sjöstad',
        'nav': 'Hammarby Sjöstad',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-sodermalm', 'laxhjalp-nacka', 'laxhjalp-skarpnack',
            'laxhjalp-enskede-arsta-vantor',
        ],
        'beskrivning': (
            f'Läxhjälp i Hammarby Sjöstad och Sickla för {PRIS} i timmen: hemma hos er, på '
            'LUMA-biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Hammarby Sjöstad',
        'h1': 'Läxhjälp i<br><em>Hammarby Sjöstad.</em>',
        'lede': (
            'Längs tvärbanan från Luma till Sickla udde. Vi matchar elever i Hammarby Sjöstad '
            'med en studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på '
            'biblioteket eller online.'
        ),
        'bild': '28-skrivbord-ordning',
        'delar': [
            'Sickla Udde', 'Sickla Kaj', 'Lumaparken', 'Henriksdal', 'Lugnet',
            'Sjöstadsparterren', 'Hammarbyhöjden', 'Hammarby Allé',
        ],
        'transport': (
            'Tvärbanan går genom hela Sjöstaden, från Gullmarsplan, där gröna linjen stannar, '
            'via Luma och Sickla kaj till Sickla udde. En studiehjälpare som åker gröna linjen '
            'byter alltså en gång och är framme, också en vardagseftermiddag när läxhjälpen '
            'faktiskt sker.'
        ),
        'bibliotek': ['LUMA-biblioteket'],
        'faq': [
            ('Vilka delar av Sjöstaden gäller det?',
             'Sickla Udde, Sickla Kaj, Lumaparken, Lugnet, Henriksdal och Sjöstadsparterren, och '
             'Hammarbyhöjden strax intill. Hemma hos er eller online väljer ni för varje pass, '
             'och hemma går när studiehjälparen kan ta sig hit varje vecka.'),
            ('Hur sent på kvällen går det att boka?',
             'Ni föreslår en tid mellan elva på förmiddagen och tio på kvällen på vardagar, '
             'och mellan nio på morgonen och tio på kvällen på helger, och studiehjälparen '
             'accepterar den eller föreslår en annan. Läxhjälp blir för det mesta efter '
             'skolan, alltså eftermiddagar och kvällar.'),
            ('Hur vet vi vad som hände på passet?',
             'Studiehjälparen skriver en rapport efteråt: vad ni gick igenom, hur det gick och '
             'vad som är nästa steg. Både elev och förälder ser samma rapport i studievyn.'),
            ('Kan vi ses på LUMA-biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden. Biblioteket ligger mitt i Sjöstaden, '
             'nära tvärbanans hållplats Luma.'),
        ],
    },
    {
        'slug': 'laxhjalp-bromma',
        'namn': 'Bromma',
        'i_namn': 'i Bromma',
        'nav': 'Bromma',
        'region': 'vasterort',
        'grannar': [
            'laxhjalp-kungsholmen', 'laxhjalp-vallingby-hasselby', 'laxhjalp-spanga-tensta',
            'laxhjalp-solna', 'laxhjalp-sundbyberg', 'laxhjalp-hagersten-liljeholmen',
            'laxhjalp-ekero',
        ],
        'beskrivning': (
            f'Läxhjälp i Bromma för {PRIS} i timmen, från Alvik till Nockeby: hemma hos er, på '
            'Brommaplans bibliotek eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Bromma',
        'h1': 'Läxhjälp i<br><em>Bromma.</em>',
        'lede': (
            'Från Alvik till Nockeby. Vi matchar elever i Bromma med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '10-forsta-motet',
        'delar': [
            'Alvik', 'Traneberg', 'Abrahamsberg', 'Åkeshov', 'Brommaplan', 'Ålsten',
            'Höglandet', 'Nockeby', 'Bromma Kyrka', 'Riksby', 'Ulvsunda', 'Mariehäll',
        ],
        'transport': (
            'Gröna linjen går till Alvik, Abrahamsberg, Åkeshov och Brommaplan, och från Alvik '
            'tar Nockebybanan vid ut mot Ålsten, Höglandet och Nockeby. Villaområdena västerut '
            'är alltså närmare än de ser ut på kartan, så länge man åker kollektivt och inte '
            'räknar i kilometer.'
        ),
        'bibliotek': ['Brommaplans bibliotek', 'Alviks bibliotek'],
        'faq': [
            ('Vilka delar av Bromma?',
             'Alvik, Traneberg, Abrahamsberg, Åkeshov, Brommaplan, Ålsten, Höglandet, Nockeby, '
             'Bromma Kyrka, Riksby, Ulvsunda och Mariehäll. Hemma hos er går när studiehjälparen '
             'ni matchas med kan ta sig dit varje vecka, och annars börjar ni online.'),
            ('Kan vi få samma studiehjälpare varje gång?',
             'Ja, det är hela poängen. Matchningen är en person, inte en pool — den som kommer '
             'nästa vecka vet vad som var svårt förra veckan, för hen var där.'),
            ('Vad händer om det inte funkar mellan eleven och studiehjälparen?',
             'Säg till oss. Fel match är värre än ingen match, och det är därför vi gör '
             'matchningen åt er i stället för att låta er bläddra i en katalog. Det finns ingen '
             'bindningstid som gör det krångligt att byta.'),
            ('Kan vi ses på Brommaplans bibliotek?',
             'Ja, eller på Alviks bibliotek. Skriv platsen när ni föreslår tiden. Båda ligger vid '
             'gröna linjen, så det är lätt för studiehjälparen att ta sig dit.'),
        ],
    },
    {
        'slug': 'laxhjalp-solna',
        'namn': 'Solna',
        'i_namn': 'i Solna',
        'nav': 'Solna',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-sundbyberg', 'laxhjalp-vasastan', 'laxhjalp-kungsholmen',
            'laxhjalp-danderyd', 'laxhjalp-kista-rinkeby', 'laxhjalp-bromma',
        ],
        'beskrivning': (
            f'Läxhjälp i Solna, Råsunda och Bergshamra för {PRIS} i timmen: hemma hos er, på '
            'biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Solna',
        'h1': 'Läxhjälp i<br><em>Solna.</em>',
        'lede': (
            'Från Råsunda till Bergshamra. Vi matchar elever i Solna med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '07-genombrottet',
        'delar': [
            'Solna centrum', 'Råsunda', 'Hagalund', 'Huvudsta', 'Bergshamra',
            'Ulriksdal', 'Järvastaden', 'Arenastaden', 'Frösunda', 'Skytteholm',
        ],
        'transport': (
            'Blå linjen går till Solna centrum och Näckrosen, pendeltåget stannar vid Solna '
            'station och Ulriksdal, och tvärbanan binder ihop Solna med Sundbyberg och Alvik. Få '
            'områden i Stockholm har fler sätt att ta sig till, vilket gör att en studiehjälpare '
            'sällan behöver bo i Solna för att kunna komma hit varje vecka.'
        ),
        'bibliotek': ['Solna stadsbibliotek', 'Bergshamra bibliotek'],
        'faq': [
            ('Vilka delar av Solna?',
             'Solna centrum, Råsunda, Hagalund, Huvudsta, Bergshamra, Ulriksdal, Järvastaden, '
             'Arenastaden, Frösunda och Skytteholm. Ni väljer hemma eller online för varje pass; '
             'hemma går när studiehjälparen kan ta sig till er varje vecka.'),
            ('Hjälper ni gymnasieelever?',
             'Ja. Vi letar efter en studiehjälpare som har läst samma kurs nyligen, och det '
             'märks särskilt på gymnasienivå, där den som läste kursen i fjol minns vilket '
             'steg som är det svåra.'),
            ('Måste vi binda upp oss?',
             f'Nej. Ingen bindningstid, ingen månadsavgift. {PRIS} i timmen. Ni betalar varje '
             'pass med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir '
             'passet kortare än bokat betalar vi tillbaka mellanskillnaden. Betalningen går till Nextrum.'),
            ('Kan vi ses på biblioteket i stället för hemma?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Solna stadsbibliotek eller '
             'Bergshamra bibliotek.'),
        ],
    },
    # ---- Orterna från 2026-10-26. Bibliotek, stationer och delområden är
    # kontrollerade mot kommunernas, bibliotekens och SL:s sidor och
    # Wikipedia i sökträffarna samma dag, inte öppnade: nätet släppte
    # inte fram dem. Planerade linjer (tunnelbanan till Barkarby,
    # Spårväg syd) nämns inte förrän de går.
    {
        'slug': 'laxhjalp-huddinge',
        'namn': 'Huddinge',
        'i_namn': 'i Huddinge',
        'nav': 'Huddinge',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-farsta', 'laxhjalp-alvsjo', 'laxhjalp-skarholmen',
            'laxhjalp-botkyrka', 'laxhjalp-salem', 'laxhjalp-haninge',
        ],
        'beskrivning': (
            f'Läxhjälp i Huddinge, Flemingsberg och Skogås för {PRIS} i timmen: hemma hos er, på '
            'biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Huddinge',
        'h1': 'Läxhjälp i<br><em>Huddinge.</em>',
        'lede': (
            'Från Vårby till Skogås. Vi matchar elever i Huddinge med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '06-forklaringen',
        'delar': [
            'Huddinge centrum', 'Sjödalen', 'Fullersta', 'Stuvsta', 'Snättringe', 'Flemingsberg',
            'Segeltorp', 'Kungens kurva', 'Vårby', 'Masmo', 'Skogås', 'Trångsund',
        ],
        'transport': (
            'Pendeltåget stannar i Stuvsta, Huddinge och Flemingsberg, och på grenen mot Nynäshamn '
            'i Trångsund och Skogås. I väster går röda linjen till Masmo och Vårby gård. Delarna '
            'ligger alltså på olika linjer, och därför matchar vi efter var eleven bor och inte '
            'bara efter kommunen.'
        ),
        'bibliotek': ['Huvudbiblioteket i Huddinge', 'Flemingsbergs bibliotek', 'Skogås bibliotek'],
        'faq': [
            ('Tar ni pass i hela Huddinge?',
             'Vi matchar elever i Huddinge centrum, Stuvsta, Snättringe, Flemingsberg, Segeltorp, '
             'Vårby, Masmo, Skogås och Trångsund. Hemma hos er går när matchningen ger en '
             'studiehjälpare som kan ta sig dit varje vecka; annars börjar ni online.'),
            F_PROV,
            F_SYSKON,
            ('Kan vi ses på biblioteket i stället för hemma?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Huvudbiblioteket, '
             'Flemingsbergs bibliotek eller Skogås bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-botkyrka',
        'namn': 'Botkyrka',
        'i_namn': 'i Botkyrka',
        'nav': 'Botkyrka',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-huddinge', 'laxhjalp-skarholmen', 'laxhjalp-salem',
        ],
        'beskrivning': (
            'Läxhjälp i Botkyrka, från Fittja och Alby till Tumba och Tullinge, för '
            f'{PRIS} i timmen: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Botkyrka',
        'h1': 'Läxhjälp i<br><em>Botkyrka.</em>',
        'lede': (
            'Från Fittja vid Mälaren till Vårsta. Vi matchar elever i Botkyrka med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '04-sjalvfortroende',
        'delar': [
            'Alby', 'Fittja', 'Hallunda', 'Norsborg', 'Tumba', 'Tullinge', 'Eriksberg',
            'Storvreten', 'Riksten', 'Vårsta', 'Grödinge',
        ],
        'transport': (
            'Röda linjen går till Fittja, Alby, Hallunda och Norsborg, där den slutar, och '
            'pendeltåget stannar i Tullinge och Tumba. Till Vårsta går bussen från Tumba station. '
            'Norra Botkyrka och Tumba med Tullinge ligger alltså på var sin linje, och vi matchar '
            'efter var eleven bor.'
        ),
        'bibliotek': ['Alby bibliotek', 'Hallunda bibliotek', 'Tumba bibliotek'],
        'faq': [
            ('Gäller det hela Botkyrka?',
             'Vi matchar elever i Alby, Fittja, Hallunda, Norsborg, Tumba, Tullinge, Storvreten '
             'och Vårsta. Hemma hos er går när studiehjälparen kan ta sig dit varje vecka, och '
             'annars börjar ni online.'),
            F_AMNEN,
            F_RAPPORT,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Alby bibliotek, Hallunda '
             'bibliotek eller Tumba bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-salem',
        'namn': 'Salem',
        'i_namn': 'i Salem',
        'nav': 'Salem',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-botkyrka', 'laxhjalp-huddinge',
        ],
        'beskrivning': (
            f'Läxhjälp i Salem och Rönninge för {PRIS} i timmen: hemma hos er, på Salems bibliotek '
            'eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Salem',
        'h1': 'Läxhjälp i<br><em>Salem.</em>',
        'lede': (
            'Från Rönninge till Söderby. Vi matchar elever i Salem med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '12-pa-vag',
        'delar': [
            'Rönninge', 'Salems centrum', 'Söderby', 'Säby', 'Uttringe', 'Hallsta', 'Ersboda',
        ],
        'transport': (
            'Pendeltåget stannar i Rönninge, kommunens enda station, och därifrån går bussen till '
            'Salems centrum. En studiehjälpare som bor längs pendeltåget söderut har alltså nära '
            'till er, och längre bort i kommunen är online ofta det som gör att passen blir av '
            'varje vecka.'
        ),
        'bibliotek': ['Salems bibliotek i Salems centrum'],
        'faq': [
            ('Kommer ni hem till oss i Salem?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig hit varje vecka. Rönninge '
             'ligger vid pendeltåget, och till Salems centrum går bussen därifrån. Går det inte '
             'börjar ni online.'),
            F_IGANG,
            F_ONLINE,
            ('Kan vi ses på Salems bibliotek?',
             'Ja. Skriv platsen när ni föreslår tiden. Biblioteket ligger i Salems centrum, dit '
             'bussen går från Rönninge station.'),
        ],
    },
    {
        'slug': 'laxhjalp-jarfalla',
        'namn': 'Järfälla',
        'i_namn': 'i Järfälla',
        'nav': 'Järfälla',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-spanga-tensta', 'laxhjalp-vallingby-hasselby',
            'laxhjalp-sollentuna', 'laxhjalp-upplands-vasby', 'laxhjalp-upplands-bro',
        ],
        'beskrivning': (
            'Läxhjälp i Järfälla, från Barkarby och Jakobsberg till Kallhäll, för '
            f'{PRIS} i timmen: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Järfälla',
        'h1': 'Läxhjälp i<br><em>Järfälla.</em>',
        'lede': (
            'Från Barkarby till Stäket. Vi matchar elever i Järfälla med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '10-forsta-motet',
        'delar': [
            'Jakobsberg', 'Barkarby', 'Barkarbystaden', 'Veddesta', 'Skälby', 'Viksjö',
            'Söderhöjden', 'Kallhäll', 'Stäket', 'Bolinder strand',
        ],
        'transport': (
            'Pendeltåget stannar i Barkarby, Jakobsberg och Kallhäll, så den som bor nära en '
            'station har en resa utan byten från stan. Viksjö ligger en bit från stationerna, '
            'och dit är det bussen som gäller. Vi matchar efter var eleven bor, så att resan '
            'håller varje vecka och inte bara första gången.'
        ),
        'bibliotek': ['Jakobsbergs bibliotek', 'Bas Barkarby bibliotek', 'Viksjö bibliotek'],
        'faq': [
            ('Vilka delar av Järfälla?',
             'Jakobsberg, Barkarby och Barkarbystaden, Veddesta, Skälby, Viksjö, Söderhöjden, '
             'Kallhäll och Stäket. Hemma hos er går när studiehjälparen kan ta sig dit varje '
             'vecka, och annars börjar ni online.'),
            F_GYMNASIET,
            F_KVALL,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Jakobsbergs bibliotek, Bas '
             'Barkarby bibliotek eller Viksjö bibliotek. Kolla öppettiderna innan ni bokar.'),
        ],
    },
    {
        'slug': 'laxhjalp-upplands-vasby',
        'namn': 'Upplands Väsby',
        'i_namn': 'i Upplands Väsby',
        'nav': 'Upplands Väsby',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-sollentuna', 'laxhjalp-jarfalla', 'laxhjalp-vallentuna',
            'laxhjalp-taby', 'laxhjalp-sigtuna', 'laxhjalp-upplands-bro',
        ],
        'beskrivning': (
            f'Läxhjälp i Upplands Väsby för {PRIS} i timmen, från Bollstanäs till Runby: hemma hos '
            'er, på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Upplands Väsby',
        'h1': 'Läxhjälp i<br><em>Upplands Väsby.</em>',
        'lede': (
            'Från Bollstanäs till Runby. Vi matchar elever i Upplands Väsby med en studiehjälpare '
            'som nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '32-laxor-pa-koksbordet',
        'delar': [
            'Väsby centrum', 'Bollstanäs', 'Grimstaby', 'Vilunda', 'Smedby', 'Runby', 'Fresta',
            'Vik', 'Brunnby', 'Odenslunda',
        ],
        'transport': (
            'Pendeltåget stannar vid Upplands Väsby station, mitt i kommunen, mellan Rotebro och '
            'Rosersberg. En studiehjälpare som bor längs pendeltåget norrut från stan har alltså '
            'en resa utan byten, och ut i kommunen går bussarna.'
        ),
        'bibliotek': ['Upplands Väsby bibliotek'],
        'faq': [
            ('Gäller det hela Upplands Väsby?',
             'Vi matchar elever i Väsby centrum, Bollstanäs, Vilunda, Smedby, Runby, Fresta, Vik, '
             'Brunnby och Odenslunda. Hemma hos er går när matchningen ger en studiehjälpare som '
             'kan ta sig dit varje vecka; annars börjar ni online.'),
            F_PRIS,
            F_BYTA,
            ('Kan vi ses på biblioteket i stället för hemma?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Upplands Väsby bibliotek. Det '
             'passar den som vill ha lugn och ro men inte besök hemma.'),
        ],
    },
    {
        'slug': 'laxhjalp-kungsholmen',
        'namn': 'Kungsholmen',
        'i_namn': 'på Kungsholmen',
        'nav': 'Kungsholmen',
        'region': 'innerstaden',
        'grannar': [
            'laxhjalp-vasastan', 'laxhjalp-sodermalm', 'laxhjalp-bromma', 'laxhjalp-solna',
            'laxhjalp-hagersten-liljeholmen',
        ],
        'beskrivning': (
            f'Läxhjälp på Kungsholmen för {PRIS} i timmen, från Stadshagen till Fridhemsplan och '
            'Essingen: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp på Kungsholmen',
        'h1': 'Läxhjälp på<br><em>Kungsholmen.</em>',
        'lede': (
            'Från Stadshuset till Stora Essingen. Vi matchar elever på Kungsholmen med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '30-fonster-och-bocker',
        'delar': [
            'Fridhemsplan', 'Stadshagen', 'Fredhäll', 'Kristineberg', 'Marieberg', 'Rålambshov',
            'Thorildsplan', 'Hornsberg', 'Lilla Essingen', 'Stora Essingen',
        ],
        'transport': (
            'Blå linjen stannar vid Rådhuset, Fridhemsplan och Stadshagen, och gröna linjen vid '
            'Fridhemsplan, Thorildsplan och Kristineberg. Till Stora Essingen går tvärbanan. '
            'Kungsholmen nås alltså utan byte från stora delar av stan, och resan hit är sällan '
            'det som avgör om ett pass blir av.'
        ),
        'bibliotek': ['Kungsholmens bibliotek vid S:t Eriksgatan'],
        'faq': [
            ('Vilka delar av Kungsholmen?',
             'Fridhemsplan, Stadshagen, Fredhäll, Kristineberg, Marieberg, Thorildsplan, Hornsberg '
             'och Essingeöarna. Hemma hos er går när studiehjälparen kan ta sig dit varje vecka, '
             'och annars börjar ni online.'),
            F_IGANG,
            F_SAMMA,
            ('Kan vi ses på Kungsholmens bibliotek?',
             'Ja. Skriv platsen när ni föreslår tiden. Biblioteket ligger vid S:t Eriksgatan på '
             'Kungsholmen.'),
        ],
    },
    {
        'slug': 'laxhjalp-vasastan',
        'namn': 'Vasastan',
        'i_namn': 'i Vasastan',
        'nav': 'Vasastan',
        'region': 'innerstaden',
        'grannar': [
            'laxhjalp-ostermalm', 'laxhjalp-kungsholmen', 'laxhjalp-solna', 'laxhjalp-sodermalm',
        ],
        'beskrivning': (
            f'Läxhjälp i Vasastan för {PRIS} i timmen, från Odenplan och Sankt Eriksplan till '
            'Norrtull: hemma hos er eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Vasastan',
        'h1': 'Läxhjälp i<br><em>Vasastan.</em>',
        'lede': (
            'Från Sankt Eriksplan till Norrtull. Vi matchar elever i Vasastan med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er eller online.'
        ),
        'bild': '21-hemma-hos-familjen',
        'delar': [
            'Odenplan', 'Sankt Eriksplan', 'Sibirien', 'Birkastan', 'Röda bergen', 'Atlasområdet',
            'Vanadislunden', 'Hagastaden', 'Norrtull', 'Observatorielunden', 'Tegnérlunden',
        ],
        'transport': (
            'Gröna linjen stannar vid Sankt Eriksplan, Odenplan och Rådmansgatan, och pendeltåget '
            'vid Stockholm Odenplan. Vasastan nås alltså utan byte från stora delar av stan, och '
            'ett pass hemma hos er blir sällan en resefråga.'
        ),
        # Stadsbiblioteket vid Odenplan är stängt för renovering (sedan juni
        # 2024), och ersättningen Spelbomskan har inga studieplatser. Sidan
        # nämner därför inget bibliotek i Vasastan, bara grannens.
        'bibliotek': [],
        'faq': [
            ('Vilka delar av Vasastan?',
             'Odenplan, Sankt Eriksplan, Sibirien, Birkastan, Röda bergen, Atlasområdet, '
             'Vanadislunden, Hagastaden och Norrtull. Hemma hos er går när studiehjälparen kan ta '
             'sig dit varje vecka, och annars börjar ni online.'),
            F_PROV,
            F_KVALL,
            ('Kan vi ses på biblioteket i stället?',
             'Stadsbiblioteket vid Odenplan är stängt för renovering. Vill ni ses på ett bibliotek '
             'går det bra i en grannstadsdel, till exempel Kungsholmens bibliotek vid S:t '
             'Eriksgatan. Skriv platsen när ni föreslår tiden.'),
        ],
    },
    {
        'slug': 'laxhjalp-ostermalm',
        'namn': 'Östermalm',
        'i_namn': 'på Östermalm',
        'nav': 'Östermalm',
        'region': 'innerstaden',
        'grannar': [
            'laxhjalp-vasastan', 'laxhjalp-lidingo', 'laxhjalp-danderyd', 'laxhjalp-solna',
            'laxhjalp-sodermalm',
        ],
        'beskrivning': (
            f'Läxhjälp på Östermalm för {PRIS} i timmen, från Stureplan till Gärdet och Ropsten: '
            'hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp på Östermalm',
        'h1': 'Läxhjälp på<br><em>Östermalm.</em>',
        'lede': (
            'Från Stureplan till Ropsten. Vi matchar elever på Östermalm med en studiehjälpare '
            'som nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '13-kvallsplugg',
        'delar': [
            'Stureplan', 'Östermalmstorg', 'Karlaplan', 'Lärkstaden', 'Villastaden',
            'Diplomatstaden', 'Gärdet', 'Hjorthagen', 'Ropsten', 'Norra Djurgårdsstaden',
        ],
        'transport': (
            'Röda linjen går genom hela stadsdelen: Östermalmstorg, Karlaplan, Gärdet och Ropsten '
            'på den ena grenen, Stadion och Tekniska högskolan på den andra. Den som bor längs '
            'röda linjen kommer alltså utan byten, och från de andra linjerna byter man en gång.'
        ),
        'bibliotek': ['Östermalms bibliotek i Fältöversten'],
        'faq': [
            ('Vilka delar av Östermalm?',
             'Stureplan, Östermalmstorg, Karlaplan, Lärkstaden, Villastaden, Gärdet, Hjorthagen och '
             'Norra Djurgårdsstaden. Hemma hos er går när studiehjälparen kan ta sig dit varje '
             'vecka, och annars börjar ni online.'),
            F_GYMNASIET,
            F_RAPPORT,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Östermalms bibliotek i '
             'Fältöversten, mellan Karlaplan och Valhallavägen.'),
        ],
    },
    {
        'slug': 'laxhjalp-hagersten-liljeholmen',
        'namn': 'Hägersten och Liljeholmen',
        'i_namn': 'i Hägersten och Liljeholmen',
        'nav': 'Hägersten och Liljeholmen',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-sodermalm', 'laxhjalp-kungsholmen', 'laxhjalp-enskede-arsta-vantor',
            'laxhjalp-alvsjo', 'laxhjalp-skarholmen', 'laxhjalp-bromma',
        ],
        'beskrivning': (
            f'Läxhjälp i Hägersten och Liljeholmen för {PRIS} i timmen, från Gröndal till '
            'Fruängen: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Hägersten och Liljeholmen',
        'h1': 'Läxhjälp i Hägersten<br>och <em>Liljeholmen.</em>',
        'lede': (
            'Från Liljeholmen till Fruängen. Vi matchar elever i Hägersten och Liljeholmen med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '19-tunnelbana',
        'delar': [
            'Liljeholmen', 'Gröndal', 'Aspudden', 'Örnsberg', 'Axelsberg', 'Mälarhöjden',
            'Midsommarkransen', 'Telefonplan', 'Hägerstensåsen', 'Västertorp', 'Fruängen',
        ],
        'transport': (
            'Röda linjen delar sig efter Liljeholmen: den ena grenen går via Midsommarkransen, '
            'Telefonplan och Hägerstensåsen till Fruängen, den andra via Aspudden, Örnsberg och '
            'Axelsberg till Mälarhöjden och vidare. Tvärbanan stannar i Liljeholmen och Gröndal. '
            'Nästan varje del ligger alltså vid en station.'
        ),
        'bibliotek': ['Aspuddens bibliotek', 'Gröndals bibliotek', 'Fruängens bibliotek'],
        'faq': [
            ('Gäller det hela Hägersten och Liljeholmen?',
             'Vi matchar elever i Liljeholmen, Gröndal, Aspudden, Midsommarkransen, Telefonplan, '
             'Hägerstensåsen, Västertorp, Fruängen och Mälarhöjden. Hemma hos er går när '
             'matchningen ger en studiehjälpare som kan ta sig dit varje vecka; annars börjar ni '
             'online.'),
            F_PRIS,
            F_ONLINE,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Aspuddens bibliotek, Gröndals '
             'bibliotek eller Fruängens bibliotek, som alla ligger nära en station.'),
        ],
    },
    {
        'slug': 'laxhjalp-alvsjo',
        'namn': 'Älvsjö',
        'i_namn': 'i Älvsjö',
        'nav': 'Älvsjö',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-hagersten-liljeholmen', 'laxhjalp-enskede-arsta-vantor',
            'laxhjalp-skarholmen', 'laxhjalp-huddinge', 'laxhjalp-farsta',
        ],
        'beskrivning': (
            f'Läxhjälp i Älvsjö för {PRIS} i timmen, från Herrängen och Långbro till Solberga: '
            'hemma hos er, på Älvsjö bibliotek eller online.'
        ),
        'etikett': 'Läxhjälp i Älvsjö',
        'h1': 'Läxhjälp i<br><em>Älvsjö.</em>',
        'lede': (
            'Från Herrängen till Örby slott. Vi matchar elever i Älvsjö med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '10-forsta-motet',
        # Älvsjös sju stadsdelar, och inga fler: Örby och Hagsätra hör till
        # Enskede-Årsta-Vantör. Stadsdelsområdet är numera Hägersten-Älvsjö,
        # men ingen letar efter läxhjälp i Hägersten-Älvsjö.
        'delar': [
            'Älvsjö', 'Solberga', 'Liseberg', 'Långbro', 'Herrängen', 'Långsjö', 'Örby slott',
        ],
        'transport': (
            'Pendeltåget stannar i Älvsjö, och där delar sig linjerna söderut. Tunnelbana finns '
            'inte i stadsdelen, så en studiehjälpare som bor längs pendeltåget har närmast, och '
            'till de västra delarna går bussen.'
        ),
        'bibliotek': ['Älvsjö bibliotek vid stationen'],
        'faq': [
            ('Vilka delar av Älvsjö?',
             'Älvsjö, Solberga, Liseberg, Långbro, Herrängen, Långsjö och Örby slott. Hemma hos er '
             'går när studiehjälparen kan ta sig dit varje vecka, och annars börjar ni online.'),
            F_AMNEN,
            F_BYTA,
            ('Kan vi ses på Älvsjö bibliotek?',
             'Ja. Skriv platsen när ni föreslår tiden. Biblioteket ligger vid Älvsjö station, så '
             'det är lätt för studiehjälparen att ta sig dit.'),
        ],
    },
    {
        'slug': 'laxhjalp-skarholmen',
        'namn': 'Skärholmen',
        'i_namn': 'i Skärholmen',
        'nav': 'Skärholmen',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-hagersten-liljeholmen', 'laxhjalp-alvsjo', 'laxhjalp-huddinge',
            'laxhjalp-botkyrka',
        ],
        'beskrivning': (
            f'Läxhjälp i Skärholmen, Bredäng, Sätra och Vårberg för {PRIS} i timmen: hemma hos er, '
            'på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Skärholmen',
        'h1': 'Läxhjälp i<br><em>Skärholmen.</em>',
        'lede': (
            'Från Bredäng till Vårberg. Vi matchar elever i Skärholmen med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '04-sjalvfortroende',
        'delar': [
            'Skärholmen', 'Bredäng', 'Sätra', 'Vårberg',
        ],
        'transport': (
            'Röda linjen går genom hela stadsdelsområdet, med stationer i Bredäng, Sätra, '
            'Skärholmen och Vårberg på grenen mot Norsborg. En studiehjälpare som bor längs röda '
            'linjen har alltså en resa utan byten, ända från söderort in till stan.'
        ),
        'bibliotek': ['Skärholmens bibliotek i Skärholmens centrum', 'Bredängs bibliotek'],
        'faq': [
            ('Gäller det hela Skärholmen?',
             'Ja: Skärholmen, Bredäng, Sätra och Vårberg. Hemma hos er går när matchningen ger en '
             'studiehjälpare som kan ta sig dit varje vecka; annars börjar ni online.'),
            F_IGANG,
            F_SYSKON,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Skärholmens bibliotek i '
             'centrum eller Bredängs bibliotek vid Bredängstorget.'),
        ],
    },
    {
        'slug': 'laxhjalp-enskede-arsta-vantor',
        'namn': 'Enskede, Årsta och Vantör',
        'i_namn': 'i Enskede, Årsta och Vantör',
        'nav': 'Enskede, Årsta och Vantör',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-sodermalm', 'laxhjalp-hammarby-sjostad', 'laxhjalp-skarpnack',
            'laxhjalp-farsta', 'laxhjalp-alvsjo', 'laxhjalp-hagersten-liljeholmen',
        ],
        'beskrivning': (
            f'Läxhjälp i Årsta, Enskede, Högdalen och Rågsved för {PRIS} i timmen: hemma hos er, '
            'på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Enskede, Årsta och Vantör',
        'h1': 'Läxhjälp i Enskede,<br><em>Årsta och Vantör.</em>',
        'lede': (
            'Från Gullmarsplan till Hagsätra. Vi matchar elever i Enskede, Årsta och Vantör med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '02-personlig-anpassning',
        'delar': [
            'Årsta', 'Östberga', 'Johanneshov', 'Enskede gård', 'Gamla Enskede', 'Enskededalen',
            'Stureby', 'Bandhagen', 'Högdalen', 'Rågsved', 'Hagsätra', 'Örby',
        ],
        'transport': (
            'Gröna linjen mot Hagsätra går genom hela området, med stationer i Enskede gård, '
            'Sockenplan, Stureby, Bandhagen, Högdalen och Rågsved, och tvärbanan går genom Årsta '
            'med byte till pendeltåget vid Årstaberg. Från Gullmarsplan når studiehjälparen '
            'alltså de flesta delar utan fler byten.'
        ),
        'bibliotek': ['Årsta bibliotek', 'Högdalens bibliotek', 'Hagsätra bibliotek'],
        'faq': [
            ('Vilka delar gäller det?',
             'Årsta, Östberga, Johanneshov, Enskede gård, Gamla Enskede, Enskededalen, Stureby, '
             'Bandhagen, Högdalen, Rågsved, Hagsätra och Örby. Hemma hos er går när '
             'studiehjälparen kan ta sig dit varje vecka, och annars börjar ni online.'),
            F_PROV,
            F_SAMMA,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Årsta bibliotek vid Årsta '
             'torg, Högdalens bibliotek ovanpå tunnelbanan eller Hagsätra bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-skarpnack',
        'namn': 'Skarpnäck',
        'i_namn': 'i Skarpnäck',
        'nav': 'Skarpnäck',
        'region': 'soderort',
        'grannar': [
            'laxhjalp-hammarby-sjostad', 'laxhjalp-enskede-arsta-vantor', 'laxhjalp-farsta',
            'laxhjalp-nacka', 'laxhjalp-tyreso',
        ],
        'beskrivning': (
            f'Läxhjälp i Skarpnäck, Bagarmossen och Björkhagen för {PRIS} i timmen: hemma hos er, '
            'på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Skarpnäck',
        'h1': 'Läxhjälp i<br><em>Skarpnäck.</em>',
        'lede': (
            'Från Hammarbyhöjden till Skarpnäck. Vi matchar elever i Skarpnäck med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': 'hero-nextrum',
        'delar': [
            'Skarpnäcksfältet', 'Bagarmossen', 'Björkhagen', 'Kärrtorp', 'Hammarbyhöjden',
        ],
        'transport': (
            'Gröna linjens gren mot Skarpnäck stannar vid Hammarbyhöjden, Björkhagen, Kärrtorp, '
            'Bagarmossen och Skarpnäck, så varje del ligger vid en station. En studiehjälpare som '
            'bor längs gröna linjen kommer alltså utan byten.'
        ),
        'bibliotek': ['Bagarmossens bibliotek', 'Björkhagens bibliotek'],
        'faq': [
            ('Gäller det hela Skarpnäck?',
             'Vi matchar elever i Skarpnäcksfältet, Bagarmossen, Björkhagen, Kärrtorp och '
             'Hammarbyhöjden. Hemma hos er går när matchningen ger en studiehjälpare som kan ta '
             'sig dit varje vecka; annars börjar ni online.'),
            F_AMNEN,
            F_KVALL,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Bagarmossens bibliotek eller '
             'Björkhagens bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-vallingby-hasselby',
        'namn': 'Vällingby och Hässelby',
        'i_namn': 'i Vällingby och Hässelby',
        'nav': 'Vällingby och Hässelby',
        'region': 'vasterort',
        'grannar': [
            'laxhjalp-bromma', 'laxhjalp-spanga-tensta', 'laxhjalp-jarfalla', 'laxhjalp-ekero',
        ],
        'beskrivning': (
            f'Läxhjälp i Vällingby och Hässelby för {PRIS} i timmen, från Råcksta till Hässelby '
            'strand: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Vällingby och Hässelby',
        'h1': 'Läxhjälp i Vällingby<br>och <em>Hässelby.</em>',
        'lede': (
            'Från Råcksta till Hässelby strand. Vi matchar elever i Vällingby och Hässelby med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '05-av-unga-for-unga',
        'delar': [
            'Vällingby', 'Råcksta', 'Grimsta', 'Vinsta', 'Johannelund', 'Hässelby gård',
            'Hässelby strand', 'Hässelby villastad', 'Åkermyntan',
        ],
        'transport': (
            'Gröna linjen går genom hela området: Råcksta, Vällingby, Johannelund, Hässelby gård '
            'och Hässelby strand, där den slutar. Till Hässelby villastad går bussen från '
            'Vällingby. En studiehjälpare som bor längs gröna linjen kommer alltså utan byten.'
        ),
        'bibliotek': ['Vällingby bibliotek', 'Hässelby gårds bibliotek', 'Hässelby villastads bibliotek'],
        'faq': [
            ('Vilka delar gäller det?',
             'Vällingby, Råcksta, Grimsta, Vinsta, Hässelby gård, Hässelby strand och Hässelby '
             'villastad. Hemma hos er går när studiehjälparen kan ta sig dit varje vecka, och '
             'annars börjar ni online.'),
            F_GYMNASIET,
            F_SYSKON,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Vällingby bibliotek i Vällingby '
             'centrum eller Hässelby gårds bibliotek vid Hässelby torg.'),
        ],
    },
    {
        'slug': 'laxhjalp-spanga-tensta',
        'namn': 'Spånga och Tensta',
        'i_namn': 'i Spånga och Tensta',
        'nav': 'Spånga och Tensta',
        'region': 'vasterort',
        'grannar': [
            'laxhjalp-kista-rinkeby', 'laxhjalp-vallingby-hasselby', 'laxhjalp-bromma',
            'laxhjalp-jarfalla', 'laxhjalp-sundbyberg',
        ],
        'beskrivning': (
            f'Läxhjälp i Spånga och Tensta för {PRIS} i timmen, från Bromsten till Hjulsta: hemma '
            'hos er, på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Spånga och Tensta',
        'h1': 'Läxhjälp i Spånga<br>och <em>Tensta.</em>',
        'lede': (
            'Från Bromsten till Hjulsta. Vi matchar elever i Spånga och Tensta med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket '
            'eller online.'
        ),
        'bild': '01-en-till-en',
        'delar': [
            'Spånga', 'Tensta', 'Hjulsta', 'Bromsten', 'Solhem', 'Flysta', 'Sundby', 'Lunda',
        ],
        'transport': (
            'Blå linjen stannar i Tensta och Hjulsta, och pendeltåget i Spånga, mitt emot '
            'biblioteket. Vi matchar efter var eleven bor, så att resan håller varje vecka och '
            'inte bara första gången.'
        ),
        'bibliotek': ['Tensta bibliotek', 'Spånga bibliotek'],
        'faq': [
            ('Gäller det hela Spånga och Tensta?',
             'Vi matchar elever i Spånga, Tensta, Hjulsta, Bromsten, Solhem, Flysta och Sundby. '
             'Hemma hos er går när matchningen ger en studiehjälpare som kan ta sig dit varje '
             'vecka; annars börjar ni online.'),
            F_IGANG,
            F_RAPPORT,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Tensta bibliotek i Tensta '
             'centrum eller Spånga bibliotek mitt emot pendeltågsstationen.'),
        ],
    },
    {
        'slug': 'laxhjalp-kista-rinkeby',
        'namn': 'Kista och Rinkeby',
        'i_namn': 'i Kista och Rinkeby',
        'nav': 'Kista och Rinkeby',
        'region': 'vasterort',
        'grannar': [
            'laxhjalp-spanga-tensta', 'laxhjalp-sundbyberg', 'laxhjalp-solna',
            'laxhjalp-sollentuna', 'laxhjalp-jarfalla',
        ],
        'beskrivning': (
            f'Läxhjälp i Kista, Husby, Akalla och Rinkeby för {PRIS} i timmen: hemma hos er, på '
            'biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Kista och Rinkeby',
        'h1': 'Läxhjälp i Kista<br>och <em>Rinkeby.</em>',
        'lede': (
            'Från Rinkeby till Akalla. Vi matchar elever i Kista och Rinkeby med en studiehjälpare '
            'som nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '12-pa-vag',
        'delar': [
            'Kista', 'Husby', 'Akalla', 'Rinkeby',
        ],
        'transport': (
            'Blå linjen går hit på två grenar: mot Akalla med stationer i Kista, Husby och Akalla, '
            'och mot Hjulsta med station i Rinkeby. Mellan Kista och Rinkeby blir det alltså byte '
            'eller buss, och därför matchar vi efter var eleven bor.'
        ),
        'bibliotek': ['Kista bibliotek i Kista Galleria', 'Husby bibliotek', 'Rinkeby bibliotek'],
        'faq': [
            ('Gäller det både Kista och Rinkeby?',
             'Ja, och Husby och Akalla. Hemma hos er går när matchningen ger en studiehjälpare '
             'som kan ta sig dit varje vecka; annars börjar ni online.'),
            F_PROV,
            F_BYTA,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Kista bibliotek i Kista '
             'Galleria, Husby bibliotek eller Rinkeby bibliotek i Rinkeby centrum.'),
        ],
    },
    {
        'slug': 'laxhjalp-sundbyberg',
        'namn': 'Sundbyberg',
        'i_namn': 'i Sundbyberg',
        'nav': 'Sundbyberg',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-solna', 'laxhjalp-kista-rinkeby', 'laxhjalp-spanga-tensta', 'laxhjalp-bromma',
        ],
        'beskrivning': (
            f'Läxhjälp i Sundbyberg för {PRIS} i timmen, från Duvbo och centrala Sundbyberg till '
            'Hallonbergen och Ursvik: hemma hos er eller online.'
        ),
        'etikett': 'Läxhjälp i Sundbyberg',
        'h1': 'Läxhjälp i<br><em>Sundbyberg.</em>',
        'lede': (
            'Från Duvbo till Ursvik. Vi matchar elever i Sundbyberg med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '19-tunnelbana',
        'delar': [
            'Centrala Sundbyberg', 'Duvbo', 'Lilla Alby', 'Storskogen', 'Tulemarken', 'Hallonbergen',
            'Ör', 'Rissne', 'Lilla Ursvik', 'Stora Ursvik', 'Brotorp',
        ],
        'transport': (
            'Pendeltåget och blå linjen möts vid Sundbybergs centrum, där tvärbanan också stannar. '
            'Blå linjen går vidare till Duvbo och Rissne, och på den andra grenen ligger '
            'Hallonbergen. Få kommuner är lättare att nå, så en studiehjälpare behöver sällan bo i '
            'Sundbyberg för att komma hit varje vecka.'
        ),
        'bibliotek': ['Biblioteket i Signalfabriken', 'Hallonbergens bibliotek'],
        'faq': [
            ('Gäller det hela Sundbyberg?',
             'Vi matchar elever i centrala Sundbyberg, Duvbo, Lilla Alby, Storskogen, Hallonbergen, '
             'Ör, Rissne och Ursvik. Hemma hos er går när studiehjälparen kan ta sig dit varje '
             'vecka, och annars börjar ni online.'),
            F_KVALL,
            F_PRIS,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Biblioteket i Signalfabriken i '
             'centrala Sundbyberg eller Hallonbergens bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-danderyd',
        'namn': 'Danderyd',
        'i_namn': 'i Danderyd',
        'nav': 'Danderyd',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-taby', 'laxhjalp-sollentuna', 'laxhjalp-solna', 'laxhjalp-ostermalm',
        ],
        'beskrivning': (
            f'Läxhjälp i Danderyd för {PRIS} i timmen, från Stocksund och Djursholm till Enebyberg: '
            'hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Danderyd',
        'h1': 'Läxhjälp i<br><em>Danderyd.</em>',
        'lede': (
            'Från Stocksund till Enebyberg. Vi matchar elever i Danderyd med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '24-valkommen-hem',
        'delar': [
            'Djursholm', 'Stocksund', 'Enebyberg', 'Danderyd', 'Mörby', 'Djursholms Ösby',
            'Djursholms Ekeby', 'Altorp',
        ],
        'transport': (
            'Röda linjen går till Danderyds sjukhus och Mörby centrum, och Roslagsbanan genom hela '
            'kommunen: Stocksund, Mörby och Djursholms Ösby, där banan delar sig mot Enebyberg åt '
            'ena hållet och Altorp åt det andra. En studiehjälpare som bor längs någon av dem '
            'kommer alltså utan byten.'
        ),
        # Köpcentret heter Danderyds centrum sedan maj 2026; stationen heter
        # fortfarande Mörby centrum.
        'bibliotek': ['Danderyds bibliotek i Danderyds centrum', 'Djursholms bibliotek',
                      'Enebybergs bibliotek'],
        'faq': [
            ('Vilka delar av Danderyd?',
             'Djursholm, Stocksund, Enebyberg, Danderyd och Mörby. Hemma hos er går när '
             'matchningen ger en studiehjälpare som kan ta sig dit varje vecka; annars börjar ni '
             'online.'),
            F_GYMNASIET,
            F_SAMMA,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Danderyds bibliotek i '
             'Danderyds centrum vid Mörby centrums tunnelbana, Djursholms bibliotek eller '
             'Enebybergs bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-taby',
        'namn': 'Täby',
        'i_namn': 'i Täby',
        'nav': 'Täby',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-danderyd', 'laxhjalp-sollentuna', 'laxhjalp-vallentuna',
        ],
        'beskrivning': (
            f'Läxhjälp i Täby för {PRIS} i timmen, från Näsbypark till Täby kyrkby och Arninge: '
            'hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Täby',
        'h1': 'Läxhjälp i<br><em>Täby.</em>',
        'lede': (
            'Från Näsbypark till Täby kyrkby. Vi matchar elever i Täby med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '25-forsta-motet-med-foralder',
        'delar': [
            'Täby centrum', 'Tibble', 'Roslags Näsby', 'Näsbypark', 'Lahäll', 'Gribbylund',
            'Skarpäng', 'Täby kyrkby', 'Ensta', 'Viggbyholm', 'Hägernäs', 'Arninge',
        ],
        'transport': (
            'Roslagsbanan går genom Täby på tre grenar: via Täby centrum, Viggbyholm och Hägernäs '
            'till Arninge, via Tibble och Ensta till Täby kyrkby, och via Lahäll till Näsbypark. '
            'En studiehjälpare som bor längs banan har sällan mer än ett byte. Någon tunnelbana '
            'finns inte i Täby.'
        ),
        'bibliotek': ['Huvudbiblioteket vid Täby centrum', 'Näsbyparks bibliotek',
                      'Gribbylunds bibliotek'],
        'faq': [
            ('Gäller det hela Täby?',
             'Vi matchar elever i Täby centrum, Tibble, Näsbypark, Gribbylund, Skarpäng, Täby '
             'kyrkby, Ensta, Viggbyholm, Hägernäs och Arninge. Hemma hos er går när '
             'studiehjälparen kan ta sig dit varje vecka, och annars börjar ni online.'),
            F_IGANG,
            F_PROV,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Huvudbiblioteket vid Täby '
             'centrum, Näsbyparks bibliotek eller Gribbylunds bibliotek.'),
        ],
    },
    {
        'slug': 'laxhjalp-lidingo',
        'namn': 'Lidingö',
        'i_namn': 'på Lidingö',
        'nav': 'Lidingö',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-ostermalm', 'laxhjalp-danderyd', 'laxhjalp-taby',
        ],
        'beskrivning': (
            f'Läxhjälp på Lidingö för {PRIS} i timmen, från Torsvik och Larsberg till Gåshaga: '
            'hemma hos er, på stadsbiblioteket eller online.'
        ),
        'etikett': 'Läxhjälp på Lidingö',
        'h1': 'Läxhjälp på<br><em>Lidingö.</em>',
        'lede': (
            'Från Torsvik till Gåshaga. Vi matchar elever på Lidingö med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '24-valkommen-hem',
        'delar': [
            'Lidingö centrum', 'Torsvik', 'Baggeby', 'Bodal', 'Larsberg', 'Dalénum', 'Hersby',
            'Skärsätra', 'Mölna', 'Brevik', 'Käppala', 'Gåshaga',
        ],
        'transport': (
            'Lidingöbanan går från Ropsten, där röda linjen slutar, över bron och längs södra '
            'delen av ön till Gåshaga. En studiehjälpare som bor längs röda linjen byter alltså en '
            'gång, och till norra Lidingö går bussen.'
        ),
        'bibliotek': ['Lidingö stadsbibliotek i stadshuset'],
        'faq': [
            ('Kommer ni ut till Lidingö?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig hit varje vecka. '
             'Lidingöbanan går från Ropsten längs södra delen av ön; längre norrut är online ofta '
             'det som gör att passen blir av varje vecka.'),
            F_AMNEN,
            F_SYSKON,
            ('Kan vi ses på stadsbiblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden. Lidingö stadsbibliotek ligger i stadshuset '
             'i Lidingö centrum.'),
        ],
    },
    {
        'slug': 'laxhjalp-sollentuna',
        'namn': 'Sollentuna',
        'i_namn': 'i Sollentuna',
        'nav': 'Sollentuna',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-kista-rinkeby', 'laxhjalp-taby', 'laxhjalp-danderyd',
            'laxhjalp-upplands-vasby', 'laxhjalp-jarfalla',
        ],
        'beskrivning': (
            f'Läxhjälp i Sollentuna för {PRIS} i timmen, från Helenelund till Rotebro: hemma hos er, '
            'på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Sollentuna',
        'h1': 'Läxhjälp i<br><em>Sollentuna.</em>',
        'lede': (
            'Från Helenelund till Rotebro. Vi matchar elever i Sollentuna med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': 'hero-nextrum',
        'delar': [
            'Tureberg', 'Sollentuna centrum', 'Edsberg', 'Helenelund', 'Häggvik', 'Norrviken',
            'Rotebro',
        ],
        'transport': (
            'Pendeltåget stannar i Helenelund, Sollentuna, Häggvik, Norrviken och Rotebro, i den '
            'ordningen norrut. Kommunen ligger alltså utmed pendeltåget, och en studiehjälpare som '
            'bor längs det har en resa utan byten.'
        ),
        'bibliotek': ['Sollentuna bibliotek i Turebergshuset', 'biblioteket i Arena Edsberg'],
        'faq': [
            ('Vilka delar av Sollentuna?',
             'Tureberg och Sollentuna centrum, Edsberg, Helenelund, Häggvik, Norrviken och Rotebro. '
             'Hemma hos er går när matchningen ger en studiehjälpare som kan ta sig dit varje '
             'vecka; annars börjar ni online.'),
            F_BYTA,
            F_IGANG,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Sollentuna bibliotek i '
             'Turebergshuset eller biblioteket i Arena Edsberg.'),
        ],
    },
    {
        'slug': 'laxhjalp-vallentuna',
        'namn': 'Vallentuna',
        'i_namn': 'i Vallentuna',
        'nav': 'Vallentuna',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-taby', 'laxhjalp-upplands-vasby', 'laxhjalp-sigtuna',
        ],
        'beskrivning': (
            f'Läxhjälp i Vallentuna för {PRIS} i timmen, från Kragstalund till Kårsta: hemma hos er, '
            'på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Vallentuna',
        'h1': 'Läxhjälp i<br><em>Vallentuna.</em>',
        'lede': (
            'Från Kragstalund till Kårsta. Vi matchar elever i Vallentuna med en studiehjälpare som '
            'nyligen läst samma kurser själv, och längre ut är online ofta det som gör att passen '
            'blir av varje vecka.'
        ),
        'bild': '13-kvallsplugg',
        'delar': [
            'Vallentuna centrum', 'Kragstalund', 'Bällsta', 'Ormsta', 'Molnby', 'Lindholmen',
            'Frösunda', 'Kårsta', 'Karby', 'Brottby',
        ],
        'transport': (
            'Roslagsbanan mot Kårsta går genom hela kommunen, från Kragstalund och Bällsta via '
            'Vallentuna och Frösunda till Kårsta. En studiehjälpare som bor längs banan har alltså '
            'en resa utan byten, och längre ut är online ofta det som fungerar varje vecka.'
        ),
        'bibliotek': ['biblioteket i Vallentuna kulturhus', 'Kårsta bibliotek'],
        'faq': [
            ('Kommer ni hem till oss i Vallentuna?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig dit varje vecka. Nära '
             'Roslagsbanan går det oftast; längre ut börjar ni online, med samma studieplan och '
             'rapport.'),
            F_AMNEN,
            F_ONLINE,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel biblioteket i Vallentuna '
             'kulturhus.'),
        ],
    },
    # Kommunerna 2026-10-27, kontrollerade genom sökträffar på
    # kommunernas, bibliotekens och trafikbolagens egna sidor och Wikipedia
    # (nätet släppte inte fram sidorna). Inga linjenummer, restider eller
    # turtätheter: källorna gick isär om dem, och de ändras utan att någon
    # säger till. Ett bibliotek som är obemannat för barn eller renoveras
    # står inte som självklar plats för ett pass. Vaxholm och Norrtälje
    # byggdes samma dag men togs bort innan de gick ut, och Österåker med
    # dem (Leo, sidrensningen 2026-10-27): adressen /laxhjalp-osteraker
    # leder till navets region i vercel.json.
    {
        'slug': 'laxhjalp-sigtuna',
        'namn': 'Sigtuna',
        'i_namn': 'i Sigtuna',
        'nav': 'Sigtuna',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-upplands-vasby', 'laxhjalp-vallentuna', 'laxhjalp-upplands-bro',
        ],
        'beskrivning': (
            f'Läxhjälp i Sigtuna kommun för {PRIS} i timmen, i Märsta, Valsta, Rosersberg och '
            'Sigtuna stad: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Sigtuna',
        'h1': 'Läxhjälp i<br><em>Sigtuna.</em>',
        'lede': (
            'Från Rosersberg till Sigtuna stad. Vi matchar elever i Märsta, Valsta och resten av '
            'kommunen med en studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på '
            'biblioteket eller online.'
        ),
        'bild': '02-personlig-anpassning',
        'delar': [
            'Märsta', 'Valsta', 'Sigtuna stad', 'Rosersberg', 'Steningehöjden', 'Steninge slottsby',
            'Norrbacka', 'Tingvalla', 'Ekilla', 'Sätuna', 'Odensala',
        ],
        'transport': (
            'Pendeltåget stannar i Rosersberg och slutar i Märsta, och från Märsta station går '
            'bussarna till Märsta centrum, Valsta, Steningehöjden och Sigtuna stad. En studiehjälpare '
            'som bor längs pendeltåget norrut har alltså en resa utan byten till Märsta, och till '
            'Sigtuna stad blir det ett byte till bussen.'
        ),
        # Huvudbiblioteket ligger i Märsta, inte i Sigtuna stad. Kulturhuset
        # Mimer i Valsta, med ett nytt bibliotek, var inte öppnat 2026-10-27.
        'bibliotek': ['Märsta bibliotek vid Kulturtorget', 'Sigtuna bibliotek i Sigtuna stad'],
        'faq': [
            ('Gäller det hela Sigtuna kommun?',
             'Vi matchar elever i Märsta, Valsta, Sigtuna stad, Rosersberg, Steningehöjden och '
             'Odensala. Hemma hos er går när studiehjälparen kan ta sig dit varje vecka, och annars '
             'börjar ni online.'),
            F_IGANG,
            F_GYMNASIET,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Märsta bibliotek vid '
             'Kulturtorget i Märsta centrum eller Sigtuna bibliotek i Sigtuna stad.'),
        ],
    },
    {
        'slug': 'laxhjalp-upplands-bro',
        'namn': 'Upplands-Bro',
        'i_namn': 'i Upplands-Bro',
        'nav': 'Upplands-Bro',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-jarfalla', 'laxhjalp-upplands-vasby', 'laxhjalp-sigtuna', 'laxhjalp-ekero',
        ],
        'beskrivning': (
            f'Läxhjälp i Upplands-Bro för {PRIS} i timmen, i Kungsängen, Brunna och Bro: hemma hos '
            'er, på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Upplands-Bro',
        'h1': 'Läxhjälp i<br><em>Upplands-Bro.</em>',
        'lede': (
            'Från Brunna till Bro. Vi matchar elever i Upplands-Bro med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '05-av-unga-for-unga',
        'delar': [
            'Kungsängen', 'Brunna', 'Tibble', 'Ekhammar', 'Bro', 'Finnsta', 'Håbo-Tibble kyrkby',
            'Låssa', 'Håtuna',
        ],
        'transport': (
            'Pendeltåget mot Bålsta stannar i Kungsängen och Bro, och vid båda stationerna går '
            'bussarna vidare. Brunna har ingen station, så dit är det bussen som gäller. En '
            'studiehjälpare som bor längs pendeltåget genom Järfälla har alltså en resa utan byten '
            'till Kungsängen och Bro.'
        ),
        'bibliotek': ['Kungsängens bibliotek i Kulturhuset', 'Bro bibliotek i Brohuset'],
        'faq': [
            ('Vilka delar av Upplands-Bro?',
             'Kungsängen med Brunna och Tibble, Ekhammar, Bro och Finnsta, och längre ut Håtuna och '
             'Låssa. Hemma hos er går när studiehjälparen kan ta sig dit varje vecka, och annars '
             'börjar ni online.'),
            F_RAPPORT,
            F_SYSKON,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Kungsängens bibliotek i '
             'Kulturhuset vid Furuhällsplan eller Bro bibliotek i Brohuset i Bro centrum.'),
        ],
    },
    {
        'slug': 'laxhjalp-ekero',
        'namn': 'Ekerö',
        'i_namn': 'på Ekerö',
        'nav': 'Ekerö',
        'region': 'norr-och-vaster',
        'grannar': [
            'laxhjalp-bromma', 'laxhjalp-vallingby-hasselby', 'laxhjalp-upplands-bro',
        ],
        'beskrivning': (
            f'Läxhjälp på Ekerö för {PRIS} i timmen, från Tappström och Träkvista till Stenhamra på '
            'Färingsö: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp på Ekerö',
        'h1': 'Läxhjälp på<br><em>Ekerö.</em>',
        'lede': (
            'Från Drottningholm till Stenhamra. Vi matchar elever i Ekerö kommun med en '
            'studiehjälpare som nyligen läst samma kurser själv, hemma hos er, på biblioteket eller '
            'online.'
        ),
        'bild': '09-online-v2',
        'delar': [
            'Ekerö centrum', 'Tappström', 'Träkvista', 'Sandudden', 'Ekerö sommarstad',
            'Drottningholm', 'Stenhamra', 'Färingsö', 'Munsö', 'Adelsö', 'Jungfrusund',
        ],
        # Pendelbåten till Klara Mälarstrand står inte med: den enda färska
        # källan var en sammanfattning av kommunens sida.
        'transport': (
            'Ekerö har varken tunnelbana eller pendeltåg. De flesta bussar går från Brommaplan, på '
            'gröna linjen, och nästan alla passerar Ekerö centrum eller Tappström; till Stenhamra på '
            'Färingsö går bussen också från Brommaplan. En studiehjälpare som bor längs gröna linjen '
            'har alltså ett byte, och längre ut på öarna är online ofta det som gör att passen blir '
            'av varje vecka.'
        ),
        'bibliotek': ['Ekerö bibliotek i kulturhuset i Ekerö centrum',
                      'Stenhamra bibliotek i Stenhamraskolan'],
        'faq': [
            ('Kommer ni ut till Ekerö?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig hit varje vecka. Till Ekerö '
             'centrum och Tappström går bussarna från Brommaplan; på Färingsö, Munsö och Adelsö '
             'börjar ni ofta online, med samma person, studieplan och rapport.'),
            F_SAMMA,
            F_KVALL,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Ekerö bibliotek i kulturhuset i '
             'Ekerö centrum eller Stenhamra bibliotek i Stenhamraskolan, ett hundratal meter från '
             'busshållplatsen Stenhamra centrum.'),
        ],
    },
    {
        'slug': 'laxhjalp-haninge',
        'namn': 'Haninge',
        'i_namn': 'i Haninge',
        'nav': 'Haninge',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-huddinge', 'laxhjalp-farsta', 'laxhjalp-tyreso',
        ],
        'beskrivning': (
            f'Läxhjälp i Haninge för {PRIS} i timmen, i Handen, Vega, Jordbro, Västerhaninge och '
            'Brandbergen: hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp i Haninge',
        'h1': 'Läxhjälp i<br><em>Haninge.</em>',
        'lede': (
            'Från Vega till Dalarö. Vi matchar elever i Haninge med en studiehjälpare som nyligen '
            'läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '04-sjalvfortroende',
        'delar': [
            'Handen', 'Vega', 'Jordbro', 'Västerhaninge', 'Brandbergen', 'Vendelsö', 'Vendelsömalm',
            'Tungelsta', 'Gudö', 'Dalarö', 'Årsta havsbad', 'Muskö',
        ],
        'transport': (
            'Pendeltåget mot Nynäshamn stannar i Vega, Handen, Jordbro, Västerhaninge, Krigslida, '
            'Tungelsta och Hemfosa, och flest tåg går till Handen och Västerhaninge. Brandbergen, '
            'Vendelsö och Dalarö har ingen station, så där matchar vi efter var eleven bor. En '
            'studiehjälpare som bor längs pendeltåget söderut har alltså en resa utan byten till '
            'Vega, Handen, Jordbro, Västerhaninge och Tungelsta.'
        ),
        'bibliotek': ['Handens bibliotek i Haninge kulturhus', 'Västerhaninge bibliotek',
                      'Brandbergens bibliotek'],
        'faq': [
            ('Vilka delar av Haninge?',
             'Handen, Vega, Jordbro, Västerhaninge, Brandbergen, Vendelsö, Tungelsta och Dalarö. '
             'Längs pendeltåget går det oftast att ses hemma; längre ut börjar ni online om ingen '
             'studiehjälpare kan ta sig dit varje vecka.'),
            F_IGANG,
            F_KVALL,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Handens bibliotek i Haninge '
             'kulturhus, Västerhaninge bibliotek nära pendeltågsstationen eller Brandbergens '
             'bibliotek, som har ett studierum.'),
        ],
    },
    {
        'slug': 'laxhjalp-tyreso',
        'namn': 'Tyresö',
        'i_namn': 'i Tyresö',
        'nav': 'Tyresö',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-nacka', 'laxhjalp-skarpnack', 'laxhjalp-farsta', 'laxhjalp-haninge',
        ],
        'beskrivning': (
            f'Läxhjälp i Tyresö för {PRIS} i timmen, från Trollbäcken och Bollmora till Brevik: '
            'hemma hos er, på biblioteket eller online. Ingen bindningstid.'
        ),
        'etikett': 'Läxhjälp i Tyresö',
        'h1': 'Läxhjälp i<br><em>Tyresö.</em>',
        'lede': (
            'Från Trollbäcken till Brevik. Vi matchar elever i Tyresö med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '01-en-till-en',
        'delar': [
            'Tyresö centrum', 'Bollmora', 'Krusboda', 'Fårdala', 'Trollbäcken', 'Tyresö strand',
            'Brevik', 'Öringe', 'Nyfors',
        ],
        'transport': (
            'Tyresö har varken tunnelbana eller pendeltåg. Bussarna går från Gullmarsplan, där gröna '
            'linjen stannar, till Tyresö centrum och Trollbäckens centrum. En studiehjälpare som bor '
            'längs gröna linjen har alltså ett byte, och vi matchar efter var eleven bor så att resan '
            'håller varje vecka.'
        ),
        # Filialerna i Trollbäcken och Tyresö strand är meröppna: utan personal
        # kommer bara den som är 18 och registrerad in, och då inte ett barn.
        'bibliotek': ['Tyresö bibliotek i Tyresö centrum'],
        'faq': [
            ('Gäller det hela Tyresö?',
             'Vi matchar elever i Tyresö centrum, Bollmora, Krusboda, Fårdala, Trollbäcken, Tyresö '
             'strand, Brevik och Öringe. Hemma hos er går när studiehjälparen kan ta sig dit varje '
             'vecka, och annars börjar ni online.'),
            F_GYMNASIET,
            F_PRIS,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel huvudbiblioteket i Tyresö '
             'centrum. Filialerna i Trollbäcken och Tyresö strand är meröppna, så kolla när de har '
             'personal innan ni bokar.'),
        ],
    },
    {
        'slug': 'laxhjalp-varmdo',
        'namn': 'Värmdö',
        'i_namn': 'på Värmdö',
        'nav': 'Värmdö',
        'region': 'soder-och-oster',
        'grannar': [
            'laxhjalp-nacka', 'laxhjalp-tyreso',
        ],
        'beskrivning': (
            f'Läxhjälp på Värmdö för {PRIS} i timmen, i Gustavsberg, Hemmesta, Mölnvik och på Ingarö: '
            'hemma hos er, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp på Värmdö',
        'h1': 'Läxhjälp på<br><em>Värmdö.</em>',
        'lede': (
            'Från Gustavsberg till Djurö. Vi matchar elever i Värmdö kommun med en studiehjälpare som '
            'nyligen läst samma kurser själv, hemma hos er, på biblioteket eller online.'
        ),
        'bild': '10-forsta-motet',
        'delar': [
            'Gustavsberg', 'Gustavsbergs hamn', 'Hemmesta', 'Mölnvik', 'Ingarö', 'Brunn', 'Djurö',
            'Stavsnäs', 'Kopparmora',
        ],
        'transport': (
            'Värmdö har varken tunnelbana eller pendeltåg. Bussarna går från Slussen till Gustavsberg '
            'och vidare mot Hemmesta och Mölnvik. En studiehjälpare som bor längs tunnelbanan byter '
            'alltså en gång, vid Slussen, och längre ut i kommunen är online ofta det som gör att '
            'passen blir av varje vecka.'
        ),
        # Hemmesta bibliotek är obemannat och bara meröppet för den som är 18,
        # och Ingarö bibliotek stängde 2019.
        'bibliotek': ['Gustavsbergs bibliotek i Värmdö kulturhus'],
        'faq': [
            ('Kommer ni ut till Värmdö?',
             'Ja, när matchningen ger en studiehjälpare som kan ta sig dit varje vecka. Till '
             'Gustavsberg, Hemmesta och Mölnvik går bussarna från Slussen; på Ingarö, Djurö och '
             'längre ut börjar ni ofta online.'),
            F_PRIS,
            F_RAPPORT,
            ('Kan vi ses på biblioteket?',
             'Ja. Skriv platsen när ni föreslår tiden, till exempel Gustavsbergs bibliotek i Värmdö '
             'kulturhus i Gustavsbergs hamn, där bussen från Slussen stannar.'),
        ],
    },
]


# ============================================================
# ÄMNENA
#
# Samma skal, men sidan handlar om vad passen går ut på i ett ämne i
# stället för om var de hålls. De finns för att den som söker
# "läxhjälp matte" eller "läxhjälp kemi" letar efter ämnet, inte efter
# en stadsdel, och de sju områdessidorna svarar inte på den frågan.
#
# Samma regel som för områdena: ingenting som inte är sant. Inga
# betyg eller betygshöjningar, inga antal studiehjälpare per ämne,
# inga kursnamn med årtal. Det som står om ämnena är vad kursplanen
# faktiskt innehåller, och det som står om Nextrum är samma löfte som
# resten av sajten ger. Moderna språk och SO hade länge ingen sida,
# för hubben sa "fråga i anmälan så säger vi om vi har rätt person";
# sedan 2026-10-07 har de det, och sidorna säger att vi letar efter
# en studiehjälpare som läst samma, inte att vi har en. Programmering
# erbjuds inte och har ingen sida (Leo, 2026-10-07).
#
# `lista` är sidans kärna och det som skiljer den från syskonen. Håll
# den konkret: det eleven faktiskt fastnar på, stadium för stadium
# eller del för del.
# ============================================================

AMNEN = [
    {
        'slug': 'laxhjalp-matematik',
        'i_namn': 'i matte',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i matte i Stockholm, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i matte för {PRIS} i timmen, från mellanstadiet till gymnasiet, med en '
            'studiehjälpare som nyss läst kursen. Hemma eller online.'
        ),
        'etikett': 'Läxhjälp i matematik',
        'h1': 'Läxhjälp i<br><em>matte.</em>',
        'lede': (
            'Från multiplikationstabellen till derivatan. Vi matchar eleven med en '
            'studiehjälpare som nyligen läst samma kurs och som minns vilket steg som var det '
            'svåra.'
        ),
        'kort': 'Bråk, ekvationer, funktioner och derivata',
        'bild': '14-matematik',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Från tabellerna<br>till <em>derivatan.</em>',
        'lista_ingress': (
            'En lucka i matte blir större för varje år den får stå kvar. Därför börjar '
            'studieplanen med att hitta den, inte med kapitlet klassen råkar vara på.'
        ),
        'lista': [
            ('Mellanstadiet',
             'Multiplikationstabellen, division, bråk och decimaltal, och de första '
             'textuppgifterna. Här läggs grunden till allt som kommer sedan, och passen går ofta '
             'ut på att räkna i lugn takt tills det sitter.'),
            ('Högstadiet',
             'Negativa tal, procent, algebra och ekvationer, linjära funktioner, geometri, '
             'sannolikhet och statistik. Det är ofta här matten slutar vara räkning och blir '
             'ett språk, och den som tappar tråden i sjuan märker det i nian.'),
            ('Gymnasiet',
             'Från första kursens algebra och funktioner till andragradsekvationer, '
             'logaritmer, derivata, integraler och trigonometri. Skriv i anmälan vilken kurs '
             'eleven läser, så letar vi efter någon som läst just den.'),
            ('Inför provet',
             'Ett prov eller ett nationellt prov är ett tydligt mål, och studieplanen kan '
             'byggas bakåt från det: det som brukar komma, och det eleven själv känner sig '
             'osäker på, i den ordningen.'),
        ],
        'vinkel_etikett': 'Varför någon som nyss läst kursen',
        'vinkel_rubrik': 'Det svåra är<br>sällan det <em>svåraste.</em>',
        'vinkel': [
            'Det som får det att stanna är oftast steget före uppgiften, inte uppgiften: '
            'när x plötsligt står i exponenten, eller när en textuppgift inte säger vilken '
            'formel den vill ha. Den som läste samma kurs i fjol minns var det tog stopp för '
            'en själv, och vilken förklaring som till slut fungerade.',
            'Studieplanen skrivs utifrån elevens egna uppgifter och prov, inte utifrån en '
            'färdig mall. Ett mål kan vara så konkret som "klarar ekvationer med x på båda '
            'sidor", och rapporten efter varje pass säger hur nära ni är.',
        ],
        'faq': [
            ('Hjälper ni med matte på gymnasiet?',
             'Ja, från den första kursen till derivata och integraler. Skriv i anmälan vilken '
             'kurs eleven läser, så letar vi efter någon som har läst just den nyligen.'),
            ('Kan vi få hjälp inför ett nationellt prov i matte?',
             'Ja. Hör av er i god tid, gärna några veckor innan, så hinner vi matcha rätt '
             'person och studieplanen hinner gå igenom det som brukar komma.'),
            ('Räknar studiehjälparen uppgifterna åt eleven?',
             'Nej. Studiehjälparen förklarar, frågar och låter eleven räkna själv. Tanken är '
             'att eleven ska klara nästa uppgift också när ingen sitter bredvid.'),
            ('Vad kostar mattehjälpen?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift. Ni betalar varje pass med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir '
             'passet kortare än bokat betalar vi tillbaka mellanskillnaden.'),
        ],
    },
    {
        'slug': 'laxhjalp-svenska',
        'i_namn': 'i svenska',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i svenska i Stockholm, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i svenska för {PRIS} i timmen: läsförståelse, uppsatser och redovisningar, '
            'också i svenska som andraspråk. Hemma eller online.'
        ),
        'etikett': 'Läxhjälp i svenska',
        'h1': 'Läxhjälp i<br><em>svenska.</em>',
        'lede': (
            'Svenska är ämnet de andra står på. Den som läser långsamt eller skriver osäkert '
            'märker det i SO och NO också. Vi matchar eleven med en studiehjälpare som nyligen '
            'skrivit samma sorts texter själv.'
        ),
        'kort': 'Läsförståelse, uppsatser och svenska som andraspråk',
        'bild': '07-genombrottet',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Att läsa, skriva<br>och <em>säga det.</em>',
        'lista_ingress': (
            'Det är svårt att få syn på sin egen text. En andra läsare som är nära i ålder '
            'gör mest nytta innan texten lämnas in, inte efter att den fått ett betyg.'
        ),
        'lista': [
            ('Mellanstadiet',
             'Läsflyt och läsförståelse, och de första längre texterna: att berätta i ordning, '
             'skriva en faktatext och veta var en mening slutar.'),
            ('Högstadiet',
             'Argumenterande och utredande texter, novellanalys, källor och muntliga '
             'framföranden. Passen går ofta ut på att bygga upp en text tillsammans, stycke för '
             'stycke, så att eleven ser hur den hänger ihop.'),
            ('Gymnasiet',
             'Litteraturanalys, utredande och vetenskapligt skrivande, källhänvisningar och '
             'tal. Studiehjälparen har nyligen skrivit samma sorts texter och kan visa hur en '
             'tydlig inledning eller slutsats ser ut, utan att skriva den åt eleven.'),
            ('Svenska som andraspråk',
             'Ordförråd, grammatik och att förstå vad en uppgift faktiskt frågar efter. För '
             'många elever handlar det lika mycket om uppgifterna i andra ämnen som om '
             'svenskan i sig.'),
        ],
        'vinkel_etikett': 'Så arbetar studiehjälparen',
        'vinkel_rubrik': 'En läsare,<br>inte en <em>rättare.</em>',
        'vinkel': [
            'Studiehjälparen skriver inte texten åt eleven. Hen läser, frågar vad eleven menar '
            'och pekar på var en läsare tappar tråden, så att nästa text blir bättre av sig '
            'själv. En uppsats någon annan har skrivit lär eleven ingenting inför nästa.',
            'Rapporten efter varje pass säger vad ni arbetade med och vad som är nästa steg, '
            'och studieplanen följer det över terminen: från att hitta en tes till att hålla '
            'den genom hela texten.',
        ],
        'faq': [
            ('Hjälper ni elever som läser svenska som andraspråk?',
             'Ja. Skriv det i anmälan, så tar vi med det när vi väljer studiehjälpare. Passen '
             'kan då handla lika mycket om att förstå uppgifterna i andra ämnen som om '
             'svenskan i sig.'),
            ('Skriver studiehjälparen uppsatsen åt eleven?',
             'Nej. Studiehjälparen läser, ställer frågor och visar hur en text kan byggas upp, '
             'men det är eleven som skriver.'),
            ('Kan vi få hjälp med läsningen, inte bara skrivandet?',
             'Ja. För yngre elever handlar det ofta om läsflyt och om att förstå det man läst. '
             'Passen kan vara att läsa tillsammans och prata om texten, och rapporten efter '
             'varje pass visar hur det går.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift. Ni betalar varje pass med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir '
             'passet kortare än bokat betalar vi tillbaka mellanskillnaden.'),
        ],
    },
    {
        'slug': 'laxhjalp-engelska',
        'i_namn': 'i engelska',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i engelska i Stockholm, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i engelska för {PRIS} i timmen: ordförråd, grammatik, uppsatser och att '
            'våga prata. Från mellanstadiet till gymnasiet, hemma eller online.'
        ),
        'etikett': 'Läxhjälp i engelska',
        'h1': 'Läxhjälp i<br><em>engelska.</em>',
        'lede': (
            'De flesta elever förstår mer engelska än de vågar använda. Vi matchar eleven med '
            'en studiehjälpare som nyligen läst samma kurs, och passen går ut på att använda '
            'språket, inte bara läsa om det.'
        ),
        'kort': 'Ordförråd, grammatik, uppsatser och muntligt',
        'bild': '16-engelska',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Från glosorna<br>till <em>essän.</em>',
        'lista_ingress': (
            'Engelska övas bäst genom att användas. Därför blandar passen läsning, skrivande '
            'och samtal, i den takt eleven klarar.'
        ),
        'lista': [
            ('Mellanstadiet',
             'Ord, enkla meningar och att förstå instruktioner och texter. Här handlar det om '
             'att bygga ett ordförråd och att våga säga något, också när det inte blir rätt.'),
            ('Högstadiet',
             'Grammatik som tempus och oregelbundna verb, längre texter, hörförståelse och '
             'muntliga uppgifter. Passen kan vara helt på engelska eller på svenska med '
             'engelskan som det man arbetar med.'),
            ('Gymnasiet',
             'Essäer, analys av texter och filmer, formellt språk och muntliga presentationer. '
             'Studiehjälparen har nyligen skrivit samma sorts texter och kan visa skillnaden '
             'mellan att kunna engelska och att skriva en bra engelsk text.'),
            ('Inför provet',
             'Läsning, hörförståelse, skrivande och den muntliga delen övas på olika sätt. '
             'Studieplanen fördelar tiden efter vad eleven behöver mest, inte lika på allt.'),
        ],
        'vinkel_etikett': 'Varför någon nära i ålder',
        'vinkel_rubrik': 'Att våga prata är<br>halva <em>ämnet.</em>',
        'vinkel': [
            'Muntlig engelska är svår att öva ensam. Med någon som är nära i ålder, och som '
            'själv minns hur det var att hålla en presentation på engelska inför klassen, går '
            'det lättare att säga något högt innan det räknas.',
            'Passen hålls på engelska om eleven vill, eller på svenska med förklaringarna där. '
            'Det väljs efter eleven, och studieplanen och rapporten efter varje pass följer '
            'hur det går.',
        ],
        'faq': [
            ('Kan passen hållas på engelska?',
             'Ja, om eleven vill det. Många tycker att det är det bästa sättet att öva, andra '
             'vill hellre ha förklaringarna på svenska. Säg vad ni föredrar i anmälan.'),
            ('Hjälper ni inför nationella provet i engelska?',
             'Ja. Hör av er i god tid, så hinner studieplanen gå igenom läsning, '
             'hörförståelse, skrivande och den muntliga delen.'),
            ('Är online lika bra för engelska?',
             'För de flesta, ja. Samtal och skrivande fungerar bra på skärm, med samma '
             'studiehjälpare, samma studieplan och samma rapport efteråt. För de yngsta '
             'eleverna brukar det gå lättare att ses.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift. Ni betalar varje pass med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir '
             'passet kortare än bokat betalar vi tillbaka mellanskillnaden.'),
        ],
    },
    {
        'slug': 'laxhjalp-no',
        'i_namn': 'i fysik, kemi och biologi',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i fysik, kemi och biologi, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i NO för {PRIS} i timmen: fysik, kemi och biologi, formler och '
            'labbrapporter. En studiehjälpare som nyss läst kursen, hemma eller online.'
        ),
        'etikett': 'Läxhjälp i NO',
        'h1': 'Läxhjälp i fysik,<br>kemi och <em>biologi.</em>',
        'lede': (
            'I NO kommer begreppen tätt, och ett missat kapitel gör nästa svårt att förstå. Vi '
            'matchar eleven med en studiehjälpare som nyligen läst samma kurs, och som kan ta '
            'det i den ordning eleven behöver.'
        ),
        'kort': 'Formler, begrepp och labbrapporter',
        'bild': '17-no-naturvetenskap',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Tre ämnen som<br>bygger på <em>sig själva.</em>',
        'lista_ingress': (
            'Högstadiet och gymnasiet. Skriv i anmälan vilket ämne och vilken kurs det '
            'gäller, så letar vi efter en studiehjälpare som läst just den.'
        ),
        'lista': [
            ('Fysik',
             'Krafter och rörelse, energi, elektricitet, tryck och vågor. Mycket av fysiken är '
             'att veta vilken formel som hör till vilken situation och vad enheterna betyder, '
             'och det går att öva.'),
            ('Kemi',
             'Atomer och periodiska systemet, bindningar, reaktioner, syror och baser, och på '
             'gymnasiet substansmängd och reaktionsformler. Kemin bygger på sig själv: den som '
             'inte förstått atomen har svårt med bindningarna.'),
            ('Biologi',
             'Cellen, kroppen, ekologi, genetik och evolution. Biologin har färre formler och '
             'fler begrepp, och det som hjälper är ofta att förklara med egna ord tills det '
             'sitter.'),
            ('Labbrapporter',
             'Syfte, hypotes, metod, resultat och slutsats. En rapport säger ofta mindre än '
             'eleven faktiskt förstått, och hur man skriver den går att öva som allt annat.'),
        ],
        'vinkel_etikett': 'Så lägger vi upp det',
        'vinkel_rubrik': 'Ett kapitel i taget,<br>i rätt <em>ordning.</em>',
        'vinkel': [
            'Ett NO-prov täcker ofta ett helt arbetsområde på en gång, och det är lätt att '
            'plugga det som känns enkelt och hoppa över resten. Studieplanen delar upp '
            'området så att det svåra kommer först, medan det finns tid.',
            'Studiehjälparen har läst kursen nyligen och minns vilka begrepp som var svårast '
            'att få grepp om, och vilka förklaringar som till slut fungerade. Rapporten efter '
            'varje pass säger vad ni hann och vad som är nästa steg.',
        ],
        'faq': [
            ('Hjälper ni med alla tre NO-ämnena?',
             'Ja, fysik, kemi och biologi, på högstadiet och gymnasiet. Skriv i anmälan vilket '
             'ämne och vilken kurs det gäller, så letar vi efter en studiehjälpare som läst '
             'just den.'),
            ('Kan vi få hjälp med en labbrapport?',
             'Ja. Studiehjälparen går igenom hur en rapport är uppbyggd och läser elevens '
             'utkast, men det är eleven som skriver. Det är så man lär sig skriva nästa själv.'),
            ('Går det att plugga inför ett prov på kort tid?',
             'Ja, men ju tidigare desto bättre. Med en vecka kvar hinner ni det viktigaste; '
             'med tre veckor hinner ni förstå det, inte bara känna igen det.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift. Ni betalar varje pass med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir '
             'passet kortare än bokat betalar vi tillbaka mellanskillnaden.'),
        ],
    },
    {
        'slug': 'laxhjalp-so',
        'i_namn': 'i SO',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i SO i Stockholm, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i SO för {PRIS} i timmen: historia, samhällskunskap, geografi och religion '
            'med någon som nyss läst kursen. Hemma eller online.'
        ),
        'etikett': 'Läxhjälp i SO',
        'h1': 'Läxhjälp i<br><em>SO.</em>',
        'lede': (
            'Historia, samhällskunskap, geografi och religionskunskap. I SO räcker det sällan att '
            'kunna fakta: eleven ska kunna förklara varför något hände och vad det ledde till. Vi '
            'matchar eleven med en studiehjälpare som nyligen läst samma kurs.'
        ),
        'kort': 'Historia, samhällskunskap, geografi och religion',
        'bild': '13-kvallsplugg',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Fyra ämnen,<br>ett sätt att <em>tänka.</em>',
        'lista_ingress': (
            'Från mellanstadiet till gymnasiet. Skriv i anmälan vilket ämne och vilken kurs det '
            'gäller, så letar vi efter en studiehjälpare som läst just den.'
        ),
        'lista': [
            ('Historia',
             'Perioder, orsaker och följder: varför något hände, vad det ledde till och hur vi vet '
             'det. Passen går ofta ut på att få ordning på tidslinjen och sedan öva på att förklara '
             'sambanden med egna ord.'),
            ('Samhällskunskap',
             'Demokrati och hur samhället styrs, ekonomi, lagar och rättigheter, och nyheter och '
             'källor. Det hjälper att ta exemplen ur verkligheten, så att begreppen får något att '
             'hänga på.'),
            ('Geografi',
             'Kartan, klimatet, befolkning och resurser, och hur människan och naturen påverkar '
             'varandra. Mycket handlar om att läsa kartor, diagram och tabeller och säga vad de '
             'visar.'),
            ('Religionskunskap',
             'Världsreligionerna och andra livsåskådningar, och etik: att resonera om rätt och fel '
             'utifrån olika synsätt, där det inte finns ett facit.'),
        ],
        'vinkel_etikett': 'Så lägger vi upp det',
        'vinkel_rubrik': 'Mer än att<br>kunna <em>årtalen.</em>',
        'vinkel': [
            'Ett prov i SO frågar ofta inte bara vad som hände, utan varför, och vad det fick för '
            'följder. Det går att öva: att ta ett exempel, förklara det och jämföra med ett annat, '
            'tills eleven kan göra det själv på provet.',
            'Studiehjälparen har läst kursen nyligen och minns hur frågorna var ställda. '
            'Studieplanen utgår från elevens egna uppgifter och prov, och rapporten efter varje '
            'pass säger vad ni hann och vad som är nästa steg.',
        ],
        'faq': [
            ('Hjälper ni med alla SO-ämnena?',
             'Ja, historia, samhällskunskap, geografi och religionskunskap, från mellanstadiet till '
             'gymnasiet. Skriv i anmälan vilket ämne och vilken kurs det gäller, så letar vi efter '
             'en studiehjälpare som läst just den.'),
            ('Kan vi få hjälp med en inlämning eller ett grupparbete?',
             'Ja. Studiehjälparen hjälper eleven att hitta och granska källor, lägga upp texten och '
             'läsa utkastet, men det är eleven som skriver.'),
            ('Går det att plugga inför ett prov på kort tid?',
             'Ja, men ju tidigare desto bättre. Med en vecka kvar hinner ni det viktigaste; med tre '
             'veckor hinner eleven öva på att förklara och resonera, inte bara känna igen orden.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
    {
        'slug': 'laxhjalp-moderna-sprak',
        'i_namn': 'i spanska, tyska och franska',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp i spanska, tyska och franska, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i spanska, tyska och franska för {PRIS} i timmen: glosor, grammatik och att '
            'våga prata. Hemma hos er i Stockholm eller online.'
        ),
        'etikett': 'Läxhjälp i moderna språk',
        'h1': 'Läxhjälp i spanska,<br>tyska och <em>franska.</em>',
        'lede': (
            'Ett nytt språk bygger på sig självt: den som tappar verbformerna i början har svårt '
            'med allt som kommer sedan. Vi matchar eleven med en studiehjälpare som nyligen läst '
            'samma språk.'
        ),
        'kort': 'Glosor, grammatik och att våga prata',
        'bild': '09-online-v2',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Från glosorna<br>till <em>samtalet.</em>',
        'lista_ingress': (
            'Som språkval i grundskolan och på gymnasiet. Skriv i anmälan vilket språk det gäller '
            'och hur länge eleven har läst det, så letar vi efter en studiehjälpare som läst samma.'
        ),
        'lista': [
            ('Glosor och ordförråd',
             'Att lära sig orden så att de sitter kvar efter förhöret: att öva i omgångar, säga dem '
             'högt och använda dem i meningar, i stället för att läsa listan många gånger samma '
             'kväll.'),
            ('Grammatik',
             'Verbens böjning, genus, ordföljd och, i tyskan, kasus. Grammatiken är det som gör att '
             'eleven kan bygga egna meningar, och den går att ta ett steg i taget.'),
            ('Hörförståelse och läsning',
             'Att förstå en text eller en inspelning utan att översätta varje ord, och att gissa '
             'rätt utifrån sammanhanget.'),
            ('Att prata och skriva',
             'Muntliga prov och skrivuppgifter. Det svåraste är ofta att våga säga något högt, och '
             'det är lättare att öva med någon som är nära i ålder.'),
        ],
        'vinkel_etikett': 'Varför någon som nyss läst språket',
        'vinkel_rubrik': 'Samma glosor,<br>samma <em>verbformer.</em>',
        'vinkel': [
            'Studiehjälparen har själv läst språket i skolan nyligen och minns vilka verbformer och '
            'regler som var svårast att få att sitta, och vad som till slut fungerade.',
            'Passen hålls på språket så mycket eleven klarar, och på svenska när något behöver '
            'förklaras. Studieplanen följer elevens egna glosor och prov, och rapporten efter varje '
            'pass säger vad som är nästa steg.',
        ],
        'faq': [
            ('Vilka språk hjälper ni med?',
             'Spanska, tyska och franska. Skriv i anmälan vilket språk det gäller och hur länge '
             'eleven har läst det, så letar vi efter en studiehjälpare som läst samma.'),
            ('Kan passen hållas på språket?',
             'Ja, så mycket eleven vill och klarar, med förklaringarna på svenska när det behövs. '
             'Säg vad ni föredrar i anmälan.'),
            ('Hjälper ni inför ett muntligt prov?',
             'Ja. Studiehjälparen övar samtalet med eleven, med de ämnen och frågor som kan komma, '
             'hemma hos er eller online.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
]


# ============================================================
# ONLINE
#
# "Läxhjälp online" stod inte på en enda sida, fast tjänsten finns och
# anmälan frågar efter önskat upplägg. Sidan byggs som en ämnessida (lista, vinkel,
# samma löfte) men hör inte till AMNEN: den hade då stått som ett
# ämne i "Läxhjälp per ämne" på varje sida.
#
# Den säger ingenting om var i landet eleven får bo. Att ta emot
# familjer utanför Stockholm är ett beslut om affären, inte om en
# sida, och tills det är fattat lovar sidan inte mer än resten av
# sajten. Länken till samtalet beskrivs som "i studievyn": där står
# Meet-länken när Google är kopplat, och meddelandet med länken när
# det inte är det (Fas 18.1). Ingen tjänst nämns vid namn.
# ============================================================

ONLINE = {
    'slug': 'laxhjalp-online',
    'i_namn': 'online',
    'plats': 'Stockholm',
    'titel': f'Läxhjälp online med egen studiehjälpare, {PRIS_KR} kr/tim | Nextrum',
    'beskrivning': (
        f'Läxhjälp online för {PRIS} i timmen med en studiehjälpare som nyss läst samma kurser: '
        'samma studieplan och rapport som när ni ses hemma.'
    ),
    'etikett': 'Läxhjälp online',
    'h1': 'Läxhjälp<br><em>online.</em>',
    'lede': (
        'Samma studiehjälpare, samma studieplan och samma rapport efter varje pass som när '
        'ni ses hemma, fast över video. Ni väljer för varje pass om det ska hållas online '
        'eller hemma hos er.'
    ),
    'kort': 'Samma studiehjälpare och rapport, över video',
    'bild': '03-digital-laxhjalp',
    'lista_etikett': 'Så går ett onlinepass till',
    'lista_rubrik': 'Från länken<br>till <em>rapporten.</em>',
    'lista_ingress': (
        'Ett onlinepass är inte en föreläsning. Eleven har sina egna uppgifter framför sig, '
        'och studiehjälparen frågar och förklarar tills det sitter.'
    ),
    'lista': [
        ('Ni föreslår en tid',
         'I studievyn väljer ni dag, ämne och tid, och att passet ska hållas online. '
         'Studiehjälparen bekräftar tiden eller föreslår en annan.'),
        ('Länken',
         'När passet är bekräftat får ni länken till samtalet i studievyn. Eleven går in '
         'från datorn eller surfplattan när passet börjar.'),
        ('Under passet',
         'Eleven har boken, uppgiften eller provet framför sig och räknar och skriver själv. '
         'Studiehjälparen frågar hur eleven tänker och förklarar där det tar stopp. Det som '
         'är svårt att beskriva i ord går att hålla upp framför kameran.'),
        ('Rapporten',
         'Efter passet skriver studiehjälparen en rapport om vad ni gick igenom och hur det '
         'gick. Den hamnar i studievyn precis som efter ett pass hemma.'),
    ],
    'vinkel_etikett': 'Online eller hemma',
    'vinkel_rubrik': 'Skärmen eller<br><em>köksbordet?</em>',
    'vinkel': [
        'Online sparar restid för båda, och det blir lättare att hitta någon som läst just '
        'den kurs eleven läser, eftersom studiehjälparen inte behöver bo nära er. Det '
        'fungerar ofta bäst för den som går på högstadiet eller gymnasiet och har något '
        'konkret att jobba med: en uppgift, ett kapitel, ett prov på fredag.',
        'Hemma är ofta bättre för yngre barn, och för den som har svårt att komma igång '
        'framför en skärm. Ni behöver inte välja en gång för alla: ni kan ses hemma i '
        'vardagen och ta passet inför provet online.',
        'Det som gör mest skillnad för ett onlinepass är enkla saker. Hörlurar med '
        'mikrofon, en dator hellre än en telefon, ett rum där eleven får vara ifred, och '
        'boken och uppgiften framme innan passet börjar.',
    ],
    'omraden_rubrik': 'Hellre hemma hos er?',
    'faq': [
        ('Vad behövs för ett onlinepass?',
         'En dator eller surfplatta med kamera och mikrofon, och en uppkoppling som klarar '
         'ett videosamtal. Hörlurar gör det lättare att höra. En telefon fungerar, men '
         'skärmen blir liten när ni ska titta på samma uppgift.'),
        ('Kostar ett onlinepass mindre än ett pass hemma?',
         f'Nej. {PRIS} i timmen oavsett om passet hålls online eller hemma hos er, och '
         'ingen restidsavgift när studiehjälparen kommer hem till er.'),
        ('Kan vi byta mellan online och hemma?',
         'Ja. Ni väljer för varje pass när ni föreslår tiden. Det är samma studiehjälpare, '
         'samma studieplan och samma rapport efteråt, så ingenting går förlorat när ni byter.'),
        ('Passar online för yngre barn?',
         'Det beror på barnet. Den som går på lågstadiet eller mellanstadiet har ofta '
         'lättare att hålla fokus när någon sitter bredvid, och då är ett pass hemma hos er '
         'oftast bättre. Skriv vad ni tror i anmälan, så pratar vi om det när vi hör av oss.'),
    ],
}


# ============================================================
# STADIERNA (2026-10-06)
#
# Föräldrar söker på stadium lika ofta som på ämne: "läxhjälp
# högstadiet", "läxhjälp gymnasiet". Sidorna byggs med amnessida() och
# följer samma regel: inga betyg eller betygshöjningar, inga kursnamn
# med årtal (gymnasiet bytte till ämnen och nivåer), och inga
# påståenden om hur familjerna brukar göra, för de är inte många än.
# Ingen av dem har betalningsmeningen: priset står kort och länkar till
# prissidan, så kolla-betalningsvillkor.py behöver inte bevaka dem.
# ============================================================

STADIER = [
    {
        'slug': 'laxhjalp-lagstadiet',
        'i_namn': 'för lågstadiet',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp för lågstadiet (åk 1–3), {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i åk 1–3 för {PRIS} i timmen: läsa, skriva och räkna i barnets egen takt. '
            'Hemma hos er i Stockholm, på biblioteket eller online.'
        ),
        'etikett': 'Läxhjälp för lågstadiet',
        'h1': 'Läxhjälp för<br><em>lågstadiet.</em>',
        'lede': (
            'I ettan, tvåan och trean lär sig barnet läsa, skriva och räkna, och resten av skolan '
            'bygger på det. Vi matchar barnet med en studiehjälpare som tar det lugnt och i '
            'barnets takt.'
        ),
        'kort': 'Åk 1–3: läsa, skriva och räkna',
        'bild': '21-hemma-hos-familjen',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Läsa, skriva<br>och <em>räkna.</em>',
        'lista_ingress': (
            'Det som sitter i trean bär resten av skolan. Studieplanen börjar med det barnet '
            'faktiskt fastnar på, och tar ett steg i taget.'
        ),
        'lista': [
            ('Läsa',
             'Bokstäverna och ljuden, att ljuda ihop ord och att läsa med flyt. Passen kan vara att '
             'läsa högt tillsammans och prata om det man läst, så att barnet märker att det '
             'förstår.'),
            ('Skriva',
             'Att forma bokstäverna, stava vanliga ord och skriva några meningar i rätt ordning: '
             'först det som hände, sedan det som hände sedan.'),
            ('Räkna',
             'Talen och positionssystemet, plus och minus, de första gångertabellerna, klockan och '
             'enkla problem i ord. Gärna med saker att räkna med, inte bara siffror på papper.'),
            ('Läxan och lusten',
             'En stund med läxan som inte slutar i gråt. En rutin och en takt som fungerar är lika '
             'mycket värd som själva uppgiften.'),
        ],
        'vinkel_etikett': 'Hemma, i lugn takt',
        'vinkel_rubrik': 'En stund som<br>känns <em>lätt.</em>',
        'vinkel': [
            'För de yngsta passar ett pass hemma hos er eller på biblioteket ofta bättre än en '
            'skärm. Ett pass är minst en timme, och för ett barn i ettan blir den lagom med en '
            'paus i mitten och omväxling mellan att läsa, skriva och räkna.',
            'Studiehjälparen tar det i barnets takt och låter barnet göra jobbet själv. Rapporten '
            'efter varje pass säger vad ni gjorde och hur det gick, så att ni vet vad ni kan '
            'fortsätta med hemma.',
        ],
        'faq_rubrik': 'Lågstadiet, det ni brukar undra',
        'faq': [
            ('Från vilken årskurs hjälper ni?',
             'Från årskurs ett. Skriv årskursen i anmälan, så tar vi med det när vi väljer '
             'studiehjälpare.'),
            ('Är en timme för länge för ett litet barn?',
             'Ett pass är minst en timme. Med en paus i mitten och omväxling mellan att läsa, '
             'skriva och räkna blir timmen inte lång, och studiehjälparen anpassar takten efter '
             'barnet.'),
            ('Gör studiehjälparen läxan åt barnet?',
             'Nej. Studiehjälparen läser med barnet, frågar och förklarar, men det är barnet som '
             'läser, skriver och räknar. Målet är att nästa läxa går lättare också när ingen sitter '
             'bredvid.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma för alla årskurser och ämnen. Sitter ett syskon med i samma '
             f'pass kostar det {EXTRA_BARN} extra i timmen totalt. Ingen bindningstid och ingen '
             'månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
    {
        'slug': 'laxhjalp-mellanstadiet',
        'i_namn': 'för mellanstadiet',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp för mellanstadiet (åk 4–6), {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i åk 4–6 för {PRIS} i timmen: läsförståelse, tabellerna, bråk och engelska, '
            'och lugn inför proven i sexan. Hemma eller online.'
        ),
        'etikett': 'Läxhjälp för mellanstadiet',
        'h1': 'Läxhjälp för<br><em>mellanstadiet.</em>',
        'lede': (
            'I mellanstadiet ska läsningen och räknandet börja bära resten av skolan. Vi '
            'matchar eleven med en studiehjälpare som tar det i elevens takt.'
        ),
        'kort': 'Åk 4–6: läsning, tabellerna, bråk och engelska',
        'bild': 'hero-nextrum',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Grunden som<br>allt <em>vilar på.</em>',
        'lista_ingress': (
            'I fyran, femman och sexan blir läxorna längre och kraven tydligare. Det som inte '
            'sitter nu följer med upp i högstadiet, så studieplanen börjar med det eleven '
            'faktiskt fastnar på.'
        ),
        'lista': [
            ('Svenska',
             'Läsflyt och läsförståelse, att berätta i ordning och att skriva en faktatext. '
             'Passen kan vara att läsa tillsammans och prata om texten, så att eleven märker '
             'vad hen har förstått.'),
            ('Matte',
             'Multiplikationstabellen, division, bråk och decimaltal och de första '
             'textuppgifterna. Här lönar det sig att räkna i lugn takt tills det sitter, i '
             'stället för att hinna med kapitlet.'),
            ('Engelska',
             'Ordförråd, att våga säga något och att förstå en text utan att översätta varje '
             'ord.'),
            ('Proven i sexan',
             'I sexan skrivs nationella prov. Studieplanen kan byggas bakåt från dem: det som '
             'brukar komma, och det eleven själv känner sig osäker på.'),
        ],
        'vinkel_etikett': 'Hemma eller online',
        'vinkel_rubrik': 'Någon som<br>sitter <em>bredvid.</em>',
        'vinkel': [
            'I den här åldern är det ofta lättare att hålla fokus när någon sitter bredvid, så '
            'ett pass hemma hos er eller på biblioteket passar många bättre än skärmen. Ni '
            'väljer för varje pass.',
            'Studiehjälparen har själv gått igenom högstadiet och vet vad som behöver sitta '
            'innan dess.',
            'Rapporten efter varje pass säger vad ni gjorde och hur det gick, så att ni hemma '
            'vet vad ni kan fråga om.',
        ],
        'faq_rubrik': 'Mellanstadiet, det ni brukar undra',
        'faq': [
            ('Hjälper ni yngre barn, i lågstadiet?',
             'Ja, från årskurs ett. Skriv årskursen i anmälan, så tar vi med det när vi väljer '
             'studiehjälpare.'),
            ('Kan vi få hjälp inför de nationella proven i sexan?',
             'Ja. Hör av er några veckor innan, så hinner vi matcha rätt person och '
             'studieplanen hinner gå igenom det som brukar komma.'),
            ('Gör studiehjälparen läxan åt barnet?',
             'Nej. Studiehjälparen frågar, förklarar och låter barnet räkna och skriva själv. '
             'Målet är att nästa läxa går lättare också när ingen sitter bredvid.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma för alla årskurser och ämnen. Sitter ett syskon med i '
             f'samma pass kostar det {EXTRA_BARN} extra i timmen totalt. Ingen bindningstid och '
             'ingen månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
    {
        'slug': 'laxhjalp-hogstadiet',
        'i_namn': 'för högstadiet',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp för högstadiet (åk 7–9), {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp i åk 7–9 för {PRIS} i timmen, med en studiehjälpare som nyss gått ut nian '
            'själv. Matte, svenska, engelska och NO, hemma eller online.'
        ),
        'etikett': 'Läxhjälp för högstadiet',
        'h1': 'Läxhjälp för<br><em>högstadiet.</em>',
        'lede': (
            'I högstadiet blir ämnena fler och betygen räknas inför gymnasievalet. Vi matchar '
            'eleven med en studiehjälpare som själv gått igenom samma år för inte så länge sedan.'
        ),
        'kort': 'Åk 7–9: ekvationer, NO, texterna och proven i nian',
        'bild': '12-pa-vag',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Fler ämnen,<br>högre <em>tempo.</em>',
        'lista_ingress': (
            'Det som gick av sig självt i mellanstadiet räcker inte alltid i sjuan. '
            'Studieplanen börjar med det som tar stopp nu och med det som kommer på nästa prov.'
        ),
        'lista': [
            ('Matte',
             'Negativa tal, procent, algebra och ekvationer, linjära funktioner, geometri och '
             'sannolikhet. Den som tappar tråden i sjuan märker det ofta i nian, så det lönar '
             'sig att täppa till luckan tidigt.'),
            ('NO',
             'Fysik, kemi och biologi med fler begrepp, formler och laborationsrapporter. Passen '
             'går ut på att förstå sambanden, inte bara att lära sig orden utantill.'),
            ('Svenska och engelska',
             'Argumenterande och utredande texter, novellanalys, muntliga redovisningar och '
             'engelska texter som blir längre för varje termin.'),
            ('Proven i nian',
             'I nian skrivs nationella prov, och betygen avgör vilket gymnasieprogram eleven '
             'kommer in på. Studieplanen kan byggas bakåt från proven, i god tid.'),
        ],
        'vinkel_etikett': 'Varför någon som nyss gått där',
        'vinkel_rubrik': 'Nära i ålder,<br>en bit <em>före.</em>',
        'vinkel': [
            'En tonåring lyssnar ofta lättare på någon som är några år äldre än på en vuxen. '
            'Studiehjälparen har själv suttit med samma sorts prov och minns vilka knep som '
            'fungerade.',
            'Online passar ofta bra i den här åldern, särskilt när eleven har något konkret att '
            'jobba med: en uppgift, ett kapitel eller ett prov på fredag. Ni väljer hemma eller '
            'online för varje pass.',
        ],
        'faq_rubrik': 'Högstadiet, det ni brukar undra',
        'faq': [
            ('Kan vi få hjälp inför de nationella proven i nian?',
             'Ja. Hör av er i god tid, gärna några veckor innan, så hinner vi matcha rätt person '
             'och gå igenom det som brukar komma.'),
            ('Kan studiehjälparen hjälpa till i flera ämnen?',
             'Ofta, ja. Skriv i anmälan vilka ämnen det gäller, så letar vi efter någon som kan '
             'dem. Behövs två olika personer säger vi det.'),
            ('Hjälper ni med studieteknik och planering?',
             'Ja. Att planera veckan, plugga inför prov och komma igång med läxorna kan vara en '
             'del av studieplanen, och det går att ha som mål på samma sätt som ett ämne.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma för alla årskurser och ämnen. Ingen bindningstid och ingen '
             'månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
    {
        'slug': 'laxhjalp-gymnasiet',
        'i_namn': 'för gymnasiet',
        'plats': 'Stockholm',
        'titel': f'Läxhjälp för gymnasiet i Stockholm, {PRIS_KR} kr/tim | Nextrum',
        'beskrivning': (
            f'Läxhjälp på gymnasiet för {PRIS} i timmen: matte, fysik, kemi, svenska och engelska, '
            'med en studiehjälpare som läst samma ämne nyligen.'
        ),
        'etikett': 'Läxhjälp för gymnasiet',
        'h1': 'Läxhjälp för<br><em>gymnasiet.</em>',
        'lede': (
            'På gymnasiet räcker det sällan med vilken hjälp som helst: det ska vara någon som '
            'läst just det ämnet och den nivån. Skriv vad eleven läser, så letar vi efter den '
            'personen.'
        ),
        'kort': 'Matte, NO och skrivandet, nivå för nivå',
        'bild': '11-studiehjalparen',
        'lista_etikett': 'Vad passen går ut på',
        'lista_rubrik': 'Rätt ämne,<br>rätt <em>nivå.</em>',
        'lista_ingress': (
            'Gymnasiet går fortare än högstadiet, och en lucka hinner bli stor på en termin. '
            'Studieplanen utgår från elevens egna uppgifter och prov.'
        ),
        'lista': [
            ('Matte',
             'Från algebra och funktioner till andragradsekvationer, logaritmer, derivata, '
             'integraler och trigonometri, beroende på program och nivå.'),
            ('Fysik, kemi och biologi',
             'Formler, beräkningar, begrepp och laborationsrapporter. Ofta handlar det om att se '
             'vilket samband en uppgift egentligen frågar efter.'),
            ('Svenska och engelska',
             'Litteraturanalys, utredande och vetenskapligt skrivande, källhänvisningar och '
             'muntliga framföranden.'),
            ('Inför provet',
             'Ett prov är ett tydligt mål, och studieplanen kan byggas bakåt från det: det som '
             'brukar komma, och det eleven själv känner sig osäker på.'),
        ],
        'vinkel_etikett': 'Varför någon som nyss läst ämnet',
        'vinkel_rubrik': 'Minns var<br>det tog <em>stopp.</em>',
        'vinkel': [
            'För en gymnasieelev letar vi efter en studiehjälpare som pluggar på högskolan eller '
            'själv har läst samma ämne och nivå nyligen. Hen minns var det tog stopp, och vilken '
            'förklaring som till slut fungerade.',
            'Online fungerar ofta bra på gymnasiet. Det gör det lättare att hitta någon som läst '
            'just den nivån, eftersom studiehjälparen inte behöver bo nära er.',
        ],
        'faq_rubrik': 'Gymnasiet, det ni brukar undra',
        'faq': [
            ('Vilka ämnen hjälper ni med på gymnasiet?',
             'Framför allt matte, fysik, kemi, biologi, svenska och engelska. Skriv i anmälan vad '
             'eleven läser, så säger vi om vi har rätt person.'),
            ('Kan vi få hjälp med ett enda prov?',
             'Ja. Det finns ingen bindningstid, och ett pass eller två inför ett prov går bra. '
             'Hör av er i god tid, så hinner vi matcha rätt person.'),
            ('Gör studiehjälparen uppgifterna åt eleven?',
             'Nej. Studiehjälparen förklarar, ställer frågor och visar hur en text eller en '
             'lösning kan byggas upp, men det är eleven som gör uppgiften.'),
            ('Vad kostar det?',
             f'{PRIS} i timmen, samma för alla ämnen och nivåer. Ingen bindningstid och ingen '
             'månadsavgift, och hur betalningen går till står på prissidan.'),
        ],
    },
]


# ============================================================
# GUIDERNA
#
# Svar på det föräldrar söker innan de vet att de letar efter
# läxhjälp: "hjälpa barn med matte", "läsförståelse", "plugga inför
# prov", "barn vill inte göra läxor". De ska gå att läsa och ha nytta
# av utan att någon bokar något. En guide som bara är en reklamsida
# för Nextrum rankar inte, och den förtjänar inte att göra det.
#
# Samma sanningsregel som resten. Det en guide påstår om forskning
# eller om andra organisationer ska gå att kontrollera, och länken
# står i `kallor`. Provguidens källor kontrollerades 2026-09-28 mot
# sökträffarna (titel, adress och vad sidan säger), inte genom att
# öppna sidorna: nätet där texten skrevs släppte inte fram dem. Öppna
# dem en gång innan någon mening som vilar på dem skrivs om.
#
# Guiden om gratis läxhjälp (biblioteken, Röda Korset, Mattecentrum)
# togs bort 2026-09-28, Leos beslut: andra guider i stället. Adressen
# stod i kartan och bland dem GOOGLE.md säger åt er att skicka in, så
# den omdirigeras i vercel.json i stället för att svara 404: sedan
# 2026-10-12 till kostnadsguiden, inte navet (GOOGLE.md).
# ============================================================

GUIDER = [
    {
        'slug': 'hjalpa-barn-med-matte',
        'grupp': 'hemma',
        'i_namn': 'i matte hemma',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Så hjälper du ditt barn med matteläxan | Nextrum',
        'beskrivning': (
            'Konkreta råd för föräldrar: fråga innan du förklarar, låt barnet hålla pennan och '
            'gå tillbaka ett steg när det tar stopp. Och när det inte går hemma.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Hjälpa barnet med matteläxan',
        'kort': 'Sex saker som brukar fungera vid köksbordet',
        'h1': 'Hjälpa barnet med<br><em>matteläxan.</em>',
        'lede': (
            'Många föräldrar kan matten men märker att hjälpen ändå inte går fram. Oftast '
            'handlar det om hur hjälpen ges, inte om vad man kan. Här är det som brukar fungera.'
        ),
        'bild': '14-matematik',
        'lista_etikett': 'Det som brukar fungera',
        'lista_rubrik': 'Sex saker<br>att <em>prova.</em>',
        'lista_ingress': (
            'Inget av det kräver att du kan matten själv. Det mesta handlar om att låta barnet '
            'göra jobbet och om att sluta i tid.'
        ),
        'lista': [
            ('Fråga innan du förklarar',
             '"Vad frågar uppgiften efter?" och "vad har du provat?" säger mer om var det tar '
             'stopp än en förklaring från början. Ofta räcker frågan.'),
            ('Låt barnet hålla pennan',
             'Den som skriver är den som tänker. Räknar du själv på ett papper bredvid blir det '
             'din lösning, inte barnets.'),
            ('Gå tillbaka ett steg',
             'Tar det stopp på ekvationer är problemet ofta bråk eller negativa tal. Hitta '
             'steget före och öva det en stund, så brukar resten lossna.'),
            ('Använd bokens sätt',
             'Uträkningar skrivs ibland annorlunda än när du gick i skolan. Be barnet visa hur '
             'läraren gjorde och utgå från det, även om du själv räknar på ett annat sätt.'),
            ('Kort och ofta',
             'En kvart varje dag gör mer än en lång kväll före provet. Sluta medan det '
             'fortfarande går bra, inte när någon har gett upp.'),
            ('Beröm det barnet gör',
             '"Du provade tre sätt innan det lossnade" bygger mer än "du är ju duktig på '
             'matte". Det första går att göra om nästa gång, det andra går inte att påverka.'),
        ],
        'kallor': [
            ('Matteboken från Mattecentrum', 'https://www.matteboken.se/'),
        ],
        'vinkel_etikett': 'När det inte går hemma',
        'vinkel_rubrik': 'Ibland är det<br>fel <em>person.</em>',
        'vinkel': [
            'Det är vanligt att det låser sig just mellan förälder och barn. Tålamodet tar slut '
            'på båda sidor, och läxan blir ett gräl om något annat än matte. Det säger '
            'ingenting om vare sig barnet eller föräldern.',
            'En studiehjälpare som nyligen läst samma kurs är en annan sorts person att fråga: '
            'nära i ålder och utan förväntningar från middagsbordet. Hos Nextrum är det samma '
            'person varje gång, med en studieplan och en rapport efter varje pass, så att ni '
            'ser vad som händer utan att behöva sitta med.',
        ],
        'faq_rubrik': 'Matteläxan hemma, det ni brukar undra',
        'faq': [
            ('Jag kan inte den matte mitt barn läser. Kan jag ändå hjälpa till?',
             'Ja. Att fråga, lyssna och låta barnet förklara för dig hjälper även när du inte '
             'kan svaret. Mattecentrums Matteboken har gratis genomgångar med video om ni vill '
             'läsa på tillsammans.'),
            ('Hur länge ska vi sitta?',
             'Hellre kort och ofta. Märker ni att ingen av er orkar längre är det bättre att '
             'sluta och ta det dagen efter än att fortsätta.'),
            ('När är det dags att ta in hjälp?',
             'När samma sak tar stopp vecka efter vecka, när läxan blir ett gräl, eller när ett '
             'prov närmar sig och ni inte vet var ni ska börja. Då hjälper det att någon utanför '
             'familjen tar över en del av jobbet.'),
        ],
    },
    {
        'slug': 'hjalpa-barn-med-lasforstaelse',
        'grupp': 'hemma',
        'i_namn': 'i läsförståelse hemma',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Så hjälper du ditt barn med läsförståelsen | Nextrum',
        'beskrivning': (
            'Läs högt också för den som kan läsa själv, prata om texten och förklara orden. '
            'Råd för föräldrar, och vad ni gör när läsningen går trögt.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Hjälpa barnet med läsförståelsen',
        'kort': 'Högläsning, ord och skolans faktatexter',
        'h1': 'Hjälpa barnet med<br><em>läsförståelsen.</em>',
        'lede': (
            'Ett barn kan läsa varje ord rätt och ändå inte förstå vad det läst. Läsförståelse '
            'går att öva hemma, och det mesta handlar om att läsa tillsammans och prata om texten.'
        ),
        'bild': '07-genombrottet',
        'lista_etikett': 'Det ni kan göra hemma',
        'lista_rubrik': 'Före, under<br>och efter <em>läsningen.</em>',
        'lista_ingress': (
            'Det gäller både böcker och skolans faktatexter. Texterna i SO- och NO-böckerna är '
            'ofta tätare än de ser ut.'
        ),
        'lista': [
            ('Läs högt, också för den som kan själv',
             'Högläsning låter barnet möta texter som den egna läsningen inte når än: fler ord, '
             'längre meningar och svårare berättelser. Och det är en stund tillsammans som inte '
             'är en läxa.'),
            ('Titta på texten innan ni läser',
             'Rubrikerna, bilderna, de fetstilta orden och frågorna i slutet av kapitlet säger vad '
             'texten handlar om. Den som vet vad den letar efter förstår mer av det den läser.'),
            ('Stanna och prata',
             '"Vad har hänt hittills?" och "vad tror du händer nu?" håller tanken igång medan ni '
             'läser. Be barnet berätta med egna ord efteråt: då hörs vad som faktiskt gick fram.'),
            ('Förklara orden runt facktermerna',
             'Facktermerna brukar förklaras i texten. Det som tar stopp är oftare orden runt '
             'omkring: jämför, orsak, påverka, däremot. Förklara dem när de dyker upp, och använd '
             'dem själv vid middagen.'),
            ('Låt barnet välja',
             'Serier, fakta om fotboll eller samma bok för tredje gången. Man blir en bättre läsare '
             'av att läsa mycket, och det är lättare att läsa mycket när man får läsa det man '
             'tycker om.'),
            ('Ljudbok med boken framme',
             'Ljudböcker ger ord och berättelser, men de tränar inte själva läsningen. Lyssna gärna '
             'med boken uppslagen framför er, så får barnet båda.'),
        ],
        'vinkel_etikett': 'När läsningen går trögt',
        'vinkel_rubrik': 'Läsningen bär<br>alla <em>ämnen.</em>',
        'vinkel': [
            'Den som läser långsamt eller tappar tråden märker det inte bara i svenskan. Det syns i '
            'SO och NO, där texterna är långa och täta, och i matten, där en textuppgift kan vara '
            'svårare att läsa än att räkna. Ett barn som säger att det inte kan matte räknar '
            'ibland bra men fastnar i texten.',
            'Går läsningen trögt fast ni läser mycket hemma, prata med läraren eller skolans '
            'specialpedagog. De kan se efter vad det är som gör läsningen svår. Handlar det om att '
            'förstå snarare än om att läsa orden kan en studiehjälpare hos Nextrum läsa skolans '
            'egna texter tillsammans med eleven, och rapporten efter varje pass visar hur det går.',
        ],
        'faq_rubrik': 'Läsförståelse, det ni brukar undra',
        'faq': [
            ('Mitt barn läser orden rätt men förstår inte vad det läst. Vad gör vi?',
             'Läs kortare bitar och stanna oftare. Låt barnet berätta med egna ord vad som hänt '
             'innan ni läser vidare, och gå tillbaka i texten tillsammans när något saknas. Det '
             'övar det som faktiskt är svårt: att hålla ihop det man läst.'),
            ('Vi pratar ett annat språk hemma. Ska vi läsa på svenska?',
             'Läs gärna på ert eget språk också. Det barnet förstår och kan prata om på ett språk '
             'går att bygga vidare på i ett annat, och samtalet om texten är lika mycket värt. '
             'Svenskan övar barnet i skolan och i böckerna det läser själv.'),
            ('Hur vet vi om det är dyslexi?',
             'Det går inte att avgöra hemma. Går läsningen trögt trots övning, gissar barnet ofta '
             'på orden eller undviker allt som har med text att göra, prata med skolan. En '
             'specialpedagog kan kartlägga läsningen och se om den behöver utredas vidare.'),
            ('Hur mycket ska vi läsa?',
             'Hellre lite varje dag än mycket ibland, och hellre en bok barnet vill läsa än en som '
             'känns som ett straff.'),
        ],
    },
    {
        'slug': 'plugga-infor-prov',
        'grupp': 'hemma',
        'i_namn': 'inför prov',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Plugga inför prov: så hjälper du ditt barn | Nextrum',
        'beskrivning': (
            'Testa i stället för att läsa om, sprid ut pluggandet och börja med det svåra. '
            'Råd för föräldrar vars barn har ett prov på gång.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Plugga inför provet',
        'kort': 'Testa i stället för att läsa om',
        'h1': 'Plugga inför<br><em>provet.</em>',
        'lede': (
            'Att läsa igenom kapitlet en gång till känns som att plugga, men det är sällan det som '
            'gör skillnad på provet. Här är det som brukar göra det, och hur du hjälper till utan '
            'att kunna ämnet själv.'
        ),
        'bild': '17-no-naturvetenskap',
        'lista_etikett': 'Det som fungerar',
        'lista_rubrik': 'Från planen<br>till <em>provdagen.</em>',
        'lista_ingress': (
            'Inget av det kräver att du kan ämnet. Det mesta handlar om hur och när barnet '
            'pluggar, inte om hur länge.'
        ),
        'lista': [
            ('Ta reda på vad provet gäller',
             'Vilka kapitel, vilka begrepp och vilka sorters uppgifter? Läraren brukar säga det i '
             'klassen eller lägga ut det i skolans plattform. Utan svaret pluggar barnet det som '
             'känns bekant i stället för det som kommer.'),
            ('Testa i stället för att läsa om',
             'Med boken stängd: skriva ner allt man minns, svara på frågorna i slutet av kapitlet, '
             'räkna uppgifter utan att titta i facit. Att plocka fram något ur minnet gör att det '
             'sitter bättre än att läsa det en gång till.'),
            ('Sprid ut det',
             'Två timmar fördelade på fyra dagar gör mer än två timmar kvällen före. Det som hunnit '
             'glömmas lite och plockas fram igen sitter bättre än det som pluggats in i ett svep.'),
            ('Börja med det svåra',
             'Det är lätt att plugga det man redan kan, för det känns bra. Ta det svåra först, '
             'medan det finns tid att fråga läraren om det som inte lossnar.'),
            ('Låt barnet förklara för dig',
             'Be om en förklaring med egna ord: ett begrepp, en uträkning, varför något hände. Du '
             'behöver inte kunna svaret. Det hörs var förklaringen tar stopp, och där behövs '
             'pluggandet.'),
            ('Sov',
             'Den som stryker sömn för att plugga mer än vanligt har oftare svårt dagen efter, både '
             'att hänga med på lektionen och att klara provet. Den sista timmen är sällan värd '
             'natten.'),
        ],
        'kallor': [
            ('Umeå universitet: testbaserat lärande är effektivt för alla elever',
             'https://www.umu.se/nyheter/testbaserat-larande-effektivt_11846680/'),
            ('Dunlosky m.fl. 2013: tio studietekniker jämförda (engelska)',
             'https://pubmed.ncbi.nlm.nih.gov/26173288/'),
            ('SRCD: att stryka sömn för att plugga (engelska)',
             'https://www.srcd.org/news/sacrificing-sleep-study-can-lead-academic-problems'),
        ],
        'vinkel_etikett': 'Varför det känns fel',
        'vinkel_rubrik': 'Det som känns bra<br>är inte det som <em>fungerar.</em>',
        'vinkel': [
            'Att läsa om och stryka under känns effektivt, för texten blir mer bekant för varje '
            'gång. Men att känna igen något är inte samma sak som att kunna det, och på provet '
            'finns ingen text att känna igen. Att testa sig själv känns tvärtom trögt, för det '
            'visar det man inte kan än. Det är också det som gör det värt tiden: nu vet man var '
            'luckorna är.',
            'Inför ett prov kan studieplanen hos Nextrum byggas bakåt från provdagen, med det '
            'svåra först och tid att repetera på slutet. Studiehjälparen har nyligen läst samma '
            'kurs och minns var det brukade ta stopp, och rapporten efter varje pass visar hur '
            'långt ni har kommit.',
        ],
        'faq_rubrik': 'Plugga inför prov, det ni brukar undra',
        'faq': [
            ('Hur långt innan provet ska man börja?',
             'Gärna en till två veckor innan, med korta stunder några dagar i veckan. Då finns det '
             'tid att repetera, och det som inte lossnar hinner bli en fråga till läraren i stället '
             'för en överraskning på provet.'),
            ('Hjälper det att plugga hela kvällen innan?',
             'Lite, men mindre än samma tid utspridd över flera dagar, och det glöms fortare. Blir '
             'det sent är sömnen värd mer än den sista timmen.'),
            ('Barnet säger att det kan allt, men provet går ändå dåligt. Varför?',
             'Ofta för att det känns bekant, inte för att det sitter. Be barnet svara på några '
             'frågor utan boken eller räkna ett par uppgifter utan facit. Då syns skillnaden mellan '
             'att känna igen och att kunna, medan det fortfarande finns tid att göra något åt den.'),
            ('Hur hjälper jag till om jag inte kan ämnet?',
             'Förhör. Läs frågorna i slutet av kapitlet högt, eller gör frågor av rubrikerna, och '
             'låt barnet svara utan att titta. Svaren står i boken, så du behöver inte kunna dem.'),
        ],
    },
    {
        'slug': 'barnet-vill-inte-gora-laxorna',
        'grupp': 'hemma',
        'i_namn': 'när läxorna tar emot',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Barnet vill inte göra läxorna? Så minskar ni bråket | Nextrum',
        'beskrivning': (
            'Blir läxan ett gräl varje kväll? Rutiner som tar bort förhandlingen, varför '
            '"jag vill inte" ofta betyder "jag förstår inte", och när ni behöver hjälp.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'När barnet inte vill göra läxorna',
        'kort': 'Rutiner, motstånd och vad det kan betyda',
        'h1': 'När barnet inte vill<br>göra <em>läxorna.</em>',
        'lede': (
            'Läxan tar tio minuter, men det tar en timme att komma igång. Känns det igen är ni inte '
            'ensamma. Motståndet går oftast att minska, och ibland säger det något om vad som är '
            'svårt.'
        ),
        'bild': '32-laxor-pa-koksbordet',
        'lista_etikett': 'Det som brukar hjälpa',
        'lista_rubrik': 'Mindre förhandling,<br>mer <em>läxa.</em>',
        'lista_ingress': (
            'Mycket av bråket handlar om att komma igång, inte om själva läxan. Därför gör små '
            'ändringar i vardagen ofta mest.'
        ),
        'lista': [
            ('Samma tid, samma plats',
             'När läxan alltid görs efter mellanmålet vid köksbordet behöver ingen förhandla om '
             'när. Det är förhandlingen varje dag som tar kraft, för er båda.'),
            ('Bara den första uppgiften',
             'Det svåra är att börja. Be om en uppgift, eller tio minuter. När barnet väl är igång '
             'brukar resten gå lättare än det såg ut.'),
            ('Dela upp det stora',
             'En inlämning om tre veckor är svår att börja på, för den ser inte ut att ha någon '
             'början. Skriv upp stegen tillsammans och bocka av dem ett i taget.'),
            ('Telefonen i ett annat rum',
             'Inte upp och ner på bordet, utan någon annanstans. Det är lättare att låta bli något '
             'som inte finns inom räckhåll.'),
            ('Fråga vad som är svårt',
             '"Jag vill inte" betyder ofta "jag förstår inte", för det är lättare att säga. Fråga '
             'vad uppgiften går ut på, inte varför den inte är gjord.'),
            ('Berätta för läraren',
             'Tar läxan en timme när den var tänkt att ta en kvart, eller är den för svår vecka '
             'efter vecka, behöver läraren veta det. Skolan kan bara anpassa det den känner till.'),
        ],
        'vinkel_etikett': 'När det är något mer',
        'vinkel_rubrik': 'Samma ämne<br>varje <em>gång?</em>',
        'vinkel': [
            'Är det samma ämne som tar stopp varje gång handlar det sällan om lathet. Oftare finns '
            'det en lucka längre bak, ett steg som aldrig satt, och varje ny läxa bygger på det. Då '
            'blir läxan svår på ett sätt som inte syns utifrån, och att skjuta upp den blir ett '
            'sätt att slippa känna sig dålig.',
            'Att sitta längre hjälper sällan då. Det som hjälper är att hitta luckan. En '
            'studiehjälpare hos Nextrum har nyligen läst samma kurser, börjar med att ta reda på '
            'var det tar stopp och skriver studieplanen utifrån det. Efter varje pass kommer en '
            'rapport, så att ni ser vad som händer utan att läxan blir ert gräl.',
        ],
        'faq_rubrik': 'Läxbråk, det ni brukar undra',
        'faq': [
            ('Ska vi belöna att läxan blir gjord?',
             'Det kan hjälpa för att komma igång, men det blir lätt en förhandling i sig. En fast '
             'rutin och en läxa som går att klara håller längre. Beröm hellre det barnet gjorde, '
             'som att det började själv, än att det blev klart.'),
            ('Hur mycket ska jag hjälpa till?',
             'Var i närheten och svara på frågor, men låt barnet göra jobbet. Blir det du som gör '
             'uppgifterna ser läraren inte vad som är svårt, och då kan skolan inte hjälpa till '
             'med det.'),
            ('Hur länge ska läxan få ta?',
             'Fråga läraren hur lång tid den är tänkt att ta. Tar den mycket längre gång på gång är '
             'det bättre att sluta efter en rimlig stund och skriva några rader till läraren om var '
             'det tog stopp, än att sitta tills alla är slut.'),
            ('Barnet säger att det inte har några läxor. Hur vet vi?',
             'Fråga skolan var läxorna står. Många skolor lägger ut dem i en app eller på en '
             'lärplattform, och då går det att se själv i stället för att det blir ett förhör vid '
             'middagen.'),
        ],
    },
# ---- Under läsåret (2026-10-07): proven, betygen och terminsstarten ----
    {
        'slug': 'nationella-prov-ak-9',
        'grupp': 'aret',
        'i_namn': 'inför nationella proven i nian',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Nationella proven i åk 9: så förbereder ni er | Nextrum',
        'beskrivning': (
            'Vilka prov nian skriver, när på året de kommer, vad de betyder för betyget och hur '
            'ni förbereder er. Med länkar till provgruppernas egna övningar.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Nationella proven i nian',
        'kort': 'Vilka prov, när och hur ni förbereder er',
        'h1': 'Nationella proven<br>i <em>nian.</em>',
        'lede': (
            'I nian skriver eleverna nationella prov i svenska, engelska och matematik och i ett '
            'NO-ämne och ett SO-ämne, och läraren ska särskilt beakta resultatet när betyget '
            'sätts. Här är vad proven prövar, när de kommer och hur ni förbereder er utan att '
            'hela vårterminen handlar om dem.'
        ),
        'bild': '29-penna-och-block',
        'lista_etikett': 'Proven',
        'lista_rubrik': 'Fem prov,<br>två <em>terminer.</em>',
        'lista_ingress': (
            'De muntliga delarna görs på hösten och de skriftliga på våren. Datumen bestämmer '
            'Skolverket, och skolan säger vilka dagar som gäller för er.'
        ),
        'lista': [
            ('Svenska eller svenska som andraspråk',
             'Provet prövar att tala, läsa och skriva. Läsdelen har flera texter kring ett tema, '
             'och i skrivdelen skriver eleven en egen text utifrån ett tema.'),
            ('Engelska',
             'Tre delar: en muntlig, en där eleven läser och lyssnar, och en där eleven skriver.'),
            ('Matematik',
             'En muntlig del och skriftliga delar med och utan miniräknare: korta svar och '
             'uppgifter där eleven redovisar hur den löst dem, på nivåerna E, C och A.'),
            ('Ett NO-ämne',
             'Ett av ämnena biologi, fysik och kemi. Provet prövar begreppen, att förklara '
             'samband och att planera och värdera undersökningar.'),
            ('Ett SO-ämne',
             'Ett av ämnena geografi, historia, religionskunskap och samhällskunskap.'),
            ('Vad provet betyder för betyget',
             'Läraren ska särskilt beakta resultatet när betyget sätts. Det väger alltså tyngre '
             'än ett vanligt prov, men det sätter inte betyget ensamt: läraren väger in allt '
             'eleven visat i ämnet.'),
        ],
        'kallor': [
            ('Skolverket: provdatum för grundskolan',
             'https://www.skolverket.se/prov-och-bedomning/nationella-prov/provdatum/provdatum-for-grundskola-sameskola-specialskola'),
            ('Skolverket: nationella provets betydelse för betyget',
             'https://www.skolverket.se/prov-och-bedomning/nationella-prov/genomforande-och-anpassningar/nationella-provets-betydelse-for-betyget'),
            ('PRIM-gruppen: tidigare prov i matematik, åk 9',
             'https://www.su.se/enheter/prim-gruppen/nationella-prov/arskurs-9'),
            ('Göteborgs universitet: provet i engelska, åk 9',
             'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-7-9/nationella-prov-i-engelska-for-arskurs-9'),
            ('Uppsala universitet: provet i svenska, åk 9',
             'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/grundskolan/ak9/upplagg'),
            ('Umeå universitet: förberedelsematerial i NO, åk 9',
             'https://arkiv.edusci.umu.se/npno9/webbmaterial/F%C3%B6rberedelsematerial%20f%C3%B6r%20nationella%20prov%20i%20NO%C3%A4mnen%20%C3%A5k%209.pdf'),
        ],
        'vinkel_etikett': 'Att förbereda sig',
        'vinkel_rubrik': 'Börja med det som<br>redan är <em>svajigt.</em>',
        'vinkel': [
            'Proven prövar det eleven lärt sig under flera år, inte ett kapitel, och därför går '
            'de inte att plugga in veckan innan. Det som gör skillnad är att hitta luckorna i god '
            'tid och öva på det sätt proven frågar. Provgrupperna lägger ut gamla prov och '
            'exempeluppgifter gratis, och närmare provet än så kommer man inte: länkarna står '
            'ovanför.',
            'Inför proven kan studieplanen hos Nextrum byggas bakåt från provdagarna: först det '
            'som är svajigt, sedan uppgifter i provens stil och tid att repetera på slutet. Vi '
            'letar efter en studiehjälpare som själv skrivit proven nyligen och minns hur '
            'uppgifterna var formulerade. I NexLäx finns övningar i provens stil, skrivna av oss '
            'och inte kopierade ur proven, och rapporten efter varje pass visar hur långt ni har '
            'kommit.',
        ],
        'faq_rubrik': 'Nationella proven i nian, det ni brukar undra',
        'faq': [
            ('När skrivs proven?',
             'De muntliga delarna görs under hösten och de skriftliga under våren, från mars till '
             'maj. Skolverket bestämmer datumen för varje läsår, och skolan säger vilka dagar som '
             'gäller för er klass.'),
            ('Går det att plugga in ett nationellt prov?',
             'Inte på en vecka. Proven prövar sådant som byggts upp under flera år, som att läsa '
             'en text och resonera om den eller lösa ett problem i flera steg. Det som går är att '
             'öva på provens sorts uppgifter och ta itu med luckorna i god tid.'),
            ('Hur mycket betyder provet för slutbetyget?',
             'Läraren ska särskilt beakta resultatet, så det väger tyngre än ett vanligt prov. '
             'Men det sätter inte betyget ensamt, och ett prov som gick sämre än vanligt behöver '
             'inte avgöra det.'),
            ('När ska vi börja förbereda oss?',
             'Gärna redan på hösten i nian, när de muntliga delarna görs. Då finns det tid att '
             'hitta det som är svajigt före de skriftliga proven på våren, utan att allt hamnar i '
             'samma veckor.'),
        ],
    },
    {
        'slug': 'nationella-prov-ak-6',
        'grupp': 'aret',
        'i_namn': 'inför nationella proven i sexan',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Nationella proven i åk 6: så förbereder ni er | Nextrum',
        'beskrivning': (
            'Sexan skriver nationella prov i svenska, engelska och matematik samma år som de '
            'första betygen. Vad proven prövar och hur ni förbereder er.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Nationella proven i sexan',
        'kort': 'Svenska, engelska och matte, och de första betygen',
        'h1': 'Nationella proven<br>i <em>sexan.</em>',
        'lede': (
            'I sexan kommer de första betygen och de första nationella proven, i svenska, '
            'engelska och matematik. Proven finns för att betygen ska bli rättvisa, och det går '
            'att förbereda sig lugnt och i god tid.'
        ),
        'bild': '06-forklaringen',
        'lista_etikett': 'Proven',
        'lista_rubrik': 'Tre ämnen<br>och de första <em>betygen.</em>',
        'lista_ingress': (
            'De muntliga delarna görs på hösten och de skriftliga på våren. Datumen bestämmer '
            'Skolverket, och skolan säger vilka dagar som gäller för er.'
        ),
        'lista': [
            ('Svenska eller svenska som andraspråk',
             'Provet prövar tre saker: att tala, att läsa och förstå texter och att skriva.'),
            ('Engelska',
             'Provet prövar fyra förmågor: att tala, läsa, lyssna och skriva på engelska.'),
            ('Matematik',
             'En muntlig del och skriftliga delar med och utan miniräknare. Provet prövar tal, '
             'algebra, geometri, sannolikhet, statistik och problemlösning.'),
            ('Betygen börjar samtidigt',
             'Från hösten i sexan får eleven betyg i slutet av varje termin. Provresultatet ska '
             'läraren särskilt beakta, men betyget bygger på allt eleven visat i ämnet.'),
        ],
        'kallor': [
            ('Skolverket: provdatum för grundskolan',
             'https://www.skolverket.se/prov-och-bedomning/nationella-prov/provdatum/provdatum-for-grundskola-sameskola-specialskola'),
            ('Skolverket: nationella provets betydelse för betyget',
             'https://www.skolverket.se/prov-och-bedomning/nationella-prov/genomforande-och-anpassningar/nationella-provets-betydelse-for-betyget'),
            ('Skolverket: terminsbetyg',
             'https://www.skolverket.se/prov-och-bedomning/betyg/fran-bedomningar-till-betyg/terminsbetyg'),
            ('PRIM-gruppen: proven i matematik',
             'https://www.su.se/enheter/prim-gruppen/nationella-prov'),
            ('Göteborgs universitet: exempel på uppgifter i engelska, åk 6',
             'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-1-6/exempel-pa-uppgiftstyper-for-engelska-for-arskurs-6'),
        ],
        'vinkel_etikett': 'Att förbereda sig',
        'vinkel_rubrik': 'Lugnt, i god tid<br>och i <em>provets stil.</em>',
        'vinkel': [
            'Det mesta en sexa behöver inför proven är det vanliga skolarbetet, gjort ordentligt: '
            'läsa, skriva hela texter och räkna utan att gissa. Det som skiljer provet från en '
            'vanlig lektion är formen, med tidsgräns och uppgifter som ska lösas utan hjälp. '
            'Därför är provgruppernas exempeluppgifter bra att prova hemma några gånger, så att '
            'formen inte är ny på provdagen.',
            'Hos Nextrum kan studieplanen inför proven bygga på det läraren redan sett: det som '
            'är svajigt först, sedan uppgifter i provens stil. Vi letar efter en studiehjälpare '
            'som minns hur det var att skriva proven, och rapporten efter varje pass visar vad ni '
            'har gått igenom.',
        ],
        'faq_rubrik': 'Nationella proven i sexan, det ni brukar undra',
        'faq': [
            ('Är provresultatet betyget?',
             'Nej. Eleven får ett resultat på provet, men betyget i ämnet sätter läraren. '
             'Resultatet ska läraren särskilt beakta, tillsammans med allt annat eleven visat.'),
            ('Behöver en sexa plugga hemma inför proven?',
             'Lite, och helst utspritt. Korta stunder med exempeluppgifter några veckor innan '
             'räcker långt, och det viktigaste är att barnet känner igen formen. Mycket plugg den '
             'sista veckan ger mindre än samma tid utspridd.'),
            ('Mitt barn är nervöst inför proven. Vad gör jag?',
             'Berätta vad provet är till för: att lärarens bedömning ska bli rättvis, inte att '
             'pröva barnet som person. Gör gärna en exempeluppgift tillsammans hemma, med klockan '
             'på, så att provdagen känns som något man har gjort förut.'),
        ],
    },
    {
        'slug': 'laxhjalp-efter-sommarlovet',
        'grupp': 'aret',
        'i_namn': 'efter sommarlovet',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Kom igång efter sommarlovet: läxor och rutiner | Nextrum',
        'beskrivning': (
            'De första veckorna efter sommarlovet sätter rutinen för terminen. Så kommer ni igång '
            'med läxorna igen, och vad hösten har i sig.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Kom igång efter sommarlovet',
        'kort': 'Rutinen sätts de första veckorna',
        'h1': 'Kom igång efter<br><em>sommarlovet.</em>',
        'lede': (
            'Efter ett sommarlov utan läxor börjar ingen på samma ställe som i juni. Det gör '
            'inget, men de första veckorna sätter ofta tonen för resten av terminen. Här är hur '
            'ni kommer igång utan att läxan blir ett bråk.'
        ),
        'bild': '22-skolvag-hostlov',
        'lista_etikett': 'De första veckorna',
        'lista_rubrik': 'Rutinen först,<br>läxorna <em>sedan.</em>',
        'lista_ingress': (
            'Det mesta handlar om att hitta tillbaka till en vardag där läxan har en tid och en '
            'plats.'
        ),
        'lista': [
            ('Bestäm en tid och en plats',
             'Samma tid de flesta dagar och samma bord. När läxan har en självklar plats i veckan '
             'behöver ingen förhandla om den varje kväll.'),
            ('Börja smått',
             'Tjugo minuter de första dagarna är bättre än en timme som slutar i gråt. Öka när '
             'rutinen sitter.'),
            ('Ta reda på vad terminen har i sig',
             'Vilka ämnen är nya, när kommer de första proven, och sa läraren något i våras om '
             'vad som var svajigt? Det brukar stå i veckobrevet eller i skolans plattform.'),
            ('Repetera det som var svårt i våras',
             'Det som inte satt före sommaren sitter sällan bättre efter. Ta det tidigt, innan '
             'nya kapitel bygger vidare på det.'),
            ('Prata med läraren tidigt',
             'Utvecklingssamtalet kommer under läsåret, men det går att fråga mentorn redan nu om '
             'det finns något ni kan göra hemma. Ju tidigare, desto mer tid finns det.'),
            ('Börjar barnet sexan eller nian?',
             'Då kommer betyg i slutet av terminen, och de muntliga delarna av de nationella '
             'proven görs under hösten. Det är bra att veta i augusti, inte i november.'),
        ],
        'kallor': [
            ('Skolverket: terminsbetyg',
             'https://www.skolverket.se/prov-och-bedomning/betyg/fran-bedomningar-till-betyg/terminsbetyg'),
            ('Skolverket: utvecklingssamtal och IUP',
             'https://www.skolverket.se/styrning-och-ansvar/regler-och-ansvar/ansvar-i-skolfragor/utvecklingssamtal-och-skriftlig-individuell-utvecklingsplan-iup'),
            ('Skolverket: provdatum för grundskolan',
             'https://www.skolverket.se/prov-och-bedomning/nationella-prov/provdatum/provdatum-for-grundskola-sameskola-specialskola'),
        ],
        'vinkel_etikett': 'Varför i augusti',
        'vinkel_rubrik': 'Lättare att börja<br>än att <em>komma ikapp.</em>',
        'vinkel': [
            'Det är frestande att vänta och se hur terminen börjar. Men på det som var svajigt i '
            'våras bygger skolan vidare redan i september, och en lucka som får vänta till '
            'november är större då. Att börja tidigt kräver inte mycket: en tid i veckan, ett '
            'ämne och någon som ser till att det blir av.',
            'Hos Nextrum kan läxhjälpen börja med det som var svårt i våras, och studieplanen tar '
            'sedan terminen i den ordning skolan gör det. Det är samma studiehjälpare från vecka '
            'till vecka, och rapporten efter varje pass visar vad ni har gått igenom.',
        ],
        'faq_rubrik': 'Efter sommarlovet, det ni brukar undra',
        'faq': [
            ('När ska vi börja med läxhjälp på hösten?',
             'Gärna de första veckorna, innan något hunnit bli en lucka. Det går att börja när som '
             'helst, men det är lättare att hålla en rutin än att komma ikapp.'),
            ('Barnet verkar ha glömt mycket över sommaren. Är det ett problem?',
             'Det brukar ta lite tid att komma in i det igen. Repetera det som var svårt i våras i '
             'stället för att börja om från början, och fråga läraren om något behöver tas om.'),
            ('Kan vi börja med ett pass i veckan?',
             'Ja. Hur ofta ni bokar bestämmer ni själva, och det finns ingen bindningstid.'),
        ],
    },
    {
        'slug': 'infor-terminsbetyget',
        'grupp': 'aret',
        'i_namn': 'inför terminsbetyget',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Inför terminsbetyget: så använder ni veckorna kvar | Nextrum',
        'beskrivning': (
            'Från sexan sätts betyg i slutet av varje termin. Vad betyget bygger på, vad som går '
            'att göra de sista veckorna och vad som inte går.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Inför terminsbetyget',
        'kort': 'Vad som går att göra de sista veckorna',
        'h1': 'Inför<br><em>terminsbetyget.</em>',
        'lede': (
            'Från hösten i sexan sätts betyg i slutet av varje termin. Ett betyg går inte att '
            'plugga upp på en helg, men de sista veckorna är inte heller förlorade. Här är vad '
            'betyget bygger på och vad som faktiskt går att göra.'
        ),
        'bild': '28-skrivbord-ordning',
        'lista_etikett': 'Det som går att göra',
        'lista_rubrik': 'Fråga först,<br>plugga <em>sedan.</em>',
        'lista_ingress': (
            'Det viktigaste är att veta vad som saknas, och det vet läraren bättre än någon '
            'annan.'
        ),
        'lista': [
            ('Fråga läraren vad som saknas',
             'Inte "vilket betyg blir det" utan "vad behöver hen visa mer av". Svaret gör de '
             'sista veckorna konkreta: en uppgift att göra om, ett område att visa, ett moment som '
             'fattas.'),
            ('Lämna in det som saknas',
             'En inlämning som aldrig kom in går inte att bedöma. Börja med det som är försenat '
             'innan ni lägger tid på något nytt.'),
            ('Öva på det betyget bygger på',
             'Betyget sätts efter betygskriterierna i ämnet, och de står i kursplanen. Läraren kan '
             'visa vilka delar som är svagast.'),
            ('Var realistisk',
             'Det som inte satt på länge hinner sällan sätta sig på några veckor. Det som går är '
             'att visa det som nästan sitter, och att börja tidigare nästa termin.'),
            ('Prata om betyget efteråt',
             'Ett terminsbetyg är en lägesbild. Fram till nian kommer ett nytt varje termin, och '
             'det som saknas nu kan eleven visa nästa termin.'),
        ],
        'kallor': [
            ('Skolverket: terminsbetyg',
             'https://www.skolverket.se/prov-och-bedomning/betyg/fran-bedomningar-till-betyg/terminsbetyg'),
            ('Skolverket: hur lärare sätter betyg (lättläst)',
             'https://www.skolverket.se/lattlast/lattlast-information-fran-skolverket/hur-satter-larare-betyg-pa-lattlast-svenska'),
        ],
        'vinkel_etikett': 'Inget löfte om betyg',
        'vinkel_rubrik': 'Vi lovar inget betyg.<br>Vi lovar <em>passen.</em>',
        'vinkel': [
            'Ingen läxhjälp kan lova ett betyg, och den som gör det lovar något den inte styr '
            'över. Betyget sätter läraren, utifrån allt eleven visat. Det vi kan göra är att se '
            'till att veckorna som är kvar används till det läraren sagt saknas.',
            'Hos Nextrum kan studieplanen byggas på lärarens besked: det som saknas först, sedan '
            'det som nästan sitter. Rapporten efter varje pass visar vad ni har gått igenom, så '
            'att ni vet var ni står, och nästa termin kan börja där.',
        ],
        'faq_rubrik': 'Inför terminsbetyget, det ni brukar undra',
        'faq': [
            ('När sätts terminsbetyget?',
             'I slutet av varje termin, från hösten i sexan till hösten i nian. På våren i nian '
             'kommer slutbetyget i stället.'),
            ('Går det att höja ett betyg på några veckor?',
             'Ibland går det att visa något som saknats, till exempel en inlämning eller ett '
             'moment eleven inte hunnit med. Men betyget bygger på allt läraren vet om elevens '
             'kunskaper, och det som inte satt på länge hinner sällan sätta sig på några veckor.'),
            ('Vad gör vi om betyget blev lägre än väntat?',
             'Fråga läraren vad som saknades, och börja där nästa termin. Ett terminsbetyg är en '
             'lägesbild, och fram till slutbetyget i nian kommer ett nytt varje termin.'),
        ],
    },
# ---- Att välja läxhjälp (2026-10-07) ----
    {
        'slug': 'vad-kostar-laxhjalp',
        'grupp': 'valja',
        'i_namn': 'och vad den kostar',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Vad kostar läxhjälp? Timpris, avgifter och RUT | Nextrum',
        'beskrivning': (
            'Vad som gör läxhjälp dyr eller billig, vad ni ska fråga innan ni bokar, varför '
            'rutavdraget inte gäller och vad vi tar, rakt ut.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Vad kostar läxhjälp?',
        'kort': 'Det här styr priset, och vad vi tar',
        'h1': 'Vad kostar<br><em>läxhjälp?</em>',
        'lede': (
            'Timpriset säger mindre än det ser ut. Vem som håller passet, var det hålls och vilka '
            'avgifter som ligger runt omkring avgör vad en termin faktiskt kostar. Här är det som '
            'styr priset, frågorna att ställa och vårt pris, rakt ut.'
        ),
        'bild': '33-rutat-papper',
        'lista_etikett': 'Det som styr priset',
        'lista_rubrik': 'Mer än<br><em>timpriset.</em>',
        'lista_ingress': (
            'Två timpriser går inte att jämföra förrän ni vet vad som ingår i dem och vad som '
            'läggs på.'
        ),
        'lista': [
            ('Vem som håller passet',
             'En legitimerad lärare kostar mer än en student eller en ung studiehjälpare. Läraren '
             'har utbildningen, och den yngre har ofta läst samma kurs nyligen och minns var den '
             'tog stopp. Vad som är värt mest beror på vad barnet behöver.'),
            ('Hemma eller online',
             'Kommer någon hem till er kan resan ligga i priset, som en avgift eller som ett högre '
             'timpris. Online finns ingen resa att betala för.'),
            ('Avgifterna runt omkring',
             'Anmälningsavgift, startavgift, administrationsavgift. Räkna in dem i det första '
             'passets pris, så syns vad den första månaden faktiskt kostar.'),
            ('Bindningstid och minsta antal timmar',
             'Ett lågt timpris med krav på tjugo timmar är ett paket, inte ett timpris. Fråga vad '
             'det kostar att sluta efter två pass.'),
            ('Avbokning och tid som blir över',
             'Vad kostar ett pass ni avbokar dagen innan? Betalar ni för en hel timme om passet '
             'slutar efter fyrtio minuter, eller för den tid det höll?'),
            ('Rutavdraget',
             'Läxhjälp ger inte rätt till rutavdrag sedan 2015. Barnpassning kan ge det, men bara '
             'om läxhjälpen är en liten del av tiden. Den som lovar rutavdrag på läxhjälp bör '
             'kunna visa varför.'),
        ],
        'kallor': [
            ('Skatteverket: vilka arbeten som ger rutavdrag',
             'https://www.skatteverket.se/privat/fastigheterochbostad/rotochrutarbete/listaoverrutarbeten.106.5c1163881590be297b53de7.html'),
        ],
        'vinkel_etikett': 'Vårt pris',
        'vinkel_rubrik': f'{PRIS} i timmen,<br>rakt <em>ut.</em>',
        'vinkel': [
            f'Hos Nextrum kostar läxhjälp {PRIS} i timmen, samma pris i alla ämnen och var passet '
            f'än hålls, hemma hos er eller online. Sitter syskon med i samma pass tillkommer '
            f'{EXTRA_BARN} i timmen totalt, lika mycket för tre barn som för två. Det finns ingen '
            f'anmälningsavgift, ingen bindningstid och inget minsta antal timmar. Vill ni betala mindre '
            f'för varje timme kan ni välja en plan, en månad i taget, och med den första planen är '
            f'första timmen gratis.',
            'Ni betalar för den tid passet faktiskt höll, räknat per påbörjad kvart, och ser '
            'tiden i rapporten. Avbokar ni senast 12 timmar före kostar passet ingenting, och avbokar '
            'ni senare betalar ni hälften av det. Matchningen, studieplanen och rapporten efter '
            'varje pass ingår i timpriset. Hela prisbilden står på prissidan.',
        ],
        'faq_rubrik': 'Vad läxhjälp kostar, det ni brukar undra',
        'faq': [
            ('Gäller rutavdraget för läxhjälp?',
             'Nej, inte sedan 2015. Barnpassning kan fortfarande ge rutavdrag, men bara om '
             'läxhjälpen är en liten del av tiden. Skatteverkets lista över vad som ger '
             'rutavdrag är länkad ovanför.'),
            ('Varför är läxhjälp med en lärare dyrare?',
             'Läraren har en lång utbildning, och priset speglar den. Det kan vara värt det när '
             'barnet behöver någon som undervisar från grunden. För den som behöver komma igång '
             'med läxorna och få saker förklarade på sin egen nivå räcker ofta någon som nyss '
             'läst samma kurs.'),
            ('Vad kostar det för syskon hos er?',
             f'Sitter syskonen i samma pass kostar det {PRIS} i timmen plus {EXTRA_BARN} i timmen '
             f'totalt, alltså {FLERA_BARN} i timmen för två eller tre barn.'),
            ('Kostar det något att fråga?',
             'Nej. Intresseanmälan är gratis, och ni binder er inte till något förrän ni bokar '
             'ett pass.'),
        ],
    },
    {
        'slug': 'laxhjalp-eller-privatlarare',
        'grupp': 'valja',
        'i_namn': 'eller privatlärare',
        'plats': 'Stockholm',
        'og_typ': 'article',
        'titel': 'Läxhjälp eller privatlärare? Skillnaden förklarad | Nextrum',
        'beskrivning': (
            'Legitimerad lärare, student eller ung studiehjälpare: vad ni får för pengarna och '
            'när vilken passar bäst. En jämförelse där vi inte alltid vinner.'
        ),
        'etikett': 'Guide för föräldrar',
        'kort_titel': 'Läxhjälp eller privatlärare?',
        'kort': 'Vem som passar ert barn, och när',
        'h1': 'Läxhjälp eller<br><em>privatlärare?</em>',
        'lede': (
            'Orden används om varandra, men det är olika saker. En privatlärare undervisar, och '
            'en läxhjälpare hjälper eleven med det skolan redan tagit upp. Här är skillnaden, och '
            'när vilken passar bäst, också när svaret inte är vi.'
        ),
        'bild': '25-forsta-motet-med-foralder',
        'lista_etikett': 'Tre sorters hjälp',
        'lista_rubrik': 'Vem som<br>passar <em>när.</em>',
        'lista_ingress': (
            'Ingen av dem är bäst för alla. Det avgörs av vad barnet behöver, inte av vem som har '
            'längst utbildning.'
        ),
        'lista': [
            ('Legitimerad lärare',
             'Har en lärarutbildning och kan undervisa ett område från grunden, och en '
             'speciallärare kan dessutom arbeta med läs-, skriv- och räknesvårigheter. Passar när '
             'barnet behöver undervisning och inte bara hjälp. Kostar mest.'),
            ('Student eller ung studiehjälpare',
             'Har ofta läst samma kurser nyligen och minns var de tog stopp. Förklarar på elevens '
             'nivå och är nära i ålder, vilket kan göra det lättare att fråga det man tycker är '
             'pinsamt att inte kunna. Passar när barnet behöver förstå läxan, komma igång och få '
             'en rutin. Det är det Nextrum gör.'),
            ('Någon i familjen',
             'Gratis och nära till hands, och för mycket räcker det långt. Men den som sitter vid '
             'samma köksbord har sällan tid varje vecka, och läxan blir lätt ett bråk i stället '
             'för ett pass.'),
            ('Vad legitimationen betyder',
             'Legitimation krävs för att undervisa och sätta betyg i skolan. För läxhjälp utanför '
             'skolan finns inget sådant krav, varken för en privatlärare eller för en läxhjälpare. '
             'Fråga därför vad personen har gjort, inte bara vad den kallar sig.'),
            ('Det ni ska fråga, oavsett vem',
             'Håller samma person passen varje gång? Hur följs de upp? Vad händer om det inte '
             'fungerar mellan barnet och personen? Svaren säger mer än titeln.'),
        ],
        'kallor': [
            ('Skolverket: krav för att få undervisa',
             'https://www.skolverket.se/kompetensutveckling/legitimation/regler-och-krav-for-legitimation/krav-for-att-fa-undervisa'),
            ('Skolverket: extra anpassningar och särskilt stöd',
             'https://www.skolverket.se/styrning-och-ansvar/regler-och-ansvar/ansvar-i-skolfragor/extra-anpassningar-sarskilt-stod-och-atgardsprogram'),
        ],
        'vinkel_etikett': 'När vi inte är rätt val',
        'vinkel_rubrik': 'Ibland är svaret<br>en <em>lärare.</em>',
        'vinkel': [
            'Har barnet svårt att läsa, skriva eller räkna på ett sätt som inte går över, eller '
            'ligger det långt efter i ett ämne, behövs någon som kan undervisa och inte bara '
            'förklara läxan. Då är en speciallärare eller en legitimerad lärare ett bättre val än '
            'vi. Skolan ska också ge stöd när en elev riskerar att inte klara ett ämne, så börja '
            'med att prata med mentorn.',
            'Behöver barnet hjälp att förstå läxan, någon som förklarar på dess nivå och en '
            'rutin varje vecka, är det det vi gör. Vi letar efter en studiehjälpare som nyligen '
            'läst samma kurser, ni får en rapport efter varje pass, och det finns ingen '
            'bindningstid om det inte blir rätt.',
        ],
        'faq_rubrik': 'Läxhjälp eller privatlärare, det ni brukar undra',
        'faq': [
            ('Är era studiehjälpare lärare?',
             'Nej, och vi kallar dem inte det. De är intervjuade och utbildade av oss och har '
             'klarat vårt prov, men de har ingen lärarlegitimation. Det vi letar efter i '
             'matchningen är någon som nyligen läst samma kurser som eleven.'),
            ('Kan vi byta till en lärare senare?',
             'Ja. Det finns ingen bindningstid hos oss, och rapporterna ni fått efter varje pass '
             'är bra att visa en ny lärare.'),
            ('Vad kostar en privatlärare jämfört med er?',
             'Det varierar för mycket för att vi ska sätta en siffra på andras priser. Fråga '
             'efter timpriset och avgifterna runt omkring, och jämför med vårt på prissidan.'),
        ],
    },
]


# ============================================================
# BILDTEXTERNA
#
# alt-texten läses ur nextrum-images.js, per filnamn. Den stod förut
# en gång till här, och två av sju hade hunnit bli fel: Nacka
# beskrev "en ung studiehjälpare som går med sin väska" på en bild av
# tre elever som går tillsammans, och Södermalm satte två personer
# "mitt emot varandra" som sitter bredvid varandra. En alt-text som
# beskriver fel bild är sämre än ingen, för den som inte ser bilden
# kan inte upptäcka det.
# ============================================================

BILDER = os.path.join(ROT, 'nextrum-images.js')


def bildregistret():
    """alt, focal och tint per filnamn. Fokus och tonen stod förut per
    sida och hade glidit isär från registret (2026-10-26): samma foto
    fick olika platshållarfärg på två sidor."""
    s = open(BILDER, encoding='utf-8').read()
    ut = {}
    for m in re.finditer(r"file:\s*'([^']+)',(.*?)\n  \}", s, re.S):
        def falt(namn):
            f = re.search(namn + r":\s*'((?:[^'\\]|\\.)*)'", m.group(2))
            return f.group(1).replace("\\'", "'") if f else None
        ut[m.group(1)] = {'alt': falt('alt'), 'focal': falt('focal'), 'tint': falt('tint')}
    return ut


def satt_bildtexter(sidor):
    register = bildregistret()
    for o in sidor:
        bild = register.get(o['bild'])
        if not bild or not all(bild.values()):
            # Hellre inget bygge än en bild utan beskrivning.
            sys.exit(f'{o["bild"]} saknar alt, focal eller tint i {BILDER}')
        o['alt'] = bild['alt']
        o['focal'] = bild['focal']
        o['tint'] = bild['tint']


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

    Priset i Offer är timpriset, som på prissidan (#pris-schema).
    Paketens 379 kr stod här från 2026-10-14 till 2026-10-26 och sa
    emot både sidans text och prissidan.
    """
    fragor = ',\n'.join(
        '        {"@type":"Question","name":%s,'
        '"acceptedAnswer":{"@type":"Answer","text":%s}}' % (jstr(q), jstr(a))
        for q, a in o['faq'])

    omr =',\n'.join('          {"@type":"Place","name":%s}' % jstr(d)
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
        {{"@type":"Place","name":{jstr(plats(o))}}},
{omr}
      ],
      "availableChannel": [
        {{"@type":"ServiceChannel","name":"På plats","serviceLocation":{{"@type":"Place","name":{jstr(plats(o))}}}}},
        {{"@type":"ServiceChannel","name":"Online","serviceUrl":"https://nextrum.se/intresseanmalan"}}
      ],
      "offers": {{
        "@type": "Offer",
        "url": "https://nextrum.se/priser",
        "priceCurrency": "SEK",
        "price": "{PRIS_KR}",
        "availability": "https://schema.org/InStock",
        "priceSpecification": {{
          "@type": "UnitPriceSpecification",
          "priceCurrency": "SEK",
          "price": "{PRIS_KR}",
          "unitCode": "HUR",
          "referenceQuantity": {{"@type": "QuantitativeValue", "value": 1, "unitCode": "HUR"}}
        }}
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


def plats(o):
    """Var tjänsten hålls: stadsdelen för ett område, Stockholm för ett ämne."""
    return o.get('plats', o.get('namn'))


def rubriktext(h1):
    """Rubriken utan taggar, som delningsbilden skriver den
    (verktyg/bygg-delningsbilder.js, kolla-delningsbilder.py)."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', re.sub(r'<br\s*/?>', ' ', h1))).strip()


def head(o):
    # Delningsbilden, inte fotot (2026-10-07): sidans foto med rubriken
    # och priset ovanpå, byggd av verktyg/bygg-delningsbilder.js.
    bild = f"https://nextrum.se/delning/{o['slug']}.jpg"
    bild_alt = 'Nextrum: ' + rubriktext(o['h1'])
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
<meta name="theme-color" content="#F1EDE6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0C0B" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="geo.region" content="SE-AB">
<meta name="geo.placename" content="{esc(plats(o))}">

<!-- delning -->
<meta property="og:type" content="{o.get('og_typ', 'website')}">
<meta property="og:site_name" content="Nextrum">
<meta property="og:locale" content="sv_SE">
<meta property="og:title" content="{esc(o['titel'])}">
<meta property="og:description" content="{esc(o['beskrivning'])}">
<meta property="og:url" content="https://nextrum.se/{o['slug']}">
<meta property="og:image" content="{bild}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(bild_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(o['titel'])}">
<meta name="twitter:description" content="{esc(o['beskrivning'])}">
<meta name="twitter:image" content="{bild}">

<!-- Förladdad: utan den kommer typsnittet efter första ritningen, långa rubriker
     bryts om och allt under dem hoppar (CLS 0,2 på /laxhjalp-stockholm). -->
<link rel="preload" href="/typsnitt/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="nextrum-typsnitt.css">

<!-- ordningen spelar roll: bas → startsida → cinema -->
<link rel="stylesheet" href="nextrum.css">
<link rel="stylesheet" href="nextrum-home.css">
<link rel="stylesheet" href="nextrum-cinema.css">
<link rel="stylesheet" href="nextrum-landning.css">
</head>
<body>"""


# Rörelsen på landningssidorna (2026-10-28, Leo: "göra den lite roligare
# ... främst alla landings sidor"): GSAP med ScrollTrigger, vendorade i
# bibliotek/ (sidorna laddar inget från andra domäner), efter skalets
# skript, och nextrum-landning.js sist. Utan dem står sidan färdig.
LANDNING_SKRIPT = """
<script src="bibliotek/gsap-3.13.0.min.js"></script>
<script src="bibliotek/gsap-scrolltrigger-3.13.0.min.js"></script>
<script src="nextrum-landning.js"></script>"""

# Ämnessidans färg, ur ämnesfärgerna (--amne-*). Stadiesidorna och
# onlinesidan har inget ämne och står utan.
AMNESFARG = {
    'laxhjalp-matematik': 'ma', 'laxhjalp-svenska': 'sv', 'laxhjalp-engelska': 'en',
    'laxhjalp-no': 'no', 'laxhjalp-so': 'so', 'laxhjalp-moderna-sprak': 'ms',
}


def steg(rader, mer=''):
    """Så går det till som tre steg på en skena (2026-10-28). Stegen säger
    samma sak som stycket de ersatte."""
    li = '\n'.join(
        f'        <li><span class="lp-steg-nr" aria-hidden="true">{i:02d}</span><b>{esc(r)}</b><p>{esc(t)}</p></li>'
        for i, (r, t) in enumerate(rader, 1))
    mer = f'\n      <p class="lp-steg-mer">{mer}</p>' if mer else ''
    return f"""<div class="lp-steg" data-lp-steg>
        <span class="lp-steg-spar" aria-hidden="true"><span class="lp-steg-fyll"></span></span>
        <ol>
{li}
        </ol>
      </div>{mer}"""


def linje(o):
    """Platserna som en linjekarta (2026-10-28). En bild, ingen riktig
    linje i SL:s nät."""
    li = ''.join(f'<li><i aria-hidden="true"></i><span>{esc(d)}</span></li>' for d in o['delar'])
    return f"""<div class="lp-linje" data-lp-linje style="--n:{len(o['delar'])}">
      <span class="lp-linje-spar" aria-hidden="true"></span>
      <ol aria-label="Platser {esc(o['i_namn'])}">{li}</ol>
    </div>"""


def omrade(slug):
    for a in OMRADEN:
        if a['slug'] == slug:
            return a
    # Hellre inget bygge än en länk till en sida som inte finns.
    sys.exit(f'grannen {slug} finns inte i OMRADEN')


def andra_omraden(o):
    """Korslänkarna.

    De finns för läsaren som bor i grannområdet. Förut länkade varje
    sida till alla andra; med en sida per stadsdelsområde och kommun
    (2026-10-26) hade det blivit trettio kort, och trettiofyra efter
    sidrensningen 2026-10-27, så en sida länkar till sina grannar och
    till navet, och navet länkar till alla.
    """
    grannar = [omrade(g) for g in o.get('grannar', [])]
    alla = kort('laxhjalp-stockholm#orter', 'Läxhjälp i hela Stockholm',
                'Stadsdelar och kommuner, ort för ort')
    return kortsektion('Områden', 'Andra områden i närheten',
                       omradeskort(grannar) + '\n' + alla)


def delrad(delar):
    """Kortets rad: de fyra första delarna, och "med flera" bara när det
    finns fler. Skärholmen har fyra stadsdelar och inga fler."""
    if len(delar) > 4:
        return ', '.join(delar[:4]) + ' med flera'
    return ', '.join(delar[:-1]) + ' och ' + delar[-1] if len(delar) > 1 else delar[0]


def omradeskort(omraden):
    return '\n'.join(kort(a['slug'], 'Läxhjälp ' + a['i_namn'], delrad(a['delar']))
                     for a in omraden)


def regionkort():
    """Ett kort per region i navet. Ämnes- och stadiesidorna visar dem i
    stället för ett kort per ort."""
    return '\n'.join(kort(f'laxhjalp-stockholm#{rid}', rubrik, rad)
                     for rid, namn, rubrik, rad in REGIONER)


def svensk_ordning(namn):
    """Bokstavsordning med å, ä och ö sist, som i en svensk ordlista."""
    return namn.lower().replace('å', '{1').replace('ä', '{2').replace('ö', '{3')


def ortskatalog():
    """Navets katalog: alla orter, region för region (2026-10-26).

    Skrivs in i laxhjalp-stockholm.html mellan ORT_START och ORT_SLUT.
    Footern länkar till regionernas ankare, så ett ankare som byter
    namn här ska bytas i footern på alla sidor också."""
    delar = [f"""
<section class="sec wrap" id="orter">
  <div class="nx-head split" data-stig>
    <div><span class="nx-et acc">Orter</span>
      <h2 class="nx-d2" style="margin-top:18px">Välj er stadsdel<br>eller <em>kommun.</em></h2></div>
    <div class="nx-head-aside"><p class="nx-lede">Varje sida säger hur en studiehjälpare tar sig till er, vilka bibliotek som går att ses på och var vi matchar elever. Priset är detsamma överallt.</p></div>
  </div>
</section>"""]
    for rid, namn, rubrik, _ in REGIONER:
        orter = sorted((a for a in OMRADEN if a.get('region') == rid),
                       key=lambda a: svensk_ordning(a['namn']))
        delar.append(kortsektion(namn, rubrik, omradeskort(orter), id_=rid))
    return ''.join(delar)


def amneskort(amnen):
    return '\n'.join(kort(a['slug'], 'Läxhjälp ' + a['i_namn'], a['kort'])
                     for a in amnen)


def kort(slug, rubrik, rad):
    return f"""      <a class="nx-omr-kort" href="/{slug}">
        <b>{esc(rubrik)}</b>
        <span>{esc(rad)}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
      </a>"""


def kortsektion(etikett, rubrik, kort, id_=None):
    ankare = f' id="{id_}"' if id_ else ''
    return f"""
<section class="sec sec-kort wrap"{ankare}>
  <div class="rv">
    <span class="nx-et acc">{etikett}</span>
    <h2 class="nx-d2" style="margin-top:18px">{rubrik}</h2>
    <div class="nx-omr-rutnat" style="margin-top:clamp(24px,3vw,34px)">
{kort}
    </div>
  </div>
</section>
"""


def stadiekort(stadier):
    return '\n'.join(kort(a['slug'], 'Läxhjälp ' + a['i_namn'], a['kort'])
                     for a in stadier)


def stadier_sektion(o):
    """Stadiesidorna från ämnessidorna och från varandra."""
    andra = [a for a in STADIER if a['slug'] != o['slug']]
    rubrik = 'Andra stadier' if o in STADIER else 'Läxhjälp per stadium'
    return kortsektion('Stadier', rubrik, stadiekort(andra))


def amnen_sektion(o):
    """Ämnessidorna från en områdessida, och de andra ämnena från en
    ämnessida. Utan länkarna hittar Google ämnessidorna bara genom
    sitemap och navet."""
    andra = [a for a in AMNEN if a['slug'] != o['slug']]
    rubrik = 'Andra ämnen' if o in AMNEN else 'Läxhjälp per ämne'
    return kortsektion('Ämnen', rubrik, amneskort(andra))


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
    <h2 class="nx-d2" style="margin-top:18px">{esc(o.get('faq_rubrik') or 'Läxhjälp ' + o['i_namn'] + ' — det ni brukar undra')}</h2>
    <div class="faq" style="margin-top:clamp(24px,3vw,34px)">
{poster}
    </div>
    <p class="xsmall" style="margin-top:26px">
      Fler frågor och svar finns på <a href="/faq">FAQ-sidan</a>.
    </p>
  </div>
</section>
"""


# Intresseanmälan står i toppen, mitt på sidan och i Nästa steg
# (2026-10-09, Leo: "på alla landningssidor ska det finnas flera
# intresseanmälan knappar för läxhjälp"). Förut fanns den i innehållet
# bara längst ner, efter FAQ och korten, och i sidhuvudet.
PIL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'
ANMAL_KNAPP = f'<a class="btn btn-primary btn-lg" href="/intresseanmalan">Skicka intresseanmälan {PIL}</a>'
ANMAL_MITT = f"""
      <div class="nx-story-ctas" style="margin-top:clamp(22px,2.6vw,30px)">
        {ANMAL_KNAPP}
      </div>"""


def hjalte(o, tillbaka, sidtyp=None):
    # data-sidtyp läses av verktyg/bygg-delningsbilder.js: en områdessida
    # får "Hemma eller online" under rubriken i delningsbilden, inte
    # "Läxhjälp i Stockholm" under "Läxhjälp i Täby".
    typ = f' data-sidtyp="{sidtyp}"' if sidtyp else ''
    return f"""<section class="wrap nx-page-hero"{typ}>
  {tillbaka}
  <span class="nx-et acc" data-stig style="margin-top:22px">{esc(o['etikett'])}</span>
  <h1 class="nx-d1" data-avslöj>{o['h1']}</h1>
  <p class="nx-lede" data-stig data-fördröj="1">{esc(o['lede'])}</p>
  <div class="nx-story-ctas" data-stig data-fördröj="2">
    {ANMAL_KNAPP}
  </div>
  <figure class="nx-fig nx-page-hero-foto" data-parallax="-6" style="--tint:{o['tint']}">
    <picture><source type="image/webp" srcset="bilder/{o['bild']}-640.webp 640w, bilder/{o['bild']}-960.webp 960w, bilder/{o['bild']}-1280.webp 1280w, bilder/{o['bild']}-1600.webp 1600w, bilder/{o['bild']}-1920.webp 1920w" sizes="(max-width: 900px) 100vw, 92vw"><img class="nx-img" src="bilder/{o['bild']}-1280.jpg"
         srcset="bilder/{o['bild']}-640.jpg 640w, bilder/{o['bild']}-960.jpg 960w, bilder/{o['bild']}-1280.jpg 1280w, bilder/{o['bild']}-1600.jpg 1600w, bilder/{o['bild']}-1920.jpg 1920w"
         sizes="(max-width: 900px) 100vw, 92vw" width="2048" height="1152" fetchpriority="high" decoding="async"
         style="object-position:{o['focal']}" alt="{esc(o['alt'])}"></picture>
  </figure>
</section>"""


TILLBAKA_NAVET = '<a class="nx-back" href="/laxhjalp-stockholm"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Läxhjälp i Stockholm</a>'


def prissektion():
    return f"""<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Priset</span>
      <h2 class="nx-d2" style="margin-top:18px">{PRIS}<br>i timmen.</h2>
    </div>
    <div class="nx-text rv">
      <p>Samma timpris oavsett ämne och oavsett var i Stockholm passet hålls. Sitter syskon med i samma pass kostar det {EXTRA_BARN} extra i timmen totalt — lika mycket för tre barn som för två. Två eller tre barn en timme blir alltså {FLERA_BARN}.</p>
      <p>Ingen bindningstid och ingen månadsavgift. Studieplanen, matchningen och rapporten efter varje pass ingår i timpriset — det är inga tillval. All betalning går genom Nextrum, samlat på ett ställe.</p>
      <p>Köper ni en plan är första timmen gratis: den första planen får en timme till. <a href="/priser">Se hela prissidan</a> för vad som ingår och hur betalningen fungerar.</p>{ANMAL_MITT}
    </div>
  </div>
</section>"""


def prissektion_kort():
    """Områdessidornas pris. Samma sak som prissektion(), men kort: den
    stod ord för ord på alla tolv läxhjälpssidorna och var en stor del
    av det som gjorde stadsdelssidorna lika varandra."""
    return f"""<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Priset</span>
      <h2 class="nx-d2" style="margin-top:18px">{PRIS}<br>i timmen.</h2>
    </div>
    <div class="nx-text rv">
      <p>Samma timpris oavsett ämne och var passet hålls, och {EXTRA_BARN} extra i timmen totalt om syskon sitter med. Ingen bindningstid och ingen månadsavgift, och med en plan är första timmen gratis. <a href="/priser">Se hela prissidan</a>, eller läs <a href="/vad-kostar-laxhjalp">vad läxhjälp kostar och vad ni får för pengarna</a>.</p>{ANMAL_MITT}
    </div>
  </div>
</section>"""


def bibliotek_text(o):
    """Biblioteken i området, som neutral plats för ett pass.

    Namnen är kontrollerade mot bibliotekens egna sidor i sökträffarna
    2026-10-06 (Stockholms stadsbibliotek, Solna och Nacka), inte genom
    att öppna dem: nätet där de skrevs släppte inte fram sidorna. Ett
    bibliotek som flyttar eller stänger ska bort härifrån."""
    b = o.get('bibliotek') or []
    if not b:
        return ''
    lista = b[0] if len(b) == 1 else ', '.join(b[:-1]) + ' eller ' + b[-1]
    return (f'Vill ni hellre ses på en neutral plats går det bra att hålla passet på {lista}. '
            'Skriv platsen när ni föreslår tiden.')


NASTA_STEG = """<section class="nx-mork nx-final-cinema">
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
</section>"""


STEG_OMRADE = [
    ('Ni skickar en intresseanmälan', 'Ni berättar om eleven och var passen ska hållas. Det kostar ingenting att fråga.'),
    ('Vi hör av oss inom 24 timmar', 'Sedan väljer vi den studiehjälpare som passar eleven bäst.'),
    ('Studievyn låses upp', 'När matchningen är klar finns studieplanen, bokningen och en rapport efter varje pass där.'),
]
STEG_AMNE = [
    ('Ni skickar en intresseanmälan', 'Ni berättar vilket ämne och vilken kurs det gäller.'),
    ('Vi väljer studiehjälparen', 'Vi går igenom behovet med er och väljer den som passar bäst, utifrån ämne, nivå och person. Ni bläddrar inte bland profiler: fel match är värre än ingen match.'),
    ('Studievyn låses upp', 'Där ligger studieplanen, kommande pass, meddelanden och rapporten från varje tillfälle. Passen hålls hemma hos er eller online, och ni väljer för varje pass.'),
]


def sida(o):
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, o['slug'])

    tillbaka = ('<a class="nx-back" href="/"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Till startsidan</a>'
                if o.get('hub') else TILLBAKA_NAVET)

    bibl = bibliotek_text(o)
    bibl = f'\n      <p>{esc(bibl)}</p>' if bibl else ''

    return f"""{head(o)}{huvud}<main id="innehall">

{hjalte(o, tillbaka, 'omrade')}

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Var passen hålls</span>
      <h2 class="nx-d2" style="margin-top:18px">Hemma, på biblioteket<br>eller <em>online.</em></h2>
    </div>
    <div class="nx-text rv">
      <p>{esc(o['transport'])}</p>{bibl}
      <p>Ni väljer hemma eller online för varje pass. Att ses hemma förutsätter att matchningen ger en studiehjälpare som kan ta sig till er varje vecka; går det inte börjar ni online, med samma person, studieplan och rapport.</p>
    </div>
  </div>
</section>

<section class="sec wrap">
  <div class="rv">
    <span class="nx-et acc">Området</span>
    <h2 class="nx-d2" style="margin-top:18px">Var vi matchar elever</h2>
    {linje(o)}
  </div>
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Så går det till</span>
      <h2 class="nx-d2" style="margin-top:18px">En person,<br>inte en katalog.</h2>
    </div>
    <div class="nx-text rv">
      {steg(STEG_OMRADE, '<a href="/sa-fungerar-nextrum">Så fungerar det, steg för steg</a>.')}
    </div>
  </div>
</section>
{amnen_sektion(o)}
{prissektion_kort()}
{faq_sektion(o)}{andra_omraden(o)}
{NASTA_STEG}

</main>{fot}{LANDNING_SKRIPT}{jsonld(o, OMRADEN)}
</body>
</html>
"""


def amnessida(o):
    """En ämnessida.

    Kärnan är listan (vad passen går ut på) och vinkeln (varför en
    studiehjälpare som nyss läst kursen). Resten är samma löfte som på
    områdessidorna, och står där med flit i samma ordalag: det är
    samma tjänst.
    """
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, o['slug'])

    lista = '\n'.join(
        f'      <li><em>{i:02d}</em><div><b>{esc(r)}</b><p>{esc(t)}</p></div></li>'
        for i, (r, t) in enumerate(o['lista'], 1))
    vinkel = '\n'.join(f'      <p>{esc(p)}</p>' for p in o['vinkel'])
    # Ett kort per region i navet, inte ett per ort: orterna är
    # trettiofyra efter sidrensningen 2026-10-27.
    omrkort = regionkort()
    # Rubriken säger "eller online", så onlinesidan står bland områdena.
    if o is not ONLINE:
        omrkort += '\n' + kort(ONLINE['slug'], 'Läxhjälp online', ONLINE['kort'])

    amnesfarg = f' data-lp-amne="{AMNESFARG[o["slug"]]}"' if o['slug'] in AMNESFARG else ''
    return f"""{head(o)}{huvud}<main id="innehall"{amnesfarg}>

{hjalte(o, TILLBAKA_NAVET)}

<section class="sec wrap">
  <div class="nx-head split" data-stig>
    <div><span class="nx-et acc">{esc(o['lista_etikett'])}</span>
      <h2 class="nx-d2" style="margin-top:18px">{o['lista_rubrik']}</h2></div>
    <div class="nx-head-aside"><p class="nx-lede">{esc(o['lista_ingress'])}</p></div>
  </div>
  <ul class="nx-list rv">
{lista}
  </ul>
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">{esc(o['vinkel_etikett'])}</span>
      <h2 class="nx-d2" style="margin-top:18px">{o['vinkel_rubrik']}</h2>
    </div>
    <div class="nx-text rv">
{vinkel}
    </div>
  </div>
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">Så går det till</span>
      <h2 class="nx-d2" style="margin-top:18px">En person,<br>inte en katalog.</h2>
    </div>
    <div class="nx-text rv">
      {steg(STEG_AMNE)}
    </div>
  </div>
</section>

{prissektion()}
{faq_sektion(o)}{kortsektion('Områden', o.get('omraden_rubrik', 'Hemma hos er i Stockholm, eller online'), omrkort)}{amnen_sektion(o)}{stadier_sektion(o)}{kortsektion('Guider', 'För er som hjälper till hemma', guidekort(GUIDER))}
{NASTA_STEG}

</main>{fot}{LANDNING_SKRIPT}{jsonld(o, OMRADEN)}
</body>
</html>
"""


# Sajtens länkar i löptext syns knappt (färgen är nästan brödtextens).
# I en guide ÄR länkarna innehållet, så de stryks under som på
# startsidan.
UNDERSTRUKEN = 'color:inherit;text-decoration:underline;text-underline-offset:3px'


GUIDEGRUPPER = [
    ('hemma', 'För er som hjälper till hemma'),
    ('aret', 'Under läsåret'),
    ('valja', 'Att välja läxhjälp'),
]


def guidekort(guider):
    return '\n'.join(kort(g['slug'], g['kort_titel'], g['kort']) for g in guider)


def guidesektioner():
    """En kortsektion per grupp. Tio guider i ett enda rutnät gick inte
    att överblicka, och de svarar på tre olika frågor."""
    return ''.join(kortsektion('Guider', rubrik,
                               guidekort([g for g in GUIDER if g['grupp'] == grupp]))
                   for grupp, rubrik in GUIDEGRUPPER)


def kallor_rad(o):
    """Länkarna till organisationerna guiden nämner. Utan dem är
    guiden en uppräkning man inte kan kontrollera."""
    if not o.get('kallor'):
        return ''
    lankar = ' · '.join(f'<a href="{esc(u)}" rel="noopener" style="{UNDERSTRUKEN}">{esc(t)}</a>'
                        for t, u in o['kallor'])
    return f'\n  <p class="nx-note" style="margin-top:22px">Länkar: {lankar}</p>'


def jsonld_guide(o):
    """Article + FAQPage + BreadcrumbList. Författaren är Nextrum, inte
    en person: ingen av oss har skrivit under texten, och ett påhittat
    namn på en artikel är samma sak som ett påhittat omdöme."""
    fragor = ',\n'.join(
        '        {"@type":"Question","name":%s,'
        '"acceptedAnswer":{"@type":"Answer","text":%s}}' % (jstr(q), jstr(a))
        for q, a in o['faq'])
    return f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "Article",
      "@id": "https://nextrum.se/{o['slug']}#artikel",
      "headline": {jstr(o['kort_titel'])},
      "description": {jstr(o['beskrivning'])},
      "image": "https://nextrum.se/bilder/{o['bild']}-1280.jpg",
      "inLanguage": "sv",
      "author": {{ "@id": "https://nextrum.se/#org" }},
      "publisher": {{ "@id": "https://nextrum.se/#org" }},
      "mainEntityOfPage": "https://nextrum.se/{o['slug']}"
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
        {{"@type":"ListItem","position":2,"name":"Läxhjälp i Stockholm","item":"https://nextrum.se/laxhjalp-stockholm"}},
        {{"@type":"ListItem","position":3,"name":{jstr(o['kort_titel'])},"item":"https://nextrum.se/{o['slug']}"}}
      ]
    }}
  ]
}}
</script>"""


def guidesida(o):
    """En guide: samma delar som en ämnessida, utan 'så går det till'
    och utan priset. Priset stod bara i guiden om gratis läxhjälp, där
    det var själva frågan, och den guiden finns inte längre."""
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, o['slug'])

    lista = '\n'.join(
        f'      <li><em>{i:02d}</em><div><b>{esc(r)}</b><p>{esc(t)}</p></div></li>'
        for i, (r, t) in enumerate(o['lista'], 1))
    vinkel = '\n'.join(f'      <p>{esc(p)}</p>' for p in o['vinkel'])
    samma = [g for g in GUIDER if g['slug'] != o['slug'] and g['grupp'] == o['grupp']]
    ovriga = [g for g in GUIDER if g['grupp'] != o['grupp']]
    andra = (samma + ovriga)[:6]
    fler = kortsektion('Guider', 'Fler guider', guidekort(andra)) if andra else ''

    return f"""{head(o)}{huvud}<main id="innehall">

{hjalte(o, TILLBAKA_NAVET)}

<section class="sec wrap">
  <div class="nx-head split" data-stig>
    <div><span class="nx-et acc">{esc(o['lista_etikett'])}</span>
      <h2 class="nx-d2" style="margin-top:18px">{o['lista_rubrik']}</h2></div>
    <div class="nx-head-aside"><p class="nx-lede">{esc(o['lista_ingress'])}</p></div>
  </div>
  <ul class="nx-list rv">
{lista}
  </ul>{kallor_rad(o)}
</section>

<section class="sec wrap">
  <div class="nx-two">
    <div class="nx-two-sticky rv">
      <span class="nx-et acc">{esc(o['vinkel_etikett'])}</span>
      <h2 class="nx-d2" style="margin-top:18px">{o['vinkel_rubrik']}</h2>
    </div>
    <div class="nx-text rv">
{vinkel}
      <p>Det kostar ingenting att fråga och binder er inte till något.</p>{ANMAL_MITT}
    </div>
  </div>
</section>

{faq_sektion(o)}{amnen_sektion(o)}{fler}
{NASTA_STEG}

</main>{fot}{LANDNING_SKRIPT}{jsonld_guide(o)}
</body>
</html>
"""


# ============================================================
# NAVET
#
# laxhjalp-stockholm.html är handskriven, men ämneskorten i den
# skrivs härifrån, mellan två markörer. Annars hade en ny ämnessida
# varit osynlig från navet tills någon kom ihåg att lägga in den.
# ============================================================

# ============================================================
# 404 (2026-10-06)
#
# Vercel visar 404.html för varje adress som inte finns, också
# /en/nagot/annat. Därför <base href="/">: skalets länkar till css och
# skript är relativa, och utan base hade de pekat in i en mapp som inte
# finns. Sidan byggs här för att få samma skal som resten, och den är
# noindex utan canonical, så kartan tar inte med den.
# ============================================================

def sida404():
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, '404')
    vidare = '\n'.join(kort(slug, rubrik, rad) for slug, rubrik, rad in [
        ('laxhjalp-stockholm', 'Läxhjälp i Stockholm', 'Hemma hos er, på biblioteket eller online'),
        ('priser', 'Priser', f'{PRIS} i timmen, första timmen gratis med en plan'),
        ('sa-fungerar-nextrum', 'Så fungerar Nextrum', 'Från intresseanmälan till första passet'),
        ('intresseanmalan', 'Intresseanmälan', 'Berätta vad ni behöver hjälp med'),
        ('faq', 'Vanliga frågor', 'Svar om pris, betalning och trygghet'),
        ('bli-studiehjalpare', 'Bli studiehjälpare', 'Hjälp yngre elever och få betalt för det'),
    ])
    return f"""<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Visas på vilken adress som helst som inte finns; se sida404() i
     verktyg/bygg-omradessidor.py. Byggs därifrån, ändra inte för hand. -->
<base href="/">

{ikoner()}
<title>Sidan finns inte | Nextrum</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#F1EDE6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0C0B" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">

<link rel="stylesheet" href="nextrum-typsnitt.css">
<link rel="stylesheet" href="nextrum.css">
<link rel="stylesheet" href="nextrum-home.css">
<link rel="stylesheet" href="nextrum-cinema.css">
</head>
<body>{huvud}<main id="innehall">

<section class="wrap nx-page-hero">
  <a class="nx-back" href="/"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Till startsidan</a>
  <span class="nx-et acc" data-stig style="margin-top:22px">Sidan finns inte</span>
  <h1 class="nx-d1" data-avslöj>Den här sidan har<br>inte gjort <em>läxan.</em></h1>
  <p class="nx-lede" data-stig data-fördröj="1">Adressen finns inte, eller så har sidan flyttat. Kanske letar du efter något av det här.</p>
  <p class="xsmall" data-stig data-fördröj="2" style="margin-top:18px" lang="en">Looking for English? <a href="/en/">Go to the English site</a>.</p>
</section>
{kortsektion('Vidare', 'Vanliga vägar vidare', vidare)}

</main>{fot}
</body>
</html>
"""


NAV_START = '<!-- ämneskort: skrivs av verktyg/bygg-omradessidor.py, ändra inte för hand -->'
NAV_SLUT = '<!-- /ämneskort -->'
ORT_START = '<!-- orter: skrivs av verktyg/bygg-omradessidor.py, ändra inte för hand -->'
ORT_SLUT = '<!-- /orter -->'


def mellan(s, start, slut, block, p):
    if start not in s or slut not in s:
        sys.exit(f'hittar inte markörerna {start!r} i {p}')
    return s[:s.index(start) + len(start)] + block + s[s.index(slut):]


AFF_START = '/* orter: skrivs av verktyg/bygg-omradessidor.py, ändra inte för hand */'
AFF_SLUT = '/* /orter */'


def skriv_affischen():
    """Affischens ortslista (2026-10-27). Den stod för hand med de sex
    första orterna och "i" framför alla, så att det blev "Läxhjälp i
    Södermalm". Nu kommer den härifrån, med prepositionen ur i_namn och
    orterna region för region som i navet. Nyckeln är sluggen utan
    laxhjalp-, som förut, så att en tryckt affischs länk fortsätter gälla."""
    rader = []
    for rid, namn, _, _ in REGIONER:
        orter = sorted((a for a in OMRADEN if a.get('region') == rid),
                       key=lambda a: svensk_ordning(a['namn']))
        for a in orter:
            prep, _, plats = a['i_namn'].partition(' ')
            if prep not in ('i', 'på') or plats != a['namn']:
                sys.exit(f'{a["slug"]}: i_namn måste vara "i" eller "på" och namnet')
            for t in (a['namn'], namn):
                if "'" in t or '\\' in t:
                    sys.exit(f'{a["slug"]}: tecken som affischens lista inte tål')
            rader.append(f"    ['{a['slug'].removeprefix('laxhjalp-')}', '{a['namn']}', '{prep}', '{namn}']")
    p = os.path.join(ROT, 'nextrum-affisch.js')
    s = open(p, encoding='utf-8').read()
    block = '\n  var OMRADEN = [\n' + ',\n'.join(rader) + '\n  ];\n  '
    s = mellan(s, AFF_START, AFF_SLUT, block, p)
    open(p, 'w', encoding='utf-8').write(s)


def skriv_navet():
    p = os.path.join(ROT, 'laxhjalp-stockholm.html')
    s = open(p, encoding='utf-8').read()
    s = mellan(s, NAV_START, NAV_SLUT,
               kortsektion('Ämnen', 'Läxhjälp per ämne', amneskort(AMNEN))
               + kortsektion('Stadier', 'Läxhjälp per stadium', stadiekort(STADIER))
               + guidesektioner(), p)
    s = mellan(s, ORT_START, ORT_SLUT, ortskatalog() + '\n', p)
    open(p, 'w', encoding='utf-8').write(s)


def omradestitel(o):
    """En områdessidas titel (2026-10-26): ortnamnet först, sedan att
    passen hålls hemma eller online och priset, så långt det ryms.

    Den längsta som ryms på textbredd.TITEL_MAL px väljs. Förut stod
    titeln för hand på varje sida, och Hammarby Sjöstads var 13 px för
    lång: Google kortade bort "| Nextrum"."""
    for t in (f'Läxhjälp {o["i_namn"]}: hemma eller online, {PRIS_KR} kr/tim | Nextrum',
              f'Läxhjälp {o["i_namn"]}, hemma eller online | Nextrum',
              f'Läxhjälp {o["i_namn"]}, {PRIS_KR} kr/tim | Nextrum',
              f'Läxhjälp {o["i_namn"]} | Nextrum'):
        if textbredd.titel(t) <= textbredd.TITEL_MAL:
            return t
    sys.exit(f'ingen titel för {o["slug"]} ryms på {textbredd.TITEL_MAL} px')


def prova_bredden(sidor):
    """Titeln och beskrivningen ska synas hela i en sökträff. Det som går
    över kapar Google, och på läxhjälpssidorna var det priset som föll
    bort (granskningen 2026-10-26). verktyg/kolla-titlar.py säger samma
    sak i CI om alla sidor i kartan."""
    fel = []
    for o in sidor:
        t, b = textbredd.titel(o['titel']), textbredd.beskrivning(o['beskrivning'])
        if t > textbredd.TITEL_MAL:
            fel.append(f'{o["slug"]}: titeln är {t:.0f} px, högst {textbredd.TITEL_MAL}')
        if b > textbredd.BESKRIVNING_MAL:
            fel.append(f'{o["slug"]}: beskrivningen är {b:.0f} px, högst {textbredd.BESKRIVNING_MAL}')
    if fel:
        sys.exit('För långt för en sökträff:\n  ' + '\n  '.join(fel))


def prova_regionraderna():
    """En regionrad får bara nämna orter som har en sida i regionen, eller
    som är en del av en sådan ort. Haninge och Tyresö stod i raden innan
    de hade sidor (2026-10-26), och då lovar kortet något som inte finns."""
    for rid, _, _, rad in REGIONER:
        orter = [a for a in OMRADEN if a.get('region') == rid]
        kanda = {a['namn'] for a in orter} | {d for a in orter for d in a['delar']}
        flera = rad.endswith(' med flera')
        namn = rad[:-len(' med flera')] if flera else rad
        namn = [n.strip() for d in namn.split(' och ') for n in d.split(',')]
        okanda = [n for n in namn if n not in kanda]
        if okanda:
            sys.exit(f'regionen {rid} nämner {", ".join(okanda)}, som inte har någon sida där')
        if flera and len(orter) <= len(namn):
            sys.exit(f'regionen {rid} säger "med flera" men har inga fler orter')


def prova_navets_omraden():
    """Navets areaServed (handskriven i laxhjalp-stockholm.html) får bara
    nämna kommuner som har en ortssida, utöver Stockholms län. Efter
    sidrensningen 2026-10-27 stod Österåker, Vaxholm och Norrtälje kvar där
    och sa till Google att vi åker dit, fast sidorna var borttagna."""
    s = open(os.path.join(ROT, 'laxhjalp-stockholm.html'), encoding='utf-8').read()
    namn = re.findall(r'"@type": "AdministrativeArea", "name": "([^"]+)"', s)
    orter = {a['namn'] for a in OMRADEN if a.get('region')}
    okanda = [n for n in namn if n != 'Stockholms län' and n not in orter]
    if okanda:
        sys.exit('navets areaServed nämner ' + ', '.join(okanda) + ', som inte har någon ortssida')


def prova_fragorna():
    """Varje ort har ett eget par av de allmänna frågorna (2026-10-27).
    Spånga och Tensta, Sollentuna och Värmdö hade samma par och var de
    mest lika sidorna på sajten, för frågorna är den längsta text som
    står likadant på två sidor. Med elva frågor finns 55 par."""
    allmanna = {f[0] for f in (F_AMNEN, F_IGANG, F_PROV, F_PRIS, F_ONLINE, F_SYSKON,
                               F_KVALL, F_RAPPORT, F_SAMMA, F_BYTA, F_GYMNASIET)}
    sett = {}
    for o in OMRADEN:
        if o.get('handskriven'):
            continue
        par = frozenset(q for q, _ in o['faq'] if q in allmanna)
        if par in sett:
            sys.exit(f'{o["slug"]} har samma allmänna frågor som {sett[par]}: välj ett annat par')
        sett[par] = o['slug']


def main():
    if not os.path.exists(SKAL):
        sys.exit(f'hittar inte skalsidan {SKAL}')
    satt_bildtexter(OMRADEN + AMNEN + STADIER + GUIDER + [ONLINE])
    for o in OMRADEN:
        if not o.get('titel'):
            o['titel'] = omradestitel(o)
        for g in o.get('grannar', []):
            omrade(g)
        if not o.get('hub') and o.get('region') not in [r[0] for r in REGIONER]:
            sys.exit(f'{o["slug"]} har ingen region i REGIONER')
    prova_regionraderna()
    prova_fragorna()
    prova_navets_omraden()
    prova_bredden([o for o in OMRADEN if not o.get('handskriven')]
                  + AMNEN + STADIER + GUIDER + [ONLINE])
    delar = [a['namn'] for a in OMRADEN if not a.get('hub')]
    for o in AMNEN + STADIER + [ONLINE]:
        o['delar'] = delar
    for o in OMRADEN:
        if o.get('handskriven'):
            print(f'  hoppar över {o["slug"]}.html (handskriven)')
            continue
        p = os.path.join(ROT, o['slug'] + '.html')
        open(p, 'w', encoding='utf-8').write(sida(o))
        print(f'  skrev {o["slug"]}.html')
    for o in AMNEN:
        p = os.path.join(ROT, o['slug'] + '.html')
        open(p, 'w', encoding='utf-8').write(amnessida(o))
        print(f'  skrev {o["slug"]}.html')
    for o in STADIER:
        p = os.path.join(ROT, o['slug'] + '.html')
        open(p, 'w', encoding='utf-8').write(amnessida(o))
        print(f'  skrev {o["slug"]}.html')
    for o in GUIDER:
        p = os.path.join(ROT, o['slug'] + '.html')
        open(p, 'w', encoding='utf-8').write(guidesida(o))
        print(f'  skrev {o["slug"]}.html')
    p = os.path.join(ROT, ONLINE['slug'] + '.html')
    open(p, 'w', encoding='utf-8').write(amnessida(ONLINE))
    print(f'  skrev {ONLINE["slug"]}.html')
    open(os.path.join(ROT, '404.html'), 'w', encoding='utf-8').write(sida404())
    print('  skrev 404.html')
    skriv_navet()
    print('  skrev ämneskorten och ortskatalogen i laxhjalp-stockholm.html')
    skriv_affischen()
    print('  skrev ortslistan i nextrum-affisch.js')
    print(f'{len(OMRADEN)} områdessidor, {len(AMNEN)} ämnessidor, {len(STADIER)} stadiesidor, onlinesidan och {len(GUIDER)} guider byggda.')
    print('Kör sedan verktyg/bygg-sitemap.py och sist verktyg/satt-version.py.')


if __name__ == '__main__':
    main()
