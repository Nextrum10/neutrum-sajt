// ============================================================
// NEXTRUM — Edge Function: notis-mejl
//
// Mejlar mottagaren när en notis läggs i public.notiser.
//
//
// VARFÖR EN TABELL OCH INTE FEM FUNKTIONER
//
// Notiserna fanns förut bara i webbläsaren: larare-vy och studie-vy
// räknade själva fram "3 pass att bekräfta" ur bokningarna vid varje
// sidladdning. Det syns för den som loggar in — och bara för den.
// Vid sidan om låg pass-notis och meddelande-notis, två funktioner
// som mejlade var sin händelse med var sin kopia av brevmallen, och
// täckte två av de fem notiser vyerna visar. En familj som föreslogs
// en tid fick mejl; en studiehjälpare som FICK ett önskemål fick
// inget, och såg det först nästa gång hen loggade in.
//
// Nu är en notis en rad. Triggern som skapar raden bestämmer ATT
// något hänt och till vem; den här funktionen bestämmer hur det
// låter. Nästa notistyp är ett fall i TEXTER nedan och en trigger —
// ingen ny funktion, ingen ny webhook, ingen ny hemlighet.
//
//
// RADEN ÄGER SANNINGEN, INTE MEJLET
//
// Går utskicket fel ligger notisen kvar med mejlad_at = null. Den
// syns i vyn ändå, och går att skicka om. Det omvända — att mejlet
// är det enda spåret — är hur en avisering försvinner tyst.
//
//
// INGEN MEDDELANDETEXT I MEJLET
//
// Samma regel som meddelande-notis hade: notisen säger ATT något
// kommit och vad det gäller, aldrig vad som står. Innehållet kan
// gälla ett barns skolgång, och ett mejl passerar servrar vi inte
// styr över och ligger kvar i inkorgar vi inte kontrollerar. Den
// som vill läsa loggar in. Därför skickar triggern heller inte med
// brödtexten i data — den finns inte att läcka.
// ============================================================

import { CORS, json, db, hemlighetOk, skickaMejl } from '../_delad/notis.ts';
import { brev, SAJT } from '../_delad/mall.ts';
import { MANADER } from '../_delad/konstanter.ts';

/* Två notiser av samma slag till samma person inom en timme blir
   ett mejl. En chatt är korta repliker, och den som får fem mejl på
   tre minuter slutar läsa det sjätte. Notiserna ligger kvar allihop
   i vyn — det är bara aviseringen som hålls tillbaka. */
const TYST_MINUTER = 60;

type Data = Record<string, unknown>;

const s = (d: Data, n: string): string => String(d[n] ?? '').trim();

function datumText(iso: string): string {
  const [, m, d] = String(iso).split('-');
  return `${Number(d)} ${MANADER[Number(m) - 1] ?? ''}`;
}

/** "14 oktober kl. 16:00", eller bara datumet om tid saknas. */
function nar(d: Data): string {
  const datum = s(d, 'datum');
  if (!datum) return '';
  const tid = s(d, 'tid');
  return datumText(datum) + (tid ? ` kl. ${tid.slice(0, 5)}` : '');
}

/** Första namnet. "Hej Anna" är ett tilltal; "Hej Anna Svensson" är ett register. */
function tilltal(helaNamnet: string | null | undefined): string {
  const f = String(helaNamnet ?? '').trim().split(/\s+/)[0];
  return f ? `Hej ${f},` : 'Hej,';
}

type Brevtext = {
  amne: string;
  rubrik: string;
  stycken: string[];
  fakta?: [string, string][];
  knappText: string;
  efterord?: string;
};

/* ============================================================
   VAD VARJE NOTIS SÄGER

   All text som når en mottagare står här, i ett fall per typ. Det
   är med flit: den som vill ändra tonen ska kunna göra det på ett
   ställe utan att öppna vare sig SQL eller två vyfiler.

   Reglerna för tonen, om någon skriver ett nytt fall:
     · tilltal med förnamn, aldrig "Hej kund" eller "Bäste förälder"
     · säg vad som hänt och varför det angår mottagaren nu
     · en uppmaning, inte tre
     · ingen brödtext ur meddelanden eller rapporter
   ============================================================ */
