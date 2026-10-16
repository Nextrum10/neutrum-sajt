/* ============================================================
   NEXTRUM — webbläsarprov för förhandsvisningen och adminkontona i
   statistiken (forhandsvisning, adminkonton_utanfor_statistiken,
   2026-10-12)

       NODE_PATH="$(npm root -g)" node verktyg/prova-forhandsvisning.js [mapp för bilder]

   Kräver Playwright och Chromium (finns i molnsessionerna, installeras
   annars globalt). Körs inte i CI: ingen pakethanterare i repot.

   ALDRIG MOT DRIFTEN. Förhandsvisningen (/foralder?forhandsvisning,
   /larare?forhandsvisning) frågar den riktiga databasen en enda sak,
   mina_behorigheter(), med den riktiga inloggningen. Här besvaras den
   frågan av provet, och varje annat anrop till den riktiga adressen
   stoppas och fäller provet: allt annat ska svaras av världen i
   nextrum-forhandsvisning.js, i webbläsaren. Adminvyn provas som i de
   andra proven, mot en falsk Supabase på https://supabase.test.

   Provet går igenom varje sektion i båda vyerna och säger vad vyerna
   frågade efter som världen inte har (en tabell eller funktion som
   saknas svarar 404, och då står delen tom i förhandsvisningen).
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
const PORT = 8974;
const BAS = 'http://localhost:' + PORT;
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const RIKTIG_NYCKEL = 'sb-ddkfiuvcppalutfulvbi-auth-token';
const FALSK = 'https://supabase.test';
const BILDER = process.argv[2] || null;

/* ============ utfallet ============ */
const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));
const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
/* Konsolens fel utom nätverksfelen för det provet själv stoppar. */
const egnaFel = konsol => konsol.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll || 'authenticated', exp: 4102444800 }) + '.provet';
}
/* Adminens riktiga inloggning, så som supabase-js sparar den. */
const ADMINENS = {
  access_token: jwt('admin-1'), refresh_token: 'prov-admin', token_type: 'bearer', expires_in: 3600,
  expires_at: 4102444800,
  user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
          app_metadata: { provider: 'email' }, user_metadata: {} }
};
const id = n => 'f0000000-0000-4000-8000-' + String(n).padStart(12, '0');

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: !sel });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}

/* ============ förhandsvisningen ============
   grind: 'admin' (mina_behorigheter svarar admin), 'nej' (inloggad utan
   roll) eller 'utloggad' (ingen inloggning i webbläsaren). */
async function öppnaFörhandsvisning(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const riktiga = [], grindar = [], dialoger = [], konsol = [];
  await context.route(RIKTIG, route => {
    const u = route.request().url();
    if (/\/rest\/v1\/rpc\/mina_behorigheter$/.test(u)) {
      grindar.push({ url: u, auth: route.request().headers()['authorization'] || '' });
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify(o.grind === 'admin' ? { admin: true, superadmin: false, behorigheter: ['leads'] }
          : { admin: false, superadmin: false, behorigheter: [] })
      });
    }
    riktiga.push(route.request().method() + ' ' + u);
    return route.abort();
  });
  await context.route(url => !String(url).startsWith(BAS) && !RIKTIG.test(String(url)), route => route.abort());
  if (o.grind !== 'utloggad') {
    await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* ingen lagring */ } },
      [RIKTIG_NYCKEL, JSON.stringify(ADMINENS)]);
  }
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => { dialoger.push(d.message()); d.dismiss().catch(() => {}); });
  return { context, page, riktiga, grindar, dialoger, konsol };
}

const logg = page => page.evaluate(() => (window.NXForhandsvisning && NXForhandsvisning.logg) || []);
/* Rutan med det som väntar (NXStudie.notisruta) kommer när vyn öppnas,
   en gång per flik och konto, och står över allt. Stängs, och texten
   kommer tillbaka. */
async function stängNotisrutan(page) {
  await page.waitForSelector('.nx-notisruta', { timeout: 2500 }).catch(() => {});
  const t = await text(page, '.nx-notisruta');
  if (await synlig(page, '.nx-notisruta [data-notisruta-stang]')) {
    await page.click('.nx-notisruta [data-notisruta-stang]');
    await page.waitForSelector('.nx-notisruta', { state: 'detached', timeout: 3000 }).catch(() => {});
  }
  return t || '';
}
const värld = (page, f, arg) => page.evaluate(f, arg);
/* Ett nytt pass hittas på sitt id, aldrig på datum och läge: kalenderns
   sista dag är månadens sista, och den kan vara samma dag som ett av
   världens pass (dag(6), dag(16), dag(23)). Den 15 oktober tog provet Saras
   motförslag för familjens förslag. */
