# Sätta upp betalning

**Sedan Fas 14.2 betalar familjen varje pass med kort, före passet.** Pengarna tas
emot genom Stripe (avsnitt 9). **Sedan Fas 14.6 finns faktura som andra betalsätt,
byggt men avstängt** tills bolaget och Fortnox-kontot finns (9.11). Studiehjälparen får betalt
den 25:e ur `payouts`. Månadskörningen skapar underlagen, och ett fakturautkast per
familj som valt faktura.

Filen står därför i fyra delar:

- **Avsnitt 1–6** är månadskörningen och underlagen till studiehjälparna. De
  fungerar utan Stripe.
- **Avsnitt 7** är historik: planen att skicka månadsfakturan genom Stripe.
- **Avsnitt 8** är utskicket av underlagen. Fakturor skickas från Fortnox.
- **Avsnitt 9** är kortbetalningen, spärren "ingen betalning, inget pass", och
  (9.11) det som ska göras den dag fakturan slås på.

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
| 4. Deploy `fakturering` | ACTIVE, version 28. Skapar underlag, ett fakturautkast per familj som valt faktura (Fas 14.6), och räknar upp pass som hölls utan att betalas |
| 5. Torrkörning | **Väntar på er** — knappen under Ekonomi → Månadskörning, ingen nyckel behövs |
| 6. Schemaläggning | **Väntar på er** |
| 7. Stripe | **Testläge, provat.** Två provbetalningar gick hela vägen 2026-09-25. Skarpt läge väntar. Se avsnitt 9 |
| 8. Deploy `faktura-utskick` | ACTIVE, version 19. Skickar bara underlag sedan Fas 14.6 |

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

## 8. Utskicket av underlag (fakturor skickas från Fortnox)

`faktura-utskick` mejlar studiehjälparen underlaget, alltså vad hen kommer att få
den 25:e. Knappen **Skicka underlag** under Ekonomi → Utbetalningar anropar den.
Namnet är kvar från när den också skickade familjens faktura. **Sedan Fas 14.6
vägrar den fakturor**: de skickas från Fortnox, som också sköter bokföringen och
påminnelserna. Två ställen som skickar samma faktura är två ställen som kan
säga olika saker om den.

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

Knappen torrkör först: adminvyn visar exakt vad studiehjälparen kommer att läsa,
och ingenting har skickats än. **Ingen reservavsändare.** `lead-notis` faller
tillbaka på `onboarding@resend.dev` när nextrum.se inte är verifierad, och det är
rätt där, för det mejlet går till oss. Reserven når bara Resend-kontots egen adress,
alltså aldrig studiehjälparen. Är domänen inte verifierad får ni ett fel.

### Fakturan (Fas 14.6)

1. **Månadskörningen** skapar ett utkast per familj för de pass familjen valt
   faktura för, som har en rapport och som inte står på någon faktura: förra
   månadens, och äldre som blivit kvar. Beloppet räknas som kortets:
   samma pris, samma tillägg för fler barn, samma frysta rabatt.
2. **Ekonomi → Fakturor → Underlag** kopierar det Fortnox behöver: familjen, perioden,
   raderna och summan.
3. **Lägg in fakturan i Fortnox** och skicka den därifrån.
4. **Lagd i Fortnox** här: fakturanumret i Fortnox och förfallodagen. Fakturan står då som
   skickad, och familjen ser den under Betalning. Som utkast syns den för familjen
   bara som "står på fakturan för september, som snart skickas".
5. **Betald** när Fortnox visar att pengarna kommit. Fortnox är inte kopplat, med flit
   (`INTEGRATIONER.md` säger varför), så ingen annan än ni kan säga det här.

**Förfallodagen räknas från när fakturan skickas**, inte från när körningen skapade
den. Villkoret är tio dagar; skapas utkastet den 1:a och skickas den 5:e vore det
sex om man räknade från körningen. Knappen föreslår dagens datum plus tio.

**Inga avgifter.** Villkoren nämner ingen fakturaavgift och ingen
påminnelseavgift, och då får ingen tas ut. Kontrollera att påminnelserna i Fortnox
står utan avgift innan den första fakturan går.

### Ändra betalningslöftet

