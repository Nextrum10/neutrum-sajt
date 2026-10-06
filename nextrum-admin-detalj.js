/* ============================================================
   NEXTRUM — adminvyn, detaljpanelen (familj, elev, studiehjälpare, anmälan, ansökan, pass)

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

  const { ANS_LAGE, BOK_LAGE, DP, FAKT_LAGE, KORT_LAGE, LEAD_LAGE, S, SH_LAGE, TILLAGG_LAGE,
          UTB_LAGE, elevHjälpare, elevNamn, funktionsFel, hämtaMatchunderlag, kortDatum, läge, namnFör, närText,
          lägesväljare, pill, rad, ärRaderad } = NXAdmin;
  /* Funktioner som bor i andra områden, nådda när de anropas. En som
     saknas hoppas över: panelen ska inte dö för att en lista inte
     laddade. */
  const kör = (namn, ...a) => {
    const f = NXAdmin.rita[namn];
    return typeof f === 'function' ? f(...a) : undefined;
  };

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
      if (e.target.closest('[data-dp-redigera]')) {
        DP.redigera = true;
        ritaDetalj();
        const första = DP.panel.querySelector('.dp-red input, .dp-red select, .dp-red textarea');
        if (första) första.focus();
        return;
      }
      if (e.target.closest('[data-dp-red-avbryt]')) { DP.redigera = false; ritaDetalj(); return; }
      /* Ett flikbyte lämnar redigeringen. Det som inte sparats sparas
         inte, och formuläret står inte kvar och väntar i en annan flik. */
      const f = e.target.closest('[data-dp-flik]');
      if (f) { DP.flik = f.dataset.dpFlik; DP.redigera = false; ritaDetalj(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && DP.panel && !DP.panel.hidden) stängDetalj();
    });
  }

  function stängDetalj() {
    if (!DP.panel) return;
    DP.panel.classList.remove('ar-oppen');
    DP.bak.classList.remove('ar-oppen');
    DP.typ = null; DP.id = null; DP.redigera = false;
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
        .select('id, subject, area, level, steg, mal_steg, comment, updated_at').eq('student_id', id)
        .order('subject').order('area'));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, went_well, needs_practice, next_focus, ai_feedback, created_at')
        .eq('student_id', id).order('lesson_date', { ascending: false }).limit(30));
    } else if (typ === 'pass') {
      /* Fas 20.1: tiden står på rapporten, inte på passet. Passet bär
         det som bokades; rapporten säger vad som hände. Tillägget för
         övertid och vad kortbetalningen avsåg (stripe_minuter) hämtas
         färskt, för det är de som avgör vad familjen är skyldig. */
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, narvaro, start_tid, slut_tid, hallna_min, debiterade_min, avvikelse_skal, created_at')
        .eq('booking_id', id).order('created_at'));
      lägg('tillagg', supa.from('pass_tillagg')
        .select('id, minuter, begart_ore, status, betalt_ore, aterbetald_ore, betald_at, stripe_skarp, created_at')
        .eq('booking_id', id));
      lägg('pass', supa.from('bookings').select('id, stripe_minuter').eq('id', id));
    } else if (typ === 'anmalan' || typ === 'ansokan') {
      /* Allt om en anmälan eller en ansökan finns redan i S: raden,
         besöken i mejlkön och provförsöken. Ingen fråga till. */
    } else if (typ === 'chatt') {
      /* Genom chatt_las() och inte en select: funktionen skriver
         öppningen i auditloggen i samma transaktion som den läser. */
      const [förälder, hjälpare] = String(id).split('|');
      lägg('chatt', supa.rpc('chatt_las', { p_parent: förälder, p_tutor: hjälpare }));
    } else if (typ === 'studiehjalpare') {
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, student_id, lesson_date, created_at').eq('tutor_id', id)
        .order('lesson_date', { ascending: false }).limit(30));
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));
      /* Vilka familjer hen har en tråd med. Bara vem och när, ingen text:
         texten läses genom Öppna chatt, som står i loggen. */
      lägg('tradar', supa.from('messages')
        .select('parent_id, created_at').eq('tutor_id', id)
        .order('created_at', { ascending: false }).limit(TRAD_MAX));
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
      /* Vilka studiehjälpare familjen har en tråd med, också en äldre som
         inte ryms bland de 60 i tidslinjen. */
      lägg('tradar', supa.from('messages')
        .select('tutor_id, created_at').eq('parent_id', id)
        .order('created_at', { ascending: false }).limit(TRAD_MAX));
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
      if (r && r.error) {
        d[namn[i] + 'Fel'] = felText(r.error);
        /* En funktion som inte finns (migrationen är inte körd) ska
           kunna sägas som vad den är, inte som ett obegripligt fel. */
        d[namn[i] + 'Saknas'] = r.error.code === 'PGRST202'
          || /could not find the function/i.test(String(r.error.message || ''));
      }
    });

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
    /* Fliken Tider är borta sedan 2026-09-24: studiehjälparen har inget
       veckoschema längre. Familjen föreslår en tid och hjälparen svarar. */
    studiehjalpare: [['oversikt', 'Översikt'], ['elever', 'Elever'], ['pass', 'Pass'],
                     ['ersattning', 'Ersättning'],
                     ['anteckningar', 'Anteckningar']],
    /* Fas 20.2: ett pass, öppnat från bokslutets larm, Ekonomis listor
       och passlistorna i panelen. En flik: allt om ett pass ryms på en. */
    pass:           [['oversikt', 'Passet']],
    /* 2026-09-28: den som skickat en intresseanmälan eller sökt jobb har
       inget konto, men är lika mycket en person i våra system. Listorna
       är bara namn, och allt de skrev står här, med Redigera och Radera
       som för alla andra. Rekryteringens steg stod förut i en egen ruta. */
    anmalan:        [['oversikt', 'Anmälan']],
    ansokan:        [['oversikt', 'Ansökan'], ['rekrytering', 'Rekryteringen']],
    /* 2026-09-29: tråden mellan en familj och en studiehjälpare, öppnad
       med Öppna chatt. Id:t är familjens och studiehjälparens, med ett
       | emellan: tråden har inget eget id (schema-v4). */
    chatt:          [['oversikt', 'Chatten']]
  };

  async function öppnaDetalj(typ, id, flik) {
    if (!DP_FLIKAR[typ]) return;
    DP.redigera = false;
    /* Ett pass hämtas om varje gång. Tiden, tillägget och betalningen
       ändras av andra (studiehjälparen, familjen, Stripe), och ett
       cachat pass hade visat ett tillägg som obetalt efter att det
       betalats.

       En chatt likaså, och av ett skäl till: varje öppning är en rad i
       auditloggen (chatt_las). En öppning ur cachen hade varit en
       läsning som loggen inte vet om. */
    if (typ === 'pass' || typ === 'chatt') delete S.detaljCache[typ + ':' + id];
    DP.chattRitad = null;
    byggPanel();
    DP.sistaFokus = document.activeElement;
    DP.typ = typ; DP.id = id;
    /* En lista kan be om en annan flik än den första (data-dp-start),
       men bara en som typen har. */
    DP.flik = DP_FLIKAR[typ].some(f => f[0] === flik) ? flik : DP_FLIKAR[typ][0][0];

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

  /* E-post och telefon som går att klicka på.

     Stod förut som ren text i faktarutan, och den som ville höra av
     sig fick markera adressen och klistra in den i sitt mejlprogram.
     På en telefon gick det inte alls.

     data-mailtext="keep" är inte valfritt: nextrum-app.js:189 byter
     ut texten i VARJE mailto-länk mot husets egen adress, så att de
     publika sidorna aldrig kan råka visa fel. Utan markeringen skulle
     familjens adress skrivas över med info@nextrum.se och raden ljuga
     om vems adress det är. */
  function dpMejl(adress) {
    if (!adress) return null;
    return '<a href="mailto:' + esc(adress) + '" data-mailtext="keep">' + esc(adress) + '</a>';
  }

  function dpTelefon(nummer) {
    if (!nummer) return null;
    /* tel: tål inte mellanslag eller bindestreck. Numret visas som det
       skrevs in och städas bara i länkens adress. */
    return '<a href="tel:' + esc(String(nummer).replace(/[^\d+]/g, '')) + '">'
      + esc(nummer) + '</a>';
  }

  /* Senast inloggad, och för den som aldrig loggat in en knapp som
     skickar länken igen (2026-10-06). Kontot skapas när personen tas in,
     och länken i mejlet går att missa eller låta bli gammal. bjud-in
     avgör vad som går: en ny inbjudan, en länk för att välja lösenord,
     eller ingenting för ett konto i bruk. */
  function dpSenast(p) {
    if (p.last_seen_at) return esc(kortDatum(p.last_seen_at));
    return 'aldrig' + (p.email && (p.role === 'parent' || p.role === 'tutor')
      ? ' <button class="btn btn-ghost btn-sm" type="button" data-dp-bjud-igen="' + esc(p.id) + '">'
        + 'Skicka inbjudan igen</button>'
      : '');
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
      läge(BOK_LAGE, b.status)
        + ' <button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(b.id) + '">Öppna</button>')).join('');
  }

  /* ------------------------------------------------------------
     PASSET (Fas 20.1 och 20.2)

     Vad som bokades, vad som hölls och vad det kostar. Den hållna
     tiden är studiehjälparens egen uppgift i rapporten, och skälet till
     en avvikelse är hens fritext: det escapas som allt annat, och det
     visas bara här och för familjen, aldrig i ett mejl.

     Talen för betalt och lön kommer ur passunderlag, samma vy som
     månadskörningen och bokslutet räknar på. Att räkna dem en gång
     till här hade gett en tredje definition av samma minuter.
     ------------------------------------------------------------ */
  const minText = m => m == null ? '—' : m + ' min';

  function dpPass(b, d) {
    const pu = (S.passunderlag || []).find(p => p.id === b.id) || null;
    const extra = (d.pass || [])[0] || {};
    const rapporter = d.rapporter || [];
    const rapport = rapporter.find(r => r.start_tid) || rapporter[0] || null;
    const tillägg = (d.tillagg || [])[0] || null;
    const bokat = b.duration_min || 60;
    const klock = t => String(t || '').slice(0, 5);
    const knapp = (typ, id, text) => '<button class="btn btn-ghost btn-sm" type="button" data-dp="'
      + typ + ':' + esc(id) + '">' + esc(text) + '</button>';

    let h = dpFakta([
      ['När', esc(kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + klock(b.wanted_time) : ''))],
      ['Bokat', esc(NXBetalning.timmar(bokat) + ' (' + bokat + ' min)')],
      ['Ämne', b.subject ? esc(b.subject) : null],
      ['Elev', b.student_id ? knapp('elev', b.student_id, elevNamn(b.student_id)) : null, 'inget barn valt'],
      ['Familj', b.parent_id ? knapp('familj', b.parent_id, namnFör(b.parent_id)) : null],
      ['Studiehjälpare', b.tutor_id ? knapp('studiehjalpare', b.tutor_id, namnFör(b.tutor_id)) : null, 'ingen'],
      ['Betalning', esc((KORT_LAGE[b.betalning_status || 'ingen'] || b.betalning_status)
        + (b.klippkort_id ? ', med timmar' : '')
        + (b.betalt_ore != null ? ' · ' + kronor(b.betalt_ore) : '')
        + (extra.stripe_minuter ? ' för ' + minText(extra.stripe_minuter) : '')
        + (Number(b.aterbetald_ore || 0) > 0 ? ' · ' + kronor(b.aterbetald_ore) + ' tillbaka' : ''))
        + (b.stripe_skarp === false ? ' ' + pill('Test', '') : '')]
    ]);

    h += dpRubrik('Hållen tid');
    if (d.rapporterFel) {
      h += tomt('Rapporten gick inte att läsa', d.rapporterFel);
    } else if (!rapport) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Ingen rapport än. '
        + 'Studiehjälparen skriver in tiden med rapporten.</p>';
    } else if (!rapport.start_tid) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Rapporten har ingen tid, så det bokade gäller: '
        + esc(minText(bokat)) + '.</p>';
    } else {
      const deb = rapport.debiterade_min;
      const skillnad = deb - bokat;
      h += dpFakta([
        ['Hölls', esc(klock(rapport.start_tid) + '–' + klock(rapport.slut_tid) + ' (' + minText(rapport.hallna_min) + ')')],
        ['Debiteras', esc(minText(deb) + ' mot ' + bokat + ' bokade')
          + (skillnad ? ' ' + pill((skillnad > 0 ? '+' : '−') + Math.abs(skillnad) + ' min', 'ar-vantar') : '')],
        ['Skäl', rapport.avvikelse_skal ? esc(rapport.avvikelse_skal) : null,
          skillnad ? 'inget skäl angivet' : 'ingen avvikelse']
      ]);
    }
    if (pu) {
      h += dpFakta([
        ['Familjen har betalat för', esc(minText(pu.betalda_min))],
        ['Studiehjälparen får lön för', esc(minText(pu.lon_min))]
      ]);
    }

    h += dpRubrik('Tillägg för övertid');
    if (d.tillaggFel) {
      h += tomt('Tillägget gick inte att läsa', d.tillaggFel);
    } else if (!tillägg) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Inget tillägg.</p>';
    } else {
      const l = TILLAGG_LAGE[tillägg.status] || [tillägg.status, ''];
      h += dpFakta([
        ['Läge', pill(l[0], l[1]) + (tillägg.stripe_skarp === false ? ' ' + pill('Test', '') : '')],
        ['Övertid', esc(minText(tillägg.minuter))],
        ['Begärt', esc(kronor(tillägg.begart_ore))],
        ['Betalt', tillägg.betalt_ore != null
          ? esc(kronor(tillägg.betalt_ore) + (tillägg.betald_at ? ' · ' + kortDatum(tillägg.betald_at) : '')) : null, 'inte betalt'],
        ['Återbetalt', Number(tillägg.aterbetald_ore || 0) > 0 ? esc(kronor(tillägg.aterbetald_ore)) : null, 'inget']
      ]);
    }

    /* Larmen för just det här passet, med samma ord som i Ekonomi. */
    const larm = (S.avvikelser || []).filter(a => a.objekt_tabell === 'bookings' && a.objekt_id === b.id);
    if (larm.length) {
      const text = a => (NXAdmin.rita.avvText ? NXAdmin.rita.avvText(a) : [a.typ, '']);
      h += dpRubrik('Larm', String(larm.length))
        + larm.map(a => dpRad(text(a)[0], text(a)[1], '')).join('');
    }
    return h;
  }

  /* Samma fem steg och samma ord som studievyerna (NXStudie.STEG).
     Här stod förr en egen tabell över de tre gamla nivåerna, och den
     hade redan en gång visat råvärdet i stället för texten för att
     nycklarna inte stämde. Färgen följer steget: rött är långt kvar,
     grönt är säkert. */
  function stegPill(x) {
    const st = NXStudie.stegFör(x);
    return pill(NXStudie.stegText(st), st >= 4 ? 'ar-klar' : st === 3 ? 'ar-vantar' : 'ar-ny');
  }

  /* ------------------------------------------------------------
     DOKUMENTEN (2026-09-29)

     Avtalen och det andra under System → Dokument som gäller
     personen, och om hen ser dem i sin egen vy. Samma rader som där
     (S.handlingar, hämtade när vyn startar), samma Öppna, och en länk
     dit med personen redan vald. Leo: "anställningsavtal med lärare
     eller annat avtal med kund" — den som öppnar personen ska se att
     avtalet finns utan att leta i en annan lista. Ett avtal som
     klistrats in som text (2026-10-05) öppnas likadant: Öppna visar
     texten i samma ruta som under System → Dokument.
     ------------------------------------------------------------ */
  function dpDokument(p) {
    const egna = (S.handlingar || []).filter(h => h.kopplad_tabell === 'profiles' && h.kopplad_id === p.id);
    const rader = egna.map(h => dpRad(h.titel,
      [kör('dokTyp', h.typ), h.delad_med_personen ? 'ser det i sin vy' : 'bara vi ser det',
       h.giltig_till ? 'giltigt till ' + kortDatum(h.giltig_till) : null].filter(Boolean).join(' · '),
      h.fil || typeof h.innehall === 'string'
        ? '<button class="btn btn-ghost btn-sm" type="button" data-dok-oppna="' + esc(h.id) + '">Öppna</button>' : ''
    )).join('');
    return dpRubrik('Dokument', egna.length ? String(egna.length) : '')
      + (S.handlingarFel ? tomt('Dokumenten gick inte att läsa', S.handlingarFel)
        : rader || '<p class="xsmall" style="color:var(--bl-3);margin:0 0 12px">Inga dokument.</p>')
      + '<div class="dp-atgard"><a class="btn btn-ghost btn-sm" href="#system/dokument" data-dok-ny="'
      + esc(p.id) + '" data-dp-stang>Lägg till ett dokument</a></div>';
  }

  /* ------------------------------------------------------------
     CHATTEN (2026-09-29)

     Leo: "vi på admin ska kunna gå in i elevers och lärares chattar
     utan att de ser det. det gör vi från vår admin genom att trycka på
     öppna chatt".

     Tråden läses genom chatt_las() och aldrig genom NXKontakt.tråd().
     Den markerar det den visar som läst, och i adminvyn hade det varit
     vår läsning som tog bort "oläst" hos den som skrev: ett kvitto på
     att mottagaren läst något hen aldrig sett. Databasen nekar det ändå
     (admin har ingen update-policy på messages), men vyn försöker inte
     ens. Ingen Realtime-kanal och ingen skrivruta heller: vi läser, vi
     deltar inte i samtalet.

     Osynligt för dem är inte hemligt för dem. Att vi kan läsa chatten
     står i integritetspolicyn, och varje öppning står i auditloggen
     (chatt.oppnad), skriven av funktionen i samma transaktion som
     läsningen.
     ------------------------------------------------------------ */

  /* Raderna som säger vilka trådar en person har. PostgREST lämnar ändå
     inte ut fler i ett svar, och en familj med över tusen meddelanden
     har sina studiehjälpare bland dem. */
  const TRAD_MAX = 1000;

  function klockslag(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* "Idag" och "Igår", som tråden i vyerna (NXKontakt.dagText, som
     adminvyn inte laddar), men på den svenska dagen: ett meddelande
     klockan halv ett på natten hör till den dag det skrevs. */
  function chattDag(iso) {
    const dag = isoFor(new Date(iso));
    const igår = new Date(); igår.setDate(igår.getDate() - 1);
    if (dag === isoFor(new Date())) return 'Idag';
    if (dag === isoFor(igår)) return 'Igår';
    return datumText(dag);
  }

  function dpChatt(t, d) {
    if (d.chattSaknas) {
      return tomt('Chatten går inte att öppna än',
        'Funktionen chatt_las finns inte i databasen: migrationen admin_oppnar_chatten är inte körd. '
        + 'Ingenting har lästs.');
    }
    if (d.chattFel) return tomt('Chatten gick inte att hämta', d.chattFel);

    /* Nyast först ur databasen, äldst först här: tråden läses uppifrån
       och ned, som i vyerna. */
    const rader = (d.chatt || []).slice().reverse();
    const totalt = rader.length ? (Number(rader[0].totalt) || rader.length) : 0;
    /* Namnet under varje bubbla. I vyerna säger sidan vem som skrev
       (egna till höger); här finns inget "jag". */
    const vem = id => {
      const n = namnFör(id);
      if (n && n !== '—') return n.split(' ')[0];
      return id === t.hjälpare ? 'Studiehjälparen' : 'Familjen';
    };
    const namn = (id, reserv) => {
      const n = namnFör(id);
      return n && n !== '—' ? n : reserv;
    };

    let h = '<p class="dp-chatt-not">Bara läsning. Familjen och studiehjälparen ser inte att du läser: '
      + 'ingenting markeras som läst och ingen notis går ut. Att du öppnade chatten står i '
      + 'auditloggen, utan texten.</p>';

    if (!rader.length) {
      h += '<div style="margin-top:16px">'
        + tomt('Inga meddelanden än', 'Tråden fylls när familjen eller studiehjälparen skriver.') + '</div>';
    } else {
      if (totalt > rader.length) {
        h += '<p class="xsmall" style="color:var(--bl-3);margin:12px 0 0">Visar de ' + rader.length
          + ' senaste av ' + totalt + ' meddelanden.</p>';
      }
      h += '<div class="tr">';
      let förraDagen = '';
      rader.forEach(m => {
        const dag = chattDag(m.created_at);
        if (dag !== förraDagen) { h += '<div class="tr-dag">' + esc(dag) + '</div>'; förraDagen = dag; }
        /* Familjen till vänster, studiehjälparen till höger. */
        h += '<div class="tr-rad ' + (m.sender_id === t.hjälpare ? 'min' : 'deras') + '">'
          + '<div class="tr-bubbla">' + esc(m.body) + '</div>'
          + '<span class="tr-tid">' + esc(vem(m.sender_id) + ' · ' + klockslag(m.created_at))
          + (m.read_at ? '' : ' · <span class="oläst" title="Mottagaren har inte öppnat det än">oläst</span>')
          + '</span></div>';
      });
      h += '</div>';
    }

    return h + '<div class="dp-atgard" style="margin-top:22px">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(t.förälder) + '">'
      + esc(namn(t.förälder, 'Familjen')) + '</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp="studiehjalpare:' + esc(t.hjälpare) + '">'
      + esc(namn(t.hjälpare, 'Studiehjälparen')) + '</button>'
      + '</div>';
  }

  /* Trådarna på en familjs eller en studiehjälpares Översikt, med Öppna
     chatt på var och en. En tråd finns när någon skrivit, och kan
     finnas när de är matchade: då står den med utan datum, så att det
     syns att ingen skrivit. Vem och när, aldrig texten. */
  function dpChattar(p, d, sort) {
    const ärFamilj = sort === 'familj';
    const motpart = ärFamilj ? 'tutor_id' : 'parent_id';
    const trådar = {};
    /* Nyast först, så den första raden per motpart är den senaste. */
    (d.tradar || []).forEach(m => {
      const id = m[motpart];
      if (id && !trådar[id]) trådar[id] = { id: id, senast: m.created_at };
    });
    const matchade = ärFamilj
      ? (S.elever[p.id] || []).filter(e => e.matched_tutor_id && e.match_status === 'matched')
          .map(e => e.matched_tutor_id)
      : S.elevlista.filter(e => e.matched_tutor_id === p.id && e.match_status === 'matched')
          .map(e => e.parent_id);
    matchade.forEach(id => { if (id && !trådar[id]) trådar[id] = { id: id, senast: null }; });

    const lista = Object.values(trådar).sort((a, b) =>
      String(b.senast || '').localeCompare(String(a.senast || ''))
      || namnFör(a.id).localeCompare(namnFör(b.id), 'sv'));

    const rader = lista.map(t => dpRad(namnFör(t.id),
      t.senast ? 'senast ' + kortDatum(t.senast) : 'ingen har skrivit än',
      '<button class="btn btn-ghost btn-sm" type="button" data-dp="chatt:'
        + esc(ärFamilj ? p.id + '|' + t.id : t.id + '|' + p.id) + '">Öppna chatt</button>')).join('');

    return dpRubrik('Chatt', lista.length > 1 ? lista.length + ' trådar' : '')
      + (d.tradarFel ? tomt('Chattarna gick inte att läsa', d.tradarFel)
        : rader || '<p class="xsmall" style="color:var(--bl-3);margin:0 0 12px">'
          + (ärFamilj ? 'Ingen studiehjälpare och ingen tråd än.' : 'Inga elever och ingen tråd än.') + '</p>');
  }

  /* En faktura i familjens Ekonomi (2026-10-06): månaden, beloppet och
     läget, och passen på den med dag, klocka och studiehjälpare. Posterna
     är Betalningar → Fakturors (familjefakturor), så fakturan som samlas
     under månaden står här också, med passen som läggs på den. */
  function dpFaktura(x) {
    const f = x.f;
    const månad = NX.MANADER[Number(String(x.period).slice(5, 7)) - 1] || '';
    const period = månad.charAt(0).toUpperCase() + månad.slice(1) + ' ' + String(x.period).slice(0, 4);
    const läget = x.läge === 'samlas' ? pill('Samlas', 'ar-vantar')
      : x.läge === 'skapas' ? pill('Ingen faktura än', 'ar-ny')
      : x.läge === 'rapport' ? pill('Väntar på rapport', 'ar-vantar')
      : läge(FAKT_LAGE, x.läge);
    const passen = (x.pass || []).map(q => {
      const b = q.b;
      return dpRad((q.datum ? kortDatum(q.datum) : '—') + (b && b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
        [b ? (b.tutor_id ? 'med ' + namnFör(b.tutor_id) : 'ingen studiehjälpare') : q.beskrivning,
          b ? b.subject : null, b ? elevNamn(b.student_id) : null,
          q.öre == null ? 'utan pris' : kronor(q.öre),
          q.läge === 'rapport' ? 'ingen rapport än' : q.läge === 'natt' ? 'inte på fakturan än' : null]
          .filter(v => v && v !== '—').join(' · '),
        b ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(b.id) + '">Öppna</button>' : '');
    }).join('');
    return '<div class="dp-faktura">'
      + dpRad(period, [kronor(x.belopp), x.antal === 1 ? '1 pass' : x.antal + ' pass',
          f && f.fortnox_fakturanummer ? 'faktura ' + f.fortnox_fakturanummer : null,
          f && f.forfaller ? 'förfaller ' + kortDatum(f.forfaller) : null].filter(Boolean).join(' · '), läget)
      + (passen ? '<div class="dp-faktura-pass">' + passen + '</div>' : '')
      + '</div>';
  }

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
      if (!barn.length) return tomt('Inga barn inlagda', 'Familjen lägger till dem i studievyn.');
      return barn.map(e => {
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

    /* Med vem (2026-10-06): Leo ville se när och med vem familjen hade
       sina pass, och raden sa bara vilket barn. */
    if (DP.flik === 'pass') return passLista(pass, b => [elevNamn(b.student_id),
      b.tutor_id ? 'med ' + namnFör(b.tutor_id) : null].filter(v => v && v !== '—').join(' · '));

    if (DP.flik === 'ekonomi') {
      /* Fakturavalet (Fas 14.6). När strömbrytaren är på får alla
         familjer välja faktura; det här är bromsen för en enda. En
         familj som redan valt faktura behåller sina fakturapass. */
      const spärrad = S.fakturaSparr && S.fakturaSparr.has(p.id);
      /* Samma poster som Betalningar → Fakturor, också fakturan som
         samlas under månaden. Utan ekonomifilen: fakturorna som de är. */
      const fam = kör('familjefakturor');
      const familjens = (Array.isArray(fam) ? fam.filter(x => x.parent === p.id)
        : fakturor.map(f => ({ f, period: String(f.period).slice(0, 7) + '-01', läge: NXBetalning.fakturaLage(f),
          belopp: f.belopp_ore, antal: (f.invoice_lines || []).length, pass: [] })))
        .sort((a, b) => b.period.localeCompare(a.period));
      const fakturapass = pass.filter(b => b.betalning_status === 'faktura' && b.status !== 'cancelled').length;
      return dpTal([
        [kronor(obetalt), 'Utestående'],
        [fakturor.length, 'Fakturor'],
        [fakturapass, 'Pass mot faktura']
      ])
      + dpRubrik('Faktura som betalsätt')
      + dpRad(spärrad ? 'Avstängd för den här familjen' : 'Tillåten',
          spärrad ? 'Familjen kan bara betala med kort. Pass som redan valts för faktura faktureras ändå.'
            : (S.fakturaFlagga && S.fakturaFlagga.aktiv ? 'Familjen kan välja faktura på ett pass.'
              : 'Faktura är avstängt för alla just nu, under Betalningar → Inställningar.'),
          '<button class="btn btn-ghost btn-sm" type="button" data-fakturasparr="' + esc(p.id) + '" data-sparra="'
            + (spärrad ? '0' : '1') + '">' + (spärrad ? 'Tillåt faktura' : 'Stäng av faktura') + '</button>')
      + dpRubrik('Fakturor', 'en per månad')
      + (familjens.length ? familjens.map(dpFaktura).join('')
        : tomt('Inga fakturor', 'Familjen betalar med kort, eller har inte valt faktura på något pass än.'));
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
      ['E-post', dpMejl(p.email)],
      ['Telefon', dpTelefon(p.phone)],
      ['Konto skapat', p.created_at ? esc(kortDatum(p.created_at)) : null],
      ['Senast inloggad', dpSenast(p)],
      ['Om familjen', p.bio ? esc(p.bio) : null]
    ])
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [elevNamn(nästa.student_id), nästa.subject, namnFör(nästa.tutor_id)]
            .filter(Boolean).join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'))
    /* När och med vem (2026-10-06): de senaste hållna passen. */
    + dpRubrik('Senaste passen', genomförda.length > 5 ? 'alla under Pass' : '')
    + (genomförda.length
      ? genomförda.slice(0, 5).map(b => dpRad(kortDatum(b.wanted_date)
          + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
          [b.tutor_id ? 'med ' + namnFör(b.tutor_id) : 'ingen studiehjälpare', b.subject, elevNamn(b.student_id)]
            .filter(v => v && v !== '—').join(' · '),
          '<button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(b.id) + '">Öppna</button>')).join('')
      : tomt('Inga hållna pass än', 'Ett pass står här när det är genomfört.'))
    + dpChattar(p, d, 'familj')
    + dpDokument(p)
    + dpHantera('familj', p, {
        rubrik: 'Radera familjen',
        text: 'När familjen inte vill ha tjänsten längre. Kontot, barnen, chatten och det de skrivit '
          + 'tas bort ur våra system. Pass som hållits eller betalats står kvar utan namn, för '
          + 'bokföringen. Rutan säger exakt vad innan något händer.'
      });
  }

  function dpElev(e, d) {
    const f = S.personer[e.parent_id];
    const t = elevHjälpare(e);
    const pass = passFör(b => b.student_id === e.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const plan = (d.plan || [])[0];
    /* passFör sorterar nyast först, så det närmaste kommande står sist. */
    const idag = isoFor(new Date());
    const nästa = pass.filter(b => b.wanted_date >= idag && b.status !== 'cancelled').pop();

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
        stegPill(x))).join('');
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
      /* Det familjen skrivit för matchningen (2026-09-24). Koderna blir
         text ur NX.BEHOV och NX.FORMAT_ONSKEMAL — samma listor som
         familjen valde ur. */
      ['Behöver', (e.behov || []).length
        ? esc(e.behov.map(k => (NX.BEHOV.find(x => x.kod === k) || {}).text).filter(Boolean).join(', ')) : null],
      ['Format', e.format_onskemal
        ? esc((NX.FORMAT_ONSKEMAL.find(x => x.kod === e.format_onskemal) || {}).text || '') : null],
      ['Mål', e.goals ? esc(e.goals) : null],
      ['Lär sig bäst', e.about ? esc(e.about) : null],
      ['Familj', f ? '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(f.id) + '">'
        + esc(f.full_name || f.email || '—') + '</button>' : null],
      ['Studiehjälpare', t
        ? '<button class="btn btn-ghost btn-sm" data-dp="studiehjalpare:' + esc(t.id) + '">'
          + esc(t.full_name || t.email || '—') + '</button>'
        : null, 'ingen matchad än']
    ])
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [nästa.subject, namnFör(nästa.tutor_id)].filter(x => x && x !== '—').join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'))
    + dpRubrik('Studieplan', plan && plan.updated_at ? 'uppdaterad ' + kortDatum(plan.updated_at) : '')
    + (plan && (plan.plan_text || plan.goals)
      ? '<div class="dp-text">' + esc(plan.plan_text || plan.goals) + '</div>'
      : tomt('Ingen studieplan', 'Studiehjälparen skriver den efter första passet.'))
    + dpHantera('elev', e, {
        /* Matchningen görs under Matchning, med eleven redan vald. */
        knappar: '<a class="btn btn-ghost btn-sm" href="#matchning" data-mt-hoppa="' + esc(e.id)
          + '" data-dp-stang>' + (t ? 'Byt studiehjälpare' : 'Matcha') + '</a>',
        rubrik: 'Radera eleven',
        text: 'När barnet inte ska ha hjälp längre men familjen stannar. Läxorna, studieplanen, '
          + 'materialet och det familjen skrev om barnet tas bort. Rapporter och pass som hållits '
          + 'står kvar utan namn och text, för bokföringen och studiehjälparens lön.'
      });
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

    if (DP.flik === 'ersattning') {
      const väntar = utb.filter(u => u.status === 'utkast' || u.status === 'godkand')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      const utbetalt = utb.filter(u => u.status === 'utbetald')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      return dpTal([
        [kronor(väntar), 'Väntar'],
        [kronor(utbetalt), 'Utbetalt'],
        [tp.hourly_rate ? NX.kr(tp.hourly_rate) : '—', 'Per timme']
      ])
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
      ['E-post', dpMejl(p.email)],
      ['Telefon', dpTelefon(p.phone)],
      ['Ålder', tp.age ? esc(String(tp.age) + ' år') : null],
      ['Skola', tp.school ? esc(tp.school) : null],
      ['Ort', tp.city ? esc(tp.city) : null],
      ['Ämnen', (tp.subjects || []).length ? esc(tp.subjects.join(', ')) : null],
      ['Årskurser', (tp.grade_levels || []).length ? esc(tp.grade_levels.join(', ')) : null],
      ['Format', (tp.formats || []).length ? esc(tp.formats.join(', ')) : null],
      ['Timpenning', tp.hourly_rate ? esc(NX.kr(tp.hourly_rate)) : null, 'ej satt'],
      ['Senast inloggad', dpSenast(p)]
    ])
    + (tp.bio ? dpRubrik('Om hen') + '<div class="dp-text">' + esc(tp.bio) + '</div>' : '')
    /* Läget och startsidan stod förut i listan. Publiceringen är ett
       eget beslut, inte en följd av att vara godkänd (schema-v23), och
       knappen står därför bara när hen är godkänd. */
    + dpRubrik('Läge')
    + (tp.id ? lägesväljare(SH_LAGE, tp.status, 'data-sh="' + esc(p.id) + '"') : '')
    + '<div class="dp-atgard">'
    + (tp.status === 'approved'
      ? '<button class="btn btn-ghost btn-sm" type="button" data-sh-publik="' + esc(p.id) + '">'
        + (tp.visa_publikt ? 'Syns på startsidan: dölj' : 'Visa på startsidan') + '</button>'
      : '')
    /* Kontakt bara när adressen finns. En knapp som öppnar ett
       mejlutkast utan mottagare ser ut att fungera och gör det inte. */
    + (p.email
      ? '<button class="btn btn-ghost btn-sm" type="button" data-sh-kontakt="' + esc(p.id) + '">Kontakta</button>'
      : '')
    + '</div>'
    + dpChattar(p, d, 'studiehjalpare')
    + dpDokument(p)
    + dpHantera('studiehjalpare', p, {
        rubrik: 'Radera studiehjälparen',
        text: 'När hen slutar eller inte ska anställas. Kontot, ansökan, chatten och profilen tas bort '
          + 'ur våra system. Pass, rapporter och underlag som redan finns står kvar utan namn, för '
          + 'bokföringen och lönen. Elever ska matchas om först.'
      });
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
        ? tomt('Kunde inte hämta anteckningarna', d.noteringarFel + ' — är schema-v13.sql kört?')
        : n.length
          ? n.map(x => dpRad(x.text, namnFör(x.skriven_av) + ' · ' + kortDatum(x.created_at), ''))
              .join('')
          : tomt('Inga anteckningar än', 'Den första du skriver hamnar överst.'));
  }

  /* ------------------------------------------------------------
     ANMÄLAN OCH ANSÖKAN (2026-09-28)

     Samma uppgifter som tabellerna hade, och samma knappar, men för en
     person i taget. Tabellerna visade ett nittio tecken långt utdrag ur
     det familjen och den sökande skrivit; här står hela texten.
     ------------------------------------------------------------ */
  /* Koden familjen skickade med (2026-09-30): vem som tipsade, eller
     vilken affisch. Personen öppnas i panelen; namnet står i profiles
     och aldrig på koden. */
  function dpKod(l) {
    if (!l.kod) return null;
    const k = (S.tipskod || {})[l.kod];
    if (!k) return esc(l.kod);
    if (k.sort === 'kampanj') {
      return esc(k.namn || 'Kampanj') + ' <span class="xsmall">' + esc(k.kod) + (k.aktiv ? '' : ', avstängd') + '</span>';
    }
    const typ = k.sort === 'studiehjalpare' ? 'studiehjalpare' : 'familj';
    return 'Tipsad av <button class="btn btn-ghost btn-sm" type="button" data-dp="' + typ + ':' + esc(k.person_id) + '">'
      + esc(namnFör(k.person_id)) + '</button> <span class="xsmall">'
      + (typ === 'studiehjalpare' ? 'studiehjälpare' : 'familj') + ', ' + esc(k.kod) + '</span>';
  }

  function dpAnmalan(l) {
    const familj = kör('anmälansFamilj', l);
    const källa = kör('källText', l);
    const tjänst = (S.tjanster || []).find(t => t.kod === l.tjanst);
    return dpRubrik('Anmälan', 'kom in ' + kortDatum(l.created_at))
      + dpFakta([
        ['Förälder', l.parent_name ? esc(l.parent_name) : null],
        ['E-post', dpMejl(l.email)],
        ['Barn', l.child_name ? esc(l.child_name) : null],
        ['Årskurs', l.grade ? esc(l.grade) : null],
        ['Ämne', l.subject ? esc(l.subject) : null],
        ['Tjänst', l.tjanst ? esc((tjänst && tjänst.namn) || l.tjanst) : null],
        /* Tomt är okänt, inte "direkt" (Fas 9.5). */
        ['Källa', källa ? '<span title="' + esc(kör('källTitel', l) || '') + '">' + esc(källa) + '</span>' : null,
          'okänd'],
        ['Kod', dpKod(l), 'ingen'],
        ['Kontaktad', l.kontaktad_at ? esc(kortDatum(l.kontaktad_at)) : null, 'inte än'],
        ['Familj', familj
          ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(familj.id) + '">'
            + esc(familj.full_name || familj.email || '—') + '</button>'
          : null, 'inget konto än']
      ])
      + dpRubrik('Vad de skrev')
      + (l.message ? '<div class="dp-text">' + esc(l.message) + '</div>'
        : tomt('Inget meddelande', 'Familjen skrev ingenting i rutan.'))
      + (l.notering ? dpRubrik('Vår notering') + '<div class="dp-text">' + esc(l.notering) + '</div>' : '')
      /* Vägen vidare. Matchningskön arbetar på elever, inte på
         anmälningar, så utan Skapa elev når ingen familj fram. Utan
         konto heter knappen Ta in familjen: kontot skapas i samma
         tryck (2026-10-06). */
      + dpRubrik('Läge')
      + lägesväljare(LEAD_LAGE, l.status, 'data-lead="' + esc(l.id) + '"')
      + '<div class="dp-atgard">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-lead-kontakt="' + esc(l.id) + '">'
      + (l.kontaktad_at ? 'Skriv igen' : 'Kontakta') + '</button>'
      + (l.status !== 'matched'
        ? '<button class="btn btn-primary btn-sm" type="button" data-lead-elev="' + esc(l.id) + '">'
          + (familj ? 'Skapa elev' : 'Ta in familjen') + '</button>'
        : '')
      + '</div>'
      + dpHantera('anmalan', l, {
          rubrik: 'Radera anmälan',
          text: 'När familjen inte vill ha tjänsten. Namnet, adressen och det de skrev tas bort, också ur '
            + 'andra anmälningar och meddelanden med samma adress. Raden står kvar utan dem, så att '
            + 'statistiken över anmälningar räknar rätt. Har familjen ett konto raderas det under Familjer.'
        });
  }

  function dpAnsokan(a) {
    if (DP.flik === 'rekrytering') return kör('spårLista', a) || '';

    const text = kör('ansökansText', a);
    const cv = kör('cvKnapp', a);
    const tjänster = (a.tjanster || []).map(k => ((S.tjanster || []).find(t => t.kod === k) || {}).namn || k);
    /* Kontot hen skapat, om det finns. Samma jämförelse som "Ta in i
       poolen" gör när den föreslår ett konto. */
    const epost = String(a.email || '').toLowerCase();
    const konto = epost && Object.values(S.personer).find(p =>
      p.role === 'tutor' && !ärRaderad(p) && String(p.email || '').toLowerCase() === epost);
    /* Öppna provet härifrån (2026-09-29): steg 3 i fliken Rekryteringen
       låg nedanför skärmkanten, och här stod bara "Inte öppnat". */
    const provKnapp = kör('provKnapp', a) || '';

    return dpRubrik('Ansökan', 'kom in ' + kortDatum(a.created_at))
      + dpFakta([
        ['E-post', dpMejl(a.email)],
        ['Ålder', a.age ? esc(a.age + ' år') : null],
        /* Under 18: vårdnadshavaren och godkännandet (2026-10-05). */
        ...(kör('vhFakta', a) || []),
        ['Skola', a.school ? esc(a.school) : null],
        ['Ämnen', a.subjects ? esc(a.subjects) : null],
        ['Kan jobba', a.availability ? esc(a.availability) : null],
        ['Söker till', tjänster.length ? esc(tjänster.join(', ')) : null],
        ['CV', cv || null, 'inget bifogat'],
        ['Konto', konto
          ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="studiehjalpare:' + esc(konto.id) + '">'
            + esc(konto.full_name || konto.email) + '</button>'
          : null, 'inget än: det skapas när hen tas in i poolen'],
        ['Provet', esc(kör('provKort', a) || '') + (provKnapp ? ' ' + provKnapp : '')]
      ])
      + dpRubrik('Varför hen söker')
      + (text ? '<div class="dp-text">' + esc(text) + '</div>' : tomt('Inget skrivet', ''))
      + (a.notering ? dpRubrik('Vår notering') + '<div class="dp-text">' + esc(a.notering) + '</div>' : '')
      + (a.vardnadshavare_godkand_at
        ? dpRubrik('Vårdnadshavarens svar', 'inlagt ' + kortDatum(a.vardnadshavare_godkand_at)) + (kör('vhSvar', a) || '')
        : '')
      + dpRubrik('Läge')
      + lägesväljare(ANS_LAGE, a.status, 'data-ans="' + esc(a.id) + '"')
      + '<div class="dp-atgard">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-flik="rekrytering">Rekryteringens steg</button>'
      + (a.status !== 'approved'
        ? '<button class="btn btn-primary btn-sm" type="button" data-ans-pool="' + esc(a.id) + '">Ta in i poolen</button>'
        : '')
      + '</div>'
      + dpHantera('ansokan', a, {
          rubrik: 'Radera ansökan',
          text: 'När hen själv ber om det, eller ansökan är skräp. Ansökan, CV:t och meddelanden med '
            + 'samma adress tas bort ur våra system, och ett nej som inte gått än går aldrig. Ska hen '
            + 'få ett: sätt läget till Avböjd och radera först när nejet gått (det står under '
            + 'Rekryteringen). Har hen ett konto raderas det under Studiehjälpare.'
        });
  }

  /* ------------------------------------------------------------
     EN RADERAD PERSON

     radera_person() tar bort det som pekar ut någon men lämnar det
     bokföringen kräver (supabase/migrations/…_personer_redigeras_och_
     raderas.sql). Kontot eller barnet står då kvar utan namn och syns
     inte i någon lista, men ett gammalt pass pekar på det och går att
     öppna därifrån. Här står varför det finns kvar, och ingenting går
     att ändra.
     ------------------------------------------------------------ */
  function dpRaderad(typ, p) {
    const pass = typ === 'elev' ? passFör(b => b.student_id === p.id)
      : passFör(b => b.parent_id === p.id || b.tutor_id === p.id);
    const vad = typ === 'elev'
      ? 'Namnet och allt familjen och studiehjälparen skrev om barnet är borta. Rapporterna står kvar utan text, för att studiehjälparens lön räknas på dem.'
      : typ === 'studiehjalpare'
        ? 'Namnet, kontaktuppgifterna, profilen och inloggningen är borta. Rapporterna och underlagen står kvar, för lönen och bokföringen.'
        : 'Namnet, kontaktuppgifterna, inloggningen och barnens uppgifter är borta. Passen, fakturorna och klippkorten står kvar, för bokföringen.';
    return '<div class="dp-text">Raderad ' + esc(kortDatum(p.raderad_at)) + '. ' + esc(vad)
      + ' Det sparas i sju år (bokföringslagen).</div>'
      + dpRubrik('Pass', pass.length ? String(pass.length) : '')
      + passLista(pass, b => typ === 'studiehjalpare' ? namnFör(b.parent_id) : namnFör(b.tutor_id));
  }

  /* ------------------------------------------------------------
     REDIGERA OCH RADERA (2026-09-28)

     Leo: "alla personer som finns i våra system i admin, ska vi kunna
     redigera och trycka ta bort på." Två knappar sist i Översikt, för
     varje sorts person. Radera öppnar en ruta som först frågar
     databasen vad raderingen tar med sig (nextrum-admin-radera.js);
     här är det bara knappen. Ett adminkonto raderas inte härifrån:
     databasen vägrar, och knappen ritas inte.
     ------------------------------------------------------------ */
  function dpHantera(typ, rad, o) {
    return '<div class="dp-atgard dp-hantera">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-redigera>Redigera uppgifterna</button>'
      + (o.knappar || '')
      + '</div>'
      + (rad.is_admin ? ''
        : '<div class="dp-fara">'
          + '<div class="dp-fara-text"><b>' + esc(o.rubrik) + '</b><span>' + esc(o.text) + '</span></div>'
          + '<button class="btn btn-fara btn-sm" type="button" data-radera="' + esc(typ + ':' + rad.id) + '">'
          + esc(o.rubrik) + '…</button>'
          + '</div>');
  }

  /* Fälten som går att rätta, per sort. Samma kolumner som vyerna och
     formulären själva skriver, och inget annat: läget, matchningen och
     tidsstämplarna har egna knappar, och e-posten på ett konto är
     inloggningen. En adress som ändras här men inte i Auth hade gett ett
     konto som loggar in med en adress och får mejlen till en annan.

     max följer längdtaken i skydda_leadfalt och skydda_ansokningsfalt,
     och formulären i studievyerna för resten. */
  const RED = {
    anmalan: { tabell: 'leads', fält: [
      { k: 'parent_name', et: 'Förälderns namn', krav: true, max: 120 },
      { k: 'email', et: 'E-post', krav: true, epost: true, max: 200 },
      { k: 'child_name', et: 'Barnets namn', max: 120 },
      { k: 'grade', et: 'Årskurs', max: 60 },
      { k: 'subject', et: 'Ämne', max: 200 },
      { k: 'message', et: 'Vad de skrev', text: true, max: 4000 },
      { k: 'notering', et: 'Vår notering', text: true, max: 2000 }
    ] },
    ansokan: { tabell: 'applications', fält: [
      { k: 'name', et: 'Namn', krav: true, max: 120 },
      { k: 'email', et: 'E-post', krav: true, epost: true, max: 200 },
      /* 2026-10-05. En ny eller rättad adress mejlas av databasen
         (ansokan_besked), en gång per adress, så länge godkännandet
         saknas. Bara när kolumnen finns: om() tar bort fältet annars. */
      { k: 'vardnadshavare_epost', et: 'Vårdnadshavarens e-post', epost: true, max: 200,
        om: r => 'vardnadshavare_epost' in r },
      { k: 'age', et: 'Ålder', tal: [10, 99] },
      { k: 'school', et: 'Skola', max: 120 },
      { k: 'subjects', et: 'Ämnen', max: 200 },
      { k: 'availability', et: 'Kan jobba', max: 200 },
      /* Utan CV-raden, som läggs tillbaka när det sparas: den är enda
         kopplingen mellan ansökan och filen (CV_RAD i
         nextrum-admin-rekrytering.js), och gallringen läser den. */
      { k: 'why', et: 'Varför hen söker', text: true, max: 3800, cv: true },
      { k: 'notering', et: 'Vår notering', text: true, max: 2000 }
    ] },
    familj: { tabell: 'profiles', fält: [
      { k: 'full_name', et: 'Namn', krav: true, max: 120 },
      { k: 'phone', et: 'Telefon', max: 40, typ: 'tel' },
      { k: 'bio', et: 'Om familjen', text: true, max: 1000 }
    ] },
    elev: { tabell: 'students', fält: [
      { k: 'name', et: 'Namn', krav: true, max: 80 },
      { k: 'grade', et: 'Årskurs', val: () => NX.ARSKURSER.map(a => a.text) },
      { k: 'school', et: 'Skola', max: 120 },
      { k: 'subjects', et: 'Ämnen, med komma emellan', lista: true, max: 400 },
      { k: 'goals', et: 'Mål', text: true, max: 600 },
      { k: 'about', et: 'Lär sig bäst', text: true, max: 800 }
    ] },
    studiehjalpare: { tabell: 'profiles', fält: [
      { k: 'full_name', et: 'Namn', krav: true, max: 120 },
      { k: 'phone', et: 'Telefon', max: 40, typ: 'tel' },
      { k: 'age', et: 'Ålder', tal: [13, 99], tabell: 'tutor_profiles' },
      { k: 'school', et: 'Skola', max: 120, tabell: 'tutor_profiles' },
      { k: 'city', et: 'Ort', max: 80, tabell: 'tutor_profiles' },
      { k: 'subjects', et: 'Ämnen, med komma emellan', lista: true, max: 400, tabell: 'tutor_profiles' },
      /* Utan timpenning hoppar månadskörningen över hen: passen hålls
         och ingen lön räknas ut. Därför krävs den för en godkänd. */
      { k: 'hourly_rate', et: 'Timpenning, kronor', tal: [1, 10000], tabell: 'tutor_profiles' },
      { k: 'availability', et: 'Kan jobba', max: 200, tabell: 'tutor_profiles' },
      { k: 'bio', et: 'Om hen', text: true, max: 1000, tabell: 'tutor_profiles' }
    ] }
  };

  /* Raden ett fält läser ur och skrivs till. */
  function redRad(typ, id, f) {
    if (f.tabell === 'tutor_profiles') return S.tutorProfiler[id] || null;
    if (typ === 'anmalan') return S.leads.find(x => x.id === id) || null;
    if (typ === 'ansokan') return S.ansokningar.find(x => x.id === id) || null;
    if (typ === 'elev') return (S.allaElever || S.elevlista).find(x => x.id === id) || null;
    return S.personer[id] || null;
  }

  const CV_RADER = /^CV: .*$/gm;

  function redVärde(typ, id, f) {
    const r = redRad(typ, id, f);
    const v = r ? r[f.k] : null;
    if (f.cv) return String(v || '').replace(CV_RADER, '').trim();
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : String(v);
  }

  function redFält(typ, id, f) {
    const fid = 'dp-red-' + f.k + (f.tabell ? '-tp' : '');
    const namn = f.k + (f.tabell ? '@tp' : '');
    const v = redVärde(typ, id, f);
    let fält;
    if (f.text) {
      fält = '<textarea class="inp" id="' + fid + '" name="' + namn + '" maxlength="' + f.max + '" rows="4">'
        + esc(v) + '</textarea>';
    } else if (f.val) {
      /* Ett värde som inte står i listan (en äldre stavning) visas
         ändå, så att det inte byts ut bara för att formuläret sparas. */
      const val = f.val();
      const alla = v && val.indexOf(v) === -1 ? [v].concat(val) : val;
      fält = '<select class="sel" id="' + fid + '" name="' + namn + '">'
        + '<option value="">Ej angivet</option>'
        + alla.map(x => '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('')
        + '</select>';
    } else if (f.tal) {
      fält = '<input class="inp" id="' + fid + '" name="' + namn + '" type="number" inputmode="numeric"'
        + ' min="' + f.tal[0] + '" max="' + f.tal[1] + '" step="1" value="' + esc(v) + '">';
    } else {
      fält = '<input class="inp" id="' + fid + '" name="' + namn + '" type="'
        + (f.epost ? 'email' : f.typ || 'text') + '" maxlength="' + f.max + '" value="' + esc(v) + '">';
    }
    return '<div class="fgroup"><label for="' + fid + '">' + esc(f.et)
      + (f.krav ? '' : ' <span class="dp-red-valfri">valfritt</span>') + '</label>' + fält + '</div>';
  }

  function dpRedigera(typ, rad) {
    const spec = RED[typ];
    if (!spec) return tomt('Går inte att redigera här', '');
    return '<form class="dp-red" data-dp-red="' + esc(typ + ':' + rad.id) + '" novalidate>'
      + dpRubrik('Redigera uppgifterna')
      + (typ === 'familj' || typ === 'studiehjalpare'
        ? '<p class="dp-red-not">E-post: <b>' + esc(rad.email || '—') + '</b>. Adressen är '
          + 'inloggningen och ändras inte här.</p>'
        : '')
      + spec.fält.filter(f => !f.om || f.om(rad)).map(f => redFält(typ, rad.id, f)).join('')
      + '<p class="ok-msg" data-dp-red-msg></p>'
      + '<div class="dp-atgard">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-red-avbryt>Avbryt</button>'
      + '<button class="btn btn-primary btn-sm" type="submit">Spara</button>'
      + '</div></form>';
  }

  /* Samma värde? Tomt och null är samma sak, och ett tal ur en
     numeric-kolumn jämförs som tal. Utan det hade varje sparning
     skrivit om fält ingen rört, med en rad i auditloggen var. */
  function sammaVärde(ny, gammal) {
    if (Array.isArray(ny) || Array.isArray(gammal)) {
      return JSON.stringify(ny || []) === JSON.stringify(gammal || []);
    }
    if (ny == null || ny === '') return gammal == null || gammal === '';
    if (typeof ny === 'number') return gammal != null && gammal !== '' && Number(gammal) === ny;
    return String(ny) === String(gammal == null ? '' : gammal);
  }

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-dp-red]');
    if (!form) return;
    ev.preventDefault();
    const [typ, id] = form.dataset.dpRed.split(':');
    const spec = RED[typ];
    const msg = form.querySelector('[data-dp-red-msg]');
    rensa(msg);
    if (!spec) return;

    const ändringar = {};
    for (const f of spec.fält) {
      const el = form.elements[f.k + (f.tabell ? '@tp' : '')];
      if (!el) continue;
      const rå = String(el.value || '').trim();
      const r = redRad(typ, id, f);
      let värde;

      if (f.krav && !rå) { säg(msg, '⚠️ ' + f.et + ' får inte vara tomt.', false); el.focus(); return; }
      if (f.epost && rå && !NX.epostOk(rå)) {
        säg(msg, '⚠️ E-postadressen ser inte ut att stämma.', false); el.focus(); return;
      }
      if (f.tal) {
        const n = Number(rå);
        if (rå && (!Number.isInteger(n) || n < f.tal[0] || n > f.tal[1])) {
          säg(msg, '⚠️ ' + f.et + ' ska vara ett heltal mellan ' + f.tal[0] + ' och ' + f.tal[1] + '.', false);
          el.focus(); return;
        }
        värde = rå ? n : null;
      } else if (f.lista) {
        värde = rå.split(',').map(x => x.trim()).filter(Boolean);
      } else if (f.cv) {
        const cvRader = String((r && r.why) || '').match(CV_RADER) || [];
        värde = (rå + (cvRader.length ? '\n\n' + cvRader.join('\n') : '')).trim() || null;
      } else {
        värde = rå || null;
      }

      if (f.k === 'hourly_rate' && värde == null && (S.tutorProfiler[id] || {}).status === 'approved') {
        säg(msg, '⚠️ En godkänd studiehjälpare behöver en timpenning. Utan den räknas ingen lön ut för passen.', false);
        el.focus(); return;
      }

      if (!sammaVärde(värde, r ? r[f.k] : null)) {
        const tabell = f.tabell || spec.tabell;
        (ändringar[tabell] = ändringar[tabell] || {})[f.k] = värde;
      }
    }

    const tabeller = Object.keys(ändringar);
    if (!tabeller.length) { DP.redigera = false; ritaDetalj(); return; }

    await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
      for (const tabell of tabeller) {
        /* Raden tillbaka, så att det som står i panelen är det
           databasen sparade: triggrarna kortar av och skriver om. */
        const { data, error } = await supa.from(tabell).update(ändringar[tabell])
          .eq('id', id).select('*').maybeSingle();
        if (error) { säg(msg, '⚠️ Kunde inte spara: ' + felText(error), false); return; }
        if (!data) {
          säg(msg, '⚠️ Ingenting sparades. Raden finns inte längre, eller så nekade databasen ändringen.', false);
          return;
        }
        const mål = tabell === 'tutor_profiles' ? S.tutorProfiler[id]
          : redRad(typ, id, { tabell: null });
        if (mål) Object.assign(mål, data);
      }

      DP.redigera = false;
      if (typ === 'anmalan') kör('ritaLeads');
      else if (typ === 'ansokan') kör('ritaAnsokningar');
      else if (typ === 'familj') { kör('ritaFamiljer'); kör('ritaElever'); }
      else if (typ === 'elev') { kör('ritaElever'); kör('ritaFamiljer'); }
      else if (typ === 'studiehjalpare') kör('ritaStudiehjalpare');
      /* Matchningen läser namn, ämnen och årskurs ur en egen vy. */
      if (typ === 'elev' || typ === 'studiehjalpare') {
        await hämtaMatchunderlag();
        kör('ritaMatchning');
      }
      ritaDetalj();
    });
  });

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
              'Det här är elevens egen mapp, inte biblioteket. Biblioteket ligger under Material i menyn.'))

      /* SANNINGEN OM VEM SOM SER DET HÄR (Fas 13.3)

         Stod "syns hos familjen direkt" till Fas 13.2, och det var
         sant då. Sedan föräldravyns materialflik togs bort ser
         familjen bara det material som hänger på en LÄXA, och en
         läxa pekar på biblioteket — inte hit.

         Raden är alltså inte kosmetik: en admin som tror att en fil
         här når familjen laddar upp den och slutar tänka på saken.
         Vägen till familjen går genom Material i menyn och en läxa. */
      + dpRubrik('Lägg till', 'elevens egen mapp — familjen ser det inte')
      + '<p class="xsmall" style="margin:0 0 10px;line-height:1.6;color:var(--bl-3)">'
      + 'Det här är vårt eget underlag om eleven. Ska familjen se något: lägg det i '
      + '<a href="#bibliotek">Material</a>, så kan studiehjälparen ge det som läxa.</p>'
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
      + ' placeholder="Skriv uppgiften — eller hämta ett förslag längre ned."></textarea>'
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
  /* Fakturaspärren för en familj (Fas 14.6). En rad i faktura_sparr
     betyder avstängd; bara admin skriver, och databasen prövar det. */
  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-fakturasparr]');
    if (!k) return;
    const id = k.dataset.fakturasparr;
    const stäng = k.dataset.sparra === '1';
    if (stäng) {
      const ja = await bekräfta({
        titel: 'Stäng av faktura för familjen?',
        text: namnFör(id) + ' kan då bara betala med kort. Pass de redan valt faktura för faktureras ändå, '
          + 'och kan betalas med kort om de byter själva.',
        knapp: 'Stäng av'
      });
      if (!ja) return;
    }
    await medan(k, 'Sparar…', async () => {
      const { error } = stäng
        ? await supa.from('faktura_sparr').insert({ parent_id: id })
        : await supa.from('faktura_sparr').delete().eq('parent_id', id);
      if (error && error.code !== '23505') { alert('Kunde inte ändra: ' + felText(error)); return; }
      const { data } = await supa.from('faktura_sparr').select('parent_id');
      S.fakturaSparr = new Set((data || []).map(r => r.parent_id));
      ritaDetalj();
    });
  });

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

  function ritaDetalj(laddarÄn) {
    if (!DP.panel || !DP.typ) return;
    let flikar = DP_FLIKAR[DP.typ] || [];
    let person, rubrik, under, märken = '';

    if (DP.typ === 'pass') {
      person = S.bokningar.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      rubrik = 'Pass ' + kortDatum(person.wanted_date);
      under = [person.subject, elevNamn(person.student_id), namnFör(person.tutor_id)]
        .filter(x => x && x !== '—').join(' · ');
      märken = läge(BOK_LAGE, person.status)
        + (person.attendance === 'franvarande' ? ' ' + pill('Uteblev', 'ar-ny') : '');
    } else if (DP.typ === 'chatt') {
      const [förälder, hjälpare] = String(DP.id).split('|');
      person = { förälder: förälder, hjälpare: hjälpare };
      rubrik = namnFör(förälder) + ' och ' + namnFör(hjälpare);
      under = 'Chatten mellan familjen och studiehjälparen';
      märken = pill('Bara läsning', '');
    } else if (DP.typ === 'anmalan') {
      person = S.leads.find(x => x.id === DP.id);
      if (!person || ärRaderad(person)) { stängDetalj(); return; }
      rubrik = person.parent_name || person.email || '(namn saknas)';
      under = [person.child_name, person.grade, person.subject].filter(Boolean).join(' · ');
      märken = läge(LEAD_LAGE, person.status);
    } else if (DP.typ === 'ansokan') {
      person = S.ansokningar.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      rubrik = person.name || person.email || '(namn saknas)';
      under = [person.age ? person.age + ' år' : null, person.school].filter(Boolean).join(' · ');
      märken = läge(ANS_LAGE, person.status);
    } else if (DP.typ === 'elev') {
      /* Ur alla elever, också de raderade: ett gammalt pass pekar på
         dem, och därifrån ska det gå att se varför namnet är borta. */
      person = (S.allaElever || S.elevlista).find(x => x.id === DP.id);
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

    /* Ett pass och en chatt är ingen person: inget att radera eller
       redigera här. En raderad person har en flik, och inget att ändra. */
    const ärPerson = DP.typ !== 'pass' && DP.typ !== 'chatt';
    const raderad = ärPerson && ärRaderad(person);
    if (raderad) {
      flikar = [['oversikt', 'Raderad']];
      DP.flik = 'oversikt';
      DP.redigera = false;
      märken = pill('Raderad', '');
    }

    const d = S.detaljCache[DP.typ + ':' + DP.id];
    let kropp;
    if (laddarÄn || !d) kropp = laddar();
    else if (raderad) kropp = dpRaderad(DP.typ, person);
    else if (DP.redigera && ärPerson) kropp = dpRedigera(DP.typ, person);
    else if (DP.typ === 'pass') kropp = dpPass(person, d);
    else if (DP.typ === 'chatt') kropp = dpChatt(person, d);
    else if (DP.typ === 'anmalan') kropp = dpAnmalan(person);
    else if (DP.typ === 'ansokan') kropp = dpAnsokan(person);
    else if (DP.typ === 'familj') kropp = dpFamilj(person, d);
    else if (DP.typ === 'elev') kropp = dpElev(person, d);
    else kropp = dpStudiehjalpare(person, d);

    /* Chatten ritas om när en lista gör det (ritaPanelen), och en ny
       panel står överst. Den som läst sig bakåt i tråden ska stå kvar
       där; första gången tråden ritas står den vid det senaste, som i
       vyerna. */
    const förraKropp = DP.panel.querySelector('.dp-kropp');
    const rullning = DP.typ === 'chatt' && DP.chattRitad === DP.id && förraKropp ? förraKropp.scrollTop : null;

    DP.panel.innerHTML =
      '<div class="dp-topp">'
      /* Ett pass har inget ansikte; ämnet får ge initialen. Aldrig
         avatar_url: den är en sökväg i den privata hinken avatarer, inte
         en adress, och som bildadress blir den en trasig bild. */
      + M.avatar(DP.typ === 'pass' ? (person.subject || 'Pass') : DP.typ === 'chatt' ? 'Chatt' : rubrik, null, {})
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

    if (DP.typ === 'chatt' && d && !laddarÄn) {
      const nyKropp = DP.panel.querySelector('.dp-kropp');
      if (rullning != null) nyKropp.scrollTop = rullning;
      else { nyKropp.scrollTop = nyKropp.scrollHeight; DP.chattRitad = DP.id; }
    }
  }

  /* Skicka inbjudan igen (dpSenast). Mejlet är riktigt, så frågan
     kommer först; svaret säger vad som gick. */
  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-bjud-igen]');
    if (!k) return;
    const p = S.personer[k.dataset.dpBjudIgen];
    if (!p || !p.email) return;
    const ja = await bekräfta({
      titel: 'Skicka länken igen till ' + (p.full_name || p.email) + '?',
      text: 'Har hen inte tryckt på länken i inbjudan går en ny till ' + p.email + '. Har hen tryckt men inte '
        + 'valt lösenord går en länk för att välja det. Har hen redan valt sitt lösenord skickas ingenting.',
      knapp: 'Skicka'
    });
    if (!ja) return;
    await medan(k, 'Skickar…', async () => {
      const res = await supa.functions.invoke('bjud-in', { body: { epost: p.email, igen: true } });
      const fel = res.error || (res.data && res.data.error);
      if (fel) { alert(await funktionsFel(fel)); return; }
      alert(res.data.skickat === 'losenord'
        ? 'En länk för att välja lösenord har gått till ' + res.data.till + '.'
        : 'En ny inbjudan har gått till ' + res.data.till + '.');
    });
  });

  /* Öppnas från vilken lista som helst, och från panelen själv:
     en elev leder till sin familj, en familj till sina barn. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-dp]');
    if (!k) return;
    const [typ, id] = String(k.dataset.dp).split(':');
    öppnaDetalj(typ, id, k.dataset.dpStart);
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



  /* Det andra områden anropar. stängDetalj anropas av raderingen, som
     inte har något kvar att visa efteråt. */
  Object.assign(NXAdmin.rita, {
    ritaDetalj, stängDetalj
  });
})();
