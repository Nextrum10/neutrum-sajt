# Minnesposter för projektet Nextrum

Det här är minnet för Claude-projektet Nextrum, i klistringsbar form.
Sju poster, en per rubrik. Varje rubrik är postens namn.

Filen ligger i repot för att minnet annars bara finns på en maskin, och
för att den som ändrar en regel ska kunna ändra den på båda ställena i
samma commit.

## Principen: minnet är tunt och pekar på repot

Detaljen bor i `CLAUDE.md`, som alltid är färskare än en minnespost.
Posterna nedan säger vad som gäller och var det står, inte allt som står
där. Ett minne som försöker innehålla hela sanningen blir fel i samma
sekund som någon ändrar koden, och då är det värre än inget minne.

## När den här filen ändras

Ändrar du en regel i `CLAUDE.md` som också står här: ändra båda, i samma
commit, och klistra om den berörda posten i projektet. Två sanningar som
glider isär är exakt det fel resten av kodbasen är byggd för att hindra
(se `_delad/`, `konstanter.ts`, `kolla-betalningsvillkor.py`).

## Posten som inte står här

`project-nextrum-engelska` fanns i projektminnet innan den här filen
skrevs och kunde inte läsas härifrån. Den rörs inte.
`project-nextrum-sprak-kod` nedan är skriven som komplement till den,
inte som ersättning. Står de emot varandra vinner den äldre tills någon
läst båda.

---

## `project-nextrum-oversikt`

Nextrum: läxhjälpsförmedling i Stockholm. Repo `Nextrum10/neutrum-sajt`,
driftsatt på Vercel som `nextrum.se`. Supabase-projekt `ddkfiuvcppalutfulvbi`.

**Projektminnet ligger i `CLAUDE.md` i repotroten. Läs den först. Den är
färskare än den här posten.**

Stacken: inget byggsteg, ingen pakethanterare, inget ramverk. Statiska
filer i repotroten serveras direkt. Vanilla JS som IIFE:er på `window`
(NX, NXStudie, NXArbete, NXMedia, NXKontakt, NXBetalning, NXTjanster,
NXAgent, NXMotion). Backend: Supabase plus Deno edge functions. Mejl via
Resend. Modeller från Anthropic, bara i edge functions.

Affären: familjen skickar intresseanmälan, Nextrum ringer och väljer
studiehjälpare, admin sätter matchningen, då först låses föräldravyn upp.
Ingen katalog att bläddra i.

Ordlista: studiehjälpare (aldrig "lärare" utåt), pass, rapport, underlag,
betalning, tjänst. Faktura är historik sedan Fas 14.2.

Två siffror och ett löfte står på många ställen samtidigt: 379 kr/tim,
69 kr/tim fast tillägg för flera barn (tak tre, alltså 448 för tre barn,
inte 517), och att familjen betalar varje pass med kort, före passet:
ett pass som inte är betalt hålls inte. Studiehjälparen får betalt den
25:e. Belopp lagras i ören överallt.

Koden är svensk: identifierare, kommentarer, commit-meddelanden, filnamn,
kolumnnamn. Skriv inte engelsk kod i den här kodbasen.

---

## `project-nextrum-sakerhet`

Säkerhetsmodellen i Nextrum, det som förklarar större delen av koden.
Detaljen: `CLAUDE.md` avsnitt 6.

**Allt skydd ligger i RLS. Ingenting ligger i gränssnittet.** Adminvyn
hämtar med samma anon-nyckel som alla andra vyer. Att gömma en knapp är
inte säkerhet: den som inte är admin får tomma svar oavsett vad filen
ritar. `is_admin`-kontrollen i klienten finns för att visa rätt sida.

anon-nyckeln är inte hemlig, den hör hemma i webbläsaren. `service_role`
får aldrig in i en klientfil.

I edge functions: anroparens egen token prövas mot Auth och RLS INNAN
`service_role` används. En kontroll som ligger efter `service_role` är
ingen kontroll. `_delad/auth.ts` har en väg per fråga, uppfinn inte en ny.

Postgres RLS kan inte begränsa enskilda kolumner. Därför vaktas
`is_admin`, `matched_tutor_id`, `status` och bokningsfälten av triggers
som vägrar ändringen från en inloggad session. Admin sätts med SQL, inte
från någon vy.

