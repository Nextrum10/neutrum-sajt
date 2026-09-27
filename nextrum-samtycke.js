/* ============================================================
   NEXTRUM — samtycket (NXSamtycke)

   Rutan som frågar om lov, och det enda stället som får svara på
   frågan "får vi?". Allt som kräver samtycke (LEK 9 kap. 28 §) går
   genom har() och laddas först när svaret är ja.

   RUTAN VISAS BARA NÄR DET FINNS NÅGOT ATT FRÅGA OM. Vad det är
   står i NEXTRUM_CONFIG.SAMTYCKE. Är allt där av finns ingen ruta,
   ingen länk i footern och ingenting lagras; en ruta som ber om lov
   till ingenting är brus, och den som ser en sådan slutar läsa den
   som betyder något.

   Tre syften, ett beslut:
   - kallsparning: webbläsaren minns varifrån besökaren kom tills
     fliken stängs (sessionStorage 'nx-kalla', skrivs av NX.källa()).
     Utan det krediteras en anmälan sidan den skickades från, och en
     familj som kom från en annons och läste tre sidor först blev
     "direkt". Då går annonspengarna åt fel håll.
   - meta, google: annonspixlarna. Laddas aldrig förrän svaret är ja,
     och bara när ett id står i konfigurationen.
   Ett ja gäller de syften rutan beskrev när det gavs (`omfattar`).
   Slås ett nytt syfte på frågar rutan igen: ett ja till att minnas
   en länk är inte ett ja till Meta.

   JA OCH NEJ SER LIKADANA UT. Samma knapp, samma storlek, samma
   plats. En ruta där nej är en grå länk är inte ett fritt val, och
   IMY har sagt det i klartext.

   Svaret sparas i localStorage ('nx-samtycke') i ett år och frågas
   sedan igen. Att minnas svaret kräver inget samtycke, för utan det
   går det inte att låta bli att fråga. Webbläsare som skickar Global
   Privacy Control behandlas som ett nej utan att rutan visas.

   Laddas efter nextrum-app.js, bara på de öppna sidorna. De inloggade
   vyerna har ingenting som kräver samtycke, och deras CSP släpper
   inte in någon pixel. Allt som skrivs till besökaren står som par i
   ORD: /en/-generatorn översätter aldrig <script>.
   ============================================================ */
