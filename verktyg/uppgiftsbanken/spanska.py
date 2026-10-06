# -*- coding: utf-8 -*-
"""Spanska åk 7 och 9 i NexLäx (2026-10-06). Moderna språk: en nybörjare i
åk 7 och en elev som läst spanska i två till tre år i åk 9. Spanska finns
bara i NexLäx (NX.NEXLAX_AMNEN), och nycklarna börjar med es. Frågorna
ställs på svenska och det som övas är på spanska, som i en språkapp: para
ihop ord (spanskan till vänster), bygg meningar av brickor, välj rätt form,
skriv ett ord, och några påståenden om språket att svara sant eller falskt på.

Åk 7: hälsa och presentera sig, talen 0–20 och åldern, familjen med
el/la, un/una och plural, ser, estar och tener i presens, och regelbundna
-ar-verb om skolan och fritiden. Åk 9: mat och att beställa på ett café
(quiero, me gusta och me gustan), vardagen med reflexiva verb, staden och
vägbeskrivningar (hay och está), framtid med ir a och grundform, och dåtid
i pretérito indefinido (regelbundna verb, ir och ser, hacer). Framtiden står
före dåtiden: ir a och en grundform är en böjd form, indefinido är nya
ändelser för varje person och flera oregelbundna verb.

Bygger på Lgr22:s centrala innehåll i moderna språk: vardagliga
situationer, personer, platser, intressen och händelser, och språkets form
(ordförråd, böjningar, ordföljd och stavning). Allt är skrivet för banken;
inget är hämtat ur ett läromedel eller ett prov, och personerna i
meningarna är påhittade.

NEUTRAL SPANSKA. Orden ska fungera både i Spanien och i Latinamerika, så
ord som skiljer sig mellan länderna står inte här (bil, dator, mobil, buss,
juice, potatis, simbassäng, servitör). Vosotros, som bara används i
Spanien, prövas inte, och ingen fråga kräver vosotros eller ustedes. Där
länderna säger olika och båda är rätt säger förklaringen det (jugar al
fútbol och jugar fútbol, sigue recto och sigue derecho).

Talen och böjningarna står i tabeller här (TAL, SER, ESTAR, TENER, QUERER,
IR, FUI, HICE), och de regelbundna verben böjs av presens_ar() och
indefinido(), med assert mot de vanligaste felen. Facit läses ur dem, så
att samma form inte kan stavas på ett sätt i en fråga och på ett annat i
nästa.

BRICKORNA. Rättningen jämför brickorna exakt. ¿ sitter på frågans första
ord och ? på det sista (¿Cómo, llamas?), punkten och kommat på ordet före,
som i engelska.py. Stor bokstav på första brickan och punkten sist låser
ordningen där spanskan annars hade tillåtit att ett tidsord flyttas. En
extra bricka ger aldrig en annan mening som också är rätt (spelaren låter
eleven lämna brickor kvar).

SKRIV godtar formen utan accent efter den rätta (['está', 'esta']), för
rättningen jämför accenter och alla har inte spanska tecken på
tangentbordet; den första formen visas som facit. Ett ord med ñ är aldrig
ett skriv-svar: utan tilde blir año ett annat ord. Där accenten är hela
skillnaden mellan två former (hablo och habló, té och te, más och mas) är
frågan ett val eller en bricka i stället. Verbformerna låses med tiden
(i presens, i pretérito indefinido) eller med en svensk översättning,
för utan den hade flera tider varit rätt.

FÖRENKLAT: ser och estar övas med tumregeln att ser säger vem eller hur
någon är, varifrån och yrket, och estar var något ligger och hur någon mår
just nu; undantagen (en fest som äger rum någonstans tar ser) tas inte upp.
Hay är att något finns och está var en bestämd sak ligger. Jugar står
bland -ar-verben men byter u mot ue, och frågorna säger det. Dåtiden övar
bara indefinido, med ayer, anoche och ”förra”, där Spanien och
Latinamerika säger samma sak (för det som hänt i dag säger man i Spanien
he comido). Imperfekt står aldrig som felaktigt alternativ: svenskans
preteritum täcker båda tiderna, och hablaba hade kunnat vara rätt.
Vägbeskrivningens gira, sigue och cruza lärs som fraser, inte som
imperativ. Usted beskrivs som ett artigt du till en vuxen man inte känner.
"""
import unicodedata

from grund import bana, niva, val, skriv, ordna, sant, para


def utan_accent(t):
    """Texten utan accenter: está → esta, dieciséis → dieciseis."""
    return ''.join(c for c in unicodedata.normalize('NFD', t) if not unicodedata.combining(c))


def svar(ratt):
    """Ett skriv-svar: den rätta formen först (den visas som facit), sedan
    samma ord utan accent. Ett ord med ñ blir aldrig ett skriv-svar, för
    utan tilde är año och ano två olika ord."""
    assert 'ñ' not in ratt.lower(), 'ñ i ett skriv-svar: gör frågan till ett val'
    utan = utan_accent(ratt)
    return [ratt] if utan == ratt else [ratt, utan]


def och_lista(delar):
    """'a, b och c'."""
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


def mening(t):
    return t[0].upper() + t[1:] + '.'


# ---------------------------------------------------------------------------
# Talen 0–20. Platsen i listan är talet.

TAL = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
       'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho',
       'diecinueve', 'veinte']
assert len(TAL) == 21 and TAL[10] == 'diez' and TAL[20] == 'veinte'
# Av talen till tjugo är det bara sexton som har accent.
assert [t for t in TAL if t != utan_accent(t)] == ['dieciséis']


def talpar(nummer):
    return [(TAL[n], str(n)) for n in nummer]


def talen_ar(nummer):
    return mening(och_lista(['%s är %d' % (TAL[n], n) for n in nummer]))


# ---------------------------------------------------------------------------
# Böjningarna. Vosotros är inte med (se filhuvudet).

PERSONER = ('yo', 'tú', 'él', 'nosotros', 'ellos')


def bojning(*former):
    assert len(former) == len(PERSONER)
    return dict(zip(PERSONER, former))


SER = bojning('soy', 'eres', 'es', 'somos', 'son')
ESTAR = bojning('estoy', 'estás', 'está', 'estamos', 'están')
TENER = bojning('tengo', 'tienes', 'tiene', 'tenemos', 'tienen')
QUERER = bojning('quiero', 'quieres', 'quiere', 'queremos', 'quieren')
IR = bojning('voy', 'vas', 'va', 'vamos', 'van')
# Ir och ser har samma former i pretérito indefinido.
FUI = bojning('fui', 'fuiste', 'fue', 'fuimos', 'fueron')
HICE = bojning('hice', 'hiciste', 'hizo', 'hicimos', 'hicieron')
# E blir ie och o blir ue i alla former utom vi-formen.
assert QUERER['nosotros'] == 'queremos' and all('ie' in QUERER[p] for p in PERSONER if p != 'nosotros')
# Ingen av de oregelbundna formerna i dåtid har accent.
assert all(f == utan_accent(f) for f in list(FUI.values()) + list(HICE.values()))


def presens_ar(infinitiv):
    """Ett regelbundet -ar-verb i presens."""
    assert infinitiv.endswith('ar')
    stam = infinitiv[:-2]
    return bojning(*(stam + e for e in ('o', 'as', 'a', 'amos', 'an')))


def indefinido(infinitiv):
    """Ett regelbundet verb i pretérito indefinido. Inte verb vars jag-form
    byter stavning (jugar → jugué, tocar → toqué) eller vars stam slutar på
    vokal (leer → leyó): de skrivs för hand."""
    stam, slut = infinitiv[:-2], infinitiv[-2:]
    assert slut in ('ar', 'er', 'ir') and not infinitiv.endswith(('car', 'gar', 'zar'))
    if slut == 'ar':
        return bojning(*(stam + e for e in ('é', 'aste', 'ó', 'amos', 'aron')))
    assert stam[-1] not in 'aeiou'
    return bojning(*(stam + e for e in ('í', 'iste', 'ió', 'imos', 'ieron')))


