# Sätta upp betalning

Betalningen är byggd i två delar: **det som fungerar utan Stripe**, och **det som
kräver Stripe**. Gör den första delen nu — då kan ni se fakturor och underlag i
vyerna direkt. Ta Stripe när ni faktiskt vill att pengar ska röra sig.

Läs igenom hela filen innan du börjar. Det finns en torrkörning som du ska göra
före den första skarpa körningen, och den är hela poängen med den här ordningen.

---

## Vad som redan är gjort

Driftsatt mot projektet `ddkfiuvcppalutfulvbi`. Stegen står kvar nedan för att de
behövs om ni sätter upp en ny miljö.

| Steg | Läge |
|---|---|
| 1. Schemat | Applicerat |
| 2. Priset | Satt: 37900 ören, alltså 379 kr — samma som prissidan |
| 3. Timpenningarna | Satta för samtliga studiehjälpare (1 av 1) |
| 4. Deploy `fakturering` | ACTIVE — omdriftsatt i Fas 2 med urvalet nedan och 10 dagar (versionen före hade 14) |
| 5. Torrkörning | **Väntar på er** — knappen under Ekonomi → Månadskörning, ingen nyckel behövs |
| 6. Schemaläggning | **Väntar på er** |
| 7. Stripe | **Delvis.** Fas 12: migrationen applicerad och de tre stripe-funktionerna driftsatta. Nycklarna är INTE satta och inget har körts mot Stripe. Se avsnitt 9 |
| 8. Deploy `faktura-utskick` | ACTIVE, version 2 — betalningsvillkor 10 dagar |

Databasen är tom på fakturor: `invoices`, `invoice_lines` och `payouts` har noll
rader. Den första skarpa körningen har alltså inte skett, och torrkörningen i
steg 5 är fortfarande det första som ska göras.

**Obs (17 september 2026):** alla pass i driften hör än så länge till adminkontot
och till en enda studiehjälpare — det är provpass, inga riktiga kunder. Fyra av de
fem genomförda passen skapades samtidigt den 2 september. Ta ställning till dem
under Ekonomi → Avvikelser innan en skarp körning, annars fakturerar ni er själva.

## Vilka pass som kommer med (sedan Fas 2)

Ett pass kommer med om det är **genomfört, har en rapport kopplad och inte är
undantaget**. Urvalet läses ur vyn `passunderlag`, som adminvyn också läser.

- **Genomfört utan rapport** kommer inte med. Det räknas upp i svaret och syns
  under Ekonomi → **Avvikelser**, där admin antingen kopplar rätt rapport eller
  undantar passet.
- **Undantaget** (`bookings.fakturerbar = false`, med en anledning) kommer varken
  på familjens faktura eller på studiehjälparens underlag. Samma regel på båda
  sidor.
- **Perioden** är en månad, som standard föregående. Med kommer alla ännu inte
  fakturerade pass *till och med* periodens sista dag — ett pass som rapporterades
  för sent till förra körningen kommer med på nästa.
- Rapporten och "genomfört" skrivs sedan Fas 2 i samma transaktion, så ett pass
  kan inte längre bli genomfört utan att rapporten sparas, eller tvärtom.

---

## Så fungerar modellen

Familjen betalar **i efterskott**, en gång i månaden, för de pass som faktiskt
genomförts. Studiehjälparen får ett underlag för samma pass.

Ett pass blir "genomfört" när studiehjälparen skrivit rapporten. Den regeln fanns
redan i systemet, och det är därför det här går att lita på: ett pass som ställdes
in eller flyttades blir aldrig genomfört, och kan alltså aldrig faktureras.

Alla belopp lagras i **ören som heltal**. Aldrig kronor som decimaltal — i flyttal
är `0.1 + 0.2` inte `0.3`, och en faktura som är en krona fel är en faktura någon
måste reda ut för hand.

---

## 1. Kör schemat

Öppna Supabase → SQL Editor, klistra in hela `supabase/migrations/arkiv/schema-v8.sql` och kör.

Den skapar `invoices`, `invoice_lines`, `payouts`, `payout_lines`, `prissattning`
och två vyer. Den rensar ingenting.

**Den täpper också till ett hål:** `hourly_rate` på `tutor_profiles` var oskyddad,
så en godkänd studiehjälpare kunde sätta sin egen timpenning via API:t. Ingen vy
visade det, men RLS är radbaserad och UPDATE var tillåtet. Så länge siffran bara
visades i en ruta var det en skönhetsfläck. Med utbetalningar är det pengar.

