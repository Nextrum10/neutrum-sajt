# Affären: flödet, passen och det runt dem

Arkivet för avsnitt 1 i `CLAUDE.md` utom betalningen (`betalning.md`), timmarna (`timmar.md`)
och NexLäx (`nexlax.md`), ordagrant, med driftsättningen och det som är kvar ur avsnitt 11
bredvid det den gäller. Reglerna står i kärnan, `CLAUDE.md`; "avsnitt N" i texten är kärnans.

---

## 1. Affären, i ordning

Det här är inte en katalog man bläddrar i. Nextrum matchar.

1. Familjen skickar **intresseanmälan** → rad i `leads`
2. Ni ringer och väljer studiehjälpare
3. Admin tar in familjen: **Ta in familjen** på anmälan (2026-10-06).
   Kontot skapas med anmälans adress, eleven ur anmälan, och familjen
   väljer lösenordet genom länken i mejlet. Den som hellre registrerar
   sig själv gör det på `foralder.html`
4. `admin.html` → **Familjer** → välj hjälpare i rullgardinen. Sätter
   `matched_tutor_id` och `match_status` **samtidigt** — förr var det
   två kolumner i Table Editor och satte man bara den ena såg familjen
   en låst vy utan att förstå varför
5. Föräldern lägger in barnet, hjälparen skriver studieplanen

