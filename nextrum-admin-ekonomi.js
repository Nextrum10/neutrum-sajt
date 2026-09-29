/* ============================================================
   NEXTRUM — adminvyn, Betalningar: familjernas pengar och det som väntar

   En del av nextrum-admin.js, utflyttad i Fas 6. Kärnan
   (nextrum-admin-karna.js) laddas först och delar tillståndet S och
   hjälparna; varje område registrerar de funktioner andra områden
   anropar i NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.

   OMGJORD 2026-09-29. Leo: "gör om betalningar. den behöver vara
   mycket snyggare, lätt tolkad, lättanvänd och mycket mer
   funktionell". Sidan hade sex flikar som inte hängde ihop:
     · Kortbetalningar var sex rutor om olika saker (en spärr som inte
       går att slå på, erbjudandena, Stripe-läget, tvisterna, själva
       betalningarna och tilläggen), och betalningarna stod i den
       femte. På en telefon syntes varken belopp eller läge utan att
       dra tabellen i sidled.
     · Samma larm stod under Bokslut och under Avvikelser, med olika
       knappar, och varje larm skickade en till en annan flik.
     · Månaden gömde det som väntade i en annan: i september var
       Fakturor tom fast augustis utkast skulle läggas in i Fortnox.
     · Utbetalningar och Månadskörning fanns redan under Löner.

   Nu är sidan familjernas pengar, i sex flikar:
     Att göra          allt som väntar på er, i alla månader, med
                       knappen som gör det på raden
     Alla betalningar  månadens betalningar, en rad var, med filter
     Fakturor          från fakturapass till betald faktura, alla perioder
     Bokslut           månaden går ihop, och stängs
     Köpta timmar      planer, klippkort och timbanken
     Inställningar     strömbrytarna och Stripe

   INGET NYTT I DATABASEN. Allt ritas ur det adminvyn redan hämtar, och
   knapparna som ändrar något är samma lyssnare som förut (data-fakt-*,
   data-aterbetala, data-avv-*, data-bokslut-*, data-kor-*, flaggorna,
   data-timbank-ut). Det enda nya som gör något är Påminn, och det
   skriver bara ett utkast i ert eget mejlprogram (kontaktaRuta).

   FÄRGEN SÄGER VEMS DRAG DET ÄR, som i resten av vyerna: lera är ert
   drag eller ett fel, ockra väntar på någon annan (oftast familjen),
   mossa är klart.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const tim = m => NXBetalning.timmar(m);

  const { DAG, FAKT_LAGE, S, TILLAGG_LAGE, elevNamn, fråga, funktionsFel, hämtaAllt,
          hämtaEkonomiunderlag, kontaktaRuta, kortDatum, lönemånad, matchar, märkFlik, namnFör,
          pill, senasteLönemånad, skriv } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const skapaUppgift = (...a) => NXAdmin.rita.skapaUppgift(...a);

  /* ============================================================
     MÅNADEN (Fas 20.2)

     Leo 2026-09-27: "i adminvyn ska vi kunna filtrera och stänga
     böckerna utifrån det. månadsvis". Alla betalningar och Bokslut
     gäller den månad som är vald i raden: pass, kortbetalningar,
     tillägg och tvister på PASSETS datum, köpta timmar på dagen de
     betalades. Samma gräns som manad_lage() drar i databasen, så att
     en rad i listan och ett tal i bokslutet aldrig räknas på två sätt.

     Raden står bara under de två flikarna (CSS, nextrum-arbetsyta.css
     BETALNINGAR). Att göra, Fakturor och Köpta timmar gäller alla
     månader: det som väntar ska inte gömmas för att fel månad råkade
     vara vald, och det var just så augustis fakturor försvann i
     september.

     Raden startas första gången något här frågar efter månaden, inte
     i skalet: då kan ingen lista ritas innan det finns en månad.
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
  const månadText = () => NXStudie.månadsNamn(valdMånad());
  const stor = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* Väljaren har de tolv senaste månaderna. En månad utanför den står
     som text i stället för knapp. */
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

  const bokning = id => (S.bokningar || []).find(b => b.id === id) || null;

  /* Allt ritas ur det som redan är hämtat; bara bokslutet frågar
     databasen. Ingen lista byts mot "Hämtar" (CLAUDE.md avsnitt 3). */
  function bytMånad() {
    ritaBetalningslistan();
    laddaBokslut();
  }

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-eko-manad]');
    if (!k || !MV) return;
    MV.sätt(k.dataset.ekoManad);     // tyst: vidVal körs inte av sätt()
    bytMånad();
  });

  /* Månadens ekonomi länkar till Alla betalningar för sin månad. Utan
     det hade länken visat den månad som råkade vara vald här, och
     beloppen hade inte gått att stämma av mot varandra. */
  function visaBetalningsmånad(m) {
    startaMånadsval();
    if (!MV || MV.vald() === m) return;
    MV.sätt(m);
    bytMånad();
  }

  /* Till en annan flik i sektionen, från en knapp i innehållet. Adressen
     skrivs som när man trycker på fliken själv (replaceState: ett
     flikbyte är inte ett steg bakåtknappen ska ta), och står flikraden
     ovanför skärmen läggs den överst. Annars hade man hamnat mitt i den
     nya flikens innehåll, på samma höjd som man stod i den gamla. */
  function visaFlik(namn) {
    const f = S.flikar && S.flikar.ekonomi;
    if (!f) { location.hash = '#ekonomi/' + namn; return; }
    f.visa(namn);
    const ny = '#ekonomi/' + namn;
    if (location.hash !== ny && window.history && history.replaceState) history.replaceState(null, '', ny);
    const rad = $('section[data-sek="ekonomi"] .vy-flikar');
    if (rad && rad.getBoundingClientRect().top < 80) NXStudie.visaÖverst(rad);
  }

  document.addEventListener('click', e => {
    const flik = e.target.closest('[data-eko-flik]');
    if (flik) { visaFlik(flik.dataset.ekoFlik); return; }
    /* Fakturaflödets steg leder till sin grupp. Inte en ankarlänk:
       en hash som inte är en sektion skickar sidomenyn till Översikt. */
    const till = e.target.closest('[data-eko-till]');
    if (till) {
      const mål = document.getElementById(till.dataset.ekoTill);
      if (mål) NXStudie.visaÖverst(mål);
    }
  });

  /* ============================================================
     SMÅ BYGGSTENAR
     ============================================================ */
  const DAGAR = Number((NX.CFG && NX.CFG.BETALNINGSVILLKOR_DAGAR) || 10);

  /* Datum och klockslag i svensk tid. kortDatum() skär av en
     tidsstämpel vid tecken tio, alltså UTC-datumet: en månad stängd
     strax efter midnatt hade stått på dagen innan. */
  const lokalDag = ts => ts ? datumText(isoFor(new Date(ts))) : '—';
  const avNamn = id => { const n = id ? namnFör(id) : '—'; return n && n !== '—' ? ' av ' + n : ''; };

  /* Hela dagar mellan datumen, inte timmar genom 24: "sex dagar kvar"
     ska betyda sex kalenderdagar, också på eftermiddagen. */
  const dagarTill = iso => Math.round((Date.parse(String(iso).slice(0, 10)) - Date.parse(isoFor(new Date()))) / DAG);

  function minText(m) {
    const n = Math.max(0, Math.round(Number(m) || 0));
    const h = Math.floor(n / 60), r = n % 60;
    return ((h ? h + ' h ' : '') + (r || !h ? r + ' min' : '')).trim();
  }

  /* Ikonerna i raderna, i samma streck som menyns. De säger vad raden
     handlar om innan man läst den; färgen står på rutan runt dem. */
  const IKON = {
    tvist: '<path d="M12 3.5 19.5 6.5v5.2c0 4.3-3.1 7.8-7.5 8.8-4.4-1-7.5-4.5-7.5-8.8V6.5z"/><path d="M12 8.5v4.2M12 15.8h.01"/>',
    tillbaka: '<path d="M9.5 14.5 4.5 9.5l5-5"/><path d="M4.5 9.5h10a5 5 0 0 1 0 10H11"/>',
    faktura: '<path d="M6.5 3.5h8l3 3v14h-11z"/><path d="M9.5 10.5h5M9.5 14h5M9.5 17.5h3"/>',
    kort: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M6.5 14.5h3"/>',
    rapport: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M9 12h6M9 16h4"/>',
    loner: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3.2 2.5-5 5.5-5 1 0 1.9.2 2.7.5"/><circle cx="16.5" cy="15.5" r="4"/><path d="M16.5 13.5v4"/>',
    timmar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    ovrigt: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 15.8h.01"/>',
    klar: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    brytare: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/><circle cx="16.5" cy="12" r="2.6"/>'
  };
  const TON = { lera: '', ockra: ' ar-ockra', mossa: ' ar-mossa', tyst: ' ar-tyst' };
  const ikonRuta = (ikon, ton) => '<span class="vy-rad-ik' + (TON[ton] || '') + '" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24">' + (IKON[ikon] || IKON.ovrigt) + '</svg></span>';

  function knapp(attr, värde, text, primär) {
    return '<button class="btn ' + (primär ? 'btn-primary' : 'btn-ghost') + ' btn-sm" type="button" '
      + attr + '="' + esc(värde) + '">' + esc(text) + '</button>';
  }
  const länkKnapp = (href, text) => '<a class="btn btn-ghost btn-sm" href="' + esc(href) + '">' + esc(text) + '</a>';

  /* Datumet, familjen och studiehjälparen som knappar till sin panel.
     Knappar som ser ut som länkar: de öppnar något på sidan, de går
     inte någonstans. */
  const passLänk = (b, text) => '<button type="button" class="eko-lank" data-dp="pass:' + esc(b.id) + '">'
    + esc(text || kortDatum(b.wanted_date)) + '</button>';
  const familjLänk = id => id ? '<button type="button" class="eko-lank" data-dp="familj:' + esc(id) + '">'
    + esc(namnFör(id)) + '</button>' : '';
  const hjälparLänk = id => id ? '<button type="button" class="eko-lank" data-dp="studiehjalpare:' + esc(id) + '">'
    + esc(namnFör(id)) + '</button>' : '';

  /* Dagen i en ruta, som passraderna i studievyerna: dag och månad,
     ingen veckodag. En faktura har sin månad i rutan i stället. */
  function dagRuta(iso) {
    const d = String(iso || '').slice(0, 10).split('-').map(Number);
    if (!d[1]) return '<span class="eko-dag"><b>—</b></span>';
    return '<span class="eko-dag" aria-hidden="true"><b>' + d[2] + '</b><small>'
      + esc(NX.MANADER[d[1] - 1].slice(0, 3)) + '</small></span>';
  }
  function periodRuta(iso) {
    const d = String(iso || '').slice(0, 7).split('-').map(Number);
    if (!d[1]) return '<span class="eko-dag"><b>—</b></span>';
    return '<span class="eko-dag ar-period" aria-hidden="true"><b>' + esc(NX.MANADER[d[1] - 1].slice(0, 3))
      + '</b><small>' + d[0] + '</small></span>';
  }

  /* En ruta med ett tal, samma som summan överst i familjens
     Betalning (.bet-sam): lera när något väntar på er. */
  const samKort = (rubrik, tal, under, gör) => '<div' + (gör ? ' class="ar-gor"' : '') + '><small>'
    + esc(rubrik) + '</small><b>' + esc(tal) + '</b><span>' + esc(under) + '</span></div>';

  /* En grupp: rubrik på papperet och ett kort med raderna under, som
     i studievyerna (INNEHÅLLET i nextrum-arbetsyta.css). */
  function grupp(id, rubrik, antal, rader, gör, text) {
    return '<div class="vy-grupp"' + (id ? ' id="' + id + '"' : '') + '><h3>' + esc(rubrik) + '</h3>'
      + (antal != null ? '<span class="vy-antal' + (gör ? ' ar-gor' : '') + '">' + antal + '</span>' : '')
      + '</div>' + (text ? '<p class="eko-grupptext">' + esc(text) + '</p>' : '')
      + '<div class="vy-kort"><div class="vy-lista">' + rader + '</div></div>';
  }

  /* ============================================================
     VAD LARMEN HETER (Fas 6)

     Räknade i databasen av ekonomiska_avvikelser(), med samma regler
     som månadskörningen. Rubrik och förklaring på ett ställe: Att göra,
     bokslutets larm, uppgiften som skapas, passets detalj och
     raderingsrutan läser alla härifrån. En okänd typ visas med sin kod
     hellre än inte alls.
     ============================================================ */
  const AVV_TEXT = {
    pass_utan_rapport: ['Pass utan rapport', 'Genomfört men utan rapport, så det kommer inte med på underlaget. Koppla rapporten eller undanta passet under Betalningar → Att göra.'],
    fristaende_rapport: ['Rapport utan pass', 'En rapport som inte hör till något pass. Koppla den till sitt pass under Betalningar → Att göra.'],
    ej_betalt: ['Inte betalt', 'Hölls och rapporterades, men familjen har inte betalat. Betala-knappen ligger kvar på passet i familjens vy.'],
    /* Fas 20.1. Passet var betalt och drog över. Familjen betalar
       tillägget med kort när de bekräftar rapporten; beloppet räknas i
       stripe-checkout och står därför inte i larmet. */
    tillagg_obetalt: ['Tillägget för övertid är inte betalt', 'Passet var betalt och drog över. Familjen betalar tillägget när de bekräftar rapporten.'],
    /* Fas 20.1. Betalt med kort för mer tid än passet höll. Beloppet är
       det som ska tillbaka, räknat till passets frysta pris; rubriken
       bär det (avvText). */
    betalt_for_lange: ['Betalt för längre tid än passet höll', 'Passet blev kortare än det familjen betalade för. Återbetala skillnaden under Betalningar → Att göra.'],
    /* Fas 14.6. */
    faktura_saknas: ['Fakturapass utan faktura', 'Familjen valde faktura, månaden är slut och passet står inte på någon faktura. Kör månadskörningen.'],
    betald_och_fakturerad: ['Betalt två gånger', 'Betalt med kort och dessutom på en faktura. Kreditera raden i Fortnox.'],
    /* Fas 14.2c. Betalsidan kan ligga öppen medan passet avbokas, och
       betalas den efteråt drar Stripe pengarna ändå. Beloppet är det
       som inte gått tillbaka än. */
    betald_men_avbokad: ['Betalt men avbokat', 'Familjen har betalat ett pass som är avbokat. Villkoren lovar hela beloppet tillbaka.'],
    ej_utbetalt: ['Inte utbetalt', 'Klart för underlag, men månaden det hölls är slut.'],
    faktura_forfallen: ['Förfallen faktura', 'Skickad, obetald och efter förfallodagen.'],
    faktura_gammalt_utkast: ['Faktura inte inlagd i Fortnox', 'Utkastet skapades för mer än en vecka sedan.'],
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

  function avvText(a) {
    const t = AVV_TEXT[a.typ] || [a.typ, ''];
    if (a.typ === 'betalt_for_lange' && a.belopp_ore != null) {
      return ['Betalt för längre tid än passet höll: betala tillbaka ' + kronor(a.belopp_ore), t[1]];
    }
    return t;
  }

  /* ============================================================
     AVVIKELSERNA SOM RÖR RAPPORTERNA (Fas 2)

     Ett genomfört pass utan rapport kommer aldrig med i
     månadskörningen. Rapporten är det som visar att passet hölls, och
     det är den som motiverar raden på studiehjälparens underlag. Här
     tar någon ställning, ett pass i taget: koppla rätt rapport, eller
     undanta passet. utanRapport() är ofiltrerad, för översikten räknar
     hela systemet med den.
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

  /* ============================================================
     ATT GÖRA (2026-09-29)

     Allt som väntar på en människa, i alla månader, med knappen som
     gör det på raden. Förut stod larmen i bokslutet med en länk till
     fliken där de åtgärdades, och samma rader en gång till under
     Avvikelser med en knapp som gjorde dem till uppgifter. Nu är
     Återbetala, Lagd i Fortnox, Betald, Koppla rapport, Undanta, Kör
     månadskörningen och Påminn på raden själv.

     Källorna är de som redan fanns: avvikelserna (avvikelser_rader i
     databasen, samma som bokslutet), fakturorna, tvisterna och
     betalningar utan Stripes avgift. Fyra saker slås ihop, för det är
     EN sak att göra:
       · en familjs obetalda pass och tillägg blir en rad per familj,
         för det är familjen man hör av sig till
       · fakturapass utan faktura blir en rad per månad, för det är
         månaden man kör
       · ett utkast står en gång, som "Lägg in i Fortnox", också när
         det är äldre än en vecka och därför också är ett larm
       · en fristående rapport som kan höra till ett pass utan rapport
         står på passets rad, med Koppla rapport

     Talet på fliken och vid Betalningar i menyn är antalet rader här,
     och räknas bara här (märkEkonomi). Två tal för samma sak hade
     glidit isär.
     ============================================================ */
  /* Gruppen, dess rubrik, om det är ert drag (siffran i lera) och en
     mening som gäller alla rader i den. Meningen stod förut på varje
     rad, och fyra obetalda familjer blev fyra likadana stycken. */
  const GRUPPER = [
    ['tvist', 'Korttvister att svara på', true,
      'Missas sista dagen är tvisten förlorad, och då är både beloppet och Stripes avgift för tvisten borta.'],
    ['tillbaka', 'Pengar tillbaka till familjer', true,
      'Pengar som är familjens. Återbetala skickar dem tillbaka till kortet; Stripes avgift kommer inte tillbaka.'],
    ['fakturor', 'Fakturor', true, ''],
    ['obetalt', 'Inte betalt än', false,
      'Passen har hållits. Familjen betalar på passets sida i studievyn, med kort eller faktura, och ingen sista '
      + 'dag är satt: det är ni som följer upp. Påminn skriver ett mejl åt er.'],
    ['rapporter', 'Rapporter', true,
      'Ett pass utan rapport kommer inte med på underlaget eller fakturan.'],
    ['loner', 'Löner', false, ''],
    ['ovrigt', 'Övrigt', false, '']
  ];
  const GRUPPORDNING = GRUPPER.map(g => g[0]);
  const LÖNELARM = ['ej_utbetalt', 'utbetalning_vantar', 'utbetalning_misslyckad', 'utbetalning_summa_fel',
    'timpenning_saknas', 'pass_utan_studiehjalpare'];

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
  /* Samma orsakstexter som TVIST_ORSAK i _delad/stripe.ts: uppgiftens
     beskrivning och raden här ska säga samma sak. Läget kort, för det
     står i ett märke. */
  const TVIST_LAGE = {
    needs_response: ['Tvist, svara', 'ar-ny'],
    warning_needs_response: ['Förfrågan, svara', 'ar-ny'],
    under_review: ['Tvist hos banken', 'ar-vantar'],
    warning_under_review: ['Förfrågan hos banken', 'ar-vantar'],
    won: ['Tvist vunnen', 'ar-klar'],
    warning_closed: ['Förfrågan stängd', 'ar-klar'],
    lost: ['Tvist förlorad', '']
  };
  const väntarPåOss = x => !x.stangd && (x.lage === 'needs_response' || x.lage === 'warning_needs_response');
  const NÄRVARO = { narvarande: 'närvarande', sen: 'kom sent', franvarande: 'uteblev' };

  const stripeLänk = (x, primär) => '<a class="btn ' + (primär ? 'btn-primary' : 'btn-ghost')
    + ' btn-sm" target="_blank" rel="noopener noreferrer" href="https://dashboard.stripe.com/'
    + (x.skarp ? '' : 'test/') + 'disputes/' + encodeURIComponent(x.id) + '">Öppna i Stripe</a>';

  function öppnaUppgifter() {
    return new Set((S.uppgifter || [])
      .filter(u => u.nyckel && (u.status === 'oppen' || u.status === 'pagar'))
      .map(u => u.nyckel));
  }

  /* Vem ett larm gäller. manad_lage svarar med koder och id:n men utan
     personerna, och avvikelser_rader har dem: samma rad slås upp där. */
  function fullAvvikelse(a) {
    if (a.kund_id !== undefined) return a;
    const r = (S.avvikelser || []).find(x => x.typ === a.typ && x.objekt_tabell === a.objekt_tabell
      && x.objekt_id === a.objekt_id);
    return Object.assign({ kund_id: null, studiehjalpare_id: null }, r || {}, a);
  }

  /* Datum, ämne och elev, familjen och studiehjälparen på ett pass. */
  function passMeta(b, utanFamilj) {
    if (!b) return [];
    const elev = elevNamn(b.student_id);
    return [passLänk(b), esc([b.subject || 'Pass', elev && elev !== '—' ? elev : null].filter(Boolean).join(' · ')),
      utanFamilj ? '' : familjLänk(b.parent_id), b.tutor_id ? esc(namnFör(b.tutor_id)) : ''];
  }

  const kanÅterbetalas = b => !!b && b.betalning_status === 'betald'
    && Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0) > 0;

  function påminnKnapp(föräldraId, extra) {
    const p = S.personer[föräldraId] || {};
    if (!p.email) return '';
    return '<button class="btn btn-ghost btn-sm" type="button" data-eko-paminn="' + esc(föräldraId) + '"'
      + (extra || '') + '>Påminn</button>';
  }

  /* Tillägget för övertid bär inget belopp i larmet (stripe-checkout
     räknar det), men raden i pass_tillagg har det begärda. */
  function beloppFör(a) {
    if (a.typ !== 'tillagg_obetalt') return a.belopp_ore;
    const t = (S.tillagg || []).find(x => x.booking_id === a.objekt_id && (x.status === 'vantar' || x.status === 'misslyckad'));
    return t ? t.begart_ore : null;
  }

  /* Underlaget i en tvist: det vi själva vet om passet. Rapporten och
     tiden står på passets egen sida, dit datumet leder. */
  function tvistUnderlag(b) {
    if (!b) return 'Passet hittades inte.';
    const pu = (S.passunderlag || []).find(p => p.id === b.id);
    return 'Underlaget vi har: ' + [
      'bokat ' + kortDatum(b.created_at),
      b.status === 'confirmed' || b.status === 'completed' ? 'bekräftat' : 'inte bekräftat',
      b.attendance ? 'eleven ' + (NÄRVARO[b.attendance] || b.attendance) : 'ingen närvaro',
      pu && pu.har_rapport ? 'rapport finns' : 'ingen rapport',
      b.betald_at ? 'betalt ' + lokalDag(b.betald_at) : null
    ].filter(Boolean).join(', ') + '. Det skickas in i Stripes dashboard.';
  }

  function tvistPost(x) {
    const b = bokning(x.booking_id);
    const kvar = x.svara_senast ? dagarTill(x.svara_senast) : null;
    const kvarText = kvar == null ? null : kvar < 0 ? 'Fristen har gått ut' : kvar === 0 ? 'Sista dagen i dag'
      : kvar === 1 ? '1 dag kvar' : kvar + ' dagar kvar';
    return {
      grupp: 'tvist', ton: 'lera', ikon: 'tvist', datum: String(x.svara_senast || x.skapad || '').slice(0, 10),
      rubrik: x.svara_senast ? 'Svara på korttvisten senast ' + kortDatum(x.svara_senast) : 'Svara på korttvisten',
      meta: [kvarText ? '<b>' + esc(kvarText) + '</b>' : '', b ? familjLänk(b.parent_id) : '',
        b ? passLänk(b, kortDatum(b.wanted_date) + ' · ' + (b.subject || 'Pass')) : '',
        esc(x.orsak ? (TVIST_ORSAK[x.orsak] || 'Annan orsak (' + x.orsak + ')') : 'Ingen orsak angiven')],
      belopp: x.belopp_ore, hur: tvistUnderlag(b), knappar: stripeLänk(x, true), avv: []
    };
  }

  function utkastPost(f, avv) {
    const n = (f.invoice_lines || []).length;
    return {
      grupp: 'fakturor', ton: 'lera', ikon: 'faktura', datum: f.created_at ? isoFor(new Date(f.created_at)) : String(f.period),
      rubrik: 'Lägg in fakturan i Fortnox',
      meta: [familjLänk(f.parent_id), esc('för ' + NXBetalning.periodText(f.period)), esc(n + ' pass'),
        f.created_at ? esc('utkast sedan ' + lokalDag(f.created_at)) : ''],
      belopp: f.belopp_ore,
      hur: 'Underlag visar det som ska stå på fakturan. Skapa den i Fortnox och tryck Lagd i Fortnox med numret.',
      knappar: knapp('data-fakt-underlag', f.id, 'Underlag') + knapp('data-fakt-fortnox', f.id, 'Lagd i Fortnox', true),
      avv: avv || []
    };
  }

  function förfallenPost(f, avv) {
    const sen = f.forfaller ? -dagarTill(f.forfaller) : 0;
    return {
      grupp: 'fakturor', ton: 'lera', ikon: 'faktura', datum: String(f.forfaller || f.period).slice(0, 10),
      rubrik: 'Förfallen faktura',
      meta: [familjLänk(f.parent_id), esc('för ' + NXBetalning.periodText(f.period)),
        f.fortnox_fakturanummer ? esc('nr ' + f.fortnox_fakturanummer) : '',
        f.forfaller ? esc('förföll ' + kortDatum(f.forfaller) + (sen > 0 ? ', ' + sen + (sen === 1 ? ' dag sedan' : ' dagar sedan') : '')) : ''],
      belopp: f.belopp_ore,
      hur: 'Markera den betald när betalningen syns i Fortnox. Ingen påminnelseavgift: villkoren nämner ingen.',
      knappar: påminnKnapp(f.parent_id, ' data-eko-faktura="' + esc(f.id) + '"')
        + knapp('data-fakt-betald', f.id, 'Betald', true),
      avv: avv || []
    };
  }

  /* En avvikelse som en rad, med sin egen knapp. Bokslutets larm ritas
     med den här, en rad per larm; Att göra slår ihop några (ovan). */
  function postFörAvvikelse(a0) {
    const a = fullAvvikelse(a0);
    const b = a.objekt_tabell === 'bookings' ? bokning(a.objekt_id) : null;
    const f = a.objekt_tabell === 'invoices' ? (S.fakturor || []).find(x => x.id === a.objekt_id) : null;
    const [rubrik, hur] = avvText(a);
    const familj = a.kund_id || (b && b.parent_id) || null;
    const bas = {
      grupp: 'ovrigt', ton: 'lera', ikon: 'ovrigt', datum: a.datum || '', rubrik, hur,
      meta: b ? passMeta(b) : [a.datum ? esc(kortDatum(a.datum)) : '', familjLänk(a.kund_id)],
      belopp: null, knappar: '', avv: [a]
    };

    switch (a.typ) {
      case 'pass_utan_rapport': {
        const p = (S.passunderlag || []).find(x => x.id === a.objekt_id);
        const n = p ? kandidater(p).length : 0;
        return Object.assign(bas, {
          grupp: 'rapporter', ikon: 'rapport',
          hur: n ? (n === 1 ? 'Studiehjälparen har en fristående rapport som kan höra hit.'
                            : 'Studiehjälparen har ' + n + ' fristående rapporter som kan höra hit.')
            : 'Kommer inte med på underlaget eller fakturan förrän rapporten finns. Be studiehjälparen skriva den, eller undanta passet om det inte ska räknas.',
          knappar: p ? (n ? knapp('data-avv-koppla', p.id, 'Koppla rapport', true) : '')
            + knapp('data-avv-undanta', p.id, 'Undanta') : ''
        });
      }
      case 'fristaende_rapport': {
        const r = (S.fristaendeRapporter || []).find(x => x.id === a.objekt_id) || {};
        const tutor = r.tutor_id || a.studiehjalpare_id;
        const text = String(r.raw_notes || '').replace(/\s+/g, ' ').trim();
        return Object.assign(bas, {
          grupp: 'rapporter', ton: 'ockra', ikon: 'rapport',
          meta: [esc(kortDatum(r.lesson_date || a.datum)), hjälparLänk(tutor),
            r.student_id ? esc(elevNamn(r.student_id)) : ''],
          hur: 'Kommer aldrig med på ett underlag av sig själv. Hör den till ett pass, koppla den från passet.'
            + (text ? ' ”' + (text.length > 90 ? text.slice(0, 89) + '…' : text) + '”' : '')
        });
      }
      case 'ej_betalt':
        return Object.assign(bas, {
          grupp: 'obetalt', ton: 'ockra', ikon: 'kort', rubrik: 'Hölls men är inte betalt',
          belopp: a.belopp_ore, hur: 'Familjen betalar på passets sida i studievyn, med kort eller faktura.',
          knappar: påminnKnapp(familj)
        });
      case 'tillagg_obetalt':
        return Object.assign(bas, {
          grupp: 'obetalt', ton: 'ockra', ikon: 'kort', belopp: beloppFör(a),
          knappar: påminnKnapp(familj)
        });
      case 'betalt_for_lange':
        return Object.assign(bas, {
          grupp: 'tillbaka', ikon: 'tillbaka',
          rubrik: 'Betala tillbaka ' + kronor(a.belopp_ore) + (familj ? ' till ' + namnFör(familj) : ''),
          meta: b ? passMeta(b, true) : bas.meta, belopp: a.belopp_ore,
          hur: 'Passet blev kortare än det familjen betalade för. Återbetala föreslår skillnaden.',
          knappar: kanÅterbetalas(b) ? knapp('data-aterbetala', b.id, 'Återbetala', true) : ''
        });
      case 'betald_men_avbokad':
        return Object.assign(bas, {
          grupp: 'tillbaka', ikon: 'tillbaka',
          rubrik: 'Betala tillbaka ' + kronor(a.belopp_ore) + (familj ? ' till ' + namnFör(familj) : ''),
          meta: b ? passMeta(b, true).concat(esc('avbokat')) : bas.meta, belopp: a.belopp_ore,
          hur: 'Passet är avbokat men betalt. Villkoren lovar hela beloppet tillbaka för ett pass som aldrig hölls.',
          knappar: kanÅterbetalas(b) ? knapp('data-aterbetala', b.id, 'Återbetala', true) : ''
        });
      case 'betald_och_fakturerad':
        return Object.assign(bas, { grupp: 'tillbaka', ikon: 'tillbaka', belopp: a.belopp_ore });
      case 'faktura_saknas':
        return Object.assign(bas, {
          grupp: 'fakturor', ikon: 'faktura', belopp: a.belopp_ore,
          hur: 'Månaden är slut och passet står inte på någon faktura. Månadskörningen skapar den.',
          knappar: knapp('data-eko-korning', String(a.datum).slice(0, 7), 'Kör månadskörningen', true)
        });
      case 'faktura_gammalt_utkast':
        if (f) return utkastPost(f, [a]);
        break;
      case 'faktura_forfallen':
        if (f) return förfallenPost(f, [a]);
        break;
      case 'faktura_summa_fel':
      case 'fakturerat_ogiltigt_pass':
        return Object.assign(bas, {
          grupp: 'fakturor', ikon: 'faktura', belopp: a.belopp_ore,
          meta: f ? [familjLänk(f.parent_id), esc('faktura för ' + NXBetalning.periodText(f.period))] : bas.meta,
          knappar: knapp('data-eko-flik', 'fakturor', 'Till Fakturor')
        });
      default:
        if (LÖNELARM.indexOf(a.typ) !== -1) {
          return Object.assign(bas, {
            grupp: 'loner', ton: a.typ === 'utbetalning_misslyckad' ? 'lera' : 'ockra', ikon: 'loner',
            meta: [hjälparLänk(a.studiehjalpare_id), b ? passLänk(b) : (a.datum ? esc(kortDatum(a.datum)) : '')],
            belopp: a.belopp_ore, knappar: länkKnapp('#loner', 'Till Löner')
          });
        }
        if (String(a.typ).indexOf('rut_') === 0) {
          return Object.assign(bas, { knappar: länkKnapp('#system/installningar', 'Inställningar') });
        }
    }
    return Object.assign(bas, { belopp: a.belopp_ore });
  }

  /* En familjs obetalda pass och tillägg, som en rad. */
  function obetaltPost(id, lista) {
    const pass = lista.filter(a => a.typ === 'ej_betalt').length;
    const tillägg = lista.length - pass;
    const delar = [];
    if (pass) delar.push(pass === 1 ? 'ett pass' : pass + ' pass');
    if (tillägg) delar.push(tillägg === 1 ? 'ett tillägg för övertid' : tillägg + ' tillägg för övertid');
    const summa = lista.reduce((n, a) => n + Number(beloppFör(a) || 0), 0);
    const ordnad = lista.slice().sort((x, y) => String(x.datum).localeCompare(String(y.datum)));
    return {
      grupp: 'obetalt', ton: 'ockra', ikon: 'kort', datum: String(ordnad[0].datum || ''),
      rubrik: (id ? namnFör(id) : 'En familj') + ' har inte betalat ' + delar.join(' och '),
      meta: ordnad.map(a => {
        const b = bokning(a.objekt_id);
        return b ? passLänk(b, kortDatum(b.wanted_date) + ' · ' + (b.subject || 'Pass')
          + (a.typ === 'tillagg_obetalt' ? ', övertid' : '')) : esc(kortDatum(a.datum));
      }),
      belopp: summa || null, hur: '',
      knappar: påminnKnapp(id) + (id ? knapp('data-dp', 'familj:' + id, 'Familjen') : ''),
      avv: lista
    };
  }

  /* Fakturapass utan faktura i en månad som är slut, som en rad. */
  function saknasPost(m, lista) {
    const familjer = Array.from(new Set(lista.map(a => a.kund_id || ((bokning(a.objekt_id) || {}).parent_id)).filter(Boolean)));
    const summa = lista.reduce((n, a) => n + Number(a.belopp_ore || 0), 0);
    return {
      grupp: 'fakturor', ton: 'lera', ikon: 'faktura', datum: m,
      rubrik: (lista.length === 1 ? 'Ett fakturapass' : lista.length + ' fakturapass') + ' från '
        + NXStudie.månadsNamn(m, false) + ' har ingen faktura',
      meta: familjer.map(familjLänk),
      belopp: summa || null,
      hur: 'Månadskörningen skapar ett fakturautkast per familj. Kör den torrt först.',
      knappar: knapp('data-eko-korning', m.slice(0, 7), 'Kör månadskörningen', true),
      avv: lista
    };
  }

  function attGöraPoster() {
    const ut = [];
    const avv = S.avvikelser || [];

    (S.tvister || []).filter(väntarPåOss).forEach(x => ut.push(tvistPost(x)));
    (S.fakturor || []).filter(f => f.status === 'utkast').forEach(f =>
      ut.push(utkastPost(f, avv.filter(a => a.typ === 'faktura_gammalt_utkast' && a.objekt_id === f.id))));

    const erbjudna = new Set();
    if (!S.passunderlagFel) utanRapport().forEach(p => kandidater(p).forEach(r => erbjudna.add(r.id)));

    const obetalt = new Map();
    const saknas = new Map();
    avv.forEach(a => {
      if (a.typ === 'faktura_gammalt_utkast') return;
      if (a.typ === 'fristaende_rapport' && erbjudna.has(a.objekt_id)) return;
      if (a.typ === 'ej_betalt' || a.typ === 'tillagg_obetalt') {
        const id = a.kund_id || ((bokning(a.objekt_id) || {}).parent_id) || '';
        if (!obetalt.has(id)) obetalt.set(id, []);
        obetalt.get(id).push(a);
        return;
      }
      if (a.typ === 'faktura_saknas' && a.datum) {
        const m = månadFör(a.datum);
        if (!saknas.has(m)) saknas.set(m, []);
        saknas.get(m).push(a);
        return;
      }
      /* En faktura som förfallit och som inte längre finns i listan
         (borttagen under tiden) har inget att göra på raden. */
      if ((a.typ === 'faktura_forfallen') && !(S.fakturor || []).some(f => f.id === a.objekt_id)) return;
      ut.push(postFörAvvikelse(a));
    });
    obetalt.forEach((lista, id) => ut.push(obetaltPost(id, lista)));
    saknas.forEach((lista, m) => ut.push(saknasPost(m, lista)));

    const utanAvgift = saknarAvstamning().length;
    if (utanAvgift) {
      ut.push({
        grupp: 'ovrigt', ton: 'tyst', ikon: 'kort', datum: '',
        rubrik: utanAvgift + (utanAvgift === 1 ? ' kortbetalning saknar' : ' kortbetalningar saknar') + ' Stripes avgift',
        meta: [], belopp: null,
        hur: 'Avgiften, nettot och om betalningen var skarp behövs i bokslutet. Stripe har dem; knappen hämtar dem.',
        knappar: '<button class="btn btn-ghost btn-sm" type="button" data-avstamning>Hämta från Stripe</button>', avv: []
      });
    }
    return ut;
  }

  /* "Gör till uppgift" för raden, eller att den redan finns. En
     sammanslagen rad skapar en uppgift per avvikelse som saknar en. */
  function uppgiftLänk(avv) {
    if (!avv || !avv.length) return '';
    const öppna = öppnaUppgifter();
    const utan = avv.filter(a => !öppna.has(avvNyckel(a)));
    if (!utan.length) return '<span class="eko-uppg-finns">Uppgift finns</span>';
    return '<button type="button" class="eko-uppg" data-avv-uppgift="'
      + esc(utan.map(a => a.typ + '|' + a.objekt_tabell + '|' + a.objekt_id).join(';')) + '">Gör till uppgift</button>';
  }

  function göraRad(p) {
    const meta = (p.meta || []).filter(Boolean);
    const uppg = uppgiftLänk(p.avv);
    return '<div class="vy-rad eko-gora">'
      + ikonRuta(p.ikon, p.ton)
      + '<span class="vy-rad-mitt">'
      + '<span class="vy-rad-titel">' + esc(p.rubrik) + '</span>'
      + (meta.length ? '<span class="vy-rad-meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</span>' : '')
      + (p.hur ? '<span class="eko-hur">' + esc(p.hur) + '</span>' : '')
      + (uppg ? '<span class="eko-uppg-rad">' + uppg + '</span>' : '')
      + '</span>'
      + '<span class="vy-rad-hoger eko-gora-hoger">'
      + (p.belopp != null ? '<span class="vy-rad-belopp">' + esc(kronor(p.belopp)) + '</span>' : '')
      + (p.knappar ? '<span class="eko-knappar">' + p.knappar + '</span>' : '')
      + '</span></div>';
  }

  function märkEkonomi(antal) {
    const n = antal == null ? attGöraPoster().length : antal;
    märkFlik('#flik-attgora-mark', n);
    /* Fakturor: det som väntar på oss där, utkast att lägga in och
       förfallna. En skickad faktura som inte förfallit väntar på
       familjen. Samma tal som admin_lage räknar för översikten. */
    const f = S.fakturor || [];
    märkFlik('#flik-fakt-mark', f.filter(x => x.status === 'utkast').length
      + f.filter(x => NXBetalning.fakturaLage(x) === 'forfallen').length);
    if (S.sido) S.sido.märke('ekonomi', n);
    return n;
  }

  function ritaAttGöra() {
    const poster = attGöraPoster();
    märkEkonomi(poster.length);
    const host = $('#eko-attgora');
    if (!host) return;

    const fel = [
      S.avvikelserFel ? 'Avvikelserna gick inte att räkna: ' + S.avvikelserFel + '.' : null,
      S.passunderlagFel ? 'Passunderlaget gick inte att läsa: ' + S.passunderlagFel + '.' : null,
      S.tvisterFel ? 'Tvisterna gick inte att läsa: ' + S.tvisterFel + '.' : null
    ].filter(Boolean);
    let h = fel.length ? '<p class="kor-not">' + esc(fel.join(' ') + ' Listan kan sakna saker.') + '</p>' : '';

    if (!poster.length) {
      /* Ett läsfel är inte "inget att göra": då står bara felet. */
      h += fel.length ? '' : '<div class="vy-kort eko-klart"><div class="vy-lista"><div class="vy-rad">'
        + ikonRuta('klar', 'mossa')
        + '<span class="vy-rad-mitt"><span class="vy-rad-titel">Inget väntar på er</span>'
        + '<span class="vy-rad-meta"><span>Alla betalningar går ihop, i alla månader.</span></span></span>'
        + '</div></div></div>';
      host.innerHTML = h;
      return;
    }

    h += '<p class="eko-ingress">' + esc(poster.length + (poster.length === 1 ? ' sak väntar' : ' saker väntar')
      + ' på er, i alla månader. Knappen på raden gör det; datumet och namnen öppnar passet och familjen.') + '</p>';
    GRUPPER.forEach(([nyckel, rubrik, gör, text]) => {
      const lista = poster.filter(p => p.grupp === nyckel)
        .sort((x, y) => String(x.datum || '9').localeCompare(String(y.datum || '9')));
      if (!lista.length) return;
      h += grupp(null, rubrik, lista.length, lista.map(göraRad).join(''), gör, text);
    });
    host.innerHTML = h;
  }

  /* Bokslutets larm i samma ordning som grupperna under Att göra,
     och i datumordning inom varje. */
  const iGruppordning = poster => poster.slice().sort((x, y) =>
    (GRUPPORDNING.indexOf(x.grupp) - GRUPPORDNING.indexOf(y.grupp))
    || String(x.datum || '9').localeCompare(String(y.datum || '9')));

  /* Namnet står kvar för skalet och de andra områdena, som ritar om
     avvikelserna efter att något ändrats (en uppgift, en kontroll).
     Bokslutets larm har samma rader. */
  function ritaAvvikelser() {
    ritaAttGöra();
    if (S.bokslut) ritaBokslut();
  }

  /* ============================================================
     ALLA BETALNINGAR (Fas 12, omgjord 2026-09-29)

     Månadens betalningar, en rad var: passen, tilläggen för övertid
     och köpen av timmar. Förut en tabell med nio kolumner där läget
     stod som grå text längst till höger, efter knapparna, och där en
     telefon bara visade de tre första kolumnerna.

     Varje rad får ett läge med färg (ert drag, familjens drag, klart),
     och hör till ett eller flera filter. Talen överst är summor av
     raderna, räknade med samma gränser som bokslutet: kortbetalningar
     på passets månad, testbetalningar aldrig. Köpta timmar räknas på
     dagen de betalades, som på Månadens ekonomi.

     Beloppet är FRYST vid betalningen och läses bara här. Ingen
     rullgardin ändrar ett läge i listan: en betalnings läge sätts av
     Stripe genom webhooken, och att kunna skriva om det för hand hade
     gjort siffran till en åsikt.

     Ingen kolumn för studiehjälparens del, med flit. Hela beloppet går
     till Nextrum, och hjälparens ersättning står under Löner — den
     räknas den 25:e ur rapporterna, inte här.
     ============================================================ */
  const BET_FILTER = [
    ['alla', 'Alla'], ['attbetala', 'Inte betalda'], ['kommande', 'Kommande'], ['betalda', 'Betalda'],
    ['tillbaka', 'Tillbaka'], ['tvist', 'Tvist'], ['undantagna', 'Undantagna'], ['test', 'Test']
  ];
  let betFilter = 'alla';

  /* Katalogen är reserven för pass som bokades innan priset började
     frysas (Fas 19.5). Den laddas en gång; tills den finns står ett
     sådant pass utan belopp, och listan ritas om när den kommer. */
  let katalogen = null;
  function laddaKatalogen() {
    if (katalogen || typeof NXTjanster === 'undefined') return;
    katalogen = NXTjanster.ladda().then(() => { ritaBetalningslistan(); ritaFakturor(); }, () => {});
  }

  /* Raderna läses också av Månadens ekonomi (betalningsrader nedan),
     som räknar pengarna på dem i stället för på sitt eget sätt. Därför
     bär en rad familjen, passet, minuterna och om passet räknas: ett
     pass som är bekräftat eller genomfört, inte undantaget och inte
     betalt med testkort. Påminn står för sig, så att familjens rad där
     kan ha knappen en gång i stället för på varje pass. */
  function nyRad(o) {
    return Object.assign({
      filter: new Set(), meta: [], knappar: '', påminn: '', under: '', belopp: null, beloppText: null, sätt: '',
      in: 0, attFåIn: 0, kommande: 0, tillbaka: 0, attÅterbetala: 0, avgift: 0, oanvänt: 0, test: false, sök: '',
      parent: null, booking: null, min: 0, räknas: false, fakturaläge: null
    }, o);
  }

  function passRad(b, u, fakt, tvist, förLänge, larmad) {
    const st = b.betalning_status || 'ingen';
    const elev = elevNamn(b.student_id);
    const r = nyRad({
      typ: 'pass', datum: b.wanted_date, tid: String(b.wanted_time || '').slice(0, 5), dp: 'pass:' + b.id,
      titel: [b.subject || 'Pass', elev && elev !== '—' ? elev : null].filter(Boolean).join(' · '),
      meta: [familjLänk(b.parent_id), b.tutor_id ? esc(namnFör(b.tutor_id)) : ''],
      sök: [b.subject, elev, namnFör(b.parent_id), namnFör(b.tutor_id)].join(' '),
      parent: b.parent_id, booking: b.id,
      /* Den hållna tiden för ett genomfört pass, annars den bokade. */
      min: b.status === 'completed' ? Number((u && u.debiterade_min) || b.duration_min || 60) : Number(b.duration_min || 60)
    });
    const betalt = Number(b.betalt_ore || 0), åter = Number(b.aterbetald_ore || 0), kvar = betalt - åter;
    r.test = b.stripe_skarp === false;
    if (r.test) r.filter.add('test');
    r.räknas = b.status !== 'cancelled' && b.fakturerbar !== false && !r.test;
    /* Samma minuter som familjens vy och kassan: ett genomfört pass
       kostar den hållna tiden minus övertiden timbanken tog. */
    const minuter = b.status === 'completed'
      ? Number((u && u.debiterade_min) || b.duration_min || 60) - Number((u && u.timbank_min) || 0)
      : Number(b.duration_min || 60);
    const pris = () => NXBetalning.passpris(b, u, minuter);

    const kort = () => {
      r.sätt = 'Kort';
      r.belopp = betalt;
      if (!r.test) { r.in = kvar; r.tillbaka = åter; r.avgift = Number(b.stripe_avgift_ore || 0); }
      r.under = åter > 0 ? '−' + kronor(åter) + ' tillbaka'
        : b.stripe_avgift_ore != null ? 'avgift ' + kronor(b.stripe_avgift_ore)
        : b.stripe_charge_id ? 'avgift inte hämtad' : '';
      if (åter > 0) r.filter.add('tillbaka');
    };
    /* Inte i tvist: stripe-aterbetalning nekar den (2026-09-29). */
    const återKnapp = () => st === 'betald' && kvar > 0 ? knapp('data-aterbetala', b.id, 'Återbetala') : '';
    const tvistLäge = () => {
      r.filter.add('tvist');
      const l = tvist ? (TVIST_LAGE[tvist.lage] || [tvist.lage, 'ar-ny']) : ['Tvist', 'ar-ny'];
      r.läge = l;
      if (tvist && väntarPåOss(tvist) && tvist.svara_senast) {
        r.meta.push('<b>' + esc('svara senast ' + kortDatum(tvist.svara_senast)) + '</b>');
      }
      r.knappar = tvist ? stripeLänk(tvist, väntarPåOss(tvist)) : '';
    };

    if (b.status === 'cancelled') {
      kort();
      r.meta.push(esc('avbokat'));
      if (st === 'tvist') tvistLäge();
      else if (kvar > 0) {
        r.läge = ['Avbokat men betalt', 'ar-ny'];
        if (!r.test) r.attÅterbetala = kvar;
        r.filter.add('tillbaka');
        r.knappar = återKnapp();
      } else r.läge = ['Avbokat, återbetalt', ''];
      return r;
    }

    if (b.fakturerbar === false) {
      r.filter.add('undantagna');
      r.meta.push(esc('undantaget' + (u && u.fakturerbar_anledning ? ': ' + u.fakturerbar_anledning : '')));
      if (kvar > 0 && st !== 'tvist') {
        kort();
        r.läge = ['Undantaget men betalt', 'ar-ny'];
        if (!r.test) r.attÅterbetala = kvar;
        r.filter.add('tillbaka');
        r.knappar = återKnapp();
      } else {
        r.läge = ['Undantaget', ''];
        r.knappar = u ? knapp('data-avv-ateruppta', b.id, 'Ta med igen') : '';
      }
      return r;
    }

    /* Köpta timmar och timbanken är betalda med pengar som kom in när
       timmarna köptes. De är betalda, men de är inga pengar i månaden. */
    if (b.klippkort_id && (st === 'betald' || st === 'tvist')) {
      r.sätt = 'Köpta timmar';
      r.beloppText = tim(b.duration_min || 60);
      r.läge = ['Betalt med timmar', 'ar-klar'];
      r.filter.add('betalda');
      return r;
    }
    if (S.timbankPass && S.timbankPass.has(b.id) && st === 'betald') {
      r.sätt = 'Timbanken';
      r.beloppText = tim(b.duration_min || 60);
      r.läge = ['Betalt ur timbanken', 'ar-klar'];
      r.filter.add('betalda');
      return r;
    }

    switch (st) {
      case 'betald':
        kort();
        if (förLänge > 0) {
          r.läge = ['Del ska tillbaka', 'ar-ny'];
          r.under = kronor(förLänge) + ' ska tillbaka';
          if (!r.test) r.attÅterbetala = förLänge;
          r.filter.add('tillbaka');
        } else r.läge = r.test ? ['Testbetalning', ''] : ['Betalt', 'ar-klar'];
        if (!r.test) r.filter.add('betalda');
        r.knappar = återKnapp();
        return r;
      case 'tvist':
        kort();
        tvistLäge();
        return r;
      case 'aterbetald':
        kort();
        r.läge = ['Återbetalt', ''];
        r.filter.add('tillbaka');
        return r;
      case 'faktura': {
        r.sätt = 'Faktura';
        if (fakt) {
          const fl = NXBetalning.fakturaLage(fakt.f);
          r.fakturaläge = fl;
          r.belopp = Number(fakt.rad.belopp_ore || 0);
          r.under = 'faktura ' + (fakt.f.fortnox_fakturanummer || NXBetalning.periodText(fakt.f.period));
          if (fl === 'betald') { r.läge = ['Fakturan betald', 'ar-klar']; r.in = r.belopp; r.filter.add('betalda'); }
          else if (fl === 'makulerad') { r.läge = ['Fakturan makulerad', '']; }
          else {
            r.läge = fl === 'forfallen' ? ['Fakturan förfallen', 'ar-ny']
              : fl === 'skickad' ? ['Fakturerad', 'ar-vantar'] : ['Inte i Fortnox än', 'ar-ny'];
            r.attFåIn = r.belopp;
            r.filter.add('attbetala');
          }
          return r;
        }
        const p = pris();
        r.belopp = p;
        r.fakturaläge = 'saknas';
        const nästa = NXStudie.månadsGräns(månadFör(b.wanted_date)).till;
        const slut = isoFor(new Date()) >= nästa;
        r.läge = slut ? ['Ingen faktura än', 'ar-ny'] : ['Faktureras i ' + NXStudie.månadsNamn(nästa, false), 'ar-vantar'];
        r.under = p == null ? 'pris saknas' : 'på nästa faktura';
        if (b.status === 'completed') { r.attFåIn = p || 0; r.filter.add('attbetala'); }
        return r;
      }
      default: {
        /* ingen, vantar eller misslyckad: samma tre lägen som avvikelsen
           ej_betalt och OBETALDA_LAGEN i _delad/pris.ts. */
        r.sätt = st === 'ingen' ? '' : 'Kort';
        const p = pris();
        r.belopp = st !== 'ingen' && b.begart_ore ? Number(b.begart_ore) : p;
        /* Ett pass på noll kronor är inte obetalt (Fas 19.5). */
        if (st === 'ingen' && p === 0) { r.läge = ['Första timmen bjuden', '']; r.belopp = 0; return r; }
        if (r.belopp == null) r.under = 'pris saknas';
        else if (st !== 'ingen') r.under = 'begärt';
        if (b.status === 'completed') {
          r.läge = st === 'vantar' ? ['Kassan öppnad', 'ar-ny'] : st === 'misslyckad' ? ['Kortet nekades', 'ar-ny']
            : ['Inte betalt', 'ar-ny'];
          r.attFåIn = r.belopp || 0;
          r.filter.add('attbetala');
          if (larmad) r.påminn = påminnKnapp(b.parent_id);
        } else {
          r.läge = st === 'vantar' ? ['Kassan öppnad', 'ar-vantar'] : st === 'misslyckad' ? ['Kortet nekades', 'ar-vantar']
            : ['Inte betalt än', ''];
          r.kommande = r.belopp || 0;
          r.filter.add('kommande');
        }
        return r;
      }
    }
  }

  /* TILLÄGGEN (Fas 20.1). Ett pass som var betalt och drog över betalas
     med ett tillägg för övertiden, med kort, när familjen bekräftar
     rapporten. Tillägget är en egen betalning i pass_tillagg och skrivs
     bara av stripe-checkout och stripe-webhook. Det står på passets
     datum, som passet. */
  function tilläggRad(t, b, larmad) {
    const r = nyRad({
      typ: 'tillagg', datum: b.wanted_date, tid: String(b.wanted_time || '').slice(0, 5), dp: 'pass:' + b.id,
      titel: 'Tillägg för ' + t.minuter + ' min övertid',
      meta: [familjLänk(b.parent_id), esc('passet ' + kortDatum(b.wanted_date) + ', ' + (b.subject || 'pass'))],
      sätt: 'Kort', sök: [namnFör(b.parent_id), b.subject, 'tillägg övertid'].join(' '),
      parent: b.parent_id, booking: b.id
    });
    r.test = t.stripe_skarp === false;
    if (r.test) r.filter.add('test');
    const betalt = Number(t.betalt_ore || 0), åter = Number(t.aterbetald_ore || 0);
    r.belopp = t.betalt_ore != null ? betalt : Number(t.begart_ore || 0);
    r.läge = TILLAGG_LAGE[t.status] || [t.status, ''];
    if (t.status === 'betald' || t.status === 'aterbetald' || t.status === 'tvist') {
      if (!r.test) { r.in = betalt - åter; r.tillbaka = åter; }
      if (t.status === 'betald' && !r.test) r.filter.add('betalda');
      if (t.status === 'tvist') r.filter.add('tvist');
      if (åter > 0) { r.filter.add('tillbaka'); r.under = '−' + kronor(åter) + ' tillbaka'; }
    } else {
      r.under = 'begärt';
      r.attFåIn = r.belopp;
      r.filter.add('attbetala');
      if (larmad) r.påminn = påminnKnapp(b.parent_id);
    }
    return r;
  }

  /* KÖPTA TIMMAR (Fas 16.1), på dagen de betalades. Pengarna kom in i
     månaden, men timmarna är familjens tills de använts. Ett köp som
     aldrig betalades är en kassa som stängdes, inte ett köp. */
  const KK_LAGE = {
    vantar: ['Obetalt', 'ar-vantar'], betald: ['Betalt', 'ar-klar'], misslyckad: ['Misslyckades', 'ar-ny'],
    aterbetald: ['Återbetalt', ''], tvist: ['Tvist', 'ar-ny']
  };

  function köpRad(k) {
    const r = nyRad({
      typ: 'kop', datum: isoFor(new Date(k.betald_at)), tid: '', dp: 'familj:' + k.parent_id,
      titel: k.namn || 'Köpta timmar',
      meta: [familjLänk(k.parent_id), esc(k.kvar + ' av ' + k.timmar + ' timmar kvar')],
      sätt: 'Kort', sök: [namnFör(k.parent_id), k.namn, 'klippkort plan timmar'].join(' '),
      parent: k.parent_id
    });
    r.test = !!(S.klippkortTest && S.klippkortTest.has(k.id));
    if (r.test) r.filter.add('test');
    const betalt = Number(k.betalt_ore || 0), åter = Number(k.aterbetald_ore || 0);
    r.belopp = betalt;
    r.läge = r.test && k.status === 'betald' ? ['Testköp', ''] : (KK_LAGE[k.status] || [k.status, '']);
    if (!r.test) { r.in = betalt - åter; r.tillbaka = åter; }
    /* Det som betalats för timmar som inte använts än, till köpets eget
       timpris. Pengarna har kommit in, men de är familjens tills
       timmarna använts: Månadens ekonomi säger det bredvid summan. */
    if (!r.test && Number(k.timmar) > 0) {
      r.oanvänt = Math.round(r.in * Math.max(Number(k.kvar || 0), 0) / Number(k.timmar));
    }
    if (k.status === 'betald' && !r.test) r.filter.add('betalda');
    if (k.status === 'tvist') r.filter.add('tvist');
    if (åter > 0) { r.filter.add('tillbaka'); r.under = '−' + kronor(åter) + ' tillbaka'; }
    return r;
  }

  /* Månadens betalningar. Utan månad den som är vald här; Månadens
     ekonomi skickar sin egen och räknar sina pengar på samma rader, så
     att samma månad aldrig har två belopp på två sidor. */
  function betalningsrader(månad) {
    const g = NXStudie.månadsGräns(månad || valdMånad());
    const iMånaden = datum => {
      if (!datum) return false;
      const d = String(datum).slice(0, 10);
      return d >= g.från && d < g.till;
    };
    const pu = new Map((S.passunderlag || []).map(p => [p.id, p]));
    const påFaktura = new Map();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => {
      if (l.booking_id) påFaktura.set(l.booking_id, { f, rad: l });
    }));
    /* Den öppna tvisten före en stängd, och den senaste av två. */
    const tvister = new Map();
    (S.tvister || []).forEach(x => {
      if (!x.booking_id) return;
      const förr = tvister.get(x.booking_id);
      if (!förr || (!x.stangd && förr.stangd)
          || (!!x.stangd === !!förr.stangd && String(x.skapad) > String(förr.skapad))) tvister.set(x.booking_id, x);
    });
    const förLänge = new Map();
    const larmade = new Set();
    (S.avvikelser || []).forEach(a => {
      if (a.objekt_tabell !== 'bookings') return;
      if (a.typ === 'betalt_for_lange' && a.belopp_ore > 0) förLänge.set(a.objekt_id, Number(a.belopp_ore));
      if (a.typ === 'ej_betalt' || a.typ === 'tillagg_obetalt') larmade.add(a.typ + ':' + a.objekt_id);
    });

    const rader = [];
    (S.bokningar || []).forEach(b => {
      if (!iMånaden(b.wanted_date)) return;
      /* Ett avbokat pass hör hit bara om det har pengar på sig. Ett
         förslag är inget pass än. */
      const pengar = b.betalt_ore != null || ['betald', 'tvist', 'aterbetald'].indexOf(b.betalning_status) !== -1;
      if (b.status === 'cancelled' ? !pengar : (b.status !== 'confirmed' && b.status !== 'completed')) return;
      rader.push(passRad(b, pu.get(b.id) || null, påFaktura.get(b.id) || null, tvister.get(b.id) || null,
        förLänge.get(b.id) || 0, larmade.has('ej_betalt:' + b.id)));
    });
    (S.tillagg || []).forEach(t => {
      const b = bokning(t.booking_id);
      if (b && iMånaden(b.wanted_date)) rader.push(tilläggRad(t, b, larmade.has('tillagg_obetalt:' + b.id)));
    });
    (S.klippkort || []).forEach(k => {
      if (['betald', 'aterbetald', 'tvist'].indexOf(k.status) === -1 || !k.betald_at) return;
      if (iMånaden(isoFor(new Date(k.betald_at)))) rader.push(köpRad(k));
    });
    return rader.sort((a, b) => (String(b.datum) + (b.tid || '')).localeCompare(String(a.datum) + (a.tid || '')));
  }

  /* o.utanFamilj och o.utanPåminn: under familjens egen rad i Månadens
     ekonomi står namnet och Påminn redan en gång. */
  function betRad(r, o) {
    o = o || {};
    const familj = o.utanFamilj ? familjLänk(r.parent) : null;
    const meta = r.meta.filter(m => m && m !== familj).concat(r.sätt ? [esc(r.sätt)] : []);
    const belopp = r.beloppText != null ? r.beloppText : r.belopp != null ? kronor(r.belopp) : '—';
    return '<div class="eko-rad">'
      + dagRuta(r.datum)
      + '<span class="eko-mitt">'
      + '<button type="button" class="eko-titel" data-dp="' + esc(r.dp) + '">' + esc(r.titel) + '</button>'
      + (meta.length ? '<span class="eko-meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</span>' : '')
      + '</span>'
      + '<span class="eko-atg">' + (r.knappar || '') + (o.utanPåminn ? '' : r.påminn || '') + '</span>'
      + '<span class="eko-lage">' + pill(r.läge[0], r.läge[1])
      + (r.test && !/^test/i.test(r.läge[0]) ? ' ' + pill('Test', '') : '') + '</span>'
      + '<span class="eko-belopp"><b>' + esc(belopp) + '</b>'
      + (r.under ? '<small>' + esc(r.under) + '</small>' : '') + '</span>'
      + '</div>';
  }

  function ritaBetalningslistan() {
    const host = $('#bet-lista');
    if (!host) return;
    /* En reserv från ett chip gäller inte en ny månad eller en ny rad. */
    NXStudie.släppLista(host);
    laddaKatalogen();
    const alla = betalningsrader();
    const räkna = { alla: alla.length };
    alla.forEach(r => r.filter.forEach(k => { räkna[k] = (räkna[k] || 0) + 1; }));
    const sum = fält => alla.reduce((n, r) => n + Number(r[fält] || 0), 0);

    const inbetalt = sum('in'), attFåIn = sum('attFåIn'), kommande = sum('kommande');
    const tillbaka = sum('tillbaka'), attÅter = sum('attÅterbetala'), avgift = sum('avgift');
    const antalIn = alla.filter(r => r.in > 0).length;
    const sam = $('#bet-sam');
    if (sam) {
      sam.innerHTML = samKort('Inbetalt', kronor(inbetalt), antalIn + (antalIn === 1 ? ' betalning' : ' betalningar')
          + (avgift ? ' · Stripe tog ' + kronor(avgift) : ''))
        + samKort('Att få in', kronor(attFåIn), räkna.attbetala
          ? räkna.attbetala + ' väntar på betalning, för det som har hållits'
          : 'inget som har hållits väntar', attFåIn > 0)
        + samKort('Kommande', kronor(kommande), räkna.kommande
          ? räkna.kommande + (räkna.kommande === 1 ? ' bokat pass, inte betalt än' : ' bokade pass, inte betalda än')
          : 'inga obetalda pass framåt')
        + samKort('Tillbaka till familjer', kronor(tillbaka), attÅter ? kronor(attÅter) + ' ska tillbaka'
          : 'inget som väntar', attÅter > 0);
    }

    /* Ett filter utan rader göms, utom det som är valt: annars hade
       raden bytt form under fingret när det sista försvann. */
    const chips = $('#bet-chips');
    if (chips) {
      chips.innerHTML = BET_FILTER.filter(([k]) => k === 'alla' || k === betFilter || räkna[k] > 0)
        .map(([k, t]) => '<button type="button" class="chip" data-bet-filter="' + k + '" aria-pressed="'
          + (k === betFilter) + '">' + esc(t) + ' <span class="eko-chip-tal">' + (räkna[k] || 0) + '</span></button>')
        .join('');
    }

    const sök = String(($('#kort-sok') || {}).value || '').trim().toLowerCase();
    const rader = alla.filter(r => (betFilter === 'alla' || r.filter.has(betFilter))
      && (!sök || (r.titel + ' ' + r.sök + ' ' + r.läge[0] + ' ' + r.sätt).toLowerCase().indexOf(sök) !== -1));

    host.innerHTML = rader.length ? rader.map(r => betRad(r)).join('')
      : tomt(alla.length ? 'Inga betalningar matchar' : 'Inga betalningar i ' + månadText(),
        alla.length ? 'Ändra sökningen eller välj Alla.' : 'Pass som bokas, betalas eller köps i månaden står här.');

    const fot = $('#bet-fot');
    if (fot) {
      fot.textContent = (rader.length !== alla.length ? 'Visar ' + rader.length + ' av ' + alla.length + '. ' : '')
        + 'Passen står på passets datum och köpta timmar på dagen de betalades. Testbetalningar räknas aldrig in i talen. '
        + 'Återbetala skickar pengarna tillbaka till kortet; Stripes avgift kommer inte tillbaka. Studiehjälparnas lön står under Löner.';
    }
  }

  /* Ett chip eller söket kan göra listan mycket kortare, och chippet
     flyttade sig då 146 till 215 px under fingret (NXStudie.hållLista).
     Ankaret är chipraden och sökfältet, inte chippet: chippen ritas om
     med listan. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-bet-filter]');
    if (!k) return;
    betFilter = k.dataset.betFilter;
    NXStudie.hållLista($('#bet-lista'), $('#bet-chips'), ritaBetalningslistan);
  });
  document.addEventListener('input', e => {
    if (!e.target) return;
    if (e.target.id === 'kort-sok') NXStudie.hållLista($('#bet-lista'), e.target, ritaBetalningslistan);
    if (e.target.id === 'fakt-sok') NXStudie.hållLista($('#fakt-lista'), e.target, ritaFakturor);
  });

  /* Skalet ritar om efter en återbetalning och en körning. Namnet är
     det gamla, för skalet anropar det. */
  function ritaKortbetalningar() {
    ritaBetalningslistan();
    ritaTimmar();
    ritaInställningar();
  }

  /* Underlagen till studiehjälparna står under Löner sedan 2026-09-29,
     som redan hade samma rader och samma knappar. Namnet står kvar för
     skalet, som ritar om efter att ett underlags läge ändrats; Löner
     ritas om av laddaOmEkonomi. */
  function ritaUtbetalningar() {
    ritaAttGöra();
  }

  /* ============================================================
     FAKTUROR (Fas 14.6, omgjord 2026-09-29)

     Familjen kan välja faktura på ett pass. Månadskörningen samlar
     varje familjs fakturapass på ett utkast. Fakturan skapas och
     skickas sedan i FORTNOX, som också bokför den. Härifrån skickas
     ingenting: utkastet läggs in i Fortnox för hand, med underlaget,
     och fakturanumret, OCR och förfallodagen skrivs tillbaka. Betald
     markeras när betalningen syns i Fortnox.

     Fliken är flödet, inte en månad: Att skapa, Lägg in i Fortnox, Hos
     familjen, Betalda. Förut filtrerades fakturorna på sin period, och
     i september, när augustis utkast skulle läggas in, var listan tom
     tills någon kom på att välja augusti.

     En API-koppling till Fortnox finns inte, med flit. Fortnox har ett
     dokumenterat API, så kopplingen går att bygga senare, men den
     byggs först när handarbetet faktiskt kostar tid: en koppling mot
     bokföringen som går sönder tyst är värre än ingen.

     Beloppen går inte att ändra härifrån. De räknades av fakturering
     ur passen, med samma pris som kortet tar, och las_fakturabelopp
     vägrar skriva om dem från en webbläsare.
     ============================================================ */
  const passPåFaktura = () => {
    const s = new Set();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => { if (l.booking_id) s.add(l.booking_id); }));
    return s;
  };

  function fakturaRad(x) {
    const f = x.f;
    const l = FAKT_LAGE[x.läge] || [f.status, ''];
    const meta = [
      esc((f.invoice_lines || []).length + ' pass'),
      f.fortnox_fakturanummer ? esc('nr ' + f.fortnox_fakturanummer) : '',
      f.ocr ? esc('OCR ' + f.ocr) : '',
      x.läge === 'utkast' && f.created_at ? esc('skapad ' + lokalDag(f.created_at)) : '',
      x.läge === 'betald' && f.betald_at ? esc('betald ' + lokalDag(f.betald_at)) : ''
    ].filter(Boolean);
    /* Nästa steg för just den här fakturan, och bara det. Skickad utan
       fakturanumret i Fortnox och förfallodag är en rad ingen kan följa
       upp i Fortnox, därför ingen rullgardin. */
    const k = [knapp('data-fakt-underlag', f.id, 'Underlag')];
    if (f.status === 'utkast') {
      k.push(knapp('data-fakt-bort', f.id, 'Ta bort'));
      k.push(knapp('data-fakt-fortnox', f.id, 'Lagd i Fortnox', true));
    } else if (f.status === 'skickad' || f.status === 'forfallen') {
      k.push(knapp('data-fakt-makulera', f.id, 'Makulera'));
      if (x.läge === 'forfallen') k.push(påminnKnapp(f.parent_id, ' data-eko-faktura="' + esc(f.id) + '"'));
      k.push(knapp('data-fakt-betald', f.id, 'Betald', true));
    }
    const under = x.läge === 'forfallen' ? 'förföll ' + kortDatum(f.forfaller)
      : x.läge === 'skickad' && f.forfaller ? 'förfaller ' + kortDatum(f.forfaller) : '';
    return '<div class="eko-rad">' + periodRuta(f.period)
      + '<span class="eko-mitt"><button type="button" class="eko-titel" data-dp="familj:' + esc(f.parent_id) + '">'
      + esc(x.familj) + '</button>'
      + '<span class="eko-meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</span></span>'
      + '<span class="eko-atg">' + k.join('') + '</span>'
      + '<span class="eko-lage">' + pill(l[0], l[1]) + '</span>'
      + '<span class="eko-belopp"><b>' + esc(kronor(f.belopp_ore)) + '</b>'
      + (under ? '<small>' + esc(under) + '</small>' : '') + '</span></div>';
  }

  function ritaFakturor() {
    const host = $('#fakt-lista');
    if (!host) return;
    NXStudie.släppLista(host);
    märkEkonomi();
    const sök = String(($('#fakt-sok') || {}).value || '').trim();
    const flagga = S.fakturaFlagga;
    const pu = new Map((S.passunderlag || []).map(p => [p.id, p]));

    /* Att skapa: hållna fakturapass som inte står på någon faktura, per
       månad. En månad som pågår faktureras i början av nästa, och har
       ingen knapp: en körning mitt i månaden tar bara det som hunnit
       hållas. */
    const på = passPåFaktura();
    const väntar = (S.bokningar || []).filter(b => b.betalning_status === 'faktura' && b.status === 'completed'
      && b.fakturerbar !== false && !på.has(b.id)
      && (!sök || matchar({ familj: namnFör(b.parent_id) }, ['familj'], sök)));
    const perMånad = new Map();
    väntar.forEach(b => {
      const m = månadFör(b.wanted_date);
      if (!perMånad.has(m)) perMånad.set(m, []);
      perMånad.get(m).push(b);
    });
    const idag = isoFor(new Date());
    const attSkapa = Array.from(perMånad.keys()).sort().map(m => {
      const lista = perMånad.get(m);
      const nästa = NXStudie.månadsGräns(m).till;
      const slut = idag >= nästa;
      let summa = 0, okända = 0;
      lista.forEach(b => {
        const u = pu.get(b.id) || null;
        const min = Number((u && u.debiterade_min) || b.duration_min || 60) - Number((u && u.timbank_min) || 0);
        const p = NXBetalning.passpris(b, u, min);
        if (p == null) okända++; else summa += p;
      });
      const familjer = Array.from(new Set(lista.map(b => b.parent_id)));
      return { slut, html: '<div class="eko-rad">' + periodRuta(m)
        + '<span class="eko-mitt"><span class="eko-titel">' + esc((lista.length === 1 ? 'Ett fakturapass' : lista.length + ' fakturapass')
          + ' utan faktura') + '</span>'
        + '<span class="eko-meta">' + familjer.map(id => '<span>' + familjLänk(id) + '</span>').join('') + '</span></span>'
        + '<span class="eko-atg">' + (slut ? knapp('data-eko-korning', m.slice(0, 7), 'Kör månadskörningen', true) : '') + '</span>'
        + '<span class="eko-lage">' + (slut ? pill('Ingen faktura än', 'ar-ny')
          : pill('Faktureras 1 ' + NXStudie.månadsNamn(nästa, false), 'ar-vantar')) + '</span>'
        + '<span class="eko-belopp"><b>' + esc(kronor(summa)) + '</b>'
        + (okända ? '<small>' + esc(okända + ' utan pris') + '</small>' : '') + '</span></div>' };
    });

    const alla = (S.fakturor || []).map(f => ({ f, läge: NXBetalning.fakturaLage(f), familj: namnFör(f.parent_id),
      nr: f.fortnox_fakturanummer || '' })).filter(x => matchar(x, ['familj', 'nr'], sök));
    const tid = (x, fält) => String(x.f[fält] || '');
    const utkast = alla.filter(x => x.läge === 'utkast').sort((a, b) => tid(a, 'created_at').localeCompare(tid(b, 'created_at')));
    const ute = alla.filter(x => x.läge === 'skickad' || x.läge === 'forfallen')
      .sort((a, b) => ((a.läge === 'forfallen' ? 0 : 1) - (b.läge === 'forfallen' ? 0 : 1))
        || tid(a, 'forfaller').localeCompare(tid(b, 'forfaller')));
    const betalda = alla.filter(x => x.läge === 'betald').sort((a, b) => tid(b, 'betald_at').localeCompare(tid(a, 'betald_at')));
    const makulerade = alla.filter(x => x.läge === 'makulerad');
    const förfallna = ute.filter(x => x.läge === 'forfallen').length;
    const skapaNu = attSkapa.filter(x => x.slut).length;

    /* Flödet överst: fyra steg med antal, och vems drag det är. */
    const steg = (id, tal, rubrik, under, ton) => '<li class="' + (tal ? ton : 'ar-tom') + '">'
      + '<button type="button" data-eko-till="' + id + '"' + (tal ? '' : ' disabled') + '>'
      + '<b>' + tal + '</b><span>' + esc(rubrik) + '</span><small>' + esc(under) + '</small></button></li>';
    const flöde = $('#fakt-steg');
    if (flöde) {
      flöde.innerHTML = steg('fakt-skapa', väntar.length, 'Att skapa', skapaNu ? 'kör månadskörningen' : 'fakturapass', skapaNu ? 'ar-gor' : 'ar-vantar')
        + steg('fakt-utkast', utkast.length, 'Lägg in i Fortnox', 'utkast', 'ar-gor')
        + steg('fakt-ute', ute.length, 'Hos familjen', förfallna ? förfallna + ' förfallna' : 'väntar på betalning', förfallna ? 'ar-gor' : 'ar-vantar')
        + steg('fakt-betalda', betalda.length, 'Betalda', betalda.length ? 'senast ' + lokalDag(betalda[0].f.betald_at) : 'inga än', 'ar-klar');
    }

    let h = '';
    if (flagga && !flagga.aktiv) {
      h += '<p class="kor-not">Faktura är avstängt: familjerna kan inte välja faktura på nya pass. '
        + 'Pass som redan valts för faktura faktureras ändå. Strömbrytaren står under '
        + '<button type="button" class="eko-lank" data-eko-flik="installningar">Inställningar</button>.</p>';
    }
    if (attSkapa.length) h += grupp('fakt-skapa', 'Att skapa', väntar.length, attSkapa.map(x => x.html).join(''), skapaNu > 0);
    if (utkast.length) h += grupp('fakt-utkast', 'Lägg in i Fortnox', utkast.length, utkast.map(fakturaRad).join(''), true);
    if (ute.length) h += grupp('fakt-ute', 'Hos familjen', ute.length, ute.map(fakturaRad).join(''), förfallna > 0);
    if (betalda.length) {
      const visa = betalda.slice(0, 10);
      h += grupp('fakt-betalda', 'Betalda', betalda.length, visa.map(fakturaRad).join('')
        + (betalda.length > visa.length ? '<details class="eko-mer-rader"><summary>Visa '
          + (betalda.length - visa.length) + ' äldre</summary>' + betalda.slice(10).map(fakturaRad).join('') + '</details>' : ''));
    }
    if (makulerade.length) {
      h += '<details class="eko-mer"><summary>Makulerade fakturor (' + makulerade.length + ')</summary>'
        + '<div class="vy-kort"><div class="vy-lista">' + makulerade.map(fakturaRad).join('') + '</div></div></details>';
    }
    if (!h || (!attSkapa.length && !utkast.length && !ute.length && !betalda.length && !makulerade.length)) {
      h += '<div class="vy-kort"><div class="vy-lista">' + (sök
        ? tomt('Inga fakturor matchar', 'Sök på familjens namn eller fakturanumret i Fortnox.')
        : tomt('Inga fakturor än', 'Familjen väljer faktura när de bekräftar rapporten, och passen samlas på en faktura i början av nästa månad.'))
        + '</div></div>';
    }
    host.innerHTML = h;
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
      ...rader.map(r => r.beskrivning + '  ·  ' + tim(r.minuter) + ' à '
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
        /* Läget läses tillbaka i stället för att antas. En uppdatering
           som RLS nekar ger inget fel, bara noll rader. */
        const { data } = await supa.from('flaggor').select('*').eq('kod', 'faktura').maybeSingle();
        if (data) S.fakturaFlagga = data;
        ritaInställningar();
        ritaFakturor();
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

  /* ============================================================
     PÅMINN (2026-09-29)

     Ett pass som hållits utan betalning larmar direkt (ej_betalt), utan
     frist: Leo valde det, och det är en människa som följer upp.
     Påminn skriver uppföljningen: ett utkast i ert eget mejlprogram,
     med er adress som avsändare, som kontaktaRuta gör för anmälningar
     och ansökningar. Servern skickar ingenting, och utkastet går att
     ändra innan det skickas.

     Texten säger vad som inte är betalt, med beloppen ur larmen (samma
     pris som kortet tar), och var familjen betalar: passets egen sida
     när det är ett pass, annars Bekräfta rapport. Faktura nämns bara
     när familjen faktiskt kan välja den. Ingen avgift, för villkoren
     nämner ingen, och ingen sista dag, för villkoren sätter ingen.
     ============================================================ */
  function ämneIText(s) {
    const t = String(s || '').trim();
    if (!t) return 'passet';
    return /^[A-ZÅÄÖ]{2,}$/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
  }
  const förnamn = id => String((S.personer[id] || {}).full_name || '').trim().split(/\s+/)[0] || '';
  const vyAdress = () => location.origin + '/foralder';

  function brevOmPass(id) {
    const lista = (S.avvikelser || []).filter(a => (a.typ === 'ej_betalt' || a.typ === 'tillagg_obetalt')
      && (a.kund_id === id || (bokning(a.objekt_id) || {}).parent_id === id))
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
    const rad = a => {
      const b = bokning(a.objekt_id) || {};
      const belopp = beloppFör(a);
      return kortDatum(b.wanted_date || a.datum) + ', '
        + (a.typ === 'tillagg_obetalt' ? 'övertid på passet i ' : '') + ämneIText(b.subject)
        + (belopp != null ? ': ' + kronor(belopp) : '');
    };
    /* Faktura bara när familjen kan välja den och det finns ett pass att
       välja den på: ett tillägg för övertid betalas med kort (Fas 20.1). */
    const faktura = !!(S.fakturaFlagga && S.fakturaFlagga.aktiv) && !(S.fakturaSparr && S.fakturaSparr.has(id))
      && lista.some(a => a.typ === 'ej_betalt');
    const sätt = faktura ? 'med kort eller genom att välja faktura' : 'med kort';
    const ettPass = lista.length === 1 && lista[0].typ === 'ej_betalt';
    let mitt;
    if (!lista.length) {
      mitt = '\n\n';
    } else if (ettPass) {
      const b = bokning(lista[0].objekt_id) || {};
      const belopp = beloppFör(lista[0]);
      mitt = 'Passet i ' + ämneIText(b.subject) + ' den ' + kortDatum(b.wanted_date) + ' har hållits, men vi har inte '
        + 'sett någon betalning för det än' + (belopp != null ? ' (' + kronor(belopp) + ')' : '') + '.\n\n'
        + 'Ni betalar på passets sida i studievyn, ' + sätt + ':\n' + vyAdress() + '#pass/' + lista[0].objekt_id + '\n\n';
    } else {
      mitt = (lista.length === 1 ? 'Det här har vi inte sett någon betalning för än:\n\n'
        : 'De här har vi inte sett någon betalning för än:\n\n')
        + lista.map(a => '  · ' + rad(a)).join('\n') + '\n\n'
        + 'Ni betalar under Bekräfta rapport i studievyn, ' + sätt + ':\n' + vyAdress() + '#bekrafta\n\n';
    }
    return {
      amne: ettPass ? 'Betalningen för passet ' + kortDatum((bokning(lista[0].objekt_id) || {}).wanted_date)
        : 'Betalningen för era pass hos Nextrum',
      text: 'Hej ' + förnamn(id) + ',\n\n' + mitt
        + (lista.length ? 'Har ni redan betalat kan ni bortse från det här. Hör gärna av er om något inte stämmer.\n\n' : '')
        + 'Hälsningar,\nNextrum'
    };
  }

  function brevOmFaktura(f) {
    const bg = String((NX.CFG && NX.CFG.BANKGIRO) || '').trim();
    const period = NXBetalning.periodText(f.period);
    return {
      amne: 'Fakturan för ' + period + ' är inte betald',
      text: 'Hej ' + förnamn(f.parent_id) + ',\n\n'
        + 'Fakturan för ' + period + (f.fortnox_fakturanummer ? ' (nummer ' + f.fortnox_fakturanummer + ')' : '')
        + ' på ' + kronor(f.belopp_ore) + ' skulle ha betalats senast den ' + kortDatum(f.forfaller)
        + ', och vi har inte sett betalningen än.\n\n'
        + (bg ? 'Ni betalar till bankgiro ' + bg + (f.ocr ? ' med OCR-nummer ' + f.ocr : '') + '.'
          : 'Betalningsuppgifterna står på fakturan' + (f.ocr ? ', och OCR-numret är ' + f.ocr : '') + '.')
        + ' Fakturan står också under Betalning i studievyn:\n' + vyAdress() + '#betalning\n\n'
        + 'Har ni redan betalat kan ni bortse från det här. Hör gärna av er om något inte stämmer.\n\n'
        + 'Hälsningar,\nNextrum'
    };
  }

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-eko-paminn]');
    if (!k) return;
    const id = k.dataset.ekoPaminn;
    const p = S.personer[id] || {};
    if (!p.email) return;
    const f = k.dataset.ekoFaktura ? (S.fakturor || []).find(x => x.id === k.dataset.ekoFaktura) : null;
    const brev = f ? brevOmFaktura(f) : brevOmPass(id);
    kontaktaRuta({
      titel: 'Påminn ' + (p.full_name || p.email),
      namn: p.full_name, till: p.email, amne: brev.amne, text: brev.text
    });
  });

  /* ============================================================
     BOKSLUTET (Fas 20.2, omgjort 2026-09-29)

     Två beslut av Leo, och båda bor i databasen:
       1. En stängd månad är låst. Inga pass och inga rapporter i den
          går att ändra, inte heller av admin, förrän någon öppnar den
          med ett skäl.
       2. En månad stängs bara när dess larm är noll.

     Överst står vad som krävs för att stänga, som en lista med bockar,
     och knappen direkt under. Knappen är grå när månaden pågår eller
     har larm, och säger varför. Det är en upplysning, inte skyddet:
     stang_manad() prövar samma sak och nekar med ett eget besked, och
     det beskedet visas ordagrant om det kommer.

     Talen räknas i manad_lage(), inte här, och sparas i
     manadsbokslut.summering när månaden stängs: det som visas är
     alltså exakt det som frystes. De står i tre kort (passen, pengarna,
     underlag och fakturor) i stället för tio rutor som såg likadana ut.
     Larmen är samma rader som under Att göra, med samma knappar.
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

  function talKort(rubrik, rader) {
    return '<div class="vy-kort bs-kort"><div class="vy-kort-kropp"><h4>' + esc(rubrik) + '</h4><dl>'
      + rader.filter(Boolean).map(r => '<div' + (r[2] ? ' class="ar-larm"' : '') + '><dt>' + esc(r[0]) + '</dt><dd>'
        + esc(String(r[1])) + '</dd></div>').join('') + '</dl></div></div>';
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
      : (S.utbetalningar || []).filter(x => månadFör(x.period) === månad && x.status === 'utbetald').length;
    const sista = new Date(Date.parse(NXStudie.månadsGräns(månad).till + 'T12:00:00') - DAG);

    const läge = stängd ? pill('Stängd', 'ar-klar')
      : d.pagar ? pill('Pågår', 'ar-vantar')
      : larm.length ? pill(larm.length + (larm.length === 1 ? ' larm kvar' : ' larm kvar'), 'ar-ny')
      : pill('Kan stängas', 'ar-ny');

    let h = '<div class="bs-topp"><div><h3>' + esc(stor(namn)) + '</h3>'
      + '<p>' + esc(stängd ? 'Månaden är stängd och låst. Pass och rapporter i den går inte att ändra.'
        : d.pagar ? 'Månaden pågår. Talen ändras tills den är slut.'
        : larm.length ? 'Månaden är slut. Lös larmen, sedan kan den stängas.'
        : 'Månaden är slut och allt går ihop. Stäng den, så låses den.') + '</p></div>' + läge + '</div>';

    /* Vad som krävs för att stänga. */
    const krav = (ok, text, under) => '<li class="' + (ok ? 'ar-ok' : 'ar-inte') + '"><span>' + esc(text) + '</span>'
      + (under ? '<small>' + esc(under) + '</small>' : '') + '</li>';
    if (!stängd) {
      h += '<ul class="bs-krav">'
        + krav(!d.pagar, 'Månaden är slut', d.pagar ? 'slutar ' + datumText(isoFor(sista)) : '')
        + krav(utanRapport === 0, 'Alla genomförda pass har rapport',
          (p.med_rapport || 0) + ' av ' + (p.genomforda || 0))
        + krav(!larm.length, 'Inga larm', larm.length ? larm.length + ' kvar, nedanför' : '')
        + '</ul>';
    }

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

    /* Det som inte är kortpengar, och testbetalningarna, för sig: ett
       testpass i den riktiga databasen ska aldrig se ut som intäkt. */
    const tb = d.timbank || {};
    h += '<div class="bs-tal">'
      + talKort('Passen', [
        ['Genomförda', (p.genomforda || 0) + ' av ' + (p.bokade || 0) + ' bokade'],
        p.avbokade ? ['Avbokade', p.avbokade] : null,
        ['Med rapport', (p.med_rapport || 0) + (utanRapport ? ' · ' + utanRapport + ' saknar' : ''), utanRapport > 0],
        ['Debiterad tid', tim(p.debiterade_min) + ' (bokat ' + tim(p.bokade_min) + ')'],
        ['Lönetid', tim(p.lon_min)],
        ['Hållen tid som avvek', (p.avvikande || 0) + ' pass']
      ])
      + talKort('Pengarna', [
        ['Betalt med kort', kronor(k.betalt_ore) + ' · ' + (k.antal || 0) + ' st'],
        Number(k.aterbetalt_ore) ? ['Tillbaka till familjer', kronor(k.aterbetalt_ore)] : null,
        ['Stripes avgift', kronor(k.avgift_ore) + (k.utan_avgift ? ' · ' + k.utan_avgift + ' saknas' : ''), k.utan_avgift > 0],
        ['Netto efter Stripe', kronor(k.netto_ore)],
        ['Tillägg för övertid', kronor(t.betalt_ore) + ' · ' + (t.antal || 0) + ' st'
          + (Number(t.aterbetalt_ore) ? ' · ' + kronor(t.aterbetalt_ore) + ' tillbaka' : '')],
        d.timmar ? ['Betalda med köpta timmar', d.timmar + ' pass'] : null,
        tb.pass ? ['Betalda ur timbanken', tb.pass + ' pass'] : null,
        tb.overtid_min ? ['Övertid ur timbanken', tim(tb.overtid_min)] : null,
        d.faktura && d.faktura.pass ? ['Mot faktura', d.faktura.pass + ' pass'] : null,
        d.test ? ['Testbetalningar', d.test + ', räknas inte in'] : null
      ])
      + talKort('Underlag och fakturor', [
        ['Underlag till studiehjälpare', (u.antal || 0) + ' st · ' + kronor(u.belopp_ore)],
        ['Utbetalda', utbetalda + ' av ' + (u.antal || 0)],
        ['Fakturor', (f.antal || 0) + ' st · ' + kronor(f.belopp_ore)],
        ['Betalda fakturor', (f.betalda || 0) + ' av ' + (f.antal || 0)]
      ])
      + '</div>';

    h += grupp(null, 'Larm i ' + NXStudie.månadsNamn(månad, false), larm.length,
      larm.length ? iGruppordning(larm.map(postFörAvvikelse)).map(göraRad).join('')
        : tomt('Inga larm', 'Allt i månaden går ihop.'), larm.length > 0,
      larm.length ? 'Samma rader som under Att göra, med samma knappar. Månaden stängs när listan är tom.' : '');

    /* Larm i andra månader, ur samma räkning (avvikelser_rader) som
       översikten läser. Utan datum hör ett larm inte till någon månad. */
    h += andraMånaderText(andraMånader(S.avvikelser || [], a => a.datum), 'Larm');
    h += '<p class="vy-finstilt">Månaden är passets månad, inte betalningens: ett pass i september som betalas i '
      + 'oktober hör till september. Testbetalningar räknas för sig och aldrig in i summorna. Underlag och fakturor '
      + 'låses inte av stängningen, för de betalas efter månadsskiftet.</p>';

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
     KÖPTA TIMMAR (Fas 16.1 och 22.1)

     Planerna, klippkorten och timbanken: timmar och minuter familjerna
     betalat för men inte använt. För bokföringen en skuld till
     familjen, inte en intäkt, och därför står det överst vad som går
     tillbaka om alla slutar i dag.

     "Om de slutar i dag" är vad villkoren lovar: de använda timmarna
     räknade till ordinarie pris, resten tillbaka. Beloppet räknas i
     klippkort_saldo; här visas det bara. INOM ÅNGERFRISTEN gäller ett
     annat belopp (Fas 16.1e): den som ångrar sig betalar en andel av
     det AVTALADE priset, alltså det rabatterade, för det som hunnit
     användas. Vilket av dem som gäller avgörs av dagens datum mot
     angerfrist_till. Återbetalningen görs i Stripes dashboard, och
     webhooken stänger kortet när den kommer.

     Timbanken (Fas 22.1): minuter som blev över när ett pass betalt med
     timmar slutade före en hel timme. Slutar familjen betalas värdet
     tillbaka tillsammans med klippkortet, och banken markeras här.
     Knappen flyttar inga pengar.
     ============================================================ */
  const iÅngerfristen = k => !!k.angerfrist_till && String(k.angerfrist_till) >= isoFor(new Date());
  const omDeSlutar = k => Number((iÅngerfristen(k) ? k.vid_anger_ore : k.vid_uppsagning_ore) || 0);

  function ritaTimmar() {
    const kop = $('#timmar-kop'), bank = $('#timmar-bank'), sam = $('#timmar-sam');
    if (!kop) return;
    const idag = isoFor(new Date());
    const test = k => !!(S.klippkortTest && S.klippkortTest.has(k.id));
    const köp = (S.klippkort || []).filter(k => k.status !== 'vantar' && k.status !== 'misslyckad')
      .sort((a, b) => ((a.status === 'betald' ? 0 : 1) - (b.status === 'betald' ? 0 : 1))
        || String(b.betald_at || b.created_at).localeCompare(String(a.betald_at || a.created_at)));
    const aktiva = köp.filter(k => k.status === 'betald' && !test(k));
    const giltiga = aktiva.filter(k => !k.giltigt_till || String(k.giltigt_till) >= idag);
    const timmarKvar = giltiga.reduce((n, k) => n + Number(k.kvar || 0), 0);
    const tillbaka = aktiva.reduce((n, k) => n + omDeSlutar(k), 0);
    const banken = (S.timbank || []).slice().sort((a, b) => Number(b.saldo_min) - Number(a.saldo_min));
    const bankMin = banken.reduce((n, r) => n + Number(r.saldo_min || 0), 0);
    const bankVärde = banken.reduce((n, r) => n + Number(r.varde_ore || 0), 0);

    if (sam) {
      sam.innerHTML = samKort('Timmar kvar hos familjerna', timmarKvar + ' h',
          giltiga.length ? giltiga.length + (giltiga.length === 1 ? ' kort som gäller' : ' kort som gäller') : 'inga kort som gäller')
        + samKort('Tillbaka om alla slutar i dag', kronor(tillbaka + bankVärde), 'klippkorten och timbanken, som villkoren räknar')
        + samKort('Timbanken', minText(bankMin), bankMin ? kronor(bankVärde) + ' hos ' + banken.length
          + (banken.length === 1 ? ' familj' : ' familjer') : 'inga sparade minuter');
    }

    const f = S.erbFlagga;
    const not = $('#timmar-not');
    if (not) {
      not.hidden = !(f && !f.aktiv);
      not.innerHTML = f && !f.aktiv ? 'Planer och klippkort är avstängda: inget går att köpa. Strömbrytaren står under '
        + '<button type="button" class="eko-lank" data-eko-flik="installningar">Inställningar</button>.' : '';
    }

    const antal = $('#timmar-kop-antal');
    if (antal) antal.textContent = köp.length ? String(köp.length) : '';
    if (S.klippkortFel) {
      kop.innerHTML = tomt('Köpen gick inte att läsa', S.klippkortFel);
    } else if (!köp.length) {
      kop.innerHTML = tomt('Inga köpta timmar än', 'Familjerna köper planer och klippkort i studievyn, under Erbjudanden.');
    } else {
      kop.innerHTML = köp.map(k => {
        const betald = k.status === 'betald';
        const andel = k.timmar ? Math.max(0, Math.min(100, Math.round(100 * Number(k.kvar || 0) / Number(k.timmar)))) : 0;
        const utgånget = !!k.giltigt_till && String(k.giltigt_till) < idag;
        const meta = [
          esc(k.kvar + ' av ' + k.timmar + ' timmar kvar'),
          esc('köpt ' + lokalDag(k.betald_at || k.created_at)),
          k.giltigt_till ? esc((utgånget ? 'gick ut ' : 'gäller till ') + kortDatum(k.giltigt_till)) : '',
          betald && iÅngerfristen(k) ? esc('ångerrätt t.o.m. ' + kortDatum(k.angerfrist_till)) : ''
        ].filter(Boolean);
        const l = test(k) && betald ? ['Testköp', ''] : utgånget && betald ? ['Har gått ut', ''] : (KK_LAGE[k.status] || [k.status, '']);
        const höger = betald && !test(k)
          ? '<span class="eko-stack"><b>' + esc(kronor(omDeSlutar(k))) + '</b><small>tillbaka om de slutar i dag</small></span>'
          : '<span class="eko-stack"><b>' + esc(kronor(k.betalt_ore)) + '</b>'
            + (Number(k.aterbetald_ore || 0) > 0 ? '<small>' + esc(kronor(k.aterbetald_ore) + ' tillbaka') + '</small>' : '') + '</span>';
        return '<div class="vy-rad eko-kop">'
          + ikonRuta('timmar', betald && !utgånget ? 'mossa' : 'tyst')
          + '<span class="vy-rad-mitt">'
          + '<span class="vy-rad-titel">' + esc(k.namn || 'Köpta timmar') + ' <em>· ' + familjLänk(k.parent_id) + '</em></span>'
          + '<span class="eko-matare" aria-hidden="true"><i style="width:' + andel + '%"></i></span>'
          + '<span class="vy-rad-meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</span>'
          + '</span>'
          + '<span class="vy-rad-hoger">' + höger + pill(l[0], l[1]) + '</span>'
          + '</div>';
      }).join('');
    }

    if (!bank) return;
    if (S.timbankFel) { bank.innerHTML = tomt('Timbanken gick inte att läsa', S.timbankFel); return; }
    bank.innerHTML = banken.length ? banken.map(r => '<div class="vy-rad">'
      + ikonRuta('timmar', 'ockra')
      + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + familjLänk(r.parent_id) + '</span>'
      + '<span class="vy-rad-meta"><span>' + esc(minText(r.saldo_min) + ' sparade') + '</span></span></span>'
      + '<span class="vy-rad-hoger">'
      + (r.varde_ore != null ? '<span class="eko-stack"><b>' + esc(kronor(r.varde_ore)) + '</b><small>tillbaka om de slutar i dag</small></span>' : '')
      + knapp('data-timbank-ut', r.parent_id, 'Markera utbetald') + '</span></div>').join('')
      : tomt('Ingen familj har minuter i timbanken', 'Minuterna kommer när ett pass betalt med timmar slutar före en hel timme.');
  }

  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-timbank-ut]');
    if (!knappen) return;
    const id = knappen.dataset.timbankUt;
    const rad = (S.timbank || []).find(r => r.parent_id === id);
    const ja = await bekräfta({
      titel: 'Markera timbanken som utbetald?',
      text: 'Gör det först när pengarna är tillbaka hos ' + namnFör(id) + ' (Stripes dashboard, tillsammans med klippkortet). '
        + 'Minuterna försvinner ur banken, och raden går inte att ångra.'
        + (rad && rad.varde_ore != null ? ' Värdet i dag: ' + kronor(rad.varde_ore) + '.' : ''),
      knapp: 'Markera utbetald'
    });
    if (!ja) return;
    await medan(knappen, 'Sparar…', async () => {
      const { data, error } = await supa.rpc('timbank_utbetald', { p_foralder: id });
      if (error) { alert('Kunde inte markera timbanken: ' + felText(error)); return; }
      if (data && data.fel) { alert(data.fel); }
      const { data: nu, error: fel } = await supa.from('timbank_saldo')
        .select('parent_id, saldo_min, varde_ore').gt('saldo_min', 0);
      if (!fel) S.timbank = nu || [];
      ritaTimmar();
    });
  });

  /* ============================================================
     INSTÄLLNINGAR: STRÖMBRYTARNA OCH STRIPE

     Tre rader i flaggor, samma sort som notismejlen, samlade på ett
     ställe. Förut låg de i var sin ruta på två flikar, och den första
     man såg under Kortbetalningar var en spärr som inte går att slå på.

     SPÄRREN (Fas 14.2) "ingen betalning, inget pass" GÅR INTE ATT SLÅ
     PÅ sedan Fas 19.2: villkoren låter familjen betala efter passet,
     när de bekräftar rapporten, och spärren nekar just den rapporten.
     Databasen vägrar (flaggor_kortsparr_av), och raden har därför ingen
     Slå på-knapp: en knapp som alltid ger ett fel är sämre än en mening
     som säger varför. Stäng av står kvar för den dag villkoret tas bort
     och någon slår på den igen.

     ERBJUDANDENA (Fas 16.1): att stänga av är nödbromsen. Redan köpta
     timmar går fortfarande att se, men inte att köpa nya eller dra från.
     ============================================================ */
  const kortbetalda = () => (S.bokningar || [])
    .filter(b => b.betalning_status === 'betald' || b.betalning_status === 'tvist').length;

  function brytare(o) {
    return '<div class="vy-rad eko-brytare">'
      + ikonRuta('brytare', o.på ? 'mossa' : 'tyst')
      + '<span class="vy-rad-mitt">'
      + '<span class="vy-rad-titel">' + esc(o.titel) + ' ' + pill(o.påText, o.på ? 'ar-klar' : '') + '</span>'
      + '<span class="eko-hur">' + esc(o.text) + '</span>'
      + (o.krav ? '<span class="eko-krav">' + esc(o.krav) + '</span>' : '')
      + (o.not ? '<span class="eko-hur">' + esc(o.not) + '</span>' : '')
      + '</span>'
      + '<span class="vy-rad-hoger">' + (o.knapp || '') + '</span>'
      + '</div>';
  }

  function ritaInställningar() {
    const host = $('#eko-brytare');
    if (host) {
      const saknas = kod => tomt('Strömbrytaren gick inte att läsa', S.kortsparrFel || 'Raden ' + kod + ' saknas i flaggor.');
      const fa = S.fakturaFlagga, er = S.erbFlagga, ks = S.kortsparr;
      const spärrade = S.fakturaSparr ? S.fakturaSparr.size : 0;
      const n = kortbetalda();
      host.innerHTML = (fa ? brytare({
          titel: 'Faktura som betalsätt', på: fa.aktiv, påText: fa.aktiv ? 'På' : 'Av',
          text: fa.beskrivning || 'Familjen kan välja faktura på ett genomfört pass.',
          krav: !fa.aktiv && fa.vantar_pa ? 'Ska vara avgjort först: ' + fa.vantar_pa : '',
          not: (spärrade ? spärrade + (spärrade === 1 ? ' familj är avstängd' : ' familjer är avstängda')
            + ' från faktura, under familjens Ekonomi. ' : '') + 'Ändrad ' + kortDatum(fa.uppdaterad) + '.',
          knapp: '<button class="btn ' + (fa.aktiv ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-fakturaflagga="'
            + (fa.aktiv ? '0' : '1') + '">' + (fa.aktiv ? 'Stäng av' : 'Slå på') + '</button>'
        }) : saknas('faktura'))
        + (er ? brytare({
          titel: 'Planer och klippkort', på: er.aktiv, påText: er.aktiv ? 'Går att köpa' : 'Av',
          text: er.beskrivning || 'Familjerna kan köpa timmar i förväg i studievyn.',
          krav: !er.aktiv && er.vantar_pa ? 'Ska vara avgjort först: ' + er.vantar_pa : '',
          not: 'Ändrad ' + kortDatum(er.uppdaterad) + '.',
          knapp: '<button class="btn ' + (er.aktiv ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-erbflagga="'
            + (er.aktiv ? '0' : '1') + '">' + (er.aktiv ? 'Stäng av' : 'Slå på') + '</button>'
        }) : saknas('erbjudanden'))
        + (ks ? brytare({
          titel: 'Ingen betalning, inget pass', på: ks.aktiv, påText: ks.aktiv ? 'På' : 'Av',
          text: ks.beskrivning || '',
          krav: !ks.aktiv && ks.vantar_pa ? ks.vantar_pa : '',
          not: (n ? n + (n === 1 ? ' pass är betalt' : ' pass är betalda') + ' med kort. '
            : 'Ingen kortbetalning har gått igenom än. ') + 'Ändrad ' + kortDatum(ks.uppdaterad) + '.',
          knapp: ks.aktiv ? '<button class="btn btn-ghost btn-sm" type="button" data-kortsparr="0">Stäng av</button>' : ''
        }) : saknas('kortsparr'));
    }
    ritaAvstamning();
  }

  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-kortsparr]');
    if (!knappen) return;
    const på = knappen.dataset.kortsparr === '1';
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
        forhandsvisning: f.vantar_pa ? 'Det här skulle vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      });
      if (!ja) return;
    }
    await medan(knappen, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'kortsparr');
      if (error) { alert('Kunde inte ändra spärren: ' + felText(error)); return; }
      /* Läget läses tillbaka i stället för att antas. En uppdatering
         som RLS nekar ger inget fel, bara noll rader — och då ska
         raden visa att ingenting hände. */
      const { data } = await supa.from('flaggor').select('*').eq('kod', 'kortsparr').maybeSingle();
      if (data) S.kortsparr = data;
      ritaInställningar();
    });
  });

  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-erbflagga]');
    if (!knappen) return;
    const på = knappen.dataset.erbflagga === '1';
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
    await medan(knappen, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'erbjudanden');
      if (error) { alert('Kunde inte ändra erbjudandena: ' + felText(error)); return; }
      // Läses tillbaka, som spärren: en nekad uppdatering ger noll rader, inget fel.
      const { data } = await supa.from('flaggor').select('*').eq('kod', 'erbjudanden').maybeSingle();
      if (data) S.erbFlagga = data;
      ritaInställningar();
      ritaTimmar();
    });
  });

  /* ============================================================
     STRIPE-LÄGET (Fas 14.3)

     Om nyckeln var satt, om webhooken lyssnade på rätt händelser och
     vilken version den stod på gick förut inte att veta utan att logga
     in hos Stripe och leta. stripe-lage frågar med servernyckeln och
     svarar med en lista; reglerna för vad som är grönt bor i
     granskaStripe() i _delad/stripe.ts, med egna prov.

     Körs bara på knapptryck. Två anrop mot Stripe vid varje omritning
     hade varit två anrop för en fråga ingen ställt.
     ============================================================ */
  const PUNKT_MÄRKE = {
    true: ['Klart', 'ar-klar', 'mossa', 'klar'], false: ['Åtgärda', 'ar-ny', 'lera', 'ovrigt'],
    null: ['Bra att veta', 'ar-vantar', 'ockra', 'ovrigt']
  };

  function ritaStripeLage(d) {
    const host = $('#stripe-lage');
    if (!host) return;
    const punkter = d.punkter || [];
    const röda = punkter.filter(p => p.ok === false).length;
    const klockan = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    host.innerHTML = '<p class="eko-text"><b>' + esc(röda ? röda + (röda === 1 ? ' sak att åtgärda.' : ' saker att åtgärda.')
      : 'Inget att åtgärda.') + '</b> ' + esc('Kontrollerat ' + klockan + '.') + '</p>'
      + (punkter.length ? '<div class="vy-lista eko-punkter">' + punkter.map(p => {
        const m = PUNKT_MÄRKE[String(p.ok)] || PUNKT_MÄRKE.null;
        return '<div class="vy-rad">' + ikonRuta(m[3], m[2])
          + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(p.rubrik) + '</span>'
          + '<span class="eko-hur">' + esc(p.text) + '</span></span>'
          + '<span class="vy-rad-hoger">' + pill(m[0], m[1]) + '</span></div>';
      }).join('') + '</div>' : tomt('Stripe svarade inte', ''));
  }

  /* ============================================================
     AVGIFTERNA I EFTERHAND (Fas 14.7)

     Stripe skapar balanstransaktionen en stund efter betalningen, och
     de två första betalningarna fick ingen avgift. Webhooken tar nu
     emot charge.updated och skriver in den när den kommer. Knappen
     hämtar den för betalningar som kom in innan, eller där händelsen
     inte kom fram: stripe-avstamning frågar Stripe om varje charge och
     skriver avgiften, nettot och om betalningen var skarp. Den står
     också under Att göra när något saknas.
     ============================================================ */
  const saknarAvstamning = () => (S.bokningar || [])
    .filter(b => b.stripe_charge_id && (b.stripe_avgift_ore == null || b.stripe_skarp == null));

  function ritaAvstamning() {
    const host = $('#stripe-avstamning');
    if (!host) return;
    const n = saknarAvstamning().length;
    host.innerHTML = n
      ? '<p class="eko-text">' + esc(n + (n === 1 ? ' betalning saknar' : ' betalningar saknar')
        + ' Stripes avgift eller läge (skarp eller test).') + '</p>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-avstamning>Hämta från Stripe</button>'
      : '<p class="eko-text">Alla kortbetalningar har Stripes avgift och läge.</p>';
  }

  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-avstamning]');
    if (!knappen) return;
    await medan(knappen, 'Frågar Stripe…', async () => {
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
      ritaAttGöra();
      await laddaBokslut();       // avgiften och nettot står i bokslutet
    });
  });

  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-stripe-lage]');
    if (!knappen) return;
    await medan(knappen, 'Frågar Stripe…', async () => {
      const svar = await supa.functions.invoke('stripe-lage', { body: {} });
      if (svar.error) {
        $('#stripe-lage').innerHTML = tomt('Kontrollen gick inte att köra', await funktionsFel(svar.error));
        return;
      }
      ritaStripeLage(svar.data || {});
    });
  });

  /* ============================================================
     ÅTERBETALNINGEN

     Går genom edge-funktionen, aldrig direkt mot tabellen: bara
     servern har Stripe-nyckeln, och taket för hur mycket som får gå
     tillbaka räknas ur raden, inte ur det som skrivs i rutan.
     ============================================================ */
  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-aterbetala]');
    if (!knappen) return;
    const b = (S.bokningar || []).find(x => x.id === knappen.dataset.aterbetala);
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
      /* Studiehjälparens del dras inte tillbaka från något: Connect är
         borttaget (Fas 12.5), och hela beloppet ligger hos Nextrum. En
         dialog som beskriver en pengaväg som inte finns är värre än
         ingen dialog. */
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

    await medan(knappen, 'Återbetalar…', async () => {
      const svar = await supa.functions.invoke('stripe-aterbetalning', {
        body: { pass: b.id, belopp_ore: valt.belopp_ore, anledning: valt.anledning }
      });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      /* Varningen betyder att pengarna ÄR tillbaka men att raden inte
         hann skrivas. Den får inte sväljas: listan visar då fel tills
         webhooken kommer ikapp. */
      if (svar.data && svar.data.varning) alert(svar.data.varning);
      await hämtaAllt();
      ritaKortbetalningar();
      /* Larmet betalt_for_lange och bokslutets återbetalda belopp
         räknas i databasen och måste hämtas om, inte ritas om. */
      await laddaOmEkonomi();
    });
  });

  /* ============================================================
     GÖR TILL UPPGIFT, KOPPLA, UNDANTA
     ============================================================ */
  document.addEventListener('click', async e => {
    const knappen = e.target.closest('[data-avv-uppgift]');
    if (!knappen) return;
    const lista = knappen.dataset.avvUppgift.split(';').map(s => s.split('|'))
      .map(([typ, tabellNamn, id]) => (S.avvikelser || []).find(x => x.typ === typ
        && x.objekt_tabell === tabellNamn && x.objekt_id === id))
      .filter(Boolean);
    if (!lista.length) return;
    await medan(knappen, 'Skapar…', async () => {
      let skapade = 0;
      for (const a of lista) {
        const kopplad = UPPG_TABELLER.indexOf(a.objekt_tabell) !== -1;
        const vem = [a.kund_id ? namnFör(a.kund_id) : null, a.studiehjalpare_id ? namnFör(a.studiehjalpare_id) : null]
          .filter(Boolean).join(' · ');
        const rad = await skapaUppgift({
          titel: (avvText(a)[0] + (vem ? ' — ' + vem : '') + (a.datum ? ', ' + kortDatum(a.datum) : '')).slice(0, 200),
          typ: 'problem',
          beskrivning: avvText(a)[1] || null,
          kopplad_tabell: kopplad ? a.objekt_tabell : null,
          kopplad_id: kopplad ? a.objekt_id : null,
          nyckel: avvNyckel(a)
        });
        if (rad) skapade++;
      }
      if (skapade) ritaAvvikelser();
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
    ritaKörningsnoterna();
  }

  /* Bokslutet med: dess larm är samma avvikelser, och ett larm som
     lösts här ska inte stå kvar som ett hinder för att stänga månaden. */
  async function laddaOmEkonomi() {
    await hämtaEkonomiunderlag();
    ritaAttGöra();
    ritaBetalningslistan();
    ritaFakturor();
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
      const VAL = [['narvarande', 'Närvarade'], ['sen', 'Kom sent'], ['franvarande', 'Uteblev']];
      const valt = await fråga({
        titel: 'Vilken rapport hör till passet?',
        text: vad + '. Rapporten kopplas till passet, och passet kommer med på nästa körning.',
        innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="avv-narvaro">Närvaro på passet</label>'
          + '<select class="sel" id="avv-narvaro">' + VAL.map(([v, t]) =>
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
          + 'på studiehjälparens underlag. Är det redan betalt återbetalar du det under Alla betalningar.',
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
          const b = bokning(p.id);
          if (b) b.fakturerbar = false;
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
        const b = bokning(p.id);
        if (b) b.fakturerbar = true;
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

     EN RUTA, TRE STÄLLEN (2026-09-28). Körningen står under
     Betalningar → Fakturor (sedan 2026-09-29; förut en egen flik),
     under Löner och under Månadens ekonomi: Leo ville skapa lönernas
     underlag och familjernas fakturor där han tittar på dem. Det är
     samma körning på alla tre, och samma lyssnare. En ruta är ett
     element med data-kor-ruta: perioden (en väljare med
     data-kor-period, eller attributet på rutan själv), knapparna
     data-kor-torr och data-kor-skapa, data-kor-not för det rutan säger
     om månaden, och data-kor-resultat för svaret. Torrkörningen hör
     till sin ruta. En torrkörning under Löner ger ingen Skapa-knapp här,
     för den som trycker här har inte sett vad som skapas.

     Väljaren här följer inte månadsraden längre: Fakturor gäller alla
     månader, och raden står inte ens under fliken. Den står på förra
     månaden, som är den som körs, och knappen "Kör månadskörningen" på
     en rad under Att göra eller Fakturor ställer den på radens månad.

     EN MÅNAD SOM INTE HAR BÖRJAT GÅR INTE ATT KÖRA (2026-09-28).
     Löner och Månadens ekonomi visar också kommande månader, och deras
     rutor körde den månad sidan visade. Körningen tar allt till och med
     periodens slut som inte står på ett underlag, så en körning för
     oktober mitt i september hade lagt septembers pass på oktobers
     underlag, och lönen för dem hade kommit en månad för sent. En
     pågående månad går att köra, som förut, och en månad efter en som
     saknar underlag också, men rutan säger vad som händer med passen.
     ============================================================ */
  /* SCHEMAT (2026-09-28). pg_cron-jobbet manadskorning skriver förra
     månadens underlag den 1:a, och underlaget är studiehjälparens
     lönespecifikation. Jobbet finns bara i cron.job, och ett schema som
     står av ser härifrån ut precis som ett som fungerar. Rutan frågar
     därför databasen i stället för att texten ovanför påstår något. */
  async function ritaSchema() {
    const host = $('#kor-schema');
    if (!host) return;
    const rad = (märke, text) => '<p class="eko-schema">' + märke + ' ' + esc(text) + '</p>';
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

  /* Vad rutan säger om sin månad, och om den går att köra: EN MÅNAD
     SOM INTE HAR BÖRJAT GÅR INTE ATT KÖRA, ovan. */
  function körningensLäge(period) {
    const p = String(period || '').slice(0, 7) + '-01';
    const nu = NXStudie.månadIso(new Date());
    const namn = m => NXStudie.månadsNamn(m, false);
    if (p > nu) {
      return { spärr: true, text: stor(namn(p)) + ' har inte börjat och går inte att köra än. En körning nu '
        + 'hade lagt tidigare månaders pass på underlaget för ' + namn(p) + '.' };
    }
    /* Månader före den här som har pass att betala men inga underlag
       (NXAdmin.lönemånad). Körs den här först tar den deras pass. */
    const senast = senasteLönemånad();
    const före = new Set();
    (S.passunderlag || []).forEach(x => {
      if (!x.fakturerbar || !x.har_rapport || x.pa_underlag || !x.wanted_date) return;
      const m = lönemånad(x.wanted_date, senast);
      if (m < p) före.add(m);
    });
    const texter = [];
    if (före.size) {
      const lista = Array.from(före).sort().map(namn);
      const en = lista.length === 1;
      texter.push(stor(en ? lista[0] : lista.slice(0, -1).join(', ') + ' och ' + lista[lista.length - 1])
        + ' har inga underlag än. Kör ' + (en ? 'den' : 'dem') + ' först, annars kommer '
        + (en ? 'dess' : 'deras') + ' pass med på underlaget för ' + namn(p) + '.');
    }
    if (p === nu) texter.push(stor(namn(p)) + ' pågår. Pass som hålls efter körningen kommer med nästa månad.');
    return { spärr: false, text: texter.join(' ') };
  }

  function ritaKörningsnot(ruta) {
    if (!ruta) return;
    const läge = körningensLäge(körningsperiod(ruta));
    const not = ruta.querySelector('[data-kor-not]');
    if (not) {
      not.textContent = läge.text;
      not.hidden = !läge.text;
    }
    const torr = ruta.querySelector('[data-kor-torr]');
    if (torr) torr.disabled = läge.spärr;
    if (läge.spärr) glömKörning(ruta);
  }

  /* Efter en körning, och när passen hämtats om, kan en tidigare månad
     ha fått underlag. */
  function ritaKörningsnoterna() {
    $$('[data-kor-ruta]').forEach(ritaKörningsnot);
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
    val.addEventListener('change', () => {
      const ruta = val.closest('[data-kor-ruta]');
      glömKörning(ruta);
      const host = ruta && ruta.querySelector('[data-kor-resultat]');
      if (host) host.innerHTML = '';
      ritaKörningsnot(ruta);
    });
    ritaKörningsnot(val.closest('[data-kor-ruta]'));
  }

  /* "Kör månadskörningen" på en rad: till Fakturor, med körningen
     ställd på radens månad och Torrkör i fokus. Den körs inte av sig
     själv: torrkörningen är steget där man ser vad som skapas. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-eko-korning]');
    if (!k) return;
    const val = $('#kor-period');
    const ruta = val && val.closest('[data-kor-ruta]');
    if (val && Array.prototype.some.call(val.options, o => o.value === k.dataset.ekoKorning) && val.value !== k.dataset.ekoKorning) {
      val.value = k.dataset.ekoKorning;
      glömKörning(ruta);
      const host = ruta && ruta.querySelector('[data-kor-resultat]');
      if (host) host.innerHTML = '';
      ritaKörningsnot(ruta);
    }
    visaFlik('fakturor');
    const torr = $('#kor-torr');
    if (ruta) NXStudie.visaÖverst(ruta);
    if (torr) torr.focus({ preventScroll: true });
  });

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
    if (ruta.dataset.korPeriod !== p) {
      ruta.dataset.korPeriod = p;
      glömKörning(ruta);
      const host = ruta.querySelector('[data-kor-resultat]');
      if (host) host.innerHTML = '';
    }
    ritaKörningsnot(ruta);
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
        + 'kvar på passet i familjens vy, och Påminn under Att göra skriver ett mejl. '
        + '<a href="#ekonomi/attgora">Till Att göra</a>.');
    }
    const utan = d.hoppade_over_utan_rapport || [];
    if (utan.length) {
      noter.push('⚠️ ' + utan.length + (utan.length === 1 ? ' pass saknar' : ' pass saknar')
        + ' rapport och kom inte med. <a href="#ekonomi/attgora">Till Att göra</a>.');
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
    ritaKortbetalningar();
    ritaAttGöra();
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
    /* Knappen är grå för en månad som inte har börjat. En körning som
       lagt passen på fel månads underlag går inte att ta tillbaka
       härifrån, så frågan ställs här också och inte bara i knappen. */
    if (körningensLäge(period).spärr) { ritaKörningsnot(ruta); return; }

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

  /* Priset redigeras inte här — det gör tjänstekatalogen. Kvar är
     talet i månadskörningens ruta, som visar vad fakturering FAKTISKT
     kommer att räkna med: värdet i prissattning, dit triggern speglar
     läxhjälpens pris. Läser man tjanster här i stället skulle rutan
     visa vad någon nyss skrev medan funktionen räknade på något annat. */
  function ritaPris() {
    const öre = S.pris ? S.pris.pris_per_timme_ore : (NX.CFG.PRIS_PER_TIMME || 379) * 100;
    const ruta = $('#kor-pris');
    if (ruta) ruta.textContent = kronor(öre);
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    avvText, betRad, betalningsrader, fakturaRad, fyllPerioder, kandidater, laddaBokslut, laddaOmEkonomi,
    märkEkonomi, påminnKnapp, ritaAttGöra, ritaAvvikelser, ritaBokslut, ritaFakturor, ritaKortbetalningar,
    ritaPris, ritaUtbetalningar, sättKörningsperiod, utanRapport, visaBetalningsmånad
  });
})();
