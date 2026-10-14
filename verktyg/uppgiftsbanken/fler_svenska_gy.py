# -*- coding: utf-8 -*-
"""Fler nivåer i svenska för gymnasiet (Fas 23.5): Svenska 1, 2 och 3.

Allt står i TILLAGG och läggs sist i banorna sv-gy1, sv-gy2 och sv-gy3
(svenska_mer.py, blad_svenska.py, np_svenska.py). Skrivet från grunden mot
ämnesplanen i svenska; lästexterna och alla exempel (Siri och äppelträdet,
rektor Jonas Ek, Berta i köket, farfar och ”toppen”) är påhittade för
banken. Inget är taget ur ett nationellt prov, en lärobok eller någon annan
källa. Skriven med AI och inte läst av en lärare.

- gy1: ”Skriva rätt” (skiljetecken, stor och liten bokstav, ord som
  blandas ihop) och en krönika om hur språket förändras.
- gy2: ”Litteraturens epoker” (allmänna drag i upplysningen, romantiken,
  realismen och modernismen, ingen titel som måste kunnas) och en novell
  att tolka.
- gy3: ”Vetenskaplig metod” (hypotes, urval, validitet, samband och orsak)
  och en påhittad nyhetsartikel att läsa kritiskt.

Förenklat, med flit:
- Kommatering frågas bara där läraren inte är oense: uppräkning, komma före
  ”men” mellan huvudsatser och avgränsande eller icke avgränsande
  relativsats. Komma efter en inledande bisats frågas aldrig.
- ”Vart” och ”var”, ”dem” och ”de” frågas enligt skriftspråksnormen.
- Epokerna anges utan årtal. Texterna i exemplen är påhittade och har bara
  epokens allmänna drag, så att en fråga aldrig hänger på en lärobok.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SV = 'Svenska'


# --- Lästexterna, ett stycke per element -----------------------------

ORDEN = '\n\n'.join([
    'Orden kommer och går',
    'Min farfar säger fortfarande ”toppen” när något är riktigt bra. Jag har aldrig hört någon i min klass '
    'säga det. Vi säger andra saker, och om några år kommer våra ord också att låta gammaldags.',
    'Så har det alltid varit. Ungdomar hittar på nya ord, ger gamla ord nya betydelser och lånar från andra '
    'språk. Vissa ord blir kvar och andra försvinner efter bara en sommar. Ordet ”mejl” kom en gång från '
    'engelskan men är i dag så vanligt att ingen tänker på var det kommer ifrån.',
    'Många vuxna oroar sig för att språket förfaller. Språkforskare brukar svara att ett språk som inte '
    'förändras är ett språk som ingen längre använder. Förändringen är ett tecken på att språket lever.',
    'Själv tror jag att ungdomsorden gör mer än att förnya. De visar vilken grupp man hör till. Den som kan '
    'orden hör till, och den som inte kan dem märker att den står utanför. Kanske är det därför vi gillar dem.',
])

APPELTRADET = '\n\n'.join([
    'Äppelträdet',
    'Efter begravningen blev jag kvar i trädgården. De andra hade gått in till kaffet, och genom '
    'köksfönstret hörde jag klirret av koppar och dämpade röster.',
    'Morfars äppelträd stod vid stenmuren, precis som förut. Det hade aldrig gett mycket frukt, men han '
    'hade klippt det varje vår ändå. Varje höst hade han sagt till mig: ”Nästa år, Siri. Då blir det äpplen.”',
    'I år var grenarna tunga av frukt. Ingen hade klippt trädet, och det hade tagit tillfället i akt.',
    'Jag plockade ett äpple och bet i det. Det var hårt och så surt att jag fick knipa ihop ögonen. Ändå '
    'åt jag upp det, sakta, ända till kärnhuset.',
    'Dörren bakom mig öppnades. Mamma sa ingenting. Hon ställde en kopp kaffe på muren bredvid mig, och så '
    'stod vi där tillsammans och tittade på trädet som äntligen hade hållit sitt löfte.',
])

ELEVER, SVARADE, JOGGAR = 600, 94, 31

LOPARNA = '\n\n'.join([
    'Löparna får bäst betyg',
    'En ny undersökning på en gymnasieskola visar att elever som joggar före skolan har högre betyg än de '
    'som inte gör det. Rektor Jonas Ek är nöjd. ”Det här bekräftar vad vi har trott länge”, säger han. '
    '”Rörelse på morgonen ger bättre betyg.”',
    'Undersökningen gjordes med en enkät på skolans webbplats. Av skolans %d elever svarade %d. Av dem uppgav '
    '%d att de joggar före skolan, och deras betyg var i genomsnitt klart högre än de andra elevernas. '
    'Eleverna uppgav själva både sina betyg och hur ofta de joggar.' % (ELEVER, SVARADE, JOGGAR),
    'Rektorn vill nu att alla elever ska börja dagen med en joggingtur. ”Skolan har en skyldighet att göra '
    'det som fungerar”, säger han. Undersökningen har inte granskats av någon utomstående.',
])

# Uppdraget: lästext 600–1200 tecken.
for _t in (ORDEN, APPELTRADET, LOPARNA):
    assert 600 <= len(_t) <= 1200, len(_t)
assert JOGGAR < SVARADE < ELEVER
# Ungefär var sjätte elev svarade (94 av 600 är 15,7 procent).
assert abs(SVARADE / ELEVER - 1 / 6) < 0.02 and SVARADE / ELEVER < 0.5


TILLAGG = [
    # ================================================================
    # GYMNASIET 1 (Svenska 1)
    # ================================================================
    bana(SV, 'gy1', [
        niva('sv-gy1-fler-skrivregler-1', 'Komma, kolon och citattecken', 'Skriva rätt', [
            val('Vilken mening är rätt kommaterad?',
                ['Vi köpte bröd, ost, smör och mjölk.', 'Vi köpte bröd ost smör och mjölk.',
                 'Vi köpte bröd, ost, smör, och mjölk.'],
                'Vi köpte bröd, ost, smör och mjölk.',
                'I en uppräkning skiljs leden åt med komma. Före ”och” vid det sista ledet sätter man normalt inget '
                'komma, och här behövs det inte för att meningen ska bli tydlig.'),
            sant('Före ”men” sätter man komma när ordet binder ihop två huvudsatser, som i ”Jag ville komma, men '
                 'jag hade inte tid”.', True,
                 'Båda delarna kan stå som egna meningar: ”Jag ville komma” och ”jag hade inte tid”. Då skiljs de åt '
                 'med komma före ”men”.'),
            val('Varför står kommatecken runt ”som är sex år” i meningen ”Min lillebror, som är sex år, älskar '
                'dinosaurier”?',
                ['Bisatsen är ett extra tillägg som går att stryka', 'Satsen är en huvudsats som kan stå helt ensam',
                 'Alla bisatser måste alltid stå inom kommatecken'],
                'Bisatsen är ett extra tillägg som går att stryka',
                'Man vet redan vem det är, så bisatsen ger bara extra information. Då står den mellan kommatecken. '
                'En bisats som behövs för att peka ut någon, som i ”Eleverna som kom sent fick vänta”, får inga.'),
            val('Vilken mening använder kolon rätt?',
                ['Jag har tre husdjur: en hund, en katt och en hamster.',
                 'Jag har tre husdjur en hund: en katt och en hamster.',
                 'Jag har tre husdjur: en hund: en katt: och en hamster.'],
                'Jag har tre husdjur: en hund, en katt och en hamster.',
                'Kolon kan inleda en uppräkning efter en hel sats, och ”Jag har tre husdjur” är en hel sats. '
                'Leden i uppräkningen skiljs sedan åt med komma, och kolon står inte mitt i den.'),
            para('Para ihop skiljetecknet med vad det gör.',
                 [('komma', 'skiljer leden i en uppräkning åt'),
                  ('kolon', 'kan inleda en uppräkning efter en hel sats'),
                  ('citattecken', 'visar ord som är återgivna ordagrant'),
                  ('punkt', 'avslutar en vanlig påståendemening')],
                 'Skiljetecknen visar läsaren hur texten hänger ihop.'),
            val('Vilken mening innehåller en direkt anföring, alltså ord som återges ordagrant?',
                ['Hamid sa: ”Jag kommer strax.”', 'Hamid sa att han skulle komma strax.',
                 'Hamid kommer strax, enligt Mia.'],
                'Hamid sa: ”Jag kommer strax.”',
                'En direkt anföring återger orden som de sades och står inom citattecken. I de andra två återger '
                'någon annan vad Hamid sagt.'),
            skriv('Vilket skiljetecken inleder oftast en uppräkning efter en hel sats? Skriv tecknet eller '
                  'namnet. Exempel: ”Jag har tre favoritämnen___ svenska, historia och bild.”',
                  [':', 'kolon', 'ett kolon'],
                  'Före uppräkningen står en hel sats, ”Jag har tre favoritämnen”. Då passar kolon.'),
            sant('Namn på språk, som svenska och franska, skrivs med stor bokstav i svenskan.', False,
                 'Språk, veckodagar och månader skrivs med liten bokstav: svenska, franska, måndag, juni. '
                 'Länder skrivs med stor bokstav: Sverige, Frankrike.'),
            val('Vilka ord ska skrivas med stor bokstav i meningen ”i går åkte hamid och mia till lund.”?',
                ['I, Hamid, Mia och Lund', 'Bara Hamid, Mia och Lund', 'I, Hamid, Mia, Lund och går'],
                'I, Hamid, Mia och Lund',
                'Första ordet i en mening har stor bokstav, och det har namn på personer och platser. ”Går” är ett '
                'vanligt ord och skrivs med liten bokstav.'),
            skriv('Hur många kommatecken behövs i uppräkningen ”Vi åt pannkakor sylt och grädde”? Skriv ett tal.',
                  [tal(1), 'ett', 'ett komma', 'ett kommatecken'],
                  'Det är tre led: pannkakor, sylt och grädde. Komma behövs mellan de två första, men inte före '
                  '”och”: ”Vi åt pannkakor, sylt och grädde.”'),
        ], beskrivning='Tränar komma i uppräkningar, komma före ”men” och runt extra information, kolon, '
                       'citattecken och stor och liten bokstav.'),

        niva('sv-gy1-fler-skrivregler-2', 'Ord som blandas ihop', 'Skriva rätt', [
            val('Välj rätt ord: ”Det kom ___ människor till festen än vi hade trott.”',
                ['fler', 'flera', 'mer'], 'fler',
                'Fler är jämförelseformen av ”många” och står med ”än”. ”Flera” betyder ett antal och används utan '
                'jämförelse: flera människor kom.'),
            val('Välj rätt ord: ”___ ska ni resa i sommar?” Du frågar efter målet för resan.',
                ['Vart', 'Var'], 'Vart',
                'Vart används när det finns rörelse mot en plats: Vart ska du? Var används om platsen där något '
                'finns: Var bor du?'),
            val('Vilken mening är rätt skriven?',
                ['Jag borde ha ringt dig tidigare.', 'Jag borde av ringt dig tidigare.',
                 'Jag borde a ringt dig tidigare.'],
                'Jag borde ha ringt dig tidigare.',
                'Hjälpverbet skrivs ”ha”. ”Av” och ”a” är hur det kan låta i tal, men det är fel i skrift.'),
            val('Välj rätt ord: ”Hon är lika lång ___ sin syster.”',
                ['som', 'än', 'då'], 'som',
                'Vid likhet används ”lika … som”: lika lång som. ”Än” hör till jämförelse med olikhet: längre än.'),
            para('Para ihop ordet med hur det används.',
                 [('sin', 'syftar på subjektet: Anna tog sin väska.'),
                  ('hans', 'syftar på en annan man: Anna tog hans väska.'),
                  ('de', 'subjekt: De kommer snart.'),
                  ('dem', 'objekt: Jag ser dem.')],
                 'Sin, sitt och sina syftar tillbaka på subjektet i samma sats. Hans, hennes och deras syftar på '
                 'någon annan. De är subjektsformen och dem objektsformen.'),
            sant('Särskrivning, som ”hund koja” i stället för ”hundkoja”, räknas som ett skrivfel.', True,
                 'Sammansatta ord skrivs ihop på svenska, och en särskrivning kan dessutom göra meningen svår att '
                 'förstå.'),
            sant('”Vart” och ”var” kan alltid bytas mot varandra utan att meningen blir fel.', False,
                 'Vart hör ihop med riktning och var med plats. I skrift är det två olika ord.'),
            skriv('Skriv ihop de två orden till ett riktigt ord: kanel bulle', 'kanelbulle',
                  'Ett sammansatt ord skrivs som ett enda ord: kanelbulle.'),
            ordna('Anna tar sin egen jacka och går hem. Bygg meningen i dåtid. En bricka ska inte vara med.',
                  ['Anna', 'tog', 'sin', 'jacka', 'och', 'gick', 'hem.'], extra=['hennes'],
                  forklaring='Jackan är Annas egen, och Anna är subjektet. Då heter det ”sin jacka”. ”Hennes” '
                             'skulle betyda en annan kvinnas jacka.'),
            val('Välj rätt ord: ”Det var ___ människor på torget.”',
                ['många', 'mycket'], 'många',
                'Många används om det som går att räkna, mycket om det som inte går att räkna: många människor, '
                'mycket vatten.'),
        ], beskrivning='Tränar ord som ofta blandas ihop: fler och flera, var och vart, sin och hans, de och '
                       'dem, och särskrivning.'),

        niva('sv-gy1-fler-ungdomssprak-1', 'Orden kommer och går', 'Språket förändras', [
            val('Vilken är krönikans huvudtanke?',
                ['Språket förändras hela tiden, och det visar att det lever',
                 'Ungdomar borde sluta hitta på nya ord så att språket förblir lika',
                 'Vuxna förstår aldrig ungdomsspråk, och därför förfaller språket'],
                'Språket förändras hela tiden, och det visar att det lever',
                'Skribenten visar att ord kommer och går, och att förändringen är ett tecken på att språket används.'),
            skriv('Vilket språk kommer ordet ”mejl” ursprungligen från, enligt texten? Skriv ett ord.',
                  ['engelska', 'engelskan'],
                  'Det står att ”mejl” en gång kom från engelskan men i dag är så vanligt att ingen tänker på det.'),
            sant('Enligt texten försvinner alla nya ungdomsord efter bara en sommar.', False,
                 'Det står att vissa ord blir kvar och andra försvinner efter bara en sommar.'),
            val('Varför nämner skribenten att ett språk som inte förändras är ett språk som ingen längre använder?',
                ['För att visa att förändring hör till ett språk som lever',
                 'För att visa att ungdomar har fel i hur de använder orden',
                 'För att visa att gamla ord alltid är bättre än nya ord'],
                'För att visa att förändring hör till ett språk som lever',
                'Meningen svarar vuxna som oroar sig: ett språk som används förändras, och det är inget fel.'),
            val('Vad tror skribenten om klassens ord om några år?',
                ['De kommer också att låta gammaldags', 'De kommer att ha ersatt alla äldre ord',
                 'De kommer att stå kvar oförändrade i ordböckerna'],
                'De kommer också att låta gammaldags',
                'I första stycket står det att deras ord om några år också kommer att låta gammaldags, som farfars '
                '”toppen”.'),
            val('Vad menar skribenten med att den som inte kan orden ”står utanför”?',
                ['Orden visar gruppen man hör till, och den som saknar dem märker det',
                 'Den som inte kan orden får inte vara med på lektionerna i skolan',
                 'Den som inte kan orden talar alltid ett helt annat språk än klassen'],
                'Orden visar gruppen man hör till, och den som saknar dem märker det',
                'Skribenten tror att ungdomsord också är ett sätt att visa att man hör ihop. Den som inte kan dem '
                'känner sig utanför gruppen.'),
            sant('Skribenten menar att ungdomsord också kan visa vilken grupp man hör till.', True,
                 'Det står att ungdomsorden ”gör mer än att förnya”: de visar vilken grupp man hör till.'),
            para('Para ihop det i texten med vad det handlar om.',
                 [('toppen', 'ett ord som farfar fortfarande säger'),
                  ('mejl', 'ett lånord som blivit helt vanligt'),
                  ('språkforskare', 'säger att ett språk som lever förändras'),
                  ('vuxna', 'oroar sig ofta för att språket förfaller')],
                 'Texten ställer vuxnas oro mot språkforskarnas lugn och visar med exempel hur ord kommer och går.'),
            ordna('Ordna det som texten tar upp, i den ordning det kommer.',
                  ['Farfars ord och klassens ord', 'Hur ungdomar förnyar språket',
                   'Vuxnas oro och forskarnas svar', 'Orden som tecken på vilken grupp man hör till'],
                  forklaring='Texten börjar med farfar, går vidare till hur ord kommer och går, tar upp vuxnas oro '
                             'och slutar med skribentens egen tanke.'),
            val('Hur kan du se att texten är personlig?',
                ['Skribenten säger ”jag” och berättar om sin farfar',
                 'Skribenten använder många facktermer och källhänvisningar',
                 'Texten består av en dialog mellan flera personer'],
                'Skribenten säger ”jag” och berättar om sin farfar',
                'En personlig text utgår från skribentens egna erfarenheter och tankar. Här syns det i ”jag”, '
                '”min farfar” och ”min klass”.'),
        ], beskrivning='En krönika om hur språket förändras, med frågor om huvudtanke, slutsatser och hur '
                       'texten är byggd.',
            text=ORDEN),
    ]),

    # ================================================================
    # GYMNASIET 2 (Svenska 2)
    # ================================================================
    bana(SV, 'gy2', [
        niva('sv-gy2-fler-epoker-1', 'Upplysningen, romantiken och realismen', 'Litteraturens epoker', [
            skriv('Vad kallas en tidsperiod vars litteratur har gemensamma drag i tema och stil? Skriv ordet.',
                  ['epok', 'en epok', 'epoken', 'litterär epok', 'en litterär epok'],
                  'En epok är en period då många författare skriver med liknande tankar och stil. Gränserna är '
                  'inte skarpa, men indelningen i epoker hjälper oss att se sambanden.'),
            val('Vilket av dessa drag är typiskt för romantiken?',
                ['Känslor, natur och längtan efter något större står i centrum',
                 'Författaren granskar samhällets orättvisor på ett nyktert sätt',
                 'Texten bryter mot rim och form för att pröva något nytt'],
                'Känslor, natur och längtan efter något större står i centrum',
                'Romantiken lyfte fram känslan, naturen och fantasin. Samhällskritiken hör till realismen och '
                'brotten mot formen till modernismen.'),
            val('Vilket av dessa drag är typiskt för realismen?',
                ['Vardagen och vanliga människors villkor skildras sanningsenligt',
                 'Sagor, spöken och ensamma hjältar i vild natur står i centrum',
                 'Tankarna hoppar fritt mellan minnen, drömmar och föreställningar'],
                'Vardagen och vanliga människors villkor skildras sanningsenligt',
                'Realismen ville visa verkligheten som den är, ofta med kritik av samhället. Sagorna hör till '
                'romantiken och de hoppande tankarna till modernismen.'),
            para('Para ihop epoken med dess drag.',
                 [('upplysningen', 'tro på förnuft och vetenskap'),
                  ('romantiken', 'känsla, natur och längtan'),
                  ('realismen', 'vardagen och samhället sedda på nära håll'),
                  ('naturalismen', 'människan formas av arv och miljö')],
                 'Epokerna svarar ofta på varandra: romantiken tog avstånd från upplysningens förnuft, och '
                 'realismen ville visa verkligheten utan drömmar. Naturalismen drev realismen längre och såg '
                 'människan som formad av arv och miljö.'),
            sant('Romantiken var till en del en reaktion mot upplysningens tro på förnuftet.', True,
                 'Upplysningen litade på förnuft och vetenskap. Romantiken lyfte i stället fram känslan, fantasin '
                 'och det som inte går att förklara.'),
            sant('I realismen berättar författarna helst om kungar, sagoväsen och ödsliga landskap.', False,
                 'Det passar romantiken. Realismen skildrar helst vanliga människor i vardagen och i samhället.'),
            val('Vilken epok passar följande textstycke bäst? ”Skymningen lade sig över skogen, och i det bleka '
                'månskenet anade hon en röst som kallade henne bort från bygden, mot något som ingen kunde namnge.”',
                ['romantiken', 'realismen', 'upplysningen'], 'romantiken',
                'Natur, månsken, längtan och det outsägliga är typiska romantiska drag.'),
            val('Vilken epok passar följande textstycke bäst? ”Hyran hade höjts igen. Vid köksbordet räknade Berta '
                'mynten för tredje gången, medan barnen frös under täckena i rummet bredvid.”',
                ['realismen', 'romantiken', 'upplysningen'], 'realismen',
                'En vanlig kvinna, pengabrist och trånga förhållanden skildras nära och utan förskönande. Det är '
                'typiskt för realismen.'),
            val('Vad menas med nationalromantik?',
                ['Intresse för det egna landets natur, historia och folkdikt',
                 'Misstro mot allt som kommer från andra länder och kulturer',
                 'Kritik mot hur landets regering och myndigheter styr landet'],
                'Intresse för det egna landets natur, historia och folkdikt',
                'Nationalromantiken växte fram ur romantiken. Man samlade sagor och folkvisor och lyfte fram den '
                'egna naturen och historien.'),
            ordna('Ordna epokerna från äldst till yngst.',
                  ['upplysningen', 'romantiken', 'realismen'],
                  forklaring='Upplysningen hör till 1700-talet, romantiken till början av 1800-talet och realismen '
                             'till mitten och slutet av 1800-talet.'),
        ], beskrivning='Tränar allmänna drag i upplysningen, romantiken och realismen, och att känna igen epoken i '
                       'ett kort textstycke.'),

        niva('sv-gy2-fler-epoker-2', 'Modernismen och epokernas drag', 'Litteraturens epoker', [
            val('Vilket av dessa drag är typiskt för modernismen?',
                ['Brott mot traditionen och experiment med form och språk',
                 'Tro på att allt kan förklaras med förnuft och vetenskap',
                 'Skildringar av naturen som en källa till längtan och andlighet'],
                'Brott mot traditionen och experiment med form och språk',
                'Modernismen ville inte fortsätta som förr. Författarna prövade nya former, och dikter utan rim var '
                'vanliga.'),
            skriv('En dikt utan rim och utan fast versmått kallas fri ___. Skriv ordet som fattas.',
                  ['vers', 'fri vers'],
                  'Fri vers har varken rim eller fast rytm. Den blev vanlig i modernismen.'),
            val('Vad kallas det när en text återger en persons tankar direkt, som en röst inne i huvudet?',
                ['inre monolog', 'replikskifte', 'sammanfattning'], 'inre monolog',
                'I en inre monolog hör läsaren tankarna som de kommer. Det är ett vanligt grepp i modernistiska '
                'texter.'),
            sant('Modernismens splittrade form kan vara ett sätt att visa en splittrad upplevelse av världen.', True,
                 'Korta fragment och hoppande tankar kan spegla en värld som upplevs som sönderdelad och '
                 'främmande.'),
            sant('Modernismen kom före romantiken i litteraturhistorien.', False,
                 'Romantiken hör till 1800-talets början. Modernismen kom på 1900-talet.'),
            val('Vilken epok passar följande textstycke bäst? ”Gatan. Ljusen. Jag räknar fönstren: tolv, tretton. '
                'Någon skrattar långt borta. Vem är jag i den här staden?”',
                ['modernismen', 'realismen', 'romantiken'], 'modernismen',
                'Korta fragment, en inre röst och känslan av att vara främling i staden är typiska drag i '
                'modernismen.'),
            para('Para ihop epoken med den text som passar bäst.',
                 [('romantiken', 'en dikt om månljus och längtan'),
                  ('realismen', 'en roman om arbetares och fattigas villkor'),
                  ('modernismen', 'en dikt utan rim där tankarna hoppar'),
                  ('upplysningen', 'en text som med förnuft angriper vidskepelse')],
                 'Det är typiska exempel och inga regler. En enskild författare kan blanda drag från flera epoker.'),
            val('Vilken skillnad mellan realism och modernism stämmer?',
                ['Realismen skildrar det yttre, modernismen ofta en inre upplevelse',
                 'Realismen kom på 1900-talet och modernismen på 1800-talet i Sverige',
                 'Realismen använder fri vers, medan modernismen nästan alltid rimmar'],
                'Realismen skildrar det yttre, modernismen ofta en inre upplevelse',
                'Realismen vill visa det yttre, vardagen och samhället. Modernismen går ofta in i en persons '
                'tankar och upplevelser.'),
            val('Varför går det inte att ange exakt vilket år en epok börjar och slutar?',
                ['Nya idéer växer fram långsamt, och epoker överlappar varandra',
                 'Alla författare tillhör flera epoker samtidigt under hela livet',
                 'Böcker från samma epok har alltid getts ut samma år'],
                'Nya idéer växer fram långsamt, och epoker överlappar varandra',
                'Epoker är något vi har satt namn på i efterhand. Idéer och stilar förändras gradvis, så gränserna '
                'är suddiga.'),
            skriv('Vilken epok kom först: romantiken eller modernismen? Skriv ett ord.',
                  ['romantiken', 'romantik'],
                  'Romantiken kom på 1800-talet och modernismen på 1900-talet.'),
        ], beskrivning='Tränar modernismens drag, begreppen fri vers och inre monolog, och att skilja epokerna åt.'),

        niva('sv-gy2-fler-novell-1', 'Äppelträdet', 'Läsa och tolka', [
            val('Vem är berättaren i novellen?',
                ['Siri, som är morfars barnbarn', 'Siris mamma, som står vid köksfönstret',
                 'En berättare utanför som kan se allas tankar'],
                'Siri, som är morfars barnbarn',
                'Berättaren säger ”jag”, och morfar tilltalar henne i repliken: ”Nästa år, Siri.” Det är en '
                'jagberättare.'),
            sant('Trädet hade alltid gett mycket frukt.', False,
                 'Det står att trädet aldrig hade gett mycket frukt. Därför är det en stor sak att det hänger '
                 'fullt i år.'),
            skriv('Vad brukade morfar säga varje höst om trädet? Skriv de två första orden i hans replik.',
                  ['nästa år', 'nästa år,', '”nästa år”', '"nästa år"'],
                  'Morfar sa: ”Nästa år, Siri. Då blir det äpplen.” Han lovade det varje höst.'),
            ordna('Ordna det som händer, i den ordning det berättas.',
                  ['Siri blir kvar i trädgården efter begravningen', 'Siri minns vad morfar brukade säga om trädet',
                   'Siri biter i ett surt äpple', 'Mamma ställer en kopp kaffe på muren'],
                  forklaring='Berättelsen börjar efter begravningen, går via minnet av morfars ord till äpplet och '
                             'slutar med mamma vid muren.'),
            val('Vad kan trädet stå för i berättelsen?',
                ['Morfars löften, som uppfylls först när han inte finns kvar',
                 'Familjens pengar, som aldrig riktigt räckte till för allt',
                 'Siris längtan efter att få flytta hemifrån och bli vuxen'],
                'Morfars löften, som uppfylls först när han inte finns kvar',
                'Trädet ger äntligen frukt, precis som morfar lovade, men han är inte där. Det är en tolkning som '
                'bygger på orden ”nästa år” och ”hållit sitt löfte”.'),
            val('Vad visar det att Siri äter upp det sura äpplet ändå?',
                ['Hon vill ta emot det som morfar aldrig fick se',
                 'Hon tycker egentligen mycket om sura äpplen',
                 'Hon har inte ätit något alls på hela dagen'],
                'Hon vill ta emot det som morfar aldrig fick se',
                'Äpplet är surt men betyder något. Att hon äter upp det sakta visar att hon tar emot trädets '
                'frukt, trots sorgen.'),
            val('Vad menas med att trädet ”hade hållit sitt löfte”?',
                ['Det bar äntligen frukt, som morfar hade lovat',
                 'Det hade lovat Siri att aldrig bli klippt igen',
                 'Det hade vuxit sig högre än stenmuren i år'],
                'Det bar äntligen frukt, som morfar hade lovat',
                'Löftet var morfars: ”Nästa år … Då blir det äpplen.” Nu bär trädet frukt, så löftet har hållits.'),
            val('Hur är stämningen när berättelsen slutar?',
                ['Stilla och sorgsen, men med en känsla av tröst', 'Spänd och orolig, som när något hemskt ska hända',
                 'Glad och uppsluppen, som på en stor födelsedag'],
                'Stilla och sorgsen, men med en känsla av tröst',
                'Ingen säger något, men mamma ställer fram kaffe och de står tillsammans. Sorgen finns kvar, men '
                'de är inte ensamma.'),
            para('Para ihop meningen med rätt stilfigur.',
                 [('Trädet höll sitt löfte.', 'personifikation'),
                  ('Sorgen var tung som en sten.', 'liknelse'),
                  ('Sorgen är en sten i bröstet.', 'metafor')],
                 'Ett träd kan inte lova något, så meningen ger trädet en mänsklig egenskap. En liknelse använder '
                 '”som”, och en metafor säger att något är något annat.'),
            sant('Mamma säger ingenting när hon kommer ut i trädgården.', True,
                 'Det står: ”Mamma sa ingenting.” Hon visar sin omtanke genom att ställa fram en kopp kaffe.'),
        ], beskrivning='En kort novell om en begravning och ett träd, med frågor om berättare, symbolik, '
                       'stilfigurer och stämning.',
            text=APPELTRADET),
    ]),

    # ================================================================
    # GYMNASIET 3 (Svenska 3)
    # ================================================================
    bana(SV, 'gy3', [
        niva('sv-gy3-fler-metod-1', 'Hypotes, urval och mätning', 'Vetenskaplig metod', [
            val('Vad är en hypotes?',
                ['Ett antagande som en undersökning ska pröva', 'Ett resultat som redan är bevisat och säkert',
                 'En sammanfattning av vad tidigare forskare har skrivit'],
                'Ett antagande som en undersökning ska pröva',
                'En hypotes är ett antagande, ofta byggt på tidigare kunskap, som går att pröva. Undersökningen visar sedan om den stöds eller inte.'),
            para('Para ihop begreppet med vad det betyder i en undersökning.',
                 [('population', 'alla som undersökningen vill uttala sig om'),
                  ('urval', 'de som väljs ut att delta i undersökningen'),
                  ('bortfall', 'de i urvalet som inte svarar eller deltar'),
                  ('kontrollgrupp', 'en jämförelsegrupp som inte får behandlingen')],
                 'Ett urval hämtas ur en population. Bortfallet säger hur många av urvalet som aldrig kom med.'),
            val('Du vill veta vad eleverna på en skola tycker om skolmaten. Vilket urval är mest representativt?',
                ['Femtio elever som lottas fram ur skolans alla elevlistor',
                 'De femtio första eleverna som står i matkön en måndag',
                 'Femtio elever som själva har anmält sig till matrådet'],
                'Femtio elever som lottas fram ur skolans alla elevlistor',
                'Ett slumpmässigt urval ger alla samma chans att komma med. Matkön och matrådet samlar elever som '
                'redan har en särskild relation till maten.'),
            val('Vad innebär hög validitet?',
                ['Att undersökningen mäter det den är avsedd att mäta',
                 'Att man får samma resultat varje gång man mäter',
                 'Att så många som möjligt har svarat på frågorna'],
                'Att undersökningen mäter det den är avsedd att mäta',
                'Validitet betyder giltighet. Att få samma resultat varje gång kallas reliabilitet.'),
            sant('Ett test som ska mäta läsförståelse men mest innehåller matematikfrågor brister i validitet.', True,
                 'Testet mäter något annat än det är tänkt att mäta, och då är det inte giltigt.'),
            sant('Ett urval blir representativt bara av att det är stort.', False,
                 'En stor grupp som valt sig själv, till exempel genom en omröstning på nätet, kan ändå vara skev. '
                 'Urvalet måste spegla populationen.'),
            skriv('Vad kallas det när personer i ett urval inte svarar eller avbryter sitt deltagande? Skriv ordet.',
                  ['bortfall', 'ett bortfall', 'bortfallet'],
                  'Bortfall kan göra resultatet skevt, särskilt om de som saknas skiljer sig från dem som svarat.'),
            val('Vilken undersökning är kvalitativ?',
                ['Djupintervjuer med fem elever om hur det är att byta skola',
                 'En enkät med svarsskala från 1 till 5 till trehundra elever',
                 'En räkning av frånvarodagar i alla klasser under ett läsår'],
                'Djupintervjuer med fem elever om hur det är att byta skola',
                'Kvalitativa metoder undersöker upplevelser och mening på djupet. Kvantitativa metoder mäter och '
                'räknar.'),
            ordna('Ordna stegen i en enkel undersökning.',
                  ['Formulera en frågeställning', 'Välj metod och urval', 'Samla in materialet',
                   'Analysera och dra slutsatser'],
                  forklaring='Frågeställningen styr vilken metod som passar. Först när materialet är insamlat går '
                             'det att analysera och dra slutsatser.'),
            val('Vilken hypotes går att pröva i en undersökning?',
                ['Åtta timmars sömn ger högre provresultat än fem timmars sömn',
                 'Ungdomar är på något sätt annorlunda i dag än de var förr',
                 'Det är mycket viktigt att alla människor i samhället mår bra'],
                'Åtta timmars sömn ger högre provresultat än fem timmars sömn',
                'En hypotes ska gå att mäta och jämföra. De andra två är för vaga eller är värderingar.'),
        ], beskrivning='Tränar vetenskaplig metod: hypotes, urval, bortfall, validitet och skillnaden mellan '
                       'kvalitativa och kvantitativa metoder.'),

        niva('sv-gy3-fler-metod-2', 'Samband eller orsak?', 'Vetenskaplig metod', [
            val('Glassförsäljningen och antalet badolyckor ökar båda under sommaren. Vad är mest troligt?',
                ['En tredje faktor, värmen, påverkar båda', 'Glassen orsakar badolyckorna på stränderna',
                 'Badolyckorna får fler människor att köpa glass'],
                'En tredje faktor, värmen, påverkar båda',
                'Varmt väder gör att fler köper glass och fler badar, och då sker fler olyckor. Glass och olyckor '
                'hänger ihop utan att den ena orsakar den andra.'),
            sant('Om två saker förekommer samtidigt bevisar det att den ena orsakar den andra.', False,
                 'Ett samband är inte detsamma som ett orsakssamband. Det kan bero på en tredje faktor eller på '
                 'slumpen.'),
            skriv('Vad kallas ett samband mellan två saker som ser ut som ett orsakssamband men i själva verket '
                  'beror på en tredje faktor? Skriv ordet.',
                  ['skensamband', 'ett skensamband', 'skensambandet', 'skenbart samband', 'ett skenbart samband'],
                  'Ett skensamband ser ut som en orsak men är ett resultat av något annat som påverkar båda sidor.'),
            para('Para ihop begreppet med dess betydelse.',
                 [('korrelation', 'två saker som varierar tillsammans'),
                  ('orsakssamband', 'det ena leder till det andra'),
                  ('bakomliggande faktor', 'en tredje sak som påverkar båda'),
                  ('slump', 'en tillfällighet som inte följer någon regel')],
                 'Korrelation visar att något hänger ihop. Först ett orsakssamband säger att det ena leder till det '
                 'andra.'),
            val('En studie visar att elever som cyklar till skolan har högre betyg. Vilken slutsats är rimligast?',
                ['De som cyklar har i snitt högre betyg, men orsaken är okänd',
                 'Att cykla till skolan leder till högre betyg för alla elever',
                 'Höga betyg gör att eleverna väljer att cykla till skolan'],
                'De som cyklar har i snitt högre betyg, men orsaken är okänd',
                'Studien visar ett samband, men inte vad som orsakar vad. De andra två slutsatserna påstår mer än '
                'studien kan visa.'),
            val('Elever med många böcker hemma får högre provresultat. Vad kan förklara både böckerna och '
                'resultaten?',
                ['Föräldrarnas utbildning och ekonomi', 'Att tunga böcker är svåra att bära med sig',
                 'Hur svåra proven på skolan är varje år'],
                'Föräldrarnas utbildning och ekonomi',
                'En bakomliggande faktor kan påverka båda. Det är inte säkert att böckerna i sig gör eleverna '
                'bättre.'),
            val('Varför har man en kontrollgrupp i en studie om en ny studieteknik?',
                ['För att kunna jämföra med dem som inte fick tekniken',
                 'För att få fler deltagare till hela studien snabbare',
                 'För att slippa formulera en hypotes före starten'],
                'För att kunna jämföra med dem som inte fick tekniken',
                'Utan en jämförelse går det inte att veta om förbättringen beror på tekniken eller på något annat.'),
            sant('Om bara de som själva vill svara deltar i en undersökning kan resultatet bli skevt.', True,
                 'De som väljer att svara kan skilja sig från dem som inte gör det. Urvalet speglar då inte '
                 'populationen.'),
            skriv('Vad heter verbet för att låta ett resultat från ett urval gälla en större grupp? Skriv verbet '
                  'i grundform.',
                  ['generalisera', 'att generalisera'],
                  'Att generalisera är att dra slutsatser om alla utifrån några. Det går bara om urvalet är '
                  'representativt.'),
            val('Vad bör en forskare göra om resultatet bara visar ett samband?',
                ['Skriva att resultatet tyder på ett samband och undersöka orsaken',
                 'Skriva att orsaken är bevisad eftersom sambandet är tydligt',
                 'Låta bli att redovisa resultatet eftersom det inte är säkert'],
                'Skriva att resultatet tyder på ett samband och undersöka orsaken',
                'En forskare redovisar det hen kan visa och säger öppet vad som inte är visat. Det är ärligt och '
                'gör att andra kan bygga vidare.'),
        ], beskrivning='Tränar skillnaden mellan samband och orsak, skensamband, bakomliggande faktorer och '
                       'försiktiga slutsatser.'),

        niva('sv-gy3-fler-metod-3', 'Löparna får bäst betyg', 'Vetenskaplig metod', [
            val('Ungefär hur stor del av skolans elever svarade på enkäten?',
                ['Ungefär var sjätte elev', 'Ungefär hälften av eleverna', 'Ungefär var femtionde elev'],
                'Ungefär var sjätte elev',
                'Av %d elever svarade %d. Det är cirka 16 procent, alltså ungefär var sjätte.' % (ELEVER, SVARADE)),
            val('Vilken svaghet finns i hur uppgifterna samlades in?',
                ['Eleverna rapporterade själva, och bara en del av dem svarade',
                 'Enkäten gjordes på papper och delades ut på lektionerna',
                 'Eleverna fick inte veta vad undersökningen handlade om'],
                'Eleverna rapporterade själva, och bara en del av dem svarade',
                'Betyg och joggingvanor kom från eleverna själva, och de flesta svarade inte alls. Det ger ett '
                'osäkert underlag och ett möjligt bortfall.'),
            val('Vilken förklaring kan finnas till att joggarna har högre betyg, utan att joggingen är orsaken?',
                ['Mycket målmedvetna elever kan både jogga och satsa på skolan',
                 'Elever som joggar sover alltid mindre än alla andra elever',
                 'Rektorn satte själv betygen på de elever som joggade'],
                'Mycket målmedvetna elever kan både jogga och satsa på skolan',
                'En bakomliggande faktor, till exempel målmedvetenhet, kan påverka både joggingen och betygen. De '
                'andra två förklaringarna har inget stöd i texten.'),
            sant('Undersökningen har granskats av utomstående forskare.', False,
                 'Det står: ”Undersökningen har inte granskats av någon utomstående.”'),
            sant('Eleverna uppgav själva sina betyg, vilket kan göra uppgifterna mindre tillförlitliga.', True,
                 'Uppgifterna kommer bara från eleverna själva. Den som svarar kan minnas fel eller överdriva.'),
            skriv('Hur många av dem som svarade joggar inte före skolan? Skriv ett tal.', tal(SVARADE - JOGGAR),
                  '%d svarade, och %d joggar före skolan. %d − %d = %d.'
                  % (SVARADE, JOGGAR, SVARADE, JOGGAR, SVARADE - JOGGAR)),
            para('Para ihop uppgiften med rätt tal ur texten.',
                 [('elever på skolan', tal(ELEVER)), ('elever som svarade på enkäten', tal(SVARADE)),
                  ('elever som joggar före skolan', tal(JOGGAR))],
                 'Bara %d av %d elever svarade, och %d av dem joggar före skolan.' % (SVARADE, ELEVER, JOGGAR)),
            ordna('Ordna det artikeln tar upp, i den ordning det står.',
                  ['Vad undersökningen visar och vad rektorn säger', 'Hur enkäten gjordes och vilka som svarade',
                   'Vad rektorn vill göra nu', 'Att ingen utomstående har granskat studien'],
                  forklaring='Artikeln börjar med resultatet och rektorns tolkning, går över till metoden, tar upp '
                             'rektorns plan och slutar med att studien inte är granskad.'),
            val('Vilken formulering vore mest rimlig i en korrekt rapport om undersökningen?',
                ['Av de 94 som svarade hade joggarna högre betyg, men orsaken är okänd',
                 'Jogging ger bättre betyg, och därför bör alla elever på skolan jogga',
                 'Skolans elever har högre betyg än elever på andra gymnasieskolor'],
                'Av de 94 som svarade hade joggarna högre betyg, men orsaken är okänd',
                'Rapporten ska säga vad undersökningen visar och vilka den gäller, utan att påstå att joggingen är '
                'orsaken.'),
            val('Vad skulle göra studien starkare?',
                ['Ett slumpmässigt urval och en jämförelse över längre tid',
                 'Att fler rektorer och lärare får uttala sig om resultatet',
                 'Att enkäten skickas ut via skolans sociala medier'],
                'Ett slumpmässigt urval och en jämförelse över längre tid',
                'Ett slumpmässigt urval ger en mer representativ grupp, och uppföljning över tid visar om joggingen '
                'kommer före betygen eller tvärtom.'),
        ], beskrivning='En påhittad nyhetsartikel om en undersökning, med frågor om urval, orsak och samband och '
                       'om vad som saknas.',
            text=LOPARNA),
    ]),
]
