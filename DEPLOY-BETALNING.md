# Sätta upp betalning

**Sedan Fas 14.2 betalar familjen varje pass med kort, före passet, och får ingen
faktura.** Pengarna tas emot genom Stripe (avsnitt 9). Studiehjälparen får betalt
den 25:e ur `payouts`, och det är vad månadskörningen gör nu: den skapar underlag,
inga fakturor.

Filen står därför i tre delar:

- **Avsnitt 1–6** är månadskörningen och underlagen till studiehjälparna. De
  fungerar utan Stripe.
- **Avsnitt 7 och 8** är historik: planen att skicka månadsfakturan genom Stripe,
  och utskicket av de fakturor som skapades före Fas 14.2. Det fanns inga.
- **Avsnitt 9** är kortbetalningen, familjens enda väg att betala, och spärren
  "ingen betalning, inget pass".

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
| 4. Deploy `fakturering` | ACTIVE, version 26. Sedan Fas 14.2 skapar den bara underlag, och räknar upp pass som hölls utan att betalas |
| 5. Torrkörning | **Väntar på er** — knappen under Ekonomi → Månadskörning, ingen nyckel behövs |
| 6. Schemaläggning | **Väntar på er** |
| 7. Stripe | **Delvis.** Funktionerna driftsatta, webhooken skapad och dess hemlighet provad. Ingen betalning har gått igenom. Se avsnitt 9 |
| 8. Deploy `faktura-utskick` | ACTIVE. Bara för fakturor som skapades före Fas 14.2, och sådana finns inte |

Databasen är tom på fakturor och underlag: `invoices`, `invoice_lines`, `payouts`
och `payout_lines` har noll rader (24 september 2026). Den första skarpa körningen
har alltså inte skett, och torrkörningen i steg 5 är fortfarande det första som ska
göras.

**Obs (17 september 2026):** alla pass i driften hör än så länge till adminkontot
och till en enda studiehjälpare — det är provpass, inga riktiga kunder. Fyra av de
fem genomförda passen skapades samtidigt den 2 september, och sedan Fas 14.2 står
de under Betalningar & utbetalningar → Avvikelser som **Inte betalt**. Ta ställning
till dem innan en skarp körning: undanta dem, annars betalar ni ut ersättning för
provpass.

## Vilka pass som kommer med på underlaget

Ett pass kommer med om det är **genomfört, har en rapport kopplad och inte är
undantaget**. Urvalet läses ur vyn `passunderlag`, som adminvyn också läser.

- **Genomfört utan rapport** kommer inte med. Det räknas upp i svaret och syns
  under Betalningar & utbetalningar → **Avvikelser**, där admin antingen kopplar
  rätt rapport eller undantar passet.
- **Undantaget** (`bookings.fakturerbar = false`, med en anledning) ska varken
  betalas av familjen (Betala-knappen syns inte) eller komma med på
  studiehjälparens underlag. Samma regel på båda sidor.
- **Familjens betalning avgör inte om passet kommer med.** Studiehjälparen har
  hållit passet oavsett. Ett pass som hölls utan att betalas kommer med på
  underlaget, räknas upp i körningens svar under `obetalda`, och syns som
  avvikelsen `ej_betalt` tills familjen betalat.
- **Perioden** är en månad, som standard föregående. Med kommer alla pass som ännu
  inte ligger på ett underlag, *till och med* periodens sista dag — ett pass som
  rapporterades för sent till förra körningen kommer med på nästa.
- Rapporten och "genomfört" skrivs sedan Fas 2 i samma transaktion, så ett pass
  kan inte längre bli genomfört utan att rapporten sparas, eller tvärtom.

---

## Så fungerar modellen

Familjen betalar **varje pass med kort, före passet** (avsnitt 9). Studiehjälparen
får ett underlag en gång i månaden för de pass som faktiskt genomförts, och betalt
den 25:e.

Ett pass blir "genomfört" när studiehjälparen skrivit rapporten. Den regeln fanns
redan i systemet, och det är därför det här går att lita på: ett pass som ställdes
in eller flyttades blir aldrig genomfört, och kommer alltså aldrig med på ett
underlag.

