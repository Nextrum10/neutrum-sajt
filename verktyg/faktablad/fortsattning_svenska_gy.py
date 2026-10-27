# -*- coding: utf-8 -*-
"""Faktablad till de nya områdena i svenska på gymnasiet (2026-10-27).

Ett blad per område i verktyg/uppgiftsbanken/fortsattning_svenska_gy.py,
skrivna efter vad nivåerna övar. Exemplen är inga frågor ur banken.
Skrivet med AI och inte läst av en lärare.
"""
from fakta import blad

SV = 'Svenska'

FAKTABLAD = [
    # ---------------------------------------------------------------- gy1
    blad(SV, 'gy1', 'Nordiska grannspråk',
         mal=['Känna igen de skandinaviska språken och hur de hänger ihop med svenskan.',
              'Förklara skillnaden mellan norskans bokmål och nynorska.',
              'Förstå vanliga ord och korta meningar på norska och danska.',
              'Upptäcka falska vänner, ord som ser svenska ut men betyder något annat.'],
         fakta=['Danska, norska och svenska är nordgermanska språk och så lika att talarna ofta förstår varandra. '
                'Isländska och färöiska är också nordgermanska men ligger längre från svenskan.',
                'Finska och samiska talas i Norden men hör till en annan språkfamilj, den uraliska.',
                'Norskan har två skriftspråk: bokmål, som växte fram ur den danska skriften i Norge, och nynorska, '
                'som bygger på norska dialekter.',
                'Danska och norska skriver æ och ø där svenskan har ä och ö. Skriven danska är ofta lättare än '
                'talad, för uttalet ligger längre från svenskan än stavningen.',
                'En falsk vän liknar ett svenskt ord men betyder något annat. Rolig betyder till exempel lugn på '
                'danska och norska.'],
         exempel=[('Vad betyder den norska meningen ”Hun bor i et gult hus.”?',
                   'Hon bor i ett gult hus. Hun är hon och et är ett. Resten är nästan som på svenska.')],
         ord=[('grannspråk', 'ett närbesläktat språk i ett grannland, som danska och norska för svenskan'),
              ('bokmål', 'det vanligaste norska skriftspråket, med rötter i danskan'),
              ('nynorska', 'norskt skriftspråk som bygger på norska dialekter'),
              ('falsk vän', 'ett ord som liknar ett ord i ett annat språk men betyder något annat')],
         tips='Se upp med ord som ser bekanta ut: det är där grannspråken lurar dig.'),

    blad(SV, 'gy1', 'Muntlig framställning',
         mal=['Planera en presentation efter syfte, mottagare och situation.',
              'Bygga upp ett tal med inledning, huvuddel och avslutning.',
              'Känna igen retorikens arbetsgång från stoff till framförande.',
              'Analysera hur en talare fångar publiken och hjälper den att följa med.'],
         fakta=['Börja med tre frågor: varför talar jag, för vem och i vilken situation? Svaren styr ord, exempel '
                'och längd.',
                'Retorikens arbetsgång: inventio (samla stoff), dispositio (ordna), elocutio (formulera), memoria '
                '(öva in) och actio (framföra).',
                'En lyssnare kan inte läsa om. Säg vad du ska ta upp, använd signalord som för det första och till '
                'sist, och sammanfatta.',
                'Inledningen ska väcka intresse. Avslutningen kan knyta an till inledningen eller uppmana publiken '
                'att göra något.',
                'Stödord på en lapp hjälper dig att tala fritt och se på publiken i stället för att läsa innantill.'],
         exempel=[('Hur kan du börja en presentation om sömn för din klass?',
                   'Med en fråga, till exempel: ”Hur många timmar sov du i natt?” Den får lyssnarna att tänka på sig '
                   'själva och vilja höra mer.')],
         ord=[('disposition', 'planen över vad talet tar upp och i vilken ordning'),
              ('stödord', 'korta ord som påminner dig om vad du ska säga'),
              ('signalord', 'ord som visar var i talet du är, som för det första och till sist'),
              ('mottagare', 'de som lyssnar på eller läser det du säger')],
         tips='Öva högt och ta tid: att säga ett manus tar längre tid än att läsa det tyst.'),

    blad(SV, 'gy1', 'Meningsbyggnad',
         mal=['Välja mellan att och och i skrift.',
              'Böja adjektiv rätt och hålla samma tempus genom en text.',
              'Undvika dubbelsupinum, oklar syftning och meningar som saknar huvudsats.',
              'Skriva tydligt och visa vem som gör något.'],
         fakta=['Följer ett verb i infinitiv ska det vara att, inte och: Det är kul att dansa. Och binder ihop ord '
                'i samma form: Vi sjöng och dansade.',
                'Adjektivet böjs efter ordet det beskriver: Bilen är ny. Huset är nytt. Husen är nya.',
                'Efter ett hjälpverb i supinum står infinitiv: hade velat komma, inte hade velat kommit.',
                'Ett pronomen som han, hon eller den ska bara kunna syfta på ett ord. Vilket kan syfta på en hel '
                'sats.',
                'Klarspråk: skriv med verb i stället för tunga substantiv, och visa vem som gör något med aktiv '
                'form.'],
         exempel=[('Rätta meningen: ”Jag skulle ha velat sett filmen.”',
                   'Jag skulle ha velat se filmen. Efter velat, som är supinum, står infinitivet se.')],
         ord=[('kongruens', 'att ord böjs efter varandra, som adjektivet efter substantivet'),
              ('dubbelsupinum', 'två verb i supinum efter varandra, som hade kunnat kommit'),
              ('syftningsfel', 'när det är oklart vem eller vad ett pronomen syftar på'),
              ('klarspråk', 'ett vårdat, enkelt och begripligt språk'),
              ('passiv form', 'verbform där den som gör något inte behöver synas: Huset byggdes.')],
         tips='Läs texten högt: där du tvekar finns ofta en oklar syftning eller en för lång mening.'),

    # ---------------------------------------------------------------- gy2
    blad(SV, 'gy2', 'Antiken, medeltiden och renässansen',
         mal=['Känna igen drag i antikens epos och drama.',
              'Beskriva vad som präglade medeltidens litteratur.',
              'Förklara vad renässansen och humanismen var.',
              'Koppla några kända verk till sina författare och sin tid.'],
         fakta=['Antiken: Iliaden och Odysséen, som tillskrivs Homeros, är epos, långa berättande dikter om '
                'hjältar. Tragedi och komedi kommer från den grekiska teatern.',
                'I tragedin går hjälten under, ofta genom hybris, övermod. Aristoteles kallade publikens rening '
                'från medlidande och fruktan för katharsis.',
                'Medeltiden: kristen tro och kyrkan präglade mycket av litteraturen. På Island skrevs sagorna ner, '
                'berättelser på prosa om släkter och strider.',
                'Renässansen betyder pånyttfödelse: antikens konst och tankar togs upp igen, och humanismen satte '
                'människan i centrum. Boktryckarkonsten spred böckerna.',
                'Kända verk: Dantes Den gudomliga komedin, Shakespeares skådespel, Cervantes Don Quijote och '
                'Petrarcas sonetter, dikter med fjorton rader.'],
         exempel=[('Vad är Romeo och Julia för slags verk, och från vilken tid?',
                   'Ett skådespel, en tragedi av Shakespeare, från renässansen. Två unga från släkter som är fiender '
                   'blir kära, och det slutar med att båda dör.')],
         ord=[('epos', 'en lång berättande dikt om hjältar och stora händelser'),
              ('tragedi', 'ett drama där huvudpersonen går under'),
              ('hybris', 'övermod som leder till hjältens fall'),
              ('katharsis', 'rening: publikens utlopp för medlidande och fruktan'),
              ('humanism', 'renässansens intresse för människan och antikens texter'),
              ('sonett', 'en dikt med fjorton rader och fast rimschema')],
         tips='Lär dig perioderna som en tidslinje: antiken, medeltiden, renässansen och sedan upplysningen.'),

    blad(SV, 'gy2', 'Språkhistoria',
         mal=['Ordna svenskans perioder från runsvenska till nusvenska.',
              'Berätta vad som kännetecknar runorna och fornsvenskan.',
              'Förklara hur lågtyskan, bibeln och stavningsreformen har format svenskan.',
              'Läsa och dra slutsatser av en text om en runsten.'],
         fakta=['Perioderna i ordning: runsvenska, fornsvenska, äldre nysvenska, yngre nysvenska och nusvenska.',
                'Under vikingatiden skrev man med runor. Den yngre futharken hade bara 16 runor, så samma runa fick '
                'stå för flera ljud.',
                'Fornsvenskan hade fyra kasus. I dag finns genitivets s kvar hos substantiven, och pronomen som han '
                'och honom.',
                'Under medeltiden kom många lågtyska ord och ordled, som be- och -het. Gustav Vasas bibel på '
                '1500-talet blev en förebild för skriftspråket.',
                'Stavningsreformen 1906 tog bort hv och f för v-ljudet: hvad blev vad och haf blev hav.'],
         exempel=[('Varför har svenskan ord som ”frihet” med ett ordled från tyskan?',
                   'Under medeltiden handlade hansans tyska köpmän i svenska städer. Svenskan lånade då både ord och '
                   'ordled, som -het, från lågtyskan.')],
         ord=[('runsvenska', 'svenskan under vikingatiden, skriven med runor'),
              ('futhark', 'runraden, uppkallad efter sina sex första tecken'),
              ('kasus', 'böjning som visar ett ords roll i satsen, som subjekt eller objekt'),
              ('lågtyska', 'språket i norra Tyskland, som hansans köpmän talade'),
              ('stavningsreform', 'ett beslut om att ändra hur ord stavas')],
         tips='Koppla varje period till något som hände: runorna, landskapslagarna, bibeln och reformen 1906.'),

    blad(SV, 'gy2', 'Ordbildning och lånord',
         mal=['Skilja på sammansättning, avledning, kortord och initialord.',
              'Känna igen prefix, suffix och foge-s.',
              'Förklara hur lånord kommer in i svenskan och anpassas.',
              'Koppla lånord till de språk svenskan har lånat mest från.'],
         fakta=['Sammansättning: två ord blir ett, som fotboll + plan. Efterleden avgör ordklass och genus.',
                'Avledning: ett ordled läggs till. Prefix står först (o-, be-), suffix sist (-het, -skap, -bar). '
                'Leden i en sammansättning kan bindas ihop med ett foge-s.',
                'Kortord är förkortade ord, som bio av biograf. Initialord bildas av första bokstaven i flera ord.',
                'Lånorden har kommit i vågor: lågtyska under medeltiden, franska på 1600- och 1700-talet och '
                'engelska framför allt under 1900-talet.',
                'Ett översättningslån översätts led för led, som fotboll av football. Många lånord får svensk '
                'stavning, som jobb av job.'],
         exempel=[('Vilket genus får ordet ”glasskiosk”, och varför?',
                   'En glasskiosk, eftersom efterleden kiosk är ett en-ord. Det är efterleden som bestämmer genus.')],
         ord=[('prefix', 'ett ordled som står först i ett ord, som o- i ovanlig'),
              ('suffix', 'ett ordled som står sist i ett ord, som -het i frihet'),
              ('foge-s', 's:et som binder ihop leden i ord som fotbollsmatch'),
              ('kortord', 'ett ord som kortats, som bio av biograf'),
              ('översättningslån', 'ett ord som översatts led för led från ett annat språk'),
              ('purism', 'strävan att hålla ett språk fritt från lånord')],
         tips='Dela upp ett långt ord bakifrån: efterleden säger vad det är, och resten vad slags.'),

    # ---------------------------------------------------------------- gy3
    blad(SV, 'gy3', 'Retorisk analys',
         mal=['Beskriva den retoriska situationen och talets kairos.',
              'Känna igen stilfigurer som anafor, antites, trikolon och retorisk fråga.',
              'Använda den klassiska dispositionen och talets tre syften i en analys.',
              'Analysera hur ett tal försöker påverka och var det har svagheter.'],
         fakta=['Den retoriska situationen: vem talar, till vem, om vad, när och varför. Kairos är det rätta '
                'tillfället.',
                'Talets tre syften: docere (undervisa), delectare (behaga) och movere (beröra så att publiken '
                'handlar).',
                'Klassisk disposition: exordium (inledning), narratio (bakgrund), tes och argument, refutatio '
                '(bemöta motargument) och peroratio (avslutning).',
                'Stilfigurer: anafor (upprepning i början), epifor (i slutet), antites (motsatser), trikolon '
                '(tretal), hyperbol (överdrift) och ironi.',
                'En analys räknar inte bara upp greppen. Den visar hur de verkar på publiken och om talet når sitt '
                'syfte.'],
         exempel=[('Vilken stilfigur är ”Vi vill ha mindre prat och mer handling”?',
                   'En antites: motsatserna mindre och mer, prat och handling, ställs mot varandra.')],
         ord=[('retorisk situation', 'sammanhanget talet hålls i: talare, publik, ämne, tid och syfte'),
              ('kairos', 'det rätta tillfället att säga något'),
              ('anafor', 'samma ord upprepas i början av flera meningar'),
              ('antites', 'motsatser ställs mot varandra'),
              ('trikolon', 'ett tretal, tre led i rad'),
              ('refutatio', 'den del av talet där motargument bemöts')],
         tips='Fråga dig alltid varför talaren använder ett grepp just där, inte bara vad det heter.'),

    blad(SV, 'gy3', 'Litteraturvetenskapliga begrepp',
         mal=['Använda begrepp som in medias res, ramberättelse och opålitlig berättare.',
              'Skilja på allegori, symbol, parodi och pastisch.',
              'Känna igen olika litteraturvetenskapliga läsarter.',
              'Stödja en tolkning med exempel ur texten.'],
         fakta=['In medias res: berättelsen börjar mitt i handlingen. En ramberättelse rymmer andra berättelser. '
                'En opålitlig berättare ger en version som läsaren har skäl att tvivla på.',
                'Intertextualitet: texten anspelar på andra texter. En parodi härmar för att göra komiskt, en '
                'pastisch härmar en stil utan att håna.',
                'En symbol är en konkret sak som också står för något abstrakt. I en allegori står hela berättelsen '
                'för något annat.',
                'Läsarter: biografisk (författarens liv), genus (kön), postkolonial, marxistisk (klass), '
                'psykoanalytisk (det omedvetna) och närläsning (bara texten).',
                'Samma text kan tolkas på flera sätt, men en tolkning måste stödjas med exempel ur texten.'],
         exempel=[('En roman om djur som gör uppror på en gård kan läsas som en bild av en verklig revolution. '
                   'Vilket begrepp passar?',
                   'Allegori: berättelsen om djuren står för något annat, här politiska händelser och personer.')],
         ord=[('in medias res', 'berättelsen börjar mitt i handlingen'),
              ('opålitlig berättare', 'en berättare vars version läsaren har skäl att tvivla på'),
              ('intertextualitet', 'att en text samspelar med andra texter'),
              ('allegori', 'en berättelse där allt står för något annat'),
              ('närläsning', 'att granska texten noggrant, ord för ord'),
              ('kontext', 'sammanhanget: tiden och samhället där texten skrevs')],
         tips='Välj läsart efter texten: en roman om fattigdom öppnar för klass, en om könsroller för genus.'),

    blad(SV, 'gy3', 'Satslära',
         mal=['Hitta predikativ, agent och formellt och egentligt subjekt.',
              'Förklara att svenskan har det finita verbet på andra plats i huvudsatser.',
              'Hitta fundament och satsadverbial och skilja finita från infinita verbformer.',
              'Analysera en bisats som satsdel i en längre mening.'],
         fakta=['Predikativ säger något om subjektet eller objektet, ofta efter vara, bli och heta: Han är lärare. '
                'Filmen gjorde mig ledsen.',
                'I ”Det ligger en bok på bordet” är det formellt subjekt och en bok egentligt subjekt. I passiv form '
                'visar agenten vem som gör något: av grannen.',
                'I en huvudsats står det finita verbet på andra plats (V2). Det som står före kallas fundament: I '
                'kväll spelar vi match.',
                'Det finita verbet är tidsböjt (har, kom). Infinitiv (läsa) och supinum (läst) är infinita former.',
                'Satsadverbial som inte och kanske står efter det finita verbet i en huvudsats men före det i en '
                'bisats.'],
         exempel=[('Vilka satsdelar finns i ”I morse var vägarna hala”?',
                   'I morse är adverbial och står i fundamentet, var är predikat, vägarna är subjekt och hala är '
                   'predikativ, som säger något om vägarna.')],
         ord=[('predikativ', 'satsdel som beskriver subjektet eller objektet'),
              ('agent', 'den som utför handlingen i en passiv sats, ofta efter av'),
              ('formellt subjekt', 'det som fyller subjektets plats utan egen betydelse'),
              ('fundament', 'platsen före det finita verbet i en huvudsats'),
              ('satsadverbial', 'ord som säger något om hela satsen, som inte och kanske'),
              ('finit verb', 'verbet som är böjt i tempus eller är imperativ')],
         tips='Hitta det finita verbet först: allt annat i satsen går att ordna runt det.'),
]
