/* ============================================================
   NEXTRUM — förhandsvisningen av studievyn och studiehjälparvyn
   (forhandsvisning, 2026-10-12)

   Leo: "bygg två förhandsgranskningvyer där till vår admin vy, där ska
   vi med våra konton kunna se en förhandsgranskning av studievy och
   studielärarvyn. detta är för att vi inte ska ha riktiga konton i
   vyerna samt att det ska visas felaktig statistik för oss".

   /foralder?forhandsvisning och /larare?forhandsvisning är samma vyer
   som familjerna och studiehjälparna har, för en påhittad familj (Anna
   och Alva Andersson) och en påhittad studiehjälpare (Sara Svensson),
   med pass, rapporter, NexLäx, meddelanden och ett förslag från barnet.
   Allt går att klicka på. Länkarna står under Förhandsvisning i
   adminvyn.

   INGET LÄMNAR WEBBLÄSAREN. Vyn får en vanlig supabase-js-klient med en
   egen fetch, som svarar ur en värld i webbläsaren, och en egen websocket
   som inte går någonstans. De två vyerna delar världen (localStorage):
   föreslå en tid som familjen, byt vy i remsan och acceptera den som
   studiehjälparen. Inga mejl, inga betalningar, ingen AI: edge-
   funktionerna svarar att det inte görs här. Inget konto behövs, och
   inget hamnar i databasen: inte i statistiken, lönerna, fakturorna,
   auditloggen eller hos en familj.

   Vem som får se den: den som är inloggad som admin i samma webbläsare.
   Den riktiga inloggningen frågar den riktiga databasen en enda sak,
   mina_behorigheter(); allt annat går till världen. Det är bekvämlighet,
   inte skydd: allt i världen är påhittat och står i den här filen. Utan
   adminroll leder sidan till adminvyn.

   Filen laddas före nextrum-app.js på /foralder och /larare och gör
   ingenting utan ?forhandsvisning i adressen. Världen följer databasen
   så långt vyerna läser den; en ny tabell eller funktion som vyerna
   börjar fråga svarar som en databas utan den (PGRST205, PGRST202), och
   vyerna tål det. verktyg/prova-forhandsvisning.js går igenom båda
   vyerna och säger vad som saknas.
   ============================================================ */
