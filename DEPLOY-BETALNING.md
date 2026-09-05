# Sätta upp betalning

Betalningen är byggd i två delar: **det som fungerar utan Stripe**, och **det som
kräver Stripe**. Gör den första delen nu — då kan ni se fakturor och underlag i
vyerna direkt. Ta Stripe när ni faktiskt vill att pengar ska röra sig.

Läs igenom hela filen innan du börjar. Det finns en torrkörning som du ska göra
före den första skarpa körningen, och den är hela poängen med den här ordningen.

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

Öppna Supabase → SQL Editor, klistra in hela `schema-v8.sql` och kör.

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

Kör den här **innan** den första skarpa körningen. Den räknar ut allt och svarar
med vad som skulle skapas, utan att skriva en enda rad:

```
curl -X POST "https://DITT-PROJEKT-ID.supabase.co/functions/v1/fakturering" \
  -H "x-fakturering-nyckel: DIN-NYCKEL" \
  -H "content-type: application/json" \
  -d '{"torrkorning": true}'
```

Läs svaret. Stämmer antalet pass? Stämmer beloppen mot vad ni faktiskt kommit
överens om med familjerna? Står det något i `hoppade_over_utan_timpenning` — då
saknar de studiehjälparna en timpenning, gå tillbaka till steg 3.

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
råkar vara påslaget.

---

## 7. Stripe — när ni är redo

Allt ovanför fungerar utan Stripe. Det som saknas är att ta emot pengarna.

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
4. **Stripe Connect för utbetalningar.** Varje studiehjälpare gör en egen
   registrering hos Stripe — knappen finns redan under Ersättning och anropar en
   funktion vid namn `stripe-konto`, som inte är byggd än. Kolumnerna
   `stripe_account_id` och `stripe_klar` väntar på den.

Platsen där punkt 1–2 ska in är utmärkt med en kommentar i
`supabase/functions/fakturering/index.ts`, längst ned.

---

## Om något ser fel ut

Fakturan skapas som `skickad` direkt. Vill ni hellre granska först, ändra
`status: 'skickad'` till `status: 'utkast'` i funktionen — familjens vy visar då
"Utkast" och ingen betalknapp.

Behöver ni ta bort en felaktig faktura: ta bort den i Table Editor. Raderna följer
med (`on delete cascade`), och passen blir automatiskt ofakturerade igen och
kommer med i nästa körning.