const passen = page => värld(page, () => NXForhandsvisning.värld.bookings.map(b => b.id));
const nyaPass = (page, förut) => värld(page, f => NXForhandsvisning.värld.bookings.filter(b => !f.includes(b.id)), förut);

/* Varje sektion i vyn, en i taget. Det vyerna frågade efter som världen
   inte har står i loggen med 404 (eller 500 om världen kastade). */
async function genomSektionerna(page, vem) {
  const sektioner = await page.$$eval('#vy-sido a[data-sek]', a => a.filter(x => !x.hidden).map(x => x.dataset.sek));
  for (const sek of sektioner) {
    await page.evaluate(s => { location.hash = '#' + s; }, sek);
    await vänta(500);
    await bild(page, vem + '-' + sek);
  }
  await vänta(400);
  const l = await logg(page);
  const saknas = l.filter(r => r.status === 404 || r.status >= 500);
  prova(vem + ': världen svarar på allt vyn frågar efter, i alla ' + sektioner.length + ' sektioner',
    l.length > 20 && !saknas.length,
    Array.from(new Set(saknas.map(r => r.status + ' ' + r.metod + ' ' + r.väg))).join(', '));
  return sektioner;
}

async function provaGrinden(webb) {
  for (const [grind, namn] of [['utloggad', 'utloggad'], ['nej', 'inloggad utan adminroll']]) {
    const { context, page, riktiga } = await öppnaFörhandsvisning(webb, { grind });
    await page.goto(BAS + '/foralder?forhandsvisning');
    await page.waitForURL(u => new URL(u).pathname === '/admin', { timeout: 8000 }).catch(() => {});
    const u = new URL(page.url());
    prova('grinden, ' + namn + ': leder till adminvyns förhandsvisning', u.pathname === '/admin' && u.hash === '#forhandsvisning', page.url());
    await context.close();
    void riktiga;
  }
  /* Kommer filen inte fram finns ingen klient alls, och vakten säger
     vilken fil det gällde: aldrig adminens riktiga konto i en vy som
     ser ut som förhandsvisningen. */
  {
    const { context, page, riktiga } = await öppnaFörhandsvisning(webb, { grind: 'admin' });
    await context.route(/nextrum-forhandsvisning\.js/, route => route.abort());
    await page.goto(BAS + '/foralder?forhandsvisning');
    await page.waitForSelector('#view-fel:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('utan filen: modulvakten säger vilken fil som saknas',
      (await synlig(page, '#view-fel')) && (await text(page, '#fel-detalj')).includes('nextrum-forhandsvisning.js'),
      await text(page, '#fel-detalj'));
    await vänta(500);
    prova('utan filen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* Utan ?forhandsvisning gör filen ingenting. */
  {
    const { context, page } = await öppnaFörhandsvisning(webb, { grind: 'utloggad' });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden]), #view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('utan adressen: ingen förhandsvisning', (await page.evaluate(() => window.NXForhandsvisning && NXForhandsvisning.på)) === false
      && (await page.locator('.nx-fv').count()) === 0 && !/^Förhandsvisning/.test(await page.title()), await page.title());
    await context.close();
  }
}

