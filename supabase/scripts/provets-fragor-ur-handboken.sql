-- ============================================================
-- Utbildningsprovet i studiehjälparvyn: frågorna ur Handledarhandboken (2026-10-20)
--
-- Leo, 2026-10-20: "provet ska vara utformat efter det dokumenten, 55% rätt för
-- godkänd". Dokumentet är Handledarhandboken (19 sidor, filen hette
-- Visuell_inlärning.pdf). Det här är inte en migration och registreras inte, som
-- rensa-testkonto.sql: frågorna är data, och de ändras sedan i adminvyn
-- (Ansökningar → Provet i vyn, spara_provfraga), aldrig här.
--
-- 34 frågor med fyra alternativ, i handbokens ordning. 26 är frågorna i provet i
-- ansökan (supabase/functions/_delad/utbildningsprov.ts), ord för ord, och 8 är
-- nya för det som där saknar fråga: inlärningsstilarna (s. 1), att be eleven
-- förklara i stället för att förklara igen (s. 7), interleaving (s. 11), varför
-- nivån kartläggs (s. 13), psykisk ohälsa och sekretessen (s. 15–16), en förälder
-- som är kränkande mot eleven (s. 16–17), att dokumentera objektivt (s. 17–18) och
-- en elev som blir ledsen (s. 18). Varje rätt svar står i handboken.
--
-- FYRA STÅR AVSTÄNGDA: interleaving, psykisk ohälsa, föräldern och att
-- dokumentera objektivt. Leo tog bort frågorna om de ämnena ur provet i ansökan
-- 2026-10-02, efter att ha gjort det själv ("ta bort frågorna", inget skäl
-- skrivet), så bara Leo slår på dem, i vyn. Kvar är 30 aktiva.
--
-- Provet visar alternativen i den ordning de står (mitt_utbildningsprov blandar
-- inte), så det rätta står på olika platser: bland de 30 aktiva 7, 9, 8 och 6
-- gånger, aldrig mer än två i rad på samma plats. Att alltid välja det längsta
-- alternativet ger 2 rätt och det kortaste 7.
--
-- Gränsen blir 55. Godkänt är MER ÄN gränsen (lamna_in_utbildningsprov), och med
-- 30 aktiva frågor krävs 17 rätt (56,7 %; med alla 34 aktiva 19). Mer än 55 % och
-- minst 55 % ger samma krav så länge antalet aktiva frågor inte är 20, 40, 60
-- eller 80.
--
-- Kördes 2026-10-20 i två steg: alla 34 lades in aktiva 19.29 UTC, och de fyra
-- stängdes av 19.31, när det från 2026-10-02 kom fram. Slutläget är det filen
-- lägger in.
--
-- Filen körs bara mot en tom prov_fragor och en gräns som står på 50: allt i en
-- transaktion, och ingen studiehjälpare får spärras av den.
-- ============================================================

do $$
declare
  n integer;
