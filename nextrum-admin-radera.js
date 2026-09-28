/* ============================================================
   NEXTRUM — adminvyn, Radera: en person ur våra system (2026-09-28)

   Leo: "vi ska kunna radera personen från våra system med en knapp
   där ifall personen inte ska anställas eller om personen inte vill
   senare ha vår tjänst."

   Knappen står sist i personpanelen (dpHantera i
   nextrum-admin-detalj.js) och på varje fråga under Kommunikation.
   Den gör tre saker, i den ordningen:

     1. Frågar databasen vad raderingen tar med sig (radering_lage).
        Rutan visar svaret: om personen tas bort helt eller
        avidentifieras, vad som hindrar, vad som avbokas, vad som tas
        bort och vad som står kvar för bokföringen. Rutan räknar
        ingenting själv. Samma funktion avgör vad radera_person() gör,
        så det rutan lovar är det som händer.
     2. Tar bort filerna ur lagringen: profilbilden, barnens mapp och
        CV:t. Filen först, raden sedan (CLAUDE.md avsnitt 6), och
        svaret läses. radera_person() vägrar så länge en fil finns kvar,
        för en fil vars rad är borta går varken att hitta eller städa.
     3. Raderar (radera_person) och ritar om allt som räknade på
        personen.

   Ett hinder är pengar som inte är uppgjorda: något vi är skyldiga
   personen, eller en lön som väntar på en rapport. Då går knappen inte
   att trycka på, och rutan säger vad som ska göras först. Pengar
   personen är skyldig oss hindrar inte; de står som larm, och admin
   bestämmer.

   Databasdelen och reglerna står i
   supabase/migrations/…_personer_redigeras_och_raderas.sql.
   ============================================================ */
