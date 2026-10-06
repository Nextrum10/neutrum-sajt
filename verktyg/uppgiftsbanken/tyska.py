# -*- coding: utf-8 -*-
"""Tyska åk 7 och åk 9 (2026-10-06): moderna språk i NexLäx, en bana per
språk (NX.NEXLAX_AMNEN).

Åk 7 är nybörjaren: hälsa och presentera sig, talen 0–20 och åldern,
familjen med der, die, das, ein och mein, verben sein och haben,
regelbundna verb i presens och ordföljden med verbet på andra plats.
Åk 9 har läst tyska i två till tre år: mat och att beställa, klockan och
vardagen, staden och vägbeskrivningar (es gibt, dativ efter mit, zu och
neben), modalverben med infinitiven sist och perfekt med haben och sein.
Modalverben står före perfekt: de har färre former, och ordföljden med
ett verb sist är samma som participet sedan får.

Skrivet från grunden mot Lgr22:s kursplan i moderna språk: vardagliga
situationer, personer, platser och aktiviteter, fasta uttryck och
artighetsfraser, och den grammatik som behövs för att säga det. Inget är
hämtat ur läromedel eller prov. Frågorna ställs på svenska och det som
övas är på tyska, som i Duolingo: para ihop ord (tyska till vänster),
bygg meningar av brickor, välj rätt form, skriv ett ord, och sant eller
falskt om språket. Förklaringarna är på svenska.

FACIT RÄKNAS HÄR där det går. Talen, klockslagen, verbformerna och
participen står i tabeller och funktioner nedan, med assert mot de
vanliga felen (sechszehn, siebenzehn, du heißst), och frågorna hämtar
sina former därifrån.

SKRIV-FRÅGORNA godtar rätt stavning först, för den visas som facit, och
sedan samma ord med ae, oe, ue och ss och utan prickar (fünf, fuenf,
funf; heißt, heisst). En variant som själv är en annan form i tabellerna
godtas inte: godtas() stryker den (ihr müsst utan prickar är du musst).
Rättningen bryr sig inte om stor bokstav, så stor bokstav frågas bara i
val och sant.

ORDNA-FRÅGORNA har en enda rätt ordning. Första brickan har stor bokstav
och den sista punkt eller frågetecken, och ingen mening har ett adverb
eller tidsuttryck som också kunde stå någon annanstans.

FÖRENKLAT, med flit:
- Perfekt med sein lärs som verb för förflyttning och förändring (fahren,
  gehen, kommen, fliegen, aufstehen) och sein och bleiben. Att fahren tar
  haben med ett objekt (ich habe das Auto gefahren) och att man i södra
  Tyskland och Österrike säger ich bin gesessen tas inte upp, och ingen
  fråga har en sådan mening.
- Klockan lärs med Viertel nach och Viertel vor. Det regionala viertel
  neun (8:15) och dreiviertel neun (8:45) tas inte upp.
- Dativ bara efter mit och zu, och efter neben och gegenüber när det
  gäller var något är. Ackusativ bara som einen och kein efter haben,
  möchte och es gibt.
- Ich habe Hunger lärs som sättet att säga att man är hungrig. Ich bin
  hungrig är också rätt tyska och står aldrig som ett fel alternativ.
- Lördag godtas som Samstag och Sonnabend.
"""
from grund import bana, niva, val, skriv, ordna, sant, para

TYSKA = 'Tyska'

# ---------------------------------------------------------------------------
# Talen 0–20, på tyska och svenska. Räknefrågorna och klockan hämtar
# sina ord härifrån.
TAL = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
       'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn',
       'neunzehn', 'zwanzig']
SV_TAL = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio',
          'elva', 'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton',
          'nitton', 'tjugo']
assert len(TAL) == len(SV_TAL) == 21
# 13–19 är entalet och zehn, men sechs och sieben kortas: sechzehn och
# siebzehn, aldrig sechszehn eller siebenzehn.
for _n in range(13, 20):
    assert TAL[_n] == {6: 'sech', 7: 'sieb'}.get(_n - 10, TAL[_n - 10]) + 'zehn'
assert TAL[16] != 'sechszehn' and TAL[17] != 'siebenzehn'

DAGAR = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

# ---------------------------------------------------------------------------
# Verben i presens, som dict med ich, du, er (er, sie, es), wir, ihr och
# sie (sie som betyder de, och Sie).


def presens(infinitiv):
    """Ett regelbundet verb i presens. En stam på t eller d får ett e före
    ändelsen (es kostet), och en stam på s, ß eller z får bara -t efter du
    (du heißt, inte du heißst)."""
    stam = infinitiv[:-2]
    e = 'e' if stam[-1] in 'td' else ''
    du = 't' if stam[-1] in 'sßz' else 'st'
    return dict(ich=stam + 'e', du=stam + e + du, er=stam + e + 't', wir=infinitiv,
                ihr=stam + e + 't', sie=infinitiv)


assert presens('spielen') == dict(ich='spiele', du='spielst', er='spielt', wir='spielen',
                                  ihr='spielt', sie='spielen')
assert presens('heißen')['du'] == 'heißt' and presens('kosten')['er'] == 'kostet'

SEIN = dict(ich='bin', du='bist', er='ist', wir='sind', ihr='seid', sie='sind')
HABEN = dict(ich='habe', du='hast', er='hat', wir='haben', ihr='habt', sie='haben')
# essen byter e mot i efter du och er: du isst, er isst, men ihr esst.
ESSEN = dict(presens('essen'), du='isst', er='isst')
assert ESSEN['ich'] == 'esse' and ESSEN['ihr'] == 'esst'
KONNEN = dict(ich='kann', du='kannst', er='kann', wir='können', ihr='könnt', sie='können')
MUSSEN = dict(ich='muss', du='musst', er='muss', wir='müssen', ihr='müsst', sie='müssen')
WOLLEN = dict(ich='will', du='willst', er='will', wir='wollen', ihr='wollt', sie='wollen')
MOCHTE = dict(ich='möchte', du='möchtest', er='möchte', wir='möchten', ihr='möchtet', sie='möchten')
for _m in (KONNEN, MUSSEN, WOLLEN, MOCHTE):
    # Ingen ändelse efter ich och er, och du är ich-formen med -st (bara -t
    # efter s, som i du heißt: du musst).
    assert _m['ich'] == _m['er'] and _m['wir'] == _m['sie']
    assert _m['du'] == _m['ich'] + ('t' if _m['ich'].endswith('s') else 'st')
for _m in (KONNEN, MUSSEN, WOLLEN):
    assert _m['ihr'] == _m['wir'][:-2] + 't'

# ---------------------------------------------------------------------------
# Perfekt. Regelbundna verb får ge- och -t; resten står i tabellen.


def regelbundet_particip(infinitiv):
    stam = infinitiv[:-2]
    return 'ge' + stam + ('et' if stam[-1] in 'td' else 't')


PARTICIP_UNDANTAG = {
    'trinken': 'getrunken', 'sehen': 'gesehen', 'lesen': 'gelesen', 'backen': 'gebacken',
    'gehen': 'gegangen', 'fahren': 'gefahren', 'kommen': 'gekommen', 'fliegen': 'geflogen',
    'bleiben': 'geblieben', 'sein': 'gewesen', 'aufstehen': 'aufgestanden',
    # Förstavelsen be- tar bort ge-.
    'besuchen': 'besucht',
}
# Verben som bildar perfekt med sein: förflyttning, förändring, sein och bleiben.
MED_SEIN = {'gehen', 'fahren', 'kommen', 'fliegen', 'bleiben', 'sein', 'aufstehen'}


def particip(infinitiv):
    return PARTICIP_UNDANTAG.get(infinitiv) or regelbundet_particip(infinitiv)


def hjalpverb(infinitiv):
    return SEIN if infinitiv in MED_SEIN else HABEN


assert particip('spielen') == 'gespielt' and particip('kaufen') == 'gekauft'
assert particip('machen') == 'gemacht' and regelbundet_particip('arbeiten') == 'gearbeitet'
assert particip('besuchen') != regelbundet_particip('besuchen')

# ---------------------------------------------------------------------------
# Klockan.


def klockslag(h, m):
    return '%d:%02d' % (h, m)


def uhrzeit(h, m):
    """Klockslaget som man säger det på tyska, med tolvtimmarsklocka. Halb
    och vor räknar mot nästa timme, som på svenska: halb neun är 8:30."""
    nasta = h % 12 + 1
    if m == 0:
        return ('ein' if h == 1 else TAL[h]) + ' Uhr'
    if m == 15:
        return 'Viertel nach ' + TAL[h]
    if m == 30:
        return 'halb ' + TAL[nasta]
    if m == 45:
        return 'Viertel vor ' + TAL[nasta]
    if m in (5, 10):
        return '%s nach %s' % (TAL[m], TAL[h])
    if m == 25:
        return 'fünf vor halb ' + TAL[nasta]
    if m == 35:
        return 'fünf nach halb ' + TAL[nasta]
    if m in (50, 55):
        return '%s vor %s' % (TAL[60 - m], TAL[nasta])
    raise ValueError('%s sägs inte så här' % klockslag(h, m))