Sedan Fas 14.2 är löftet inte ett antal dagar. Det är en mening: familjen betalar
varje pass med kort, före passet, och **ett pass som inte är betalt hålls inte**.
Den gäller oförändrad tills flaggan `faktura` slås på; då ändras den enligt 9.11.
Meningen står på sexton ställen i tio filer: användarvillkoren, prissidan och FAQ:n
på båda språken, FAQ-schemat, studievyns Betalning och Pris & villkor, notisen om
pass att betala i `nextrum-studie-vy.js`, maskotens svarsfil och mejlmallarna. Alla måste säga
samma sak. En betalning som tas på ett annat sätt än villkoren lovar är en tvist,
inte ett skrivfel.

Efter en ändring:

```bash
python3 verktyg/bygg-faq-schema.py        # FAQ-schemat ur den synliga texten
python3 verktyg/bygg-maskotsvar.py        # maskotens svar ur FAQ:n och prissidan
python3 verktyg/kolla-betalningsvillkor.py
```

Den sista räknar meningen på alla sexton ställen, och letar efter det gamla löftet
("efterskott", "10 dagars betalningsvillkor", "första faktura" och de engelska
motsvarigheterna) i allt som serveras. Den säger ifrån om en mening formulerats om
så att den slutat bevaka ett ställe — ett sökuttryck som inte hittar något ser
annars ut som ett godkännande.

Två saker klarar den inte:

- **Det som faktiskt körs.** Att spärren är på är en flagga i databasen, inte en
  mening på en sida (9.9).
- **Inställningen i Fortnox.** `BETALNINGSVILLKOR_DAGAR` står i `_delad/konstanter.ts`
  och i `nextrum-config.js`, och kontrollen säger ifrån om de skiljer sig. Men
  dagarna på fakturan sätts i Fortnox, och dit når ingen kontroll.

### Utbetalningarna

Knappen **Skicka underlag** mejlar studiehjälparen vad hen kommer att få, så att hen
hinner säga ifrån innan pengarna går. Den ändrar ingen status — att visa ett underlag
är inte att godkänna det.

**Själva överföringen finns inte.** Det finns ingen betaltjänst kopplad, så ingen
knapp i adminvyn flyttar pengar. `Utbetald` betyder "vi har betalat från banken", och
det måste ni ha gjort innan ni sätter det. Kortbetalningen i avsnitt 9 ändrar inte
det: den gäller familjens håll, och pengarna stannar hos Nextrum tills ni betalar ut
dem den 25:e. Blir studiehjälparna anställda läggs underlaget in i Fortnox Lön för
hand (Fas 14.9); anställningsfrågan står i 9.7.

---

## Om en faktura ser fel ut

**Ett utkast** tas bort med **Ta bort** under Ekonomi → Fakturor. Raderna följer
med, passen blir ofakturerade igen, och nästa månadskörning tar med dem. Rätta
passet först.

**En faktura som ligger i Fortnox** krediteras i Fortnox och **makuleras** här. Raderna
står kvar på en makulerad faktura, så passen kommer INTE med på nästa körning: det
är rätt när familjen inte ska betala dem. Ska de faktureras om: ta bort den
makulerade fakturan i Table Editor (raderna följer med, `on delete cascade`) och kör
månadskörningen igen.

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

**Två provbetalningar har gått hela vägen, i testläge** (25 september 2026, 09:39
och 10:18). Båda landade i `stripe_handelser` som `checkout.session.completed` med
`resultat = 'betald'`, och båda passen står som betalda med rätt `betalt_ore`. Två
saker fattades, och Fas 14.7 lagade dem (9.4): Stripes avgift kom inte med, och
testbetalningarna gick inte att skilja från skarpa. Resten av provlistan i 9.6 är
kvar att köra innan ni rör en skarp nyckel, och innan spärren slås på (9.9).

### 9.1 Vad som finns