begin
  perform set_config('lock_timeout', '5s', true);
  if exists (select 1 from public.prov_fragor) then
    raise exception 'prov_fragor har redan frågor. Inget lades in.';
  end if;
  if (select i.grans_procent from public.prov_installning i where i.id = 1) is distinct from 50 then
    raise exception 'Gränsen står inte på 50 längre. Inget lades in.';
  end if;

  insert into public.prov_fragor (fraga, alternativ, ratt_svar, ordning, aktiv)
  values
    -- syfte (s. 1)
    ('Vad är enligt handboken det övergripande målet med handledningen?',
     array['Att gå igenom kursens innehåll en gång till, i samma ordning och takt som läraren, så att eleven hänger med i klassen.',
         'Att eleven får så höga resultat som möjligt på nästa prov, så att familjen ser att läxhjälpen ger något.',
         'Att eleven på lång sikt blir en självständig och trygg lärande individ med goda studievanor.',
         'Att eleven blir klar med sina läxor varje vecka, så att inget ligger efter inför proven.']::text[], 2, 10, true),
    -- inlarningsstil (s. 1), ny
    ('Vilket arbetssätt hör enligt handboken till kinestetisk inlärning?',
     array['Tankekartor, färgkodning och diagram som eleven tittar på medan du förklarar.',
         'Praktiska övningar där eleven själv skriver, ritar och löser problem.',
         'Diskussioner och muntliga förklaringar där ni resonerar högt tillsammans.',
         'Att eleven läser samma sida flera gånger, tills innehållet känns bekant.']::text[], 1, 20, true),
    -- metod (s. 1)
    ('Du vet inte vilket arbetssätt som passar din nya elev bäst. Vad gör du?',
     array['Provar olika arbetssätt, ser vad som håller elevens fokus och noterar vad som fungerar.',
         'Använder muntliga genomgångar, eftersom de fungerar för de flesta elever i den åldern.',
         'Frågar eleven hur hen lär sig bäst första gången ni ses, och håller dig sedan till det svaret resten av terminen.',
         'Väntar tills föräldern har berättat vilken metod skolan använder, så att ni inte krockar med läraren.']::text[], 0, 30, true),
    -- intresse (s. 2)
    ('Din elev älskar fotboll men tycker att procent är tråkigt. Hur använder du intresset bäst?',
     array['Eleven får välja fritt vad ni pratar om, så länge hen trivs och vill komma tillbaka.',
         'Ni räknar procent på riktiga matchresultat och statistik, så att matten känns meningsfull.',
         'Ni pratar fotboll den första halvan av passet, så att eleven kommer i gott humör inför matten efteråt.',
         'Du håller fotbollen utanför passet helt, eftersom den tar fokus från det eleven ska lära sig.']::text[], 1, 40, true),
    -- material (s. 3)
    ('Vilket material ska du i första hand utgå från?',
     array['Övningsblad från internet som täcker hela kursen, så att eleven får träna på allt inför terminen.',
         'Det som eleven tycker är roligast just nu.',
         'Elevens läroböcker och uppgifter från skolan, lärarens instruktioner och kommande prov.',
         'Ditt eget material, eftersom du vet vad som har fungerat för dig och kan förklara det bäst.']::text[], 2, 50, true),
    -- eget-material (s. 4)
    ('När är det rätt att använda eget material, till exempel extra övningar eller en egen bild?',
     array['Alltid, så att eleven får en egen undervisning vid sidan av skolan som går lite längre.',
         'Aldrig. Handledningen ska bara använda det material som skolan och läraren har delat ut.',
         'Som ett komplement när det behövs, inte som en ersättning för det eleven gör i skolan.',
         'Bara de veckor då eleven inte har några läxor eller prov att förbereda sig inför.']::text[], 2, 60, true),
    -- undvik (s. 4)
    ('Vad ska du undvika enligt handboken?',
     array['Att anpassa svårighetsgraden efter eleven i stället för att följa klassens nivå.',
         'Sarkasm och att jämföra eleven med andra elever.',
         'Att låta eleven göra misstag.',
         'Att fråga vad eleven själv tror är nästa steg, eftersom det kan göra hen osäker.']::text[], 1, 70, true),
    -- fel-svar (s. 6)
    ('Eleven svarar fel på en fråga. Vilket svar följer handboken?',
     array['"Jag förstår hur du tänkte. Ska vi titta på det tillsammans?"',
         '"Nej, det blev fel. Försök igen."',
         '"Din klasskompis fick samma uppgift och klarade den, så jag vet att du också kan."',
         '"Det här borde du kunna vid det här laget, vi gick ju igenom samma sak förra veckan."']::text[], 0, 80, true),
    -- berom (s. 6)
    ('Vad ska ditt beröm i första hand handla om?',
     array['Att eleven gör det bättre än sina klasskompisar, eftersom det motiverar mest.',
         'Bara rätta svar, så att berömmet betyder något när det väl kommer.',
         'Att eleven är smart och har talang för ämnet, så att hen får tro på sig själv.',
         'Ansträngningen och strategin, till exempel att eleven delade upp problemet.']::text[], 3, 90, true),
    -- tystnad (s. 6)
    ('Eleven blir tyst en stund efter din fråga. Vad gör du?',
     array['Ger svaret och visar hur man kommer fram till det, så att ni hinner mer under passet.',
         'Förklarar direkt en gång till på ett annat sätt, så att tystnaden inte hinner bli obekväm.',
         'Går vidare till nästa uppgift.',
         'Väntar några sekunder och frågar sedan: "Hur tänker du?"']::text[], 3, 100, true),
    -- svarighet (s. 6–7)
    ('Hur svåra ska uppgifterna vara?',
     array['Så svåra som möjligt, eftersom det är när man kämpar som man lär sig mest.',
         'Så att eleven utmanas men kan lyckas med stöd.',
         'På samma nivå som resten av klassen, så att eleven inte halkar efter.',
         'Så lätta att eleven alltid lyckas, för att bygga upp självförtroendet först.']::text[], 1, 110, true),
    -- dalig-pa-matte (s. 6–7)
    ('Eleven säger: "Jag är dålig på matte." Vad svarar du?',
     array['"Då får vi köra extra hårt de närmaste veckorna, så att du slipper känna så längre."',
         '"Det är svårt just nu, men det betyder inte att du inte kan lära dig det. Vi tar det steg för steg."',
         '"Nej, det är du inte alls. Du är jätteduktig egentligen, du tror bara att du är dålig på det."',
         '"Det är okej, alla kan inte vara bra på matte. Vi fokuserar på att du klarar provet."']::text[], 1, 120, true),
    -- fastnar (s. 7)
    ('Eleven har fastnat på en uppgift. Vad gör du först?',
     array['Säger att ni hoppar över den nu och tar den nästa gång, när eleven är piggare.',
         'Förklarar samma sak en gång till, långsammare och med andra ord.',
         'Frågar vilken del som känns svårast, i stället för att ge svaret.',
         'Visar hela lösningen steg för steg, så att eleven ser hur man gör och kan härma det.']::text[], 2, 130, true),
    -- forklara-igen (s. 7), ny
    ('Eleven säger att hen inte förstod din förklaring. Vad föreslår handboken att du gör?',
     array['Ber eleven förklara hur hen tänker, så att ni hittar var det tar stopp.',
         'Går vidare till nästa uppgift, eftersom det ofta lossnar av sig självt senare.',
         'Förklarar samma sak en gång till, lite långsammare och med tydligare ord.',
         'Visar hela lösningen steg för steg, så att eleven kan skriva av den i lugn och ro.']::text[], 0, 140, true),
    -- chunking (s. 9)
    ('Eleven ska plugga ett helt kapitel och känner sig överväldigad. Vilken teknik hjälper mest just då?',
     array['Chunking: dela upp kapitlet och ta ett begrepp i taget.',
         'Spaced repetition: vänta några dagar innan ni börjar, så att det hinner sjunka in.',
         'Att läsa hela kapitlet flera gånger i rad.',
         'Interleaving: blanda in uppgifter från andra kapitel och ämnen, så att det blir variation.']::text[], 0, 150, true),
    -- recall (s. 9–10)
    ('Vilket är ett exempel på active recall (aktiv återhämtning)?',
     array['Eleven läser samma sida tre gånger och markerar det som känns viktigast.',
         'Eleven stryker under det viktigaste i texten och skriver av det i sitt block.',
         'Eleven förklarar med egna ord det ni gick igenom förra veckan, utan boken.',
         'Du sammanfattar lektionen för eleven, så att hen har allt samlat på ett ställe.']::text[], 2, 160, true),
    -- spaced (s. 10)
    ('Vad innebär spaced repetition (utspridd repetition)?',
     array['Att göra tio likadana uppgifter i rad, så att metoden sätter sig ordentligt.',
         'Att plugga intensivt kvällen före provet.',
         'Att repetera allt som eleven har läst varje dag, i samma takt hela terminen.',
         'Att repetera med allt längre mellanrum, innan kunskapen hunnit glömmas.']::text[], 3, 170, true),
    -- interleaving (s. 11), ny, avstängd
    ('Vad innebär interleaving (varierad träning)?',
     array['Att blanda olika sorters uppgifter i samma pass, så att eleven själv måste välja metod.',
         'Att repetera samma område med allt längre mellanrum, innan kunskapen hinner glömmas.',
         'Att göra många likadana uppgifter i rad, tills eleven känner igen mönstret och kan det.',
         'Att dela upp ett stort kapitel i mindre delar och ta ett begrepp i taget, i lugn takt.']::text[], 0, 180, false),
    -- dokumentera-vad (s. 11)
    ('Vad ska du dokumentera efter varje lektion?',
     array['Hur länge passet varade och vilka sidor i boken ni hann med, så att familjen kan se tiden.',
         'Ingenting om lektionen gick bra. Det räcker att skriva när något har gått snett.',
         'Vad ni gjorde, vad eleven kan, vad som ska utvecklas, vilka metoder som fungerade och nästa mål.',
         'Din personliga uppfattning om elevens familj och hemsituation, så att nästa studiehjälpare vet.']::text[], 2, 190, true),
    -- dokumentera-var (s. 11)
    ('Var dokumenterar du lektionen?',
     array['I Nextrums system, i rapporten efter passet.',
         'I ett mejl till Nextrum efter passet.',
         'I en chatt med eleven, så att ni båda kan gå tillbaka och läsa.',
         'I ett eget dokument på din dator, som du tar med dig till nästa pass.']::text[], 0, 200, true),
    -- forsta-mal (s. 12)
    ('Vad är huvudmålet med den första lektionen?',
     array['Att hinna gå igenom så mycket av kursen som möjligt, så att familjen ser att det ger resultat direkt.',
         'Att bygga förtroende och förstå elevens behov, nivå och sätt att plugga.',
         'Att gå igenom reglerna för passen och vad som händer om eleven inte har gjort läxan.',
         'Att ge eleven ett diagnostiskt prov med betyg, så att ni vet exakt var ni står.']::text[], 1, 210, true),
    -- lara-kanna (s. 13)
    ('Vilken fråga passar bäst när du lär känna eleven första gången?',
     array['"Hur går det hemma mellan dina föräldrar?"',
         '"Hur brukar du plugga inför prov?"',
         '"Varför har du så svårt i skolan?"',
         '"Har du pojkvän eller flickvän?"']::text[], 1, 220, true),
    -- kartlagga (s. 13), ny
    ('Varför kartlägger du elevens nivå på första lektionen?',
     array['För att kunna berätta för föräldrarna vilket betyg eleven ligger på i ämnet just nu, inför nästa prov.',
         'För att visa eleven tydligt vad hen inte kan än, så att hen förstår varför handledningen behövs.',
         'För att kunna jämföra eleven med dina andra elever och se vem av dem som behöver mest av din tid.',
         'För att förstå var eleven står och lägga undervisningen på rätt nivå, inte för att sätta betyg.']::text[], 3, 230, true),
    -- avsluta (s. 14)
    ('Hur avslutar du den första lektionen?',
     array['Du sammanfattar vad ni gjort, vad som fungerade och vad nästa lektion ska handla om.',
         'Du ger eleven ett prov att göra hemma till nästa gång, så att du ser vad som har fastnat.',
         'Du ger eleven en lista på allt hen behöver bli bättre på, så att hen vet var ni ska lägga fokus.',
         'Ni slutar när tiden är slut.']::text[], 0, 240, true),
    -- aldrig (s. 15)
    ('Vilket av följande ska du aldrig göra?',
     array['Lova en förälder att eleven kommer att få ett visst betyg.',
         'Höra av dig till Nextrum när du känner dig obekväm i en situation med en familj.',
         'Låta eleven välja mellan två olika sätt att arbeta med samma uppgift.',
         'Säga till eleven att det är okej att göra misstag.']::text[], 0, 250, true),
    -- psykisk-ohalsa (s. 15–16), ny, avstängd
    ('En elev berättar att hen mår dåligt och har ångest, och ber dig lova att inte säga något till någon. Vad gör du?',
     array['Frågar mer för att förstå om det är ångest eller panikattacker, så att du kan ge eleven rätt råd direkt.',
         'Byter försiktigt till läxan igen, eftersom elevens mående inte hör till din roll som studiehjälpare.',
         'Lovar att inte säga något, så att eleven vågar fortsätta berätta, och frågar hur det känns nästa gång.',
         'Lyssnar lugnt och tackar för förtroendet, men lovar inte att hålla det hemligt och följer Nextrums rutiner.']::text[], 3, 260, false),
    -- sjalvskada (s. 16)
    ('En elev säger något om att skada sig själv, men verkar skämta. Vad gäller?',
     array['Du bedömer själv hur allvarligt det är innan du säger något, så att du inte oroar familjen i onödan.',
         'Du pratar med eleven om det varje lektion tills det känns bättre, och berättar för Nextrum om det inte gör det.',
         'Du tar det alltid på allvar: lyssnar, dokumenterar och följer Nextrums rutiner direkt, aldrig på egen hand.',
         'Skämtar eleven behöver du inte göra något, men du skriver en rad om det i rapporten.']::text[], 2, 270, true),
    -- forelder-aggressiv (s. 16–17), ny, avstängd
    ('Under ett pass hör du en förälder kalla eleven dum och hota med straff. Vad gör du?',
     array['Avbryter passet och går därifrån, och väntar med att berätta för någon tills du har sett att det händer en gång till.',
         'Säger åt föräldern på skarpen att sluta, så att eleven ser att någon står på hens sida och tar hens parti mot föräldern.',
         'Låtsas inte märka något och fortsätter passet, eftersom det som händer i familjen inte är din sak att lägga dig i.',
         'Behåller ett lugnt, professionellt bemötande utan att gå in i en konflikt, dokumenterar objektivt och berättar för Nextrum.']::text[], 3, 280, false),
    -- oro-hemma (s. 17)
    ('Eleven säger i förbifarten att hen inte vågar gå hem när det blir bråk, och ber dig glömma det. Vad gör du?',
     array['Respekterar elevens önskan och låter det vara, men håller extra koll och skriver ner det om eleven säger något liknande igen.',
         'Berättar för Nextrum vid nästa avstämning, eftersom det är Nextrum och inte du som avgör om något ska anmälas.',
         'Tar reda på mer själv, genom att fråga eleven om detaljer och prata med föräldern, så att det du rapporterar stämmer.',
         'Skriver ner vad eleven sa, när och i vilket sammanhang, och kontaktar Nextrum och socialtjänsten så snart som möjligt.']::text[], 3, 290, true),
    -- dokumentera-oro (s. 17–18), ny, avstängd
    ('Hur skriver du när du dokumenterar något som oroar dig?',
     array['Objektivt och faktabaserat: vad som sades och sågs, när det hände och i vilket sammanhang.',
         'Kortfattat och utan detaljer, så att ingen kan peka ut eleven om fel person läser texten.',
         'Med dina egna tolkningar av vad som egentligen ligger bakom, så att Nextrum förstår helheten.',
         'Först när du vet säkert vad som har hänt, så att inget som inte stämmer hamnar i rapporten.']::text[], 0, 300, false),
    -- vagrar (s. 17–18)
    ('Eleven vägrar arbeta. Vad gör du?',
     array['Säger bestämt att ni inte slutar förrän uppgiften är klar, så att eleven lär sig att det inte lönar sig.',
         'Undviker en maktkamp, försöker förstå varför och förenklar uppgiften eller ger eleven ett val.',
         'Låter eleven göra något annat resten av passet och skriver i rapporten att hen inte ville.',
         'Säger till föräldern efter passet att eleven är lat och behöver mer disciplin hemma.']::text[], 1, 310, true),
    -- frustrerad (s. 18), ny
    ('Eleven blir frustrerad och börjar gråta över en uppgift. Vad gör du?',
     array['Avslutar passet direkt och skriver i rapporten att eleven inte orkade, så att ni tar nya tag nästa vecka.',
         'Behåller lugnet, ger eleven tid, bekräftar känslan och hjälper hen tillbaka till arbetet i lagom takt.',
         'Säger att det inte är något att gråta över och att ni behöver bli klara med uppgiften innan passet slutar.',
         'Ger eleven svaret på uppgiften, så att hen slipper känna sig misslyckad och kan gå vidare till nästa.']::text[], 1, 320, true),
    -- sekretess (s. 18)
    ('En kompis frågar hur det går för eleven du hjälper. Vad gäller?',
     array['Det går bra så länge du inte har skrivit under något avtal om tystnadsplikt med Nextrum.',
         'Det går bra att berätta så länge du inte säger elevens efternamn eller vilken skola hen går på.',
         'Du berättar ingenting. Det om eleven delas bara med dem som behöver det i arbetet.',
         'Det går bra att berätta positiva saker, till exempel att eleven har höjt sig på ett prov.']::text[], 2, 330, true),
    -- barnkonventionen (s. 18)
    ('Vad innebär barnkonventionen för dig som studiehjälpare?',
     array['Den är en rekommendation från FN som bara gäller skolor och myndigheter, inte läxhjälp.',
         'Att föräldern alltid bestämmer vad som är bäst för barnet, också under passet.',
         'Att barn under 15 år inte får ha läxhjälp utan att en förälder är med i rummet.',
         'Den är svensk lag, och barnets bästa ska beaktas i beslut som rör barnet.']::text[], 3, 340, true);
  get diagnostics n = row_count;
  if n <> 34 then
    raise exception 'Bara % frågor lades in, inte 34.', n;
  end if;

  update public.prov_installning set grans_procent = 55, andrad_at = now(), andrad_av = null where id = 1;

  -- Spärren gäller nu (minst fem aktiva frågor). Ingen som redan arbetar får
  -- stängas ute av den här filen: de godkända är undantagna sedan 2026-10-21.
  select count(*) into n from public.tutor_profiles t where intern.provet_sparrar(t.id);
  if n > 0 then
    raise exception '% studiehjälpare skulle spärras. Inget lades in.', n;
  end if;
end $$;