## 2. Sätt priset

Priset ligger i `nextrum-config.js` för sidorna som *visar* det, men en faktura får
inte räknas ut från något som ligger i webbläsaren — vem som helst kan ändra det
där. Fakturan läser från tabellen i stället:

```sql
update public.prissattning set pris_per_timme_ore = 37900;
```

`37900` är 379 kr. Ören, alltid.

## 3. Sätt timpenningarna

Ersättningen kan inte räknas ut utan den, och faktureringen hoppar med flit över
studiehjälpare som saknar timpenning i stället för att gissa:

```sql
update public.tutor_profiles set hourly_rate = 250 where id = 'STUDIEHJÄLPARENS-ID';
```

---

## 4. Driftsätt faktureringen

Samma verktyg som `generate-feedback` — se `DEPLOY-AI-FUNKTION.md` om du inte har
Supabase CLI installerat och länkat än.

Sätt nyckeln som skyddar funktionen. Hitta på en lång slumpsträng:

```
supabase secrets set FAKTURERING_NYCKEL=en-lang-slumpstrang-du-hittar-pa
```

Funktionen anropas av ett schema, inte av en inloggad användare, så den ska inte
kräva JWT — men då måste den skyddas av nyckeln i stället. Lägg i
`supabase/config.toml`:

```toml
[functions.fakturering]
verify_jwt = false
```

Driftsätt:

```
supabase functions deploy fakturering
```

## 5. Torrkör — gör inte detta senare

**Enklast: adminvyn.** Ekonomi → Månadskörning → välj månad → **Torrkör**. Du ser
varje familj och studiehjälpare med belopp, och vilka pass som hoppades över.
Stämmer det: **Skapa utkast**. Fakturorna skapas som utkast och skickas sedan en
och en under Fakturor, efter att du läst dem. Knapparna kräver att du är inloggad
som admin — ingen nyckel behövs.

Med nyckeln, till exempel från ett schema, ser anropet ut så här. Kör den
**innan** den första skarpa körningen. Den räknar ut allt och svarar med vad som
skulle skapas, utan att skriva en enda rad:

```
curl -X POST "https://DITT-PROJEKT-ID.supabase.co/functions/v1/fakturering" \
  -H "x-fakturering-nyckel: DIN-NYCKEL" \
  -H "content-type: application/json" \
  -d '{"torrkorning": true}'
```

Läs svaret. Stämmer antalet pass? Stämmer beloppen mot vad ni faktiskt kommit
överens om med familjerna? Står det något i `hoppade_over_utan_timpenning` — då
saknar de studiehjälparna en timpenning, gå tillbaka till steg 3. Står det något
i `hoppade_over_utan_rapport` — se Ekonomi → Avvikelser.

Vill du fakturera en annan månad än förra: lägg till `"period": "2026-09"`.

När det ser rätt ut, kör skarpt genom att ta bort `torrkorning`:

```
curl -X POST "https://DITT-PROJEKT-ID.supabase.co/functions/v1/fakturering" \
  -H "x-fakturering-nyckel: DIN-NYCKEL" \
  -H "content-type: application/json" -d '{}'
```

Fakturorna dyker upp i familjens vy under **Betalning**, och underlagen hos
studiehjälparen under **Ersättning**.

En omkörning skapar inte dubbletter: ett pass kan bara ligga på en fakturarad,
garanterat av ett unikt index i databasen, och en familj kan bara ha en faktura
per månad.

## 6. Schemalägg

När ni kört skarpt en gång för hand och det såg rätt ut — Supabase → Database →
Cron, den första i varje månad. Gör det till ett aktivt beslut, inte något som
råkar vara påslaget. (Planeras i Fas 7.)

## 6b. Utbetala

Utbetalningen görs utanför plattformen. I adminvyn: granska underlaget, sätt
**Godkänd**, gör överföringen, sätt **Utbetald**. Utbetald går inte att sätta
utan att underlaget först är godkänt, och vyn frågar innan.

**Före den första utbetalningen till en studiehjälpare under arton:** stäm av
skatte- och anställningsfrågan med er redovisningskonsult (`foretagsfakta`,
`studiehjalpare_form`). Det är inte en kodfråga, men den avgör hur pengarna får
betalas ut.