| Del | Läge |
|---|---|
| Kolumnerna och skyddet (`20260922155740_fas12_1_*.sql`) | **Applicerad** |
| `stripe-konto` | **Borttagen**, ur repot och ur driften (Fas 12.5) |
| Korttvisterna (`20260924125618_fas14_3_*.sql`) | **Applicerad.** Tabellen `stripe_tvister`, se 9.10 |
| Faktura som betalsätt (`20260925120727_fas14_6_*.sql`) | **Applicerad, flaggan `faktura` AV.** Se 9.11 |
| Test eller skarpt (`20260925121120_fas14_7_*.sql`) | **Applicerad.** `bookings.stripe_skarp`, `stripe_handelser.skarp` |
| `stripe-checkout` | **ACTIVE**, version 11, `verify_jwt = true`. Fas 14.3: bara kort, kvitto till familjens adress, kontoutdragets tillägg högst tio tecken. Fas 14.4: Managed Payments av, och Stripes nej skrivs till loggen (9.5). Fas 14.5: kassan öppnas i en panel på sidan (9.2). Fas 14.6: vägrar ett fakturapass |
| `stripe-webhook` | **ACTIVE**, version 8, `verify_jwt = false`. Fas 14.3: tvisterna sparas med sista svarsdag, orsak och utfall. Fas 14.7: avgiften ur `charge.updated`, läget ur `livemode`, och en betalning efter ett nekat kort tas emot |
| `stripe-aterbetalning` | **ACTIVE**, version 6, `verify_jwt = true`. Bara för admin. Vanlig återbetalning, ingen transfer att backa |
| `stripe-lage` | **ACTIVE**, version 4, `verify_jwt = true`. Bara för admin. Frågar Stripe om kontot och endpointen och svarar med en lista. Läser, skriver ingenting. Fas 14.5: säger om den publicerbara nyckeln är satt och i samma läge som den hemliga |
| `stripe-avstamning` | **ACTIVE**, version 1, `verify_jwt = true`. Bara för admin (Fas 14.7). Hämtar avgift, netto och läge för betalningar som saknar dem, högst femtio per tryck |
| `STRIPE_SECRET_KEY` | **Visas i adminvyn** sedan Fas 14.3: Betalningar & utbetalningar → Kortbetalningar → **Kontrollera Stripe** säger om den saknas, är en test- eller skarp nyckel, eller har fel format. Inte ett tecken mer än så |
| `STRIPE_WEBHOOK_SECRET` | **Satt och provad**: en påhittad signatur faller på tidsstämpeln, inte på hemligheten (slutet av 9.4) |
| Webhook-endpoint hos Stripe | **Skapad** i sandlådan, och två leveranser har kommit fram. **Saknar `charge.dispute.updated`** (Kontrollera Stripe sa det 2026-09-25) **och `charge.updated`**, som kom till i Fas 14.7 (9.4) |
| Knappen hos familjen | Finns: på passet när det är bekräftat, och på ett genomfört pass som inte är betalt |
| Spärren `kortsparr` | **Av.** Se 9.9 |

De driftsatta filerna är lästa tillbaka och jämförda mot repot. Det är inte en
formalitet: `apply_migration` och `functions deploy` ändrar driften direkt medan
git är ett skilt steg, och de två har glidit isär i det här projektet förut
(CLAUDE.md avsnitt 7).

Fas 14.6–14.8 driftsattes 2026-09-25, och alla fem stripe-funktionerna,
`fakturering`, `faktura-utskick`, `ekonomi`, `notis-ko`, `lead-notis` och
`notis-avanmal` är lästa tillbaka fil för fil och lika med repot. Det hittade en
glidning: `stripe-aterbetalning` hade legat ute med en `_delad/stripe.ts` från före
Fas 14.3, utan tvistdelen. Den har dagens nu.

### 9.2 Nycklarna

**Klistra aldrig in den hemliga i en chatt, i `nextrum-config.js` eller i
någon fil webbläsaren hämtar.** Den bor som secret i Supabase.

**Den publicerbara nyckeln (`pk_...`) behövs sedan Fas 14.5**, för kassan
öppnas i en panel på föräldravyn i stället för på Stripes sida. Den är inte
hemlig, men den bor ändå som secret, `STRIPE_PUBLISHABLE_KEY`, bredvid den
hemliga. De två måste komma från samma läge: en testnyckel och en skarp ger en
panel som inte går att öppna. `stripe-checkout` prövar det, och går det inte
öppnas kassan på Stripes sida som förut. **Kontrollera Stripe** visar det på
raden "Kassan på sidan". Saknas nyckeln händer samma sak: betalningen fungerar,
men på Stripes sida.

Byter ni till skarpt läge byts alltså BÅDA, i samma fönster. Innan dess ska
Stripe-integrationen i Fortnox vara kopplad (9.7).

Via dashboarden: **Project Settings → Edge Functions → Secrets**. Eller med CLI:

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_...
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
2026, så den står troligen på kontots förval. Provbetalningarna den 25 september
visar att fälten webhooken läser kom fram ändå: `resultat = 'betald'` och rätt
`betalt_ore` på passet.

