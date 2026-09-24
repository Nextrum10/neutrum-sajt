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

  const S = { user: null, profil: null, tutor: null, barn: [], valtBarn: null, kal: null, bokningar: [], trad: null, minAvatar: null, laxor: [], laxFilter: 'attgora', rapporter: [], progress: [], olästaAntal: 0, plan: null, sido: null, progressAntal: 0, schema: null, tillgangFinns: false };

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

    host.innerHTML = laddar();
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
    $('#prg-antal').textContent = '';
    ['#ut-tal', '#ut-amnen', '#ut-graf', '#ut-framsteg'].forEach(id => { const e = $(id); if (e) e.innerHTML = ''; });
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }

    host.innerHTML = laddar();
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

    const andel = Math.round(säkra / p.length * 100);
    const omkrets = 2 * Math.PI * 26;
    const ring = '<div class="ut-ring" role="img" aria-label="' + säkra + ' av ' + p.length
      + ' områden är på Säker eller bättre">'
      + '<svg viewBox="0 0 60 60" aria-hidden="true">'
      + '<circle class="ut-ring-bas" cx="30" cy="30" r="26"></circle>'
      + '<circle class="ut-ring-fyll" cx="30" cy="30" r="26" stroke-dasharray="'
      + (omkrets * säkra / p.length).toFixed(1) + ' ' + omkrets.toFixed(1) + '"></circle>'
      + '</svg><span class="ut-ring-tal"><b>' + andel + '<i>%</i></b></span></div>';

    $('#ut-tal').innerHTML = '<div class="ut-sammanfattning">' + ring
      + '<div class="ut-sammanfattning-text">'
      + '<b>' + säkra + ' av ' + p.length + ' områden sitter säkert</b>'
      + '<span>Säker betyder att ' + esc(namnPåBarnet()) + ' klarar det på egen hand. '
      + 'Nivåerna sätts av er studiehjälpare efter passen.</span>'
      + '</div></div>'
      + '<div class="stat-tal stat-tal-5" style="margin-top:16px">'
      + '<div><b>' + rapporterade + '</b><span>Rapporterade pass</span></div>'
      + '<div><b>' + p.length + '</b><span>Kunskapsområden</span></div>'
      + '<div><b>' + gickUpp + '</b><span>Gått upp senaste månaden</span></div>'
      + '<div><b>' + säkra + '</b><span>Säker eller bättre</span></div>'
      + '<div><b>' + (medMål.length ? nådda + '<i style="font-style:normal;font-size:.6em;color:var(--bl-2)"> / '
          + medMål.length + '</i>' : '—') + '</b><span>Mål nådda</span></div>'
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
    host.innerHTML = '<div class="graf">' + punkter.map((x, i) =>
      '<div class="graf-stapel' + (i === punkter.length - 1 ? ' nu' : '') + '"'
      + (x.snitt ? ' title="' + esc(x.antal + (x.antal === 1 ? ' område' : ' områden')) + '"' : '') + '>'
      + '<b>' + (x.snitt ? esc(x.snitt.toFixed(1).replace('.', ',')) : '–') + '</b>'
      + '<i style="height:' + (x.snitt ? Math.round(x.snitt / 5 * 100) : 0) + '%"></i>'
      + '<span>' + esc(x.namn) + '</span></div>').join('') + '</div>'
      + '<p class="graf-not">1 är Nytt och 5 är Behärskar. En tom månad betyder att inget var bedömt då, inte att det gick bakåt.</p>';
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
    host.innerHTML = '<div class="loading">Hämtar</div>';
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

    host.innerHTML = '<div class="loading">Hämtar</div>';
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
    return '<button type="button" class="btn btn-primary' + s + '" data-passvar="confirmed" data-id="' + esc(b.id) + '">Passar bra</button>'
         + '<button type="button" class="btn btn-ghost' + s + '" data-passvar="cancelled" data-id="' + esc(b.id) + '">Avböj</button>';
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
        under: under,
        vem: 'Föreslaget av er studiehjälpare',
        atgarder: svarsKnappar(b, true)
      }) + (b.note ? '<p class="xsmall" style="margin:-6px 0 12px 82px;color:var(--muted)">' + esc(b.note) + '</p>' : '');
    }).join('');
  }

  /* ============ pass ============ */
  async function laddaPass() {
    const host = $('#pass-lista');
    const { data, error } = await supa
      .from('bookings').select('id, subject, format, location, note, wanted_date, wanted_time, duration_min, status, student_id, created_by, betalning_status, fakturerbar, betalt_ore, aterbetald_ore, betald_at')
      .eq('parent_id', S.user.id).order('wanted_date', { ascending: true });

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
    /* Betalningen ritas ur samma rader, så att en avbokning eller en
       ny bekräftelse syns under Betalning utan en egen hämtning. */
    ritaBetalning();
    ritaNotiser();
    ritaÖvBekrafta();
    ritaNästaPass();
    ritaStatistik();
    byggSchema();
    if (!S.bokningar.length) { host.innerHTML = tomt('Inga bokade pass än', 'Boka en tid under Boka pass, så står passet här.'); return; }

    /* Lokalt datum, inte UTC: mellan midnatt och klockan två i
       Sverige är UTC-datumet fortfarande gårdagen. */
    const idag = isoFor(new Date());
    const aktiva = S.bokningar.filter(b => b.status !== 'cancelled');
    $('#pass-antal').textContent = aktiva.length + ' st';

    NXStudie.passLista({
      host: host,
      bokningar: S.bokningar,
      tomtKommande: 'Inga kommande pass. Boka en tid under Boka pass, så står passet här.',
      rad: b => {
      const barn = S.barn.find(x => x.id === b.student_id);
      const kommande = b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed');
      /* Ett förslag från studiehjälparen ser likadant ut i databasen
         som en egen bokning — created_by är det enda som skiljer, och
         det avgör om raden ska ha "Bekräfta" eller "Avboka". */
      const derasFörslag = b.created_by && b.created_by !== S.user.id;

      /* Betalt eller bestritt: pengarna ligger hos Nextrum, och
         databasen nekar en avbokning härifrån (Fas 13.1). Knappen
         visas därför inte — ett nej efter ett klick är sämre än en
         mening som säger vart man vänder sig. */
      const betalt = b.betalning_status === 'betald' || b.betalning_status === 'tvist';

      let knappar = '';
      if (derasFörslag && b.status === 'requested') {
        knappar = svarsKnappar(b, true);
      } else if (kommande) {
        /* Betalningen hör till BEKRÄFTADE pass, inte till förfrågningar
           (Fas 12.2). Ett pass som studiehjälparen ännu inte tackat ja
           till kan avböjas, och då hade varje förfrågan blivit en
           återbetalning: en kortavgift vi inte får tillbaka, och en
           familj som undrar vad som hände. */
        if (attBetala(b)) knappar = betalaKnapp(b);
        knappar += '<button class="btn btn-ghost btn-sm" data-flytta="' + b.id + '">Flytta</button>';
        if (!betalt) knappar += '<button class="btn btn-ghost btn-sm" data-avboka="' + b.id + '">Avboka</button>';
      } else if (attBetala(b)) {
        /* Ett genomfört pass som ingen betalat. Det kan bara hända
           medan spärren är av, och då ska det gå att betala i
           efterhand — utan månadsfakturan finns ingen annan väg. */
        knappar = betalaKnapp(b);
      }

      /* Platsen står direkt på raden. Ett pass på plats är en resa —
         var man ska vara är halva beskedet. */
      const under = [b.format, b.location, barn ? barn.name : null].filter(Boolean).join(' · ');
      return NXKontakt.passRad(b, {
        under: under,
        vem: kommande && betalt ? 'Betalt. Ska passet avbokas, hör av er till Nextrum.'
          : derasFörslag ? 'Föreslaget av er studiehjälpare' : null,
        märke: NXKontakt.betalMärke(b),
        atgarder: knappar
      }) + (b.note ? '<p class="xsmall" style="margin:-6px 0 12px 82px;color:var(--muted)">' + esc(b.note) + '</p>' : '');
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
      await laddaPass();
      await laddaBokning();
      return;
    }

    /* Betalningen (Fas 12.2). Knappen skickar BARA passets id. Priset,
       rabatten och studiehjälparens del räknas ut på servern, ur
       databasen — samma skäl som att invoices och payouts med flit
       saknar INSERT-policy för användare: kan ingen skicka in ett
       belopp kan ingen skicka in fel belopp. */
    const bet = e.target.closest('[data-betala]');
    if (bet) {
      await medan(bet, 'Öppnar…', async () => {
        const svar = await supa.functions.invoke('stripe-checkout', {
          body: { pass: bet.dataset.betala, retur: location.origin }
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
          return;
        }
        if (svar.data && svar.data.url) { location.href = svar.data.url; return; }
        alert('Betalningen kunde inte öppnas. Försök igen, eller hör av dig till oss.');
      });
      return;
    }

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
    const skäl = await NXStudie.avbokaRuta({
      titel: 'Avboka passet?',
      text: 'Vill ni hellre byta tid, välj Flytta i stället — då ligger passet kvar tills er studiehjälpare svarat.',
      not: 'Er studiehjälpare får ett mejl om att passet är avbokat och varför.'
    });
    if (!skäl) return;
    btn.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ status: 'cancelled', avbokningsskal: skäl })
      .eq('id', btn.dataset.avboka);
    btn.removeAttribute('aria-busy');
    if (error) { alert('Kunde inte avboka: ' + felText(error)); return; }
    await laddaPass();
    await laddaBokning();
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
    const attBetalaNu = (S.bokningar || []).filter(attBetala);
    if (attBetalaNu.length) {
      poster.push({
        rubrik: attBetalaNu.length === 1 ? 'Ett pass att betala' : attBetalaNu.length + ' pass att betala',
        text: 'Betala senast innan passet börjar. Ett pass som inte är betalt hålls inte.',
        mål: '#bet-att'
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
      await laddaPass();
      await laddaBokning();
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
      return {
        upptagna,
        /* Familjens vana: förra passets ämne och längd blir förval. */
        tidigare: (S.bokningar || []).filter(b => b.status !== 'cancelled')
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
        status: 'requested'
      }).select('status').single();
      if (error) {
        /* 23505 = samma starttid, 23P01 = passet krockar med ett annat
           som redan ligger där. Samma sak för den som föreslår. */
        if (error.code === '23505' || error.code === '23P01') {
          return 'Den tiden hann bli bokad, eller krockar med ett annat pass. Kalendern är uppdaterad — välj en annan tid.';
        }
        return 'Kunde inte skicka förslaget: ' + felText(error);
      }
      await laddaPass();
      return { status: data ? data.status : null };
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
          href: '#lektioner',
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
     finns inte längre, och därför inget att vänta på här: en lista
     över det som ska betalas och en över det som är betalt.

     Ingenting här skriver till databasen. Beloppet räknas av
     stripe-checkout ur databasen, och kortuppgifterna tas emot av
     Stripe på deras egen sida. Vi lagrar aldrig ett kortnummer, och
     kan därför inte tappa bort ett.
     ============================================================ */

  /* Samma tre lägen som avvikelsen ej_betalt och OBETALDA_LAGEN i
     _delad/pris.ts. 'vantar' är med: en påbörjad betalning är ingen
     betalning, och knappen ska gå att trycka på igen. */
  const OBETALDA = ['ingen', 'vantar', 'misslyckad'];
  const BETALDA = ['betald', 'tvist', 'aterbetald'];

  /* Ska betalas: bekräftat och inte passerat, eller genomfört utan
     att vara betalt. Ett bekräftat pass vars dag gått utan rapport är
     inget av dem — antingen hölls det inte, och då ska det inte
     betalas, eller så blir det snart genomfört och kommer tillbaka
     hit. Ett pass Nextrum undantagit betalas aldrig; stripe-checkout
     nekar det också. */
  function attBetala(b) {
    if (b.fakturerbar === false) return false;
    if (OBETALDA.indexOf(b.betalning_status || 'ingen') === -1) return false;
    if (b.status === 'completed') return true;
    return b.status === 'confirmed' && b.wanted_date >= isoFor(new Date());
  }

  function betalaKnapp(b) {
    return '<button class="btn btn-primary btn-sm" data-betala="' + b.id + '">'
      + (b.betalning_status === 'misslyckad' ? 'Försök betala igen' : 'Betala') + '</button>';
  }

  function ritaBetalning() {
    const att = $('#bet-att'), lista = $('#bet-lista');
    if (!att || !lista) return;
    const kronor = NXBetalning.kronor;
    const alla = S.bokningar || [];
    const barnNamn = b => { const x = (S.barn || []).find(y => y.id === b.student_id); return x ? x.name : null; };

    const obetalda = alla.filter(attBetala).sort((a, c) =>
      String(a.wanted_date + (a.wanted_time || '')).localeCompare(String(c.wanted_date + (c.wanted_time || ''))));
    $('#bet-att-antal').textContent = obetalda.length ? obetalda.length + ' st' : '';
    /* Siffran i menyn ska betyda "något väntar på er", inte "här
       finns saker". Bara det som ska betalas räknas. */
    if (S.sido) S.sido.märke('betalning', obetalda.length);

    att.innerHTML = obetalda.length
      ? obetalda.map(b => NXKontakt.passRad(b, {
          under: [(b.duration_min || 60) + ' min', b.format, barnNamn(b)].filter(Boolean).join(' · '),
          vem: b.status === 'completed' ? 'Passet har hållits men är inte betalt.'
            : b.betalning_status === 'vantar' ? 'Betalningen är påbörjad men inte klar.'
            : 'Betala senast innan passet börjar.',
          märke: NXKontakt.betalMärke(b),
          atgarder: betalaKnapp(b)
        })).join('')
      : tomt('Inget att betala just nu', 'När er studiehjälpare har bekräftat ett pass kan ni betala det här.');

    /* Det betalda, senaste betalningen först. Beloppet är det Stripe
       faktiskt drog (betalt_ore skrivs bara av webhooken), och en
       återbetalning står under, så att raden aldrig ser ut att lova
       mer än som betalats. */
    const betalda = alla.filter(b => BETALDA.indexOf(b.betalning_status) !== -1 && b.betald_at)
      .sort((a, c) => String(c.betald_at).localeCompare(String(a.betald_at)));
    $('#bet-antal').textContent = betalda.length ? betalda.length + ' st' : '';
    lista.innerHTML = betalda.length
      ? betalda.map(b => {
          const betalt = Number(b.betalt_ore || 0), tillbaka = Number(b.aterbetald_ore || 0);
          return NXKontakt.passRad(b, {
            under: [betalt ? kronor(betalt) : null, 'betalt ' + datumText(isoFor(new Date(b.betald_at))),
              barnNamn(b)].filter(Boolean).join(' · '),
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
      namn: b => {
        const barn = S.barn.find(x => x.id === b.student_id);
        return barn ? barn.name : ((S.tutor && S.tutor.full_name) || '');
      },
      onOppna: visaPass
    });
  }

  /* Knapparna bär samma data-attribut som raderna i passlistan, så de
     delegerade hanterarna tar hand om dem. Ingen andra uppsättning
     logik som kan hamna ur synk med den första. */
  function visaPass(b) {
    const barn = S.barn.find(x => x.id === b.student_id);
    const l = NXKontakt.LÄGEN[b.status] || { text: b.status };
    const idag = isoFor(new Date());
    const kommande = b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed');
    const derasFörslag = b.created_by && b.created_by !== S.user.id;

    let knappar = '';
    if (derasFörslag && b.status === 'requested') {
      knappar = svarsKnappar(b, false);
    } else if (kommande) {
      knappar = '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Flytta</button>'
              + '<button type="button" class="btn btn-ghost" data-avboka="' + esc(b.id) + '">Avboka</button>';
    }

    const laxor = (S.laxor || [])
      .filter(h => h.status !== 'klar' && h.due_date && h.due_date >= b.wanted_date)
      .slice(0, 3);

    NXStudie.passRuta({
      titel: b.subject || 'Pass',
      under: datumText(b.wanted_date) + (b.wanted_time ? ' kl. ' + b.wanted_time : ''),
      rader: [
        ['Status', l.text],
        ['Format', b.format],
        ['Plats', b.location],
        ['Elev', barn ? barn.name : null],
        ['Studiehjälpare', (S.tutor && S.tutor.full_name) || null],
        ['Bokades av', b.created_by ? (derasFörslag ? 'Er studiehjälpare' : 'Ni') : null]
      ],
      anteckning: b.note,
      laxor: laxor,
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

  /* Pris & villkor läser tjänsteraden — samma rad bokningen räknar
     på och kortbetalningen tar betalt efter. Talen i markupen syns
     bara innan katalogen laddats. Ören blir kronor i
     NXBetalning.kronor, och bara där.

     "Första timmen gratis" står INTE här, med flit. Kampanjen finns
     inte i prislogiken: kortbetalningen drar inte av någon timme. Att
     lova den på sidan som visar priset hade gjort den till ett villkor
     vi sedan tar betalt i strid mot. Den läggs till här i samma
     ändring som den byggs in i prisräkningen. */
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
    await NXTjanster.ladda();
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

    S.sido = NXStudie.sidomeny({
      fall: 'foralder',
      nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt'
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

    if (S.profil.avatar_url) S.minAvatar = await M.signera('avatarer', S.profil.avatar_url);
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

    await laddaBarn();
    await laddaTutor();
    startaTråd();
    await Promise.all([laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaPass(), laddaBokning()]);
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