Före steg 4 är föräldravyn öppen (2026-10-07, Leo: "han kommer inte in
på plattformen, det är låst. ta bort så att det inte är låst"). Förut
stannade en omatchad familj i ett väntläge, och sedan intaget är det
varje ny familj: lösenordet, villkoren och introduktionen, och sedan ett
lås som dessutom bad dem skicka en intresseanmälan de redan skickat. Nu
kommer de in med barnen, NexLäx och profilen, och `S.väntar` i
`nextrum-studie-vy.js` håller det som kräver en studiehjälpare:

- **Boka pass** visar en spärr i stället för kalendern. Policyn på
  `bookings` släpper igenom `tutor_id` null, så det är vyn som stoppar
  förslaget; ingen studiehjälpare kan svara på det.
- **Erbjudanden**: Köp är avstängt, och raden ovanför korten säger att
  timmarna köps när vi matchat dem. Ingen ska betala för timmar innan vi
  vet vem som håller dem.
- **Meddelanden**: tråden har ingen att skriva till och säger det;
  hälsningens kort säger Öppnas när ni är matchade.
- **Översikt**: Att göra börjar med Vi letar studiehjälpare åt er, som
  leder till barnen tills det finns ett och sedan till NexLäx. Raden
  räknas inte i siffran.
- Introduktionens sista bild säger vad som öppnas när vi matchat dem
  (`VÄNTAR` i `nextrum-introduktion.js`).

Matchningen öppnar resten vid nästa laddning, utan att något annat
ändras.

**Kontaktvalet** (2026-10-03): familjen väljer i intresseanmälan om vi
ska ringa eller mejla först. Inget förval, och Ring kräver telefon.
Svaret står som första rad i `message` ("Kontakt först: ring" eller
"mejl"), före familjens text, eftersom databasen kapar message
bakifrån vid 4000 tecken. Ingen egen kolumn: då behövdes ingen
migration, och `lead-notis` mejlar det redan i meddelandet. Tacket
följer valet (`tackIntresseRing`). Steg 2 ovan gäller bara den som
valt Ring; den som valt mejl får ett mejl först.

**Timmarna i ansökan** (2026-10-03): den som söker svarar ja eller nej
på om hen kan jobba minst 4 timmar i veckan. Inget förval. **Fyra timmar
är meriterande, inget krav** (Leo 2026-10-03): ett nej stoppar inte
ansökan, och raden under valet och svaret på "Hur mycket behöver jag
jobba?" (`faq.html`, `bli-studiehjalpare.html`, båda språken) säger
detsamma. Blir det ett krav ändras de tre samtidigt. Svaret står som första rad i `applications.why`
("Minst 4 timmar i veckan: ja"), av samma skäl som kontaktvalet, genom
`kopplaAnsökan`s `överst()`; sidans kontroll går genom `kontroll()`.
Kontrollen och valet delar stilen `.nx-val` med kontaktvalet.

**Under 18 i ansökan** (2026-10-05): åldern under 18 fäller ut
vårdnadshavarens e-post, som krävs och inte får vara den egna. Den går som
en egen kolumn (`kopplaAnsökan`s `kolumner()`), inte i `why`, eftersom
databasen mejlar den. Vårdnadshavaren svarar till info@ med barnets för-
och efternamn, och admin lägger in svaret i ansökan. Hela kedjan står i
`minne/notiser.md` (Vårdnadshavarens godkännande).

**Avböjd mejlar ett nej** (2026-10-05), tidigast en halvtimme senare och
aldrig på kvällen. Se `minne/notiser.md`, regel 4.

**Intaget** (2026-10-06). Leo: "när man ska ta in en anställd är det
krångligt att skapa konto åt den, samma med familj in i poolen. de
behöver skapa konto och allt skit". Nu skapar adminvyn kontot i samma
tryck som personen tas in, med personens egen adress:
- **Ta in familjen** (rutan på en intresseanmälan, `nextrum-admin-kunder.js`):
  `bjud-in` med `lead_id` skapar kontot och mejlar länken, `leads.kund_id`
  kopplar anmälan till kontot, eleven skapas ur anmälan, och anmälan blir
  matchad. Kvittot säger vad som hände och var eleven finns; Välj
  studiehjälpare är steg 4. Har familjen redan ett konto är rutan Skapa
  elev, som förut. Går eleven inte att skapa efter kontot står familjen
  kvar i rutan och knappen blir Skapa elev.
- **Ta in i poolen** (ansökan, `nextrum-admin-rekrytering.js`): har
  adressen i ansökan inget konto står "Skapa kontot med <adressen>" först
  i kontolistan och är valt, och knappen heter Ta in och skicka inbjudan.
  Kontot skapas med `roll: 'tutor'` före godkännandet, som sedan är
  detsamma som för ett konto som fanns; kvittot säger att två mejl går
  (länken och välkomstmejlet).
- Personen trycker på länken, väljer lösenordet två gånger, går igenom
  introduktionen och trycker Fortsätt (`minne/sakerhet.md`, Konton vi
  skapar). Väntar familjen på sin matchning, eller studiehjälparens
  profil på att godkännas, säger introduktionens sista bild det.
- **Skicka inbjudan igen** står i personens panel (`nextrum-admin-detalj.js`)
  för en förälder eller studiehjälpare, alltid sedan 2026-10-07: före första
  inloggningen en ny inbjudan, sedan Skicka länk för lösenord. Bara det
  senaste mejlet fungerar (`minne/sakerhet.md`).
- **Inget Skapa konto** (2026-10-07, Leo: "ta bort att man skapa konto på vår
  sida, vi gör det genom inbjudan"): familjer kommer in genom Ta in familjen,
  studiehjälpare genom Ta in i poolen, och inloggningen är en för alla, där
  kontot avgör vyn (`minne/barnkonton-och-admin.md`, En inloggning).
- Leo bad om lösenordet 12345678 för alla nya konton. Det blev en länk i
  stället, för samma steg för personen; varför står i
  `minne/sakerhet.md`.

## Uppstarten

**Intresseanmälan säger att Nextrum bildas** (2026-09-29). Leo: "just
nu ska vi samla in kunder men vi är inte registrerade ännu ... ska det
stå att just nu bildas vi och vi kan påbörja läxhjälpen om ungefär 3
veckor". En ruta i sidhuvudet på `intresseanmalan.html` och `/en/`,
stilad i `nextrum-uppstart.css`, med en bana från Nu till vecka 43.
Dagen står i `data-uppstart` (måndagen 19 oktober), och "om ungefär tre
veckor" räknas om ur den av `NX.uppstart()` vid varje visning: skrivet
för hand hade det varit fel efter en vecka, mitt i kampanjen. När dagen
passerat står "inom kort", aldrig en dag bakåt i tiden. Tacket efter
anmälan säger detsamma (`tackIntresseUppstart`) så länge rutan finns.
Flyttas starten: byt `data-uppstart` OCH veckan i banan, på båda
sidorna. **Rutan ska bort när passen har börjat**: den på båda sidorna,
och länken till och filen `nextrum-uppstart.css`. Tacket går tillbaka av
sig självt.

**Formuläret överst (2026-10-08).** Leo: "När jag går in på
intresseanmälan knappen vill jag direkt komma till ansöknings formuläret
nu måste jag scrolla för komma dit. Ha formuläret högst upp. Och ovan en
liten text där de står just nu bildas Nextrum ... så som den ser ut nu men
mindre och smalare". Sidhuvudet (tillbakalänken, etiketten, den stora
rubriken och ingressen) gick, och klassen `nx-har-uppstart` med det.
Sidan är en sektion (`section.nx-anm#intresse`, cinema): rutan om
uppstarten som en låg remsa (ikonen, rubriken i fetstil i meningen och
banan; en rad från 760 px), och under den formulärets yta med `h1` och
ingressen överst, före stegen och svaren i markupen, så att formuläret
kommer först också på en telefon. Inget `data-stig` på remsan och
formuläret: det man kommer för ska synas direkt. Rubriken och
ingressen är desamma som förut, så delningsbilden står kvar. Villkoren och
integritetspolicyn säger redan att Nextrum AB är under bildande; de
ändras när bolaget är registrerat, vilket inte behöver vara samma dag.

## Bokningen

**Användarvillkoren först** (2026-10-07): den som föreslår ett pass och den
som bekräftar en tid har godkänt den gällande versionen, annars nekar
databasen (`bookings_kraver_villkor`), och timmar köps bara åt en familj
som gjort det. Avbokningen stoppas aldrig. Se `minne/sakerhet.md`.

**Ett pass bokas i två steg (Fas 15.1).** Familjen trycker på en dag i
en tom kalender, väljer ämne, tid och antal barn och FÖRESLÅR tiden.
Studiehjälparen accepterar eller föreslår en annan under Föreslagna
tider, och först då står passet under Mina lektioner. Det finns inga
veckotider längre: `tutor_availability` läses inte av något, och
triggern som bekräftade bokningar inom dem är borttagen. En avbokning
kräver ett skäl (fast kod), och motparten får det i mejlet (Fas 15.2).
Väljer familjen ämnet Annat måste de skriva vilket, och det skrivna
ordet är det som sparas i `bookings.subject` (2026-09-25). Mejlen
läser ämnet genom `fornamn()`, så fritexten når dem som ett ord.
Tiderna börjar klockan 11 på vardagar och klockan 9 på lördag och
söndag, och slutar senast 22 (`HELA_DAGEN` i `nextrum-arbetsyta.js`,
som förslaget och flytta-rutan delar). Leo 2026-09-28: "man ska inte
kunna skicka förfrågan innan 11 på vardagar, helger ska man kunna
skicka förfrågan tidigast kl 9", samma kväll som 11 först gällde alla
dagar. Det är passets starttid, inte när förslaget skickas. Röda dagar
mitt i veckan räknas som vardagar. Listan började 07:00, och Leos "man
kan inte föreslå tider före 11:00" från 2026-09-25 lästes då som en
felanmälan i stället för en regel.
Regeln står bara i vyn, som resten av fönstret: databasen spärrar inga
timmar, och en flik som laddats före en ändring erbjuder de gamla
tiderna tills den laddas om. Samma dag går det bara att föreslå tider
minst en timme fram, och tidsraden säger det — annars ser det ut som
att dagens första timmar saknas.

**Ångerrätten står i villkoren** (`#angerratt`, 2026-09-25): 14 dagar
från att passet är bokat. Villkoren nämnde den inte alls förut, och
utan informationen förlängs fristen med upp till tolv månader (lagen
om distansavtal 2 kap. 13 §). Att ett genomfört pass inte går att
ångra, och att en påbörjad del betalas, gäller bara för att familjen
UTTRYCKLIGEN bett att passet hålls inom fristen — den begäran är att
föreslå tiden, och meningen om det står sist i bokningens dagpanel.
Tas meningen bort faller undantaget. Planer och klippkort (Fas 16.1)
har samma ångerrätt, räknad från köpet, och den går inte att avtala
bort. Inom fristen får vi bara behålla en andel av det AVTALADE priset
för de timmar som använts (2 kap. 15 §), alltså det rabatterade.
Regeln att använda timmar räknas till ordinarie pris vid köpet (379 kr till 2026-10-08, sedan 399) när en familj slutar
gäller först efter fristen — adminvyn visar rätt belopp efter datumet
(`vid_anger_ore` och `vid_uppsagning_ore`, Fas 16.1e).

**Förslaget bär var man ses (Fas 15.6).** Online, eller På plats med en
adress i `bookings.location`, och en valfri rad till studiehjälparen i
`note`. Fas 15.1 hade tagit bort frågan, och ett förslag hade då ingen
plats alls. Förval ur förra passet och barnets `format_onskemal`.
Platsen ändras inte när tiden flyttas — `skydda_bokningsfalt` släpper
bara igenom tid och status på ett befintligt pass.

## Svaret på en föreslagen tid och avbokade pass

**Svaret på en föreslagen tid och avbokade pass (2026-09-30).** Leo bad
om tre svar på familjens tid: acceptera, avslå med ett obligatoriskt
meddelande, eller föreslå en annan tid med ett valfritt, och att
familjen svarar ja eller nej på motförslaget ("ingen pingpong"). Och att
avbokade pass inte ska ta plats, men att antalet ska synas över tid.
Migrationen `avbokningar_och_svar` bygger det på Fas 15.1:s modell.
- **Inga nya statusar, med flit.** Beställningen ville ha `avslagen`,
  `motforslag` och `motforslag_avbojt`. Ett motförslag ÄR fortfarande en
  flyttad tid på ett `requested`, och ett avslag ÄR `cancelled`:
  `klippkort_saldo`, timmarnas jobb, krockvillkoret, raderingen och ett
  trettiotal funktioner räknar på de fyra statusarna, och ett avslag med
  en ny status hade behållit familjens köpta timme utan att något blev
  rött.
- **Inga pass tas bort, med flit.** Beställningen ville radera avbokade
  pass efter 30 dagar. Ett avbokat pass kan bära en återbetalning, en
  tvist, ett timbanksuttag och ligga i en stängd månad, och
  `analys_avbokningar` räknar ur raderna. Vyerna visar avbokade pass i en
  hopfälld grupp sist i passlistan (`o.avbokade` i `NXStudie.passLista`),
  bara de senaste 30 dagarna, och antalet räknas ur raderna.
- **`avbokad_fran`** är statusen när passet avbokades, stämplad av
  `stampla_avbokningen`. Räknaren i gruppen räknar bara `confirmed`: ett
  förslag som avslås eller dras tillbaka är ingen avbokning. Vem som
  avbokade läses ur `avbokad_av` mot `parent_id` och `tutor_id`, som
  `analys_avbokningar` gör. Fylld bakåt ur auditloggen; pass avbokade
  före Fas 6.1 står som null, okänt.
- **`svar_meddelande`** är studiehjälparens rader, högst 500 tecken:
  KRÄVS när hen avslår en tid familjen föreslagit, valfritt med ett
  motförslag, och skrivs av passets studiehjälpare i samma skrivning
  (`skydda_bokningsfalt`). Fritext, till skillnad från avbokningens
  fasta skäl (Fas 15.2): "den tiden har jag träning" är inget av fyra
  skäl. Därför står den bara i vyerna: inte i auditloggens vitlista,
  inte i någon notis eller något AI-verktyg, och `svar-gallring` tömmer
  den 30 dagar efter avslaget eller passet. `radera_person()` tömmer den,
  och månadslåset släpper igenom tömningen som för plats och rad.
- **`motforslag_at`** stämplas när den som fick ett förslag svarar med
  en annan tid. Den som fick motförslaget svarar ja eller nej och flyttar
  inte tiden igen; den som gav det får ändra sitt eget tills det är
  besvarat. Undantaget är kortpengar på passet: då går nej inte härifrån
  (Fas 14.1), och en ny tid är det enda svaret utom ja. Ett bekräftat
  pass som flyttas är ett nytt förslag, och tappar det gamla svaret.
- **Mejlen är orörda.** `pass_avbojt` och `pass_flyttat` sa redan att ett
  svar finns, med knappen till `#lektioner/pass`, och bär aldrig texten.
  `notis-ko` behövde inte driftsättas.
- Familjen ser ett avslag från den senaste veckan under Översikt, med
  Föreslå ny tid: i den hopfällda gruppen hade det bara stått i mejlet.
- **Vyerna tål att migrationen saknas** (`NXStudie.passMedSvar`): de
  driftsätts vid merge och migrationen körs efteråt, och en fråga efter
  en kolumn som inte finns ger 42703 för hela listan. Utan kolumnerna
  avslår studiehjälparen som förut, utan text.
- `NXStudie.medan()` stänger av knappen medan anropet pågår. Förut
  stoppade `aria-busy` bara musen: Enter på en knapp med fokus gav ett
  andra svar på ett pass som redan besvarats.

Driftsättningen, ur avsnitt 11:

- **Svaret på en föreslagen tid och avbokade pass (2026-09-30, avsnitt
  1) är i drift sedan 2026-09-30.** Migrationen kördes efter att PR #155
  mergats, med versionen i filnamnet (`20260930000000`): databasen
  hämtade filen från merge-commiten med tillägget `http`, prövade md5,
  körde den och skrev raden i `schema_migrations` i samma transaktion,
  så `created_by` är tom, och tillägget togs bort igen. Det driften
  sparade har samma md5 som filen. Innan dess hade de fyra funktionerna
  migrationen lappar samma md5 i driften som i en databas byggd ur
  filerna (`verktyg/lokal-databas.sh`), så vakterna träffade det de
  letar efter. Hela `rls-test.sql` gick igenom före, i en transaktion
  som rullades tillbaka med migrationen inläst, och efter: 975 av 975.
  Lokalt föll 32 rader utan migrationen, alla i det nya avsnittet eller
  i de fyra prov som utökades. Bakfyllnaden gav alla sju avbokade pass i
  driften en `avbokad_fran`: fem bekräftade, två förslag. Vyerna gick ut
  vid merge och tålde att kolumnerna saknades under tiden.

## Meet-länken

**Ett bekräftat onlinepass har en Meet-länk (Fas 18.1).** Den står under
Var på passets sida, likadan hos familjen och studiehjälparen, och
skapas av `google-meet` första gången någon öppnar passet, inte av en
trigger. Rummet är öppet (den som har länken går in utan att knacka),
för på ett pass är ingen från Nextrum med och släpper in. Blir rummet
inte öppet sparas länken inte. Är Google inte kopplat står den gamla
texten kvar: länken kommer i meddelanden. Leo valde bara det här av
Workspace-kopplingen; kalendern, inbjudningarna och rekryteringsmötet
valdes bort, och mejlen går genom Resend som förut (INTEGRATIONER.md).

Ur avsnitt 11:

- **Google Workspace ger bara Meet-länkar, och är inte kopplat än**
  (Fas 18.1). Koden, tabellerna och Koppla-knappen finns; kopplingen
  kräver stegen hos Google i `INTEGRATIONER.md` och ett klick på
  Koppla Google, inloggad som `info@nextrum.se`. Tills dess står den
  gamla texten om meddelanden kvar på passen. Kalendern, inbjudningarna
  och rekryteringsmötets länk valdes bort. Integritetspolicyn säger
  samma sak sedan 2026-10-07 (den lovade Meet innan något var kopplat)
  och ändras samma dag som kopplingen, `INTEGRATIONER.md` steg 9. Fortnox stod här som en
  ogjord koppling till Fas 14.8. Sedan Fas 14.9 sköts bokföringen,
  fakturorna och lönen i Fortnox, med flit utan koppling hit.

## Passets sida, månaderna och studiehjälparens vy

**Varje pass har en egen sida, `#pass/<id>`, i båda vyerna.** Ritas av
`NXStudie.passSida`; vyn bestämmer innehållet (familjen ser pris och
betalning, studiehjälparen eleven och familjen). Raderna i listorna
leder dit och bär bara det som är ens eget drag just nu — svara,
betala, skriva rapporten. Föreslå ny tid och avboka ligger på sidan.

**Studiehjälparens rapporter och ersättning visas månad för månad**
(2026-09-27): "man ska inte kunna se rapporter från juli idag i
september". Förvalet är den innevarande månaden. Statistiken (Hur passen
gick) läser fortfarande de tjugo senaste.