Alla belopp lagras i **ören som heltal**. Aldrig kronor som decimaltal — i flyttal
är `0.1 + 0.2` inte `0.3`, och ett belopp som är en krona fel är ett belopp någon
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

Priset ligger i `nextrum-config.js` för sidorna som *visar* det, men ett belopp får
inte räknas ut från något som ligger i webbläsaren — vem som helst kan ändra det
där. Kortbetalningen läser tjänstens pris ur databasen i stället. Sätt det i
adminvyn under Tjänster & priser, eller för en ny miljö:

```sql
update public.tjanster set pris_per_timme_ore = 37900 where kod = 'laxhjalp';
```

En trigger speglar läxhjälpens pris till `prissattning`, som kortbetalningen läser
som reserv. `37900` är 379 kr. Ören, alltid.

## 3. Sätt timpenningarna

Ersättningen kan inte räknas ut utan den, och månadskörningen hoppar med flit över
studiehjälpare som saknar timpenning i stället för att gissa:

```sql
update public.tutor_profiles set hourly_rate = 250 where id = 'STUDIEHJÄLPARENS-ID';
```

---

## 4. Driftsätt månadskörningen (`fakturering`)

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

**Enklast: adminvyn.** Betalningar & utbetalningar → Månadskörning → välj månad →
**Torrkör**. Du ser varje studiehjälpares underlag med belopp, vilka pass som
hoppades över, och vilka pass som hölls utan att familjen betalat. Stämmer det:
**Skapa utkast**. Underlagen skapas som utkast; ingenting skickas och inga pengar
rör sig. Knapparna kräver att du är inloggad som admin — ingen nyckel behövs.

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
överens om med studiehjälparna? Står det något i `hoppade_over_utan_timpenning` —
då saknar de studiehjälparna en timpenning, gå tillbaka till steg 3. Står det något
i `hoppade_over_utan_rapport` — se Avvikelser. Står det något i `obetalda` hölls de
passen utan att familjen betalat: Betala-knappen ligger kvar på passet i familjens
vy, och det är familjen ni ska prata med, inte körningen.

Vill du köra en annan månad än förra: lägg till `"period": "2026-09"`.

När det ser rätt ut, kör skarpt genom att ta bort `torrkorning`:

```
curl -X POST "https://DITT-PROJEKT-ID.supabase.co/functions/v1/fakturering" \
  -H "x-fakturering-nyckel: DIN-NYCKEL" \
  -H "content-type: application/json" -d '{}'
```

Underlagen dyker upp hos studiehjälparen under **Ersättning**. Familjen ser
ingenting nytt: deras betalningar är kortbetalningarna i avsnitt 9.

En omkörning skapar inte dubbletter: ett pass kan bara ligga på en underlagsrad
(`payout_lines_ett_pass_en_gang`), och en studiehjälpare kan bara ha ett underlag
per månad (`unique (tutor_id, period)`).

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

## 7. Stripe och månadsfakturan (historik)

Här stod planen att skicka månadsfakturan genom Stripe Invoicing: en Stripe-kund
per familj, en Stripe Invoice per faktura och en webhook på `invoice.paid`. **Den
planen är övergiven.** Sedan Fas 14.2 finns ingen månadsfaktura att skicka, och
familjen betalar varje pass genom Stripe Checkout i stället. Allt om Stripe står i
avsnitt 9.

Två saker från planen gäller fortfarande:

**Den hemliga nyckeln får aldrig ligga i `nextrum-config.js`, i HTML, eller i
någon fil som webbläsaren hämtar.** Den bor som en secret i Supabase (9.2), och
Nextrum lagrar aldrig ett kortnummer: Stripe är värd för betalsidan.

**Stripe Connect för utbetalningar. Bygg inte tillbaka det här.** Det byggdes
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

---

## 8. Fakturautskicket (bara äldre fakturor)

