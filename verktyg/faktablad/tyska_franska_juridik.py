# -*- coding: utf-8 -*-
"""Faktabladen för Tyska åk 7 och åk 9, Franska åk 7 och åk 9 och Juridik gy1 och gy2 (2026-10-27). Språkbladen är skrivna på svenska med exemplen på målspråket, efter böjningstabellerna och förklaringarna i tyska.py och franska.py; juridikbladen säger bara det som bankens frågor och förklaringar i juridik.py säger, utan egna paragrafer, belopp eller tidsgränser."""
from fakta import blad

FAKTABLAD = [
    # ================================================================ Tyska åk 7
    blad('Tyska', 'ak7', 'Hälsa och presentera dig',
         mal=['Hälsa och säga hej då på tyska, efter tid på dygnet och efter vem du pratar med.',
              'Fråga hur någon mår och svara på frågan.',
              'Säga vad du heter, var du kommer ifrån och var du bor, och fråga någon annan samma sak.'],
         fakta=['Hälsningarna följer dygnet: Morgen är morgon, Tag dag och Abend kväll. Hallo och Tschüss är '
                'vardagliga, och Auf Wiedersehen är ett artigare hej då.',
                'Wie geht\'s? betyder hur mår du. Gut betyder bra, sehr gut jättebra och es geht ungefär sådär.',
                'Verbet får en ändelse efter vem det gäller: ich -e (ich wohne), du -st (du wohnst). Slutar '
                'stammen på s, ß eller z blir det bara -t efter du: du tanzt.',
                'Till en vuxen du inte känner säger du Sie, med stor bokstav, och verbet slutar då på -en, som '
                'i grundformen. Undantaget är sein: Sie sind.',
                'Wo betyder var och woher varifrån. Aus betyder från och in betyder i: aus Norwegen, in Berlin.'],
         exempel=[('Hur säger du att du talar svenska och engelska?',
                   'Ich spreche Schwedisch und Englisch. Till ich hör ändelsen -e: spreche.'),
                  ('Hur frågar du en vuxen du inte känner var hen bor?',
                   'Wo wohnen Sie? Till Sie slutar verbet på -en, precis som grundformen wohnen.')],
         ord=[('Danke', 'tack'),
              ('Bitte', 'snälla när du ber om något, och varsågod när du ger något'),
              ('Entschuldigung', 'ursäkta'),
              ('Freut mich', 'trevligt att träffas'),
              ('Sie', 'ni, artigt till en vuxen du inte känner'),
              ('heißen', 'heta: ich heiße, jag heter')],
         tips='Gute Nacht är ingen hälsning när du kommer: det säger man när man skiljs åt sent eller ska sova.'),

    blad('Tyska', 'ak7', 'Siffror och ålder',
         mal=['Känna igen, skriva och räkna med de tyska talen från 0 till 20.',
              'Säga hur gammal du är och fråga hur gammal någon annan är.'],
         fakta=['Talen 0–12: null, eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn, elf, zwölf.',
                '13–19 är entalet och zehn: dreizehn är tre och tio. Men sechs och sieben kortas: sechzehn (16) '
                'och siebzehn (17).',
                'Tjugo heter zwanzig. Tiotalen slutar oftast på -zig: vierzig är 40, medan vierzehn är 14.',
                'Åldern säger du med sein (vara), som på svenska: Ich bin … Jahre alt. Jahr betyder år, och '
                'fler än ett år heter Jahre.'],
         exempel=[('Räkna på tyska: drei plus acht.',
                   'Drei är 3 och acht är 8. 3 + 8 = 11, och elva heter elf.'),
                  ('Hur säger du att du är elva år?',
                   'Ich bin elf Jahre alt. Åldern säger du med bin (är), och alt (gammal) står sist.')],
         ord=[('alt', 'gammal'),
              ('das Jahr, die Jahre', 'året, åren'),
              ('plus, minus', 'samma ord på tyska som på svenska')],
         tips='Saknar du ü och ö på tangentbordet går det bra att skriva ue och oe: fuenf, zwoelf.'),

    blad('Tyska', 'ak7', 'Familjen och artiklarna',
         mal=['Använda ord för familjen och några husdjur.',
              'Välja der, die eller das, och ein eller eine, till ett substantiv.',
              'Säga min och din med mein, meine, dein och deine.'],
         fakta=['Varje substantiv har en artikel: der, die eller das. Artikeln syns inte på ordet, så lär dig '
                'den tillsammans med ordet.',
                'Ord för kvinnor i familjen är oftast die-ord och ord för män oftast der-ord. Ord bildade med '
                'ändelsen -chen, som gör något litet, är alltid das-ord.',
                'I plural är artikeln alltid die: die Kinder, die Eltern.',
                'En heter ein till der- och das-ord och eine till die-ord. Mein och dein böjs likadant: meine '
                'och deine till die-ord och i plural.',
                'Alla substantiv skrivs med stor bokstav på tyska, var de än står i meningen.'],
         exempel=[('Ein eller eine? Das ist ___ Buch. (das Buch)',
                   'Buch är ett das-ord, och till der- och das-ord heter en ein: Das ist ein Buch.'),
                  ('Mein eller meine? ___ Lampe ist neu. (die Lampe)',
                   'Lampe är ett die-ord, så min blir meine: Meine Lampe ist neu.')],
         ord=[('maskulinum', 'ord med der, till exempel der Vater'),
              ('femininum', 'ord med die, till exempel die Schwester'),
              ('neutrum', 'ord med das, till exempel das Haus'),
              ('substantiv', 'ord för personer, djur och saker'),
              ('die Großeltern', 'mor- och farföräldrarna')],
         tips='Ein och eine betyder båda en eller ett: det är ordets artikel som avgör formen, inte svenskans en '
              'eller ett.'),

    blad('Tyska', 'ak7', 'Verben sein och haben',
         mal=['Böja sein (vara) i presens.',
              'Böja haben (ha) i presens och säga att du har syskon eller husdjur.',
              'Använda fasta uttryck som Ich habe Hunger.',
              'Bygga en ja- eller nej-fråga med verbet först.'],
         fakta=['Pronomenen: ich jag, du du, er han, sie hon, es den eller det, wir vi, ihr ni (flera du), '
                'sie de och Sie ni (artigt).',
                'sein: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind.',
                'haben: ich habe, du hast, er/sie/es hat, wir haben, ihr habt, sie/Sie haben. B:et faller bort '
                'efter du och er/sie/es.',
                'Efter haben blir ein till einen framför der-ord: Ich habe einen Ball. Eine och ein framför '
                'das-ord ändras inte.',
                'Hunger, törst och rädsla har man på tyska, med haben, där svenskan säger att man är hungrig, '
                'törstig och rädd.'],
         exempel=[('Fyll i sein: Wir ___ heute im Kino.',
                   'Till wir hör sind: Wir sind heute im Kino, vi är på bio i dag.'),
                  ('Säg: Han har en boll. (der Ball)',
                   'Er hat einen Ball. Till er hör hat, och efter haben blir ein till einen framför der-ord.')],
         ord=[('presens', 'nutid, verbets form för det som händer nu'),
              ('pronomen', 'ord som jag, du och hon, som står i stället för ett namn'),
              ('müde', 'trött'),
              ('zu Hause', 'hemma')],
         tips='I en ja- eller nej-fråga står verbet först, precis som på svenska: Bist du …? Hast du …?'),

    blad('Tyska', 'ak7', 'Skolan och fritiden',
         mal=['Böja regelbundna verb som spielen, lernen och machen i presens.',
              'Placera verbet på andra plats, också när meningen börjar med en tid.',
              'Ställa frågor med frågeord och ja- eller nej-frågor.',
              'Känna igen namnen på skolämnen och fritidsaktiviteter.'],
         fakta=['Ett regelbundet verb är stam och ändelse: ich spiele, du spielst, er/sie/es spielt, wir '
                'spielen, ihr spielt, sie/Sie spielen.',
                'Efter wir, sie (de) och Sie har verbet samma form som i ordboken, infinitiven.',
                'Verbet står på andra plats. Börjar meningen med en tid kommer verbet direkt efter och sedan '
                'subjektet: Morgen lerne ich.',
                'Med ett frågeord står frågeordet först och verbet efter: Was machst du? I en ja- eller '
                'nej-fråga står verbet först: Lernst du Deutsch?',
                'Frågeorden: was vad, wo var, wer vem, wie hur, wann när och woher varifrån.'],
         exempel=[('Bygg meningen: På söndag lagar han mat. (kochen)',
                   'Am Sonntag kocht er. Am Sonntag står först, så verbet kocht kommer på andra plats och '
                   'sedan er.'),
                  ('Böj kaufen (köpa) efter ich, du och er.',
                   'ich kaufe, du kaufst, er kauft: stammen kauf- och ändelserna -e, -st och -t.')],
         ord=[('heute', 'i dag'),
              ('morgen', 'i morgon'),
              ('gern', 'gärna, efter verbet: Ich lese gern, jag läser gärna'),
              ('die Schule', 'skolan'),
              ('das Fach', 'skolämnet')],
         tips='Akta dig för wer: det liknar var men betyder vem. Var heter wo.'),

    # ================================================================ Tyska åk 9
    blad('Tyska', 'ak9', 'Mat och att beställa',
         mal=['Använda ord för mat, dryck och måltider.',
              'Säga vad du gärna äter och dricker, med gern efter verbet.',
              'Beställa artigt med Ich möchte och Ich hätte gern, och fråga vad något kostar.',
              'Böja essen, trinken och möchte i presens.'],
         fakta=['Gern efter verbet säger att du tycker om det: Ich esse gern Reis, jag äter gärna ris.',
                'Essen byter e mot i efter du och er/sie/es: du isst, er isst. Ich esse och ihr esst har kvar '
                'e. Trinken är regelbundet: du trinkst.',
                'Möchte (skulle vilja) har ingen ändelse efter ich och er/sie/es: ich möchte, er möchte, men du '
                'möchtest och ihr möchtet.',
                'Efter möchte och hätte gern blir ein till einen framför der-ord: Ich möchte einen Tee.',
                'Efter möchte står ett annat verb sist, i infinitiv: Was möchtest du trinken? En stam på t får '
                'ett e före -t: es kostet.'],
         exempel=[('Beställ en te på ett kafé. (der Tee)',
                   'Ich möchte einen Tee, bitte. Tee är ett der-ord, så ein blir einen efter möchte.'),
                  ('Säg: Vi skulle vilja äta pizza.',
                   'Wir möchten Pizza essen. Möchten står på andra plats och infinitiven essen sist.')],
         ord=[('das Mittagessen', 'lunchen, målet mitt på dagen'),
              ('das Abendessen', 'kvällsmaten'),
              ('lecker', 'gott'),
              ('die Speisekarte', 'menyn'),
              ('bitte', 'tack eller snälla, när du ber om något')],
         tips='Ich möchte … och Ich hätte gern … är båda artiga sätt att beställa.'),

    blad('Tyska', 'ak9', 'Vardagen och klockan',
         mal=['Säga och förstå klockslag på tyska: hel och halv timme, kvart över och kvart i.',
              'Säga när något händer med um … Uhr och am före en veckodag.',
              'Använda veckodagarna och beskriva en vanlig dag.',
              'Placera verbet rätt, också när aufstehen delas i två.'],
         fakta=['Hel timme: Es ist drei Uhr. Före Uhr heter 1 ein: ein Uhr. Nach betyder över och vor i: '
                'zehn nach drei är 3:10 och fünf vor drei 2:55.',
                'Halb räknar mot nästa timme, som på svenska: halb fünf är halv fem, alltså 4:30.',
                'Viertel nach är kvart över och Viertel vor kvart i: Viertel nach vier är 4:15 och Viertel '
                'vor vier 3:45.',
                'Um … Uhr säger när något händer: um neun Uhr, klockan nio. Före en veckodag står am: am '
                'Dienstag, på tisdag.',
                'Veckodagarna: Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag (eller Sonnabend) och '
                'Sonntag.'],
         exempel=[('Vad är klockan om någon säger: Es ist fünf nach halb sechs?',
                   'Halb sechs är 5:30, och fünf nach halb sechs är fem minuter efter: 5:35. Det är som fem över '
                   'halv sex på svenska.'),
                  ('Säg: Klockan är kvart i elva.',
                   'Es ist Viertel vor elf. Vor betyder i, före, så klockan är 10:45.')],
         ord=[('Wie spät ist es?', 'Hur mycket är klockan? Ordagrant: hur sent är det?'),
              ('wann', 'när'),
              ('frühstücken', 'äta frukost'),
              ('aufstehen', 'gå upp, stiga upp'),
              ('beginnen', 'börja')],
         tips='Aufstehen delas i två: stehe står på andra plats och auf hamnar sist, som i Ich stehe früh auf.'),

    blad('Tyska', 'ak9', 'Staden och vägbeskrivning',
         mal=['Säga vad som finns i en stad med es gibt, och vad som inte finns med kein.',
              'Fråga om vägen och förstå en vägbeskrivning.',
              'Använda dativ efter mit, zu och neben: mit dem Bus, zur Schule.',
              'Känna igen ord för platser i staden.'],
         fakta=['Es gibt betyder det finns. Efter es gibt blir ein till einen framför der-ord: Es gibt einen '
                'Markt.',
                'Ingen heter kein och böjs som ein: kein framför der- och das-ord, keine framför die-ord, och '
                'keinen efter es gibt framför der-ord.',
                'Mit och zu tar alltid dativ. I dativ blir der och das till dem och die till der: mit dem Zug, '
                'mit der Straßenbahn.',
                'Zu dras ihop med artikeln: zu dem blir zum och zu der blir zur, som i zum Park och zur Schule.',
                'När det gäller var något är tar neben och gegenüber också dativ: neben dem Rathaus, gegenüber '
                'der Apotheke.'],
         exempel=[('Säg: Det finns ingen park här. (der Park)',
                   'Hier gibt es keinen Park. Park är ett der-ord, och efter es gibt blir kein till keinen.'),
                  ('Säg: Jag åker spårvagn till träningen. (die Straßenbahn, das Training)',
                   'Ich fahre mit der Straßenbahn zum Training. Efter mit blir die till der, och zu dem blir '
                   'zum.')],
         ord=[('links', 'till vänster'),
              ('rechts', 'till höger'),
              ('geradeaus', 'rakt fram'),
              ('neben', 'bredvid'),
              ('gegenüber', 'mittemot'),
              ('die Haltestelle', 'hållplatsen')],
         tips='I en artig uppmaning står verbet först och Sie efter: Gehen Sie …, Nehmen Sie …'),

    blad('Tyska', 'ak9', 'Modala verb',
         mal=['Böja modalverben können, müssen och wollen i presens.',
              'Bygga meningar med modalverbet på andra plats och infinitiven sist.',
              'Förstå att nicht müssen betyder att man inte behöver.'],
         fakta=['Modalverben har ingen ändelse efter ich och er/sie/es, och du får -st (bara -t efter s): ich '
                'kann, du kannst, er kann.',
                'können (kunna): ich kann, du kannst, er/sie/es kann, wir können, ihr könnt, sie/Sie können.',
                'müssen (måste): ich muss, du musst, er/sie/es muss, wir müssen, ihr müsst, sie/Sie müssen. '
                'Ü:et finns bara med wir, ihr och sie/Sie.',
                'wollen (vilja): ich will, du willst, er/sie/es will, wir wollen, ihr wollt, sie/Sie wollen.',
                'Modalverbet står på andra plats och det andra verbet sist, i infinitiv: Ich muss heute meine '
                'Oma besuchen.'],
         exempel=[('Säg: Min pappa kan laga mat mycket bra. (kochen)',
                   'Mein Vater kann sehr gut kochen. Kann har ingen ändelse efter er, och kochen står sist i '
                   'infinitiv.'),
                  ('Gör en fråga: Vill ni läsa en bok? (lesen)',
                   'Wollt ihr ein Buch lesen? I en ja- eller nej-fråga står modalverbet först, och infinitiven '
                   'lesen står sist.')],
         ord=[('können', 'kunna'),
              ('müssen', 'måste'),
              ('wollen', 'vilja'),
              ('möchten', 'skulle vilja, artigt'),
              ('dürfen', 'få, ha lov att'),
              ('werden', 'bli')],
         tips='Ich muss nicht betyder jag behöver inte; får inte heter darf nicht.'),

    blad('Tyska', 'ak9', 'Perfekt med haben och sein',
         mal=['Bilda perfekt med haben eller sein och ett particip.',
              'Bilda participet av regelbundna verb med ge- och -t, och känna igen oregelbundna particip.',
              'Placera participet sist i meningen.',
              'Välja sein för verb som betyder förflyttning eller förändring.'],
         fakta=['Perfekt är haben eller sein på andra plats och participet sist: Ich habe heute gekocht.',
                'Regelbundna verb får ge- före stammen och -t efter: kochen blir gekocht och tanzen getanzt. '
                'Slutar stammen på t eller d blir det -et: gearbeitet.',
                'Oregelbundna particip slutar ofta på -en, och vokalen kan ändras: schreiben blir geschrieben '
                'och finden gefunden. De måste läras in.',
                'Verb som börjar på be-, ver- eller er- får inget ge-: bezahlen blir bezahlt och verkaufen '
                'verkauft.',
                'De flesta verb tar haben. Sein tar verb för förflyttning eller förändring, som fahren, gehen, '
                'kommen, fliegen och aufstehen, och också sein och bleiben.'],
         exempel=[('Säg: Hon har skrivit ett brev. (schreiben, der Brief)',
                   'Sie hat einen Brief geschrieben. Hat står på andra plats och participet geschrieben sist.'),
                  ('Haben eller sein? Mein Opa ___ nach Italien gereist. (reisen, resa)',
                   'Reisen är en förflyttning och tar sein: Mein Opa ist nach Italien gereist.')],
         ord=[('perfekt', 'verbformen för något som har hänt: ich habe gekocht'),
              ('particip', 'verbformen som står sist i perfekt, till exempel gekocht'),
              ('hjälpverb', 'haben eller sein, som böjs och står på andra plats'),
              ('gestern', 'i går')],
         tips='Tyskan använder ofta perfekt där svenskan säger preteritum: Gestern habe ich gekocht betyder i '
              'går lagade jag mat.'),

    # ================================================================ Franska åk 7
    blad('Franska', 'ak7', 'Hälsa och presentera dig',
         mal=['Hälsa och säga hej då på franska, till en kompis och till en vuxen.',
              'Fråga hur någon mår och svara.',
              'Säga vad du heter och fråga vad någon annan heter.',
              'Välja mellan tu och vous.'],
         fakta=['Bonjour passar till alla, och au revoir säger du när du går. Salut säger du till kompisar, både '
                'när ni ses och när ni skiljs.',
                'Tu säger du till en kompis, ett barn eller någon i familjen. Vous säger du till en vuxen du '
                'inte känner, och till flera.',
                'Ça va ? frågar hur det är, och ça va utan frågetecken betyder att det är bra.',
                "Je m'appelle betyder jag heter, ordagrant jag kallar mig. Me blir m' framför en vokal.",
                'På franska står det ett mellanslag före frågetecknet och utropstecknet: Ça va ? Salut !'],
         exempel=[('Hur säger du hej då, vi ses i kväll, till en kompis?',
                   'Salut, à ce soir ! Salut kan betyda hej då till en kompis, och à ce soir betyder vi ses i '
                   'kväll.'),
                  ('Hur säger du god kväll till en kvinna du inte känner?',
                   'Bonsoir, madame. Bonsoir är god kväll, och madame säger du artigt till en kvinna.')],
         ord=[('madame', 'frun, artigt till en kvinna'),
              ('monsieur', 'herrn, artigt till en man'),
              ('merci beaucoup', 'tack så mycket'),
              ('pardon', 'förlåt, ursäkta'),
              ('très bien', 'mycket bra')],
         tips='Bonne nuit säger du bara när någon ska sova, inte som en hälsning på kvällen.'),

    blad('Franska', 'ak7', 'Siffror och ålder',
         mal=['Känna igen, skriva och räkna med de franska talen från 0 till 20.',
              "Säga hur gammal du är med avoir: j'ai … ans.",
              'Fråga en kompis hur gammal hen är.'],
         fakta=['Talen 0–10: zéro, un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix.',
                'Talen 11–16 har egna ord: onze, douze, treize, quatorze, quinze, seize.',
                '17–19 är tio och entalet med bindestreck: dix-sept, dix-huit, dix-neuf. Tjugo heter vingt.',
                "Åldern har man på franska, med avoir (ha): j'ai … ans, ordagrant jag har … år. Ordet ans ska "
                'alltid vara med.',
                'Tu as quel âge ? frågar en kompis hur gammal hen är, ordagrant du har vilken ålder?'],
         exempel=[('Räkna på franska: trois + trois.',
                   'Trois är 3. 3 + 3 = 6, och sex heter six.'),
                  ('Säg att du är elva år.',
                   "J'ai onze ans. Åldern säger du med avoir, och ans ska vara med.")],
         ord=[('un an, deux ans', 'ett år, två år'),
              ("l'âge", 'åldern')],
         tips='Glöm inte bindestrecket i dix-sept, dix-huit och dix-neuf.'),

    blad('Franska', 'ak7', 'Familjen och artiklarna',
         mal=['Använda ord för familjen.',
              "Välja bestämd artikel: le, la, l' eller les.",
              'Välja obestämd artikel: un, une eller des.',
              'Säga min och din med mon, ma, mes och ton, ta, tes.'],
         fakta=['Alla substantiv är maskulinum eller femininum. Le och un står före maskulina ord, la och une '
                'före feminina.',
                "Framför en vokal eller ett stumt h blir både le och la till l': l'avion, l'histoire.",
                'I plural är artikeln les eller des, oavsett genus: les frères, des cousines.',
                'Min heter mon, ma och mes, och din ton, ta och tes. Ordet efter avgör formen, och framför vokal '
                'blir ma till mon.',
                'Franskan har inget genitiv-s: Toms bror blir le frère de Tom, brodern till Tom.'],
         exempel=[("Le, la eller l'? ___ fille (dottern)",
                   'Fille är femininum och börjar inte på vokal, så det blir la fille.'),
                  ('Säg min klocka och min idé. (la montre, l\'idée)',
                   'Ma montre, men mon idée. Båda är femininum, men framför vokal blir ma till mon.')],
         ord=[('maskulinum', 'ord med le eller un, till exempel le père'),
              ('femininum', 'ord med la eller une, till exempel la mère'),
              ('le fils', 'sonen'),
              ('les grands-parents', 'mor- och farföräldrarna')],
         tips='Lär dig varje substantiv med artikeln, så vet du om det är maskulinum eller femininum.'),

    blad('Franska', 'ak7', 'Être och avoir',
         mal=['Böja être (vara) i presens.',
              'Böja avoir (ha) i presens.',
              "Använda uttryck med avoir, som j'ai faim och j'ai … ans.",
              'Skilja ils sont (de är) från ils ont (de har).'],
         fakta=['être: je suis, tu es, il/elle est, nous sommes, vous êtes, ils/elles sont.',
                "avoir: j'ai, tu as, il/elle a, nous avons, vous avez, ils/elles ont.",
                "Hunger, törst, rädsla och åldern har man på franska, med avoir: j'ai faim, j'ai … ans. På "
                'svenska är man hungrig.',
                'Ett adjektiv efter être böjs: en flicka skriver contente och fatiguée, och flera får -s: ils '
                'sont contents.',
                'Il a (han har) skrivs utan accent. À med accent är ett annat ord, som betyder till eller i.'],
         exempel=[('Fyll i être: Léa ___ triste. (ledsen)',
                   'Léa kan bytas mot elle, och efter elle kommer est: Léa est triste.'),
                  ('Fyll i avoir: Mes amis ___ un chien.',
                   'Mes amis kan bytas mot ils, och efter ils kommer ont: Mes amis ont un chien.')],
         ord=[('être', 'vara'),
              ('avoir', 'ha'),
              ('triste', 'ledsen')],
         tips='Ils sont (de är) och ils ont (de har) är lätta att blanda ihop: sont börjar med s.'),

    blad('Franska', 'ak7', 'Skolan och fritiden',
         mal=['Böja regelbundna -er-verb i presens.',
              'Säga att du inte gör något med ne … pas.',
              'Använda ord för skolan och fritiden.'],
         fakta=['Ett -er-verb tappar -er och får en ändelse: je -e, tu -es, il/elle -e, nous -ons, vous -ez, '
                'ils/elles -ent.',
                'Ändelserna -e, -es och -ent hörs inte, så je parle och ils parlent låter likadant. De ska ändå '
                'skrivas.',
                "Ne står före verbet och pas efter: je ne danse pas. Framför vokal blir ne till n': je "
                "n'écoute pas.",
                "Efter aimer står nästa verb i infinitiv: j'aime danser, jag tycker om att dansa.",
                "Språk skrivs med liten bokstav på franska: l'anglais, le suédois."],
         exempel=[('Böj danser (dansa) efter nous och vous.',
                   'nous dansons, vous dansez: stammen dans- och ändelserna -ons och -ez.'),
                  ('Säg: Jag tycker inte om att dansa.',
                   "Je n'aime pas danser. Ne blir n' framför aime, pas står efter aime och danser står i "
                   'infinitiv.')],
         ord=[('le foot', 'fotboll, kort för le football'),
              ('la télé', 'tv, kort för la télévision'),
              ('les devoirs', 'läxorna'),
              ('le sport', 'idrott, sport')],
         tips='I en nekande mening i skrift ska både ne och pas vara med: ingen av dem räcker ensam.'),

    # ================================================================ Franska åk 9
    blad('Franska', 'ak9', 'Mat och att beställa',
         mal=['Använda ord för mat och dryck.',
              "Beställa artigt med je voudrais och s'il vous plaît, och be om notan.",
              "Välja du, de la, de l' eller des när du talar om en del av något.",
              'Använda bara de efter en negation och efter en mängd.'],
         fakta=["Je voudrais (jag skulle vilja ha) och je prends (jag tar) är sätten att beställa. Till "
                "personalen säger du vous: s'il vous plaît.",
                "Lite av något heter du framför maskulina ord, de la framför feminina, de l' framför vokal och "
                "des i plural: du riz, de la soupe, de l'huile, des carottes.",
                'Du är de och le ihop. De och la blir inte ett ord.',
                'Efter en negation blir du, de la och des bara de: je ne mange pas de viande.',
                "Efter en mängd står också bara de: un verre de jus, beaucoup de lait. Framför vokal blir de "
                "till d'."],
         exempel=[('Fyll i: Je voudrais ___ soupe. (la soupe)',
                   'Soupe är femininum, så lite soppa heter de la soupe.'),
                  ('Säg: Han äter inte fisk. (le poisson)',
                   'Il ne mange pas de poisson. Efter negationen blir du poisson bara de poisson.')],
         ord=[('la carte', 'menyn'),
              ("l'addition", 'notan'),
              ('le serveur, la serveuse', 'servitören, servitrisen'),
              ('un verre', 'ett glas')],
         tips='Je voudrais är artigare än je veux (jag vill), så använd det när du beställer.'),

    blad('Franska', 'ak9', 'Vardagen och reflexiva verb',
         mal=['Böja reflexiva verb i presens med rätt pronomen.',
              'Beskriva din morgon och kväll med verb som se lever och se coucher.',
              'Göra reflexiva meningar nekande med ne … pas.',
              'Stava lever och appeler rätt i presens.'],
         fakta=['Reflexiva verb har ett extra pronomen, som sig på svenska: je me, tu te, il/elle se, nous '
                'nous, vous vous, ils/elles se.',
                "Pronomenet står mellan subjektet och verbet: je me prépare. Framför vokal och stumt h blir me, "
                "te och se till m', t' och s'.",
                'Ne står före pronomenet och pas efter verbet: je ne me prépare pas.',
                "Verb som lever och acheter får accent grave när ändelsen är stum: j'achète, ils achètent, men "
                'nous achetons.',
                "Appeler har två l när ändelsen är stum, som i je m'appelle och tu t'appelles, och ett l när den "
                'hörs.'],
         exempel=[('Säg: Hon gör sig i ordning klockan sju. (se préparer)',
                   'Elle se prépare à sept heures. Efter elle kommer se, och pronomenet står före verbet.'),
                  ('Säg: Vi duschar inte på kvällen. (se doucher)',
                   'Nous ne nous douchons pas le soir. Nous står två gånger, och ne och pas ramar in pronomenet '
                   'och verbet.')],
         ord=[('le matin', 'morgonen, på morgonen'),
              ('le soir', 'kvällen, på kvällen'),
              ('tôt', 'tidigt'),
              ('tard', 'sent'),
              ('se doucher', 'duscha'),
              ('se réveiller', 'vakna')],
         tips='Om den egna kroppen säger man le, la eller les, inte mon eller ses: je me brosse les cheveux.'),

    blad('Franska', 'ak9', 'Staden och vägbeskrivningar',
         mal=['Säga vad som finns i en stad med il y a.',
              "Säga vart du går med au, à la, à l' och aux.",
              'Fråga om vägen och förstå en vägbeskrivning.',
              'Beskriva var något ligger med à côté de och en face de.'],
         fakta=['Il y a betyder det finns och ändras inte i plural: il y a un musée, il y a trois parcs.',
                "À och le blir au, och à och les blir aux. À la och à l' ändras inte: au musée, aux magasins, "
                "à la plage, à l'hôtel.",
                'Où (var) har accent. Utan accent betyder ou eller.',
                'Läget: à côté de är bredvid, en face de mittemot, près de nära, loin de långt från och '
                'derrière bakom.',
                'I en vägbeskrivning används vous-formen, med verbet först: Tournez …, Prenez …, Allez …'],
         exempel=[('Fyll i: Nous allons ___ musée. (le musée)',
                   'Musée är maskulinum, och à och le blir au: Nous allons au musée.'),
                  ("Säg: Bageriet ligger bredvid kyrkan. (la boulangerie, l'église)",
                   "La boulangerie est à côté de l'église. À côté de betyder bredvid.")],
         ord=[('à droite', 'till höger'),
              ('à gauche', 'till vänster'),
              ('tout droit', 'rakt fram'),
              ('le carrefour', 'korsningen'),
              ('le feu', 'trafikljuset'),
              ('la rue', 'gatan')],
         tips='Blanda inte ihop à droite (till höger) och tout droit (rakt fram).'),

    blad('Franska', 'ak9', 'Nära framtid',
         mal=['Säga vad som ska hända med aller och ett verb i infinitiv.',
              'Böja aller i presens.',
              'Göra nära framtid nekande med ne … pas runt aller.',
              'Använda tidsord som demain och ce soir.'],
         fakta=['Nära framtid är aller i presens och ett verb i infinitiv: je vais cuisiner, jag ska laga mat.',
                'aller: je vais, tu vas, il/elle va, nous allons, vous allez, ils/elles vont.',
                'Det är bara aller som böjs. Verbet efter står kvar i infinitiv, vem det än gäller.',
                'I en nekande mening står ne och pas runt aller, och infinitiven kommer efter: je ne vais pas '
                'danser.'],
         exempel=[('Säg: Vi ska dansa i kväll.',
                   'Nous allons danser ce soir. Allons hör till nous, och danser står i infinitiv.'),
                  ('Säg: Han ska inte sjunga. (chanter)',
                   'Il ne va pas chanter. Ne och pas står runt va, och chanter kommer efter i infinitiv.')],
         ord=[('demain', 'i morgon'),
              ('ce soir', 'i kväll'),
              ('la semaine prochaine', 'nästa vecka'),
              ('ce week-end', 'i helgen'),
              ('pleuvoir', 'regna'),
              ('il fait beau', 'det är fint väder')],
         tips='Böj aldrig verbet efter aller: det heter nous allons regarder, inte nous allons regardez.'),

    blad('Franska', 'ak9', 'Passé composé',
         mal=['Bilda passé composé med avoir eller être i presens och ett particip.',
              'Bilda participet av -er-verb och känna igen vanliga oregelbundna particip.',
              'Böja participet efter subjektet när hjälpverbet är être.',
              'Göra passé composé nekande med ne … pas.'],
         fakta=["Passé composé är avoir eller être i presens och ett particip: j'ai dansé, jag dansade eller "
                'jag har dansat.',
                '-er-verben får participet -é: danser blir dansé. Andra lärs in ett och ett, till exempel '
                'choisir som blir choisi, écrire écrit och mettre mis.',
                'De flesta verb tar avoir. Aller, venir, partir, sortir, arriver, rentrer, monter, tomber, '
                'rester och naître tar être.',
                'Med être böjs participet efter subjektet, med -e för femininum och -s för plural: il est sorti, '
                'elle est sortie, ils sont sortis.',
                "Ne och pas står runt hjälpverbet, och participet kommer efter: je n'ai pas dansé."],
         exempel=[('Säg: Hon har skrivit ett brev. (écrire, une lettre)',
                   'Elle a écrit une lettre. Écrire tar avoir, och participet är écrit.'),
                  ('Fyll i sortir: Léa et Emma sont ___ à huit heures.',
                   'Léa och Emma är två flickor, alltså femininum i plural. Participet sorti får -es: Léa et '
                   'Emma sont sorties.')],
         ord=[('particip', 'verbformen efter hjälpverbet, till exempel dansé'),
              ('hjälpverb', 'avoir eller être, som böjs i presens'),
              ('hier', 'i går'),
              ('hier soir', 'i går kväll')],
         tips='Står hjälpverbet être i meningen: titta på subjektet innan du skriver participet.'),

    # ================================================================ Juridik gy1
    blad('Juridik', 'gy1', 'Rättssystemet',
         mal=['Förklara vem som stiftar lagar och vad regeringens förordningar är.',
              'Känna igen de fyra grundlagarna och vad de handlar om.',
              'Beskriva de allmänna domstolarna och förvaltningsdomstolarna, och vad ett prejudikat är.',
              'Skilja på civilrätt och offentlig rätt, och på rättskällorna.'],
         fakta=['Riksdagen stiftar lagarna. Regeringen styr landet och beslutar förordningar, regler under '
                'lagarna, som inte får gå emot en lag.',
                'Grundlagarna är fyra: regeringsformen, successionsordningen, tryckfrihetsförordningen och '
                'yttrandefrihetsgrundlagen. De ändras med två likadana beslut och ett riksdagsval emellan.',
                'Civilrätten gäller mellan enskilda, som avtal och arv. Offentlig rätt, där straffrätten ingår, '
                'gäller mellan det allmänna och den enskilde.',
                'De allmänna domstolarna är tingsrätten, hovrätten och Högsta domstolen. En myndighets beslut '
                'överklagas till förvaltningsrätten, sedan kammarrätten och Högsta förvaltningsdomstolen.',
                'Ett prejudikat är en dom, främst från de högsta domstolarna, som visar hur lagen ska tolkas. '
                'Högsta domstolen tar bara upp mål som får prövningstillstånd.'],
         exempel=[('Skatteverket beslutar att du ska betala mer skatt, och du vill gå till domstol. Var börjar '
                   'målet?',
                   'I förvaltningsrätten, för det är en myndighets beslut. Därefter kan det gå till kammarrätten '
                   'och Högsta förvaltningsdomstolen.'),
                  ('Två grannar är oense om vem som ska betala för ett staket. Vilken domstol prövar tvisten '
                   'först?',
                   'Tingsrätten. Den dömer i första instans i tvister mellan enskilda, och i brottmål.')],
         ord=[('talmannen', 'leder riksdagen och föreslår en ny statsminister, som riksdagen röstar om'),
              ('nämndemän', 'vanliga medborgare, valda av kommunen, som dömer med en lagfaren domare i många '
                            'brottmål i tingsrätten'),
              ('JO', 'Justitieombudsmannen: väljs av riksdagen och granskar att myndigheterna följer lagarna'),
              ('rättskällor', 'det jurister stöder sig på: lag, förarbeten, prejudikat och doktrin'),
              ('förarbeten', 'utredningar och propositioner som visar vad lagen ska betyda'),
              ('doktrin', 'det forskare i juridik skriver om rätten')],
         tips='Lagen väger tyngst bland rättskällorna; förarbeten, prejudikat och doktrin hjälper till att tolka '
              'den.'),

    blad('Juridik', 'gy1', 'Avtal',
         mal=['Förklara hur ett avtal kommer till med anbud och accept.',
              'Avgöra när ett svar blir ett nytt anbud i stället för ett avtal.',
              'Känna igen när ett avtal är ogiltigt eller kan jämkas.',
              'Förklara vad en fullmakt är och vad som gäller för omyndiga.'],
         fakta=['Ett avtal kommer till när ett anbud möter en accept som stämmer med anbudet. Huvudregeln är att '
                'ett muntligt avtal är lika bindande som ett skriftligt.',
                'Löftesprincipen: den som lämnat ett anbud är bunden av det så länge mottagaren har rätt att '
                'svara. Ett ja med ändringar, eller ett svar efter tidsfristen, blir ett nytt anbud.',
                'En annons med ett pris är normalt en uppmaning att lämna anbud, inte ett bindande anbud.',
                'Svek, ocker och tvång gör ett avtal ogiltigt. Ett oskäligt villkor kan jämkas, alltså ändras '
                'så att det blir skäligt.',
                'Den som är under 18 år är omyndig och behöver som regel vårdnadshavarens ja. Från 16 år råder '
                'en omyndig själv över det hon eller han tjänat på eget arbete.'],
         exempel=[('Mira erbjuder Ali att köpa hennes gamla dator. Ali svarar: ”Ja, om du lägger till musen.” '
                   'Har de ett avtal?',
                   'Nej, inte än. Ett ja med ändringar är en oren accept och räknas som ett nytt anbud, som Mira '
                   'kan anta eller avböja.'),
                  ('Nora ger sin bror fullmakt att sälja hennes cykel, och han säljer den till en granne. Vem är '
                   'bunden av avtalet med grannen?',
                   'Nora, som är fullmaktsgivare. Avtalet blir som om hon hade ingått det själv, så länge brodern '
                   'höll sig inom fullmakten.')],
         ord=[('anbud', 'ett erbjudande om att ingå ett avtal'),
              ('accept', 'ett ja till ett anbud'),
              ('fullmakt', 'rätt att ingå avtal i någon annans namn'),
              ('fullmaktsgivare', 'den som ger fullmakten; den som får den kallas fullmäktig'),
              ('omyndig', 'den som är under 18 år; vårdnadshavaren kan godkänna ett avtal i efterhand'),
              ('jämka', 'ändra ett villkor så att det blir skäligt')],
         tips='Vissa avtal måste vara skriftliga: köp av ett hus kräver ett kontrakt som både köparen och '
              'säljaren skriver under.'),

    blad('Juridik', 'gy1', 'Köp och konsument',
         mal=['Avgöra vilken lag som gäller vid ett köp: konsumentköplagen, köplagen, konsumenttjänstlagen eller '
              'distansavtalslagen.',
              'Förklara hur du reklamerar och vad du kan kräva när en vara har ett fel.',
              'Skilja på ångerrätt, öppet köp, reklamationsrätt och garanti.',
              'Beskriva vad Allmänna reklamationsnämnden gör.'],
         fakta=['Konsumentköplagen gäller när en privatperson köper en vara av ett företag, och köplagen mellan '
                'två privatpersoner. Bygger en snickare om ditt kök gäller konsumenttjänstlagen, för det är en tjänst.',
                'Reklamera betyder att säga till säljaren att varan har ett fel. Gör det inom skälig tid efter '
                'att du märkt felet; två månader är alltid i tid.',
                'Säljaren svarar som huvudregel för fel som visar sig inom tre år. Ett fel som visar sig inom '
                'två år antas ha funnits vid köpet, och då ska butiken visa motsatsen.',
                'Först kan du kräva att felet lagas eller att du får en ny vara. Går det inte, eller tar det för '
                'lång tid, kan du få prisavdrag eller häva köpet.',
                'Vid köp på nätet från ett företag har du 14 dagars ångerrätt enligt distansavtalslagen. I en '
                'butik finns ingen ångerrätt i lagen: öppet köp är butikens frivilliga löfte.'],
         exempel=[('Elsa köper hörlurar i en butik. Efter ett år slutar de fungera, och hon säger till butiken '
                   'direkt. Vad gäller?',
                   'Felet visade sig inom två år, så det antas ha funnits vid köpet, och Elsa har reklamerat i '
                   'tid. Hon kan i första hand kräva att felet lagas eller att hon får nya hörlurar.')],
         ord=[('konsument', 'en privatperson som köper främst för privat bruk'),
              ('garanti', 'ett extra löfte från säljaren eller tillverkaren, som kan ge mer men aldrig mindre'),
              ('ARN', 'Allmänna reklamationsnämnden: prövar tvister mellan konsumenter och företag och ger en '
                      'rekommendation'),
              ('avhjälpande', 'felet lagas'),
              ('omleverans', 'du får en ny, felfri vara'),
              ('hävning', 'köpet går tillbaka och du får pengarna')],
         tips='Reklamationsrätten har du alltid enligt lag, med eller utan garanti.'),

    blad('Juridik', 'gy1', 'Familj och arv',
         mal=['Förklara vad som delas vid en bodelning, för makar och för sambor.',
              'Beskriva vem som ärver enligt lag, i vilken ordning, och vad laglotten är.',
              'Förklara vad ett testamente, ett äktenskapsförord och ett samboavtal kan göra.',
              'Beskriva föräldrarnas ansvar för sina barn.'],
         fakta=['Det mesta makar äger är giftorättsgods, som delas lika vid en bodelning sedan skulderna dragits '
                'av. Med ett äktenskapsförord, registrerat hos Skatteverket, blir viss egendom enskild.',
                'Sambolagen delar bara bostad och bohag som skaffats för att användas tillsammans, och det går '
                'att avtala bort i ett samboavtal. Sambor ärver inte varandra utan testamente.',
                'Arvsklasserna: först bröstarvingarna, barn och barnbarn, sedan föräldrar och syskon, sist far- '
                'och morföräldrar och deras barn. Kusiner ärver inte.',
                'Laglotten är hälften av arvslotten. Den kan ett barn alltid kräva, vad ett testamente än '
                'säger.',
                'Har den avlidne en make och bara gemensamma barn ärver maken först. Särkullbarn kan få ut sitt '
                'arv direkt. Finns ingen arvinge eller testamente går arvet till Allmänna arvsfonden.'],
         exempel=[('Karin dör. Hon var inte gift och hade inga barn och inget testamente, men hennes föräldrar '
                   'lever. Vem ärver?',
                   'Föräldrarna. De hör till andra arvsklassen, och i den första, barn och barnbarn, finns ingen.'),
                  ('Två sambor har köpt en soffa till bostaden för att använda den tillsammans. De gör slut. Ingår '
                   'soffan i det som sambolagen delar?',
                   'Ja, den är bohag som skaffats för att användas tillsammans, om de inte har avtalat bort '
                   'delningen i ett samboavtal.')],
         ord=[('enskild egendom', 'egendom som inte delas vid en bodelning'),
              ('testamente', 'skriftligt besked om vem som ska få ens egendom, underskrivet inför två vittnen'),
              ('dödsbo', 'den avlidnes egendom och skulder innan arvet är fördelat'),
              ('särkullbarn', 'ett barn som den ena maken har med någon annan'),
              ('vårdnadshavare', 'ansvarar för att barnet får omvårdnad, trygghet och en god fostran'),
              ('underhållsskyldighet', 'föräldrarnas plikt att försörja barnet, till 18 år och längre om barnet '
                                       'går i skolan, som längst till 21')],
         tips='Bodelning delar egendom när ett förhållande tar slut eller en make dör; när ett arv fördelas heter '
              'det arvskifte.'),

    blad('Juridik', 'gy1', 'Brott och straff',
         mal=['Förklara vad som krävs för att en handling ska vara ett brott, och vad legalitetsprincipen säger.',
              'Skilja på uppsåt och oaktsamhet, och på böter och skadestånd.',
              'Förklara vad nödvärn är och var gränsen går.',
              'Beskriva stegen i ett brottmål och vem som gör vad i rättegången.'],
         fakta=['Ett brott är en handling som står beskriven i brottsbalken eller en annan lag, med ett straff. '
                'Legalitetsprincipen: ingen får straffas för något som inte var ett brott när det hände.',
                'Huvudregeln är att ett brott kräver uppsåt, att man gör något med flit. Oaktsamhet, slarv, '
                'räcker bara när lagen säger det.',
                'Böter är ett straff och betalas till staten. Skadestånd är inget straff utan betalas till den '
                'som har skadats.',
                'Nödvärn är rätten att försvara sig, eller hjälpa någon, mot ett pågående angrepp. Försvaret får '
                'inte vara uppenbart oförsvarligt.',
                'Ett brottmål går från anmälan till förundersökning, åtal, huvudförhandling och dom. För att '
                'någon ska dömas måste brottet vara ställt utom rimligt tvivel.'],
         exempel=[('Någon knuffar Jonna och försöker ta hennes väska. Hon knuffar tillbaka för att komma loss. '
                   'Är det nödvärn?',
                   'Ja, troligen: hon försvarar sig mot ett pågående angrepp, och försvaret är inte uppenbart '
                   'oförsvarligt. Att fortsätta slå någon som redan har gett upp hade inte varit nödvärn.'),
                  ('Tim döms till böter för ett brott och ska också betala skadestånd till den han skadade. Vem '
                   'får pengarna?',
                   'Böterna går till staten, för de är straffet. Skadeståndet går till den skadade och ersätter '
                   'skadan.')],
         ord=[('målsägande', 'den som har utsatts för brottet'),
              ('tilltalad', 'den som är åtalad'),
              ('åklagare', 'leder ofta förundersökningen, avgör om det blir åtal och för talan mot den tilltalade'),
              ('offentlig försvarare', 'försvarar den misstänkte och betalas av staten'),
              ('oskuldspresumtion', 'den misstänkte ska behandlas som oskyldig tills domen har vunnit laga kraft'),
              ('laga kraft', 'domen kan inte längre överklagas')],
         tips='Det är åklagaren som ska bevisa att den misstänkte är skyldig, inte den misstänkte som ska bevisa '
              'att hen är oskyldig.'),

    # ================================================================ Juridik gy2
    blad('Juridik', 'gy2', 'Grundlagarna',
         mal=['Förklara offentlighetsprincipen, censurförbudet och meddelarfriheten.',
              'Beskriva fri- och rättigheterna i regeringsformen och hur de kan begränsas.',
              'Beskriva hur en lag stiftas, från utredning till beslut i riksdagen.',
              'Förklara EU-rättens företräde och domstolarnas självständighet.'],
         fakta=['Offentlighetsprincipen står i tryckfrihetsförordningen: alla får ta del av allmänna handlingar '
                'som inte omfattas av sekretess, som huvudregel utan att säga vem de är eller varför.',
                'Censurförbudet: ingen myndighet får granska en skrift innan den ges ut. Meddelarfriheten och '
                'efterforskningsförbudet skyddar den som lämnar uppgifter till medierna.',
                'Regeringsformens andra kapitel skyddar fri- och rättigheter som yttrandefrihet, mötesfrihet och '
                'religionsfrihet. Några får begränsas genom lag, som yttrandefriheten genom brottet förtal.',
                'En lag stiftas i steg: utredning, remiss, regeringens proposition, behandling i ett utskott och '
                'beslut i riksdagen. Lagrådet granskar förslagen innan riksdagen beslutar.',
                'EU-rätten har företräde framför svensk lag. En EU-förordning gäller direkt, medan ett direktiv '
                'först ska föras in i svensk lag.'],
         exempel=[('En journalist ber kommunen om ett mejl som kommunen har fått in. Kommunen frågar varför hon '
                   'vill ha det. Får kommunen fråga det?',
                   'Som huvudregel inte. Mejlet är en allmän handling, och den som begär ut den behöver inte säga '
                   'vem hon är eller varför. Bara om kommunen måste pröva om det är hemligt får den fråga, och då '
                   'kan hon låta bli att svara.')],
         ord=[('proposition', 'regeringens förslag till riksdagen; en riksdagsledamots förslag heter motion'),
              ('misstroendeförklaring', 'riksdagens besked att en minister inte har dess förtroende; röstar mer än '
                                        'hälften av ledamöterna för den måste ministern avgå'),
              ('lagprövning', 'en domstol eller myndighet låter bli att tillämpa en regel som strider mot grundlag'),
              ('Europakonventionen', 'konventionen om de mänskliga rättigheterna, svensk lag sedan 1995'),
              ('riksdagen', '349 ledamöter, valda för fyra år i taget'),
              ('sekretess', 'ett förbud att lämna ut vissa uppgifter')],
         tips='Ingen, inte ens riksdagen eller regeringen, får bestämma hur en domstol ska döma i ett enskilt mål.'),

    blad('Juridik', 'gy2', 'Arbetsrätt',
         mal=['Beskriva anställningsformerna och vad som gäller vid en provanställning.',
              'Förklara skälen för uppsägning, turordningen och skillnaden mellan uppsägning och avsked.',
              'Förklara vad ett kollektivavtal är och vad fredsplikt, strejk och lockout innebär.',
              'Känna igen diskrimineringsgrunderna och vem som ansvarar för arbetsmiljön.'],
         fakta=['Huvudregeln i lagen om anställningsskydd är tillsvidareanställning, utan slutdatum. En '
                'provanställning får vara högst sex månader och går över i en tillsvidareanställning om inget '
                'besked ges i tid.',
                'En arbetsgivare kan säga upp en tillsvidareanställd på grund av arbetsbrist eller av personliga '
                'skäl. Vid arbetsbrist gäller som huvudregel turordning: sist in, först ut.',
                'Ett kollektivavtal är ett avtal mellan en arbetsgivare och ett fackförbund, till exempel om '
                'löner och arbetstider. I frågor som det reglerar råder fredsplikt medan det gäller.',
                'Diskrimineringslagen har sju grunder: kön, könsöverskridande identitet eller uttryck, etnisk '
                'tillhörighet, religion eller annan trosuppfattning, funktionsnedsättning, sexuell läggning och '
                'ålder.',
                'Arbetsgivaren har huvudansvaret för arbetsmiljön. Semesterlagen ger 25 semesterdagar per år, '
                'och ett muntligt anställningsavtal gäller också, men arbetsgivaren ska ge skriftlig information om de '
                'viktigaste villkoren.'],
         exempel=[('Ett lager har för lite arbete och måste säga upp en av två lagerarbetare. Ida har jobbat där i '
                   'fem år och Erik i ett. Vem har som huvudregel bäst skydd?',
                   'Ida. Vid arbetsbrist gäller turordning, och den som har arbetat längst hos arbetsgivaren har '
                   'bäst skydd. Arbetsgivaren får göra vissa undantag, och ett kollektivavtal kan ha andra regler.')],
         ord=[('avsked', 'anställningen upphör direkt, efter att den anställde grovt brutit mot sina skyldigheter'),
              ('fredsplikt', 'parterna får som huvudregel inte strejka eller ha lockout'),
              ('strejk', 'de anställda lägger ner arbetet'),
              ('lockout', 'arbetsgivaren stänger ute de anställda från jobbet'),
              ('skyddsombud', 'företräder de anställda i frågor om arbetsmiljön'),
              ('DO', 'Diskrimineringsombudsmannen: tar emot anmälningar och kan driva en sak i domstol')],
         tips='Många regler i arbetsrätten är huvudregler som ett kollektivavtal kan komplettera, till exempel med '
              'fler semesterdagar.'),

    blad('Juridik', 'gy2', 'Hyra och skulder',
         mal=['Förklara besittningsskydd, andrahandsuthyrning och vad hyresnämnden gör.',
              'Skilja på hyresrätt och bostadsrätt.',
              'Förklara skuldebrev, borgen, ränta och amortering.',
              'Beskriva stegen när en räkning inte betalas, från inkasso till utmätning.'],
         fakta=['Med ett förstahandskontrakt har du som huvudregel besittningsskydd: rätt att bo kvar när '
                'hyresvärden säger upp avtalet. Hyresvärden behöver ett godtagbart skäl, som obetald hyra.',
                'Att hyra ut i andra hand kräver hyresvärdens samtycke eller hyresnämndens tillstånd. '
                'Hyresgästens uppsägningstid är som huvudregel tre månader, från månadsskiftet efter uppsägningen.',
                'Med en hyresrätt hyr du av en hyresvärd. Med en bostadsrätt köper du en andel i en förening och '
                'rätten att bo i lägenheten.',
                'Ränta är priset för att låna pengar och räknas i procent av lånet. Amortering är att betala av '
                'på själva lånet, och bara den minskar skulden.',
                'Betalas inte en räkning kan ett inkassokrav följa, sedan betalningsföreläggande och utslag hos '
                'Kronofogden, och sist utmätning av lön eller egendom.'],
         exempel=[('Sofia hyr en lägenhet i första hand och ska plugga ett år i en annan stad. Hyresvärden säger '
                   'nej när hon vill hyra ut den till en kompis. Vad kan hon göra?',
                   'Hon kan söka tillstånd hos hyresnämnden, som avgör sådana tvister. Hyr hon ut utan lov kan hon '
                   'förlora sitt eget hyreskontrakt.'),
                  ('Moa går i borgen för sin brors lån, och brodern slutar betala. Vad kan hända Moa?',
                   'Hon kan få betala det som brodern inte betalar, i värsta fall hela skulden. Det var det hon tog på sig med borgen.')],
         ord=[('deposition', 'pengar som hyresgästen betalar i förväg som säkerhet och får tillbaka vid flytten, om '
                             'inget är skadat och hyran är betald'),
              ('hyresnämnden', 'medlar och avgör vissa tvister om hyra'),
              ('skuldebrev', 'ett skriftligt löfte att betala tillbaka en skuld'),
              ('kreditprövning', 'bankens prövning av om en konsument har råd att betala tillbaka ett lån'),
              ('betalningsanmärkning', 'syns hos kreditupplysningsföretagen och gör det svårare att få lån eller '
                                       'hyra en bostad'),
              ('Kronofogden', 'hjälper den som ska ha betalt att driva in skulder, och den som har skulder med '
                              'skuldsanering')],
         tips='Hyresvärden får komma in i lägenheten för tillsyn och reparationer, men ska som regel säga till i '
              'förväg.'),

    blad('Juridik', 'gy2', 'Skadestånd och försäkring',
         mal=['Förklara när någon blir skyldig att betala skadestånd, och vem som ansvarar när en anställd '
              'orsakar en skada.',
              'Skilja på personskada, sakskada, ren förmögenhetsskada och kränkning.',
              'Förklara självrisk, rättsskydd och regress, och vad olika försäkringar täcker.',
              'Skilja på skadestånd och böter.'],
         fakta=['Huvudregeln i skadeståndslagen är ansvar för vållande, culpa: den som orsakat en skada med '
                'uppsåt eller av vårdslöshet ska ersätta den. Också barn kan bli skadeståndsskyldiga.',
                'Arbetsgivaren svarar för skador som de anställda orsakar i arbetet: principalansvar. Har den '
                'skadade själv varit vårdslös kan skadeståndet jämkas, alltså sättas ned.',
                'Skadan ska vara en rimligt väntad följd av handlingen, adekvat kausalitet. Ett långsökt '
                'orsakssamband räcker inte.',
                'Skadestånd ersätter skadan och betalas till den skadade. Böter är ett straff och betalas till '
                'staten.',
                'Trafikförsäkringen måste finnas för ett fordon i trafik och ersätter personskador, oavsett vem '
                'som var vållande. Hemförsäkringens ansvarsdel kan betala när du blir skadeståndsskyldig.'],
         exempel=[('En målare som är anställd av ett företag spiller färg på en kunds matta under jobbet. Vem '
                   'ansvarar i första hand mot kunden?',
                   'Företaget, alltså arbetsgivaren. Den svarar för skador som de anställda orsakar i arbetet: '
                   'principalansvar.'),
                  ('En skada som Linns hemförsäkring täcker kostar mer än hennes självrisk. Vad betalar '
                   'försäkringen?',
                   'Det som blir över självrisken. Självrisken betalar Linn själv.')],
         ord=[('självrisk', 'den del av skadan som du själv betalar'),
              ('premie', 'det du betalar för försäkringen'),
              ('rättsskydd', 'den del av hemförsäkringen som betalar en del av kostnaden för ombud i vissa '
                             'tvister'),
              ('regress', 'försäkringsbolaget kräver den som orsakade skadan på det bolaget har betalat ut'),
              ('ren förmögenhetsskada', 'en ekonomisk förlust utan att någon person eller sak har skadats'),
              ('kränkning', 'ett brott mot någons frihet, frid eller ära')],
         tips='Ett skadestånd ska försätta den skadade i samma ekonomiska läge som om skadan inte hade hänt.'),
]
