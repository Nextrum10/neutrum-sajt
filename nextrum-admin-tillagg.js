/* ============================================================
   NEXTRUM — adminvyn: syskontillägget (syskontillagg_som_skuld, 2026-10-21)

   Leo: "Admin: vy över upplupet per familj (belopp, äldsta post,
   spärrstatus), poster med status, och knapparna Skicka påminnelse,
   Frigör (orsak obligatorisk), Avskriv (orsak obligatorisk, loggas) och
   Återbetala."

   Fliken Syskontillägg under Betalningar. Två delar:
     · FAMILJERNA med obetalt tillägg (tillagg_oversikt): det upplupna,
       det som står i en betalning, den äldsta posten, spärren och den
       senaste påminnelsen, och Skicka påminnelse (tillagg_paminn, en om
       dagen).
     · POSTERNA, en per pass med extra barn, med läget i färg och filter
       på läget. Frigör (bokad eller upplupen) och Avskriv (upplupen) kräver
       en orsak och görs i databasen (tillagg_frigor, tillagg_skriv_av),
       som också nekar allt annat. Återbetala gäller en betald post och går
       genom dess rad i liggaren (stripe-aterbetalning, med raden).

   Bara superadmin: tabellerna och funktionerna släpper bara fram
   is_admin(). Orsaken är fritext från admin och visas som text. Före
   migrationen står en rad om det.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, felText } = NX;
  const { medan } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { fråga, hämtaAlla, kortDatum, namnFör, pill, ärSuperadmin } = NXAdmin;

  const T = { familjer: [], poster: [], rader: {}, tvist: {}, inst: null, filter: 'obetalt', sök: '', saknas: false, fel: null };

  const LÄGE = NXBetalning.TILLAGG_LAGE;
  const FILTER = [['obetalt', 'Obetalt'], ['alla', 'Alla'], ['bokad', 'Bokade'], ['upplupen', 'Upplupna'],
    ['i_betalning', 'I betalning'], ['betald', 'Betalda'], ['frigjord', 'Frigjorda'], ['avskriven', 'Avskrivna'],
    ['aterbetald', 'Återbetalda']];
  const SPÄRR = { belopp: 'Spärrad: för stort belopp', alder: 'Spärrad: för gammalt' };

  const saknasKod = fel => !!fel && (fel.code === 'PGRST205' || fel.code === '42P01' || fel.code === 'PGRST202');
  const knapp = (attr, värde, text) => '<button class="btn btn-ghost btn-sm" type="button" ' + attr + '="'
    + esc(värde) + '">' + esc(text) + '</button>';
  const familjLänk = id => '<button type="button" class="eko-lank" data-dp="familj:' + esc(id) + '">'
    + esc(namnFör(id)) + '</button>';
  const dag = iso => iso ? kortDatum(String(iso).slice(0, 10)) : '—';

  async function hämta() {
    const [o, p, r, i] = await Promise.all([
      supa.rpc('tillagg_oversikt'),
      hämtaAlla('tillagg_poster', '*', q => q.order('pass_start', { ascending: false }), 'id'),
      hämtaAlla('betalningsrader', 'id, betalning_id, tillagg_post_id, belopp_ore, aterbetalt_ore',
        q => q.not('tillagg_post_id', 'is', null), 'id'),
      supa.from('tillagg_installning').select('*').maybeSingle()
    ]);
    T.saknas = saknasKod(o.error) || saknasKod(p.error);
    T.fel = !T.saknas && (o.error || p.error) ? felText(o.error || p.error) : null;
    T.familjer = o.error ? [] : (o.data || []);
    T.poster = p.error ? [] : (p.data || []);
    T.rader = {};
    (r.error ? [] : (r.data || [])).forEach(x => { T.rader[x.tillagg_post_id] = x; });
    T.inst = i.error ? null : (i.data || null);
    // Tvisten flaggas på betalningen i liggaren: posten visar den, inget annat görs.
    const ids = [...new Set(Object.values(T.rader).map(x => x.betalning_id))];
    T.tvist = {};
    for (let n = 0; n < ids.length; n += 100) {
      const { data } = await supa.from('betalningar').select('id, status').in('id', ids.slice(n, n + 100));
      (data || []).forEach(b => { if (b.status === 'tvist') T.tvist[b.id] = true; });
    }
  }

  async function ritaTillagg() {
    if (!ärSuperadmin() || !$('#tl-lista')) return;
    await hämta();
    rita();
  }

  function rita() {
    const fam = $('#tl-familjer'), host = $('#tl-lista'), sam = $('#tl-sam'), chips = $('#tl-chips'), fot = $('#tl-fot');
    if (T.saknas) {
      fam.innerHTML = '<p class="vy-tom">Syskontillägget finns inte än: migrationen syskontillagg_som_skuld är inte körd.</p>';
      host.innerHTML = ''; sam.innerHTML = ''; chips.innerHTML = ''; fot.textContent = '';
      return;
    }
    if (T.fel) { fam.innerHTML = '<p class="vy-tom">Tillägget gick inte att hämta: ' + esc(T.fel) + '</p>'; return; }

    const upplupet = T.familjer.reduce((n, f) => n + Number(f.upplupet_ore || 0), 0);
    const pågår = T.familjer.reduce((n, f) => n + Number(f.i_betalning_ore || 0), 0);
    const spärrade = T.familjer.filter(f => f.sparr).length;
    const ruta = (klass, rubrik, tal, under) => '<div' + (klass ? ' class="' + klass + '"' : '') + '><small>'
      + esc(rubrik) + '</small><b>' + esc(tal) + '</b><span>' + esc(under) + '</span></div>';
    sam.innerHTML = ruta(upplupet ? 'ar-gor' : '', 'Upplupet', kronor(upplupet),
        T.familjer.length === 1 ? '1 familj' : T.familjer.length + ' familjer')
      + ruta('', 'I en betalning', kronor(pågår), 'kassan är öppen')
      + ruta(spärrade ? 'ar-gor' : '', 'Spärrade', String(spärrade), spärrade === 1 ? 'familj' : 'familjer');

    fam.innerHTML = T.familjer.length
      ? '<div class="vy-kort vy-lista">' + T.familjer.map(f => '<div class="vy-rad tl-familj">'
        + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + familjLänk(f.familj) + '</span>'
        + '<span class="vy-rad-meta"><span>' + esc(kronor(f.upplupet_ore)) + ' upplupet, '
        + esc(f.upplupna === 1 ? '1 pass' : f.upplupna + ' pass') + '</span>'
        + (Number(f.i_betalning_ore) > 0 ? '<span>' + esc(kronor(f.i_betalning_ore)) + ' i en betalning</span>' : '')
        + '<span>Äldsta ' + esc(dag(f.aldsta_upplupen_at)) + '</span>'
        + '<span>' + esc(f.senaste_paminnelse ? 'Påmind ' + dag(f.senaste_paminnelse) : 'Inte påmind') + '</span></span></span>'
        + (f.sparr ? pill(SPÄRR[f.sparr] || 'Spärrad', 'ar-ny') : pill('Ingen spärr', 'ar-klar'))
        + (Number(f.upplupna) > 0 ? knapp('data-tl-paminn', f.familj, 'Skicka påminnelse') : '')
        + '</div>').join('') + '</div>'
      : '<p class="vy-tom">Ingen familj har obetalt tillägg.</p>';

    chips.innerHTML = FILTER.map(([k, t]) => '<button type="button" class="chip" data-tl-filter="' + k
      + '" aria-pressed="' + (T.filter === k) + '">' + esc(t) + '</button>').join('');
    const synliga = T.poster.filter(p => (T.filter === 'alla' ? true
        : T.filter === 'obetalt' ? (p.status === 'upplupen' || p.status === 'i_betalning')
        : p.status === T.filter)
      && (!T.sök || namnFör(p.familj_id).toLowerCase().indexOf(T.sök) !== -1));
    host.innerHTML = synliga.length
      ? '<div class="vy-kort vy-lista">' + synliga.map(rad).join('') + '</div>'
      : '<p class="vy-tom">' + (T.poster.length ? 'Inga poster som passar.' : 'Inga pass med extra barn än.') + '</p>';

    const i = T.inst;
    fot.textContent = i
      ? 'Gränserna: spärr över ' + kronor(i.max_upplupet_ore) + ' eller efter ' + i.sparr_efter_dagar + ' dagar, påminnelse efter '
        + i.paminnelse_dagar + ' dagar, sen avbokning inom ' + i.sen_avbokning_timmar + ' timmar ('
        + (i.debitera_vid_sen_avbokning ? 'tillägget uppstår' : 'inget tillägg') + '), och tillägget följer med nästa köp '
        + (i.obligatorisk_i_nasta_betalning ? 'alltid' : 'om familjen vill') + '. Villkorens version: ' + i.villkor_version
        + '. Ändras i tillagg_installning.'
      : '';
  }

  function rad(p) {
    const l = LÄGE[p.status] || [p.status, ''];
    const r = T.rader[p.id];
    const tvist = r && T.tvist[r.betalning_id];
    const kvar = r ? Number(r.belopp_ore) - Number(r.aterbetalt_ore || 0) : 0;
    return '<div class="vy-rad tl-post" data-tl-post="' + esc(p.id) + '">'
      + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + familjLänk(p.familj_id) + ' · pass '
      + esc(dag(p.pass_start)) + '</span>'
      + '<span class="vy-rad-meta"><span>' + esc(p.antal_extra_barn === 1 ? '1 extra barn' : p.antal_extra_barn + ' extra barn')
      + ', ' + esc(NXBetalning.timmar(p.minuter)) + '</span>'
      + (p.upplupen_at ? '<span>Upplupen ' + esc(dag(p.upplupen_at)) + '</span>' : '')
      + (p.betald_at ? '<span>Betald ' + esc(dag(p.betald_at)) + '</span>' : '')
      + (Number(p.aterbetalt_ore) > 0 ? '<span>' + esc(kronor(p.aterbetalt_ore)) + ' tillbaka</span>' : '')
      + '</span>'
      + (p.orsak ? '<span class="tl-orsak">' + esc(p.orsak) + '</span>' : '')
      + '</span>'
      + '<span class="vy-rad-belopp">' + esc(kronor(p.belopp_ore)) + '</span>'
      + pill(l[0], l[1]) + (tvist ? ' ' + pill('Tvist', 'ar-ny') : '')
      + (p.status === 'bokad' || p.status === 'upplupen' ? knapp('data-tl-frigor', p.id, 'Frigör') : '')
      + (p.status === 'upplupen' ? knapp('data-tl-skriv-av', p.id, 'Avskriv') : '')
      + (p.status === 'betald' && r && kvar > 0 && !tvist ? knapp('data-aterbetala-rad', r.id, 'Återbetala') : '')
      + '</div>';
  }

  /* Orsaken krävs, 3–500 tecken, som databasen. */
  async function orsak(titel, text, knapptext) {
    return fråga({
      titel, text,
      innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="tl-orsak">Orsak (krävs)</label>'
        + '<textarea class="inp" id="tl-orsak" rows="3" maxlength="500" required></textarea>'
        // Orsaken står med posten så länge betalningen sparas (bokföringen), så inga namn.
        + '<span class="tl-orsak-not">Sparas med posten och ändras aldrig. Skriv varför, utan namn.</span></div>',
      knapp: knapptext,
      läs: ruta => {
        const o = ((ruta.querySelector('#tl-orsak') || {}).value || '').trim();
        return o.length >= 3 ? { värde: o } : { fel: 'Skriv orsaken, minst tre tecken.' };
      }
    });
  }

  document.addEventListener('click', async e => {
    const f = e.target.closest('[data-tl-filter]');
    if (f) { T.filter = f.dataset.tlFilter; rita(); return; }

    const pm = e.target.closest('[data-tl-paminn]');
    if (pm) {
      await medan(pm, 'Skickar…', async () => {
        const { data, error } = await supa.rpc('tillagg_paminn', { p_familj: pm.dataset.tlPaminn });
        if (error) { alert(felText(error)); return; }
        if (!data) alert('Ingen påminnelse gick: familjen fick en i dag redan, eller har inget upplupet tillägg.');
        await ritaTillagg();
      });
      return;
    }

    const fr = e.target.closest('[data-tl-frigor]');
    if (fr) {
      const o = await orsak('Frigör tillägget?', 'Inget ska betalas för passet, till exempel när det inte hölls av '
        + 'studiehjälparens skuld. Orsaken står på posten.', 'Frigör');
      if (!o) return;
      await medan(fr, 'Frigör…', async () => {
        const { error } = await supa.rpc('tillagg_frigor', { p_post: fr.dataset.tlFrigor, p_orsak: o });
        if (error) { alert(felText(error)); return; }
        await ritaTillagg();
      });
      return;
    }

    const sa = e.target.closest('[data-tl-skriv-av]');
    if (sa) {
      const o = await orsak('Skriv av tillägget?', 'Skulden drivs inte in. Orsaken står på posten, och att den skrevs av '
        + 'och av vem står i auditloggen.', 'Skriv av');
      if (!o) return;
      await medan(sa, 'Skriver av…', async () => {
        const { error } = await supa.rpc('tillagg_skriv_av', { p_post: sa.dataset.tlSkrivAv, p_orsak: o });
        if (error) { alert(felText(error)); return; }
        await ritaTillagg();
      });
    }
  });

  document.addEventListener('input', e => {
    const s = e.target.closest('#tl-sok');
    if (!s) return;
    T.sök = s.value.trim().toLowerCase();
    rita();
  });

  Object.assign(NXAdmin.rita, { ritaTillagg });
})();