assert uhrzeit(8, 30) == 'halb neun' and uhrzeit(12, 30) == 'halb eins' and uhrzeit(1, 0) == 'ein Uhr'
assert uhrzeit(6, 45) == 'Viertel vor sieben' and uhrzeit(7, 25) == 'fünf vor halb acht'
assert uhrzeit(8, 10) == 'zehn nach acht'

# ---------------------------------------------------------------------------
# Vad en skriv-fråga godtar.

FORMER = {f.lower() for tabell in (SEIN, HABEN, ESSEN, KONNEN, MUSSEN, WOLLEN, MOCHTE)
          for f in tabell.values()}
FORMER |= {f.lower() for v in ('spielen', 'wohnen', 'lernen', 'machen', 'hören', 'heißen',
                               'kommen', 'trinken', 'kosten', 'beginnen')
           for f in presens(v).values()}
FORMER |= {t.lower() for t in TAL} | {p.lower() for p in PARTICIP_UNDANTAG.values()}

MED_E = (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('Ä', 'Ae'), ('Ö', 'Oe'), ('Ü', 'Ue'), ('ß', 'ss'))
UTAN_PRICKAR = (('ä', 'a'), ('ö', 'o'), ('ü', 'u'), ('Ä', 'A'), ('Ö', 'O'), ('Ü', 'U'), ('ß', 'ss'))


def _byt(ord_, byten):
    for fran, till in byten:
        ord_ = ord_.replace(fran, till)
    return ord_


def godtas(*ratta):
    """Svaren en skriv-fråga godtar. Rätt stavning först, för den visas som
    facit, sedan samma ord med ae, oe, ue och ss och utan prickar (fünf,
    fuenf, funf). En variant som själv är en annan form i tabellerna här
    stryks: müsst utan prickar är musst, och det är du-formen."""
    ut = []
    for r in ratta:
        for v in (r, _byt(r, MED_E), _byt(r, UTAN_PRICKAR)):
            if v not in ut and (v == r or v.lower() not in FORMER):
                ut.append(v)
    return ut


assert godtas('fünf') == ['fünf', 'fuenf', 'funf'] and godtas('heißt') == ['heißt', 'heisst']
assert 'musst' not in godtas('müsst')

# ---------------------------------------------------------------------------
# Frågor som byggs ur tabellerna.


def rakna(a, tecken, b):
    """En räknefråga med tyska tal. Svaret räknas här och skrivs med TAL."""
    svar = a + b if tecken == '+' else a - b
    assert 0 <= svar <= 20
    return skriv('Räkna och skriv svaret med bokstäver på tyska: %s %s %s'
                 % (TAL[a], 'plus' if tecken == '+' else 'minus', TAL[b]),
                 godtas(TAL[svar]),
                 '%s är %d och %s är %d. %d %s %d = %d, och %s heter %s.'
                 % (TAL[a].capitalize(), a, TAL[b], b, a, '+' if tecken == '+' else '−', b, svar,
                    SV_TAL[svar], TAL[svar]))


def i_storleksordning(tal_):
    """Talen sorteras här. Två lika tal hade gett två rätta ordningar."""
    assert len(set(tal_)) == len(tal_)
    ordnade = sorted(tal_)
    delar = ['%s är %d' % (TAL[n], n) for n in ordnade]
    forklaring = ', '.join(delar[:-1]) + ' och ' + delar[-1] + '.'
    return ordna('Ordna talen från minst till störst.', [TAL[n] for n in ordnade],
                 forklaring=forklaring[0].upper() + forklaring[1:])


def vilket_klockslag(fraga, h, m, fel, forklaring):
    """En valfråga om ett klockslag. Det tyska uttrycket sätts in i frågan
    (%s), och inget av de felaktiga klockslagen sägs likadant."""
    uttryck = uhrzeit(h, m)
    assert all(uhrzeit(fh, fm) != uttryck for fh, fm in fel)
    return val(fraga % uttryck, [klockslag(h, m)] + [klockslag(fh, fm) for fh, fm in fel],
               klockslag(h, m), forklaring)


def valj_hjalpverb(mening, person, infinitiv, fel_person, forklaring):
    """Välj haben eller sein i perfekt. Rätt form räknas ur MED_SEIN och
    participet ur tabellen (%s i meningen). Det andra hjälpverbet i samma
    person är alltid ett alternativ, och fel_person är två former som hör
    till en annan person."""
    ratt = hjalpverb(infinitiv)[person]
    andra = HABEN[person] if ratt == SEIN[person] else SEIN[person]
    assert ratt not in fel_person and andra not in fel_person
    return val('Välj rätt hjälpverb: ' + mening % particip(infinitiv), [ratt, andra] + fel_person, ratt,
               forklaring)


