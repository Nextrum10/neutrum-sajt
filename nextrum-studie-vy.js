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
    /* Syskontillägget som skuld (syskontillagg_som_skuld, 2026-10-21): läget ur
       mitt_tillagg() (null före migrationen), och passens barn ur bokning_barn. */
    syskon: null, passBarn: {},
    /* NexLäx (Fas 23.1, 23.2). banaVal minns ämne och årskurs per barn;
       nl är det som hör till vägen: den öppnade noden, det som just
       klarades, de påbörjade försöken och läget (XP och serien). */
    katalog: null, forsok: [], banaVal: {},
    nl: { nyss: null, pågående: {}, läge: null, laddad: false, alla: false } };

  const VYER = ['view-loading', 'view-auth', 'view-wrongrole', 'view-app', 'view-fel'];
  function visa(id) { NXStudie.visaVy(VYER, id); }

  /* ============ header ============ */
  function ritaHeader() { NXStudie.vyHuvud(S, 'Förälder', ritaNotiser); }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-logout]')) NXStudie.loggaUt(supa);
  });

  /* ============ inloggning ============ */
  /* En inloggning för alla (2026-10-07): e-post eller användarnamn, och
     inget Skapa konto. Ett barn hamnar på /barn (NXStudie.loggaIn), och
     en studiehjälpare skickas till sin vy av start() nedan. */
  let läge = 'in';
  function ritaAuth() {
    NXStudie.inloggningsruta(läge, {
      titel: 'Välkommen tillbaka',
      under: 'Med din e-post eller ditt användarnamn. Kontot avgör vilken vy du hamnar i.',
      etikett: 'E-post eller användarnamn'
    });
  }
  /* Glömt lösenordet? och en länk som inte fungerade är egna lägen i
     samma ruta (NXStudie). */
  function sättLäge(l) { läge = l; ritaAuth(); }
  NXStudie.glömtLänkar(sättLäge);
  läge = NXStudie.elevLänk(sättLäge);

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg');
    rensa(msg);
    if (!supa) { säg(msg, 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false); return; }
    if (läge === 'glomt' || läge === 'lankfel') { await NXStudie.glömtSkicka(supa); return; }

    const epost = $('#a-email').value.trim();
    const lösen = $('#a-pass').value;
    if (!epost || !lösen) { säg(msg, 'Fyll i e-post eller användarnamn och lösenord.', false); return; }
    await NXStudie.loggaInHär(supa, epost, lösen);
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
    /* Rapporten på passets sida är ett brev med namn och bild. Den kan
       ha ritats innan namnet kom; då ritas den om med det. */
    if (S.rb && S.rb.laddat && passIdIAdressen()) ritaPassSida();
  }

  /* ============ kontakt ============ */
  function startaTråd() {
    if (!S.profil.matched_tutor_id) {
      $('#trad').innerHTML = '<div class="empty">Ni är inte matchade med någon studiehjälpare än, '
        + 'så det finns ingen att skriva till. När vi matchat er står tråden här.</div>';
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
    const kolumner = 'id, name, grade, school, subjects, goals, about, behov, format_onskemal';
    let svar = await supa.from('students').select(kolumner + ', kon')
      .eq('parent_id', S.user.id).order('created_at');
    /* Könet (kon_i_matchningen, 2026-10-26) finns först efter migrationen.
       Utan den hämtas resten som förut, och fältet i formuläret döljs. */
    S.konFinns = !svar.error;
    if (svar.error) {
      svar = await supa.from('students').select(kolumner)
        .eq('parent_id', S.user.id).order('created_at');
    }
    const { data, error } = svar;
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
    laddaGaranti();
    // Raden före matchningen leder till barnen tills det finns ett.
    if (S.väntar) ritaÖvGöra();
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
    S.nl = { nyss: null, pågående: {}, läge: null, laddad: false, alla: false };
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
  const bf = { läge: null, amnen: [], behov: [], format: null, kon: null };

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
    $('#b-kon-val').innerHTML = knappar(NX.KON_ELEV, bf.kon, true);
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
  // Ett tryck till på det valda tar bort svaret: fältet får stå tomt.
  $('#b-kon-val').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    bf.kon = bf.kon === b.dataset.v ? null : b.dataset.v; ritaBarnVal();
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
    bf.kon = (b && b.kon) || null;
    $('#b-kon-grupp').hidden = !S.konFinns;
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
    if (S.konFinns) uppgifter.kon = bf.kon;

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

     BARNETS EGEN E-POST (barnets_epost). Under en inloggning kan
     föräldern lägga till barnets egen adress. Den används till
     ingenting förrän barnet tryckt på länken i mejlet som går dit; sedan
     kan barnet logga in med den, och få mejl om sina pass om föräldern
     slår på det. Allt går genom databasens funktioner (barn_epost_satt,
     _skicka_igen, _ta_bort, _notiser), som prövar att den inloggade är
     barnets förälder. Med flaggan barn_epost av syns rutan bara för den
     som redan har en adress, och då bara för att ta bort den.

     VAD BARNET FÅR (barnets_behorigheter, 2026-10-06). Leo: "familjen
     som skapar elev väljer vilka behörigheter barnet ska vara". När
     inloggningen skapas kryssar föräldern i vad barnet får se och göra,
     och efteråt slås varje sak på och av i barnets kort. Rapporterna,
     som förut var ett eget val, är en av dem. Spärren ligger i
     databasen: barnets funktioner lämnar inte ut det som är av. Listan
     (BARN_FÅR) står i samma ordning som intern.barn_behorigheter_alla()
     och förvalet som kolumnens; verktyg/kolla-behorigheter.py jämför
     dem. Utan mina_barns_behorigheter() i databasen ritas rapportvalet
     som förut.
     ============================================================ */
  const BI_NAMN = /^[a-z0-9._-]{3,20}$/;
  /* boka (barnet_foreslar_pass, 2026-10-12): barnet föreslår pass, som
     ni ser först, ändrar om ni vill och skickar vidare. Av som förval. */
  const BARN_FÅR = [
    ['pass', 'Se sina pass', 'Kommande och genomförda pass, och hur många.'],
    ['boka', 'Föreslå pass', 'Förslagen kommer till er först. Ni ser priset, kan ändra tiden och skickar dem vidare, eller låter bli.'],
    ['studieplan', 'Se studieplanen', 'Planen som studiehjälparen skriver.'],
    ['rapporter', 'Läsa rapporterna', 'Vad studiehjälparen skrev efter varje pass.'],
    ['nexlax', 'Göra NexLäx', 'Nivåerna och uppgifterna mellan passen, och bocken på en uppgift.'],
    ['meddelanden', 'Se notiserna från Nextrum', 'När ett pass bekräftas, flyttas, avbokas eller är klart.'],
    ['chatt', 'Skriva till studiehjälparen', 'En egen tråd, som ni kan läsa under Meddelanden.']
  ];
  const BARN_FÅR_FÖRVAL = ['chatt', 'meddelanden', 'nexlax', 'pass', 'studieplan'];
  S.barnkonton = null;
  S.barnEpost = null;
  S.barnFår = null;
  S.biÖppen = {};

  async function laddaBarnkonton() {
    const ruta = $('#bi-ruta');
    if (!ruta) return;
    const [{ data, error }, epost, får] = await Promise.all([
      supa.rpc('mina_barnkonton'), supa.rpc('mina_barns_epost'), supa.rpc('mina_barns_behorigheter')]);
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
    /* Barnets e-post är ett tillägg: utan funktionen (barnets_epost inte
       körd) eller med ett fel ritas inloggningen som förut. */
    if (epost.error || !epost.data) {
      if (epost.error && epost.error.code !== 'PGRST202' && epost.error.code !== '42883') {
        console.warn('mina_barns_epost:', epost.error.message);
      }
      S.barnEpost = null;
    } else {
      S.barnEpost = { pa: !!epost.data.pa, per: {} };
      (epost.data.barn || []).forEach(r => { S.barnEpost.per[r.barn_id] = r; });
    }
    /* Vad barnen får, likaså ett tillägg: utan funktionen
       (barnets_behorigheter inte körd) står rapportvalet som förut. */
    if (får.error || !får.data) {
      if (får.error && får.error.code !== 'PGRST202' && får.error.code !== '42883') {
        console.warn('mina_barns_behorigheter:', får.error.message);
      }
      S.barnFår = null;
    } else {
      S.barnFår = {};
      (får.data.barn || []).forEach(r => { S.barnFår[r.barn_id] = r.behorigheter || []; });
      /* Bara de val databasen har: före barnet_foreslar_pass finns inte
         boka, och en ruta databasen nekar är ett fel för föräldern. */
      S.barnFårAlla = Array.isArray(får.data.alla) ? får.data.alla : null;
    }
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
      biFårVal(b),
      biEl('label', { class: 'bi-ja' },
        biEl('input', { type: 'checkbox', 'data-bi-ja': true }),
        biEl('span', {},
          'Jag är vårdnadshavare för ' + namn + ' och godkänner att ' + namn + ' använder Nextrum. ',
          biEl('a', { href: '/integritetspolicy#barn', target: '_blank', rel: 'noopener' },
            'Så hanterar vi barnens uppgifter'))),
      biEl('div', { class: 'vy-knapprad' },
        biEl('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Skapa inloggning')));
  }

  /* De val databasen känner. */
  const barnFårVal = () => BARN_FÅR.filter(([sak]) => !S.barnFårAlla || S.barnFårAlla.includes(sak));

  /* Kryssrutorna när inloggningen skapas: förvalet ikryssat. Bara när
     databasen kan spara dem. */
  function biFårVal(b) {
    if (!S.barnFår) return null;
    return biEl('fieldset', { class: 'bi-far-val' },
      biEl('legend', {}, 'Vad får ' + b.name + ' se och göra?'),
      ...barnFårVal().map(([sak, rubrik, under]) => biEl('label', { class: 'bi-ja bi-far-ny' },
        biEl('input', { type: 'checkbox', 'data-bi-far-ny': sak, checked: BARN_FÅR_FÖRVAL.includes(sak) }),
        biEl('span', {}, biEl('b', {}, rubrik), ' ', under))),
      biEl('p', { class: 'xsmall bi-hjalp' },
        b.name + ' kan aldrig avboka eller se priser och betalningar, och ett pass ' + b.name
          + ' föreslår går till er först. Ni kan ändra valen när ni vill.'));
  }

  /* På och av för varje sak, i barnets kort. */
  function biFår(b) {
    const har = S.barnFår[b.id] || [];
    return biEl('div', { class: 'bi-far' },
      biEl('p', { class: 'bi-epost-rubrik' }, 'Vad ' + b.name + ' får se och göra'),
      ...barnFårVal().map(([sak, rubrik, under]) => {
        const på = har.includes(sak);
        return biEl('div', { class: 'nx-nval' },
          biEl('div', { class: 'nx-nval-text' }, biEl('b', {}, rubrik), biEl('span', { class: 'xsmall' }, under)),
          biEl('button', { class: 'chip', type: 'button', 'data-bi-far': b.id + ':' + sak,
            'aria-pressed': på ? 'true' : 'false', 'aria-label': rubrik + ': ' + (på ? 'på' : 'av') },
            på ? 'På' : 'Av'));
      }));
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
      S.barnFår ? biFår(b) : biEl('div', { class: 'nx-nval bi-rapporter' },
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
        biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-bort': b.id }, 'Ta bort inloggningen')),
      biEpost(b)
    ];
  }

  /* Barnets egen e-post, under inloggningen. */
  function biEpost(b) {
    const be = S.barnEpost;
    if (!be) return null;
    const e = be.per[b.id] || {};
    const har = !!e.epost;
    if (!be.pa && !har) return null;
    const namn = b.name;
    const öppen = S.biÖppen[b.id] === 'epost';
    const delar = [biEl('p', { class: 'bi-epost-rubrik' }, 'E-post för ' + namn)];

    if (har) {
      delar.push(biEl('dl', { class: 'bi-fakta' },
        biEl('dt', {}, 'Adress'), biEl('dd', {}, e.epost),
        biEl('dt', {}, 'Läge'), biEl('dd', {},
          e.bekraftad ? 'Bekräftad ' + biNär(e.bekraftad)
            : e.gammal ? 'Inte bekräftad. Länken har gått ut; skicka en ny.'
              : 'Väntar på att ' + namn + ' trycker på länken i mejlet. Skickad ' + biNär(e.skickad) + '.')));
      if (e.bekraftad && be.pa) {
        const på = !!e.notiser;
        delar.push(biEl('div', { class: 'nx-nval bi-epost-mejl' },
          biEl('div', { class: 'nx-nval-text' },
            biEl('b', {}, 'Mejl till ' + namn),
            biEl('span', { class: 'xsmall' }, på
              ? namn + ' får ett mejl när ett pass bokas eller avbokas, och en påminnelse före passet. '
                + namn + ' kan välja bort dem i sin vy.'
              : 'Av: inga mejl går till ' + namn + '. Adressen fungerar ändå för att logga in.')),
          biEl('button', { class: 'chip', type: 'button', 'data-bi-epost-mejl': b.id,
            'aria-pressed': på ? 'true' : 'false' }, på ? 'På' : 'Av')));
      }
    }
    if (be.pa && (öppen || !har)) delar.push(biEpostForm(b, har));

    const knappar = [];
    if (har && be.pa && !e.bekraftad) {
      knappar.push(biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-epost-igen': b.id },
        'Skicka länken igen'));
    }
    if (har && be.pa && !öppen) {
      knappar.push(biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-epost-byt': b.id },
        'Byt adress'));
    }
    if (har) {
      knappar.push(biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-epost-bort': b.id },
        'Ta bort adressen'));
    }
    if (knappar.length) delar.push(biEl('div', { class: 'vy-knapprad bi-knappar' }, ...knappar));
    return biEl('div', { class: 'bi-epost' }, ...delar);
  }

  function biEpostForm(b, byt) {
    return biEl('form', { class: 'bi-form', 'data-bi-epostform': b.id, novalidate: true },
      biFält('bi-epost-' + b.id, byt ? 'Ny adress' : 'Barnets e-post (valfri)',
        biEl('input', { class: 'inp', id: 'bi-epost-' + b.id, 'data-bi-epost': true, type: 'email',
          autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', inputmode: 'email', maxlength: 254 }),
        'Barnets egen adress, inte din. ' + b.name + ' kan logga in med den, och får mejl om sina pass om ni slår på det. '
          + 'Vi skickar en länk dit som ' + b.name + ' trycker på först; tills dess används adressen inte. '
          + 'Lösenordet är detsamma, och det styr ni.'),
      biEl('p', { class: 'xsmall bi-hjalp' },
        biEl('a', { href: '/integritetspolicy#barn', target: '_blank', rel: 'noopener' }, 'Så hanterar vi barnens uppgifter')),
      biEl('div', { class: 'vy-knapprad' },
        biEl('button', { class: 'btn btn-primary btn-sm', type: 'submit' },
          byt ? 'Byt och skicka länken' : 'Lägg till och skicka länken'),
        byt ? biEl('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bi-epost-byt': b.id }, 'Avbryt') : null));
  }

  /* Databasens egna besked (barnets_epost) är skrivna för föräldern och
     visas som de är; annat går genom felText. */
  function biEpostFel(error) {
    return /^(P0001|22023|55000|42501)$/.test(String(error && error.code || ''))
      ? String(error.message || '') : 'Kunde inte spara: ' + felText(error);
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
          /* Valen läses innan formuläret ritas om. */
          const valda = S.barnFår ? NX.$$('[data-bi-far-ny]', form).filter(x => x.checked).map(x => x.dataset.biFarNy) : null;
          const svar = await barnkontoAnrop({ atgard: 'skapa', barn_id: barn.id, anvandarnamn,
            losenord: k.lösen, vardnadshavare_godkand: true });
          if (!svar.ok) { säg(msg, svar.text, false); return; }
          /* Vad barnet får sparas när inloggningen finns: utan den har
             barnet inga val (barn_behorigheter_satt svarar 55000). Bara
             när föräldern ändrat förvalet. */
          let valFel = null;
          if (valda && valda.slice().sort().join() !== BARN_FÅR_FÖRVAL.join()) {
            const { error } = await supa.rpc('barn_behorigheter_satt', { p_barn: barn.id, p_lista: valda });
            if (error) valFel = biEpostFel(error);
          }
          await laddaBarnkonton();
          säg(msg, valFel
            ? 'Inloggningen är skapad, men valen om vad ' + barn.name + ' får sparades inte: ' + valFel
              + ' Ändra dem i ' + barn.name + 's kort nedan.'
            : '✓ ' + barn.name + ' loggar nu in som ' + anvandarnamn + ' på nextrum.se/barn.', !valFel);
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
        return;
      }
      if (form.matches('[data-bi-epostform]')) {
        e.preventDefault();
        rensa(msg);
        const barn = biBarn(form.dataset.biEpostform);
        if (!barn) return;
        const fält = $('[data-bi-epost]', form);
        const epost = fält.value.trim();
        if (!NX.epostOk(epost)) {
          säg(msg, '⚠️ Det ser inte ut som en e-postadress.', false);
          fält.focus();
          return;
        }
        await medan(form.querySelector('button[type="submit"]'), 'Skickar…', async () => {
          const { data, error } = await supa.rpc('barn_epost_satt', { p_barn: barn.id, p_epost: epost });
          if (error) { säg(msg, biEpostFel(error), false); return; }
          delete S.biÖppen[barn.id];
          await laddaBarnkonton();
          säg(msg, data && data.bekraftad
            ? '✓ Adressen är redan bekräftad.'
            : '✓ Vi har skickat en länk till ' + epost.toLowerCase() + '. Be ' + barn.name
              + ' öppna mejlet och trycka på knappen. Länken gäller i sju dagar.', true);
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

      const byt = e.target.closest('[data-bi-epost-byt]');
      if (byt) {
        const id = byt.dataset.biEpostByt;
        if (S.biÖppen[id] === 'epost') delete S.biÖppen[id]; else S.biÖppen[id] = 'epost';
        rensa(msg);
        ritaBarnkonton();
        const fält = $('[data-bi-epostform="' + id + '"] [data-bi-epost]', biRuta);
        if (fält) fält.focus();
        return;
      }

      const igen = e.target.closest('[data-bi-epost-igen]');
      if (igen) {
        const barn = biBarn(igen.dataset.biEpostIgen);
        if (!barn) return;
        rensa(msg);
        await medan(igen, 'Skickar…', async () => {
          const { error } = await supa.rpc('barn_epost_skicka_igen', { p_barn: barn.id });
          if (error) { säg(msg, biEpostFel(error), false); return; }
          await laddaBarnkonton();
          säg(msg, '✓ En ny länk är på väg. Den förra gäller inte längre.', true);
        });
        return;
      }

      const mejl = e.target.closest('[data-bi-epost-mejl]');
      if (mejl) {
        const barn = biBarn(mejl.dataset.biEpostMejl);
        if (!barn) return;
        const på = mejl.getAttribute('aria-pressed') !== 'true';
        rensa(msg);
        await medan(mejl, 'Sparar…', async () => {
          const { error } = await supa.rpc('barn_epost_notiser', { p_barn: barn.id, p_pa: på });
          if (error) { säg(msg, biEpostFel(error), false); return; }
          await laddaBarnkonton();
        });
        return;
      }

      const epostBort = e.target.closest('[data-bi-epost-bort]');
      if (epostBort) {
        const barn = biBarn(epostBort.dataset.biEpostBort);
        if (!barn) return;
        const ja = await bekräfta({
          titel: 'Ta bort ' + barn.name + 's e-post?',
          text: barn.name + ' kan inte längre logga in med adressen, och inga mejl går dit. '
            + 'Användarnamnet fungerar som förut.',
          knapp: 'Ta bort'
        });
        if (!ja) return;
        rensa(msg);
        await medan(epostBort, 'Tar bort…', async () => {
          const { error } = await supa.rpc('barn_epost_ta_bort', { p_barn: barn.id });
          if (error) { säg(msg, biEpostFel(error), false); return; }
          delete S.biÖppen[barn.id];
          await laddaBarnkonton();
          säg(msg, '✓ Adressen är borttagen.', true);
        });
        return;
      }

      const fårKnapp = e.target.closest('[data-bi-far]');
      if (fårKnapp && S.barnFår) {
        const [id, sak] = fårKnapp.dataset.biFar.split(':');
        const barn = biBarn(id);
        if (!barn) return;
        const på = fårKnapp.getAttribute('aria-pressed') !== 'true';
        const nu = S.barnFår[id] || [];
        const lista = på ? nu.concat(sak) : nu.filter(x => x !== sak);
        rensa(msg);
        await medan(fårKnapp, 'Sparar…', async () => {
          const { data, error } = await supa.rpc('barn_behorigheter_satt', { p_barn: id, p_lista: lista });
          if (error) { säg(msg, biEpostFel(error), false); return; }
          S.barnFår[id] = (data && data.behorigheter) || lista;
          ritaBarnkonton();
        });
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
          text: 'Användarnamnet, e-posten om ni lagt till en, och notiserna i barnets vy tas bort, och ' + barn.name
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
     barnets årskurs när ingen är vald. spar är vägen eller sektionen
     inför nationella provet (2026-10-06). */
  function nlBana() {
    const val = S.banaVal[S.valtBarn] || {};
    const finns = U.banor(S.katalog || []);
    const barn = valtBarnet();
    const given = (S.laxor || []).find(h => h.niva_id && h.status !== 'klar' && h.nivaer);
    const amne = (val.amne && finns[val.amne]) ? val.amne
      : ((barn && barn.subjects) || []).find(a => finns[a])
        || (given && finns[given.nivaer.amne] ? given.nivaer.amne : null)
        || (finns.Matematik ? 'Matematik' : null);
    return { amne, arskurs: val.arskurs || '', spar: val.spar || 'vag' };
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
    ritaNexlaxFlikar();
  }

  /* Rank och Märken (2026-10-13) har egna flikar, studiehjälparen är en
     del av Din utveckling, och barnets NexLäx-profil står under Profil → Barn. De ritas ur samma
     underlag som vägen. */
  function ritaNexlaxFlikar() {
    if (!S.valtBarn || !S.nl.laddad) return;
    const u = nlUnderlag();
    const rita = (id, fn, extra) => { const host = $(id); if (host) fn(Object.assign({}, u, { host }, extra || {})); };
    rita('#nl-rank', U.ritaRank);
    rita('#nl-marken', U.ritaMärken);
    rita('#nl-profil', U.ritaProfil, { länk: true });
  }

  function ritaVägen() {
    const host = $('#nl-vag');
    if (!host) return;
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }
    if (!S.nl.laddad || !S.laxorLaddade) return;
    const b = nlBana();
    const ut = U.ritaVäg(Object.assign(nlUnderlag(), {
      host, amne: b.amne, arskurs: b.arskurs, spar: b.spar, nyss: S.nl.nyss,
      hjälpare: S.tutor ? { namn: S.tutor.full_name } : null
    }));
    /* Det som just klarades eller öppnades rör sig en gång, sedan inte. */
    S.nl.nyss = null;
    if (ut && ut.amne && !(S.banaVal[S.valtBarn] || {}).amne) S.banaVal[S.valtBarn] = { amne: ut.amne, arskurs: '', spar: 'vag' };
  }

  function ritaNexlaxUtveckling() {
    const host = $('#nl-utveckling');
    if (!host) return;
    if (!S.valtBarn) { host.innerHTML = tomt('Inget barn valt', 'Lägg till ditt barn under Profil & inställningar.'); return; }
    if (!S.nl.laddad) return;
    const b = nlBana();
    U.ritaUtveckling(Object.assign(nlUnderlag(), {
      host, alla: S.nl.alla, amne: b.amne, arskurs: b.arskurs, väntar: !!S.väntar,
      hjälpare: S.tutor ? { namn: S.tutor.full_name } : null
    }));
  }

  /* Ämnet, årskursen och en nod på vägen. Vägen ritas om, så knappen
     man tryckte på är en ny: den mäts före och efter och sidan flyttas
     med skillnaden, som NXStudie.håll gör för ett element som står
     kvar. Annars hade ett kort som stängs ovanför flyttat noden under
     fingret. */
  function ritaOchHåll(sel, fn, fokus) {
    const före = $(sel);
    const y = före ? före.getBoundingClientRect().top : null;
    fn();
    const ny = $(sel);
    if (ny && y !== null) {
      const efter = ny.getBoundingClientRect().top;
      if (Math.abs(efter - y) > 1) NXStudie.scrollaTill(window.scrollY + efter - y);
      const f = fokus ? $(fokus) : ny;
      if (f) f.focus({ preventScroll: true });
    }
  }
  /* Väljaren (2026-10-06): ett ämne, en årskurs eller en genväg byter
     bana, och NP-knappen byter mellan vägen och sektionen inför
     provet. Väljaren hålls still, inte knappen: en genväg till en annan
     bana finns inte kvar när den banan är vald. */
  function väljBana(val, fokus) {
    S.banaVal[S.valtBarn] = val;
    ritaOchHåll('#nl-vag .nl-baner', ritaVägen, fokus);
  }
  document.addEventListener('click', e => {
    const host = $('#nl-vag');
    const nu = S.banaVal[S.valtBarn] || {};
    const amne = e.target.closest('#nl-vag [data-nl-amne]');
    if (amne) {
      const ak = amne.dataset.nlAk || '';
      väljBana({ amne: amne.dataset.nlAmne, arskurs: ak, spar: nu.spar || 'vag' },
        '#nl-vag .nl-amne[data-nl-amne="' + CSS.escape(amne.dataset.nlAmne) + '"]');
      return;
    }
    const ak = e.target.closest('#nl-vag [data-nl-ak]');
    if (ak) {
      väljBana({ amne: host ? host.dataset.amne : '', arskurs: ak.dataset.nlAk, spar: nu.spar || 'vag' },
        '#nl-vag .nl-ak-knapp[data-nl-ak="' + CSS.escape(ak.dataset.nlAk) + '"]');
      return;
    }
    const spar = e.target.closest('#nl-vag [data-nl-spar]');
    if (spar) {
      S.banaVal[S.valtBarn] = { amne: host ? host.dataset.amne : '', arskurs: host ? host.dataset.arskurs : '', spar: spar.dataset.nlSpar };
      ritaOchHåll('#nl-vag .nl-spar', ritaVägen, '#nl-vag [data-nl-spar="' + CSS.escape(spar.dataset.nlSpar) + '"]');
      return;
    }
    /* En prick på vägen öppnar sitt kort på plats, i NXUppgifter (växlaNod):
       vägen ritas inte om av ett tryck. */
    const alla = e.target.closest('[data-nl-alla]');
    if (alla) {
      const öppnar = !S.nl.alla;
      if (öppnar) { S.nl.alla = true; ritaNexlaxUtveckling(); }
      else ritaOchHåll('[data-nl-alla]', () => { S.nl.alla = false; ritaNexlaxUtveckling(); });
    }
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
        S.nl.nyss = { klar: ut.klar, oppen: ut.oppen, del: ut.del };
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
    const alla = passetsBarn(b);
    if (alla.length > 1) return 'med ' + NXStudie.listaOrd(alla);
    const barn = S.barn.find(x => x.id === b.student_id);
    return barn && barn.name ? 'med ' + String(barn.name).trim().split(/\s+/)[0] : '';
  }

  /* Barnens förnamn på ett pass med extra barn (bokning_barn), huvudbarnet
     först. Ett pass utan extra barn svarar med en tom lista. */
  function passetsBarn(b) {
    const rader = S.passBarn[b.id] || [];
    return rader.slice().sort((x, y) => (y.ar_huvudbarn ? 1 : 0) - (x.ar_huvudbarn ? 1 : 0))
      .map(r => { const x = S.barn.find(c => c.id === r.barn_id); return x && x.name ? String(x.name).trim().split(/\s+/)[0] : 'Ett barn'; });
  }

  /* ============================================================
     SYSKONTILLÄGGET SOM SKULD (syskontillagg_som_skuld, 2026-10-21)

     Leo: "Tillägget blir en skuld på familjen när passet är hållet.
     Familjen kan betala skulden när hen vill under Betalningar, eller så
     läggs den som en egen rad i nästa betalning". Läget kommer ur
     mitt_tillagg(): strömbrytaren, villkorens version och familjens ja,
     gränserna, skulden, det som står i en betalning och spärren. Inget
     belopp räknas här: databasen frös det när passet bokades.
     ============================================================ */
  async function laddaSyskon() {
    const [{ data, error }, rader] = await Promise.all([
      supa.rpc('mitt_tillagg'),
      supa.from('bokning_barn').select('bokning_id, barn_id, ar_huvudbarn')
    ]);
    S.syskon = error ? null : (data || null);
    S.passBarn = {};
    if (!rader.error) (rader.data || []).forEach(r => { (S.passBarn[r.bokning_id] = S.passBarn[r.bokning_id] || []).push(r); });
    ritaSyskonskuld();
    ritaNotiser();
    if (S.laddatPass) ritaAttBetala();
  }

  /* Bokningsytans läge: null när strömbrytaren är av. */
  function syskonLäge() {
    const t = S.syskon;
    if (!t || !t.pa) return null;
    const max = Number(t.max_upplupet_ore) || 0, dagar = Number(t.sparr_efter_dagar) || 0;
    return {
      pa: true,
      huvud: S.valtBarn,
      barn: (S.barn || []).map(b => ({ id: b.id, namn: String(b.name || 'Barn').trim().split(/\s+/)[0] })),
      version: t.version,
      godkand: !!t.godkand_at,
      sparr: t.sparr || null,
      sparrText: t.sparr === 'belopp'
        ? 'Extra barn går inte att boka just nu: det obetalda tillägget är över ' + NXBetalning.kronor(max) + '. Betala det under Betalning, så lyfts spärren.'
        : t.sparr === 'alder'
          ? 'Extra barn går inte att boka just nu: ett tillägg har varit obetalt i mer än ' + dagar + ' dagar. Betala det under Betalning, så lyfts spärren.'
          : null,
      maxOre: max, sparrDagar: dagar,
      senTimmar: Number(t.sen_avbokning_timmar) || 0,
      debitera: !!t.debitera_vid_sen_avbokning,
      obligatorisk: !!t.obligatorisk
    };
  }

  /* Tillägget för passets syskon, som posten står: efter passet, att betala
     eller betalt. Bara de poster mitt_tillagg() lämnar (inte avslutade). */
  function syskonTillägg(b) {
    const p = S.syskon ? (S.syskon.poster || []).find(x => x.bokning === b.id) : null;
    if (!p) return '';
    const k = NXBetalning.kronor(p.belopp_ore);
    return p.status === 'bokad' ? ' · tillägg ' + k + ', som skuld efter passet'
      : p.status === 'upplupen' ? ' · tillägg ' + k + ' att betala'
      : ' · tillägg ' + k + ', betalning pågår';
  }

  async function godkännSyskon(version) {
    const { error } = await supa.rpc('godkann_tillaggsvillkor', { p_version: version });
    if (error) return 'Villkoren gick inte att godkänna: ' + felText(error);
    await laddaSyskon();
    return null;
  }

  /* Kortet Upplupet tillägg under Betalning: beloppet, ett pass per rad
     (dagen, extra barn och beloppet) och Betala tillägg nu. Står en
     betalning redan öppen säger kortet det i stället för knappen, och en
     spärr står som en egen rad. Utan skuld och utan spärr syns inget. */
  function ritaSyskonskuld() {
    const host = $('#bet-tillagg');
    if (!host) return;
    const t = S.syskon;
    const upplupna = t ? (t.poster || []).filter(p => p.status === 'upplupen') : [];
    const pågår = t ? Number(t.i_betalning) || 0 : 0;
    if (!t || (!upplupna.length && !pågår && !t.sparr)) { host.hidden = true; host.innerHTML = ''; return; }
    const kronor = NXBetalning.kronor;
    const dag = p => { const d = new Date(p.start); return isNaN(d) ? '' : datumText(isoFor(d)); };
    const banner = (klass, rubrik, text) => '<div class="bet-tillagg-banner ' + klass + '" role="status"><b>'
      + esc(rubrik) + '</b><span>' + esc(text) + '</span></div>';
    host.hidden = false;
    host.innerHTML =
      (t.sparr ? banner('ar-sparr', 'Extra barn är spärrat', syskonLäge() ? syskonLäge().sparrText
        : 'Det obetalda tillägget är för stort eller för gammalt. Betala det, så lyfts spärren.') : '')
      + (pågår ? banner('ar-pagar', 'En betalning pågår redan', 'Kassan för ' + (pågår === 1 ? '1 pass' : pågår + ' pass')
        + ' med tillägg är öppen. Betalar ni inte går den ut efter 30 minuter, och tillägget står kvar här.') : '')
      + (upplupna.length
        ? '<article class="bet-tillagg-kort">'
          + '<div class="bet-tillagg-topp"><div><small>Upplupet tillägg</small><b>' + esc(kronor(t.upplupet_ore)) + '</b></div>'
          + '<button type="button" class="btn btn-orange" data-betala-skuld>Betala tillägg nu</button></div>'
          + '<ul class="bet-tillagg-rader" aria-label="Tillägget pass för pass">'
          + upplupna.map(p => '<li><span>' + esc(dag(p)) + '</span><span>'
            + esc(p.extra === 1 ? '1 extra barn' : p.extra + ' extra barn') + '</span><b>' + esc(kronor(p.belopp_ore))
            + '</b></li>').join('')
          + '</ul>'
          + '<p class="bet-tillagg-not">' + esc(t.obligatorisk
            ? 'Betalar ni inte nu följer tillägget med som en egen rad nästa gång ni köper timmar. Inget dras av sig självt.'
            : 'Betalar ni inte nu kan ni ta med tillägget som en egen rad nästa gång ni köper timmar. Inget dras av sig självt.')
          + '</p></article>'
        : '');
  }

  /* Betala tillägg nu: hela det upplupna, i en egen kassa. Köpvillkoren
     först, som för allt annat. */
  async function betalaSkulden(knapp) {
    const t = S.syskon;
    if (!t || !(Number(t.upplupet_ore) > 0)) return;
    const n = Number(t.upplupna) || 0;
    if (!await NXStudie.kassansVillkor({
      titel: 'Betala tillägget',
      rader: ['Upplupet tillägg för extra barn, ' + (n === 1 ? '1 pass' : n + ' pass') + ' · ' + NXBetalning.kronor(t.upplupet_ore)],
      text: 'Ni betalar med kort eller Klarna i nästa steg. Rabattkoder gäller inte tillägget.'
    })) return;
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKassa({ skuld: true, retur: location.origin, ui: 'inbaddad', villkor: true });
      if (!svar) { laddaSyskon().catch(() => {}); return; }
      const vad = 'Upplupet tillägg för extra barn, ' + (svar.antal_pass === 1 ? '1 pass' : svar.antal_pass + ' pass')
        + ' · ' + NXBetalning.kronor(svar.belopp_ore);
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try {
            await öppnaKassa(knapp, null, svar, Stripe, { titel: 'Betala tillägget', vad: vad, sort: 'skuld', klar: skuldenBetald });
            return;
          } catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKassa({ skuld: true, retur: location.origin, ui: 'sida', villkor: true });
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  function skuldenBetald() {
    const p = panel;
    if (!p) return;
    p.klar = true;
    p.besked.textContent = '✓ Tack! Tillägget är betalt. Det kan ta en liten stund innan det syns här, och kvittot kommer med mejl.';
    p.besked.hidden = false;
    setTimeout(() => { laddaSyskon().catch(() => {}); }, 2500);
    setTimeout(() => { laddaSyskon().catch(() => {}); }, 8000);
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
      dag: 'forslag',
      atgarder: svarsKnappar(b, true)
    }));

    /* Barnens förslag (barnet_foreslar_pass): familjens drag, för inget
       går till studiehjälparen förrän föräldern skickat det. Raden leder
       till förslaget i bokningen. */
    const barnens = S.väntar ? [] : (S.bf.lista || []);
    barnens.forEach(f => rader.push(NXStudie.radLank({
      href: '#boka/forslag-' + f.id, ikon: 'forslag',
      titel: barnetsNamn(f.barn_id) + ' föreslår ett pass',
      meta: [bfNär(f), [f.amne, NXStudie.längdText(f.langd_min)].filter(Boolean).join(', ')],
      lank: 'Granska'
    })));

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

    /* Det som ska betalas (2026-10-21): bekräftade och genomförda pass
       som inte är betalda, och tillägg. Räknas först när passen finns. */
    const betala = S.laddatPass ? attBetala() : [];
    if (betala.length) {
      const summa = betala.reduce((n, b) => { const t = tillägg(b); return n + ((t ? t.belopp : passetsPris(b)) || 0); }, 0);
      rader.push(NXStudie.radLank({
        href: '#betalning', ikon: 'kort',
        titel: betala.length === 1 ? 'Ett pass att betala' : betala.length + ' pass att betala',
        meta: [summa ? NXBetalning.kronor(summa) : null, 'Kort eller Klarna'],
        lank: 'Betala nu'
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

    /* Före matchningen (2026-10-07): vårt drag, men det första man ska
       se, och vägen till det som går att göra så länge. Utan barn är
       det att lägga till barnet. Räknas inte i siffran: det är inget
       familjen ska göra något åt. Texten är EN meta-bit (2026-10-12):
       som två stod halvorna av meningen bredvid varandra med ett glapp
       på datorn och på var sin rad, den andra med liten bokstav, på en
       telefon. */
    if (S.väntar) {
      const barn = (S.barn || []).length;
      rader.unshift(NXStudie.radLank({
        href: barn ? '#nexlax' : '#profil/barn', ikon: 'vem', ton: 'ockra',
        titel: 'Vi letar studiehjälpare åt er',
        meta: ['Vi hör av oss när det är klart, och då öppnas bokningen. '
          + (barn ? 'Under tiden kan ni prova NexLäx.' : 'Under tiden kan ni lägga till barnet.')],
        lank: barn ? 'Till NexLäx' : 'Lägg till barnet'
      }));
    }

    /* Dold, inte tom: en ruta som står kvar och säger "inget att
       göra" tar plats överst varje gång man öppnar vyn. */
    grupp.hidden = !rader.length;
    const antal = föreslagna.length + barnens.length + avslagna.length + betala.length + sena.length;
    $('#ov-gora-antal').textContent = antal ? String(antal) : '';
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
          dag: dagTon(b),
          lage: förslagsMärke(b),
          märke: passMärke(b)
        })).join('')
      : tomt('Inga kommande pass', S.väntar
        ? 'När vi matchat er med en studiehjälpare bokar ni under Boka pass, och passet står här.'
        : 'Boka en tid under Boka pass, så står passet här.');
  }

  /* ============================================================
     RAPPORTERNA

     Bekräfta rapport (Fas 19.1, 2026-09-27) var en egen post i menyn där
     familjen läste rapporten, bekräftade den och betalade ett obetalt pass.
     Den togs bort 2026-10-21 (Leo: "bekräfta rapport kan tas bort"):
     familjen betalar med Betala nu när tiden är bekräftad, eller efteråt
     under Betalning, och läser rapporten på passets sida.
     ============================================================ */
  S.rb = { rapporter: [], laddat: false };

  /* Rapporterna, för passets sida och Mina lektioner. Bekräfta rapport
     (Fas 19.1 till 2026-10-21) är borta, Leo 2026-10-21: "bekräfta rapport
     kan tas bort". Familjen betalar med Betala nu och läser rapporten på
     passet; rapport_bekraftelser står kvar i databasen som historik. */
  async function laddaRapporterna() {
    const barn = (S.barn || []).map(x => x.id);
    if (!barn.length) { S.rb.rapporter = []; S.rb.laddat = true; return; }
    const rap = await supa.from('lesson_reports')
      .select('id, booking_id, student_id, tutor_id, lesson_date, amne, gick, ai_feedback, raw_notes, needs_practice, next_focus, start_tid, slut_tid, debiterade_min, avvikelse_skal')
      .in('student_id', barn).order('lesson_date', { ascending: true });
    if (rap.error) { console.warn('Rapporterna gick inte att läsa', rap.error); return; }
    S.rb.rapporter = rap.data || [];
    S.rb.laddat = true;
    if (passIdIAdressen()) ritaPassSida();
  }

  const rbPass = r => (r.booking_id && (S.bokningar || []).find(b => b.id === r.booking_id)) || null;
  /* Rapporten till ett genomfört pass, för passets sida. */
  function rapportFörPass(passId) {
    const b = (S.bokningar || []).find(x => x.id === passId);
    if (!b || b.status !== 'completed') return null;
    return S.rb.rapporter.find(r => r.booking_id === passId) || null;
  }

  /* Det som väntar på att betalas (2026-10-21): bekräftade pass som inte
     är betalda, genomförda som inte är betalda, och tillägg för ett pass
     som drog över. Samma urval för Betalning, siffran i menyn, Att göra
     och notisrutan. Leo: familjen betalar "när man fått de bekräftat att
     man kan boka lektionen". */
  const attBetala = () => {
    const nyckel = b => String(b.wanted_date || '') + String(b.wanted_time || '');
    return (S.bokningar || []).filter(b => kanBetalas(b) || tillägg(b))
      .sort((a, c) => nyckel(a).localeCompare(nyckel(c)));
  };

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
        plats,
        // Ett pass med syskon (syskontillagg_som_skuld): rapporten gäller alla barnen.
        b && passetsBarn(b).length > 1 ? 'Barn på passet: ' + NXStudie.listaOrd(passetsBarn(b)) : null],
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
    return '<button type="button" class="btn btn-orange' + (liten ? ' btn-sm' : '') + '" data-tillagg="' + esc(b.id) + '">'
      + 'Betala nu' + (till.belopp && !liten ? ', ' + esc(NXBetalning.kronor(till.belopp)) : '') + '</button>';
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
     vyn hade inte erbjudit någon betalning.

     Sedan Fas 19.2 kan spärren inte slås på: villkoren låter familjen
     betala efter passet, och databasen nekar flaggan (flaggor_kortsparr_av).
     Grenen står kvar för den dag villkoren ändras tillbaka. */
  function kanBetalas(b) {
    if (b.fakturerbar === false || ingetAttBetala(b)) return false;
    /* Kortet reserveras (2026-10-13): ett pass som kortet betalar väntar
       inte på familjen, och knapparna för att betala står inte där. */
    if (kortBetalar(b)) return false;
    if (OBETALDA.indexOf(b.betalning_status || 'ingen') === -1) return false;
    // Sen avbokning (2026-10-22): avgiften betalas med Betala nu.
    if (b.status === 'cancelled') return senAvgift(b) > 0;
    if (b.status === 'completed') return true;
    if (b.status !== 'confirmed') return false;
    return b.wanted_date >= isoFor(new Date()) || S.kortsparr === true;
  }

  /* Spärren läses en gång, före passen. Kan flaggan inte läsas räknas
     den som av, som i studiehjälparvyn: databasen är skyddet, och av
     betyder bara att ett passerat pass väntar på rapporten i stället
     för att erbjudas till betalning. */
  async function laddaSparr() {
    /* Fakturavalet (faktura_mojlig) och obetalda_fran lästes här från Fas
       14.6 till 2026-10-21, då fakturan togs bort. */
    const flagga = await supa.from('flaggor').select('aktiv').eq('kod', 'kortsparr').maybeSingle();
    S.kortsparr = !!(flagga.data && flagga.data.aktiv);
  }

  /* ============================================================
     TIPSA EN FAMILJ (2026-09-30)

     Koden och timmarna för tips, under Profil → Tipsa en familj. Läses
     före passen och bokningen: förslaget visar i förväg om en timme
     är på köpet, och databasen avgör (forsta_timmen_bjuds). Ett pass
     med tipstimmen bär rabattkod TIPS och startrabatt, så det betalas
     som passet med första timmen: sedan timmarna_delas (2026-10-14)
     betalar köpta timmar resten av det, och förut gjorde kortet det.

     Sedan 2026-10-13 står timmarna i timbanken (Leo: "timmarna läggs
     in i timbanken för familjerna"), i Er timbank och under Profil →
     Timbanken. De gäller i 60 dagar från att de tjänades in och dras
     först, före köpta timmar (gratistimmarna_60_dagar): kvar är de som
     gäller i dag, och kvar_till den sista dagen.
     ============================================================ */
  async function laddaTips() {
    S.tips = await NXStudie.tipsa({ host: $('#tips-ruta'), supa: supa, roll: 'parent' });
    /* Timbanken ritas om med timmarna för tips när svaret kommit, men
       först när köpen är hämtade: annars hade "inga köpta timmar" blinkat
       förbi för en familj som har dem. Kommer tipsen först ritar
       laddaErbjudanden med dem. */
    if (S.erb.rorelser !== undefined) {
      ritaTillgängliga();
      ritaTimbankTimmar();
    }
  }

  /* Tipstimmarna som ett kort i timbanken, som ett köp: hur många som
     gäller av de intjänade, till vilken dag, och under Profil →
     Timbanken passen de använts till. */
  function tipsKort(medPass) {
    const t = S.tips;
    const tim = t ? Number(t.timmar || 0) : 0;
    if (!tim) return '';
    const kvar = Number(t.kvar || 0);
    const pass = medPass ? (S.bokningar || []).filter(b => b.rabattkod === 'TIPS' && b.status !== 'cancelled')
      .sort((a, b) => String(a.wanted_date).localeCompare(String(b.wanted_date))) : [];
    const idag = isoFor(new Date());
    const till = kvar && t.kvar_till ? (kvar === 1 ? 'Gäller till ' : 'Den sista gäller till ') + datumText(t.kvar_till)
      : kvar ? 'Kvar' : Number(t.anvanda || 0) >= tim ? 'Använda' : 'Inga kvar';
    return '<div class="erb-mitt' + (kvar ? '' : ' ar-slut') + '">'
      + '<div class="erb-mitt-topp"><b>Timmar för tips</b><span>' + esc(till) + '</span></div>'
      + mätare(0, kvar, tim, kvar + ' av ' + tim + ' timmar kvar')
      + '<span class="erb-kvar"><b>' + kvar + '</b> av ' + tim + ' ' + (tim === 1 ? 'timme' : 'timmar') + ' kvar</span>'
      + '<p class="erb-bank-text">En timme för varje ny familj som anmält sig med er kod och haft två timmar läxhjälp. '
      + 'Den gäller i 60 dagar och dras först, som en timme på köpet på nästa pass.</p>'
      + (pass.length ? '<ul class="tb-rorelser">' + pass.map(b => '<li><span>' + esc(passNamn(b.id, b.wanted_date))
          + (b.status === 'requested' ? ', föreslaget' : b.status !== 'completed' && String(b.wanted_date) >= idag ? ', kommande' : '')
          + '</span><span class="tb-min ut">−1 timme</span></li>').join('') + '</ul>' : '')
      + '</div>';
  }
  const påKöpet = b => b && b.rabattkod === 'TIPS' ? 'en timme på köpet för ert tips' : 'första timmen på köpet';

  /* ============================================================
     BETYGSGARANTIN UNDER PROFIL (2026-10-07)

     Leo: anmälan ska vara smidigare än ett mejl. Föräldern väljer
     ämnena, högst tre per elev och läsår, och anger elevens nuvarande
     betyg i varje. Allt prövas i databasen (anmal_betygsgaranti): de tre
     ämnena, den 31 december, villkoren och att ämnet inte är anmält; vyn
     ritar bara det som finns och visar databasens svar. Saknas tabellen
     (migrationen inte körd) säger rutan att anmälan inte gick att hämta.

     Läsåret är året det börjar, svensk tid: anmälan är öppen 1 juli till
     31 december och gäller läsåret som börjar den hösten.

     Ämnena har ett eget betyg i skolan, till skillnad från vyns grupper
     (NX.GARANTI_AMNEN och intern.betygsgaranti_amnen() ändras tillsammans).

     En anmälan är låst när den är gjord (Leo: "spärr, bara vi kan ändra
     den"): rutan har ingen knapp för att ändra, och databasen ingen väg
     för familjen. Har vi rättat den står det när, ur andrad_at; vem hos
     oss som gjorde det läser ingen inloggad.
     ============================================================ */
  const GARANTI_BETYG = ['F', 'E', 'D', 'C', 'B'];
  const GARANTI_MAX = 3;

  function garantiNu() {
    const delar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: 'numeric' })
      .formatToParts(new Date());
    const år = Number(delar.find(d => d.type === 'year').value);
    const månad = Number(delar.find(d => d.type === 'month').value);
    return { öppen: månad >= 7, läsår: månad >= 7 ? år : år - 1 };
  }
  const läsårText = år => år + '/' + String((år + 1) % 100).padStart(2, '0');

  async function laddaGaranti() {
    const ids = (S.barn || []).map(b => b.id);
    if (!ids.length) { S.garanti = []; ritaGaranti(); return; }
    const { data, error } = await supa.from('betygsgarantier')
      .select('id, student_id, lasar, amne, betyg, anmald_at, andrad_at')
      .in('student_id', ids).order('anmald_at');
    if (error) {
      if (error.code !== 'PGRST205' && error.code !== '42P01') console.warn('betygsgarantier:', error.message);
      S.garanti = null;
    } else {
      S.garanti = data || [];
    }
    ritaGaranti();
  }

  function ritaGaranti() {
    const host = $('#garanti-ruta');
    if (!host || S.garanti === undefined) return;
    if (S.garanti === null) {
      host.innerHTML = '<p class="erb-bank-text">Anmälan gick inte att hämta. Ladda om sidan, eller skriv till oss på '
        + '<a href="mailto:info@nextrum.se">info@nextrum.se</a>.</p>';
      return;
    }
    const intro = '<p class="erb-bank-text">Välj de ämnen ni vill ha garantin i och ange elevens nuvarande betyg i '
      + 'varje. Är villkoren uppfyllda och går betyget inte upp när läsåret slutar, får ni 10 timmar läxhjälp utan '
      + 'kostnad. Anmälan är öppen till och med den 31 december. '
      + '<a href="/anvandarvillkor#betygsgaranti" target="_blank" rel="noopener">Villkoren för betygsgarantin</a></p>'
      + '<p class="erb-bank-text">Vi hjälper självklart till med andra ämnen och med läxorna i stort när ni behöver '
      + 'det, och det påverkar inte garantin. Det är bara tiden i ämnena med garanti som räknas mot garantins två '
      + 'timmar i veckan.</p>';
    if (!(S.barn || []).length) {
      host.innerHTML = intro + '<p class="erb-bank-text">Lägg till ert barn under Barn först.</p>';
      return;
    }
    const nu = garantiNu();
    host.innerHTML = intro + S.barn.map(b => garantiBarn(b, nu)).join('');
  }

  function garantiBarn(b, nu) {
    const rader = S.garanti.filter(g => g.student_id === b.id && g.lasar === nu.läsår);
    let h = '<div class="garanti-barn"><p class="garanti-namn"><b>' + esc(b.name) + '</b>, läsåret '
      + läsårText(nu.läsår) + '</p>';
    const dagen = ts => esc(datumText(isoFor(new Date(ts))));
    if (rader.length) {
      h += '<ul class="tb-rorelser">' + rader.map(g => '<li><span>' + esc(g.amne) + '</span><span>'
        + (g.betyg ? 'betyg ' + esc(g.betyg) + ', ' : '')
        + (g.andrad_at ? 'senast ändrad av oss ' + dagen(g.andrad_at) : 'anmäld ' + dagen(g.anmald_at))
        + '</span></li>').join('') + '</ul>'
        + '<p class="erb-bank-text">Anmälan är låst. Har något blivit fel, skriv till oss så rättar vi det.</p>';
    }
    if (!nu.öppen) {
      h += '<p class="erb-bank-text">' + (rader.length ? '' : 'Inga ämnen anmäldes för läsåret. ')
        + 'Anmälan stängde den 31 december. Från den 1 juli kan ni anmäla till nästa läsår.</p>';
    } else if (rader.length >= GARANTI_MAX) {
      h += '<p class="erb-bank-text">Tre ämnen är anmälda, och det är det högsta för ett läsår.</p>';
    } else {
      h += garantiForm(b, rader);
    }
    return h + '</div>';
  }

  /* Ämnena barnet redan har hjälp med står först: "NO / Fysik / Kemi /
     Biologi" i barnets ämnen lyfter Fysik, Kemi och Biologi. */
  function garantiForm(b, rader) {
    const tagna = rader.map(g => g.amne.toLowerCase());
    const nämnt = a => (b.subjects || []).some(s => String(s).includes(a));
    const kvar = NX.GARANTI_AMNEN.filter(a => !tagna.includes(a.toLowerCase()));
    const ordning = kvar.filter(nämnt).concat(kvar.filter(a => !nämnt(a)));
    const id = 'garanti-' + b.id;
    return '<form class="garanti-form" data-garanti="' + esc(b.id) + '" novalidate>'
      + '<div class="vy-form-rad">'
      + '<div class="fgroup"><label for="' + id + '-amne">Ämne</label>'
      + '<select class="sel" id="' + id + '-amne" data-garanti-amne><option value="">Välj ämne</option>'
      + ordning.map(a => '<option>' + esc(a) + '</option>').join('') + '</select></div>'
      + '<div class="fgroup"><label for="' + id + '-betyg">Nuvarande betyg</label>'
      + '<select class="sel" id="' + id + '-betyg" data-garanti-betyg><option value="">Välj betyg</option>'
      + GARANTI_BETYG.map(x => '<option>' + x + '</option>').join('') + '</select></div>'
      + '</div>'
      + '<p class="xsmall bi-hjalp">Det senaste betyget från skolan i ämnet. Har eleven redan A går ämnet inte att anmäla.</p>'
      + '<label class="bi-ja"><input type="checkbox" data-garanti-ja><span>Jag har läst '
      + '<a href="/anvandarvillkor#betygsgaranti" target="_blank" rel="noopener">villkoren för betygsgarantin</a>'
      + ' och vet att anmälan är låst när den är gjord.</span></label>'
      + '<div class="vy-knapprad"><button class="btn btn-primary btn-sm" type="submit">Anmäl ämnet</button></div>'
      + '</form>';
  }

  const garantiRuta = $('#garanti-ruta');
  if (garantiRuta) {
    garantiRuta.addEventListener('submit', async e => {
      const form = e.target.closest('form[data-garanti]');
      if (!form) return;
      e.preventDefault();
      const msg = $('#garanti-msg');
      rensa(msg);
      const barn = (S.barn || []).find(b => b.id === form.dataset.garanti);
      if (!barn) return;
      const amneFält = $('[data-garanti-amne]', form);
      const betygFält = $('[data-garanti-betyg]', form);
      const amne = amneFält.value;
      const betyg = betygFält.value;
      if (!amne) { säg(msg, '⚠️ Välj ett ämne.', false); amneFält.focus(); return; }
      if (!betyg) { säg(msg, '⚠️ Ange ' + barn.name + 's nuvarande betyg i ' + amne + '.', false); betygFält.focus(); return; }
      if (!$('[data-garanti-ja]', form).checked) {
        säg(msg, '⚠️ Kryssa i att du har läst villkoren för betygsgarantin.', false);
        $('[data-garanti-ja]', form).focus();
        return;
      }
      await medan(form.querySelector('button[type="submit"]'), 'Anmäler…', async () => {
        const { error } = await supa.rpc('anmal_betygsgaranti', { p_elev: barn.id, p_amne: amne, p_betyg: betyg });
        if (error) { säg(msg, felText(error), false); return; }
        await laddaGaranti();
        säg(msg, '✓ ' + amne + ' har betygsgaranti för ' + barn.name + ', läsåret ' + läsårText(garantiNu().läsår) + '.', true);
      });
    });
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
  /* rorelser och dragningar: undefined innan de hämtats, null om de inte
     gick att läsa. dragningar är passen varje kort betalat, per kort-id. */
  /* kod (2026-10-13): en rabattkod på köp av timmar, prövad i databasen
     för varje kort: { kod, beskrivning, pris: { erbjudande: att betala } }. */
  S.erb = { aktiv: false, katalog: [], kort: [], bank: { saldo: 0, varde: null, perPass: {}, finns: false },
            rorelser: undefined, dragningar: undefined, kod: null };
  /* Familjens rabatt (familjerabatter, 2026-10-15): kronor av per timme som
     admin satt på familjen, ur min_familjerabatt(). Bara beloppet, aldrig
     koden, och den syns bara där familjen betalar: på korten under
     Erbjudanden (Leo samma kväll: "Visa på korten också"), priset vid knappen
     i Boka pass, Köp till timmar och kassan. Noll utan rabatt, och före
     migrationen. */
  S.familjerabatt = 0;
  const familjerabatt = () => Math.max(Number(S.familjerabatt) || 0, 0);

  /* ============================================================
     PLANERNA I 30 DAGAR (2026-10-21, betala_nu)

     Leo: planen köps "direkt och den används 30 dagar framåt". Samma dag
     köptes en plan för en kalendermånad, med Den här månaden och Nästa
     månad på kortet; de valen är borta, och databasen räknar 30 dagar från
     betalningen (klippkort_betald). Under batteriet står en rad per plan
     som gäller: "3 av 8 timmar återstår", och när den går ut.
     ============================================================ */
  const PLANENS_DAGAR = 30;
  const MÅNADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
    'oktober', 'november', 'december'];
  // Ett köp med en månad (planerna_per_manad, bara 2026-10-21) säger sin månad.
  function månadensNamn(första) {
    return MÅNADER[Number(String(första).split('-')[1]) - 1] || '';
  }
  function planRader() {
    const idag = isoFor(new Date());
    const planer = (S.erb.kort || []).filter(k => k.status === 'betald' && k.sort === 'plan'
      && k.erbjudande !== 'gratis' && !k.till_plan && String(k.giltigt_till || '') >= idag)
      .sort((a, c) => String(a.giltigt_till).localeCompare(String(c.giltigt_till)));
    if (!planer.length) return '';
    // Timmar köpta till en plan räknas med sin plan, som förut.
    const till = id => (S.erb.kort || []).filter(k => k.status === 'betald' && k.till_plan === id);
    return '<div class="tb-manader" aria-label="Planernas timmar">'
      + planer.map(p => {
        const delar = [p].concat(till(p.id));
        const kvar = delar.reduce((t, k) => t + (Number(k.kvar) || 0), 0);
        const alla = delar.reduce((t, k) => t + Math.max((Number(k.timmar) || 0) - (Number(k.aterbetalda_timmar) || 0), 0), 0);
        return '<div class="tb-manad">'
          + '<span class="tb-manad-namn">' + esc(p.namn || 'Plan') + '</span>'
          + '<span class="tb-manad-tal"><b>' + kvar + '</b> av ' + alla + ' timmar återstår</span>'
          + '<span class="tb-manad-not">Går ut ' + esc(datumText(String(p.giltigt_till))) + '</span>'
          + '</div>';
      }).join('')
      + '</div>';
  }
  const medErRabatt = 'med er rabatt';

  async function laddaErbjudanden() {
    const [flagga, katalog, kort, saldo, uttag, rorelser, dragningar, forsta, rabatt, upplagg] = await Promise.all([
      supa.from('flaggor').select('aktiv').eq('kod', 'erbjudanden').maybeSingle(),
      /* Alla kolumner (planerna, 2026-10-07): timmar_pa_kopet finns först
         efter migrationen, och en uttrycklig lista med den hade gett ett
         fel och "Inga erbjudanden just nu" tills dess. Med * ritas den
         gamla katalogen som förut, och den är vad kassan då tar betalt
         efter. Vyn har inga kolumner som inte ska visas. */
      supa.from('erbjudanden_pris').select('*').order('ordning'),
      /* Alla kolumner (gratistimmarna_60_dagar, 2026-10-13): gratis_kvar
         och gratis_till finns först efter migrationen, och en uttrycklig
         lista med dem hade gett ett fel och inga timmar tills dess. */
      supa.from('klippkort_saldo')
        .select('*')
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
        .eq('parent_id', S.user.id).order('datum', { ascending: true }),
      /* Första timmen (2026-10-09): om vi valt familjen för den pass för
         pass, och om den redan fått sin timme. Hämtas med köpen, för ett
         planköp ändrar den. Utan funktionen (före migrationen) är den null,
         och då gäller den gamla regeln, som databasen då också har. */
      supa.rpc('forsta_timmen_lage'),
      /* Familjens rabatt per timme (familjerabatter, 2026-10-15). Ett fel,
         eller en databas före migrationen, är ingen rabatt. */
      supa.rpc('min_familjerabatt'),
      /* Egna upplägg (egna_upplagg, 2026-10-27) som admin skickat och som
         går att köpa: inte köpta, inte tillbakadragna och inte för gamla.
         Före migrationen finns tabellen inte, och då finns inga. */
      supa.from('egna_upplagg').select('id, namn, timmar, timpris_ore, pris_ore, giltigt_till')
        .is('kopt_at', null).is('aterkallad_at', null).gte('giltigt_till', isoFor(new Date()))
        .order('skapad_at', { ascending: true })
    ]);
    S.erb.upplagg = upplagg.error ? [] : (upplagg.data || []);
    S.forstaTimmen = forsta.error ? null : (forsta.data || null);
    S.familjerabatt = rabatt.error ? 0 : Math.max(Number(rabatt.data) || 0, 0);
    S.erb.aktiv = !!(flagga.data && flagga.data.aktiv);
    /* Bara planerna säljs (2026-10-22, Leo: tre planer, 4, 8 och 12
       timmar). Fyll timbanken (klippkort i katalogen) står kvar i
       erbjudanden_pris, för köpta kort pekar på katalogen, men visas inte
       och kan inte köpas: stripe-checkout nekar ett nytt köp. Köpta timmar
       läses ur klippkort_saldo och betalar passen som förut. */
    S.erb.katalog = (katalog.data || []).filter(e => e.sort === 'plan');
    /* Gratistimmar som admin tagit tillbaka (aterkallad_at, timmarna_delas
       2026-10-14) står kvar i databasen men inte hos familjen, som när de
       raderades. */
    S.erb.kort = (kort.data || []).filter(k => !k.aterkallad_at);
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

  /* Hur många timmar ett kort räcker till för ett pass på dagen, som
     databasen räknar (intern.kortets_timmar, gratistimmarna_60_dagar,
     2026-10-13): alla som är kvar fram till kortets sista dag, och efter
     den de gratis timmar som är kvar, till 60 dagar efter köpet. Utan
     migrationen saknas gratis_till, och då gäller bara sista dagen.
     Dagen är aldrig före i dag. */
  const passetsDag = datum => { const idag = isoFor(new Date()); return datum && String(datum) > idag ? String(datum) : idag; };
  const kortetsTimmar = (k, dag) => String(k.giltigt_till) >= dag ? Number(k.kvar) || 0
    : k.gratis_till && String(k.gratis_till) >= dag ? Number(k.gratis_kvar) || 0 : 0;
  /* Gratistimmar som admin satt in (gratistimmar, samma dag) är gratis
     rakt igenom och går först, som planens gratis timme. */
  const harGratis = (k, dag) => NXBetalning.gratistimmar(k) ? String(k.giltigt_till) >= dag
    : Number(k.gratis_kvar) > 0 && !!k.gratis_till && String(k.gratis_till) >= dag;
  const kortetsSistaDag = (k, dag) => String(k.giltigt_till) >= dag ? String(k.giltigt_till) : String(k.gratis_till || '');

  /* Hur många timmar ett pass drar ur korten: varje påbörjad timme,
     minus timmen på köpet (intern.passets_korttimmar, timmarna_delas,
     2026-10-14). Ett pass på en timme med timmen på köpet drar inget. */
  const korttimmar = b => Math.max(passTimmar(b) - (b.startrabatt ? 1 : 0), 0);

  /* Korten timmarna dras från, som intern.timmar_fordela väljer dem:
     gratis timmar först (Leo 2026-10-13: "gratis timmar går ut först sen
     planerna"; gratistimmarna admin satt in också), sedan det köp som går
     ut först. Räcker det första till hela passet dras bara det; annars allt
     som är kvar på det och resten från det första köp i ordningen som
     räcker till resten (timmarna_delas, 2026-10-14). Högst två köp per
     pass. Databasen väljer själv; det här avgör vad vyn lovar.
     { kort, forsta, forstaTimmar, behov } eller null. */
  function fördela(behov, dag) {
    if (!(behov > 0)) return null;
    const kort = S.erb.kort
      .filter(k => k.brukbar && k.status === 'betald' && kortetsTimmar(k, dag) > 0)
      .sort((a, c) => (harGratis(c, dag) - harGratis(a, dag))
        || kortetsSistaDag(a, dag).localeCompare(kortetsSistaDag(c, dag))
        || String(a.created_at || '').localeCompare(String(c.created_at || '')));
    const först = kort[0];
    if (!först) return null;
    const har = kortetsTimmar(först, dag);
    if (har >= behov) return { kort: först, forsta: null, forstaTimmar: 0, behov: behov };
    const rest = kort.slice(1).find(k => kortetsTimmar(k, dag) >= behov - har);
    return rest ? { kort: rest, forsta: först, forstaTimmar: har, behov: behov } : null;
  }

  /* Ett pass med fler barn betalas med kort (villkoren, #erbjudanden). */
  function kortFör(b) {
    if (!S.erb.aktiv || Number(b.antal_barn || 1) > 1) return null;
    return fördela(korttimmar(b), passetsDag(b.wanted_date));
  }
  /* "2 timmar ur Standard", eller "1 timme ur Gratistimmar från Nextrum och 1 ur Standard". */
  const dragText = f => f.forsta
    ? timText(f.forstaTimmar) + ' ur ' + f.forsta.namn + ' och ' + (f.behov - f.forstaTimmar) + ' ur ' + f.kort.namn
    : timText(f.behov) + ' ur ' + f.kort.namn;

  /* Timbanken betalar ett helt pass när minuterna räcker till det
     bokade (Fas 22.1): ett barn, och inte ett med en timme på köpet,
     vars resten timmarna betalar. timbank_dra prövar det igen. */
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
  /* gratis: förslaget får en timme på köpet (bjuden), och timmarna
     betalar resten (timmarna_delas, 2026-10-14). Timbanken betalar bara
     hela pass. */
  function timmarFörFörslag(minuter, datum, barn, gratis) {
    if (!S.erb.aktiv || Number(barn) > 1 || !datum) return null;
    const behov = Math.max(passTimmar({ duration_min: minuter }) - (gratis ? 1 : 0), 0);
    if (!behov) return null;
    const dag = passetsDag(datum), idag = isoFor(new Date());
    if (fördela(behov, dag)) {
      const kvar = S.erb.kort.filter(k => k.brukbar).reduce((a, k) => a + kortetsTimmar(k, idag), 0);
      return { titel: 'Er timbank', under: '−' + timText(behov) + ', ' + (kvar - behov) + ' kvar efter' };
    }
    if (!gratis && S.erb.bank.saldo >= minuter) return { titel: 'Timbanken', under: '−' + tidLängd(minuter) };
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
    const idag = isoFor(new Date());
    /* En plan som gått ut med en gratis timme kvar (gratistimmarna_60_dagar)
       står med den timmen och dess sista dag. */
    el.innerHTML = kort.map(k => String(k.giltigt_till) < idag
        ? '<p><b>' + esc(kortetsTimmar(k, idag) === 1 ? '1 gratis timme kvar' : kortetsTimmar(k, idag) + ' gratis timmar kvar')
          + '</b> på ' + esc(k.namn) + ', till ' + esc(datumText(k.gratis_till)) + '.</p>'
        : '<p><b>' + esc(k.kvar + ' av ' + k.timmar + ' timmar kvar') + '</b> på '
          + esc(k.namn) + ', till ' + esc(datumText(k.giltigt_till)) + '.</p>').join('')
      + (bank ? '<p><b>' + esc(tidLängd(bank)) + '</b> i timbanken.</p>' : '')
      + '<p class="bk-timmar-not">' + esc((kort.length ? 'Timmarna' : 'Minuterna')
        + ' dras när ni föreslår ett pass, ett barn per pass' + (kort.some(k => harGratis(k, idag)) ? ', gratis timmar först' : '')
        + '. Föreslår er studiehjälpare en annan tid följer de med passet. '
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
    /* Alla betalknappar är orange och heter Betala nu (2026-10-21, Leo:
       "Alla betala knappar ska vara oranga och stå betala nu"). Timmarna
       står först när de räcker, och säger att det är timmarna. */
    const tim = kortFör(b);
    const bank = !tim && bankFör(b);
    const sm = liten ? ' btn-sm' : '';
    const kortknapp = '<button type="button" class="btn ' + (tim || bank ? 'btn-ghost' : 'btn-orange') + sm
      + '" data-betala="' + esc(b.id) + '">' + (tim || bank ? 'Betala nu med kort eller Klarna' : 'Betala nu') + '</button>';
    if (bank) return '<button type="button" class="btn btn-orange' + sm + '" data-timbank="' + esc(b.id) + '">Betala med timbanken</button>' + kortknapp;
    if (!tim) return kortknapp;
    return '<button type="button" class="btn btn-orange' + sm + '" data-timmar="' + esc(b.id) + '">Betala med timmar</button>' + kortknapp;
  }
  /* EN knapp på raden i en lista (2026-09-28, Leo: "det behöver se bra
     ut på mobil och enkelt att använda"). Två knappar bredvid ett märke
     bröt raden i tre på en telefon. Att betala i förväg är ett val och
     inget drag familjen måste göra, så kortet står som en stilla knapp;
     timmarna står först när de räcker, som i betalaKnapp. Alla val står
     på passets sida, dit raden leder. */
  /* Radens enda val (2026-10-27 ett eget steg, så att Betala alla tar
     samma pass som har Betala nu): 'betala', 'timmar', 'timbank',
     'kort-spara' eller 'kort-val'. */
  function radensVal(b) {
    // Sen avbokning (2026-10-22): avgiften är pengar, och betalas med Betala nu.
    if (b.status === 'cancelled') return 'betala';
    if (kortFör(b)) return 'timmar';
    if (bankFör(b)) return 'timbank';
    /* Kortet reserveras (2026-10-13): Betala i förväg är borta med
       strömbrytaren på. Knappen väljer kortet, och ett kort som saknas
       eller nekades är familjens drag. */
    const kr = kortResRad(b);
    if (kr && kortValt(b) && S.kort.pa && (kr.lage === 'misslyckad' || (kr.lage === 'vald' && !S.kort.kort))) return 'kort-spara';
    if (kortKanVäljas(b)) return 'kort-val';
    // Också efter ett nekat försök: samma knapp, samma ord (2026-10-21).
    return 'betala';
  }
  function radBetala(b) {
    const val = radensVal(b);
    if (val === 'timmar') return '<button type="button" class="btn btn-orange btn-sm" data-timmar="' + esc(b.id) + '">Betala med timmar</button>';
    if (val === 'timbank') return '<button type="button" class="btn btn-orange btn-sm" data-timbank="' + esc(b.id) + '">Betala med timbanken</button>';
    if (val === 'kort-spara') {
      const kr = kortResRad(b);
      return '<button type="button" class="btn btn-primary btn-sm" data-kort-spara>'
        + (S.kort.kort ? 'Byt kort' : kr && kr.lage === 'misslyckad' ? 'Lägg till kort' : 'Spara kortet') + '</button>';
    }
    if (val === 'kort-val') return '<button type="button" class="btn btn-orange btn-sm" data-kort-val="' + esc(b.id) + '">Välj kort</button>';
    return '<button type="button" class="btn btn-orange btn-sm" data-betala="' + esc(b.id) + '">Betala nu</button>';
  }
  const BETALNING_TEXT = {
    ingen: 'Inte betalt än',
    vantar: 'Betalningen är påbörjad',
    betald: 'Betalt',
    misslyckad: 'Betalningen gick inte igenom',
    aterbetald: 'Återbetalt',
    tvist: 'Betalningen är ifrågasatt'
  };

  /* Fakturan (Fas 14.6) var ett tredje betalsätt här, med egen knapp,
     egen ruta och egna fakturor under Betalning, tills den togs bort
     2026-10-21 (fakturan_tas_bort). */

  /* Betalvalen som stora knappar (2026-09-28), med vad som händer på
     raden under: under Bekräfta rapport och på passets sida. Samma
     data-attribut och samma urval som betalaKnapp, så att samma
     hanterare tar dem och samma regler gäller: timmarna först när de
     räcker, annars kortet. */
  function betalVal(b) {
    const V = NXStudie.betalval;
    const pris = passetsPris(b);
    // Sen avbokning (2026-10-22): avgiften betalas med kort eller Klarna, inte med timmar.
    if (b.status === 'cancelled') {
      return V({ attr: 'data-betala="' + esc(b.id) + '"', ikon: 'kort', titel: 'Betala nu',
        under: [NXBetalning.kronor(pris), 'Kort eller Klarna',
          b.betalning_status === 'misslyckad' ? 'förra försöket gick inte igenom' : null].filter(Boolean).join(' · '),
        först: true, orange: true });
    }
    const tim = kortFör(b);
    const bank = !tim && bankFör(b);
    const val = [];
    if (tim) {
      val.push(V({ attr: 'data-timmar="' + esc(b.id) + '"', ikon: 'timmar', titel: 'Betala med timmar',
        under: dragText(tim), först: true, orange: true }));
    } else if (bank) {
      val.push(V({ attr: 'data-timbank="' + esc(b.id) + '"', ikon: 'bank', titel: 'Betala med timbanken',
        under: tidLängd(Number(b.duration_min || 60)) + ' ur timbanken', först: true, orange: true }));
    }
    /* Före passet, med kortreservationen på (2026-10-13): kortet väljs och
       reserveras två dagar före passet. Efter passet är valen som förut. */
    if (kortKanVäljas(b)) {
      val.push(V({ attr: 'data-kort-val="' + esc(b.id) + '"', ikon: 'kort', titel: 'Välj kort',
        under: (pris ? NXBetalning.kronor(pris) + ' r' : 'R') + 'eserveras två dagar före passet', först: !tim && !bank }));
      return val.join('');
    }
    val.push(V({ attr: 'data-betala="' + esc(b.id) + '"', ikon: 'kort',
      titel: 'Betala nu',
      under: [pris ? NXBetalning.kronor(pris) : null, 'Kort eller Klarna',
        b.betalning_status === 'misslyckad' ? 'förra försöket gick inte igenom' : null].filter(Boolean).join(' · '),
      först: !tim && !bank, orange: !tim && !bank }));
    return val.join('');
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
      ? { pass: passId, tillagg: true, ui: ui, retur: location.origin, villkor: true }
      : { pass: passId, retur: location.origin, ui: ui, villkor: true });
  }
  /* Ett erbjudande går genom samma kassa, med koden i stället för ett
     pass (Fas 16.1). Beloppet räknas av stripe-checkout. */
  async function startaKöp(kod, ui, extra) {
    /* En rabattkod följer med när den gäller planen (2026-10-13; bara
       planerna sedan 2026-10-21). Kassan prövar den igen och drar det
       databasen räknat fram. Timmar till planen (2026-10-14) och Fyll
       timbanken köps utan kod: extra bär antalet timmar. villkor: true
       säger att köpvillkoren kryssats i före kassan. */
    const plan = S.erb.katalog.some(e => e.kod === kod && e.sort === 'plan');
    /* Timmar till planen köps utan kod; med_tillagg (syskontillägget) är
       inget annat köp, och koden följer med som förut. */
    const rk = !(extra && extra.timmar) && plan && S.erb.kod && S.erb.kod.pris[kod] != null ? S.erb.kod.kod : null;
    return startaKassa(Object.assign({ erbjudande: kod, retur: location.origin, ui: ui, villkor: true },
      rk ? { rabattkod: rk } : {}, extra || {}));
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
    p.extra = o && o.extra ? o.extra : null;
    p.tillägg = !!(o && o.tillägg);
    // 'kort': kassan sparar kortet (kortet_reserveras) och tar ingen betalning.
    p.sort = o && o.sort ? o.sort : null;
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
    if (p.klar && p.sort === 'kort') {
      // Kortet är sparat: det ska synas, och passen där det valts.
      laddaKortOchPass().catch(() => {});
    } else if (p.klar && !p.pass) {
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
    // Enter i rutan för rabattkoden prövar den, som knappen.
    if (e.key === 'Enter' && e.target && e.target.id === 'erb-kod') { e.preventDefault(); provaErbKod(); }
  });

  /* ============================================================
     KORTET RESERVERAS (kortet_reserveras, 2026-10-13)

     Leo: "när man klickar på boka pass eller godkänn förslaget från
     barnet ska man kunna betala nu, eller på faktura. då reserveras
     pengar från stripe och när passet har hållits och läxhjälparen har
     skrivit rapport så dras pengarna om man betalar med kort". Kortet
     sparas hos Stripe (kassan i läget setup), och stripe-reservation
     reserverar priset två dagar före passet och drar det när rapporten
     finns (minne/betalning.md).

     Allt här hänger på strömbrytaren kortreservation: av är vyn som
     förut. Ett kort som redan är sparat och en reservation som står syns
     ändå, och kortet går alltid att ta bort. Vyn läser bara: kortet
     genom mitt_kort() (märke, sista fyra och giltighetstid, inga id från
     Stripe) och familjens reservationer. Valet skrivs med valj_kort(),
     kortet sparas och tas bort genom stripe-checkout, och pengarna rör
     bara stripe-reservation och webhooken.
     ============================================================ */
  S.kort = { pa: false, kort: null, rader: {} };

  /* Lägen som säger något om passet nu. Ett draget pass står som betalt,
     och ett släppt är ingenting. Listan växer inte med åren. */
  const KORTLAGEN = ['vald', 'reserverad', 'slapps', 'utgangen', 'misslyckad'];

  async function laddaKort() {
    /* Flaggan först. Utan raden är migrationen inte körd, och då finns
       varken funktionen eller tabellen: vyn frågar inte efter dem, så att
       varje inloggning inte ger två 404 tills den är körd, och är som förut. */
    const flagga = await supa.from('flaggor').select('aktiv').eq('kod', 'kortreservation').maybeSingle();
    if (flagga.error || !flagga.data) {
      S.kort.pa = false; S.kort.kort = null; S.kort.rader = {};
      ritaKortet();
      return;
    }
    const [kort, rader] = await Promise.all([
      supa.rpc('mitt_kort'),
      supa.from('kortreservationer').select('booking_id, lage, reserverat_ore, fel').in('lage', KORTLAGEN)
    ]);
    S.kort.pa = !!flagga.data.aktiv && !kort.error && !rader.error;
    S.kort.kort = !kort.error && Array.isArray(kort.data) ? kort.data[0] || null : null;
    S.kort.rader = {};
    if (!rader.error) (rader.data || []).forEach(r => { S.kort.rader[r.booking_id] = r; });
    ritaKortet();
  }

  /* Passen ritas ur kortets rader: kortet först, sedan passen. Hämtade
     samtidigt kunde passen ritas med de gamla raderna, för kortet tar två
     varv (flaggan, sedan raderna). */
  const laddaKortOchPass = () => laddaKort().then(() => laddaPass());

  const KORTMÄRKEN = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro',
                       discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };
  const kortNamn = k => !k ? 'kortet' : (KORTMÄRKEN[k.marke] || 'Kortet') + (k.sista4 ? ' ·· ' + k.sista4 : '');
  const kortResRad = b => (S.kort && S.kort.rader[b.id]) || null;

  /* Betalar kortet passet av sig självt? En reservation som står dras
     när rapporten finns, också med strömbrytaren av. Ett val med ett
     sparat kort, eller en reservation som gick ut, reserveras eller dras
     bara med strömbrytaren på (kortreservation_att_gora). Ett nej
     (misslyckad) eller ett val utan kort gör det inte. */
  function kortBetalar(b) {
    const r = kortResRad(b);
    if (!r || ['ingen', 'misslyckad'].indexOf(b.betalning_status || 'ingen') === -1) return false;
    if (r.lage === 'reserverad') return true;
    return (r.lage === 'vald' || r.lage === 'utgangen') && !!S.kort.kort && S.kort.pa;
  }

  /* Märket på en passrad när kortet är valt: hur passet betalas, i
     stället för Ej betalt, och att kortet nekades. Annars som förut. */
  function kortMärke(b) {
    const r = kortResRad(b);
    if (!r || b.status === 'cancelled' || ['ingen', 'misslyckad'].indexOf(b.betalning_status || 'ingen') === -1) return null;
    if (r.lage === 'misslyckad') return S.kort.pa ? { text: 'Kortet nekades', klass: 'sen' } : null;
    if (!kortBetalar(b)) return null;
    return { text: r.lage === 'reserverad' ? 'Reserverat på kortet' : 'Kort', klass: 'pa' };
  }
  /* Ej betalt står i samma röda ton som datumrutan i studievyn (2026-10-27):
     för familjen är det ert drag. Studiehjälparvyn har kvar ockran, för
     där väntar det på någon annan. */
  function passMärke(b) {
    const m = kortMärke(b) || NXKontakt.betalMärke(b);
    return m && m.klass === 'pa' && (b.betalning_status || 'ingen') === 'ingen' ? { text: m.text, klass: 'obetald' } : m;
  }

  /* Datumrutans färg (2026-10-27, Leo: "Lektioner som ej är betalda ska
     vara röda vid sidan där de exempelvis står tor 29 okt ... betalda ...
     gröna och önskade tiderr gula, ljusa toner av dessa färger", och
     "önskad tid till studiehjälparen och en tid som studiehjälper eller
     barnet som önskat måste gå att särkiljas"). Ett förslag ni skickat är
     gult; en tid studiehjälparen föreslår är gul med en prick, och märket
     säger vem. Betalt är också ett pass som köpta timmar eller sparade
     minuter betalar, och ett som inte kostar något. Ett pass Nextrum
     undantagit, och ett avbokat, får ingen färg. */
  function dagTon(b) {
    if (b.status === 'requested') return b.created_by && b.created_by !== S.user.id ? 'forslag' : 'gul';
    if (b.status !== 'confirmed' && b.status !== 'completed') return null;
    if (b.fakturerbar === false) return null;
    const läge = b.betalning_status || 'ingen';
    if (läge === 'betald' || läge === 'tvist' || b.klippkort_id || medBanken(b) || ingetAttBetala(b)) return 'gron';
    if (läge === 'aterbetald') return null;
    return 'rod';
  }
  function hjälparensFörnamn() { return String((S.tutor && S.tutor.full_name) || '').trim().split(/\s+/)[0] || ''; }
  /* Märket på ett förslag: vem som önskat tiden, i ord. */
  function förslagsMärke(b) {
    if (b.status !== 'requested') return undefined;
    const h = hjälparensFörnamn();
    return b.created_by && b.created_by !== S.user.id
      ? { text: h ? h + ' föreslår' : 'Ny tid föreslagen', klass: 'gor' }
      : { text: 'Ni önskade', klass: 'onskad' };
  }

  /* Är kortet valt på passet, så att det går att välja bort? Inte när
     passet betalas på annat sätt, och inte medan en reservation släpps. */
  function kortValt(b) {
    const r = kortResRad(b);
    return !!r && r.lage !== 'slapps' && ['ingen', 'misslyckad'].indexOf(b.betalning_status || 'ingen') !== -1;
  }

  /* Går kortet att välja på passet? Före passet, med strömbrytaren på,
     när passet kostar något och inte betalas på annat sätt. Samma
     prövning gör valj_kort() i databasen. Räcker familjens timmar eller
     timbanken till passet betalar de det (timmar-betalar, också när ett
     köp blir betalt), och ett val av kort hade inte gjort något. */
  function kortKanVäljas(b) {
    return !!(S.kort && S.kort.pa) && ['requested', 'confirmed'].indexOf(b.status) !== -1
      && b.wanted_date >= isoFor(new Date())
      && b.fakturerbar !== false && !ingetAttBetala(b) && !b.klippkort_id
      && ['ingen', 'misslyckad'].indexOf(b.betalning_status || 'ingen') !== -1
      && !kortValt(b) && !kortFör(b) && !bankFör(b);
  }

  /* Vad kortet gör med passet, i en mening. */
  function kortText(b) {
    const r = kortResRad(b);
    if (!r) return null;
    const k = kortNamn(S.kort.kort);
    if (r.lage === 'reserverad') {
      return (r.reserverat_ore ? NXBetalning.kronor(r.reserverat_ore) + ' är reserverat' : 'Priset är reserverat')
        + ' på ' + k + ' och dras när studiehjälparen har skrivit rapporten.';
    }
    if (r.lage === 'slapps') return 'Reservationen på kortet släpps inom några minuter.';
    // Strömbrytaren av: inget nytt reserveras eller dras, och passet betalas som vanligt.
    if (!S.kort.pa) return 'Kortet reserveras inte för passen just nu, så ni betalar passet som vanligt.';
    if (r.lage === 'misslyckad') {
      return r.fel === 'authentication_required' || r.fel === 'card_authentication_required'
        ? 'Banken ville att ni bekräftade betalningen, och det går inte när ni inte är med. '
          + 'Lägg till kortet igen, eller betala efter passet.'
        : 'Kortet nekades. Lägg till ett annat kort, försök igen, eller betala efter passet.';
    }
    if (!S.kort.kort) return 'Ni har valt kort, men inget kort är sparat. Spara kortet, annars betalar ni efter passet.';
    if (r.lage === 'utgangen') return 'Reservationen på ' + k + ' gick ut. Priset dras från kortet när studiehjälparen har skrivit rapporten.';
    return 'Priset reserveras på ' + k + ' två dagar före passet och dras när studiehjälparen har skrivit rapporten.';
  }

  /* Kortets mening på passets sida, när kortet har något med passet att
     göra: valt, eller en reservation som släpps. */
  const kortBesked = b => kortValt(b) || (kortResRad(b) && kortResRad(b).lage === 'slapps') ? kortText(b) : null;

  /* Valen i ett förslag. Efter passet först: valet är frivilligt, och
     förvalet är som förut. */
  function betalvalFörslag() {
    if (!S.kort.pa || S.väntar) return null;
    const val = [['efter', 'Efter passet', 'Ni betalar efter passet, när ni bekräftar rapporten, med kort.']];
    val.push(['kort', 'Kort', S.kort.kort
      ? 'Priset reserveras på ' + kortNamn(S.kort.kort) + ' två dagar före passet och dras när studiehjälparen har skrivit rapporten.'
      : 'Ni sparar kortet när förslaget är skickat. Priset reserveras två dagar före passet och dras när studiehjälparen har skrivit rapporten.']);
    return val;
  }

  /* Betalsättet som valdes i förslaget, när passet just skapats. Passet
     finns redan: ett fel här fäller inte förslaget, och kvittot säger
     vad som gick och var resten görs. Timmarna eller timbanken kan ha
     betalat passet när det skapades; då finns inget att välja. */
  async function efterBetalsätt(pass, val) {
    if (!pass || !pass.id || val !== 'kort') return null;
    if ((pass.betalning_status || 'ingen') !== 'ingen') return null;
    const { error } = await supa.rpc('valj_kort', { p_bokning: pass.id, p_kort: true });
    if (error) return { text: 'Kortet gick inte att välja: ' + felText(error) + ' Välj betalsätt på passet.' };
    await laddaKort().catch(() => {});
    if (!S.kort.kort) {
      return { text: 'Ni har valt kort. Spara kortet, så reserveras priset två dagar före passet. Utan kort betalar ni efter passet.',
               kortKnapp: true };
    }
    return { text: 'Priset reserveras på ' + kortNamn(S.kort.kort) + ' två dagar före passet och dras när studiehjälparen har skrivit rapporten.' };
  }

  /* Välj kort på ett pass, eller välj bort det. Saknas ett sparat kort
     öppnas kassan för det direkt, i samma tryck. */
  async function väljKort(knapp, passId, på) {
    let saknas = false;
    await medan(knapp, på ? 'Väljer…' : 'Sparar…', async () => {
      const { error } = await supa.rpc('valj_kort', { p_bokning: passId, p_kort: på });
      if (error) {
        alert((på ? 'Kortet gick inte att välja: ' : 'Kortet gick inte att välja bort: ') + felText(error));
        return;
      }
      await NXStudie.håll(knapp, laddaKortOchPass);
      saknas = på && !S.kort.kort;
    });
    if (saknas) {
      const ny = document.querySelector('[data-kort-spara]');
      await sparaKort(ny && ny.isConnected ? ny : knapp);
    }
  }

  async function sparaKort(knapp) {
    if (!S.kort.pa) return;
    if (!await NXStudie.kassansVillkor({
      titel: S.kort.kort ? 'Byt kort' : 'Spara kortet',
      rader: ['Inget dras nu.', 'Priset för ett pass reserveras två dagar före passet och dras när rapporten är skriven.']
    })) return;
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKassa({ kort: 'spara', retur: location.origin, ui: 'inbaddad', villkor: true });
      if (!svar) return;
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try {
            await öppnaKassa(knapp, null, svar, Stripe, {
              titel: S.kort.kort ? 'Byt kort' : 'Spara kortet',
              vad: 'Inget dras nu. Priset för ett pass reserveras två dagar före passet.',
              sort: 'kort',
              klar: kortSparat
            });
            return;
          } catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKassa({ kort: 'spara', retur: location.origin, ui: 'sida', villkor: true });
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  function kortSparat() {
    const p = panel;
    if (!p) return;
    p.klar = true;
    p.besked.textContent = '✓ Kortet är sparat. Det kan ta en liten stund innan det syns här.';
    p.besked.hidden = false;
    väntaPåKortet();
  }

  /* Webhooken skriver kortet en stund efter kassan (kort_sparat). Läs om
     tills det syns, högst en halv minut, i stället för att familjen
     trycker Spara kortet en gång till. */
  function väntaPåKortet(gånger) {
    const kvar = gånger == null ? 10 : gånger;
    const före = S.kort.kort ? S.kort.kort.sparat : null;
    setTimeout(() => {
      laddaKort().then(() => {
        if ((S.kort.kort && S.kort.kort.sparat !== före) || kvar <= 1) return laddaPass();
        väntaPåKortet(kvar - 1);
      }).catch(() => {});
    }, 3000);
  }

  async function taBortKort(knapp) {
    const ok = await bekräfta({
      titel: 'Ta bort kortet?',
      text: 'Kortet tas bort hos Stripe. Pass där ni valt kort betalar ni efter passet i stället, och ett belopp som är reserverat släpps.',
      knapp: 'Ta bort kortet'
    });
    if (!ok) return;
    await medan(knapp, 'Tar bort…', async () => {
      const svar = await startaKassa({ kort: 'ta_bort' });
      if (!svar) return;
      await laddaKortOchPass();
      säg($('#kort-msg'), 'Kortet är borttaget.', true);
    });
  }

  /* Profil → Kortet. Fliken syns med strömbrytaren på, eller när ett kort
     redan är sparat: det ska alltid gå att ta bort. */
  function ritaKortet() {
    const flik = $('#flik-kort'), host = $('#kort-ruta');
    if (flik) flik.hidden = !(S.kort.pa || S.kort.kort);
    if (!host) return;
    const k = S.kort.kort;
    const utgår = k && k.utgar_manad && k.utgar_ar
      ? 'går ut ' + String(k.utgar_manad).padStart(2, '0') + '/' + String(k.utgar_ar).slice(-2) : null;
    const antal = Object.keys(S.kort.rader).filter(id => ['vald', 'reserverad'].indexOf(S.kort.rader[id].lage) !== -1).length;
    host.innerHTML = (k
      ? '<div class="vy-rad"><span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(kortNamn(k)) + '</span>'
        + '<span class="vy-rad-meta">' + [utgår, antal ? (antal === 1 ? '1 pass med kortet' : antal + ' pass med kortet') : null]
          .filter(Boolean).map(m => '<span>' + esc(m) + '</span>').join('') + '</span></span>'
        + '<span class="vy-rad-hoger">'
        + (S.kort.pa ? '<button type="button" class="btn btn-ghost btn-sm" data-kort-spara>Byt kort</button>' : '')
        + '<button type="button" class="btn btn-ghost btn-sm" data-kort-ta-bort>Ta bort</button></span></div>'
      : '<p class="erb-bank-text">Inget kort är sparat.</p>'
        + (S.kort.pa ? '<button type="button" class="btn btn-primary btn-sm" data-kort-spara>Spara ett kort</button>' : ''))
      + '<p class="erb-bank-text">Kortet finns hos Stripe, vår betalleverantör. Vi ser bara märket, de fyra sista siffrorna '
      + 'och när det går ut. Väljer ni kort på ett pass reserveras priset två dagar före passet och dras när studiehjälparen har '
      + 'skrivit rapporten. Tar ni bort kortet betalar ni de passen efter passet i stället.</p>';
  }

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
    const f = b ? kortFör(b) : null;
    if (!b || !f) return;
    const kort = f.kort, behov = f.behov, härifrån = behov - f.forstaTimmar;
    const ord = n => n === 1 ? '1 timme' : n + ' timmar';
    /* Ett pass kan dras från två köp (timmarna_delas, 2026-10-14), och
       timmen på köpet dras inte. Rutan säger båda. */
    const ok = await NXStudie.bekräfta({
      titel: 'Betala med timmar?',
      text: (f.forsta ? ord(f.forstaTimmar) + ' dras från ' + f.forsta.namn + ' och ' + ord(härifrån) + ' från ' + kort.namn
          : ord(behov) + ' dras från ' + kort.namn)
        + (b.startrabatt ? ', och timmen på köpet dras inte' : '')
        + '. Kvar efteråt på ' + kort.namn + ': ' + ord(kortetsTimmar(kort, passetsDag(b.wanted_date)) - härifrån)
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
    /* Fas 22.2: köpet betalar passen framför familjen i samma stund som
       det blir betalt, så passen laddas om med timmarna. Sedan Fas 22.4
       också förslagen. */
    p.besked.textContent = '✓ Tack! Köpet är klart. Timmarna syns under Er timbank om en liten stund, '
      + 'och de betalar era pass av sig själva.';
    p.besked.hidden = false;
    setTimeout(() => { laddaErbjudanden().catch(() => {}); }, 2500);
    setTimeout(() => { Promise.all([laddaErbjudanden(), laddaPass()]).catch(() => {}); }, 8000);
  }

  async function köpErbjudande(knapp, kod) {
    const e = S.erb.katalog.find(x => x.kod === kod);
    if (!e || !S.erb.aktiv || S.väntar) return;
    const kodPris = S.erb.kod && S.erb.kod.pris[kod] != null ? Number(S.erb.kod.pris[kod]) : null;
    const pris = kodPris != null ? kodPris : medRabatt(e).pris;
    const tl = tilläggIKassan(pris);
    const ok = await NXStudie.kassansVillkor({
      titel: 'Köp ' + e.namn,
      rader: [erbTimmar(e) + ' · ' + NXBetalning.kronor(pris)]
        .concat(e.sort === 'plan' ? ['Gäller i ' + PLANENS_DAGAR + ' dagar från köpet'] : []),
      tillagg: tl,
      text: 'Ni betalar med kort eller Klarna i nästa steg.'
    });
    if (!ok) return;
    await köpIKassan(knapp, kod, tl && tl.valfri && !tl.med ? { med_tillagg: false } : null, 'Köp ' + e.namn,
      svar => erbTimmar(e) + ' · '
      + NXBetalning.kronor(svar.belopp_ore != null ? svar.belopp_ore : e.pris_ore)
      + medVad(Number(svar.familjerabatt_ore) > 0,
        Number(svar.rabatt_ore) > Number(svar.familjerabatt_ore || 0) && S.erb.kod ? S.erb.kod.kod : null)
      + tilläggISvaret(svar));
  }

  /* Syskontillägget i kassans ruta (syskontillagg_som_skuld, 2026-10-21):
     det upplupna som egen rad, utan rabattkod, och totalen. Står det i en
     betalning som pågår följer det inte med, och rutan säger det. Beloppet
     är det mitt_tillagg() sa; kassan tar databasens, och raden i Stripe
     står för sig. */
  function tilläggIKassan(prisOre) {
    const t = S.syskon;
    if (!t) return null;
    const n = Number(t.upplupna) || 0;
    if (!n) {
      return Number(t.i_betalning) > 0
        ? { rad: 'Tillägget för extra barn: en betalning pågår redan, så det följer inte med det här köpet.', valfri: false, med: false }
        : null;
    }
    const kronor = NXBetalning.kronor;
    return {
      rad: 'Upplupet tillägg för extra barn, ' + (n === 1 ? '1 pass' : n + ' pass') + ' · ' + kronor(t.upplupet_ore)
        + (t.obligatorisk ? ' (egen rad, utan rabattkod)' : ' (betala det nu, som egen rad utan rabattkod)'),
      valfri: !t.obligatorisk,
      med: true,
      totalMed: prisOre ? 'Totalt ' + kronor(Number(prisOre) + Number(t.upplupet_ore)) : null,
      totalUtan: prisOre ? 'Totalt ' + kronor(Number(prisOre)) : null
    };
  }
  /* Raden under rubriken i panelen säger tillägget när det följde med. */
  function tilläggISvaret(svar) {
    if (Number(svar.tillagg_ore) > 0) {
      laddaSyskon().catch(() => {});
      return ' + tillägg ' + NXBetalning.kronor(svar.tillagg_ore);
    }
    return svar.tillagg_pagar ? ' (tillägget betalas i en annan betalning som pågår)' : '';
  }

  /* "med er rabatt", "med koden X" eller båda, efter beloppet i kassan. */
  function medVad(rabatt, kod) {
    const delar = [rabatt ? medErRabatt : null, kod ? 'koden ' + kod : null].filter(Boolean);
    return delar.length ? ' ' + (rabatt ? '' : 'med ') + delar.join(' och ') : '';
  }

  /* Ett köp i samma kassa som passen. extra följer med till
     stripe-checkout (timmarna till planen), och vad(svar) är raden under
     rubriken: beloppet där är det kassan räknat. */
  async function köpIKassan(knapp, kod, extra, titel, vad) {
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKöp(kod, 'inbaddad', extra);
      if (!svar) return;
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try {
            await öppnaKassa(knapp, null, svar, Stripe, {
              titel: titel,
              vad: vad(svar),
              kod: kod,
              extra: extra,
              klar: köpKlart
            });
            return;
          } catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKöp(kod, 'sida', extra);
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  /* Planerna (2026-10-07, Leo): Standard hade en timme på köpet i stället
     för en rabatt till 2026-10-08, då alla tre fick 5 % mot 399 kr, alltså
     379 kr i timmen, en månad i taget. Timmarna på köpet räknas i
     databasen (erbjudanden_pris.timmar_pa_kopet) och visas om katalogen
     får dem igen; saknas fältet är det noll. */
  const erbPåKöpet = e => Math.max(Number(e.timmar_pa_kopet) || 0, 0);
  const timmarOrd = n => n === 1 ? '1 timme' : n + ' timmar';
  /* "8 timmar för priset av 7", samma ord som på prissidan och i kassan.
     Inte "en timme på köpet" ensamt: så heter också första timmen som
     bjuds på ett pass, och det är en annan sak. */
  const erbTimmar = e => erbPåKöpet(e)
    ? timmarOrd(Number(e.timmar)) + ' för priset av ' + (Number(e.timmar) - erbPåKöpet(e))
    : timmarOrd(Number(e.timmar));

  /* Ett erbjudande som ett kort. Det överstrukna är ordinarie pris för
     samma timmar. Raden "399 kr 379 kr per timme · ni sparar 160 kr"
     under priset är borta sedan 2026-10-12 (Leo): märket säger timpriset
     och den överstrukna summan besparingen. Den står bara kvar på ett
     kort med timmar på köpet, där den är det enda som säger hur summan
     går ihop ("8 timmar för priset av 7"). */
  function erbKort(e) {
    const kr = NXBetalning.kronor;
    const fr = medRabatt(e);
    const spar = Number(e.ordinarie_ore) - fr.pris;
    const pa = erbPåKöpet(e);
    const rabatt = Number(e.rabatt_procent) || 0;
    /* Timpriset räknas i vyn, och summan är timpriset gånger de betalda
       timmarna (Fas 16.1d, planerna). En egen division här hade kunnat
       visa ett timpris som inte går ihop med summan bredvid, och med en
       timme på köpet hade den blivit ett snittpris (331,63 kr) som ingen
       betalar. Standard visar därför inget timpris; en plan med både
       timmar på köpet och rabatt visar det rabatterade timpriset, som är
       vad varje betald timme kostar. Med familjens rabatt är det timpriset
       efter den. */
    const perTimme = fr.perTimme;
    /* Ur raden, inte ur koden (Fas 21.3): ändras timmarna eller
       giltigheten i katalogen ska kortet säga det nya av sig självt.
       En plan är ingen bindning: villkoren säger ingen bindningstid, och
       den som slutar får tillbaka det som är kvar. Planen gäller en månad
       i taget, och kortet säger det med samma ord som prissidan (Leo
       2026-10-08 valde de orden framför "bindning"). */
    const mån = Number(e.giltig_manader) === 1 ? '1 månad' : e.giltig_manader + ' månader';
    /* Märket säger vad erbjudandet ger: timmen på köpet, eller timpriset
       utan bindning överstruket och planens bredvid, som på prissidan
       (Leo 2026-10-08: "Ta bort -5% ... skriv istället 399 streck över
       de, 379"). Aldrig ett lika pris överstruket, och aldrig ett timpris
       i märket på ett kort med timmar på köpet: där är summan inte
       timpriset gånger timmarna, och raden under säger hur det går ihop. */
    const billigare = perTimme < Number(e.timpris_ore);
    const märken = (pa ? '<span class="erb-rabatt ar-pa-kopet">' + esc(timmarOrd(pa)) + ' på köpet</span>' : '')
      + (!pa && billigare ? '<span class="erb-rabatt"><s><span class="nx-dold">Ordinarie pris </span>'
        + esc(kr(e.timpris_ore)) + '</s> ' + esc(kr(perTimme)) + '</span>' : '');
    const timrad = pa
      ? esc(erbTimmar(e))
        + (rabatt || fr.av ? ', <s>' + esc(kr(e.timpris_ore)) + '</s> ' + esc(kr(perTimme)) + ' per timme' : '')
      : '';
    /* Standard lyfts fram (Leo 2026-10-07: "Visa standard planens
       erbjudande"), på koden sedan den 2026-10-08 slutade ha en timme på
       köpet, och en plan med timmar på köpet, om katalogen får en igen. */
    const lyft = pa > 0 || e.kod === 'plan_standard';
    /* Första timmen (2026-10-09, Leo: "bara folk som köper planen ska få
       gratis första lektion"): den första planen familjen betalar får en
       timme till. Raden står bara för en familj som inte fått sin timme,
       och bara när databasen kan säga det. */
    const ft = S.forstaTimmen;
    const första = e.sort === 'plan' && ft && !ft.tagen;
    /* Kortet säljer (2026-10-27, Leo: planerna "ska säljas in på studievyn
       bättre"): vad planen räcker till i veckan, priset för hela perioden,
       tre rader om vad den ger och knappen. Takten räknas ur timmarna och
       periodens dagar (4 timmar på 30 dagar är ungefär en i veckan), så att
       den följer katalogen. Ingen rad med "ni sparar" under priset: den
       togs bort 2026-10-12 (Leo), och märket säger timpriset. */
    const dagar = e.sort === 'plan' ? PLANENS_DAGAR : Number(e.giltig_manader || 1) * 30;
    const iVeckan = Math.max(1, Math.round(Number(e.timmar) / (dagar / 7)));
    const takt = 'Ungefär ' + (iVeckan === 1 ? 'en timme' : (['', '', 'två', 'tre', 'fyra', 'fem'][iVeckan] || iVeckan) + ' timmar') + ' i veckan';
    const fördelar = [
      timmarOrd(Number(e.timmar)) + ' att boka när det passar er',
      'Timmarna betalar passen av sig själva',
      e.sort === 'plan' ? 'Gäller i ' + PLANENS_DAGAR + ' dagar från köpet, obundet' : 'Gäller i ' + mån
    ];
    return '<article class="erb-kort' + (lyft ? ' ar-framhavd' : '') + '">'
      + (lyft ? '<span class="erb-flagga">Vårt förslag</span>' : '')
      + '<div class="erb-topp"><b class="erb-namn">' + esc(e.namn) + '</b>'
      + '<span class="erb-takt">' + esc(takt) + '</span></div>'
      + erbPris(e, spar, fr)
      + (märken ? '<span class="erb-marken">' + märken + '<span class="erb-marken-et">per timme</span></span>' : '')
      + (timrad ? '<span class="erb-tim">' + timrad + '</span>' : '')
      + (första ? '<span class="erb-forsta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>En timme till, gratis, på er första plan</span>' : '')
      + '<ul class="erb-fordelar">' + fördelar.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>'
      + köpKnapp(e)
      + '</article>';
  }

  /* Kortets pris med familjens rabatt (familjerabatter, Leo 2026-10-15:
     "Visa på korten också"): kronorna av på varje betald timme, när de
     lämnar ett pris kvar, som intern.klippkort_rabatt räknar när köpet
     skapas. Kassan drar databasens belopp; det här är vad kortet säger.
     Utan rabatt är det katalogens pris. */
  function medRabatt(e) {
    const d = familjerabatt();
    const per = Number(e.rabatterat_timpris_ore);
    const betalda = Number(e.timmar) - erbPåKöpet(e);
    const av = d > 0 && d < per && betalda > 0 ? d : 0;
    return { pris: Number(e.pris_ore) - av * betalda, perTimme: per - av, av: av };
  }

  /* Priset på kortet. Med en rabattkod som gäller kortet står katalogens
     pris överstruket och priset med koden bredvid, ur databasens svar
     (kolla_rabattkod_kop, som räknar koden på priset efter familjens
     rabatt), aldrig räknat här. */
  function erbPris(e, spar, fr) {
    const kr = NXBetalning.kronor;
    const medKod = S.erb.kod ? S.erb.kod.pris[e.kod] : null;
    if (medKod != null && medKod < Number(e.pris_ore)) {
      return '<span class="erb-pris"><s>' + esc(kr(e.pris_ore)) + '</s><b>' + esc(kr(medKod)) + '</b>'
        + '<span class="erb-pris-kod">med koden ' + esc(S.erb.kod.kod) + (familjerabatt() ? ' och er rabatt' : '')
        + '</span></span>';
    }
    return '<span class="erb-pris">' + (spar > 0 ? '<s>' + esc(kr(e.ordinarie_ore)) + '</s>' : '')
      + '<b>' + esc(kr(fr.pris)) + '</b>'
      + (e.sort === 'plan' ? '<span class="erb-pris-per">för ' + PLANENS_DAGAR + ' dagar</span>' : '')
      + (fr.av ? '<span class="erb-pris-kod">' + esc(medErRabatt) + '</span>' : '') + '</span>';
  }

  /* Koden på en plan (2026-10-13, och bara planerna sedan 2026-10-21,
     Leo: "Båda gäller ENBART planköp, aldrig enskilda pass"). Den prövas
     mot den första planen; gäller den prövas resten, så att varje plan
     kan visa sitt pris, och uppläggen som väntar (egna_upplagg, 2026-10-27,
     Leo: "rabattkod gäller också för upplägg"), med uppläggets pris
     (kod_pa_upplagget). Timmarna till planen tar ingen kod. En kod som inte finns räknas mot taket bara en gång. Tom
     ruta tar bort koden. */
  async function provaErbKod() {
    const fält = $('#erb-kod'), svarEl = $('#erb-kod-svar'), knapp = $('#erb-kod-anvand');
    if (!fält || !svarEl) return;
    const kod = String(fält.value || '').trim().toUpperCase();
    const visa = (text, fel) => { svarEl.textContent = text; svarEl.classList.toggle('is-err', !!fel); };
    if (!kod) { S.erb.kod = null; visa('', false); ritaErbjudanden(); return; }
    const kat = S.erb.katalog.filter(e => e.sort === 'plan');
    if (!kat.length) return;
    await medan(knapp, 'Prövar…', async () => {
      const fråga = e => supa.rpc('kolla_rabattkod_kop', { p_kod: kod, p_erbjudande: e.kod })
        .then(({ data, error }) => (error ? null : (Array.isArray(data) ? data[0] : data)));
      const första = await fråga(kat[0]);
      if (!första) { visa('Koden gick inte att pröva just nu. Försök igen om en stund.', true); return; }
      if (!första.giltig) { S.erb.kod = null; visa(första.orsak || 'Koden gäller inte.', true); ritaErbjudanden(); return; }
      const pris = {};
      pris[kat[0].kod] = Number(första.att_betala_ore);
      const resten = await Promise.all(kat.slice(1).map(fråga));
      resten.forEach((s, i) => { if (s && s.giltig) pris[kat[i + 1].kod] = Number(s.att_betala_ore); });
      const upp = S.erb.upplagg || [];
      const påUpp = await Promise.all(upp.map(u => supa.rpc('kod_pa_upplagget', { p_kod: kod, p_upplagg: u.id })
        .then(({ data, error }) => (error ? null : (Array.isArray(data) ? data[0] : data)))));
      const upplagg = {};
      påUpp.forEach((s, i) => { if (s && s.giltig) upplagg[upp[i].id] = Number(s.att_betala_ore); });
      S.erb.kod = { kod: kod, beskrivning: första.beskrivning || '', pris: pris, upplagg: upplagg };
      /* En kod utan rabatt (en partnerförenings) gäller också: priset är
         detsamma, och koden följer med köpet. */
      const utanRabatt = !(Number(första.rabatt_ore) > 0);
      visa('✓ ' + kod + ' gäller när ni köper en plan' + (första.beskrivning ? ' · ' + första.beskrivning : '')
        + (utanRabatt ? '. Den ger ingen rabatt, men följer med köpet.'
          : upp.length ? '. Priset med koden står på planerna och upplägget.' : '. Priset med koden står på planerna.'), false);
      ritaErbjudanden();
    });
  }

  /* Köpknappen på planerna. Före matchningen
     (2026-10-07) köps inga timmar: ingen vet än vem som ska hålla dem,
     och raden ovanför korten säger det. Knappen är orange (2026-10-12,
     Leo: "Köp knappen ska vara orange"), som Betala i förväg: båda är ett
     val att betala med kort, inget drag. Den låsta står kvar som ghost. */
  const köpKnapp = e => {
    if (!(S.erb.aktiv && !S.väntar)) {
      return '<button type="button" class="btn btn-ghost btn-sm" disabled>' + (S.väntar ? 'Köp' : 'Snart') + '</button>';
    }
    /* En plan gäller 30 dagar från köpet (2026-10-21); Den här månaden och
       Nästa månad stod här samma dag och är borta. */
    /* Kort eller Klarna (2026-10-27, Leo: man betalar "direkt med stripe
       med kort eller med klarna, på enskilda lektioner samt planer"). */
    return '<button type="button" class="btn btn-orange erb-kop" data-kop="' + esc(e.kod) + '">Köp ' + esc(e.namn) + '</button>'
      + '<span class="erb-kop-satt">Kort eller Klarna i nästa steg</span>';
  };

  /* Landa på planerna eller timbanken (#betalning/planer, och #erbjudanden
     som leder dit). Innehållet ovanför ritas när passen och köpen kommit,
     och då flyttar sig målet: landningen görs om efter varje omritning i
     några sekunder, tills man själv rör sidan. */
  function landa() {
    const l = S.landa;
    if (!l || Date.now() > l.till || S.aktivSek !== 'betalning') { S.landa = null; return; }
    const mål = $(l.mål);
    if (mål && !mål.hidden) NXStudie.visaÖverst(mål);
  }

  /* EGNA UPPLÄGG (2026-10-27, Leo: "admin säljer 6 h till familjen därför
     att det är lov och då skickar vi ett upplägg, villkoren är samma men
     det är bara 6h istället"). Ett band per upplägg ovanför planerna, med
     timmarna, priset och Köp. Familjens rabatt dras på varje timme när den
     lämnar ett pris kvar, samma regel som eget_upplagg_kop(); kassan tar
     databasens belopp. Det gäller som en plan, 30 dagar från köpet. */
  function upplaggetsPris(u) {
    const d = Number(S.familjerabatt) || 0;
    const per = Number(u.timpris_ore);
    const ned = d > 0 && d < per ? d : 0;
    /* Med en kod som gäller upplägget (Leo: "rabattkod gäller också för
       upplägg"): databasens pris (kod_pa_upplagget), aldrig räknat här. */
    const kod = S.erb.kod && S.erb.kod.upplagg && S.erb.kod.upplagg[u.id] != null ? S.erb.kod.kod : null;
    const utan = (per - ned) * Number(u.timmar);
    return { per: per - ned, pris: kod ? Number(S.erb.kod.upplagg[u.id]) : utan, utan: utan, rabatt: ned, kod: kod };
  }
  function ritaUpplagg() {
    const host = $('#erb-upplagg');
    if (!host) return;
    const lista = S.erb.upplagg || [];
    if (!lista.length) { host.hidden = true; host.innerHTML = ''; return; }
    const kr = NXBetalning.kronor;
    host.hidden = false;
    host.innerHTML = lista.map(u => {
      const p = upplaggetsPris(u);
      return '<article class="erb-upplagg-kort"><div>'
        + '<h5>Ett upplägg till er</h5>'
        + '<b>' + esc(u.namn) + ': ' + esc(timmarOrd(Number(u.timmar))) + ', '
          + (p.kod && p.pris < p.utan ? '<s>' + esc(kr(p.utan)) + '</s> ' : '') + esc(kr(p.pris)) + '</b>'
        + '<p>' + esc(kr(p.per) + ' i timmen' + (p.rabatt ? ' ' + medErRabatt : '') + (p.kod ? ', med koden ' + p.kod : '')
          + '. Gäller i ' + PLANENS_DAGAR + ' dagar från köpet, som en plan. Köp det senast '
          + datumText(u.giltigt_till) + '.') + '</p>'
        + '</div>'
        + (S.erb.aktiv && !S.väntar
          ? '<button type="button" class="btn btn-orange" data-kop-upplagg="' + esc(u.id) + '">Köp</button>'
          : '<button type="button" class="btn btn-ghost" disabled>Köp</button>')
        + '</article>';
    }).join('');
  }

  /* Köp på ett upplägg: köpvillkoren med timmarna och priset, och sedan
     samma kassa som för en plan, med upplägget id och koden när den gäller
     upplägget. Kassan prövar koden igen och drar det databasen räknat. */
  async function köpUpplägg(knapp, id) {
    const u = (S.erb.upplagg || []).find(x => x.id === id);
    if (!u || !S.erb.aktiv || S.väntar) return;
    const kronor = NXBetalning.kronor;
    const p = upplaggetsPris(u);
    const tl = tilläggIKassan(p.pris);
    const titel = 'Köp ' + u.namn;
    if (!await NXStudie.kassansVillkor({
      titel: titel,
      rader: [timmarOrd(Number(u.timmar)) + ' läxhjälp · ' + kronor(p.pris) + (p.kod ? ' med koden ' + p.kod : ''),
        'Gäller i ' + PLANENS_DAGAR + ' dagar från köpet, som en plan'],
      tillagg: tl,
      text: 'Ni betalar med kort eller Klarna i nästa steg.'
    })) return;
    const extra = tl && tl.valfri && !tl.med ? { med_tillagg: false } : {};
    const kropp = ui => Object.assign({ upplagg: id, retur: location.origin, ui: ui, villkor: true },
      p.kod ? { rabattkod: p.kod } : {}, extra);
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKassa(kropp('inbaddad'));
      if (!svar) { laddaErbjudanden().catch(() => {}); return; }
      const vad = timmarOrd(Number(u.timmar)) + ' · ' + kronor(svar.belopp_ore != null ? svar.belopp_ore : p.pris)
        + medVad(Number(svar.familjerabatt_ore) > 0, svar.rabattkod || null) + tilläggISvaret(svar);
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try { await öppnaKassa(knapp, null, svar, Stripe, { titel: titel, vad: vad, klar: köpKlart }); return; }
          catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKassa(kropp('sida'));
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  function ritaErbjudanden() {
    const planer = $('#erb-planer');
    if (!planer) return;
    ritaUpplagg();
    /* Bara planerna (2026-10-22): Fyll timbankens kolumn stod bredvid
       dem till samma dag. */
    const kat = S.erb.katalog;
    planer.innerHTML = kat.filter(e => e.sort === 'plan').map(erbKort).join('')
      || tomt('Inga erbjudanden just nu', 'Skriv till oss om ni vill ha ett upplägg.');

    /* Första timmen gratis som erbjudande (2026-10-15, Leo: "det ska stå
       som erbjudande i deras erbjudanden. sen när de köpt sin plan för
       första gången så ändras synen på erbjudande"). Rutan står när
       databasen säger att timmen inte är tagen och det finns en plan att
       köpa. Den första planen får timmen också med en rabattkod (Leo samma
       kväll), och sedan säger forsta_timmen_lage() tagen, och rutan går. */
    const ftRuta = $('#erb-forsta-box');
    if (ftRuta) ftRuta.hidden = !(S.forstaTimmen && !S.forstaTimmen.tagen && kat.some(e => e.sort === 'plan'));

    /* Rabattkoden står bara där familjen kan köpa en plan. */
    const kodRad = $('#erb-kod-rad');
    if (kodRad) kodRad.hidden = !(S.erb.aktiv && !S.väntar && kat.some(e => e.sort === 'plan'));

    const msg = $('#erb-msg');
    if (msg && S.väntar && !msg.classList.contains('show')) {
      säg(msg, 'Timmarna köper ni när vi matchat er med en studiehjälpare. Vi hör av oss när det är klart.', true);
    } else if (msg && !S.erb.aktiv && !msg.classList.contains('show')) {
      säg(msg, 'Erbjudandena går att köpa här inom kort. Vill ni ha ett redan nu, skriv till oss så ordnar vi det.', true);
    }

    /* Rutan Eget upplägg går till kontaktformuläret sedan 2026-10-22, och
       länken står i sidan: här skrevs mejladressen med ämnet till dess. */

    /* Vägen hit från Betalning (Fas 21.3). Har familjen redan timmar
       står knappen Betala med timmar på passen, och då är tipset brus. */
    const tips = $('#bet-erb-tips');
    if (tips) tips.hidden = !(S.erb.aktiv && S.erb.katalog.length && !S.erb.kort.some(k => k.brukbar));

    /* Tillgängliga timmar (2026-10-12, Leo: "lägg till de även under
       erbjudanden, tillgängliga timmar och sedan ska man hänvisas till
       inställningar för att läsa villkor eller liknande"). Rutan står
       alltid, också tom: timmarna som går att använda i dag, de sparade
       minuterna och varje köp som gäller. Förklaringen, passen timmarna
       betalat och villkoren står under Profil → Timbanken, och rutan
       hänvisar dit i stället för att upprepa dem. Timmar som redan ligger
       på ett förslag eller ett bokat pass är inte tillgängliga: kvar
       räknas i databasen (klippkort_saldo). */
    ritaTillgängliga();
    requestAnimationFrame(landa);
  }

  /* ============================================================
     BATTERIET I TIMBANKEN (2026-10-15)

     Leo: "i timbanken kan du göra en animerad bild som ändras beroende
     på hur många timmar. så typ som ett batteri bara att orange timmar är
     köpta och gratis är gröna. sen kan det stå 9av 9 timmar finns kvar".
     En ruta per timme i det som gäller nu: köpen som inte gått ut, med
     de timmar som använts tomma, planens gratis timme medan den gäller
     efter planen, och timmarna för tips (en använd så länge passet är
     högst 60 dagar gammalt, som timmen gällde). Gratis timmar står
     närmast de tomma, för de dras först. Fler än BATTERI_RUTOR timmar
     blir en stapel. De sparade minuterna är inga timmar och står bredvid,
     som förut.

     Skriptet sätter klasserna och CSS rör sig: rutorna fylls en i taget
     första gången batteriet syns, och de som ändras byter färg när
     timmarna ändras. Batteriet är samma element mellan omritningarna
     (batterier), så att inget fylls om från tomt när rutan ritas om.
     ============================================================ */
  const BATTERI_RUTOR = 24;
  const batterier = {};

  function batteriTimmar() {
    const idag = isoFor(new Date());
    let köpta = 0, gratis = 0, använda = 0;
    S.erb.kort.forEach(k => {
      if (k.status !== 'betald') return;
      // Nästa månads plan (2026-10-21) gäller inte än; den står per månad under batteriet.
      if (k.galler_fran && String(k.galler_fran) > idag) return;
      const tim = Math.max((Number(k.timmar) || 0) - (Number(k.aterbetalda_timmar) || 0), 0), kvar = Number(k.kvar) || 0;
      if (String(k.giltigt_till) >= idag) {
        const g = NXBetalning.gratistimmar(k) ? kvar : Math.min(Number(k.gratis_kvar) || 0, kvar);
        gratis += g;
        köpta += kvar - g;
        använda += Math.max(tim - kvar, 0);
      } else if (harGratis(k, idag)) {
        gratis += kortetsTimmar(k, idag);
      }
    });
    if (S.tips && Number(S.tips.timmar || 0)) {
      const sedan = isoFor(new Date(Date.now() - 60 * 864e5));
      gratis += Number(S.tips.kvar || 0);
      använda += Math.min(Number(S.tips.anvanda || 0), (S.bokningar || []).filter(b => b.rabattkod === 'TIPS'
        && b.status !== 'cancelled' && String(b.wanted_date) >= sedan).length);
    }
    return { köpta: köpta, gratis: gratis, kvar: köpta + gratis, alla: köpta + gratis + använda };
  }

  function nyttBatteri() {
    const el = document.createElement('div');
    el.className = 'tb-batteri';
    el.innerHTML = '<div class="tb-batteri-bild" role="img"><div class="tb-batteri-kropp"></div>'
      + '<span class="tb-batteri-pol"></span></div>'
      + '<p class="tb-batteri-tal"></p><p class="tb-batteri-not"></p>';
    const b = { el: el, sett: !('IntersectionObserver' in window), mål: null };
    if (!b.sett) {
      const syn = new IntersectionObserver(poster => {
        if (!poster.some(p => p.isIntersecting)) return;
        syn.disconnect();
        b.sett = true;
        fyllBatteri(b);
      });
      syn.observe(el);
    }
    return b;
  }

  /* Talet och färgerna. Före första gången batteriet syns står rutorna
     tomma, så att det fylls framför ögonen. */
  function fyllBatteri(b) {
    const t = b.mål, kropp = b.el.querySelector('.tb-batteri-kropp');
    const delar = [t.köpta ? t.köpta + (t.köpta === 1 ? ' köpt' : ' köpta') : '',
      t.gratis ? t.gratis + ' gratis' : ''].filter(Boolean);
    b.el.querySelector('.tb-batteri-bild').setAttribute('aria-label', t.alla
      ? t.kvar + ' av ' + timText(t.alla) + ' kvar' + (delar.length ? ': ' + delar.join(' och ') : '')
      : 'Inga timmar i timbanken');
    b.el.querySelector('.tb-batteri-tal').innerHTML = t.alla
      ? '<b>' + t.kvar + '</b> av ' + esc(timText(t.alla)) + ' kvar'
      : 'Inga timmar i timbanken';
    const not = b.el.querySelector('.tb-batteri-not');
    not.innerHTML = (t.köpta ? '<span class="kopt">' + esc(delar[0]) + '</span>' : '')
      + (t.gratis ? '<span class="gratis">' + esc(delar[delar.length - 1]) + '</span>' : '');
    not.hidden = !t.kvar;

    const stapel = t.alla > BATTERI_RUTOR;
    b.el.classList.toggle('stapel', stapel);
    if (stapel) {
      if (!kropp.querySelector('.tb-stapel')) {
        kropp.innerHTML = '<span class="tb-stapel"><i class="kopt"></i><i class="gratis"></i></span>';
      }
      if (!b.sett) return;
      const delarna = kropp.querySelectorAll('.tb-stapel i');
      void kropp.offsetWidth;
      delarna[0].style.setProperty('--b', (100 * t.köpta / t.alla) + '%');
      delarna[1].style.setProperty('--b', (100 * t.gratis / t.alla) + '%');
      return;
    }
    if (kropp.querySelector('.tb-stapel')) kropp.innerHTML = '';
    const rutor = kropp.children;
    while (rutor.length > t.alla) kropp.removeChild(kropp.lastElementChild);
    while (rutor.length < t.alla) {
      const r = document.createElement('i');
      r.className = 'tb-ruta';
      kropp.appendChild(r);
    }
    if (!b.sett) return;
    void kropp.offsetWidth;
    /* Bara de rutor som byter färg rör sig, i tur och ordning (--d). */
    let tur = 0;
    Array.prototype.forEach.call(rutor, (r, j) => {
      const ny = j < t.köpta ? 'kopt' : j < t.kvar ? 'gratis' : '';
      const nu = r.classList.contains('kopt') ? 'kopt' : r.classList.contains('gratis') ? 'gratis' : '';
      if (ny === nu) return;
      r.style.setProperty('--d', tur++);
      r.classList.toggle('kopt', ny === 'kopt');
      r.classList.toggle('gratis', ny === 'gratis');
    });
  }

  /* Byter platshållaren [data-batteri] i det som just ritats mot
     batteriet med samma namn, och fyller det. */
  function sättBatterier(värd) {
    värd.querySelectorAll('[data-batteri]').forEach(plats => {
      const namn = plats.getAttribute('data-batteri');
      const b = batterier[namn] || (batterier[namn] = nyttBatteri());
      plats.parentNode.replaceChild(b.el, plats);
      b.mål = batteriTimmar();
      fyllBatteri(b);
    });
  }

  /* Köpta timmar orange och gratis gröna, som i batteriet. */
  const mätare = (köpta, gratis, alla, text) => '<div class="erb-matare" role="img" aria-label="' + esc(text) + '">'
    + (köpta > 0 && alla ? '<i class="kopt" style="width:' + Math.round(100 * köpta / alla) + '%"></i>' : '')
    + (gratis > 0 && alla ? '<i class="gratis" style="width:' + Math.round(100 * gratis / alla) + '%"></i>' : '')
    + '</div>';

  /* Er timbank: köpta timmar, sparade minuter och sedan 2026-10-13
     timmarna för tips. Sedan 2026-10-15 står de i batteriet, timmarna
     för tips som gratis timmar, och minuterna bredvid. */
  function ritaTillgängliga() {
    const box = $('#erb-mina-box'), mina = $('#erb-mina');
    if (!box || !mina) return;
    const brukbara = S.erb.kort.filter(k => k.brukbar);
    // Nästa månads plan (2026-10-21) gäller inte än, men står med.
    const idagE = isoFor(new Date());
    const kommande = S.erb.kort.filter(k => k.status === 'betald' && k.galler_fran && String(k.galler_fran) > idagE);
    const minuter = S.erb.bank.saldo;
    const t = batteriTimmar();
    box.hidden = false;
    mina.innerHTML = '<div class="erb-mitt erb-tillg">'
      + '<div class="erb-mitt-topp"><b>Tillgängliga timmar</b>'
      + (minuter ? '<span>och ' + esc(tidLängd(minuter) + ' sparat') + '</span>' : '') + '</div>'
      + '<div data-batteri="erbjudanden"></div>'
      + planRader()
      + (t.kvar || minuter ? ''
        : '<p class="erb-bank-text">Köp en plan nedan, så fyller timmarna er timbank och betalar era pass av sig själva.</p>')
      + '</div>'
      + brukbara.map(k => kortRad(k)).join('')
      + kommande.map(k => kortRad(k)).join('')
      + extraRuta()
      + tipsKort(false)
      + '<p class="erb-bank-text erb-tillg-lank">Hur timmarna används, hur länge de gäller och villkoren står under '
      + '<a href="#profil/timbank">Profil &amp; inställningar → Timbanken</a>.</p>';
    sättBatterier(mina);
  }

  /* ============================================================
     KÖP TILL TIMMAR (2026-10-14, timmarna_delas_och_kops_till)

     Leo: "man kan köpa till timmar med plan men de går ut när månaden är
     slut. man ska kunna välja hur många timmar man köper, det ska finnas
     välj själv knapp och checkout för de specifika timmarna". Under Er
     timbank, när familjen har en plan som gäller minst en dag till:
     Välj själv öppnar ett val av 1–20 timmar, till planens timpris
     (klippkort_saldo.rabatterat_timpris_ore), och timmarna går ut med
     planen. Kassan räknar priset själv (extra_timmar_erbjudande); här
     visas det bara i förväg.
     ============================================================ */
  S.extra = { öppen: false, timmar: 2 };
  const EXTRA_MAX = 20;

  /* Planen timmarna köps till, som extra_timmar_erbjudande väljer den:
     den senaste betalda planen som gäller minst en dag till. */
  function planFörExtra() {
    const idag = isoFor(new Date());
    return S.erb.kort
      .filter(k => k.sort === 'plan' && k.status === 'betald' && String(k.giltigt_till) > idag
        // planerna_per_manad (2026-10-21): den här månadens plan, inte nästa och inte timmar till en plan.
        // Ett eget upplägg är en plan (2026-10-27, Leo: "Samma sak som vanliga planer bara annat antal timmar").
        && (!k.galler_fran || String(k.galler_fran) <= idag) && !k.till_plan)
      .sort((a, c) => String(c.giltigt_till).localeCompare(String(a.giltigt_till))
        || String(c.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  }

  function extraRuta() {
    const plan = S.erb.aktiv && !S.väntar ? planFörExtra() : null;
    // Före migrationen saknas timpriset i vyn, och då står ingen knapp.
    const timpris = plan ? Number(plan.rabatterat_timpris_ore) : 0;
    if (!plan || !(timpris > 0)) return '';
    const n = S.extra.timmar;
    // Priset efter familjens rabatt, som extra_timmar_erbjudande räknar det.
    const perTimme = extraTimpris(timpris);
    return '<div class="erb-mitt erb-extra">'
      + '<div class="erb-mitt-topp"><b>Köp till timmar</b><span>' + esc(NXBetalning.kronor(timpris) + ' i timmen') + '</span></div>'
      + '<p class="erb-bank-text">' + esc('Timmar till ' + plan.namn + ', till planens timpris. De går ut med planen, '
        + datumText(plan.giltigt_till) + '.') + '</p>'
      + (S.extra.öppen
        ? '<div class="erb-extra-val">'
          + '<div class="erb-steg" role="group" aria-label="Antal timmar">'
          + '<button type="button" class="erb-steg-knapp" data-extra-steg="-1" aria-label="En timme färre"'
          + (n <= 1 ? ' disabled' : '') + '>−</button>'
          + '<output class="erb-steg-tal" aria-live="polite">' + esc(timText(n)) + '</output>'
          + '<button type="button" class="erb-steg-knapp" data-extra-steg="1" aria-label="En timme till"'
          + (n >= EXTRA_MAX ? ' disabled' : '') + '>+</button>'
          + '</div>'
          + '<p class="erb-extra-pris"><b>' + esc(NXBetalning.kronor(perTimme * n)) + '</b>'
          + (perTimme < timpris ? '<span class="erb-extra-rabatt">' + esc(medErRabatt) + '</span>' : '') + '</p>'
          + '<button type="button" class="btn btn-orange" data-extra-kop>Till kassan</button>'
          + '</div>'
        : '<button type="button" class="btn btn-ghost btn-sm" data-extra-valj>Välj själv</button>')
      + '</div>';
  }

  /* Stegen ändrar bara talet och priset, på plats: rutan ritas inte om
     under fingret, och fokus står kvar på knappen. */
  function uppdateraExtra() {
    const ruta = $('#erb-mina .erb-extra');
    const plan = planFörExtra();
    if (!ruta || !plan) { ritaTillgängliga(); return; }
    const n = S.extra.timmar;
    const tal = ruta.querySelector('.erb-steg-tal'), pris = ruta.querySelector('.erb-extra-pris b');
    if (tal) tal.textContent = timText(n);
    if (pris) pris.textContent = NXBetalning.kronor(extraTimpris(Number(plan.rabatterat_timpris_ore)) * n);
    const minus = ruta.querySelector('[data-extra-steg="-1"]'), plus = ruta.querySelector('[data-extra-steg="1"]');
    if (minus) minus.disabled = n <= 1;
    if (plus) plus.disabled = n >= EXTRA_MAX;
  }

  /* Planens timpris minus familjens rabatt, när den lämnar ett pris kvar:
     samma regel som extra_timmar_erbjudande(), som kassan drar efter. */
  const extraTimpris = timpris => (familjerabatt() > 0 && familjerabatt() < timpris ? timpris - familjerabatt() : timpris);

  async function köpTillPlanen(knapp) {
    const plan = planFörExtra();
    if (!plan || !S.erb.aktiv || S.väntar) return;
    const n = S.extra.timmar;
    const tl = tilläggIKassan(null);
    if (!await NXStudie.kassansVillkor({
      titel: 'Köp till timmar',
      rader: [timText(n) + ' till ' + plan.namn, 'Gäller till och med ' + datumText(plan.giltigt_till) + ', som planen'],
      tillagg: tl,
      text: 'Priset står i kassan, och betalningen görs med kort i nästa steg.'
    })) return;
    await köpIKassan(knapp, 'plan_extra', Object.assign({ timmar: n }, tl && tl.valfri && !tl.med ? { med_tillagg: false } : {}),
      'Köp till timmar',
      svar => timText(n) + ' till ' + plan.namn + (svar.belopp_ore ? ' · ' + NXBetalning.kronor(svar.belopp_ore) : '')
        + (Number(svar.familjerabatt_ore) > 0 ? ' ' + medErRabatt : '') + tilläggISvaret(svar));
  }

  /* Ett köpt kort: timmarna kvar som en mätare, och sista dagen. Samma
     rad i Era timmar och under Profil → Timbanken, där passen kortet
     betalat står under den (under). */
  function kortRad(k, under) {
    const idag = isoFor(new Date());
    /* En plan som gått ut med sin gratis timme kvar (gratistimmarna_60_dagar,
       2026-10-13): timmen gäller till 60 dagar efter köpet, och raden
       visar den och dess sista dag. */
    const baraGratis = k.brukbar && String(k.giltigt_till) < idag && harGratis(k, idag);
    const kvar = baraGratis ? kortetsTimmar(k, idag) : Number(k.kvar);
    // Timmar som betalats tillbaka (2026-10-21) räknas inte.
    const tim = Math.max(Number(k.timmar) - (Number(k.aterbetalda_timmar) || 0), 0);
    const kommande = !!(k.galler_fran && String(k.galler_fran) > idag);
    const sista = baraGratis ? k.gratis_till : k.giltigt_till;
    /* Tio dagar före sista dagen går påminnelsemejlet (Fas 21.2), och
       vyn säger samma sak från samma dag: timmar som inte används
       förfaller. */
    const dagarKvar = Math.round((Date.parse(String(sista)) - Date.parse(idag)) / 864e5);
    const snart = k.brukbar && dagarKvar >= 0 && dagarKvar <= 10;
    const läge = k.status === 'aterbetald' ? 'Återbetalt'
      : k.status === 'tvist' ? 'Betalningen är ifrågasatt'
      : kvar === 0 ? 'Förbrukat'
      : baraGratis ? 'Gratistimmen gäller till ' + datumText(k.gratis_till)
      : kommande ? 'Gäller 1–' + Number(String(k.giltigt_till).slice(8)) + ' ' + månadensNamn(k.galler_fran)
      : String(k.giltigt_till) < idag ? 'Gick ut ' + datumText(k.giltigt_till)
      : 'Gäller till ' + datumText(k.giltigt_till);
    /* Gratistimmar som admin satt in (gratistimmar) är gratis rakt igenom. */
    const gratis = NXBetalning.gratistimmar(k) ? ' · gratis, från oss'
      : !baraGratis && harGratis(k, idag) && String(k.giltigt_till) >= idag
      ? ' · ' + (Number(k.gratis_kvar) === 1 ? '1 gratis timme' : k.gratis_kvar + ' gratis timmar')
        + ', som dras först och gäller till ' + datumText(k.gratis_till)
      : S.forstaTimmen && S.forstaTimmen.plan_id === k.id ? ' · första timmen gratis ingår' : '';
    /* Gratis timmar gröna och köpta orange, som i batteriet (2026-10-15). */
    const gratisKvar = NXBetalning.gratistimmar(k) || baraGratis ? kvar
      : String(k.giltigt_till) >= idag ? Math.min(Number(k.gratis_kvar) || 0, kvar) : 0;
    return '<div class="erb-mitt' + (k.brukbar || kommande ? '' : ' ar-slut') + (kommande ? ' ar-kommande' : '') + '">'
      + '<div class="erb-mitt-topp"><b>' + esc(k.namn) + '</b><span>' + esc(läge) + '</span></div>'
      + mätare(kvar - gratisKvar, gratisKvar, tim, kvar + ' av ' + tim + ' timmar kvar')
      + '<span class="erb-kvar"><b>' + kvar + '</b> av ' + tim + ' timmar kvar' + esc(gratis) + '</span>'
      + (snart ? '<p class="erb-snart">'
        + esc(dagarKvar === 0 ? 'Sista dagen är i dag.' : dagarKvar === 1 ? 'Sista dagen är i morgon.' : 'Sista dagen är om ' + dagarKvar + ' dagar.')
        + ' Timmar som inte används förfaller. <a href="#boka">Boka ett pass</a></p>' : '')
      + (under || '')
      + '</div>';
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

  /* Köpen ett pass drogs från, en rad per köp (klippkort_rorelser). Tom
     innan de hämtats. */
  const passetsDrag = id => Object.keys(S.erb.dragningar || {})
    .reduce((alla, k) => alla.concat(S.erb.dragningar[k].filter(r => r.booking_id === id)), []);

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
    /* Batteriet (2026-10-15) överst, när det finns timmar att visa. */
    const batteri = (batteriTimmar().alla ? '<div data-batteri="profil"></div>' : '') + planRader();
    if (!kort.length) {
      /* Har familjen timmar för tips står de under, så då är det bara
         köpta timmar och gratistimmar den saknar. */
      const tips = tipsKort(true);
      host.innerHTML = batteri + '<p class="erb-bank-text tb-inga">'
        + (tips ? 'Ni har inga köpta timmar eller gratistimmar.' : 'Ni har inga timmar i timbanken.')
        + (S.erb.aktiv ? ' Köper ni en plan betalar timmarna era pass av sig själva. '
          + '<a href="#betalning/planer">Se planerna</a>' : '')
        + '</p>'
        + tips;
      sättBatterier(host);
      return;
    }
    /* Gratistimmarna (2026-10-13) står med de köpta och dras först. */
    const gratis = kort.some(NXBetalning.gratistimmar);
    host.innerHTML = batteri + '<p class="erb-bank-text tb-forklaring">Timmarna betalar era pass av sig själva. När ni föreslår '
      + 'ett pass dras först gratis timmar' + (gratis ? ', också gratistimmarna från oss,' : '')
      + ' sedan timmarna från det köp som går ut först, och föreslår studiehjälparen en annan tid följer de med. '
      + 'En gratis timme i en plan gäller i 60 dagar från köpet, också om planens andra timmar gått ut. '
      + 'Säger hen nej, eller drar ni tillbaka förslaget, kommer de tillbaka, och det gör de också när ett förslag ingen '
      + 'svarat på har passerat. Köper ni timmar, sätter vi in gratistimmar eller kommer timmar tillbaka, betalar de era '
      + 'pass i datumordning. '
      + 'Räcker inte ett köp till hela passet tas resten från nästa, högst två köp per pass. På ett pass där första '
      + 'timmen eller tipstimmen är på köpet betalar timmarna resten. Ett pass med fler barn betalas med kort. '
      + (gratis ? 'Gratistimmar från oss gäller i 60 dagar, det som blir över av en sådan timme sparas inte, och de '
        + 'betalas aldrig ut. ' : '')
      + '<a href="/anvandarvillkor#erbjudanden" target="_blank" rel="noopener">Villkoren för timmarna</a></p>'
      + kort.map(k => kortRad(k, kortetsPass(k))).join('')
      + tipsKort(true);
    sättBatterier(host);
  }

  function ritaTimbankProfil() {
    ritaTimbankTimmar();
    /* Passen räknar de använda timmarna för tips, och de kan komma efter
       köpen: batteriet i Er timbank följer med. */
    Object.keys(batterier).forEach(namn => {
      const b = batterier[namn];
      if (!b.el.isConnected) return;
      b.mål = batteriTimmar();
      fyllBatteri(b);
    });
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
        + (S.erb.aktiv ? ' Minuterna kommer ur timmar ni köpt i förväg. <a href="#betalning/planer">Se planerna</a>' : '')
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
      + '<p class="erb-bank-text">Här sparas det som blir över när ett pass betalt med köpta timmar slutar före en hel timme: '
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
    const passId = p.pass, kod = p.kod, extra = p.extra, tillägg = p.tillägg;
    stängBetalpanel();
    const reserv = passId ? await startaBetalning(passId, 'sida', tillägg) : kod ? await startaKöp(kod, 'sida', extra) : null;
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
    const [pass, und, till, senPass] = await Promise.all([
      NXStudie.passMedSvar(supa, S,
        'id, subject, format, location, note, wanted_date, wanted_time, duration_min, antal_barn, tjanst, status, student_id, parent_id, tutor_id, created_by, created_at, avbokningsskal, avbokad_at, avbokad_av, betalning_status, betald_at, fakturerbar, betalt_ore, aterbetald_ore, klippkort_id, timpris_ore, extra_ore, rabatt_ore, startrabatt, rabattkod',
        q => q.eq('parent_id', S.user.id).order('wanted_date', { ascending: true })),
      NXStudie.hämtaAlla(supa, 'passunderlag',
        'id, debiterade_min, betalda_min, timpris_ore, extra_ore, rabatt_ore, timbank_min',
        q => q.eq('parent_id', S.user.id)),
      NXStudie.hämtaAlla(supa, 'pass_tillagg', 'id, booking_id, minuter, begart_ore, status, betalt_ore, betald_at'),
      /* Sen avbokning (sen_avbokning, 2026-10-22): vad ett pass som
         avbokades mindre än 12 timmar före start kostar. En egen fråga, så
         att vyn tål att kolumnerna saknas innan migrationen körts. */
      NXStudie.hämtaAlla(supa, 'bookings', 'id, sen_avbokning_minuter, sen_avbokning_ore',
        q => q.eq('parent_id', S.user.id).eq('status', 'cancelled').not('sen_avbokning_minuter', 'is', null))
    ]);
    const { data, error } = pass;

    if (error) { host.innerHTML = '<div class="empty">' + esc(felText(error)) + '</div>'; return; }
    S.bokningar = data || [];
    if (senPass.error) console.warn('De sena avbokningarna gick inte att läsa', senPass.error);
    else {
      const sena = {};
      (senPass.data || []).forEach(x => { sena[x.id] = x; });
      S.bokningar.forEach(b => {
        if (sena[b.id]) {
          b.sen_avbokning_minuter = sena[b.id].sen_avbokning_minuter;
          b.sen_avbokning_ore = sena[b.id].sen_avbokning_ore;
        }
      });
    }
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
    requestAnimationFrame(landa);
    // Timbankens rörelser under Profil nämner passen vid namn.
    ritaTimbankProfil();
    // Förslagen som väntar tar av timmarna överst i Boka pass.
    ritaBokaTimmar();
    /* Står man på ett pass när listan laddas om — efter ett svar, en
       avbokning, en ny tid — ritas sidan om med det som nu gäller. */
    if (passIdIAdressen()) ritaPassSida();
    ritaPassListan();
  }

  /* Mina lektioner. Egen funktion sedan 2026-10-27: barnets förslag står
     i listan och kommer i ett eget svar, som ritar om den. */
  function ritaPassListan() {
    const host = $('#pass-lista');
    if (!host || !S.laddatPass) return;
    if (!S.bokningar.length && !(S.bf.lista || []).length) { host.innerHTML = tomt('Inga bokade pass än', 'Boka en tid under Boka pass, så står passet här.'); return; }

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
           familj som undrar vad som hände. Ett genomfört pass betalas med
           samma knapp (2026-10-21: Bekräfta rapport är borta). */
        knappar = radBetala(b);
      }

      /* Platsen står direkt på raden, och passRad ritar den. Ett pass
         på plats är en resa — var man ska vara är halva beskedet. */
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        med: medBarn(b),
        nu: b.wanted_date === isoFor(new Date()) && b.status !== 'cancelled',
        dag: dagTon(b),
        lage: förslagsMärke(b),
        vem: derasFörslag && ärMotförslag(b)
          ? (hjälparensFörnamn() ? hjälparensFörnamn() + ' kan inte er tid och föreslår den här' : 'Motförslag från er studiehjälpare')
          : derasFörslag && b.status === 'requested'
          ? (hjälparensFörnamn() ? hjälparensFörnamn() + ' föreslår den här tiden' : 'Föreslaget av er studiehjälpare')
          : b.status === 'requested'
          ? 'Väntar på svar från ' + (hjälparensFörnamn() || 'er studiehjälpare')
          : b.status === 'cancelled' ? avbokadText(b) : null,
        /* Studiehjälparens rader, kapade: hela står på passets sida. */
        not: b.svar_meddelande && (b.status === 'cancelled' || ärMotförslag(b))
          ? NXKontakt.kortNot(b.svar_meddelande) : null,
        märke: passMärke(b),
        atgarder: knappar
      });
      },
      /* Barnets förslag (2026-10-27) står bland de kommande passen, i sitt
         datum, så att alla önskade tider syns på ett ställe och det syns
         vem som önskat dem. Det är inget pass förrän ni skickat det. */
      extra: S.väntar ? [] : (S.bf.lista || []).map(f => ({ wanted_date: f.datum, wanted_time: f.tid, bf: f })),
      extraRad: x => {
        const f = x.bf, namn = barnetsNamn(f.barn_id);
        return NXKontakt.passRad({ wanted_date: f.datum, wanted_time: f.tid, duration_min: f.langd_min,
                                    subject: f.amne, format: f.format, location: f.plats, status: 'requested' }, {
          href: '#boka/forslag-' + f.id,
          dag: 'barn',
          lage: { text: namn + ' önskar', klass: 'gor' },
          vem: namn + ' föreslår den här tiden. Granska och skicka den till er studiehjälpare, eller låt bli.',
          atgarder: '<button type="button" class="btn btn-primary btn-sm" data-bf-granska="' + esc(f.id) + '">Granska</button>'
        });
      }
    });
  }

  /* Kortbetalningen av ett pass, eller av dess tillägg (Fas 20.1). EN
     väg för båda: tillägget är en variant av samma kassa, inte en kopia
     av den. Skillnaden är vad funktionen ombeds ta betalt för och vad
     panelen säger överst. */
  async function betalaIKassan(knapp, passId, tillägg) {
    /* Köpvillkoren först (2026-10-21): avbryter ni här händer ingenting. */
    const b = (S.bokningar || []).find(x => x.id === passId);
    /* Syskontillägget buntas inte med ett pass (syskontillagg_som_skuld,
       2026-10-21: passets betalning skrivs på tre vägar, se migrationen).
       Rutan säger beloppet för sig, och att det betalas på annat sätt. */
    const sk = S.syskon && Number(S.syskon.upplupna) > 0 ? S.syskon : null;
    if (!await NXStudie.kassansVillkor({
      titel: tillägg ? 'Betala tillägget' : 'Betala passet',
      rader: b ? [(b.subject ? b.subject + ', ' : '') + datumText(b.wanted_date)
        + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : '')] : [],
      tillagg: sk && !tillägg ? { rad: 'Upplupet tillägg för extra barn, ' + NXBetalning.kronor(sk.upplupet_ore)
        + ': ingår inte här. Betala det med Betala tillägg nu under Betalning, eller med nästa köp av timmar.',
        valfri: false, med: false } : null,
      text: 'Beloppet står i kassan, och ni betalar med kort eller Klarna i nästa steg.'
    })) return;
    await medan(knapp, 'Öppnar…', async () => {
      // Stripe.js hämtas medan sessionen skapas, inte efter.
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
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
       databasen — samma skäl som att payouts med flit saknar
       INSERT-policy för användare: kan ingen skicka in ett belopp kan
       ingen skicka in fel belopp. */
    const tim = e.target.closest('[data-timmar]');
    if (tim) { await betalaMedTimmar(tim, tim.dataset.timmar); return; }
    const tb = e.target.closest('[data-timbank]');
    if (tb) { await betalaMedBanken(tb, tb.dataset.timbank); return; }
    const köp = e.target.closest('[data-kop]');
    if (köp) { await köpErbjudande(köp, köp.dataset.kop); return; }
    // Ett eget upplägg (2026-10-27) som admin skickat.
    const ku = e.target.closest('[data-kop-upplagg]');
    if (ku) { await köpUpplägg(ku, ku.dataset.kopUpplagg); return; }
    if (e.target.closest('#erb-kod-anvand')) { await provaErbKod(); return; }
    /* Köp till timmar (2026-10-14): Välj själv, stegen och kassan. */
    if (e.target.closest('[data-extra-valj]')) {
      S.extra.öppen = true;
      ritaTillgängliga();
      const plus = $('#erb-mina [data-extra-steg="1"]');
      if (plus) plus.focus();
      return;
    }
    const steg = e.target.closest('[data-extra-steg]');
    if (steg) {
      S.extra.timmar = Math.min(EXTRA_MAX, Math.max(1, S.extra.timmar + Number(steg.dataset.extraSteg)));
      uppdateraExtra();
      return;
    }
    const ek = e.target.closest('[data-extra-kop]');
    if (ek) { await köpTillPlanen(ek); return; }

    /* Kortet (kortet_reserveras, 2026-10-13). */
    const kv = e.target.closest('[data-kort-val]');
    if (kv) { await väljKort(kv, kv.dataset.kortVal, true); return; }
    const kb = e.target.closest('[data-kort-bort]');
    if (kb) { await väljKort(kb, kb.dataset.kortBort, false); return; }
    const ks = e.target.closest('[data-kort-spara]');
    if (ks) { await sparaKort(ks); return; }
    const kt = e.target.closest('[data-kort-ta-bort]');
    if (kt) { await taBortKort(kt); return; }
    // Betala alla (2026-10-27): flera pass i samma kassa.
    const ba = e.target.closest('[data-betala-alla]');
    if (ba) { await betalaAlla(ba); return; }
    const bet = e.target.closest('[data-betala]');
    if (bet) { await betalaIKassan(bet, bet.dataset.betala, false); return; }
    // Betala tillägg nu (syskontillagg_som_skuld, 2026-10-21).
    const sk = e.target.closest('[data-betala-skuld]');
    if (sk) { await betalaSkulden(sk); return; }
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
    /* Sen avbokning (sen_avbokning, 2026-10-22): mindre än 12 timmar före
       start säger rutan vad det kostar innan familjen bestämt sig, med
       databasens svar (sen_avbokning_lage). */
    const sen = !förslag && passet ? await senAvbokningLäge(passet, true) : null;
    const timmarTillbaka = passet && (medTimmar(passet) || medBanken(passet))
      ? (sen ? ' Hälften av tiden, ' + tidLängd(sen.minuter) + ', dras ur ' + (medTimmar(passet) ? 'timmarna' : 'timbanken')
          + (medGratistimmar(passet) ? '. Gratistimmar sparar inga minuter, så en påbörjad gratistimme är använd.'
            : ', och resten kommer tillbaka.')
        : medTimmar(passet) ? ' Timmarna ni betalade med kommer tillbaka.' : ' Minuterna ni betalade med kommer tillbaka till timbanken.')
      : '';
    const skäl = await NXStudie.avbokaRuta(förslag ? {
      titel: 'Dra tillbaka förslaget?',
      text: 'Vill ni hellre ha en annan tid, välj Ändra tiden i stället.',
      knapp: 'Dra tillbaka',
      avbryt: 'Behåll förslaget',
      not: 'Er studiehjälpare får ett mejl om att förslaget är tillbakadraget och varför.' + timmarTillbaka
    } : {
      titel: 'Avboka passet?',
      text: sen
        ? 'Passet börjar om mindre än 12 timmar, så det räknas som en sen avbokning: '
          + (sen.kronor > 0 ? 'ni betalar hälften av passet, ' + NXBetalning.kronor(sen.kronor) + '.'
            : 'passet räknas som hållet i halva tiden.' + (passet.startrabatt && !timmarTillbaka ? ' Timmen på köpet är då använd.' : ''))
        : 'Vill ni hellre byta tid, välj Föreslå ny tid i stället — då ligger passet kvar tills er studiehjälpare svarat.',
      knapp: sen ? 'Avboka ändå' : undefined,
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
     Bara det som väntar på er. Samma poster står i klockan och i
     rutan vid inloggningen (NXStudie.notisruta, 2026-10-12).
     ============================================================ */
  function ritaNotiser() {
    const hus = $('#notis-hus');
    if (!hus) return;
    NXStudie.notiser(hus, notisposter());
  }

  function notisposter() {
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

    /* Barnens förslag (barnet_foreslar_pass) väntar också på familjen:
       inget går till studiehjälparen förrän föräldern skickat det. */
    const barnens = S.väntar ? [] : (S.bf.lista || []);
    if (barnens.length) {
      const f = barnens[0];
      poster.push({
        rubrik: barnens.length > 1 ? barnens.length + ' förslag från barnen' : barnetsNamn(f.barn_id) + ' föreslår ett pass',
        text: barnens.length > 1 ? 'De väntar på er under Boka pass.'
          : bfNär(f) + (f.amne ? ' · ' + f.amne : '') + ' — granska och skicka vidare.',
        mål: '#bf-lista'
      });
    }

    /* Pass att betala (2026-10-21, Leo: familjen betalar "när man fått de
       bekräftat att man kan boka lektionen"). Ett bekräftat, obetalt pass
       är nu familjens drag, och ett genomfört ännu mer. */
    const betala = S.laddatPass ? attBetala() : [];
    if (betala.length) {
      const efter = betala.filter(b => b.status === 'completed').length;
      poster.push({
        rubrik: (betala.length === 1 ? 'Ett pass' : betala.length + ' pass') + ' att betala',
        text: efter ? (efter === 1 ? 'Ett av dem har redan hållits.' : efter + ' av dem har redan hållits.') + ' Betala med kort eller Klarna.'
          : 'Betala med kort eller Klarna, så är det klart före passet.',
        mål: '#bet-att-betala'
      });
    }

    /* Ett eget upplägg (egna_upplagg, 2026-10-27) som admin skickat: det
       väntar på att familjen köper det, under Betalning & planer. */
    const upp = S.väntar ? [] : ((S.erb && S.erb.upplagg) || []);
    if (upp.length) {
      poster.push({
        rubrik: upp.length > 1 ? upp.length + ' upplägg till er' : 'Ett upplägg till er',
        text: upp.length > 1 ? 'De står under Betalning & planer.'
          : upp[0].namn + ': ' + timmarOrd(Number(upp[0].timmar)) + '. Köp det under Betalning & planer.',
        mål: '#erb-upplagg'
      });
    }

    /* Upplupet syskontillägg (syskontillagg_som_skuld, 2026-10-21): en
       skuld för pass som hållits. Familjen betalar när den vill; posten
       säger beloppet och var. */
    const sk = S.syskon && Number(S.syskon.upplupna) > 0 ? S.syskon : null;
    if (sk) {
      poster.push({
        rubrik: 'Upplupet tillägg ' + NXBetalning.kronor(sk.upplupet_ore),
        text: 'För syskon på ' + (Number(sk.upplupna) === 1 ? '1 pass' : sk.upplupna + ' pass')
          + ' som hållits. Betala under Betalning, eller med nästa köp av timmar.',
        mål: '#bet-tillagg'
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

    return poster;
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
  /* Samma ämnen som i barnets förslag (NXArbete, 2026-10-12). */
  const BOKA_AMNEN = NXArbete.BOKA_AMNEN;

  S.boka = NXArbete.bokning({
    host: $('#boka-inner'),
    amnen: BOKA_AMNEN,
    pris: NX.CFG.PRIS_PER_TIMME || 399,
    /* Vilken tjänst förslaget gäller. Styr priset och tillägget för
       flera barn. En funktion, inte ett värde: ytan skapas innan
       katalogen laddats. */
    tjanst: () => NXTjanster.standard(),
    /* Första timmen (Fas 19.5), samma regel som forsta_timmen_bjuds() i
       databasen: det läxhjälpspass som gör att familjen har bokat två
       timmar får en timme bjuden, en gång. Avbokade pass räknas inte.
       Sedan 2026-10-09 bara för en familj vi valt, och aldrig när familjen
       fått timmen i en plan (forsta_timmen_lage). Databasen avgör; här
       visas bara vad förslaget kommer att kosta. */
    bjuden: (minuter, datum) => {
      const aktiva = (S.bokningar || []).filter(b => b.status !== 'cancelled'
        && b.fakturerbar !== false && (b.tjanst || 'laxhjalp') === 'laxhjalp');
      /* null: databasen saknar funktionen och har den gamla regeln.
         Inte hämtat än: ingen timme visas, hellre fullt pris än ett löfte.
         En gratis timme gäller i 60 dagar (gratistimmarna_60_dagar,
         2026-10-13): beviljad_till och tipstimmens kvar_till är sista
         dagen, och passets dag ska ligga inom den. */
      const dag = passetsDag(datum);
      const ft = S.forstaTimmen;
      const kanFå = ft === null || !!(ft && ft.beviljad && !ft.tagen
        && (!ft.beviljad_till || String(ft.beviljad_till) >= dag));
      /* Ett pass med tipstimmen (rabattkod TIPS) är inte prissidans
         första timme. Den går först; annars tipstimmen, om det finns en
         kvar (2026-09-30). kvar räknas i databasen och gäller också när
         erbjudandet stängts: det som tjänats in innan ges ändå. */
      if (kanFå && !aktiva.some(b => b.startrabatt && b.rabattkod !== 'TIPS')) {
        const före = aktiva.reduce((a, b) => a + (Number(b.duration_min) || 60), 0);
        if (före < 120 && före + minuter >= 120) return true;
      }
      return S.tips && Number(S.tips.kvar) > 0
        && (!S.tips.kvar_till || String(S.tips.kvar_till) >= dag) ? 'tips' : false;
    },
    /* Köpta timmar i stället för priset vid knappen (2026-09-28), och
       för resten av ett pass med en timme på köpet (2026-10-14). */
    timmar: (minuter, datum, barn, gratis) => timmarFörFörslag(minuter, datum, barn, gratis),
    /* Familjens rabatt per timme (familjerabatter, 2026-10-15): databasen
       drar den från timpriset när passet skapas (frys_passets_pris), och
       priset vid knappen visar samma sak. */
    familjerabatt: () => familjerabatt(),

    /* Spärren förr yttrade sig som en avstängd knapp utan
       förklaring. Nu står skälet där kalendern skulle ha stått. */
    ladda: async () => {
      /* Utan studiehjälpare finns ingen som kan svara på förslaget.
         Policyn på bookings släpper igenom tutor_id null, så det är här
         det stannar. */
      if (S.väntar) {
        return { spärr: NXStudie.tomt('Bokningen öppnas när ni är matchade',
          'Vi letar rätt studiehjälpare åt er och hör av oss när det är klart. Under tiden kan ni lägga till barnet '
          + 'under Profil & inställningar och prova NexLäx.') };
      }
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

    /* Ingen ruta för en rabattkod (koder_for_planer, 2026-10-21, Leo:
       "Båda gäller ENBART planköp, aldrig enskilda pass"): utan
       rabattkod här ritar arbetsytan ingen, och databasen tar ingen kod
       på ett pass. Koden skrivs in när familjen köper en plan, under
       Erbjudanden. Skicka inte och Tillbaka i granskningen ritar om
       listan ovanför ytan. */
    neka: id => nekaBarnforslag(id),
    efterGranskning: () => ritaBarnforslag(),
    /* Syskonen på passet (syskontillagg_som_skuld, 2026-10-21): bara med
       strömbrytaren på; annars väljs antalet barn som förut. */
    syskon: () => syskonLäge(),
    godkännSyskon: version => godkännSyskon(version),
    /* Hur passet betalas (kortet_reserveras, 2026-10-13): bara med
       strömbrytaren på, och då är Betala i förväg borta. */
    betalval: () => betalvalFörslag(),
    sparaKort: knapp => sparaKort(knapp),

    boka: async v => {
      if (v.forslag) return skickaBarnforslag(v);
      const { data, error } = await supa.from('bookings').insert({
        parent_id: S.user.id,
        tutor_id: S.profil.matched_tutor_id,
        student_id: S.valtBarn,
        created_by: S.user.id,
        subject: v.amne,
        tjanst: NXTjanster.standard(),
        /* Med syskonen valda är passet ett barns (antal_barn 1), och
           tillägget en egen skuld (bookings_syskon_skapa). extra_barn står
           bara med när den har barn: före migrationen finns kolumnen inte. */
        antal_barn: v.extra && v.extra.length ? 1 : (v.barn || 1),
        ...(v.extra && v.extra.length ? { extra_barn: v.extra } : {}),
        wanted_date: v.datum,
        wanted_time: v.tid,
        duration_min: v.minuter,
        format: v.format || null,
        location: v.plats || null,
        note: v.not || null,
        status: 'requested'
      }).select('id, status, klippkort_id, betalning_status, rabattkod, startrabatt').single();
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
      // Betalsättet som valdes i förslaget (kortet_reserveras).
      const bs = await efterBetalsätt(data, v.betalsatt);
      /* Listan laddas om bakom kvittot, inte före det. Den som trycker
         på Föreslå tiden ska få svaret när databasen gett det. */
      laddaPass();
      if (betalt) laddaErbjudanden().catch(() => {});
      if (v.extra && v.extra.length) laddaSyskon().catch(() => {});
      /* Timmen på köpet för ett tips drogs i samma skrivning. */
      if (data && data.rabattkod === 'TIPS') laddaTips().catch(() => {});
      return { status: data ? data.status : null, id: data ? data.id : null, betalt: betalt,
               rabatt: data && data.rabattkod !== 'TIPS' ? data.rabattkod : null,
               gratis: !!(data && data.startrabatt),
               betalText: bs ? bs.text : null, kortKnapp: !!(bs && bs.kortKnapp) };
    }
  });

  /* Hette byggKalender() förut. Namnet ljög efter ombyggnaden: det
     som laddas om är tiderna, kalendern är en detalj bakom en lucka. */
  async function laddaBokning() {
    if (!S.boka) return;
    await S.boka.ladda();
  }

  /* ============================================================
     BARNENS FÖRSLAG (barnet_foreslar_pass, 2026-10-12)

     Leo: "barn skickar förslag, precis som förälder, men ser inte
     priset. förälder får förslaget och kan ändra i förslaget, samt ser
     pris och kan ange rabattkod om det finns. sedan godkänner föräldern
     förslaget och det går vidare till studiehjälparen".

     Ett barn som får föreslå pass (boka, under Profil → Barn) skickar
     dem hit. De står överst under Boka pass, under Att göra och som en
     siffra i menyn, och föräldern får ett mejl. Granska öppnar
     förslaget i den vanliga ytan, med allt barnet valt ifyllt: där syns
     priset och allt går att ändra. Skicka gör det till ett pass, som
     förälderns eget förslag (skicka_barnets_forslag), och studiehjälparen
     svarar som vanligt. Skicka inte svarar barnet utan pass
     (barnforslag_neka).

     Ett förslag föräldern själv skickar går som förut. Rutan för en
     rabattkod (2026-10-13) är borta sedan 2026-10-21: koderna gäller bara
     planköp (koder_for_planer).

     Utan tabellen i databasen (migrationen inte körd) finns inga
     förslag, och inget av det här syns.
     ============================================================ */
  S.bf = { lista: null, öppna: null };

  async function laddaBarnforslag() {
    const { data, error } = await supa.from('barn_passforslag')
      .select('id, barn_id, datum, tid, langd_min, amne, format, plats, rad, skapad')
      .eq('lage', 'vantar').order('skapad', { ascending: true });
    if (error) {
      /* PGRST205 (och 42P01 i en äldre PostgREST): tabellen finns inte. */
      if (error.code !== 'PGRST205' && error.code !== '42P01') console.warn('barn_passforslag:', error.message);
      S.bf.lista = null;
    } else {
      S.bf.lista = data || [];
    }
    /* Ett förslag som granskas men inte längre väntar (barnet tog
       tillbaka det, eller det besvarades i en annan flik) lämnar ytan. */
    const granskas = S.boka && S.boka.granskar ? S.boka.granskar() : null;
    if (granskas && !(S.bf.lista || []).some(f => f.id === granskas)) S.boka.avbrytGranskning();
    ritaBarnforslag();
    ritaÖvGöra();
    ritaNotiser();
    ritaPassListan();
    if (S.bf.öppna) {
      const id = S.bf.öppna;
      S.bf.öppna = null;
      öppnaBarnforslag(id);
    }
  }

  function barnetsNamn(id) {
    const b = (S.barn || []).find(x => x.id === id);
    return b ? String(b.name || '').trim().split(/\s+/)[0] || 'Barnet' : 'Barnet';
  }

  function bfNär(f) {
    const dag = String(NXStudie.dagMedVeckodag(f.datum) || '');
    return dag.charAt(0).toUpperCase() + dag.slice(1) + (f.tid ? ' kl. ' + String(f.tid).slice(0, 5) : '');
  }

  function ritaBarnforslag() {
    const ruta = $('#bf-ruta'), host = $('#bf-lista');
    const lista = S.bf.lista || [];
    if (S.sido) S.sido.märke('boka', lista.length);
    if (!ruta || !host) return;
    ruta.hidden = !lista.length;
    $('#bf-antal').textContent = lista.length ? String(lista.length) : '';
    const granskas = S.boka && S.boka.granskar ? S.boka.granskar() : null;
    const idag = isoFor(new Date());
    host.innerHTML = lista.map(f => '<div class="vy-rad">'
      + '<span class="vy-rad-ik">' + NXStudie.IKON.forslag + '</span>'
      + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(barnetsNamn(f.barn_id)) + ' · ' + esc(bfNär(f)) + '</span>'
      + '<span class="vy-rad-meta">'
      + [f.amne, NXStudie.längdText(f.langd_min), f.format,
         f.datum < idag ? 'dagen har varit' : null,
         f.skapad ? 'skickat ' + NXStudie.kortTid(f.skapad) : null]
        .filter(Boolean).map(m => '<span>' + esc(m) + '</span>').join('')
      + '</span></span>'
      + '<span class="vy-rad-hoger">' + (granskas === f.id
        ? '<span class="lage">Öppet nedan</span>'
        : '<button type="button" class="btn btn-primary btn-sm" data-bf-granska="' + esc(f.id) + '">Granska</button>')
      + '</span></div>').join('');
  }

  /* Förslaget i ytan, för rätt barn. Ytan läggs i bild under raden. */
  function öppnaBarnforslag(id) {
    const f = (S.bf.lista || []).find(x => x.id === id);
    if (!f || !S.boka) return;
    if (S.väntar) return;
    if (S.valtBarn !== f.barn_id && (S.barn || []).some(b => b.id === f.barn_id)) bytBarn(f.barn_id);
    S.boka.granska(Object.assign({}, f, { namn: barnetsNamn(f.barn_id) }));
    ritaBarnforslag();
    rensa($('#bf-msg'));
    if (String(location.hash || '').split('/')[0] !== '#boka') location.hash = '#boka';
    requestAnimationFrame(() => {
      const yta = $('#boka-inner');
      if (yta) NXStudie.visaÖverst(yta);
    });
  }

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-bf-granska]');
    if (k) öppnaBarnforslag(k.dataset.bfGranska);
  });

  /* Skicka: passet skapas av databasen som förälderns eget förslag,
     med samma pris, villkor och timmar som när föräldern bokar själv.
     Samma svar till ytan som boka(). Ingen rabattkod: koderna gäller bara
     planköp (koder_for_planer, 2026-10-21). */
  async function skickaBarnforslag(v) {
    const { data, error } = await supa.rpc('skicka_barnets_forslag', {
      p_id: v.forslag,
      p_pass: {
        datum: v.datum, tid: v.tid, minuter: v.minuter, amne: v.amne, tjanst: NXTjanster.standard(),
        barn: v.barn || 1, format: v.format || null, plats: v.plats || null, not: v.not || null
      }
    });
    if (error) {
      if (error.code === '23505' || error.code === '23P01') {
        return 'Den tiden hann bli bokad, eller krockar med ett annat pass. Kalendern är uppdaterad — välj en annan tid.';
      }
      /* Databasens egna besked (förslaget är redan besvarat, barnet har
         ingen studiehjälpare) är skrivna för föräldern. */
      if (error.code === 'P0001' && error.hint === 'barnforslag') {
        laddaBarnforslag();
        return String(error.message || '');
      }
      if (error.code === 'PGRST202') return 'Barnens förslag går inte att skicka än. Försök igen om en stund.';
      return 'Kunde inte skicka förslaget: ' + felText(error);
    }
    const betalt = !data || data.betalning_status !== 'betald' ? null
      : data.klippkort_id ? 'timmar' : 'timbanken';
    // Betalsättet i granskningen, som i förälderns eget förslag (kortet_reserveras).
    const bs = await efterBetalsätt(data, v.betalsatt);
    laddaPass();
    laddaBarnforslag();
    if (betalt) laddaErbjudanden().catch(() => {});
    if (data && data.rabattkod === 'TIPS') laddaTips().catch(() => {});
    return { status: data ? data.status : null, id: data ? data.id : null, betalt,
             rabatt: data && data.rabattkod !== 'TIPS' ? data.rabattkod : null,
             gratis: !!(data && data.startrabatt),
             betalText: bs ? bs.text : null, kortKnapp: !!(bs && bs.kortKnapp) };
  }

  /* Skicka inte. null när det gick; annars felet, som ytan visar. */
  async function nekaBarnforslag(id) {
    const { data, error } = await supa.rpc('barnforslag_neka', { p_id: id });
    if (error) return 'Kunde inte svara på förslaget: ' + felText(error);
    const f = (S.bf.lista || []).find(x => x.id === id);
    await laddaBarnforslag();
    const namn = f ? barnetsNamn(f.barn_id) : 'Barnet';
    säg($('#bf-msg'), data && data.lage === 'redan'
      ? 'Förslaget var redan besvarat.'
      : 'Förslaget skickades inte. ' + namn + ' ser det i sin vy.', true);
    return null;
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
          under: S.väntar ? 'Bokningen öppnas när ni är matchade' : 'Boka en tid hos er studiehjälpare'
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
            : S.väntar ? 'Öppnas när ni är matchade' : 'Skriv till er studiehjälpare'
        }
      });
    }
  }

  /* ============================================================
     BETALNING (Fas 14.2, Fas 19.2, kortet_reserveras)
     Familjen betalar varje pass med kort. Med strömbrytaren
     kortreservation på väljs kortet före passet, priset reserveras två
     dagar före och dras när studiehjälparen har skrivit rapporten; med den av går passet
     att betala i förväg, när studiehjälparen bekräftat tiden. Annars
     betalar familjen efter passet när de bekräftar rapporten. Här står
     det som väntar före passet och det som är betalt, båda ritade ur
     passen. Ett genomfört pass betalas
     under Bekräfta rapport, där rapporten står bredvid: betalningen efter
     passet är en del av bekräftelsen, och en knapp här hade låtit
     familjen betala utan att ha sett vad de betalar för.

     Ingenting här skriver till databasen. Beloppet räknas av
     stripe-checkout ur databasen, och kortuppgifterna tas emot av
     Stripe på deras egen sida. Vi lagrar aldrig ett kortnummer, och
     kan därför inte tappa bort ett.
     ============================================================ */

  /* Det som ska betalas, i datumordning: bekräftade pass, genomförda pass
     och tillägg (attBetala). Ur samma S.bokningar som Mina lektioner, så
     att ett pass som betalas på passets sida försvinner här utan en egen
     hämtning. Varje rad har EN knapp, Betala nu (2026-10-21, Leo: "Alla
     betala knappar ska vara oranga och stå betala nu"), och samma
     data-betala som överallt. Förut två grupper, Efter passet (som ledde
     till Bekräfta rapport) och Före passet. */
  function ritaAttBetala() {
    const host = $('#bet-att-betala');
    if (!host) return;
    const kronor = NXBetalning.kronor;
    const idag = isoFor(new Date());
    const lista = attBetala();
    ritaBetSam(lista);
    ritaBetalaAlla(lista);
    if (S.sido) S.sido.märke('betalning', lista.length + (S.syskon && Number(S.syskon.upplupna) > 0 ? 1 : 0));
    $('#bet-att-antal').textContent = lista.length ? String(lista.length) : '';
    if (!lista.length) {
      host.innerHTML = tomt('Inget att betala',
        'När er studiehjälpare har bekräftat ett pass står det här, och ni betalar det med Betala nu, med kort eller Klarna.');
      return;
    }
    host.innerHTML = lista.map(b => {
      const till = tillägg(b);
      const belopp = till ? till.belopp : passetsPris(b);
      const läge = till ? 'Tillägg: passet drog över med ' + tidLängd(till.minuter)
        : senAvbokad(b) ? 'Avbokat sent: hälften av passet'
        : b.status === 'completed' ? 'Passet har hållits'
        : b.wanted_date < idag ? 'Passet har varit'
        : 'Bekräftat ' + NXStudie.relativDag(b.wanted_date);
      const försök = (till ? till.status : b.betalning_status) === 'misslyckad' ? 'Förra försöket gick inte igenom'
        : (till ? till.status : b.betalning_status) === 'vantar' ? 'Betalningen är påbörjad men inte klar' : null;
      return NXKontakt.passRad(b, {
        href: '#pass/' + b.id,
        med: medBarn(b),
        plats: false,
        dag: 'rod',
        under: [läge, försök].filter(Boolean).join(' · '),
        lage: null,
        atgarder: (belopp ? '<span class="vy-rad-belopp">' + esc(kronor(belopp)) + '</span>' : '')
          + (till ? tilläggKnapp(b, till, true) : radBetala(b))
      });
    }).join('');
  }

  /* BETALA ALLA (2026-10-27, Leo: "man ska kunna betala flera saker under
     samma kassa, eller alltså fler pass samtidigt. antingen alla eller pass
     för pass"). Passen under Att betala som har Betala nu, högst tjugo, i en
     kassa med en rad per pass; pass för pass står kvar i listan. Ett pass
     som timmarna eller timbanken kan betala är inte med: köpta timmar går
     före pengar, som på raden. Ett tillägg för övertid betalas för sig, och
     ett pass vars pris inte går att räkna här också. Knappen säger Betala nu, som alla
     betalknappar, och kortet säger att det är alla. Summan är radernas
     priser: stripe-checkout räknar varje pass igen ur databasen, med samma
     regel som för ett pass, och tar det den räknar. */
  const ALLA_MAX = 20;
  const allaAttBetala = lista => lista.filter(b => !tillägg(b) && kanBetalas(b) && passetsPris(b) > 0
    && radensVal(b) === 'betala').slice(0, ALLA_MAX);
  function ritaBetalaAlla(lista) {
    const host = $('#bet-alla');
    if (!host) return;
    const alla = allaAttBetala(lista);
    if (alla.length < 2) { host.hidden = true; host.innerHTML = ''; return; }
    const summa = alla.reduce((n, b) => n + passetsPris(b), 0);
    host.hidden = false;
    host.innerHTML = '<article class="bet-tillagg-kort">'
      + '<div class="bet-tillagg-topp"><div><small>'
      + esc((alla.length === lista.length ? 'Alla ' : '') + alla.length + ' pass på en gång') + '</small>'
      + '<b>' + esc(NXBetalning.kronor(summa)) + '</b></div>'
      + '<button type="button" class="btn btn-orange" data-betala-alla>Betala nu</button></div>'
      + '<p class="bet-tillagg-not">' + esc('En kassa, med en rad per pass. Vill ni hellre betala pass för pass gör ni det i listan.'
        + (alla.length < lista.length ? ' Det som inte är med här betalas för sig.' : '')) + '</p></article>';
  }

  /* Betala nu på kortet ovan: köpvillkoren med passen och summan, och
     sedan samma kassa som för ett pass, med passens id:n i stället för ett. */
  async function betalaAlla(knapp) {
    const alla = allaAttBetala(attBetala());
    if (alla.length < 2) return;
    const kronor = NXBetalning.kronor;
    const summa = alla.reduce((n, b) => n + passetsPris(b), 0);
    const sk = S.syskon && Number(S.syskon.upplupna) > 0 ? S.syskon : null;
    if (!await NXStudie.kassansVillkor({
      titel: 'Betala ' + alla.length + ' pass',
      rader: alla.map(b => (b.subject ? b.subject + ', ' : '') + datumText(b.wanted_date)
        + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : '') + ' · ' + kronor(passetsPris(b))),
      tillagg: sk ? { rad: 'Upplupet tillägg för extra barn, ' + kronor(sk.upplupet_ore)
        + ': ingår inte här. Betala det med Betala tillägg nu under Betalning, eller med nästa köp av timmar.',
        valfri: false, med: false } : null,
      text: 'Totalt ' + kronor(summa) + '. Varje pass står som en egen rad i kassan, och ni betalar allt med kort eller Klarna i nästa steg.'
    })) return;
    const ids = alla.map(b => b.id);
    await medan(knapp, 'Öppnar…', async () => {
      const stripeKlar = laddaStripe().catch(err => { console.warn(err); return null; });
      const svar = await startaKassa({ passen: ids, retur: location.origin, ui: 'inbaddad', villkor: true });
      if (!svar) { laddaPass().catch(() => {}); return; }
      const vad = (svar.antal_pass || ids.length) + ' pass · ' + kronor(svar.belopp_ore || summa);
      if (svar.lage === 'inbaddad' && svar.client_secret && svar.nyckel) {
        const Stripe = await stripeKlar;
        if (Stripe) {
          try {
            await öppnaKassa(knapp, null, svar, Stripe, { titel: 'Betala passen', vad: vad, sort: 'passen', klar: passenBetalda });
            return;
          } catch (err) { console.error('Den inbäddade kassan gick inte att öppna', err); stängBetalpanel(); }
        }
        const reserv = await startaKassa({ passen: ids, retur: location.origin, ui: 'sida', villkor: true });
        if (reserv && reserv.url) { location.href = reserv.url; return; }
        if (!reserv) return;
      } else if (svar.url) {
        location.href = svar.url;
        return;
      }
      alert('Kassan kunde inte öppnas. Försök igen, eller hör av dig till oss.');
    });
  }

  function passenBetalda() {
    const p = panel;
    if (!p) return;
    p.klar = true;
    p.besked.textContent = '✓ Tack! Passen är betalda. Det kan ta en liten stund innan de står som betalda här, och kvittot kommer med mejl.';
    p.besked.hidden = false;
    setTimeout(() => { laddaPass().catch(() => {}); }, 2500);
    setTimeout(() => { laddaPass().catch(() => {}); }, 8000);
  }

  /* Summan överst i Betalning: vad som är kvar att betala och vad som
     betalats den här månaden, innan någon läst en rad. Att betala är ert
     drag och står i orange. Betalt räknas på betald_at i den här månaden,
     med det som gått tillbaka avdraget, och timmarna ur timbanken står för
     sig: de är inga kronor. */
  function ritaBetSam(lista) {
    const host = $('#bet-sam');
    if (!host) return;
    const kronor = NXBetalning.kronor;
    const summa = (l, f) => l.reduce((n, b) => n + (f(b) || 0), 0);
    const attKr = summa(lista, b => { const t = tillägg(b); return t ? t.belopp : passetsPris(b); });
    const månad = isoFor(new Date()).slice(0, 7);
    const iMånaden = (S.bokningar || []).filter(b => BETALDA.indexOf(b.betalning_status) !== -1
      && b.betald_at && isoFor(new Date(b.betald_at)).slice(0, 7) === månad);
    const betaltKr = summa(iMånaden, b => Math.max(Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0), 0));
    const timmarPass = iMånaden.filter(b => b.klippkort_id && !Number(b.betalt_ore || 0));
    const timmar = summa(timmarPass, b => Math.max(1, Math.round(Number(b.duration_min || 60) / 60)));
    const tillbaka = summa((S.bokningar || []).filter(b => b.betald_at && isoFor(new Date(b.betald_at)).slice(0, 7) === månad),
      b => Number(b.aterbetald_ore || 0));
    const ruta = (klass, etikett, belopp, under) => '<div' + (klass ? ' class="' + klass + '"' : '') + '>'
      + '<small>' + esc(etikett) + '</small><b>' + esc(belopp) + '</b><span>' + esc(under) + '</span></div>';
    host.innerHTML =
      ruta(lista.length ? 'ar-betala' : '', 'Att betala', lista.length ? kronor(attKr) : '0 kr',
        lista.length ? (lista.length === 1 ? '1 pass väntar på er' : lista.length + ' pass väntar på er') : 'Allt är betalt')
      + ruta('', 'Betalt i ' + (NX.MANADER[new Date().getMonth()] || 'månaden'), kronor(betaltKr),
        [timmar ? 'och ' + (timmar === 1 ? '1 timme' : timmar + ' timmar') + ' ur timbanken'
          : iMånaden.length ? (iMånaden.length === 1 ? '1 pass' : iMånaden.length + ' pass') : 'Inget betalt än',
        tillbaka ? kronor(tillbaka) + ' tillbaka' : null].filter(Boolean).join(' · '));
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
          /* Ett pass kan ha dragits från två köp (timmarna_delas,
             2026-10-14): timmarna och om de var gratis läses ur
             klippkort_rorelser, en rad per köp. Timmen på köpet dras inte. */
          const drag = b.klippkort_id ? passetsDrag(b.id) : [];
          const timmar = drag.length ? drag.reduce((a, r) => a + (Number(r.timmar) || 0), 0) : korttimmar(b);
          const ärGratis = id => S.erb.kort.some(k => k.id === id && NXBetalning.gratistimmar(k));
          const nGratis = drag.length ? drag.filter(r => ärGratis(r.klippkort_id)).length
            : b.klippkort_id && ärGratis(b.klippkort_id) ? 1 : 0;
          const gratis = nGratis > 0 && nGratis >= Math.max(drag.length, 1);
          const drogs = b.klippkort_id && !betalt ? (!timmar ? '' : timmar === 1 ? '1 timme' : timmar + ' timmar')
            : medBanken(b) && !betalt ? tidLängd(Number(b.duration_min || 60)) : betalt ? kronor(betalt) : '';
          return NXKontakt.passRad(b, {
            href: '#pass/' + b.id,
            med: medBarn(b),
            tid: false,
            plats: false,
            dag: tillbaka >= betalt && betalt ? null : 'gron',
            under: [b.klippkort_id && !betalt ? (gratis ? 'Gratistimmar' : nGratis ? 'Gratistimmar och köpta timmar' : 'Köpta timmar')
              : medBanken(b) && !betalt ? 'Sparade minuter' : 'Kort',
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
    // Betala tillägg nu (syskontillagg_som_skuld) kommer tillbaka med ?tillagg=.
    const svar = q.has('betalt') ? 'betalt' : q.has('tillagg') ? 'skuld' : q.has('kopt') ? 'kopt'
      // Kassan som sparar kortet (kortet_reserveras) kommer tillbaka med ?kort=.
      : q.has('kort') ? (q.get('kort') === 'avbrutet' ? 'kortAvbrutet' : 'kort')
      : q.get('betalning') === 'avbruten' ? 'avbruten' : null;
    if (svar && window.history && history.replaceState) {
      // Ett köpt erbjudande (Fas 16.1) öppnar på timbanken under Betalning, och kortet under Profil.
      history.replaceState(null, '', location.pathname
        + (svar === 'kopt' ? '#betalning/timbank' : svar === 'kort' || svar === 'kortAvbrutet' ? '#profil/kort' : '#betalning'));
    }
    return svar;
  }

  function visaBetalsvar(svar) {
    if (svar === 'kort' || svar === 'kortAvbrutet') {
      const km = $('#kort-msg');
      if (km) säg(km, svar === 'kort' ? '✓ Kortet är sparat. Det kan ta en liten stund innan det syns här.'
        : 'Inget kort sparades.', svar === 'kort');
      if (svar === 'kort') väntaPåKortet();
      return;
    }
    if (svar === 'kopt') {
      const em = $('#erb-msg');
      if (em) säg(em, '✓ Tack! Köpet är klart. Timmarna syns under Er timbank om en liten stund.', true);
      setTimeout(() => { Promise.all([laddaErbjudanden(), laddaPass()]).catch(() => {}); }, 5000);
      return;
    }
    const msg = $('#bet-msg');
    if (!svar || !msg) return;
    if (svar === 'skuld') {
      säg(msg, '✓ Tack! Betalningen för tillägget är mottagen. Det kan ta en liten stund innan det syns här, och kvittot kommer med mejl.', true);
      setTimeout(() => { laddaSyskon().catch(() => {}); }, 5000);
      return;
    }
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
  const SEKTIONSNAMN = { oversikt: 'Översikt', lektioner: 'Mina lektioner', betalning: 'Betalning', boka: 'Boka pass' };
  /* ============================================================
     BARNENS TRÅDAR (barnets_chatt, 2026-10-06)

     Barnet och studiehjälparen skriver till varandra i barnets egen
     inloggning (barn_meddelanden), och valet var "egen tråd, föräldern
     läser": här läser föräldern dem, direkt i tabellen (policyn
     "föräldern läser barnens trådar"), utan skrivruta och utan att något
     markeras som läst. Hämtas när Meddelanden visas. Utan tabellen i
     databasen står rutan dold. De 500 senaste per familj, och rutan
     säger det om det finns fler.
     ============================================================ */
  const BC_MAX = 500;
  async function laddaBarnensTradar() {
    const ruta = $('#bc-foralder'), host = $('#bc-foralder-lista');
    if (!ruta || !S.user) return;
    const res = await supa.from('barn_meddelanden')
      .select('id, student_id, tutor_id, fran, body, read_at, created_at')
      .eq('parent_id', S.user.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(BC_MAX);
    if (res.error) {
      if (!/barn_meddelanden/.test(String(res.error.message)) && res.error.code !== '42P01') {
        console.warn('barn_meddelanden:', res.error.message);
      }
      ruta.hidden = true;
      return;
    }
    const rader = (res.data || []).slice().reverse();
    ruta.hidden = !rader.length;
    if (!rader.length) { host.replaceChildren(); return; }
    const perBarn = {};
    rader.forEach(m => { (perBarn[m.student_id] = perBarn[m.student_id] || []).push(m); });
    const hjälpare = id => (S.tutor && S.tutor.id === id && S.tutor.full_name)
      ? S.tutor.full_name.split(' ')[0] : 'Studiehjälparen';
    host.innerHTML = Object.keys(perBarn).map(id => {
      const b = (S.barn || []).find(x => x.id === id);
      const namn = b ? String(b.name || '').split(' ')[0] : 'Barnet';
      return '<div class="bc-barn"><p class="bc-barn-namn">' + esc(namn) + '</p>'
        + '<div class="tr" data-bc-barn="' + esc(id) + '"></div></div>';
    }).join('') + (rader.length >= BC_MAX
      ? '<p class="xsmall bc-not">Visar de ' + BC_MAX + ' senaste meddelandena.</p>' : '');
    Object.keys(perBarn).forEach(id => {
      const b = (S.barn || []).find(x => x.id === id);
      const lista = perBarn[id];
      NXStudie.barnTråd({
        host: host.querySelector('[data-bc-barn="' + CSS.escape(id) + '"]'), jag: null,
        namn: { barn: b ? String(b.name || '').split(' ')[0] : 'Barnet', studiehjalpare: hjälpare(lista[lista.length - 1].tutor_id) }
      }).rita(lista.map(m => ({ id: m.id, fran: m.fran, text: m.body, skapad: m.created_at, last: m.read_at })));
    });
  }

  function bytteSektion(vald) {
    const förra = S.aktivSek;
    S.aktivSek = vald;
    /* In i NexLäx: alltid på Din väg (2026-10-13, Leo: "när du går in och ut
       ska du alltid hamna på startsidan"), utom när en länk bett om en
       annan flik. En adress med fliken i (#nexlax/rank) tas av följHash. */
    if (vald === 'nexlax' && förra !== 'nexlax' && S.flikar && S.flikar.nexlax) {
      S.flikar.nexlax.visa(U.tagFlik() || 'vag');
    }
    /* Barnens trådar bär barnets och studiehjälparens namn, så de
       hämtas först när båda finns (S.namnKlara). */
    if (vald === 'meddelanden' && S.namnKlara) laddaBarnensTradar();
    if (vald === 'pass') {
      if (förra && förra !== 'pass') S.passFrån = förra;
      ritaPassSida();
      /* Sektionen man kom ifrån står vald, i raden och i menyn bakom
         de tre strecken (sidomeny, mobilmeny). */
      const hem = SEKTIONSNAMN[S.passFrån] ? S.passFrån : 'lektioner';
      $$('#vy-sido a[data-sek="' + hem + '"], .m-vy a[data-sek="' + hem + '"]').forEach(a => a.classList.add('ar-har'));
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
    if (senAvbokad(b)) return senAvgift(b);
    return prisFör(b, b.status === 'completed' ? debiteradeMin(b) - bankMin(b) : Number(b.duration_min || 60));
  }

  /* Sen avbokning (sen_avbokning, 2026-10-22): passet avbokades mindre än
     12 timmar före start och räknas som hållet i halva tiden. Avgiften i
     pengar är databasens (stampla_avbokningen), 0 när timmarna betalade. */
  const senAvbokad = b => !!b && b.status === 'cancelled' && b.sen_avbokning_minuter != null;
  const senAvgift = b => senAvbokad(b) ? Number(b.sen_avbokning_ore || 0) : 0;
  /* Vad en avbokning nu skulle kosta, för rutan innan familjen bestämt sig
     och för passets sida. Databasen svarar (sen_avbokning_lage): regeln
     gäller bara ett pass som bokades efter att familjen godkänt villkoren
     med den, och beloppet är det databasen tar. null när den inte gäller,
     och när funktionen saknas (före migrationen). Svarar databasen med ett
     annat fel räknar vyn själv, så att ingen avbokar utan att få veta.
     Svaret sparas per pass (regeln och beloppet ändras inte för ett bokat
     pass), utom när familjen trycker på Avboka: då frågas det om. */
  async function senAvbokningLäge(b, färskt) {
    if (!b || !NXBetalning.senAvbokningNu(b)) return null;
    const nyckel = [b.id, b.status, b.duration_min, b.wanted_date, b.wanted_time].join('|');
    S.senLäge = S.senLäge || {};
    if (färskt || !(nyckel in S.senLäge)) {
      const { data, error } = await supa.rpc('sen_avbokning_lage', { p_pass: b.id });
      if (error && (error.code === 'PGRST202' || error.code === '42883')) S.senLäge[nyckel] = null;
      else if (error) {
        const halv = NXBetalning.senMinuter(b.duration_min);
        return { minuter: halv, kronor: medTimmar(b) || medBanken(b) ? 0 : prisFör(b, halv) || 0 };
      } else S.senLäge[nyckel] = data && data.galler && (!färskt || data.sen)
        ? { minuter: Number(data.minuter), kronor: Number(data.ore) || 0 } : null;
    }
    return S.senLäge[nyckel];
  }
  /* Ett pass betalt med gratistimmar sparar inga minuter (intern.timbank_in):
     det som blir över av en påbörjad gratistimme kommer inte tillbaka. */
  const medGratistimmar = b => medTimmar(b)
    && ((S.erb && S.erb.kort) || []).some(k => k.id === b.klippkort_id && NXBetalning.gratistimmar(k));

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
    /* Sen avbokning (2026-10-22): de sista 12 timmarna flyttar familjen
       inte ett bokat pass (stampla_avbokningen), och en avbokning kostar
       hälften. Knappen för att flytta står inte där, och beskedet säger det. */
    const sentNu = b.status === 'confirmed' ? await senAvbokningLäge(b) : null;
    // Svaret kan komma efter att familjen gått vidare till ett annat pass.
    if (passIdIAdressen() !== b.id) return;
    const sentText = !sentNu ? ''
      : ' Det börjar om mindre än 12 timmar, så det går inte att flytta, och avbokas det kostar det hälften'
        + (sentNu.kronor > 0 ? ' av priset, ' + NXBetalning.kronor(sentNu.kronor) + '.'
          : medTimmar(b) || medBanken(b) ? ' av tiden.' : ' av tiden, och timmen på köpet är då använd.');

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
    if (b.status === 'cancelled' && senAvbokad(b)) {
      /* Sen avbokning (sen_avbokning, 2026-10-22): passet räknas som hållet i
         halva tiden. Avgiften i pengar betalas här; betalade timmarna drogs
         halva tiden ur dem, och ett betalt pass får resten tillbaka. */
      const avgift = senAvgift(b);
      const kr = NXBetalning.kronor;
      const först = 'Passet avbokades mindre än 12 timmar före start, och då räknas det som hållet i halva tiden ('
        + tidLängd(b.sen_avbokning_minuter) + ').';
      const kvar = Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0) - avgift;
      besked = avgift > 0 && kanBetalas(b)
        ? { text: först + ' Ni betalar hälften av passet, ' + kr(avgift) + '. Betala det nu, med kort eller Klarna.', ton: 'fraga' }
        : avgift > 0
        ? { text: först + ' Ni betalar hälften av passet, ' + kr(avgift) + '.'
            + (kvar > 0 ? ' Resten av det ni betalat, ' + kr(kvar) + ', betalar vi tillbaka till kortet eller Klarna.'
              : pengarPå(b) ? ' Det är betalt.' : ''), ton: 'klart' }
        : medGratistimmar(b)
        ? { text: först + ' Den tiden är dragen ur era gratistimmar, och en påbörjad gratistimme är använd.', ton: 'lugn' }
        : medTimmar(b) || medBanken(b)
        ? { text: först + ' Den tiden är dragen ur era ' + (medTimmar(b) ? 'timmar' : 'minuter i timbanken')
            + ', och resten har kommit tillbaka.', ton: 'lugn' }
        : b.startrabatt
        ? { text: först + ' Den tiden täcks av timmen på köpet, så det kostar inga pengar, men timmen är använd.', ton: 'lugn' }
        : { text: först, ton: 'lugn' };
      if (avgift > 0 && kanBetalas(b)) val = betalVal(b);
      atgarder = '<a class="btn ' + (val ? 'btn-ghost' : 'btn-primary') + '" href="#boka">Föreslå en ny tid</a>';
    } else if (b.status === 'cancelled') {
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
      besked = { text: 'Väntar på att ' + förnamn + ' accepterar tiden. Ni får ett mejl när hen svarat.' + timmarna + (betalt ? viaOss : '')
        + (kortBesked(b) ? ' ' + kortBesked(b) : ''), ton: 'vantar' };
      fot = flytta('Ändra tiden') + skriv + (betalt ? '' : avboka('Dra tillbaka förslaget', true));
      /* Kortet (2026-10-13): går att välja redan på förslaget, och att
         välja bort. Ett kort som saknas är familjens drag. */
      const krf = kortResRad(b);
      if (krf && kortValt(b) && S.kort.pa && (krf.lage === 'misslyckad' || (krf.lage === 'vald' && !S.kort.kort))) {
        atgarder = '<button type="button" class="btn btn-primary" data-kort-spara>'
          + (S.kort.kort ? 'Byt kort' : krf.lage === 'misslyckad' ? 'Lägg till kort' : 'Spara kortet') + '</button>';
      }
      alternativ = kortValt(b)
        ? '<button type="button" class="btn btn-ghost btn-sm" data-kort-bort="' + esc(b.id) + '">Välj bort kortet</button>'
        : kortKanVäljas(b)
        ? '<button type="button" class="btn btn-ghost btn-sm" data-kort-val="' + esc(b.id) + '">Välj kort för passet</button>'
        : '';
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
        /* Fas 22.3: timmarna räcker men har inte betalat än, för de blev
           lediga efter att passet bekräftades. Jobbet tar det inom fem
           minuter; knappen gör det nu. */
        : kortFör(b) || bankFör(b)
        ? { text: 'Passet är bokat, och era timmar räcker till det. De betalar det av sig själva inom fem minuter, eller nu med knappen.', ton: 'klart' }
        /* Kortet reserveras (2026-10-13): vad kortet gör med passet. */
        : kortBesked(b)
        ? { text: 'Passet är bokat. ' + ses + ' ' + kortBesked(b), ton: kortBetalar(b) ? 'klart' : 'fraga' }
        : kortKanVäljas(b)
        ? { text: 'Passet är bokat. ' + ses + ' Välj kort, så reserveras priset två dagar före passet.', ton: 'klart' }
        /* Betala nu (2026-10-21): ett bekräftat, obetalt pass är familjens drag. */
        : { text: 'Passet är bokat. ' + ses + ' Betala det nu, med kort eller Klarna.', ton: 'fraga' };
      // Sen avbokning (2026-10-22): de sista 12 timmarna säger beskedet vad en avbokning kostar.
      if (sentText) besked = Object.assign({}, besked, { text: besked.text + sentText });
      const kr = kortResRad(b);
      if (kr && kortValt(b) && S.kort.pa && (kr.lage === 'misslyckad' || (kr.lage === 'vald' && !S.kort.kort))) {
        /* Kortet saknas eller nekades: att lägga till ett är familjens
           drag. Ett nytt kort ger passet ett nytt försök av sig självt. */
        atgarder = '<button type="button" class="btn btn-primary" data-kort-spara>'
          + (S.kort.kort ? 'Byt kort' : kr.lage === 'misslyckad' ? 'Lägg till kort' : 'Spara kortet') + '</button>'
          + (kr.lage === 'misslyckad' && S.kort.kort
            ? '<button type="button" class="btn btn-ghost" data-kort-val="' + esc(b.id) + '">Försök igen</button>' : '');
      } else if (kanBetalas(b)) val = betalVal(b);
      fot = (sentNu ? '' : flytta('Föreslå ny tid')) + skriv + (betalt ? '' : avboka('Avboka passet'));
      alternativ = kortValt(b)
        ? '<button type="button" class="btn btn-ghost btn-sm" data-kort-bort="' + esc(b.id) + '">Välj bort kortet</button>'
        : '';
    } else if (b.status === 'confirmed' && kanBetalas(b)) {
      /* Passerat och obetalt medan spärren är på — bara då släpper
         kanBetalas igenom det. Hölls passet kan rapporten inte skrivas
         förrän det är betalt, så betalningen är det som låser upp den.
         Hölls det inte är det studiehjälparen som avbokar. */
      besked = { text: 'Passet har varit men är inte betalt. Hölls det, betala det med kort, så kan ' + förnamn
        + ' skriva rapporten. Hölls det inte, avbokar ' + förnamn + ' det.', ton: 'fraga' };
      val = betalVal(b);
    } else if (b.status === 'completed' && kanBetalas(b)) {
      /* Genomfört men inte betalt: det hölls ändå, och ska betalas
         (2026-10-21, Leo: "Passet hålls, vi jagar"). Rapporten står nedan. */
      besked = { text: 'Passet är genomfört men inte betalt. Betala det nu, med kort eller Klarna. Rapporten står nedan.', ton: 'fraga' };
      val = betalVal(b);
    } else if (b.status === 'completed' && till) {
      /* Betalt i förväg, och passet drog över (Fas 20.1). Tillägget
         betalas med Betala nu, här eller under Betalning. */
      besked = { text: 'Passet är genomfört och betalt. ' + tilläggRad(till) + ' Betala tillägget nu, med kort eller Klarna.', ton: 'fraga' };
      atgarder = tilläggKnapp(b, till, false);
    } else if (b.status === 'completed') {
      /* Betalt, eller undantaget från betalning. Blev passet kortare än
         det betalda går mellanskillnaden tillbaka av sig själv (betala_nu). */
      const kortet = kortBetalar(b) ? ' Priset dras från ' + kortNamn(S.kort.kort) + ' inom några minuter.' : '';
      besked = { text: 'Passet är genomfört.' + kortet, ton: 'klart' };
      atgarder = bokaNästa(true);
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
      /* Kortet reserveras (2026-10-13). */
      : kortBetalar(b) && b.status !== 'cancelled'
        ? (kortResRad(b).lage === 'reserverad' ? 'Reserverat på kortet' : 'Med kortet')
      : S.kort.pa && kortResRad(b) && kortResRad(b).lage === 'misslyckad' && b.status !== 'cancelled' ? 'Kortet nekades'
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
        /* Syskon på passet (syskontillagg_som_skuld): alla barnen, och
           tillägget för dem, som skuld efter passet. */
        varde: passetsBarn(b).length > 1 ? NXStudie.listaOrd(passetsBarn(b))
          : barn ? barn.name : ((b.antal_barn || 1) > 1 ? b.antal_barn + ' barn' : 'Er familj'),
        under: [passetsBarn(b).length > 1 ? passetsBarn(b).length + ' barn på passet' + syskonTillägg(b)
          : barn && (b.antal_barn || 1) > 1 ? b.antal_barn + ' barn på passet' : null,
          S.tutor && S.tutor.full_name ? 'Med ' + S.tutor.full_name + ', studiehjälpare' : 'Med er studiehjälpare'].filter(Boolean).join(' · ') },
      /* Sen avbokning (2026-10-22): hälften av passet, i kronor eller som
         tiden ur timmarna, aldrig "0 kr". */
      senAvbokad(b) ? { ikon: 'kort', etikett: 'Pris',
        varde: senAvgift(b) > 0 ? NXBetalning.kronor(senAvgift(b))
          : medTimmar(b) ? tidLängd(b.sen_avbokning_minuter) + ' ur timmarna'
          : medBanken(b) ? tidLängd(b.sen_avbokning_minuter) + ' ur timbanken'
          : 'Timmen på köpet',
        under: ['Sen avbokning: hälften av passet', senAvgift(b) > 0 ? betalning : null].filter(Boolean).join(' · ') }
      : { ikon: 'kort', etikett: 'Pris',
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
      /* Rapporten som ett brev, direkt under beskedet som säger att den
         står nedan. Rapporten som hämtats för sidan har
         inte passets elev och dag; de tas från passet. */
      block: (rapport ? [{ rubrik: 'Rapporten', forst: true, html:
        rbBrev(Object.assign({ student_id: b.student_id, lesson_date: b.wanted_date }, rapport), b)
      }] : []).concat(svaret ? [svaret] : [], block)
    });

    /* Rapporten ur S.rb finns ofta redan, med samma fält:
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
    $$('[data-pris]').forEach(el => el.textContent = kr(NX.CFG.PRIS_PER_TIMME || 399));

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
       nedan inte byter sida under den. Den som tagits in och inte valt
       sitt lösenord än får rutan utan Inte nu, också utan länken
       (NXStudie.lösenordFörst, 2026-10-06). */
    const nyttLösen = await NXStudie.lösenordFörst(supa, S.user);

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

    /* Senast inloggad (adminvyn) skrivs innan vyn kan stanna i
       väntläget: en familj som valt lösenord men inte är matchad har
       loggat in, och Skicka inbjudan igen ska inte stå kvar för den.
       then() är det som skickar frågan: supabase-js bygger bara anropet
       tills någon väntar på det. */
    supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id)
      .then(() => {}, () => {});

    /* En studiehjälpare som loggat in här hör hemma i sin vy (2026-10-07,
       Leo: "spelar egentligen ingen roll vart man klickar i inlogg, är man
       studiehjälpare loggas man in dit"). Studiehjälparvyn skickar en
       förälder hit, så ingen roll kan studsa mellan dem. */
    if (S.profil.role === 'tutor') { location.replace('/larare'); return; }
    /* Användarvillkoren (2026-10-07): den som inte godkänt den gällande
       versionen får rutan här, efter lösenordet och före introduktionen.
       Databasen kräver godkännandet för att ett pass ska bokas
       (NXStudie.villkorFörst). */
    await NXStudie.villkorFörst(supa, S.user, 'foralder');
    /* Före matchningen är vyn öppen (2026-10-07, Leo: "han kommer inte in
       på plattformen, det är låst. ta bort så att det inte är låst").
       Förut stannade en familj utan studiehjälpare i ett väntläge, och
       sedan intaget är det varje ny familj: lösenordet, villkoren och
       introduktionen, och sedan ett lås. Nu kommer de in med barnen,
       NexLäx och profilen; Boka pass och köpen väntar på
       studiehjälparen (S.väntar), och tråden har ingen att skriva till. */
    S.väntar = S.profil.match_status !== 'matched' || !S.profil.matched_tutor_id;
    /* Introduktionen första gången, och Fortsätt sist leder in i vyn
       (NXStudie.introduktion). Den som inte är matchad än får veta vad
       som öppnas när vi matchat dem. */
    await NXStudie.introduktion(supa, S.user, 'foralder', { sparat: nyttLösen, väntar: S.väntar });

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
      nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt', mobilmeny: true,
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
      installningar: ['profil', 'pris'],
      /* Bekräfta rapport togs bort 2026-10-21. Adressen står i gamla mejl
         och i adminvyns påminnelser; det som var kvar där är att betala. */
      bekrafta: ['betalning', null],
      /* Erbjudanden blev en del av Betalning & planer 2026-10-27. Adressen
         står i gamla mejl och i kassans återvändsadress (stripe-checkout),
         och leder till planerna. */
      erbjudanden: ['betalning', 'planer']
    };
    function följHash() {
      const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
      /* Ett barns förslag (barnet_foreslar_pass): raden under Att göra
         leder hit. Förslaget öppnas när listan finns, och adressen blir
         #boka, så att en omladdning inte öppnar det igen. */
      const förslag = huvud === 'boka' && /^forslag-[0-9a-f-]{36}$/.test(flik || '') ? flik.slice(8) : null;
      if (förslag) {
        history.replaceState(history.state, '', '#boka');
        if (S.bf.lista) öppnaBarnforslag(förslag);
        else S.bf.öppna = förslag;
        return;
      }
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
         fliken. Betalning har inga flikar men två ställen att landa på
         (2026-10-27): planerna och timbanken. */
      if (huvud === 'betalning' && (flik === 'planer' || flik === 'timbank')) {
        S.landa = { mål: flik === 'planer' ? '#bet-planer' : '#erb-mina-box', till: Date.now() + 5000 };
        requestAnimationFrame(landa);
        return;
      }
      if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
    }
    window.addEventListener('hashchange', följHash);
    /* Rör man själv sidan släpper landningen (nedan). */
    ['wheel', 'touchstart', 'keydown'].forEach(h => window.addEventListener(h, () => { S.landa = null; }, { passive: true }));
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
      marke: { text: 'Förälder', ikon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c0-3 2.5-5.4 5.5-5.4s5.5 2.4 5.5 5.4"/><path d="M16.5 7.5h5M19 5v5"/></svg>' },
      chatt: { href: '#meddelanden', text: 'Meddelanden',
        under: S.väntar ? 'Öppnas när ni är matchade' : 'Skriv till er studiehjälpare' }
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
    /* Kortet (2026-10-13) före passen, som dess val och lägen ritas ur.
       Ett fel här stoppar inte vyn: utan kortet är den som förut. */
    await Promise.all([laddaBarn(), laddaSparr(), laddaErbjudanden(), laddaTips(),
      laddaKort().catch(err => console.warn('kortet:', err)),
      laddaSyskon().catch(err => console.warn('tillägget:', err))]);
    await Promise.all([laddaTutor().then(startaTråd), laddaPlan(), laddaRapporter(), laddaLaxor(), laddaNexlax(), laddaProgress(), laddaPass(), laddaBokning(), laddaRapporterna(), laddaBarnforslag()]);
    /* Barnens förslag kan komma medan fliken står öppen: de hämtas när
       man kommer tillbaka till den, högst en gång i minuten. */
    let förslagHämtade = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - förslagHämtade < 60000) return;
      förslagHämtade = Date.now();
      laddaBarnforslag();
    });
    S.namnKlara = true;
    if (S.aktivSek === 'meddelanden') laddaBarnensTradar();
    /* Uppgifterna hämtas först, så märket ritas om när de finns. */
    ritaÖvLaxor();
    ritaNotiser();
    await ritaÖvSamtal();
    visaBetalsvar(betalsvar);
    /* Notiserna vid inloggningen (2026-10-12), när allt är hämtat: också
       tråden, som räknar de nya meddelandena när den hämtats första
       gången. Inte på väg tillbaka från kassan: webhooken har kanske
       inte hunnit, och då hade ett pass man just betalat stått som
       ett pass att betala. */
    if (S.trad && S.trad.klar) await S.trad.klar.catch(() => {});
    if (!betalsvar) NXStudie.notisruta({ user: S.user, poster: notisposter(), rubrik: 'Det här väntar på er' });
    /* Studievyn på hemskärmen (2026-10-27): guiden under Profil, och rutan
       i hörnet på en telefon tills den stängs med krysset. Rutan väntar
       själv tills notiserna och introduktionen är stängda. */
    if (typeof NXHemskarm !== 'undefined') {
      NXHemskarm.profil($('#hem-profil'), 'foralder');
      if (!betalsvar) setTimeout(() => NXHemskarm.ruta('foralder'), 6000);
    }
   } catch (fel) {
     visaFel(fel, 'vyn skulle hämtas');
   }
  }

  start();
})();
