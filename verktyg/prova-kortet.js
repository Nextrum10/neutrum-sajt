/* ============================================================
   NEXTRUM — webbläsarprov för kortet som reserveras i vyerna
   (kortet_reserveras, 2026-10-13)

       NODE_PATH="$(npm root -g)" node verktyg/prova-kortet.js [mapp för bilder]

   Kräver Playwright och Chromium (finns i molnsessionerna, installeras
   annars globalt). Körs inte i CI: ingen pakethanterare i repot.

   ALDRIG MOT DRIFTEN. Provet går genom studievyn i förhandsvisningen
   (/foralder?forhandsvisning), där världen i nextrum-forhandsvisning.js
   svarar på allt: Annas sparade Visa ·· 4242, strömbrytaren
   kortreservation på, och valj_kort() med databasens prövning. Den
   riktiga Supabase får bara grindens fråga, som provet besvarar, och
   varje annat anrop dit fäller provet. Kassan hos Stripe öppnas aldrig:
   att spara och ta bort ett kort går genom stripe-checkout, som
   förhandsvisningen inte når.

   Det provet säger:
     - förslaget har raden Betalning (Efter passet, Kort), och valet
       följer med passet: kortet väljs. Fakturan var ett tredje val till
       2026-10-21, då den togs bort.
     - granskningen av ett barns förslag har samma rad
     - passets sida väljer kortet och väljer bort det; Betala i förväg
       och fakturan är borta
     - Mina lektioner säger Kort i stället för Ej betalt
     - Profil → Kortet visar kortet
     - med strömbrytaren av och inget kort är vyn som förut
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('Hittar inte Playwright. Kör med NODE_PATH="$(npm root -g)".');
  process.exit(2);
}

const ROT = path.dirname(__dirname);
const PORT = 8976;
const BAS = 'http://localhost:' + PORT;
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const RIKTIG_NYCKEL = 'sb-ddkfiuvcppalutfulvbi-auth-token';
const VÄRLDEN = 'nx-forhandsvisning-varld';
const BILDER = process.argv[2] || null;

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));
const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const egnaFel = konsol => konsol.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));
const id = n => 'f0000000-0000-4000-8000-' + String(n).padStart(12, '0');

function jwt(sub) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: 'authenticated', exp: 4102444800 }) + '.provet';
}
const ADMINENS = {
  access_token: jwt('admin-1'), refresh_token: 'prov-admin', token_type: 'bearer', expires_in: 3600,
  expires_at: 4102444800,
  user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
          app_metadata: { provider: 'email' }, user_metadata: {} }
};

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '.png') }).catch(() => {});
  else await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: true });
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, (o && o.context) || {}));
  const riktiga = [], dialoger = [], konsol = [];
  await context.route(RIKTIG, route => {
    const u = route.request().url();
    if (/\/rest\/v1\/rpc\/mina_behorigheter$/.test(u)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify({ admin: true, superadmin: true, behorigheter: [] })
      });
    }
    riktiga.push(route.request().method() + ' ' + u);
    return route.abort();
  });
  await context.route(url => !String(url).startsWith(BAS) && !RIKTIG.test(String(url)), route => route.abort());
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* ingen lagring */ } },
    [RIKTIG_NYCKEL, JSON.stringify(ADMINENS)]);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => { dialoger.push(d.message()); d.dismiss().catch(() => {}); });
  return { context, page, riktiga, dialoger, konsol };
}

async function stängNotisrutan(page) {
  await page.waitForSelector('.nx-notisruta', { timeout: 2500 }).catch(() => {});
  if (await synlig(page, '.nx-notisruta [data-notisruta-stang]')) {
    await page.click('.nx-notisruta [data-notisruta-stang]');
    await page.waitForSelector('.nx-notisruta', { state: 'detached', timeout: 3000 }).catch(() => {});
  }
}
async function laddaVyn(page) {
  await page.goto(BAS + '/foralder?forhandsvisning');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
}
const värld = (page, f, arg) => page.evaluate(f, arg);
const reservation = (page, pass) => värld(page, p => {
  const r = NXForhandsvisning.värld.kortreservationer.find(x => x.booking_id === p);
  return r ? r.lage : null;
}, pass);
/* Beskedet: i .ps-gor-topp bredvid beloppet när det står, annars först i .ps-gor. */
const BESKED = '#pass-sida .ps-gor-topp > p, #pass-sida .ps-gor > p';
const betalning = (page, pass) => värld(page, p => NXForhandsvisning.värld.bookings.find(b => b.id === p).betalning_status, pass);

