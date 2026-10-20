/* ============================================================
   NEXTRUM — adminvyn, Ansökningar → Provet i vyn (2026-10-21)

   Utbildningsprovet som studiehjälparen gör vid första inloggningen,
   innan studiehjälparvyn öppnas (nextrum-provet.js). Här skrivs
   frågorna med facit, gränsen och väntetiden, och här syns hur det gått
   för var och en. Bara en superadmin: facit står här och ingen annanstans
   (spara_provfraga och prov_fragor släpper bara fram is_admin()).

   SPÄRREN GÄLLER FÖRST MED TILLRÄCKLIGT MÅNGA FRÅGOR (som förval fem).
   Med färre släpps alla studiehjälpare in utan prov, och rutan överst
   säger det: ett prov med två frågor hade varit ett prov man klarar på
   en gissning.

   Nollställ och Kräv provet står också i studiehjälparens panel
   (nextrum-admin-detalj.js), för den med behörigheten
   studiehjalpare_godkann, som inte ser den här fliken.

   Ingen fråga tas bort: den stängs av, för försöken pekar på den.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, felText } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const { S, kortDatum, namnFör, pill, ärSuperadmin } = NXAdmin;

  const ALTERNATIV_MAX = 6;
  const P = { fragor: [], inst: null, lage: null, lagen: [], forsok: [], fel: null, saknas: false, redigerar: null };

  async function hämta() {
    const [f, i, l, st, fo] = await Promise.all([
      supa.from('prov_fragor').select('id, fraga, alternativ, ratt_svar, aktiv, ordning, skapad_at, andrad_at')
        .order('ordning').order('skapad_at'),
      supa.from('prov_installning').select('grans_procent, min_aktiva_fragor, vantetid_timmar, andrad_at').maybeSingle(),
      supa.rpc('utbildningsprovet_lage'),
      supa.from('prov_studiehjalpare').select('id, kravs, utbildningsprov_godkant_at, aterstalld_at, undantagen'),
      supa.from('prov_forsok').select('id, studiehjalpare_id, inlamnad_at, ratt, antal, procent, godkand')
        .order('inlamnad_at', { ascending: false }).limit(500)
    ]);
    const fel = [f, i, l, st, fo].find(r => r.error);
    P.saknas = !!(fel && (fel.error.code === 'PGRST202' || fel.error.code === 'PGRST205' || fel.error.code === '42P01'));
    P.fel = fel && !P.saknas ? felText(fel.error) : null;
    P.fragor = f.data || [];
    P.inst = i.data || null;
    P.lage = l.data || null;
    P.lagen = st.data || [];
    P.forsok = fo.data || [];
  }

  async function ritaProvet() {
    if (!ärSuperadmin() || !$('#prov-fragor')) return;
    await hämta();
    rita();
  }

  function rita() {
    const varning = $('#prov-varning');
    const host = $('#prov-fragor');
    if (P.saknas) {
      host.innerHTML = tomt('Provet finns inte i databasen än',
        'Migrationen utbildningsprovet_i_studiehjalparvyn är inte körd. Studiehjälparna kommer in utan prov.');
      varning.innerHTML = '';
      $('#prov-inst').innerHTML = '';
      $('#prov-personer').innerHTML = '';
      return;
    }
    if (P.fel) { host.innerHTML = tomt('Kunde inte hämta provet', P.fel); return; }

    const aktiva = P.fragor.filter(f => f.aktiv).length;
    const minst = P.inst ? P.inst.min_aktiva_fragor : 5;
    $('#prov-antal').textContent = aktiva + ' aktiva av ' + P.fragor.length;
    varning.innerHTML = aktiva < minst
      ? '<div class="prov-varning" role="status"><b>Provet krävs inte av någon än.</b> Det finns ' + aktiva
        + ' aktiva frågor, och spärren gäller först vid ' + minst + '. Till dess kommer alla studiehjälpare in i '
        + 'vyn utan prov.</div>'
      : '';

    host.innerHTML = (P.fragor.length
      ? '<ol class="prov-lista">' + P.fragor.map(fråga).join('') + '</ol>'
      : tomt('Inga frågor än', 'Skriv den första under Ny fråga.'))
      + '<details class="eko-mer prov-ny"' + (P.redigerar === 'ny' ? ' open' : '') + '><summary>Ny fråga</summary>'
      + formulär(null) + '</details>';

    ritaInställning();
    ritaPersoner();
  }

  function fråga(f, i) {
    if (P.redigerar === f.id) return '<li class="prov-fraga">' + formulär(f) + '</li>';
    return '<li class="prov-fraga' + (f.aktiv ? '' : ' ar-av') + '">'
      + '<div class="prov-fraga-topp"><b>' + (i + 1) + '. ' + esc(f.fraga) + '</b>'
      + (f.aktiv ? '' : ' ' + pill('Av', '')) + '</div>'
      + '<ul class="prov-alt">' + (f.alternativ || []).map((a, j) =>
        '<li' + (j === f.ratt_svar ? ' class="ar-ratt"' : '') + '>' + esc(a)
        + (j === f.ratt_svar ? ' <span class="prov-facit">rätt svar</span>' : '') + '</li>').join('') + '</ul>'
      + '<div class="adm-verktyg">'
      + '<button type="button" class="btn btn-ghost btn-sm" data-prov-andra="' + esc(f.id) + '">Ändra</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-prov-aktiv="' + esc(f.id) + '">'
      + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button>'
      + '</div></li>';
  }

  /* Samma formulär för en ny fråga och en ändring. Tomma alternativ
     räknas inte; facit är alternativets plats bland de ifyllda. */
  function formulär(f) {
    const id = f ? f.id : 'ny';
    const alt = f ? f.alternativ.slice() : [];
    while (alt.length < ALTERNATIV_MAX) alt.push('');
    const fid = 'prov-f-' + id;
    return '<form class="prov-form" data-prov-form="' + esc(id) + '" novalidate>'
      + '<div class="fgroup"><label for="' + esc(fid) + '-fraga">Frågan</label>'
      + '<textarea class="inp" id="' + esc(fid) + '-fraga" name="fraga" rows="2" maxlength="600" required>'
      + esc(f ? f.fraga : '') + '</textarea></div>'
      + '<fieldset class="prov-form-alt"><legend>Alternativen, och vilket som är rätt</legend>'
      + alt.map((a, j) => '<div class="prov-form-rad">'
        + '<input type="radio" name="ratt" value="' + j + '" aria-label="Alternativ ' + (j + 1) + ' är rätt"'
        + (f && j === f.ratt_svar ? ' checked' : '') + '>'
        + '<input class="inp" name="alt" maxlength="200" value="' + esc(a) + '" placeholder="Alternativ ' + (j + 1)
        + (j < 2 ? '' : ' (frivilligt)') + '" aria-label="Alternativ ' + (j + 1) + '">'
        + '</div>').join('')
      + '</fieldset>'
      + '<div class="ag-faltrad">'
      + '<div class="fgroup"><label for="' + esc(fid) + '-ordning">Ordning</label>'
      + '<input class="inp" id="' + esc(fid) + '-ordning" name="ordning" type="number" step="1" inputmode="numeric" '
      + 'value="' + esc(f ? f.ordning : '') + '" placeholder="Sist"></div>'
      + '<label class="ag-kryss prov-form-aktiv"><input type="checkbox" name="aktiv"' + (!f || f.aktiv ? ' checked' : '')
      + '> Aktiv</label>'
      + '</div>'
      + '<p class="ok-msg" data-prov-msg role="alert"></p>'
      + '<div class="adm-verktyg">'
      + (f ? '<button type="button" class="btn btn-ghost btn-sm" data-prov-avbryt>Avbryt</button>' : '')
      + '<button type="submit" class="btn btn-primary btn-sm">' + (f ? 'Spara frågan' : 'Lägg till frågan') + '</button>'
      + '</div></form>';
  }

  function ritaInställning() {
    const i = P.inst || { grans_procent: 50, min_aktiva_fragor: 5, vantetid_timmar: 24 };
    $('#prov-inst').innerHTML = '<form data-prov-inst novalidate>'
      + '<div class="ag-faltrad">'
      + '<div class="fgroup"><label for="prov-grans">Godkänt är mer än (procent)</label>'
      + '<input class="inp" id="prov-grans" name="grans" type="number" min="0" max="99" step="1" inputmode="numeric" '
      + 'value="' + esc(Number(i.grans_procent)) + '"></div>'
      + '<div class="fgroup"><label for="prov-minst">Spärren gäller från (aktiva frågor)</label>'
      + '<input class="inp" id="prov-minst" name="minst" type="number" min="1" max="100" step="1" inputmode="numeric" '
      + 'value="' + esc(i.min_aktiva_fragor) + '"></div>'
      + '<div class="fgroup"><label for="prov-vanta">Göra om efter (timmar)</label>'
      + '<input class="inp" id="prov-vanta" name="vanta" type="number" min="0" max="720" step="1" inputmode="numeric" '
      + 'value="' + esc(i.vantetid_timmar) + '"></div>'
      + '</div>'
      + '<p class="ok-msg" data-prov-inst-msg role="alert"></p>'
      + '<button type="submit" class="btn btn-primary btn-sm">Spara</button>'
      + (i.andrad_at ? ' <span class="small" style="color:var(--bl-3)">Ändrad ' + esc(kortDatum(i.andrad_at)) + '</span>' : '')
      + '</form>';
  }

  /* Varje godkänd studiehjälpare och hur det gått. Namnet öppnar panelen,
     där Nollställ och Kräv provet står. */
  function ritaPersoner() {
    const host = $('#prov-personer');
    const godkända = Object.values(S.tutorProfiler || {}).filter(t => t && t.status === 'approved');
    if (!godkända.length) { host.innerHTML = tomt('Inga godkända studiehjälpare', ''); return; }
    const lägen = new Map(P.lagen.map(r => [r.id, r]));
    host.innerHTML = '<div class="vy-lista">' + godkända.map(t => {
      const st = lägen.get(t.id);
      const försök = P.forsok.filter(x => x.studiehjalpare_id === t.id);
      const senaste = försök[0];
      const märke = st && st.utbildningsprov_godkant_at ? pill('Godkänt ' + kortDatum(st.utbildningsprov_godkant_at), 'ar-klar')
        : st && st.kravs === false ? pill('Krävs inte', '')
        : pill('Krävs', 'ar-ny');
      return '<div class="vy-rad"><div class="vy-rad-mitt">'
        + '<div class="vy-rad-titel"><button type="button" class="eko-lank" data-dp="studiehjalpare:' + esc(t.id) + '">'
        + esc(namnFör(t.id)) + '</button></div>'
        + '<div class="vy-rad-meta">' + (senaste
          ? 'Senast ' + esc(kortDatum(senaste.inlamnad_at)) + ': ' + esc(senaste.ratt) + ' av ' + esc(senaste.antal)
            + ' rätt · ' + försök.length + (försök.length === 1 ? ' försök' : ' försök')
          : st && st.undantagen ? esc(st.undantagen) : 'Inte gjort') + '</div></div>'
        + '<div class="vy-rad-hoger">' + märke + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- knapparna ---------- */
  document.addEventListener('click', async e => {
    const ändra = e.target.closest('[data-prov-andra]');
    if (ändra) { P.redigerar = ändra.dataset.provAndra; rita(); return; }
    if (e.target.closest('[data-prov-avbryt]')) { P.redigerar = null; rita(); return; }

    const aktiv = e.target.closest('[data-prov-aktiv]');
    if (aktiv) {
      const f = P.fragor.find(x => x.id === aktiv.dataset.provAktiv);
      if (!f) return;
      const av = f.aktiv;
      const aktivaEfter = P.fragor.filter(x => x.aktiv).length + (av ? -1 : 1);
      const minst = P.inst ? P.inst.min_aktiva_fragor : 5;
      if (av && aktivaEfter < minst && !(await bekräfta({
        titel: 'Stänga av frågan?',
        text: 'Då finns ' + aktivaEfter + ' aktiva frågor, och spärren gäller först vid ' + minst
          + '. Studiehjälpare som inte gjort provet kommer in i vyn utan det.',
        knapp: 'Stäng av', avbryt: 'Avbryt'
      }))) return;
      await medan(aktiv, '…', async () => {
        const { error } = await supa.rpc('spara_provfraga', { p_id: f.id, p_fraga: f.fraga, p_alternativ: f.alternativ,
          p_ratt_svar: f.ratt_svar, p_aktiv: !av, p_ordning: f.ordning });
        if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
        await ritaProvet();
      });
    }
  });

  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-prov-form]');
    if (form) {
      e.preventDefault();
      const msg = form.querySelector('[data-prov-msg]');
      NX.rensa(msg);
      const id = form.dataset.provForm === 'ny' ? null : form.dataset.provForm;
      const fält = Array.from(form.querySelectorAll('input[name="alt"]'));
      const valdPlats = Number((form.querySelector('input[name="ratt"]:checked') || {}).value);
      const ifyllda = fält.map((x, j) => ({ text: x.value.trim(), j })).filter(x => x.text);
      const rätt = ifyllda.findIndex(x => x.j === valdPlats);
      if (form.fraga.value.trim().length < 3) { NX.säg(msg, 'Skriv frågan.', false); return; }
      if (ifyllda.length < 2) { NX.säg(msg, 'En fråga har minst två alternativ.', false); return; }
      if (rätt < 0) { NX.säg(msg, 'Välj vilket ifyllt alternativ som är rätt.', false); return; }
      const ordning = form.ordning.value.trim() === '' ? null : Math.round(Number(form.ordning.value));
      await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
        const { error } = await supa.rpc('spara_provfraga', {
          p_id: id, p_fraga: form.fraga.value.trim(), p_alternativ: ifyllda.map(x => x.text),
          p_ratt_svar: rätt, p_aktiv: form.aktiv.checked, p_ordning: Number.isFinite(ordning) ? ordning : null });
        if (error) { NX.säg(msg, felText(error), false); return; }
        P.redigerar = null;
        await ritaProvet();
      });
      return;
    }

    const inst = e.target.closest('form[data-prov-inst]');
    if (inst) {
      e.preventDefault();
      const msg = inst.querySelector('[data-prov-inst-msg]');
      NX.rensa(msg);
      await medan(inst.querySelector('[type="submit"]'), 'Sparar…', async () => {
        const { error } = await supa.rpc('satt_provinstallning', {
          p_grans_procent: Number(inst.grans.value), p_min_aktiva_fragor: Math.round(Number(inst.minst.value)),
          p_vantetid_timmar: Math.round(Number(inst.vanta.value)) });
        if (error) { NX.säg(msg, felText(error), false); return; }
        await ritaProvet();
        NX.säg($('[data-prov-inst-msg]'), 'Sparat.', true);
      });
    }
  });

  Object.assign(NXAdmin.rita, { ritaProvet });
})();
