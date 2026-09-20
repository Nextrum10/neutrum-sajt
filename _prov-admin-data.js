/* ============================================================
   PROVBÄNKEN FÖR ADMINVYN — fixturerna

   Laddas FÖRST på _prov-admin-fore.html och _prov-admin-efter.html,
   före _prov-admin-stub.js och före all riktig kod. Ingen databas,
   ingen inloggning: allt adminvyn läser står här.

   Två saker gör körningen deterministisk:

   1. KLOCKAN STÅR STILL. new Date() utan argument och Date.now() ger
      alltid lördag 2026-09-19 kl. 12:00 svensk tid. Datum med
      argument fungerar som vanligt. Datumen nedan står utskrivna,
      valda kring den dagen: pass bakåt och framåt, fakturor i fyra av
      statistikens sex månader, en spärrad dag före och en efter.

   2. INGENTING HÄR ÄNDRAS. Stubben lämnar ut djupa kopior och
      skrivningar rör aldrig tabellerna, så två körningar i rad ger
      samma svar.

   Id:n är UUID-formade men läsbara: första blocket säger vad det är.
     aaaaaaaa admin · bbbbbbbb familj · cccccccc studiehjälpare
     dddddddd elev  · eeeeeeee bokning · 0a uppdrag · 0b uppgifter
     · övriga per tabell
   ============================================================ */
