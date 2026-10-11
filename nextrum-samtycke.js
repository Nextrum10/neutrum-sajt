/* ============================================================
   NEXTRUM — samtycket (NXSamtycke)

   Rutan som frågar om lov, och det enda stället som får svara på
   frågan "får vi?". Allt som lagrar eller läser något i besökarens
   enhet utan att vara nödvändigt för det besökaren bett om kräver
   samtycke (LEK 9 kap. 28 §), och går genom har() och laddas först
   när svaret är ja.

   RUTAN VISAS BARA NÄR DET FINNS NÅGOT ATT FRÅGA OM. Vad det är står
   i NEXTRUM_CONFIG.SAMTYCKE. Är allt där av finns ingen ruta, ingen
   länk i footern och ingenting lagras.

   TVÅ SYFTEN, OCH BESÖKAREN VÄLJER VARJE FÖR SIG. Ett samtycke ska
   vara specifikt (GDPR art. 4.11), och ett ja till statistik är inte
   ett ja till annonsmätning:
   - statistik: Vercel Web Analytics och Speed Insights, och Google
     Analytics om GOOGLE_TAG_ID är satt (2026-10-11). Vercel sätter
     ingen cookie, men skriptet får webbläsaren att skicka sidadress,
     hänvisare och enhet, och EDPB räknar det som "åtkomst" i
     enheten (riktlinjer 2/2023). Google Analytics sätter _ga och
     _ga_<id>. Sverige har inget undantag för statistik, och PTS
     räknar statistik som inte nödvändigt. Därför laddas skripten
     här, efter ja, och inte i sidorna. Före 27 september 2026 stod
     Vercels i varje sida med en kommentar om att inget samtycke
     krävdes.
   - annonser: källspårningen (webbläsaren minns i sessionStorage
     'nx-kalla', skrivet av NX.källa(), varifrån besökaren kom tills
     fliken stängs) och, om ett id står i konfigurationen, Metas
     pixel och Google Ads konvertering. Google Analytics hör INTE
     hit: fram till 2026-10-11 laddades den bara med ett ja till
     annonser, och ett ja till statistik gav den ingenting.
   Ett svar gäller de funktioner rutan beskrev när det gavs
   (`omfattar`). Slås en ny på frågar rutan igen: ett ja till att
   minnas en länk är inte ett ja till Meta.

   NEJ ÄR LIKA LÄTT SOM JA. "Neka alla" och "Godkänn alla" är samma
   knapp bredvid varandra, på första nivån, och inget är förkryssat.
   PTS och IMY kräver det (IMY:s reprimand mot ATG 2025 gällde just
   en Acceptera som syntes tydligare än Neka).

   Svaret sparas i localStorage ('nx-samtycke') i ett år och frågas
   sedan igen. Att minnas svaret kräver inget samtycke, för utan det
   går det inte att låta bli att fråga. Global Privacy Control räknas
   som nej till allt utan att rutan visas; panelen på lagring.html
   säger det, och där går det att ändra.

   Laddas efter nextrum-app.js, bara på de öppna sidorna. De inloggade
   vyerna har ingenting som kräver samtycke. Allt som skrivs till
   besökaren står som par i ORD: /en/-generatorn översätter aldrig
   <script>.
   ============================================================ */
