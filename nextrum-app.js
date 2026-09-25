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
    /* De två nedan läses av en förälder, inte av den som byggt sajten.
       Förut stod "Fyll i nextrum-config.js" och "kontrollera att
       URL:en i nextrum-config.js är rätt" ordagrant på den publika
       intresseanmälan. En familj som fick det meddelandet hade ingen
       väg vidare: ingen adress, ingen telefon, ingenting att göra.
       Anmälan var förlorad, och vi fick aldrig veta att den funnits.

       {oss} och inte {e}: {e} är redan taget av tackIntresse, där det
       betyder familjens EGEN adress. Två betydelser i samma symbol är
       ett fel som väntar på att någon läser fel mall. */
    ingenDatabasForm:['Vi kan inte ta emot formuläret just nu. Mejla oss på {oss} så hör vi av oss.',
                      'We cannot receive the form right now. Email us at {oss} and we will get back to you.'],
    kundeInteSkicka: ['Kunde inte skicka: ', 'Could not send: '],
    tackAnsokan:     ['Tack för din ansökan. Vi läser alla och hör av oss inom 24 timmar.',
                      'Thank you for your application. We read every one and will be in touch within 24 hours.'],
    tackIntresse:    ['Tack. Vi har tagit emot er intresseanmälan och hör av oss på {e} inom 24 timmar.',
                      'Thank you. We have received your enquiry and will get back to you at {e} within 24 hours.'],
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
    felNatverk:      ['Vi nådde inte servern. Kontrollera uppkopplingen och försök igen, eller mejla oss på {oss}.',
                      'We could not reach the server. Check your connection and try again, or email us at {oss}.'],
    felOkant:        ['Något gick fel. Prova igen, eller mejla oss på {oss}.',
                      'Something went wrong. Please try again, or email us at {oss}.'],
    felEpost:        ['Kontrollera e-postadressen — den ser inte ut som en adress.',
                      'Please check the email address — it does not look like an address.'],
    enManad:         ['1 månad', '1 month'],
    flerManader:     ['{n} månader', '{n} months']
  };
  /* {oss} fylls alltid, utan att anroparen behöver veta om det. Varje
     mall som slutar i en återvändsgränd ska kunna peka på en adress,
     och en mall vars enda utväg beror på att alla trettio anropsställen
     kommer ihåg att skicka med den är ingen utväg. */
  function t(nyckel, vars) {
    const par = ORD[nyckel];
    let ut = par ? par[SPRÅK] : nyckel;
    if (vars) for (const k in vars) ut = ut.replace('{' + k + '}', vars[k]);
    return ut.replace('{oss}', CFG.EPOST || 'info@nextrum.se');
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
  /* ============================================================
     Ser adressen ut som en adress?

     Formulären har novalidate — valideringen ska tala samma språk
     som resten av sidan, och webbläsarens egen bubbla gör inte det.
     Följden var att type="email" aldrig kontrollerades av någon:
     en intresseanmälan med adressen "junior" gick rakt in i leads.
     Raden gick inte att svara på, och aviseringen till oss dog med
     422 från Resend, som vägrar en ogiltig svarsadress.

     Medvetet grov. Den fångar det som uppenbart inte är en adress
     och släpper igenom resten — en fullständig kontroll enligt
     standarden avvisar adresser som faktiskt fungerar, och det är
     ett värre fel än att släppa in en felstavad. Om adressen går
     fram avgörs ändå först när mejlet skickas.
     ============================================================ */
  function epostOk(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }

  /* ============================================================
     ÄMNEN OCH ÅRSKURSER (Fas 13.2)

     Listorna fanns förut på två ställen i JavaScript — BOKA_AMNEN i
     studievyn och PR_AMNEN i studiehjälparvyn — och de hade redan
     glidit isär: den ena hade "Annat", den andra hade "Moderna
     språk" och "Programmering". Så länge de bara fyllde var sin
     rullgardin spelade det ingen roll.

     Materialbiblioteket gör det till en bugg. Admin väljer ämne ur
     en lista och studiehjälparen filtrerar ur en annan; ett
     övningsblad märkt med ett ämne som inte finns i den andra
     listan blir osynligt, och ett filter som tyst tappar rader ser
     ut som ett tomt bibliotek.

     KODEN ÄR INTE ETIKETTEN. arskurs lagras som 'ak7', aldrig som
     "Åk 7": etiketten ska gå att skriva om utan att raderna i
     databasen byter betydelse. Check-villkoret på
     biblioteksmaterial.arskurs listar exakt de här koderna. */
  const AMNEN = ['Matematik', 'Svenska', 'Engelska',
    'NO / Fysik / Kemi / Biologi', 'SO / Historia / Samhällskunskap',
    'Moderna språk', 'Programmering'];

  const ARSKURSER = [
    { kod: 'ak1', text: 'Åk 1' }, { kod: 'ak2', text: 'Åk 2' },
    { kod: 'ak3', text: 'Åk 3' }, { kod: 'ak4', text: 'Åk 4' },
    { kod: 'ak5', text: 'Åk 5' }, { kod: 'ak6', text: 'Åk 6' },
    { kod: 'ak7', text: 'Åk 7' }, { kod: 'ak8', text: 'Åk 8' },
    { kod: 'ak9', text: 'Åk 9' },
    { kod: 'gy1', text: 'Gymnasiet år 1' },
    { kod: 'gy2', text: 'Gymnasiet år 2' },
    { kod: 'gy3', text: 'Gymnasiet år 3' }
  ];

  /* Vad barnet behöver hjälp med, och hur passen helst ska hållas.
     Familjen väljer dem när barnet läggs till, studiehjälparen ser dem
     i elevkortet och admin i matchningen. Koderna speglar
     check-villkoren students_behov_check och
     students_format_onskemal_check — texten är det människor läser.

     Med flit INGA diagnoser eller hälsouppgifter. Sådant om barn är
     en särskild kategori enligt GDPR, och matchningen behöver veta
     vad som hjälper, inte vad barnet har. */
  const BEHOV = [
    { kod: 'laxor', text: 'Läxorna i vardagen' },
    { kod: 'prov', text: 'Inför prov' },
    { kod: 'ikapp', text: 'Komma ikapp' },
    { kod: 'utmaning', text: 'Mer utmaning' },
    { kod: 'struktur', text: 'Planering och studieteknik' },
    { kod: 'motivation', text: 'Motivation och självförtroende' }
  ];
  const FORMAT_ONSKEMAL = [
    { kod: 'pa_plats', text: 'På plats' },
    { kod: 'online', text: 'Online' },
    { kod: 'bada', text: 'Båda går bra' }
  ];

  function årskursText(kod) {
    const a = ARSKURSER.find(x => x.kod === kod);
    return a ? a.text : (kod || '—');
  }

  /* students.grade är FRITEXT — den skrivs av familjen i en
     intresseanmälan ("åk 7", "7:an", "Åk7", "gymnasiet ettan"). Den
     här gissar koden ur den texten, och gissar hellre inget än fel:
     ett bibliotek förvalt på fel årskurs är värre än ett utan
     förval, för då tror den som letar att det inte finns något. */
  function årskursKod(fritext) {
    const v = String(fritext || '').toLowerCase();
    if (!v) return '';
    if (/gymnasi|gy\b/.test(v)) {
      const n = (v.match(/[123]/) || [])[0];
      return n ? 'gy' + n : '';
    }
    const n = (v.match(/[1-9]/) || [])[0];
    return n ? 'ak' + n : '';
  }

  function rensa(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show', 'is-err');
  }

  /* ============================================================
     FELMEDDELANDEN

     Sista raden var förut `return m`: kände vi inte igen felet skrevs
     serverns egen text rakt ut. På en inloggad vy är det rätt — den
     som ser den texten är vi själva, och "new row violates row-level
     security policy for table bookings" är svaret på frågan.

     På en publik sida är det fel två gånger om. Föräldern förstår den
     inte, och den beskriver en tabell och en policy för vem som helst
     som råkar få fram felet. Därför: rå text bara i vyerna
     (body.vy — admin, larare, foralder), ett begripligt besked på
     resten. Texten försvinner inte, den flyttar till konsolen och
     till klientfel.

     Kontrollen görs vid varje anrop och inte en gång vid uppstart:
     filen laddas i <head> på flera sidor, och då finns ingen body än.
     ============================================================ */
  function iVy() {
    return !!(document.body && document.body.classList.contains('vy'));
  }

  function felText(error) {
    const m = String(error && (error.message || error) || '');
    if (/Invalid login credentials/i.test(m)) return t('felLosen');
    if (/Email not confirmed/i.test(m)) return t('felBekrafta');
    if (/User already registered/i.test(m)) return t('felFinns');
    if (/Password should be at least/i.test(m)) return t('felKortLosen');
    if (/rate limit|too many/i.test(m)) return t('felForManga');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('felNatverk');
    if (!m) return t('felOkant');
    if (iVy()) return m;
    console.warn('Fel från servern (dolt för besökaren):', m);
    return t('felOkant');
  }

  /* ---------- header: sticky + burgare ---------- */
  function initHeader() {
    const hdr = $('#hdr');
    if (hdr) {
      const onScroll = () => hdr.classList.toggle('stuck', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    /* ============================================================
       BURGAREN OCH ÖVERLÄGGET

       Burgaren finns i ALLA bredder, inte bara på telefon: cinema-
       lagret sätter body .mobile-menu{display:block} och vinner över
       @media-regeln i nextrum.css. Menyn är alltså ett överlägg på
       desktop också, och de två sakerna nedan saknades där lika mycket.

       1. Escape stänger. Maskoten gjorde det redan, menyn inte, och
          en besökare som lärt sig det ena förväntar sig det andra.

       2. Fokus stannar i menyn. Förut tabbade man efter sista länken
          rakt in i sidan BAKOM överlägget — länkar som ligger under en
          täckande yta, alltså fokus på något ingen ser. Den som styr
          med tangentbord tappade bort sig helt, och WCAG 2.4.3 säger
          att fokusordningen ska följa det som visas.

       Fokus flyttas till första länken när menyn öppnas och TILLBAKA
       till burgaren när den stängs. Utan återflytten hamnar fokus på
       <body> och nästa Tab börjar om från sidans topp.
       ============================================================ */
    const burger = $('#burger'), mmenu = $('#mobile-menu');
    if (burger && mmenu) {
      const öppen = () => burger.getAttribute('aria-expanded') === 'true';

      const setMenu = (open, återför) => {
        burger.setAttribute('aria-expanded', String(open));
        mmenu.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
          const först = mmenu.querySelector('a[href], button:not([disabled])');
          if (först) först.focus();
        } else if (återför !== false) {
          burger.focus();
        }
      };

      burger.addEventListener('click', () => setMenu(!öppen()));
      /* En länk som stänger menyn ska INTE ta tillbaka fokus till
         burgaren: webbläsaren är redan på väg till målet, och en
         fokusflytt mitt i hoppet skickar skärmläsaren till fel ställe. */
      $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false, false)));

      document.addEventListener('keydown', e => {
        if (!öppen()) return;
        if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
        if (e.key !== 'Tab') return;

        /* Fokusfällan. Listan läses om vid varje Tab i stället för att
           sparas: menyn får en extra länk när någon är inloggad
           (märkInloggad skriver om "Logga in"), och en fryst lista
           hade hoppat över den. */
        const kan = $$('a[href], button:not([disabled])', mmenu)
          .filter(el => el.offsetParent !== null);
        if (!kan.length) return;
        const först = kan[0], sist = kan[kan.length - 1];
        if (e.shiftKey && document.activeElement === först) { e.preventDefault(); sist.focus(); }
        else if (!e.shiftKey && document.activeElement === sist) { e.preventDefault(); först.focus(); }
        else if (!mmenu.contains(document.activeElement)) { e.preventDefault(); först.focus(); }
      });
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

    initSpamskydd();

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
  /* ---------- de sex punkterna på startsidan ----------
     Korten i .nx-drag fäller ut en längre text. Ett i taget: två
     öppna kort gör raden olika hög och snäppningen hoppig.

     Ingen höjdanimering här, till skillnad från FAQ:n. Korten
     ligger i en vågrät rad som scrollar, och en höjd som räknas i
     JS medan raden rör sig blir fel precis när man drar. */
  function initDrag() {
    const kort = $$('.nx-drag .dr-kort');
    if (!kort.length) return;

    kort.forEach(k => {
      k.addEventListener('click', () => {
        const öppet = k.getAttribute('aria-expanded') === 'true';
        kort.forEach(o => {
          o.setAttribute('aria-expanded', 'false');
          const m = o.parentElement.querySelector('.dr-mer');
          if (m) m.hidden = true;
        });
        if (!öppet) {
          k.setAttribute('aria-expanded', 'true');
          const m = k.parentElement.querySelector('.dr-mer');
          if (m) m.hidden = false;
          /* Kortet kan ligga halvt utanför raden när man trycker på
             det. Utan det här fälls texten ut på något man inte ser.

             Inte i startsidans rullande band (.nx-band.pa). Där går
             raden inte att scrolla — den flyttas med transform och
             klipps — och Chrome räknade då fram ett mål flera hundra
             pixlar bort och rullade SIDAN dit: kortet man tryckte på
             for iväg 400 px. Kortet man trycker på i bandet syns
             redan, och bandet stannar medan det är utfällt. */
          if (!k.closest('.nx-band.pa')) {
            k.closest('li').scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        }
      });
    });
  }

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
       siffra inte lämnar kvar en summa som inte går ihop.

       Tillägget är FAST när fler än ett barn sitter med — inte per
       barn. Två barn och tre barn kostar samma sak, och tre är taket.
       Så räknar servern: familjebelopp() i fakturering lägger på
       extraOre EN gång när antalBarn > 1, och tjanster.
       extra_personer_max är 3.

       Här stod tre barn = pris + extra * 2, alltså 517 kr mot
       systemets 448. En prissida som lovar ett annat belopp än
       fakturan är en diskussion i första samtalet — även när den,
       som här, lovade för mycket. */
    const extra = Number(CFG.PRIS_EXTRA_BARN) || 0;
    $$('[data-stat="extra-barn"]').forEach(el => el.textContent = kr(extra));
    $$('[data-stat="tva-barn"]').forEach(el => el.textContent = kr(pris + extra));
    $$('[data-stat="tre-barn"]').forEach(el => el.textContent = kr(pris + extra));

    /* Prissidans strukturerade data håller samma siffra som sidan.
       Siffran i HTML är en reserv för den som läser utan javascript;
       källan är CFG.PRIS_PER_TIMME, och den skrivs in här så att ett
       ändrat pris inte lämnar kvar ett gammalt belopp i det Google
       läser. Ett fel där är värre än på sidan: en träff som lovar
       ett pris ni inte tar är en diskussion i första samtalet. */
    const schema = $('#pris-schema');
    if (schema) {
      try {
        const d = JSON.parse(schema.textContent);
        const belopp = String(pris);
        d.offers.price = belopp;
        d.offers.priceSpecification.price = belopp;
        schema.textContent = JSON.stringify(d, null, 2);
      } catch (e) {
        console.warn('Nextrum: kunde inte uppdatera pris-schema —', e.message);
      }
    }

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

  /* ---------- erbjudandena (Fas 16.1) ----------
     Priserna på prissidan läses ur vyn erbjudanden_pris, den som
     stripe-checkout tar betalt efter. Timpriset i CFG räcker inte:
     rabatten och avrundningen räknas i databasen, och en andra räkning
     här hade kunnat lova en krona som kassan inte drar.

     Supabase-klienten laddas inte på de publika sidorna — den är
     tvåhundra kilobyte för en fråga — så det här är ett rått anrop mot
     PostgREST med anon-nyckeln. Svarar det inte står siffrorna i HTML
     kvar; de är skrivna efter samma vy. Ett erbjudande som inte finns
     i svaret är avstängt och döljs, och kommer inget alls tillbaka
     döljs hela sektionen: en plan utan pris går inte att köpa. */
  async function initErbjudanden() {
    const sek = $('.pr-erb');
    if (!sek || !String(CFG.SUPABASE_URL || '').startsWith('https://')) return;
    let rader;
    try {
      const svar = await fetch(CFG.SUPABASE_URL + '/rest/v1/erbjudanden_pris'
        + '?select=kod,timmar,rabatt_procent,giltig_manader,timpris_ore,ordinarie_ore,pris_ore,rabatterat_timpris_ore', {
        headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY }
      });
      if (!svar.ok) throw new Error('HTTP ' + svar.status);
      rader = await svar.json();
    } catch (e) {
      console.warn('Nextrum: erbjudandena kunde inte hämtas, siffrorna i sidan står kvar —', e.message);
      return;
    }
    if (!Array.isArray(rader)) return;
    if (!rader.length) { sek.hidden = true; return; }

    const perKod = {};
    rader.forEach(r => { perKod[r.kod] = r; });
    const skriv = (el, sel, text) => $$(sel, el).forEach(x => { x.textContent = text; });
    $$('[data-erb]', sek).forEach(el => {
      const r = perKod[el.getAttribute('data-erb')];
      if (!r) { el.hidden = true; return; }
      const m = Number(r.giltig_manader);
      skriv(el, '[data-erb-pris]', kr(r.pris_ore / 100));
      skriv(el, '[data-erb-timpris]', kr(r.timpris_ore / 100));
      skriv(el, '[data-erb-rabatterat]', kr(r.rabatterat_timpris_ore / 100));
      skriv(el, '[data-erb-spar]', kr((r.ordinarie_ore - r.pris_ore) / 100));
      skriv(el, '[data-erb-rabatt]', String(r.rabatt_procent));
      skriv(el, '[data-erb-giltig]', m === 1 ? t('enManad') : t('flerManader', { n: m }));
    });
  }

  /* ============================================================
     SPAMSKYDD

     leads, applications och contact_messages tar emot rader från vem
     som helst — det MÅSTE de, formulären är öppna. Varje ny
     intresseanmälan skickar dessutom ett mejl, så en robot fyller
     inte bara databasen utan också inkorgen.

     Fällan är ett fält som ligger utanför skärmen. En människa ser
     det aldrig och kan inte tabba dit; en robot som fyller i allt den
     hittar fyller i det. Är det ifyllt stoppas inskicket tyst: roboten
     får inget felmeddelande att lära sig av.

     Lyssnaren sitter på document med capture, inte på formuläret. Vid
     målet självt körs lyssnare i registreringsordning oavsett
     capture-flagga, och då hade sidans egen kod kunnat hinna först.
     Från document går capture-fasen alltid före.
     ============================================================ */
  const SPAM_FÄLT = 'webbplats';

  function spamskydd(form) {
    if (!form || form.dataset.spamRedo) return;
    form.dataset.spamRedo = '1';
    const bur = document.createElement('div');
    bur.setAttribute('aria-hidden', 'true');
    bur.style.cssText =
      'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden';
    const f = document.createElement('input');
    f.type = 'text';
    f.name = SPAM_FÄLT;
    f.tabIndex = -1;
    f.autocomplete = 'off';
    bur.appendChild(f);
    form.appendChild(bur);
  }

  function initSpamskydd() {
    $$('form[data-spamskydd]').forEach(spamskydd);
    document.addEventListener('submit', e => {
      const form = e.target;
      if (!form || !form.dataset || !form.dataset.spamRedo) return;
      const f = form.elements[SPAM_FÄLT];
      if (!f || !String(f.value || '').trim()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      form.reset();
    }, true);
  }

  /* ---------- varifrån besökaren kom ----------
     Hela poängen: när en intresseanmälan väl ligger i "leads" ska
     det gå att se vilken kanal som skickade hit familjen. Utan det
     går det inte att veta om annonserna, Facebook-gruppen eller
     mun-mot-mun är det som funkar — och då går pengarna åt fel håll.

     Först i sessionen vinner. Klickar någon på en Google-annons,
     läser prissidan och skickar in först på tredje sidan är det
     annonsen som gjorde jobbet, inte "nextrum.se" som hänvisare.

     sessionStorage kan kasta (privat läge, blockerade kakor) och
     ska aldrig fälla ett formulär — därför try/catch runt varje
     åtkomst och ett svar som fungerar även när lagringen är död. */
  const KÄLL_NYCKEL = 'nx-kalla';

  function läsLagrad() {
    try {
      const rå = sessionStorage.getItem(KÄLL_NYCKEL);
      return rå ? JSON.parse(rå) : null;
    } catch (e) { return null; }
  }

  function skrivLagrad(k) {
    try { sessionStorage.setItem(KÄLL_NYCKEL, JSON.stringify(k)); } catch (e) { /* strunt i det */ }
  }

  function källa() {
    const lagrad = läsLagrad();
    if (lagrad) return lagrad;

    let p;
    try { p = new URLSearchParams(location.search); } catch (e) { p = new URLSearchParams(); }
    const par = n => (p.get(n) || '').trim().slice(0, 120) || null;

    let hänvisare = null;
    try {
      if (document.referrer) {
        const h = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (h && h !== location.hostname.replace(/^www\./, '')) hänvisare = h;
      }
    } catch (e) { /* trasig referrer räknas som ingen */ }

    /* Kanalen i fallande ordning av hur mycket vi vet. En utm-tagg
       är något vi själva satt och väger tyngst; klick-id:na kommer
       från annonsnätverken; hänvisaren är en gissning; kvar blir
       "direkt", vilket i praktiken betyder mun-mot-mun, en QR-kod
       eller något vi inte taggat. */
    let kanal = par('utm_source');
    let medium = par('utm_medium');
    if (!kanal && par('gclid')) { kanal = 'google'; medium = medium || 'cpc'; }
    if (!kanal && par('fbclid')) { kanal = 'facebook'; medium = medium || 'social'; }
    if (!kanal && hänvisare) { kanal = hänvisare; medium = medium || 'hänvisning'; }
    if (!kanal) { kanal = 'direkt'; medium = medium || 'okänt'; }
    /* utm_source utan utm_medium är vanligt i handskrivna länkar —
       utan den här raden blev strängen "facebook / null". */
    if (!medium) medium = 'okänt';

    const k = {
      kanal: kanal,
      medium: medium,
      kampanj: par('utm_campaign'),
      innehåll: par('utm_content'),
      term: par('utm_term'),
      hänvisare: hänvisare,
      landning: (location.pathname + location.search).slice(0, 200),
      tid: new Date().toISOString()
    };
    skrivLagrad(k);
    return k;
  }

  /* Raderna som följer med in i "message" på anmälan. Samma trick som
     telefon och tider redan använder: inga nya kolumner, inget som
     kan gå sönder i schemat, och allt syns i adminvyn direkt. */
  function källrader() {
    const k = källa();
    const rader = ['Källa: ' + k.kanal + ' / ' + k.medium];
    if (k.kampanj)   rader.push('Kampanj: ' + k.kampanj);
    if (k.innehåll)  rader.push('Annonsvariant: ' + k.innehåll);
    if (k.term)      rader.push('Sökord: ' + k.term);
    if (k.hänvisare) rader.push('Hänvisad från: ' + k.hänvisare);
    rader.push('Landningssida: ' + k.landning);
    return rader;
  }

  /* Konverteringar till Vercel Analytics. window.va finns först när
     insights-skriptet laddat, och saknas helt lokalt (sökvägen ger
     404 på egen dator) — därför den tysta utgången. En mätning som
     kraschar ett formulär är värre än ingen mätning alls. */
  function händelse(namn, data) {
    try {
      if (typeof window.va !== 'function') return;
      window.va('event', { name: namn, data: data || {} });
    } catch (e) { /* mätning får aldrig stoppa något */ }
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
      if (!epostOk(epost)) { säg(msg, t('felEpost'), false); return; }

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
      const tillägg = [cvRad, extraRader, källrader().join('\n')].filter(Boolean).join('\n');
      const why = [fritext, tillägg].filter(Boolean).join('\n\n');

      /* Vilka uppdrag den sökande vill ta. Läses ur formuläret med
         getAll, så markupen styr och funktionen slipper veta vilka
         tjänster som finns. Med en enda aktiv jobbtjänst skriver
         väljaren ett dolt fält med den. */
      const tjanster = f.getAll ? f.getAll('tjanster').filter(Boolean) : [];

      /* Inget val i formuläret (fältet hann inte ritas): katalogens
         första jobbtjänst. Finns inte katalogen på sidan skickas
         fältet inte alls, och kolumnens default gäller. */
      const utanVal = typeof NXTjanster !== 'undefined' && NXTjanster.standardJobb
        ? [NXTjanster.standardJobb()] : null;
      const { error } = await supa.from('applications').insert({
        name: namn,
        ...(tjanster.length ? { tjanster } : (utanVal ? { tjanster: utanVal } : {})),
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
      händelse('ansokan_studiehjalpare', { kanal: källa().kanal, kampanj: källa().kampanj || 'ingen' });
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
      .select('id, role, full_name, email, is_admin, match_status, matched_tutor_id, avatar_url, bio, phone, last_seen_at')
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
       bokar inte ett pass som börjar om tio minuter.

       Räknat i MINUTER, inte i hela timmar. getHours() + 1 gav
       "nästa hela timme", vilket klockan 13.59 betydde fjorton noll
       noll — en minut fram, inte en timme. Att boka samma dag ska
       gå; att boka något som börjar innan man hunnit ta på sig
       skorna ska det inte. */
    if (iso === idag) {
      const nu = new Date();
      const minsta = nu.getHours() * 60 + nu.getMinutes() + 60;
      tider = tider.filter(t => tim(t) * 60 >= minsta);
    }
    return tider;
  }

  /* FÖRESLÅ TIDER stod här fram till Fas 14.0: sextio rader som räknade
     fram lediga tider ur tillgängligheten, lyfte familjens vanliga
     veckodag först och gav högst ett förslag per dag. Den var aldrig
     kopplad till någon knapp i någon vy, och exporterades utan att
     någon anropade den — en färdig funktion som ingen kan hitta är
     inte en funktion, den är vikt på varje sidladdning.

     Den ligger kvar i git (sök på föreslåTider). Ska bokningen få
     tidsförslag är den värd att hämta tillbaka; att låta den ligga
     kvar oanropad var det enda alternativet som inte var något av
     de två. */

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

  return {
    $, $$, esc, kr, isoFor, datumText, säg, rensa, felText, t, epostOk,
    initHeader, initReveal, kollaKoppling, spamskydd,
    initFaq, initDrag, initPris, initErbjudanden, kopplaAnsökan, märkInloggad,
    källa, händelse,
    bildIntoning, initVagval,
    /* hämtaTillganglighet stod här i Fas 14.0-grenen. Main tog bort
       funktionen medan grenen låg öppen, så namnet exporterades utan
       att peka på något: `return { …, hämtaTillganglighet }` med ett
       odefinierat namn kastar ReferenceError, och hela NX dör vid
       inladdning på varje sida. Mains lista gäller. */
    hämtaSession, hämtaProfil, vyFörRoll,
    hämtaUpptagna, tiderFörDatum,
    MANADER, DAGAR, CFG, AMNEN, ARSKURSER, BEHOV, FORMAT_ONSKEMAL, årskursText, årskursKod
  };
})();