(function () {
  'use strict';

  const { esc, säg, rensa, felText } = NX;
  const { medan } = NXStudie;
  const kronor = NXBetalning.kronor;

  const { S, elevNamn, hämtaAllt, hämtaMatchunderlag, namnFör, visaRuta } = NXAdmin;
  /* Funktioner som bor i andra områden, nådda när de anropas. En som
     saknas hoppas över: en lista som inte laddade ska inte stoppa att
     resten ritas om efter en radering. */
  const kör = async (namn, ...a) => {
    const f = NXAdmin.rita[namn];
    if (typeof f === 'function') await f(...a);
  };

  const st = (n, en, fler) => n + ' ' + (n === 1 ? en : fler);

  /* Utan migrationen finns varken radering_lage eller radera_person, och
     PostgREST svarar PGRST202. Det ska stå som vad det är, inte som ett
     obegripligt fel: ingenting har raderats. */
  const SAKNAS = 'Raderingen finns inte i databasen än: migrationen personer_redigeras_och_raderas '
    + 'är inte körd. Ingenting är raderat.';
  const saknas = fel => !!fel && (fel.code === 'PGRST202'
    || /could not find the function/i.test(String(fel.message || '')));

  function namnPå(typ, id) {
    if (typ === 'anmalan') {
      const l = (S.leads || []).find(x => x.id === id);
      return l ? (l.parent_name || l.email || 'anmälan') : 'anmälan';
    }
    if (typ === 'ansokan') {
      const a = (S.ansokningar || []).find(x => x.id === id);
      return a ? (a.name || a.email || 'ansökan') : 'ansökan';
    }
    if (typ === 'kontakt') {
      const k = (S.kontakt || []).find(x => x.id === id);
      return k ? (k.name || k.email || 'meddelandet') : 'meddelandet';
    }
    if (typ === 'elev') return elevNamn(id);
    return namnFör(id);
  }

  /* ------------------------------------------------------------
     VAD RUTAN SÄGER

     Koderna är databasens (intern.radering_underlag), orden är våra.
     En okänd kod visas med sin kod hellre än inte alls.
     ------------------------------------------------------------ */
  const HINDER = {
    betalt_ej_hallet: h => ['Betalt men inte hållet: ' + st(h.antal, 'pass', 'pass')
        + (h.belopp_ore ? ', ' + kronor(h.belopp_ore) : ''),
      'Pengarna är familjens tills passen hålls. Avboka passen under Bokningar och betala tillbaka '
        + 'kortbetalningarna under Ekonomi → Kortbetalningar. Timmar som betalat ett pass går '
        + 'tillbaka till klippkortet av sig själva när passet avbokas.'],
    timmar_kvar: h => ['Timmar kvar: ' + kronor(h.belopp_ore || 0) + ' tillbaka',
      'Betala tillbaka det som är kvar på ' + (h.antal === 1 ? 'klippkortet' : 'klippkorten')
        + ' i Stripes dashboard. Beloppet är det som står under Om de slutar i dag i Ekonomi → '
        + 'Erbjudanden, och hindret försvinner när återbetalningen kommit fram.'],
    timbank_kvar: h => ['Minuter i timbanken: ' + (h.minuter || 0) + ' min, ' + kronor(h.belopp_ore || 0),
      'Betala tillbaka värdet i Stripes dashboard och markera banken utbetald under Ekonomi → Erbjudanden.'],
    kassa_oppen: () => ['Ett köp av timmar står öppet i kassan',
      'Familjen har öppnat Stripes kassa för ett klippkort det senaste dygnet. Vänta tills dygnet gått. '
        + 'Betalas köpet under tiden ska det betalas tillbaka först.'],
    tvist_oppen: h => ['Korttvist som inte är avgjord' + (h.antal > 1 ? ' (' + h.antal + ')' : ''),
      'Passet och rapporten är beviset i tvisten. Vänta tills Stripe avgjort den, under Ekonomi → Kortbetalningar.'],
    betalt_for_lange: h => ['Betalt för längre tid än passen höll: ' + kronor(h.belopp_ore || 0),
      'Betala tillbaka skillnaden under Ekonomi → Kortbetalningar.'],
    ej_rapporterat: h => [st(h.antal, 'pass', 'pass') + ' har börjat men saknar rapport',
      'Studiehjälparen får lön först när rapporten finns, och den går inte att skriva efteråt. Be hen '
        + 'skriva den, eller avboka passet under Bokningar om det aldrig hölls.'],
    matchade_elever: h => [st(h.antal, 'elev är', 'elever är') + ' matchade med hen',
      'Matcha om ' + (h.antal === 1 ? 'eleven' : 'eleverna') + ' under Matchning först, så att ingen '
        + 'familj står utan studiehjälpare.'],
    kommande_betalda: h => [st(h.antal, 'kommande pass', 'kommande pass') + ' betalda med kort: '
        + kronor(h.belopp_ore || 0),
      'Familjerna har betalat för pass med hen. Låt passen hållas, eller avboka dem under Bokningar och '
        + 'betala tillbaka under Ekonomi → Kortbetalningar.']
  };

  const TAS_BORT = {
    barn: ['barn, med läxor, planer och det familjen skrev om det', 'barn, med läxor, planer och det familjen skrev om dem'],
    meddelanden: ['meddelande i chatten', 'meddelanden i chatten'],
    ansokningar: ['ansökan', 'ansökningar'],
    kontaktmeddelanden: ['fråga via kontaktformuläret', 'frågor via kontaktformuläret'],
    anteckningar: ['intern anteckning', 'interna anteckningar'],
    laxor: ['läxa', 'läxor'],
    material: ['material i elevens mapp', 'material i elevens mapp'],
    omraden: ['kunskapsområde', 'kunskapsområden'],
    studieplaner: ['studieplan', 'studieplaner']
  };

  const STAR_KVAR = {
    pass: ['pass som hållits eller betalats', 'pass som hållits eller betalats'],
    klippkort: ['klippkort', 'klippkort'],
    fakturor: ['faktura', 'fakturor'],
    underlag: ['löneunderlag', 'löneunderlag'],
    elevernas_material: ['läxa, plan eller material hen skrivit åt en elev (eleven har det kvar)',
      'läxor, planer och material hen skrivit åt elever (eleverna har dem kvar)'],
    handlingar: ['handling under System → Dokument. Ta bort den där om den inte ska sparas',
      'handlingar under System → Dokument. Ta bort dem där om de inte ska sparas']
  };

  const HINK = { avatarer: 'profilbild', material: 'elevens mapp', cv: 'CV' };

  function ingress(typ, namn, läge) {
    const helt = läge.satt === 'helt';
    if (typ === 'anmalan') {
      return 'Namnet, adressen och det familjen skrev tas bort ur anmälan, och ur andra anmälningar '
        + 'och frågor med samma adress. Raden står kvar utan dem, så att statistiken räknar lika '
        + 'många anmälningar bakåt i tiden.';
    }
    if (typ === 'ansokan') {
      return 'Ansökan tas bort ur våra system, med CV:t och med andra ansökningar och frågor från samma '
        + 'adress. Ett nej mejlas inte av sig självt: har hen inte fått beskedet, skriv det innan.';
    }
    if (typ === 'kontakt') {
      return 'Frågan tas bort ur våra system, med andra frågor från samma adress.';
    }
    if (typ === 'elev') {
      return helt
        ? 'Inga pass med ' + namn + ' har hållits eller betalats, så barnet tas bort helt, med allt som hänger på det.'
        : 'Pass med ' + namn + ' har hållits eller betalats, och bokföringen ska sparas i sju år. Barnet '
          + 'avidentifieras därför: allt som pekar ut barnet tas bort, och det bokföringen kräver står kvar utan namn.';
    }
    return helt
      ? namn + ' har inget som bokföringen behöver, så kontot tas bort helt: inloggningen och allt som hänger på kontot.'
      : namn + ' har pass som hållits eller betalats, och bokföringen ska sparas i sju år. Kontot '
        + 'avidentifieras därför: allt som pekar ut personen tas bort, det bokföringen kräver står kvar '
        + 'utan namn, och inloggningen stängs.';
  }

  function lista(rubrik, rader, klass) {
    if (!rader.length) return '';
    return '<div class="rad-grupp' + (klass ? ' ' + klass : '') + '"><b>' + esc(rubrik) + '</b><ul>'
      + rader.map(r => '<li>' + r + '</li>').join('') + '</ul></div>';
  }

  function innehåll(typ, namn, läge) {
    const hinder = (läge.hinder || []).map(h => {
      const t = HINDER[h.kod] ? HINDER[h.kod](h) : [h.kod, ''];
      return '<b>' + esc(t[0]) + '</b>' + (t[1] ? '<span>' + esc(t[1]) + '</span>' : '');
    });

    const avbokas = [];
    if (läge.avbokas > 0) {
      /* Studiehjälparens pass avbokas också när timmar betalat dem
         (timmarna går tillbaka); familjens bara när ingenting betalats.
         Kortbetalda är ett hinder i båda fallen. */
      avbokas.push(esc(typ === 'studiehjalpare'
        ? st(läge.avbokas, 'kommande pass', 'kommande pass') + '. Familjerna får ett mejl om det, och '
          + 'timmar som betalat ett pass går tillbaka till klippkortet.'
        : st(läge.avbokas, 'kommande pass', 'kommande pass') + ' som inte betalats. Studiehjälparen får '
          + 'ett mejl om det.'));
    }

    const tas = läge.tas_bort || {};
    const bort = [];
    if (typ === 'familj' || typ === 'studiehjalpare') {
      bort.push(esc(läge.satt === 'helt' ? 'Kontot och inloggningen'
        : 'Namnet, adressen, telefonen och profilen. Inloggningen stängs'));
    } else if (typ === 'elev') {
      bort.push(esc(läge.satt === 'helt' ? 'Barnet'
        : 'Namnet, skolan och det familjen skrev om barnet'));
    }
    /* Anmälningarna först när det är en anmälan som raderas: det är den
       admin tryckte på. */
    const anmälningar = tas.anmalningar > 0
      ? esc(st(tas.anmalningar, 'intresseanmälan', 'intresseanmälningar')
        + ' avidentifieras (raden står kvar i statistiken)')
      : null;
    if (anmälningar && typ === 'anmalan') bort.push(anmälningar);
    Object.keys(TAS_BORT).forEach(k => {
      if (tas[k] > 0) bort.push(esc(st(tas[k], TAS_BORT[k][0], TAS_BORT[k][1])));
    });
    if (anmälningar && typ !== 'anmalan') bort.push(anmälningar);
    const filer = läge.filer || [];
    if (filer.length) {
      const sorter = Array.from(new Set(filer.map(f => HINK[f.hink] || f.hink)));
      bort.push(esc(st(filer.length, 'fil', 'filer') + ' ur lagringen (' + sorter.join(', ') + ')'));
    }

    const kvar = läge.star_kvar || {};
    const står = [];
    Object.keys(STAR_KVAR).forEach(k => {
      if (kvar[k] > 0) står.push(esc(st(kvar[k], STAR_KVAR[k][0], STAR_KVAR[k][1])));
    });
    if (kvar.rapporter > 0) {
      står.push(esc(typ === 'studiehjalpare'
        ? st(kvar.rapporter, 'rapport hen skrivit (eleven har den kvar)', 'rapporter hen skrivit (eleverna har dem kvar)')
        : st(kvar.rapporter, 'rapport, utan text', 'rapporter, utan text')));
    }
    if (kvar.konto === true) {
      står.push(esc(typ === 'anmalan'
        ? 'Familjens konto. Det raderas under Familjer, inte här.'
        : 'Kontot med samma adress. Det raderas under Studiehjälpare, inte här.'));
    }
    if (läge.satt === 'avidentifieras' && (typ === 'familj' || typ === 'studiehjalpare' || typ === 'elev')) {
      står.push(esc('Allt det här utan namn, i sju år (bokföringslagen)'));
    }

    /* Larmen ur avvikelser_rader() som gäller personen. De står kvar
       under Ekonomi efteråt, men då finns ingen att fråga. */
    const larm = (läge.larm || []).map(l => {
      /* Samma ord som under Ekonomi (avvText i nextrum-admin-ekonomi.js). */
      const text = typeof NXAdmin.rita.avvText === 'function'
        ? NXAdmin.rita.avvText({ typ: l.kod, belopp_ore: l.belopp_ore })[0] : l.kod;
      return esc(text + (l.antal > 1 ? ' (' + l.antal + ' pass)' : '')
        + (l.belopp_ore && l.kod !== 'betalt_for_lange' ? ', ' + kronor(l.belopp_ore) : ''));
    });

    return '<p>' + esc(ingress(typ, namn, läge)) + ' Det går inte att ångra.</p>'
      + (hinder.length
        ? '<div class="rad-grupp rad-hinder"><b>Det här måste göras först</b><ul>'
          + hinder.map(r => '<li>' + r + '</li>').join('') + '</ul></div>'
        : '')
      + lista('Avbokas', avbokas)
      + lista(typ === 'anmalan' ? 'Tas bort' : 'Tas bort ur våra system', bort)
      + lista('Står kvar', står)
      + (larm.length
        ? lista('Larm som står kvar under Ekonomi', larm)
          + '<p class="xsmall" style="margin:8px 0 0;color:var(--bl-2);line-height:1.55">'
          + 'Avgör dem innan, om det går. Efteråt finns ingen att höra av sig till.</p>'
        : '');
  }

  /* ------------------------------------------------------------
     RUTAN
     ------------------------------------------------------------ */
  function visaRadering(typ, id, läge) {
    const namn = namnPå(typ, id);
    const hindrad = (läge.hinder || []).length > 0;
    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box rad-box" role="dialog" aria-modal="true" aria-labelledby="rad-t">'
      + '<h3 id="rad-t">Radera ' + esc(namn) + '</h3>'
      + innehåll(typ, namn, läge)
      + (hindrad ? ''
        : '<label class="rad-ok"><input type="checkbox" id="rad-ok"> '
          + 'Jag har läst vad som tas bort. Det går inte att ångra.</label>')
      + '<p class="ok-msg" id="rad-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-rad-stang>' + (hindrad ? 'Stäng' : 'Avbryt') + '</button>'
      + '<button type="button" class="btn btn-fara" id="rad-ja" disabled>Radera</button>'
      + '</div></div>';

    visaRuta(ruta);
    const box = ruta.querySelector('.nx-fraga-box');
    const knapp = ruta.querySelector('#rad-ja');
    const msg = ruta.querySelector('#rad-msg');
    let klar = false;
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };

    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-rad-stang]')) stäng();
    });
    ruta.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.stopPropagation(); stäng(); }
    });
    const ok = ruta.querySelector('#rad-ok');
    if (ok) ok.addEventListener('change', () => { knapp.disabled = !ok.checked; });
    /* Fokus på det ofarliga. Ett Enter för mycket ska stänga rutan, inte
       kryssa i att man läst. */
    ruta.querySelector('[data-rad-stang]').focus();

    knapp.addEventListener('click', async () => {
      if (klar || knapp.disabled) return;
      rensa(msg);
      await medan(knapp, 'Raderar…', async () => {
        /* Hindren en gång till, innan en enda fil tas bort. Rutan kan ha
           stått öppen medan en familj betalade något, och en fil som är
           borta går inte att lägga tillbaka. */
        const färsk = await supa.rpc('radering_lage', { p_typ: typ, p_id: id });
        if (färsk.error) { säg(msg, '⚠️ ' + (saknas(färsk.error) ? SAKNAS : felText(färsk.error)), false); return; }
        const nu = färsk.data || {};
        if (nu.fel) { säg(msg, '⚠️ ' + nu.fel, false); return; }
        if ((nu.hinder || []).length) {
          säg(msg, '⚠️ Något har ändrats sedan rutan öppnades, och det finns ett hinder nu. Stäng och öppna Radera igen.', false);
          return;
        }

        /* Filen först. Svaret läses: Storage hoppar tyst över en fil den
           inte får ta bort, och då ska raden stå kvar så att filen går att
           hitta. radera_person() prövar det en gång till. */
        const perHink = {};
        (nu.filer || []).forEach(f => { (perHink[f.hink] = perHink[f.hink] || []).push(f.namn); });
        for (const hink of Object.keys(perHink)) {
          const namnen = perHink[hink];
          const { data, error } = await supa.storage.from(hink).remove(namnen);
          if (error) {
            säg(msg, '⚠️ Filerna kunde inte tas bort ur lagringen: ' + felText(error) + '. Ingenting är raderat.', false);
            return;
          }
          if (Array.isArray(data) && data.length < namnen.length) {
            säg(msg, '⚠️ ' + st(namnen.length - data.length, 'fil', 'filer') + ' (' + (HINK[hink] || hink)
              + ') gick inte att ta bort ur lagringen. Ingenting är raderat.', false);
            return;
          }
        }

        const { data: svar, error } = await supa.rpc('radera_person', { p_typ: typ, p_id: id });
        if (error) { säg(msg, '⚠️ ' + (saknas(error) ? SAKNAS : felText(error)), false); return; }
        klar = true;

        /* Panelen visar någon som inte finns längre. */
        await kör('stängDetalj');
        box.innerHTML = kvitto(typ, namn, svar || {});
        box.querySelector('[data-rad-stang]').focus();

        /* Allt som räknade på personen hämtas och ritas om. Går det inte
           är raderingen ändå gjord, och det ska stå så. */
        try {
          await hämtaAllt();
          for (const f of ['ritaLeads', 'ritaAnsokningar', 'ritaKontakt', 'ritaChattar', 'ritaFamiljer',
                           'ritaElever', 'ritaStudiehjalpare', 'ritaBokningar', 'ritaKalender',
                           'ritaLektioner', 'ritaUppdrag', 'ritaUppgifter']) {
            await kör(f);
          }
          await hämtaMatchunderlag();
          await kör('ritaMatchning');
          await kör('laddaOmEkonomi');
        } catch (e) {
          const p = box.querySelector('p');
          if (p) p.insertAdjacentHTML('afterend', '<p class="xsmall" style="color:var(--fel)">'
            + 'Raderingen är gjord, men vyn kunde inte hämtas om: ' + esc(felText(e))
            + '. Ladda om sidan.</p>');
        }
      });
    });
  }

  function kvitto(typ, namn, svar) {
    const delar = [];
    const gjort = svar.gjort || '';
    if (typ === 'anmalan') delar.push('Anmälan från ' + namn + ' är avidentifierad.');
    else if (typ === 'ansokan') delar.push('Ansökan från ' + namn + ' är borttagen.');
    else if (typ === 'kontakt') delar.push('Frågan från ' + namn + ' är borttagen.');
    else if (/^avidentifiera/.test(gjort)) {
      delar.push(namn + ' är avidentifierad. Det bokföringen kräver står kvar utan namn.');
    } else delar.push(namn + ' är raderad ur våra system.');

    if (svar.avbokade > 0) delar.push(st(svar.avbokade, 'kommande pass', 'kommande pass') + ' avbokades.');
    if (svar.anmalningar > 0 && typ !== 'anmalan') {
      delar.push(st(svar.anmalningar, 'intresseanmälan', 'intresseanmälningar') + ' avidentifierades.');
    } else if (svar.anmalningar > 1) {
      delar.push(st(svar.anmalningar - 1, 'anmälan till', 'anmälningar till') + ' med samma adress avidentifierades.');
    }
    if (svar.ansokningar > (typ === 'ansokan' ? 1 : 0)) {
      delar.push(st(svar.ansokningar - (typ === 'ansokan' ? 1 : 0),
        typ === 'ansokan' ? 'ansökan till' : 'ansökan', typ === 'ansokan' ? 'ansökningar till' : 'ansökningar')
        + ' togs bort.');
    }
    if (svar.kontaktmeddelanden > (typ === 'kontakt' ? 1 : 0)) {
      delar.push(st(svar.kontaktmeddelanden - (typ === 'kontakt' ? 1 : 0),
        typ === 'kontakt' ? 'fråga till' : 'fråga via kontaktformuläret',
        typ === 'kontakt' ? 'frågor till' : 'frågor via kontaktformuläret') + ' togs bort.');
    }

    return '<h3 id="rad-t">Klart</h3>'
      + '<p>' + esc(delar.join(' ')) + '</p>'
      + '<p class="xsmall" style="color:var(--bl-2);line-height:1.55">Raderingen står i auditloggen '
      + 'under System, utan namn: vem som gjorde den, när och hur mycket.</p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-primary" data-rad-stang>Stäng</button>'
      + '</div>';
  }

  /* Knappen: panelens Radera, och Ta bort på en fråga. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-radera]');
    if (!knapp) return;
    const [typ, id] = String(knapp.dataset.radera).split(':');
    if (!typ || !id) return;
    await medan(knapp, 'Frågar…', async () => {
      const { data, error } = await supa.rpc('radering_lage', { p_typ: typ, p_id: id });
      if (error) { alert(saknas(error) ? SAKNAS : 'Kunde inte fråga databasen: ' + felText(error)); return; }
      if (!data) { alert('Databasen svarade inte med något.'); return; }
      if (data.fel) { alert(data.fel); return; }
      visaRadering(typ, id, data);
    });
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, { visaRadering });
})();
