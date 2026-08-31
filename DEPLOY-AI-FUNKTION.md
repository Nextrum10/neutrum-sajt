# Sätta upp AI-återkoppling (generate-feedback)

Detta är det mest tekniska steget hittills. Gör det när du ändå sitter vid datorn
med lite tid, inte mellan två andra saker. Kräver att du har Node.js installerat
(samma sak npm/npx kommer från, om `npx --version` funkar i terminalen har du det).

## 1. Installera Supabase CLI

I terminalen:

```
npm install -g supabase
```

## 2. Logga in och koppla till ditt projekt

```
supabase login
```

Öppnar webbläsaren för att godkänna. Sen, i mappen där du har `supabase/`-katalogen
(den jag skickade med `generate-feedback`-funktionen i):

```
supabase link --project-ref DITT-PROJEKT-ID
```

Projekt-ID:t hittar du i Supabase-projektets URL, eller under Project Settings →
General → "Reference ID".

## 3. Skaffa en Anthropic API-nyckel

Gå till console.anthropic.com, skapa konto om du inte har, skapa en API-nyckel under
"API Keys". Den kostar inget att skapa, du betalar per anrop ni faktiskt gör (grovt
uppskattat en bråkdel av en krona per lektionsrapport, försumbart i er skala).

## 4. Lägg in nyckeln som en hemlighet (aldrig i koden)

```
supabase secrets set ANTHROPIC_API_KEY=din-nyckel-här
```

## 5. Deploya funktionen

```
supabase functions deploy generate-feedback
```

Klart. Funktionen finns nu på:
`https://DITT-PROJEKT-ID.supabase.co/functions/v1/generate-feedback`

## 6. Testa att den funkar

Enklast: skapa en testrad i `lesson_reports` via Table Editor (behöver en `student_id`
som finns i `students`, och `tutor_id` = ditt eget konto-id). Sen, i webbläsarens
konsol på sidan (medan du är inloggad som den läraren):

```js
const { data, error } = await supa.functions.invoke('generate-feedback', {
  body: { report_id: 'ID-PÅ-DIN-TESTRAD' }
});
console.log(data, error);
```

Om det fungerar får du tillbaka `{ ai_feedback: "..." }`, och raden i `lesson_reports`
har uppdaterats med den polerade texten.

## Om något strular

- **"function not found"** → deploy misslyckades eller fel projekt länkat, kör
  `supabase link` igen.
- **"ANTHROPIC_API_KEY är inte satt"** → secret sattes aldrig, eller sattes innan
  du länkade rätt projekt. Kör steg 4 igen.
- **"Hittar ingen rapport, eller så saknar du behörighet"** → du testar med ett
  konto som inte är `tutor_id` på den raden. Kontrollera i Table Editor.
- Fel modellnamn (AI-anropet svarar med fel om modellen inte finns) → öppna
  `supabase/functions/generate-feedback/index.ts`, byt värdet på `MODEL` mot ett
  giltigt namn från docs.claude.com/en/docs/about-claude/models, deploya om.

## Vad som saknas efter detta

Funktionen finns och går att anropa, men själva knappen "generera återkoppling" i
lärarens gränssnitt är inte byggd än, det är nästa steg när vi bygger lärar- och
föräldravyerna på riktigt.