`invoices` och `payouts` har med flit ingen INSERT-policy för användare.
`integrationer` har ingen skrivpolicy alls: adminvyn rapporterar status,
den kopplar inte.

Notishemligheten ligger i tabellen `notis_konfig`, inte i en secret. En
secret och en webhook-header i två fönster glider isär, och då svarar
funktionen 401 på varje anmälan emellan.

Ett notismejl säger ATT något hänt, aldrig VAD. `renData()` i
`_delad/notiser/typer.ts` släpper bara igenom datum, tid, ämne,
förnamn och avbokningens skäl som fast kod; allt annat i raden läses aldrig, så ingen meddelandetext kan nå
ett mejl hur mallen än formuleras. Varje namn kapas dessutom till
förnamn utan punkter — `full_name` är fritext, och ett "namn" som ser ut
som en adress blir annars en länk i ett mejl med godkänd DKIM.

CSP: `/admin`, `/larare` och `/foralder` har `script-src 'self'`. **Ingen
inline-JavaScript i de tre sidorna.** Inga `<script>` utan `src`, inga
`onclick`, inga `javascript:`-adresser. `verktyg/kolla-csp.py` vaktar det
i CI.

En funktion som svarar på en fråga om en PERSON ska ha `is_admin`s vakt
från första raden: svara bara när uid är anroparens eget eller
anroparen är admin. `ar_godkand_studiehjalpare` saknade den i Fas 13.2
och var ett orakel för vem som helst med ett uuid. Rättat i Fas 14.0b,
med revoke från anon — och att revoken var säker prövades FÖRST, för
ett CHECK-villkor eller en policy `to anon` som backas av funktionen
hade gått sönder (Fas 10 kostade den lärdomen en gång).

Rå servertext visas bara i de inloggade vyerna (`body.vy`). På en publik
sida beskriver den en tabell och en policy för vem som helst, och
föräldern förstår den inte. `NX.felText` skickar den till konsolen och
`klientfel` i stället. Varje meddelande som slutar i en återvändsgränd
bär `{oss}`, som `t()` fyller med `CFG.EPOST`.

`verktyg/rls-test.sql` körs som ett anrop mot databasen efter varje
ändring i en policy eller trigger. Varje rad i svaret ska vara ok.

---

## `project-nextrum-databas`

Migrationsreglerna i Nextrum. Detaljen: `CLAUDE.md` avsnitt 5 och
`supabase/migrations/arkiv/README.md`.

**Sanningen om vad som är kört står i databasen, inte i filnamnen:**
`select version, name from supabase_migrations.schema_migrations order by version;`

Ny SQL skrivs som `supabase/migrations/<version>_<namn>.sql`, där
versionen är exakt den `apply_migration` registrerade.
`verktyg/kolla-migrationer.py` vaktar namnregeln i CI.

**Klistra aldrig in SQL i SQL Editor utan att den också blir en fil i
migrations.** Det var så tre nummer (v13, v16, v17) kom att tas två
gånger, och en fil påstod länge att den inte var körd fast den var det.

`supabase/migrations/arkiv/` är de gamla `schema-v*.sql`. Ändra dem inte.
En rättelse är en ny migration, inte en omskriven historia.

Fallgropar i arkivet: `schema-v22.sql` kördes aldrig, kör den inte, den
är ersatt av v25. `schema.sql` rensar tabellerna, bara i tom miljö.

**Samma sak gäller edge functions.** `apply_migration` och `functions
deploy` ändrar driften direkt; git är ett skilt steg som ingen kontroll
tvingar fram. Runda 2 låg därför en tid enbart i driften: fjorton körda
migrationer utan filer, och två ACTIVE funktioner som inte fanns i någon
gren. Listan över det som faktiskt kör hämtas med `list_migrations` och
`list_edge_functions`, inte ur mappen. **Driftsätter du något, commit:a
det i samma arbetspass.**

**Och tvärtom: en inställning som bara finns i databasen finns inte i
produkten.** Flaggan `notiser_mejl` stod av från Runda 2 till Fas 13.4
och ingen fil i repot nämnde ens tabellen `flaggor`. Notiserna syntes i
vyn, kön fylldes, schemat gick — och varje mejlrad märktes tyst
`loggad`. **Ett avstängt system och ett trasigt system ser likadana ut
inifrån.** Bygger du en strömbrytare i en tabell: bygg reglaget i
adminvyn i samma ändring.