assert presens_ar('hablar') == bojning('hablo', 'hablas', 'habla', 'hablamos', 'hablan')
assert indefinido('hablar') == bojning('hablé', 'hablaste', 'habló', 'hablamos', 'hablaron')
assert indefinido('comer') == bojning('comí', 'comiste', 'comió', 'comimos', 'comieron')
assert indefinido('escribir')['él'] == 'escribió' and indefinido('beber')['tú'] == 'bebiste'
# Accenten är hela skillnaden: hablo är jag pratar, habló han pratade.
assert presens_ar('hablar')['yo'] == utan_accent(indefinido('hablar')['él'])
assert indefinido('estudiar')['él'] == 'estudió' and presens_ar('estudiar')['yo'] == 'estudio'
# Vi-formen av ett -ar-verb är samma i presens och i dåtid.
assert presens_ar('hablar')['nosotros'] == indefinido('hablar')['nosotros']

COMPRE = indefinido('comprar')
KOPTE = bojning('jag köpte', 'du köpte', 'hon köpte', 'vi köpte', 'de köpte')

HALSA = 'Hälsa och presentera dig'
SIFFROR = 'Siffror och ålder'
FAMILJEN = 'Familjen och artiklarna'
VERBEN = 'Ser, estar och tener'
SKOLAN = 'Skolan och fritiden'
MAT = 'Mat och café'
VARDAGEN = 'Vardagen och reflexiva verb'
STADEN = 'Staden och vägbeskrivning'
FRAMTID = 'Framtid med ir a'
DATID = 'Dåtid med pretérito indefinido'


# ---------------------------------------------------------------------------

