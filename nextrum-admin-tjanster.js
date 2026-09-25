/* ============================================================
   NEXTRUM — adminvyn, Tjänster: tjänstekatalogen och rabattkoderna

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  const { S, kortDatum, pill, rad, tabell } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaPris = (...a) => NXAdmin.rita.ritaPris(...a);

  /* ------------------------------------------------------------
     TJÄNSTEKATALOGEN

     Ett kort per tjänst. `aktiv` är det enda som avgör vad
     besökare ser, så den kryssrutan är sidans vassaste kontroll —
     och den vägrar slås på för en tjänst utan pris. En tjänst som
     går att boka men inte prissätta blir en faktura ingen kan
     skriva.
     ------------------------------------------------------------ */
  /* Den tjänst en ansökan utan val gäller: katalogens första aktiva
     jobbtjänst. S.tjanster är hela katalogen (admin läser även de
     inaktiva), så urvalet görs här. NXTjanster finns på sidan, men
     dess ladda() anropas aldrig här, så den är bara sista reserv. */
  function standardJobbtjanst() {
    const f = (S.tjanster || []).filter(t => t.aktiv && t.for_jobb)
      .sort((a, b) => (a.ordning - b.ordning) || String(a.kod).localeCompare(String(b.kod)));
    return f.length ? f[0].kod : NXTjanster.standardJobb();
  }

  /* Villkoren från Fas 5.1, utfällbara. Förvalen är hur läxhjälpen
     fungerar i dag, så en tjänst som ingen rört beter sig som den
     alltid gjort. Fälten heter tj-<fält>-<kod>, och spara läser dem
     med tjFält() nedan. */
  const TJ_BOKNINGSTYP = [['pass', 'Pass i kalendern'], ['forfragan', 'Förfrågan som vi planerar']];
  const TJ_KUNDTYP = [['privat', 'Privatpersoner'], ['foretag', 'Företag'], ['bada', 'Båda']];

  function tjanstVillkor(t) {
    const id = f => 'tj-' + f + '-' + esc(t.kod);
    const val = (lista, valt) => lista.map(([v, text]) =>
      '<option value="' + v + '"' + (v === valt ? ' selected' : '') + '>' + esc(text) + '</option>').join('');
    const ers = t.ersattning_per_timme_ore === null || t.ersattning_per_timme_ore === undefined
      ? '' : Math.round(t.ersattning_per_timme_ore / 100);
    const json = v => esc(JSON.stringify(v || {}, null, 2));
    const öppen = !!(t.rut_berattigad || t.ersattning_per_timme_ore !== null && t.ersattning_per_timme_ore !== undefined
      || (t.bokningstyp && t.bokningstyp !== 'pass') || t.min_alder);

    return '<details class="tj-villkor"' + (öppen ? ' open' : '') + '>'
      + '<summary>Villkor och RUT</summary>'
      + '<div class="tj-villkor-grid">'
      + '<div class="fgroup"><label for="' + id('ers') + '">Ersättning, kr per timme</label>'
      + '<input class="inp" id="' + id('ers') + '" type="number" min="0" max="5000" step="1" inputmode="numeric"'
      + ' placeholder="Studiehjälparens egen" value="' + ers + '"></div>'
      + '<div class="fgroup"><label for="' + id('bokning') + '">Bokas som</label>'
      + '<select class="sel" id="' + id('bokning') + '">' + val(TJ_BOKNINGSTYP, t.bokningstyp || 'pass') + '</select></div>'
      + '<div class="fgroup"><label for="' + id('kund') + '">Kunder</label>'
      + '<select class="sel" id="' + id('kund') + '">' + val(TJ_KUNDTYP, t.kundtyp || 'privat') + '</select></div>'
      + '<div class="fgroup"><label for="' + id('jobb') + '">Jobbtyp</label>'
      + '<input class="inp" id="' + id('jobb') + '" maxlength="40" spellcheck="false"'
      + ' value="' + esc(t.jobbtyp || 'studiehjalpare') + '"></div>'
      + '<div class="fgroup"><label for="' + id('alder') + '">Lägsta ålder</label>'
      + '<input class="inp" id="' + id('alder') + '" type="number" min="1" max="99" step="1" inputmode="numeric"'
      + ' placeholder="Ingen gräns" value="' + (t.min_alder || '') + '"></div>'
      + '<div class="fgroup"><label for="' + id('rutp') + '">RUT, procent av arbetskostnaden</label>'
      + '<input class="inp" id="' + id('rutp') + '" type="number" min="0" max="100" step="1" inputmode="numeric"'
      + ' placeholder="0 = ingen RUT" value="' + (t.rut_procent || '') + '"></div>'
      + '</div>'
      + '<p class="xsmall tj-villkor-not">Ersättningen gäller från nästa månadskörning. '
      + 'Bokningstyp, kunder, jobbtyp, ålder, krav och matchningsregler sparas nu men styr ingenting '
      + 'förrän tjänsten aktiveras med sina regler (Fas 10) — och ett pass kommer alltid med på '
      + 'underlaget först när det har en rapport. RUT-andelen sparas men dras inte: familjen betalar '
      + 'med kort, och kortbetalningen drar inget avdrag. En RUT-berättigad tjänst går därför inte '
      + 'att slå på för kunder.</p>'
      + '<div class="fgroup"><label for="' + id('krav') + '">Krav (JSON)</label>'
      + '<textarea class="inp tj-json" id="' + id('krav') + '" rows="3" spellcheck="false">' + json(t.krav) + '</textarea></div>'
      + '<div class="fgroup"><label for="' + id('match') + '">Matchningsregler (JSON)</label>'
      + '<textarea class="inp tj-json" id="' + id('match') + '" rows="3" spellcheck="false">' + json(t.matchningsregler) + '</textarea></div>'
      + '</details>';
  }

  /* ------------------------------------------------------------
     LANSERINGSCHECKLISTAN (Fas 10)

     Tre högar, och skillnaden mellan dem är hela poängen.

     SPÄRRAR är det databasen vägrar. Varje rad här motsvarar ett
     villkor i skydda_tjansteaktivering(), och varje villkor finns
     för att systemet annars räknar fel TYST: utan pris tar
     kortbetalningen läxhjälpens timpris (stripe-checkout läser
     prissattning som reserv) och tar betalt som om det vore
     tjänstens eget. Sedan Fas 14.2 också RUT: kortbetalningen drar
     inget avdrag, så en RUT-tjänst för kunder hade tagit fullt pris
     av någon som lovats avdrag.

     ATT BESTÄMMA är sådant databasen inte kan ha en åsikt om. Ett
     tomt `krav` är både förvalet och ett tänkbart svar, så ett krav
     på "ifyllt" hade gått att uppfylla med {"x":1}. Det är en
     människa som ska läsa det, inte en trigger som räknar klamrar.

     UTANFÖR DATABASEN är det ingen kod kan se. Om /barnvakt svarar
     200, och om texten finns på båda språken, vet bara den som
     tittat. Därför står de raderna också i bekräftelsedialogen: det
     är där beslutet faktiskt fattas.

     Checklistan lagrar ingenting. Den läser raden. Ett eget
     nyckelformat i `uppgifter` hade blivit bärande kod som inget
     CI-verktyg vaktar, för tre tjänster som lanseras kanske en gång
     om året. ------------------------------------------------------------ */

  function tjanstPunkter(t) {
    const kr = v => (v === null || v === undefined) ? null : Math.round(v / 100);
    const år = new Date().getFullYear();
    const harTak = (S.rutTak || []).some(r => Number(r.ar) === år);

    const spärrar = [];
    spärrar.push({
      ok: !!(t.for_kund || t.for_jobb),
      text: 'Går att boka eller söka till',
      hjälp: 'En aktiv tjänst som är varken eller syns ingenstans men vidgar katalogen.'
    });
    if (t.for_kund) {
      spärrar.push({
        ok: !!(t.pris_per_timme_ore && t.pris_per_timme_ore > 0),
        text: 'Pris per timme är satt',
        hjälp: 'Utan pris tar kortbetalningen läxhjälpens timpris — och tar betalt '
             + 'som om det vore den här tjänstens pris.'
      });
      spärrar.push({
        ok: !t.rut_berattigad,
        text: 'Inte RUT-berättigad',
        hjälp: 'Kortbetalningen drar inte RUT-avdraget. En RUT-tjänst hade tagit fullt pris '
             + 'av en kund som lovats avdrag, och ingen hade begärt resten från Skatteverket.'
      });
    }
    if (Number(t.extra_personer_max || 1) > 1) {
      spärrar.push({
        ok: t.extra_personer_ore !== null && t.extra_personer_ore !== undefined,
        text: 'Tillägg för flera personer är satt',
        hjälp: 'Tjänsten tillåter ' + t.extra_personer_max + ' personer. Utan belopp '
             + 'blir tillägget tyst noll.'
      });
    }

    const bestäm = [
      { ok: true,
        text: t.ersattning_per_timme_ore === null || t.ersattning_per_timme_ore === undefined
          ? 'Ersättning: studiehjälparens egen timpenning'
          : 'Ersättning: ' + kr(t.ersattning_per_timme_ore) + ' kr i timmen',
        hjälp: 'Tomt fält är ett giltigt svar och betyder den enskildes egen timpenning. '
             + 'Saknas båda hoppar månadskörningen över passet och rapporterar det.' },
      { ok: t.krav && Object.keys(t.krav).length > 0,
        text: 'Kraven på den som utför tjänsten är skrivna',
        hjälp: 'Spärrar inte. Ett tomt krav går inte att skilja från ett oifyllt, så '
             + 'den här raden är en påminnelse — inte en kontroll.' },
      { ok: !!t.bokningstyp,
        text: 'Bokas som: ' + (t.bokningstyp === 'forfragan' ? 'förfrågan vi planerar' : 'pass i kalendern'),
        hjälp: 'Förvalet är pass. Stämmer det för den här tjänsten?' }
    ];
    if (t.rut_berattigad) {
      bestäm.push({
        ok: harTak,
        text: 'RUT-tak för ' + år + ' är inlagt',
        hjälp: 'Tjänsten är RUT-berättigad. Taket behövs den dag kortbetalningen kan dra '
             + 'avdraget — i dag drar den inget, och tjänsten går inte att slå på för kunder.'
      });
    }

    return { spärrar: spärrar, bestäm: bestäm };
  }

  /* De raderna ingen kod kan svara på. De står både i kortet och i
     dialogen när tjänsten slås på — det är där beslutet fattas. */
  const TJ_MANUELLT = [
    'Den publika texten om tjänsten är skriven och publicerad',
    'Den finns på både svenska och engelska',
    'Någon har läst kraven och tycker att de stämmer'
  ];

  function tjanstChecklista(t) {
    const p = tjanstPunkter(t);
    const kvar = p.spärrar.filter(x => !x.ok).length;
    const rad = (x, sort) =>
      '<li class="tj-check-rad' + (x.ok ? ' ar-klar' : sort === 'sparr' ? ' ar-ny' : '') + '">'
      + '<b>' + (x.ok ? '✓' : sort === 'sparr' ? '✗' : '–') + '</b>'
      + '<span>' + esc(x.text) + '<span class="adm-und">' + esc(x.hjälp) + '</span></span></li>';

    return '<details class="tj-check"' + (t.aktiv || kvar ? '' : ' open') + '>'
      + '<summary>Lansering'
      + (t.aktiv ? ' ' + pill('Live', 'ar-klar')
                 : kvar ? ' ' + pill(kvar + (kvar === 1 ? ' spärr kvar' : ' spärrar kvar'), 'ar-ny')
                        : ' ' + pill('Går att slå på', 'ar-vantar'))
      + '</summary>'
      + '<p class="xsmall">Databasen vägrar det första stycket. Resten är ditt omdöme.</p>'
      + '<ul class="tj-check-lista">' + p.spärrar.map(x => rad(x, 'sparr')).join('') + '</ul>'
      + '<ul class="tj-check-lista">' + p.bestäm.map(x => rad(x, 'bestam')).join('') + '</ul>'
      + '<ul class="tj-check-lista tj-check-manuellt">'
      + TJ_MANUELLT.map(x => '<li class="tj-check-rad"><b>?</b><span>' + esc(x) + '</span></li>').join('')
      + '</ul>'
      + '<p class="xsmall">De tre sista kan ingen kod svara på. Du får frågan igen när du '
      + 'slår på tjänsten.</p>'
      + '</details>';
  }

  /* Läser och kontrollerar villkoren för en tjänst. Samma regler som
     databasens check-villkor, så att felet syns här och inte som en
     kod från servern. Returnerar { fel } eller { värden }. */
  function tjFält(kod) {
    const f = namn => document.getElementById('tj-' + namn + '-' + kod);
    const tal = (namn, min, max) => {
      const fält = f(namn);
      /* Ett nummerfält som fått text ("30 %", "150 kr") svarar med en
         tom sträng. Utan den här kontrollen hade det sparats som tomt. */
      if (fält && fält.validity && fält.validity.badInput) return { fel: true };
      const rå = String((fält || {}).value || '').trim();
      if (rå === '') return { v: null };
      const n = Number(rå);
      if (!Number.isInteger(n) || n < min || n > max) return { fel: true };
      return { v: n };
    };
    const objekt = namn => {
      const rå = String((f(namn) || {}).value || '').trim();
      if (rå === '') return { v: {} };
      try {
        const v = JSON.parse(rå);
        return (v && typeof v === 'object' && !Array.isArray(v)) ? { v } : { fel: true };
      } catch (e) { return { fel: true }; }
    };

    if (!f('bokning')) return { värden: {} };   // kortet ritades utan villkor

    const ers = tal('ers', 0, 5000);
    if (ers.fel) return { fel: 'Ersättningen ska vara hela kronor, eller tom för studiehjälparens egen timpenning.' };
    const ålder = tal('alder', 1, 99);
    if (ålder.fel) return { fel: 'Lägsta ålder ska vara ett heltal mellan 1 och 99, eller tomt.' };
    const rut = tal('rutp', 0, 100);
    if (rut.fel) return { fel: 'RUT-andelen ska vara ett heltal mellan 0 och 100.' };
    const jobb = String(f('jobb').value || '').trim();
    if (!/^[a-z][a-z_]{1,39}$/.test(jobb)) return { fel: 'Jobbtypen skrivs med små bokstäver och understreck, t.ex. studiehjalpare.' };
    const krav = objekt('krav');
    if (krav.fel) return { fel: 'Kraven ska vara ett JSON-objekt, t.ex. {}.' };
    const match = objekt('match');
    if (match.fel) return { fel: 'Matchningsreglerna ska vara ett JSON-objekt, t.ex. {}.' };

    const procent = rut.v || 0;
    return {
      värden: {
        ersattning_per_timme_ore: ers.v === null ? null : ers.v * 100,
        bokningstyp: f('bokning').value,
        kundtyp: f('kund').value,
        jobbtyp: jobb,
        min_alder: ålder.v,
        rut_procent: procent,
        rut_berattigad: procent > 0,
        krav: krav.v,
        matchningsregler: match.v
      }
    };
  }

  function ritaTjanster() {
    const host = $('#tj-kort');
    if (!host) return;

    if (!S.tjanster.length) {
      host.innerHTML = tomt('Tjänstekatalogen saknas',
        'Kör schema-v18.sql i Supabase → SQL Editor. Tills dess är läxhjälp den enda tjänsten, '
        + 'vilket råkar vara sant.');
      return;
    }

    const senast = S.tjanster
      .map(t => t.uppdaterad).filter(Boolean).sort().pop();
    const stämpel = $('#tj-uppdaterad');
    if (stämpel) stämpel.textContent = senast ? 'ändrat ' + kortDatum(senast) : '';

    host.innerHTML = '<div class="adm-koppling">' + S.tjanster.map(t => {
      const kr = t.pris_per_timme_ore ? Math.round(t.pris_per_timme_ore / 100) : '';
      const märken = [
        t.for_kund ? pill('Bokas av kund', 'ar-klar') : '',
        t.for_jobb ? pill('Sökbart uppdrag', 'ar-vantar') : ''
      ].filter(Boolean).join(' ');

      return '<div class="adm-koppling-kort">'
        + '<h6>' + esc(t.namn)
        + '<span class="adm-und" style="font-family:var(--f-mono);font-size:10px;margin-left:auto">'
        + esc(t.kod) + '</span></h6>'
        + '<p>' + esc(t.kort || '') + '</p>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + märken + '</div>'
        + '<div class="fgroup" style="margin:0">'
        + '<label for="tj-pris-' + esc(t.kod) + '">Kronor per timme</label>'
        + '<input class="inp" id="tj-pris-' + esc(t.kod) + '" data-tj-pris="' + esc(t.kod) + '"'
        + ' type="number" min="1" max="5000" step="1" inputmode="numeric"'
        + ' placeholder="Inte bestämt" value="' + kr + '">'
        + '</div>'
        + tjanstVillkor(t)
        + tjanstChecklista(t)
        + '<label class="ag-kryss" style="margin:0">'
        + '<input type="checkbox" data-tj-aktiv="' + esc(t.kod) + '"' + (t.aktiv ? ' checked' : '') + '> '
        + 'Aktiv — syns för besökare</label>'
        + '<button class="btn btn-primary btn-sm" data-tj-spara="' + esc(t.kod) + '">Spara</button>'
        + '<p class="ok-msg" data-tj-msg="' + esc(t.kod) + '" style="margin:0"></p>'
        + '</div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     RABATTKODERNA

     Koder tas inte bort, de stängs av. En borttagen kod tar med sig
     svaret på frågan "varför blev det här passet billigare" — och
     bookings.rabattkod pekar på raden.
     ------------------------------------------------------------ */
  function rabattText(r) {
    return r.typ === 'procent' ? r.varde + ' %' : kronor(r.varde);
  }

  function ritaRabattkoder() {
    const host = $('#rk-tabell');
    if (!host) return;

    /* Rullgardinen för tjänst fylls ur katalogen, inte ur en lista
       här — annars går de isär den dag en tjänst tillkommer. */
    const val = $('#rk-tjanst');
    if (val && val.options.length <= 1 && S.tjanster.length) {
      val.innerHTML = '<option value="">Alla tjänster</option>'
        + S.tjanster.map(t => '<option value="' + esc(t.kod) + '">' + esc(t.namn) + '</option>').join('');
    }

    $('#rk-antal').textContent = S.rabattkoder.length ? S.rabattkoder.length + ' st' : '';

    host.innerHTML = tabell([
      { namn: 'Kod', rita: r => '<b style="font-family:var(--f-mono);letter-spacing:.06em">'
          + esc(r.kod) + '</b>'
          + (r.beskrivning ? '<span class="adm-und">' + esc(r.beskrivning) + '</span>' : '') },
      { namn: 'Rabatt', rita: r => '<span class="adm-tal">' + esc(rabattText(r)) + '</span>' },
      { namn: 'Gäller', rita: r => esc(r.tjanst ? (S.tjanster.find(t => t.kod === r.tjanst) || {}).namn || r.tjanst : 'Alla tjänster') },
      { namn: 'Till', rita: r => '<span class="adm-tal">' + esc(r.giltig_till ? kortDatum(r.giltig_till) : '—') + '</span>' },
      { namn: 'Använd', rita: r => '<span class="adm-tal">' + r.antal_anvandningar
          + (r.max_anvandningar ? ' / ' + r.max_anvandningar : '') + '</span>' },
      { namn: 'Läge', rita: r => {
          /* Slut och utgången är två olika skäl att koden inte
             fungerar, och den som felsöker behöver veta vilket. */
          const slut = r.max_anvandningar && r.antal_anvandningar >= r.max_anvandningar;
          const ute = r.giltig_till && r.giltig_till < isoFor(new Date());
          if (!r.aktiv) return pill('Avstängd', '');
          if (slut) return pill('Slut', 'ar-vantar');
          if (ute) return pill('Utgången', 'ar-vantar');
          return pill('Aktiv', 'ar-klar');
        } },
      { namn: '', höger: true, rita: r => '<button class="btn btn-ghost btn-sm" data-rk-vaxla="'
          + esc(r.kod) + '">' + (r.aktiv ? 'Stäng av' : 'Slå på') + '</button>' }
    ], S.rabattkoder, 'Inga rabattkoder än');
  }

  /* ============ rabattkoderna ============ */
  (function kopplaRabattkoder() {
    const form = $('#rk-form');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#rk-msg');
      rensa(msg);

      const kod = String($('#rk-kod').value || '').trim().toUpperCase();
      const typ = $('#rk-typ').value;
      const varde = Number($('#rk-varde').value);

      /* Samma villkor som check-constraintet i databasen. Det här är
         inte säkerheten — den ligger i basen — utan ett begripligt
         besked i stället för ett constraint-fel. */
      if (!/^[A-Z0-9-]{3,24}$/.test(kod)) {
        säg(msg, 'Koden får bara innehålla A–Z, 0–9 och bindestreck, 3–24 tecken.', false); return;
      }
      if (!varde || varde < 1) { säg(msg, 'Fyll i ett värde.', false); return; }
      if (typ === 'procent' && varde > 100) {
        säg(msg, 'Mer än 100 procent är inte en rabatt.', false); return;
      }

      await medan($('#rk-spara'), 'Skapar…', async () => {
        const { error } = await supa.from('rabattkoder').insert({
          kod,
          typ,
          // Fast belopp skrivs i kronor och lagras i öre, som allt annat.
          varde: typ === 'belopp' ? Math.round(varde * 100) : Math.round(varde),
          tjanst: $('#rk-tjanst').value || null,
          giltig_till: $('#rk-till').value || null,
          max_anvandningar: Number($('#rk-max').value) || null,
          beskrivning: String($('#rk-text').value || '').trim() || null
        });

        if (error) {
          säg(msg, error.code === '23505'
            ? 'Det finns redan en kod som heter ' + kod + '.'
            : 'Kunde inte skapa: ' + felText(error), false);
          return;
        }

        const ny = await supa.from('rabattkoder').select('*').order('skapad', { ascending: false });
        S.rabattkoder = ny.data || [];
        ritaRabattkoder();
        form.reset();
        säg(msg, '✓ ' + kod + ' är skapad och gäller direkt.', true);
      });
    });
  })();

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-rk-vaxla]');
    if (!knapp) return;
    const kod = knapp.dataset.rkVaxla;
    const rad = S.rabattkoder.find(r => r.kod === kod);
    if (!rad) return;

    await medan(knapp, '…', async () => {
      const { error } = await supa.from('rabattkoder')
        .update({ aktiv: !rad.aktiv }).eq('kod', kod);
      if (error) { alert('Kunde inte ändra: ' + felText(error)); return; }
      rad.aktiv = !rad.aktiv;
      ritaRabattkoder();
    });
  });

  /* ============ tjänsterna ============
     Ett spara per kort. Delegerat, eftersom korten ritas om varje
     gång något sparas — en lyssnare per knapp hade tappats bort vid
     första omritningen. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-tj-spara]');
    if (!knapp) return;

    const kod = knapp.dataset.tjSpara;
    const rad = S.tjanster.find(t => t.kod === kod);
    const msg = $('[data-tj-msg="' + kod + '"]');
    const prisFalt = $('[data-tj-pris="' + kod + '"]');
    const aktivRuta = $('[data-tj-aktiv="' + kod + '"]');
    if (!rad || !prisFalt || !aktivRuta) return;
    rensa(msg);

    const rå = String(prisFalt.value).trim();
    const kr = rå === '' ? null : Number(rå);
    const aktiv = aktivRuta.checked;

    if (kr !== null && (!Number.isFinite(kr) || kr < 1)) {
      säg(msg, 'Fyll i ett pris i hela kronor, eller lämna tomt.', false);
      return;
    }

    const villkor = tjFält(kod);
    if (villkor.fel) { säg(msg, villkor.fel, false); return; }

    /* Speglar skydda_tjansteaktivering() i databasen, så att felet
       syns här och inte som rå servertext genom felText() nedan.
       Databasen är skyddet; den här spärren är beskedet. Ändras den
       ena måste den andra följa med — samma regel som filens övriga
       kontroller följer. */
    if (aktiv) {
      const prisSaknas = rad.for_kund && kr === null;
      const flerUtanTillagg = Number(rad.extra_personer_max || 1) > 1
        && (rad.extra_personer_ore === null || rad.extra_personer_ore === undefined);
      const oanvandbar = !rad.for_kund && !rad.for_jobb;
      /* Fas 14.2. RUT-andelen skrivs i samma formulär, så det är
         formulärets värde som gäller — inte radens, som kan vara på
         väg att ändras. */
      const rutFörKund = rad.for_kund && (villkor.värden.rut_berattigad !== undefined
        ? villkor.värden.rut_berattigad : !!rad.rut_berattigad);

      if (prisSaknas) {
        säg(msg, 'Sätt ett pris först. Utan pris tar kortbetalningen läxhjälpens timpris '
          + 'för tjänsten och tar betalt som om det vore tjänstens eget.', false);
        aktivRuta.checked = false;
        return;
      }
      if (rutFörKund) {
        säg(msg, 'Kortbetalningen drar inte RUT-avdraget, så en RUT-berättigad tjänst kan inte '
          + 'bokas av kunder än. Ta bort RUT-andelen, eller vänta tills kortbetalningen kan dra '
          + 'avdraget.', false);
        aktivRuta.checked = false;
        return;
      }
      if (flerUtanTillagg) {
        säg(msg, 'Tjänsten tillåter ' + rad.extra_personer_max + ' personer men saknar '
          + 'tillägg för dem. Tillägget blir då tyst noll.', false);
        aktivRuta.checked = false;
        return;
      }
      if (oanvandbar) {
        säg(msg, 'Tjänsten är varken bokbar eller sökbar. Då syns den ingenstans, '
          + 'men finns ändå i katalogen.', false);
        aktivRuta.checked = false;
        return;
      }
    }

    const öre = kr === null ? null : kr * 100;
    const slårPå = aktiv && !rad.aktiv;
    const prisÄndrat = öre !== rad.pris_per_timme_ore;
    const v = villkor.värden;
    /* RUT och ersättning på en tjänst som redan syns ändrar vad någon
       betalar eller får betalt — det är värt en fråga. */
    const pengarÄndrade = rad.aktiv && !slårPå && v.rut_procent !== undefined
      && (v.rut_procent !== (rad.rut_procent || 0)
          || v.ersattning_per_timme_ore !== (rad.ersattning_per_timme_ore ?? null));

    /* VILLKOREN LOVAR PRISET SOM GÄLLDE VID BOKNINGEN, men kortbetalningen
       räknar priset när familjen betalar. Ett bokat men obetalt pass får
       alltså det nya priset. En sänkning skadar ingen; en höjning på ett
       pass som redan är bokat är ett löfte som bryts. Tills priset fryses
       på bokningen, som rabatten redan gör, är det den här dialogen som
       säger det, med antalet pass det gäller. */
    /* Ett fakturapass (Fas 14.6) får också det nya priset: fakturan
       räknas när månaden är slut, inte när passet bokas. Därför räknas
       'faktura' med här, fast det inte är ett obetalt kortpass. Ett
       genomfört fakturapass som inte fakturerats än gör det också. */
    const höjt = öre !== null && rad.pris_per_timme_ore != null && öre > rad.pris_per_timme_ore;
    const fakturerade = new Set();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => fakturerade.add(l.booking_id)));
    const väntar = (S.bokningar || []).filter(b =>
      (b.status === 'requested' || b.status === 'confirmed'
        || (b.status === 'completed' && b.betalning_status === 'faktura' && !fakturerade.has(b.id)))
      && b.fakturerbar !== false
      && (!b.tjanst || b.tjanst === 'laxhjalp')
      && ['ingen', 'vantar', 'misslyckad', 'faktura'].indexOf(b.betalning_status || 'ingen') !== -1).length;

    /* Bekräfta bara det som är värt att bekräfta. En dialog vid varje
       spara lär folk att klicka bort dialoger. */
    if (slårPå || (prisÄndrat && rad.kod === 'laxhjalp') || pengarÄndrade) {
      const ja = await bekräfta({
        titel: slårPå
          ? 'Slå på ' + rad.namn.toLowerCase() + ' för besökare?'
          : prisÄndrat && rad.kod === 'laxhjalp'
            ? 'Ändra läxhjälpens pris till ' + kr + ' kr i timmen?'
            : 'Ändra ersättning eller RUT för ' + rad.namn.toLowerCase() + '?',
        text: slårPå
          ? 'Tjänsten dyker upp i intresseanmälan, i ansökan och i bokningen så fort '
            + 'någon laddar om sidan.\n\nDet här kan ingen kod kontrollera åt dig:\n'
            + TJ_MANUELLT.map(x => '· ' + x).join('\n')
            + '\n\nSvarar du ja utan att ha gjort dem kan man beställa något sajten '
            + 'inte beskriver.'
          : prisÄndrat && rad.kod === 'laxhjalp'
            ? 'Gäller varje pass som betalas efter ändringen — också pass som redan är '
              + 'bokade men inte betalda. Pass som redan är betalda behåller sitt belopp.'
              + (höjt && väntar
                ? '\n\nVillkoren lovar familjen priset som gällde när passet bokades. Just nu '
                  + 'finns ' + väntar + ' bokade pass som inte är betalda, och de skulle betala '
                  + 'det nya priset. Vänta med höjningen tills de är betalda.'
                : '')
              + '\n\nKom ihåg att ändra priset på prissidan, i FAQ:n och i användarvillkoren också.'
            : 'Gäller pass som kommer med på underlag från nästa körning. Redan skapade '
              + 'underlag ändras inte.',
        knapp: slårPå ? 'Slå på' : 'Spara ändringen'
      });
      if (!ja) return;
    }

    await medan(knapp, 'Sparar…', async () => {
      const nu = new Date().toISOString();
      const { error } = await supa.from('tjanster')
        .update(Object.assign({ pris_per_timme_ore: öre, aktiv: aktiv, uppdaterad: nu }, v))
        .eq('kod', kod);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }

      rad.pris_per_timme_ore = öre;
      rad.aktiv = aktiv;
      rad.uppdaterad = nu;
      Object.assign(rad, v);

      /* Läxhjälpens pris speglas till prissattning av en trigger i
         databasen. Den lokala kopian måste följa med, annars visar
         månadskörningens sammanfattning det gamla talet tills någon
         laddar om. */
      if (kod === 'laxhjalp' && öre !== null) {
        S.pris = { pris_per_timme_ore: öre, uppdaterad: nu };
        ritaPris();
      }

      ritaTjanster();
      const nyMsg = $('[data-tj-msg="' + kod + '"]');
      säg(nyMsg, aktiv
        ? '✓ Sparat. ' + rad.namn + ' syns för besökare.'
        : '✓ Sparat. ' + rad.namn + ' syns inte för besökare.', true);
    });
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaRabattkoder, ritaTjanster, standardJobbtjanst
  });
})();