**Sedan Fas 14.2 skapar månadskörningen inga fakturor**, och det fanns noll när
omställningen gjordes. `faktura-utskick` står kvar för en faktura som ändå skulle
finnas, och avsnittet står kvar för att förklara den. Om den ska tas bort är ert
beslut (CLAUDE.md avsnitt 7).

Utskicket ligger i en egen funktion, `faktura-utskick`, som knappen **Skicka**
under Äldre fakturor anropar.

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

### Ändra betalningslöftet

Sedan Fas 14.2 är löftet inte ett antal dagar. Det är en mening: familjen betalar
varje pass med kort, före passet, och **ett pass som inte är betalt hålls inte**.
Meningen står på femton ställen i nio filer: användarvillkoren, prissidan och FAQ:n
på båda språken, FAQ-schemat, studievyns Betalning och Pris & villkor, notisen om
pass att betala i `nextrum-studie-vy.js`, och maskotens svarsfil. Alla måste säga
samma sak. En betalning som tas på ett annat sätt än villkoren lovar är en tvist,
inte ett skrivfel.

Efter en ändring:

```bash
python3 verktyg/bygg-faq-schema.py        # FAQ-schemat ur den synliga texten
python3 verktyg/bygg-maskotsvar.py        # maskotens svar ur FAQ:n och prissidan
python3 verktyg/kolla-betalningsvillkor.py
```

Den sista räknar meningen på alla femton ställen, och letar efter det gamla löftet
("efterskott", "10 dagars betalningsvillkor", "första faktura" och de engelska
motsvarigheterna) i allt som serveras. Den säger ifrån om en mening formulerats om
så att den slutat bevaka ett ställe — ett sökuttryck som inte hittar något ser
annars ut som ett godkännande.

Två saker klarar den inte:

- **Det som faktiskt körs.** Att spärren är på är en flagga i databasen, inte en
  mening på en sida (9.9).
- **`BETALNINGSVILLKOR_DAGAR`** i `_delad/konstanter.ts` finns kvar bara för
  `faktura-utskick` och äldre fakturor. Den lovar ingenting om ett nytt pass.

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

## Om en äldre faktura ser fel ut

Behöver ni ta bort en felaktig faktura: ta bort den i Table Editor. Raderna följer
med (`on delete cascade`). Passen på den räknas då som obetalda igen och syns som
`ej_betalt`; de hamnar inte på en ny faktura, för det skapas inga.

---

## 9. Kortbetalning per pass (Fas 12, enda vägen sedan Fas 14.2)

Familjen betalar med kort när passet är **bekräftat**, och senast innan det
börjar. HELA beloppet landar hos Nextrum. Ingen destination, ingen application
fee, inget anslutet konto. Ett genomfört pass som inte är betalt går också att
betala, från samma knapp.

Så var det inte först. Fas 12.1–12.4 byggde säljarens Connect-arkitektur, där
studiehjälparens del gick direkt till hens eget Stripe-konto som en destination
charge. **Fas 12.5 tog bort den**, för hjälparen får betalt den 25:e som en
löning, i en klump, ur `payouts`. En destination charge hade lagt ut hens del vid
varje pass och månadskörningen hade sedan betalat samma timmar en gång till.
`SKISS-BETALNING-STRIPE.md` har efterskriften om hur det landade.

**Ingen betalning har gått igenom.** Webhooken är skapad och dess hemlighet
provad, men `stripe_handelser` är tom och inget pass har `betald_at` (24 september
2026): Stripe har inte levererat en enda händelse, inte ens en testhändelse. Koden
är typkontrollerad och signaturkontrollen har egna prov, men miljön där den skrevs
når inte `api.stripe.com`. Provbetalningen i 9.6 är alltså det första riktiga
provet. Gör den innan ni rör en skarp nyckel, och innan spärren slås på (9.9).

### 9.1 Vad som finns

