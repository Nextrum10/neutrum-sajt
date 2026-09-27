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

  const ORD = {
    rubrik:      ['Får vi se hur du hittade hit?', 'May we see how you found us?'],
    kalla:       ['Vi vill veta vilken annons eller länk som ledde dig hit, så att vi lägger pengarna där de gör nytta. Säger du ja minns webbläsaren varifrån du kom tills du stänger fliken, och det följer med om du skickar en anmälan.',
                  'We want to know which ad or link brought you here, so that we spend money where it helps. If you say yes, your browser remembers where you came from until you close the tab, and it is included if you send an enquiry.'],
    meta:        ['Meta (Facebook och Instagram) får veta att du kom från deras annons och om du skickade en anmälan. Meta kan koppla det till ditt konto hos dem.',
                  'Meta (Facebook and Instagram) learns that you came from their ad and whether you sent an enquiry. Meta may link this to your account with them.'],
    google:      ['Google får veta att du kom från deras annons och om du skickade en anmälan.',
                  'Google learns that you came from their ad and whether you sent an enquiry.'],
    nejGårBra:   ['Säger du nej fungerar allt precis likadant.', 'If you say no, everything works exactly the same.'],
    ja:          ['Ja, det går bra', 'Yes, that is fine'],
    nej:         ['Nej tack', 'No thanks'],
    läsMer:      ['Mer om cookies och lagring', 'More about cookies and storage'],
    region:      ['Samtycke', 'Consent'],
    valtJa:      ['Ditt val: ja, sedan {d}.', 'Your choice: yes, since {d}.'],
    valtNej:     ['Ditt val: nej, sedan {d}.', 'Your choice: no, since {d}.'],
    gpc:         ['Din webbläsare säger att du inte vill spåras (Global Privacy Control), så vi räknar det som ett nej. Du kan ändra det här.',
                  'Your browser says you do not want to be tracked (Global Privacy Control), so we treat it as a no. You can change that here.'],
    ejValt:      ['Du har inte valt än.', 'You have not chosen yet.'],
    inget:       ['Det finns inget att samtycka till just nu: sajten använder ingenting som kräver det.',
                  'There is nothing to consent to at the moment: the site uses nothing that requires it.'],
    sparat:      ['Sparat.', 'Saved.']
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
     irriterande men ärligt: ett svar vi inte kan minnas har vi inte. */
  let minne = null;
  function läs() {
    try {
      const rå = localStorage.getItem(NYCKEL);
      if (rå) return JSON.parse(rå);
    } catch (e) { /* faller till minnet */ }
    return minne;
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
  function behöverFråga() {
    return aktiva().length > 0 && !giltigt(läs()) && !gpc();
  }

  function spara(ja) {
    const förut = läs();
    const s = { v: 1, ja: ja, omfattar: aktiva(), tid: new Date().toISOString() };
    minne = s;
    try { localStorage.setItem(NYCKEL, JSON.stringify(s)); } catch (e) { /* minnet får räcka */ }
    if (ja) tillämpa();
    else rensa(förut && förut.ja === true);
    try { if (typeof NX !== 'undefined') NX.händelse('samtycke', { val: ja ? 'ja' : 'nej' }); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('nx:samtycke', { detail: { ja: ja } })); } catch (e) {}
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
    window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
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
        const mål = String(CFG.GOOGLE_ADS_LEAD || '').trim();
        if (/^AW-[A-Z0-9]+\/[\w-]+$/.test(mål)) window.gtag('event', 'conversion', { send_to: mål });
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
    st.push(t('nejGårBra'));
    return st;
  }

  function knappar(värd, efter) {
    const rad = document.createElement('div');
    rad.className = 'nx-kakor-knappar';
    [['ja', true], ['nej', false]].forEach(([k, ja]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost';
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

  function visa(fokus) {
    if (ruta || !aktiva().length) return;
    const r = document.createElement('section');
    r.className = 'nx-kakor';
    r.setAttribute('aria-label', t('region'));
    const h = document.createElement('h2');
    h.className = 'nx-kakor-t';
    h.tabIndex = -1;
    h.textContent = t('rubrik');
    r.appendChild(h);
    text().forEach(s => {
      const p = document.createElement('p');
      p.textContent = s;
      r.appendChild(p);
    });
    knappar(r, stäng);
    const l = document.createElement('a');
    l.className = 'nx-kakor-mer';
    l.href = EN ? '/en/lagring' : '/lagring';
    l.textContent = t('läsMer');
    r.appendChild(l);

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

  /* Panelen på lagring.html: samma fråga, med vad som gäller nu. */
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
    const läge = document.createElement('p');
    läge.className = 'nx-kakor-lage';
    läge.setAttribute('role', 'status');
    const s = läs();
    if (giltigt(s)) {
      const d = new Date(s.tid).toLocaleDateString(EN ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
      läge.textContent = t(s.ja ? 'valtJa' : 'valtNej', { d: d });
    } else {
      läge.textContent = gpc() ? t('gpc') : t('ejValt');
    }
    värd.appendChild(läge);
    knappar(värd, () => { panel(värd); stäng(); });
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

  return { har, behöverFråga, visa, konvertering, aktiva };
})();