BANOR = [
    bana('Spanska', 'ak7', [
        # -------------------------------------------- Hälsa och presentera dig
        niva('es-ak7-halsa-1', '¡Hola! Dina första ord', HALSA, [
            para('Para ihop den spanska hälsningen med den svenska.',
                 [('hola', 'hej'), ('adiós', 'hej då'), ('hasta luego', 'vi ses senare'),
                  ('buenas tardes', 'god eftermiddag')],
                 'Hola är hej och adiós hej då. Hasta luego säger du när ni ses igen, och buenas tardes '
                 'på eftermiddagen.'),
            val('Du träffar en granne klockan åtta på morgonen. Vad säger du?',
                ['Buenos días', 'Buenas noches', 'Buenas tardes', 'Hasta luego'], 'Buenos días',
                'Buenos días betyder god morgon och används ungefär fram till lunch. Buenas tardes är god '
                'eftermiddag och buenas noches god kväll.'),
            sant('Buenas noches kan betyda både god kväll och god natt.', True,
                 'Buenas noches säger man när det har blivit kväll, både när man kommer och när man ska gå '
                 'och lägga sig.'),
            val("Vad betyder '¿Qué tal?'", ['Hur är läget?', 'Vad heter du?', 'Var bor du?', 'Hur gammal är du?'],
                'Hur är läget?',
                '¿Qué tal? är ett vardagligt sätt att fråga hur någon har det. Du kan svara bien, bra.'),
            val('Någon frågar dig ¿Cómo estás? Vilket svar passar?',
                ['Muy bien.', 'Me llamo Ana.', 'Tengo trece años.', 'Soy de Suecia.'], 'Muy bien.',
                '¿Cómo estás? betyder hur mår du? Då svarar du hur du mår: muy bien betyder mycket bra.'),
            skriv('Skriv det spanska ordet för tack.', svar('gracias'),
                  'Tack heter gracias. Får du ett tack kan du svara de nada, ingen orsak.'),
            ordna('Bygg meningen: God morgon, hur mår du?', ['Buenos', 'días,', '¿cómo', 'estás?'],
                  forklaring='Frågan börjar efter kommat, så ¿ står där, före cómo, och inte först i meningen.'),
            sant('På spanska skrivs frågetecken bara i slutet av en fråga, som på svenska.', False,
                 'Spanskan har ett upp-och-nervänt frågetecken där frågan börjar också: ¿Qué tal?'),
            val("Vad betyder '¡Hasta mañana!'", ['Vi ses i morgon!', 'Vi ses om en stund!', 'God morgon!', 'God natt!'],
                'Vi ses i morgon!',
                'Hasta betyder tills och mañana i morgon. Du säger det när ni ses igen nästa dag.'),
        ], beskrivning='Hälsa, säga hej då och fråga hur någon mår på spanska.'),

        niva('es-ak7-halsa-2', 'Me llamo …', HALSA, [
            val('Hur säger du "Jag heter Sara" på spanska?',
                ['Me llamo Sara.', 'Mi llamo Sara.', 'Yo llama Sara.', 'Mi nombre Sara.'], 'Me llamo Sara.',
                'Llamarse betyder heta, och jag heter är me llamo. Mi betyder min, som i mi nombre es Sara, '
                'mitt namn är Sara.'),
            ordna('Bygg frågan: Vad heter du?', ['¿Cómo', 'te', 'llamas?'], extra=['¿Qué'],
                  forklaring='På spanska frågar man hur du kallar dig: ¿Cómo te llamas? Därför står cómo, '
                             'hur, och inte qué, vad.'),
            para('Para ihop frågan med vad den betyder.',
                 [('¿De dónde eres?', 'Var kommer du ifrån?'), ('¿Dónde vives?', 'Var bor du?'),
                  ('¿Cómo estás?', 'Hur mår du?'), ('¿Y tú?', 'Och du?')],
                 'Dónde betyder var, och de dónde varifrån. Y betyder och, så ¿y tú? är och du?'),
            val('Vilket svar passar på frågan ¿De dónde eres?',
                ['Soy de Suecia.', 'Estoy de Suecia.', 'Tengo de Suecia.', 'Vivo de Suecia.'], 'Soy de Suecia.',
                'Varifrån man kommer säger man med ser: soy de Suecia, jag är från Sverige.'),
            skriv('Fyll i ordet som saknas: Vivo ___ Estocolmo. (Jag bor i Stockholm.)', svar('en'),
                  'När du berättar var du bor heter i en: vivo en Estocolmo. Estocolmo är Stockholm på spanska.'),
            sant('Mucho gusto säger man när man träffar någon för första gången.', True,
                 'Mucho gusto betyder ungefär trevligt att träffas, och man säger det när man just har hälsat.'),
            ordna('Bygg meningen: Jag kommer från Spanien, och du?', ['Soy', 'de', 'España,', '¿y', 'tú?'],
                  forklaring='Soy de betyder jag kommer från. Frågan ¿y tú? börjar efter kommat, och där står ¿.'),
            val('Vilken fråga är ett artigt sätt att fråga en vuxen hur hen mår?',
                ['¿Cómo está usted?', '¿Cómo estás tú?', '¿Cómo se llama usted?', '¿Qué tal estás?'],
                '¿Cómo está usted?',
                'Usted är ett artigt du till en vuxen man inte känner. Verbet har samma form som för han och '
                'hon: usted está.'),
            sant('Spanska är det officiella språket i Brasilien.', False,
                 'I Brasilien talar man portugisiska. Spanska och portugisiska är släkt, men de är två olika språk.'),
        ], beskrivning='Säga vad du heter och var du kommer ifrån, och fråga andra samma sak.'),

        # -------------------------------------------- Siffror och ålder
        niva('es-ak7-siffror-1', 'Uno, dos, tres', SIFFROR, [
            para('Para ihop talet med siffran.', talpar((3, 7, 9, 4, 10)), talen_ar((3, 7, 9, 4, 10))),
            val("Vilket tal är 'cinco'?", ['5', '4', '6', '15'], str(TAL.index('cinco')),
                'Cinco är fem. Femton heter quince, och de två orden är lätta att blanda ihop.'),
            skriv('Skriv talet 8 med bokstäver på spanska.', svar(TAL[8]),
                  'Åtta heter ocho. Samma ord finns i oktober, som en gång var årets åttonde månad.'),
            val("Vad heter 'noll' på spanska?", ['cero', 'nada', 'nulo', 'once'], TAL[0],
                'Noll heter cero. Nada betyder ingenting, men som tal säger man cero.'),
            sant("'Once' betyder en gång, som på engelska.", False,
                 'Once är talet elva på spanska. Det ser ut som engelskans once men betyder något helt annat.'),
            ordna('Ordna talen från minst till störst.', [TAL[n] for n in sorted((12, 2, 15, 6))],
                  forklaring=talen_ar(sorted((12, 2, 15, 6)))),
            val('Vilket tal kommer direkt efter catorce?', ['quince', 'trece', 'cuatro', 'dieciséis'],
                TAL[TAL.index('catorce') + 1],
                'Catorce är 14, så nästa tal är 15, quince. Trece är 13, talet före.'),
            skriv('Skriv talet 20 med bokstäver på spanska.', svar(TAL[20]),
                  'Tjugo heter veinte. Talen efter bygger på det: veintiuno är 21 och veintidós 22.'),
            val('Vad är seis + uno? Välj svaret på spanska.', ['siete', 'cinco', 'seis', 'nueve'], TAL[6 + 1],
                'Seis är 6 och uno 1. Sex plus ett är sju, och sju heter siete.'),
        ], beskrivning='Talen från noll till tjugo på spanska.'),

        niva('es-ak7-siffror-2', 'Tengo trece años', SIFFROR, [
            val('Hur säger du "Jag är tretton år" på spanska?',
                ['Tengo trece años.', 'Soy trece años.', 'Estoy trece años.', 'Tengo años trece.'],
                'Tengo trece años.',
                'På spanska har man sin ålder: tengo trece años betyder ordagrant jag har tretton år.'),
            ordna('Bygg frågan: Hur gammal är du?', ['¿Cuántos', 'años', 'tienes?'], extra=['eres?'],
                  forklaring='¿Cuántos años tienes? betyder ordagrant hur många år har du? Åldern säger man med '
                             'tener, inte med ser.'),
            skriv('Fyll i talet med bokstäver: Mi hermano tiene ___ años. (Min bror är sexton år.)', svar(TAL[16]),
                  'Sexton heter dieciséis, med accent på é. Det är diez y seis, tio och sex, skrivet som ett ord.'),
            val("Vilket tal är 'diecisiete'?", ['17', '7', '70', '16'], str(TAL.index('diecisiete')),
                'Diecisiete är diez y siete, tio och sju, alltså 17.'),
            sant("'Dieciocho' betyder åttio.", False,
                 'Dieciocho är diez y ocho, tio och åtta, alltså 18. Åttio heter ochenta.'),
            para('Para ihop talet med siffran.', talpar((11, 13, 15, 19)), talen_ar((11, 13, 15, 19))),
            val('Leo är once år. Hur gammal är han om tre år? Välj svaret på spanska.',
                ['catorce', 'cuatro', 'trece', 'diecisiete'], TAL[11 + 3],
                'Once är 11, och 11 + 3 är 14. Fjorton heter catorce. Cuatro, fyra, är lätt att blanda ihop med det.'),
            skriv('Fyll i talet med bokstäver: Tengo ___ años. (Jag är tolv år.)', svar(TAL[12]),
                  'Tolv heter doce. Tengo doce años betyder jag är tolv år.'),
            sant('Ñ är en egen bokstav i det spanska alfabetet.', True,
                 'Ñ står efter n i alfabetet. Den finns i vanliga ord som año, år, och mañana, i morgon.'),
            ordna('Bygg meningen: Min syster är elva år.', ['Mi', 'hermana', 'tiene', TAL[11], 'años.'],
                  forklaring='Åldern säger man med tener: mi hermana tiene once años, ordagrant min syster har elva år.'),
        ], beskrivning='Säga hur gammal du är, och talen från elva till tjugo.'),

        # -------------------------------------------- Familjen och artiklarna
        niva('es-ak7-familjen-1', 'Mi familia', FAMILJEN, [
            para('Para ihop det spanska ordet med det svenska.',
                 [('padre', 'pappa'), ('madre', 'mamma'), ('hermano', 'bror'), ('hermana', 'syster'),
                  ('abuelo', 'farfar eller morfar')],
                 'Hermano och hermana skiljer sig bara på sista bokstaven: -o för bror och -a för syster.'),
            val("Vad betyder 'los padres'?", ['föräldrarna', 'bröderna', 'farföräldrarna', 'syskonen'], 'föräldrarna',
                'Los padres är mamma och pappa tillsammans. En blandad grupp får den maskulina formen i plural.'),
            sant("'Los hermanos' kan betyda syskonen, alltså bröder och systrar tillsammans.", True,
                 'En grupp med både pojkar och flickor får maskulin plural. Los hermanos kan alltså vara syskon.'),
            val('Välj rätt artikel: ___ madre (mamman)', ['la', 'el', 'los', 'las'], 'la',
                'Madre är en kvinna och ordet är feminint, så det heter la madre.'),
            skriv('Skriv el eller la: ___ hermano (brodern)', svar('el'),
                  'Hermano är maskulint, och då heter det el. Ord på -o är oftast maskulina.'),
            val('Vilket av orden är feminint?', ['abuela', 'abuelo', 'hermano', 'perro'], 'abuela',
                'Abuela slutar på -a och betyder farmor eller mormor, så det heter la abuela.'),
            ordna('Bygg meningen: Jag har en bror och en syster.', ['Tengo', 'un', 'hermano', 'y', 'una', 'hermana.'],
                  forklaring='Un står före maskulina ord och una före feminina: un hermano, una hermana.'),
            val("Vad betyder 'mi tía'?",
                ['min faster eller moster', 'min farbror eller morbror', 'min kusin', 'min farmor eller mormor'],
                'min faster eller moster',
                'Tía slutar på -a och är en kvinna: faster eller moster. Farbror eller morbror heter tío.'),
            sant('Spanskan har två olika ord för farmor och mormor.', False,
                 'Abuela betyder både farmor och mormor. Vill du vara tydlig säger du la madre de mi padre, '
                 'pappas mamma.'),
        ], beskrivning='Ord för familjen, och när det heter el och när det heter la.'),

        niva('es-ak7-familjen-2', 'Un, una, los, las', FAMILJEN, [
            val('Välj rätt ord: ___ perro (en hund)', ['un', 'una', 'el', 'unos'], 'un',
                'Perro är maskulint, och en heter un framför maskulina ord: un perro. El perro är hunden.'),
            skriv('Skriv un eller una: ___ casa (ett hus)', svar('una'),
                  'Casa slutar på -a och är feminint. Framför feminina ord heter en och ett una: una casa.'),
            val("Hur blir 'el libro' i plural?", ['los libros', 'las libros', 'los libroes', 'el libros'], 'los libros',
                'Ett ord som slutar på vokal får -s i plural, och el blir los: los libros.'),
            val("Hur blir 'la ciudad' i plural?", ['las ciudades', 'las ciudads', 'los ciudades', 'la ciudades'],
                'las ciudades',
                'Ett ord som slutar på konsonant får -es i plural: ciudades. La blir las.'),
            para('Para ihop det spanska med det svenska.',
                 [('el gato', 'katten'), ('un gato', 'en katt'), ('los gatos', 'katterna'), ('unos gatos', 'några katter')],
                 'El och los gör ordet bestämt, som -en och -erna på svenska. Un är en, och unos betyder några.'),
            sant('Alla ord som slutar på -o är maskulina på spanska.', False,
                 'De flesta är det, men inte alla. La mano, handen, slutar på -o och är ändå feminint.'),
            val('Välj rätt artikel: ___ día (dagen)', ['el', 'la', 'los', 'las'], 'el',
                'Día slutar på -a men är maskulint: el día. Därför heter det buenos días och inte buenas días.'),
            ordna('Bygg meningen: Jag har två svarta katter.', ['Tengo', 'dos', 'gatos', 'negros.'], extra=['negras.'],
                  forklaring='Adjektivet står efter substantivet och böjs efter det. Gatos är maskulint och står i '
                             'plural, så det blir negros.'),
            skriv('Skriv ordet i plural: un lápiz, dos ___ (en penna, två pennor)', svar('lápices'),
                  'Ett ord som slutar på -z byter z mot c och får -es: un lápiz, dos lápices.'),
            val('Välj rätt form: Las flores son ___. (Blommorna är vita.)', ['blancas', 'blancos', 'blanca', 'blanco'],
                'blancas',
                'Flor är feminint, och flores står i plural. Då får adjektivet -as: las flores son blancas.'),
        ], beskrivning='En, ett och några, plural och adjektiv som böjs efter substantivet.'),

        # -------------------------------------------- Ser, estar och tener
        niva('es-ak7-ser-estar-tener-1', 'Soy, estoy, tengo', VERBEN, [
            para('Para ihop verbformen med vad den betyder.',
                 [(SER['yo'], 'jag är'), (SER['tú'], 'du är'), (TENER['él'], 'hon har'), (TENER['nosotros'], 'vi har')],
                 'Soy och eres kommer från ser, att vara. Tiene och tenemos kommer från tener, att ha.'),
            val('Välj rätt ord: Nosotros ___ amigos. (Vi är vänner.)',
                [SER['nosotros'], SER['ellos'], SER['yo'], ESTAR['nosotros']], SER['nosotros'],
                'Vilka man är för varandra säger man med ser, och vi är heter somos. Son är formen för de.'),
            skriv('Fyll i tener i presens: Yo ___ un perro.', svar(TENER['yo']),
                  'Tener är oregelbundet. Jag har heter tengo, och du har heter tienes.'),
            val('Välj rätt ord: ¿Dónde ___ tú? (Var är du?)', [ESTAR['tú'], ESTAR['él'], ESTAR['yo'], SER['tú']],
                ESTAR['tú'],
                'Var någon befinner sig säger man med estar, och till tú hör estás.'),
            sant('Ser och estar betyder samma sak och kan alltid bytas mot varandra.', False,
                 'Båda betyder vara, men de används olika. Ser säger vem eller hur någon är, estar var någon är '
                 'och hur den mår.'),
            ordna('Bygg meningen: Vi har en stor hund.', [TENER['nosotros'].capitalize(), 'un', 'perro', 'grande.'],
                  forklaring='Tenemos är vi har. Grande står efter perro, för adjektivet står oftast efter '
                             'substantivet på spanska.'),
            val('Välj rätt form av tener: Mis padres ___ un gato.',
                [TENER['ellos'], TENER['nosotros'], TENER['él'], TENER['tú']], TENER['ellos'],
                'Mis padres, mina föräldrar, är de. De har heter tienen.'),
            skriv('Fyll i ser i presens: Ella ___ de México.', svar(SER['él']),
                  'Ella betyder hon, och hon är heter es. Varifrån någon kommer säger man med ser.'),
            val('Vilken form av estar hör ihop med yo?', [ESTAR['yo'], ESTAR['tú'], ESTAR['él'], ESTAR['ellos']],
                ESTAR['yo'],
                'Yo betyder jag, och jag är heter estoy. Det slutar på -oy, precis som soy.'),
        ], beskrivning='De tre vanliga verben ser, estar och tener i presens.'),

        niva('es-ak7-ser-estar-tener-2', 'Ser eller estar?', VERBEN, [
            val('Välj rätt ord: Madrid ___ en España.', [ESTAR['él'], SER['él'], TENER['él'], 'hay'], ESTAR['él'],
                'Var en plats ligger säger man med estar: Madrid está en España, Madrid ligger i Spanien.'),
            val('Välj rätt ord: Mi madre ___ profesora.', [SER['él'], ESTAR['él'], TENER['él'], SER['ellos']], SER['él'],
                'Yrket säger man med ser: mi madre es profesora, min mamma är lärare.'),
            sant('Man använder ser för att säga hur man mår just nu.', False,
                 'Hur man mår just nu kan ändras, och då använder man estar: estoy bien, estoy cansado.'),
            skriv('Fyll i estar i presens: Hoy yo ___ cansado. (I dag är jag trött.)', svar(ESTAR['yo']),
                  'Trött är något du är just nu, så det blir estar: estoy cansado. En tjej säger estoy cansada.'),
            val('Välj rätt ord: Nosotros ___ en la escuela.',
                [ESTAR['nosotros'], SER['nosotros'], TENER['nosotros'], SER['ellos']], ESTAR['nosotros'],
                'Var någon befinner sig säger man med estar: estamos en la escuela, vi är i skolan.'),
            ordna('Bygg meningen: Min hund är liten och svart.', ['Mi', 'perro', SER['él'], 'pequeño', 'y', 'negro.'],
                  forklaring='Hur något är till sitt sätt säger man med ser: mi perro es pequeño y negro.'),
            para('Para ihop meningen med vad den betyder.',
                 [('Son altos.', 'De är långa.'), ('Están en casa.', 'De är hemma.'),
                  ('Están contentos.', 'De är glada.'), ('Son simpáticos.', 'De är trevliga.')],
                 'Långa och trevliga är man till sitt sätt, så det blir son, av ser. Hemma och glada just nu '
                 'blir están, av estar.'),
            sant("'Tengo hambre' betyder ordagrant jag har hunger.", True,
                 'På spanska har man hunger: tengo hambre. På svenska säger man i stället jag är hungrig.'),
            val('Välj rätt ord: Lucía ___ de Colombia.', [SER['él'], ESTAR['él'], TENER['él'], 'vive'], SER['él'],
                'Varifrån någon kommer säger man med ser: Lucía es de Colombia, Lucía kommer från Colombia.'),
            sant("'Estoy aburrido' och 'soy aburrido' betyder samma sak.", False,
                 'Estoy aburrido betyder jag är uttråkad just nu. Soy aburrido betyder jag är tråkig, som person.'),
        ], beskrivning='När det heter ser och när det heter estar, och hunger med tener.'),

        # -------------------------------------------- Skolan och fritiden
        niva('es-ak7-skolan-1', 'Hablo, hablas, habla', SKOLAN, [
            para('Para ihop verbet med vad det betyder.',
                 [('hablar', 'prata'), ('estudiar', 'studera'), ('escuchar', 'lyssna'), ('bailar', 'dansa'),
                  ('nadar', 'simma')],
                 'Alla fem är regelbundna -ar-verb, så de böjs på samma sätt som hablar.'),
            val('Välj rätt form av hablar i presens: Yo ___ español.',
                [presens_ar('hablar')[p] for p in ('yo', 'tú', 'él', 'ellos')], presens_ar('hablar')['yo'],
                'Till yo, jag, hör ändelsen -o: hablo, jag pratar.'),
            skriv('Fyll i estudiar i presens: Tú ___ inglés.', svar(presens_ar('estudiar')['tú']),
                  'Till tú, du, hör ändelsen -as: estudias, du studerar.'),
            val('Välj rätt form av bailar i presens: Ellas ___ salsa.',
                [presens_ar('bailar')[p] for p in ('ellos', 'nosotros', 'él', 'tú')], presens_ar('bailar')['ellos'],
                'Ellas betyder de, om en grupp tjejer. Till ellos och ellas hör ändelsen -an: bailan.'),
            skriv('Fyll i escuchar i presens: Nosotros ___ música.', svar(presens_ar('escuchar')['nosotros']),
                  'Till nosotros, vi, hör ändelsen -amos: escuchamos, vi lyssnar.'),
            sant("I 'hablo' visar ändelsen -o att det är jag som pratar.", True,
                 'Ändelsen visar vem som gör något, så yo behövs inte: hablo räcker för jag pratar.'),
            ordna('Bygg meningen: Min bror spelar gitarr.', ['Mi', 'hermano', 'toca', 'la', 'guitarra.'], extra=['juega'],
                  forklaring='Ett instrument spelar man med tocar: toca la guitarra. Jugar är att spela ett spel '
                             'eller en sport.'),
            val('Välj rätt form av mirar i presens: Usted ___ las fotos.',
                [presens_ar('mirar')[p] for p in ('él', 'tú', 'yo', 'ellos')], presens_ar('mirar')['él'],
                'Usted är ett artigt du, men verbet har samma form som för han och hon: usted mira.'),
            val("Vad betyder 'trabajamos'?", ['vi arbetar', 'de arbetar', 'jag arbetar', 'du arbetar'], 'vi arbetar',
                'Ändelsen -amos betyder vi. Trabajar är arbeta, så trabajamos är vi arbetar.'),
        ], beskrivning='Regelbundna -ar-verb i presens: ändelsen visar vem som gör något.'),

        niva('es-ak7-skolan-2', 'Fritid och skola', SKOLAN, [
            para('Para ihop skolämnet med det svenska ordet.',
                 [('las matemáticas', 'matematik'), ('el inglés', 'engelska'), ('la música', 'musik'),
                  ('la educación física', 'idrott och hälsa')],
                 'Educación física betyder ordagrant fysisk utbildning, alltså idrott. Inglés är engelska.'),
            val('Välj rätt form av jugar i presens: Yo ___ al fútbol los sábados.', ['juego', 'jugo', 'juga', 'jugas'],
                'juego',
                'Jugar är lite speciellt: u blir ue i jag-formen. Därför heter det juego, jag spelar.'),
            sant('Jugar böjs precis som hablar i alla former.', False,
                 'I jugar blir u till ue: juego, juegas, juega och juegan. Vi-formen behåller u: jugamos.'),
            skriv('Fyll i estudiar i presens: Mi hermana ___ en Madrid.', svar(presens_ar('estudiar')['él']),
                  'Mi hermana är hon, och till él och ella hör ändelsen -a: estudia.'),
            ordna('Bygg meningen: På lördagar spelar vi fotboll.', ['Los', 'sábados', 'jugamos', 'al', 'fútbol.'],
                  forklaring='Los sábados betyder på lördagar. Jugar al fútbol är spela fotboll; i Latinamerika '
                             'säger många jugar fútbol.'),
            val("Vad betyder 'Escucho música por la tarde'?",
                ['Jag lyssnar på musik på eftermiddagen.', 'Hon lyssnar på musik på eftermiddagen.',
                 'Jag lyssnade på musik på eftermiddagen.', 'Jag lyssnar på musik på morgonen.'],
                'Jag lyssnar på musik på eftermiddagen.',
                'Escucho slutar på -o, så det är jag, och det är presens. Por la tarde är på eftermiddagen.'),
            skriv('Fyll i hablar i presens: Ellos ___ con el profesor.', svar(presens_ar('hablar')['ellos']),
                  'Ellos betyder de, och till ellos hör ändelsen -an: hablan.'),
            val("Vad betyder 'practicamos deporte'?",
                ['vi tränar idrott', 'de tränar idrott', 'vi tittar på sport', 'jag tränar idrott'], 'vi tränar idrott',
                'Ändelsen -amos visar att det är vi. Practicar deporte betyder träna eller utöva idrott.'),
            sant('Veckodagarna skrivs med liten bokstav på spanska, som lunes och sábado.', True,
                 'På spanska skrivs veckodagar och månader med liten bokstav, precis som på svenska.'),
            val('Vilket ord betyder rasten i skolan?', ['el recreo', 'el horario', 'la clase', 'la tarea'], 'el recreo',
                'Rasten heter el recreo. El horario är schemat, och la clase är lektionen eller klassen.'),
        ], beskrivning='Prata om skolan och fritiden med -ar-verb, och jugar som byter u mot ue.'),
    ]),

    bana('Spanska', 'ak9', [
        # -------------------------------------------- Mat och café
        niva('es-ak9-mat-1', 'Me gusta, me gustan', MAT, [
            para('Para ihop maten med det svenska ordet.',
                 [('el pan', 'brödet'), ('el queso', 'osten'), ('la leche', 'mjölken'), ('el pescado', 'fisken'),
                  ('el pollo', 'kycklingen')],
                 'El pescado är fisk som mat. En levande fisk i vattnet heter el pez.'),
            val('Välj rätt form: Me ___ el chocolate.', ['gusta', 'gustan', 'gusto', 'gustas'], 'gusta',
                'Det du gillar, el chocolate, står i singular. Då blir det gusta: me gusta el chocolate.'),
            val('Välj rätt form: Me ___ las manzanas.', ['gustan', 'gusta', 'gusto', 'gustamos'], 'gustan',
                'Las manzanas, äpplena, står i plural. Gustar böjs efter det man gillar, så det blir gustan.'),
            sant("I 'me gusta el helado' är det glassen som styr verbets form.", True,
                 'Gustar betyder ungefär behaga: glassen behagar mig. Därför böjs verbet efter el helado.'),
            skriv('Fyll i ordet som saknas: A mi madre ___ gusta el café. (Mamma gillar kaffe.)', svar('le'),
                  'När någon annan gillar något står le före gusta: a mi madre le gusta, min mamma gillar.'),
            ordna('Bygg meningen: Jag gillar inte fisk.', ['No', 'me', 'gusta', 'el', 'pescado.'], extra=['gustan'],
                  forklaring='No står före me. Efter gustar har spanskan bestämd artikel, el pescado, fast '
                             'svenskan bara säger fisk.'),
            val("Vad betyder '¿Te gusta el queso?'", ['Gillar du ost?', 'Gillar han ost?', 'Vill du ha ost?', 'Gillar jag ost?'],
                'Gillar du ost?',
                'Te betyder dig: behagar osten dig? Alltså gillar du ost? Gillar han heter le gusta.'),
            val("Vad betyder 'Nos gusta la pizza'?", ['Vi gillar pizza.', 'De gillar pizza.', 'Jag gillar pizza.', 'Ni gillar pizza.'],
                'Vi gillar pizza.',
                'Nos betyder oss: pizzan behagar oss, alltså vi gillar pizza.'),
            skriv("Skriv det spanska ordet för 'vatten'.", svar('agua') + ['el agua'],
                  'Vatten heter agua. Ett glas vatten heter un vaso de agua.'),
            sant('Efter me gusta kan det aldrig stå ett verb.', False,
                 'Efter me gusta kan ett verb stå i grundform: me gusta nadar, jag gillar att simma.'),
        ], beskrivning='Mat och dryck, och när det heter gusta och när det heter gustan.'),

        niva('es-ak9-mat-2', 'En el café', MAT, [
            ordna('Bygg meningen: Jag vill ha en kaffe, tack.', [QUERER['yo'].capitalize(), 'un', 'café,', 'por', 'favor.'],
                  forklaring='Quiero betyder jag vill ha. Por favor säger du när du ber om något, som tack på svenska.'),
            val('Hur ber du om notan på ett café?',
                ['La cuenta, por favor.', 'El menú, por favor.', 'Un vaso de agua, por favor.', 'Una mesa, por favor.'],
                'La cuenta, por favor.',
                'La cuenta är notan. Du ber om den när du har ätit klart och vill betala.'),
            para('Para ihop frasen med vad den betyder.',
                 [('¿Qué quieres tomar?', 'Vad vill du ha?'), ('¿Algo más?', 'Något mer?'),
                  ('Nada más, gracias.', 'Inget mer, tack.'), ('Para mí, un té.', 'Ett te till mig.')],
                 'På ett café betyder tomar ungefär ha. Más betyder mer, och para mí betyder till mig.'),
            val('Välj rätt form av querer i presens: Mi amigo ___ un té.',
                [QUERER['él'], QUERER['yo'], QUERER['tú'], 'queren'], QUERER['él'],
                'Querer byter e mot ie. Mi amigo är han, och han vill ha heter quiere.'),
            skriv('Fyll i querer i presens: Nosotros ___ dos helados. (Vi vill ha två glassar.)', svar(QUERER['nosotros']),
                  'I vi-formen blir e inte ie: queremos. I alla andra former blir det ie, som i quiero och quiere.'),
            sant("'Quiero un té' betyder jag vill ha ett te.", True,
                 'Té skrivs med accent för att skilja det från te, som betyder dig, som i ¿te gusta?'),
            val('Du är hungrig. Vad säger du?', ['Tengo hambre.', 'Soy hambre.', 'Estoy hambre.', 'Tengo sed.'],
                'Tengo hambre.',
                'Hunger har man på spanska: tengo hambre. Tengo sed betyder att man är törstig.'),
            ordna('Bygg frågan: Vill du ha något mer?', ['¿' + QUERER['tú'].capitalize(), 'algo', 'más?'], extra=['mas?'],
                  forklaring='Más med accent betyder mer. Utan accent är mas ett annat ord, som betyder men.'),
            val("Vad betyder 'un vaso de agua'?", ['ett glas vatten', 'en flaska vatten', 'en kopp vatten', 'lite vatten'],
                'ett glas vatten',
                'Un vaso är ett glas. En flaska heter una botella och en kopp una taza.'),
            skriv('Fyll i ordet som saknas: ¿Cuánto ___ el helado? (Vad kostar glassen?)', svar('cuesta'),
                  'Costar betyder kosta, och o blir ue: cuesta. ¿Cuánto cuesta? betyder vad kostar det?'),
        ], beskrivning='Beställa på ett café, fråga vad något kostar och be om notan.'),

        # -------------------------------------------- Vardagen och reflexiva verb
        niva('es-ak9-vardagen-1', 'Me levanto', VARDAGEN, [
            para('Para ihop verbet med vad det betyder.',
                 [('levantarse', 'stiga upp'), ('ducharse', 'duscha'), ('acostarse', 'gå och lägga sig'),
                  ('despertarse', 'vakna'), ('vestirse', 'klä på sig')],
                 'Levantarse är stiga upp och acostarse gå och lägga sig. Despertarse är vakna och vestirse klä på sig.'),
            val('Välj rätt ord: Yo ___ levanto a las siete. (Jag stiger upp klockan sju.)', ['me', 'te', 'se', 'nos'], 'me',
                'Till yo hör pronomenet me: me levanto, ordagrant jag reser mig.'),
            skriv('Fyll i pronomenet: Mi padre ___ ducha por la mañana. (Pappa duschar på morgonen.)', svar('se'),
                  'Mi padre är han, och till él och ella hör se: se ducha, han duschar.'),
            val('Välj rätt form: Tú te ___ temprano. (Du stiger upp tidigt.)',
                [presens_ar('levantar')[p] for p in ('tú', 'yo', 'él', 'ellos')], presens_ar('levantar')['tú'],
                'Till tú hör te och ändelsen -as: te levantas, du stiger upp.'),
            sant("I 'me levanto' kan me lika gärna bytas mot se.", False,
                 'Me hör till yo och se till él, ella och ellos. Se levanta betyder han eller hon stiger upp.'),
            ordna('Bygg meningen: Jag går och lägger mig klockan tio.', ['Me', 'acuesto', 'a', 'las', 'diez.'],
                  forklaring='Acostarse byter o mot ue, så det heter me acuesto. A las diez betyder klockan tio.'),
            val("Vad betyder 'Se levantan a las siete'?",
                ['De stiger upp klockan sju.', 'Vi stiger upp klockan sju.', 'De lägger sig klockan sju.',
                 'Hon stiger upp klockan sju.'],
                'De stiger upp klockan sju.',
                'Se och ändelsen -an visar att det är de. Levantarse betyder stiga upp.'),
            skriv('Fyll i pronomenet: Nosotros ___ duchamos después del partido. (Vi duschar efter matchen.)',
                  svar('nos'),
                  'Till nosotros hör nos: nos duchamos, vi duschar.'),
            val('Välj rätt form: Mis padres ___ a las ocho. (Mina föräldrar vaknar klockan åtta.)',
                ['se despiertan', 'se despertan', 'se despierta', 'se despertamos'], 'se despiertan',
                'Despertarse byter e mot ie. Mis padres är de, och de vaknar heter se despiertan.'),
            sant('Grundformen av ett reflexivt verb slutar på -se, som levantarse.', True,
                 'Se i slutet visar att verbet är reflexivt. När verbet böjs flyttar pronomenet fram: me levanto.'),
        ], beskrivning='Reflexiva verb i presens: me, te, se och nos före verbet.'),

        niva('es-ak9-vardagen-2', 'Min dag', VARDAGEN, [
            ordna('Bygg meningen: Min syster tvättar håret.', ['Mi', 'hermana', 'se', 'lava', 'el', 'pelo.'],
                  forklaring='Se lava är hon tvättar sig. Spanskan säger el pelo, håret, för se visar redan vems '
                             'hår det är.'),
            val("Vad betyder 'Me lavo los dientes'?",
                ['Jag borstar tänderna.', 'Jag tvättar händerna.', 'Jag kammar håret.', 'Jag borstar håret.'],
                'Jag borstar tänderna.',
                'Lavarse är tvätta sig och los dientes tänderna. Ordagrant: jag tvättar mig tänderna.'),
            skriv('Fyll i acostarse i presens: Mi abuelo se ___ a las nueve. (Farfar lägger sig klockan nio.)',
                  svar('acuesta'),
                  'Acostarse byter o mot ue: se acuesta, han lägger sig.'),
            val('Vilken mening betyder "Jag vaknar klockan sex"?',
                ['Me despierto a las seis.', 'Me despierta a las seis.', 'Se despierto a las seis.',
                 'Me despierto las seis.'],
                'Me despierto a las seis.',
                'Me och ändelsen -o visar att det är jag. A las seis betyder klockan sex.'),
            para('Para ihop tidsuttrycket med vad det betyder.',
                 [('a las siete', 'klockan sju'), ('a mediodía', 'mitt på dagen'), ('por la mañana', 'på morgonen'),
                  ('por la noche', 'på kvällen')],
                 'A las betyder klockan. Mañana är morgon, och noche är kväll eller natt.'),
            sant("Klockan ett heter 'a las una' på spanska.", False,
                 'Una är singular, så det heter a la una. Från två är det plural: a las dos, a las tres.'),
            val('Vilket av verben är inte reflexivt?', ['desayunar', 'ducharse', 'levantarse', 'acostarse'], 'desayunar',
                'Desayunar, äta frukost, har inget -se. Det böjs som ett vanligt -ar-verb: desayuno, jag äter frukost.'),
            ordna('Bygg meningen: Först duschar jag, sedan klär jag på mig.',
                  ['Primero', 'me', 'ducho', 'y', 'luego', 'me', 'visto.'],
                  forklaring='Båda verben är reflexiva, så me står före vart och ett. Vestirse byter e mot i: me visto.'),
            val('Någon frågar dig ¿A qué hora te levantas? Vilket svar passar?',
                ['Me levanto a las ocho.', 'Son las ocho.', 'Me levanto las ocho.', 'Me levanto en las ocho.'],
                'Me levanto a las ocho.',
                'Frågan är hur dags du stiger upp, och klockslaget behöver a: a las ocho. Son las ocho betyder '
                'klockan är åtta.'),
            skriv('Fyll i ducharse i presens: Ellos se ___ por la noche. (De duschar på kvällen.)',
                  svar(presens_ar('duchar')['ellos']),
                  'Ellos betyder de, och till ellos hör se och ändelsen -an: se duchan.'),
        ], beskrivning='Berätta om din dag med klockslag och reflexiva verb.'),

        # -------------------------------------------- Staden och vägbeskrivning
        niva('es-ak9-staden-1', '¿Dónde está?', STADEN, [
            para('Para ihop platsen med det svenska ordet.',
                 [('la iglesia', 'kyrkan'), ('la farmacia', 'apoteket'), ('el hospital', 'sjukhuset'),
                  ('la estación', 'stationen'), ('el supermercado', 'mataffären')],
                 'Flera ord för platser liknar svenska eller engelska: el hospital, la farmacia och el supermercado.'),
            val('Välj rätt ord: En mi barrio ___ un parque grande.', ['hay', ESTAR['él'], SER['él'], SER['ellos']], 'hay',
                'Hay betyder det finns. Du använder hay när du berättar att något finns, ofta med un eller una efter.'),
            val('Välj rätt ord: El parque ___ al lado del museo.', [ESTAR['él'], 'hay', SER['él'], ESTAR['ellos']],
                ESTAR['él'],
                'Var en bestämd sak ligger säger man med estar: el parque está, parken ligger.'),
            sant("'Hay' används både när det finns en sak och när det finns flera.", True,
                 'Hay har samma form i singular och plural: hay un parque, hay dos parques.'),
            skriv('Fyll i ordet som saknas: ¿Dónde ___ la estación? (Var ligger stationen?)', svar(ESTAR['él']),
                  'Var något ligger frågar man med estar: ¿Dónde está la estación?'),
            ordna('Bygg meningen: Banken ligger mittemot parken.', ['El', 'banco', ESTAR['él'], 'enfrente', 'del', 'parque.'],
                  extra=[SER['él']],
                  forklaring='Var något ligger säger man med estar. De och el dras ihop till del: enfrente del parque.'),
            val('Välj rätt ord: Mi casa está al lado ___ cine.', ['del', 'de el', 'el', 'al'], 'del',
                'De och el dras ihop till del. Därför heter det al lado del cine, bredvid biografen.'),
            sant("'La librería' betyder biblioteket.", False,
                 'La librería är en bokhandel, där man köper böcker. Biblioteket heter la biblioteca.'),
            val('Vilken mening betyder "Det finns två apotek på den här gatan"?',
                ['Hay dos farmacias en esta calle.', 'Hay dos farmacia en esta calle.',
                 'Están dos farmacias en esta calle.', 'Hay dos farmacias a esta calle.'],
                'Hay dos farmacias en esta calle.',
                'Hay betyder det finns och böjs inte. Farmacias får -s eftersom de är två.'),
        ], beskrivning='Platser i staden, hay och está, och ord för var något ligger.'),

        niva('es-ak9-staden-2', 'Gira a la derecha', STADEN, [
            para('Para ihop vägbeskrivningen med vad den betyder.',
                 [('Sigue recto.', 'Fortsätt rakt fram.'), ('Cruza la calle.', 'Gå över gatan.'),
                  ('Gira a la izquierda.', 'Sväng till vänster.'),
                  ('Está al final de la calle.', 'Det ligger i slutet av gatan.')],
                 'Seguir är fortsätta, cruzar gå över och girar svänga. Al final de betyder i slutet av.'),
            val("Vad betyder 'la segunda calle'?", ['den andra gatan', 'den första gatan', 'den sista gatan', 'den tredje gatan'],
                'den andra gatan',
                'Segunda betyder andra och primera första. Calle är gata.'),
            ordna('Bygg meningen: Museet ligger till vänster om banken.',
                  ['El', 'museo', ESTAR['él'], 'a', 'la', 'izquierda', 'del', 'banco.'],
                  forklaring='A la izquierda de betyder till vänster om. De och el blir del: a la izquierda del banco.'),
            val('Välj rätt ord: ¿Hay un supermercado ___ aquí? (Finns det en mataffär här i närheten?)',
                ['cerca de', 'al lado', 'entre', 'enfrente'], 'cerca de',
                'Cerca de betyder nära. ¿Hay un supermercado cerca de aquí? är ett vanligt sätt att fråga efter '
                'något i närheten.'),
            sant("I Latinamerika säger många 'sigue derecho' i stället för 'sigue recto'.", True,
                 'Båda betyder fortsätt rakt fram. Derecho med o betyder rakt, och derecha med a betyder höger.'),
            skriv('Fyll i ordet som saknas: El hospital está ___ de aquí. (Sjukhuset ligger långt härifrån.)',
                  svar('lejos'),
                  'Lejos de betyder långt från, och motsatsen är cerca de, nära.'),
            val("Vad betyder 'Está a cinco minutos a pie'?",
                ['Det är fem minuter dit till fots.', 'Det är fem minuter dit med bil.',
                 'Det tar femton minuter att gå dit.', 'Det är fem kvarter dit till fots.'],
                'Det är fem minuter dit till fots.',
                'A cinco minutos är fem minuter bort, och a pie betyder till fots.'),
            ordna('Bygg frågan: Ursäkta, var ligger biblioteket?', ['Perdón,', '¿dónde', ESTAR['él'], 'la', 'biblioteca?'],
                  forklaring='Perdón betyder ursäkta. Frågan börjar efter kommat, så ¿ står före dónde.'),
            val('Välj rätt ord: El cine está ___ el banco y la farmacia.', ['entre', 'cerca', 'enfrente', 'al lado'],
                'entre',
                'Entre betyder mellan: bion ligger mellan banken och apoteket.'),
            val('Välj rätt ord: Gira a la ___. (Sväng till höger.)', ['derecha', 'izquierda', 'recta', 'derecho'],
                'derecha',
                'Höger heter derecha och vänster izquierda. Derecho, med o, betyder rakt.'),
        ], beskrivning='Fråga efter vägen och förstå en vägbeskrivning.'),

        # -------------------------------------------- Framtid med ir a
        niva('es-ak9-framtid-1', 'Voy a …', FRAMTID, [
            para('Para ihop meningen med vad den betyder.',
                 [('Voy a dormir.', 'Jag ska sova.'), ('Va a llover.', 'Det kommer att regna.'),
                  ('Vas a ganar.', 'Du kommer att vinna.')],
                 'Ir a och en grundform säger vad som ska hända: voy a dormir, jag ska sova.'),
            val('Välj rätt form av ir: Mañana yo ___ a estudiar.', [IR['yo'], IR['él'], IR['tú'], 'ir'], IR['yo'],
                'Jag ska heter voy a. Efter voy a kommer verbet i grundform: voy a estudiar, jag ska plugga.'),
            ordna('Bygg meningen: I morgon ska jag spela fotboll.',
                  ['Mañana', IR['yo'], 'a', 'jugar', 'al', 'fútbol.'],
                  forklaring='Voy a jugar betyder jag ska spela. Ir a och verbets grundform säger vad som ska hända.'),
            skriv('Fyll i ir i presens: Nosotros ___ a viajar a México. (Vi ska resa till Mexiko.)',
                  svar(IR['nosotros']),
                  'Vi ska heter vamos a. Vamos a viajar betyder vi ska resa.'),
            sant("I 'voy a comer' står comer i grundform.", True,
                 'Efter ir a kommer alltid verbets grundform. Det är ir som böjs: voy a comer, vas a comer.'),
            val("Vad betyder 'Voy a ver una película'?",
                ['Jag ska se en film.', 'Jag såg en film.', 'Jag ser en film.', 'Hon ska se en film.'],
                'Jag ska se en film.',
                'Voy a och grundform betyder jag ska. Ver betyder se, så voy a ver är jag ska se.'),
            val('Välj rätt ord: Mi hermano va ___ nadar.', ['a', 'de', 'en', 'por'], 'a',
                'Mellan ir och grundformen står alltid a: va a nadar, han ska simma.'),
            skriv('Fyll i ir i presens: Ellos ___ a cenar en casa. (De ska äta middag hemma.)', svar(IR['ellos']),
                  'Ellos betyder de, och de ska heter van a: van a cenar.'),
            ordna('Bygg frågan: Vad ska du göra i morgon?', ['¿Qué', IR['tú'], 'a', 'hacer', 'mañana?'],
                  forklaring='Du ska heter vas a, och hacer betyder göra. Frågeordet qué står först, efter ¿.'),
            val('Vilken mening handlar om framtiden?',
                ['Voy a leer un libro.', 'Leo un libro.', 'Leí un libro.', 'Fui a la biblioteca.'],
                'Voy a leer un libro.',
                'Voy a leer betyder jag ska läsa. Leo är presens, och leí och fui är dåtid.'),
        ], beskrivning='Säg vad du ska göra med ir a och verbets grundform.'),

        niva('es-ak9-framtid-2', 'Mina planer', FRAMTID, [
            para('Para ihop tidsuttrycket med vad det betyder.',
                 [('pasado mañana', 'i övermorgon'), ('la semana que viene', 'nästa vecka'), ('esta noche', 'i kväll'),
                  ('el año que viene', 'nästa år')],
                 'Que viene betyder som kommer: la semana que viene är veckan som kommer, alltså nästa vecka.'),
            sant("'Mañana' kan betyda både i morgon och morgon.", True,
                 'Mañana betyder i morgon, och la mañana betyder morgonen. Mañana por la mañana är i morgon bitti.'),
            val('Välj rätt form av ir: El año que viene mi hermana ___ a estudiar en Madrid.',
                [IR['él'], IR['yo'], IR['ellos'], 'ir'], IR['él'],
                'Mi hermana är hon, och hon ska heter va a: va a estudiar, hon ska studera.'),
            ordna('Bygg meningen: Nästa vecka ska vi hälsa på min farmor.',
                  ['La', 'semana', 'que', 'viene', IR['nosotros'], 'a', 'visitar', 'a', 'mi', 'abuela.'],
                  forklaring='Vamos a visitar betyder vi ska hälsa på. Det andra a:et står före en person: '
                             'visitar a mi abuela.'),
            val('Vilken mening betyder "I kväll ska jag laga mat"?',
                ['Esta noche voy a cocinar.', 'Esta noche voy cocinar.', 'Esta noche vamos a cocinar.',
                 'Esta noche va a cocinar.'],
                'Esta noche voy a cocinar.',
                'Jag ska heter voy a, och a måste vara med före grundformen: voy a cocinar.'),
            skriv('Fyll i ir i presens: El sábado tú ___ a jugar al tenis. (På lördag ska du spela tennis.)',
                  svar(IR['tú']),
                  'Du ska heter vas a. Tú vas a jugar betyder du ska spela.'),
            val('Välj rätt tidsuttryck: ___ voy a ir a la playa.',
                ['El verano que viene', 'El verano pasado', 'El fin de semana pasado', 'Anoche'], 'El verano que viene',
                'Voy a ir handlar om framtiden, så tidsuttrycket måste också göra det: el verano que viene, '
                'nästa sommar.'),
            sant("'Voy a estudiar' handlar om något som redan har hänt.", False,
                 'Voy a estudiar betyder jag ska plugga. Ir a och grundform handlar om det som ska hända.'),
            val('Välj rätt form: Esta tarde voy a ___ con mis amigos.', ['salir', 'salgo', 'salí', 'sale'], 'salir',
                'Efter voy a kommer verbet alltid i grundform: voy a salir, jag ska gå ut.'),
            ordna('Bygg meningen: I morgon ska jag gå upp tidigt.', ['Mañana', IR['yo'], 'a', 'levantarme', 'temprano.'],
                  forklaring='Med ir a kan pronomenet sitta på grundformen: levantarme. Man kan också säga me voy '
                             'a levantar.'),
        ], beskrivning='Planera med ir a och tidsuttryck för framtiden, som la semana que viene.'),

        # -------------------------------------------- Dåtid med pretérito indefinido
        niva('es-ak9-datid-1', 'Ayer hablé', DATID, [
            val('Välj rätt form av hablar: Ayer yo ___ con mi abuela.',
                [indefinido('hablar')['yo'], presens_ar('hablar')['yo'], indefinido('hablar')['él'],
                 indefinido('hablar')['tú']],
                indefinido('hablar')['yo'],
                'Ayer betyder i går, så det ska vara dåtid. Jag-formen av -ar-verb slutar då på -é: hablé, jag pratade.'),
            val("Vad betyder 'Mi hermano estudió mucho'?",
                ['Min bror pluggade mycket.', 'Min bror pluggar mycket.', 'Jag pluggade mycket.',
                 'Min bror ska plugga mycket.'],
                'Min bror pluggade mycket.',
                'Estudió slutar på -ó med accent, och det är han-formen i dåtid. Estudio utan accent betyder jag pluggar.'),
            sant("'Hablo' och 'habló' betyder samma sak.", False,
                 'Accenten ändrar betydelsen. Hablo betyder jag pratar, och habló betyder han eller hon pratade.'),
            skriv('Fyll i comer i pretérito indefinido: Ayer yo ___ pescado.', svar(indefinido('comer')['yo']),
                  'Jag-formen av -er- och -ir-verb i dåtid slutar på -í: comí, jag åt.'),
            para('Para ihop verbformen med vad den betyder.', [(COMPRE[p], KOPTE[p]) for p in PERSONER],
                 'Ändelsen visar vem: -é jag, -aste du, -ó han eller hon, -amos vi och -aron de.'),
            val('Välj rätt form av escribir: Ayer ella me ___ una carta.',
                [indefinido('escribir')[p] for p in ('él', 'yo', 'ellos')] + ['escribe'],
                indefinido('escribir')['él'],
                'Ella är hon, och han- och hon-formen av -er- och -ir-verb i dåtid slutar på -ió: escribió.'),
            ordna('Bygg meningen: Förra helgen hälsade vi på mina kusiner.',
                  ['El', 'fin', 'de', 'semana', 'pasado', indefinido('visitar')['nosotros'], 'a', 'mis', 'primos.'],
                  forklaring='El fin de semana pasado är förra helgen. A står före personer: visitamos a mis primos.'),
            skriv('Fyll i beber i pretérito indefinido: Ayer tú ___ mucha agua.', svar(indefinido('beber')['tú']),
                  'Du-formen av -er- och -ir-verb i dåtid slutar på -iste: bebiste, du drack.'),
            val('Hur skrivs jugar i pretérito indefinido när det betyder jag spelade?',
                ['jugué', 'jugé', 'jugó', 'juegué'], 'jugué',
                'Ge uttalas med samma ljud som je, så jugé hade låtit fel. U:et gör att g:et låter som i jugar: jugué.'),
            sant("I dåtid ser 'hablamos' likadant ut som i presens.", True,
                 'Vi-formen av -ar-verb är samma i presens och i dåtid. Ayer hablamos betyder i går pratade vi.'),
        ], beskrivning='Pretérito indefinido för regelbundna verb: vad hände i går?'),

        niva('es-ak9-datid-2', 'Fui, fue, hice', DATID, [
            para('Para ihop tidsuttrycket med vad det betyder.',
                 [('ayer', 'i går'), ('anteayer', 'i förrgår'), ('la semana pasada', 'förra veckan'),
                  ('el año pasado', 'förra året')],
                 'Pasado betyder förra: la semana pasada är förra veckan. Anteayer är dagen före ayer.'),
            val('Välj rätt form av ir: El sábado pasado yo ___ al cine.', [FUI['yo'], FUI['él'], IR['yo'], FUI['tú']],
                FUI['yo'],
                'Ir är oregelbundet i dåtid. Jag gick eller åkte heter fui: fui al cine, jag gick på bio.'),
            sant("'Fui' kan betyda både jag gick och jag var.", True,
                 'Ir och ser har samma former i pretérito indefinido. Fui al cine är jag gick på bio, fui feliz '
                 'jag var lycklig.'),
            skriv('Fyll i hacer i pretérito indefinido: ¿Qué ___ tú ayer? (Vad gjorde du i går?)', svar(HICE['tú']),
                  'Hacer är oregelbundet i dåtid: hice, hiciste, hizo. Du gjorde heter hiciste.'),
            val('Välj rätt form av hacer: Ayer mi padre ___ la cena.', [HICE['él'], 'hació', HICE['yo'], 'hizó'],
                HICE['él'],
                'Han gjorde heter hizo, med z och utan accent. Hice är jag gjorde.'),
            ordna('Bygg meningen: I går åkte vi till stranden.', ['Ayer', FUI['nosotros'], 'a', 'la', 'playa.'],
                  extra=[IR['nosotros']],
                  forklaring='Fuimos är vi åkte, av ir. Ayer visar att det har hänt, så vamos passar inte.'),
            val("Vad betyder 'El viaje fue muy bonito'?",
                ['Resan var mycket fin.', 'Resan blir mycket fin.', 'Jag åkte på en fin resa.', 'Resan är mycket fin.'],
                'Resan var mycket fin.',
                'Fue kommer här från ser: resan var. Samma form kan också betyda han åkte, av ir.'),
            skriv('Fyll i ir i pretérito indefinido: Mis padres ___ a Madrid el año pasado.', svar(FUI['ellos']),
                  'De-formen av ir i dåtid är fueron: mis padres fueron a Madrid, mina föräldrar åkte till Madrid.'),
            val('Vilket tidsuttryck handlar om det som redan har hänt?',
                ['el verano pasado', 'el verano que viene', 'mañana por la tarde', 'pasado mañana'],
                'el verano pasado',
                'El verano pasado är förra sommaren. Pasado mañana betyder däremot i övermorgon.'),
            sant("'Anoche' betyder i går kväll.", True,
                 'Noche är kväll eller natt, och anoche är kvällen eller natten som var. I kväll heter esta noche.'),
        ], beskrivning='Ir, ser och hacer i dåtid, och tidsuttryck som ayer och el año pasado.'),
    ]),
]
