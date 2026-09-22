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

  const S = { user: null, profil: null, tutor: null, barn: [], valtBarn: null, kal: null, bokningar: [], trad: null, material: [], minAvatar: null, laxor: [], laxFilter: 'attgora', rapporter: [], progress: [], olästaAntal: 0, plan: null, sido: null, progressAntal: 0, schema: null, tillgangFinns: false };

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
      .from('students').select('id, name, grade, school, subjects, goals')
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

    host.innerHTML = S.barn.map(b => {
      const under = [b.grade, b.school, b.subjects].filter(Boolean).join(' · ');
      return '<div class="barn-rad" data-barn="' + esc(b.id) + '">'
        + '<div class="barn-namn"><b>' + esc(b.name) + '</b>'
        + (under ? '<span>' + esc(under) + '</span>' : '')
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
    laddaPlan(); laddaRapporter(); laddaLaxor(); laddaProgress(); laddaMaterial(); laddaBokning();
    laddaSyskonMaterial();
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
      text: 'Allt som hör till barnet försvinner: studieplan, läxor och material. '
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

  /* Familjen äger barnets uppgifter. Studiemålet ser studiehjälparen,
     de egna anteckningarna gör hen inte — family_notes har ingen
     policy som släpper fram den åt andra hållet. */
  async function fyllBarnFormulär() {
    const b = S.barn.find(x => x.id === S.valtBarn);
    $('#b-skola').value = (b && b.school) || '';
    $('#b-amnen').value = ((b && b.subjects) || []).join(', ');
    $('#b-mal').value = (b && b.goals) || '';

    /* Anteckningen ligger i en egen tabell som bara familjen når.
       I students hade studiehjälparen kunnat läsa den via API:t —
       RLS gäller rader, inte kolumner. */
    $('#b-egna').value = '';
    const { data } = await supa.from('student_notes')
      .select('notes').eq('student_id', S.valtBarn).maybeSingle();
    if (data) $('#b-egna').value = data.notes || '';
  }

  $('#andra-barn').addEventListener('click', () => {
    if (!S.valtBarn) { säg($('#b-andra-msg'), '⚠️ Lägg till ett barn först.', false); return; }
    const f = $('#barn-andra');
    f.hidden = !f.hidden;
    $('#andra-barn').textContent = f.hidden ? 'Ändra uppgifter' : 'Stäng';
    if (!f.hidden) { fyllBarnFormulär(); $('#b-skola').focus(); }
  });
  $('#andra-avbryt').addEventListener('click', () => {
    $('#barn-andra').hidden = true;
    $('#andra-barn').textContent = 'Ändra uppgifter';
    rensa($('#b-andra-msg'));
  });

  $('#barn-andra').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#b-andra-msg');
    rensa(msg);
    if (!S.valtBarn) { säg(msg, '⚠️ Välj ett barn först.', false); return; }

    await medan(e.submitter, 'Sparar…', async () => {
      const { error } = await supa.from('students').update({
        school: $('#b-skola').value.trim() || null,
        subjects: $('#b-amnen').value.split(',').map(x => x.trim()).filter(Boolean),
        goals: $('#b-mal').value.trim() || null
      }).eq('id', S.valtBarn);

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

  $('#lagg-till-barn').addEventListener('click', () => {
    const f = $('#barn-form');
    f.hidden = !f.hidden;
    if (!f.hidden) $('#b-namn').focus();
  });
  $('#avbryt-barn').addEventListener('click', () => { $('#barn-form').hidden = true; rensa($('#barn-msg')); });

  $('#barn-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#barn-msg');
    rensa(msg);
    const namn = $('#b-namn').value.trim();
    if (!namn) { säg(msg, 'Fyll i barnets namn.', false); return; }

    const { error } = await supa.from('students').insert({
      parent_id: S.user.id, name: namn, grade: $('#b-ak').value || null
    });
    if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
    $('#barn-form').reset();
    $('#barn-form').hidden = true;
    await laddaBarn();
    await Promise.all([laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaMaterial(), laddaPass()]);
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
      .select('id, title, instructions, subject, due_date, status, completed_at')
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
      return NXStudie.läxRad(h, { atgarder: knappar });
    }).join('');
  }

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
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }

    host.innerHTML = laddar();
    const { data, error } = await supa
      .from('progress_items').select('id, subject, area, level, comment')
      .eq('student_id', S.valtBarn).order('subject').order('area');

    if (error) { host.innerHTML = tomt('Kunde inte hämta utvecklingen', felText(error)); return; }

    S.progress = data;
    if (!data.length) {
      S.progressAntal = 0;
      ritaStatistik();
      host.innerHTML = tomt('Inget att visa än',
        'Efter några pass fyller er studiehjälpare i vilka områden som sitter och vilka som behöver mer träning.');
      return;
    }
    S.progressAntal = data.length;
    ritaStatistik();
    $('#prg-antal').textContent = data.length + ' områden';
    /* Överblicken först, detaljerna sedan. Listan svarar på VAD som
       är svårt; översikten svarar på "hur ligger vi till i matte",
       och det är den frågan man ställer först. */
    host.innerHTML = NXStudie.utvecklingPerÄmne(data)
      + '<div class="ut-detalj"><span class="ut-detalj-et">Område för område</span>'
      + NXStudie.progressPerÄmne(data, {}) + '</div>';
  }

  /* ============================================================
     MATERIAL
     Läsvy. Filerna ligger i en privat hink, så adressen skapas
     först när någon klickar och slutar gälla av sig själv.
     ============================================================ */

  async function laddaMaterial() {
    await M.laddaMaterial(S, {
      elev: S.valtBarn,
      tomElev: ['Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'],
      tomLista: ['Inget material än', 'Här samlas övningar, länkar och anteckningar som er studiehjälpare delar.'],
      filnamn: true
    });
    /* Märkena räknas ur S.material, som nu hör till det valda barnet.
       Står man redan och tittar på listan är det nya sett. */
    if (materialSynligt()) sågMaterial();
    ritaÖvLaxor();
    ritaNotiser();
  }

  document.addEventListener('click', async e => {
    const öppna = e.target.closest('[data-mat-oppna]');
    if (!öppna) return;
    const m = S.material.find(x => x.id === öppna.dataset.matOppna);
    if (!m || !m.url) return;
    await medan(öppna, 'Öppnar…', async () => {
      const url = await M.signera('material', m.url, 300);
      if (!url) { alert('Filen kunde inte öppnas. Ladda om sidan och försök igen.'); return; }
      window.open(url, '_blank', 'noopener');
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

  /* ============ pass ============ */
  async function laddaPass() {
    const host = $('#pass-lista');
    const { data, error } = await supa
      .from('bookings').select('id, subject, format, location, note, wanted_date, wanted_time, duration_min, status, student_id, created_by, betalning_status')
      .eq('parent_id', S.user.id).order('wanted_date', { ascending: true });

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
    ritaNotiser();
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

      let knappar = '';
      if (derasFörslag && b.status === 'requested') {
        knappar = '<button class="btn btn-primary btn-sm" data-passvar="confirmed" data-id="' + b.id + '">Passar bra</button>'
                + '<button class="btn btn-ghost btn-sm" data-passvar="cancelled" data-id="' + b.id + '">Avböj</button>';
      } else if (kommande) {
        /* Betalningen hör till BEKRÄFTADE pass, inte till förfrågningar
           (Fas 12.2). Ett pass som studiehjälparen ännu inte tackat ja
           till kan avböjas, och då hade varje förfrågan blivit en
           återbetalning: en kortavgift vi inte får tillbaka, och en
           familj som undrar vad som hände. */
        if (b.status === 'confirmed' && b.betalning_status !== 'betald') {
          knappar = '<button class="btn btn-primary btn-sm" data-betala="' + b.id + '">'
                  + (b.betalning_status === 'misslyckad' ? 'Försök betala igen' : 'Betala') + '</button>';
        }
        knappar += '<button class="btn btn-ghost btn-sm" data-flytta="' + b.id + '">Flytta</button>'
                + '<button class="btn btn-ghost btn-sm" data-avboka="' + b.id + '">Avboka</button>';
      }

      /* Platsen står direkt på raden. Ett pass på plats är en resa —
         var man ska vara är halva beskedet. */
      const under = [b.format, b.location, barn ? barn.name : null].filter(Boolean).join(' · ');
      return NXKontakt.passRad(b, {
        under: under,
        vem: derasFörslag ? 'Föreslaget av er studiehjälpare' : null,
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
    const ja = await NXStudie.bekräfta({
      titel: 'Avboka passet?',
      text: 'Er studiehjälpare ser att passet är avbokat. Vill ni hellre byta tid, välj Flytta i stället.',
      knapp: 'Avboka'
    });
    if (!ja) return;
    btn.setAttribute('aria-busy', 'true');
    const { error } = await supa.from('bookings').update({ status: 'cancelled' }).eq('id', btn.dataset.avboka);
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
        mål: '#pass-lista'
      });
    }

    if (S.olästaAntal) {
      poster.push({
        rubrik: S.olästaAntal + (S.olästaAntal > 1 ? ' nya meddelanden' : ' nytt meddelande'),
        text: 'Från er studiehjälpare. Svara i kontaktrutan.',
        mål: '#trad'
      });
    }

    const nya = nyttMaterial();
    if (nya.length) {
      poster.push({
        rubrik: nya.length > 1 ? nya.length + ' nya material' : 'Nytt material',
        text: nya.length > 1
          ? 'Från er studiehjälpare, bland annat "' + (nya[0].title || 'utan titel') + '".'
          : '"' + (nya[0].title || 'Utan titel') + '" från er studiehjälpare.',
        mål: '#mat-lista'
      });
    }
    (S.syskonMaterial || []).forEach(x => {
      poster.push({
        rubrik: (x.antal > 1 ? x.antal + ' nya material' : 'Nytt material') + ' till ' + x.barn.name,
        text: 'Byt till ' + x.barn.name + ' i barnväljaren för att se det.',
        mål: 'section[data-sek="uppgifter"] [data-barnvaxel] select'
      });
    });

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

    const [upptagna, tider] = await Promise.all([
      NX.hämtaUpptagna(S.profil.matched_tutor_id),
      NX.hämtaTillganglighet(S.profil.matched_tutor_id)
    ]);

    const ny = await NXStudie.flyttaRuta({
      datum: b.wanted_date, tid: b.wanted_time,
      tillgang: tider.tillgang, upptagna,
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

     Ytan är en skärm: ämne, längd och format som knappar överst,
     studiehjälparens vecka under, och en rad längst ned med pris och
     knapp. Det som togs bort på vägen hit var först tre rullgardiner
     och en månadskalender, sedan fyra numrerade steg — båda gjorde
     samma sak fel, de gömde veckan bakom något annat.

     Själva ritandet ligger i NXArbete.bokning. Det här är kopplingen
     till databasen: vad som hämtas, och vad som skrivs.
     ============================================================ */
  const BOKA_AMNEN = ['Matematik', 'Svenska', 'Engelska',
    'NO / Fysik / Kemi / Biologi', 'SO / Historia / Samhällskunskap', 'Annat'];

  S.boka = NXArbete.bokning({
    host: $('#boka-inner'),
    amnen: BOKA_AMNEN,
    pris: NX.CFG.PRIS_PER_TIMME || 379,
    /* Vilken tjänst bokningen gäller. Styr priset, tillägget för
       flera barn och vilka rabattkoder som får användas. En funktion,
       inte ett värde: bokningen skapas innan katalogen laddats. */
    tjanst: () => NXTjanster.standard(),

    /* Två spärrar som förr yttrade sig som en avstängd knapp utan
       förklaring. Nu står skälet där tiderna skulle ha stått. */
    ladda: async () => {
      if (!S.valtBarn) {
        return { spärr: NXStudie.tomt('Lägg till ditt barn först',
          'Bokningen behöver veta vem passet gäller. Barnen läggs till under Profil & inställningar.') };
      }
      const [upptagna, tider] = await Promise.all([
        NX.hämtaUpptagna(S.profil.matched_tutor_id),
        NX.hämtaTillganglighet(S.profil.matched_tutor_id)
      ]);
      return {
        tillgang: tider.tillgang,
        upptagna,
        /* Inga tider inlagda: då finns ingen kalender, men en önskad
           tid går fortfarande att skicka — studiehjälparen svarar. */
        utanTider: '<div class="empty"><b>Er studiehjälpare har inga tider inlagda än</b>'
          + '<br><span>Önska en tid här nedanför, så bekräftar hen den eller svarar att den inte går. '
          + 'Ni kan också fråga i chatten när hen kan.</span>'
          + '<div class="vy-tomt-atg"><a class="btn btn-ghost btn-sm" href="#meddelanden">'
          + 'Fråga i chatten</a></div></div>',
        /* Familjens vana: tidigare pass gör att "brukar passa"
           kan markeras på rätt tider. */
        tidigare: (S.bokningar || []).filter(b => b.status !== 'cancelled')
      };
    },

    /* Svarar med databasens status: en tid helt inom studiehjälparens
       schema bekräftas av bekrafta_inom_schemat (Fas 4.4), allt annat
       är en förfrågan. Ytan säger vilket det blev. */
    boka: async v => {
      const { data, error } = await supa.from('bookings').insert({
        parent_id: S.user.id,
        tutor_id: S.profil.matched_tutor_id,
        student_id: S.valtBarn,
        created_by: S.user.id,
        subject: v.amne,
        tjanst: NXTjanster.standard(),
        antal_barn: v.barn || 1,
        /* Rabatten räknas OM av triggern skydda_rabatt i databasen.
           Talet härifrån är ett förslag, inte ett facit — en
           manipulerad webbläsare kan skicka vad som helst, och
           servern sätter ner det till vad koden faktiskt ger. */
        rabattkod: v.kod || null,
        rabatt_ore: v.rabattOre || null,
        format: v.format,
        location: v.plats || null,
        wanted_date: v.datum,
        wanted_time: v.tid,
        duration_min: v.minuter,
        /* Meddelandet som följer med ett önskemål om en annan tid. */
        note: v.not || null,
        status: 'requested'
      }).select('status').single();
      if (error) {
        /* 23505 = samma starttid, 23P01 = passet krockar med ett
           annat som redan pågår. Samma sak för den som bokar. */
        if (error.code === '23505' || error.code === '23P01') {
          return 'Den tiden hann bli bokad, eller krockar med ett annat pass. Tiderna nedan är uppdaterade — välj en annan.';
        }
        return 'Kunde inte boka: ' + felText(error);
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
    const aktiva = S.bokningar.filter(b => b.status !== 'cancelled');
    const kommande = aktiva.filter(b => b.wanted_date >= idag &&
      (b.status === 'requested' || b.status === 'confirmed'));

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
    if (S.sido) S.sido.märke('uppgifter', öppna.length + nyttMaterial().length);
    const mark = $('#flik-lax-mark');
    if (mark) { mark.hidden = !öppna.length; mark.textContent = öppna.length || ''; }
    const matMark = $('#flik-mat-mark');
    const nya = nyttMaterial().length;
    if (matMark) { matMark.hidden = !nya; matMark.textContent = nya || ''; }
  }

  /* Nytt material: det som kommit sedan familjen senast TITTADE på
     barnets material — inte sedan senaste inloggningen. last_seen_at
     stämplas vid varje sidladdning, så med den som gräns lyste
     notisen en gång och försvann sedan, oavsett om någon öppnat
     materialet.

     Gränsen sparas per barn i webbläsaren. Första gången (ingen
     sparad gräns) blir den förra besöket, last_seen_at, som står kvar
     i S.profil tills sidan laddas om — och sparas direkt, så att
     den håller över nästa omladdning. Går det inte att spara (privat
     läge) faller den tillbaka på last_seen_at och sett-markeringen
     i minnet. Utan någon gräns alls (första besöket) är inget nytt:
     att allt lyser vid första inloggningen säger ingenting. */
  const MAT_NYCKEL = 'nx.material-sett.';

  function materialGräns(barnId) {
    const förra = (S.profil && S.profil.last_seen_at) || null;
    try {
      let v = localStorage.getItem(MAT_NYCKEL + barnId);
      if (!v && förra) { v = förra; localStorage.setItem(MAT_NYCKEL + barnId, v); }
      return v || null;
    } catch (e) {
      return förra;
    }
  }

  function ärNytt(m, gräns) {
    return !!(m.created_at && gräns && Date.parse(m.created_at) > Date.parse(gräns));
  }

  function nyttMaterial() {
    if (!S.valtBarn) return [];
    if (S.materialSett && S.materialSett.has(S.valtBarn)) return [];
    const gräns = materialGräns(S.valtBarn);
    return (S.material || []).filter(m => ärNytt(m, gräns));
  }

  /* Sett per barn: att ha tittat på det ena barnets material säger
     inget om det andras. */
  function materialSynligt() {
    const p = $('section[data-sek="uppgifter"] .vy-flik-panel[data-flik="material"]');
    return !!p && !p.hidden && !p.closest('[hidden]');
  }
  function sågMaterial() {
    if (!S.valtBarn || !nyttMaterial().length) return false;
    (S.materialSett = S.materialSett || new Set()).add(S.valtBarn);
    try { localStorage.setItem(MAT_NYCKEL + S.valtBarn, new Date().toISOString()); } catch (e) { /* bara i minnet */ }
    return true;
  }

  /* Syskonen: materialet hämtas bara för det valda barnet, så nytt
     till ett annat barn syntes aldrig. En liten fråga — bara id,
     barn och tid — räcker för att säga "nytt material till Alva". */
  async function laddaSyskonMaterial() {
    const andra = (S.barn || []).filter(b => b.id !== S.valtBarn);
    const gränser = andra.map(b => ({ barn: b, gräns: materialGräns(b.id) })).filter(g => g.gräns);
    if (!gränser.length) { S.syskonMaterial = []; return; }
    const tidigast = gränser.map(g => g.gräns).sort()[0];
    const { data, error } = await supa.from('materials').select('student_id, created_at')
      .in('student_id', gränser.map(g => g.barn.id)).gt('created_at', tidigast);
    if (error) return;
    S.syskonMaterial = gränser
      .map(g => ({ barn: g.barn, antal: (data || []).filter(m => m.student_id === g.barn.id && ärNytt(m, g.gräns)).length }))
      .filter(x => x.antal);
    ritaNotiser();
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
     BETALNING
     Familjen betalar i efterskott för genomförda pass. Ingenting
     här skriver till databasen: belopp sätts av edge-funktionen,
     och kortuppgifterna tas emot av Stripe på deras egen sida. Vi
     lagrar aldrig ett kortnummer, och kan därför inte tappa bort ett.
     ============================================================ */
  async function laddaBetalning() {
    const B = NXBetalning;
    const pag = $('#bet-pagaende'), lista = $('#bet-lista');
    if (!pag) return;

    const [ofakt, fakt] = await Promise.all([
      supa.from('ofakturerat').select('pass, minuter').eq('parent_id', S.user.id).maybeSingle(),
      supa.from('invoices').select('id, period, status, belopp_ore, forfaller, stripe_url')
        .eq('parent_id', S.user.id).order('period', { ascending: false })
    ]);

    /* Timpriset ur tjänstekatalogen (laddad i start()), inte ur
       prissattning — samma källa som bokningen och faktureringen.
       prissattning ska avvecklas, se Fas 5.5. */
    await NXTjanster.ladda();
    const tj = NXTjanster.hitta(NXTjanster.standard());
    const timpris = (tj && Number(tj.pris_per_timme_ore)) || null;
    const o = ofakt.data || { pass: 0, minuter: 0 };

    pag.innerHTML = timpris
      ? B.pagaende({
          pass: o.pass, minuter: o.minuter,
          belopp_ore: Math.round((Number(o.minuter || 0) / 60) * timpris),
          not: 'Uppskattat på ' + B.kronor(timpris) + ' i timmen. Fakturan skapas när månaden är slut, '
             + 'och bara genomförda pass kommer med.',
          tomRubrik: 'Inget att betala än',
          tomText: 'Passen räknas ihop här allt eftersom de genomförs.'
        })
      : tomt('Priset går inte att läsa', 'Vi kan inte visa en uppskattning just nu. Fakturan påverkas inte.');

    if (fakt.error) { lista.innerHTML = tomt('Kunde inte hämta fakturorna', felText(fakt.error)); return; }

    const rader = fakt.data || [];
    $('#bet-antal').textContent = rader.length ? rader.length + ' st' : '';

    /* Siffran i menyn ska betyda "något väntar på dig", inte "här
       finns saker". Bara obetalda räknas. */
    const obetalda = rader.filter(f => {
      const l = B.fakturaLage(f);
      return l === 'skickad' || l === 'forfallen';
    }).length;
    if (S.sido) S.sido.märke('betalning', obetalda);

    if (!rader.length) {
      lista.innerHTML = tomt('Inga fakturor än', 'Den första skapas när en månad med genomförda pass är slut.');
      return;
    }

    const linjer = await supa.from('invoice_lines')
      .select('invoice_id, beskrivning, minuter, belopp_ore')
      .in('invoice_id', rader.map(f => f.id));
    const per = {};
    (linjer.data || []).forEach(l => { (per[l.invoice_id] = per[l.invoice_id] || []).push(l); });

    lista.innerHTML = rader.map(f => {
      const läge = B.fakturaLage(f);
      const kanBetala = (läge === 'skickad' || läge === 'forfallen') && f.stripe_url;
      const antal = (per[f.id] || []).length;
      return '<div class="bet-post">'
        + B.fakturaRad(f, {
            under: antal ? antal + (antal === 1 ? ' pass' : ' pass') : '',
            atgarder: kanBetala
              ? '<a class="btn btn-primary btn-sm" href="' + esc(f.stripe_url)
                + '" target="_blank" rel="noopener noreferrer">Betala</a>'
              : ''
          })
        + B.radLista(per[f.id])
        + '</div>';
    }).join('');
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
  const NIVA_LAGEN = [
    ['bra', 'Sitter', 'ar-bra'],
    ['pa_god_vag', 'På god väg', 'ar-mitten'],
    ['behover_trana', 'Behöver träna', 'ar-folj']
  ];

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
      av: p => p.level,
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
      knappar = '<button type="button" class="btn btn-primary" data-passvar="confirmed" data-id="' + esc(b.id) + '">Passar bra</button>'
              + '<button type="button" class="btn btn-ghost" data-passvar="cancelled" data-id="' + esc(b.id) + '">Avböj</button>';
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

    /* Flikarna först. Sidomenyn ropar på dem när den byter sektion,
       och en flikrad som inte finns än hade svalt det anropet. */
    S.flikar = {
      lektioner: NXArbete.flikar($('section[data-sek="lektioner"]')),
      /* Fliken räknas som öppnad hur man än kom dit: klick, pil-
         tangent, notisen i klockan eller en länk med #material. */
      uppgifter: NXArbete.flikar($('section[data-sek="uppgifter"]'), {
        onByt: v => { if (v === 'material' && sågMaterial()) { ritaÖvLaxor(); ritaNotiser(); } }
      }),
      profil: NXArbete.flikar($('section[data-sek="profil"]'))
    };

    /* Pilarna som står i markupen läses av en gång här, så ett sparat
       läge syns direkt och inte först vid första klicket. */
    NXArbete.fallStall($('#view-app'));

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
      material: ['uppgifter', 'material'],
      laxor: ['uppgifter', 'laxor'],
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
      bild: 'bilder/hero-nextrum-1280.jpg',
      marke: { text: 'Förälder eller elev', ikon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c0-3 2.5-5.4 5.5-5.4s5.5 2.4 5.5 5.4"/><path d="M16.5 7.5h5M19 5v5"/></svg>' },
      chatt: { href: '#meddelanden', text: 'Meddelanden', under: 'Skriv till er studiehjälpare' }
    });
    ritaNästaPass();

    if (S.profil.avatar_url) S.minAvatar = await M.signera('avatarer', S.profil.avatar_url);
    $('#k-namn').value = S.profil.full_name || '';
    $('#k-tel').value = S.profil.phone || '';
    $('#k-bio').value = S.profil.bio || '';
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
    await Promise.all([laddaPlan(), laddaRapporter(), laddaLaxor(), laddaProgress(), laddaMaterial(), laddaPass(), laddaBokning()]);
    /* Läxorna och materialet hämtas samtidigt, så märkena ritas om
       när båda finns — annars räknades nytt material innan det kommit. */
    ritaÖvLaxor();
    ritaNotiser();
    await Promise.all([ritaÖvSamtal(), laddaBetalning(), laddaSyskonMaterial()]);
    supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
