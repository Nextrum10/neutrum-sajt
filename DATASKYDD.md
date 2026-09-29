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
| 1 | Intresseanmälan (`leads`) | förälder, barn | förälderns namn, e-post, telefon; barnets namn, årskurs, ämne; fritext; varifrån besöket kom | 6.1 b, åtgärd före avtal | Supabase, Resend (kvitto och avisering) | avidentifieras 6 mån efter senaste kontakt |
| 2 | Konto (`profiles`) | förälder, studiehjälpare | namn, e-post, telefon, profilbild | 6.1 b, avtal | Supabase | så länge det används; granskas efter 2 år utan användning |
| 3 | Barnet och undervisningen (`students`, `study_plans`, `homework`, `progress_items`, `lesson_reports`, `materials`, `niva_forsok`, `niva_svar`) | barn | namn, årskurs, skola, ämnen, mål, uppgifter, svaren på de digitala uppgifterna och rättningen av dem, rapporter | 6.1 f, berättigat intresse (barnet är inte part) | Supabase; Anthropic (förnamn, årskurs, maskade anteckningar) när studiehjälparen ber om utkast | som kontot |
| 4 | Förälderns privata anteckningar (`student_notes`) | barn | fritext | 6.1 f | Supabase. Ingen hos oss har läsrätt | som kontot |
| 5 | Pass och bokningar (`bookings`, `pass_moten`) | förälder, barn, studiehjälpare | datum, tid, ämne, plats (ofta en hemadress), avbokningsskäl | 6.1 b | Supabase; Google (Meet-rum, när kopplat) | som kontot; pass med betalning 7 år |
| 6 | Chatt (`messages`) | förälder, studiehjälpare | meddelandetext | 6.1 b | Supabase | som kontot |
| 7 | Notiser och mejl (`notiser`, `notis_utskick`) | alla med konto | typ, datum, förnamn, ämne | 6.1 b | Resend | 180 dagar i vyn, 90 dagar för utskicken |
| 8 | Betalning (`bookings.betalning_*`, `klippkort`, `pass_tillagg`, `timbank_uttag`, `stripe_handelser`, `stripe_tvister`, `invoices`) | förälder | belopp, tid, e-post, Stripe-id | 6.1 b; 6.1 c bokföringslagen | Stripe (e-post, belopp, ämne och datum) | 7 år |
| 9 | Ersättning till studiehjälpare (`payouts`, `lon_anstallning`) | studiehjälpare | timmar, belopp, anställningsnummer | 6.1 b; 6.1 c | Fortnox (lönefil i PAXml som admin laddar upp: anställningsnummer, datum, timmar, belopp, inga namn) | 7 år |
| 10 | Jobbansökan (`applications`, hinken `cv`) | sökande, ofta 16 år | namn, ålder, e-post, skola, ämnen, fritext, CV | 6.1 f | Supabase, Resend (besked) | 1 år, eller 30 dagar efter senaste steget; blev personen studiehjälpare: 2 år efter senaste pass, rapport eller inloggning |
| 11 | Kontaktformuläret (`contact_messages`) | vem som helst | namn, e-post, fritext | 6.1 f | Supabase | 6 mån efter inkommet eller besvarat |
| 12 | Felrapporter (`klientfel`) | inloggade och besökare | felet, sidan, webbläsaren, konto-id | 6.1 f | Supabase | 90 dagar |
| 13 | Ändringsloggen (`audit_logg`) | alla med konto | tillstånd, kopplingar, tid. Aldrig namn eller text | 6.1 f | Supabase | så länge verksamheten finns |
| 14 | Besöksstatistik | besökare | sida, ungefärligt land, enhetstyp; unik besökare ur en hash som byts varje dygn | 6.1 a, samtycke (LEK 9:28) | Vercel | enligt Vercel |
| 15 | Källspårning och annonsmätning | besökare som skickar anmälan | landningssida, hänvisare, UTM | 6.1 a, samtycke | ingen i dag; Meta och Google om ett id sätts | som anmälan |
| 16 | Vår AI-assistent (drift-agenten) | barn, förälder | initialer, årskurs, ämne, maskad fritext | 6.1 f | Anthropic | Anthropics villkor; frågor, svar och steg i `agent_korningar` och `agent_steg` töms efter 90 dagar, AI-förslagens motivering 90 dagar efter beslutet |
| 17 | Handlingar om verksamheten (`handlingar`, hinken `dokument`) | studiehjälpare, förälder | avtal, intyg; en handling som delats med personen den gäller läser hen själv under Profil & inställningar (2026-09-29) | 6.1 b, 6.1 c | Supabase | så länge de gäller, sedan så länge lagen kräver |
| 18 | Vårt arbetsunderlag (`uppgifter`, `admin_noteringar`) | alla | titel och text vi skriver själva, kan nämna namn | 6.1 f | Supabase | uppgifter: 1 år efter att de stängts; anteckningar om en person: med personens konto |

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
sig själv. Svaren är korta (ett alternativ, ett tal, några ord) och går
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

**Slutsats.** Restrisken är acceptabel och kräver inget förhandssamråd
med IMY (art. 36). Gör om bedömningen när något av följande ändras: en ny
AI-funktion, en ny leverantör som får uppgifter om barn, pixlarna slås
på, eller barn får egna konton.

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
`timbank_rorelser`,
`invoices`, `rapport_bekraftelser`, `notis_val`. Förälderns egna
anteckningar (`student_notes`) når vi inte; familjen ser dem själv. För
en sökande: `applications` och CV-filen. Skicka som en fil, inte som
text i ett mejl.

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
- Anmälningar med samma adress avidentifieras som i nattjobbet (raden
  står kvar för statistiken). Ansökningar, CV och frågor med samma
  adress tas bort.
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
(rad 3, 4, 10–13, 16). För barnets uppgifter betyder en invändning i
praktiken att passen upphör, och det ska sägas rakt.

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
- [ ] **Meddela familjerna med konto** att integritetspolicyn ändrats.
  Ändringen ger dem fler rättigheter, inte färre, så det räcker med ett
  mejl.
- [ ] **Fortnox i policyn** innan första fakturan eller lönen går dit
  (CLAUDE.md avsnitt 11).
- [ ] **Meta- eller Google-pixel:** innan ett id sätts, gör om
  konsekvensbedömningen och följ listan i CLAUDE.md avsnitt 6,
  Samtycket. IMY bötfällde Apoteket och Avanza för Meta-pixeln 2024.
- [ ] **När bolaget registreras:** byt personuppgiftsansvarig i
  policyn, i den här filen och i varje leverantörsavtal.
