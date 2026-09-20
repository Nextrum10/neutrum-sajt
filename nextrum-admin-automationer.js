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

   Panelen finns för att kontrollerna ska gå att SE köra. En
   automation som aldrig visats göra rätt får inte schemaläggas, och
   det är därför knappen här kom före cron-jobbet.

   En del av adminvyn, som laddas efter kärnan
   (nextrum-admin-karna.js) och registrerar sina funktioner i
   NXAdmin.rita. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, rensa, felText } = NX;
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
     SCHEMAT

     pg_cron är inte installerat än. Funktionen driftkorningar()
     kommer med det, så dess existens ÄR svaret på frågan om
     schemat finns — i stället för en text här som blir osann den
     dag extensionen läggs in.
     ------------------------------------------------------------ */
  async function ritaSchema() {
    const host = $('#aut-schema');
    if (!host) return;

    const res = await supa.rpc('driftkorningar', { dagar: 7 });
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
        ? tomt('Inget schema installerat',
            'Kontrollerna körs med knappen ovan tills pg_cron är på plats. '
            + 'Då visas varje körning här, med resultat och fel.')
        : '<p class="xsmall" style="color:var(--fel)">Kunde inte läsa körningarna: '
          + esc(felText(res.error)) + '</p>';
      return;
    }

    const rader = res.data || [];
    if (!rader.length) {
      host.innerHTML = tomt('Inga körningar än', 'Schemat har inte kört någon gång den senaste veckan.');
      return;
    }
    host.innerHTML = tabell([
      { namn: 'Jobb', rita: r => '<b>' + esc(r.jobb || '—') + '</b>' },
      { namn: 'Startade', rita: r => esc(r.startade ? kortDatum(r.startade) : '—') },
      { namn: 'Utfall', rita: r => r.status === 'succeeded'
        ? pill('Gick igenom', 'ar-klar') : pill(r.status || 'okänt', 'ar-ny') },
      { namn: 'Svar', rita: r => '<span class="adm-und">' + esc(r.svar || '') + '</span>' }
    ], rader, 'Inga körningar');
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
     redan finns i S. Schemat frågas EFTER, när fliken öppnas: så
     länge pg_cron inte är installerat svarar den frågan alltid 404,
     och en garanterad 404 vid varje inloggning gör konsolen till ett
     ställe man slutar titta på. */
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

     Samma fyra kontroller som schemat kommer att köra, genom
     kor_kontrollerna() som har adminvakten. Svaret säger hur många
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