---

## 7. Stripe — när ni är redo

Allt ovanför fungerar utan Stripe. Det som saknas är att ta emot pengarna.

**Läs [SKISS-BETALNING-STRIPE.md](SKISS-BETALNING-STRIPE.md) först.** Den skiljer
på de två sidorna: kundsidan (punkt 1–3 nedan) går att bygga när som helst,
hjälparsidan (punkt 4) är blockerad av anställningsfrågan i `foretagsfakta`. Den
säger också varför det är Stripe Invoicing och inte Checkout som gäller här.

**Den hemliga nyckeln får aldrig ligga i `nextrum-config.js`, i HTML, eller i
någon fil som webbläsaren hämtar.** Den ska bo som en secret i Supabase:

```
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
```

Nextrum kommer aldrig att lagra ett kortnummer. Stripe är värd för betalsidan, och
vi sparar bara id:t och adressen dit — kolumnerna `stripe_invoice_id` och
`stripe_url` finns redan. Det är skillnaden mellan att hantera kortdata och att
slippa hantera kortdata, och den skillnaden är värd att hålla fast vid.

Vad som återstår, i ordning:

1. **En Stripe-kund per familj.** Skapas första gången en faktura skickas.
2. **En Stripe Invoice per faktura**, med samma rader som `invoice_lines`. Spara
   `stripe_invoice_id` och `hosted_invoice_url` i `stripe_url`. Knappen "Betala" i
   familjens vy pekar redan dit — den behöver ingen ändring.
3. **En webhook** som lyssnar på `invoice.paid` och sätter `status = 'betald'` och
   `betald_at`. Den **måste** verifiera Stripes signatur; en webhook utan
   signaturkontroll är en adress där vem som helst kan påstå att en faktura är
   betald.
4. **Stripe Connect för utbetalningar. Bygg inte tillbaka det här.** Det byggdes
   en gång (Fas 12.1–12.4) och togs bort igen (Fas 12.5): studiehjälparen får
   betalt den 25:e som en löning, och en Connect-transfer är inte en
   löneutbetalning. Så länge `foretagsfakta.studiehjalpare_form` står på `oklart`
   vet dessutom ingen om ersättningen är lön eller ett uppdragsarvode, och det är
   den frågan som avgör vad utbetalningen ens ÄR — inte vilken teknik som flyttar
   pengarna. Knappen under Ersättning och funktionen `stripe-konto` är borta.
   Kolumnerna `stripe_account_id`, `stripe_klar` och `stripe_*` på
   `tutor_profiles` står kvar men är märkta OANVÄND i databasen
   (`20260922205035_fas12_5_connect_ur_betalvagen.sql`). Skissen och dess
   efterskrift har resonemanget.

Platsen där punkt 1–2 ska in är utmärkt med en kommentar i
`supabase/functions/fakturering/index.ts`, längst ned.

---

## 8. Driftsätt fakturautskicket

Månadskörningen SKAPAR fakturor. Den skickar dem inte. Utskicket ligger i en egen
funktion, `faktura-utskick`, som knappen **Skicka** i adminvyn anropar.

```
supabase functions deploy faktura-utskick
```

Den behöver ingen ny secret: `RESEND_API_KEY` sattes redan för `lead-notis`
(se `DEPLOY-EPOST.md`), och `SUPABASE_URL`, `SUPABASE_ANON_KEY` och
`SUPABASE_SERVICE_ROLE_KEY` finns automatiskt i varje funktion.

**Låt `verify_jwt` vara på.** Funktionen anropas av en inloggad admin, inte av ett
schema. Att det är på räcker dock inte som skydd — varje inloggad familj har också
en giltig token — så funktionen kontrollerar `is_admin` med anroparens EGEN token
innan den rör `service_role`. Ordningen står kommenterad i filen.

### Vad knappen faktiskt gör

1. Torrkörning först. Adminvyn visar exakt vad familjen kommer att läsa, och
   ingenting har skickats än.
2. Trycker du *Skicka nu* går mejlet via Resend.
3. **Först därefter** sätts `status = 'skickad'` och `skickad_at`. Går mejlet fel
   står fakturan kvar som utkast och går att försöka igen.

Den ordningen är hela poängen. Ett läge som säger "skickad" om ett mejl som aldrig
gick är värre än ingen knapp: det får någon att sluta undra var fakturan tog vägen,
och felet upptäcks först när betalningen uteblir.

