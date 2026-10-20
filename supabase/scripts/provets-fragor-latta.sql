-- ============================================================
-- Utbildningsprovet i studiehjälparvyn: 26 lättare frågor ur Handledarhandboken (2026-10-20)
--
-- Leo, 2026-10-20: "ta bort gamla och ersätt med nya på 26 frågor, 55% rätt släpper in
-- läxhjälparen i sin vy, provet ska bara göras en gång, vid aktivering av konto. först
-- välja lösenord och sen provet på 26 frågor utifrån dokumentet, gör provet relativt
-- lätt". Det här är den andra omgången efter provets-fragor-ur-handboken.sql, som lade
-- in 34 frågor samma kväll. Ingen migration, och den registreras inte.
--
-- Samma 26 ämnen som provet i ansökan hade (Leo tog bort de andra 2026-10-02), skrivna
-- om så att provet blir lättare: kortare frågor, tre alternativ i stället för fyra, det
-- rätta nära handbokens ord och de fel som går emot den. Raderna skrivs över där de står,
-- för ingen har gjort provet (prov_forsok är tom), och de åtta som blir över stängs av
-- och läggs sist (ordning 900 och uppåt): ingen fråga tas bort.
--
-- Formen säger inget: det rätta är längst i 8 frågor, kortast i 9 och mittemellan i 9,
-- och det står på plats 1, 2 och 3 9, 9 och 8 gånger, aldrig mer än två i rad. Godkänt
-- är mer än 55 %, alltså 15 rätt av 26 (57,7 %), och ingen tumregel ger mer än 9.
--
-- Kördes 2026-10-20 19.44 UTC. Driften har samma kontrollsumma över de aktiva frågorna
-- (fråga, alternativ, rätt svar, ordning) som filen: 53fc228a4285b0f9c21bfb89e75d0d56.
-- ============================================================

do $$
declare
  n integer;