---

## `project-nextrum-sprak-kod`

Komplement till `project-nextrum-engelska`. Det här är vad repot numera
tvingar fram, inte en ersättning för de fällor som står där.

`/en/` är genererad ur de svenska sidorna genom att textnoder byts ut en
och en. Taggsekvensen är identisk mellan språkparen, och
`verktyg/jamfor-sprak.py` utnyttjar exakt det.

**Generatorn finns inte i repot.** `/en/`-sidorna är incheckade
artefakter. Ändras en svensk sida måste engelskan följa med för hand.

**Generatorn översätter aldrig `<script>`.** Allt som skrivs till
användaren från JavaScript måste ligga som ett par i `ORD` i en modul
(`nextrum-app.js` `NX.t()`, `nextrum-tjanster.js` `ord()`), med språket
läst ur `<html lang>` vid körning. En etikett skriven i sidans eget
skript blir svensk på den engelska sidan och ingen strukturkontroll ser
det.

Bara det som visas översätts. Strängar som skrivs till databasen
("Telefon: ", "Samtycke till lagring: ja") förblir svenska, de läses av
oss.

`verktyg/jamfor-sprak-baslinje.txt` innehåller de avsiktliga avvikelserna
(språkväljaren, personnamn). CI diffar mot den. Allt nytt är ett fel.
Uppdatera baslinjen bara när avvikelsen är avsiktlig.

---

## `project-nextrum-genererat`

Filer i Nextrum som aldrig ändras för hand, och vad CI vaktar.
Detaljen: `CLAUDE.md` avsnitt 8 och 9.

Genererat:
- `nextrum-maskot-svar.js` byggs av `verktyg/bygg-maskotsvar.py` ur
  `faq.html` och `en/faq.html`
- FAQPage-märkningen i båda faq-sidorna byggs av `verktyg/bygg-faq-schema.py`
- De sju `laxhjalp-*.html` byggs av `verktyg/bygg-omradessidor.py`, och
  skalet läses ur `var-ide.html` vid varje körning
- Ikonlänkar och bildstorlekar sätts av `verktyg/satt-logga.py`
- `?v=`-stämplarna på varje script- och link-tagg sätts av
  `verktyg/satt-version.py`, som körs SIST — områdesgeneratorn skriver
  egna script-taggar och tappar stämpeln
- `bilder/*.webp` byggs av `verktyg/bygg-webp.py`, som INTE körs i CI:
  en bildkodare ger inte samma bytes mellan versioner. `kolla-webp.py`
  vaktar i stället att filen finns och inte är äldre än sin jpg

CI (`.github/workflows/kontroll.yml`) kör om maskotsvaren och FAQ-schemat
och gör `git diff --exit-code`. Ändrar du FAQ:n utan att bygga om blir
bygget rött. Övriga steg: `node --check` på all JS, `testa-agent.js`,
betalningslöftet, migrationsnamnen, CSP, webp-filerna,
versionsstämplarna, språkdiffen (som jämför attributNAMN också),
`deno check` och `deno test`.

Kör kontrollerna lokalt före push. De är snabba.

Områdessidorna får inte innehålla något som inte är sant: inga antal,
inga betyg, inga okontrollerade skolnamn. Sju sidor som säger samma sak
med utbytt ortnamn är doorway pages.

---

## `project-nextrum-agenter`

Reglerna för Nextrums AI-delar. Detaljen: `CLAUDE.md` avsnitt 7,
`DEPLOY-AGENTER.md`, `supabase/functions/_delad/agent.ts`.

Fyra regler bär agenterna `juridik` och `ekonomi`:

1. Hårt stegtak. En agent som loopar fritt mot betalda API-anrop är en
   räkning som växer medan ingen tittar.
2. Källtvång som kod, inte som prompt. Koden kontrollerar att varje
   adress i svarets källista är en adress agenten faktiskt hämtade.
   Påhittade plockas bort. Blir listan tom kastas svaret.
3. Bara verifierade källor blir klickbara i gränssnittet. En påhittad
   adress ritas överstruken i en varningsruta. Linkifiera aldrig med
   regex, det bygger in precis det fel resten av systemet fångar.