async function provaStudievyn(webb) {
  const { context, page, riktiga, grindar, dialoger, konsol } = await öppnaFörhandsvisning(webb, { grind: 'admin' });
  await page.goto(BAS + '/foralder?forhandsvisning');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  prova('studievyn: vyn laddar', await synlig(page, '#view-app'));
  const ruta = await stängNotisrutan(page);
  prova('studievyn: rutan vid inloggningen visar det som väntar, också Alvas förslag',
    /Alva föreslår ett pass/.test(ruta), ruta);
  prova('studievyn: hälsningen är till Anna', /Anna\.$/.test((await text(page, '#vy-hero h1')).trim()), await text(page, '#vy-hero h1'));
  prova('studievyn: remsan säger att det är en förhandsvisning, och vems',
    (await text(page, '.nx-fv')).includes('familjen Andersson')
    && (await text(page, '.nx-fv')).includes('inget räknas i statistik, lön eller faktura'), await text(page, '.nx-fv'));
  prova('studievyn: remsan byter till studiehjälparvyn', (await page.getAttribute('.nx-fv [data-fv-byt]', 'href')) === '/larare?forhandsvisning');
  /* Vyn sätter antalet olästa först i fliken: "(3) Förhandsvisning · …". */
  prova('studievyn: fliken heter Förhandsvisning', /^(\(\d+\) )?Förhandsvisning · /.test(await page.title()), await page.title());
  prova('studievyn: remsan leder till adminvyn', (await page.getAttribute('.nx-fv a[href="/admin#forhandsvisning"]', 'href')) === '/admin#forhandsvisning');
  prova('studievyn: den riktiga inloggningen frågar bara om adminrollen', grindar.length === 1
    && grindar[0].auth === 'Bearer ' + ADMINENS.access_token, JSON.stringify(grindar));
  prova('studievyn: Att göra har barnets förslag, motförslaget och rapporten',
    /Alva föreslår ett pass/.test(await text(page, '#ov-gora')) && (await page.locator('#ov-gora .vy-rad, #ov-gora a').count()) >= 3,
    await text(page, '#ov-gora'));
  await bild(page, 'studievyn-oversikt');

  await genomSektionerna(page, 'studievyn');

  /* Barnets förslag: granska och skicka. */
  await page.evaluate(() => { location.hash = '#boka'; });
  await page.waitForSelector('#bf-lista [data-bf-granska]', { timeout: 5000 }).catch(() => {});
  await page.click('#bf-lista [data-bf-granska]');
  await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 5000 }).catch(() => {});
  prova('studievyn: Alvas förslag öppnas med priset', (await text(page, '#boka-inner .bk-forslag')).includes('Alvas förslag')
    && /399\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris')), await text(page, '#boka-inner .bk-sum-pris'));
  await page.click('#boka-inner #bk-boka');
  await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
  const efter = await värld(page, () => {
    const W = NXForhandsvisning.värld;
    const f = W.barn_passforslag[0];
    return { lage: f.lage, pass: W.bookings.find(b => b.id === f.pass_id) || null };
  });
  prova('studievyn: förslaget blir ett pass i världen', efter.lage === 'skickat' && efter.pass && efter.pass.status === 'requested'
    && efter.pass.student_id === id(11), JSON.stringify(efter));
  prova('studievyn: kvittot säger att Alva ser det', (await text(page, '#boka-inner .bk-kvitto')).includes('Alva ser att ni skickat det'));

  /* Ett eget förslag. */
  await page.click('#boka-inner [data-bk-igen]').catch(() => {});
  const dag = await page.$$eval('#boka-inner .mv-dag:not([disabled])', d => d.map(x => x.dataset.datum).slice(-1)[0]);
  const förut = await passen(page);
  await page.click('#boka-inner .mv-dag[data-datum="' + dag + '"]');
  await page.waitForSelector('#boka-inner .mv-tid', { timeout: 3000 }).catch(() => {});
  await page.click('#boka-inner .mv-tid');
  await page.click('#boka-inner #bk-format button[data-v="Online"]');
  await page.click('#boka-inner #bk-boka');
  await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
  const eget = await nyaPass(page, förut);
  prova('studievyn: ett eget förslag sparas i världen', eget.length === 1 && eget[0].wanted_date === dag
    && eget[0].status === 'requested' && eget[0].created_by === id(1), JSON.stringify(eget));

  /* Ett meddelande. */
  await page.evaluate(() => { location.hash = '#meddelanden'; });
  await page.waitForSelector('#trad .tr-rad, #trad [class*="tr-"]', { timeout: 5000 }).catch(() => {});
  await page.fill('#tr-text', 'Hej Sara, det här är ett prov.');
  await page.click('#tr-skicka');
  await page.waitForFunction(() => /ett prov/.test(document.querySelector('#trad').textContent), null, { timeout: 5000 }).catch(() => {});
  prova('studievyn: ett meddelande står i tråden', (await text(page, '#trad')).includes('Hej Sara, det här är ett prov.'));

  /* NexLäx: nivån i läxan, alla fyra rätt. */
  await page.evaluate(() => { location.hash = '#nexlax'; });
  const starta = '[data-nl-starta="' + id(305) + '"]';
  await page.waitForSelector(starta, { timeout: 5000 }).catch(() => {});
  await page.locator(starta).first().click().catch(() => {});
  await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 6 && await page.locator('.upg-spel .upg-alt').count(); i++) {
    const fråga = (await text(page, '.upg-spel .upg-fraga-text, .upg-spel .upg-fraga h3, .upg-spel .upg-fraga')).trim();
    const rätt = await page.evaluate(t => {
      const alla = [].concat.apply([], Object.values(NXForhandsvisning.frågor));
      const f = alla.find(x => t.indexOf(x[0]) !== -1);
      return f ? f[2] : 0;
    }, fråga);
    await page.click('.upg-spel .upg-alt[data-alt="' + rätt + '"]');
    await page.click('.upg-spel [data-spel="kolla"]');
    await page.waitForSelector('.upg-spel [data-spel="vidare"]', { timeout: 5000 }).catch(() => {});
    await page.click('.upg-spel [data-spel="vidare"]').catch(() => {});
    await vänta(150);
  }
  await page.waitForSelector('.upg-spel .upg-slut', { timeout: 5000 }).catch(() => {});
  prova('studievyn: en nivå i NexLäx går att göra hela vägen', await synlig(page, '.upg-spel .upg-slut'),
    await text(page, '.upg-spel'));
  const försök = await värld(page, n => NXForhandsvisning.värld.niva_forsok.filter(f => f.niva_id === n && f.klar_at).length, id(305));
  prova('studievyn: försöket är klart i världen', försök === 1, försök);
  await bild(page, 'studievyn-nexlax-klar', '.upg-spel');
  await page.click('.upg-spel [data-spel="klar"]').catch(() => {});

  /* En betalning går inte iväg. */
  await page.evaluate(() => { location.hash = '#erbjudanden'; });
  await page.waitForSelector('[data-kop]', { timeout: 5000 }).catch(() => {});
  await page.locator('[data-kop]').first().click().catch(() => {});
  await vänta(800);
  prova('studievyn: ett köp säger att det inte görs här', dialoger.some(t => /förhandsvisningen/.test(t)), JSON.stringify(dialoger));

  prova('studievyn: inget annat anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('studievyn: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));

  /* Logga ut leder tillbaka till adminvyn. */
  await page.locator('[data-logout]').first().click();
  await page.waitForURL(u => new URL(u).pathname === '/admin', { timeout: 8000 }).catch(() => {});
  prova('studievyn: Logga ut leder till adminvyns förhandsvisning', new URL(page.url()).pathname === '/admin'
    && new URL(page.url()).hash === '#forhandsvisning', page.url());
  await context.close();
}

