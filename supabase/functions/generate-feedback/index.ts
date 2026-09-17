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

import { json, preflight } from '../_delad/http.ts';
import { arAdmin, kravInloggad } from '../_delad/auth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// Kolla https://docs.claude.com/en/docs/about-claude/models för det
// senaste modellnamnet om det här börjar ge fel, modellnamn ändras
// över tid.
const MODEL = 'claude-sonnet-5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY är inte satt som secret på servern.' }, 500);
    }

    // Agerar SOM den inloggade läraren, inte som admin. RLS gäller.
    const vem = await kravInloggad(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;
    const supa = vem.klient;

    const { report_id } = await req.json();
    if (!report_id) return json({ error: 'report_id saknas i anropet.' }, 400);

    const { data: report, error: readErr } = await supa
      .from('lesson_reports')
      .select('id, raw_notes, student_id, tutor_id, students ( name, grade )')
      .eq('id', report_id)
      .single();

    if (readErr || !report) {
      return json({ error: 'Hittar ingen rapport, eller så saknar du behörighet till den.' }, 404);
    }

    /* Att få LÄSA rapporten räcker inte. Familjen läser sitt barns
       rapporter, och fick därför förr starta AI-anropet på Nextrums
       bekostnad — det var bara sparandet som sedan inte träffade
       någon rad. Rapportens egen studiehjälpare, eller admin
       (återkopplingsfliken i adminvyn), är de enda som skriver här. */
    if (report.tutor_id !== vem.anvandare && !await arAdmin(supa, vem.anvandare)) {
      return json({ error: 'Bara rapportens studiehjälpare kan skriva om den.' }, 403);
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
