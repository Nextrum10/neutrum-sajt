# -*- coding: utf-8 -*-
"""Fler nivåer i Svenska för åk 1 till åk 5 (NexLäx).

Nya områden i banor som redan finns, läggs sist i varje bana (TILLAGG):

  åk 1  Bokstäver och ord             tre nivåer, ingen lästext
  åk 2  Ord och texter                två nivåer och en läsförståelse
  åk 3  Läsa och förstå               två läsförståelser (inget Mästarprov)
        Stavning                      två nivåer
  åk 4  Fakta och berättelser         två läsförståelser (inget Mästarprov)
        Berättelsens delar            två nivåer
  åk 5  Läsa och tolka                två läsförståelser (inget Mästarprov)
        Bildligt språk                två nivåer

Frågorna och lästexterna är helt egna, från grunden, med påhittade personer.
Varje fråga förstås ensam, utom i läsförståelserna, där lästexten visas före
frågorna. Filen är skriven med AI och inte läst av en lärare.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SIFFROR = {1: ['ett', 'en'], 2: ['två'], 3: ['tre'], 4: ['fyra'], 5: ['fem'], 6: ['sex'],
           7: ['sju'], 8: ['åtta'], 9: ['nio'], 10: ['tio']}


def antal(n):
    """Ett antal som siffra och med bokstäver, så att båda rättas som rätt."""
    return [tal(n)] + SIFFROR[n]


# ---------------------------------------------------------------------------
# Svenska åk 1: Bokstäver och ord
# ---------------------------------------------------------------------------

MENING_ORD = 'Jag ser en stor hund'
assert len(MENING_ORD.split()) == 5
assert 'mamma'.count('m') == 3 and len('hund') == 4

AK1_FORSTA_LJUDET = niva(
    'sv-ak1-fler-bokstaver-1', 'Första ljudet', 'Bokstäver och ord', [
        val('Vilket ord börjar på samma ljud som ”fisk”?',
            ['fot', 'sko', 'bil'], 'fot',
            'Säg orden högt. Fisk och fot börjar båda med f-ljudet.'),
        val('Vilken bokstav börjar ordet ”hund” med?',
            ['d', 'h', 'u'], 'h',
            'Hund stavas h-u-n-d. Den första bokstaven är h.'),
        val('Vilket ord börjar på samma ljud som ”måne”?',
            ['nos', 'lök', 'mus'], 'mus',
            'Måne och mus börjar båda med m-ljudet.'),
        skriv('Vilken bokstav slutar ordet ”bok” med?', 'k',
              'B-o-k. Den sista bokstaven är k.'),
        skriv('Vilket ljud hör du först i ordet ”tåg”? Skriv bokstaven.', 't',
              'T-å-g. Det första ljudet är t.'),
        sant('Ordet ”ko” börjar med bokstaven k.', True,
             'K-o. Den första bokstaven är k.'),
        sant('Ordet ”sol” slutar med bokstaven o.', False,
             'S-o-l. Det sista ljudet är l. O står i mitten.'),
        para('Para ihop ordet med bokstaven det börjar med.',
             [('bil', 'b'), ('hus', 'h'), ('tomat', 't'), ('ros', 'r')],
             'Säg varje ord och lyssna på första ljudet. Det är den bokstaven ordet börjar med.'),
        ordna('Bygg ordet ”hund”. En bokstav hör inte dit.', 'h u n d', extra='t',
              forklaring='Hund stavas h-u-n-d. T hör inte dit.'),
    ],
    beskrivning='Lyssna efter vilket ljud ett ord börjar med, och vilken bokstav det är.')

AK1_BYGG_ORD = niva(
    'sv-ak1-fler-bokstaver-2', 'Bygg och läs ord', 'Bokstäver och ord', [
        val('Dra ihop ljuden: s-o-l. Vilket ord blir det?',
            ['sko', 'sol', 'sal'], 'sol',
            'S, o och l blir sol. Sko och sal har andra bokstäver i mitten.'),
        val('Dra ihop ljuden: b-å-t. Vilket ord blir det?',
            ['bil', 'bok', 'båt'], 'båt',
            'B, å och t blir båt. En båt åker på vattnet.'),
        skriv('Dra ihop ljuden: h-u-s. Skriv ordet.', 'hus',
              'H, u och s blir hus.'),
        skriv('Vilken bokstav fattas? b _ k. Det är något man läser i.', 'o',
              'B-o-k blir bok. Man läser i en bok.'),
        sant('I ordet ”mamma” finns tre m.', True,
             'M-a-m-m-a. M står först, och sedan två gånger i rad. Det blir tre m.'),
        sant('Ordet ”hund” har fem bokstäver.', False,
             'H-u-n-d. Det är fyra bokstäver, inte fem.'),
        val('Vilket ord har fyra bokstäver?',
            ['tåg', 'hund', 'bil'], 'hund',
            'H-u-n-d är fyra bokstäver. Tåg och bil har tre.'),
        ordna('Bygg ordet ”hand”. En bokstav hör inte dit.', 'h a n d', extra='l',
              forklaring='Hand stavas h-a-n-d. L hör inte dit.'),
        para('Para ihop den stora bokstaven med den lilla.',
             [('B', 'b'), ('D', 'd'), ('G', 'g'), ('R', 'r')],
             'Den stora och den lilla bokstaven är samma bokstav. Se upp med b och d: b har bågen åt höger, d har den åt vänster.'),
    ],
    beskrivning='Dra ihop ljud till ord och bygg ord av bokstäver.')

AK1_STOR_BOKSTAV = niva(
    'sv-ak1-fler-bokstaver-3', 'Stor bokstav och punkt', 'Bokstäver och ord', [
        val('Vilket ord ska ha stor bokstav? ”lisa har en boll.”',
            ['har', 'lisa', 'boll'], 'lisa',
            'Lisa är ett namn, och det står dessutom först i meningen. Båda skälen ger stor bokstav.'),
        val('Vad ska stå sist? ”Vi leker i parken”',
            ['punkt', 'frågetecken', 'komma'], 'punkt',
            'Meningen berättar något. Då sätter man punkt sist.'),
        val('Vad ska stå sist? ”Var är mamma”',
            ['komma', 'punkt', 'frågetecken'], 'frågetecken',
            'Det är en fråga. Efter en fråga sätter man frågetecken.'),
        sant('Efter en fråga sätter man frågetecken.', True,
             'Frågetecknet visar att meningen är en fråga, som ”Var är du?”.'),
        sant('Namn skrivs med liten bokstav.', False,
             'Namn har alltid stor bokstav, som Omar och Stockholm.'),
        skriv('Hur många ord är det i meningen ”%s”?' % MENING_ORD, antal(len(MENING_ORD.split())),
              'Jag, ser, en, stor, hund. Det är fem ord, med mellanrum emellan.'),
        skriv('Ett ord saknar stor bokstav: ”Min kompis heter omar.” Skriv ordet rätt.', 'Omar',
              'Omar är ett namn. Namn har alltid stor bokstav.'),
        ordna('Bygg meningen om hunden. Den börjar med stor bokstav och slutar med punkt.',
              'Hunden sover på mattan.',
              forklaring='Hunden har stor bokstav och står först. Mattan har punkt och står sist.'),
        ordna('Bygg frågan om vem som vill leka.', 'Vem vill leka?',
              forklaring='Frågeordet Vem har stor bokstav och står först. Leka har frågetecken och står sist.'),
    ],
    beskrivning='Börja med stor bokstav och sluta med punkt eller frågetecken.')


# ---------------------------------------------------------------------------
# Svenska åk 2: Ord och texter
# ---------------------------------------------------------------------------

assert 'sommar'.count('m') == 2

AK2_DUBBLA = niva(
    'sv-ak2-fler-ordtext-1', 'Dubbla konsonanter', 'Ord och texter', [
        val('Vilket ord är rätt stavat? ”Min … heter Misse.”',
            ['kat', 'katt'], 'katt',
            'A är kort i katt, och då skriver man två t.'),
        val('Vilket ord passar? ”Vi sitter på en mjuk …”',
            ['mata', 'mat', 'matta'], 'matta',
            'I matta är a kort, och då skriver man två t. En matta ligger på golvet. Mata, med långt a, betyder att ge mat.'),
        val('Vilket ord passar? ”Det ligger … på hyllan.”',
            ['dam', 'damm'], 'damm',
            'I damm är a kort, och då skriver man två m. Dam, med långt a, betyder en kvinna.'),
        skriv('Ett ord är felstavat: ”Vi badar i sjön på somaren.” Skriv ordet rätt.', 'sommaren',
              'O är kort i sommar, och då skriver man två m: sommaren.'),
        skriv('Ett ord är felstavat: ”Min papa jobbar på ett sjukhus.” Skriv ordet rätt.', 'pappa',
              'A är kort i pappa, och då skriver man två p.'),
        skriv('Hur många m finns det i ordet ”sommar”?', antal('sommar'.count('m')),
              'S-o-m-m-a-r. M står två gånger i rad, så det blir två m.'),
        sant('Ordet ”hatt” skrivs med två t eftersom a är kort.', True,
             'Efter en kort vokal skriver man oftast två konsonanter. Hatt är ett sådant ord.'),
        sant('Ordet ”tak”, som sitter överst på ett hus, skrivs med två k.', False,
             'I tak är a långt, och då skriver man bara ett k. Det är tack, med ck, som har kort a.'),
        ordna('Bygg meningen om pappas hatt.', 'Pappa har en ny hatt.',
              forklaring='Pappa har stor bokstav och står först. Hatt har punkt och står sist.'),
    ],
    beskrivning='Efter en kort vokal skriver man ofta två konsonanter.')

AK2_BESKRIV = niva(
    'sv-ak2-fler-ordtext-2', 'Ord som beskriver', 'Ord och texter', [
        val('Vilket ord berättar hur hunden är? ”Vi har en snäll hund.”',
            ['Vi', 'har', 'snäll', 'hund'], 'snäll',
            'Snäll säger hur hunden är. Ord som beskriver kallas adjektiv.'),
        val('Vilket ord passar? ”Isen är …”',
            ['springer', 'kall', 'bord'], 'kall',
            'Efter är kommer ett ord som berättar hur isen är. Kall är ett adjektiv.'),
        val('Vilken mening har ett ord som beskriver?',
            ['Katten sover i korgen.', 'Hunden och katten sover.', 'Den svarta katten sover.'],
            'Den svarta katten sover.',
            'Svarta berättar hur katten ser ut. De andra meningarna har inget sådant ord.'),
        skriv('Skriv ordet som beskriver: ”Den gula bananen ligger på bordet.”', 'gula',
              'Gula berättar hur bananen ser ut. Ligger är ett verb och bordet är ett substantiv.'),
        skriv('Hur många ord som beskriver finns det i meningen? ”En stor och grön groda hoppar.”', antal(2),
              'Stor och grön berättar båda hur grodan är. Hoppar säger vad grodan gör.'),
        skriv('Skriv motsatsen till ”het”. Soppan är het. Glassen är …', 'kall',
              'Het och kall är motsatser. Båda är ord som beskriver.'),
        sant('Ordet ”glad” berättar hur någon är.', True,
             'Glad är ett adjektiv. Det berättar hur en person känner sig.'),
        sant('Ordet ”springer” är ett ord som beskriver.', False,
             'Springer säger vad någon gör. Det är ett verb. Ord som beskriver är adjektiv, som snabb och stor.'),
        ordna('Bygg meningen om kaninen.', 'Den lilla kaninen hoppar.',
              forklaring='Ordet lilla står före kaninen och berättar hur kaninen är.'),
    ],
    beskrivning='Adjektiv är ord som berättar hur något är.')

AMIR_TEXT = '\n\n'.join([
    'Det var vinter, och det hade snöat hela natten. Amir tittade ut genom köksfönstret. I trädgården satt '
    'en liten fågel på en gren. Den såg frusen ut.',
    '– Mamma, vad äter fåglar på vintern? frågade Amir.\n'
    '– De äter frön och bär, svarade mamma. Men nu ligger det snö över allt.',
    'Amir hämtade en burk med solroskärnor i skafferiet. Han tog på sig mössa, vantar och stövlar och gick '
    'ut. Han hängde upp en liten korg i äppelträdet och hällde i kärnorna. Sedan gick han in och väntade '
    'vid fönstret.',
    'Först hände ingenting. Men efter en stund kom fågeln flygande. Sedan kom en till, och en till, och en '
    'till. Snart satt fyra små fåglar i äppelträdet och åt.',
    'Amir log. Nu behövde ingen fågel vara hungrig i dag.',
])

AK2_AMIR = niva(
    'sv-ak2-fler-ordtext-3', 'Amir och fåglarna', 'Ord och texter', [
        skriv('Vad heter pojken i texten?', 'Amir',
              'Det står i andra meningen: Amir tittade ut genom köksfönstret.'),
        val('Varför kunde fåglarna inte hitta mat själva?',
            ['Mamma hade tagit fröna', 'Det låg snö över allt', 'Fåglarna sov'], 'Det låg snö över allt',
            'Mamma säger det: Men nu ligger det snö över allt. Då syns inga frön och bär.'),
        val('Varför tror du att Amir tog på sig mössa, vantar och stövlar?',
            ['För att han skulle åka pulka', 'För att han skulle gå på kalas', 'För att det var kallt ute'],
            'För att det var kallt ute',
            'Det var vinter och det hade snöat. Då tar man på sig varma kläder när man går ut.'),
        sant('Amir hämtade solroskärnorna i skafferiet.', True,
             'Det står i texten: Amir hämtade en burk med solroskärnor i skafferiet.'),
        sant('Fåglarna kom direkt när Amir hade hängt upp korgen.', False,
             'Det står att först hände ingenting. Fåglarna kom efter en stund.'),
        skriv('I vilket träd hängde Amir upp korgen?',
              ['äppelträdet', 'äppelträd', 'ett äppelträd', 'i äppelträdet'],
              'Han hängde upp en liten korg i äppelträdet.'),
        ordna('Ordna det som händer i texten.',
              ['Amir ser en fågel.', 'Amir hämtar solroskärnor.', 'Amir hänger upp en korg.',
               'Fåglarna kommer och äter.'],
              forklaring='Först ser Amir fågeln. Sedan hämtar han kärnorna och hänger upp korgen. Sist kommer fåglarna.'),
        para('Para ihop personen med vad personen gör i texten.',
             [('Amir', 'hänger upp en korg i trädet'), ('Mamma', 'berättar vad fåglar äter'),
              ('Fåglarna', 'äter kärnorna i korgen')],
             'Amir hänger upp korgen, mamma svarar på hans fråga och fåglarna äter till sist kärnorna.'),
        val('Vad kan man förstå av att Amir log i slutet?',
            ['Han var glad att fåglarna fick mat', 'Han tyckte att det var kallt',
             'Han ville äta kärnorna själv'],
            'Han var glad att fåglarna fick mat',
            'Texten säger att nu behövde ingen fågel vara hungrig. Det är därför Amir är glad.'),
    ],
    beskrivning='Läs om Amir som hjälper fåglarna en snöig dag.',
    text=AMIR_TEXT)


# ---------------------------------------------------------------------------
# Svenska åk 3: Läsa och förstå (två läsförståelser) och Stavning
# ---------------------------------------------------------------------------

REGN_TEXT = '\n\n'.join([
    'Regnet börjar sin resa i havet, i sjöar och i pölar. När solen skiner blir vattnet varmt. Lite av '
    'vattnet blir då till ånga och stiger upp i luften. Ångan syns inte, för den är en gas.',
    'Högt upp är det kallt. Där blir ångan till små, små vattendroppar. Många droppar tillsammans bildar '
    'ett moln.',
    'När molnet har blivit tungt faller dropparna ner. Då regnar det. Om det är mycket kallt blir dropparna '
    'till snö i stället.',
    'Regnet rinner ner i marken, till bäckar och sjöar och till sist ut i havet. Sedan kan hela resan börja '
    'om igen.',
])

AK3_REGN = niva(
    'sv-ak3-fler-lasa-1', 'Från moln till regn', 'Läsa och förstå', [
        val('Vad händer med lite av vattnet när solen skiner på det?',
            ['Det fryser till is', 'Det blir ånga som stiger', 'Det rinner ner i marken'],
            'Det blir ånga som stiger',
            'Texten säger att lite av vattnet blir till ånga och stiger upp i luften.'),
        val('Varför kan man inte se ångan?',
            ['Ångan är för tung', 'Ångan är för kall', 'Ångan är en gas'], 'Ångan är en gas',
            'Texten säger: Ångan syns inte, för den är en gas.'),
        skriv('Vad bildar många vattendroppar tillsammans? Skriv ordet.', ['moln', 'ett moln'],
              'Många droppar tillsammans bildar ett moln.'),
        skriv('Vad blir dropparna till om det är mycket kallt? Skriv ordet.', 'snö',
              'Om det är mycket kallt blir dropparna till snö i stället.'),
        sant('Man kan se ångan som stiger upp från havet.', False,
             'Ångan syns inte, för den är en gas.'),
        sant('Regnet kan till sist rinna ut i havet.', True,
             'Texten säger att regnet rinner ner i marken, till bäckar och sjöar och till sist ut i havet.'),
        ordna('Ordna vattnets resa.',
              ['Solen värmer vattnet.', 'Ångan stiger upp.', 'Ett moln bildas.', 'Det regnar.'],
              forklaring='Först värms vattnet, sedan stiger ångan. I det kalla blir ångan till moln, och sist faller regnet.'),
        para('Para ihop ordet med vad det är i texten.',
             [('ånga', 'vatten som blivit en gas'), ('moln', 'många små vattendroppar tillsammans'),
              ('regn', 'droppar som faller ner')],
             'Ånga är vatten som blivit en gas. Moln är många droppar tillsammans, och regn är droppar som faller.'),
        val('Varför kan det regna om och om igen?',
            ['Solen skapar nytt vatten varje dag', 'Vattnet går runt och kan börja om',
             'Molnen blir aldrig tomma'],
            'Vattnet går runt och kan börja om',
            'Regnet rinner till havet, och därifrån kan vattnet stiga upp igen. Texten säger att hela resan kan börja om.'),
    ],
    beskrivning='Läs om vattnets resa från havet till molnet och tillbaka.',
    text=REGN_TEXT)

IDA_TEXT = '\n\n'.join([
    'Ida ville baka en kaka till pappas födelsedag. Hon tog fram ett recept och ställde ut mjöl, ägg, '
    'smör och mjölk på köksbänken. Sedan började hon vispa.',
    'Hon hällde smeten i en form och ställde den i ugnen. Efter en stund luktade det gott i hela huset.',
    'Kakan såg fin ut när Ida tog ut den. Den var gyllenbrun och hög. Hon satte ett ljus i kakan och sjöng '
    'för pappa. Sedan fick alla en bit.',
    '– Mmm, sa pappa. Men hans ansikte såg lite konstigt ut.',
    'Ida tog en tugga själv. Kakan smakade nästan ingenting. Hon tittade mot köksbänken. Där stod '
    'sockerburken, precis lika full som förut.',
    '– Åh nej, sa Ida.',
    'Pappa skrattade och tog en bit till.',
    '– Jag gillar den ändå, sa han. Nästa gång bakar vi tillsammans.',
])

AK3_IDA = niva(
    'sv-ak3-fler-lasa-2', 'Idas kaka', 'Läsa och förstå', [
        skriv('Vem fyllde år? Skriv ordet.', ['pappa', 'Idas pappa'],
              'Ida ville baka en kaka till pappas födelsedag.'),
        val('Hur såg kakan ut när Ida tog ut den?',
            ['Platt och bränd', 'Gyllenbrun och hög', 'Vit och rund'], 'Gyllenbrun och hög',
            'Det står att kakan var gyllenbrun och hög.'),
        sant('Ida sjöng för pappa.', True,
             'Det står att hon satte ett ljus i kakan och sjöng för pappa.'),
        val('Varför såg pappas ansikte lite konstigt ut?',
            ['Han hade bränt sig på kakan', 'Kakan smakade nästan ingenting', 'Han ville ha en annan present'],
            'Kakan smakade nästan ingenting',
            'Texten säger det inte rakt ut. Men Ida smakar kakan sedan och märker att den nästan inte smakar något. Det var pappa som märkte det först.'),
        skriv('Vad glömde Ida att ha i kakan? Skriv ordet.', ['socker', 'sockret'],
              'Hon ställde ut mjöl, ägg, smör och mjölk, men inget socker. Sockerburken var lika full som förut.'),
        sant('Pappa blev arg och sa att kakan var dålig.', False,
             'Pappa skrattade och tog en bit till. Han sa att han gillade kakan ändå.'),
        ordna('Ordna det som händer i texten.',
              ['Ida ställer ut mjöl, ägg, smör och mjölk.', 'Kakan kommer ut ur ugnen.', 'Pappa tar en bit.',
               'Ida ser sockerburken.'],
              forklaring='Först ställer Ida ut det hon behöver. Sedan kommer kakan ut ur ugnen, pappa tar en bit och sist ser Ida sockerburken.'),
        val('Hur kan man se att pappa inte blev arg?',
            ['Han skrattade och tog en bit till', 'Han gick ut ur köket', 'Han slängde kakan'],
            'Han skrattade och tog en bit till',
            'Den som är arg skrattar inte och tar inte mer kaka. Pappa gjorde både och, och sa att han gillade kakan ändå.'),
        para('Para ihop ställena i texten med hur de var.',
             [('Huset efter en stund', 'luktade gott'), ('Kakan när Ida tog ut den', 'gyllenbrun och hög'),
              ('Kakan när Ida smakade', 'smakade nästan ingenting'), ('Sockerburken', 'full som förut')],
             'Allt står i texten: huset luktade gott, kakan var gyllenbrun, smakade nästan ingenting och sockerburken var full.'),
    ],
    beskrivning='Läs om Ida som bakar en kaka till pappa.',
    text=IDA_TEXT)

AK3_K_CK = niva(
    'sv-ak3-fler-stavning-1', 'K eller ck', 'Stavning', [
        val('Vilket ord är rätt stavat? ”Jag fick en ny … i present.”',
            ['doka', 'dokka', 'docka'], 'docka',
            'O är kort i docka, och då skrivs k-ljudet ck.'),
        val('Vilket ord är rätt stavat? ”Han tappade sin …”',
            ['nyckel', 'nykel', 'nyckkel'], 'nyckel',
            'Y är kort i nyckel, och då skrivs k-ljudet ck.'),
        val('Vilket av orden har ett långt ljud före k-ljudet?',
            ['sock', 'tack', 'bok', 'lock'], 'bok',
            'I bok är o långt, och då räcker ett k. I sock, tack och lock är vokalen kort, och då skrivs ck.'),
        skriv('Ett ord är felstavat: ”Vi åkte pulka nerför en brant bake.” Skriv ordet rätt.', 'backe',
              'A är kort i backe, och då skrivs k-ljudet ck.'),
        skriv('Ett ord är felstavat: ”Hon bär en tung ryggsäk.” Skriv ordet rätt.', 'ryggsäck',
              'Ä är kort i ryggsäck, och då skrivs k-ljudet ck.'),
        skriv('Hur många bokstäver har ordet ”tack”?', antal(len('tack')),
              'T-a-c-k. Ck är två bokstäver, men de låter som ett enda k-ljud.'),
        sant('Ck skrivs efter en kort vokal, som i ordet ”flicka”.', True,
             'I flicka är i kort, och då skrivs k-ljudet ck.'),
        sant('Ordet ”bok” skrivs med ck.', False,
             'O är långt i bok, och då räcker ett k.'),
        ordna('Bygg meningen om ryggsäcken.', 'Jag packar min ryggsäck.',
              forklaring='Jag har stor bokstav och står först. Ryggsäck har punkt och står sist.'),
    ],
    beskrivning='K-ljudet skrivs k eller ck, beroende på vokalen framför.')

AK3_SJ_TJ = niva(
    'sv-ak3-fler-stavning-2', 'Sj-ljudet och tj-ljudet', 'Stavning', [
        val('Vilket ord är rätt stavat? ”På sommaren badar vi i en …”',
            ['tjö', 'kjö', 'sjö'], 'sjö',
            'Sjö stavas med sj.'),
        val('Vilket ord är rätt stavat? ”Jag äter gröt med en …”',
            ['sked', 'tjed', 'kjed'], 'sked',
            'Före e låter sk som sj-ljudet, men ordet skrivs med sk: sked.'),
        val('Vilket ord är rätt stavat? ”Min kusin är en glad … på tolv år.”',
            ['kjej', 'tjej', 'sjej'], 'tjej',
            'Tjej stavas med tj, och tj-ljudet hör man först i ordet.'),
        skriv('Det är talet som kommer efter sex. Skriv det med bokstäver. Det börjar med sj.', ['sju', '7'],
              'Sex, sju, åtta. Sju stavas med sj.'),
        skriv('Ett ord är felstavat: ”Vi sjunger i tjyrkan.” Skriv ordet rätt.', 'kyrkan',
              'K före y låter som tj-ljudet, men ordet skrivs med k: kyrka.'),
        sant('Ordet ”sked” börjar med samma ljud som ”sjö”.', True,
             'I sked låter sk som sj-ljudet. Orden börjar likadant fast de stavas olika.'),
        sant('Ordet ”tjugo” stavas med sj.', False,
             'Tjugo stavas med tj.'),
        para('Para ihop varje ord med hur dess första ljud stavas.',
             [('sjuk', 'sj'), ('tjock', 'tj'), ('skön', 'sk'), ('kind', 'k')],
             'Sj-ljudet och tj-ljudet kan stavas på flera sätt. Orden måste man lära sig ett och ett.'),
        ordna('Bygg meningen om tjejen och skeden.', 'Tjejen äter med en sked.',
              forklaring='Tjejen har stor bokstav och står först. Sked har punkt och står sist.'),
        ordna('Bygg meningen om badet i sjön.', 'Vi badar i sjön.',
              forklaring='Vi har stor bokstav och står först. Sjön har punkt och står sist.'),
    ],
    beskrivning='Samma ljud kan stavas sj, sk, tj eller k.')


# ---------------------------------------------------------------------------
# Svenska åk 4: Fakta och berättelser (två läsförståelser) och Berättelsens delar
# ---------------------------------------------------------------------------

VULKAN_TEXT = '\n\n'.join([
    'Under jordens yta finns het, smält sten. Den kallas magma. Ibland blir trycket så stort att magman '
    'pressas upp genom en öppning i marken. Det kallas ett vulkanutbrott.',
    'När magman har kommit ut kallas den lava. Lavan är glödhet och kan flyta som en långsam, tjock flod. '
    'Efter en tid svalnar den och blir hård sten. På så sätt kan en vulkan växa och bli ett högt berg. '
    'Vid ett utbrott kan det också komma ut aska, som är små bitar av sten.',
    'Det finns många vulkaner i världen. På Island finns flera som är aktiva, alltså som kan få utbrott. '
    'I Sverige finns inga aktiva vulkaner.',
])

AK4_VULKAN = niva(
    'sv-ak4-fler-fakta-1', 'Vulkaner', 'Fakta och berättelser', [
        skriv('Vad kallas den smälta stenen under jordens yta? Skriv ordet.', 'magma',
              'Texten säger: Under jordens yta finns het, smält sten. Den kallas magma.'),
        val('Vad kallas magman när den har kommit ut ur vulkanen?',
            ['aska', 'lava', 'sten'], 'lava',
            'När magman har kommit ut kallas den lava.'),
        skriv('Vad blir lavan när den har svalnat? Skriv de två orden ur texten.', ['hård sten', 'sten'],
              'Efter en tid svalnar lavan och blir hård sten.'),
        sant('Det finns aktiva vulkaner på Island.', True,
             'Texten säger att det finns flera aktiva vulkaner på Island.'),
        sant('Det finns flera aktiva vulkaner i Sverige.', False,
             'Texten säger att det inte finns några aktiva vulkaner i Sverige.'),
        val('Hur kan en vulkan växa och bli ett högt berg?',
            ['Lava svalnar och blir hård sten gång på gång', 'Regn och vind lägger jord på den år efter år',
             'Människor bär dit sten från andra berg'],
            'Lava svalnar och blir hård sten gång på gång',
            'Det står inte rakt ut, men man kan förstå det: lavan blir hård sten, och vid nästa utbrott läggs mer lava ovanpå. Då växer berget.'),
        para('Para ihop ordet med förklaringen.',
             [('magma', 'smält sten under marken'), ('lava', 'magma som har kommit ut'),
              ('aska', 'små bitar av sten'), ('vulkanutbrott', 'när magman pressas upp genom marken')],
             'Magma finns under marken. Kommer den ut kallas den lava. Aska är små bitar av sten, och ett utbrott är när magman pressas upp.'),
        ordna('Ordna det som händer vid ett utbrott.',
              ['Trycket under marken blir stort.', 'Magman pressas upp genom en öppning.',
               'Lavan flyter ut.', 'Lavan svalnar och blir hård sten.'],
              forklaring='Först blir trycket stort, sedan pressas magman upp. När den kommit ut flyter lavan, och sist svalnar den.'),
        val('Vad betyder det att en vulkan är aktiv?',
            ['Den ligger i havet', 'Den är mycket hög', 'Den kan få utbrott'], 'Den kan få utbrott',
            'Texten förklarar det själv: aktiva, alltså som kan få utbrott.'),
    ],
    beskrivning='Läs om hur en vulkan fungerar.',
    text=VULKAN_TEXT)

SKRIDSKOR_TEXT = '\n\n'.join([
    'Hanna hade önskat sig skridskor i flera år, men ingen i familjen åkte skridsko. En dag i januari, när '
    'sjön hade frusit, ringde grannen Karin på dörren. Hon höll ett par vita skridskor som var lite gula i '
    'kanterna.',
    '– De var mina när jag var i din ålder, sa Karin. Nu står de bara i garderoben. Vill du prova?',
    'Hanna drog på sig dem och gick försiktigt ner till sjön. Första gången hon ställde sig på isen föll '
    'hon omedelbart. Andra gången klarade hon sig i fem sekunder. Efter en timme kunde hon åka hela vägen '
    'till bryggan utan att ramla.',
    'När Hanna kom hem var kinderna röda och hon skrattade fortfarande. Hon lade skridskorna mitt på '
    'hallgolvet, så att de skulle vara det första hon såg nästa dag. Sedan skrev hon en lapp: Tack, Karin! '
    'Jag lovar att åka varje dag.',
])

AK4_SKRIDSKOR = niva(
    'sv-ak4-fler-fakta-2', 'Skridskorna', 'Fakta och berättelser', [
        skriv('Vad heter Hannas granne?', 'Karin',
              'Det står att grannen Karin ringde på dörren.'),
        val('Vad hade Hanna önskat sig i flera år?',
            ['en cykel', 'en hund', 'skridskor'], 'skridskor',
            'Första meningen säger att Hanna hade önskat sig skridskor i flera år.'),
        skriv('Var åkte Hanna skridskor? Skriv ett ord.',
              ['sjön', 'på sjön', 'sjö', 'en sjö', 'på en sjö'],
              'Hanna gick ner till sjön, och efter en timme åkte hon hela vägen till bryggan.'),
        sant('Skridskorna var nya när Hanna fick dem.', False,
             'Karin hade haft dem själv när hon var barn. De var lite gula i kanterna.'),
        sant('Hanna föll första gången hon ställde sig på isen.', True,
             'Texten säger att hon föll omedelbart.'),
        val('Hur kände sig Hanna när hon kom hem?',
            ['Ledsen och besviken', 'Glad och nöjd', 'Rädd och arg'], 'Glad och nöjd',
            'Det står inte rakt ut. Men hon hade röda kinder, skrattade fortfarande och skrev ett tack till Karin. Det visar att hon var glad.'),
        val('Varför lade Hanna skridskorna mitt på hallgolvet?',
            ['Karin hade bett henne om det', 'Hon tyckte att de var smutsiga',
             'Hon ville se dem först nästa dag'],
            'Hon ville se dem först nästa dag',
            'Texten säger att de skulle vara det första hon såg nästa dag. Hon ville alltså åka igen så fort hon kunde.'),
        ordna('Ordna det som händer i texten.',
              ['Karin ringer på dörren.', 'Hanna faller på isen.', 'Hanna åker hela vägen till bryggan.',
               'Hanna skriver en lapp.'],
              forklaring='Karin kommer först. Sedan faller Hanna, sedan lär hon sig åka, och sist skriver hon lappen.'),
        para('Para ihop ordet från texten med vad det betyder.',
             [('försiktigt', 'varsamt och utan att ta risker'), ('omedelbart', 'direkt, utan att vänta'),
              ('granne', 'någon som bor nära en'), ('garderob', 'ett skåp eller ett rum för kläder')],
             'Försiktigt är varsamt, omedelbart är direkt, en granne bor nära och i en garderob förvarar man kläder.'),
    ],
    beskrivning='Läs om Hanna och de gamla skridskorna.',
    text=SKRIDSKOR_TEXT)

AK4_PERSONER = niva(
    'sv-ak4-fler-delar-1', 'Personer, plats och tid', 'Berättelsens delar', [
        skriv('Vad kallas den person som en berättelse handlar mest om? Skriv ordet.',
              ['huvudperson', 'huvudpersonen'],
              'Den som berättelsen handlar mest om kallas huvudperson.'),
        val('Berättelsen börjar så här: ”En kall vinterkväll satt Siri ensam i en liten fiskestuga vid sjön.” Var utspelar sig berättelsen?',
            ['På en båt på havet', 'I en fiskestuga vid sjön', 'I en skola i staden'],
            'I en fiskestuga vid sjön',
            'Platsen är en liten fiskestuga vid sjön.'),
        val('Berättelsen börjar så här: ”En kall vinterkväll satt Siri ensam i en liten fiskestuga vid sjön.” När utspelar sig berättelsen?',
            ['På en sommarmorgon', 'På en vinterkväll', 'På ett sommarlov'], 'På en vinterkväll',
            'Tiden är en kall vinterkväll.'),
        skriv('Platsen och tiden där en berättelse utspelar sig kallas berättelsens … Ordet börjar på m.',
              ['miljö', 'miljön'],
              'Platsen och tiden där berättelsen utspelar sig kallas miljö.'),
        skriv('”Tilda stod ensam på bryggan och tittade ut över havet. Det var tidigt på morgonen.” Vem är huvudpersonen? Skriv namnet.',
              'Tilda',
              'Berättelsen handlar om Tilda, så hon är huvudpersonen.'),
        val('Vilken text har en jag-berättare, alltså någon i berättelsen som berättar själv?',
            ['”Jag stängde dörren och lyssnade.”', '”Han stängde dörren och lyssnade.”',
             '”Dörren stängdes av vinden.”'],
            '”Jag stängde dörren och lyssnade.”',
            'I första texten berättar personen själv med ordet jag. I den andra berättar någon utanför, med ordet han.'),
        sant('Huvudpersonen är den som berättelsen handlar mest om.', True,
             'Det är just det som kallas huvudperson.'),
        sant('Miljön är samma sak som huvudpersonen.', False,
             'Miljön är platsen och tiden. Huvudpersonen är den som berättelsen handlar om.'),
        para('Para ihop varje ord om berättelser med vad det betyder.',
             [('huvudperson', 'den som berättelsen mest handlar om'), ('miljö', 'platsen och tiden där det händer'),
              ('rubrik', 'berättelsens namn överst'),
              ('jag-berättare', 'en person i berättelsen som berättar själv')],
             'Varje ord har en egen uppgift när man pratar om berättelser.'),
    ],
    beskrivning='Vem handlar berättelsen om, och var och när händer den?')

AK4_BORJAN_SLUT = niva(
    'sv-ak4-fler-delar-2', 'Början, mitt och slut', 'Berättelsens delar', [
        val('I vilken del av en berättelse får man oftast veta vilka personerna är och var det händer?',
            ['I början', 'I mitten', 'I slutet'], 'I början',
            'Berättelsen börjar med en inledning, där man får veta vilka personerna är och var det händer.'),
        val('Vilken del av en berättelse är det här? ”Efter många timmar hittade de äntligen hunden, och alla blev lättade.”',
            ['Mitten, där problemet uppstår', 'Början, där personerna presenteras',
             'Slutet, där problemet är löst'],
            'Slutet, där problemet är löst',
            'Hunden är hittad och alla är lättade. Då är problemet löst, och det brukar hända i slutet.'),
        skriv('Det som blir svårt för huvudpersonen i en berättelse kallas ett … Ordet börjar på p.',
              ['problem', 'problemet'],
              'Det som ställer till det för huvudpersonen kallas problem.'),
        skriv('Det som står överst och är berättelsens namn kallas rubrik eller … Ordet börjar på t.',
              ['titel', 'titeln'],
              'Berättelsens namn kallas rubrik eller titel.'),
        sant('Inledning betyder samma sak som början.', True,
             'Inledningen är berättelsens första del.'),
        sant('Avslutningen är den del som kommer först i en berättelse.', False,
             'Avslutningen kommer sist. Det är inledningen som kommer först.'),
        ordna('Ordna händelserna så att de blir en berättelse med början, mitt och slut.',
              ['Jonas står utanför dörren och märker att nyckeln är borta.', 'Han letar överallt utan att hitta den.',
               'Till slut hittar han nyckeln i snön.', 'Han låser upp dörren och går in.'],
              forklaring='Först märker Jonas problemet. Sedan letar han, och till slut hittar han nyckeln och kommer in.'),
        val('Läs berättelsen: ”Alva ville så gärna vinna loppet. Precis före mållinjen snubblade hon på en sten. Hon reste sig och sprang vidare. Hon kom sist, men hon log.” Vad är problemet för Alva?',
            ['Hon snubblar på en sten', 'Hon vill inte springa', 'Hon ler när hon kommer i mål'],
            'Hon snubblar på en sten',
            'Problemet är det som ställer till det. Alva snubblar precis före mållinjen.'),
        para('Para ihop delen med vad den gör i berättelsen.',
             [('Inledning', 'berättelsens början'), ('Problem', 'det som blir svårt för huvudpersonen'),
              ('Lösning', 'när problemet reds ut')],
             'Inledningen börjar berättelsen, problemet ställer till det och lösningen reder ut det.'),
    ],
    beskrivning='En berättelse har en början, en mitt och ett slut.')


# ---------------------------------------------------------------------------
# Svenska åk 5: Läsa och tolka (två läsförståelser) och Bildligt språk
# ---------------------------------------------------------------------------

FLADDERMOSS_TEXT = '\n\n'.join([
    'Fladdermöss är de enda däggdjuren som kan flyga på riktigt. Deras vingar är gjorda av tunn hud som '
    'är spänd mellan långa fingrar. På dagen vilar fladdermössen på mörka platser, till exempel i grottor, '
    'på vindar eller i håliga träd.',
    'När det blir mörkt flyger de ut för att jaga insekter. I mörkret har de ett särskilt knep för att '
    'hitta sin mat. De skickar ut korta, höga ljud som människor inte kan höra. Ljuden studsar mot saker '
    'och kommer tillbaka som ett eko. Av ekot kan fladdermusen avgöra var en mygga flyger. Det kallas '
    'ekolokalisering.',
    'På vintern finns det nästan inga insekter att äta. Då sover många fladdermöss i flera månader på en '
    'skyddad plats. Det kallas att gå i dvala.',
])

AK5_FLADDERMOSS = niva(
    'sv-ak5-fler-tolka-1', 'Fladdermöss', 'Läsa och tolka', [
        val('Vad är särskilt med fladdermöss jämfört med andra däggdjur?',
            ['De är de enda som kan flyga på riktigt', 'De är de minsta som finns', 'De är de enda som äter insekter'],
            'De är de enda som kan flyga på riktigt',
            'Texten säger att fladdermöss är de enda däggdjuren som kan flyga på riktigt.'),
        skriv('Vad är fladdermusens vingar gjorda av? Skriv de två orden ur texten.', ['tunn hud', 'hud'],
              'Vingarna är gjorda av tunn hud som är spänd mellan långa fingrar.'),
        val('Var vilar fladdermössen på dagen?',
            ['På öppna fält', 'På mörka platser', 'I vattnet'], 'På mörka platser',
            'Texten nämner grottor, vindar och håliga träd. Alla är mörka platser.'),
        skriv('Vad kallas det när fladdermusen använder ljud och eko för att hitta sin mat? Skriv ordet.',
              ['ekolokalisering', 'ekolokaliseringen'],
              'Det kallas ekolokalisering.'),
        sant('Människor kan höra ljuden som fladdermössen skickar ut.', False,
             'Texten säger att ljuden är sådana som människor inte kan höra.'),
        sant('Fladdermössen jagar insekter när det är mörkt.', True,
             'När det blir mörkt flyger de ut för att jaga insekter.'),
        ordna('Ordna hur ekolokalisering går till.',
              ['Fladdermusen skickar ut ett ljud.', 'Ljudet studsar mot en mygga.', 'Ekot kommer tillbaka.',
               'Fladdermusen vet var myggan är.'],
              forklaring='Ljudet skickas ut och studsar mot myggan. Ekot kommer tillbaka, och av ekot vet fladdermusen var myggan flyger.'),
        val('Varför sover många fladdermöss på vintern?',
            ['Det är för mörkt för att flyga', 'Det finns nästan inga insekter att äta', 'Deras vingar fryser av'],
            'Det finns nästan inga insekter att äta',
            'Texten säger inte ordet varför, men den säger att det på vintern nästan inte finns insekter. Då sover de i stället.'),
        para('Para ihop ordet med vad det betyder i texten.',
             [('vingar', 'tunn hud mellan långa fingrar'), ('eko', 'ljud som studsar tillbaka'),
              ('dvala', 'en lång sömn på vintern'), ('insekter', 'maten som fladdermössen jagar')],
             'Vingarna är av tunn hud, ett eko är ljud som kommer tillbaka, dvala är en lång vintersömn och insekterna är maten.'),
    ],
    beskrivning='Läs om fladdermöss och hur de hittar mat i mörkret.',
    text=FLADDERMOSS_TEXT)

INSANDARE_TEXT = '\n\n'.join([
    'Fler borde cykla till skolan',
    'Varje morgon står långa rader av bilar utanför vår skola. Föräldrarna vill väl, men jag tycker att '
    'fler elever borde cykla eller gå i stället.',
    'För det första blir luften bättre. Bilarna släpper ut avgaser, och de är extra dåliga för barn som '
    'står och väntar vid skolgrinden. För det andra blir man piggare. Den som har cyklat i tio minuter '
    'kommer in i klassrummet med mer energi än den som suttit still i en bil. För det tredje blir det '
    'tryggare. Med färre bilar vid grinden finns det mindre risk för olyckor.',
    'Vissa tycker att det är för långt eller för kallt. Då kan man cykla eller gå tillsammans med en '
    'kompis, för då känns vägen kortare.',
    'Därför bör skolan ordna cykelkurser och bygga fler cykelställ. Det är bra för alla.',
    'Elsa, åk 5',
])

AK5_INSANDARE = niva(
    'sv-ak5-fler-tolka-2', 'Fler borde cykla', 'Läsa och tolka', [
        val('Vad är syftet med insändaren?',
            ['Att berätta en spännande saga', 'Att övertyga läsarna om att cykla', 'Att visa hur man lagar cyklar'],
            'Att övertyga läsarna om att cykla',
            'Skribenten tycker något och försöker få andra att tycka likadant. En sådan text vill övertyga.'),
        skriv('Hur många skäl, alltså argument, ger skribenten för att fler borde cykla? Svara med en siffra.',
              antal(3),
              'Texten räknar upp dem: för det första, för det andra och för det tredje. Det är tre skäl.'),
        val('Vilken invändning från andra tar skribenten upp?',
            ['Att det är för långt eller för kallt', 'Att cyklar är för dyra', 'Att det är farligt i trafiken'],
            'Att det är för långt eller för kallt',
            'Skribenten skriver: Vissa tycker att det är för långt eller för kallt. Därefter svarar hon på det.'),
        val('Vad kan man förstå av att skribenten skriver ”Föräldrarna vill väl, men …”?',
            ['Hon förstår föräldrarna men vill ändra något', 'Hon är arg på alla föräldrar',
             'Hon vill att föräldrarna ska skjutsa fler'],
            'Hon förstår föräldrarna men vill ändra något',
            'Orden vill väl visar att hon tror att föräldrarna menar gott. Men visar att hon ändå tycker att något borde bli annorlunda.'),
        sant('Texten är skriven av en elev.', True,
             'Sist i texten står Elsa, åk 5.'),
        sant('Skribenten vill att skolan ska ta bort cykelställen.', False,
             'Hon vill tvärtom att skolan ska bygga fler cykelställ.'),
        ordna('Ordna delarna i texten så som de kommer.',
              ['Skribenten säger vad hon tycker.', 'Hon ger tre skäl.', 'Hon svarar på invändningar.',
               'Hon föreslår vad skolan ska göra.'],
              forklaring='Först kommer det skribenten tycker, sedan skälen. Därefter svarar hon på invändningar och sist kommer förslaget.'),
        val('Vilken av meningarna är en åsikt och inte ett faktapåstående?',
            ['Bilarna släpper ut avgaser.', 'Det är bra för alla.',
             'Varje morgon står det bilar utanför skolan.'],
            'Det är bra för alla.',
            'Att bilar släpper ut avgaser och att det står bilar utanför skolan går att kontrollera. Att något är bra för alla är vad skribenten tycker.'),
        skriv('Vad vill skribenten att skolan ska bygga fler av? Skriv ordet.', ['cykelställ', 'cykelställen'],
              'Hon skriver att skolan bör bygga fler cykelställ.'),
        para('Para ihop skälet med förklaringen.',
             [('Luften blir bättre', 'bilarna släpper ut avgaser'),
              ('Man blir piggare', 'man får mer energi i klassrummet'),
              ('Det blir tryggare', 'färre bilar ger mindre risk för olyckor')],
             'Varje skäl har en förklaring i texten. Förklaringen visar varför skälet stämmer.'),
    ],
    beskrivning='Läs en insändare om att cykla till skolan och se hur den försöker övertyga.',
    text=INSANDARE_TEXT)

AK5_UTTRYCK = niva(
    'sv-ak5-fler-bildligt-1', 'Uttryck med bildlig betydelse', 'Bildligt språk', [
        val('Vad betyder uttrycket ”att ha is i magen”?',
            ['Att vara kall och hungrig', 'Att vara lugn och vänta', 'Att ha ont i magen'],
            'Att vara lugn och vänta',
            'Ingen har riktig is i magen. Uttrycket betyder att man är lugn och inte skyndar sig, även när det är spännande.'),
        val('Vad betyder uttrycket ”att trampa i klaveret”?',
            ['Att spela piano högt', 'Att göra bort sig', 'Att gå i en lerpöl'], 'Att göra bort sig',
            'Uttrycket är bildligt. Den som trampar i klaveret säger eller gör något olämpligt och gör bort sig.'),
        val('Vilken mening använder uttrycket ”få kalla fötter” bildligt?',
            ['Dan hade glömt sina strumpor och fick kalla fötter ute på isen.',
             'Plötsligt fick Dan kalla fötter och vågade inte hoppa från tiometern.',
             'Dan satte sig vid brasan för att värma sina kalla fötter.'],
            'Plötsligt fick Dan kalla fötter och vågade inte hoppa från tiometern.',
            'Bildligt betyder få kalla fötter att man blir rädd och tvekar. I de andra meningarna är fötterna riktigt kalla.'),
        skriv('Vilket ord saknas? Att gå som katten kring het …', 'gröt',
              'Uttrycket betyder att man undviker att komma till saken, som en katt som inte vågar ta i den heta gröten.'),
        skriv('Vilket ord saknas? Att ha många … i elden.', 'järn',
              'Uttrycket betyder att man har många saker på gång på en gång.'),
        sant('Ett uttryck som ”ha is i magen” betyder något annat än vad orden säger.', True,
             'Det är bildligt språk. Betydelsen är att man är lugn, inte att man har is i magen.'),
        sant('Uttrycket ”hålla tummarna” betyder att man håller hårt i sina tummar.', False,
             'Uttrycket betyder att man hoppas att det ska gå bra för någon.'),
        para('Para ihop varje uttryck med det det betyder.',
             [('ta sig vatten över huvudet', 'ta på sig mer än man klarar'),
              ('sätta myror i huvudet på någon', 'göra någon orolig'),
              ('vara ute och cykla', 'ha fel'),
              ('fatta galoppen', 'förstå vad det handlar om')],
             'Uttryck betyder ofta något helt annat än orden var för sig.'),
        ordna('Bygg uttrycket.', 'Slå två flugor i en smäll.',
              forklaring='Uttrycket betyder att man klarar av två saker på en gång.'),
    ],
    beskrivning='Uttryck som betyder något annat än orden säger.')

AK5_LIKNELSER = niva(
    'sv-ak5-fler-bildligt-2', 'Liknelser och personifikation', 'Bildligt språk', [
        val('Vilken mening innehåller en liknelse?',
            ['Björnen sov i sitt ide.', 'Hon var stark som en björn.', 'Hon lyfte en stor sten.'],
            'Hon var stark som en björn.',
            'En liknelse jämför två saker, ofta med ordet som. Här jämförs hon med en björn.'),
        val('Vilken mening är en personifikation, där något som inte är en människa gör som en människa?',
            ['Solen värmer stenen.', 'Det är varmt i dag.', 'Solen log mot oss.'], 'Solen log mot oss.',
            'Bara människor ler. Här får solen en mänsklig egenskap, och det kallas personifikation.'),
        skriv('Vad kallas det när man jämför två saker med ordet ”som”? Ordet börjar på l.',
              ['liknelse', 'liknelsen'],
              'Att jämföra två saker med som kallas liknelse, till exempel vit som snö.'),
        skriv('Vilket litet ord visar att det är en liknelse? ”Hennes röst var len som sammet.”', 'som',
              'Ordet som jämför rösten med sammet. Det är en liknelse.'),
        val('Vad menas med ”Hennes skratt var som musik i mina öron”?',
            ['Hon spelade musik högt', 'Skrattet lät mycket fint', 'Hennes öron var stora'],
            'Skrattet lät mycket fint',
            'Skrattet jämförs med musik, som många tycker är vacker. Det betyder att skrattet lät fint.'),
        sant('I meningen ”Bilen stod och väntade tålmodigt” får bilen en mänsklig egenskap.', True,
             'Bara människor kan vara tålmodiga. Därför är det en personifikation.'),
        sant('Meningen ”Han var stark som en björn” är en personifikation.', False,
             'Det är en liknelse, för den jämför med ordet som. I en personifikation gör en sak som en människa.'),
        para('Para ihop meningen med vad den är.',
             [('Snön var vit som socker.', 'liknelse'), ('Skogen sov under snön.', 'personifikation'),
              ('Det snöade hela natten.', 'rak beskrivning')],
             'Som socker jämför, så det är en liknelse. Skogen kan inte sova, så den får en mänsklig egenskap. Den sista meningen säger bara som det är.'),
        ordna('Bygg liknelsen.', 'Hennes ögon var blå som havet.',
              forklaring='Hennes har stor bokstav och står först. Ordet som kommer före havet, och jämförelsen är klar.'),
    ],
    beskrivning='Bilder i språket: jämförelser med som, och saker som beter sig som människor.')


TILLAGG = [
    bana('Svenska', 'ak1', [AK1_FORSTA_LJUDET, AK1_BYGG_ORD, AK1_STOR_BOKSTAV]),
    bana('Svenska', 'ak2', [AK2_DUBBLA, AK2_BESKRIV, AK2_AMIR]),
    bana('Svenska', 'ak3', [AK3_REGN, AK3_IDA, AK3_K_CK, AK3_SJ_TJ]),
    bana('Svenska', 'ak4', [AK4_VULKAN, AK4_SKRIDSKOR, AK4_PERSONER, AK4_BORJAN_SLUT]),
    bana('Svenska', 'ak5', [AK5_FLADDERMOSS, AK5_INSANDARE, AK5_UTTRYCK, AK5_LIKNELSER]),
]
