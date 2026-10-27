# -*- coding: utf-8 -*-
"""Fortsättningen i svenska för åk 8 och åk 9 (2026-10-27): tre nya områden
i varje bana, med två nivåer vardera, sist i banorna.

Leo: "Nexläx där ska vi lägga in flera uppgifter, i matte svenska och
engelska årkurs 6 och uppåt."

- åk 8: ”Berättartekniker” (berättarperspektiv och gestaltning; tiden i
  berättelsen, tema och budskap), ”Litterära genrer” (epik, lyrik och
  dramatik; undergenrer som deckare, fantasy och dystopi) och ”Nyhetstext
  och referat” (nyhetsartikelns delar; referat, citat och källhänvisning).
- åk 9: ”Litteraturhistoria” (antiken och medeltiden; från renässansen till
  modernismen), ”Språkriktighet” (ligga och lägga, att och och, genitiv;
  kongruens, dubbel supinum och prepositioner) och ”Tala inför publik”
  (planera ett tal; framföra och övertyga).

Allt står i TILLAGG och läggs sist i banorna (svenska.py och
svenska_mer.py). Ingen nivå har en lästext: varje fråga står för sig med
sitt eget korta exempel, så att alla sex områdena får ett Mästarprov
(verktyget räknar bara nivåer utan lästext), och banorna har redan åtta
nivåer med lästext i åk 8 och tio i åk 9.

Skrivet från grunden mot Lgr22:s centrala innehåll i svenska 7–9. Alla
exempel, personer och repliker är påhittade för banken; inget är taget ur
ett nationellt prov, en lärobok eller skönlitteratur. Verken och
författarna i litteraturhistorien är bara namngivna, aldrig citerade, och
alla är döda sedan länge. Texten är skriven med AI och inte läst av någon
som undervisar i ämnet.

Samma regler som i svenska.py och fler_svenska_hog.py:

- Rättningen struntar i stora och små bokstäver och i punkt sist, så stor
  bokstav och skiljetecken frågas som val eller ordna, aldrig som skriv.
- En ordna-fråga har bara en rimlig ordning: första brickan med stor
  bokstav, sista med punkten, och kommat sitter på sin bricka.
- Det lärare inte är ense om frågas inte.
- Alla frågor förstås utan att man har sett en annan fråga.

Förenklat, med flit:
- Berättarna är tre: jag-berättare, allvetande berättare och en
  tredjepersonsberättare som följer en person. Ordet ”personbunden” och
  den opålitliga berättaren frågas inte, för läromedlen använder dem olika.
- Tema är vad texten handlar om på djupet, budskap vad den vill säga om
  det. Motiv frågas inte: gränsen mot tema dras olika.
- I lyriken frågas strof och rim, inte vers, som betyder både en rad och
  (i sånger) en strof.
- Litteraturhistorien har årtal bara där de är kända och säkra (Röda
  rummet och Ett dockhem 1879, boktryckarkonsten i mitten av 1400-talet).
  Homeros sägs ha diktat eposen ”tillskrivs”, för ingen vet säkert.
- Språkriktigheten följer normen för vårdad skrift. Lade och la godtas
  båda och ställs aldrig mot varandra. Var och vart med lägga och ställa,
  beroende av och på, än jag och än mig, ”pannkakor är gott” och komma
  efter en inledande bisats frågas inte.
- Talet har inledning, huvuddel och avslutning. Retorikens arbetsgång
  frågas inte, för stegen räknas olika; ethos, pathos och logos står i
  området Argumentation.
"""
from grund import bana, niva, val, skriv, ordna, sant, para

SV = 'Svenska'


