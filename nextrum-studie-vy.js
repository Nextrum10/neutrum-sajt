/* ============================================================
   NEXTRUM — studievyn (foralder.html)

   Koden låg inbäddad i foralder.html fram till Fas 3. Den är flyttad
   hit oförändrad: samma ordning, samma IIFE, laddad på samma plats
   i sidan, efter de delade modulerna. Se nextrum-larare-vy.js för
   varför.
   ============================================================ */
(function () {
  'use strict';
  const { $, $$, esc, kr, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, kolla, tomt, laddar } = NXStudie;
  const M = NXMedia;
  const U = NXUppgifter;

  NX.initHeader();

  const S = { aktivSek: null, passFrån: null, yFör: {}, laddatPass: false, user: null, profil: null, tutor: null, barn: [], valtBarn: null, kal: null, bokningar: [], trad: null, minAvatar: null, laxor: [], rapporter: [], progress: [], olästaAntal: 0, plan: null, sido: null, progressAntal: 0, schema: null, tillgangFinns: false, underlag: {}, tillagg: {},
    /* NexLäx (Fas 23.1, 23.2). banaVal minns ämne och årskurs per barn;
       nl är det som hör till vägen: den öppnade noden, det som just
       klarades, de påbörjade försöken och läget (XP och serien). */
    katalog: null, forsok: [], banaVal: {},
    nl: { öppen: null, nyss: null, pågående: {}, läge: null, laddad: false, alla: false } };

  const VYER = ['view-loading', 'view-auth', 'view-locked', 'view-wrongrole', 'view-app', 'view-fel'];
  function visa(id) { NXStudie.visaVy(VYER, id); }

  /* ============ header ============ */
  function ritaHeader() { NXStudie.vyHuvud(S, 'Förälder', ritaNotiser); }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-logout]')) NXStudie.loggaUt(supa);
  });

  /* ============ inloggning ============ */
  let läge = 'in';
  function ritaAuth() {
    NXStudie.inloggningsruta(läge, {
      titel: 'Studievyn',
      titelUpp: 'Skapa föräldrakonto',
      under: 'För dig som är förälder eller elev: studieplanen, bokningen, kontakten med er studiehjälpare och rapporten efter varje pass.',
      underUpp: 'Kontot är gratis. Vyn låses upp så fort vi matchat er med en studiehjälpare.',
      /* Ett barn med egen inloggning kommer hit från Logga in på sajten
         och loggar in med sitt användarnamn (submit nedan). */
      etikett: 'E-post eller användarnamn'
    });
  }
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => { läge = b.dataset.auth; ritaAuth(); }));
  /* Glömt lösenordet? är ett tredje läge i samma ruta (NXStudie). */
  function sättLäge(l) { läge = l; ritaAuth(); }
  NXStudie.glömtLänkar(sättLäge);

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg'), knapp = $('#auth-submit');
    rensa(msg);
    if (!supa) { säg(msg, 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false); return; }
    if (läge === 'glomt') { await NXStudie.glömtSkicka(supa, { barn: true }); return; }

    const epost = $('#a-email').value.trim();
    const lösen = $('#a-pass').value;
    const namn = $('#a-name').value.trim();

    if (!epost || !lösen) {
      säg(msg, läge === 'in' ? 'Fyll i e-post eller användarnamn och lösenord.' : 'Fyll i e-post och lösenord.', false);
      return;
    }

    /* Ett barns användarnamn (eller barnadressen): barnet loggas in som
       på /barn, med barnvyns besked, och skickas till sin vy. En adress
       med @ på en annan domän är alltid en vuxen, så föräldrarnas
       inloggning är densamma som förut. */
    const barnAdress = läge === 'in' ? NXStudie.barnAdress(epost) : null;
    if (barnAdress) {
      await medan(knapp, 'Loggar in…', async () => {
        const svar = await NXStudie.loggaInBarn(supa, barnAdress, lösen);
        if (svar.fel) {
          säg(msg, svar.fel, false);
          $('#a-pass').value = '';
          $('#a-pass').focus();
          return;
        }
        location.replace('/barn');
      });
      return;
    }
    if (läge === 'up' && !namn) { säg(msg, 'Fyll i ditt namn.', false); return; }
    if (läge === 'up' && lösen.length < 6) { säg(msg, 'Lösenordet måste vara minst 6 tecken.', false); return; }

    knapp.setAttribute('aria-busy', 'true');
    let res;
    if (läge === 'up') {
      res = await supa.auth.signUp({
        email: epost, password: lösen,
        options: {
            data: { full_name: namn, role: 'parent' },
            /* Utan den här landar bekräftelselänken på Site URL i
               Supabase — alltså startsidan, eller värre: localhost.
               Nu kommer man tillbaka hit, till vyn man skapade
               kontot i, oavsett var sajten körs. */
            emailRedirectTo: location.origin + location.pathname
          }
      });
    } else {
      res = await supa.auth.signInWithPassword({ email: epost, password: lösen });
    }
    knapp.removeAttribute('aria-busy');

    if (res.error) { säg(msg, felText(res.error), false); return; }

    if (läge === 'up' && res.data && res.data.session === null) {
      säg(msg, 'Kontot är skapat. Vi har skickat en bekräftelse till ' + epost + '. Klicka på länken i mejlet och logga sedan in här.', true);
      return;
    }
    location.reload();
  });

  /* ============ studiehjälparkortet ============ */
  async function laddaTutor() {
    const host = $('#tutor-kort');
    const id = S.profil.matched_tutor_id;
    if (!id) { host.innerHTML = '<div class="empty">Ingen studiehjälpare tilldelad än.</div>'; return; }

    const [p, tp] = await Promise.all([
      supa.from('profiles').select('id, full_name, email, avatar_url, bio').eq('id', id).maybeSingle(),
      supa.from('tutor_profiles').select('age, school, city, subjects, grade_levels, bio, formats').eq('id', id).maybeSingle()
    ]);

    if (p.error || !p.data) {
      host.innerHTML = '<div class="empty">Kunde inte hämta studiehjälparen.<br><span class="xsmall">'
        + esc((p.error && p.error.message) || 'Ingen profil hittades') + '</span></div>';
      return;
    }
    S.tutor = Object.assign({}, p.data, tp.data || {});
    S.tutorAvatar = p.data.avatar_url ? await M.signera('avatarer', p.data.avatar_url) : null;

    const t = S.tutor;
    host.innerHTML =
      '<div class="tutor-top" style="margin-bottom:14px">'
      + M.avatar(t.full_name, S.tutorAvatar, { stor: true })
      + '<div><div class="tutor-name">' + esc(t.full_name) + (t.age ? ', ' + esc(t.age) : '') + '</div>'
      + '<div class="tutor-role">Studiehjälpare' + (t.school ? ' · ' + esc(t.school) : '') + '</div></div></div>'
      + (t.bio ? '<p class="small" style="margin-bottom:14px;line-height:1.6">' + esc(t.bio) + '</p>' : '')
      /* Årskurser och format hämtades redan men ritades aldrig ut.
         "Matematik" säger inte om hen tar åk 4 eller gymnasiet, och
         det är den frågan familjen faktiskt har. */
      + (() => {
          const märken = (t.subjects || [])
            .concat(t.grade_levels || [])
            .concat(t.formats || []);
          return märken.length
            ? '<div class="tutor-meta">' + märken.map(m => '<span class="tag">' + esc(m) + '</span>').join('') + '</div>'
            : '';
        })()
      + '<p class="xsmall" style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px;color:var(--muted-2);line-height:1.6">'
      + 'Skriv hellre i rutan Kontakt än via mejl — då hamnar allt på ett ställe och vi kan hjälpa till om något krånglar.</p>';

    $('#boka-hos').textContent = 'hos ' + t.full_name.split(' ')[0];
    /* Namnet står också i bekräftelsesteget. Det är där man läser
       igenom vad man håller på att boka, och "hos vem" hör hemma
       i den listan och inte bara i rubriken ovanför. */
    if (S.boka && S.boka.sättHos) S.boka.sättHos(t.full_name);
    $('#tr-vem').textContent = t.full_name.split(' ')[0];
    $('#tr-text').placeholder = 'Skriv till ' + t.full_name.split(' ')[0] + '…';
    /* Rapporterna är brev från studiehjälparen, med namn och bild. De kan
       ha ritats innan namnet kom; då ritas de om med det. */
    if (S.rb && S.rb.laddat) ritaBekrafta();
  }

  /* ============ kontakt ============ */
  function startaTråd() {
    if (!S.profil.matched_tutor_id) {
      $('#trad').innerHTML = '<div class="empty">Ni är inte kopplade till någon studiehjälpare än, '
        + 'så det finns ingen att skriva till.</div>';
      $('#tr-text').disabled = $('#tr-skicka').disabled = true;
      return;
    }
    S.trad = NXKontakt.tråd({
      host: $('#trad'),
      skriv: $('#tr-text'),
      knapp: $('#tr-skicka'),
      jag: S.user.id,
      parentId: S.user.id,
      tutorId: S.profil.matched_tutor_id,
      motpart: (S.tutor && S.tutor.full_name) || '',
      onFel: t => säg($('#tr-msg'), 'Meddelandet gick inte iväg: ' + t, false),
      onNytt: rader => {
        /* Räknaren i panelrubriken visar bara det som kommit in medan
           man varit borta — den nollas av samma laddning som markerar
           raderna som lästa, så den blinkar inte till i onödan. */
        const olästa = rader.filter(m => !m.read_at && m.sender_id !== S.user.id).length;
        const märke = $('#tr-larm');
        märke.hidden = !olästa;
        märke.textContent = olästa ? olästa + ' ny' + (olästa > 1 ? 'a' : '') : '';
        S.olästaAntal = olästa;
        ritaNotiser();
        ritaÖvSamtal();
      }
    });
  }

  /* ============ barn ============ */
  async function laddaBarn() {
    const { data, error } = await supa
      .from('students').select('id, name, grade, school, subjects, goals, about, behov, format_onskemal')
      .eq('parent_id', S.user.id).order('created_at');
    if (error) { console.warn(error.message); return; }
    S.barn = data || [];
    const val = $('#barn-val');

    if (!S.barn.length) {
      val.innerHTML = '<option value="">Inget barn tillagt än</option>';
      val.disabled = true;
      S.valtBarn = null;
      $('#barn-antal').textContent = '';
    } else {
      val.disabled = false;
      val.innerHTML = S.barn.map(b =>
        '<option value="' + b.id + '">' + esc(b.name) + (b.grade ? ' · ' + esc(b.grade) : '') + '</option>').join('');
      $('#barn-antal').textContent = S.barn.length === 1 ? '' : S.barn.length + ' st';
      if (!S.valtBarn || !S.barn.some(b => b.id === S.valtBarn)) S.valtBarn = S.barn[0].id;
      val.value = S.valtBarn;
    }
    ritaBarnLista();
    ritaBarnväxel();
    laddaBokning();
    laddaBarnkonton();
  }

  /* Listan över barnen. Visar det som faktiskt är ifyllt — ett tomt
     fält ritas inte som "Skola: —", för då ser en halvfylld profil
     ut som ett fel i stället för som något man kan fylla i sedan. */
  function ritaBarnLista() {
    const host = $('#barn-lista');
    if (!host) return;

    if (!S.barn.length) {
      host.innerHTML = '';
      return;
    }

    const text = (lista, kod) => (lista.find(x => x.kod === kod) || {}).text || null;
    host.innerHTML = S.barn.map(b => {
      const under = [b.grade, b.school, (b.subjects || []).join(', ')].filter(Boolean).join(' · ');
      const behov = (b.behov || []).map(k => text(NX.BEHOV, k)).filter(Boolean).join(', ');
      return '<div class="barn-rad" data-barn="' + esc(b.id) + '">'
        + '<div class="barn-namn"><b>' + esc(b.name) + '</b>'
        + (under ? '<span>' + esc(under) + '</span>' : '')
        + (behov ? '<span>Behöver: ' + esc(behov) + '</span>' : '')
        + (b.format_onskemal ? '<span>' + esc(text(NX.FORMAT_ONSKEMAL, b.format_onskemal)) + '</span>' : '')
        + (b.goals ? '<span class="barn-mal">' + esc(b.goals) + '</span>' : '')
        + '</div>'
        + '<button class="btn btn-ghost btn-sm" data-barn-bort="' + esc(b.id) + '">Ta bort</button>'
        + '</div>';
    }).join('');
  }

  /* Väljaren i sektionsrubrikerna. Själva hanteringen av barnen bor
     under Profil & inställningar — man lägger till ett barn en gång
     och ändrar skolan kanske en gång om året. Men VILKET barn man
     tittar på är en fråga varje sektion ställer, och att gå till
     kontosidan för att byta vore fel.

     Därför en smal rad, och bara när det finns något att välja
     mellan: har familjen ett barn syns ingenting alls. Det är fallet
     för nästan alla, och en rullgardin med ett val är bara brus. */
  function ritaBarnväxel() {
    const flera = S.barn.length > 1;
    document.querySelectorAll('[data-barnvaxel]').forEach(rad => {
      rad.hidden = !flera;
      if (!flera) return;
      const sel = rad.querySelector('select');
      sel.innerHTML = S.barn.map(b =>
        '<option value="' + b.id + '">' + esc(b.name) + (b.grade ? ' · ' + esc(b.grade) : '') + '</option>').join('');
      sel.value = S.valtBarn;
    });
  }

  /* Ett enda ställe som byter barn, oavsett vilken rullgardin som
     rördes. Alternativet vore att varje väljare laddade om sitt eget
     och sedan glömde att uppdatera de andra. */
  function bytBarn(id) {
    S.valtBarn = id || null;
    const val = $('#barn-val');
    if (val && !val.disabled) val.value = S.valtBarn || '';
    ritaBarnväxel();
    /* Försöken hör till barnet. Står det förra barnets kvar medan det
       nya hämtas kan ett syskon med samma nivå få fel resultat på sin
       uppgift, ett ögonblick. */
    S.forsok = [];
    S.laxorLaddade = false;
    S.nl = { öppen: null, nyss: null, pågående: {}, läge: null, laddad: false, alla: false };
    laddaPlan(); laddaRapporter(); laddaLaxor(); laddaNexlax(); laddaProgress(); laddaBokning();
  }

  $('#barn-val').addEventListener('change', e => bytBarn(e.target.value));

  /* Ta bort ett barn.

     Spärren ligger i DATABASEN (schema-v21): ett barn med pass eller
     rapporter går inte att ta bort, för raderingen hade kaskaderat
     bort rapporterna och lämnat fakturerade pass utan elev. Det här
     är bara frågan och beskedet — kontrollen görs inte här, för en
     kontroll i webbläsaren är ingen kontroll. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-barn-bort]');
    if (!knapp) return;

    const id = knapp.dataset.barnBort;
    const barn = S.barn.find(b => b.id === id);
    if (!barn) return;

    const ja = await NXStudie.bekräfta({
      titel: 'Ta bort ' + barn.name + '?',
      text: 'Allt som hör till barnet försvinner: studieplan, uppgifter och rapporter. '
        + 'Har barnet haft pass eller fått rapporter går det inte att ta bort — '
        + 'hör av er till oss i stället.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await NXStudie.medan(knapp, 'Tar bort…', async () => {
      const { error } = await supa.from('students').delete().eq('id', id);
      if (error) {
        /* Triggerns meddelande är skrivet för att läsas av en
           förälder, så det visas som det är. */
        alert(felText(error));
        return;
      }
      if (S.valtBarn === id) S.valtBarn = null;
      await laddaBarn();
    });
  });

  document.querySelectorAll('[data-barnvaxel] select').forEach(sel => {
    sel.addEventListener('change', e => bytBarn(e.target.value));
  });

  /* ============================================================
     BARNETS UPPGIFTER — ett formulär i två lägen

     Nytt barn och Ändra uppgifter var två formulär med olika fält:
     det nya barnet fick bara namn och årskurs. Nu är det ett, så att
     det man fyller i från början är samma sak som man ändrar sedan.

     Familjen äger uppgifterna. Målet och "hur lär sig hen bäst" ser
     studiehjälparen; de egna anteckningarna gör hen inte — de ligger
     i student_notes, eftersom RLS gäller rader och inte kolumner, och
     en kolumn i students hade studiehjälparen kunnat läsa via API:t.
     ============================================================ */
  const bf = { läge: null, amnen: [], behov: [], format: null };

  function knappar(lista, valda, ettVal) {
    return lista.map(x => '<button type="button" data-v="' + esc(x.kod) + '" aria-pressed="'
      + ((ettVal ? valda === x.kod : valda.indexOf(x.kod) !== -1) ? 'true' : 'false') + '">'
      + esc(x.text) + '</button>').join('');
  }

  function ritaBarnVal() {
    /* Ämnen utanför den fasta listan (skrivna förr, eller av admin ur
       en anmälan) ska inte försvinna bara för att de inte är förtryckta. */
    const ämnen = NX.AMNEN.concat(bf.amnen.filter(a => NX.AMNEN.indexOf(a) === -1));
    $('#b-amne-val').innerHTML = knappar(ämnen.map(a => ({ kod: a, text: a })), bf.amnen);
    $('#b-behov-val').innerHTML = knappar(NX.BEHOV, bf.behov);
    $('#b-format-val').innerHTML = knappar(NX.FORMAT_ONSKEMAL, bf.format, true);
  }

  (function () {
    const ak = $('#b-ak');
    ak.innerHTML = '<option value="">Välj</option>'
      + NX.ARSKURSER.map(a => '<option>' + esc(a.text) + '</option>').join('');
  })();

  function växla(lista, v) {
    const i = lista.indexOf(v);
    if (i === -1) lista.push(v); else lista.splice(i, 1);
  }
  $('#b-amne-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    växla(bf.amnen, b.dataset.v); ritaBarnVal();
  });
  $('#b-behov-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    växla(bf.behov, b.dataset.v); ritaBarnVal();
  });
  $('#b-format-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    bf.format = bf.format === b.dataset.v ? null : b.dataset.v; ritaBarnVal();
  });

  async function öppnaBarnForm(läge) {
    const f = $('#barn-form');
    const b = läge === 'ändra' ? S.barn.find(x => x.id === S.valtBarn) : null;
    if (läge === 'ändra' && !b) { säg($('#barn-msg'), '⚠️ Lägg till ett barn först.', false); return; }
    bf.läge = läge;
    f.reset();
    rensa($('#barn-msg'));
    $('#b-namn').value = (b && b.name) || '';
    $('#b-ak').value = (b && b.grade) || '';
    $('#b-skola').value = (b && b.school) || '';
    $('#b-mal').value = (b && b.goals) || '';
    $('#b-om').value = (b && b.about) || '';
    bf.amnen = ((b && b.subjects) || []).slice();
    bf.behov = ((b && b.behov) || []).slice();
    bf.format = (b && b.format_onskemal) || null;
    ritaBarnVal();

    $('#barn-form-rubrik').textContent = b ? 'Uppgifter om ' + b.name : 'Lägg till ett barn';
    $('#barn-spara').textContent = b ? 'Spara' : 'Lägg till barnet';
    $('#b-egna-grupp').hidden = !b;
    $('#b-egna').value = '';
    f.hidden = false;
    $('#andra-barn').textContent = 'Ändra uppgifter';
    $('#b-namn').focus({ preventScroll: true });
    f.scrollIntoView({ block: 'nearest' });

    /* Anteckningen ligger i en egen tabell som bara familjen når. */
    if (b) {
      const { data } = await supa.from('student_notes')
        .select('notes').eq('student_id', b.id).maybeSingle();
      if (data && bf.läge === 'ändra') $('#b-egna').value = data.notes || '';
    }
  }

  function stängBarnForm() {
    $('#barn-form').hidden = true;
    bf.läge = null;
    rensa($('#barn-msg'));
    /* Formuläret är långt. När det stängs krymper sidan med hela dess
       höjd, och man hamnade där sidan råkade ta slut — 1 000 px
       ovanför knappen man tryckt på. Barnlistan är det man vill se
       efteråt: där står barnet man just lagt till. */
    const lista = $('#barn-lista');
    if (lista && lista.getBoundingClientRect().top < 0) NXStudie.visaÖverst(lista.closest('.dbox') || lista);
  }

  $('#andra-barn').addEventListener('click', () => {
    if (!$('#barn-form').hidden && bf.läge === 'ändra') { stängBarnForm(); return; }
    öppnaBarnForm('ändra');
  });
  $('#lagg-till-barn').addEventListener('click', () => {
    if (!$('#barn-form').hidden && bf.läge === 'ny') { stängBarnForm(); return; }
    öppnaBarnForm('ny');
  });
  $('#avbryt-barn').addEventListener('click', stängBarnForm);

  $('#barn-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#barn-msg');
    rensa(msg);
    const namn = $('#b-namn').value.trim();
    const fel = kolla([
      { fel: !namn, text: 'Fyll i barnets namn.', falt: $('#b-namn') },
      { fel: bf.läge === 'ändra' && !S.valtBarn, text: 'Välj ett barn först.' }
    ]);
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    const uppgifter = {
      name: namn,
      grade: $('#b-ak').value || null,
      school: $('#b-skola').value.trim() || null,
      subjects: bf.amnen.slice(),
      behov: bf.behov.slice(),
      format_onskemal: bf.format,
      goals: $('#b-mal').value.trim() || null,
      about: $('#b-om').value.trim() || null
    };

    await medan($('#barn-spara'), 'Sparar…', async () => {
      if (bf.läge === 'ny') {
        const { error } = await supa.from('students').insert(Object.assign({ parent_id: S.user.id }, uppgifter));
        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        stängBarnForm();
        await laddaBarn();
        await Promise.all([laddaPlan(), laddaRapporter(), laddaLaxor(), laddaNexlax(), laddaProgress(), laddaPass()]);
        return;
      }

      const { error } = await supa.from('students').update(uppgifter).eq('id', S.valtBarn);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      const { error: aErr } = await supa.from('student_notes').upsert({
        student_id: S.valtBarn,
        parent_id: S.user.id,
        notes: $('#b-egna').value.trim() || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id' });
      if (aErr) { säg(msg, 'Uppgifterna sparades, men anteckningen gick inte: ' + felText(aErr), false); return; }
      säg(msg, '✓ Sparat.', true);
      await laddaBarn();
    });
  });

  /* ============================================================
     BARNENS INLOGGNING (barnkonton_och_admin)

     Per barn: skapa en inloggning (användarnamn, lösenord och
     vårdnadshavarens ja), byt lösenordet, pausa eller aktivera, ta bort
     inloggningen, och om barnet får läsa rapporterna. Allt utom
     rapportvalet går genom edge-funktionen barn-konto, som prövar att
     den inloggade är barnets förälder och öppnar det fönster databasen
     kräver för ett nytt lösenord. Rapportvalet är en kolumn på barnet
     som bara föräldern får ändra (skydda_studentfalt).

     Allt ritas med textContent, inte med innerHTML: namnet kommer ur
     databasen, och i rutan skrivs ett lösenord. Barnets lösenord visas
     aldrig, och vyn har ingenting att visa: det finns bara som en hash i
     Auth.

     Reglerna för användarnamn och lösenord är samma som i
     _delad/barnkonto.ts; funktionen prövar dem igen.
     ============================================================ */
  const BI_NAMN = /^[a-z0-9._-]{3,20}$/;
  S.barnkonton = null;
  S.biÖppen = {};

  async function laddaBarnkonton() {
    const ruta = $('#bi-ruta');
    if (!ruta) return;
    const { data, error } = await supa.rpc('mina_barnkonton');
    if (error) {
      /* PGRST202: funktionen finns inte, migrationen är inte körd. Då
         står rutan dold i stället för att visa ett fel. */
      if (error.code !== 'PGRST202' && error.code !== '42883') console.warn('mina_barnkonton:', error.message);
      S.barnkonton = null;
      ruta.hidden = true;
      return;
    }
    S.barnkonton = {};
    (data || []).forEach(r => { S.barnkonton[r.barn_id] = r; });
    ruta.hidden = !S.barn.length;
    ritaBarnkonton();
  }

  /* Ett element med text. Inget innerHTML: det som står i text kommer
     ofta ur databasen. */
  function biEl(tag, attr, ...barn) {
    const e = document.createElement(tag);
    Object.entries(attr || {}).forEach(([k, v]) => {
      if (v === true) e.setAttribute(k, '');
      else if (v != null && v !== false) e.setAttribute(k, String(v));
    });
    barn.flat().forEach(b => {
      if (b == null || b === false) return;
      e.appendChild(typeof b === 'string' ? document.createTextNode(b) : b);
    });
    return e;
  }

  function biNär(ts) {
    if (!ts) return 'Aldrig';
    const d = new Date(ts);
    return datumText(isoFor(d)) + ' kl. '
      + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function biFält(id, text, input, hjälp) {
    return biEl('div', { class: 'fgroup' },
      biEl('label', { for: id }, text), input,
      hjälp ? biEl('p', { class: 'xsmall bi-hjalp' }, hjälp) : null);
  }

  function biSkapaForm(b) {
    const namn = b.name;
    return biEl('form', { class: 'bi-form', 'data-bi-skapa': b.id, novalidate: true },
      biEl('div', { class: 'vy-form-rad' },
        biFält('bi-anv-' + b.id, 'Användarnamn',
          biEl('input', { class: 'inp', id: 'bi-anv-' + b.id, 'data-bi-anv': true, maxlength: 20,
            autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', inputmode: 'text' }),
          'Små bokstäver a–z, siffror, punkt, bindestreck eller understreck, 3–20 tecken.'),
        biFält('bi-los-' + b.id, 'Lösenord',
          biEl('input', { class: 'inp', id: 'bi-los-' + b.id, 'data-bi-los': true, type: 'password',
            autocomplete: 'new-password', minlength: 8 }),
          'Minst 8 tecken. Det visas aldrig igen, varken för er eller för oss.')),
      biFält('bi-los2-' + b.id, 'Upprepa lösenordet',
        biEl('input', { class: 'inp', id: 'bi-los2-' + b.id, 'data-bi-los2': true, type: 'password',
          autocomplete: 'new-password' })),
      biEl('label', { class: 'bi-ja' },
        biEl('input', { type: 'checkbox', 'data-bi-ja': true }),
        biEl('span', {},
          'Jag är vårdnadshavare för ' + namn + ' och godkänner att ' + namn + ' använder Nextrum. ',
          biEl('a', { href: '/integritetspolicy#barn', target: '_blank', rel: 'noopener' },
            'Så hanterar vi barnens uppgifter'))),
      biEl('div', { class: 'vy-knapprad' },
        biEl('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Skapa inloggning')));
  }

  function biLösenForm(b) {
    return biEl('form', { class: 'bi-form', 'data-bi-losenform': b.id, novalidate: true },
      biEl('div', { class: 'vy-form-rad' },
        biFält('bi-ny-' + b.id, 'Nytt lösenord',
          biEl('input', { class: 'inp', id: 'bi-ny-' + b.id, 'data-bi-los': true, type: 'password',
            autocomplete: 'new-password', minlength: 8 })),
        biFält('bi-ny2-' + b.id, 'Upprepa lösenordet',
          biEl('input', { class: 'inp', id: 'bi-ny2-' + b.id, 'data-bi-los2': true, type: 'password',
            autocomplete: 'new-password' }))),
      biEl('p', { class: 'xsmall bi-hjalp' },
        b.name + ' loggas ut på alla enheter och loggar in med det nya lösenordet.'),
      biEl('div', { class: 'vy-knapprad' },
        biEl('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Spara lösenordet'),
        biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-losen': b.id }, 'Avbryt')));
  }

  function biKonto(b, k) {
    const aktiv = k.barn_aktiv !== false;
    const rapporter = !!k.visa_rapporter;
    return [
      biEl('dl', { class: 'bi-fakta' },
        biEl('dt', {}, 'Användarnamn'), biEl('dd', {}, k.anvandarnamn),
        biEl('dt', {}, 'Loggar in på'), biEl('dd', {}, 'nextrum.se/barn'),
        biEl('dt', {}, 'Senast inloggad'), biEl('dd', {}, biNär(k.senast_inloggad))),
      biEl('div', { class: 'nx-nval bi-rapporter' },
        biEl('div', { class: 'nx-nval-text' },
          biEl('b', {}, 'Visa lektionsrapporter för ' + b.name),
          biEl('span', { class: 'xsmall' }, rapporter
            ? b.name + ' läser vad studiehjälparen skrev efter varje pass.'
            : 'Av: bara ni läser rapporterna.')),
        biEl('button', { class: 'chip', type: 'button', 'data-bi-rapporter': b.id,
          'aria-pressed': rapporter ? 'true' : 'false' }, rapporter ? 'På' : 'Av')),
      S.biÖppen[b.id] === 'losen' ? biLösenForm(b) : null,
      biEl('div', { class: 'vy-knapprad bi-knappar' },
        S.biÖppen[b.id] === 'losen' ? null
          : biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-losen': b.id }, 'Byt lösenord'),
        biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-paus': b.id,
          'data-bi-aktiv': aktiv ? '1' : '0' }, aktiv ? 'Pausa inloggningen' : 'Aktivera inloggningen'),
        biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-bort': b.id }, 'Ta bort inloggningen'))
    ];
  }

  function ritaBarnkonton() {
    const host = $('#bi-lista');
    if (!host || !S.barnkonton) return;
    const kort = S.barn.map(b => {
      const k = S.barnkonton[b.id] || {};
      const har = !!k.anvandarnamn;
      const läge = !har ? 'Ingen inloggning' : k.barn_aktiv === false ? 'Pausad' : 'Aktiv';
      return biEl('div', { class: 'bi-kort', 'data-bi': b.id },
        biEl('div', { class: 'bi-topp' },
          biEl('b', {}, b.name),
          biEl('span', { class: 'lage' + (har && k.barn_aktiv !== false ? ' klar' : '') }, läge)),
        har ? biKonto(b, k) : biSkapaForm(b));
    });
    host.replaceChildren(...kort);
  }

  /* Funktionens egen text ligger i error.context, inte i data (samma
     som i startaKassa). */
  async function barnkontoAnrop(body) {
    const svar = await supa.functions.invoke('barn-konto', { body });
    if (!svar.error) return { ok: true, data: svar.data || {} };
    let text = felText(svar.error);
    try {
      const kropp = await svar.error.context.json();
      if (kropp && kropp.error) text = kropp.error;
    } catch (_) { /* behåll texten ovan */ }
    return { ok: false, text };
  }

  function biBarn(id) { return S.barn.find(x => x.id === id) || null; }

  function biLösenKoll(form, anvandarnamn) {
    const a = $('[data-bi-los]', form).value, b = $('[data-bi-los2]', form).value;
    if (a.length < 8) return { fel: 'Lösenordet måste ha minst 8 tecken.', fält: $('[data-bi-los]', form) };
    if (a !== b) return { fel: 'Lösenorden är inte lika.', fält: $('[data-bi-los2]', form) };
    const jämför = a.trim().toLowerCase();
    if (anvandarnamn && (jämför === anvandarnamn || jämför === anvandarnamn + '@barn.nextrum.se')) {
      return { fel: 'Lösenordet får inte vara samma som användarnamnet.', fält: $('[data-bi-los]', form) };
    }
    return { fel: null, lösen: a };
  }

  const biRuta = $('#bi-lista');
  if (biRuta) {
    biRuta.addEventListener('submit', async e => {
      const form = e.target;
      const msg = $('#bi-msg');
      if (form.matches('[data-bi-skapa]')) {
        e.preventDefault();
        rensa(msg);
        const barn = biBarn(form.dataset.biSkapa);
        if (!barn) return;
        const anvandarnamn = $('[data-bi-anv]', form).value.trim().toLowerCase();
        if (!BI_NAMN.test(anvandarnamn)) {
          säg(msg, '⚠️ Användarnamnet ska vara 3–20 tecken: a–z, siffror, punkt, bindestreck eller understreck.', false);
          $('[data-bi-anv]', form).focus();
          return;
        }
        const k = biLösenKoll(form, anvandarnamn);
        if (k.fel) { säg(msg, '⚠️ ' + k.fel, false); k.fält.focus(); return; }
        if (!$('[data-bi-ja]', form).checked) {
          säg(msg, '⚠️ Kryssa i att du är vårdnadshavare och godkänner att ' + barn.name + ' använder Nextrum.', false);
          $('[data-bi-ja]', form).focus();
          return;
        }
        await medan(form.querySelector('button[type="submit"]'), 'Skapar…', async () => {
          const svar = await barnkontoAnrop({ atgard: 'skapa', barn_id: barn.id, anvandarnamn,
            losenord: k.lösen, vardnadshavare_godkand: true });
          if (!svar.ok) { säg(msg, svar.text, false); return; }
          await laddaBarnkonton();
          säg(msg, '✓ ' + barn.name + ' loggar nu in som ' + anvandarnamn + ' på nextrum.se/barn.', true);
        });
        return;
      }
      if (form.matches('[data-bi-losenform]')) {
        e.preventDefault();
        rensa(msg);
        const barn = biBarn(form.dataset.biLosenform);
        if (!barn) return;
        const konto = (S.barnkonton || {})[barn.id] || {};
        const k = biLösenKoll(form, konto.anvandarnamn || '');
        if (k.fel) { säg(msg, '⚠️ ' + k.fel, false); k.fält.focus(); return; }
        await medan(form.querySelector('button[type="submit"]'), 'Sparar…', async () => {
          const svar = await barnkontoAnrop({ atgard: 'byt_losenord', barn_id: barn.id, losenord: k.lösen });
          if (!svar.ok) { säg(msg, svar.text, false); return; }
          delete S.biÖppen[barn.id];
          ritaBarnkonton();
          säg(msg, '✓ Lösenordet är bytt. ' + barn.name + ' är utloggad och loggar in med det nya.', true);
        });
      }
    });

    biRuta.addEventListener('click', async e => {
      const msg = $('#bi-msg');
      const losen = e.target.closest('[data-bi-losen]');
      if (losen) {
        const id = losen.dataset.biLosen;
        if (S.biÖppen[id] === 'losen') delete S.biÖppen[id]; else S.biÖppen[id] = 'losen';
        rensa(msg);
        ritaBarnkonton();
        const fält = $('[data-bi-losenform="' + id + '"] [data-bi-los]', biRuta);
        if (fält) fält.focus();
        return;
      }

      const rapp = e.target.closest('[data-bi-rapporter]');
      if (rapp) {
        const barn = biBarn(rapp.dataset.biRapporter);
        if (!barn) return;
        const på = rapp.getAttribute('aria-pressed') !== 'true';
        rensa(msg);
        await medan(rapp, 'Sparar…', async () => {
          const { error } = await supa.from('students').update({ visa_rapporter: på }).eq('id', barn.id);
          if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
          await laddaBarnkonton();
        });
        return;
      }

      const paus = e.target.closest('[data-bi-paus]');
      if (paus) {
        const barn = biBarn(paus.dataset.biPaus);
        if (!barn) return;
        const pausa = paus.dataset.biAktiv === '1';
        if (pausa) {
          const ja = await bekräfta({
            titel: 'Pausa ' + barn.name + 's inloggning?',
            text: barn.name + ' loggas ut och kommer inte in förrän ni aktiverar inloggningen igen. '
              + 'Inget försvinner.',
            knapp: 'Pausa'
          });
          if (!ja) return;
        }
        rensa(msg);
        await medan(paus, pausa ? 'Pausar…' : 'Aktiverar…', async () => {
          const svar = await barnkontoAnrop({ atgard: pausa ? 'pausa' : 'aktivera', barn_id: barn.id });
          if (!svar.ok) { säg(msg, svar.text, false); return; }
          await laddaBarnkonton();
          säg(msg, pausa ? '✓ Inloggningen är pausad.' : '✓ Inloggningen är aktiv igen.', true);
        });
        return;
      }

      const bort = e.target.closest('[data-bi-bort]');
      if (bort) {
        const barn = biBarn(bort.dataset.biBort);
        if (!barn) return;
        const ja = await bekräfta({
          titel: 'Ta bort ' + barn.name + 's inloggning?',
          text: 'Användarnamnet och notiserna i barnets vy tas bort, och ' + barn.name
            + ' loggas ut. Studieplanen, passen och rapporterna står kvar hos er. '
            + 'Ni kan skapa en ny inloggning när ni vill.',
          knapp: 'Ta bort'
        });
        if (!ja) return;
        rensa(msg);
        await medan(bort, 'Tar bort…', async () => {
          const svar = await barnkontoAnrop({ atgard: 'ta_bort_inloggning', barn_id: barn.id });
          if (!svar.ok) { säg(msg, svar.text, false); return; }
          delete S.biÖppen[barn.id];
          await laddaBarnkonton();
          säg(msg, '✓ Inloggningen är borttagen.', true);
        });
      }
    });
  }

  /* ============================================================
     NEXLÄX (Fas 23.2)

     Leo 2026-09-29: Uppgifter och Min utveckling blir en sektion,
     NexLäx. Två flikar:
       Din väg         serien, XP, nästa steg, det studiehjälparen gett,
                       det senaste passet, ämnena och vägen genom banan
       Din utveckling  talen, ämnena, XP per vecka, dagarna, områdena,
                       studiehjälparens bedömning, passen, rättningen
                       och märkena
     Allt ritas av NXUppgifter (nextrum-uppgifter.js), ur fyra hämtningar
     här: katalogen, barnets försök, de påbörjade försöken och läget
     (XP och serien, räknade i databasen). Uppgifterna från
     studiehjälparen (homework) hämtas som förut, i laddaLaxor.

     Två sorters uppgift från studiehjälparen i samma lista. En VANLIG
     bockar familjen av själv: titel, instruktion och deadline ägs av
     studiehjälparen, och det är en trigger i databasen som håller den
     gränsen. En DIGITAL (homework.niva_id) är en nivå: den startas
     härifrån och blir klar när nivån klaras, av databasen.
     ============================================================ */
  async function laddaLaxor() {
    if (!S.valtBarn) {
      S.laxor = [];
      ritaÖvLaxor();
      ritaNexlax();
      if (passIdIAdressen()) ritaPassSida();
      return;
    }

    const barnet = S.valtBarn;
    let svar = await supa
      .from('homework')
      .select('id, student_id, title, instructions, subject, due_date, status, completed_at, created_at, '
        + 'bibliotek_id, biblioteksmaterial(titel, filvag, lank), '
        + 'niva_id, nivaer(id, titel, amne, arskurs, omrade, beskrivning, antal_fragor, aktiv)')
      .eq('student_id', barnet)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    /* Utan Fas 23.1 i databasen finns varken niva_id eller nivaer.
       Uppgifterna ska synas ändå, som förut. */
    if (svar.error && /niva/.test(svar.error.message || '')) {
      svar = await supa.from('homework')
        .select('id, student_id, title, instructions, subject, due_date, status, completed_at, created_at, '
          + 'bibliotek_id, biblioteksmaterial(titel, filvag, lank)')
        .eq('student_id', barnet)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
    }
    if (barnet !== S.valtBarn) return;
    const { data, error } = svar;

    /* Går de inte att hämta står vägen ändå, utan dem, och ett besked
       säger varför det som studiehjälparen gett inte syns. */
    if (error) {
      const msg = $('#upg-msg');
      if (msg) säg(msg, 'Det din studiehjälpare gett gick inte att hämta: ' + felText(error), false);
      S.laxorLaddade = true;
      ritaNexlax();
      return;
    }
    S.laxor = data || [];
    S.laxorLaddade = true;
    /* Passets sida läser S.laxor; den kan ha ritats innan uppgifterna kom. */
    if (passIdIAdressen()) ritaPassSida();
    ritaNotiser();
    ritaÖvLaxor();
    ritaStatistik();
    ritaNexlax();
  }

  /* Materialet från en uppgift. Sökvägen följde med i hämtningen —
     hinken är privat, så adressen skapas först vid klicket och
     slutar gälla av sig själv. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lax-mat]');
    if (!knapp) return;
    const h = (S.laxor || []).find(x => x.bibliotek_id === knapp.dataset.laxMat);
    const b = h && h.biblioteksmaterial;
    if (!b) return;
    if (b.lank) { window.open(b.lank, '_blank', 'noopener'); return; }
    await medan(knapp, '…', async () => {
      const url = await M.signera('bibliotek', b.filvag, 300);
      if (!url) { alert('Materialet gick inte att öppna just nu.'); return; }
      window.open(url, '_blank', 'noopener');
    });
  });

  /* Klar, Jag har börjat och Ångra på en vanlig uppgift. Kortet står
     kvar medan det sparas (medan()), och det som står ovanför det
     byter inte höjd av trycket. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lax]');
    if (!knapp) return;
    await medan(knapp, '…', async () => {
      const { error } = await supa.from('homework')
        .update({ status: knapp.dataset.lax }).eq('id', knapp.dataset.id);
      if (error) { alert('Kunde inte uppdatera uppgiften: ' + felText(error)); return; }
      await laddaLaxor();
      /* Serien räknar en uppgift som blev klar i dag. */
      laddaNexlaxLäge();
    });
  });

  async function laddaNexlax() {
    if (!S.valtBarn) {
      S.forsok = [];
      S.nl.pågående = {};
      S.nl.läge = null;
      S.nl.laddad = true;
      ritaNexlax();
      return;
    }
    const barnet = S.valtBarn;
    ['#nl-vag', '#nl-utveckling'].forEach(id => NXStudie.laddarFörsta($(id)));
    const [katalog, forsok, pågående, läge] = await Promise.all([
      U.laddaKatalog(supa), U.laddaFörsök(supa, barnet), U.laddaPågående(supa, barnet), U.laddaLäge(supa, barnet)]);
    if (barnet !== S.valtBarn) return;
    S.katalog = katalog;
    S.forsok = forsok || [];
    S.nl.pågående = pågående || {};
    S.nl.läge = läge;
    S.nl.laddad = true;
    ritaNexlax();
    ritaStatistik();
  }

  /* Bara läget: XP och serien, efter något som ändrar dem utan att
     försöken gör det (en uppgift från studiehjälparen bockad). */
  async function laddaNexlaxLäge() {
    if (!S.valtBarn) return;
    const barnet = S.valtBarn;
    const läge = await U.laddaLäge(supa, barnet);
    if (barnet !== S.valtBarn || !läge) return;
    S.nl.läge = läge;
    ritaNexlax();
  }

  function valtBarnet() { return S.barn.find(x => x.id === S.valtBarn) || null; }

  function namnPåBarnet() {
    const b = valtBarnet();
    return b ? (b.name || '').split(' ')[0] : 'eleven';
  }

  /* Banan vägen öppnar i: den familjen valt för barnet, annars det
     första av barnets ämnen som har en bana, sedan ämnet i en öppen
     digital uppgift, annars matematik. Årskursen väljer NXUppgifter ur
     barnets årskurs när ingen är vald. */
  function nlBana() {
    const val = S.banaVal[S.valtBarn] || {};
    const finns = U.banor(S.katalog || []);
    const barn = valtBarnet();
    const given = (S.laxor || []).find(h => h.niva_id && h.status !== 'klar' && h.nivaer);
    const amne = (val.amne && finns[val.amne]) ? val.amne
      : ((barn && barn.subjects) || []).find(a => finns[a])
        || (given && finns[given.nivaer.amne] ? given.nivaer.amne : null)
        || (finns.Matematik ? 'Matematik' : null);
    return { amne, arskurs: val.arskurs || '' };
  }

  function nlUnderlag() {
    const barn = valtBarnet();
    return {
      katalog: S.katalog, forsok: S.forsok || [], uppgifter: S.laxor || [], pågående: S.nl.pågående || {},
      läge: S.nl.läge, elevKod: NX.årskursKod(barn && barn.grade), elevNamn: namnPåBarnet(),
      rapporter: S.rapporter || [], progress: S.progress || [], historik: S.historik || {}, bokningar: (S.bokningar || [])
        .filter(b => b.student_id === S.valtBarn)
    };
  }

  function ritaNexlax() {
    ritaVägen();
    ritaNexlaxUtveckling();
  }

  function ritaVägen() {
    const host = $('#nl-vag');
    if (!host) return;
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }
    if (!S.nl.laddad || !S.laxorLaddade) return;
    const b = nlBana();
    const ut = U.ritaVäg(Object.assign(nlUnderlag(), {
      host, amne: b.amne, arskurs: b.arskurs, öppen: S.nl.öppen, nyss: S.nl.nyss,
      hjälpare: S.tutor ? { namn: S.tutor.full_name } : null
    }));
    /* Det som just klarades eller öppnades rör sig en gång, sedan inte. */
    S.nl.nyss = null;
    if (ut && ut.amne && !(S.banaVal[S.valtBarn] || {}).amne) S.banaVal[S.valtBarn] = { amne: ut.amne, arskurs: '' };
  }

  function ritaNexlaxUtveckling() {
    const host = $('#nl-utveckling');
    if (!host) return;
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }
    if (!S.nl.laddad) return;
    U.ritaUtveckling(Object.assign(nlUnderlag(), { host, alla: S.nl.alla }));
  }

  /* Ämnet, årskursen och en nod på vägen. Vägen ritas om, så knappen
     man tryckte på är en ny: den mäts före och efter och sidan flyttas
     med skillnaden, som NXStudie.håll gör för ett element som står
     kvar. Annars hade ett kort som stängs ovanför flyttat noden under
     fingret. */
  function ritaOchHåll(sel, fn) {
    const före = $(sel);
    const y = före ? före.getBoundingClientRect().top : null;
    fn();
    const ny = $(sel);
    if (ny && y !== null) {
      const efter = ny.getBoundingClientRect().top;
      if (Math.abs(efter - y) > 1) NXStudie.scrollaTill(window.scrollY + efter - y);
      ny.focus({ preventScroll: true });
    }
  }
  document.addEventListener('click', e => {
    const amne = e.target.closest('[data-nl-amne]');
    if (amne) {
      S.banaVal[S.valtBarn] = { amne: amne.dataset.nlAmne, arskurs: '' };
      S.nl.öppen = null;
      ritaOchHåll('[data-nl-amne="' + CSS.escape(amne.dataset.nlAmne) + '"]', ritaVägen);
      return;
    }
    const nod = e.target.closest('[data-nl-nod]');
    if (nod) {
      const id = nod.dataset.nlNod;
      S.nl.öppen = S.nl.öppen === id ? null : id;
      ritaOchHåll('[data-nl-nod="' + CSS.escape(id) + '"]', ritaVägen);
      return;
    }
    const alla = e.target.closest('[data-nl-alla]');
    if (alla) {
      const öppnar = !S.nl.alla;
      if (öppnar) { S.nl.alla = true; ritaNexlaxUtveckling(); }
      else ritaOchHåll('[data-nl-alla]', () => { S.nl.alla = false; ritaNexlaxUtveckling(); });
    }
  });
  document.addEventListener('change', e => {
    const sel = e.target.closest('[data-nl-arskurs]');
    if (!sel) return;
    const host = $('#nl-vag');
    S.banaVal[S.valtBarn] = { amne: host ? host.dataset.amne : '', arskurs: sel.value };
    S.nl.öppen = null;
    ritaVägen();
  });

  /* Starta en nivå, ur vägen, ur det primära steget eller ur en
     uppgift från studiehjälparen. */
  function spelaNivå(niva) {
    if (!niva || !S.valtBarn) return;
    const barnet = S.valtBarn;
    U.spela({
      supa, niva, elev: barnet,
      katalog: S.katalog || [], forsok: S.forsok || [], uppgifter: S.laxor || [],
      pågående: S.nl.pågående || {}, läge: S.nl.läge,
      hämtaLäge: () => U.laddaLäge(supa, barnet),
      onStäng: ut => {
        if (!ut || !ut.ändrat) return;
        S.nl.öppen = null;
        S.nl.nyss = { klar: ut.klar, oppen: ut.oppen };
        laddaLaxor();
        laddaNexlax();
      }
    });
  }
  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-nl-starta]');
    if (k) {
      const niva = (S.katalog || []).find(n => n.id === k.dataset.nlStarta);
      spelaNivå(niva);
      return;
    }
    const u = e.target.closest('[data-lax-starta]');
    if (u) {
      const h = (S.laxor || []).find(x => x.id === u.dataset.laxStarta);
      if (!h || !h.nivaer) return;
      if (!S.katalog) S.katalog = await U.laddaKatalog(supa) || [];
      spelaNivå((S.katalog || []).find(n => n.id === h.niva_id) || h.nivaer);
      return;
    }
    const g = e.target.closest('[data-upg-genomgang]');
    if (g) U.genomgång(supa, g.dataset.upgGenomgang);
  });

  /* ============================================================
     STUDIEHJÄLPARENS BEDÖMNING
     Läsvy. Det är studiehjälparen som sätter nivåerna; de står under
     Din utveckling i NexLäx och i Så går det på Översikt.
     ============================================================ */
  async function laddaProgress() {
    if (!S.valtBarn) {
      S.progress = [];
      S.historik = {};
      S.progressAntal = 0;
      ritaStatistik();
      ritaNexlaxUtveckling();
      return;
    }
    const barnet = S.valtBarn;
    const [svar, hist] = await Promise.all([
      supa.from('progress_items').select('id, subject, area, level, steg, mal_steg, comment, updated_at')
        .eq('student_id', barnet).order('subject').order('area'),
      supa.from('progress_historik').select('progress_id, subject, area, steg, bedomd_at')
        .eq('student_id', barnet).order('bedomd_at')
    ]);
    if (barnet !== S.valtBarn) return;
    if (svar.error) { console.warn('Bedömningarna gick inte att hämta', svar.error); return; }

    /* Historiken är ett tillägg: faller den frågan visas läget ändå,
       bara utan det som handlar om tid. */
    S.historik = {};
    if (!hist.error) (hist.data || []).forEach(h => {
      (S.historik[h.progress_id] = S.historik[h.progress_id] || []).push(h);
    });

    S.progress = svar.data || [];
    S.progressAntal = S.progress.length;
    ritaStatistik();
    ritaNexlaxUtveckling();
  }

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
        .update({ full_name: namn, phone: $('#k-tel').value.trim() || null, bio: $('#k-bio').value.trim() || null })
        .eq('id', S.user.id);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      S.profil.full_name = namn;
      ritaHeader();
      ritaKontoAvatar();
      if (S.hero) S.hero.uppdatera({ namn });
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

  /* ============ studieplan ============ */
  async function laddaPlan() {
    const host = $('#plan-body');
    $('#plan-uppdaterad').textContent = '';
    if (!S.valtBarn) {
      host.innerHTML = '<div class="empty">Lägg till ditt barn ovan, så skriver vi planen.</div>';
      return;
    }
    NXStudie.laddarFörsta(host);
    const { data, error } = await supa
      .from('study_plans').select('subject, goals, plan_text, updated_at')
      .eq('student_id', S.valtBarn).order('updated_at', { ascending: false }).limit(1);

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    if (!data || !data.length) {
      S.plan = null;
      host.innerHTML = '<div class="empty">Studieplanen är inte skriven än.<br><br>'
        + 'Vi tar fram den efter första kontakten, utifrån vad ditt barn behöver.</div>';
      return;
    }
    const p = data[0];
    S.plan = p;
    $('#plan-uppdaterad').textContent = p.updated_at ? 'uppdaterad ' + datumText(isoFor(new Date(p.updated_at))) : '';
    host.innerHTML =
      '<div class="plan-meta">'
      + (p.subject ? '<span class="tag">' + esc(p.subject) + '</span>' : '')
      + '</div>'
      + (p.goals ? '<p class="small" style="margin-bottom:16px"><b>Mål:</b> ' + esc(p.goals) + '</p>' : '')
      + '<div class="plan-body">' + esc(p.plan_text || '') + '</div>';
  }

  /* Frågan om en recension.

     Två villkor, båda nödvändiga: en länk måste finnas i
     nextrum-config.js, och familjen måste ha minst två rapporter.
     Det andra är inte godtyckligt — efter ETT pass vet ingen ännu
     om det hjälpte, och en recension skriven då säger inget om
     något. Efter två har man en uppfattning.

     Vi frågar. Vi bjuder inte, lockar inte och upprepar inte —
     köpta eller framtvingade recensioner stänger profilen, och
     det är dessutom vilseledande mot nästa förälder. */
  function ritaRecension(antal) {
    const ruta = $('#recension');
    if (!ruta) return;
    const lank = (NX.CFG && NX.CFG.GOOGLE_RECENSION_URL) || '';
    if (!lank || antal < 2) { ruta.hidden = true; ruta.innerHTML = ''; return; }

    ruta.hidden = false;
    ruta.innerHTML =
      '<div class="vy-recension">'
      + '<b>Har det hjälpt?</b>'
      + '<p>Två rader om hur det gått betyder mycket för nästa familj som '
      + 'letar. Det tar en minut.</p>'
      + '<a class="btn btn-ghost btn-sm" href="' + esc(lank) + '" '
      + 'target="_blank" rel="noopener noreferrer">Skriv en recension på Google</a>'
      + '</div>';
  }

  /* ============ rapporter ============ */
  async function laddaRapporter() {
    const host = $('#rapporter');
    $('#rapport-antal').textContent = '';
    if (!S.valtBarn) { host.innerHTML = '<div class="empty">Välj ett barn för att se rapporterna.</div>'; return; }

    NXStudie.laddarFörsta(host);
    const { data, error } = await supa
      .from('lesson_reports').select('id, booking_id, student_id, tutor_id, lesson_date, raw_notes, ai_feedback, gick, amne, went_well, needs_practice, next_focus, start_tid, slut_tid, debiterade_min, hallna_min, narvaro, avvikelse_skal')
      .eq('student_id', S.valtBarn).order('lesson_date', { ascending: false });

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }

    S.rapporter = data || [];
    ritaStatistik();
    /* NexLäx läser dem: det senaste passets fokus på vägen, och passen
       under Din utveckling. */
    ritaNexlax();

    if (!data || !data.length) {
      host.innerHTML = '<div class="empty">Inga rapporter än. Den första kommer efter första passet.</div>';
      ritaRecension(0);
      return;
    }
    $('#rapport-antal').textContent = data.length + ' st';
    ritaRecension(data.length);
    /* Samma brev som under Bekräfta rapport (2026-09-28). Förut en egen
       kopia med andra ord: "Behöver träna på" här, "Öva mer på" där. */
    host.innerHTML = data.map(r => rbBrev(r, rbPass(r))).join('');
  }

  /* Svarsknapparna på en föreslagen tid. Tre ställen visar dem —
     passlistan, passrutan och Översikt — och de tre måste säga samma
     sak. Två kopior fanns redan och hade hunnit skilja sig åt i
     märkningen; en tredje hade varit en tredje som kan glida isär. */
  /* Pengar på passet: betalt med kort, eller i tvist. Då nekar
     databasen en avbokning härifrån (Fas 14.1), för det är Nextrum som
     betalar tillbaka. Ett pass betalt med timmar har inga pengar på sig
     (Fas 21.1): familjen avbokar det själv, och timmarna kommer tillbaka
     av sig själva. Samma villkor som skydda_bokningsfalt, som sedan Fas
     22.1 också släpper igenom ett pass betalt med timbanken. */
  function pengarPå(b) {
    if (b.betalning_status === 'tvist') return true;
    if (b.betalning_status !== 'betald') return false;
    return !((b.klippkort_id || medBanken(b)) && !Number(b.betalt_ore || 0));
  }
  const medTimmar = b => b.betalning_status === 'betald' && !!b.klippkort_id && !pengarPå(b);
  /* Fas 22.1: passet är betalt med minuterna i timbanken. Uttagen läses
     med erbjudandena (laddaErbjudanden). */
  function medBanken(b) {
    const u = S.erb && S.erb.bank && S.erb.bank.perPass[b.id];
    return b.betalning_status === 'betald' && !b.klippkort_id && !!(u && u.pass);
  }

  /* Vem passet gäller, efter ämnet i raden: "Matematik med Alva".
     Förnamnet räcker, familjen vet vem Alva är. Tiden och platsen ritar
     passRad själv (2026-09-28); förut fogade varje lista in dem i sin
     egen rad, och platsen stod två gånger när båda gjorde det. */
  function medBarn(b) {
    const barn = S.barn.find(x => x.id === b.student_id);
    return barn && barn.name ? 'med ' + String(barn.name).trim().split(/\s+/)[0] : '';
  }

  /* ============================================================
     SVARET PÅ FÖRSLAGET (2026-09-30)
     Ett motförslag är en tid studiehjälparen svarat med när familjen
     föreslagit en annan (motforslag_at, stämplat av databasen). Det
     besvaras med ja eller nej, inte med en tredje tid: det nekar
     skydda_bokningsfalt, och knappen står inte här. Passar den nya
     tiden inte föreslår familjen en ny under Boka pass. Undantaget är
     ett pass med kortpengar på, som inte går att avböja härifrån.

     Avslår studiehjälparen familjens tid står det varför på passet
     (svar_meddelande). Texten ritas genom esc(), som allt annat.
     ============================================================ */
  const ärMotförslag = b => b.status === 'requested' && !!b.motforslag_at;

  /* Vem som avbokade, sett härifrån: ni, studiehjälparen eller Nextrum
     (admin eller ett schema). Samma jämförelse som analys_avbokningar. */
  function avbokadAv(b) {
    if (b.avbokad_av && b.avbokad_av === S.user.id) return 'jag';
    if (b.avbokad_av && b.avbokad_av === b.tutor_id) return 'motpart';
    return 'nextrum';
  }
  function avbokadText(b) {
    const av = avbokadAv(b);
    if (b.avbokad_fran === 'requested') {
      if (b.avbokad_av && b.avbokad_av === b.created_by) {
        return av === 'jag' ? 'Ni drog tillbaka förslaget' : 'Studiehjälparen drog tillbaka sitt förslag';
      }
      return av === 'jag' ? 'Ni avböjde tiden' : av === 'motpart' ? 'Avslagen av studiehjälparen' : 'Avböjd av Nextrum';
    }
    const skäl = NXStudie.skälText(b.avbokningsskal);
    return (av === 'jag' ? 'Avbokat av er' : av === 'motpart' ? 'Avbokat av studiehjälparen' : 'Avbokat av Nextrum')
      + (skäl ? ' · ' + skäl.toLowerCase() : '');
  }
  // Studiehjälparen avslog familjens tid, och skrev varför.
  const avslagen = b => b.status === 'cancelled' && b.avbokad_fran === 'requested'
    && avbokadAv(b) === 'motpart' && b.avbokad_av !== b.created_by;

  function svarsKnappar(b, små) {
    const s = små ? ' btn-sm' : '';
    /* Ett betalt pass som flyttats är en förfrågan igen, men att avböja
       det är att avboka det, och det nekar databasen (Fas 14.1). Passar
       ingen tid är det Nextrum som betalar tillbaka — passets sida
       säger det. Ett pass betalt med timmar går att avböja (Fas 21.1). */
    const betalt = pengarPå(b);
    return '<button type="button" class="btn btn-primary' + s + '" data-passvar="confirmed" data-id="' + esc(b.id) + '">'
         + (ärMotförslag(b) ? 'Acceptera ny tid' : 'Passar bra') + '</button>'
         + (betalt ? '' : '<button type="button" class="btn btn-ghost' + s + '" data-passvar="cancelled" data-id="' + esc(b.id) + '">Avböj</button>');
  }

  /* ============================================================
     ÖVERSIKT (2026-09-28)
     Det som väntar på familjen först, i EN lista: tider att svara på,
     rapporter att bekräfta och försenade läxor. Sedan de närmaste
     passen. Förut stod bara de föreslagna tiderna här, och resten av
     sidan var statistik.

     En föreslagen tid håller studiehjälparens kalender ockuperad tills
     någon svarat, och står därför överst och inte bara i passlistan
     en sektion bort. Raderna byggs av samma NXKontakt.passRad med
     samma data-passvar-knappar som passlistan, så den delegerade
     hanteraren tar båda uppsättningarna och svarar man här ritas
     listan om på köpet — ingen andra logik som kan hamna ur synk med
     den första.
     ============================================================ */
  const passNyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');

  function ritaÖvGöra() {
    const grupp = $('#ov-gora-grupp'), host = $('#ov-gora');
    if (!grupp || !host) return;
    const idag = isoFor(new Date());
    const hjälpare = String((S.tutor && S.tutor.full_name) || '').split(' ')[0];

    const föreslagna = (S.bokningar || [])
      .filter(b => b.status === 'requested' && b.created_by && b.created_by !== S.user.id
        && b.wanted_date >= idag)
      .sort((a, c) => passNyckel(a).localeCompare(passNyckel(c)));
    const rader = föreslagna.map(b => NXKontakt.passRad(b, {
      href: '#pass/' + b.id,
      med: medBarn(b),
      /* På ett motförslag är studiehjälparens rader det man läser, inte
         familjens egen anteckning (2026-09-30). */
      not: NXKontakt.kortNot(ärMotförslag(b) && b.svar_meddelande ? b.svar_meddelande : b.note),
      vem: ärMotförslag(b)
        ? (hjälpare ? hjälpare + ' kan inte er tid och föreslår den här' : 'Motförslag från er studiehjälpare')
        : hjälpare ? hjälpare + ' föreslår den här tiden' : 'Föreslaget av er studiehjälpare',
      lage: null,
      atgarder: svarsKnappar(b, true)
    }));

    /* En tid studiehjälparen avslagit den senaste veckan, som inte har
       passerat: nästa drag är familjens, att föreslå en ny. Utan raden
       stod avslaget bara i den hopfällda gruppen Avbokade pass, och
       familjen fick veta det genom mejlet och ingen annanstans. */
    const vecka = Date.now() - 7 * 864e5;
    const avslagna = (S.bokningar || [])
      .filter(b => avslagen(b) && b.wanted_date >= idag && b.avbokad_at && Date.parse(b.avbokad_at) >= vecka)
      .sort((a, c) => String(c.avbokad_at).localeCompare(String(a.avbokad_at)));
    avslagna.forEach(b => rader.push(NXKontakt.passRad(b, {
      href: '#pass/' + b.id,
      med: medBarn(b),
      not: b.svar_meddelande ? NXKontakt.kortNot(b.svar_meddelande) : null,
      vem: (hjälpare || 'Studiehjälparen') + ' kan inte den tiden',
      lage: { text: 'Avslagen', klass: 'avbokad' },
      atgarder: '<a class="btn btn-primary btn-sm" href="#boka">Föreslå ny tid</a>'
    })));

    /* Rapporterna räknas först när både de och passen finns, som under
       Bekräfta rapport: utan passen ser ett obetalt pass betalt ut. */
    const att = S.rb.laddat && S.laddatPass ? rbAttBekräfta() : [];
    if (att.length) {
      const namn = att.slice(0, 3).map(r => rbTitel(r, rbPass(r)));
      const obetalda = att.filter(rbObetald).length;
      rader.push(NXStudie.radLank({
        href: '#bekrafta', ikon: 'rapport',
        titel: att.length === 1 ? 'En rapport att bekräfta' : att.length + ' rapporter att bekräfta',
        meta: [namn.join(', ') + (att.length > 3 ? ' …' : ''),
          obetalda ? (obetalda === 1 ? (att.length === 1 ? 'passet är inte betalt' : 'en med något att betala')
            : obetalda + ' med något att betala') : null],
        lank: 'Läs och bekräfta'
      }));
    }

    /* S.laxor är det valda barnets uppgifter, som i NexLäx. */
    const sena = (S.laxor || []).filter(h => h.status !== 'klar' && h.due_date && h.due_date < idag)
      .sort((a, c) => String(a.due_date).localeCompare(String(c.due_date)));
    if (sena.length) {
      rader.push(NXStudie.radLank({
        href: '#nexlax/vag', ikon: 'lax', ton: 'ockra',
        titel: sena.length === 1 ? 'En uppgift är försenad' : sena.length + ' uppgifter är försenade',
        meta: [sena[0].title + (sena.length > 1 ? ' och ' + (sena.length - 1) + ' till' : ''),
          'skulle vara klar ' + NXStudie.deadlineText(sena[0].due_date).replace(/^./, c => c.toLowerCase())],
        lank: sena.length === 1 ? 'Till uppgiften' : 'Till uppgifterna'
      }));
    }

    /* Dold, inte tom: en ruta som står kvar och säger "inget att
       göra" tar plats överst varje gång man öppnar vyn. */
    grupp.hidden = !rader.length;
    $('#ov-gora-antal').textContent = rader.length ? String(föreslagna.length + avslagna.length + att.length + sena.length) : '';
    host.innerHTML = rader.join('');
  }

  /* De närmaste passen, högst tre. Ett förslag från studiehjälparen står
     redan under Att göra; ett eget förslag som väntar på svar står här. */
  function ritaÖvKommande() {
    const host = $('#ov-kommande');
    if (!host || !S.laddatPass) return;
    const idag = isoFor(new Date());
    const kommande = (S.bokningar || [])
      .filter(b => b.wanted_date >= idag && (b.status === 'confirmed'
        || (b.status === 'requested' && (!b.created_by || b.created_by === S.user.id))))
      .sort((a, c) => passNyckel(a).localeCompare(passNyckel(c)))
      .slice(0, 3);
    host.innerHTML = kommande.length
      ? kommande.map(b => NXKontakt.passRad(b, {
          href: '#pass/' + b.id,
          med: medBarn(b),
          nu: b.wanted_date === idag,
          märke: NXKontakt.betalMärke(b)
        })).join('')
      : tomt('Inga kommande pass', 'Boka en tid under Boka pass, så står passet här.');
  }

  /* ============================================================
     BEKRÄFTA RAPPORT (Fas 19.1)

     Leo 2026-09-27: rapporten ska komma till familjen i en egen post i
     menyn, där de läser den och bekräftar den, och är passet inte
     betalt bekräftar de genom att välja hur det betalas.

     TRE SÄTT ATT BETALA (Fas 19.2, Leo samma dag): kort i förväg, kort
     efter passet och faktura efter passet. Det första görs när tiden är
     bekräftad. De två andra görs HÄR, i samband med bekräftelsen, och
     villkoren säger det. Är passet redan betalt bekräftar familjen
     ändå: bekräftelsen är att de läst rapporten, betalningen är en egen
     sak.

     BEKRÄFTELSEN ÄR INTE VILLKORET FÖR BETALNINGEN. Ett pass som hölls
     ska betalas även om ingen trycker här, och villkoren säger det
     också. rapport_bekraftelser säger bara att familjen läst rapporten.
     En rapport står därför kvar under Att bekräfta tills den är
     bekräftad OCH passet inte längre väntar på betalning — annars hade
     ett obetalt pass kunnat "bekräftas" bort ur sikte.

     Att välja betalsätt på ett genomfört pass bekräftar dess rapport,
     här eller på passets sida (rapportFörPass). Den som väljer har
     rapporten framför sig. Avbryts kassan står rapporten kvar,
     bekräftad och obetald, och säger det.

     Alla barn på en gång, inte bara det valda i barnväljaren: det som
     väntar på familjen ska inte gömma sig bakom ett val de gjorde för
     att läsa något annat.
     ============================================================ */
  S.rb = { rapporter: [], bekräftade: {}, laddat: false };

  async function laddaBekrafta() {
    const host = $('#rb-lista');
    if (!host) return;
    const barn = (S.barn || []).map(x => x.id);
    if (!barn.length) { S.rb.rapporter = []; S.rb.laddat = true; ritaBekrafta(); return; }

    NXStudie.laddarFörsta(host);
    const [rap, bek] = await Promise.all([
      supa.from('lesson_reports')
        .select('id, booking_id, student_id, tutor_id, lesson_date, amne, gick, ai_feedback, raw_notes, needs_practice, next_focus, start_tid, slut_tid, debiterade_min, avvikelse_skal')
        .in('student_id', barn).order('lesson_date', { ascending: true }),
      supa.from('rapport_bekraftelser').select('rapport_id, bekraftad_at')
    ]);
    if (rap.error) { host.innerHTML = '<div class="empty">' + esc(felText(rap.error)) + '</div>'; return; }
    /* Kan bekräftelserna inte läsas står varje rapport som obekräftad.
       Fel åt det säkra hållet: en rapport för mycket att bekräfta, aldrig
       en som försvinner utan att ha lästs. En bekräftelse till av samma
       rapport nekas av databasen och räknas här som att det gick. */
    if (bek.error) console.warn('Bekräftelserna gick inte att läsa', bek.error);
    S.rb.rapporter = rap.data || [];
    S.rb.bekräftade = {};
    (bek.data || []).forEach(x => { S.rb.bekräftade[x.rapport_id] = x.bekraftad_at; });
    S.rb.laddat = true;
    ritaBekrafta();
    ritaNotiser();
    // Passets sida visar Bekräfta rapporten först när bekräftelserna finns.
    if (passIdIAdressen()) ritaPassSida();
  }

  const rbPass = r => (r.booking_id && (S.bokningar || []).find(b => b.id === r.booking_id)) || null;
  const rbObetald = r => { const b = rbPass(r); return !!(b && kanBetalas(b)); };
  /* Samma urval för listan, siffran i menyn och notisen. Ett obetalt
     tillägg (Fas 20.1) håller kvar rapporten på samma sätt som ett
     obetalt pass: övertiden betalas när rapporten bekräftas. */
  const rbAttBekräfta = () => S.rb.rapporter.filter(r => !S.rb.bekräftade[r.id] || rbObetald(r)
    || !!(rbPass(r) && tillägg(rbPass(r))));

  /* Rubriken på brevet: "Engelska med Theo". */
  function rbTitel(r, b) {
    const barn = S.barn.find(x => x.id === r.student_id);
    return ((b && b.subject) || r.amne || 'Pass') + (barn ? ' med ' + barn.name.split(' ')[0] : '');
  }

  /* ============================================================
     DEN HÅLLNA TIDEN (Fas 20.1)

     Studiehjälparen skriver i rapporten när passet faktiskt hölls, och
     familjen betalar den tiden per påbörjad kvart (debiterade_min). Det
     familjen ser ska vara det kassan tar: därför står tiden, och varför
     den skiljer sig från det bokade, i rapporten där de bekräftar den,
     överallt där rapporten läses, i samma ord.

     Sedan 2026-09-28 ritas den av NXStudie.rapportKort: en tidslinje när
     tiden skiljer sig från det bokade eller har ett skäl, annars bara
     tiden i raden överst. Äldre rapporter har ingen tid, och då gäller
     det bokade. Då står heller ingen tidslinje: en rad som säger "tiden
     saknas" hade fått en vanlig rapport att se ofullständig ut.

     Skälet är studiehjälparens fritext och escapas som all annan
     fritext. Det står i en pratbubbla med vem som skrev det, så att det
     inte läses som Nextrums besked.
     ============================================================ */
  function tidLängd(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    const h = Math.floor(m / 60), rest = m % 60;
    if (!h) return rest + ' min';
    if (!rest) return h === 1 ? '1 timme' : h + ' timmar';
    return h + ' h ' + rest + ' min';
  }

  const versal = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  // "16 sep": där ett helt datum hade tryckt ut raden.
  const kortDatum = iso => {
    const d = String(iso || '').split('-');
    return d[2] ? Number(d[2]) + ' ' + (NX.MANADER[Number(d[1]) - 1] || '').slice(0, 3) : '';
  };

  /* ============================================================
     RAPPORTEN SOM ETT BREV (2026-09-28)

     Samma kort på alla tre ställen där familjen läser en rapport: under
     Bekräfta rapport, under Mina lektioner → Efter passen och på passets
     sida (NXStudie.rapportKort). Förut var det tre kopior av samma rader,
     och en av dem hade redan tappat den hållna tiden.

     Brevet är från den som skrev det. Är rapporten skriven av en annan
     studiehjälpare än den familjen har nu står inget namn, hellre än
     fel namn.
     ============================================================ */
  function rbDelar(r, b) {
    const t = S.tutor || {};
    const vår = !r.tutor_id || r.tutor_id === S.profil.matched_tutor_id;
    const namn = vår && t.full_name ? t.full_name : '';
    const förnamn = namn ? namn.split(' ')[0] : '';
    const u = b ? underlagFör(b) : null;
    const plats = !b ? null
      : b.format === 'Online' ? { ikon: 'online', text: 'Online' }
      : (b.location || b.format) ? { ikon: 'plats', text: String(b.location || b.format).split(',')[0] }
      : null;
    const tid = r.start_tid && r.slut_tid ? String(r.start_tid).slice(0, 5) + '–' + String(r.slut_tid).slice(0, 5)
      : b ? NXStudie.tidsspann(b.wanted_time, b.duration_min) : '';
    return {
      titel: rbTitel(r, b),
      vem: namn ? { namn: namn, bild: S.tutorAvatar } : null,
      meta: [förnamn ? 'Rapport från ' + förnamn : 'Rapport från er studiehjälpare',
        r.lesson_date ? { ikon: 'dag', text: versal(NXStudie.dagMedVeckodag(r.lesson_date)) } : null,
        tid ? { ikon: 'tid', text: tid } : null,
        plats],
      gick: r.gick,
      text: r.ai_feedback || r.raw_notes,
      trana: r.needs_practice,
      nasta: r.next_focus,
      tid: r.start_tid && r.slut_tid ? {
        start: r.start_tid, slut: r.slut_tid,
        bokat: b ? Number(b.duration_min || 60) : 0,
        deb: Number(r.debiterade_min || 0),
        bank: u ? Number(u.timbank_min || 0) : 0,
        skal: r.avvikelse_skal, skalAv: förnamn || 'Studiehjälparen'
      } : null
    };
  }
  const rbBrev = (r, b, extra) => NXStudie.rapportKort(Object.assign(rbDelar(r, b), extra || {}));

  /* Tillägget på ett pass som var betalt i förväg och drog över.
     Svarar null när det inte finns något att betala: passet är inte
     genomfört eller inte betalt, tiden gick inte över det betalda,
     eller tillägget är redan betalt (eller bestritt).

     Beloppet räknas här bara för att visas. stripe-checkout räknar det
     igen ur databasen och tar det den räknar; talet här är samma regel
     (tillaggsbelopp i _delad/pris.ts), så att knappen och kassan säger
     samma sak. Går priset inte att räkna står knappen utan belopp, och
     kassan säger det. Blir det noll — rabatten täcker övertiden —
     nekar funktionen, och då finns heller ingen knapp. */
  function tillägg(b) {
    if (!b || b.status !== 'completed' || b.fakturerbar === false || b.betalning_status !== 'betald') return null;
    const u = underlagFör(b);
    if (!u) return null;
    const t = (S.tillagg || {})[b.id];
    /* Återbetalt är ett beslut Nextrum tagit om tillägget, inte ett
       obetalt tillägg: det erbjuds inte igen (Fas 20.4). */
    if (t && (t.status === 'betald' || t.status === 'tvist' || t.status === 'aterbetald')) return null;
    const deb = Number(u.debiterade_min || 0), betalda = Number(u.betalda_min || 0);
    if (!(deb > betalda)) return null;
    const hela = prisFör(b, deb), förut = prisFör(b, betalda);
    const belopp = hela === null || förut === null ? null : Math.max(hela - förut, 0);
    if (belopp === 0) return null;
    return { minuter: deb - betalda, belopp: belopp, status: t ? t.status : null };
  }

  function tilläggRad(till) {
    return 'Passet drog över med ' + tidLängd(till.minuter) + '.'
      + (till.status === 'vantar' ? ' En betalning av tillägget är påbörjad men inte klar.'
        : till.status === 'misslyckad' ? ' Förra försöket gick inte igenom.' : '');
  }

  function tilläggKnapp(b, till, liten) {
    return '<button type="button" class="btn btn-primary' + (liten ? ' btn-sm' : '') + '" data-tillagg="' + esc(b.id) + '">'
      + 'Betala tillägget' + (till.belopp ? ', ' + esc(NXBetalning.kronor(till.belopp)) : '') + '</button>';
  }

  /* Foten under brevet: det som väntar och valen. Obetalt: betalvalen,
     och att välja ett ÄR bekräftelsen, så ingen separat
     bekräfta-knapp (då hade ett obetalt pass gått att bekräfta ur
     listan utan att betalas). Beloppet är det kassan tar: den
     debiterade tiden (Fas 20.1). Betalt i förväg och drog över: samma
     regel för tillägget. Annars: vad som gäller för betalningen, och
     Bekräfta rapporten. */
  function rbKort(r) {
    const b = rbPass(r);
    const bekräftad = S.rb.bekräftade[r.id];
    const till = b ? tillägg(b) : null;
    const visa = b ? '<a class="vy-lank" href="#pass/' + esc(b.id) + '">Visa passet' + NXStudie.IKON.pil + '</a>' : '';
    let fot;
    if (b && kanBetalas(b)) {
      const pris = passetsPris(b);
      const hjälp = (bekräftad ? 'Rapporten är bekräftad, men passet är inte betalt än.'
          : 'Passet är inte betalt än. Välj hur ni betalar, så är rapporten bekräftad.')
        + (b.betalning_status === 'vantar' ? ' En betalning är påbörjad men inte klar.'
          : b.betalning_status === 'misslyckad' ? ' Förra försöket gick inte igenom.' : '');
      const not = fakturaNotText(b);
      fot = '<div class="rb-fot-rad"><div>'
        + (pris ? '<p class="rb-att"><small>Att betala</small><b>' + esc(NXBetalning.kronor(pris)) + '</b></p>' : '')
        + '<p class="rb-hjalp">' + esc(hjälp) + '</p></div>' + visa + '</div>'
        + '<div class="vy-betalval">' + betalVal(b) + '</div>'
        + (not ? '<p class="rb-finstilt">' + esc(not) + '</p>' : '');
    } else if (till) {
      fot = '<div class="rb-fot-rad"><div>'
        + (till.belopp ? '<p class="rb-att"><small>Tillägg att betala</small><b>' + esc(NXBetalning.kronor(till.belopp)) + '</b></p>' : '')
        + '<p class="rb-hjalp">' + esc(tilläggRad(till) + ' ' + (bekräftad ? 'Rapporten är bekräftad, men tillägget är inte betalt än.'
          : 'Betala tillägget, så är rapporten bekräftad.')) + '</p></div>'
        + '<div class="rb-fot-knappar">' + visa
        + '<button type="button" class="btn btn-primary" data-tillagg="' + esc(b.id) + '">Betala tillägget</button></div></div>';
    } else {
      const läge = !b || b.fakturerbar === false ? ''
        : ingetAttBetala(b) ? 'Passet kostar ingenting: ' + påKöpet(b).replace(' på köpet', ' är på köpet') + '.'
        : b.betalning_status === 'faktura' ? 'Passet betalas mot faktura.'
        : b.betalning_status === 'betald' ? (b.klippkort_id ? 'Passet är betalt med timmar.'
          : medBanken(b) ? 'Passet är betalt med timbanken.' : 'Passet är betalt.')
        : (BETALNING_TEXT[b.betalning_status] ? 'Betalning: ' + BETALNING_TEXT[b.betalning_status].toLowerCase() + '.' : '');
      fot = '<div class="rb-fot-rad">'
        + (läge ? '<p class="rb-klart"><span class="rb-bock">' + NXStudie.IKON.bock + '</span><span>' + esc(läge) + '</span></p>' : '<span></span>')
        + '<div class="rb-fot-knappar">' + visa
        + '<button type="button" class="btn btn-primary" data-rb-bekrafta="' + esc(r.id) + '">Bekräfta rapporten</button></div></div>';
    }
    return rbBrev(r, b, { attr: 'data-rb-rapport="' + esc(r.id) + '"', fot: fot });
  }

  /* Ritas först när både rapporterna och passen finns: utan passen ser
     ett obetalt pass betalt ut, och knappen hade bytts under fingret. */
  function ritaBekrafta() {
    const host = $('#rb-lista');
    if (!host || !S.rb.laddat || !S.laddatPass) return;
    const att = rbAttBekräfta();
    $('#rb-antal').textContent = att.length ? String(att.length) : '';
    if (S.sido) S.sido.märke('bekrafta', att.length);
    ritaÖvGöra();

    host.innerHTML = att.length ? att.map(rbKort).join('')
      : tomt('Inget att bekräfta', 'När er studiehjälpare har skrivit rapporten efter ett pass står den här.');
    rbRitaKlara(att);
  }

  /* DE BEKRÄFTADE, MÅNAD FÖR MÅNAD (2026-09-28). Leo: "bekräftade
     rapporter ska filtreras efter månad". Samma rad som rapporterna i
     studiehjälparvyn, den innevarande månaden förvald, och månaden är
     PASSETS: en rapport från den 28 augusti som bekräftades den 2
     september står under augusti, som i studiehjälparens lista och i
     adminvyns Ekonomi. Förut stod de tjugo senast bekräftade, och den
     tjugoförsta gick inte att hitta härifrån.

     Att bekräfta filtreras inte: det som väntar på familjen ska inte
     gömma sig bakom en månad, lika lite som bakom barnväljaren.

     Rapporterna finns redan, alla, så månaden väljs här och inte i en
     ny fråga. Raden skapas första gången listan ritas och står dold
     tills något är bekräftat: tolv månader ovanför "Inga bekräftade
     rapporter än" är ett val utan något att välja. Hela rapporterna står
     också under Mina lektioner → Efter passen. */
  let rbMånad = null, rbReserv = 0;

  function rbRitaKlara(att = rbAttBekräfta()) {
    const klara = $('#rb-klara'), rad = $('#rb-manader');
    if (!klara) return;
    /* Stegaren, som studiehjälparens rapporter sedan samma dag:
       ‹ September 2026 › i stället för tolv knappar i sidled. */
    if (!rbMånad && rad) rbMånad = NXStudie.månadsval(rad, { stegare: true, vidVal: rbBytMånad });
    const m = rbMånad ? rbMånad.vald() : NXStudie.månadIso(new Date());
    const g = NXStudie.månadsGräns(m);
    const alla = S.rb.rapporter.filter(r => att.indexOf(r) === -1);
    /* lesson_date är ett datum utan tid, så strängen jämförs med
       strängen, som i adminvyns iMånaden(). */
    const gjorda = alla.filter(r => r.lesson_date >= g.från && r.lesson_date < g.till)
      .sort((a, c) => String(c.lesson_date).localeCompare(String(a.lesson_date))
        || String(S.rb.bekräftade[c.id]).localeCompare(String(S.rb.bekräftade[a.id])));
    if (rad) rad.hidden = !alla.length;
    $('#rb-klara-antal').textContent = gjorda.length ? String(gjorda.length) : '';

    /* En lista att gå tillbaka till, inte en vägg av text. */
    klara.innerHTML = gjorda.length
      ? gjorda.map(r => {
          const b = rbPass(r);
          const inre = '<span class="rb-bock">' + NXStudie.IKON.bock + '</span>'
            + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(rbTitel(r, b)) + '</span>'
            + '<span class="vy-rad-meta"><span>' + esc(versal(NXStudie.dagMedVeckodag(r.lesson_date))) + '</span>'
            + (r.gick && NXStudie.GICK[r.gick] ? '<span>' + esc(NXStudie.GICK[r.gick]) + '</span>' : '') + '</span></span>'
            + '<span class="vy-rad-hoger"><small>Bekräftad ' + esc(kortDatum(isoFor(new Date(S.rb.bekräftade[r.id])))) + '</small>'
            + (b ? '<span class="vy-rad-pil">' + NXStudie.IKON.pil + '</span>' : '') + '</span>';
          return b ? '<a class="vy-rad" href="#pass/' + esc(b.id) + '">' + inre + '</a>'
            : '<div class="vy-rad">' + inre + '</div>';
        }).join('')
      : alla.length
        ? tomt('Inga bekräftade rapporter i ' + NXStudie.månadsNamn(m), 'Välj en annan månad ovanför för att se dem.')
        : tomt('Inga bekräftade rapporter än', 'En rapport ni bekräftat står här.');
  }

  /* Ett byte av månad håller raden stilla (fälla 4 i CLAUDE.md), men
     håll() kan inte scrolla förbi sidans slut. Listan står sist på
     sidan, och har den nya månaden färre rapporter blir sidan kortare:
     står man längst ned klämmer webbläsaren scrollen, och raden man
     just tryckte i flyttade sig 84 px nedåt på en telefon i provbänken.
     Listan behåller därför så mycket av sin höjd som behövs för att
     raden ska stå kvar, och släpper den när tomrummet hamnat under
     skärmkanten, där ingen ser sidan krympa. */
  function rbBytMånad() {
    const rad = $('#rb-manader'), klara = $('#rb-klara');
    const förut = klara.offsetHeight;
    const underSkärmen = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    NXStudie.håll(rad, () => {
      klara.style.minHeight = '';
      rbRitaKlara();
      rbReserv = Math.max(0, förut - klara.offsetHeight - underSkärmen);
      if (rbReserv) klara.style.minHeight = (klara.offsetHeight + rbReserv) + 'px';
    });
  }

  window.addEventListener('scroll', () => {
    if (!rbReserv) return;
    const klara = $('#rb-klara');
    if (klara.getBoundingClientRect().bottom - rbReserv >= window.innerHeight) {
      klara.style.minHeight = '';
      rbReserv = 0;
    }
  }, { passive: true });

  /* Svarar true när rapporten är bekräftad, också om den redan var det
     (23505: bekräftad i en annan flik eller på en annan enhet). Vem och
     när sätts av databasen; härifrån skickas bara vilken rapport. */
  async function bekräftaRapport(id, knapp) {
    if (!id) return false;
    if (S.rb.bekräftade[id]) return true;
    const { error } = await supa.from('rapport_bekraftelser').insert({ rapport_id: id });
    if (error && error.code !== '23505') {
      /* Beskedet där familjen tryckte: på passets sida eller i
         passlistan syns #rb-msg inte. */
      const sek = knapp && knapp.isConnected ? knapp.closest('.vy-sek') : null;
      säg((sek && sek.querySelector('.ok-msg')) || $('#rb-msg'),
        'Rapporten gick inte att bekräfta: ' + felText(error), false);
      return false;
    }
    S.rb.bekräftade[id] = new Date().toISOString();
    return true;
  }

  /* Rapporten till ett genomfört pass. Ett pass som inte är genomfört
     har ingen, och där är ett betalsätt en betalning i förväg. */
  function rapportFörPass(passId) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    if (!b || b.status !== 'completed') return null;
    return S.rb.rapporter.find(r => r.booking_id === passId) || null;
  }

  /* Bekräfta-knappen där rapporten står utanför listan: passets sida.
     Bara när det finns något att bekräfta. */
  function rbKnappFör(b) {
    const r = rapportFörPass(b.id);
    return r && !S.rb.bekräftade[r.id]
      ? '<button type="button" class="btn btn-primary" data-rb-bekrafta="' + esc(r.id) + '">Bekräfta rapporten</button>'
      : '';
  }

  /* Ett betalsätt valt på ett genomfört pass bekräftar dess rapport,
     i listan eller på passets sida (Fas 19.2: betalningen efter passet
     görs i samband med bekräftelsen). Ritar inte om: kassan kan vara
     öppen, och laddaPass() ritar listan när betalningen kommit fram.
     Svarar om det fanns en rapport att bekräfta. */
  async function bekräftaVid(knapp, passId) {
    const kort = knapp && knapp.closest('[data-rb-rapport]');
    const r = kort ? { id: kort.dataset.rbRapport } : rapportFörPass(passId);
    if (!r) return false;
    await bekräftaRapport(r.id, knapp);
    return true;
  }

  /* Omritning med rubriken Att bekräfta stilla. Kortet under den
     försvinner eller byter text; rubriken, och beskedet ovanför den,
     står kvar på sin plats (fälla 4 i CLAUDE.md). */
  function rbRitaOm(före) {
    const rubrik = $('#rb-grupp');
    NXStudie.håll(rubrik, () => { ritaBekrafta(); if (före) före(); });
    ritaNotiser();
  }

  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-rb-bekrafta]');
    if (!k) return;
    await medan(k, 'Bekräftar…', async () => {
      if (!(await bekräftaRapport(k.dataset.rbBekrafta, k))) return;
      rbRitaOm(() => säg($('#rb-msg'), 'Tack. Rapporten är bekräftad.', true));
      // Knappen kan också stå på passets sida.
      if (passIdIAdressen()) ritaPassSida();
    });
  });

  /* Kortbetalningen (Fas 12.2, "bara kort" enligt Fas 14). Samma
     tre lägen som avvikelsen ej_betalt och OBETALDA_LAGEN i
     _delad/pris.ts. 'vantar' är en öppen kassa hos Stripe: en påbörjad
     betalning är ingen betalning, och knappen finns kvar för den som
     stängde fliken. */
  const OBETALDA = ['ingen', 'vantar', 'misslyckad'];
  const BETALDA = ['betald', 'tvist', 'aterbetald'];

  /* Ska betalas (Fas 14.2): bekräftat och inte passerat, eller
     genomfört utan att vara betalt. Ett bekräftat pass vars dag gått
     utan rapport väntar, med spärren av, på rapporten — antingen hölls
     det inte, och då ska det inte betalas, eller så blir det snart
     genomfört och kommer tillbaka hit. Ett pass Nextrum undantagit
     betalas aldrig; stripe-checkout nekar det också.

     Med spärren PÅ släpps det passerade passet igenom. Då kan
     studiehjälparen inte skriva rapporten förrän passet är betalt,
     och utan en knapp här hade ett pass som faktiskt hölls fastnat
     mellan två vyer som båda väntar på den andra: studiehjälparvyn
     säger "rapporten kan sparas när familjen har betalat", och den här
     vyn hade inte erbjudit någon betalning.

     Sedan Fas 19.2 kan spärren inte slås på: villkoren låter familjen
     betala efter passet, och databasen nekar flaggan (flaggor_kortsparr_av).
     Grenen står kvar för den dag villkoren ändras tillbaka. */
  function kanBetalas(b) {
    if (b.fakturerbar === false || ingetAttBetala(b)) return false;
    if (OBETALDA.indexOf(b.betalning_status || 'ingen') === -1) return false;
    if (b.status === 'completed') return true;
    if (b.status !== 'confirmed') return false;
    return b.wanted_date >= isoFor(new Date()) || S.kortsparr === true;
  }

  /* Spärren läses en gång, före passen. Kan flaggan inte läsas räknas
     den som av, som i studiehjälparvyn: databasen är skyddet, och av
     betyder bara att ett passerat pass väntar på rapporten i stället
     för att erbjudas till betalning. */
  async function laddaSparr() {
    /* Fakturavalet läses samtidigt (Fas 14.6). faktura_mojlig() svarar
       bara om den som frågar: flaggan är på och familjen är inte
       spärrad. Kan den inte läsas finns inget fakturaval, och kortet
       står kvar som förut. Databasen prövar valet ändå. */
    const [flagga, faktura] = await Promise.all([
      supa.from('flaggor').select('aktiv').eq('kod', 'kortsparr').maybeSingle(),
      supa.rpc('faktura_mojlig')
    ]);
    S.kortsparr = !!(flagga.data && flagga.data.aktiv);
    S.faktura = faktura.data === true;
  }

  /* ============================================================
     TIPSA EN FAMILJ (2026-09-30)

     Koden och timmarna på köpet, under Profil → Tipsa en familj. Läses
     före passen och bokningen: förslaget visar i förväg om en timme
     är på köpet, och databasen avgör (forsta_timmen_bjuds). Ett pass
     med tipstimmen bär rabattkod TIPS och startrabatt, så det betalas
     som passet med första timmen: med kort, aldrig med köpta timmar.
     ============================================================ */
  async function laddaTips() {
    S.tips = await NXStudie.tipsa({ host: $('#tips-ruta'), supa: supa, roll: 'parent' });
  }
  const påKöpet = b => b && b.rabattkod === 'TIPS' ? 'en timme på köpet för ert tips' : 'första timmen på köpet';

  /* ============================================================
     ERBJUDANDEN (Fas 16.1)

     Planer och klippkort: timmar köpta i förväg. Katalogen och priserna
     läses ur erbjudanden_pris — samma vy som prissidan visar och som
     stripe-checkout tar betalt efter — och familjens egna kort ur
     klippkort_saldo, där "kvar" räknas i databasen ur passen. Här
     räknas ingenting om, det ritas bara.

     Flaggan erbjudanden avgör om något går att köpa eller dra. Står den
     av syns erbjudandena med sina priser, men knapparna säger "Snart".
     ============================================================ */
  /* rorelser och dragningar: undefined innan de hämtats, null om de inte
     gick att läsa. dragningar är passen varje kort betalat, per kort-id. */
  S.erb = { aktiv: false, katalog: [], kort: [], bank: { saldo: 0, varde: null, perPass: {}, finns: false },
            rorelser: undefined, dragningar: undefined };

  async function laddaErbjudanden() {
    const [flagga, katalog, kort, saldo, uttag, rorelser, dragningar] = await Promise.all([
      supa.from('flaggor').select('aktiv').eq('kod', 'erbjudanden').maybeSingle(),
      supa.from('erbjudanden_pris')
        .select('kod, sort, namn, timmar, rabatt_procent, giltig_manader, timpris_ore, ordinarie_ore, pris_ore, rabatterat_timpris_ore')
        .order('ordning'),
      supa.from('klippkort_saldo')
        .select('id, erbjudande, namn, sort, timmar, anvanda, kvar, giltigt_till, status, brukbar, created_at')
        .eq('parent_id', S.user.id).in('status', ['betald', 'tvist', 'aterbetald'])
        .order('giltigt_till', { ascending: true }),
      /* Timbanken (Fas 22.1): saldot räknas i databasen, och uttagen
         säger vilka pass som är betalda med den. */
      supa.from('timbank_saldo').select('saldo_min, varde_ore').eq('parent_id', S.user.id).maybeSingle(),
      supa.from('timbank_uttag').select('booking_id, sort, minuter').eq('parent_id', S.user.id),
      // Rörelserna rad för rad, för Profil → Timbanken.
      supa.from('timbank_rorelser').select('booking_id, sort, minuter, varde_ore, datum, tid')
        .eq('parent_id', S.user.id).order('tid', { ascending: false }).limit(50),
      /* Passen korten betalat (Fas 22.2), med timmarna räknade i databasen
         som i klippkort_saldo. Här räknas ingenting om. */
      supa.from('klippkort_rorelser').select('klippkort_id, booking_id, timmar, datum, status')
        .eq('parent_id', S.user.id).order('datum', { ascending: true })
    ]);
    S.erb.aktiv = !!(flagga.data && flagga.data.aktiv);
    S.erb.katalog = katalog.data || [];
    S.erb.kort = kort.data || [];
    /* Kan banken inte läsas står den som fanns. Noll hade tagit bort
       knappen Betala med timbanken från en familj som har minuter. */
    if (saldo.error || uttag.error) console.warn('Timbanken gick inte att läsa', saldo.error || uttag.error);
    else {
      const perPass = {};
      (uttag.data || []).forEach(u => {
        if (!u.booking_id) return;
        (perPass[u.booking_id] = perPass[u.booking_id] || {})[u.sort] = Number(u.minuter);
      });
      S.erb.bank = {
        saldo: Math.max(Number((saldo.data && saldo.data.saldo_min) || 0), 0),
        varde: saldo.data ? saldo.data.varde_ore : null,
        perPass: perPass,
        finns: !!(uttag.data || []).length || Number((saldo.data && saldo.data.saldo_min) || 0) > 0
      };
    }
    if (rorelser.error) console.warn('Timbankens rörelser gick inte att läsa', rorelser.error);
    S.erb.rorelser = rorelser.error ? null : (rorelser.data || []);
    if (dragningar.error) console.warn('Klippkortens pass gick inte att läsa', dragningar.error);
    S.erb.dragningar = dragningar.error ? null : (dragningar.data || []).reduce((per, r) => {
      (per[r.klippkort_id] = per[r.klippkort_id] || []).push(r);
      return per;
    }, {});
    ritaErbjudanden();
    ritaTimbankProfil();
    ritaBokaTimmar();
  }

  /* En timme per påbörjad timme, som i klippkort_dra: på ett genomfört
     pass av den hållna tiden, upp till det bokade (Fas 20.1). Förut
     räknades alltid det bokade, och rutan lovade två timmar där en drogs. */
  const passTimmar = b => {
    const bokat = Number(b.duration_min) || 60;
    const min = b.status === 'completed' && underlagFör(b) ? Math.min(bokat, debiteradeMin(b)) : bokat;
    return Math.max(1, Math.ceil(min / 60));
  };

  /* Kortet timmarna dras från: det som går ut först och räcker. Samma
     urval som klippkort_dra gör — funktionen väljer själv, det här
     avgör bara om knappen ska stå där. Ett pass med fler barn betalas
     med kort (villkoren, #erbjudanden). */
  function kortFör(b) {
    /* Ett pass med första timmen bjuden betalas med kort (Fas 19.5):
       timmarna dras ur passets hela längd, och klippkort_dra nekar det. */
    if (!S.erb.aktiv || Number(b.antal_barn || 1) > 1 || b.startrabatt) return null;
    const behov = passTimmar(b);
    return S.erb.kort
      .filter(k => k.brukbar && k.status === 'betald' && Number(k.kvar) >= behov
        && String(k.giltigt_till) >= String(b.wanted_date))
      .sort((a, c) => String(a.giltigt_till).localeCompare(String(c.giltigt_till)))[0] || null;
  }

  /* Timbanken betalar ett helt pass när minuterna räcker till det
     bokade (Fas 22.1). Samma pass som timmarna: ett barn, inte ett med
     första timmen bjuden. timbank_dra prövar det igen. */
  function bankFör(b) {
    if (!S.erb.aktiv || Number(b.antal_barn || 1) > 1 || b.startrabatt) return false;
    return S.erb.bank.saldo >= Number(b.duration_min || 60);
  }

  const timText = t => t === 1 ? '1 timme' : t + ' timmar';

  /* Leo 2026-09-28: "innan du bokar ett pass ska det stå 4 av 4 timmar
     kvar". Vid knappen i Boka pass står vad förslaget tar av timmarna,
     i stället för priset.

     Sedan Fas 22.4 drar databasen timmen när förslaget skapas
     (bookings_timmar_betalar_forslaget), och det här är samma val i
     förväg: ett kort som gäller dagen och räcker till hela passet,
     annars timbanken. Förslag som redan skickats har redan dragit sina
     timmar, så kvar står som databasen räknat det. Förut räknades de
     bort här (lovadeTimmar), för databasen drog först vid bekräftelsen,
     och en summa över flera kort kunde säga "räcker" om ett pass som
     inget enskilt kort räckte till. */
  function timmarFörFörslag(minuter, datum, barn) {
    if (!S.erb.aktiv || Number(barn) > 1 || !datum) return null;
    const behov = passTimmar({ duration_min: minuter });
    const brukbara = S.erb.kort.filter(k => k.brukbar);
    if (brukbara.some(k => String(k.giltigt_till) >= String(datum) && Number(k.kvar) >= behov)) {
      const kvar = brukbara.reduce((a, k) => a + Number(k.kvar), 0);
      return { titel: 'Era timmar', under: '−' + timText(behov) + ', ' + (kvar - behov) + ' kvar efter' };
    }
    if (S.erb.bank.saldo >= minuter) return { titel: 'Timbanken', under: '−' + tidLängd(minuter) };
    return null;
  }

  /* Överst i Boka pass: timmarna kvar, innan någon dag är vald. Dold för
     den som inte köpt några. */
  function ritaBokaTimmar() {
    const el = $('#boka-timmar');
    if (!el) return;
    const kort = S.erb.aktiv ? S.erb.kort.filter(k => k.brukbar) : [];
    const bank = S.erb.aktiv ? Number(S.erb.bank.saldo) || 0 : 0;
    el.hidden = !kort.length && !bank;
    if (el.hidden) { el.innerHTML = ''; return; }
    el.innerHTML = kort.map(k => '<p><b>' + esc(k.kvar + ' av ' + k.timmar + ' timmar kvar') + '</b> på '
        + esc(k.namn) + ', till ' + esc(datumText(k.giltigt_till)) + '.</p>').join('')
      + (bank ? '<p><b>' + esc(tidLängd(bank)) + '</b> i timbanken.</p>' : '')
      + '<p class="bk-timmar-not">' + esc((kort.length ? 'Timmarna' : 'Minuterna')
        + ' dras när ni föreslår ett pass, ett barn per pass. Föreslår er studiehjälpare en annan tid följer de med passet. '
        + 'Säger hen nej, eller drar ni tillbaka förslaget, kommer de tillbaka.') + '</p>';
  }

  /* Har familjen timmar som räcker står den knappen först: då är det
     vägen de valt, och kortet är reserven. Klippkortet före timbanken:
     timmarna på kortet går ut, minuterna i banken gör det inte.

     Sedan Fas 22.2 betalar timmarna passet av sig själva när det
     bekräftas eller genomförs, och när ett köp blir betalt. Sedan Fas
     22.3 betalar timmar som blivit lediga (en avbokning, kortet som vann,
     timbanken som fyllts på) ett bekräftat pass inom fem minuter, genom
     jobbet timmar-betalar, och sedan Fas 22.4 betalar de förslaget redan
     när det skickas. Knappen gör samma sak direkt, för det som timmarna
     inte hann. */
  function betalaKnapp(b, liten) {
    const tim = kortFör(b);
    const bank = !tim && bankFör(b);
    const kortknapp = '<button type="button" class="btn ' + (tim || bank ? 'btn-ghost' : 'btn-primary') + (liten ? ' btn-sm' : '')
      + '" data-betala="' + esc(b.id) + '">'
      + (b.betalning_status === 'misslyckad' ? 'Försök betala igen' : 'Betala med kort') + '</button>';
    if (bank) {
      return '<button type="button" class="btn btn-primary' + (liten ? ' btn-sm' : '') + '" data-timbank="' + esc(b.id) + '">'
        + 'Betala med timbanken</button>' + kortknapp;
    }
    if (!tim) return kortknapp;
    return '<button type="button" class="btn btn-primary' + (liten ? ' btn-sm' : '') + '" data-timmar="' + esc(b.id) + '">'
      + 'Betala med timmar</button>' + kortknapp;
  }
  /* EN knapp på raden i en lista (2026-09-28, Leo: "det behöver se bra
     ut på mobil och enkelt att använda"). Två knappar bredvid ett märke
     bröt raden i tre på en telefon. Att betala i förväg är ett val och
     inget drag familjen måste göra, så kortet står som en stilla knapp;
     timmarna står först när de räcker, som i betalaKnapp. Alla val står
     på passets sida, dit raden leder. */
  function radBetala(b) {
    const tim = kortFör(b);
    const bank = !tim && bankFör(b);
    if (tim) return '<button type="button" class="btn btn-primary btn-sm" data-timmar="' + esc(b.id) + '">Betala med timmar</button>';
    if (bank) return '<button type="button" class="btn btn-primary btn-sm" data-timbank="' + esc(b.id) + '">Betala med timbanken</button>';
    return b.betalning_status === 'misslyckad'
      ? '<button type="button" class="btn btn-primary btn-sm" data-betala="' + esc(b.id) + '">Försök betala igen</button>'
      : '<button type="button" class="btn btn-ghost btn-sm" data-betala="' + esc(b.id) + '">Betala i förväg</button>';
  }
  const BETALNING_TEXT = {
    ingen: 'Inte betalt än',
    vantar: 'Betalningen är påbörjad',
    betald: 'Betalt',
    misslyckad: 'Betalningen gick inte igenom',
    aterbetald: 'Återbetalt',
    tvist: 'Betalningen är ifrågasatt',
    faktura: 'Mot faktura'
  };

  /* ============================================================
     FAKTURA (Fas 14.6)

     Bredvid "Betala med kort" kan familjen välja "Få faktura nästa
     månad". Passet kommer då med på en samlad faktura i början av
     nästa månad, med alla pass familjen valt faktura för. Fakturan
     skapas och skickas från Fortnox; här syns den när den skickats.

     Valet är en knapp bredvid kortknappen (Leo 2026-09-27: "knappen
     ska vara bredvid betala med kort"), och familjen bekräftar
     betalsättet i en ruta innan det sparas. Förut var det en textlänk
     under kortknappen, och den syntes inte. Tills passet står på en
     faktura går det att betala med kort i stället, direkt i kassan
     (kortNu). Databasen och stripe-checkout prövar det också: här ritas
     bara det de släpper igenom, så att ingen trycker på något som sedan
     nekas.
     ============================================================ */
  const DAGAR = Number((NX.CFG && NX.CFG.BETALNINGSVILLKOR_DAGAR) || 10);

  /* Fakturan passet står på, också ett utkast som ännu inte skickats.
     Står passet på en faktura betalas det genom den, inte med kort. */
  const fakturaFör = id => (S.fakturaPerPass || {})[id] || null;

  /* Fakturan är ett val EFTER passet, i samband med att rapporten
     bekräftas (Fas 19.2). Före passet finns bara kortet.

     Leo 2026-09-27: "betala senare genom att välja att få en faktura
     skickad till sig nästkommande månad". Knappen säger därför vad som
     händer, inte bara vilket betalsätt det är, och raden under säger
     villkoren: samma tio dagar och ingen avgift som villkoren lovar. */
  const fakturaMöjlig = b => S.faktura === true && kanBetalas(b) && b.status === 'completed';
  function fakturaKnapp(b, liten) {
    return fakturaMöjlig(b)
      ? '<button type="button" class="btn btn-ghost' + (liten ? ' btn-sm' : '') + '" data-faktura-val="' + esc(b.id) + '">Få faktura nästa månad</button>'
      : '';
  }
  const fakturaNotText = b => fakturaMöjlig(b)
    ? 'Faktura: passet kommer med på en samlad faktura i början av nästa månad. Den betalas inom '
      + DAGAR + ' dagar och kostar ingenting extra.'
    : '';
  function fakturaNot(b) {
    const t = fakturaNotText(b);
    return t ? '<span class="val-not">' + esc(t) + '</span>' : '';
  }

  /* Betalvalen som stora knappar (2026-09-28), med vad som händer på
     raden under: under Bekräfta rapport och på passets sida. Samma
     data-attribut och samma urval som betalaKnapp och fakturaKnapp, så
     att samma hanterare tar dem och samma regler gäller: timmarna först
     när de räcker, annars kortet, och fakturan bara efter passet. */
  function betalVal(b) {
    const V = NXStudie.betalval;
    const tim = kortFör(b);
    const bank = !tim && bankFör(b);
    const pris = passetsPris(b);
    const val = [];
    if (tim) {
      val.push(V({ attr: 'data-timmar="' + esc(b.id) + '"', ikon: 'timmar', titel: 'Betala med timmar',
        under: timText(passTimmar(b)) + ' ur ' + tim.namn, först: true }));
    } else if (bank) {
      val.push(V({ attr: 'data-timbank="' + esc(b.id) + '"', ikon: 'bank', titel: 'Betala med timbanken',
        under: tidLängd(Number(b.duration_min || 60)) + ' ur timbanken', först: true }));
    }
    val.push(V({ attr: 'data-betala="' + esc(b.id) + '"', ikon: 'kort',
      titel: b.betalning_status === 'misslyckad' ? 'Försök betala igen' : 'Betala med kort',
      under: pris ? NXBetalning.kronor(pris) + ' dras direkt' : 'Beloppet står i kassan', först: !tim && !bank }));
    if (fakturaMöjlig(b)) {
      val.push(V({ attr: 'data-faktura-val="' + esc(b.id) + '"', ikon: 'faktura',
        titel: 'Få faktura nästa månad', under: 'Kommer i början av nästa månad' }));
    }
    return val.join('');
  }
  /* Betala med kort nu, på ett pass som valts för faktura (2026-09-28).
     Leo: "trycker man på betala nu ska man komma vidare till stripe och
     passet kan räknas som betalt efter att man betalat det". Förut var
     det en textlänk, "Betala med kort i stället", som bara bytte passet
     tillbaka till obetalt: ingen kassa öppnades, och rapporten kom
     tillbaka under Bekräfta rapport som obetald. Nu är det samma
     data-betala som överallt. Kassan öppnas direkt, passet står kvar på
     fakturan tills webhooken skrivit betalningen, och stängs kassan
     utan betalning ändras ingenting (stripe-checkout skriver inget
     'vantar' på ett fakturapass).

     Samma pass som kortknappen annars står på (kanBetalas), bara att
     det valts för faktura. Det går också när flaggan är av: ett pass som
     redan valts för faktura ska inte bli omöjligt att betala med kort.
     Står passet på en faktura, också ett utkast, betalas det genom den. */
  function kortNu(b, liten) {
    const somObetalt = Object.assign({}, b, { betalning_status: 'ingen' });
    return b.betalning_status === 'faktura' && !fakturaFör(b.id) && kanBetalas(somObetalt)
      ? '<button type="button" class="btn btn-ghost' + (liten ? ' btn-sm' : '') + '" data-betala="' + esc(b.id) + '">Betala med kort nu</button>'
      : '';
  }

  async function laddaFakturor() {
    const { data, error } = await supa.from('invoices')
      .select('id, period, status, belopp_ore, forfaller, skickad_at, betald_at, fortnox_fakturanummer, ocr, invoice_lines(booking_id, beskrivning, belopp_ore)')
      .eq('parent_id', S.user.id).order('period', { ascending: false });
    /* Kan fakturorna inte läsas står det som fanns kvar. En tom lista
       hade sett ut som att ingenting är fakturerat, och då hade "Betala
       med kort nu" erbjudits på ett pass som redan står på en faktura. */
    if (error) { console.warn('Fakturorna gick inte att läsa', error); return; }
    S.fakturor = data || [];
    S.fakturaPerPass = {};
    S.fakturor.forEach(f => (f.invoice_lines || []).forEach(l => {
      if (l.booking_id) S.fakturaPerPass[l.booking_id] = f;
    }));
    ritaFakturor();
    if (passIdIAdressen()) ritaPassSida();
  }

  /* Faktura på ett pass. Omritningen hålls vid något som står kvar: på
     passets sida titeln, i listan rubriken ovanför. Den knapp man
     tryckte på försvinner, och utan det hoppar sidan.

     Vägen tillbaka till kort går inte härifrån (2026-09-28). Den skrev
     'ingen' på passet och lämnade betalningen till ett senare tryck;
     nu betalar Betala med kort nu passet direkt (kortNu). */
  async function väljFaktura(knapp, passId) {
    knapp.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ betalning_status: 'faktura' }).eq('id', passId);
    knapp.removeAttribute('aria-busy');
    if (error) { alert('Det gick inte att välja faktura: ' + felText(error)); return; }
    const ankare = document.querySelector('#pass-sida .ps-titel')
      || (knapp.closest('#rb-lista') && $('#rb-grupp'))
      || (knapp.closest('.dbox') && knapp.closest('.dbox').querySelector('h5'))
      || null;
    await NXStudie.håll(ankare, () => Promise.all([laddaPass(), laddaFakturor()]));
    const msg = $('#bet-msg');
    if (msg && !document.querySelector('#pass-sida .ps-titel')) {
      säg(msg, 'Klart. Passet kommer med på fakturan i början av nästa månad.', true);
    }
  }

  /* Fakturor som skickats och inte är betalda (Fas 19.6). Förfallen är
     inget eget läge i databasen, bara en skickad faktura vars dag gått
     (NXBetalning.fakturaLage), så den räknas med här. */
  const obetaldaFakturor = () => (S.fakturor || []).filter(f => f.status === 'skickad')
    .sort((a, c) => String(a.forfaller || '').localeCompare(String(c.forfaller || '')));

  /* Siffran i menyn är fakturorna att betala. Sedan Fas 19.2 väntar
     inget pass på Betalning (se ritaAttBetala), men en skickad faktura
     gör det: den ska betalas i banken, och ingen annan del av vyn säger
     det. */
  function märkBetalning() {
    if (S.sido) S.sido.märke('betalning', obetaldaFakturor().length);
  }

  /* En faktura att betala: det familjen behöver i sin bank. OCR:et är
     det som står på fakturan i Fortnox, inskrivet av admin och prövat i
     databasen (invoices_ocr_giltigt). Saknas det är fakturanumret
     meddelandet. Saknas bankgironumret i konfigurationen står det på
     fakturan, och det säger raden i stället för att visa ett tomt fält. */
  function fakturaAttBetala(f) {
    const kronor = NXBetalning.kronor;
    const bg = String((NX.CFG && NX.CFG.BANKGIRO) || '').trim();
    const sen = NXBetalning.fakturaLage(f) === 'forfallen';
    const kopiera = v => ' <button type="button" class="val-lank" data-kopiera="' + esc(v) + '">Kopiera</button>';
    const referens = f.ocr
      ? ['OCR', f.ocr]
      : f.fortnox_fakturanummer ? ['Meddelande', 'Faktura ' + f.fortnox_fakturanummer] : null;
    const rader = [
      ['Belopp', esc(kronor(f.belopp_ore))],
      f.forfaller ? ['Betala senast', '<span' + (sen ? ' class="sen"' : '') + '>' + esc(datumText(f.forfaller))
        + (sen ? ', förfallen' : '') + '</span>'] : null,
      ['Bankgiro', bg ? esc(bg) + kopiera(bg) : 'står på fakturan'],
      referens ? [referens[0], esc(referens[1]) + kopiera(referens[1])] : null
    ].filter(Boolean);
    const pass = (f.invoice_lines || []).map(l => '<li>' + esc(l.beskrivning || 'Pass')
      + ' <span>' + esc(kronor(l.belopp_ore)) + '</span></li>').join('');
    return '<div class="fakt-att' + (sen ? ' ar-sen' : '') + '">'
      + '<div class="fakt-att-topp"><b>Faktura ' + esc(NXBetalning.periodText(f.period))
      + (f.fortnox_fakturanummer ? ' · nr ' + esc(f.fortnox_fakturanummer) : '') + '</b></div>'
      + rader.map(r => '<div class="sum-line"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('')
      + (pass ? '<ul class="fakt-att-pass">' + pass + '</ul>' : '')
      + '</div>';
  }

  /* Fakturorna, och passen som väntar på nästa. Rutan syns bara när
     det finns något att visa, eller när faktura går att välja. */
  function ritaFakturor() {
    const host = $('#bet-faktura');
    if (!host) return;
    const box = $('#bet-faktura-grupp');
    const kronor = NXBetalning.kronor;

    const obetalda = obetaldaFakturor();
    const attHost = $('#bet-fakt-betala');
    if (attHost) {
      $('#bet-fakt-box').hidden = !obetalda.length;
      $('#bet-fakt-antal').textContent = obetalda.length ? String(obetalda.length) : '';
      attHost.innerHTML = obetalda.map(fakturaAttBetala).join('')
        + (obetalda.length ? '<p class="xsmall" style="margin-top:12px;color:var(--muted-2);line-height:1.6">'
          + 'Har ni redan betalat kan det ta några bankdagar innan fakturan står som betald här.</p>' : '');
    }
    märkBetalning();

    const väntar = (S.bokningar || [])
      .filter(b => b.betalning_status === 'faktura' && b.status !== 'cancelled' && b.fakturerbar !== false)
      .filter(b => { const f = fakturaFör(b.id); return !f || f.status === 'utkast'; })
      .sort((a, c) => String(a.wanted_date).localeCompare(String(c.wanted_date)));
    // De obetalda står i rutan ovanför; här står de betalda och de makulerade.
    const skickade = (S.fakturor || []).filter(f => f.status !== 'utkast' && f.status !== 'skickad');
    if (box) box.hidden = !väntar.length && !skickade.length && S.faktura !== true;
    $('#bet-faktura-antal').textContent = skickade.length ? String(skickade.length) : '';

    const delar = [];
    skickade.forEach(f => {
      const antal = (f.invoice_lines || []).length;
      delar.push(NXBetalning.fakturaRad(f, {
        under: [f.fortnox_fakturanummer ? 'Faktura ' + f.fortnox_fakturanummer : null,
          antal ? antal + (antal === 1 ? ' pass' : ' pass') : null].filter(Boolean).join(' · ')
      }));
    });
    väntar.forEach(b => {
      const pris = passetsPris(b);
      const utkast = fakturaFör(b.id);
      delar.push(NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        med: medBarn(b),
        plats: false,
        under: pris ? kronor(pris) : '',
        vem: utkast ? 'Står på fakturan för ' + NXBetalning.periodText(utkast.period) + ', som snart skickas.'
          : 'Kommer med på fakturan i början av nästa månad.',
        märke: NXKontakt.betalMärke(b),
        atgarder: kortNu(b, true)
      }));
    });
    host.innerHTML = delar.length ? delar.join('')
      : tomt('Inga fakturor', 'Välj "Få faktura nästa månad" när ni bekräftar rapporten, så kommer passet med på en samlad faktura i början av nästa månad. Den ska betalas inom ' + DAGAR + ' dagar, och det kostar ingenting extra.');
  }

  /* Kopiera bankgiro eller OCR (Fas 19.6). Går det inte står värdet
     kvar synligt bredvid knappen, och familjen skriver av det. */
  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-kopiera]');
    if (!k) return;
    try {
      await navigator.clipboard.writeText(k.dataset.kopiera);
      k.textContent = 'Kopierat';
      setTimeout(() => { k.textContent = 'Kopiera'; }, 1800);
    } catch (fel) {
      k.textContent = 'Markera och kopiera';
    }
  });

  /* ============================================================
     BETALPANELEN (Fas 14.5)

     Leo: "när man betalar med kort ska man fortfarande vara kvar på
     sidan, som en split screen". Kassan ritas av Stripe i en ram i en
     panel på vår sida: till höger på en dator, med sidan kvar bredvid,
     och som ett ark underifrån på en telefon, där två kolumner inte får
     plats. Kortnumret skrivs i Stripes ram och når aldrig oss, precis
     som på Stripes egen sida.

     STRIPE.JS LADDAS FÖRST VID KLICKET, och bara här. Det är ett skript
     från js.stripe.com som vyn annars inte behöver, och Stripe tillåter
     inte att det vendoras som supabase-js: det ska alltid hämtas från
     dem. CSP:n för /foralder släpper därför in just Stripes domäner
     (vercel.json), inga andra.

     STRIPES SIDA ÄR RESERVEN. Går Stripe.js inte att ladda, eller
     vägrar webbläsaren ramen, frågar vyn om en vanlig kassa och går
     dit. En familj ska aldrig stå med en knapp som inte gör något.
     ============================================================ */
  const STRIPE_JS = 'https://js.stripe.com/v3/';
  let stripeLaddas = null;
  function laddaStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    if (stripeLaddas) return stripeLaddas;
    stripeLaddas = new Promise((klar, fel) => {
      const s = document.createElement('script');
      s.src = STRIPE_JS;
      s.async = true;
      s.onload = () => (window.Stripe ? klar(window.Stripe) : fel(new Error('Stripe.js laddades men gav ingenting')));
      s.onerror = () => fel(new Error('Stripe.js gick inte att ladda'));
      document.head.appendChild(s);
      // Ett nät som varken svarar eller nekar ska inte lämna knappen hängande.
      setTimeout(() => fel(new Error('Stripe.js svarade inte')), 12000);
    }).catch(err => { stripeLaddas = null; throw err; });
    return stripeLaddas;
  }

  /* Frågar betalfunktionen om en kassa. ui: 'inbaddad' eller 'sida'.
     Svarar med funktionens svar, eller null när felet redan är visat. */
  async function startaBetalning(passId, ui, tillägg) {
    /* tillägg (Fas 20.1): övertiden på ett pass som redan är betalt.
       Samma kassa, samma svar; funktionen räknar minuterna och beloppet
       ur passunderlag, och anropet säger bara vilket pass. */
    return startaKassa(tillägg
      ? { pass: passId, tillagg: true, ui: ui, retur: location.origin }
      : { pass: passId, retur: location.origin, ui: ui });
  }
  /* Ett erbjudande går genom samma kassa, med koden i stället för ett
     pass (Fas 16.1). Beloppet räknas av stripe-checkout. */
  async function startaKöp(kod, ui) {
    return startaKassa({ erbjudande: kod, retur: location.origin, ui: ui });
  }
  async function startaKassa(body) {
    const svar = await supa.functions.invoke('stripe-checkout', { body: body });
    if (svar.error) {
      /* Funktionens egen text ligger i error.context, inte i data.
         Utan det här blir varje nekande "FunctionsHttpError", och
         då får familjen veta att något gick fel men inte vad. */
      let text = felText(svar.error);
      try {
        const kropp = await svar.error.context.json();
        if (kropp && kropp.error) text = kropp.error;
      } catch (_) { /* behåll texten ovan */ }
      alert(text);
      return null;
    }
    return svar.data || {};
  }

  let panel = null;
  function betalpanel() {
    if (panel) return panel;
    const rot = document.createElement('aside');
    rot.className = 'betalpanel';
    rot.setAttribute('role', 'dialog');
    rot.setAttribute('aria-label', 'Betala passet');
    rot.innerHTML =
        '<div class="betalpanel-huvud">'
      +   '<div><p class="betalpanel-titel">Betala passet</p><p class="betalpanel-vad" data-betalpanel-vad></p></div>'
      +   '<button type="button" class="betalpanel-stang" data-betalpanel-stang aria-label="Stäng betalningen">'
      +     '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '</div>'
      + '<p class="betalpanel-besked" data-betalpanel-besked role="status" hidden></p>'
      + '<div class="betalpanel-kassa" data-betalpanel-kassa></div>';
    document.body.appendChild(rot);
    /* Panelen börjar där sidhuvudet slutar. Huvudet byter höjd när
       man scrollat (.stuck har mindre luft), så höjden följs i stället
       för att mätas en gång. */
    const hdr = document.querySelector('.hdr');
    const sättTopp = () => {
      const topp = hdr ? Math.max(0, Math.round(hdr.getBoundingClientRect().bottom)) : 0;
      document.documentElement.style.setProperty('--betalpanel-topp', topp + 'px');
    };
    sättTopp();
    if (hdr && window.ResizeObserver) new ResizeObserver(sättTopp).observe(hdr);
    panel = {
      rot: rot,
      vad: rot.querySelector('[data-betalpanel-vad]'),
      besked: rot.querySelector('[data-betalpanel-besked]'),
      kassa: rot.querySelector('[data-betalpanel-kassa]'),
      checkout: null, knapp: null, pass: null, klar: false, tillägg: false
    };
    return panel;
  }

  function passBeskrivning(passId) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    if (!b) return '';
    const pris = passetsPris(b);
    return [b.subject || 'Pass', datumText(b.wanted_date) + (b.wanted_time ? ' ' + String(b.wanted_time).slice(0, 5) : ''),
      pris ? NXBetalning.kronor(pris) : null].filter(Boolean).join(' · ');
  }

  /* o (Fas 16.1): ett köp av ett erbjudande i samma panel. o.titel och
     o.vad ersätter passets rader, o.kod är vad reserven köper om, och
     o.klar körs när Stripe säger att betalningen gått igenom.
     o.tillägg (Fas 20.1): kassan gäller passets tillägg. Reserven ska
     då be om tillägget igen, inte om passet, som redan är betalt. */
  async function öppnaKassa(knapp, passId, svar, Stripe, o) {
    const p = betalpanel();
    // Stripe tillåter en inbäddad kassa åt gången.
    if (p.checkout) { try { p.checkout.destroy(); } catch (_) { /* redan borta */ } p.checkout = null; }
    p.knapp = knapp; p.pass = passId; p.klar = false;
    p.kod = o && o.kod ? o.kod : null;
    p.tillägg = !!(o && o.tillägg);
    const titel = (o && o.titel) || 'Betala passet';
    p.rot.querySelector('.betalpanel-titel').textContent = titel;
    p.rot.setAttribute('aria-label', titel);
    p.vad.textContent = o && o.vad ? o.vad : passBeskrivning(passId);
    p.besked.hidden = true;
    p.kassa.textContent = '';

    const stripe = Stripe(svar.nyckel);
    if (typeof stripe.initEmbeddedCheckout !== 'function') throw new Error('Stripe.js saknar initEmbeddedCheckout');
    const checkout = await stripe.initEmbeddedCheckout({
      fetchClientSecret: () => Promise.resolve(svar.client_secret),
      onComplete: () => (o && o.klar ? o.klar() : betalningKlar(passId))
    });

    /* Panelen öppnas FÖRE mount, så att ramen får sin bredd direkt.
       På en dator trycker den sidan åt sidan i stället för att lägga
       sig över den; knappen man tryckte på hålls kvar på samma höjd,
       så att ingenting under fingret flyttar sig (CLAUDE.md avsnitt 3,
       fälla 4). */
    NXStudie.håll(knapp, () => {
      document.body.classList.add('betalar');
      p.rot.classList.add('open');
    });
    checkout.mount(p.kassa);
    p.checkout = checkout;
    p.rot.querySelector('[data-betalpanel-stang]').focus();
  }

  function stängBetalpanel() {
    const p = panel;
    if (!p) return;
    if (p.checkout) { try { p.checkout.destroy(); } catch (_) { /* redan borta */ } p.checkout = null; }
    p.kassa.textContent = '';
    // Listan kan ha ritats om medan panelen var öppen; då är det en ny knapp.
    const attr = p.tillägg ? 'data-tillagg' : 'data-betala';
    const knapp = p.knapp && p.knapp.isConnected ? p.knapp
      : (p.pass ? document.querySelector('[' + attr + '="' + CSS.escape(p.pass) + '"]') : null);
    NXStudie.håll(knapp, () => {
      document.body.classList.remove('betalar');
      p.rot.classList.remove('open');
    });
    if (knapp) knapp.focus();
    /* Betald under tiden panelen var öppen: listorna ska visa det.
       Omritningen byter ut knappen, så fokus flyttas till den nya om
       passet fortfarande har en (webhooken har inte hunnit). */
    if (p.klar && !p.pass) {
      // Ett köpt erbjudande: timmarna ska synas, och knapparna på passen.
      Promise.all([laddaErbjudanden(), laddaPass()]).catch(() => {});
    } else if (p.klar) {
      const passId = p.pass;
      laddaPass().then(() => {
        const ny = document.querySelector('[' + attr + '="' + CSS.escape(passId) + '"]');
        if (ny) ny.focus();
      }).catch(() => {});
    }
  }

  /* Stripe säger att betalningen gick igenom. Passet blir betalt först
     när webhooken skrivit det, och den brukar hinna före, men inte
     alltid. Därför två omläsningar, i stället för att passet står som
     obetalt tills någon laddar om. */
  function betalningKlar(passId) {
    const p = panel;
    if (!p || p.pass !== passId) return;
    p.klar = true;
    p.besked.textContent = '✓ Tack! Betalningen är mottagen. Det kan ta en liten stund innan '
      + (p.tillägg ? 'tillägget' : 'passet') + ' står som betalt.';
    p.besked.hidden = false;
    setTimeout(() => { laddaPass().catch(() => {}); }, 2500);
    setTimeout(() => { laddaPass().catch(() => {}); }, 8000);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && panel.rot.classList.contains('open')) stängBetalpanel();
  });

  /* ---------- erbjudandena: köpa och dra (Fas 16.1) ---------- */

  /* Funktionens egen text, som i startaKassa: den står i error.context. */
  async function funktionsText(fel) {
    let text = felText(fel);
    try {
      const kropp = await fel.context.json();
      if (kropp && kropp.error) text = kropp.error;
    } catch (_) { /* behåll texten ovan */ }
    return text;
  }

  /* Beskedet hamnar i sektionen man står i: på passets sida, i listan
     eller under Betalning — där knappen trycktes. */
  function beskedNära(knapp, text, ok) {
    const sek = knapp && knapp.isConnected ? knapp.closest('.vy-sek') : null;
    const msg = (sek && sek.querySelector('.ok-msg')) || $('#bet-msg');
    if (msg) säg(msg, text, ok);
  }

  /* Att dra timmar för ett pass. Rutan säger hur många och vad som är
     kvar efteråt, och — för att ångerrätten ska vara begriplig — att
     ett pass som hålls inte går att ångra (villkoren, #angerratt). */
  async function betalaMedTimmar(knapp, passId) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    const kort = b ? kortFör(b) : null;
    if (!b || !kort) return;
    const behov = passTimmar(b);
    const ord = n => n === 1 ? '1 timme' : n + ' timmar';
    const ok = await NXStudie.bekräfta({
      titel: 'Betala med timmar?',
      text: ord(behov) + ' dras från ' + kort.namn + '. Kvar efteråt: ' + ord(Number(kort.kvar) - behov)
        + ' av ' + kort.timmar + '. Avbokas passet kommer timmarna tillbaka.',
      knapp: 'Dra ' + ord(behov)
    });
    if (!ok) return;
    /* Rapporten bekräftas först när familjen sagt ja i rutan (Fas 19.2:
       betalsättet ÄR bekräftelsen). Förut skrevs bekräftelsen innan
       rutan visades, och ett Avbryt lämnade den kvar. */
    await bekräftaVid(knapp, passId);
    await medan(knapp, 'Drar…', async () => {
      const svar = await supa.functions.invoke('klippkort-betala', { body: { pass: passId } });
      if (svar.error) { beskedNära(knapp, await funktionsText(svar.error), false); return; }
      const kvar = svar.data && svar.data.kvar;
      await Promise.all([laddaErbjudanden(), laddaPass()]);
      beskedNära(knapp, '✓ Passet är betalt med timmar.' + (kvar !== null && kvar !== undefined
        ? ' ' + ord(Number(kvar)) + ' kvar på ' + kort.namn + '.' : ''), true);
    });
  }

  /* Att betala ett pass med timbanken (Fas 22.1). Rutan säger hur många
     minuter som dras och vad som är kvar, som för timmarna. */
  async function betalaMedBanken(knapp, passId) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    if (!b || !bankFör(b)) return;
    const behov = Number(b.duration_min || 60);
    const ok = await NXStudie.bekräfta({
      titel: 'Betala med timbanken?',
      text: tidLängd(behov) + ' dras ur timbanken. Kvar efteråt: ' + tidLängd(S.erb.bank.saldo - behov)
        + '. Avbokas passet kommer minuterna tillbaka.',
      knapp: 'Dra ' + tidLängd(behov)
    });
    if (!ok) return;
    await bekräftaVid(knapp, passId);
    await medan(knapp, 'Drar…', async () => {
      const svar = await supa.functions.invoke('klippkort-betala', { body: { pass: passId, timbank: true } });
      if (svar.error) { beskedNära(knapp, await funktionsText(svar.error), false); return; }
      const kvar = svar.data && svar.data.kvar;
      await Promise.all([laddaErbjudanden(), laddaPass()]);
      beskedNära(knapp, '✓ Passet är betalt med timbanken.' + (kvar !== null && kvar !== undefined
        ? ' ' + tidLängd(Number(kvar)) + ' kvar i banken.' : ''), true);
    });
  }

  function köpKlart() {
    const p = panel;
    if (!p) return;
    p.klar = true;
    /* Fas 22.2: köpet betalar passen framför familjen i samma stund som
       det blir betalt, så passen laddas om med timmarna. Sedan Fas 22.4
       också förslagen. */
    p.besked.textContent = '✓ Tack! Köpet är klart. Timmarna syns under Era timmar om en liten stund, '
      + 'och de betalar era pass av sig själva.';
    p.besked.hidden = false;
    setTimeout(() => { laddaErbjudanden().catch(() => {}); }, 2500);
    setTimeout(() => { Promise.all([laddaErbjudanden(), laddaPass()]).catch(() => {}); }, 8000);
  }

  async function köpErbjudande(knapp, kod) {
    const e = S.erb.katalog.find(x => x.kod === kod);
    if (!e || !S.erb.aktiv) return;
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKöp(kod, 'inbaddad');
      if (!svar) return;
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try {
            await öppnaKassa(knapp, null, svar, Stripe, {
              titel: 'Köp ' + e.namn,
              vad: e.timmar + ' timmar · ' + NXBetalning.kronor(e.pris_ore),
              kod: kod,
              klar: köpKlart
            });
            return;
          } catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKöp(kod, 'sida');
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  /* Ett erbjudande som ett kort. Det överstrukna är ordinarie pris för
     samma timmar, och skillnaden står i kronor: "ni sparar" är ett
     belopp, inte en procentsats man ska räkna om själv. */
  function erbKort(e) {
    const kr = NXBetalning.kronor;
    const spar = Number(e.ordinarie_ore) - Number(e.pris_ore);
    /* Timpriset räknas i vyn, och summan är timpriset gånger timmarna
       (Fas 16.1d). En egen division här hade kunnat visa ett timpris
       som inte går ihop med summan bredvid. */
    const perTimme = Number(e.rabatterat_timpris_ore);
    const mån = Number(e.giltig_manader) === 1 ? '1 månad' : e.giltig_manader + ' månader';
    /* Ur raden, inte ur koden (Fas 21.3): ändras timmarna eller
       giltigheten i katalogen ska kortet säga det nya av sig självt. */
    const vad = e.timmar + ' timmar · gäller i ' + mån;
    return '<div class="erb-kort' + (e.kod === 'intensiv' ? ' ar-framhavd' : '') + '">'
      + '<div class="erb-topp"><b class="erb-namn">' + esc(e.namn) + '</b>'
      + '<span class="erb-rabatt">−' + esc(String(e.rabatt_procent)) + ' %</span></div>'
      + '<span class="erb-vad">' + esc(vad) + '</span>'
      + '<span class="erb-pris"><s>' + esc(kr(e.ordinarie_ore)) + '</s><b>' + esc(kr(e.pris_ore)) + '</b></span>'
      + '<span class="erb-tim"><s>' + esc(kr(e.timpris_ore)) + '</s> ' + esc(kr(perTimme)) + ' per timme · ni sparar '
      + esc(kr(spar)) + '</span>'
      + köpKnapp(e)
      + '</div>';
  }

  /* Köpknappen, lika på planerna och klippkorten. */
  const köpKnapp = e => S.erb.aktiv
    ? '<button type="button" class="btn btn-primary btn-sm" data-kop="' + esc(e.kod) + '">Köp</button>'
    : '<button type="button" class="btn btn-ghost btn-sm" disabled>Snart</button>';

  /* Klippkorten som EN kolumn bredvid planerna, som fälls ut
     (2026-09-27, som på prissidan). Fem kort i en egen ruta var en
     vägg under planerna.

     Rubriken sammanfattar korten som finns: "från" det billigaste och
     spannet i timmar. Rabatten och timpriset står bara där om de är
     desamma på alla kort — ett tal som stämmer för ett av dem är ett
     pris som inte är det kassan drar. <details>, så att kolumnen går
     att öppna med tangentbordet utan en rad skript. */
  function klippKolumn(kort, öppen) {
    if (!kort.length) return '';
    const kr = NXBetalning.kronor;
    const lika = f => new Set(kort.map(e => String(e[f]))).size === 1;
    const tim = kort.map(e => Number(e.timmar));
    const billigast = kort.reduce((a, e) => Number(e.pris_ore) < Number(a.pris_ore) ? e : a);
    const spann = Math.min(...tim) === Math.max(...tim)
      ? Math.min(...tim) + ' timmar'
      : Math.min(...tim) + ' till ' + Math.max(...tim) + ' timmar';
    const rader = kort.map(e => {
      const spar = Number(e.ordinarie_ore) - Number(e.pris_ore);
      const mån = Number(e.giltig_manader) === 1 ? '1 månad' : e.giltig_manader + ' månader';
      return '<div class="erb-klipp-rad">'
        + '<div class="erb-topp"><b class="erb-namn">' + esc(e.timmar + ' timmar') + '</b>'
        + '<b class="erb-summa">' + esc(kr(e.pris_ore)) + '</b></div>'
        + '<span class="erb-tim"><s>' + esc(kr(e.timpris_ore)) + '</s> ' + esc(kr(e.rabatterat_timpris_ore))
        + ' per timme · ni sparar ' + esc(kr(spar)) + '</span>'
        + '<div class="erb-klipp-fot"><span class="erb-vad">Gäller i ' + esc(mån) + '</span>' + köpKnapp(e) + '</div>'
        + '</div>';
    }).join('');
    return '<details class="erb-kort erb-klippkol"' + (öppen ? ' open' : '') + '>'
      + '<summary>'
      + '<span class="erb-topp"><b class="erb-namn">Klippkort</b>'
      + (lika('rabatt_procent') ? '<span class="erb-rabatt">−' + esc(String(kort[0].rabatt_procent)) + ' %</span>' : '')
      + '</span>'
      + '<span class="erb-vad">' + esc(spann) + ', när det passar er</span>'
      + '<span class="erb-pris"><span class="erb-fran">från</span><b>' + esc(kr(billigast.pris_ore)) + '</b></span>'
      + (lika('rabatterat_timpris_ore') && lika('timpris_ore')
        ? '<span class="erb-tim"><s>' + esc(kr(kort[0].timpris_ore)) + '</s> ' + esc(kr(kort[0].rabatterat_timpris_ore))
          + ' per timme</span>'
        : '')
      + '<span class="erb-visa"><span class="erb-visa-stangd">Se alternativen</span>'
      + '<span class="erb-visa-oppen">Dölj alternativen</span>'
      + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></span>'
      + '</summary>'
      + '<div class="erb-klipp">' + rader + '</div>'
      + '</details>';
  }

  function ritaErbjudanden() {
    const planer = $('#erb-planer');
    if (!planer) return;
    /* Omritningen (efter ett köp, eller när timmarna laddas om) ska
       inte fälla ihop kolumnen under fingret på den som läser i den. */
    const öppen = !!planer.querySelector('.erb-klippkol[open]');
    const kat = S.erb.katalog;
    planer.innerHTML = kat.filter(e => e.sort === 'plan').map(erbKort).join('')
      + klippKolumn(kat.filter(e => e.sort === 'klippkort'), öppen)
      || tomt('Inga erbjudanden just nu', 'Skriv till oss om ni vill ha ett upplägg.');

    const msg = $('#erb-msg');
    if (msg && !S.erb.aktiv && !msg.classList.contains('show')) {
      säg(msg, 'Erbjudandena går att köpa här inom kort. Vill ni ha ett redan nu, skriv till oss så ordnar vi det.', true);
    }

    const kontakt = $('#erb-kontakt');
    if (kontakt && NX.CFG && NX.CFG.EPOST) {
      kontakt.href = 'mailto:' + NX.CFG.EPOST + '?subject=' + encodeURIComponent('Eget upplägg');
    }

    /* Vägen hit från Betalning (Fas 21.3). Har familjen redan timmar
       står knappen Betala med timmar på passen, och då är tipset brus. */
    const tips = $('#bet-erb-tips');
    if (tips) tips.hidden = !(S.erb.aktiv && S.erb.katalog.length && !S.erb.kort.some(k => k.brukbar));

    const box = $('#erb-mina-box'), mina = $('#erb-mina');
    if (!box || !mina) return;
    box.hidden = !S.erb.kort.length && !S.erb.bank.finns;
    mina.innerHTML = S.erb.kort.map(k => kortRad(k)).join('') + bankRad()
      + (S.erb.kort.length && !S.erb.bank.finns
        ? '<p class="erb-bank-text"><a href="#profil/timbank">Se vilka pass timmarna betalat</a></p>' : '');
  }

  /* Ett köpt kort: timmarna kvar som en mätare, och sista dagen. Samma
     rad i Era timmar och under Profil → Timbanken, där passen kortet
     betalat står under den (under). */
  function kortRad(k, under) {
    const idag = isoFor(new Date());
    const kvar = Number(k.kvar), tim = Number(k.timmar);
    /* Tio dagar före sista dagen går påminnelsemejlet (Fas 21.2), och
       vyn säger samma sak från samma dag: timmar som inte används
       förfaller. */
    const dagarKvar = Math.round((Date.parse(String(k.giltigt_till)) - Date.parse(idag)) / 864e5);
    const snart = k.brukbar && dagarKvar >= 0 && dagarKvar <= 10;
    const läge = k.status === 'aterbetald' ? 'Återbetalt'
      : k.status === 'tvist' ? 'Betalningen är ifrågasatt'
      : kvar === 0 ? 'Förbrukat'
      : String(k.giltigt_till) < idag ? 'Gick ut ' + datumText(k.giltigt_till)
      : 'Gäller till ' + datumText(k.giltigt_till);
    const andel = tim ? Math.round(100 * kvar / tim) : 0;
    return '<div class="erb-mitt' + (k.brukbar ? '' : ' ar-slut') + '">'
      + '<div class="erb-mitt-topp"><b>' + esc(k.namn) + '</b><span>' + esc(läge) + '</span></div>'
      + '<div class="erb-matare" role="img" aria-label="' + esc(kvar + ' av ' + tim + ' timmar kvar') + '">'
      + '<i style="width:' + andel + '%"></i></div>'
      + '<span class="erb-kvar"><b>' + kvar + '</b> av ' + tim + ' timmar kvar</span>'
      + (snart ? '<p class="erb-snart">'
        + esc(dagarKvar === 0 ? 'Sista dagen är i dag.' : dagarKvar === 1 ? 'Sista dagen är i morgon.' : 'Sista dagen är om ' + dagarKvar + ' dagar.')
        + ' Timmar som inte används förfaller. <a href="#boka">Boka ett pass</a></p>' : '')
      + (under || '')
      + '</div>';
  }

  /* Timbanken (Fas 22.1), under klippkorten. Minuterna går inte ut, och
     raden säger vad de används till, i den ordning databasen tar dem. */
  function bankRad() {
    const bank = S.erb.bank;
    if (!bank.finns) return '';
    const saldo = bank.saldo;
    return '<div class="erb-mitt erb-bank">'
      + '<div class="erb-mitt-topp"><b>Timbanken</b><span>Går inte ut</span></div>'
      + '<span class="erb-kvar"><b>' + esc(tidLängd(saldo)) + '</b> sparat</span>'
      + '<p class="erb-bank-text">Minuter som blev över när ett pass betalt med timmar slutade före en hel timme. '
      + 'Drar ett pass över tas tiden härifrån först, utan kostnad, och räcker minuterna till ett helt pass betalar de '
      + 'nästa pass ni föreslår, om inga köpta timmar gör det.'
      + (bank.varde ? ' Slutar ni betalar vi tillbaka dem, i dag ' + esc(NXBetalning.kronor(bank.varde)) + '.' : '')
      + ' <a href="#profil/timbank">Se vad som gått in och ut</a>'
      + '</p></div>';
  }

  /* ============================================================
     TIMBANKEN UNDER PROFIL (2026-09-27)

     Leo: "timbanken ska finnas i profil i förälder vy". Den stod bara
     som en rad under Era timmar, och bara när det fanns minuter. Här
     står den alltid, också tom, med vad som gått in och ut rad för rad
     (timbank_rorelser) och passet det gällde.

     Saldot är samma som i Era timmar, ur samma hämtning. Passets namn
     läses ur passlistan, som kan komma efter erbjudandena; laddaPass
     ritar därför om fliken. Saknas passet i listan står dagen ensam.

     Fas 22.2, samma dag: "timbanken ska även inkludera klippkort".
     Fliken visar därför allt familjen betalat i förväg: köpta timmar kort
     för kort, med passen varje kort betalat (klippkort_rorelser), och de
     sparade minuterna under dem.
     ============================================================ */
  const RORELSE_TEXT = { in: 'Över från', overtid: 'Övertid på', pass: 'Betalade' };

  const passNamn = (id, datum) => {
    const b = (S.bokningar || []).find(x => x.id === id);
    return b ? (b.subject || 'passet') + ' ' + datumText(b.wanted_date) : 'passet ' + datumText(datum);
  };

  /* Passen ett kort betalat, äldst först. Ett pass som inte har hållits
     än står som kommande: timmarna är dragna, men passet finns kvar att
     avboka, och då kommer de tillbaka. Ett förslag står som föreslaget
     (Fas 22.4): timmen är dragen, och säger studiehjälparen nej kommer
     den tillbaka. */
  function kortetsPass(k) {
    const per = S.erb.dragningar;
    if (per === undefined) return '<div class="loading">Hämtar</div>';
    if (per === null) return '<p class="erb-bank-text">Passen kortet betalat gick inte att hämta. Ladda om sidan, eller skriv till oss.</p>';
    const rader = per[k.id] || [];
    if (!rader.length) return '';
    const idag = isoFor(new Date());
    return '<ul class="tb-rorelser">' + rader.map(r => {
      const t = Number(r.timmar);
      const läge = r.status === 'requested' ? ', föreslaget'
        : r.status !== 'completed' && String(r.datum) >= idag ? ', kommande' : '';
      return '<li><span>' + esc(passNamn(r.booking_id, r.datum)) + läge + '</span>'
        + '<span class="tb-min ut">−' + esc(t === 1 ? '1 timme' : t + ' timmar') + '</span></li>';
    }).join('') + '</ul>';
  }

  function ritaTimbankTimmar() {
    const host = $('#timbank-timmar');
    if (!host) return;
    const kort = S.erb.kort;
    if (!kort.length) {
      host.innerHTML = '<p class="erb-bank-text">Ni har inga köpta timmar.'
        + (S.erb.aktiv ? ' Köper ni en plan eller ett klippkort betalar timmarna era pass av sig själva. '
          + '<a href="#erbjudanden">Se planer och klippkort</a>' : '')
        + '</p>';
      return;
    }
    host.innerHTML = '<p class="erb-bank-text tb-forklaring">Timmarna betalar era pass av sig själva. När ni föreslår '
      + 'ett pass dras timmarna från det kort som går ut först, och föreslår studiehjälparen en annan tid följer de med. '
      + 'Säger hen nej, eller drar ni tillbaka förslaget, kommer de tillbaka, och det gör de också när ett förslag ingen '
      + 'svarat på har passerat. Köper ni timmar, eller kommer timmar tillbaka, betalar de era pass i datumordning. '
      + 'Ett pass med fler barn, och ett pass där en timme är på köpet, '
      + 'betalas med kort. <a href="/anvandarvillkor#erbjudanden" target="_blank" rel="noopener">Villkoren för timmarna</a></p>'
      + kort.map(k => kortRad(k, kortetsPass(k))).join('');
  }

  function ritaTimbankProfil() {
    ritaTimbankTimmar();
    const host = $('#timbank-profil');
    if (!host) return;
    const bank = S.erb.bank;
    const passet = r => passNamn(r.booking_id, r.datum);

    const rader = S.erb.rorelser;
    let lista;
    if (rader === undefined) {
      lista = '<div class="loading">Hämtar</div>';
    } else if (rader === null) {
      lista = '<p class="erb-bank-text">Rörelserna gick inte att hämta. Ladda om sidan, eller skriv till oss.</p>';
    } else if (!rader.length) {
      lista = '<p class="erb-bank-text">Inga minuter har gått in eller ut än.'
        + (S.erb.aktiv ? ' Minuterna kommer ur timmar ni köpt i förväg. <a href="#erbjudanden">Se planer och klippkort</a>' : '')
        + '</p>';
    } else {
      lista = '<ul class="tb-rorelser">' + rader.map(r => {
        const m = Number(r.minuter);
        const text = r.sort === 'utbetald'
          ? 'Utbetalt till er ' + datumText(r.datum) + (r.varde_ore ? ', ' + NXBetalning.kronor(r.varde_ore) : '')
          : (RORELSE_TEXT[r.sort] || 'Ändring på') + ' ' + passet(r);
        return '<li><span>' + esc(text) + '</span>'
          + '<span class="tb-min' + (m < 0 ? ' ut' : '') + '">' + (m < 0 ? '−' : '+') + esc(tidLängd(Math.abs(m))) + '</span></li>';
      }).join('') + '</ul>'
        + (rader.length >= 50 ? '<p class="erb-finstilt">De 50 senaste.</p>' : '');
    }

    host.innerHTML = '<div class="erb-mitt-topp"><b>' + esc(tidLängd(bank.saldo)) + ' sparat</b>'
      + (bank.varde ? '<span>Värt ' + esc(NXBetalning.kronor(bank.varde)) + ' om ni slutar</span>' : '') + '</div>'
      + '<p class="erb-bank-text">Här sparas det som blir över när ett pass betalt med timmar slutar före en hel timme: '
      + 'ett pass på två timmar som höll 1 h 15 lägger 45 minuter här. Drar ett pass med ett barn över tas tiden härifrån '
      + 'först, utan kostnad, och räcker minuterna till ett helt pass betalar de nästa pass ni föreslår, om inga köpta '
      + 'timmar gör det. Minuterna går inte ut, och slutar ni betalar vi tillbaka dem. '
      + '<a href="/anvandarvillkor#timbank" target="_blank" rel="noopener">Villkoren för timbanken</a></p>'
      + '<p class="konto-inlogg-et" style="margin-top:18px">Vad som gått in och ut</p>'
      + lista;
  }

  /* Vägrar webbläsaren Stripes ram (en CSP som inte hunnit med, ett
     tillägg som blockerar) syns det inte som ett fel i koden: ramen
     blir bara tom. Webbläsaren säger det däremot här, och då går
     familjen till Stripes egen sida i stället. */
  document.addEventListener('securitypolicyviolation', async e => {
    const p = panel;
    if (!p || !p.rot.classList.contains('open') || p.klar) return;
    /* Bara en policy som faktiskt STOPPAR. Hela sajten har också en
       Report-Only-policy (vercel.json), som bara anmäler, och den
       nämner inte Stripe: den ger ett sådant här anrop för varje
       Stripe-skript utan att något är fel. */
    if (e.disposition !== 'enforce') return;
    if (!/stripe\.(com|network)/.test(String(e.blockedURI || ''))) return;
    console.error('CSP stoppade Stripe:', e.violatedDirective, e.blockedURI);
    const passId = p.pass, kod = p.kod, tillägg = p.tillägg;
    stängBetalpanel();
    const reserv = passId ? await startaBetalning(passId, 'sida', tillägg) : kod ? await startaKöp(kod, 'sida') : null;
    if (reserv && reserv.url) location.href = reserv.url;
  });

  /* ============ pass ============ */
  async function laddaPass() {
    const host = $('#pass-lista');
    /* Passunderlaget och tilläggen hämtas med passen (Fas 20.1): de
       säger vad ett genomfört pass kostar och om det drog över, och
       listorna ritas ur alla tre på en gång. Ett pass som ritats utan
       dem hade visat det bokade priset och bytt belopp under fingret. */
    /* Alla pass, inte de tusen första (NXStudie.hämtaAlla, 2026-09-29):
       listan är äldst först, så det hade varit de nya passen som föll
       bort. Underlaget och tilläggen följer passen i antal. */
    const [pass, und, till] = await Promise.all([
      NXStudie.passMedSvar(supa, S,
        'id, subject, format, location, note, wanted_date, wanted_time, duration_min, antal_barn, tjanst, status, student_id, parent_id, tutor_id, created_by, created_at, avbokningsskal, avbokad_at, avbokad_av, betalning_status, betald_at, fakturerbar, betalt_ore, aterbetald_ore, klippkort_id, timpris_ore, extra_ore, rabatt_ore, startrabatt, rabattkod',
        q => q.eq('parent_id', S.user.id).order('wanted_date', { ascending: true })),
      NXStudie.hämtaAlla(supa, 'passunderlag',
        'id, debiterade_min, betalda_min, timpris_ore, extra_ore, rabatt_ore, timbank_min',
        q => q.eq('parent_id', S.user.id)),
      NXStudie.hämtaAlla(supa, 'pass_tillagg', 'id, booking_id, minuter, begart_ore, status, betalt_ore, betald_at')
    ]);
    const { data, error } = pass;

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
    /* Passen under Din utveckling i NexLäx räknar passens längd ur
       samma rader. */
    ritaNexlaxUtveckling();
    /* Kan underlaget inte läsas står det som fanns kvar, och första
       gången inget: då gäller det bokade, som för en rapport utan tid,
       och inget tillägg syns. Ett tillägg som inte syns larmar hos oss
       (tillagg_obetalt); ett belopp som gissats hade stått hos familjen. */
    if (und.error) console.warn('Passunderlaget gick inte att läsa', und.error);
    else {
      S.underlag = {};
      (und.data || []).forEach(u => { S.underlag[u.id] = u; });
    }
    if (till.error) console.warn('Tilläggen gick inte att läsa', till.error);
    else {
      S.tillagg = {};
      (till.data || []).forEach(t => { S.tillagg[t.booking_id] = t; });
    }
    /* Märket bredvid passet (NXKontakt.betalMärke) delas med
       studiehjälparvyn och vet inget om priset. Här vet vi det. Efter
       underlaget: ett genomfört pass kostar den debiterade tiden. */
    S.bokningar.forEach(b => { b.inget_att_betala = ingetAttBetala(b); });
    S.laddatPass = true;
    ritaNotiser();
    ritaÖvGöra();
    ritaÖvKommande();
    ritaNästaPass();
    ritaStatistik();
    byggSchema();
    ritaAttBetala();
    ritaBetalda();
    ritaFakturor();
    ritaBekrafta();
    // Timbankens rörelser under Profil nämner passen vid namn.
    ritaTimbankProfil();
    // Förslagen som väntar tar av timmarna överst i Boka pass.
    ritaBokaTimmar();
    /* Står man på ett pass när listan laddas om — efter ett svar, en
       avbokning, en ny tid — ritas sidan om med det som nu gäller. */
    if (passIdIAdressen()) ritaPassSida();
    if (!S.bokningar.length) { host.innerHTML = tomt('Inga bokade pass än', 'Boka en tid under Boka pass, så står passet här.'); return; }

    const aktiva = S.bokningar.filter(b => b.status !== 'cancelled');
    $('#pass-antal').textContent = aktiva.length + ' st';

    NXStudie.passLista({
      host: host,
      bokningar: S.bokningar,
      tomtKommande: 'Inga kommande pass. Boka en tid under Boka pass, så står passet här.',
      avbokade: { vem: avbokadAv, jag: 'er', motpart: 'studiehjälparen' },
      rad: b => {
      /* Ett förslag från studiehjälparen ser likadant ut i databasen
         som en egen bokning — created_by är det enda som skiljer, och
         det avgör om raden ska ha "Bekräfta" eller "Avboka". */
      const derasFörslag = b.created_by && b.created_by !== S.user.id;

      /* Raden bär bara det som är ERT drag just nu: svara på ett
         förslag, eller betala ett bekräftat pass. Föreslå ny tid och
         avboka ligger på passets egen sida (Leo 2026-09-24), dit hela
         raden leder. Tre knappar på varje rad blev på en telefon tre
         rader knappar under varje pass, och listan gick inte att läsa. */
      let knappar = '';
      /* Ett förslag vars tid passerat går inte att svara på: passets
         sida säger redan "Tiden har passerat", och ett ja hade gett ett
         bekräftat pass i går som timmarna sedan betalar. */
      if (derasFörslag && b.status === 'requested' && b.wanted_date >= isoFor(new Date())) {
        knappar = svarsKnappar(b, true);
      } else if (kanBetalas(b)) {
        /* Betalningen hör till BEKRÄFTADE pass, inte till förfrågningar
           (Fas 12.2). Ett pass som studiehjälparen ännu inte tackat ja
           till kan avböjas, och då hade varje förfrågan blivit en
           återbetalning: en kortavgift vi inte får tillbaka, och en
           familj som undrar vad som hände. Ett genomfört pass betalas
           under Bekräfta rapport, där rapporten står (Fas 19.2): ett
           betalsätt valt här hade bekräftat en rapport familjen aldrig
           sett, och bekräftelsen går inte att ta tillbaka. */
        knappar = b.status === 'completed'
          ? '<a class="btn btn-primary btn-sm" href="#bekrafta">Till rapporten</a>'
          : radBetala(b);
      }

      /* Platsen står direkt på raden, och passRad ritar den. Ett pass
         på plats är en resa — var man ska vara är halva beskedet. */
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        med: medBarn(b),
        nu: b.wanted_date === isoFor(new Date()) && b.status !== 'cancelled',
        vem: derasFörslag && ärMotförslag(b) ? 'Motförslag från er studiehjälpare'
          : derasFörslag && b.status === 'requested' ? 'Föreslaget av er studiehjälpare'
          : b.status === 'requested' ? 'Väntar på svar från er studiehjälpare'
          : b.status === 'cancelled' ? avbokadText(b) : null,
        /* Studiehjälparens rader, kapade: hela står på passets sida. */
        not: b.svar_meddelande && (b.status === 'cancelled' || ärMotförslag(b))
          ? NXKontakt.kortNot(b.svar_meddelande) : null,
        märke: NXKontakt.betalMärke(b),
        atgarder: knappar
      });
      }
    });
  }

  /* Kortbetalningen av ett pass, eller av dess tillägg (Fas 20.1). EN
     väg för båda: tillägget är en variant av samma kassa, inte en kopia
     av den. Skillnaden är vad funktionen ombeds ta betalt för och vad
     panelen säger överst. */
  async function betalaIKassan(knapp, passId, tillägg) {
    // Betalar ni ett genomfört pass bekräftar ni dess rapport (Fas 19.2).
    const påRapport = !!knapp.closest('[data-rb-rapport]') || !!rapportFörPass(passId);
    await medan(knapp, 'Öppnar…', async () => {
      // Stripe.js hämtas medan sessionen skapas, inte efter.
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      /* Fas 19.1: på en rapport bekräftar valet den. Före kassan, för
         reserven lämnar sidan och tar ett pågående anrop med sig. */
      await bekräftaVid(knapp, passId);
      const svar = await startaBetalning(passId, 'inbaddad', tillägg);
      if (!svar) return;
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try { await öppnaKassa(knapp, passId, svar, Stripe, tillägg ? tilläggsKassa(passId, svar) : undefined); return; }
          catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        // Reserven: Stripes egen sida, som före Fas 14.5.
        const reserv = await startaBetalning(passId, 'sida', tillägg);
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Betalningen kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
    /* Rapporten är bekräftad nu, betald eller inte. Kortet ska säga
       det också om kassan aldrig öppnades eller stängs utan betalning.
       stängBetalpanel() hittar den nya knappen om kortet ritats om. */
    if (påRapport) rbRitaOm();
  }

  /* Panelens rubrik för ett tillägg. Minuterna och beloppet är
     funktionens egna, ur svaret: det är dem kassan tar. */
  function tilläggsKassa(passId, svar) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    return {
      titel: 'Betala tillägget',
      vad: [b ? (b.subject || 'Pass') : null, b ? datumText(b.wanted_date) : null,
        svar.minuter ? tidLängd(svar.minuter) + ' över' : null,
        svar.belopp_ore ? NXBetalning.kronor(svar.belopp_ore) : null].filter(Boolean).join(' · '),
      tillägg: true
    };
  }

  document.addEventListener('click', async e => {
    /* data-passvar, inte data-svar: data-svar är bekräfta-rutans egna
       knappar (NXStudie.bekräfta). Med samma namn tolkades varje klick
       i en bekräfta-ruta här i studievyn — "Ta bort" på ett barn, till
       exempel — som ett svar på ett pass, och det slutade med
       "Kunde inte svara". */
    const svar = e.target.closest('[data-passvar]');
    if (svar) {
      /* Fas 22.4: ett förslag kan redan vara betalt med timmarna. Avböjs
         det kommer de tillbaka, och rutan säger det innan. */
      const passet = (S.bokningar || []).find(x => x.id === svar.dataset.id);
      const tillbaka = svar.dataset.passvar !== 'cancelled' || !passet ? ''
        : medTimmar(passet) ? ' Timmarna ni betalade med kommer tillbaka.'
        : medBanken(passet) ? ' Minuterna ni betalade med kommer tillbaka till timbanken.' : '';
      if (svar.dataset.passvar === 'cancelled') {
        const nej = await NXStudie.bekräfta(passet && ärMotförslag(passet) ? {
          titel: 'Avböj den nya tiden?',
          text: 'Er studiehjälpare ser att tiden inte passade. Vill ni ha en annan tid föreslår ni den under Boka pass, och skriv gärna i chatten vilka tider som fungerar.' + tillbaka,
          knapp: 'Avböj'
        } : {
          titel: 'Avböj tiden?',
          text: 'Er studiehjälpare ser att tiden inte passade. Skriv gärna i chatten vilka tider som fungerar.' + tillbaka,
          knapp: 'Avböj'
        });
        if (!nej) return;
      }
      /* medan() låser knappen, också för Enter: ett andra tryck hade
         blivit ett andra svar på ett pass som redan besvarats. */
      await medan(svar, svar.dataset.passvar === 'cancelled' ? 'Avböjer…' : 'Bekräftar…', async () => {
        const { error } = await supa.from('bookings').update({ status: svar.dataset.passvar }).eq('id', svar.dataset.id);
        if (error) {
          alert(error.code === '23505' || error.code === '23P01'
            ? 'Tiden hann bli upptagen av ett annat pass. Föreslå en ny under Boka pass.'
            : 'Kunde inte svara: ' + felText(error));
          await laddaPass();
          return;
        }
        await Promise.all([laddaPass(), laddaBokning()].concat(tillbaka ? [laddaErbjudanden()] : []));
      });
      return;
    }

    /* Betalningen (Fas 12.2). Knappen skickar BARA passets id. Priset,
       rabatten och studiehjälparens del räknas ut på servern, ur
       databasen — samma skäl som att invoices och payouts med flit
       saknar INSERT-policy för användare: kan ingen skicka in ett
       belopp kan ingen skicka in fel belopp. */
    /* Faktura eller kort (Fas 14.6). Villkoren står i rutan, för det är
       här familjen godkänner dem för det här passet. */
    const fv = e.target.closest('[data-faktura-val]');
    if (fv) {
      /* Beloppet står i rutan: det är den debiterade tiden (Fas 20.1),
         samma som fakturaraden räknas på. */
      const fb = (S.bokningar || []).find(x => x.id === fv.dataset.fakturaVal);
      const fpris = fb ? passetsPris(fb) : null;
      /* Rutan är steget där familjen bekräftar betalsättet, och med det
         rapporten. Knappen säger båda, så att ingen tror att rapporten
         bekräftas i ett senare steg. */
      const ok = await NXStudie.bekräfta({
        titel: 'Få faktura nästa månad?',
        text: (fpris ? 'Passet kostar ' + NXBetalning.kronor(fpris) + '. ' : '')
          + 'Passet kommer med på en samlad faktura från Nextrum i början av nästa månad, tillsammans med de andra pass ni valt faktura för. '
          + 'Fakturan ska betalas inom ' + DAGAR + ' dagar, och det kostar ingenting extra. '
          + 'Rapporten bekräftas samtidigt. Vill ni hellre betala med kort går det tills fakturan är skapad.',
        knapp: 'Bekräfta faktura'
      });
      if (ok) { await bekräftaVid(fv, fv.dataset.fakturaVal); await väljFaktura(fv, fv.dataset.fakturaVal); }
      return;
    }

    const tim = e.target.closest('[data-timmar]');
    if (tim) { await betalaMedTimmar(tim, tim.dataset.timmar); return; }
    const tb = e.target.closest('[data-timbank]');
    if (tb) { await betalaMedBanken(tb, tb.dataset.timbank); return; }
    const köp = e.target.closest('[data-kop]');
    if (köp) { await köpErbjudande(köp, köp.dataset.kop); return; }

    const bet = e.target.closest('[data-betala]');
    if (bet) { await betalaIKassan(bet, bet.dataset.betala, false); return; }
    /* Tillägget (Fas 20.1): samma kassa, samma bekräftelse av rapporten. */
    const tl = e.target.closest('[data-tillagg]');
    if (tl) { await betalaIKassan(tl, tl.dataset.tillagg, true); return; }

    if (e.target.closest('[data-betalpanel-stang]')) { stängBetalpanel(); return; }

    const btn = e.target.closest('[data-avboka]');
    if (!btn) return;
    /* Samma ruta som studiehjälparen och admin får, inte webbläsarens
       confirm(). confirm() svarar nej utan att visa något i en del
       miljöer — inbyggda webbläsare i appar, och efter att man en gång
       bockat i "låt inte sidan visa fler dialoger" — och då hände
       ingenting alls när man tryckte på Avboka. */
    /* Skälet skrivs i samma uppdatering som statusen. Två skrivningar
       hade gett två notiser, och den första — utan skäl — hade redan
       hunnit bli ett mejl. */
    const förslag = btn.dataset.forslag === '1';
    /* Fas 21.1: ett pass betalt med timmar går att avboka, och rutan
       säger vart timmarna tar vägen innan familjen bestämt sig. */
    const passet = (S.bokningar || []).find(x => x.id === btn.dataset.avboka);
    const timmarTillbaka = passet && medTimmar(passet) ? ' Timmarna ni betalade med kommer tillbaka.'
      : passet && medBanken(passet) ? ' Minuterna ni betalade med kommer tillbaka till timbanken.' : '';
    const skäl = await NXStudie.avbokaRuta(förslag ? {
      titel: 'Dra tillbaka förslaget?',
      text: 'Vill ni hellre ha en annan tid, välj Ändra tiden i stället.',
      knapp: 'Dra tillbaka',
      avbryt: 'Behåll förslaget',
      not: 'Er studiehjälpare får ett mejl om att förslaget är tillbakadraget och varför.' + timmarTillbaka
    } : {
      titel: 'Avboka passet?',
      text: 'Vill ni hellre byta tid, välj Föreslå ny tid i stället — då ligger passet kvar tills er studiehjälpare svarat.',
      not: 'Er studiehjälpare får ett mejl om att passet är avbokat och varför.' + timmarTillbaka
    });
    if (!skäl) return;
    btn.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ status: 'cancelled', avbokningsskal: skäl })
      .eq('id', btn.dataset.avboka);
    btn.removeAttribute('aria-busy');
    if (error) { alert('Kunde inte avboka: ' + felText(error)); return; }
    await Promise.all([laddaPass(), laddaBokning()].concat(timmarTillbaka ? [laddaErbjudanden()] : []));
  });

  /* ============================================================
     NOTISER
     Bara det som väntar på er.
     ============================================================ */
  function ritaNotiser() {
    const hus = $('#notis-hus');
    if (!hus) return;
    const poster = [];

    /* Föreslagen tid FÖRST. Det är den enda notisen som väntar på
       ett svar från familjen — meddelanden och läxor kan läsas när
       som helst, men en föreslagen tid blockerar studiehjälparens
       kalender tills någon säger ja eller nej. */
    const föreslagna = (S.bokningar || []).filter(b =>
      b.status === 'requested' && b.created_by && b.created_by !== S.user.id
      && b.wanted_date >= isoFor(new Date()));
    if (föreslagna.length) {
      const f = föreslagna[0];
      poster.push({
        rubrik: föreslagna.length > 1
          ? föreslagna.length + ' föreslagna tider'
          : 'Ny tid föreslagen',
        text: föreslagna.length > 1
          ? 'Er studiehjälpare väntar på svar.'
          : (datumText(f.wanted_date)
              + (f.wanted_time ? ' kl. ' + String(f.wanted_time).slice(0, 5) : '')
              + (f.subject ? ' · ' + f.subject : '')
              + ' — svara ja eller nej.'),
        /* Pekar på Översikt, inte på passlistan: svaret ligger numera
           överst på sidan man redan står på. Rutan finns alltid när
           den här notisen finns — båda räknas ur samma filter. */
        mål: '#ov-gora'
      });
    }

    /* Ingen notis om pass att betala i förväg (Fas 19.2). Sedan
       familjen får betala efter passet är ett bekräftat, obetalt pass
       inte deras drag: det är ett val. Det som faktiskt ska betalas, ett
       genomfört pass, står i notisen om rapporten nedan, där det betalas. */

    /* En ny rapport (Fas 19.1). Rapporten mejlas aldrig (notis_mejlbara),
       så den här raden och siffran i menyn är det enda som säger att
       den kommit. */
    const rapporterAtt = S.rb.laddat && S.laddatPass ? rbAttBekräfta().length : 0;
    if (rapporterAtt) {
      poster.push({
        rubrik: rapporterAtt === 1 ? 'En rapport att bekräfta' : rapporterAtt + ' rapporter att bekräfta',
        text: 'Läs vad ni gick igenom på passet och bekräfta rapporten.',
        mål: '#rb-lista'
      });
    }

    /* En förfallen faktura (Fas 14.6). Samma sorts drag som ett pass
       att betala, och lika lätt att missa i en inkorg. */
    const förfallna = (S.fakturor || []).filter(f => NXBetalning.fakturaLage(f) === 'forfallen');
    const attBetala = obetaldaFakturor().filter(f => förfallna.indexOf(f) === -1);
    if (förfallna.length) {
      poster.push({
        rubrik: förfallna.length === 1 ? 'En faktura har förfallit' : förfallna.length + ' fakturor har förfallit',
        text: 'Betala den så snart ni kan. Har ni redan betalat kan det ta några dagar innan det syns här.',
        mål: '#bet-fakt-betala'
      });
    } else if (attBetala.length) {
      /* Fas 19.6. En skickad faktura mejlas från Fortnox och kan
         hamna bland annat i inkorgen; här står den med bankgiro och OCR. */
      const f = attBetala[0];
      poster.push({
        rubrik: attBetala.length === 1 ? 'En faktura att betala' : attBetala.length + ' fakturor att betala',
        text: attBetala.length === 1 && f.forfaller
          ? NXBetalning.kronor(f.belopp_ore) + ', senast ' + datumText(f.forfaller) + '.'
          : 'Bankgiro och OCR står under Betalning.',
        mål: '#bet-fakt-betala'
      });
    }

    if (S.olästaAntal) {
      poster.push({
        rubrik: S.olästaAntal + (S.olästaAntal > 1 ? ' nya meddelanden' : ' nytt meddelande'),
        text: 'Från er studiehjälpare. Svara i kontaktrutan.',
        mål: '#trad'
      });
    }

    const idag = isoFor(new Date());
    const brådskande = (S.laxor || []).filter(h => h.status !== 'klar' && h.due_date && h.due_date <= idag);
    if (brådskande.length) {
      const sena = brådskande.filter(h => h.due_date < idag).length;
      poster.push({
        rubrik: brådskande.length + (brådskande.length > 1 ? ' uppgifter' : ' uppgift') + ' att göra',
        text: sena ? sena + ' av dem skulle redan ha varit klara.' : 'Ska vara klar idag.',
        mål: '#nl-rek'
      });
    }

    NXStudie.notiser(hus, poster);
  }

  /* Flytta ett pass — samma tider som bokningen lyder. */
  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-flytta]');
    if (!k) return;
    const b = S.bokningar.find(x => x.id === k.dataset.flytta);
    if (!b) return;

    const upptagna = await NX.hämtaUpptagna(S.profil.matched_tutor_id);

    const ny = await NXStudie.flyttaRuta({
      datum: b.wanted_date, tid: b.wanted_time,
      upptagna,
      minuter: b.duration_min || 60
    });
    if (!ny) return;

    await medan(k, 'Flyttar…', async () => {
      const { error } = await supa.from('bookings').update({
        wanted_date: ny.datum, wanted_time: ny.tid,
        status: 'requested', created_by: S.user.id
      }).eq('id', b.id);
      if (error) {
        alert(error.code === '23505' || error.code === '23P01'
          ? 'Den tiden hann bli upptagen. Välj en annan.'
          : 'Kunde inte flytta passet: ' + felText(error));
        return;
      }
      await Promise.all([laddaPass(), laddaBokning()]);
    });
  });

  /* ============================================================
     BOKNINGEN

     Ett FÖRSLAG, inte en bokning. Familjen väljer dag, ämne, tid och
     antal barn; studiehjälparen accepterar eller föreslår en annan
     tid. Ytan ritas av NXArbete.bokning (femte omgången, se där).
     Det här är kopplingen till databasen: vad som hämtas, och vad
     som skrivs.
     ============================================================ */
  const BOKA_AMNEN = ['Matematik', 'Svenska', 'Engelska',
    'NO / Fysik / Kemi / Biologi', 'SO / Historia / Samhällskunskap', 'Annat'];

  S.boka = NXArbete.bokning({
    host: $('#boka-inner'),
    amnen: BOKA_AMNEN,
    pris: NX.CFG.PRIS_PER_TIMME || 379,
    /* Vilken tjänst förslaget gäller. Styr priset och tillägget för
       flera barn. En funktion, inte ett värde: ytan skapas innan
       katalogen laddats. */
    tjanst: () => NXTjanster.standard(),
    /* Prissidans starterbjudande (Fas 19.5), samma regel som
       forsta_timmen_bjuds() i databasen: det läxhjälpspass som gör att
       familjen har bokat två timmar får en timme bjuden, en gång.
       Avbokade pass räknas inte. Databasen avgör; här visas bara vad
       förslaget kommer att kosta. */
    bjuden: minuter => {
      const aktiva = (S.bokningar || []).filter(b => b.status !== 'cancelled'
        && b.fakturerbar !== false && (b.tjanst || 'laxhjalp') === 'laxhjalp');
      /* Ett pass med tipstimmen (rabattkod TIPS) är inte prissidans
         första timme. Den går först; annars tipstimmen, om det finns en
         kvar (2026-09-30). kvar räknas i databasen och gäller också när
         erbjudandet stängts: det som tjänats in innan ges ändå. */
      if (!aktiva.some(b => b.startrabatt && b.rabattkod !== 'TIPS')) {
        const före = aktiva.reduce((a, b) => a + (Number(b.duration_min) || 60), 0);
        if (före < 120 && före + minuter >= 120) return true;
      }
      return S.tips && Number(S.tips.kvar) > 0 ? 'tips' : false;
    },
    /* Köpta timmar i stället för priset vid knappen (2026-09-28). */
    timmar: (minuter, datum, barn) => timmarFörFörslag(minuter, datum, barn),

    /* Spärren förr yttrade sig som en avstängd knapp utan
       förklaring. Nu står skälet där kalendern skulle ha stått. */
    ladda: async () => {
      if (!S.valtBarn) {
        return { spärr: NXStudie.tomt('Lägg till ditt barn först',
          'Förslaget behöver veta vem passet gäller. Barnen läggs till under Profil & inställningar.') };
      }
      /* Bara de upptagna timmarna. Studiehjälparens veckoschema läses
         inte längre: varje timme går att föreslå, och hjälparen
         svarar. */
      const upptagna = await NX.hämtaUpptagna(S.profil.matched_tutor_id);
      /* Var ni ses: förra passet med en plats vinner, annars barnets
         önskemål från barnformuläret (Fas 15.4). "Båda går bra" ger
         inget förval — då är det ett val, inte en vana. */
      const barn = S.barn.find(x => x.id === S.valtBarn);
      const förra = (S.bokningar || [])
        .filter(b => b.student_id === S.valtBarn && b.format && b.status !== 'cancelled')
        .sort((a, c) => String(c.wanted_date).localeCompare(String(a.wanted_date)))[0];
      const önskan = barn && barn.format_onskemal === 'pa_plats' ? 'På plats'
        : barn && barn.format_onskemal === 'online' ? 'Online' : null;
      return {
        upptagna,
        /* Familjens vana: förra passets ämne och längd blir förval. */
        tidigare: (S.bokningar || []).filter(b => b.status !== 'cancelled'),
        forval: {
          format: förra ? förra.format : önskan,
          plats: förra && förra.format === 'På plats' ? (förra.location || '') : ''
        }
      };
    },

    boka: async v => {
      const { data, error } = await supa.from('bookings').insert({
        parent_id: S.user.id,
        tutor_id: S.profil.matched_tutor_id,
        student_id: S.valtBarn,
        created_by: S.user.id,
        subject: v.amne,
        tjanst: NXTjanster.standard(),
        antal_barn: v.barn || 1,
        wanted_date: v.datum,
        wanted_time: v.tid,
        duration_min: v.minuter,
        format: v.format || null,
        location: v.plats || null,
        note: v.not || null,
        status: 'requested'
      }).select('id, status, klippkort_id, betalning_status, rabattkod').single();
      if (error) {
        /* 23505 = samma starttid, 23P01 = passet krockar med ett annat
           som redan ligger där. Samma sak för den som föreslår. */
        if (error.code === '23505' || error.code === '23P01') {
          return 'Den tiden hann bli bokad, eller krockar med ett annat pass. Kalendern är uppdaterad — välj en annan tid.';
        }
        return 'Kunde inte skicka förslaget: ' + felText(error);
      }
      /* Fas 22.4: databasen betalar förslaget med timmarna i samma
         skrivning som skapar det. Ett nytt förslag kan inte ha
         kortpengar, så betalt utan kort är timbanken. Kvittot säger det,
         och Era timmar laddas om. */
      const betalt = !data || data.betalning_status !== 'betald' ? null
        : data.klippkort_id ? 'timmar' : 'timbanken';
      /* Listan laddas om bakom kvittot, inte före det. Den som trycker
         på Föreslå tiden ska få svaret när databasen gett det. */
      laddaPass();
      if (betalt) laddaErbjudanden().catch(() => {});
      /* Timmen på köpet för ett tips drogs i samma skrivning. */
      if (data && data.rabattkod === 'TIPS') laddaTips().catch(() => {});
      return { status: data ? data.status : null, id: data ? data.id : null, betalt: betalt };
    }
  });

  /* Hette byggKalender() förut. Namnet ljög efter ombyggnaden: det
     som laddas om är tiderna, kalendern är en detalj bakom en lucka. */
  async function laddaBokning() {
    if (!S.boka) return;
    await S.boka.ladda();
  }

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

     Allt läses ur samma S som sektionerna använder — två tillstånd
     hade förr eller senare glidit isär och visat en läxa som redan
     var avbockad.
     ============================================================ */
  function kortTid(iso) { return NXStudie.kortTid(iso); }

  function ritaNästaPass() {
    const idag = isoFor(new Date());
    /* Bara bekräftade. Ett förslag som väntar på svar står på
       Översikt och under Mina lektioner, men är inget "nästa pass"
       förrän studiehjälparen accepterat det. */
    const kommande = S.bokningar.filter(b => b.wanted_date >= idag && b.status === 'confirmed');

    /* Kommande pass räknas här, men visas av ritaStatistik. Den här
       funktionen körs varje gång bokningarna ändras, statistiken
       läser bara vidare. */
    S.kommandeAntal = kommande.length;
    ritaStatistik();

    const b = kommande.sort((x, y) => (x.wanted_date + (x.wanted_time || ''))
      .localeCompare(y.wanted_date + (y.wanted_time || '')))[0];
    const barn = b ? S.barn.find(x => x.id === b.student_id) : null;

    /* Kortet i hälsningen högst upp. Det är det första man ser, och
       "nästa pass" är det oftast enda man kom för att kolla.

       Två olika mål: finns ett pass leder kortet till listan, finns
       inget leder det till bokningen — som numera står på Översikt,
       inte under Mina lektioner. */
    if (S.hero) {
      S.hero.uppdatera({
        nasta: b ? {
          /* Rakt till passets sida: där står plats, betalning och
             knapparna. Listan var ett steg till innan man kom dit. */
          href: '#pass/' + b.id,
          text: 'Nästa pass · ' + datumText(b.wanted_date)
                + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
          under: [b.subject, barn ? barn.name : null].filter(Boolean).join(' · ')
        } : {
          /* Kortet ska ta en någonstans. #oversikt är sidan man
             redan står på — ett klick som inte gör något. */
          href: '#boka',
          text: 'Inga pass inbokade',
          under: 'Boka en tid hos er studiehjälpare'
        }
      });
    }
  }

  /* Öppna läxor räknas på ett ställe och visas på två: en siffra i
     sidomenyn och en på fliken. Ingen ska behöva öppna sektionen för
     att få veta om det ligger något där. */
  function ritaÖvLaxor() {
    const öppna = (S.laxor || []).filter(h => h.status !== 'klar');
    if (S.sido) S.sido.märke('nexlax', öppna.length);
    const mark = $('#flik-lax-mark');
    if (mark) { mark.hidden = !öppna.length; mark.textContent = öppna.length || ''; }
    // En försenad läxa står under Att göra på Översikt.
    ritaÖvGöra();
  }

  /* Olästa meddelanden: siffra i sidomenyn och undertext på
     hälsningens chattkort. Själva tråden ligger i Meddelanden — det
     här är vägen dit, inte en andra chatt. */
  async function ritaÖvSamtal() {
    if (S.sido) S.sido.märke('meddelanden', S.olästaAntal);
    if (S.hero) {
      S.hero.uppdatera({
        chatt: {
          href: '#meddelanden', text: 'Meddelanden',
          under: S.olästaAntal
            ? S.olästaAntal + ' oläst' + (S.olästaAntal > 1 ? 'a' : '')
            : 'Skriv till er studiehjälpare'
        }
      });
    }
  }

  /* ============================================================
     BETALNING (Fas 14.2, Fas 19.2)
     Familjen betalar varje pass med kort, antingen i förväg, när
     studiehjälparen bekräftat tiden, eller efter passet när de
     bekräftar rapporten. Här står det som går att betala i förväg och
     det som är betalt, båda ritade ur passen. Ett genomfört pass betalas
     under Bekräfta rapport, där rapporten står bredvid: betalningen efter
     passet är en del av bekräftelsen, och en knapp här hade låtit
     familjen betala utan att ha sett vad de betalar för.

     Ingenting här skriver till databasen. Beloppet räknas av
     stripe-checkout ur databasen, och kortuppgifterna tas emot av
     Stripe på deras egen sida. Vi lagrar aldrig ett kortnummer, och
     kan därför inte tappa bort ett.
     ============================================================ */

  /* Pass som går att betala. Ur samma S.bokningar som Mina lektioner,
     så att ett pass som betalas på passets sida försvinner här utan en
     egen hämtning. Knappen går rakt till Stripes kassa — samma
     data-betala som överallt. Ett genomfört pass leder i stället till
     Bekräfta rapport.

     Sedan 2026-09-28 i två grupper: det som väntar efter passet och det
     som går att betala i förväg. Förut en lista, där "Till rapporten"
     och "Betala med timmar" stod om varandra under rubriken Betala i
     förväg. Tillägget för ett pass som drog över (Fas 20.1) står med
     det genomförda, för det betalas på samma ställe. */
  function ritaAttBetala() {
    const host = $('#bet-att-betala');
    if (!host) return;
    const kronor = NXBetalning.kronor;
    const nyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');
    const alla = (S.bokningar || []).slice().sort((a, c) => nyckel(a).localeCompare(nyckel(c)));
    const efter = alla.filter(b => (b.status === 'completed' && kanBetalas(b)) || tillägg(b));
    const iFörväg = alla.filter(b => b.status !== 'completed' && kanBetalas(b));
    /* Siffran i menyn ska betyda "något väntar på er", inte "här
       finns saker". Sedan Fas 19.2 väntar ingenting här: att betala i
       förväg är ett val, och det genomförda passet räknas under
       Bekräfta rapport. Därför ingen siffra alls. */
    märkBetalning();
    ritaBetSam(efter, iFörväg);

    const efterHost = $('#bet-efter');
    if (efterHost) {
      $('#bet-efter-grupp').hidden = !efter.length;
      $('#bet-efter-antal').textContent = efter.length ? String(efter.length) : '';
      efterHost.innerHTML = efter.map(b => {
        const till = tillägg(b);
        const belopp = till ? till.belopp : passetsPris(b);
        return NXKontakt.passRad(b, {
          href: '#pass/' + b.id,
          med: medBarn(b),
          tid: false,
          plats: false,
          under: till ? 'Passet drog över med ' + tidLängd(till.minuter) + ', tillägget betalas med rapporten'
            : b.betalning_status === 'misslyckad' ? 'Förra försöket gick inte igenom'
            : 'Genomfört, betalas när ni bekräftar rapporten',
          lage: null,
          atgarder: (belopp ? '<span class="vy-rad-belopp">' + esc(kronor(belopp)) + '</span>' : '')
            + '<a class="btn btn-primary btn-sm" href="#bekrafta">Till rapporten</a>'
        });
      }).join('');
    }

    $('#bet-att-antal').textContent = iFörväg.length ? String(iFörväg.length) : '';
    if (!iFörväg.length) {
      host.innerHTML = tomt('Inget att betala i förväg',
        'När er studiehjälpare bekräftat ett pass kan ni betala det här i förväg. Annars betalar ni efter passet, när ni bekräftar rapporten.');
      return;
    }
    host.innerHTML = iFörväg.map(b => {
      const pris = passetsPris(b);
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        med: medBarn(b),
        plats: false,
        under: [pris ? kronor(pris) : null,
          b.betalning_status === 'misslyckad' ? 'Förra försöket gick inte igenom'
          : b.betalning_status === 'vantar' ? 'Betalningen är påbörjad men inte klar'
          : b.wanted_date < isoFor(new Date()) ? 'Passet har varit. Hölls det, betala det här' : null].filter(Boolean).join(' · '),
        lage: null,
        atgarder: radBetala(b)
      });
    }).join('');
  }

  /* Summan överst i Betalning: tre rutor som svarar på "är vi skyldiga
     något?" innan någon läst en rad. Efter passet är ert drag och får
     lerans ton; resten är besked. Betalt räknas på betald_at i den här
     månaden, med det som gått tillbaka avdraget, och timmarna ur
     klippkortet står för sig: de är inga kronor. */
  function ritaBetSam(efter, iFörväg) {
    const host = $('#bet-sam');
    if (!host) return;
    const kronor = NXBetalning.kronor;
    const summa = (lista, f) => lista.reduce((n, b) => n + (f(b) || 0), 0);
    const efterKr = summa(efter, b => { const t = tillägg(b); return t ? t.belopp : passetsPris(b); });
    const förvägKr = summa(iFörväg, passetsPris);
    const månad = isoFor(new Date()).slice(0, 7);
    const iMånaden = (S.bokningar || []).filter(b => BETALDA.indexOf(b.betalning_status) !== -1
      && b.betald_at && isoFor(new Date(b.betald_at)).slice(0, 7) === månad);
    const betaltKr = summa(iMånaden, b => Math.max(Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0), 0));
    const timmarPass = iMånaden.filter(b => b.klippkort_id && !Number(b.betalt_ore || 0));
    const timmar = summa(timmarPass, b => Math.max(1, Math.round(Number(b.duration_min || 60) / 60)));
    const ruta = (klass, etikett, belopp, under) => '<div' + (klass ? ' class="' + klass + '"' : '') + '>'
      + '<small>' + esc(etikett) + '</small><b>' + esc(belopp) + '</b><span>' + esc(under) + '</span></div>';
    host.innerHTML =
      ruta(efter.length ? 'ar-gor' : '', 'Efter passet', efter.length ? kronor(efterKr) : '0 kr',
        efter.length ? (efter.length === 1 ? '1 pass väntar på er' : efter.length + ' pass väntar på er') : 'Inget väntar på er')
      + ruta('', 'Kan betalas i förväg', iFörväg.length ? kronor(förvägKr) : '0 kr',
        iFörväg.length ? (iFörväg.length === 1 ? '1 bekräftat pass' : iFörväg.length + ' bekräftade pass') : 'Inget bekräftat pass')
      + ruta('', 'Betalt i ' + (NX.MANADER[new Date().getMonth()] || 'månaden'), kronor(betaltKr),
        timmar ? 'och ' + (timmar === 1 ? '1 timme' : timmar + ' timmar') + ' ur klippkortet'
          : iMånaden.length ? (iMånaden.length === 1 ? '1 pass' : iMånaden.length + ' pass') : 'Inget betalt än');
  }

  /* Det betalda, senaste betalningen först. Beloppet är det Stripe
     faktiskt drog (betalt_ore skrivs bara av webhooken), och en
     återbetalning står under, så att raden aldrig ser ut att lova mer
     än som betalats. */
  function ritaBetalda() {
    const lista = $('#bet-lista');
    if (!lista) return;
    const kronor = NXBetalning.kronor;
    const betalda = (S.bokningar || []).filter(b => BETALDA.indexOf(b.betalning_status) !== -1 && b.betald_at)
      .sort((a, c) => String(c.betald_at).localeCompare(String(a.betald_at)));
    $('#bet-antal').textContent = betalda.length ? String(betalda.length) : '';
    lista.innerHTML = betalda.length
      ? betalda.map(b => {
          const betalt = Number(b.betalt_ore || 0), tillbaka = Number(b.aterbetald_ore || 0);
          /* Ett pass betalt med timmar har inget kortbelopp: pengarna
             ligger på klippkortet (Fas 16.1). Till höger står vad som
             drogs, inte ett märke som säger Betalt under rubriken
             Betalda pass. Ett återbetalt eller bestritt pass behåller
             sitt märke: det är det enda som skiljer dem från resten. */
          const timmar = Math.max(1, Math.round(Number(b.duration_min || 60) / 60));
          const drogs = b.klippkort_id && !betalt ? (timmar === 1 ? '1 timme' : timmar + ' timmar')
            : medBanken(b) && !betalt ? tidLängd(Number(b.duration_min || 60)) : betalt ? kronor(betalt) : '';
          return NXKontakt.passRad(b, {
            href: '#pass/' + b.id,
            med: medBarn(b),
            tid: false,
            plats: false,
            under: [b.klippkort_id && !betalt ? 'Timmar ur klippkortet' : medBanken(b) && !betalt ? 'Timbanken' : 'Kort',
              'betalt ' + kortDatum(isoFor(new Date(b.betald_at)))].join(' · '),
            vem: !tillbaka ? null
              : tillbaka >= betalt ? 'Hela beloppet är återbetalt.'
              : kronor(tillbaka) + ' är återbetalt.',
            lage: b.betalning_status === 'betald' ? null : NXKontakt.betalMärke(b),
            atgarder: drogs ? '<span class="vy-rad-belopp">' + esc(drogs) + '</span>' : ''
          });
        }).join('')
      : tomt('Inga betalningar än', 'Betalda pass står här, med belopp och dag.');
  }

  /* Tillbaka från Stripe. stripe-checkout skickar familjen till
     /foralder?betalt=<session> eller ?betalning=avbruten. Adressen
     städas direkt — innan sidomenyn läser den — så att en omladdning
     inte visar beskedet igen, och så att sidan öppnar på Betalning. */
  function läsBetalsvar() {
    const q = new URLSearchParams(location.search);
    const svar = q.has('betalt') ? 'betalt' : q.has('kopt') ? 'kopt'
      : q.get('betalning') === 'avbruten' ? 'avbruten' : null;
    if (svar && window.history && history.replaceState) {
      // Ett köpt erbjudande (Fas 16.1) öppnar på Erbjudanden.
      history.replaceState(null, '', location.pathname + (svar === 'kopt' ? '#erbjudanden' : '#betalning'));
    }
    return svar;
  }

  function visaBetalsvar(svar) {
    if (svar === 'kopt') {
      const em = $('#erb-msg');
      if (em) säg(em, '✓ Tack! Köpet är klart. Timmarna syns under Era timmar om en liten stund.', true);
      setTimeout(() => { Promise.all([laddaErbjudanden(), laddaPass()]).catch(() => {}); }, 5000);
      return;
    }
    const msg = $('#bet-msg');
    if (!svar || !msg) return;
    if (svar === 'betalt') {
      säg(msg, '✓ Tack! Betalningen är mottagen. Det kan ta en liten stund innan passet står som betalt här.', true);
      /* Webhooken brukar hinna före familjen tillbaka hit, men inte
         alltid. En omläsning efter några sekunder tar det fallet, i
         stället för att låta passet stå som obetalt tills någon laddar om. */
      setTimeout(() => { laddaPass().catch(() => {}); }, 5000);
    } else {
      säg(msg, 'Betalningen avbröts, och inget drogs från kortet. Passet står kvar under Att betala.', false);
    }
  }

  /* ============================================================
     I SIFFROR
     Allt räknas ur passen och läxorna som faktiskt finns. Ingen
     siffra är uppskattad: står det tre avklarade läxor så är tre
     läxor avbockade i databasen.
     ============================================================ */
  /* De två fördelningarna. Lägena och färgerna är samma som i
     rapportformuläret och i nivåmätaren — samma sak ska ha samma
     färg i hela produkten. */
  const GICK_LAGEN = [
    ['mycket_bra', 'Mycket bra', 'ar-bra'],
    ['bra', 'Bra', 'ar-mitten'],
    ['folja_upp', 'Behöver följas upp', 'ar-folj']
  ];
  /* Tre grupper av de fem stegen. Fem färger i en stapel går inte att
     läsa av på en halv sekund, och frågan på Översikt är "hur mycket
     sitter", inte exakt var varje område ligger — det står under Din
     utveckling i NexLäx. */
  const NIVA_LAGEN = [
    ['saker', 'Säker eller bättre', 'ar-bra'],
    ['god', 'På god väg', 'ar-mitten'],
    ['trana', 'Behöver träna', 'ar-folj']
  ];
  const nivåGrupp = p => {
    const st = NXStudie.stegFör(p);
    return st >= 4 ? 'saker' : st === 3 ? 'god' : 'trana';
  };

  function ritaFordelningar() {
    const rapporter = S.rapporter || [];
    /* Rapporter skrivna innan omdömet fanns har gick = null. De
       räknas inte med, och antalet i rubriken säger hur många som
       faktiskt ligger bakom stapeln. */
    const medOmdome = rapporter.filter(r => r.gick);
    $('#stat-gick-antal').textContent = medOmdome.length
      ? medOmdome.length + ' av ' + rapporter.length + ' rapporter'
      : '';

    NXStudie.fordelning({
      host: $('#stat-gick'),
      lagen: GICK_LAGEN,
      rader: rapporter,
      av: r => r.gick,
      tom: rapporter.length
        ? 'Rapporterna hittills skrevs innan omdömet fanns. Nästa pass syns här.'
        : 'Ingen rapport än. Den första kommer efter första passet.'
    });

    const progress = S.progress || [];
    $('#stat-niva-antal').textContent = progress.length ? progress.length + ' st' : '';
    NXStudie.fordelning({
      host: $('#stat-niva'),
      lagen: NIVA_LAGEN,
      rader: progress,
      av: nivåGrupp,
      tom: 'Inga områden än. Er studiehjälpare fyller i dem efter några pass.'
    });
  }

  function ritaStatistik() {
    const tal = $('#stat-tal'), graf = $('#stat-graf');
    if (!tal) return;

    const genomforda = S.bokningar.filter(b => b.status === 'completed');
    const klara = (S.laxor || []).filter(h => h.status === 'klar').length;

    /* Studietiden räknas på passens längd och inte på antalet, så
       ett tvåtimmarspass räknas som två timmar. Bara genomförda
       pass — ett inbokat pass är ingen studietid än. */
    const minuter = genomforda.reduce((n, b) => n + (b.duration_min || 60), 0);
    const timmar = minuter >= 60
      ? Math.round(minuter / 6) / 10 + ' h'
      : minuter + ' min';

    /* Kunskapsområdena räknas under Så går det, bredvid, och står
       inte här en gång till. */
    tal.innerHTML = '<div class="stat-tal">'
      + '<div><b>' + genomforda.length + '</b><span>Genomförda pass</span></div>'
      + '<div><b>' + esc(timmar) + '</b><span>Studietid</span></div>'
      + '<div><b>' + (S.kommandeAntal || 0) + '</b><span>Kommande pass</span></div>'
      + '<div><b>' + klara + '</b><span>Avklarade uppgifter</span></div>'
      + '</div>';

    ritaFordelningar();
    veckoGraf(graf);
  }

  /* ============================================================
     STUDIETIDEN VECKA FÖR VECKA (2026-09-28)
     Tre veckor bakåt, den här och två framåt. Förut sex månader, och
     för en familj som just börjat var fem av sex staplar noll. Det
     genomförda är fyllt och det bokade streckat, i samma färg: två
     färger bredvid varandra gick inte att skilja åt för den som är
     färgblind, och skillnaden är ändå vad som hänt och vad som ska
     hända, inte två sorter. Timmarna står ovanför stapeln och hela
     veckan i title, och tabellen under läses av skärmläsare.
     ============================================================ */
  function veckonummer(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dag = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dag);
    const år = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - år) / 86400000 + 1) / 7);
  }
  const timmarKort = m => {
    const h = Math.round(m / 6) / 10;
    return String(h).replace('.', ',') + ' h';
  };

  function veckoGraf(host) {
    if (!host) return;
    const idag = new Date(isoFor(new Date()) + 'T12:00:00');
    const måndag = new Date(idag);
    måndag.setDate(idag.getDate() - ((idag.getDay() + 6) % 7));
    const veckor = [];
    for (let i = -3; i <= 2; i++) {
      const start = new Date(måndag);
      start.setDate(måndag.getDate() + i * 7);
      const slut = new Date(start);
      slut.setDate(start.getDate() + 7);
      veckor.push({ från: isoFor(start), till: isoFor(slut), nr: veckonummer(start), nu: i === 0, gjort: 0, bokat: 0 });
    }
    const idagIso = isoFor(new Date());
    (S.bokningar || []).forEach(b => {
      const v = veckor.find(x => b.wanted_date >= x.från && b.wanted_date < x.till);
      if (!v) return;
      if (b.status === 'completed') v.gjort += Number(b.duration_min || 60);
      else if (b.status === 'confirmed' && b.wanted_date >= idagIso) v.bokat += Number(b.duration_min || 60);
    });
    const högst = Math.max(60, ...veckor.map(v => v.gjort + v.bokat));
    const något = veckor.some(v => v.gjort + v.bokat);
    const beskriv = v => 'Vecka ' + v.nr + ': '
      + ([v.gjort ? timmarKort(v.gjort) + ' genomfört' : null, v.bokat ? timmarKort(v.bokat) + ' bokat' : null]
        .filter(Boolean).join(', ') || 'inga pass');

    host.innerHTML = '<p class="ov-delrub">Studietid per vecka</p>'
      + '<div class="vg" aria-hidden="true">' + veckor.map(v => {
          const summa = v.gjort + v.bokat;
          return '<div class="vg-v' + (v.nu ? ' ar-nu' : '') + '" title="' + esc(beskriv(v)) + '">'
            + '<b>' + (summa ? esc(timmarKort(summa)) : '') + '</b>'
            + '<span class="vg-stapel">'
            + (v.bokat ? '<i class="vg-bokat" style="height:' + (v.bokat / högst * 100).toFixed(1) + '%"></i>' : '')
            + (v.gjort ? '<i class="vg-gjort" style="height:' + (v.gjort / högst * 100).toFixed(1) + '%"></i>' : '')
            + (summa ? '' : '<i class="vg-noll"></i>')
            + '</span>'
            + '<small>' + (v.nu ? 'nu' : 'v. ' + v.nr) + '</small></div>';
        }).join('') + '</div>'
      + '<div class="vg-leg" aria-hidden="true"><span><i class="vg-gjort"></i>Genomförda</span><span><i class="vg-bokat"></i>Bokade</span></div>'
      + '<table class="nx-dold"><caption>Studietid per vecka</caption>'
      + '<tr><th>Vecka</th><th>Genomfört</th><th>Bokat</th></tr>'
      + veckor.map(v => '<tr><td>' + v.nr + '</td><td>' + esc(timmarKort(v.gjort)) + '</td><td>' + esc(timmarKort(v.bokat)) + '</td></tr>').join('')
      + '</table>'
      + '<p class="graf-not">' + esc(något
          ? 'Ett pass räknas som genomfört när er studiehjälpare har skrivit rapporten.'
          : 'Inga pass de här veckorna. Boka en tid under Boka pass, så står den här.') + '</p>';
  }

  /* ============================================================
     SCHEMAT
     Kalendern nedanför svarar på "när kan vi ses?". Schemat svarar på
     "vad ligger redan?". Båda läser S.bokningar, så en avbokning syns
     i båda utan att något behöver hållas i synk.
     ============================================================ */
  function byggSchema() {
    NXStudie.schemaI(S, {
      /* Månaden, inte Kommande: passlistan precis ovanför är redan
         de kommande passen. Här är schemat överblicken. */
      lage: 'manad',
      namn: b => {
        const barn = S.barn.find(x => x.id === b.student_id);
        return barn ? barn.name : ((S.tutor && S.tutor.full_name) || '');
      },
      /* Ett pass i schemat öppnar passets sida, samma som raden i
         listan. Förut en ruta ovanpå — två vägar till samma pass som
         visade olika mycket. */
      onOppna: b => { location.hash = '#pass/' + b.id; }
    });
  }

  /* Sektionsbytet. Passets sida är en egen sektion utan egen post i
     menyn: den hör till där man kom ifrån. */
  const SEKTIONSNAMN = { oversikt: 'Översikt', lektioner: 'Mina lektioner', betalning: 'Betalning', boka: 'Boka pass', bekrafta: 'Bekräfta rapport' };
  function bytteSektion(vald) {
    const förra = S.aktivSek;
    S.aktivSek = vald;
    if (vald === 'pass') {
      if (förra && förra !== 'pass') S.passFrån = förra;
      ritaPassSida();
      const hem = $('#vy-sido a[data-sek="' + (SEKTIONSNAMN[S.passFrån] ? S.passFrån : 'lektioner') + '"]');
      if (hem) hem.classList.add('ar-har');
      /* En ny sida börjar överst — men bara om man inte redan ser
         början. Utan animering: en glidning uppåt var precis det
         Leo menade med att skickas iväg. */
      const sek = $('section[data-sek="pass"]');
      if (sek) {
        const topp = sek.getBoundingClientRect().top;
        if (topp < 90 || topp > window.innerHeight * 0.6) NXStudie.visaÖverst(sek);
      }
      return;
    }
    /* Tillbaka från ett pass: dit man var. */
    if (förra === 'pass' && S.yFör[vald] != null) {
      const y = S.yFör[vald];
      requestAnimationFrame(() => NXStudie.scrollaTill(y));
    }
  }

  /* ============================================================
     PASSETS SIDA (#pass/<id>)

     Leo 2026-09-24: en egen sida per pass, där man ser allt om det
     och kan avboka eller föreslå en ny tid. Ritningen är delad med
     studiehjälparvyn (NXStudie.passSida); här bestäms vad familjen
     ser och får göra.

     Knapparna bär samma data-attribut som raderna i passlistan, så de
     delegerade hanterarna tar hand om dem. Ingen andra uppsättning
     logik som kan hamna ur synk med den första. Efter varje skrivning
     laddar laddaPass() om listan och ritar sidan på nytt härifrån.
     ============================================================ */
  function passIdIAdressen() {
    const [huvud, id] = String(location.hash || '').replace(/^#/, '').split('/');
    return huvud === 'pass' && id ? decodeURIComponent(id) : null;
  }

  /* Rapporten hämtas när sidan öppnas, inte med listan: den behövs
     bara för ett pass åt gången, och bara för genomförda. */
  const rapportFör = {};
  async function hämtaRapport(id) {
    if (id in rapportFör) return rapportFör[id];
    const { data } = await supa.from('lesson_reports')
      .select('gick, needs_practice, next_focus, ai_feedback, raw_notes, start_tid, slut_tid, debiterade_min, avvikelse_skal, tutor_id, lesson_date, student_id')
      .eq('booking_id', id).maybeSingle();
    rapportFör[id] = data || null;
    return rapportFör[id];
  }

  /* Vad passet kostar familjen, i ören: det kassan tar. Ett genomfört
     pass kostar den debiterade tiden, alla andra det bokade (Fas 20.1).
     Priset är det som frystes när passet bokades, minus rabatten (Fas
     19.5), som i stripe-checkout och passpris() i _delad/pris.ts. */
  function passetsPris(b) {
    return prisFör(b, b.status === 'completed' ? debiteradeMin(b) - bankMin(b) : Number(b.duration_min || 60));
  }

  /* Raden i passunderlag, för ett genomfört pass. Hämtas med passen. */
  const underlagFör = b => (b && S.underlag && S.underlag[b.id]) || null;
  const debiteradeMin = b => {
    const u = underlagFör(b);
    return Number((u && u.debiterade_min) || b.duration_min || 60);
  };
  /* Fas 22.1: övertiden timbanken tog. Kassan tar den inte (stripe-checkout). */
  const bankMin = b => {
    const u = underlagFör(b);
    return Number((u && u.timbank_min) || 0);
  };

  /* pris(m) = max(avrundat m/60 × (timpris + tillägg för fler barn) − rabatt, 0).
     Regeln bor i NXBetalning.passpris sedan 2026-09-28, för adminvyns
     Månadens ekonomi räknar samma sak; här skickas bara passets rad i
     passunderlaget med. null när inget pris går att räkna. */
  function prisFör(b, minuter) {
    return NXBetalning.passpris(b, underlagFör(b), minuter);
  }
  /* Första timmen bjuds (Fas 19.5): ett pass på en timme kan kosta
     ingenting. Det betalas inte, och ingen knapp ber om det. */
  const ingetAttBetala = b => passetsPris(b) === 0;

  async function ritaPassSida() {
    const host = $('#pass-sida');
    const id = passIdIAdressen();
    if (!host || !id) return;
    const från = SEKTIONSNAMN[S.passFrån] ? S.passFrån : 'lektioner';
    const tillbaka = { href: från === 'lektioner' ? '#lektioner/pass' : '#' + från, text: SEKTIONSNAMN[från] };

    const b = (S.bokningar || []).find(x => x.id === id);
    if (!b) {
      host.innerHTML = '<a class="ps-tillbaka" href="' + tillbaka.href + '">‹ ' + esc(tillbaka.text) + '</a>'
        + (S.laddatPass ? tomt('Passet finns inte här', 'Det kan höra till ett annat konto, eller ha tagits bort.') : laddar());
      return;
    }

    const barn = S.barn.find(x => x.id === b.student_id);
    const hjälpare = (S.tutor && S.tutor.full_name) || 'er studiehjälpare';
    const förnamn = String(hjälpare).split(' ')[0];
    const idag = isoFor(new Date());
    const framåt = b.wanted_date >= idag;
    const derasFörslag = b.created_by && b.created_by !== S.user.id;
    const l = NXKontakt.LÄGEN[b.status] || { text: b.status, klass: '' };
    const timmar = Math.max(1, Math.round((b.duration_min || 60) / 60));
    const pris = passetsPris(b);
    const skriv = '<a class="btn btn-ghost btn-sm" href="#meddelanden">Skriv till ' + esc(förnamn) + '</a>';
    /* Fas 20.1: den debiterade tiden, när den skiljer sig från den
       bokade, och övertiden att betala på ett pass som redan var betalt. */
    const deb = b.status === 'completed' && underlagFör(b) ? debiteradeMin(b) : null;
    const till = tillägg(b);
    const tillBetalt = (S.tillagg || {})[b.id];

    /* Vägen passet går. Ett avbokat pass har ingen väg kvar — där
       står beskedet i stället. */
    const steg = b.status === 'cancelled' ? [] : [
      { namn: derasFörslag ? 'Föreslaget av ' + förnamn : 'Föreslaget av er', klar: true },
      { namn: b.status === 'confirmed' || b.status === 'completed'
          ? (derasFörslag ? 'Bekräftat av er' : 'Bekräftat av ' + förnamn) : 'Bekräftat',
        klar: b.status === 'confirmed' || b.status === 'completed', nu: b.status === 'requested' },
      { namn: 'Genomfört', klar: b.status === 'completed', nu: b.status === 'confirmed' },
      { namn: 'Rapport', klar: b.status === 'completed', nu: false }
    ];

    /* Betalt eller bestritt: pengarna ligger hos Nextrum, och databasen
       nekar en avbokning härifrån (Fas 14.1). Att avböja eller dra
       tillbaka en flyttad tid är också en avbokning. Knapparna visas
       därför inte på ett betalt pass — ett nej efter ett klick är sämre
       än en mening som säger vart man vänder sig. */
    const betalt = pengarPå(b);
    const viaOss = ' Passet är redan betalt. Ska det avbokas, hör av er till oss så betalar vi tillbaka.';

    /* Ett drag överst, resten längst ner (2026-09-28, Leo: "det behöver
       se bra ut på mobil och enkelt att använda"). atgarder är det som
       är familjens drag just nu, val betalvalen som stora knappar, och
       fot det som alltid går men sällan behövs: föreslå ny tid, skriva
       och avboka. Förut stod alla i samma rad, och på en telefon var
       Avboka en knapp i full bredd lika stor som Betala. */
    const flytta = text => '<button type="button" class="btn btn-ghost btn-sm" data-flytta="' + esc(b.id) + '">' + text + '</button>';
    const avboka = (text, förslag) => '<button type="button" class="ps-fot-lank ar-fara" data-avboka="' + esc(b.id) + '"'
      + (förslag ? ' data-forslag="1"' : '') + '>' + text + '</button>';
    const bokaNästa = primär => '<a class="btn ' + (primär ? 'btn-primary' : 'btn-ghost btn-sm') + '" href="#boka">Boka nästa pass</a>';

    let besked = null, atgarder = '', alternativ = '', val = '', fot = skriv;
    /* Det studiehjälparen skrev när hen avslog tiden eller föreslog en
       annan (2026-09-30). Står på passet, aldrig i mejlet. */
    const svaret = b.svar_meddelande && (b.status === 'cancelled' || b.status === 'requested')
      ? { rubrik: förnamn + ' skriver', forst: true, html: '<p class="ps-svar">' + esc(b.svar_meddelande) + '</p>' } : null;
    if (b.status === 'cancelled') {
      const skäl = NXStudie.skälText(b.avbokningsskal);
      besked = avslagen(b)
        ? { text: förnamn + ' kan inte den tiden' + (b.svar_meddelande ? ' och skriver varför nedan.' : '.')
            + ' Föreslå gärna en ny tid, så svarar ' + förnamn + ' på den.', ton: 'lugn' }
        : b.avbokad_fran === 'requested'
        ? { text: avbokadText(b) + '.', ton: 'lugn' }
        : { text: 'Passet är avbokat' + (skäl ? ' — ' + skäl.toLowerCase() + '.' : '.'), ton: 'lugn' };
      atgarder = '<a class="btn btn-primary" href="#boka">Föreslå en ny tid</a>';
    } else if (b.status === 'requested' && derasFörslag && framåt && ärMotförslag(b)) {
      /* Motförslaget: ja eller nej. En tredje tid nekar databasen, utom
         på ett pass med kortpengar, som inte går att avböja härifrån. */
      const timmarna = medTimmar(b) ? ' Passet är betalt med era timmar, och de följer med till den här tiden. Avböjer ni kommer de tillbaka.'
        : medBanken(b) ? ' Passet är betalt med timbanken, och minuterna följer med till den här tiden. Avböjer ni kommer de tillbaka.'
        : '';
      besked = { text: förnamn + ' kan inte tiden ni föreslog och föreslår den här i stället. Passar den? '
        + (betalt ? 'Passar den inte kan ni föreslå en annan.' + viaOss
          : 'Passar den inte, avböj den och föreslå en ny tid under Boka pass.' + timmarna), ton: 'fraga' };
      atgarder = svarsKnappar(b, false)
        + (betalt ? '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Föreslå annan tid</button>' : '');
    } else if (b.status === 'requested' && derasFörslag && framåt) {
      /* Fas 22.4: timmarna betalade förslaget när det skickades, och ett
         motförslag flyttar bara tiden. Leo 2026-09-28: det är den timmen
         som fortfarande betalar passet. Obetalt står det bara när
         timmarna inte räckte då, och då betalar de passet när de blir
         lediga (timmar-betalar). */
      const svarsText = medTimmar(b) ? 'Passet är betalt med era timmar, och de följer med till den här tiden. '
          + 'Svarar ni nej kommer de tillbaka, och ni kan föreslå en annan tid.'
        : medBanken(b) ? 'Passet är betalt med timbanken, och minuterna följer med till den här tiden. '
          + 'Svarar ni nej kommer de tillbaka, och ni kan föreslå en annan tid.'
        : 'Svarar ni nej kan ni föreslå en annan.'
          + (b.betalning_status !== 'betald' && (kortFör(b) || bankFör(b)) ? ' Era timmar räcker till passet och betalar det av sig själva.' : '');
      besked = { text: förnamn + ' föreslår den här tiden. Passar den? '
        + (betalt ? 'Passar den inte kan ni föreslå en annan.' + viaOss : svarsText), ton: 'fraga' };
      // Att föreslå en annan tid är ett av svaren, inte något som alltid går.
      atgarder = svarsKnappar(b, false)
        + '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Föreslå annan tid</button>';
    } else if (b.status === 'requested' && framåt) {
      /* Fas 22.4: timmarna betalar förslaget redan när det skickas, och
         ligger kvar om studiehjälparen föreslår en annan tid. */
      const timmarna = medTimmar(b) ? ' Passet är betalt med era timmar. Föreslår ' + förnamn
          + ' en annan tid följer de med, och säger hen nej kommer de tillbaka.'
        : medBanken(b) ? ' Passet är betalt med timbanken. Föreslår ' + förnamn
          + ' en annan tid följer minuterna med, och säger hen nej kommer de tillbaka.'
        : !betalt && b.betalning_status !== 'betald' && (kortFör(b) || bankFör(b))
          ? ' Era timmar räcker till passet och betalar det av sig själva.' : '';
      besked = { text: 'Väntar på att ' + förnamn + ' accepterar tiden. Ni får ett mejl när hen svarat.' + timmarna + (betalt ? viaOss : ''), ton: 'vantar' };
      fot = flytta('Ändra tiden') + skriv + (betalt ? '' : avboka('Dra tillbaka förslaget', true));
    } else if (b.status === 'confirmed' && framåt) {
      /* Återbetald är hela beloppet tillbaka på ett pass som står
         kvar. Det är ett beslut någon hos oss tagit, och vyn gissar
         inte vilket — "betala med kort" utan en knapp hade varit en
         uppmaning som inte går att följa. */
      const ses = förnamn + ' ses med ' + (barn ? barn.name.split(' ')[0] : 'er') + ' ' + NXStudie.relativDag(b.wanted_date) + '.';
      besked = betalt
        ? { text: 'Passet är bokat och betalt. ' + ses + ' Ska det avbokas, hör av er till oss så betalar vi tillbaka.', ton: 'klart' }
        : medTimmar(b)
        ? { text: 'Passet är bokat och betalt med era timmar. ' + ses + ' Avbokar ni det kommer timmarna tillbaka.', ton: 'klart' }
        : medBanken(b)
        ? { text: 'Passet är bokat och betalt med timbanken. ' + ses + ' Avbokar ni det kommer minuterna tillbaka.', ton: 'klart' }
        : b.fakturerbar === false
        ? { text: 'Passet är bokat.', ton: 'klart' }
        : b.betalning_status === 'aterbetald'
        ? { text: 'Passet är bokat, och det ni betalade för det är återbetalt. Undrar ni varför, hör av er till oss.', ton: 'lugn' }
        : b.betalning_status === 'faktura'
        ? { text: 'Passet är bokat och betalas mot faktura. Det kommer med på fakturan i början av nästa månad.', ton: 'klart' }
        /* Fas 22.3: timmarna räcker men har inte betalat än, för de blev
           lediga efter att passet bekräftades. Jobbet tar det inom fem
           minuter; knappen gör det nu. */
        : kortFör(b) || bankFör(b)
        ? { text: 'Passet är bokat, och era timmar räcker till det. De betalar det av sig själva inom fem minuter, eller nu med knappen.', ton: 'klart' }
        : { text: 'Passet är bokat. ' + ses + ' Betala nu, eller efter passet när ni bekräftar rapporten.', ton: 'klart' };
      if (kanBetalas(b)) val = betalVal(b);
      fot = flytta('Föreslå ny tid') + skriv + (betalt ? '' : avboka('Avboka passet'));
      alternativ = fakturaNot(b) || kortNu(b, true);
    } else if (b.status === 'confirmed' && kanBetalas(b)) {
      /* Passerat och obetalt medan spärren är på — bara då släpper
         kanBetalas igenom det. Hölls passet kan rapporten inte skrivas
         förrän det är betalt, så betalningen är det som låser upp den.
         Hölls det inte är det studiehjälparen som avbokar. */
      besked = { text: 'Passet har varit men är inte betalt. Hölls det, betala det med kort, så kan ' + förnamn
        + ' skriva rapporten. Hölls det inte, avbokar ' + förnamn + ' det.', ton: 'fraga' };
      val = betalVal(b);
      alternativ = fakturaNot(b);
    } else if (b.status === 'completed' && kanBetalas(b)) {
      /* Genomfört men inte betalt: betalningen efter passet (Fas 19.2).
         Rapporten står nedan, och att välja betalsätt här bekräftar den,
         som under Bekräfta rapport. */
      besked = { text: 'Passet är genomfört. Läs rapporten nedan och bekräfta den genom att välja hur ni betalar.', ton: 'fraga' };
      val = betalVal(b);
      alternativ = fakturaNot(b);
    } else if (b.status === 'completed' && b.betalning_status === 'faktura') {
      /* Genomfört och betalas mot faktura (Fas 14.6). Står det på en
         skickad faktura säger beskedet vilken, och om den är betald. */
      const f = fakturaFör(b.id);
      const skickad = f && f.status !== 'utkast';
      const läge = skickad ? NXBetalning.fakturaLage(f) : null;
      besked = !skickad
        ? { text: 'Passet är genomfört och kommer med på nästa månadsfaktura.', ton: 'klart' }
        : läge === 'betald'
        ? { text: 'Passet är genomfört och betalt' + (f.fortnox_fakturanummer ? ', med faktura ' + f.fortnox_fakturanummer : '') + '.', ton: 'klart' }
        : { text: 'Passet är genomfört och står på faktura' + (f.fortnox_fakturanummer ? ' ' + f.fortnox_fakturanummer : 'n')
            + (f.forfaller ? ', att betala senast ' + datumText(f.forfaller) : '') + '.', ton: läge === 'forfallen' ? 'fraga' : 'klart' };
      /* Fakturan kan vara vald före rapporten; bekräftelsen står kvar. */
      const bekr = rbKnappFör(b);
      if (bekr) besked = { text: besked.text + ' Läs rapporten nedan och bekräfta den.', ton: 'fraga' };
      atgarder = bekr || bokaNästa(true);
      if (bekr) fot = bokaNästa(false) + skriv;
      alternativ = kortNu(b, true);
    } else if (b.status === 'completed' && till) {
      /* Betalt i förväg, och passet drog över (Fas 20.1). Tillägget
         betalas när rapporten bekräftas, och att betala det bekräftar
         den, som under Bekräfta rapport. */
      const bekräftad = (() => { const r = rapportFörPass(b.id); return !!(r && S.rb.bekräftade[r.id]); })();
      besked = { text: 'Passet är genomfört och betalt. ' + tilläggRad(till) + ' '
        + (bekräftad ? 'Tillägget är inte betalt än.' : 'Läs rapporten nedan och bekräfta den genom att betala tillägget.'), ton: 'fraga' };
      atgarder = tilläggKnapp(b, till, false);
    } else if (b.status === 'completed') {
      /* Betalt i förväg, eller undantaget från betalning. Rapporten
         bekräftas ändå (Fas 19.2). */
      const bekr = rbKnappFör(b);
      besked = bekr ? { text: 'Passet är genomfört. Läs rapporten nedan och bekräfta den.', ton: 'fraga' }
        : { text: 'Passet är genomfört.', ton: 'klart' };
      atgarder = bekr || bokaNästa(true);
      if (bekr) fot = bokaNästa(false) + skriv;
    } else {
      /* Tiden har passerat men passet är varken genomfört eller
         avbokat: rapporten saknas, eller ett förslag blev aldrig
         besvarat. Inget att trycka på här — det är studiehjälparens
         drag. */
      besked = { text: b.status === 'requested'
        ? 'Tiden har passerat utan att förslaget besvarades.'
        : 'Passet har varit. Det står som genomfört när ' + förnamn + ' skrivit rapporten.', ton: 'lugn' };
    }

    /* Passets eget betalläge. Sedan Fas 14.2 finns ingen faktura att
       hänvisa till: ett genomfört pass som inte är betalt är just det,
       och ska betalas på den här sidan. */
    const betalning = b.fakturerbar === false ? 'Betalas inte'
      : ingetAttBetala(b) && b.status !== 'cancelled' ? 'Inget att betala'
      /* Fas 22.4: också ett förslag kan vara betalt, med timmarna. */
      : medTimmar(b) && b.status !== 'cancelled' ? 'Betalt med era timmar'
      : medBanken(b) && b.status !== 'cancelled' ? 'Betalt med timbanken'
      : b.betalning_status === 'faktura' && b.status !== 'cancelled'
        ? (fakturaFör(b.id) && fakturaFör(b.id).fortnox_fakturanummer && fakturaFör(b.id).status !== 'utkast'
            ? 'Faktura ' + fakturaFör(b.id).fortnox_fakturanummer : 'Mot faktura')
      : b.status === 'requested' && ['betald', 'tvist'].indexOf(b.betalning_status) === -1
        ? 'Betalas när passet är bekräftat'
      : b.status === 'cancelled' ? (b.betalning_status && b.betalning_status !== 'ingen'
          ? BETALNING_TEXT[b.betalning_status] : null)
      : (BETALNING_TEXT[b.betalning_status || 'ingen'] || null);
    /* Tillägget för övertiden (Fas 20.1): att betala, påbörjat eller
       betalt. Ett återbetalt eller bestritt tillägg har admin att säga
       något om, inte den här raden. */
    const tilläggText = till ? 'Tillägg ' + (till.belopp ? NXBetalning.kronor(till.belopp) + ', ' : '')
        + (till.status === 'vantar' ? 'påbörjat' : 'inte betalt')
      : tillBetalt && tillBetalt.status === 'betald'
        ? 'Tillägg betalt' + (tillBetalt.betalt_ore ? ', ' + NXBetalning.kronor(tillBetalt.betalt_ore) : '')
      : '';
    const prisUnder = [betalning, tilläggText].filter(Boolean).join(' · ');

    /* Fas 18.1: ett bekräftat onlinepass har en Meet-länk under Var.
       Texten efter är det som står när Google inte är kopplat. */
    const möte = NXStudie.mötesRad(b, 'Länken kommer i meddelanden');
    const online = b.format === 'Online';
    const länk = möte && typeof möte[1] === 'object' ? möte[1] : null;
    const fakta = [
      { ikon: 'tid', etikett: 'När',
        varde: versal(NXStudie.dagMedVeckodag(b.wanted_date)) + (b.wanted_time ? ', ' + NXStudie.tidsspann(b.wanted_time, b.duration_min) : ''),
        under: (timmar === 1 ? '1 timme' : timmar + ' timmar')
          + (deb && deb !== Number(b.duration_min || 60) ? ', debiteras ' + tidLängd(deb) : '') },
      { ikon: online ? 'online' : 'plats', etikett: 'Var',
        varde: online ? (länk || 'Online') : (b.location || 'Plats inte angiven, skriv till ' + förnamn),
        under: online ? (länk ? 'Online' : möte ? möte[1] : null) : (b.format || null) },
      { ikon: 'vem', etikett: 'Vem',
        varde: barn ? barn.name : ((b.antal_barn || 1) > 1 ? b.antal_barn + ' barn' : 'Er familj'),
        under: [barn && (b.antal_barn || 1) > 1 ? b.antal_barn + ' barn på passet' : null,
          S.tutor && S.tutor.full_name ? 'Med ' + S.tutor.full_name + ', studiehjälpare' : 'Med er studiehjälpare'].filter(Boolean).join(' · ') },
      { ikon: 'kort', etikett: 'Pris',
        varde: pris === null ? betalning : NXBetalning.kronor(pris) + (b.startrabatt ? ', ' + påKöpet(b) : ''),
        under: pris === null ? tilläggText : prisUnder }
    ];

    /* Det som ska vara klart senast på passets dag. Filtret stod förut
       på >=, alltså läxor med deadline EFTER passet, och blocket
       försvann helt när det var tomt: det såg trasigt ut, inte tomt.
       S.laxor håller bara det valda barnets läxor, så för ett annat
       barn säger raden det i stället för "inga läxor". */
    const läxor = (S.laxor || [])
      .filter(h => h.status !== 'klar' && h.student_id === b.student_id && h.due_date && h.due_date <= b.wanted_date)
      .slice(0, 3);
    const läxTomt = b.student_id !== S.valtBarn && barn
      ? 'Välj ' + barn.name.split(' ')[0] + ' för att se uppgifterna.'
      : 'Inga öppna uppgifter till passet.';

    /* Uppgifterna som rader i ett kort, med samma ikon som i NexLäx. */
    const I = NXStudie.IKON;
    const block = [
      { rubrik: derasFörslag ? 'Anteckning från ' + förnamn : 'Er anteckning till ' + förnamn,
        html: b.note ? '<p class="ps-citat">' + esc(b.note) + '</p>' : '' },
      /* Efter passet är "uppgifter fram till passet" historia: de står
         i NexLäx, och här står rapporten. */
      { rubrik: 'Uppgifter fram till passet', html: b.status === 'cancelled' || b.status === 'completed' ? '' : läxor.length
        ? '<div class="vy-kort vy-lista">' + läxor.map(h => '<a class="vy-rad" href="#nexlax/vag">'
            + '<span class="vy-rad-ik ar-ockra">' + I.lax + '</span>'
            + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(h.title) + '</span>'
            + '<span class="vy-rad-meta"><span>Till ' + esc(NXStudie.deadlineText(h.due_date).replace(/^./, c => c.toLowerCase())) + '</span></span></span>'
            + '<span class="vy-rad-pil">' + I.pil + '</span></a>').join('') + '</div>'
        : '<p>' + esc(läxTomt) + '</p>' }
    ];

    const rita = (rapport) => NXStudie.passSida({
      host,
      tillbaka,
      datum: b.wanted_date,
      titel: (b.subject || 'Pass') + (barn ? ' med ' + barn.name.split(' ')[0] : ''),
      nar: versal(NXStudie.dagMedVeckodag(b.wanted_date)) + (b.wanted_time ? ', ' + NXStudie.tidsspann(b.wanted_time, b.duration_min) : ''),
      relativ: b.status === 'cancelled' ? null : NXStudie.relativDag(b.wanted_date),
      lage: l,
      steg,
      besked,
      belopp: val && pris ? { etikett: 'Att betala', text: NXBetalning.kronor(pris) } : null,
      val,
      atgarder,
      alternativ,
      fakta,
      fot,
      /* Samma brev som under Bekräfta rapport, direkt under beskedet som
         säger "läs rapporten nedan". Rapporten som hämtats för sidan har
         inte passets elev och dag; de tas från passet. */
      block: (rapport ? [{ rubrik: 'Rapporten', forst: true, html:
        rbBrev(Object.assign({ student_id: b.student_id, lesson_date: b.wanted_date }, rapport), b)
      }] : []).concat(svaret ? [svaret] : [], block)
    });

    /* Rapporten ur Bekräfta rapport finns ofta redan, med samma fält:
       då står den från första ritningen i stället för att skjuta in
       under sidan när hämtningen kommer. */
    rita(rapportFör[b.id] || rapportFörPass(b.id) || null);
    /* Länken hämtas efter att sidan ritats, som rapporten. Raden står
       redan på "Hämtar länken…", så kortet byter inte höjd när den kommer. */
    NXStudie.hämtaMöte(supa, b, () => { if (passIdIAdressen() === b.id) ritaPassSida(); });
    if (b.status === 'completed' && !(b.id in rapportFör)) {
      const r = await hämtaRapport(b.id);
      if (r && passIdIAdressen() === b.id) rita(r);
    }
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

  /* Pris & villkor läser tjänsteraden — samma rad bokningen räknar
     på och kortbetalningen tar betalt efter. Talen i markupen syns bara
     innan katalogen laddats. Ören blir kronor i NXBetalning.kronor,
     och bara där.

     Första timmen på köpet står i markupen sedan Fas 19.5, samma
     ändring som byggde in den i prisräkningen (forsta_timmen_bjuds i
     databasen). Innan dess stod den med flit inte här: ett löfte på
     sidan som visar priset, som kortet inte höll, hade varit ett
     villkor vi tog betalt i strid mot. */
  function ritaPris() {
    const t = NXTjanster.hitta(NXTjanster.standard());
    if (!t) return;
    const kronor = NXBetalning.kronor;
    if (t.pris_per_timme_ore) $$('[data-pris]').forEach(el => { el.textContent = kronor(t.pris_per_timme_ore); });
    const extra = t.extra_personer_max > 1 && Number(t.extra_personer_ore) > 0;
    $$('[data-pris-extra]').forEach(el => {
      el.closest('.sum-line').hidden = !extra;
      if (extra) el.textContent = '+' + kronor(t.extra_personer_ore) + ' per timme';
    });
    if (extra) $$('[data-pris-extra-et]').forEach(el => {
      el.textContent = 'Syskon på samma pass, upp till ' + t.extra_personer_max + ' barn';
    });
    $$('[data-pris-extra-not]').forEach(el => { el.hidden = !extra; });
  }

  /* ============ start ============ */
  async function start() {
   try {
    $$('[data-pris]').forEach(el => el.textContent = kr(NX.CFG.PRIS_PER_TIMME || 379));

    if (!supa) {
      visa('view-auth');
      ritaAuth();
      säg($('#auth-msg'), 'Databasen är inte kopplad än. Öppna nextrum-config.js, klistra in din Supabase-URL och anon-nyckel, spara och ladda om.', false);
      return;
    }

    S.user = await NX.hämtaSession();
    if (!S.user) { visa('view-auth'); ritaAuth(); NXStudie.länkenGickInte(sättLäge); return; }
    /* Ett barnkonto har sin egen vy (barnkonton_och_admin). Det har ingen
       profil, och det här hade annars blivit "kontot saknar profil". */
    if (NX.skickaBarnHem(S.user)) return;
    /* Försvinner inloggningen medan fliken står öppen visas
       inloggningen, inte en vy där varje knapp nekas (NXStudie). */
    NXStudie.vaktaInloggningen({ supa, user: S.user,
      utloggad: () => { läge = 'in'; ritaAuth(); visa('view-auth'); } });
    /* Från länken i ett återställningsmejl eller en inbjudan från
       bjud-in: lösenordet först. Rutan väntas in, så att dirigeringen
       nedan inte byter sida under den. */
    if (NX.återställning || NX.inbjudan) {
      await NXStudie.nyttLösenord(supa, { inbjuden: NX.inbjudan, epost: S.user.email });
    }

    /* Katalogen hämtas medan profilen hämtas, inte efter. Den behövs
       först när vyn ritas, och en fråga i kö är en fråga för mycket. */
    const katalogen = NXTjanster.ladda();
    S.profil = await NX.hämtaProfil(S.user.id);
    ritaHeader();

    if (!S.profil) {
      visa('view-auth');
      ritaAuth();
      säg($('#auth-msg'), 'Kontot finns men saknar profil i databasen. Har du kört schema.sql i Supabase? Triggern som skapar profilraden ligger där.', false);
      return;
    }

    /* Ett konto som bara är admin (admin-skapa) hör hemma i adminvyn. Den
       som också är förälder eller studiehjälpare stannar här, med länken
       Adminvy i sidhuvudet. */
    if (S.profil.role === 'admin') { location.replace('/admin'); return; }
    NXStudie.adminroll(supa, S, ritaHeader);

    if (S.profil.role === 'tutor') { visa('view-wrongrole'); return; }
    if (S.profil.match_status !== 'matched') { visa('view-locked'); return; }

    visa('view-app');

    /* Tjänstekatalogen först. Bokningen skriver `tjanst` på varje
       rad, och passlistan märker ut den när fler än en tjänst är
       aktiv — båda behöver katalogen innan de ritar något. */
    await katalogen;
    ritaPris();

    /* Flikarna först. Sidomenyn ropar på dem när den byter sektion,
       och en flikrad som inte finns än hade svalt det anropet. */
    S.flikar = {
      lektioner: NXArbete.flikar($('section[data-sek="lektioner"]')),
      nexlax: NXArbete.flikar($('section[data-sek="nexlax"]')),
      profil: NXArbete.flikar($('section[data-sek="profil"]'))
    };

    /* Pilarna som står i markupen läses av en gång här, så ett sparat
       läge syns direkt och inte först vid första klicket. */
    NXArbete.fallStall($('#view-app'));

    /* Före sidomenyn: den läser adressen när den skapas, och ett svar
       från Stripe ska öppna sidan på Betalning. */
    const betalsvar = läsBetalsvar();

    /* Var i varje sektion man stod, så att "tillbaka" från ett pass
       landar där man tryckte och inte överst i listan. Passiv
       lyssnare: den läser bara en siffra. */
    window.addEventListener('scroll', () => {
      if (S.aktivSek) S.yFör[S.aktivSek] = window.scrollY;
    }, { passive: true });

    S.sido = NXStudie.sidomeny({
      fall: 'foralder',
      nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt',
      onByt: bytteSektion
    });

    /* De fyra sektioner som slogs ihop hade egna adresser. Bokmärken,
       länkar i gamla mejl och "visa alla"-raderna inne i vyn pekar på
       dem. Alltså översätts de i stället för att gå sönder: adressen
       #studieplan blir sektionen Mina lektioner med rätt flik framme.

       Formen är #sektion/flik. Att skriva den direkt fungerar också,
       så ett internt "se studieplanen" kan länka #lektioner/plan. */
    const ALIAS = {
      studieplan: ['lektioner', 'plan'],
      rapporter: ['lektioner', 'rapporter'],
      /* #material fanns som en egen flik till Fas 13.2. Materialet
         hör nu till uppgiften det gäller, så den gamla adressen landar
         i NexLäx i stället för på ingenting. */
      material: ['nexlax', 'vag'],
      laxor: ['nexlax', 'vag'],
      /* Fas 23.2: Uppgifter och Min utveckling blev NexLäx. Adresserna
         står i bokmärken och i länkar i gamla mejl. */
      uppgifter: ['nexlax', 'vag'],
      utveckling: ['nexlax', 'utveckling'],
      studiehjalpare: ['meddelanden', null],
      installningar: ['profil', 'pris']
    };
    function följHash() {
      const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
      /* Märkena låg under Uppgifter; de står nu under Din utveckling. */
      const alias = huvud === 'uppgifter' && flik === 'marken' ? ['nexlax', 'utveckling'] : ALIAS[huvud];
      if (alias) {
        /* Ett gammalt namn: byt adressen mot det nya, så att
           bakåtknappen och delade länkar pekar rätt hädanefter.
           replace() utlöser hashchange, och då kör den här funktionen
           en gång till — men med ett namn som inte finns i ALIAS,
           så det blir en omgång, inte en snurra. */
        location.replace('#' + alias[0] + (alias[1] ? '/' + alias[1] : ''));
        return;
      }
      /* Sektionen sköts av NXStudie.sidomeny, som lyssnar på samma
         händelse och läser delen före snedstrecket. Här återstår
         fliken. */
      if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
    }
    window.addEventListener('hashchange', följHash);
    följHash();

    /* ============ HÄLSNINGEN ============
       Ritas först när namnet finns. Att visa "Hej." och byta till
       "Godkväll, Alma." en halv sekund senare är en blinkning, och
       den blinkningen ligger överst på sidan. */
    S.hero = NXArbete.hero({
      host: $('#vy-hero'),
      namn: S.profil.full_name,
      etikett: 'Studievy',
      lede: 'Planen, tiderna, kontakten och vad som hände på varje pass.',
      video: 'bilder/hero-studievy.mp4',
      bild: 'bilder/hero-nextrum-1280.webp',
      marke: { text: 'Förälder eller elev', ikon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c0-3 2.5-5.4 5.5-5.4s5.5 2.4 5.5 5.4"/><path d="M16.5 7.5h5M19 5v5"/></svg>' },
      chatt: { href: '#meddelanden', text: 'Meddelanden', under: 'Skriv till er studiehjälpare' }
    });
    ritaNästaPass();

    /* Den egna bilden ritas när den kommit, inte före allt annat. */
    if (S.profil.avatar_url) {
      M.signera('avatarer', S.profil.avatar_url).then(u => {
        /* Har en ny bild hunnit laddas upp står den kvar. */
        if (S.minAvatar == null) { S.minAvatar = u; ritaKontoAvatar(); ritaHeader(); }
      });
    }
    $('#k-namn').value = S.profil.full_name || '';
    $('#k-tel').value = S.profil.phone || '';
    $('#k-bio').value = S.profil.bio || '';
    $('#k-epost').textContent = S.profil.email || S.user.email || '';
    ritaKontoAvatar();
    ritaHeader();

    /* Notisvalen under Profil → Notiser. Ritas här, inte när fliken
       öppnas: två små frågor mot notis_val och notis_installning, och
       ingen väntan när någon faktiskt klickar sig dit. */
    NXStudie.notisval({
      host: $('#notisval-lista'),
      supa: supa,
      anvandare: S.user.id,
      roll: 'parent',
      msg: $('#notisval-msg')
    });

    /* Dokumenten under Profil → Dokument (2026-09-29): avtal och annat
       Nextrum delat med familjen. Samma modul som studiehjälparvyn. */
    NXStudie.dokument({ host: $('#dokument-lista'), supa: supa, msg: $('#dokument-msg') });

    /* Barnen först: nästan allt nedan gäller det valda barnet. Studie-
       hjälparens kort — med en signerad profilbild, två frågor i rad —
       får inte hålla passen och läxorna i kö; chatten startar när
       namnet finns. */
    /* Erbjudandena före passen: knappen Betala med timmar ritas ur dem. */
    await Promise.all([laddaBarn(), laddaSparr(), laddaErbjudanden(), laddaTips()]);
    await Promise.all([laddaTutor().then(startaTråd), laddaPlan(), laddaRapporter(), laddaLaxor(), laddaNexlax(), laddaProgress(), laddaPass(), laddaBokning(), laddaFakturor(), laddaBekrafta()]);
    /* Uppgifterna hämtas först, så märket ritas om när de finns. */
    ritaÖvLaxor();
    ritaNotiser();
    await ritaÖvSamtal();
    visaBetalsvar(betalsvar);
    /* then() är det som skickar frågan: supabase-js bygger bara anropet
       tills någon väntar på det. Utan den skrevs last_seen_at aldrig. */
    supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id)
      .then(() => {}, () => {});
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
