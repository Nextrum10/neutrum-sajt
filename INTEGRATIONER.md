# Google Workspace

Adminsidan har en flik som heter **System → Integrationer**. Den visar om
Google är kopplat, med vilket konto, när det senast skapades ett rum och
vad Google senast sa nej till. Det den säger är det servern rapporterat,
aldrig något vyn gissat.

Sedan Fas 18.1 gör kopplingen **en sak**: varje bekräftat onlinepass får
en egen Google Meet-länk, som står på passets sida hos familjen och
studiehjälparen. Leo valde det 2026-09-25, av fyra förslag. Kalendern,
inbjudningarna och rekryteringsmötet valdes bort, och mejlen går inte
genom Google (se "Varför inte kalendern och mejlen" nedan).

Fortnox stod här till Fas 14.8. Bokföringen och fakturorna sköts i
**Wint**, och Wint är med flit inte kopplat alls (se nedan).

---

## Koppla-knappen, och varför den inte läcker hemligheten

Den här filen hette länge "Varför det inte finns en Koppla-knapp".
Kopplingen kräver en **klienthemlighet**, och en hemlighet som webbläsaren
kan läsa är ingen hemlighet: den ligger då hos varenda person som öppnar
sidan, inklusive den som öppnar utvecklarverktygen.

Det skälet gäller fortfarande, och knappen bryter inte mot det:

1. **Koppla Google** i adminvyn frågar edge-funktionen `google-koppla`
   efter en adress. Funktionen prövar att den som frågar är admin och
   svarar med en adress till `accounts.google.com`. Ingenting annat.
2. Admin loggar in hos Google och godkänner.
3. Google skickar tillbaka en **engångskod** till funktionen, inte till
   vyn. Funktionen byter koden mot en nyckel (refresh-token), med
   hemligheten, och sparar nyckeln i tabellen `google_koppling`.
4. Webbläsaren skickas tillbaka till `/admin?google=kopplad`.

Hemligheten lämnar aldrig funktionen. Tabellen `google_koppling` har RLS
utan en enda policy: bara `service_role` ser den, alltså bara
edge-funktionerna. `integrationer` bär bara status och har fortfarande
ingen skrivpolicy alls. **Adminsidan rapporterar. Den kopplar inte själv.**

Varför nyckeln ligger i en tabell och inte som en secret: den skapas av
ett klick, och en funktion kan inte skriva sina egna secrets. Den räcker
inte ensam. Google lämnar ut en åtkomst först mot nyckeln OCH
klienthemligheten, och hemligheten är en secret. Två ställen måste läcka
samtidigt, och det de då når är ett enda scope: att skapa Meet-rum.

---

## Wint — bokföringen och fakturorna, utan koppling

Nextrum bokför och fakturerar i Wint. Ingenting härifrån når Wint
automatiskt, och det är ett beslut, inte en lucka:

- Wint har ett API, men det är inte dokumenterat publikt, och det
  finns varken webhookar eller en sandlåda. En koppling som inte går att
  prova utan att skapa riktiga fakturor hos ett riktigt bolag provas i
  praktiken i drift.
- Volymen är liten. En faktura per familj och månad, för de familjer som
  valt faktura, läggs in för hand på några minuter.

Så går det till (Fas 14.6): månadskörningen skapar ett fakturautkast per
familj under **Ekonomi → Fakturor**. **Underlag** kopierar det Wint
behöver. Fakturan läggs in i Wint, som skickar den och ser när den
betalas. Wints fakturanummer och förfallodag skrivs sedan in här med
**Lagd i Wint**, och fakturan markeras **Betald** när Wint visar det.

Kortbetalningarna når inte heller Wint automatiskt. Stripe betalar ut
till banken i klumpar, netto efter avgiften; avgiften och nettot per
pass står under **Ekonomi → Kortbetalningar**. Hur utbetalningen bokas
bestäms med revisorn innan den första skarpa betalningen.

