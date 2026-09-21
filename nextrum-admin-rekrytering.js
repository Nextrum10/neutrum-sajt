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

  const { ANS_LAGE, INBJUDAN_NOT, S, delaÄmnen, punkt, funktionsFel, hämtaAllt, hämtaMatchunderlag,
          kontaktaRuta, kortDatum, matchar, tabell, tomtText, väljare, öppnaRuta } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const kandidater = (...a) => NXAdmin.rita.kandidater(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const standardJobbtjanst = (...a) => NXAdmin.rita.standardJobbtjanst(...a);
  const öppnaDetalj = (...a) => NXAdmin.rita.öppnaDetalj(...a);

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

    ritaStegflikar();
  }

  /* ============================================================
     INTERVJU OCH UTBILDNING (Fas 6)

     Rekryteringens två steg som egna flikar: vem som väntar på en
     intervju, och vem som intervjuats men inte utbildats. Samma
     stegknappar som i listan, så att man kan bocka av direkt här.
     Avböjda och godkända ligger bara under Alla.
     ============================================================ */
  function ritaStegflikar() {
    const aktiva = S.ansokningar.filter(a => a.status !== 'rejected' && a.status !== 'approved');
    const tillIntervju = aktiva.filter(a => !a.intervju_at)
      .sort((a, b) => String(a.kontaktad_at || a.created_at).localeCompare(String(b.kontaktad_at || b.created_at)));
    const tillUtbildning = aktiva.filter(a => a.intervju_at && !a.utbildad_at)
      .sort((a, b) => String(a.intervju_at).localeCompare(String(b.intervju_at)));

    const namn = a => '<b>' + esc(a.name) + '</b><span class="adm-und">' + esc(a.email)
      + (a.age ? ' · ' + a.age + ' år' : '') + '</span>';
    const väntat = (tid, ord) => tid
      ? '<span class="adm-tal">' + esc(kortDatum(tid)) + '</span><span class="adm-und">' + esc(ord) + '</span>'
      : '<span class="adm-und">Inte kontaktad än</span>';

    const intervju = $('#ans-intervju');
    if (intervju) {
      $('#ans-intervju-antal').textContent = tillIntervju.length ? tillIntervju.length + ' st' : '';
      intervju.innerHTML = tabell([
        { namn: 'Namn', rita: namn },
        { namn: 'Kontaktad', rita: a => väntat(a.kontaktad_at, 'kontaktad') },
        { namn: 'Kan jobba', rita: a => esc(a.availability || '—') },
        { namn: 'Steg', rita: a => '<div class="adm-spar">'
          + steg('Kontakt', a.kontaktad_at, 'data-ans-kontakt="' + esc(a.id) + '"')
          + steg('Intervju', a.intervju_at, 'data-ans-steg="intervju:' + esc(a.id) + '"')
          + '</div>' }
      ], tillIntervju, 'Ingen väntar på en intervju');
    }

    const utbildning = $('#ans-utbildning');
    if (utbildning) {
      $('#ans-utbildning-antal').textContent = tillUtbildning.length ? tillUtbildning.length + ' st' : '';
      utbildning.innerHTML = tabell([
        { namn: 'Namn', rita: namn },
        { namn: 'Intervjuad', rita: a => väntat(a.intervju_at, 'intervjuad') },
        { namn: 'Ämnen', rita: a => esc(a.subjects || '—') },
        { namn: 'Steg', rita: a => '<div class="adm-spar">'
          + steg('Utbildad', a.utbildad_at, 'data-ans-steg="utbildad:' + esc(a.id) + '"')
          + '</div>' },
        { namn: '', höger: true, rita: a =>
          '<button class="btn btn-ghost btn-sm" data-ans-pool="' + a.id + '">Ta in i poolen</button>' }
      ], tillUtbildning, 'Ingen väntar på utbildning');
    }
  }

  /* Ett steg i rekryteringsspåret. Gjort = datumet; ogjort = en
     knapp som gör det. Samma element i båda lägena, så raden inte
     hoppar när något klickas. */
  function steg(namn, tid, attr) {
    return '<button type="button" class="adm-steg' + (tid ? ' ar-gjord' : '') + '" '
      + attr + ' title="' + esc(namn) + (tid ? ' ' + kortDatum(tid) : ': inte gjort') + '">'
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
      återFokus: () => document.querySelector('[data-ans-kontakt="' + a.id + '"]'),
      /* Svaret läses, som för anmälningarna: en stämpel som bara
         finns i minnet ser gjord ut tills någon laddar om sidan. */
      efterat: async () => {
        const nu = new Date().toISOString();
        const { data, error } = await supa.from('applications')
          .update({ kontaktad_at: nu, status: a.status === 'new' ? 'contacted' : a.status })
          .eq('id', a.id).select('id');
        if (error) return felText(error);
        if (!(data || []).length) return 'ansökan hittades inte.';
        a.kontaktad_at = nu;
        if (a.status === 'new') a.status = 'contacted';
        ritaAnsokningar();
        return null;
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

     Poolen är `tutor_profiles` med status 'approved'. Det är exakt
     det urval vyn matchningsunderlag lämnar ut, och alltså det
     matchningen kan välja ur. Sedan program 2, Fas 1.5 går det inte
     heller att matcha med någon annan: databasen säger nej.

     En ansökan i `applications` är inte en profil. Den kunde förut
     bara byta etikett i en lista, och "Godkänd" på en ansökan gjorde
     ingenting åt vem som gick att matcha. Poolen var därför alltid
     tom utom för dem som råkat fylla i sin profil själva.

     TIMPENNINGEN ÄR OBLIGATORISK HÄR

     Utan hourly_rate, och utan en egen ersättning på tjänsten, räknar
     edge-funktionen fakturering ingen ersättning för studiehjälparen.
     Hen håller pass och får ingen utbetalning, och det upptäcks först
     när någon frågar var pengarna blev av. Bättre att kräva talet i
     samma stund som personen släpps in.
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
        + 'Inga konton att koppla till. Den sökande behöver ett konto som studiehjälpare: '
        + 'antingen registrerar hen sig på nextrum.se, eller så bjuder du in hen med '
        + 'Lägg till studiehjälpare under Studiehjälpare.</p>';
    }

    return '<select class="sel" id="ap-konto">'
      + '<option value="">Välj konto</option>'
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
       vet hur rapporten fungerar lämnar inga rapporter, och utan
       rapport blir passet aldrig genomfört, alltså aldrig fakturerat
       och aldrig utbetalt. Kedjan går isär i andra änden. */
    if (!ans.utbildad_at) {
      const ändå = await bekräfta({
        titel: 'Introduktionen är inte gjord',
        text: (ans.name || 'Den sökande') + ' är inte markerad som utbildad. En studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och då blir passen '
          + 'aldrig genomförda, varken fakturerade eller utbetalda. Markera Utbildad i spåret '
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
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="ap-t">'
      + '<h3 id="ap-t">Ta in ' + esc(ans.name || 'den sökande') + ' i poolen</h3>'
      + '<p>Profilen blir godkänd och dyker upp i matchningen direkt. '
      + 'Uppgifterna nedan kommer från ansökan. Ändra det som behöver ändras.</p>'
      + '<div class="fgroup" style="margin-top:14px"><label for="ap-konto">Konto</label>'
      + tutorVal(trolig && trolig.id) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="ap-amnen">Ämnen, med komma emellan</label>'
      + '<input class="inp" id="ap-amnen" value="' + esc(ans.subjects || '') + '"></div>'
      + '<div class="fgroup"><label for="ap-ort">Ort</label>'
      + '<input class="inp" id="ap-ort" value="Stockholm"></div>'
      + '<div class="fgroup"><label for="ap-timpenning">Timpenning, kronor per timme</label>'
      + '<input class="inp" id="ap-timpenning" type="number" min="1" step="1" inputmode="numeric" placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Har tjänsten ingen egen ersättning räknas ingen ersättning ut utan timpenning. '
      + 'Passen hålls, men utbetalningen uteblir.</p>'
      + '<p class="ok-msg" id="ap-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-ap-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="ap-godkann">Ta in i poolen</button>'
      + '</div></div>';

    const stäng = öppnaRuta(ruta, {
      återFokus: () => document.querySelector('[data-ans-pool="' + ans.id + '"]')
    });
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-ap-stang]')) stäng();
    });

    const godkänn = $('#ap-godkann', ruta);
    godkänn.addEventListener('click', async () => {
      if (godkänn.getAttribute('aria-busy') === 'true') return;
      const msg = $('#ap-msg', ruta);
      rensa(msg);
      const konto = $('#ap-konto', ruta) ? $('#ap-konto', ruta).value : '';
      const timpenning = Number($('#ap-timpenning', ruta).value);
      if (!konto) { säg(msg, 'Välj vilket konto ansökan hör till.', false); return; }
      if (!Number.isInteger(timpenning) || timpenning < 1) {
        säg(msg, 'Fyll i timpenningen i hela kronor.', false);
        $('#ap-timpenning', ruta).focus();
        return;
      }

      await medan(godkänn, 'Tar in…', async () => {
        /* Ämnena är en text[] som inte får vara null: förvalet är en
           tom array, och null gav 23502 när fältet lämnades tomt. Samma
           fel var redan rättat för elever. Fritexten delas på komma;
           tomma bitar bort, annars blir "matte, " två ämnen varav ett
           heter ingenting.

           .select() för att en uppdatering som inte träffar någon rad
           annars ser ut precis som en som lyckades. */
        const { data, error } = await supa.from('tutor_profiles').update({
          status: 'approved',
          subjects: delaÄmnen($('#ap-amnen', ruta).value),
          city: $('#ap-ort', ruta).value.trim() || null,
          school: ans.school || null,
          age: ans.age || null,
          availability: ans.availability || null,
          hourly_rate: timpenning,
          tjanster: (ans.tjanster && ans.tjanster.length) ? ans.tjanster : [standardJobbtjanst()]
        }).eq('id', konto).select('id');

        if (error) { säg(msg, 'Kunde inte ta in: ' + felText(error), false); return; }
        if (!(data || []).length) {
          säg(msg, 'Ingenting ändrades: kontot har ingen studiehjälparprofil.', false);
          return;
        }

        /* Från och med nu är profilen godkänd. Går ansökan inte att
           markera ska rutan säga det och stå kvar, i stället för att
           stängas över ett fel ingen såg. */
        const a2 = await supa.from('applications').update({ status: 'approved' })
          .eq('id', ans.id).select('id');
        let varning = null;
        if (a2.error) varning = felText(a2.error);
        else if (!(a2.data || []).length) varning = 'ansökan hittades inte.';
        else ans.status = 'approved';

        let hämtfel = null;
        try { await hämtaAllt(); } catch (e2) { hämtfel = felText(e2); }
        ritaAnsokningar();
        ritaStudiehjalpare();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();

        if (!varning && !hämtfel) { stäng(); return; }
        säg(msg, 'Profilen är godkänd, men '
          + [varning ? 'ansökan kunde inte markeras som godkänd: ' + punkt(varning) : null,
             hämtfel ? 'listorna kunde inte hämtas om: ' + punkt(hämtfel) + ' Ladda om sidan.' : null]
            .filter(Boolean).join(' '), false);
        godkänn.hidden = true;
        ruta.querySelector('[data-ap-stang]').textContent = 'Stäng';
      });
    });
  });

  /* ============================================================
     LÄGG TILL STUDIEHJÄLPARE (program 2, Fas 1)

     Den som redan arbetar för Nextrum kom inte in i poolen utan att
     söka via sajten, eller utan att själv registrera sig och sedan
     vänta på att någon hittade kontot. Nu bjuds hen in härifrån.

     Personen hamnar i VÄNTLÄGE, inte i poolen. Godkännandet är ett eget
     steg i listan, och det är med flit: sedan Fas 1.5 kan ingen elev
     matchas med någon som inte är godkänd, så en inbjudan till fel
     adress ger ett konto som inte kommer åt någonting.

     Ordningen: bekräfta (ett riktigt mejl går), bjud in med rollen
     tutor, och fyll sedan i profilen som handle_new_user redan skapat
     åt kontot. Svaret läses med .select(), för en uppdatering som inte
     träffar någon rad ser annars ut som en som lyckades.
     ============================================================ */
  function jobbtjänster() {
    const ur = (S.tjanster || []).filter(t => t.aktiv && t.for_jobb);
    const lista = ur.length ? ur
      : (typeof NXTjanster !== 'undefined' && NXTjanster.forJobb ? NXTjanster.forJobb() : []);
    return lista.slice().sort((a, b) => ((a.ordning || 0) - (b.ordning || 0))
      || String(a.kod).localeCompare(String(b.kod)));
  }

  function läggTillStudiehjälpare() {
    const tjänster = jobbtjänster();
    const förval = standardJobbtjanst();

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="ls-t">'
      + '<h3 id="ls-t">Lägg till studiehjälpare</h3>'
      + '<p>För den som redan arbetar för Nextrum. Hen får ett mejl med en inbjudan och väljer '
      + 'sitt lösenord. Profilen hamnar i väntläge. Hen kan matchas först när hen är godkänd, '
      + 'och det gör du i listan när du är redo.</p>'
      + '<div class="ag-faltrad" style="margin-top:14px">'
      + '<div class="fgroup"><label for="ls-namn">Namn</label>'
      + '<input class="inp" id="ls-namn" maxlength="120" autocomplete="off"></div>'
      + '<div class="fgroup"><label for="ls-epost">E-post</label>'
      + '<input class="inp" id="ls-epost" type="email" maxlength="200" autocomplete="off"></div>'
      + '</div>'
      + '<div class="fgroup"><label for="ls-amnen">Ämnen, med komma emellan</label>'
      + '<input class="inp" id="ls-amnen" maxlength="300" placeholder="t.ex. Matematik, Fysik" autocomplete="off"></div>'
      + '<div class="ag-faltrad">'
      + '<div class="fgroup"><label for="ls-ort">Ort</label>'
      + '<input class="inp" id="ls-ort" maxlength="80" placeholder="t.ex. Stockholm" autocomplete="off"></div>'
      + '<div class="fgroup"><label for="ls-skola">Skola</label>'
      + '<input class="inp" id="ls-skola" maxlength="120" autocomplete="off"></div>'
      + '</div>'
      + '<div class="ag-faltrad">'
      + '<div class="fgroup"><label for="ls-alder">Ålder</label>'
      + '<input class="inp" id="ls-alder" type="number" min="13" max="99" step="1" inputmode="numeric"></div>'
      + '<div class="fgroup"><label for="ls-timpenning">Timpenning, kronor per timme</label>'
      + '<input class="inp" id="ls-timpenning" type="number" min="1" step="1" inputmode="numeric"'
      + ' placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<fieldset style="border:0;padding:0;margin:0 0 6px;min-width:0">'
      + '<legend style="font-size:.8rem;font-weight:600;margin-bottom:7px">Tjänster hen kan ta</legend>'
      + (tjänster.length
        ? tjänster.map((t, i) => '<label style="display:flex;align-items:center;gap:10px;min-height:44px;'
            + 'font-size:.9rem;cursor:pointer" for="ls-tj-' + i + '">'
            + '<input type="checkbox" id="ls-tj-' + i + '" data-ls-tjanst value="' + esc(t.kod) + '"'
            + (t.kod === förval ? ' checked' : '') + ' style="width:20px;height:20px">'
            + esc(t.namn || t.kod) + '</label>').join('')
        : '<p class="xsmall" style="margin:0">Ingen tjänst är öppen för ansökningar. '
          + 'Profilen får standardtjänsten.</p>')
      + '</fieldset>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:8px;line-height:1.6">'
      + 'Timpenningen går att sätta senare i studiehjälparens panel. Har tjänsten ingen egen '
      + 'ersättning räknas ingen ersättning ut utan den.</p>'
      + '<p class="ok-msg" id="ls-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-ls-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="ls-bjud">Bjud in</button>'
      + '<button type="button" class="btn btn-primary" id="ls-oppna" hidden>Öppna profilen</button>'
      + '</div></div>';

    let efteråt = null;
    const stäng = öppnaRuta(ruta, { vidStängning: () => { if (efteråt) efteråt(); } });
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-ls-stang]')) stäng();
    });
    $('#ls-oppna', ruta).addEventListener('click', () => stäng());

    let skickad = false;
    const bjud = $('#ls-bjud', ruta);
    bjud.addEventListener('click', async () => {
      if (skickad || bjud.getAttribute('aria-busy') === 'true') return;
      const msg = $('#ls-msg', ruta);
      rensa(msg);
      const fält = id => $('#' + id, ruta);

      const namn = fält('ls-namn').value.replace(/\s+/g, ' ').trim();
      const epost = fält('ls-epost').value.trim().toLowerCase();
      const åRå = fält('ls-alder').value.trim();
      const tRå = fält('ls-timpenning').value.trim();
      const ålder = åRå ? Number(åRå) : null;
      const timpenning = tRå ? Number(tRå) : null;
      const valda = Array.from(ruta.querySelectorAll('[data-ls-tjanst]:checked')).map(x => x.value);

      const stopp = (text, id) => { säg(msg, text, false); if (id) fält(id).focus(); };
      if (!namn) return stopp('Skriv namnet.', 'ls-namn');
      if (!NX.epostOk(epost)) return stopp('Skriv en e-postadress som går att skicka till.', 'ls-epost');
      const finns = Object.values(S.personer).find(p => String(p.email || '').toLowerCase() === epost);
      if (finns) {
        return stopp(finns.role === 'tutor'
          ? 'Det finns redan en studiehjälpare med adressen: ' + (finns.full_name || finns.email)
            + '. Godkänn hen i listan i stället.'
          : 'Det finns redan ett konto med adressen, och det är inte en studiehjälpare.', 'ls-epost');
      }
      if (ålder !== null && (!Number.isInteger(ålder) || ålder < 13 || ålder > 99)) {
        return stopp('Skriv åldern i hela år.', 'ls-alder');
      }
      if (timpenning !== null && (!Number.isInteger(timpenning) || timpenning < 1)) {
        return stopp('Skriv timpenningen i hela kronor, eller lämna fältet tomt.', 'ls-timpenning');
      }
      if (tjänster.length && !valda.length) {
        return stopp('Välj minst en tjänst.');
      }

      const ja = await bekräfta({
        titel: 'Skicka inbjudan?',
        text: 'Ett riktigt mejl med en inbjudan skickas till ' + epost + '.',
        knapp: 'Skicka inbjudan'
      });
      if (!ja) return;

      await medan(bjud, 'Skickar…', async () => {
        const res = await supa.functions.invoke('bjud-in', {
          body: { epost: epost, namn: namn, roll: 'tutor' }
        });
        const fel = res.error || (res.data && res.data.error);
        if (fel) { säg(msg, 'Inbjudan skickades inte: ' + await funktionsFel(fel), false); return; }

        /* Mejlet har gått. Rutan får inte kunna skicka det igen. */
        skickad = true;
        ruta.querySelectorAll('input').forEach(el => { el.disabled = true; });
        bjud.hidden = true;
        ruta.querySelector('[data-ls-stang]').textContent = 'Stäng';
        const till = (res.data && res.data.till) || epost;
        const id = res.data && res.data.id;

        if (!id) {
          säg(msg, 'Inbjudan skickades till ' + till + ', men svaret saknade kontots id, '
            + 'så profilen kunde inte fyllas i. Ladda om sidan och fyll i den från panelen.', false);
          return;
        }

        const problem = [];
        const upp = await supa.from('tutor_profiles').update({
          subjects: delaÄmnen(fält('ls-amnen').value),
          city: fält('ls-ort').value.trim() || null,
          school: fält('ls-skola').value.trim() || null,
          age: ålder,
          hourly_rate: timpenning,
          tjanster: valda.length ? valda : [förval]
        }).eq('id', id).select('id');
        if (upp.error) problem.push('profilen kunde inte fyllas i: ' + punkt(felText(upp.error)));
        else if (!(upp.data || []).length) problem.push('profilen kunde inte fyllas i: den hittades inte.');

        /* Anteckningen är det enda spåret av att inbjudan kom härifrån,
           och pillen "Inbjuden" i listan bygger på den (se INBJUDAN_NOT
           i kärnan). Före omhämtningen, så att pillen syns direkt. */
        const not = await supa.from('admin_noteringar')
          .insert({ om_profil: id, text: INBJUDAN_NOT, skriven_av: S.user.id });
        if (not.error) {
          problem.push('anteckningen om inbjudan kunde inte sparas, så listan visar inte att hen är '
            + 'inbjuden: ' + punkt(felText(not.error)));
        }

        try { await hämtaAllt(); } catch (e2) {
          problem.push('listorna kunde inte hämtas om: ' + punkt(felText(e2)) + ' Ladda om sidan.');
        }
        ritaStudiehjalpare();
        await ritaÖversikt();

        efteråt = () => öppnaDetalj('studiehjalpare', id);
        if (!problem.length) { stäng(); return; }
        säg(msg, 'Inbjudan skickades till ' + till + ', men ' + problem.join(' '), false);
        $('#ls-oppna', ruta).hidden = false;
        $('#ls-oppna', ruta).focus();
      });
    });
  }

  const läggTillKnapp = $('#sh-ny');
  if (läggTillKnapp) läggTillKnapp.addEventListener('click', läggTillStudiehjälpare);


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaAnsokningar, steg
  });
})();