const TEXTER: Record<string, (d: Data, namn: string, motpart: string) => Brevtext> = {

  /* Studiehjälparen har föreslagit en tid. Familjen ska svara. */
  pass_forslag: (d, namn, motpart) => ({
    amne: `Ny tid föreslagen: ${nar(d) || 'ett pass'}`,
    rubrik: 'Ni har fått ett tidsförslag',
    stycken: [
      tilltal(namn),
      `${motpart} har föreslagit en tid för nästa pass. Ni hittar förslaget i studievyn, `
        + `och där svarar ni ja eller nej med ett klick.`,
      `Tiden står bokad hos ${motpart} tills ni har svarat, så säg gärna till även om den `
        + `inte passar — då frigörs den för någon annan och ni får ett nytt förslag i stället.`,
    ],
    fakta: [
      ['När', nar(d)],
      ['För', s(d, 'elev')],
      ['Ämne', s(d, 'amne')],
      ['Upplägg', s(d, 'format')],
      ['Plats', s(d, 'plats')],
      ['Längd', s(d, 'langd') ? `${s(d, 'langd')} minuter` : ''],
    ],
    knappText: 'Svara på förslaget',
  }),

  /* Familjen har önskat en tid. Studiehjälparen ska bekräfta.
     Den här riktningen mejlades inte alls förut. */
  pass_onskemal: (d, namn, motpart) => ({
    amne: `Ny förfrågan: ${nar(d) || 'ett pass'}`,
    rubrik: 'En familj har önskat en tid',
    stycken: [
      tilltal(namn),
      `${motpart} har önskat ett pass hos dig. Förfrågan ligger i din vy och väntar på att `
        + `du bekräftar eller tackar nej.`,
      `Svara gärna samma dag, även om svaret är nej. Familjen ser tiden som obesvarad tills `
        + `du rört den, och planerar inte in något annat under tiden.`,
    ],
    fakta: [
      ['När', nar(d)],
      ['Elev', s(d, 'elev')],
      ['Ämne', s(d, 'amne')],
      ['Upplägg', s(d, 'format')],
      ['Plats', s(d, 'plats')],
      ['Längd', s(d, 'langd') ? `${s(d, 'langd')} minuter` : ''],
    ],
    knappText: 'Öppna förfrågan',
  }),

  /* Nytt meddelande i tråden. Aldrig med texten. */
  meddelande: (_d, namn, motpart) => ({
    amne: `Nytt meddelande från ${motpart}`,
    rubrik: 'Du har ett nytt meddelande',
    stycken: [
      tilltal(namn),
      `${motpart} har skrivit till dig i Nextrum. Meddelandet ligger i din vy, och du `
        + `svarar i samma ruta.`,
      `Själva texten står bara där, inte i det här mejlet. Det som skrivs mellan en familj `
        + `och en studiehjälpare kan handla om ett barns skolgång, och sådant ska inte bli `
        + `liggande i en inkorg.`,
    ],
    knappText: 'Läs och svara',
  }),

  /* Rapporten efter ett pass. Sammanfattningen, aldrig texten. */
  rapport: (d, namn, motpart) => ({
    amne: `Rapporten från passet ${nar(d) || 'är klar'}`,
    rubrik: 'Rapporten från passet är klar',
    stycken: [
      tilltal(namn),
      `${motpart} har skrivit klart rapporten från passet${nar(d) ? ' den ' + nar(d) : ''}. `
        + `Den beskriver vad ni gick igenom, hur det gick och vad som är nästa steg.`,
      `Rapporten ligger i studievyn tillsammans med alla tidigare. Läser ni dem i följd ser `
        + `ni utvecklingen mellan passen, inte bara det senaste tillfället.`,
    ],
    fakta: [
      ['Pass', nar(d)],
      ['Elev', s(d, 'elev')],
      ['Ämne', s(d, 'amne')],
    ],
    knappText: 'Läs rapporten',
  }),

  /* Ny läxa eller uppgift till nästa gång. */
  laxa: (d, namn, motpart) => ({
    amne: s(d, 'forfaller')
      ? `Ny uppgift till ${datumText(s(d, 'forfaller'))}`
      : 'Ny uppgift i studievyn',
    rubrik: 'Du har fått en ny uppgift',
    stycken: [
      tilltal(namn),
      `${motpart} har lagt in en uppgift att göra till nästa pass. Den ligger i studievyn, `
        + `och där kryssar du av den när den är klar.`,
      `Uppgifterna mellan passen är det som gör att nästa timme kan gå vidare i stället för `
        + `att börja om. Fastnar du är det ingen fara — skriv en rad till ${motpart} så tar `
        + `ni det tillsammans.`,
    ],
    fakta: [
      ['Uppgift', s(d, 'titel')],
      ['Ämne', s(d, 'amne')],
      ['Klar senast', s(d, 'forfaller') ? datumText(s(d, 'forfaller')) : ''],
    ],
    knappText: 'Öppna uppgiften',
  }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const klient = db();
    if (!await hemlighetOk(req, klient)) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }

    const kropp = await req.json();
    const n = kropp?.record;
    if (!n) return json({ error: 'Ingen record i webhook-anropet.' }, 400);
    if (!n.mottagare || !n.typ) return json({ hoppade_over: 'Raden saknar mottagare eller typ.' }, 200);

    const mall = TEXTER[String(n.typ)];
    if (!mall) return json({ hoppade_over: `Okänd notistyp: ${n.typ}` }, 200);

    /* Har mottagaren redan fått ett mejl av samma slag nyss? Räknas
       på mejlad_at, inte på skapad — det är utskicken som ska hållas
       tillbaka, och en notis som aldrig mejlades ska inte tysta
       nästa. */
    const sedan = new Date(Date.now() - TYST_MINUTER * 60_000).toISOString();
    const { count } = await klient
      .from('notiser')
      .select('id', { count: 'exact', head: true })
      .eq('mottagare', n.mottagare)
      .eq('typ', n.typ)
      .neq('id', n.id)
      .gte('mejlad_at', sedan);

    if ((count ?? 0) > 0) {
      return json({ hoppade_over: `Mejl av typen ${n.typ} skickat inom ${TYST_MINUTER} minuter.` }, 200);
    }

    const { data: mottagare } = await klient
      .from('profiles').select('email, full_name, role').eq('id', n.mottagare).maybeSingle();

    const adress = mottagare?.email;
    if (!adress) return json({ error: 'Mottagaren har ingen e-postadress.' }, 422);

    const data: Data = (n.data ?? {}) as Data;
    const motpart = s(data, 'fran') || (mottagare?.role === 'tutor' ? 'En familj' : 'Er studiehjälpare');

    const t = mall(data, mottagare?.full_name ?? '', motpart);

    /* Länken går till vyn, inte till en adress som kräver att man
       redan är inloggad för att betyda något. Är man utloggad möter
       inloggningen först och ankaret överlever den. */
    const vy = mottagare?.role === 'tutor' ? '/larare' : '/foralder';
    const adressTillNotisen = `${SAJT}${vy}${String(n.mal ?? '')}`;

    const { text, html } = brev({
      rubrik: t.rubrik,
      stycken: t.stycken,
      /* Tomma rader ska inte bli tomma etiketter. */
      fakta: (t.fakta ?? []).filter(([, v]) => v),
      knapp: { text: t.knappText, adress: adressTillNotisen },
      efterord: t.efterord
        ?? 'Du får det här mejlet för att du har en notis i Nextrum som väntar på dig.',
    });

    const svar = await skickaMejl({ till: adress, amne: t.amne, text, html });

    /* Stämpla bara när mejlet faktiskt gick iväg. En rad utan
       mejlad_at är en notis som går att skicka om; en felaktig
       stämpel är en avisering som aldrig kommer och som ingen
       letar efter. */
    if (svar.ok) {
      await klient.from('notiser')
        .update({ mejlad_at: new Date().toISOString() }).eq('id', n.id);
    }
    return svar;
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
