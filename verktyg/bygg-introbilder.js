/* ============================================================
   NEXTRUM — skärmdumparna i introduktionen (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/bygg-introbilder.js [foralder|studiehjalpare] [--mapp <mapp>]

   Ritar bilderna som NXIntro (nextrum-introduktion.js) visar: en bild
   per del av studievyn och studiehjälparvyn, i en telefons bredd (390
   CSS-pixlar, dubbel upplösning), så att texten i bilden går att läsa
   också på en telefon. Bilderna hamnar i bilder/ som intro-<roll>-<del>
   .jpg och .webp; vägarna står i NEXTRUM_INTRO i nextrum-images.js.

   Körs för hand, som bygg-banken.py, när en del i vyn som en bild visar
   har ändrats. Inte i CI: det kräver Chromium och Pillow, och en
   bildkodare ger inte samma bytes mellan versioner (bygg-webp.py).
   kolla-webp.py vaktar att varje jpg har sin webp.

   ALDRIG MOT DRIFTEN, och inga riktiga personer. Sidorna serveras av
   .claude/serve.py, nextrum-config.js byts i farten mot en som pekar
   på https://supabase.test, och varje anrop dit besvaras av en falsk
   Supabase med påhittade familjer (Anna och Alva Andersson, Karin och
   Kim Karlsson) och en påhittad studiehjälpare (Sara Svensson). Ett
   anrop till den riktiga adressen stoppar verktyget. Klockan står på
   tisdag 13 oktober 2026 kl. 15.30, så att passen ligger rätt.

   Med --mapp sparas också PNG:erna där, för den som vill titta först.
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('Hittar inte Playwright. Kör med NODE_PATH="$(npm root -g)".');
  process.exit(2);
}

const ROT = path.dirname(__dirname);
const PORT = 8966;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const LAGRING = 'sb-supabase-auth-token';
const BREDD = 390, HÖJD = 440;
const NU = new Date('2026-10-13T15:30:00+02:00');

const arg = process.argv.slice(2);
const MAPP = arg.indexOf('--mapp') !== -1 ? arg[arg.indexOf('--mapp') + 1] : null;
const BARA = arg.find(a => a === 'foralder' || a === 'studiehjalpare') || null;

const vänta = ms => new Promise(r => setTimeout(r, ms));
const dag = n => { const d = new Date(NU); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const tid = (n, hh) => new Date(dag(n) + 'T' + hh + ':00+02:00').toISOString();

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.bilden';
}

const ANVANDARE = {
  'foralder-1': { id: 'foralder-1', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
                  app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Anna Andersson' },
                  created_at: '2026-09-01T10:00:00Z' },
  'handledare-1': { id: 'handledare-1', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
                    app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Sara Svensson' },
                    created_at: '2026-09-01T10:00:00Z' }
};

/* ============ världen ============ */
function pass(id, o) {
  return Object.assign({
    id, subject: 'Matematik', format: 'hemma', location: 'Hemma hos familjen', note: null,
    wanted_time: '17:00', duration_min: 60, antal_barn: 1, tjanst: 'laxhjalp', status: 'confirmed',
    student_id: 'barn-1', parent_id: 'foralder-1', tutor_id: 'handledare-1', created_by: 'foralder-1',
    created_at: tid(-20, '10:00'), avbokningsskal: null, avbokad_at: null, avbokad_av: null,
    betalning_status: 'obetald', betald_at: null, fakturerbar: true, betalt_ore: 0, aterbetald_ore: 0,
    klippkort_id: null, timpris_ore: 37900, extra_ore: 0, rabatt_ore: 0, startrabatt: false, rabattkod: null,
    attendance: null, avbokad_fran: null, motforslag_at: null, svar_meddelande: null
  }, o);
}

function rapport(id, booking, o) {
  return Object.assign({
    id, booking_id: booking, student_id: 'barn-1', tutor_id: 'handledare-1', amne: 'Matematik',
    gick: 'bra', narvaro: 'narvarande', start_tid: '17:00', slut_tid: '18:00', debiterade_min: 60, hallna_min: 60,
    avvikelse_skal: null, went_well: null, created_at: tid(-5, '18:10')
  }, o);
}