async function tillPasset(page, pass) {
  await page.evaluate(p => { location.hash = '#pass/' + p; }, pass);
  await page.waitForSelector('#pass-sida .ps-titel', { timeout: 6000 }).catch(() => {});
  await vänta(250);
}
/* Bekräftelserutan (NXStudie.bekräfta) är vyns egen, inte webbläsarens. */
async function svaraJa(page) {
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 4000 }).catch(() => {});
  await page.click('.nx-fraga-box [data-svar="ja"]').catch(() => {});
  await page.waitForSelector('.nx-fraga-box', { state: 'detached', timeout: 4000 }).catch(() => {});
}
/* Ett förslag i Boka pass: sista lediga dagen, första tiden, online. */
async function väljTid(page) {
  await page.waitForSelector('#boka-inner .mv-dag:not([disabled])', { timeout: 6000 }).catch(() => {});
  const dagar = await page.$$eval('#boka-inner .mv-dag:not([disabled])', d => d.map(x => x.dataset.datum));
  const dag = dagar[dagar.length - 1];
  await page.click('#boka-inner .mv-dag[data-datum="' + dag + '"]');
  await page.waitForSelector('#boka-inner .mv-tid', { timeout: 3000 }).catch(() => {});
  await page.click('#boka-inner .mv-tid');
  await page.click('#boka-inner #bk-format button[data-v="Online"]').catch(() => {});
  return dag;
}
const nyttPass = (page, dag) => värld(page, d => {
  const W = NXForhandsvisning.värld;
  const mina = W.bookings.filter(b => b.wanted_date === d && b.created_by === W.profiles[0].id);
  return mina.length ? mina[mina.length - 1] : null;
}, dag);