begin
  perform set_config('lock_timeout', '5s', true);
  if exists (select 1 from public.prov_forsok) then
    raise exception 'Någon har gjort provet. Frågorna skrivs inte över. Inget ändrades.';
  end if;

  create temp table nya_fragor (ordning_nu integer, fraga_nu text, fraga text, alternativ text[],
                                ratt_svar smallint, ordning integer) on commit drop;
  insert into nya_fragor values
    -- syfte (s. 1)
    (10, 'Vad är enligt handboken det övergripande målet med handledningen?',
     'Vad är målet med handledningen enligt handboken?',
     array['Att eleven hinner göra så många uppgifter som möjligt under varje pass.',
             'Att eleven får rätt svar på läxorna så snabbt som möjligt, varje vecka.',
             'Att eleven blir självständig och får goda studievanor på lång sikt.']::text[], 2, 10),
    -- metod (s. 1)
    (30, 'Du vet inte vilket arbetssätt som passar din nya elev bäst. Vad gör du?',
     'Du vet inte vilket arbetssätt som passar din elev. Vad gör du?',
     array['Testar olika arbetssätt och ser vad som fungerar bäst för eleven.',
             'Låter bli att fundera på det och kör samma upplägg varje gång.',
             'Använder samma arbetssätt som du själv tyckte om i skolan.']::text[], 0, 20),
    -- intresse (s. 2)
    (40, 'Din elev älskar fotboll men tycker att procent är tråkigt. Hur använder du intresset bäst?',
     'Din elev älskar fotboll. Hur kan du använda det?',
     array['Inte alls, fotboll har inget med skolan att göra.',
             'Räkna procent och statistik med riktiga matchresultat.',
             'Prata fotboll hela passet så att eleven får en rolig stund.']::text[], 1, 30),
    -- material (s. 3)
    (50, 'Vilket material ska du i första hand utgå från?',
     'Vilket material utgår du i första hand från?',
     array['Elevens läroböcker och uppgifter från skolan.',
             'Ditt eget material, som du har gjort själv hemma.',
             'Det du hittar först när du söker efter övningar på nätet.']::text[], 0, 40),
    -- eget-material (s. 4)
    (60, 'När är det rätt att använda eget material, till exempel extra övningar eller en egen bild?',
     'När får du använda eget material, till exempel extra övningar?',
     array['Som ett komplement när det behövs, inte i stället för skolans.',
             'Aldrig. Du får bara använda det material som skolan delat ut.',
             'Alltid, eftersom ditt eget material oftast är bättre än skolans.']::text[], 0, 50),
    -- undvik (s. 4)
    (70, 'Vad ska du undvika enligt handboken?',
     'Vad ska du undvika under en lektion?',
     array['Att låta eleven ställa frågor när hen inte förstår.',
             'Att berömma eleven varje gång hen har ansträngt sig.',
             'Sarkasm och att jämföra eleven med andra elever.']::text[], 2, 60),
    -- fel-svar (s. 6)
    (80, 'Eleven svarar fel på en fråga. Vilket svar följer handboken?',
     'Eleven svarar fel. Vad säger du?',
     array['"Fel igen. Vi går vidare, det här tar för lång tid."',
             '"Jag förstår hur du tänkte. Ska vi titta på det tillsammans?"',
             '"Nej, det där är fel. Det borde du kunna vid det här laget."']::text[], 1, 70),
    -- berom (s. 6)
    (90, 'Vad ska ditt beröm i första hand handla om?',
     'Vad ska ditt beröm främst handla om?',
     array['Ansträngningen och strategin, inte bara resultatet.',
             'Att eleven är smartare än sina klasskompisar.',
             'Bara när eleven får allt rätt på första försöket.']::text[], 0, 80),
    -- tystnad (s. 6)
    (100, 'Eleven blir tyst en stund efter din fråga. Vad gör du?',
     'Eleven blir tyst efter din fråga. Vad gör du?',
     array['Ger svaret direkt, så att tystnaden inte blir pinsam.',
             'Går vidare till nästa uppgift med en gång.',
             'Väntar några sekunder och frågar: "Hur tänker du?"']::text[], 2, 90),
    -- svarighet (s. 6–7)
    (110, 'Hur svåra ska uppgifterna vara?',
     'Hur svåra ska uppgifterna vara?',
     array['Så svåra som möjligt, så att eleven lär sig mest.',
             'Lagom: eleven utmanas men kan lyckas med stöd.',
             'Så lätta att eleven aldrig gör fel på någon uppgift.']::text[], 1, 100),
    -- dalig-pa-matte (s. 6–7)
    (120, 'Eleven säger: "Jag är dålig på matte." Vad svarar du?',
     'Eleven säger: "Jag är dålig på matte." Vad svarar du?',
     array['"Nej, det är du inte alls. Sluta säga så."',
             '"Ja, alla kan inte vara bra på allt, det är okej."',
             '"Det går att lära sig. Vi tar det steg för steg."']::text[], 2, 110),
    -- fastnar (s. 7)
    (130, 'Eleven har fastnat på en uppgift. Vad gör du först?',
     'Eleven har fastnat på en uppgift. Vad gör du först?',
     array['Frågar vilken del som känns svårast.',
             'Ger svaret så att ni kan gå vidare.',
             'Säger att eleven får lösa den själv hemma.']::text[], 0, 120),
    -- chunking (s. 9)
    (150, 'Eleven ska plugga ett helt kapitel och känner sig överväldigad. Vilken teknik hjälper mest just då?',
     'Ett kapitel känns för stort för eleven. Vad hjälper?',
     array['Att hoppa över kapitlet och ta nästa i stället.',
             'Att dela upp det i mindre delar och ta en sak i taget.',
             'Att läsa hela kapitlet flera gånger i rad.']::text[], 1, 130),
    -- recall (s. 9–10)
    (160, 'Vilket är ett exempel på active recall (aktiv återhämtning)?',
     'Vilket är ett exempel på active recall (aktiv återhämtning)?',
     array['Eleven läser samma sida flera gånger.',
             'Eleven stryker under det viktiga med överstrykningspenna.',
             'Eleven förklarar med egna ord, utan att titta i boken.']::text[], 2, 140),
    -- spaced (s. 10)
    (170, 'Vad innebär spaced repetition (utspridd repetition)?',
     'Vad innebär spaced repetition (utspridd repetition)?',
     array['Att plugga in allt på en gång kvällen före provet.',
             'Att göra exakt samma uppgift tio gånger i rad direkt.',
             'Att repetera med längre och längre mellanrum.']::text[], 2, 150),
    -- dokumentera-vad (s. 11)
    (190, 'Vad ska du dokumentera efter varje lektion?',
     'Vad ska du dokumentera efter varje lektion?',
     array['Ingenting, så länge lektionen gick bra och inget hände.',
             'Vad ni gjorde, vad eleven kan och vad ni gör nästa gång.',
             'Vad du tycker om elevens familj och hur de har det hemma.']::text[], 1, 160),
    -- dokumentera-var (s. 11)
    (200, 'Var dokumenterar du lektionen?',
     'Var dokumenterar du lektionen?',
     array['I ett eget dokument på din dator.',
             'I Nextrums system, i rapporten efter passet.',
             'I ett mejl till Nextrum när du kommit hem.']::text[], 1, 170),
    -- forsta-mal (s. 12)
    (210, 'Vad är huvudmålet med den första lektionen?',
     'Vad är det viktigaste på första lektionen?',
     array['Att bygga förtroende och lära känna eleven och hens behov.',
             'Att hinna gå igenom så mycket av kursen som möjligt.',
             'Att ge eleven ett prov med betyg direkt.']::text[], 0, 180),
    -- lara-kanna (s. 13)
    (220, 'Vilken fråga passar bäst när du lär känna eleven första gången?',
     'Vilken fråga passar när du lär känna eleven?',
     array['"Varför är du så dålig i skolan egentligen?"',
             '"Hur mycket tjänar dina föräldrar?"',
             '"Hur brukar du plugga inför prov?"']::text[], 2, 190),
    -- avsluta (s. 14)
    (240, 'Hur avslutar du den första lektionen?',
     'Hur avslutar du första lektionen?',
     array['Sammanfattar vad ni gjort och vad nästa lektion handlar om.',
             'Ger eleven en lång lista på allt som hen är dålig på.',
             'Slutar mitt i en uppgift när tiden är slut.']::text[], 0, 200),
    -- aldrig (s. 15)
    (250, 'Vilket av följande ska du aldrig göra?',
     'Vad ska du aldrig göra?',
     array['Säga till eleven att det är okej att göra misstag ibland.',
             'Lova en förälder att eleven får ett visst betyg.',
             'Höra av dig till Nextrum om något känns fel med en familj.']::text[], 1, 210),
    -- sjalvskada (s. 16)
    (270, 'En elev säger något om att skada sig själv, men verkar skämta. Vad gäller?',
     'En elev säger något om att skada sig själv men verkar skämta. Vad gör du?',
     array['Inget, eftersom eleven verkar skämta.',
             'Löser det själv med eleven, utan att berätta för Nextrum.',
             'Tar det på allvar och följer Nextrums rutiner direkt.']::text[], 2, 220),
    -- oro-hemma (s. 17)
    (290, 'Eleven säger i förbifarten att hen inte vågar gå hem när det blir bråk, och ber dig glömma det. Vad gör du?',
     'Eleven säger att hen inte vågar gå hem och ber dig glömma det. Vad gör du?',
     array['Glömmer det, som eleven bad om, och fortsätter med läxan som vanligt.',
             'Skriver ner vad som sades och kontaktar Nextrum och socialtjänsten direkt.',
             'Tar reda på mer själv genom att ringa och prata med elevens föräldrar.']::text[], 1, 230),
    -- vagrar (s. 17–18)
    (310, 'Eleven vägrar arbeta. Vad gör du?',
     'Eleven vägrar arbeta. Vad gör du?',
     array['Säger bestämt att ni inte slutar förrän den är klar.',
             'Försöker förstå varför och gör uppgiften enklare.',
             'Avbryter passet direkt och går hem.']::text[], 1, 240),
    -- sekretess (s. 18)
    (330, 'En kompis frågar hur det går för eleven du hjälper. Vad gäller?',
     'En kompis frågar hur det går för eleven du hjälper. Vad gör du?',
     array['Berättar ingenting. Det som rör eleven stannar i jobbet.',
             'Berättar gärna, så länge du inte säger vad eleven heter.',
             'Berättar allt, det är ju bara en kompis och ingen främling.']::text[], 0, 250),
    -- barnkonventionen (s. 18)
    (340, 'Vad innebär barnkonventionen för dig som studiehjälpare?',
     'Vad innebär barnkonventionen?',
     array['Den är svensk lag: barnets bästa ska alltid beaktas.',
             'Den säger att föräldrarna alltid bestämmer allt om barnet.',
             'Den gäller bara skolor och myndigheter, inte läxhjälp.']::text[], 0, 260);

  -- Raderna ska stå som den första omgången lämnade dem.
  select count(*) into n from nya_fragor x join public.prov_fragor f
    on f.ordning = x.ordning_nu and f.fraga = x.fraga_nu and f.aktiv;
  if n <> 26 then
    raise exception 'Bara % av 26 frågor stod som väntat. Inget ändrades.', n;
  end if;

  -- Först de åtta som blir över, medan ordningen fortfarande pekar ut dem.
  update public.prov_fragor f
     set aktiv = false, ordning = 900 + f.ordning / 10, andrad_at = now()
   where f.ordning in (20, 140, 180, 230, 260, 280, 300, 320);
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'Stängde av % frågor, inte 8. Inget ändrades.', n;
  end if;

  update public.prov_fragor f
     set fraga = x.fraga, alternativ = x.alternativ, ratt_svar = x.ratt_svar, ordning = x.ordning,
         aktiv = true, andrad_at = now()
    from nya_fragor x
   where f.ordning = x.ordning_nu and f.fraga = x.fraga_nu;
  get diagnostics n = row_count;
  if n <> 26 then
    raise exception 'Skrev över % frågor, inte 26. Inget ändrades.', n;
  end if;

  if (select count(*) from public.prov_fragor where aktiv) <> 26 then
    raise exception 'Antalet aktiva blev inte 26. Inget ändrades.';
  end if;
  select count(*) into n from public.tutor_profiles t where intern.provet_sparrar(t.id);
  if n > 0 then
    raise exception '% studiehjälpare skulle spärras. Inget ändrades.', n;
  end if;
end $$;