BANOR = [
    # =====================================================================
    # Åk 7: nybörjaren
    # =====================================================================
    bana(TYSKA, 'ak7', [
        niva('de-ak7-hallo-1', 'Hallo och tschüss', 'Hälsa och presentera dig', [
            para('Para ihop den tyska hälsningen med den svenska.',
                 [('Hallo', 'hej'), ('Guten Morgen', 'god morgon'), ('Guten Abend', 'god kväll'),
                  ('Gute Nacht', 'god natt'), ('Tschüss', 'hej då')],
                 'Morgen betyder morgon, Abend kväll och Nacht natt. Hallo säger man när man kommer '
                 'och Tschüss när man går.'),
            val("Vad betyder 'Guten Tag'?", ['god dag', 'god natt', 'god morgon', 'hej då'], 'god dag',
                'Tag betyder dag. Guten Tag är en artig hälsning mitt på dagen, ungefär som goddag.'),
            val('Det är kväll och du kommer till en fest. Vad säger du när du kommer in?',
                ['Guten Abend', 'Gute Nacht', 'Guten Morgen', 'Tschüss'], 'Guten Abend',
                'Guten Abend säger man när man träffas på kvällen. Gute Nacht säger man när man skiljs '
                'åt sent eller ska sova.'),
            sant("'Tschüss' säger man när man skiljs åt.", True,
                 'Tschüss betyder hej då. När man träffas säger man i stället Hallo eller Guten Tag.'),
            val("Vad betyder 'Wie geht's?'", ['Hur mår du?', 'Vad heter du?', 'Var bor du?', 'Hur gammal är du?'],
                'Hur mår du?',
                "Wie betyder hur, och geht's är en kort form av geht es. Ordagrant frågar man: hur går det?"),
            val("Någon frågar 'Wie geht's?'. Vilket svar betyder att du mår bra?",
                ['Gut, danke.', 'Nicht so gut.', 'Es geht.', 'Schlecht.'], 'Gut, danke.',
                'Gut betyder bra och danke betyder tack. Nicht so gut är inte så bra, och schlecht är dåligt.'),
            sant("Svaret 'Es geht' betyder att man mår jättebra.", False,
                 'Es geht betyder ungefär sådär, varken bra eller dåligt. Jättebra heter sehr gut.'),
            ordna('Bygg frågan: Hur mår du?', ['Wie', 'geht', 'es', 'dir?'],
                  forklaring="Ordagrant: hur går det för dig? Wie geht's? är samma fråga i kort form."),
            skriv("Skriv det tyska ordet för 'natt'.", godtas('Nacht', 'die Nacht'),
                  'Natt heter Nacht, med ch som i acht. Gute Nacht betyder god natt.'),
            val("Vad betyder 'Auf Wiedersehen'?", ['adjö', 'välkommen', 'god morgon', 'ursäkta'], 'adjö',
                'Wiedersehen betyder att ses igen. Auf Wiedersehen är ett artigare hej då än Tschüss.'),
        ], beskrivning='Att hälsa, säga hej då och fråga hur någon mår.'),

        niva('de-ak7-hallo-2', 'Ich heiße …', 'Hälsa och presentera dig', [
            val("Vad betyder 'Ich heiße Lina'?",
                ['Jag heter Lina.', 'Du heter Lina.', 'Hon heter Lina.', 'Jag bor hos Lina.'], 'Jag heter Lina.',
                'Ich betyder jag, och heiße kommer från heißen, som betyder heta.'),
            skriv('Skriv ordet som saknas: Wie ___ du? (Vad heter du?)', godtas(presens('heißen')['du']),
                  'Till du hör ändelsen -st, men stammen heiß slutar redan på ß. Därför blir det bara -t: '
                  'du heißt.'),
            ordna('Bygg meningen: Jag heter Jonas.', ['Ich', presens('heißen')['ich'], 'Jonas.'], extra=['heißen'],
                  forklaring='Till ich hör ändelsen -e: ich heiße. Heißen är grundformen, den som står i ordboken.'),
            val('Hur frågar du var någon kommer ifrån?',
                ['Woher kommst du?', 'Wo wohnst du?', 'Wie alt bist du?', 'Was machst du?'], 'Woher kommst du?',
                'Woher betyder varifrån, och kommst kommer från kommen, komma.'),
            val("Vad betyder 'Wo wohnst du?'", ['Var bor du?', 'Varifrån kommer du?', 'Vad heter du?', 'Hur mår du?'],
                'Var bor du?', 'Wo betyder var och wohnst kommer från wohnen, bo. Varifrån heter woher.'),
            sant("'Österreich' är det tyska namnet på Österrike.", True,
                 'Österreich betyder ordagrant östra riket, och Österrike är bildat på samma sätt. '
                 'Där talar man tyska.'),
            para('Para ihop det tyska ordet med det svenska.',
                 [('Danke', 'tack'), ('Bitte', 'snälla, varsågod'), ('Entschuldigung', 'ursäkta'),
                  ('Freut mich', 'trevligt att träffas')],
                 'Bitte säger man både när man ber om något och när man ger något. Freut mich säger man '
                 'när man träffar någon ny.'),
            val('Du pratar med en vuxen som du inte känner. Hur frågar du artigt vad hen heter?',
                ['Wie heißen Sie?', 'Wie heißt du?', 'Wie heißt du denn?', 'Wie heißt ihr?'], 'Wie heißen Sie?',
                'Till vuxna man inte känner säger man Sie, med stor bokstav. Till Sie hör ändelsen -en: heißen.'),
            skriv('Skriv ordet som saknas: Ich ___ aus Schweden. (Jag kommer från Sverige.)',
                  godtas(presens('kommen')['ich']),
                  'Kommen betyder komma. Till ich hör ändelsen -e: ich komme.'),
            ordna('Bygg meningen: Jag bor i Stockholm.', ['Ich', presens('wohnen')['ich'], 'in', 'Stockholm.'],
                  extra=['aus'],
                  forklaring='Wohnen betyder bo och in betyder i. Aus betyder från och passar inte här.'),
        ], beskrivning='Att säga vad du heter, var du kommer ifrån och var du bor, och att fråga någon annan.'),

        niva('de-ak7-siffror-1', 'Från null till zwölf', 'Siffror och ålder', [
            para('Para ihop talet på tyska med siffran.', [(TAL[n], str(n)) for n in (1, 3, 7, 9, 11)],
                 'Många tyska tal liknar de svenska: drei – tre, neun – nio och elf – elva. '
                 'Eins är ett och sieben sju.'),
            val('Vilket tyskt tal är 8?', ['acht', 'elf', 'sechs', 'neun'], TAL[8],
                'Åtta heter acht. Med -zehn efter blir det achtzehn, 18.'),
            skriv('Skriv talet 5 med bokstäver på tyska.', godtas(TAL[5]),
                  'Fem heter fünf. Har du ingen ü-tangent kan du skriva ue: fuenf.'),
            val("Vilket tal är 'zwei'?", ['2', '3', '10', '12'], str(TAL.index('zwei')),
                'Zwei betyder två. Z uttalas ts och w uttalas v, så det låter ungefär tsvaj.'),
            sant("'Sechs' betyder sju.", False, 'Sechs betyder sex. Sju heter sieben.'),
            rakna(4, '+', 5),
            i_storleksordning([10, 2, 6, 4]),
            val('Vad heter 0 på tyska?', ['null', 'nein', 'nicht', 'neun'], TAL[0],
                'Noll heter null. Nein betyder nej, nicht betyder inte och neun är nio.'),
            rakna(10, '-', 3),
            skriv('Skriv talet 12 med bokstäver på tyska.', godtas(TAL[12]),
                  'Tolv heter zwölf, med ö. Zw uttalas tsv, så det låter ungefär tsvölf.'),
        ], beskrivning='Talen 0–12 på tyska: att känna igen dem, skriva dem och räkna med dem.'),

        niva('de-ak7-siffror-2', 'Wie alt bist du?', 'Siffror och ålder', [
            para('Para ihop talet på tyska med siffran.', [(TAL[n], str(n)) for n in (11, 13, 15, 19)],
                 'Elf har ett eget namn, precis som elva. Från 13 är talen entalet och zehn: dreizehn är '
                 'tre och tio, och neunzehn nio och tio.'),
            val('Hur skriver man 16 på tyska?', [TAL[16], 'sechszehn', 'sechzig'], TAL[16],
                'Sechs är 6, men i sechzehn faller s:et bort. Sechzig är 60.'),
            sant("17 skrivs 'siebenzehn' på tyska.", TAL[17] == 'siebenzehn',
                 'Det heter siebzehn. Sieben tappar -en när det sätts ihop med zehn.'),
            skriv('Skriv talet 20 med bokstäver på tyska.', godtas(TAL[20]),
                  'Tjugo heter zwanzig. Det börjar med zw, som zwei, för 20 är två tior.'),
            val("Hur gammal är den som säger 'Ich bin %s Jahre alt'?" % TAL[14], ['14 år', '4 år', '40 år', '24 år'],
                '%d år' % TAL.index('vierzehn'),
                'Vierzehn är vier (4) och zehn (10), alltså 14. Vierzig hade varit 40.'),
            ordna('Bygg meningen: Jag är tretton år gammal.', ['Ich', SEIN['ich'], TAL[13], 'Jahre', 'alt.'],
                  extra=[HABEN['ich']],
                  forklaring='Åldern säger man med bin (är), inte habe (har), precis som på svenska. '
                             'Alt betyder gammal och står sist.'),
            val('Välj rätt ord: Ich bin fünfzehn ___ alt.', ['Jahre', 'Jahr', 'Jahren'], 'Jahre',
                'Jahr betyder år. När det är fler än ett år blir det Jahre: fünfzehn Jahre.'),
            val('Hur frågar du hur gammal någon är?',
                ['Wie alt bist du?', 'Wie heißt du?', 'Wie geht es dir?', 'Wo wohnst du?'], 'Wie alt bist du?',
                'Alt betyder gammal, och wie alt betyder hur gammal. Bist kommer från sein, vara.'),
            rakna(12, '+', 6),
        ], beskrivning='Talen 13–20 och att säga hur gammal du är.'),

        niva('de-ak7-familj-1', 'Der, die, das', 'Familjen och artiklarna', [
            para('Para ihop det tyska ordet med det svenska.',
                 [('Mutter', 'mamma'), ('Vater', 'pappa'), ('Kind', 'barn'), ('Oma', 'mormor, farmor'),
                  ('Opa', 'morfar, farfar')],
                 'Mutter och Vater liknar mor och far. Oma och Opa säger man om mor- och farföräldrar, '
                 'och Kind betyder barn.'),
            val("Vilken artikel har 'Mutter'?", ['die', 'der', 'das'], 'die',
                'Mutter är en kvinna, och ord för kvinnor i familjen har oftast die: die Mutter, die Oma.'),
            val("Vilken artikel har 'Kind' (barn)?", ['das', 'der', 'die'], 'das',
                'Kind är ett das-ord: das Kind. Ett knep för att minnas det: ett barn kan vara både pojke '
                'och flicka, och das är varken han eller hon.'),
            sant("Det heter 'das Mädchen', fast ordet betyder flicka.", True,
                 'Mädchen är bildat med ändelsen -chen, som gör ett ord litet, och sådana ord är alltid '
                 'das-ord.'),
            val('Välj rätt artikel: ___ Hund ist groß.', ['Der', 'Die', 'Das'], 'Der',
                'Hund är ett der-ord: der Hund. Artikeln syns inte på ordet, så lär dig den tillsammans '
                'med ordet.'),
            val("Vad betyder 'Eltern'?", ['föräldrar', 'syskon', 'kusiner', 'farföräldrar'], 'föräldrar',
                'Eltern betyder föräldrar. Det är ett pluralord, och i plural heter artikeln alltid die: '
                'die Eltern.'),
            skriv("Skriv det tyska ordet för 'bror'. Skriv bara ordet, utan artikel.",
                  godtas('Bruder', 'der Bruder'),
                  'Bror heter Bruder, och det är ett der-ord: der Bruder.'),
            sant('På tyska skrivs alla substantiv med stor bokstav, till exempel der Hund och die Katze.', True,
                 'Alla substantiv har stor bokstav på tyska, var de än står i meningen. Det hjälper dig '
                 'att se vilka ord som är substantiv.'),
            val('Vilket ord är ett die-ord?', ['Tante', 'Onkel', 'Vater', 'Kind'], 'Tante',
                'Tante betyder faster eller moster, och ord för kvinnor i familjen har oftast die. Onkel och '
                'Vater är der-ord och Kind ett das-ord.'),
            ordna('Bygg meningen: Katten är liten.', ['Die', 'Katze', SEIN['er'], 'klein.'], extra=['Der'],
                  forklaring='Katze är ett die-ord: die Katze. Klein betyder liten, och verbet ist står '
                             'på andra plats.'),
        ], beskrivning='Ord för familjen, och att varje substantiv har der, die eller das.'),

        niva('de-ak7-familj-2', 'Mein Bruder, meine Schwester', 'Familjen och artiklarna', [
            val('Välj rätt ord: Das ist ___ Katze.', ['eine', 'ein', 'einen'], 'eine',
                'Katze är ett die-ord. Till die-ord heter en eine: eine Katze.'),
            val('Välj rätt ord: Das ist ___ Pferd.', ['ein', 'eine', 'einen'], 'ein',
                'Pferd (häst) är ett das-ord. Till der- och das-ord heter en ein: ein Pferd.'),
            para('Para ihop djuret på tyska med det svenska ordet.',
                 [('Katze', 'katt'), ('Pferd', 'häst'), ('Vogel', 'fågel'), ('Kaninchen', 'kanin'),
                  ('Maus', 'mus')],
                 'Vogel liknar fågel, Kaninchen kanin och Maus mus. Pferd betyder häst och Katze katt.'),
            sant("'Ein' och 'eine' betyder båda en eller ett.", True,
                 'Ein används till der- och das-ord och eine till die-ord. Båda motsvarar svenskans '
                 'en och ett.'),
            ordna('Bygg meningen: Min mamma heter Karin.', ['Meine', 'Mutter', presens('heißen')['er'], 'Karin.'],
                  extra=['Mein'],
                  forklaring='Mutter är ett die-ord, och då blir min till meine. Verbet heißt står på andra '
                             'plats, efter meine Mutter.'),
            val('Välj rätt ord: Das ist ___ Vater.', ['mein', 'meine', 'meinen'], 'mein',
                'Vater är ett der-ord. Till der- och das-ord säger man mein, utan e.'),
            skriv('Skriv ordet som saknas: Ist das ___ Bruder? (Är det din bror?)', godtas('dein'),
                  'Din heter dein, och det böjs som mein: dein Bruder, deine Schwester.'),
            val("Vad betyder 'meine Geschwister'?", ['mina syskon', 'mina föräldrar', 'mina kusiner',
                                                    'mina farföräldrar'], 'mina syskon',
                'Geschwister betyder syskon. Det är plural, och i plural blir min till meine.'),
            sant("Man säger 'mein Hund' men 'meine Katze'.", True,
                 'Hund är ett der-ord och får mein. Katze är ett die-ord och får meine.'),
            val('Välj rätt ord: Das sind ___ Großeltern.', ['meine', 'mein', 'meinen'], 'meine',
                'Großeltern (mor- och farföräldrar) är plural, och i plural heter min meine.'),
        ], beskrivning='Ein och eine, mein och meine, och ord för husdjur.'),

        niva('de-ak7-sein-haben-1', 'Ich bin, du bist', 'Verben sein och haben', [
            para('Para ihop det tyska pronomenet med det svenska.',
                 [('ich', 'jag'), ('er', 'han'), ('sie', 'hon'), ('wir', 'vi'), ('ihr', 'ni')],
                 'Er betyder han och sie hon. Ihr är ni när man pratar med flera som man säger du till.'),
            val('Välj rätt form av sein: Ich ___ müde.', [SEIN['ich'], SEIN['du'], SEIN['er'], SEIN['wir']],
                SEIN['ich'], 'Till ich hör bin: ich bin, jag är. Müde betyder trött.'),
            val('Välj rätt form av sein: Das Haus ___ groß.', [SEIN['er'], SEIN['du'], SEIN['wir'], SEIN['ihr']],
                SEIN['er'], 'Das Haus kan bytas mot es (det), och till er, sie och es hör ist.'),
            skriv('Skriv rätt form av sein: ___ du müde? (Är du trött?)', godtas(SEIN['du'].capitalize()),
                  'Till du hör bist. I en ja- eller nej-fråga står verbet först: Bist du müde?'),
            val('Välj rätt form av sein: Ihr ___ sehr nett.', [SEIN['ihr'], SEIN['wir'], 'seit', SEIN['er']],
                SEIN['ihr'], 'Ihr betyder ni, och till ihr hör seid, med d på slutet. Nett betyder snäll.'),
            sant("'Wir sind' betyder 'vi är'.", SEIN['wir'] == 'sind',
                 'Wir betyder vi, och till wir hör sind.'),
            ordna('Bygg meningen: Hon är min syster.', ['Sie', SEIN['er'], 'meine', 'Schwester.'],
                  extra=[SEIN['sie']],
                  forklaring='Sie betyder hon här, och till sie (hon) hör ist. Sind hör till wir och till sie '
                             'när det betyder de.'),
            val('Välj rätt form av sein: Meine Eltern ___ zu Hause.', [SEIN['sie'], SEIN['er'], SEIN['ihr'], SEIN['ich']],
                SEIN['sie'], 'Meine Eltern kan bytas mot sie (de), och till sie (de) hör sind. Zu Hause betyder hemma.'),
            skriv('Skriv rätt form av sein: Er ___ zwölf Jahre alt.', godtas(SEIN['er']),
                  'Till er (han), sie (hon) och es (den, det) hör ist.'),
            sant("'Seid' och 'seit' är två former av verbet sein.", False,
                 'Seid hör till ihr: ihr seid. Seit, med t, är ett annat ord som betyder sedan.'),
        ], beskrivning='Verbet sein (vara) i presens, med pronomenen ich, du, er, sie, wir och ihr.'),

        niva('de-ak7-sein-haben-2', 'Ich habe, du hast', 'Verben sein och haben', [
            para('Para ihop den tyska meningen med den svenska.',
                 [('Ich habe Hunger.', 'Jag är hungrig.'), ('Ich habe Durst.', 'Jag är törstig.'),
                  ('Ich habe Angst.', 'Jag är rädd.'), ('Ich habe Zeit.', 'Jag har tid.')],
                 'På tyska har man hunger, törst och rädsla: Hunger, Durst och Angst. På svenska är man '
                 'hungrig, törstig och rädd.'),
            val('Välj rätt form av haben: Du ___ einen Hund.', [HABEN['du'], HABEN['ich'], HABEN['er'], HABEN['ihr']],
                HABEN['du'], 'Till du hör hast. B:et i haben faller bort före -st.'),
            val('Välj rätt form av haben: Mein Bruder ___ ein Fahrrad.',
                [HABEN['er'], HABEN['du'], HABEN['ihr'], HABEN['wir']], HABEN['er'],
                'Mein Bruder kan bytas mot er (han), och till er hör hat.'),
            skriv('Skriv rätt form av haben: Wir ___ heute Deutsch.', godtas(HABEN['wir']),
                  'Till wir hör samma form som grundformen: wir haben.'),
            sant("'Ihr habt' betyder 'ni har'.", HABEN['ihr'] == 'habt',
                 'Ihr betyder ni, och till ihr hör ändelsen -t: ihr habt.'),
            val('Välj rätt ord: Ich habe ___ Schwester.', ['eine', 'einen', 'ein'], 'eine',
                'Schwester är ett die-ord, och eine ändras inte efter haben: Ich habe eine Schwester.'),
            ordna('Bygg meningen: Jag har en bror.', ['Ich', HABEN['ich'], 'einen', 'Bruder.'], extra=['ein'],
                  forklaring='Efter haben blir ein till einen framför der-ord: der Bruder, men ich habe einen '
                             'Bruder.'),
            ordna('Bygg frågan: Har du syskon?', [HABEN['du'].capitalize(), 'du', 'Geschwister?'],
                  extra=[HABEN['er'].capitalize()],
                  forklaring='I en ja- eller nej-fråga står verbet först, precis som på svenska. Till du hör hast.'),
            skriv('Skriv rätt form av haben: Sie ___ eine Katze. (Hon har en katt.)', godtas(HABEN['er']),
                  'Sie betyder hon här, och till sie (hon) hör hat.'),
            sant("I 'du hast' och 'er hat' har b:et i haben fallit bort.", True,
                 'Haben tappar b:et efter du och er, sie, es: du hast, er hat. Alla andra former har kvar det.'),
        ], beskrivning='Verbet haben (ha) i presens, och fasta uttryck som Ich habe Hunger.'),

        niva('de-ak7-fritid-1', 'Ich spiele, du spielst', 'Skolan och fritiden', [
            para('Para ihop det tyska verbet med det svenska.',
                 [('spielen', 'spela'), ('wohnen', 'bo'), ('lernen', 'lära sig'), ('hören', 'höra, lyssna'),
                  ('machen', 'göra')],
                 'Spielen liknar spela, lernen lära och hören höra. Wohnen betyder bo och machen göra.'),
            val('Välj rätt form av spielen: Ich ___ Fußball.',
                [presens('spielen')[p] for p in ('ich', 'du', 'er', 'wir')], presens('spielen')['ich'],
                'Till ich hör ändelsen -e: ich spiele. Spielst hör till du och spielt till er, sie och es.'),
            val('Välj rätt form av wohnen: Du ___ in Berlin.',
                [presens('wohnen')[p] for p in ('du', 'ich', 'er', 'wir')], presens('wohnen')['du'],
                'Till du hör ändelsen -st: du wohnst, du bor.'),
            skriv('Skriv rätt form av lernen: Er ___ Deutsch.', godtas(presens('lernen')['er']),
                  'Till er, sie och es hör ändelsen -t: er lernt.'),
            skriv('Skriv rätt form av machen: Wir ___ Hausaufgaben.', godtas(presens('machen')['wir']),
                  'Till wir hör ändelsen -en, och det är samma form som grundformen: wir machen.'),
            sant("Verbet 'spielen' har samma form efter 'wir' som efter 'sie' när sie betyder de.",
                 presens('spielen')['wir'] == presens('spielen')['sie'],
                 'Efter wir, sie (de) och Sie har verbet samma form som i ordboken: wir spielen, sie spielen.'),
            ordna('Bygg meningen: Vi spelar fotboll.', ['Wir', presens('spielen')['wir'], 'Fußball.'],
                  extra=[presens('spielen')['er']],
                  forklaring='Till wir hör ändelsen -en: wir spielen. Fußball har stor bokstav, för det är '
                             'ett substantiv.'),
            val('Välj rätt form av hören: Ihr ___ gern Musik.',
                [presens('hören')[p] for p in ('ihr', 'wir', 'du', 'ich')], presens('hören')['ihr'],
                'Till ihr hör ändelsen -t: ihr hört. Det betyder ni lyssnar gärna på musik.'),
            para('Para ihop skolämnet på tyska med det svenska.',
                 [('Mathe', 'matte'), ('Kunst', 'bild'), ('Sport', 'idrott'), ('Erdkunde', 'geografi'),
                  ('Geschichte', 'historia')],
                 'Kunst betyder konst, och i skolan motsvarar det bild. Erdkunde är läran om jorden, och '
                 'Geschichte betyder både historia och berättelse.'),
            val("Vad betyder 'Ich lerne Deutsch'?",
                ['Jag lär mig tyska.', 'Jag lär ut tyska.', 'Jag förstår tyska.', 'Jag gillar tyska.'],
                'Jag lär mig tyska.',
                'Lernen betyder lära sig. Lära ut heter lehren, och förstå heter verstehen.'),
        ], beskrivning='Regelbundna verb i presens, som spielen, wohnen och lernen, och skolans ämnen.'),

        niva('de-ak7-fritid-2', 'Heute spiele ich Fußball', 'Skolan och fritiden', [
            ordna('Bygg meningen: I dag spelar jag fotboll.', ['Heute', presens('spielen')['ich'], 'ich', 'Fußball.'],
                  forklaring='Verbet står på andra plats, precis som på svenska: Heute spiele ich, i dag '
                             'spelar jag.'),
            val('Vilken mening har rätt ordföljd?',
                ['Am Montag lerne ich Deutsch.', 'Am Montag ich lerne Deutsch.', 'Am Montag lerne Deutsch ich.',
                 'Am Montag Deutsch ich lerne.'], 'Am Montag lerne ich Deutsch.',
                'Am Montag är första ledet, och verbet lerne ska stå direkt efter, på andra plats. Sedan kommer ich.'),
            ordna('Bygg meningen: Efter skolan spelar jag gitarr.',
                  ['Nach', 'der', 'Schule', presens('spielen')['ich'], 'ich', 'Gitarre.'],
                  forklaring='Nach der Schule är första ledet, och verbet spiele kommer direkt efter, på andra '
                             'plats. Sedan kommer ich.'),
            sant("I meningen 'Am Abend höre ich Musik' står verbet på andra plats.", True,
                 'Am Abend är första ledet och höre står på andra plats, före ich. Så är det också på svenska: '
                 'På kvällen lyssnar jag på musik.'),
            val("Vad betyder 'Was machst du am Wochenende?'",
                ['Vad gör du på helgen?', 'Vad gjorde du i helgen?', 'Vem träffar du på helgen?',
                 'Var bor du på helgen?'], 'Vad gör du på helgen?',
                'Was betyder vad, machst kommer från machen (göra) och Wochenende betyder helg. '
                'Machst är presens, så det är inte gjorde.'),
            skriv('Skriv rätt form av spielen: Am Samstag ___ wir Tennis.', godtas(presens('spielen')['wir']),
                  'Till wir hör ändelsen -en: wir spielen. Verbet står på andra plats, före wir.'),
            ordna('Bygg frågan: Spelar du fotboll?', [presens('spielen')['du'].capitalize(), 'du', 'Fußball?'],
                  extra=[presens('spielen')['er'].capitalize()],
                  forklaring='I en ja- eller nej-fråga står verbet först. Till du hör -st: Spielst du?'),
            ordna('Bygg frågan: När börjar skolan?', ['Wann', presens('beginnen')['er'], 'die', 'Schule?'],
                  forklaring='Frågeordet wann (när) står först och verbet beginnt på andra plats, som på svenska.'),
            para('Para ihop frågeordet med det svenska.',
                 [('was', 'vad'), ('wo', 'var'), ('wer', 'vem'), ('wie', 'hur'), ('woher', 'varifrån')],
                 'Akta dig för wer: det ser ut som var men betyder vem. Var heter wo.'),
            val("Vad betyder 'Hausaufgaben'?", ['läxor', 'hemkunskap', 'husdjur', 'rast'], 'läxor',
                'Haus betyder hus eller hem och Aufgaben uppgifter: uppgifter man gör hemma.'),
        ], beskrivning='Ordföljden: verbet står på andra plats, också när meningen börjar med något annat '
                       'än subjektet.'),
    ]),

    # =====================================================================
    # Åk 9: två till tre år av tyska
    # =====================================================================
    bana(TYSKA, 'ak9', [
        niva('de-ak9-mat-1', 'Brot, Käse und Wurst', 'Mat och att beställa', [
            para('Para ihop det tyska ordet med det svenska.',
                 [('das Brot', 'bröd'), ('der Käse', 'ost'), ('die Wurst', 'korv'), ('das Hähnchen', 'kyckling'),
                  ('der Apfel', 'äpple')],
                 'Brot liknar bröd och Apfel äpple. Käse betyder ost, Wurst korv och Hähnchen kyckling.'),
            val("Vad betyder 'das Frühstück'?", ['frukost', 'lunch', 'middag', 'mellanmål'], 'frukost',
                'Früh betyder tidig. Frühstück är dagens första mål, som man äter tidigt.'),
            sant("'Ich esse gern Fisch' betyder att man tycker om att äta fisk.", True,
                 'Gern efter verbet betyder att man tycker om att göra det. Ordagrant: jag äter gärna fisk.'),
            val('Välj rätt form av essen: Er ___ gern Pizza.', [ESSEN['er'], ESSEN['ihr'], ESSEN['ich'], ESSEN['wir']],
                ESSEN['er'], 'Essen byter e mot i efter du och er, sie, es: du isst, er isst. Ich esse har kvar e.'),
            skriv("Skriv det tyska ordet för 'mjölk'. Skriv bara ordet, utan artikel.", godtas('Milch', 'die Milch'),
                  'Mjölk heter Milch, och det är ett die-ord: die Milch.'),
            val("Vad betyder 'Ich bin satt'?", ['Jag är mätt.', 'Jag är trött.', 'Jag är hungrig.', 'Jag är sur.'],
                'Jag är mätt.',
                'Satt betyder mätt. Det har inget med att sitta att göra, fast det ser ut som svenskans satt.'),
            ordna('Bygg meningen: Jag dricker gärna te.', ['Ich', presens('trinken')['ich'], 'gern', 'Tee.'],
                  forklaring='Gern står efter verbet: Ich trinke gern Tee. Ordagrant: jag dricker gärna te.'),
            val('Vilket ord passar inte in bland de andra?', ['die Gabel', 'der Apfel', 'die Banane', 'die Orange'],
                'die Gabel', 'Gabel betyder gaffel. De andra är frukter: äpple, banan och apelsin.'),
            skriv('Skriv rätt form av trinken: Du ___ Wasser.', godtas(presens('trinken')['du']),
                  'Trinken är regelbundet i presens. Till du hör ändelsen -st: du trinkst.'),
            val('Välj rätt artikel: ___ Kuchen ist lecker.', ['Der', 'Die', 'Das'], 'Der',
                'Kuchen (kaka) är ett der-ord: der Kuchen. Lecker betyder gott.'),
        ], beskrivning='Ord för mat och dryck, och att säga vad du gärna äter och dricker.'),

        niva('de-ak9-mat-2', 'Ich hätte gern …', 'Mat och att beställa', [
            val("Vad betyder 'Ich möchte einen Kaffee'?",
                ['Jag skulle vilja ha en kaffe.', 'Jag skulle vilja koka kaffe.', 'Jag har just druckit en kaffe.',
                 'Jag tycker mycket om kaffe.'], 'Jag skulle vilja ha en kaffe.',
                'Möchte betyder skulle vilja, och det är ett artigt sätt att beställa: Ich möchte einen Kaffee.'),
            val('Välj rätt form: Er ___ ein Eis.', [MOCHTE['er'], MOCHTE['du'], MOCHTE['ihr'], MOCHTE['wir']],
                MOCHTE['er'], 'Möchte har ingen ändelse efter er, sie och es: er möchte, precis som ich möchte.'),
            ordna('Bygg meningen: Jag skulle vilja ha en glass.', ['Ich', 'hätte', 'gern', 'ein', 'Eis.'],
                  forklaring='Ich hätte gern betyder ungefär jag skulle gärna vilja ha. Eis är ett das-ord, '
                             'så det blir ein Eis.'),
            val('Välj rätt ord: Ich möchte ___ Apfelsaft.', ['einen', 'ein', 'eine', 'einem'], 'einen',
                'Apfelsaft är ett der-ord, för Saft är det: der Saft. Efter möchte blir ein till einen '
                'framför der-ord.'),
            sant("'Die Rechnung, bitte' säger man när man vill betala.", True,
                 'Rechnung betyder nota eller räkning. Man kan också säga Zahlen, bitte (betala, tack).'),
            para('Para ihop det tyska uttrycket med det svenska.',
                 [('Was darf es sein?', 'Vad får det lov att vara?'), ('Zum Mitnehmen.', 'Att ta med.'),
                  ('Das macht fünf Euro.', 'Det blir fem euro.'), ('Guten Appetit!', 'Smaklig måltid!')],
                 'Was darf es sein? frågar den som serverar. Zum Mitnehmen betyder att man tar med maten, '
                 'och Das macht säger vad det kostar.'),
            val('Välj rätt form: Was ___ ihr essen?', [MOCHTE['ihr'], MOCHTE['du'], MOCHTE['er'], MOCHTE['wir']],
                MOCHTE['ihr'], 'Till ihr hör ändelsen -t: ihr möchtet. Essen står sist, för efter möchte '
                               'kommer infinitiven sist.'),
            skriv('Skriv ordet som saknas: Was ___ ein Eis? (Vad kostar en glass?)', godtas(presens('kosten')['er']),
                  'Kosten betyder kosta. Stammen slutar på t, så det kommer ett e före ändelsen: es kostet.'),
            val('Du vill betala på ett kafé. Vad säger du till den som serverar?',
                ['Zahlen, bitte!', 'Zählen, bitte!', 'Guten Appetit!'], 'Zahlen, bitte!',
                'Zahlen betyder betala. Zählen, med ä, betyder räkna, som när man räknar till tio.'),
            ordna('Bygg frågan: Vad skulle du vilja äta?', ['Was', MOCHTE['du'], 'du', 'essen?'],
                  forklaring='Möchtest står på andra plats och infinitiven essen sist. På svenska står äta '
                             'direkt efter vilja, men på tyska hamnar det sist.'),
        ], beskrivning='Att beställa på ett kafé med Ich möchte och Ich hätte gern, och att fråga vad det kostar.'),

        niva('de-ak9-klockan-1', 'Wie spät ist es?', 'Vardagen och klockan', [
            vilket_klockslag("Vad är klockan om någon säger 'Es ist %s'?", 8, 30, [(9, 30), (9, 0), (8, 0)],
                             'Halb neun betyder halv nio: en halvtimme kvar till nio. Det fungerar precis som '
                             'på svenska.'),
            skriv('Skriv ordet som saknas: Es ist zehn ___ acht. (Klockan är tio över åtta.)', godtas('nach'),
                  'Nach betyder efter, och i klockan betyder det över: zehn nach acht är 8:10.'),
            para('Para ihop tiden på tyska med klockslaget.',
                 [(uhrzeit(h, m), klockslag(h, m)) for h, m in ((3, 15), (2, 45), (2, 30), (3, 0))],
                 'Nach betyder över och vor betyder i (före): Viertel nach drei är kvart över tre och '
                 'Viertel vor drei kvart i tre.'),
            val('Hur säger man att klockan är 1:00?',
                ['Es ist %s.' % uhrzeit(1, 0), 'Es ist eins Uhr.', 'Es ist eine Uhr.'], 'Es ist %s.' % uhrzeit(1, 0),
                'Före Uhr heter det ein: ein Uhr. Utan Uhr säger man eins: Es ist eins.'),
            val("Vad betyder '%s'?" % uhrzeit(6, 45), ['kvart i sju', 'kvart över sju', 'kvart i åtta',
                                                       'kvart över sex'], 'kvart i sju',
                'Vor betyder före, alltså kvart före sju: 6:45. Kvart över heter Viertel nach.'),
            sant("'Halb vier' betyder att klockan är 4:30.", uhrzeit(4, 30) == 'halb vier',
                 'Halb vier betyder halv fyra, en halvtimme kvar till fyra. Klockan är alltså 3:30.'),
            ordna('Bygg frågan: Hur mycket är klockan?', ['Wie', 'spät', 'ist', 'es?'],
                  forklaring='Spät betyder sen, så ordagrant frågar man: hur sent är det? Man kan också '
                             'fråga Wie viel Uhr ist es?'),
            ordna('Bygg meningen: Skolan börjar klockan åtta.',
                  ['Die', 'Schule', presens('beginnen')['er'], 'um', TAL[8], 'Uhr.'],
                  forklaring='Um ... Uhr säger när något händer: um acht Uhr är klockan åtta. Verbet beginnt '
                             'står på andra plats, efter die Schule.'),
            vilket_klockslag("Vilket klockslag är '%s'?", 2, 15, [(1, 45), (2, 45), (1, 15)],
                             'Viertel nach zwei betyder kvart över två, alltså 2:15. Kvart i två hade varit '
                             'Viertel vor zwei.'),
            vilket_klockslag("Vilket klockslag är '%s'?", 7, 25, [(7, 35), (8, 25), (6, 55)],
                             'Halb acht är 7:30, och fünf vor halb acht är fem minuter före: 7:25. Det är som '
                             'fem i halv åtta på svenska.'),
        ], beskrivning='Klockan på tyska: hel och halv timme, kvart över och kvart i.'),

        niva('de-ak9-klockan-2', 'Mein Tag', 'Vardagen och klockan', [
            ordna('Ordna veckodagarna, med måndag först.', DAGAR[:4],
                  forklaring='Montag är måndag, Dienstag tisdag, Mittwoch onsdag och Donnerstag torsdag. '
                             'Mittwoch betyder mitten av veckan.'),
            val("Vilken dag är 'Sonntag'?", ['söndag', 'lördag', 'måndag', 'fredag'], 'söndag',
                'Sonntag är solens dag, för Sonne betyder sol. Söndag betyder också solens dag.'),
            para('Para ihop det tyska ordet med det svenska.',
                 [('Freitag', 'fredag'), ('der Morgen', 'morgonen'), ('der Abend', 'kvällen'),
                  ('das Wochenende', 'helgen')],
                 'Freitag liknar fredag, och Wochenende betyder ordagrant veckans slut. Morgen är morgon '
                 'och Abend kväll.'),
            val("Vad betyder 'Wann beginnt die Schule?'",
                ['När börjar skolan?', 'Var ligger skolan?', 'Hur går det i skolan?', 'Vem börjar i skolan?'],
                'När börjar skolan?', 'Wann betyder när, och beginnt kommer från beginnen, börja.'),
            ordna('Bygg meningen: Jag går upp klockan sju.', ['Ich', 'stehe', 'um', 'sieben', 'Uhr', 'auf.'],
                  forklaring='Aufstehen betyder gå upp, och det delas i två: stehe står på andra plats och '
                             'auf hamnar sist i meningen.'),
            sant("'Am Montag' betyder 'på måndag'.", True,
                 'Före en veckodag säger man am: am Montag, am Freitag. Am är an och dem ihopdraget.'),
            skriv('Skriv ordet som saknas: Ich gehe um zehn Uhr ins ___. (Jag går och lägger mig klockan tio.)',
                  godtas('Bett'),
                  'Ins Bett gehen betyder gå och lägga sig, ordagrant gå in i sängen. Bett betyder säng.'),
            val('Vilken mening har rätt ordföljd?',
                ['Um sieben Uhr frühstücke ich.', 'Um sieben Uhr ich frühstücke.', 'Ich um sieben Uhr frühstücke.',
                 'Um sieben Uhr frühstücken ich.'], 'Um sieben Uhr frühstücke ich.',
                'Um sieben Uhr är första ledet, och verbet ska stå på andra plats: frühstücke, sedan ich.'),
            val("Vad betyder 'Ich fahre mit dem Bus zur Schule'?",
                ['Jag åker buss till skolan.', 'Jag går till skolan.', 'Jag åker buss från skolan.',
                 'Jag cyklar till skolan.'], 'Jag åker buss till skolan.',
                'Fahren betyder åka och mit dem Bus med bussen. Zur Schule betyder till skolan; från heter von.'),
            skriv("Skriv det tyska ordet för 'lördag'.",
                  godtas(DAGAR[5], 'Sonnabend', 'der ' + DAGAR[5], 'der Sonnabend'),
                  'Lördag heter Samstag. I norra Tyskland säger många Sonnabend, och det godtas också.'),
        ], beskrivning='Veckodagarna och en vanlig dag: när du går upp, äter och går till skolan.'),

        niva('de-ak9-staden-1', 'Es gibt ein Kino', 'Staden och vägbeskrivning', [
            para('Para ihop platsen på tyska med den svenska.',
                 [('der Bahnhof', 'stationen'), ('das Kino', 'bion'), ('die Apotheke', 'apoteket'),
                  ('das Rathaus', 'stadshuset'), ('die Haltestelle', 'hållplatsen')],
                 'Bahnhof är stationen där tågen går, och Rathaus liknar svenskans rådhus. Haltestelle är '
                 'bildat som hållplats: halten (stanna) och Stelle (plats).'),
            val("Vad betyder 'In meiner Stadt gibt es einen Park'?",
                ['I min stad finns det en park.', 'I min stad bygger de en ny park.',
                 'I min stad finns det ingen park.', 'Min stad ligger mitt i en park.'],
                'I min stad finns det en park.',
                'Es gibt betyder det finns. Ordagrant står det det ger, men det används som svenskans det finns.'),
            val('Välj rätt ord: Es gibt ___ Bahnhof in der Stadt.', ['einen', 'ein', 'eine', 'einem'], 'einen',
                'Efter es gibt blir ein till einen framför der-ord: der Bahnhof, men es gibt einen Bahnhof.'),
            sant("'Die Bank' kan betyda både bank och bänk.", True,
                 'Die Bank är både banken där man har sina pengar och en bänk att sitta på. Sammanhanget '
                 'visar vilket det är.'),
            skriv("Skriv det tyska ordet för 'kyrka'. Skriv bara ordet, utan artikel.", godtas('Kirche', 'die Kirche'),
                  'Kyrka heter Kirche. Det är ett die-ord: die Kirche.'),
            val("Vad betyder 'das Krankenhaus'?", ['sjukhuset', 'apoteket', 'vårdcentralen', 'badhuset'],
                'sjukhuset', 'Krank betyder sjuk, så Krankenhaus är ordagrant sjukhus.'),
            ordna('Bygg frågan: Finns det en bank här?', ['Gibt', 'es', 'hier', 'eine', 'Bank?'],
                  forklaring='I en ja- eller nej-fråga står verbet först: Gibt es ...? Bank är ett die-ord, '
                             'så det blir eine Bank.'),
            val('Välj rätt ord: Es gibt ___ Kino in meinem Dorf. (Det finns ingen bio i min by.)',
                ['kein', 'keine', 'keinen', 'nicht'], 'kein',
                'Ingen heter kein. Kino är ett das-ord, och då heter det kein, utan ändelse.'),
            skriv("Skriv det tyska ordet för 'gata'. Skriv bara ordet, utan artikel.", godtas('Straße', 'die Straße'),
                  'Gata heter Straße, med ß. Har du ingen ß-tangent kan du skriva ss: Strasse.'),
            val('Hur frågar du var bion ligger?',
                ['Wo ist das Kino?', 'Wer ist das Kino?', 'Wie ist das Kino?', 'Was ist das Kino?'],
                'Wo ist das Kino?', 'Wo betyder var. Wer betyder vem, wie hur och was vad.'),
        ], beskrivning='Platser i staden, och att säga vad som finns med es gibt.'),

        niva('de-ak9-staden-2', 'Links, rechts, geradeaus', 'Staden och vägbeskrivning', [
            para('Para ihop det tyska ordet med det svenska.',
                 [('links', 'till vänster'), ('rechts', 'till höger'), ('neben', 'bredvid'), ('hinter', 'bakom'),
                  ('zwischen', 'mellan')],
                 'Akta dig för links: det betyder vänster, inte länkar. Neben betyder bredvid, hinter bakom '
                 'och zwischen mellan.'),
            val("Vad betyder 'Wie komme ich zum Bahnhof?'",
                ['Hur kommer jag till stationen?', 'Hur långt är det till stationen?', 'När går tåget från stationen?',
                 'Var ligger stationen någonstans?'], 'Hur kommer jag till stationen?',
                'Wie komme ich betyder hur kommer jag, och zum betyder till. Zum är zu och dem ihopdraget.'),
            val('Välj rätt ord: Ich fahre mit ___ Bus.', ['dem', 'der', 'den', 'das'], 'dem',
                'Mit tar alltid dativ. Bus är ett der-ord, och i dativ blir der till dem: mit dem Bus.'),
            val('Välj rätt ord: Wir fahren mit ___ U-Bahn.', ['der', 'die', 'dem', 'den'], 'der',
                'U-Bahn (tunnelbana) är ett die-ord. Efter mit blir die till der: mit der U-Bahn.'),
            sant("Efter 'mit' blir 'das Fahrrad' till 'dem Fahrrad'.", True,
                 'Mit tar alltid dativ, och i dativ blir både der och das till dem: mit dem Fahrrad, med cykeln.'),
            val('Välj rätt ord: Wie komme ich ___ Post?', ['zur', 'zum', 'zu die', 'zu das'], 'zur',
                'Zu tar alltid dativ, och die Post blir der Post. Zu och der dras ihop till zur.'),
            skriv('Skriv ordet som saknas: Gehen Sie immer ___! (Gå rakt fram hela tiden!)', godtas('geradeaus'),
                  'Geradeaus betyder rakt fram. Gerade betyder rak.'),
            ordna('Bygg meningen: Banken ligger bredvid bion.', ['Die', 'Bank', SEIN['er'], 'neben', 'dem', 'Kino.'],
                  extra=['das'],
                  forklaring='När det gäller var något är tar neben dativ, och das Kino blir dem Kino.'),
            val("Vad betyder 'Die Apotheke ist gegenüber der Kirche'?",
                ['Apoteket ligger mittemot kyrkan.', 'Apoteket ligger bakom kyrkan.',
                 'Apoteket ligger bredvid kyrkan.', 'Apoteket ligger långt från kyrkan.'],
                'Apoteket ligger mittemot kyrkan.',
                'Gegenüber betyder mittemot. Bakom heter hinter och bredvid heter neben.'),
            ordna('Bygg meningen: Ta första gatan till vänster.',
                  ['Nehmen', 'Sie', 'die', 'erste', 'Straße', 'links.'],
                  forklaring='I en artig uppmaning står verbet först och Sie efter: Nehmen Sie ... Links står sist.'),
        ], beskrivning='Att fråga om vägen och förstå svaret, med dativ efter mit, zu och neben.'),

        niva('de-ak9-modalverb-1', 'Ich kann, ich muss, ich will', 'Modala verb', [
            para('Para ihop det tyska verbet med det svenska.',
                 [('können', 'kunna'), ('müssen', 'måste'), ('wollen', 'vilja'), ('möchten', 'skulle vilja')],
                 'Können liknar kunna och wollen liknar vilja. Müssen betyder måste, och möchte är det '
                 'artiga skulle vilja.'),
            val('Välj rätt form av können: Ich ___ gut schwimmen.',
                [KONNEN['ich'], KONNEN['du'], KONNEN['wir'], KONNEN['ihr']], KONNEN['ich'],
                'Till ich hör kann, utan ändelse. Modalverben har samma form efter ich och er.'),
            val('Välj rätt form av müssen: Er ___ heute arbeiten.',
                [MUSSEN['er'], MUSSEN['du'], MUSSEN['wir'], MUSSEN['ihr']], MUSSEN['er'],
                'Modalverben har ingen ändelse efter er, sie och es: er muss, precis som ich muss.'),
            skriv('Skriv rätt form av wollen: Du ___ ins Kino gehen.', godtas(WOLLEN['du']),
                  'Wollen byter o mot i efter ich, du och er: ich will, du willst, er will. Till du hör -st.'),
            sant("'Ich will' betyder 'jag vill'.", True,
                 'Will kommer från wollen, vilja. Det betyder inte ska, som engelskans will.'),
            val('Välj rätt form av müssen: Ihr ___ jetzt nach Hause gehen.',
                [MUSSEN['ihr'], MUSSEN['wir'], MUSSEN['du'], MUSSEN['ich']], MUSSEN['ihr'],
                'Till ihr hör ändelsen -t: ihr müsst. Musst, utan ü, är formen för du.'),
            val("Vad betyder 'Du musst nicht kommen'?",
                ['Du behöver inte komma.', 'Du får inte lov att komma.', 'Du har inte lust att komma.',
                 'Du kan inte komma.'], 'Du behöver inte komma.',
                'Nicht müssen betyder behöva inte. Får inte heter nicht dürfen: Du darfst nicht kommen.'),
            ordna('Bygg meningen: Jag kan spela gitarr.', ['Ich', KONNEN['ich'], 'Gitarre', 'spielen.'],
                  forklaring='Efter ett modalverb står infinitiven sist: Ich kann Gitarre spielen. På svenska '
                             'står spela direkt efter kan.'),
            skriv('Skriv rätt form av können: ___ du mir helfen? (Kan du hjälpa mig?)',
                  godtas(KONNEN['du'].capitalize()),
                  'Till du hör kannst. I en ja- eller nej-fråga står kannst först och infinitiven helfen sist.'),
            val('Välj rätt form av wollen: Meine Freunde ___ Pizza essen.',
                [WOLLEN['sie'], WOLLEN['ich'], WOLLEN['du'], WOLLEN['ihr']], WOLLEN['sie'],
                'Meine Freunde kan bytas mot sie (de), och till sie hör wollen, med o.'),
        ], beskrivning='Modalverben können, müssen och wollen i presens.'),

        niva('de-ak9-modalverb-2', 'Infinitiven sist', 'Modala verb', [
            ordna('Bygg meningen: Vi måste göra läxorna.', ['Wir', MUSSEN['wir'], 'die', 'Hausaufgaben', 'machen.'],
                  forklaring='Müssen står på andra plats och infinitiven machen sist. Mellan dem står resten '
                             'av meningen.'),
            ordna('Bygg meningen: I morgon vill jag gå på bio.', ['Morgen', WOLLEN['ich'], 'ich', 'ins', 'Kino', 'gehen.'],
                  forklaring='Morgen står först, så will kommer på andra plats och sedan ich. Infinitiven gehen '
                             'hamnar sist.'),
            val('Vilken mening har rätt ordföljd?',
                ['Ich kann sehr gut tanzen.', 'Ich kann tanzen sehr gut.', 'Ich sehr gut kann tanzen.',
                 'Ich tanzen kann sehr gut.'], 'Ich kann sehr gut tanzen.',
                'Kann står på andra plats och infinitiven tanzen sist. Sehr gut står mellan dem.'),
            sant("I meningen 'Ich muss heute lernen' står infinitiven sist.", True,
                 'Lernen är infinitiven och står sist, efter heute. Modalverbet muss står på andra plats.'),
            val('Välj ordet som saknas: Wir wollen am Samstag Fußball ___.',
                ['spielen', 'spielt', particip('spielen'), 'spiele'], 'spielen',
                'Efter ett modalverb står verbet i infinitiv, alltså grundformen: spielen.'),
            skriv('Skriv rätt form av müssen: Du ___ heute dein Zimmer aufräumen. (Du måste städa ditt rum i dag.)',
                  godtas(MUSSEN['du']),
                  'Till du hör musst, utan ü. Ü:et finns bara i plural: wir müssen, ihr müsst, sie müssen.'),
            ordna('Bygg frågan: Kan du komma i morgon?', [KONNEN['du'].capitalize(), 'du', 'morgen', 'kommen?'],
                  forklaring='I en ja- eller nej-fråga står modalverbet först, och infinitiven kommen står sist.'),
            val("Vad betyder 'Ich will Ärztin werden'?",
                ['Jag vill bli läkare.', 'Jag kan bli läkare.', 'Jag vill träffa en läkare.', 'Jag har blivit läkare.'],
                'Jag vill bli läkare.',
                'Will kommer från wollen, vilja, och werden betyder bli. Ärztin är en kvinnlig läkare.'),
            para('Para ihop den tyska meningen med den svenska.',
                 [('Ich muss gehen.', 'Jag måste gå.'), ('Ich kann nicht kommen.', 'Jag kan inte komma.'),
                  ('Willst du mitkommen?', 'Vill du följa med?'), ('Wir müssen warten.', 'Vi måste vänta.')],
                 'Infinitiven står sist i alla fyra: gehen, kommen, mitkommen och warten. Nicht står före '
                 'infinitiven.'),
            skriv('Skriv verbet som saknas sist: Ich muss heute Deutsch ___. (Jag måste plugga tyska i dag.)',
                  godtas('lernen', 'üben', 'pauken'),
                  'Plugga heter lernen. Efter muss står det i infinitiv och sist i meningen.'),
        ], beskrivning='Meningar med modalverb: modalverbet på andra plats och infinitiven sist.'),

        niva('de-ak9-perfekt-1', 'Ich habe gespielt', 'Perfekt med haben och sein', [
            para('Para ihop den tyska meningen med den svenska.',
                 [('Ich habe %s.' % particip('spielen'), 'Jag har spelat.'),
                  ('Ich habe %s.' % particip('wohnen'), 'Jag har bott.'),
                  ('Ich habe %s.' % particip('lernen'), 'Jag har lärt mig.'),
                  ('Ich habe %s.' % particip('hören'), 'Jag har hört.')],
                 'Regelbundna verb får ge- före och -t efter stammen: spielen blir gespielt och wohnen gewohnt.'),
            val("Vad är participet av 'machen'?", [particip('machen'), 'gemachen', 'machte', 'gemachtet'],
                particip('machen'),
                'Machen är regelbundet: ge- före stammen mach och -t efter, gemacht. Machte är preteritum.'),
            val('Välj rätt particip: Ich habe Wasser ___.', [particip('trinken'), 'getrinkt', 'getrankt', 'getrinken'],
                particip('trinken'),
                'Trinken är oregelbundet. Participet slutar på -en och vokalen blir u: getrunken.'),
            ordna('Bygg meningen: Jag har spelat fotboll.', ['Ich', HABEN['ich'], 'Fußball', particip('spielen') + '.'],
                  forklaring='Habe står på andra plats och participet gespielt sist. På svenska står spelat '
                             'direkt efter har.'),
            sant("I meningen 'Ich habe gestern Tennis gespielt' står participet sist.", True,
                 'Gespielt är participet och står sist, efter gestern och Tennis. Habe står på andra plats.'),
            skriv("Skriv participet av 'kaufen' (köpa).", godtas(particip('kaufen')),
                  'Kaufen är regelbundet: ge- före stammen kauf och -t efter, gekauft.'),
            val("Vad betyder 'Wir haben einen Film gesehen'?",
                ['Vi har sett en film.', 'Vi ska se en film.', 'Vi ser en film.', 'Vi har gjort en film.'],
                'Vi har sett en film.',
                'Haben ... gesehen är perfekt av sehen, se. På svenska står sett direkt efter har, men på '
                'tyska står gesehen sist.'),
            ordna('Bygg meningen: I går läste jag en bok.',
                  ['Gestern', HABEN['ich'], 'ich', 'ein', 'Buch', particip('lesen') + '.'],
                  forklaring='Gestern står först, så habe kommer på andra plats och sedan ich. Tyskan använder '
                             'ofta perfekt när man berättar om något som hänt, där svenskan säger läste.'),
            val('Vilket particip saknar ge-?',
                [particip('besuchen'), particip('spielen'), particip('machen'), particip('wohnen')],
                particip('besuchen'),
                'Besuchen har förstavelsen be-, och verb med förstavelserna be-, ver- och er- får inget ge-: '
                'besucht.'),
            skriv('Skriv rätt form av haben: Was ___ du gestern gemacht?', godtas(HABEN['du']),
                  'Till du hör hast. Hast står på andra plats och participet gemacht sist.'),
        ], beskrivning='Perfekt med haben: particip som gespielt och getrunken, och participet sist i meningen.'),

        niva('de-ak9-perfekt-2', 'Ich bin gefahren', 'Perfekt med haben och sein', [
            valj_hjalpverb('Wir ___ nach Spanien %s.', 'wir', 'fliegen', [SEIN['ihr'], HABEN['er']],
                           'Fliegen (flyga) är en förflyttning och får sein i perfekt. Till wir hör sind: '
                           'wir sind geflogen.'),
            sant('De flesta tyska verb bildar perfekt med haben.', True,
                 'Haben är det vanligaste hjälpverbet. Sein används främst med verb för förflyttning eller '
                 'förändring, som fahren och aufstehen.'),
            para('Para ihop den tyska meningen med den svenska.',
                 [('Ich bin %s.' % particip('fahren'), 'Jag har åkt.'),
                  ('Ich bin %s.' % particip('kommen'), 'Jag har kommit.'),
                  ('Ich bin %s.' % particip('fliegen'), 'Jag har flugit.'),
                  ('Ich bin %s.' % particip('bleiben'), 'Jag har stannat.')],
                 'Alla fyra får sein i perfekt. Fahren, kommen och fliegen är förflyttningar, och bleiben '
                 '(stanna) får sein ändå.'),
            ordna('Bygg meningen: Hon har kommit hem.',
                  ['Sie', hjalpverb('kommen')['er'], 'nach', 'Hause', particip('kommen') + '.'],
                  extra=[HABEN['er']],
                  forklaring='Kommen är en förflyttning och får sein: sie ist gekommen. Nach Hause betyder hem, '
                             'och participet står sist.'),
            skriv("Skriv participet av 'gehen' (gå).", godtas(particip('gehen')),
                  'Gehen är oregelbundet: participet heter gegangen, och perfekt bildas med sein: '
                  'ich bin gegangen.'),
            skriv('Skriv rätt form av sein: Wann ___ du nach Hause gekommen?', godtas(hjalpverb('kommen')['du']),
                  'Kommen får sein i perfekt. Till du hör bist: Wann bist du nach Hause gekommen?'),
            ordna('Bygg meningen: Förra sommaren åkte vi till Österrike.',
                  ['Letzten', 'Sommer', hjalpverb('fahren')['wir'], 'wir', 'nach', 'Österreich',
                   particip('fahren') + '.'],
                  forklaring='Letzten Sommer står först, så sind kommer på andra plats. Fahren får sein, och '
                             'participet gefahren står sist.'),
            valj_hjalpverb('Er ___ einen Kuchen %s.', 'er', 'backen', [HABEN['ich'], SEIN['wir']],
                           'Backen (baka) är ingen förflyttning, så det får haben, som de flesta verb: '
                           'er hat gebacken.'),
            valj_hjalpverb('Ich ___ heute um sechs Uhr %s.', 'ich', 'aufstehen', [SEIN['er'], HABEN['er']],
                           'Aufstehen är en förändring, från att ligga till att stå. Därför får det sein: '
                           'ich bin aufgestanden.'),
            sant("Perfekt av 'sein' heter 'ich bin gewesen'.",
                 hjalpverb('sein')['ich'] + ' ' + particip('sein') == 'bin gewesen',
                 'Också sein får sein i perfekt: Ich bin in Berlin gewesen, jag har varit i Berlin.'),
        ], beskrivning='Perfekt med sein: verb för förflyttning och förändring, som fahren, kommen och aufstehen.'),
    ]),
]