**Ingen reservavsändare här.** `lead-notis` faller tillbaka på
`onboarding@resend.dev` när nextrum.se inte är verifierad — rätt där, för det
mejlet går till oss ändå. Reserven når bara Resend-kontots egen adress, alltså
aldrig familjen. Att markera en faktura som skickad när den landade hos oss själva
vore att skriva in en osanning i databasen och sedan fakturera på den. Är domänen
inte verifierad får ni ett fel och fakturan står kvar som utkast.

### Förfallodagen

Räknas från när fakturan **skickas**, inte från när körningen skapade den. Villkoret
lovar familjen tio dagar; skapas fakturan den 1:a och skickas den 5:e vore det sex.
En påminnelse flyttar aldrig fram datumet.

### Ändra betalningsvillkoret

Antalet dagar står på **fjorton ställen**: konstanten `BETALNINGSVILLKOR_DAGAR` i
`supabase/functions/_delad/konstanter.ts` (som både `fakturering` och
`faktura-utskick` importerar — driftsätt båda efter en ändring), den synliga texten i FAQ:n, på prissidan och i
användarvillkoren på båda språken, FAQ-schemat, raden i adminvyn och maskotens
svarsfil. Alla måste säga samma sak. En faktura som förfaller på en annan dag än
prissidan lovar är en tvist, inte ett skrivfel — och den diskussionen tas mitt i en
betalningspåminnelse, vilket är sämsta tänkbara läge.

Efter en ändring:

```bash
python3 verktyg/bygg-faq-schema.py        # FAQ-schemat ur den synliga texten
python3 verktyg/bygg-maskotsvar.py        # maskotens svar ur FAQ:n
python3 verktyg/kolla-betalningsvillkor.py
```

Den sista läser siffran på alla fjorton ställen och säger ifrån om de spretar. Den
säger också ifrån om en mening har formulerats om så att den slutat bevaka ett
ställe — ett sökuttryck som inte hittar något ser annars ut som ett godkännande.

Två saker klarar den inte, och de får ni göra för hand:

- **Texten som skriver ut antalet med bokstäver.** Avsnittet ovan och kommentaren om
  förfallodagen i `faktura-utskick` säger "tio dagar" och räknar dessutom ett exempel
  på siffran. Läs igenom dem.
- **Det som faktiskt körs.** Konstanten i repot är inte konstanten i Supabase förrän
  båda funktionerna har driftsatts om (avsnitt 4 och 8). Fram till dess säger sajten
  en sak och fakturan en annan. Tio dagar är utrullat; nästa ändring måste rullas ut
  på samma sätt.

### Utbetalningarna

Knappen **Skicka underlag** mejlar studiehjälparen vad hen kommer att få, så att hen
hinner säga ifrån innan pengarna går. Den ändrar ingen status — att visa ett underlag
är inte att godkänna det.

**Själva överföringen finns inte.** Det finns ingen betaltjänst kopplad, så ingen
knapp i adminvyn flyttar pengar. `Utbetald` betyder "vi har betalat från banken", och
det måste ni ha gjort innan ni sätter det. Kortbetalningen i avsnitt 9 ändrar inte
det: den gäller familjens håll, och pengarna stannar hos Nextrum tills ni betalar ut
dem den 25:e.

---

## Om något ser fel ut

Fakturan skapas som `utkast` och blir `skickad` först när någon tryckt Skicka i
adminvyn och mejlet gått iväg. Vill ni att körningen ska skapa dem färdigskickade
i stället — utan mejl — ändra `status: 'utkast'` tillbaka i funktionen. Tänk efter
en gång till innan ni gör det: då betyder ordet "skickad" inte längre att någon
fått fakturan.

Behöver ni ta bort en felaktig faktura: ta bort den i Table Editor. Raderna följer
med (`on delete cascade`), och passen blir automatiskt ofakturerade igen och
kommer med i nästa körning.

---

## 9. Kortbetalning per pass (Fas 12)

Familjen betalar med kort när passet är **bekräftat**, och HELA beloppet landar
hos Nextrum. Ingen destination, ingen application fee, inget anslutet konto.

