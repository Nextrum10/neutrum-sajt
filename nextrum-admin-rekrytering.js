/* ============================================================
   NEXTRUM — adminvyn, Rekrytering: ansökningar, intervju, utbildning, in i poolen

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  const { ANS_LAGE, S, hämtaAllt, hämtaMatchunderlag, kontaktaRuta,
          kortDatum, matchar, tabell, tomtText, väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const kandidater = (...a) => NXAdmin.rita.kandidater(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const standardJobbtjanst = (...a) => NXAdmin.rita.standardJobbtjanst(...a);

  /* ============================================================
     ANSÖKNINGAR
     ============================================================ */

  function ritaAnsokningar() {
    const sök = $('#ans-sok').value.trim();
    const st = $('#ans-status').value;
    const rader = S.ansokningar
      .filter(a => !st || a.status === st)
      .filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = rader.length + ' av ' + S.ansokningar.length;
    $('#ans-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: a => '<b>' + esc(a.name) + '</b>'
        + '<span class="adm-und">' + esc(a.email) + (a.age ? ' · ' + a.age + ' år' : '') + '</span>' },
      { namn: 'Skola', rita: a => esc(a.school || '—') },
      { namn: 'Ämnen', rita: a => esc(a.subjects || '—') },
      { namn: 'Kan jobba', rita: a => esc(a.availability || '—') },
      { namn: 'Varför', rita: a => a.why
        ? '<span title="' + esc(a.why) + '">' + esc(a.why.slice(0, 90))
          + (a.why.length > 90 ? '…' : '') + '</span>'
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Inkom', rita: a => '<span class="adm-tal">' + esc(kortDatum(a.created_at)) + '</span>' },
      /* Rekryteringens fyra steg som ett spår. En tom stämpel säger
         "inte gjort" utan att det behöver vara en egen status, och
         datumet svarar på det man faktiskt undrar: hur länge har det
         här legat still? */
      { namn: 'Steg', rita: a => '<div class="adm-spar">'
        + steg('Kontakt', a.kontaktad_at, 'data-ans-kontakt="' + esc(a.id) + '"')
        + steg('Intervju', a.intervju_at, 'data-ans-steg="intervju:' + esc(a.id) + '"')
        + steg('Utbildad', a.utbildad_at, 'data-ans-steg="utbildad:' + esc(a.id) + '"')
        + '</div>' },
      { namn: 'Läge', höger: true, rita: a => väljare('ans', ANS_LAGE, a.status, 'data-ans="' + a.id + '"')
        /* Vägen in i poolen. Utan den här knappen blir en ansökan
           aldrig en studiehjälpare som går att matcha — den byter
           bara etikett i en lista. */
        + ' <button class="btn btn-ghost btn-sm" data-ans-pool="' + a.id + '">Ta in i poolen</button>' }
    ], rader, tomtText(sök || st, 'Ingen ansökan matchar filtret', 'Inga ansökningar än'));
  }

  /* Ett steg i rekryteringsspåret. Gjort = datumet; ogjort = en
     knapp som gör det. Samma element i båda lägena, så raden inte
     hoppar när något klickas. */
  function steg(namn, tid, attr) {
    return '<button type="button" class="adm-steg' + (tid ? ' ar-gjord' : '') + '" '
      + attr + ' title="' + esc(namn) + (tid ? ' ' + kortDatum(tid) : ' — inte gjort') + '">'
      + '<i></i>' + esc(namn)
      + (tid ? '<em>' + esc(kortDatum(tid)) + '</em>' : '')
      + '</button>';
  }

  /* Mallarna. Skrivna för att kunna skickas som de är, men de är
     utkast: rutan är redigerbar just för att ingen familj ska få ett
     mejl som låter som ett formulär. */
  function mallIntervju(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Tack för din ansökan till Nextrum. Vi har läst den och skulle gärna '
      + 'prata med dig en kvart om hur du tänker kring att hjälpa andra att plugga.\n\n'
      + 'Passar någon av de här tiderna?\n'
      + '  · \n  · \n  · \n\n'
      + 'Det är ett samtal, inget prov. Vi vill veta hur du förklarar saker och '
      + 'vilka ämnen du känner dig trygg i.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* ---- kontakta en sökande för intervju ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-kontakt]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansKontakt);
    if (!a) return;

    kontaktaRuta({
      titel: 'Kalla ' + (a.name || a.email || '') + ' till intervju',
      namn: a.name, till: a.email,
      amne: 'Din ansökan till Nextrum',
      text: mallIntervju(a),
      efterat: async () => {
        const nu = new Date().toISOString();
        await supa.from('applications')
          .update({ kontaktad_at: nu, status: a.status === 'new' ? 'contacted' : a.status })
          .eq('id', a.id);
        a.kontaktad_at = nu;
        if (a.status === 'new') a.status = 'contacted';
        ritaAnsokningar();
      }
    });
  });

  /* ---- stegen i rekryteringen ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-steg]');
    if (!knapp) return;
    const [steg, id] = knapp.dataset.ansSteg.split(':');
    const a = S.ansokningar.find(x => x.id === id);
    if (!a) return;

    const kolumn = steg === 'intervju' ? 'intervju_at' : 'utbildad_at';
    const nu = a[kolumn] ? null : new Date().toISOString();

    await medan(knapp, '…', async () => {
      const { error } = await supa.from('applications')
        .update({ [kolumn]: nu }).eq('id', id);
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      a[kolumn] = nu;
      ritaAnsokningar();
    });
  });

  /* ============================================================
     FRÅN ANSÖKAN TILL POOL

     Poolen är `tutor_profiles` med status 'approved' — det är exakt
     det urvalet vyn matchningsunderlag lämnar ut, och alltså det
     matchningen kan välja ur.

     En ansökan i `applications` är inte en profil. Den kunde förut
     bara byta etikett i en lista, och "Godkänd" på en ansökan gjorde
     ingenting åt vem som gick att matcha. Poolen var därför alltid
     tom utom för dem som råkat fylla i sin profil själva.

     TIMPENNINGEN ÄR OBLIGATORISK HÄR

     Utan hourly_rate hoppar edge-funktionen fakturering över
     studiehjälparen helt när ersättningar räknas ut. Hen håller pass
     och får ingen utbetalning, och det upptäcks först när någon
     frågar var pengarna blev av. Bättre att kräva talet i samma
     stund som personen släpps in.
     ============================================================ */
  function tutorVal(valt) {
    /* Bara konton som INTE redan är i poolen. Att erbjuda en redan
       godkänd studiehjälpare i listan är att be om att någons ämnen
       skrivs över av en ansökan från en annan person. */
    const kandidater = Object.values(S.personer)
      .filter(p => p.role === 'tutor')
      .filter(p => (S.tutorProfiler[p.id] || {}).status !== 'approved')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));

    if (!kandidater.length) {
      return '<p class="xsmall" style="color:var(--acc-text);margin:0">'
        + 'Inga konton att koppla till. Den sökande måste registrera sig som '
        + 'studiehjälpare på nextrum.se först — sedan dyker hen upp här.</p>';
    }

    return '<select class="inp" id="ap-konto">'
      + '<option value="">Välj konto…</option>'
      + kandidater.map(t => '<option value="' + esc(t.id) + '"'
          + (t.id === valt ? ' selected' : '') + '>'
          + esc(t.full_name || t.email || t.id) + (t.email ? ' · ' + esc(t.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-pool]');
    if (!knapp) return;

    const ans = S.ansokningar.find(a => a.id === knapp.dataset.ansPool);
    if (!ans) return;

    /* Utbildningen är inte en artighet. En studiehjälpare som inte
       vet hur rapporten fungerar lämnar inga rapporter — och utan
       rapport blir passet aldrig genomfört, alltså aldrig fakturerat
       och aldrig utbetalt. Kedjan går isär i andra änden. */
    if (!ans.utbildad_at) {
      const ändå = await bekräfta({
        titel: 'Introduktionen är inte gjord',
        text: (ans.name || 'Den sökande') + ' är inte markerad som utbildad. En studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och då blir passen '
          + 'aldrig genomförda — varken fakturerade eller utbetalda. Markera Utbildad i spåret '
          + 'först, eller fortsätt om introduktionen är gjord ändå.',
        knapp: 'Ta in ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    const trolig = Object.values(S.personer).find(p =>
      p.role === 'tutor' && p.email
      && String(p.email).toLowerCase() === String(ans.email || '').toLowerCase());

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="ap-t">'
      + '<h3 id="ap-t">Ta in ' + esc(ans.name || 'den sökande') + ' i poolen</h3>'
      + '<p>Profilen blir godkänd och dyker upp i matchningen direkt. '
      + 'Uppgifterna nedan kommer från ansökan — ändra det som behöver ändras.</p>'
      + '<div class="fgroup"><label for="ap-konto">Konto</label>' + tutorVal(trolig && trolig.id) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="ap-amnen">Ämnen (kommaseparerat)</label>'
      + '<input class="inp" id="ap-amnen" value="' + esc(ans.subjects || '') + '"></div>'
      + '<div class="fgroup"><label for="ap-ort">Ort</label>'
      + '<input class="inp" id="ap-ort" value="Stockholm"></div>'
      + '<div class="fgroup"><label for="ap-timpenning">Timpenning, kronor</label>'
      + '<input class="inp" id="ap-timpenning" type="number" min="1" step="1" inputmode="numeric" placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Utan timpenning räknas ingen ersättning ut — passen hålls men utbetalningen uteblir.</p>'
      + '<p class="ok-msg" id="ap-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-ap-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="ap-godkann">Ta in i poolen</button>'
      + '</div></div>';

    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-ap-stang]')) stäng();
    });

    $('#ap-godkann', ruta).addEventListener('click', async () => {
      const msg = $('#ap-msg', ruta);
      rensa(msg);
      const konto = $('#ap-konto', ruta) ? $('#ap-konto', ruta).value : '';
      const timpenning = Number($('#ap-timpenning', ruta).value);
      if (!konto) { säg(msg, 'Välj vilket konto ansökan hör till.', false); return; }
      if (!timpenning || timpenning < 1) { säg(msg, 'Fyll i timpenningen.', false); return; }

      await medan($('#ap-godkann', ruta), 'Tar in…', async () => {
        /* Ämnena lagras som en array. Fritexten från ansökan delas på
           komma; tomma bitar bort, annars blir "matte, " till två ämnen
           varav ett heter ingenting. */
        const ämnen = String($('#ap-amnen', ruta).value || '')
          .split(',').map(x => x.trim()).filter(Boolean);

        const { error } = await supa.from('tutor_profiles').update({
          status: 'approved',
          subjects: ämnen.length ? ämnen : null,
          city: $('#ap-ort', ruta).value.trim() || null,
          school: ans.school || null,
          age: ans.age || null,
          availability: ans.availability || null,
          hourly_rate: timpenning,
          tjanster: (ans.tjanster && ans.tjanster.length) ? ans.tjanster : [standardJobbtjanst()]
        }).eq('id', konto);

        if (error) { säg(msg, 'Kunde inte ta in: ' + felText(error), false); return; }

        await supa.from('applications').update({ status: 'approved' }).eq('id', ans.id);
        ans.status = 'approved';

        stäng();
        await hämtaAllt();
        ritaAnsokningar();
        ritaStudiehjalpare();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();
      });
    });
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaAnsokningar, steg
  });
})();
