# -*- coding: utf-8 -*-
"""Franska åk 7 och 9 i NexLäx (2026-10-06). Moderna språk: en nybörjare i
åk 7 och en elev som läst franska i två till tre år i åk 9. Franska finns
bara i NexLäx (NX.NEXLAX_AMNEN). Frågorna ställs på svenska och det som
övas är på franska, som i en språkapp: para ihop ord, bygg meningar av
brickor, välj rätt form, skriv ett ord, och några påståenden om språket
att svara sant eller falskt på.

Åk 7: hälsa och presentera sig, talen 0–20 och åldern, familjen med
le/la/l'/les, un/une/des och mon/ma/mes, être och avoir i presens, och
regelbundna -er-verb med ne ... pas. Åk 9: mat och att beställa
(je voudrais, du/de la/des), vardagen med reflexiva verb, staden och
vägbeskrivningar, nära framtid med aller och infinitiv, och passé composé
med avoir och être. Nära framtid står före passé composé: aller och en
infinitiv är ett steg, passé composé är tre (hjälpverb, particip och
kongruens).

Bygger på Lgr22:s centrala innehåll i moderna språk: vardagliga
situationer, personer, platser, intressen och händelser, och språkets form
(uttal, ordförråd, grammatik och stavning). Allt är skrivet för banken;
inget är hämtat ur ett läromedel eller ett prov.

Talen och böjningarna står i tabeller här (TAL, ETRE, AVOIR, ALLER,
REFLEXIV, LEVER, PARTICIP), och facit läses ur dem, så att samma form inte
kan stavas på ett sätt i en fråga och på ett annat i nästa.

BRICKORNA. Rättningen jämför brickorna exakt. Frågetecknet är alltid en
egen bricka, sist, som i fransk typografi där det står ett mellanslag före
? (Comment tu t'appelles ?); _kolla_brickor() längst ner prövar det.
Punkten och kommat sitter på ordet före, som i engelska.py. Elisionen hålls
ihop i en bricka (j'ai, m'appelle, l'école): j' är inget eget ord. Där
franskan tillåter två ordningar (ett tidsord först eller sist, en fråga
med eller utan inversion) låser stor bokstav och punkten ordningen, eller
så är frågan ett val. En extra bricka ger aldrig en annan mening som också
är rätt.

SKRIV godtar formen utan accent, cedilj och ligatur efter den rätta
(['été', 'ete'], ['sœur', 'soeur']): rättningen jämför inte accenter, och
alla har inte franska tecken på tangentbordet. Den första formen visas som
facit. Där accenten är hela skillnaden mellan två ord (où och ou, à och a,
parlé och parle) är frågan ett val i stället.

FÖRENKLAT: tu och vous beskrivs som du till en kompis och vous till en
vuxen man inte känner eller till flera. I talspråk faller ne ofta bort;
banan övar skriftspråkets ne ... pas. Le foot, les maths och la télé är
vardagliga kortformer. Partitiven övas med regeln att du/de la/des blir de
efter en negation och efter en mängd; undantagen (efter être, i en
kontrast) tas inte upp. Kongruensen i passé composé med être övas där
subjektets genus syns (elle, ils, mes parents), och de reflexiva verben i
passé composé är inte med.
"""
import unicodedata

from grund import bana, niva, val, skriv, ordna, sant, para, tal


def utan_accent(t):
    """Texten utan accenter, cedilj och ligatur: été → ete, ç → c, œ → oe."""
    t = t.replace('œ', 'oe').replace('Œ', 'Oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', t) if not unicodedata.combining(c))


def godta(*former):
    """De godtagna svaren i en skriv-fråga: varje form, och direkt efter den
    samma form utan accent. Den första visas som facit."""
    ut = []
    for f in former:
        for g in (f, utan_accent(f)):
            if g not in ut:
                ut.append(g)
    return ut


assert godta('été') == ['été', 'ete'] and godta('sœur') == ['sœur', 'soeur']
assert godta('français') == ['français', 'francais'] and godta('merci') == ['merci']

# Talen 0–20. 17–19 byggs av dix och entalet med bindestreck; 11–16 har
# egna ord.
TAL = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
       'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit',
       'dix-neuf', 'vingt']
assert len(TAL) == 21 and TAL[10] == 'dix' and TAL[16] == 'seize' and TAL[20] == 'vingt'
assert all(TAL[10 + n] == 'dix-' + TAL[n] for n in (7, 8, 9))


def siffra(ordet):
    """Talet som siffror, ur ordet: siffra('treize') → '13'."""
    return tal(TAL.index(ordet))


def uppraknat(delar):
    """'a, b och c', med stor bokstav först och punkt sist."""
    t = ', '.join(delar[:-1]) + ' och ' + delar[-1]
    return t[0].upper() + t[1:] + '.'


# Böjningarna i presens.
ETRE = dict(je='suis', tu='es', il='est', elle='est', nous='sommes', vous='êtes', ils='sont', elles='sont')
AVOIR = dict(je='ai', tu='as', il='a', elle='a', nous='avons', vous='avez', ils='ont', elles='ont')
ALLER = dict(je='vais', tu='vas', il='va', elle='va', nous='allons', vous='allez', ils='vont', elles='vont')
REFLEXIV = dict(je='me', tu='te', il='se', elle='se', nous='nous', vous='vous', ils='se', elles='se')
# I presens får se lever accent grave när ändelsen är stum (je me lève),
# och inte när den hörs (nous nous levons).
LEVER = dict(je='lève', tu='lèves', il='lève', elle='lève', nous='levons', vous='levez',
             ils='lèvent', elles='lèvent')
ER_ANDELSE = dict(je='e', tu='es', il='e', elle='e', nous='ons', vous='ez', ils='ent', elles='ent')


def er(verb, person):
    """Ett regelbundet -er-verb i presens. Verb som ändrar stavningen
    (manger: nous mangeons, lever: je lève, appeler: je m'appelle) och
    aller står inte här."""
    assert verb.endswith('er') and verb not in ('manger', 'lever', 'appeler', 'aller')
    return verb[:-2] + ER_ANDELSE[person]


assert er('parler', 'nous') == 'parlons' and er('aimer', 'tu') == 'aimes' and er('jouer', 'ils') == 'jouent'
assert er('parler', 'vous') == 'parlez' and er('regarder', 'elles') == 'regardent'

# Perfektparticipen. -er-verben får -é; de andra lärs in ett och ett.
PARTICIP = dict(manger='mangé', regarder='regardé', jouer='joué', aller='allé', arriver='arrivé',
                rentrer='rentré', tomber='tombé', rester='resté', monter='monté',
                finir='fini', dormir='dormi', partir='parti', faire='fait', voir='vu', lire='lu',
                prendre='pris', boire='bu', venir='venu', etre='été', naitre='né')
assert all(PARTICIP[v] == v[:-2] + 'é' for v in PARTICIP if v.endswith('er'))


def kongruens(particip, femininum=False, plural=False):
    """Participet efter être böjs efter subjektet: allé, allée, allés, allées."""
    return particip + ('e' if femininum else '') + ('s' if plural else '')


assert kongruens('allé', True) == 'allée' and kongruens('parti', plural=True) == 'partis'
assert kongruens('rentré', plural=True) == 'rentrés' and kongruens('arrivé', True) == 'arrivée'

# Talen i sifferfrågorna i åk 7, med facit räknat här.
ORDNA_TAL = (7, 2, 10, 4)
PLUS_1 = (2, 3)
PLUS_2 = (7, 3)
PLUS_3 = (10, 6)
assert sum(PLUS_1) == 5 and sum(PLUS_2) == 10 and sum(PLUS_3) == 16


