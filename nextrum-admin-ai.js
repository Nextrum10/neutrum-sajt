/* ============================================================
   NEXTRUM — adminvyn, AI: drift-agenten och förslagskön (Fas 8)

   Två flikar under Agenter.

   DRIFT är den tredje agenten. Den läser verksamhetens eget läge och
   föreslår vad som behöver göras. Den har med flit inget utgående
   verktyg, och talar med databasen genom en enda dörr som ägs av en
   roll utan tabellrättigheter — försöker den skriva någon annanstans
   svarar databasen nej, inte koden.

   FÖRSLAG är kön av det AI:n vill göra. Och här är skillnaden mot
   en uppgift, som är värd att förstå innan man trycker:

     en uppgift säger vad NÅGON ska göra, i fri text
     ett förslag är en åtgärd SYSTEMET utför när du säger ja

   Trycker du Godkänn körs godkann_forslag() med din inloggning.
   Samma triggrar, samma auditlogg och samma skydd som när du själv
   klickar i vyn — det är därför godkännandet ligger i databasen och
   inte i en edge-funktion med service_role.

   Ett avvisat förslag kommer inte tillbaka. Nyckeln bär paret, så
   beslutet står: "inte den här hjälparen till det här barnet".

   En del av adminvyn, laddas efter kärnan och registrerar sig i
   NXAdmin.rita. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, rensa, felText } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;

  const { S, kortDatum, elevNamn, märkFlik, namnFör, pill, tabell } = NXAdmin;

  const FORSLAG_LAGE = {
    foreslagen: ['Väntar', 'ar-ny'],
    utford:     ['Utförd', 'ar-klar'],
    avvisad:    ['Avvisad', '']
  };

  const FORSLAG_TYP = {
    matchning: 'Matchning',
    pass_ej_fakturerbart: 'Pass utan fakturering',
    lead_status: 'Nytt läge på anmälan'
  };

  /* ------------------------------------------------------------
     FÖRSLAGEN
     ------------------------------------------------------------ */
  async function hämtaFörslag() {
    const { data, error } = await supa.from('ai_forslag')
      .select('*').order('skapad', { ascending: false }).limit(200);
    S.forslagFel = error ? felText(error) : null;
    S.forslag = data || [];
  }

  /* Vad förslaget gäller, i klartext. Databasen svarar med id:n —
     namnen slås upp här, av samma skäl som i matchningen: svensk
     gränssnittstext hör inte hemma i en tabell, och AI:n ska inte få
     namnen bara för att vyn behöver dem. */
  function förslagetGäller(f) {
    const p = f.payload || {};
    if (f.typ === 'matchning') {
      const elev = elevNamn(p.elev_id);
      const hj = p.studiehjalpare_id ? namnFör(p.studiehjalpare_id) : null;
      return [elev && elev !== '—' ? elev : 'Okänd elev',
              hj && hj !== '—' ? hj : 'okänd studiehjälpare'].join(' → ');
    }
    if (f.typ === 'pass_ej_fakturerbart') {
      return 'Pass ' + String(p.pass_id || '').slice(0, 8);
    }
    if (f.typ === 'lead_status') {
      return 'Anmälan ' + String(p.lead_id || '').slice(0, 8) + ' → ' + esc(p.status || '?');
    }
    return '—';
  }

  function ritaFörslag() {
    const host = $('#forslag-tabell');
    if (!host) return;

    if (S.forslagFel) {
      host.innerHTML = '<div class="empty"><b>Förslagen kunde inte hämtas</b><br><span>'
        + esc(S.forslagFel) + '</span></div>';
      return;
    }

    const filter = ($('#forslag-filter') || {}).value || 'oppna';
    const alla = S.forslag || [];
    const rader = filter === 'oppna' ? alla.filter(f => f.status === 'foreslagen') : alla;

    const väntar = alla.filter(f => f.status === 'foreslagen').length;
    märkFlik('#flik-forslag-mark', väntar);
    const antal = $('#forslag-antal');
    if (antal) antal.textContent = rader.length ? rader.length + ' st' : '';

    host.innerHTML = tabell([
      { namn: 'Vad', rita: f => '<b>' + esc(FORSLAG_TYP[f.typ] || f.typ) + '</b>'
        + '<span class="adm-und">' + esc(förslagetGäller(f)) + '</span>' },
      { namn: 'Varför', rita: f => f.motivering
        ? '<span class="adm-und">' + esc(String(f.motivering).slice(0, 240)) + '</span>'
        : '<span class="adm-und">AI:n skrev ingen motivering.</span>' },
      { namn: 'Kom', rita: f => esc(f.skapad ? kortDatum(f.skapad) : '—') },
      { namn: 'Läge', rita: f => {
        const l = FORSLAG_LAGE[f.status] || [f.status, ''];
        return pill(l[0], l[1])
          + (f.beslutad_av ? '<span class="adm-und">' + esc(namnFör(f.beslutad_av)) + '</span>' : '')
          + (f.status === 'avvisad' && f.fel
            ? '<span class="adm-und">' + esc(String(f.fel).slice(0, 120)) + '</span>' : '');
      } },
      { namn: '', höger: true, rita: f => f.status !== 'foreslagen' ? ''
        : '<button class="btn btn-ghost btn-sm" type="button" data-forslag-avvisa="' + esc(f.id) + '">Avvisa</button>'
          + ' <button class="btn btn-primary btn-sm" type="button" data-forslag-ja="' + esc(f.id) + '">Godkänn</button>' }
    ], rader, filter === 'oppna'
      ? 'Inga förslag väntar på svar'
      : 'AI:n har inte föreslagit något än');
  }

  async function ritaAI() {
    await hämtaFörslag();
    ritaFörslag();
  }

  const forslagFilter = $('#forslag-filter');
  if (forslagFilter) forslagFilter.addEventListener('change', ritaFörslag);

  const forslagFlik = $('#flik-ag-forslag');
  if (forslagFlik) forslagFlik.addEventListener('click', ritaAI);

  /* ------------------------------------------------------------
     JA ELLER NEJ

     Båda går genom databasen, med adminens egen inloggning. Svaret
     från godkann_forslag är antingen ett utfört förslag eller ett
     fel som säger varför — till exempel att studiehjälparen inte är
     godkänd längre. Då har ingenting hänt: funktionen rullar tillbaka
     allt den gjort.
     ------------------------------------------------------------ */
  document.addEventListener('click', async e => {
    const ja = e.target.closest('[data-forslag-ja]');
    const nej = e.target.closest('[data-forslag-avvisa]');
    if (!ja && !nej) return;

    const id = (ja || nej).dataset[ja ? 'forslagJa' : 'forslagAvvisa'];
    const f = (S.forslag || []).find(x => x.id === id);
    if (!f) return;
    const msg = $('#forslag-msg');
    rensa(msg);

    const svar = await bekräfta(ja ? {
      titel: 'Godkänn: ' + (FORSLAG_TYP[f.typ] || f.typ) + '?',
      text: förslagetGäller(f) + '. Systemet utför det med din inloggning, och det syns i '
        + 'auditloggen som din ändring.',
      knapp: 'Godkänn'
    } : {
      titel: 'Avvisa förslaget?',
      text: 'Det kommer inte tillbaka: AI:n föreslår inte samma sak igen.',
      knapp: 'Avvisa'
    });
    if (!svar) return;

    await medan(ja || nej, ja ? 'Utför…' : 'Avvisar…', async () => {
      const { data, error } = ja
        ? await supa.rpc('godkann_forslag', { p_id: id })
        : await supa.rpc('avvisa_forslag', { p_id: id, p_anledning: null });

      if (error) { säg(msg, 'Det gick inte: ' + felText(error), false); return; }

      säg(msg, ja
        ? '✓ Utfört. ' + (data && data.typ === 'matchning'
          ? 'Eleven och studiehjälparen ser varandra nu.' : '')
        : '✓ Avvisat.', true);

      /* Hela läget hämtas om: ett godkänt matchningsförslag ändrar
         elever, matchning och översikten, och den som just tryckte
         ska se det utan att ladda om sidan. */
      await NXAdmin.hämtaAllt();
      await ritaAI();
      if (NXAdmin.rita.ritaMatchning) NXAdmin.rita.ritaMatchning();
      if (NXAdmin.rita.ritaElever) NXAdmin.rita.ritaElever();
      if (NXAdmin.rita.ritaÖversikt) await NXAdmin.rita.ritaÖversikt();
    });
  });

  /* ------------------------------------------------------------
     DRIFT-AGENTEN

     Självtestet kör alla läsverktygen utan att röra modellen. Det
     visar två saker: att dörren svarar, och VILKA FÄLT den lämnar
     ut — det är den kontrollen som säger att inga namn följer med.
     ------------------------------------------------------------ */
  function svarFrånFel(error, data) {
    /* invoke ger error på allt som inte är 2xx, men funktionen lägger
       sin förklaring i svarskroppen. */
    if (error && error.context && typeof error.context.json === 'function') {
      return error.context.json().then(k => k, () => null);
    }
    return Promise.resolve(data);
  }

  const sjalvtest = $('#drift-sjalvtest');
  if (sjalvtest) sjalvtest.addEventListener('click', async () => {
    const ut = $('#drift-sjalvtest-ut');
    await medan(sjalvtest, 'Kör…', async () => {
      ut.innerHTML = laddar('Kör läsverktygen');
      const res = await supa.functions.invoke('drift', { body: { sjalvtest: true } });
      const svar = await svarFrånFel(res.error, res.data);
      if (!svar || svar.error) {
        ut.innerHTML = '<div class="empty"><b>Självtestet gick inte</b><br><span>'
          + esc((svar && svar.error) || felText(res.error)) + '</span></div>';
        return;
      }

      const rader = ['nya_leads', 'omatchade_elever', 'kommande_pass', 'saknade_rapporter']
        .map(namn => {
          const r = svar[namn] || {};
          if (r.fel) {
            return '<div class="dp-rad"><div><b>' + esc(namn) + '</b><span>'
              + esc(r.fel) + '</span></div></div>';
          }
          return '<div class="dp-rad"><div><b>' + esc(namn) + '</b>'
            + '<span>' + r.rader + (r.rader === 1 ? ' rad' : ' rader')
            + (r.falt && r.falt.length ? ' · fält: ' + esc(r.falt.join(', ')) : '')
            + '</span></div></div>';
        });

      ut.innerHTML = '<div style="margin:10px 0">'
        + '<p class="xsmall">' + (svar.nyckel_satt
          ? 'ANTHROPIC_API_KEY är satt. Agenten går att fråga.'
          : 'ANTHROPIC_API_KEY är inte satt, så själva frågan går inte att ställa än. '
            + 'Läsvägen nedan fungerar ändå.') + '</p>'
        + rader.join('') + '</div>';
    });
  });

  const driftKor = $('#drift-kor');
  if (driftKor) driftKor.addEventListener('click', async () => {
    const msg = $('#drift-msg');
    const ut = $('#drift-svar');
    rensa(msg);
    const fraga = ($('#drift-fraga') || {}).value ? $('#drift-fraga').value.trim() : '';
    if (!fraga) { säg(msg, 'Skriv en fråga först.', false); return; }

    await medan(driftKor, 'Tänker…', async () => {
      ut.innerHTML = laddar('Agenten läser läget');
      const res = await supa.functions.invoke('drift', { body: { fraga } });
      const svar = await svarFrånFel(res.error, res.data);

      if (!svar || svar.error) {
        ut.innerHTML = '';
        säg(msg, (svar && svar.error) || felText(res.error), false);
        return;
      }

      ut.innerHTML = '<div class="ag-svar">'
        + (typeof NXAgent !== 'undefined' && NXAgent.formatera
          ? NXAgent.formatera(svar.svar || '')
          : '<p>' + esc(svar.svar || '') + '</p>')
        + '<p class="xsmall" style="margin-top:10px;color:var(--bl-3)">'
        + esc(svar.pafyllnad || '') + ' · ' + (svar.steg || 0) + ' steg</p></div>';

      /* Agenten kan ha lämnat förslag under körningen. Kön hämtas om
         så att de syns direkt, utan att någon behöver veta att de
         hamnade i en annan flik. */
      await ritaAI();
    });
  });

  Object.assign(NXAdmin.rita, { ritaAI, ritaFörslag });
})();