| Del | Läge |
|---|---|
| Kolumnerna och skyddet (`20260922155740_fas12_1_*.sql`) | **Applicerad** |
| `stripe-konto` | **Borttagen**, ur repot och ur driften (Fas 12.5) |
| Korttvisterna (`20260924125618_fas14_3_*.sql`) | **Applicerad.** Tabellen `stripe_tvister`, se 9.10 |
| `stripe-checkout` | **ACTIVE**, version 8, `verify_jwt = true`. Fas 14.3: bara kort, kvitto till familjens adress, kontoutdragets tillägg högst tio tecken. Fas 14.4: Managed Payments av, och Stripes nej skrivs till loggen (9.5) |
| `stripe-webhook` | **ACTIVE**, version 6, `verify_jwt = false`. Fas 14.3: tvisterna sparas med sista svarsdag, orsak och utfall |
| `stripe-aterbetalning` | **ACTIVE**, version 4, `verify_jwt = true`. Bara för admin. Vanlig återbetalning, ingen transfer att backa |
| `stripe-lage` | **ACTIVE**, version 1, `verify_jwt = true`. Bara för admin. Frågar Stripe om kontot och endpointen och svarar med en lista. Läser, skriver ingenting |
| `STRIPE_SECRET_KEY` | **Visas i adminvyn** sedan Fas 14.3: Betalningar & utbetalningar → Kortbetalningar → **Kontrollera Stripe** säger om den saknas, är en test- eller skarp nyckel, eller har fel format. Inte ett tecken mer än så |
| `STRIPE_WEBHOOK_SECRET` | **Satt och provad**: en påhittad signatur faller på tidsstämpeln, inte på hemligheten (slutet av 9.4) |
| Webhook-endpoint hos Stripe | **Skapad** i sandlådan. Ingen leverans har kommit fram. **Saknar troligen `charge.dispute.updated`**, som kom till i Fas 14.3 (9.4) |
| Knappen hos familjen | Finns: på passet när det är bekräftat, och på ett genomfört pass som inte är betalt |
| Spärren `kortsparr` | **Av.** Se 9.9 |

De driftsatta filerna är lästa tillbaka och jämförda mot repot. Det är inte en
formalitet: `apply_migration` och `functions deploy` ändrar driften direkt medan
git är ett skilt steg, och de två har glidit isär i det här projektet förut
(CLAUDE.md avsnitt 7).

Skillnaden som stod här förut är borta: `stripe-checkout` bar en kopia av
`_delad/pris.ts` från före Fas 14.2, och version 6 (Fas 14.3) har dagens. Alla
fyra funktionerna, och `notis-ko` version 10 med de nya mejltexterna, är lästa
tillbaka fil för fil och lika med repot.

### 9.2 Nycklarna

**Klistra aldrig in dem i en chatt, i `nextrum-config.js` eller i någon fil
webbläsaren hämtar.** De bor som secrets i Supabase. Den publicerbara nyckeln
(`pk_...`) behövs inte: vi använder Stripes egen betalsida, så ingen Stripe-kod
körs i webbläsaren.

Via dashboarden: **Project Settings → Edge Functions → Secrets**. Eller med CLI:

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

`STRIPE_WEBHOOK_SECRET` är satt. Den skapas av webhook-endpointen i Stripe, och
byts där; se 9.4.

### 9.3 Driftsätt

**Redan gjort**, och driften är läst tillbaka och jämförd med repot rad för rad.
Kommandona står kvar för en ny miljö, och för när ni ändrar något i funktionerna:

```
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-aterbetalning
supabase functions deploy stripe-lage
```

**Kör dem från repotroten**, så att `supabase/config.toml` läses. Utan filen får
`stripe-webhook` CLI:ns förval `verify_jwt = true`, och då svarar den 401 på varje
leverans från Stripe. Ingen människa är anropare, så ingen ser det — se filhuvudet
i `config.toml`.

`stripe-checkout`, `stripe-aterbetalning` och `stripe-lage` anropas av en inloggad
förälder respektive admin och ska ha JWT-kravet kvar. De står därför inte i
`config.toml`.

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
`client_reference_id`, `payment_intent`, `amount_total`, `amount_refunded`,
`amount`, `charge`, `status`) är grundfält som sällan rör sig, men **det är inte
kontrollerat mot referensen** — miljön som skrev det här når inte
`docs.stripe.com`. Flytta i så fall kodens pin i stället, medvetet, och kör
provlistan i 9.6 om.