function värld() {
  const P = 'foralder-1', T = 'handledare-1';
  return {
    profiles: [
      { id: P, role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false, phone: null,
        match_status: 'matched', matched_tutor_id: T, avatar_url: null, bio: null, last_seen_at: tid(-2, '18:00'),
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'foralder-2', role: 'parent', full_name: 'Karin Karlsson', email: 'karin@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: T, avatar_url: null, bio: null, created_at: '2026-09-03T10:00:00Z' },
      { id: T, role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false, phone: null,
        avatar_url: null, bio: 'Läser till lärare i matematik och engelska på Stockholms universitet.',
        match_status: null, matched_tutor_id: null, last_seen_at: tid(-1, '19:00'), created_at: '2026-09-01T10:00:00Z' }
    ],
    tutor_profiles: [
      { id: T, status: 'approved', school: 'Stockholms universitet', city: 'Stockholm', age: 22,
        subjects: ['Matematik', 'Engelska'], grade_levels: ['Åk 4–6', 'Åk 7–9'], formats: ['hemma', 'online'],
        bio: 'Läser till lärare i matematik och engelska på Stockholms universitet.', hourly_rate: 180,
        stripe_account_id: null, stripe_klar: false, visa_publikt: false, tjanster: ['laxhjalp'] }
    ],
    students: [
      { id: 'barn-1', parent_id: P, name: 'Alva', grade: 'Åk 6', school: null, subjects: ['Matematik', 'Engelska'],
        goals: 'Känna sig trygg med bråk och procent', about: null, behov: null, format_onskemal: 'hemma',
        matched_tutor_id: T, match_status: 'matched', created_at: '2026-09-02T10:00:00Z' },
      { id: 'barn-3', parent_id: 'foralder-2', name: 'Kim', grade: 'Åk 8', school: null, subjects: ['Engelska'],
        goals: null, about: null, behov: null, format_onskemal: 'online',
        matched_tutor_id: T, match_status: 'matched', created_at: '2026-09-04T10:00:00Z' }
    ],
    bookings: [
      pass('p-1', { wanted_date: dag(-26), status: 'completed', betalning_status: 'betald', betald_at: tid(-26, '18:30'), betalt_ore: 0, startrabatt: true, rabatt_ore: 37900 }),
      pass('p-2', { wanted_date: dag(-19), status: 'completed', betalning_status: 'betald', betald_at: tid(-19, '18:30'), betalt_ore: 37900 }),
      pass('p-3', { wanted_date: dag(-12), status: 'completed', betalning_status: 'betald', betald_at: tid(-12, '18:30'), betalt_ore: 37900 }),
      pass('p-4', { wanted_date: dag(-5), status: 'completed' }),
      pass('p-5', { wanted_date: dag(2), status: 'confirmed', betalning_status: 'betald', betald_at: tid(-3, '09:00'), betalt_ore: 37900 }),
      pass('p-6', { wanted_date: dag(9), status: 'confirmed' }),
      pass('p-7', { wanted_date: dag(16), wanted_time: '16:00', status: 'requested', motforslag_at: tid(-1, '20:10'),
                    created_by: T, svar_meddelande: 'Torsdag passar mig bättre, går 16.00 bra?' }),
      pass('p-8', { wanted_date: dag(23), status: 'requested', subject: 'Engelska', created_at: tid(0, '08:40') }),
      /* Kim, hos familjen Karlsson: ett förslag att svara på och ett pass utan rapport. */
      pass('k-1', { student_id: 'barn-3', parent_id: 'foralder-2', created_by: 'foralder-2', subject: 'Engelska',
                    format: 'online', location: 'Online', wanted_date: dag(-1), wanted_time: '18:00', status: 'confirmed',
                    betalning_status: 'betald', betalt_ore: 37900 }),
      pass('k-2', { student_id: 'barn-3', parent_id: 'foralder-2', created_by: 'foralder-2', subject: 'Engelska',
                    format: 'online', location: 'Online', wanted_date: dag(3), wanted_time: '18:00', status: 'requested',
                    created_at: tid(0, '07:55') }),
      pass('k-3', { student_id: 'barn-3', parent_id: 'foralder-2', created_by: 'foralder-2', subject: 'Engelska',
                    format: 'online', location: 'Online', wanted_date: dag(-8), wanted_time: '18:00', status: 'completed',
                    betalning_status: 'betald', betalt_ore: 37900 })
    ],
    lesson_reports: [
      rapport('r-1', 'p-1', { lesson_date: dag(-26), gick: 'bra', raw_notes: 'Vi gick igenom vad bråk är.',
        ai_feedback: 'Alva började med att visa bråk med pizzabitar och kom själv på att 2/4 är lika mycket som 1/2. Vi övade på att förkorta.',
        needs_practice: 'Förkorta bråk', next_focus: 'Jämföra bråk med olika nämnare', created_at: tid(-26, '18:10') }),
      rapport('r-2', 'p-2', { lesson_date: dag(-19), gick: 'bra', raw_notes: 'Jämföra bråk.',
        ai_feedback: 'Vi jämförde bråk genom att göra nämnarna lika. Alva löste sex av åtta uppgifter själv.',
        needs_practice: 'Minsta gemensamma nämnare', next_focus: 'Bråk i textuppgifter', created_at: tid(-19, '18:10') }),
      rapport('r-3', 'p-3', { lesson_date: dag(-12), gick: 'mycket_bra', raw_notes: 'Textuppgifter.',
        ai_feedback: 'Alva läste uppgifterna högt och ritade innan hon räknade. Det gick mycket bättre än förra veckan.',
        needs_practice: 'Läsa noga vad som frågas', next_focus: 'Procent som hundradelar', created_at: tid(-12, '18:10') }),
      rapport('r-4', 'p-4', { lesson_date: dag(-5), gick: 'bra', raw_notes: 'Procent.',
        ai_feedback: 'Vi började med procent: 25 % är en fjärdedel, och 10 % räknas genom att dela med tio. Alva gjorde läxan i NexLäx direkt efteråt.',
        needs_practice: '10 % och 25 % i huvudet', next_focus: 'Rabatter och prisökningar', created_at: tid(-5, '18:10') }),
      rapport('kr-3', 'k-3', { student_id: 'barn-3', amne: 'Engelska', lesson_date: dag(-8), gick: 'bra',
        raw_notes: 'Läsförståelse.', ai_feedback: 'Kim läste en artikel och sammanfattade den muntligt.',
        needs_practice: 'Oregelbundna verb', next_focus: 'Skriva en kort text', created_at: tid(-8, '19:10') })
    ],
    rapport_bekraftelser: [
      { rapport_id: 'r-1', bekraftad_at: tid(-25, '08:00') },
      { rapport_id: 'r-2', bekraftad_at: tid(-18, '08:00') },
      { rapport_id: 'r-3', bekraftad_at: tid(-11, '08:00') }
    ],
    study_plans: [
      { student_id: 'barn-1', tutor_id: T, subject: 'Matematik', goals: 'Trygg med bråk och procent inför provet i november',
        plan_text: 'Vecka 1–3: bråk, att jämföra och förkorta.\nVecka 4–6: procent som hundradelar, rabatter och prisökningar.\nEfter varje pass en nivå i NexLäx.',
        updated_at: tid(-20, '19:00') },
      { student_id: 'barn-3', tutor_id: T, subject: 'Engelska', goals: 'Våga skriva längre texter',
        plan_text: 'Läsa en kort text varje vecka och skriva fem meningar om den.', updated_at: tid(-15, '19:00') }
    ],
    homework: [
      { id: 'h-1', student_id: 'barn-1', tutor_id: T, title: 'Procent: Hundradelar', instructions: 'Gör nivån i NexLäx innan nästa pass.',
        subject: 'Matematik', due_date: dag(2), status: 'ej_paborjad', completed_at: null, created_at: tid(-5, '18:20'),
        niva_id: 'ma6-proc-1', bibliotek_id: null },
      { id: 'h-2', student_id: 'barn-1', tutor_id: T, title: 'Tio rabatter i reklamen', instructions: 'Hitta tre erbjudanden i en reklamtidning och räkna ut det nya priset.',
        subject: 'Matematik', due_date: dag(9), status: 'pagaende', completed_at: null, created_at: tid(-5, '18:25'),
        niva_id: null, bibliotek_id: null },
      { id: 'h-3', student_id: 'barn-1', tutor_id: T, title: 'Bråk: Förläng bråk', instructions: null,
        subject: 'Matematik', due_date: dag(-10), status: 'klar', completed_at: tid(-11, '17:00'), created_at: tid(-19, '18:20'),
        niva_id: 'ma6-brak-2', bibliotek_id: null }
    ],
    nivaer: [
      niva('ma6-brak-1', 'Bråk', 'Jämför bråk', 1),
      niva('ma6-brak-2', 'Bråk', 'Förläng bråk', 2),
      niva('ma6-brak-3', 'Bråk', 'Förkorta bråk', 3),
      niva('ma6-brak-m', 'Bråk', 'Mästarprov: Bråk', 4, { sort: 'mastare', antal_fragor: 0 }),
      niva('ma6-proc-1', 'Procent', 'Hundradelar', 5),
      niva('ma6-proc-2', 'Procent', 'Rabatter', 6),
      niva('ma6-proc-3', 'Procent', 'Prisökningar', 7)
    ],
    niva_forsok: [
      forsok('f-1', 'ma6-brak-1', -24, 3), forsok('f-2', 'ma6-brak-2', -17, 3), forsok('f-3', 'ma6-brak-3', -10, 2),
      forsok('f-4', 'ma6-brak-m', -9, 2)
    ],
    messages: [
      medd('m-1', T, P, -6, '18:20', 'Hej Anna! Bra pass i dag. Alva har en nivå om procent i NexLäx till torsdag.'),
      medd('m-2', P, T, -6, '19:02', 'Tack Sara! Hon har redan börjat. Går det bra att flytta passet den 29:e?'),
      medd('m-3', T, P, -1, '20:12', 'Absolut, jag har föreslagit torsdagen i stället. Säg till om den inte passar.'),
      medd('m-4', T, 'foralder-2', -8, '19:15', 'Hej Karin! Kim läste jättebra i dag.')
    ],
    progress_items: [
      { id: 'pr-1', student_id: 'barn-1', subject: 'Matematik', area: 'Bråk', level: 'bra', steg: 3, mal_steg: 4, comment: null, updated_at: tid(-12, '18:20') },
      { id: 'pr-2', student_id: 'barn-1', subject: 'Matematik', area: 'Procent', level: 'pa_vag', steg: 1, mal_steg: 4, comment: null, updated_at: tid(-5, '18:20') }
    ],
    progress_historik: [],
    tjanster: [
      { kod: 'laxhjalp', namn: 'Läxhjälp', namn_en: 'Homework help', kort: 'En till en', kort_en: 'One to one',
        for_kund: true, for_jobb: true, aktiv: true, ordning: 1, pris_per_timme_ore: 37900, extra_personer_ore: 6900,
        extra_personer_max: 3, bokningstyp: 'pass', rapportkrav: true, rut_berattigad: false, rut_procent: 0,
        kundtyp: 'familj', jobbtyp: 'studiehjalpare', min_alder: 15 }
    ],
    flaggor: [{ kod: 'kortsparr', aktiv: false }, { kod: 'erbjudanden', aktiv: false }, { kod: 'faktura', aktiv: true }],
    arbetade_timmar: [
      { tutor_id: T, manad: '2026-09-01', pass: 5, minuter: 300, belopp_ore: 90000 },
      { tutor_id: T, manad: '2026-10-01', pass: 3, minuter: 180, belopp_ore: 54000 }
    ],
    payouts: [
      { id: 'u-1', tutor_id: T, period: '2026-09-01', status: 'utbetald', belopp_ore: 90000, minuter: 300,
        skapad_at: '2026-10-01T04:20:00Z', utbetald_at: '2026-10-25T09:00:00Z' }
    ]
  };

  function niva(id, omrade, titel, ordning, extra) {
    return Object.assign({ id, nyckel: id, amne: 'Matematik', arskurs: 'ak6', omrade, titel,
      beskrivning: titel + ', i din takt.', ordning, antal_fragor: 6, aktiv: true, sort: 'vanlig', lastext: null, spar: 'vag' }, extra || {});
  }
  function forsok(id, nivaId, n, stjarnor) {
    return { id, niva_id: nivaId, student_id: 'barn-1', startad_at: tid(n, '16:00'), klar_at: tid(n, '16:12'),
             antal: 6, ratt_direkt: 5, stjarnor, godkand: true, fragor: [] };
  }
  /* En tråd per familj och studiehjälpare (NXKontakt). */
  function medd(id, från, till, n, kl, text) {
    const familj = från === T ? till : från;
    return { id, parent_id: familj, tutor_id: T, sender_id: från, body: text,
             created_at: tid(n, kl), read_at: tid(n, kl) };
  }
}

/* Funktionerna vyerna frågar. Det som saknas svarar som en databas
   utan funktionen (PGRST202), och vyerna tål det. */
function rpc(W) {
  return {
    mina_behorigheter: () => ({ admin: false, superadmin: false, behorigheter: [] }),
    mina_handlingar: () => [],
    mina_tips: () => null,
    upptagna_tider: () => [],
    faktura_mojlig: () => true,
    mina_barnkonton: () => [{ barn_id: 'barn-1', anvandarnamn: 'alva.a', barn_aktiv: true, visa_rapporter: true,
      vardnadshavare_godkand_at: tid(-15, '20:00'), senast_inloggad: tid(-1, '16:40') }],
    mina_barns_epost: () => ({ pa: false, barn: [] }),
    mina_barns_behorigheter: () => ({ alla: ['pass', 'studieplan', 'rapporter', 'nexlax', 'meddelanden'],
      barn: [{ barn_id: 'barn-1', behorigheter: ['nexlax', 'pass', 'rapporter', 'studieplan'] }] }),
    nexlax_lage: () => ({
      xp: 1240, xp_idag: 0, xp_vecka: 160, serie: { nu: 3, basta: 6, idag: false },
      dagar: [-5, -4, -2].map(n => ({ dag: dag(n), xp: 60, nivaer: 1, uppgifter: 1, pass: 0 })),
      banor: [], nivaer: {}, omraden: [{ amne: 'Matematik', arskurs: 'ak6', omrade: 'Bråk', klart: tid(-9, '16:12') }],
      missade: [], uppgifter: { klara: 24, direkt: 20, forsta: 30, forsta_ratt: 24 },
      regler: { val: 10, svarare: 20, niva: 50, omrade: 100 }, idag: dag(0),
      uppdrag: { dag: dag(0), idag: [
        { id: 'xp-50', grupp: 'xp', text: 'Samla 50 XP', mal: 50, har: 0, klart: false },
        { id: 'nivaer-1', grupp: 'nivaer', text: 'Klara en nivå', mal: 1, har: 0, klart: false },
        { id: 'rad-5', grupp: 'kunna', text: 'Svara rätt fem gånger i rad', mal: 5, har: 0, klart: false }],
        kista: false, vecka: null, manad: null, totalt: 6, hela_dagar: 1, veckor: 0, manader: 0 }
    })
  };
}

/* ============ den falska Supabase ============ */
function falskSupabase(inloggad) {
  const W = värld();
  const R = rpc(W);
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  function session(id) {
    return { access_token: jwt(id, 'authenticated'), refresh_token: 'bild-' + id, token_type: 'bearer',
             expires_in: 3600, expires_at: Math.floor(NU.getTime() / 1000) + 3600 * 24 * 365, user: ANVANDARE[id] };
  }
  /* PostgREST:s filter, så långt vyerna använder dem. */
  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset', 'or', 'and'].includes(k)) continue;
      const [op, ...rest] = String(v).split('.');
      const värde = rest.join('.');
      const lika = (a, b) => String(a) === b;
      if (op === 'eq') ut = ut.filter(r => lika(r[k], värde));
      else if (op === 'neq') ut = ut.filter(r => !lika(r[k], värde));
      else if (op === 'in') {
        const lista = värde.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''));
        ut = ut.filter(r => lista.includes(String(r[k])));
      } else if (op === 'is' && värde === 'null') ut = ut.filter(r => r[k] == null);
      else if (op === 'not' && värde === 'is.null') ut = ut.filter(r => r[k] != null);
      else if (op === 'gte') ut = ut.filter(r => r[k] != null && String(r[k]) >= värde);
      else if (op === 'gt') ut = ut.filter(r => r[k] != null && String(r[k]) > värde);
      else if (op === 'lte') ut = ut.filter(r => r[k] != null && String(r[k]) <= värde);
      else if (op === 'lt') ut = ut.filter(r => r[k] != null && String(r[k]) < värde);
    }
    return ut;
  }
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = null; }
    const p = url.pathname;
    if (p === '/auth/v1/token') return svar(route, 200, session(inloggad));
    if (p === '/auth/v1/user') return svar(route, 200, ANVANDARE[inloggad]);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, { error: 'Ingen funktion i bilderna.' });
    if (p.startsWith('/storage/v1/')) return svar(route, 400, { error: 'Ingen lagring i bilderna.' });
    if (p.startsWith('/rest/v1/rpc/')) {
      const f = R[p.slice('/rest/v1/rpc/'.length)];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      const data = f(kropp || {});
      return svar(route, 200, data === undefined ? null : data);
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      const ut = filtrera(W[tabell] || [], url.searchParams);
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const cr = ut.length ? '0-' + (ut.length - 1) + '/' + ut.length : '*/0';
      if (metod === 'GET' || metod === 'HEAD') {
        if (ett) return ut.length ? svar(route, 200, ut[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, ut, { 'content-range': cr });
      }
      return svar(route, metod === 'PATCH' ? 204 : 201, metod === 'PATCH' ? undefined : []);
    }
    return svar(route, 404, {});
  }
  return { hantera, session };
}