Wint får därför ingen rad i `integrationer`. En statusrad för något som
inte är kopplat hade sett ut som en koppling som väntar.

---

## Google Meet-länkarna (Fas 18.1)

### Vad som händer

- Familjen eller studiehjälparen öppnar ett **bekräftat onlinepass** som
  inte har varit. Vyn läser `pass_moten`. Finns ingen länk anropas
  `google-meet`, som prövar att anroparen ser passet genom RLS, skapar
  ett rum hos Google och sparar länken.
- Länken står under **Var** på passets sida, som
  `meet.google.com/abc-defg-hij`. Samma länk hos båda.
- Rummet är **öppet**: den som har länken går in utan att knacka. Det är
  hela poängen. En länk ur en kalenderhändelse får Workspace förvalda
  åtkomst, oftast betrodd, och då måste den som inte är inbjuden knacka.
  På ett pass är ingen från Nextrum med för att släppa in, så ett barn på
  skolans Chromebook hade stått utanför en dörr ingen öppnar.
- Svarar Google med ett rum som inte är öppet **sparas länken inte**.
  Vyn säger då att länken kommer i meddelanden, och kortet under
  Integrationer säger varför.
- Länken ligger kvar när passet flyttas. Den visas inte för ett avbokat,
  genomfört eller passerat pass.
- Är Google inte kopplat står det som förut: "Länken kommer i
  meddelanden" hos familjen, "Skicka länken i meddelanden" hos
  studiehjälparen. Ingenting går sönder.

Länken skapas när någon öppnar passet, inte av en trigger. En trigger
hade behövt en kö, ett schema och omförsök, och ett sätt att märka när
den tystnat. Här behövs länken först när någon letar efter den, och då
sitter någon och väntar på svaret. Pass som bekräftades innan Google
kopplades får sin länk nästa gång någon öppnar dem.

### Vad ni gör hos Google (en gång)

Det här går inte att göra härifrån: det kräver någon som är inloggad
hos Google. Menynamnen är de Google använde hösten 2026 och kan ha
flyttat, men stegen är desamma.

1. **Logga in som `info@nextrum.se`** på `console.cloud.google.com`.
   Kontot ska äga rummen: en rollbrevlåda finns kvar när någon slutar,
   och tas kontot som äger rummen bort slutar länkarna fungera.
2. **Skapa ett projekt**, till exempel "Nextrum". Under *Plats* ska det
   stå organisationen **nextrum.se**, inte "Ingen organisation". Utan
   organisationen går steg 4 inte att välja, och då slutar kopplingen
   gälla efter sju dagar.
3. **API:er och tjänster → Bibliotek**: sök **Google Meet REST API** och
   slå på det.
4. **Google Auth Platform** (hette förut *OAuth-samtyckesskärm*): fyll i
   appnamn **Nextrum** och supportadress `info@nextrum.se`, och välj
   målgrupp **Intern**. Intern betyder att bara konton i nextrum.se kan
   godkänna, att Google inte granskar appen och att nyckeln inte går ut.
5. **Google Auth Platform → Klienter → Skapa klient**. Typ
   **Webbapplikation**. Under *Auktoriserade omdirigerings-URI:er*,
   exakt:
   ```
   https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/google-koppla
   ```
   Kopiera **klient-id** och **klienthemlighet**.
6. **Supabase → Edge Functions → Secrets**: lägg in
   ```
   GOOGLE_KLIENT_ID          klient-id från steg 5
   GOOGLE_KLIENT_HEMLIGHET   klienthemligheten från steg 5
   ```
7. **Adminvyn → System → Integrationer → Koppla Google.** Logga in som
   `info@nextrum.se` och godkänn. Låt rutan för Google Meet vara
   ikryssad; utan den nekas kopplingen.
8. **Prova.** Knappen skapar ett rum och visar länken. Öppna den i ett
   privat fönster, utloggad från Google. Kommer du in utan att knacka
   kommer familjerna också in.

