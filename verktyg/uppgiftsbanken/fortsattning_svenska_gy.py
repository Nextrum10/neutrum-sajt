# -*- coding: utf-8 -*-
"""Fortsättningen i svenska för gymnasiet (2026-10-27): Svenska 1, 2 och 3.

Leo 2026-10-27: "Nexläx där ska vi lägga in flera uppgifter, i matte svenska
och engelska årkurs 6 och uppåt." Allt står i TILLAGG och läggs efter det
som redan står i banorna sv-gy1, sv-gy2 och sv-gy3, i tre nya områden per
bana med två nivåer var. Skrivet från grunden mot ämnesplanen i svenska
(Gy11). Lästexterna och alla exempel (Elin och odlingslådorna, stenen vid
bron med Ingrid och Sven, bibliotekarien Amira Lind) är påhittade för banken.
Inget är taget ur ett nationellt prov, en lärobok eller någon annan källa.
Skriven med AI och inte läst av en lärare.

- gy1: ”Nordiska grannspråk” (språken i Norden, bokmål och nynorska, falska
  vänner), ”Muntlig framställning” (planera ett tal, retorikens arbetsgång,
  och ett manus att läsa) och ”Meningsbyggnad” (att och och, böjning, tempus,
  dubbelsupinum, syftning, klarspråk).
- gy2: ”Antiken, medeltiden och renässansen” (epos, tragedi, Dante,
  humanismen, kända verk), ”Språkhistoria” (svenskans perioder, runorna,
  kasus, lågtyskan, bibeln, stavningsreformen, och ett reportage om en
  runsten) och ”Ordbildning och lånord”.
- gy3: ”Retorisk analys” (retorisk situation, kairos, talets syften,
  disposition, stilfigurer, och ett tal att analysera),
  ”Litteraturvetenskapliga begrepp” (berättartekniker och läsarter) och
  ”Satslära” (predikativ, agent, formellt subjekt, V2, fundament).

Förenklat, med flit:
- Norska är bokmål. De danska och norska orden är vanliga och har den
  betydelse som frågas i dagens standardspråk (rolig, frokost, rar, artig).
- Retorikens arbetsgång frågas med de fem stegen inventio till actio, som
  står i samma ordning i alla framställningar; intellectio nämns bara.
  Dispositionen frågas som par (del och vad den gör), aldrig som en ordning,
  för läromedlen ordnar refutatio olika.
- Svenskans perioder och lånordens vågor frågas utan årtal, utom
  stavningsreformen 1906. Verkens epoker frågas bara där ingen är oense
  (Homeros i antiken, Dante i medeltiden, Shakespeare i renässansen).
- Satsläran följer Svenska Akademiens grammatik i begreppen (fundament,
  satsadverbial, subjekts- och objektspredikativ, agent), och meningarna
  är valda så att ingen del kan analyseras på två sätt. Ordna-frågorna har
  inget satsadverbial, för ”kan inte jag” och ”kan jag inte” är båda svenska.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SV = 'Svenska'


# --- Lästexterna, ett stycke per element -----------------------------

MANUSET = '\n\n'.join([
    'Elins presentation',
    'Det här är Elins manus till en presentation som hon ska hålla för sin klass.',
    '”Räck upp handen om du har ätit sallad i matsalen den här veckan. Ganska många, ser jag. Visste ni att '
    'salladen ibland kommer från lådorna bakom matsalen?',
    'I dag ska jag berätta om skolans odling. Jag tar upp tre saker: hur den började, vad vi har lärt oss och '
    'vad som händer nu.',
    'För det första: hur började det? I våras fick vår klass fyra gamla trälådor av vaktmästaren. Vi fyllde '
    'dem med jord och sådde sallad, rädisor och ringblommor. Ringblommor är gula och orange blommor som lockar '
    'till sig bin och andra insekter.',
    'För det andra: vad har vi lärt oss? Mest att odling tar tid. Första veckan hände ingenting alls, och vi '
    'trodde att vi hade gjort fel. Sedan kom det små gröna blad överallt. Vi har också lärt oss att sniglar '
    'tycker lika mycket om sallad som vi gör.',
    'Till sist: vad händer nu? Rektorn har lovat oss fyra lådor till nästa vår. Vi behöver fler som vill hjälpa '
    'till, särskilt under sommarlovet, när någon måste vattna.',
    'Så nästa gång ni äter sallad i matsalen kan ni tänka på lådorna bakom matsalen. Och vill ni vara med och '
    'odla, kom och prata med mig efter lektionen.”',
])

FUTHARK = 16

RUNSTENEN = '\n\n'.join([
    'Stenen vid bron',
    'Vid den gamla bron över ån står en grå sten som de flesta i byn har gått förbi tusen gånger. Förra veckan '
    'stannade klass 2B där med sin lärare, som hade tagit med en karta och en tolkning av stenens text.',
    'Stenen är en runsten. Slingan som löper runt kanten är fylld av runor, och i mitten finns ett kors. Texten '
    'lyder i översättning: ”Ingrid lät resa denna sten efter Sven, sin man, och göra bron. Gud hjälpe hans '
    'ande.”',
    '– Det här är en minnessten, förklarade läraren. Den som lät rista den ville att alla som gick över bron '
    'skulle läsa namnen.',
    'Runstenar som den här restes främst under 1000-talet, i slutet av vikingatiden, när kristendomen kom '
    'till Sverige. Korset och bönen för Svens ande visar att familjen var kristen. Att bygga en bro räknades som en '
    'god gärning som kunde hjälpa den döde.',
    'Eleverna fick sedan försöka läsa några runor själva. Det var svårare än de hade trott. Runraden som '
    'användes under vikingatiden, den yngre futharken, hade bara %d tecken. Samma runa kunde därför stå för '
    'flera olika ljud, och läsaren fick gissa utifrån sammanhanget.' % FUTHARK,
    '– Stod det verkligen Sven? frågade en elev.',
    '– Det tror forskarna, svarade läraren. Men runorna kan läsas på mer än ett sätt, så det vi har är '
    'forskarnas tolkning.',
    'Från början var stenen målad. Färgen har regnat bort för länge sedan, men spår av rött har hittats på '
    'andra stenar i trakten. Kanske lyste slingan en gång så att den syntes på långt håll från vägen.',
])

TALET = '\n\n'.join([
    'Talet om biblioteket',
    'Amira Lind är bibliotekarie. Hon håller talet på ett öppet möte i kommunhuset, en vecka innan politikerna '
    'ska besluta om bibliotekets öppettider.',
    '”Klockan är sju en tisdagskväll. I ett varmt rum sitter en pojke och gör sina läxor, en pensionär läser '
    'dagens tidning och en kvinna söker sitt första jobb på en lånad dator. Det rummet är vårt bibliotek. Om '
    'tre månader kan det vara mörkt.',
    'Jag har arbetat som bibliotekarie i den här kommunen i femton år, och jag har sett vad kvällarna betyder. '
    'I förslaget som ni ska rösta om nästa vecka stänger biblioteket klockan fem varje dag. Jag står här i '
    'kväll för att be er säga nej till det förslaget.',
    'Varför är kvällarna så viktiga? För det är då de kommer som inte kan komma på dagen. De som arbetar. De '
    'som pluggar. De som inte har en lugn plats hemma. I fjol hade vi fler besökare efter klockan fem än före '
    'klockan tolv.',
    'Någon kommer att säga att kommunen måste spara, och det är sant. Men kvällarna kostar mindre än ni tror. '
    'Två bibliotekarier, en lampa och en dörr som står öppen. Det är vad som behövs.',
    'Vi kan välja att spara några kronor i dag. Eller så kan vi välja att satsa på våra invånare i morgon. '
    'Vill vi verkligen vara kommunen som släckte ljuset?',
    'Biblioteket är öppet för alla. Biblioteket är gratis för alla. Biblioteket är till för alla. Låt det '
    'fortsätta att vara så, också klockan sju en tisdagskväll.”',
])

for _t in (MANUSET, RUNSTENEN, TALET):
    assert 600 <= len(_t) <= 3000, len(_t)


TILLAGG = [
    # ================================================================
    # GYMNASIET 1 (Svenska 1)
    # ================================================================
    bana(SV, 'gy1', [
        niva('sv-gy1-grannsprak-1', 'Språken i Norden', 'Nordiska grannspråk', [
            val('Vilka tre språk brukar kallas de skandinaviska språken?',
                ['danska, norska och svenska', 'danska, finska och svenska', 'isländska, norska och finska'],
                'danska, norska och svenska',
                'Danska, norska och svenska ligger så nära varandra att talarna ofta förstår varandra. Finska '
                'talas också i Norden men hör till en helt annan språkfamilj, den uraliska.'),
            sant('Isländska hör till samma språkgrupp som svenska, de nordgermanska språken.', True,
                 'Isländska, färöiska, norska, danska och svenska är alla nordgermanska språk. Isländskan har '
                 'förändrats minst och är därför svår för en svensk att förstå.'),
            skriv('Norskan har två officiella skriftspråk: bokmål och ett som bygger på norska dialekter. Vad '
                  'heter det? Skriv ordet.',
                  ['nynorska', 'nynorsk', 'nynorskan'],
                  'Nynorskan skapades på 1800-talet ur norska dialekter. Bokmål är vanligast och växte fram ur den '
                  'danska skrift som användes i Norge.'),
            val('Varför liknar norskt bokmål skriven danska så mycket?',
                ['Norge var länge i union med Danmark och skrev danska',
                 'Bokmål skapades av svenska språkforskare för att likna danskan',
                 'Danskarna lärde sig skriva av norrmännen under vikingatiden'],
                'Norge var länge i union med Danmark och skrev danska',
                'Under unionen med Danmark skrev man danska i Norge. Bokmål växte fram ur den skriften och fick '
                'med tiden mer norska drag.'),
            val('Vilka bokstäver i danska och norska motsvarar svenskans ä och ö?',
                ['æ och ø', 'å och ø', 'ä och œ'], 'æ och ø',
                'Där svenskan skriver ä och ö skriver danskan och norskan æ och ø: öl heter øl, och äpple heter '
                'æble på danska. Bokstaven å finns i alla tre språken.'),
            para('Para ihop det norska ordet med det svenska.',
                 [('jente', 'flicka'), ('gutt', 'pojke'), ('ikke', 'inte'), ('hvordan', 'hur')],
                 'Många norska ord är lätta att känna igen, men några vanliga ord är helt andra än på svenska, som '
                 'jente och gutt.'),
            val('Varför är skriven danska ofta lättare för en svensk att förstå än talad danska?',
                ['Uttalet ligger längre från svenskan än stavningen gör',
                 'Talad danska har helt andra ord än den skrivna danskan',
                 'Skriven danska använder samma bokstäver som finska'],
                'Uttalet ligger längre från svenskan än stavningen gör',
                'I skrift känner du igen många ord. I tal försvagas och sväljs många ljud, och då blir samma ord '
                'svårare att höra.'),
            val('Hur brukar en svensk och en norrman göra när de pratar med varandra?',
                ['Båda talar sitt eget språk och anpassar sig lite',
                 'De måste alltid byta till engelska för att förstå',
                 'Norrmannen måste tala svenska och svensken lyssna'],
                'Båda talar sitt eget språk och anpassar sig lite',
                'Svenska och norska ligger så nära varandra att man kan tala sitt eget språk. Det hjälper att tala '
                'tydligt och byta ut ord som bara finns i det egna språket.'),
            val('Vad betyder den danska frågan ”Hvad hedder du?”',
                ['Vad heter du?', 'Var bor du någonstans?', 'Hur mår du?'], 'Vad heter du?',
                'Hvad är vad och hedder är heter. Danskan skriver hv där svenskan har v, som svenskan själv gjorde '
                'före 1906.'),
        ], beskrivning='Tränar vilka språk som talas i Norden och hur de hänger ihop, norskans två skriftspråk, '
                       'danska och norska bokstäver och vanliga ord.'),

        niva('sv-gy1-grannsprak-2', 'Ord som lurar', 'Nordiska grannspråk', [
            val('Vad betyder ordet ”rolig” på danska och norska?',
                ['lugn', 'lustig', 'ledsen'], 'lugn',
                'På danska och norska betyder rolig lugn. Det som är roligt på svenska kan heta morsomt på norska.'),
            val('Vad betyder det danska ordet ”frokost”?',
                ['lunch', 'frukost', 'kvällsmat'], 'lunch',
                'På danska är frokost lunch, och frukost heter morgenmad. På norska betyder frokost däremot '
                'frukost, så samma ord betyder olika saker i grannspråken.'),
            skriv('Vad kallas ett ord som liknar ett ord i ett annat språk men betyder något annat? Skriv två ord.',
                  ['falsk vän', 'falska vänner', 'en falsk vän'],
                  'En falsk vän ser bekant ut och lurar därför läsaren att gissa fel.'),
            val('Vad betyder den norska meningen ”Jeg gleder meg til ferien.”?',
                ['Jag ser fram emot lovet', 'Jag är glad att lovet är slut', 'Jag har glömt bort lovet'],
                'Jag ser fram emot lovet',
                'Glede seg til betyder att se fram emot något. Ferie betyder ledighet, som lov eller semester.'),
            val('Danskan räknar en del tiotal i tjugotal. Räkneordet ”tres” kommer av ”tre gånger tjugo”. Vilket '
                'tal är det?',
                [tal(3 * 20), '30', '23', '13'], tal(3 * 20),
                'Tre gånger tjugo är sextio. Också tiotalen från femtio till nittio bygger på tjugo i danskan.'),
            para('Para ihop det danska ordet med det svenska.',
                 [('pige', 'flicka'), ('dreng', 'pojke'), ('vindue', 'fönster'), ('hvorfor', 'varför')],
                 'Pige och dreng liknar svenskans piga och dräng men betyder flicka och pojke. Hvorfor går att känna '
                 'igen, och vindue liknar engelskans window.'),
            sant('Ett ord som stavas likadant på danska och svenska betyder alltid samma sak i båda språken.', False,
                 'Semester betyder till exempel en termin på högskolan på danska och norska, inte ledighet. Därför '
                 'måste man se upp med ord som ser bekanta ut.'),
            ordna('Bygg den norska meningen för ”Jag kan inte komma i dag”. En bricka ska inte vara med.',
                  ['Jeg', 'kan', 'ikke', 'komme', 'i', 'dag.'], extra=['inte'],
                  forklaring='Jag heter jeg och inte heter ikke på norska. Ordföljden är densamma som på svenska.'),
            val('En norsk vän säger: ”Det var en rar film.” Vad menar hen?',
                ['Filmen var konstig', 'Filmen var söt och gullig', 'Filmen var lång'], 'Filmen var konstig',
                'På norska betyder rar konstig eller underlig. På svenska betyder rar söt eller snäll.'),
            val('Vad betyder ”artig” i den norska meningen ”Det var artig å se deg igjen.”?',
                ['roligt', 'hövligt', 'tråkigt'], 'roligt',
                'På norska betyder artig roligt eller trevligt. På svenska betyder artig hövlig.'),
        ], beskrivning='Tränar falska vänner och vanliga ord i danska och norska, och att förstå korta meningar '
                       'på grannspråken.'),

        niva('sv-gy1-muntligt-1', 'Från idé till framförande', 'Muntlig framställning', [
            val('Vilka tre saker bör du tänka på först när du planerar en muntlig presentation?',
                ['Syfte, mottagare och situation', 'Typsnitt, bilder och färger i bildspelet',
                 'Rim, rytm och versmått'],
                'Syfte, mottagare och situation',
                'Vad vill du uppnå, vilka lyssnar och var ska du tala? Svaren styr vad du tar med och hur du säger '
                'det.'),
            ordna('Ordna stegen i retorikens arbetsgång, från förberedelse till framförande.',
                  ['Samla stoff', 'Ordna stoffet', 'Formulera dig', 'Öva in talet', 'Framför talet'],
                  forklaring='Först samlar du det du ska säga och ordnar det. Sedan väljer du orden, övar och '
                             'framför. Ofta räknas också ett steg före, att förstå situationen.'),
            para('Para ihop steget i retorikens arbetsgång med vad man gör.',
                 [('inventio', 'samlar stoff och argument'), ('dispositio', 'ordnar stoffet i en disposition'),
                  ('elocutio', 'väljer ord och stil'), ('memoria', 'lär in talet'), ('actio', 'framför talet')],
                 'De latinska namnen kommer från antikens retorik. Stegen går att använda för alla tal och '
                 'presentationer.'),
            val('Vad är stödord?',
                ['Korta ord som påminner dig om vad du ska säga',
                 'Ord som publiken ska skriva ner medan du talar',
                 'Svåra ord som gör att talet låter mer imponerande'],
                'Korta ord som påminner dig om vad du ska säga',
                'Med stödord på en lapp kan du tala fritt och se på publiken, i stället för att läsa innantill ur '
                'ett manus.'),
            val('Vad är ett bra sätt att börja en presentation?',
                ['Med en fråga eller ett exempel som väcker intresse',
                 'Med en ursäkt för att du inte har hunnit förbereda dig',
                 'Med den svåraste detaljen, utan någon förklaring'],
                'Med en fråga eller ett exempel som väcker intresse',
                'Inledningen ska fånga lyssnarna. En ursäkt sänker förväntningarna, och en svår detalj först gör '
                'det svårt att hänga med.'),
            sant('En muntlig presentation blir alltid bättre ju fler bilder den har.', False,
                 'Bilder ska stödja det du säger. För många bilder, eller för mycket text på dem, drar '
                 'uppmärksamheten från dig.'),
            val('Varför behöver en muntlig presentation ofta fler upprepningar och sammanfattningar än en skriven '
                'text?',
                ['Lyssnaren kan inte gå tillbaka och höra om det som sagts',
                 'Talat språk har färre ord än skrivet språk har',
                 'Publiken vill helst att presentationen blir så lång som möjligt'],
                'Lyssnaren kan inte gå tillbaka och höra om det som sagts',
                'En läsare kan bläddra tillbaka, men en lyssnare hör orden en gång. Därför hjälper det att säga vad '
                'du ska ta upp, upprepa det viktigaste och sammanfatta.'),
            val('Du ska presentera samma ämne för en klass i årskurs 3 och för dina klasskamrater. Vad bör du ändra?',
                ['Ord, exempel och längd, efter vad lyssnarna kan',
                 'Ingenting, eftersom innehållet ändå är detsamma',
                 'Bara hur högt du talar när du står framför dem'],
                'Ord, exempel och längd, efter vad lyssnarna kan',
                'Att anpassa sig efter mottagaren är kärnan i muntlig framställning. Yngre lyssnare behöver enklare '
                'ord, fler exempel och en kortare presentation.'),
            skriv('Vad kallas planen över vad en presentation ska ta upp och i vilken ordning? Skriv ordet.',
                  ['disposition', 'en disposition', 'dispositionen', 'dispositio'],
                  'En disposition delar ofta in talet i inledning, huvuddel och avslutning, och visar ordningen '
                  'mellan delarna.'),
        ], beskrivning='Tränar att planera en presentation efter syfte och mottagare, retorikens arbetsgång, '
                       'disposition, stödord och hur man fångar publiken.'),

        niva('sv-gy1-muntligt-2', 'Elins presentation', 'Muntlig framställning', [
            val('Hur börjar Elin sin presentation?',
                ['Med att be publiken räcka upp handen',
                 'Med att presentera sig själv och berätta vem hon är',
                 'Med en sammanfattning av hela talet'],
                'Med att be publiken räcka upp handen',
                'Hon börjar med ”Räck upp handen om …”. Då blir lyssnarna delaktiga från första meningen.'),
            val('Varför säger Elin tidigt att hon tar upp tre saker?',
                ['Så att publiken vet vad som kommer och kan följa med',
                 'Så att presentationen ska bli längre och mer formell',
                 'För att visa att hon har lärt sig manuset utantill'],
                'Så att publiken vet vad som kommer och kan följa med',
                'När lyssnarna vet dispositionen kan de följa med och märker när en ny del börjar.'),
            skriv('Vilket uttryck på två ord använder Elin när hon kommer till den sista av sina tre delar? Skriv det.',
                  ['till sist', 'till sist:', '”till sist”', '"till sist"', "'till sist'"],
                  'Hon använder signalorden ”för det första”, ”för det andra” och ”till sist”. De visar var i talet '
                  'lyssnaren är.'),
            para('Para ihop delen av talet med vad den gör.',
                 [('Räck upp handen om …', 'väcker publikens intresse'),
                  ('Jag tar upp tre saker …', 'visar dispositionen'),
                  ('Ringblommor är gula och orange blommor …', 'förklarar ett ord för publiken'),
                  ('Så nästa gång ni äter sallad …', 'knyter an till inledningen')],
                 'Varje del har en uppgift: att fånga, att visa vägen, att förklara och att runda av.'),
            val('Hur visar Elin att hon har tänkt på sina lyssnare?',
                ['Hon förklarar ett ord och tar exempel från deras skola',
                 'Hon använder många fackord som klassen inte har hört förut',
                 'Hon ber dem läsa om odling före lektionen'],
                'Hon förklarar ett ord och tar exempel från deras skola',
                'Hon förklarar vad ringblommor är och talar om salladen i deras egen matsal. Det gör ämnet nära '
                'och begripligt.'),
            sant('Elin avslutar med en uppmaning till publiken.', True,
                 'Hon säger: ”kom och prata med mig efter lektionen”. En uppmaning sist talar om vad publiken kan '
                 'göra.'),
            val('Vad är syftet med presentationen?',
                ['Att berätta om odlingen och få fler att vilja hjälpa till',
                 'Att klaga på maten som serveras i skolans matsal',
                 'Att övertyga rektorn om att köpa fler odlingslådor till skolan'],
                'Att berätta om odlingen och få fler att vilja hjälpa till',
                'Hon informerar om odlingen och säger att de behöver fler som hjälper till. Rektorn har redan '
                'lovat lådorna.'),
            sant('Enligt Elin syntes de första bladen redan första veckan.', False,
                 'Det står: ”Första veckan hände ingenting alls.” Först sedan kom de små gröna bladen.'),
            val('Varför passar meningen om sniglarna i presentationen?',
                ['Den är ett konkret och lite roligt exempel',
                 'Den visar att hela odlingen har misslyckats',
                 'Den är presentationens viktigaste argument'],
                'Den är ett konkret och lite roligt exempel',
                'Ett konkret exempel med lite humor gör det lättare att lyssna och att minnas det som sägs.'),
            val('Elin vill hålla presentationen utan att läsa innantill. Hur förbereder hon sig bäst?',
                ['Hon skriver stödord för varje del och övar högt',
                 'Hon lär sig manuset ord för ord och tittar ner',
                 'Hon delar ut hela manuset till klassen före talet'],
                'Hon skriver stödord för varje del och övar högt',
                'Stödord för de tre delarna hjälper henne att minnas ordningen, och att öva högt visar hur lång tid '
                'talet tar.'),
        ], beskrivning='Ett manus till en presentation för klassen, med frågor om inledning, disposition, '
                       'signalord, mottagare och avslutning.',
            text=MANUSET),

        niva('sv-gy1-meningsbyggnad-1', 'Att och och, böjning och tempus', 'Meningsbyggnad', [
            val('Välj rätt ord: ”Det är svårt ___ veta vad man ska välja.”',
                ['att', 'och'], 'att',
                'Veta står i infinitiv, och då ska infinitivmärket att stå före, inte och. I tal låter att och och '
                'ofta likadant, men i skrift ska det vara att här.'),
            val('Välj rätt ord: ”Vi gick ut ___ spelade fotboll.”',
                ['och', 'att'], 'och',
                'Och binder ihop två verb i samma form: gick och spelade. Infinitivmärket att står bara framför ett '
                'verb i infinitiv.'),
            val('Vilken mening följer skriftspråkets norm?',
                ['Jag ska försöka sova nu.', 'Jag ska försöka och sova nu.', 'Jag ska försöka å sova nu.'],
                'Jag ska försöka sova nu.',
                'Efter försöka följer ett verb i infinitiv, med eller utan att. ”Försöka och sova” är vanligt i tal '
                'men undviks i skrift.'),
            val('Välj rätt form: ”Huset var gammalt och ___.”',
                ['slitet', 'sliten', 'slitna'], 'slitet',
                'Huset är ett ett-ord i singular, så båda adjektiven får t: gammalt och slitet. Att adjektivet '
                'böjs efter ordet det beskriver kallas kongruens.'),
            val('Välj rätt form: ”Alla eleverna var ___ efter provet.”',
                ['trötta', 'trött'], 'trötta',
                'Eleverna står i plural, så adjektivet får pluraländelse: trötta.'),
            sant('I meningen ”I går går jag till affären och köpte mjölk.” byter skribenten tempus utan anledning.',
                 True,
                 'Allt hände i går, så båda verben ska stå i preteritum: I går gick jag till affären och köpte '
                 'mjölk.'),
            val('Vilken mening håller samma tempus hela vägen?',
                ['När vi kom fram regnade det, så vi gick in.', 'När vi kom fram regnar det, så vi gick in.',
                 'När vi kommer fram regnade det, så vi går in.'],
                'När vi kom fram regnade det, så vi gick in.',
                'Kom, regnade och gick står alla i preteritum. I de andra hoppar verben mellan presens och '
                'preteritum.'),
            val('Vilken mening har rätt verbformer i skrift?',
                ['Jag hade velat göra det.', 'Jag hade velat gjort det.', 'Jag hade vela gjort det.'],
                'Jag hade velat göra det.',
                'Efter ett hjälpverb i supinum, som velat, står nästa verb i infinitiv: hade velat göra. ”Velat '
                'gjort” kallas dubbelsupinum och hör till talspråket.'),
            skriv('Skriv verbet inom parentes i rätt form: ”Hon hade tänkt ___ en ny cykel.” (köpa)',
                  ['köpa', 'att köpa'],
                  'Efter tänkt, som är supinum, står infinitiv: hade tänkt köpa.'),
            para('Para ihop felet med meningen där det finns.',
                 [('dubbelsupinum', 'Vi hade kunnat vunnit.'), ('tempusbyte', 'Hon kom in och sätter sig.'),
                  ('och i stället för att', 'Det är kul och simma.'),
                  ('fel böjt adjektiv', 'Rummet var mörk och kall.')],
                 'Rätt blir: Vi hade kunnat vinna. Hon kom in och satte sig. Det är kul att simma. Rummet var '
                 'mörkt och kallt.'),
        ], beskrivning='Tränar att och och, adjektivets böjning, att hålla samma tempus och att undvika '
                       'dubbelsupinum.'),

        niva('sv-gy1-meningsbyggnad-2', 'Syftning och tydlighet', 'Meningsbyggnad', [
            val('Vilken mening kan missförstås?',
                ['Mamma gav hunden till grannen eftersom hon hade blivit gammal.',
                 'Mamma gav hunden till grannen eftersom hunden hade blivit gammal.',
                 'Eftersom hunden hade blivit gammal gav mamma den till grannen.'],
                'Mamma gav hunden till grannen eftersom hon hade blivit gammal.',
                'Hon kan syfta på mamma, på grannen och till och med på hunden. I de andra meningarna är det klart '
                'vem som blivit gammal.'),
            skriv('Vad kallas det när det är oklart vilket ord ett pronomen som han, hon eller den syftar på? '
                  'Skriv ordet.',
                  ['syftningsfel', 'ett syftningsfel', 'syftningsfelet', 'oklar syftning', 'syftningsproblem'],
                  'Ett syftningsfel gör att läsaren kan förstå meningen på fel sätt. Byt pronomenet mot ordet, eller '
                  'skriv om meningen.'),
            val('Välj rätt ord: ”Tåget var en timme försenat, ___ gjorde att vi missade mötet.”',
                ['vilket', 'som', 'vilken'], 'vilket',
                'Det var förseningen, hela satsen före kommat, som gjorde att vi missade mötet. Vilket kan syfta på '
                'en hel sats. Som och vilken syftar på ett enskilt ord.'),
            val('Vilken av meningarna är ingen fullständig mening i en saklig text?',
                ['Eftersom bussen var försenad.', 'Bussen var försenad.', 'Bussen var försenad, så vi kom sent.'],
                'Eftersom bussen var försenad.',
                'Eftersom bussen var försenad är en bisats. Ensam med punkt saknar den en huvudsats: Vi kom sent '
                'eftersom bussen var försenad.'),
            val('Vilken mening följer klarspråkets råd bäst?',
                ['Vi bygger om skolan i sommar.',
                 'En ombyggnation av skolan kommer att genomföras under sommarperioden.',
                 'Under sommaren sker ett genomförande av skolans ombyggnad.'],
                'Vi bygger om skolan i sommar.',
                'Klarspråk betyder att skriva enkelt och tydligt. Ett verb som bygger om är lättare att läsa än '
                'substantiv som ombyggnation och genomförande.'),
            sant('Enligt språklagen ska språket i offentlig verksamhet vara vårdat, enkelt och begripligt.', True,
                 'Det står i språklagen. Därför arbetar myndigheter med klarspråk, så att alla kan förstå det de '
                 'skriver.'),
            val('Varför kan passiv form vara ett problem i en text som ska vara tydlig?',
                ['Den kan dölja vem som gör något',
                 'Den gör alltid meningarna längre',
                 'Den är förbjuden i myndighetstexter'],
                'Den kan dölja vem som gör något',
                'I ”Beslutet fattades” står inte vem som beslutade. Passiv form är inte fel, men läsaren kan behöva '
                'veta vem som handlar.'),
            ordna('Skriv om ”Det beslutades att skolan skulle stängas.” så att det syns att kommunen beslutade. En '
                  'bricka ska inte vara med.',
                  ['Kommunen', 'beslutade', 'att', 'stänga', 'skolan.'], extra=['beslutades'],
                  forklaring='I aktiv form står den som gör något som subjekt: Kommunen beslutade. Då ser läsaren '
                             'vem som har ansvaret.'),
            val('Varför är meningen ”Efter att ha ätit gick bussen.” konstig?',
                ['Det låter som om bussen har ätit', 'Den saknar ett verb i preteritum',
                 'Den har för många bisatser'],
                'Det låter som om bussen har ätit',
                'Den som har ätit är den som är subjekt i huvudsatsen, och här är det bussen. Rätt blir till '
                'exempel: Efter att ha ätit gick vi till bussen.'),
        ], beskrivning='Tränar syftning, vilket och som, ofullständiga meningar, klarspråk och aktiv och passiv '
                       'form.'),
    ]),

    # ================================================================
    # GYMNASIET 2 (Svenska 2)
    # ================================================================
    bana(SV, 'gy2', [
        niva('sv-gy2-antiken-1', 'Antikens epos och drama', 'Antiken, medeltiden och renässansen', [
            val('Vad är ett epos?',
                ['En lång berättande dikt om hjältar och stora händelser',
                 'En kort dikt som uttrycker en enda stark känsla hos diktaren',
                 'En pjäs där alla skådespelare bär masker'],
                'En lång berättande dikt om hjältar och stora händelser',
                'Eposen berättar om hjältar, gudar och krig. En kort dikt om en känsla är lyrik, och masker hör '
                'till den grekiska teatern.'),
            para('Para ihop det antika verket med vad det handlar om.',
                 [('Iliaden', 'striderna om Troja och Akilles vrede'),
                  ('Odysséen', 'Odysseus långa resa hem efter kriget'),
                  ('Kung Oidipus', 'en kung som ovetande dödat sin far och gift sig med sin mor'),
                  ('Aeneiden', 'Aeneas flykt från Troja och färd mot Italien')],
                 'Iliaden och Odysséen är grekiska epos. Kung Oidipus är en grekisk tragedi och Aeneiden ett romerskt '
                 'epos.'),
            val('Vem tillskrivs de grekiska eposen Iliaden och Odysséen?',
                ['Homeros', 'Sofokles', 'Vergilius'], 'Homeros',
                'De tillskrivs Homeros, men ingen vet säkert om han har funnits. Dikterna levde länge muntligt '
                'innan de skrevs ner.'),
            val('Vad är typiskt för den antika grekiska tragedin?',
                ['En hjälte går under, ofta genom eget övermod eller ödet',
                 'Alla personerna i pjäsen blir lyckliga i den allra sista scenen',
                 'Den skildrar vanliga människors vardag i staden'],
                'En hjälte går under, ofta genom eget övermod eller ödet',
                'Tragedin slutar olyckligt för huvudpersonen. Ett lyckligt slut passar komedin bättre.'),
            skriv('Vad heter det grekiska ordet för övermod, som ofta leder till hjältens fall i en tragedi? Skriv '
                  'ordet.',
                  ['hybris', 'hubris'],
                  'Hybris är när en människa sätter sig över gudarna eller sina gränser. I tragedin straffas det.'),
            val('Vad menade Aristoteles med katharsis?',
                ['Att publiken renas från känslor som medlidande och fruktan',
                 'Att hjälten får sitt välförtjänta straff i pjäsens allra sista scen',
                 'Att pjäsen ska utspela sig under ett enda dygn'],
                'Att publiken renas från känslor som medlidande och fruktan',
                'Katharsis betyder rening. Enligt Aristoteles kan publiken genom tragedin få utlopp för medlidande '
                'och fruktan.'),
            sant('Tragedi och komedi är två dramagenrer som går tillbaka till antikens Grekland.', True,
                 'Både tragedier och komedier spelades på teatrar i det antika Grekland, ofta vid fester för guden '
                 'Dionysos.'),
            val('Vad kallas antikens berättelser om gudar och hjältar, som förklarade världen för människorna?',
                ['myter', 'noveller', 'krönikor'], 'myter',
                'Myterna berättade om hur världen kom till och varför saker är som de är. Många senare verk bygger '
                'på dem.'),
            val('På vilket språk skrev romaren Vergilius sitt epos Aeneiden?',
                ['latin', 'grekiska', 'italienska'], 'latin',
                'Romarna skrev på latin. Grekiskan var språket i Homeros epos, och italienskan växte fram ur latinet '
                'långt senare.'),
        ], beskrivning='Tränar antikens litteratur: epos, myter, tragedi och komedi, hybris och katharsis, och '
                       'kända verk från Grekland och Rom.'),

        niva('sv-gy2-antiken-2', 'Medeltiden och renässansen', 'Antiken, medeltiden och renässansen', [
            val('Vad präglade mycket av den medeltida litteraturen i Europa?',
                ['Kristen tro och kyrkans lära', 'Vetenskap och förnuft', 'Arbetarnas villkor i städerna'],
                'Kristen tro och kyrkans lära',
                'Kyrkan var mäktig, och många texter handlade om tro, synd och frälsning. Förnuftet hör mer till '
                'upplysningen och arbetarnas villkor till realismen.'),
            val('Vad handlar Dantes Den gudomliga komedin om?',
                ['En vandring genom helvetet, skärselden och paradiset',
                 'Två unga från släkter som är fiender och blir kära',
                 'En man som läst så många riddarböcker att han tror att han är riddare'],
                'En vandring genom helvetet, skärselden och paradiset',
                'Dante skrev verket på 1300-talet. Det skildrar en resa genom livet efter döden, och det kristna '
                'synsättet styr hela berättelsen.'),
            val('Vad betyder ordet renässans?',
                ['pånyttfödelse', 'nedgång', 'upptäcktsresor'], 'pånyttfödelse',
                'Man ville låta antikens konst, filosofi och litteratur födas på nytt.'),
            val('Vad menas med humanismen under renässansen?',
                ['Ett intresse för människan och för antikens texter',
                 'En tro på att människan inte alls kan påverka sitt eget liv',
                 'Ett krav på att alla böcker ska handla om kyrkan'],
                'Ett intresse för människan och för antikens texter',
                'Humanisterna studerade de antika texterna och satte människan och hennes möjligheter i centrum.'),
            sant('Boktryckarkonsten, som Gutenberg utvecklade i Europa på 1400-talet, gjorde att böcker blev '
                 'billigare och spreds till fler.', True,
                 'Förut skrevs böcker av för hand. Med tryckpressen gick det att göra många exemplar, och tankar '
                 'spreds snabbare.'),
            para('Para ihop författaren med verket.',
                 [('Shakespeare', 'Hamlet'), ('Cervantes', 'Don Quijote'), ('Boccaccio', 'Decamerone'),
                  ('Petrarca', 'sonetterna till Laura')],
                 'Petrarca och Boccaccio skrev i Italien på 1300-talet och räknas ofta som de första humanisterna. '
                 'Shakespeare och Cervantes skrev kring år 1600.'),
            val('Hur många rader har en sonett?',
                [tal(14), '12', '8', '16'], tal(14),
                'En sonett har fjorton rader och ett fast rimschema. Formen kom från Italien och spreds i Europa '
                'under renässansen.'),
            val('Vad är de isländska sagorna?',
                ['Berättelser på prosa om släkter och strider',
                 'Dikter om gudarna som skrevs på latin i Rom',
                 'Romaner om livet i städerna under 1800-talet'],
                'Berättelser på prosa om släkter och strider',
                'Sagorna skrevs ner på Island under medeltiden. De berättar om släkter, fejder och hämnd, ofta med '
                'en sval och kortfattad stil.'),
            ordna('Ordna perioderna från äldst till yngst.',
                  ['antiken', 'medeltiden', 'renässansen', 'upplysningen'],
                  forklaring='Antiken hör till tiden före vår tideräkning och de första århundradena efter. Sedan '
                             'kom medeltiden, renässansen och upplysningen på 1700-talet.'),
            val('Vilken sorts texter är Shakespeare mest känd för?',
                ['skådespel', 'reseskildringar', 'epos'], 'skådespel',
                'Shakespeare skrev tragedier som Hamlet och komedier som spelas än i dag. Han skrev också dikter, '
                'men det är pjäserna som gjort honom känd.'),
        ], beskrivning='Tränar medeltidens och renässansens litteratur: kyrkans roll, Dante, humanismen, '
                       'boktryckarkonsten, sonetten och kända verk.'),

        niva('sv-gy2-sprakhistoria-1', 'Från runor till nusvenska', 'Språkhistoria', [
            ordna('Ordna svenskans perioder från äldst till yngst.',
                  ['runsvenska', 'fornsvenska', 'äldre nysvenska', 'yngre nysvenska', 'nusvenska'],
                  forklaring='Runsvenskan hör till vikingatiden och fornsvenskan till medeltiden. Nysvenskan börjar '
                             'på 1500-talet, och nusvenskan är 1900-talets och vår tids svenska.'),
            val('Med vilket skriftsystem skrev man svenska under vikingatiden?',
                ['runor', 'latinska bokstäver', 'kilskrift'], 'runor',
                'Runor ristades i sten, trä och ben. Det latinska alfabetet kom med kristendomen och kyrkan.'),
            skriv('Vad kallas runraden, efter sina sex första tecken? Skriv ordet.',
                  ['futhark', 'futharken', 'fuþark', 'futark', 'futhork'],
                  'De sex första runorna motsvarar ljuden f, u, th, a, r och k. Därför kallas runraden futhark.'),
            sant('Den yngre futharken, som användes under vikingatiden, hade fler tecken än vårt alfabet har '
                 'bokstäver.', False,
                 'Den yngre futharken hade bara %d runor. Samma runa fick därför stå för flera olika ljud.' % FUTHARK),
            val('Vad hände med kasusböjningen från fornsvenskan till i dag?',
                ['Den försvann nästan helt hos substantiven',
                 'Den fick fler kasus än den hade förut',
                 'Den finns kvar precis som den gjorde under medeltiden'],
                'Den försvann nästan helt hos substantiven',
                'Fornsvenskan böjde substantiven i fyra kasus. I dag finns genitivets s kvar, och pronomen som han '
                'och honom visar fortfarande skillnaden mellan subjekt och objekt.'),
            val('Vilken förstavelse kom in i svenskan från lågtyskan under medeltiden?',
                ['be-, som i betala', 'o-, som i olycka', 'van-, som i vantrivas'], 'be-, som i betala',
                'Under hansatiden lånade svenskan inte bara ord utan också ordled från lågtyskan, som be-, för-, '
                '-het och -else.'),
            val('Varför var Gustav Vasas bibel viktig för svenska språket?',
                ['Den blev en förebild för hur svenska skulle skrivas',
                 'Den var den första boken som skrevs med runor',
                 'Den gjorde latin till det officiella språket i hela Sverige'],
                'Den blev en förebild för hur svenska skulle skrivas',
                'Den kom på 1500-talet och var den första översättningen av hela Bibeln till svenska. Den lästes i '
                'kyrkor i hela landet, så dess stavning och ord spreds.'),
            para('Para ihop perioden med något som hör till den.',
                 [('runsvenska', 'inskrifter med runor på stenar'),
                  ('fornsvenska', 'landskapslagarna skrivs ner'),
                  ('äldre nysvenska', 'hela Bibeln kommer på svenska'),
                  ('nusvenska', 'engelskan blir det största långivarspråket')],
                 'Perioderna har fått sina gränser efter händelser som förändrade hur svenska skrevs.'),
            val('Vilken förändring kom med stavningsreformen 1906?',
                ['hv blev v, så att hvad blev vad',
                 'bokstaven å infördes i alfabetet',
                 'alla substantiv fick stor bokstav'],
                'hv blev v, så att hvad blev vad',
                'Reformen tog bort stavningar som inte längre motsvarade uttalet: hvad blev vad och haf blev hav. '
                'Bokstaven å hade använts sedan 1500-talet.'),
        ], beskrivning='Tränar svenskans perioder, runorna, kasus som försvann, lågtyskans ordled, Gustav Vasas '
                       'bibel och stavningsreformen.'),

        niva('sv-gy2-sprakhistoria-2', 'Stenen vid bron', 'Språkhistoria', [
            val('Vad är stenen vid bron, enligt texten?',
                ['En minnessten som Ingrid lät resa efter sin man',
                 'En gränssten som visar var byns marker tar slut',
                 'En gravsten som står precis ovanpå Svens grav vid ån'],
                'En minnessten som Ingrid lät resa efter sin man',
                'Läraren säger att det är en minnessten, och texten säger att Ingrid lät resa den efter Sven, sin '
                'man.'),
            sant('Enligt runstenens text lät Ingrid också bygga bron.', True,
                 'Det står: ”Ingrid lät resa denna sten efter Sven, sin man, och göra bron.”'),
            val('Vad visar korset och bönen på stenen, enligt texten?',
                ['Att familjen var kristen', 'Att Sven var präst i byn', 'Att stenen restes före vikingatiden'],
                'Att familjen var kristen',
                'Korset och bönen ”Gud hjälpe hans ande” är kristna. Stenen restes när kristendomen kom till '
                'Sverige.'),
            skriv('Hur många tecken hade den yngre futharken enligt texten? Skriv ett tal.', [tal(FUTHARK), 'sexton'],
                  'Det står att den yngre futharken hade bara %d tecken.' % FUTHARK),
            val('Varför var runorna svåra att läsa, enligt texten?',
                ['Samma runa kunde stå för flera ljud', 'Runorna var skrivna baklänges, från höger till vänster',
                 'Stenen hade vittrat sönder nästan helt'],
                'Samma runa kunde stå för flera ljud',
                'Med bara %d tecken fick en runa stå för flera ljud, och läsaren fick gissa utifrån sammanhanget.'
                % FUTHARK),
            val('Vad menar läraren med att texten är ”forskarnas tolkning”?',
                ['Att läsningen är rimlig men inte helt säker', 'Att forskarna själva har ristat in runorna på stenen',
                 'Att texten är påhittad av forskarna'],
                'Att läsningen är rimlig men inte helt säker',
                'Runorna kan läsas på mer än ett sätt. Forskarna har valt den läsning som verkar rimligast.'),
            val('Varför byggde man broar, enligt texten, förutom för att komma över ån?',
                ['Det räknades som en god gärning som kunde hjälpa den döde',
                 'Det var ett krav från kungen för att man skulle få resa en sten',
                 'Det gjorde att stenen syntes bättre från vägen'],
                'Det räknades som en god gärning som kunde hjälpa den döde',
                'Det står att bygga en bro räknades som en god gärning som kunde hjälpa den döde.'),
            ordna('Ordna det som texten tar upp, i den ordning det kommer.',
                  ['Klassen stannar vid stenen', 'Vad stenens text säger', 'När runstenarna restes och varför',
                   'Eleverna försöker läsa runorna', 'Att stenen en gång var målad'],
                  forklaring='Texten börjar med besöket, går till stenens text och dess bakgrund, låter eleverna '
                             'pröva själva och slutar med färgen.'),
            val('Vilken textsort liknar texten mest?',
                ['ett reportage', 'en debattartikel', 'en dikt'], 'ett reportage',
                'Texten skildrar ett besök med repliker och fakta, som ett reportage. Den argumenterar inte för '
                'någon åsikt.'),
            val('Vad gissar skribenten om stenen i sista stycket?',
                ['Att den syntes på långt håll när den var målad', 'Att den snart kommer att flyttas till ett museum',
                 'Att någon har målat om den nyligen'],
                'Att den syntes på långt håll när den var målad',
                'Ordet kanske visar att det är en gissning: ”Kanske lyste slingan en gång så att den syntes på '
                'långt håll från vägen.”'),
        ], beskrivning='Ett reportage om ett skolbesök vid en runsten, med frågor om runorna, runstenarnas tid '
                       'och textens uppbyggnad.',
            text=RUNSTENEN),

        niva('sv-gy2-ordbildning-1', 'Sammansättning och avledning', 'Ordbildning och lånord', [
            para('Para ihop sättet att bilda ord med exemplet.',
                 [('sammansättning', 'fotbollsplan'), ('avledning med prefix', 'ovän'),
                  ('avledning med suffix', 'vänskap'), ('kortord', 'bil, av automobil')],
                 'I en sammansättning blir två ord ett. I en avledning läggs ett ordled till, först eller sist. Ett '
                 'kortord är ett längre ord som har kortats.'),
            val('Vilket ord är bildat genom avledning?',
                ['vänlighet', 'skolgårdsbänk', 'jeans'], 'vänlighet',
                'Vänlighet är vänlig med suffixet -het. Skolgårdsbänk är en sammansättning och jeans ett lånord.'),
            val('Vad är ett suffix?',
                ['Ett ordled som står sist, som -het i frihet',
                 'Ett ordled som står först, som o- i otur',
                 'Ett ord som har lånats från ett annat språk'],
                'Ett ordled som står sist, som -het i frihet',
                'Ett suffix står sist och kan ändra ordklass: fri är ett adjektiv, frihet ett substantiv. Ett '
                'ordled som står först kallas prefix.'),
            skriv('Vilket prefix gör ordet möjlig till sin motsats? Skriv prefixet.',
                  ['o', 'o-'],
                  'Omöjlig är motsatsen till möjlig. Prefixet o- betyder ofta inte, som i ovanlig och otydlig.'),
            val('Heter det en eller ett husbåt?',
                ['en husbåt, för efterleden båt är ett en-ord',
                 'ett husbåt, för förleden hus är ett ett-ord',
                 'båda går, eftersom ordet är sammansatt'],
                'en husbåt, för efterleden båt är ett en-ord',
                'I ett sammansatt ord är det efterleden som bestämmer ordklass och genus. En husbåt är en båt.'),
            val('I ordet fotbollsmatch binds leden ihop med ett s. Vad kallas ett sådant s?',
                ['foge-s', 'plural-s', 'passiv-s'], 'foge-s',
                'Ett foge-s binder ihop förled och efterled: fotboll + s + match. Det finns också andra fogar, som '
                'u:et i gatubelysning.'),
            sant('I ordet oförutsägbar finns både ett prefix och ett suffix.', True,
                 'O- står först och betyder inte, och -bar står sist och betyder att något går att göra.'),
            val('Vad betyder suffixet -bar i ord som ätbar och läsbar?',
                ['att något går att göra', 'att något saknas helt och hållet', 'att något är litet'],
                'att något går att göra',
                'Ätbar betyder att något går att äta och läsbar att något går att läsa.'),
            skriv('Bilda ett substantiv av adjektivet trygg med suffixet -het. Skriv ordet.',
                  ['trygghet', 'tryggheten', 'en trygghet'],
                  'Trygg + het blir trygghet. Suffixet gör adjektivet till ett substantiv.'),
        ], beskrivning='Tränar sammansättning, avledning med prefix och suffix, foge-s och att efterleden '
                       'bestämmer genus.'),

        niva('sv-gy2-ordbildning-2', 'Nyord och lånord', 'Ordbildning och lånord', [
            val('Vad är ett översättningslån?',
                ['Ett ord som översatts led för led från ett annat språk',
                 'Ett ord som lånats in med oförändrad stavning',
                 'Ett ord som bara används av den som översätter böcker till svenska'],
                'Ett ord som översatts led för led från ett annat språk',
                'I ett översättningslån byts varje del mot ett svenskt ord. Fotboll är till exempel engelskans '
                'football, översatt.'),
            val('Vilket ord är ett översättningslån från engelskan?',
                ['skyskrapa', 'mountainbike', 'fåtölj'], 'skyskrapa',
                'Skyskrapa är engelskans skyscraper översatt led för led. Mountainbike har lånats in direkt, och '
                'fåtölj kommer från franskan.'),
            para('Para ihop ordet med det språk svenskan lånade det från.',
                 [('fåtölj', 'franska'), ('borgmästare', 'lågtyska'), ('tejp', 'engelska'), ('tjej', 'romani')],
                 'Lånorden visar vilka språk svenskan har haft kontakt med: lågtyskan under medeltiden, franskan på '
                 '1700-talet, engelskan på senare tid och romani, ett av Sveriges minoritetsspråk.'),
            val('Vilket ord är ett engelskt lånord som har fått svensk stavning?',
                ['dejt', 'weekend', 'deadline'], 'dejt',
                'Dejt kommer av engelskans date och stavas som det uttalas på svenska. Weekend och deadline stavas '
                'fortfarande som på engelska.'),
            val('Vilket är det vanligaste sättet att bilda nya ord i svenskan?',
                ['sammansättning', 'översättningslån', 'initialord'], 'sammansättning',
                'De flesta nyord är sammansättningar av ord som redan finns. Därför kan svenskan hela tiden bilda '
                'nya ord för nya saker.'),
            skriv('Vad kallas förkortningar som FN och EU, som bildas av den första bokstaven i flera ord? Skriv '
                  'ordet.',
                  ['initialord', 'ett initialord', 'initialorden', 'initialförkortning', 'bokstavsord'],
                  'FN är Förenta nationerna och EU Europeiska unionen. Ett kortord är något annat: ett ord som '
                  'kortats, som bio av biograf.'),
            val('Vad kallas strävan att hålla ett språk fritt från lånord?',
                ['purism', 'kodväxling', 'dialekt'], 'purism',
                'En purist vill ersätta lånord med inhemska ord. Kodväxling är att växla mellan språk i samma '
                'samtal.'),
            val('Varför kom många franska ord in i svenskan på 1700-talet?',
                ['Franskan var språket vid hoven och bland de förnäma i Europa',
                 'Sverige styrdes då av en fransk kung som bodde kvar i Paris',
                 'Franska blev det enda språket som fick användas i de svenska skolorna'],
                'Franskan var språket vid hoven och bland de förnäma i Europa',
                'Den som ville vara fin talade franska. Därför kom ord om mode, möbler och umgänge, som fåtölj och '
                'parfym, från franskan.'),
            ordna('Ordna språken efter när de gav svenskan flest lånord, från äldst till yngst.',
                  ['lågtyska', 'franska', 'engelska'],
                  forklaring='Lågtyskan kom med hansan under medeltiden, franskan med hovet på 1600- och 1700-talet '
                             'och engelskan främst under 1900-talet.'),
        ], beskrivning='Tränar lånord och översättningslån, språken svenskan lånat från, svensk stavning av '
                       'lånord, initialord, nyord och purism.'),
    ]),

    # ================================================================
    # GYMNASIET 3 (Svenska 3)
    # ================================================================
    bana(SV, 'gy3', [
        niva('sv-gy3-retorik-1', 'Situation, syfte och stilfigurer', 'Retorisk analys', [
            val('Vad ingår i den retoriska situationen?',
                ['Vem som talar, till vem, om vad, när och varför',
                 'Talets längd, dess rim och dess versmått',
                 'Bara vilka stilfigurer och ord som talaren väljer att använda'],
                'Vem som talar, till vem, om vad, när och varför',
                'Den retoriska situationen är sammanhanget talet hålls i. En analys börjar där, för samma ord kan '
                'fungera olika i olika situationer.'),
            val('Vad betyder kairos inom retoriken?',
                ['Det rätta tillfället att säga något', 'Talarens trovärdighet inför publiken',
                 'Talets logiska argument och belägg'],
                'Det rätta tillfället att säga något',
                'Ett tal som hålls vid rätt tillfälle får större verkan. Trovärdigheten kallas ethos och de '
                'logiska argumenten logos.'),
            val('Talet har tre klassiska syften: docere, delectare och movere. Vilket handlar om att beröra publiken '
                'så att den vill handla?',
                ['movere', 'docere', 'delectare'], 'movere',
                'Docere är att undervisa, delectare att behaga och movere att beröra och sätta i rörelse.'),
            para('Para ihop stilfiguren med exemplet.',
                 [('antites', 'Små steg i dag, stora förändringar i morgon.'),
                  ('trikolon', 'Det är billigt, enkelt och snabbt.'),
                  ('hyperbol', 'Jag har sagt det en miljon gånger.'),
                  ('retorisk fråga', 'Vem vill väl bo i en stad utan träd?')],
                 'En antites ställer motsatser mot varandra, ett trikolon är ett tretal, en hyperbol är en medveten '
                 'överdrift och en retorisk fråga väntar inget svar.'),
            val('En talare säger ”Toppen, nu regnar det igen” när alla har längtat efter sol. Vilken stilfigur är det?',
                ['ironi', 'anafor', 'trikolon'], 'ironi',
                'Ironi är att säga motsatsen till det man menar, och sammanhanget visar det.'),
            skriv('Vad kallas stilfiguren där samma ord eller ordgrupp upprepas i början av flera meningar? Skriv '
                  'ordet.',
                  ['anafor', 'en anafor', 'anaforen', 'anaforer'],
                  'Till exempel: ”Vi kämpar för skolan. Vi kämpar för framtiden.” Upprepningen gör budskapet lätt '
                  'att minnas.'),
            para('Para ihop delen av ett klassiskt tal med vad den gör.',
                 [('exordium', 'inledningen som fångar publiken'),
                  ('narratio', 'bakgrunden till ämnet'),
                  ('refutatio', 'bemötandet av motargument'),
                  ('peroratio', 'avslutningen som sammanfattar och manar')],
                 'Den klassiska dispositionen kommer från antikens retorik. I talets mitt står också talarens tes och '
                 'argument.'),
            sant('En retorisk analys undersöker bara vilka stilfigurer en talare använder.', False,
                 'Analysen tar också upp situationen, syftet, dispositionen och argumenten, och hur allt detta '
                 'verkar på publiken.'),
            val('Vad är målet med en retorisk analys?',
                ['Att visa hur en text försöker påverka och hur väl den lyckas',
                 'Att avgöra om talarens åsikt i själva sakfrågan är rätt eller fel',
                 'Att skriva ett nytt och bättre tal i samma ämne'],
                'Att visa hur en text försöker påverka och hur väl den lyckas',
                'Den som analyserar behöver inte hålla med talaren. Analysen visar hur talet är byggt för att '
                'påverka.'),
        ], beskrivning='Tränar den retoriska situationen, kairos, talets tre syften, den klassiska dispositionen '
                       'och stilfigurer som antites, trikolon, hyperbol, ironi och anafor.'),

        niva('sv-gy3-retorik-2', 'Talet om biblioteket', 'Retorisk analys', [
            val('Vad är talarens tes?',
                ['Biblioteket ska fortsätta ha öppet på kvällarna',
                 'Kommunen behöver inte spara några pengar alls',
                 'Biblioteket borde skaffa fler datorer till besökarna'],
                'Biblioteket ska fortsätta ha öppet på kvällarna',
                'Hon ber politikerna säga nej till förslaget att stänga klockan fem, alltså att behålla '
                'kvällsöppet.'),
            val('Varför är tidpunkten för talet väl vald, det som kallas kairos?',
                ['Politikerna ska besluta om öppettiderna en vecka senare',
                 'Mötet hålls på kvällen, när publiken är som allra piggast',
                 'Biblioteket har just fått in en stor mängd nya böcker'],
                'Politikerna ska besluta om öppettiderna en vecka senare',
                'Talet hålls innan beslutet fattas, när det fortfarande går att påverka. Det är kairos.'),
            val('Vilken del av talet bygger tydligast på ethos?',
                ['Att hon har arbetat som bibliotekarie i femton år',
                 'Siffrorna om besökarna på kvällen och förmiddagen',
                 'Bilden av pojken, pensionären och kvinnan i rummet'],
                'Att hon har arbetat som bibliotekarie i femton år',
                'Hennes erfarenhet ger henne trovärdighet. Siffrorna är logos och bilden av människorna pathos.'),
            para('Para ihop citatet ur talet med stilfiguren.',
                 [('De som arbetar. De som pluggar.', 'anafor'),
                  ('spara några kronor i dag … satsa på våra invånare i morgon', 'antites'),
                  ('Vill vi verkligen vara kommunen som släckte ljuset?', 'retorisk fråga'),
                  ('Två bibliotekarier, en lampa och en dörr som står öppen.', 'trikolon')],
                 'Upprepningen i början är en anafor, motsatserna en antites, frågan väntar inget svar och tre led '
                 'i rad är ett trikolon.'),
            val('Hur bemöter talaren motargumentet att kommunen måste spara?',
                ['Hon håller med men säger att kvällarna kostar lite',
                 'Hon säger att kommunen inte behöver spara några pengar',
                 'Hon låtsas att ingen har det motargumentet'],
                'Hon håller med men säger att kvällarna kostar lite',
                'Att ge motståndaren rätt i en del och sedan visa varför det inte räcker är ett vanligt sätt att '
                'bemöta ett motargument.'),
            skriv('I talets sista stycke slutar tre meningar i rad med samma två ord. Vilka? Skriv dem.',
                  ['för alla', '”för alla”', '"för alla"', "'för alla'"],
                  'Biblioteket är öppet, gratis och till för alla. En upprepning sist i meningar kallas epifor, och '
                  'här blir det också ett tretal som är lätt att minnas.'),
            val('Hur börjar talet, och varför?',
                ['Med en bild av en kväll på biblioteket, för att väcka känslor',
                 'Med statistik om besökarna, för att visa att hon är saklig',
                 'Med en presentation av sig själv, för att visa att hon är expert'],
                'Med en bild av en kväll på biblioteket, för att väcka känslor',
                'Inledningen målar upp människor som publiken kan se framför sig. Det fångar intresset och väcker '
                'känslor från början.'),
            sant('Enligt talaren hade biblioteket i fjol fler besökare efter klockan fem än före klockan tolv.', True,
                 'Det står i stycket som börjar ”Varför är kvällarna så viktiga?”. Siffran är talets tydligaste logos.'),
            val('Vilken svaghet kan en kritisk lyssnare se i talet?',
                ['Påståendet om vad kvällarna kostar stöds inte av några siffror',
                 'Talet har ingen tydlig tes som publiken kan ta ställning till alls',
                 'Talaren säger aldrig vilka som besöker biblioteket'],
                'Påståendet om vad kvällarna kostar stöds inte av några siffror',
                'Hon säger att kvällarna kostar mindre än politikerna tror, men hon visar inte hur mycket. Det kan '
                'en motståndare utnyttja.'),
            val('Talaren vill få politikerna att handla. Vilket av talets klassiska syften är det?',
                ['movere', 'docere', 'delectare'], 'movere',
                'Movere är att beröra publiken så att den gör något, här att rösta nej till förslaget.'),
        ], beskrivning='Ett tal om bibliotekets öppettider, med frågor om tes, kairos, appeller, stilfigurer, '
                       'bemötande av motargument och svagheter.',
            text=TALET),

        niva('sv-gy3-litteraturvetenskap-1', 'Berättartekniker', 'Litteraturvetenskapliga begrepp', [
            para('Para ihop begreppet med förklaringen.',
                 [('in medias res', 'berättelsen börjar mitt i handlingen'),
                  ('tillbakablick', 'handlingen går tillbaka till något som hänt tidigare'),
                  ('ramberättelse', 'en berättelse som andra berättelser ryms i'),
                  ('öppet slut', 'läsaren får själv avgöra hur det går')],
                 'Begreppen beskriver hur berättelsen är ordnad. Den ordningen kan skilja sig från den ordning '
                 'händelserna sker i.'),
            val('Vad är en opålitlig berättare?',
                ['En berättare vars version läsaren har skäl att tvivla på',
                 'En berättare som vet allt om vad alla personer tänker och känner',
                 'En berättare som byts ut i varje nytt kapitel'],
                'En berättare vars version läsaren har skäl att tvivla på',
                'Berättaren kan ljuga, missförstå eller dölja något. Läsaren märker det genom detaljer som inte '
                'stämmer.'),
            val('Vad menas med intertextualitet?',
                ['Att en text anspelar på eller samspelar med andra texter',
                 'Att en text har skrivits av flera olika författare tillsammans',
                 'Att en text har översatts till många språk'],
                'Att en text anspelar på eller samspelar med andra texter',
                'En roman kan till exempel låna en myt, citera en dikt eller skriva om en känd berättelse.'),
            val('Vad är en allegori?',
                ['En berättelse där personer och händelser står för något annat',
                 'En dikt med ett strängt och fast rimschema',
                 'En sann berättelse om författarens eget liv från barndomen och framåt'],
                'En berättelse där personer och händelser står för något annat',
                'I en allegori har hela berättelsen en dold betydelse, till exempel politisk eller religiös.'),
            skriv('Vad kallas en text som härmar en annan text eller genre överdrivet för att göra den löjlig? Skriv '
                  'ordet.',
                  ['parodi', 'en parodi', 'parodin'],
                  'En parodi härmar och överdriver det typiska i förlagan, så att det blir komiskt.'),
            val('Vad skiljer en pastisch från en parodi?',
                ['En pastisch härmar en stil utan att vilja göra den löjlig',
                 'En pastisch är alltid mycket kortare än den text den härmar',
                 'En pastisch får bara skrivas av förlagans författare'],
                'En pastisch härmar en stil utan att vilja göra den löjlig',
                'En pastisch kan vara en hyllning eller en lek med en stil. En parodi vill göra förlagan komisk.'),
            sant('En tredjepersonsberättare kan välja att bara visa en enda persons tankar.', True,
                 'Berättaren står utanför och säger han eller hon, men följer en person och vet bara vad den '
                 'personen tänker.'),
            val('Vad kallas det när en text i förväg antyder något som kommer att hända senare?',
                ['förebådande', 'tillbakablick', 'parallellhandling'], 'förebådande',
                'Ett förebådande kan vara en detalj, en dröm eller ett väder som skapar en känsla av vad som ska '
                'komma.'),
            val('Vad är en symbol i en litterär text?',
                ['En konkret sak som också står för något abstrakt',
                 'Ett ord som författaren själv har hittat på för just den boken',
                 'Den mening där handlingen når sin höjdpunkt'],
                'En konkret sak som också står för något abstrakt',
                'Ett tänt ljus kan till exempel stå för hopp. Symbolen får sin betydelse av sammanhanget.'),
        ], beskrivning='Tränar berättartekniska begrepp: in medias res, ramberättelse, opålitlig berättare, '
                       'intertextualitet, allegori, parodi, pastisch, förebådande och symbol.'),

        niva('sv-gy3-litteraturvetenskap-2', 'Läsa med olika perspektiv', 'Litteraturvetenskapliga begrepp', [
            para('Para ihop läsarten med vad den framför allt intresserar sig för.',
                 [('biografisk läsning', 'författarens liv och erfarenheter'),
                  ('genusperspektiv', 'hur kön och könsroller skildras'),
                  ('postkolonialt perspektiv', 'makten mellan kolonisatörer och koloniserade'),
                  ('marxistiskt perspektiv', 'klass, ekonomi och makt'),
                  ('psykoanalytiskt perspektiv', 'det omedvetna och dolda drifter')],
                 'Perspektiven är olika glasögon. Samma text kan visa nya sidor beroende på vilka man tar på sig.'),
            val('Vad betyder det att läsa en text i sin kontext?',
                ['Att koppla texten till tiden och samhället där den skrevs',
                 'Att läsa texten högt för en grupp och samtala om den',
                 'Att jämföra texten med hur den har filmatiserats under senare tid'],
                'Att koppla texten till tiden och samhället där den skrevs',
                'Kontexten är sammanhanget. En roman från 1800-talet blir lättare att förstå om man vet hur '
                'samhället såg ut då.'),
            val('Vad menas med receptionsteori, eller läsarorienterad läsning?',
                ['Att textens mening också skapas av läsaren och läsarens tid',
                 'Att bara författaren själv kan avgöra vad en text egentligen betyder',
                 'Att en text bara har en enda riktig tolkning'],
                'Att textens mening också skapas av läsaren och läsarens tid',
                'Samma bok kan läsas på olika sätt av olika läsare och i olika tider, och det ingår i vad texten '
                'betyder.'),
            val('En analys visar att kvinnorna i en roman bara får vara mödrar och hustrur. Vilket perspektiv '
                'används?',
                ['genusperspektiv', 'biografiskt perspektiv', 'psykoanalytiskt perspektiv'], 'genusperspektiv',
                'Analysen handlar om vilka roller könen får i texten. Det är ett genusperspektiv.'),
            val('En analys kopplar en romans skildring av fattigdom till att författaren själv växte upp fattig. '
                'Vilket perspektiv används?',
                ['biografiskt perspektiv', 'marxistiskt perspektiv', 'postkolonialt perspektiv'],
                'biografiskt perspektiv',
                'Analysen förklarar texten med författarens liv. Ett marxistiskt perspektiv hade i stället frågat '
                'hur texten skildrar klasser och makt.'),
            sant('Samma roman kan läsas med flera olika perspektiv, och de kan ge olika tolkningar.', True,
                 'Perspektiven lyfter fram olika sidor av texten. En bra analys säger vilket perspektiv den använder.'),
            val('Varför menar en del litteraturvetare att den biografiska läsningen har begränsningar?',
                ['Texten kan betyda mer än det författaren själv upplevde',
                 'Det går aldrig att ta reda på något säkert om en författares liv',
                 'Biografiska läsningar får bara göras av släktingar'],
                'Texten kan betyda mer än det författaren själv upplevde',
                'En text kan ha betydelser som författaren inte tänkte på, och berättaren i en roman är inte samma '
                'sak som författaren.'),
            skriv('Vad kallas läsarten där man granskar texten noggrant ord för ord, utan att ta hänsyn till '
                  'författaren eller tiden? Skriv ordet.',
                  ['närläsning', 'en närläsning', 'nykritik', 'nykritiken', 'close reading', 'new criticism'],
                  'Nykritiken ville att texten skulle analyseras för sig själv, genom närläsning av ord, bilder och '
                  'form.'),
            val('En analys av en äventyrsroman från 1800-talet visar hur de europeiska huvudpersonerna framställs som '
                'civiliserade och de inhemska folken som vilda. Vilket perspektiv används?',
                ['postkolonialt perspektiv', 'marxistiskt perspektiv', 'psykoanalytiskt perspektiv'],
                'postkolonialt perspektiv',
                'Ett postkolonialt perspektiv undersöker hur makten mellan kolonisatörer och koloniserade syns i '
                'texten.'),
            val('Vad är viktigast i en litteraturanalys, oavsett perspektiv?',
                ['Att tolkningen stöds med exempel ur texten',
                 'Att man håller med författarens åsikter',
                 'Att man återberättar hela handlingen i rätt ordning'],
                'Att tolkningen stöds med exempel ur texten',
                'En tolkning blir trovärdig när den bygger på det som faktiskt står. Ett återberättande är ingen '
                'analys.'),
        ], beskrivning='Tränar litteraturvetenskapliga läsarter: biografisk, genus, postkolonial, marxistisk och '
                       'psykoanalytisk läsning, kontext, receptionsteori och närläsning.'),

        niva('sv-gy3-satslara-1', 'Predikativ, agent och formellt subjekt', 'Satslära', [
            val('Vilken satsdel är ”trött” i ”Hon blev trött efter matchen.”?',
                ['predikativ', 'direkt objekt', 'adverbial'], 'predikativ',
                'Trött säger något om subjektet hon, genom verbet blev. En sådan satsdel kallas predikativ, eller '
                'subjektspredikativ.'),
            val('Vilken satsdel är ”en duktig snickare” i ”Min morbror är en duktig snickare.”?',
                ['predikativ', 'direkt objekt', 'subjekt'], 'predikativ',
                'Morbror och snickare är samma person: ordet beskriver subjektet. Ett objekt är däremot något annat '
                'än subjektet, som i ”Min morbror anlitade en snickare”.'),
            sant('I meningen ”Vi målade staketet vitt.” är ”vitt” ett predikativ som säger något om objektet.', True,
                 'Vitt beskriver staketet, som är objekt. Det kallas objektspredikativ.'),
            val('Vilket är det formella subjektet i ”Det står en cykel utanför dörren.”?',
                ['Det', 'en cykel', 'utanför dörren'], 'Det',
                'Det fyller subjektets plats men betyder inget eget. Det som verkligen står där, en cykel, är det '
                'egentliga subjektet.'),
            skriv('Skriv det egentliga subjektet i meningen: ”Det satt en fågel på taket.”',
                  ['en fågel', 'fågel'],
                  'Vad satt på taket? En fågel. Det är bara ett formellt subjekt.'),
            val('Vilken satsdel är ”av en elev i nian” i ”Brevet skrevs av en elev i nian.”?',
                ['agent', 'indirekt objekt', 'predikativ'], 'agent',
                'I en passiv sats visar agenten vem som utför handlingen. I aktiv form blir den subjekt: En elev i '
                'nian skrev brevet.'),
            para('Para ihop delen av meningen ”Hela klassen tyckte att filmen var spännande.” med satsdelen.',
                 [('Hela klassen', 'subjekt'), ('tyckte', 'predikat'),
                  ('att filmen var spännande', 'objekt'), ('spännande, inne i bisatsen', 'predikativ')],
                 'Vad tyckte klassen? Att filmen var spännande: hela bisatsen är objekt. Inne i bisatsen beskriver '
                 'spännande subjektet filmen.'),
            val('Vilken mening har ett objektspredikativ?',
                ['Nyheten gjorde alla glada.', 'Nyheten kom i går kväll.', 'Alla blev glada av nyheten.'],
                'Nyheten gjorde alla glada.',
                'Glada beskriver objektet alla. I ”Alla blev glada” beskriver glada subjektet, och då är det ett '
                'subjektspredikativ.'),
            val('Vilka verb tar ofta ett subjektspredikativ?',
                ['vara, bli och heta', 'springa, äta och sova', 'ge, visa och skicka'], 'vara, bli och heta',
                'Hon är lärare, han blev kapten, hunden heter Sixten. Verb som ge och visa tar i stället ofta ett '
                'indirekt objekt.'),
        ], beskrivning='Tränar subjekts- och objektspredikativ, formellt och egentligt subjekt, agent i passiv '
                       'form och en bisats som satsdel.'),

        niva('sv-gy3-satslara-2', 'Ordföljd och fundament', 'Satslära', [
            val('Vad menas med att svenskan är ett V2-språk?',
                ['Det finita verbet står på andra plats i en huvudsats',
                 'Varje mening måste innehålla minst två verb i olika former',
                 'Subjektet står alltid på andra plats i meningen'],
                'Det finita verbet står på andra plats i en huvudsats',
                'Bara en satsdel får stå före det finita verbet i ett påstående. Därför heter det ”I dag har vi '
                'prov” och inte ”I dag vi har prov”.'),
            skriv('Vad kallas platsen före det finita verbet i en huvudsats, där till exempel subjektet eller ett '
                  'adverbial kan stå? Skriv ordet.',
                  ['fundament', 'fundamentet', 'fundamentfältet', 'ett fundament'],
                  'Fundamentet rymmer en satsdel. Ofta är det subjektet, men det kan också vara ett adverbial eller '
                  'ett objekt.'),
            val('Vilken mening har omvänd ordföljd, med subjektet efter det finita verbet?',
                ['I dag skriver vi prov i svenska.', 'Vi skriver prov i svenska i dag.',
                 'Vi skriver i dag prov i svenska.'],
                'I dag skriver vi prov i svenska.',
                'När ett adverbial står först hamnar subjektet vi efter det finita verbet skriver.'),
            val('Vilket ord är satsadverbial i ”Hon har kanske glömt mötet.”?',
                ['kanske', 'glömt', 'mötet'], 'kanske',
                'Ett satsadverbial säger något om hela satsen, som inte, kanske, aldrig och tyvärr.'),
            val('Var står satsadverbialet ”inte” i en huvudsats som börjar med subjektet?',
                ['Efter det finita verbet: Hon kommer inte.', 'Före det finita verbet: Hon inte kommer.',
                 'Allra först: Inte hon kommer.'],
                'Efter det finita verbet: Hon kommer inte.',
                'I en huvudsats står satsadverbialet efter det finita verbet, och oftast efter subjektet när '
                'subjektet står efter verbet: I dag kommer hon inte.'),
            ordna('Bygg meningen så att den börjar med ”På lördag”.',
                  ['På', 'lördag', 'spelar', 'laget', 'final.'],
                  forklaring='På lördag står i fundamentet. Då kommer det finita verbet spelar direkt efter, och '
                             'subjektet laget efter det.'),
            sant('I en bisats står subjektet alltid efter det finita verbet.', False,
                 'I en vanlig bisats står subjektet före det finita verbet: att laget spelar final. Omvänd ordföljd '
                 'hör framför allt till huvudsatserna.'),
            val('Vilket är det finita verbet i ”I dag har läraren inte rättat proven.”?',
                ['har', 'rättat', 'läraren'], 'har',
                'Det finita verbet är tidsböjt, här i presens. Rättat är supinum, en infinit form.'),
            para('Para ihop verbet i ”Hon har velat läsa boken.” med vad formen kallas.',
                 [('har', 'finit verb i presens'), ('velat', 'supinum'), ('läsa', 'infinitiv')],
                 'Bara ett verb i satsen är finit, har. De andra två är infinita: velat är supinum och läsa '
                 'infinitiv.'),
            val('Vilken mening har det finita verbet allra först?',
                ['Kommer du i kväll?', 'Du kommer i kväll.', 'I kväll kommer du.'], 'Kommer du i kväll?',
                'I en ja- eller nej-fråga står det finita verbet först, och fundamentet är tomt. Samma sak gäller '
                'uppmaningar som ”Kom hit!”.'),
        ], beskrivning='Tränar V2-regeln, fundamentet, rak och omvänd ordföljd, satsadverbialets plats och '
                       'finita och infinita verbformer.'),
    ]),
]
