/* ============================================================
   NEXTRUM — avregistreringen (/avanmal och /en/avanmal)

   Länken längst ner i varje notismejl går hit:
   nextrum.se/avanmal?t=<uid>.<kanal>.<typ>.<signatur>. Tokenen prövas
   av edge-funktionen notis-avanmal, som har nyckeln. Sidan har den
   inte och ska inte ha den.

   TRE REGLER

   1. INGENTING HÄNDER UTAN ETT KNAPPTRYCK. Länkskannrar i
      företagsmejl och antivirus öppnar varje länk i ett mejl. En
      sida som avregistrerade när den laddades hade avregistrerat folk
      som aldrig rört något. Därför en knapp, och en POST först när
      någon trycker. Funktionen själv svarar 405 på GET av samma skäl.

   2. SIDAN LITAR INTE PÅ TOKENEN. Typen och kanalen läses ur den för
      att sidan ska kunna säga VAD länken gäller, och till inget annat.
      Om den är äkta avgör servern. Efteråt skrivs beskedet ur serverns
      svar, inte ur adressen.

   3. INGET INLINE-SKRIPT. Sidan har samma skarpa CSP som de inloggade
      vyerna (vercel.json). Det de andra publika sidorna gör i ett
      <script> sist i sidan görs därför här.

   SPRÅKET läses ur <html lang>, som i nextrum-app.js: /en/-sidorna
   är kopior där bara textnoderna bytts, och generatorn översätter
   aldrig skript. Allt som skrivs till besökaren härifrån står därför
   i par nedan. Serverns feltexter är svenska och visas inte; sidan
   väljer sin egen text utifrån statuskoden.
   ============================================================ */