TILLAGG = [
    # ================================================================
    # ÅRSKURS 8
    # ================================================================
    bana(SV, 'ak8', [
        niva('sv-ak8-berattarteknik-1', 'Vem berättar?', 'Berättartekniker', [
            para('Para ihop berättaren med vad den kännetecknas av.',
                 [('jag-berättare', 'är själv med i handlingen och säger jag'),
                  ('allvetande berättare', 'står utanför och kan gå in i alla personers tankar'),
                  ('tredjepersonsberättare som följer en person', 'står utanför men vet bara vad en person tänker')],
                 'Jag-berättaren är en av personerna. Den allvetande berättaren står utanför och vet allt. En '
                 'berättare som följer en person står också utanför, men ser bara det som den personen ser och '
                 'tänker.'),
            val('”Lina trodde att Omar var arg på henne. Omar tänkte inte alls på Lina, han oroade sig för '
                'matteprovet.” Vilken sorts berättare är det?',
                ['en allvetande berättare', 'en jag-berättare', 'en berättare som bara följer Lina'],
                'en allvetande berättare',
                'Berättaren vet vad både Lina och Omar tänker. En berättare som kan gå in i flera personers '
                'tankar är allvetande. En som bara följde Lina hade inte vetat vad Omar tänkte.'),
            val('”Jag visste att jag borde säga förlåt, men orden fastnade i halsen.” Vilken sorts berättare är det?',
                ['en jag-berättare', 'en allvetande berättare', 'en tredjepersonsberättare'],
                'en jag-berättare',
                'Berättaren säger jag och berättar om sina egna tankar. Det är en jag-berättare.'),
            val('Varför skriver en jag-berättare ofta ”jag tror” eller ”hon såg ut att” om de andra personerna?',
                ['Jaget kan inte se in i någon annans tankar', 'Jaget vet alltid mer än alla andra i berättelsen',
                 'Det är en regel för alla texter i jagform'],
                'Jaget kan inte se in i någon annans tankar',
                'Jag-berättaren är en av personerna och ser världen inifrån sig själv. Vad andra tänker kan jaget '
                'bara gissa, och därför skriver jaget vad det tror eller ser.'),
            skriv('Skriv ordet som fattas: En berättare som står utanför handlingen och vet vad alla personer '
                  'tänker och känner kallas en … berättare.',
                  ['allvetande', 'en allvetande', 'allvetande berättare', 'en allvetande berättare'],
                  'Den allvetande berättaren står över allt som händer och kan berätta vad varje person tänker.'),
            val('Vilken mening gestaltar att Ella är nervös, i stället för att säga det rakt ut?',
                ['Ella torkade händerna mot byxorna och svalde.', 'Ella var mycket nervös inför sitt framträdande.',
                 'Ella skulle uppträda klockan tre på eftermiddagen.'],
                'Ella torkade händerna mot byxorna och svalde.',
                'Att gestalta är att visa en känsla genom vad personen gör, så att läsaren själv förstår. Att torka '
                'händerna, som om de var svettiga, och att svälja är tecken på nervositet. Meningen med ordet '
                'nervös säger känslan rakt ut.'),
            sant('Att gestalta betyder att visa till exempel en känsla genom handlingar och detaljer i stället för '
                 'att skriva ut den.', True,
                 'I stället för ”Han var arg” skriver man till exempel ”Han smällde igen dörren”. Läsaren får '
                 'själv förstå känslan.'),
            val('Vad kallas det när berättaren säger rakt ut hur en person är, som i ”Max var modig”?',
                ['direkt personbeskrivning', 'indirekt personbeskrivning', 'tillbakablick'],
                'direkt personbeskrivning',
                'I en direkt personbeskrivning säger berättaren hur personen är. I en indirekt får läsaren förstå '
                'det genom vad personen gör och säger.'),
            val('”Ali delade sin sista smörgås med den nya killen, fast han själv var hungrig.” Vad får läsaren '
                'veta om Ali?',
                ['Att han är omtänksam', 'Att han är snål', 'Att han är feg'],
                'Att han är omtänksam',
                'Berättaren säger inte vad Ali är för person, men det han gör visar det. Det är en indirekt '
                'personbeskrivning.'),
            ordna('Gör om meningen ”Hon öppnade dörren försiktigt.” så att den får en jag-berättare. En bricka '
                  'ska inte vara med.',
                  ['Jag', 'öppnade', 'dörren', 'försiktigt.'], extra=['Hon'],
                  forklaring='En jag-berättare berättar om sig själv i första person, med jag. Hon hör till en '
                             'tredjepersonsberättare.'),
        ], beskrivning='Tränar berättarperspektiv: jag-berättare, allvetande berättare och en berättare som följer '
                       'en person, och att gestalta i stället för att säga rakt ut.'),

        niva('sv-ak8-berattarteknik-2', 'Tid och tema i berättelsen', 'Berättartekniker', [
            para('Para ihop berättartekniken med vad den betyder.',
                 [('kronologisk berättelse', 'händelserna berättas i den ordning de sker'),
                  ('tillbakablick', 'berättelsen går tillbaka till något som hänt tidigare'),
                  ('framåtblick', 'berättaren antyder något som ska hända senare'),
                  ('in medias res', 'berättelsen börjar mitt i en händelse'),
                  ('parallellhandling', 'två handlingar berättas växelvis')],
                 'Författaren väljer hur tiden ska gå i en berättelse. Den kan gå rakt fram, hoppa bakåt eller '
                 'framåt, börja mitt i allt eller följa två handlingar på en gång.'),
            val('”Hon visste inte då att det var sista gången hon skulle se sin morfar.” Vilken berättarteknik '
                'används?',
                ['framåtblick', 'tillbakablick', 'in medias res'], 'framåtblick',
                'Berättaren vet vad som händer senare och antyder det redan nu. Det kallas framåtblick, och det '
                'gör läsaren nyfiken på vad som ska hända.'),
            val('En berättelse börjar så här: ”– Spring! skrek Moa, och vi rusade ut ur källaren.” Vilken teknik '
                'har författaren använt?',
                ['in medias res', 'framåtblick', 'ramberättelse'], 'in medias res',
                'Läsaren kastas rakt in i en händelse utan förklaring. Det kallas in medias res, latin för '
                '”mitt i sakerna”.'),
            skriv('Vad kallas det när en berättelse gör ett avbrott för att berätta om något som hände tidigare? '
                  'Skriv ordet.',
                  ['tillbakablick', 'tillbakablicken', 'en tillbakablick', 'tillbakablickar', 'återblick', 'återblicken',
                   'en återblick', 'flashback', 'flashbacken'],
                  'I en tillbakablick går berättelsen bakåt i tiden, till exempel när en person minns något.'),
            val('En roman berättar växelvis om Sara i Göteborg och om hennes bror i Kiruna under samma vecka. '
                'Vad kallas det?',
                ['parallellhandling', 'tillbakablick', 'framåtblick'], 'parallellhandling',
                'Två handlingar pågår samtidigt och berättas omväxlande. Det är en parallellhandling.'),
            val('I en roman sitter en gammal man och berättar för sitt barnbarn om sin ungdom, och det mesta av '
                'boken är hans berättelse. Vad kallas berättelsen om mannen och barnbarnet?',
                ['en ramberättelse', 'en parallellhandling', 'ett öppet slut'], 'en ramberättelse',
                'Ramberättelsen omger en annan berättelse, som en ram runt en tavla. Sagosamlingen Tusen och en '
                'natt är byggd så.'),
            val('En novell handlar om två bästa vänner. Den ena flyttar långt bort, men de håller kontakten trots '
                'allt. Vilket är novellens tema?',
                ['vänskap', 'flytten till en ny stad', 'tågresan till den nya staden'], 'vänskap',
                'Temat är vad texten handlar om på djupet, ofta ett ord som vänskap, svek eller ensamhet. Flytten '
                'och resan är delar av handlingen.'),
            val('Vilket av dessa är ett budskap och inte ett tema?',
                ['Sann vänskap klarar långa avstånd.', 'Vänskap', 'Ensamhet'],
                'Sann vänskap klarar långa avstånd.',
                'Temat är vad texten handlar om, till exempel vänskap. Budskapet är vad texten vill säga om temat, '
                'och det går att skriva som en hel mening.'),
            sant('En berättelse som börjar med slutet och sedan berättar hur det gick till är kronologisk.', False,
                 'Kronologisk betyder i den ordning det hände. Börjar texten med slutet är ordningen bruten, och '
                 'resten blir en lång tillbakablick.'),
            ordna('Novellen börjar när Nils står på perrongen med sin väska. Sedan minns han kvällen då han '
                  'bestämde sig för att flytta, och sedan grälet med pappa veckan före den kvällen. Den slutar med '
                  'att tåget går. Ordna händelserna i den ordning de faktiskt hände.',
                  ['Grälet med pappa', 'Kvällen då Nils bestämmer sig', 'Nils står på perrongen', 'Tåget går'],
                  forklaring='Novellen börjar på perrongen och går sedan tillbaka i tiden. Först kom grälet, sedan '
                             'beslutet, därefter perrongen och sist tåget.'),
        ], beskrivning='Tränar hur en berättelse hanterar tiden: kronologiskt, tillbakablick, framåtblick, in '
                       'medias res, parallellhandling och ramberättelse, och skillnaden mellan handling, tema och '
                       'budskap.'),

        niva('sv-ak8-genrer-1', 'Epik, lyrik och dramatik', 'Litterära genrer', [
            para('Para ihop huvudgenren med vad den är.',
                 [('epik', 'berättande texter, som romaner och noveller'),
                  ('lyrik', 'dikter, ofta med rytm och bilder'),
                  ('dramatik', 'texter skrivna för att spelas upp, som pjäser')],
                 'Skönlitteraturen brukar delas in i tre huvudgenrer: epik som berättar, lyrik som är dikter och '
                 'dramatik som spelas upp.'),
            val('Vilken huvudgenre hör en novell till?', ['epik', 'lyrik', 'dramatik'], 'epik',
                'En novell berättar en historia, och berättande texter hör till epiken, liksom romaner och sagor.'),
            val('Vad skiljer oftast en novell från en roman?',
                ['Novellen är kortare och har färre personer', 'Novellen är skriven på vers och rimmar',
                 'Novellen har alltid ett lyckligt slut'],
                'Novellen är kortare och har färre personer',
                'En novell är en kort berättelse, ofta om en enda händelse. En roman är längre och har plats för '
                'fler personer och händelser.'),
            skriv('Vad kallas en grupp rader i en dikt, som ett stycke i en vanlig text? Skriv ordet.',
                  ['strof', 'strofer', 'stroferna', 'strofen', 'en strof'],
                  'En dikt består av rader, och raderna kan bilda strofer. Mellan stroferna brukar det vara en tom rad. '
                  'I sånger säger man ofta vers om en strof, men i en dikt kallas en enskild rad vers.'),
            val('Vilka två ord rimmar i raderna ”Jag går ut i den kalla natten, / där isen ligger blank på '
                'vatten.”?',
                ['natten och vatten', 'kalla och blank', 'går och ligger'], 'natten och vatten',
                'Natten och vatten låter lika från den betonade vokalen och framåt, och de står sist på raderna. '
                'Det kallas slutrim.'),
            val('I en pjäs står det: ”(Elin går fram till fönstret och drar för gardinen.)” Vad kallas en sådan '
                'rad?',
                ['en scenanvisning', 'en replik', 'en strof'], 'en scenanvisning',
                'En scenanvisning säger vad skådespelarna gör eller hur scenen ser ut. Det personerna säger kallas '
                'repliker.'),
            val('Vad kallas det när en person i en pjäs talar ensam en lång stund, utan att någon svarar?',
                ['monolog', 'dialog', 'scenanvisning'], 'monolog',
                'En monolog är ett tal av en enda person. En dialog är ett samtal mellan två eller fler.'),
            val('En pjäs ska få publiken att skratta, och den slutar lyckligt. Vilken sorts pjäs är det troligen?',
                ['en komedi', 'en tragedi', 'en monolog'], 'en komedi',
                'En komedi ska roa och slutar väl. I en tragedi går det illa för huvudpersonen.'),
            sant('En dikt måste rimma för att räknas som lyrik.', False,
                 'Många dikter rimmar inte. En dikt utan rim och utan fast rytm kallas fri vers, och den är också '
                 'lyrik.'),
            val('Vilken av texterna hör till lyriken?',
                ['en kort dikt om havet', 'en roman på trehundra sidor', 'en pjäs i tre akter'],
                'en kort dikt om havet',
                'Dikter hör till lyriken, hur korta de än är. Romanen är epik och pjäsen dramatik.'),
        ], beskrivning='Tränar de tre huvudgenrerna epik, lyrik och dramatik, och ord som novell, roman, strof, '
                       'rim, scenanvisning och monolog.'),

        niva('sv-ak8-genrer-2', 'Deckare, fantasy och andra undergenrer', 'Litterära genrer', [
            para('Para ihop undergenren med ett typiskt drag.',
                 [('deckare', 'ett brott ska lösas med hjälp av ledtrådar'),
                  ('fantasy', 'magi och en påhittad värld'),
                  ('science fiction', 'framtiden, rymden eller ny teknik'),
                  ('skräck', 'texten vill skrämma läsaren'),
                  ('historisk roman', 'handlingen utspelar sig i en verklig tid som har varit')],
                 'Varje undergenre har drag som läsaren känner igen. De dragen kallas ibland genrens regler.'),
            val('En berättelse utspelar sig i ett framtida land där makten övervakar alla och ingen får tänka '
                'fritt. Vilken genre är det?',
                ['dystopi', 'utopi', 'fabel'], 'dystopi',
                'En dystopi skildrar ett skrämmande samhälle, ofta i framtiden. Den varnar för vad som kan hända.'),
            skriv('Vad kallas en berättelse om ett påhittat samhälle där allt är så bra som det kan bli? Skriv ordet.',
                  ['utopi', 'utopin', 'en utopi', 'utopier'],
                  'En utopi är ett drömsamhälle. Motsatsen, ett mardrömssamhälle, är en dystopi.'),
            val('Vad kännetecknar en fabel?',
                ['Djur som talar, och en lärdom på slutet', 'En detektiv som löser ett mord i en storstad',
                 'Rymdskepp och robotar i en avlägsen framtid'],
                'Djur som talar, och en lärdom på slutet',
                'I en fabel beter sig djur som människor, och berättelsen slutar med en sensmoral, en lärdom som '
                'läsaren ska ta med sig.'),
            sant('Science fiction och fantasy är samma genre.', False,
                 'Science fiction bygger på vetenskap och teknik, ofta i framtiden. Fantasy bygger på magi och '
                 'påhittade världar. Ibland blandas de, men det är två genrer.'),
            val('Vad kallas ett falskt spår som ska lura läsaren i en deckare?',
                ['ett villospår', 'en ledtråd', 'ett alibi'], 'ett villospår',
                'Ett villospår leder läsaren åt fel håll, så att lösningen blir en överraskning. En ledtråd hjälper '
                'till att lösa fallet, och ett alibi visar att någon var på en annan plats.'),
            val('En roman handlar om en flicka på 1600-talet som arbetar på ett gods, och allt som händer skulle '
                'kunna ha hänt på riktigt. Vilken genre passar bäst?',
                ['historisk roman', 'science fiction', 'fantasy'], 'historisk roman',
                'Handlingen utspelar sig i en verklig tid som har varit, utan magi eller framtidsteknik. Det är en '
                'historisk roman.'),
            val('Vad menas med en genre?',
                ['En grupp texter med gemensamma drag', 'Den som berättar historien i en text',
                 'Den sista delen av en berättelse'],
                'En grupp texter med gemensamma drag',
                'Ordet genre betyder sort. Texter i samma genre liknar varandra i innehåll, form eller syfte.'),
            sant('En självbiografi är en text där en person berättar om sitt eget liv.', True,
                 'Själv betyder att personen skriver om sig själv. En biografi är skriven av någon annan.'),
            para('Para ihop boken med dess genre.',
                 [('Sagan om ringen av J.R.R. Tolkien', 'fantasy'),
                  ('1984 av George Orwell', 'dystopi'),
                  ('berättelserna om Sherlock Holmes av Arthur Conan Doyle', 'deckare')],
                 'Sagan om ringen utspelar sig i en påhittad värld med magi. 1984 skildrar ett samhälle där alla '
                 'övervakas. Sherlock Holmes är en detektiv som löser brott med ledtrådar.'),
        ], beskrivning='Tränar att känna igen undergenrer som deckare, fantasy, science fiction, dystopi, '
                       'historisk roman och fabel på deras typiska drag.'),

        niva('sv-ak8-nyhetstext-1', 'Nyhetsartikelns delar', 'Nyhetstext och referat', [
            para('Para ihop delen av nyhetsartikeln med vad den är.',
                 [('rubrik', 'den korta, stora texten överst som väcker intresse'),
                  ('ingress', 'en kort sammanfattning av det viktigaste efter rubriken'),
                  ('brödtext', 'själva artikeln, med detaljer, fakta och citat'),
                  ('bildtext', 'en kort text som förklarar bilden'),
                  ('mellanrubrik', 'en liten rubrik som delar upp en lång text')],
                 'Delarna hjälper läsaren: rubriken lockar, ingressen sammanfattar, brödtexten berättar mer och '
                 'mellanrubrikerna gör en lång text lättare att läsa.'),
            ordna('Ordna delarna i den ordning de står i en nyhetsartikel.',
                  ['rubrik', 'ingress', 'brödtext'],
                  forklaring='Först rubriken, sedan ingressen som sammanfattar och sist brödtexten med detaljerna.'),
            val('Vad kallas modellen där det viktigaste står först i en nyhetsartikel och detaljerna sist?',
                ['nyhetspyramiden', 'tidslinjen', 'spänningskurvan'], 'nyhetspyramiden',
                'Nyhetspyramiden kallas också den omvända pyramiden: den breda, viktigaste delen står överst. '
                'En spänningskurva hör till berättelser, där det mest spännande kommer senare.'),
            val('Varför står det viktigaste först i en nyhetsartikel?',
                ['Den som bara läser början ska förstå nyheten', 'Journalisten skriver i den ordning saker hände',
                 'Slutet av en artikel läses aldrig av någon'],
                'Den som bara läser början ska förstå nyheten',
                'Många läser bara rubriken och ingressen. Då måste det viktigaste stå där, och detaljerna kan '
                'komma senare.'),
            val('Vilka frågor ska en nyhet helst ge svar på?',
                ['Vad, vem, var, när, hur och varför', 'Vad journalisten tycker om saken',
                 'Hur läsaren ska rösta i nästa val'],
                'Vad, vem, var, när, hur och varför',
                'En bra nyhet berättar vad som hänt, vem det gäller, var och när det hände, hur det gick till och '
                'varför.'),
            sant('I en nyhetsartikel ska journalisten skriva vad hen själv tycker om det som har hänt.', False,
                 'En nyhet ska vara saklig och berätta vad som har hänt. Åsikter hör till andra texter, som '
                 'krönikor, ledare och debattartiklar.'),
            val('Vilken av texterna i en tidning är en åsiktstext?',
                ['en ledare', 'en nyhetsartikel', 'en väderprognos'], 'en ledare',
                'På ledarsidan skriver tidningen vad den tycker. En nyhetsartikel och en väderprognos ska bara '
                'informera.'),
            val('Vad är ett citat i en nyhetsartikel?',
                ['Någons exakta ord inom citattecken', 'Journalistens egen sammanfattning av nyheten',
                 'En förklaring som står under en bild'],
                'Någons exakta ord inom citattecken',
                'Ett citat återger ordagrant vad någon har sagt eller skrivit. Citattecknen visar var orden börjar '
                'och slutar.'),
            val('Vilken rubrik passar bäst för en saklig nyhetsartikel?',
                ['Ny cykelbana byggs längs ån i vår', 'Äntligen! Den bästa cykelbanan någonsin',
                 'Varför bryr sig ingen om oss cyklister?'],
                'Ny cykelbana byggs längs ån i vår',
                'Rubriken säger vad som händer, var och när, utan att tycka något. De andra är värderande eller '
                'ställer en fråga för att väcka känslor.'),
            val('Vad kallas en person som journalisten har intervjuat och fått uppgifter av?',
                ['en källa', 'en målgrupp', 'en avsändare'], 'en källa',
                'Källorna är de personer och dokument som uppgifterna i artikeln kommer ifrån. En nyhet bör helst '
                'bygga på mer än en källa.'),
        ], beskrivning='Tränar hur en nyhetsartikel är byggd: rubrik, ingress, brödtext och bildtext, '
                       'nyhetspyramiden, frågorna en nyhet svarar på och skillnaden mot en åsiktstext.'),

        niva('sv-ak8-nyhetstext-2', 'Referat och citat', 'Nyhetstext och referat', [
            val('Vad gör du när du skriver ett referat av en artikel?',
                ['Återger innehållet med egna ord', 'Skriver av texten ord för ord',
                 'Skriver vad du tycker om texten'],
                'Återger innehållet med egna ord',
                'Ett referat återger vad någon annan har skrivit, med dina egna ord och utan dina egna åsikter.'),
            val('Vilken mening visar tydligast att skribenten återger någon annans tankar?',
                ['Enligt Ada Berg sover unga för lite.', 'Unga sover för lite, det vet alla.',
                 'Jag tycker att unga sover för lite.'],
                'Enligt Ada Berg sover unga för lite.',
                'Ordet enligt är en referatmarkör. Den visar att tanken är Ada Bergs och inte skribentens egen.'),
            para('Para ihop ordet med vad det betyder.',
                 [('referat', 'att återge en text med egna ord'),
                  ('citat', 'någons exakta ord inom citattecken'),
                  ('källhänvisning', 'uppgift om var informationen kommer ifrån'),
                  ('plagiat', 'att lämna in någon annans text som sin egen')],
                 'Referat och citat är rätt sätt att använda andras text, och källhänvisningen visar var den kommer '
                 'ifrån. Plagiat är fusk.'),
            val('Vilken mening har ett rätt skrivet citat?',
                ['Rektorn sa: ”Vi bygger om matsalen i vår.”', 'Rektorn sa: Vi bygger om matsalen i vår.',
                 'Rektorn sa ”att vi bygger om matsalen i vår.”'],
                'Rektorn sa: ”Vi bygger om matsalen i vår.”',
                'Ett citat står inom citattecken, ofta efter ett kolon. Med ”att” blir det ett referat, och då ska '
                'citattecknen bort.'),
            val('Moa säger: ”Jag har tappat min mobil.” Hur återger du det i ett referat?',
                ['Moa säger att hon har tappat sin mobil.', 'Moa säger att jag har tappat min mobil.',
                 'Moa säger att hon har tappat hennes mobil.'],
                'Moa säger att hon har tappat sin mobil.',
                'I ett referat blir Moas jag till hon. Mobilen är hennes egen, och då heter det sin. Hennes mobil '
                'skulle betyda en annan persons mobil.'),
            sant('Om du återger någon annans tankar med egna ord behöver du inte ange källan.', False,
                 'Tankarna är fortfarande någon annans, även om orden är dina. Därför anger du källan både när du '
                 'citerar och när du refererar.'),
            val('Vilken uppgift hör INTE hemma i en källhänvisning till en artikel?',
                ['vad du tyckte om artikeln', 'vem som skrev artikeln', 'var och när den publicerades'],
                'vad du tyckte om artikeln',
                'Källhänvisningen ska hjälpa läsaren att hitta källan: vem som skrev den, vad den heter och var och '
                'när den kom ut. Din åsikt hör inte dit.'),
            skriv('Skriv den referatmarkör som fattas: ”… artikeln har antalet cyklister i staden ökat.”',
                  ['enligt'],
                  'Enligt artikeln visar att uppgiften kommer från artikeln och inte från skribenten själv.'),
            val('Vad ska du ta med i ett kort referat?',
                ['Huvudtankarna i texten', 'Alla exempel och detaljer i texten', 'Dina egna slutsatser om ämnet'],
                'Huvudtankarna i texten',
                'Ett kort referat tar med det viktigaste. Detaljer och egna slutsatser gör referatet längre utan att '
                'göra det bättre.'),
            ordna('Bygg en mening som refererar vad en skribent tycker.',
                  ['Skribenten', 'menar', 'att', 'skolan', 'behöver', 'fler', 'lärare.'],
                  forklaring='Menar är en referatmarkör, och efter att kommer det skribenten tycker. Ordföljden är '
                             'som i en vanlig att-sats: skolan behöver fler lärare.'),
        ], beskrivning='Tränar att återge andras text: referat med egna ord och referatmarkörer, citat inom '
                       'citattecken, källhänvisning och varför plagiat är fel.'),
    ]),

    # ================================================================
    # ÅRSKURS 9
    # ================================================================
    bana(SV, 'ak9', [
        niva('sv-ak9-litteraturhistoria-1', 'Antiken och medeltiden', 'Litteraturhistoria', [
            val('Vilka två epos från antikens Grekland tillskrivs Homeros?',
                ['Iliaden och Odysséen', 'Eddan och Beowulf', 'Hamlet och Macbeth'], 'Iliaden och Odysséen',
                'Iliaden och Odysséen är två av de äldsta verken i europeisk litteratur. Eddan är isländsk, Beowulf '
                'engelsk från medeltiden, och Hamlet och Macbeth är pjäser av Shakespeare.'),
            sant('Odysséen handlar om Odysseus långa resa hem efter det trojanska kriget.', True,
                 'Odysseus är på väg hem till Ithaka och möter många faror på vägen. Därför kallas en lång och '
                 'äventyrlig resa ibland en odyssé.'),
            skriv('Vad kallas en lång berättande dikt om hjältar och gudar, som Iliaden? Skriv ordet.',
                  ['epos', 'ett epos', 'eposet', 'hjälteepos', 'ett hjälteepos', 'hjältedikt'],
                  'Ett epos är en lång berättelse på vers. De äldsta eposen berättades muntligt innan de skrevs ner.'),
            val('Vilka två sorters teaterpjäser kommer från antikens Grekland?',
                ['tragedi och komedi', 'musikal och opera', 'deckare och fantasy'], 'tragedi och komedi',
                'I antikens Aten spelades tragedier och komedier vid stora fester. Orden används än i dag.'),
            val('Hur fördes många av de äldsta berättelserna vidare innan de skrevs ner?',
                ['Muntligt, från person till person', 'I tryckta böcker och tidningar',
                 'Genom brev mellan kungar och präster'],
                'Muntligt, från person till person',
                'Långt innan böcker trycktes berättades och sjöngs historierna, och de lärdes ut från en '
                'generation till nästa.'),
            val('Vilket språk skrev de lärda i Europa oftast på under medeltiden?',
                ['latin', 'engelska', 'svenska'], 'latin',
                'Latin var kyrkans och de lärdas språk. Därför skrevs mycket på latin, också i Sverige.'),
            val('Vad skildrar Den gudomliga komedin av Dante?',
                ['En resa genom helvetet, skärselden och paradiset', 'Två unga älskande från fiendesläkter i Verona',
                 'En man som tror att han är riddare och slåss mot väderkvarnar'],
                'En resa genom helvetet, skärselden och paradiset',
                'Dante skrev verket på italienska i början av 1300-talet. De älskande i Verona är Romeo och Julia, '
                'och riddaren är Don Quijote.'),
            val('Vad är en folkvisa?',
                ['En gammal sång som spreds muntligt', 'En sång som en kung skrev till sitt folk',
                 'En pjäs som spelades upp i kyrkan'],
                'En gammal sång som spreds muntligt',
                'Folkvisorna sjöngs av vanligt folk och lärdes ut från person till person. Många skrevs ner först '
                'långt senare.'),
            sant('Den nordiska mytologin, med gudar som Oden och Tor, känner vi bland annat genom texter som '
                 'skrevs ner på Island.', True,
                 'Eddadikterna och Snorres Edda skrevs ner på Island under medeltiden. Där berättas om Oden, Tor '
                 'och de andra gudarna.'),
            para('Para ihop verket med var och när det kommer ifrån.',
                 [('Kung Oidipus av Sofokles', 'antikens Grekland'),
                  ('Den gudomliga komedin av Dante', 'Italien under medeltiden'),
                  ('Njals saga', 'Island under medeltiden'),
                  ('Beowulf', 'England under medeltiden')],
                 'Kung Oidipus är en grekisk tragedi. Dante var italienare, Njals saga är en av de isländska '
                 'sagorna och Beowulf är en hjältedikt på fornengelska.'),
        ], beskrivning='Tränar litteraturens äldsta tider i stora drag: Homeros epos, den grekiska teatern, '
                       'latinet, de isländska sagorna, folkvisorna och Dante.'),

        niva('sv-ak9-litteraturhistoria-2', 'Från renässansen till modernismen', 'Litteraturhistoria', [
            ordna('Ordna epokerna från äldst till yngst.',
                  ['renässansen', 'upplysningen', 'romantiken', 'realismen', 'modernismen'],
                  forklaring='Renässansen hör ungefär till 1400- och 1500-talen, upplysningen till 1700-talet, romantiken '
                             'till början av 1800-talet, realismen till slutet av 1800-talet och modernismen till '
                             '1900-talet.'),
            val('Vad betyder ordet renässans?', ['pånyttfödelse', 'upplysning', 'genombrott'], 'pånyttfödelse',
                'Under renässansen fick antikens konst och tankar nytt liv, som om de föddes på nytt.'),
            val('Vilken uppfinning från mitten av 1400-talet gjorde att böcker kunde spridas till många fler i Europa?',
                ['boktryckarkonsten', 'skrivmaskinen', 'telegrafen'], 'boktryckarkonsten',
                'Med lösa typer i metall kunde samma text tryckas i många exemplar. Förut skrevs nästan varje bok i '
                'Europa av för hand.'),
            para('Para ihop författaren med ett av hans eller hennes verk.',
                 [('William Shakespeare', 'Romeo och Julia'),
                  ('Miguel de Cervantes', 'Don Quijote'),
                  ('Voltaire', 'Candide'),
                  ('Mary Shelley', 'Frankenstein'),
                  ('August Strindberg', 'Röda rummet')],
                 'Romeo och Julia och Don Quijote skrevs under renässansen, Candide under upplysningen, Frankenstein '
                 'under romantiken och Röda rummet under realismen.'),
            val('Vad satte upplysningen i centrum under 1700-talet?',
                ['förnuftet och vetenskapen', 'känslorna och naturen', 'drömmarna och det omedvetna'],
                'förnuftet och vetenskapen',
                'Upplysningens författare ville ersätta fördomar och vidskepelse med förnuft och kunskap.'),
            val('Vad samlade bröderna Grimm och gav ut i början av 1800-talet?',
                ['folksagor', 'nyhetsartiklar', 'teaterpjäser'], 'folksagor',
                'Romantiken var intresserad av folkets egna berättelser. Bröderna Grimm skrev ner sagor som '
                'Hans och Greta och Askungen.'),
            skriv('Vilken epok kom efter upplysningen och satte känslor, natur och fantasi i centrum? Skriv '
                  'epokens namn.',
                  ['romantiken', 'romantik'],
                  'Romantiken var till en del en reaktion mot upplysningens förnuft. Den lyfte fram känslan, naturen '
                  'och det som inte går att förklara.'),
            sant('August Strindbergs roman Röda rummet från 1879 räknas som ett genombrott för realismen i '
                 'Sverige.', True,
                 'Röda rummet skildrar Stockholm och samhället med skarp blick och humor. Den brukar kallas den '
                 'första moderna svenska romanen.'),
            val('Henrik Ibsens pjäs Ett dockhem från 1879 skildrar ett vanligt äktenskap och kvinnans villkor i '
                'samhället. Vilken epok hör pjäsen till?',
                ['realismen', 'romantiken', 'renässansen'], 'realismen',
                'Realismen ville visa verkligheten som den är och ta upp samhällets problem, som kvinnans ställning.'),
            val('Edith Södergran skrev dikter utan rim och fast rytm i början av 1900-talet. Vilken epok räknas '
                'hon till?',
                ['modernismen', 'romantiken', 'upplysningen'], 'modernismen',
                'Modernismen bröt mot de gamla formerna, och fri vers blev vanlig. Södergran var en av de första '
                'modernisterna som skrev på svenska.'),
        ], beskrivning='Tränar epokerna från renässansen till modernismen i ordning, och några kända verk och '
                       'författare: Shakespeare, Cervantes, Voltaire, bröderna Grimm, Strindberg, Ibsen och '
                       'Södergran.'),

        niva('sv-ak9-sprakriktighet-1', 'Ligga eller lägga, att eller och', 'Språkriktighet', [
            val('Välj rätt ord: ”Kan du ___ tallrikarna i diskmaskinen?”', ['lägga', 'ligga'], 'lägga',
                'Lägga betyder att placera något, och det har ett objekt: lägga tallrikarna. Ligga betyder att vara '
                'i liggande läge: tallrikarna ligger i diskmaskinen.'),
            val('Välj rätt ord: ”Katten ___ i soffan hela eftermiddagen i går.”', ['låg', 'lade', 'la'], 'låg',
                'Katten gjorde inget med något annat, den bara låg där. Låg är dåtid av ligga. Lade och la är dåtid '
                'av lägga.'),
            ordna('Du har placerat nycklarna på bordet. Bygg meningen. En bricka ska inte vara med.',
                  ['Jag', 'har', 'lagt', 'nycklarna', 'på', 'bordet.'], extra=['legat'],
                  forklaring='Du har gjort något med nycklarna, alltså lagt dem. Legat hör till ligga: nycklarna '
                             'har legat på bordet.'),
            para('Para ihop verbet med dess former i dåtid och perfekt.',
                 [('ligga', 'låg, har legat'), ('lägga', 'lade, har lagt'),
                  ('sitta', 'satt, har suttit'), ('sätta', 'satte, har satt')],
                 'Verbparen liknar varandra men böjs olika. Lägga och sätta gör man med något, ligga och sitta gör '
                 'man själv.'),
            val('Välj rätt ord: ”Hon ___ vasen på fönsterbrädan.”', ['satte', 'satt'], 'satte',
                'Hon placerade vasen, och då är det sätta, i dåtid satte. Satt är dåtid av sitta: hon satt på stolen.'),
            val('Välj rätt ord: ”Det är roligt ___ spela schack.”', ['att', 'och'], 'att',
                'Det som är roligt är att spela. Att står före verbet i infinitiv: att spela. Och binder ihop två '
                'saker som görs, som i satt och tittade.'),
            val('Välj rätt ord: ”Vi satt i soffan ___ tittade på film.”', ['och', 'att'], 'och',
                'Här görs två saker på en gång: vi satt och vi tittade. Då binder och ihop dem.'),
            val('Vilken stavning är rätt i svensk skrift?', ['Saras cykel', 'Sara\'s cykel', 'Saras\' cykel'],
                'Saras cykel',
                'På svenska skrivs genitiv utan apostrof: Saras, Sveriges, husets. Apostrofen före s kommer från '
                'engelskan.'),
            skriv('Skriv rätt form av ligga: ”Boken har ___ på bordet i en vecka.”', ['legat'],
                  'Efter har kommer supinum, och supinum av ligga är legat. Lagt hör till lägga.'),
            val('Välj rätt ord: ”Båten ___ till botten på några minuter.”', ['sjönk', 'sänkte'], 'sjönk',
                'Båten gjorde det själv, och då är det sjunka, i dåtid sjönk. Sänka gör man med något: de sänkte '
                'ankaret.'),
        ], beskrivning='Tränar ord som ofta blandas ihop i skrift: ligga och lägga, sitta och sätta, sjunka och '
                       'sänka, att och och, och genitiv utan apostrof.'),

        niva('sv-ak9-sprakriktighet-2', 'Böjning, kongruens och prepositioner', 'Språkriktighet', [
            val('Välj rätt form: ”Vattnet i sjön var ___ i dag.”', ['kallt', 'kall', 'kalla'], 'kallt',
                'Vattnet är ett ett-ord, och då får adjektivet ett t: vattnet var kallt. Det kallas kongruens, att '
                'orden passar ihop.'),
            val('Välj rätt form: ”Alla fönster i huset var ___.”', ['stängda', 'stängt', 'stängd'], 'stängda',
                'Alla fönster är flera, och då står ordet i plural: stängda. Ett enda fönster var stängt.'),
            val('Välj rätt form: ”Brevet var ___ för hand.”', ['skrivet', 'skriven', 'skrivna'], 'skrivet',
                'Brevet är ett ett-ord i singular: brevet var skrivet. En lapp var skriven, och flera brev var '
                'skrivna.'),
            val('Välj rätt form: ”Hennes betyg blev ___ än förra terminen.”', ['bättre', 'mer bra', 'bästa'],
                'bättre',
                'Bra byter ord när det jämförs: bra, bättre, bäst. Mer bra används inte i vårdad skrift.'),
            val('Vilken mening följer normen för vårdad skrift?',
                ['Jag hade velat följa med.', 'Jag hade velat följt med.', 'Jag hade vela följa med.'],
                'Jag hade velat följa med.',
                'Efter velat kommer verbet i infinitiv: följa. Två supinum efter varandra, velat följt, kallas '
                'dubbel supinum. Det är vanligt i tal men räknas som fel i vårdad skrift.'),
            para('Para ihop ordet med den preposition som brukar följa efter.',
                 [('intresserad', 'av'), ('rädd', 'för'), ('stolt', 'över'), ('fokusera', 'på')],
                 'Många ord har en fast preposition: intresserad av musik, rädd för hundar, stolt över sitt arbete '
                 'och fokusera på uppgiften.'),
            val('Vilken mening är rätt?',
                ['Varken Ali eller Sara kom i tid.', 'Varken Ali och Sara kom i tid.',
                 'Varken Ali eller inte Sara kom i tid.'],
                'Varken Ali eller Sara kom i tid.',
                'Varken hör ihop med eller, och tillsammans betyder de ”inte den ena och inte den andra”. Därför '
                'behövs inget inte.'),
            val('Vilken mening om regnet är rätt?',
                ['Regnet påverkade matchen.', 'Regnet påverkade på matchen.', 'Regnet påverkade över matchen.'],
                'Regnet påverkade matchen.',
                'Påverka tar ett objekt direkt, utan preposition: regnet påverkade matchen.'),
            skriv('Skriv rätt form av adjektivet trött: ”Barnen var ___ efter utflykten.”', ['trötta'],
                  'Barnen är flera, och då står adjektivet i plural: trötta.'),
            ordna('Bygg meningen om de nya cyklarna. En bricka ska inte vara med.',
                  ['De', 'nya', 'cyklarna', 'var', 'dyra.'], extra=['dyrt.'],
                  forklaring='Cyklarna är flera, och då står adjektivet efter var i plural: dyra. Dyrt passar till '
                             'ett ett-ord i singular, som ett hus.'),
        ], beskrivning='Tränar att adjektiv och particip böjs efter ordet de hör till, att undvika dubbel supinum, '
                       'jämförelse av bra, rätt preposition efter vanliga ord och varken och eller.'),

        niva('sv-ak9-tala-1', 'Planera ett tal', 'Tala inför publik', [
            ordna('Ordna talets delar i rätt ordning.', ['inledning', 'huvuddel', 'avslutning'],
                  forklaring='Inledningen fångar intresset, huvuddelen ger innehållet och avslutningen knyter ihop '
                             'talet.'),
            para('Para ihop delen av talet med vad den ska göra.',
                 [('inledning', 'fånga publikens intresse och presentera ämnet'),
                  ('huvuddel', 'ge innehållet, till exempel fakta eller argument'),
                  ('avslutning', 'sammanfatta och lämna något att minnas')],
                 'Varje del har en uppgift. Publiken ska förstå vad talet handlar om, få veta mer och minnas det '
                 'viktigaste efteråt.'),
            val('Varför ska du tänka på vilka som ska lyssna innan du skriver ditt tal?',
                ['Språket och exemplen ska passa publiken', 'Talet blir då alltid kortare',
                 'Publiken får då inte ställa några frågor'],
                'Språket och exemplen ska passa publiken',
                'Ett tal för en klass i åk 2 låter inte som ett tal för föräldrar. Ord, exempel och längd ska '
                'passa dem som lyssnar.'),
            val('Vad är stödord?',
                ['Några få ord per punkt som påminner dig om innehållet', 'Hela talet utskrivet, ord för ord',
                 'Svåra fackord som du lägger in för att imponera på publiken'],
                'Några få ord per punkt som påminner dig om innehållet',
                'Med stödord kan du titta upp och tala till publiken i stället för att läsa innantill.'),
            sant('En röd tråd i ett tal betyder att delarna hänger ihop och leder publiken från början till slut.',
                 True,
                 'Med en röd tråd vet publiken hela tiden var i talet de är och hur delarna hör ihop.'),
            val('Vilket syfte har ett tal som ska få publiken att rösta för ditt förslag?',
                ['att övertyga', 'att informera', 'att underhålla'], 'att övertyga',
                'Talet vill få publiken att tycka som du och göra något. Det är att övertyga.'),
            val('Vilken inledning fångar troligen publikens intresse bäst?',
                ['”Hur många minuter om dagen tror ni att ni tittar på mobilen?”',
                 '”Mitt tal handlar om mobiler. Det är alltså ett tal om mobiler.”',
                 '”Jag har inte förberett mig så mycket, men jag ska försöka.”'],
                '”Hur många minuter om dagen tror ni att ni tittar på mobilen?”',
                'En fråga får publiken att tänka på sig själv. Att upprepa ämnet eller ursäkta sig väcker inget '
                'intresse.'),
            val('Varför upprepar man ofta det viktigaste i ett tal, mer än i en skriven text?',
                ['Lyssnaren kan inte gå tillbaka och läsa igen', 'Ett tal måste vara minst fem minuter långt',
                 'Upprepningar gör att talet går snabbare att skriva'],
                'Lyssnaren kan inte gå tillbaka och läsa igen',
                'En läsare kan läsa om en mening, men en lyssnare hör den bara en gång. Därför hjälper det att '
                'säga det viktigaste mer än en gång.'),
            skriv('Vad kallas de människor som lyssnar på ett tal? Skriv ett ord.',
                  ['publik', 'publiken', 'åhörare', 'åhörarna', 'lyssnare', 'lyssnarna', 'mottagare', 'mottagarna',
                   'auditorium', 'auditoriet'],
                  'De som lyssnar kallas publik eller åhörare. Talet ska alltid anpassas efter dem.'),
            val('Vilken avslutning passar bäst i ett tal som vill övertyga?',
                ['”Så låt oss börja i dag: släck lampan när du går!”', '”Ja, det var nog allt, tror jag.”',
                 '”Nu ska jag berätta om ett helt annat ämne.”'],
                '”Så låt oss börja i dag: släck lampan när du går!”',
                'En uppmaning sist säger vad publiken ska göra och blir kvar i minnet. De andra slutar utan att '
                'knyta ihop talet.'),
        ], beskrivning='Tränar att planera en muntlig presentation: syfte, publik, inledning, huvuddel och '
                       'avslutning, en röd tråd och stödord.'),

        niva('sv-ak9-tala-2', 'Framföra och övertyga', 'Tala inför publik', [
            para('Para ihop det du gör när du talar med varför det hjälper.',
                 [('ögonkontakt', 'publiken känner sig sedd och lyssnar'),
                  ('hög och tydlig röst', 'alla hör, också längst bak'),
                  ('lugnt tempo', 'publiken hinner uppfatta varje ord'),
                  ('kroppsspråk', 'gester och hållning förstärker orden')],
                 'Hur du säger något är nästan lika viktigt som vad du säger. Röst, blick och kropp hjälper '
                 'publiken att lyssna.'),
            val('Vad kallas greppet att räkna upp tre saker i rad, som i ”Vi vill ha lugn, trygghet och '
                'respekt”?',
                ['tretal', 'anafor', 'retorisk fråga'], 'tretal',
                'Tre led i rad låter avslutat och är lätt att minnas. Det kallas tretal.'),
            val('”Det är inte eleverna som är problemet, det är schemat.” Vilket retoriskt grepp används?',
                ['kontrast', 'tretal', 'retorisk fråga'], 'kontrast',
                'Två saker ställs mot varandra: inte eleverna, utan schemat. En kontrast gör budskapet skarpt.'),
            val('”Vi vill ha en skola som lyssnar. Vi vill ha en skola som hjälper. Vi vill ha en skola för alla.” '
                'Vilka två grepp används?',
                ['anafor och tretal', 'kontrast och liknelse', 'retorisk fråga och kontrast'],
                'anafor och tretal',
                'Samma ord, vi vill ha, står först i varje mening, och det är en anafor. Meningarna är tre, och det '
                'är ett tretal.'),
            val('Någon säger att en längre lunchrast gör skoldagen längre. Vilket svar bemöter motargumentet bäst?',
                ['Ja, men då orkar vi mer på eftermiddagen.', 'Det där är bara något som du själv har hittat på.',
                 'Jag tänker inte svara, för du har ändå fel om allt.'],
                'Ja, men då orkar vi mer på eftermiddagen.',
                'Att bemöta är att hålla med om det som stämmer och visa varför din åsikt ändå håller. De andra '
                'svaren avfärdar personen i stället för att svara på argumentet.'),
            val('Du märker att du pratar för fort när du är nervös. Vad är ett bra knep?',
                ['Gör en kort paus och andas efter varje del', 'Läs ännu snabbare så att talet tar slut fortare',
                 'Titta ner i pappret hela tiden'],
                'Gör en kort paus och andas efter varje del',
                'En paus ger dig tid att andas och publiken tid att tänka. Det känns längre för dig än för dem.'),
            skriv('Det du gör med händer och armar för att förstärka det du säger kallas … Skriv ordet.',
                  ['gester', 'gest', 'gesterna', 'gestik', 'gestikulering', 'gestikulation', 'kroppsspråk',
                   'kroppsspråket'],
                  'Gester är en del av kroppsspråket. Rätt använda gör de talet tydligare.'),
            sant('I ett tal kan en kort tystnad före en viktig mening göra att publiken lyssnar extra noga.', True,
                 'En paus väcker uppmärksamhet. Publiken väntar på det som kommer, och meningen efter pausen blir '
                 'starkare.'),
            val('Varför kan det vara klokt att själv ta upp ett motargument i sitt tal?',
                ['Det visar att du har tänkt på andra sidan', 'Då håller publiken alltid med dig efteråt',
                 'Då behöver du inte ha några egna argument'],
                'Det visar att du har tänkt på andra sidan',
                'Den som tar upp och bemöter motargumentet verkar kunnig och ärlig. Det gör talet mer övertygande, '
                'men ingen kan lova att alla håller med.'),
            ordna('Bygg meningen med ett tretal.', ['Vi', 'behöver', 'tid,', 'ro', 'och', 'arbetsglädje.'],
                  forklaring='Tretalet är tid, ro och arbetsglädje. Kommat står efter det första ledet, och och står '
                             'före det sista.'),
        ], beskrivning='Tränar framförandet: röst, tempo, pauser, ögonkontakt och kroppsspråk, de retoriska greppen '
                       'tretal, kontrast och anafor, och att bemöta ett motargument.'),
    ]),
]