**Så blev det.** Basil fanns inte att välja när endpointen skapades i september
2026, så den står troligen på kontots förval. Kontrollera versionen på endpointens
sida, och läs raden i `stripe_handelser` efter provbetalningen: `resultat = 'betald'`
och ifyllda `betalt_ore` och `stripe_avgift_ore` på passet betyder att fälten kom
fram som koden väntar sig.

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
| `charge.dispute.created` | Sparar tvisten med sista svarsdag och orsak, och lägger en uppgift (9.10) |
| `charge.dispute.updated` | Stripe flyttar tvisten till `under_review` när underlaget skickats in, och kan ändra dagen. **Ny i Fas 14.3** |
| `charge.dispute.closed` | Utfallet: vunnen blir en betalning igen, förlorad står kvar som tvist |

**`charge.dispute.updated` saknas troligen på endpointen**, för den stod inte
här när endpointen skapades. Lägg till den: endpointens sida → **Update details**
→ Select events. Knappen **Kontrollera Stripe** i adminvyn säger vilka som
saknas, så ni behöver inte gissa.

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

### 9.5 Kontoutdraget och kvittot

Kontoutdragets rad är två delar. **Grunddelen** kommer från kontot: Stripe →
Settings → Business → Public details, "Shortened descriptor". Sätt `NEXTRUM`.
**Tillägget** sätter koden per pass, och det är ämnet: familjen ser ungefär
`NEXTRUM* MATEMATIK`. Hela raden får vara högst 22 tecken, och därför kapar
koden ämnet vid tio (Fas 14.3). Förut kapades det vid 22, och ett långt ämne hade
gjort raden för lång, och då nekar Stripe betalningen.

**Kontrollera Stripe** i adminvyn läser grunddelen och säger om det står Nextrum.
Står det något annat ringer familjen banken i stället för oss.

**Kvittot skickas av koden** sedan Fas 14.3: `receipt_email` sätts till familjens
adress, och med den satt skickar Stripe kvittot i skarpt läge oavsett
inställningen under Settings → Emails. I testläge skickar Stripe inga kvitton
alls, så det går inte att se förrän första riktiga betalningen. Kvittots utseende
(logga, färg, kontaktadress) sätts under Settings → Branding.

**Managed Payments ska vara av, och koden slår av det för varje betalning**
(Fas 14.4). Kontot hade det påslaget som förval. Då är Stripe säljaren gentemot
familjen i stället för Nextrum, Stripe sköter tvisterna, och det kostar en egen
avgift ovanpå kortavgiften. Det är byggt för digitala produkter, och det motsäger
villkoren. Förvalet fick dessutom Stripe att neka `receipt_email`, så kassan gick
inte att öppna alls: varje försök att betala den 24 och 25 september svarade 502.
`stripe-checkout` skickar nu `managed_payments[enabled]=false`, så ett förval i
dashboarden kan inte byta säljare. Slå ändå av förvalet under Settings → Managed
Payments, i både test- och skarpt läge, så att dashboarden och koden säger samma
sak.

**Ett nej från Stripe står i loggen.** Förut gick Stripes förklaring bara till
familjens ruta i webbläsaren, och loggen sa "502". Nu skriver `stripe-checkout`
Stripes typ, kod och text till funktionens logg, med passets id. Leta efter
`stripe-checkout: Stripe nekade` under Edge Functions → stripe-checkout → Logs.

### 9.6 Prova hela kedjan, i testläge

I den här ordningen, för varje steg beror på det förra:

Tryck först på **Kontrollera Stripe** under Betalningar & utbetalningar →
Kortbetalningar. Varje röd rad där är ett skäl till att stegen nedan inte kommer
att fungera, och det är billigare att se det där än att leta efter det i
`stripe_handelser`.

