// ============================================================
// NEXTRUM — Edge Function: material-forslag
//
// Föreslår övningsuppgifter som admin kan lägga in som material
// åt en elev.
//
//
// VARFÖR UPPGIFTERNA SKRIVS UT, INTE LÄNKAS
//
// Det naturliga vore att be modellen "hitta uppgifter" — leta rätt
// på ett övningsblad någonstans och ge länken. Det ska den inte
// göra, och det är inte en detalj.
//
// En språkmodell som ombeds hitta en länk hittar PÅ en länk. Den
// ser rimlig ut, den har rätt domän, och den leder ingenstans. Det
// upptäcks först när en elev sitter med läxan på söndagkvällen. Och
// den länk som faktiskt finns kan lika gärna peka på ett låst
// läromedel eller en sida som bytt innehåll sedan dess.
//
// Därför skrivs uppgifterna ut i sin helhet, som text. En uppgift
// modellen formulerar ÄR uppgiften — det finns inget yttre påstående
// att verifiera. Vill man ha en länk lägger man in den för hand;
// formuläret i adminvyn har kvar det valet.
//
// Av samma skäl: inga sidhänvisningar, inga läroboksnamn, inga
// årtal ur minnet. Står det "Matte 5000 s. 142" ska någon kunna slå
// upp s. 142 och hitta det som står här, och det kan ingen lova.
//
//
// SÄKERHET
//
// Bara admin. Funktionen använder INTE service-role: den skickar
// vidare den inloggade användarens Authorization-header och läser
// is_admin ur databasen. En studiehjälpare eller förälder som
// anropar adressen direkt får 403.
//
// Ingenting sparas. Förslagen går tillbaka till formuläret, där de
// ska läsas igenom och ändras innan de blir material hos en elev.
// ============================================================

import { json, preflight } from '../_delad/http.ts';
import { kravAdmin } from '../_delad/auth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const MODEL = 'claude-sonnet-5';

/* Fri text från klienten går in i prompten. Den kapas, så att ett
   långt fält inte kan användas för att skicka iväg en uppsats på
   Nextrums bekostnad. */
function kort(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const vem = await kravAdmin(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY är inte satt som secret på servern.' }, 500);
    }

    const b = await req.json().catch(() => ({}));
    const amne = kort(b.amne, 80);
    const arskurs = kort(b.arskurs, 40);
    const fokus = kort(b.fokus, 400);
    const antal = Math.min(4, Math.max(1, Number(b.antal) || 3));

    if (!amne) return json({ error: 'Ämne måste anges.' }, 400);

    const prompt = `Du tar fram övningsuppgifter som en studiehjälpare ska kunna sätta i handen på en elev vid ett pass.

Ämne: ${amne}
${arskurs ? `Årskurs eller nivå: ${arskurs}` : 'Nivå är inte angiven — lägg dig på grundskolans senare år.'}
${fokus ? `Det eleven behöver öva på: """${fokus}"""` : 'Inget särskilt moment är angivet — välj ett vanligt moment i ämnet.'}

Ge ${antal} uppgifter. Svara med ENBART giltig JSON, ingen text runt omkring, på formen:
[{"titel":"...","uppgift":"..."}]

Regler för innehållet:
- Skriv ut uppgiften i sin helhet. Den som läser ska kunna lösa den direkt, utan att slå upp något.
- Ange ALDRIG en webbadress, ett läromedel, ett sidnummer eller ett nationellt prov som källa. Du kan inte kontrollera att de finns, och en hänvisning som inte stämmer är värre än ingen.
- Facit eller en kort lösningsgång sist i "uppgift", efter raden "Facit:". Studiehjälparen är själv elev och ska kunna rätta.
- Stigande svårighet mellan uppgifterna.
- Titeln är kort och säger vad man övar, till exempel "Ekvationer med parentes".
- Svenska. Inga hälsningsfraser.
- Håll varje uppgift under 900 tecken.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return json({ error: 'AI-anropet misslyckades: ' + (await aiRes.text()) }, 502);
    }

    const aiJson = await aiRes.json();
    const rå = aiJson?.content?.[0]?.text?.trim();
    if (!rå) return json({ error: 'Fick inget svar från AI:n.' }, 502);

    /* Modellen ombeds svara med ren JSON, men en inledande mening
       eller en ```json-ram slinker igenom ibland. Klipp ut det
       första hakparentesparet i stället för att falla på det. */
    const start = rå.indexOf('[');
    const slut = rå.lastIndexOf(']');
    let forslag: unknown;
    try {
      forslag = JSON.parse(start >= 0 && slut > start ? rå.slice(start, slut + 1) : rå);
    } catch {
      return json({ error: 'AI:n svarade inte i det format som efterfrågades.' }, 502);
    }

    if (!Array.isArray(forslag) || !forslag.length) {
      return json({ error: 'AI:n gav inga uppgifter.' }, 502);
    }

    /* Tvätta svaret innan det går tillbaka. Fälten hamnar i en
       databaskolumn med längdgräns, och allt annat modellen råkar
       lägga till kastas. */
    const rena = forslag
      .map((x) => ({
        titel: kort((x as Record<string, unknown>)?.titel, 200),
        uppgift: String((x as Record<string, unknown>)?.uppgift ?? '').trim().slice(0, 4000),
      }))
      .filter((x) => x.titel && x.uppgift)
      .slice(0, antal);

    if (!rena.length) return json({ error: 'AI:n gav inga användbara uppgifter.' }, 502);

    return json({ forslag: rena }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