BANOR = [
    # ------------------------------------------------------------------ åk 7
    bana('Franska', 'ak7', [
        niva('fr-ak7-bonjour-1', 'Bonjour och au revoir', 'Hälsa och presentera dig', [
            para('Para ihop det franska uttrycket med det svenska.',
                 [('bonjour', 'god dag'), ('salut', 'tjena'), ('au revoir', 'hej då'),
                  ('bonne nuit', 'god natt'), ('à demain', 'vi ses i morgon')],
                 'Bonjour är den vanliga hälsningen, och salut säger man till kompisar. Au revoir är hej då, '
                 'och à demain betyder ungefär till i morgon.'),
            val('Vilken hälsning passar bäst när du kommer in i en butik i Frankrike?',
                ['bonjour', 'salut', 'au revoir', 'bonne nuit'], 'bonjour',
                'Bonjour passar till alla, också till vuxna du inte känner. Salut är för kompisar, au revoir '
                'säger du när du går och bonne nuit när någon ska sova.'),
            sant('”Salut” kan betyda både hej och hej då.', True,
                 'Salut säger man till kompisar både när man träffas och när man skiljs. Till vuxna säger man '
                 'hellre bonjour och au revoir.'),
            skriv('Skriv det franska ordet för ”tack”.', 'merci',
                  'Tack heter merci. Tack så mycket heter merci beaucoup.'),
            val("Vad betyder ”Je m'appelle Léa.”?",
                ['Jag heter Léa.', 'Jag ringer Léa.', 'Jag ser Léa.', 'Jag gillar Léa.'], 'Jag heter Léa.',
                "Je m'appelle betyder jag heter. Ordagrant är det jag kallar mig, därför står m' (mig) med."),
            ordna('Bygg meningen: Jag heter Hugo.', ['Je', "m'appelle", 'Hugo.'],
                  forklaring="Jag heter är je m'appelle. Me blir m' framför appelle, som börjar på vokal."),
            val('Skoldagen är slut och du säger hej då till din lärare. Vad säger du?',
                ['Au revoir, madame.', 'Bonjour, madame.', 'Bonne nuit, madame.', 'Salut, ça va ?'],
                'Au revoir, madame.',
                'Au revoir är hej då, och till en vuxen passar det bättre än salut. Bonjour säger du när du '
                'kommer, och bonne nuit när någon ska sova.'),
            sant("”S'il te plaît” betyder ursäkta.", False,
                 "S'il te plaît säger man när man ber om något, som snälla eller tack på svenska. Ursäkta "
                 'heter pardon eller excuse-moi.'),
            ordna('Bygg meningen: Hej då, vi ses i morgon.', ['Au', 'revoir,', 'à', 'demain.'],
                  forklaring='Au revoir är hej då och à demain är vi ses i morgon. Kommat står efter revoir, '
                             'som på svenska.'),
        ], beskrivning='Säga hej och hej då på rätt sätt, och säga vad du heter.'),

        niva('fr-ak7-bonjour-2', 'Ça va ?', 'Hälsa och presentera dig', [
            val('Vad betyder ”Ça va ?”',
                ['Hur är det?', 'Vad heter du?', 'Var är du?', 'Vem är det?'], 'Hur är det?',
                'Ça va ? är det vanligaste sättet att fråga hur någon mår. Svaret kan vara likadant, utan '
                'frågetecken: ça va, det är bra.'),
            para('Para ihop svaret med vad det betyder.',
                 [('très bien', 'mycket bra'), ('pas mal', 'inte illa'), ('comme ci, comme ça', 'sådär'),
                  ('ça ne va pas', 'det är inte bra')],
                 'Très betyder mycket och bien bra. Pas betyder inte, så pas mal är inte illa, och ne ... pas '
                 'runt va gör ça va nekande.'),
            sant('”Vous” kan sägas både till en person och till flera personer.', True,
                 'Vous är artigt när du talar till en vuxen du inte känner, och det är också ni när du talar '
                 'till flera. Tu säger du till en kompis, ett barn eller någon i familjen.'),
            val('Hur frågar du en vuxen du inte känner hur hen mår?',
                ['Comment allez-vous ?', 'Comment vas-tu ?', 'Comment vous appelez-vous ?', 'Ça va, toi ?'],
                'Comment allez-vous ?',
                'Till en vuxen du inte känner säger du vous, och då blir det comment allez-vous. Comment vous '
                'appelez-vous frågar vad någon heter.'),
            ordna('Bygg meningen: Det är bra, tack.', ['Ça', 'va', 'bien,', 'merci.'],
                  forklaring='Ça va bien betyder det är bra, och merci är tack. Ç har en cedilj, så att det '
                             'uttalas som s.'),
            skriv("Skriv ordet som saknas: Je m'appelle Paul, et ___ ? (Jag heter Paul, och du?)", ['toi', 'vous'],
                  'Och du? heter et toi ? till en kompis. Efter et står toi, inte tu. Till en vuxen säger du '
                  'et vous ?'),
            val('Vad betyder ”Enchanté”?',
                ['Trevligt att träffas', 'Det var så lite', 'Ha det så bra i kväll', 'Ursäkta mig'],
                'Trevligt att träffas',
                'Enchanté säger man när man träffar någon för första gången. En flicka skriver enchantée, '
                'med ett extra e, men det låter likadant.'),
            ordna('Bygg frågan: Vad heter du?', ['Comment', 'tu', "t'appelles", '?'],
                  forklaring="Comment betyder hur, och tu t'appelles är du kallar dig: hur kallar du dig? "
                             'På franska står det ett mellanslag före frågetecknet.'),
            val('Vilket svar passar på frågan ”Ça va ?”',
                ['Ça va, merci.', "Je m'appelle Tom.", "J'ai douze ans.", 'Au revoir !'], 'Ça va, merci.',
                'Ça va ? frågar hur det är, och ça va, merci betyder det är bra, tack. De andra svarar på vad '
                'du heter och hur gammal du är, eller säger hej då.'),
        ], beskrivning='Fråga hur någon mår och svara, och veta när du säger tu och vous.'),

        niva('fr-ak7-siffror-1', 'Från zéro till dix', 'Siffror och ålder', [
            para('Para ihop talet på franska med siffran.',
                 [(TAL[n], tal(n)) for n in (1, 3, 5, 8, 10)],
                 'Un är 1, trois är 3, cinq är 5, huit är 8 och dix är 10. Talen till tio är grunden för '
                 'alla tal som kommer sedan.'),
            val('Vilket tal är ”quatre”?', ['4', '14', '40', '8'], siffra('quatre'),
                'Quatre är 4. Quatorze (14) och quarante (40) börjar likadant, men de är längre.'),
            skriv('Skriv talet 2 med bokstäver på franska.', TAL[2],
                  'Två heter deux. X:et uttalas inte när deux står ensamt.'),
            val('Vilket ord är talet 9?', ['neuf', 'huit', 'sept', 'dix'], TAL[9],
                'Nio heter neuf. Huit är 8, sept är 7 och dix är 10.'),
            sant('”Sept” betyder sju.', TAL[7] == 'sept',
                 'Sept är 7. P:et uttalas inte, så sept låter ungefär som det svenska ordet sätt.'),
            ordna('Ordna talen från minst till störst.', [TAL[n] for n in sorted(ORDNA_TAL)],
                  forklaring=uppraknat(['%s är %d' % (TAL[n], n) for n in sorted(ORDNA_TAL)])),
            val('Vad blir %s + %s? Svara på franska.' % (TAL[PLUS_1[0]], TAL[PLUS_1[1]]),
                ['cinq', 'quatre', 'six', 'sept'], TAL[sum(PLUS_1)],
                '%s är %d och %s är %d. %d + %d = %d, och %d heter %s.'
                % (TAL[PLUS_1[0]].capitalize(), PLUS_1[0], TAL[PLUS_1[1]], PLUS_1[1], PLUS_1[0], PLUS_1[1],
                   sum(PLUS_1), sum(PLUS_1), TAL[sum(PLUS_1)])),
            skriv('Vad blir %s + %s? Skriv svaret med bokstäver på franska.' % (TAL[PLUS_2[0]], TAL[PLUS_2[1]]),
                  TAL[sum(PLUS_2)],
                  '%s är %d och %s är %d. %d + %d = %d, och %d heter %s.'
                  % (TAL[PLUS_2[0]].capitalize(), PLUS_2[0], TAL[PLUS_2[1]], PLUS_2[1], PLUS_2[0], PLUS_2[1],
                     sum(PLUS_2), sum(PLUS_2), TAL[sum(PLUS_2)])),
            skriv('Skriv talet 0 med bokstäver på franska.', godta(TAL[0]),
                  'Noll heter zéro, med accent aigu på e:et. Utan accent godtas det här, men skriv é om du kan.'),
        ], beskrivning='Talen från noll till tio: känna igen dem, skriva dem och räkna med dem.'),

        niva('fr-ak7-siffror-2', "J'ai treize ans", 'Siffror och ålder', [
            para('Para ihop talet på franska med siffran.',
                 [(TAL[n], tal(n)) for n in (11, 12, 14, 16, 20)],
                 'Onze är 11, douze är 12, quatorze är 14, seize är 16 och vingt är 20. Talen 11–16 har egna '
                 'ord.'),
            val('Vilket tal är ”treize”?', ['13', '3', '30', '12'], siffra('treize'),
                'Treize är 13. Trois är 3, trente är 30 och douze är 12.'),
            val('Hur skriver man 17 på franska?', ['dix-sept', 'sept-dix', 'dix-six', 'seize'], TAL[17],
                'Sjutton är tio och sju: dix-sept, med bindestreck. 16 har ett eget ord, seize.'),
            sant("Den som är 13 år säger på franska ”J'ai treize ans”, med verbet avoir (ha).", True,
                 "På franska har man sin ålder: j'ai treize ans betyder ordagrant jag har tretton år."),
            ordna('Bygg meningen: Jag är fjorton år.', ["J'ai", TAL[14], 'ans.'], extra=['Je', 'suis'],
                  forklaring="Åldern säger man med avoir: j'ai quatorze ans. Je suis quatorze ans är fel, och "
                             'ans måste vara med.'),
            val('Hur frågar du en kompis hur gammal hen är?',
                ['Tu as quel âge ?', 'Tu es quel âge ?', 'Tu as combien ?', 'Quel âge tu es ?'],
                'Tu as quel âge ?',
                'Tu as quel âge ? är ordagrant du har vilken ålder? Åldern hör ihop med avoir, så es är fel, '
                'och utan âge blir frågan ofullständig.'),
            skriv('Skriv talet 15 med bokstäver på franska.', TAL[15],
                  'Femton heter quinze. Qu uttalas som k.'),
            skriv('Skriv talet 19 med bokstäver på franska.', [TAL[19], 'dix neuf'],
                  'Nitton är tio och nio: dix-neuf, med bindestreck mellan orden.'),
            val('Vad blir %s + %s? Svara på franska.' % (TAL[PLUS_3[0]], TAL[PLUS_3[1]]),
                ['seize', 'six', 'treize', 'dix-six'], TAL[sum(PLUS_3)],
                'Dix är 10 och six är 6. 10 + 6 = 16, och sexton heter seize. Dix-six finns inte, för 16 har '
                'ett eget ord.'),
            skriv('Vilket tal är ”dix-huit”? Svara med siffror.', siffra('dix-huit'),
                  'Dix-huit är tio och åtta, alltså 18.'),
        ], beskrivning='Talen 11–20, och att säga hur gammal du är med j\'ai ... ans.'),

        niva('fr-ak7-familjen-1', "Le, la, l' och les", 'Familjen och artiklarna', [
            para('Para ihop ordet med det svenska.',
                 [('le père', 'pappa'), ('la mère', 'mamma'), ('le frère', 'bror'), ('les parents', 'föräldrar'),
                  ('le grand-père', 'farfar eller morfar')],
                 'Le står före maskulina ord och la före feminina. Les är artikeln i plural, oavsett genus.'),
            val('Vilken artikel passar? ___ tante (fastern eller mostern)', ['la', 'le', 'les', "l'"], 'la',
                'Tante är femininum, och framför feminina ord i singular står la.'),
            val('Vilken artikel passar? ___ cousin (kusinen)', ['le', 'la', 'les', "l'"], 'le',
                'Cousin är maskulinum, och framför maskulina ord i singular står le. En kusin som är flicka '
                'heter la cousine.'),
            val('Vilken artikel passar? ___ ami (kompisen)', ["l'", 'le', 'la', 'les'], "l'",
                "Ami börjar på vokal, och då blir le till l': l'ami. Två vokaler i rad hade varit svåra att "
                'säga.'),
            sant("I ”l'école” har la blivit l', eftersom école börjar på en vokal.", True,
                 "Framför vokal blir både le och la till l': l'école, l'oncle. Då går orden ihop när man "
                 'säger dem.'),
            skriv('Skriv ordet för ”syster” på franska.', godta('sœur', 'la sœur', 'une sœur'),
                  'Syster heter sœur, med œ: o och e ihop. Kan du inte skriva œ går oe bra.'),
            skriv('Skriv artikeln som passar: ___ enfants (barnen)', ['les', 'les enfants'],
                  'Enfants slutar på -s och betyder barnen, alltså plural. I plural är artikeln alltid les.'),
            ordna('Bygg meningen: Det är Léas mamma.', ["C'est", 'la', 'mère', 'de', 'Léa.'],
                  forklaring="Léas mamma blir mamman till Léa: la mère de Léa. Franskan har inget genitiv-s. "
                             "C'est betyder det är."),
            sant('”La grand-mère” betyder farmor eller mormor.', True,
                 'Grand-mère är pappas eller mammas mamma, och grand-père är farfar eller morfar.'),
            val("Vem är ”l'oncle”?",
                ['pappas eller mammas bror', 'pappas eller mammas pappa', 'pappas eller mammas syster',
                 'mammas och pappas son'], 'pappas eller mammas bror',
                "L'oncle är farbror eller morbror. Mammas och pappas son är en bror, le frère."),
        ], beskrivning="Familjens ord, och bestämd artikel: le, la, l' och les."),

        niva('fr-ak7-familjen-2', 'Mon frère, ma sœur', 'Familjen och artiklarna', [
            val("Vilket ord passar? J'ai ___ sœur.", ['une', 'un', 'des'], 'une',
                'Sœur är femininum, och en heter då une. Un står före maskulina ord.'),
            val("Vilket ord passar? C'est ___ stylo.", ['un', 'une', 'des'], 'un',
                'Stylo är maskulinum, så det blir un stylo. Une står före feminina ord och des före ord i '
                'plural.'),
            val("Vilket ord passar? J'ai ___ cousins.", ['des', 'un', 'une'], 'des',
                'Cousins är plural, och i plural heter en eller några des, oavsett genus.'),
            para('Para ihop med det svenska.',
                 [('mon père', 'min pappa'), ('ma mère', 'min mamma'), ('mes parents', 'mina föräldrar'),
                  ('ton chien', 'din hund'), ('ta sœur', 'din syster')],
                 'Mon, ma och mes är min och mina; ton, ta och tes är din och dina. Ordet efter avgör formen: '
                 'mon père, ma mère, mes parents.'),
            val("Välj rätt ord: ___ cousine s'appelle Léa.", ['Ma', 'Mon', 'Mes'], 'Ma',
                'Cousine är femininum, en flicka, och börjar inte på vokal. Då blir det ma cousine.'),
            val("Välj rätt ord: ___ amis s'appellent Tom et Léo.", ['Mes', 'Mon', 'Ma'], 'Mes',
                'Amis slutar på -s och är plural, och i plural heter min mes: mes amis.'),
            sant('Man säger ”mon amie” och inte ”ma amie”, fast amie är femininum.', True,
                 'Framför vokal blir ma till mon, för att två vokaler i rad är svåra att säga: mon amie, '
                 'mon école.'),
            skriv('Skriv ordet som saknas: mon ___ (min bror)', godta('frère'),
                  'Bror heter frère, med accent grave på det första e:et. Utan accent godtas det här.'),
            ordna('Bygg meningen: Jag har en syster och två kusiner.',
                  ["J'ai", 'une', 'sœur', 'et', TAL[2], 'cousins.'],
                  forklaring='Une står före sœur, som är femininum. Deux cousins är två kusiner, och s:et i '
                             'plural hörs inte.'),
            val('Vad betyder ”ta tante”?',
                ['din faster eller moster', 'min faster eller moster', 'dina fastrar', 'din farmor'],
                'din faster eller moster',
                'Ta betyder din, och tante är faster eller moster. Min heter ma, och farmor heter grand-mère.'),
        ], beskrivning='Obestämd artikel med un, une och des, och min och din med mon, ma och mes.'),

        niva('fr-ak7-etre-avoir-1', 'Je suis, tu es', 'Être och avoir', [
            para('Para ihop adjektivet med det svenska.',
                 [('content', 'glad'), ('fatigué', 'trött'), ('grand', 'lång'), ('petit', 'liten'),
                  ('malade', 'sjuk')],
                 'Adjektiven står ofta efter être: je suis content, il est fatigué. En flicka skriver contente '
                 'och fatiguée.'),
            val('Välj rätt form av être: Mon chat ___ noir.', ['est', 'es', 'sont', 'êtes'], ETRE['il'],
                'Mon chat kan bytas mot il, och efter il kommer est.'),
            val('Välj rätt form av être: Tu ___ fatigué ?', ['es', 'est', 'suis', 'êtes'], ETRE['tu'],
                'Efter tu kommer es: tu es. Est hör till il och elle.'),
            skriv('Skriv rätt form av être: Nous ___ amis.', ETRE['nous'],
                  'Vi är heter nous sommes. Den formen följer ingen regel, så den måste läras in.'),
            skriv('Skriv rätt form av être: Vous ___ français ?', godta(ETRE['vous']),
                  'Ni är heter vous êtes, med cirkumflex på det första e:et.'),
            ordna('Bygg meningen: Jag är i skolan.', ['Je', ETRE['je'], 'à', "l'école."],
                  forklaring="Jag är heter je suis, och i skolan heter à l'école. À betyder i eller på här."),
            val('Vad betyder ”Ils sont contents.”?',
                ['De är glada.', 'Vi är glada.', 'Han är glad.', 'Ni är glada.'], 'De är glada.',
                'Ils betyder de, och ils sont är de är. Contents har -s för att det är flera.'),
            sant('”Je suis douze ans” är rätt franska för jag är tolv år.', False,
                 "Åldern säger man med avoir: j'ai douze ans, ordagrant jag har tolv år."),
            sant('”Ils sont” betyder de har.', False,
                 'Ils sont betyder de är, och sont är en form av être. De har heter ils ont, med avoir.'),
        ], beskrivning='Verbet être (vara) i presens, med adjektiv som glad och trött.'),

        niva('fr-ak7-etre-avoir-2', "J'ai, tu as", 'Être och avoir', [
            para('Para ihop uttrycket med det svenska.',
                 [("j'ai faim", 'jag är hungrig'), ("j'ai soif", 'jag är törstig'), ("j'ai froid", 'jag fryser'),
                  ("j'ai chaud", 'jag är varm'), ("j'ai peur", 'jag är rädd')],
                 "På franska har man hunger, törst, kyla och rädsla: avoir faim, avoir soif. Därför blir det "
                 "j'ai, inte je suis."),
            val('Välj rätt form av avoir: Tu ___ un chien ?', ['as', 'a', 'es', 'ai'], AVOIR['tu'],
                'Efter tu kommer as: tu as. A hör till il och elle, och es är en form av être.'),
            val('Välj rätt form av avoir: Ils ___ deux chats.', ['ont', 'sont', 'a', 'avez'], AVOIR['ils'],
                'Ils ont betyder de har. Ils sont betyder de är, och de två är lätta att blanda ihop.'),
            skriv('Skriv rätt form av avoir: Nous ___ une grande maison.', AVOIR['nous'],
                  'Vi har heter nous avons. Efter nous slutar verbet nästan alltid på -ons.'),
            val('Välj rätt form av avoir: Elle ___ treize ans.', ['a', 'as', 'est', 'ont'], AVOIR['elle'],
                'Efter elle kommer a: elle a. Åldern säger man med avoir, inte med être.'),
            sant('”Il a” betyder han har, och a skrivs utan accent.', True,
                 'Il a är han har. À med accent är ett annat ord, som betyder till eller i: il va à Paris.'),
            ordna('Bygg meningen: Hon har en röd cykel.', ['Elle', AVOIR['elle'], 'un', 'vélo', 'rouge.'],
                  extra=['as'],
                  forklaring='Efter elle kommer a, inte as. Färgen står efter saken: un vélo rouge.'),
            skriv('Skriv rätt form av avoir: Vous ___ des frères ?', AVOIR['vous'],
                  'Ni har heter vous avez. Efter vous slutar verbet nästan alltid på -ez.'),
            sant('”Nous sommes” är en form av avoir.', False,
                 'Nous sommes är vi är, en form av être. Vi har heter nous avons.'),
        ], beskrivning='Verbet avoir (ha) i presens, och uttryck som j\'ai faim.'),

        niva('fr-ak7-fritiden-1', 'Je parle, tu parles', 'Skolan och fritiden', [
            para('Para ihop verbet med det svenska.',
                 [('parler', 'prata'), ('aimer', 'tycka om'), ('jouer', 'spela'), ('regarder', 'titta på'),
                  ('écouter', 'lyssna på')],
                 "Alla fem är -er-verb, och de böjs på samma sätt: je parle, j'aime, je joue, je regarde, "
                 "j'écoute."),
            val('Välj rätt form av parler: Nous ___ français.', ['parlons', 'parlez', 'parlent', 'parle'],
                er('parler', 'nous'),
                'Efter nous får -er-verben ändelsen -ons: nous parlons.'),
            val('Välj rätt form av aimer: Tu ___ le foot ?', ['aimes', 'aime', 'aimez', 'aiment'],
                er('aimer', 'tu'),
                'Efter tu får -er-verben ett -s: tu aimes. S:et hörs inte, men det ska skrivas.'),
            skriv('Skriv rätt form av jouer: Je ___ au tennis.', er('jouer', 'je'),
                  'Jouer blir je joue: stammen jou- och ändelsen -e.'),
            skriv('Skriv rätt form av parler: Vous ___ suédois ?', er('parler', 'vous'),
                  'Efter vous får -er-verben ändelsen -ez: vous parlez.'),
            sant('I ”ils parlent” uttalas inte ändelsen -ent.', True,
                 'Ändelsen -ent i verbet är stum, så ils parlent låter precis som il parle. Den ska ändå '
                 'skrivas.'),
            ordna('Bygg meningen: Vi lyssnar på radio.', ['Nous', er('écouter', 'nous'), 'la', 'radio.'],
                  extra=[er('écouter', 'vous')],
                  forklaring='Efter nous kommer -ons: nous écoutons. Écoutez hör till vous. Lyssna på heter '
                             'bara écouter, utan något ord för på.'),
            val('Vilken ändelse får ett -er-verb efter vous?', ['-ez', '-ons', '-ent', '-es'],
                '-' + ER_ANDELSE['vous'],
                'Vous parlez, vous aimez, vous jouez: efter vous slutar -er-verben på -ez.'),
            val('Vad betyder ”Elles regardent la télé.”?',
                ['De tittar på tv.', 'Hon tittar på tv.', 'Vi tittar på tv.', 'Ni tittar på tv.'],
                'De tittar på tv.',
                'Elles är de, när alla är flickor eller kvinnor. Ändelsen -ent visar att det är flera.'),
            ordna('Bygg meningen: Min bror tycker om att spela fotboll.',
                  ['Mon', 'frère', er('aimer', 'il'), 'jouer', 'au', 'foot.'],
                  forklaring='Efter aimer står nästa verb i grundform: il aime jouer. Spela fotboll heter '
                             'jouer au foot.'),
        ], beskrivning='Regelbundna -er-verb i presens: parler, aimer, jouer och några till.'),

        niva('fr-ak7-fritiden-2', 'Ne ... pas', 'Skolan och fritiden', [
            ordna('Bygg meningen: Jag spelar inte tennis.', ['Je', 'ne', er('jouer', 'je'), 'pas', 'au', 'tennis.'],
                  forklaring='Ne står före verbet och pas efter: je ne joue pas. Tillsammans betyder de inte.'),
            val('Hur säger man ”Jag pratar inte engelska”?',
                ['Je ne parle pas anglais.', 'Je parle ne pas anglais.', 'Je ne pas parle anglais.',
                 'Je parle pas ne anglais.'], 'Je ne parle pas anglais.',
                'Ne och pas ramar in verbet: ne före och pas efter. Ingen annan ordning är rätt.'),
            sant("I ”Je n'aime pas les maths” har ne blivit n' för att aime börjar på vokal.", True,
                 "Ne blir n' framför vokal, precis som je blir j': je n'aime pas."),
            skriv('Skriv ordet som saknas: Tu ne regardes ___ la télé. (Du tittar inte på tv.)', 'pas',
                  'En nekande mening behöver både ne och pas: tu ne regardes pas la télé.'),
            val('Vilken mening betyder ”Hon tycker inte om skolan”?',
                ["Elle n'aime pas l'école.", "Elle aime pas ne l'école.", "Elle ne aime pas l'école.",
                 "Elle n'aime l'école pas."], "Elle n'aime pas l'école.",
                "Ne blir n' framför aime, och pas står direkt efter verbet: elle n'aime pas l'école."),
            para('Para ihop sakerna i skolväskan med det svenska.',
                 [('un cahier', 'en skrivbok'), ('un stylo', 'en penna'), ('une trousse', 'ett pennfack'),
                  ('un livre', 'en bok'), ('une gomme', 'ett suddgummi')],
                 'Un står före maskulina ord och une före feminina. Lär dig orden med artikeln, så vet du '
                 'genuset.'),
            val('Vad heter skolämnet matematik på franska?', ['les maths', 'le sport', 'la musique', "l'histoire"],
                'les maths',
                'Matematik heter les mathématiques, och i vardagen säger alla les maths. L\'histoire är historia.'),
            ordna('Bygg meningen: Vi tittar inte på tv.', ['Nous', 'ne', er('regarder', 'nous'), 'pas', 'la', 'télé.'],
                  forklaring='Ne står före verbet och pas efter: nous ne regardons pas. Ändelsen -ons hör till '
                             'nous.'),
            val('Välj rätt form av jouer: Ils ne ___ pas au foot.', ['jouent', 'joue', 'jouons', 'jouez'],
                er('jouer', 'ils'),
                'Ils betyder de, och efter ils får verbet -ent: ils ne jouent pas.'),
            skriv('Skriv språket franska på franska.', godta('français', 'le français'),
                  'Franska heter le français, med cedilj under c så att det uttalas som s. Språk skrivs med '
                  'liten bokstav på franska.'),
        ], beskrivning='Säga att du inte gör något med ne ... pas, och ord från skolan.'),
    ]),

    # ------------------------------------------------------------------ åk 9
    bana('Franska', 'ak9', [
        niva('fr-ak9-mat-1', "Un croissant, s'il vous plaît", 'Mat och att beställa', [
            para('Para ihop maten med det svenska.',
                 [('le pain', 'bröd'), ('la viande', 'kött'), ('les pommes', 'äpplen'), ("l'eau", 'vatten'),
                  ('le poisson', 'fisk')],
                 "Lär dig maten med artikeln: le pain, la viande, l'eau. Artikeln visar genuset, och det "
                 'behövs när du ska beställa.'),
            val('Vad betyder ”je voudrais”?',
                ['jag skulle vilja', 'jag ville inte ha', 'jag kommer att ta', 'jag tycker om'],
                'jag skulle vilja',
                'Je voudrais är en artig form av vouloir (vilja). Det är så man beställer: je voudrais un café.'),
            ordna('Bygg meningen: Jag skulle vilja ha en croissant, tack.',
                  ['Je', 'voudrais', 'un', 'croissant,', "s'il vous plaît."],
                  forklaring="Je voudrais är jag skulle vilja ha. S'il vous plaît säger man när man ber om "
                             'något, och till personalen säger man vous.'),
            val('Vad vill servitören veta när hen frågar ”Et comme boisson ?”',
                ['vad du vill dricka', 'vad du vill äta', 'om du vill ha efterrätt', 'var du vill sitta'],
                'vad du vill dricka',
                'Une boisson är en dryck. Et comme boisson ? betyder och att dricka?'),
            val('Du vill betala på restaurangen. Vad säger du?',
                ["L'addition, s'il vous plaît.", "La carte, s'il vous plaît.",
                 "Une table pour deux, s'il vous plaît.", 'Bon appétit !'],
                "L'addition, s'il vous plaît.",
                "L'addition är notan. La carte är menyn, och une table pour deux är ett bord för två."),
            val('Vilket ord passar? Je voudrais ___ pain. (lite bröd)', ['du', 'de la', 'des'], 'du',
                'Pain är maskulinum, och lite bröd heter du pain. Du är de och le ihop.'),
            sant('”Bon appétit” säger man när man ska börja äta.', True,
                 'Bon appétit betyder smaklig måltid. Ordagrant är det god aptit.'),
            skriv('Skriv det franska ordet för ”ost”.', godta('fromage', 'le fromage', 'du fromage', 'un fromage'),
                  'Ost heter fromage, och det är maskulinum: le fromage, du fromage.'),
            val('Vad betyder ”Je prends le poulet.”?',
                ['Jag tar kycklingen.', 'Jag tycker om kyckling.', 'Jag har en kyckling.', 'Jag äter inte kyckling.'],
                'Jag tar kycklingen.',
                'Je prends betyder jag tar, och det säger man när man beställer. Le poulet är kycklingen.'),
            val('Servitören frågar ”Vous avez choisi ?” Vad betyder det?',
                ['Har ni bestämt er?', 'Har ni betalat?', 'Är ni hungriga?', 'Vill ni sitta vid fönstret?'],
                'Har ni bestämt er?',
                'Choisir betyder välja. Vous avez choisi ? är har ni valt, alltså har ni bestämt er.'),
        ], beskrivning='Mat och dryck, och att beställa artigt på ett kafé eller en restaurang.'),

        niva('fr-ak9-mat-2', 'Du, de la, des', 'Mat och att beställa', [
            val("Vilket ord passar? Je voudrais ___ eau, s'il vous plaît.", ["de l'", 'du', 'de la', 'des'], "de l'",
                "Eau börjar på vokal, så de la blir de l': de l'eau."),
            val('Vilket ord passar? Je mange ___ salade.', ['de la', 'du', 'des', "de l'"], 'de la',
                'Salade är femininum, och lite sallad heter de la salade.'),
            val('Vilket ord passar? Tu veux ___ fraises ?', ['des', 'du', 'de la'], 'des',
                'Fraises är plural, och i plural blir det des: des fraises.'),
            sant('”Du” är de och le ihop.', True,
                 'De och le går alltid ihop till du: du pain, du fromage. De och la blir inte ett ord: de la '
                 'viande.'),
            skriv('Skriv ordet som saknas: Je ne bois pas ___ lait.', 'de',
                  'Efter en negation blir du, de la och des till de: je ne bois pas de lait.'),
            sant("I ”un kilo de pommes” står de utan artikel, eftersom un kilo är en mängd.", True,
                 "Efter en mängd står bara de: un kilo de pommes, une bouteille d'eau, beaucoup de sucre."),
            val('Vilket uttryck betyder ”en flaska vatten”?',
                ["une bouteille d'eau", "une bouteille de l'eau", 'une bouteille des eaux', 'une bouteille du eau'],
                "une bouteille d'eau",
                "Efter en mängd står bara de, och framför vokal blir det d': une bouteille d'eau."),
            para('Para ihop mängden med det svenska.',
                 [('beaucoup de', 'mycket'), ('un peu de', 'lite'), ('un kilo de', 'ett kilo'),
                  ('une tranche de', 'en skiva'), ('un verre de', 'ett glas')],
                 'Alla mängdorden följs av de: beaucoup de pain, un verre de lait, une tranche de jambon.'),
            ordna('Bygg meningen: Hon dricker inte kaffe.', ['Elle', 'ne', 'boit', 'pas', 'de', 'café.'],
                  forklaring='Ne och pas står runt verbet, och efter negationen blir du café till de café.'),
            val('Hur säger man ”lite socker”?',
                ['un peu de sucre', 'un peu du sucre', 'un peu sucre', 'un peu des sucres'], 'un peu de sucre',
                'Un peu är en mängd, och efter en mängd står bara de: un peu de sucre.'),
        ], beskrivning='Partitiv artikel: du, de la och des, och när de blir bara de.'),

        niva('fr-ak9-vardagen-1', 'Je me lève', 'Vardagen och reflexiva verb', [
            para('Para ihop verbet med det svenska.',
                 [('se lever', 'stiga upp'), ('se coucher', 'lägga sig'), ('se laver', 'tvätta sig'),
                  ("s'habiller", 'klä på sig'), ('se réveiller', 'vakna')],
                 'Reflexiva verb har ett extra pronomen, som sig på svenska: se laver är tvätta sig.'),
            val('Välj rätt pronomen: Je ___ douche le matin.', ['me', 'te', 'se', 'nous'], REFLEXIV['je'],
                'Efter je kommer me: je me douche. Pronomenet följer subjektet.'),
            val('Välj rätt pronomen: Tu ___ couches à quelle heure ?', ['te', 'me', 'se', 'vous'], REFLEXIV['tu'],
                'Efter tu kommer te: tu te couches.'),
            skriv('Skriv rätt pronomen: Elle ___ lave les mains.', REFLEXIV['elle'],
                  'Efter il, elle, ils och elles kommer se: elle se lave.'),
            sant("I ”je m'habille” har me blivit m' för att habille börjar på ett stumt h.", True,
                 "Me blir m' framför vokal och stumt h: je m'habille, je m'appelle."),
            ordna('Bygg meningen: Jag lägger mig klockan tio.',
                  ['Je', REFLEXIV['je'], er('coucher', 'je'), 'à', TAL[10], 'heures.'],
                  forklaring='Pronomenet står mellan subjektet och verbet: je me couche. Klockan tio heter à '
                             'dix heures.'),
            val('Vad betyder ”Il se brosse les dents.”?',
                ['Han borstar tänderna.', 'Han tvättar händerna.', 'Han borstar håret.', 'Han klär på sig.'],
                'Han borstar tänderna.',
                'Se brosser är borsta sig, och les dents är tänderna. Om den egna kroppen säger man les, inte '
                'ses.'),
            val('Välj rätt form: Nous nous ___ tôt.', ['levons', 'lèvons', 'levez', 'lève'], LEVER['nous'],
                'Med nous har lever ingen accent: nous nous levons. I presens kommer accent grave när ändelsen '
                'är stum: je me lève, ils se lèvent.'),
            skriv('Skriv rätt form av se lever: Je me ___ à sept heures.', godta(LEVER['je']),
                  'Je me lève, med accent grave på det första e:et, för ändelsen är stum. Utan accent godtas '
                  'det här.'),
            val('Vilken mening betyder ”Vi vaknar klockan sex”?',
                ['Nous nous réveillons à six heures.', 'Nous réveillons nous à six heures.',
                 'Nous nous réveillez à six heures.', 'Nous se réveillons à six heures.'],
                'Nous nous réveillons à six heures.',
                'Nous står två gånger: först som subjekt och sedan som reflexivt pronomen. Efter nous slutar '
                'verbet på -ons.'),
        ], beskrivning='Reflexiva verb i presens: morgonen och kvällen med se lever och se coucher.'),

        niva('fr-ak9-vardagen-2', 'Comment vous appelez-vous ?', 'Vardagen och reflexiva verb', [
            val('Välj rätt form: Mes cousins ___ Paul et Hugo.',
                ["s'appellent", "s'appelle", "s'appelent", 'se appellent'], "s'appellent",
                "Ils s'appellent har två l, för ändelsen -ent är stum. Se blir s' framför vokal."),
            sant('I ”nous nous appelons” stavas verbet med ett l.', True,
                 "I presens har appeler ett l när ändelsen hörs (nous appelons, vous appelez) och två l när "
                 "den är stum (je m'appelle, ils s'appellent)."),
            val('Hur frågar du artigt en vuxen vad hen heter?',
                ['Comment vous appelez-vous ?', "Comment tu t'appelles ?", 'Comment vous appelle-vous ?',
                 "Comment s'appelle-t-il ?"], 'Comment vous appelez-vous ?',
                'Till en vuxen säger du vous, och vous står två gånger: vous vous appelez. Efter vous slutar '
                'verbet på -ez.'),
            ordna('Bygg meningen: Jag stiger inte upp tidigt.', ['Je', 'ne', REFLEXIV['je'], LEVER['je'], 'pas', 'tôt.'],
                  forklaring='Ne står före det reflexiva pronomenet och pas efter verbet: je ne me lève pas.'),
            val('Var står ne och pas? Välj den mening som är rätt.',
                ['Il ne se lave pas.', 'Il se ne lave pas.', 'Il ne se pas lave.', 'Il se lave ne pas.'],
                'Il ne se lave pas.',
                'Ne och pas ramar in pronomenet och verbet tillsammans: il ne se lave pas.'),
            skriv('Skriv rätt pronomen: Vous ___ habillez vite.', REFLEXIV['vous'],
                  'Med vous blir det reflexiva pronomenet också vous: vous vous habillez.'),
            ordna('Ordna meningarna så att de beskriver en morgon i rätt ordning.',
                  ['Il se réveille.', 'Il se lève.', "Il s'habille.", "Il va à l'école."],
                  forklaring='Först vaknar han, sedan stiger han upp, klär på sig och går till skolan.'),
            val('Vad betyder ”Elle se couche tard.”?',
                ['Hon lägger sig sent.', 'Hon går upp sent.', 'Hon lägger sig tidigt.', 'Hon kommer för sent.'],
                'Hon lägger sig sent.',
                'Se coucher är lägga sig, och tard betyder sent. Tidigt heter tôt.'),
            para('Para ihop tiden på dagen med det svenska.',
                 [('le matin', 'på morgonen'), ("l'après-midi", 'på eftermiddagen'), ('le soir', 'på kvällen'),
                  ('la nuit', 'på natten')],
                 'Le matin betyder både morgonen och på morgonen: je me lève le matin. Det behövs ingen '
                 'preposition.'),
            ordna('Bygg frågan: Hur dags går du upp?',
                  ['Tu', REFLEXIV['tu'], LEVER['tu'], 'à', 'quelle', 'heure', '?'],
                  forklaring='Tu te lèves är du stiger upp, och à quelle heure är vid vilken tid. Frågetecknet '
                             'står för sig, som i fransk text.'),
        ], beskrivning="S'appeler och de andra reflexiva verben, också i nekande meningar."),

        niva('fr-ak9-staden-1', 'Il y a une boulangerie', 'Staden och vägbeskrivningar', [
            para('Para ihop platsen med det svenska.',
                 [('la gare', 'järnvägsstationen'), ('la boulangerie', 'bageriet'), ("l'hôpital", 'sjukhuset'),
                  ('la bibliothèque', 'biblioteket'), ('la piscine', 'simhallen')],
                 "Lär dig platserna med artikeln. L'hôpital är maskulinum, och h:et uttalas inte."),
            val("Vad betyder ”Il y a un parc près de l'école.”?",
                ['Det finns en park nära skolan.', 'Det finns en skola i parken.',
                 'Parken ligger långt från skolan.', 'Han är i parken efter skolan.'],
                'Det finns en park nära skolan.',
                'Il y a betyder det finns, och près de betyder nära.'),
            sant('”Il y a” ändras inte när det som finns är flera: il y a deux cafés.', True,
                 'Il y a är samma i singular och plural: il y a un café, il y a deux cafés.'),
            ordna('Bygg meningen: Det finns två bagerier i stan.',
                  ['Il', 'y', 'a', TAL[2], 'boulangeries', 'en', 'ville.'],
                  forklaring='Il y a är det finns och står först. En ville betyder i stan.'),
            ordna('Bygg frågan: Var ligger stationen?', ['Où', 'est', 'la', 'gare', '?'],
                  forklaring='Où betyder var, med accent grave. Utan accent är ou ett annat ord, som betyder '
                             'eller.'),
            val('Vad betyder ”la mairie”?', ['stadshuset', 'havet', 'kyrkan', 'polisstationen'], 'stadshuset',
                "La mairie är stadshuset, där borgmästaren (le maire) arbetar. Havet heter la mer och kyrkan "
                "l'église."),
            val('Välj rätt ord: Je vais ___ cinéma.', ['au', 'à la', 'à le', 'aux'], 'au',
                'Cinéma är maskulinum, och à och le blir au: je vais au cinéma. À le skrivs aldrig.'),
            val('Välj rätt ord: Elle va ___ piscine.', ['à la', 'au', 'aux', "à l'"], 'à la',
                'Piscine är femininum, och à och la blir inte ett ord: elle va à la piscine.'),
            sant('”Il y a une pharmacie à côté de la poste” betyder att apoteket ligger bredvid posten.', True,
                 'À côté de betyder bredvid. Apoteket heter la pharmacie och posten la poste.'),
            skriv('Skriv det franska ordet för ”bank”.', ['banque', 'la banque', 'une banque'],
                  'Bank heter banque, med qu som uttalas k. Det är femininum: la banque.'),
        ], beskrivning='Platser i staden, il y a, och au och à la när du säger vart du går.'),

        niva('fr-ak9-staden-2', 'À droite, à gauche', 'Staden och vägbeskrivningar', [
            para('Para ihop ordet med det svenska.',
                 [('le feu', 'trafikljuset'), ('le carrefour', 'korsningen'), ('le pont', 'bron'),
                  ('la rue', 'gatan'), ('le coin', 'hörnet')],
                 'Det här är orden i en vägbeskrivning. Le feu betyder också eld, men på gatan är det '
                 'trafikljuset.'),
            sant('”Tout droit” betyder till höger.', False,
                 'Tout droit betyder rakt fram. Till höger heter à droite, och de två är lätta att blanda ihop.'),
            val('Vad betyder ”Tournez à gauche.”?',
                ['Sväng till vänster.', 'Sväng till höger vid kyrkan.', 'Gå rakt fram.', 'Gå över gatan.'],
                'Sväng till vänster.',
                'Tournez är sväng och à gauche är till vänster. Till höger heter à droite.'),
            ordna('Bygg meningen: Ta första gatan till höger.',
                  ['Prenez', 'la', 'première', 'rue', 'à', 'droite.'],
                  forklaring='Première står före rue, som första före gatan, och à droite står sist.'),
            val('Vilket uttryck betyder ”bredvid”?', ['à côté de', 'en face de', 'loin de', 'derrière'],
                'à côté de',
                'À côté de är bredvid. En face de är mittemot, loin de långt från och derrière bakom.'),
            val('Vad betyder ”Excusez-moi, où est la gare ?”',
                ['Ursäkta, var ligger stationen?', 'Ursäkta, är stationen öppen?', 'Ursäkta, när går tåget?',
                 'Ursäkta, hur långt är det till stationen?'],
                'Ursäkta, var ligger stationen?',
                'Excusez-moi är ursäkta, och où betyder var. Où est la gare ? frågar var stationen ligger.'),
            skriv('Skriv ordet som saknas: La poste est à ___ de la banque. (till vänster om)', 'gauche',
                  'Till vänster om heter à gauche de, och till höger om heter à droite de.'),
            skriv('Skriv ordet som saknas: Allez tout ___ (rakt fram).', 'droit',
                  'Rakt fram heter tout droit. Ordet droit betyder rak.'),
            val('Vad betyder ”La banque est en face de la poste.”?',
                ['Banken ligger mittemot posten.', 'Banken ligger bakom posten.', 'Banken ligger bredvid posten.',
                 'Banken ligger långt från posten.'],
                'Banken ligger mittemot posten.',
                'En face de betyder mittemot. Bredvid heter à côté de, och bakom heter derrière.'),
            ordna('Bygg meningen: Sväng till höger vid trafikljuset.', ['Tournez', 'à', 'droite', 'au', 'feu.'],
                  forklaring='Tournez à droite är sväng till höger, och au feu är vid trafikljuset. Au är à och '
                             'le ihop.'),
        ], beskrivning='Fråga om vägen och förstå svaret: à droite, à gauche, tout droit.'),

        niva('fr-ak9-framtid-1', 'Je vais manger', 'Nära framtid', [
            para('Para ihop med det svenska.',
                 [('je vais nager', 'jag ska simma'), ('tu vas lire', 'du ska läsa'),
                  ('elle va dormir', 'hon ska sova'), ('nous allons partir', 'vi ska åka'),
                  ('ils vont manger', 'de ska äta')],
                 'Aller i presens och ett verb i infinitiv blir nära framtid: je vais nager, jag ska simma.'),
            val('Välj rätt form av aller: Ils ___ voyager.', ['vont', 'vais', 'allons', 'va'], ALLER['ils'],
                'Efter ils kommer vont: ils vont voyager. Aller är oregelbundet, så formerna måste läras in.'),
            val('Välj rätt form av aller: Tu ___ venir à la fête ?', ['vas', 'va', 'vais', 'allez'], ALLER['tu'],
                'Efter tu kommer vas: tu vas venir. Va hör till il och elle.'),
            skriv('Skriv rätt form av aller: Je ___ faire mes devoirs.', ALLER['je'],
                  'Jag ska heter je vais. Faire mes devoirs betyder göra mina läxor.'),
            sant('I nära framtid står huvudverbet i infinitiv: je vais manger.', True,
                 'Det är aller som böjs, och verbet efter står i infinitiv: je vais manger, nous allons manger.'),
            ordna('Bygg meningen: Vi ska titta på en film.', ['Nous', ALLER['nous'], 'regarder', 'un', 'film.'],
                  extra=[er('regarder', 'vous')],
                  forklaring='Allons hör till nous, och verbet efter står i infinitiv: regarder. Regardez är en '
                             'böjd form.'),
            val('Vad betyder ”Il va pleuvoir.”?',
                ['Det kommer att regna.', 'Det regnar nu.', 'Det har regnat.', 'Det regnade hela dagen i går.'],
                'Det kommer att regna.',
                'Il va pleuvoir är nära framtid: det kommer att regna. Pleuvoir betyder regna.'),
            skriv('Skriv rätt form av aller: Vous ___ prendre le train ?', ALLER['vous'],
                  'Efter vous kommer allez: vous allez prendre le train.'),
            val('Vilken mening handlar om framtiden?',
                ['Je vais jouer au tennis.', 'Je joue au tennis.', "J'ai joué au tennis.",
                 'Je jouais au tennis le samedi.'], 'Je vais jouer au tennis.',
                "Je vais jouer är nära framtid. Je joue är nutid, och j'ai joué och je jouais är dåtid."),
            ordna('Bygg meningen: Hon ska inte komma.', ['Elle', 'ne', ALLER['elle'], 'pas', 'venir.'],
                  forklaring='Ne och pas står runt aller, och infinitiven kommer efter: elle ne va pas venir.'),
        ], beskrivning='Nära framtid: aller i presens och ett verb i infinitiv.'),

        niva('fr-ak9-framtid-2', 'Demain, je vais ...', 'Nära framtid', [
            para('Para ihop tidsordet med det svenska.',
                 [('demain', 'i morgon'), ('ce soir', 'i kväll'), ('la semaine prochaine', 'nästa vecka'),
                  ("l'année prochaine", 'nästa år'), ('ce week-end', 'i helgen')],
                 'Tidsorden visar att något ska hända, och de passar ihop med nära framtid: demain, je vais '
                 'nager.'),
            val('Vilken mening betyder ”I morgon ska jag inte arbeta”?',
                ['Demain, je ne vais pas travailler.', 'Demain, je ne pas vais travailler.',
                 'Demain, je vais travailler pas.', "Demain, je n'ai pas travaillé."],
                'Demain, je ne vais pas travailler.',
                "Ne och pas står runt vais, och travailler kommer sist i infinitiv. Je n'ai pas travaillé är "
                'dåtid.'),
            sant('I ”Je ne vais pas sortir” står ne och pas runt verbet aller.', True,
                 'Negationen ramar in det böjda verbet, aller, och infinitiven kommer efter: je ne vais pas '
                 'sortir.'),
            val('Vad beskriver meningen ”Nous allons visiter Paris”?',
                ['något som ska hända', 'något som har hänt', 'något som händer nu'], 'något som ska hända',
                'Nous allons och en infinitiv är nära framtid: vi ska besöka Paris.'),
            skriv('Skriv verbet som saknas, i infinitiv: Ce soir, je vais ___ un livre. (läsa)', 'lire',
                  'Läsa heter lire, och efter je vais står verbet i infinitiv.'),
            ordna('Bygg meningen: De ska resa till Spanien.', ['Ils', ALLER['ils'], 'voyager', 'en', 'Espagne.'],
                  forklaring='Ils vont är de ska, och voyager står i infinitiv. Till Spanien heter en Espagne.'),
            val('Välj rätt ord: Demain, elle ___ jouer au foot.', ['va', 'a', 'est', 'vont'], ALLER['elle'],
                'Efter elle kommer va: elle va jouer. Det är aller som bildar nära framtid, inte avoir eller '
                'être.'),
            val("Vad svarar du på frågan ”Qu'est-ce que tu vas faire ce week-end ?”",
                ['Je vais aller à la plage.', "J'ai fait mes devoirs.", 'Je suis allé à la plage avec mes amis.',
                 "Je m'appelle Léa."], 'Je vais aller à la plage.',
                'Frågan gäller helgen som kommer, så svaret ska också vara nära framtid: je vais aller à la '
                'plage, jag ska åka till stranden.'),
            skriv('Skriv rätt form av aller: Mes amis ___ arriver ce soir.', ALLER['ils'],
                  'Mes amis kan bytas mot ils, och efter ils kommer vont.'),
            val('Vad betyder ”Il va faire beau demain.”?',
                ['Det blir fint väder i morgon.', 'Han ska göra sig fin i morgon.', 'Det var fint väder i går.',
                 'Han ska gå ut med hunden i morgon.'], 'Det blir fint väder i morgon.',
                'Il fait beau betyder det är fint väder, och il va faire beau betyder det blir fint väder.'),
        ], beskrivning='Tidsord för framtiden, och nära framtid i nekande meningar och frågor.'),

        niva('fr-ak9-passe-compose-1', "J'ai mangé", 'Passé composé', [
            val('Välj rätt form: Hier, nous ___ mangé une pizza.', ['avons', 'sommes', 'avez', 'ont'], AVOIR['nous'],
                'Manger bildar passé composé med avoir i presens och ett particip: nous avons mangé.'),
            para('Para ihop med det svenska.',
                 [("j'ai %s" % PARTICIP['manger'], 'jag åt'), ("j'ai %s" % PARTICIP['dormir'], 'jag sov'),
                  ("j'ai %s" % PARTICIP['lire'], 'jag läste'), ("j'ai %s" % PARTICIP['prendre'], 'jag tog'),
                  ("j'ai %s" % PARTICIP['boire'], 'jag drack')],
                 "Passé composé blir ofta svensk preteritum: j'ai mangé, jag åt. Lu, pris och bu är oregelbundna "
                 'particip.'),
            val('Vilken form är passé composé av ”je regarde”?',
                ["j'ai %s" % PARTICIP['regarder'], 'je suis regardé', "j'ai regarder", 'je regardais'],
                "j'ai %s" % PARTICIP['regarder'],
                "-er-verben får participet -é: regarder blir regardé, och hjälpverbet är avoir: j'ai regardé."),
            skriv('Skriv perfektparticipet av faire (göra).', PARTICIP['faire'],
                  "Faire har participet fait: j'ai fait mes devoirs."),
            sant("”J'ai mangé” kan betyda både jag åt och jag har ätit.", True,
                 'Passé composé motsvarar både svensk preteritum och perfekt. Sammanhanget avgör vad det blir '
                 'på svenska.'),
            skriv('Skriv perfektparticipet av voir (se).', PARTICIP['voir'],
                  "Voir har participet vu: j'ai vu un film."),
            ordna('Bygg meningen: Hon har spelat tennis.', ['Elle', AVOIR['elle'], PARTICIP['jouer'], 'au', 'tennis.'],
                  extra=['est'],
                  forklaring='Elle a är hjälpverbet och joué är participet. Jouer böjs med avoir, inte med '
                             'être.'),
            skriv('Skriv perfektparticipet av être (vara).', godta(PARTICIP['etre']),
                  "Être har participet été: j'ai été malade. Det stavas som l'été, sommaren."),
            ordna('Bygg meningen: Jag har inte ätit.', ['Je', "n'ai", 'pas', PARTICIP['manger'] + '.'],
                  forklaring="Ne och pas står runt hjälpverbet, och participet kommer efter: je n'ai pas mangé."),
            val('Välj rätt form: Tu ___ fini tes devoirs ?', ['as', 'es', 'a', 'ai'], AVOIR['tu'],
                'Finir böjs med avoir, och efter tu kommer as: tu as fini.'),
        ], beskrivning='Passé composé med avoir: hjälpverbet och participet, också nekande.'),

        niva('fr-ak9-passe-compose-2', 'Je suis allé, elle est allée', 'Passé composé', [
            val('Välj rätt hjälpverb: Je ___ allé au cinéma.', ['suis', 'ai', 'est', 'sommes'], ETRE['je'],
                'Aller böjs med être i passé composé: je suis allé. En flicka skriver je suis allée.'),
            sant('Alla verb böjs med avoir i passé composé.', False,
                 'De flesta gör det, men aller och andra verb för att röra sig, som venir, partir och arriver, '
                 'böjs med être.'),
            val('Välj rätt form: Elle est ___ à Paris.', ['allée', 'allé', 'allés', 'aller'],
                kongruens(PARTICIP['aller'], femininum=True),
                'Med être böjs participet efter subjektet. Elle är femininum, så det blir allée.'),
            val('Välj rätt form: Mes parents sont ___ hier soir.', ['rentrés', 'rentré', 'rentrées', 'rentrer'],
                kongruens(PARTICIP['rentrer'], plural=True),
                'Mes parents är maskulinum i plural, så participet får -s: rentrés.'),
            skriv('Skriv rätt form av être: Nous ___ partis à huit heures.', ETRE['nous'],
                  'Partir böjs med être, och vi är heter nous sommes: nous sommes partis.'),
            para('Para ihop med det svenska.',
                 [('je suis %s' % PARTICIP['naitre'], 'jag föddes'), ('je suis %s' % PARTICIP['tomber'], 'jag ramlade'),
                  ('je suis %s' % PARTICIP['rester'], 'jag stannade kvar'),
                  ('je suis %s' % PARTICIP['partir'], 'jag åkte iväg'),
                  ('je suis %s' % PARTICIP['monter'], 'jag gick upp')],
                 'Alla fem böjs med être: naître, tomber, rester, partir och monter.'),
            ordna('Bygg meningen: Hon kom fram klockan nio.',
                  ['Elle', ETRE['elle'], kongruens(PARTICIP['arriver'], femininum=True), 'à', TAL[9], 'heures.'],
                  extra=[PARTICIP['arriver']],
                  forklaring='Arriver böjs med être, och efter elle får participet ett extra e: elle est '
                             'arrivée.'),
            val('Vilken mening är rätt?',
                ['Ils sont partis.', 'Ils ont partis.', 'Ils sont partie.', 'Ils sont parties.'],
                'Ils %s %s.' % (ETRE['ils'], kongruens(PARTICIP['partir'], plural=True)),
                'Partir böjs med être, och efter ils får participet -s: ils sont partis. Parties hade passat '
                'efter elles.'),
            sant('”Je vais partir” och ”je suis parti” betyder samma sak.', False,
                 'Je vais partir är nära framtid, jag ska åka. Je suis parti är passé composé, jag åkte.'),
            skriv('Skriv perfektparticipet av venir (komma).', PARTICIP['venir'],
                  'Venir har participet venu, och det böjs med être: je suis venu.'),
        ], beskrivning='Passé composé med être: aller, venir, partir, och participet som böjs.'),
    ]),
]


def _kolla_brickor():
    """Frågetecknet är en egen bricka, sist (se filhuvudet), och ingen
    bricka står två gånger. Prövas här, så att en ny fråga inte kan få
    frågetecknet fast på sista ordet."""
    for b in BANOR:
        for n in b['nivaer']:
            for q in n['fragor']:
                if q['typ'] != 'ordna':
                    continue
                alla = q['ratt'] + (q['alternativ'] or [])
                assert not any(x.endswith('?') and x != '?' for x in alla), q['fraga']
                assert '?' not in q['ratt'][:-1], q['fraga']
                assert len(set(alla)) == len(alla), q['fraga']


_kolla_brickor()