**Familjens bekräftade rapporter likaså** (2026-09-28, Leo: "bekräftade
rapporter ska filtreras efter månad"): Bekräftade under Bekräfta rapport
har samma rad, på PASSETS månad, och raden är dold tills något är
bekräftat. Att bekräfta filtreras inte. Två saker kom fram i provbänken:
- **En månadsrad som skapas i en dold sektion visade fel månader.**
  Föräldravyns rad och studiehjälparvyns två skapas vid start, när
  sektionen är dold, och bredden noll gjorde att den valda månaden aldrig
  fördes in i bild: när sektionen öppnades stod oktober förra året
  längst till vänster och september låg utanför, på telefon och dator.
  `månadsval` för nu fram den valda när raden börjar synas.
- **`håll()` kan inte scrolla förbi sidans slut.** Listan står sist, och
  en kortare månad längst ned på sidan klämde scrollen: raden flyttade
  sig 84 px under fingret på en telefon. `rbBytMånad` låter listan
  behålla höjden tills tomrummet ligger under skärmkanten. Samma sak
  finns sedan 2026-09-29 som `NXStudie.hållLista` (avsnitt 3, fälla 1).
  Studiehjälparvyns två rader har bara `håll()`.

**Adminvyns Lektioner likaså** (2026-09-29, Leo: "lektioner, där ska man
kunna filtrera för månader, i admin. lättare att se över en mängd
lektioner under en specifik tid"). Samma rad som Ekonomi, Månadens
ekonomi och Löner, men en egen, på passets månad, och talen överst gäller
månaden. Raden ersatte väljaren 30 dagar, tre månader, hela tiden, och
två saker den gav står kvar på annat sätt: en månad med hållna pass utan
rapport är märkt i raden ("2 saknas"), så att larmet inte gömmer sig i en
månad som inte är vald, och ett sök räknar upp sina träffar i andra
månader med en knapp dit. Raden har varje månad sedan september 2026
(`alla`): hela tiden nådde varje pass. Sedan samma dag
hämtas alla pass, inte de tusen första (avsnitt 3, Tusen rader). Byts månaden mot
en tom på en telefon klämmer sidan scrollen 15–25 px. Det är inte lagat,
med flit: på en dator står raden så högt att det inte händer, och en
reserv som `rbBytMånad` lämnade 311 px tomrum kvar på en kort sida.

**Studiehjälparens schema öppnar i Kommande** (2026-09-24): de närmaste
passen per dag, med klockslag och ämne, elevens namn och platsen på var
sin rad. Studievyn och adminvyn öppnar fortfarande i månaden — hos
familjen står schemat direkt under passlistan, och Kommande hade bara
upprepat den.

**Plan & utveckling börjar med vem man skriver om** (2026-09-28, Leo:
"man kan ha flera elever därför behöver man välja"). Med flera elever
står studieplanen och kunskapsområdena dolda tills studiehjälparen själv
tryckt på en elev: där, under Mina elever, eller på ett elevkort eller en
länk i elevens rad ovanför Läxor och Meddelanden. Namnet står sedan i
rubrikerna. Blev eleven aktiv av något annat (den första i listan, en
familj i meddelandelistan, ett pass) frågar fliken igen: `S.elevVald`
minns vem man tryckt på, inte bara att man tryckt. Förut skrev
formulären på den första eleven tills man bytt, och rutan som sa vem
det var stod ovanför sektionen, 800 px över formuläret på en telefon.
Rutan står därför inte längre under Lektioner & elever, bara ovanför
Läxor och Meddelanden. En enda elev väljs inte; kortet säger bara vem.

## Studiehjälparen utåt och omdömena

En studiehjälpare syns publikt först när admin satt läget till
**Godkänd**.

Ur avsnitt 11:

- **Riktiga foton på studiehjälparna.** Generisk siluett nu.

**Omdömen hittas aldrig på** (2026-09-25). Falska
konsumentrecensioner står på marknadsföringslagens svarta lista sedan
1 september 2022, och den som visar recensioner måste säga om och hur
de kontrolleras. Röster på startsidan var tre tomma platshållare; tills
riktiga omdömen finns står där ett brev undertecknat Leo och
Alexandar, under rubriken "Innan de första omdömena". Vad som gäller
för ett riktigt omdöme står i kommentaren över sektionen i
`index.html`. Google-recensionen frågas efter i studievyn
(`ritaRecension`) så fort `GOOGLE_RECENSION_URL` är satt, och alla
familjer med två rapporter får samma fråga: att bara skicka de nöjda
vidare förbjuder Google. `tutor_reviews` (v7) är omdömen om
studiehjälparen, inte om Nextrum, och ska aldrig bli publik, för
studiehjälparna är ofta sexton. Den har noll rader och ingen vy skriver
dit. Insert-policyn prövade förut bara att passet var familjens, så en
familj kunde skriva om vilken studiehjälpare som helst; sedan Fas 19.3
måste `tutor_id` vara passets studiehjälpare och `student_id` passets
elev.

## Avtal som delas med personen

**Ett avtal delas med personen det gäller** (2026-09-29, Leo: "man ska
kunna spara dokument där och välja vilken person som ska ha tillgång
till det genom sina inställningar. dvs anställningsavtal med lärare
eller annat avtal med kund"). Under System → Dokument väljer admin vem
en handling gäller, en familj eller en studiehjälpare, och om personen
ser den. Personen läser den under **Profil & inställningar → Dokument**
i sin egen vy (`NXStudie.dokument`, samma i båda vyerna) och kan öppna
eller ladda ned filen, men inte ändra något. Personen står i
`kopplad_tabell = 'profiles'` och `kopplad_id`, kolumnerna som fanns
sedan Fas 9.10 utan att någon vy satte dem, och delningen i
`handlingar.delad_med_personen`. En person, inte en lista: ett avtal
har en motpart, och en handbok till alla studiehjälpare är en annan
regel som byggs när den behövs. Tre saker:
- **Personen läser aldrig tabellen.** `handlingar` bär vår
  `anteckning`, och RLS kan inte begränsa kolumner. `mina_handlingar()`
  lämnar ut en fast kolumnlista för den inloggade själv, och hinken
  släpper in exakt den fil raden pekar ut (`intern.handling_delad_med_mig`),
  inte en annan fil i samma mapp.
- **Vyerna är låsta tills de öppnas.** En familj ser ingenting förrän
  den är matchad, och en studiehjälpare förrän hen är godkänd.
  Formuläret säger det när personen väljs; dokumentet syns när vyn
  öppnas.
- **Öppna går i samma tryck** (`NXMedia.öppnaFil`): en PDF eller en bild
  i en ny flik som öppnas innan länken finns, annars stoppar Safari den
  tyst; Word laddas ned. Länken gäller fem minuter, för ett avtal kan
  bära ett personnummer.
Personens panel i adminvyn visar dokumenten under Översikt, med en
länk till formuläret där personen redan är vald. Ingen notis går ut
när något delas (avsnitt 11).

**Ett avtal klistras in som text** (2026-10-05, Leo: "avtalen som
skrivs ska kunna kopplas till användare också, dvs föräldrar vilket
innebör att jag ska kunna klistra in avtal som lagras hos mig och hos
de. avtalet ska kunna namges hur som helst"). Under System → Dokument
väljer admin **Som: Inklistrad text**, och avtalet blir en rad i
`handlingar` med texten i `innehall` (`avtal_som_text`). Titeln är fri
text som förut, och personen ser den som rubrik; sorten är den fasta
listan. Personen trycker **Läs** under Profil & inställningar →
Dokument, texten fälls ut under raden, och **Ladda ned** ger en
textfil med avtalets namn (`NXMedia.sparaText`), samma fil som admin
får från Öppna. Fyra saker:
- **En fil eller en text, aldrig båda** (`handlingar_fil_eller_text`).
  En rad utan fil är en text; så vet vyn vilken knapp den ska rita.
- **Texten ändras aldrig**, inte ens av admin
  (`handlingar_texten_star_fast`). Ett avtal motparten läst får inte
  bli ett annat utan att hen vet det. En ny version är en ny handling,
  och den gamla tas bort för sig. Titeln, sorten, giltigheten och
  delningen går att ändra.
- **Ingen maxlength i rutan.** Webbläsaren kortar en inklistrad text
  tyst vid gränsen, och ett avkortat avtal ser helt ut. Taket (200 000
  tecken) prövas när det sparas, med ett besked, och i databasen.
- **Bara text.** Radbrytningarna står kvar, men inte fetstil, tabeller
  eller bilder; ett avtal som behöver dem laddas upp som PDF.
  Formuläret säger det.
Att avtalet syns i en inloggad vy är inte säkert samma sak som att
familjen fått det på ett **varaktigt medium**, som distansavtalslagen
kräver av bekräftelsen: en sida vi styr och kan ta bort räknas troligen
inte som det (EU-domstolen, Content Services, C-49/11). Ladda ned ger
familjen en egen kopia, men vill vi kunna visa att de fått villkoren ska
avtalet också mejlas. Det är en fråga för juristen, inte för koden.

Driftsättningen och det som är kvar, ur avsnitt 11:

- **Avtal som text (2026-10-05) är i drift.** PR #188 mergades och
  Vercel driftsatte merge-commiten samma kväll. Migrationen
  `avtal_som_text` kördes avsnitt för avsnitt efter merge, som version
  `20261005120000`, och det driften sparade har samma md5 som filen
  (`5145c632…`). Hela `rls-test.sql` från merge-commiten mot driften, i
  en transaktion som rullades tillbaka: 1279 av 1280, alla 13 nya gröna.
  Den röda är 14.6 "familjen väljer faktura på ett genomfört obetalt
  pass": fixturen lägger passet "förra månaden", och september 2026 är
  stängd i driftens bokslut (Fas 20.2), så månadslåset nekar. Det är en
  datumfälla i testfilen, inte ett fel i schemat; lokalt 1280 av 1280.

- **Avtalen som delas med personen (2026-09-29, avsnitt 1) är i drift.**
  Migrationen `dokument_delas_med_personen` kördes efter att PR #126
  mergats, som version `20260929080900`, och det driften sparade har
  samma md5 som filen. Hela `rls-test.sql` gick igenom mot driften
  efteråt: 771 av 773, där de två är Fas 23.1:s prov, som väntar på sin
  egen migration. En databas byggd utan migrationen tål vyerna: System →
  Dokument laddar upp som förut, delningen säger att den inte finns än,
  och Profil → Dokument står tom. Kvar:
  1. **Ingen notis när något delas.** Personen får varken mejl eller
     en rad i vyn; säg till själv. En notistyp är fem steg
     (`DEPLOY-NOTISER.md`) och en driftsättning av `notis-ko`.
  2. **Ingen underskrift.** Dokumentet är en kopia att läsa. Ett avtal
     som ska skrivas under skrivs under någon annanstans, och den
     påskrivna filen läggs upp som en ny handling.
  3. **En person per handling.** Något som ska nå alla studiehjälpare
     (handboken, en policy) är en egen regel, och byggs inte förrän den
     behövs.

## Admin läser chatten

**Admin läser chatten utan att parterna ser det** (2026-09-29, Leo:
"vi på admin ska kunna gå in i elevers och lärares chattar utan att de
ser det. det gör vi från vår admin genom att trycka på öppna chatt").
**Öppna chatt** står på varje tråd under Frågor → Chattar och under
Chatt på familjens och studiehjälparens Översikt, och öppnar hela
tråden i personpanelen (`chatt:<familj>|<studiehjälpare>`), bara för
läsning. Läsrätten fanns sedan schema-v4; det nya är vägen till en hel
tråd och spåret efter den. Tre saker:
- **Osynligt i stunden, aldrig hemligt.** Vyn läser genom
  `chatt_las()` och aldrig genom `NXKontakt.tråd()`, som markerar det
  den visar som läst: vår läsning hade tagit bort "oläst" hos den som
  skrev. Ingen Realtime-kanal, ingen skrivruta, ingen notis. Att vi KAN
  läsa står i integritetspolicyn på båda språken (Vem som kan se vad,
  och 6.1 f under Varför vi får göra det) och i chatten själv ("det som
  sägs här stannar mellan er och oss"). Ta inte bort det: att de inte
  märker när vi läser är lagligt, att de inte vet att vi kan är det
  inte (GDPR art. 5.1 a och 13).
- **Varje öppning står i auditloggen** (`chatt.oppnad`: vem, när,
  familjen som Gäller, studiehjälparen och antalet meddelanden, aldrig
  texten), skriven av funktionen i samma transaktion som läsningen, som
  personnumret (Fas 6.1). Tråden hämtas därför om vid varje öppning och
  aldrig ur panelens cache. Loggen är ett spår, inte ett lås:
  läsrätten på `messages` står kvar för chattlistans senaste rad och
  familjens tidslinje.
- **Syftena i policyn är de vi får läsa för**: barnens trygghet, tonen,
  och att reda ut det som gått fel. Att läsa för att det går täcks inte
  av dem, och en studiehjälpare ska ha fått veta i förväg att chatten
  kan läsas (DATASKYDD.md avsnitt 8).
`chatt_las()` ger de 500 senaste meddelandena, nyast först, och
`totalt`: PostgREST kapar ett svar vid tusen rader, och en tråd hämtad i
tidsordning hade tappat de nyaste. I drift sedan 2026-09-29 (avsnitt
11).

**Barnets egen tråd** (barnets_chatt, 2026-10-06): ett barn med egen
inloggning skriver till sin studiehjälpare i `barn_meddelanden`, en
tabell för sig, och föräldern läser utan att skriva. Admin läser den i
samma Öppna chatt, under rubriken Barnens trådar, genom `barnchatt_las()`,
som loggar `chatt.oppnad` med tabellen `barn_meddelanden`; samma regler
som ovan, och det står i barnets och studiehjälparens ruta att föräldern
och Nextrum kan läsa. Varför och hur: `minne/barnkonton-och-admin.md`.

Driftsättningen och det som är kvar, ur avsnitt 11:

- **Chatten som admin öppnar (2026-09-29, avsnitt 1) är i drift.**
  Migrationen `admin_oppnar_chatten` kördes efter att PR #137 mergats,
  med versionen i filnamnet (`20260929123125`): raden i
  `schema_migrations` skrevs i samma transaktion som migrationen, efter en
  md5-prövning mot filen, så `created_by` är tom på just den, som för
  Fas 23.1. Det driften sparade har samma md5 som filen. Hela
  `rls-test.sql` från main gick igenom mot driften efteråt, 923 av 923,
  också NexLäx (Fas 23.2), som en annan session kört samma eftermiddag
  som `20260929150309` och `20260929150310`. Före merge provades den i en
  transaktion som rullades tillbaka: 873 av 873 med migrationen, och
  utan den föll bara avsnittets egna fem rader. En databas byggd utan
  migrationen tål vyn: Öppna chatt står kvar i listorna, men panelen
  säger att migrationen saknas och läser ingenting, för en läsning utan
  rad i loggen ska inte gå att göra från vyn. Kvar som inte är kod: säg
  till studiehjälparna och familjerna med konto att vi kan läsa chatten
  (DATASKYDD.md avsnitt 8).

## Det sajten lovar om studiehjälparna och formatet (2026-10-06)

- **"Kontrollerade" och "verifierade" studiehjälpare** stod på fyra sidor
  utan att säga vad kontrollen är, och en förälder läser in
  belastningsregister i ordet. Bakgrundskontroller är inte byggda. Sidorna
  säger nu det som sker: intervju, utbildning och ett prov.
  Börjar ni begära utdrag ur belastningsregistret får sidorna säga det.
- **Vem som får söka:** alla som får jobba (Leo, 2026-10-06). Startsidan sa
  "du behöver inte studera för att jobba här", medan Bli studiehjälpare,
  FAQ:n, Vår idé, prissidan, två läxhjälpssidor och kontaktformuläret sa
  gymnasie- och högskolestudenter. Nu säger alla att den som får jobba får
  söka, också den som inte pluggar; under 18 gäller vårdnadshavarens
  godkännande. "Nyligen läst samma kurser" står kvar som det matchningen
  letar efter, och "Av unga, för unga" som namnet på idén. Fältet Skola &
  program i ansökan var aldrig obligatoriskt och säger nu "om du pluggar".
- **Hemma eller online:** familjen väljer för varje pass; att ses hemma
  förutsätter att matchningen ger någon som kan ta sig dit varje vecka,
  annars börjar man online. Områdessidorna sa att formatet "avgörs av
  matchningen, inte av adressen", och ämnessidorna att ni väljer.

## Betygsgarantin (2026-10-07)

Leo ville ha en betygsgaranti som Studybuddys, men svårare att få. Den
blev svårare genom villkor som går att räkna, inte genom luddiga
(`anvandarvillkor.html#betygsgaranti`, båda språken).
- **Inget om engagemang.** Förlagan hänger på att eleven "visar intresse"
  och att bolaget bedömer det. Ett villkor som bara vi bedömer gör
  garantin till ett löfte vi själva kan säga nej till: vilseledande
  marknadsföring, och troligen ett oskäligt villkor. Våra läses ur det som
  redan finns: hållen tid, rapporterna, `bookings.attendance =
  'franvarande'`, `homework.status` mot `due_date`, och betalningarna.
- **Årskursens betyg** (Leo samma dag, efter ett varv med 40 och 30
  veckor): betyget som räknas är årskursens sista, det skolan sätter när
  läsåret slutar, i varje årskurs. Texten säger inte bara "slutbetyg", för
  i åk 6-8 heter vårens betyg terminsbetyg och ordet hade uteslutit dem;
  "i åk 9 slutbetyget" lästes som bara nian, så texten säger nu rakt ut
  "varje årskurs, inte bara årskurs 9". Ett terminsbetyg till jul räknas
  inte, och därför är kopiorna betyget före anmälan och det som räknas,
  inte "de två senaste".
- **Inget veckoräknande, men ett golv: 31 december** (Leo). Garantin ska
  vara anmäld och passen ha börjat senast då. Utan golvet börjar någon i
  maj, när betyget i praktiken är satt, köper ett par timmar och får tio.
  Först stod det "före vårterminen", men vårterminen börjar olika dagar
  i olika kommuner och skolor, och det kan ingen databas pröva.
- **Högst tre ämnen per elev och läsår**, två timmar varje skolvecka
  sammanlagt, inte per ämne (Leo: inte sex timmar i veckan), och 10 timmar
  sammanlagt, inte per ämne som inte gick upp (Leo). Går betyget inte upp i
  ett ämne för att familjen fokuserat mer på ett annat av ämnena med
  garanti, gäller garantin inte för det (Leo, med hans ord). En räknebar
  form, under hälften av det största ämnets tid, sa han nej till samma
  dag. Regeln är alltså den enda i garantin som är en bedömning och inte
  går att räkna, och den görs ur rapporternas fritext, så den vilar på att
  studiehjälparen skriver ämnet och tiden när ett pass delas.
- **Andra ämnen påverkar den inte** (Leo): vi hjälper med andra ämnen och
  läxorna i stort som vanligt, och de timmarna räknas bara inte in i de
  två. Därför gäller fokusregeln mellan ämnena med garanti; med "ett annat
  ämne" hade de två meningarna sagt emot varandra, och i ett
  konsumentavtal vinner då den läsning som är bäst för familjen ändå.
- **Hårdare än förlagan:** ämnen som anmäls i förväg och inte byts,
  två timmar varje skolvecka till läsårets slut, missade timmar igen inom
  14 dagar, inga uteblivna pass, 90 procent av uppgifterna i tid, allt
  betalt och ingen faktura sen, en gång per elev och ämne, och 10 timmar
  i stället för 20.
- **30 dagar för anspråket, med flit inte kortare:** betygen sätts före
  sommarlovet, och en kortare frist slår mot den som är bortrest, inte mot
  den som inte gjort jobbet.
- **Anmälan i föräldravyn** (Leo samma dag: "smidigare"), under Profil →
  Betygsgaranti, i stället för ett mejl. Föräldern väljer ämnet och anger
  barnets nuvarande betyg, ett ämne per tryck, och `anmal_betygsgaranti()`
  prövar allt: vuxen och barnets förälder, godkända villkor, öppet 1 juli
  till 31 december svensk tid, ett ämne ur `intern.betygsgaranti_amnen()`,
  betyg F till B, högst tre och samma ämne en gång (med ett lås, så att
  två tryck samtidigt inte blir fyra). Tiden och läsåret sätter databasen;
  läsåret är året det börjar. Ingen inloggad skriver i `betygsgarantier`.
  Föräldern och admin med `anvandare_las` eller `anvandare_redigera`
  läser; studiehjälparen, en annan familj och barnet inte. Elevens panel
  i adminvyn visar anmälningarna.
- **Låst för familjen, bara vi rättar** (Leo samma dag: "spärr, bara vi
  kan ändra den och då står det senast ändrad"). Den som får redigera
  personer rättar ämnet eller betyget i elevens panel (Rätta,
  `andra_betygsgaranti()`), med samma prövningar som anmälan utom datumet,
  och aldrig ett gallrat betyg. Raden får `andrad_at`, som familjen ser
  ("senast ändrad av oss"), och `andrad_av`, som ingen inloggad läser:
  RLS begränsar inte kolumner, så tabellen har kolumnrättigheter, som
  `tjanster`. Ingen väg tar bort en rad.
- **Ämnena har ett eget betyg**, till skillnad från vyns grupper ("NO /
  Fysik / Kemi / Biologi" har inget betyg att jämföra med). Listan står i
  `NX.GARANTI_AMNEN` i `nextrum-app.js` (föräldravyn anmäler och adminvyn
  rättar ur den) och i `intern.betygsgaranti_amnen()`, och de ändras
  tillsammans. Den är en
  funktion och inget villkor på tabellen, så den byts utan drop.
  Programmering togs ur båda 2026-10-07, samma dag som listan kom
  (`20261007150100_programmering_erbjuds_inte`, i drift samma dag och
  `prosrc` prövad mot filen): Nextrum erbjuder det inte, och ingen
  anmälan fanns i ämnet.
- **Betyget i anmälan.** Först skulle vi se betyg bara vid anspråket,
  eftersom policyn lovade att vi aldrig ber om dem; Leo valde samma dag
  att föräldern anger det vid anmälan. Policyn och registret (rad 25)
  säger det nu. Betyget gallras den 1 oktober efter läsåret
  (`betygsgaranti-gallring`, 03.56 UTC) och direkt när barnet raderas
  eller avidentifieras (`students_betygsgarantier_raderas`); raden står
  kvar utan betyg, för en garanti används en gång per elev och ämne. Vid
  anspråket gäller kopian, inte det föräldern angav. Kopiorna kommer med
  e-post till info@, som ligger i Google Workspace, och raderas för hand.
- **Timmar, aldrig pengar**, som tipstimmen.
- **Passen har inget ämnesfält.** Ämnet läses ur rapportens fritext; ett
  fält på passet vore en egen ändring. Studiehjälparen ser inte heller
  vilka ämnen som har garanti; familjen får säga det.
- **Sidorna säljer den** (Leo samma dag: "sälj in det utan konkreta villkor
  eller siffror", och sedan "effektivt, inte överdrivet"). I dag (2026-10-08):
  på startsidan och Vår idé en platt remsa under Hur hjälper vi ditt barn
  (`.hj-gar`, meningen, stegen 01–04 och "Villkor gäller." med länken till
  villkoren); på prissidan ingen sektion (Leo: "öndödigt stor"), bara raden
  "Betygsgaranti, utan extra kostnad (villkor gäller)" i 399-kortet och
  länken "Läs mer om betygsgarantin" till villkoren under dess knapp
  (`minne/vyerna.md`, Prissidan utan garantisektion). Förut, som historik:
  en sektion på startsidan efter Så fungerar Nextrum och på prissidan efter
  priskorten (2026-10-07 på papperet som ett flöde, inte mörk: Leo
  ville ha "samma färg som resten av sidan", "inte samma kolumner som
  finns överallt" och "en mindre sektion" som "följer ett flow när man
  scrollar"; fyra steg med stora siffror och en linje som fylls i lera,
  och länken till villkoren och raden "Villkor gäller" intill knappen,
  aldrig bakom en utfällning). Dessutom
  en punkt i startsidans sista ruta, prissidans och FAQ-sidans
  beskrivning, och samma fråga i prissidans FAQ och på `/faq`, som
  maskoten och FAQ-schemat därför också svarar med. Inga villkor och inga
  tal, men aldrig ett löfte om ett betyg (avsnitt 8 i kärnan): garantin
  lovar vad vi gör om betyget inte går upp. Varje ställe länkar till
  villkoren eller till ett ställe som gör det och säger att de gäller, för
  en garanti som säljs utan att det syns att den har villkor är
  vilseledande. Undantaget är sista dagen, 31 december, i FAQ-svaren: den
  som missar den har ingen garanti, och det ska inte stå bara i
  villkoren. Hero är orörd, och startsidans beskrivning likaså (den är
  redan vid gränsen för vad sökmotorerna visar).
- **Versionen byttes** (`betygsgarantin`), så alla får frågan igen.
  Inget är byggt för att pröva ett anspråk: admin räknar ur vyerna.
  `rls-test.sql` avsnitt 24 prövar anmälan, läsrätten, gallringen och
  raderingen (1490 av 1490 lokalt, och mot driften när migrationen
  kördes efter merge av PR #212 samma dag; `minne/databasen.md`).

## Tipsa en familj och affischerna (2026-09-30)

Leo 2026-09-30, ur analysen samma dag: en värvningslänk för familjer och
studiehjälpare, belönad med en bjuden timme till familjen och inga pengar
till tonåringen (punkt 5), och affischer med QR-kod på några ställen nära
skolorna (punkt 7). Migrationen `tipskoder_och_kampanjkoder`.

- **En kod, två sorter.** `tipskoder` har en rad per kod: `familj` och
  `studiehjalpare` hör till en person och skapas av `mina_tips()` första
  gången personen öppnar Profil → Tipsa en familj; `kampanj` har ett namn
  och skapas av admin under Tjänster & priser → Tips och kampanjer (fram till
  2026-10-06 under Intresseanmälningar).
  `leads.kod` pekar på raden (främmande nyckel, on delete set null).
  Personkoden är sex tecken utan I, O, 0 och 1, slumpad och utan namn:
  den delas öppet.
- **Koden syns, den lagras inte.** Länken och QR-koden går direkt till
  intresseanmälan med `?kod=`, och formuläret fyller i ett synligt fält
  som familjen kan tömma. Ingen sessionStorage: källspårningen kräver
  samtycke, och rutan är av. Därför går affischens QR-kod till
  formuläret och inte till områdessidan, där en sida hade behövt minnas
  koden åt nästa.
- **En okänd kod fäller aldrig en anmälan.** `intern.leads_tipskod()` gör
  om en okänd eller avstängd kod till null innan främmande nyckeln
  prövas. En kod tas aldrig bort, den stängs av (`aktiv`).
- **Tipstimmen är prissidans första timme med en annan märkning**:
  `startrabatt = true` och en timme i `rabatt_ore`, plus `rabattkod =
  'TIPS'`. Allt som redan vet att ett pass med första timmen bjuden inte
  betalas med köpta timmar eller timbanken, att noll kronor inte är
  obetalt och hur priset visas, gäller då utan ändring. `bookings.rabattkod`
  pekar på `rabattkoder`, så raden `TIPS` finns där, och
  `rabattkoder_tips_aldrig_aktiv` hindrar att den slås på: då hade en
  familj kunnat skriva in den. `skydda_rabatt` skyddar kolumnen redan.
- **Regeln** står i `forsta_timmen_bjuds` och `intern.tipstimmar_*`: en
  timme per familj som anmält sig med familjens kod och haft sitt första
  pass (genomfört med rapport, eleven inte frånvarande). Familjen måste
  ha varit ny, utan hållet pass före anmälan, annars hade ett syskons
  anmälan med en väns kod gett en timme. Bara familjens FÖRSTA anmälan
  med en kod räknas. Prissidans första timme går först; tipstimmen dras
  på nästa läxhjälpspass familjen föreslår, en per pass, och kommer
  tillbaka när passet avbokas eller avslås. Den räknas ur raderna och
  sparas inte.
- **Ingen ersättning till studiehjälpare**, med flit: de är ofta sexton,
  en belöning för att värva kunder är lön, och anställningsformen är inte
  avgjord.
- **Flaggan `tipstimme`** stänger av erbjudandet. Det som tjänats in innan
  ges ändå, för villkoren (`#tips`) lovar det: gränsen är flaggans
  `uppdaterad`, som `stampla_flaggan` sätter och bara en ändring av
  `aktiv` flyttar. Stängs den av ska villkoren ändras i samma veva.
- **Den som tipsat ser antal, aldrig vilka** (`mina_tips()`): anmälda,
  kunder och familjens timmar. Det står under kodfältet, i villkoren och
  i integritetspolicyn på båda språken, och i DATASKYDD.md rad 19.
- **En raderad person har ingen kod.** `profiles_tipskod_raderas` tar
  bort koden när `raderad_at` sätts (en egen trigger, inte en lapp i
  `radera_person`, som flera sessioner skriver om), och vid en hel
  radering följer den med genom nycklarna. Anmälningarna tappar då
  koden. En anmälan som avidentifieras behåller den.
- **Adminvyn**: "Tipsad av …" i anmälans panel (`dpKod`), listan med
  anmälda, kunder och första pass (`tipskoder_lage()`, bara admin), och
  strömbrytaren under Betalningar → Inställningar. `TIPS` visas inte
  bland rabattkoderna, och ett pass på noll kronor med tipstimmen heter
  "Timme bjuden för tips" i Betalningar.
- **Affischen** (`/affisch?kod=&omrade=`, `nextrum-affisch.js`) är en A4
  med QR-kod till intresseanmälan med koden och
  `utm_source=affisch&utm_medium=qr`, och åtta rivlappar som slutar 7 mm
  från kanten, där skrivaren lämnar tomt. QR-kodaren är
  `bibliotek/qrcode-generator-1.4.4.js` (MIT), vendorad som supabase-js.
  Sidan är `noindex`, bara på svenska och tar ingen fritext ur adressen:
  koden prövas mot samma form som i databasen och området ur en fast
  lista, annars hade vem som helst kunnat skriva ut en affisch med vår
  logga. Raden om vecka 43 försvinner efter `UPPSTART`. QR-koden lästes
  av med OpenCV ur en skärmbild i provet. Planen står i
  `AFFISCHKAMPANJ.md`.
- **Provat** lokalt: 1009 av 1009 i `rls-test.sql`; utan migrationen
  faller de elva nya raderna och inga andra. Vyerna tål att den saknas:
  fliken står tyst och adminlistan säger att migrationen saknas.
- **I drift sedan 2026-09-30.** Migrationen kördes efter att PR #157
  mergats, med versionen i filnamnet (`20260930190000`): databasen
  hämtade filen från merge-commiten med tillägget `http`, prövade md5,
  körde den och skrev raden i `schema_migrations` i samma transaktion, så
  `created_by` är tom, och tillägget togs bort igen. Det driften sparade
  har samma md5 som filen. Hela `rls-test.sql` från merge-commiten gick
  igenom mot driften före, i en transaktion som rullades tillbaka med
  migrationen inläst, och efter: 1009 av 1009. Säkerhetsadvisorn fick två
  väntade rader till, `mina_tips` och `tipskoder_lage` (`minne/sakerhet.md`).
  Flaggan `tipstimme` står på, och ingen kod fanns när migrationen kördes.

---

### Ordlistan (använd den, i kod och i text)

| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet. Aldrig "lärare" utåt — `larare.html` heter så av historiska skäl. "Privatlärare" står en gång, i FAQ:n, för att säga att en studiehjälpare INTE är det (2026-09-28): ordet är det konkurrenterna och föräldrarna söker på, och svaret är ärligare än att tiga |
| pass | ett bokat tillfälle (`bookings`). Hela timmar, 1–3 |
| rapport | `lesson_reports`. **Passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass: med kort, per pass, i förväg eller efter passet när rapporten bekräftas (`bookings.betalning_status`, `betalt_ore`). Eller mot faktura, när flaggan `faktura` är på (Fas 14.6) |
| faktura | `invoices`. Sedan Fas 14.6 ett betalsätt familjen kan välja per pass, efter passet. Påslaget sedan 2026-09-27 (flaggan `faktura`). Skickas från Fortnox, aldrig härifrån |
| tjänst | rad i `tjanster`. `aktiv` avgör vad som syns, inget annat |
| uppgift | i studievyn (under NexLäx) och studiehjälparvyn det eleven ska göra mellan passen (`homework`, Fas 23.1). Hette läxa. I adminvyn och i tabellen `uppgifter` betyder ordet fortfarande adminens att göra-lista; koden för elevens uppgifter säger `laxor` och `homework` |
| nivå | en digital uppgift i banan (`nivaer`): 5–12 frågor som rättas i databasen. En **bana** är nivåerna i ett ämne och en årskurs. Ett **Mästarprov** och **repetitionen** är nivåer som drar sina frågor ur banan (Fas 23.2) |
| NexLäx | studievyns sektion för banan, det studiehjälparen gett och utvecklingen (Fas 23.2). Ersatte Uppgifter och Min utveckling. I koden `nexlax` och `NXUppgifter` |
| motförslag | en annan tid som svar på ett förslag: samma pass, flyttat, med `motforslag_at` (2026-09-30). Besvaras med ja eller nej. Ett avslag är `cancelled` med studiehjälparens svar i `svar_meddelande` |
| XP | poäng som räknas ur svaren och försöken och aldrig sparas (Fas 23.2, reglerna i `intern.nexlax_*`) |
| tipskod | en familjs eller studiehjälpares egen kod i intresseanmälan (`tipskoder`, 2026-09-30); en kampanjkod är en affischs |
| tipstimme | en timme på köpet för ett tips: `startrabatt` och `rabattkod = 'TIPS'` på passet |