Så var det inte först. Fas 12.1–12.4 byggde säljarens Connect-arkitektur, där
studiehjälparens del gick direkt till hens eget Stripe-konto som en destination
charge. **Fas 12.5 tog bort den**, för hjälparen får betalt den 25:e som en
löning, i en klump, ur `payouts`. En destination charge hade lagt ut hens del vid
varje pass och månadskörningen hade sedan betalat samma timmar en gång till.
`SKISS-BETALNING-STRIPE.md` har efterskriften om hur det landade.

**Ingenting av det här är provat mot Stripe.** Koden är typkontrollerad, och
signaturkontrollen har tretton egna prov, men miljön där den skrevs når inte
`api.stripe.com`. Första körningen i **testläge** är alltså det första riktiga
provet. Gör den innan ni rör en skarp nyckel.

### 9.1 Vad som finns

| Del | Läge |
|---|---|
| Kolumnerna och skyddet (`20260922155740_fas12_1_*.sql`) | **Applicerad** |
| `stripe-konto` | **Borttagen**, ur repot och ur driften (Fas 12.5) |
| `stripe-checkout` | **ACTIVE**, version 3, `verify_jwt = true`. Fas 12.5-koden, utan Connect |
| `stripe-webhook` | **ACTIVE**, version 3, `verify_jwt = false`. Fas 12.5-koden |
| `stripe-aterbetalning` | **ACTIVE**, version 2, `verify_jwt = true`. Bara för admin. Vanlig återbetalning, ingen transfer att backa |
| `STRIPE_SECRET_KEY` | **Inte satt** — funktionerna svarar "STRIPE_SECRET_KEY saknas i miljön" |
| `STRIPE_WEBHOOK_SECRET` | **Inte satt** — webhooken svarar 400 på varje leverans |
| Webhook-endpoint hos Stripe | **Inte skapad** |
| Knappen hos studiehjälparen | Finns: Ersättning → Utbetalningskonto |
| Knappen hos familjen | Finns: på passet, när det är bekräftat |

De driftsatta filerna är lästa tillbaka och jämförda mot repot, rad för
rad, inklusive hela `_delad/pris.ts`. De är identiska. Det är inte en
formalitet: `apply_migration` och `functions deploy` ändrar driften
direkt medan git är ett skilt steg, och de två har glidit isär i det
här projektet förut (CLAUDE.md avsnitt 7).

### 9.2 Nycklarna

**Klistra aldrig in dem i en chatt, i `nextrum-config.js` eller i någon fil
webbläsaren hämtar.** De bor som secrets i Supabase. Den publicerbara nyckeln
(`pk_...`) behövs inte: vi använder Stripes egen betalsida, så ingen Stripe-kod
körs i webbläsaren.

Via dashboarden: **Project Settings → Edge Functions → Secrets**. Eller med CLI:

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

`STRIPE_WEBHOOK_SECRET` kan inte sättas än. Den finns först när webhook-endpointen
är skapad i Stripe, och den behöver funktionens URL. Se 9.4.

### 9.3 Driftsätt

**Redan gjort**, och driften är läst tillbaka och jämförd med repot rad för rad.
Kommandona står kvar för en ny miljö, och för när ni ändrar något i funktionerna:

```
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-aterbetalning
```

**Kör dem från repotroten**, så att `supabase/config.toml` läses. Utan filen får
`stripe-webhook` CLI:ns förval `verify_jwt = true`, och då svarar den 401 på varje
leverans från Stripe. Ingen människa är anropare, så ingen ser det — se filhuvudet
i `config.toml`.

`stripe-checkout` och `stripe-aterbetalning` anropas av en inloggad förälder
respektive admin och ska ha JWT-kravet kvar. De står därför inte i `config.toml`.

`stripe-webhook` har `verify_jwt = false` i `supabase/config.toml`, för att
anroparen är Stripe och inte kan ha en Supabase-token. **Driftsätt aldrig den utan
att filen finns med** — se filhuvudet i `config.toml` för vad som annars händer.
De två andra ska ha JWT-kravet kvar: de anropas av en inloggad person.

### 9.4 Webhooken

Stripe → Developers → Webhooks → Add endpoint.

**Omfång: "Ditt konto", aldrig "Anslutna konton".** Den andra rutan ÄR Connect.
Väljer ni den lyssnar endpointen på konton som inte finns, och ni får noll
leveranser utan att förstå varför.

