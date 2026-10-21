/* ============================================================
   NEXTRUM — adminvyn: värvningsbonusen (varvningsbonus, 2026-10-21)

   Leo: "Admin, sektion Värvningsbonus: tabell med värvare, värvad,
   belopp (brutto, grund, semester), status och datum, filter på månad
   och status, knapparna Markera utbetald (period obligatorisk) och
   Annullera (orsak obligatorisk), summering per värvare och månad,
   CSV-export för revisor och lön. Allt loggas."

   Raderna står i S.varvningsbonus (kärnan hämtar dem, med lönemånaden
   manad: månaden bonusen tjänades in). Inget betalas ut härifrån: Markera
   utbetald säger att lönen med bonusen har gått, och Annullera att den
   inte ska betalas. Båda görs i databasen (varvningsbonus_utbetald,
   varvningsbonus_annullera), som bara släpper fram en superadmin, bara
   låter läget gå framåt och loggar vem (andrad_av och auditloggen).
   Löner ritar samma knappar i sin ruta, och de sköts härifrån.

   Skälet är fritext från admin och visas som text. Före migrationen står
   en rad om det.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, felText, datumText } = NX;
  const { medan, tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { S, fråga, hämtaAlla, namnFör, pill, tabell, ärSuperadmin } = NXAdmin;

  const V = { status: 'alla', månad: 'alla' };

  const LÄGE = {
    vantar: ['Väntar', 'ar-vantar'], intjanad: ['Intjänad', 'ar-ny'],
    utbetald: ['Utbetald', 'ar-klar'], annullerad: ['Annullerad', '']
  };
  const FILTER = [['alla', 'Alla'], ['vantar', 'Väntar'], ['intjanad', 'Intjänade'], ['utbetald', 'Utbetalda'],
    ['annullerad', 'Annullerade']];
  const HÄNDELSE = {
    konto_skapat: 'när kompisen fått sitt konto',
    prov_godkant: 'när kompisen klarat utbildningsprovet',
    forsta_pass_genomfort: 'när kompisen hållit sitt första pass',
    tipsbonus: 'när vi tog in kompisen (bonusen för tips, före 2026-10-21)'
  };

  const knapp = (attr, värde, text) => '<button class="btn btn-ghost btn-sm" type="button" ' + attr + '="'
    + esc(värde) + '">' + esc(text) + '</button>';
  const tutorLänk = id => id ? '<button type="button" class="eko-lank" data-dp="studiehjalpare:' + esc(id) + '">'
    + esc(namnFör(id)) + '</button>' : '';
  const ansökan = id => (S.ansokningar || []).find(a => a.id === id);
  // Månaden en rad hör till i filtret: den intjänade, annars när ansökan kom in.
  /* Dagarna och månaderna i Stockholms tid, inte i webbläsarens eller i UTC. */
  const sthlmDag = t => t ? new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) : '';
  const sthlmMånad = t => t ? sthlmDag(t).slice(0, 7) + '-01' : null;
  const dagText = t => t ? datumText(sthlmDag(t)) : '—';
  const radensMånad = b => b.manad || sthlmMånad(b.skapad_at);
  const månadText = m => m ? NXStudie.månadsNamn(m).replace(/^./, c => c.toUpperCase()) : '—';

  function värvad(b) {
    if (b.varvad_profil_id) return tutorLänk(b.varvad_profil_id);
    const a = b.varvad_ansokan_id ? ansökan(b.varvad_ansokan_id) : null;
    return a ? '<button type="button" class="eko-lank" data-dp="ansokan:' + esc(a.id) + '">' + esc(a.name || 'Ansökan')
      + '</button><span class="adm-und">ansökan</span>' : '<span>—</span>';
  }

  function synliga() {
    return (S.varvningsbonus || []).filter(b => (V.status === 'alla' || b.status === V.status)
      && (V.månad === 'alla' || radensMånad(b) === V.månad));
  }

  function ritaVarvning() {
    const host = $('#vb-lista');
    if (!ärSuperadmin() || !host) return;
    const sam = $('#vb-sam'), chips = $('#vb-chips'), man = $('#vb-manad'), summa = $('#vb-summa'), om = $('#vb-om');
    if (S.varvningFel === 'saknas') {
      host.innerHTML = '<p class="vy-tom">Värvningsbonusen finns inte än: migrationen varvningsbonus är inte körd.</p>';
      [sam, chips, summa].forEach(x => { if (x) x.innerHTML = ''; });
      return;
    }
    if (S.varvningFel) { host.innerHTML = tomt('Bonusarna gick inte att läsa', S.varvningFel); return; }

    const i = S.varvningInst;
    if (om) {
      om.textContent = i
        ? kronor(i.brutto_ore) + ' brutto, inklusive semesterersättning (' + String(i.semester_procent).replace('.', ',')
          + ' %), ' + (HÄNDELSE[i.utlosare] || i.utlosare) + '. Ändras i varvning_installning; en intjänad bonus '
          + 'behåller sitt belopp och sin delning.'
        : '';
    }

    const alla = S.varvningsbonus || [];
    const summaAv = (lista, f) => lista.reduce((n, b) => n + Number(b[f] || 0), 0);
    const ruta = (klass, rubrik, tal, under) => '<div' + (klass ? ' class="' + klass + '"' : '') + '><small>'
      + esc(rubrik) + '</small><b>' + esc(tal) + '</b><span>' + esc(under) + '</span></div>';
    const väntar = alla.filter(b => b.status === 'vantar');
    const intjänade = alla.filter(b => b.status === 'intjanad');
    const utbetalda = alla.filter(b => b.status === 'utbetald');
    if (sam) {
      sam.innerHTML = ruta('', 'Väntar', String(väntar.length), väntar.length === 1 ? 'ansökan' : 'ansökningar')
        + ruta(intjänade.length ? 'ar-gor' : '', 'Intjänade, inte utbetalda', kronor(summaAv(intjänade, 'brutto_ore')),
          intjänade.length === 1 ? '1 bonus' : intjänade.length + ' bonusar')
        + ruta('', 'Utbetalt', kronor(summaAv(utbetalda, 'brutto_ore')),
          utbetalda.length === 1 ? '1 bonus' : utbetalda.length + ' bonusar');
    }
    if (chips) {
      chips.innerHTML = FILTER.map(([k, t]) => '<button type="button" class="chip" data-vb-filter="' + k
        + '" aria-pressed="' + (V.status === k) + '">' + esc(t) + '</button>').join('');
    }
    if (man) {
      const månader = Array.from(new Set(alla.map(radensMånad).filter(Boolean))).sort().reverse();
      if (V.månad !== 'alla' && månader.indexOf(V.månad) === -1) V.månad = 'alla';
      man.innerHTML = '<option value="alla">Alla månader</option>'
        + månader.map(m => '<option value="' + esc(m) + '"' + (m === V.månad ? ' selected' : '') + '>'
          + esc(månadText(m)) + '</option>').join('');
    }

    const rader = synliga().slice().sort((a, b) => String(b.intjanad_at || b.skapad_at)
      .localeCompare(String(a.intjanad_at || a.skapad_at)));
    const bulk = rader.filter(b => b.status === 'intjanad');
    host.innerHTML = (bulk.length > 1
      ? '<p class="vb-bulk">' + knapp('data-varv-utbetald-alla', bulk.map(b => b.id).join(','),
        'Markera ' + bulk.length + ' intjänade i urvalet utbetalda') + '</p>'
      : '')
      + tabell([
        { namn: 'Värvare', rita: b => tutorLänk(b.varvare_profil_id) },
        { namn: 'Värvad', rita: värvad },
        { namn: 'Belopp', rita: b => '<span class="adm-tal">' + esc(kronor(b.brutto_ore)) + '</span>'
          + (b.grundersattning_ore != null
            ? '<span class="adm-und">' + esc(kronor(b.grundersattning_ore)) + ' grund + '
              + esc(kronor(b.semesterersattning_ore)) + ' semester</span>'
            : '<span class="adm-und">delas när den tjänas in</span>') },
        { namn: 'Läge', rita: b => pill((LÄGE[b.status] || [b.status])[0], (LÄGE[b.status] || [])[1])
          + (b.status === 'utbetald' && b.utbetald_period ? '<span class="adm-und">lönen för ' + esc(b.utbetald_period) + '</span>' : '')
          + (b.status === 'annullerad' && b.annullerad_orsak ? '<span class="adm-und vb-orsak">' + esc(b.annullerad_orsak) + '</span>' : '') },
        { namn: 'Datum', rita: b => '<span class="adm-und">sökte ' + esc(dagText(b.skapad_at)) + '</span>'
          + (b.intjanad_at ? '<span class="adm-und">intjänad ' + esc(dagText(b.intjanad_at)) + '</span>' : '')
          + (b.utbetald_at ? '<span class="adm-und">utbetald ' + esc(dagText(b.utbetald_at)) + '</span>' : '')
          + (b.annullerad_at ? '<span class="adm-und">annullerad ' + esc(dagText(b.annullerad_at)) + '</span>' : '') },
        { namn: '', höger: true, rita: b => (b.status === 'intjanad' ? knapp('data-varv-utbetald', b.id, 'Markera utbetald') : '')
          + (b.status === 'intjanad' || b.status === 'vantar' ? ' ' + knapp('data-varv-annullera', b.id, 'Annullera') : '') }
      ], rader, V.status === 'alla' && V.månad === 'alla' ? 'Ingen har sökt med en studiehjälpares kod än.'
        : 'Inga bonusar som passar.');

    /* Summeringen per värvare och månad: det intjänade och utbetalda, i
       lönemånaden (månaden det tjänades in). */
    if (summa) {
      const grupper = new Map();
      alla.filter(b => (b.status === 'intjanad' || b.status === 'utbetald') && b.manad
          && (V.månad === 'alla' || b.manad === V.månad))
        .forEach(b => {
          const k = b.varvare_profil_id + '|' + b.manad;
          if (!grupper.has(k)) grupper.set(k, { varvare: b.varvare_profil_id, manad: b.manad, rader: [] });
          grupper.get(k).rader.push(b);
        });
      const lista = Array.from(grupper.values()).sort((a, b) => b.manad.localeCompare(a.manad)
        || namnFör(a.varvare).localeCompare(namnFör(b.varvare), 'sv'));
      summa.innerHTML = tabell([
        { namn: 'Värvare', rita: g => tutorLänk(g.varvare) },
        { namn: 'Lönemånad', rita: g => esc(månadText(g.manad)) },
        { namn: 'Antal', rita: g => '<span class="adm-tal">' + g.rader.length + '</span>' },
        { namn: 'Brutto', rita: g => '<span class="adm-tal">' + esc(kronor(summaAv(g.rader, 'brutto_ore'))) + '</span>' },
        { namn: 'Grund', rita: g => esc(kronor(summaAv(g.rader, 'grundersattning_ore'))) },
        { namn: 'Semester', rita: g => esc(kronor(summaAv(g.rader, 'semesterersattning_ore'))) },
        { namn: 'Utbetalt', höger: true, rita: g => esc(kronor(summaAv(g.rader.filter(b => b.status === 'utbetald'), 'brutto_ore'))) }
      ], lista, 'Ingen intjänad bonus' + (V.månad === 'alla' ? '' : ' i ' + månadText(V.månad).toLowerCase()) + '.');
    }
  }

  /* ---------- CSV för revisorn och lönen ----------
     Urvalet som står i listan. Semikolon och decimalkomma, som svenska
     Excel läser, och ett BOM så att å, ä och ö kommer med. Ören som heltal
     bredvid kronorna, så att ingen avrundning kan smyga in. */
  const kr = öre => öre == null ? '' : (Number(öre) / 100).toFixed(2).replace('.', ',');
  const fält = v => {
    const t = v == null ? '' : String(v);
    return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  function csv(rader) {
    const huvud = ['id', 'värvare', 'värvad', 'läge', 'brutto_kr', 'grund_kr', 'semester_kr', 'brutto_ore', 'grund_ore',
      'semester_ore', 'semester_procent', 'händelse', 'sökte', 'intjänad', 'lönemånad', 'utbetald', 'utbetald_lönemånad',
      'annullerad', 'skäl'];
    const rad = b => {
      const a = b.varvad_ansokan_id ? ansökan(b.varvad_ansokan_id) : null;
      return [b.id, namnFör(b.varvare_profil_id), b.varvad_profil_id ? namnFör(b.varvad_profil_id) : (a && a.name) || '',
        (LÄGE[b.status] || [b.status])[0], kr(b.brutto_ore), kr(b.grundersattning_ore), kr(b.semesterersattning_ore),
        b.brutto_ore, b.grundersattning_ore, b.semesterersattning_ore,
        b.semester_procent == null ? '' : String(b.semester_procent).replace('.', ','), b.utlosare || '',
        sthlmDag(b.skapad_at), sthlmDag(b.intjanad_at),
        b.manad ? b.manad.slice(0, 7) : '', sthlmDag(b.utbetald_at), b.utbetald_period || '',
        sthlmDag(b.annullerad_at), b.annullerad_orsak || ''].map(fält).join(';');
    };
    return '﻿' + [huvud.join(';')].concat(rader.map(rad)).join('\r\n') + '\r\n';
  }

  /* ---------- handlingarna ---------- */
  async function laddaOm() {
    const { data, error } = await hämtaAlla('varvningsbonus', '*', q => q.order('skapad_at', { ascending: false }));
    if (!error) {
      S.varvningsbonus = (data || []).map(b => Object.assign({}, b, {
        manad: sthlmMånad(b.intjanad_at)
      }));
    }
    ritaVarvning();
    if (NXAdmin.rita.ritaLöner) NXAdmin.rita.ritaLöner();
  }

  /* Lönemånaden som ÅÅÅÅ-MM, som databasen kräver. Förslaget är månaden
     bonusen tjänades in, den lön den hör till. */
  async function frågaPeriod(titel, text, förslag) {
    return fråga({
      titel, text,
      innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="vb-period">Lönemånad (ÅÅÅÅ-MM)</label>'
        + '<input class="inp" id="vb-period" inputmode="numeric" maxlength="7" autocomplete="off" value="'
        + esc(förslag || '') + '" placeholder="2026-11"></div>',
      knapp: 'Markera utbetald',
      läs: ruta => {
        const v = ((ruta.querySelector('#vb-period') || {}).value || '').trim();
        return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? { värde: v } : { fel: 'Skriv lönemånaden som ÅÅÅÅ-MM, till exempel 2026-11.' };
      }
    });
  }

  async function markera(knappen, ids) {
    const rader = (S.varvningsbonus || []).filter(b => ids.indexOf(b.id) !== -1 && b.status === 'intjanad');
    if (!rader.length) return;
    const månader = Array.from(new Set(rader.map(b => b.manad).filter(Boolean)));
    const period = await frågaPeriod(rader.length === 1 ? 'Markera bonusen utbetald?' : 'Markera ' + rader.length + ' bonusar utbetalda?',
      (rader.length === 1 ? kronor(rader[0].brutto_ore) + ' till ' + namnFör(rader[0].varvare_profil_id)
        : kronor(rader.reduce((n, b) => n + Number(b.brutto_ore || 0), 0)) + ' sammanlagt')
        + '. Markera bara när lönen med bonusen har gått. Det går inte att ångra.',
      månader.length === 1 ? månader[0].slice(0, 7) : '');
    if (!period) return;
    await medan(knappen, 'Markerar…', async () => {
      const { data, error } = await supa.rpc('varvningsbonus_utbetald', { p_ids: rader.map(b => b.id), p_period: period });
      if (error) { alert(felText(error)); return; }
      if (Number(data) !== rader.length) {
        alert(Number(data || 0) + ' av ' + rader.length + ' markerades. Någon hann ändras sedan sidan hämtades.');
      }
      await laddaOm();
    });
  }

  document.addEventListener('click', async e => {
    const f = e.target.closest('[data-vb-filter]');
    if (f) { V.status = f.dataset.vbFilter; ritaVarvning(); return; }

    const ut = e.target.closest('[data-varv-utbetald]');
    if (ut) { await markera(ut, [ut.dataset.varvUtbetald]); return; }
    const alla = e.target.closest('[data-varv-utbetald-alla]');
    if (alla) { await markera(alla, alla.dataset.varvUtbetaldAlla.split(',')); return; }

    const an = e.target.closest('[data-varv-annullera]');
    if (an) {
      const b = (S.varvningsbonus || []).find(x => x.id === an.dataset.varvAnnullera);
      if (!b) return;
      const orsak = await fråga({
        titel: 'Annullera bonusen?',
        text: kronor(b.brutto_ore) + ' till ' + namnFör(b.varvare_profil_id) + '. En annullerad bonus betalas inte och '
          + 'kan inte tjänas in igen. Skälet står på bonusen, och vem som annullerade står i auditloggen.',
        innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="vb-orsak">Skäl (krävs)</label>'
          + '<textarea class="inp" id="vb-orsak" rows="3" maxlength="500" required></textarea>'
          + '<span class="tl-orsak-not">Sparas med bonusen och ändras aldrig. Skriv varför, utan namn.</span></div>',
        knapp: 'Annullera',
        läs: ruta => {
          const o = ((ruta.querySelector('#vb-orsak') || {}).value || '').trim();
          return o.length >= 3 ? { värde: o } : { fel: 'Skriv skälet, minst tre tecken.' };
        }
      });
      if (!orsak) return;
      await medan(an, 'Annullerar…', async () => {
        const { data, error } = await supa.rpc('varvningsbonus_annullera', { p_id: b.id, p_orsak: orsak });
        if (error) { alert(felText(error)); return; }
        if (data === 'utbetald') alert('Bonusen är redan utbetald och kan inte annulleras.');
        await laddaOm();
      });
      return;
    }

    const exp = e.target.closest('[data-vb-csv]');
    if (exp) {
      const rader = synliga();
      const url = URL.createObjectURL(new Blob([csv(rader)], { type: 'text/csv;charset=utf-8' }));
      const länk = document.createElement('a');
      länk.href = url;
      länk.download = 'nextrum-varvningsbonus-' + (V.månad === 'alla' ? 'alla' : V.månad.slice(0, 7))
        + (V.status === 'alla' ? '' : '-' + V.status) + '.csv';
      document.body.appendChild(länk);
      länk.click();
      länk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  });

  document.addEventListener('change', e => {
    const m = e.target.closest('#vb-manad');
    if (!m) return;
    V.månad = m.value || 'alla';
    ritaVarvning();
  });

  Object.assign(NXAdmin.rita, { ritaVarvning });
})();
