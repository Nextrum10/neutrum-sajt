# -*- coding: utf-8 -*-
"""Juridik gy1 och gy2 (2026-10-06): två banor i ett ämne som bara finns i
NexLäx (NX.NEXLAX_AMNEN).

gy1 är privatjuridiken: rättssystemet, avtal, köp och konsument, familj och
arv, och brott och straff. gy2 är rätten i samhället: grundlagarna och
lagstiftningen, arbetsrätten, hyra och skulder, och skadestånd och försäkring.
Juridiken läses olika år på olika program; gy1 är grunderna och gy2 det som
bygger på dem. Fem och fyra områden, två nivåer i varje.

Skrivet från grunden mot ämnesplanen i juridik för gymnasieskolan och mot
lagarna själva. Inget är taget ur en lärobok eller ett prov, och personerna i
frågorna är påhittade.

Bara det som står fast. Inga belopp och inga räntor. Straffmyndighetsåldern
och påföljderna (villkorlig dom, skyddstillsyn, påföljder för unga) utreds och
ändras, så de frågas inte: straffrätten här är brottet, uppsåtet, nödvärnet
och rättegångens gång. EU:s antal medlemsländer står inte heller här. Det som
frågas har gällt i flera år: avtalslagen, konsumentköplagen från 2022,
distansavtalslagen, föräldrabalken, äktenskapsbalken, sambolagen,
ärvdabalken, rättegångsbalken, grundlagarna, LAS (frågorna nämner
arbetsbrist och personliga skäl, inte lagens ord för kravet, som ändrades
2022), semesterlagen, diskrimineringslagen, hyreslagen och skadeståndslagen.

FÖRENKLAT, och värt en juristlärares blick:
- Reklamationen: "inom skälig tid" förklaras med att två månader alltid är i
  tid. Tre år och tvåårsregeln står som i konsumentköplagen från 2022.
- Arvet: arvsklasserna är tre steg, och särkullbarnens rätt nämns bara som att
  de kan få ut sitt arv direkt.
- Rättegången: brottmålets steg, utan strafföreläggande och ordningsbot.
- Den offentliga försvararen "betalas av staten"; att den dömde kan få betala
  tillbaka står inte här.
- Nämndemän: "många brottmål", för att en lagfaren domare dömer ensam i
  enklare mål. Lockout, fredsplikt och turordning står som huvudregler.
- LAS (provanställningen sex månader, turordningen som huvudregel) ändrades
  senast 2022: ändras lagen igen, läs om de frågorna först.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

AMNE = 'Juridik'

BANOR = [
    # ================================================================== gy1
    bana(AMNE, 'gy1', [
        # -------------------------------------------------- Rättssystemet
        niva('ju-gy1-rattssystemet-1', 'Lagar och grundlagar', 'Rättssystemet', [
            val('Vem stiftar lagar i Sverige?',
                ['Riksdagen', 'Regeringen', 'Högsta domstolen', 'Kungen'], 'Riksdagen',
                'Riksdagen stiftar lagarna. Regeringen styr landet och får besluta förordningar, regler under '
                'lagarna, men kan inte själv ändra en lag.'),
            skriv('Hur många grundlagar har Sverige? Svara med ett tal.', tal(4),
                  'Regeringsformen, successionsordningen, tryckfrihetsförordningen och '
                  'yttrandefrihetsgrundlagen.'),
            para('Para ihop grundlagen med vad den handlar om.', [
                ('Regeringsformen', 'hur landet styrs och våra fri- och rättigheter'),
                ('Successionsordningen', 'vem som ärver tronen'),
                ('Tryckfrihetsförordningen', 'tryckta skrifter och allmänna handlingar'),
                ('Yttrandefrihetsgrundlagen', 'radio, tv, film och liknande medier')],
                'Regeringsformen är den största grundlagen. De två om tryck- och yttrandefrihet skyddar det '
                'fria ordet, och successionsordningen gäller kungahuset.'),
            sant('En förordning från regeringen får gå emot en lag som riksdagen har stiftat.', False,
                 'Lagarna står över förordningarna. Regeringen får bara besluta förordningar inom de ramar som '
                 'grundlagen och lagarna ger.'),
            val('Vad kallas den del av juridiken som gäller mellan enskilda personer, till exempel avtal och arv?',
                ['Civilrätt', 'Offentlig rätt', 'Straffrätt', 'Folkrätt'], 'Civilrätt',
                'Civilrätten, eller privaträtten, gäller mellan enskilda. Offentlig rätt, där straffrätten '
                'ingår, gäller förhållandet mellan det allmänna och den enskilde. Folkrätten gäller mellan stater.'),
            val('Vem föreslår en ny statsminister för riksdagen?',
                ['Talmannen', 'Kungen', 'Den förra statsministern', 'Justitiekanslern'], 'Talmannen',
                'Talmannen leder riksdagen, samtalar med partierna och lägger fram ett förslag som riksdagen '
                'röstar om. Kungen har ingen politisk makt.'),
            val('Vad står i regeringsformens andra kapitel?',
                ['Våra grundläggande fri- och rättigheter', 'Hur rösterna räknas i riksdagsvalet',
                 'Vem som ärver tronen efter kungen', 'Hur mycket skatt kommunerna tar ut'],
                'Våra grundläggande fri- och rättigheter',
                'Andra kapitlet räknar upp friheter som yttrandefrihet, mötesfrihet och religionsfrihet, och '
                'skydd som att ingen får straffas utan stöd i lag.'),
            sant('För att ändra en grundlag måste riksdagen fatta två likadana beslut med ett riksdagsval emellan.',
                 True,
                 'Det gör grundlagarna svårare att ändra än vanliga lagar: väljarna hinner säga sitt i valet '
                 'mellan besluten.'),
        ], beskrivning='Vem som stiftar lagarna, de fyra grundlagarna och skillnaden mellan civilrätt och '
                       'offentlig rätt.'),
        niva('ju-gy1-rattssystemet-2', 'Domstolarna och prejudikaten', 'Rättssystemet', [
            ordna('Ordna de allmänna domstolarna från första till sista instans.',
                  ['Tingsrätten', 'Hovrätten', 'Högsta domstolen'],
                  forklaring='Ett mål börjar i tingsrätten. Domen kan överklagas till hovrätten och därefter, om '
                             'målet får prövningstillstånd, till Högsta domstolen.'),
            para('Para ihop domstolen med målen den dömer i.', [
                ('Tingsrätten', 'brottmål och tvister mellan enskilda, i första instans'),
                ('Hovrätten', 'överklagade domar från tingsrätten'),
                ('Högsta domstolen', 'mål som kan bli vägledande för andra domstolar'),
                ('Förvaltningsrätten', 'tvister mellan en enskild och en myndighet')],
                'Tingsrätt, hovrätt och Högsta domstolen är de allmänna domstolarna. Förvaltningsrätten hör '
                'till förvaltningsdomstolarna, som prövar myndigheternas beslut.'),
            val('Vad är ett prejudikat?',
                ['En dom som visar hur lagen ska tolkas i liknande fall', 'Ett förslag till ny lag som regeringen lämnar',
                 'En dom som bara gäller i den kommun där den föll', 'Ett avtal som parterna har fått godkänt av domstolen'],
                'En dom som visar hur lagen ska tolkas i liknande fall',
                'Prejudikaten kommer främst från de högsta domstolarna. Andra domstolar följer dem, så att '
                'lika fall döms lika.'),
            sant('Högsta domstolen tar upp alla mål som överklagas dit.', False,
                 'Högsta domstolen ger prövningstillstånd främst när ett mål kan bli vägledande, ett prejudikat. '
                 'De flesta överklaganden dit tas aldrig upp.'),
            para('Para ihop rättskällan med vad den är.', [
                ('Lag', 'regler som riksdagen har beslutat'),
                ('Förarbeten', 'utredningar och propositioner som visar vad lagen ska betyda'),
                ('Prejudikat', 'domar från högsta instans som visar hur lagen ska tolkas'),
                ('Doktrin', 'det forskare i juridik skriver om rätten')],
                'Rättskällorna är det domare och jurister stöder sig på när de avgör vad som gäller. Lagen '
                'väger tyngst.'),
            val('Försäkringskassan nekar någon ersättning, och personen vill gå till domstol. Var börjar målet?',
                ['Förvaltningsrätten', 'Tingsrätten', 'Hovrätten', 'Kammarrätten'], 'Förvaltningsrätten',
                'En myndighets beslut överklagas till förvaltningsrätten. Därefter kan det gå till kammarrätten '
                'och Högsta förvaltningsdomstolen.'),
            sant('Vanliga medborgare, så kallade nämndemän, är med och dömer i många brottmål i tingsrätten.', True,
                 'Nämndemännen är valda av kommunen och dömer tillsammans med en lagfaren domare. De har varsin '
                 'röst. I enklare mål dömer domaren ensam.'),
            val('Vad gör Justitieombudsmannen, JO?',
                ['Granskar att myndigheterna följer lagarna', 'Leder polisens utredningar av grova brott',
                 'Dömer i tvister om hyror, lån och skulder', 'Skriver förslagen till nya lagar åt riksdagen'],
                'Granskar att myndigheterna följer lagarna',
                'JO väljs av riksdagen. Vem som helst kan anmäla en myndighet till JO, som kan kritisera den som '
                'har gjort fel.'),
        ], beskrivning='Tingsrätt, hovrätt och Högsta domstolen, förvaltningsdomstolarna, prejudikaten och '
                       'rättskällorna.'),

        # -------------------------------------------------- Avtal
        niva('ju-gy1-avtal-1', 'Anbud och accept', 'Avtal', [
            val('Hur kommer ett avtal till enligt avtalslagen?',
                ['Någon lämnar ett anbud och den andra accepterar', 'Båda skriver under inför ett vittne hos en notarie',
                 'Avtalet registreras och godkänns hos en myndighet', 'Parterna betalar var sin avgift till staten'],
                'Någon lämnar ett anbud och den andra accepterar',
                'Anbud och accept: ett erbjudande och ett ja till det. Inget mer behövs för de flesta avtal.'),
            sant('Huvudregeln är att ett muntligt avtal är lika bindande som ett skriftligt.', True,
                 'Det skriftliga gör det lättare att bevisa vad man kom överens om. Några avtal måste ändå vara '
                 'skriftliga, till exempel köp av ett hus.'),
            val('Vad kallas principen att den som har lämnat ett anbud är bunden av det?',
                ['Löftesprincipen', 'Offentlighetsprincipen', 'Legalitetsprincipen', 'Likhetsprincipen'],
                'Löftesprincipen',
                'Den som har lämnat ett anbud kan inte ångra sig hur som helst: anbudet gäller så länge '
                'mottagaren har rätt att svara.'),
            val('Du svarar på ett anbud: "Ja, men bara om priset blir 500 kronor lägre." Vad gäller?',
                ['Svaret är ett nytt anbud, och avtal finns inte än', 'Avtal finns, och det gäller till det första priset',
                 'Avtal finns, och det gäller till det lägre priset', 'Säljaren måste godta det, för du svarade ja'],
                'Svaret är ett nytt anbud, och avtal finns inte än',
                'Ett ja med ändringar kallas en oren accept. Den räknas som ett nytt anbud, som den andra kan '
                'anta eller avböja.'),
            val('Ett anbud i ett brev säger: "Svar senast den 1 maj." Du skickar ditt ja först den 3 maj. Vad gäller?',
                ['Svaret är för sent och räknas som ett nytt anbud', 'Avtalet gäller ändå, för svaret var ja',
                 'Avtalet gäller, för en tidsfrist är bara ett önskemål', 'Säljaren måste sälja till det första priset'],
                'Svaret är för sent och räknas som ett nytt anbud',
                'Anbudet gällde bara till den 1 maj. Ett svar efter tidsfristen blir ett nytt anbud, som säljaren '
                'kan anta eller låta bli.'),
            para('Para ihop begreppet med vad det betyder.', [
                ('Anbud', 'ett erbjudande om att ingå ett avtal'),
                ('Accept', 'ett ja till ett anbud'),
                ('Oren accept', 'ett ja med ändringar, som blir ett nytt anbud'),
                ('Avtalspart', 'den som är bunden av avtalet')],
                'Avtalet kommer till när ett anbud möter en accept som stämmer med anbudet.'),
            sant('En annons i en tidning med ett pris är normalt ett bindande anbud till alla som läser den.', False,
                 'En annons räknas normalt som en uppmaning att lämna anbud. Annars skulle säljaren vara bunden '
                 'att sälja till alla, fast varorna tar slut.'),
            skriv('Vid vilken ålder blir man myndig i Sverige? Svara med ett tal.', tal(18),
                  'Den som är under 18 år är omyndig. En omyndig behöver som regel vårdnadshavarens ja för att '
                  'ingå ett avtal.'),
        ], beskrivning='Hur ett avtal kommer till: anbud, accept, oren accept och löftesprincipen.'),
        niva('ju-gy1-avtal-2', 'Ogiltiga avtal och fullmakt', 'Avtal', [
            val('Vad gäller om någon har tvingats att skriva på ett avtal med hot om våld?',
                ['Avtalet är ogiltigt', 'Avtalet gäller men kan sägas upp',
                 'Avtalet gäller om det är skriftligt', 'Avtalet börjar gälla efter en månad'],
                'Avtalet är ogiltigt',
                'Ett avtal som någon har tvingats till med våld eller hot om våld gäller inte. Avtalslagen '
                'räknar upp flera sådana ogiltighetsgrunder.'),
            para('Para ihop ogiltighetsgrunden med exemplet.', [
                ('Svek', 'säljaren ljuger medvetet om att bilen aldrig har krockat'),
                ('Ocker', 'någon utnyttjar en annans nöd för att få ett orimligt pris'),
                ('Tvång', 'någon hotas till att skriva under'),
                ('Oskäligt villkor', 'ett villkor är så orimligt att det kan jämkas')],
                'Svek, ocker och tvång gör ett avtal ogiltigt. Ett oskäligt villkor kan jämkas, alltså ändras, '
                'eller lämnas utan avseende.'),
            sant('Ett avtal som en 15-åring har ingått utan vårdnadshavarens ja kan bli ogiltigt.', True,
                 'En omyndig kan som regel inte ingå bindande avtal på egen hand. Vårdnadshavaren kan godkänna '
                 'avtalet i efterhand, och då gäller det.'),
            val('Vad är en fullmakt?',
                ['Rätt att ingå avtal i någon annans namn', 'Ett avtal om att låna ut pengar',
                 'Ett intyg på att man är myndig', 'Ett papper som visar vem som äger en bil'],
                'Rätt att ingå avtal i någon annans namn',
                'Den som ger fullmakten kallas fullmaktsgivare, och den som får den kallas fullmäktig.'),
            val('En fullmäktig ingår ett avtal inom ramen för sin fullmakt. Vem blir bunden av avtalet?',
                ['Fullmaktsgivaren', 'Fullmäktigen själv', 'Båda två lika mycket', 'Ingen, förrän avtalet registrerats'],
                'Fullmaktsgivaren',
                'Avtalet blir som om fullmaktsgivaren hade ingått det själv. Det är hela poängen med en fullmakt.'),
            sant('Ett avtal om att köpa ett hus måste vara skriftligt och undertecknat.', True,
                 'Köp av en fastighet kräver ett skriftligt köpekontrakt som både köparen och säljaren skriver '
                 'under. Ett muntligt löfte räcker inte.'),
            val('Vad betyder det att ett avtal jämkas?',
                ['Det ändras så att det blir skäligt', 'Det upphör att gälla helt',
                 'Det förlängs med ett år', 'Det översätts till ett annat språk'],
                'Det ändras så att det blir skäligt',
                'En domstol kan jämka ett oskäligt villkor, alltså ändra det, i stället för att hela avtalet '
                'faller.'),
            skriv('En omyndig får själv bestämma över pengar som hon eller han har tjänat på eget arbete. Från vilken '
                  'ålder gäller det? Svara med ett tal.', tal(16),
                  'Från 16 års ålder råder en omyndig själv över det hon eller han har tjänat på eget arbete, och '
                  'kan handla för de pengarna.'),
        ], beskrivning='Svek, ocker och tvång, omyndiga, fullmakter och avtal som måste vara skriftliga.'),

        # -------------------------------------------------- Köp och konsument
        niva('ju-gy1-konsument-1', 'Fel i varan', 'Köp och konsument', [
            val('Vilken lag gäller när en privatperson köper en vara av ett företag?',
                ['Konsumentköplagen', 'Köplagen', 'Avtalslagen ensam', 'Marknadsföringslagen'],
                'Konsumentköplagen',
                'Konsumentköplagen skyddar konsumenten, som räknas som den svagare parten. Den går inte att '
                'avtala bort till konsumentens nackdel.'),
            val('Vilken lag gäller när en privatperson köper en begagnad cykel av en annan privatperson?',
                ['Köplagen', 'Konsumentköplagen', 'Konsumenttjänstlagen', 'Ingen lag alls'], 'Köplagen',
                'Mellan två privatpersoner gäller köplagen. Konsumentköplagen gäller bara när säljaren är ett '
                'företag.'),
            sant('En reklamation som görs inom två månader efter att du upptäckte felet är alltid gjord i tid.', True,
                 'Du ska reklamera inom skälig tid efter att du märkt felet, och två månader räknas alltid som '
                 'skälig tid.'),
            skriv('Säljaren svarar för fel som visar sig inom en viss tid efter att du fick varan. Hur många år är '
                  'den tiden som huvudregel enligt konsumentköplagen? Svara med ett tal.', tal(3),
                  'Säljaren svarar för fel som visar sig inom tre år. Efter det är det som regel för sent, om inte '
                  'en garanti eller ett avtal ger längre tid.'),
            val('Vad betyder det att reklamera?',
                ['Att säga till säljaren att varan har ett fel', 'Att lämna tillbaka en vara man har ångrat köpet av',
                 'Att be om pengarna tillbaka utan att ange skäl', 'Att anmäla säljaren till polisen'],
                'Att säga till säljaren att varan har ett fel',
                'En reklamation är ett klagomål på ett fel. Den kan vara muntlig, men skriftlig är lättare att '
                'bevisa.'),
            val('Vad kan du i första hand kräva när en ny vara från en butik har ett fel?',
                ['Att felet lagas eller att du får en ny vara', 'Att köpet hävs och du får pengarna tillbaka',
                 'Att du får behålla varan utan att betala', 'Att butiken betalar ett skadestånd direkt'],
                'Att felet lagas eller att du får en ny vara',
                'Lagen börjar med att felet ska rättas. Går det inte, eller tar det för lång tid, kan du få '
                'prisavdrag eller häva köpet.'),
            sant('Ett fel som visar sig inom två år efter att du fick varan antas ha funnits redan vid köpet.', True,
                 'Då är det butiken som ska visa att felet inte fanns från början, till exempel att varan har '
                 'tappats. I den äldre konsumentköplagen var tiden sex månader.'),
            para('Para ihop påföljden med vad den innebär.', [
                ('Avhjälpande', 'felet lagas'),
                ('Omleverans', 'du får en ny, felfri vara'),
                ('Prisavdrag', 'du betalar mindre för varan'),
                ('Hävning', 'köpet går tillbaka och du får pengarna')],
                'Avhjälpande och omleverans kommer först. Prisavdrag och hävning är nästa steg.'),
        ], beskrivning='Konsumentköplagen och köplagen, reklamation och vad du kan kräva när en vara är felaktig.'),
        niva('ju-gy1-konsument-2', 'Ångerrätt, garanti och tvister', 'Köp och konsument', [
            skriv('Hur många dagars ångerrätt har du när du handlar på nätet från ett företag? Svara med ett tal.',
                  tal(14),
                  'Distansavtalslagen ger 14 dagars ångerrätt. Den gäller också köp vid dörren och andra köp '
                  'utanför butiken.'),
            sant('Butiker måste enligt lag låta kunder lämna tillbaka en hel vara som de köpt i butiken.', False,
                 'Öppet köp är ett frivilligt löfte från butiken. I en butik finns ingen ångerrätt i lagen.'),
            val('Vad är skillnaden mellan reklamationsrätt och garanti?',
                ['Reklamationsrätten följer av lag, garantin är ett extra löfte', 'Garantin följer av lag, reklamationsrätten är frivillig',
                 'De är samma sak med två olika namn', 'Garantin gäller bara varor som köpts på nätet'],
                'Reklamationsrätten följer av lag, garantin är ett extra löfte',
                'Reklamationsrätten har du alltid. En garanti är ett löfte från säljaren eller tillverkaren som '
                'kan ge mer, men aldrig mindre.'),
            val('Vad gör Allmänna reklamationsnämnden, ARN?',
                ['Ger råd om hur en tvist med ett företag bör lösas', 'Dömer företag som bryter mot lagen till böter',
                 'Skriver förslagen till nya konsumentlagar', 'Lagar varor åt kunder som inte får hjälp'],
                'Ger råd om hur en tvist med ett företag bör lösas',
                'ARN prövar tvister mellan konsumenter och företag och ger en rekommendation. Det är gratis att '
                'anmäla.'),
            sant('ARN:s beslut är bindande på samma sätt som en dom.', False,
                 'ARN ger rekommendationer. De flesta företag följer dem, men den som vill tvinga fram ett beslut '
                 'måste gå till domstol.'),
            val('Du köper en jacka i en butik och ångrar dig dagen efter. Jackan är hel. Vad gäller?',
                ['Det avgörs av butikens egna regler om öppet köp', 'Du har 14 dagars ångerrätt enligt lag, som på nätet',
                 'Butiken måste byta den mot en annan vara om du vill', 'Du får tillbaka pengarna inom 30 dagar'],
                'Det avgörs av butikens egna regler om öppet köp',
                'I en butik finns ingen ångerrätt i lagen. Öppet köp är frivilligt, så det beror på butiken.'),
            val('Vem räknas som konsument enligt lagen?',
                ['En privatperson som köper för eget bruk', 'Ett företag som köper in varor till sin verksamhet',
                 'Den som säljer varor i sin egen firma', 'Alla som betalar sina köp med kort'],
                'En privatperson som köper för eget bruk',
                'En konsument köper främst för privat bruk, inte i sitt företag. Konsumentlagarna skyddar just '
                'henne eller honom.'),
            para('Para ihop situationen med lagen som gäller.', [
                ('Du köper en tröja i en butik', 'konsumentköplagen'),
                ('Du köper en cykel av en granne', 'köplagen'),
                ('En snickare bygger om ditt kök', 'konsumenttjänstlagen'),
                ('Du ångrar skor du beställt på nätet', 'distansavtalslagen')],
                'Vem som säljer och om det är en vara eller en tjänst avgör lagen. Ångerrätten vid köp på nätet '
                'står i distansavtalslagen.'),
        ], beskrivning='Ångerrätt, öppet köp, garanti och Allmänna reklamationsnämnden.'),

        # -------------------------------------------------- Familj och arv
        niva('ju-gy1-familj-1', 'Äktenskap och samboende', 'Familj och arv', [
            val('Vad är giftorättsgods?',
                ['Egendom som ska delas vid en bodelning', 'Egendom som inte ska delas vid en bodelning',
                 'Skulder som makarna har tillsammans', 'Bostad och bohag som sambor har skaffat ihop'],
                'Egendom som ska delas vid en bodelning',
                'Det mesta makarna äger är giftorättsgods, också det som bara den ena står som ägare till. När '
                'äktenskapet tar slut delas värdet lika, efter att skulderna har dragits av. Det som inte delas '
                'kallas enskild egendom.'),
            val('Hur kan makar göra så att viss egendom blir enskild egendom?',
                ['Genom ett äktenskapsförord', 'Genom ett testamente till sig själva',
                 'Genom att låta en bank värdera den', 'Genom att lägga den i ett bankfack'],
                'Genom ett äktenskapsförord',
                'I ett äktenskapsförord kan makarna bestämma att viss egendom är enskild och inte ska delas. Det '
                'måste registreras hos Skatteverket.'),
            sant('Sambor ärver varandra enligt lag på samma sätt som makar.', False,
                 'Sambor ärver inte varandra enligt lag. Vill sambor ärva varandra behöver de skriva testamente.'),
            val('Vad delas enligt sambolagen när ett samboförhållande tar slut?',
                ['Bostad och bohag som skaffats för att användas ihop', 'Allt som samborna äger, också bilar och sparpengar',
                 'Bara det som samborna har skrivit i ett testamente', 'Bara pengarna på samboparets gemensamma konto'],
                'Bostad och bohag som skaffats för att användas ihop',
                'Sambolagen gäller den gemensamma bostaden och bohaget, alltså möbler och husgeråd, som '
                'skaffats för att användas tillsammans. Annat delas inte.'),
            val('Vad kallas avtalet där sambor bestämmer att sambolagens regler om delning inte ska gälla?',
                ['Samboavtal', 'Äktenskapsförord', 'Gåvobrev', 'Testamente'], 'Samboavtal',
                'Med ett skriftligt samboavtal kan samborna avtala bort delningen. Äktenskapsförord är makarnas '
                'motsvarighet.'),
            val('Vad är en bodelning?',
                ['När egendom delas efter ett avslutat förhållande', 'När ett arv delas mellan den avlidnes barn',
                 'När ett hus delas upp i flera separata lägenheter', 'När en skuld betalas av i flera delbetalningar'],
                'När egendom delas efter ett avslutat förhållande',
                'Bodelning görs vid skilsmässa, när ett samboförhållande tar slut och när en make dör. När ett '
                'arv delas heter det arvskifte.'),
            sant('Vårdnadshavare har ansvar för att barnet får omvårdnad, trygghet och en god fostran.', True,
                 'Det står i föräldrabalken. Vårdnadshavaren ska också ta hänsyn till barnets egna åsikter, mer '
                 'ju äldre barnet blir.'),
            skriv('Ett barn går kvar i gymnasiet efter 18 års ålder. Till vilken ålder kan föräldrarna som längst '
                  'vara skyldiga att betala för barnets försörjning? Svara med ett tal.', tal(21),
                  'Föräldrarnas underhållsskyldighet gäller till 18. Går barnet i skolan gäller den längre, som '
                  'längst till 21 år.'),
        ], beskrivning='Giftorättsgods och äktenskapsförord, sambolagen, bodelning och föräldrarnas ansvar.'),
        niva('ju-gy1-familj-2', 'Arv och testamente', 'Familj och arv', [
            val('Vilka är bröstarvingar?',
                ['Den avlidnes barn och barnbarn', 'Den avlidnes make eller maka',
                 'Den avlidnes föräldrar och syskon', 'Alla som står i ett testamente'],
                'Den avlidnes barn och barnbarn',
                'Bröstarvingarna är barnen, och barnbarnen i stället för ett barn som har dött. De ärver först.'),
            sant('Kusiner ärver varandra enligt lag.', False,
                 'Arvsrätten slutar med far- och morföräldrarna och deras barn, alltså fastrar, mostrar, farbröder '
                 'och morbröder. Kusiner ärver inte.'),
            ordna('Ordna arvsklasserna: den som ärver först, först.',
                  ['Barn och barnbarn', 'Föräldrar och syskon', 'Far- och morföräldrar och deras barn'],
                  forklaring='Finns någon i en klass ärver inte de i nästa. Bara om det inte finns några barn eller '
                             'barnbarn går arvet till föräldrar och syskon.'),
            val('Hur stor är laglotten?',
                ['Hälften av arvslotten', 'Hela arvslotten', 'En fjärdedel av arvslotten', 'Lika mycket som makens arv'],
                'Hälften av arvslotten',
                'Laglotten är den del av arvet som ett barn alltid har rätt till, även om ett testamente säger '
                'något annat.'),
            sant('Ett testamente kan ta ifrån ett barn rätten till laglotten.', False,
                 'Barnet har rätt till sin laglott, hälften av arvslotten, och kan kräva den även om testamentet '
                 'säger något annat.'),
            val('Vem får arvet efter en person som inte har någon make, inga släktingar som kan ärva och inget '
                'testamente?',
                ['Allmänna arvsfonden', 'Kommunen där personen bodde', 'Den närmaste grannen', 'Svenska kyrkan'],
                'Allmänna arvsfonden',
                'Då går arvet till Allmänna arvsfonden. Den stöttar projekt för barn, unga och personer med '
                'funktionsnedsättning.'),
            val('En gift person dör. Paret har bara gemensamma barn. Vem ärver först?',
                ['Den efterlevande maken', 'Barnen, direkt', 'Den avlidnes föräldrar', 'Barnen, när de fyllt 18'],
                'Den efterlevande maken',
                'Maken ärver först, och de gemensamma barnen får sitt arv när båda föräldrarna har dött. '
                'Särkullbarn, alltså den avlidnes barn som maken inte är förälder till, kan få ut sitt arv direkt.'),
            para('Para ihop ordet med vad det betyder.', [
                ('Testamente', 'ett skriftligt besked om vem som ska få ens egendom'),
                ('Arvslott', 'det arv en arvinge skulle få enligt lag'),
                ('Dödsbo', 'den avlidnes egendom och skulder innan arvet är fördelat'),
                ('Särkullbarn', 'ett barn som den ena maken har med någon annan')],
                'Ett testamente ska vara skriftligt och skrivas under inför två vittnen.'),
        ], beskrivning='Bröstarvingar, arvsklasserna, laglotten, testamente och makens arv.'),

        # -------------------------------------------------- Brott och straff
        niva('ju-gy1-brott-1', 'Vad är ett brott?', 'Brott och straff', [
            val('Vad krävs för att en handling ska vara ett brott i Sverige?',
                ['Att den står beskriven i lag och har ett straff', 'Att de flesta människor anser att den är moraliskt fel',
                 'Att någon har blivit ledsen eller arg på grund av den', 'Att polisen själv har sett när den hände'],
                'Att den står beskriven i lag och har ett straff',
                'Ett brott är en handling som står beskriven i brottsbalken eller en annan lag, med ett straff.'),
            val('Vad kallas principen att ingen får straffas för något som inte var ett brott när det hände?',
                ['Legalitetsprincipen', 'Offentlighetsprincipen', 'Löftesprincipen', 'Likhetsprincipen'],
                'Legalitetsprincipen',
                'Ingen får straffas utan stöd i lag, och en handling kan inte bli straffbar i efterhand. Det står '
                'i regeringsformen.'),
            para('Para ihop begreppet med vad det betyder.', [
                ('Uppsåt', 'att göra något med flit'),
                ('Oaktsamhet', 'att vara slarvig eller vårdslös'),
                ('Försök', 'att påbörja ett brott som inte fullbordas'),
                ('Medhjälp', 'att hjälpa någon annan att begå ett brott')],
                'Uppsåt och oaktsamhet är två slags skuld: med flit eller av slarv. Försök och medhjälp kan vara '
                'straffbara även om man inte själv fullbordar brottet.'),
            sant('Huvudregeln i brottsbalken är att en gärning bara är ett brott om den görs med uppsåt.', True,
                 'Bara när lagen säger det räcker oaktsamhet, som vid vållande till annans död.'),
            val('Vilket av de här är ett straff som betalas med pengar?',
                ['Böter', 'Fängelse', 'Skadestånd', 'Gripande'], 'Böter',
                'Böter är ett straff och betalas till staten. Skadestånd är inget straff: det betalas till den som '
                'har skadats.'),
            sant('Den som är misstänkt för ett brott ska behandlas som oskyldig tills en dom har vunnit laga kraft.',
                 True,
                 'Det kallas oskuldspresumtionen. Det är åklagaren som ska bevisa att den misstänkte är skyldig.'),
            val('Vad är nödvärn?',
                ['Rätten att försvara sig mot ett pågående angrepp', 'Rätten att straffa den som tidigare har skadat en',
                 'Polisens rätt att gripa en person som är misstänkt', 'Rätten att vägra vittna mot en släkting'],
                'Rätten att försvara sig mot ett pågående angrepp',
                'Den som angrips får försvara sig, och andra får hjälpa till. Försvaret får inte vara uppenbart '
                'oförsvarligt.'),
            sant('Vid nödvärn får man använda hur mycket våld som helst.', False,
                 'Försvaret får inte vara uppenbart oförsvarligt med tanke på angreppet. Att fortsätta slå någon '
                 'som redan har gett upp är inte nödvärn.'),
        ], beskrivning='Vad ett brott är, uppsåt och oaktsamhet, legalitetsprincipen och nödvärn.'),
        niva('ju-gy1-brott-2', 'Från anmälan till dom', 'Brott och straff', [
            ordna('Ordna stegen i ett brottmål, från början till slut.',
                  ['Anmälan', 'Förundersökning', 'Åtal', 'Huvudförhandling', 'Dom'],
                  forklaring='Efter anmälan utreds brottet i en förundersökning. Räcker bevisen väcker åklagaren '
                             'åtal, och tingsrätten håller huvudförhandling och dömer.'),
            val('Vem bestämmer om en misstänkt ska åtalas?',
                ['Åklagaren', 'Polisen', 'Domaren', 'Brottsoffret'], 'Åklagaren',
                'Åklagaren leder ofta förundersökningen och avgör om bevisen räcker för åtal.'),
            val('Vad kallas den som har utsatts för ett brott, i rättegången?',
                ['Målsägande', 'Tilltalad', 'Försvarare', 'Nämndeman'], 'Målsägande',
                'Målsäganden är brottsoffret. Den som är åtalad kallas den tilltalade.'),
            para('Para ihop rollen med uppgiften i rättegången.', [
                ('Åklagaren', 'för talan mot den tilltalade'),
                ('Försvararen', 'hjälper den tilltalade'),
                ('Domaren', 'leder förhandlingen och dömer'),
                ('Vittnet', 'berättar vad hon eller han har sett')],
                'Åklagaren och försvararen företräder varsin sida, vittnet berättar och domaren leder förhandlingen. '
                'I tingsrätten dömer domaren oftast tillsammans med nämndemän.'),
            sant('För att någon ska dömas måste det vara ställt utom rimligt tvivel att personen har begått brottet.',
                 True,
                 'Beviskravet i brottmål är högt: det är bättre att en skyldig går fri än att en oskyldig döms.'),
            val('Vad gör en offentlig försvarare?',
                ['Försvarar den misstänkte, betald av staten', 'Utreder brottet åt polisen och åklagaren',
                 'Företräder brottsoffret i rätten, betald av staten', 'Bestämmer straffet tillsammans med domaren'],
                'Försvarar den misstänkte, betald av staten',
                'Den som misstänks för ett allvarligt brott har rätt till en offentlig försvarare. Brottsoffret '
                'kan få ett målsägandebiträde.'),
            sant('En dom från tingsrätten går att överklaga till hovrätten.', True,
                 'Både den tilltalade och åklagaren kan överklaga. Hovrätten kan pröva målet igen.'),
            val('Vad betyder det att en dom har vunnit laga kraft?',
                ['Den kan inte längre överklagas', 'Den har lästs upp i rätten',
                 'Den har skrivits under av kungen', 'Den gäller bara i en månad'],
                'Den kan inte längre överklagas',
                'När tiden för att överklaga har gått ut, eller högsta instans har dömt, står domen fast.'),
        ], beskrivning='Förundersökning, åtal, huvudförhandling och dom, och vem som gör vad i rättegången.'),
    ]),

    # ================================================================== gy2
    bana(AMNE, 'gy2', [
        # -------------------------------------------------- Grundlagarna
        niva('ju-gy2-grundlagar-1', 'Fri- och rättigheter', 'Grundlagarna', [
            val('Vilken grundlag ger rätten att ta del av allmänna handlingar?',
                ['Tryckfrihetsförordningen', 'Successionsordningen', 'Regeringsformen', 'Yttrandefrihetsgrundlagen'],
                'Tryckfrihetsförordningen',
                'Rätten att ta del av allmänna handlingar, offentlighetsprincipen, står i '
                'tryckfrihetsförordningen.'),
            sant('Den som begär ut en allmän handling behöver inte säga vem den är eller varför den vill ha handlingen.',
                 True,
                 'Myndigheten får som huvudregel inte fråga. Bara när den måste pröva om handlingen är hemlig får '
                 'den fråga, och då kan man låta bli att svara.'),
            val('Vad innebär censurförbudet?',
                ['Myndigheter får inte granska en skrift innan den ges ut',
                 'Ingen får skriva eller publicera något som är osant',
                 'Tidningar måste visa sina texter för polisen före tryckning',
                 'Det är förbjudet att kritisera regeringen i tidningar'],
                'Myndigheter får inte granska en skrift innan den ges ut',
                'Det som har publicerats kan prövas i efterhand, men ingen myndighet får stoppa det i förväg.'),
            para('Para ihop begreppet med vad det betyder.', [
                ('Allmän handling', 'en handling som en myndighet har fått in eller upprättat'),
                ('Sekretess', 'ett förbud att lämna ut vissa uppgifter'),
                ('Meddelarfrihet', 'rätten att lämna uppgifter till medier för publicering'),
                ('Efterforskningsförbud', 'myndigheter får inte ta reda på vem som har lämnat uppgifter')],
                'Allmänna handlingar är offentliga om de inte omfattas av sekretess. Meddelarfriheten och '
                'efterforskningsförbudet skyddar den som tipsar medierna.'),
            val('Vilka friheter skyddas i regeringsformens andra kapitel?',
                ['Yttrandefrihet, mötesfrihet och religionsfrihet', 'Rätten att få en gratis bostad av sin kommun',
                 'Rätten att slippa betala någon skatt på sin lön', 'Rätten att alltid få det jobb som man har sökt'],
                'Yttrandefrihet, mötesfrihet och religionsfrihet',
                'Fri- och rättigheterna skyddar den enskilde mot det allmänna. Några av dem går att begränsa '
                'genom lag, men bara på vissa villkor.'),
            sant('Yttrandefriheten i Sverige är obegränsad: den kan aldrig begränsas genom lag.', False,
                 'Yttrandefriheten får begränsas genom lag, till exempel med brotten förtal, olaga hot och hets '
                 'mot folkgrupp.'),
            val('Vad kallas det när en domstol låter bli att tillämpa en lag för att den strider mot grundlag?',
                ['Lagprövning', 'Misstroendeförklaring', 'Folkomröstning', 'Prövningstillstånd'], 'Lagprövning',
                'Regeringsformen säger att en domstol eller myndighet inte får tillämpa en regel som strider mot '
                'grundlag. När det gäller en lag ska domstolen särskilt tänka på att riksdagen är folkets främsta '
                'företrädare. Det kallas lagprövning eller normprövning.'),
            sant('Europakonventionen om de mänskliga rättigheterna gäller som lag i Sverige.', True,
                 'Konventionen har varit svensk lag sedan 1995, och enligt regeringsformen får ingen lag eller '
                 'annan föreskrift strida mot den.'),
        ], beskrivning='Offentlighetsprincipen, censurförbudet, meddelarfriheten och fri- och rättigheterna.'),
        niva('ju-gy2-grundlagar-2', 'Riksdagen, lagarna och EU', 'Grundlagarna', [
            val('Vad säger regeringsformen om domstolarnas självständighet?',
                ['Ingen får styra hur en domstol dömer i ett visst mål',
                 'Regeringen får tala om hur en domstol ska döma i ett visst mål',
                 'Riksdagen avgör de mål som har överklagats till Högsta domstolen',
                 'Domstolarna lyder under polisen och åklagaren'],
                'Ingen får styra hur en domstol dömer i ett visst mål',
                'Inte heller riksdagen eller regeringen får bestämma hur en domstol ska döma i ett enskilt fall.'),
            sant('All offentlig makt i Sverige utgår från folket.', True,
                 'Så börjar regeringsformen. Folket väljer riksdagen, som stiftar lagarna och utser '
                 'statsministern.'),
            val('Vad kallas det när riksdagen förklarar att den inte längre har förtroende för en minister?',
                ['Misstroendeförklaring', 'Prövningstillstånd', 'Lagprövning', 'Interpellation'],
                'Misstroendeförklaring',
                'Röstar mer än hälften av riksdagens ledamöter för en misstroendeförklaring måste ministern avgå.'),
            skriv('Hur många ledamöter har riksdagen? Svara med ett tal.', tal(349),
                  'Riksdagen har 349 ledamöter, valda för fyra år i taget.'),
            ordna('Ordna stegen när en ny lag stiftas, från början till slut.',
                  ['En utredning', 'Remiss till myndigheter och organisationer', 'Regeringens proposition',
                   'Behandling i ett utskott', 'Beslut i riksdagen'],
                  forklaring='Utredningens förslag skickas på remiss. Regeringen lägger sedan en proposition, ett '
                             'utskott bereder den, och riksdagen röstar.'),
            val('Vad är en proposition?',
                ['Regeringens förslag till riksdagen', 'En riksdagsledamots förslag',
                 'Ett beslut av Högsta domstolen', 'En lag som redan gäller'],
                'Regeringens förslag till riksdagen',
                'En riksdagsledamots förslag kallas motion. En proposition kommer från regeringen.'),
            sant('Om en svensk lag strider mot EU-rätten ska domstolen som huvudregel tillämpa EU-rätten.', True,
                 'EU-rätten har företräde framför medlemsländernas lagar. En EU-förordning gäller direkt, medan '
                 'ett direktiv först ska föras in i svensk lag.'),
            val('Vilken uppgift har Lagrådet?',
                ['Att granska lagförslag innan riksdagen beslutar', 'Att döma i mål där någon har brutit mot grundlagen',
                 'Att välja ut domare till landets domstolar', 'Att skriva propositionerna åt regeringen'],
                'Att granska lagförslag innan riksdagen beslutar',
                'Lagrådet består av domare från de högsta domstolarna. Det granskar bland annat att förslaget '
                'stämmer med grundlagarna.'),
        ], beskrivning='Domstolarnas självständighet, hur en lag stiftas, propositionen och EU-rättens företräde.'),

        # -------------------------------------------------- Arbetsrätt
        niva('ju-gy2-arbetsratt-1', 'Anställning och uppsägning', 'Arbetsrätt', [
            val('Vilken anställningsform är huvudregeln enligt lagen om anställningsskydd?',
                ['Tillsvidareanställning', 'Provanställning', 'Visstidsanställning', 'Timanställning'],
                'Tillsvidareanställning',
                'En tillsvidareanställning gäller utan slutdatum. Andra former kräver att lagen eller ett '
                'kollektivavtal tillåter dem.'),
            skriv('Hur många månader får en provanställning som längst vara enligt lagen om anställningsskydd? '
                  'Svara med ett tal.', tal(6),
                  'Under prövotiden kan både arbetsgivaren och den anställde avsluta anställningen. Ges inget besked '
                  'i tid om att den ska upphöra går den över i en tillsvidareanställning.'),
            val('Vilka två slags skäl kan en arbetsgivare ha för att säga upp en tillsvidareanställd?',
                ['Arbetsbrist och personliga skäl', 'Ålder och kön', 'Politisk åsikt och religion',
                 'Facklig tillhörighet och graviditet'],
                'Arbetsbrist och personliga skäl',
                'Arbetsbrist betyder att arbetet inte räcker till. Personliga skäl gäller den anställdes egen '
                'person, till exempel misskötsel. De andra är inga godtagbara skäl, och flera av dem är förbjuden '
                'diskriminering.'),
            sant('Vid uppsägning på grund av arbetsbrist gäller som huvudregel turordning: den som har arbetat längst '
                 'hos arbetsgivaren har bäst skydd.', True,
                 'Sist in, först ut. Arbetsgivaren får göra vissa undantag, och ett kollektivavtal kan ha andra '
                 'regler.'),
            val('Vad är ett kollektivavtal?',
                ['Ett avtal mellan en arbetsgivare och ett fackförbund',
                 'Ett avtal mellan två anställda om hur de ska dela på arbetet',
                 'En lag om arbetstider som riksdagen har beslutat', 'Ett avtal mellan staten och kommunerna om skatten'],
                'Ett avtal mellan en arbetsgivare och ett fackförbund',
                'Kollektivavtalet reglerar till exempel löner, arbetstider och försäkringar för många anställda '
                'på en gång.'),
            skriv('Hur många semesterdagar per år har en anställd rätt till enligt semesterlagen? Svara med ett tal.',
                  tal(25),
                  'Semesterlagen ger 25 dagars semester per år. Ett kollektivavtal kan ge fler.'),
            sant('Ett anställningsavtal måste vara skriftligt för att gälla.', False,
                 'Ett muntligt anställningsavtal gäller också. Arbetsgivaren måste ändå ge den anställde skriftlig '
                 'information om de viktigaste villkoren.'),
            para('Para ihop begreppet med vad det betyder.', [
                ('Tillsvidareanställning', 'gäller utan något slutdatum'),
                ('Provanställning', 'en tid då båda prövar om anställningen fungerar'),
                ('Uppsägning', 'anställningen upphör efter en uppsägningstid'),
                ('Avsked', 'anställningen upphör direkt efter grov misskötsel')],
                'Ett avsked är det skarpaste: det kräver att den anställde grovt har brutit mot sina skyldigheter.'),
        ], beskrivning='Anställningsformerna, provanställning, uppsägning, turordning och kollektivavtal.'),
        niva('ju-gy2-arbetsratt-2', 'Facket, arbetsmiljön och diskrimineringen', 'Arbetsrätt', [
            skriv('Hur många diskrimineringsgrunder finns det i diskrimineringslagen? Svara med ett tal.', tal(7),
                  'Kön, könsöverskridande identitet eller uttryck, etnisk tillhörighet, religion eller annan '
                  'trosuppfattning, funktionsnedsättning, sexuell läggning och ålder.'),
            val('Vilken av de här är INTE en diskrimineringsgrund i diskrimineringslagen?',
                ['Politisk åsikt', 'Ålder', 'Funktionsnedsättning', 'Sexuell läggning'], 'Politisk åsikt',
                'Politisk åsikt finns inte bland de sju grunderna. Åsiktsfriheten skyddas i stället av '
                'regeringsformen.'),
            para('Para ihop lagen med vad den handlar om.', [
                ('Arbetsmiljölagen', 'att arbetet inte ska skada hälsan'),
                ('Semesterlagen', 'rätten till ledighet med lön'),
                ('Medbestämmandelagen', 'förhandlingar mellan facket och arbetsgivaren'),
                ('Diskrimineringslagen', 'skydd mot att missgynnas, till exempel för sitt kön')],
                'Arbetsrätten är många lagar. De flesta går att komplettera med kollektivavtal.'),
            sant('När ett kollektivavtal gäller har parterna fredsplikt: de får som huvudregel inte strejka eller ha '
                 'lockout.', True,
                 'Fredsplikten gäller frågor som avtalet reglerar, så länge avtalet gäller.'),
            val('Vad är en lockout?',
                ['Att arbetsgivaren stänger ute de anställda från jobbet', 'Att de anställda vägrar att arbeta för högre lön',
                 'Att en anställd blir avskedad på grund av misskötsel',
                 'Att facket bojkottar ett företag som bryter mot avtalet'],
                'Att arbetsgivaren stänger ute de anställda från jobbet',
                'Lockout är arbetsgivarens stridsåtgärd. När de anställda lägger ner arbetet kallas det strejk.'),
            val('Vem har huvudansvaret för arbetsmiljön på en arbetsplats?',
                ['Arbetsgivaren', 'Varje anställd själv', 'Skyddsombudet', 'Arbetsmiljöverket'], 'Arbetsgivaren',
                'Arbetsgivaren ansvarar. Skyddsombudet företräder de anställda, och Arbetsmiljöverket gör tillsyn.'),
            sant('Det är diskriminering att välja bort en sökande för att hon är gravid.', True,
                 'Det räknas som diskriminering som har samband med kön.'),
            val('Vilken myndighet utreder anmälningar om diskriminering i arbetslivet?',
                ['Diskrimineringsombudsmannen, DO', 'Justitieombudsmannen, JO', 'Arbetsmiljöverket',
                 'Allmänna reklamationsnämnden'],
                'Diskrimineringsombudsmannen, DO',
                'DO tar emot anmälningar och kan driva en sak i domstol för den som har blivit diskriminerad.'),
        ], beskrivning='Diskrimineringsgrunderna, fredsplikt, strejk och lockout, och arbetsmiljöansvaret.'),

        # -------------------------------------------------- Hyra och skulder
        niva('ju-gy2-skulder-1', 'Hyra en bostad', 'Hyra och skulder', [
            sant('Den som har ett förstahandskontrakt på en hyreslägenhet har som huvudregel besittningsskydd: rätt '
                 'att bo kvar när hyresvärden säger upp avtalet.', True,
                 'Hyresvärden behöver ett godtagbart skäl, till exempel att hyran inte betalas eller att '
                 'hyresgästen stör grannarna allvarligt.'),
            val('Vad krävs för att få hyra ut sin hyresrätt i andra hand?',
                ['Hyresvärdens samtycke eller hyresnämndens tillstånd',
                 'Att man har haft hyreskontraktet i minst fem år i följd',
                 'Att grannarna i trappuppgången godkänner det', 'Ingenting, det får man alltid göra som hyresgäst'],
                'Hyresvärdens samtycke eller hyresnämndens tillstånd',
                'Den som hyr ut i andra hand utan lov kan förlora sitt eget hyreskontrakt.'),
            skriv('En hyresgäst säger upp sitt hyresavtal för en lägenhet som hyrs tills vidare. Hur många månaders '
                  'uppsägningstid gäller som huvudregel? Svara med ett tal.', tal(3),
                  'Hyresgästens uppsägningstid är tre månader, räknat från månadsskiftet efter uppsägningen.'),
            val('Vad är hyresnämnden?',
                ['En nämnd som medlar och avgör tvister om hyra', 'Den styrelse som leder ett kommunalt bostadsbolag',
                 'En förening som alla hyresgäster är medlemmar i', 'Kontoret som betalar ut bostadsbidrag till hyresgäster'],
                'En nämnd som medlar och avgör tvister om hyra',
                'Hyresnämnden medlar och avgör vissa tvister, till exempel om andrahandsuthyrning och om en '
                'hyresgäst får bo kvar.'),
            sant('Hyresvärden får gå in i lägenheten när som helst utan att säga till.', False,
                 'Hyresvärden har rätt att komma in för tillsyn och reparationer, men ska som regel säga till i '
                 'förväg.'),
            val('Vad kallas pengar som en hyresgäst betalar i förväg som säkerhet för hyresvärden?',
                ['Deposition', 'Amortering', 'Ränta', 'Borgen'], 'Deposition',
                'Depositionen betalas tillbaka när hyresgästen flyttar, om inget är skadat och hyran är betald.'),
            para('Para ihop ordet med vad det betyder.', [
                ('Hyresgäst', 'den som hyr bostaden'),
                ('Hyresvärd', 'den som hyr ut bostaden'),
                ('Andrahandsuthyrning', 'hyresgästen hyr själv ut bostaden till någon annan'),
                ('Besittningsskydd', 'rätten att bo kvar när avtalet sägs upp')],
                'Hyresreglerna står i jordabalkens tolfte kapitel, som kallas hyreslagen.'),
            sant('En bostadsrätt och en hyresrätt är samma sak.', False,
                 'Med en bostadsrätt köper man en andel i en förening och rätten att bo i lägenheten. Med en '
                 'hyresrätt hyr man av en hyresvärd.'),
        ], beskrivning='Besittningsskydd, andrahandsuthyrning, uppsägning, hyresnämnden och deposition.'),
        niva('ju-gy2-skulder-2', 'Lån, borgen och Kronofogden', 'Hyra och skulder', [
            val('Vad är ett skuldebrev?',
                ['Ett skriftligt löfte att betala tillbaka en skuld',
                 'Ett brev från Kronofogden som kräver betalning av en skuld',
                 'En faktura som en butik skickar för en vara som köpts',
                 'Ett bevis på att en skuld redan har blivit betald'],
                'Ett skriftligt löfte att betala tillbaka en skuld',
                'Den som lånar skriver under ett skuldebrev. Det bevisar skulden och hur den ska betalas.'),
            val('Vad innebär det att gå i borgen för någons lån?',
                ['Att lova att betala om låntagaren inte gör det', 'Att låna ut sina egna pengar till banken i stället',
                 'Att få en del av pengarna i lånet själv', 'Att bli delägare i den bank som ger lånet'],
                'Att lova att betala om låntagaren inte gör det',
                'Borgensmannen kan få betala hela skulden. Därför ska man tänka sig för innan man går i borgen.'),
            sant('En bank måste göra en kreditprövning innan den lånar ut pengar till en konsument.', True,
                 'Konsumentkreditlagen kräver att banken prövar om låntagaren har råd att betala tillbaka.'),
            val('Vad gör Kronofogden?',
                ['Hjälper den som ska ha betalt att driva in skulder', 'Ger lån till den som inte får något lån i en bank',
                 'Dömer i brottmål mot den som har skulder', 'Bestämmer vilken ränta alla banker ska ta ut på sina lån'],
                'Hjälper den som ska ha betalt att driva in skulder',
                'Kronofogden kan besluta om betalningsföreläggande och utmätning, och hjälper också den som har '
                'skulder med skuldsanering.'),
            ordna('Ordna stegen när en räkning inte betalas, från först till sist.',
                  ['Räkningen betalas inte i tid', 'Ett inkassokrav skickas', 'Ansökan om betalningsföreläggande',
                   'Utslag hos Kronofogden', 'Utmätning'],
                  forklaring='Efter inkassokravet kan den som ska ha betalt vända sig till Kronofogden. Bestrids '
                             'inte skulden blir det ett utslag, och sedan kan lön eller egendom utmätas.'),
            val('Vad kan en betalningsanmärkning leda till?',
                ['Svårare att få lån eller hyra en bostad', 'Att man förlorar sin rösträtt i valet',
                 'Att man döms till fängelse för skulden', 'Att man måste flytta sina pengar till en ny bank'],
                'Svårare att få lån eller hyra en bostad',
                'En betalningsanmärkning syns hos kreditupplysningsföretagen. Banker och hyresvärdar tittar på '
                'dem.'),
            sant('Ränta är det pris man betalar för att få låna pengar.', True,
                 'Räntan räknas i procent av lånet. Den som lånar betalar både ränta och amortering.'),
            val('Vad är amortering?',
                ['Att betala av på själva lånet', 'Att betala ränta på lånet', 'Att låna mer pengar',
                 'Att flytta lånet till en annan bank'],
                'Att betala av på själva lånet',
                'När man amorterar minskar skulden. Räntan är kostnaden för att låna och minskar inte skulden.'),
        ], beskrivning='Skuldebrev, borgen, kreditprövning, inkasso, Kronofogden och betalningsanmärkningar.'),

        # -------------------------------------------------- Skadestånd och försäkring
        niva('ju-gy2-skadestand-1', 'Vem betalar skadan?', 'Skadestånd och försäkring', [
            val('Vad krävs som huvudregel för att någon ska bli skadeståndsskyldig enligt skadeståndslagen?',
                ['Att skadan orsakats med flit eller av slarv', 'Att den som skadades saknar en försäkring',
                 'Att polisen har tagit emot en anmälan', 'Att skadan kostar mycket att reparera'],
                'Att skadan orsakats med flit eller av slarv',
                'Huvudregeln är ansvar för vållande: uppsåt eller vårdslöshet. Det kallas culpa.'),
            sant('Ett barn kan bli skyldigt att betala skadestånd.', True,
                 'Också barn kan bli skadeståndsskyldiga. Domstolen tar hänsyn till barnets ålder och mognad när '
                 'den bestämmer beloppet.'),
            val('En anställd på en flyttfirma tappar en kunds soffa under arbetet, och den går sönder. Vem ansvarar i '
                'första hand mot kunden?',
                ['Arbetsgivaren', 'Den anställde själv', 'Kunden själv', 'Försäkringskassan'], 'Arbetsgivaren',
                'Arbetsgivaren svarar för skador som de anställda orsakar i arbetet. Det kallas principalansvar.'),
            para('Para ihop skadan med vad den innebär.', [
                ('Personskada', 'skada på en människas kropp eller hälsa'),
                ('Sakskada', 'skada på en sak, till exempel en cykel'),
                ('Ren förmögenhetsskada', 'en ekonomisk förlust utan att någon person eller sak skadats'),
                ('Kränkning', 'ett brott mot någons frihet, frid eller ära')],
                'Skadeståndslagen skiljer på de här slagen av skada, och reglerna för dem är olika.'),
            sant('Den som blir skadad men själv har bidragit till skadan genom vårdslöshet kan få ett lägre '
                 'skadestånd.', True,
                 'Har den skadade själv bidragit till skadan kan skadeståndet jämkas, alltså sättas ned.'),
            val('Vad menas med adekvat kausalitet?',
                ['Att skadan var en rimligt väntad följd av handlingen',
                 'Att skadan var ovanligt stor och mycket dyr att reparera',
                 'Att två personer orsakade skadan tillsammans', 'Att skadan hände i ett annat land än där man bor'],
                'Att skadan var en rimligt väntad följd av handlingen',
                'Ett långsökt orsakssamband räcker inte. Skadan ska vara en följd man kunde räkna med.'),
            val('Vilken försäkring betalar för personskador i en trafikolycka, oavsett vem som var vållande?',
                ['Trafikförsäkringen', 'Hemförsäkringen', 'Reseförsäkringen', 'Livförsäkringen'],
                'Trafikförsäkringen',
                'Trafikförsäkringen ersätter personskador, också för föraren, utan att någon behöver vara '
                'vållande.'),
            sant('Hemförsäkringens ansvarsdel kan betala när du blir skadeståndsskyldig för att du skadat någon annans '
                 'sak.', True,
                 'Ansvarsförsäkringen i hemförsäkringen gäller när du är skadeståndsskyldig, med en självrisk.'),
        ], beskrivning='Skadeståndslagen: vållande, principalansvar, slagen av skada och medvållande.'),
        niva('ju-gy2-skadestand-2', 'Försäkring och ansvar', 'Skadestånd och försäkring', [
            val('Vad är självrisk?',
                ['Den del av skadan som du själv betalar', 'En försäkring som du tecknar själv',
                 'Risken att råka ut för en olycka', 'En avgift till Kronofogden'],
                'Den del av skadan som du själv betalar',
                'Försäkringen betalar det som blir över självrisken. En högre självrisk ger ofta en lägre premie.'),
            val('Vad kan rättsskyddet i en hemförsäkring betala?',
                ['En del av kostnaden för ombud i vissa tvister', 'Böter som du har dömts att betala till staten för brott',
                 'Hyran under tiden som du är arbetslös', 'Skatten som du ska betala på ett arv'],
                'En del av kostnaden för ombud i vissa tvister',
                'Rättsskyddet hjälper med ombudskostnader i tvister, med en självrisk. Böter betalar ingen '
                'försäkring.'),
            sant('En försäkring kan betala ut mindre om den försäkrade har varit grovt vårdslös.', True,
                 'Ersättningen kan sättas ned vid grov vårdslöshet, till exempel om man lämnar ytterdörren olåst '
                 'och åker bort.'),
            val('Vad kallas det när ett försäkringsbolag, efter att ha betalat sin kund, kräver den som orsakade '
                'skadan på pengarna?',
                ['Regress', 'Amortering', 'Deposition', 'Jämkning'], 'Regress',
                'Försäkringsbolaget tar över kundens rätt till skadestånd och kan kräva den som är ansvarig.'),
            para('Para ihop försäkringen med vad den gäller.', [
                ('Hemförsäkring', 'saker i bostaden och ansvar för skador du orsakar'),
                ('Trafikförsäkring', 'måste finnas för ett fordon i trafik'),
                ('Reseförsäkring', 'sjukdom eller olycka under en resa'),
                ('Olycksfallsförsäkring', 'ersättning när du skadas i en olycka')],
                'Trafikförsäkringen är obligatorisk. De andra väljer man själv.'),
            sant('Trafikförsäkring är frivillig för en bil som används i trafik.', False,
                 'Ett fordon som används i trafik måste ha trafikförsäkring. Det står i trafikskadelagen.'),
            val('Vad är skadestånd?',
                ['Pengar som ska ersätta en skada', 'Ett straff som betalas till staten',
                 'En avgift för att få gå till domstol', 'En försäkring mot olyckor'],
                'Pengar som ska ersätta en skada',
                'Skadeståndet ska försätta den skadade i samma ekonomiska läge som om skadan inte hade hänt.'),
            sant('Böter och skadestånd är samma sak.', False,
                 'Böter är ett straff och betalas till staten. Skadestånd betalas till den som har skadats, för '
                 'att ersätta skadan.'),
        ], beskrivning='Självrisk, rättsskydd, regress och skillnaden mellan böter och skadestånd.'),
    ]),
]