/* ============ bilderna ============
   En post per bild: delen (#adress), en väljare som visar att den
   ritats, var bilden börjar (ankare: det viktigaste i delen, direkt
   under menyraden, som visar vilken del man är i) och vad som ska göras
   innan bilden tas. */
const BILDERNA = {
  foralder: {
    sida: '/foralder', vem: 'foralder-1',
    delar: [
      { del: 'oversikt', klar: '#ov-gora .vy-rad, #ov-kommande .vy-rad', ankare: '#ov-gora-grupp' },
      { del: 'boka', klar: 'section[data-sek="boka"] .mv-dag', ankare: 'section[data-sek="boka"] .bk-stegrad' },
      { del: 'lektioner', klar: '#pass-lista a, #pass-lista [data-pass]', ankare: 'section[data-sek="lektioner"] .vy-flikar' },
      { del: 'bekrafta', klar: 'section[data-sek="bekrafta"] .vy-kort', ankare: 'section[data-sek="bekrafta"] .vy-grupp' },
      { del: 'nexlax', klar: '#nl-vag .nl-vag, #nl-vag .nl-steg', ankare: 'section[data-sek="nexlax"] .vy-flikar' },
      { del: 'meddelanden', klar: '#trad .tr-rad', ankare: '#trad' },
      { del: 'profil', adress: 'profil/barn', klar: '#bi-lista .bi-far', ankare: '#bi-lista .bi-far' }
    ]
  },
  studiehjalpare: {
    sida: '/larare', vem: 'handledare-1',
    delar: [
      { del: 'oversikt', klar: '#ov-gora .vy-rad, #schema .vy-rad', ankare: '#ov-gora-grupp:not([hidden]), section[data-sek="oversikt"] .vy-sek-topp' },
      { del: 'tider', klar: 'section[data-sek="tider"] [data-acceptera]', ankare: 'section[data-sek="tider"] .vy-sek-topp' },
      { del: 'lektioner', klar: 'section[data-sek="lektioner"] a, section[data-sek="lektioner"] [data-pass]', ankare: 'section[data-sek="lektioner"] .vy-sek-topp' },
      { del: 'rapporter', klar: '#att-rapportera > :not(.loading)', ankare: 'section[data-sek="rapporter"] .vy-sek-topp' },
      { del: 'laxor', klar: 'section[data-sek="laxor"] .vy-flikar', ankare: 'section[data-sek="laxor"] .vy-sek-topp' },
      { del: 'meddelanden', klar: 'section[data-sek="meddelanden"] [data-trad], section[data-sek="meddelanden"] .tr-rad', ankare: 'section[data-sek="meddelanden"] .vy-sek-topp' },
      { del: 'statistik', klar: 'section[data-sek="statistik"] .vy-flikar', ankare: 'section[data-sek="statistik"] .vy-sek-topp' },
      { del: 'profil', klar: 'section[data-sek="profil"] .dbox', ankare: 'section[data-sek="profil"] .vy-flikar' }
    ]
  }
};