0. **Skicka en testhändelse** från endpointens sida i Stripe
   (`checkout.session.completed`). Den ska landa i `stripe_handelser` med
   `resultat = 'session utan pass-id'`, och det är rätt: Stripes exempel har inget
   av våra pass. Det bevisar signaturen och dubblettspärren utan att en krona rör sig.
1. **Boka ett pass och bekräfta det.** Betala-knappen ska dyka upp först då.
2. **Betala med testkortet** `4242 4242 4242 4242`, valfritt framtida datum.
3. **Kontrollera i databasen** att `betalning_status = 'betald'`, att
   `betalt_ore` stämmer med vad familjen faktiskt betalade, och att
   `stripe_avgift_ore`, `stripe_netto_ore` och `stripe_balanstransaktion_id` är
   ifyllda. De tre sista går inte att hämta i efterhand.
4. **Prova 3D Secure** med `4000 0027 6000 3184`.
5. **Prova ett nekat kort** med `4000 0000 0000 0002` och se att passet blir
   `misslyckad` och går att betala igen.
6. **Prova en återbetalning**, både hel och delvis, från Betalningar &
   utbetalningar → Kortbetalningar.
7. **Prova en tvist** med `4000 0000 0000 0259`. Den ska landa i
   `stripe_tvister` med `lage = 'needs_response'` och en `svara_senast`, och en
   uppgift "Svara på korttvisten senast …" ska dyka upp under Uppgifter. Svara
   sedan med underlaget `winning_evidence` i Stripes dashboard: tvisten ska stängas
   som vunnen och passet bli `betald` igen.
8. **Prova ett avbokat pass.** Öppna betalsidan, avboka passet i en annan flik och
   betala sedan. Passet ska bli `betald` och dyka upp under Avvikelser som
   **Betalt men avbokat** tills det återbetalats.

Säljarens lista hade två prov till: **misslyckad transfer** och **misslyckad
utbetalning**. Båda gällde anslutna konton och finns inte att prova sedan Fas 12.5.

### 9.7 Det som inte är löst av att koden finns

- **Anställningsfrågan.** `foretagsfakta.studiehjalpare_form` står på `oklart` och
  bolaget är inte arbetsgivarregistrerat. Ordet "löning" lutar åt anställning, och
  i så fall är `payouts` ett underlag till en löneköring, inte en betalning. Ingen
  utbetalning får ske innan det är utrett.
- **Moms.** Ni är inte momsregistrerade. Passerar ni omsättningsgränsen ändras vad
  379 kr betyder, och då ändras beloppet som går till Stripe.
- **Dubbelfaktureringen är borta (Fas 14.2).** Månadskörningen skapar ingen faktura
  till familjen, så ett kortbetalt pass kan inte faktureras en gång till.
- **Startererbjudandet finns inte i koden.** Prissidan lovar "Första timmen på köpet
  … dras av när ni betalar", och `stripe-checkout` drar inte av något. Bestäm
  regeln innan en ny familj betalar sitt första pass. Tills den är byggd går det att
  sätta `rabatt_ore` på passet för hand innan familjen betalar: admin går förbi
  skyddet, och checkout räknar med rabatten.
- **Priset räknas när familjen betalar**, men villkoren lovar priset vid
  bokningen. Höj inte priset medan bokade pass väntar på betalning; prisdialogen i
  adminvyn räknar dem.
- **Mejlen säger det nu (Fas 14.3).** Bokningsbekräftelsen och påminnelsen till
  familjen säger att passet betalas med kort senast innan det börjar, och att ett
  pass som inte är betalt inte hålls. Mallen vet inte om just det passet redan är
  betalt, så meningen är villkorad: "om ni inte redan har gjort det".

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
| 6 | Checkout i SEK, kort som första betalningsmetod | **Klar i kod** (Fas 14.3): bara kort, inte "först". Aldrig körd mot Stripe. Se nedan |
| 7 | Destination charges och `application_fee_amount` | **Utgår.** Borttaget i 12.5 |
| 8 | Byt till separate charges and transfers om ersättningen frisläpps efter lektionen | **Besvarad med ett tredje svar.** Se nedan |
| 9 | Verifierade webhooks, återbetalning med transfer reversal, process för korttvister | **Klar i kod** (Fas 14.3). Tvisten har en sista dag, en uppgift och en process (9.10). Att svara är människoarbete |
| 10 | Statement descriptor och kvitton | **Klar i kod** (Fas 14.3). Tillägget och kvittot sätts per betalning; grunddelen `NEXTRUM` sätts i Stripe, och adminvyn kontrollerar den. Se 9.5 |
| 11 | Prova hela kedjan i testläge | **Inte gjord**, men förberedd: **Kontrollera Stripe** säger vad som saknas innan ni börjar. Se 9.6 |
| 12 | Svensk juridik- och skattegenomgång, särskilt minderåriga | **Inte gjord**, och viktigare nu än förut. Se nedan |