**API-versionen ska vara `2025-08-27.basil`**, samma som `_delad/stripe.ts` pinnar.
Endpointens version bestämmer formen på det Stripe SKICKAR oss; kodens pin
bestämmer formen på det vi HÄMTAR tillbaka. Två versioner i samma integration är
samma sorts glidning som `@2` på esm.sh var (se filhuvudet i `_delad/auth.ts`).
Dashboarden föreslår kontots förval, som är nyare. Ändra den.

Går inte basil att välja: fälten funktionen läser (`payment_status`,
`client_reference_id`, `payment_intent`, `amount_refunded`, `amount`, `charge`,
`status`) är grundfält som sällan rör sig, men **det är inte kontrollerat mot
referensen** — miljön som skrev det här når inte `docs.stripe.com`. Flytta i så
fall kodens pin i stället, medvetet, och kör provlistan i 9.6 om.

Adressen är:

```
https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/stripe-webhook
```

Händelser som ska väljas, och varför just de:

| Händelse | Vad den gör hos oss |
|---|---|
| `checkout.session.completed` | Sätter passet som betalt. **Enda vägen dit.** |
| `payment_intent.payment_failed` | Familjen kan försöka igen |
| `charge.refunded` | Skriver återbetalt belopp |
| `charge.dispute.created`, `charge.dispute.closed` | Markerar tvist |

**Välj inga fler.** `transfer.*`, `account.updated` och `payout.*` stod här förut
och hörde till Connect. Funktionen har inga grenar för dem sedan Fas 12.5: de
kvitteras som `ohanterad typ`, alltså brus i `stripe_handelser` utan verkan.

Kopiera sedan `whsec_...` och sätt den:

```
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

**Utan den svarar funktionen 400 på varje leverans**, och då blir ingen betalning
registrerad trots att pengarna dragits. Det är det enda felet i hela kedjan som ser
ut som tystnad i stället för som ett fel.

Kontrollera att den gick in, utan att skriva ut den någonstans:

```
curl -s -X POST https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/stripe-webhook \
  -H 'stripe-signature: t=1,v1=00' -d '{}'
