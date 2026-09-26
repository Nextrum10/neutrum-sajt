#!/usr/bin/env python3
"""Bygger områdessidorna och ämnessidorna.

Sex stadsdelssidor (/laxhjalp-farsta …) och fyra ämnessidor
(/laxhjalp-matematik, -svenska, -engelska, -no). Navet,
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

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKAL = os.path.join(ROT, 'var-ide.html')

PRIS_KR = 379
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
             'Nej. Ingen bindningstid, ingen månadsavgift. Ni betalar varje pass med kort innan '
             f'det hålls, {PRIS} i timmen, och betalningen går till Nextrum.'),
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
# resten av sajten ger. Moderna språk, SO och programmering har ingen
# sida: hubben säger "fråga i anmälan så säger vi om vi har rätt
# person", och en egen sida hade lovat mer än så.
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
        'titel': 'Läxhjälp i matte i Stockholm, hemma eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i matte från mellanstadiet till gymnasiet, med en studiehjälpare som '
            f'nyss läst samma kurser. Hemma hos er i Stockholm eller online, {PRIS} i timmen.'
        ),
        'etikett': 'Läxhjälp i matematik',
        'h1': 'Läxhjälp i<br><em>matte.</em>',
        'lede': (
            'Matematik är vårt vanligaste ämne. Vi matchar eleven med en studiehjälpare som '
            'nyligen läst samma kurs och som minns vilket steg som var det svåra.'
        ),
        'kort': 'Bråk, ekvationer, funktioner och derivata',
        'bild': '01-en-till-en',
        'tint': '#ACA193',
        'focal': '68% 44%',
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
             'Ja, från den första kursen till derivata och integraler. Studiehjälparna går '
             'själva på gymnasiet eller högskolan och har läst kurserna nyligen. Skriv i '
             'anmälan vilken kurs eleven läser, så letar vi efter någon som har läst just den.'),
            ('Kan vi få hjälp inför ett nationellt prov i matte?',
             'Ja. Hör av er i god tid, gärna några veckor innan, så hinner vi matcha rätt '
             'person och studieplanen hinner gå igenom det som brukar komma.'),
            ('Räknar studiehjälparen uppgifterna åt eleven?',
             'Nej. Studiehjälparen förklarar, frågar och låter eleven räkna själv. Tanken är '
             'att eleven ska klara nästa uppgift också när ingen sitter bredvid.'),
            ('Vad kostar mattehjälpen?',
             f'{PRIS} i timmen, samma som alla andra ämnen. Ingen bindningstid och ingen '
             'månadsavgift. Ni betalar varje pass med kort innan det hålls.'),
        ],
    },
    {
        'slug': 'laxhjalp-svenska',
        'i_namn': 'i svenska',
        'plats': 'Stockholm',
        'titel': 'Läxhjälp i svenska i Stockholm, hemma eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i svenska och svenska som andraspråk: läsförståelse, uppsatser och '
            f'muntliga redovisningar. Hemma hos er i Stockholm eller online, {PRIS} i timmen.'
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
        'tint': '#898268',
        'focal': '38% 40%',
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
             'månadsavgift. Ni betalar varje pass med kort innan det hålls.'),
        ],
    },
    {
        'slug': 'laxhjalp-engelska',
        'i_namn': 'i engelska',
        'plats': 'Stockholm',
        'titel': 'Läxhjälp i engelska i Stockholm, hemma eller online | Nextrum',
        'beskrivning': (
            'Läxhjälp i engelska från mellanstadiet till gymnasiet: ordförråd, grammatik, '
            f'uppsatser och att våga prata. I Stockholm eller online, {PRIS} i timmen.'
        ),
        'etikett': 'Läxhjälp i engelska',
        'h1': 'Läxhjälp i<br><em>engelska.</em>',
        'lede': (
            'De flesta elever förstår mer engelska än de vågar använda. Vi matchar eleven med '
            'en studiehjälpare som nyligen läst samma kurs, och passen går ut på att använda '
            'språket, inte bara läsa om det.'
        ),
        'kort': 'Ordförråd, grammatik, uppsatser och muntligt',
        'bild': '04-sjalvfortroende',
        'tint': '#897D6A',
        'focal': '56% 36%',
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
             'månadsavgift. Ni betalar varje pass med kort innan det hålls.'),
        ],
    },
    {
        'slug': 'laxhjalp-no',
        'i_namn': 'i fysik, kemi och biologi',
        'plats': 'Stockholm',
        'titel': 'Läxhjälp i fysik, kemi och biologi i Stockholm | Nextrum',
        'beskrivning': (
            'Läxhjälp i NO med en studiehjälpare som nyss läst samma kurser: fysik, kemi och '
            f'biologi, formler och labbrapporter. I Stockholm eller online, {PRIS} i timmen.'
        ),
        'etikett': 'Läxhjälp i NO',
        'h1': 'Läxhjälp i fysik,<br>kemi och <em>biologi.</em>',
        'lede': (
            'I NO kommer begreppen tätt, och ett missat kapitel gör nästa svårt att förstå. Vi '
            'matchar eleven med en studiehjälpare som nyligen läst samma kurs, och som kan ta '
            'det i den ordning eleven behöver.'
        ),
        'kort': 'Formler, begrepp och labbrapporter',
        'bild': '13-kvallsplugg',
        'tint': '#453B28',
        'focal': '46% 44%',
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
             'Cellen, kroppen, ekologi, genetik och evolution. Biologin är mindre formler och '
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
             'månadsavgift. Ni betalar varje pass med kort innan det hålls.'),
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


def bildtexter():
    s = open(BILDER, encoding='utf-8').read()
    return {m.group(1): m.group(2).replace("\\'", "'") for m in re.finditer(
        r"file:\s*'([^']+)'[^}]*?alt:\s*'((?:[^'\\]|\\.)*)'", s, re.S)}


def satt_bildtexter(sidor):
    alt = bildtexter()
    for o in sidor:
        if o['bild'] not in alt:
            # Hellre inget bygge än en bild utan beskrivning.
            sys.exit(f'{o["bild"]} saknar alt i {BILDER}')
        o['alt'] = alt[o['bild']]


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
        {{"@type":"Place","name":{jstr(plats(o))}}},
{omr}
      ],
      "availableChannel": [
        {{"@type":"ServiceChannel","name":"På plats","serviceLocation":{{"@type":"Place","name":{jstr(plats(o))}}}}},
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


def plats(o):
    """Var tjänsten hålls: stadsdelen för ett område, Stockholm för ett ämne."""
    return o.get('plats', o.get('namn'))


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
<meta name="theme-color" content="#F2EDE3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C0C0B" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="geo.region" content="SE-AB">
<meta name="geo.placename" content="{esc(plats(o))}">

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

    rubrik = ('Läxhjälp i resten av Stockholm' if o.get('hub')
              else 'Andra områden')

    return kortsektion('Områden', rubrik, omradeskort(andra))


def omradeskort(omraden):
    return '\n'.join(kort(a['slug'], 'Läxhjälp ' + a['i_namn'],
                          ', '.join(a['delar'][:4]) + ' med flera')
                     for a in omraden)


def amneskort(amnen):
    return '\n'.join(kort(a['slug'], 'Läxhjälp ' + a['i_namn'], a['kort'])
                     for a in amnen)


def kort(slug, rubrik, rad):
    return f"""      <a class="nx-omr-kort" href="/{slug}">
        <b>{esc(rubrik)}</b>
        <span>{esc(rad)}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
      </a>"""


def kortsektion(etikett, rubrik, kort):
    return f"""
