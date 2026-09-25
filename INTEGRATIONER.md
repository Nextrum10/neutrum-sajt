# Google Workspace

Adminsidan har en flik som heter **System → Integrationer**. Den visar om
Google Workspace är kopplat. Just nu är svaret nej, och det står så.

Fortnox stod här till Fas 14.8. Bokföringen och fakturorna sköts i
**Wint**, och Wint är med flit inte kopplat alls (se nedan).

Den här filen säger vad som saknas och varför det inte går att klicka sig
fram till det.

---

## Varför det inte finns en "Koppla"-knapp

Kopplingen kräver en **klienthemlighet**. En hemlighet som webbläsaren
kan läsa är ingen hemlighet — den ligger då hos varenda person som öppnar
sidan, inklusive den som öppnar utvecklarverktygen.

Alltså:

- Nycklarna sätts som **secrets på en edge-funktion** i Supabase. Dit når
  ingen webbläsare.
- Tabellen `integrationer` (schema-v13.sql) innehåller **bara status**: om
  det är kopplat, mot vilket konto, när synken kördes och vad den sa.
- Tabellen har medvetet **ingen skrivpolicy alls**. Raderna sätts av
  edge-funktionen med `service_role`, som går förbi RLS. Kan ingen skriva
  från webbläsaren kan ingen få något att *se* kopplat ut som inte är det.

Adminsidan rapporterar. Den kopplar inte.

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

## Google Workspace — kalender och mejl

### Vad kopplingen ska göra

- **Kalender.** Ett bekräftat pass blir en händelse hos både familjen och
  studiehjälparen, med Meet-länk om formatet är online. Avbokas passet
  försvinner händelsen.
- **Mejl.** Underlagen och notiserna går från en riktig adress
  (`info@nextrum.se`) i stället för en no-reply hos någon annan.

### Vad ni behöver skaffa

1. Ett **Google Cloud-projekt** med **Calendar API** och **Gmail API**
   påslagna.
2. Ett **tjänstekonto** med **domänvid delegering** (domain-wide
   delegation), godkänt i Google Workspace Admin under
   *Säkerhet → API-kontroller → Domänvid delegering*.
3. Scopes:
   ```
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/gmail.send
   ```

### Vad som ska bli secrets

```
GOOGLE_TJANSTEKONTO_JSON     (hela nyckelfilen, som en sträng)
GOOGLE_DELEGERAD_ANVANDARE   (t.ex. info@nextrum.se)
```

### Den viktiga begränsningen

Tjänstekontot får bara skriva i kalendrar inom **er egen domän**. En familj
med en privat Gmail-adress är inte i er domän, så deras kalender kan ni inte
skriva i utan att de själva loggar in och godkänner det (vanlig OAuth med
samtycke, en helt annan sak än tjänstekonto).

Praktiskt betyder det:

- **Studiehjälparen** kan få händelser direkt, om ni ger dem
  Workspace-konton.
- **Familjen** får en `.ics`-inbjudan i mejlet i stället. Den fungerar i
  alla kalendrar och kräver inget konto hos er.

Bygg det andra först. Det är det som gäller de flesta, och det kräver inget
utöver Gmail-scopet.

### Redan skrivet

`GOOGLE.md` beskriver Google-uppsättningen för sajtens övriga delar. Läs den
först — projekt och behörigheter är delvis samma sak.

---

## När något är kopplat

Edge-funktionen skriver, med `service_role`:

```sql
update public.integrationer
   set kopplad = true,
       konto = 'info@nextrum.se',
       kopplad_at = now(),
       senaste_synk = now(),
       senaste_fel = null,
       uppdaterad = now()
 where tjanst = 'google_workspace';
```

Går en synk fel: lämna `kopplad` som den är och sätt `senaste_fel`. En
misslyckad synk betyder inte att kopplingen är borta, och att sätta
`kopplad = false` vid varje hicka gör statusen oläsbar.

Adminsidan läser raden och visar den. Den gissar aldrig.
