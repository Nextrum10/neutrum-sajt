// ============================================================
// NEXTRUM — Edge Function: generate-feedback
//
// Tar en lektionsrapports id, hämtar lärarens råa anteckningar,
// skickar dem till Claude, sparar den polerade återkopplingen i
// lesson_reports.ai_feedback. Körs på Supabases servrar, inte i
// webbläsaren, det är hela poängen: ANTHROPIC_API_KEY syns aldrig
// för någon användare.
//
// Säkerhet: funktionen använder INTE service-role-nyckeln. Den
// vidarebefordrar bara den inloggade lärarens egen Authorization-
// header till Supabase, så samma RLS-regler som gäller i appen
// gäller här. En lärare kan bara generera feedback för sina egna
// rapporter, exakt som databasen redan garanterar.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Kolla https://docs.claude.com/en/docs/about-claude/models för det
// senaste modellnamnet om det här börjar ge fel, modellnamn ändras
// över tid.
const MODEL = 'claude-sonnet-4-5';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY är inte satt som secret på servern.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Saknar Authorization-header, du måste vara inloggad.' }, 401);
    }

    // Agerar SOM den inloggade läraren, inte som admin. RLS gäller.
    const supa = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { report_id } = await req.json();
    if (!report_id) return json({ error: 'report_id saknas i anropet.' }, 400);

    const { data: report, error: readErr } = await supa
      .from('lesson_reports')
      .select('id, raw_notes, student_id, students ( name, grade )')
      .eq('id', report_id)
      .single();

    if (readErr || !report) {
      return json({ error: 'Hittar ingen rapport, eller så saknar du behörighet till den.' }, 404);
    }

    const student = (report as any).students;
    const studentName = student?.name || 'eleven';
    const grade = student?.grade ? ` (${student.grade})` : '';

    const prompt = `Du hjälper en gymnasieelev som jobbar som läxhjälpare att skriva en tydlig, varm lektionsrapport till en förälder.

Elev: ${studentName}${grade}
Lärarens råa anteckningar efter lektionen:
"""
${report.raw_notes}
"""

Skriv om detta till 3–5 korta meningar på svenska, riktat till föräldern. Regler:
- Använd BARA det som faktiskt står i anteckningarna ovan. Hitta inte på detaljer, delmoment eller framsteg som inte nämnts.
- Om anteckningarna är korta eller vaga, håll återkopplingen lika kort och vag, gissa inte för att fylla ut.
- Skriv varmt och konkret, inte generiskt skolspråk.
- Ingen hälsningsfras som "Hej", gå rakt in i innehållet.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({ error: 'AI-anropet misslyckades: ' + errText }, 502);
    }

    const aiJson = await aiRes.json();
    const feedback = aiJson?.content?.[0]?.text?.trim();
    if (!feedback) return json({ error: 'Fick inget svar från AI:n.' }, 502);

    const { error: writeErr } = await supa
      .from('lesson_reports')
      .update({ ai_feedback: feedback })
      .eq('id', report_id);

    if (writeErr) return json({ error: 'Kunde inte spara återkopplingen: ' + writeErr.message }, 500);

    return json({ ai_feedback: feedback }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
