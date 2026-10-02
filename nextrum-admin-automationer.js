/* ============================================================
   NEXTRUM — adminvyn, Automationer (Fas 7)

   Fyra namngivna kontroller i databasen letar efter sådant som
   annars upptäcks för sent: pass utan rapport, ekonomi som inte går
   ihop, förfallna fakturor och anmälningar ingen svarat på.

   DE SKICKAR INGENTING. Varje fynd blir en uppgift under Drift →
   Uppgifter, och en människa avgör vad som ska hända. Påminnelsen
   till en familj går fortfarande via knappen i Ekonomi, med
   inloggning — ett schema som mejlar kunder medan ingen tittar är
   inte en automation, det är en risk.

   DE GÅR BARA MED KNAPPEN, med flit. Panelen finns för att
   kontrollerna ska gå att SE köra, och en automation som aldrig visats
   göra rätt får inte köra av sig själv. När de ska schemaläggas är
   Leos beslut. pg_cron finns och kör databasens egna jobb (notiserna,
   timmarna, gallringarna, månadskörningen), och de står i rutan
   Schemalagda körningar längst ned. Kontrollerna är inte bland dem.
   Schemaläggs de ska texterna här och i admin.html säga det i samma
   ändring.

   En del av adminvyn, som laddas efter kärnan
   (nextrum-admin-karna.js) och registrerar sina funktioner i
   NXAdmin.rita. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, rensa, felText, datumText } = NX;
  const { medan, tomt } = NXStudie;

  const { S, kortDatum, namnFör, pill, tabell } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const hämtaAllt = (...a) => NXAdmin.hämtaAllt(...a);
  const ritaUppgifter = (...a) => NXAdmin.rita.ritaUppgifter(...a);
  const ritaAvvikelser = (...a) => NXAdmin.rita.ritaAvvikelser(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* Samma fyra som i migrationen fas7_3c. Texten här beskriver vad
     de gör; sanningen står i SQL:en, och ändras den ena ska den
     andra följa med. */
  const KONTROLLER = [
    ['Pass utan rapport',
     'Bekräftade pass som varit för mer än ett dygn sedan utan att någon skrivit rapport. '
     + 'Utan rapport räknas passet inte som genomfört: det faktureras inte och betalas inte ut.',
     'kontroll'],
    ['Ekonomiska avvikelser',
     'Allt som inte går ihop i ekonomin: rapporter utan pass, pass som är klara men inte '
     + 'fakturerade, summor som inte stämmer med raderna, utbetalningar som fastnat.',
     'problem'],
    ['Förfallna fakturor',
     'Skickade och obetalda fakturor där förfallodagen passerat. Skapar en uppgift — '
     + 'påminnelsen skickar du själv från Ekonomi.',
     'problem'],
    ['Uppföljning',
     'Intresseanmälningar som ingen svarat på, familjer som kontaktats men inte blivit '
     + 'kunder, och ansökningar som ligger obesvarade.',
     'uppfoljning']
  ];

  /* ------------------------------------------------------------
     SCHEMAT (2026-09-29)

     pg_cron kör databasens egna jobb, och driftkorningar() svarar med
     en rad per jobb i cron.job: schemat, om det är på, den senaste
     körningen och hur många av veckans körningar som misslyckades. En
     rad per jobb och inte en per körning: notis-minut går 1 440 gånger
     om dygnet, och en lista över körningarna hade gömt nattens jobb
     bakom den. Kontrollerna ovan är inte bland jobben (se överst).

     Fas 7 räknade med att funktionen skulle komma med pg_cron, och tog
     ett saknat svar som ett saknat schema. pg_cron kom med notiserna
     utan den, och rutan sa "Inget schema installerat" medan jobben gick
     varje minut. Ett saknat svar betyder bara att migrationen inte är
     körd, och det är vad rutan säger.
     ------------------------------------------------------------ */
  const DAGAR = 7;   // pg_cron sparar körningarna i sju dagar (jobbet cron-stada)

  /* Vad jobben gör, med samma ord som minne/databasen.md. Ett jobb som inte står
     här visas med sitt namn: listan förklarar, den bestämmer inte vilka
     jobb som syns. Det gör cron.job. */
  const JOBB = {
    'notis-minut': 'Notiserna köas och skickas',
    'notis-stada': 'Gamla notiser städas bort',
    'ansokan-besked': 'Nya försök med beskeden till sökande',
    'admin-paminnelse': 'Mejl till superadmins när något legat en timme i Att göra',
    'utbildningsprov-paminn': 'Påminnelser om utbildningsprovet',
    'timmar-betalar': 'Lediga timmar betalar nästa pass',
    'timmar-gar-ut': 'Mejlet om timmar som snart går ut',
    'manadskorning': 'Månadskörningen: lönespec och fakturautkast',
    'manadskorning-svar': 'Månadskörningens svar: fel blir en uppgift',
    'leads-avidentifiering': 'Intresseanmälningar avidentifieras',
    'ansokan-gallring': 'Ansökningar och CV:n gallras',
    'kontakt-och-fel-gallring': 'Kontaktmeddelanden och klientfel gallras',
    'ai-och-uppgifter-gallring': 'AI-texter och klara uppgifter gallras',
    'konton-oanvanda': 'Oanvända konton blir uppgifter',
    'cron-stada': 'Körningar äldre än en vecka städas bort'
  };

  /* Datum och klockslag i svensk tid. kortDatum räcker inte: den tar
     datumet ur UTC-strängen, och en körning 23:30 UTC hade stått på fel
     dag. sv-SE skriver datumet som 2026-09-29, vilket datumText läser. */
  function tidText(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '—';
    const dagen = x => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const dag = dagen(d);
    const klocka = d.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
    if (dag === dagen(new Date())) return 'i dag ' + klocka;
    if (dag === dagen(new Date(Date.now() - 864e5))) return 'i går ' + klocka;
    return datumText(dag) + ' ' + klocka;
  }

  /* Schemat står i UTC. Formerna jobben har blir svenska, med nästa
     körnings klockslag i svensk tid: 03:41 UTC är 05:41 på sommaren och
     04:41 på vintern. Ett annat uttryck visas som det står. */
  const VAR_N = { 2: 'varannan', 5: 'var femte', 10: 'var tionde', 15: 'var femtonde', 30: 'var trettionde' };

  function nästaKlockslag(tim, min, dag) {
    const nu = new Date();
    let t = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), dag || nu.getUTCDate(), tim, min));
    if (t <= nu) {
      t = dag ? new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() + 1, dag, tim, min))
        : new Date(t.getTime() + 864e5);
    }
    return t.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
  }

  function schemaText(uttryck) {
    const [min, tim, dag, mån, vdag, ...rest] = String(uttryck || '').trim().split(/\s+/);
    const tal = s => (/^\d+$/.test(s || '') ? Number(s) : null);
    const somDetStår = (uttryck || '—') + ' (UTC)';
    if (rest.length || mån !== '*' || vdag !== '*') return somDetStår;
    if (dag === '*' && tim === '*') {
      if (min === '*') return 'varje minut';
      const steg = /^\*\/(\d+)$/.exec(min);
      if (steg) return (VAR_N[steg[1]] || 'var ' + steg[1] + ':e') + ' minut';
      if (tal(min) !== null) return tal(min) + ' minuter över varje timme';
    }
    if (tal(min) === null || tal(tim) === null) return somDetStår;
    if (dag === '*') return 'varje dag ' + nästaKlockslag(tal(tim), tal(min));
    const n = tal(dag);
    if (n === null) return somDetStår;
    const ändelse = (n % 10 === 1 || n % 10 === 2) && n !== 11 && n !== 12 ? ':a' : ':e';
    return 'den ' + n + ändelse + ' varje månad ' + nästaKlockslag(tal(tim), tal(min), n);
  }

  /* Färgen säger vems drag det är, som i resten av adminvyn: lera är
     ett fel eller ett jobb som står av, ockra ett som pågår just nu,
     mossa ett som gick igenom. Ett jobb som inte kört i fönstret är
     grått: månadsjobben mitt i en månad ser ut så. */
  function utfallMärke(r) {
    if (!r.aktivt) return pill('Står av', 'ar-ny');
    if (!r.status) return pill('Inte kört', '');
    if (r.status === 'succeeded') return pill('Gick igenom', 'ar-klar');
    if (r.status === 'failed') return pill('Misslyckades', 'ar-ny');
    return pill('Pågår', 'ar-vantar');
  }

  const antal = n => Number(n || 0).toLocaleString('sv-SE');

  function körningarText(r) {
    const n = Number(r.korningar || 0);
    const fel = Number(r.misslyckade || 0);
    if (!n) return 'Inte kört den senaste veckan';
    return 'Senast ' + tidText(r.startade) + ' · ' + antal(n) + (n === 1 ? ' körning' : ' körningar')
      + ' den senaste veckan, ' + (fel ? antal(fel) + ' misslyckades' : 'inga fel');
  }

  /* Felet står en gång: den senaste körningens om det var den som
     misslyckades, annars veckans senaste. */
  function felRad(r) {
    if (r.status === 'failed') return r.svar || '';
    if (Number(r.misslyckade) > 0 && r.fel) return 'Senaste felet ' + tidText(r.senast_misslyckad) + ': ' + r.fel;
    return '';
  }

  /* Det som behöver någon först: ett fel, ett jobb som står av, fel
     tidigare i veckan. Sist de som inte kört alls. */
  function vikt(r) {
    if (r.aktivt && r.status === 'failed') return 0;
    if (!r.aktivt) return 1;
    if (Number(r.misslyckade) > 0) return 2;
    return r.status ? 3 : 4;
  }

  function sammanfattning(rader) {
    const fel = rader.filter(r => Number(r.misslyckade) > 0).length;
    const av = rader.filter(r => !r.aktivt).length;
    const delar = [rader.length + ' jobb i schemat.',
      fel ? fel + ' av dem har misslyckats minst en gång den senaste veckan.'
        : 'Inget har misslyckats den senaste veckan.'];
    if (av) delar.push(av + ' står av och går inte alls.');
    return '<p class="small" style="margin:0 0 12px">' + esc(delar.join(' ')) + '</p>';
  }

  async function ritaSchema() {
    const host = $('#aut-schema');
    if (!host) return;

    const res = await supa.rpc('driftkorningar', { dagar: DAGAR });
    if (res.error) {
      /* PGRST202 = PostgREST hittade ingen funktion med det namnet
         och den signaturen. Koden är entydig; texten är det inte —
         "Could not find the function" står också när funktionen
         FINNS med andra parametrar, och "does not exist" dyker upp i
         vilket felmeddelande som helst. Texten får därför bara vara
         reserv, för fel som kommer utan kod. */
      const saknas = res.error.code === 'PGRST202'
        || (!res.error.code && /Could not find the function/i.test(res.error.message || ''));
      host.innerHTML = saknas
        ? tomt('Körningarna går inte att läsa härifrån än',
            'Databasen har inte funktionen driftkorningar(): migrationen schemalagda_korningar_syns '
            + 'är inte körd. Jobben går ändå, det är bara den här rutan som inte når dem.')
        : '<p class="xsmall" style="color:var(--fel)">Kunde inte läsa körningarna: '
          + esc(felText(res.error)) + '</p>';
      return;
    }

    const rader = (res.data || []).slice()
      .sort((a, b) => vikt(a) - vikt(b) || String(a.jobb).localeCompare(String(b.jobb), 'sv'));
    if (!rader.length) {
      /* Ett tomt cron.job är ett fel, inte ett lugnt läge: då går
         varken notiserna, gallringarna eller månadskörningen. */
      host.innerHTML = '<p class="xsmall" style="color:var(--fel)">Schemat har inga jobb: ingenting går '
        + 'av sig självt, varken notiserna, gallringarna eller månadskörningen.</p>';
      return;
    }
    /* Rader och inte en tabell, samma form som kontrollerna ovanför.
       En tabell rullar i sidled på en telefon, och utfallet stod då
       utanför skärmen; här står märket alltid till höger. */
    host.innerHTML = sammanfattning(rader) + rader.map(r => {
      const fel = felRad(r);
      return '<div class="dp-rad"><div><b>' + esc(JOBB[r.jobb] || r.jobb) + '</b>'
        + '<span>' + esc(r.jobb + ' · ' + schemaText(r.schema)) + '</span>'
        + '<span>' + esc(körningarText(r)) + '</span>'
        + (fel ? '<span style="color:var(--fel)">' + esc(fel) + '</span>' : '')
        + '</div><span class="dp-rad-hoger">' + utfallMärke(r) + '</span></div>';
    }).join('');
  }

  /* ------------------------------------------------------------
     UPPGIFTERNA MASKINEN SKAPAT

     Bara de öppna. Poängen är att se att kontrollerna hittar något
     — hela listan finns under Drift → Uppgifter.
     ------------------------------------------------------------ */
  function maskinensUppgifter() {
    return (S.uppgifter || [])
      .filter(u => u.skapad_av_typ !== 'manniska'
        && (u.status === 'oppen' || u.status === 'pagar'))
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function ritaMaskinUppgifter() {
    const host = $('#aut-uppgifter');
    if (!host) return;
    const rader = maskinensUppgifter();
    const antal = $('#aut-antal');
    if (antal) antal.textContent = rader.length ? rader.length + ' öppna' : '';

    host.innerHTML = tabell([
      { namn: 'Uppgift', rita: u => '<b>' + esc(u.titel) + '</b>'
        + (u.beskrivning ? '<span class="adm-und">'
          + esc(String(u.beskrivning).slice(0, 160)) + '</span>' : '') },
      { namn: 'Skapad', rita: u => esc(u.created_at ? kortDatum(u.created_at) : '—') },
      { namn: 'Ansvarig', rita: u => esc(u.ansvarig ? namnFör(u.ansvarig) : '—') },
      { namn: '', höger: true, rita: () => '<a class="btn btn-ghost btn-sm" href="#uppgifter">Öppna listan</a>' }
    ], rader, 'Inget som kontrollerna hittat är öppet');
  }

  function ritaKontroller() {
    const host = $('#aut-kontroller');
    if (!host) return;
    host.innerHTML = KONTROLLER.map(k =>
      '<div class="dp-rad"><div><b>' + esc(k[0]) + '</b>'
      + '<span>' + esc(k[1]) + '</span></div>'
      + '<span class="dp-rad-hoger">' + pill('Skapar uppgift', 'ar-vantar') + '</span></div>').join('');
  }

  /* Kontrollerna och listan ritas vid start — de läser bara det som
     redan finns i S. Schemat frågas EFTER, när fliken öppnas: frågan
     räknar igenom veckans körningar i cron.job_run_details (runt
     tolv tusen, de flesta notis-minut), och den som loggar in för att
     svara på en anmälan behöver inte svaret. */
  function ritaAutomationer() {
    ritaKontroller();
    ritaMaskinUppgifter();
    /* Rutan för schemat startar som "Hämtar" i markupen. Eftersom
       frågan inte ställs förrän fliken öppnas måste texten bytas nu,
       annars står panelen och laddar i all oändlighet — osynligt för
       den som aldrig öppnar fliken, men det är precis sådant som gör
       en laddningsindikator värdelös på alla andra ställen. */
    const schema = $('#aut-schema');
    if (schema) {
      schema.innerHTML = '<p class="xsmall">Körningarna hämtas när du öppnar fliken.</p>';
    }
  }

  const autFlik = $('#flik-automationer');
  if (autFlik) autFlik.addEventListener('click', () => {
    ritaMaskinUppgifter();
    ritaSchema();
  });

  /* ------------------------------------------------------------
     KÖR NU

     De fyra kontrollerna, genom kor_kontrollerna() som har
     adminvakten och kör dagliga_kontroller(). Inget schema kör dem
     (se överst), så det här är enda vägen. Svaret säger hur många
     NYA uppgifter som skapades — körs den två gånger i rad ska den
     andra ge noll, och det är hela poängen med nycklarna.
     ------------------------------------------------------------ */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('#aut-kor');
    if (!knapp) return;
    const msg = $('#aut-msg');
    rensa(msg);

    await medan(knapp, 'Kör…', async () => {
      const { data, error } = await supa.rpc('kor_kontrollerna');
      if (error) { säg(msg, 'Kontrollerna kunde inte köras: ' + felText(error), false); return; }

      const d = data || {};
      const nya = Number(d.nya_uppgifter || 0);
      /* Ental och flertal för varje etikett, inte bara för summan:
         "1 uppföljningar" läser som ett fel i räkningen. */
      const DEL = [
        [d.saknade_rapporter, 'pass utan rapport', 'pass utan rapport'],
        [d.ekonomiska_avvikelser, 'ekonomisk avvikelse', 'ekonomiska avvikelser'],
        [d.forfallna_fakturor, 'förfallen faktura', 'förfallna fakturor'],
        [d.uppfoljningar, 'uppföljning', 'uppföljningar']
      ];
      /* En kontroll som fallit rapporteras för sig. De andra tre har
         ändå gjort sitt, och ett tyst bortfall är värre än ett fult
         meddelande. */
      const trasiga = Array.isArray(d.fel) ? d.fel : [];
      const brödtext = nya
        ? nya + (nya === 1 ? ' ny uppgift' : ' nya uppgifter') + ': '
          + DEL.filter(x => Number(x[0]) > 0)
               .map(x => x[0] + ' ' + (Number(x[0]) === 1 ? x[1] : x[2])).join(', ') + '.'
        : 'Kontrollerna kördes. Inget nytt — allt de hittade finns redan som uppgifter.';

      /* Bocken hör till ett meddelande som gick bra. Ett rött
         meddelande som börjar med ✓ säger två saker samtidigt. */
      säg(msg, trasiga.length
        ? '⚠ ' + brödtext + ' Men ' + trasiga.length
          + (trasiga.length === 1 ? ' kontroll gick inte att köra: ' : ' kontroller gick inte att köra: ')
          + trasiga.map(f => f.kontroll + ' (' + f.fel + ')').join(', ')
        : '✓ ' + brödtext, !trasiga.length);

      await hämtaAllt();
      ritaMaskinUppgifter();
      ritaUppgifter();
      /* Avvikelselistan i Ekonomi erbjuder "Gör till uppgift" för
         varje rad som inte redan har en. Ritas den inte om står
         knapparna kvar för det kontrollen just tagit hand om, och
         nästa klick svarar "det finns redan en öppen uppgift". */
      ritaAvvikelser();
      await ritaÖversikt();
    });
  });

  /* ritaMaskinUppgifter exporteras separat: Drift ritar om listan när
     en uppgift byter läge, och ska INTE dra igång en ny fråga om
     schemat bara för att någon kryssat i "klar". */
  Object.assign(NXAdmin.rita, { ritaAutomationer, ritaMaskinUppgifter });
})();