async function öppna(webb, vem) {
  const context = await webb.newContext({
    viewport: { width: BREDD, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'sv-SE', timezoneId: 'Europe/Stockholm'
  });
  const S = falskSupabase(vem);
  const riktiga = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(S.session(vem))]);
  const page = await context.newPage();
  await page.clock.setFixedTime(NU);
  const konsol = [];
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, riktiga, konsol };
}

/* Utan sidhuvudet: menyraden står då överst och visar vilken del bilden
   kommer ifrån. Ankaret läggs direkt under raden, och bilden är de
   första 440 punkterna. Saknas ankaret börjar bilden vid delen.

   Menyraden fastnar i överkant först när sidan rullats förbi den. Därför
   två steg: ankaret överst, så att raden har fastnat, och sedan ned så
   mycket som raden tar. */
async function taBild(page, d, ut) {
  /* Luft under sidan, så att också en kort del går att lägga överst, och
     ingen mjuk rullning som hinner halvvägs. */
  await page.addStyleTag({ content: '.hdr{display:none !important} *{caret-color:transparent !important}'
    + ' html{scroll-behavior:auto !important} body{padding-bottom:1400px !important}' });
  const ankaret = ([del, ankare]) =>
    (ankare && document.querySelector(ankare)) || document.querySelector('section[data-sek="' + del + '"]');
  await page.evaluate(([del, ankare, f]) => {
    const a = (0, eval)(f)([del, ankare]);
    if (a) window.scrollTo(0, Math.max(0, window.scrollY + a.getBoundingClientRect().top - 2));
  }, [d.del, d.ankare || null, ankaret.toString()]);
  await vänta(250);
  await page.evaluate(([del, ankare, f]) => {
    const a = (0, eval)(f)([del, ankare]);
    const meny = document.querySelector('#vy-sido');
    if (!a) return;
    const under = meny ? Math.max(0, meny.getBoundingClientRect().bottom) : 0;
    window.scrollTo(0, Math.max(0, window.scrollY + a.getBoundingClientRect().top - under - 12));
  }, [d.del, d.ankare || null, ankaret.toString()]);
  await vänta(300);
  await page.screenshot({ path: ut, clip: { x: 0, y: 0, width: BREDD, height: HÖJD } });
}

