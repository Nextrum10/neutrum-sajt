# Dataskydd: register, bedömning och rutiner

Det här är Nextrums dataskydd på pappret: det GDPR kräver att vi kan
visa upp om Integritetsskyddsmyndigheten (IMY) frågar. Integritetspolicyn
(`integritetspolicy.html`, båda språken) är det vi säger till familjerna;
den här filen är det vi själva håller reda på.

`.vercelignore` utesluter `*.md`, så filen serveras inte.

**Förbehåll.** Skrivet 2026-09-27 utifrån lagtext, EDPB:s riktlinjer och
IMY:s beslut, inte av en jurist. Låt en jurist med dataskydd som område
läsa den här filen och integritetspolicyn innan bolaget registreras.

**Ändras vad som sparas, till vem det går eller hur länge: ändra den här
filen och integritetspolicyn på båda språken i samma ändring.**

---

## 1. Vem som ansvarar

Leo Constantinos Thriskos och Alexandar Jovanovic är
personuppgiftsansvariga som privatpersoner tills Nextrum AB är
registrerat. Då byts ansvaret till bolaget, och policyn får
organisationsnummer.

Vi behöver inget dataskyddsombud (art. 37): vi är inte en myndighet, och
kärnverksamheten är inte storskalig övervakning eller storskalig
behandling av känsliga uppgifter. Frågan kommer tillbaka om verksamheten
växer kraftigt.

Kontakt för den registrerade: info@nextrum.se.

---

## 2. Registret över behandlingar (art. 30)

Undantaget för företag med färre än 250 anställda gäller inte oss:
behandlingen är inte tillfällig, och den rör barn. Registret ska alltså
finnas. Det här är det.