async function provaStudiehjalparvyn(webb) {
  const { context, page, riktiga, konsol } = await öppnaFörhandsvisning(webb, { grind: 'admin' });
  await page.goto(BAS + '/larare?forhandsvisning');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  prova('studiehjälparvyn: vyn laddar', await synlig(page, '#view-app'));
  await stängNotisrutan(page);
  prova('studiehjälparvyn: hälsningen är till Sara', /Sara\.$/.test((await text(page, '#vy-hero h1')).trim()), await text(page, '#vy-hero h1'));
  prova('studiehjälparvyn: remsan säger vems vyn är', (await text(page, '.nx-fv')).includes('Sara Svensson'));
  await bild(page, 'studiehjalparvyn-oversikt');

  await genomSektionerna(page, 'studiehjälparvyn');

  /* Acceptera Kims förslag. */
  await page.evaluate(() => { location.hash = '#tider'; });
  const knapp = '[data-acceptera="' + id(112) + '"]';
  await page.waitForSelector(knapp, { timeout: 5000 }).catch(() => {});
  await page.locator(knapp).first().click().catch(() => {});
  await page.waitForFunction(n => NXForhandsvisning.värld.bookings.find(b => b.id === n).status === 'confirmed', id(112),
    { timeout: 5000 }).catch(() => {});
  prova('studiehjälparvyn: Acceptera bekräftar passet i världen',
    (await värld(page, n => NXForhandsvisning.värld.bookings.find(b => b.id === n).status, id(112))) === 'confirmed');

  /* En rapport för gårdagens pass med Kim, utan AI. Passet blir genomfört. */
  await page.evaluate(() => { location.hash = '#rapporter'; });
  const skriv = '[data-rapportera="' + id(111) + '"]';
  /* Knappen står också under Översikt, som är dold: den synliga. */
  await page.waitForSelector(skriv + ':visible', { timeout: 5000 }).catch(() => {});
  await page.locator(skriv + ':visible').first().click().catch(() => {});
  await page.waitForSelector('#r-gick-val button[data-v="bra"]', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.click('#r-gick-val button[data-v="bra"]').catch(() => {});
  await page.fill('#r-notes', 'Vi läste en artikel om rymden.').catch(() => {});
  await page.uncheck('#r-ai').catch(() => {});
  await page.click('#r-spara').catch(() => {});
  await page.waitForFunction(n => NXForhandsvisning.värld.bookings.find(b => b.id === n).status === 'completed', id(111),
    { timeout: 6000 }).catch(() => {});
  const rapporten = await värld(page, n => {
    const W = NXForhandsvisning.värld;
    return { pass: W.bookings.find(b => b.id === n).status, rapport: W.lesson_reports.filter(r => r.booking_id === n).length };
  }, id(111));
  prova('studiehjälparvyn: en rapport sparas och passet blir genomfört', rapporten.pass === 'completed' && rapporten.rapport === 1,
    JSON.stringify(rapporten));
  await page.keyboard.press('Escape').catch(() => {});
  await vänta(2200);

  /* Elevens tråd. */
  await page.evaluate(() => { location.hash = '#meddelanden'; });
  await page.waitForSelector('#bc-ruta:not([hidden]) #bc-text', { timeout: 6000 }).catch(() => {});
  if (await synlig(page, '#bc-text')) {
    await page.fill('#bc-text', 'Ja, vi tar rabatter!');
    await page.click('#bc-skicka');
    await page.waitForFunction(() => /tar rabatter/.test(document.querySelector('#bc-trad').textContent), null, { timeout: 5000 }).catch(() => {});
  }
  prova('studiehjälparvyn: ett meddelande till eleven står i elevens tråd',
    (await text(page, '#bc-trad')).includes('Ja, vi tar rabatter!')
    && (await värld(page, () => NXForhandsvisning.värld.barn_meddelanden.some(m => m.body === 'Ja, vi tar rabatter!'))));
  prova('studiehjälparvyn: inget anrop mot den riktiga Supabase utom grinden', riktiga.length === 0, riktiga.join(', '));
  prova('studiehjälparvyn: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* Betygsgarantin (betygsgarantin_provas, 2026-10-15): studiehjälparen ser
   elevens garantiämnen men aldrig betyget, och rapporten säger om passet
   räknas för garantin. Kim får garanti i engelska direkt i världen. */
async function provaGarantiämnena(webb) {
  const { context, page, riktiga, konsol } = await öppnaFörhandsvisning(webb, { grind: 'admin' });
  await page.goto(BAS + '/larare?forhandsvisning');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  const nu = new Date(), läsår = nu.getMonth() >= 6 ? nu.getFullYear() : nu.getFullYear() - 1;
  await page.evaluate(([kim, år]) => {
    const k = 'nx-forhandsvisning-varld';
    const l = JSON.parse(localStorage.getItem(k));
    l.W.betygsgarantier.push({ id: 'f0000000-0000-4000-8000-000000000901', student_id: kim, lasar: år, amne: 'Engelska',
      betyg: 'D', anmald_at: new Date().toISOString(), andrad_at: null, betyg_gallrat_at: null });
    l.rev += 1;
    localStorage.setItem(k, JSON.stringify(l));
  }, [id(12), läsår]);
  await page.reload();
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);

  await page.evaluate(() => { location.hash = '#rapporter'; });
  const skriv = '[data-rapportera="' + id(111) + '"]';
  await page.waitForSelector(skriv + ':visible', { timeout: 5000 }).catch(() => {});
  await page.locator(skriv + ':visible').first().click().catch(() => {});
  await page.waitForSelector('#r-amne-garanti:not([hidden])', { timeout: 5000 }).catch(() => {});
  prova('garanti: rapporten säger att passet räknas för garantin',
    (await page.textContent('#r-amne-garanti').catch(() => '')) === 'Betygsgaranti i Engelska. Passet räknas för garantin.',
    await page.textContent('#r-amne-garanti').catch(() => ''));
  const först = await page.getAttribute('#r-amne-val button', 'data-v').catch(() => null);
  prova('garanti: garantins ämne står först i valet', först === 'Engelska', först);
  await page.click('#r-amne-byt').catch(() => {});
  await page.click('#r-amne-val button[data-v="Matematik"]').catch(() => {});
  prova('garanti: ett annat ämne får rapporten att be om rätt ämne',
    (await page.textContent('#r-amne-garanti').catch(() => ''))
      === 'Betygsgaranti i Engelska. Gällde passet det ämnet, välj det: garantin räknar bara tiden i rapporter med ämnet.',
    await page.textContent('#r-amne-garanti').catch(() => ''));
  await page.locator('#r-amne-garanti').scrollIntoViewIfNeeded().catch(() => {});
  await bild(page, 'studiehjalparvyn-garanti', '#rapport-form');
  await page.keyboard.press('Escape').catch(() => {});
  const profil = await page.textContent('#elev-profil').catch(() => '');
  prova('garanti: elevprofilen säger ämnet, aldrig betyget',
    /Betygsgaranti i Engelska\./.test(profil) && !/Betyg D|betyg D/.test(profil), profil.slice(0, 300));
  const anrop = await logg(page);
  prova('garanti: vyn frågar mina_elevers_garantiamnen',
    anrop.some(r => /mina_elevers_garantiamnen/.test(JSON.stringify(r))), JSON.stringify(anrop.slice(-3)));
  prova('garanti: inget anrop mot den riktiga Supabase utom grinden', riktiga.length === 0, riktiga.join(', '));
  prova('garanti: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

/* De två vyerna delar världen (Leo: "föreslå tid och byta vy och
   acceptera"): ett förslag som familjen, Byt i remsan, Acceptera som
   Sara, och tillbaka. Världen står kvar efter en omladdning, och Börja
   om tar bort den. */
async function provaDelad(webb) {
  const { context, page, riktiga, konsol } = await öppnaFörhandsvisning(webb, { grind: 'admin' });
  await page.goto(BAS + '/foralder?forhandsvisning#boka');
  await page.waitForSelector('#boka-inner .mv-dag', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
  const dag = await page.$$eval('#boka-inner .mv-dag:not([disabled])', d => d.map(x => x.dataset.datum).slice(-1)[0]);
  const förut = await passen(page);
  await page.click('#boka-inner .mv-dag[data-datum="' + dag + '"]');
  await page.waitForSelector('#boka-inner .mv-tid', { timeout: 3000 }).catch(() => {});
  await page.click('#boka-inner .mv-tid');
  await page.click('#boka-inner #bk-format button[data-v="Online"]');
  await page.click('#boka-inner #bk-boka');
  await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
  const nya = await nyaPass(page, förut);
  const nytt = nya.length === 1 && nya[0].wanted_date === dag && nya[0].status === 'requested' ? nya[0].id : null;
  prova('delad: familjens förslag finns i världen', !!nytt, JSON.stringify(nya));

  await page.reload();
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
  prova('delad: förslaget står kvar efter en omladdning',
    await page.evaluate(n => NXForhandsvisning.värld.bookings.some(b => b.id === n), nytt));

  await page.click('.nx-fv [data-fv-byt]');
  await page.waitForURL(u => new URL(u).pathname === '/larare', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
  prova('delad: remsan byter till studiehjälparvyn', new URL(page.url()).pathname === '/larare'
    && /Sara\.$/.test((await text(page, '#vy-hero h1')).trim()), page.url());
  await page.evaluate(() => { location.hash = '#tider'; });
  const knapp = '[data-acceptera="' + nytt + '"]:visible';
  await page.waitForSelector(knapp, { timeout: 6000 }).catch(() => {});
  prova('delad: studiehjälparen ser familjens förslag', (await page.locator(knapp).count()) === 1);
  await page.locator(knapp).first().click().catch(() => {});
  await page.waitForFunction(n => NXForhandsvisning.värld.bookings.find(b => b.id === n).status === 'confirmed', nytt,
    { timeout: 5000 }).catch(() => {});

  await page.click('.nx-fv [data-fv-byt]');
  await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
  prova('delad: tillbaka hos familjen är passet bekräftat',
    (await page.evaluate(n => NXForhandsvisning.värld.bookings.find(b => b.id === n).status, nytt)) === 'confirmed');
  await page.evaluate(() => { location.hash = '#lektioner'; });
  await page.waitForSelector('#pass-lista a[href="#pass/' + nytt + '"]', { timeout: 5000 }).catch(() => {});
  prova('delad: passet står under Mina lektioner', (await page.locator('#pass-lista a[href="#pass/' + nytt + '"]').count()) >= 1);

  await page.click('.nx-fv [data-fv-om]');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await stängNotisrutan(page);
  await vänta(300);
  const efter = await page.evaluate(n => ({
    finns: NXForhandsvisning.värld.bookings.some(b => b.id === n),
    alva: NXForhandsvisning.värld.barn_passforslag[0].lage
  }), nytt);
  prova('delad: Börja om ger en ny värld', !efter.finns && efter.alva === 'vantar', JSON.stringify(efter));
  prova('delad: inget anrop mot den riktiga Supabase utom grinden', riktiga.length === 0, riktiga.join(', '));
  prova('delad: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
  await context.close();
}

async function provaTelefonen(webb) {
  for (const [sida, vem] of [['/foralder', 'studievyn'], ['/larare', 'studiehjälparvyn']]) {
    for (const mörk of [false, true]) {
      const namn = vem + ' på telefon' + (mörk ? ', mörkt' : '');
      const { context, page, konsol } = await öppnaFörhandsvisning(webb, { grind: 'admin',
        context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: mörk ? 'dark' : 'light' } });
      await page.goto(BAS + sida + '?forhandsvisning');
      await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
      await stängNotisrutan(page);
      await vänta(300);
      const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
      const små = await page.evaluate(() => Array.from(document.querySelectorAll('.nx-fv a'))
        .map(a => a.getBoundingClientRect()).filter(r => Math.round(r.height) < 44).length);
      prova(namn + ': remsans länkar är minst 44 px', små === 0, små + ' lägre');
      prova(namn + ': inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
      await bild(page, 'telefon-' + vem + (mörk ? '-mork' : ''), '#hdr');
      await context.close();
    }
  }
}

/* ============ adminvyn, mot en falsk Supabase ============ */
const ADMIN_KONTON = {
  'admin-1': { role: 'authenticated', email: 'leo@example.se' },
  'admin-2': { role: 'authenticated', email: 'nina@example.se' }
};
function adminVärld() {
  const fram = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Superadmin', email: 'leo@example.se', is_admin: true,
        match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'admin-2', role: 'admin', full_name: 'Nina Begränsad', email: 'nina@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-02T10:00:00Z' },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' }
    ],
    students: [
      { id: 'barn-admin', parent_id: 'admin-1', name: 'Testbarn', grade: 'Åk 6', matched_tutor_id: 'handledare-1',
        match_status: 'matched', created_at: '2026-09-01T10:00:00Z' },
      { id: 'barn-1', parent_id: 'foralder-1', name: 'Alva', grade: 'Åk 6', matched_tutor_id: 'handledare-1',
        match_status: 'matched', created_at: '2026-09-02T10:00:00Z' }
    ],
    tutor_profiles: [{ id: 'handledare-1', status: 'approved', created_at: '2026-09-01T10:00:00Z' }],
    admin_roller: [
      { user_id: 'admin-1', ar_superadmin: true, behorigheter: [] },
      { user_id: 'admin-2', ar_superadmin: false, behorigheter: ['leads'] }
    ],
    bookings: [
      { id: 'b-1', parent_id: 'foralder-1', tutor_id: 'handledare-1', student_id: 'barn-1', subject: 'Matematik',
        wanted_date: fram(3), wanted_time: '17:00', duration_min: 60, status: 'confirmed', created_at: '2026-10-01T10:00:00Z' },
      { id: 'b-2', parent_id: 'admin-1', tutor_id: 'handledare-1', student_id: 'barn-admin', subject: 'Matematik',
        wanted_date: fram(4), wanted_time: '17:00', duration_min: 60, status: 'confirmed', created_at: '2026-10-01T10:00:00Z' },
      { id: 'b-3', parent_id: 'admin-1', tutor_id: 'handledare-1', student_id: 'barn-admin', subject: 'Matematik',
        wanted_date: fram(-3), wanted_time: '17:00', duration_min: 60, status: 'completed', created_at: '2026-10-01T10:00:00Z' }
    ]
  };
}

async function öppnaAdmin(webb, vem, roll) {
  const context = await webb.newContext({ viewport: { width: 1280, height: 900 } });
  const W = adminVärld();
  const riktiga = [];
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({ 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      'access-control-expose-headers': 'content-range, x-total-count' }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  const användare = { id: vem, aud: 'authenticated', role: 'authenticated', email: ADMIN_KONTON[vem].email,
                      app_metadata: { provider: 'email' }, user_metadata: {} };
  const session = { access_token: jwt(vem), refresh_token: 'prov', token_type: 'bearer', expires_in: 3600,
                    expires_at: Math.floor(Date.now() / 1000) + 3600, user: användare };
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
    if (p.startsWith('/functions/v1/')) return svar(route, 404, { error: 'Ingen funktion i provet.' });
    if (p === '/rest/v1/rpc/mina_behorigheter') return svar(route, 200, roll);
    if (p.startsWith('/rest/v1/rpc/')) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      let rader = (W[tabell] || []).slice();
      for (const [k, v] of url.searchParams.entries()) {
        const m = /^eq\.(.*)$/.exec(v);
        if (m && !['select', 'order', 'limit', 'offset'].includes(k)) rader = rader.filter(r => String(r[k]) === m[1]);
      }
      /* RLS: rollerna läser bara en superadmin. */
      if (tabell === 'admin_roller' && !roll.superadmin) rader = [];
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
  return { context, page, riktiga, konsol };
}

async function provaAdminvyn(webb) {
  /* Superadmin: sektionen, länkarna och talen utan vårt eget konto. */
  {
    const { context, page, riktiga } = await öppnaAdmin(webb, 'admin-1', { admin: true, superadmin: true, behorigheter: [] });
    await page.goto(BAS + '/admin');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 12000 }).catch(() => {});
    await page.waitForFunction(() => /Aktiva elever/.test((document.querySelector('#adm-tal') || {}).textContent || ''), null,
      { timeout: 10000 }).catch(() => {});
    const tal = await page.$$eval('#adm-tal .adm-kpi', k => k.map(x => [x.querySelector('span').textContent, x.querySelector('b').textContent]));
    const värdet = namn => (tal.find(t => t[0] === namn) || [])[1];
    prova('admin: Aktiva elever räknar inte adminens barn', värdet('Aktiva elever') === '1', JSON.stringify(tal));
    prova('admin: Kommande lektioner räknar inte adminens pass', värdet('Kommande lektioner') === '1', JSON.stringify(tal));
    await page.evaluate(() => { location.hash = '#statistik'; });
    await page.waitForSelector('#stat-tal .adm-kpi', { timeout: 6000 }).catch(() => {});
    const familjer = await page.$$eval('#stat-tal .adm-kpi', k => k.map(x => x.textContent));
    prova('admin: Statistik räknar en familj och en elev', familjer.some(t => /^1Familjer1elev$/.test(t.replace(/\s+/g, ''))),
      JSON.stringify(familjer));
    prova('admin: listan Familjer har kvar adminens konto', (await page.evaluate(() => Object.keys(NXAdmin.S.personer).includes('admin-1'))));

    await page.click('#vy-sido a[data-sek="forhandsvisning"]');
    await page.waitForSelector('section[data-sek="forhandsvisning"]:not([hidden])', { timeout: 4000 }).catch(() => {});
    prova('admin: sektionen Förhandsvisning finns', await synlig(page, 'section[data-sek="forhandsvisning"]'));
    const länkar = await page.$$eval('section[data-sek="forhandsvisning"] a[data-fv]',
      a => a.map(x => [x.getAttribute('href'), x.getAttribute('target'), x.getAttribute('rel')]));
    prova('admin: två länkar, i en ny flik', JSON.stringify(länkar) === JSON.stringify([
      ['/foralder?forhandsvisning', '_blank', 'noopener'], ['/larare?forhandsvisning', '_blank', 'noopener']]), JSON.stringify(länkar));
    await bild(page, 'admin-forhandsvisning', 'section[data-sek="forhandsvisning"]');
    prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }
  /* En admin med bara Intresseanmälningar ser den också. */
  {
    const { context, page } = await öppnaAdmin(webb, 'admin-2', { admin: true, superadmin: false, behorigheter: ['leads'] });
    await page.goto(BAS + '/admin#forhandsvisning');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 12000 }).catch(() => {});
    await vänta(500);
    prova('admin med behörigheter: Förhandsvisning står i menyn och öppnas',
      (await synlig(page, '#vy-sido a[data-sek="forhandsvisning"]')) && (await synlig(page, 'section[data-sek="forhandsvisning"]')));
    await context.close();
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaGrinden(webb);
    await provaStudievyn(webb);
    await provaStudiehjalparvyn(webb);
    await provaGarantiämnena(webb);
    await provaDelad(webb);
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
