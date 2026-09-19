/* ============================================================
   NEXTRUM — adminvyn, Drift: matchning, bokningar, kalender, lektioner

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

  const { BOK_LAGE, S, dagarSedan, elevNamn, hämtaMatchunderlag, kortDatum,
          läge, matchar, namnFör, pill, skriv, tabell, tomtText } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaElever = (...a) => NXAdmin.rita.ritaElever(...a);
  const ritaFamiljer = (...a) => NXAdmin.rita.ritaFamiljer(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const träffar = (...a) => NXAdmin.rita.träffar(...a);
  const utanRapport = (...a) => NXAdmin.rita.utanRapport(...a);

  /* ============================================================
     MATCHNING

     En elev, en studiehjälpare. Inte en familj och en
     studiehjälpare, vilket det var till schema-v14: två syskon
     som läser olika ämnen i olika årskurser ska inte behöva dela.

     RANKNINGEN RÄKNAS HÄR, INTE I SQL

     Det hade varit enklare att sortera i vyn. Men en ORDER BY
     lämnar ut en ordning, och det man behöver när en förälder
     frågar "varför just hen?" är skälen. Därför lämnar
     matchningsunderlag ut rådata, och varje poäng nedan bär med
     sig vad den kom ifrån.

     FYRA VIKTER, OCH VARFÖR JUST DE

       Ämne      50  Utan rätt ämne spelar resten ingen roll.
       Årskurs   30  En duktig gymnasiematematiker är fel person
                     för en femma, och tvärtom.
       Utrymme   12  Den som har fem elever bör inte få en sjätte
                     före den som har noll.
       Erfarenhet 8  Tie-break, inte mer. En ny studiehjälpare är
                     inte sämre, hen är bara oprövad — och att
                     vikta det tungt hade gjort nya omöjliga att
                     komma igång med.

     "VET EJ" ÄR INTE "NEJ"

     En elev utan angivna ämnen har inte fel ämne, vi vet bara
     inte. Sådana kriterier ger halva poängen och märks med ett
     frågetecken i stället för ett kryss. Att ge noll hade
     straffat en elev för att någon glömt fylla i ett fält.
     ============================================================ */

  const VIKT = { amne: 50, arskurs: 30, utrymme: 12, erfarenhet: 8 };

  /* Årskursen kommer in som fritext från två håll som aldrig
     pratat med varandra: elevens "Åk 8" eller "Gymnasiet år 2"
     från studievyns rullgardin, och studiehjälparens "Åk 7–9"
     eller "Gymnasiet" som aldrig skrivits av någon kod alls utan
     står handskrivet i databasen.

     Parsern läser därför siffror och ordet gymnasiet, och bryr
     sig inte om resten. Tankstreck och bindestreck är samma sak
     för den, vilket de inte är för en jämförelse av strängar. */
  function tolkaNiva(text) {
    const t = String(text || '').toLowerCase();
    const gym = t.indexOf('gymnas') !== -1;
    const siffror = (t.match(/\d+/g) || []).map(Number);
    if (gym) return { gym: true, från: siffror[0] || null, till: siffror[1] || siffror[0] || null };
    if (!siffror.length) return null;
    return { gym: false, från: siffror[0], till: siffror.length > 1 ? siffror[1] : siffror[0] };
  }

  function nivåTäcker(tutorNivåer, elevNivå) {
    const e = tolkaNiva(elevNivå);
    if (!e) return null;                     // vet ej
    const lista = (tutorNivåer || []).map(tolkaNiva).filter(Boolean);
    if (!lista.length) return null;          // vet ej
    return lista.some(n => {
      if (e.gym) return n.gym;
      if (n.gym) return false;
      return e.från >= n.från && e.från <= n.till;
    });
  }

  /* Ämnen jämförs normaliserat. "NO / Fysik / Kemi / Biologi" i
     bokningen och "Fysik" hos studiehjälparen ska räknas som en
     träff, så jämförelsen sker på delsträngar åt båda håll. */
  function normalisera(s) {
    return String(s || '').toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim();
  }

  function ämnenSomMöts(elevÄmnen, tutorÄmnen) {
    const e = (elevÄmnen || []).map(normalisera).filter(Boolean);
    const t = (tutorÄmnen || []).map(normalisera).filter(Boolean);
    if (!e.length || !t.length) return null;   // vet ej
    const träffar = e.filter(x => t.some(y => y.indexOf(x) !== -1 || x.indexOf(y) !== -1));
    return { träffar, andel: träffar.length / e.length };
  }

  function poängFör(elev, tutor) {
    const skäl = [];
    let poäng = 0;

    const ä = ämnenSomMöts(elev.subjects, tutor.amnen);
    if (ä === null) {
      poäng += VIKT.amne / 2;
      skäl.push(['vet-ej', elev.subjects && elev.subjects.length
        ? 'Studiehjälparen har inga ämnen angivna'
        : 'Eleven har inga ämnen angivna']);
    } else if (ä.träffar.length) {
      poäng += VIKT.amne * ä.andel;
      skäl.push([ä.andel === 1 ? 'ja' : 'ja',
        ä.andel === 1 ? 'Täcker alla elevens ämnen'
          : 'Täcker ' + ä.träffar.length + ' av ' + (elev.subjects || []).length + ' ämnen']);
    } else {
      skäl.push(['nej', 'Inget gemensamt ämne']);
    }

    const n = nivåTäcker(tutor.arskurser, elev.grade);
    if (n === null) {
      poäng += VIKT.arskurs / 2;
      skäl.push(['vet-ej', elev.grade ? 'Studiehjälparen har inga årskurser angivna' : 'Eleven saknar årskurs']);
    } else if (n) {
      poäng += VIKT.arskurs;
      skäl.push(['ja', 'Undervisar ' + elev.grade]);
    } else {
      skäl.push(['nej', 'Undervisar inte ' + elev.grade]);
    }

    /* Full poäng vid noll elever, ingen vid fem. Taket är satt
       efter vad en gymnasieelev hinner vid sidan av skolan, inte
       efter vad som ser bra ut i en graf. */
    const antal = Number(tutor.antal_elever || 0);
    const utrymme = Math.max(0, 1 - antal / 5);
    poäng += VIKT.utrymme * utrymme;
    skäl.push([antal < 3 ? 'ja' : 'nej',
      antal === 0 ? 'Har inga elever än'
        : antal + (antal === 1 ? ' elev sedan tidigare' : ' elever sedan tidigare')]);

    const pass = Number(tutor.genomforda_pass || 0);
    poäng += VIKT.erfarenhet * Math.min(1, pass / 10);
    if (pass) skäl.push(['ja', pass + (pass === 1 ? ' genomfört pass' : ' genomförda pass')]);
    else skäl.push(['vet-ej', 'Inga genomförda pass än']);

    /* TAKET VID ETT HÅRT NEJ

       Utan det här hände följande med riktig data: en
       studiehjälpare som täckte båda ämnena men INTE elevens
       årskurs hamnade över en som täckte årskursen och halva
       ämnena. Två poängs skillnad, och fel person överst.

       Ämne och årskurs är inte gradvisa kriterier som väger mot
       varandra. Fel årskurs är fel person, hur många pass hen än
       har kört. Ett nej på något av dem kapar därför poängen
       under 50, så att den aldrig kan gå om någon utan hårt nej.

       Skälen står kvar oavsett — man ska kunna se att hen ändå
       kan matteämnena, och överrida om man vet något systemet
       inte vet. */
    const hårtNej = skäl.some(x => x[0] === 'nej'
      && (x[1].indexOf('ämne') !== -1 || x[1].indexOf('Undervisar inte') !== -1));
    if (hårtNej) poäng = Math.min(poäng, 49);

    return { poäng: Math.round(poäng), skäl, hårtNej };
  }

  function skälIkon(sort) {
    if (sort === 'ja') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
    if (sort === 'nej') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 9a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.8M12 17h.01"/></svg>';
  }

  /* ------------------------------------------------------------
     KÖN
     ------------------------------------------------------------ */
  function elevMatchad(e) {
    return !!(e.matched_tutor_id && e.match_status === 'matched');
  }

  function ritaMatchKö() {
    const host = $('#mt-ko');
    if (!host) return;
    const sök = ($('#mt-sok') || {}).value ? $('#mt-sok').value.trim().toLowerCase() : '';

    /* Omatchade först. Det är dem man är här för, och att sortera
       dem sist hade betytt att man scrollar förbi tio matchade
       elever varje gång man ska göra det man kom för. */
    const alla = S.elevlista.slice().sort((a, b) => {
      const am = elevMatchad(a), bm = elevMatchad(b);
      if (am !== bm) return am ? 1 : -1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'sv');
    }).filter(e => {
      if (!sök) return true;
      const f = S.personer[e.parent_id];
      return [e.name, e.grade, f && f.full_name].filter(Boolean)
        .join(' ').toLowerCase().indexOf(sök) !== -1;
    });

    const omatchade = S.elevlista.filter(e => !elevMatchad(e)).length;
    $('#mt-ko-antal').textContent = omatchade
      ? omatchade + (omatchade === 1 ? ' väntar' : ' väntar')
      : 'alla matchade';

    if (!alla.length) {
      host.innerHTML = tomt(sök ? 'Ingen elev matchar' : 'Inga elever inlagda än',
        sök ? '' : 'Elever läggs till av familjen i studievyn.');
      return;
    }

    host.innerHTML = '<div class="mt-ko">' + alla.map(e => {
      const f = S.personer[e.parent_id];
      const m = elevMatchad(e);
      return '<button class="mt-elev" type="button" data-mt-elev="' + esc(e.id) + '"'
        + ' aria-pressed="' + (S.valdElev === e.id ? 'true' : 'false') + '">'
        + '<span class="mt-elev-prick' + (m ? ' ar-matchad' : '') + '" aria-hidden="true"></span>'
        + '<span class="mt-elev-text"><b>' + esc(e.name || '(namn saknas)') + '</b>'
        + '<span>' + esc([e.grade, f && (f.full_name || f.email)].filter(Boolean).join(' · ')
          || 'Årskurs saknas') + '</span></span>'
        + '</button>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     FÖRSLAGEN
     ------------------------------------------------------------ */
  function ritaMatchPanel() {
    const host = $('#mt-panel');
    if (!host) return;

    const elev = S.elevlista.find(e => e.id === S.valdElev);
    if (!elev) {
      $('#mt-forslag-antal').textContent = '';
      host.innerHTML = tomt('Välj en elev',
        S.elevlista.length ? 'Listan till vänster. Omatchade står överst.'
          : 'Det finns inga elever att matcha än.');
      return;
    }

    /* Vyn matchningsunderlag ligger i schema-v14. Är den inte
       körd säger vi det med filnamnet, i stället för att visa en
       tom lista som läser som "ingen passar". */
    if (S.matchunderlagFel) {
      host.innerHTML = '<div class="empty"><b>Matchningsunderlaget saknas</b><br>'
        + '<span>Vyn <code>matchningsunderlag</code> finns inte i databasen än. Kör '
        + '<code>schema-v14.sql</code> i Supabase → SQL Editor, så fylls den här sidan.</span></div>';
      return;
    }

    const f = S.personer[elev.parent_id];
    const nuvarande = elev.matched_tutor_id;

    const förslag = S.matchunderlag
      .map(t => Object.assign({ tutor: t }, poängFör(elev, t)))
      .sort((a, b) => {
        /* Den nuvarande studiehjälparen ligger alltid först,
           oavsett poäng. Man är här för att se hur den valda
           ligger till, inte för att leta rätt på den. */
        if (a.tutor.tutor_id === nuvarande) return -1;
        if (b.tutor.tutor_id === nuvarande) return 1;
        return b.poäng - a.poäng;
      });

    $('#mt-forslag-antal').textContent = förslag.length
      ? förslag.length + ' godkända' : '';

    const fakta = [];
    if (elev.grade) fakta.push(['', elev.grade]);
    else fakta.push(['ar-tom', 'Årskurs saknas']);
    if (elev.subjects && elev.subjects.length) {
      elev.subjects.forEach(a => fakta.push(['', a]));
    } else {
      fakta.push(['ar-tom', 'Inga ämnen angivna']);
    }
    if (elev.school) fakta.push(['', elev.school]);

    let ut = '<div class="mt-vald">'
      + M.avatar(elev.name || '?', null, {})
      + '<span class="mt-vald-text"><b>' + esc(elev.name || '(namn saknas)') + '</b>'
      + '<span class="xsmall" style="color:var(--bl-2)">Familj: '
      + esc(f ? (f.full_name || f.email || '—') : 'okänd') + '</span>'
      + '<span class="mt-vald-fakta">'
      + fakta.map(x => '<span class="mt-fakta ' + x[0] + '">' + esc(x[1]) + '</span>').join('')
      + '</span></span>'
      + (nuvarande
        ? '<button class="btn btn-ghost btn-sm" type="button" data-mt-loss="' + esc(elev.id) + '">Ta bort matchningen</button>'
        : '')
      + '</div>';

    if (!förslag.length) {
      host.innerHTML = ut + tomt('Inga godkända studiehjälpare',
        'Godkänn någon under Studiehjälpare, så dyker de upp här.');
      return;
    }

    ut += '<div class="mt-forslag">' + förslag.map(x => {
      const t = x.tutor;
      const är = t.tutor_id === nuvarande;
      return '<div class="mt-kort' + (är ? ' ar-nuvarande' : '') + '">'
        + '<div class="mt-kort-topp">'
        + M.avatar(t.namn || '?', null, { liten: true })
        + '<span class="mt-kort-namn"><b>' + esc(t.namn || '—') + '</b>'
        + '<span>' + esc([t.ort, (t.amnen || []).join(', ')].filter(Boolean).join(' · ') || 'Inga ämnen angivna') + '</span></span>'
        + '<span class="mt-poang"><b>' + x.poäng + '%</b>'
        + '<span>' + (x.hårtNej ? 'Passar illa' : 'Passar') + '</span>'
        + '<span class="mt-stapel' + (x.hårtNej ? ' ar-svag' : '') + '">'
        + '<i style="width:' + Math.max(3, x.poäng) + '%"></i></span></span>'
        + '</div>'
        + '<div class="mt-skal">' + x.skäl.map(s =>
          '<span class="ar-' + s[0] + '">' + skälIkon(s[0]) + esc(s[1]) + '</span>').join('') + '</div>'
        + '<div class="mt-kort-fot">'
        + (är
          ? '<span class="mt-nuvarande-marke">Nuvarande</span>'
          /* Den som passar illa får en dämpad knapp, inte en
             saknad. Ibland vet den som sitter här något systemet
             inte vet — familjen känner personen, eller ämnet står
             fel i profilen. Men den ska inte se ut som ett
             självklart val bredvid en som passar. */
          : '<button class="btn btn-sm ' + (x.hårtNej ? 'btn-ghost' : 'btn-primary')
            + '" type="button" data-mt-valj="' + esc(t.tutor_id) + '">Matcha '
            + esc(förnamn(t.namn)) + '</button>')
        + (t.timpris ? '<span class="xsmall">' + esc(NX.kr(t.timpris)) + '/tim</span>' : '')
        + '</div></div>';
    }).join('') + '</div>';

    host.innerHTML = ut;
  }

  function förnamn(namn) {
    return String(namn || '').trim().split(/\s+/)[0] || 'hen';
  }

  /* ------------------------------------------------------------
     HANDLINGARNA
     ------------------------------------------------------------ */
  async function sättMatchning(elevId, tutorId) {
    const elev = S.elevlista.find(e => e.id === elevId);
    if (!elev) return;

    const ok = await skriv('students', elevId, {
      matched_tutor_id: tutorId,
      match_status: tutorId ? 'matched' : 'pending'
    });
    if (!ok) return;

    elev.matched_tutor_id = tutorId;
    elev.match_status = tutorId ? 'matched' : 'pending';

    /* Triggern synka_familjens_match har just skrivit om
       förälderns rad i databasen. Kartan i minnet vet inte om
       det, och familjelistan läser den — alltså räknas samma
       sak om här, med samma regel som triggern. */
    const syskon = S.elevlista.filter(e => e.parent_id === elev.parent_id);
    const först = syskon.filter(elevMatchad)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const f = S.personer[elev.parent_id];
    if (f) {
      f.matched_tutor_id = först ? först.matched_tutor_id : null;
      f.match_status = först ? 'matched' : 'pending';
    }

    await hämtaMatchunderlag();
    ritaMatchKö();
    ritaMatchPanel();
    ritaElever();
    ritaFamiljer();
    ritaStudiehjalpare();
    await ritaÖversikt();
  }

  document.addEventListener('click', async e => {
    const välj = e.target.closest('[data-mt-elev]');
    if (välj) {
      S.valdElev = välj.dataset.mtElev;
      ritaMatchKö();
      ritaMatchPanel();
      return;
    }

    const matcha = e.target.closest('[data-mt-valj]');
    if (matcha) {
      const elev = S.elevlista.find(x => x.id === S.valdElev);
      const t = S.matchunderlag.find(x => x.tutor_id === matcha.dataset.mtValj);
      if (!elev || !t) return;
      const ja = await bekräfta({
        titel: 'Matcha ' + (elev.name || 'eleven') + ' med ' + (t.namn || 'studiehjälparen') + '?',
        text: 'De får se varandras uppgifter och kan börja boka pass och skriva till varandra.'
          + (elev.matched_tutor_id ? ' Den nuvarande matchningen ersätts.' : '')
          + ' Det går att ändra efteråt.',
        knapp: 'Matcha'
      });
      if (!ja) return;
      await sättMatchning(elev.id, t.tutor_id);
      return;
    }

    const loss = e.target.closest('[data-mt-loss]');
    if (loss) {
      const elev = S.elevlista.find(x => x.id === loss.dataset.mtLoss);
      if (!elev) return;
      const ja = await bekräfta({
        titel: 'Ta bort matchningen för ' + (elev.name || 'eleven') + '?',
        text: 'De slutar se varandras uppgifter. Bokade pass, läxor och rapporter ligger kvar '
          + 'i databasen men blir oåtkomliga för studiehjälparen.',
        knapp: 'Ta bort'
      });
      if (!ja) return;
      await sättMatchning(elev.id, null);
    }
  });

  const mtSök = $('#mt-sok');
  if (mtSök) mtSök.addEventListener('input', ritaMatchKö);

  function ritaMatchning() {
    ritaMatchKö();
    ritaMatchPanel();
  }

  /* ============================================================
     BOKNINGAR
     ============================================================ */

  function ritaBokningar() {
    const sök = $('#bok-sok').value.trim();
    const st = $('#bok-status').value;
    const när = $('#bok-nar').value;
    const idag = isoFor(new Date());

    const rader = S.bokningar
      .filter(b => !st || b.status === st)
      .filter(b => när === 'alla' || (när === 'framat' ? b.wanted_date >= idag : b.wanted_date < idag))
      .map(b => ({ ...b, familj: namnFör(b.parent_id), hjalpare: namnFör(b.tutor_id),
                   elev: elevNamn(b.student_id) || '' }))
      /* elev är med i söket sedan matchningen blev en elevfråga. Utan
         den gick ett pass inte att hitta på barnets namn, vilket är
         det man har när en familj ringer. */
      .filter(b => matchar(b, ['familj', 'elev', 'hjalpare', 'subject', 'format'], sök));

    $('#bok-antal').textContent = rader.length + ' av ' + S.bokningar.length;
    $('#bok-tabell').innerHTML = tabell([
      { namn: 'När', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(b.wanted_time ? String(b.wanted_time).slice(0, 5) : '')
        + ' · ' + ((b.duration_min || 60) / 60) + ' h</span>' },
      { namn: 'Elev', rita: b => b.elev
        ? '<b>' + esc(b.elev) + '</b><span class="adm-und">' + esc(b.familj) + '</span>'
        : esc(b.familj) + '<span class="adm-und">inget barn valt</span>' },
      { namn: 'Studiehjälpare', rita: b => esc(b.hjalpare) },
      { namn: 'Ämne', rita: b => esc(b.subject || '—')
        + (b.format ? '<span class="adm-und">' + esc(b.format) + '</span>' : '') },
      { namn: 'Läge', rita: b => läge(BOK_LAGE, b.status)
        + (b.attendance === 'franvarande' ? ' ' + pill('Uteblev', 'ar-ny') : '') },
      { namn: '', höger: true, rita: b => (b.status === 'requested' || b.status === 'confirmed')
        ? '<button class="btn btn-ghost btn-sm" data-avboka="' + b.id + '">Avboka</button>'
        : '' }
    ], rader, tomtText(sök || st, 'Ingen bokning matchar filtret', 'Inga bokningar än'));
  }


  /* ============================================================
     LEKTIONER

     En lektion är inget eget objekt i databasen, och ska inte bli
     det: ett genomfört pass PLUS dess rapport ÄR lektionen. En
     tredje tabell hade gett två sanningar om samma timme.

     Sektionen finns ändå, för den svarar på en annan fråga än
     Bokningar. Bokningar tittar framåt. Lektioner tittar bakåt:
     hände det, skrevs det en rapport, kan det faktureras.

     RAPPORTEN ÄR PENGAR

     Ett pass blir 'completed' när studiehjälparen skrivit
     rapporten, och bara completed-pass hamnar på fakturan. Ett
     hållet men orapporterat pass är alltså en timme ingen får
     betalt för — varken familjen faktureras eller studiehjälparen
     ersätts. Därför är "rapport saknas" sektionens första siffra
     och dess enda larm.
     ============================================================ */

  /* Pass som redan varit, oavsett om någon rapporterat dem.
     Avbokade räknas inte: de hände aldrig. */
  function hållnaPass() {
    const idag = isoFor(new Date());
    return S.bokningar.filter(b =>
      b.status !== 'cancelled' && String(b.wanted_date) < idag);
  }

  function ritaLektionstal() {
    const host = $('#lekt-tal');
    if (!host) return;
    const hållna = hållnaPass();
    const genomförda = hållna.filter(b => b.status === 'completed');
    const utanRapport = hållna.filter(b => b.status !== 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);

    /* Frånvaro räknas bara på pass där någon faktiskt fyllt i det.
       Ett tomt fält betyder "ingen sa något", inte "eleven kom". */
    const markerade = hållna.filter(b => b.attendance);
    const uteblev = markerade.filter(b => b.attendance === 'franvarande').length;

    host.innerHTML =
      '<div class="adm-kpi' + (utanRapport.length ? ' ar-larm' : '') + '">'
      + '<b>' + utanRapport.length + '</b><span>Rapport saknas</span>'
      + '<span class="adm-kpi-diff">' + (utanRapport.length
        ? 'faktureras inte förrän den skrivs' : 'allt hållet är rapporterat') + '</span></div>'
      + '<div class="adm-kpi"><b>' + genomförda.length + '</b><span>Genomförda pass</span>'
      + '<span class="adm-kpi-diff">totalt</span></div>'
      + '<div class="adm-kpi"><b>' + NXBetalning.timmar(minuter) + '</b><span>Undervisad tid</span>'
      + '<span class="adm-kpi-diff">i genomförda pass</span></div>'
      + '<div class="adm-kpi"><b>' + uteblev + '</b><span>Uteblivna</span>'
      + '<span class="adm-kpi-diff">' + (markerade.length
        ? 'av ' + markerade.length + ' markerade' : 'ingen har markerats') + '</span></div>';
  }

  function ritaLektioner() {
    ritaLektionstal();
    const host = $('#lekt-tabell');
    if (!host) return;

    const sök = $('#lekt-sok').value.trim().toLowerCase();
    const rapportFilter = $('#lekt-rapport').value;
    const dagar = $('#lekt-period').value;

    let alla = hållnaPass();
    if (dagar) {
      const från = dagarSedan(Number(dagar));
      alla = alla.filter(b => String(b.wanted_date) >= från);
    }
    alla.sort((a, b) => String(b.wanted_date + (b.wanted_time || ''))
      .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));

    const rader = alla
      .filter(b => {
        if (!rapportFilter) return true;
        const har = b.status === 'completed';
        return rapportFilter === 'finns' ? har : !har;
      })
      .filter(b => {
        if (!sök) return true;
        return [b.subject, b.format, elevNamn(b.student_id),
          namnFör(b.parent_id), namnFör(b.tutor_id)]
          .filter(Boolean).join(' ').toLowerCase().indexOf(sök) !== -1;
      });

    $('#lekt-antal').textContent = rader.length + ' av ' + alla.length;
    host.innerHTML = tabell([
      { namn: 'När', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc((b.wanted_time ? String(b.wanted_time).slice(0, 5) + ' · ' : '')
          + (b.duration_min || 60) + ' min') + '</span>' },
      { namn: 'Elev', rita: b => esc(elevNamn(b.student_id) || namnFör(b.parent_id))
        + '<span class="adm-und">' + esc(namnFör(b.parent_id)) + '</span>' },
      { namn: 'Studiehjälpare', rita: b => esc(namnFör(b.tutor_id)) },
      { namn: 'Ämne', rita: b => esc(b.subject || '—')
        + (b.format ? '<span class="adm-und">' + esc(b.format) + '</span>' : '') },
      { namn: 'Närvaro', rita: b => {
        if (b.attendance === 'franvarande') return pill('Uteblev', 'ar-ny');
        if (b.attendance === 'narvarande') return pill('Närvarade', 'ar-klar');
        return '<span style="color:var(--bl-2)">Ej markerad</span>';
      } },
      { namn: 'Rapport', höger: true, rita: b => {
        if (b.status === 'completed') {
          return pill('Skriven', 'ar-klar')
            + '<span class="adm-und lekt-fakturerad">Kan faktureras</span>';
        }
        /* Inte ett fel att laga härifrån: rapporten skrivs av
           studiehjälparen i hens egen vy. Adminvyn kan se att den
           saknas och påminna, inte skriva den. */
        return pill('Saknas', 'ar-ny')
          + '<span class="adm-und">Passet är ' + esc(BOK_LAGE[b.status] ? BOK_LAGE[b.status][0].toLowerCase() : b.status) + '</span>';
      } }
    /* Periodfiltret står på 30 dagar från början, så det räknas inte
       som ett filter användaren satt. Annars fick en tom databas
       beskedet "matchar filtret", vilket skickar folk att leta efter
       ett filter de aldrig rört. Finns det inga hållna pass alls är
       det den sanningen som ska stå. */
    ], rader, tomtText(hållnaPass().length && (sök || rapportFilter),
      'Ingen lektion matchar filtret',
      hållnaPass().length
        ? 'Inga pass i den här perioden'
        : 'Inga pass har hållits än'));
  }

  ['#lekt-sok', '#lekt-rapport', '#lekt-period'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', ritaLektioner);
  });


  /* ------------------------------------------------------------
     KALENDERN

     Ritas av NXStudie.schema — samma modul som studievyn och
     studiehjälparvyn använder. Månad, vecka, dag, samma färg per
     läge, samma chip.

     Att bygga en egen hade gett ledningen en kalender som ser ut
     som en annan produkt än den familjen ser, och två uppsättningar
     buggar att laga. Skillnaden här är bara etiketten på ett pass:
     familjen ser sitt barns namn, ledningen ser båda parterna.
     ------------------------------------------------------------ */
  function ritaKalender() {
    const host = $('#bok-kalender');
    if (!host) return;

    /* Avbokade är med. I familjens kalender är de brus, i
       ledningens är de en fråga: varför ställdes det in? */
    const namn = b => [elevNamn(b.student_id) || namnFör(b.parent_id), namnFör(b.tutor_id)]
      .filter(Boolean).join(' → ');

    if (S.kalender) { S.kalender.sättBokningar(S.bokningar); return; }
    S.kalender = NXStudie.schema({
      host: host,
      bokningar: S.bokningar,
      lage: 'manad',
      namn: namn,
      onOppna: b => {
        /* Listan är där man ändrar ett pass. Kalendern säger var
           det ligger och skickar vidare — två vyer som båda kan
           skriva vore två ställen att glömma uppdatera. */
        const f = S.flikar.bokningar;
        if (f) f.visa('lista');
        /* Tidsfiltret står på "framåt" som standard. Ett passerat
           pass hade alltså försvunnit i samma sekund man klickat på
           det i kalendern — filtret nollas därför här. */
        const när = $('#bok-nar');
        if (när) när.value = 'alla';
        const sök = $('#bok-sok');
        if (sök) sök.value = elevNamn(b.student_id) || namnFör(b.parent_id);
        ritaBokningar();
      }
    });
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaBokningar, ritaKalender, ritaLektioner, ritaMatchning
  });
})();
