// ============================================================
// NEXTRUM — Edge Function: generate-message
//
// Skriver ett utkast till det korta meddelande som följer med ett
// tidsförslag till familjen. Bara texten — tiden i sig räknas fram
// i webbläsaren av NX.föreslåTider, för det är en sökning med ett
// exakt svar och inget en språkmodell ska gissa sig till.
//
// Säkerhet: samma modell som generate-feedback. Funktionen använder
// INTE service-role. Den vidarebefordrar den inloggade användarens
// Authorization-header till Supabase och kontrollerar att det finns
// en GODKÄND studiehjälparprofil bakom anropet. En inloggad förälder
// kan alltså inte använda den, och ingen utan konto alls.
//
// Ingenting sparas. Utkastet går tillbaka till rutan där hjälparen
// kan ändra det innan det skickas — det ska vara ett förslag, inte
// ett meddelande som redan gått iväg i någons namn.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const MODEL = 'claude-sonnet-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

/* Fri text från klienten går in i prompten. Den kapas, så att ett
   långt fält inte kan användas för att skicka iväg en hel uppsats
   på Nextrums bekostnad. */
function kort(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Saknar Authorization-header, du måste vara inloggad.' }, 401);
    }

    const supa = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    /* Bara godkända studiehjälpare. Kollas mot databasen, inte mot
       något klienten påstår om sig själv. */
    const { data: profil } = await supa
      .from('tutor_profiles')
      .select('id, status')
      .maybeSingle();

    if (!profil || profil.status !== 'approved') {
      return json({ error: 'Bara godkända studiehjälpare kan använda det här.' }, 403);
    }

    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY är inte satt som secret på servern.' }, 500);
    }

    const b = await req.json().catch(() => ({}));
    const elev = kort(b.elev, 60) || 'eleven';
    const datum = kort(b.datum, 40);
    const tid = kort(b.tid, 10);
    const minuter = Math.min(600, Math.max(15, Number(b.minuter) || 60));
    const ämne = kort(b.amne, 80);
    const anteckning = kort(b.anteckning, 400);

    const prompt = `Du hjälper en gymnasieelev som jobbar som studiehjälpare att skriva den korta hälsning som följer med ett tidsförslag till en familj.

Passet: ${elev}${ämne ? ', ' + ämne : ''}${datum ? ', ' + datum : ''}${tid ? ' kl. ' + tid : ''}, ${minuter} minuter.
${anteckning ? `Studiehjälparens egna stödord: """${anteckning}"""` : 'Studiehjälparen har inte skrivit några stödord.'}

Skriv 1–2 meningar på svenska, riktat till familjen. Regler:
- Håll dig till det som står ovan. Hitta inte på vad passet ska handla om, hur det gått tidigare, eller något om elevens nivå.
- Finns inga stödord: skriv en kort, neutral hälsning om den föreslagna tiden och inget mer.
- Upprepa inte datum och klockslag — de står redan bredvid i förslaget.
- Ingen hälsningsfras och ingen signatur, bara meningarna.
- Vänligt och rakt, inte formellt skolspråk.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return json({ error: 'AI-anropet misslyckades: ' + (await aiRes.text()) }, 502);
    }

    const aiJson = await aiRes.json();
    const text = aiJson?.content?.[0]?.text?.trim();
    if (!text) return json({ error: 'Fick inget svar från AI:n.' }, 502);

    return json({ text }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