```

`{"error":"Leveransen är för gammal."}` betyder att hemligheten ÄR satt — funktionen
kom förbi den kontrollen och föll på tidsstämpeln. `Webhookhemligheten är inte satt.`
betyder att den inte är det. Ett 401 betyder att `verify_jwt` slog på igen, se 9.3.

### 9.5 Kontoutdraget

Sätt Nextrums statement descriptor i Stripe → Settings → Business → Public details.
Koden sätter ett suffix per pass (ämnet), men grunddelen kommer från kontot. Står
det något annat än Nextrum där ringer familjen banken i stället för oss.

Slå också på kvitton: Stripe → Settings → Emails → Successful payments.

### 9.6 Prova hela kedjan, i testläge

I den här ordningen, för varje steg beror på det förra:

1. **Boka ett pass och bekräfta det.** Betala-knappen ska dyka upp först då.
2. **Betala med testkortet** `4242 4242 4242 4242`, valfritt framtida datum.
3. **Kontrollera i databasen** att `betalning_status = 'betald'` och att
   `betalt_ore` stämmer med vad familjen faktiskt betalade.
4. **Prova 3D Secure** med `4000 0027 6000 3184`.
5. **Prova ett nekat kort** med `4000 0000 0000 0002` och se att passet blir
   `misslyckad` och går att betala igen.
6. **Prova en återbetalning**, både hel och delvis, från Ekonomi → Kortbetalningar.
7. **Prova en tvist** med `4000 0000 0000 0259`.

Säljarens lista hade två prov till: **misslyckad transfer** och **misslyckad
utbetalning**. Båda gällde anslutna konton och finns inte att prova sedan Fas 12.5.

### 9.7 Det som inte är löst av att koden finns

- **Anställningsfrågan.** `foretagsfakta.studiehjalpare_form` står på `oklart` och
  bolaget är inte arbetsgivarregistrerat. Ordet "löning" lutar åt anställning, och
  i så fall är `payouts` ett underlag till en löneköring, inte en betalning. Ingen
  utbetalning får ske innan det är utrett.
- **Moms.** Ni är inte momsregistrerade. Passerar ni omsättningsgränsen ändras vad
  379 kr betyder, och då ändras beloppet som går till Stripe.
- **`fakturering` är kvar och rör ingenting av det här.** Ett pass som betalats med
  kort kommer fortfarande med i månadskörningen, eftersom urvalet i `passunderlag`
  inte vet om betalningen. **Kör inte båda vägarna skarpt samtidigt** — då
  faktureras familjen två gånger. Antingen stängs månadskörningen av, eller så
  byggs urvalet om till att hoppa över pass med `betalning_status = 'betald'`.

### 9.8 Säljarens MVP-checklista, punkt för punkt

Rekommendationen kom från en säljare på Stripe. Den står här ordagrant med sitt
läge, för att den annars bara finns i en chatt — och det är precis så
notissystemet en gång hamnade utanför repot (CLAUDE.md avsnitt 7).

**Fem av tolv punkter utgår**, alla av samma skäl: de förutsätter att
studiehjälparen är mottagare hos Stripe. Det är hen inte. Hen får löning den 25:e.

| # | Punkten | Läge |
|---|---|---|
| 1 | Skapa svenskt Stripe-konto och aktivera Connect | Kontot finns. **Connect utgår** |
| 2 | Bestäm SKRIFTLIGT att Nextrum äger kundrelationen för betalningen | **Klar.** `anvandarvillkor.html` och `en/anvandarvillkor.html` |
| 3 | Accounts v2 recipient-konton med Express Dashboard | **Utgår.** Byggt i 12.1, borttaget i 12.5 |
| 4 | Stripe-hostad onboarding av studiehjälpare | **Utgår.** Samma |
| 5 | Blockera betalning tills kontot kan ta emot överföringar | **Utgår.** Var `stripe_kan_ta_emot`, kolumnen står kvar märkt OANVÄND |
| 6 | Checkout i SEK, kort som första betalningsmetod | **Klar i kod**, aldrig körd mot Stripe |
| 7 | Destination charges och `application_fee_amount` | **Utgår.** Borttaget i 12.5 |
| 8 | Byt till separate charges and transfers om ersättningen frisläpps efter lektionen | **Besvarad med ett tredje svar.** Se nedan |
| 9 | Verifierade webhooks, återbetalning med transfer reversal, process för korttvister | **Delvis.** Se nedan |
| 10 | Statement descriptor och kvitton | **Delvis.** Koden sätter suffixet, grunddelen och kvittona sätts i Stripe. Se 9.5 |
| 11 | Prova hela kedjan i testläge | **Inte gjord.** Se 9.6 |
| 12 | Svensk juridik- och skattegenomgång, särskilt minderåriga | **Inte gjord**, och viktigare nu än förut. Se nedan |

**Punkt 8 var säljarens egen slutfråga**, och han satte den rätt: den avgjorde
allt annat. Men svaret var varken "direkt" eller "efter genomförd lektion". Det
var **den 25:e, som en löning**, och då ska Stripe inte vara med i den delen alls.
Varken destination charges eller separate charges and transfers. `payouts` och
månadskörningen gör jobbet, och `fakturering` räknar ersättningen ur rapporten.

**Punkt 9 är tre saker, och bara två av dem är kod.**
Webhooken är klar: signaturen prövas i konstant tid på den råa kroppen, och
`stripe_handelser` är taket mot dubbletter. Återbetalningen är klar, men UTAN
`reverse_transfer` och `refund_application_fee` — det finns ingen transfer att
backa, och Stripe hade avvisat flaggorna som meningslösa. Koden markerar en tvist
som `tvist` på passet. **Processen runt tvisten finns inte:** att samla
bokningsbekräftelse och närvaro, svara inom tidsfristen, och ha en reserv. Det är
människoarbete, inte kod, och ingen har gjort det.

**Punkt 12 blev inte enklare av att Connect försvann, bara annorlunda.**
Säljaren varnade för minderåriga studiehjälpare: Stripes svenska avtal kräver en
vuxen representant för den som är 13–17. Den varningen gäller inte längre, för
ingen studiehjälpare har ett Stripe-konto. **Men det juridiska problemet blev
större, inte mindre.** Är ersättningen en löning är det arbetsrätt och
arbetsgivaravgifter för minderåriga, och bolaget är inte arbetsgivarregistrerat.
Det är svårare än en onboardingblankett var.

Däremot försvann sannolikt DAC7-frågan säljaren tog upp: plattformsrapportering
gäller plattformar som förmedlar säljares inkomst, och betalar ni lön är det
arbetsgivardeklaration i stället. **Det är juristens bedömning, inte vår** — den
står här bara för att frågan inte ska utredas från noll en gång till.
