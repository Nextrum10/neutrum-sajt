# Sätta upp de två agenterna

Två edge functions: `juridik` och `ekonomi`. De syns i adminvyn under
**Agenter**, i fem flikar: Läget, Juridik, Ekonomi, Bolagsfakta och
Återkoppling. Båda är adminverktyg, båda loggar varje steg de tar, och
båda är byggda för att hellre vägra svara än att svara på känsla.

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

**`ekonomi`** läser bolagets egna siffror, slår upp vad
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

Supabase → SQL Editor → New query. Klistra in `supabase/migrations/arkiv/schema-v13-agenter.sql`
och kör. (Filen hette `supabase/migrations/arkiv/schema-v13.sql` här på grenen, men main hade
redan en annan v13 — adminvyns skrivrätt. Båda är körda mot samma
databas; filnamnet är det enda som skiljer dem åt.)

Det lägger till fyra tabeller: `agent_korningar`, `agent_steg`,
`foretagsfakta` och `fortnox_token`. Inget befintligt ändras.
(`fortnox_token` togs bort i Fas 14.8, när bokföringen flyttade till
Wint. Den var tom.)

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

Enklast: logga in på `/admin`, gå till **Agenter → Läget** och tryck
**Kör självtestet**. Knappen gör exakt det som står nedan och ritar upp
svaret rad för rad.

Vill du hellre se rådata, i webbläsarens konsol, inloggad som admin:

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

## Bokföringen

`ekonomi` hade till Fas 14.8 ett verktyg, `las_fortnox`, som läste
Fortnox. Fortnox kopplades aldrig, och bokföringen sköts i Wint, som
inte är kopplat hit (`INTEGRATIONER.md` säger varför). Verktyget är
borta, och agenten läser bara det som finns i databasen. Fyll i
`bokforingssystem` i bolagsfakta med `wint`, så att agenten vet var
verifikaten finns när den svarar.

Står `FORTNOX_CLIENT_ID` och `FORTNOX_CLIENT_SECRET` (eller
`FORTNOX_KLIENT_ID`, `FORTNOX_KLIENT_HEMLIGHET` och
`FORTNOX_REFRESH_TOKEN`) kvar bland secrets: ta bort dem. Ingen kod
läser dem längre, och en hemlighet ingen använder är en hemlighet ingen
märker om den läcker.

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