**Men `stripe_avgift_ore` blev tom**, på båda. Det är inte versionen. Stripe skapar
balanstransaktionen, som bär avgiften och nettot, ofta en stund EFTER att sessionen
fullbordats, så `checkout.session.completed` kommer med `balance_transaction = null`.
Fas 14.7 lagade det två vägar: webhooken tar emot `charge.updated`, som Stripe
skickar när balanstransaktionen finns, och knappen **Hämta från Stripe** under
Kortbetalningar (`stripe-avstamning`) hämtar den för betalningar som kom in före.
Tryck på den en gång för de två provbetalningarna.

Adressen är:

```
https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/stripe-webhook
```

Händelser som ska väljas, och varför just de:

| Händelse | Vad den gör hos oss |
|---|---|
| `checkout.session.completed` | Sätter passet som betalt. **Enda vägen dit.** |
| `payment_intent.payment_failed` | Familjen kan försöka igen |
| `charge.updated` | Avgiften och nettot, när Stripe skapat balanstransaktionen. **Ny i Fas 14.7** |
| `charge.refunded` | Skriver återbetalt belopp |
| `charge.dispute.created` | Sparar tvisten med sista svarsdag och orsak, och lägger en uppgift (9.10) |
| `charge.dispute.updated` | Stripe flyttar tvisten till `under_review` när underlaget skickats in, och kan ändra dagen. **Ny i Fas 14.3** |
| `charge.dispute.closed` | Utfallet: vunnen blir en betalning igen, förlorad står kvar som tvist |

**`charge.dispute.updated` och `charge.updated` saknas på endpointen**, för de
stod inte här när endpointen skapades. Lägg till dem: endpointens sida → **Update
details** → Select events. Knappen **Kontrollera Stripe** i adminvyn säger vilka
som saknas, så ni behöver inte gissa.

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
   `betalt_ore` stämmer med vad familjen faktiskt betalade, att `stripe_skarp` är
   `false` i testläge, och att `stripe_avgift_ore`, `stripe_netto_ore` och
   `stripe_balanstransaktion_id` är ifyllda. De tre sista kommer ofta med
   `charge.updated` en stund efter betalningen. Saknas de efter några minuter:
   tryck **Hämta från Stripe**. Stod det här förut att de inte gick att hämta i
   efterhand, så var det fel: de hänger på chargen och går att hämta när som helst.
4. **Prova 3D Secure** med `4000 0027 6000 3184`.
5. **Prova ett nekat kort** med `4000 0000 0000 0002` och se att passet blir
   `misslyckad` och går att betala igen. Betala sedan i SAMMA kassa med 4242: före
   Fas 14.7 drogs pengarna då utan att passet blev betalt, för webhooken tog bara
   emot en betalning på ett pass som stod `vantar`.
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
- **Bokföringen av korten (Fas 14.9).** Kortbetalningarna, Stripes avgifter och
  utbetalningarna (netto, i klumpar) ska bokföras genom en färdig Stripe-integration
  som väljs och kopplas i Fortnox, på integrationsmarknaden där. Ingen kod här rör den.
  Koppla den, och bestäm med revisorn hur den bokar, före den första skarpa
  kortbetalningen. Innan något går till Fortnox, genom integrationen, på en faktura
  eller i en lön, ska Fortnox stå under "Var uppgifterna finns" i integritetspolicyn,
  på svenska och engelska: i dag räknar den upp Supabase, Vercel, Stripe och
  Google (Meet-rummen, Fas 18.1).
- **Dubbelfaktureringen.** Månadskörningen tar bara med pass som står `faktura`
  (Fas 14.6), så ett kortbetalt pass kommer inte på en faktura. Det enda sättet
  är att familjen byter till faktura medan en kassa står öppen och betalar den
  ändå; webhooken tar emot betalningen, och avvikelsen **Betalt två gånger** larmar
  om passet redan hunnit faktureras. Kreditera då raden i Fortnox.
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

### 9.11 Faktura som betalsätt: dagen den slås på (Fas 14.6)

Allt i koden är byggt och driftsatt. Flaggan `faktura` står AV, och då syns inget
av det för familjen: inget val på passet, ingen rad om faktura i mejlen, och
`skydda_bokningsfalt` nekar bytet. Slå inte på den förrän allt nedan är gjort.
Flaggans `vantar_pa` säger samma sak, och `stampla_flaggan()` hindrar att texten
skrivs om från en vy.

