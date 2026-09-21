/* ============================================================
   NEXTRUM — studiehjälparvyn (larare.html)

   Koden låg inbäddad i larare.html fram till Fas 3. Den är flyttad
   hit oförändrad: samma ordning, samma IIFE, laddad på samma plats
   i sidan, efter de delade modulerna. En fil går att cacha, att
   syntaxkontrollera i CI och att läsa utan att scrolla förbi
   markupen — och sidan kan få en skarp Content-Security-Policy,
   eftersom den inte längre har något inbäddat skript.
   ============================================================ */
(function () {
  'use strict';
  const { $, $$, esc, kr, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, kolla, tomt, laddar } = NXStudie;
  const M = NXMedia;

  NX.initHeader();

  const S = {
    user: null, profil: null, tutorProfil: null,
    familjer: [], aktivFamilj: null,
    elever: [], aktivElev: null,
    bokningar: [], trad: null, kal: null, olästa: {},
    minAvatar: null, matTyp: 'fil', tillgang: [], blockerade: [],
    laxor: [], laxFilter: 'attgora', laxräkning: {}, minaRapporter: [], avatarer: {}, sido: null, progress: [], progressAntal: 0, schema: null,
    senaste: {},
    /* Schemat ritar lediga och ej tillgängliga timmar först när
       veckotiderna faktiskt är hämtade. En tom lista innan dess hade
       ritat varje timme som "Ej tillgänglig" i en halv sekund. */
    tillgangHämtad: false, upptagna: new Set(),
    /* Om elevlistan faktiskt kom. Ett pass vars elev inte finns bland
       dina kan inte rapporteras (rapportHinder), men en tom lista för
       att frågan föll är inte samma sak. Då hade varje pass stått som
       "inte kopplad till dig längre" för ett nätverksfel. */
    eleverHämtade: false
  };

  /* Hål 3, samma ord som databasen använder (program 2, Fas 1.4). */
  const UTAN_ELEV = 'Passet saknar elev. Kontakta Nextrum.';
  /* Passet är ditt men eleven är matchad med någon annan, till
     exempel efter ett byte (Fas 1.6). Databasen nekar rapporten. */
  const INTE_DIN_ELEV = 'Eleven är inte kopplad till dig längre. Kontakta Nextrum.';

  const elev = () => S.elever.find(e => e.id === S.aktivElev) || null;

  const VYER = ['view-loading', 'view-auth', 'view-pending', 'view-wrongrole', 'view-app', 'view-fel'];
  function visa(id) { NXStudie.visaVy(VYER, id); }

  function ritaHeader() { NXStudie.vyHuvud(S, 'Studiehjälpare', ritaNotiser); }

  document.addEventListener('click', async e => {
    if (e.target.closest('[data-logout]')) {
      if (supa) await supa.auth.signOut();
      location.reload();
    }
  });

  /* ============ inloggning ============ */
  let läge = 'in';
  function ritaAuth() {
    NXStudie.inloggningsruta(läge, {
      titel: 'Studiehjälparvyn',
      titelUpp: 'Skapa studiehjälparkonto',
      under: 'För dig som jobbar hos oss: dina elever, ditt schema, kontakten med familjerna och dina rapporter.',
      underUpp: 'Skapa kontot här. Vyn öppnas när vi gått igenom din ansökan och godkänt dig.'
    });
  }
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => { läge = b.dataset.auth; ritaAuth(); }));

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg'), knapp = $('#auth-submit');
    rensa(msg);
    if (!supa) { säg(msg, 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false); return; }

    const epost = $('#a-email').value.trim();
    const lösen = $('#a-pass').value;
    const namn = $('#a-name').value.trim();

    const fel = kolla([
      { fel: !epost, text: 'Fyll i din e-postadress.', falt: $('#a-email') },
      { fel: !lösen, text: 'Fyll i ditt lösenord.', falt: $('#a-pass') },
      { fel: läge === 'up' && !namn, text: 'Fyll i ditt namn.', falt: $('#a-name') },
      { fel: läge === 'up' && lösen.length < 6, text: 'Lösenordet måste vara minst 6 tecken.', falt: $('#a-pass') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan(knapp, läge === 'up' ? 'Skapar…' : 'Loggar in…', async () => {
      const res = läge === 'up'
        ? await supa.auth.signUp({ email: epost, password: lösen, options: {
            data: { full_name: namn, role: 'tutor' },
            /* Utan den här landar bekräftelselänken på Site URL i
               Supabase — alltså startsidan, eller värre: localhost.
               Nu kommer man tillbaka hit, till vyn man skapade
               kontot i, oavsett var sajten körs. */
            emailRedirectTo: location.origin + location.pathname
          } })
        : await supa.auth.signInWithPassword({ email: epost, password: lösen });

      if (res.error) { säg(msg, felText(res.error), false); return; }
      if (läge === 'up' && res.data && res.data.session === null) {
        säg(msg, 'Kontot är skapat. Vi har skickat en bekräftelse till ' + epost + '. Klicka på länken i mejlet och logga sedan in här.', true);
        return;
      }
      location.reload();
    });
  });

  /* ============================================================
     FAMILJER OCH ELEVER

     Två listor som INTE täcker varandra, och koden får inte anta det.

     Familjerna kommer ur profiles (matched_tutor_id = du). Det är
     familjens härledda kopia av matchningen, och det är den chatten
     och profilpolicyn går på: en familj här är en familj du kan
     skriva till.

     Eleverna kommer ur students, och sedan program 2 Fas 1.6 visar
     databasen bara de elever DU är matchad med. Syskon syns inte
     längre. Följden åt båda hållen:
       · en familj kan ha barn som inte finns i S.elever (syskonen)
       · en elev kan höra till en familj som inte finns i S.familjer
         (ett syskon vars familj är kopplad till en annan
         studiehjälpare). Den eleven visas ändå, men byter inte
         familj i chatten, eftersom den tråden inte går att skriva i.
     ============================================================ */
  async function laddaFamiljer() {
    const { data, error } = await supa
      .from('profiles').select('id, full_name, email').eq('matched_tutor_id', S.user.id);
    if (error) { console.warn(error.message); return; }
    S.familjer = data || [];
    if (!S.aktivFamilj || !S.familjer.some(f => f.id === S.aktivFamilj)) {
      S.aktivFamilj = S.familjer.length ? S.familjer[0].id : null;
    }
  }

  /* Filtret står här fast policyn redan gör samma sak. Ett konto som
     både är studiehjälpare och admin ser ALLA elever genom
     adminpolicyn, och då hade vyn räknat hela registret som sina. */
  async function laddaElever() {
    const { data, error } = await supa
      .from('students')
      .select('id, name, grade, school, goals, subjects, parent_id')
      .eq('matched_tutor_id', S.user.id)
      .neq('match_status', 'pending')
      .order('created_at');
    if (error) { console.warn(error.message); return; }
    S.elever = data || [];
    S.eleverHämtade = true;
    $('#kpi-elever').textContent = S.elever.length;
    ritaStatistik();
  }

  const familjSyns = id => S.familjer.some(f => f.id === id);

  /* Elevlistan visar den familj man jobbar med just nu, plus de
     elever vars familj inte finns bland dina (se ovan). De går inte
     att nå genom ett familjeval, så de får stå med i varje. */
  function minaElever() {
    return S.elever.filter(e => !S.aktivFamilj || e.parent_id === S.aktivFamilj || !familjSyns(e.parent_id));
  }

  function fyllElevväljare() {
    const mina = minaElever();
    const val = $('#elev-val');

    if (!mina.length) {
      val.innerHTML = '<option value="">Ingen elev kopplad till dig än</option>';
      val.disabled = true;
      S.aktivElev = null;
      $('#elev-antal').textContent = '';
    } else {
      val.disabled = false;
      val.innerHTML = mina.map(e =>
        '<option value="' + e.id + '">' + esc(e.name) + (e.grade ? ' · ' + esc(e.grade) : '') + '</option>').join('');
      $('#elev-antal').textContent = mina.length === 1 ? '' : mina.length + ' st';
      if (!S.aktivElev || !mina.some(e => e.id === S.aktivElev)) S.aktivElev = mina[0].id;
      val.value = S.aktivElev;
    }
    ritaElevkort();
  }

  /* ------------------------------------------------------------
     ELEVKORTEN

     Rullgardinen dolde allt utom namnet. Man såg inte vem som hade
     pass imorgon, vem som saknade läxa, eller ens hur många elever
     man hade — och det är precis de tre sakerna man väljer utifrån.

     Korten skriver till den gömda rullgardinen i stället för att
     ersätta den. Ett fyrtiotal rader läser #elev-val, och att byta
     ut varje sådan hade varit en omskrivning av halva filen för
     något ingen ser.

     Med en enda elev ritas ingenting. Ett val mellan ett
     alternativ är ingen fråga.
     ------------------------------------------------------------ */
  function nästaPassFör(elevId) {
    return (S.bokningar || [])
      .filter(b => b.student_id === elevId && ärKommande(b))
      .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
        .localeCompare(b.wanted_date + (b.wanted_time || '')))[0] || null;
  }

  function ritaElevkort() {
    const host = $('#elev-kort');
    if (!host) return;
    const mina = minaElever();

    if (mina.length < 2) { host.innerHTML = ''; return; }

    const idag = isoFor(new Date());
    host.innerHTML = '<div class="ev-rad">' + mina.map(e => {
      const b = nästaPassFör(e.id);
      const öppnaLäxor = S.laxräkning[e.id] || 0;
      return '<button type="button" class="ev-kort" data-elevkort="' + esc(e.id) + '"'
        + ' aria-pressed="' + (e.id === S.aktivElev ? 'true' : 'false') + '">'
        + NXMedia.avatar(e.name, null, { liten: true })
        + '<span class="ev-kort-text"><b>' + esc(e.name) + '</b>'
        + '<span>' + esc([e.grade, (e.subjects || [])[0]].filter(Boolean).join(' · ')
            || 'Inga uppgifter') + '</span>'
        + '<span class="ev-nasta' + (b && b.wanted_date === idag ? ' ar-idag' : '') + '">'
        + esc(b
            ? (b.wanted_date === idag ? 'IDAG ' + String(b.wanted_time || '').slice(0, 5)
               : datumText(b.wanted_date) + (b.wanted_time ? ' ' + String(b.wanted_time).slice(0, 5) : ''))
            : 'inget pass inbokat')
        + '</span></span>'
        + (öppnaLäxor ? '<span class="vy-sido-mark">' + öppnaLäxor + '</span>' : '')
        + '</button>';
    }).join('') + '</div>';
  }

  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-elevkort]');
    if (!k) return;
    if (k.dataset.elevkort === S.aktivElev) return;
    S.aktivElev = k.dataset.elevkort;
    $('#elev-val').value = S.aktivElev;
    await byggElev();
  });

  /* ------------------------------------------------------------
     ELEVPROFILEN

     En rubrik med namn, årskurs, ämnen och nästa pass, och sedan
     vägarna vidare. Förr var det en rad taggar utan namn ovanför —
     man såg vad eleven läste men inte vem det var, eftersom namnet
     stod i rullgardinen som numera är dold.

     Länkarna går till sektionerna som redan finns. En egen flikad
     elevvy hade betytt en andra uppsättning listor över samma
     läxor och samma pass, och två listor över samma sak hinner
     alltid bli oense.
     ------------------------------------------------------------ */
  const ELEV_VAGAR = [
    ['#lektioner', 'Pass & rapport'],
    ['#laxor', 'Uppgifter'],
    ['#lektioner/plan', 'Utveckling'],
    ['#meddelanden', 'Meddelanden']
  ];

  function ritaElevProfil() {
    const host = $('#elev-profil');
    const e = elev();
    if (!e) {
      /* Familjen lägger inte in barnen längre (sedan v14 gör Nextrum
         det och matchar per elev), så att be familjen om det var fel
         råd. Tom är listan för att ingen elev är matchad med dig. */
      host.innerHTML = '<div class="empty" style="margin-top:14px"><b>Ingen elev än</b>'
        + '<br><span>' + esc(S.elever.length
            ? 'Ingen av familjens elever är kopplad till dig. Välj en annan familj, eller hör av dig till Nextrum om något ser fel ut.'
            : 'Nextrum kopplar ihop dig med en elev. Då syns eleven här.') + '</span></div>';
      return;
    }
    const familj = S.familjer.find(f => f.id === e.parent_id);
    const b = nästaPassFör(e.id);
    const öppna = S.laxräkning[e.id] || 0;

    const bitar = [
      e.grade ? '<span class="tag">' + esc(e.grade) + '</span>' : '',
      e.school ? '<span class="tag">' + esc(e.school) + '</span>' : '',
      ...(e.subjects || []).map(x => '<span class="tag">' + esc(x) + '</span>')
    ].filter(Boolean).join('');

    host.innerHTML = '<div class="ep">'
      + '<div class="ep-topp">'
      + M.avatar(e.name, null, { stor: true })
      + '<div class="ep-namn"><b>' + esc(e.name) + '</b>'
      + '<span>' + esc([e.grade, familj ? (familj.full_name || familj.email) : null]
          .filter(Boolean).join(' · ')) + '</span></div>'
      + '<div class="ep-nasta">'
      + (b
          ? '<b>' + esc(datumText(b.wanted_date)
              + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : '')) + '</b>'
            + '<span>' + esc(b.subject || 'Nästa pass') + '</span>'
          : '<b>Inget pass inbokat</b><span>Familjen bokar på dina tider</span>')
      + '</div></div>'
      + (bitar ? '<div class="tutor-meta ep-taggar">' + bitar + '</div>' : '')
      + (e.goals ? '<p class="small ep-mal"><b>Mål:</b> ' + esc(e.goals) + '</p>' : '')
      + '<div class="ep-vagar">'
      + ELEV_VAGAR.map(v => '<a href="' + v[0] + '">' + esc(v[1])
          + (v[0] === '#laxor' && öppna ? '<span>' + öppna + '</span>' : '') + '</a>').join('')
      + '</div>'
      + '</div>';
  }

  function fyllElevFormulär() {
    const e = elev();
    $('#e-arskurs').value = (e && e.grade) || '';
    $('#e-skola').value = (e && e.school) || '';
    $('#e-amnen').value = ((e && e.subjects) || []).join(', ');
    $('#e-mal').value = (e && e.goals) || '';
    ['#e-arskurs', '#e-skola', '#e-amnen', '#e-mal'].forEach(id => { $(id).disabled = !e; });
  }

  $('#elev-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = $('#e-msg');
    rensa(msg);
    if (!S.aktivElev) { säg(msg, 'Välj en elev först.', false); return; }

    await medan(ev.submitter, 'Sparar…', async () => {
      const { error } = await supa.from('students').update({
        grade: $('#e-arskurs').value.trim() || null,
        school: $('#e-skola').value.trim() || null,
        subjects: $('#e-amnen').value.split(',').map(s => s.trim()).filter(Boolean),
        goals: $('#e-mal').value.trim() || null
      }).eq('id', S.aktivElev);

      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      säg(msg, '✓ Sparat. Familjen ser uppgifterna i sin vy.', true);
      await laddaElever();
      ritaElevProfil();
    });
  });

  /* ============ byte av familj eller elev ============ */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-familj]');
    if (!knapp) return;
    S.aktivFamilj = knapp.dataset.familj;
    S.aktivElev = null;
    S.olästa = await NXKontakt.olästa(S.user.id);
    await laddaSenaste();
    fyllElevväljare();
    await byggFamilj();
    await byggElev();
  });

  $('#elev-val').addEventListener('change', async e => {
    S.aktivElev = e.target.value || null;
    await byggElev();
  });

  /* ============================================================
     CHATTLISTAN

     Ett meddelande utan avsändare är inget meddelande. Listan visar
     vem som skrev, vad som stod och när — samma tre saker som varje
     meddelandeapp visar, och exakt de tre som chipsen dolde.

     Den senaste raden per familj hämtas en gång och räknas om
     lokalt. En fråga per familj hade blivit en fråga per familj.
     ============================================================ */
  async function laddaSenaste() {
    const { data, error } = await supa
      .from('messages')
      .select('parent_id, body, sender_id, created_at')
      .eq('tutor_id', S.user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return;
    const karta = {};
    (data || []).forEach(m => { if (!karta[m.parent_id]) karta[m.parent_id] = m; });
    S.senaste = karta;
  }

  /* Vem tråden gäller, sett från studiehjälparen. Det är ELEVEN man
     jobbar med och tänker på, för familjens namn säger inget den som
     har tre elever, och två av dem kan ha föräldrar med samma
     efternamn. Eleven står därför först, föräldern under.

     "Barnen" är bara DINA elever i familjen. S.elever har inte
     syskonen sedan Fas 1.6, och det är rätt: rubriken ska inte
     heller ha dem. Har du ingen elev i familjen (matchningen ändrad
     eller pausad på ett sätt profilen inte hunnit följa) står
     föräldern kvar som rubrik. */
  function trådNamn(f) {
    const förälder = f.full_name || f.email || 'Familj';
    const barn = S.elever.filter(e => e.parent_id === f.id).map(e => e.name).filter(Boolean);
    return barn.length
      ? { rubrik: barn.join(' & '), under: 'Förälder: ' + förälder, förnamn: String(barn[0]).split(' ')[0] }
      : { rubrik: förälder, under: f.email && f.email !== förälder ? f.email : 'Ingen elev kopplad till dig', förnamn: '' };
  }

  function ritaChattlista() {
    const host = $('#ch-lista');
    if (!host) return;

    if (!S.familjer.length) {
      host.innerHTML = '<p class="ch-tom">Ingen familj matchad än.</p>';
      return;
    }

    /* Den som skrev sist ligger överst. Det är den ordning man
       faktiskt letar i. */
    const ordnade = S.familjer.slice().sort((a, b) => {
      const ma = S.senaste[a.id], mb = S.senaste[b.id];
      if (!ma && !mb) return String(a.full_name || '').localeCompare(String(b.full_name || ''));
      if (!ma) return 1;
      if (!mb) return -1;
      return String(mb.created_at).localeCompare(String(ma.created_at));
    });

    host.innerHTML = ordnade.map(f => {
      const m = S.senaste[f.id];
      const oläst = S.olästa[f.id + '|' + S.user.id] || 0;
      const t = trådNamn(f);
      const namn = f.full_name || f.email || 'Familj';
      const rad = m
        ? (m.sender_id === S.user.id ? 'Du: ' : '') + String(m.body || '').replace(/\s+/g, ' ')
        : 'Ingen konversation än';

      return '<button type="button" class="ch-rad" data-familj="' + esc(f.id) + '"'
        + ' aria-pressed="' + (f.id === S.aktivFamilj ? 'true' : 'false') + '">'
        + M.avatar(namn, S.avatarer[f.id] || null, { liten: true })
        + '<span class="ch-rad-text">'
        + '<span class="ch-rad-topp"><b>' + esc(t.rubrik) + '</b>'
        + (m ? '<time>' + esc(NXKontakt.dagText(m.created_at)) + '</time>' : '')
        + '</span>'
        + '<span class="ch-rad-barn">' + esc(t.under) + '</span>'
        + '<span class="ch-rad-sist' + (oläst ? ' ar-oläst' : '') + '">' + esc(rad) + '</span>'
        + '</span>'
        + (oläst ? '<span class="ch-rad-larm">' + oläst + '</span>' : '')
        + '</button>';
    }).join('');
  }

  /* Vem man skriver till ska stå kvar i rutan, inte bara i listan
     man just klickade bort blicken från. */
  function ritaChattTopp() {
    const host = $('#ch-topp');
    if (!host) return;
    const f = S.familjer.find(x => x.id === S.aktivFamilj);
    if (!f) { host.innerHTML = ''; return; }
    const namn = f.full_name || f.email || 'Familj';
    const t = trådNamn(f);
    host.innerHTML = M.avatar(namn, S.avatarer[f.id] || null, { liten: true })
      + '<span class="ch-topp-text"><b>' + esc(t.rubrik) + '</b>'
      + '<span>' + esc(t.under) + '</span></span>';

    /* Rutan säger vem man skriver till innan man skrivit något. */
    const ruta = $('#tr-text');
    if (ruta) ruta.placeholder = t.förnamn ? 'Skriv till ' + t.förnamn + 's familj…' : 'Skriv till familjen…';
  }

  function ritaFamiljval() {
    const host = $('#familj-val');
    if (S.familjer.length < 2) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = S.familjer.map(f => {
      const oläst = S.olästa[f.id + '|' + S.user.id] || 0;
      return '<button type="button" data-familj="' + f.id + '" aria-pressed="' + (f.id === S.aktivFamilj) + '">'
        + (oläst ? '<span class="prick" aria-label="' + oläst + ' olästa"></span>' : '')
        + esc((f.full_name || 'Familj').split(' ')[0]) + '</button>';
    }).join('');
  }

  function aktivNamn() {
    const f = S.familjer.find(x => x.id === S.aktivFamilj);
    return f ? (f.full_name || 'familjen') : '';
  }

  async function byggFamilj() {
    const namn = aktivNamn();
    ritaFamiljval();
    ritaChattlista();
    ritaChattTopp();

    if (!S.aktivFamilj) {
      $('#trad').innerHTML = tomt('Ingen familj matchad än', 'Nextrum kopplar ihop dig med en familj, sedan dyker de upp här.');
      $('#tr-text').disabled = $('#tr-skicka').disabled = true;
      return;
    }
    if (S.trad) await S.trad.byt({ parentId: S.aktivFamilj, motpart: namn });
    else startaTråd();
  }

  /* Allt som hör till EN elev laddas om på ett ställe. */
  async function byggElev() {
    ritaElevProfil();
    ritaElevLista();
    ritaElevOversikt();
    fyllElevFormulär();
    fyllPassVal();
    fyllÄmnesval();
    await Promise.all([laddaLaxor(), laddaProgress(), laddaMaterial(), laddaPlanIFormulär()]);
    /* korten och profilrubriken visar nästa pass och antal öppna
       läxor, och inget av det är hämtat när de ritas första gången */
    ritaElevkort();
    ritaElevProfil();
  }

  /* ============ kontakt ============ */
  function startaTråd() {
    S.trad = NXKontakt.tråd({
      host: $('#trad'),
      skriv: $('#tr-text'),
      knapp: $('#tr-skicka'),
      jag: S.user.id,
      parentId: S.aktivFamilj,
      tutorId: S.user.id,
      motpart: aktivNamn(),
      onFel: t => säg($('#tr-msg'), 'Meddelandet gick inte iväg: ' + t, false),
      onNytt: async () => {
        /* Antalet olästa står på raden i listan. I en tråd man
           redan har uppe är "1 ny" en upplysning om något man
           just läser. */
        if (S.familjer.length > 1) { S.olästa = await NXKontakt.olästa(S.user.id); ritaFamiljval(); }
        await laddaSenaste();
        ritaChattlista();
        ritaÖvSamtal();
      }
    });
  }

  /* ============================================================
     LÄXOR
     ============================================================ */
  $('#ny-lax').addEventListener('click', () => {
    const f = $('#lax-form');
    f.hidden = !f.hidden;
    $('#ny-lax').textContent = f.hidden ? 'Ny läxa' : 'Stäng';
    if (!f.hidden) $('#lx-titel').focus();
  });
  $('#lx-avbryt').addEventListener('click', () => {
    $('#lax-form').hidden = true;
    $('#ny-lax').textContent = 'Ny läxa';
    rensa($('#lx-msg'));
  });

  $('#lax-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#lx-msg');
    rensa(msg);

    const titel = $('#lx-titel').value.trim();
    const datum = $('#lx-datum').value;
    const fel = kolla([
      { fel: !S.aktivElev, text: 'Välj en elev högst upp först.' },
      { fel: !titel, text: 'Skriv vad eleven ska göra.', falt: $('#lx-titel') },
      { fel: titel.length > 200, text: 'Rubriken är för lång. Håll den under 200 tecken.', falt: $('#lx-titel') },
      { fel: !!datum && datum < isoFor(new Date()), text: 'Deadline kan inte ligga bakåt i tiden.', falt: $('#lx-datum') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan($('#lx-spara'), 'Skapar…', async () => {
      const { error } = await supa.from('homework').insert({
        student_id: S.aktivElev,
        tutor_id: S.user.id,
        title: titel,
        subject: $('#lx-amne').value.trim() || null,
        instructions: $('#lx-text').value.trim() || null,
        due_date: datum || null
      });
      if (error) { säg(msg, 'Kunde inte skapa läxan: ' + felText(error), false); return; }

      säg(msg, '✓ Läxan har skapats. Familjen ser den direkt.', true);
      $('#lax-form').reset();
      $('#lax-form').hidden = true;
      $('#ny-lax').textContent = 'Ny läxa';
      await laddaLaxor();
    });
  });

  /* Antalet öppna läxor per elev, för märket på elevkorten.
     S.laxor innehåller bara den valda elevens läxor, så den går inte
     att räkna på: märket hade bara kunnat stå på kortet man redan
     klickat på, vilket är det enda kort man inte behöver det på. */
  async function laddaLaxräkning() {
    const { data, error } = await supa
      .from('homework')
      .select('student_id, status')
      .eq('tutor_id', S.user.id)
      .neq('status', 'klar');

    if (error) return;
    const räkning = {};
    (data || []).forEach(h => { räkning[h.student_id] = (räkning[h.student_id] || 0) + 1; });
    S.laxräkning = räkning;
  }

  async function laddaLaxor() {
    const host = $('#lax-lista');
    await laddaLaxräkning();
    $('#lax-antal').textContent = '';
    if (!S.aktivElev) {
      S.laxor = [];
      host.innerHTML = tomt('Ingen elev vald', 'Välj en elev högst upp för att se läxorna.');
      laxRakning();
      return;
    }

    host.innerHTML = laddar();
    /* student_id följer med, fast frågan redan gäller en elev. Utan
       den gick läxorna inte att para ihop med ett pass: filtret i
       passdetaljen jämförde mot ett fält som aldrig hämtats. */
    const { data, error } = await supa
      .from('homework')
      .select('id, title, instructions, subject, due_date, status, completed_at, student_id')
      .eq('student_id', S.aktivElev)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) { host.innerHTML = tomt('Kunde inte hämta läxorna', felText(error)); return; }
    if (!data.length) {
      S.laxor = [];
      host.innerHTML = tomt('Inga läxor än', 'Skapa den första med knappen ovanför. Den dyker upp hos familjen direkt.');
      laxRakning();
      return;
    }

    S.laxor = data;
    const öppna = data.filter(h => h.status !== 'klar').length;
    $('#lax-antal').textContent = öppna ? öppna + ' öppna' : 'alla klara';
    laxRakning();
    ritaElevLista();
    ritaElevOversikt();
    ritaLaxFilter();

    const urval = NXStudie.läxUrval(data, S.laxFilter);
    if (!urval.length) {
      host.innerHTML = tomt(S.laxFilter === 'klart' ? 'Inget avklarat än' : 'Inget öppet just nu',
        S.laxFilter === 'klart' ? 'Läxor eleven markerat som klara samlas här.' : 'Eleven har gjort allt hen fått.');
      return;
    }

    host.innerHTML = urval.map(h => NXStudie.läxRad(h, {
      atgarder: '<button class="btn btn-ghost btn-sm" data-lax-bort="' + h.id + '">Ta bort</button>'
    })).join('');
  }

  /* Vilket läge läxlistan står i. Lever i S så att det överlever en
     omritning — annars hoppar listan tillbaka varje gång någon
     lägger till eller tar bort en läxa. */
  function ritaLaxFilter() {
    NXStudie.läxFilter({ host: $('#lax-filter'), laxor: S.laxor, valt: S.laxFilter });
  }

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-laxfilter]');
    if (!k) return;
    S.laxFilter = k.dataset.laxfilter;
    ritaLaxFilter();
    laddaLaxor();
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lax-bort]');
    if (!knapp) return;
    const rad = knapp.closest('.lax');
    const titel = rad ? rad.querySelector('b').textContent : 'läxan';

    const ja = await bekräfta({
      titel: 'Ta bort läxan?',
      text: '"' + titel + '" försvinner för både dig och familjen. Det går inte att ångra.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(knapp, 'Tar bort…', async () => {
      const { error } = await supa.from('homework').delete().eq('id', knapp.dataset.laxBort);
      if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
      await laddaLaxor();
    });
  });

  /* ============================================================
     KUNSKAPSOMRÅDEN
     ============================================================ */
  $('#prg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#pg-msg');
    rensa(msg);

    const ämne = $('#pg-amne').value.trim();
    const område = $('#pg-omrade').value.trim();
    const fel = kolla([
      { fel: !S.aktivElev, text: 'Välj en elev högst upp först.' },
      { fel: !ämne, text: 'Fyll i vilket ämne det gäller.', falt: $('#pg-amne') },
      { fel: !område, text: 'Fyll i vilket område inom ämnet.', falt: $('#pg-omrade') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan($('#pg-spara'), 'Sparar…', async () => {
      /* upsert på (elev, ämne, område): samma område igen flyttar
         nivån i stället för att lägga till en dubblett. */
      const { error } = await supa.from('progress_items').upsert({
        student_id: S.aktivElev,
        tutor_id: S.user.id,
        subject: ämne,
        area: område,
        level: $('#pg-niva').value,
        comment: $('#pg-kommentar').value.trim() || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,subject,area' });

      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      säg(msg, '✓ Sparat. Familjen ser utvecklingen direkt.', true);
      $('#pg-omrade').value = '';
      $('#pg-kommentar').value = '';
      await laddaProgress();
    });
  });

  async function laddaProgress() {
    const host = $('#prg-lista');
    $('#prg-antal').textContent = '';
    if (!S.aktivElev) {
      S.progress = [];
      S.progressAntal = 0;
      ritaTidigareOmraden();
      host.innerHTML = tomt('Ingen elev vald', 'Välj en elev högst upp.');
      return;
    }

    host.innerHTML = laddar();
    const { data, error } = await supa
      .from('progress_items').select('id, subject, area, level, comment')
      .eq('student_id', S.aktivElev)
      .order('subject').order('area');

    if (error) { host.innerHTML = tomt('Kunde inte hämta områdena', felText(error)); return; }

    /* samma rader används av chipsen i rapporten, så de sparas undan
       i stället för att hämtas en gång till */
    S.progress = data;
    ritaTidigareOmraden();

    if (!data.length) {
      S.progressAntal = 0;
      host.innerHTML = tomt('Inga områden än', 'Lägg till det första ovanför. Det är så familjen ser att det går framåt.');
      ritaElevOversikt();
      return;
    }
    S.progressAntal = data.length;
    ritaElevOversikt();
    $('#prg-antal').textContent = data.length + ' st';
    host.innerHTML = NXStudie.progressPerÄmne(data, {
      atgarder: null
    }).replace(/<div class="prg">/g, '<div class="prg">');

    /* borttagningsknappar läggs på efteråt så att progressPerÄmne
       kan hållas fri från vy-specifika knappar */
    $$('#prg-lista .prg').forEach((rad, i) => {
      const p = data[i];
      if (!p) return;
      const atg = document.createElement('div');
      atg.className = 'prg-atg';
      atg.innerHTML = '<button class="btn btn-ghost btn-sm" data-prg-bort="' + p.id + '">Ta bort</button>';
      rad.appendChild(atg);
    });
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-prg-bort]');
    if (!knapp) return;
    const rad = knapp.closest('.prg');
    const namn = rad ? rad.querySelector('b').textContent : 'området';

    const ja = await bekräfta({
      titel: 'Ta bort området?',
      text: '"' + namn + '" försvinner ur elevens utveckling.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    const { error } = await supa.from('progress_items').delete().eq('id', knapp.dataset.prgBort);
    if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
    await laddaProgress();
  });

  /* ============================================================
     TIMMAR OCH ERSÄTTNING
     ============================================================ */
  async function laddaTimmar() {
    const host = $('#timmar');
    const { data, error } = await supa
      .from('arbetade_timmar')
      .select('timmar_totalt, timmar_vecka, timmar_manad, pass_totalt')
      .eq('tutor_id', S.user.id).maybeSingle();

    if (error) { host.innerHTML = tomt('Kunde inte hämta timmarna', felText(error)); return; }

    const t = data || { timmar_totalt: 0, timmar_vecka: 0, timmar_manad: 0, pass_totalt: 0 };
    $('#kpi-timmar').textContent = Number(t.timmar_totalt || 0);

    const rate = S.tutorProfil && S.tutorProfil.hourly_rate;
    const pengar = n => rate ? kr(Math.round(Number(n || 0) * Number(rate))) : '—';

    host.innerHTML =
        rad('Den här veckan', t.timmar_vecka, pengar(t.timmar_vecka))
      + rad('Den här månaden', t.timmar_manad, pengar(t.timmar_manad))
      + rad('Totalt', t.timmar_totalt, pengar(t.timmar_totalt))
      + '<p class="tim-not">' + (rate
          ? 'Räknat på ' + kr(rate) + ' i timmen. Bara genomförda pass räknas. Ett bokat pass blir en timme först när du skrivit rapporten.'
          : 'Din timpenning är inte satt än, så ersättningen kan inte räknas ut. Hör av dig till oss så fyller vi i den.')
      + '</p>';

    function rad(etikett, timmar, summa) {
      return '<div class="tim-rad"><span>' + esc(etikett) + '</span>'
        + '<span><b>' + Number(timmar || 0).toLocaleString('sv-SE') + ' h</b>'
        + (rate ? ' <span style="color:var(--muted-2)">· ' + esc(summa) + '</span>' : '')
        + '</span></div>';
    }
  }

  /* ============================================================
     DINA TIDER

     En kalender, som Leo bad om 2026-09-18: tryck på en dag, och tryck
     sedan på timmarna du kan. Tiderna sparas direkt.

     tutor_availability är VECKOVIS — en rad säger "torsdagar 16–19",
     inte "torsdagen den 24 september". Därför gäller en timme man
     markerar samma veckodag varje vecka, och det står rakt ut ovanför
     timmarna. Dagar med tider har en prick i kalendern.

     Det här är de tider familjen kan boka direkt: en bokning som
     ligger helt inom dem bekräftas av databasen (Fas 4.4). Andra tider
     kan familjen önska, och då bekräftar eller avböjer du i passlistan.

     Borttaget samma dag, på Leos begäran:
       · "Dagar du inte kan" — undantag per datum
       · "Föreslå en tid till en familj" — tider stäms av i chatten
     ============================================================ */
  const DAGNAMN = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
  const tvåsiff = n => String(n).padStart(2, '0');
  const veckodagFör = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;
  /* Timmarna man kan markera. Samma spann som familjen kan önska. */
  const TID_FRÅN = 7, TID_TILL = 21;

  S.tidKal = { manad: null, dag: null };

  /* Raderna för en veckodag tillbaka till lösa timmar. En rad
     16:00–20:00 är fyra timmar; halvtimmar rundas upp, för hela
     systemet bokar i hela timmar och en 16:30-ruta vore ett löfte
     bokningen inte kan hålla. */
  function timmarFör(veckodag) {
    const ut = new Set();
    (S.tillgang || []).filter(r => r.weekday === veckodag).forEach(r => {
      const start = Number(String(r.start_time).slice(0, 2));
      let slut = Number(String(r.end_time).slice(0, 2));
      if (String(r.end_time).slice(3, 5) !== '00') slut += 1;
      for (let h = start; h < slut; h++) ut.add(h);
    });
    return ut;
  }

  /* Och tillbaka igen. En sammanhängande följd timmar är ETT fönster
     — annars hade "16 till 20" blivit fyra rader i tabellen, och en
     tvåtimmarsbokning 17–19 hade inte rymts i något av dem. */
  function tillRader(veckodag, timmar) {
    const h = Array.from(timmar).sort((a, b) => a - b);
    const ut = [];
    let i = 0;
    while (i < h.length) {
      const start = h[i];
      let slut = start + 1;
      while (i + 1 < h.length && h[i + 1] === slut) { slut++; i++; }
      ut.push({ weekday: veckodag, start_time: tvåsiff(start) + ':00:00', end_time: tvåsiff(slut) + ':00:00' });
      i++;
    }
    return ut;
  }

  /* Skrivningen är en diff, inte en radera-allt-och-lägg-in-igen.
     Skulle en insert misslyckas efter en delete hade studiehjälparen
     stått utan tider på en hel veckodag utan att ha bett om det.
     Borttag först ändå: annars kan en ändrad rad krocka med sig själv
     i unique-indexet medan båda versionerna ligger inne. */
  async function skrivVeckodag(veckodag, timmar) {
    const nyckel = r => r.weekday + '|' + String(r.start_time).slice(0, 8) + '|' + String(r.end_time).slice(0, 8);
    const gamla = (S.tillgang || []).filter(r => r.weekday === veckodag);
    const nya = tillRader(veckodag, timmar);
    const gamlaN = new Set(gamla.map(nyckel));
    const nyaN = new Set(nya.map(nyckel));

    for (const r of gamla.filter(r => !nyaN.has(nyckel(r)))) {
      const { error } = await supa.from('tutor_availability').delete()
        .eq('tutor_id', S.user.id).eq('weekday', r.weekday)
        .eq('start_time', r.start_time).eq('end_time', r.end_time);
      if (error) return 'Kunde inte ändra tiden: ' + felText(error);
    }
    const lägga = nya.filter(r => !gamlaN.has(nyckel(r)));
    if (lägga.length) {
      const { error } = await supa.from('tutor_availability')
        .insert(lägga.map(r => ({ tutor_id: S.user.id, ...r })));
      if (error) return 'Kunde inte spara tiden: ' + felText(error);
    }
    return null;
  }

  /* Timmar som tryckts men inte hunnit skrivas, per veckodag. Två
     snabba tryck på samma dag får inte räkna från samma gamla rader —
     då skrev det andra över det första, och 16 + 17 blev två
     entimmesfönster i stället för ett. Knapparna visar det man
     tryckt, och skrivningarna går en i taget i tidKö. */
  const tidÖnskat = new Map();
  let tidKö = Promise.resolve();
  let tidVäntar = 0;
  const önskadeTimmar = vd => new Set(tidÖnskat.get(vd) || timmarFör(vd));

  /* Hur många kommande pass som ligger på varje timme en veckodag,
     alla kommande veckor sammanräknade. Tiderna är veckovisa, så en
     timme man tar bort gäller varje sådan dag, och då är det ALLA
     passen på den som berörs, inte bara den valda dagens.

     Ett tvåtimmarspass kl. 16 ligger på både 16 och 17. */
  function passPerTimme(veckodag) {
    const ut = {};
    (S.bokningar || []).filter(ärKommande).forEach(b => {
      if (veckodagFör(b.wanted_date) !== veckodag) return;
      const h0 = parseInt(String(b.wanted_time || ''), 10);
      if (isNaN(h0)) return;
      const n = Math.max(1, Math.ceil((Number(b.duration_min) || 60) / 60));
      for (let i = 0; i < n; i++) ut[h0 + i] = (ut[h0 + i] || 0) + 1;
    });
    return ut;
  }

  /* Knappens innehåll. Markerad eller inte syntes förut bara som
     färg (mossgrön eller vit). Nu har läget en form: ringen är samma
     "Ledig" som i schemat och bokningen, ringen med snedstreck samma
     "Ej tillgänglig". Antalet pass står i ord. */
  function timInnehåll(h, markerad, antal) {
    return NXStudie.ikon(markerad ? 'ledig' : 'ej')
      + '<span>' + tvåsiff(h) + ':00</span>'
      + (antal
          ? '<span style="font-family:var(--f-sans,inherit);font-size:.74rem;font-weight:600;letter-spacing:0">'
            + antal + ' pass</span>'
          : '');
  }

  function timEtikett(h, antal) {
    return tvåsiff(h) + ':00' + (antal ? ', ' + antal + ' kommande pass' : '');
  }

  function ritaTider() {
    const kal = $('#tid-kalender'), dagHost = $('#tid-dag');
    if (!kal || !dagHost) return;
    const idag = isoFor(new Date());
    const k = S.tidKal;
    if (!k.manad) k.manad = NXArbete.månadFör(idag);
    const medTider = new Set((S.tillgang || []).map(r => r.weekday));

    kal.innerHTML = NXArbete.manad({
      manad: k.manad,
      valt: k.dag,
      prefix: 'tk',
      minManad: NXArbete.månadFör(idag),
      prickText: 'du har tider den veckodagen',
      dag: iso => ({ klickbar: iso >= idag, prick: iso >= idag && medTider.has(veckodagFör(iso)) })
    });

    if (!k.dag) {
      dagHost.innerHTML = '<p class="mv-inga">Tryck på en dag i kalendern för att markera när du kan. '
        + 'Dagar med en prick har redan tider.</p>';
    } else {
      const vd = veckodagFör(k.dag);
      const mina = önskadeTimmar(vd);
      const pass = passPerTimme(vd);
      const passTimmar = Object.keys(pass).map(Number);
      /* En tid utanför 07 till 21, från en äldre vy eller från admin,
         ska synas som en knapp. En tid man inte ser går inte att ta
         bort. Samma sak för ett pass utanför spannet: antalet ska stå
         någonstans. */
      const från = Math.min(TID_FRÅN, ...mina, ...passTimmar);
      const till = Math.max(TID_TILL, ...mina, ...passTimmar);
      let knappar = '';
      for (let h = från; h <= till; h++) {
        const n = pass[h] || 0;
        knappar += '<button type="button" class="bk-slot tk-tim" data-timme="' + h + '"'
          + ' style="display:inline-flex;align-items:center;gap:6px"'
          + ' aria-label="' + esc(timEtikett(h, n)) + '"'
          + ' aria-pressed="' + (mina.has(h) ? 'true' : 'false') + '">'
          + timInnehåll(h, mina.has(h), n) + '</button>';
      }
      const dagar = DAGNAMN[vd].toLowerCase() + 'ar';
      dagHost.innerHTML = '<p class="bk-kal-dagnamn">' + esc(DAGNAMN[vd] + ' ' + datumText(k.dag)) + '</p>'
        + '<p class="tk-hjalp">Tryck på timmarna du kan. De gäller <b>varje ' + esc(DAGNAMN[vd].toLowerCase())
        + '</b>, och du behöver inte spara.'
        + (passTimmar.length
            ? ' Vid en timme med pass står hur många kommande pass som ligger där, alla kommande ' + esc(dagar) + ' räknade.'
            : '')
        + '</p>'
        + '<div class="mv-tider tk-timmar" role="group" aria-label="' + esc('Timmar ' + dagar) + '">'
        + knappar + '</div>'
        + '<ul class="nx-forklaring" aria-label="Teckenförklaring">'
        + '<li>' + NXStudie.ikon('ledig') + 'Familjen kan boka</li>'
        + '<li>' + NXStudie.ikon('ej') + 'Ej tillgänglig</li>'
        + '</ul>';
    }

    const sam = $('#tid-sammanfattning');
    if (sam) {
      sam.textContent = (S.tillgang || []).length
        ? 'Dina tider: ' + (S.tillgang || []).slice()
            .sort((a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)))
            .map(r => DAGNAMN[r.weekday].slice(0, 3).toLowerCase() + ' ' + String(r.start_time).slice(0, 5)
                      + ' till ' + String(r.end_time).slice(0, 5)).join(' · ')
        : 'Inga tider inlagda än. Familjen kan fortfarande önska tider, men ingen bokning bekräftas direkt.';
    }
  }

  /* En timme av eller på för veckodagen. Knappen svarar direkt, och
     vyn ritas om från databasen när alla tryck är skrivna. Varje steg
     i kön skriver det SENASTE man tryckt fram för dagen, mot rader
     som just hämtats, så blir tre snabba tryck ett fönster.

     Att ta bort en timme där kommande pass ligger frågar först. Passen
     ligger kvar (tutor_availability styr bara vad familjen kan boka
     direkt), men utan frågan var det lätt att tro att de avbokades, eller
     att inte märka att timmen var bokad alls. */
  async function växlaTimme(knapp) {
    const k = S.tidKal;
    if (!k.dag) return;
    const vd = veckodagFör(k.dag);
    const h = Number(knapp.dataset.timme);
    const antal = passPerTimme(vd)[h] || 0;

    if (antal && önskadeTimmar(vd).has(h)) {
      const ja = await bekräfta({
        titel: 'Ta bort timmen ur dina tider?',
        text: (antal === 1 ? 'Ett kommande pass ligger' : antal + ' kommande pass ligger')
          + ' på ' + DAGNAMN[vd].toLowerCase() + 'ar kl. ' + tvåsiff(h) + ':00. '
          + (antal === 1 ? 'Passet ligger kvar' : 'Passen ligger kvar') + ' och påverkas inte, '
          + 'men familjen kan inte längre boka den timmen direkt. '
          + 'Vill du flytta eller avboka ett pass gör du det i passlistan.',
        knapp: 'Ta bort timmen',
        avbryt: 'Behåll'
      });
      if (!ja) return;
    }

    /* Räknas om efter frågan: ett tryck till på en annan timme kan ha
       hunnit skrivas medan rutan stod öppen. */
    const timmar = önskadeTimmar(vd);
    if (timmar.has(h)) timmar.delete(h); else timmar.add(h);
    tidÖnskat.set(vd, timmar);
    /* Rutan ritas inte om förrän kön är klar, men knappen kan ha
       bytts ut under frågan. Den som syns är den som ska ändras. */
    const synlig = (knapp.isConnected ? knapp : $('#tid-dag [data-timme="' + h + '"]')) || knapp;
    synlig.setAttribute('aria-pressed', timmar.has(h) ? 'true' : 'false');
    synlig.innerHTML = timInnehåll(h, timmar.has(h), antal);

    tidVäntar++;
    tidKö = tidKö
      .then(async () => {
        const mål = tidÖnskat.get(vd);
        if (!mål) return;
        const fel = await skrivVeckodag(vd, mål);
        if (fel) { tidÖnskat.delete(vd); alert(fel); }
        S.tillgang = (await NX.hämtaTillganglighet(S.user.id)).tillgang;
      })
      .catch(() => { tidÖnskat.delete(vd); })
      .then(() => {
        if (--tidVäntar > 0) return;
        tidÖnskat.clear();
        ritaTider();
        schemaTider();
      });
  }

  document.addEventListener('click', e => {
    const sek = e.target.closest('section[data-sek="tider"]');
    if (!sek) return;

    const tim = e.target.closest('.tk-tim');
    if (tim) { växlaTimme(tim); return; }

    const dag = e.target.closest('.mv-dag');
    if (dag && !dag.disabled) {
      S.tidKal.dag = S.tidKal.dag === dag.dataset.datum ? null : dag.dataset.datum;
      ritaTider();
      return;
    }
    if (e.target.closest('#tk-forr') || e.target.closest('#tk-nasta')) {
      const ny = NXArbete.plusMånader(S.tidKal.manad, e.target.closest('#tk-forr') ? -1 : 1);
      if (ny < NXArbete.månadFör(isoFor(new Date()))) return;
      S.tidKal.manad = ny;
      ritaTider();
    }
  });

  /* ============================================================
     HÄMTNINGARNA

     laddaTider    veckotiderna ur databasen
     laddaUpptagna vilka timmar som redan är bokade hos dig, för
                   flytta-rutan och schemats tidslinje

     Båda ritar om schemat på Översikt: dess vecko- och dagvy visar
     lediga och ej tillgängliga timmar ur just de två.
     ============================================================ */
  async function laddaTider() {
    const t = await NX.hämtaTillganglighet(S.user.id);
    S.tillgang = t.tillgang;
    S.tillgangHämtad = true;
    ritaTider();
    schemaTider();
  }

  async function laddaUpptagna() {
    S.upptagna = await NX.hämtaUpptagna(S.user.id);
    schemaTider();
  }

  /* ============================================================
     NOTISER
     Bara sådant som väntar på ett svar från dig.
     ============================================================ */
  function ritaNotiser() {
    const hus = $('#notis-hus');
    if (!hus) return;
    const poster = [];

    const olästa = Object.values(S.olästa || {}).reduce((a, b) => a + b, 0);
    if (olästa) {
      poster.push({
        rubrik: olästa + ' olä' + (olästa > 1 ? 'sta meddelanden' : 'st meddelande'),
        text: 'En familj väntar på svar.',
        mål: '#trad'
      });
    }

    const väntar = (S.bokningar || []).filter(b =>
      b.status === 'requested' && b.created_by !== S.user.id && !harBörjat(b)).length;
    if (väntar) {
      poster.push({
        rubrik: väntar + ' pass att bekräfta',
        text: 'En familj har önskat en tid som du inte svarat på.',
        mål: '#pass-lista'
      });
    }

    /* Samma urval som "Väntar på rapport" på Översikt, utom de pass
       du inte kan rapportera (rapportHinder): de står kvar i listan
       med skälet och en avstängd knapp, men en notis som ber dig göra
       något du inte kan göra går aldrig att bli av med. Förut räknade
       notisen bekräftade pass före idag, och listan pass som börjat
       och går att rapportera: två siffror som kunde skilja sig åt
       samma dag utan att något förklarade varför. */
    const orapporterade = (S.bokningar || []).filter(b => väntarRapport(b) && !rapportHinder(b)).length;
    if (orapporterade) {
      poster.push({
        rubrik: orapporterade + ' pass utan rapport',
        text: 'Passet har varit. Rapporten gör det till en arbetad timme.',
        mål: '#ov-lektioner'
      });
    }

    NXStudie.notiser(hus, poster);
  }

  /* ============================================================
     PASSEN
     ============================================================ */
  async function laddaPass() {
    const host = $('#pass-lista');
    const { data, error } = await supa
      .from('bookings')
      .select('id, subject, format, location, note, wanted_date, wanted_time, duration_min, status, attendance, student_id, parent_id, created_by')
      .eq('tutor_id', S.user.id).order('wanted_date', { ascending: true });

    if (error) { host.innerHTML = tomt('Kunde inte hämta passen', felText(error)); return; }
    S.bokningar = data || [];

    /* Räkningarna. "Kommande" är pass som ska hållas och inte har
       börjat, samma regel som Mina lektioner. Förut räknade KPI:n
       varje önskat och bekräftat pass, också de som hölls förra
       veckan och bara saknar rapport. Antalet vid "Dina pass" räknade
       avbokade med, fast de ligger i en egen hopfälld grupp. */
    $('#kpi-kommande').textContent = S.bokningar.filter(ärKommande).length;
    const ejAvbokade = S.bokningar.filter(b => b.status !== 'cancelled').length;
    $('#pass-antal').textContent = ejAvbokade ? ejAvbokade + ' st' : '';

    /* Siffran på fliken räknar de pass familjen begärt men du inte
       svarat på än. Det är den enda posten här som är din tur;
       ett bekräftat pass kräver ingenting förrän det hållits. */
    märkFlik('#flik-pass-mark', S.bokningar.filter(b => b.status === 'requested').length);
    ritaNästaPass();
    ritaMinaLektioner();
    ritaElevOversikt();
    ritaStatistik();
    byggSchema();

    ritaNotiser();

    if (!S.bokningar.length) {
      host.innerHTML = tomt('Inga pass än', 'Familjen bokar på tiderna du markerat under Dina tider.');
      return;
    }

    NXStudie.passLista({
      host: host,
      bokningar: S.bokningar,
      avbokade: 'egen',
      tomtKommande: 'Inga kommande pass. Familjen bokar på tiderna du markerat under Dina tider.',
      rad: b => NXKontakt.passRad(b, {
        under: passUnder(b),
        vem: passVem(b),
        atgarder: passKnappar(b, false),
        klickbar: true
      }) + (b.note ? '<p class="xsmall" style="margin:-6px 0 12px 82px;color:var(--muted)">' + esc(b.note) + '</p>' : '')
    });
  }

  /* ------------------------------------------------------------
     EN REGEL PER FRÅGA, FÖR ALLA STÄLLEN ETT PASS SYNS

     Passlistan, Mina lektioner, Elevens läge och passrutan ritade
     förut var sin variant av samma knappar, med var sin kopia av
     regeln för "har varit". Nu frågar alla samma funktioner.

     Ett eget förslag som familjen aldrig svarade på, och vars tid
     har passerat, har kvar Flytta och Avboka. Det är med flit: passet
     hölls aldrig (rapporterbart säger nej), så att flytta det till en
     ny tid är vägen framåt, och databasen tillåter det.
     ------------------------------------------------------------ */

  /* Ska hållas och har inte börjat. */
  function ärKommande(b) {
    return (b.status === 'requested' || b.status === 'confirmed') && !harBörjat(b);
  }

  /* Har börjat, går att rapportera, och är inte rapporterat. Då är
     rapporten det enda som återstår, och den knappen är den primära. */
  function väntarRapport(b) {
    const kan = b.status === 'requested' || b.status === 'confirmed';
    return kan && rapporterbart(b) && harBörjat(b);
  }

  /* Namnet på passet: eleven, annars familjen. */
  function passNamn(b) {
    const e = S.elever.find(x => x.id === b.student_id);
    if (e) return e.name;
    const f = S.familjer.find(x => x.id === b.parent_id);
    return f ? (f.full_name || '') : '';
  }

  /* Platsen står direkt på raden, inte bara i detaljvyn. Ett pass på
     plats är en resa, och var man ska vara är halva beskedet. Eleven
     står först: det är vem man ska träffa. */
  function passUnder(b) {
    return [passNamn(b), b.format, b.location, NXStudie.längdText(b.duration_min || 60)]
      .filter(Boolean).join(' · ');
  }

  /* Varför passet inte går att rapportera, eller null. Rapporten
     måste gälla passets elev, och eleven måste vara din (Fas 1.4 och
     1.6). Ett pass vars elev bytt studiehjälpare ligger kvar på dig,
     men databasen nekar rapporten; förut hade det ändå en aktiv
     knapp som bara ledde till en ruta som sa nej. Innan elevlistan
     är hämtad vet vyn inte, och då får databasen svara. */
  function rapportHinder(b) {
    if (!b.student_id) return UTAN_ELEV;
    if (S.eleverHämtade && !S.elever.some(e => e.id === b.student_id)) return INTE_DIN_ELEV;
    return null;
  }

  function passVem(b) {
    const mitt = b.created_by === S.user.id;
    const kan = b.status === 'requested' || b.status === 'confirmed';
    const hinder = kan ? rapportHinder(b) : null;
    if (hinder) return hinder;
    if (väntarRapport(b)) return 'Passet har varit, rapporten saknas';
    if (b.status === 'requested') return mitt ? 'Ditt förslag, väntar på svar' : 'Familjen önskade den här tiden';
    if (b.attendance === 'franvarande') return 'Eleven uteblev';
    if (b.attendance === 'sen') return 'Eleven kom sent';
    return null;
  }

  /* "Skriv rapport". Ett pass utan elev, eller med en elev som inte
     längre är din, går inte att rapportera (databasen säger nej sedan
     Fas 1.4), så knappen står avstängd och raden säger varför
     (passVem), i stället för en ruta som bara kan misslyckas. */
  function rapportKnapp(b, iRutan) {
    const kl = 'btn btn-primary' + (iRutan ? '' : ' btn-sm');
    return rapportHinder(b)
      ? '<button type="button" class="' + kl + '" disabled>Skriv rapport</button>'
      : '<button type="button" class="' + kl + '" data-rapportera="' + esc(b.id) + '">Skriv rapport</button>';
  }

  /* Knapparna på ett pass. Har passet varit och saknar rapport är det
     EN sak man ska göra, och den knappen är den primära. Flytta hör
     till pass som ligger framåt: ett pass som redan hållits går inte
     att flytta. Ett önskemål från familjen avböjs, ett bokat pass
     avbokas; samma sak i databasen, men inte samma sak att säga. */
  function passKnappar(b, iRutan) {
    const mitt = b.created_by === S.user.id;
    const kan = b.status === 'requested' || b.status === 'confirmed';
    const harVarit = väntarRapport(b);
    const sm = iRutan ? '' : ' btn-sm';

    let k = '';
    if (b.status === 'requested' && !mitt && !harVarit) {
      k += '<button type="button" class="btn btn-primary' + sm + '" data-status="confirmed" data-id="' + esc(b.id) + '">Bekräfta</button>';
    }
    if (harVarit) k += rapportKnapp(b, iRutan);
    if (kan && !harVarit) {
      k += '<button type="button" class="btn btn-ghost' + sm + '" data-flytta="' + esc(b.id) + '">Flytta</button>';
    }
    if (kan) {
      const önskemål = b.status === 'requested' && !mitt;
      k += '<button type="button" class="btn btn-ghost' + sm + '" data-status="cancelled" data-id="' + esc(b.id) + '"'
        + (önskemål ? ' data-avboj="1">Avböj' : '>Avboka') + '</button>';
    }
    return k;
  }

  /* Passväljaren i rapportformuläret: bara den valda elevens pass
     som inte redan är rapporterade. */
  /* Pass som VÄNTAR på en rapport.

     Listan innehöll förut varje bokat pass, också de som ligger en
     månad fram. Man kunde alltså rapportera ett pass som inte hänt
     — och eftersom rapporten sätter passet till genomfört försvann
     det ur listan i samma stund, vilket såg ut som att det bokade
     passet raderats.

     Rätt urval är: passet är inte avbokat, det är inte redan
     rapporterat (status completed sätts av rapporten), och det har
     faktiskt ägt rum. Nyast först — man rapporterar gårdagens pass,
     inte det från i förrgår. */
  /* Samma regel som triggern skydda_bokningsfalt i databasen: ett
     pass kan bli genomfört bara om familjen stått bakom tiden —
     bekräftat, eller bokat av familjen själv. Ett eget förslag som
     familjen aldrig svarat på erbjuds därför inte här; databasen
     hade avvisat det efter att rapporten redan sparats. */
  function rapporterbart(b) {
    return b.status === 'confirmed'
      || (b.status === 'requested' && b.created_by === b.parent_id);
  }

  /* Har passet börjat? Datum OCH klockslag. Med bara datumet stod ett
     önskemål till ikväll som "Passet har varit" med Skriv rapport, och
     gick inte att bekräfta innan det hänt. */
  function harBörjat(b) {
    const idag = isoFor(new Date());
    const d = String(b.wanted_date || '');
    if (d !== idag) return d < idag;
    const nu = new Date();
    const klockan = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
    return String(b.wanted_time || '00:00').slice(0, 5) <= klockan;
  }

  function passUtanRapport() {
    return S.bokningar
      .filter(b => b.student_id === S.aktivElev
        && rapporterbart(b)
        && harBörjat(b))
      .sort((a, c) => String(c.wanted_date + (c.wanted_time || ''))
        .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));
  }

  function fyllPassVal() {
    const val = $('#r-pass');
    const mina = passUtanRapport();

    val.innerHTML = mina.map(b => '<option value="' + b.id + '">' + esc(datumText(b.wanted_date))
          + ' kl. ' + esc(b.wanted_time || '') + ' · ' + esc(b.subject || 'Pass') + '</option>').join('')
      /* Sist, inte först: det vanliga är att rapportera ett pass. En
         fristående rapport är undantaget och ska inte vara förvalet. */
      + '<option value="">Inget pass, fristående rapport</option>';

    /* Är inget pass valt ännu, välj det senaste som väntar. Att låta
       rutan stå på "fristående" när det finns tre orapporterade pass
       är att be om en rapport som inte hör ihop med något. */
    if (mina.length && !val.value) {
      val.value = mina[0].id;
      val.dispatchEvent(new Event('change'));
    }
  }

  /* "Skriv rapport" på en passrad. Väljer passet i formuläret och
     tar en dit — i stället för att lämna en att leta rätt på samma
     pass en gång till i en rullgardin man just scrollat förbi. */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-rapportera]');
    if (!knapp) return;
    medan(knapp, 'Öppnar…', () => öppnaRapport(knapp.dataset.rapportera));
  });

  /* ============================================================
     RAPPORTEN SOM RUTA

     Formuläret är oförändrat — samma fält, samma sparlogik, samma
     trigger som gör passet genomfört. Det som ändrats är var det
     bor: i en ruta som öppnas från passet, inte som en utfälld ruta
     under listan som alltid tog halva sidan.

     Rutan flyttas till <body> första gången den öppnas. Inne i en
     flikpanel kan en förälder med transform eller overflow klippa en
     position:fixed-ruta, och då hamnar den mitt i listan.
     ============================================================ */
  let rapportFokus = null;
  let rapportStängs = null;
  /* Passet rutan öppnades från. Rapporten sparas på DESS elev, aldrig
     på den som råkar vara vald högst upp (hål 3). */
  let rapportFrån = null;

  function sättRapportTitel(b) {
    const titel = $('#rp-titel');
    if (!titel) return;
    const e = b ? (S.elever || []).find(x => x.id === b.student_id) : null;
    titel.textContent = b
      ? 'Rapport · ' + (e ? e.name + ', ' : '') + datumText(b.wanted_date)
        + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : '')
      : 'Fristående rapport';
  }

  async function öppnaRapport(bokningId) {
    const ruta = $('#rapport-overlay');
    if (!ruta) return;
    /* HÅL 3. Rapporten gäller passets elev, alltid. Förut byttes den
       valda eleven bara när passet HADE en elev, och rapporten sparades
       på den valda. Ett pass utan elev gav alltså en rapport om det
       barn som råkade stå överst, och databasen godtog det. Nu säger
       databasen nej till det (Fas 1.4), och rutan öppnas inte ens:
       en ruta som bara kan misslyckas är sämre än ett besked. */
    const b = (S.bokningar || []).find(x => x.id === bokningId) || null;
    if (bokningId && !b) return;
    if (b && !b.student_id) { alert(UTAN_ELEV); return; }
    /* Knappen står redan avstängd för det här (rapportKnapp). Kvar
       som skydd för en ruta som ritades innan elevlistan kom. */
    if (b && !S.elever.some(e => e.id === b.student_id)) { alert(INTE_DIN_ELEV); return; }

    if (ruta.parentNode !== document.body) document.body.appendChild(ruta);
    clearTimeout(rapportStängs);

    /* Eleven byts så att passväljaren, ämnena och kunskapsområdena i
       rutan gäller passets elev. Det är listorna som följer med
       bytet; vilken elev rapporten sparas på avgör rapportFrån. */
    if (b && b.student_id !== S.aktivElev) await väljElev(b.student_id);
    if (b && S.aktivElev !== b.student_id) return;
    rapportFrån = b;

    const val = $('#r-pass');
    if (bokningId && val) {
      val.value = bokningId;
      if (val.value !== bokningId) {
        alert('Det här passet kan inte rapporteras än. Familjen behöver ha bekräftat tiden först.');
        return;
      }
      val.dispatchEvent(new Event('change'));
    }
    sättRapportTitel(b);
    rensa($('#r-msg'));

    rapportFokus = document.activeElement;
    ruta.hidden = false;
    document.body.style.overflow = 'hidden';
    void ruta.offsetWidth;
    ruta.classList.add('open');
    /* Fokus på första fältet man faktiskt ska fylla i. */
    const forst = $('#r-gick-val button');
    if (forst) forst.focus();
  }

  function stängRapport() {
    clearTimeout(rapportStängs);
    const ruta = $('#rapport-overlay');
    if (!ruta || ruta.hidden) return;
    ruta.classList.remove('open');
    ruta.hidden = true;
    document.body.style.overflow = '';
    if (rapportFokus && rapportFokus.isConnected && rapportFokus.focus) rapportFokus.focus();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-rapport-stang]')) { stängRapport(); return; }
    /* Klick på den mörka bakgrunden, inte i rutan. */
    if (e.target.id === 'rapport-overlay') stängRapport();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') stängRapport();
  });

  $('#r-pass').addEventListener('change', e => {
    const b = S.bokningar.find(x => x.id === e.target.value);
    sättRapportTitel(b);
    if (!b) return;
    $('#r-datum').value = b.wanted_date;
    sättÄmneFrånPass(b);
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;

    if (btn.dataset.status === 'cancelled') {
      const ja = await bekräfta(btn.dataset.avboj ? {
        titel: 'Avböj önskemålet?',
        text: 'Familjen ser att tiden inte passade. Skriv gärna i chatten vilka tider som fungerar.',
        knapp: 'Avböj'
      } : {
        titel: 'Avboka passet?',
        text: 'Familjen ser att passet är avbokat. Vill du hellre flytta det, skriv till dem först.',
        knapp: 'Avboka'
      });
      if (!ja) return;
    }

    await medan(btn, '…', async () => {
      const { error } = await supa.from('bookings').update({ status: btn.dataset.status }).eq('id', btn.dataset.id);
      if (error) { alert('Kunde inte uppdatera: ' + felText(error)); return; }
      await laddaPass();
      fyllPassVal();
      await Promise.all([laddaUpptagna(), laddaTimmar()]);
    });
  });

  /* Flytta ett pass: ny tid, och motparten får bekräfta igen. */
  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-flytta]');
    if (!k) return;
    const b = S.bokningar.find(x => x.id === k.dataset.flytta);
    if (!b) return;

    /* lagen: kalendern skiljer på dagar med lediga tider, fullbokade
       dagar och dagar utan tider, och dagens tagna timmar står som
       låsta "Bokad" (program 2, Fas 1). Passets egna timmar räknas som
       lediga, så att man kan byta dag och behålla klockslaget. */
    const ny = await NXStudie.flyttaRuta({
      datum: b.wanted_date,
      tid: b.wanted_time,
      tillgang: S.tillgang,
      minuter: b.duration_min || 60,
      upptagna: await NX.hämtaUpptagna(S.user.id),
      lagen: true
    });
    if (!ny) return;

    await medan(k, 'Flyttar…', async () => {
      const { error } = await supa.from('bookings').update({
        wanted_date: ny.datum,
        wanted_time: ny.tid,
        status: 'requested',
        created_by: S.user.id
      }).eq('id', b.id);

      if (error) {
        alert(error.code === '23505' || error.code === '23P01'
          ? 'Den tiden hann bli upptagen. Välj en annan.'
          : 'Kunde inte flytta passet: ' + felText(error));
        return;
      }
      await laddaPass();
      fyllPassVal();
      await laddaUpptagna();
    });
  });

  /* ============================================================
     RAPPORTEN
     Den här är navet: den skriver rapporten, markerar passet som
     genomfört, sätter närvaron, kan skapa läxan — och därmed
     räknas timmen upp. Ett formulär, hela slingan.
     ============================================================ */
  /* Valen ligger här i stället för i fyra fritextfält. Ett svar på
     "hur gick det" går att räkna på; fyra stycken löptext gick bara
     att läsa, en rapport i taget. */
  const rap = { gick: null, amne: null, niva: 'pa_god_vag' };

  const GICK = { mycket_bra: 'Mycket bra', bra: 'Bra', folja_upp: 'Behöver följas upp' };

  /* aria-pressed är sanningen för skärmläsaren och för CSS:en, rap
     är sanningen för koden. De sätts alltid tillsammans. */
  function väljChip(host, värde) {
    $$('[data-v]', host).forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.v === värde ? 'true' : 'false'));
  }

  $('#r-gick-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    rap.gick = b.dataset.v;
    väljChip($('#r-gick-val'), rap.gick);
    rensa($('#r-msg'));
  });

  $('#r-amne-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    /* går att klicka bort igen: ämnet är valfritt, och ett chip som
       inte går att ångra tvingar fram ett svar man inte har */
    rap.amne = (rap.amne === b.dataset.v) ? null : b.dataset.v;
    väljChip($('#r-amne-val'), rap.amne);
  });

  $('#r-niva-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    rap.niva = b.dataset.v;
    väljChip($('#r-niva-val'), rap.niva);
  });

  /* Ämnena kommer från tre håll: dina egna, elevens, och det som
     faktiskt stod i bokningarna. Ingen hårdkodad lista — den som
     hjälper till i spanska ska inte välja mellan matte och NO. */
  function ämnesFörslag() {
    const e = elev();
    const ur = []
      .concat((S.tutorProfil && S.tutorProfil.subjects) || [])
      .concat((e && e.subjects) || [])
      .concat(S.bokningar.filter(b => b.student_id === S.aktivElev).map(b => b.subject));
    const ut = [];
    ur.forEach(x => {
      const v = String(x || '').trim();
      if (v && ut.indexOf(v) === -1) ut.push(v);
    });
    return ut;
  }

  function fyllÄmnesval() {
    const host = $('#r-amne-val');
    const lista = ämnesFörslag();
    if (rap.amne && lista.indexOf(rap.amne) === -1) lista.push(rap.amne);

    if (!lista.length) {
      host.innerHTML = '<span class="xsmall" style="color:var(--bl-2)">'
        + 'Lägg in dina ämnen under Min profil, så står de här.</span>';
      return;
    }
    host.innerHTML = lista.map(a =>
      '<button type="button" data-v="' + esc(a) + '" aria-pressed="'
      + (a === rap.amne ? 'true' : 'false') + '">' + esc(a) + '</button>').join('');
  }

  $('#r-omrade-pa').addEventListener('change', e => {
    $('#r-omrade-falt').hidden = !e.target.checked;
  });

  /* De områden eleven redan har. Att skriva "Ekvationer" på nytt för
     hand varje gång ger dubbletter som ser ut som framsteg utan att
     vara det — unikt är (elev, ämne, område), och stavfel bryter det. */
  function ritaTidigareOmraden() {
    const host = $('#r-omrade-tidigare');
    if (!host) return;
    const rader = (S.progress || []).slice(0, 8);
    if (!rader.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<span class="xsmall" style="color:var(--bl-2)">Tidigare:</span>'
      + rader.map((p, i) => '<button type="button" class="chip" data-tidigare="' + i + '">'
          + esc(p.area) + '</button>').join('');
  }

  $('#r-omrade-tidigare').addEventListener('click', e => {
    const b = e.target.closest('[data-tidigare]');
    if (!b) return;
    const p = (S.progress || [])[Number(b.dataset.tidigare)];
    if (!p) return;
    $('#r-omrade').value = p.area || '';
    if (p.subject) { rap.amne = p.subject; fyllÄmnesval(); }
    if (p.level) { rap.niva = p.level; }
    väljChip($('#r-niva-val'), rap.niva);
  });

  /* Passet vet oftast vilket ämne det gällde. Det som står i
     bokningen är ett bättre förval än tomt. */
  function sättÄmneFrånPass(b) {
    if (!b || !b.subject) return;
    rap.amne = b.subject;
    fyllÄmnesval();
  }

  function nollställRapport() {
    rap.gick = null;
    rap.amne = null;
    rap.niva = 'pa_god_vag';
    väljChip($('#r-gick-val'), null);
    väljChip($('#r-niva-val'), rap.niva);
    fyllÄmnesval();
    $('#r-notes').value = '';
    $('#r-fokus').value = '';
    $('#r-omrade').value = '';
    $('#r-trana').value = '';
    $('#r-omrade-pa').checked = false;
    $('#r-omrade-falt').hidden = true;
    $('#r-lax').checked = false;
    $('#r-lax-falt').hidden = true;
    $('#r-lax-titel').value = '';
    $('#r-lax-datum').value = '';
    sättÄmneFrånPass(S.bokningar.find(x => x.id === $('#r-pass').value));
  }

  $('#r-lax').addEventListener('change', e => { $('#r-lax-falt').hidden = !e.target.checked; });

  $('#rapport-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#r-msg');
    rensa(msg);

    const anteckningar = $('#r-notes').value.trim();
    const laxTitel = $('#r-lax-titel').value.trim();
    const områdePå = $('#r-omrade-pa').checked;
    const område = $('#r-omrade').value.trim();
    const träna = $('#r-trana').value.trim();

    /* Vem rapporten gäller (hål 3). Är ett pass valt är det passets
       elev. Är rutan öppnad från ett pass men ändrad till "fristående"
       är det fortfarande det passets elev. Bara en rapport som aldrig
       haft ett pass får den valda eleven. S.aktivElev läses alltså
       inte alls när det finns ett pass. */
    const passId = $('#r-pass').value || null;
    const pass = passId ? (S.bokningar || []).find(x => x.id === passId) || null : null;
    const elevId = pass ? pass.student_id
      : rapportFrån ? rapportFrån.student_id
      : S.aktivElev;

    const fel = kolla([
      { fel: !!passId && !pass, text: 'Passet finns inte längre. Stäng rutan och försök igen.' },
      { fel: (!!pass && !pass.student_id) || (!!rapportFrån && !rapportFrån.student_id), text: UTAN_ELEV },
      { fel: !elevId, text: 'Välj en elev högst upp först.' },
      { fel: !rap.gick, text: 'Välj hur lektionen gick.' },
      { fel: !anteckningar, text: 'Skriv något om vad ni gjorde.', falt: $('#r-notes') },
      { fel: områdePå && !område, text: 'Skriv vilket område ni jobbade med, eller kryssa ur rutan.', falt: $('#r-omrade') },
      /* progress_items är unikt per (elev, ämne, område). Utan ämne
         finns ingen rad att uppdatera, bara en att skapa på nytt. */
      { fel: områdePå && !rap.amne, text: 'Välj vilket ämne området hör till.' },
      { fel: $('#r-lax').checked && !laxTitel, text: 'Skriv vad läxan går ut på, eller kryssa ur rutan.', falt: $('#r-lax-titel') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    const datum = $('#r-datum').value || isoFor(new Date());

    await medan($('#r-spara'), 'Sparar…', async () => {
      const { data, error } = await supa.from('lesson_reports').insert({
        student_id: elevId,
        tutor_id: S.user.id,
        booking_id: passId,
        lesson_date: datum,
        raw_notes: anteckningar,
        gick: rap.gick,
        amne: rap.amne || null,
        needs_practice: träna || null,
        next_focus: $('#r-fokus').value.trim() || null,
        /* Närvaron följer med rapporten. Databasen markerar passet
           genomfört i samma transaktion (triggern
           lesson_reports_gor_passet_genomfort), så en rapport kan inte
           längre bli sparad medan passet står kvar orört. Vägrar
           databasen passet sparas inte rapporten heller, och felet
           nedan säger varför. Samma sak om rapporten gäller en annan
           elev än passets (Fas 1.4): databasen nekar, med ett svenskt
           besked. */
        narvaro: passId ? $('#r-narvaro').value : null
      }).select('id').single();

      if (error) { säg(msg, 'Kunde inte spara rapporten: ' + felText(error), false); return; }

      let varning = '';

      /* Samma formulär skriver utvecklingen. Förr låg den i ett eget
         formulär längre ned, och därför fylldes den nästan aldrig i. */
      if (områdePå && område && rap.amne) {
        const { error: pErr } = await supa.from('progress_items').upsert({
          student_id: elevId,
          tutor_id: S.user.id,
          subject: rap.amne,
          area: område,
          level: rap.niva,
          comment: träna ? 'Behöver träna på: ' + träna : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'student_id,subject,area' });
        if (pErr) varning += ' Kunskapsområdet kunde inte uppdateras: ' + felText(pErr);
      }

      if ($('#r-lax').checked && laxTitel) {
        const { error: lErr } = await supa.from('homework').insert({
          student_id: elevId,
          tutor_id: S.user.id,
          title: laxTitel,
          subject: rap.amne || null,
          instructions: $('#r-fokus').value.trim() || null,
          due_date: $('#r-lax-datum').value || null
        });
        if (lErr) varning += ' Läxan kunde inte skapas: ' + felText(lErr);
      }

      if ($('#r-ai').checked) {
        säg(msg, 'Rapporten är sparad. Formulerar om den åt föräldern…', true);
        const { error: aiErr } = await supa.functions.invoke('generate-feedback', { body: { report_id: data.id } });
        if (aiErr) {
          säg(msg, 'Rapporten är sparad, men AI-omskrivningen gick inte. Föräldern ser dina anteckningar precis som du skrev dem.' + varning, false);
        } else {
          säg(msg, '✓ Klart. Rapporten är sparad och omskriven åt föräldern.' + varning, !varning);
        }
      } else {
        säg(msg, '✓ Rapporten är sparad. Föräldern ser den direkt.' + varning, !varning);
      }

      nollställRapport();

      await laddaPass();
      fyllPassVal();
      await Promise.all([laddaMinaRapporter(), laddaTimmar(), laddaLaxor(), laddaProgress(), laddaUpptagna()]);

      /* Rapporten är sparad och passet genomfört. Rutan står kvar en
         stund så att beskedet hinner läsas — längre om något gick
         snett på vägen och står i beskedet. */
      rapportStängs = setTimeout(stängRapport, varning ? 4500 : 1800);
    });
  });

  /* booking_id följer med för passrutan: "Från förra passet" ska
     vara rapporten FÖRE passet, aldrig passets egen, och "Efter
     passet" är just passets egen. */
  async function laddaMinaRapporter() {
    const host = $('#mina-rapporter');
    const { data, error } = await supa
      .from('lesson_reports')
      .select('id, lesson_date, raw_notes, ai_feedback, gick, amne, needs_practice, next_focus, student_id, booking_id')
      .eq('tutor_id', S.user.id).order('lesson_date', { ascending: false }).limit(20);

    if (error) { host.innerHTML = tomt('Kunde inte hämta rapporterna', felText(error)); return; }

    S.minaRapporter = data;
    ritaGickFordelning();

    if (!data.length) { host.innerHTML = tomt('Inga rapporter än', 'Den första skriver du efter ditt första pass.'); return; }

    $('#mina-rapporter-antal').textContent = data.length + ' st';
    host.innerHTML = data.map(r => {
      const e = S.elever.find(x => x.id === r.student_id);
      const g = GICK[r.gick];
      return '<div class="report">'
        + '<div class="report-head"><b>' + esc(e ? e.name : 'Elev') + '</b>'
        + (g ? '<span class="rp-marke" data-v="' + esc(r.gick) + '"><i></i>' + esc(g) + '</span>' : '')
        + (r.amne ? '<span class="rp-marke"><i></i>' + esc(r.amne) + '</span>' : '')
        + '<time>' + esc(datumText(r.lesson_date)) + '</time></div>'
        + (r.ai_feedback
            ? '<p>' + esc(r.ai_feedback) + '</p>'
            : '<span class="raw-note">Inte omskriven, föräldern ser detta</span><p class="raw">' + esc(r.raw_notes) + '</p>')
        + (r.next_focus ? '<p class="xsmall" style="margin-top:10px;color:var(--muted-2)">Nästa fokus: ' + esc(r.next_focus) + '</p>' : '')
        + (r.ai_feedback ? '' : '<button class="btn btn-ghost btn-sm" data-ai="' + r.id + '" style="margin-top:12px">Skriv om åt föräldern</button>')
        + '</div>';
    }).join('');
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-ai]');
    if (!btn) return;
    await medan(btn, 'Skriver om…', async () => {
      const { error } = await supa.functions.invoke('generate-feedback', { body: { report_id: btn.dataset.ai } });
      if (error) { alert('Gick inte: ' + felText(error) + '\n\nÄr generate-feedback deployad? Se DEPLOY-AI-FUNKTION.md.'); return; }
      await laddaMinaRapporter();
    });
  });

  /* ============================================================
     MATERIAL
     Tre sorter i samma tabell: en fil i hinken, en länk utåt, eller
     en ren anteckning. kind avgör vilket, och därmed vad raden ska
     göra när man klickar på den.
     ============================================================ */
  $('#mat-typ').addEventListener('click', e => {
    const k = e.target.closest('[data-mtyp]');
    if (!k) return;
    S.matTyp = k.dataset.mtyp;
    $$('#mat-typ button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mtyp === S.matTyp)));
    $('#mt-fil-grupp').hidden = S.matTyp !== 'fil';
    $('#mt-lank-grupp').hidden = S.matTyp !== 'lank';
    $('#mt-text-grupp').hidden = S.matTyp !== 'anteckning';
    rensa($('#mt-msg'));
  });

  $('#mt-fil').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    $('#mt-fil-namn').textContent = f ? f.name + ' · ' + M.filstorlek(f.size) : 'Ingen fil vald';
    if (f && !$('#mt-titel').value.trim()) {
      $('#mt-titel').value = f.name.replace(/\.[^.]+$/, '').slice(0, 200);
    }
  });

  $('#mat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#mt-msg');
    rensa(msg);

    const titel = $('#mt-titel').value.trim();
    const fil = ($('#mt-fil').files || [])[0];
    const länk = $('#mt-lank').value.trim();
    const text = $('#mt-text').value.trim();

    const fel = kolla([
      { fel: !S.aktivElev, text: 'Välj en elev högst upp först.' },
      { fel: !titel, text: 'Ge materialet en rubrik.', falt: $('#mt-titel') },
      { fel: S.matTyp === 'fil' && !fil, text: 'Välj en fil att ladda upp.', falt: $('#mt-fil') },
      { fel: S.matTyp === 'lank' && !länk, text: 'Klistra in adressen.', falt: $('#mt-lank') },
      { fel: S.matTyp === 'lank' && länk && !/^https?:\/\//i.test(länk),
        text: 'Adressen måste börja med http:// eller https://.', falt: $('#mt-lank') },
      { fel: S.matTyp === 'anteckning' && !text, text: 'Skriv anteckningen.', falt: $('#mt-text') },
      { fel: S.matTyp === 'fil' && fil && !!M.granskaFil(fil), text: fil ? M.granskaFil(fil) : '', falt: $('#mt-fil') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan($('#mt-spara'), S.matTyp === 'fil' ? 'Laddar upp…' : 'Sparar…', async () => {
      const rad = {
        student_id: S.aktivElev,
        tutor_id: S.user.id,
        title: titel,
        kind: S.matTyp,
        subject: $('#mt-amne').value.trim() || null
      };

      if (S.matTyp === 'fil') {
        const upp = await M.sparaMaterialfil(S.aktivElev, fil);
        if (upp.fel) { säg(msg, 'Filen kunde inte laddas upp: ' + upp.fel, false); return; }
        rad.url = upp.sökväg;
        rad.file_name = fil.name;
        rad.file_size = fil.size;
      } else if (S.matTyp === 'lank') {
        rad.url = länk;
      } else {
        rad.body = text;
      }

      const { error } = await supa.from('materials').insert(rad);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      säg(msg, '✓ Materialet har lagts till. Familjen ser det direkt.', true);
      $('#mat-form').reset();
      $('#mt-fil-namn').textContent = 'Ingen fil vald';
      await laddaMaterial();
    });
  });

  function laddaMaterial() {
    return M.laddaMaterial(S, {
      elev: S.aktivElev,
      tomElev: ['Ingen elev vald', 'Välj en elev högst upp.'],
      tomLista: ['Inget material än', 'Lägg upp ett övningsblad, en länk eller en anteckning. Familjen når det från sin vy.'],
      egen: true
    });
  }

  /* Filen ligger i en privat hink, så adressen skapas i klicket och
     slutar gälla av sig själv. */
  document.addEventListener('click', async e => {
    const öppna = e.target.closest('[data-mat-oppna]');
    if (öppna) {
      const m = (S.material || []).find(x => x.id === öppna.dataset.matOppna);
      if (!m || !m.url) return;
      await medan(öppna, 'Öppnar…', async () => {
        const url = await M.signera('material', m.url, 300);
        if (!url) { alert('Filen kunde inte öppnas. Ladda om sidan och försök igen.'); return; }
        window.open(url, '_blank', 'noopener');
      });
      return;
    }

    const bort = e.target.closest('[data-mat-bort]');
    if (!bort) return;
    const m = (S.material || []).find(x => x.id === bort.dataset.matBort);
    const ja = await bekräfta({
      titel: 'Ta bort materialet?',
      text: '"' + ((m && m.title) || 'Materialet') + '" försvinner för både dig och familjen.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(bort, 'Tar bort…', async () => {
      if (m && m.kind === 'fil' && m.url) await supa.storage.from('material').remove([m.url]);
      const { error } = await supa.from('materials').delete().eq('id', bort.dataset.matBort);
      if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
      await laddaMaterial();
    });
  });

  /* ============================================================
     DITT KONTO
     ============================================================ */
  function ritaKontoAvatar() { M.kontoAvatar(S); }

  $('#av-fil').addEventListener('change', async e => {
    const fil = (e.target.files || [])[0];
    e.target.value = '';
    if (!fil) return;
    rensa($('#av-msg'));

    const fel = M.granska(fil);
    if (fel) { säg($('#av-msg'), fel, false); return; }

    const blob = await M.beskär(fil);
    if (!blob) return;

    säg($('#av-msg'), 'Laddar upp…', true);
    const res = await M.sparaAvatar(S.user.id, blob);
    if (res.fel) { säg($('#av-msg'), 'Bilden kunde inte sparas: ' + res.fel, false); return; }

    S.minAvatar = res.url;
    ritaKontoAvatar();
    ritaHeader();
    säg($('#av-msg'), '✓ Profilbilden har uppdaterats.', true);
  });

  $('#av-bort').addEventListener('click', async () => {
    const ja = await bekräfta({
      titel: 'Ta bort profilbild?',
      text: 'Är du säker på att du vill ta bort din profilbild? Dina initialer visas i stället.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan($('#av-bort'), 'Tar bort…', async () => {
      const res = await M.taBortAvatar(S.user.id);
      if (res.fel) { säg($('#av-msg'), 'Kunde inte ta bort: ' + res.fel, false); return; }
      S.minAvatar = null;
      ritaKontoAvatar();
      ritaHeader();
      säg($('#av-msg'), '✓ Profilbilden är borttagen.', true);
    });
  });

  $('#konto-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#k-msg');
    rensa(msg);
    const namn = $('#k-namn').value.trim();
    const fel = kolla([{ fel: !namn, text: 'Vänligen fyll i ditt namn.', falt: $('#k-namn') }]);
    if (fel) { säg(msg, fel, false); return; }

    await medan(e.submitter, 'Sparar…', async () => {
      const { error } = await supa.from('profiles')
        .update({ full_name: namn, phone: $('#k-tel').value.trim() || null })
        .eq('id', S.user.id);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      S.profil.full_name = namn;
      ritaHeader();
      ritaKontoAvatar();
      säg(msg, '✓ Uppgifterna har sparats.', true);
    });
  });

  $('#losen-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#kl-msg');
    rensa(msg);
    const a = $('#k-losen').value, b = $('#k-losen2').value;
    const fel = kolla([
      { fel: !a, text: 'Skriv ett nytt lösenord.', falt: $('#k-losen') },
      { fel: a.length < 6, text: 'Lösenordet måste vara minst 6 tecken.', falt: $('#k-losen') },
      { fel: a !== b, text: 'Lösenorden är inte lika.', falt: $('#k-losen2') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan(e.submitter, 'Byter…', async () => {
      const { error } = await supa.auth.updateUser({ password: a });
      if (error) { säg(msg, felText(error), false); return; }
      $('#losen-form').reset();
      säg(msg, '✓ Lösenordet är bytt.', true);
    });
  });

  /* ============================================================
     STUDIEPLAN
     ============================================================ */
  async function laddaPlanIFormulär() {
    ['#p-amne', '#p-mal', '#p-text'].forEach(id => { $(id).disabled = !S.aktivElev; });
    if (!S.aktivElev) { $('#p-amne').value = $('#p-mal').value = $('#p-text').value = ''; return; }
    const { data } = await supa
      .from('study_plans').select('subject, goals, plan_text')
      .eq('student_id', S.aktivElev).eq('tutor_id', S.user.id)
      .order('updated_at', { ascending: false }).limit(1);
    const p = (data && data[0]) || {};
    $('#p-amne').value = p.subject || '';
    $('#p-mal').value = p.goals || '';
    $('#p-text').value = p.plan_text || '';
  }

  $('#plan-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#p-msg');
    rensa(msg);
    if (!S.aktivElev) { säg(msg, 'Välj en elev högst upp först.', false); return; }

    await medan(e.submitter, 'Sparar…', async () => {
      const fält = {
        subject: $('#p-amne').value.trim() || null,
        goals: $('#p-mal').value.trim() || null,
        plan_text: $('#p-text').value.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { data: fanns } = await supa
        .from('study_plans').select('id').eq('student_id', S.aktivElev).eq('tutor_id', S.user.id).limit(1);

      const res = (fanns && fanns.length)
        ? await supa.from('study_plans').update(fält).eq('id', fanns[0].id)
        : await supa.from('study_plans').insert(Object.assign({ student_id: S.aktivElev, tutor_id: S.user.id }, fält));

      if (res.error) { säg(msg, 'Kunde inte spara: ' + felText(res.error), false); return; }
      säg(msg, '✓ Studieplanen är sparad. Familjen ser den direkt.', true);
    });
  });

  /* ============================================================
     EGEN PROFIL

     Ämnena skrivs likadant som i bokningen och årskurserna likadant
     som matchningen läser dem — "Åk 7–9", inte "sjuan till nian".
     Matchningen tolkar siffror och ordet gymnasium, så listan här är
     det som gör att den tolkningen alltid lyckas.
     ============================================================ */
  const PR_AMNEN = ['Matematik', 'Svenska', 'Engelska',
    'NO / Fysik / Kemi / Biologi', 'SO / Historia / Samhällskunskap',
    'Moderna språk', 'Programmering'];
  const PR_ARSKURSER = ['Åk 1–3', 'Åk 4–6', 'Åk 7–9', 'Gymnasiet'];
  const PR_FORMAT = ['Online', 'På plats'];

  const PR_LISTOR = {
    'pr-amne-val':    { nyckel: 'amnen',     fasta: PR_AMNEN },
    'pr-arskurs-val': { nyckel: 'arskurser', fasta: PR_ARSKURSER },
    'pr-format-val':  { nyckel: 'format',    fasta: PR_FORMAT }
  };
  const prVal = { amnen: [], arskurser: [], format: [] };

  /* "Åk 7-9" med bindestreck och "Åk 7–9" med tankstreck är samma
     årskurser för en människa och två olika för en array. Sparade
     värden matchas därför mot listan utan hänsyn till streck,
     mellanslag och versaler, och skrivs om till listans stavning. */
  function prNyckel(v) {
    return String(v || '').toLowerCase().replace(/[\u2010-\u2015]/g, '-')
      .replace(/\s+/g, ' ').trim();
  }

  function prKanonisk(fasta, v) {
    const n = prNyckel(v);
    const träff = fasta.filter(x => prNyckel(x) === n)[0];
    return träff || v;
  }

  function ritaPrVal(id) {
    const cfg = PR_LISTOR[id];
    const valda = prVal[cfg.nyckel];
    /* Ett eget ämne som inte står i den fasta listan ska inte
       försvinna bara för att det inte var förtryckt. */
    const lista = cfg.fasta.concat(valda.filter(v => cfg.fasta.indexOf(v) === -1));
    $('#' + id).innerHTML = lista.map(v =>
      '<button type="button" data-v="' + esc(v) + '" aria-pressed="'
      + (valda.indexOf(v) !== -1 ? 'true' : 'false') + '">' + esc(v) + '</button>').join('');
  }

  function ritaAllaPrVal() { Object.keys(PR_LISTOR).forEach(id => ritaPrVal(id)); }

  Object.keys(PR_LISTOR).forEach(id => {
    $('#' + id).addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const lista = prVal[PR_LISTOR[id].nyckel];
      const i = lista.indexOf(b.dataset.v);
      if (i === -1) lista.push(b.dataset.v); else lista.splice(i, 1);
      ritaPrVal(id);
    });
  });

  function läggTillÄmne() {
    const fält = $('#pr-amne-nytt');
    const v = fält.value.trim();
    if (!v) return;
    /* jämför utan hänsyn till versaler, annars blir "spanska" och
       "Spanska" två ämnen igen — precis det fältet skulle bort från */
    const kanon = prKanonisk(PR_AMNEN, v);
    const finns = prVal.amnen.some(x => prNyckel(x) === prNyckel(kanon));
    if (!finns) prVal.amnen.push(kanon);
    fält.value = '';
    ritaPrVal('pr-amne-val');
  }

  $('#pr-amne-lagg').addEventListener('click', läggTillÄmne);
  $('#pr-amne-nytt').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); läggTillÄmne(); }
  });

  function fyllProfil() {
    const t = S.tutorProfil || {};
    $('#pr-skola').value = t.school || '';
    $('#pr-ort').value = t.city || '';
    $('#pr-bio').value = t.bio || '';
    prVal.amnen = (t.subjects || []).map(v => prKanonisk(PR_AMNEN, v));
    prVal.arskurser = (t.grade_levels || []).map(v => prKanonisk(PR_ARSKURSER, v));
    prVal.format = (t.formats || []).map(v => prKanonisk(PR_FORMAT, v));
    ritaAllaPrVal();
  }

  $('#profil-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#pr-msg');
    rensa(msg);
    await medan(e.submitter, 'Sparar…', async () => {
      const ändring = {
        school: $('#pr-skola').value.trim() || null,
        city: $('#pr-ort').value.trim() || null,
        subjects: prVal.amnen.slice(),
        grade_levels: prVal.arskurser.slice(),
        formats: prVal.format.slice(),
        bio: $('#pr-bio').value.trim() || null
      };
      const { error } = await supa.from('tutor_profiles').update(ändring).eq('id', S.user.id);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      /* Ämnena är förslagen i rapporten. Utan det här står gamla
         ämnen kvar i chipsen tills sidan laddas om. */
      Object.assign(S.tutorProfil || {}, ändring);
      fyllÄmnesval();

      säg(msg, prVal.amnen.length
        ? '✓ Profilen är sparad.'
        : '✓ Profilen är sparad. Utan ämnen kan vi inte föreslå dig för någon elev.', true);
    });
  });

  /* ============================================================
     NÄR NÅGOT GÅR SÖNDER
     Utan det här står vyn kvar på "Laddar din vy" i all evighet så
     fort en enda fråga kastar — man får varken veta vad som hände
     eller en väg vidare. Nu syns felet, och man kan försöka igen
     utan att ladda om sidan.
     ============================================================ */
  /* ============================================================
     ÖVERSIKTEN
     En sammanfattning, inte en andra kopia av vyn. Varje ruta visar
     några rader och pekar vidare med "Visa alla".

     Allt läses ur samma S som sektionerna använder. Det är med flit:
     två tillstånd hade förr eller senare glidit isär, och då hade
     Översikten visat en läxa som redan var bortplockad.
     ============================================================ */
  function kortTid(iso) { return NXStudie.kortTid(iso); }

  const tidsnyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');

  /* Samma regel som Mina lektioner och KPI:n: ett pass som redan
     börjat i morse är inte "nästa pass" i eftermiddag. */
  function nästaPass() {
    return S.bokningar.filter(ärKommande)
      .sort((a, b) => tidsnyckel(a).localeCompare(tidsnyckel(b)))[0] || null;
  }

  /* Kortet i hälsningen. Hälsningen är det första man ser, och nästa
     pass är ofta det enda man öppnade vyn för, så kortet öppnar
     passet (se klicket på #vy-hero längre ned). Länken bakom är
     reserven för den som öppnar den i en ny flik. */
  function ritaNästaPass() {
    const b = nästaPass();
    if (!S.hero) return;
    S.hero.uppdatera({
      nasta: b ? {
        href: '#lektioner/pass',
        text: 'Nästa pass · ' + datumText(b.wanted_date)
              + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
        under: [passNamn(b), b.subject].filter(Boolean).join(' · ')
      } : {
        href: '#lektioner/pass',
        text: 'Inga pass inbokade',
        under: 'Familjen bokar i sin vy. Du bekräftar här.'
      }
    });
  }

  /* ============================================================
     MINA LEKTIONER (program 2, Fas 1, P3)
     Överst på Översikt: de närmaste passen och de som har varit men
     saknar rapport. Listan "#ov-nasta" som stod här förut ritades
     till ett element som inte fanns i sidan, och var död kod.

     Raderna är samma passrad som i passlistan. Kommande pass har bara
     "Detaljer": knapparna för att bekräfta, flytta och avboka finns i
     passrutan och i passlistan, och fem rader med fyra knappar var
     är inte en översikt. De som väntar på rapport har rapportknappen,
     för det är det enda som återstår med dem.
     ============================================================ */
  const MINA_LEKTIONER = 5;

  function ritaMinaLektioner() {
    const host = $('#ov-lektioner');
    if (!host) return;
    const kommande = S.bokningar.filter(ärKommande)
      .sort((a, c) => tidsnyckel(a).localeCompare(tidsnyckel(c)));
    /* De du kan rapportera först, nyast överst. Ett pass som inte går
       att rapportera (rapportHinder) står sist med skälet: listan visar
       bara fem, och de platserna ska gå till det du kan göra något åt. */
    const väntar = S.bokningar.filter(väntarRapport)
      .sort((a, c) => (!!rapportHinder(a) - !!rapportHinder(c))
        || tidsnyckel(c).localeCompare(tidsnyckel(a)));

    const antal = $('#ov-lektioner-antal');
    if (antal) antal.textContent = kommande.length ? kommande.length + ' kommande' : '';

    if (!kommande.length && !väntar.length) {
      host.innerHTML = '<div class="empty"><b>Inga pass inbokade</b><br><span>'
        + 'Markera när du kan jobba under Dina tider. Familjen kan boka de tiderna direkt, '
        + 'och önskar de en annan tid bekräftar du den här.</span><br>'
        + '<a class="vy-mer" href="#tider">Till Dina tider '
        + '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg></a></div>';
      return;
    }

    const rad = (b, atgarder) => NXKontakt.passRad(b, {
      under: passUnder(b), vem: passVem(b), atgarder: atgarder || '', klickbar: true
    });

    let ut = kommande.length
      ? '<div class="pl-grupp">' + kommande.slice(0, MINA_LEKTIONER).map(b => rad(b)).join('') + '</div>'
        + (kommande.length > MINA_LEKTIONER
            ? '<p class="xsmall" style="margin:4px 0 0;color:var(--bl-2)">'
              + esc((kommande.length - MINA_LEKTIONER) + ' pass till ligger i passlistan.') + '</p>'
            : '')
      : '<div class="pl-inget">Inga kommande pass. Familjen bokar på tiderna du markerat under Dina tider.</div>';

    if (väntar.length) {
      /* Samma linje ovanför som "Tidigare pass" i passlistan, men utan
         att tonas ned: det här är något att göra, inte att slå upp. */
      ut += '<div class="pl-grupp" style="margin-top:clamp(18px,2.2vw,26px);'
        + 'padding-top:clamp(14px,1.8vw,18px);border-top:1px solid var(--ln)">'
        + '<div class="pl-rubrik">Väntar på rapport <em>' + väntar.length + ' st</em></div>'
        + väntar.slice(0, MINA_LEKTIONER).map(b => rad(b, rapportKnapp(b, false))).join('')
        + (väntar.length > MINA_LEKTIONER
            ? '<p class="xsmall" style="margin:4px 0 0;color:var(--bl-2)">'
              + esc((väntar.length - MINA_LEKTIONER) + ' pass till utan rapport ligger i passlistan.') + '</p>'
            : '')
        + '</div>';
    }
    host.innerHTML = ut;
  }

  /* Siffran på fliken. Läxorna ligger numera bakom en flik, och en
     flik utan siffra tvingar en att öppna den för att få veta om det
     finns något där. */
  function märkFlik(id, antal) {
    const m = $(id);
    if (!m) return;
    m.hidden = !antal;
    m.textContent = antal || '';
  }

  /* Hette ritaÖvLaxor och ritade en ruta på Översikt. Rutan är
     borta; räkningen är inte det — den styr märket på fliken och
     siffran i sidomenyn, och de ska fortfarande säga hur mycket som
     är kvar att göra. */
  function laxRakning() {
    const öppna = S.aktivElev
      ? (S.laxor || []).filter(h => h.status !== 'klar')
      : [];
    märkFlik('#flik-lax-mark', öppna.length);
    if (S.sido) S.sido.märke('laxor', öppna.length);
  }

  /* Trådlistan med det senast sagda. Skrivandet sker i Meddelanden —
     det här är vägen dit, inte en andra chatt med egen data. */
  async function ritaÖvSamtal() {
    const host = $('#ov-samtal');
    if (!host) return;

    const totalOläst = Object.values(S.olästa || {}).reduce((a, b) => a + b, 0);
    const larm = $('#ov-samtal-larm');
    larm.hidden = !totalOläst;
    larm.textContent = totalOläst ? totalOläst + ' ny' + (totalOläst > 1 ? 'a' : '') : '';
    if (S.sido) S.sido.märke('meddelanden', totalOläst);
    if (S.hero) {
      S.hero.uppdatera({
        chatt: {
          href: '#meddelanden', text: 'Meddelanden',
          under: totalOläst ? totalOläst + ' oläst' + (totalOläst > 1 ? 'a' : '') : 'Skriv till familjerna'
        }
      });
    }

    if (!S.familjer.length) {
      host.innerHTML = tomt('Ingen familj matchad än', 'Nextrum kopplar ihop dig med en familj, sedan syns tråden här.');
      return;
    }

    const res = await supa.from('messages')
      .select('parent_id, body, sender_id, created_at')
      .eq('tutor_id', S.user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (res.error) { host.innerHTML = tomt('Kunde inte hämta meddelandena', felText(res.error)); return; }

    const senaste = {};
    (res.data || []).forEach(m => { if (!senaste[m.parent_id]) senaste[m.parent_id] = m; });

    host.innerHTML = '<div class="vy-samtal">' + S.familjer.slice(0, 4).map(f => {
      const m = senaste[f.id];
      const oläst = S.olästa[f.id + '|' + S.user.id] || 0;
      const namn = f.full_name || 'Familj';
      return '<a href="#meddelanden" data-oppna-familj="' + esc(f.id) + '">'
        + M.avatar(namn, (S.avatarer || {})[f.id], { liten: true })
        + '<span class="vy-samtal-text"><b>' + esc(trådNamn(f).rubrik) + '</b><span>'
        + (m ? esc((m.sender_id === S.user.id ? 'Du: ' : '') + m.body) : 'Inga meddelanden än')
        + '</span></span>'
        + (oläst ? '<span class="oläst-prick" aria-label="' + oläst + ' olästa"></span>' : '')
        + (m ? '<span class="vy-samtal-nar">' + esc(kortTid(m.created_at)) + '</span>' : '')
        + '</a>';
    }).join('') + '</div>';
  }

  /* Ett klick i samtalslistan byter familj. Länkens href sköter
     förflyttningen till Meddelanden. */
  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-oppna-familj]');
    if (!a) return;
    const id = a.dataset.oppnaFamilj;
    if (id === S.aktivFamilj) return;
    S.aktivFamilj = id;
    S.aktivElev = null;
    S.olästa = await NXKontakt.olästa(S.user.id);
    fyllElevväljare();
    await byggFamilj();
    await byggElev();
  });

  /* ============================================================
     ERSÄTTNING
     Samma pass som familjen faktureras för, sett från andra hållet.
     Timpenningen sätts av oss, inte av studiehjälparen själv — den
     är skyddad i skydda_tutorfalt() sedan schema-v8, av samma skäl
     som beloppen inte går att skriva härifrån.
     ============================================================ */
  async function laddaErsattning() {
    const B = NXBetalning;
    const pag = $('#ers-pagaende'), lista = $('#ers-lista');
    if (!pag) return;

    const rate = S.tutorProfil && S.tutorProfil.hourly_rate;
    const timpenningOre = rate ? Math.round(Number(rate) * 100) : null;

    const [ej, ut] = await Promise.all([
      supa.from('ej_utbetalt').select('pass, minuter').eq('tutor_id', S.user.id).maybeSingle(),
      supa.from('payouts').select('id, period, status, belopp_ore, minuter, fel')
        .eq('tutor_id', S.user.id).order('period', { ascending: false })
    ]);

    const e = ej.data || { pass: 0, minuter: 0 };
    pag.innerHTML = timpenningOre
      ? B.pagaende({
          pass: e.pass, minuter: e.minuter,
          belopp_ore: Math.round((Number(e.minuter || 0) / 60) * timpenningOre),
          not: 'Räknat på ' + B.kronor(timpenningOre) + ' i timmen. Underlaget skapas när månaden är slut. '
             + 'Ett pass räknas först när du skrivit rapporten.',
          tomRubrik: 'Inget att få betalt för än',
          tomText: 'Passen räknas ihop här när du rapporterat dem.'
        })
      : tomt('Din timpenning är inte satt än',
             'Utan den går ersättningen inte att räkna ut. Hör av dig till oss så fyller vi i den.');

    if (ut.error) { lista.innerHTML = tomt('Kunde inte hämta utbetalningarna', felText(ut.error)); return; }
    const rader = ut.data || [];
    $('#ers-antal').textContent = rader.length ? rader.length + ' st' : '';

    if (!rader.length) {
      lista.innerHTML = tomt('Inga utbetalningar än', 'Den första skapas när en månad med rapporterade pass är slut.');
      return;
    }

    const linjer = await supa.from('payout_lines')
      .select('payout_id, beskrivning, minuter, belopp_ore')
      .in('payout_id', rader.map(p => p.id));
    const per = {};
    (linjer.data || []).forEach(l => { (per[l.payout_id] = per[l.payout_id] || []).push(l); });

    lista.innerHTML = rader.map(p => {
      const antal = (per[p.id] || []).length;
      return '<div class="bet-post">'
        + B.utbetalningRad(p, { under: antal ? antal + ' pass' : '' })
        + B.radLista(per[p.id])
        + '</div>';
    }).join('');
  }

  /* ============================================================
     UTBETALNINGSKONTOT (program 2, Fas 1.7, P4)

     Förut stod här att kontot låg hos Stripe och att vi bara sparade
     ett id. Stripe-kopplingen blev aldrig byggd (se nedan), och det
     stämmer inte längre: bankkonto eller Swishnummer lämnas nu HÄR,
     och sparas hos Nextrum i tabellen utbetalningsmetod. Numret är
     krypterat (pgcrypto, nyckeln i Vault) och tabellen går inte att
     läsa direkt; allt går genom funktionerna:
       las_utbetalningsmetod      maskerat: bank och fyra sista siffror
       bankkonto_kontroll         banknamnet och kontrollsiffran, live
       spara_utbetalningsmetod    stoppas i databasen när flaggan är av
       radera_utbetalningsmetod   går alltid, också med flaggan av
     Hela numret ser bara admin, och varje sådan läsning loggas.

     BAKOM FLAGGAN utbetalningsmetod, av som förval. Är den av visas
     bara att det kommer, och det man redan lämnat (med Ta bort).

     Funktionerna är inte driftsatta när den här koden skrivs; de
     väntar på ett uttryckligt ja. Ett anrop till en funktion som inte
     finns (PGRST202, 404) betyder "inte öppnat än", inte ett fel att
     visa: studiehjälparen kan ändå inte göra något åt det.
     ============================================================ */
  const UT = { flagga: false, finns: true, rad: null, redigerar: false, metod: 'bank',
    kontroll: 0, timer: null, besked: null };

  function saknasFunktion(res) {
    const e = res && res.error;
    if (!e) return false;
    return res.status === 404 || e.code === 'PGRST202' || e.code === '42883'
      || /could not find the function/i.test(String(e.message || ''));
  }

  const radUr = data => Array.isArray(data) ? (data[0] || null) : (data || null);

  async function laddaUtbetalningskonto() {
    if (!$('#ers-konto')) return;
    const [fl, las] = await Promise.all([
      supa.from('flaggor').select('aktiv').eq('kod', 'utbetalningsmetod').maybeSingle(),
      supa.rpc('las_utbetalningsmetod')
    ]);
    /* En flagga som saknas, eller inte går att läsa, är av. */
    if (fl.error) console.warn('flaggor:', fl.error.message);
    UT.flagga = !fl.error && !!(fl.data && fl.data.aktiv);

    if (las.error) {
      UT.finns = !saknasFunktion(las);
      if (UT.finns) console.warn('las_utbetalningsmetod:', las.error.message);
      UT.rad = null;
    } else {
      UT.finns = true;
      UT.rad = radUr(las.data);
    }
    UT.redigerar = false;
    ritaUtbetalningskonto();
  }

  /* "SEB, konto som slutar på 4561". Banknamnet och de fyra sista
     siffrorna är det enda som ligger i klartext, och det räcker för
     att känna igen sitt eget konto. */
  function utbetalningText(rad) {
    return rad.metod === 'swish'
      ? 'Swish, nummer som slutar på ' + (rad.slutar_pa || '')
      : (rad.bank || 'Bankkonto') + ', konto som slutar på ' + (rad.slutar_pa || '');
  }

  function ritaUtbetalningskonto() {
    const host = $('#ers-konto');
    if (!host) return;
    const öppet = UT.flagga && UT.finns;
    const besked = UT.besked;
    UT.besked = null;

    const lagring = '<p class="bet-not">Uppgifterna krypteras och syns bara för dig och för Nextrums administratör. '
      + 'Ingen utbetalning görs härifrån än.</p>';
    /* Stripe-grenen står kvar för den som ändå har ett kopplat konto
       (stripe_klar). Funktionen som kopplar ett sådant byggdes aldrig,
       så i praktiken är det raden under som syns. */
    const hur = S.tutorProfil && S.tutorProfil.stripe_klar
      ? '<p class="bet-not">Utbetalningarna går till kontot du registrerat hos Stripe. '
        + 'Vill du byta konto gör du det hos Stripe.</p>'
      : '<p class="bet-not">Utbetalningarna sköts för hand så länge. Ditt underlag nedan är det vi betalar efter. '
        + 'Hör av dig om något ser fel ut.</p>';
    const beskedHtml = besked
      ? '<p class="ok-msg show' + (besked.ok ? '' : ' is-err') + '" role="status" tabindex="-1" id="ut-besked">'
        + esc(besked.text) + '</p>'
      : '';

    let ut;
    if (!öppet) {
      ut = '<p class="bet-not" style="margin-top:0">Här kommer du att kunna lämna bankkonto eller Swishnummer '
        + 'för utbetalning. Det är inte öppnat än.</p>'
        + (UT.rad ? sparatHtml(UT.rad, false) + lagring : '');
    } else if (UT.rad && !UT.redigerar) {
      ut = sparatHtml(UT.rad, true) + lagring;
    } else {
      ut = formulärHtml() + lagring;
    }
    host.innerHTML = ut + beskedHtml + hur;

    const b = $('#ut-besked');
    if (b) b.focus({ preventScroll: true });
  }

  function sparatHtml(rad, kanÄndra) {
    return '<div style="margin-top:0">'
      + '<p style="margin:0;font-weight:600;color:var(--bl)">' + esc(utbetalningText(rad)) + '</p>'
      + (rad.metod === 'bank' && rad.kontrollerad === false
          ? '<p class="bet-not" style="display:flex;gap:8px;align-items:flex-start">'
            + NXStudie.ikon('varning')
            + '<span>Vi kunde inte kontrollera kontrollsiffran för den här banken. Dubbelkolla numret.</span></p>'
          : '')
      + (rad.uppdaterad ? '<p class="bet-not" style="margin-top:6px">Lämnat ' + esc(datumText(String(rad.uppdaterad).slice(0, 10))) + '</p>' : '')
      + '<div class="vy-knapprad">'
      + (kanÄndra ? '<button type="button" class="btn btn-ghost" data-ut-andra>Ändra</button>' : '')
      + '<button type="button" class="btn btn-ghost" data-ut-bort>Ta bort</button>'
      + '</div></div>';
  }

  function formulärHtml() {
    const bank = UT.metod === 'bank';
    return '<form id="ut-form" novalidate>'
      + '<p class="bet-not" style="margin-top:0">' + (UT.rad
          ? 'Lämna nya uppgifter. De ersätter ' + esc(utbetalningText(UT.rad)) + '.'
          : 'Lämna bankkonto eller Swishnummer för utbetalning.') + '</p>'
      + '<div class="mat-typ" role="group" aria-label="Hur vill du få betalt?" style="margin-top:12px">'
      + '<button type="button" data-ut-metod="bank" aria-pressed="' + bank + '" style="min-height:44px">Bankkonto</button>'
      + '<button type="button" data-ut-metod="swish" aria-pressed="' + !bank + '" style="min-height:44px">Swish</button>'
      + '</div>'
      + '<div id="ut-bank-falt"' + (bank ? '' : ' hidden') + '>'
      + '<div class="vy-form-rad">'
      + '<div class="pay-field"><label for="ut-clearing">Clearingnummer</label>'
      + '<input class="inp" id="ut-clearing" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="7"'
      + ' aria-describedby="ut-bank-hjalp ut-bank-svar"></div>'
      + '<div class="pay-field"><label for="ut-konto">Kontonummer</label>'
      + '<input class="inp" id="ut-konto" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="20"'
      + ' aria-describedby="ut-bank-hjalp ut-bank-svar"></div>'
      + '</div>'
      + '<p class="xsmall" id="ut-bank-hjalp" style="margin-top:8px;color:var(--bl-2);line-height:1.6">'
      + 'Clearingnumret är fyra siffror, fem för vissa Swedbankkonton. Kontonumret skrivs utan clearingnumret.</p>'
      + '<p class="xsmall" id="ut-bank-svar" role="status" aria-live="polite" style="margin-top:6px;line-height:1.6;color:var(--bl)"></p>'
      + '</div>'
      + '<div id="ut-swish-falt"' + (bank ? ' hidden' : '') + '>'
      + '<div class="fgroup" style="margin-bottom:0"><label for="ut-swish">Mobilnummer för Swish</label>'
      + '<input class="inp" id="ut-swish" type="tel" inputmode="tel" autocomplete="tel" maxlength="20"></div>'
      + '</div>'
      + '<div class="vy-knapprad">'
      + '<button type="submit" class="btn btn-primary" id="ut-spara">Spara</button>'
      + (UT.rad ? '<button type="button" class="btn btn-ghost" data-ut-avbryt>Avbryt</button>' : '')
      + '</div>'
      + '<p class="ok-msg" id="ut-msg" role="status" aria-live="polite"></p>'
      + '</form>';
  }

  /* Banknamnet medan man skriver. Väntar tills man slutat skriva en
     stund, och ett svar som kommer efter ett nyare kastas: annars kunde
     "SEB" skrivas över av svaret på clearingnumrets tre första siffror.

     Frågan ställs först när båda fälten har siffror. Med tomt konto
     svarar databasen "Fyll i kontonumret" innan den slagit upp banken,
     och det beskedet mitt i clearingfältet är bara brus. */
  function planeraKontroll() {
    clearTimeout(UT.timer);
    const svar = $('#ut-bank-svar');
    const c = String(($('#ut-clearing') || {}).value || '').replace(/\D/g, '');
    const k = String(($('#ut-konto') || {}).value || '').replace(/\D/g, '');
    if (c.length < 4 || !k) { UT.kontroll++; if (svar) svar.innerHTML = ''; return; }
    UT.timer = setTimeout(kontrolleraKonto, 450);
  }

  async function kontrolleraKonto() {
    const nr = ++UT.kontroll;
    const clearing = ($('#ut-clearing') || {}).value || '';
    const konto = ($('#ut-konto') || {}).value || '';
    const res = await supa.rpc('bankkonto_kontroll', { p_clearing: clearing, p_konto: konto });
    if (nr !== UT.kontroll) return;
    const svar = $('#ut-bank-svar');
    if (!svar) return;
    if (res.error) {
      if (saknasFunktion(res)) { UT.finns = false; ritaUtbetalningskonto(); return; }
      console.warn('bankkonto_kontroll:', res.error.message);
      svar.innerHTML = '';
      return;
    }
    const r = radUr(res.data) || {};
    /* Banken i fetstil, sedan beskedet. Ett fel har en varningsikon,
       så att det inte bara är ordvalet som skiljer det från ett ja. */
    let text = r.bank ? '<b>' + esc(r.bank) + '</b>' : '';
    const efter = t => { text += (text ? '. ' : '') + t; };
    if (r.fel) efter(NXStudie.ikon('varning') + ' ' + esc(r.fel));
    else if (r.giltigt && r.kontrollerad === false) {
      efter('Vi kan inte kontrollera kontrollsiffran för den här banken. Dubbelkolla numret.');
    } else if (r.giltigt) efter('Kontrollsiffran stämmer.');
    svar.innerHTML = text;
  }

  document.addEventListener('input', e => {
    if (e.target && (e.target.id === 'ut-clearing' || e.target.id === 'ut-konto')) planeraKontroll();
  });

  document.addEventListener('click', async e => {
    if (!e.target.closest('#ers-konto')) return;

    const metod = e.target.closest('[data-ut-metod]');
    if (metod) {
      /* Fälten göms, de ritas inte om: det man skrivit i det ena
         ligger kvar om man ångrar sig och byter tillbaka. */
      UT.metod = metod.dataset.utMetod;
      $$('#ers-konto [data-ut-metod]').forEach(k =>
        k.setAttribute('aria-pressed', String(k.dataset.utMetod === UT.metod)));
      $('#ut-bank-falt').hidden = UT.metod !== 'bank';
      $('#ut-swish-falt').hidden = UT.metod !== 'swish';
      rensa($('#ut-msg'));
      return;
    }

    if (e.target.closest('[data-ut-andra]')) {
      UT.redigerar = true;
      UT.metod = UT.rad && UT.rad.metod === 'swish' ? 'swish' : 'bank';
      ritaUtbetalningskonto();
      const f = $(UT.metod === 'bank' ? '#ut-clearing' : '#ut-swish');
      if (f) f.focus();
      return;
    }

    if (e.target.closest('[data-ut-avbryt]')) {
      UT.redigerar = false;
      ritaUtbetalningskonto();
      const k = $('#ers-konto [data-ut-andra]');
      if (k) k.focus();
      return;
    }

    const bort = e.target.closest('[data-ut-bort]');
    if (!bort) return;
    const ja = await bekräfta({
      titel: 'Ta bort utbetalningsuppgifterna?',
      text: 'Kontot eller Swishnumret du lämnat tas bort hos Nextrum.',
      knapp: 'Ta bort'
    });
    if (!ja) return;
    await medan(bort, 'Tar bort…', async () => {
      const res = await supa.rpc('radera_utbetalningsmetod');
      if (res.error && !saknasFunktion(res)) {
        UT.besked = { text: 'Kunde inte ta bort: ' + felText(res.error), ok: false };
        ritaUtbetalningskonto();
        return;
      }
      if (res.error) { UT.finns = false; ritaUtbetalningskonto(); return; }
      UT.rad = null;
      UT.redigerar = false;
      UT.besked = { text: 'Uppgifterna är borttagna.', ok: true };
      ritaUtbetalningskonto();
    });
  });

  document.addEventListener('submit', async e => {
    if (!e.target || e.target.id !== 'ut-form') return;
    e.preventDefault();
    const msg = $('#ut-msg');
    rensa(msg);

    const bank = UT.metod === 'bank';
    const clearing = bank ? $('#ut-clearing').value.trim() : '';
    const konto = bank ? $('#ut-konto').value.trim() : '';
    const swish = bank ? '' : $('#ut-swish').value.trim();
    const fel = kolla([
      { fel: bank && !clearing, text: 'Fyll i clearingnumret.', falt: $('#ut-clearing') },
      { fel: bank && !konto, text: 'Fyll i kontonumret.', falt: $('#ut-konto') },
      { fel: !bank && !swish, text: 'Fyll i mobilnumret du har Swish på.', falt: $('#ut-swish') }
    ]);
    if (fel) { säg(msg, fel, false); return; }

    await medan($('#ut-spara'), 'Sparar…', async () => {
      const res = await supa.rpc('spara_utbetalningsmetod', bank
        ? { p_metod: 'bank', p_clearing: clearing, p_konto: konto }
        : { p_metod: 'swish', p_swish: swish });
      if (res.error) {
        if (saknasFunktion(res)) { UT.finns = false; ritaUtbetalningskonto(); return; }
        /* Databasens meddelande är skrivet för människor: vilket nummer
           som är fel och varför, eller att det inte är öppnat än. */
        säg(msg, felText(res.error), false);
        return;
      }
      const rad = radUr(res.data);
      UT.rad = rad ? Object.assign({ uppdaterad: new Date().toISOString() }, rad) : UT.rad;
      UT.redigerar = false;
      UT.besked = { text: 'Sparat.', ok: true };
      ritaUtbetalningskonto();
    });
  });

  /* Här satt hanteraren för "Koppla utbetalningskonto". Den anropade
     edge-funktionen stripe-konto, som aldrig blev byggd, så knappen
     kunde bara misslyckas. Båda är borttagna tills funktionen finns —
     återställningen är knappen plus det här anropet:

       supa.functions.invoke('stripe-konto', { body: { retur: location.href } })

     Se steg 7 i DEPLOY-BETALNING.md. */

  /* ============================================================
     MINA ELEVER
     Rullgardinen i kontextraden visar bara den valda familjens barn.
     Listan här visar alla, och söker på det man faktiskt minns: ett
     namn, ett ämne, en skola. Väljer man en elev ur en annan familj
     byter den familj också — annars vore det två handgrepp för en
     sak, och det är just sådant den här ombyggnaden ska bort med.
     ============================================================ */
  function elevTräffar() {
    const fält = $('#elev-sok');
    const q = ((fält && fält.value) || '').trim().toLowerCase();
    if (!q) return S.elever;
    return S.elever.filter(e => {
      const familj = S.familjer.find(f => f.id === e.parent_id);
      return [e.name, e.grade, e.school, (e.subjects || []).join(' '),
              familj && familj.full_name]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }

  function ritaElevLista() {
    const host = $('#elev-lista');
    if (!host) return;
    $('#elever-antal').textContent = S.elever.length ? S.elever.length + ' st' : '';

    if (!S.elever.length) {
      host.innerHTML = tomt('Inga elever än',
        'Nextrum kopplar ihop dig med en elev. Då syns eleven här.');
      return;
    }
    const träff = elevTräffar();
    if (!träff.length) {
      host.innerHTML = tomt('Ingen elev matchar', 'Prova ett annat ord, eller töm sökrutan.');
      return;
    }

    host.innerHTML = '<div class="elev-lista">' + träff.map(e => {
      const familj = S.familjer.find(f => f.id === e.parent_id);
      const under = [e.grade, e.school, familj && (familj.full_name || '').split(' ')[0]]
        .filter(Boolean).join(' · ');
      /* Läxsiffran finns bara för den valda eleven — S.laxor rymmer
         en elev i taget, och att hämta alla vore en fråga per rad. */
      const öppna = e.id === S.aktivElev
        ? (S.laxor || []).filter(h => h.status !== 'klar').length : 0;
      return '<button type="button" class="elev-kort" data-elev="' + esc(e.id) + '"'
        + ' aria-pressed="' + (e.id === S.aktivElev) + '">'
        + M.avatar(e.name, null, { liten: true })
        + '<span class="elev-kort-text"><b>' + esc(e.name) + '</b>'
        + (under ? '<span>' + esc(under) + '</span>' : '') + '</span>'
        + (öppna ? '<span class="elev-kort-tal">' + öppna + ' läx'
                 + (öppna > 1 ? 'or' : 'a') + '</span>' : '')
        + '</button>';
    }).join('') + '</div>';
  }

  /* Det man vill veta innan ett pass, samlat: hur många pass som
     ligger framför, hur många som är gjorda, vad som är olöst. */
  function ritaElevOversikt() {
    const host = $('#elev-oversikt');
    if (!host) return;
    const e = elev();
    $('#elev-lage-vem').textContent = e ? (e.name || '').split(' ')[0] : '';
    if (!e) {
      host.innerHTML = tomt('Ingen elev vald', 'Välj en elev i listan bredvid.');
      return;
    }

    const hens = S.bokningar.filter(b => b.student_id === e.id);
    const kommande = hens.filter(ärKommande)
      .sort((a, b) => tidsnyckel(a).localeCompare(tidsnyckel(b)));
    const tidigare = hens
      .filter(b => b.status === 'completed')
      .sort((a, b) => tidsnyckel(b).localeCompare(tidsnyckel(a)));
    const öppna = (S.laxor || []).filter(h => h.status !== 'klar').length;

    /* Raderna öppnar passet, som i passlistan. Här står man och
       läser på inför ett pass, och det man vill se då är just det
       passets förberedelse och förra rapporten. */
    const rad = b => NXKontakt.passRad(b, {
      under: [b.format, b.location, NXStudie.längdText(b.duration_min || 60)].filter(Boolean).join(' · '),
      klickbar: true
    });

    host.innerHTML =
        '<div class="elev-tal">'
      + '<div><b>' + kommande.length + '</b><span>Kommande pass</span></div>'
      + '<div><b>' + tidigare.length + '</b><span>Genomförda pass</span></div>'
      + '<div><b>' + öppna + '</b><span>Öppna läxor</span></div>'
      + '<div><b>' + (S.progressAntal || 0) + '</b><span>Kunskapsområden</span></div>'
      + '</div>'
      + '<p class="elev-rubrik">Kommande</p>'
      + (kommande.length
          ? kommande.slice(0, 3).map(rad).join('')
          : '<div class="empty" style="padding:16px 0">Inga inbokade pass.</div>')
      + '<p class="elev-rubrik">Tidigare</p>'
      + (tidigare.length
          ? tidigare.slice(0, 3).map(rad).join('')
          : '<div class="empty" style="padding:16px 0">Inga genomförda pass än.</div>');
  }

  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'elev-sok') ritaElevLista();
  });

  document.addEventListener('click', e => {
    const kort = e.target.closest('[data-elev]');
    if (kort) väljElev(kort.dataset.elev);
  });

  /* Byt aktiv elev, och familj om eleven hör till en annan. Används
     också av rapportrutan, så att listorna i den (passväljaren,
     ämnena, kunskapsområdena) gäller passets elev. Vilken elev
     rapporten SPARAS på avgörs inte här, utan av passet (hål 3).

     Familjen byts bara om den finns bland dina. En elev vars familj
     är kopplad till en annan studiehjälpare har ingen tråd du kan
     skriva i, och att byta dit hade lämnat chatten på en familj den
     inte kan visa. */
  async function väljElev(id) {
    if (!id || id === S.aktivElev) return;
    const vald = S.elever.find(x => x.id === id);
    if (!vald) return;

    const bytFamilj = familjSyns(vald.parent_id) && vald.parent_id !== S.aktivFamilj;
    if (bytFamilj) S.aktivFamilj = vald.parent_id;
    S.aktivElev = id;

    if (bytFamilj) {
      S.olästa = await NXKontakt.olästa(S.user.id);
      fyllElevväljare();
      S.aktivElev = id;
      $('#elev-val').value = id;
      await byggFamilj();
    } else {
      $('#elev-val').value = id;
    }
    await byggElev();
  }

  /* ============================================================
     STATISTIK
     Allt räknas ur S.bokningar, alltså ur riktiga pass. Ingen siffra
     här är påhittad eller uppskattad — står det 12 så finns det tolv
     rapporterade pass i databasen.

     "Aktiv elev" betyder ett pass de senaste 60 dagarna, framåt eller
     bakåt. En elev som haft uppehåll över sommaren ska inte räknas
     som borta, men en som slutat i våras ska inte räknas som kvar.
     ============================================================ */
  var AKTIV_DAGAR = 60;

  /* Samma lägen och samma färger som i rapportformuläret. Ett
     omdöme ska se likadant ut där man sätter det och där man
     räknar på det. */
  const GICK_LAGEN = [
    ['mycket_bra', 'Mycket bra', 'ar-bra'],
    ['bra', 'Bra', 'ar-mitten'],
    ['folja_upp', 'Behöver följas upp', 'ar-folj']
  ];

  function ritaGickFordelning() {
    const rapporter = S.minaRapporter || [];
    /* Rapporter skrivna innan omdömet fanns har gick = null, och
       antalet i rubriken säger hur många som faktiskt ligger bakom
       stapeln. En andel av ingenting är inte en andel. */
    const medOmdome = rapporter.filter(r => r.gick);
    const märke = $('#stat-gick-antal');
    if (märke) {
      märke.textContent = medOmdome.length
        ? medOmdome.length + ' av ' + rapporter.length + ' rapporter'
        : '';
    }
    NXStudie.fordelning({
      host: $('#stat-gick'),
      lagen: GICK_LAGEN,
      rader: rapporter,
      av: r => r.gick,
      tom: rapporter.length
        ? 'Rapporterna hittills skrevs innan omdömet fanns. Nästa pass syns här.'
        : 'Ingen rapport än. Den första skriver du efter ditt första pass.'
    });
  }

  function ritaStatistik() {
    const tal = $('#stat-tal'), graf = $('#stat-graf');
    if (!tal) return;
    ritaGickFordelning();

    const genomforda = S.bokningar.filter(b => b.status === 'completed');
    const minuter = genomforda.reduce((a, b) => a + Number(b.duration_min || 60), 0);

    const grans = new Date();
    grans.setDate(grans.getDate() - AKTIV_DAGAR);
    const gransIso = isoFor(grans);
    const aktiva = new Set(
      S.bokningar
        .filter(b => b.status !== 'cancelled' && b.wanted_date >= gransIso && b.student_id)
        .map(b => b.student_id)
    );

    tal.innerHTML = '<div class="stat-tal">'
      + '<div><b>' + genomforda.length + '</b><span>Genomförda pass</span></div>'
      + '<div><b>' + NXBetalning.timmar(minuter).replace(' h', '') + '</b><span>Undervisade timmar</span></div>'
      + '<div><b>' + S.elever.length + '</b><span>Elever</span></div>'
      + '<div><b>' + aktiva.size + '</b><span>Aktiva elever</span></div>'
      + '</div>';

    /* Sex månader bakåt, alltid sex staplar även när några är tomma.
       Själva ritandet ligger i NXArbete sedan Fas 9.3 — samma kod
       låg i tre vyer och hade redan börjat glida isär. */
    const månader = NXArbete.sexMånader();
    genomforda.forEach(b => {
      const nyckel = String(b.wanted_date || '').slice(0, 7);
      const m = månader.find(x => x.nyckel === nyckel);
      if (m) m.antal++;
    });

    NXArbete.graf(graf, månader, {
      nagot: 'Bara rapporterade pass räknas. Skriver du rapporten senare flyttas passet till den månad det hölls, inte den månad du skrev.',
      inget: 'Inga rapporterade pass än. Grafen fylls i när du skrivit din första rapport.'
    });
  }

  /* ============================================================
     SCHEMAT
     Bokningsväljaren svarar på "när kan vi ses?". Schemat svarar på
     "vad ligger redan?". Båda läser S.bokningar, så en flytt syns i
     båda utan att något behöver hållas i synk.
     ============================================================ */
  /* Teckenförklaringen och tidslinjen (program 2, Fas 1, P2). Vecko-
     och dagvyn ritar då också timmarna runt passen: lediga inom Dina
     tider och ej tillgängliga utanför, med ikon och ord.

     Upptagna skickas med fast alla dina pass redan står i schemat.
     Schemat hoppar över timmar som ett eget pass täcker, så svaret
     ändrar bara något om de två hämtningarna glidit isär. */
  function byggSchema() {
    NXStudie.schemaI(S, {
      namn: passNamn,
      onOppna: b => öppnaPass(b.id),
      teckenforklaring: true,
      tillgang: S.tillgangHämtad ? S.tillgang : null,
      upptagna: S.upptagna
    });
  }

  /* Tiderna kommer i egna hämtningar, ofta efter att schemat ritats. */
  function schemaTider() {
    if (S.schema) S.schema.sättTider(S.tillgangHämtad ? S.tillgang : null, S.upptagna);
  }

  /* ============================================================
     PASSRUTAN (program 2, Fas 1, P1)

     Ett pass öppnas från fem ställen: passlistan, Mina lektioner,
     Elevens läge, schemat och kortet i hälsningen. Alla går hit, och
     alla har samma knappar som raden (passKnappar).

     Rutan visar det man behöver inför och efter passet:
       · tid, längd, ämne, elev, familj och plats
       · Inför passet: vad som ska göras och länken till mötet, med
         formuläret när databasen säger att du får ändra
         (far_forbereda_passet)
       · Från förra passet: din senaste rapport för samma elev före
         passets datum
       · Studieplanen: målet för passets elev
       · Öppna läxor för passets elev (inte den valda eleven)
       · Efter passet: passets egen rapport, för ett genomfört pass

     Allt hämtas innan rutan öppnas. En ruta som fylls på medan man
     läser hoppar under fingret.
     ============================================================ */
  let passÖppnas = false;
  /* Den öppna rutan, för formulärets knappar. Ett id per ruta: en
     sparning som svarar efter att rutan bytts ska inte skriva i nästa. */
  let passRutan = null;

  async function öppnaPass(id, händelse) {
    if (passÖppnas) return;
    const b = (S.bokningar || []).find(x => String(x.id) === String(id));
    if (!b) return;
    passÖppnas = true;
    const knapp = händelse && händelse.target && händelse.target.closest
      ? händelse.target.closest('[data-pass-oppna]') : null;
    try {
      await medan(knapp, 'Öppnar…', () => visaPass(b));
    } catch (fel) {
      console.warn('Passet kunde inte öppnas:', fel);
    } finally {
      passÖppnas = false;
    }
  }

  /* Raderna i listorna. passKlick sitter på behållaren, som finns i
     sidan från början; listorna ritas om inuti den. */
  ['#pass-lista', '#ov-lektioner', '#elev-oversikt'].forEach(sel => {
    NXKontakt.passKlick($(sel), (id, händelse) => öppnaPass(id, händelse));
  });

  /* Kortet "Nästa pass" i hälsningen. Kortet ritas av NXArbete.hero
     som en länk; här blir klicket passrutan i stället. Ett klick med
     Cmd eller Ctrl får göra det länkar gör. */
  document.addEventListener('click', e => {
    const a = e.target.closest('#vy-hero .vy-hero-kort a');
    if (!a || !a.querySelector('.vy-hero-prick')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    const b = nästaPass();
    if (!b) return;
    e.preventDefault();
    öppnaPass(b.id);
  });

  async function fårFörbereda(passId) {
    const { data, error } = await supa.rpc('far_forbereda_passet', { p_pass: passId });
    if (error) { console.warn('far_forbereda_passet:', error.message); return false; }
    return data === true;
  }

  /* { ok, rad }. ok är false när frågan misslyckades: då visas varken
     blocket eller formuläret, för ett tomt formulär över en
     förberedelse som finns hade skrivit över den vid nästa sparning. */
  async function hämtaFörberedelse(passId) {
    const { data, error } = await supa.from('pass_forberedelse')
      .select('att_gora, lank').eq('booking_id', passId).maybeSingle();
    if (error) { console.warn('pass_forberedelse:', error.message); return { ok: false, rad: null }; }
    return { ok: true, rad: data || null };
  }

  async function hämtaPlan(elevId) {
    const { data, error } = await supa.from('study_plans')
      .select('subject, goals')
      .eq('student_id', elevId).eq('tutor_id', S.user.id)
      .order('updated_at', { ascending: false }).limit(1);
    if (error) { console.warn('study_plans:', error.message); return null; }
    return (data && data[0]) || null;
  }

  /* Hämtas per pass, inte ur S.laxor: den rymmer bara den valda
     elevens läxor, och passet kan gälla en annan. */
  async function hämtaÖppnaLäxor(elevId) {
    const { data, error } = await supa.from('homework')
      .select('id, title, due_date, status, student_id')
      .eq('student_id', elevId).neq('status', 'klar')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5);
    if (error) { console.warn('homework:', error.message); return []; }
    return data || [];
  }

  /* Passets egen rapport. Oftast bland de tjugo senaste; annars
     hämtas den, för ett pass från i våras ska också gå att läsa. */
  async function rapportFör(b) {
    const r = (S.minaRapporter || []).find(x => x.booking_id === b.id);
    if (r) return r.ai_feedback || r.raw_notes || null;
    const { data, error } = await supa.from('lesson_reports')
      .select('ai_feedback, raw_notes').eq('booking_id', b.id)
      .order('created_at', { ascending: false }).limit(1);
    if (error) { console.warn('lesson_reports:', error.message); return null; }
    const d = data && data[0];
    return d ? (d.ai_feedback || d.raw_notes || null) : null;
  }

  /* Din senaste rapport för samma elev FÖRE passets datum, och aldrig
     passets egen. S.minaRapporter är sorterad med den nyaste först. */
  function förraRapport(b) {
    if (!b.student_id) return null;
    const r = (S.minaRapporter || []).find(x =>
      x.student_id === b.student_id && x.booking_id !== b.id
      && String(x.lesson_date || '') < String(b.wanted_date || ''));
    return r ? { datum: r.lesson_date, next_focus: r.next_focus, needs_practice: r.needs_practice } : null;
  }

  /* "Torsdag 24 september, kl. 16:00 till 17:00". Veckodagen står med:
     det är den man planerar sin vecka efter. */
  function passTid(b) {
    const dag = b.wanted_date ? DAGNAMN[veckodagFör(b.wanted_date)] + ' ' + datumText(b.wanted_date) : '';
    const h = parseInt(String(b.wanted_time || ''), 10);
    if (isNaN(h)) return dag;
    const n = Math.max(1, Math.ceil((Number(b.duration_min) || 60) / 60));
    return dag + ', kl. ' + String(b.wanted_time).slice(0, 5) + ' till ' + tvåsiff(h + n) + String(b.wanted_time).slice(2, 5);
  }

  /* Två block som passRuta inte har: studieplanen och läxorna. De
     ritas med rutans egna klasser och läggs in före knapparna. */
  function planBlock(plan) {
    const mål = plan && plan.goals ? String(plan.goals).trim() : '';
    return '<div class="pass-block"><h6>Studieplanen</h6>'
      + (mål
          ? '<p>' + esc((plan.subject ? plan.subject + ': ' : '') + mål) + '</p>'
          : '<p class="pass-tom">Inga mål i studieplanen än. Du skriver dem under Plan och utveckling.</p>')
      + '</div>';
  }

  function läxBlock(läxor) {
    const idag = isoFor(new Date());
    return '<div class="pass-block"><h6>Öppna läxor</h6>'
      + (läxor.length
          ? läxor.map(h => '<div class="pass-lank">' + esc(h.title)
              + (h.due_date
                  ? '<span>' + esc(h.due_date < idag
                      ? 'Skulle vara klar ' + NXStudie.deadlineText(h.due_date).toLowerCase()
                      : 'Till ' + NXStudie.deadlineText(h.due_date).toLowerCase()) + '</span>'
                  : '')
              + '</div>').join('')
          : '<p class="pass-tom">Inga öppna läxor.</p>')
      + '</div>';
  }

  async function visaPass(b) {
    const e = S.elever.find(x => x.id === b.student_id) || null;
    const f = S.familjer.find(x => x.id === b.parent_id) || null;
    const l = NXStudie.STATUS[b.status] || { text: b.status };
    const kan = b.status === 'requested' || b.status === 'confirmed';
    /* Förberedelse, plan och läxor gäller en elev du är matchad med.
       Ett pass utan elev, eller med en elev som inte längre är din,
       har inget av det att visa. */
    const minElev = !!e;

    /* Formuläret "Förbered passet" hör till pass som ligger framåt.
       Databasen (far_forbereda_passet) frågar bara om status och
       elev, inte om datum, så ett pass som väntar på rapport fick
       formuläret med "Familjen ser det du skriver här när den öppnar
       passet". Inför ett pass som redan hållits finns inget att säga;
       det som skrevs före står kvar att läsa. */
    const [får, forb, plan, läxor, efter] = await Promise.all([
      kan && minElev && ärKommande(b) ? fårFörbereda(b.id) : false,
      hämtaFörberedelse(b.id),
      minElev ? hämtaPlan(b.student_id) : null,
      minElev ? hämtaÖppnaLäxor(b.student_id) : [],
      b.status === 'completed' ? rapportFör(b) : null
    ]);

    const bokadAv = !b.created_by ? null
      : b.created_by === S.user.id ? 'Du'
      : b.created_by === b.parent_id ? 'Familjen' : 'Nextrum';

    const api = NXStudie.passRuta({
      id: b.id,
      titel: b.subject || 'Pass',
      under: passTid(b),
      langd: b.duration_min || 60,
      rader: [
        ['Status', l.text],
        ['Elev', e ? e.name : (b.student_id ? 'Inte kopplad till dig längre' : UTAN_ELEV)],
        ['Familj', f ? (f.full_name || f.email) : null],
        ['Format', b.format],
        ['Plats', b.location],
        ['Bokades av', bokadAv],
        ['Närvaro', b.attendance === 'franvarande' ? 'Uteblev'
                  : b.attendance === 'sen' ? 'Kom sent'
                  : b.attendance === 'narvarande' ? 'Närvarande' : null]
      ],
      /* Blocket "Inför passet" syns för ett pass som ska hållas och
         inte har börjat, även tomt, så att det står att inget är
         förberett. Ett pass som varit visar det bara om något faktiskt
         skrevs: "Inget förberett än" om i går är inget besked. */
      forberedelse: forb.ok ? forb.rad : undefined,
      forberedelseTom: forb.ok && ärKommande(b) && b.student_id ? 'Inget förberett än.' : undefined,
      forberedelseForm: får && forb.ok ? (forb.rad || true) : undefined,
      anteckning: b.note,
      forraRapport: förraRapport(b),
      rapport: efter,
      atgarder: passKnappar(b, true)
    });

    if (minElev) {
      const knappar = api.ruta.querySelector('.nx-fraga-knappar');
      if (knappar) knappar.insertAdjacentHTML('beforebegin', planBlock(plan) + läxBlock(läxor));
    }
    passRutan = { id: String(b.id), api: api };
  }

  /* ---------- formuläret "Förbered passet" ----------
     Rutan sparar inte själv; den lämnar knapparna hit. Samma regel
     för länken som villkoret i databasen prövas först här, så att ett
     stavfel får ett svar direkt i stället för efter en tur till
     servern. Databasen är ändå skyddet: dess fel visas som det är. */
  function förberedelseFel(error) {
    if (error.code === '23514') {
      return /att_gora/.test(String(error.message || ''))
        ? 'Att göra får vara högst 1000 tecken.'
        : NXStudie.MÖTESLÄNK_FEL;
    }
    /* RLS svarar på engelska. Det händer när passet hunnit bli
       genomfört eller avbokat, eller eleven bytt studiehjälpare. */
    if (error.code === '42501') return 'Du kan inte ändra förberedelsen för det här passet längre.';
    return felText(error);
  }

  document.addEventListener('click', async e => {
    const spara = e.target.closest('[data-forb-spara]');
    const bort = e.target.closest('[data-forb-ta-bort]');
    if (!spara && !bort) return;
    const id = (spara || bort).getAttribute(spara ? 'data-forb-spara' : 'data-forb-ta-bort');
    const r = passRutan && passRutan.id === id ? passRutan.api : null;
    const form = (spara || bort).closest('[data-forb-form]');
    if (!r || !form) return;

    if (spara) {
      const göraFält = form.querySelector('[data-forb-gora]');
      const länkFält = form.querySelector('[data-forb-lank]');
      const gora = (göraFält.value || '').trim();
      const lank = (länkFält.value || '').trim();
      if (!gora && !lank) {
        r.säg('Skriv vad passet ska handla om, eller klistra in länken till mötet.', false);
        göraFält.focus();
        return;
      }
      if (gora.length > 1000) { r.säg('Att göra får vara högst 1000 tecken.', false); göraFält.focus(); return; }
      if (lank && !NXStudie.mötesLänkOk(lank)) { r.säg(NXStudie.MÖTESLÄNK_FEL, false); länkFält.focus(); return; }

      await medan(spara, 'Sparar…', async () => {
        const { data, error } = await supa.from('pass_forberedelse')
          .upsert({ booking_id: id, att_gora: gora || null, lank: lank || null }, { onConflict: 'booking_id' })
          .select('att_gora, lank').maybeSingle();
        if (!passRutan || passRutan.api !== r) return;
        if (error) { r.säg('Kunde inte spara: ' + förberedelseFel(error), false); return; }
        r.sättForberedelse(data || { att_gora: gora || null, lank: lank || null });
        r.säg('Sparat. Familjen ser det när den öppnar passet.', true);
      });
      return;
    }

    const ja = await bekräfta({
      titel: 'Ta bort förberedelsen?',
      text: 'Det du skrivit inför passet och länken till mötet försvinner, också för familjen.',
      knapp: 'Ta bort'
    });
    if (!ja) return;
    await medan(bort, 'Tar bort…', async () => {
      /* select() efter delete: en rad som RLS inte släpper igenom
         tas inte bort, och det ger inget fel. Utan svaret hade rutan
         sagt "borttagen" om något som ligger kvar. */
      const { data, error } = await supa.from('pass_forberedelse')
        .delete().eq('booking_id', id).select('booking_id');
      if (!passRutan || passRutan.api !== r) return;
      if (error) { r.säg('Kunde inte ta bort: ' + förberedelseFel(error), false); return; }
      if (!data || !data.length) {
        r.säg('Förberedelsen gick inte att ta bort. Ladda om sidan och försök igen.', false);
        return;
      }
      r.sättForberedelse(null);
      r.säg('Förberedelsen är borttagen.', true);
    });
  });

  function visaFel(fel, sammanhang) { NXStudie.felvy(visa, fel, sammanhang); }

  const felKnapp = $('#fel-igen');
  if (felKnapp) {
    felKnapp.addEventListener('click', () => {
      visa('view-loading');
      start();
    });
  }

  /* Ett fel som ingen fångat ska inte heller lämna vyn tom. */
  window.addEventListener('unhandledrejection', e => {
    if ($('#view-loading') && !$('#view-loading').hidden) visaFel(e.reason, 'vyn skulle hämtas');
  });

  /* ============================================================
     START
     ============================================================ */
  async function start() {
   try {
    $('#r-datum').value = isoFor(new Date());

    if (!supa) {
      visa('view-auth');
      ritaAuth();
      säg($('#auth-msg'), 'Databasen är inte kopplad än. Öppna nextrum-config.js, klistra in din Supabase-URL och anon-nyckel, spara och ladda om.', false);
      return;
    }

    S.user = await NX.hämtaSession();
    if (!S.user) { visa('view-auth'); ritaAuth(); return; }

    S.profil = await NX.hämtaProfil(S.user.id);
    ritaHeader();

    if (!S.profil) {
      visa('view-auth');
      ritaAuth();
      säg($('#auth-msg'), 'Kontot finns men saknar profil i databasen. Har du kört schema.sql i Supabase?', false);
      return;
    }

    if (S.profil.role !== 'tutor') { visa('view-wrongrole'); return; }

    const tp = await supa.from('tutor_profiles')
      .select('status, school, city, subjects, grade_levels, formats, bio, age, hourly_rate')
      .eq('id', S.user.id).maybeSingle();
    S.tutorProfil = tp.data;

    /* Stripe-kolumnerna hämtas för sig, med flit. De kommer med
       schema-v8, och innan det är kört svarar frågan med fel. Låg de
       i selecten ovan skulle hela profilen bli null och varenda
       studiehjälpare mötas av "ditt konto saknar en profil" — en vy
       som är låst för att en betalfunktion inte är driftsatt än. */
    if (S.tutorProfil) {
      const st = await supa.from('tutor_profiles')
        .select('stripe_account_id, stripe_klar').eq('id', S.user.id).maybeSingle();
      if (st.data) Object.assign(S.tutorProfil, st.data);
    }

    if (!S.tutorProfil) {
      visa('view-pending');
      $('#pending-text').textContent = 'Ditt konto saknar en studiehjälparprofil i databasen. Det brukar betyda att kontot skapades innan schema.sql kördes. Hör av dig så fixar vi det.';
      return;
    }

    if (S.tutorProfil.status !== 'approved') {
      visa('view-pending');
      if (S.tutorProfil.status === 'rejected') {
        $('#pending-text').textContent = 'Din ansökan gick tyvärr inte vidare den här gången. Hör gärna av dig om du vill veta mer.';
      }
      return;
    }

    visa('view-app');

    /* Tjänstekatalogen först. Bokningen skriver `tjanst` på varje
       rad, och passlistan märker ut den när fler än en tjänst är
       aktiv — båda behöver katalogen innan de ritar något. */
    await NXTjanster.ladda();

    /* Flikarna först. Sidomenyn och hash-översättningen ropar på dem
       när de byter sektion, och en flikrad som inte finns än hade
       svalt det anropet. */
    S.flikar = {
      lektioner: NXArbete.flikar($('section[data-sek="lektioner"]')),
      /* Dina tider står inte här: sektionen är en enda kalender,
         utan flikar. */
      laxor: NXArbete.flikar($('section[data-sek="laxor"]')),
      statistik: NXArbete.flikar($('section[data-sek="statistik"]')),
      profil: NXArbete.flikar($('section[data-sek="profil"]'))
    };

    /* Pilarna som står i markupen läses av en gång här, så ett sparat
       läge syns direkt och inte först vid första klicket. */
    NXArbete.fallStall($('#view-app'));

    /* Elevraden hör bara hemma där innehållet faktiskt gäller en
       vald elev eller familj. På Översikt och kontosidorna är den
       250px brus överst — precis den scrollning menyn ska bort med. */
    const MED_KONTEXT = ['laxor', 'lektioner', 'tider', 'meddelanden'];
    S.sido = NXStudie.sidomeny({
      fall: 'larare',
      nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt',
      onByt: sek => { $('.vy-kontext').hidden = MED_KONTEXT.indexOf(sek) === -1; }
    });

    /* De fem sektioner som slogs ihop hade egna adresser. Bokmärken
       och "visa alla"-raderna inne i vyn pekar på dem, så de översätts
       i stället för att gå sönder: #material blir sektionen Läxor &
       material med materialfliken framme.

       Formen är #sektion/flik. Sidomenyn läser delen före
       snedstrecket, den här funktionen resten. */
    const ALIAS = {
      elever: ['lektioner', 'elever'],
      studieplan: ['lektioner', 'plan'],
      rapport: ['lektioner', 'pass'],
      material: ['laxor', 'material'],
      ersattning: ['statistik', 'ersattning'],
      installningar: ['profil', 'konto'],
      /* Vänt håll sedan sektionen bytte namn. Den hette Kalender,
         heter Dina tider, och #kalender är bokmärkt hos dem som
         använde den förut — plus att gamla länkar i vyn pekade dit.
         Aliaset får dem att landa rätt i stället för på en tom sida.
         Det som INTE går är att låta båda finnas: ett alias som
         pekar på sig självt blir en oändlig omdirigering. */
      kalender: ['tider']
    };
    function följHash() {
      const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
      const alias = ALIAS[huvud];
      if (alias) { location.replace('#' + alias[0] + (alias[1] ? '/' + alias[1] : '')); return; }
      if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
    }
    window.addEventListener('hashchange', följHash);
    följHash();

    /* ============ HÄLSNINGEN ============ */
    S.hero = NXArbete.hero({
      host: $('#vy-hero'),
      namn: S.profil.full_name,
      etikett: 'Studiehjälparvy',
      lede: 'Dina pass, dina elever och vad du tjänat.',
      video: 'bilder/hero-studievy.mp4',
      bild: 'bilder/hero-nextrum-1280.jpg',
      marke: { text: 'Studiehjälpare', ikon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h7v12H4z"/><path d="M13 6.5h7v12h-7z"/><path d="M11 9.5h2M11 13h2"/></svg>' },
      chatt: { href: '#meddelanden', text: 'Meddelanden', under: 'Skriv till familjerna' }
    });

    fyllProfil();

    if (S.profil.avatar_url) S.minAvatar = await M.signera('avatarer', S.profil.avatar_url);
    $('#k-namn').value = S.profil.full_name || '';
    $('#k-tel').value = S.profil.phone || '';
    ritaKontoAvatar();
    ritaHeader();

    await laddaFamiljer();
    S.avatarer = await M.avatarKarta(S.familjer.map(f => f.id));
    S.olästa = await NXKontakt.olästa(S.user.id);
    await laddaElever();
    await laddaSenaste();
    fyllElevväljare();
    await laddaPass();
    await byggFamilj();
    await byggElev();
    await laddaTider();
    await Promise.all([laddaMinaRapporter(), laddaTimmar(), laddaUpptagna()]);
    ritaNotiser();
    await Promise.all([ritaÖvSamtal(), laddaErsattning(), laddaUtbetalningskonto()]);
    /* Stämpla besöket sist, eftersom notiserna räknas mot den förra.
       await är inte kosmetiskt: supabase-js skickar frågan först när
       någon väntar på svaret. Utan det skrevs stämpeln aldrig, och
       adminvyn sa "aldrig inloggad" om alla. */
    await supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
