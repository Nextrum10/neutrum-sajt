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

  const S = { aktivSek: null, passFrån: null, yFör: {}, laddatPass: false, user: null, profil: null, tutor: null, barn: [], valtBarn: null, kal: null, bokningar: [], trad: null, minAvatar: null, laxor: [], rapporter: [], progress: [], olästaAntal: 0, plan: null, sido: null, progressAntal: 0, schema: null, tillgangFinns: false, underlag: {}, tillagg: {} };

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
  async function laddaLaxor() {
    const host = $('#lax-lista');
    $('#lax-antal').textContent = '';
    if (!S.valtBarn) {
      S.laxor = [];
      host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.');
      ritaÖvLaxor();
      if (passIdIAdressen()) ritaPassSida();
      return;
    }

    NXStudie.laddarFörsta(host);
    const { data, error } = await supa
      .from('homework')
      .select('id, student_id, title, instructions, subject, due_date, status, completed_at, '
        + 'bibliotek_id, biblioteksmaterial(titel, filvag, lank)')
      .eq('student_id', S.valtBarn)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) { host.innerHTML = tomt('Kunde inte hämta läxorna', felText(error)); return; }
    if (!data.length) {
      S.laxor = [];
      host.innerHTML = tomt('Inga läxor än', 'När er studiehjälpare ger en läxa dyker den upp här.');
      ritaÖvLaxor();
      if (passIdIAdressen()) ritaPassSida();
      return;
    }

    S.laxor = data;
    /* Passets sida läser S.laxor; den kan ha ritats innan läxorna kom. */
    if (passIdIAdressen()) ritaPassSida();
    ritaNotiser();
    ritaÖvLaxor();
    ritaStatistik();

    const öppna = data.filter(h => h.status !== 'klar').length;
    $('#lax-antal').textContent = öppna ? öppna + ' att göra' : 'allt klart';

    NXStudie.läxLista({ host, laxor: data, tomtAttGora: 'Inget att göra just nu. Allt ni fått är avklarat.', rad: h => {
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
    } });
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
      .from('lesson_reports').select('id, booking_id, lesson_date, raw_notes, ai_feedback, gick, amne, needs_practice, next_focus, start_tid, slut_tid, debiterade_min, avvikelse_skal')
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
      + hållenTid(r, rbPass(r))
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

  function svarsKnappar(b, små) {
    const s = små ? ' btn-sm' : '';
    /* Ett betalt pass som flyttats är en förfrågan igen, men att avböja
       det är att avboka det, och det nekar databasen (Fas 14.1). Passar
       ingen tid är det Nextrum som betalar tillbaka — passets sida
       säger det. Ett pass betalt med timmar går att avböja (Fas 21.1). */
    const betalt = pengarPå(b);
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
        .select('id, booking_id, student_id, lesson_date, amne, gick, ai_feedback, raw_notes, needs_practice, next_focus, start_tid, slut_tid, debiterade_min, avvikelse_skal')
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

  function rbRubrik(r, b) {
    const barn = S.barn.find(x => x.id === r.student_id);
    return [(b && b.subject) || r.amne || 'Pass', barn ? barn.name.split(' ')[0] : null].filter(Boolean).join(' · ');
  }

  /* Samma innehåll och ordning som "Efter passet" på passets sida. */
  function rbInnehåll(r) {
    return (r.gick ? '<p><b>' + esc(NXStudie.GICK[r.gick] || r.gick) + '</b></p>' : '')
      + ((r.ai_feedback || r.raw_notes) ? '<p>' + esc(r.ai_feedback || r.raw_notes) + '</p>' : '')
      + (r.needs_practice ? '<p><b>Öva mer på:</b> ' + esc(r.needs_practice) + '</p>' : '')
      + (r.next_focus ? '<p><b>Nästa gång:</b> ' + esc(r.next_focus) + '</p>' : '');
  }

  /* ============================================================
     DEN HÅLLNA TIDEN (Fas 20.1)

     Studiehjälparen skriver i rapporten när passet faktiskt hölls, och
     familjen betalar den tiden per påbörjad kvart (debiterade_min). Det
     familjen ser ska vara det kassan tar: därför står tiden, och varför
     den skiljer sig från det bokade, i rapporten där de bekräftar den —
     överallt där rapporten läses, i samma ord.

     Äldre rapporter har ingen tid, och då gäller det bokade. Då står
     heller ingenting här: en rad som säger "tiden saknas" hade fått en
     vanlig rapport att se ofullständig ut.

     Skälet är studiehjälparens fritext och escapas som all annan
     fritext. Det står i ett citat med vem som skrev det, så att det inte
     läses som Nextrums besked.
     ============================================================ */
  function tidLängd(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    const h = Math.floor(m / 60), rest = m % 60;
    if (!h) return rest + ' min';
    if (!rest) return h === 1 ? '1 timme' : h + ' timmar';
    return h + ' h ' + rest + ' min';
  }

  /* b är passet, om det finns: utan det går det inte att säga vad som
     bokades, och då står bara när passet hölls. */
  function hållenTid(r, b) {
    if (!r || !r.start_tid || !r.slut_tid) return '';
    const hm = t => String(t).slice(0, 5);
    const bokat = Number((b && b.duration_min) || 0);
    const deb = Number(r.debiterade_min || 0);
    const avviker = !!(bokat && deb && deb !== bokat);
    /* Fas 22.1: övertiden timbanken tog när rapporten skrevs. Den är
       betald, och står här så att familjen ser varför beloppet inte
       följer den debiterade tiden. */
    const u = b ? underlagFör(b) : null;
    const bank = u ? Number(u.timbank_min || 0) : 0;
    return '<div class="hallen-tid">'
      + '<p class="hallen-tid-rad"><b>Hölls ' + esc(hm(r.start_tid) + '–' + hm(r.slut_tid)) + '</b>'
      + (avviker ? '<span>Bokat ' + esc(tidLängd(bokat)) + ' · debiteras ' + esc(tidLängd(deb))
        + (bank ? ' · ' + esc(tidLängd(bank)) + ' ur timbanken' : '') + '</span>' : '')
      + '</p>'
      + (r.avvikelse_skal
        ? '<blockquote class="hallen-tid-skal"><span>Studiehjälparen:</span> ' + esc(r.avvikelse_skal) + '</blockquote>'
        : '')
      + '</div>';
  }

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

  function rbKort(r) {
    const b = rbPass(r);
    const bekräftad = S.rb.bekräftade[r.id];
    const till = b ? tillägg(b) : null;
    let läge = '', knappar = '', alt = '';
    if (b && kanBetalas(b)) {
      /* Obetalt: valet av betalsätt ÄR bekräftelsen. Ingen separat
         bekräfta-knapp här, för då hade det gått att bekräfta ett
         obetalt pass ur listan utan att betala det. Beloppet är det
         kassan tar: den debiterade tiden (Fas 20.1). */
      const pris = passetsPris(b);
      läge = (bekräftad ? 'Rapporten är bekräftad, men passet är inte betalt än.' : 'Passet är inte betalt än. Bekräfta rapporten genom att välja hur ni betalar.')
        + (pris ? ' Att betala: ' + NXBetalning.kronor(pris) + '.' : '')
        + (b.betalning_status === 'vantar' ? ' En betalning är påbörjad men inte klar.'
          : b.betalning_status === 'misslyckad' ? ' Förra försöket gick inte igenom.' : '');
      knappar = betalaKnapp(b, true);
      alt = fakturaVal(b);
    } else if (till) {
      /* Betalt i förväg, och passet drog över (Fas 20.1). Samma regel
         som för ett obetalt pass: att betala tillägget ÄR bekräftelsen,
         så ingen bekräfta-knapp bredvid. */
      läge = tilläggRad(till) + ' ' + (bekräftad ? 'Rapporten är bekräftad, men tillägget är inte betalt än.'
        : 'Bekräfta rapporten genom att betala tillägget.');
      knappar = tilläggKnapp(b, till, true);
    } else {
      läge = !b || b.fakturerbar === false ? ''
        : ingetAttBetala(b) ? 'Passet kostar ingenting: första timmen är på köpet.'
        : b.betalning_status === 'faktura' ? 'Passet betalas mot faktura.'
        : b.betalning_status === 'betald' ? (b.klippkort_id ? 'Passet är betalt med timmar.'
          : medBanken(b) ? 'Passet är betalt med timbanken.' : 'Passet är betalt.')
        : (BETALNING_TEXT[b.betalning_status] ? 'Betalning: ' + BETALNING_TEXT[b.betalning_status].toLowerCase() + '.' : '');
      knappar = '<button type="button" class="btn btn-primary btn-sm" data-rb-bekrafta="' + esc(r.id) + '">Bekräfta rapporten</button>';
    }
    return '<article class="report rb-kort" data-rb-rapport="' + esc(r.id) + '">'
      + '<div class="report-head"><b>' + esc(rbRubrik(r, b)) + '</b><time>' + esc(datumText(r.lesson_date)) + '</time></div>'
      + hållenTid(r, b)
      + (rbInnehåll(r) || '<p class="raw">Rapporten är tom.</p>')
      + '<div class="rb-val">'
      + (läge ? '<p class="rb-lage">' + esc(läge) + '</p>' : '')
      + '<div class="rb-knappar">' + knappar
      + (b ? '<a class="btn btn-ghost btn-sm" href="#pass/' + esc(b.id) + '">Visa passet</a>' : '') + '</div>'
      + (alt ? '<div class="rb-alt">' + alt + '</div>' : '')
      + '</div></article>';
  }

  /* Ritas först när både rapporterna och passen finns: utan passen ser
     ett obetalt pass betalt ut, och knappen hade bytts under fingret. */
  function ritaBekrafta() {
    const host = $('#rb-lista'), klara = $('#rb-klara');
    if (!host || !klara || !S.rb.laddat || !S.laddatPass) return;
    const att = rbAttBekräfta();
    const gjorda = S.rb.rapporter.filter(r => att.indexOf(r) === -1)
      .sort((a, c) => String(S.rb.bekräftade[c.id]).localeCompare(String(S.rb.bekräftade[a.id])));
    $('#rb-antal').textContent = att.length ? att.length + ' st' : '';
    $('#rb-klara-antal').textContent = gjorda.length ? gjorda.length + ' st' : '';
    if (S.sido) S.sido.märke('bekrafta', att.length);

    host.innerHTML = att.length ? att.map(rbKort).join('')
      : tomt('Inget att bekräfta', 'När er studiehjälpare har skrivit rapporten efter ett pass står den här.');
    /* De bekräftade som en lista att gå tillbaka till, inte en vägg av
       text. Hela rapporterna står också under Mina lektioner → Efter
       passen. */
    klara.innerHTML = gjorda.length
      ? gjorda.slice(0, 20).map(r => {
          const b = rbPass(r);
          const text = esc(rbRubrik(r, b) + ', ' + datumText(r.lesson_date))
            + '<span>Bekräftad ' + esc(datumText(isoFor(new Date(S.rb.bekräftade[r.id])))) + '</span>';
          return b ? '<a class="pass-lank" href="#pass/' + esc(b.id) + '">' + text + '</a>'
            : '<div class="pass-lank">' + text + '</div>';
        }).join('')
      : tomt('Inga bekräftade rapporter än', 'En rapport ni bekräftat står här.');
  }

  /* Svarar true när rapporten är bekräftad, också om den redan var det
     (23505: bekräftad i en annan flik eller på en annan enhet). Vem och
     när sätts av databasen; härifrån skickas bara vilken rapport. */
  async function bekräftaRapport(id) {
    if (!id) return false;
    if (S.rb.bekräftade[id]) return true;
    const { error } = await supa.from('rapport_bekraftelser').insert({ rapport_id: id });
    if (error && error.code !== '23505') {
      säg($('#rb-msg'), 'Rapporten gick inte att bekräfta: ' + felText(error), false);
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
    await bekräftaRapport(r.id);
    return true;
  }

  /* Omritning med rubriken Att bekräfta stilla. Kortet under den
     försvinner eller byter text; rubriken, och beskedet ovanför den,
     står kvar på sin plats (fälla 4 i CLAUDE.md). */
  function rbRitaOm(före) {
    const rubrik = $('#rb-lista') && $('#rb-lista').closest('.dbox').querySelector('h5');
    NXStudie.håll(rubrik, () => { ritaBekrafta(); if (före) före(); });
    ritaNotiser();
  }

  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-rb-bekrafta]');
    if (!k) return;
    await medan(k, 'Bekräftar…', async () => {
      if (!(await bekräftaRapport(k.dataset.rbBekrafta))) return;
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
     ERBJUDANDEN (Fas 16.1)

     Planer och klippkort: timmar köpta i förväg. Katalogen och priserna
     läses ur erbjudanden_pris — samma vy som prissidan visar och som
     stripe-checkout tar betalt efter — och familjens egna kort ur
     klippkort_saldo, där "kvar" räknas i databasen ur passen. Här
     räknas ingenting om, det ritas bara.

     Flaggan erbjudanden avgör om något går att köpa eller dra. Står den
     av syns erbjudandena med sina priser, men knapparna säger "Snart".
     ============================================================ */
  S.erb = { aktiv: false, katalog: [], kort: [], bank: { saldo: 0, varde: null, perPass: {}, finns: false } };

  async function laddaErbjudanden() {
    const [flagga, katalog, kort, saldo, uttag] = await Promise.all([
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
      supa.from('timbank_uttag').select('booking_id, sort, minuter').eq('parent_id', S.user.id)
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
    ritaErbjudanden();
  }

  /* En timme per påbörjad timme, som i klippkort_dra. */
  const passTimmar = b => Math.max(1, Math.ceil((Number(b.duration_min) || 60) / 60));

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

  /* Har familjen timmar som räcker står den knappen först: då är det
     vägen de valt, och kortet är reserven. Klippkortet före timbanken:
     timmarna på kortet går ut, minuterna i banken gör det inte. */
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

     Under "Betala med kort" kan familjen välja "Betala med faktura i
     stället". Passet kommer då med på en samlad faktura i början av
     nästa månad, med alla pass familjen valt faktura för. Fakturan
     skapas och skickas från Fortnox; här syns den när den skickats.

     Valet är en textknapp under kortknappen, inte en knapp bredvid:
     kortet är det vanliga, fakturan ett alternativ till det. Det går
     att ångra tills passet står på en faktura. Databasen prövar båda
     hållen (skydda_bokningsfalt): här ritas bara det den släpper
     igenom, så att ingen trycker på något som sedan nekas.
     ============================================================ */
  const DAGAR = Number((NX.CFG && NX.CFG.BETALNINGSVILLKOR_DAGAR) || 10);

  /* Fakturan passet står på, också ett utkast som ännu inte skickats.
     Står passet på en faktura går det inte att byta till kort. */
  const fakturaFör = id => (S.fakturaPerPass || {})[id] || null;

  /* Fakturan är ett val EFTER passet, i samband med att rapporten
     bekräftas (Fas 19.2). Före passet finns bara kortet. */
  function fakturaVal(b) {
    return S.faktura === true && kanBetalas(b) && b.status === 'completed'
      ? '<button type="button" class="val-lank" data-faktura-val="' + esc(b.id) + '">Betala med faktura i stället</button>'
      : '';
  }
  /* Tillbaka till kort går också när flaggan är av: ett pass som redan
     valts för faktura ska inte bli omöjligt att betala. */
  function kortVal(b) {
    return b.betalning_status === 'faktura' && b.status !== 'cancelled' && b.fakturerbar !== false && !fakturaFör(b.id)
      ? '<button type="button" class="val-lank" data-kort-val="' + esc(b.id) + '">Betala med kort i stället</button>'
      : '';
  }

  async function laddaFakturor() {
    const { data, error } = await supa.from('invoices')
      .select('id, period, status, belopp_ore, forfaller, skickad_at, betald_at, fortnox_fakturanummer, invoice_lines(booking_id)')
      .eq('parent_id', S.user.id).order('period', { ascending: false });
    /* Kan fakturorna inte läsas står det som fanns kvar. En tom lista
       hade sett ut som att ingenting är fakturerat, och då hade "Betala
       med kort i stället" erbjudits på ett pass som redan står på en
       faktura. */
    if (error) { console.warn('Fakturorna gick inte att läsa', error); return; }
    S.fakturor = data || [];
    S.fakturaPerPass = {};
    S.fakturor.forEach(f => (f.invoice_lines || []).forEach(l => {
      if (l.booking_id) S.fakturaPerPass[l.booking_id] = f;
    }));
    ritaFakturor();
    if (passIdIAdressen()) ritaPassSida();
  }

  /* Faktura eller kort, på ett pass. Omritningen hålls vid något som
     står kvar: på passets sida titeln, i listan rubriken ovanför. Den
     knapp man tryckte på försvinner, och utan det hoppar sidan. */
  async function väljBetalsätt(knapp, passId, läge) {
    knapp.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ betalning_status: läge }).eq('id', passId);
    knapp.removeAttribute('aria-busy');
    if (error) {
      alert((läge === 'faktura' ? 'Det gick inte att välja faktura: ' : 'Det gick inte att byta till kort: ') + felText(error));
      return;
    }
    const ankare = document.querySelector('#pass-sida .ps-titel')
      || (knapp.closest('.dbox') && knapp.closest('.dbox').querySelector('h5'))
      || null;
    await NXStudie.håll(ankare, () => Promise.all([laddaPass(), laddaFakturor()]));
    const msg = $('#bet-msg');
    if (msg && !document.querySelector('#pass-sida .ps-titel')) {
      säg(msg, läge === 'faktura'
        ? 'Klart. Passet kommer med på fakturan i början av nästa månad.'
        : 'Klart. Betala passet med kort, i förväg eller när ni bekräftar rapporten.', true);
    }
  }

  /* Fakturorna, och passen som väntar på nästa. Rutan syns bara när
     det finns något att visa, eller när faktura går att välja. */
  function ritaFakturor() {
    const host = $('#bet-faktura');
    if (!host) return;
    const box = host.closest('.dbox');
    const kronor = NXBetalning.kronor;
    const väntar = (S.bokningar || [])
      .filter(b => b.betalning_status === 'faktura' && b.status !== 'cancelled' && b.fakturerbar !== false)
      .filter(b => { const f = fakturaFör(b.id); return !f || f.status === 'utkast'; })
      .sort((a, c) => String(a.wanted_date).localeCompare(String(c.wanted_date)));
    const skickade = (S.fakturor || []).filter(f => f.status !== 'utkast');
    if (box) box.hidden = !väntar.length && !skickade.length && S.faktura !== true;
    $('#bet-faktura-antal').textContent = skickade.length ? skickade.length + ' st' : '';

    const delar = [];
    skickade.forEach(f => {
      const antal = (f.invoice_lines || []).length;
      delar.push(NXBetalning.fakturaRad(f, {
        under: [f.fortnox_fakturanummer ? 'Faktura ' + f.fortnox_fakturanummer : null,
          antal ? antal + (antal === 1 ? ' pass' : ' pass') : null].filter(Boolean).join(' · ')
      }));
    });
    väntar.forEach(b => {
      const barn = S.barn.find(x => x.id === b.student_id);
      const pris = passetsPris(b);
      const utkast = fakturaFör(b.id);
      delar.push(NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        under: [pris ? kronor(pris) : null, barn ? barn.name : null].filter(Boolean).join(' · '),
        vem: utkast ? 'Står på fakturan för ' + NXBetalning.periodText(utkast.period) + ', som snart skickas.'
          : 'Kommer med på fakturan i början av nästa månad.',
        märke: NXKontakt.betalMärke(b),
        atgarder: kortVal(b)
      }));
    });
    host.innerHTML = delar.length ? delar.join('')
      : tomt('Inga fakturor', 'Välj "Betala med faktura i stället" på ett pass, så kommer det med på en samlad faktura i början av nästa månad. Den ska betalas inom ' + DAGAR + ' dagar, och det kostar ingenting extra.');
  }

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
    p.besked.textContent = '✓ Tack! Köpet är klart. Timmarna syns under Era timmar om en liten stund.';
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
    const idag = isoFor(new Date());
    mina.innerHTML = S.erb.kort.map(k => {
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
        + '</div>';
    }).join('') + bankRad();
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
      + 'Drar ett pass över tas tiden härifrån först, utan kostnad. Räcker minuterna till ett helt pass kan ni betala det med dem.'
      + (bank.varde ? ' Slutar ni betalar vi tillbaka dem, i dag ' + esc(NXBetalning.kronor(bank.varde)) + '.' : '')
      + '</p></div>';
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
    const [pass, und, till] = await Promise.all([
      supa.from('bookings').select('id, subject, format, location, note, wanted_date, wanted_time, duration_min, antal_barn, tjanst, status, student_id, created_by, created_at, avbokningsskal, betalning_status, betald_at, fakturerbar, betalt_ore, aterbetald_ore, klippkort_id, timpris_ore, extra_ore, rabatt_ore, startrabatt')
        .eq('parent_id', S.user.id).order('wanted_date', { ascending: true }),
      supa.from('passunderlag').select('id, debiterade_min, betalda_min, timpris_ore, extra_ore, rabatt_ore, timbank_min')
        .eq('parent_id', S.user.id),
      supa.from('pass_tillagg').select('booking_id, minuter, begart_ore, status, betalt_ore, betald_at')
    ]);
    const { data, error } = pass;

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
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
    ritaÖvBekrafta();
    ritaNästaPass();
    ritaStatistik();
    byggSchema();
    ritaAttBetala();
    ritaBetalda();
    ritaFakturor();
    ritaBekrafta();
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
    /* Faktura eller kort (Fas 14.6). Villkoren står i rutan, för det är
       här familjen godkänner dem för det här passet. */
    const fv = e.target.closest('[data-faktura-val]');
    if (fv) {
      /* Beloppet står i rutan: det är den debiterade tiden (Fas 20.1),
         samma som fakturaraden räknas på. */
      const fb = (S.bokningar || []).find(x => x.id === fv.dataset.fakturaVal);
      const fpris = fb ? passetsPris(fb) : null;
      const ok = await NXStudie.bekräfta({
        titel: 'Betala med faktura?',
        text: (fpris ? 'Passet kostar ' + NXBetalning.kronor(fpris) + '. ' : '')
          + 'Passet kommer med på en samlad faktura från Nextrum i början av nästa månad, tillsammans med de andra pass ni valt faktura för. '
          + 'Fakturan ska betalas inom ' + DAGAR + ' dagar, och det kostar ingenting extra. '
          + 'Ni kan byta tillbaka till kort tills fakturan är skapad.',
        knapp: 'Välj faktura'
      });
      if (ok) { await bekräftaVid(fv, fv.dataset.fakturaVal); await väljBetalsätt(fv, fv.dataset.fakturaVal, 'faktura'); }
      return;
    }
    const kv = e.target.closest('[data-kort-val]');
    if (kv) { await väljBetalsätt(kv, kv.dataset.kortVal, 'ingen'); return; }

    const tim = e.target.closest('[data-timmar]');
    if (tim) { await bekräftaVid(tim, tim.dataset.timmar); await betalaMedTimmar(tim, tim.dataset.timmar); return; }
    const tb = e.target.closest('[data-timbank]');
    if (tb) { await bekräftaVid(tb, tb.dataset.timbank); await betalaMedBanken(tb, tb.dataset.timbank); return; }
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
    if (förfallna.length) {
      poster.push({
        rubrik: förfallna.length === 1 ? 'En faktura har förfallit' : förfallna.length + ' fakturor har förfallit',
        text: 'Betala den så snart ni kan. Har ni redan betalat kan det ta några dagar innan det syns här.',
        mål: '#bet-faktura'
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
    /* Prissidans starterbjudande (Fas 19.5), samma regel som
       forsta_timmen_bjuds() i databasen: det läxhjälpspass som gör att
       familjen har bokat två timmar får en timme bjuden, en gång.
       Avbokade pass räknas inte. Databasen avgör; här visas bara vad
       förslaget kommer att kosta. */
    bjuden: minuter => {
      const aktiva = (S.bokningar || []).filter(b => b.status !== 'cancelled'
        && b.fakturerbar !== false && (b.tjanst || 'laxhjalp') === 'laxhjalp');
      if (aktiva.some(b => b.startrabatt)) return false;
      const före = aktiva.reduce((a, b) => a + (Number(b.duration_min) || 60), 0);
      return före < 120 && före + minuter >= 120;
    },

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
     Bekräfta rapport. */
  function ritaAttBetala() {
    const host = $('#bet-att-betala');
    if (!host) return;
    const nyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');
    const att = (S.bokningar || []).filter(kanBetalas).sort((a, c) => nyckel(a).localeCompare(nyckel(c)));
    $('#bet-att-antal').textContent = att.length ? att.length + ' st' : '';
    /* Siffran i menyn ska betyda "något väntar på er", inte "här
       finns saker". Sedan Fas 19.2 väntar ingenting här: att betala i
       förväg är ett val, och det genomförda passet räknas under
       Bekräfta rapport. Därför ingen siffra alls. */
    if (S.sido) S.sido.märke('betalning', 0);
    if (!att.length) {
      host.innerHTML = tomt('Inget att betala just nu',
        'När er studiehjälpare bekräftat ett pass kan ni betala det här i förväg. Annars betalar ni efter passet, när ni bekräftar rapporten.');
      return;
    }
    host.innerHTML = att.map(b => {
      const barn = S.barn.find(x => x.id === b.student_id);
      const pris = passetsPris(b);
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        under: [pris ? NXBetalning.kronor(pris) : null, barn ? barn.name : null,
          b.betalning_status === 'misslyckad' ? 'Förra försöket gick inte igenom' : null].filter(Boolean).join(' · '),
        vem: b.status === 'completed' ? 'Passet har hållits. Läs rapporten och betala under Bekräfta rapport.'
          : b.betalning_status === 'vantar' ? 'Betalningen är påbörjad men inte klar.'
          : b.wanted_date < isoFor(new Date()) ? 'Passet har varit men är inte betalt. Hölls det, betala det här.'
          : 'Betala nu, eller efter passet när ni bekräftar rapporten.',
        märke: NXKontakt.betalMärke(b),
        atgarder: b.status === 'completed'
          ? '<a class="btn btn-primary btn-sm" href="#bekrafta">Till rapporten</a>'
          : betalaKnapp(b, true) + fakturaVal(b)
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
            /* Ett pass betalt med timmar har inget kortbelopp: pengarna
               ligger på klippkortet (Fas 16.1). */
            under: [b.klippkort_id ? 'med timmar' : medBanken(b) ? 'med timbanken' : betalt ? kronor(betalt) : null,
              'betalt ' + datumText(isoFor(new Date(b.betald_at))),
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
      .select('gick, needs_practice, next_focus, ai_feedback, raw_notes, start_tid, slut_tid, debiterade_min, avvikelse_skal')
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

  /* pris(m) = max(avrundat m/60 × (timpris + tillägg för fler barn) − rabatt, 0),
     samma regel som minuterspris() i _delad/pris.ts. Timpriset är passets
     frysta (Fas 19.5), ur passet eller passunderlaget; katalogen är bara
     reserven. Tillägget för fler barn följer samma källa som timpriset:
     ett fryst timpris med dagens syskontillägg hade varit ett pris som
     aldrig gällt. null när inget pris går att räkna. */
  function prisFör(b, minuter) {
    const u = underlagFör(b);
    const källa = Number(b.timpris_ore) ? b : (u && Number(u.timpris_ore) ? u : null);
    let timme = källa ? Number(källa.timpris_ore) : 0, extra = källa ? Number(källa.extra_ore) || 0 : 0;
    if (!timme) {
      const tj = NXTjanster.hitta(b.tjanst || NXTjanster.standard());
      if (!tj || !tj.pris_per_timme_ore) return null;
      timme = Number(tj.pris_per_timme_ore);
      extra = Number(tj.extra_personer_ore || 0);
    }
    const perTimme = timme + ((b.antal_barn || 1) > 1 ? extra : 0);
    const rabatt = Math.max(Number(b.rabatt_ore != null ? b.rabatt_ore : (u && u.rabatt_ore) || 0), 0);
    return Math.max(Math.round(perTimme * Number(minuter) / 60) - rabatt, 0);
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
    const skriv = '<a class="btn btn-ghost" href="#meddelanden">Skriv till ' + esc(förnamn) + '</a>';
    /* Fas 20.1: den debiterade tiden, när den skiljer sig från den
       bokade, och övertiden att betala på ett pass som redan var betalt. */
    const deb = b.status === 'completed' && underlagFör(b) ? debiteradeMin(b) : null;
    const till = tillägg(b);
    const tillBetalt = (S.tillagg || {})[b.id];

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
    const betalt = pengarPå(b);
    const viaOss = ' Passet är redan betalt. Ska det avbokas, hör av er till oss så betalar vi tillbaka.';

    let besked = null, atgarder = '', alternativ = '';
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
      const ses = förnamn + ' ses med ' + (barn ? barn.name.split(' ')[0] : 'er') + ' ' + NXStudie.relativDag(b.wanted_date) + '.';
      besked = betalt
        ? { text: 'Passet är bokat och betalt. ' + ses + ' Ska det avbokas, hör av er till oss så betalar vi tillbaka.', ton: 'klart' }
        : medTimmar(b)
        ? { text: 'Passet är bokat och betalt med era timmar. ' + ses + ' Avbokar ni det kommer timmarna tillbaka.', ton: 'klart' }
        : b.fakturerbar === false
        ? { text: 'Passet är bokat.', ton: 'klart' }
        : b.betalning_status === 'aterbetald'
        ? { text: 'Passet är bokat, och det ni betalade för det är återbetalt. Undrar ni varför, hör av er till oss.', ton: 'lugn' }
        : b.betalning_status === 'faktura'
        ? { text: 'Passet är bokat och betalas mot faktura. Det kommer med på fakturan i början av nästa månad.', ton: 'klart' }
        : { text: 'Passet är bokat. Betala med kort nu, eller efter passet när ni bekräftar rapporten.', ton: 'klart' };
      atgarder = (kanBetalas(b) ? betalaKnapp(b, false) : '')
        + '<button type="button" class="btn btn-ghost" data-flytta="' + esc(b.id) + '">Föreslå ny tid</button>'
        + (betalt ? '' : '<button type="button" class="btn btn-ghost" data-avboka="' + esc(b.id) + '">Avboka</button>');
      alternativ = fakturaVal(b) || kortVal(b);
    } else if (b.status === 'confirmed' && kanBetalas(b)) {
      /* Passerat och obetalt medan spärren är på — bara då släpper
         kanBetalas igenom det. Hölls passet kan rapporten inte skrivas
         förrän det är betalt, så betalningen är det som låser upp den.
         Hölls det inte är det studiehjälparen som avbokar. */
      besked = { text: 'Passet har varit men är inte betalt. Hölls det, betala det med kort, så kan ' + förnamn
        + ' skriva rapporten. Hölls det inte, avbokar ' + förnamn + ' det.', ton: 'fraga' };
      atgarder = betalaKnapp(b, false) + skriv;
      alternativ = fakturaVal(b);
    } else if (b.status === 'completed' && kanBetalas(b)) {
      /* Genomfört men inte betalt: betalningen efter passet (Fas 19.2).
         Rapporten står nedan, och att välja betalsätt här bekräftar den,
         som under Bekräfta rapport. */
      besked = { text: 'Passet är genomfört. Läs rapporten nedan och bekräfta den genom att betala'
        + (S.faktura === true ? ', med kort eller mot faktura.' : ' med kort.'), ton: 'fraga' };
      atgarder = betalaKnapp(b, false) + skriv;
      alternativ = fakturaVal(b);
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
      atgarder = bekr + '<a class="btn ' + (bekr ? 'btn-ghost' : 'btn-primary') + '" href="#boka">Boka nästa pass</a>' + skriv;
      alternativ = kortVal(b);
    } else if (b.status === 'completed' && till) {
      /* Betalt i förväg, och passet drog över (Fas 20.1). Tillägget
         betalas när rapporten bekräftas, och att betala det bekräftar
         den, som under Bekräfta rapport. */
      const bekräftad = (() => { const r = rapportFörPass(b.id); return !!(r && S.rb.bekräftade[r.id]); })();
      besked = { text: 'Passet är genomfört och betalt. ' + tilläggRad(till) + ' '
        + (bekräftad ? 'Tillägget är inte betalt än.' : 'Läs rapporten nedan och bekräfta den genom att betala tillägget.'), ton: 'fraga' };
      atgarder = tilläggKnapp(b, till, false) + skriv;
    } else if (b.status === 'completed') {
      /* Betalt i förväg, eller undantaget från betalning. Rapporten
         bekräftas ändå (Fas 19.2). */
      const bekr = rbKnappFör(b);
      besked = bekr ? { text: 'Passet är genomfört. Läs rapporten nedan och bekräfta den.', ton: 'fraga' }
        : { text: 'Passet är genomfört.', ton: 'klart' };
      atgarder = bekr + '<a class="btn ' + (bekr ? 'btn-ghost' : 'btn-primary') + '" href="#boka">Boka nästa pass</a>' + skriv;
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
        ['Längd', timmar === 1 ? '1 timme' : timmar + ' timmar'],
        ['Debiteras', deb && deb !== Number(b.duration_min || 60) ? tidLängd(deb) : null]
      ] },
      { rubrik: 'Var', rader: [
        ['Hur', b.format || 'Inte angivet'],
        /* Fas 18.1: ett bekräftat onlinepass har en Meet-länk här.
           Texten efter är det som står när Google inte är kopplat. */
        NXStudie.mötesRad(b, 'Länken kommer i meddelanden'),
        ['Plats', b.location || (b.format === 'Online' ? null : 'Inte angiven — skriv till ' + förnamn)]
      ] },
      { rubrik: 'Vem', rader: [
        ['Elev', barn ? barn.name : null],
        ['Antal barn', (b.antal_barn || 1) > 1 ? String(b.antal_barn) : null],
        ['Studiehjälpare', hjälpare]
      ] },
      { rubrik: 'Pris', rader: [
        ['Pris', pris === null ? null
          : NXBetalning.kronor(pris) + (b.startrabatt ? ', första timmen på köpet' : '')],
        /* Passets eget betalläge. Sedan Fas 14.2 finns ingen faktura
           att hänvisa till: ett genomfört pass som inte är betalt är
           just det, och ska betalas på den här sidan. */
        ['Betalning', b.fakturerbar === false ? 'Betalas inte'
          : ingetAttBetala(b) && b.status !== 'cancelled' ? 'Inget att betala'
          : b.betalning_status === 'faktura' && b.status !== 'cancelled'
            ? (fakturaFör(b.id) && fakturaFör(b.id).fortnox_fakturanummer && fakturaFör(b.id).status !== 'utkast'
                ? 'Faktura ' + fakturaFör(b.id).fortnox_fakturanummer : 'Mot faktura')
          : b.status === 'requested' ? 'Betalas när passet är bekräftat'
          : b.status === 'cancelled' ? (b.betalning_status && b.betalning_status !== 'ingen'
              ? BETALNING_TEXT[b.betalning_status] : null)
          : (BETALNING_TEXT[b.betalning_status || 'ingen'] || null)],
        /* Tillägget för övertiden (Fas 20.1): att betala, påbörjat eller
           betalt. Ett återbetalt eller bestritt tillägg har admin att
           säga något om, inte den här raden. */
        ['Tillägg', till ? (till.belopp ? NXBetalning.kronor(till.belopp) + ', ' : '')
            + (till.status === 'vantar' ? 'påbörjat' : 'inte betalt')
          : tillBetalt && tillBetalt.status === 'betald'
            ? 'Betalt' + (tillBetalt.betalt_ore ? ', ' + NXBetalning.kronor(tillBetalt.betalt_ore) : '')
          : null]
      ] }
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
      ? 'Välj ' + barn.name.split(' ')[0] + ' för att se läxorna.'
      : 'Inga öppna läxor till passet.';

    const block = [
      { rubrik: 'Anteckning', html: b.note ? '<p>' + esc(b.note) + '</p>' : '' },
      { rubrik: 'Läxor fram till passet', html: b.status === 'cancelled' ? '' : läxor.length
        ? läxor.map(h => '<a class="pass-lank" href="#uppgifter">' + esc(h.title)
            + '<span>Till ' + esc(NXStudie.deadlineText(h.due_date)) + '</span></a>').join('')
        : '<p>' + esc(läxTomt) + '</p>' }
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
      alternativ,
      kort,
      block: block.concat(rapport ? [{ rubrik: 'Efter passet', html:
        hållenTid(rapport, b)
        + (rapport.gick ? '<p><b>' + esc(NXStudie.GICK[rapport.gick] || rapport.gick) + '</b></p>' : '')
        + ((rapport.ai_feedback || rapport.raw_notes) ? '<p>' + esc(rapport.ai_feedback || rapport.raw_notes) + '</p>' : '')
        + (rapport.needs_practice ? '<p><b>Öva mer på:</b> ' + esc(rapport.needs_practice) + '</p>' : '')
        + (rapport.next_focus ? '<p><b>Nästa gång:</b> ' + esc(rapport.next_focus) + '</p>' : '')
      }] : [])
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
      roll: 'parent',
      msg: $('#notisval-msg')
    });

    /* Barnen först: nästan allt nedan gäller det valda barnet. Studie-
       hjälparens kort — med en signerad profilbild, två frågor i rad —
       får inte hålla passen och läxorna i kö; chatten startar när
       namnet finns. */
    /* Erbjudandena före passen: knappen Betala med timmar ritas ur dem. */
    await Promise.all([laddaBarn(), laddaSparr(), laddaErbjudanden()]);
    await Promise.all([laddaTutor().then(startaTråd), laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaPass(), laddaBokning(), laddaFakturor(), laddaBekrafta()]);
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
