/* ============================================================
   NEXTRUM — adminvyn, Rekrytering: ansökningar, intervju, utbildning, in i poolen

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

  const { ANS_LAGE, S, fråga, hämtaAllt, hämtaMatchunderlag, kontaktaRuta,
          kortDatum, matchar, tabell, tomtText, visaRuta, väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const kandidater = (...a) => NXAdmin.rita.kandidater(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const standardJobbtjanst = (...a) => NXAdmin.rita.standardJobbtjanst(...a);

  /* ============================================================
     ANSÖKNINGAR
     ============================================================ */

  function ritaAnsokningar() {
    const sök = $('#ans-sok').value.trim();
    const st = $('#ans-status').value;
    const rader = S.ansokningar
      .filter(a => !st || a.status === st)
      .filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = rader.length + ' av ' + S.ansokningar.length;
    $('#ans-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: a => '<b>' + esc(a.name) + '</b>'
        + '<span class="adm-und">' + esc(a.email) + (a.age ? ' · ' + a.age + ' år' : '') + '</span>' },
      { namn: 'Skola', rita: a => esc(a.school || '—') },
      { namn: 'Ämnen', rita: a => esc(a.subjects || '—') },
      { namn: 'Kan jobba', rita: a => esc(a.availability || '—') },
      { namn: 'Varför', rita: a => a.why
        ? '<span title="' + esc(a.why) + '">' + esc(a.why.slice(0, 90))
          + (a.why.length > 90 ? '…' : '') + '</span>'
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Inkom', rita: a => '<span class="adm-tal">' + esc(kortDatum(a.created_at)) + '</span>' },
      /* Rekryteringens fyra steg som ett spår. En tom stämpel säger
         "inte gjort" utan att det behöver vara en egen status, och
         datumet svarar på det man faktiskt undrar: hur länge har det
         här legat still? */
      { namn: 'Steg', rita: a => '<div class="adm-spar">'
        + steg('Kontakt', a.kontaktad_at, 'data-ans-kontakt="' + esc(a.id) + '"')
        + steg('Intervju', a.intervju_at, 'data-ans-steg="intervju:' + esc(a.id) + '"')
        + steg('Utbildad', a.utbildad_at, 'data-ans-steg="utbildad:' + esc(a.id) + '"')
        + '</div>' },
      { namn: 'Läge', höger: true, rita: a => väljare('ans', ANS_LAGE, a.status, 'data-ans="' + a.id + '"')
        /* EN knapp, inte fyra. Spåret ovan visar var en ansökan
           står; rutan bakom den här knappen säger vad man gör
           härnäst och varför, och har varje steg som en knapp på
           samma ställe. Fyra knappar på en rad i en tabell är fyra
           saker att välja mellan utan att veta vilken som är rätt. */
        + ' <button class="btn btn-ghost btn-sm" data-ans-spar="' + a.id + '">Rekryteringen</button>'
        + ' <button class="btn btn-ghost btn-sm" data-ans-pool="' + a.id + '">Ta in i poolen</button>' }
    ], rader, tomtText(sök || st, 'Ingen ansökan matchar filtret', 'Inga ansökningar än'));

    ritaStegflikar();
  }

  /* ============================================================
     INTERVJU OCH UTBILDNING (Fas 6)

     Rekryteringens två steg som egna flikar: vem som väntar på en
     intervju, och vem som intervjuats men inte utbildats. Samma
     stegknappar som i listan, så att man kan bocka av direkt här.
     Avböjda och godkända ligger bara under Alla.
     ============================================================ */
  function ritaStegflikar() {
    const aktiva = S.ansokningar.filter(a => a.status !== 'rejected' && a.status !== 'approved');
    const tillIntervju = aktiva.filter(a => !a.intervju_at)
      .sort((a, b) => String(a.kontaktad_at || a.created_at).localeCompare(String(b.kontaktad_at || b.created_at)));
    const tillUtbildning = aktiva.filter(a => a.intervju_at && !a.utbildad_at)
      .sort((a, b) => String(a.intervju_at).localeCompare(String(b.intervju_at)));

    const namn = a => '<b>' + esc(a.name) + '</b><span class="adm-und">' + esc(a.email)
      + (a.age ? ' · ' + a.age + ' år' : '') + '</span>';
    const väntat = (tid, ord) => tid
      ? '<span class="adm-tal">' + esc(kortDatum(tid)) + '</span><span class="adm-und">' + esc(ord) + '</span>'
      : '<span class="adm-und">Inte kontaktad än</span>';

    const intervju = $('#ans-intervju');
    if (intervju) {
      $('#ans-intervju-antal').textContent = tillIntervju.length ? tillIntervju.length + ' st' : '';
      intervju.innerHTML = tabell([
        { namn: 'Namn', rita: namn },
        { namn: 'Kontaktad', rita: a => väntat(a.kontaktad_at, 'kontaktad') },
        { namn: 'Kan jobba', rita: a => esc(a.availability || '—') },
        { namn: 'Steg', rita: a => '<div class="adm-spar">'
          + steg('Kontakt', a.kontaktad_at, 'data-ans-kontakt="' + esc(a.id) + '"')
          + steg('Intervju', a.intervju_at, 'data-ans-steg="intervju:' + esc(a.id) + '"')
          + '</div>' }
      ], tillIntervju, 'Ingen väntar på en intervju');
    }

    const utbildning = $('#ans-utbildning');
    if (utbildning) {
      $('#ans-utbildning-antal').textContent = tillUtbildning.length ? tillUtbildning.length + ' st' : '';
      utbildning.innerHTML = tabell([
        { namn: 'Namn', rita: namn },
        { namn: 'Intervjuad', rita: a => väntat(a.intervju_at, 'intervjuad') },
        { namn: 'Ämnen', rita: a => esc(a.subjects || '—') },
        { namn: 'Steg', rita: a => '<div class="adm-spar">'
          + steg('Utbildad', a.utbildad_at, 'data-ans-steg="utbildad:' + esc(a.id) + '"')
          + '</div>' },
        { namn: '', höger: true, rita: a =>
          '<button class="btn btn-ghost btn-sm" data-ans-pool="' + a.id + '">Ta in i poolen</button>' }
      ], tillUtbildning, 'Ingen väntar på utbildning');
    }
  }

  /* Ett steg i rekryteringsspåret. Gjort = datumet; ogjort = en
     knapp som gör det. Samma element i båda lägena, så raden inte
     hoppar när något klickas. */
  function steg(namn, tid, attr) {
    return '<button type="button" class="adm-steg' + (tid ? ' ar-gjord' : '') + '" '
      + attr + ' title="' + esc(namn) + (tid ? ' ' + kortDatum(tid) : ' — inte gjort') + '">'
      + '<i></i>' + esc(namn)
      + (tid ? '<em>' + esc(kortDatum(tid)) + '</em>' : '')
      + '</button>';
  }

  /* Mallarna. Skrivna för att kunna skickas som de är, men de är
     utkast: rutan är redigerbar just för att ingen familj ska få ett
     mejl som låter som ett formulär. */
  function mallIntervju(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Tack för din ansökan till Nextrum. Vi har läst den och skulle gärna '
      + 'prata med dig en kvart om hur du tänker kring att hjälpa andra att plugga.\n\n'
      + 'Passar någon av de här tiderna?\n'
      + '  · \n  · \n  · \n\n'
      + 'Det är ett samtal, inget prov. Vi vill veta hur du förklarar saker och '
      + 'vilka ämnen du känner dig trygg i.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* Mötestiden har ingen mall längre. Sedan Fas 16.1 mejlar
     databasen tid och länk själv när mötet sparas, och ett utkast i
     samma stund hade blivit samma besked två gånger. */

  function mallUtbildning(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Innan ditt första pass vill vi att du går igenom vår introduktion. Den tar en '
      + 'stund och går igenom hur ett pass läggs upp och hur rapporten efteråt fungerar.\n\n'
      + 'Här är den:\n' + String(CFG.UTBILDNING_URL || '').trim() + '\n\n'
      + 'Rapporten är viktigare än den låter: ett pass räknas som genomfört först när '
      + 'rapporten finns, och det är den som gör att familjen faktureras och att du får '
      + 'betalt. Hör av dig om något är oklart.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* ---- kontakta en sökande för intervju ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-kontakt]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansKontakt);
    if (!a) return;

    kontaktaRuta({
      titel: 'Kalla ' + (a.name || a.email || '') + ' till intervju',
      namn: a.name, till: a.email,
      amne: 'Din ansökan till Nextrum',
      text: mallIntervju(a),
      efterat: async () => {
        const nu = new Date().toISOString();
        await supa.from('applications')
          .update({ kontaktad_at: nu, status: a.status === 'new' ? 'contacted' : a.status })
          .eq('id', a.id);
        a.kontaktad_at = nu;
        if (a.status === 'new') a.status = 'contacted';
        ritaOm();
      }
    });
  });

  /* ---- stegen i rekryteringen ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-steg]');
    if (!knapp) return;
    const [steg, id] = knapp.dataset.ansSteg.split(':');
    const a = S.ansokningar.find(x => x.id === id);
    if (!a) return;

    const kolumn = steg === 'intervju' ? 'intervju_at' : 'utbildad_at';
    const nu = a[kolumn] ? null : new Date().toISOString();

    await medan(knapp, '…', async () => {
      const { error } = await supa.from('applications')
        .update({ [kolumn]: nu }).eq('id', id);
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      a[kolumn] = nu;
      await hämtaBesked(id);
      ritaOm();
    });
  });

  /* ============================================================
     BESKEDEN TILL DEN SOM SÖKER (Fas 16.1)

     Databasen mejlar den sökande själv vid varje steg framåt:
     kvittot när ansökan kommer in, tid och länk när mötet bokas, ett
     tack när mötet är hållet, en uppmaning att skapa konto när
     introduktionen är klar och en välkomst vid Godkänd. Varje mejl
     visar hela processen och var hen står. Ett nej mejlas aldrig av
     sig självt — det skriver en människa.

     Här visas utfallet, vid det steg som skickade mejlet. Ett mejl
     som inte gick fram ser annars likadant ut som ett som gick:
     ingenting händer i rutan, och den sökande väntar på ett besked
     som aldrig kommer.
     ============================================================ */
  const BESKED = {
    mottagen: 'Kvittot på ansökan',
    mote: 'Mötestiden',
    utbildning: 'Tack för mötet',
    sista_steget: 'Skapa ditt konto',
    valkommen: 'Välkomstmejlet'
  };

  /* Omförsöken ger upp efter tredje försöket eller efter ett dygn
     (intern.ansokan_besked_igen). Därefter är det en människas tur. */
  const DYGN = 24 * 3600 * 1000;

  function besked(a, steg) {
    const rad = (S.ansokanUtskick[a.id] || []).find(r => r.steg === steg);
    if (!rad) return '';
    const uppgett = rad.forsok >= 3 || Date.now() - new Date(rad.skapad).getTime() > DYGN;
    const läge = {
      skickad: '✓ mejlat ' + kortDatum(rad.uppdaterad),
      vantar: uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      skickar: uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      fel: 'gick inte fram' + (rad.fel ? ' (' + rad.fel + ')' : '')
        + (uppgett ? '. Försöker inte igen — skriv själv.' : '. Försöker igen om en stund.'),
      bromsad: 'skickades inte' + (rad.fel ? ': ' + rad.fel : ''),
      hoppad: 'skickades inte, beskedet hann bli inaktuellt'
    }[rad.status] || rad.status;
    const fel = rad.status === 'fel' || (uppgett && rad.status !== 'skickad'
      && rad.status !== 'bromsad' && rad.status !== 'hoppad');
    return '<div class="ans-steg-fakta' + (fel ? ' ar-fel' : '') + '"><b>' + esc(BESKED[steg])
      + ':</b> ' + esc(läge) + '</div>';
  }

  /* Raden skrivs av triggern i samma transaktion som ändringen, så
     den finns redan när svaret kommit. Utan en ny hämtning hade rutan
     visat det gamla läget tills hela vyn hämtats om. */
  async function hämtaBesked(id) {
    const { data, error } = await supa.from('ansokan_utskick')
      .select('ansokan_id, steg, status, forsok, fel, skapad, uppdaterad')
      .eq('ansokan_id', id).order('skapad', { ascending: false });
    if (!error) S.ansokanUtskick[id] = data || [];
  }

  /* ============================================================
     REKRYTERINGSRUTAN (Fas 13.1)

     Stegen fanns redan som stämplar i listan, men bara som fyra
     prickar: de sa VAD som var gjort, aldrig vad som görs härnäst
     eller varför steget finns. Den som inte rekryterat förut fick
     gissa, och den som gissade hoppade över utbildningen — vilket
     är precis det steg som kostar mest längre fram, eftersom en
     studiehjälpare utan introduktion inte skriver rapporter och ett
     pass utan rapport aldrig blir genomfört.

     Rutan är därför inte en meny. Den är ordningen, med skälet till
     varje steg skrivet bredvid knappen som utför det.

     Den bokar inte i någon kalender. Google Workspace är inte
     kopplat (se INTEGRATIONER.md), och en knapp som ser ut att boka
     men bara skriver i vår egen databas är värre än en som säger vad
     den gör: den sparar tiden och länken här, och databasen mejlar
     dem till den sökande (Fas 16.1).
     ============================================================ */

  /* Den öppna rutan, om någon är öppen. Stegknapparna nedan ritar om
     listan — utan den här ritas rutan inte om, och en stämpel man
     precis satt syns först när man stängt och öppnat igen. */
  let öppenSpår = null;

  function ritaOm() {
    ritaAnsokningar();
    if (öppenSpår) {
      const a = S.ansokningar.find(x => x.id === öppenSpår.id);
      if (a) öppenSpår.rita(a); else stängSpår();
    }
  }

  function stängSpår() {
    if (!öppenSpår) return;
    öppenSpår.ruta.remove();
    öppenSpår = null;
    document.body.style.overflow = '';
  }

  function mötesText(a) {
    if (!a.mote_tid) return null;
    const d = new Date(a.mote_tid);
    return d.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit' });
  }

  /* Ett steg i rutan: nummer, namn, skälet, stämpeln och knapparna.
     Skälet står kvar när steget är gjort — den som kommer tillbaka
     om ett halvår ska slippa lista ut varför det gjordes. */
  function spårSteg(nr, namn, varför, tid, knappar, extra) {
    return '<div class="ans-steg' + (tid ? ' ar-gjord' : '') + '">'
      + '<div class="ans-steg-nr">' + nr + '</div>'
      + '<div class="ans-steg-kropp">'
      + '<h4>' + esc(namn)
      + (tid ? '<span class="ans-steg-tid">✓ ' + esc(kortDatum(tid)) + '</span>' : '')
      + '</h4>'
      + '<p>' + esc(varför) + '</p>'
      + (extra || '')
      + '<div class="ans-steg-knappar">' + knappar + '</div>'
      + '</div></div>';
  }

  function spårInnehåll(a) {
    const id = esc(a.id);
    const möte = mötesText(a);
    const utbLänk = String(CFG.UTBILDNING_URL || '').trim();

    return '<h3 id="as-t">Rekryteringen — ' + esc(a.name || 'ansökan') + '</h3>'
      + '<p>' + esc(a.email)
      + (a.school ? ' · ' + esc(a.school) : '')
      + (a.age ? ' · ' + a.age + ' år' : '')
      + (a.subjects ? ' · ' + esc(a.subjects) : '') + '</p>'

      + '<div class="ans-spar-lista">'

      + spårSteg(1, 'Kontakt',
          'Kvittot på ansökan har redan gått av sig självt. Här föreslår du tider för mötet: '
          + 'utkastet öppnas i ditt mejlprogram med din adress som avsändare, så att svaret '
          + 'kommer till dig.',
          a.kontaktad_at,
          '<button type="button" class="btn btn-ghost btn-sm" data-ans-kontakt="' + id + '">'
          + (a.kontaktad_at ? 'Skriv igen' : 'Skriv till hen') + '</button>',
          besked(a, 'mottagen'))

      + spårSteg(2, 'Digitalt möte',
          'En kvart över video. Det är ett samtal, inget prov — vi vill höra hur hen '
          + 'förklarar saker och vilka ämnen hen är trygg i. Tiden och länken mejlas till hen '
          + 'när du sparar dem, och igen om du ändrar dem. "Mötet är hållet" mejlar ett tack '
          + 'och säger att introduktionen är nästa steg.',
          a.intervju_at,
          '<button type="button" class="btn btn-ghost btn-sm" data-ans-mote="' + id + '">'
          + (a.mote_tid ? 'Ändra mötet' : 'Boka möte') + '</button>'
          + ' <button type="button" class="btn btn-ghost btn-sm" data-ans-steg="intervju:' + id + '">'
          + (a.intervju_at ? 'Ångra "mötet är hållet"' : 'Mötet är hållet') + '</button>',
          (möte
            ? '<div class="ans-steg-fakta"><b>Bokat:</b> ' + esc(möte)
              + (a.mote_lank ? '<br><b>Länk:</b> ' + esc(a.mote_lank) : '') + '</div>'
            : '')
          + besked(a, 'mote') + besked(a, 'utbildning'))

      + spårSteg(3, 'Utbildning',
          'Introduktionen och provet. Det här steget är inte en artighet: en studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och utan rapport blir '
          + 'passet aldrig genomfört — varken fakturerat eller utbetalt. "Markera utbildad" '
          + 'mejlar hen och ber hen skapa ett konto med samma e-postadress.',
          a.utbildad_at,
          (utbLänk
            ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-utb="' + id + '">'
              + 'Skicka utbildningen</button> '
            : '')
          + '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbildad:' + id + '">'
          + (a.utbildad_at ? 'Ångra "utbildad"' : 'Markera utbildad') + '</button>',
          (utbLänk
            ? '<div class="ans-steg-fakta"><b>Länk:</b> ' + esc(utbLänk) + '</div>'
            /* Ingen länk satt. Knappen ritas inte alls — en knapp som
               mejlar en tom rad ser ut att fungera och gör det inte.
               Var den sätts står här, för den som läser det här är
               den som ska sätta den. */
            : '<div class="ans-steg-fakta">Ingen utbildningslänk är satt. '
              + 'Lägg den i <code>UTBILDNING_URL</code> i nextrum-config.js, '
              + 'så går den att skicka härifrån.</div>')
          + besked(a, 'sista_steget'))

      + spårSteg(4, 'In i poolen',
          'Profilen blir godkänd och dyker upp i matchningen, och hen får ett välkomstmejl. '
          + 'Den sökande måste ha ett konto på nextrum.se först — annars finns ingen profil '
          + 'att godkänna.',
          a.status === 'approved' ? (a.utbildad_at || a.created_at) : null,
          '<button type="button" class="btn btn-primary btn-sm" data-ans-pool="' + id + '">'
          + 'Ta in i poolen</button>',
          besked(a, 'valkommen'))

      + '</div>'
      /* Det enda steget utan eget mejl, och det enda som inte står i
         listan ovan. Därför här, där den som ska säga nej läser. */
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Ett nej mejlas aldrig automatiskt. Sätts läget till Avböjd går ingenting ut, '
      + 'så det mejlet skriver du själv.'
      + (S.ansokanUtskickFel
        ? ' Mejlstatusen gick inte att läsa: ' + esc(S.ansokanUtskickFel) + '.'
        : '')
      + '</p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-as-stang>Stäng</button>'
      + '</div>';
  }

  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-spar]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansSpar);
    if (!a) return;

    stängSpår();
    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    const rita = rad => {
      ruta.innerHTML = '<div class="nx-fraga-box nx-fraga-bred" role="dialog" '
        + 'aria-modal="true" aria-labelledby="as-t">' + spårInnehåll(rad) + '</div>';
    };
    rita(a);
    visaRuta(ruta);
    öppenSpår = { id: a.id, ruta: ruta, rita: rita };

    /* Bara ridån och Stäng stänger rutan. Stegknapparna sitter inne i
       den och hanteras av sina egna lyssnare på document — stängde
       rutan på varje klick försvann den under fingret varje gång man
       bockade av ett steg. */
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-as-stang]')) stängSpår();
    });
  });

  /* ---- boka det digitala mötet ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-mote]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansMote);
    if (!a) return;

    /* Förvalen: datum och tid delade, för en datetime-local som är
       tom kräver att man klickar sig genom båda ändå, och en
       förvald tid som är "nu" ser ut som en riktig bokning. */
    const d = a.mote_tid ? new Date(a.mote_tid) : null;
    const hhmm = x => String(x.getHours()).padStart(2, '0') + ':'
      + String(x.getMinutes()).padStart(2, '0');

    const svar = await fråga({
      titel: 'Boka digitalt möte med ' + (a.name || 'den sökande'),
      text: 'Tiden och länken sparas på ansökan och mejlas till den sökande direkt. Ändrar du '
        + 'dem senare går ett nytt mejl med den nya tiden. Ingen kalender bokas — Google '
        + 'Workspace är inte kopplat.',
      innehåll: '<div class="ag-faltrad">'
        + '<div class="fgroup"><label for="mo-datum">Datum</label>'
        + '<input class="inp" id="mo-datum" type="date" value="'
        + (d ? esc(isoFor(d)) : '') + '"></div>'
        + '<div class="fgroup"><label for="mo-tid">Tid</label>'
        + '<input class="inp" id="mo-tid" type="time" value="'
        + (d ? esc(hhmm(d)) : '17:00') + '"></div>'
        + '</div>'
        + '<div class="fgroup" style="margin-top:12px"><label for="mo-lank">Möteslänk</label>'
        + '<input class="inp" id="mo-lank" placeholder="https://meet.google.com/…" value="'
        + esc(a.mote_lank || '') + '"></div>',
      knapp: 'Spara och mejla',
      läs: r => {
        const datum = $('#mo-datum', r).value;
        const tid = $('#mo-tid', r).value;
        if (!datum) return { fel: 'Välj ett datum.' };
        if (!tid) return { fel: 'Välj en tid.' };
        /* Ett möte som redan varit mejlas inte (triggern hoppar över
           det), och en bokning som tyst inte blir något mejl är värre
           än ett nej här. */
        if (new Date(datum + 'T' + tid).getTime() <= Date.now()) {
          return { fel: 'Tiden har redan varit. Är mötet hållet: klicka "Mötet är hållet" i stället.' };
        }
        const länk = möteslänk($('#mo-lank', r).value);
        if (länk === false) {
          return { fel: 'Länken ska vara en vanlig webbadress, till exempel https://meet.google.com/abc-defg-hij.' };
        }
        return { värde: { datum: datum, tid: tid, länk: länk } };
      }
    });
    if (!svar) return;

    /* new Date('2026-09-24T17:00') utan Z tolkas i webbläsarens egen
       tidszon, alltså i den tid admin faktiskt skrev. Med Z hade
       ett möte klockan 17 blivit 19 på sommaren. */
    const när = new Date(svar.datum + 'T' + svar.tid);
    const { error } = await supa.from('applications')
      .update({ mote_tid: när.toISOString(), mote_lank: svar.länk })
      .eq('id', a.id);
    if (error) { alert('Kunde inte spara mötet: ' + felText(error)); return; }
    a.mote_tid = när.toISOString();
    a.mote_lank = svar.länk;
    await hämtaBesked(a.id);
    ritaOm();
  });

  /* Möteslänken som den ska sparas: null om fältet är tomt, false om
     den inte går att använda.

     Mejlet gör bara en https-adress till en knapp (sakerLank() i
     _delad/notiser/ansokan.ts). "meet.google.com/abc" utan schema
     hade alltså gett ett mejl som säger att länken kommer senare,
     trots att admin skrev den. Därför får den sitt https:// här, och
     det mejlet ändå inte skulle visa nekas innan det sparas. */
  function möteslänk(värde) {
    let s = String(värde || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch (e) { return false; }
    if (u.protocol !== 'https:' || u.username || u.password
        || u.hostname.indexOf('.') < 0 || s.length > 500) return false;
    return u.href;
  }

  /* ---- skicka utbildningen ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-utb]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansUtb);
    if (!a) return;

    kontaktaRuta({
      titel: 'Skicka utbildningen till ' + (a.name || a.email || ''),
      namn: a.name, till: a.email,
      amne: 'Introduktionen inför ditt första pass',
      text: mallUtbildning(a)
    });
  });

  /* ============================================================
     FRÅN ANSÖKAN TILL POOL

     Poolen är `tutor_profiles` med status 'approved' — det är exakt
     det urvalet vyn matchningsunderlag lämnar ut, och alltså det
     matchningen kan välja ur.

     En ansökan i `applications` är inte en profil. Den kunde förut
     bara byta etikett i en lista, och "Godkänd" på en ansökan gjorde
     ingenting åt vem som gick att matcha. Poolen var därför alltid
     tom utom för dem som råkat fylla i sin profil själva.

     TIMPENNINGEN ÄR OBLIGATORISK HÄR

     Utan hourly_rate hoppar edge-funktionen fakturering över
     studiehjälparen helt när ersättningar räknas ut. Hen håller pass
     och får ingen utbetalning, och det upptäcks först när någon
     frågar var pengarna blev av. Bättre att kräva talet i samma
     stund som personen släpps in.
     ============================================================ */
  function tutorVal(valt) {
    /* Bara konton som INTE redan är i poolen. Att erbjuda en redan
       godkänd studiehjälpare i listan är att be om att någons ämnen
       skrivs över av en ansökan från en annan person. */
    const kandidater = Object.values(S.personer)
      .filter(p => p.role === 'tutor')
      .filter(p => (S.tutorProfiler[p.id] || {}).status !== 'approved')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));

    if (!kandidater.length) {
      return '<p class="xsmall" style="color:var(--acc-text);margin:0">'
        + 'Inga konton att koppla till. Den sökande måste registrera sig som '
        + 'studiehjälpare på nextrum.se först — sedan dyker hen upp här.</p>';
    }

    return '<select class="inp" id="ap-konto">'
      + '<option value="">Välj konto…</option>'
      + kandidater.map(t => '<option value="' + esc(t.id) + '"'
          + (t.id === valt ? ' selected' : '') + '>'
          + esc(t.full_name || t.email || t.id) + (t.email ? ' · ' + esc(t.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-pool]');
    if (!knapp) return;

    const ans = S.ansokningar.find(a => a.id === knapp.dataset.ansPool);
    if (!ans) return;

    /* Utbildningen är inte en artighet. En studiehjälpare som inte
       vet hur rapporten fungerar lämnar inga rapporter — och utan
       rapport blir passet aldrig genomfört, alltså aldrig fakturerat
       och aldrig utbetalt. Kedjan går isär i andra änden. */
    if (!ans.utbildad_at) {
      const ändå = await bekräfta({
        titel: 'Introduktionen är inte gjord',
        text: (ans.name || 'Den sökande') + ' är inte markerad som utbildad. En studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och då blir passen '
          + 'aldrig genomförda — varken fakturerade eller utbetalda. Markera Utbildad i spåret '
          + 'först, eller fortsätt om introduktionen är gjord ändå.',
        knapp: 'Ta in ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    const trolig = Object.values(S.personer).find(p =>
      p.role === 'tutor' && p.email
      && String(p.email).toLowerCase() === String(ans.email || '').toLowerCase());

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="ap-t">'
      + '<h3 id="ap-t">Ta in ' + esc(ans.name || 'den sökande') + ' i poolen</h3>'
      + '<p>Profilen blir godkänd och dyker upp i matchningen direkt, och hen får ett '
      + 'välkomstmejl. Uppgifterna nedan kommer från ansökan — ändra det som behöver ändras.</p>'
      + '<div class="fgroup"><label for="ap-konto">Konto</label>' + tutorVal(trolig && trolig.id) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="ap-amnen">Ämnen (kommaseparerat)</label>'
      + '<input class="inp" id="ap-amnen" value="' + esc(ans.subjects || '') + '"></div>'
      + '<div class="fgroup"><label for="ap-ort">Ort</label>'
      + '<input class="inp" id="ap-ort" value="Stockholm"></div>'
      + '<div class="fgroup"><label for="ap-timpenning">Timpenning, kronor</label>'
      + '<input class="inp" id="ap-timpenning" type="number" min="1" step="1" inputmode="numeric" placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Utan timpenning räknas ingen ersättning ut — passen hålls men utbetalningen uteblir.</p>'
      + '<p class="ok-msg" id="ap-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-ap-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="ap-godkann">Ta in i poolen</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-ap-stang]')) stäng();
    });

    $('#ap-godkann', ruta).addEventListener('click', async () => {
      const msg = $('#ap-msg', ruta);
      rensa(msg);
      const konto = $('#ap-konto', ruta) ? $('#ap-konto', ruta).value : '';
      const timpenning = Number($('#ap-timpenning', ruta).value);
      if (!konto) { säg(msg, 'Välj vilket konto ansökan hör till.', false); return; }
      if (!timpenning || timpenning < 1) { säg(msg, 'Fyll i timpenningen.', false); return; }

      await medan($('#ap-godkann', ruta), 'Tar in…', async () => {
        /* Ämnena lagras som en array. Fritexten från ansökan delas på
           komma; tomma bitar bort, annars blir "matte, " till två ämnen
           varav ett heter ingenting. */
        const ämnen = String($('#ap-amnen', ruta).value || '')
          .split(',').map(x => x.trim()).filter(Boolean);

        const { error } = await supa.from('tutor_profiles').update({
          status: 'approved',
          subjects: ämnen.length ? ämnen : null,
          city: $('#ap-ort', ruta).value.trim() || null,
          school: ans.school || null,
          age: ans.age || null,
          availability: ans.availability || null,
          hourly_rate: timpenning,
          tjanster: (ans.tjanster && ans.tjanster.length) ? ans.tjanster : [standardJobbtjanst()]
        }).eq('id', konto);

        if (error) { säg(msg, 'Kunde inte ta in: ' + felText(error), false); return; }

        await supa.from('applications').update({ status: 'approved' }).eq('id', ans.id);
        ans.status = 'approved';

        stäng();
        stängSpår();
        await hämtaAllt();
        ritaAnsokningar();
        ritaStudiehjalpare();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();
      });
    });
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaAnsokningar, steg
  });
})();
