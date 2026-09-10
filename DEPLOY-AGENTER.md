# Sätta upp de två agenterna

Två edge functions: `juridik` och `ekonomi`. Båda är adminverktyg, båda
loggar varje steg de tar, och båda är byggda för att hellre vägra svara än
att svara på känsla.

Läs `DEPLOY-AI-FUNKTION.md` först om du inte satt upp en edge function
förut. Stegen med Supabase CLI, inloggning och `supabase link` är samma
här och upprepas inte.

---

## Vad de är, och vad de inte är

**`juridik`** slår upp svensk rätt inom sex avgränsade områden: distansavtal,
konsumenttjänst, dataskydd, arbetsrätt, minderårigas arbete och bokförings-
formalia. Den söker och läser bara primärkällor — riksdagen, Svensk
författningssamling, lagrummet, IMY, Arbetsmiljöverket, Skatteverket,
Konsumentverket, ARN, EUR-Lex. Frågor utanför de sex områdena avvisas.

**`ekonomi`** läser bolagets egna siffror och Fortnox, slår upp vad
Skatteverket och Bokföringsnämnden säger, och lämnar förslag. Den bokför
ingenting och deklarerar ingenting. Alla verktyg den har är läsande.

Ingen av dem ersätter en jurist eller en redovisningskonsult. De gör att
timmen hos en riktig sådan räcker tre gånger längre, för ni kommer dit med
rätt frågor och rätt paragrafer redan uppslagna.

### Den spärr som gör det här användbart

Modellen ombeds citera sina källor. Sedan **kontrollerar koden** att varje
adress i svaret är en adress agenten faktiskt hämtade under körningen.
Adresser den hittat på plockas bort.

I `juridik` kastas hela svaret om det inte återstår en enda riktig källa.
Får du tillbaka "agenten kunde inte belägga svaret" är det inte ett fel,
det är spärren som gör sitt jobb. Ett svar utan källa är en gissning med
rubriker, och en gissning med rubriker är farligare än inget svar.

I `ekonomi` är spärren mjukare, med flit: "hur mycket är obetalt just nu"
har ingen webbkälla att peka på. I stället flaggas svaret med
`utan_hamtad_regel: true`. Handlar frågan om era egna siffror är det
väntat. Handlar den om moms eller deklaration ska du läsa svaret med
misstro.

---

## Vad som redan är gjort

Steg 1, 3 och 4 nedan är körda mot projektet `ddkfiuvcppalutfulvbi`. De står
kvar för att de behövs om ni någon gång sätter upp en ny miljö, men just nu
är det bara steg 2 och 5 som väntar på er.

| Steg | Läge |
|---|---|
| 1. Schemat | Applicerat, fyra tabeller på plats |
| 2. Bolagsfakta | **Väntar på er** |
| 3. `ANTHROPIC_API_KEY` | Satt, samma som `generate-feedback` använder |
| 4. Deploy | Båda funktionerna ACTIVE, version 1 |
| 5. Självtest | **Väntar på er**, kräver inloggad admin |

## 1. Kör schemat

Supabase → SQL Editor → New query. Klistra in `schema-v13.sql` och kör.

Det lägger till fyra tabeller: `agent_korningar`, `agent_steg`,
`foretagsfakta` och `fortnox_token`. Inget befintligt ändras.

## 2. Fyll i bolagsfakta

Table Editor → `foretagsfakta` → den enda raden. Fyll i bolagsform,
räkenskapsår, momsregistrering och momsperiod.

**Fältet `studiehjalpare_form` är det viktigaste i hela tabellen.** Står det
kvar på `oklart` kommer ekonomiagenten att säga att den inte kan svara på
personalfrågor, och det är rätt av den. Om studiehjälparna är anställda
eller uppdragstagare avgör arbetsgivaravgifter, skatteavdrag, AGI,
försäkringar och arbetsmiljöansvar. Det är inte en fråga en modell ska gissa
sig till, och egentligen inte en ni ska gissa er till heller.

## 3. Secrets

`ANTHROPIC_API_KEY` är redan satt om `generate-feedback` fungerar. Annars:

```
supabase secrets set ANTHROPIC_API_KEY=din-nyckel
```

Fortnox väntar tills steg 6. Utan de secretsen svarar `las_fortnox` med
"Fortnox är inte kopplat", vilket är precis vad den ska göra.

## 4. Deploya

```
supabase functions deploy juridik
supabase functions deploy ekonomi
```

Mappen `supabase/functions/_delad/` innehåller den gemensamma agentmotorn.
Den deployas inte som en egen funktion (Supabase hoppar över mappar som
börjar med understreck) utan följer med i båda buntarna automatiskt.

## 5. Självtest

Kör det här **innan** du ställer en riktig fråga. Det rör inte modellen,
kostar ingenting, och skiljer ett infrastrukturfel från ett promptfel.

I webbläsarens konsol, inloggad som admin:

```js
await supa.functions.invoke('juridik', { body: { sjalvtest: true } });
await supa.functions.invoke('ekonomi', { body: { sjalvtest: true } });
```

Juridiktestet ska svara `hamtning_fungerar: true` och
`domanspärr_stoppade_example_com: true`. Det andra är viktigare än det
första: det visar att agenten inte kan hämta vad som helst från nätet.

Ekonomitestet listar vad som är kopplat och vad som inte är det.