**Före, utanför koden:**

1. **Bolaget är registrerat**, och Fortnox-kontot har bankgiro och OCR.
   Stripe-integrationen i Fortnox och raden om Fortnox i integritetspolicyn står i
   9.7: de gäller korten och ska vara klara före den första skarpa kortbetalningen,
   som kan komma före den här dagen. Är de inte gjorda, gör dem nu, för fakturan
   skickar familjens namn och e-post till Fortnox.
2. **Inställningarna i Fortnox:** tio dagars betalningsvillkor, ingen fakturaavgift,
   påminnelser utan avgift. Villkoren nämner ingen avgift, och då får ingen tas ut.
3. **Befintliga familjer meddelas trettio dagar i förväg.** Villkoren har ett
   avsnitt om ändringar, och en familj som godkänt kort före passet har inte
   godkänt faktura i efterskott. Ett meddelande som säger att faktura blir ett
   VAL, inte ett byte, räcker; det gör ingen sämre ställd.
4. **Ångerrätten och återbetalningen.** Villkorens avsnitt om ångerrätt och om
   pengar tillbaka för ett pass som aldrig hölls är skrivna för kort före passet.
   Läs dem med en jurist, eller med `juridik`-agenten som första steg, innan
   texten ändras, så att de säger vad som gäller för ett pass som betalas i
   efterskott.

**Samma dag, i en egen liten ändring:**

5. **Texterna, på båda språken.** Meningen "betalar varje pass med kort, före
   passet" står på sexton ställen i tio filer (avsnitt 8, Ändra betalningslöftet).
   Den ska säga att familjen kan välja faktura, tio dagar, utan avgift: villkoren,
   prissidan, FAQ:n, studievyns Pris & villkor och intro under Betalning i
   `foralder.html`, och samma sidor under `/en/`.
6. **Kontrollen följer med.** `verktyg/kolla-betalningsvillkor.py` räknar den
   gamla meningen och letar efter "efterskott" och "10 dagars" som FÖRBJUDNA ord.
   Båda blir sanna den dagen: ändra `LOFTET` och listan över förbjudna uttryck i
   samma ändring, annars blir CI rött av en korrekt text.
7. **Bygg om** FAQ-schemat och maskotens svar (`bygg-faq-schema.py`,
   `bygg-maskotsvar.py`), och kör `jamfor-sprak.py`.
8. **Mejlen.** Bokningsbekräftelsen och påminnelsen säger redan "månadens
   faktura" för ett pass där familjen valt faktura (`betalsatt` i `RenData`).
   Vill ni att mejlet till en kortfamilj ska nämna att faktura GÅR att välja: det
   är en ny mening i `mallar.ts`, med prov.

**Sist:**

9. **Slå på flaggan** under Ekonomi → Fakturor. Knappen säger vad den gör innan
   den gör det.
10. **Provfakturera en familj**, gärna er egen: välj faktura på ett pass, rapportera
   det, kör månadskörningen i torrkörning och sedan skarpt, lägg in utkastet i
   Fortnox, skriv in numret, och markera den betald när pengarna kommit.

**De sex gamla obetalda passen** (bokade när villkoren lovade månadsfaktura) kan bli
den första riktiga fakturan: bytet till `faktura` går också på ett genomfört pass.

### 9.12 Planer och klippkort (Fas 16.1)

Familjen kan köpa timmar i förväg: två planer för en månad (4 och 8 timmar, 10 %
rabatt) och klippkort med 10, 20, 30, 60 eller 100 timmar (5 % rabatt, gäller 6, 6,
6, 12 och 18 månader). Timmarna betalar sedan ett bekräftat pass i stället för
kortet. Databasen är körd (`fas16_1` till `fas16_1e`), och flaggan `erbjudanden`
står AV. Då syns erbjudandena med sina priser på prissidan och i studievyn, men
knapparna säger "Snart", och inga timmar går att dra.

**Var saker räknas, och bara där:**

| Vad | Var |
|---|---|
| Priset | `erbjudanden_pris`. Timpriset med rabatt, nedåt till hel krona, gånger timmarna (16.1d). Prissidan, studievyn och `stripe-checkout` läser samma rad |
| Timmar kvar | `klippkort_saldo.kvar`, ur passen som bär `klippkort_id`. Ett avbokat pass räknas inte, så timmarna kommer tillbaka av sig själva |
| Att dra timmar | `klippkort_dra()`, bara `service_role`, anropad av `klippkort-betala` efter att familjens token prövats |
| Pengar tillbaka | `klippkort_saldo.vid_anger_ore` inom ångerfristen, `vid_uppsagning_ore` efter den. Adminvyn väljer efter datumet |

