# -*- coding: utf-8 -*-
"""NP-träning i svenska (2026-10-06): nya områden i spåret ”Inför nationella
provet” i banorna för svenska åk 3, 6 och 9 och gymnasiet 1 och 3.

Allt står i TILLAGG och läggs sist i banor som redan finns (svenska.py,
svenska_mer.py, blad_svenska.py). Varje område har ”NP-träning” i namnet,
så att bygg-uppgifter.py lägger det i NP-spåret, där alla nivåer är öppna.
Det som redan fanns i NP-spåret (”NP-träning: skriva”, ”Läsa: NP-träning”
och ”NP-träning: argumentera och referera”) står kvar orört; det här är
det som saknades:

- åk 3: provet i årskurs 3 hade inget spår. ”Läsa: NP-träning” är en
  berättelse och en faktatext med frågor om det som står, vad som händer
  först och sist och varför. ”NP-träning: skriva och stava” är punkt,
  frågetecken, stor bokstav, ng och nk, dubbelteckning, sj-ljudet och
  enkla ordklasser, som provets bedömning av stavning och skiljetecken.
- åk 6: ”NP-träning: språket”: att och och, punkt mellan meningar, stor
  bokstav, stavning, ordklasser, synonymer och sambandsord.
- åk 9: ”NP-träning: källor och sammanfattning”: sammanfatta och återge
  med egna ord, citat och referat, källhänvisning och källkritik.
- gy1: ”NP-träning: utredande text”: provets skrivdel i nivå 1 prövar
  argumenterande och, i vid mening, utredande skrivande. Argumentationen
  fanns redan; här är syfte, frågeställning, disposition, saklig ton och
  källhänvisning.
- gy3: ”NP-träning: vetenskapligt skrivande”: syfte och frågeställning,
  analys mot sammanfattning, tolkning, belägg med citat, källförteckning
  och objektiv stil, inför provets utredande text.

Skrivet från grunden mot Lgr22:s centrala innehåll och ämnesplanen i
svenska. Lästexterna och alla exempel (Tilde, ekorren, Lina Berg,
”Skolans skog”, tidningen Skolbladet) är påhittade för banken; inget är
taget ur ett nationellt prov eller en lärobok. Ekorrtexten bygger bara på
fakta som inte ändras: den går inte i ide, gömmer mat, bygger bo av kvistar
och mossa och får tofsar på öronen på vintern.

Samma regler som i svenska.py och blad_svenska.py: rättningen struntar i
stora och små bokstäver och i punkt sist, så stor bokstav och skiljetecken
frågas som val eller ordna, aldrig som skriv. Ingen fråga upprepar en som
redan står i banken, och ingen bygger på frågan före.

Förenklat, med flit:
- Dubbelteckning frågas bara om enskilda ord. Regeln ”efter kort vokal
  kommer två konsonanter” har undantag (han, kom, vem), så den står aldrig
  som ett sant eller falskt.
- Ng-ljudet frågas som ng och nk. Gn (regn, vagn) står i åk 4.
- Sj-ljudet frågas med sj, sk före i och sch, inte alla stavningar.
- Källförteckningens ordning frågas bara för hänvisningar med efternamn
  och år. I ett system med nummer står källorna i den ordning de används.
- ”Utredande text” i gy1 är utredande i vid mening: förklarande och
  belysande, för en mottagare, som provgruppen beskriver skrivdelen.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SV = 'Svenska'


# --- Lästexterna i åk 3, ett stycke per element ----------------------

VANTEN = '\n\n'.join([
    'Den röda vanten',
    'Tilde hade fått nya vantar av mormor. Mormor hade stickat dem själv, och de var röda som lingon.',
    'En morgon gick Tilde till skolan genom parken. Det snöade, och hon hade bråttom. När hon kom '
    'fram till skolan hade hon bara en vante kvar.',
    'Hela dagen tänkte Tilde på vanten. På rasten letade hon i snön vid grinden, men där låg den inte.',
    'Efter skolan gick Tilde samma väg hem. Vid bänken i parken stannade hon. Där, på staketet, satt '
    'hennes röda vante! Någon hade hittat den och hängt upp den högt, så att den skulle synas.',
    'Tilde blev så glad att hon hoppade.',
    '– Tack, vem du än är! ropade hon.',
    'Dagen efter låg en blå mössa i snön vid busshållplatsen. Tilde visste hur det kändes att tappa '
    'något. Hon tog upp mössan och hängde den på staketet vid hållplatsen, högt upp, så att den skulle synas.',
])

EKORREN = '\n\n'.join([
    'Ekorren',
    'Ekorren är ett litet djur som bor i skogen. Den har oftast rödbrun päls och en lång, yvig svans. '
    'Svansen hjälper ekorren att hålla balansen när den hoppar från gren till gren.',
    'Ekorren äter fröna som sitter inne i kottar. Den äter också nötter, bär och svamp.',
    'På hösten samlar ekorren mat och gömmer den, till exempel i marken eller i hål i träden. Ekorren '
    'hittar inte allt som den har gömt. Därför kan det växa upp nya träd och buskar av frön och nötter '
    'som ekorren har glömt.',
    'Ekorren går inte i ide. Den är vaken hela vintern och äter av maten som den har gömt. När det är '
    'mycket kallt stannar den i sitt bo. Boet är runt och byggt av kvistar och mossa, högt uppe i ett träd.',
    'På vintern blir ekorrens päls tjockare. Då får den också långa tofsar på öronen.',
])

# Uppdraget: högst 1200 tecken per text, för en åttaåring.
assert len(VANTEN) <= 1200 and len(EKORREN) <= 1200


TILLAGG = [
    # ================================================================
    # ÅRSKURS 3: provet i årskurs 3 (nytt i NP-spåret)
    # ================================================================
    bana(SV, 'ak3', [
        niva('sv-ak3-np-lasa-1', 'Den röda vanten', 'Läsa: NP-träning', [
            val('Vem hade stickat vantarna?', ['mormor', 'mamma', 'morfar'], 'mormor',
                'Det står i början: mormor hade stickat dem själv.'),
            val('Hur var vädret när Tilde gick till skolan?', ['Det snöade', 'Solen sken', 'Det regnade'],
                'Det snöade', 'Det står: Det snöade, och hon hade bråttom.'),
            skriv('Hur många vantar hade Tilde kvar när hon kom fram till skolan? Svara med en siffra.',
                  [tal(1), 'en', 'ett'],
                  'Hon hade bara en vante kvar. Den hon saknade hade hon tappat på vägen.'),
            sant('Tilde hittade vanten vid grinden på rasten.', False,
                 'Hon letade vid grinden på rasten, men där låg den inte.'),
            val('Var hittade Tilde vanten till slut?',
                ['på staketet i parken', 'i snön vid skolans grind', 'på golvet i skolans kapprum'],
                'på staketet i parken', 'Vanten satt på staketet vid bänken i parken.'),
            val('Varför hade någon hängt upp vanten högt?',
                ['så att den skulle synas', 'så att den skulle torka', 'så att ingen skulle ta den'],
                'så att den skulle synas', 'Det står: någon hade hängt upp den högt, så att den skulle synas.'),
            val('Hur kände sig Tilde när hon såg vanten på staketet?', ['glad', 'arg', 'rädd'], 'glad',
                'Hon blev så glad att hon hoppade.'),
            ordna('Sätt händelserna i den ordning de händer i berättelsen.',
                  ['Tilde tappar en vante.', 'Tilde letar i snön på rasten.', 'Tilde hittar vanten på staketet.',
                   'Tilde hänger upp en mössa.'],
                  forklaring='Först tappar hon vanten, sedan letar hon och hittar den. Mössan hittar hon dagen efter.'),
            val('Vad händer sist i berättelsen?',
                ['Tilde hänger upp en blå mössa', 'Tilde hittar sin röda vante', 'Tilde letar vid skolans grind'],
                'Tilde hänger upp en blå mössa', 'Det sista som händer är dagen efter, när Tilde hittar mössan.'),
            val('Varför hängde Tilde upp mössan på staketet?',
                ['Hon visste hur det kändes att tappa något', 'Hon tyckte inte om färgen på den blå mössan',
                 'Hon trodde att mössan var hennes egen'],
                'Hon visste hur det kändes att tappa något',
                'Det står i sista stycket. Hon gör som den som hjälpte henne.'),
        ], beskrivning='Tränar inför läsdelen på provet i årskurs 3: en berättelse om en borttappad vante, '
                       'med frågor om vad som händer, i vilken ordning och varför.', text=VANTEN),

        niva('sv-ak3-np-lasa-2', 'Ekorren i skogen', 'Läsa: NP-träning', [
            val('Vad hjälper svansen ekorren med?', ['att hålla balansen', 'att gräva i marken', 'att knäcka nötter'],
                'att hålla balansen', 'Det står att svansen hjälper ekorren att hålla balansen när den hoppar.'),
            val('Var sitter fröna som ekorren äter, enligt texten?', ['i kottar', 'i blommor', 'i gräset'], 'i kottar',
                'Ekorren äter fröna som sitter inne i kottar.'),
            sant('Ekorren sover hela vintern.', False,
                 'Ekorren går inte i ide. Den är vaken hela vintern och äter av maten den har gömt.'),
            val('Vad gör ekorren på hösten?',
                ['Den samlar och gömmer mat', 'Den flyttar till ett varmare land', 'Den sover i ett hål i marken'],
                'Den samlar och gömmer mat', 'Det står: På hösten samlar ekorren mat och gömmer den.'),
            val('Varför kan det växa upp nya träd där ekorren har gömt mat?',
                ['Den hittar inte allt som den har gömt', 'Den planterar frön med flit varje vår',
                 'Den vattnar fröna när det inte regnar'],
                'Den hittar inte allt som den har gömt',
                'Frön och nötter som ekorren glömmer kan börja växa.'),
            ordna('Ordna det som ekorren gör, från hösten till vintern.',
                  ['Ekorren samlar mat.', 'Ekorren gömmer maten.', 'Ekorren äter maten den har gömt.'],
                  forklaring='Först samlar och gömmer den maten på hösten. På vintern äter den av det den gömt.'),
            val('Vad händer med ekorrens päls på vintern?',
                ['Den blir tjockare', 'Den blir vit som snö', 'Den blir kortare och tunnare'],
                'Den blir tjockare', 'Det står i sista stycket. En tjockare päls håller värmen bättre.'),
            skriv('Vad får ekorren på öronen på vintern? Skriv ordet ur texten.',
                  ['tofsar', 'långa tofsar', 'tofs', 'tofsarna'],
                  'Det står i sista meningen: långa tofsar på öronen.'),
            val('Var bygger ekorren sitt bo?',
                ['högt uppe i ett träd', 'nere i ett hål i marken', 'under en sten vid en bäck'],
                'högt uppe i ett träd', 'Boet är byggt av kvistar och mossa, högt uppe i ett träd.'),
            val('Hur vet du att texten är en faktatext?',
                ['Den berättar hur ekorren lever', 'Den har en hjälte som är med om ett äventyr',
                 'Den slutar med att någon blir glad'],
                'Den berättar hur ekorren lever',
                'En faktatext ger kunskap. Den här berättar om ekorrens mat, bo och vinter.'),
        ], beskrivning='Tränar inför läsdelen på provet i årskurs 3: en faktatext om ekorren, med frågor om '
                       'det som står och om varför saker händer.', text=EKORREN),

        niva('sv-ak3-np-skriva-stava-1', 'Rätta meningarna', 'NP-träning: skriva och stava', [
            val('Det fattas en punkt i ”Vi gick till skogen vi hittade svamp.” Efter vilket ord ska punkten stå?',
                ['skogen', 'gick', 'hittade'], 'skogen',
                'Vi gick till skogen är en hel mening. Sedan börjar en ny mening: Vi hittade svamp.'),
            val('Vilken mening ska sluta med frågetecken?',
                ['Kan du hjälpa mig', 'Jag kan hjälpa dig', 'Hjälp mig med läxan'], 'Kan du hjälpa mig',
                'Den som frågar vill ha ett svar. Kan du hjälpa mig är en fråga.'),
            val('Vilka ord ska ha stor bokstav? ”min kompis heter leo och bor i lund.”',
                ['min, leo och lund', 'bara leo och lund', 'min, kompis och leo'], 'min, leo och lund',
                'Min står först i meningen. Leo är ett namn, och Lund är namnet på en stad.'),
            val('Varför ska ”Lund” skrivas med stor bokstav?',
                ['Det är namnet på en stad', 'Det står först i meningen', 'Det är ett kort ord'],
                'Det är namnet på en stad',
                'Namn på personer, städer och länder har stor bokstav, var de än står i meningen.'),
            sant('”Hur mår du” ska sluta med frågetecken.', True,
                 'Hur mår du är en fråga. Efter en fråga sätter man frågetecken: Hur mår du?'),
            ordna('Bygg meningen om Elsa. En bricka hör inte dit.', ['Elsa', 'bor', 'i', 'Göteborg.'],
                  extra=['göteborg.'],
                  forklaring='Göteborg är namnet på en stad och har stor bokstav. Punkten står sist.'),
            ordna('Bygg frågan till mormor. En bricka hör inte dit.', ['Vill', 'du', 'spela', 'kort?'],
                  extra=['kort.'],
                  forklaring='Du frågar mormor något. Därför slutar meningen med frågetecken.'),
            para('Para ihop ordet ur meningen ”Pojken åt en röd glass.” med ordklassen.',
                 [('Pojken', 'substantiv'), ('åt', 'verb'), ('röd', 'adjektiv')],
                 'Pojken är en person, åt är något man gör och röd beskriver hur glassen är.'),
            val('Vilket ord är ett verb i ”Lisa ritar hästen.”?', ['ritar', 'Lisa', 'hästen'], 'ritar',
                'Ritar är det Lisa gör. Ord som säger vad någon gör är verb.'),
            val('Du har skrivit klart din berättelse. Vad gör du sist?',
                ['Läser igenom och rättar', 'Suddar ut alla punkter', 'Skriver rubriken en gång till'],
                'Läser igenom och rättar',
                'När du läser igenom hittar du ord som är felstavade och punkter som fattas.'),
        ], beskrivning='Tränar skrivreglerna inför provet i årskurs 3: punkt, frågetecken och stor bokstav, '
                       'och några enkla ordklasser.'),

        niva('sv-ak3-np-skriva-stava-2', 'Stava rätt', 'NP-träning: skriva och stava', [
            val('Vilket ord är rätt stavat? ”Jag sover i min …”', ['säng', 'sän', 'sängk'], 'säng',
                'Ng-ljudet skrivs oftast ng, som i säng, lång och kung.'),
            val('Vilket ord är rätt stavat? ”En … simmar i dammen.”', ['anka', 'angka', 'annka'], 'anka',
                'Före k skrivs ng-ljudet bara med n. Därför stavas anka med nk.'),
            sant('Ordet ”bank” stavas utan g.', True,
                 'Före k skrivs ng-ljudet bara med n: bank, anka och blinka.'),
            ordna('Bygg ordet ”blinka”. En bokstav hör inte dit.', ['b', 'l', 'i', 'n', 'k', 'a'], extra=['g'],
                  forklaring='I blinka kommer k efter ng-ljudet. Då skrivs det bara n, så g hör inte dit.'),
            val('Vilket ord passar? ”Hinken är … av vatten.”', ['full', 'ful'], 'full',
                'U är kort i full, och då skriver man två l. Ful, med långt u, betyder inte snygg.'),
            val('Vilket ord passar? ”Katten fick … i sin skål.”', ['mat', 'matt'], 'mat',
                'A är långt i mat, och då räcker det med ett t. Matt betyder trött och kraftlös.'),
            skriv('Ett ord är felstavat: ”Vi ska sima i sjön.” Skriv ordet rätt.', 'simma',
                  'I är kort i simma. Därför skriver man två m.'),
            val('Vilket ord är rätt stavat? ”På vintern åker vi …”', ['skidor', 'sjidor', 'schidor'], 'skidor',
                'Före i låter sk som sj-ljudet. Därför stavas skidor med sk.'),
            para('Para ihop ordet med bokstäverna som gör sj-ljudet.',
                 [('sju', 'sj'), ('skida', 'sk'), ('dusch', 'sch')],
                 'Sj-ljudet kan stavas på flera sätt. Orden får man lära sig ett och ett.'),
            val('Vilket ord är rätt stavat? ”Lisa är … och stannar hemma.”', ['sjuk', 'schuk', 'skjuk'], 'sjuk',
                'Sjuk stavas med sj, precis som sju och själv.'),
        ], beskrivning='Tränar stavningen inför provet i årskurs 3: ng och nk, dubbla bokstäver efter kort vokal '
                       'och sj-ljudet.'),
    ]),

    # ================================================================
    # ÅRSKURS 6
    # ================================================================
    bana(SV, 'ak6', [
        niva('sv-ak6-np-spraket-1', 'Rätta texten', 'NP-träning: språket', [
            val('Vilket ord ska stå i luckan? ”Det är roligt … spela fotboll.”', ['att', 'och', 'å'], 'att',
                'Före ett verb i grundform, som spela, står att. Att och och kan låta som å, men de skrivs olika.'),
            val('Vilket ord ska stå i luckan? ”Vi köpte bröd … mjölk.”', ['och', 'att', 'å'], 'och',
                'Och binder ihop två saker, bröd och mjölk. Att står före ett verb, som i att köpa.'),
            sant('I meningen ”Jag gick ut för och leka.” är ”och” rätt.', False,
                 'Det ska vara för att leka. Före verbet leka står att, inte och.'),
            ordna('Bygg meningen om löftet. En bricka hör inte dit.', ['Jag', 'har', 'lovat', 'att', 'hjälpa', 'till.'],
                  extra=['och'],
                  forklaring='Före verbet hjälpa står att. Och binder ihop saker och passar inte här.'),
            val('Vilken text är rätt skriven?',
                ['Vi kom hem. Sedan åt vi middag.', 'Vi kom hem, sedan åt vi middag.', 'Vi kom hem sedan. Åt vi middag.'],
                'Vi kom hem. Sedan åt vi middag.',
                'Det är två hela meningar. Mellan dem sätter du punkt, inte bara ett komma.'),
            val('Vilket ord ska ha stor bokstav? ”Vi läser engelska med fröken ek på måndagar.”',
                ['ek', 'engelska', 'måndagar', 'fröken'], 'ek',
                'Ek är ett efternamn. Språk, veckodagar och ord som fröken skrivs med liten bokstav.'),
            val('Vilket ord är rätt stavat? ”I går … jag nyckeln hemma.”', ['glömde', 'glömmde', 'glömdde'], 'glömde',
                'Före d dubbleras inte m: glömde. Men i glömma och glömmer står två m.'),
            skriv('Ett ord är felstavat: ”Vi komer hem klockan fem.” Skriv ordet rätt.', 'kommer',
                  'O är kort i kommer, och då skrivs två m.'),
            para('Para ihop tecknet med när du använder det.',
                 [('punkt', 'efter en mening som berättar något'), ('frågetecken', 'efter en fråga'),
                  ('utropstecken', 'efter ett utrop eller en uppmaning'), ('komma', 'mellan orden i en uppräkning')],
                 'Tecknen hjälper läsaren att förstå var en tanke slutar och hur den ska läsas.'),
        ], beskrivning='Tränar skrivreglerna som bedöms i provets skrivdel: att och och, punkt mellan meningar, '
                       'stor bokstav och stavning.'),

        niva('sv-ak6-np-spraket-2', 'Välj rätt ord', 'NP-träning: språket', [
            para('Para ihop ordet i ”Hon gav honom en varm tröja.” med ordklassen.',
                 [('Hon', 'pronomen'), ('gav', 'verb'), ('varm', 'adjektiv'), ('tröja', 'substantiv')],
                 'Hon står i stället för ett namn, gav är det hon gör, varm beskriver tröjan och tröja är en sak.'),
            val('Vilket ord är ett pronomen i ”Kalle lånade boken av dem.”?', ['dem', 'boken', 'av'], 'dem',
                'Dem står i stället för namnen på några personer. Av är en preposition.'),
            val('Vilket ord betyder nästan samma sak som ”modig”?', ['tapper', 'rädd', 'försiktig'], 'tapper',
                'Den som är tapper vågar fast det är farligt. Rädd är nästan motsatsen.'),
            val('Vilket ord kan ersätta ”snabbt” i ”Hon sprang snabbt hem.”?', ['fort', 'sakta', 'långt'], 'fort',
                'Fort och snabbt betyder samma sak här. Sakta är motsatsen.'),
            para('Para ihop ordet med en synonym.',
                 [('klok', 'förståndig'), ('lugn', 'stilla'), ('kasta', 'slänga'), ('genast', 'direkt')],
                 'Synonymer gör att du kan variera dig och slippa upprepa samma ord.'),
            val('Vilket ord passar? ”Vi spelade fotboll … det regnade.” Det regnade hela matchen, men vi slutade inte.',
                ['fast', 'eftersom', 'innan'], 'fast',
                'Fast visar att något händer trots något annat. Med eftersom hade regnet varit skälet till att ni spelade.'),
            val('Vilket ord passar? ”Borsta tänderna … du går och lägger dig.”', ['innan', 'eftersom', 'fast'], 'innan',
                'Innan visar tid: först borstar du tänderna, sedan lägger du dig.'),
            val('Vilket ord passar? ”Vi går till stranden … det blir sol i morgon.” Det beror på vädret.',
                ['om', 'men', 'fast'], 'om',
                'Om visar ett villkor: ni går bara om det blir sol.'),
            ordna('Bygg meningen som säger varför vi tränar.', ['Vi', 'tränar', 'för', 'att', 'bli', 'bättre.'],
                  forklaring='För att visar ett syfte, alltså varför man gör något.'),
        ], beskrivning='Tränar språket som gör din text på provet tydlig och varierad: ordklasser, synonymer '
                       'och sambandsord som visar tid, villkor och syfte.'),
    ]),

    # ================================================================
    # ÅRSKURS 9
    # ================================================================
    bana(SV, 'ak9', [
        niva('sv-ak9-np-kallor-1', 'Sammanfatta med egna ord', 'NP-träning: källor och sammanfattning', [
            val('Vad ska en sammanfattning innehålla?',
                ['Det viktigaste i texten, med egna ord', 'Alla detaljer, i samma ordning som texten',
                 'Dina egna åsikter om ämnet'],
                'Det viktigaste i texten, med egna ord',
                'En sammanfattning kortar ner texten till det viktigaste. Detaljer och åsikter hör inte dit.'),
            sant('En sammanfattning är kortare än texten den sammanfattar.', True,
                 'Att sammanfatta är att korta ner: du väljer ut det viktigaste och lämnar detaljerna.'),
            val('Källan: ”Många fåglar som lever i odlingslandskapet har blivit färre i Sverige. En orsak är att '
                'det finns färre ängar och betesmarker där de hittar insekter.” Vilken mening sammanfattar källan bäst?',
                ['Fåglarna i odlingslandskapet minskar, bland annat för att ängarna blir färre.',
                 'Ängar och betesmarker är vackra platser där det växer väldigt många olika blommor.',
                 'Alla fåglar i Sverige kommer snart att ha försvunnit helt, och inget går att göra.'],
                'Fåglarna i odlingslandskapet minskar, bland annat för att ängarna blir färre.',
                'Sammanfattningen tar med både vad som händer och varför. Den överdriver inte och lägger inte till något.'),
            val('Vad hör INTE hemma i en sammanfattning?',
                ['Din egen åsikt om texten', 'Textens viktigaste påstående', 'Vem som har skrivit texten'],
                'Din egen åsikt om texten',
                'En sammanfattning återger vad texten säger. Vad du tycker skriver du för sig, om uppgiften ber om det.'),
            ordna('Ordna stegen när du sammanfattar en text.',
                  ['Läs hela texten', 'Stryk under det viktigaste', 'Skriv med egna ord', 'Jämför med texten'],
                  forklaring='Läs först allt, så att du ser vad som är viktigast. Kontrollera sist att du inte ändrat innehållet.'),
            val('Källan: ”Den som läser mycket får ett större ordförråd.” Vilken mening återger källan med egna ord?',
                ['Läsning gör att man lär sig fler ord.', 'Den som läser mycket får ett större ordförråd.',
                 'Det är tråkigt att läsa långa böcker.'],
                'Läsning gör att man lär sig fler ord.',
                'Med egna ord byter du orden men behåller innehållet. Att skriva av meningen är att citera.'),
            val('Du har läst artikeln ”Skolans skog” av Lina Berg. Vilken mening talar om varifrån uppgiften kommer?',
                ['I artikeln ”Skolans skog” skriver Lina Berg att skogen behöver skyddas.',
                 'På en sida som jag hittade på nätet stod det att skogen behöver skyddas.',
                 'Alla som vet något om naturen säger att skogen behöver skyddas.'],
                'I artikeln ”Skolans skog” skriver Lina Berg att skogen behöver skyddas.',
                'Titeln och skribentens namn visar läsaren exakt var uppgiften kommer ifrån.'),
            para('Para ihop delen av källhänvisningen med exemplet.',
                 [('upphovsperson', 'Lina Berg'), ('titel', '”Skolans skog”'), ('år', '2024'),
                  ('var texten publicerades', 'tidningen Skolbladet')],
                 'Med de uppgifterna kan läsaren hitta källan själv.'),
            val('Hur kan du inleda en sammanfattning av en artikel?',
                ['Med artikelns titel, skribent och ämne', 'Med din egen åsikt om ämnet och om skribenten',
                 'Med det allra sista som står i artikeln'],
                'Med artikelns titel, skribent och ämne',
                'Börja med vilken text du sammanfattar, till exempel: I artikeln … skriver … om …'),
        ], beskrivning='Tränar inför provet att återge det du läst: att sammanfatta det viktigaste med egna ord '
                       'och tala om varifrån det kommer.'),

        niva('sv-ak9-np-kallor-2', 'Citat och källor', 'NP-träning: källor och sammanfattning', [
            val('Källan: ”Skolans skog är en del av undervisningen.” Vilket är ett korrekt citat?',
                ['Berg skriver: ”Skolans skog är en del av undervisningen.”',
                 'Berg skriver: ”Skogen är en viktig del av all undervisning.”',
                 'Berg skriver att skogen är en del av undervisningen.'],
                'Berg skriver: ”Skolans skog är en del av undervisningen.”',
                'Ett citat är ordagrant och står inom citattecken. Ändrade ord inom citattecken förvanskar källan.'),
            val('När passar ett citat bättre än ett referat?',
                ['När själva formuleringen är viktig', 'När källan är lång och svår att förstå',
                 'När du vill byta ut källans åsikt'],
                'När själva formuleringen är viktig',
                'Citera när orden i sig betyder något, som ett träffande uttryck. Annars räcker ofta ett referat.'),
            sant('Det räcker att skriva ”jag läste det på nätet” som källhänvisning.', False,
                 'Läsaren måste kunna hitta källan: vem som står bakom texten, vad den heter och var den finns.'),
            val('Du ska återge en debattartikel om läxor. Vilken mening visar att det är skribentens åsikt?',
                ['Skribenten anser att läxor bör tas bort.', 'Läxor bör tas bort helt, och så är det bara.',
                 'Det är bevisat att läxor bör tas bort.'],
                'Skribenten anser att läxor bör tas bort.',
                'Med ”skribenten anser” visar du att det är en åsikt i källan, inte ett faktum och inte din åsikt.'),
            val('Vilken källa passar bäst för uppgifter om hur många som bor i Sverige?',
                ['Statistiska centralbyrån', 'en kompis blogg om resor', 'ett inlägg i sociala medier'],
                'Statistiska centralbyrån',
                'Statistiska centralbyrån, SCB, är myndigheten som ansvarar för statistiken om Sveriges befolkning.'),
            ordna('Bygg meningen som hänvisar till källan.', ['Enligt', 'Lina', 'Berg', 'behöver', 'skogen', 'skyddas.'],
                  forklaring='Enligt Lina Berg visar vem som säger det. Sedan kommer verbet behöver, före skogen.'),
            para('Para ihop sättet att använda en källa med exemplet.',
                 [('citat', 'Berg skriver: ”Skogen är full av liv.”'),
                  ('referat', 'Berg menar att skogen har ett rikt djurliv.'),
                  ('egen åsikt', 'Jag tycker att skogen ska få finnas kvar.')],
                 'Ett citat är ordagrant, ett referat är med egna ord, och din åsikt ska synas som din.'),
            val('Du använder två källor. Hur visar du vilken uppgift som kommer varifrån?',
                ['Du nämner rätt källa vid varje uppgift',
                 'Du listar båda källorna sist i texten, utan koppling till uppgifterna',
                 'Du nämner bara den källa som du håller med'],
                'Du nämner rätt källa vid varje uppgift',
                'Läsaren ska kunna se vem som säger vad, direkt där uppgiften står.'),
            val('Hur visar du att ett citat inte är dina egna ord?',
                ['Med citattecken och en källhänvisning', 'Med fetstil och större bokstäver än resten',
                 'Med en egen rubrik ovanför varje citat'],
                'Med citattecken och en källhänvisning',
                'Citattecknen visar var de lånade orden börjar och slutar, och källhänvisningen vems de är.'),
        ], beskrivning='Tränar inför provet att använda källor: citat och referat, tydliga källhänvisningar och '
                       'att välja en källa som går att lita på.'),
    ]),

    # ================================================================
    # GYMNASIET 1
    # ================================================================
    bana(SV, 'gy1', [
        niva('sv-gy1-np-utredande-1', 'Bygg upp utredningen', 'NP-träning: utredande text', [
            val('Vad är syftet med en utredande text?',
                ['Att reda ut en fråga och ge läsaren förståelse', 'Att övertyga läsaren om en bestämd åsikt',
                 'Att underhålla läsaren med en spännande historia'],
                'Att reda ut en fråga och ge läsaren förståelse',
                'En utredande text belyser en fråga från flera håll. Att övertyga är den argumenterande textens syfte.'),
            val('Uppgiften är ett inlägg på en webbplats för gymnasieelever om varför vi drömmer. Vilken inledning passar?',
                ['Varför drömmer vi egentligen? I det här inlägget reder jag ut vad forskningen vet om drömmar.',
                 'Drömmar är det viktigaste vi har, och därför borde alla skriva ner sina drömmar varje morgon.',
                 'Jag drömde i natt att jag flög över staden, och det var det bästa jag har varit med om.'],
                'Varför drömmer vi egentligen? I det här inlägget reder jag ut vad forskningen vet om drömmar.',
                'Inledningen väcker intresse, ställer frågan och säger vad texten ska göra. De andra driver en åsikt '
                'eller berättar.'),
            val('Vilken frågeställning går att utreda med hjälp av källor?',
                ['Vilka faktorer påverkar hur mycket unga motionerar?',
                 'Varför är det så att alla unga i dag hatar att röra på sig?',
                 'Hur många steg gick jag själv på skolgården i går eftermiddag?'],
                'Vilka faktorer påverkar hur mycket unga motionerar?',
                'Frågan är öppen och saklig. ”Alla unga hatar” är en överdrift, och dina egna steg går inte att utreda med källor.'),
            val('Var i en utredande text brukar frågeställningen stå?',
                ['I inledningen', 'I avslutningen', 'I källförteckningen'], 'I inledningen',
                'Läsaren ska veta från början vilken fråga texten utreder. Avslutningen svarar på den.'),
            val('Vad är en kärnmening i ett stycke?',
                ['En mening som säger vad stycket handlar om', 'Den mening som avslutar hela texten och drar slutsatsen',
                 'Ett citat ur en källa som stöder textens påståenden'],
                'En mening som säger vad stycket handlar om',
                'Kärnmeningen står ofta först i stycket, och resten av stycket utvecklar den.'),
            para('Para ihop ordet med vad det betyder i en utredande text.',
                 [('frågeställning', 'den fråga texten ska besvara'), ('aspekt', 'en sida av frågan som tas upp'),
                  ('disposition', 'planen för textens delar och ordning'),
                  ('slutsats', 'svaret som utredningen leder fram till')],
                 'Med en disposition vet du i förväg vilka aspekter som ska få var sitt stycke.'),
            sant('I en utredande text driver skribenten en tes från början till slut.', False,
                 'Det gör en argumenterande text. Den utredande belyser frågan från flera håll innan den drar en slutsats.'),
            ordna('Ordna arbetet när du skriver en utredande text utifrån ett texthäfte.',
                  ['Läs texthäftet', 'Formulera en frågeställning', 'Gör en disposition', 'Skriv och bearbeta texten'],
                  forklaring='Frågeställningen bygger på det du läst, och dispositionen bygger på frågeställningen.'),
            val('Du skriver för en webbplats som gymnasieelever läser. Hur bör språket vara?',
                ['Sakligt och lättläst, med svåra ord förklarade',
                 'Fullt av svåra fackord som aldrig förklaras för läsaren',
                 'Som ett sms till en kompis, med förkortningar och emojis'],
                'Sakligt och lättläst, med svåra ord förklarade',
                'Anpassa språket efter mottagaren: sakligt eftersom det är en utredning, och begripligt för den som läser.'),
        ], beskrivning='Tränar inför provets skrivdel, där texten kan vara utredande: syfte, frågeställning, '
                       'disposition och stycken med kärnmeningar.'),

        niva('sv-gy1-np-utredande-2', 'Sakligt och med källor', 'NP-träning: utredande text', [
            val('Vilken mening har en saklig ton?',
                ['Biblioteket har öppet kortare tider än för fem år sedan.',
                 'Biblioteket har helt sjukt korta öppettider nu för tiden.',
                 'Det är en skandal att biblioteket nästan aldrig är öppet.'],
                'Biblioteket har öppet kortare tider än för fem år sedan.',
                'Den sakliga meningen beskriver utan att värdera. ”Helt sjukt” och ”skandal” visar vad skribenten tycker.'),
            val('Vad är ett värdeord?',
                ['Ett ord som visar vad någon tycker, som ”skandal”',
                 'Ett ord som anger ett pris eller ett värde, som ”kronor”',
                 'Ett ord som har lånats in från ett annat språk, som ”mejl”'],
                'Ett ord som visar vad någon tycker, som ”skandal”',
                'Värdeord färgar texten. I en utredning väljer du hellre neutrala ord.'),
            val('Vilket ord är mest neutralt?', ['minskning', 'ras', 'kollaps', 'katastrofläge'], 'minskning',
                'Minskning beskriver vad som har hänt utan att dramatisera. De andra orden förstärker och värderar.'),
            para('Para ihop det talspråkliga uttrycket med ett sakligt.',
                 [('jättemånga', 'ett stort antal'), ('typ', 'ungefär'), ('kolla upp', 'undersöka'),
                  ('funkar', 'fungerar')],
                 'Talspråk passar i ett samtal men gör en utredning mindre saklig.'),
            val('Två källor är oense om läxor. Vilken mening redovisar oenigheten sakligt?',
                ['Rektorn i källa 1 menar att läxor hjälper, medan forskaren i källa 2 är tveksam.',
                 'Rektorn i källa 1 har rätt, och forskaren i källa 2 har inte förstått något om läxor.',
                 'Läxor är bra, så det spelar ingen roll vad forskaren i källa 2 skriver om dem.'],
                'Rektorn i källa 1 menar att läxor hjälper, medan forskaren i källa 2 är tveksam.',
                'Den sakliga meningen återger båda källorna utan att döma. Din egen bedömning hör hemma i slutsatsen.'),
            val('Vilket uttryck passar för att föra in ett annat perspektiv i en utredning?',
                ['Å andra sidan', 'Följaktligen', 'Sammanfattningsvis'], 'Å andra sidan',
                'Å andra sidan visar att det som kommer väger åt ett annat håll. Följaktligen visar en följd.'),
            skriv('Vad kallas listan sist i texten där alla källor står med upphovsperson, titel och år?',
                  ['källförteckning', 'källförteckningen', 'en källförteckning', 'källista', 'källistan', 'källlista',
                   'källlistan', 'käll-lista', 'referenslista', 'referenslistan', 'litteraturlista',
                   'litteraturförteckning'],
                  'Källförteckningen gör att läsaren kan hitta och kontrollera källorna.'),
            sant('Avslutningen i en utredande text bör knyta an till frågeställningen.', True,
                 'Avslutningen svarar på frågan från inledningen. Då hänger texten ihop från början till slut.'),
            val('Vad gör en utredande text mer trovärdig?',
                ['Att flera perspektiv redovisas med källor', 'Att skribenten upprepar sin egen åsikt i varje stycke',
                 'Att texten är skriven med många värdeord'],
                'Att flera perspektiv redovisas med källor',
                'När läsaren ser flera perspektiv och var de kommer ifrån kan hen själv pröva slutsatsen.'),
        ], beskrivning='Tränar den sakliga tonen och källhanteringen som provets utredande text kräver: neutrala '
                       'ord, perspektiv som vägs mot varandra och källförteckning.'),
    ]),

    # ================================================================
    # GYMNASIET 3
    # ================================================================
    bana(SV, 'gy3', [
        niva('sv-gy3-np-vetenskapligt-1', 'Från syfte till analys', 'NP-träning: vetenskapligt skrivande', [
            val('Vad är skillnaden mellan syfte och frågeställning?',
                ['Syftet säger vad texten ska uppnå, frågeställningen vad som ska besvaras',
                 'Syftet ställs alltid som en fråga, medan frågeställningen är ett påstående om resultatet',
                 'Det är två olika namn på exakt samma sak, och bara det ena behövs i texten'],
                'Syftet säger vad texten ska uppnå, frågeställningen vad som ska besvaras',
                'Syftet är målet med texten. Frågeställningen gör syftet konkret genom att säga vad som ska besvaras.'),
            val('Vilken formulering är ett syfte?',
                ['Syftet är att undersöka hur ungdomar beskrivs i två nyhetsartiklar.',
                 'Hur beskrivs ungdomar i två nyhetsartiklar från olika tidningar och år?',
                 'Ungdomar beskrivs nästan alltid negativt i svenska nyhetsartiklar i dag.'],
                'Syftet är att undersöka hur ungdomar beskrivs i två nyhetsartiklar.',
                'Ett syfte säger vad arbetet ska göra. En fråga är en frågeställning, och ett påstående om resultatet '
                'är en hypotes.'),
            val('Vad gör du när du analyserar en text, och inte bara sammanfattar den?',
                ['Undersöker hur texten är gjord och vad det får för verkan',
                 'Återger hela innehållet kort och med egna ord, i samma ordning som texten',
                 'Skriver av de viktigaste meningarna ordagrant och sätter dem i en lista'],
                'Undersöker hur texten är gjord och vad det får för verkan',
                'En sammanfattning återger vad som står. En analys undersöker hur texten är byggd och varför den verkar '
                'som den gör.'),
            sant('En sammanfattning av en text är detsamma som en analys av den.', False,
                 'Sammanfattningen återger innehållet. Analysen går vidare och undersöker hur och varför.'),
            val('En novell slutar med att huvudpersonen öppnar fönstret och låter fågeln flyga ut. Vilken mening är en tolkning?',
                ['Fågeln kan stå för huvudpersonens längtan efter frihet.',
                 'I slutet öppnar huvudpersonen fönstret och låter fågeln flyga ut.',
                 'Novellen är ganska kort och handlar om en enda huvudperson.'],
                'Fågeln kan stå för huvudpersonens längtan efter frihet.',
                'En tolkning säger vad något kan betyda. Att återge vad som händer är att referera.'),
            val('Vad behöver en tolkning för att vara trovärdig?',
                ['Stöd i texten, till exempel ett citat', 'Att många andra läsare har tolkat texten på samma sätt',
                 'Att den står allra först i analysen och upprepas sist'],
                'Stöd i texten, till exempel ett citat',
                'En tolkning blir trovärdig när du visar vad i texten den bygger på.'),
            ordna('Ordna delarna i inledningen till ett vetenskapligt arbete.', ['bakgrund', 'syfte', 'frågeställning'],
                  forklaring='Bakgrunden visar varför ämnet är viktigt, syftet vad arbetet ska göra och frågeställningen '
                             'vad som ska besvaras.'),
            para('Para ihop begreppet med vad det är i ett vetenskapligt arbete.',
                 [('syfte', 'vad arbetet ska uppnå'), ('frågeställning', 'den fråga som arbetet besvarar'),
                  ('metod', 'hur undersökningen går till'), ('slutsats', 'det svar som undersökningen leder fram till')],
                 'Metoden ska kunna besvara frågeställningen, och slutsatsen ska svara på den.'),
            sant('En frågeställning bör gå att besvara med det material du har.', True,
                 'En fråga som materialet inte kan besvara leder inte fram till någon slutsats.'),
        ], beskrivning='Tränar det vetenskapliga skrivandet inför provets utredande text: syfte och frågeställning, '
                       'och skillnaden mellan att sammanfatta, analysera och tolka.'),

        niva('sv-gy3-np-vetenskapligt-2', 'Belägg och källor', 'NP-träning: vetenskapligt skrivande', [
            val('Hur fungerar ett citat som belägg i en analys?',
                ['Det visar läsaren vad i texten tolkningen bygger på',
                 'Det gör analysen längre och ser mer imponerande ut för läsaren',
                 'Det ersätter helt behovet av en egen förklaring av texten'],
                'Det visar läsaren vad i texten tolkningen bygger på',
                'Citatet är ditt bevis. Utan det måste läsaren lita på dig utan att kunna kontrollera.'),
            val('Vad bör följa direkt efter ett citat som du använder som belägg?',
                ['En kommentar som förklarar vad citatet visar',
                 'Ett nytt citat ur samma källa som säger ungefär samma sak',
                 'Ingenting alls, eftersom ett bra citat alltid talar för sig självt'],
                'En kommentar som förklarar vad citatet visar',
                'Citatet visar vad som står, och din kommentar visar varför det stöder tolkningen.'),
            val('Analysen säger att huvudpersonen känner sig ensam. Vilket belägg är starkast?',
                ['Ett citat där hon äter lunch ensam varje dag',
                 'Att du själv också har känt dig ensam i skolan ibland',
                 'Att novellen har ett mörkt och sorgligt omslag'],
                'Ett citat där hon äter lunch ensam varje dag',
                'Belägget ska komma ur texten. Egna erfarenheter och omslaget säger inget om vad som står i novellen.'),
            val('Du hänvisar med efternamn och år i texten, som (Berg, 2025). Hur ordnar du då källförteckningen?',
                ['I bokstavsordning efter efternamn', 'I den ordning du använde källorna', 'Efter hur viktiga källorna är'],
                'I bokstavsordning efter efternamn',
                'Läsaren letar upp Berg bland B:na. Därför ordnas listan efter upphovspersonens efternamn.'),
            sant('Om du hänvisar med efternamn och år i texten ska samma källa också stå i källförteckningen.', True,
                 'Hänvisningen i texten är kort. I källförteckningen hittar läsaren alla uppgifter om källan.'),
            val('Vilken mening passar bäst i ett vetenskapligt arbete?',
                ['Resultaten tyder på att sömnen påverkar minnet.',
                 'Det är helt uppenbart för alla att vi sover alldeles för lite.',
                 'Jag känner att sömn nog är ganska viktigt ändå.'],
                'Resultaten tyder på att sömnen påverkar minnet.',
                'Meningen är objektiv och försiktig: den säger vad resultaten visar, och inte mer.'),
            sant('I ett vetenskapligt arbete är det bra att skriva ”bevisar” när en undersökning bara pekar i en viss riktning.',
                 False, 'Säg inte mer än undersökningen visar. ”Tyder på” och ”pekar på” är försiktigare och ärligare.'),
            para('Para ihop den värdeladdade formuleringen med en objektiv.',
                 [('massor av', 'en stor mängd'), ('superviktigt', 'av stor betydelse'),
                  ('helt värdelös', 'av begränsat värde')],
                 'Objektiva ord låter läsaren bedöma själv. Värdeladdade ord gör det åt hen.'),
            val('Vad betyder det att skriva objektivt?',
                ['Att hålla isär fakta och värderingar och inte ta parti',
                 'Att skriva så att så många läsare som möjligt till slut håller med',
                 'Att bara använda de källor som stöder den åsikt man redan har'],
                'Att hålla isär fakta och värderingar och inte ta parti',
                'Objektiv text låter läsaren se vad som är fakta och vad som är någons bedömning.'),
        ], beskrivning='Tränar inför provets utredande text att belägga med citat, ordna källförteckningen och '
                       'skriva objektivt.'),
    ]),
]
