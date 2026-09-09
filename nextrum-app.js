/* ============================================================
   NEXTRUM — delad kod för alla tre sidor.
   Ligger separat så att en fix hamnar på alla sidor samtidigt
   istället för att behöva klistras in tre gånger.
   ============================================================ */

const CFG = window.NEXTRUM_CONFIG || {};

/* Supabase-klienten. null om nycklarna inte är ifyllda än, då visar
   sidorna en tydlig ruta istället för att bara vara trasiga. */
const supa = (String(CFG.SUPABASE_URL || '').startsWith('https://') && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
  : null;

const NX = (function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kr = n => Number(n).toLocaleString('sv-SE') + ' kr';


  /* ============================================================
     SPRÅK
     Generatorn som bygger /en/ översätter aldrig skript — svensk kod
     ska inte översättas, och ett tidigt försök åt sig in i
     identifieraren kopplaAnsökan. Följden var att allt som skrivs
     till användaren FRÅN javascript förblev svenskt på de engelska
     sidorna: kvittensen efter ett skickat formulär, felmeddelanden,
     spärren för samtycke.

     Texterna bor därför i par här, och språket läses ur <html lang>
     vid körning. Då är koden identisk på båda språken — vilket är
     precis vad generatorn behöver för att kunna kopiera den rakt av.

     OBS: bara det som VISAS. Strängar som skrivs till databasen
     ("Telefon: ", "Samtycke till lagring: ja") ska förbli svenska —
     de läses av oss, inte av besökaren.
     ============================================================ */
  const SPRÅK = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv') ? 1 : 0;
  const ORD = {
    fyllNamnEpost:   ['Fyll i namn och e-post.',
                      'Please fill in your name and email.'],
    fyllKontakt:     ['Fyll i namn, e-post och meddelande.',
                      'Please fill in your name, email and message.'],
    samtyckeAnsokan: ['Du behöver godkänna att vi sparar uppgifterna för att kunna behandla ansökan.',
                      'You need to agree to us storing your details so we can process your application.'],
    samtyckeIntresse:['Du behöver godkänna att vi sparar uppgifterna för att kunna höra av oss.',
                      'You need to agree to us storing your details so we can get back to you.'],
    ingenDatabas:    ['Databasen är inte kopplad än.',
                      'The database is not connected yet.'],
    ingenDatabasForm:['Databasen är inte kopplad än, så anmälan kan inte skickas. Fyll i nextrum-config.js.',
                      'The database is not connected yet, so the form cannot be sent. Fill in nextrum-config.js.'],
    kundeInteSkicka: ['Kunde inte skicka: ', 'Could not send: '],
    tackAnsokan:     ['Tack för din ansökan. Vi läser alla och hör av oss.',
                      'Thank you for your application. We read every one and will be in touch.'],
    tackIntresse:    ['Tack. Vi har tagit emot er intresseanmälan och återkommer på {e} så snart vi kan.',
                      'Thank you. We have received your enquiry and will get back to you at {e} as soon as we can.'],
    tackKontakt:     ['Mottaget. Vi återkommer på mejlen du angav.',
                      'Received. We will reply to the email address you gave.'],
    ingenFil:        ['Ingen fil vald', 'No file chosen'],
    filForStor:      ['Filen är större än 5 MB — välj en mindre',
                      'The file is larger than 5 MB — please choose a smaller one'],
    felLosen:        ['Fel e-post eller lösenord.', 'Wrong email or password.'],
    felBekrafta:     ['Du måste bekräfta din e-postadress först. Kolla inkorgen (och skräpposten).',
                      'You need to confirm your email address first. Check your inbox (and spam folder).'],
    felFinns:        ['Det finns redan ett konto med den e-postadressen. Logga in istället.',
                      'There is already an account with that email address. Log in instead.'],
    felKortLosen:    ['Lösenordet måste vara minst 6 tecken.',
                      'The password must be at least 6 characters.'],
    felForManga:     ['För många försök. Vänta en stund och prova igen.',
                      'Too many attempts. Wait a moment and try again.'],
    felNatverk:      ['Når inte databasen. Kontrollera din internetanslutning, och att URL:en i nextrum-config.js är rätt.',
                      'Cannot reach the database. Check your internet connection, and that the URL in nextrum-config.js is correct.'],
    felOkant:        ['Något gick fel.', 'Something went wrong.']
  };
  function t(nyckel, vars) {
    const par = ORD[nyckel];
    let ut = par ? par[SPRÅK] : nyckel;
    if (vars) for (const k in vars) ut = ut.replace('{' + k + '}', vars[k]);
    return ut;
  }

  const DAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
  const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

  const pad = n => String(n).padStart(2, '0');
  const isoFor = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  function datumText(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return d + ' ' + MANADER[m - 1] + (y !== new Date().getFullYear() ? ' ' + y : '');
  }

  /* ---------- litet meddelandefält ---------- */
  function säg(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    el.classList.toggle('is-err', ok === false);
  }
  function rensa(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show', 'is-err');
  }

  /* ---------- felmeddelanden på svenska ---------- */
  function felText(error) {
    const m = String(error && (error.message || error) || '');
    if (/Invalid login credentials/i.test(m)) return t('felLosen');
    if (/Email not confirmed/i.test(m)) return t('felBekrafta');
    if (/User already registered/i.test(m)) return t('felFinns');
    if (/Password should be at least/i.test(m)) return t('felKortLosen');
    if (/rate limit|too many/i.test(m)) return t('felForManga');
    if (/Failed to fetch|NetworkError/i.test(m)) return t('felNatverk');
    return m || t('felOkant');
  }

  /* ---------- header: sticky + burgare ---------- */
  function initHeader() {
    const hdr = $('#hdr');
    if (hdr) {
      const onScroll = () => hdr.classList.toggle('stuck', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    const burger = $('#burger'), mmenu = $('#mobile-menu');
    if (burger && mmenu) {
      const setMenu = open => {
        burger.setAttribute('aria-expanded', String(open));
        mmenu.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
      };
      burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
      $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    }
    /* Menyn skrivs likadant på alla publika sidor, med länkar som
       "index.html#om". På startsidan vore det en onödig omladdning,
       så där kortas de ner till rena ankare. Utan JS fungerar de
       ändå — då blir det bara en omladdning istället för en scroll. */
    /* Adresserna är rena sedan cleanUrls slogs på: "/priser", inte
       "/priser.html", och startsidan är "/". Jämför därför hela
       sökvägen och inte filnamnet — .pop() ger "" på "/" och
       "priser" på "/priser", vilket inte matchar något href. */
    const här = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (här === '/' || här === '/en/') {
      $$('a[href^="/#"], a[href^="/en/#"]').forEach(a =>
        a.setAttribute('href', a.getAttribute('href').replace(/^\/(en\/)?/, '')));
    }
    /* markera vilken sida besökaren står på */
    $$('.nav-links a, .mobile-menu a.m-link').forEach(a => {
      const h = (a.getAttribute('href') || '').split('#')[0];
      if (h && h === här) a.classList.add('active');
    });

    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
    $$('a[href^="mailto:"]').forEach(a => {
      a.href = 'mailto:' + (CFG.EPOST || 'info@nextrum.se');
      if (a.dataset.mailtext !== 'keep') a.textContent = CFG.EPOST || 'info@nextrum.se';
    });
  }

  /* ---------- reveal-animation ---------- */
  function initReveal() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ('IntersectionObserver' in window && !reduce) {
      const io = new IntersectionObserver(entries => {
        entries.forEach((e, i) => {
          if (!e.isIntersecting) return;
          setTimeout(() => e.target.classList.add('in'), Math.min(i * 70, 280));
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      $$('.rv').forEach(el => io.observe(el));
    } else {
      $$('.rv').forEach(el => el.classList.add('in'));
    }
  }

  /* ---------- varning om databasen inte är kopplad ---------- */
  function kollaKoppling() {
    if (supa) return true;
    $$('[data-needs-db]').forEach(el => {
      el.innerHTML = '<div class="empty">Databasen är inte kopplad än.<br><br>'
        + 'Öppna <b>nextrum-config.js</b>, klistra in din Supabase-URL och anon-nyckel, '
        + 'spara och ladda om sidan. Har du inte kört <b>schema.sql</b> i Supabase SQL Editor än, gör det först.</div>';
    });
    console.warn('Nextrum: nextrum-config.js är inte ifylld, eller så laddades inte supabase-js.');
    return false;
  }

  /* ---------- FAQ-dragspel ----------
     CSS animerar height, så det är height som ska sättas här.
     Finns på startsidan, priser.html och faq.html. */
  function initFaq() {
    const frågor = $$('.faq-q');
    if (!frågor.length) return;

    frågor.forEach(q => {
      const svar = q.nextElementSibling;
      q.addEventListener('click', () => {
        const öppen = q.getAttribute('aria-expanded') === 'true';
        frågor.forEach(o => {
          o.setAttribute('aria-expanded', 'false');
          const a = o.nextElementSibling;
          if (a) a.style.height = '0px';
        });
        if (!öppen && svar) {
          q.setAttribute('aria-expanded', 'true');
          svar.style.height = svar.scrollHeight + 'px';
        }
      });
    });

    /* håll höjden rätt om fönstret ändrar storlek med en öppen fråga */
    window.addEventListener('resize', () => {
      const öppen = $('.faq-q[aria-expanded="true"]');
      if (!öppen) return;
      const a = öppen.nextElementSibling;
      if (a) { a.style.height = 'auto'; a.style.height = a.scrollHeight + 'px'; }
    });
  }

  /* ---------- priset ----------
     Skrivs in från nextrum-config.js så att det bara finns på ett
     ställe, och räknas upp när siffran kommer in i vyn. */
  function initPris() {
    const pris = Number(CFG.PRIS_PER_TIMME) || 349;
    $$('[data-stat="pris"], [data-stat="pris-inline"]').forEach(el => el.textContent = kr(pris));

    /* Tillägget bor i samma konfiguration som timpriset. Räkne-
       exemplen på prissidan skrivs också härifrån, så att en ändrad
       siffra inte lämnar kvar en summa som inte går ihop. */
    const extra = Number(CFG.PRIS_EXTRA_BARN) || 0;
    $$('[data-stat="extra-barn"]').forEach(el => el.textContent = kr(extra));
    $$('[data-stat="tva-barn"]').forEach(el => el.textContent = kr(pris + extra));
    $$('[data-stat="tre-barn"]').forEach(el => el.textContent = kr(pris + extra * 2));

    const stor = $('[data-stat="pris"]');
    const lugnt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!stor || lugnt || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const start = performance.now(), tid = 900;
        const steg = nu => {
          const p = Math.min((nu - start) / tid, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          stor.textContent = kr(Math.round(pris * ease));
          if (p < 1) requestAnimationFrame(steg);
        };
        requestAnimationFrame(steg);
      });
    }, { threshold: 0.6 });
    io.observe(stor);
  }

  /* ---------- ansökan om att bli studiehjälpare ----------
     Samma formulär finns i modalen på startsidan och som vanligt
     formulär på bli-studiehjalpare.html. Logiken bor här så att en
     fix hamnar på båda ställena samtidigt. */
  function kopplaAnsökan(form, msg, opts) {
    if (!form) return;
    const o = opts || {};
    form.addEventListener('submit', async e => {
      e.preventDefault();
      rensa(msg);

      const f = new FormData(form);
      const namn = String(f.get('namn') || '').trim();
      const epost = String(f.get('epost') || '').trim();
      if (!namn || !epost) { säg(msg, t('fyllNamnEpost'), false); return; }

      /* Kryssrutan för samtycke finns bara där den efterfrågas.
         Utan opts.krävSamtycke beter sig funktionen precis som förut. */
      if (o.krävSamtycke) {
        const ruta = document.querySelector(o.krävSamtycke);
        if (ruta && !ruta.checked) {
          säg(msg, t('samtyckeAnsokan'), false);
          return;
        }
      }
      if (!supa) { säg(msg, t('ingenDatabas'), false); return; }

      const knapp = form.querySelector('button[type="submit"]');
      if (knapp) knapp.setAttribute('aria-busy', 'true');

      const ålderRaw = String(f.get('alder') || '').trim();

      /* Fält utan egen kolumn (telefon, erfarenhet, samtycke) läggs
         sist i "why" som märkta rader. Då slipper schemat ändras och
         ingenting som fylls i går förlorat. */
      const fritext = String(f.get('varfor') || '').trim();
      /* Ett valfritt CV laddas upp till lagringshinken "cv" och
         sökvägen läggs i "why". Finns ingen hink (eller är den stängd)
         ska ansökan ändå gå igenom — då noteras filnamnet så att vi vet
         att vi ska be om filen. Uppladdningen ligger här och inte hos
         anroparen, eftersom "supa" är privat i den här modulen. */
      let cvRad = '';
      const cvInp = o.cv ? document.querySelector(o.cv) : null;
      const cvFil = cvInp && cvInp.files && cvInp.files[0];
      if (cvFil) {
        try {
          const rent = cvFil.name.replace(/[^\w.\-]+/g, '_');
          const väg = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + rent;
          const upp = await supa.storage.from('cv').upload(väg, cvFil, { upsert: false });
          if (!upp.error) {
            /* Sökvägen, inte en publik länk. Hinken är privat med
               flit — ett CV bär namn, skola och ofta personnummer —
               så getPublicUrl hade gett en adress som svarar 400 och
               sett ut som en trasig fil i stället för en skyddad.
               Filen öppnas i Supabase → Storage → cv. */
            cvRad = 'CV: cv/' + väg;
          }
        } catch (e) { /* faller igenom till noteringen nedan */ }
        if (!cvRad) cvRad = 'CV: bifogad fil "' + cvFil.name + '" kunde inte laddas upp — be om den via mejl';
      }

      /* extra() får vara async. Sync-varianter fungerar precis som förut. */
      const extraRader = typeof o.extra === 'function' ? String((await o.extra()) || '').trim() : '';
      const tillägg = [cvRad, extraRader].filter(Boolean).join('\n');
      const why = [fritext, tillägg].filter(Boolean).join('\n\n');

      const { error } = await supa.from('applications').insert({
        name: namn,
        age: ålderRaw ? Number(ålderRaw) : null,
        email: epost,
        school: String(f.get('skola') || '').trim() || null,
        subjects: String(f.get('amnen') || '').trim() || null,
        availability: String(f.get('tider') || '').trim() || null,
        why: why || null
      });

      if (knapp) knapp.removeAttribute('aria-busy');
      if (error) { säg(msg, t('kundeInteSkicka') + felText(error), false); return; }
      form.reset();
      säg(msg, t('tackAnsokan'), true);
    });
  }


  /* ---------- foton tonar in ----------
     Ramen (.nx-fig) bär bildens medelfärg. När filen väl är dekodad
     tonar bilden upp ovanpå den. Ingen yta blinkar vitt, och inget
     hoppar, eftersom width/height står i markupen. */
  function bildIntoning(rot) {
    $$('.nx-fig .nx-img', rot).forEach(img => {
      if (img.dataset.intonad) return;
      img.dataset.intonad = '1';
      if (img.complete && img.naturalWidth) { img.classList.add('nx-laddad'); return; }
      img.addEventListener('load', () => img.classList.add('nx-laddad'), { once: true });
      /* trasig bild ska inte lämna en färgad ruta som ser avsiktlig ut */
      img.addEventListener('error', () => {
        img.classList.add('nx-laddad');
        console.warn('Nextrum: bilden kunde inte laddas —', img.currentSrc || img.src);
      }, { once: true });
    });
  }

  /* ---------- vyväljaren ----------
     "Logga in" öppnar ett val mellan föräldravyn och
     studiehjälparvyn. Inloggningen i sig ligger kvar i
     foralder.html och larare.html och är orörd.

     Utan JavaScript är länken en vanlig länk till foralder.html,
     och är man redan inloggad har märkInloggad() redan skrivit om
     den till "Min vy" — då ska vi inte lägga oss i. */
  function initVagval() {
    const ruta = $('#nx-vagval');
    if (!ruta) return;
    let senast = null;

    const öppna = () => {
      senast = document.activeElement;
      ruta.hidden = false;
      /* En framtvingad omflödning i stället för requestAnimationFrame:
         övergången startar likadant, men rutan öppnas även när rAF är
         strypt (dold flik, batterisparläge). Annars kunde man låsa
         sidan bakom en dialog som aldrig blev synlig. */
      void ruta.offsetWidth;
      ruta.classList.add('open');
      document.body.classList.add('nx-låst');
      document.body.style.overflow = 'hidden';
      const f = ruta.querySelector('a');
      if (f) f.focus();
    };
    const stäng = () => {
      ruta.classList.remove('open');
      document.body.classList.remove('nx-låst');
      document.body.style.overflow = '';
      setTimeout(() => { ruta.hidden = true; }, 340);
      if (senast) { senast.focus(); senast = null; }
    };

    document.addEventListener('click', e => {
      const öppnare = e.target.closest('[data-vagval]');
      if (öppnare && !öppnare.dataset.inloggad) { e.preventDefault(); öppna(); return; }
      if (e.target.closest('[data-vagval-stang]') || e.target === ruta) stäng();
    });
    document.addEventListener('keydown', e => {
      if (ruta.hidden) return;
      if (e.key === 'Escape') { stäng(); return; }
      /* fokus stannar i rutan så länge den är öppen */
      if (e.key === 'Tab') {
        const kan = $$('a, button', ruta).filter(el => !el.disabled);
        if (!kan.length) return;
        const först = kan[0], sist = kan[kan.length - 1];
        if (e.shiftKey && document.activeElement === först) { e.preventDefault(); sist.focus(); }
        else if (!e.shiftKey && document.activeElement === sist) { e.preventDefault(); först.focus(); }
      }
    });
  }

  /* ---------- session + profil ---------- */
  async function hämtaSession() {
    if (!supa) return null;
    const { data } = await supa.auth.getSession();
    return (data && data.session && data.session.user) || null;
  }

  async function hämtaProfil(userId) {
    if (!supa || !userId) return null;
    const { data, error } = await supa
      .from('profiles')
      .select('id, role, full_name, email, is_admin, match_status, matched_tutor_id, avatar_url, bio, phone')
      .eq('id', userId)
      .maybeSingle();
    if (error) { console.warn('profiles:', error.message); return null; }
    return data;
  }

  /* Är besökaren redan inloggad? Peka då "Logga in" mot rätt vy. */
  async function märkInloggad() {
    if (!supa) return;
    const user = await hämtaSession();
    if (!user) return;
    const profil = await hämtaProfil(user.id);
    const mål = vyFörRoll(profil && profil.role);
    $$('#login-link, .m-actions a[href="foralder.html"], .ftr a[data-vagval]').forEach(a => {
      a.href = mål;
      a.textContent = 'Min vy';
      /* markerar att vyväljaren inte ska fånga klicket — man vet
         redan vem man är, då ska man rakt in i sin vy */
      a.dataset.inloggad = '1';
    });
  }

  /* Vart hör den här användaren hemma? Används av inloggningen på
     huvudsidan för att skicka rätt person till rätt vy. */
  function vyFörRoll(role) {
    return role === 'tutor' ? '/larare' : '/foralder';
  }

  /* ---------- kalender ----------
     Delas av bokningsflödet. onPick(isoDatum) körs vid klick.
     upptagna = Set med "YYYY-MM-DD|HH:MM". */
  /* Det fanns reservtider här: vardagar 15–19 när en studiehjälpare
     inte lagt in något eget. De är borta med flit.

     En gissning om när någon annan kan jobba hör inte hemma i ett
     bokningssystem. Familjen kunde boka en tisdag kl. 18 hos någon
     som aldrig sagt att den kunde då, och studiehjälparen fick säga
     nej i efterhand. Nu gäller bara det som faktiskt lagts in — och
     har ingen lagt in något finns inga tider, vilket vyerna säger
     rakt ut i stället för att visa en tom kalender.

     Det tog också bort helgspärren på köpet: reservtiderna hoppade
     över lördag och söndag, men tutor_availability har alltid tagit
     veckodag 0–6. Lägger studiehjälparen in en lördag går den att
     boka. */

  const tim = t => Number(String(t).slice(0, 2));
  const tvåsiffrig = n => String(n).padStart(2, '0');

  /* Vilka tider går att BÖRJA ett pass en viss dag?
       · ligger dagen bakåt i tiden finns inga
       · är hela dagen spärrad finns inga
       · har studiehjälparen inte lagt in den veckodagen finns inga
       · annars: varje timme där HELA passet får plats i ett och
         samma fönster, utan spärrad timme på vägen

     Längden spelar roll, och det är hela poängen. Ett tretimmarspass
     kan inte börja 18:00 i ett fönster som slutar 19:00 — förr
     erbjöds den tiden ändå, och passet gick över kanten.

     Upptagna tider tas INTE bort här. De visas som gråa, för "redan
     bokad" och "jobbar inte då" är två olika besked. */
  function tiderFörDatum(iso, tillgang, blockerade, minuter) {
    const idag = isoFor(new Date());
    if (iso < idag) return [];

    if ((blockerade || []).some(b => b.block_date === iso && !b.block_time)) return [];

    const d = new Date(iso + 'T12:00:00');
    const veckodag = (d.getDay() + 6) % 7;          // 0 = måndag
    const timmar = Math.max(1, Math.ceil((Number(minuter) || 60) / 60));

    const fönster = (tillgang || []).filter(t => t.weekday === veckodag);
    if (!fönster.length) return [];

    const spärrad = h => (blockerade || []).some(b =>
      b.block_date === iso && b.block_time === tvåsiffrig(h) + ':00');

    const ut = [];
    fönster.forEach(f => {
      const start = tim(f.start_time), slut = tim(f.end_time);
      for (let h = start; h + timmar <= slut; h++) {
        let ledig = true;
        for (let i = 0; i < timmar; i++) if (spärrad(h + i)) { ledig = false; break; }
        if (ledig) ut.push(tvåsiffrig(h) + ':00');
      }
    });
    let tider = Array.from(new Set(ut)).sort();

    /* Idag räknas bara tider som ligger minst en timme fram — man
       bokar inte ett pass som börjar om tio minuter. */
    if (iso === idag) {
      const gräns = new Date().getHours() + 1;
      tider = tider.filter(t => tim(t) >= gräns);
    }
    return tider;
  }

  /* ============================================================
     FÖRESLÅ TIDER

     Att leta en ledig tid är en sökning, inte en formulering. Den
     som vet vilka fönster som finns, vilka timmar som är bokade och
     hur långt passet är kan räkna fram svaret exakt — och blir aldrig
     osäker på om 17:00 krockar med ett tvåtimmarspass som började
     16:00. Därför ingen språkmodell här.

     Ordningen är närmast först, men ett pass som ligger på samma
     veckodag och tid som familjen redan brukar ha lyfts före. Fasta
     tider är lättare att komma ihåg än bra tider.
     ============================================================ */
  function föreslåTider(o) {
    const minuter = Number(o.minuter) || 60;
    const timmar = Math.max(1, Math.ceil(minuter / 60));
    const upptagna = o.upptagna || new Set();
    const dagar = Number(o.dagar) || 21;
    const antal = Number(o.antal) || 5;

    /* Familjens vana: veckodag + klockslag som återkommer i tidigare
       pass. Ett enda tidigare pass räcker som mönster — det är ändå
       den tid de tackat ja till förut. */
    const vana = new Set();
    (o.tidigare || []).forEach(b => {
      if (!b.wanted_date || !b.wanted_time) return;
      const d = new Date(b.wanted_date + 'T12:00:00');
      vana.add(((d.getDay() + 6) % 7) + '|' + String(b.wanted_time).slice(0, 5));
    });

    const krockar = (iso, t) => {
      const h0 = tim(t);
      for (let i = 0; i < timmar; i++) {
        if (upptagna.has(iso + '|' + tvåsiffrig(h0 + i) + ':00')) return true;
      }
      return false;
    };

    const ut = [];
    const start = new Date();
    for (let i = 0; i < dagar && ut.length < antal * 4; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = isoFor(d);
      const veckodag = (d.getDay() + 6) % 7;
      tiderFörDatum(iso, o.tillgang, o.blockerade, minuter).forEach(t => {
        if (krockar(iso, t)) return;
        ut.push({ datum: iso, tid: t, minuter,
                  vanlig: vana.has(veckodag + '|' + t) });
      });
    }

    /* Vanliga tider först, därefter kronologiskt. Sorteringen är
       stabil i alla motorer vi bryr oss om, så lika poster behåller
       sin ordning i tiden. */
    ut.sort((a, b) => (b.vanlig - a.vanlig)
      || (a.datum + a.tid).localeCompare(b.datum + b.tid));

    /* Högst ett förslag per dag. Fem tider samma eftermiddag är fem
       varianter av samma erbjudande, inte fem alternativ. */
    const sedda = new Set();
    return ut.filter(f => !sedda.has(f.datum) && sedda.add(f.datum)).slice(0, antal);
  }

  function byggKalender(opts) {
    const host = opts.host;
    const state = {
      visad: new Date(), valtDatum: null, valdTid: null,
      upptagna: opts.upptagna || new Set(),
      tillgang: opts.tillgang || [],
      blockerade: opts.blockerade || [],
      minuter: opts.minuter || 60
    };

    host.innerHTML = `
      <div class="cal-head">
        <b class="cal-title"></b>
        <div class="cal-nav">
          <button type="button" data-cal="prev" aria-label="Föregående månad"><svg viewBox="0 0 12 12"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>
          <button type="button" data-cal="next" aria-label="Nästa månad"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>
        </div>
      </div>
      <div class="cal"></div>
      <div class="slots"></div>`;

    const title = $('.cal-title', host), grid = $('.cal', host), slots = $('.slots', host);

    /* Ett pass är upptaget om NÅGON av dess timmar krockar. Med bara
       starttiden kollad gick det att boka 17:00 mitt i ett pass som
       började 16:00 och höll på i två timmar. */
    function upptagen(t) {
      const timmar = Math.max(1, Math.ceil((Number(state.minuter) || 60) / 60));
      const h0 = tim(t);
      for (let i = 0; i < timmar; i++) {
        if (state.upptagna.has(state.valtDatum + '|' + tvåsiffrig(h0 + i) + ':00')) return true;
      }
      return false;
    }

    function ritaTider() {
      if (!state.valtDatum) { slots.innerHTML = ''; return; }
      const tider = tiderFörDatum(state.valtDatum, state.tillgang, state.blockerade, state.minuter);
      if (!tider.length) {
        slots.innerHTML = '<p class="small" style="grid-column:1/-1;color:var(--muted)">Inga lediga tider den dagen.</p>';
        return;
      }
      slots.innerHTML = tider.map(t => {
        const taken = upptagen(t);
        return `<button type="button" class="slot${taken ? ' taken' : ''}" ${taken ? 'disabled' : ''}
                  aria-pressed="${state.valdTid === t && !taken}" data-tid="${t}">${t}</button>`;
      }).join('');
    }

    function rita() {
      const d = state.visad;
      const år = d.getFullYear(), mån = d.getMonth();
      title.textContent = MANADER[mån] + ' ' + år;

      const first = new Date(år, mån, 1);
      // måndag först: getDay() ger 0 för söndag
      const offset = (first.getDay() + 6) % 7;
      const dagarIMån = new Date(år, mån + 1, 0).getDate();

      const idag = new Date(); idag.setHours(0, 0, 0, 0);

      let html = DAGAR.map(x => `<div class="dow">${x}</div>`).join('');
      for (let i = 0; i < offset; i++) html += '<div class="day off"></div>';
      for (let dag = 1; dag <= dagarIMån; dag++) {
        const datum = new Date(år, mån, dag);
        const iso = isoFor(datum);
        const förbi = datum < idag;
        /* En dag är valbar när den faktiskt har en tid att erbjuda —
           helgregeln ligger nu i tillgängligheten i stället. */
        const valbar = !förbi && tiderFörDatum(iso, state.tillgang, state.blockerade, state.minuter).length > 0;
        html += `<div class="day ${valbar ? 'avail' : 'off'}${state.valtDatum === iso ? ' sel' : ''}"
                   ${valbar ? `role="button" tabindex="0" data-dag="${iso}"` : ''}>${dag}</div>`;
      }
      grid.innerHTML = html;
      ritaTider();
    }

    host.addEventListener('click', e => {
      const nav = e.target.closest('[data-cal]');
      if (nav) {
        state.visad = new Date(state.visad.getFullYear(), state.visad.getMonth() + (nav.dataset.cal === 'next' ? 1 : -1), 1);
        rita(); return;
      }
      const dag = e.target.closest('[data-dag]');
      if (dag) {
        state.valtDatum = dag.dataset.dag;
        state.valdTid = null;
        rita();
        if (opts.onChange) opts.onChange(state);
        return;
      }
      const tid = e.target.closest('[data-tid]');
      if (tid && !tid.disabled) {
        state.valdTid = tid.dataset.tid;
        ritaTider();
        if (opts.onChange) opts.onChange(state);
      }
    });

    rita();
    return {
      state,
      rita,
      sättUpptagna(set) { state.upptagna = set; rita(); },
      sättTider(t) {
        state.tillgang = t.tillgang || [];
        state.blockerade = t.blockerade || [];
        /* Ett valt datum kan ha blivit omöjligt av de nya tiderna. */
        if (state.valtDatum && !tiderFörDatum(state.valtDatum, state.tillgang, state.blockerade, state.minuter).length) {
          state.valtDatum = null; state.valdTid = null;
        }
        rita();
      },
      /* Byter man längd kan den valda tiden ha blivit omöjlig — ett
         tretimmarspass får inte plats där ett entimmes gjorde det. */
      sättMinuter(m) {
        state.minuter = Number(m) || 60;
        const kvar = tiderFörDatum(state.valtDatum || '', state.tillgang, state.blockerade, state.minuter);
        if (state.valdTid && (kvar.indexOf(state.valdTid) === -1 || upptagen(state.valdTid))) {
          state.valdTid = null;
        }
        if (state.valtDatum && !kvar.length) { state.valtDatum = null; state.valdTid = null; }
        rita();
        return state;
      },
      nollställ() { state.valtDatum = null; state.valdTid = null; rita(); },
      /* Väljer datum och tid utifrån, t.ex. när man trycker på ett
         färdigt förslag. Månaden flyttas med, annars pekar valet på en
         dag som inte syns i rutan. onChange körs så att allt som
         lyssnar på kalendern uppdateras precis som vid ett klick. */
      välj(datum, tid) {
        if (!datum) return state;
        state.visad = new Date(datum + 'T12:00:00');
        state.valtDatum = datum;
        state.valdTid = tid || null;
        rita();
        if (typeof opts.onChange === 'function') opts.onChange(state);
        return state;
      }
    };
  }

  /* ---------- upptagna tider för en lärare ---------- */
  async function hämtaUpptagna(tutorId) {
    const set = new Set();
    if (!supa || !tutorId) return set;
    const { data, error } = await supa
      .from('tutor_busy_slots')
      .select('wanted_date, wanted_time')
      .eq('tutor_id', tutorId);
    if (error) { console.warn('tutor_busy_slots:', error.message); return set; }
    (data || []).forEach(r => set.add(r.wanted_date + '|' + r.wanted_time));
    return set;
  }

  /* Studiehjälparens veckotider och spärrar. Båda är läsbara för
     den som ska boka — vyn blockerade_tider lämnar inte ut skälet. */
  async function hämtaTillganglighet(tutorId) {
    const tomt = { tillgang: [], blockerade: [] };
    if (!supa || !tutorId) return tomt;
    const [a, b] = await Promise.all([
      supa.from('tutor_availability').select('weekday, start_time, end_time').eq('tutor_id', tutorId),
      supa.from('blockerade_tider').select('block_date, block_time').eq('tutor_id', tutorId)
    ]);
    if (a.error) console.warn('tutor_availability:', a.error.message);
    if (b.error) console.warn('blockerade_tider:', b.error.message);
    return { tillgang: a.data || [], blockerade: b.data || [] };
  }

  return {
    $, $$, esc, kr, isoFor, datumText, säg, rensa, felText, t,
    initHeader, initReveal, kollaKoppling,
    initFaq, initPris, kopplaAnsökan, märkInloggad,
    bildIntoning, initVagval,
    hämtaSession, hämtaProfil, vyFörRoll,
    byggKalender, hämtaUpptagna, hämtaTillganglighet, tiderFörDatum, föreslåTider,
    MANADER, DAGAR, CFG
  };
})();