Inga tjänstekonton och inga nyckelfiler. Ett tjänstekonto med domänvid
delegering, som den här filen föreslog förut, hade kunnat uppträda som
varje konto i Workspace, och nya Google Cloud-organisationer stänger av
nyckelfiler som förval. Godkännandet ovan når ett konto och ett scope.

### Om något är rött

Kortet under Integrationer säger vad Google svarade. De vanligaste:

| Kortet säger | Gör så här |
|---|---|
| hör inte till Nextrums Google Workspace | Kopplat med ett privat konto. Koppla igen, inloggad som `info@nextrum.se` |
| rutan för Google Meet var inte ikryssad | Koppla igen och låt rutan vara ikryssad |
| Google Meet REST API är inte påslaget | Steg 3. Vänta en minut, tryck Prova |
| Google känner inte igen klienten | Secrets från steg 6, eller adressen i steg 5, stämmer inte. Den ska vara exakt som ovan |
| skapade rummet som TRUSTED/RESTRICTED | Workspace tillåter inte öppna möten. Google Admin (`admin.google.com`) → Appar → Google Workspace → Google Meet → Meet-säkerhetsinställningar: låt alla med länken gå med, också de som inte är inloggade med ett Google-konto. Tryck Prova |
| Google godtar inte kopplingen längre | Någon har dragit tillbaka åtkomsten, eller ändrat kontot. Kortet står då på Inte kopplad. Koppla igen |

### Vad kortet betyder

`google-meet` och `google-koppla` skriver statusen med `service_role`
(`_delad/google_konto.ts`):

- **Kopplad** betyder att det finns en nyckel. Den sätts när Google
  skickat tillbaka en godkänd kod, och inte annars.
- **Senaste rum skapat** är när ett rum senast skapades, av ett pass
  eller av Prova.
- **Senaste fel** är det senaste Google sa nej till. Ett lyckat rum
  tömmer det.

Går något fel sätts `senaste_fel` och `kopplad` lämnas som den är. En
misslyckad förfrågan betyder inte att kopplingen är borta, och att slå
om till "inte kopplad" vid varje hicka gör statusen oläslig.

Undantaget är när Googles tokenändpunkt svarar `invalid_grant`. Då
finns kopplingen inte längre, och ingenting härifrån kan väcka den.
Nyckeln tas bort, kortet säger **Inte kopplad** och varför. Bara raden
med den nyckel som föll tas bort: har någon hunnit koppla om under
tiden står den nya kvar.

**Koppla från** stänger nyckeln hos Google och tar bort raden. Länkar
som redan skapats fortsätter att fungera; nya pass får ingen länk förrän
någon kopplar igen.

---

## Varför inte kalendern och mejlen

Kortet lovade länge "Kalendern och mejlen". Båda valdes bort
2026-09-25, med skäl:

- **Mejlen går redan från nextrum.se**, genom Resend med domänens
  DKIM (DEPLOY-EPOST.md). Att flytta dem till Gmail-API:t hade gett en
  nyckel som kan skicka som Nextrum, ett sändtak per dygn, och en kö som
  redan fungerar att bygga om.
- **Kalenderinbjudningar** till familjer och studiehjälpare hade blivit
  ännu en ström av mejl, från Google, ovanpå notiserna, och en ny
  inbjudan och en avbokning varje gång ett pass flyttas.
- **Rekryteringsmötet** bokas som förut: tiden och länken skrivs in för
  hand och mejlas till den sökande (Fas 16.1). Kopplingen finns nu, så
  en knapp som skapar mötets länk är en liten ändring den dag någon vill
  ha den.

Ändras beslutet: kalendern kräver scopet
`https://www.googleapis.com/auth/calendar.events`, alltså ett nytt
godkännande under Koppla Google, och sidan i Google Auth Platform ska
få scopet i samma ändring.