## 6. Riktiga frågor

```js
const { data } = await supa.functions.invoke('juridik', {
  body: { fraga: 'Gäller ångerrätt när en familj bokar ett läxhjälpspass hos oss, och vad måste vi informera om innan de bokar?' }
});
console.log(data.svar, data.kallor);
```

```js
await supa.functions.invoke('ekonomi', {
  body: { fraga: 'Vilka genomförda pass har aldrig hamnat på en faktura, och vad borde vi göra åt dem?' }
});
```

En körning tar ofta 30–90 sekunder. Den söker, hämtar två eller tre
dokument och läser dem innan den svarar. Går det snabbare än så har den
förmodligen inte hämtat något, och då syns det i `kallor`.

Varje körning ligger sedan i `agent_korningar` med sina steg i
`agent_steg`. Titta där när ett svar ser konstigt ut — du ser exakt vilka
källor det vilade på.

---

## Fortnox

`las_fortnox` gör bara GET, och bara mot en fast lista vägar. Det finns
ingen kod i funktionen som kan skriva till Fortnox. Det är avsiktligt: en
felaktig post i en bokföring går inte att ångra, bara att rätta med ett
nytt verifikat och en förklaring till revisorn.

### Koppla på

1. Skapa en integration på `fortnox.se/developer`. Du får ett Client ID och
   ett Client Secret.
2. Kör auktoriseringen enligt Fortnox egen guide på
   `fortnox.se/developer/authorization`. Du loggar in som er Fortnox-kund och
   godkänner integrationen, och får tillbaka en engångskod i redirect-adressen.
3. Byt koden mot tokens:

```
curl -X POST https://apps.fortnox.se/oauth-v1/token \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=authorization_code" \
  -d "code=KODEN_DU_FICK" \
  -d "redirect_uri=DIN_REDIRECT_URI"
```

4. Lägg in svaret i `fortnox_token`, raden med id 1: `access_token`,
   `refresh_token`, och `gar_ut` en timme fram i tiden.
5. Sätt secrets:

```
supabase secrets set FORTNOX_CLIENT_ID=... FORTNOX_CLIENT_SECRET=...
```

### En sak som kommer att bita er

**Fortnox refresh_token byts vid varje förnyelse och dör efter 45 dagar
utan användning.** Funktionen sparar den nya automatiskt. Men används
agenten inte på sex veckor är kopplingen död och någon får göra om steg 2
till 4 för hand.

Kör ni agenten en gång i kvartalet håller den alltså inte sig själv vid
liv. Vill ni slippa det: lägg ett schemalagt anrop en gång i veckan som
bara läser `settings/company`, så räcker det.

Får ni 401 från Fortnox med en token som borde vara giltig är det oftast
för att integrationen är registrerad för den äldre autentiseringen med
`Access-Token` och `Client-Secret` som separata headrar. Kolla
integrationens inställningar hos Fortnox innan du ändrar i koden.

---

## Swedbank

Går inte att koppla på det sätt frågan förutsätter, och det är bättre att
veta det nu än efter tre kvällar.

Att hämta kontodata från en bank programmatiskt regleras av PSD2. Den som
hämtar måste vara en licensierad tredjepartsleverantör med eIDAS-certifikat
och tillstånd från Finansinspektionen. Det är inte något ett litet bolag
skaffar för att slippa läsa sitt eget kontoutdrag. Swedbanks utvecklar-
portal och sandlåda är öppna för vem som helst, men skarp åtkomst är det
inte.

De två vägar som faktiskt finns:

- **Filväg.** Exportera kontoutdrag från internetbanken som camt.053 eller
  SIE och läs in filen. Ingen licens, inget avtal, går att bygga imorgon.
  Priset är att någon klickar på en knapp en gång i månaden.
- **Aggregator.** Tink, Enable Banking och liknande har licensen och säljer
  åtkomsten vidare. Kostar pengar och kräver avtal, men ger löpande data
  utan handpåläggning.

Ingen av dem är byggd här. Säg vilken ni vill ha så bygger jag den — men
välj först, för de två ser helt olika ut i koden.

---

## Vad det kostar

Modellen är `claude-opus-5`. En juridikfråga som hämtar tre dokument landar
grovt på någon eller några kronor. En ekonomifråga som bara läser er databas
är billigare.

`agent_korningar` sparar `in_tokens` och `ut_tokens` per körning, så ni kan
räkna på riktigt i stället för att gissa när ni undrar.

## Om något strular

- **"Den här funktionen är bara för admin"** → sätt `is_admin = true` på din
  rad i `profiles`.
- **"Agenten hann inte fram på 6 steg"** → frågan var för bred. Dela upp
  den, eller peka ut vilken lag du vill veta något om.
- **"Agenten kunde inte belägga svaret i någon källa"** → spärren
  fungerade. Ställ en mer preciserad fråga. Händer det ofta för samma sorts
  fråga är källistan förmodligen för smal för det området.
- **Fel på `betas` eller `fallbacks` vid deploy** → de två raderna i
  `_delad/agent.ts` slår på Anthropics serverside-fallback, som kör om ett
  avböjt anrop på en annan modell. Ta bort dem, resten fungerar ändå.
- **Timeout** → en edge function har en väggklocka. Sänk `MAX_STEG` i
  `_delad/agent.ts` om körningarna ligger nära gränsen.
