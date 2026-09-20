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

  const { AVBOKNINGSSKAL, BOK_LAGE, S, dagarSedan, elevNamn, hämtaMatchunderlag,
          kortDatum, läge, matchar, namnFör, pill, skriv, tabell, tomtText,
          väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaElever = (...a) => NXAdmin.rita.ritaElever(...a);
  const ritaFamiljer = (...a) => NXAdmin.rita.ritaFamiljer(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const träffar = (...a) => NXAdmin.rita.träffar(...a);
  const utanRapport = (...a) => NXAdmin.rita.utanRapport(...a);
  const ritaAvvikelser = (...a) => NXAdmin.rita.ritaAvvikelser(...a);
  const ritaMaskinUppgifter = (...a) => NXAdmin.rita.ritaMaskinUppgifter(...a);

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

  /* ------------------------------------------------------------
     POÄNGEN RÄKNAS I DATABASEN (Fas 8)

     Reglerna låg här i JavaScript, och ingen annan kunde fråga efter
     dem: en agent, ett schema eller en kontroll hade behövt rita en
     sida först. Nu ligger de i matchningsforslag(), och den här filen
     hämtar svaret i stället för att räkna om det.

     Att flytta dem var inte att skriva om dem. Databasversionen
     provades mot den här filens gamla funktion på 150 slumpade fall
     — samma poäng, samma utfall, samma hårda nej i alla 150.

     MENINGARNA SKRIVS FORTFARANDE HÄR. Databasen svarar med koder
     ('ja', 'nej', 'vet_ej') och tal, aldrig med svensk text. Två skäl:
     gränssnittstext hör inte hemma i en tabell, och samma svar ska
     kunna läsas av drift-agenten utan att den får namn på köpet.
     ------------------------------------------------------------ */

  async function hämtaMatchpoäng(elevId) {
    if (!elevId) return;
    S.matchpoang = S.matchpoang || {};
    S.matchpoangFel = S.matchpoangFel || {};
    if (S.matchpoang[elevId]) return;

    const { data, error } = await supa.rpc('matchningsforslag', { p_elev: elevId });
    if (error) {
      /* Felet är PER ELEV, inte globalt. Ett misslyckat anrop för en
         elev ska varken hindra nästa elev eller skriva över en elev
         vars poäng redan ligger i cachen. Ingen tom lista heller —
         då hade nästa uppritning sett ett "svar" som säger att ingen
         passar. */
      S.matchpoangFel[elevId] = felText(error);
      return;
    }
    delete S.matchpoangFel[elevId];
    S.matchpoang[elevId] = data || [];
  }

  /* Ental och flertal, och de två fallen där ett tomt fält inte
     betyder nej utan "vi vet inte". Samma meningar som förut. */
  function skälFör(rad, elev) {
    const skäl = [];

    if (rad.amne_utfall === 'vet_ej') {
      skäl.push(['vet-ej', elev.subjects && elev.subjects.length
        ? 'Studiehjälparen har inga ämnen angivna'
        : 'Eleven har inga ämnen angivna']);
    } else if (rad.amne_utfall === 'ja') {
      skäl.push(['ja', rad.amne_traffar === rad.amne_av
        ? 'Täcker alla elevens ämnen'
        : 'Täcker ' + rad.amne_traffar + ' av ' + rad.amne_av + ' ämnen']);
    } else {
      skäl.push(['nej', 'Inget gemensamt ämne']);
    }

    if (rad.arskurs_utfall === 'vet_ej') {
      skäl.push(['vet-ej', elev.grade
        ? 'Studiehjälparen har inga årskurser angivna'
        : 'Eleven saknar årskurs']);
    } else if (rad.arskurs_utfall === 'ja') {
      skäl.push(['ja', 'Undervisar ' + elev.grade]);
    } else {
      skäl.push(['nej', 'Undervisar inte ' + elev.grade]);
    }

    const antal = Number(rad.antal_elever || 0);
    skäl.push([antal < 3 ? 'ja' : 'nej',
      antal === 0 ? 'Har inga elever än'
        : antal + (antal === 1 ? ' elev sedan tidigare' : ' elever sedan tidigare')]);

    const pass = Number(rad.genomforda_pass || 0);
    skäl.push(pass
      ? ['ja', pass + (pass === 1 ? ' genomfört pass' : ' genomförda pass')]
      : ['vet-ej', 'Inga genomförda pass än']);

    return skäl;
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

    /* Poängen kommer från databasen. Saknas den för den här eleven
       hämtas den, och panelen ritas om när svaret kommit — samma
       mönster som detaljpanelen använder. */
    const felFörEleven = (S.matchpoangFel || {})[elev.id];
    const poäng = (S.matchpoang || {})[elev.id];
    if (!poäng && !felFörEleven) {
      host.innerHTML = laddar('Räknar fram förslag');
      hämtaMatchpoäng(elev.id).then(() => {
        if (S.valdElev === elev.id) ritaMatchPanel();
      });
      return;
    }

    const poängFörTutor = {};
    (poäng || []).forEach(r => { poängFörTutor[r.tutor_id] = r; });

    const förslag = S.matchunderlag
      .map(t => {
        const r = poängFörTutor[t.tutor_id]
          || { poang: 0, amne_utfall: 'vet_ej', arskurs_utfall: 'vet_ej',
               antal_elever: t.antal_elever, genomforda_pass: t.genomforda_pass, hart_nej: false };
        return { tutor: t, poäng: r.poang, hårtNej: !!r.hart_nej, skäl: skälFör(r, elev) };
      })
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

    /* Gick rankningen inte att hämta säger vi DET, i stället för att
       rita kort med noll poäng och "vet ej" på allt — kort som
       samtidigt räknar upp hjälparens ämnen och påstår att hon inte
       har några. "Ingen passar" och "vi kunde inte räkna" är två
       olika besked.

       Rutan ligger här och inte högre upp, för den ska stå under
       elevens rubrik — och `ut` finns inte förrän nu. Första
       försöket satte den före, vilket gav ReferenceError och en
       evig spinner i stället för ett besked. */
    if (felFörEleven) {
      /* Räknaren nollas också. "2 GODKÄNDA" bredvid "gick inte att
         räkna fram" är två besked som inte kan vara sanna samtidigt. */
      $('#mt-forslag-antal').textContent = '';
      host.innerHTML = ut + '<div class="empty"><b>Förslagen kunde inte räknas fram</b><br>'
        + '<span>' + esc(felFörEleven) + '</span></div>';
      return;
    }

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

    /* Poängen bygger på hur många elever varje hjälpare har, och det
       talet ändrades just nu. Cachen töms därför helt — inte bara för
       den här eleven. */
    S.matchpoang = {};
    S.matchpoangFel = {};

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
      /* Ett nytt klick är ett nytt försök. Utan den här raden låser
         ett tillfälligt fel — en timeout, ett tappat nät — panelen
         för resten av sessionen, eftersom vakten nedan hindrar varje
         ny hämtning så länge flaggan står kvar. Rättningen av den
         eviga spinnern bytte annars "försöker om varje gång" mot
         "försöker aldrig om". */
      S.matchpoangFel = {};
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
        + ' · ' + NXBetalning.timmar(b.duration_min || 60) + '</span>' },
      { namn: 'Elev', rita: b => b.elev
        ? '<b>' + esc(b.elev) + '</b><span class="adm-und">' + esc(b.familj) + '</span>'
        : esc(b.familj) + '<span class="adm-und">inget barn valt</span>' },
      { namn: 'Studiehjälpare', rita: b => esc(b.hjalpare) },
      { namn: 'Ämne', rita: b => esc(b.subject || '—')
        + (b.format ? '<span class="adm-und">' + esc(b.format) + '</span>' : '') },
      { namn: 'Läge', rita: b => läge(BOK_LAGE, b.status)
        + (b.attendance === 'franvarande' ? ' ' + pill('Uteblev', 'ar-ny') : '') },
      /* Skälet sätts av Nextrum, inte av den som avbokar. Fälten
         avbokad_at och avbokad_av stämplas av databasen, men skälet
         får bara admin skriva: att släppa in det i skydda_bokningsfalt
         vitlista hade vidgat F-6, och en fritextruta hade gjort
         avbokningsstatistiken till något ingen kan räkna på.

         Därför fasta koder, och därför i efterhand: den som avbokar
         klockan sju på morgonen svarar inte på en enkät. */
      { namn: '', höger: true, rita: b => {
        if (b.status === 'requested' || b.status === 'confirmed') {
          return '<button class="btn btn-ghost btn-sm" data-avboka="' + b.id + '">Avboka</button>';
        }
        if (b.status !== 'cancelled') return '';
        return väljare('avbokskal', AVBOKNINGSSKAL, b.avbokningsskal || '',
          'data-avbokskal="' + b.id + '"');
      } }
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

  /* ============================================================
     UPPDRAG (Fas 5.2, synliga i Fas 6)

     Vad Nextrum utför åt en kund. För läxhjälp ett per barn — det
     skapas av databasen när barnet läggs till, så här finns inget
     att lägga till, bara att se. Barnen och passen hittas genom
     uppdrag_id på elevraden och på passen.
     ============================================================ */
  const UPPDRAG_LAGE = {
    aktivt: ['Aktivt', 'ar-klar'], pausat: ['Pausat', 'ar-vantar'], avslutat: ['Avslutat', '']
  };

  function tjanstNamn(kod) {
    const t = (S.tjanster || []).find(x => x.kod === kod);
    return t ? t.namn : (kod || '—');
  }

  function ritaUppdrag() {
    const host = $('#uppdrag-tabell');
    if (!host) return;
    const filter = ($('#uppdrag-status') || {}).value || '';
    const rader = (S.uppdrag || []).filter(u => !filter || u.status === filter);
    $('#uppdrag-antal').textContent = rader.length ? rader.length + ' st' : '';

    host.innerHTML = tabell([
      { namn: 'Kund', rita: u => '<b>' + esc(namnFör(u.kund_id)) + '</b>' },
      { namn: 'Gäller', rita: u => {
        const barn = (S.elevlista || []).filter(e => e.uppdrag_id === u.id).map(e => e.name);
        return barn.length ? esc(barn.join(', ')) : '<span class="adm-und">Inget barn</span>';
      } },
      { namn: 'Tjänst', rita: u => esc(tjanstNamn(u.tjanst))
        + (u.typ === 'engang' ? '<span class="adm-und">Engång</span>' : '') },
      { namn: 'Pass', rita: u => {
        const pass = (S.bokningar || []).filter(b => b.uppdrag_id === u.id && b.status !== 'cancelled');
        const klara = pass.filter(b => b.status === 'completed').length;
        return '<span class="adm-tal">' + pass.length + '</span>'
          + (pass.length ? '<span class="adm-und">' + klara + ' genomförda</span>' : '');
      } },
      { namn: 'Läge', rita: u => pill((UPPDRAG_LAGE[u.status] || [u.status])[0], (UPPDRAG_LAGE[u.status] || [])[1] || '') },
      { namn: 'Sedan', rita: u => '<span class="adm-tal">' + esc(kortDatum(u.created_at)) + '</span>' }
    ], rader, tomtText(filter, 'Inga uppdrag med det läget', 'Inga uppdrag än — de skapas när ett barn läggs till'));
  }

  const uppdragFilter = $('#uppdrag-status');
  if (uppdragFilter) uppdragFilter.addEventListener('change', ritaUppdrag);

  /* ============================================================
     UPPGIFTER (Fas 6)

     Det någon ska göra. En uppgift som skapas här är alltid en
     människas: databasen (uppgift_stampel) sätter skapad_av och
     skapad_av_typ från inloggningen. AI och schemalagda kontroller
     (Fas 7–8) skriver med service_role och syns som sådana.
     ============================================================ */
  const UPPG_TYP = { uppfoljning: 'Uppföljning', kontroll: 'Kontroll', problem: 'Problem', ovrigt: 'Övrigt' };
  const UPPG_LAGE = {
    oppen: ['Öppen', 'ar-ny'], pagar: ['Pågår', 'ar-vantar'],
    klar: ['Klar', 'ar-klar'], avbruten: ['Avbruten', '']
  };
  const UPPG_FRAN = { manniska: 'Människa', ai: 'AI', system: 'System' };

  /* Vart en uppgift pekar, och vad det heter. Hittas inte raden
     visas tabellens namn — hellre det än en länk till ingenting. */
  const UPPG_MAL = {
    bookings: '#bokningar', invoices: '#ekonomi/fakturor', payouts: '#ekonomi/utbetalningar',
    leads: '#leads', applications: '#ansokningar', profiles: '#familjer', students: '#elever',
    uppdrag: '#uppdrag', tjanster: '#katalog/tjanster', lesson_reports: '#lektioner'
  };
  function uppgKoppling(u) {
    if (!u.kopplad_tabell) return '';
    const id = u.kopplad_id;
    let text = u.kopplad_tabell;
    if (u.kopplad_tabell === 'bookings') {
      const b = (S.bokningar || []).find(x => x.id === id);
      text = b ? 'Pass ' + kortDatum(b.wanted_date) + ' · ' + namnFör(b.parent_id) : 'Ett pass';
    } else if (u.kopplad_tabell === 'invoices') {
      const f = (S.fakturor || []).find(x => x.id === id);
      text = f ? 'Faktura ' + String(f.period || '').slice(0, 7) + ' · ' + namnFör(f.parent_id) : 'En faktura';
    } else if (u.kopplad_tabell === 'payouts') {
      const p = (S.utbetalningar || []).find(x => x.id === id);
      text = p ? 'Utbetalning ' + String(p.period || '').slice(0, 7) + ' · ' + namnFör(p.tutor_id) : 'En utbetalning';
    } else if (u.kopplad_tabell === 'profiles' || u.kopplad_tabell === 'students') {
      const elev = u.kopplad_tabell === 'students' && (S.elevlista || []).find(x => x.id === id);
      text = u.kopplad_tabell === 'students' ? (elev ? 'Elev · ' + elev.name : 'En elev') : namnFör(id);
    } else if (u.kopplad_tabell === 'leads') {
      const l = (S.leads || []).find(x => x.id === id);
      text = 'Intresseanmälan' + (l && l.parent_name ? ' · ' + l.parent_name : '');
    } else if (u.kopplad_tabell === 'applications') {
      const a = (S.ansokningar || []).find(x => x.id === id);
      text = 'Ansökan' + (a && a.name ? ' · ' + a.name : '');
    } else if (u.kopplad_tabell === 'uppdrag') {
      const up = (S.uppdrag || []).find(x => x.id === id);
      text = 'Uppdrag' + (up ? ' · ' + namnFör(up.kund_id) : '');
    }
    const mål = UPPG_MAL[u.kopplad_tabell];
    return mål ? '<a class="adm-und" href="' + mål + '">Gäller: ' + esc(text) + '</a>'
               : '<span class="adm-und">Gäller: ' + esc(text) + '</span>';
  }

  function adminer() {
    return Object.values(S.personer || {}).filter(p => p.is_admin);
  }

  function ritaUppgifter() {
    const host = $('#uppg-tabell');
    if (!host) return;

    /* Ansvarig-väljaren i formuläret: adminerna. */
    const välj = $('#uppg-ansvarig');
    if (välj && välj.options.length <= 1) {
      välj.innerHTML = '<option value="">Ingen</option>' + adminer().map(p =>
        '<option value="' + esc(p.id) + '">' + esc(p.full_name || p.email) + '</option>').join('');
    }

    const filter = ($('#uppg-filter') || {}).value;
    const idag = isoFor(new Date());
    const rader = (S.uppgifter || []).filter(u =>
      filter === 'oppna' ? (u.status === 'oppen' || u.status === 'pagar')
      : filter === 'klara' ? (u.status === 'klar' || u.status === 'avbruten') : true)
      .slice().sort((a, b) => String(a.forfallodag || '9999').localeCompare(String(b.forfallodag || '9999'))
        || String(b.created_at).localeCompare(String(a.created_at)));
    $('#uppg-antal').textContent = rader.length ? rader.length + ' st' : '';

    const ansvarigVal = u => '<select class="sel" style="min-width:132px;padding:7px 28px 7px 10px;font-size:.84rem"'
      + ' data-uppg-ansvarig="' + esc(u.id) + '" aria-label="Ansvarig">'
      + '<option value="">Ingen</option>' + adminer().map(p => '<option value="' + esc(p.id) + '"'
        + (p.id === u.ansvarig ? ' selected' : '') + '>' + esc(p.full_name || p.email) + '</option>').join('')
      + '</select>';
    const lägeVal = u => '<select class="sel" style="min-width:120px;padding:7px 28px 7px 10px;font-size:.84rem"'
      + ' data-uppg-status="' + esc(u.id) + '" aria-label="Läge">'
      + Object.keys(UPPG_LAGE).map(k => '<option value="' + k + '"' + (k === u.status ? ' selected' : '') + '>'
        + esc(UPPG_LAGE[k][0]) + '</option>').join('') + '</select>';

    host.innerHTML = tabell([
      { namn: 'Uppgift', rita: u => '<b>' + esc(u.titel) + '</b>'
        + (u.beskrivning ? '<span class="adm-und">' + esc(String(u.beskrivning).slice(0, 180)) + '</span>' : '')
        + uppgKoppling(u) },
      { namn: 'Typ', rita: u => esc(UPPG_TYP[u.typ] || u.typ) },
      { namn: 'Från', rita: u => u.skapad_av_typ === 'manniska'
        ? esc(u.skapad_av ? namnFör(u.skapad_av) : 'Människa')
        : pill(UPPG_FRAN[u.skapad_av_typ] || u.skapad_av_typ, 'ar-vantar') },
      { namn: 'Ansvarig', rita: ansvarigVal },
      { namn: 'Klar senast', rita: u => {
        if (!u.forfallodag) return '<span class="adm-und">—</span>';
        const sen = (u.status === 'oppen' || u.status === 'pagar') && u.forfallodag < idag;
        return sen ? pill(kortDatum(u.forfallodag) + ' · sen', 'ar-ny')
                   : '<span class="adm-tal">' + esc(kortDatum(u.forfallodag)) + '</span>';
      } },
      { namn: 'Läge', rita: lägeVal }
    ], rader, filter === 'oppna' ? 'Inga öppna uppgifter' : 'Inga uppgifter');
  }

  const uppgFilter = $('#uppg-filter');
  if (uppgFilter) uppgFilter.addEventListener('change', ritaUppgifter);

  /* Skapar en uppgift och ritar om. Anropas också från Ekonomi, när
     en avvikelse ska bli någons att ta hand om. Returnerar raden,
     eller null med felet redan visat. */
  async function skapaUppgift(fält) {
    const { data, error } = await supa.from('uppgifter').insert(fält).select().single();
    if (error) {
      alert(error.code === '23505'
        ? 'Det finns redan en öppen uppgift för det här.'
        : 'Kunde inte skapa uppgiften: ' + felText(error));
      return null;
    }
    S.uppgifter = [data].concat(S.uppgifter || []);
    ritaUppgifter();
    ritaMaskinUppgifter();   // listan under Automationer visar samma rader
    ritaÖversikt();
    return data;
  }

  const uppgForm = $('#uppg-form');
  if (uppgForm) uppgForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#uppg-msg');
    rensa(msg);
    const titel = $('#uppg-titel').value.trim();
    if (!titel) { säg(msg, 'Skriv vad som ska göras.', false); $('#uppg-titel').focus(); return; }
    const knapp = uppgForm.querySelector('button[type="submit"]');
    await medan(knapp, 'Lägger till…', async () => {
      const rad = await skapaUppgift({
        titel,
        typ: $('#uppg-typ').value || 'ovrigt',
        ansvarig: $('#uppg-ansvarig').value || null,
        forfallodag: $('#uppg-datum').value || null,
        beskrivning: $('#uppg-text').value.trim() || null
      });
      if (!rad) return;
      uppgForm.reset();
      säg(msg, '✓ Uppgiften är tillagd.', true);
    });
  });

  document.addEventListener('change', async e => {
    const läge = e.target.closest('[data-uppg-status]');
    const ansvarig = e.target.closest('[data-uppg-ansvarig]');
    if (!läge && !ansvarig) return;
    const id = (läge || ansvarig).dataset[läge ? 'uppgStatus' : 'uppgAnsvarig'];
    const fält = läge ? { status: läge.value } : { ansvarig: ansvarig.value || null };
    const u = (S.uppgifter || []).find(x => x.id === id);
    if (!u) return;
    if (await skriv('uppgifter', id, fält)) {
      Object.assign(u, fält);
      if (läge) u.klar_at = läge.value === 'klar' ? new Date().toISOString() : null;
      ritaUppgifter();
      ritaAvvikelser();          // "Uppgift finns" följer uppgiftens läge
      ritaMaskinUppgifter();     // och Automationer räknar bara de öppna
      ritaÖversikt();
    }
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaBokningar, ritaKalender, ritaLektioner, ritaMatchning,
    ritaUppdrag, ritaUppgifter, skapaUppgift
  });
})();
