# -*- coding: utf-8 -*-
"""Faktabladen för de nya områdena i svenska åk 8 och åk 9 (2026-10-27), ett per område i
verktyg/uppgiftsbanken/fortsattning_svenska_ak8_9.py. Skrivna efter vad nivåerna frågar, med egna
exempel som aldrig är bankens frågor."""
from fakta import blad

FAKTABLAD = [
    # ---------------------------------------------------------------- åk 8
    blad('Svenska', 'ak8', 'Berättartekniker',
         mal=['Känna igen en jag-berättare, en allvetande berättare och en berättare som följer en person.',
              'Se skillnad på att gestalta en känsla och att säga den rakt ut.',
              'Känna igen tillbakablick, framåtblick, in medias res, parallellhandling och ramberättelse.',
              'Skilja på handling, tema och budskap.'],
         fakta=['En jag-berättare är med i handlingen. En allvetande berättare står utanför och vet vad alla tänker. '
                'En berättare som följer en person vet bara vad den personen tänker.',
                'Att gestalta är att visa: ”Hon bet på naglarna” i stället för ”Hon var orolig”.',
                'Tiden kan brytas: en tillbakablick går bakåt, en framåtblick antyder vad som ska hända, och in medias '
                'res börjar mitt i en händelse.',
                'En parallellhandling följer två handlingar växelvis. En ramberättelse omger en annan berättelse.',
                'Temat är vad texten handlar om på djupet, som ensamhet. Budskapet är vad texten vill säga om temat, '
                'och det går att skriva som en mening.'],
         exempel=[('Vilken teknik används? ”Tio år senare skulle hon fortfarande minnas den här morgonen.”',
                   'Berättaren antyder något som händer långt senare. Det är en framåtblick.')],
         ord=[('perspektiv', 'genom vems ögon berättelsen visas'),
              ('gestalta', 'visa till exempel en känsla genom handlingar och detaljer'),
              ('tillbakablick', 'ett hopp bakåt i tiden'),
              ('parallellhandling', 'två handlingar som berättas växelvis'),
              ('tema', 'vad texten handlar om på djupet')],
         tips='Fråga dig: vems tankar får jag veta? Får du veta vad flera personer tänker är berättaren allvetande.'),

    blad('Svenska', 'ak8', 'Litterära genrer',
         mal=['Skilja på de tre huvudgenrerna epik, lyrik och dramatik.',
              'Använda ord som novell, roman, strof, rim, scenanvisning och monolog.',
              'Känna igen undergenrer som deckare, fantasy, science fiction, dystopi och fabel på deras drag.'],
         fakta=['Epik är berättande texter, som romaner och noveller. Lyrik är dikter. Dramatik är skrivet för att '
                'spelas upp, som pjäser.',
                'En dikt består av rader som kan bilda strofer. Den kan rimma, men fri vers har varken rim eller fast '
                'rytm, och det är också lyrik.',
                'I en pjäs talar personerna i repliker, och scenanvisningarna säger vad som händer på scenen. En '
                'komedi ska roa, och i en tragedi går det illa.',
                'Undergenrerna har typiska drag: ett brott i deckaren, magi i fantasy, teknik och framtid i science '
                'fiction och ett skrämmande samhälle i dystopin.'],
         exempel=[('Vilken genre? En hare och en sköldpadda tävlar, och den långsamma vinner för att den aldrig ger upp.',
                   'Djur som beter sig som människor och en lärdom på slutet: det är en fabel.')],
         ord=[('epik', 'berättande texter'),
              ('lyrik', 'dikter'),
              ('dramatik', 'texter som skrivs för att spelas upp'),
              ('strof', 'en grupp rader i en dikt'),
              ('scenanvisning', 'text i en pjäs som säger vad som händer på scenen'),
              ('dystopi', 'en berättelse om ett skrämmande samhälle, ofta i framtiden')],
         tips='Leta efter genrens drag och inte bara efter miljön: en deckare kan lika gärna utspela sig i rymden.'),

    blad('Svenska', 'ak8', 'Nyhetstext och referat',
         mal=['Känna igen rubrik, ingress, brödtext och bildtext i en nyhetsartikel.',
              'Förklara varför det viktigaste står först, och skilja en nyhet från en åsiktstext.',
              'Återge en text med egna ord, med referatmarkörer och källhänvisning.',
              'Skriva ett citat inom citattecken.'],
         fakta=['En nyhetsartikel har rubrik, ingress och brödtext. Ingressen sammanfattar det viktigaste.',
                'Nyhetspyramiden: det viktigaste först och detaljerna sist, så att den som slutar läsa tidigt ändå '
                'förstår nyheten.',
                'En nyhet ska vara saklig och svara på vad, vem, var, när, hur och varför. Åsikter står i ledare, '
                'krönikor och debattartiklar.',
                'I ett referat återger du det viktigaste med egna ord. Referatmarkörer som enligt, menar och skriver '
                'visar vems tankarna är.',
                'Ett citat är någons exakta ord inom citattecken. Ange källan, också när du refererar.'],
         exempel=[('Gör om till ett referat: Lärarna skriver: ”Vi behöver fler datorer.”',
                   'Lärarna skriver att de behöver fler datorer. Vi blir de, och citattecknen försvinner.')],
         ord=[('ingress', 'en kort sammanfattning direkt efter rubriken'),
              ('brödtext', 'artikelns huvudtext'),
              ('referat', 'en text återgiven med egna ord'),
              ('referatmarkör', 'ord som enligt eller menar, som visar vems tankarna är'),
              ('källhänvisning', 'uppgift om var informationen kommer ifrån'),
              ('plagiat', 'att ta någon annans text och låtsas att den är ens egen')],
         tips='Läs rubriken och ingressen först. Då vet du vad artikeln handlar om innan detaljerna kommer.'),

    # ---------------------------------------------------------------- åk 9
    blad('Svenska', 'ak9', 'Litteraturhistoria',
         mal=['Ordna litteraturens stora epoker från antiken till modernismen.',
              'Känna igen några kända verk och författare och vilken tid de hör till.',
              'Beskriva i stora drag vad som präglade varje epok.'],
         fakta=['Antiken: Iliaden och Odysséen, som tillskrivs Homeros, och den grekiska teaterns tragedier och '
                'komedier.',
                'Medeltiden: de lärda skrev på latin, sagorna och Eddan skrevs ner på Island, folkvisor spreds '
                'muntligt och Dante skrev Den gudomliga komedin.',
                'Renässansen betyder pånyttfödelse: antikens tankar fick nytt liv. Boktryckarkonsten spred böckerna, '
                'och Shakespeare och Cervantes skrev.',
                'Upplysningen satte förnuftet i centrum, romantiken känslan och naturen, och realismen vardagen och '
                'samhället, som i Strindbergs Röda rummet.',
                'Modernismen bröt mot traditionen på 1900-talet, till exempel med dikter på fri vers.'],
         exempel=[('Vilken epok passar bäst? En dikt hyllar en vild fors och en ensam vandrares längtan.',
                   'Naturen, känslan och längtan är typiska drag för romantiken.')],
         ord=[('epok', 'en tidsperiod vars litteratur har gemensamma drag'),
              ('epos', 'en lång berättande dikt om hjältar'),
              ('tragedi', 'en pjäs där det går illa för huvudpersonen'),
              ('renässans', 'pånyttfödelse'),
              ('fri vers', 'dikt utan rim och fast rytm')],
         tips='Lär dig ordningen först: antiken, medeltiden, renässansen, upplysningen, romantiken, realismen och '
              'modernismen.'),

    blad('Svenska', 'ak9', 'Språkriktighet',
         mal=['Välja rätt mellan ligga och lägga, sitta och sätta, sjunka och sänka, och att och och.',
              'Skriva genitiv utan apostrof.',
              'Böja adjektiv och particip efter ordet de hör till.',
              'Undvika dubbel supinum och välja rätt preposition efter vanliga ord.'],
         fakta=['Lägga, sätta och sänka gör man med något: lägga boken. Ligga, sitta och sjunka gör något självt: '
                'boken ligger.',
                'Ligga: låg, har legat. Lägga: lade eller la, har lagt. Sitta: satt, har suttit. Sätta: satte, har '
                'satt.',
                'Genitiv skrivs utan apostrof: Omars jacka, Sveriges kust.',
                'Adjektivet följer sitt ord: huset är stort, husen är stora, brödet är bakat.',
                'Efter till exempel hade velat eller skulle ha kunnat kommer infinitiv: hade velat gå, inte hade '
                'velat gått.'],
         exempel=[('Välj: ”Hon ___ sig på bänken.” (satte eller satt)',
                   'Hon satte sig, för att sätta sig är att placera sig. Efteråt satt hon där.')],
         ord=[('kongruens', 'att orden böjs så att de passar ihop'),
              ('supinum', 'verbformen efter har och hade: legat, lagt'),
              ('genitiv', 'formen som visar vem något tillhör: Omars, husets'),
              ('infinitiv', 'verbets grundform: gå, läsa')],
         tips='Prova att sätta ”något” efter verbet. Går det, som i ”lägga något”, är det lägga, sätta eller sänka.'),

    blad('Svenska', 'ak9', 'Tala inför publik',
         mal=['Planera ett tal med inledning, huvuddel och avslutning.',
              'Anpassa talet efter syfte och publik, och tala med stödord.',
              'Använda röst, tempo, pauser, ögonkontakt och kroppsspråk.',
              'Känna igen tretal, kontrast och anafor, och bemöta ett motargument.'],
         fakta=['Inledningen fångar intresset, huvuddelen ger innehållet och avslutningen sammanfattar eller '
                'uppmanar.',
                'Tänk på vem som lyssnar och varför du talar: för att informera, övertyga eller underhålla.',
                'Lyssnaren kan inte läsa om, så säg det viktigaste tydligt och gärna mer än en gång.',
                'Tretal är tre led i rad, kontrast ställer två saker mot varandra, och anafor upprepar samma ord '
                'först i flera meningar.',
                'Bemöt ett motargument genom att hålla med om det som stämmer och visa varför din åsikt ändå håller.'],
         exempel=[('Vilket grepp används? ”Förr cyklade vi till skolan. I dag blir vi skjutsade.”',
                   'Förr ställs mot i dag. Det är en kontrast.')],
         ord=[('stödord', 'några få ord som påminner dig om vad du ska säga'),
              ('röd tråd', 'att talets delar hänger ihop'),
              ('tretal', 'tre led i rad'),
              ('kontrast', 'två motsatser som ställs mot varandra'),
              ('anafor', 'samma ord först i flera meningar')],
         tips='Öva högt några gånger med klockan. Då hör du var du behöver en paus.'),
]