/* ============ med strömbrytaren på ============ */
async function provaPå(webb) {
  const { context, page, riktiga, dialoger, konsol } = await öppna(webb);
  await laddaVyn(page);
  prova('på: vyn laddar', await synlig(page, '#view-app'));

  /* Mina lektioner: Annas förslag där kortet är valt. */
  await page.evaluate(() => { location.hash = '#lektioner'; });
  await page.waitForSelector('#pass-lista .pass', { timeout: 6000 }).catch(() => {});
  const märke = await page.evaluate(p => {
    const a = document.querySelector('#pass-lista a.pass-titel[href="#pass/' + p + '"]');
    const rad = a && a.closest('.pass');
    return rad ? Array.from(rad.querySelectorAll('.pass-atg .lage')).map(x => x.textContent.trim()) : null;
  }, id(108));
  prova('på: Mina lektioner märker passet med Kort', märke && märke.indexOf('Kort') !== -1, JSON.stringify(märke));

  /* Ett bekräftat pass utan val: Välj kort, inte Betala i förväg och inte fakturan. */
  await tillPasset(page, id(106));
  prova('på: passets sida har Välj kort och ingen faktura',
    (await synlig(page, '#pass-sida .vy-betalval [data-kort-val]'))
    && !/faktura/i.test(await text(page, '#pass-sida .ps-gor')), await text(page, '#pass-sida .ps-gor'));
  prova('på: Betala i förväg är borta', (await page.locator('#pass-sida [data-betala]').count()) === 0,
    await text(page, '#pass-sida .ps-gor'));
  prova('på: beskedet säger att priset reserveras två dagar före',
    /Välj kort, så reserveras priset två dagar före passet/.test(await text(page, BESKED)),
    await text(page, BESKED));
  await bild(page, 'passet-utan-val', '#pass-sida');

  await page.click('#pass-sida .vy-betalval [data-kort-val]');
  await page.waitForFunction(p => NXForhandsvisning.värld.kortreservationer.some(r => r.booking_id === p), id(106),
    { timeout: 5000 }).catch(() => {});
  await vänta(300);
  prova('på: Välj kort ger en rad i världen', (await reservation(page, id(106))) === 'vald', await reservation(page, id(106)));
  const besked = await text(page, BESKED);
  prova('på: beskedet säger kortet och när', /Priset reserveras på Visa ·· 4242 två dagar före passet och dras när studiehjälparen har skrivit rapporten\./.test(besked), besked);
  prova('på: passets betalning står som Med kortet', /Med kortet/.test(await text(page, '#pass-sida .ps-fakta')),
    await text(page, '#pass-sida .ps-fakta'));
  prova('på: inga betalknappar när kortet betalar', (await page.locator('#pass-sida .vy-betalval').count()) === 0);
  await bild(page, 'passet-med-kortet', '#pass-sida');

  await page.click('#pass-sida .ps-alt [data-kort-bort]');
  await page.waitForFunction(p => !NXForhandsvisning.värld.kortreservationer.some(r => r.booking_id === p), id(106),
    { timeout: 5000 }).catch(() => {});
  await vänta(300);
  prova('på: Välj bort kortet tar bort raden', (await reservation(page, id(106))) === null);
  prova('på: Välj kort står där igen', await synlig(page, '#pass-sida .vy-betalval [data-kort-val]'));
  prova('på: passet står kvar utan betalsätt', (await betalning(page, id(106))) === 'ingen', await betalning(page, id(106)));

  /* Kortet igen, för Profil → Kortet nedan räknar två pass. */
  await page.click('#pass-sida .vy-betalval [data-kort-val]');
  await page.waitForFunction(p => NXForhandsvisning.värld.kortreservationer.some(r => r.booking_id === p), id(106),
    { timeout: 5000 }).catch(() => {});
  prova('på: kortet går att välja igen', (await reservation(page, id(106))) === 'vald', await reservation(page, id(106)));

  /* Profil → Kortet. */
  await page.evaluate(() => { location.hash = '#profil/kort'; });
  await page.waitForSelector('#panel-kort:not([hidden]) #kort-ruta .vy-rad', { timeout: 5000 }).catch(() => {});
  /* Rutan står redan där sedan förra laddningen; talet kommer när kortet laddats om. */
  await page.waitForFunction(() => /2 pass med kortet/.test(document.querySelector('#kort-ruta').textContent), null,
    { timeout: 5000 }).catch(() => {});
  const ruta = await text(page, '#kort-ruta');
  prova('på: fliken Kortet syns', await synlig(page, '#flik-kort'));
  prova('på: Profil → Kortet visar märke, sista fyra och giltighet',
    /Visa ·· 4242/.test(ruta) && /går ut 08\/28/.test(ruta) && /2 pass med kortet/.test(ruta), ruta);
  prova('på: Byt kort och Ta bort', (await synlig(page, '#kort-ruta [data-kort-spara]'))
    && (await synlig(page, '#kort-ruta [data-kort-ta-bort]')));
  await bild(page, 'profil-kortet', '#panel-kort');
  await page.click('#kort-ruta [data-kort-ta-bort]');
  await svaraJa(page);
  await vänta(800);
  prova('på: Ta bort når inte Stripe från förhandsvisningen', dialoger.some(t => /förhandsvisningen/.test(t)),
    JSON.stringify(dialoger));

  /* Ett eget förslag med kort. */
  await page.evaluate(() => { location.hash = '#boka'; });
  let dag = await väljTid(page);
  await page.waitForSelector('#boka-inner #bk-betal', { timeout: 6000 }).catch(() => {});
  prova('på: förslaget har raden Betalning med två val, utan faktura',
    JSON.stringify(await page.$$eval('#boka-inner #bk-betal button', b => b.map(x => x.dataset.v))) === '["efter","kort"]',
    JSON.stringify(await page.$$eval('#boka-inner #bk-betal button', b => b.map(x => x.dataset.v)).catch(() => null)));
  prova('på: förvalet är Efter passet', (await page.getAttribute('#boka-inner #bk-betal button[data-v="efter"]', 'aria-pressed', { timeout: 3000 }).catch(() => null)) === 'true');
  await page.click('#boka-inner #bk-betal button[data-v="kort"]');
  await vänta(150);
  prova('på: texten under raden säger vad kortet gör',
    /reserveras på Visa ·· 4242 två dagar före passet/.test(await text(page, '#boka-inner .bk-betal-text')),
    await text(page, '#boka-inner .bk-betal-text'));
  await bild(page, 'forslaget-med-kort', '#boka-inner');
  await page.click('#boka-inner #bk-boka');
  await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 6000 }).catch(() => {});
  let pass = await nyttPass(page, dag);
  prova('på: förslaget med kort får kortet valt', pass && (await reservation(page, pass.id)) === 'vald',
    pass ? await reservation(page, pass.id) : 'inget pass');
  prova('på: kvittot säger att priset reserveras', /Priset reserveras på Visa ·· 4242/.test(await text(page, '#boka-inner .bk-kvitto')),
    await text(page, '#boka-inner .bk-kvitto'));

  /* Valet från förra förslaget står kvar till nästa. (Här skickades
     ett förslag mot faktura till 2026-10-21.) */
  await page.click('#boka-inner [data-bk-igen]').catch(() => {});
  dag = await väljTid(page);
  await page.waitForSelector('#boka-inner #bk-betal', { timeout: 5000 }).catch(() => {});
  prova('på: valet står kvar till nästa förslag',
    (await page.getAttribute('#boka-inner #bk-betal button[data-v="kort"]', 'aria-pressed', { timeout: 3000 }).catch(() => null)) === 'true');

  /* Alvas förslag, granskat och skickat med kort. */
  await page.click('#boka-inner [data-bk-igen]').catch(() => {});
  await page.waitForSelector('#bf-lista [data-bf-granska]', { timeout: 5000 }).catch(() => {});
  await page.click('#bf-lista [data-bf-granska]');
  await page.waitForSelector('#boka-inner .bk-forslag #bk-betal, #boka-inner #bk-betal', { timeout: 5000 }).catch(() => {});
  prova('på: granskningen av barnets förslag har raden Betalning', await synlig(page, '#boka-inner #bk-betal'));
  await page.click('#boka-inner #bk-betal button[data-v="kort"]');
  await page.click('#boka-inner #bk-boka');
  await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 6000 }).catch(() => {});
  const barnets = await värld(page, () => {
    const W = NXForhandsvisning.värld;
    const f = W.barn_passforslag[0];
    const r = W.kortreservationer.find(x => x.booking_id === f.pass_id);
    return { lage: f.lage, kort: r ? r.lage : null };
  });
  prova('på: barnets förslag skickas med kortet valt', barnets.lage === 'skickat' && barnets.kort === 'vald', JSON.stringify(barnets));

  prova('på: inget anrop mot den riktiga Supabase utom grinden', riktiga.length === 0, riktiga.join(', '));
  prova('på: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ med strömbrytaren av, och inget kort ============
   Som i driften i dag. Världen ändras i webbläsarens lagring och
   läses om: samma fingeravtryck, så förhandsvisningen tar den. */
async function provaAv(webb) {
  const { context, page, riktiga, konsol } = await öppna(webb);
  await laddaVyn(page);
  await page.evaluate(n => {
    const l = JSON.parse(localStorage.getItem(n));
    l.W.flaggor.forEach(f => { if (f.kod === 'kortreservation') f.aktiv = false; });
    l.W.sparade_kort = [];
    l.W.kortreservationer = [];
    l.rev += 1;
    localStorage.setItem(n, JSON.stringify(l));
  }, VÄRLDEN);
  await laddaVyn(page);

  await tillPasset(page, id(106));
  prova('av: passets sida har Betala i förväg och inget Välj kort',
    (await page.locator('#pass-sida [data-betala]').count()) > 0 && (await page.locator('#pass-sida [data-kort-val]').count()) === 0,
    await text(page, '#pass-sida .ps-gor'));
  prova('av: beskedet är som förut', /Betala nu, eller efter passet när ni bekräftar rapporten\./.test(await text(page, BESKED)),
    await text(page, BESKED));

  await page.evaluate(() => { location.hash = '#boka'; });
  await väljTid(page);
  await vänta(300);
  prova('av: förslaget har dagens panel men ingen rad Betalning', (await page.locator('#boka-inner #bk-boka').count()) === 1
    && (await page.locator('#boka-inner #bk-betal').count()) === 0);

  await page.evaluate(() => { location.hash = '#profil'; });
  await vänta(400);
  prova('av: fliken Kortet är dold', !(await synlig(page, '#flik-kort')));

  prova('av: inget anrop mot den riktiga Supabase utom grinden', riktiga.length === 0, riktiga.join(', '));
  prova('av: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ migrationen inte körd ============
   Utan flaggans rad frågar vyn varken efter mitt_kort() eller
   kortreservationer, som inte finns: ingen 404 vid varje inloggning. */
async function provaUtanMigrationen(webb) {
  const { context, page, konsol } = await öppna(webb);
  await laddaVyn(page);
  await page.evaluate(n => {
    const l = JSON.parse(localStorage.getItem(n));
    l.W.flaggor = l.W.flaggor.filter(f => f.kod !== 'kortreservation');
    delete l.W.sparade_kort;
    delete l.W.kortreservationer;
    l.rev += 1;
    localStorage.setItem(n, JSON.stringify(l));
  }, VÄRLDEN);
  await laddaVyn(page);
  await tillPasset(page, id(106));
  const frågor = await page.evaluate(() => NXForhandsvisning.logg.filter(r => /mitt_kort|kortreservationer/.test(r.väg)).length);
  prova('utan migrationen: vyn frågar inte efter kortet', frågor === 0, frågor);
  prova('utan migrationen: passets sida är som förut', (await page.locator('#pass-sida [data-betala]').count()) > 0
    && (await page.locator('#pass-sida [data-kort-val]').count()) === 0, await text(page, '#pass-sida .ps-gor'));
  prova('utan migrationen: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ strömbrytaren av efter att kortet valts ============
   Jobbet reserverar och drar inte ett val med strömbrytaren av
   (kortreservation_att_gora): passet betalas som vanligt, och vyn ska
   inte lova något annat eller gömma betalningen. */
async function provaAvMedVal(webb) {
  const { context, page, konsol } = await öppna(webb);
  await laddaVyn(page);
  await page.evaluate(([n, pass]) => {
    const l = JSON.parse(localStorage.getItem(n));
    l.W.flaggor.forEach(f => { if (f.kod === 'kortreservation') f.aktiv = false; });
    l.W.kortreservationer.push({ booking_id: pass, parent_id: l.W.profiles[0].id, lage: 'vald', stripe_reservation: null,
      reserverat_ore: null, reserverat_till: null, reserverat_for: null, dragen_ore: null, fel: null, forsok: 0,
      vald: new Date().toISOString(), andrad: new Date().toISOString() });
    l.rev += 1;
    localStorage.setItem(n, JSON.stringify(l));
  }, [VÄRLDEN, id(106)]);
  await laddaVyn(page);
  await tillPasset(page, id(106));
  prova('av med val: betalningen står kvar', (await page.locator('#pass-sida [data-betala]').count()) > 0,
    await text(page, '#pass-sida .ps-gor'));
  prova('av med val: beskedet lovar ingen reservation',
    /Kortet reserveras inte för passen just nu, så ni betalar passet som vanligt\./.test(await text(page, BESKED)),
    await text(page, BESKED));
  prova('av med val: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ lägena som jobbet och Stripe skriver ============
   Ett nekat kort, en reservation som står och ett genomfört pass som
   kortet betalar. Förhandsvisningen har inget jobb, så raderna skrivs in
   i världen som stripe-reservation och webhooken hade skrivit dem. */
async function provaLägen(webb) {
  const { context, page, konsol } = await öppna(webb);
  await laddaVyn(page);
  await page.evaluate(([n, nekat, reserverat, genomfört]) => {
    const l = JSON.parse(localStorage.getItem(n));
    const anna = l.W.profiles[0].id, nu = new Date().toISOString();
    const rad = (pass, o) => Object.assign({ booking_id: pass, parent_id: anna, lage: 'vald', stripe_reservation: null,
      reserverat_ore: null, reserverat_till: null, reserverat_for: null, dragen_ore: null, fel: null, forsok: 0,
      vald: nu, andrad: nu }, o);
    l.W.kortreservationer.push(rad(nekat, { lage: 'misslyckad', fel: 'card_declined', forsok: 1 }));
    l.W.kortreservationer.push(rad(reserverat, { lage: 'reserverad', stripe_reservation: 'pi_forhandsvisning',
      reserverat_ore: 39900, reserverat_till: new Date(Date.now() + 5 * 864e5).toISOString() }));
    l.W.kortreservationer.push(rad(genomfört, { lage: 'vald' }));
    /* Det bekräftade passet om två dagar är betalt i världen; här är det reserverat. */
    const b = l.W.bookings.find(x => x.id === reserverat);
    Object.assign(b, { betalning_status: 'ingen', betald_at: null, betalt_ore: 0 });
    l.rev += 1;
    localStorage.setItem(n, JSON.stringify(l));
  }, [VÄRLDEN, id(106), id(105), id(104)]);
  await laddaVyn(page);

  /* Nekat. */
  await page.evaluate(() => { location.hash = '#lektioner'; });
  await page.waitForSelector('#pass-lista .pass', { timeout: 6000 }).catch(() => {});
  const märken = await page.evaluate(ids => ids.map(p => {
    const a = document.querySelector('#pass-lista a.pass-titel[href="#pass/' + p + '"]');
    const rad = a && a.closest('.pass');
    return rad ? Array.from(rad.querySelectorAll('.pass-atg .lage, .pass-atg .btn')).map(x => x.textContent.trim()) : null;
  }), [id(106), id(105)]);
  prova('nekat: raden säger Kortet nekades och Byt kort', märken[0] && märken[0].indexOf('Kortet nekades') !== -1
    && märken[0].indexOf('Byt kort') !== -1, JSON.stringify(märken[0]));
  prova('reserverat: raden säger Reserverat på kortet', märken[1] && märken[1].indexOf('Reserverat på kortet') !== -1,
    JSON.stringify(märken[1]));

  await tillPasset(page, id(106));
  prova('nekat: beskedet säger det och vad familjen kan göra',
    /Kortet nekades\. Lägg till ett annat kort, försök igen, eller betala efter passet\./.test(await text(page, BESKED)),
    await text(page, BESKED));
  prova('nekat: Byt kort och Försök igen', (await synlig(page, '#pass-sida .ps-knappar [data-kort-spara]'))
    && /Försök igen/.test(await text(page, '#pass-sida .ps-knappar [data-kort-val]')), await text(page, '#pass-sida .ps-knappar'));
  await bild(page, 'passet-nekat', '#pass-sida');
  await page.click('#pass-sida .ps-knappar [data-kort-val]');
  await page.waitForFunction(p => NXForhandsvisning.värld.kortreservationer.find(r => r.booking_id === p).lage === 'vald', id(106),
    { timeout: 5000 }).catch(() => {});
  prova('nekat: Försök igen väljer kortet igen', (await reservation(page, id(106))) === 'vald', await reservation(page, id(106)));

  /* Reserverat. */
  await tillPasset(page, id(105));
  prova('reserverat: beskedet säger beloppet och kortet',
    /399 kr är reserverat på Visa ·· 4242 och dras när studiehjälparen har skrivit rapporten\./.test(await text(page, BESKED)), await text(page, BESKED));
  prova('reserverat: inga betalknappar', (await page.locator('#pass-sida .vy-betalval, #pass-sida [data-betala]').count()) === 0);
  await bild(page, 'passet-reserverat', '#pass-sida');
  await page.click('#pass-sida .ps-alt [data-kort-bort]');
  await page.waitForFunction(p => NXForhandsvisning.värld.kortreservationer.find(r => r.booking_id === p).lage !== 'reserverad', id(105),
    { timeout: 5000 }).catch(() => {});
  await vänta(300);
  prova('reserverat: Välj bort kortet släpper reservationen', (await reservation(page, id(105))) === 'slappt'
    && (await synlig(page, '#pass-sida .vy-betalval [data-kort-val]')), await reservation(page, id(105)));

  /* Genomfört, med kortet valt: under Bekräfta rapport. */
  await page.evaluate(() => { location.hash = '#bekrafta'; });
  await page.waitForSelector('#rb-lista [data-rb-rapport]', { timeout: 6000 }).catch(() => {});
  const rapporten = await page.evaluate(() => Array.from(document.querySelectorAll('#rb-lista [data-rb-rapport]'))
    .map(x => x.textContent).find(t => /Priset dras från/.test(t)) || '');
  prova('genomfört: Bekräfta rapport säger att kortet drar priset, utan betalval',
    /Priset dras från Visa ·· 4242 inom några minuter\./.test(rapporten), rapporten.slice(0, 200));
  await bild(page, 'bekrafta-med-kortet', '#rb-lista');

  prova('lägena: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ ett genomfört pass som inte är betalt ============
   Passets sida för ett genomfört obetalt pass, utan kort valt. Fas 1
   (fakturan bort, 2026-10-21) tog med grenen för tillägget när fakturans
   gren togs bort, och sidan kastade ett fel i stället för att ritas. */
async function provaGenomförtObetalt(webb) {
  const { context, page, konsol } = await öppna(webb);
  await laddaVyn(page);
  await tillPasset(page, id(104));
  prova('genomfört obetalt: passets sida ritas', await synlig(page, '#pass-sida .ps-titel'));
  prova('genomfört obetalt: beskedet ber om betalsätt och rapporten',
    /Passet är genomfört\. Läs rapporten nedan och bekräfta den genom att välja hur ni betalar\./.test(await text(page, BESKED)),
    await text(page, BESKED));
  prova('genomfört obetalt: betalvalen står på sidan', (await page.locator('#pass-sida .vy-betalval').count()) > 0);
  prova('genomfört obetalt: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* ============ adminvyn: familjens panel under Ekonomi ============
   Mot en falsk Supabase på https://supabase.test, som de andra
   adminproven. saknas: tabellerna finns inte (migrationen är inte körd),
   och då står ingen rubrik alls. */
const FALSK = 'https://supabase.test';
async function öppnaAdmin(webb, o) {
  const context = await webb.newContext({ viewport: { width: 1280, height: 900 } });
  const fram = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const W = {
    profiles: [
      { id: 'admin-1', role: 'admin', full_name: 'Leo Superadmin', email: 'leo@example.se', is_admin: true, created_at: '2026-09-01T10:00:00Z' },
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-02T10:00:00Z' },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false, created_at: '2026-09-01T10:00:00Z' }
    ],
    students: [{ id: 'barn-1', parent_id: 'foralder-1', name: 'Alva', grade: 'Åk 6', matched_tutor_id: 'handledare-1',
                 match_status: 'matched', created_at: '2026-09-02T10:00:00Z' }],
    tutor_profiles: [{ id: 'handledare-1', status: 'approved', created_at: '2026-09-01T10:00:00Z' }],
    admin_roller: [{ user_id: 'admin-1', ar_superadmin: true, behorigheter: [] }],
    bookings: [{ id: 'b-1', parent_id: 'foralder-1', tutor_id: 'handledare-1', student_id: 'barn-1', subject: 'Matematik',
                 wanted_date: fram(1), wanted_time: '17:00', duration_min: 60, status: 'confirmed', betalning_status: 'ingen',
                 fakturerbar: true, timpris_ore: 39900, created_at: '2026-10-01T10:00:00Z' }],
    sparade_kort: [{ parent_id: 'foralder-1', marke: 'visa', sista4: '4242', utgar_manad: 8, utgar_ar: 2028, sparat: '2026-10-08T18:00:00Z' }],
    kortreservationer: [{ booking_id: 'b-1', parent_id: 'foralder-1', lage: 'reserverad', reserverat_ore: 39900,
                          reserverat_till: new Date(Date.now() + 5 * 864e5).toISOString(), dragen_ore: null, fel: null,
                          andrad: new Date().toISOString() }]
  };
  const anrop = [];
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({ 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      'access-control-expose-headers': 'content-range, x-total-count' }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  const användare = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
                      app_metadata: { provider: 'email' }, user_metadata: {} };
  const session = { access_token: jwt('admin-1'), refresh_token: 'prov', token_type: 'bearer', expires_in: 3600,
                    expires_at: Math.floor(Date.now() / 1000) + 3600, user: användare };
  const riktiga = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return svar(route, 204);
    const p = url.pathname;
    if (p === '/auth/v1/token') return svar(route, 200, session);
    if (p === '/auth/v1/user') return svar(route, 200, användare);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p === '/functions/v1/stripe-checkout') {
      const kropp = JSON.parse(req.postData() || '{}');
      anrop.push(kropp);
      if (kropp.kort === 'ta_bort') { W.sparade_kort = []; return svar(route, 200, { ok: true, borttaget: true }); }
      return svar(route, 400, { error: 'Vad ska göras med kortet?' });
    }
    if (p.startsWith('/functions/v1/')) return svar(route, 404, { error: 'Ingen funktion i provet.' });
    if (p === '/rest/v1/rpc/mina_behorigheter') return svar(route, 200, { admin: true, superadmin: true, behorigheter: [] });
    if (p.startsWith('/rest/v1/rpc/')) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if (o.saknas && (tabell === 'sparade_kort' || tabell === 'kortreservationer')) {
        return svar(route, 404, { code: 'PGRST205', message: "Could not find the table 'public." + tabell + "' in the schema cache" });
      }
      let rader = (W[tabell] || []).slice();
      for (const [k, v] of url.searchParams.entries()) {
        const m = /^eq\.(.*)$/.exec(v);
        if (m && !['select', 'order', 'limit', 'offset'].includes(k)) rader = rader.filter(r => String(r[k]) === m[1]);
      }
      const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
      if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
        return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
      }
      if (req.method() === 'GET' || req.method() === 'HEAD') return svar(route, 200, rader, { 'content-range': cr });
      return svar(route, 201, []);
    }
    return svar(route, 404, {});
  });
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* ingen lagring */ } },
    ['sb-supabase-auth-token', JSON.stringify(session)]);
  const page = await context.newPage();
  const konsol = [];
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  await page.goto(BAS + '/admin');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 12000 }).catch(() => {});
  await vänta(800);
  /* Panelen öppnas som från en lista: ett element med data-dp. */
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button type="button" id="prov-dp" data-dp="familj:foralder-1" data-dp-start="ekonomi">Öppna</button>');
    document.getElementById('prov-dp').click();
  });
  /* Ekonomin i panelen är ritad när rubriken Kortet står där. */
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.dp-rubrik span'))
    .some(x => x.textContent === 'Kortet'), null, { timeout: 8000 }).catch(() => {});
  await vänta(300);
  return { context, page, konsol, anrop, riktiga };
}

