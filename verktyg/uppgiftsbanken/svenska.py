# -*- coding: utf-8 -*-
"""Svenska åk 3, 6 och 8. Skrivregler, ordklasser, stavning, meningsbyggnad och läsförståelse ur Lgr22:s centrala innehåll, med bara regler som Språkrådet och läromedlen är ense om.

Fyra saker styr hur frågorna är skrivna:

- Rättningen struntar i stora och små bokstäver och i punkt sist. Allt
  som gäller stor bokstav eller skiljetecken är därför val eller ordna,
  aldrig skriv. Kontrollen jämför också alternativen utan skiftläge och
  punkt sist, så två alternativ får inte skilja sig bara i det: fråga
  hellre vilket ORD som ska ha stor bokstav.
- Det språkvårdarna inte är ense om frågas inte: i dag eller idag, dom,
  komma före men eller efter en inledande bisats, kolon direkt efter ett
  verb. Ett barn som skrivit något godtagbart ska inte få höra att det
  är fel.
- En ordna-mening med inte har ofta två rätta ordningar ("Jag tror inte
  att hon kommer" och "Jag tror att hon inte kommer"). Inte i bisatsen
  frågas därför som val, där de felaktiga alternativen är fel för alla.
- Läsförståelsens texter är skrivna för banken, och varje fråga går att
  besvara ur texten ensam. Ett sant eller falskt avgörs av det som står
  där, inte av vad eleven vet sedan förut, och en slutsats frågas bara
  när texten motsäger de felaktiga alternativen.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

# Lästexterna, ett stycke per element. Spelaren får dem åtskilda av en
# tom rad.
ALLEMANSRATTEN = '\n\n'.join([
    'I Sverige får alla röra sig fritt i naturen, också i skogar och på ängar som någon '
    'annan äger. Den friheten kallas allemansrätten.',
    'Allemansrätten gör att du får gå, cykla och bada nästan var du vill. Du får också tälta '
    'en natt eller två på samma ställe. Men du får inte gå in på någons tomt, alltså området '
    'närmast ett hus där någon bor.',
    'Du får plocka bär och de flesta svampar och blommor. Några sällsynta växter och svampar är fridlysta, '
    'vilket betyder att de skyddas av lagen. Många av dem får man inte plocka alls. Du får '
    'inte heller bryta grenar från levande träd.',
    'Du får göra upp eld om det är säkert. När det är mycket torrt kan det bli '
    'eldningsförbud, och då får man inte göra upp eld i naturen.',
    'Allemansrätten är alltså ingen rätt att göra vad man vill. Den som är ute i naturen ska '
    'ta med sig sitt skräp hem och inte störa djuren eller människorna som bor där. Man '
    'brukar säga det kort så här: inte störa, inte förstöra.',
])

TOMATERNA = '\n\n'.join([
    'Fru Lind bodde två våningar ovanför Amir. Innan hon reste till sin syster i Luleå gav '
    'hon honom sin nyckel och en lapp. På lappen stod det att blommorna i fönstren skulle '
    'vattnas varannan dag och att tomatplantorna på balkongen behövde vatten varje kväll.',
    '”Du får femhundra kronor när jag kommer hem”, sa hon.',
    'De första dagarna gick det bra. Sedan började fotbollslägret som Amir hade längtat efter '
    'hela våren, och han kom hem så trött att han somnade i soffan med skorna på. Nyckeln '
    'låg kvar i fruktskålen i hallen.',
    'På fredagen fick han syn på den när han skulle ta ett äpple. Han sprang uppför trapporna '
    'två steg i taget. På balkongen hängde tomatplantorna slokande över kanterna på krukorna, '
    'och jorden hade spruckit som en torr åker. Han vattnade tills det rann ut under krukorna, '
    'men en av plantorna reste sig aldrig igen.',
    'På lördagen slängde han den döda plantan. Sedan cyklade han till en handelsträdgård och '
    'köpte en ny planta för pengar som han hade sparat till en mobil. Den var mindre än de '
    'andra och hade inga tomater än. Han ställde den längst in, bakom de andra.',
    'När fru Lind kom hem på söndagen gick hon rakt ut på balkongen. Amir stod kvar i dörren '
    'och tittade ner på sina skor.',
    '”Så fina de är”, sa hon. ”Och den lilla längst in, den minns jag inte att jag har köpt.”',
    'Hon log och räckte honom en femhundralapp. Amir tog emot den, men han visste inte var '
    'han skulle göra av händerna.',
    '”Nästa sommar kanske vi ska skriva en lista tillsammans”, sa fru Lind. ”Man glömmer så '
    'lätt när det händer mycket.”',
])

BANOR = [
    bana('Svenska', 'ak3', [
        niva('sv-ak3-skrivregler-1', 'Stor bokstav och punkt', 'Skrivregler', [
            val('Hur börjar en mening?',
                ['Med stor bokstav', 'Med liten bokstav', 'Med en punkt'], 'Med stor bokstav',
                'Det första ordet i en mening har alltid stor bokstav.'),
            val('Vad ska stå sist? ”Vi ska bada i sjön”',
                ['punkt', 'frågetecken', 'komma'], 'punkt',
                'Meningen berättar något. Då sätter man punkt sist.'),
            val('Vad ska stå sist? ”Vill du leka med mig”',
                ['punkt', 'frågetecken', 'komma'], 'frågetecken',
                'Meningen är en fråga. Efter en fråga sätter man frågetecken.'),
            val('Vilket ord ska skrivas med stor bokstav?',
                ['stockholm', 'måndag', 'juli', 'skola'], 'stockholm',
                'Stockholm är namnet på en stad, och namn har stor bokstav. '
                'Dagar och månader har liten bokstav.'),
            # Facit visas som det första svaret: Bella, med den stora bokstaven.
            skriv('Ett ord saknar stor bokstav. Skriv ordet. ”Min hund heter bella.”', 'Bella',
                  'Bella är ett namn. Namn har alltid stor bokstav, var de än står.'),
            skriv('Hur många meningar är det? ”Det regnar. Vi är inne. Vi spelar spel.”',
                  [tal(3), 'tre'],
                  'Varje mening slutar med punkt. Det finns tre punkter, alltså tre meningar.'),
            ordna('Bygg meningen. Den börjar med stor bokstav och slutar med punkt.',
                  ['Katten', 'sover', 'i', 'soffan.'],
                  forklaring='Katten har stor bokstav, så det ordet står först. '
                             'Soffan har punkt, så det står sist.'),
            ordna('Bygg frågan. En bricka hör inte dit.', ['Vad', 'heter', 'du?'], extra=['du.'],
                  forklaring='Det är en fråga, så den slutar med frågetecken och inte med punkt.'),
        ], beskrivning='Tränar när man skriver stor bokstav och vilket tecken som avslutar en mening.'),

        niva('sv-ak3-alfabetet-1', 'Alfabetisk ordning', 'Alfabetet', [
            val('Vilken bokstav kommer efter k i alfabetet?', ['l', 'j', 'm'], 'l',
                'Alfabetet går j, k, l, m. Direkt efter k kommer l.'),
            skriv('Vilken bokstav står mellan r och t i alfabetet?', 's',
                  'Alfabetet går r, s, t. Bokstaven mellan r och t är s.'),
            skriv('Vilken bokstav kommer direkt efter z?', 'å',
                  'I det svenska alfabetet kommer å, ä och ö sist, efter z.'),
            val('Vilket ord kommer först i alfabetisk ordning?', ['boll', 'apa', 'cykel'], 'apa',
                'Titta på första bokstaven. A kommer före b och c.'),
            val('Alla orden börjar på m. Vilket kommer först i alfabetisk ordning?',
                ['mus', 'mjölk', 'mamma'], 'mamma',
                'När första bokstaven är samma tittar man på den andra: a, j och u. '
                'A kommer först, så mamma står först.'),
            val('Vilket ord kommer sist i alfabetisk ordning?', ['zebra', 'öga', 'ål'], 'öga',
                'Ö är den allra sista bokstaven i alfabetet. Därför kommer öga efter både zebra och ål.'),
            ordna('Ordna orden i alfabetisk ordning.', ['boll', 'fisk', 'sol', 'zebra', 'äpple'],
                  forklaring='B, f, s, z och sist ä. Å, ä och ö kommer efter z i alfabetet.'),
            ordna('Ordna orden i alfabetisk ordning. Alla börjar på b, så titta på andra bokstaven.',
                  ['bad', 'bil', 'bok', 'buss'],
                  forklaring='Andra bokstäverna är a, i, o och u. I alfabetet kommer de i den ordningen.'),
        ], beskrivning='Tränar alfabetets ordning och att sortera ord efter första och andra bokstaven.'),

        niva('sv-ak3-ljud-1', 'Vokaler och konsonanter', 'Ljud och bokstäver', [
            val('Vilken bokstav är en vokal?', ['e', 'k', 's', 'm'], 'e',
                'Vokalerna är a, e, i, o, u, y, å, ä och ö. E är en av dem.'),
            val('Vilken bokstav är en konsonant?', ['r', 'a', 'y', 'ö'], 'r',
                'A, y och ö är vokaler. R är en konsonant, som alla bokstäver som inte är vokaler.'),
            skriv('Hur många vokaler finns det i det svenska alfabetet?', [tal(9), 'nio'],
                  'Vokalerna är a, e, i, o, u, y, å, ä och ö. Det är nio stycken.'),
            skriv('En vokal fattas. Vilken? a, e, i, o, u, y, å, ä', 'ö',
                  'Alla nio vokaler är a, e, i, o, u, y, å, ä och ö. Det var ö som fattades.'),
            skriv('Hur många vokaler finns det i ordet ”tomat”?', [tal(2), 'två'],
                  'T-o-m-a-t. O och a är vokaler, så det blir två. T och m är konsonanter.'),
            val('Vilket ord börjar med en vokal?', ['äpple', 'banan', 'päron', 'melon'], 'äpple',
                'Ä är en vokal. B, p och m är konsonanter.'),
            val('Vilket ord har bara en vokal?', ['katt', 'hunden', 'kanin', 'kamel'], 'katt',
                'I katt finns bara a. Hunden har u och e, kanin har a och i, kamel har a och e.'),
            ordna('Ordna vokalerna så som de står i alfabetet.', ['i', 'o', 'y', 'å', 'ö'],
                  forklaring='I kommer före o och o före y. Å och ö står sist i alfabetet.'),
        ], beskrivning='Tränar att skilja vokaler från konsonanter och att hitta vokalerna i ett ord.'),

        # Påståendena gäller enskilda ord, aldrig regeln: efter en kort
        # vokal kommer OFTAST två konsonanter (han, man och vem har en), och
        # ett sant eller falskt ska vara sant för alla.
        niva('sv-ak3-ljud-2', 'Korta och långa vokaler', 'Ljud och bokstäver', [
            para('Orden låter nästan likadant. Para ihop ordet med vad det betyder.',
                 [('glas', 'något man dricker ur'),
                  ('glass', 'något kallt och gott som man äter'),
                  ('tak', 'det som är högst upp på ett hus'),
                  ('tack', 'det man säger när man får något')],
                 'I glas och tak är a långt. I glass och tack är a kort, och då står det två '
                 'konsonanter efter: ss och ck.'),
            sant('I ordet ”katt” är a kort.', True,
                 'Säg katt högt. A låter kort, och därför skriver man två t.'),
            sant('I ordet ”sol” är o kort.', False,
                 'Säg sol högt. O låter långt, och därför står det bara ett l efter.'),
            val('Vilket ord har en kort vokal?', ['boll', 'bil', 'bok', 'mus'], 'boll',
                'I boll är o kort, och då skriver man två l. I bil, bok och mus är vokalen lång.'),
            val('Vilket ord fattas? ”Grodan kan … högt.”', ['hoppa', 'hopa', 'hobba'], 'hoppa',
                'O är kort i hoppa, och därför skriver man två p. Med ett p hade o låtit långt.'),
            skriv('Ett ord är felstavat: ”Nu är det somar och varmt.” Skriv ordet rätt.', 'sommar',
                  'O är kort i sommar. Därför skriver man två m.'),
            val('Vilket ord passar i meningen? ”Efter maten ska vi … en stund.”', ['vila', 'villa'], 'vila',
                'I vila är i långt, och då skriver man ett l. En villa, med kort i och två l, är ett hus.'),
            ordna('Bygg meningen. En bricka är felstavad och hör inte dit.',
                  ['Min', 'docka', 'heter', 'Lisa.'], extra=['doka'],
                  forklaring='O är kort i docka. Efter ett kort o skrivs k-ljudet ck.'),
        ], beskrivning='Tränar att höra om en vokal är kort eller lång, och att stava ord där det gör skillnad.'),

        niva('sv-ak3-ordklasser-1', 'Substantiv och verb', 'Ordklasser', [
            val('Vilket ord är ett substantiv?', ['bord', 'springa', 'glad'], 'bord',
                'Ett substantiv är namnet på en sak, ett djur eller en människa. Man kan säga ett bord.'),
            val('Vilket ord är ett verb?', ['hoppar', 'boll', 'stor'], 'hoppar',
                'Ett verb berättar vad någon gör: jag hoppar.'),
            val('Vilket ord säger vad Ali gör? ”Ali cyklar till skolan.”',
                ['cyklar', 'Ali', 'till', 'skolan'], 'cyklar',
                'Att cykla är det Ali gör. Ord som säger vad någon gör är verb.'),
            skriv('Skriv verbet i meningen: ”Hunden skäller.”', 'skäller',
                  'Skäller är det hunden gör. Därför är det ett verb.'),
            skriv('Skriv substantivet i meningen: ”Fågeln flyger.”', ['fågeln', 'fågel'],
                  'Fågeln är ett djur. Namn på djur, saker och människor är substantiv.'),
            val('Framför vilket ord kan man sätta ”en” eller ”ett”?',
                ['penna', 'skriver', 'ritar'], 'penna',
                'Man säger en penna. Ord som kan ha en eller ett framför sig är substantiv.'),
            skriv('Hur många substantiv finns det i meningen? ”Pojken har en hund och en katt.”',
                  [tal(3), 'tre'],
                  'Pojken, hund och katt är substantiv. Har är ett verb.'),
            ordna('Bygg meningen.', ['Flickan', 'läser', 'en', 'bok.'],
                  forklaring='Flickan har stor bokstav och står först. Sedan kommer verbet läser, '
                             'och bok har punkt och står sist.'),
        ], beskrivning='Tränar att känna igen substantiv och verb i korta meningar.'),
    ]),

    bana('Svenska', 'ak6', [
        niva('sv-ak6-ordklasser-1', 'Fyra ordklasser', 'Ordklasser', [
            val('Vilken ordklass är ordet ”snabb”?',
                ['adjektiv', 'verb', 'substantiv', 'pronomen'], 'adjektiv',
                'Snabb beskriver hur något är, som i en snabb häst. Ord som beskriver är adjektiv.'),
            val('Vilken ordklass är ordet ”hon”?',
                ['pronomen', 'substantiv', 'adjektiv', 'verb'], 'pronomen',
                'Hon står i stället för ett namn, till exempel Sara. Sådana ord är pronomen.'),
            val('Vilket ord i meningen är ett adjektiv? ”Den gamla hunden sov länge.”',
                ['gamla', 'hunden', 'sov', 'länge'], 'gamla',
                'Gamla beskriver hur hunden är, och det gör adjektiv. '
                'Länge säger något om sovandet, inte om hunden.'),
            val('Vilket ord är ett verb?', ['simmar', 'simhall', 'simkunnig'], 'simmar',
                'Simmar säger vad någon gör: hon simmar. Simhall är ett substantiv och simkunnig ett adjektiv.'),
            skriv('Skriv pronomenet i meningen: ”Efter maten diskade vi.”', 'vi',
                  'Vi står i stället för namnen på dem som diskade. Därför är vi ett pronomen.'),
            skriv('Skriv adjektivet i meningen: ”Sara köpte en blå jacka.”', 'blå',
                  'Blå beskriver hur jackan ser ut. Ord som beskriver är adjektiv.'),
            skriv('Hur många substantiv finns det i meningen? ”Morfar lagade cykeln i garaget.”',
                  [tal(3), 'tre'],
                  'Morfar, cykeln och garaget är substantiv. Lagade är ett verb och i är en preposition.'),
            ordna('Ställ orden i den här ordningen: substantiv, verb, adjektiv, pronomen.',
                  ['bok', 'läser', 'tjock', 'hon'],
                  forklaring='Bok är en sak, läser är något man gör, tjock beskriver '
                             'och hon står i stället för ett namn.'),
        ], beskrivning='Tränar att känna igen substantiv, verb, adjektiv och pronomen.'),

        niva('sv-ak6-stavning-1', 'Dubbelteckning och ck', 'Stavning', [
            val('Vilket ord passar och är rätt stavat? ”Pengarna ligger i min …”',
                ['ficka', 'fikka', 'fika'], 'ficka',
                'I ficka är i kort, och ett k-ljud efter en kort vokal skrivs ck. Fika är ett annat ord.'),
            val('När stavas k-ljudet med ck?',
                ['Efter en kort vokal', 'Efter en lång vokal', 'I början av ett ord'],
                'Efter en kort vokal',
                'Efter en kort vokal skrivs k-ljudet ck, som i klocka och sticka. '
                'Efter en lång vokal räcker ett k, som i kaka.'),
            val('I vilket ord är vokalen kort?', ['tack', 'tak', 'mat', 'fin'], 'tack',
                'Två konsonanter efter vokalen, som ck i tack, visar att vokalen är kort. '
                'I tak, mat och fin är vokalen lång.'),
            val('Vilket ord är felstavat?', ['hoppa', 'glass', 'pena', 'socker'], 'pena',
                'E är kort i penna, så n ska dubbleras. Rätt stavning är penna.'),
            skriv('Ordet är felstavat: ”vaten”. Skriv det rätt.', 'vatten',
                  'A är kort i vatten. Efter en kort vokal dubbleras konsonanten, så det blir tt.'),
            # Utan meningen går ”soker” lika gärna att rätta till söker.
            skriv('Ett ord är felstavat: ”Mormor bakar med mjöl och soker.” Skriv ordet rätt.', 'socker',
                  'O är kort i socker. Ett k-ljud efter en kort vokal skrivs ck.'),
            skriv('Ordet är felstavat: ”titar”. Skriv det rätt.', 'tittar',
                  'I är kort i tittar, så t ska dubbleras.'),
            ordna('Bygg meningen. En bricka är felstavad och hör inte dit.',
                  ['Pappa', 'dricker', 'vatten', 'och', 'kaffe.'], extra=['vaten'],
                  forklaring='Vatten stavas med tt eftersom a är kort. '
                             'I dricker skrivs k-ljudet ck av samma skäl.'),
        ], beskrivning='Tränar när konsonanten dubbleras och när k-ljudet stavas ck.'),

        niva('sv-ak6-ordforrad-1', 'Synonymer och motsatsord', 'Ordförråd', [
            val('Vad är en synonym?',
                ['Ett ord som betyder nästan samma sak som ett annat',
                 'Ett ord som betyder motsatsen till ett annat',
                 'Ett ord som rimmar på ett annat'],
                'Ett ord som betyder nästan samma sak som ett annat',
                'Synonymer betyder nästan samma sak, som prata och tala. '
                'Ord med motsatt betydelse kallas motsatsord.'),
            val('Vilket ord är en synonym till ”tala”?', ['prata', 'tiga', 'lyssna', 'skriva'], 'prata',
                'Tala och prata betyder nästan samma sak. Tiga är tvärtom, ett motsatsord.'),
            val('Vilket ord betyder nästan samma sak som ”börja”?', ['starta', 'sluta', 'vänta'], 'starta',
                'Man kan säga att filmen börjar eller att filmen startar. Sluta är motsatsen.'),
            val('Vilket ord är ett motsatsord till ”tidig”?', ['sen', 'snabb', 'morgon'], 'sen',
                'Den som inte kommer tidigt kommer sent. Tidig och sen är motsatser.'),
            skriv('Skriv motsatsordet till ”tung”.', 'lätt',
                  'Det som inte är tungt är lätt att bära. Tung och lätt är motsatser.'),
            skriv('Skriv motsatsordet till ”vinna”.', 'förlora',
                  'I en match vinner det ena laget och det andra förlorar.'),
            skriv('Skriv motsatsordet till ”stark”, som i ”Hon är stark.”', ['svag', 'klen'],
                  'Den som inte är stark är svag. Stark och svag är motsatser.'),
            ordna('Ordna orden från minst till störst.', ['pytteliten', 'liten', 'stor', 'enorm'],
                  forklaring='Pytteliten är mindre än liten, och enorm är större än stor.'),
        ], beskrivning='Tränar ord som betyder nästan samma sak och ord som betyder motsatsen.'),

        # Ett uttryck som kan betyda två saker frågas inte. En skriv-fråga
        # frågar bara efter ett ord som uttrycket inte har i någon annan form:
        # prata bredvid mun heter också bredvid munnen, men ingen fara på
        # taket heter bara så.
        niva('sv-ak6-ordforrad-2', 'Uttryck och talesätt', 'Ordförråd', [
            para('Para ihop uttrycket med vad det betyder.',
                 [('ana ugglor i mossen', 'misstänka att något är fel'),
                  ('ha tummen mitt i handen', 'vara klumpig med händerna'),
                  ('lägga näsan i blöt', 'lägga sig i andras saker'),
                  ('gå som katten kring het gröt', 'prata runt det viktiga i stället för att säga det')],
                 'Uttrycken betyder något annat än orden var för sig. Den som anar ugglor i mossen '
                 'har inte sett några ugglor, utan misstänker att något inte stämmer.'),
            val('Vilket uttryck betyder att någon råkar avslöja en hemlighet?',
                ['prata bredvid mun', 'hålla tummarna', 'sätta sig på tvären', 'ha is i magen'],
                'prata bredvid mun',
                'Den som pratar bredvid mun säger något som skulle ha varit hemligt, utan att mena det.'),
            sant('Den som har is i magen blir lätt nervös.', False,
                 'Att ha is i magen betyder att vara lugn och inte stressa, till exempel före en straffspark.'),
            sant('Den som håller tummarna för en kompis hoppas att det ska gå bra för kompisen.', True,
                 'Att hålla tummarna betyder att önska någon lycka, till exempel inför ett prov.'),
            skriv('Skriv ordet som fattas i uttrycket ”Det är ingen fara på …”. '
                  'Uttrycket betyder att det inte finns något att oroa sig för.', 'taket',
                  'Det är ingen fara på taket betyder att allt är lugnt. Det handlar inte om något riktigt tak.'),
            val('Vad betyder det att ”köpa grisen i säcken”?',
                ['Att köpa något utan att veta hur det är', 'Att köpa något som är för dyrt',
                 'Att köpa mat till ett husdjur', 'Att köpa något man inte behöver'],
                'Att köpa något utan att veta hur det är',
                'Att köpa grisen i säcken är att köpa något man inte har sett. Då vet man inte om det är bra.'),
            val('”Hon lovade guld och gröna skogar.” Vad betyder det?',
                ['Hon lovade mycket mer än hon kunde hålla', 'Hon lovade att plantera träd',
                 'Hon lovade att ge bort smycken', 'Hon lovade att hålla tyst'],
                'Hon lovade mycket mer än hon kunde hålla',
                'Att lova guld och gröna skogar är att lova väldigt mycket, mer än det går att hålla.'),
            ordna('Bygg meningen. Den betyder att Nils klarade två saker på en gång.',
                  ['Nils', 'slog', 'två', 'flugor', 'i', 'en', 'smäll.'],
                  forklaring='Att slå två flugor i en smäll är att klara två saker med en och samma '
                             'handling. Nils har inte slagit några flugor på riktigt.'),
        ], beskrivning='Tränar vanliga uttryck och talesätt, som betyder något annat än orden var för sig.'),

        niva('sv-ak6-meningsbyggnad-1', 'Bygg meningar', 'Meningsbyggnad', [
            ordna('Bygg meningen.', ['Efter', 'skolan', 'spelar', 'vi', 'fotboll.'],
                  forklaring='Efter skolan är meningens första del. Då kommer verbet spelar direkt efter, '
                             'och sedan vi.'),
            ordna('Bygg frågan.', ['Har', 'du', 'ätit', 'frukost?'],
                  forklaring='I en fråga som man svarar ja eller nej på står verbet först: Har du …?'),
            ordna('Bygg en fråga som börjar med frågeordet var.', ['Var', 'bor', 'din', 'kusin?'],
                  forklaring='Efter frågeordet kommer verbet bor, och sedan den man frågar om: din kusin.'),
            ordna('Bygg meningen. Den har en bisats som säger när.',
                  ['Vi', 'går', 'hem', 'när', 'filmen', 'är', 'slut.'],
                  forklaring='Vi går hem är huvudsatsen. När filmen är slut är en bisats som säger när vi går.'),
            val('Vilken mening har rätt ordföljd?',
                ['Nu ska vi baka.', 'Nu vi ska baka.', 'Nu ska baka vi.'], 'Nu ska vi baka.',
                'Verbet ska står på andra plats, direkt efter nu. Sedan kommer vi och sist baka.'),
            val('Vilken mening är rätt?',
                ['Det är en film som jag inte har sett.',
                 'Det är en film som jag har inte sett.',
                 'Det är en film som jag har sett inte.'],
                'Det är en film som jag inte har sett.',
                'Som jag inte har sett är en bisats. I en bisats står inte före verbet.'),
            skriv('Gör en mening av orden ”vi”, ”Sedan” och ”äter”. Vilket ord hamnar i mitten?', 'äter',
                  'Sedan äter vi. När meningen börjar med sedan kommer verbet på andra plats.'),
            skriv('Vilket ord inleder bisatsen? ”Jag stannar inne eftersom det regnar.”', 'eftersom',
                  'Eftersom det regnar är en bisats. Den kan inte stå ensam som en hel mening.'),
        ], beskrivning='Tränar ordföljd i påståenden, frågor och meningar med bisats.'),

        niva('sv-ak6-lasforstaelse-1', 'Allemansrätten', 'Läsförståelse', [
            val('Vad är textens syfte?',
                ['Att informera om vad man får och inte får göra i naturen',
                 'Att berätta en spännande historia om en skog',
                 'Att övertyga läsaren om att sluta tälta',
                 'Att sälja tält och sovsäckar'],
                'Att informera om vad man får och inte får göra i naturen',
                'Texten förklarar regler och fakta, och det gör en text som vill informera. '
                'Den handlar inte om någon särskild person och försöker inte sälja något.'),
            sant('Allemansrätten gäller bara i skogar som ingen äger.', False,
                 'Redan i första meningen står det att man får röra sig fritt också i skogar och '
                 'på ängar som någon annan äger.'),
            sant('Enligt texten får man tälta en natt eller två på samma ställe.', True,
                 'Det står i andra stycket: du får tälta en natt eller två på samma ställe.'),
            val('Vad betyder ordet ”tomt” i texten?',
                ['Området närmast ett hus där någon bor', 'Att något saknar innehåll',
                 'En plats där man får tälta', 'En stor äng'],
                'Området närmast ett hus där någon bor',
                'Tomt kan också betyda att något saknar innehåll, som ett tomt glas. Men här '
                'förklarar texten själv vad ordet betyder: området närmast ett hus där någon bor.'),
            skriv('Vad kallas växter som skyddas av lagen? Skriv ordet ur texten.',
                  ['fridlysta', 'fridlyst', 'fridlysta växter'],
                  'Fridlysta växter skyddas av lagen, och många av dem får man inte plocka.'),
            skriv('Vad kallas det när man inte får göra upp eld i naturen? Skriv ordet ur texten.',
                  ['eldningsförbud', 'eldningsförbudet', 'ett eldningsförbud'],
                  'Det kan bli eldningsförbud när det är mycket torrt, för då sprider sig en brand lätt.'),
            val('Pia vill plocka blåbär i en skog som en bonde äger. Vad säger texten om det?',
                ['Det får hon, för allemansrätten gäller också där',
                 'Det får hon inte, för skogen är bondens',
                 'Det får hon bara om hon frågar bonden först',
                 'Det får hon bara om hon tältar där'],
                'Det får hon, för allemansrätten gäller också där',
                'Allemansrätten gäller också på mark som någon annan äger, och bär får man plocka.'),
            val('Vad menar texten med att allemansrätten är ”ingen rätt att göra vad man vill”?',
                ['Den som är i naturen måste också ta hänsyn',
                 'Man får inte vara i naturen utan lov',
                 'Allemansrätten gäller bara vuxna',
                 'Man måste betala för att få gå i skogen'],
                'Den som är i naturen måste också ta hänsyn',
                'Direkt efter står det att man ska ta med sig skräpet hem och inte störa djur och '
                'människor. Friheten kommer med ett ansvar.'),
        ], beskrivning='En saklig text om allemansrätten, med frågor om vad som står, vad ett ord betyder '
                       'och vad texten vill.',
            text=ALLEMANSRATTEN),
    ]),

    bana('Svenska', 'ak8', [
        niva('sv-ak8-stavning-1', 'Sär- och sammanskrivning', 'Stavning', [
            val('Hur skrivs ordet rätt? ”Vi ska se en … på lördag.”',
                ['fotbollsmatch', 'fotbolls match', 'fotboll match'], 'fotbollsmatch',
                'Fotbollsmatch är ett sammansatt ord: fotboll + s + match. Sammansatta ord skrivs ihop.'),
            val('Vilket ord betyder en lärare som undervisar i engelska?',
                ['engelsklärare', 'engelsk lärare', 'engelska lärare'], 'engelsklärare',
                'Engelsklärare är ett sammansatt ord och skrivs ihop. '
                'En engelsk lärare är en lärare som kommer från England.'),
            val('Det är förbjudet att röka här. Vilken skylt är rätt?',
                ['Rökfritt', 'Rök fritt', 'Rök-fritt'], 'Rökfritt',
                'Rökfritt betyder att ingen får röka. Rök fritt, i två ord, betyder tvärtom '
                'att man får röka hur mycket man vill.'),
            val('Vilket är rätt skrivet?', ['till exempel', 'tillexempel', 'till-exempel'], 'till exempel',
                'Till exempel är inget sammansatt ord utan två ord som hör ihop. De skrivs isär.'),
            skriv('Skriv det särskrivna ordet rätt: ”Vi åt lamm kotletter.”', 'lammkotletter',
                  'Kotletter av lamm heter lammkotletter. Ett sammansatt ord skrivs ihop.'),
            skriv('Skriv det särskrivna ordet rätt: ”Hon är en duktig fotbolls spelare.”', 'fotbollsspelare',
                  'Fotboll + s + spelare blir fotbollsspelare i ett ord. Därför står två s i rad.'),
            skriv('Skriv det särskrivna ordet rätt: ”Stek pannan är varm.”', 'stekpannan',
                  'Stek pannan låter som en uppmaning att steka pannan. Pannan man steker i heter stekpannan.'),
            ordna('Bygg meningen. Två brickor hör inte dit.',
                  ['Min', 'storebror', 'är', 'fotbollstränare.'], extra=['fotbolls', 'tränare.'],
                  forklaring='Fotbollstränare är ett sammansatt ord och skrivs ihop, precis som storebror.'),
        ], beskrivning='Tränar att skriva sammansatta ord ihop och att se hur betydelsen ändras när de särskrivs.'),

        niva('sv-ak8-pronomen-1', 'De eller dem', 'Pronomen', [
            val('Hur kan man testa om det ska vara de eller dem?',
                ['Byt ut ordet mot vi eller oss',
                 'Se om ordet står först i meningen',
                 'Se om det handlar om flera personer'],
                'Byt ut ordet mot vi eller oss',
                'De fungerar som vi och dem som oss. Passar vi ska det vara de, passar oss ska det vara dem.'),
            skriv('De eller dem? ”Mamma träffade … på bussen.”', 'dem',
                  'Man säger ”mamma träffade oss”, inte ”mamma träffade vi”. Oss motsvarar dem.'),
            skriv('De eller dem? ”… bor i huset bredvid.”', 'de',
                  'Man säger ”vi bor i huset bredvid”, inte ”oss bor”. Där vi passar ska det vara de.'),
            skriv('De eller dem? ”Mina kusiner ringde och sa att … var sena.”', 'de',
                  'Man säger ”sa att vi var sena”, inte ”sa att oss var sena”. Därför de.'),
            val('I vilken mening är de eller dem rätt använt?',
                ['Läraren berömde dem.', 'Dem som vill får följa med.', 'Jag gav de en present.'],
                'Läraren berömde dem.',
                'Läraren berömde oss, alltså dem. I de andra meningarna ska det vara ”De som vill” '
                'och ”Jag gav dem”.'),
            val('Vilket ord ska stå i luckan? ”Har du sett … nya eleverna?”', ['de', 'dem', 'den'], 'de',
                'Här är de en artikel, som i de stora husen. Framför ett adjektiv och ett substantiv '
                'i bestämd form plural står alltid de.'),
            val('Varför ska det stå dem i ”Vi väntade på dem.”?',
                ['Man kan byta mot oss: väntade på oss',
                 'Ordet står sist i meningen',
                 'Det handlar om flera personer'],
                'Man kan byta mot oss: väntade på oss',
                'Oss passar, och oss motsvarar dem. Var ordet står i meningen avgör ingenting.'),
            ordna('Bygg meningen. En bricka hör inte dit.',
                  ['De', 'som', 'är', 'klara', 'får', 'gå', 'hem.'], extra=['Dem'],
                  forklaring='Man kan säga ”vi som är klara får gå hem”. Vi passar, alltså de.'),
        ], beskrivning='Tränar att välja mellan de och dem med hjälp av vi och oss.'),

        niva('sv-ak8-satsdelar-1', 'Subjekt och predikat', 'Satsdelar', [
            val('Vilket ord är predikat i meningen ”Hunden jagar katten.”?',
                ['jagar', 'Hunden', 'katten'], 'jagar',
                'Predikatet är verbet som säger vad som händer. Här är det jagar.'),
            val('Vilket ord är subjekt i meningen ”På lördag spelar Omar match.”?',
                ['Omar', 'spelar', 'lördag', 'match'], 'Omar',
                'Fråga ”vem spelar?”. Svaret är Omar. Subjektet står inte alltid först i meningen.'),
            val('Hur hittar man subjektet i en sats?',
                ['Hitta predikatet och fråga vem eller vad som gör det',
                 'Ta ordet som står först i meningen',
                 'Ta det sista substantivet i meningen'],
                'Hitta predikatet och fråga vem eller vad som gör det',
                'Först predikatet, till exempel spelar. Sedan frågan ”vem spelar?”. '
                'Svaret på frågan är subjektet.'),
            val('Vad av detta saknar predikat?',
                ['En kall morgon i januari.', 'Det snöade hela natten.', 'Vi frös.'],
                'En kall morgon i januari.',
                'En kall morgon i januari har inget verb. Utan predikat blir det ingen sats.'),
            skriv('Skriv predikatet i meningen: ”Barnen byggde en koja i skogen.”', 'byggde',
                  'Byggde är verbet som säger vad barnen gjorde. Det är predikatet.'),
            skriv('Skriv subjektet i frågan: ”Varför skrattar Elsa?”', 'Elsa',
                  'Fråga ”vem skrattar?”. Svaret är Elsa. I frågor står subjektet ofta efter predikatet.'),
            skriv('Hur många predikat finns det i meningen? ”Vi åt middag och sedan diskade vi.”',
                  [tal(2), 'två'],
                  'Meningen har två satser, och varje sats har ett eget predikat: åt och diskade.'),
            ordna('Bygg frågan.', ['Spelar', 'din', 'syster', 'fotboll?'],
                  forklaring='I en ja- eller nej-fråga står predikatet spelar först, '
                             'och subjektet din syster kommer direkt efter.'),
        ], beskrivning='Tränar att hitta subjekt och predikat, också när subjektet inte står först.'),

        # Bara subjekt, predikat, objekt och adverbial. Predikatsfyllnaden
        # heter också subjektsfyllnad eller predikativ, så meningarna här har
        # ingen, och inte heller något indirekt objekt. Predikatet är ett
        # enda verb: när det står två (har ätit) räknar läromedlen olika.
        niva('sv-ak8-satsdelar-2', 'Objekt och adverbial', 'Satsdelar', [
            para('Para ihop satsdelen med frågan man ställer för att hitta den.',
                 [('predikat', 'Vad händer, eller vad gör någon?'),
                  ('subjekt', 'Vem eller vad + predikatet?'),
                  ('objekt', 'Vem eller vad + predikatet + subjektet?'),
                  ('adverbial', 'När, var, hur eller varför?')],
                 'Ta meningen ”Sam åt en macka på bussen.” Åt är predikatet. Vem åt? Sam, subjektet. '
                 'Vad åt Sam? En macka, objektet. Var? På bussen, ett adverbial.'),
            para('Para ihop delarna av meningen ”I går köpte Nora en ny cykel.” med rätt satsdel.',
                 [('I går', 'adverbial'), ('köpte', 'predikat'), ('Nora', 'subjekt'),
                  ('en ny cykel', 'objekt')],
                 'Köpte är verbet, alltså predikatet. Vem köpte? Nora, subjektet. Vad köpte Nora? '
                 'En ny cykel, objektet. I går säger när, och det gör ett adverbial.'),
            val('Vilket ord är objekt i meningen ”Efter matchen tackade tränaren spelarna.”?',
                ['spelarna', 'tränaren', 'tackade', 'matchen'], 'spelarna',
                'Tackade är predikatet. Vem tackade? Tränaren, som alltså är subjekt. '
                'Vilka blev tackade? Spelarna, och det är objektet.'),
            sant('I meningen ”Hunden bet brevbäraren.” är brevbäraren subjekt.', False,
                 'Vem bet? Hunden, och det är subjektet. Vem blev biten? Brevbäraren, som alltså är objekt.'),
            sant('I meningen ”Vi badade efter skolan.” är ”efter skolan” ett adverbial.', True,
                 'Efter skolan säger när vi badade, och det gör ett adverbial. '
                 'Ett adverbial kan bestå av flera ord.'),
            skriv('Skriv objektet i meningen: ”I helgen målade pappa staketet.”', 'staketet',
                  'Målade är predikatet och pappa subjektet. Vad målade pappa? Staketet, som alltså är '
                  'objektet. I helgen är ett adverbial.'),
            val('Vilken satsdel är ”varje morgon” i meningen ”Varje morgon cyklar Leila till skolan.”?',
                ['adverbial', 'subjekt', 'objekt', 'predikat'], 'adverbial',
                'Varje morgon säger när Leila cyklar, och det gör ett adverbial. Det står först, '
                'men subjektet är Leila: vem cyklar?'),
            ordna('Bygg meningen så att adverbialet står först.',
                  ['Efter', 'lunchen', 'har', 'vi', 'engelska.'],
                  forklaring='Efter lunchen är ett adverbial som säger när. När det står först kommer '
                             'predikatet har direkt efter, och subjektet vi efter predikatet.'),
        ], beskrivning='Tränar att hitta objekt och adverbial, och att para ihop delarna i en mening med '
                       'rätt satsdel.'),

        niva('sv-ak8-skiljetecken-1', 'Komma, kolon och repliker', 'Skiljetecken', [
            val('I vilken mening står kolonet rätt?',
                ['Vi behöver tre saker till kalaset: ballonger, tårta och saft.',
                 'Vi behöver tre saker: till kalaset ballonger, tårta och saft.',
                 'Vi behöver: tre saker till kalaset ballonger, tårta och saft.'],
                'Vi behöver tre saker till kalaset: ballonger, tårta och saft.',
                'Kolon står före uppräkningen, direkt efter orden som säger att något ska räknas upp.'),
            val('Vilken mening har rätt skiljetecken?',
                ['Vi köpte äpplen, päron och bananer.',
                 'Vi köpte äpplen päron och bananer.',
                 'Vi köpte, äpplen päron och bananer.'],
                'Vi köpte äpplen, päron och bananer.',
                'I en uppräkning står komma mellan orden. Före och behövs normalt inget komma.'),
            val('Vilken replik är rätt skriven?',
                ['– Jag är hungrig, sa Elin.', '– Jag är hungrig. Sa Elin.', '– Jag är hungrig sa Elin.'],
                '– Jag är hungrig, sa Elin.',
                'Efter repliken står komma, och sa skrivs med liten bokstav eftersom meningen fortsätter.'),
            val('Repliken är en fråga. Hur ska den skrivas?',
                ['– Vill du ha glass? frågade Tim.',
                 '– Vill du ha glass?, frågade Tim.',
                 '– Vill du ha glass, frågade Tim?'],
                '– Vill du ha glass? frågade Tim.',
                'Frågetecknet står direkt efter frågan. Då behövs inget komma, '
                'och frågade skrivs med liten bokstav.'),
            skriv('Vad heter tecknet efter ”saker” i meningen ”Ta med tre saker: matsäck, vatten och regnjacka.”?',
                  'kolon',
                  'Tecknet med två prickar är kolon. Det står ofta före en uppräkning eller en förklaring.'),
            skriv('Hur många kommatecken behövs i meningen? ”Vi såg älgar rådjur harar och en räv.”',
                  [tal(2), 'två'],
                  'Det blir ”älgar, rådjur, harar och en räv”. Komma står mellan orden i uppräkningen '
                  'men normalt inte före och.'),
            skriv('Vad heter tecknen som står runt ett citat, som runt ”Hej”?',
                  ['citattecken', 'citationstecken', 'anföringstecken', 'citattecknen',
                   'citationstecknen', 'anföringstecknen', 'gåsögon'],
                  'Citattecken, som också kallas anföringstecken och i vardagligt tal gåsögon, visar '
                  'var det någon sagt eller skrivit börjar och slutar.'),
            ordna('Bygg repliken.', ['–', 'Var', 'är', 'mina', 'skor?', 'frågade', 'Ali.'],
                  forklaring='Talstrecket står först. Frågetecknet avslutar frågan, och sedan kommer '
                             'frågade Ali med punkt sist.'),
        ], beskrivning='Tränar komma i uppräkningar, kolon och hur repliker skrivs med talstreck.'),

        niva('sv-ak8-lasforstaelse-1', 'Tomaterna på balkongen', 'Läsförståelse', [
            skriv('Vart reste fru Lind? Skriv namnet på staden.', ['Luleå', 'till Luleå'],
                  'Det står i början av texten: hon reste till sin syster i Luleå.'),
            sant('Tomatplantorna skulle vattnas varannan dag.', False,
                 'På lappen stod det att tomatplantorna behövde vatten varje kväll. Det var blommorna '
                 'i fönstren som skulle vattnas varannan dag.'),
            sant('Amir glömde att vattna för att han hade tappat bort nyckeln.', False,
                 'Nyckeln låg hela tiden i fruktskålen i hallen. Amir glömde för att han kom hem så '
                 'trött från fotbollslägret.'),
            val('Vad betyder ”slokande” i texten?',
                ['Hängande och utan kraft', 'Täckta av röda tomater', 'Nyss planterade', 'Våta av regn'],
                'Hängande och utan kraft',
                'Plantorna hade inte fått vatten på flera dagar och orkade inte stå upp. '
                'Något som slokar hänger ner, som en blomma som behöver vatten.'),
            skriv('Vad hade Amir sparat pengarna till? Svara med ett ord ur texten.',
                  ['mobil', 'en mobil', 'ny mobil', 'en ny mobil', 'mobilen', 'mobiltelefon',
                   'en mobiltelefon', 'telefon', 'en telefon', 'en ny telefon',
                   'till en mobil', 'till en ny mobil'],
                  'Han köpte den nya plantan för pengar som han hade sparat till en mobil.'),
            val('Varför ställde Amir den nya plantan längst in, bakom de andra?',
                ['Han hoppades att fru Lind inte skulle märka att den var ny',
                 'Fru Lind hade bett om det på lappen',
                 'Den var störst och skymde de andra',
                 'Han ville att fru Lind skulle se den först'],
                'Han hoppades att fru Lind inte skulle märka att den var ny',
                'Texten säger det inte rakt ut. Men den nya plantan var mindre och hade inga tomater, '
                'och längst in, bakom de andra, syntes den minst. Lappen handlade bara om vattnet.'),
            val('Vad förstår man om fru Lind i slutet av texten?',
                ['Hon har märkt att en planta är ny, men hon är inte arg',
                 'Hon märker inte att något är annorlunda på balkongen',
                 'Hon är arg och vill inte ha hjälp igen',
                 'Hon vill inte betala Amir'],
                'Hon har märkt att en planta är ny, men hon är inte arg',
                'Hon pekar ut den lilla plantan längst in och säger att hon inte minns att hon köpt den, '
                'så hon har sett att den inte är en av hennes. Hon föreslår en lista, för man glömmer '
                'lätt: hon förstår vad som hänt. Ändå ler hon, betalar och vill ha hjälp nästa sommar.'),
            val('Vad är textens syfte?',
                ['Att berätta en historia', 'Att lära ut hur man odlar tomater',
                 'Att övertyga läsaren om att fotbollsläger är bra',
                 'Att informera om hur man reser till Luleå'],
                'Att berätta en historia',
                'Texten har personer, en handling och känslor, och det har en berättelse. '
                'Den ger inga råd och försöker inte övertyga någon.'),
        ], beskrivning='En berättelse om ett löfte som glöms bort, med frågor om vad som står, vad ett ord '
                       'betyder och vad man kan förstå mellan raderna.',
            text=TOMATERNA),
    ]),
]