(function () {
  'use strict';

  const { $ } = NX;

  NX.initHeader();
  NX.initVagval();
  NX.märkInloggad();

  const SPRÅK = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv') ? 1 : 0;
  const ORD = {
    vad:      ['Den här länken stänger av {vad}.', 'This link turns off {vad}.'],
    saknas:   ['Länken saknar sin kod. Öppna den direkt från mejlet, eller logga in och ändra dina val, se nedan.',
               'The link is missing its code. Open it straight from the email, or log in and change your choices, see below.'],
    trasig:   ['Länken ser inte hel ut. Mejlprogram delar ibland långa länkar i två delar. Öppna den direkt från mejlet, eller logga in och ändra dina val, se nedan.',
               'The link does not look complete. Email programs sometimes split long links in two. Open it straight from the email, or log in and change your choices, see below.'],
    sparar:   ['Sparar…', 'Saving…'],
    /* Kolon, inte "vi skickar inte längre alla mejl": det hade kunnat
       läsas som att en del mejl fortfarande går. */
    klart:    ['Klart. Det här är avstängt: {vad}.', 'Done. This is now turned off: {vad}.'],
    ogiltig:  ['Länken är inte giltig. Öppna den direkt från mejlet, eller logga in och ändra dina val, se nedan.',
               'The link is not valid. Open it straight from the email, or log in and change your choices, see below.'],
    gammal:   ['Länken gäller inte längre. Logga in och ändra dina val, se nedan.',
               'The link is no longer valid. Log in and change your choices, see below.'],
    igen:     ['Det gick inte att spara just nu. Försök igen om en stund.',
               'It could not be saved just now. Please try again in a moment.'],
    natverk:  ['Det gick inte att nå Nextrum. Kontrollera anslutningen och försök igen.',
               'Could not reach Nextrum. Check your connection and try again.']
  };
  function t(nyckel, vad) {
    const par = ORD[nyckel];
    const text = par ? par[SPRÅK] : nyckel;
    return vad == null ? text : text.replace('{vad}', vad);
  }

  /* Vad en token stänger av, i klartext. Samma typer som
     notis_typer() i databasen och NOTIS_TYPER i _delad/notiser/typer.ts,
     plus 'alla'. SMS finns bara som påminnelse; en annan typ i kanalen
     sms får den allmänna texten. */
  const VAD = {
    mejl: {
      pass_nytt:      ['mejl när ett nytt pass bokas', 'emails when a new session is booked'],
      pass_bekraftat: ['mejl när ett pass bekräftas', 'emails when a session is confirmed'],
      pass_flyttat:   ['mejl när ett pass flyttas', 'emails when a session is moved'],
      pass_avbokat:   ['mejl när ett pass avbokas', 'emails when a session is cancelled'],
      pass_avbojt:    ['mejl när ett önskat pass avböjs', 'emails when a requested session is declined'],
      meddelande:     ['mejl om nya meddelanden', 'emails about new messages'],
      rapport:        ['mejl om nya rapporter', 'emails about new reports'],
      paminnelse:     ['påminnelser som mejl före ett pass', 'email reminders before a session'],
      alla:           ['alla mejl om pass, meddelanden och påminnelser',
                       'all emails about sessions, messages and reminders']
    },
    sms: {
      paminnelse:     ['påminnelser som SMS före ett pass', 'text message reminders before a session'],
      alla:           ['alla påminnelser som SMS', 'all text message reminders'],
      annat:          ['den här sortens SMS', 'this kind of text message']
    }
  };

  function vadText(kanal, typ) {
    const k = VAD[kanal];
    if (!k) return null;
    const par = k[typ] || (kanal === 'sms' && VAD.mejl[typ] ? k.annat : null);
    return par ? par[SPRÅK] : null;
  }

  /* Formen, inte äktheten. Samma mönster som lasToken() i
     _delad/notiser/token.ts, så att sidan inte visar en knapp för en
     länk som servern med säkerhet kommer att vägra. */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const SIGNATUR = /^[A-Za-z0-9_-]{43}$/;

  function läsToken(token) {
    const delar = String(token || '').split('.');
    if (delar.length !== 4) return null;
    const [uid, kanal, typ, sig] = delar;
    if (!UUID.test(uid) || !SIGNATUR.test(sig)) return null;
    const vad = vadText(kanal, typ);
    return vad ? { kanal: kanal, typ: typ, vad: vad } : null;
  }

  const vadEl = $('#avanmal-vad');
  const knapp = $('#avanmal-knapp');
  const svar = $('#avanmal-svar');
  if (!vadEl || !knapp || !svar) return;

  let token = null;
  try {
    token = new URLSearchParams(location.search).get('t');
  } catch (e) {
    token = null;
  }
  token = token ? token.trim().slice(0, 300) : '';

  /* Språkvalet leder till samma sida på det andra språket. Utan koden
     i den adressen hade bytet tappat länken, och besökaren hade stått
     på en sida som säger att koden saknas. */
  if (token) {
    const byt = document.querySelector('.sprakval a[hreflang]');
    if (byt) byt.setAttribute('href', byt.getAttribute('href') + '?t=' + encodeURIComponent(token));
  }

  if (!token) {
    vadEl.textContent = t('saknas');
    return;
  }
  const lank = läsToken(token);
  if (!lank) {
    vadEl.textContent = t('trasig');
    return;
  }

  vadEl.textContent = t('vad', lank.vad);
  knapp.hidden = false;
  const knappText = knapp.textContent;

  function besked(text, ok) {
    svar.textContent = text;
    svar.classList.add('show');
    svar.classList.toggle('is-err', !ok);
    svar.focus();
  }

  knapp.addEventListener('click', async () => {
    if (knapp.disabled) return;
    const bas = String((NX.CFG && NX.CFG.SUPABASE_URL) || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(bas)) { besked(t('igen'), false); return; }

    knapp.disabled = true;
    knapp.setAttribute('aria-busy', 'true');
    knapp.textContent = t('sparar');
    svar.classList.remove('show', 'is-err');
    svar.textContent = '';

    /* En POST utan kropp och utan egna headers är en "enkel" begäran:
       ingen förfrågan före, och tokenen står i adressen, där
       funktionen läser den först. Inga kakor och ingen Referer följer
       med, de behövs inte och koden ska inte läcka. */
    let res = null;
    let kropp = null;
    try {
      res = await fetch(bas + '/functions/v1/notis-avanmal?t=' + encodeURIComponent(token), {
        method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      });
      kropp = await res.json().catch(() => null);
    } catch (e) {
      res = null;
    }

    knapp.removeAttribute('aria-busy');
    knapp.textContent = knappText;

    if (res && res.ok && kropp && kropp.ok === true) {
      /* Serverns kanal och typ, inte adressens: det är de som sparats. */
      const vad = vadText(kropp.kanal, kropp.typ) || lank.vad;
      knapp.hidden = true;
      besked(t('klart', vad), true);
      return;
    }

    if (!res) { knapp.disabled = false; besked(t('natverk'), false); return; }
    /* 403 är en länk som inte är äkta, 400 en länk till ett konto som
       inte finns längre. Ingen av dem blir bättre av ett nytt försök,
       så knappen försvinner. Allt annat är servern, och då går det att
       försöka igen. */
    if (res.status === 403) { knapp.hidden = true; besked(t('ogiltig'), false); return; }
    if (res.status === 400) { knapp.hidden = true; besked(t('gammal'), false); return; }
    knapp.disabled = false;
    besked(t('igen'), false);
  });
})();
