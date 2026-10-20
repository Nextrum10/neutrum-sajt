// ============================================================
// NEXTRUM — delad hjälp: korta AI-svar utan verktyg
//
// generate-feedback, generate-message och material-forslag skickar en
// prompt och vill ha en text tillbaka. De läste förut content[0].text
// och litade på att första blocket var svaret.
//
// Det slutade gälla med Sonnet 5.5 (2026-10-21): modellen tänker först
// som förval, på high, så första blocket kan vara ett tankeblock, och
// tänkandet äter av max_tokens. Ett rakt byte av modellsträngen hade
// gett "Fick inget svar" eller en halv mening till en förälder.
//
// Därför två saker här, som de tre delar:
//   - between_tools stänger av tänkandet i förväg. Inga verktyg, alltså
//     inget tänkande alls. Det här är omskrivning, inte resonemang.
//   - svarstext() läser bara textblocken, och ett avhugget svar är
//     inget svar (samma regel som motorn i agent.ts).
// ============================================================

export type Anstrangning = 'low' | 'medium' | 'high';

/** Fälten som går in i anropet bredvid model, max_tokens och messages. */
export function kortaSvar(anstrangning: Anstrangning = 'low') {
  return {
    thinking: { type: 'between_tools' },
    output_config: { effort: anstrangning },
  };
}

/** Svarets text, eller null om det inte finns något helt svar att visa. */
// deno-lint-ignore no-explicit-any
export function svarstext(svar: any): string | null {
  if (!svar || svar.stop_reason === 'max_tokens' || svar.stop_reason === 'refusal') return null;
  const block = Array.isArray(svar.content) ? svar.content : [];
  const text = block
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join('')
    .trim();
  return text || null;
}
