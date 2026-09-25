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

  NX.initHeader();

  const S = { aktivSek: null, passFrån: null, yFör: {}, laddatPass: false, user: null, profil: null, tutor: null, barn: [], valtBarn: null, kal: null, bokningar: [], trad: null, minAvatar: null, laxor: [], laxFilter: 'attgora', rapporter: [], progress: [], olästaAntal: 0, plan: null, sido: null, progressAntal: 0, schema: null, tillgangFinns: false };

  const VYER = ['view-loading', 'view-auth', 'view-locked', 'view-wrongrole', 'view-app', 'view-fel'];
  function visa(id) { NXStudie.visaVy(VYER, id); }

  /* ============ header ============ */
  function ritaHeader() { NXStudie.vyHuvud(S, 'Förälder', ritaNotiser); }

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
      titel: 'Studievyn',
      titelUpp: 'Skapa föräldrakonto',
      under: 'För dig som är förälder eller elev: studieplanen, bokningen, kontakten med er studiehjälpare och rapporten efter varje pass.',
      underUpp: 'Kontot är gratis. Vyn låses upp så fort vi matchat er med en studiehjälpare.'
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

    if (!epost || !lösen) { säg(msg, 'Fyll i e-post och lösenord.', false); return; }
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
    laddaPlan(); laddaRapporter(); laddaLaxor(); laddaProgress(); laddaBokning();
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
      text: 'Allt som hör till barnet försvinner: studieplan, läxor och rapporter. '
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
        await Promise.all([laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaPass()]);
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
     LÄXOR
     Familjen kan bara flytta status — titel, instruktion och
     deadline ägs av studiehjälparen. Det är en trigger i databasen
     som håller den gränsen, inte det här formuläret.
     ============================================================ */
  /* Vilket läge läxlistan står i. Lever i S så att det överlever
     en omritning — annars hoppar listan tillbaka till "Att göra"
     varje gång någon kryssar i en läxa. */
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

  async function laddaLaxor() {
    const host = $('#lax-lista');
    $('#lax-antal').textContent = '';
    if (!S.valtBarn) {
      S.laxor = [];
      host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.');
      ritaÖvLaxor();
      return;
    }

    NXStudie.laddarFörsta(host);
    const { data, error } = await supa
      .from('homework')
      .select('id, title, instructions, subject, due_date, status, completed_at, '
        + 'bibliotek_id, biblioteksmaterial(titel, filvag, lank)')
      .eq('student_id', S.valtBarn)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) { host.innerHTML = tomt('Kunde inte hämta läxorna', felText(error)); return; }
    if (!data.length) {
      S.laxor = [];
      host.innerHTML = tomt('Inga läxor än', 'När er studiehjälpare ger en läxa dyker den upp här.');
      ritaÖvLaxor();
      return;
    }

    S.laxor = data;
    ritaNotiser();
    ritaÖvLaxor();
    ritaStatistik();
    ritaLaxFilter();

    const öppna = data.filter(h => h.status !== 'klar').length;
    $('#lax-antal').textContent = öppna ? öppna + ' att göra' : 'allt klart';

    const urval = NXStudie.läxUrval(data, S.laxFilter);
    if (!urval.length) {
      host.innerHTML = tomt(S.laxFilter === 'klart' ? 'Inget avklarat än' : 'Inget att göra just nu',
        S.laxFilter === 'klart' ? 'Läxor ni markerar som klara samlas här.' : 'Allt ni fått är avklarat.');
      return;
    }

    host.innerHTML = urval.map(h => {
      let knappar = '';
      if (h.status === 'ej_paborjad') {
        knappar = '<button class="btn btn-ghost btn-sm" data-lax="pagaende" data-id="' + h.id + '">Jag har börjat</button>'
                + '<button class="btn btn-primary btn-sm" data-lax="klar" data-id="' + h.id + '">Klar</button>';
      } else if (h.status === 'pagaende') {
        knappar = '<button class="btn btn-primary btn-sm" data-lax="klar" data-id="' + h.id + '">Klar</button>'
                + '<button class="btn btn-ghost btn-sm" data-lax="ej_paborjad" data-id="' + h.id + '">Inte börjat än</button>';
      } else {
        knappar = '<button class="btn btn-ghost btn-sm" data-lax="pagaende" data-id="' + h.id + '">Ångra</button>';
      }
      return NXStudie.läxRad(h, {
        /* Materialet läxan bygger på (Fas 13.2). Fliken Material är
           borttagen — det som hörde till en läxa står nu på läxan,
           och det som inte hörde till någon läxa fanns det ingen
           anledning att leta efter. */
        material: h.biblioteksmaterial ? h.biblioteksmaterial.titel : null,
        materialKnapp: h.biblioteksmaterial
          ? '<button type="button" class="btn btn-ghost btn-sm" data-lax-mat="'
            + esc(h.bibliotek_id) + '">Öppna</button>' : '',
        atgarder: knappar
      });
    }).join('');
  }

  /* Materialet från en läxrad. Sökvägen följde med i hämtningen —
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

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lax]');
    if (!knapp) return;
    await medan(knapp, '…', async () => {
      const { error } = await supa.from('homework')
        .update({ status: knapp.dataset.lax }).eq('id', knapp.dataset.id);
      if (error) { alert('Kunde inte uppdatera läxan: ' + felText(error)); return; }
      await laddaLaxor();
    });
  });

  /* ============================================================
     UTVECKLING
     Läsvy. Det är studiehjälparen som sätter nivåerna.
     ============================================================ */
  async function laddaProgress() {
    const host = $('#prg-lista');
    /* Utvecklingssidan töms bara när det inte finns något barn. Förut
       tömdes den före varje hämtning, och sidan krympte med alla
       graferna medan de hämtades om — samma hopp som i läxorna. */
    if (!S.valtBarn) {
      $('#prg-antal').textContent = '';
      ['#ut-tal', '#ut-amnen', '#ut-graf', '#ut-framsteg'].forEach(id => { const e = $(id); if (e) e.innerHTML = ''; });
      host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.');
      return;
    }

    NXStudie.laddarFörsta(host);
    const [svar, hist] = await Promise.all([
      supa.from('progress_items').select('id, subject, area, level, steg, mal_steg, comment, updated_at')
        .eq('student_id', S.valtBarn).order('subject').order('area'),
      supa.from('progress_historik').select('progress_id, subject, area, steg, bedomd_at')
        .eq('student_id', S.valtBarn).order('bedomd_at')
    ]);
    const { data, error } = svar;
    if (error) { host.innerHTML = tomt('Kunde inte hämta utvecklingen', felText(error)); return; }

    /* Historiken är ett tillägg: faller den frågan visas läget ändå,
       bara utan det som handlar om tid. */
    S.historik = {};
    if (!hist.error) (hist.data || []).forEach(h => {
      (S.historik[h.progress_id] = S.historik[h.progress_id] || []).push(h);
    });

    S.progress = data;
    S.progressAntal = data.length;
    ritaStatistik();
    if (!data.length) {
      $('#prg-antal').textContent = '';
      ['#ut-amnen', '#ut-graf', '#ut-framsteg'].forEach(id => { const e = $(id); if (e) e.innerHTML = ''; });
      host.innerHTML = tomt('Inget att visa än',
        'Efter några pass bedömer er studiehjälpare vilka områden som sitter och vilka som behöver mer träning.');
      $('#ut-tal').innerHTML = tomt('Inga bedömningar än', 'Siffrorna fylls i efter de första passen.');
      return;
    }
    $('#prg-antal').textContent = data.length + ' områden';
    ritaUtveckling();
    host.innerHTML = NXStudie.progressPerÄmne(data, {
      historik: p => NXStudie.historikRad(S.historik[p.id])
    });
  }

  /* ============================================================
     MIN UTVECKLING
     Allt nedan räknas ur S.progress (läget nu) och S.historik (varje
     bedömning som gjorts). Stegen är NXStudie.STEG, samma fem som
     studiehjälparen sätter.
     ============================================================ */
  function ritaUtveckling() {
    const p = S.progress || [];
    const H = S.historik || {};
    const steg = x => NXStudie.stegFör(x);
    const gräns = Date.now() - 30 * 86400000;

    /* "Gått upp" jämför läget nu med den senaste bedömningen före
       gränsen, eller med den första för ett område som är nyare än
       så. Samma regel som ämneskorten (NXStudie.ämnesSammanfattning). */
    const gickUpp = p.filter(x => {
      const h = H[x.id] || [];
      if (!h.length) return false;
      const före = h.filter(y => Date.parse(y.bedomd_at) < gräns);
      const bas = före.length ? före[före.length - 1] : (h.length > 1 ? h[0] : null);
      return !!bas && steg(x) > Number(bas.steg);
    }).length;
    const säkra = p.filter(x => steg(x) >= 4).length;
    const medMål = p.filter(x => NXStudie.målFör(x));
    const nådda = medMål.filter(x => steg(x) >= NXStudie.målFör(x)).length;
    /* Genomfört pass = rapporterat (ordlistan). Räknat på rapporterna
       för det valda barnet, inte på passens status. */
    const rapporterade = (S.rapporter || []).length;
    /* Snittet i dag. Samma tal som sista stapeln i Nivån över tid:
       historiken bakfylldes ur progress_items i Fas 15.3 och skrivs av
       triggern progress_items_historik vid varje nytt steg. Triggern
       lyssnar på "update of steg", så en klient som bara skrev level
       hade ändrat steget utan en historikrad och fått de två att
       glida isär. Ingen klient gör det i dag — alla skriver steg. */
    const snitt = p.reduce((a, x) => a + steg(x), 0) / p.length;
    const ämnen = new Set(p.map(x => x.subject)).size;
    const vem = namnPåBarnet();

    const andel = Math.round(säkra / p.length * 100);
    const omkrets = 2 * Math.PI * 26;
    const ring = '<div class="ut-ring" role="img" aria-label="' + säkra + ' av ' + p.length
      + ' områden är på Säker eller bättre">'
      + '<svg viewBox="0 0 60 60" aria-hidden="true">'
      + '<circle class="ut-ring-bas" cx="30" cy="30" r="26"></circle>'
      + '<circle class="ut-ring-fyll" cx="30" cy="30" r="26" stroke-dasharray="'
      + (omkrets * säkra / p.length).toFixed(1) + ' ' + omkrets.toFixed(1) + '"></circle>'
      + '</svg><span class="ut-ring-tal"><b>' + andel + '<i>%</i></b></span></div>';

    /* Skalan står FÖRE det första talet som bygger på den. Leo
       2026-09-24: "det är oklart hur statistiken beräknas" — "2,0 av 5"
       säger ingenting till den som inte vet vad 2 är, och förut stod
       skalan först under grafen, fyra rutor längre ned. Steg 4 och 5
       är märkta: det är de som räknas som "sitter säkert". */
    const skala = '<div class="ut-skala">'
      + '<h6>Skalan studiehjälparen bedömer på</h6>'
      + '<ol>' + [1, 2, 3, 4, 5].map(n => '<li' + (n >= 4 ? ' class="ar-saker"' : '') + '>'
        + '<b aria-hidden="true">' + n + '</b>'
        + '<span><strong>' + esc(NXStudie.STEG[n].text) + '</strong> ' + esc(NXStudie.STEG[n].vad) + '</span>'
        + '</li>').join('') + '</ol></div>';

    /* Varje tal säger vad det räknas ur, under sin etikett. En siffra
       som föräldern inte kan förklara för sitt barn är ingen
       upplysning. "Säker eller bättre" stod förut både i ringen och
       som eget tal; snittnivån tar dess plats och knyter ihop talen
       med ämneskorten och grafen, som båda räknar i snitt. */
    const tal = [
      [String(rapporterade), 'Pass med rapport',
        'Pass där studiehjälparen skrivit en rapport. Bokade pass utan rapport räknas inte.'],
      [String(p.length), 'Bedömda områden',
        'Delar av ett ämne, som Bråk i matematik. Just nu i ' + (ämnen === 1 ? 'ett ämne.' : ämnen + ' ämnen.')],
      [esc(snitt.toFixed(1).replace('.', ',')) + '<i class="ut-tal-av"> av 5</i>', 'Snittnivå i dag',
        'Snittet av alla områdens nivå just nu, på skalan ovan.'],
      [String(gickUpp), 'Gått upp på 30 dagar',
        'Områden som står högre i dag än för 30 dagar sedan. Ett nyare område jämförs med sin första bedömning.'],
      [medMål.length ? nådda + '<i class="ut-tal-av"> / ' + medMål.length + '</i>' : '–', 'Mål nådda',
        medMål.length
          ? 'Av de ' + medMål.length + (medMål.length === 1 ? ' område' : ' områden') + ' där studiehjälparen satt ett mål.'
          : 'Inget område har ett mål än. Målet sätts av studiehjälparen.']
    ];

    $('#ut-tal').innerHTML = '<div class="ut-sammanfattning">' + ring
      + '<div class="ut-sammanfattning-text">'
      + '<b>' + säkra + ' av ' + p.length + (p.length === 1 ? ' område sitter' : ' områden sitter') + ' säkert</b>'
      + '<span>Säkert betyder steg 4 eller 5 på skalan nedan: ' + esc(vem) + ' klarar det på egen hand. '
      + 'Alla tal på sidan räknas ur studiehjälparens bedömningar efter passen.</span>'
      + '</div></div>'
      + skala
      + '<div class="stat-tal stat-tal-5 stat-tal-forklarad">'
      + tal.map(t => '<div><b>' + t[0] + '</b><span>' + esc(t[1]) + '</span><small>' + esc(t[2]) + '</small></div>').join('')
      + '</div>';

    $('#ut-amnen').innerHTML = NXStudie.ämnesSammanfattning(p, H);
    ritaNivåÖverTid(p, H);
    ritaFramsteg(p, H);
  }

  function namnPåBarnet() {
    const b = S.barn.find(x => x.id === S.valtBarn);
    return b ? (b.name || '').split(' ')[0] : 'eleven';
  }

  /* Genomsnittlig nivå vid varje månads slut: för varje område den
     senaste bedömningen fram till dess, och snittet av dem. Ett område
     räknas först från sin första bedömning, och en månad utan några
     bedömningar alls står tom — ett tal som ärvts från ingenstans
     räknas med i intrycket utan att någon ser att det är gissat.

     Skalan är fast, 0–5, inte relativ till månaden med högst värde:
     2,8 och 3,0 är nästan samma sak och ska se ut så. */
  function ritaNivåÖverTid(p, H) {
    const host = $('#ut-graf');
    if (!host) return;
    const månader = NXArbete.sexMånader();
    const nu = new Date();
    const punkter = månader.map((m, i) => {
      const [år, mån] = m.nyckel.split('-').map(Number);
      const slut = i === månader.length - 1 ? nu.getTime() : new Date(år, mån, 1).getTime() - 1;
      const nivåer = p.map(x => {
        const före = (H[x.id] || []).filter(h => Date.parse(h.bedomd_at) <= slut);
        return före.length ? Number(före[före.length - 1].steg) : null;
      }).filter(v => v);
      return { namn: m.namn, snitt: nivåer.length ? nivåer.reduce((a, b) => a + b, 0) / nivåer.length : null, antal: nivåer.length };
    });
    if (!punkter.some(x => x.snitt)) {
      host.innerHTML = tomt('Ingen historik än', 'Grafen fylls i när er studiehjälpare bedömt områdena några gånger.');
      return;
    }
    /* Hur många områden varje stapel bygger på står UNDER den, synligt.
       Förut låg det i ett title-attribut, som ingen telefon visar: ett
       snitt av ett område och ett snitt av tolv såg likadana ut. */
    host.innerHTML = '<div class="graf graf-med-antal">' + punkter.map((x, i) =>
      '<div class="graf-stapel' + (i === punkter.length - 1 ? ' nu' : '') + '"'
      + ' aria-label="' + esc(x.namn + ': ' + (x.snitt
          ? x.snitt.toFixed(1).replace('.', ',') + ' av 5, ' + x.antal + (x.antal === 1 ? ' område' : ' områden')
          : 'inget bedömt')) + '">'
      + '<b>' + (x.snitt ? esc(x.snitt.toFixed(1).replace('.', ',')) : '–') + '</b>'
      + '<i style="height:' + (x.snitt ? Math.round(x.snitt / 5 * 100) : 0) + '%"></i>'
      + '<span>' + esc(i === punkter.length - 1 ? 'I dag' : x.namn) + '</span>'
      + '<small>' + (x.snitt ? esc(x.antal + ' omr.') : '&nbsp;') + '</small></div>').join('') + '</div>'
      + '<p class="graf-not">Under månaden står hur många områden snittet bygger på. En tom månad betyder att inget var bedömt då, inte att det gick bakåt.</p>';
  }

  /* Varje steg uppåt i historiken, senaste först. Bara uppåt: en
     bedömning som sänks är viktig att se i Område för område, men en
     lista som heter Framsteg ska inte ha den. */
  function ritaFramsteg(p, H) {
    const host = $('#ut-framsteg');
    if (!host) return;
    const händelser = [];
    p.forEach(x => {
      const h = H[x.id] || [];
      for (let i = 1; i < h.length; i++) {
        if (Number(h[i].steg) > Number(h[i - 1].steg)) {
          händelser.push({ område: x.area, ämne: x.subject, från: Number(h[i - 1].steg), till: Number(h[i].steg), när: h[i].bedomd_at });
        }
      }
    });
    händelser.sort((a, b) => Date.parse(b.när) - Date.parse(a.när));
    if (!händelser.length) {
      host.innerHTML = tomt('Inga steg uppåt än',
        'De syns här när er studiehjälpare bedömt samma område igen och det har gått framåt.');
      return;
    }
    host.innerHTML = '<div class="ut-framsteg">' + händelser.slice(0, 6).map(e =>
      '<div class="ut-framsteg-rad">'
      + '<span class="ut-framsteg-pil" aria-hidden="true">↑</span>'
      + '<span class="ut-framsteg-text"><b>' + esc(e.område) + '</b>'
      + '<span>' + esc(e.ämne + ' · ' + NXStudie.stegText(e.från) + ' → ' + NXStudie.stegText(e.till)) + '</span></span>'
      + '<time>' + esc(datumText(String(e.när).slice(0, 10))) + '</time>'
      + '</div>').join('') + '</div>';
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
    $('#plan-uppdaterad').textContent = p.updated_at ? 'uppdaterad ' + datumText(String(p.updated_at).slice(0, 10)) : '';
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
      .from('lesson_reports').select('id, lesson_date, raw_notes, ai_feedback, gick, amne, needs_practice, next_focus')
      .eq('student_id', S.valtBarn).order('lesson_date', { ascending: false });

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }

    S.rapporter = data || [];
    ritaStatistik();

    if (!data || !data.length) {
      host.innerHTML = '<div class="empty">Inga rapporter än. Den första kommer efter första passet.</div>';
      ritaRecension(0);
      return;
    }
    $('#rapport-antal').textContent = data.length + ' st';
    ritaRecension(data.length);
    host.innerHTML = data.map(r =>
      '<div class="report">'
      + '<div class="report-head"><b>Pass</b><time>' + esc(datumText(r.lesson_date)) + '</time></div>'
      + (r.ai_feedback
          ? '<p>' + esc(r.ai_feedback) + '</p>'
          : '<span class="raw-note">Studiehjälparens anteckningar</span><p class="raw">' + esc(r.raw_notes) + '</p>')
      + (r.went_well ? '<p class="small" style="margin-top:10px"><b>Hur det gick:</b> ' + esc(r.went_well) + '</p>' : '')
      + (r.needs_practice ? '<p class="small" style="margin-top:6px"><b>Behöver träna på:</b> ' + esc(r.needs_practice) + '</p>' : '')
      + (r.next_focus ? '<p class="small" style="margin-top:6px"><b>Nästa fokus:</b> ' + esc(r.next_focus) + '</p>' : '')
      + '</div>').join('');
  }

  /* Svarsknapparna på en föreslagen tid. Tre ställen visar dem —
     passlistan, passrutan och Översikt — och de tre måste säga samma
     sak. Två kopior fanns redan och hade hunnit skilja sig åt i
     märkningen; en tredje hade varit en tredje som kan glida isär. */
  function svarsKnappar(b, små) {
    const s = små ? ' btn-sm' : '';
    /* Ett betalt pass som flyttats är en förfrågan igen, men att avböja
       det är att avboka det, och det nekar databasen (Fas 14.1). Passar
       ingen tid är det Nextrum som betalar tillbaka — passets sida
       säger det. */
    const betalt = b.betalning_status === 'betald' || b.betalning_status === 'tvist';
    return '<button type="button" class="btn btn-primary' + s + '" data-passvar="confirmed" data-id="' + esc(b.id) + '">Passar bra</button>'
         + (betalt ? '' : '<button type="button" class="btn btn-ghost' + s + '" data-passvar="cancelled" data-id="' + esc(b.id) + '">Avböj</button>');
  }

  /* En föreslagen tid är den enda raden i vyn som VÄNTAR på familjen:
     den står kvar i studiehjälparens kalender tills någon svarat.
     Därför ligger den överst på Översikt och inte bara i passlistan
     en sektion bort.

     Raderna byggs av samma NXKontakt.passRad med samma
     data-passvar-knappar som passlistan, så den delegerade hanteraren
     tar båda uppsättningarna och svarar man här ritas listan om på
     köpet — ingen andra logik som kan hamna ur synk med den första. */
  function ritaÖvBekrafta() {
    const box = $('#ov-bekrafta-box');
    const host = $('#ov-bekrafta');
    if (!box || !host) return;

    const nyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');
    const föreslagna = (S.bokningar || [])
      .filter(b => b.status === 'requested' && b.created_by && b.created_by !== S.user.id)
      .sort((a, c) => nyckel(a).localeCompare(nyckel(c)));

    /* Dold, inte tom: en ruta som står kvar och säger "inget att
       svara på" tar plats överst varje gång man öppnar vyn. */
    box.hidden = !föreslagna.length;
    if (!föreslagna.length) {
      host.innerHTML = '';
      $('#ov-bekrafta-antal').textContent = '';
      return;
    }

    $('#ov-bekrafta-antal').textContent = föreslagna.length + ' st';
    host.innerHTML = föreslagna.map(b => {
      const barn = S.barn.find(x => x.id === b.student_id);
      const under = [b.format, b.location, barn ? barn.name : null].filter(Boolean).join(' · ');
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        under: under + (b.note ? (under ? ' · ' : '') + '”' + String(b.note).slice(0, 60) + (String(b.note).length > 60 ? '…' : '') + '”' : ''),
        vem: 'Föreslaget av er studiehjälpare',
        atgarder: svarsKnappar(b, true)
      });
    }).join('');
  }

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
     vyn hade inte erbjudit någon betalning. */
  function kanBetalas(b) {
    if (b.fakturerbar === false) return false;
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
    const { data } = await supa.from('flaggor').select('aktiv').eq('kod', 'kortsparr').maybeSingle();
    S.kortsparr = !!(data && data.aktiv);
  }
  function betalaKnapp(b, liten) {
    return '<button type="button" class="btn btn-primary' + (liten ? ' btn-sm' : '') + '" data-betala="' + esc(b.id) + '">'
      + (b.betalning_status === 'misslyckad' ? 'Försök betala igen' : 'Betala med kort') + '</button>';
  }
  const BETALNING_TEXT = {
    ingen: 'Inte betalt än',
    vantar: 'Betalningen är påbörjad',
    betald: 'Betalt',
    misslyckad: 'Betalningen gick inte igenom',
    aterbetald: 'Återbetalt',
    tvist: 'Betalningen är ifrågasatt'
  };

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
  async function startaBetalning(passId, ui) {
    const svar = await supa.functions.invoke('stripe-checkout', {
      body: { pass: passId, retur: location.origin, ui: ui }
    });
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
      checkout: null, knapp: null, pass: null, klar: false
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

  async function öppnaKassa(knapp, passId, svar, Stripe) {
    const p = betalpanel();
    // Stripe tillåter en inbäddad kassa åt gången.
    if (p.checkout) { try { p.checkout.destroy(); } catch (_) { /* redan borta */ } p.checkout = null; }
    p.knapp = knapp; p.pass = passId; p.klar = false;
    p.vad.textContent = passBeskrivning(passId);
    p.besked.hidden = true;
    p.kassa.textContent = '';

    const stripe = Stripe(svar.nyckel);
    if (typeof stripe.initEmbeddedCheckout !== 'function') throw new Error('Stripe.js saknar initEmbeddedCheckout');
    const checkout = await stripe.initEmbeddedCheckout({
      fetchClientSecret: () => Promise.resolve(svar.client_secret),
      onComplete: () => betalningKlar(passId)
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
    const knapp = p.knapp && p.knapp.isConnected ? p.knapp
      : (p.pass ? document.querySelector('[data-betala="' + CSS.escape(p.pass) + '"]') : null);
    NXStudie.håll(knapp, () => {
      document.body.classList.remove('betalar');
      p.rot.classList.remove('open');
    });
    if (knapp) knapp.focus();
    /* Betald under tiden panelen var öppen: listorna ska visa det.
       Omritningen byter ut knappen, så fokus flyttas till den nya om
       passet fortfarande har en (webhooken har inte hunnit). */
    if (p.klar) {
      const passId = p.pass;
      laddaPass().then(() => {
        const ny = document.querySelector('[data-betala="' + CSS.escape(passId) + '"]');
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
    p.besked.textContent = '✓ Tack! Betalningen är mottagen. Det kan ta en liten stund innan passet står som betalt.';
    p.besked.hidden = false;
    setTimeout(() => { laddaPass().catch(() => {}); }, 2500);
    setTimeout(() => { laddaPass().catch(() => {}); }, 8000);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && panel.rot.classList.contains('open')) stängBetalpanel();
  });

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
    const passId = p.pass;
    stängBetalpanel();
    const reserv = await startaBetalning(passId, 'sida');
    if (reserv && reserv.url) location.href = reserv.url;
  });

  /* ============ pass ============ */
  async function laddaPass() {
    const host = $('#pass-lista');
    const { data, error } = await supa
      .from('bookings').select('id, subject, format, location, note, wanted_date, wanted_time, duration_min, antal_barn, tjanst, status, student_id, created_by, created_at, avbokningsskal, betalning_status, betald_at, fakturerbar, betalt_ore, aterbetald_ore')
      .eq('parent_id', S.user.id).order('wanted_date', { ascending: true });

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
    S.laddatPass = true;
    ritaNotiser();
    ritaÖvBekrafta();
    ritaNästaPass();
    ritaStatistik();
    byggSchema();
    ritaAttBetala();
    ritaBetalda();
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
      rad: b => {
      const barn = S.barn.find(x => x.id === b.student_id);
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
      if (derasFörslag && b.status === 'requested') {
        knappar = svarsKnappar(b, true);
      } else if (kanBetalas(b)) {
        /* Betalningen hör till BEKRÄFTADE pass, inte till förfrågningar
           (Fas 12.2). Ett pass som studiehjälparen ännu inte tackat ja
           till kan avböjas, och då hade varje förfrågan blivit en
           återbetalning: en kortavgift vi inte får tillbaka, och en
           familj som undrar vad som hände. Ett genomfört pass som inte
           är betalt får knappen också (Fas 14.2): utan månadsfakturan
           finns ingen annan väg att betala det. */
        knappar = betalaKnapp(b, true);
      }

      /* Platsen står direkt på raden. Ett pass på plats är en resa —
         var man ska vara är halva beskedet. */
      const under = [b.format, b.location, barn ? barn.name : null].filter(Boolean).join(' · ');
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        under: under,
        vem: derasFörslag && b.status === 'requested' ? 'Föreslaget av er studiehjälpare'
          : b.status === 'requested' ? 'Väntar på svar från er studiehjälpare' : null,
        märke: NXKontakt.betalMärke(b),
        atgarder: knappar
      });
      }
    });
  }

  document.addEventListener('click', async e => {
    /* data-passvar, inte data-svar: data-svar är bekräfta-rutans egna
       knappar (NXStudie.bekräfta). Med samma namn tolkades varje klick
       i en bekräfta-ruta här i studievyn — "Ta bort" på ett barn, till
       exempel — som ett svar på ett pass, och det slutade med
       "Kunde inte svara". */
    const svar = e.target.closest('[data-passvar]');
    if (svar) {
      if (svar.dataset.passvar === 'cancelled') {
        const nej = await NXStudie.bekräfta({
          titel: 'Avböj tiden?',
          text: 'Er studiehjälpare ser att tiden inte passade. Skriv gärna i chatten vilka tider som fungerar.',
          knapp: 'Avböj'
        });
        if (!nej) return;
      }
      svar.setAttribute('aria-busy', 'true');
      const { error } = await supa.from('bookings').update({ status: svar.dataset.passvar }).eq('id', svar.dataset.id);
      svar.removeAttribute('aria-busy');
      if (error) { alert('Kunde inte svara: ' + felText(error)); return; }
      await Promise.all([laddaPass(), laddaBokning()]);
      return;
    }

    /* Betalningen (Fas 12.2). Knappen skickar BARA passets id. Priset,
       rabatten och studiehjälparens del räknas ut på servern, ur
       databasen — samma skäl som att invoices och payouts med flit
       saknar INSERT-policy för användare: kan ingen skicka in ett
       belopp kan ingen skicka in fel belopp. */
    const bet = e.target.closest('[data-betala]');
    if (bet) {
      const passId = bet.dataset.betala;
      await medan(bet, 'Öppnar…', async () => {
        // Stripe.js hämtas medan sessionen skapas, inte efter.
        const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
        const svar = await startaBetalning(passId, 'inbaddad');
        if (!svar) return;
        if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
          const Stripe = await stripeKlar;
          if (Stripe) {
            try { await öppnaKassa(bet, passId, svar, Stripe); return; }
            catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
          }
          // Reserven: Stripes egen sida, som före Fas 14.5.
          const reserv = await startaBetalning(passId, 'sida');
          if (reserv && reserv.url) { location.href = reserv.url; return; }
          if (!reserv) return;
        } else if (svar.url) {
          location.href = svar.url;
          return;
        }
        alert('Betalningen kunde inte öppnas. Försök igen, eller hör av dig till oss.');
      });
      return;
    }

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
    const skäl = await NXStudie.avbokaRuta(förslag ? {
      titel: 'Dra tillbaka förslaget?',
      text: 'Vill ni hellre ha en annan tid, välj Ändra tiden i stället.',
      knapp: 'Dra tillbaka',
      avbryt: 'Behåll förslaget',
      not: 'Er studiehjälpare får ett mejl om att förslaget är tillbakadraget och varför.'
    } : {
      titel: 'Avboka passet?',
      text: 'Vill ni hellre byta tid, välj Föreslå ny tid i stället — då ligger passet kvar tills er studiehjälpare svarat.',
      not: 'Er studiehjälpare får ett mejl om att passet är avbokat och varför.'
    });
    if (!skäl) return;
    btn.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ status: 'cancelled', avbokningsskal: skäl })
      .eq('id', btn.dataset.avboka);
    btn.removeAttribute('aria-busy');
    if (error) { alert('Kunde inte avboka: ' + felText(error)); return; }
    await Promise.all([laddaPass(), laddaBokning()]);
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
      b.status === 'requested' && b.created_by && b.created_by !== S.user.id);
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
        mål: '#ov-bekrafta'
      });
    }

    /* Pass att betala (Fas 14.2). Familjen betalar före passet, så det
       här är lika mycket deras tur som en föreslagen tid — och ett pass
       som ingen påmint om är ett pass som ingen betalar. */
    const attBetalaNu = (S.bokningar || []).filter(kanBetalas);
    if (attBetalaNu.length) {
      poster.push({
        rubrik: attBetalaNu.length === 1 ? 'Ett pass att betala' : attBetalaNu.length + ' pass att betala',
        text: 'Betala senast innan passet börjar. Ett pass som inte är betalt hålls inte.',
        mål: '#bet-att-betala'
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
        rubrik: brådskande.length + ' läx' + (brådskande.length > 1 ? 'or' : 'a') + ' att göra',
        text: sena ? sena + ' av dem skulle redan ha varit klara.' : 'Ska vara klar idag.',
        mål: '#lax-lista'
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
      }).select('id, status').single();
      if (error) {
        /* 23505 = samma starttid, 23P01 = passet krockar med ett annat
           som redan ligger där. Samma sak för den som föreslår. */
        if (error.code === '23505' || error.code === '23P01') {
          return 'Den tiden hann bli bokad, eller krockar med ett annat pass. Kalendern är uppdaterad — välj en annan tid.';
        }
        return 'Kunde inte skicka förslaget: ' + felText(error);
      }
      /* Listan laddas om bakom kvittot, inte före det. Den som trycker
         på Föreslå tiden ska få svaret när databasen gett det. */
      laddaPass();
      return { status: data ? data.status : null, id: data ? data.id : null };
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
    if (S.sido) S.sido.märke('uppgifter', öppna.length);
    const mark = $('#flik-lax-mark');
    if (mark) { mark.hidden = !öppna.length; mark.textContent = öppna.length || ''; }
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
     BETALNING (Fas 14.2)
     Familjen betalar varje pass med kort, när studiehjälparen
     bekräftat tiden och senast innan passet börjar. Månadsfakturan
     finns inte längre ("bara kort", Leo 2026-09-24), och därför inget
     att vänta på här: en lista över det som ska betalas och en över
     det som är betalt, båda ritade ur passen. Fakturahistoriken som
     stod här är borta: det skickades aldrig en enda faktura.

     Ingenting här skriver till databasen. Beloppet räknas av
     stripe-checkout ur databasen, och kortuppgifterna tas emot av
     Stripe på deras egen sida. Vi lagrar aldrig ett kortnummer, och
     kan därför inte tappa bort ett.
     ============================================================ */

  /* Pass som väntar på betalning. Ur samma S.bokningar som Mina
     lektioner, så att ett pass som betalas på passets sida försvinner
     här utan en egen hämtning. Knappen går rakt till Stripes kassa —
     samma data-betala som överallt. */
  function ritaAttBetala() {
    const host = $('#bet-att-betala');
    if (!host) return;
    const nyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');
    const att = (S.bokningar || []).filter(kanBetalas).sort((a, c) => nyckel(a).localeCompare(nyckel(c)));
    $('#bet-att-antal').textContent = att.length ? att.length + ' st' : '';
    /* Siffran i menyn ska betyda "något väntar på er", inte "här
       finns saker". Bara det som ska betalas räknas. */
    if (S.sido) S.sido.märke('betalning', att.length);
    if (!att.length) {
      host.innerHTML = tomt('Inget att betala just nu',
        'När er studiehjälpare bekräftat ett pass står det här, och ni betalar det med kort.');
      return;
    }
    host.innerHTML = att.map(b => {
      const barn = S.barn.find(x => x.id === b.student_id);
      const pris = passetsPris(b);
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        under: [pris ? NXBetalning.kronor(pris) : null, barn ? barn.name : null,
          b.betalning_status === 'misslyckad' ? 'Förra försöket gick inte igenom' : null].filter(Boolean).join(' · '),
        vem: b.status === 'completed' ? 'Passet har hållits men är inte betalt.'
          : b.betalning_status === 'vantar' ? 'Betalningen är påbörjad men inte klar.'
          : b.wanted_date < isoFor(new Date()) ? 'Passet har varit men är inte betalt. Hölls det, betala det här.'
          : 'Betala senast innan passet börjar.',
        märke: NXKontakt.betalMärke(b),
        atgarder: betalaKnapp(b, true)
      });
    }).join('');
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
    $('#bet-antal').textContent = betalda.length ? betalda.length + ' st' : '';
    lista.innerHTML = betalda.length
      ? betalda.map(b => {
          const barn = S.barn.find(x => x.id === b.student_id);
          const betalt = Number(b.betalt_ore || 0), tillbaka = Number(b.aterbetald_ore || 0);
          return NXKontakt.passRad(b, {
            href: '#pass/' + b.id,
            under: [betalt ? kronor(betalt) : null, 'betalt ' + datumText(isoFor(new Date(b.betald_at))),
              barn ? barn.name : null].filter(Boolean).join(' · '),
            vem: !tillbaka ? null
              : tillbaka >= betalt ? 'Hela beloppet är återbetalt.'
              : kronor(tillbaka) + ' är återbetalt.',
            märke: NXKontakt.betalMärke(b)
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
    const svar = q.has('betalt') ? 'betalt' : q.get('betalning') === 'avbruten' ? 'avbruten' : null;
    if (svar && window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + '#betalning');
    }
    return svar;
  }

  function visaBetalsvar(svar) {
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
     sitter", inte exakt var varje område ligger — det står under Min
     utveckling. */
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

    tal.innerHTML = '<div class="stat-tal stat-tal-5">'
      + '<div><b>' + genomforda.length + '</b><span>Genomförda pass</span></div>'
      + '<div><b>' + esc(timmar) + '</b><span>Studietid</span></div>'
      + '<div><b>' + (S.kommandeAntal || 0) + '</b><span>Kommande pass</span></div>'
      + '<div><b>' + klara + '</b><span>Avklarade läxor</span></div>'
      + '<div><b>' + (S.progressAntal || 0) + '</b><span>Kunskapsområden</span></div>'
      + '</div>';

    ritaFordelningar();

    /* Alltid sex staplar, även när några är tomma. Ritandet ligger i
       NXArbete sedan Fas 9.3 — samma kod låg i tre vyer. */
    const månader = NXArbete.sexMånader();
    genomforda.forEach(b => {
      const m = månader.find(x => x.nyckel === String(b.wanted_date || '').slice(0, 7));
      if (m) m.antal++;
    });

    NXArbete.graf(graf, månader, {
      nagot: 'Bara genomförda pass räknas. Ett pass blir genomfört när er studiehjälpare skrivit rapporten.',
      inget: 'Inga genomförda pass än — grafen fylls i efter första passet.'
    });
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
  const SEKTIONSNAMN = { oversikt: 'Översikt', lektioner: 'Mina lektioner', betalning: 'Betalning', boka: 'Boka pass' };
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
      .select('gick, needs_practice, next_focus, ai_feedback, raw_notes')
      .eq('booking_id', id).maybeSingle();
    rapportFör[id] = data || null;
    return rapportFör[id];
  }

  function passetsPris(b) {
    const tj = NXTjanster.hitta(b.tjanst || NXTjanster.standard());
    if (!tj || !tj.pris_per_timme_ore) return null;
    const perTimme = Number(tj.pris_per_timme_ore)
      + ((b.antal_barn || 1) > 1 ? Number(tj.extra_personer_ore || 0) : 0);
    return Math.round(perTimme * (b.duration_min || 60) / 60);
  }

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
    const skriv = '<a class="btn btn-ghost" href="#meddelanden">Skriv till ' + esc(förnamn) + '</a>';

    /* Vägen passet går. Ett avbokat pass har ingen väg kvar — där
       står beskedet i stället. */
    const steg = b.status === 'cancelled' ? [] : [
      { namn: derasFörslag ? 'Föreslaget av ' + förnamn : 'Föreslaget av er', klar: true },
      { namn: 'Bekräftat', klar: b.status === 'confirmed' || b.status === 'completed', nu: b.status === 'requested' },
      { namn: 'Genomfört', klar: b.status === 'completed', nu: b.status === 'confirmed' },
      { namn: 'Rapport', klar: b.status === 'completed', nu: false }
    ];

    /* Betalt eller bestritt: pengarna ligger hos Nextrum, och databasen
       nekar en avbokning härifrån (Fas 14.1). Att avböja eller dra
       tillbaka en flyttad tid är också en avbokning. Knapparna visas
       därför inte på ett betalt pass — ett nej efter ett klick är sämre
       än en mening som säger vart man vänder sig. */
    const betalt = b.betalning_status === 'betald' || b.betalning_status === 'tvist';
    const viaOss = ' Passet är redan betalt. Ska det avbokas, hör av er till oss så betalar vi tillbaka.';

    let besked = null, atgarder = '';
    if (b.status === 'cancelled') {
      const skäl = NXStudie.skälText(b.avbokningsskal);
      besked = { text: 'Passet är avbokat' + (skäl ? ' — ' + skäl.toLowerCase() + '.' : '.'), ton: 'lugn' };
      atgarder = '<a class="btn btn-primary" href="#boka">Föreslå en ny tid</a>' + skriv;
    } else if (b.status === 'requested' && derasFörslag && framåt) {
      besked = { text: förnamn + ' föreslår den här tiden. Passar den? '
        + (betalt ? 'Passar den inte kan ni föreslå en annan.' + viaOss : 'Svarar ni nej kan ni föreslå en annan.'), ton: 'fraga' };
      atgarder = svarsKnappar(b, false)
        + '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Föreslå annan tid</button>';
    } else if (b.status === 'requested' && framåt) {
      besked = { text: 'Väntar på att ' + förnamn + ' accepterar tiden. Ni får ett mejl när hen svarat.' + (betalt ? viaOss : ''), ton: 'vantar' };
      atgarder = '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Ändra tiden</button>'
        + (betalt ? '' : '<button type="button" class="btn btn-ghost" data-avboka="' + esc(b.id) + '" data-forslag="1">Dra tillbaka förslaget</button>')
        + skriv;
    } else if (b.status === 'confirmed' && framåt) {
      /* Återbetald är hela beloppet tillbaka på ett pass som står
         kvar. Det är ett beslut någon hos oss tagit, och vyn gissar
         inte vilket — "betala med kort" utan en knapp hade varit en
         uppmaning som inte går att följa. */
      besked = betalt
        ? { text: 'Passet är bokat och betalt. ' + förnamn + ' ses med ' + (barn ? barn.name.split(' ')[0] : 'er') + ' ' + NXStudie.relativDag(b.wanted_date) + '. Ska det avbokas, hör av er till oss så betalar vi tillbaka.', ton: 'klart' }
        : b.fakturerbar === false
        ? { text: 'Passet är bokat.', ton: 'klart' }
        : b.betalning_status === 'aterbetald'
        ? { text: 'Passet är bokat, och det ni betalade för det är återbetalt. Undrar ni varför, hör av er till oss.', ton: 'lugn' }
        : { text: 'Passet är bokat. Betala med kort senast innan passet börjar, annars hålls det inte.', ton: 'fraga' };
      atgarder = (kanBetalas(b) ? betalaKnapp(b, false) : '')
        + '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Föreslå ny tid</button>'
        + (betalt ? '' : '<button type="button" class="btn btn-ghost" data-avboka="' + esc(b.id) + '">Avboka</button>');
    } else if (b.status === 'confirmed' && kanBetalas(b)) {
      /* Passerat och obetalt medan spärren är på — bara då släpper
         kanBetalas igenom det. Hölls passet kan rapporten inte skrivas
         förrän det är betalt, så betalningen är det som låser upp den.
         Hölls det inte är det studiehjälparen som avbokar. */
      besked = { text: 'Passet har varit men är inte betalt. Hölls det, betala det med kort, så kan ' + förnamn
        + ' skriva rapporten. Hölls det inte, avbokar ' + förnamn + ' det.', ton: 'fraga' };
      atgarder = betalaKnapp(b, false) + skriv;
    } else if (b.status === 'completed' && kanBetalas(b)) {
      /* Genomfört men inte betalt. Det kan bara hända medan spärren är
         av (Fas 14.2), och då ska det gå att betala i efterhand. */
      besked = { text: 'Passet är genomfört men inte betalt. Betala det med kort.', ton: 'fraga' };
      atgarder = betalaKnapp(b, false) + skriv;
    } else if (b.status === 'completed') {
      besked = { text: 'Passet är genomfört.', ton: 'klart' };
      atgarder = '<a class="btn btn-primary" href="#boka">Boka nästa pass</a>' + skriv;
    } else {
      /* Tiden har passerat men passet är varken genomfört eller
         avbokat: rapporten saknas, eller ett förslag blev aldrig
         besvarat. Inget att trycka på här — det är studiehjälparens
         drag. */
      besked = { text: b.status === 'requested'
        ? 'Tiden har passerat utan att förslaget besvarades.'
        : 'Passet har varit. Det står som genomfört när ' + förnamn + ' skrivit rapporten.', ton: 'lugn' };
      atgarder = skriv;
    }

    const kort = [
      { rubrik: 'När', rader: [
        ['Dag', NXStudie.dagMedVeckodag(b.wanted_date)],
        ['Tid', NXStudie.tidsspann(b.wanted_time, b.duration_min)],
        ['Längd', timmar === 1 ? '1 timme' : timmar + ' timmar']
      ] },
      { rubrik: 'Var', rader: [
        ['Hur', b.format || 'Inte angivet'],
        ['Plats', b.location || (b.format === 'Online' ? 'Länken kommer i meddelanden' : 'Inte angiven — skriv till ' + förnamn)]
      ] },
      { rubrik: 'Vem', rader: [
        ['Elev', barn ? barn.name : null],
        ['Antal barn', (b.antal_barn || 1) > 1 ? String(b.antal_barn) : null],
        ['Studiehjälpare', hjälpare]
      ] },
      { rubrik: 'Pris', rader: [
        ['Pris', pris ? NXBetalning.kronor(pris) : null],
        /* Passets eget betalläge. Sedan Fas 14.2 finns ingen faktura
           att hänvisa till: ett genomfört pass som inte är betalt är
           just det, och ska betalas på den här sidan. */
        ['Betalning', b.fakturerbar === false ? 'Betalas inte'
          : b.status === 'requested' ? 'Betalas när passet är bekräftat'
          : b.status === 'cancelled' ? (b.betalning_status && b.betalning_status !== 'ingen'
              ? BETALNING_TEXT[b.betalning_status] : null)
          : (BETALNING_TEXT[b.betalning_status || 'ingen'] || null)]
      ] }
    ];

    const läxor = (S.laxor || [])
      .filter(h => h.status !== 'klar' && h.student_id === b.student_id && h.due_date && h.due_date >= b.wanted_date)
      .slice(0, 3);

    const block = [
      { rubrik: 'Anteckning', html: b.note ? '<p>' + esc(b.note) + '</p>' : '' },
      { rubrik: 'Läxor fram till passet', html: läxor.length
        ? läxor.map(h => '<a class="pass-lank" href="#uppgifter">' + esc(h.title)
            + '<span>Till ' + esc(NXStudie.deadlineText(h.due_date)) + '</span></a>').join('') : '' }
    ];

    const rita = (rapport) => NXStudie.passSida({
      host,
      tillbaka,
      titel: (b.subject || 'Pass') + (barn ? ' · ' + barn.name.split(' ')[0] : ''),
      nar: NXStudie.dagMedVeckodag(b.wanted_date) + (b.wanted_time ? ', ' + NXStudie.tidsspann(b.wanted_time, b.duration_min) : ''),
      relativ: b.status === 'cancelled' ? null : NXStudie.relativDag(b.wanted_date),
      lage: l,
      steg,
      besked,
      atgarder,
      kort,
      block: block.concat(rapport ? [{ rubrik: 'Efter passet', html:
        (rapport.gick ? '<p><b>' + esc(NXStudie.GICK[rapport.gick] || rapport.gick) + '</b></p>' : '')
        + ((rapport.ai_feedback || rapport.raw_notes) ? '<p>' + esc(rapport.ai_feedback || rapport.raw_notes) + '</p>' : '')
        + (rapport.needs_practice ? '<p><b>Öva mer på:</b> ' + esc(rapport.needs_practice) + '</p>' : '')
        + (rapport.next_focus ? '<p><b>Nästa gång:</b> ' + esc(rapport.next_focus) + '</p>' : '')
      }] : [])
    });

    rita(rapportFör[b.id] || null);
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

     "Första timmen gratis" står INTE här, med flit. Kampanjen finns
     inte i prislogiken: kortbetalningen
     drar av någon timme. Att lova den på sidan som visar priset hade
     gjort den till ett villkor vi sedan tar betalt i strid mot. Den
     läggs till här i samma ändring som den byggs in i prisräkningen. */
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
    if (!S.user) { visa('view-auth'); ritaAuth(); return; }

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
      uppgifter: NXArbete.flikar($('section[data-sek="uppgifter"]')),
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
         hör nu till läxan det gäller, så den gamla adressen landar
         på läxorna i stället för på ingenting. */
      material: ['uppgifter', null],
      laxor: ['uppgifter', null],
      studiehjalpare: ['meddelanden', null],
      installningar: ['profil', 'pris']
    };
    function följHash() {
      const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
      const alias = ALIAS[huvud];
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
      msg: $('#notisval-msg')
    });

    /* Barnen först: nästan allt nedan gäller det valda barnet. Studie-
       hjälparens kort — med en signerad profilbild, två frågor i rad —
       får inte hålla passen och läxorna i kö; chatten startar när
       namnet finns. */
    await Promise.all([laddaBarn(), laddaSparr()]);
    await Promise.all([laddaTutor().then(startaTråd), laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaPass(), laddaBokning()]);
    /* Läxorna hämtas först, så märket ritas om när de finns. */
    ritaÖvLaxor();
    ritaNotiser();
    await ritaÖvSamtal();
    visaBetalsvar(betalsvar);
    supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
