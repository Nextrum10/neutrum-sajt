/* ============================================================
   NEXTRUM — adminvyn, detaljpanelen (familj, elev, studiehjälpare)

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

  const { BOK_LAGE, DP, FAKT_LAGE, S, SH_LAGE, UTB_LAGE, barnFel, elevHjälpare,
          elevNamn, hämtaAllt, hämtaMatchunderlag, punkt, kontaktaRuta, kopplaBarn, kortDatum,
          läge, läsBarn, namnFör, närText, numreraBarn, pill, rad, saknasFunktion, skapaBarn, telHref,
          uppräkning, öppnaRuta } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaElever = (...a) => NXAdmin.rita.ritaElever(...a);
  const ritaFamiljer = (...a) => NXAdmin.rita.ritaFamiljer(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* ============================================================
     DETALJPANELEN

     En familj, en elev eller en studiehjälpare, öppnad från vilken
     lista som helst. Samma panel för alla tre — det som skiljer är
     vilka flikar den har och vad som hämtas.

     HÄMTAS NÄR DEN ÖPPNAS, INTE I FÖRVÄG

     Studieplaner, läxor, material, utvecklingsområden, rapporter
     och tillgänglighet för ALLA vore sju frågor till vid varje
     sidladdning, och nästan ingenting av det tittar man på. Med
     två elever spelar det ingen roll. Med hundra gör det det, och
     då är det för sent att ändra arkitektur.

     Panelen cachar per person i S.detaljCache: öppnar man samma
     familj två gånger i rad hämtas ingenting andra gången.
     ============================================================ */

  function byggPanel() {
    if (DP.panel) return;

    DP.bak = document.createElement('div');
    DP.bak.className = 'dp-bak';
    DP.bak.hidden = true;
    DP.bak.addEventListener('click', stängDetalj);

    DP.panel = document.createElement('aside');
    DP.panel.className = 'dp';
    DP.panel.hidden = true;
    DP.panel.setAttribute('role', 'dialog');
    DP.panel.setAttribute('aria-modal', 'true');
    DP.panel.setAttribute('aria-label', 'Detaljer');

    document.body.appendChild(DP.bak);
    document.body.appendChild(DP.panel);

    DP.panel.addEventListener('click', e => {
      if (e.target.closest('[data-dp-stang]')) { stängDetalj(); return; }
      const f = e.target.closest('[data-dp-flik]');
      if (f) { DP.flik = f.dataset.dpFlik; ritaDetalj(); }
    });

    /* Inte när en ruta ligger ovanpå panelen. Då är Escape rutans:
       förut stängde samma tangenttryck både bekräftelsen och panelen
       bakom den, och den som ångrade sig tappade bort var hen var. */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !DP.panel || DP.panel.hidden) return;
      if (document.querySelector('.nx-fraga')) return;
      stängDetalj();
    });
  }

  function stängDetalj() {
    if (!DP.panel) return;
    DP.panel.classList.remove('ar-oppen');
    DP.bak.classList.remove('ar-oppen');
    DP.typ = null; DP.id = null;
    /* Vänta ut övergången innan hidden sätts, annars hoppar
       panelen bort i stället för att glida. */
    setTimeout(() => {
      if (DP.typ) return;           // hann öppnas igen
      DP.panel.hidden = true;
      DP.bak.hidden = true;
    }, 280);
    if (DP.sistaFokus && DP.sistaFokus.focus) DP.sistaFokus.focus();
  }

  /* ------------------------------------------------------------
     HÄMTNINGEN
     En fråga per tabell panelen behöver, alla parallellt. Vad som
     behövs beror på typ: en studiehjälpare har ingen studieplan,
     en familj har ingen tillgänglighet.
     ------------------------------------------------------------ */
  async function hämtaDetalj(typ, id) {
    const nyckel = typ + ':' + id;
    if (S.detaljCache[nyckel]) return S.detaljCache[nyckel];

    const d = { fel: null };
    const frågor = [];
    const namn = [];

    function lägg(n, q) { namn.push(n); frågor.push(q); }

    if (typ === 'elev') {
      lägg('plan', supa.from('study_plans')
        .select('subject, goals, plan_text, updated_at').eq('student_id', id)
        .order('updated_at', { ascending: false }).limit(1));
      lägg('laxor', supa.from('homework')
        .select('id, title, subject, due_date, status, created_at').eq('student_id', id)
        .order('due_date', { ascending: false }).limit(50));
      lägg('material', supa.from('materials')
        .select('id, title, kind, subject, url, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(50));
      lägg('utveckling', supa.from('progress_items')
        .select('id, subject, area, level, comment, updated_at').eq('student_id', id)
        .order('subject').order('area'));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, went_well, needs_practice, next_focus, ai_feedback, created_at')
        .eq('student_id', id).order('lesson_date', { ascending: false }).limit(30));
    } else if (typ === 'studiehjalpare') {
      lägg('tillgang', supa.from('tutor_availability')
        .select('weekday, start_time, end_time').eq('tutor_id', id).order('weekday'));
      lägg('blockerat', supa.from('tutor_blocked')
        .select('block_date, block_time, reason').eq('tutor_id', id)
        .gte('block_date', isoFor(new Date())).order('block_date').limit(30));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, student_id, lesson_date, created_at').eq('tutor_id', id)
        .order('lesson_date', { ascending: false }).limit(30));
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));
      /* Utbetalningsmetoden (program 2, Fas 1.7), maskerad: bara de
         fyra sista siffrorna. Tabellen går inte att läsa direkt, bara
         genom funktionen. Funktionen väntar på ett ja innan den
         driftsätts; saknas den är svaret "inga uppgifter", inte ett
         fel, se nedan. */
      lägg('utbetalning', supa.rpc('las_utbetalningsmetod', { p_tutor: id }));
    } else {
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));

      /* Tidslinjen. Anmälningarna och meddelandena finns inte i S:
         S.chattar är en rad per tråd, och S.meddelanden är kapad
         till de 400 senaste i hela systemet — en familj som varit
         tyst en månad hade då fått en tom tidslinje trots att
         tråden finns. Pass, fakturor, noteringar och uppgifter
         ligger redan i minnet och hämtas inte om. */
      lägg('anmalningar', supa.from('leads')
        .select('id, created_at, kontaktad_at, status, subject, tjanst, uppdrag_id')
        .eq('kund_id', id).order('created_at', { ascending: false }));
      lägg('meddelanden', supa.from('messages')
        .select('id, sender_id, body, created_at').eq('parent_id', id)
        .order('created_at', { ascending: false }).limit(60));
    }

    /* Varje fråga fångas var för sig.

       Promise.all avvisar vid FÖRSTA felet, och då kastades
       undantaget hela vägen ut — panelen blev stående på "Hämtar"
       i varenda flik, även de som inte hade med den trasiga
       frågan att göra. En saknad tabell eller ett tappat nät
       räckte för att frysa hela vyn.

       Nu blir ett fel ett fel i EN flik. Resten ritas. */
    const svar = await Promise.all(frågor.map(q =>
      Promise.resolve(q).then(
        r => r,
        e => ({ data: null, error: e })
      )));

    svar.forEach((r, i) => {
      d[namn[i]] = (r && r.data) || [];
      if (r && r.error) d[namn[i] + 'Fel'] = felText(r.error);
    });

    /* En funktion som inte finns i databasen än är ett läge, inte ett
       fel att visa. Panelen säger då samma sak som när ingen lämnat
       några uppgifter, för för admin är det samma sak. */
    const ui = namn.indexOf('utbetalning');
    if (ui !== -1 && svar[ui] && svar[ui].error && saknasFunktion(svar[ui].error, svar[ui].status)) {
      d.utbetalning = [];
      delete d.utbetalningFel;
    }

    S.detaljCache[nyckel] = d;
    return d;
  }

  /* ------------------------------------------------------------
     FLIKARNA PER TYP
     ------------------------------------------------------------ */
  const DP_FLIKAR = {
    familj:         [['oversikt', 'Översikt'], ['barn', 'Barn'], ['pass', 'Pass'],
                     ['ekonomi', 'Ekonomi'], ['tidslinje', 'Tidslinje'],
                     ['anteckningar', 'Anteckningar']],
    elev:           [['oversikt', 'Översikt'], ['pass', 'Pass'], ['uppgifter', 'Uppgifter'],
                     ['utveckling', 'Utveckling'], ['rapporter', 'Rapporter']],
    studiehjalpare: [['oversikt', 'Översikt'], ['elever', 'Elever'], ['pass', 'Pass'],
                     ['tider', 'Tider'], ['ersattning', 'Ersättning'],
                     ['anteckningar', 'Anteckningar']]
  };

  async function öppnaDetalj(typ, id) {
    if (!DP_FLIKAR[typ]) return;
    byggPanel();
    DP.sistaFokus = document.activeElement;
    DP.typ = typ; DP.id = id;
    DP.flik = DP_FLIKAR[typ][0][0];

    DP.bak.hidden = false;
    DP.panel.hidden = false;
    /* Två bildrutor innan klassen sätts, annars hinner webbläsaren
       inte se starttillståndet och övergången uteblir. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      DP.bak.classList.add('ar-oppen');
      DP.panel.classList.add('ar-oppen');
    }));

    ritaDetalj(true);
    await hämtaDetalj(typ, id);
    if (DP.typ === typ && DP.id === id) ritaDetalj();
  }


  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function dpFakta(rader) {
    return '<div class="dp-fakta">' + rader.map(r =>
      '<div><span>' + esc(r[0]) + '</span>'
      + (r[1] ? '<span>' + r[1] + '</span>'
              : '<span class="ar-tom">' + esc(r[2] || 'ej angivet') + '</span>')
      + '</div>').join('') + '</div>';
  }

  function dpRubrik(text, extra) {
    return '<div class="dp-rubrik"><span>' + esc(text) + '</span>'
      + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</div>';
  }

  function dpTal(par) {
    return '<div class="dp-tal">' + par.map(p =>
      '<div><b>' + esc(String(p[0])) + '</b><span>' + esc(p[1]) + '</span></div>').join('') + '</div>';
  }

  function dpRad(rubrik, under, höger) {
    return '<div class="dp-rad"><div><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '') + '</div>'
      + '<span class="dp-rad-hoger">' + (höger || '') + '</span></div>';
  }

  function passFör(filter) {
    return S.bokningar.filter(filter).sort((a, b) =>
      String(b.wanted_date + (b.wanted_time || ''))
        .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));
  }

  /* ------------------------------------------------------------
     KUNDTIDSLINJEN (Fas 7.1)

     Allt som hänt familjen i en enda lista, nyast först. Den svarar
     på frågan "vad har hänt med de här?", som annars kräver fem
     flikar och ett gott minne.

     INGEN HÄNDELSE HITTAS PÅ. Varje rad har en tidsstämpel ur
     databasen. Matchningen står därför INTE här: students har
     ingen kolumn som säger när den gjordes, och att använda
     radens created_at hade satt matchningen till den dag barnet
     lades in. Ett ungefärligt datum i en tidslinje är värre än
     inget datum, för det ser exakt ut.
     ------------------------------------------------------------ */
  const TL_MAX = 80;

  function tlKort(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > (max || 90) ? t.slice(0, (max || 90) - 1) + '…' : t;
  }

  /* Tidpunkten i klartext. närText säger "för 2 timmar sedan" och
     byggdes för aktivitetsflödet, som bara innehåller dåtid — för
     något som ligger framåt svarar den med enbart ett klockslag, och
     då stod "5 oktober kl. 16" som "16:00" mitt bland gårdagens
     rader. Tidslinjen innehåller både och, så framtiden får sitt
     datum utskrivet. */
  function tlNär(iso, framtid) {
    if (!framtid) return närText(iso);
    const d = new Date(iso);
    const tid = isNaN(d) ? '' : ' kl. '
      + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return kortDatum(String(iso).slice(0, 10)) + (tid === ' kl. 00:00' ? '' : tid);
  }

  function dpTidslinje(p, d) {
    const h = [];
    const lägg = (när, rubrik, under) => {
      if (när) h.push({ när: när, rubrik: rubrik, under: under || '' });
    };

    lägg(p.created_at, 'Konto skapat', p.email || '');

    (d.anmalningar || []).forEach(l => {
      lägg(l.created_at, 'Intresseanmälan',
        [l.subject, l.tjanst].filter(Boolean).join(' · '));
      lägg(l.kontaktad_at, 'Anmälan kontaktad', '');
    });

    const barn = S.elever[p.id] || [];
    barn.forEach(e => lägg(e.created_at, 'Barn inlagt', e.name || ''));

    const pass = passFör(b => b.parent_id === p.id);
    pass.forEach(b => {
      const när = b.wanted_date
        ? b.wanted_date + 'T' + String(b.wanted_time || '00:00').slice(0, 5)
        : b.created_at;
      const vad = b.status === 'completed' ? 'Pass genomfört'
        : b.status === 'cancelled' ? 'Pass avbokat'
        : 'Pass bokat';
      /* elevNamn svarar med ett tankstreck när passet inte har något
         barn valt, och det tecknet ska inte stå som ett namn. */
      const vem = elevNamn(b.student_id);
      lägg(när, vad, [vem && vem !== '—' ? vem : null, b.subject,
        (b.duration_min || 60) + ' min'].filter(Boolean).join(' · '));
    });

    const fakturor = S.fakturor.filter(f => f.parent_id === p.id);
    fakturor.forEach(f => {
      const period = NX.MANADER[Number(String(f.period).slice(5, 7)) - 1]
        + ' ' + String(f.period).slice(0, 4);
      lägg(f.created_at, 'Faktura skapad', period + ' · ' + kronor(f.belopp_ore));
      lägg(f.skickad_at, 'Faktura skickad', period);
      lägg(f.betald_at, 'Faktura betald', period + ' · ' + kronor(f.belopp_ore));
    });

    (d.meddelanden || []).forEach(m => {
      /* namnFör svarar med ett tankstreck för en profil som inte
         finns kvar, aldrig med tomt — reservvärdet måste därför
         pröva tecknet, inte falsiskhet. */
      const n = namnFör(m.sender_id);
      const vem = m.sender_id === p.id ? 'Familjen skrev'
        : (n && n !== '—' ? n : 'Någon') + ' skrev';
      lägg(m.created_at, vem, tlKort(m.body, 110));
    });

    (d.noteringar || []).forEach(n =>
      lägg(n.created_at, 'Anteckning', tlKort(n.text, 110)));

    /* Uppgifter som hör till familjen, vilken rad de än pekar på.
       De ligger redan i S — ingen fråga till. */
    const mina = new Set([p.id]
      .concat((d.anmalningar || []).map(l => l.id))
      .concat(barn.map(e => e.id))
      .concat(pass.map(b => b.id))
      .concat(fakturor.map(f => f.id)));
    (S.uppgifter || []).filter(u => u.kopplad_id && mina.has(u.kopplad_id)).forEach(u => {
      lägg(u.created_at, 'Uppgift skapad',
        tlKort(u.titel, 90) + (u.skapad_av_typ === 'manniska' ? '' : ' · automatisk'));
      lägg(u.klar_at, 'Uppgift klar', tlKort(u.titel, 90));
    });

    /* Sorteras på tidpunkt, inte på text. Passen har ingen tidszon
       ('2026-09-24T15:00' är lokal tid) medan allt annat är ISO med
       +00:00, och en strängjämförelse mellan de två lägger ett
       meddelande klockan 17 under ett pass klockan 16 samma dag —
       alltid åt samma håll, och alltid fel. */
    h.forEach(x => { x.ms = new Date(x.när).getTime(); });
    h.sort((a, b) => (b.ms || 0) - (a.ms || 0));

    const fel = [d.anmalningarFel, d.meddelandenFel].filter(Boolean);
    const varning = fel.length
      ? '<p class="xsmall" style="color:var(--fel)">Delar av tidslinjen kunde inte hämtas: '
        + esc(fel.join(' · ')) + '</p>'
      : '';

    if (!h.length) {
      return varning + tomt('Inget har hänt än',
        'Anmälan, pass, fakturor och meddelanden dyker upp här allteftersom.');
    }

    /* "Nytt" betyder det senaste dygnet, inte framtiden. Ett pass om
       två veckor är inte en nyhet, och utan den övre gränsen blev
       det den prick som lyste starkast i hela tidslinjen. */
    const nu = Date.now();
    const dygnet = nu - 86400000;
    return varning
      + '<div class="adm-flode">' + h.slice(0, TL_MAX).map(x =>
        '<div class="adm-flode-post'
        + (x.ms > dygnet && x.ms <= nu ? ' ar-ny' : '') + '">'
        + '<span class="adm-flode-nar">' + esc(tlNär(x.när, x.ms > nu)) + '</span>'
        + '<span class="adm-flode-text"><b>' + esc(x.rubrik) + '</b>'
        + '<span>' + esc(x.under) + '</span></span>'
        + '</div>').join('') + '</div>'
      /* Meddelandena är hämtade med limit 60. Står det bara "de 80
         senaste av N" ser N ut som hela sanningen, och den som letar
         efter ett äldre meddelande letar förgäves utan att förstå
         varför. */
      + (h.length > TL_MAX
        ? '<p class="xsmall">Visar de ' + TL_MAX + ' senaste av ' + h.length + ' händelser.</p>'
        : '')
      + ((d.meddelanden || []).length >= 60
        ? '<p class="xsmall">Bara de 60 senaste meddelandena är med. Hela tråden finns under Kommunikation.</p>'
        : '');
  }

  function passLista(pass, visaVem) {
    if (!pass.length) return tomt('Inga pass', 'Bokade pass dyker upp här.');
    return pass.slice(0, 30).map(b => dpRad(
      kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
      [b.subject, b.format, (b.duration_min || 60) + ' min',
        visaVem ? visaVem(b) : null].filter(Boolean).join(' · '),
      läge(BOK_LAGE, b.status))).join('');
  }

  /* Databasens värden (progress_items_level_check) och samma ord som
     studievyerna använder (NXStudie, NIVA). Nycklarna stämde inte
     tidigare, så råvärdet visades i stället för texten. */
  const NIVA_TEXT = {
    behover_trana: ['Behöver träna', 'ar-ny'],
    pa_god_vag: ['På god väg', 'ar-vantar'],
    bra: ['Bra', 'ar-klar']
  };

  function dpFamilj(p, d) {
    const barn = S.elever[p.id] || [];
    const pass = passFör(b => b.parent_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const fakturor = S.fakturor.filter(f => f.parent_id === p.id);
    const obetalt = fakturor.filter(f => f.status === 'skickad' || f.status === 'forfallen')
      .reduce((n, f) => n + (f.belopp_ore || 0), 0);
    const idag = isoFor(new Date());
    const nästa = pass.filter(b => b.wanted_date >= idag && b.status !== 'cancelled').pop();

    if (DP.flik === 'barn') {
      /* Förut sa tomläget "Familjen lägger till dem i studievyn", och
         det var den enda vägen. En familj som ringt in kunde alltså
         inte få sitt barn inlagt av oss. */
      const ny = '<div class="vy-knapprad" style="margin:0 0 14px">'
        + '<button class="btn btn-primary" type="button" data-dp-barn-ny="' + esc(p.id) + '">'
        + 'Lägg till barn</button></div>';
      if (!barn.length) {
        return ny + tomt('Inga barn inlagda',
          'Lägg till dem här. Familjen kan också göra det själv i sin vy.');
      }
      return ny + barn.map(e => {
        const t = elevHjälpare(e);
        return '<div class="dp-rad"><div>'
          + '<b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, e.school, (e.subjects || []).join(', ')]
              .filter(Boolean).join(' · ') || 'Inga uppgifter') + '</span>'
          + '<span>' + (t ? 'Studiehjälpare: ' + esc(t.full_name || t.email || '—')
                          : 'Ingen studiehjälpare') + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    if (DP.flik === 'pass') return passLista(pass, b => elevNamn(b.student_id) || '');

    if (DP.flik === 'ekonomi') {
      return dpTal([
        [kronor(obetalt), 'Utestående'],
        [fakturor.length, 'Fakturor'],
        [genomförda.length, 'Fakturerbara pass']
      ])
      + dpRubrik('Fakturor')
      + (fakturor.length
        ? fakturor.map(f => dpRad(
            NX.MANADER[Number(String(f.period).slice(5, 7)) - 1] + ' ' + String(f.period).slice(0, 4),
            kronor(f.belopp_ore) + (f.forfaller ? ' · förfaller ' + kortDatum(f.forfaller) : ''),
            läge(FAKT_LAGE, f.status))).join('')
        : tomt('Inga fakturor än', 'Den första skapas när en månad med genomförda pass är slut.'));
    }

    if (DP.flik === 'tidslinje') return dpTidslinje(p, d);

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    return dpTal([
      [barn.length, barn.length === 1 ? 'Barn' : 'Barn'],
      [genomförda.length, 'Genomförda pass'],
      [kronor(obetalt), 'Utestående']
    ])
    + dpRubrik('Kontakt')
    + dpFakta([
      ['E-post', p.email ? esc(p.email) : null],
      ['Telefon', p.phone ? esc(p.phone) : null],
      ['Konto skapat', p.created_at ? esc(kortDatum(p.created_at)) : null],
      ['Senast inloggad', p.last_seen_at ? esc(kortDatum(p.last_seen_at)) : null, 'aldrig'],
      ['Om familjen', p.bio ? esc(p.bio) : null]
    ])
    + kontaktKnappar(p)
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [elevNamn(nästa.student_id), nästa.subject, namnFör(nästa.tutor_id)]
            .filter(Boolean).join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'));
  }

  function dpElev(e, d) {
    const f = S.personer[e.parent_id];
    const t = elevHjälpare(e);
    const pass = passFör(b => b.student_id === e.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const plan = (d.plan || [])[0];

    if (DP.flik === 'pass') return passLista(pass, b => namnFör(b.tutor_id));

    if (DP.flik === 'uppgifter') {
      const öppna = (d.laxor || []).filter(h => h.status !== 'klar');
      return dpRubrik('Läxor', öppna.length ? öppna.length + ' öppna' : 'allt avbockat')
        + ((d.laxor || []).length
          ? d.laxor.map(h => dpRad(h.title,
              [h.subject, h.due_date ? 'till ' + kortDatum(h.due_date) : null]
                .filter(Boolean).join(' · '),
              pill(h.status === 'klar' ? 'Klar' : h.status === 'pagaende' ? 'Pågående' : 'Ej påbörjad',
                h.status === 'klar' ? 'ar-klar' : h.status === 'pagaende' ? 'ar-vantar' : ''))).join('')
          : tomt('Inga läxor', 'Studiehjälparen lägger upp dem i sin vy.'))
        + dpMaterial(e, d);
    }

    if (DP.flik === 'utveckling') {
      const u = d.utveckling || [];
      if (!u.length) return tomt('Inga områden satta',
        'Studiehjälparen sätter dem efter hand som de arbetar.');
      return u.map(x => dpRad(x.area, [x.subject, x.comment].filter(Boolean).join(' · '),
        pill((NIVA_TEXT[x.level] || [x.level])[0], (NIVA_TEXT[x.level] || [, ''])[1]))).join('');
    }

    if (DP.flik === 'rapporter') {
      const r = d.rapporter || [];
      if (!r.length) return tomt('Inga rapporter än',
        'Studiehjälparen skriver en efter varje pass. Utan den faktureras inte passet.');
      return r.map(x => '<div style="margin-bottom:18px">'
        + dpRubrik(kortDatum(x.lesson_date))
        + dpFakta([
          ['Gick bra', x.went_well ? esc(x.went_well) : null],
          ['Att öva på', x.needs_practice ? esc(x.needs_practice) : null],
          ['Nästa gång', x.next_focus ? esc(x.next_focus) : null]
        ]) + '</div>').join('');
    }

    return dpTal([
      [genomförda.length, 'Genomförda pass'],
      [(d.laxor || []).filter(h => h.status !== 'klar').length, 'Öppna läxor'],
      [(d.utveckling || []).length, 'Områden']
    ])
    + dpRubrik('Eleven')
    + dpFakta([
      ['Årskurs', e.grade ? esc(e.grade) : null],
      ['Skola', e.school ? esc(e.school) : null],
      ['Ämnen', (e.subjects || []).length ? esc(e.subjects.join(', ')) : null],
      ['Mål', e.goals ? esc(e.goals) : null],
      ['Familj', f ? '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(f.id) + '">'
        + esc(f.full_name || f.email || '—') + '</button>' : null],
      ['Studiehjälpare', t
        ? '<button class="btn btn-ghost btn-sm" data-dp="studiehjalpare:' + esc(t.id) + '">'
          + esc(t.full_name || t.email || '—') + '</button>'
        : null, 'ingen matchad än']
    ])
    + dpRubrik('Studieplan', plan && plan.updated_at ? 'uppdaterad ' + kortDatum(plan.updated_at) : '')
    + (plan && (plan.plan_text || plan.goals)
      ? '<div class="dp-text">' + esc(plan.plan_text || plan.goals) + '</div>'
      : tomt('Ingen studieplan', 'Studiehjälparen skriver den efter första passet.'));
  }

  function dpStudiehjalpare(p, d) {
    const tp = S.tutorProfiler[p.id] || {};
    const elever = S.elevlista.filter(e => e.matched_tutor_id === p.id && e.match_status === 'matched');
    const pass = passFör(b => b.tutor_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);
    const utb = S.utbetalningar.filter(u => u.tutor_id === p.id);

    if (DP.flik === 'elever') {
      if (!elever.length) return tomt('Inga elever',
        'Matcha någon under Matchning, så syns de här.');
      return elever.map(e => {
        const fam = S.personer[e.parent_id];
        return '<div class="dp-rad"><div><b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, fam && (fam.full_name || fam.email)]
              .filter(Boolean).join(' · ')) + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    if (DP.flik === 'pass') return passLista(pass, b => elevNamn(b.student_id) || namnFör(b.parent_id));

    if (DP.flik === 'tider') {
      const t = d.tillgang || [];
      const bl = d.blockerat || [];
      return dpRubrik('Kan jobba', t.length ? t.length + ' block' : 'inga tider inlagda')
        + (t.length
          /* weekday är 0 = måndag i tutor_availability, precis som
             NX.DAGAR. Ingen omräkning, och framför allt ingen
             (+6)%7 — den hör hemma när man kommer från
             Date.getDay(), som börjar på söndag. */
          ? t.map(x => dpRad(NX.DAGAR[x.weekday] || 'Dag ' + x.weekday,
              String(x.start_time).slice(0, 5) + ' till ' + String(x.end_time).slice(0, 5), '')).join('')
          : tomt('Inga tider inlagda',
              'Familjen kan bara boka inom tiderna hen lagt in. Utan dem går inga pass att boka.'))
        + dpRubrik('Spärrade tider framåt')
        + (bl.length
          ? bl.map(x => dpRad(kortDatum(x.block_date),
              [x.block_time ? String(x.block_time).slice(0, 5) : 'hela dagen', x.reason]
                .filter(Boolean).join(' · '), '')).join('')
          : tomt('Inget spärrat', 'Inga undantag framåt.'));
    }

    if (DP.flik === 'ersattning') {
      const väntar = utb.filter(u => u.status === 'utkast' || u.status === 'godkand')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      const utbetalt = utb.filter(u => u.status === 'utbetald')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      return dpTal([
        [kronor(väntar), 'Väntar'],
        [kronor(utbetalt), 'Utbetalt'],
        [tp.hourly_rate ? NX.kr(tp.hourly_rate) : 'Ej satt', 'Per timme']
      ])
      + dpUtbetalning(p, d)
      + dpRubrik('Underlag')
      + (utb.length
        ? utb.map(u => dpRad(
            NX.MANADER[Number(String(u.period).slice(5, 7)) - 1] + ' ' + String(u.period).slice(0, 4),
            kronor(u.belopp_ore) + ' · ' + NXBetalning.timmar(u.minuter || 0),
            läge(UTB_LAGE, u.status))).join('')
        : tomt('Inga underlag än', 'De skapas av faktureringskörningen efter varje månad.'));
    }

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    return dpTal([
      [elever.length, 'Elever'],
      [genomförda.length, 'Genomförda pass'],
      [NXBetalning.timmar(minuter), 'Undervisad tid']
    ])
    + dpRubrik('Profilen')
    + dpFakta([
      ['E-post', p.email ? esc(p.email) : null],
      ['Telefon', p.phone ? esc(p.phone) : null],
      ['Ålder', tp.age ? esc(String(tp.age) + ' år') : null],
      ['Skola', tp.school ? esc(tp.school) : null],
      ['Ort', tp.city ? esc(tp.city) : null],
      ['Ämnen', (tp.subjects || []).length ? esc(tp.subjects.join(', ')) : null],
      ['Årskurser', (tp.grade_levels || []).length ? esc(tp.grade_levels.join(', ')) : null],
      ['Format', (tp.formats || []).length ? esc(tp.formats.join(', ')) : null],
      ['Stripe', tp.stripe_klar ? 'Klar' : null, 'inte kopplad'],
      ['Senast inloggad', p.last_seen_at ? esc(kortDatum(p.last_seen_at)) : null, 'aldrig']
    ])
    + kontaktKnappar(p)
    + dpTimpenning(p, tp)
    + (tp.bio ? dpRubrik('Om hen') + '<div class="dp-text">' + esc(tp.bio) + '</div>' : '');
  }

  /* ------------------------------------------------------------
     KONTAKT FRÅN PANELEN

     E-post och telefon stod som text, och den som ville höra av sig
     fick kopiera adressen till ett annat program. Därefter syntes
     kontakten ingenstans. "Skriv mejl" går genom samma ruta som
     anmälningarna, och varje öppnat utkast blir en rad under
     Anteckningar: ämnet, aldrig meddelandet, för en anteckning ska
     säga att kontakt togs, inte bli en kopia av mejlkorgen.

     Ring är en tel:-länk och ritas bara när numret går att ringa.
     Ingen mailto:-länk står här med flit: NX.initHeader() skriver om
     sådana till Nextrums egen adress, och Skriv mejl ska dessutom
     lämna ett spår.
     ------------------------------------------------------------ */
  const IKON_MEJL = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>';
  const IKON_RING = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M6 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5'
    + 'A16.5 16.5 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5z"/></svg>';

  function kontaktKnappar(p) {
    const tel = p.phone ? telHref(p.phone) : null;
    if (!p.email && !tel) return '';
    return '<div class="vy-knapprad" style="margin:12px 0 4px">'
      + (p.email
        ? '<button class="btn btn-ghost" type="button" data-dp-mejl="' + esc(p.id) + '">'
          + IKON_MEJL + 'Skriv mejl</button>'
        : '')
      + (tel
        ? '<a class="btn btn-ghost" href="' + esc(tel) + '">' + IKON_RING
          + 'Ring ' + esc(p.phone) + '</a>'
        : '')
      + '</div>';
  }

  /* ------------------------------------------------------------
     TIMPENNINGEN

     Gick bara att sätta i "Ta in i poolen". Den som registrerat sig
     själv, eller som bjudits in härifrån, fick alltså ingen
     timpenning någonstans, och har tjänsten ingen egen ersättning
     räknas då ingen ersättning ut för hens pass.
     ------------------------------------------------------------ */
  function dpTimpenning(p, tp) {
    return dpRubrik('Timpenning', tp.hourly_rate ? 'nu ' + NX.kr(tp.hourly_rate) : 'inte satt')
      /* novalidate: annars stoppar webbläsaren "0" och "12.5" med sin
         egen bubbla på engelska eller svenska beroende på datorn, och
         vårt eget besked syns bara när fältet är tomt. */
      + '<form data-dp-timpenning="' + esc(p.id) + '" novalidate>'
      + '<div class="vy-knapprad" style="align-items:flex-end;margin-top:0">'
      + '<div class="fgroup" style="margin:0;flex:1 1 160px;max-width:220px">'
      + '<label for="dp-timpenning">Kronor per timme</label>'
      + '<input class="inp" id="dp-timpenning" name="timpenning" type="number" min="1" step="1"'
      + ' inputmode="numeric" value="' + esc(tp.hourly_rate != null ? String(tp.hourly_rate) : '') + '"'
      + ' placeholder="t.ex. 180"></div>'
      + '<button class="btn btn-primary" type="submit">Spara timpenning</button>'
      + '</div>'
      + '<p class="ok-msg" data-dp-tp-msg role="status"></p>'
      + '</form>';
  }

  /* ------------------------------------------------------------
     UTBETALNINGSMETODEN (program 2, Fas 1.7)

     Maskerad som standard. Hela numret hämtas först när någon
     trycker, och varje sådan läsning hamnar i auditloggen, i
     databasen. Därför står det vid knappen, inte i en hjälptext: den
     som trycker ska veta det innan, inte efteråt.
     ------------------------------------------------------------ */
  function metodText(m) {
    return m === 'swish' ? 'Swish' : m === 'bank' ? 'Bankkonto' : (m || 'okänt');
  }

  function dpUtbetalning(p, d) {
    const rubrik = dpRubrik('Utbetalningsmetod');
    if (d.utbetalningFel) return rubrik + tomt('Kunde inte hämta uppgifterna', d.utbetalningFel);
    const r = (d.utbetalning || [])[0];
    if (!r) return rubrik + '<p class="small" style="color:var(--bl-2);margin:0 0 6px">Inga uppgifter lämnade.</p>';

    const rader = [['Sätt', esc(metodText(r.metod))]];
    if (r.metod !== 'swish') rader.push(['Bank', r.bank ? esc(r.bank) : null, 'okänd']);
    if (r.clearing) rader.push(['Clearingnummer', esc(r.clearing)]);
    rader.push([r.metod === 'swish' ? 'Swishnummer' : 'Kontonummer',
      r.slutar_pa ? 'slutar på ' + esc(r.slutar_pa) : null]);
    if (typeof r.kontrollerad === 'boolean') {
      rader.push(['Kontrollsiffra', r.kontrollerad ? 'stämmer' : 'gick inte att kontrollera']);
    }
    rader.push(['Uppdaterad', r.uppdaterad ? esc(kortDatum(r.uppdaterad)) : null]);

    return rubrik + dpFakta(rader)
      + '<div class="vy-knapprad" style="margin:12px 0 4px">'
      + '<button class="btn btn-ghost" type="button" data-dp-klartext="' + esc(p.id) + '">'
      + 'Visa hela uppgifterna</button>'
      + '<span class="xsmall" style="color:var(--bl-2)">Visningen loggas.</span></div>'
      + '<div data-dp-klartext-ut aria-live="polite"></div>';
  }

  function dpNoteringar(profilId, d) {
    const n = d.noteringar || [];
    return dpRubrik('Interna anteckningar', 'syns bara för admin')
      + '<form data-dp-not="' + esc(profilId) + '" style="margin-bottom:16px">'
      + '<textarea class="inp" name="text" style="min-height:74px" '
      + 'placeholder="Vad behöver vi minnas om den här personen?" required></textarea>'
      + '<button class="btn btn-primary btn-sm" type="submit" style="margin-top:9px">Spara anteckning</button>'
      + '<p class="ok-msg" data-dp-not-msg></p></form>'
      + (d.noteringarFel
        ? tomt('Kunde inte hämta anteckningarna', String(d.noteringarFel).replace(/[.\s]+$/, '') + '. Är schema-v13.sql kört?')
        : n.length
          ? n.map(x => dpRad(x.text, namnFör(x.skriven_av) + ' · ' + kortDatum(x.created_at), ''))
              .join('')
          : tomt('Inga anteckningar än', 'Den första du skriver hamnar överst.'));
  }

  /* ------------------------------------------------------------
     MATERIAL, INLAGT AV ADMIN

     Material har hittills bara kunnat läggas upp av studiehjälparen
     själv, i sin egen vy. Det förutsätter att en gymnasieelev som
     håller sitt tredje pass också vet vilka uppgifter som ligger på
     rätt nivå — och det stödet är precis vad vi säger att vi ger.

     Här kan admin lägga in uppgifter åt en elev, med AI som skriver
     ut förslag. Förslagen är uppgifter i KLARTEXT, aldrig länkar.
     Skälet står i supabase/functions/material-forslag/index.ts och
     är värt en rad även här: en modell som ombeds hitta en länk
     hittar på en länk, och det märks först när eleven sitter med
     läxan på söndagkvällen.

     TVÅ VAL SOM MED FLIT INTE FINNS HÄR

     Filuppladdning. Hinken "material" har en policy som kräver att
     den som laddar upp är elevens studiehjälpare. Att öppna hinken
     för admin vore att lossa ett lås för en bekvämlighets skull.
     Filer läggs upp av studiehjälparen, som förut.

     Att välja avsändare. tutor_id sätts till elevens matchade
     studiehjälpare när det finns en, annars till den admin som lade
     in raden. Familjen ska se materialet komma från sin egen
     studiehjälpare, inte från ett kontor de aldrig träffat — och
     studiehjälparen ska kunna ta bort det i sin egen vy, vilket RLS
     bara tillåter för rader där tutor_id är hen.
     ------------------------------------------------------------ */
  const MAT_SORT = { fil: 'fil', lank: 'länk', anteckning: 'uppgift' };

  function matForslagHtml() {
    const f = S.matForslag || [];
    if (!f.length) return '';
    return '<div class="dp-forslag">' + f.map((x, i) =>
      '<div class="dp-forslag-kort"><b>' + esc(x.titel) + '</b>'
      + '<pre>' + esc(x.uppgift) + '</pre>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-anv="' + i + '">'
      + 'Använd den här</button></div>').join('') + '</div>';
  }

  function dpMaterial(e, d) {
    const lista = d.material || [];

    return dpRubrik('Material', lista.length ? lista.length + ' st' : '')
      + (d.materialFel
        ? tomt('Kunde inte hämta materialet', d.materialFel)
        : lista.length
          ? lista.map(m => dpRad(m.title,
              [m.subject, MAT_SORT[m.kind] || m.kind, kortDatum(m.created_at)]
                .filter(Boolean).join(' · '),
              '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-bort="'
                + esc(m.id) + '">Ta bort</button>')).join('')
          : tomt('Inget material än',
              'Lägg in en uppgift här nedanför. Filer laddar studiehjälparen upp i sin egen vy.'))

      + dpRubrik('Lägg till', 'syns hos familjen direkt')
      + '<form data-dp-mat="' + esc(e.id) + '" class="dp-mat">'
      + '<div class="dp-mat-par">'
      + '<input class="inp" name="titel" placeholder="Rubrik" maxlength="200" required>'
      + '<input class="inp" name="amne" placeholder="Ämne" maxlength="80">'
      + '</div>'
      + '<div class="dp-mat-typ" role="group" aria-label="Sorts material">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-typ="anteckning"'
      + ' aria-pressed="true">Uppgift</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-typ="lank"'
      + ' aria-pressed="false">Länk</button>'
      + '</div>'
      + '<textarea class="inp" name="text" data-dp-mat-falt="anteckning"'
      + ' placeholder="Skriv uppgiften, eller hämta ett förslag längre ned."></textarea>'
      + '<input class="inp" name="url" data-dp-mat-falt="lank" hidden'
      + ' placeholder="https://…" maxlength="500">'
      + '<button class="btn btn-primary btn-sm" type="submit">Spara material</button>'
      + '<p class="ok-msg" data-dp-mat-msg></p>'
      + '</form>'

      + dpRubrik('Föreslå uppgifter med AI', 'skrivs ut i klartext, aldrig som länk')
      + '<div class="dp-mat" data-dp-ai>'
      + '<div class="dp-mat-par">'
      + '<input class="inp" data-ai-amne placeholder="Ämne, t.ex. Matematik" maxlength="80">'
      + '<input class="inp" data-ai-arskurs placeholder="Årskurs" maxlength="40" value="'
      + esc(e.grade || '') + '">'
      + '</div>'
      + '<input class="inp" data-ai-fokus maxlength="400"'
      + ' placeholder="Vad behöver eleven öva på? T.ex. ekvationer med parentes">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-ai>'
      + 'Föreslå tre uppgifter</button>'
      + '<p class="ok-msg" data-dp-ai-msg></p>'
      + '<div data-dp-ai-lista>' + matForslagHtml() + '</div>'
      + '</div>';
  }

  /* En lyssnare för hela materialrutan: typväxlaren, AI-knappen,
     "Använd den här" och borttagningen. Panelen ritas om i sin
     helhet vid varje flikbyte, så inget får bindas vid uppritning. */
  document.addEventListener('click', async ev => {
    const typ = ev.target.closest('[data-dp-mat-typ]');
    if (typ) {
      const form = typ.closest('form');
      const v = typ.dataset.dpMatTyp;
      form.querySelectorAll('[data-dp-mat-typ]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.dpMatTyp === v)));
      form.querySelectorAll('[data-dp-mat-falt]').forEach(f => {
        f.hidden = f.dataset.dpMatFalt !== v;
      });
      rensa(form.querySelector('[data-dp-mat-msg]'));
      return;
    }

    const anv = ev.target.closest('[data-dp-mat-anv]');
    if (anv) {
      const x = (S.matForslag || [])[Number(anv.dataset.dpMatAnv)];
      const form = DP.panel && DP.panel.querySelector('[data-dp-mat]');
      if (!x || !form) return;
      form.titel.value = x.titel;
      form.text.value = x.uppgift;
      const ämne = DP.panel.querySelector('[data-ai-amne]');
      if (ämne && ämne.value.trim() && !form.amne.value.trim()) {
        form.amne.value = ämne.value.trim().slice(0, 80);
      }
      /* Ett förslag är alltid en uppgift, aldrig en länk. */
      form.querySelectorAll('[data-dp-mat-typ]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.dpMatTyp === 'anteckning')));
      form.querySelectorAll('[data-dp-mat-falt]').forEach(f => {
        f.hidden = f.dataset.dpMatFalt !== 'anteckning';
      });
      form.titel.focus();
      return;
    }

    const ai = ev.target.closest('[data-dp-mat-ai]');
    if (ai) {
      const ruta = ai.closest('[data-dp-ai]');
      const msg = ruta.querySelector('[data-dp-ai-msg]');
      const amne = ruta.querySelector('[data-ai-amne]').value.trim();
      rensa(msg);
      if (!amne) { säg(msg, '⚠️ Skriv vilket ämne det gäller.', false); return; }

      await medan(ai, 'Tänker…', async () => {
        const { data, error } = await supa.functions.invoke('material-forslag', {
          body: {
            amne: amne,
            arskurs: ruta.querySelector('[data-ai-arskurs]').value.trim(),
            fokus: ruta.querySelector('[data-ai-fokus]').value.trim(),
            antal: 3
          }
        });

        /* invoke ger error på allt som inte är 2xx, men funktionen
           lägger sin förklaring i svarskroppen. Utan det här steget
           blir en saknad API-nyckel "non-2xx status code". */
        let svar = data;
        if (error && error.context && typeof error.context.json === 'function') {
          try { svar = await error.context.json(); } catch (e2) { /* behåll error */ }
        }
        if (!svar || svar.error || !Array.isArray(svar.forslag)) {
          säg(msg, '⚠️ ' + ((svar && svar.error) || felText(error) || 'Tomt svar.'), false);
          return;
        }

        S.matForslag = svar.forslag;
        ruta.querySelector('[data-dp-ai-lista]').innerHTML = matForslagHtml();
        säg(msg, '✓ Läs igenom dem innan du sparar. Facit står sist i varje uppgift.', true);
      });
      return;
    }

    const bort = ev.target.closest('[data-dp-mat-bort]');
    if (!bort) return;
    const d = S.detaljCache['elev:' + DP.id];
    const m = ((d && d.material) || []).find(x => x.id === bort.dataset.dpMatBort);
    const ja = await bekräfta({
      titel: 'Ta bort materialet?',
      text: '"' + ((m && m.title) || 'Materialet') + '" försvinner för både eleven och studiehjälparen.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(bort, 'Tar bort…', async () => {
      /* Filen i hinken först. Går raden bort men filen ligger kvar
         blir den omöjlig att nå och omöjlig att städa: sökvägen
         fanns bara i raden.

         Svaret LÄSES. Fram till Fas 9.2 hade admin ingen policy på
         hinken, så borttagningen nekades tyst medan raden försvann —
         och koden ovan beskrev en ordning som aldrig hölls. Nekas
         den igen ska raden stå kvar, så att filen går att hitta. */
      if (m && m.kind === 'fil' && m.url) {
        const { error: filfel } = await supa.storage.from('material').remove([m.url]);
        if (filfel) {
          alert('Filen kunde inte tas bort ur lagringen: ' + felText(filfel)
            + '\n\nRaden står kvar, annars hade filen blivit omöjlig att hitta.');
          return;
        }
      }
      const { error } = await supa.from('materials').delete().eq('id', bort.dataset.dpMatBort);
      if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
      delete S.detaljCache['elev:' + DP.id];
      await hämtaDetalj('elev', DP.id);
      ritaDetalj();
    });
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-dp-mat]');
    if (!form) return;
    ev.preventDefault();

    const msg = form.querySelector('[data-dp-mat-msg]');
    rensa(msg);

    const elevId = form.dataset.dpMat;
    const elev = S.elevlista.find(x => x.id === elevId);
    const vald = form.querySelector('[data-dp-mat-typ][aria-pressed="true"]');
    const sort = (vald && vald.dataset.dpMatTyp) || 'anteckning';
    const titel = form.titel.value.trim();
    const text = form.text.value.trim();
    const url = form.url.value.trim();

    const fel = !titel ? 'Ge materialet en rubrik.'
      : sort === 'anteckning' && !text ? 'Skriv uppgiften.'
      : sort === 'lank' && !url ? 'Klistra in adressen.'
      : sort === 'lank' && !/^https?:\/\//i.test(url)
        ? 'Adressen måste börja med http:// eller https://.'
        : null;
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    /* Se kommentaren över dpMaterial: hellre studiehjälparens namn
       än vårt, och alltid någon som får ta bort raden igen. */
    const hjälpare = elev && elevHjälpare(elev);
    const rad = {
      student_id: elevId,
      tutor_id: (hjälpare && hjälpare.id) || S.user.id,
      title: titel.slice(0, 200),
      kind: sort,
      subject: form.amne.value.trim() || null
    };
    if (sort === 'lank') rad.url = url; else rad.body = text;

    await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.from('materials').insert(rad);
      if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
      S.matForslag = [];
      delete S.detaljCache['elev:' + elevId];
      await hämtaDetalj('elev', elevId);
      ritaDetalj();
    });
  });

  /* ------------------------------------------------------------
     HANDLINGARNA I PANELEN
     Panelen ritas om i sin helhet vid varje flikbyte, så inget får
     bindas vid uppritning: en lyssnare på document per sak.
     ------------------------------------------------------------ */

  /* Efter en skrivning som ändrar barnen: allt som räknar på dem
     hämtas och ritas om, också panelen om den står på familjen. */
  async function efterBarn(familjId) {
    await hämtaAllt();
    ritaFamiljer();
    ritaElever();
    await hämtaMatchunderlag();
    ritaMatchning();
    await ritaÖversikt();
    delete S.detaljCache['familj:' + familjId];
    if (DP.typ === 'familj' && DP.id === familjId) {
      await hämtaDetalj('familj', familjId);
      ritaDetalj();
    }
  }

  function läggTillBarn(familjId) {
    const p = S.personer[familjId];
    if (!p) return;
    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="lb-t">'
      + '<h3 id="lb-t">Lägg till barn hos ' + esc(p.full_name || p.email || 'familjen') + '</h3>'
      + '<p>Barnen hamnar i matchningskön direkt, och familjen ser dem i sin vy.</p>'
      + '<div id="lb-barn"></div>'
      + '<button type="button" class="btn btn-ghost" data-barn-ny style="margin-top:12px">'
      + 'Lägg till ett barn till</button>'
      + '<p class="ok-msg" id="lb-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-lb-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="lb-spara">Spara</button>'
      + '</div></div>';

    /* Fälten först, rutan sedan: öppnaRuta ger fokus åt det första
       fältet som finns när den öppnas. */
    const host = $('#lb-barn', ruta);
    kopplaBarn(ruta, host);
    const stäng = öppnaRuta(ruta, {
      återFokus: () => DP.panel && DP.panel.querySelector('[data-dp-barn-ny]')
    });
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-lb-stang]')) stäng();
    });

    const spara = $('#lb-spara', ruta);
    spara.addEventListener('click', async () => {
      if (spara.getAttribute('aria-busy') === 'true') return;
      const msg = $('#lb-msg', ruta);
      rensa(msg);
      const lästa = läsBarn(host);
      if (lästa.fel) { säg(msg, lästa.fel, false); if (lästa.fält) lästa.fält.focus(); return; }
      if (!lästa.barn.length) {
        säg(msg, 'Skriv namnet på minst ett barn.', false);
        const första = host.querySelector('[data-barn-falt="namn"]');
        if (första) första.focus();
        return;
      }

      await medan(spara, 'Sparar…', async () => {
        const res = await skapaBarn(familjId, lästa.barn);
        let hämtfel = null;
        try { await efterBarn(familjId); } catch (e) { hämtfel = felText(e); }

        if (!res.misslyckade.length && !hämtfel) { stäng(); return; }

        /* De som gick in tas bort ur rutan, så att bara de som inte
           sparades står kvar och kan skickas igen utan att någon blir
           inlagd två gånger. */
        res.skapade.forEach(b => { if (b.fält) b.fält.remove(); });
        numreraBarn(host);
        if (!host.querySelector('[data-barn]')) {
          spara.hidden = true;
          ruta.querySelector('[data-barn-ny]').hidden = true;
          ruta.querySelector('[data-lb-stang]').textContent = 'Stäng';
        }
        const delar = [];
        if (res.skapade.length) {
          const namnen = res.skapade.map(b => b.namn);
          delar.push(uppräkning(namnen) + (namnen.length === 1 ? ' är inlagd.' : ' är inlagda.'));
        }
        if (res.misslyckade.length) delar.push(barnFel(res));
        if (hämtfel) delar.push('Listorna kunde inte hämtas om: ' + punkt(hämtfel) + ' Ladda om sidan.');
        säg(msg, delar.join(' '), false);
      });
    });
  }

  function skrivMejl(id) {
    const p = S.personer[id];
    if (!p || !p.email) return;
    const förnamn = String(p.full_name || '').split(' ')[0];
    kontaktaRuta({
      titel: 'Skriv till ' + (p.full_name || p.email),
      namn: p.full_name, till: p.email,
      amne: '',
      text: 'Hej' + (förnamn ? ' ' + förnamn : '') + ',\n\n\n\nHälsningar,\nNextrum',
      först: '#kt-amne',
      återFokus: () => DP.panel && DP.panel.querySelector('[data-dp-mejl]'),
      /* Ämnet, aldrig meddelandet: en anteckning ska säga att kontakt
         togs, inte bli en kopia av mejlkorgen. Anteckningen syns i
         tidslinjen och under Anteckningar. */
      efterat: async ({ amne }) => {
        const ämne = String(amne || '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'utan ämne';
        const { error } = await supa.from('admin_noteringar')
          .insert({ om_profil: id, text: 'Mejlutkast öppnat: ' + ämne, skriven_av: S.user.id });
        if (error) return felText(error);
        delete S.detaljCache['familj:' + id];
        delete S.detaljCache['studiehjalpare:' + id];
        if (DP.id === id && DP.typ) {
          await hämtaDetalj(DP.typ, id);
          ritaDetalj();
        }
        return null;
      }
    });
  }

  document.addEventListener('click', async ev => {
    const barnNy = ev.target.closest('[data-dp-barn-ny]');
    if (barnNy) { läggTillBarn(barnNy.dataset.dpBarnNy); return; }

    const mejl = ev.target.closest('[data-dp-mejl]');
    if (mejl) { skrivMejl(mejl.dataset.dpMejl); return; }

    const dölj = ev.target.closest('[data-dp-klartext-dolj]');
    if (dölj) {
      const ut = DP.panel && DP.panel.querySelector('[data-dp-klartext-ut]');
      const visa = DP.panel && DP.panel.querySelector('[data-dp-klartext]');
      if (ut) ut.innerHTML = '';
      if (visa) { visa.hidden = false; visa.focus(); }
      return;
    }

    const klar = ev.target.closest('[data-dp-klartext]');
    if (!klar) return;
    const tutorId = klar.dataset.dpKlartext;
    const ut = DP.panel && DP.panel.querySelector('[data-dp-klartext-ut]');
    if (!ut) return;
    await medan(klar, 'Hämtar…', async () => {
      const { data, error, status } = await supa.rpc('las_utbetalningsmetod_klartext', { p_tutor: tutorId });
      if (error) {
        ut.innerHTML = saknasFunktion(error, status)
          ? '<p class="small" style="color:var(--bl-2)">Inga uppgifter lämnade.</p>'
          : '<p class="small" style="color:var(--fel)">Kunde inte visa uppgifterna: ' + esc(felText(error)) + '</p>';
        return;
      }
      const r = Array.isArray(data) ? data[0] : data;
      if (!r) { ut.innerHTML = '<p class="small" style="color:var(--bl-2)">Inga uppgifter lämnade.</p>'; return; }
      /* Klartexten lagras aldrig i S. Den står i panelen tills någon
         döljer den eller panelen ritas om, och sedan finns den inte. */
      const rader = [['Sätt', esc(metodText(r.metod))]];
      if (r.metod === 'swish') {
        rader.push(['Swishnummer', r.swish ? esc(r.swish) : null]);
      } else {
        rader.push(['Bank', r.bank ? esc(r.bank) : null, 'okänd']);
        rader.push(['Clearingnummer', r.clearing ? esc(r.clearing) : null]);
        rader.push(['Kontonummer', r.konto ? esc(r.konto) : null]);
      }
      ut.innerHTML = dpRubrik('Hela uppgifterna', 'visningen är loggad')
        + dpFakta(rader)
        + '<div class="vy-knapprad" style="margin:12px 0 4px">'
        + '<button class="btn btn-ghost" type="button" data-dp-klartext-dolj>Dölj uppgifterna</button></div>';
      klar.hidden = true;
      const dölj2 = ut.querySelector('[data-dp-klartext-dolj]');
      if (dölj2) dölj2.focus();
    });
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-dp-timpenning]');
    if (!form) return;
    ev.preventDefault();
    const id = form.dataset.dpTimpenning;
    const msg = form.querySelector('[data-dp-tp-msg]');
    rensa(msg);
    const rått = String(form.timpenning.value || '').trim();
    const värde = Number(rått);
    if (!rått || !Number.isInteger(värde) || värde < 1) {
      säg(msg, 'Skriv timpenningen i hela kronor, minst 1.', false);
      form.timpenning.focus();
      return;
    }
    const knapp = form.querySelector('[type="submit"]');
    if (knapp.getAttribute('aria-busy') === 'true') return;
    await medan(knapp, 'Sparar…', async () => {
      /* .select() för att en uppdatering som inte träffar någon rad
         annars ser ut precis som en som lyckades. */
      const { data, error } = await supa.from('tutor_profiles')
        .update({ hourly_rate: värde }).eq('id', id).select('id, hourly_rate');
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      if (!(data || []).length) { säg(msg, 'Ingenting sparades: profilen hittades inte.', false); return; }
      const tp = S.tutorProfiler[id];
      if (tp) tp.hourly_rate = data[0].hourly_rate;
      ritaStudiehjalpare();
      if (DP.typ === 'studiehjalpare' && DP.id === id) {
        ritaDetalj();
        const nyMsg = DP.panel.querySelector('[data-dp-tp-msg]');
        säg(nyMsg, 'Timpenningen är sparad: ' + NX.kr(data[0].hourly_rate) + ' per timme.', true);
        const fält = DP.panel.querySelector('#dp-timpenning');
        if (fält) fält.focus();
      } else {
        säg(msg, 'Timpenningen är sparad.', true);
      }
    });
  });

  function ritaDetalj(laddarÄn) {
    if (!DP.panel || !DP.typ) return;
    const flikar = DP_FLIKAR[DP.typ] || [];
    let person, rubrik, under, märken = '';

    if (DP.typ === 'elev') {
      person = S.elevlista.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      const f = S.personer[person.parent_id];
      rubrik = person.name || '(namn saknas)';
      under = [person.grade, person.school, f && (f.full_name || f.email)]
        .filter(Boolean).join(' · ');
      märken = elevHjälpare(person) ? pill('Matchad', 'ar-klar') : pill('Ingen studiehjälpare', 'ar-ny');
    } else {
      person = S.personer[DP.id];
      if (!person) { stängDetalj(); return; }
      rubrik = person.full_name || person.email || '(namn saknas)';
      under = person.email || '';
      if (DP.typ === 'studiehjalpare') {
        const tp = S.tutorProfiler[DP.id] || {};
        märken = läge(SH_LAGE, tp.status);
      } else {
        const barn = S.elever[DP.id] || [];
        const matchade = barn.filter(e => e.matched_tutor_id && e.match_status === 'matched').length;
        märken = pill(barn.length
          ? matchade + ' av ' + barn.length + (barn.length === 1 ? ' barn matchat' : ' barn matchade')
          : 'Inga barn inlagda', matchade === barn.length && barn.length ? 'ar-klar' : 'ar-ny');
      }
      if (person.is_admin) märken += ' ' + pill('Admin', 'ar-vantar');
    }

    const d = S.detaljCache[DP.typ + ':' + DP.id];
    let kropp;
    if (laddarÄn || !d) kropp = laddar();
    else if (DP.typ === 'familj') kropp = dpFamilj(person, d);
    else if (DP.typ === 'elev') kropp = dpElev(person, d);
    else kropp = dpStudiehjalpare(person, d);

    DP.panel.innerHTML =
      '<div class="dp-topp">'
      + M.avatar(rubrik, (person.avatar_url || null), {})
      + '<span class="dp-namn"><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '')
      + (märken ? '<span class="dp-marken">' + märken + '</span>' : '')
      + '</span>'
      + '<button class="dp-stang" type="button" data-dp-stang aria-label="Stäng">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>'
      + '</div>'
      + '<div class="dp-flikar" role="tablist">'
      + flikar.map(f => '<button class="dp-flik" type="button" role="tab" data-dp-flik="' + f[0] + '"'
        + ' aria-selected="' + (f[0] === DP.flik) + '">' + esc(f[1]) + '</button>').join('')
      + '</div>'
      + '<div class="dp-kropp">' + kropp + '</div>';
  }

  /* Öppnas från vilken lista som helst, och från panelen själv:
     en elev leder till sin familj, en familj till sina barn. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-dp]');
    if (!k) return;
    const [typ, id] = String(k.dataset.dp).split(':');
    öppnaDetalj(typ, id);
  });

  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-dp-not]');
    if (!f) return;
    e.preventDefault();
    const msg = f.querySelector('[data-dp-not-msg]');
    const text = f.text.value.trim();
    if (!text) return;
    const profilId = f.dataset.dpNot;
    const { error } = await supa.from('admin_noteringar')
      .insert({ om_profil: profilId, text, skriven_av: S.user.id });
    if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
    /* Cachen är nu inaktuell för den här personen. Att tömma den
       och hämta om är billigare än att gissa vad servern satte
       för id och tidsstämpel. */
    delete S.detaljCache[DP.typ + ':' + profilId];
    await hämtaDetalj(DP.typ, profilId);
    ritaDetalj();
  });



  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaDetalj, öppnaDetalj
  });
})();
