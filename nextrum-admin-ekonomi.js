/* ============================================================
   NEXTRUM — adminvyn, Ekonomi: fakturor, utbetalningar, avvikelser, månadskörning

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

  const { DAG, FAKT_LAGE, KORT_LAGE, S, TILLAGG_LAGE, UTB_LAGE, elevNamn, fråga, funktionsFel,
          hämtaAllt, hämtaEkonomiunderlag, kortDatum, matchar, märkFlik,
          namnFör, pill, rad, skriv, tabell, väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const skapaUppgift = (...a) => NXAdmin.rita.skapaUppgift(...a);

  /* ============================================================
     EKONOMI
     ============================================================ */

  /* ============================================================
     MÅNADEN (Fas 20.2)

     Leo 2026-09-27: "i adminvyn ska vi kunna filtrera och stänga
     böckerna utifrån det. månadsvis". Allt i Ekonomi gäller den månad
     som är vald i raden överst: pass, kortbetalningar, tillägg, tvister
     och avvikelser på PASSETS datum, underlag och fakturor på sin
     period. Samma gräns som manad_lage() drar i databasen, så att en
     rad i listan och ett tal i bokslutet aldrig räknas på två sätt.

     Raden startas första gången något i Ekonomi ritas, inte i skalet:
     alla ritfunktioner här frågar valdMånad(), och den som frågar först
     får väljaren skapad. Då kan ingen lista ritas innan det finns en
     månad att filtrera på.

     Det som hör till en annan månad göms, men det försvinner inte:
     avvikelserna, larmen och de öppna tvisterna räknar upp de andra
     månaderna med en knapp dit. Översikten larmar för hela systemet,
     och en avvikelse den pekar på ska inte se borta ut för att fel
     månad råkade vara vald.
     ============================================================ */
  let MV = null;

  function startaMånadsval() {
    if (MV) return;
    const host = $('#eko-manader');
    if (!host) return;
    MV = NXStudie.månadsval(host, {
      antal: 12,
      framåt: 2,
      märke: m => S.stangdaManader && S.stangdaManader.has(m) ? 'Stängd' : '',
      vidVal: bytMånad
    });
    laddaBokslut();
  }

  function valdMånad() {
    startaMånadsval();
    return MV ? MV.vald() : NXStudie.månadIso(new Date());
  }

  const månadFör = datum => String(datum).slice(0, 7) + '-01';

  /* gte och lt, som i databasen. En sträng jämförd mot en sträng:
     wanted_date är ett datum utan tid, och en tidszon hade bara kunnat
     flytta ett pass den sista kvällen till nästa månad. */
  function iMånaden(datum) {
    if (!datum) return false;
    const g = NXStudie.månadsGräns(valdMånad());
    const d = String(datum).slice(0, 10);
    return d >= g.från && d < g.till;
  }
  const periodIMånaden = period => !!period && månadFör(period) === valdMånad();
  const månadText = () => NXStudie.månadsNamn(valdMånad());

  /* Väljaren har de tolv senaste månaderna. En månad utanför den (ett
     pass som är bokat i nästa månad, eller något äldre än ett år) går
     inte att hoppa till, och står därför som text i stället för knapp. */
  function iVäljaren(m) {
    const nu = new Date();
    const först = NXStudie.månadIso(new Date(nu.getFullYear(), nu.getMonth() - 11, 1, 12));
    return m >= först && m <= NXStudie.månadIso(nu);
  }

  function andraMånader(lista, datum) {
    const vald = valdMånad();
    const per = {};
    lista.forEach(x => {
      const d = datum(x);
      if (!d) return;
      const m = månadFör(d);
      if (m !== vald) per[m] = (per[m] || 0) + 1;
    });
    return Object.keys(per).sort().map(m => [m, per[m]]);
  }

  function andraMånaderText(par, vad) {
    if (!par.length) return '';
    return '<p class="eko-andra">' + esc(vad) + ' i andra månader: ' + par.map(([m, n]) => {
      const text = esc(NXStudie.månadsNamn(m)) + ' (' + n + ')';
      return iVäljaren(m)
        ? '<button type="button" class="eko-lank" data-eko-manad="' + m + '">' + text + '</button>'
        : text;
    }).join(', ') + '.</p>';
  }

  /* Datumet som en knapp till passets detalj. */
  function passLänk(b, text) {
    return '<button type="button" class="eko-lank" data-dp="pass:' + esc(b.id) + '"><b>'
      + esc(text || kortDatum(b.wanted_date)) + '</b></button>';
  }
  const bokning = id => (S.bokningar || []).find(b => b.id === id) || null;

  /* Månadskörningens egen väljare följer med när månaden byts, men
     bara när någon valt: vid start står den kvar på förra månaden,
     för det är den som körs, och den innevarande pågår. */
  function synkaKörning() {
    const val = $('#kor-period');
    if (!val) return;
    const p = valdMånad().slice(0, 7);
    if (val.value === p || !Array.prototype.some.call(val.options, o => o.value === p)) return;
    val.value = p;
    glömKörning(val.closest('[data-kor-ruta]'));
  }

  /* Allt ritas ur det som redan är hämtat; bara bokslutet frågar
     databasen. Ingen lista byts mot "Hämtar" (CLAUDE.md avsnitt 3). */
  function bytMånad() {
    synkaKörning();
    ritaFakturor();
    ritaUtbetalningar();
    ritaKortbetalningar();
    ritaAvvikelser();
    laddaBokslut();
  }

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-eko-manad]');
    if (!k || !MV) return;
    MV.sätt(k.dataset.ekoManad);     // tyst: vidVal körs inte av sätt()
    bytMånad();
  });

  /* ============================================================
     BOKSLUTET (Fas 20.2)

     Två beslut av Leo samma dag, och båda bor i databasen:
       1. En stängd månad är låst. Inga pass och inga rapporter i den
          går att ändra, inte heller av admin, förrän någon öppnar den
          med ett skäl.
       2. En månad stängs bara när dess larm är noll.

     Knappen här är grå när månaden pågår eller har larm, och säger
     varför. Det är en upplysning, inte skyddet: stang_manad() prövar
     samma sak och nekar med ett eget besked, och det beskedet visas
     ordagrant om det kommer.

     Talen räknas i manad_lage(), inte här. Månaden har passens,
     betalningarnas och underlagens tal i samma svar, och det svaret
     sparas i manadsbokslut.summering när månaden stängs: det som
     visas är alltså exakt det som frystes.
     ============================================================ */
  let bokslutFråga = 0;

  async function laddaBokslut() {
    const månad = valdMånad();
    const nr = ++bokslutFråga;
    NXStudie.laddarFörsta($('#bokslut'));
    let läge, lista;
    try {
      [läge, lista] = await Promise.all([
        supa.rpc('manad_lage', { p_manad: månad }),
        supa.from('manadsbokslut').select('manad, stangd')
      ]);
    } catch (fel) {
      läge = { error: fel };
      lista = { error: fel };
    }
    // En annan månad hann väljas medan frågan gick. Dess svar gäller.
    if (nr !== bokslutFråga) return;
    if (!lista.error) {
      const förr = Array.from(S.stangdaManader || []).sort().join();
      S.stangdaManader = new Set((lista.data || []).filter(r => r.stangd)
        .map(r => String(r.manad).slice(0, 10)));
      if (MV) MV.märk();
      /* Månadens ekonomi och Löner märker samma månader Stängd. */
      if (Array.from(S.stangdaManader).sort().join() !== förr) ritaMånadsvyerna();
    }
    S.bokslutFel = läge.error ? felText(läge.error) : null;
    S.bokslut = läge.error ? null : läge.data;
    ritaBokslut();
  }

  /* Datum och klockslag i svensk tid. kortDatum() skär av en
     tidsstämpel vid tecken tio, alltså UTC-datumet: en månad stängd
     strax efter midnatt hade stått på dagen innan. */
  const lokalDag = ts => ts ? datumText(isoFor(new Date(ts))) : '—';
  const avNamn = id => { const n = id ? namnFör(id) : '—'; return n && n !== '—' ? ' av ' + n : ''; };

  function kpi(tal, rubrik, under, larm) {
    return '<div class="adm-kpi' + (larm ? ' ar-larm' : '') + '"><b>' + esc(String(tal)) + '</b>'
      + '<span>' + esc(rubrik) + '</span>'
      + (under ? '<span class="adm-kpi-diff">' + esc(under) + '</span>' : '') + '</div>';
  }

  /* Vart ett larm leder. Ett pass öppnas i sin detalj; resten har en
     flik där det åtgärdas. */
  function larmÅtgärd(a) {
    const k = [];
    if (a.objekt_tabell === 'bookings' && bokning(a.objekt_id)) {
      k.push('<button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(a.objekt_id) + '">Öppna passet</button>');
    }
    const flik = {
      pass_utan_rapport: 'avvikelser', fristaende_rapport: 'avvikelser',
      betalt_for_lange: 'kortbetalningar', betald_men_avbokad: 'kortbetalningar',
      faktura_saknas: 'korning', faktura_forfallen: 'fakturor', faktura_gammalt_utkast: 'fakturor',
      betald_och_fakturerad: 'fakturor', faktura_summa_fel: 'fakturor', fakturerat_ogiltigt_pass: 'fakturor',
      ej_utbetalt: 'korning', utbetalning_vantar: 'utbetalningar', utbetalning_misslyckad: 'utbetalningar',
      utbetalning_summa_fel: 'utbetalningar'
    }[a.typ];
    const flikNamn = { avvikelser: 'Avvikelser', kortbetalningar: 'Kortbetalningar', korning: 'Månadskörning',
      fakturor: 'Fakturor', utbetalningar: 'Utbetalningar' };
    if (flik) k.push('<a class="btn btn-ghost btn-sm" href="#ekonomi/' + flik + '">' + esc(flikNamn[flik]) + '</a>');
    if (a.objekt_tabell === 'profiles') {
      k.push('<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(a.objekt_id) + '">Öppna familjen</button>');
    }
    return k.join('');
  }

  /* Vem och när, ur det vyn redan har. Databasen svarar med id:n och
     aldrig med namn (manad_lage), så namnen slås upp här. */
  function larmGäller(a) {
    const b = a.objekt_tabell === 'bookings' ? bokning(a.objekt_id) : null;
    if (b) {
      return [kortDatum(b.wanted_date), b.subject, namnFör(b.parent_id), namnFör(b.tutor_id)]
        .filter(x => x && x !== '—').join(' · ');
    }
    const rad = (S.avvikelser || []).find(x => x.typ === a.typ && x.objekt_id === a.objekt_id) || {};
    return [a.datum ? kortDatum(a.datum) : null,
      rad.kund_id ? namnFör(rad.kund_id) : null,
      rad.studiehjalpare_id ? namnFör(rad.studiehjalpare_id) : null,
      a.belopp_ore != null && a.typ !== 'betalt_for_lange' ? kronor(a.belopp_ore) : null]
      .filter(x => x && x !== '—').join(' · ');
  }

  function ritaBokslut() {
    const host = $('#bokslut');
    if (!host) return;
    const månad = valdMånad();
    const namn = månadText();

    if (S.bokslutFel) {
      host.innerHTML = tomt('Bokslutet gick inte att läsa', S.bokslutFel);
      märkFlik('#flik-bokslut-mark', 0);
      return;
    }
    const d = S.bokslut;
    // Svaret för en annan månad står kvar nedtonat tills det nya kommer.
    if (!d || String(d.manad).slice(0, 10) !== månad) return;

    const p = d.pass || {}, k = d.kort || {}, t = d.tillagg || {};
    const u = d.underlag || {}, f = d.fakturor || {};
    const larm = d.larm || [];
    const b = d.bokslut;
    const stängd = !!(b && b.stangd);
    const utanRapport = Math.max(0, Number(p.genomforda || 0) - Number(p.med_rapport || 0));
    /* Ur svaret sedan Fas 20.5, som rättade att manad_lage räknade
       status 'betald' när ett underlag som gått iväg heter 'utbetald'.
       Reserven läser payouts, om svaret skulle sakna talet. */
    const utbetalda = u.betalda != null ? Number(u.betalda)
      : (S.utbetalningar || []).filter(x => periodIMånaden(x.period) && x.status === 'utbetald').length;

    const läge = stängd ? pill('Stängd', 'ar-klar')
      : d.pagar ? pill('Pågår', 'ar-vantar')
      : larm.length ? pill(larm.length + ' larm kvar', 'ar-ny')
      : pill('Kan stängas', 'ar-vantar');

    let h = '<div class="bokslut-topp"><div><h5>Bokslut för ' + esc(namn) + '</h5>'
      + '<p>' + esc(stängd ? 'Månaden är låst. Pass och rapporter i den går inte att ändra.'
        : d.pagar ? 'Månaden pågår. Talen ändras tills den är slut.'
        : 'Månaden är slut men inte stängd.') + '</p></div>' + läge + '</div>';

    h += '<div class="adm-tal-rad">'
      + kpi(p.genomforda || 0, 'Genomförda pass', 'av ' + (p.bokade || 0) + ' bokade'
        + (p.avbokade ? ' · ' + p.avbokade + ' avbokade' : ''))
      + kpi(p.med_rapport || 0, 'Med rapport', utanRapport
        ? utanRapport + ' saknar rapport' : 'alla har rapport', utanRapport > 0)
      + kpi(NXBetalning.timmar(p.debiterade_min), 'Debiterad tid', 'bokat ' + NXBetalning.timmar(p.bokade_min))
      + kpi(NXBetalning.timmar(p.lon_min), 'Lönetid', 'det studiehjälparna får betalt för')
      + kpi(p.avvikande || 0, 'Avvikande pass', 'hållen tid inte lika med bokad')
      + kpi(kronor(k.betalt_ore), 'Betalt med kort', (k.antal || 0) + (k.antal === 1 ? ' betalning' : ' betalningar')
        + (Number(k.aterbetalt_ore) ? ' · ' + kronor(k.aterbetalt_ore) + ' tillbaka' : ''))
      + kpi(kronor(k.netto_ore), 'Netto efter Stripe', 'avgift ' + kronor(k.avgift_ore)
        + (k.utan_avgift ? ' · ' + k.utan_avgift + ' utan hämtad avgift' : ''), k.utan_avgift > 0)
      + kpi(kronor(t.betalt_ore), 'Tillägg för övertid', (t.antal || 0) + ' betalda'
        + (Number(t.aterbetalt_ore) ? ' · ' + kronor(t.aterbetalt_ore) + ' tillbaka' : ''))
      + kpi(kronor(u.belopp_ore), 'Underlag', (u.antal || 0) + ' st · ' + utbetalda + ' utbetalda')
      + kpi(kronor(f.belopp_ore), 'Fakturor', (f.antal || 0) + ' st · ' + (f.betalda || 0) + ' betalda')
      + '</div>';

    /* Det som inte är kortpengar, och testbetalningarna, för sig: ett
       testpass i den riktiga databasen ska aldrig se ut som intäkt. */
    const också = [
      d.timmar ? d.timmar + (d.timmar === 1 ? ' pass betalt med timmar' : ' pass betalda med timmar') : null,
      // Fas 22.1: timbanken, som inte heller är kortpengar.
      d.timbank && d.timbank.pass ? d.timbank.pass + (d.timbank.pass === 1 ? ' pass betalt med timbanken' : ' pass betalda med timbanken') : null,
      d.timbank && d.timbank.overtid_min ? NXBetalning.timmar(d.timbank.overtid_min) + ' övertid ur timbanken' : null,
      d.faktura && d.faktura.pass ? d.faktura.pass + ' pass mot faktura' : null,
      d.test ? d.test + (d.test === 1 ? ' testbetalning, som inte räknas in' : ' testbetalningar, som inte räknas in') : null
    ].filter(Boolean);
    if (också.length) h += '<p class="bokslut-ovrigt">Också i månaden: ' + esc(också.join(' · ')) + '.</p>';

    h += '<h6 class="bokslut-rubrik">Larm i ' + esc(namn) + (larm.length ? ' (' + larm.length + ')' : '') + '</h6>';
    h += larm.length
      ? '<ul class="bokslut-larm">' + larm.map(a => {
          const [rubrik, under] = avvText(a);
          const gäller = larmGäller(a);
          return '<li><div><b>' + esc(rubrik) + '</b>'
            + (gäller ? '<span class="bokslut-larm-vem">' + esc(gäller) + '</span>' : '')
            + (under ? '<span class="bokslut-larm-hur">' + esc(under) + '</span>' : '') + '</div>'
            + '<div class="bokslut-larm-atg">' + larmÅtgärd(a) + '</div></li>';
        }).join('') + '</ul>'
      : '<p class="bokslut-inga">Inga larm. Allt i månaden går ihop.</p>';

    /* Larm i andra månader, ur samma räkning (avvikelser_rader) som
       översikten läser. Utan datum hör ett larm inte till någon månad. */
    h += andraMånaderText(andraMånader(S.avvikelser || [], a => a.datum), 'Larm');

    h += '<div class="bokslut-stang">';
    if (stängd) {
      h += '<p>Stängd ' + esc(lokalDag(b.stangd_at) + avNamn(b.stangd_av)) + '.</p>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-bokslut-oppna>Öppna igen</button>';
    } else {
      const varför = d.pagar ? 'Månaden är inte slut.'
        : larm.length ? larm.length + ' larm kvar.' : '';
      if (b && b.oppnad_at) {
        h += '<p class="bokslut-oppnad">Öppnad igen ' + esc(lokalDag(b.oppnad_at) + avNamn(b.oppnad_av))
          + (b.oppnad_skal ? ': ' + esc(b.oppnad_skal) : '') + '</p>';
      }
      h += '<button class="btn btn-primary btn-sm" type="button" data-bokslut-stang'
        + (varför ? ' disabled aria-describedby="bokslut-varfor"' : '') + '>Stäng månaden</button>'
        + (varför ? '<span class="bokslut-varfor" id="bokslut-varfor">' + esc(varför) + '</span>' : '');
    }
    h += '</div><p class="ok-msg bokslut-msg" id="bokslut-msg" aria-live="polite"></p>';

    host.innerHTML = h;
    märkFlik('#flik-bokslut-mark', larm.length);
  }

  function efterBokslut(månad, data) {
    if (!data) return;
    /* Svaret från stäng eller öppna är färskare än en hämtning som
       hann starta innan: den får inte skriva tillbaka det gamla läget. */
    bokslutFråga++;
    const m = String(data.manad || månad).slice(0, 10);
    if (data.bokslut && data.bokslut.stangd) S.stangdaManader.add(m);
    else S.stangdaManader.delete(m);
    if (MV) MV.märk();
    if (valdMånad() === m) { S.bokslut = data; S.bokslutFel = null; }
    ritaBokslut();
  }

  document.addEventListener('click', async e => {
    const stäng = e.target.closest('[data-bokslut-stang]');
    const öppna = e.target.closest('[data-bokslut-oppna]');
    if (!stäng && !öppna) return;
    const månad = valdMånad();
    const namn = månadText();

    if (stäng) {
      if (stäng.disabled) return;
      const ja = await bekräfta({
        titel: 'Stäng ' + namn + '?',
        text: 'Pass och rapporter i månaden går inte att ändra efter det, inte heller härifrån. '
          + 'Månadens tal sparas som de ser ut nu. Underlag och fakturor går fortfarande att markera '
          + 'betalda. Månaden kan öppnas igen, med ett skäl.',
        knapp: 'Stäng månaden'
      });
      if (!ja) return;
      await medan(stäng, 'Stänger…', async () => {
        const { data, error } = await supa.rpc('stang_manad', { p_manad: månad });
        if (error) {
          /* Databasen vet något knappen inte visste, till exempel ett
             larm som kommit sedan sidan ritades. Läget hämtas om och
             beskedet står kvar under knappen, ordagrant. */
          await laddaBokslut();
          säg($('#bokslut-msg'), felText(error), false);
          return;
        }
        efterBokslut(månad, data);
      });
      return;
    }

    const skäl = await fråga({
      titel: 'Öppna ' + namn + ' igen?',
      text: 'Pass och rapporter i månaden går att ändra igen tills den stängs på nytt. '
        + 'Skälet sparas med öppningen och står här tills dess.',
      innehåll: '<div class="fgroup" style="margin-top:14px"><label for="bokslut-skal">Varför?</label>'
        + '<textarea class="inp" id="bokslut-skal" rows="3" maxlength="500" '
        + 'placeholder="Till exempel: rapporten den 12:e hade fel sluttid"></textarea></div>',
      knapp: 'Öppna igen',
      läs: ruta => {
        const text = $('#bokslut-skal', ruta).value.trim();
        return text.length >= 5 ? { värde: text }
          : { fel: 'Skriv varför, med minst fem tecken. En öppnad månad utan skäl går inte att följa upp.' };
      }
    });
    if (!skäl) return;
    await medan(öppna, 'Öppnar…', async () => {
      const { data, error } = await supa.rpc('oppna_manad', { p_manad: månad, p_skal: skäl });
      if (error) {
        await laddaBokslut();
        säg($('#bokslut-msg'), felText(error), false);
        return;
      }
      efterBokslut(månad, data);
    });
  });

  /* ============================================================
     FAKTUROR (Fas 14.6)

     Familjen kan välja faktura på ett pass. Månadskörningen samlar
     varje familjs fakturapass på ett utkast här. Fakturan skapas och
     skickas sedan i FORTNOX, som också bokför den. Härifrån skickas
     ingenting: det som sker här är att utkastet läggs in i Fortnox för
     hand, med underlaget nedan, och att fakturanumret i Fortnox och
     förfallodagen skrivs tillbaka. Betald markeras när betalningen
     syns i Fortnox. Fas 14.6 byggde flödet för Wint; Fas 14.9 bytte
     till Fortnox innan någon faktura skapats.

     En API-koppling till Fortnox finns inte, med flit. Fortnox har ett
     dokumenterat API, så kopplingen går att bygga senare, men den
     byggs först när handarbetet faktiskt kostar tid: en koppling mot
     bokföringen som går sönder tyst är värre än ingen. Det manuella
     steget är en knapp i månaden per familj.

     Beloppen går inte att ändra härifrån. De räknades av fakturering
     ur passen, med samma pris som kortet tar, och las_fakturabelopp
     vägrar skriva om dem från en webbläsare.
     ============================================================ */
  const DAGAR = Number((NX.CFG && NX.CFG.BETALNINGSVILLKOR_DAGAR) || 10);

  /* Fakturapass som hölls men inte står på någon faktura än. De kommer
     med på nästa månadskörning. */
  const passPåFaktura = () => {
    const s = new Set();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => { if (l.booking_id) s.add(l.booking_id); }));
    return s;
  };

  function ritaFakturaFlagga() {
    const host = $('#fakt-flagga');
    if (!host) return;
    const f = S.fakturaFlagga;
    if (!f) {
      host.innerHTML = tomt('Strömbrytaren gick inte att läsa',
        S.kortsparrFel || 'Raden faktura saknas i flaggor. Kör migrationen för Fas 14.6.');
      return;
    }
    const spärrade = S.fakturaSparr ? S.fakturaSparr.size : 0;
    host.innerHTML = '<div class="adm-koppling-kort">'
      + '<h6>Faktura som betalsätt ' + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', '')) + '</h6>'
      + '<p>' + esc(f.beskrivning || '') + '</p>'
      + (!f.aktiv && f.vantar_pa ? '<div class="adm-krav">Ska vara avgjort först: ' + esc(f.vantar_pa) + '</div>' : '')
      + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">'
      + (spärrade ? spärrade + (spärrade === 1 ? ' familj är avstängd' : ' familjer är avstängda')
          + ' från faktura (under Familjer, i familjens ekonomi). ' : '')
      + 'Ändrad ' + esc(kortDatum(f.uppdaterad)) + '</p>'
      + '<div style="margin-top:12px"><button class="btn ' + (f.aktiv ? 'btn-ghost' : 'btn-primary')
      + ' btn-sm" type="button" data-fakturaflagga="' + (f.aktiv ? '0' : '1') + '">'
      + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></div>'
      + '</div>';
  }

  function ritaFakturor() {
    ritaFakturaFlagga();
    const sök = $('#fakt-sok').value.trim();
    const st = $('#fakt-status').value;
    // Fas 20.2: fakturans period, alltså månaden passen på den hölls.
    const iMån = (S.fakturor || []).filter(f => periodIMånaden(f.period));
    const rader = iMån
      .filter(f => !st || NXBetalning.fakturaLage(f) === st)
      .map(f => ({ ...f, familj: namnFör(f.parent_id) }))
      .filter(f => matchar(f, ['familj', 'fortnox_fakturanummer'], sök));

    const på = passPåFaktura();
    const väntar = (S.bokningar || []).filter(b => b.betalning_status === 'faktura'
      && b.status === 'completed' && b.fakturerbar !== false && !på.has(b.id) && iMånaden(b.wanted_date));
    const vänt = $('#fakt-vantar');
    if (vänt) {
      vänt.textContent = väntar.length
        ? väntar.length + (väntar.length === 1 ? ' genomfört fakturapass väntar' : ' genomförda fakturapass väntar')
          + ' på nästa månadskörning.'
        : '';
    }

    $('#fakt-antal').textContent = rader.length + ' av ' + iMån.length;
    $('#fakt-tabell').innerHTML = tabell([
      { namn: 'Period', rita: f => '<b>' + esc(NXBetalning.periodText(f.period)) + '</b>' },
      { namn: 'Familj', rita: f => esc(f.familj) },
      { namn: 'Pass', rita: f => '<span class="adm-tal">' + (f.invoice_lines || []).length + '</span>' },
      { namn: 'Belopp', rita: f => '<span class="adm-tal">' + esc(kronor(f.belopp_ore)) + '</span>' },
      { namn: 'I Fortnox', rita: f => f.fortnox_fakturanummer
        ? '<span class="adm-tal">' + esc(f.fortnox_fakturanummer) + '</span>'
        : '<span class="adm-und">inte inlagd</span>' },
      { namn: 'Förfaller', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.forfaller)) + '</span>' },
      { namn: 'Läge', rita: f => { const l = FAKT_LAGE[NXBetalning.fakturaLage(f)] || [f.status, '']; return pill(l[0], l[1]); } },
      /* Nästa steg för just den här fakturan, och bara det. Rullgardinen
         som förut bytte läge fritt är borta: Skickad utan fakturanumret
         i Fortnox och förfallodag är en rad ingen kan följa upp i Fortnox. */
      { namn: '', höger: true, rita: f => {
        const k = [];
        k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-underlag="' + f.id + '">Underlag</button>');
        if (f.status === 'utkast') {
          k.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-fortnox="' + f.id + '">Lagd i Fortnox</button>');
          k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-bort="' + f.id + '">Ta bort</button>');
        } else if (f.status === 'skickad' || f.status === 'forfallen') {
          k.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-betald="' + f.id + '">Betald</button>');
          k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-makulera="' + f.id + '">Makulera</button>');
        }
        return k.join(' ');
      } }
    ], rader, iMån.length ? 'Inga fakturor matchar' : 'Inga fakturor för ' + månadText());
  }

  /* Underlaget för Fortnox: det som ska stå på fakturan. Kunden är
     familjens namn och e-post; Fortnox skickar fakturan till adressen.
     Raderna säger ämne och datum, aldrig barnets namn. */
  function fakturaUnderlag(f) {
    const p = S.personer[f.parent_id] || {};
    const rader = (f.invoice_lines || []).slice().sort((a, c) => String(a.beskrivning).localeCompare(String(c.beskrivning)));
    return [
      'Kund: ' + (p.full_name || '—') + ' (privatperson)',
      'E-post: ' + (p.email || '—'),
      'Period: ' + NXBetalning.periodText(f.period),
      'Betalningsvillkor: ' + DAGAR + ' dagar, ingen avgift',
      '',
      ...rader.map(r => r.beskrivning + '  ·  ' + NXBetalning.timmar(r.minuter) + ' à '
        + kronor(r.pris_per_timme_ore) + '/h  ·  ' + kronor(r.belopp_ore)),
      '',
      'Att betala: ' + kronor(f.belopp_ore)
    ].join('\n');
  }

  document.addEventListener('click', async e => {
    const flagga = e.target.closest('[data-fakturaflagga]');
    if (flagga) {
      const på = flagga.dataset.fakturaflagga === '1';
      const f = S.fakturaFlagga || {};
      const ja = await bekräfta(på ? {
        titel: 'Slå på faktura?',
        text: 'Från och med nu kan alla familjer välja "Få faktura nästa månad" när de bekräftar rapporten. '
          + 'Deras pass kommer med på en faktura i början av nästa månad, att betala inom ' + DAGAR + ' dagar. '
          + 'Fyll i BANKGIRO i nextrum-config.js först, så att familjen ser vart de betalar.',
        forhandsvisning: f.vantar_pa ? 'Det här ska vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      } : {
        titel: 'Stäng av faktura?',
        text: 'Familjerna kan inte längre välja faktura. Pass som redan valts för faktura faktureras ändå.',
        knapp: 'Stäng av'
      });
      if (!ja) return;
      await medan(flagga, på ? 'Slår på…' : 'Stänger av…', async () => {
        const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'faktura');
        if (error) { alert('Kunde inte ändra strömbrytaren: ' + felText(error)); return; }
        const { data } = await supa.from('flaggor').select('*').eq('kod', 'faktura').maybeSingle();
        if (data) S.fakturaFlagga = data;
        ritaFakturaFlagga();
      });
      return;
    }

    const und = e.target.closest('[data-fakt-underlag]');
    if (und) {
      const f = (S.fakturor || []).find(x => x.id === und.dataset.faktUnderlag);
      if (!f) return;
      const text = fakturaUnderlag(f);
      const kopiera = await bekräfta({
        titel: 'Underlag för Fortnox',
        text: 'Skapa en kundfaktura i Fortnox med de här uppgifterna, och skicka den som e-post. '
          + 'Tryck sedan Lagd i Fortnox och skriv in fakturanumret.',
        forhandsvisning: text,
        knapp: 'Kopiera',
        avbryt: 'Stäng'
      });
      if (kopiera) {
        try { await navigator.clipboard.writeText(text); }
        catch (fel) { alert('Kopieringen gick inte. Markera texten och kopiera den för hand.'); }
      }
      return;
    }

    const fortnox = e.target.closest('[data-fakt-fortnox]');
    if (fortnox) {
      const f = (S.fakturor || []).find(x => x.id === fortnox.dataset.faktFortnox);
      if (!f) return;
      const förval = new Date(Date.now() + DAGAR * 86400000);
      const värde = await fråga({
        titel: 'Lagd i Fortnox',
        text: namnFör(f.parent_id) + ', ' + NXBetalning.periodText(f.period) + ', ' + kronor(f.belopp_ore)
          + '. Skriv fakturanumret, OCR-numret och förfallodagen som de står på fakturan i Fortnox.',
        /* OCR (Fas 19.6). Familjen ser det under Fakturor att betala och
           betalar med det i sin bank. Det skrivs av från fakturan, aldrig
           räknas fram här: Fortnox bestämmer det ur bankgiroavtalet.
           Kontrollsiffran prövas både här och i databasen
           (invoices_ocr_giltigt). Tomt går, om fakturan saknar OCR; då
           är fakturanumret familjens meddelande. */
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="fakt-nr">Fakturanummer i Fortnox</label>'
          + '<input class="inp" id="fakt-nr" inputmode="numeric" autocomplete="off" maxlength="30"></div>'
          + '<div class="fgroup" style="margin-top:12px"><label for="fakt-ocr">OCR-nummer</label>'
          + '<input class="inp" id="fakt-ocr" inputmode="numeric" autocomplete="off" maxlength="25"></div>'
          + '<div class="fgroup" style="margin-top:12px"><label for="fakt-forfaller">Förfaller</label>'
          + '<input class="inp" id="fakt-forfaller" type="date" value="' + isoFor(förval) + '"></div>',
        knapp: 'Spara',
        läs: ruta => {
          const nr = $('#fakt-nr', ruta).value.trim();
          const ocr = $('#fakt-ocr', ruta).value.replace(/\s+/g, '');
          const dag = $('#fakt-forfaller', ruta).value;
          if (!/^[A-Za-z0-9-]{1,30}$/.test(nr)) return { fel: 'Fakturanumret får bara innehålla siffror, bokstäver och bindestreck.' };
          if (ocr && !NXBetalning.ocrGiltigt(ocr)) return { fel: 'OCR-numret stämmer inte: kontrollsiffran är fel. Skriv det exakt som på fakturan.' };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return { fel: 'Välj förfallodagen.' };
          return { värde: { nr, ocr: ocr || null, dag } };
        }
      });
      if (!värde) return;
      await medan(fortnox, 'Sparar…', async () => {
        if (await skriv('invoices', f.id, {
          status: 'skickad', skickad_at: new Date().toISOString(),
          fortnox_fakturanummer: värde.nr, ocr: värde.ocr, forfaller: värde.dag
        })) {
          Object.assign(f, { status: 'skickad', fortnox_fakturanummer: värde.nr, ocr: värde.ocr, forfaller: värde.dag });
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const betald = e.target.closest('[data-fakt-betald]');
    if (betald) {
      const f = (S.fakturor || []).find(x => x.id === betald.dataset.faktBetald);
      if (!f) return;
      const ja = await bekräfta({
        titel: 'Har pengarna kommit in?',
        text: 'Faktura ' + (f.fortnox_fakturanummer || '') + ' till ' + namnFör(f.parent_id) + ', ' + kronor(f.belopp_ore)
          + '. Markera bara betald när Fortnox visar att betalningen kommit in.',
        knapp: 'Ja, den är betald'
      });
      if (!ja) return;
      await medan(betald, 'Sparar…', async () => {
        const nu = new Date().toISOString();
        if (await skriv('invoices', f.id, { status: 'betald', betald_at: nu })) {
          Object.assign(f, { status: 'betald', betald_at: nu });
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const mak = e.target.closest('[data-fakt-makulera]');
    if (mak) {
      const f = (S.fakturor || []).find(x => x.id === mak.dataset.faktMakulera);
      if (!f) return;
      const ja = await bekräfta({
        titel: 'Makulera fakturan?',
        text: 'Gör det bara när fakturan är krediterad i Fortnox. Passen på den faktureras inte igen: '
          + 'de räknas som avskrivna. Ska de faktureras om, ta kontakt med familjen först.',
        knapp: 'Makulera'
      });
      if (!ja) return;
      await medan(mak, 'Sparar…', async () => {
        if (await skriv('invoices', f.id, { status: 'makulerad' })) {
          f.status = 'makulerad';
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const bort = e.target.closest('[data-fakt-bort]');
    if (bort) {
      const f = (S.fakturor || []).find(x => x.id === bort.dataset.faktBort);
      if (!f || f.status !== 'utkast') return;
      const ja = await bekräfta({
        titel: 'Ta bort utkastet?',
        text: 'Passen på det blir kvar som fakturapass och kommer med nästa gång månadskörningen körs '
          + 'för samma månad eller senare. Ingenting har skickats.',
        knapp: 'Ta bort'
      });
      if (!ja) return;
      await medan(bort, 'Tar bort…', async () => {
        /* .eq('status', 'utkast'): hann någon lägga in fakturan i Fortnox
           under tiden ska den inte försvinna härifrån. Raderna följer
           med (on delete cascade). */
        const { data, error } = await supa.from('invoices').delete()
          .eq('id', f.id).eq('status', 'utkast').select('id');
        if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
        if (!data || !data.length) { alert('Utkastet hann ändras. Listan laddas om.'); }
        await hämtaAllt();
        ritaFakturor(); await laddaOmEkonomi();
      });
    }
  });

  function ritaUtbetalningar() {
    const sök = $('#utb-sok').value.trim();
    const st = $('#utb-status').value;
    // Fas 20.2: underlagets period, alltså månaden passen hölls.
    const iMån = (S.utbetalningar || []).filter(u => periodIMånaden(u.period));
    const rader = iMån
      .filter(u => !st || u.status === st)
      .map(u => ({ ...u, hjalpare: namnFör(u.tutor_id) }))
      .filter(u => matchar(u, ['hjalpare'], sök));

    $('#utb-antal').textContent = rader.length + ' av ' + iMån.length;
    $('#utb-tabell').innerHTML = tabell([
      { namn: 'Period', rita: u => '<b>' + esc(NXBetalning.periodText(u.period)) + '</b>' },
      { namn: 'Studiehjälpare', rita: u => esc(u.hjalpare) },
      { namn: 'Timmar', rita: u => '<span class="adm-tal">' + esc(NXBetalning.timmar(u.minuter)) + '</span>' },
      { namn: 'Belopp', rita: u => '<span class="adm-tal">' + esc(kronor(u.belopp_ore)) + '</span>' },
      { namn: 'Utbetald', rita: u => '<span class="adm-tal">' + esc(kortDatum(u.utbetald_at)) + '</span>'
        + (u.fel ? '<span class="adm-und" style="color:var(--acc-text)">' + esc(u.fel) + '</span>' : '') },
      /* Underlaget, inte pengarna. Studiehjälparen får se vad hen
         kommer att få och hinner säga ifrån innan beloppet betalas
         ut — det är billigare än att rätta en utbetalning efteråt. */
      { namn: '', höger: true, rita: u => u.status === 'utbetald' ? ''
        : '<button class="btn btn-ghost btn-sm" data-skicka="utbetalning" data-id="'
          + u.id + '">Skicka underlag</button>' },
      { namn: 'Läge', höger: true, rita: u => väljare('utb', UTB_LAGE, u.status, 'data-utb="' + u.id + '"') }
    ], rader, iMån.length ? 'Inga underlag matchar' : 'Inga underlag för ' + månadText());
  }

  /* ============================================================
     KORTBETALNINGAR (Fas 12, familjens enda betalväg sedan Fas 14.2)

     Familjen betalar varje pass med kort, i förväg eller när de
     bekräftar rapporten efter passet (Fas 19.2). Månadsfakturan
     till familjen finns inte längre; fakturorna under sin egen flik är
     de som skapades innan dess.

     Beloppet är FRYST vid betalningen och läses bara här. Ingen
     rullgardin ändrar ett läge i den här tabellen, till skillnad från
     utbetalningar: en betalnings läge sätts av Stripe genom webhooken,
     och att kunna skriva om det för hand hade gjort siffran till en
     åsikt.

     Ingen kolumn för studiehjälparens del, med flit. Hela beloppet
     går till Nextrum, och hjälparens ersättning hör hemma under
     Utbetalningar — den räknas den 25:e ur rapporterna, inte här.
     ============================================================ */
  /* KORT_LAGE bor i kärnan sedan Fas 20.2: passets detalj visar samma lägen. */

  /* "Ej betalda" är en annan fråga än de andra lägena: inte vilka
     betalningar som påbörjats, utan vilka bekräftade och genomförda
     pass ingen har betalat. Samma tre lägen som avvikelsen ej_betalt
     och OBETALDA_LAGEN i _delad/pris.ts. Ett undantaget pass ska inte
     betalas och står därför inte här. */
  const OBETALDA_LAGEN = ['ingen', 'vantar', 'misslyckad'];
  const obetaltPass = b => (b.status === 'confirmed' || b.status === 'completed')
    && b.fakturerbar !== false
    && OBETALDA_LAGEN.indexOf(b.betalning_status || 'ingen') !== -1;

  function ritaKortbetalningar() {
    ritaKortsparr();
    ritaErbjudandenAdmin();
    ritaAvstamning();
    ritaTillägg();
    /* Asynkron för rapporternas skull. Ett fel får inte lämna rutan på
       "Hämtar" — då ser det ut som att den fortfarande arbetar. */
    ritaTvister().catch(fel => {
      const host = $('#tvist-lista');
      if (host) host.innerHTML = tomt('Tvisterna gick inte att visa', felText(fel));
    });
    const sök = $('#kort-sok').value.trim();
    const st = $('#kort-status').value;
    /* Ett fakturapass är ingen kortbetalning (Fas 14.6). Det står under
       Fakturor. Fas 20.2: passets månad, inte betalningens — ett pass i
       september som betalas i oktober står under september. */
    const iMån = (S.bokningar || []).filter(b => iMånaden(b.wanted_date));
    const alla = st === 'obetald'
      ? iMån.filter(obetaltPass)
      : iMån.filter(b => b.betalning_status && b.betalning_status !== 'ingen' && b.betalning_status !== 'faktura');
    const rader = alla
      .filter(b => !st || st === 'obetald' || b.betalning_status === st)
      .map(b => ({ ...b, familj: namnFör(b.parent_id), hjalpare: namnFör(b.tutor_id) }))
      .filter(b => matchar(b, ['familj', 'hjalpare'], sök));

    $('#kort-antal').textContent = rader.length + ' av ' + alla.length;
    $('#kort-tabell').innerHTML = tabell([
      { namn: 'Pass', rita: b => passLänk(b)
        + '<span class="adm-und">' + esc(b.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: b => esc(b.familj) },
      { namn: 'Studiehjälpare', rita: b => esc(b.hjalpare) },
      /* betalt_ore är ett kvitto och skrivs bara av webhooken. Innan
         den kommit står det begärda beloppet, märkt som det det är —
         annars hade en öppnad betalning sett ut som 0 kr betalt. */
      { namn: 'Betalt', rita: b => b.klippkort_id && b.betalt_ore == null
        ? '<span class="adm-und">med timmar</span>'
        : b.betalt_ore != null
        ? '<span class="adm-tal">' + esc(kronor(b.betalt_ore)) + '</span>'
        : b.begart_ore
          ? '<span class="adm-und">begärt ' + esc(kronor(b.begart_ore)) + '</span>'
          : '<span class="adm-und">—</span>' },
      { namn: 'Återbetalt', rita: b => Number(b.aterbetald_ore || 0) > 0
        ? '<span class="adm-tal">' + esc(kronor(b.aterbetald_ore)) + '</span>' : '' },
      /* Stripes avgift (Fas 14.7). Saknas den på en betald rad är den
         inte hämtad än: charge.updated kommer med den, eller knappen
         under Stripe-läget. En testbetalning märks, så att den aldrig
         läses som en intäkt. */
      { namn: 'Avgift', rita: b => (b.stripe_avgift_ore != null
          ? '<span class="adm-tal">' + esc(kronor(b.stripe_avgift_ore)) + '</span>'
          : b.betald_at ? '<span class="adm-und">inte hämtad</span>' : '')
        + (b.stripe_skarp === false ? ' ' + pill('Test', '') : '') },
      { namn: '', höger: true, rita: b => {
        const kvar = Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0);
        const gar = (b.betalning_status === 'betald' || b.betalning_status === 'tvist') && kvar > 0;
        return gar ? '<button class="btn btn-ghost btn-sm" data-aterbetala="' + b.id + '">Återbetala</button>' : '';
      } },
      { namn: 'Läge', höger: true, rita: b =>
        '<span class="adm-tal">' + esc(KORT_LAGE[b.betalning_status] || b.betalning_status) + '</span>' }
    ], rader, (st === 'obetald' ? 'Inga obetalda pass i ' : 'Inga kortbetalningar för ') + månadText());
  }

  /* ============================================================
     TILLÄGGEN (Fas 20.1)

     Ett pass som var betalt och drog över betalas med ett tillägg för
     övertiden, med kort, när familjen bekräftar rapporten. Tillägget är
     en egen betalning i pass_tillagg och skrivs bara av stripe-checkout
     och stripe-webhook. Här läses det, per passets månad.

     Ett obetalt tillägg larmar som tillagg_obetalt, och det är larmet
     som håller månaden öppen, inte den här listan.
     ============================================================ */
  function ritaTillägg() {
    const host = $('#tillagg-tabell');
    if (!host) return;
    if (S.tillaggFel) { host.innerHTML = tomt('Tilläggen gick inte att läsa', S.tillaggFel); return; }
    const rader = (S.tillagg || [])
      .map(t => ({ ...t, pass: bokning(t.booking_id) }))
      .filter(t => t.pass && iMånaden(t.pass.wanted_date));
    $('#tillagg-antal').textContent = rader.length ? rader.length + ' st' : '';
    host.innerHTML = tabell([
      { namn: 'Pass', rita: t => passLänk(t.pass)
        + '<span class="adm-und">' + esc(t.pass.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: t => esc(namnFör(t.pass.parent_id)) },
      { namn: 'Övertid', rita: t => '<span class="adm-tal">' + esc(t.minuter + ' min') + '</span>' },
      { namn: 'Begärt', rita: t => '<span class="adm-tal">' + esc(kronor(t.begart_ore)) + '</span>' },
      { namn: 'Betalt', rita: t => (t.betalt_ore != null
          ? '<span class="adm-tal">' + esc(kronor(t.betalt_ore)) + '</span>'
          : '<span class="adm-und">—</span>')
        + (Number(t.aterbetald_ore || 0) > 0 ? '<span class="adm-und">' + esc(kronor(t.aterbetald_ore)) + ' tillbaka</span>' : '')
        + (t.stripe_skarp === false ? ' ' + pill('Test', '') : '') },
      { namn: 'Läge', höger: true, rita: t => {
        const l = TILLAGG_LAGE[t.status] || [t.status, ''];
        return pill(l[0], l[1]);
      } }
    ], rader, 'Inga tillägg för övertid i ' + månadText());
  }

  /* ============================================================
     SPÄRREN (Fas 14.2)

     "Ingen betalning, inget pass." En rad i flaggor, samma sort som
     notismejlen. Databasen gör jobbet: skydda_bokningsfalt nekar
     rapporten på ett obetalt pass när flaggan är på. Kortet här visar
     läget och är stället den slås om, bredvid betalningarna den
     hänger på.

     Den står AV tills en provbetalning gått hela vägen. Påslagen utan
     en kortväg som fungerar hade den låst varje studiehjälpare ute
     från att rapportera. Att stänga av den är nödbromsen, och den
     frågar därför inte efter något.

     SEDAN FAS 19.2 GÅR DEN INTE ATT SLÅ PÅ. Villkoren låter familjen
     betala efter passet, när de bekräftar rapporten, och spärren nekar
     just den rapporten. Databasen vägrar (flaggor_kortsparr_av), och
     kortet har därför ingen Slå på-knapp: en knapp som alltid ger ett
     fel är sämre än en mening som säger varför. Stäng av står kvar för
     den dag villkoret tas bort och någon slår på den igen.
     ============================================================ */
  const kortbetalda = () => (S.bokningar || [])
    .filter(b => b.betalning_status === 'betald' || b.betalning_status === 'tvist').length;

  function ritaKortsparr() {
    const host = $('#kort-sparr');
    if (!host) return;
    const f = S.kortsparr;
    if (!f) {
      host.innerHTML = tomt('Spärrens läge gick inte att läsa',
        S.kortsparrFel || 'Raden kortsparr saknas i flaggor. Kör migrationen för Fas 14.2.');
      return;
    }
    const n = kortbetalda();
    host.innerHTML = '<div class="adm-koppling-kort">'
      + '<h6>Ingen betalning, inget pass ' + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', '')) + '</h6>'
      + '<p>' + esc(f.beskrivning || '') + '</p>'
      + (!f.aktiv && f.vantar_pa ? '<div class="adm-krav">' + esc(f.vantar_pa) + '</div>' : '')
      + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">'
      + (n ? n + (n === 1 ? ' pass är betalt' : ' pass är betalda') + ' med kort. '
           : 'Ingen kortbetalning har gått igenom än. ')
      + 'Ändrad ' + esc(kortDatum(f.uppdaterad)) + '</p>'
      + (f.aktiv ? '<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" type="button" data-kortsparr="0">'
          + 'Stäng av</button></div>' : '')
      + '</div>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-kortsparr]');
    if (!knapp) return;
    const på = knapp.dataset.kortsparr === '1';
    const f = S.kortsparr || {};
    if (på) {
      const ja = await bekräfta({
        titel: 'Slå på spärren?',
        text: 'Från och med nu går ett pass som familjen inte betalat inte att rapportera, '
          + 'och studiehjälparen ser i sin vy att passet inte ska hållas. Ett pass familjen valt '
          + 'att betala mot faktura räknas som betalt nog: fakturan kommer efter passet.'
          + (kortbetalda() ? ''
            : '\n\nIngen kortbetalning har gått igenom än. Slår du på nu kan ingen '
              + 'studiehjälpare rapportera ett enda pass förrän en familj har betalat.'),
        /* Som notisflaggorna: förutsättningarna som förhandsvisning,
           inte i brödtexten, så att de går att läsa en i taget. */
        forhandsvisning: f.vantar_pa ? 'Det här skulle vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      });
      if (!ja) return;
    }
    await medan(knapp, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'kortsparr');
      if (error) { alert('Kunde inte ändra spärren: ' + felText(error)); return; }
      /* Läget läses tillbaka i stället för att antas. En uppdatering
         som RLS nekar ger inget fel, bara noll rader — och då ska
         kortet visa att ingenting hände. */
      const { data } = await supa.from('flaggor').select('*').eq('kod', 'kortsparr').maybeSingle();
      if (data) S.kortsparr = data;
      ritaKortsparr();
    });
  });

  /* ============================================================
     ERBJUDANDEN (Fas 16.1)

     Strömbrytaren och köpen. Flaggan står av tills provbetalningen gått
     igenom och stripe-webhook är driftsatt i den version som känner
     igen ett köpt klippkort (vantar_pa säger det). Att stänga av är
     nödbromsen och frågar inte: redan köpta timmar går fortfarande att
     se, men inte att köpa nya eller dra från.

     "Om de slutar i dag" är vad villkoren lovar: de använda timmarna
     räknade till ordinarie pris, resten tillbaka. Beloppet räknas i
     klippkort_saldo; här visas det bara. Återbetalningen görs i Stripes
     dashboard, och webhooken stänger kortet när den kommer.

     INOM ÅNGERFRISTEN gäller ett annat belopp (Fas 16.1e): den som
     ångrar sig betalar en andel av det AVTALADE priset, alltså det
     rabatterade, för det som hunnit användas. Att visa ordinariebeloppet
     de första fjorton dagarna hade varit att be om pengar lagen inte ger
     oss. Vilket av dem som gäller avgörs av dagens datum mot
     angerfrist_till.
     ============================================================ */
  const KK_LAGE = { vantar: 'Obetalt', betald: 'Betalt', misslyckad: 'Misslyckades',
    aterbetald: 'Återbetalt', tvist: 'Tvist' };

  function ritaErbjudandenAdmin() {
    const host = $('#erb-flagga'), lista = $('#erb-kop');
    if (!host || !lista) return;
    const f = S.erbFlagga;
    if (!f) {
      host.innerHTML = tomt('Erbjudandenas läge gick inte att läsa',
        S.kortsparrFel || 'Raden erbjudanden saknas i flaggor. Kör migrationen för Fas 16.1.');
    } else {
      host.innerHTML = '<div class="adm-koppling-kort">'
        + '<h6>Planer och klippkort ' + (f.aktiv ? pill('Går att köpa', 'ar-klar') : pill('Av', '')) + '</h6>'
        + '<p>' + esc(f.beskrivning || '') + '</p>'
        + (!f.aktiv && f.vantar_pa ? '<div class="adm-krav">Ska vara avgjort först: ' + esc(f.vantar_pa) + '</div>' : '')
        + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">Ändrad ' + esc(kortDatum(f.uppdaterad)) + '</p>'
        + '<div style="margin-top:12px"><button class="btn ' + (f.aktiv ? 'btn-ghost' : 'btn-primary')
        + ' btn-sm" type="button" data-erbflagga="' + (f.aktiv ? '0' : '1') + '">'
        + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></div>'
        + '</div>';
    }

    // Ett köp som aldrig betalades är en kassa som stängdes, inte ett köp.
    const kop = (S.klippkort || []).filter(k => k.status !== 'vantar' && k.status !== 'misslyckad');
    $('#erb-kop-antal').textContent = kop.length ? kop.length + ' köp' : '';
    if (S.klippkortFel) { lista.innerHTML = tomt('Köpen gick inte att läsa', S.klippkortFel); return; }
    lista.innerHTML = tabell([
      { namn: 'Köp', rita: k => '<b>' + esc(k.namn) + '</b><span class="adm-und">' + esc(kortDatum(k.betald_at || k.created_at)) + '</span>' },
      { namn: 'Familj', rita: k => esc(namnFör(k.parent_id)) },
      { namn: 'Timmar', rita: k => '<span class="adm-tal">' + esc(String(k.kvar)) + ' av ' + esc(String(k.timmar)) + '</span>'
        + '<span class="adm-und">kvar</span>' },
      { namn: 'Gäller till', rita: k => esc(kortDatum(k.giltigt_till)) },
      { namn: 'Betalt', rita: k => (k.betalt_ore != null ? '<span class="adm-tal">' + esc(kronor(k.betalt_ore)) + '</span>' : '—')
        + (Number(k.aterbetald_ore || 0) > 0 ? '<span class="adm-und">' + esc(kronor(k.aterbetald_ore)) + ' tillbaka</span>' : '') },
      { namn: 'Om de slutar i dag', rita: k => {
        if (k.status !== 'betald') return '';
        const ånger = k.angerfrist_till && String(k.angerfrist_till) >= isoFor(new Date());
        return '<span class="adm-tal">' + esc(kronor((ånger ? k.vid_anger_ore : k.vid_uppsagning_ore) || 0)) + '</span>'
          + '<span class="adm-und">' + (ånger ? 'tillbaka · ångerrätt t.o.m. ' + esc(kortDatum(k.angerfrist_till)) : 'tillbaka') + '</span>';
      } },
      { namn: 'Läge', höger: true, rita: k => '<span class="adm-tal">' + esc(KK_LAGE[k.status] || k.status) + '</span>' }
    ], kop, 'Inga köpta planer eller klippkort än');
    ritaTimbanken();
  }

  /* ============================================================
     TIMBANKEN (Fas 22.1)

     Minuter som blev över när ett pass betalt med timmar slutade före
     en hel timme. De tar övertiden på nästa pass av sig själva, och kan
     betala ett helt pass. Här står bara familjer som har minuter kvar:
     det är betalda timmar som inte hållits, en skuld till familjen och
     inte en intäkt.

     Slutar familjen betalas värdet tillbaka tillsammans med resten av
     klippkortet, i Stripes dashboard, och banken markeras sedan här.
     Knappen flyttar inga pengar. Värdet räknas i databasen
     (timbank_saldo): ordinarie timpris, som klippkortets använda timmar.
     ============================================================ */
  function ritaTimbanken() {
    const host = $('#erb-bank');
    if (!host) return;
    if (S.timbankFel) { host.innerHTML = tomt('Timbanken gick inte att läsa', S.timbankFel); return; }
    const rader = (S.timbank || []).slice().sort((a, c) => Number(c.saldo_min) - Number(a.saldo_min));
    const tid = m => (Math.floor(m / 60) ? Math.floor(m / 60) + ' h ' : '') + (m % 60 ? (m % 60) + ' min' : '');
    host.innerHTML = '<h6 style="margin:0 0 8px">Timbanken</h6>' + tabell([
      { namn: 'Familj', rita: r => esc(namnFör(r.parent_id)) },
      { namn: 'Minuter', rita: r => '<span class="adm-tal">' + esc(tid(Number(r.saldo_min)).trim()) + '</span>' },
      { namn: 'Om de slutar i dag', rita: r => r.varde_ore != null
        ? '<span class="adm-tal">' + esc(kronor(r.varde_ore)) + '</span><span class="adm-und">tillbaka</span>' : '—' },
      { namn: '', höger: true, rita: r => '<button class="btn btn-ghost btn-sm" type="button" data-timbank-ut="'
        + esc(r.parent_id) + '">Markera utbetald</button>' }
    ], rader, 'Ingen familj har minuter i timbanken');
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-timbank-ut]');
    if (!knapp) return;
    const id = knapp.dataset.timbankUt;
    const rad = (S.timbank || []).find(r => r.parent_id === id);
    const ja = await bekräfta({
      titel: 'Markera timbanken som utbetald?',
      text: 'Gör det först när pengarna är tillbaka hos ' + namnFör(id) + ' (Stripes dashboard, tillsammans med klippkortet). '
        + 'Minuterna försvinner ur banken, och raden går inte att ångra.'
        + (rad && rad.varde_ore != null ? ' Värdet i dag: ' + kronor(rad.varde_ore) + '.' : ''),
      knapp: 'Markera utbetald'
    });
    if (!ja) return;
    await medan(knapp, 'Sparar…', async () => {
      const { data, error } = await supa.rpc('timbank_utbetald', { p_foralder: id });
      if (error) { alert('Kunde inte markera timbanken: ' + felText(error)); return; }
      if (data && data.fel) { alert(data.fel); }
      const { data: nu, error: fel } = await supa.from('timbank_saldo')
        .select('parent_id, saldo_min, varde_ore').gt('saldo_min', 0);
      if (!fel) S.timbank = nu || [];
      ritaTimbanken();
    });
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-erbflagga]');
    if (!knapp) return;
    const på = knapp.dataset.erbflagga === '1';
    const f = S.erbFlagga || {};
    if (på) {
      const ja = await bekräfta({
        titel: 'Öppna erbjudandena?',
        text: 'Från och med nu kan familjerna köpa planer och klippkort i studievyn, och betala bekräftade pass med sina timmar. '
          + 'Köpet går genom Stripe och blir betalt först när webhooken tagit emot det.',
        forhandsvisning: f.vantar_pa ? 'Det här skulle vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      });
      if (!ja) return;
    }
    await medan(knapp, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'erbjudanden');
      if (error) { alert('Kunde inte ändra erbjudandena: ' + felText(error)); return; }
      // Läses tillbaka, som spärren: en nekad uppdatering ger noll rader, inget fel.
      const { data } = await supa.from('flaggor').select('*').eq('kod', 'erbjudanden').maybeSingle();
      if (data) S.erbFlagga = data;
      ritaErbjudandenAdmin();
    });
  });

  /* ============================================================
     STRIPE-LÄGET (Fas 14.3)

     Punkt 10 och 11 på säljarens MVP-lista. Om nyckeln var satt, om
     webhooken lyssnade på rätt händelser och vilken version den stod
     på gick förut inte att veta utan att logga in hos Stripe och leta.
     stripe-lage frågar med servernyckeln och svarar med en lista;
     reglerna för vad som är grönt bor i granskaStripe() i
     _delad/stripe.ts, med egna prov.

     Körs bara på knapptryck. Två anrop mot Stripe vid varje omritning
     av Ekonomi hade varit två anrop för en fråga ingen ställt.
     ============================================================ */
  const PUNKT_MÄRKE = {
    true: ['Klart', 'ar-klar'], false: ['Åtgärda', 'ar-ny'], null: ['Bra att veta', 'ar-vantar']
  };

  function ritaStripeLage(d) {
    const host = $('#stripe-lage');
    if (!host) return;
    const punkter = d.punkter || [];
    const röda = punkter.filter(p => p.ok === false).length;
    const klockan = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    host.innerHTML = '<p class="small" style="margin:0 0 10px">'
      + (röda ? '<b>' + röda + (röda === 1 ? ' sak' : ' saker') + ' att åtgärda.</b>' : 'Inget att åtgärda.')
      + ' Kontrollerat ' + esc(klockan) + '.</p>'
      + tabell([
        { namn: 'Vad', rita: p => '<b>' + esc(p.rubrik) + '</b>' },
        { namn: 'Läge', rita: p => { const m = PUNKT_MÄRKE[String(p.ok)] || PUNKT_MÄRKE.null; return pill(m[0], m[1]); } },
        { namn: 'Vad det betyder', rita: p => '<span class="adm-und" style="white-space:normal">' + esc(p.text) + '</span>' }
      ], punkter, 'Stripe svarade inte');
  }

  /* ============================================================
     AVGIFTERNA I EFTERHAND (Fas 14.7)

     Stripe skapar balanstransaktionen en stund efter betalningen, och
     de två första betalningarna fick ingen avgift. Webhooken tar nu
     emot charge.updated och skriver in den när den kommer. Den här
     knappen hämtar den för betalningar som kom in innan, eller där
     händelsen inte kom fram: stripe-avstamning frågar Stripe om varje
     charge och skriver avgiften, nettot och om betalningen var skarp.
     ============================================================ */
  const saknarAvstamning = () => (S.bokningar || [])
    .filter(b => b.stripe_charge_id && (b.stripe_avgift_ore == null || b.stripe_skarp == null));

  function ritaAvstamning() {
    const host = $('#stripe-avstamning');
    if (!host) return;
    const n = saknarAvstamning().length;
    host.innerHTML = n
      ? '<p class="xsmall" style="color:var(--bl-3);margin:12px 0 8px">' + n
        + (n === 1 ? ' betalning saknar' : ' betalningar saknar') + ' Stripes avgift eller läge (skarp eller test).</p>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-avstamning>Hämta från Stripe</button>'
      : '';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-avstamning]');
    if (!knapp) return;
    await medan(knapp, 'Frågar Stripe…', async () => {
      const svar = await supa.functions.invoke('stripe-avstamning', { body: {} });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      const d = svar.data || {};
      const delar = [];
      if (d.avgifter) delar.push(d.avgifter + (d.avgifter === 1 ? ' avgift hämtad' : ' avgifter hämtade'));
      if (d.markta) delar.push(d.markta + ' märkta som skarpa eller test');
      if (d.vantar) delar.push(d.vantar + ' där Stripe inte har avgiften än');
      if (d.fler) delar.push('fler finns, tryck igen');
      (d.fel || []).forEach(f => delar.push('fel: ' + f));
      alert(delar.length ? delar.join('\n') : 'Inget att hämta.');
      await hämtaAllt();
      ritaKortbetalningar();
      await laddaBokslut();       // avgiften och nettot står i bokslutet
    });
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-stripe-lage]');
    if (!knapp) return;
    await medan(knapp, 'Frågar Stripe…', async () => {
      const svar = await supa.functions.invoke('stripe-lage', { body: {} });
      if (svar.error) {
        $('#stripe-lage').innerHTML = tomt('Kontrollen gick inte att köra', await funktionsFel(svar.error));
        return;
      }
      ritaStripeLage(svar.data || {});
    });
  });

  /* ============================================================
     KORTTVISTER (Fas 14.3)

     Punkt 9. En familj som bestrider en betalning hos sin bank får
     pengarna tillbaka om vi inte svarar i tid. Webhooken sparar sista
     dagen, orsaken och utfallet i stripe_tvister och lägger en uppgift
     med dagen som förfallodag. Här står de, öppna först, med det vi
     själva vet om passet — det är det underlaget banken vill ha.

     Samma orsakstexter som TVIST_ORSAK i _delad/stripe.ts: uppgiftens
     beskrivning och den här tabellen ska säga samma sak.
     ============================================================ */
  const TVIST_ORSAK = {
    fraudulent: 'Kortinnehavaren säger att betalningen inte är hens',
    unrecognized: 'Kortinnehavaren känner inte igen betalningen',
    product_not_received: 'Kortinnehavaren säger att passet inte blev av',
    product_unacceptable: 'Kortinnehavaren är missnöjd med passet',
    duplicate: 'Kortinnehavaren säger att samma pass betalats två gånger',
    credit_not_processed: 'Kortinnehavaren säger att pengarna skulle ha kommit tillbaka',
    subscription_canceled: 'Kortinnehavaren säger att tjänsten var uppsagd',
    customer_initiated: 'Kortinnehavaren har bestridit betalningen',
    debit_not_authorized: 'Kortinnehavaren säger att dragningen inte var godkänd',
    general: 'Ingen särskild orsak angiven'
  };
  const TVIST_LAGE = {
    needs_response: ['Väntar på vårt svar', 'ar-ny'],
    warning_needs_response: ['Förfrågan, väntar på vårt svar', 'ar-ny'],
    under_review: ['Hos banken', 'ar-vantar'],
    warning_under_review: ['Förfrågan hos banken', 'ar-vantar'],
    won: ['Vunnen', 'ar-klar'],
    warning_closed: ['Stängd utan återkrav', 'ar-klar'],
    lost: ['Förlorad', '']
  };
  const väntarPåOss = x => !x.stangd && (x.lage === 'needs_response' || x.lage === 'warning_needs_response');
  const NÄRVARO = { narvarande: 'närvarande', sen: 'kom sent', franvarande: 'uteblev' };

  async function ritaTvister() {
    const host = $('#tvist-lista');
    if (!host) return;
    if (S.tvisterFel) { host.innerHTML = tomt('Tvisterna gick inte att läsa', S.tvisterFel); return; }
    /* Fas 20.2: passets månad, som resten av Ekonomi. En tvist har en
       sista dag att svara som inte väntar på att rätt månad väljs, så
       de ÖPPNA i andra månader räknas upp ovanför tabellen. */
    const bok = id => (S.bokningar || []).find(b => b.id === id);
    const tvistDag = x => { const b = bok(x.booking_id); return b ? b.wanted_date : x.skapad; };
    const alla = (S.tvister || []).filter(x => iMånaden(tvistDag(x)));
    const andra = andraMånaderText(andraMånader((S.tvister || []).filter(x => !x.stangd), tvistDag), 'Öppna tvister');
    const öppna = alla.filter(x => !x.stangd).length;
    $('#tvist-antal').textContent = öppna ? öppna + (öppna === 1 ? ' öppen' : ' öppna') : '';
    if (!alla.length) {
      host.innerHTML = andra + tomt('Inga korttvister i ' + månadText(),
        'Bestrider en familj en betalning hos sin bank står det här, med sista dagen att svara.');
      return;
    }

    /* Rapporten är det starkaste underlaget för att passet hölls, och
       den står inte i S. Hämtas bara när det finns tvister. */
    const ids = alla.map(x => x.booking_id).filter(Boolean);
    const rapport = {};
    if (ids.length) {
      const { data } = await supa.from('lesson_reports').select('booking_id, created_at').in('booking_id', ids);
      (data || []).forEach(r => { rapport[r.booking_id] = r; });
    }

    const nyckel = x => (x.stangd ? '1' : '0') + (väntarPåOss(x) ? String(x.svara_senast || '9') : '9') + String(x.skapad || '');
    const rader = alla.slice().sort((a, b) => nyckel(a).localeCompare(nyckel(b)));

    host.innerHTML = andra + tabell([
      { namn: 'Pass', rita: x => {
        const b = bok(x.booking_id);
        return b ? passLänk(b) + '<span class="adm-und">'
            + esc(b.subject || 'Pass') + ' · ' + esc(namnFör(b.parent_id)) + '</span>'
          : '<span class="adm-und">Passet hittades inte</span>';
      } },
      { namn: 'Belopp', rita: x => '<span class="adm-tal">' + (x.belopp_ore != null ? esc(kronor(x.belopp_ore)) : '—') + '</span>' },
      { namn: 'Orsak', rita: x => '<span class="adm-und" style="white-space:normal">'
        + esc(x.orsak ? (TVIST_ORSAK[x.orsak] || 'Annan orsak (' + x.orsak + ')') : 'Ingen orsak angiven') + '</span>' },
      { namn: 'Svara senast', rita: x => {
        if (!väntarPåOss(x) || !x.svara_senast) return '<span class="adm-und">—</span>';
        /* Hela dagar mellan datumen, inte timmar genom 24: "sex dagar
           kvar" ska betyda sex kalenderdagar, också på eftermiddagen.
           Fristens datum är UTC-datumet, samma som i uppgiften, och
           aldrig senare än den verkliga fristen. */
        const kvar = Math.round((Date.parse(String(x.svara_senast).slice(0, 10))
          - Date.parse(isoFor(new Date()))) / 86400000);
        return '<b>' + esc(kortDatum(x.svara_senast)) + '</b><span class="adm-und">'
          + (kvar < 0 ? 'Fristen har gått ut' : kvar === 0 ? 'I dag' : kvar === 1 ? '1 dag kvar' : kvar + ' dagar kvar')
          + '</span>';
      } },
      { namn: 'Underlaget vi har', rita: x => {
        const b = bok(x.booking_id);
        if (!b) return '<span class="adm-und">—</span>';
        const r = rapport[b.id];
        const delar = [
          'Bokat ' + kortDatum(b.created_at),
          b.status === 'confirmed' || b.status === 'completed' ? 'bekräftat' : 'inte bekräftat',
          b.attendance ? 'eleven ' + (NÄRVARO[b.attendance] || b.attendance) : 'ingen närvaro',
          r ? 'rapport skriven ' + kortDatum(r.created_at) : 'ingen rapport',
          b.betald_at ? 'betalt ' + kortDatum(b.betald_at) : null
        ].filter(Boolean);
        return '<span class="adm-und" style="white-space:normal">' + esc(delar.join(', ')) + '</span>';
      } },
      { namn: '', höger: true, rita: x => '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="https://dashboard.stripe.com/'
        + (x.skarp ? '' : 'test/') + 'disputes/' + encodeURIComponent(x.id) + '">Öppna i Stripe</a>' },
      { namn: 'Läge', höger: true, rita: x => { const l = TVIST_LAGE[x.lage] || [x.lage, '']; return pill(l[0], l[1]); } }
    ], rader, 'Inga korttvister');
  }

  /* Återbetalningen går genom edge-funktionen, aldrig direkt mot
     tabellen: bara servern har Stripe-nyckeln, och taket för hur
     mycket som får gå tillbaka räknas ur raden, inte ur det som
     skrivs i rutan. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-aterbetala]');
    if (!knapp) return;
    const b = (S.bokningar || []).find(x => x.id === knapp.dataset.aterbetala);
    if (!b) return;

    const betalt = Number(b.betalt_ore || 0);
    const kvar = betalt - Number(b.aterbetald_ore || 0);
    /* Fas 20.1: passet blev kortare än det familjen betalat för. Larmet
       har räknat skillnaden till passets frysta pris, och den föreslås i
       stället för hela beloppet. Rutan går fortfarande att ändra. */
    const förLänge = (S.avvikelser || []).find(a => a.typ === 'betalt_for_lange'
      && a.objekt_tabell === 'bookings' && a.objekt_id === b.id && a.belopp_ore > 0);
    const förval = förLänge ? Math.min(Number(förLänge.belopp_ore), kvar) : kvar;
    const förvalKr = Number.isInteger(förval / 100) ? String(förval / 100) : (förval / 100).toFixed(2);
    const valt = await fråga({
      titel: 'Återbetala passet?',
      /* Texten sa förut att studiehjälparens del dras tillbaka från
         hens Stripe-konto. Det var sant när betalningen var en
         destination charge och slutade vara det när Connect togs bort
         (Fas 12.5). En dialog som beskriver en pengaväg som inte finns
         är värre än ingen dialog. */
      text: kortDatum(b.wanted_date) + ' · ' + namnFör(b.parent_id) + '. '
        + 'Familjen får pengarna tillbaka på kortet. Stripes avgift för betalningen kommer '
        + 'inte tillbaka. Studiehjälparens ersättning påverkas inte: den räknas ur rapporten, '
        + 'inte ur betalningen.',
      innehåll: '<div class="fgroup" style="margin:14px 0 0">'
        + '<label for="ater-belopp">Belopp i kronor</label>'
        + '<input class="inp" id="ater-belopp" type="number" min="1" step="0.01" inputmode="decimal" value="'
        + esc(förvalKr) + '">'
        + '<p class="xsmall" style="color:var(--bl-3);margin:8px 0 0">'
        + (förLänge ? 'Passet blev kortare än det som betalades: ' + esc(kronor(förLänge.belopp_ore))
            + ' ska tillbaka. ' : '')
        + 'Högst ' + esc(kronor(kvar)) + '. Lägre belopp ger en delåterbetalning.</p></div>'
        + '<div class="fgroup" style="margin:14px 0 0">'
        + '<label for="ater-anledning">Anledning, för vår egen skull</label>'
        + '<input class="inp" id="ater-anledning" placeholder="t.ex. studiehjälparen uteblev"></div>',
      knapp: 'Återbetala',
      läs: ruta => {
        const kr = Number((ruta.querySelector('#ater-belopp') || {}).value);
        if (!kr || kr < 1) return { fel: 'Fyll i ett belopp.' };
        if (Math.round(kr * 100) > kvar) return { fel: 'Beloppet är högre än vad som är kvar att återbetala.' };
        return { värde: {
          belopp_ore: Math.round(kr * 100),
          anledning: ((ruta.querySelector('#ater-anledning') || {}).value || '').trim()
        } };
      }
    });
    if (!valt) return;

    await medan(knapp, 'Återbetalar…', async () => {
      const svar = await supa.functions.invoke('stripe-aterbetalning', {
        body: { pass: b.id, belopp_ore: valt.belopp_ore, anledning: valt.anledning }
      });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      /* Varningen betyder att pengarna ÄR tillbaka men att raden inte
         hann skrivas. Den får inte sväljas: tabellen visar då fel
         tills webhooken kommer ikapp. */
      if (svar.data && svar.data.varning) alert(svar.data.varning);
      await hämtaAllt();
      ritaKortbetalningar();
      /* Larmet betalt_for_lange och bokslutets återbetalda belopp
         räknas i databasen och måste hämtas om, inte ritas om. */
      await laddaOmEkonomi();
    });
  });

  /* ============================================================
     AVVIKELSER (Fas 2)

     Ett genomfört pass utan rapport kommer aldrig med i
     månadskörningen. Rapporten är det som visar att passet hölls,
     och det är den som motiverar raden på studiehjälparens underlag.
     Här tar någon ställning, ett pass i taget: koppla rätt rapport,
     eller undanta passet.
     ============================================================ */
  function utanRapport() {
    return (S.passunderlag || []).filter(p =>
      p.fakturerbar && !p.har_rapport && !p.fakturerad && !p.pa_underlag);
  }

  const dagnummer = iso => Math.round(Date.parse(String(iso || '').slice(0, 10)) / DAG) || 0;

  /* Rapporter som kan höra till passet: samma studiehjälpare, samma
     elev, inte kopplade till något annat. Närmast i tid först — en
     rapport skriven dagen efter är troligare än en från förra månaden. */
  function kandidater(p) {
    return (S.fristaendeRapporter || [])
      .filter(r => r.tutor_id === p.tutor_id && (!p.student_id || r.student_id === p.student_id))
      .sort((a, b) => Math.abs(dagnummer(a.lesson_date) - dagnummer(p.wanted_date))
        - Math.abs(dagnummer(b.lesson_date) - dagnummer(p.wanted_date)));
  }

  function ritaAvvikelser() {
    const host = $('#avv-utan-rapport');
    if (!host) return;

    /* Fas 20.2: listorna gäller den valda månaden, och det som hör till
       andra räknas upp överst. utanRapport() står kvar ofiltrerad, för
       översikten räknar hela systemet med den. */
    const andra = $('#avv-andra');
    if (andra) {
      const utanför = [].concat(
        S.passunderlagFel ? [] : utanRapport().map(p => p.wanted_date),
        (S.fristaendeRapporter || []).map(r => r.lesson_date),
        övrigaRader().map(a => a.datum));
      andra.innerHTML = andraMånaderText(andraMånader(utanför, x => x), 'Avvikelser');
    }

    if (S.passunderlagFel) {
      host.innerHTML = tomt('Passunderlaget gick inte att läsa', S.passunderlagFel);
      $('#avv-fristaende').innerHTML = '';
      $('#avv-undantagna').innerHTML = '';
      ritaÖvrigaAvvikelser();
      return;
    }

    const saknar = utanRapport().filter(p => iMånaden(p.wanted_date));
    host.innerHTML = tabell([
      { namn: 'Pass', rita: p => passLänk(p)
        + '<span class="adm-und">' + esc(p.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: p => esc(namnFör(p.parent_id)) },
      { namn: 'Elev', rita: p => esc(elevNamn(p.student_id)) },
      { namn: 'Studiehjälpare', rita: p => esc(namnFör(p.tutor_id)) },
      { namn: 'Rapporter att välja', rita: p => {
        const n = kandidater(p).length;
        return n ? pill(n + ' fristående', 'ar-vantar')
          : '<span class="xsmall" style="color:var(--bl-3)">Ingen</span>';
      } },
      { namn: '', höger: true, rita: p =>
        (kandidater(p).length
          ? '<button class="btn btn-primary btn-sm" type="button" data-avv-koppla="' + p.id + '">Koppla rapport</button> '
          : '')
        + '<button class="btn btn-ghost btn-sm" type="button" data-avv-undanta="' + p.id + '">Undanta</button>' }
    ], saknar, 'Alla genomförda pass i ' + månadText() + ' har en rapport');

    $('#avv-fristaende').innerHTML = tabell([
      { namn: 'Datum', rita: r => '<b>' + esc(kortDatum(r.lesson_date)) + '</b>' },
      { namn: 'Studiehjälpare', rita: r => esc(namnFör(r.tutor_id)) },
      { namn: 'Elev', rita: r => esc(elevNamn(r.student_id)) },
      { namn: 'Anteckning', rita: r => '<span class="xsmall">'
        + esc(String(r.raw_notes || '').slice(0, 90)) + '</span>' }
    ], (S.fristaendeRapporter || []).filter(r => iMånaden(r.lesson_date)),
      'Inga fristående rapporter i ' + månadText());

    const undantagna = (S.passunderlag || []).filter(p => !p.fakturerbar && iMånaden(p.wanted_date));
    $('#avv-undantagna').innerHTML = tabell([
      { namn: 'Pass', rita: p => passLänk(p)
        + '<span class="adm-und">' + esc(p.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: p => esc(namnFör(p.parent_id)) },
      { namn: 'Studiehjälpare', rita: p => esc(namnFör(p.tutor_id)) },
      { namn: 'Anledning', rita: p => esc(p.fakturerbar_anledning || '—') },
      { namn: '', höger: true, rita: p =>
        '<button class="btn btn-ghost btn-sm" type="button" data-avv-ateruppta="' + p.id + '">Ångra</button>' }
    ], undantagna, 'Inga undantagna pass i ' + månadText());

    const övriga = ritaÖvrigaAvvikelser();
    märkFlik('#flik-avv-mark', saknar.length + övriga);
  }

  /* ============================================================
     ÖVRIGA EKONOMISKA AVVIKELSER (Fas 6)

     Räknade i databasen av ekonomiska_avvikelser(), med samma regler
     som månadskörningen. Pass utan rapport och fristående rapporter
     har egna listor ovanför och visas inte igen här. Varje rad kan
     bli en uppgift; en rad som redan har en öppen uppgift säger det.
     ============================================================ */
  const AVV_TEXT = {
    /* Har egna listor under Avvikelser, men står i bokslutets larm
       (manad_lage läser hela avvikelser_rader) och behöver ord där. */
    pass_utan_rapport: ['Pass utan rapport', 'Genomfört men utan rapport, så det kommer inte med på underlaget. Koppla rapporten eller undanta passet under Avvikelser.'],
    fristaende_rapport: ['Rapport utan pass', 'En rapport som inte hör till något pass. Koppla den till sitt pass under Avvikelser.'],
    ej_betalt: ['Inte betalt', 'Hölls och rapporterades, men familjen har inte betalat. Betala-knappen ligger kvar på passet i familjens vy.'],
    /* Fas 20.1. Passet var betalt och drog över. Familjen betalar
       tillägget med kort när de bekräftar rapporten; beloppet räknas i
       stripe-checkout och står därför inte i larmet. */
    tillagg_obetalt: ['Tillägget för övertid är inte betalt', 'Passet var betalt och drog över. Familjen betalar tillägget när de bekräftar rapporten.'],
    /* Fas 20.1. Betalt med kort för mer tid än passet höll. Beloppet är
       det som ska tillbaka, räknat till passets frysta pris; rubriken
       bär det (avvText). */
    betalt_for_lange: ['Betalt för längre tid än passet höll', 'Passet blev kortare än det familjen betalade för. Återbetala skillnaden under Kortbetalningar.'],
    /* Fas 14.6. */
    faktura_saknas: ['Fakturapass utan faktura', 'Familjen valde faktura, månaden är slut och passet står inte på någon faktura. Kör månadskörningen.'],
    betald_och_fakturerad: ['Betalt två gånger', 'Betalt med kort och dessutom på en faktura. Kreditera raden i Fortnox.'],
    /* Fas 14.2c. Betalsidan kan ligga öppen medan passet avbokas, och
       betalas den efteråt drar Stripe pengarna ändå. Beloppet är det
       som inte gått tillbaka än. */
    betald_men_avbokad: ['Betalt men avbokat', 'Familjen har betalat ett pass som är avbokat. Villkoren lovar hela beloppet tillbaka: återbetala under Kortbetalningar.'],
    ej_utbetalt: ['Inte utbetalt', 'Klart för underlag, men månaden det hölls är slut.'],
    faktura_forfallen: ['Förfallen faktura', 'Skickad, obetald och efter förfallodagen.'],
    faktura_gammalt_utkast: ['Faktura inte inlagd i Fortnox', 'Utkastet skapades för mer än en vecka sedan. Lägg in det i Fortnox under Fakturor.'],
    utbetalning_vantar: ['Utbetalning som väntar', 'Utkast eller godkänd, för en månad före förra.'],
    utbetalning_misslyckad: ['Misslyckad utbetalning', 'Pengarna gick inte iväg.'],
    timpenning_saknas: ['Ingen ersättning att räkna med', 'Studiehjälparen saknar timpenning och tjänsten saknar ersättning.'],
    pass_utan_studiehjalpare: ['Pass utan studiehjälpare', 'Genomfört, men ingen att betala ut till.'],
    rut_utan_skatteuppgifter: ['RUT utan skatteuppgifter', 'Kunden saknar personnummer, så passet faktureras utan avdrag.'],
    rut_utan_tak: ['RUT-tak saknas', 'Inget tak för året under System → Inställningar, så ingen RUT dras.'],
    rut_over_tak: ['Över RUT-taket', 'Kunden har fått mer avdrag i år än taket.'],
    faktura_summa_fel: ['Fakturans summa stämmer inte', 'Beloppet skiljer sig från summan av raderna.'],
    utbetalning_summa_fel: ['Utbetalningens summa stämmer inte', 'Beloppet skiljer sig från summan av raderna.'],
    fakturerat_ogiltigt_pass: ['Fakturerat pass som inte gäller', 'Passet är inte längre genomfört eller fakturerbart.']
  };
  /* Tabellerna en uppgift får kopplas till (check-villkoret i uppgifter). */
  const UPPG_TABELLER = ['bookings', 'invoices', 'payouts', 'lesson_reports', 'profiles'];
  /* Uppgiftens nyckel: vilken avvikelse, på vad. Databasen tillåter en
     öppen uppgift per nyckel, så samma problem blir aldrig två — och
     två olika problem på samma pass blir två (Fas 6, nyckel). */
  const avvNyckel = a => 'avvikelse:' + a.typ + ':' + a.objekt_tabell + ':' + a.objekt_id;

  /* Rubrik och förklaring för en avvikelse, på ett ställe: tabellen här,
     bokslutets larm, uppgiften som skapas och passets detalj läser alla
     härifrån. En okänd typ visas med sin kod hellre än inte alls. */
  function avvText(a) {
    const t = AVV_TEXT[a.typ] || [a.typ, ''];
    if (a.typ === 'betalt_for_lange' && a.belopp_ore != null) {
      return ['Betalt för längre tid än passet höll: betala tillbaka ' + kronor(a.belopp_ore), t[1]];
    }
    return t;
  }

  const övrigaRader = () => (S.avvikelser || [])
    .filter(a => a.typ !== 'pass_utan_rapport' && a.typ !== 'fristaende_rapport');

  function ritaÖvrigaAvvikelser() {
    const host = $('#avv-ovriga');
    if (!host) return 0;
    if (S.avvikelserFel) {
      host.innerHTML = tomt('Kunde inte räkna avvikelserna', S.avvikelserFel);
      return 0;
    }
    /* Fas 20.2: den valda månaden. En avvikelse utan datum (RUT-tak som
       saknas) hör inte till någon månad och står därför i alla. */
    const rader = övrigaRader().filter(a => !a.datum || iMånaden(a.datum));
    $('#avv-ovriga-antal').textContent = rader.length ? rader.length + ' st' : '';
    const öppna = new Set((S.uppgifter || [])
      .filter(u => u.nyckel && (u.status === 'oppen' || u.status === 'pagar'))
      .map(u => u.nyckel));

    host.innerHTML = tabell([
      { namn: 'Vad', rita: a => '<b>' + esc(avvText(a)[0]) + '</b>'
        + '<span class="adm-und">' + esc(avvText(a)[1]) + '</span>' },
      { namn: 'Gäller', rita: a => esc([a.kund_id ? namnFör(a.kund_id) : null,
                                         a.studiehjalpare_id ? namnFör(a.studiehjalpare_id) : null]
        .filter(Boolean).join(' · ') || '—') },
      { namn: 'Datum', rita: a => a.objekt_tabell === 'bookings' && bokning(a.objekt_id)
        ? passLänk(bokning(a.objekt_id), a.datum ? kortDatum(a.datum) : null)
        : '<span class="adm-tal">' + esc(a.datum ? kortDatum(a.datum) : '—') + '</span>' },
      { namn: 'Belopp', rita: a => a.belopp_ore == null ? '<span class="adm-und">—</span>'
        : '<span class="adm-tal">' + esc(kronor(a.belopp_ore)) + '</span>' },
      { namn: '', höger: true, rita: a => öppna.has(avvNyckel(a))
        ? pill('Uppgift finns', 'ar-vantar')
        : '<button class="btn btn-ghost btn-sm" type="button" data-avv-uppgift="'
          + esc(a.typ + '|' + a.objekt_tabell + '|' + a.objekt_id) + '">Gör till uppgift</button>' }
    ], rader, 'Inget annat som inte går ihop i ' + månadText());
    return rader.length;
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-avv-uppgift]');
    if (!knapp) return;
    const [typ, tabellNamn, id] = knapp.dataset.avvUppgift.split('|');
    const a = (S.avvikelser || []).find(x => x.typ === typ && x.objekt_tabell === tabellNamn && x.objekt_id === id);
    if (!a) return;
    const kopplad = UPPG_TABELLER.indexOf(tabellNamn) !== -1;
    const vem = [a.kund_id ? namnFör(a.kund_id) : null, a.studiehjalpare_id ? namnFör(a.studiehjalpare_id) : null]
      .filter(Boolean).join(' · ');
    await medan(knapp, 'Skapar…', async () => {
      const rad = await skapaUppgift({
        titel: (avvText(a)[0] + (vem ? ' — ' + vem : '') + (a.datum ? ', ' + kortDatum(a.datum) : '')).slice(0, 200),
        typ: 'problem',
        beskrivning: avvText(a)[1] || null,
        kopplad_tabell: kopplad ? tabellNamn : null,
        kopplad_id: kopplad ? id : null,
        nyckel: avvNyckel(a)
      });
      if (rad) ritaAvvikelser();
    });
  });

  /* Månadens ekonomi och Löner (2026-09-28) räknar på samma rader som
     listorna här: en faktura som läggs in i Fortnox eller ett underlag
     som godkänns ska synas där också. De bor i egna filer som laddas
     efter den här, och nås därför genom rita. */
  function ritaMånadsvyerna() {
    ['ritaMånaden', 'ritaLöner'].forEach(n => {
      if (typeof NXAdmin.rita[n] === 'function') NXAdmin.rita[n]();
    });
  }

  /* Bokslutet med: dess larm är samma avvikelser, och ett larm som
     lösts här ska inte stå kvar som ett hinder för att stänga månaden. */
  async function laddaOmEkonomi() {
    await hämtaEkonomiunderlag();
    ritaAvvikelser();
    ritaMånadsvyerna();
    await Promise.all([ritaÖversikt(), laddaBokslut()]);
  }

  document.addEventListener('click', async e => {
    const koppla = e.target.closest('[data-avv-koppla]');
    const undanta = e.target.closest('[data-avv-undanta]');
    const återta = e.target.closest('[data-avv-ateruppta]');
    if (!koppla && !undanta && !återta) return;

    const id = (koppla || undanta || återta).dataset.avvKoppla
      || (koppla || undanta || återta).dataset.avvUndanta
      || (koppla || undanta || återta).dataset.avvAteruppta;
    const p = (S.passunderlag || []).find(x => x.id === id);
    if (!p) return;
    const vad = kortDatum(p.wanted_date) + ' · ' + namnFör(p.parent_id) + ' · ' + namnFör(p.tutor_id);

    if (koppla) {
      const lista = kandidater(p);
      /* Sedan Fas 3.7 måste en rapport som hör till ett pass ha närvaro
         (rapport_med_pass_har_narvaro). En fristående rapport har
         ingen, så den sätts här — förvald efter passets egen närvaro
         när den finns. Utan valet nekade databasen varje koppling. */
      const passNärvaro = ((S.bokningar || []).find(b => b.id === p.id) || {}).attendance || 'narvarande';
      const NÄRVARO = [['narvarande', 'Närvarade'], ['sen', 'Kom sent'], ['franvarande', 'Uteblev']];
      const valt = await fråga({
        titel: 'Vilken rapport hör till passet?',
        text: vad + '. Rapporten kopplas till passet, och passet kommer med på nästa körning.',
        innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="avv-narvaro">Närvaro på passet</label>'
          + '<select class="sel" id="avv-narvaro">' + NÄRVARO.map(([v, t]) =>
            '<option value="' + v + '"' + (v === passNärvaro ? ' selected' : '') + '>' + esc(t) + '</option>').join('')
          + '</select></div>'
          + '<div style="margin:14px 0 4px">' + lista.map((r, i) =>
          '<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)">'
          + '<input type="radio" name="avv-rapport" value="' + r.id + '"' + (i === 0 ? ' checked' : '') + '>'
          + '<span><b>' + esc(kortDatum(r.lesson_date)) + '</b> · ' + esc(elevNamn(r.student_id))
          + '<br><span class="xsmall" style="color:var(--bl-3)">'
          + esc(String(r.raw_notes || '').slice(0, 140)) + '</span></span></label>').join('') + '</div>',
        knapp: 'Koppla',
        läs: ruta => {
          const v = ruta.querySelector('input[name="avv-rapport"]:checked');
          const n = ruta.querySelector('#avv-narvaro');
          return v ? { värde: { rapport: v.value, narvaro: n ? n.value : passNärvaro } } : { fel: 'Välj en rapport.' };
        }
      });
      if (!valt) return;
      await medan(koppla, 'Kopplar…', async () => {
        /* is('booking_id', null): hann någon annan koppla rapporten
           under tiden ska den inte flyttas härifrån. */
        const { data, error } = await supa.from('lesson_reports')
          .update({ booking_id: p.id, narvaro: valt.narvaro })
          .eq('id', valt.rapport).is('booking_id', null).select('id');
        if (error) { alert('Kunde inte koppla: ' + felText(error)); return; }
        if (!data || !data.length) alert('Rapporten hann kopplas till något annat. Listan laddas om.');
        /* Samma närvaro på passet. Rapportens trigger gör det bara när
           en rapport skapas, och det här passet är redan genomfört. */
        else await supa.from('bookings').update({ attendance: valt.narvaro }).eq('id', p.id);
        await laddaOmEkonomi();
      });
      return;
    }

    if (undanta) {
      const anledning = await fråga({
        titel: 'Undanta passet?',
        text: vad + '. Passet räknas inte: familjen ska inte betala det, och det kommer inte med '
          + 'på studiehjälparens underlag. Är det redan betalt återbetalar du det under Kortbetalningar.',
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="avv-anledning">Varför?</label>'
          + '<textarea class="inp" id="avv-anledning" rows="3" maxlength="300" '
          + 'placeholder="Till exempel: testpass, inte ett riktigt pass"></textarea></div>',
        knapp: 'Undanta',
        läs: ruta => {
          const t = $('#avv-anledning', ruta).value.trim();
          return t ? { värde: t } : { fel: 'Skriv varför — ett undantag utan anledning går inte att följa upp.' };
        }
      });
      if (!anledning) return;
      await medan(undanta, 'Sparar…', async () => {
        if (await skriv('bookings', p.id, { fakturerbar: false, fakturerbar_anledning: anledning })) {
          await laddaOmEkonomi();
        }
      });
      return;
    }

    const ja = await bekräfta({
      titel: 'Ta med passet igen?',
      text: vad + '. Passet kommer med på nästa körning, om det har en rapport.',
      knapp: 'Ta med'
    });
    if (!ja) return;
    await medan(återta, 'Sparar…', async () => {
      if (await skriv('bookings', p.id, { fakturerbar: true, fakturerbar_anledning: null })) {
        await laddaOmEkonomi();
      }
    });
  });

  /* ============================================================
     MÅNADSKÖRNINGEN (Fas 2; underlag, och fakturautkast sedan Fas 14.6)

     Två steg, som vid utskicket: först en torrkörning som visar vad
     som skulle skapas, sedan det skarpa anropet — och det går bara
     för samma månad som torrkörningen gällde. Det skarpa steget
     skapar UTKAST. Ingenting skickas och ingenting betalas härifrån.

     En familj som valt faktura får ett utkast per månad, som läggs in
     i Fortnox under Fakturor. Pass som hölls utan att familjen betalat
     med kort, och utan att de valt faktura, kommer tillbaka i svaret
     som `obetalda` och står här per familj, så att någon kan höra av
     sig. De faktureras inte av sig själva.

     EN RUTA, TRE STÄLLEN (2026-09-28). Körningen står under Ekonomi →
     Månadskörning, under Löner och under Månadens ekonomi: Leo ville
     skapa lönernas underlag och familjernas fakturor där han tittar på
     dem. Det är samma körning på alla tre, och samma lyssnare. En ruta
     är ett element med data-kor-ruta: perioden (en väljare med
     data-kor-period, eller attributet på rutan själv), knapparna
     data-kor-torr och data-kor-skapa, och data-kor-resultat för svaret.
     Torrkörningen hör till sin ruta. En torrkörning under Löner ger
     ingen Skapa-knapp under Ekonomi, för den som trycker där har inte
     sett vad som skapas.
     ============================================================ */
  /* SCHEMAT (2026-09-28). pg_cron-jobbet manadskorning skriver förra
     månadens underlag den 1:a, och underlaget är studiehjälparens
     lönespecifikation. Jobbet finns bara i cron.job, och ett schema som
     står av ser härifrån ut precis som ett som fungerar. Rutan frågar
     därför databasen i stället för att texten ovanför påstår något. */
  async function ritaSchema() {
    const host = $('#kor-schema');
    if (!host) return;
    const rad = (märke, text) => '<p class="xsmall" style="margin:0 0 16px;line-height:1.7">'
      + märke + ' ' + esc(text) + '</p>';
    const { data, error } = await supa.rpc('manadskorning_lage');
    if (error) {
      host.innerHTML = error.code === 'PGRST202'
        ? rad(pill('Av', ''), 'Databasen har inte schemat än: migrationen manadskorningen_vacks_av_databasen '
            + 'är inte körd. Månadskörningen går bara från knappen här.')
        : rad(pill('Okänt', 'ar-ny'), 'Schemat gick inte att läsa: ' + felText(error));
      return;
    }
    const d = data || {};
    if (!d.pa) {
      host.innerHTML = rad(pill('Av', ''), 'Månadskörningen går bara från knappen här, och en månad har '
        + 'ingen lönespecifikation förrän någon kört den. Schemat slås på med en migration, när '
        + 'provpassen är undantagna: DEPLOY-BETALNING.md avsnitt 6.');
      return;
    }
    if (!d.adress) {
      host.innerHTML = rad(pill('Adressen saknas', 'ar-ny'), 'Schemat är på, men notis_konfig saknar '
        + 'fakturering_url. Den 1:a blir det en uppgift i stället för underlag.');
      return;
    }
    /* Nästa körning i svensk tid. Schemat står i UTC, och 04:17 UTC är
       05:17 på vintern och 06:17 på sommaren. Ett annat schema än det
       migrationen satte visas som det står. */
    let när = 'enligt schemat ' + d.schema + ' (UTC)';
    if (d.schema === '17 4 1 * *') {
      const nu = new Date();
      let nästa = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1, 4, 17));
      if (nästa <= nu) nästa = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() + 1, 1, 4, 17));
      när = 'den 1:a varje månad, nästa gång ' + nästa.toLocaleString('sv-SE', {
        timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      });
    }
    host.innerHTML = rad(pill('På', 'ar-klar'), 'Går av sig själv ' + när + ', för förra månaden.');
  }

  function fyllPerioder() {
    // Rutan får inte stå kvar på "Hämtar" om frågan kastar.
    ritaSchema().catch(fel => {
      const host = $('#kor-schema');
      if (host) host.innerHTML = tomt('Schemat gick inte att läsa', felText(fel));
    });
    const val = $('#kor-period');
    if (!val || val.options.length) return;
    const nu = new Date();
    const alt = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      alt.push('<option value="' + iso + '">' + esc(NXBetalning.periodText(iso + '-01')) + '</option>');
    }
    const iår = nu.getFullYear() + '-' + String(nu.getMonth() + 1).padStart(2, '0');
    alt.push('<option value="' + iår + '">' + esc(NXBetalning.periodText(iår + '-01'))
      + ' (pågår)</option>');
    val.innerHTML = alt.join('');
    val.addEventListener('change', () => glömKörning(val.closest('[data-kor-ruta]')));
  }

  /* Den torrkörning som gäller, per ruta. Skapa går bara för samma
     period som torrkörningen gällde. */
  const torrkörda = new WeakMap();

  function körningsperiod(ruta) {
    const val = ruta.querySelector('select[data-kor-period]');
    return val ? val.value : String(ruta.dataset.korPeriod || '');
  }

  function glömKörning(ruta) {
    if (!ruta) return;
    torrkörda.delete(ruta);
    const skapa = ruta.querySelector('[data-kor-skapa]');
    if (skapa) skapa.disabled = true;
  }

  /* Rutorna under Löner och Månadens ekonomi körs för sidans valda
     månad. Byts den glöms torrkörningen och svaret: de gällde en
     annan månad. Samma månad igen rör ingenting, så att en omritning
     av sidan inte tar bort en torrkörning någon håller på att läsa. */
  function sättKörningsperiod(ruta, period) {
    if (!ruta) return;
    const p = String(period || '').slice(0, 7);
    if (ruta.dataset.korPeriod === p) return;
    ruta.dataset.korPeriod = p;
    glömKörning(ruta);
    const host = ruta.querySelector('[data-kor-resultat]');
    if (host) host.innerHTML = '';
  }

  function ritaKörning(d, torr) {
    const summa = lista => (lista || []).reduce((n, x) => n + Number(x.belopp_ore || 0), 0);
    const rad = (vänster, höger, total) => '<div class="sum-line' + (total ? ' total' : '') + '">'
      + '<span>' + vänster + '</span><span class="adm-tal">' + höger + '</span></div>';
    const underlag = d.utbetalningar || [];
    const fakturor = d.fakturor || [];
    const obetalda = d.obetalda || [];

    let h = '<p class="small" style="margin:14px 0 8px"><b>'
      + esc((torr ? 'Torrkörning' : 'Skapat') + ' · ' + NXBetalning.periodText(d.period)) + '</b>'
      + ' <span class="xsmall" style="color:var(--bl-3)">pass till och med '
      + esc(kortDatum(d.pass_till_och_med)) + '</span></p>';

    h += underlag.map(u => rad(esc(namnFör(u.tutor_id)) + ' · ' + u.pass + ' pass',
      esc(kronor(u.belopp_ore)))).join('');
    h += rad('Studiehjälparna, ' + underlag.length + ' underlag', esc(kronor(summa(underlag))), true);

    if (fakturor.length) {
      h += fakturor.map(f => rad(esc(namnFör(f.parent_id)) + ' · ' + f.pass + ' pass',
        esc(kronor(f.belopp_ore)))).join('');
      h += rad('Fakturor att lägga in i Fortnox, ' + fakturor.length + ' st', esc(kronor(summa(fakturor))), true);
    }

    /* Per familj, för det är familjen man hör av sig till. Ingen
       faktura skapas av det här: det är en lista, inte ett krav. */
    if (obetalda.length) {
      const per = {};
      obetalda.forEach(o => { (per[o.parent_id] = per[o.parent_id] || []).push(o); });
      h += Object.keys(per).map(id => rad(esc(namnFör(id)) + ' · ' + per[id].length + ' pass',
        esc(kronor(summa(per[id]))))).join('');
      h += rad('Hölls utan betalning, ' + obetalda.length + ' pass', esc(kronor(summa(obetalda))), true);
    }

    const noter = [];
    if (obetalda.length) {
      noter.push('⚠️ ' + obetalda.length + (obetalda.length === 1 ? ' pass hölls' : ' pass hölls')
        + ' utan att familjen betalat. De faktureras inte av sig själva: Betala-knappen ligger '
        + 'kvar på passet i familjens vy. <a href="#ekonomi/avvikelser">Se avvikelser</a>.');
    }
    const utan = d.hoppade_over_utan_rapport || [];
    if (utan.length) {
      noter.push('⚠️ ' + utan.length + (utan.length === 1 ? ' pass saknar' : ' pass saknar')
        + ' rapport och kom inte med. <a href="#ekonomi/avvikelser">Se avvikelser</a>.');
    }
    (d.hoppade_over_utan_timpenning || []).forEach(id => noter.push('⚠️ ' + esc(namnFör(id))
      + ' har ingen timpenning, så hens pass väntar till nästa körning.'));
    if (d.undantagna_pass) noter.push(d.undantagna_pass + ' undantagna pass räknades inte.');
    if (d.skapade) {
      noter.push('Skapade: ' + d.skapade.utbetalningar + ' underlag'
        + (d.skapade.fakturor ? ' och ' + d.skapade.fakturor + (d.skapade.fakturor === 1 ? ' faktura' : ' fakturor') : '')
        + ', alla som utkast.' + (d.skapade.fakturor ? ' Lägg in fakturorna i Fortnox under <a href="#ekonomi/fakturor">Fakturor</a>.' : ''));
    }
    (d.problem || []).forEach(p => noter.push('⚠️ ' + esc(p)));
    if (!underlag.length && !fakturor.length && torr) noter.push('Inget underlag och ingen faktura att skapa för den här månaden.');

    return h + noter.map(n => '<p class="xsmall" style="margin:8px 0 0;line-height:1.6">' + n + '</p>').join('');
  }

  /* Efter en skarp körning finns nya underlag och fakturor, och allt
     som räknar på dem hämtas om: listorna här, översikten, bokslutet,
     Månadens ekonomi och Löner. */
  async function efterKörning() {
    await hämtaAllt();
    await hämtaEkonomiunderlag();
    ritaFakturor();
    ritaUtbetalningar();
    ritaKortbetalningar();
    ritaAvvikelser();
    ritaMånadsvyerna();
    await Promise.all([ritaÖversikt(), laddaBokslut()]);
  }

  document.addEventListener('click', async e => {
    const torr = e.target.closest('[data-kor-torr]');
    const skapa = e.target.closest('[data-kor-skapa]');
    if (!torr && !skapa) return;
    const ruta = (torr || skapa).closest('[data-kor-ruta]');
    if (!ruta) return;

    const period = körningsperiod(ruta);
    const host = ruta.querySelector('[data-kor-resultat]');
    const skapaKnapp = ruta.querySelector('[data-kor-skapa]');
    if (!period || !host || !skapaKnapp) return;

    if (torr) {
      glömKörning(ruta);
      const res = await medan(torr, 'Räknar…', () =>
        supa.functions.invoke('fakturering', { body: { torrkorning: true, period } }));
      /* Hann månaden bytas medan frågan gick gäller svaret en annan. */
      if (körningsperiod(ruta) !== period) return;
      const fel = res.error || (res.data && res.data.error);
      if (fel) { host.innerHTML = tomt('Torrkörningen gick inte', await funktionsFel(fel)); return; }
      torrkörda.set(ruta, { period, torr: res.data });
      host.innerHTML = ritaKörning(res.data, true);
      skapaKnapp.disabled = !(res.data.utbetalningar || []).length && !(res.data.fakturor || []).length;
      return;
    }

    const k = torrkörda.get(ruta);
    if (!k || k.period !== period) { skapaKnapp.disabled = true; return; }
    const t = k.torr;
    const summa = lista => (lista || []).reduce((n, x) => n + Number(x.belopp_ore || 0), 0);
    const fakt = t.fakturor || [];
    const ja = await bekräfta({
      titel: 'Skapa utkast för ' + NXBetalning.periodText(t.period) + '?',
      text: t.utbetalningar.length + ' underlag på ' + kronor(summa(t.utbetalningar))
        + (fakt.length ? ' och ' + fakt.length + (fakt.length === 1 ? ' faktura' : ' fakturor') + ' på ' + kronor(summa(fakt)) : '')
        + '. De skapas som utkast — ingenting skickas och ingenting betalas ut härifrån.',
      knapp: 'Skapa utkast'
    });
    if (!ja) return;

    const res = await medan(skapaKnapp, 'Skapar…', () =>
      supa.functions.invoke('fakturering', { body: { period } }));
    const fel = res.error || (res.data && res.data.error);
    glömKörning(ruta);
    if (fel) { host.innerHTML = tomt('Körningen gick inte', await funktionsFel(fel)); return; }
    host.innerHTML = ritaKörning(res.data, false);
    await efterKörning();
  });

  /* Priset redigeras inte längre här — det gör tjänstekatalogen
     nedan. Kvar är talet i månadskörningens sammanfattning, som
     visar vad fakturering FAKTISKT kommer att räkna med: värdet i
     prissattning, dit triggern speglar läxhjälpens pris. Läser man
     tjanster här i stället skulle rutan visa vad någon nyss skrev
     medan funktionen räknade på något annat. */
  function ritaPris() {
    const öre = S.pris ? S.pris.pris_per_timme_ore : (NX.CFG.PRIS_PER_TIMME || 379) * 100;
    const ruta = $('#kor-pris');
    if (ruta) ruta.textContent = kronor(öre);
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    avvText, fyllPerioder, kandidater, laddaBokslut, laddaOmEkonomi, ritaAvvikelser,
    ritaBokslut, ritaFakturor, ritaKortbetalningar, ritaPris, ritaUtbetalningar,
    sättKörningsperiod, utanRapport
  });
})();