| # | Behandling | Registrerade | Uppgifter | Grund (art. 6) | Mottagare utanför oss | Lagringstid |
|---|---|---|---|---|---|---|
| 1 | Intresseanmälan (`leads`) | förälder, barn | förälderns namn, e-post, telefon; barnets namn, årskurs, ämne; fritext; varifrån besöket kom; koden om familjen skrev en (rad 19) | 6.1 b, åtgärd före avtal | Supabase, Resend (kvitto och avisering) | avidentifieras 6 mån efter senaste kontakt |
| 2 | Konto (`profiles`) | förälder, studiehjälpare | namn, e-post, telefon, profilbild | 6.1 b, avtal | Supabase | så länge det används; granskas efter 2 år utan användning |
| 3 | Barnet och undervisningen (`students`, `study_plans`, `homework`, `progress_items`, `lesson_reports`, `materials`, `niva_forsok`, `niva_svar`) | barn | namn, årskurs, skola, ämnen, mål, uppgifter, svaren på de digitala uppgifterna och rättningen av dem, rapporter | 6.1 f, berättigat intresse (barnet är inte part) | Supabase; Anthropic (förnamn, årskurs, maskade anteckningar) när studiehjälparen ber om utkast | som kontot |
| 4 | Förälderns privata anteckningar (`student_notes`) | barn | fritext | 6.1 f | Supabase. Ingen hos oss har läsrätt | som kontot |
| 5 | Pass och bokningar (`bookings`, `pass_moten`) | förälder, barn, studiehjälpare | datum, tid, ämne, plats (ofta en hemadress), avbokningsskäl, vem som avbokade; studiehjälparens svar på en föreslagen tid (`svar_meddelande`, fritext, högst 500 tecken, kan nämna barnet) | 6.1 b | Supabase; Google (Meet-rum, när kopplat). Svaret går aldrig till en notis, ett mejl, auditloggen eller en AI | som kontot; pass med betalning 7 år; svaret 30 dagar efter avslaget eller passet |
| 6 | Chatt (`messages`) | förälder, studiehjälpare; barnet när det skrivs om | meddelandetext. Att någon av oss öppnat tråden står i `audit_logg` (`chatt.oppnad`: vem, när, familjen, studiehjälparen, antalet meddelanden, aldrig texten) | 6.1 b; att vi läser den: 6.1 f (barnens trygghet, tonen, reda ut det som gått fel) | Supabase | som kontot; loggraden så länge verksamheten finns (rad 13) |
| 7 | Notiser och mejl (`notiser`, `notis_utskick`) | alla med konto; barn med egen bekräftad e-post (rad 22) | typ, datum, förnamn, ämne | 6.1 b | Resend | 180 dagar i vyn, 90 dagar för utskicken |
| 8 | Betalning (`bookings.betalning_*`, `klippkort`, `pass_tillagg`, `timbank_uttag`, `stripe_handelser`, `stripe_tvister`, `invoices`) | förälder | belopp, tid, e-post, Stripe-id | 6.1 b; 6.1 c bokföringslagen | Stripe (e-post, belopp, ämne och datum) | 7 år |
| 9 | Ersättning till studiehjälpare (`payouts`, `lon_anstallning`) | studiehjälpare | timmar, belopp, anställningsnummer | 6.1 b; 6.1 c | Fortnox (lönefil i PAXml som admin laddar upp: anställningsnummer, datum, timmar, belopp, inga namn) | 7 år |
| 10 | Jobbansökan (`applications`, hinken `cv`) | sökande, ofta 16 år; vårdnadshavaren när den som söker är under 18 (2026-10-05) | namn, ålder, e-post, skola, ämnen, fritext, CV; under 18 också vårdnadshavarens e-post, när admin lade in vårdnadshavarens godkännande, och en kopia av vårdnadshavarens svar (inklistrad av admin, kan bära vårdnadshavarens namn och barnets för- och efternamn). Auditloggen får bara tidpunkten | 6.1 f; för vårdnadshavaren: att den som är under 18 inte tar anställning utan vårdnadshavarens samtycke (föräldrabalken) | Supabase, Resend (besked till den som söker, nejet när läget blir Avböjd, och mejlet till vårdnadshavaren: barnets förnamn, aldrig något annat ur ansökan, och en länk till policyns avsnitt för vårdnadshavare, som art. 14 kräver i första mejlet) | 1 år, eller 30 dagar efter senaste steget (godkännandet är ett steg); blev personen studiehjälpare: 2 år efter senaste pass, rapport eller inloggning. Vårdnadshavarens adress och svar går med ansökan |
| 11 | Kontaktformuläret (`contact_messages`) | vem som helst | namn, e-post, fritext | 6.1 f | Supabase | 6 mån efter inkommet eller besvarat |
| 12 | Felrapporter (`klientfel`) | inloggade och besökare | felet, sidan, webbläsaren, konto-id | 6.1 f | Supabase | 90 dagar |
| 13 | Ändringsloggen (`audit_logg`) | alla med konto | tillstånd, kopplingar, tid. Aldrig namn eller text | 6.1 f | Supabase | så länge verksamheten finns |
| 14 | Besöksstatistik | besökare | sida, ungefärligt land, enhetstyp; unik besökare ur en hash som byts varje dygn | 6.1 a, samtycke (LEK 9:28) | Vercel | enligt Vercel |
| 15 | Källspårning och annonsmätning | besökare som skickar anmälan | landningssida, hänvisare, UTM | 6.1 a, samtycke | ingen i dag; Meta och Google om ett id sätts | som anmälan |
| 16 | Vår AI-assistent (drift-agenten) | barn, förälder | initialer, årskurs, ämne, maskad fritext | 6.1 f | Anthropic | Anthropics villkor; frågor, svar och steg i `agent_korningar` och `agent_steg` töms efter 90 dagar, AI-förslagens motivering 90 dagar efter beslutet |
| 17 | Handlingar om verksamheten (`handlingar`, hinken `dokument`) | studiehjälpare, förälder | avtal, intyg, som fil eller som inklistrad text (`handlingar.innehall`, 2026-10-05); en handling som delats med personen den gäller läser hen själv under Profil & inställningar (2026-09-29) | 6.1 b, 6.1 c | Supabase | så länge de gäller, sedan så länge lagen kräver |
| 18 | Vårt arbetsunderlag (`uppgifter`, `admin_noteringar`) | alla | titel och text vi skriver själva, kan nämna namn | 6.1 f | Supabase | uppgifter: 1 år efter att de stängts; anteckningar om en person: med personens konto |
| 19 | Tipskoder och kampanjkoder (`tipskoder`, `leads.kod`, 2026-09-30) | förälder och studiehjälpare som tipsar; familjen som anmäler sig | en kod per familj och godkänd studiehjälpare (slumpad, inget namn), vilken kod en anmälan bar; kampanjkoder bär en plats, ingen person. Den som tipsat ser antal anmälda och kunder, aldrig vilka; admin ser vem som tipsat vem | 6.1 f (vilka tips och affischer som leder till anmälan); för den bjudna timmen 6.1 b (villkoren #tips) | Supabase | koden så länge kontot finns (tas bort när kontot raderas eller avidentifieras, och kopplingen i anmälan med den); koden på anmälan står kvar när anmälan avidentifieras |
| 20 | Barnets egen inloggning (`students.user_id`, `anvandarnamn`, `barn_aktiv`, `visa_rapporter`, `vardnadshavare_godkand_at`, `senast_inloggad`; kontot i `auth.users` med `app_metadata.roll = barn`; `barn_notiser`; `barn_andringsfonster`; barnkonton_och_admin, 2026-09-30) | barn; föräldern (godkännandet) | användarnamn, lösenordets hash (i Auth, aldrig läsbar för oss), när vårdnadshavaren godkände, senaste inloggning, notiserna i barnets vy (typ, passet, en mening om passet) | 6.1 b: föräldern ber om inloggningen, skapar den och kan ta bort den, och bekräftar att hen är vårdnadshavare (tidpunkten sparas) | Supabase (Auth). Ingen e-post till kontots adress: `<användarnamn>@barn.nextrum.se` tar aldrig emot något, `notis-ko` hoppar över den och databasen ger den ingen mejlnotis. Barnets egen adress, om föräldern lägger till en, är rad 22 och når aldrig Auth. Barnet gör NexLäx i sin vy sedan 2026-10-01: försöken och svaren är rad 3:s, och ett försök barnet startar har `startad_av` tom | så länge föräldern låter den finnas; tas bort direkt när föräldern tar bort den eller barnet raderas eller avidentifieras; notiserna 180 dagar; ändringsfönstren (ett lösenordsbyte, eller ett nytt konto med användarnamnet och kontots id, barnkonto_skapas_genom_auth) högst 60 sekunder, och ett som gått ut gallras samma natt |
| 21 | Adminroller (`admin_roller`, `admin_logg`, 2026-09-30; `admin_sett`, 2026-10-05) | vi som är admins | vem som är admin, behörigheterna, vem som gav dem och när; loggen bär aktörens och personens id, handlingen och behörigheterna före och efter, aldrig namn. `admin_sett`: hur långt var och en sett intresseanmälningarna och ansökningarna (en tidpunkt per admin och område), så att siffran i menyn går bort när man tittat | 6.1 f: att kunna visa vem som gett vem åtkomst till uppgifterna; för `admin_sett` att vyn ska visa vad som är nytt för just den som tittar | Supabase | rollen så länge den gäller (försvinner med kontot); loggen så länge verksamheten finns, och den går inte att ändra; `admin_sett` med kontot |
| 22 | Barnets egen e-post (`barn_epost`; barnets rader i `notis_utskick`; `intern.barn_inloggning_forsok`; barnets_epost, 2026-10-01). **Flaggan `barn_epost` står av tills juristen läst (avsnitt 8)** | barn; föräldern (lägger till och styr) | barnets e-postadress, när den bekräftades och när länken skickades, förälderns val (mejl till barnet på eller av), barnets egna val (vilka sorters mejl); mejlen till barnet i kön (förnamn, passets datum, tid, ämne och studiehjälparens förnamn, aldrig adressen, aldrig priser eller betalning); inloggningsförsök med adressen, sparade som en HMAC av adressen och av IP-numret, aldrig i klartext | 6.1 b för adressen och mejlen: föräldern ber om det, lägger till adressen, slår på mejlen och kan ta bort allt; barnet bekräftar adressen och väljer själv bort mejl. 6.1 f för försöken: att skydda barnets inloggning mot gissning | Supabase; Resend (bekräftelsen och mejlen till barnet). Adressen når aldrig Auth, och Auth mejlar aldrig ett barn. Studiehjälparen ser den inte: tabellen har inga rättigheter för någon inloggad | så länge föräldern låter den finnas och inloggningen finns; tas bort direkt när föräldern tar bort den eller inloggningen, eller när barnet raderas eller avidentifieras; en adress som aldrig bekräftats 30 dagar efter att länken skickades; försöken ett dygn; mejlen i kön 90 dagar (rad 7); händelserna i `audit_logg` (tillagd, bekräftad, borttagen, mejlen på eller av, aldrig adressen) så länge verksamheten finns |

**Känsliga uppgifter (art. 9) samlas inte in.** Vi ber aldrig om hälsa
eller diagnoser, men fritexten kan få dem ändå ("Elsa har ADHD"). Därför
står en rad under fritextrutorna i intresseanmälan och i rapporten som
ber om att låta bli, och därför tar vi bort sådant när vi ser det. Ingen
rättslig grund i art. 9.2 täcker att vi SPARAR en diagnos vi inte bett om.

**Personnummer** behandlas inte i dag (dataskyddslagen 3 kap. 10 §).
CV-fältet ber den sökande ta bort det, och det som ändå skickas till
Anthropic maskas av `_delad/minimera.ts`. Ett undantag är byggt men
oanvänt: `kund_skatteuppgifter` kan bära förälderns personnummer för
RUT-avdrag. Tabellen är tom och ingen RUT-tjänst är aktiv
(kontrollerat 2026-09-28). Slås RUT på ska behandlingen in i registret,
i integritetspolicyn på båda språken och i konsekvensbedömningen först.

---

## 3. Biträden och överföringar (art. 28 och kapitel V)

Varje leverantör som hanterar uppgifter åt oss ska ha ett
personuppgiftsbiträdesavtal (DPA). **Att det finns ett avtal är ett
påstående i integritetspolicyn. Kontrollera att det stämmer** (se
avsnitt 8).

| Leverantör | Gör | Var | Skydd vid överföring | DPA |
|---|---|---|---|---|
| Supabase | databas, inloggning, filer | EU, Irland (`eu-west-1`) | ingen överföring för lagringen; Supabase Inc. är amerikanskt, standardavtalsklausuler i DPA:n | begärs i dashboarden, under organisationens inställningar |
| Vercel | webbplatsen, besöksstatistik | globalt, USA | standardavtalsklausuler, DPF | ingår i villkoren; kontrollera plan (se nedan) |
| Resend | mejl | USA | standardavtalsklausuler, DPF | ingår i villkoren, länkad från resend.com/legal |
| Anthropic | rapportutkast, hälsningar, agenterna | USA | standardavtalsklausuler | ingår i Commercial Terms för API:t |
| Stripe | kortbetalningar | EU och USA | standardavtalsklausuler, DPF | ingår i Stripes villkor; Stripe är självt ansvarigt för bedrägerikontroll |
| Google | Meet-rum (inte kopplat än) | EU och USA | standardavtalsklausuler, DPF | Workspace Data Processing Amendment, godkänns i Admin Console |
| Fortnox | bokföring, fakturor, lön (för hand, lönen som fil) | Sverige | ingen överföring | Fortnox villkor; fakturorna står i policyn sedan 2026-09-28, lönen inte än, se avsnitt 8 |

**Data Privacy Framework (DPF).** EU-kommissionens beslut från 2023
gäller, men EDPB begärde en översyn i juli 2026 och beslutet kan falla
som Privacy Shield gjorde. Luta därför inte på det ensamt:
standardavtalsklausulerna ska finnas i varje avtal oavsett.

**Vercels Hobby-plan** får enligt Vercels villkor bara användas
icke-kommersiellt. **Nextrum står på Hobby** (kontrollerat
2026-09-28 mot kontot info@nextrum.se). Det är ett avtalsbrott mot
Vercel, inte mot GDPR, men det betyder också att DPA:n vilar på
villkor vi bryter mot. Byt till Pro.

---

## 4. Gallringen

Lagringstiderna i policyn hålls av databasen, inte av någon som kommer
ihåg dem. Alla jobb körs av pg_cron och syns i `cron.job`, och i
adminvyn under System → Automationer med sin senaste körning.

| Jobb | När | Gör |
|---|---|---|
| `leads-avidentifiering` | varje natt 03.47 UTC | tömmer namn, e-post, barnets namn och fritext i anmälningar 6 mån efter senaste kontakt; raden står kvar för statistiken |
| `ansokan-gallring` | varje natt 03.41 UTC | tar bort ansökan och CV 1 år efter inkommen eller 30 dagar efter senaste steget; en studiehjälpares ansökan 2 år efter senaste pass, rapport eller inloggning |
| `kontakt-och-fel-gallring` | varje natt 03.44 UTC | tar bort kontaktmeddelanden efter 6 mån och klientfel efter 90 dagar |
| `notis-stada` | varje natt 03.17 UTC | notiser 180 dagar, utskick och fel 90 dagar, körningar 30 dagar |
| `ai-och-uppgifter-gallring` | varje natt 03.51 UTC | agentloggens text efter 90 dagar, AI-förslagens motivering 90 dagar efter beslut, klara och avbrutna uppgifter efter 1 år |
| `svar-gallring` | varje natt 03.53 UTC | tömmer studiehjälparens svar på en föreslagen tid 30 dagar efter avslaget, eller 30 dagar efter passet; passet står kvar |
| `barnkonton-gallring` | varje natt 03.59 UTC | notiserna i barnens vy efter 180 dagar, och ändringsfönster som gått ut, för ett lösenordsbyte eller ett nytt konto (barnkonton_och_admin); en barnadress som inte bekräftats på 30 dagar, och inloggningsförsöken med barnadresser efter ett dygn (barnets_epost) |
| `konton-oanvanda` | den 1:a varje månad | gör varje konto som inte använts på 2 år till en uppgift i adminvyn |
| `cron-stada` | varje natt | jobbens egen logg efter 7 dagar |

**Ett konto raderas aldrig automatiskt.** Det hänger ihop med
bokföringsunderlag som ska sparas i sju år. När uppgiften "Konto oanvänt
i två år" dyker upp: mejla familjen, vänta 30 dagar, och tryck sedan
Radera i familjens panel i adminvyn (se avsnitt 6). Betalda pass och
underlag står kvar utan namn.

**Ett jobb som fastnat blir en uppgift** (`gallring:leads:fastnat`). Ser
ni en sådan: öppna `cron.job_run_details` och läs felet.

**Inte gallrat, med flit:** ändringsloggen (den går inte att ändra, och
den bär inga namn), bokföringsunderlag (7 år), raderna i `ai_forslag`
(en nyckel är ett förslag för alltid; bara motiveringen töms) och
körningarna i `agent_korningar` (status och tokens; texten töms).

**Säkerhetskopior.** Det som raderas kan finnas kvar en kort tid i
leverantörernas säkerhetskopior, och policyn säger det. Supabase-projektet
står på gratisplanen (kontrollerat 2026-09-28); se avsnitt 8.

---

## 5. Konsekvensbedömning (art. 35)

Konsekvensbedömning krävs när behandlingen sannolikt innebär hög risk.
EDPB:s kriterier (WP248) säger att två kriterier oftast räcker. Vi har
två: **sårbara registrerade** (barn, och studiehjälpare som ofta är
sexton) och **ny teknik** (AI som läser anteckningar om barn). Den här
bedömningen ska alltså finnas.

**Vad behandlingen är.** En förmedling av läxhjälp där föräldern lägger
in uppgifter om barnet, en studiehjälpare skriver rapporter efter varje
pass, och AI kan formulera om studiehjälparens anteckningar.

**Nödvändighet och proportionalitet.** Uppgifterna om barnet är de som
undervisningen kräver: årskurs, ämnen, mål, vad man gjorde. Vi ber inte
om personnummer, betyg eller diagnoser. Svaren på de digitala uppgifterna
(Fas 23.1) rättas automatiskt i databasen, men rättningen är inget beslut
om barnet i artikel 22:s mening: den ger stjärnor och en procentsats som
barnet, familjen och studiehjälparen ser, och ingenting följer av den av
sig själv. XP:n och serien i NexLäx (Fas 23.2) och uppdragen (Fas 23.4)
räknas ur samma svar och rapporter när vyn frågar, sparas inte och visas
för samma personer; en nivå som öppnas av dem är en spelregel, inget
beslut. Valet att stänga av ljudet eller vibrationen sparas bara i
webbläsaren (lagring.html). Svaren är korta (ett alternativ, ett tal, några ord) och går
inte till någon utanför oss. AI:n är frivillig för
studiehjälparen, får förnamnet och maskad text, och en människa läser
och skickar varje utkast.

| Risk | Sannolikhet | Konsekvens | Åtgärd | Kvar |
|---|---|---|---|---|
| Fel person ser ett barns uppgifter | låg | hög | RLS rad för rad i databasen, prövat med `verktyg/rls-test.sql`; privata anteckningar utan läsrätt för oss | låg |
| En hälsouppgift hamnar i fritext | medel | hög | rader under fritextrutorna; vi tar bort det vi ser | medel: vi kan inte hindra någon från att skriva |
| Anteckningar om barn når Anthropic | säker när funktionen används | medel | förnamn i stället för fullt namn, maskning av nummer och e-post, ingen träning på API-data | låg till medel: ett namn i löptext maskas inte |
| Uppgifter sparas längre än lovat | var hög | medel | gallringsjobben i avsnitt 4, ett jobb som fastnar blir en uppgift | låg |
| Intrång hos en leverantör | låg | hög | bara det som behövs går till var och en; incidentrutinen i avsnitt 7 | låg |
| En sextonårings CV med personnummer sparas | medel | medel | hjälptext i formuläret, gallring efter 1 år, bara admin läser | låg |
| Spårning utan samtycke | var säker (Vercel laddades direkt) | låg | inget skript som skickar data laddas före ja | låg |
| Vi läser chatten mellan en familj och en studiehjälpare (ofta sexton) utan att de märker det (2026-09-29) | säker när Öppna chatt används | medel | står i integritetspolicyn på båda språken och i chatten själv; bara admin, genom `chatt_las()`, som skriver varje öppning i auditloggen utan texten; syftena i policyn är de enda vi läser för | låg, så länge vi läser för syftena och inte för att det går |
| Den som tipsat får veta att en familj hen tipsat anmält sig och blivit kund (tipskoderna, 2026-09-30) | säker, det är hur tipset fungerar | låg | bara antal, aldrig vilka; står under kodfältet i anmälan och i integritetspolicyn på båda språken; fältet går att tömma innan anmälan skickas; ingen belöning till studiehjälpare, som ofta är sexton | låg |
| Ett barn med egen inloggning ser något det inte ska: priser, betalningar, förälderns uppgifter, andra barn (2026-09-30) | låg | medel | barnets roll i databasen (`nextrum_barn`) har inga tabellrättigheter alls, bara barnets egna funktioner, som svarar om barnet i token och prövar det mot `students.user_id`; prövat i `rls-test.sql` med en slinga över varje tabell och vy | låg |
| Ett barn spelar NexLäx åt ett annat barn, eller med en pausad inloggning (2026-10-01) | låg | låg | NexLäx-funktionerna (`niva_starta`, `niva_svara`, `niva_genomgang`, `nexlax_lage`) släpper in barnet bara för barnets eget id och bara medan inloggningen är aktiv (`intern.mitt_aktiva_barn`); `barn_nexlax` och `barn_uppgift` likadant. Försöken och svaren är samma rader som när barnet spelar i familjens inloggning (rad 3), inga nya uppgifter. Prövat i `rls-test.sql` avsnitt 14 | låg |
| En förälder skriver fel adress till barnet, och någon annan får barnets mejl (2026-10-01) | låg till medel | medel | adressen används till ingenting, varken inloggning eller mejl, förrän den som har inkorgen tryckt på knappen i bekräftelsen; bekräftelsen nämner inget namn och inget om barnet; länken gäller sju dagar, bara den senaste gäller, och en adress som aldrig bekräftas gallras efter 30 dagar; högst fem bekräftelser om dygnet och en i minuten per barn | låg |
| Någon listar ut vilka adresser som hör till barn hos oss, eller gissar ett barns lösenord genom adressen (2026-10-01) | låg | medel | inloggningen svarar likadant för fel adress, fel lösenord och en pausad inloggning, och varje nej tar minst 0,9 sekunder; varje försök räknas per adress och per IP-nummer (tio respektive tjugo på en kvart, sedan nekas det en stund), sparat som en HMAC och gallrat efter ett dygn; lösenordet prövas av Supabase Auth, aldrig av oss; adressen når inte Auth, så den kan inte användas för att återställa lösenordet. Prövat i `rls-test.sql` avsnitt 15 och i `barninloggning_test.ts` | låg: Supabase ser funktionens IP-nummer, inte barnets, så en angripare med många nummer kan stänga inloggningen med e-post en stund; användarnamnet fungerar ändå |
| Ett barn får mejl som det, eller föräldern, inte vill att det ska få (2026-10-01) | låg | låg | föräldern slår på mejlen, barnet väljer bort sorter i sin vy och i varje mejl, och föräldern kan stänga av och ta bort adressen när som helst, också med flaggan av; mejlen bär bara datum, tid, ämne och förnamn, aldrig priser, betalning, avbokningsskäl eller förälderns uppgifter; en pausad inloggning får inga mejl, och kön prövar det igen när mejlet ska gå | låg |
| Någon tar över ett barns inloggning, genom att gissa lösenordet eller genom att byta adress eller återställa lösenordet (2026-09-30) | låg | medel | minst 8 tecken; lösenordet byts bara av föräldern genom `barn-konto`, i ett fönster på 60 sekunder; adress, återställning och telefon spärras i `auth.users` av en trigger; föräldern kan pausa, vilket loggar ut barnet överallt; barnet får aldrig ett mejl | låg till medel: mot gissning finns bara Supabases egna gränser för inloggningsförsök |
| En admin med begränsad behörighet ser mer än uppgiften kräver (2026-09-30) | låg | medel | behörigheterna gäller i RLS, inte bara i vyn; ingen kan ge det den inte har, och varje ändring står i `admin_logg`, som inte går att ändra | låg |

**Slutsats.** Restrisken är acceptabel och kräver inget förhandssamråd
med IMY (art. 36). Gör om bedömningen när något av följande ändras: en ny
AI-funktion, en ny leverantör som får uppgifter om barn, eller pixlarna
slås på. Barnens egna inloggningar (2026-09-30), NexLäx i barnets vy och
barnets egen e-post (2026-10-01) är raderna med de datumen ovan;
bedömningen av dem är vår, och en jurist har inte läst den (avsnitt 8).

---

## 6. När någon hör av sig om sina uppgifter (art. 12–22)

Svara inom en månad. Förlängning med två månader går bara om begäran är
komplicerad, och då ska personen få veta det inom den första månaden.
Kontrollera att den som frågar är den det gäller: svara till adressen
som står på kontot, inte till en ny.

**Utdrag (art. 15).** För en familj: `profiles`, `students`,
`study_plans`, `homework`, `progress_items`, `lesson_reports`,
`niva_forsok` och `niva_svar` (Fas 23.1: svaren på de digitala uppgifterna),
`bookings`, `messages`, `leads` (om den inte är gallrad), `klippkort`,
`timbank_rorelser`, barnets inloggning (kolumnerna i rad 20 och `barn_notiser`),
barnets egen e-post (`barn_epost`: adressen, när den bekräftades och valen),
`invoices`, `rapport_bekraftelser`, `notis_val`. Förälderns egna
anteckningar (`student_notes`) når vi inte; familjen ser dem själv. För
en sökande: `applications` och CV-filen. Skicka som en fil, inte som
text i ett mejl.

Frågar en familj eller en studiehjälpare om vi läst deras chatt: svaret
står i `audit_logg`, raderna `chatt.oppnad` för deras trådar
(`objekt_id` är familjen, `efter ->> 'tutor_id'` studiehjälparen). Ge
datumen och syftet i policyn. Vem av oss som läste behöver inte stå med
(EU-domstolen C-579/21, Pankki S), utom när personen behöver det för att
kunna ta tillvara sina rättigheter.

**Rättelse (art. 16).** Redigera uppgifterna i personens panel i
adminvyn: familj, elev, studiehjälpare, intresseanmälan och ansökan.
E-posten på ett konto är inloggningen och ändras inte där.

**Radering (art. 17).** Knappen Radera sist i personens panel i
adminvyn, och Ta bort på en fråga under Kommunikation (sedan
2026-09-28). Rutan frågar databasen först och säger vad som händer;
reglerna står i `radera_person()` (migrationen
`personer_redigeras_och_raderas`) och ingen annanstans:

- **Helt** när ingenting om personen är bokföring: kontot, inloggningen,
  barnen, passen och chatten tas bort.
- **Avidentifieras** när personen har pass som hållits eller betalats,
  klippkort, fakturor, rapporter eller underlag. Namn, adress, telefon,
  profilbild, chatten, barnens uppgifter, läxorna, planerna,
  kunskapsområdena, svaren på de digitala uppgifterna (`niva_forsok`,
  `niva_svar`) och rapporternas text tas bort, inloggningen stängs,
  och betalda pass, `klippkort`, `invoices`, `payouts` och `stripe_*`
  står kvar utan namn i sju år.
- Barnets egen inloggning försvinner med barnet: triggern
  `students_barnkonto_stadas` tar bort kontot i Auth och barnets notiser
  när barnet raderas eller avidentifieras (barnkonton_och_admin), och
  med inloggningen barnets egen e-post och barnets rader i kön
  (barnets_epost).
- Anmälningar med samma adress avidentifieras som i nattjobbet (raden
  står kvar för statistiken). Ansökningar, CV och frågor med samma
  adress tas bort.
- **En vårdnadshavare** (2026-10-05) finns bara i en ansökan: adressen i
  `vardnadshavare_epost` och svaret i `vardnadshavare_svar`. Ber hen om
  utdrag, rättelse eller radering görs det i ansökans panel: Redigera
  uppgifterna tömmer adressen, och Ta bort godkännandet tar bort svaret.
  Radera tar inte bort den sökandes ansökan för att vårdnadshavaren ber om
  det; utan godkännande går ansökan inte vidare ändå.
- **Det går inte så länge pengar inte är uppgjorda:** betalt men inte
  hållet, timmar eller minuter kvar, en öppen kassa eller tvist, ett
  pass som börjat utan rapport, eller (studiehjälpare) matchade elever.
  Rutan säger vad som ska göras först. Pengar personen är skyldig oss
  hindrar inte; de står som larm under Betalningar → Att göra.

Filer först, raden sedan (CLAUDE.md avsnitt 6): adminvyn tar bort
profilbilden, barnens mapp och CV:t innan raden, och databasen vägrar
radera medan en fil finns kvar. Ändringsloggen raderas inte; den bär
inga namn, och raderingen får en egen rad där (vem, när, sättet och
antalen).

**Invändning (art. 21).** Gäller allt som vilar på berättigat intresse
(rad 3, 4, 6 där vi läser chatten, 10–13, 16). För barnets uppgifter
betyder en invändning i praktiken att passen upphör, och det ska sägas
rakt. En invändning mot att vi läser chatten väger mot barnens trygghet,
som är skälet att vi kan läsa den; säg det lika rakt, och att chatten
är för passen, inte för något annat.

**Återkallat samtycke.** Görs av besökaren själv under Cookies och
lagring. Inget för oss att göra.

---

## 7. Om något går fel: incidentrutinen (art. 33–34)

En personuppgiftsincident är allt som gör att uppgifter kommer i fel
händer, försvinner eller ändras utan att det var meningen: en policy som
släpper igenom för mycket, ett mejl till fel adress, en läckt nyckel, en
förlorad dator med inloggning.

1. **Stoppa det.** Stäng policyn, rotera nyckeln
   (`service_role` i Supabase, Stripe, Resend, Anthropic), logga ut
   användaren.
2. **Skriv ner det direkt** i incidentloggen nedan: när det upptäcktes,
   vad som hänt, vilka uppgifter, hur många.
3. **Bedöm risken.** Är det osannolikt att det innebär en risk för
   någon (ett mejl till fel förälder med bara ett datum)? Då räcker
   loggen. Annars:
4. **Anmäl till IMY inom 72 timmar** från att ni fick veta, via IMY:s
   e-tjänst "Anmäl personuppgiftsincident". Saknas något, anmäl det ni
   vet och komplettera.
5. **Berätta för de drabbade** om risken är hög (art. 34): vad som hänt,
   vad det kan innebära, vad vi gjort och vad de själva kan göra. Rör det
   ett barn, skriv till föräldern.
6. **Skriv in lärdomen i CLAUDE.md**, som resten av kodbasens fel.

Ett biträde som drabbas ska säga till oss utan dröjsmål; klockan på 72
timmar börjar när vi får veta.

### Incidentloggen

Varje incident skrivs här, också de som inte anmäls (art. 33.5).

| Datum | Vad | Uppgifter och antal | Risk | Anmäld till IMY | Åtgärd |
|---|---|---|---|---|---|
| 2026-09-27 | Vercels besöksstatistik laddades på alla öppna sidor utan samtycke sedan den lades till | sida, land, enhetstyp; hash av IP som byts varje dygn, inga cookies | låg | nej: ingen identifierbar person, ingen skada | laddas nu först efter ja i rutan |
| 2026-09-27 | Intresseanmälningar, kontaktmeddelanden och klientfel sparades utan slutdatum, i strid med policyn | namn, e-post, fritext; en anmälan och noll meddelanden i driften | låg | nej | gallringsjobben i avsnitt 4 |

Att sakerna ovan står i loggen är ett val: det är brister i efterlevnad
snarare än incidenter i art. 33:s mening, men en logg som bara bär det
som var ofrånkomligt säger inget om hur vi arbetar.

---

## 8. Kvar att göra, för hand

Inget av det här går att göra i koden.

- [ ] **Godkänn eller begär DPA hos varje leverantör** i avsnitt 3 och
  spara en kopia (PDF) i hinken `dokument` via adminvyns Handlingar.
- [ ] **Byt Vercel till Pro.** Kontot står på Hobby, som inte får
  användas kommersiellt (kontrollerat 2026-09-28).
- [ ] **Supabase står på gratisplanen.** Kontrollera att DPA:n går
  att få på den, och tänk på att ett gratisprojekt pausas efter en tid
  utan trafik och har begränsade säkerhetskopior. För en tjänst med
  betalande familjer är Pro rimligare.
- [ ] **Slå på kontroll av läckta lösenord** i Supabase: Authentication
  → Policies (HaveIBeenPwned).
- [ ] **Låt en jurist läsa** integritetspolicyn, villkoren och den här
  filen innan bolaget registreras.
- [ ] **Barnens inloggning (2026-09-30):** låt juristen läsa grunden
  (6.1 b med vårdnadshavarens ja, rad 20) och raderna i
  konsekvensbedömningen innan det första barnkontot skapas, och säg till
  familjerna i samma mejl som policyändringen.
- [ ] **Barnets egen e-post (2026-10-01):** flaggan `barn_epost` står av,
  och ingenting av det går att använda förrän den slås på. Låt juristen
  läsa rad 22, de tre raderna från 2026-10-01 i konsekvensbedömningen och
  avsnittet om barn i integritetspolicyn, på båda språken, innan den
  slås på: grunden (6.1 b genom föräldern, och 6.1 f för försöken), att
  barnet självt får mejl, och åldern (ett barn under 13 med egen
  adress). Säg till familjerna i samma mejl som policyändringen.
- [ ] **Meddela familjerna med konto** att integritetspolicyn ändrats.
  Ändringen ger dem fler rättigheter, inte färre, så det räcker med ett
  mejl. Sedan 2026-09-29 står där också att vi kan läsa chatten; säg det
  i samma mejl, inte bara i policyn.
- [ ] **Säg till studiehjälparna att vi kan läsa chatten**, i handboken
  och i avtalet, inte bara i policyn (2026-09-29). För dem är chatten en
  arbetsplats, och en arbetsgivare som läser det anställda skriver ska ha
  sagt det i förväg. Handboken finns inte i repot.
- [ ] **Fortnox i policyn** innan första fakturan eller lönen går dit
  (CLAUDE.md avsnitt 11).
- [ ] **Meta- eller Google-pixel:** innan ett id sätts, gör om
  konsekvensbedömningen och följ listan i CLAUDE.md avsnitt 6,
  Samtycket. IMY bötfällde Apoteket och Avanza för Meta-pixeln 2024.
- [ ] **När bolaget registreras:** byt personuppgiftsansvarig i
  policyn, i den här filen och i varje leverantörsavtal.