**Punkt 8 var säljarens egen slutfråga**, och han satte den rätt: den avgjorde
allt annat. Men svaret var varken "direkt" eller "efter genomförd lektion". Det
var **den 25:e, som en löning**, och då ska Stripe inte vara med i den delen alls.
Varken destination charges eller separate charges and transfers. `payouts` och
månadskörningen gör jobbet, och `fakturering` räknar ersättningen ur rapporten.

**Punkt 6 säger "kort som första betalningsmetod". Koden tar bara kort**, och
det är med flit. Utan `payment_method_types` väljer Stripe betalsätt ur
dashboardens inställningar, och slår någon på Klarna eller Swish där erbjuds de
familjen. Båda kan bli klara först i efterhand: sessionen fullbordas som obetald
och pengarna kommer med `checkout.session.async_payment_succeeded`, en händelse
webhooken inte hanterar. Familjen hade betalat och passet stått som obetalt för
alltid. Apple Pay och Google Pay är kort i en plånbok och följer med. Vill ni
lägga till Swish senare är det en ny gren i webhooken och en ny händelse på
endpointen, inte en kryssruta.

**Punkt 9 är tre saker.** Webhooken är klar: signaturen prövas i konstant tid på
den råa kroppen, och `stripe_handelser` är taket mot dubbletter. Återbetalningen
är klar, men UTAN `reverse_transfer` och `refund_application_fee` — det finns
ingen transfer att backa, och Stripe hade avvisat flaggorna som meningslösa.
**Tvisterna har en process sedan Fas 14.3**, beskriven i 9.10: sista dagen att
svara sparas, en uppgift med dagen som förfallodag skapas, och adminvyn visar
varje öppen tvist med dagar kvar och vad som ska samlas. Att faktiskt skicka in
underlaget är fortfarande en människas jobb, i Stripes dashboard.

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

### 9.9 Spärren: "ingen betalning, inget pass"

Villkoren säger att ett pass som inte är betalt inte hålls. Spärren är det som gör
det sant i systemet, och **den är av** tills kortvägen bevisligen fungerar.
Påslagen utan en fungerande betalning hade den låst varje studiehjälpare från att
rapportera ett enda pass.

Den är flaggan `kortsparr` i `flaggor`, och slås om under Betalningar &
utbetalningar → Kortbetalningar. Knappen visar vad som händer innan den gör något.

- **På:** en rapport på ett pass som inte är betalt nekas, med ett meddelande som
  säger varför. Studiehjälparen ser betalläget på passet och rapportknappen är
  stängd. `betald` och `tvist` räknas som betalt; ett undantaget pass stoppas
  aldrig; admin går alltid förbi. Familjen kan då också betala ett bekräftat pass
  vars tid har gått: hölls det ändå är betalningen det enda som låser upp
  rapporten, och utan knappen hade passet fastnat mellan två vyer som väntar på
  varandra. Hölls det inte avbokar studiehjälparen det.
- **Av:** passen rapporteras som förut, och ett pass som hölls utan betalning syns
  under Avvikelser som **Inte betalt**.

Slå på den när alla fyra stämmer. Flaggans egen rad säger samma sak (`vantar_pa`),
och texten går inte att skriva om från en vy:

1. En provbetalning har gått hela vägen (9.6, steg 0–3).
2. Villkoren, prissidan och FAQ:n säger att passet betalas i förväg. **Gjort** i
   Fas 14.2, och `verktyg/kolla-betalningsvillkor.py` vaktar det.
3. Bokningsbekräftelsen säger det. **Gjort** i Fas 14.3.
4. Påminnelsen före passet säger det. **Gjort** i Fas 14.3.

Tre och fyra står fortfarande i flaggans `vantar_pa`, för `stampla_flaggan()`
skriver om texten vid varje ändring och den går inte att ändra från en vy. Det
som återstår är alltså steg 1: provbetalningen.

`verktyg/rls-test.sql` provar spärren i båda lägena oavsett vad driften står på:
nio prov om spärren, sex om flaggan, och avvikelserna runt den.

### 9.10 Korttvister (Fas 14.3)

En korttvist är när familjens bank drar tillbaka en betalning, för att
kortinnehavaren bestridit den. Pengarna och Stripes tvistavgift dras från
Nextrums saldo direkt. De kommer tillbaka bara om Nextrum skickar in underlag
före en viss dag, och banken ger Nextrum rätt. **Missas dagen är tvisten
förlorad**, utan att någon behöver ha sett den.

**Vad koden gör.** Webhooken sparar varje tvist i `stripe_tvister`: Stripes id,
passet, orsakens kod, läget, beloppet och sista dagen att svara. Inget underlag
och ingen text från kortinnehavaren, bara koder, belopp och datum. När Stripe
väntar på oss skapas en uppgift, "Svara på korttvisten senast 12 oktober", med
dagen som förfallodag, orsaken med våra ord och vad som ska samlas. Tabellen
läses bara av admin; ingen, inte ens admin, skriver i den från en vy
(`verktyg/rls-test.sql`, avsnittet 14.3).

Adminvyn visar varje öppen tvist under Betalningar & utbetalningar →
Kortbetalningar → **Korttvister**, med dagar kvar, och en länk rakt till tvisten
i Stripes dashboard.

**Vad en människa gör:**

1. **Samma dag som uppgiften kommer.** Öppna tvisten i Stripe. Orsaken avgör vad
   som behövs; uppgiften säger det, och listan står i `tvistUnderlag()` i
   `_delad/stripe.ts`.
2. **Samla underlaget ur adminvyn.** Raden under Korttvister säger vad vi har:
   när passet bokades, om det bekräftades, närvaron, rapporten och när det
   betalades. System → Auditlogg visar när varje steg hände (loggen täcker passets
   hela liv sedan Fas 9.3). Villkoren ligger på
   `/anvandarvillkor`. Skriv av det som behövs; ladda aldrig upp hela rapporten om
   barnet om orsaken inte kräver den.
3. **Skicka in i Stripes dashboard**, under Tvister, före dagen. Stripe flyttar
   tvisten till `under_review`, och uppgiften kan stängas.
4. **Vänta på utfallet.** Det kan ta veckor. Vunnen: passet blir `betald` igen av
   sig självt. Förlorad: passet står kvar som `tvist`, och beloppet är borta.

**Ett förlorat pass är inte ett återbetalt pass.** Passet hölls, familjen fick det,
och pengarna togs tillbaka av banken. `betalning_status` står därför kvar på
`tvist`, inte `aterbetald`, och vad som hände står i `stripe_tvister`.
Studiehjälparens ersättning räknas ur rapporten och påverkas inte av en tvist.
Ska den det är det ett beslut för en människa, inte för en webhook.

**Händelserna kan komma i fel ordning.** Stripe lovar ingen ordning, och en sen
`updated` efter `closed` får inte öppna en avgjord tvist igen. En stängd rad
skrivs därför bara över av en annan stängning.

**`warning_needs_response` är en förfrågan, inte en tvist än.** Banken frågar
innan den drar tillbaka något. Den får en uppgift på samma sätt: ett svar då kan
hindra att det blir en tvist alls. Stängs den utan återkrav (`warning_closed`)
räknas den som vunnen.
