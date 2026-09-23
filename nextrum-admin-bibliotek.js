/* ============================================================
   NEXTRUM — adminvyn, Material: det delade biblioteket (Fas 13.2)

   Nextrums egen bank av övningar, sorterad på ämne och årskurs.
   Studiehjälparen HÄMTAR härifrån och ger materialet som läxa; hen
   laddar aldrig upp hit. Det är hela poängen: ett bibliotek som vem
   som helst fyller på är inte ett urval, och då är filtret på ämne
   och årskurs ingenting värt.

   Varför inte `materials`: den tabellen är ELEVENS. student_id är
   NOT NULL, skrivpolicyn kräver is_my_student() och hinken
   `material` kräver ett elev-uuid först i sökvägen. Ett delat
   bibliotek hade behövt en elev som inte finns.

   Ämnena och årskurserna kommer från NX.AMNEN och NX.ARSKURSER —
   samma listor som studiehjälparvyn filtrerar med. Två listor som
   glider isär gör ett övningsblad osynligt, och ett filter som tyst
   tappar rader ser ut som ett tomt bibliotek.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText } = NX;
  const { bekräfta, medan } = NXStudie;
  const M = NXMedia;

  const { S, kortDatum, matchar, namnFör, tabell, tomtText } = NXAdmin;

  /* Fil eller länk. Samma val som studiehjälparens materialruta, och
     med flit utan "anteckning": en anteckning utan fil och utan
     adress är en rubrik som inte leder någonstans, och databasen
     vägrar den raden (biblioteksmaterial_har_innehall). */
  let bibTyp = 'fil';

  function fyllVäljare() {
    const amne = $('#bib-amne');
    const ak = $('#bib-arskurs');
    const fAmne = $('#bib-filter-amne');
    const fAk = $('#bib-filter-ak');
    if (!amne || amne.dataset.fylld) return;

    const ämnen = NX.AMNEN.map(a =>
      '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('');
    const årskurser = NX.ARSKURSER.map(a =>
      '<option value="' + esc(a.kod) + '">' + esc(a.text) + '</option>').join('');

    amne.innerHTML = ämnen;
    ak.innerHTML = årskurser;
    if (fAmne) fAmne.innerHTML = '<option value="">Alla ämnen</option>' + ämnen;
    if (fAk) fAk.innerHTML = '<option value="">Alla årskurser</option>' + årskurser;
    amne.dataset.fylld = '1';
  }

  async function hämtaBibliotek() {
    const { data, error } = await supa.from('biblioteksmaterial')
      .select('*').order('created_at', { ascending: false });
    if (error) { console.warn('biblioteksmaterial:', error.message); return; }
    S.bibliotek = data || [];
  }

  function ritaBibliotek() {
    fyllVäljare();
    const host = $('#bib-tabell');
    if (!host) return;

    const sök = ($('#bib-sok') || {}).value || '';
    const fAmne = ($('#bib-filter-amne') || {}).value || '';
    const fAk = ($('#bib-filter-ak') || {}).value || '';
    const alla = S.bibliotek || [];
    const rader = alla
      .filter(b => !fAmne || b.amne === fAmne)
      .filter(b => !fAk || b.arskurs === fAk)
      .filter(b => matchar(b, ['titel', 'beskrivning', 'amne'], sök.trim()));

    $('#bib-antal').textContent = rader.length + ' av ' + alla.length;
    host.innerHTML = tabell([
      { namn: 'Rubrik', rita: b => '<b>' + esc(b.titel) + '</b>'
        + (b.beskrivning
          ? '<span class="adm-und">' + esc(b.beskrivning.slice(0, 110))
            + (b.beskrivning.length > 110 ? '…' : '') + '</span>'
          : '') },
      { namn: 'Ämne', rita: b => esc(b.amne) },
      { namn: 'Årskurs', rita: b => esc(NX.årskursText(b.arskurs)) },
      { namn: 'Innehåll', rita: b => b.filvag
        ? 'Fil'
        : '<span title="' + esc(b.lank || '') + '">Länk</span>' },
      { namn: 'Tillagd', rita: b => '<span class="adm-tal">' + esc(kortDatum(b.created_at)) + '</span>'
        + (b.skapad_av ? '<span class="adm-und">' + esc(namnFör(b.skapad_av)) + '</span>' : '') },
      { namn: '', höger: true, rita: b =>
        '<button class="btn btn-ghost btn-sm" data-bib-oppna="' + esc(b.id) + '">Öppna</button>'
        /* Avstängd i stället för borttagen är förstahandsvalet: en
           läxa kan peka på raden, och ett övningsblad som försvinner
           mitt i veckan är en läxa som inte går att göra. Aktiv=false
           döljer den för studiehjälparen utan att bryta något. */
        + ' <button class="btn btn-ghost btn-sm" data-bib-aktiv="' + esc(b.id) + '">'
        + (b.aktiv ? 'Stäng av' : 'Slå på') + '</button>'
        + ' <button class="btn btn-ghost btn-sm" data-bib-bort="' + esc(b.id) + '">Ta bort</button>' }
    ], rader, tomtText(sök || fAmne || fAk,
      'Inget material matchar filtret',
      'Biblioteket är tomt. Lägg till det första ovan.'));

    /* Avstängda rader ska synas som avstängda även i tabellen ovan,
       som inte har någon egen kolumn för det. */
    rader.forEach((b, i) => {
      if (b.aktiv) return;
      const tr = host.querySelectorAll('tbody tr')[i];
      if (tr) tr.style.opacity = '.5';
    });
  }

  /* ---- fil eller länk ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('#bib-typ [data-btyp]');
    if (!knapp) return;
    bibTyp = knapp.dataset.btyp;
    $$('#bib-typ [data-btyp]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.btyp === bibTyp)));
    $('#bib-fil-grupp').hidden = bibTyp !== 'fil';
    $('#bib-lank-grupp').hidden = bibTyp !== 'lank';
  });

  const filväljare = $('#bib-fil');
  if (filväljare) filväljare.addEventListener('change', () => {
    const f = filväljare.files && filväljare.files[0];
    $('#bib-fil-namn').textContent = f ? f.name : 'Ingen fil vald';
  });

  ['#bib-sok', '#bib-filter-amne', '#bib-filter-ak'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', ritaBibliotek);
  });

  /* ============================================================
     LÄGG TILL

     RADEN FÖRST, FILEN SEDAN. Hinkens insert-policy kräver att
     sökvägens uuid finns som en rad i biblioteksmaterial — laddar
     man upp först får man "new row violates row-level security
     policy" utan att förstå varför.

     Går uppladdningen fel städas raden bort igen. En rad utan fil
     är inte bara tom: check-villkoret kräver fil eller länk, så
     raden skapas med filvägen redan ifylld, och blir den fel pekar
     biblioteket på en fil som inte finns.
     ============================================================ */
  const form = $('#bib-form');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#bib-msg');
    rensa(msg);

    const titel = $('#bib-titel').value.trim();
    if (!titel) { säg(msg, 'Materialet behöver en rubrik.', false); return; }

    const fil = bibTyp === 'fil' ? ($('#bib-fil').files || [])[0] : null;
    const länk = bibTyp === 'lank' ? $('#bib-lank').value.trim() : '';

    if (bibTyp === 'fil') {
      const fel = M.granskaFil(fil);
      if (fel) { säg(msg, fel, false); return; }
    } else if (!länk) {
      säg(msg, 'Fyll i adressen.', false); return;
    }

    await medan($('#bib-spara'), 'Sparar…', async () => {
      const mig = (await supa.auth.getUser()).data.user;

      /* Sökvägen byggs ur radens uuid, inte ur filnamnet. Ett
         filnamn heter i praktiken "Provräkning åk 8 v42.pdf", och
         sökvägen är det enda i en hink som syns innan man öppnat
         filen. Därför måste id:t vara känt före uppladdningen, och
         därför skapas raden först. */
      const id = crypto.randomUUID();
      const rent = fil ? fil.name.replace(/[^\w.\-]+/g, '_').slice(-80) : '';
      const sökväg = fil ? id + '/' + rent : null;

      const { error } = await supa.from('biblioteksmaterial').insert({
        id: id,
        titel: titel,
        beskrivning: $('#bib-beskrivning').value.trim() || null,
        amne: $('#bib-amne').value,
        arskurs: $('#bib-arskurs').value,
        filvag: sökväg,
        lank: länk || null,
        skapad_av: mig ? mig.id : null
      });
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      if (fil) {
        const upp = await supa.storage.from('bibliotek')
          .upload(sökväg, fil, { contentType: fil.type, upsert: false });
        if (upp.error) {
          /* Raden städas bort. Blir den kvar pekar biblioteket på en
             fil som aldrig laddades upp, och den som klickar Öppna
             får ett fel utan förklaring. */
          await supa.from('biblioteksmaterial').delete().eq('id', id);
          säg(msg, 'Filen kunde inte laddas upp: ' + upp.error.message
            + ' Ingenting sparades.', false);
          return;
        }
      }

      form.reset();
      $('#bib-fil-namn').textContent = 'Ingen fil vald';
      await hämtaBibliotek();
      ritaBibliotek();
      säg(msg, '✓ ' + titel + ' ligger nu i biblioteket och syns för '
        + 'studiehjälparna under ' + NX.årskursText($('#bib-arskurs').value) + '.', true);
    });
  });

  /* ---- öppna ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bib-oppna]');
    if (!knapp) return;
    const b = (S.bibliotek || []).find(x => x.id === knapp.dataset.bibOppna);
    if (!b) return;

    if (b.lank) { window.open(b.lank, '_blank', 'noopener'); return; }
    await medan(knapp, '…', async () => {
      const url = await M.signera('bibliotek', b.filvag);
      if (!url) { alert('Filen gick inte att öppna. Den kan ha tagits bort ur hinken.'); return; }
      window.open(url, '_blank', 'noopener');
    });
  });

  /* ---- av och på ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bib-aktiv]');
    if (!knapp) return;
    const b = (S.bibliotek || []).find(x => x.id === knapp.dataset.bibAktiv);
    if (!b) return;

    await medan(knapp, '…', async () => {
      const { error } = await supa.from('biblioteksmaterial')
        .update({ aktiv: !b.aktiv }).eq('id', b.id);
      if (error) { alert('Kunde inte ändra: ' + felText(error)); return; }
      b.aktiv = !b.aktiv;
      ritaBibliotek();
    });
  });

  /* ============================================================
     TA BORT

     FILEN FÖRST, RADEN SEDAN, OCH LÄS SVARET. Sökvägen finns bara i
     raden — försvinner raden först blir filen omöjlig att hitta och
     omöjlig att städa. Det var precis det felet Fas 9.2 rättade på
     ett annat ställe.
     ============================================================ */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bib-bort]');
    if (!knapp) return;
    const b = (S.bibliotek || []).find(x => x.id === knapp.dataset.bibBort);
    if (!b) return;

    const ja = await bekräfta({
      titel: 'Ta bort ' + b.titel + '?',
      text: 'Materialet försvinner ur biblioteket. Läxor som redan pekar på det '
        + 'blir kvar men tappar materialet — vill du bara dölja det för '
        + 'studiehjälparna är "Stäng av" det rätta valet.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(knapp, 'Tar bort…', async () => {
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
      S.bibliotek = (S.bibliotek || []).filter(x => x.id !== b.id);
      ritaBibliotek();
    });
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, { ritaBibliotek });
})();