(function () {
  'use strict';

  /* ---------- klockan ---------- */
  var RealDate = window.Date;
  var NU = RealDate.parse('2026-09-19T12:00:00+02:00');

  function ProvDate() {
    var a = Array.prototype.slice.call(arguments);
    /* Anropad utan new ger Date() en sträng. Samma sak här, fast för
       den frysta tiden. */
    if (!(this instanceof ProvDate)) return new RealDate(NU).toString();
    if (!a.length) return new RealDate(NU);
    return new (Function.prototype.bind.apply(RealDate, [null].concat(a)))();
  }
  ProvDate.prototype = RealDate.prototype;
  ProvDate.now = function () { return NU; };
  ProvDate.parse = RealDate.parse;
  ProvDate.UTC = RealDate.UTC;
  /* instanceof Date ska fortsätta fungera för datum som skapats före
     och efter bytet. */
  Object.defineProperty(ProvDate, Symbol.hasInstance, {
    value: function (x) { return x instanceof RealDate; }
  });
  window.Date = ProvDate;
  window.__provRealDate = RealDate;

  /* ---------- id:n ---------- */
  var ADMIN = 'aaaaaaaa-0000-4000-8000-000000000001';
  var P1 = 'bbbbbbbb-0000-4000-8000-000000000001';   // Karin Berg: två barn, ett matchat
  var P2 = 'bbbbbbbb-0000-4000-8000-000000000002';   // Johan Ek: ett barn, matchat
  var P3 = 'bbbbbbbb-0000-4000-8000-000000000003';   // Lena Holm: ett barn, matchat
  var T1 = 'cccccccc-0000-4000-8000-000000000001';   // Elsa Nyström: godkänd
  var T2 = 'cccccccc-0000-4000-8000-000000000002';   // Omar Said: väntar på godkännande
  var S1 = 'dddddddd-0000-4000-8000-000000000001';   // Alva Berg (P1), matchad, nyast
  var S2 = 'dddddddd-0000-4000-8000-000000000002';   // Nils Berg (P1), väntar
  var S3 = 'dddddddd-0000-4000-8000-000000000003';   // Elin Ek (P2), matchad
  var S4 = 'dddddddd-0000-4000-8000-000000000004';   // Hugo Holm (P3), matchad
  function B(n) { return 'eeeeeeee-0000-4000-8000-0000000000' + (n < 10 ? '0' : '') + n; }
  /* Ett uppdrag per elev (Fas 5.2): databasens trigger skapar det när
     barnet läggs till. Nils uppdrag är pausat. */
  var UPD1 = '0a000000-0000-4000-8000-000000000001';   // Alva
  var UPD2 = '0a000000-0000-4000-8000-000000000002';   // Nils, pausat
  var UPD3 = '0a000000-0000-4000-8000-000000000003';   // Elin
  var UPD4 = '0a000000-0000-4000-8000-000000000004';   // Hugo, engångsuppdrag
  var UPPDRAG_FOR = {};
  UPPDRAG_FOR[S1] = UPD1; UPPDRAG_FOR[S2] = UPD2; UPPDRAG_FOR[S3] = UPD3; UPPDRAG_FOR[S4] = UPD4;

  var profiles = [
    { id: ADMIN, role: 'admin', full_name: 'Sara Lind', email: 'sara.lind@example.se',
      is_admin: true, match_status: null, matched_tutor_id: null, phone: null,
      avatar_url: null, bio: null,
      created_at: '2026-01-12T09:00:00+00:00', last_seen_at: '2026-09-18T17:40:00+00:00' },

    { id: P1, role: 'parent', full_name: 'Karin Berg', email: 'karin.berg@example.se',
      is_admin: false, match_status: 'matched', matched_tutor_id: T1, phone: '070-111 22 33',
      avatar_url: null, bio: 'Två barn i Bromma. Vill helst ha pass efter fyra.',
      created_at: '2026-06-18T10:30:00+00:00', last_seen_at: '2026-09-17T19:05:00+00:00' },
    { id: P2, role: 'parent', full_name: 'Johan Ek', email: 'johan.ek@example.se',
      is_admin: false, match_status: 'matched', matched_tutor_id: T1, phone: '070-222 33 44',
      avatar_url: null, bio: null,
      created_at: '2026-03-10T08:15:00+00:00', last_seen_at: null },
    { id: P3, role: 'parent', full_name: 'Lena Holm', email: 'lena.holm@example.se',
      is_admin: false, match_status: 'matched', matched_tutor_id: T1, phone: null,
      avatar_url: null, bio: null,
      created_at: '2026-05-01T12:00:00+00:00', last_seen_at: '2026-09-02T07:30:00+00:00' },

    { id: T1, role: 'tutor', full_name: 'Elsa Nyström', email: 'elsa.nystrom@example.se',
      is_admin: false, match_status: null, matched_tutor_id: null, phone: '073-444 55 66',
      avatar_url: null, bio: null,
      created_at: '2026-03-02T10:00:00+00:00', last_seen_at: '2026-09-18T21:10:00+00:00' },
    { id: T2, role: 'tutor', full_name: 'Omar Said', email: 'omar.said@example.se',
      is_admin: false, match_status: null, matched_tutor_id: null, phone: null,
      avatar_url: null, bio: null,
      created_at: '2026-09-15T16:20:00+00:00', last_seen_at: '2026-09-15T16:25:00+00:00' }
  ];

  var tutor_profiles = [
    { id: T1, age: 19, school: 'KTH', city: 'Stockholm',
      subjects: ['Matematik', 'Fysik', 'Engelska'], grade_levels: ['Åk 7–9', 'Gymnasiet'],
      formats: ['Online', 'Hemma hos familjen'], availability: 'Vardagar efter 15',
      bio: 'Läser teknisk fysik och har hjälpt syskon med matte i flera år.',
      status: 'approved', hourly_rate: 180, visa_publikt: true, stripe_klar: false,
      /* Profilraden är nyare än kontot: den skrevs om när hon godkändes
         på nytt i september. Gör henne först i listan, så att
         detaljpanelen öppnas på den studiehjälpare som har data, och
         ger översiktens "+1 denna månad". */
      tjanster: ['laxhjalp'], created_at: '2026-09-16T08:00:00+00:00' },
    { id: T2, age: 17, school: 'Södra Latin', city: 'Stockholm',
      subjects: ['Svenska', 'Engelska'], grade_levels: ['Åk 4–6'],
      formats: ['Online'], availability: 'Tisdagar och torsdagar',
      bio: null,
      status: 'pending', hourly_rate: null, visa_publikt: false, stripe_klar: false,
      tjanster: ['laxhjalp'], created_at: '2026-09-15T16:30:00+00:00' }
  ];

  var students = [
    { id: S1, parent_id: P1, name: 'Alva Berg', grade: 'Åk 8', school: 'Bromma skola',
      subjects: ['Matematik', 'Engelska'], goals: 'Nå B i matematik till jul.',
      created_at: '2026-08-25T18:00:00+00:00', matched_tutor_id: T1, match_status: 'matched',
      uppdrag_id: UPD1 },
    { id: S2, parent_id: P1, name: 'Nils Berg', grade: 'Åk 5', school: null,
      subjects: ['Svenska'], goals: null,
      created_at: '2026-06-20T18:10:00+00:00', matched_tutor_id: null, match_status: 'pending',
      uppdrag_id: UPD2 },
    { id: S3, parent_id: P2, name: 'Elin Ek', grade: 'Gymnasiet år 2', school: 'Kungsholmens gymnasium',
      subjects: ['Fysik', 'Matematik'], goals: 'Klara Fysik 2 med god marginal.',
      created_at: '2026-03-15T09:00:00+00:00', matched_tutor_id: T1, match_status: 'matched',
      uppdrag_id: UPD3 },
    { id: S4, parent_id: P3, name: 'Hugo Holm', grade: 'Åk 9', school: 'Farsta skola',
      subjects: ['Matematik'], goals: null,
      created_at: '2026-05-05T15:45:00+00:00', matched_tutor_id: T1, match_status: 'matched',
      uppdrag_id: UPD4 }
  ];

  /* Bokningarna: bakåt och framåt, alla fyra lägen. "I dag" är
     2026-09-19. Sex månader bakåt för statistiken är april–september. */
  function bok(n, o) {
    return Object.assign({
      id: B(n), parent_id: null, tutor_id: T1, student_id: null, subject: 'Matematik',
      tjanst: 'laxhjalp', format: 'Online', grade_level: null,
      wanted_date: null, wanted_time: '16:00', duration_min: 60,
      status: 'requested', attendance: null, antal_barn: 1, rabatt_ore: 0,
      rabattkod: null, fakturerbar: true, fakturerbar_anledning: null,
      created_by: null, uppdrag_id: null, created_at: null
    }, o);
  }
  var bookings = [
    bok(13, { parent_id: P2, student_id: S3, subject: 'Fysik', wanted_date: '2026-05-20',
      status: 'completed', attendance: 'narvarande', created_at: '2026-05-14T11:00:00+00:00' }),
    bok(1, { parent_id: P3, student_id: S4, wanted_date: '2026-07-14',
      status: 'completed', attendance: 'narvarande', created_at: '2026-07-10T08:00:00+00:00' }),
    bok(2, { parent_id: P2, student_id: S3, subject: 'Fysik', format: 'Hemma hos familjen',
      wanted_date: '2026-08-12', wanted_time: '17:00', duration_min: 90,
      status: 'completed', attendance: 'narvarande', created_at: '2026-08-05T12:30:00+00:00' }),
    bok(3, { parent_id: P1, student_id: S1, subject: 'Engelska', wanted_date: '2026-08-26',
      status: 'completed', attendance: 'franvarande', fakturerbar: false,
      fakturerbar_anledning: 'Eleven uteblev — ingen debitering enligt överenskommelse.',
      created_at: '2026-08-24T19:00:00+00:00' }),
    bok(4, { parent_id: P3, student_id: S4, wanted_date: '2026-09-02', wanted_time: '15:30',
      status: 'completed', attendance: 'narvarande', created_at: '2026-08-30T10:00:00+00:00' }),
    bok(5, { parent_id: P2, student_id: S3, format: 'Biblioteket', wanted_date: '2026-09-09',
      duration_min: 120, status: 'completed', created_at: '2026-09-03T14:10:00+00:00' }),
    bok(7, { parent_id: P3, student_id: S4, wanted_date: '2026-09-10', wanted_time: '18:00',
      status: 'cancelled', created_at: '2026-09-04T09:20:00+00:00' }),
    bok(6, { parent_id: P1, student_id: S1, wanted_date: '2026-09-16',
      status: 'confirmed', created_at: '2026-09-11T20:00:00+00:00' }),
    bok(8, { parent_id: P1, student_id: S1, wanted_date: '2026-09-21',
      status: 'confirmed', created_at: '2026-09-15T18:45:00+00:00' }),
    bok(9, { parent_id: P2, student_id: S3, subject: 'Fysik', format: 'Hemma hos familjen',
      wanted_date: '2026-09-23', wanted_time: '17:00', duration_min: 90,
      status: 'requested', created_at: '2026-09-18T07:55:00+00:00' }),
    bok(10, { parent_id: P1, student_id: S2, subject: 'Svenska', wanted_date: '2026-09-24',
      wanted_time: '15:00', status: 'requested', created_at: '2026-09-19T08:05:00+00:00' }),
    /* Ett pass utan valt barn. Prövar vägarna där elevnamnet saknas —
       "inget barn valt", och att familjens namn står i stället. */
    bok(14, { parent_id: P2, student_id: null, wanted_date: '2026-09-26', wanted_time: '10:00',
      status: 'requested', created_at: '2026-09-18T12:00:00+00:00' }),
    bok(11, { parent_id: P3, student_id: S4, wanted_date: '2026-09-30',
      status: 'cancelled', created_at: '2026-09-12T13:00:00+00:00' }),
    bok(12, { parent_id: P3, student_id: S4, wanted_date: '2026-10-05',
      status: 'confirmed', created_at: '2026-09-16T16:40:00+00:00' })
  ];

  bookings.forEach(function (b) { b.uppdrag_id = UPPDRAG_FOR[b.student_id] || null; });

  /* Fas 7.1: kund_id och uppdrag_id. Tre anmälningar som ännu inte
     blivit någon kund (null), och en som blev Karin Berg — den
     tidslinjen ska kunna visa. */
  var leads = [
    { id: 'f1000000-0000-4000-8000-000000000001', parent_name: 'Anna Sjö', email: 'anna.sjo@example.se',
      phone: '070-555 00 11', child_name: 'Ville', grade: 'Åk 6', subject: 'Matematik',
      message: 'Ville tappar i bråk och procent. Vi söker någon som kan komma hem två gånger i veckan, helst tisdagar och torsdagar efter skolan.',
      tjanst: 'laxhjalp', status: 'new', kontaktad_at: null, notering: null,
      kund_id: null, uppdrag_id: null,
      created_at: '2026-09-18T19:12:00+00:00' },
    { id: 'f1000000-0000-4000-8000-000000000002', parent_name: 'Peter Lund', email: 'peter.lund@example.se',
      phone: null, child_name: 'Saga', grade: 'Gymnasiet år 1', subject: 'Engelska',
      message: 'Inför nationella provet.',
      tjanst: 'laxhjalp', status: 'contacted', kontaktad_at: '2026-09-16T10:00:00+00:00', notering: null,
      kund_id: null, uppdrag_id: null,
      created_at: '2026-09-14T08:40:00+00:00' },
    { id: 'f1000000-0000-4000-8000-000000000003', parent_name: 'Maria Ek', email: 'maria.ek@example.se',
      phone: null, child_name: null, grade: null, subject: null, message: null,
      tjanst: 'laxhjalp', status: 'new', kontaktad_at: null, notering: null,
      kund_id: null, uppdrag_id: null,
      created_at: '2026-09-02T21:05:00+00:00' },
    { id: 'f1000000-0000-4000-8000-000000000004', parent_name: 'Karin Berg', email: 'karin.berg@example.se',
      phone: '070-111 22 33', child_name: 'Alva', grade: 'Åk 8', subject: 'Matematik',
      message: 'Alva behöver hjälp med matte och engelska, helst efter fyra.',
      tjanst: 'laxhjalp', status: 'matched', kontaktad_at: '2026-06-19T09:15:00+00:00',
      notering: 'Ringde tillbaka samma kväll.',
      kund_id: P1, uppdrag_id: UPD1,
      created_at: '2026-06-17T20:40:00+00:00' }
  ];

  var applications = [
    { id: 'f2000000-0000-4000-8000-000000000001', name: 'Ida Strand', age: 18, email: 'ida.strand@example.se',
      school: 'Norra Real', subjects: 'Matematik, Kemi', availability: 'Vardagar efter 16',
      why: 'Jag har hjälpt klasskompisar med kemi i två år och tycker om att förklara tills det sitter. Vill gärna jobba med yngre elever.',
      tjanster: ['laxhjalp'], status: 'new', kontaktad_at: null, intervju_at: null, utbildad_at: null,
      created_at: '2026-09-17T15:30:00+00:00' },
    { id: 'f2000000-0000-4000-8000-000000000002', name: 'Omar Said', age: 17, email: 'omar.said@example.se',
      school: 'Södra Latin', subjects: 'Svenska, Engelska', availability: 'Tisdagar och torsdagar',
      why: 'Läser mycket och vill hjälpa andra att hitta läslusten.',
      tjanster: ['laxhjalp'], status: 'contacted', kontaktad_at: '2026-09-12T09:00:00+00:00',
      intervju_at: '2026-09-15T14:00:00+00:00', utbildad_at: null,
      created_at: '2026-09-10T18:00:00+00:00' },
    { id: 'f2000000-0000-4000-8000-000000000003', name: 'Felix Ahl', age: 19, email: 'felix.ahl@example.se',
      school: 'KTH', subjects: 'Fysik', availability: 'Helger',
      why: null,
      tjanster: [], status: 'approved', kontaktad_at: '2026-08-22T09:00:00+00:00',
      intervju_at: '2026-08-25T13:00:00+00:00', utbildad_at: '2026-08-29T10:00:00+00:00',
      created_at: '2026-08-20T11:00:00+00:00' }
  ];

  var contact_messages = [
    { id: 'f3000000-0000-4000-8000-000000000001', name: 'Birgitta Ros', email: 'birgitta.ros@example.se',
      role: 'Förälder', message: 'Hej! Går det att få RUT-avdrag för läxhjälpen, och hur syns det i så fall på fakturan?',
      hanterad_at: null, hanterad_av: null, created_at: '2026-09-18T08:30:00+00:00' },
    { id: 'f3000000-0000-4000-8000-000000000002', name: 'Sven Tall', email: 'sven.tall@example.se',
      role: 'Skola', message: 'Vi är intresserade av ett samarbete kring läxhjälp på skolan.',
      hanterad_at: '2026-09-06T09:00:00+00:00', hanterad_av: ADMIN, created_at: '2026-09-05T13:20:00+00:00' }
  ];

  var invoices = [
    { id: 'f4000000-0000-4000-8000-000000000001', parent_id: P3, period: '2026-07-01', status: 'betald',
      belopp_ore: 37900, valuta: 'SEK', forfaller: '2026-08-11', rut_ore: 0, rut_ar: null,
      skickad_at: '2026-08-01T08:00:00+00:00', betald_at: '2026-08-05T10:12:00+00:00',
      stripe_invoice_id: null, stripe_url: null, created_at: '2026-08-01T07:55:00+00:00' },
    { id: 'f4000000-0000-4000-8000-000000000002', parent_id: P2, period: '2026-08-01', status: 'skickad',
      belopp_ore: 56850, valuta: 'SEK', forfaller: '2026-09-11', rut_ore: 0, rut_ar: null,
      skickad_at: '2026-09-01T08:00:00+00:00', betald_at: null,
      stripe_invoice_id: null, stripe_url: null, created_at: '2026-09-01T07:55:00+00:00' },
    { id: 'f4000000-0000-4000-8000-000000000003', parent_id: P1, period: '2026-09-01', status: 'utkast',
      belopp_ore: 37900, valuta: 'SEK', forfaller: null, rut_ore: 0, rut_ar: null,
      skickad_at: null, betald_at: null,
      stripe_invoice_id: null, stripe_url: null, created_at: '2026-09-18T20:00:00+00:00' },
    { id: 'f4000000-0000-4000-8000-000000000004', parent_id: P3, period: '2026-06-01', status: 'makulerad',
      belopp_ore: 37900, valuta: 'SEK', forfaller: '2026-07-11', rut_ore: 0, rut_ar: null,
      skickad_at: null, betald_at: null,
      stripe_invoice_id: null, stripe_url: null, created_at: '2026-07-01T07:55:00+00:00' }
  ];

  var payouts = [
    { id: 'f5000000-0000-4000-8000-000000000001', tutor_id: T1, period: '2026-07-01', status: 'utbetald',
      belopp_ore: 18000, minuter: 60, valuta: 'SEK', utbetald_at: '2026-08-06T09:30:00+00:00',
      stripe_transfer_id: null, fel: null, created_at: '2026-08-01T07:56:00+00:00' },
    { id: 'f5000000-0000-4000-8000-000000000002', tutor_id: T1, period: '2026-08-01', status: 'godkand',
      belopp_ore: 45000, minuter: 150, valuta: 'SEK', utbetald_at: null,
      stripe_transfer_id: null, fel: null, created_at: '2026-09-01T07:56:00+00:00' }
  ];

  var messages = [
    { id: 'f6000000-0000-4000-8000-000000000001', parent_id: P1, tutor_id: T1, sender_id: P1,
      body: 'Toppen, Alva tar med boken på måndag.', read_at: null,
      created_at: '2026-09-18T16:02:00+00:00' },
    { id: 'f6000000-0000-4000-8000-000000000002', parent_id: P1, tutor_id: T1, sender_id: T1,
      body: 'Hej! På måndag kör vi ekvationer med parentes, samma kapitel som i skolan.', read_at: '2026-09-18T15:40:00+00:00',
      created_at: '2026-09-18T15:20:00+00:00' },
    { id: 'f6000000-0000-4000-8000-000000000003', parent_id: P2, tutor_id: T1, sender_id: P2,
      body: 'Går det att flytta onsdagens pass till torsdag samma tid?', read_at: null,
      created_at: '2026-09-17T09:00:00+00:00' },
    { id: 'f6000000-0000-4000-8000-000000000004', parent_id: P3, tutor_id: T1, sender_id: T1,
      body: 'Hugo var jätteduktig i dag. Läxan ligger uppe.', read_at: '2026-09-02T18:00:00+00:00',
      created_at: '2026-09-02T17:10:00+00:00' }
  ];

  var klientfel = [
    { id: 'f7000000-0000-4000-8000-000000000001',
      meddelande: "TypeError: Cannot read properties of null (reading 'value')",
      sida: '/foralder#boka', stack: 'TypeError: Cannot read properties of null (reading \'value\')\n    at boka (nextrum-arbetsyta.js:812:20)',
      webblasare: 'Mozilla/5.0 (Provbänk)', anvandare: P1, created_at: '2026-09-18T20:11:00+00:00' },
    { id: 'f7000000-0000-4000-8000-000000000002',
      meddelande: 'Failed to fetch', sida: '/larare', stack: null,
      webblasare: 'Mozilla/5.0 (Provbänk)', anvandare: null, created_at: '2026-09-15T06:40:00+00:00' }
  ];

  var tjanster = [
    { kod: 'laxhjalp', namn: 'Läxhjälp', namn_en: 'Tutoring',
      kort: 'En studiehjälpare som nyligen läst samma kurser. Hemma hos er eller online.',
      kort_en: 'A study helper who recently took the same courses. At home or online.',
      for_kund: true, for_jobb: true, aktiv: true, ordning: 10,
      pris_per_timme_ore: 37900, extra_personer_ore: 6900, extra_personer_max: 3,
      ersattning_per_timme_ore: null, bokningstyp: 'pass', krav: {}, min_alder: null,
      rapportkrav: true, rut_berattigad: false, rut_procent: 0, kundtyp: 'privat',
      jobbtyp: 'studiehjalpare', matchningsregler: {}, uppdaterad: '2026-09-01T09:00:00+00:00' },
    { kod: 'barnvakt', namn: 'Barnvakt', namn_en: 'Babysitting',
      kort: 'Passning av barn, hemma hos er.', kort_en: null,
      for_kund: true, for_jobb: true, aktiv: false, ordning: 20,
      pris_per_timme_ore: null, extra_personer_ore: null, extra_personer_max: 1,
      ersattning_per_timme_ore: null, bokningstyp: 'pass', krav: {}, min_alder: null,
      rapportkrav: true, rut_berattigad: false, rut_procent: 0, kundtyp: 'privat',
      jobbtyp: 'studiehjalpare', matchningsregler: {}, uppdaterad: '2026-06-02T09:00:00+00:00' },
    { kod: 'hushallsnara', namn: 'Hushållsnära tjänster', namn_en: 'Household services',
      kort: 'Hjälp i hemmet.', kort_en: null,
      for_kund: true, for_jobb: true, aktiv: false, ordning: 30,
      pris_per_timme_ore: null, extra_personer_ore: null, extra_personer_max: 1,
      ersattning_per_timme_ore: null, bokningstyp: 'pass', krav: {}, min_alder: null,
      rapportkrav: true, rut_berattigad: false, rut_procent: 0, kundtyp: 'privat',
      jobbtyp: 'studiehjalpare', matchningsregler: {}, uppdaterad: '2026-06-02T09:00:00+00:00' },
    { kod: 'forsaljning', namn: 'Försäljning', namn_en: 'Sales',
      kort: 'Uppdrag åt oss och åt andra företag. Ett jobb, inte något en familj beställer.', kort_en: null,
      for_kund: false, for_jobb: true, aktiv: false, ordning: 40,
      pris_per_timme_ore: null, extra_personer_ore: null, extra_personer_max: 1,
      ersattning_per_timme_ore: null, bokningstyp: 'pass', krav: {}, min_alder: null,
      rapportkrav: true, rut_berattigad: false, rut_procent: 0, kundtyp: 'privat',
      jobbtyp: 'studiehjalpare', matchningsregler: {}, uppdaterad: '2026-06-02T09:00:00+00:00' }
  ];

  var rabattkoder = [
    { kod: 'HOST25', beskrivning: '25 % på första passet i höst', typ: 'procent', varde: 25,
      tjanst: 'laxhjalp', giltig_fran: null, giltig_till: '2026-10-31', max_anvandningar: 50,
      antal_anvandningar: 7, aktiv: true, skapad: '2026-09-01T10:00:00+00:00' },
    { kod: 'VAR100', beskrivning: null, typ: 'belopp', varde: 10000,
      tjanst: null, giltig_fran: null, giltig_till: '2026-06-30', max_anvandningar: null,
      antal_anvandningar: 3, aktiv: true, skapad: '2026-04-01T10:00:00+00:00' }
  ];

  var lesson_reports = [
    { id: 'f8000000-0000-4000-8000-000000000001', student_id: S4, tutor_id: T1, booking_id: B(1),
      lesson_date: '2026-07-14', narvaro: 'narvarande',
      raw_notes: 'Repeterade procent och förändringsfaktor. Hugo löste alla uppgifter på nivå 2.',
      went_well: 'Förändringsfaktor', needs_practice: 'Textuppgifter i flera steg', next_focus: 'Linjära funktioner',
      ai_feedback: 'Hugo arbetade fokuserat med procent och klarade alla uppgifter på nivå 2.',
      created_at: '2026-07-14T17:20:00+00:00' },
    { id: 'f8000000-0000-4000-8000-000000000002', student_id: S3, tutor_id: T1, booking_id: B(2),
      lesson_date: '2026-08-12', narvaro: 'narvarande',
      raw_notes: 'Krafter och Newtons lagar. Elin behöver rita kraftfigurer oftare.',
      went_well: 'Newtons andra lag', needs_practice: 'Kraftfigurer', next_focus: 'Rörelsemängd',
      ai_feedback: null, created_at: '2026-08-12T19:00:00+00:00' },
    { id: 'f8000000-0000-4000-8000-000000000003', student_id: S1, tutor_id: T1, booking_id: B(3),
      lesson_date: '2026-08-26', narvaro: 'franvarande',
      raw_notes: 'Alva kom inte. Skickade uppgifterna hem i stället.',
      went_well: null, needs_practice: null, next_focus: 'Oregelbundna verb',
      ai_feedback: null, created_at: '2026-08-26T17:15:00+00:00' },
    { id: 'f8000000-0000-4000-8000-000000000004', student_id: S3, tutor_id: T1, booking_id: null,
      lesson_date: '2026-09-10', narvaro: null,
      raw_notes: 'Gick igenom rörelsemängd och stötar. Två timmar, mycket räkning.',
      went_well: 'Rörelsemängd', needs_practice: 'Elastiska stötar', next_focus: 'Energiprincipen',
      ai_feedback: null, created_at: '2026-09-10T20:30:00+00:00' },
    { id: 'f8000000-0000-4000-8000-000000000005', student_id: S1, tutor_id: T1, booking_id: null,
      lesson_date: '2026-09-17', narvaro: null,
      raw_notes: 'Ekvationer med parentes. Alva fick till det mot slutet.',
      went_well: 'Förenkla uttryck', needs_practice: 'Parenteser med minustecken', next_focus: 'Ekvationer med bråk',
      ai_feedback: null, created_at: '2026-09-17T18:05:00+00:00' }
  ];

  /* Vyn passunderlag: bara genomförda pass, med svaren från vyn. */
  function pu(b, o) {
    return Object.assign({
      id: b.id, parent_id: b.parent_id, tutor_id: b.tutor_id, student_id: b.student_id,
      subject: b.subject, tjanst: b.tjanst, wanted_date: b.wanted_date, wanted_time: b.wanted_time,
      duration_min: b.duration_min, antal_barn: b.antal_barn, rabatt_ore: b.rabatt_ore,
      fakturerbar: b.fakturerbar, fakturerbar_anledning: b.fakturerbar_anledning,
      har_rapport: false, fakturerad: false, pa_underlag: false
    }, o);
  }
  function bokning(n) { return bookings.filter(function (b) { return b.id === B(n); })[0]; }
  var passunderlag = [
    pu(bokning(2), { har_rapport: true }),
    pu(bokning(3), { har_rapport: true }),
    pu(bokning(4), {}),
    pu(bokning(5), {})
  ];

  /* Vyn matchningsunderlag. Omar Said står med fast han väntar på
     godkännande — i den riktiga vyn skulle han inte göra det, men med
     en enda rad blir rangordningen aldrig prövad. */
  var matchningsunderlag = [
    { tutor_id: T1, namn: 'Elsa Nyström', email: 'elsa.nystrom@example.se', ort: 'Stockholm',
      amnen: ['Matematik', 'Fysik', 'Engelska'], arskurser: ['Åk 7–9', 'Gymnasiet'],
      format: ['Online', 'Hemma hos familjen'], timpris: 180,
      bio: 'Läser teknisk fysik och har hjälpt syskon med matte i flera år.',
      antal_elever: 3, genomforda_pass: 6, veckodagar: [0, 2] },
    { tutor_id: T2, namn: 'Omar Said', email: 'omar.said@example.se', ort: 'Stockholm',
      amnen: ['Svenska', 'Engelska'], arskurser: ['Åk 4–6'],
      format: ['Online'], timpris: null, bio: null,
      antal_elever: 0, genomforda_pass: 0, veckodagar: null }
  ];

  var admin_lage = [
    { nya_leads: 2, nya_ansokningar: 1, vantande_studiehjalpare: 1, omatchade_familjer: 0,
      ohanterade_meddelanden: 1, kommande_pass: 5, obesvarade_pass: 3,
      obetalda_fakturor: 1, obetalt_ore: 56850, vantande_utbetalningar: 1, att_betala_ut_ore: 45000,
      /* Fas 6 */
      pass_utan_rapport: 2, forfallna_fakturor: 1, oppna_uppgifter: 3, forsenade_uppgifter: 1,
      klientfel_24h: 1 }
  ];

  var foretagsfakta = [
    { id: 1, organisationsnummer: '559000-0000', bolagsform: 'ab', rakenskapsar_slut: '12-31',
      momsregistrerad: true, momsperiod: 'kvartal', f_skatt: true, arbetsgivarregistrerad: false,
      studiehjalpare_form: 'oklart', bokforingssystem: 'fortnox', redovisningskonsult: null,
      anteckningar: 'Testdata för provbänken.', uppdaterad: '2026-09-10T12:00:00+00:00' }
  ];

  var agent_korningar = [
    { id: 'f9000000-0000-4000-8000-000000000001', agent: 'juridik',
      fraga: 'Gäller ångerrätt när en familj bokar ett läxhjälpspass hos oss?',
      svar: 'Ja, i regel. Ett avtal om läxhjälp som ingås på distans är ett distansavtal.\n\nKällor\n· https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2005-59-om-distansavtal-och-avtal-utanfor_sfs-2005-59/',
      status: 'klar', anledning: null,
      kallor: ['https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2005-59-om-distansavtal-och-avtal-utanfor_sfs-2005-59/'],
      steg_antal: 4, in_tokens: 12000, ut_tokens: 900, skapad_av: ADMIN,
      skapad: '2026-09-18T10:15:00+00:00', avslutad: '2026-09-18T10:16:05+00:00' }
  ];

  var admin_noteringar = [
    { id: 'fa000000-0000-4000-8000-000000000001', om_profil: P1,
      text: 'Vill ha fakturan som PDF, inte bara i mejlet.', skriven_av: ADMIN,
      created_at: '2026-09-12T10:00:00+00:00' },
    { id: 'fa000000-0000-4000-8000-000000000002', om_profil: P1,
      text: 'Nils kan börja när en svensklärare finns ledig.', skriven_av: ADMIN,
      created_at: '2026-08-30T15:30:00+00:00' },
    { id: 'fa000000-0000-4000-8000-000000000003', om_profil: T1,
      text: 'Kan ta en fjärde elev från oktober.', skriven_av: ADMIN,
      created_at: '2026-09-14T09:10:00+00:00' }
  ];

  var study_plans = [
    { id: 'fb000000-0000-4000-8000-000000000001', student_id: S1, tutor_id: T1, subject: 'Matematik',
      goals: 'B i matematik till jul.',
      plan_text: 'September: ekvationer. Oktober: procent och förändringsfaktor. November: repetition inför provet.',
      created_at: '2026-08-27T18:00:00+00:00', updated_at: '2026-09-17T18:10:00+00:00' },
    { id: 'fb000000-0000-4000-8000-000000000002', student_id: S3, tutor_id: T1, subject: 'Fysik',
      goals: 'Fysik 2.', plan_text: 'Mekanik under hösten.',
      created_at: '2026-03-20T18:00:00+00:00', updated_at: '2026-08-12T19:05:00+00:00' }
  ];

  var homework = [
    { id: 'fc000000-0000-4000-8000-000000000001', student_id: S1, tutor_id: T1,
      title: 'Ekvationer s. 42–43', instructions: 'Uppgift 1–12.', subject: 'Matematik',
      due_date: '2026-09-21', status: 'ej_paborjad', completed_at: null,
      created_at: '2026-09-17T18:12:00+00:00' },
    { id: 'fc000000-0000-4000-8000-000000000002', student_id: S1, tutor_id: T1,
      title: 'Glosor kapitel 3', instructions: null, subject: 'Engelska',
      due_date: '2026-09-10', status: 'klar', completed_at: '2026-09-09T19:00:00+00:00',
      created_at: '2026-09-01T18:00:00+00:00' },
    { id: 'fc000000-0000-4000-8000-000000000003', student_id: S3, tutor_id: T1,
      title: 'Rörelsemängd, blad 2', instructions: null, subject: 'Fysik',
      due_date: '2026-09-22', status: 'pagaende', completed_at: null,
      created_at: '2026-09-10T20:40:00+00:00' }
  ];

  var materials = [
    { id: 'fd000000-0000-4000-8000-000000000001', student_id: S1, tutor_id: T1,
      title: 'Ekvationer med parentes — tio övningar', kind: 'anteckning', url: null,
      body: '1) 3(x + 2) = 18 …', subject: 'Matematik', file_name: null, file_size: null,
      created_at: '2026-09-17T18:15:00+00:00' },
    { id: 'fd000000-0000-4000-8000-000000000002', student_id: S1, tutor_id: T1,
      title: 'Oregelbundna verb', kind: 'lank', url: 'https://example.se/verb',
      body: null, subject: 'Engelska', file_name: null, file_size: null,
      created_at: '2026-08-27T18:20:00+00:00' }
  ];

  var progress_items = [
    { id: 'fe000000-0000-4000-8000-000000000001', student_id: S1, tutor_id: T1,
      subject: 'Matematik', area: 'Ekvationer', level: 'pa_god_vag',
      comment: 'Parenteser med minustecken återstår.', updated_at: '2026-09-17T18:11:00+00:00',
      created_at: '2026-08-27T18:00:00+00:00' },
    { id: 'fe000000-0000-4000-8000-000000000002', student_id: S1, tutor_id: T1,
      subject: 'Engelska', area: 'Oregelbundna verb', level: 'behover_trana',
      comment: null, updated_at: '2026-08-26T17:20:00+00:00',
      created_at: '2026-08-26T17:20:00+00:00' },
    { id: 'fe000000-0000-4000-8000-000000000003', student_id: S1, tutor_id: T1,
      subject: 'Matematik', area: 'Förenkla uttryck', level: 'bra',
      comment: null, updated_at: '2026-09-17T18:11:00+00:00',
      created_at: '2026-09-02T18:00:00+00:00' }
  ];

  var tutor_availability = [
    { id: 'ff000000-0000-4000-8000-000000000001', tutor_id: T1, weekday: 0,
      start_time: '15:00:00', end_time: '19:00:00', created_at: '2026-03-03T10:00:00+00:00' },
    { id: 'ff000000-0000-4000-8000-000000000002', tutor_id: T1, weekday: 2,
      start_time: '16:00:00', end_time: '20:00:00', created_at: '2026-03-03T10:00:00+00:00' },
    { id: 'ff000000-0000-4000-8000-000000000003', tutor_id: T2, weekday: 1,
      start_time: '15:00:00', end_time: '18:00:00', created_at: '2026-09-15T16:40:00+00:00' }
  ];

  var tutor_blocked = [
    { id: 'f0000000-0000-4000-8000-000000000001', tutor_id: T1, block_date: '2026-09-01',
      block_time: null, reason: 'Upprop på KTH', created_at: '2026-08-20T10:00:00+00:00' },
    { id: 'f0000000-0000-4000-8000-000000000002', tutor_id: T1, block_date: '2026-09-25',
      block_time: null, reason: 'Tenta', created_at: '2026-09-10T10:00:00+00:00' },
    { id: 'f0000000-0000-4000-8000-000000000003', tutor_id: T1, block_date: '2026-10-07',
      block_time: '16:00', reason: null, created_at: '2026-09-10T10:05:00+00:00' }
  ];

  /* ---------- Fas 5.2 och Fas 6 ---------- */
  var uppdrag = [
    { id: UPD1, kund_id: P1, tjanst: 'laxhjalp', typ: 'lopande', status: 'aktivt',
      beskrivning: 'Läxhjälp för Alva, matematik och engelska.', created_at: '2026-08-25T18:00:00+00:00' },
    { id: UPD2, kund_id: P1, tjanst: 'laxhjalp', typ: 'lopande', status: 'pausat',
      beskrivning: 'Väntar på en studiehjälpare i svenska.', created_at: '2026-06-20T18:10:00+00:00' },
    { id: UPD3, kund_id: P2, tjanst: 'laxhjalp', typ: 'lopande', status: 'aktivt',
      beskrivning: null, created_at: '2026-03-15T09:00:00+00:00' },
    { id: UPD4, kund_id: P3, tjanst: 'laxhjalp', typ: 'engang', status: 'aktivt',
      beskrivning: 'Inför nationella provet i matematik.', created_at: '2026-05-05T15:45:00+00:00' }
  ];

  /* En försenad (förföll i förrgår), en pågående, en från AI och en klar. */
  var uppgifter = [
    { id: '0b000000-0000-4000-8000-000000000001', typ: 'uppfoljning',
      titel: 'Ring Anna Sjö om intresseanmälan',
      beskrivning: 'Hon vill ha någon hemma två gånger i veckan.',
      status: 'oppen', ansvarig: ADMIN, kopplad_tabell: 'leads',
      kopplad_id: 'f1000000-0000-4000-8000-000000000001', skapad_av: ADMIN, skapad_av_typ: 'manniska',
      forfallodag: '2026-09-17', created_at: '2026-09-15T08:30:00+00:00',
      uppdaterad: '2026-09-15T08:30:00+00:00', klar_at: null },
    { id: '0b000000-0000-4000-8000-000000000002', typ: 'kontroll',
      titel: 'Kontrollera augustifakturan till Johan Ek',
      beskrivning: null,
      status: 'pagar', ansvarig: ADMIN, kopplad_tabell: 'invoices',
      kopplad_id: 'f4000000-0000-4000-8000-000000000002', skapad_av: null, skapad_av_typ: 'system',
      forfallodag: '2026-09-22', created_at: '2026-09-12T02:00:00+00:00',
      uppdaterad: '2026-09-16T09:10:00+00:00', klar_at: null },
    { id: '0b000000-0000-4000-8000-000000000003', typ: 'problem',
      titel: 'Passet 2 september saknar rapport',
      beskrivning: 'Förslag: påminn Elsa Nyström om rapporten, annars faktureras passet inte.',
      status: 'oppen', ansvarig: null, kopplad_tabell: 'bookings',
      kopplad_id: B(4), skapad_av: null, skapad_av_typ: 'ai',
      forfallodag: '2026-09-25', created_at: '2026-09-18T06:00:00+00:00',
      uppdaterad: '2026-09-18T06:00:00+00:00', klar_at: null },
    /* Fas 7.3: en av kontrollernas egna uppgifter, kopplad direkt
       till familjen. Den ska synas både under Automationer och på
       familjens tidslinje. */
    { id: '0b000000-0000-4000-8000-000000000005', typ: 'uppfoljning',
      titel: 'Karin Berg har inget matchat barn kvar i svenska',
      beskrivning: 'Nils uppdrag är pausat sedan juni. Fråga om det ska öppnas igen.',
      status: 'oppen', ansvarig: null, kopplad_tabell: 'profiles',
      kopplad_id: P1, skapad_av: null, skapad_av_typ: 'system',
      forfallodag: '2026-09-24', created_at: '2026-09-19T02:00:00+00:00',
      uppdaterad: '2026-09-19T02:00:00+00:00', klar_at: null },
    { id: '0b000000-0000-4000-8000-000000000004', typ: 'ovrigt',
      titel: 'Uppdatera priset på prissidan',
      beskrivning: null,
      status: 'klar', ansvarig: ADMIN, kopplad_tabell: null, kopplad_id: null,
      skapad_av: ADMIN, skapad_av_typ: 'manniska',
      forfallodag: '2026-09-10', created_at: '2026-09-01T09:00:00+00:00',
      uppdaterad: '2026-09-09T15:00:00+00:00', klar_at: '2026-09-09T15:00:00+00:00' }
  ];

  /* nyckel finns på tabellen sedan Fas 6.2 och är det som hindrar
     dubbletter. De fyra ovan skrevs för hand eller av en äldre
     körning och saknar den; kontrollerna nedan sätter alltid en. */
  uppgifter.forEach(function (u) { if (!('nyckel' in u)) u.nyckel = null; });

  /* ------------------------------------------------------------
     kor_kontrollerna() — Fas 7.3d/7.4

     Till skillnad från alla andra rpc:er i fixturen är den här en
     FUNKTION, för den enda intressanta frågan är vad den GÖR: den
     skapar rader i uppgifter. En stum siffra hade aldrig kunnat
     visa blockeraren där uppgift_stampel stämplade om maskinens
     'system' till 'manniska', och listan "Uppgifter kontrollerna
     skapat" därför stod tom direkt efter "✓ 7 nya uppgifter".

     Raderna får skapad_av_typ 'system' och skapad_av null, som
     skapa_uppgift sätter dem med flaggan nextrum.maskin.

     Nycklarna är ordagrant desamma som i migrationen fas7_3c:
       kontroll:saknad_rapport:bookings:<id>
       avvikelse:<typ>:<tabell>:<id>
       avvikelse:faktura_forfallen:invoices:<id>
       uppfoljning:lead:<id>:<steg>
     En andra körning ska därför ge noll nya.
     ------------------------------------------------------------ */
  var uppgLöpnr = 100;

  function körKontrollerna() {
    var skapade = { saknade_rapporter: 0, ekonomiska_avvikelser: 0,
                    forfallna_fakturor: 0, uppfoljningar: 0 };

    function skapa(gren, nyckel, typ, titel, beskrivning, tabell, radid, forfaller) {
      var finns = uppgifter.some(function (u) {
        return u.nyckel === nyckel && (u.status === 'oppen' || u.status === 'pagar');
      });
      if (finns) return;
      uppgLöpnr += 1;
      uppgifter.unshift({
        id: '0b000000-0000-4000-8000-000000000' + uppgLöpnr,
        typ: typ, titel: titel, beskrivning: beskrivning,
        status: 'oppen', ansvarig: null,
        kopplad_tabell: tabell, kopplad_id: radid,
        skapad_av: null, skapad_av_typ: 'system', nyckel: nyckel,
        forfallodag: forfaller,
        created_at: new Date().toISOString(), uppdaterad: new Date().toISOString(),
        klar_at: null
      });
      skapade[gren] += 1;
    }

    /* 1. Pass utan rapport. */
    ekonomiska_avvikelser.filter(function (a) { return a.typ === 'pass_utan_rapport'; })
      .forEach(function (a) {
        skapa('saknade_rapporter', 'kontroll:saknad_rapport:bookings:' + a.objekt_id,
          'kontroll', 'Passet ' + a.datum + ' saknar rapport',
          'Utan rapport faktureras passet inte och betalas inte ut.',
          'bookings', a.objekt_id, '2026-09-26');
      });

    /* 2. Övriga ekonomiska avvikelser — allt utom pass_utan_rapport
       och faktura_forfallen, som har var sin egen kontroll. */
    ekonomiska_avvikelser.filter(function (a) {
      return a.typ !== 'pass_utan_rapport' && a.typ !== 'faktura_forfallen';
    }).forEach(function (a) {
      skapa('ekonomiska_avvikelser',
        'avvikelse:' + a.typ + ':' + a.objekt_tabell + ':' + a.objekt_id,
        'problem', 'Ekonomisk avvikelse: ' + a.typ,
        'Hittad av kontrollen ' + a.datum + '.', a.objekt_tabell, a.objekt_id, '2026-09-26');
    });

    /* 3. Förfallna fakturor. */
    ekonomiska_avvikelser.filter(function (a) { return a.typ === 'faktura_forfallen'; })
      .forEach(function (a) {
        skapa('forfallna_fakturor',
          'avvikelse:faktura_forfallen:invoices:' + a.objekt_id,
          'problem', 'Förfallen faktura',
          'Skickad och obetald. Påminnelsen skickar du själv från Ekonomi.',
          'invoices', a.objekt_id, '2026-09-23');
      });

    /* 4. Uppföljning: anmälningar och ansökningar ingen svarat på. */
    leads.filter(function (l) { return l.status === 'new' && !l.kontaktad_at; })
      .forEach(function (l) {
        skapa('uppfoljningar', 'uppfoljning:lead:' + l.id + ':1',
          'uppfoljning', 'Svara ' + (l.parent_name || 'anmälan'),
          'Anmälan har legat obesvarad.', 'leads', l.id, '2026-09-22');
      });
    applications.filter(function (a) { return a.status === 'new' && !a.kontaktad_at; })
      .forEach(function (a) {
        skapa('uppfoljningar', 'uppfoljning:ansokan:' + a.id + ':1',
          'uppfoljning', 'Svara ' + (a.name || 'ansökan'),
          'Ansökan har legat obesvarad.', 'applications', a.id, '2026-09-22');
      });

    var nya = skapade.saknade_rapporter + skapade.ekonomiska_avvikelser
            + skapade.forfallna_fakturor + skapade.uppfoljningar;

    /* window.__PROV_KONTROLLFEL låter provet pröva grenen där en
       kontroll fallit utan att de andra tre gjort det. */
    return {
      kord: '2026-09-19T12:00:00',
      saknade_rapporter: skapade.saknade_rapporter,
      ekonomiska_avvikelser: skapade.ekonomiska_avvikelser,
      forfallna_fakturor: skapade.forfallna_fakturor,
      uppfoljningar: skapade.uppfoljningar,
      nya_uppgifter: nya,
      fel: window.__PROV_KONTROLLFEL || []
    };
  }

  /* ============================================================
     FAS 8 — AI:n

     matchningsforslag() flyttade poängräkningen från webbläsaren
     till databasen. För att provet ska kunna säga att MENINGARNA är
     desamma räknar fixturen med den GAMLA JavaScript-funktionen,
     ordagrant som den såg ut före Fas 8, och lämnar ut resultatet i
     databasens radform. Skiljer sig en mening från förra körningen
     är det vyn som ändrat sig, inte provbänken.
     ============================================================ */
  var VIKT = { amne: 50, arskurs: 30, utrymme: 12, erfarenhet: 8 };

  function tolkaNiva(text) {
    var t = String(text || '').toLowerCase();
    var gym = t.indexOf('gymnas') !== -1;
    var siffror = (t.match(/\d+/g) || []).map(Number);
    if (gym) return { gym: true, från: siffror[0] || null, till: siffror[1] || siffror[0] || null };
    if (!siffror.length) return null;
    return { gym: false, från: siffror[0], till: siffror.length > 1 ? siffror[1] : siffror[0] };
  }

  function nivåTäcker(tutorNivåer, elevNivå) {
    var e = tolkaNiva(elevNivå);
    if (!e) return null;
    var lista = (tutorNivåer || []).map(tolkaNiva).filter(Boolean);
    if (!lista.length) return null;
    return lista.some(function (n) {
      if (e.gym) return n.gym;
      if (n.gym) return false;
      return e.från >= n.från && e.från <= n.till;
    });
  }

  function normalisera(s) {
    return String(s || '').toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim();
  }

  function ämnenSomMöts(elevÄmnen, tutorÄmnen) {
    var e = (elevÄmnen || []).map(normalisera).filter(Boolean);
    var t = (tutorÄmnen || []).map(normalisera).filter(Boolean);
    if (!e.length || !t.length) return null;
    var träffar = e.filter(function (x) {
      return t.some(function (y) { return y.indexOf(x) !== -1 || x.indexOf(y) !== -1; });
    });
    return { träffar: träffar, andel: träffar.length / e.length };
  }

  function matchrad(elev, tutor) {
    var poäng = 0;
    var ä = ämnenSomMöts(elev.subjects, tutor.amnen);
    var amne_utfall, amne_traffar = 0, amne_av = (elev.subjects || []).length;
    if (ä === null) { poäng += VIKT.amne / 2; amne_utfall = 'vet_ej'; }
    else if (ä.träffar.length) {
      poäng += VIKT.amne * ä.andel; amne_utfall = 'ja'; amne_traffar = ä.träffar.length;
    } else { amne_utfall = 'nej'; }

    var n = nivåTäcker(tutor.arskurser, elev.grade);
    var arskurs_utfall;
    if (n === null) { poäng += VIKT.arskurs / 2; arskurs_utfall = 'vet_ej'; }
    else if (n) { poäng += VIKT.arskurs; arskurs_utfall = 'ja'; }
    else { arskurs_utfall = 'nej'; }

    var antal = Number(tutor.antal_elever || 0);
    poäng += VIKT.utrymme * Math.max(0, 1 - antal / 5);
    var pass = Number(tutor.genomforda_pass || 0);
    poäng += VIKT.erfarenhet * Math.min(1, pass / 10);

    var hart_nej = amne_utfall === 'nej' || arskurs_utfall === 'nej';
    if (hart_nej) poäng = Math.min(poäng, 49);

    return {
      tutor_id: tutor.tutor_id, poang: Math.round(poäng),
      amne_utfall: amne_utfall, amne_traffar: amne_traffar, amne_av: amne_av,
      arskurs_utfall: arskurs_utfall,
      antal_elever: antal, genomforda_pass: pass, hart_nej: hart_nej
    };
  }

  /* window.__PROV_MATCHFEL gör att anropet svarar med ett fel, för
     att pröva vad panelen gör när poängen inte går att räkna. */
  function matchningsforslag(args) {
    if (window.__PROV_MATCHFEL) return { __fel: window.__PROV_MATCHFEL };
    var elev = students.filter(function (e) { return e.id === (args || {}).p_elev; })[0];
    if (!elev) return [];
    return matchningsunderlag.map(function (t) { return matchrad(elev, t); })
      .sort(function (a, b) { return b.poang - a.poang; });
  }

  /* ---------- förslagskön ---------- */
  var ai_forslag = [
    { id: 'a1000000-0000-4000-8000-000000000001', typ: 'matchning',
      payload: { elev_id: S2, studiehjalpare_id: T2 },
      motivering: 'Omar undervisar svenska för åk 4–6 och har inga elever sedan tidigare. '
        + 'Nils läser svenska i åk 5.',
      status: 'foreslagen', nyckel: 'matchning:' + S2 + ':' + T2,
      korning_id: null, kopplad_tabell: 'students', kopplad_id: S2,
      skapad: '2026-09-19T06:30:00+00:00', beslutad_av: null, beslutad: null,
      utford: null, fel: null },
    { id: 'a1000000-0000-4000-8000-000000000002', typ: 'pass_ej_fakturerbart',
      payload: { pass_id: B(3) },
      motivering: 'Eleven uteblev, och anteckningen säger att ingen debitering överenskommits.',
      status: 'utford', nyckel: 'pass_ej_fakturerbart:' + B(3),
      korning_id: null, kopplad_tabell: 'bookings', kopplad_id: B(3),
      skapad: '2026-09-18T06:30:00+00:00', beslutad_av: ADMIN,
      beslutad: '2026-09-18T09:12:00+00:00', utford: '2026-09-18T09:12:00+00:00', fel: null },
    { id: 'a1000000-0000-4000-8000-000000000003', typ: 'lead_status',
      payload: { lead_id: 'f1000000-0000-4000-8000-000000000003', status: 'contacted' },
      motivering: 'Anmälan saknar både barn och ämne, och ingen har hört av sig på två veckor.',
      status: 'avvisad', nyckel: 'lead_status:f1000000-0000-4000-8000-000000000003',
      korning_id: null, kopplad_tabell: 'leads', kopplad_id: 'f1000000-0000-4000-8000-000000000003',
      skapad: '2026-09-17T06:30:00+00:00', beslutad_av: ADMIN,
      beslutad: '2026-09-17T08:00:00+00:00', utford: null,
      fel: 'Vi ringde henne redan i förrgår — anmälan är inte obesvarad.' },
    { id: 'a1000000-0000-4000-8000-000000000004', typ: 'matchning',
      payload: { elev_id: S2, studiehjalpare_id: T1 },
      motivering: null,
      status: 'foreslagen', nyckel: 'matchning:' + S2 + ':' + T1,
      korning_id: null, kopplad_tabell: 'students', kopplad_id: S2,
      skapad: '2026-09-19T06:31:00+00:00', beslutad_av: null, beslutad: null,
      utford: null, fel: null }
  ];

  function godkann_forslag(args) {
    var f = ai_forslag.filter(function (x) { return x.id === (args || {}).p_id; })[0];
    if (!f) return { __fel: { message: 'Förslaget finns inte.', code: 'P0002' } };
    if (window.__PROV_GODKANNFEL) return { __fel: window.__PROV_GODKANNFEL };
    f.status = 'utford'; f.beslutad_av = ADMIN;
    f.beslutad = new Date().toISOString(); f.utford = new Date().toISOString();
    return { id: f.id, typ: f.typ, status: 'utford' };
  }

  function avvisa_forslag(args) {
    var f = ai_forslag.filter(function (x) { return x.id === (args || {}).p_id; })[0];
    if (!f) return { __fel: { message: 'Förslaget finns inte.', code: 'P0002' } };
    f.status = 'avvisad'; f.beslutad_av = ADMIN;
    f.beslutad = new Date().toISOString();
    f.fel = (args || {}).p_anledning || null;
    return { id: f.id, typ: f.typ, status: 'avvisad' };
  }

  /* ---------- edge-funktionen drift ---------- */
  function drift(kropp) {
    kropp = kropp || {};
    if (window.__PROV_DRIFTFEL) {
      return { __fel: 'drift svarade 500', __status: 500,
               __kropp: { error: window.__PROV_DRIFTFEL } };
    }
    if (kropp.sjalvtest) {
      return {
        nyckel_satt: false,
        nya_leads: { rader: 2, falt: ['id', 'skapad', 'tjanst', 'status', 'har_barn', 'har_amne'] },
        omatchade_elever: { rader: 1, falt: ['elev_id', 'arskurs', 'amnen', 'dagar_sedan'] },
        kommande_pass: { rader: 5, falt: ['pass_id', 'datum', 'tid', 'minuter', 'status', 'har_hjalpare'] },
        saknade_rapporter: { rader: 2, falt: ['pass_id', 'datum', 'dagar_sedan'] }
      };
    }
    return {
      svar: 'Två anmälningar väntar på svar, och ett pass den 2 september saknar rapport. '
        + 'Jag har lagt ett matchningsförslag för Nils Berg i kön.',
      steg: 3,
      korning_id: 'f9000000-0000-4000-8000-000000000009',
      pafyllnad: '12 000 tecken läst'
    };
  }

  /* Auditloggen: bara id, status, belopp och datum, som triggrarna
     skriver den. Objekt-id är text; för tjänster är det koden. */
  var audit_logg = [
    { id: 1, tid: '2026-06-02T09:00:00+00:00', aktor: ADMIN, aktor_typ: 'admin',
      handling: 'tjanst.aktiverad', tabell: 'tjanster', objekt_id: 'laxhjalp',
      fore: { aktiv: false }, efter: { aktiv: true } },
    { id: 2, tid: '2026-08-05T10:12:00+00:00', aktor: ADMIN, aktor_typ: 'admin',
      handling: 'faktura.status', tabell: 'invoices', objekt_id: 'f4000000-0000-4000-8000-000000000001',
      fore: { status: 'skickad', betald_at: null },
      efter: { status: 'betald', betald_at: '2026-08-05T10:12:00+00:00' } },
    { id: 3, tid: '2026-08-26T09:00:00+00:00', aktor: ADMIN, aktor_typ: 'admin',
      handling: 'matchning.andrad', tabell: 'students', objekt_id: S1,
      fore: { matched_tutor_id: null, match_status: 'pending' },
      efter: { matched_tutor_id: T1, match_status: 'matched' } },
    { id: 4, tid: '2026-09-12T14:00:00+00:00', aktor: ADMIN, aktor_typ: 'admin',
      handling: 'utbetalning.status', tabell: 'payouts', objekt_id: 'f5000000-0000-4000-8000-000000000002',
      fore: { status: 'utkast' }, efter: { status: 'godkand' } },
    { id: 5, tid: '2026-09-18T11:30:00+00:00', aktor: ADMIN, aktor_typ: 'admin',
      handling: 'skatteuppgifter.lasta', tabell: 'kund_skatteuppgifter', objekt_id: P1,
      fore: null, efter: null },
    { id: 6, tid: '2026-09-18T20:00:00+00:00', aktor: null, aktor_typ: 'system',
      handling: 'faktura.skapad', tabell: 'invoices', objekt_id: 'f4000000-0000-4000-8000-000000000003',
      fore: null,
      efter: { id: 'f4000000-0000-4000-8000-000000000003', parent_id: P1, period: '2026-09-01',
        status: 'utkast', belopp_ore: 37900, rut_ore: 0, rut_ar: null, valuta: 'SEK',
        forfaller: null, skickad_at: null, betald_at: null, stripe_invoice_id: null } }
  ];

  var rut_tak = [
    { ar: 2026, tak_ore: 7500000,
      kalla: 'skatteverket.se, Rot- och rutavdrag, belopp och tak, hämtad 2026-01-02',
      uppdaterad: '2026-01-02T10:00:00+00:00' }
  ];

  /* rpc ekonomiska_avvikelser(): samma kolumner som funktionen, i
     funktionens ordning (en union all per typ). De fem första följer av
     fixturerna ovan. timpenning_saknas gör det inte — Elsa har en
     timpenning — men står med så att den typen också ritas. */
  var ekonomiska_avvikelser = [
    { typ: 'pass_utan_rapport', objekt_tabell: 'bookings', objekt_id: B(4), datum: '2026-09-02',
      belopp_ore: null, kund_id: P3, studiehjalpare_id: T1 },
    { typ: 'pass_utan_rapport', objekt_tabell: 'bookings', objekt_id: B(5), datum: '2026-09-09',
      belopp_ore: null, kund_id: P2, studiehjalpare_id: T1 },
    { typ: 'fristaende_rapport', objekt_tabell: 'lesson_reports', objekt_id: 'f8000000-0000-4000-8000-000000000004',
      datum: '2026-09-10', belopp_ore: null, kund_id: null, studiehjalpare_id: T1 },
    { typ: 'ej_fakturerat', objekt_tabell: 'bookings', objekt_id: B(2), datum: '2026-08-12',
      belopp_ore: null, kund_id: P2, studiehjalpare_id: T1 },
    { typ: 'ej_utbetalt', objekt_tabell: 'bookings', objekt_id: B(2), datum: '2026-08-12',
      belopp_ore: null, kund_id: P2, studiehjalpare_id: T1 },
    { typ: 'faktura_forfallen', objekt_tabell: 'invoices', objekt_id: 'f4000000-0000-4000-8000-000000000002',
      datum: '2026-09-11', belopp_ore: 56850, kund_id: P2, studiehjalpare_id: null },
    { typ: 'timpenning_saknas', objekt_tabell: 'bookings', objekt_id: B(5), datum: '2026-09-09',
      belopp_ore: null, kund_id: P2, studiehjalpare_id: T1 }
  ];

  var agent_steg = [
    { id: 1, korning_id: 'f9000000-0000-4000-8000-000000000001', steg: 1, verktyg: 'hamta',
      argument: { varfor: 'Läsa distansavtalslagen' },
      kalla: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2005-59-om-distansavtal-och-avtal-utanfor_sfs-2005-59/',
      resultat_kort: 'Lagtexten hämtad.', fel: null }
  ];

  window.__PROV_DATA = {
    nu: '2026-09-19T12:00:00+02:00',
    anvandare: {
      id: ADMIN, email: 'sara.lind@example.se', aud: 'authenticated', role: 'authenticated',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-12T09:00:00+00:00'
    },
    tabeller: {
      profiles: profiles,
      tutor_profiles: tutor_profiles,
      students: students,
      bookings: bookings,
      leads: leads,
      applications: applications,
      contact_messages: contact_messages,
      invoices: invoices,
      payouts: payouts,
      messages: messages,
      klientfel: klientfel,
      prissattning: [{ id: true, pris_per_timme_ore: 37900, uppdaterad: '2026-09-01T09:00:00+00:00' }],
      integrationer: [
        { tjanst: 'google_workspace', kopplad: false, konto: null, kopplad_av: null, kopplad_at: null,
          senaste_synk: null, senaste_fel: null, uppdaterad: '2026-09-01T09:00:00+00:00' },
        { tjanst: 'fortnox', kopplad: true, konto: 'Nextrum AB (testbolag)', kopplad_av: ADMIN,
          kopplad_at: '2026-08-15T09:00:00+00:00', senaste_synk: '2026-09-18T02:00:00+00:00',
          senaste_fel: 'Kundfaktura 1042 saknar kundnummer.', uppdaterad: '2026-09-18T02:00:00+00:00' }
      ],
      tjanster: tjanster,
      rabattkoder: rabattkoder,
      lesson_reports: lesson_reports,
      passunderlag: passunderlag,
      matchningsunderlag: matchningsunderlag,
      admin_lage: admin_lage,
      foretagsfakta: foretagsfakta,
      agent_korningar: agent_korningar,
      agent_steg: agent_steg,
      admin_noteringar: admin_noteringar,
      study_plans: study_plans,
      homework: homework,
      materials: materials,
      progress_items: progress_items,
      tutor_availability: tutor_availability,
      tutor_blocked: tutor_blocked,
      uppdrag: uppdrag,
      uppgifter: uppgifter,
      audit_logg: audit_logg,
      rut_tak: rut_tak,
      ai_forslag: ai_forslag
    },
    rpc: {
      notisfel: [
        { id: 991, tidpunkt: '2026-09-19T07:45:00+00:00', status_kod: 401, tog_slut: false,
          fel: 'Unauthorized' }
      ],
      kolla_rabattkod: [],
      ekonomiska_avvikelser: ekonomiska_avvikelser,

      /* Fas 7.3d/7.4. En funktion, inte ett tal: se kommentaren vid
         körKontrollerna. Stubben anropar den och lämnar ut svaret
         som skalär, precis som en jsonb från dagliga_kontroller(). */
      kor_kontrollerna: körKontrollerna,

      /* pg_cron är inte installerat, så funktionen finns inte.
         PostgREST svarar PGRST202, och Automationer ska då visa
         "Inget schema installerat". */
      /* Fas 8 */
      matchningsforslag: matchningsforslag,
      godkann_forslag: godkann_forslag,
      avvisa_forslag: avvisa_forslag,

      driftkorningar: {
        __fel: {
          message: 'Could not find the function public.driftkorningar(dagar) in the schema cache',
          details: null,
          hint: 'Perhaps you meant to call the function public.dagliga_kontroller',
          code: 'PGRST202'
        }
      }
    },

    /* Edge-funktionerna. Fas 8 lade till drift; juridik och ekonomi
       saknar fixtur och svarar som förut med {}. */
    funktioner: {
      drift: drift
    }
  };
})();
