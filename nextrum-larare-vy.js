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
    minAvatar: null, tillgang: [], blockerade: [],
    laxor: [], laxFilter: 'attgora', laxräkning: {}, minaRapporter: [], avatarer: {}, sido: null, progress: [], progressAntal: 0, schema: null,
    senaste: {}
  };

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
     Familjerna hämtas ur profiles, inte ur students: en familj kan
     vara matchad innan de lagt in sitt barn, och då måste du kunna
     skriva till dem och fråga varför.
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

  async function laddaElever() {
    const { data, error } = await supa
      .from('students')
      .select('id, name, grade, school, goals, subjects, parent_id')
      .order('created_at');
    if (error) { console.warn(error.message); return; }
    S.elever = data || [];
    $('#kpi-elever').textContent = S.elever.length;
    ritaStatistik();
  }

  /* Elevlistan visar bara den familj man jobbar med just nu. */
  function minaElever() {
    return S.elever.filter(e => !S.aktivFamilj || e.parent_id === S.aktivFamilj);
  }

  function fyllElevväljare() {
    const mina = minaElever();
    const val = $('#elev-val');

    if (!mina.length) {
      val.innerHTML = '<option value="">Ingen elev tillagd än</option>';
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
    const idag = isoFor(new Date());
    return (S.bokningar || [])
      .filter(b => b.student_id === elevId && b.wanted_date >= idag && b.status !== 'cancelled')
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
      host.innerHTML = '<div class="empty" style="margin-top:14px"><b>Ingen elev än</b>'
        + '<br><span>Familjen lägger in sitt barn i sin vy. Skriv till dem om det dröjer.</span></div>';
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
     jobbar med och tänker på — familjens namn säger inget den som har
     tre elever, och två av dem kan ha föräldrar med samma efternamn.
     Eleven står därför först, föräldern under. Har familjen inte lagt
     in sitt barn än står föräldern kvar som rubrik. */
  function trådNamn(f) {
    const förälder = f.full_name || f.email || 'Familj';
    const barn = S.elever.filter(e => e.parent_id === f.id).map(e => e.name).filter(Boolean);
    return barn.length
      ? { rubrik: barn.join(' & '), under: 'Förälder: ' + förälder, förnamn: String(barn[0]).split(' ')[0] }
      : { rubrik: förälder, under: f.email && f.email !== förälder ? f.email : 'Inget barn inlagt än', förnamn: '' };
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
    /* Biblioteket hör inte till eleven — det är samma bank oavsett
       vem man valt. Det hämtas ändå här, för årskursfiltret förväljs
       ur elevens grade och ska följa med när man byter elev. */
    await Promise.all([laddaLaxor(), laddaProgress(), laddaBibliotek(), laddaPlanIFormulär()]);
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
    valtBibliotek = null;
    visaValtMaterial();
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
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    await medan($('#lx-spara'), 'Skapar…', async () => {
      const { error } = await supa.from('homework').insert({
        student_id: S.aktivElev,
        tutor_id: S.user.id,
        title: titel,
        subject: $('#lx-amne').value.trim() || null,
        instructions: $('#lx-text').value.trim() || null,
        due_date: datum || null,
        bibliotek_id: valtBibliotek ? valtBibliotek.id : null
      });
      if (error) { säg(msg, 'Kunde inte skapa läxan: ' + felText(error), false); return; }

      säg(msg, '✓ Läxan har skapats. Familjen ser den direkt.', true);
      $('#lax-form').reset();
      $('#lax-form').hidden = true;
      $('#ny-lax').textContent = 'Ny läxa';
      valtBibliotek = null;
      visaValtMaterial();
      await laddaLaxor();
    });
  });


  /* Materialet från en läxrad. Raden bär bara ett id; sökvägen och
     länken följde med i hämtningen ovan, så uppslaget görs där
     läxorna finns — inte i en ny fråga per klick. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lax-mat]');
    if (!knapp) return;
    const h = (S.laxor || []).find(x => x.bibliotek_id === knapp.dataset.laxMat);
    const b = h && h.biblioteksmaterial;
    if (!b) return;
    if (b.lank) { window.open(b.lank, '_blank', 'noopener'); return; }
    await medan(knapp, '…', async () => {
      const url = await M.signera('bibliotek', b.filvag);
      if (!url) { alert('Materialet gick inte att öppna just nu.'); return; }
      window.open(url, '_blank', 'noopener');
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
    const { data, error } = await supa
      .from('homework')
      .select('id, title, instructions, subject, due_date, status, completed_at, '
        + 'bibliotek_id, biblioteksmaterial(titel, filvag, lank)')
      .eq('student_id', S.aktivElev)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) { host.innerHTML = tomt('Kunde inte hämta läxorna', felText(error)); return; }
    if (!data.length) {
      S.laxor = [];
      host.innerHTML = tomt('Inga läxor än', 'Skapa den första med knappen ovanför — den dyker upp hos familjen direkt.');
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
      material: h.biblioteksmaterial ? h.biblioteksmaterial.titel : null,
      materialKnapp: h.biblioteksmaterial
        ? '<button type="button" class="btn btn-ghost btn-sm" data-lax-mat="'
          + esc(h.bibliotek_id) + '">Öppna</button>' : '',
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
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

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
      host.innerHTML = tomt('Inga områden än', 'Lägg till det första ovanför — det är så familjen ser att det går framåt.');
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
          ? 'Räknat på ' + kr(rate) + ' i timmen. Bara genomförda pass räknas — ett bokat pass blir en timme först när du skrivit rapporten.'
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
      /* En tid utanför 07–21, från en äldre vy eller från admin, ska
         synas som en knapp. En tid man inte ser går inte att ta bort. */
      const från = Math.min(TID_FRÅN, ...mina), till = Math.max(TID_TILL, ...mina);
      let knappar = '';
      for (let h = från; h <= till; h++) {
        knappar += '<button type="button" class="bk-slot tk-tim" data-timme="' + h + '"'
          + ' aria-pressed="' + (mina.has(h) ? 'true' : 'false') + '">' + tvåsiff(h) + ':00</button>';
      }
      dagHost.innerHTML = '<p class="bk-kal-dagnamn">' + esc(DAGNAMN[vd] + ' ' + datumText(k.dag)) + '</p>'
        + '<p class="tk-hjalp">Tryck på timmarna du kan. De gäller <b>varje ' + esc(DAGNAMN[vd].toLowerCase())
        + '</b> — du behöver inte spara.</p>'
        + '<div class="mv-tider tk-timmar" role="group" aria-label="' + esc('Timmar ' + DAGNAMN[vd].toLowerCase() + 'ar') + '">'
        + knappar + '</div>';
    }

    const sam = $('#tid-sammanfattning');
    if (sam) {
      sam.textContent = (S.tillgang || []).length
        ? 'Dina tider: ' + (S.tillgang || []).slice()
            .sort((a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)))
            .map(r => DAGNAMN[r.weekday].slice(0, 3).toLowerCase() + ' ' + String(r.start_time).slice(0, 5)
                      + '–' + String(r.end_time).slice(0, 5)).join(' · ')
        : 'Inga tider inlagda än. Familjen kan fortfarande önska tider, men ingen bokning bekräftas direkt.';
    }
  }

  /* En timme av eller på för veckodagen. Knappen svarar direkt, och
     vyn ritas om från databasen när alla tryck är skrivna. Varje steg
     i kön skriver det SENASTE man tryckt fram för dagen, mot rader
     som just hämtats — så blir tre snabba tryck ett fönster. */
  function växlaTimme(knapp) {
    const k = S.tidKal;
    if (!k.dag) return;
    const vd = veckodagFör(k.dag);
    const h = Number(knapp.dataset.timme);
    const timmar = önskadeTimmar(vd);
    if (timmar.has(h)) timmar.delete(h); else timmar.add(h);
    tidÖnskat.set(vd, timmar);
    knapp.setAttribute('aria-pressed', timmar.has(h) ? 'true' : 'false');

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

     laddaTider    — veckotiderna ur databasen
     laddaUpptagna — vilka timmar som redan är bokade hos dig, för
                     flytta-rutan
     ============================================================ */
  async function laddaTider() {
    const t = await NX.hämtaTillganglighet(S.user.id);
    S.tillgang = t.tillgang;
    ritaTider();
  }

  async function laddaUpptagna() {
    S.upptagna = await NX.hämtaUpptagna(S.user.id);
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

    const orapporterade = (S.bokningar || []).filter(b =>
      b.status === 'confirmed' && b.wanted_date < isoFor(new Date())).length;
    if (orapporterade) {
      poster.push({
        rubrik: orapporterade + ' pass utan rapport',
        text: 'Passet har varit. Rapporten gör det till en arbetad timme.',
        mål: '#pass-lista'
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

    const kommande = S.bokningar.filter(b => b.status === 'requested' || b.status === 'confirmed').length;
    $('#kpi-kommande').textContent = kommande;
    $('#pass-antal').textContent = S.bokningar.length ? S.bokningar.length + ' st' : '';

    /* Siffran på fliken räknar de pass familjen begärt men du inte
       svarat på än. Det är den enda posten här som är din tur —
       ett bekräftat pass kräver ingenting förrän det hållits. */
    märkFlik('#flik-pass-mark', S.bokningar.filter(b => b.status === 'requested').length);
    ritaNästaPass();
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
      tomtKommande: 'Inga kommande pass. Familjen bokar på tiderna du markerat under Dina tider.',
      rad: b => {
      const e = S.elever.find(x => x.id === b.student_id);
      const familj = S.familjer.find(f => f.id === b.parent_id);
      const mitt = b.created_by === S.user.id;
      const kan = b.status === 'requested' || b.status === 'confirmed';

      /* Har passet varit och saknar rapport är det EN sak man ska
         göra med raden, och då ska den knappen vara den primära.
         Flytta och Avboka hör till pass som ligger framåt — ett pass
         som redan hållits går inte att flytta. */
      const idag = isoFor(new Date());
      const harVarit = kan && rapporterbart(b) && harBörjat(b);

      let knappar = '';
      if (b.status === 'requested' && !mitt && !harVarit) {
        knappar += '<button class="btn btn-primary btn-sm" data-status="confirmed" data-id="' + b.id + '">Bekräfta</button>';
      }
      if (harVarit) {
        knappar += '<button class="btn btn-primary btn-sm" data-rapportera="' + b.id + '">Skriv rapport</button>';
      }
      if (kan && !harVarit) {
        knappar += '<button class="btn btn-ghost btn-sm" data-flytta="' + b.id + '">Flytta</button>';
      }
      if (kan) {
        /* Ett önskemål från familjen avböjs, ett bokat pass avbokas.
           Samma sak i databasen, men inte samma sak att säga. */
        const önskemål = b.status === 'requested' && !mitt;
        knappar += '<button class="btn btn-ghost btn-sm" data-status="cancelled" data-id="' + b.id + '"'
          + (önskemål ? ' data-avboj="1">Avböj' : '>Avboka') + '</button>';
      }

      /* Platsen står direkt på raden, inte bara i detaljvyn. Ett pass
         på plats är en resa — var man ska vara är halva beskedet. */
      const under = [b.format, b.location, (b.duration_min || 60) + ' min',
        e ? e.name : (familj ? familj.full_name : null)].filter(Boolean).join(' · ');

      return NXKontakt.passRad(b, {
        under: under,
        vem: harVarit
          ? 'Passet har varit — rapporten saknas'
          : b.status === 'requested'
          ? (mitt ? 'Ditt förslag — väntar på svar' : 'Familjen önskade den här tiden')
          : (b.attendance === 'franvarande' ? 'Eleven uteblev'
            : b.attendance === 'sen' ? 'Eleven kom sent' : null),
        atgarder: knappar
      }) + (b.note ? '<p class="xsmall" style="margin:-6px 0 12px 82px;color:var(--muted)">' + esc(b.note) + '</p>' : '');
      }
    });
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
      + '<option value="">Inget pass — fristående rapport</option>';

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
    if (ruta.parentNode !== document.body) document.body.appendChild(ruta);
    clearTimeout(rapportStängs);

    /* Rapporten sparas på den aktiva eleven. Hör passet till en
       annan elev byts eleven först — annars hamnade rapporten om ett
       barn hos ett annat, och passet blev aldrig genomfört. */
    const b = (S.bokningar || []).find(x => x.id === bokningId);
    if (b && b.student_id !== S.aktivElev) await väljElev(b.student_id);

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

    const ny = await NXStudie.flyttaRuta({
      datum: b.wanted_date,
      tid: b.wanted_time,
      tillgang: S.tillgang,
      minuter: b.duration_min || 60,
      upptagna: await NX.hämtaUpptagna(S.user.id)
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

    const fel = kolla([
      { fel: !S.aktivElev, text: 'Välj en elev högst upp först.' },
      { fel: !rap.gick, text: 'Välj hur lektionen gick.' },
      { fel: !anteckningar, text: 'Skriv något om vad ni gjorde.', falt: $('#r-notes') },
      { fel: områdePå && !område, text: 'Skriv vilket område ni jobbade med, eller kryssa ur rutan.', falt: $('#r-omrade') },
      /* progress_items är unikt per (elev, ämne, område). Utan ämne
         finns ingen rad att uppdatera, bara en att skapa på nytt. */
      { fel: områdePå && !rap.amne, text: 'Välj vilket ämne området hör till.' },
      { fel: $('#r-lax').checked && !laxTitel, text: 'Skriv vad läxan går ut på, eller kryssa ur rutan.', falt: $('#r-lax-titel') }
    ]);
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    const passId = $('#r-pass').value || null;
    const datum = $('#r-datum').value || isoFor(new Date());

    await medan($('#r-spara'), 'Sparar…', async () => {
      const { data, error } = await supa.from('lesson_reports').insert({
        student_id: S.aktivElev,
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
           längre bli sparad medan passet står kvar orört — vägrar
           databasen passet sparas inte rapporten heller, och felet
           nedan säger varför. */
        narvaro: passId ? $('#r-narvaro').value : null
      }).select('id').single();

      if (error) { säg(msg, 'Kunde inte spara rapporten: ' + felText(error), false); return; }

      let varning = '';

      /* Samma formulär skriver utvecklingen. Förr låg den i ett eget
         formulär längre ned, och därför fylldes den nästan aldrig i. */
      if (områdePå && område && rap.amne) {
        const { error: pErr } = await supa.from('progress_items').upsert({
          student_id: S.aktivElev,
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
          student_id: S.aktivElev,
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

  async function laddaMinaRapporter() {
    const host = $('#mina-rapporter');
    const { data, error } = await supa
      .from('lesson_reports')
      .select('id, lesson_date, raw_notes, ai_feedback, gick, amne, needs_practice, next_focus, student_id')
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
     MATERIAL (Fas 13.3)

     Var en uppladdning per elev till `materials`: tre sorter (fil,
     länk, anteckning) i elevens egen mapp. De raderna nådde ingen
     familj sedan föräldravyns materialflik togs bort i Fas 13.2 —
     en uppladdning som såg ut att fungera och inte gjorde det.

     Fliken är nu biblioteket, med två sorter i samma lista:

     · Nextrums   — delad = true. Bara admin fyller på. Det är
                    urvalet, och det är kurerat med flit.
     · Mitt eget  — delad = false. Bara du ser det, bara du ändrar
                    det. Databasen har `not delad` i både using och
                    with check på uppdateringen, så det går inte att
                    lyfta in i den gemensamma banken härifrån.

     Båda når eleven på samma sätt: genom en läxa. Det är LÄXAN som
     gör materialet synligt för familjen, inte uppladdningen — och
     därför leder "Ge som läxa" till läxformuläret i stället för att
     skapa något direkt. Deadlinen är det enda som inte står i
     materialet, och en läxa utan deadline är en läxa eleven inte vet
     när hen ska ha gjort.
     ============================================================ */

  /* Materialet nästa läxa ska peka på. Nollställs när formuläret
     stängs eller skickas — annars ärver nästa läxa ett material man
     valde för tio minuter sedan. */
  let valtBibliotek = null;
  let bibRader = [];
  let bibÄgare = '';     // '', 'delad' eller 'eget'
  let bibEgetTyp = 'fil';

  function fyllBibliotekVäljare() {
    const ämnen = NX.AMNEN.map(a =>
      '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('');
    const årskurser = NX.ARSKURSER.map(a =>
      '<option value="' + esc(a.kod) + '">' + esc(a.text) + '</option>').join('');
    $('#bl-amne').innerHTML = '<option value="">Alla ämnen</option>' + ämnen;
    $('#bl-ak').innerHTML = '<option value="">Alla årskurser</option>' + årskurser;
    $('#be-amne').innerHTML = ämnen;
    $('#be-arskurs').innerHTML = årskurser;
  }

  function bibKort(b) {
    const eget = !b.delad;
    return '<div class="bib-kort' + (eget ? ' ar-eget' : '') + '">'
      + '<div class="bib-kort-topp">'
      + '<b>' + esc(b.titel) + '</b>'
      + '<span class="tag">' + esc(b.amne) + '</span>'
      + '<span class="tag">' + esc(NX.årskursText(b.arskurs)) + '</span>'
      + '<span class="bib-agare">' + (eget ? 'Ditt eget' : 'Nextrums') + '</span>'
      + '</div>'
      + (b.beskrivning ? '<p>' + esc(b.beskrivning) + '</p>' : '')
      + '<div class="bib-kort-knappar">'
      + '<button type="button" class="btn btn-ghost btn-sm" data-bib-titt="' + esc(b.id) + '">Titta på det</button>'
      + '<button type="button" class="btn btn-primary btn-sm" data-bib-lax="' + esc(b.id) + '">Ge som läxa</button>'
      /* Bara ditt eget går att ta bort. Nextrums bank sköts av admin,
         och en knapp som alltid svarar "det gick inte" är sämre än
         ingen knapp. */
      + (eget
          ? ' <button type="button" class="btn btn-ghost btn-sm" data-bib-egetbort="' + esc(b.id) + '">Ta bort</button>'
          : '')
      + '</div></div>';
  }

  function ritaBibliotekslista() {
    const host = $('#bl-lista');
    if (!host) return;
    const amne = $('#bl-amne').value;
    const ak = $('#bl-ak').value;
    const sök = $('#bl-sok').value.trim().toLowerCase();

    const urval = bibRader
      .filter(b => !bibÄgare || (bibÄgare === 'eget' ? !b.delad : b.delad))
      .filter(b => !amne || b.amne === amne)
      .filter(b => !ak || b.arskurs === ak)
      .filter(b => !sök || (b.titel + ' ' + (b.beskrivning || '')).toLowerCase().indexOf(sök) > -1);

    $('#mat-antal').textContent = bibRader.length
      ? urval.length + ' av ' + bibRader.length : '';

    host.innerHTML = urval.length
      ? urval.map(bibKort).join('')
      : tomt(bibRader.length ? 'Inget material matchar' : 'Inget material än',
          bibRader.length
            ? 'Prova ett bredare filter, eller lägg till ett eget.'
            : 'Nextrums bank fylls på av oss. Ditt eget lägger du till med knappen ovan.');
  }

  async function laddaBibliotek() {
    const { data, error } = await supa.from('biblioteksmaterial')
      .select('id, titel, beskrivning, amne, arskurs, filvag, lank, delad')
      .eq('aktiv', true)
      .order('delad', { ascending: true })
      .order('amne').order('titel');
    if (error) {
      $('#bl-lista').innerHTML = tomt('Materialet gick inte att hämta', felText(error));
      return;
    }
    bibRader = data || [];

    /* Förvalet är den valda elevens årskurs. students.grade är
       fritext ("åk 7", "7:an"), så koden gissas — och gissar hellre
       inget än fel: ett filter förvalt på fel årskurs ser ut som ett
       tomt bibliotek, och då slutar man leta. */
    const eleven = elev();
    const ak = $('#bl-ak');
    if (ak && !ak.dataset.rörd) {
      const förvald = NX.årskursKod(eleven && eleven.grade);
      if (förvald) ak.value = förvald;
    }
    ritaBibliotekslista();
  }

  /* ---- filter ---- */
  $('#bib-agare').addEventListener('click', e => {
    const k = e.target.closest('[data-bagare]');
    if (!k) return;
    bibÄgare = k.dataset.bagare;
    $$('#bib-agare button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.bagare === bibÄgare)));
    ritaBibliotekslista();
  });

  ['#bl-sok', '#bl-amne', '#bl-ak'].forEach(id => {
    $(id).addEventListener('input', () => {
      /* En rörd årskurs skrivs inte över av elevens vid nästa
         hämtning. Att tvingas ställa om filtret varje gång man byter
         elev är detsamma som att inte ha ett filter. */
      if (id === '#bl-ak') $('#bl-ak').dataset.rörd = '1';
      ritaBibliotekslista();
    });
  });

  /* ---- titta på materialet ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bib-titt]');
    if (!knapp) return;
    const b = bibRader.find(x => x.id === knapp.dataset.bibTitt);
    if (!b) return;
    if (b.lank) { window.open(b.lank, '_blank', 'noopener'); return; }
    await medan(knapp, '…', async () => {
      const url = await M.signera('bibliotek', b.filvag);
      if (!url) { alert('Filen gick inte att öppna just nu.'); return; }
      window.open(url, '_blank', 'noopener');
    });
  });

  /* ---- ge som läxa ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-bib-lax]');
    if (!knapp) return;
    const b = bibRader.find(x => x.id === knapp.dataset.bibLax);
    if (!b) return;
    if (!S.aktivElev) { alert('Välj en elev högst upp först.'); return; }

    valtBibliotek = b;
    if (S.flikar && S.flikar.laxor) S.flikar.laxor.visa('laxor');
    $('#lax-form').hidden = false;
    $('#ny-lax').textContent = 'Stäng';
    $('#lx-titel').value = b.titel;
    $('#lx-amne').value = b.amne;
    if (!$('#lx-text').value.trim() && b.beskrivning) $('#lx-text').value = b.beskrivning;
    visaValtMaterial();
    $('#lx-datum').focus();
  });

  /* Kvittot i läxformuläret. Utan det syns valet bara som att
     rubriken fylldes i av sig själv, och den som ångrar sig har
     ingen väg tillbaka — bibliotek_id hade följt med läxan ändå. */
  function visaValtMaterial() {
    const host = $('#lx-material');
    if (!host) return;
    if (!valtBibliotek) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = '<span>Material: <b>' + esc(valtBibliotek.titel) + '</b></span>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="lx-material-bort">Ta bort kopplingen</button>';
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#lx-material-bort')) return;
    valtBibliotek = null;
    visaValtMaterial();
  });

  /* ============================================================
     EGET MATERIAL

     RADEN FÖRST, FILEN SEDAN. Hinkens insert-policy slår upp
     sökvägens uuid i biblioteksmaterial — laddar man upp först får
     man "new row violates row-level security policy" utan att förstå
     varför. Går uppladdningen fel städas raden bort igen, annars
     pekar listan på en fil som aldrig kom fram.

     delad: false är inte en inställning, det är villkoret i policyn.
     Skulle det stå true svarar databasen 42501.
     ============================================================ */
  $('#bib-eget-ny').addEventListener('click', () => {
    const f = $('#bib-eget-form');
    f.hidden = !f.hidden;
    $('#bib-eget-ny').textContent = f.hidden ? 'Lägg till eget material' : 'Stäng';
    if (!f.hidden) $('#be-titel').focus();
  });

  $('#be-avbryt').addEventListener('click', () => {
    $('#bib-eget-form').hidden = true;
    $('#bib-eget-ny').textContent = 'Lägg till eget material';
    rensa($('#be-msg'));
  });

  $('#be-typ').addEventListener('click', e => {
    const k = e.target.closest('[data-betyp]');
    if (!k) return;
    bibEgetTyp = k.dataset.betyp;
    $$('#be-typ button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.betyp === bibEgetTyp)));
    $('#be-fil-grupp').hidden = bibEgetTyp !== 'fil';
    $('#be-lank-grupp').hidden = bibEgetTyp !== 'lank';
    rensa($('#be-msg'));
  });

  $('#be-fil').addEventListener('change', e => {
    const f = (e.target.files || [])[0];
    $('#be-fil-namn').textContent = f ? f.name + ' · ' + M.filstorlek(f.size) : 'Ingen fil vald';
    if (f && !$('#be-titel').value.trim()) {
      $('#be-titel').value = f.name.replace(/\.[^.]+$/, '').slice(0, 200);
    }
  });

  $('#bib-eget-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#be-msg');
    rensa(msg);

    const titel = $('#be-titel').value.trim();
    const fil = bibEgetTyp === 'fil' ? ($('#be-fil').files || [])[0] : null;
    const länk = bibEgetTyp === 'lank' ? $('#be-lank').value.trim() : '';

    const fel = kolla([
      { fel: !titel, text: 'Ge materialet en rubrik.', falt: $('#be-titel') },
      { fel: bibEgetTyp === 'fil' && !fil, text: 'Välj en fil att ladda upp.', falt: $('#be-fil') },
      { fel: bibEgetTyp === 'lank' && !länk, text: 'Klistra in adressen.', falt: $('#be-lank') },
      { fel: bibEgetTyp === 'lank' && länk && !/^https?:\/\//i.test(länk),
        text: 'Adressen måste börja med http:// eller https://.', falt: $('#be-lank') },
      { fel: bibEgetTyp === 'fil' && fil && !!M.granskaFil(fil),
        text: fil ? M.granskaFil(fil) : '', falt: $('#be-fil') }
    ]);
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    await medan($('#be-spara'), fil ? 'Laddar upp…' : 'Sparar…', async () => {
      /* Sökvägen byggs ur radens uuid, aldrig ur filnamnet. Ett
         filnamn heter i praktiken "Provräkning Alva v42.pdf", och
         sökvägen är det enda i en hink som syns innan man öppnat
         filen. Därför måste id:t vara känt före uppladdningen. */
      const id = crypto.randomUUID();
      const rent = fil ? fil.name.replace(/[^\w.\-]+/g, '_').slice(-80) : '';
      const sökväg = fil ? id + '/' + rent : null;

      const { error } = await supa.from('biblioteksmaterial').insert({
        id: id,
        titel: titel,
        beskrivning: $('#be-beskrivning').value.trim() || null,
        amne: $('#be-amne').value,
        arskurs: $('#be-arskurs').value,
        filvag: sökväg,
        lank: länk || null,
        skapad_av: S.user.id,
        delad: false
      });
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      if (fil) {
        const upp = await supa.storage.from('bibliotek')
          .upload(sökväg, fil, { contentType: fil.type, upsert: false });
        if (upp.error) {
          await supa.from('biblioteksmaterial').delete().eq('id', id);
          säg(msg, 'Filen kunde inte laddas upp: ' + upp.error.message
            + ' Ingenting sparades.', false);
          return;
        }
      }

      $('#bib-eget-form').reset();
      $('#be-fil-namn').textContent = 'Ingen fil vald';
      $('#bib-eget-form').hidden = true;
      $('#bib-eget-ny').textContent = 'Lägg till eget material';
      await laddaBibliotek();
      säg($('#be-msg'), '', true);
    });
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bib-egetbort]');
    if (!knapp) return;
    const b = bibRader.find(x => x.id === knapp.dataset.bibEgetbort);
    if (!b) return;

    const ja = await bekräfta({
      titel: 'Ta bort ' + b.titel + '?',
      text: 'Materialet försvinner ur din lista. Läxor som redan pekar på det blir '
        + 'kvar men tappar materialet.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(knapp, 'Tar bort…', async () => {
      /* Filen först, raden sedan, och LÄS SVARET. Sökvägen finns bara
         i raden — försvinner raden först blir filen omöjlig att hitta
         och omöjlig att städa. Samma fel som Fas 9.2 rättade. */
      if (b.filvag) {
        const res = await supa.storage.from('bibliotek').remove([b.filvag]);
        if (res.error) {
          alert('Filen kunde inte tas bort: ' + res.error.message
            + '\nRaden är kvar, så sökvägen finns kvar att städa med.');
          return;
        }
        M.glömSignerad('bibliotek', b.filvag);
      }
      const { error } = await supa.from('biblioteksmaterial').delete().eq('id', b.id);
      if (error) { alert('Filen togs bort men raden blev kvar: ' + felText(error)); return; }
      await laddaBibliotek();
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
    if (fel) { säg($('#av-msg'), '⚠️ ' + fel, false); return; }

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
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

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
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

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
    if (!S.aktivElev) { säg(msg, '⚠️ Välj en elev högst upp först.', false); return; }

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

    /* Notisvalen under Profil → Notiser. Samma modul som föräldravyn
       använder: raderna i notis_val ser likadana ut för båda rollerna,
       och två kopior av samma lista hade glidit isär. */
    NXStudie.notisval({
      host: $('#notisval-lista'),
      supa: supa,
      anvandare: S.user.id,
      msg: $('#notisval-msg')
    });
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

  function nästaPass() {
    const idag = isoFor(new Date());
    return S.bokningar
      .filter(b => (b.status === 'requested' || b.status === 'confirmed') && b.wanted_date >= idag)
      .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
                        .localeCompare(b.wanted_date + (b.wanted_time || '')))[0] || null;
  }

  function ritaNästaPass() {
    const b = nästaPass();
    const e = b ? S.elever.find(x => x.id === b.student_id) : null;
    const f = b ? S.familjer.find(x => x.id === b.parent_id) : null;
    const vem = e ? e.name : (f ? f.full_name : null);

    /* Samma pass på två ställen: som kort i hälsningen högst upp och
       som rad på Översikt. Hälsningen är det första man ser, och
       nästa pass är det oftast enda man öppnade vyn för. */
    if (S.hero) {
      S.hero.uppdatera({
        nasta: b ? {
          href: '#lektioner',
          text: 'Nästa pass · ' + datumText(b.wanted_date)
                + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
          under: [vem, b.subject].filter(Boolean).join(' · ')
        } : {
          href: '#lektioner',
          text: 'Inga pass inbokade',
          under: 'Familjen bokar i sin vy — du bekräftar här'
        }
      });
    }

    const host = $('#ov-nasta');
    if (!host) return;
    if (!b) {
      host.innerHTML = tomt('Inga pass inbokade', 'När familjen bokar en tid står nästa pass här.');
      return;
    }
    host.innerHTML = NXKontakt.passRad(b, {
      under: [b.format, b.location, (b.duration_min || 60) + ' min'].filter(Boolean).join(' · '),
      vem: vem
    });
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
    const pag = $('#ers-pagaende'), konto = $('#ers-konto'), lista = $('#ers-lista');
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

    /* INGET UTBETALNINGSKONTO HÄR, och det är ett beslut (Fas 12.5).
       Ersättningen betalas den 25:e, som en löning, i en klump för
       månadens rapporterade pass. Den går genom payouts och en
       överföring från banken, inte genom Stripe.

       Rutan hade tidigare en knapp som kopplade ett anslutet
       Stripe-konto. Den byggdes för en modell där hjälparen fick sin
       del vid varje betalning, och den modellen finns inte längre.
       Att lämna kvar knappen hade bett om uppgifter — personnummer,
       legitimation, bankkonto — som ingenting sedan använder. */
    konto.innerHTML = '<p class="bet-not" style="margin-top:0">Din ersättning betalas '
      + 'den 25:e varje månad, för de pass du rapporterat. Underlaget nedan är det vi '
      + 'betalar efter, så hör av dig i god tid om något ser fel ut. '
      + 'Kontouppgifterna har vi av dig sedan tidigare, och de ligger inte här.</p>';

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

  /* Här satt hanteraren för "Koppla utbetalningskonto". Både knappen
     och anropet till edge-funktionen stripe-konto är borta sedan Fas
     12.5: ersättningen går den 25:e genom payouts, och ett anslutet
     Stripe-konto fyller ingen funktion i den modellen. */

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
        'Familjen lägger in sitt barn i sin egen vy. Skriv till dem om det dröjer.');
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

    const idag = isoFor(new Date());
    const hens = S.bokningar.filter(b => b.student_id === e.id);
    const ordning = b => b.wanted_date + (b.wanted_time || '');
    const kommande = hens
      .filter(b => b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed'))
      .sort((a, b) => ordning(a).localeCompare(ordning(b)));
    const tidigare = hens
      .filter(b => b.status === 'completed')
      .sort((a, b) => ordning(b).localeCompare(ordning(a)));
    const öppna = (S.laxor || []).filter(h => h.status !== 'klar').length;

    const rad = b => NXKontakt.passRad(b, {
      under: [b.format, b.location, (b.duration_min || 60) + ' min'].filter(Boolean).join(' · ')
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
     också av rapportrutan: ett pass i schemat kan höra till en annan
     elev än den som är vald, och rapporten sparas på den aktiva. */
  async function väljElev(id) {
    if (!id || id === S.aktivElev) return;
    const vald = S.elever.find(x => x.id === id);
    if (!vald) return;

    const bytFamilj = vald.parent_id !== S.aktivFamilj;
    S.aktivFamilj = vald.parent_id;
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
      inget: 'Inga rapporterade pass än — grafen fylls i när du skrivit din första rapport.'
    });
  }

  /* ============================================================
     SCHEMAT
     Bokningsväljaren svarar på "när kan vi ses?". Schemat svarar på
     "vad ligger redan?". Båda läser S.bokningar, så en flytt syns i
     båda utan att något behöver hållas i synk.
     ============================================================ */
  function byggSchema() {
    NXStudie.schemaI(S, {
      namn: b => {
        const e = S.elever.find(x => x.id === b.student_id);
        if (e) return e.name;
        const f = S.familjer.find(x => x.id === b.parent_id);
        return f ? (f.full_name || '') : '';
      },
      onOppna: visaPass
    });
  }

  /* Knapparna får samma data-attribut som raderna i passlistan, så
     de delegerade hanterarna längre ned tar hand om dem. Rutan
     stänger sig själv när klicket bubblat vidare. */
  function visaPass(b) {
    const e = S.elever.find(x => x.id === b.student_id);
    const f = S.familjer.find(x => x.id === b.parent_id);
    const l = NXKontakt.LÄGEN[b.status] || { text: b.status };
    const mitt = b.created_by === S.user.id;
    const kan = b.status === 'requested' || b.status === 'confirmed';

    let knappar = '';
    /* Ett pass som redan varit flyttas inte — det rapporteras. Och det
       bekräftas inte heller i efterhand; samma regel som passlistan. */
    const harVarit = harBörjat(b);
    if (b.status === 'requested' && !mitt && !harVarit) {
      knappar += '<button type="button" class="btn btn-primary" data-status="confirmed" data-id="' + esc(b.id) + '">Bekräfta</button>';
    }
    if (kan) {
      const önskemål = b.status === 'requested' && !mitt;
      if (harVarit && rapporterbart(b)) {
        knappar += '<button type="button" class="btn btn-primary" data-rapportera="' + esc(b.id) + '">Skriv rapport</button>';
      } else {
        knappar += '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Flytta</button>';
      }
      knappar += '<button type="button" class="btn btn-ghost" data-status="cancelled" data-id="' + esc(b.id) + '"'
        + (önskemål ? ' data-avboj="1">Avböj' : '>Avboka') + '</button>';
    }

    const kommande = (S.laxor || [])
      .filter(h => h.student_id === b.student_id || S.aktivElev === b.student_id)
      .filter(h => h.status !== 'klar' && h.due_date && h.due_date >= b.wanted_date)
      .slice(0, 3);

    NXStudie.passRuta({
      titel: b.subject || 'Pass',
      under: datumText(b.wanted_date) + (b.wanted_time ? ' kl. ' + b.wanted_time : ''),
      rader: [
        ['Status', l.text],
        ['Längd', (b.duration_min || 60) + ' min'],
        ['Format', b.format],
        ['Plats', b.location],
        ['Elev', e ? e.name : null],
        ['Familj', f ? (f.full_name || f.email) : null],
        ['Bokades av', b.created_by ? (mitt ? 'Du' : 'Familjen') : null],
        ['Närvaro', b.attendance === 'franvarande' ? 'Uteblev'
                  : b.attendance === 'sen' ? 'Kom sent'
                  : b.attendance === 'narvarande' ? 'Närvarande' : null]
      ],
      anteckning: b.note,
      laxor: kommande,
      atgarder: knappar
    });
  }

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

    /* Ämnena och årskurserna ritas en gång. De kommer ur NX.AMNEN och
       NX.ARSKURSER — samma listor som adminvyn märker materialet med.
       Två listor som glider isär gör ett övningsblad osynligt. */
    fyllBibliotekVäljare();
    /* Och hämtas en gång direkt. byggElev hämtar om det när en elev
       väljs, men utan det här står fliken kvar på "Hämtar" för den
       som öppnar den innan hen valt någon. */
    laddaBibliotek();

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
      bild: 'bilder/hero-nextrum-1280.webp',
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
    await Promise.all([ritaÖvSamtal(), laddaErsattning()]);
    /* Stämpla besöket sist — notiserna räknas mot den förra. */
    supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