**Driftsätt i den här ordningen:**

```
supabase functions deploy stripe-webhook
supabase functions deploy stripe-checkout
supabase functions deploy klippkort-betala
```

Webhooken FÖRST. Den gamla känner inte igen ett köpt klippkort: sessionen har
`klippkort_id` i metadata och inget pass, och en betalning den inte kan knyta till
något blir en betald rad hos Stripe och ett kort som står på `vantar` för alltid.
`klippkort-betala` anropas av en inloggad förälder och ska ha JWT-kravet kvar; den
står därför inte i `config.toml`.

**Prova, i testläge, innan flaggan slås på.** Sätt notisernas sandlåda först.

1. Slå på flaggan under Ekonomi → Kortbetalningar → Erbjudanden, med en testfamilj
   inloggad i en annan flik.
2. Köp Klippkort 10 timmar med testkortet `4242 4242 4242 4242`. Raden i
   `klippkort` ska bli `betald` med `stripe_skarp = false`, `giltigt_till` sex
   månader fram och `stripe_charge_id` satt.
3. Låt en studiehjälpare bekräfta ett pass på en timme. Familjen ska se "Betala med
   timmar" först. Tryck; passet ska bli `betald` med `klippkort_id` satt och
   `betalt_ore` tomt, och kortet ska ha 9 timmar kvar.
4. Avboka passet som admin. `betalning_status` ska bli `ingen` (16.1c, annars larmar
   `betald_men_avbokad` om pengar som aldrig drogs), och kortet ska ha 10 timmar igen.
5. Återbetala en del av köpet i Stripes dashboard. Kortet ska bli `aterbetald` och
   inte längre gå att dra från.
6. Står något av det fel: stäng av flaggan. Redan köpta timmar syns fortfarande,
   men inget nytt går att köpa eller dra.

**Pengar tillbaka görs i Stripes dashboard, av en människa.** Beloppet står under
Erbjudanden i adminvyn, kolumnen "Om de slutar i dag":

- **Inom 14 dagar från köpet gäller ångerrätten.** De använda timmarna räknas som
  en andel av det familjen BETALADE, inte till 379 kr. Lagen om distansavtal 2 kap.
  15 § ger oss en proportionell andel av det avtalade priset och inte mer, så
  regeln "använda timmar till ordinarie pris" gäller inte här. Kolumnen visar
  då `vid_anger_ore` och säger sista dagen.
- **Efter fristen** räknas de använda timmarna till ordinarie timpris vid köpet
  (`klippkort.timpris_ore`, inte dagens pris: det är prisgarantin i villkoren).
- **Varje återbetalning stänger kortet**, också en delvis. Betala alltså bara
  tillbaka när familjen slutar, ångrar sig, eller för en timme som gick förlorad
  när kortet löpte ut för att vi eller studiehjälparen avbokat för sent. Det sista
  lovar villkoren, och ingen kod upptäcker det: läs passen på kortet när en familj
  hör av sig.

**Kvar, och inget av det sköter koden:**

- **Familjen kan inte avboka ett pass de betalat med timmar själva.** Det är samma
  spärr som för ett kortbetalt pass (`skydda_bokningsfalt`), och villkoren säger att
  de kontaktar oss. Med klippkort är det onödigt strängt, för inga pengar ska
  tillbaka: timmarna återkommer av sig själva. Att släppa igenom det kräver en
  ändring i `skydda_bokningsfalt`, som Fas 14.6 skrev om, och gjordes därför inte
  här.
- **Timmar som löpt ut förfaller.** Ingen påminnelse går ut innan. En notis en vecka
  före `giltigt_till` är en ny notistyp (DEPLOY-NOTISER.md har de fem stegen), och
  för planerna, som gäller en månad, är det skillnaden mellan en nöjd familj och
  en som känner sig lurad på en timme.
- **Planerna säger "ett pass i veckan", men ingenting håller dem till det.** En plan
  är fyra eller åtta timmar som gäller en månad. Hur de bokas är familjens sak.
- **Startererbjudandet** (se 9.7) gäller fortfarande inte något av detta.
