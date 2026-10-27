# -*- coding: utf-8 -*-
"""Faktabladen till de nya områdena i svenska åk 6 och åk 7 (2026-10-27),
ett per område i verktyg/uppgiftsbanken/fortsattning_svenska_ak6_7.py.

Skrivna efter vad nivåerna övar. Exemplen är inga frågor ur banken, och
inget blad lämnar ut ett facit före svaret. Skrivet med AI och inte läst av
någon som undervisar i ämnet.
"""
from fakta import blad

SV = 'Svenska'

FAKTABLAD = [
    # ================================================================
    # ÅRSKURS 6
    # ================================================================
    blad(SV, 'ak6', 'Böjning av ord',
         mal=['Böja substantiv i singular och plural, i obestämd och bestämd form.',
              'Avgöra om ett substantiv är ett en-ord eller ett ett-ord.',
              'Jämföra adjektiv i positiv, komparativ och superlativ.',
              'Välja rätt form av adjektivet till substantivet.'],
         fakta=['Ett substantiv har fyra former: obestämd singular (en båt), bestämd singular (båten), '
                'obestämd plural (båtar) och bestämd plural (båtarna).',
                'Sätt en eller ett framför ordet: en stol är ett en-ord och ett bord är ett ett-ord. Många '
                'ett-ord som slutar på konsonant har ingen ändelse i obestämd plural: ett hus, två hus.',
                'Adjektiv jämförs i tre steg: positiv (varm), komparativ (varmare) och superlativ '
                '(varmast). Några är oregelbundna och byter form eller vokal: tung, tyngre, tyngst.',
                'Adjektiv på -isk jämförs med mer och mest: praktisk, mer praktisk, mest praktisk.',
                'Adjektivet böjs efter substantivet: en röd båt, ett rött tak, röda båtar och den röda '
                'båten.'],
         exempel=[('Skriv ”en fågel” i alla fyra former.',
                   'En fågel, fågeln, fåglar, fåglarna. Obestämd och bestämd singular först, sedan '
                   'obestämd och bestämd plural.'),
                  ('Jämför adjektivet ”hög”.', 'Hög, högre, högst: positiv, komparativ och superlativ.')],
         ord=[('singular', 'en enda: en sko'),
              ('plural', 'fler än en: skor'),
              ('bestämd form', 'formen när vi vet vilken det gäller: skon'),
              ('komparativ', 'formen som jämför två: nyare'),
              ('superlativ', 'den högsta graden: nyast')],
         tips='Osäker på en eller ett? Säg ”den här” eller ”det här” framför ordet: den här stolen, det '
              'här bordet.'),

    blad(SV, 'ak6', 'Skiljetecken och stor bokstav',
         mal=['Avsluta en mening med punkt, frågetecken eller utropstecken.',
              'Känna igen en indirekt fråga, som slutar med punkt.',
              'Sätta kolon före en uppräkning eller en förklaring.',
              'Veta när ett ord skrivs med stor eller liten bokstav.'],
         fakta=['En direkt fråga slutar med frågetecken: Var bor du? En indirekt fråga berättar att någon '
                'frågade och slutar med punkt: Hon undrade var jag bor.',
                'Utropstecken visar ett utrop eller något som sägs med kraft: Aj! Vilken tur!',
                'Kolon står före en uppräkning eller en förklaring: Två saker behövs: tid och tålamod.',
                'Stor bokstav har första ordet i en mening och namn på personer, platser och länder.',
                'Liten bokstav har veckodagar, månader, högtider, språk och ord för folk från ett land, '
                'som tisdag, april, påsk, tyska och dansk.'],
         exempel=[('Ska meningen ”Jag undrar om du kan komma” sluta med frågetecken?',
                   'Nej. Meningen berättar om en fråga, så den är en indirekt fråga och slutar med punkt: '
                   'Jag undrar om du kan komma.'),
                  ('Vilka ord ska ha stor bokstav i ”på torsdag flyger vi till rom.”?',
                   'På, som börjar meningen, och Rom, som är namnet på en stad. Torsdag skrivs med liten '
                   'bokstav.')],
         ord=[('direkt fråga', 'en fråga som ställs rakt till någon: Kommer du?'),
              ('indirekt fråga', 'en mening som berättar om en fråga: Hon undrade om jag kommer.'),
              ('kolon', 'tecknet : före en uppräkning eller en förklaring'),
              ('utropstecken', 'tecknet ! efter ett utrop')],
         tips='Fråga dig om meningen själv frågar något eller bara berättar att någon frågade. Bara den '
              'som frågar själv får frågetecken.'),

    blad(SV, 'ak6', 'Språk i Norden',
         mal=['Berätta vilka språk som talas i Norden.',
              'Skilja de språk som är släkt med svenskan från dem som inte är det.',
              'Känna igen några skillnader mellan svenska, norska och danska.',
              'Förklara vad falska vänner är och varför de kan ställa till det.'],
         fakta=['Svenska, norska och danska är nära släkt och går ofta att förstå för varandra. Isländska '
                'och färöiska hör till samma familj, men är svårare för en svensk att förstå.',
                'Finska och samiska hör till en annan språkfamilj och är inte släkt med svenskan.',
                'Finland har två nationalspråk, finska och svenska. Norska har två skriftspråk, bokmål och '
                'nynorsk.',
                'Danska och norska skriver æ och ø där svenskan skriver ä och ö.',
                'Sveriges fem nationella minoritetsspråk är finska, meänkieli, samiska, romani chib och '
                'jiddisch.'],
         exempel=[('Vad tror du att det norska ordet ”kjøleskap” betyder?',
                   'Kylskåp. Kjøle liknar kyla, och skap liknar skåp. Många norska ord går att lista ut om du '
                   'jämför dem med svenska.')],
         ord=[('Norden', 'Sverige, Norge, Danmark, Finland och Island, och Färöarna, Grönland och Åland'),
              ('grannspråk', 'ett språk i ett grannland som liknar ens eget, som norska och danska för en '
                             'svensk'),
              ('falska vänner', 'ord som ser likadana ut i två språk men betyder olika saker'),
              ('nationellt minoritetsspråk', 'ett språk som en minoritet har talat länge i landet och som '
                                             'lagen skyddar')],
         tips='Danska är ofta lättare att läsa än att höra. Läs långsamt, så känner du igen många ord.'),

    # ================================================================
    # ÅRSKURS 7
    # ================================================================
    blad(SV, 'ak7', 'Satsdelar',
         mal=['Hitta predikatet, satsens verb.',
              'Hitta subjektet, också när det står efter predikatet.',
              'Hitta objektet och adverbial som säger när, var, hur och varför.',
              'Dela upp en hel mening i satsdelar.'],
         fakta=['Predikatet är verbet i satsen, det som händer eller görs. Börja alltid med att hitta det.',
                'Subjektet svarar på frågan vem eller vad + predikatet: Vem sjunger? Elin. Det kan stå efter '
                'predikatet: I kväll sjunger Elin.',
                'Objektet svarar på frågan vad eller vem + predikatet + subjektet: Vad köpte Elin? En cykel.',
                'Adverbial säger när, var, hur eller varför något händer: i går, i skolan, försiktigt, för '
                'att hinna.',
                'En sats har alltid ett predikat, men inte alltid ett objekt: Hon sover.'],
         exempel=[('Dela upp ”Efter lunchen spelade Ali gitarr i musiksalen.”',
                   'Predikat: spelade. Subjekt: Ali. Objekt: gitarr. Adverbial: efter lunchen, som säger när, '
                   'och i musiksalen, som säger var.')],
         ord=[('predikat', 'satsens verb'),
              ('subjekt', 'den eller det som gör något eller är något'),
              ('objekt', 'den eller det som något görs med'),
              ('adverbial', 'satsdel som säger när, var, hur eller varför')],
         tips='Hitta predikatet först. Sedan går det lätt att fråga dig fram till subjektet och objektet.'),

    blad(SV, 'ak7', 'Ordens nyanser',
         mal=['Välja det ord som säger exakt det du menar.',
              'Ordna synonymer efter hur starka de är.',
              'Känna igen värdeladdade ord, både positiva och negativa.',
              'Se hur ordvalet kan påverka vad läsaren tycker.'],
         fakta=['Synonymer betyder ungefär samma sak, men de kan vara olika starka: glad, lycklig, '
                'överlycklig.',
                'Ett precist ord ger en tydligare bild. ”Han rusade” säger mer än ”han gick”.',
                'Ett värdeladdat ord visar vad skribenten tycker: pratglad låter positivt och pratsjuk '
                'negativt.',
                'Neutrala ord passar i sakliga texter, som nyheter. Värdeladdade ord är vanliga i reklam och '
                'i texter som vill övertyga.',
                'En eufemism är ett mildare ord för något obehagligt, som mindre bemedlad i stället för '
                'fattig.'],
         exempel=[('Ordna från svagast till starkast: ösregna, dugga, regna.',
                   'Dugga, regna, ösregna. Dugga är lite regn och ösregna är väldigt mycket regn.')],
         ord=[('synonym', 'ett ord som betyder ungefär samma sak som ett annat'),
              ('nyans', 'en liten skillnad i betydelse eller känsla'),
              ('värdeladdat ord', 'ett ord som visar om något är bra eller dåligt'),
              ('neutralt ord', 'ett ord som inte tar ställning'),
              ('eufemism', 'ett mildare ord för något obehagligt eller känsligt')],
         tips='Byt ut ordet mot en synonym och läs meningen igen. Låter den snällare eller elakare? Då är '
              'orden olika laddade.'),

    blad(SV, 'ak7', 'Källkritik',
         mal=['Ta reda på vem som står bakom en text och varför den är skriven.',
              'Skilja på faktapåståenden och åsikter.',
              'Skilja på en förstahandskälla och ett rykte.',
              'Jämföra två källor och se var de säger emot varandra.'],
         fakta=['Fråga källan: Vem står bakom den? Varför är den skriven? När är den skriven? Hur vet '
                'avsändaren det hen påstår?',
                'Ett faktapåstående går att kontrollera, som ett datum eller ett pris. En åsikt säger vad '
                'någon tycker.',
                'En förstahandskälla har själv varit med eller tagit fram uppgiften. Den som bara återger '
                'vad någon annan sagt är en andrahandskälla.',
                'Står samma sak på flera ställen kan de ha kopierat varandra. Leta efter den som tog fram '
                'uppgiften.',
                'Var extra noga med inlägg som vill göra dig arg eller rädd och som ber dig dela dem.'],
         exempel=[('En webbplats som säljer cyklar skriver att deras cykel vann ett test. Vad bör du fråga dig?',
                   'Vem som gjorde testet och om det står i någon annan källa. Avsändaren vill sälja '
                   'cykeln, så den har ett eget intresse.')],
         ord=[('avsändare', 'den som står bakom en text'),
              ('syfte', 'varför texten är skriven: informera, övertyga, sälja eller underhålla'),
              ('förstahandskälla', 'någon som själv var med eller tog fram uppgiften'),
              ('andrahandskälla', 'någon som återger det en annan har sagt eller skrivit'),
              ('källkritik', 'att pröva hur mycket du kan lita på en källa')],
         tips='Ju mer en text vill få dig att känna något, desto viktigare är det att kontrollera den i en '
              'annan källa.'),
]