const NXSamtycke = (function () {
  'use strict';

  const CFG = (window.NEXTRUM_CONFIG && window.NEXTRUM_CONFIG.SAMTYCKE) || {};
  const NYCKEL = 'nx-samtycke';
  const KÄLL_NYCKEL = 'nx-kalla';   // samma som i nextrum-app.js
  const GILTIG_MS = 365 * 24 * 3600 * 1000;
  const EN = String(document.documentElement.lang || 'sv').slice(0, 2) === 'en';

  /* Rubriken är en fråga man kan svara ja eller nej på, och texten
     säger varför innan den säger vad: den som förstår skälet kan välja,
     den som bara får en teknisk beskrivning klickar bort rutan. Allt
     som krävs för ett giltigt samtycke står ändå där: syftet, vad som
     sparas, hur länge, att nej är lika bra och var man ändrar sig. */
  const ORD = {
    et:          ['Cookies och lagring', 'Cookies and storage'],
    rubrik:      ['Får vi se vilken väg du tog hit?', 'Mind if we see how you found us?'],
    kalla:       ['Då vet vi vilka annonser och länkar som faktiskt leder familjer till oss, och slutar lägga pengar där de inte gör nytta. Det stannar i din webbläsare tills du stänger fliken, och följer bara med om du skickar ett formulär till oss. Ingen cookie, ingen profil.',
                  'Then we know which ads and links actually bring families to us, and stop spending money where it does no good. It stays in your browser until you close the tab, and only comes along if you send us a form. No cookie, no profile.'],
    meta:        ['Meta (Facebook och Instagram) får veta att du kom från deras annons och om du skickade en anmälan. Meta kan koppla det till ditt konto hos dem.',
                  'Meta (Facebook and Instagram) learns that you came from their ad and whether you sent an enquiry. Meta may link this to your account with them.'],
    google:      ['Google får veta att du kom från deras annons och om du skickade en anmälan.',
                  'Google learns that you came from their ad and whether you sent an enquiry.'],
    fot:         ['Nej går lika bra, allt fungerar likadant. Du kan ändra dig när som helst längst ner på sidan.',
                  'No is just as fine, everything works the same. You can change your mind any time at the bottom of the page.'],
    nejOk:       ['Nej går lika bra, allt fungerar likadant.', 'No is just as fine, everything works the same.'],
    ja:          ['Ja, gärna', 'Yes, sure'],
    nej:         ['Nej tack', 'No thanks'],
    läsMer:      ['Läs mer', 'Read more'],
    region:      ['Samtycke', 'Consent'],
    valtJa:      ['Ditt val: ja, sedan {d}.', 'Your choice: yes, since {d}.'],
    valtNej:     ['Ditt val: nej, sedan {d}.', 'Your choice: no, since {d}.'],
    gpc:         ['Din webbläsare säger att du inte vill spåras (Global Privacy Control), så vi räknar det som ett nej. Du kan ändra det här.',
                  'Your browser says you do not want to be tracked (Global Privacy Control), so we treat it as a no. You can change that here.'],
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
  function googleId() {
    const id = String(CFG.GOOGLE_TAG_ID || '').trim();
    return /^(G|AW)-[A-Z0-9]{4,20}$/.test(id) ? id : '';
  }
  function aktiva() {
    const a = [];
    if (CFG.KALLSPARNING) a.push('kallsparning');
    if (metaId()) a.push('meta');
    if (googleId()) a.push('google');
    return a;
  }

  /* ---------- svaret ---------- */
  /* localStorage kastar i privat läge i vissa webbläsare. Svaret
     gäller då sidan ut, och rutan kommer tillbaka på nästa. Det är
     irriterande men ärligt: ett svar vi inte kan minnas har vi inte.

     Svaret som gavs PÅ SIDAN vinner över det som står lagrat. Går
     skrivningen inte igenom (fullt, privat läge i äldre Safari) står
     det gamla kvar i lagringen, och då hade ett gammalt nej slagit
     ett nytt ja. */
  let minne = null;
  function läs() {
    if (minne) return minne;
    try {
      const rå = localStorage.getItem(NYCKEL);
      if (rå) return JSON.parse(rå);
    } catch (e) { /* ingenting lagrat som går att läsa */ }
    return null;
  }
  function giltigt(s) {
    if (!s || typeof s.ja !== 'boolean' || !Array.isArray(s.omfattar)) return false;
    const tid = Date.parse(s.tid);
    if (!tid || Date.now() - tid > GILTIG_MS) return false;
    return aktiva().every(a => s.omfattar.indexOf(a) >= 0);
  }
  function gpc() {
    try { return navigator.globalPrivacyControl === true; } catch (e) { return false; }
  }
  /* Har besökaren sagt ja till just det här syftet, och är det på? */
  function har(syfte) {
    if (aktiva().indexOf(syfte) < 0) return false;
    const s = läs();
    return giltigt(s) && s.ja === true && s.omfattar.indexOf(syfte) >= 0;
  }
  function spara(ja) {
    const förut = läs();
    const s = { v: 1, ja: ja, omfattar: aktiva(), tid: new Date().toISOString() };
    minne = s;
    try { localStorage.setItem(NYCKEL, JSON.stringify(s)); } catch (e) { /* minnet får räcka */ }
    if (ja) tillämpa();
    else rensa(förut && förut.ja === true);
    try { if (typeof NX !== 'undefined') NX.händelse('samtycke', { val: ja ? 'ja' : 'nej' }); } catch (e) {}
  }

  /* ---------- ja: det som får köras ---------- */
  let pixlarLaddade = false;
  function tillämpa() {
    /* Källan skrivs direkt, så att sidan besökaren landade på räknas
       också när ja kom först här. Kom ja på en senare sida är
       landningen redan borta; NX.källa() sparar då inget alls hellre
       än att spara fel. */
    if (har('kallsparning') && typeof NX !== 'undefined' && NX.källa) {
      try { NX.källa(); } catch (e) {}
    }
    if (har('meta')) { laddaMeta(metaId()); pixlarLaddade = true; }
    if (har('google')) { laddaGoogle(googleId()); pixlarLaddade = true; }
  }

  function skript(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
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

  /* Google-taggen laddas först efter ja, så Consent Mode sätts till
     det besökaren faktiskt sagt: mätning av annonser, ingen
     personalisering. Signals av av samma skäl. */
  function laddaGoogle(id) {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'denied', analytics_storage: 'granted'
    });
    skript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
    window.gtag('js', new Date());
    const inst = { allow_google_signals: false, allow_ad_personalization_signals: false };
    window.gtag('config', id, inst);
    /* Konverteringen skickas till Ads-kontot i GOOGLE_ADS_LEAD. Är
       taggen ovan en G- (Analytics) måste Ads-kontot konfigureras
       för sig, annars kommer konverteringen aldrig fram. */
    const aw = adsMål().split('/')[0];
    if (aw && aw !== id) window.gtag('config', aw, inst);
  }
  function adsMål() {
    const mål = String(CFG.GOOGLE_ADS_LEAD || '').trim();
    return /^AW-[A-Z0-9]+\/[\w-]+$/.test(mål) ? mål : '';
  }

  /* En händelse från NX.händelse(). Bara anmälan är en konvertering:
     en jobbansökan är inte en kund, och en annons som optimeras mot
     sextonåringar som söker jobb köper fel publik. Inget om besökaren
     följer med, varken e-post, namn eller årskurs. */
  function konvertering(namn) {
    if (namn !== 'intresseanmalan') return;
    try {
      if (har('meta') && window.fbq) window.fbq('track', 'Lead');
      if (har('google') && window.gtag) {
        window.gtag('event', 'generate_lead');
        if (adsMål()) window.gtag('event', 'conversion', { send_to: adsMål() });
      }
    } catch (e) { /* mätning får aldrig stoppa något */ }
  }

  /* ---------- nej: det som ska bort ---------- */
  /* Pixlarnas cookies sätts på vår domän och försvinner inte av sig
     själva. Ett skript som redan körts går inte att ladda ur, så
     sidan laddas om när pixlar var igång. */
  const PIXELKAKOR = /^(_fbp|_fbc|_ga|_ga_[A-Z0-9]+|_gid|_gcl_au|_gcl_aw|_gcl_dc)$/;
  function rensa(varJa) {
    try { sessionStorage.removeItem(KÄLL_NYCKEL); } catch (e) {}
    const värd = location.hostname;
    const domäner = ['', värd, '.' + värd.replace(/^www\./, '')];
    String(document.cookie || '').split(';').forEach(p => {
      const namn = p.split('=')[0].trim();
      if (!PIXELKAKOR.test(namn)) return;
      domäner.forEach(d => {
        document.cookie = namn + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
    if (varJa && pixlarLaddade) location.reload();
  }

  /* ---------- rutan ---------- */
  function text() {
    const a = aktiva();
    const st = [];
    if (a.indexOf('kallsparning') >= 0) st.push(t('kalla'));
    if (a.indexOf('meta') >= 0) st.push(t('meta'));
    if (a.indexOf('google') >= 0) st.push(t('google'));
    return st;
  }

  /* Vad som gäller nu, i ord. Tomt när inget är valt i rutan: där
     är frågan själv beskedet. */
  function lägesText(förVal) {
    const s = läs();
    if (giltigt(s)) {
      const d = new Date(s.tid).toLocaleDateString(EN ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
      return t(s.ja ? 'valtJa' : 'valtNej', { d: d });
    }
    if (!förVal) return '';
    return gpc() ? t('gpc') : t('ejValt');
  }

  function knappar(värd, efter) {
    const rad = document.createElement('div');
    rad.className = 'nx-kakor-knappar';
    [['ja', true], ['nej', false]].forEach(([k, ja]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn nx-kakor-val';
      b.textContent = t(k);
      b.addEventListener('click', () => { spara(ja); efter(ja); });
      rad.appendChild(b);
    });
    värd.appendChild(rad);
  }

  let ruta = null;
  function stäng() {
    if (!ruta) return;
    ruta.classList.remove('nx-kakor-in');
    document.body.classList.remove('nx-kakor-visas');
    const r = ruta;
    ruta = null;
    setTimeout(() => r.remove(), 320);
  }

  /* Vägen hit: en punkt, en slingrande väg, en pil. Statisk markup,
     aldrig något ur en användare. */
  const IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<circle cx="5.5" cy="18.5" r="2"/><path d="M7.5 18.5h5a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6h7.5"/>'
    + '<path d="M16.5 4l2.5 2.5L16.5 9"/></svg>';

  function visa(fokus) {
    if (ruta) { if (fokus) ruta.querySelector('.nx-kakor-t').focus({ preventScroll: true }); return; }
    if (!aktiva().length) return;
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

    text().forEach(s => {
      const p = document.createElement('p');
      p.textContent = s;
      r.appendChild(p);
    });
    /* Öppnad från footern efter ett val: visa vad som gäller, så att
       den som vill ändra sig ser vad den ändrar från. */
    const nu = lägesText(false);
    if (nu) {
      const p = document.createElement('p');
      p.className = 'nx-kakor-lage';
      p.textContent = nu;
      r.appendChild(p);
    }
    knappar(r, stäng);
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

  /* Panelen på lagring.html: samma fråga, med vad som gäller nu.
     Ritas en gång. Ett klick skriver bara om lägesraden: ritades
     panelen om försvann knappen man just tryckt på, fokus hamnade i
     sidans topp, och en skärmläsare hörde ingenting, eftersom en
     status-rad som skapas på nytt inte läses upp. */
  function panel(värd) {
    värd.textContent = '';
    if (!aktiva().length) {
      const p = document.createElement('p');
      p.textContent = t('inget');
      värd.appendChild(p);
      return;
    }
    text().forEach(s => {
      const p = document.createElement('p');
      p.textContent = s;
      värd.appendChild(p);
    });
    const ok = document.createElement('p');
    ok.textContent = t('nejOk');
    värd.appendChild(ok);
    const läge = document.createElement('p');
    läge.className = 'nx-kakor-lage';
    läge.setAttribute('role', 'status');
    läge.textContent = lägesText(true);
    värd.appendChild(läge);
    knappar(värd, () => { läge.textContent = lägesText(true); stäng(); });
  }

  function init() {
    const på = aktiva().length > 0;

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
        const panelHär = document.querySelector('[data-samtycke-panel]');
        if (panelHär) return;        // låt ankaret skrolla dit
        e.preventDefault();
        visa(true);
      });
    });

    const p = document.querySelector('[data-samtycke-panel]');
    if (p) panel(p);

    if (!på) return;
    if (giltigt(läs())) { tillämpa(); return; }
    if (p || gpc()) return;          // panelen frågar redan, eller GPC har svarat
    visa(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { har, konvertering };
})();