async function ritaRoll(webb, roll, tmp) {
  const b = BILDERNA[roll];
  const { context, page, riktiga, konsol } = await öppna(webb, b.vem);
  await page.goto(BAS + b.sida + '#oversikt');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 });
  await vänta(1500);
  const filer = [];
  for (const d of b.delar) {
    await page.evaluate(a => { location.hash = '#' + a; }, d.adress || d.del);
    await page.waitForSelector(d.klar, { timeout: 8000 }).catch(() => console.warn('  ' + roll + '/' + d.del + ': väntade förgäves på ' + d.klar));
    await vänta(500);
    if (d.före) await d.före(page);
    const fil = path.join(tmp, 'intro-' + roll + '-' + d.del + '.png');
    await taBild(page, d, fil);
    filer.push(fil);
    console.log('  ' + path.basename(fil));
  }
  if (riktiga.length) throw new Error('Anrop mot den riktiga Supabase: ' + riktiga.join(', '));
  const fel = konsol.filter(t => !/Failed to load resource|net::ERR/.test(t));
  if (fel.length) console.warn('  konsolen (' + roll + '): ' + fel.slice(0, 5).join(' | '));
  await context.close();
  return filer;
}

/* PNG → jpg och webp i bilder/, med Pillow. Kvaliteten som bygg-webp.py. */
function koda(filer) {
  const skript = [
    'import sys, os',
    'from PIL import Image',
    'ut = sys.argv[1]',
    'for f in sys.argv[2:]:',
    '    namn = os.path.splitext(os.path.basename(f))[0]',
    '    b = Image.open(f).convert("RGB")',
    '    b.save(os.path.join(ut, namn + ".jpg"), "JPEG", quality=82, optimize=True, progressive=True)',
    '    b.save(os.path.join(ut, namn + ".webp"), "WEBP", quality=82, method=6)',
    '    print("  bilder/" + namn + ".jpg och .webp, " + "x".join(map(str, b.size)))'
  ].join('\n');
  const r = spawnSync('python3', ['-c', skript, path.join(ROT, 'bilder'), ...filer], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Pillow kunde inte koda bilderna.');
}

(async function () {
  const tmp = MAPP || fs.mkdtempSync(path.join(os.tmpdir(), 'introbilder-'));
  fs.mkdirSync(tmp, { recursive: true });
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  let kod = 0;
  try {
    const filer = [];
    for (const roll of Object.keys(BILDERNA)) {
      if (BARA && roll !== BARA) continue;
      console.log(roll + ':');
      filer.push(...await ritaRoll(webb, roll, tmp));
    }
    koda(filer);
  } catch (e) {
    console.error(e && e.stack || e);
    kod = 1;
  } finally {
    await webb.close();
    server.kill();
  }
  process.exit(kod);
})();