<section class="sec wrap">
  <div class="rv">
    <span class="nx-et acc">{etikett}</span>
    <h2 class="nx-d2" style="margin-top:18px">{rubrik}</h2>
    <div class="nx-omr-rutnat" style="margin-top:clamp(24px,3vw,34px)">
{kort}
    </div>
  </div>
</section>
"""


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


def hjalte(o, tillbaka):
    return f"""<section class="wrap nx-page-hero">
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
      <p><a href="/priser">Se hela prissidan</a> för vad som ingår och hur betalningen fungerar.</p>
    </div>
  </div>
</section>"""


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


def sida(o):
    huvud, fot = skal()
    huvud = sprakvaxlare(huvud, o['slug'])

    delar = ''.join(f'<span>{esc(d)}</span>' for d in o['delar'])
    tillbaka = ('<a class="nx-back" href="/"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Till startsidan</a>'
                if o.get('hub') else TILLBAKA_NAVET)

    return f"""{head(o)}{huvud}<main id="innehall">

{hjalte(o, tillbaka)}

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
{amnen_sektion(o)}
{prissektion()}
{faq_sektion(o)}{andra_omraden(o)}
{NASTA_STEG}

</main>{fot}{jsonld(o, OMRADEN)}
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
    omraden = [a for a in OMRADEN if not a.get('hub')]

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
      <p>Ni skickar in en intresseanmälan och berättar vilket ämne och vilken kurs det gäller. Vi går igenom behovet tillsammans med er och väljer sedan ut den studiehjälpare som passar bäst, utifrån ämne, nivå och person. Ni bläddrar inte bland profiler: fel match är värre än ingen match.</p>
      <p>När matchningen är klar låses studievyn upp. Där ligger studieplanen, kommande pass, meddelanden och rapporten från varje tillfälle. Passen hålls hemma hos er eller online, och ni väljer för varje pass.</p>
    </div>
  </div>
</section>

{prissektion()}
{faq_sektion(o)}{kortsektion('Områden', 'Hemma hos er i Stockholm, eller online', omradeskort(omraden))}{amnen_sektion(o)}
{NASTA_STEG}

</main>{fot}{jsonld(o, OMRADEN)}
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

NAV_START = '<!-- ämneskort: skrivs av verktyg/bygg-omradessidor.py, ändra inte för hand -->'
NAV_SLUT = '<!-- /ämneskort -->'


def skriv_navet():
    p = os.path.join(ROT, 'laxhjalp-stockholm.html')
    s = open(p, encoding='utf-8').read()
    if NAV_START not in s or NAV_SLUT not in s:
        sys.exit(f'hittar inte ämnesmarkörerna i {p}')
    fore = s[:s.index(NAV_START) + len(NAV_START)]
    efter = s[s.index(NAV_SLUT):]
    block = kortsektion('Ämnen', 'Läxhjälp per ämne', amneskort(AMNEN))
    open(p, 'w', encoding='utf-8').write(fore + block + efter)


def main():
    if not os.path.exists(SKAL):
        sys.exit(f'hittar inte skalsidan {SKAL}')
    satt_bildtexter(OMRADEN + AMNEN)
    delar = [a['namn'] for a in OMRADEN if not a.get('hub')]
    for o in AMNEN:
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
    skriv_navet()
    print('  skrev ämneskorten i laxhjalp-stockholm.html')
    print(f'{len(OMRADEN)} områdessidor och {len(AMNEN)} ämnessidor byggda.')
    print('Kör sedan verktyg/bygg-sitemap.py och sist verktyg/satt-version.py.')


if __name__ == '__main__':
    main()