async function provaAdminvyn(webb) {
  {
    const { context, page, konsol, anrop, riktiga } = await öppnaAdmin(webb, {});
    const ekonomi = await page.evaluate(() => document.body.textContent);
    prova('admin: Ekonomi har rubriken Kortet', await page.evaluate(() => Array.from(document.querySelectorAll('.dp-rubrik span'))
      .some(x => x.textContent === 'Kortet')));
    prova('admin: kortet med märke, sista fyra och giltighet', /Visa ·· 4242/.test(ekonomi) && /går ut 08\/28/.test(ekonomi));
    prova('admin: passet som är reserverat, med beloppet', /Reserverat · 399 kr/.test(ekonomi), (ekonomi.match(/Reserverat[^·]{0,3}·[^·]{0,12}/) || [''])[0]);
    await bild(page, 'admin-kortet');
    await page.click('[data-dp-kort-bort]');
    await svaraJa(page);
    await page.waitForFunction(() => !document.querySelector('[data-dp-kort-bort]'), null, { timeout: 6000 }).catch(() => {});
    prova('admin: Ta bort kortet anropar stripe-checkout med familjen', anrop.length === 1 && anrop[0].kort === 'ta_bort'
      && anrop[0].familj === 'foralder-1', JSON.stringify(anrop));
    const efter = await page.evaluate(() => document.body.textContent);
    prova('admin: efteråt står Inget kort sparat, och passet kvar', /Inget kort sparat/.test(efter) && /Reserverat · 399 kr/.test(efter));
    prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova('admin: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }
  {
    const { context, page, konsol } = await öppnaAdmin(webb, { saknas: true });
    const ekonomi = await page.evaluate(() => document.body.textContent);
    const rubriken = await page.evaluate(() => Array.from(document.querySelectorAll('.dp-rubrik span')).some(x => x.textContent === 'Kortet'));
    /* Ekonomi har ritats: talet för hållna pass som inte är betalda (Faktura
       som betalsätt stod här till 2026-10-21). */
    prova('admin utan migrationen: ingen rubrik Kortet och inget fel', /Hållna, inte betalda/.test(ekonomi)
      && !rubriken && !/Kortet gick inte att läsa/.test(ekonomi), ekonomi.slice(0, 200));
    prova('admin utan migrationen: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }
}

/* ============ på en telefon ============ */
async function provaTelefonen(webb) {
  const { context, page, konsol } = await öppna(webb, { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  await laddaVyn(page);
  await page.evaluate(() => { location.hash = '#boka'; });
  await väljTid(page);
  await page.waitForSelector('#boka-inner #bk-betal', { timeout: 6000 }).catch(() => {});
  const mått = await page.evaluate(() => ({
    bredd: document.documentElement.scrollWidth, fönster: window.innerWidth,
    knappar: Array.from(document.querySelectorAll('#bk-betal button')).map(b => Math.round(b.getBoundingClientRect().height))
  }));
  prova('telefon: ingen sidledsscroll i förslaget', mått.bredd <= mått.fönster, JSON.stringify(mått));
  prova('telefon: betalningens knappar är minst 44 px', mått.knappar.length === 2 && mått.knappar.every(h => h >= 44), JSON.stringify(mått.knappar));
  await bild(page, 'telefon-forslaget', '#boka-inner');
  await tillPasset(page, id(108));
  const mått2 = await page.evaluate(() => ({ bredd: document.documentElement.scrollWidth, fönster: window.innerWidth }));
  prova('telefon: ingen sidledsscroll på passets sida', mått2.bredd <= mått2.fönster, JSON.stringify(mått2));
  await bild(page, 'telefon-passet', '#pass-sida');
  prova('telefon: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaPå(webb);
    await provaAv(webb);
    await provaUtanMigrationen(webb);
    await provaAvMedVal(webb);
    await provaLägen(webb);
    await provaGenomförtObetalt(webb);
    await provaTelefonen(webb);
    await provaAdminvyn(webb);
  } catch (e) {
    prova('provet kraschade', false, e && e.stack || e);
  } finally {
    await webb.close();
    server.kill();
  }
  const fel = utfall.filter(u => !u.ok);
  utfall.forEach(u => console.log((u.ok ? 'ok   ' : 'FEL  ') + u.namn + (u.ok ? '' : '  (' + u.detalj + ')')));
  console.log('\n' + (utfall.length - fel.length) + ' av ' + utfall.length + ' gröna.');
  process.exit(fel.length ? 1 : 0);
})();