4. `ekonomi` skriver aldrig. Alla verktyg är läsande. Det är designen,
   inte försiktighet i väntan på bättre modeller.

**Den tredje agenten, `drift`, har med flit inget utgående verktyg.** En
agent som både läser känsliga rader och kan hämta en adress kan bära ut
dem, och det räcker med en rad injicerad text i en intresseanmälan för
att försöket ska göras. `verktyg/testa-agent.js` vaktar det i CI:
verktygslistan är en fast mängd, inget verktyg hämtar något utifrån,
och stegtaket måste vara satt.

**Regeln "ingen AI-väg skriver i affärstabeller" bor i databasen.**
Rollen `nextrum_ai` har inga tabellrättigheter alls, och dörren
`ai_verktyg` ägs av den rollen. Följden: en invoker-vy går inte att
läsa därifrån — svaret blir `permission denied`, inte en tom lista — så
analysvyerna når agenten bara genom omslagen `ai_analys()` och
`ai_avvikelser()`, som lämnar ut en fast kolumnlista utan namn och utan
fritext.

`material-forslag` skriver ut uppgifterna i klartext, aldrig som länk. En
modell som ombeds hitta en länk hittar på en länk.

`generate-feedback` och `generate-message` använder inte `service_role`,
de vidarebefordrar användarens egen token.

**Maskoten har med flit ingen språkmodell.** Den svarar med Nextrums egen
text ur FAQ:n, ordagrant. En publik chatt mot en API-nyckel har sin
adress i sidans JavaScript, och en spärr i webbläsaren går att gå runt.
Följden: maskoten kan inte hitta på ett pris, ett villkor eller ett löfte.

---

## `project-nextrum-arbetssatt`

Hur arbetet i Nextrum bedrivs. Detaljen: `CLAUDE.md` avsnitt 10 och 11.

Commit-meddelanden är svenska och beskriver följden, inte diffen:
"Fas 2.5: en faktura skickas bara en gång", inte "fix invoice bug".
Arbetet går i faser: Fas 1 säkerhet, Fas 2 fakturering, Fas 3 struktur
och CI. Följ numreringen när arbetet hör till en fas.

Kommentarerna förklarar varför, inte vad. Filhuvudena säger vilket fel
konstruktionen finns för att hindra. Håll den stilen, den är halva
minnet.

`bilder/*.png` är gitignorerade originalen, cirka 50 MB. Sajten laddar
WebP genom `<picture>` med JPG som reserv — 69 % lättare, och en
webbläsare utan WebP får jpg:en som förut. Tappas datorn finns originalen ingenstans.

En Claude-artefaktlänk kan aldrig prata med Supabase. Testa mot riktiga
filer eller lokal server (`python3 .claude/serve.py 8951`, som härmar
Vercels `cleanUrls`).

Vyerna ska provas som en telefon, inte som en dator: Safari har ingen
scroll anchoring. En lista som byts mot "Hämtar" kastar sidan uppåt —
använd `NXStudie.laddarFörsta`. Det som står ovanför det man trycker
på får inte byta höjd av trycket; gör det det ändå, håll det man
tryckte på med `NXStudie.håll`. `1fr` i ett grid ska vara
`minmax(0,1fr)`. Inget som rör sig i onödan (video, zoom, oskärpa).
Detaljen: `CLAUDE.md` avsnitt 3, "Fyra fällor som gör vyerna hackiga".

Inte byggt än: en betalning som gått hela vägen. Sedan Fas 14.2 betalar
familjen varje pass med kort, före passet, och får ingen faktura.
Månadskörningen skapar bara studiehjälparens underlag, som betalas den
25:e från banken, aldrig genom Stripe. Kortvägen är driftsatt och
webhookens hemlighet provad, men ingen leverans från Stripe har kommit
fram. Spärren "ingen betalning, inget pass" (flaggan `kortsparr`) står
av tills en provbetalning gått igenom. Startererbjudandet på prissidan
finns inte i koden, och priset räknas när familjen betalar fast
villkoren lovar priset vid bokningen. Vidare: Google
Workspace, Fortnox (fällan: refresh-token roteras
vid varje användning, sparas inte det nya är ni utlåsta om en månad),
bakgrundskontroller, skatt och anställning av minderåriga, riktiga foton
på studiehjälparna.