const NXSamtycke = (function () {
  'use strict';

  const CFG = (window.NEXTRUM_CONFIG && window.NEXTRUM_CONFIG.SAMTYCKE) || {};
  const NYCKEL = 'nx-samtycke';
  const KÄLL_NYCKEL = 'nx-kalla';   // samma som i nextrum-app.js
  const GILTIG_MS = 365 * 24 * 3600 * 1000;
  const EN = String(document.documentElement.lang || 'sv').slice(0, 2) === 'en';

  /* Texten säger vad som mäts, av vem, hur länge och att nej fungerar
     lika bra: det ett giltigt samtycke kräver, i vanliga ord. Två
     tidigare rubriker med ordlekar valdes bort samma dag. */
  const ORD = {
    et:          ['Cookies och lagring', 'Cookies and storage'],
    rubrik:      ['Du bestämmer vad vi får mäta', 'You decide what we may measure'],
    intro:       ['Sajten fungerar likadant oavsett vad du väljer. Utan ditt ja sätts inga cookies.',
                  'The site works the same whatever you choose. Without your yes, no cookies are set.'],
    statistik:   ['Besöksstatistik', 'Visitor statistics'],
    statistikOm: ['Hur många som besöker sajten och vilka sidor som läses.',
                  'How many people visit and which pages are read.'],
    vercel:      ['Vercel räknar utan cookies.', 'Vercel counts without cookies.'],
    analytics:   ['Google Analytics räknar med två cookies som sparas ett år efter ditt senaste besök, och Google kan behandla uppgifterna i USA.',
                  'Google Analytics counts using two cookies kept for a year after your latest visit, and Google may process the data in the USA.'],
    annonser:    ['Annonsmätning', 'Ad measurement'],
    kalla:       ['Om du kom hit via en annons eller en länk, så att vi ser vad som fungerar. Webbläsaren minns det tills du stänger fliken.',
                  'Whether you came through an ad or a link, so we can see what works. Your browser remembers it until you close the tab.'],
    meta:        ['Meta (Facebook och Instagram) får veta att du kom från deras annons och om du skickade en anmälan, och kan koppla det till ditt konto hos dem.',
                  'Meta (Facebook and Instagram) learns that you came from their ad and whether you sent an enquiry, and may link this to your account with them.'],
    googleads:   ['Google får veta att du kom från deras annons och om du skickade en anmälan.',
                  'Google learns that you came from their ad and whether you sent an enquiry.'],
    nekaAlla:    ['Neka alla', 'Reject all'],
    godkannAlla: ['Godkänn alla', 'Accept all'],
    sparaVal:    ['Spara mitt val', 'Save my choice'],
    fot:         ['Ändra dig när som helst under Cookieinställningar längst ner.',
                  'Change your mind any time under Cookie settings at the bottom.'],
    läsMer:      ['Läs mer', 'Read more'],
    region:      ['Samtycke', 'Consent'],
    valt:        ['Ditt val sedan {d}: {lista}.', 'Your choice since {d}: {lista}.'],
    ja:          ['ja', 'yes'],
    nej:         ['nej', 'no'],
    gpc:         ['Din webbläsare säger att du inte vill spåras (Global Privacy Control), så vi räknar det som nej till allt. Du kan ändra det här.',
                  'Your browser says you do not want to be tracked (Global Privacy Control), so we treat it as no to everything. You can change that here.'],
    ejValt:      ['Du har inte valt än.', 'You have not chosen yet.'],
    inget:       ['Det finns inget att samtycka till just nu: sajten använder ingenting som kräver det.',
                  'There is nothing to consent to at the moment: the site uses nothing that requires it.']
  };
  function t(k, v) {
    let s = ORD[k][EN ? 1 : 0];
    if (v) Object.keys(v).forEach(n => { s = s.replace('{' + n + '}', v[n]); });
    return s;
  }

  /* ---------- vad som är påslaget ---------- */
  /* Id:na prövas mot sin form. Ett felskrivet id ska inte bli ett
     skript från Meta med en adress någon annan valt. */
  function metaId() {
    const id = String(CFG.META_PIXEL_ID || '').trim();
    return /^\d{8,20}$/.test(id) ? id : '';
  }
  /* GOOGLE_TAG_ID är Google Analytics och tar bara ett G-id. Google
     Ads är annonser och har sitt konto i GOOGLE_ADS_LEAD; ett AW-id
     här hade gett Ads ett ja som besökaren gav till statistik. */
  function googleId() {
    const id = String(CFG.GOOGLE_TAG_ID || '').trim();
    return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : '';
  }
  function adsMål() {
    const mål = String(CFG.GOOGLE_ADS_LEAD || '').trim();
    return /^AW-[A-Z0-9]+\/[\w-]+$/.test(mål) ? mål : '';
  }
  function adsKonto() { return adsMål().split('/')[0]; }
  /* Funktionerna, och vilket syfte var och en hör till. 'statistik'
     är Vercel; namnet står kvar för att lagrade svar (`omfattar`)
     bär det. */
  const SYFTE = {
    statistik: 'statistik', google: 'statistik',
    kallsparning: 'annonser', meta: 'annonser', googleads: 'annonser'
  };
  function funktioner() {
    const a = [];
    if (CFG.STATISTIK) a.push('statistik');
    if (googleId()) a.push('google');
    if (CFG.KALLSPARNING) a.push('kallsparning');
    if (metaId()) a.push('meta');
    if (adsMål()) a.push('googleads');
    return a;
  }
  function syften() {
    const f = funktioner();
    return ['statistik', 'annonser'].filter(s => f.some(x => SYFTE[x] === s));
  }

  /* ---------- svaret ---------- */
  /* Svaret som gavs PÅ SIDAN vinner över det som står lagrat. Går
     skrivningen inte igenom (fullt, privat läge i äldre Safari) står
     det gamla kvar i lagringen, och då hade ett gammalt nej slagit ett
     nytt ja. Går lagringen inte alls gäller svaret sidan ut. */
  let minne = null;
  function läs() {
    if (minne) return minne;
    try {
      const rå = localStorage.getItem(NYCKEL);
      if (rå) return JSON.parse(rå);
    } catch (e) { /* ingenting lagrat som går att läsa */ }
    return null;
  }
  /* Ett svar från före september 2026 (v1, ett enda ja eller nej)
     gäller inte: det beskrev inte statistiken. */
  function giltigt(s) {
    if (!s || s.v !== 2 || typeof s.val !== 'object' || !s.val || !Array.isArray(s.omfattar)) return false;
    const tid = Date.parse(s.tid);
    if (!tid || Date.now() - tid > GILTIG_MS) return false;
    return funktioner().every(f => s.omfattar.indexOf(f) >= 0);
  }
  function gpc() {
    try { return navigator.globalPrivacyControl === true; } catch (e) { return false; }
  }
  /* Har besökaren sagt ja till syftet den här funktionen hör till,
     och är funktionen på? */
  function har(funktion) {
    if (funktioner().indexOf(funktion) < 0) return false;
    const s = läs();
    return giltigt(s) && s.val[SYFTE[funktion]] === true;
  }
  function nuvarande() {
    const s = läs();
    return giltigt(s) ? s.val : null;
  }

  let laddat = { statistik: false, annonser: false };
  function spara(val) {
    const förut = nuvarande() || {};
    const s = { v: 2, val: {}, omfattar: funktioner(), tid: new Date().toISOString() };
    syften().forEach(k => { s.val[k] = val[k] === true; });
    minne = s;
    try { localStorage.setItem(NYCKEL, JSON.stringify(s)); } catch (e) { /* minnet får räcka */ }

    tillämpa();
    let laddaOm = false;
    ['statistik', 'annonser'].forEach(k => {
      if (!s.val[k] && förut[k] && laddat[k]) laddaOm = true;
    });
    try {
      if (typeof NX !== 'undefined') NX.händelse('samtycke', {
        statistik: s.val.statistik ? 'ja' : 'nej', annonser: s.val.annonser ? 'ja' : 'nej'
      });
    } catch (e) {}
    /* Ett skript som redan körts går inte att ladda ur. Drogs ett ja
       tillbaka medan skripten var igång laddas sidan om, utan dem. */
    if (laddaOm) location.reload();
  }

  /* ---------- ja: det som får köras ---------- */
  /* Körs vid varje sidladdning, också utan svar: det som hör till ett
     syfte utan ja rensas först, så att en cookie från ett ja som dragits
     tillbaka eller gått ut inte blir kvar. */
  let vercelLaddat = false;
  function tillämpa() {
    const nu = nuvarande() || {};
    ['statistik', 'annonser'].forEach(k => { if (nu[k] !== true) rensa(k); });

    if (har('statistik') && !vercelLaddat) { laddaVercel(); vercelLaddat = laddat.statistik = true; }
    /* Källan skrivs direkt, så att sidan besökaren landade på räknas
       också när ja kom först här. Kom ja på en senare sida är
       landningen redan borta; NX.källa() sparar då inget alls hellre
       än att spara fel. */
    if (har('kallsparning') && typeof NX !== 'undefined' && NX.källa) {
      try { NX.källa(); } catch (e) {}
    }
    if (har('meta')) { laddaMeta(metaId()); laddat.annonser = true; }
    if (har('google') || har('googleads')) laddaGoogle();
  }

  function skript(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  /* Adressen som den lämnar oss: utan frågesträng, utom våra egna
     utm-taggar och det `behåll` släpper igenom, och utan #. En kod i
     intresseanmälan (?kod=) eller en nyckel ur ett mejl hör inte
     hemma i någon annans logg. Samma regel som landningen i
     NX.källa(). Vercel sparar frågesträngen om den inte filtreras
     bort, och Google likaså. */
  function renAdress(href, behåll) {
    try {
      const u = new URL(href, location.href);
      const egna = new URLSearchParams();
      u.searchParams.forEach((v, n) => {
        if (/^utm_/.test(n) || (behåll && behåll.test(n))) egna.append(n, v);
      });
      const sök = egna.toString();
      return u.origin + u.pathname + (sök ? '?' + sök : '');
    } catch (e) { return ''; }
  }

  /* Vercels egna köer, så att NX.händelse() kan anropa window.va innan
     skriptet hunnit laddas. Sökvägarna serveras av Vercel; lokalt ger
     de 404, vilket är ofarligt. De inloggade vyerna mäts inte alls. */
  function laddaVercel() {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    const ren = h => Object.assign({}, h, { url: renAdress(h.url) });
    window.va('beforeSend', ren);
    window.si('beforeSend', ren);
    skript('/_vercel/insights/script.js');
    skript('/_vercel/speed-insights/script.js');
  }

  /* Metas egen laddare, utskriven. autoConfig av: annars läser
     pixeln av knappar och formulärfält på egen hand, och det här är
     en sida där föräldrar skriver sitt barns namn. Automatisk
     avancerad matchning ska dessutom vara AV i Events Manager —
     det går inte att styra härifrån. IMY har bötfällt för just den. */
  function laddaMeta(id) {
    if (window.fbq) return;
    const f = window.fbq = function () {
      if (f.callMethod) f.callMethod.apply(f, arguments); else f.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    skript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, id);
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  /* Google Analytics (statistik) och Google Ads (annonser) delar
     gtag.js, och den laddas först när något av dem har sitt ja.
     Consent Mode börjar på nej för allt och uppdateras sedan till det
     besökaren sagt, syfte för syfte; förut började den på ja, innan
     något svar fanns. ad_personalization står alltid på nej, för rutan
     frågar inte om personliga annonser, och Google-signaler är av av
     samma skäl. Ett id konfigureras bara med ja till sitt syfte: utan
     det hade Analytics skickat cookiefria pingar ändå. Kopplas
     Analytics-egendomen till Google Ads blir statistiken annonsdata,
     och det har ingen sagt ja till. */
  const konfad = { ga: false, ads: false };
  function laddaGoogle() {
    const stat = har('google'), ads = har('googleads');
    if (!stat && !ads) return;
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied'
      });
      window.gtag('set', 'ads_data_redaction', true);
      skript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(stat ? googleId() : adsKonto()));
      window.gtag('js', new Date());
    }
    window.gtag('consent', 'update', {
      analytics_storage: stat ? 'granted' : 'denied',
      ad_storage: ads ? 'granted' : 'denied',
      ad_user_data: ads ? 'granted' : 'denied'
    });
    const inst = { allow_google_signals: false, allow_ad_personalization_signals: false };
    if (stat && !konfad.ga) {
      konfad.ga = laddat.statistik = true;
      const ga = Object.assign({
        page_location: renAdress(location.href),
        cookie_expires: 365 * 24 * 3600   // som svaret: ett år, inte Googles två
      }, inst);
      if (document.referrer) ga.page_referrer = renAdress(document.referrer);
      window.gtag('config', googleId(), ga);
    }
    /* Ads behöver klick-id:t för att koppla anmälan till annonsen,
       och har ett ja till just det. */
    if (ads && !konfad.ads) {
      konfad.ads = laddat.annonser = true;
      window.gtag('config', adsKonto(), Object.assign({
        page_location: renAdress(location.href, /^(gclid|gbraid|wbraid)$/)
      }, inst));
    }
  }

  /* En händelse från NX.händelse(). Bara anmälan är en konvertering:
     en jobbansökan är inte en kund, och en annons som optimeras mot
     sextonåringar som söker jobb köper fel publik. Inget om besökaren
     följer med, varken e-post, namn eller årskurs. */
  function konvertering(namn) {
    if (namn !== 'intresseanmalan') return;
    try {
      if (har('meta') && window.fbq) window.fbq('track', 'Lead');
      /* send_to på båda: utan det går en händelse till varje
         konfigurerat id, och Analytics anmälan hade blivit en
         Ads-händelse. */
      if (window.gtag) {
        if (har('google')) window.gtag('event', 'generate_lead', { send_to: googleId() });
        if (har('googleads')) window.gtag('event', 'conversion', { send_to: adsMål() });
      }
    } catch (e) { /* mätning får aldrig stoppa något */ }
  }

  /* ---------- nej: det som ska bort ---------- */
  /* Googles och Metas cookies sätts på vår domän och försvinner inte
     av sig själva. */
  const KAKOR = {
    statistik: /^(_ga|_ga_[A-Z0-9]+|_gid)$/,
    annonser: /^(_fbp|_fbc|_gcl_au|_gcl_aw|_gcl_dc)$/
  };
  function rensa(syfte) {
    if (syfte === 'annonser') { try { sessionStorage.removeItem(KÄLL_NYCKEL); } catch (e) {} }
    const värd = location.hostname;
    const domäner = ['', värd, '.' + värd.replace(/^www\./, '')];
    String(document.cookie || '').split(';').forEach(p => {
      const namn = p.split('=')[0].trim();
      if (!KAKOR[syfte].test(namn)) return;
      domäner.forEach(d => {
        document.cookie = namn + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------- rutan och panelen ---------- */
  function beskrivning(syfte) {
    const f = funktioner(), st = [];
    const på = (namn, ord) => { if (f.indexOf(namn) >= 0) st.push(t(ord)); };
    if (syfte === 'statistik') {
      st.push(t('statistikOm'));
      på('statistik', 'vercel');
      på('google', 'analytics');
    } else {
      på('kallsparning', 'kalla');
      på('meta', 'meta');
      på('googleads', 'googleads');
    }
    return st.join(' ');
  }

  /* Vad som gäller nu, i ord. Tomt när inget är valt i rutan: där
     är frågan själv beskedet. */
  function lägesText(förVal) {
    const s = läs();
    if (giltigt(s)) {
      const d = new Date(s.tid).toLocaleDateString(EN ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
      const lista = syften().map(k => t(k).toLowerCase() + ' ' + t(s.val[k] ? 'ja' : 'nej')).join(', ');
      return t('valt', { d: d, lista: lista });
    }
    if (!förVal) return '';
    return gpc() ? t('gpc') : t('ejValt');
  }

  /* Ett val per syfte, inget förkryssat, och tre knappar som ser
     likadana ut. Kryssrutorna visar det som gäller nu, så att den som
     öppnar rutan igen ser vad hen ändrar från. */
  let löpnr = 0;
  function valen(värd, efter) {
    const nu = nuvarande() || {};
    const lista = document.createElement('div');
    lista.className = 'nx-kakor-syften';
    const rutor = {};
    syften().forEach(k => {
      const id = 'nx-kakor-' + k + '-' + (++löpnr);
      const rad = document.createElement('label');
      rad.className = 'nx-kakor-syfte';
      rad.htmlFor = id;
      const in_ = document.createElement('input');
      in_.type = 'checkbox';
      in_.id = id;
      in_.checked = nu[k] === true;
      rutor[k] = in_;
      const text = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = t(k);
      const om = document.createElement('span');
      om.textContent = beskrivning(k);
      text.append(b, om);
      rad.append(in_, text);
      lista.appendChild(rad);
    });
    värd.appendChild(lista);

    const rad = document.createElement('div');
    rad.className = 'nx-kakor-knappar';
    const knapp = (ord, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn nx-kakor-val';
      b.textContent = t(ord);
      b.addEventListener('click', fn);
      rad.appendChild(b);
      return b;
    };
    const alla = ja => () => {
      const val = {};
      syften().forEach(k => { val[k] = ja; rutor[k].checked = ja; });
      spara(val); efter();
    };
    knapp('nekaAlla', alla(false));
    knapp('godkannAlla', alla(true));
    knapp('sparaVal', () => {
      const val = {};
      syften().forEach(k => { val[k] = rutor[k].checked; });
      spara(val); efter();
    }).classList.add('nx-kakor-spara');
    värd.appendChild(rad);
  }

  /* Reglagen: tre linjer med var sin knopp. Statisk markup, aldrig
     något ur en användare. */
  const IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/>'
    + '<circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/></svg>';

  let ruta = null;
  function stäng() {
    if (!ruta) return;
    ruta.classList.remove('nx-kakor-in');
    document.body.classList.remove('nx-kakor-visas');
    const r = ruta;
    ruta = null;
    setTimeout(() => r.remove(), 320);
  }

  function visa(fokus) {
    if (ruta) { if (fokus) ruta.querySelector('.nx-kakor-t').focus({ preventScroll: true }); return; }
    if (!syften().length) return;
    const r = document.createElement('section');
    r.className = 'nx-kakor';
    r.setAttribute('aria-label', t('region'));

    const topp = document.createElement('div');
    topp.className = 'nx-kakor-topp';
    const ikon = document.createElement('span');
    ikon.className = 'nx-kakor-ikon';
    ikon.innerHTML = IKON;
    const rubriker = document.createElement('div');
    const et = document.createElement('p');
    et.className = 'nx-kakor-et';
    et.textContent = t('et');
    const h = document.createElement('h2');
    h.className = 'nx-kakor-t';
    h.tabIndex = -1;
    h.textContent = t('rubrik');
    rubriker.append(et, h);
    topp.append(ikon, rubriker);
    r.appendChild(topp);

    const intro = document.createElement('p');
    intro.textContent = t('intro');
    r.appendChild(intro);

    const nu = lägesText(false);
    if (nu) {
      const p = document.createElement('p');
      p.className = 'nx-kakor-lage';
      p.textContent = nu;
      r.appendChild(p);
    }
    valen(r, stäng);

    const fot = document.createElement('p');
    fot.className = 'nx-kakor-fot';
    fot.textContent = t('fot') + ' ';
    const l = document.createElement('a');
    l.href = EN ? '/en/lagring' : '/lagring';
    l.textContent = t('läsMer');
    fot.appendChild(l);
    r.appendChild(fot);

    /* Tidigt i DOM:en, direkt efter hopplänken: en tangentbordsanvändare
       når rutan innan hela sidan, fast den ligger längst ner i bild.
       Den är inte modal och tar inte fokus av sig själv. */
    const hoppa = document.querySelector('.nx-hoppa');
    if (hoppa && hoppa.parentNode === document.body) hoppa.after(r);
    else document.body.prepend(r);
    ruta = r;
    document.body.classList.add('nx-kakor-visas');
    requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('nx-kakor-in')));
    if (fokus) h.focus({ preventScroll: true });
  }

  /* Panelen på lagring.html: samma val, i texten. Ritas en gång. Ett
     klick skriver bara om lägesraden: ritades panelen om försvann
     knappen man just tryckt på, fokus hamnade i sidans topp, och en
     skärmläsare hörde ingenting, eftersom en status-rad som skapas på
     nytt inte läses upp. */
  function panel(värd) {
    värd.textContent = '';
    if (!syften().length) {
      const p = document.createElement('p');
      p.textContent = t('inget');
      värd.appendChild(p);
      return;
    }
    const intro = document.createElement('p');
    intro.textContent = t('intro');
    värd.appendChild(intro);
    const läge = document.createElement('p');
    läge.className = 'nx-kakor-lage';
    läge.setAttribute('role', 'status');
    läge.textContent = lägesText(true);
    värd.appendChild(läge);
    valen(värd, () => { läge.textContent = lägesText(true); stäng(); });
  }

  function init() {
    const på = syften().length > 0;

    /* Länken i footern. Utan javascript går den till panelen på
       lagring.html; med går den inte någonstans, den öppnar rutan.
       Är inget påslaget finns inget att ställa in, och den göms. */
    document.querySelectorAll('[data-samtycke-oppna]').forEach(a => {
      if (!på) {
        const li = a.closest('li');
        (li || a).hidden = true;
        return;
      }
      a.addEventListener('click', e => {
        if (document.querySelector('[data-samtycke-panel]')) return;   // låt ankaret skrolla dit
        e.preventDefault();
        visa(true);
      });
    });

    const p = document.querySelector('[data-samtycke-panel]');
    if (p) panel(p);

    tillämpa();
    if (!på || giltigt(läs())) return;
    if (p || gpc()) return;          // panelen frågar redan, eller GPC har svarat
    visa(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { har, konvertering };
})();