window.NXForhandsvisning = (function () {
  'use strict';

  var ROLLER = { '/foralder': 'foralder', '/larare': 'studiehjalpare' };
  var sida = String(location.pathname || '').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var roll = ROLLER[sida] || null;
  var på = !!roll && /(?:^\?|&)forhandsvisning(?:[=&]|$)/.test(String(location.search || ''));
  if (!på) return { på: false };

  var TILL_ADMIN = '/admin#forhandsvisning';
  var NYCKEL = 'nx-forhandsvisning';

  /* ============ tiden ============ */
  var NU = new Date();
  function två(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + två(d.getMonth() + 1) + '-' + två(d.getDate()); }
  function dag(n) { var d = new Date(NU); d.setDate(d.getDate() + n); return iso(d); }
  function tid(n, kl) { return new Date(dag(n) + 'T' + kl + ':00').toISOString(); }
  function nu() { return new Date().toISOString(); }
  function nyttId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'f1000000-0000-4000-8000-' + String(Date.now() * 1000 + Math.floor(Math.random() * 1000)).slice(-12).padStart(12, '0');
  }
  function id(n) { return 'f0000000-0000-4000-8000-' + String(n).padStart(12, '0'); }

  /* ============ personerna ============ */
  var ANNA = id(1), KARIN = id(2), SARA = id(3), ALVA = id(11), KIM = id(12);
  var JAG = roll === 'foralder' ? ANNA : SARA;

  function användare(uid, epost, namn) {
    return { id: uid, aud: 'authenticated', role: 'authenticated', email: epost,
             app_metadata: { provider: 'email', providers: ['email'] },
             user_metadata: { full_name: namn }, created_at: '2026-09-01T10:00:00Z',
             email_confirmed_at: '2026-09-01T10:05:00Z', last_sign_in_at: nu() };
  }
  var ANVÄNDARE = {};
  ANVÄNDARE[ANNA] = användare(ANNA, 'anna.andersson@example.se', 'Anna Andersson');
  ANVÄNDARE[SARA] = användare(SARA, 'sara.svensson@example.se', 'Sara Svensson');

  /* En JWT som supabase-js kan läsa. Signaturen prövas aldrig: inget
     lämnar webbläsaren. */
  function jwt(sub) {
    var b = function (o) {
      return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    return b({ alg: 'HS256', typ: 'JWT' }) + '.'
      + b({ sub: sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800, iat: Math.floor(Date.now() / 1000),
            email: ANVÄNDARE[sub].email, session_id: NYCKEL }) + '.forhandsvisning';
  }
  function session() {
    return { access_token: jwt(JAG), refresh_token: 'forhandsvisning', token_type: 'bearer',
             expires_in: 3600 * 24 * 365, expires_at: 4102444800, user: ANVÄNDARE[JAG] };
  }

  /* ============ världen ============
     Samma familjer som introduktionens bilder (verktyg/bygg-introbilder.js),
     med dagens datum och dagens pris. Studiehjälparen ser båda familjerna,
     föräldern sin egen (synlig() nedan, som RLS). */
  var TIMPRIS = Math.round(Number((window.NEXTRUM_CONFIG || {}).PRIS_PER_TIMME) || 399) * 100;

  function pass(n, o) {
    return Object.assign({
      id: id(100 + n), subject: 'Matematik', format: 'På plats', location: 'Hemma hos familjen, Ringvägen 12',
      note: null, wanted_time: '17:00', duration_min: 60, antal_barn: 1, tjanst: 'laxhjalp', status: 'confirmed',
      student_id: ALVA, parent_id: ANNA, tutor_id: SARA, created_by: ANNA, created_at: tid(-30, '10:00'),
      avbokningsskal: null, avbokad_at: null, avbokad_av: null, betalning_status: 'ingen', betald_at: null,
      fakturerbar: true, begart_ore: null, betalt_ore: 0, aterbetald_ore: 0, klippkort_id: null,
      timpris_ore: TIMPRIS, extra_ore: 6900, rabatt_ore: null, startrabatt: false, rabattkod: null,
      attendance: null, motforslag_at: null, svar_meddelande: null, stripe_skarp: false, uppdrag_id: null
    }, o);
  }
  function betald(n) { return { betalning_status: 'betald', betald_at: tid(n, '18:30'), betalt_ore: TIMPRIS }; }

  function rapport(n, passNr, o) {
    return Object.assign({
      id: id(200 + n), booking_id: id(100 + passNr), student_id: ALVA, tutor_id: SARA, amne: 'Matematik',
      gick: 'bra', narvaro: 'narvarande', start_tid: '17:00', slut_tid: '18:00', debiterade_min: 60, hallna_min: 60,
      avvikelse_skal: null, went_well: null, raw_notes: null, ai_feedback: null, needs_practice: null,
      next_focus: null, lesson_date: null, created_at: null
    }, o);
  }

  function niva(n, omrade, titel, ordning, extra) {
    return Object.assign({ id: id(300 + n), nyckel: 'fv-ma6-' + n, amne: 'Matematik', arskurs: 'ak6', omrade: omrade,
      titel: titel, beskrivning: titel + ', i din takt.', ordning: ordning, antal_fragor: 4, aktiv: true,
      sort: 'vanlig', lastext: null, spar: 'vag' }, extra || {});
  }

  /* Frågorna i förhandsvisningen: fyra per nivå, med facit. Påhittade
     här, inte ur banken, och ingen elev ser dem. */
  var FRÅGOR = {
    Bråk: [
      ['Vilket bråk är störst?', ['1/3', '1/2', '1/4'], 1, 'Ju mindre nämnare, desto större bitar: 1/2 är störst.'],
      ['Vad är 2/4 förkortat så långt det går?', ['1/2', '2/8', '4/8'], 0, 'Dela både täljare och nämnare med 2.'],
      ['Hur mycket är 1/4 av 20?', ['4', '5', '10'], 1, '20 delat i fyra lika delar är 5.'],
      ['Vilket bråk är lika mycket som 3/6?', ['1/3', '2/3', '1/2'], 2, '3/6 förkortat med 3 blir 1/2.']
    ],
    Procent: [
      ['Hur mycket är 10 % av 300 kr?', ['3 kr', '30 kr', '300 kr'], 1, '10 % är en tiondel: 300 delat med 10.'],
      ['Hur mycket är 25 % av 80?', ['20', '25', '40'], 0, '25 % är en fjärdedel, och 80 delat med 4 är 20.'],
      ['En tröja kostar 200 kr. Den är 50 % billigare. Vad kostar den nu?', ['50 kr', '100 kr', '150 kr'], 1, 'Halva priset är 100 kr.'],
      ['Hur skrivs 0,75 i procent?', ['7,5 %', '75 %', '750 %'], 1, 'Hundradelar är procent: 0,75 är 75 hundradelar.']
    ]
  };

  function medd(n, från, familj, d, kl, text, läst) {
    return { id: id(500 + n), parent_id: familj, tutor_id: SARA, sender_id: från, body: text,
             created_at: tid(d, kl), read_at: läst === false ? null : tid(d, kl) };
  }

  function nyVärld() {
    return {
      profiles: [
        { id: ANNA, role: 'parent', full_name: 'Anna Andersson', email: ANVÄNDARE[ANNA].email, is_admin: false,
          phone: '070-123 45 67', match_status: 'matched', matched_tutor_id: SARA, avatar_url: null, bio: null,
          last_seen_at: tid(-1, '19:00'), created_at: '2026-09-01T10:00:00Z', raderad_at: null },
        { id: KARIN, role: 'parent', full_name: 'Karin Karlsson', email: 'karin.karlsson@example.se', is_admin: false,
          phone: null, match_status: 'matched', matched_tutor_id: SARA, avatar_url: null, bio: null,
          last_seen_at: tid(-2, '20:00'), created_at: '2026-09-03T10:00:00Z', raderad_at: null },
        { id: SARA, role: 'tutor', full_name: 'Sara Svensson', email: ANVÄNDARE[SARA].email, is_admin: false,
          phone: '070-765 43 21', match_status: null, matched_tutor_id: null, avatar_url: null,
          bio: 'Läser till lärare i matematik och engelska på Stockholms universitet.',
          last_seen_at: tid(0, '08:30'), created_at: '2026-09-01T10:00:00Z', raderad_at: null }
      ],
      tutor_profiles: [
        { id: SARA, status: 'approved', school: 'Stockholms universitet', city: 'Stockholm', age: 22,
          subjects: ['Matematik', 'Engelska'], grade_levels: ['Åk 4–6', 'Åk 7–9'], formats: ['På plats', 'Online'],
          bio: 'Läser till lärare i matematik och engelska på Stockholms universitet.', hourly_rate: 180,
          stripe_account_id: null, stripe_klar: false, visa_publikt: false, tjanster: ['laxhjalp'],
          created_at: '2026-09-01T10:00:00Z' }
      ],
      students: [
        { id: ALVA, parent_id: ANNA, name: 'Alva', grade: 'Åk 6', school: null, subjects: ['Matematik', 'Engelska'],
          goals: 'Känna sig trygg med bråk och procent', about: 'Gillar att rita och spela fotboll.', behov: null,
          format_onskemal: 'pa_plats', matched_tutor_id: SARA, match_status: 'matched', visa_rapporter: true,
          far_boka: true, barn_behorigheter: ['boka', 'chatt', 'meddelanden', 'nexlax', 'pass', 'rapporter', 'studieplan'],
          created_at: '2026-09-02T10:00:00Z', raderad_at: null },
        { id: KIM, parent_id: KARIN, name: 'Kim', grade: 'Åk 8', school: null, subjects: ['Engelska'],
          goals: 'Våga skriva längre texter', about: null, behov: null, format_onskemal: 'online',
          matched_tutor_id: SARA, match_status: 'matched', created_at: '2026-09-04T10:00:00Z', raderad_at: null }
      ],
      bookings: [
        pass(1, Object.assign({ wanted_date: dag(-26), status: 'completed' }, betald(-26))),
        pass(2, Object.assign({ wanted_date: dag(-19), status: 'completed' }, betald(-19))),
        pass(3, Object.assign({ wanted_date: dag(-12), status: 'completed' }, betald(-12))),
        pass(4, { wanted_date: dag(-5), status: 'completed' }),
        pass(5, Object.assign({ wanted_date: dag(2), status: 'confirmed', created_at: tid(-6, '19:10') }, betald(-3))),
        pass(6, { wanted_date: dag(9), status: 'confirmed', created_at: tid(-4, '20:00') }),
        pass(7, { wanted_date: dag(16), wanted_time: '16:00', status: 'requested', motforslag_at: tid(-1, '20:10'),
                  created_by: SARA, created_at: tid(-2, '18:00'), svar_meddelande: 'Torsdag passar mig bättre, går 16.00 bra?' }),
        pass(8, { wanted_date: dag(23), status: 'requested', subject: 'Engelska', created_at: tid(0, '08:40'),
                  format: 'Online', location: null }),
        /* Kim, hos familjen Karlsson: ett pass att rapportera, ett förslag att svara på, och ett genomfört. */
        pass(11, { student_id: KIM, parent_id: KARIN, created_by: KARIN, subject: 'Engelska', format: 'Online', location: null,
                   wanted_date: dag(-1), wanted_time: '18:00', status: 'confirmed', betalning_status: 'betald',
                   betald_at: tid(-3, '12:00'), betalt_ore: TIMPRIS }),
        pass(12, { student_id: KIM, parent_id: KARIN, created_by: KARIN, subject: 'Engelska', format: 'Online', location: null,
                   wanted_date: dag(3), wanted_time: '18:00', status: 'requested', created_at: tid(0, '07:55') }),
        pass(13, Object.assign({ student_id: KIM, parent_id: KARIN, created_by: KARIN, subject: 'Engelska', format: 'Online',
                   location: null, wanted_date: dag(-8), wanted_time: '18:00', status: 'completed' }, betald(-8)))
      ],
      lesson_reports: [
        rapport(1, 1, { lesson_date: dag(-26), raw_notes: 'Vi gick igenom vad bråk är.',
          ai_feedback: 'Alva började med att visa bråk med pizzabitar och kom själv på att 2/4 är lika mycket som 1/2. Vi övade på att förkorta.',
          needs_practice: 'Förkorta bråk', next_focus: 'Jämföra bråk med olika nämnare', created_at: tid(-26, '18:10') }),
        rapport(2, 2, { lesson_date: dag(-19), raw_notes: 'Jämföra bråk.',
          ai_feedback: 'Vi jämförde bråk genom att göra nämnarna lika. Alva löste sex av åtta uppgifter själv.',
          needs_practice: 'Minsta gemensamma nämnare', next_focus: 'Bråk i textuppgifter', created_at: tid(-19, '18:10') }),
        rapport(3, 3, { lesson_date: dag(-12), gick: 'mycket_bra', raw_notes: 'Textuppgifter.',
          ai_feedback: 'Alva läste uppgifterna högt och ritade innan hon räknade. Det gick mycket bättre än förra veckan.',
          needs_practice: 'Läsa noga vad som frågas', next_focus: 'Procent som hundradelar', created_at: tid(-12, '18:10') }),
        rapport(4, 4, { lesson_date: dag(-5), raw_notes: 'Procent.',
          ai_feedback: 'Vi började med procent: 25 % är en fjärdedel, och 10 % räknas genom att dela med tio. Alva gjorde läxan i NexLäx direkt efteråt.',
          needs_practice: '10 % och 25 % i huvudet', next_focus: 'Rabatter och prisökningar', created_at: tid(-5, '18:10') }),
        rapport(13, 13, { student_id: KIM, amne: 'Engelska', lesson_date: dag(-8), start_tid: '18:00', slut_tid: '19:00',
          raw_notes: 'Läsförståelse.', ai_feedback: 'Kim läste en artikel och sammanfattade den muntligt.',
          needs_practice: 'Oregelbundna verb', next_focus: 'Skriva en kort text', created_at: tid(-8, '19:10') })
      ],
      rapport_bekraftelser: [
        { rapport_id: id(201), parent_id: ANNA, bekraftad_at: tid(-25, '08:00') },
        { rapport_id: id(202), parent_id: ANNA, bekraftad_at: tid(-18, '08:00') },
        { rapport_id: id(203), parent_id: ANNA, bekraftad_at: tid(-11, '08:00') },
        { rapport_id: id(213), parent_id: KARIN, bekraftad_at: tid(-7, '08:00') }
      ],
      study_plans: [
        { id: id(401), student_id: ALVA, tutor_id: SARA, subject: 'Matematik',
          goals: 'Trygg med bråk och procent inför provet i november',
          plan_text: 'Vecka 1–3: bråk, att jämföra och förkorta.\nVecka 4–6: procent som hundradelar, rabatter och prisökningar.\nEfter varje pass en nivå i NexLäx.',
          updated_at: tid(-20, '19:00'), created_at: tid(-25, '19:00') },
        { id: id(402), student_id: KIM, tutor_id: SARA, subject: 'Engelska', goals: 'Våga skriva längre texter',
          plan_text: 'Läsa en kort text varje vecka och skriva fem meningar om den.',
          updated_at: tid(-15, '19:00'), created_at: tid(-16, '19:00') }
      ],
      homework: [
        { id: id(411), student_id: ALVA, tutor_id: SARA, title: 'Procent: Hundradelar',
          instructions: 'Gör nivån i NexLäx innan nästa pass.', subject: 'Matematik', due_date: dag(2),
          status: 'ej_paborjad', completed_at: null, created_at: tid(-5, '18:20'), niva_id: id(305), bibliotek_id: null },
        { id: id(412), student_id: ALVA, tutor_id: SARA, title: 'Tre rabatter i reklamen',
          instructions: 'Hitta tre erbjudanden i en reklamtidning och räkna ut det nya priset.', subject: 'Matematik',
          due_date: dag(9), status: 'pagaende', completed_at: null, created_at: tid(-5, '18:25'), niva_id: null, bibliotek_id: null },
        { id: id(413), student_id: ALVA, tutor_id: SARA, title: 'Bråk: Förläng bråk', instructions: null,
          subject: 'Matematik', due_date: dag(-10), status: 'klar', completed_at: tid(-11, '17:00'),
          created_at: tid(-19, '18:20'), niva_id: id(302), bibliotek_id: null },
        { id: id(414), student_id: KIM, tutor_id: SARA, title: 'Fem meningar om artikeln',
          instructions: 'Skriv fem meningar om artikeln vi läste.', subject: 'Engelska', due_date: dag(1),
          status: 'ej_paborjad', completed_at: null, created_at: tid(-8, '19:20'), niva_id: null, bibliotek_id: null }
      ],
      nivaer: [
        niva(1, 'Bråk', 'Jämför bråk', 1),
        niva(2, 'Bråk', 'Förläng bråk', 2),
        niva(3, 'Bråk', 'Förkorta bråk', 3),
        niva(4, 'Bråk', 'Mästarprov: Bråk', 4, { sort: 'mastare', antal_fragor: 0 }),
        niva(5, 'Procent', 'Hundradelar', 5),
        niva(6, 'Procent', 'Rabatter', 6),
        niva(7, 'Procent', 'Prisökningar', 7)
      ],
      niva_forsok: [
        { id: id(321), niva_id: id(301), student_id: ALVA, startad_at: tid(-24, '16:00'), klar_at: tid(-24, '16:12'), antal: 4, ratt_direkt: 4, stjarnor: 3, godkand: true, fragor: [] },
        { id: id(322), niva_id: id(302), student_id: ALVA, startad_at: tid(-17, '16:00'), klar_at: tid(-17, '16:12'), antal: 4, ratt_direkt: 4, stjarnor: 3, godkand: true, fragor: [] },
        { id: id(323), niva_id: id(303), student_id: ALVA, startad_at: tid(-10, '16:00'), klar_at: tid(-10, '16:12'), antal: 4, ratt_direkt: 3, stjarnor: 2, godkand: true, fragor: [] }
      ],
      niva_fragor: [],
      niva_svar: [],
      messages: [
        medd(1, SARA, ANNA, -6, '18:20', 'Hej Anna! Bra pass i dag. Alva har en nivå om procent i NexLäx till torsdag.'),
        medd(2, ANNA, ANNA, -6, '19:02', 'Tack Sara! Hon har redan börjat. Går det bra att flytta passet om två veckor?'),
        medd(3, SARA, ANNA, -1, '20:12', 'Absolut, jag har föreslagit torsdagen i stället. Säg till om den inte passar.', false),
        medd(4, SARA, KARIN, -8, '19:15', 'Hej Karin! Kim läste jättebra i dag.'),
        medd(5, KARIN, KARIN, -7, '08:10', 'Vad roligt! Hon har börjat läsa engelska böcker hemma också.', false)
      ],
      /* Barnets tråd med studiehjälparen (barnets_chatt): föräldern läser den. */
      barn_meddelanden: [
        { id: id(601), student_id: ALVA, parent_id: ANNA, tutor_id: SARA, fran: 'studiehjalpare',
          body: 'Hej Alva! Kom ihåg nivån om hundradelar till torsdag.', read_at: tid(-4, '17:00'), created_at: tid(-4, '16:30') },
        { id: id(602), student_id: ALVA, parent_id: ANNA, tutor_id: SARA, fran: 'barn',
          body: 'Ja! Kan vi ta rabatter på nästa pass?', read_at: null, created_at: tid(-1, '18:45') }
      ],
      /* Ett pass Alva föreslagit i sin vy (barnet_foreslar_pass). */
      barn_passforslag: [
        { id: id(701), barn_id: ALVA, parent_id: ANNA, tutor_id: SARA, datum: dag(6), tid: '16:00', langd_min: 60,
          amne: 'Matematik', format: 'På plats', plats: 'Hemma hos familjen, Ringvägen 12',
          rad: 'Provet om procent är på fredag', lage: 'vantar', pass_id: null, skapad: tid(-1, '19:05'), besvarad: null }
      ],
      progress_items: [
        { id: id(801), student_id: ALVA, subject: 'Matematik', area: 'Bråk', level: 'bra', steg: 3, mal_steg: 4,
          comment: null, updated_at: tid(-12, '18:20') },
        { id: id(802), student_id: ALVA, subject: 'Matematik', area: 'Procent', level: 'pa_vag', steg: 1, mal_steg: 4,
          comment: null, updated_at: tid(-5, '18:20') },
        { id: id(803), student_id: KIM, subject: 'Engelska', area: 'Läsförståelse', level: 'bra', steg: 2, mal_steg: 4,
          comment: null, updated_at: tid(-8, '19:20') }
      ],
      progress_historik: [],
      student_notes: [],
      tjanster: [
        { kod: 'laxhjalp', namn: 'Läxhjälp', namn_en: 'Homework help', kort: 'En till en', kort_en: 'One to one',
          for_kund: true, for_jobb: true, aktiv: true, ordning: 1, pris_per_timme_ore: TIMPRIS, extra_personer_ore: 6900,
          extra_personer_max: 3, bokningstyp: 'pass', rapportkrav: true, rut_berattigad: false, rut_procent: 0,
          kundtyp: 'familj', jobbtyp: 'studiehjalpare', min_alder: 15 }
      ],
      flaggor: [
        { kod: 'kortsparr', aktiv: false }, { kod: 'erbjudanden', aktiv: true },
        { kod: 'faktura', aktiv: true }, { kod: 'tipstimme', aktiv: true }
      ],
      erbjudanden: [
        { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, timmar_pa_kopet: 0, rabatt_procent: 5, giltig_manader: 1, ordning: 10 },
        { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, timmar_pa_kopet: 0, rabatt_procent: 5, giltig_manader: 1, ordning: 20 },
        { kod: 'plan_intensiv', sort: 'plan', namn: 'Intensiv', timmar: 12, timmar_pa_kopet: 0, rabatt_procent: 5, giltig_manader: 1, ordning: 25 },
        /* Fyll timbanken (fyll_timbanken, 2026-10-12): timpriset, sex månader. */
        { kod: 'klipp10', sort: 'klippkort', namn: 'Fyll timbanken, 10 timmar', timmar: 10, timmar_pa_kopet: 0, rabatt_procent: 0, giltig_manader: 6, ordning: 30 },
        { kod: 'klipp20', sort: 'klippkort', namn: 'Fyll timbanken, 20 timmar', timmar: 20, timmar_pa_kopet: 0, rabatt_procent: 0, giltig_manader: 6, ordning: 40 },
        { kod: 'klipp30', sort: 'klippkort', namn: 'Fyll timbanken, 30 timmar', timmar: 30, timmar_pa_kopet: 0, rabatt_procent: 0, giltig_manader: 6, ordning: 50 },
        { kod: 'klipp60', sort: 'klippkort', namn: 'Fyll timbanken, 60 timmar', timmar: 60, timmar_pa_kopet: 0, rabatt_procent: 0, giltig_manader: 6, ordning: 60 },
        { kod: 'klipp100', sort: 'klippkort', namn: 'Fyll timbanken, 100 timmar', timmar: 100, timmar_pa_kopet: 0, rabatt_procent: 0, giltig_manader: 6, ordning: 70 }
      ],
      invoices: [],
      invoice_lines: [],
      betygsgarantier: [],
      pass_tillagg: [],
      timbank_uttag: [],
      notis_val: [],
      notis_installning: [{ id: 1, paminnelser_timmar: 24, chatt_samla_minuter: 15 }],
      pass_moten: [],
      avatarer: [],
      bibliotek: [],
      biblioteksmaterial: [],
      arbetade_timmar: [
        { tutor_id: SARA, manad: dag(-40).slice(0, 7) + '-01', pass: 5, minuter: 300, belopp_ore: 90000 },
        { tutor_id: SARA, manad: dag(0).slice(0, 7) + '-01', pass: 3, minuter: 180, belopp_ore: 54000 }
      ],
      payouts: [
        { id: id(901), tutor_id: SARA, period: dag(-40).slice(0, 7) + '-01', status: 'utbetald', belopp_ore: 90000,
          minuter: 300, skapad_at: tid(-14, '04:20'), utbetald_at: tid(-12, '09:00') }
      ],
      payout_lines: [],
      /* 2026-10-13: bonusen för tips, lön som studiehjälparen läser själv. */
      tipsbonus: []
    };
  }

  /* ============ en värld för båda vyerna ============
     Leo: "vyerna, studievy och studiecoachvyn ska vara kopplade med
     varandra i förhandsgranskningen, man ska kunna leka där och lätt
     kunna byta vy i admin. tex föreslå tid och byta vy och acceptera".

     Världen sparas i webbläsarens localStorage efter varje skrivning och
     läses därifrån när en vy öppnas, så studievyn och studiehjälparvyn
     ser samma pass, meddelanden och förslag, i samma flik eller i två.
     Remsan byter vy. En flik som står öppen laddar om när man kommer
     tillbaka till den och världen ändrats i en annan. Den börjar om med
     Börja om, varje ny dag (datumen räknas från den dag den skapades)
     och när världen i den här filen ändras (fingeravtrycket). Inget av
     det når databasen: ingen statistik, ingen lön och ingen faktura. */
  var LAGRAD = 'nx-forhandsvisning-varld';
  function fingeravtryck(t) {
    var h = 0x811c9dc5;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
  var W = nyVärld();
  var FP = fingeravtryck(JSON.stringify(W));
  var rev = 0;
  function läsLagrad() {
    try { var t = localStorage.getItem(LAGRAD); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function giltig(l) { return !!(l && l.fp === FP && l.dag === dag(0) && l.W && typeof l.rev === 'number'); }
  /* Samma objekt hela tiden: ersätt innehållet, inte världen. */
  function ersätt(ny) {
    Object.keys(W).forEach(function (k) { if (!(k in ny)) delete W[k]; });
    Object.keys(ny).forEach(function (k) { W[k] = ny[k]; });
  }
  /* En annan flik kan ha skrivit sedan sist: läs om innan frågan svaras. */
  function synka() {
    var l = läsLagrad();
    if (giltig(l) && l.rev > rev) { ersätt(l.W); rev = l.rev; }
  }
  function spara() {
    var l = läsLagrad();
    rev = Math.max(rev, giltig(l) ? l.rev : 0) + 1;
    try { localStorage.setItem(LAGRAD, JSON.stringify({ fp: FP, dag: dag(0), rev: rev, W: W })); } catch (e) { /* bara i minnet */ }
  }
  function börjaOm() {
    try { localStorage.removeItem(LAGRAD); } catch (e) { /* ingen lagring */ }
    location.reload();
  }
  (function () {
    var l = läsLagrad();
    if (giltig(l)) { ersätt(l.W); rev = l.rev; } else spara();
  })();
  var ändradAnnanstans = false;
  window.addEventListener('storage', function (e) { if (e.key === LAGRAD || e.key === null) ändradAnnanstans = true; });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && ändradAnnanstans) location.reload();
  });

  /* Vyerna i databasen som vyerna läser, räknade ur världen. */
  var VYER = {
    erbjudanden_pris: function () {
      return W.erbjudanden.map(function (e) {
        var rabatterat = Math.floor(TIMPRIS * (100 - e.rabatt_procent) / 10000) * 100;
        return { kod: e.kod, sort: e.sort, namn: e.namn, timmar: e.timmar, rabatt_procent: e.rabatt_procent,
                 giltig_manader: e.giltig_manader, ordning: e.ordning, timpris_ore: TIMPRIS,
                 ordinarie_ore: e.timmar * TIMPRIS, pris_ore: (e.timmar - e.timmar_pa_kopet) * rabatterat,
                 rabatterat_timpris_ore: rabatterat, timmar_pa_kopet: e.timmar_pa_kopet };
      });
    },
    tutor_busy_slots: function () {
      return W.bookings.filter(function (b) { return b.status === 'requested' || b.status === 'confirmed'; })
        .map(function (b) { return { tutor_id: b.tutor_id, wanted_date: b.wanted_date, wanted_time: String(b.wanted_time).slice(0, 5) }; });
    },
    passunderlag: function () {
      return W.bookings.filter(function (b) { return b.status === 'completed'; }).map(function (b) {
        var r = W.lesson_reports.find(function (x) { return x.booking_id === b.id; });
        var deb = r ? Number(r.debiterade_min || b.duration_min) : Number(b.duration_min);
        return { id: b.id, parent_id: b.parent_id, tutor_id: b.tutor_id, student_id: b.student_id,
                 wanted_date: b.wanted_date, har_rapport: !!r, debiterade_min: deb,
                 betalda_min: b.betalning_status === 'betald' ? Number(b.duration_min) : 0,
                 timpris_ore: b.timpris_ore, extra_ore: b.extra_ore, rabatt_ore: b.rabatt_ore, timbank_min: 0 };
      });
    },
    olasta_meddelanden: function () {
      var per = {};
      W.messages.forEach(function (m) {
        if (m.read_at || m.sender_id === JAG) return;
        var k = m.parent_id + '|' + m.tutor_id + '|' + m.sender_id;
        (per[k] = per[k] || { parent_id: m.parent_id, tutor_id: m.tutor_id, sender_id: m.sender_id, antal: 0 }).antal++;
      });
      return Object.keys(per).map(function (k) { return per[k]; });
    },
    klippkort_saldo: function () { return []; },
    klippkort_rorelser: function () { return []; },
    timbank_saldo: function () { return []; },
    timbank_rorelser: function () { return []; }
  };

  /* Det den inloggade får se, som RLS i databasen: föräldern sin familj,
     studiehjälparen sina elever och deras familjer. */
  function minaBarn() {
    return W.students.filter(function (s) {
      return roll === 'foralder' ? s.parent_id === JAG : s.matched_tutor_id === JAG;
    }).map(function (s) { return s.id; });
  }
  function synlig(tabell, r) {
    var barn = minaBarn();
    var föräldrar = roll === 'foralder' ? [JAG]
      : W.students.filter(function (s) { return s.matched_tutor_id === JAG; }).map(function (s) { return s.parent_id; });
    switch (tabell) {
      case 'profiles': return r.id === JAG || (roll === 'foralder' ? r.id === SARA : föräldrar.indexOf(r.id) !== -1);
      case 'tutor_profiles': return r.id === SARA;
      case 'students': return barn.indexOf(r.id) !== -1;
      case 'bookings': case 'tutor_busy_slots': case 'passunderlag':
        return roll === 'foralder' ? r.parent_id === JAG : r.tutor_id === JAG;
      case 'messages': case 'olasta_meddelanden':
        return roll === 'foralder' ? r.parent_id === JAG : r.tutor_id === JAG;
      case 'lesson_reports': case 'homework': case 'study_plans': case 'progress_items':
      case 'progress_historik': case 'student_notes': case 'niva_forsok': case 'barn_meddelanden':
        return barn.indexOf(r.student_id) !== -1;
      case 'rapport_bekraftelser': case 'invoices': case 'betygsgarantier': case 'timbank_uttag':
        return roll === 'foralder' ? r.parent_id === JAG : false;
      case 'barn_passforslag': return roll === 'foralder' && r.parent_id === JAG;
      case 'payouts': case 'arbetade_timmar': case 'payout_lines': return roll !== 'foralder' && r.tutor_id === JAG;
      case 'tipsbonus': return roll !== 'foralder' && r.studiehjalpare_id === JAG;
      case 'niva_fragor': return roll !== 'foralder';
      case 'notis_val': return r.profil_id === JAG;
      default: return true;
    }
  }
  /* tutor_busy_slots visar upptagna tider för alla, utan vem. */
  function synligFör(tabell, r) {
    if (tabell === 'tutor_busy_slots') return true;
    return synlig(tabell, r);
  }

  /* ============ PostgREST ============ */
  function svar(status, kropp, extra) {
    return new Response(kropp === undefined || status === 204 ? null : JSON.stringify(kropp), {
      status: status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, extra || {})
    });
  }
  function fel(status, kod, text, tips) {
    return svar(status, { code: kod, message: text, details: null, hint: tips || null });
  }

  function delaTopp(s) {
    var ut = [], djup = 0, nu = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(') djup++;
      if (c === ')') djup--;
      if (c === ',' && !djup) { ut.push(nu.trim()); nu = ''; } else nu += c;
    }
    if (nu.trim()) ut.push(nu.trim());
    return ut;
  }

  function värdeAv(r, k) { return r[k]; }
  function jämför(a, b) {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'number' && !isNaN(Number(b))) return a - Number(b);
    if (typeof a === 'boolean') return String(a).localeCompare(String(b));
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }
  function lista(v) {
    return v.replace(/^\(|\)$/g, '').split(',').map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
  }
  /* Ett villkor: col, op.värde. not.op.värde vänder det. */
  function prövar(k, v) {
    var inte = false;
    if (v.indexOf('not.') === 0) { inte = true; v = v.slice(4); }
    var p = v.indexOf('.');
    var op = p === -1 ? v : v.slice(0, p), värde = p === -1 ? '' : v.slice(p + 1);
    var f = function (r) {
      var x = värdeAv(r, k);
      switch (op) {
        case 'eq': return x !== null && x !== undefined && jämför(x, värde) === 0;
        case 'neq': return x === null || x === undefined || jämför(x, värde) !== 0;
        case 'gt': return x != null && jämför(x, värde) > 0;
        case 'gte': return x != null && jämför(x, värde) >= 0;
        case 'lt': return x != null && jämför(x, värde) < 0;
        case 'lte': return x != null && jämför(x, värde) <= 0;
        case 'is': return värde === 'null' ? x == null : värde === 'true' ? x === true : värde === 'false' ? x === false : false;
        case 'in': return lista(värde).indexOf(String(x)) !== -1;
        case 'like': case 'ilike': {
          var re = new RegExp('^' + värde.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$',
            op === 'ilike' ? 'i' : '');
          return x != null && re.test(String(x));
        }
        case 'cs': {
          var vill = lista(värde.replace(/^\{|\}$/g, ''));
          return Array.isArray(x) && vill.every(function (y) { return x.indexOf(y) !== -1; });
        }
        case 'ov': {
          var någon = lista(värde.replace(/^\{|\}$/g, ''));
          return Array.isArray(x) && någon.some(function (y) { return x.indexOf(y) !== -1; });
        }
        default: return true;
      }
    };
    return inte ? function (r) { return !f(r); } : f;
  }
  /* or=(a.eq.1,b.is.null) och and=(...), en nivå djupt. */
  function logik(v, eller) {
    var delar = delaTopp(v.replace(/^\(|\)$/g, ''));
    var prov = delar.map(function (d) {
      var m = /^(or|and)(\(.*\))$/.exec(d);
      if (m) return logik(m[2], m[1] === 'or');
      var p = d.indexOf('.');
      return prövar(d.slice(0, p), d.slice(p + 1));
    });
    return function (r) { return eller ? prov.some(function (f) { return f(r); }) : prov.every(function (f) { return f(r); }); };
  }
  var INTE_FILTER = ['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'];
  function filtrera(rader, sök) {
    var prov = [];
    sök.forEach(function (v, k) {
      if (INTE_FILTER.indexOf(k) !== -1) return;
      if (k === 'or' || k === 'and') prov.push(logik(v, k === 'or'));
      else prov.push(prövar(k, v));
    });
    return rader.filter(function (r) { return prov.every(function (f) { return f(r); }); });
  }
  function ordna(rader, order) {
    if (!order) return rader;
    var nycklar = delaTopp(order).map(function (o) {
      var d = o.split('.');
      return { k: d[0], ned: d.indexOf('desc') !== -1, nullförst: d.indexOf('nullsfirst') !== -1 };
    });
    return rader.slice().sort(function (a, b) {
      for (var i = 0; i < nycklar.length; i++) {
        var n = nycklar[i], x = a[n.k], y = b[n.k];
        if (x == null && y == null) continue;
        if (x == null) return n.nullförst ? -1 : 1;
        if (y == null) return n.nullförst ? 1 : -1;
        var c = jämför(x, y);
        if (c) return n.ned ? -c : c;
      }
      return 0;
    });
  }

  /* Inbäddat i select: nivaer(...) och biblioteksmaterial(...) på en
     läxa, invoice_lines(...) på en faktura. */
  var INBÄDDAT = {
    nivaer: { från: 'niva_id' },
    biblioteksmaterial: { från: 'bibliotek_id' },
    invoice_lines: { till: 'invoice_id' }
  };
  function bädda(rader, select) {
    if (!select || select.indexOf('(') === -1) return rader;
    var delar = delaTopp(select).map(function (d) { return /^([a-z_]+)(?:![a-z_]+)?\((.*)\)$/.exec(d); }).filter(Boolean);
    if (!delar.length) return rader;
    return rader.map(function (r) {
      var ut = Object.assign({}, r);
      delar.forEach(function (m) {
        var namn = m[1], regel = INBÄDDAT[namn];
        if (!regel) return;
        var tabell = tabellen(namn);
        if (regel.från) ut[namn] = r[regel.från] ? (tabell.find(function (x) { return x.id === r[regel.från]; }) || null) : null;
        else ut[namn] = tabell.filter(function (x) { return x[regel.till] === r.id; });
      });
      return ut;
    });
  }

  function tabellen(namn) {
    if (VYER[namn]) return VYER[namn]();
    return W[namn];
  }

  /* Det som skrivs får det databasen hade satt: id, tid och förval. */
  var FÖRVAL = {
    bookings: function (r) {
      var mall = pass(0, {});
      delete mall.id;
      return Object.assign(mall, { created_at: nu(), created_by: JAG }, r,
        { avbokad_at: null, avbokad_av: null, motforslag_at: null, svar_meddelande: null });
    },
    messages: function (r) { return Object.assign({ created_at: nu(), read_at: null, sender_id: JAG }, r); },
    lesson_reports: function (r) { return Object.assign({ created_at: nu(), tutor_id: SARA }, r); },
    homework: function (r) { return Object.assign({ created_at: nu(), status: 'ej_paborjad', completed_at: null, tutor_id: SARA }, r); },
    rapport_bekraftelser: function (r) { return Object.assign({ bekraftad_at: nu(), parent_id: ANNA }, r); },
    notis_val: function (r) { return Object.assign({ profil_id: JAG }, r); }
  };
  /* Tabellerna utan ett eget id. */
  var NYCKLAR = { rapport_bekraftelser: ['rapport_id'], student_notes: ['student_id'], notis_val: ['profil_id', 'typ', 'kanal'],
                  avatarer: ['profil_id'], study_plans: ['student_id', 'subject'], progress_items: ['id'] };

  function skriv(tabell, metod, sök, kropp, prefer, accept) {
    var rader = W[tabell];
    if (!rader) return fel(404, 'PGRST205', "Could not find the table 'public." + tabell + "' in the schema cache");
    var ut = [];
    if (metod === 'POST') {
      var nya = Array.isArray(kropp) ? kropp : [kropp || {}];
      var upsert = /resolution=(merge|ignore)-duplicates/.exec(prefer || '');
      var konflikt = sök.get('on_conflict') ? sök.get('on_conflict').split(',') : (NYCKLAR[tabell] || ['id']);
      nya.forEach(function (ny) {
        var rad = Object.assign({}, ny);
        if (upsert) {
          var finns = rader.find(function (x) {
            return konflikt.every(function (k) { return rad[k] !== undefined && String(x[k]) === String(rad[k]); });
          });
          if (finns) {
            if (upsert[1] === 'merge') Object.assign(finns, rad);
            ut.push(finns);
            return;
          }
        }
        if (FÖRVAL[tabell]) rad = FÖRVAL[tabell](rad);
        if (!NYCKLAR[tabell] && rad.id === undefined) rad.id = nyttId();
        if (rad.created_at === undefined && tabell !== 'rapport_bekraftelser') rad.created_at = nu();
        rader.push(rad);
        ut.push(rad);
      });
      efterSkrivning(tabell, ut);
    } else if (metod === 'PATCH') {
      ut = filtrera(rader.filter(function (r) { return synligFör(tabell, r); }), sök);
      ut.forEach(function (r) {
        var förut = Object.assign({}, r);
        Object.assign(r, kropp || {});
        if (tabell === 'bookings') stämpla(förut, r);
      });
      efterSkrivning(tabell, ut);
    } else if (metod === 'DELETE') {
      ut = filtrera(rader.filter(function (r) { return synligFör(tabell, r); }), sök);
      ut.forEach(function (r) { rader.splice(rader.indexOf(r), 1); });
    }
    if (/return=representation/.test(prefer || '')) {
      var rader2 = bädda(ut, sök.get('select'));
      /* .single() efter en skrivning ber om ett objekt, som en läsning. */
      if (String(accept || '').indexOf('vnd.pgrst.object') !== -1) {
        if (rader2.length !== 1) return fel(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned');
        return svar(metod === 'POST' ? 201 : 200, rader2[0]);
      }
      return svar(metod === 'POST' ? 201 : 200, rader2);
    }
    return svar(metod === 'POST' ? 201 : 204);
  }

  /* Avbokningen och motförslaget, som stampla_avbokningen() stämplar dem. */
  function stämpla(förut, b) {
    if (b.status === 'cancelled' && förut.status !== 'cancelled') {
      b.avbokad_at = nu(); b.avbokad_av = JAG;
      b.avbokad_fran = ['requested', 'confirmed', 'completed'].indexOf(förut.status) !== -1 ? förut.status : null;
      return;
    }
    if (b.wanted_date !== förut.wanted_date || b.wanted_time !== förut.wanted_time) {
      var parter = function (x) { return [x.parent_id, x.tutor_id]; };
      if (förut.status === 'requested' && b.status === 'requested' && b.created_by !== förut.created_by
          && parter(förut).indexOf(förut.created_by) !== -1 && parter(b).indexOf(b.created_by) !== -1) {
        b.motforslag_at = nu();
      } else if (!(förut.status === 'requested' && b.created_by === förut.created_by)) {
        b.motforslag_at = null; b.svar_meddelande = null;
      }
    }
  }

  /* Det triggrarna gör, så långt vyerna ser det. */
  function efterSkrivning(tabell, rader) {
    if (tabell === 'homework') {
      rader.forEach(function (h) { if (h.status === 'klar' && !h.completed_at) h.completed_at = nu(); });
    }
    /* En rapport gör passet genomfört (lesson_reports_gor_passet_genomfort). */
    if (tabell === 'lesson_reports') {
      rader.forEach(function (r) {
        var b = r.booking_id && W.bookings.find(function (x) { return x.id === r.booking_id; });
        if (b && b.status !== 'cancelled') b.status = 'completed';
        if (!r.lesson_date && b) r.lesson_date = b.wanted_date;
      });
    }
  }

  function läs(tabell, metod, sök, headers) {
    var källa = tabellen(tabell);
    if (!källa) return fel(404, 'PGRST205', "Could not find the table 'public." + tabell + "' in the schema cache");
    var alla = ordna(filtrera(källa.filter(function (r) { return synligFör(tabell, r); }), sök), sök.get('order'));
    var från = Number(sök.get('offset') || 0);
    var gräns = sök.get('limit') != null ? Number(sök.get('limit')) : Infinity;
    var del = alla.slice(från, från + gräns);
    var räknat = /count=(exact|planned|estimated)/.test(headers.get('prefer') || '');
    var cr = (del.length ? från + '-' + (från + del.length - 1) : '*') + '/' + (räknat ? alla.length : '*');
    if ((headers.get('accept') || '').indexOf('vnd.pgrst.object') !== -1) {
      if (del.length !== 1) return fel(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned',
        'The result contains ' + del.length + ' rows');
      return svar(200, bädda(del, sök.get('select'))[0], { 'content-range': cr });
    }
    if (metod === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': cr } });
    return svar(200, bädda(del, sök.get('select')), { 'content-range': cr });
  }

  /* ============ funktionerna (RPC) ============ */
  var BARN_FÅR_ALLA = ['pass', 'boka', 'studieplan', 'rapporter', 'nexlax', 'meddelanden', 'chatt'];
  function barnet(barnId) { return W.students.find(function (s) { return s.id === barnId; }); }
  function förnamn(namn) { return String(namn || '').trim().split(/\s+/)[0] || ''; }

  /* NexLäx: ett försök per start, svaren rättas mot FRÅGOR. Ett försök
     som började före en omladdning, eller i den andra vyn, byggs upp
     igen ur försöket och svaren i världen. */
  var spel = {};
  function spelFör(forsokId) {
    if (spel[forsokId]) return spel[forsokId];
    var f = W.niva_forsok.find(function (x) { return x.id === forsokId; });
    if (!f) return null;
    var s = { frågor: frågorFör(f.niva_id), rätt: {}, fel: {} };
    W.niva_svar.filter(function (x) { return x.forsok_id === forsokId; }).forEach(function (x) {
      if (x.ratt) s.rätt[x.fraga_id] = true; else s.fel[x.fraga_id] = true;
    });
    spel[forsokId] = s;
    return s;
  }
  function frågorFör(nivaId) {
    var n = W.nivaer.find(function (x) { return x.id === nivaId; });
    var bank = FRÅGOR[n && n.omrade] || FRÅGOR.Bråk;
    return bank.map(function (f, i) {
      return { id: 'f2000000-0000-4000-8000-' + String(Number(nivaId.slice(-6)) * 100 + i).padStart(12, '0'),
               typ: 'val', fraga: f[0], alternativ: f[1].slice(),
               ratt: f[2], forklaring: f[3], ordning: i + 1 };
    });
  }
  function nexlaxLäge() {
    var mina = W.niva_forsok.filter(function (f) { return f.student_id === ALVA && f.klar_at; });
    var xp = 1040 + mina.length * 50;
    var idag = mina.filter(function (f) { return String(f.klar_at).slice(0, 10) === new Date().toISOString().slice(0, 10); }).length;
    return {
      xp: xp, xp_idag: idag * 90, xp_vecka: 160 + idag * 90, serie: { nu: 3 + (idag ? 1 : 0), basta: 6, idag: !!idag },
      dagar: [-5, -4, -2].map(function (n) { return { dag: dag(n), xp: 60, nivaer: 1, uppgifter: 1, pass: 0 }; }),
      banor: [], nivaer: {}, omraden: [{ amne: 'Matematik', arskurs: 'ak6', omrade: 'Bråk', klart: tid(-9, '16:12') }],
      missade: [], uppgifter: { klara: 24, direkt: 20, forsta: 30, forsta_ratt: 24 },
      regler: { val: 10, svarare: 20, niva: 50, omrade: 100 }, idag: dag(0),
      uppdrag: { dag: dag(0), idag: [
        { id: 'xp-50', grupp: 'xp', text: 'Samla 50 XP', mal: 50, har: Math.min(50, idag * 90), klart: idag > 0 },
        { id: 'nivaer-1', grupp: 'nivaer', text: 'Klara en nivå', mal: 1, har: Math.min(1, idag), klart: idag > 0 },
        { id: 'rad-5', grupp: 'kunna', text: 'Svara rätt fem gånger i rad', mal: 5, har: 0, klart: false }],
        kista: idag > 0, vecka: null, manad: null, totalt: 6 + idag, hela_dagar: 1, veckor: 0, manader: 0 }
    };
  }

  var tipsKod = roll === 'foralder' ? 'ANNA7K' : 'SARA3M';

  var RPC = {
    mina_behorigheter: function () { return { admin: false, superadmin: false, behorigheter: [] }; },
    mitt_villkorslage: function () { return { version: '2026-10-12', godkant_at: tid(0, '08:00'), tidigare: null }; },
    godkann_villkor: function () { return true; },
    mina_handlingar: function () { return []; },
    min_handling_text: function () { return null; },
    /* Samma form som mina_tips() (tipskoder_bonus_och_timbanken, 2026-10-13):
       familjens timmar för tips, studiehjälparens sökande och bonus. */
    mina_tips: function () {
      return roll === 'foralder'
        ? { kod: tipsKod, sort: 'familj', aktiv: true, anmalda: 0, kunder: 0, timmar: 0, anvanda: 0, kvar: 0,
            kvar_till: null, timme_ges: true }
        : { kod: tipsKod, sort: 'studiehjalpare', aktiv: true, ansokningar: 1, intagna: 0, bonus_ore: 0,
            bonus_utbetald_ore: 0, bonus_ges: true, bonus_belopp_ore: 30000 };
    },
    forsta_timmen_lage: function () { return { beviljad: false, tagen: false }; },
    faktura_mojlig: function () { return true; },
    mina_barnkonton: function () {
      return [{ barn_id: ALVA, anvandarnamn: 'alva.a', barn_aktiv: true, visa_rapporter: true,
                vardnadshavare_godkand_at: tid(-20, '20:00'), senast_inloggad: tid(-1, '18:40') }];
    },
    mina_barns_epost: function () { return { pa: false, barn: [] }; },
    mina_barns_behorigheter: function () {
      return { alla: BARN_FÅR_ALLA.slice(), barn: W.students.filter(function (s) { return s.parent_id === JAG; })
        .map(function (s) { return { barn_id: s.id, behorigheter: (s.barn_behorigheter || []).slice() }; }) };
    },
    barn_behorigheter_satt: function (k) {
      var s = barnet(k.p_barn);
      if (!s || s.parent_id !== JAG) return { __fel: [400, 'P0001', 'Barnet finns inte.'] };
      s.barn_behorigheter = Array.from(new Set((k.p_lista || []).filter(function (x) { return BARN_FÅR_ALLA.indexOf(x) !== -1; }))).sort();
      s.far_boka = s.barn_behorigheter.indexOf('boka') !== -1;
      s.visa_rapporter = s.barn_behorigheter.indexOf('rapporter') !== -1;
      return { barn_id: s.id, behorigheter: s.barn_behorigheter.slice() };
    },
    kolla_rabattkod: function () {
      return [{ giltig: false, orsak: 'Rabattkoderna prövas inte i förhandsvisningen.', rabatt_ore: 0, beskrivning: null }];
    },
    /* En kod på ett köp av timmar (rabattkoden_timmar_och_tak, 2026-10-13). */
    kolla_rabattkod_kop: function () {
      return [{ giltig: false, orsak: 'Rabattkoderna prövas inte i förhandsvisningen.', rabatt_ore: 0, beskrivning: null,
                pris_ore: null, att_betala_ore: null }];
    },
    /* Förälderns svar på barnets förslag (barnet_foreslar_pass). */
    skicka_barnets_forslag: function (k) {
      var f = W.barn_passforslag.find(function (x) { return x.id === k.p_id && x.parent_id === JAG; });
      if (!f) return { __fel: [400, 'P0001', 'Förslaget finns inte.', 'barnforslag'] };
      if (f.lage !== 'vantar') return { __fel: [400, 'P0001', 'Förslaget är redan besvarat.', 'barnforslag'] };
      var p = k.p_pass || {};
      var b = FÖRVAL.bookings({ id: nyttId(), student_id: f.barn_id, parent_id: JAG, tutor_id: SARA, created_by: JAG,
        subject: p.amne, tjanst: p.tjanst || 'laxhjalp', antal_barn: p.barn || 1, wanted_date: p.datum, wanted_time: p.tid,
        duration_min: p.minuter, format: p.format || null, location: p.plats || null, note: p.not || null, status: 'requested' });
      W.bookings.push(b);
      f.lage = 'skickat'; f.besvarad = nu(); f.pass_id = b.id;
      return { id: b.id, status: b.status, klippkort_id: null, betalning_status: b.betalning_status, rabattkod: null };
    },
    barnforslag_neka: function (k) {
      var f = W.barn_passforslag.find(function (x) { return x.id === k.p_id && x.parent_id === JAG; });
      if (!f) return { lage: 'saknas' };
      if (f.lage !== 'vantar') return { lage: 'redan' };
      f.lage = 'nej'; f.besvarad = nu();
      return { lage: 'ok' };
    },
    anmal_betygsgaranti: function () {
      return { __fel: [400, 'P0001', 'Betygsgarantin anmäls inte i förhandsvisningen.'] };
    },
    barn_epost_satt: function () { return { __fel: [400, 'P0001', 'Barnets e-post sparas inte i förhandsvisningen.'] }; },
    barn_epost_skicka_igen: function () { return { __fel: [400, 'P0001', 'Inga mejl går från förhandsvisningen.'] }; },
    barn_epost_ta_bort: function () { return true; },
    barn_epost_notiser: function () { return true; },

    /* Barnets tråd, som studiehjälparen ser den (barnets_chatt). */
    barnchatt_tradar: function () {
      return minaBarn().filter(function (b) { return b === ALVA; }).map(function (b) {
        var tråd = W.barn_meddelanden.filter(function (m) { return m.student_id === b; });
        return { elev: b, namn: förnamn(barnet(b).name), inloggning: true, kan_skriva: true,
                 olasta: tråd.filter(function (m) { return m.fran === 'barn' && !m.read_at; }).length,
                 senaste: tråd.length ? tråd[tråd.length - 1].created_at : null };
      });
    },
    barnchatt_trad: function (k) {
      if (k.p_elev !== ALVA) return { lage: 'ingen' };
      var tråd = W.barn_meddelanden.filter(function (m) { return m.student_id === ALVA; });
      tråd.forEach(function (m) { if (m.fran === 'barn' && !m.read_at) m.read_at = nu(); });
      return { lage: 'ok', namn: 'Alva', kan_skriva: true, meddelanden: tråd.map(function (m) {
        return { id: m.id, fran: m.fran, text: m.body, skapad: m.created_at, last: m.read_at };
      }) };
    },
    barnchatt_skriv: function (k) {
      if (k.p_elev !== ALVA) return { lage: 'ingen' };
      W.barn_meddelanden.push({ id: nyttId(), student_id: ALVA, parent_id: ANNA, tutor_id: SARA, fran: 'studiehjalpare',
                                body: String(k.p_text || ''), read_at: null, created_at: nu() });
      return { lage: 'ok' };
    },

    /* NexLäx. */
    nexlax_lage: function () { return nexlaxLäge(); },
    niva_starta: function (k) {
      var n = W.nivaer.find(function (x) { return x.id === k.p_niva; });
      if (!n) return { __fel: [400, 'P0001', 'Nivån finns inte.'] };
      if (n.sort !== 'vanlig') {
        return { __fel: [400, 'P0001', 'Mästarprov och repetition går inte att göra i förhandsvisningen. Prova en vanlig nivå.'] };
      }
      var f = { id: nyttId(), niva_id: n.id, student_id: k.p_elev || ALVA, startad_at: nu(), klar_at: null,
                antal: 4, ratt_direkt: 0, stjarnor: 0, godkand: false, fragor: [] };
      var frågor = frågorFör(n.id);
      f.fragor = frågor.map(function (x) { return x.id; });
      W.niva_forsok.push(f);
      spel[f.id] = { frågor: frågor, rätt: {}, fel: {} };
      return { forsok: f.id, niva: { id: n.id, titel: n.titel, amne: n.amne, omrade: n.omrade, arskurs: n.arskurs,
               sort: n.sort, lastext: n.lastext }, klara: [],
               fragor: frågor.map(function (x) { return { id: x.id, typ: x.typ, fraga: x.fraga, alternativ: x.alternativ }; }) };
    },
    niva_svara: function (k) {
      var s = spelFör(k.p_forsok);
      var f = W.niva_forsok.find(function (x) { return x.id === k.p_forsok; });
      if (!s || !f) return { __fel: [400, 'P0001', 'Försöket finns inte.'] };
      var fråga = s.frågor.find(function (x) { return x.id === k.p_fraga; });
      if (!fråga) return { __fel: [400, 'P0001', 'Frågan finns inte.'] };
      var rätt = !!(k.p_svar && Number(k.p_svar.val) === fråga.ratt);
      W.niva_svar.push({ forsok_id: f.id, fraga_id: fråga.id, ratt: rätt, svar: k.p_svar || null, created_at: nu() });
      if (rätt && !s.fel[fråga.id]) f.ratt_direkt++;
      if (rätt) s.rätt[fråga.id] = true; else s.fel[fråga.id] = true;
      var klar = Object.keys(s.rätt).length === s.frågor.length;
      var resultat = null;
      if (klar && !f.klar_at) {
        f.klar_at = nu();
        f.stjarnor = f.ratt_direkt === 4 ? 3 : f.ratt_direkt >= 3 ? 2 : 1;
        f.godkand = true;
        resultat = { antal: 4, ratt_direkt: f.ratt_direkt, stjarnor: f.stjarnor, godkand: true, forut: 0, klar_at: f.klar_at,
                     xp_fragor: f.ratt_direkt * 10, xp_niva: 50, xp_omrade: 0 };
      }
      return { ratt: rätt, facit: fråga.ratt, forklaring: fråga.forklaring, klar: klar, xp: rätt ? 10 : 0, resultat: resultat };
    },
    niva_genomgang: function (k) {
      var s = spelFör(k.p_forsok);
      if (!s) return null;
      return { fragor: s.frågor.map(function (x) {
        return { fraga: x.fraga, alternativ: x.alternativ, ratt: x.ratt, forklaring: x.forklaring, typ: x.typ,
                 svar: null, ratt_svar: !!s.rätt[x.id] };
      }) };
    },
    rapportera_fragefel: function () { return true; }
  };

  function rpc(namn, kropp) {
    var f = RPC[namn];
    if (!f) return fel(404, 'PGRST202', 'Could not find the function public.' + namn + ' in the schema cache');
    var data;
    try { data = f(kropp || {}); } catch (e) { return fel(500, 'XX000', String(e && e.message || e)); }
    if (data && data.__fel) return fel(data.__fel[0], data.__fel[1], data.__fel[2], data.__fel[3]);
    return svar(200, data === undefined ? null : data);
  }

  /* ============ auth, funktioner och lagring ============ */
  function auth(väg, metod, kropp) {
    if (väg === '/auth/v1/user') {
      if (metod === 'PUT' && kropp) {
        var u = ANVÄNDARE[JAG];
        if (kropp.data) u.user_metadata = Object.assign({}, u.user_metadata, kropp.data);
      }
      return svar(200, ANVÄNDARE[JAG]);
    }
    if (väg === '/auth/v1/token') return svar(200, session());
    if (väg === '/auth/v1/logout') return svar(204);
    return svar(200, {});
  }
  var INTE_HÄR = 'Det här görs inte i förhandsvisningen: inget skickas, betalas eller sparas utanför sidan.';

  /* ============ fetch ============ */
  var grind = null;
  function läsKropp(init) {
    var b = init && init.body;
    if (b == null || typeof b !== 'string') return null;
    try { return JSON.parse(b); } catch (e) { return b; }
  }
  /* Vad vyn frågat och vad världen svarat, för provet
     (verktyg/prova-forhandsvisning.js) och den som undrar. */
  var logg = [];
  async function hämta(input, init) {
    var läge = await grind;
    if (läge !== 'ok') return fel(401, 'PGRST301', 'Förhandsvisningen är bara för admin.');
    var url = new URL(typeof input === 'string' ? input : input.url);
    var metod = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var headers = new Headers((init && init.headers) || (input && input.headers) || {});
    var kropp = läsKropp(init);
    var väg = url.pathname;
    /* Ett litet dröjsmål, som ett nät: vyerna ritar "Hämtar" och sedan
       svaret, som de gör på riktigt. */
    await new Promise(function (r) { setTimeout(r, 30); });
    synka();
    var ut = svara(väg, metod, url, headers, kropp);
    if (metod !== 'GET' && metod !== 'HEAD' && väg.indexOf('/rest/v1/') === 0 && ut.status < 400) spara();
    logg.push({ metod: metod, väg: väg, sök: url.search, kropp: kropp, status: ut.status });
    return ut;
  }
  function svara(väg, metod, url, headers, kropp) {
    if (väg.indexOf('/auth/v1/') === 0) return auth(väg, metod, kropp);
    if (väg.indexOf('/functions/v1/') === 0) return svar(409, { error: INTE_HÄR });
    if (väg.indexOf('/storage/v1/') === 0) return svar(400, { statusCode: '400', error: 'forhandsvisning', message: INTE_HÄR });
    if (väg.indexOf('/rest/v1/rpc/') === 0) return rpc(väg.slice('/rest/v1/rpc/'.length), kropp);
    if (väg.indexOf('/rest/v1/') === 0) {
      var tabell = väg.slice('/rest/v1/'.length);
      if (metod === 'GET' || metod === 'HEAD') return läs(tabell, metod, url.searchParams, headers);
      return skriv(tabell, metod, url.searchParams, kropp, headers.get('prefer'), headers.get('accept'));
    }
    return svar(404, {});
  }

  /* ============ Realtime ============
     En websocket som svarar ja på allt och aldrig skickar något eget:
     kanalerna blir anslutna, och det som skrivs i världen ritas av vyerna
     när de laddar om, som efter ett eget tryck. */
  function FalskSocket(url) {
    var s = this;
    s.url = url; s.readyState = 0; s.binaryType = 'arraybuffer'; s.bufferedAmount = 0; s.protocol = '';
    s.onopen = s.onclose = s.onerror = s.onmessage = null;
    setTimeout(function () {
      if (s.readyState !== 0) return;
      s.readyState = 1;
      if (s.onopen) s.onopen({ type: 'open' });
    }, 0);
  }
  FalskSocket.CONNECTING = 0; FalskSocket.OPEN = 1; FalskSocket.CLOSING = 2; FalskSocket.CLOSED = 3;
  FalskSocket.prototype.send = function (data) {
    var s = this;
    if (typeof data !== 'string') return;
    var m;
    try { m = JSON.parse(data); } catch (e) { return; }
    var d = Array.isArray(m) ? m : [m.join_ref, m.ref, m.topic, m.event, m.payload];
    if (d[1] == null) return;
    var ut = JSON.stringify([d[0], d[1], d[2], 'phx_reply', { status: 'ok', response: {} }]);
    setTimeout(function () { if (s.readyState === 1 && s.onmessage) s.onmessage({ data: ut }); }, 0);
  };
  FalskSocket.prototype.close = function (kod, skäl) {
    var s = this;
    if (s.readyState === 3) return;
    s.readyState = 3;
    setTimeout(function () { if (s.onclose) s.onclose({ code: kod || 1000, reason: skäl || '', wasClean: true }); }, 0);
  };
  FalskSocket.prototype.addEventListener = function () {};
  FalskSocket.prototype.removeEventListener = function () {};

  /* ============ in och ut ============ */
  var lämnat = false;
  function tillAdmin() {
    if (lämnat) return;
    lämnat = true;
    location.replace(TILL_ADMIN);
  }

  function minne() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  /* Vyns klient. nextrum-app.js frågar efter den i stället för att skapa
     sin egen. Den riktiga klienten finns bara för frågan om adminrollen. */
  function klient(CFG) {
    var riktig = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY,
      { auth: { detectSessionInUrl: false } });
    grind = riktig.auth.getSession().then(function (s) {
      if (!s || !s.data || !s.data.session) return 'utloggad';
      return riktig.rpc('mina_behorigheter').then(function (r) {
        return !r.error && r.data && r.data.admin ? 'ok' : 'nej';
      });
    }).catch(function () { return 'nej'; });
    grind.then(function (läge) { if (läge !== 'ok') tillAdmin(); });

    var lagring = minne();
    lagring.setItem(NYCKEL, JSON.stringify(session()));
    var c = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { storage: lagring, storageKey: NYCKEL, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: hämta },
      realtime: { transport: FalskSocket }
    });
    /* Logga ut lämnar förhandsvisningen. Svaret kommer aldrig: vyn laddar
       om sidan efter utloggningen (NXStudie.loggaUt), och det hade
       avbrutit vägen till adminvyn. */
    c.auth.signOut = function () { tillAdmin(); return new Promise(function () {}); };
    return c;
  }

  /* ============ remsan överst ============ */
  function remsa() {
    if (document.querySelector('.nx-fv')) return;
    var vem = roll === 'foralder' ? 'familjen Andersson' : 'studiehjälparen Sara Svensson';
    var el = document.createElement('div');
    el.className = 'nx-fv';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Förhandsvisning');
    var text = document.createElement('p');
    var b = document.createElement('b');
    b.textContent = 'Förhandsvisning';
    text.appendChild(b);
    text.appendChild(document.createTextNode(' Du är ' + vem + '. Påhittat och sparat bara i din webbläsare: '
      + 'inget skickas, och inget räknas i statistik, lön eller faktura.'));
    var knappar = document.createElement('span');
    knappar.className = 'nx-fv-knappar';
    /* Samma värld i den andra vyn: föreslå som familjen, byt, svara som
       studiehjälparen. */
    var byt = document.createElement('a');
    byt.href = (roll === 'foralder' ? '/larare' : '/foralder') + '?forhandsvisning';
    byt.textContent = roll === 'foralder' ? 'Byt till studiehjälparvyn' : 'Byt till studievyn';
    byt.setAttribute('data-fv-byt', '');
    var börja = document.createElement('a');
    börja.href = location.pathname + location.search;
    börja.textContent = 'Börja om';
    börja.setAttribute('data-fv-om', '');
    börja.addEventListener('click', function (e) { e.preventDefault(); börjaOm(); });
    var ut = document.createElement('a');
    ut.href = TILL_ADMIN;
    ut.textContent = 'Till adminvyn';
    knappar.appendChild(byt);
    knappar.appendChild(börja);
    knappar.appendChild(ut);
    el.appendChild(text);
    el.appendChild(knappar);
    /* Överst i sidhuvudet, som står fast ovanpå sidan: remsan syns när
       huvudet syns, och sektionsraden på en telefon mäter huvudet med
       remsan i (--vy-hdr-h). */
    var värd = document.getElementById('hdr') || document.body;
    värd.insertBefore(el, värd.firstChild);
    document.documentElement.classList.add('nx-forhandsvisning');
  }
  /* Stripe.js laddas aldrig här: kassan svarar att den inte öppnas, och
     skriptet hade hämtats från Stripe i onödan (laddaStripe i
     nextrum-studie-vy.js frågar efter window.Stripe först). */
  window.Stripe = function () { throw new Error(INTE_HÄR); };

  document.title = 'Förhandsvisning · ' + document.title;
  if (document.body) remsa();
  else document.addEventListener('DOMContentLoaded', remsa);

  return { på: true, roll: roll, klient: klient, värld: W, logg: logg, frågor: FRÅGOR };
})();
