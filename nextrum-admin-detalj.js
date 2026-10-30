/* ============================================================
   NEXTRUM — adminvyn, detaljpanelen (familj, elev, studiehjälpare, anmälan, ansökan, pass)

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

  const { ANS_LAGE, AVBOKNINGSSKAL, BOK_LAGE, DP, KORT_LAGE, LEAD_LAGE, S, SH_LAGE, TILLAGG_LAGE,
          UTB_LAGE, elevHjälpare, elevNamn, funktionsFel, gmailAdress, gmailLänk, hämtaAllt, hämtaMatchunderlag, kortDatum, läge,
          namnFör, närText, lägesväljare, pill, rad, ärRaderad, får, ärSuperadmin } = NXAdmin;
  /* Funktioner som bor i andra områden, nådda när de anropas. En som
     saknas hoppas över: panelen ska inte dö för att en lista inte
     laddade. */
  const kör = (namn, ...a) => {
    const f = NXAdmin.rita[namn];
    return typeof f === 'function' ? f(...a) : undefined;
  };

  /* ============================================================
     DETALJPANELEN

     En familj, en elev eller en studiehjälpare, öppnad från vilken
     lista som helst. Samma panel för alla tre — det som skiljer är
     vilka flikar den har och vad som hämtas.

     HÄMTAS NÄR DEN ÖPPNAS, INTE I FÖRVÄG

     Studieplaner, läxor, material, utvecklingsområden, rapporter
     och tillgänglighet för ALLA vore sju frågor till vid varje
     sidladdning, och nästan ingenting av det tittar man på. Med
     två elever spelar det ingen roll. Med hundra gör det det, och
     då är det för sent att ändra arkitektur.

     Panelen cachar per person i S.detaljCache: öppnar man samma
     familj två gånger i rad hämtas ingenting andra gången.
     ============================================================ */

  function byggPanel() {
    if (DP.panel) return;

    DP.bak = document.createElement('div');
    DP.bak.className = 'dp-bak';
    DP.bak.hidden = true;
    DP.bak.addEventListener('click', stängDetalj);

    DP.panel = document.createElement('aside');
    DP.panel.className = 'dp';
    DP.panel.hidden = true;
    DP.panel.setAttribute('role', 'dialog');
    DP.panel.setAttribute('aria-modal', 'true');
    DP.panel.setAttribute('aria-label', 'Detaljer');

    document.body.appendChild(DP.bak);
    document.body.appendChild(DP.panel);

    DP.panel.addEventListener('click', e => {
      if (e.target.closest('[data-dp-stang]')) { stängDetalj(); return; }
      if (e.target.closest('[data-dp-redigera]')) {
        DP.redigera = true;
        ritaDetalj();
        const första = DP.panel.querySelector('.dp-red input, .dp-red select, .dp-red textarea');
        if (första) första.focus();
        return;
      }
      if (e.target.closest('[data-dp-red-avbryt]')) { DP.redigera = false; ritaDetalj(); return; }
      /* Ett flikbyte lämnar redigeringen. Det som inte sparats sparas
         inte, och formuläret står inte kvar och väntar i en annan flik. */
      const f = e.target.closest('[data-dp-flik]');
      if (f) { DP.flik = f.dataset.dpFlik; DP.redigera = false; ritaDetalj(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && DP.panel && !DP.panel.hidden) stängDetalj();
    });
  }

  function stängDetalj() {
    if (!DP.panel) return;
    DP.panel.classList.remove('ar-oppen');
    DP.bak.classList.remove('ar-oppen');
    DP.typ = null; DP.id = null; DP.redigera = false;
    /* Vänta ut övergången innan hidden sätts, annars hoppar
       panelen bort i stället för att glida. */
    setTimeout(() => {
      if (DP.typ) return;           // hann öppnas igen
      DP.panel.hidden = true;
      DP.bak.hidden = true;
    }, 280);
    if (DP.sistaFokus && DP.sistaFokus.focus) DP.sistaFokus.focus();
  }

  /* ------------------------------------------------------------
     HÄMTNINGEN
     En fråga per tabell panelen behöver, alla parallellt. Vad som
     behövs beror på typ: en studiehjälpare har ingen studieplan,
     en familj har ingen tillgänglighet.
     ------------------------------------------------------------ */
  async function hämtaDetalj(typ, id) {
    const nyckel = typ + ':' + id;
    if (S.detaljCache[nyckel]) return S.detaljCache[nyckel];

    const d = { fel: null };
    const frågor = [];
    const namn = [];

    function lägg(n, q) { namn.push(n); frågor.push(q); }
    /* Användarvillkoren (villkoren_godkanns, 2026-10-07): personens
       godkännanden, och den gällande versionen ur mitt_villkorslage(),
       som säger den för vem som helst som frågar. */
    function läggVillkor(vem) {
      lägg('villkor', supa.from('villkor_godkannanden')
        .select('version, godkant_at, kalla').eq('anvandare', vem)
        .order('godkant_at', { ascending: false }).limit(5));
      lägg('villkorslage', supa.rpc('mitt_villkorslage'));
    }

    if (typ === 'elev') {
      lägg('plan', supa.from('study_plans')
        .select('subject, goals, plan_text, updated_at').eq('student_id', id)
        .order('updated_at', { ascending: false }).limit(1));
      lägg('laxor', supa.from('homework')
        .select('id, title, subject, due_date, status, created_at').eq('student_id', id)
        .order('due_date', { ascending: false }).limit(50));
      lägg('material', supa.from('materials')
        .select('id, title, kind, subject, url, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(50));
      lägg('utveckling', supa.from('progress_items')
        .select('id, subject, area, level, steg, mal_steg, comment, updated_at').eq('student_id', id)
        .order('subject').order('area'));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, went_well, needs_practice, next_focus, ai_feedback, created_at')
        .eq('student_id', id).order('lesson_date', { ascending: false }).limit(30));
      /* Betygsgarantin (2026-10-07): vad föräldern anmält, med betyget
         hen angav. Policyn ger bara den som läser personer raderna. */
      lägg('garantier', supa.from('betygsgarantier')
        .select('id, lasar, amne, betyg, anmald_at, andrad_at').eq('student_id', id)
        .order('lasar', { ascending: false }).order('anmald_at'));
    } else if (typ === 'pass') {
      /* Fas 20.1: tiden står på rapporten, inte på passet. Passet bär
         det som bokades; rapporten säger vad som hände. Tillägget för
         övertid och vad kortbetalningen avsåg (stripe_minuter) hämtas
         färskt, för det är de som avgör vad familjen är skyldig. */
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, narvaro, start_tid, slut_tid, hallna_min, debiterade_min, avvikelse_skal, created_at')
        .eq('booking_id', id).order('created_at'));
      lägg('tillagg', supa.from('pass_tillagg')
        .select('id, minuter, begart_ore, status, betalt_ore, aterbetald_ore, betald_at, stripe_skarp, created_at')
        .eq('booking_id', id));
      lägg('pass', supa.from('bookings').select('id, stripe_minuter').eq('id', id));
      /* Familjens rabatt på passet (familjerabatter, 2026-10-15), i en egen
         fråga: kolumnen finns först efter migrationen, och en fråga som
         nämner den hade annars tömt raden ovanför. */
      lägg('passRabatt', supa.from('bookings').select('familjerabatt_ore').eq('id', id));
      /* Den sena avbokningen (sen_avbokning, 2026-10-22), av samma skäl i en
         egen fråga. */
      lägg('passSen', supa.from('bookings')
        .select('sen_avbokning_minuter, sen_avbokning_ore, avbokad_for_familjen').eq('id', id));
    } else if (typ === 'anmalan' || typ === 'ansokan') {
      /* Allt om en anmälan eller en ansökan finns redan i S: raden och
         besöken i mejlkön. Ingen fråga till. */
    } else if (typ === 'chatt') {
      /* Genom chatt_las() och inte en select: funktionen skriver
         öppningen i auditloggen i samma transaktion som den läser. */
      const [förälder, hjälpare] = String(id).split('|');
      lägg('chatt', supa.rpc('chatt_las', { p_parent: förälder, p_tutor: hjälpare }));
      /* Barnens trådar med samma studiehjälpare (barnets_chatt,
         2026-10-06), genom barnchatt_las(), som också skriver öppningen. */
      lägg('barnchatt', supa.rpc('barnchatt_las', { p_parent: förälder, p_tutor: hjälpare }));
    } else if (typ === 'studiehjalpare') {
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, student_id, lesson_date, created_at').eq('tutor_id', id)
        .order('lesson_date', { ascending: false }).limit(30));
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));
      /* Vilka familjer hen har en tråd med. Bara vem och när, ingen text:
         texten läses genom Öppna chatt, som står i loggen. */
      lägg('tradar', supa.from('messages')
        .select('parent_id, created_at').eq('tutor_id', id)
        .order('created_at', { ascending: false }).limit(TRAD_MAX));
      läggVillkor(id);
      /* Utbildningsprovet i vyn (2026-10-21): läget, försöken och om
         spärren gäller. Policyerna ger superadmin och den som får
         godkänna studiehjälpare raderna. */
      lägg('prov', supa.from('prov_studiehjalpare')
        .select('kravs, utbildningsprov_godkant_at, aterstalld_at, undantagen, andrad_at').eq('id', id));
      lägg('provForsok', supa.from('prov_forsok')
        .select('id, inlamnad_at, ratt, antal, procent, godkand').eq('studiehjalpare_id', id)
        .order('inlamnad_at', { ascending: false }).limit(20));
      lägg('provLage', supa.rpc('utbildningsprovet_lage'));
      /* Kön och elever (kon_i_matchningen, 2026-10-26): studiehjälparens
         val, som bara hen och den som läser studiehjälparna ser. */
      lägg('matchningsval', supa.from('matchningsval')
        .select('kon, bara_samma_kon, andrad_at').eq('tutor_id', id));
    } else {
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));

      /* Tidslinjen. Anmälningarna och meddelandena finns inte i S:
         S.chattar är en rad per tråd, och S.meddelanden är kapad
         till de 400 senaste i hela systemet — en familj som varit
         tyst en månad hade då fått en tom tidslinje trots att
         tråden finns. Pass, noteringar och uppgifter ligger redan i
         minnet och hämtas inte om. */
      lägg('anmalningar', supa.from('leads')
        .select('id, created_at, kontaktad_at, status, subject, tjanst, uppdrag_id')
        .eq('kund_id', id).order('created_at', { ascending: false }));
      lägg('meddelanden', supa.from('messages')
        .select('id, sender_id, body, created_at').eq('parent_id', id)
        .order('created_at', { ascending: false }).limit(60));
      /* Vilka studiehjälpare familjen har en tråd med, också en äldre som
         inte ryms bland de 60 i tidslinjen. */
      lägg('tradar', supa.from('messages')
        .select('tutor_id, created_at').eq('parent_id', id)
        .order('created_at', { ascending: false }).limit(TRAD_MAX));
      läggVillkor(id);
      /* Insatta timmar (timmar_med_orsak, 2026-10-21): varje insättning med
         månaden och orsaken. Bara en superadmin får raderna. Raden Första
         timmen gratis och dess fråga togs bort samma dag (Leo). */
      lägg('insatta', supa.from('timmar_insatta')
        .select('id, klippkort_id, timmar, avser_manad, orsak, insatt_av, insatt_at').eq('familj', id)
        .order('insatt_at', { ascending: false }).limit(100));
      /* Kortet (kortet_reserveras, 2026-10-13): familjens sparade kort och
         passen där det valts. Policyerna ger bara en superadmin raderna. */
      lägg('kort', supa.from('sparade_kort')
        .select('marke, sista4, utgar_manad, utgar_ar, sparat').eq('parent_id', id));
      lägg('kortpass', supa.from('kortreservationer')
        .select('booking_id, lage, reserverat_ore, reserverat_till, dragen_ore, fel, andrad').eq('parent_id', id)
        .order('andrad', { ascending: false }).limit(50));
      /* Egna upplägg (egna_upplagg, 2026-10-27): det admin skickat till
         familjen, senaste först. Familjen läser sina, admin alla. */
      lägg('upplagg', supa.from('egna_upplagg')
        .select('id, namn, timmar, timpris_ore, pris_ore, giltigt_till, skapad_av, skapad_at, aterkallad_at, kopt_at, klippkort_id')
        .eq('familj', id).order('skapad_at', { ascending: false }).limit(50));
    }

    /* Varje fråga fångas var för sig.

       Promise.all avvisar vid FÖRSTA felet, och då kastades
       undantaget hela vägen ut — panelen blev stående på "Hämtar"
       i varenda flik, även de som inte hade med den trasiga
       frågan att göra. En saknad tabell eller ett tappat nät
       räckte för att frysa hela vyn.

       Nu blir ett fel ett fel i EN flik. Resten ritas. */
    const svar = await Promise.all(frågor.map(q =>
      Promise.resolve(q).then(
        r => r,
        e => ({ data: null, error: e })
      )));

    svar.forEach((r, i) => {
      d[namn[i]] = (r && r.data) || [];
      if (r && r.error) {
        d[namn[i] + 'Fel'] = felText(r.error);
        /* En funktion eller tabell som inte finns (migrationen är inte
           körd) ska kunna sägas som vad den är, inte som ett obegripligt fel. */
        d[namn[i] + 'Saknas'] = r.error.code === 'PGRST202' || r.error.code === 'PGRST205'
          || /could not find the (function|table)/i.test(String(r.error.message || ''));
      }
    });

    S.detaljCache[nyckel] = d;
    return d;
  }

  /* ------------------------------------------------------------
     FLIKARNA PER TYP
     ------------------------------------------------------------ */
  const DP_FLIKAR = {
    familj:         [['oversikt', 'Översikt'], ['barn', 'Barn'], ['pass', 'Pass'],
                     ['ekonomi', 'Ekonomi'], ['tidslinje', 'Tidslinje'],
                     ['anteckningar', 'Anteckningar']],
    elev:           [['oversikt', 'Översikt'], ['pass', 'Pass'], ['uppgifter', 'Uppgifter'],
                     ['utveckling', 'Utveckling'], ['rapporter', 'Rapporter']],
    /* Fliken Tider är borta sedan 2026-09-24: studiehjälparen har inget
       veckoschema längre. Familjen föreslår en tid och hjälparen svarar. */
    studiehjalpare: [['oversikt', 'Översikt'], ['elever', 'Elever'], ['pass', 'Pass'],
                     ['ersattning', 'Ersättning'],
                     ['anteckningar', 'Anteckningar']],
    /* Fas 20.2: ett pass, öppnat från bokslutets larm, Ekonomis listor
       och passlistorna i panelen. En flik: allt om ett pass ryms på en. */
    pass:           [['oversikt', 'Passet']],
    /* 2026-09-28: den som skickat en intresseanmälan eller sökt jobb har
       inget konto, men är lika mycket en person i våra system. Listorna
       är bara namn, och allt de skrev står här, med Redigera och Radera
       som för alla andra. Rekryteringens steg stod förut i en egen ruta. */
    anmalan:        [['oversikt', 'Anmälan']],
    ansokan:        [['oversikt', 'Ansökan']],
    /* 2026-09-29: tråden mellan en familj och en studiehjälpare, öppnad
       med Öppna chatt. Id:t är familjens och studiehjälparens, med ett
       | emellan: tråden har inget eget id (schema-v4). */
    chatt:          [['oversikt', 'Chatten']]
  };

  async function öppnaDetalj(typ, id, flik) {
    if (!DP_FLIKAR[typ]) return;
    DP.redigera = false;
    /* Ett pass hämtas om varje gång. Tiden, tillägget och betalningen
       ändras av andra (studiehjälparen, familjen, Stripe), och ett
       cachat pass hade visat ett tillägg som obetalt efter att det
       betalats.

       En chatt likaså, och av ett skäl till: varje öppning är en rad i
       auditloggen (chatt_las). En öppning ur cachen hade varit en
       läsning som loggen inte vet om. */
    if (typ === 'pass' || typ === 'chatt') delete S.detaljCache[typ + ':' + id];
    DP.chattRitad = null;
    byggPanel();
    DP.sistaFokus = document.activeElement;
    DP.typ = typ; DP.id = id;
    /* En lista kan be om en annan flik än den första (data-dp-start),
       men bara en som typen har. */
    DP.flik = DP_FLIKAR[typ].some(f => f[0] === flik) ? flik : DP_FLIKAR[typ][0][0];

    DP.bak.hidden = false;
    DP.panel.hidden = false;
    /* Två bildrutor innan klassen sätts, annars hinner webbläsaren
       inte se starttillståndet och övergången uteblir. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      DP.bak.classList.add('ar-oppen');
      DP.panel.classList.add('ar-oppen');
    }));

    ritaDetalj(true);
    await hämtaDetalj(typ, id);
    if (DP.typ === typ && DP.id === id) ritaDetalj();
  }


  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  /* En rad som är null står inte med: ett fält som bara finns efter en
     migration (könet, 2026-10-26) skickas som null före den. */
  function dpFakta(rader) {
    return '<div class="dp-fakta">' + rader.filter(Boolean).map(r =>
      '<div><span>' + esc(r[0]) + '</span>'
      + (r[1] ? '<span>' + r[1] + '</span>'
              : '<span class="ar-tom">' + esc(r[2] || 'ej angivet') + '</span>')
      + '</div>').join('') + '</div>';
  }

  /* E-post och telefon som går att klicka på.

     Stod förut som ren text i faktarutan, och den som ville höra av
     sig fick markera adressen och klistra in den i sitt mejlprogram.
     På en telefon gick det inte alls. Adressen öppnar ett utkast i
     Gmail (2026-10-11, KONTAKTRUTAN i nextrum-admin-karna.js). */
  function dpMejl(adress) {
    if (!adress) return null;
    return gmailAdress(adress);
  }

  function dpTelefon(nummer) {
    if (!nummer) return null;
    /* tel: tål inte mellanslag eller bindestreck. Numret visas som det
       skrevs in och städas bara i länkens adress. */
    return '<a href="tel:' + esc(String(nummer).replace(/[^\d+]/g, '')) + '">'
      + esc(nummer) + '</a>';
  }

  /* Senast inloggad, och en knapp som skickar länken igen (2026-10-06).
     Kontot skapas när personen tas in, och länken i mejlet går att missa
     eller låta bli gammal. Sedan 2026-10-07 står knappen alltid för en
     familj och en studiehjälpare (Leo: "i admin ska vi kunna skicka
     inbjudningslänk när vi vill efter, ifall de missar den"): före första
     inloggningen heter den Skicka inbjudan igen, sedan Skicka länk för
     lösenord. bjud-in avgör vad som går: en ny inbjudan till den som inte
     tryckt på länken, annars en länk för att välja lösenord. */
  function dpSenast(p) {
    const när = p.last_seen_at ? esc(kortDatum(p.last_seen_at)) : 'aldrig';
    // bjud-in släpper bara fram en superadmin (kravAdmin).
    if (!p.email || (p.role !== 'parent' && p.role !== 'tutor') || !ärSuperadmin()) return när;
    return när + ' <button class="btn btn-ghost btn-sm" type="button" data-dp-bjud-igen="' + esc(p.id) + '">'
      + (p.last_seen_at ? 'Skicka länk för lösenord' : 'Skicka inbjudan igen') + '</button>';
  }

  /* Har personen godkänt användarvillkoren (2026-10-07)? Den gällande
     versionen, en äldre, eller inga alls. Utan tabellen eller funktionen
     (en databas före migrationen) står raden som okänd, aldrig som "inte
     godkända": det hade varit fel om personen. */
  function dpVillkor(d) {
    if (d.villkorFel || d.villkorslageFel) return null;
    const version = d.villkorslage && d.villkorslage.version;
    const rader = Array.isArray(d.villkor) ? d.villkor : [];
    if (!version) return null;
    const gällande = rader.find(r => r.version === version);
    if (gällande) {
      return esc('godkända ' + kortDatum(gällande.godkant_at)
        + (gällande.kalla === 'registrering' ? ', när kontot skapades' : ''));
    }
    return rader.length
      ? esc('inte de nya; en äldre version godkändes ' + kortDatum(rader[0].godkant_at))
      : 'inte godkända än';
  }

  /* Raden Första timmen gratis stod i familjens översikt 2026-10-09 till
     2026-10-21 (Leo: "Ta bort raden 'Första timmen gratis' i
     familjeprofilerna"). Timmen själv är kvar: den första planen familjen
     betalar får den av sig själv (intern.planens_forsta_timme), och
     timbanken under Ekonomi visar planen med timmen i. */

  /* TIMBANKEN OCH GRATISTIMMARNA (2026-10-13)

     Leo: "vi kan även sätta in gratis timmar som vi själva väljer när
     familjen redan är inne i system". Gratistimmarna är en rad i
     klippkort med erbjudandet 'gratis' (migrationen gratistimmar): de
     gäller i 60 dagar, betalar familjens pass före köpta timmar, sparar
     inga minuter och betalas aldrig ut. Bara en superadmin sätter in och
     tar tillbaka (ge_gratistimmar, ta_tillbaka_gratistimmar), och bara
     hen har köpen i S.klippkort: för andra står raden inte alls.

     Översikt säger timmarna i korthet; allt står under Ekonomi, med köpen
     och gratistimmarna kort för kort och rutan för att sätta in. */
  const fullAdmin = ärSuperadmin;
  let gratisBesked = null;   // { id, text, ok }: kvittot efter en ändring, visas en gång

  function dpTimbankKort(p) {
    if (!fullAdmin() || S.klippkortFel) return null;
    const brukbara = (S.klippkort || []).filter(k => k.parent_id === p.id && k.brukbar);
    const timmar = brukbara.reduce((n, k) => n + Number(k.kvar || 0), 0);
    const gratis = brukbara.filter(NXBetalning.gratistimmar).reduce((n, k) => n + Number(k.kvar || 0), 0);
    const bank = (S.timbank || []).find(r => r.parent_id === p.id);
    const delar = [timmar === 1 ? '1 timme' : timmar + ' timmar'];
    if (gratis) delar.push('varav ' + gratis + ' gratis');
    if (bank && Number(bank.saldo_min) > 0) delar.push(bank.saldo_min + ' min sparade');
    return esc(delar.join(', '))
      + ' <button class="btn btn-ghost btn-sm" type="button" data-dp-flik="ekonomi">Sätt in gratistimmar</button>';
  }

  /* Månaderna insatta timmar kan avse: september 2026 till nästa månad,
     som ge_gratistimmar prövar. Den innevarande är förvald, räknad i
     Stockholms tid som i databasen, inte i webbläsarens. */
  function gratisMånader() {
    const [år, mån] = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }).split('-').map(Number);
    const denna = år + '-' + String(mån).padStart(2, '0') + '-01';
    const slut = new Date(år, mån, 1, 12);
    const lista = [];
    for (let d = new Date(2026, 8, 1, 12); d <= slut; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) {
      lista.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01');
    }
    return { lista, denna };
  }
  const månadText = iso => {
    const [år, m] = String(iso).split('-');
    return NX.MANADER[Number(m) - 1] + ' ' + år;
  };

  /* Insatta timmar (timmar_med_orsak, 2026-10-21): en rad per insättning,
     med månaden, orsaken, vem och när. Raderna står fast i databasen. */
  function dpInsatta(d) {
    if (d.insattaSaknas) return '';
    if (d.insattaFel) return dpRubrik('Insatta timmar') + tomt('Insättningarna gick inte att läsa', d.insattaFel);
    const rader = d.insatta || [];
    if (!rader.length) return '';
    return dpRubrik('Insatta timmar', 'med orsak, och de ändras aldrig')
      + rader.map(r => dpRad(gratisTimmar(Number(r.timmar)) + ', avser ' + månadText(r.avser_manad),
          [r.orsak, 'insatta ' + kortDatum(r.insatt_at) + (r.insatt_av ? ' av ' + namnFör(r.insatt_av) : '')].join(' · '),
          '')).join('');
  }

  function dpTimbank(p, d) {
    if (!fullAdmin()) return '';
    const idag = isoFor(new Date());
    if (S.klippkortFel) {
      return dpRubrik('Timbanken') + tomt('Timbanken gick inte att läsa', S.klippkortFel);
    }
    const kort = (S.klippkort || [])
      .filter(k => k.parent_id === p.id && k.status !== 'vantar' && k.status !== 'misslyckad')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const bank = (S.timbank || []).find(r => r.parent_id === p.id);
    const rader = kort.map(k => {
      const gratis = NXBetalning.gratistimmar(k);
      const utgånget = !!k.giltigt_till && String(k.giltigt_till) < idag;
      /* Tillbakatagna gratistimmar står kvar, märkta (aterkallad_at,
         timmarna_delas 2026-10-14). Förut raderades de. */
      const under = [
        k.aterkallad_at ? 'togs tillbaka ' + kortDatum(k.aterkallad_at) : k.kvar + ' av ' + k.timmar + ' timmar kvar',
        gratis ? 'insatta ' + kortDatum(k.created_at) : 'köpt ' + kortDatum(k.betald_at || k.created_at),
        /* Köpt med familjerabatten (2026-10-15): kronor av per betald timme. */
        Number(k.familjerabatt_ore) > 0 ? 'med familjerabatt, ' + kronor(k.familjerabatt_ore) + ' av per timme' : null,
        k.aterkallad_at || !k.giltigt_till ? null : (utgånget ? 'gick ut ' : 'gäller till ') + kortDatum(k.giltigt_till)
      ].filter(Boolean).join(' · ');
      /* Ta tillbaka står bara där det finns timmar att ta: timmarna på
         förslag och pass står kvar (ta_tillbaka_gratistimmar). */
      const höger = gratis && k.brukbar && Number(k.kvar) > 0
        ? '<button class="btn btn-ghost btn-sm" type="button" data-dp-gratis-tillbaka="' + esc(k.id) + '">Ta tillbaka</button>'
        : '';
      return dpRad(gratis ? 'Gratistimmar från Nextrum' : (k.namn || 'Köpta timmar'), under, höger);
    }).join('');
    const besked = gratisBesked && gratisBesked.id === p.id ? gratisBesked : null;
    gratisBesked = null;
    return dpRubrik('Timbanken', 'köpta timmar, gratistimmar och sparade minuter')
      + (rader || tomt('Inga timmar', 'Familjen har inte köpt några timmar, och inga gratistimmar är insatta.'))
      + (bank && Number(bank.saldo_min) > 0
        ? dpRad('Sparade minuter', bank.saldo_min + ' min'
            + (bank.varde_ore != null ? ', värda ' + kronor(bank.varde_ore) + ' om familjen slutar' : ''), '')
        : '')
      + dpInsatta(d || {})
      /* Timmarna, månaden de avser och orsaken (timmar_med_orsak,
         2026-10-21): orsaken krävs, och databasen skriver en rad som står
         fast. */
      + '<form class="dp-gratis" data-dp-gratis="' + esc(p.id) + '">'
      + '<b class="dp-gratis-rubrik">Sätt in gratistimmar</b>'
      + '<div class="dp-gratis-falt"><label for="dp-gratis-n">Timmar</label>'
      + '<input class="inp" id="dp-gratis-n" name="timmar" type="number" min="1" max="40" step="1" inputmode="numeric" value="1" required></div>'
      + '<div class="dp-gratis-falt"><label for="dp-gratis-manad">Avser månad</label>'
      + '<select class="sel" id="dp-gratis-manad" name="manad">'
      + (() => { const m = gratisMånader(); return m.lista.map(x => '<option value="' + x + '"' + (x === m.denna ? ' selected' : '')
          + '>' + esc(månadText(x)) + '</option>').join(''); })()
      + '</select></div>'
      + '<div class="dp-gratis-falt dp-gratis-orsak"><label for="dp-gratis-orsak">Orsak</label>'
      + '<input class="inp" id="dp-gratis-orsak" name="orsak" minlength="3" maxlength="500" autocomplete="off" required'
      + ' placeholder="Till exempel: passet 14 oktober ställdes in av oss"></div>'
      + '<button class="btn btn-primary" type="submit">Sätt in</button>'
      + '<span class="dp-gratis-not">Från oss, utan kostnad. De gäller i 60 dagar och betalar familjens pass före köpta '
      + 'timmar, också förslag och bokade pass som inte är betalda. Det som blir över av en timme sparas inte, och de '
      + 'betalas aldrig ut. Studiehjälparen får lön för passen som vanligt. Orsaken sparas och ändras aldrig: skriv '
      + 'varför, utan namn.</span>'
      + (besked ? '<p class="ok-msg show' + (besked.ok ? '' : ' is-err') + '">' + esc(besked.text) + '</p>' : '')
      + '</form>';
  }

  /* FAMILJERABATTEN (2026-10-15)

     Leo: "vi ser rabattkoden när vi klickar på deras namn och kan välja ta
     bort eller ändra". En av våra koder (Tjänster → Familjerabatter) på
     familjen: kronor av på varje timme den betalar, för det som bokas och
     köps medan koden gäller. Bara en superadmin läser och sätter den
     (satt_familjerabatt); familjen ser aldrig koden, bara det lägre priset.
     Översikt säger den i korthet, och Ekonomi har valet. */
  let rabattBesked = null;   // { id, text, ok }: kvittot efter en ändring, visas en gång

  const familjerabattSaknas = () => S.familjerabatterFel === 'saknas' || S.familjensRabattFel === 'saknas';
  function familjensKod(p) {
    const rad = (S.familjensRabatt || {})[p.id] || null;
    if (!rad || !rad.kod) return { rad, kod: null };
    return { rad, kod: (S.familjerabatter || []).find(k => k.kod === rad.kod)
      || { kod: rad.kod, ore_per_timme: 0, aktiv: false, beskrivning: null } };
  }

  function dpRabattKort(p) {
    if (!fullAdmin() || S.familjerabatterFel || S.familjensRabattFel) return null;
    const { kod } = familjensKod(p);
    return (kod
      ? esc(kod.kod + ', ' + kronor(kod.ore_per_timme) + ' av per timme' + (kod.aktiv ? '' : ', men koden är avstängd'))
      : 'ingen')
      + ' <button class="btn btn-ghost btn-sm" type="button" data-dp-flik="ekonomi">' + (kod ? 'Ändra' : 'Ge en rabatt') + '</button>';
  }

  function dpRabatt(p) {
    if (!fullAdmin()) return '';
    if (familjerabattSaknas()) {
      return dpRubrik('Familjerabatt') + tomt('Familjerabatterna finns inte i databasen än',
        'Migrationen familjerabatter är inte körd. Rutan fungerar när den är det.');
    }
    if (S.familjerabatterFel || S.familjensRabattFel) {
      return dpRubrik('Familjerabatt') + tomt('Familjerabatterna gick inte att läsa', S.familjerabatterFel || S.familjensRabattFel);
    }
    const { rad, kod } = familjensKod(p);
    /* Valet har de aktiva koderna, utom den familjen redan har. */
    const aktiva = (S.familjerabatter || []).filter(k => k.aktiv && !(kod && k.kod === kod.kod));
    const besked = rabattBesked && rabattBesked.id === p.id ? rabattBesked : null;
    rabattBesked = null;
    const kvitto = besked ? '<p class="ok-msg show' + (besked.ok ? '' : ' is-err') + '">' + esc(besked.text) + '</p>' : '';
    const när = rad ? (rad.kod ? 'satt ' : 'togs bort ') + kortDatum(rad.andrad_at)
      + (rad.andrad_av ? ' av ' + namnFör(rad.andrad_av) : '') : null;
    return dpRubrik('Familjerabatt', 'bara vi ser koden; familjen ser det lägre priset')
      + (kod
        ? dpRad(kod.kod + ', ' + kronor(kod.ore_per_timme) + ' av per timme',
            [kod.aktiv ? null : 'koden är avstängd, så ingen rabatt dras', kod.beskrivning || null, när].filter(Boolean).join(' · '),
            '<button class="btn btn-ghost btn-sm" type="button" data-dp-rabatt-bort="' + esc(p.id) + '">Ta bort</button>')
        : dpRad('Ingen familjerabatt', när || 'Familjen betalar ordinarie pris.', ''))
      + (aktiva.length
        ? '<form class="dp-rabatt" data-dp-rabatt="' + esc(p.id) + '">'
          + '<label for="dp-rabatt-kod">' + (kod ? 'Byt till' : 'Ge familjen') + '</label>'
          + '<select class="sel" id="dp-rabatt-kod" name="kod">'
          + aktiva.map(k => '<option value="' + esc(k.kod) + '">'
            + esc(k.kod + ', ' + kronor(k.ore_per_timme) + ' per timme') + '</option>').join('')
          + '</select>'
          + '<button class="btn btn-primary" type="submit">' + (kod ? 'Byt' : 'Ge rabatten') + '</button>'
          + '<span class="dp-gratis-not">Familjen betalar så många kronor mindre för varje timme: pass, planer '
          + 'och timmar till en plan, för det som bokas och köps från och med nu. Det som redan är bokat och köpt behåller sitt '
          + 'pris, och en rabattkod räknas på priset efter rabatten. Studiehjälparen får lön som vanligt.</span>'
          + kvitto
          + '</form>'
        : kvitto
          + '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">' + (kod ? 'Fler familjerabatter att byta till '
            : 'Skapa en familjerabatt för att ge familjen en, ') + 'skapar ni under '
          + '<a href="#katalog/familjerabatter">Tjänster → Familjerabatter</a>.</p>');
  }

  /* PARTNERN (koder_for_planer, 2026-10-21). Leo: "Partnerkopplingen
     sparas också på familjen vid första användningen för uppföljning."
     Partnerkoden familjen använde första gången den köpte en plan med en
     (familjens_partner, skriven av databasen och aldrig ändrad), och
     partnern är kodens. Utan koppling, eller utan migrationen, står
     ingenting. */
  function familjensPartner(p) {
    const rad = (S.familjensPartner || {})[p.id];
    if (!rad) return null;
    const kod = (S.rabattkoder || []).find(k => k.kod === rad.kod) || null;
    return { rad, partner: kod && kod.partner_namn ? kod.partner_namn : rad.kod };
  }

  function dpPartner(p) {
    if (!fullAdmin()) return '';
    const fp = familjensPartner(p);
    if (!fp) return '';
    return dpRubrik('Partner', 'sparas första gången familjen köper en plan med en partnerkod')
      + dpRad(fp.partner, 'Koden ' + fp.rad.kod + ', första köpet ' + kortDatum(fp.rad.kopplad_at),
        '<a class="btn btn-ghost btn-sm" href="#koder/partnerkoder">Partnerkoderna</a>');
  }

  /* Kortet (kortet_reserveras, 2026-10-13): familjens sparade kort och
     passen där det valts och som inte är avgjorda. Kortet finns hos
     Stripe; här står märket, de sista fyra siffrorna och när det går ut.
     Ta bort kortet går genom stripe-checkout, som kopplar bort det hos
     Stripe; det som är reserverat släpps av jobbet, och passen betalas
     efter passet i stället. Utan kort och utan sådana pass, eller utan
     migrationen, står rubriken inte alls. */
  const KORTRES_LAGE = { vald: 'Kortet valt, inget reserverat än', reserverad: 'Reserverat', slapps: 'Släpps',
                         utgangen: 'Reservationen gick ut, dras efter rapporten', misslyckad: 'Kortet nekades' };
  function dpKortet(p, d) {
    if (!fullAdmin() || d.kortSaknas || d.kortpassSaknas) return '';
    if (d.kortFel || d.kortpassFel) return dpRubrik('Kortet') + tomt('Kortet gick inte att läsa', d.kortFel || d.kortpassFel);
    const k = (d.kort || [])[0] || null;
    const öppna = (d.kortpass || []).filter(r => KORTRES_LAGE[r.lage]);
    if (!k && !öppna.length) return '';
    const kortrad = k
      ? dpRad((k.marke ? k.marke.charAt(0).toUpperCase() + k.marke.slice(1) : 'Kort') + (k.sista4 ? ' ·· ' + k.sista4 : ''),
          [k.utgar_manad && k.utgar_ar ? 'går ut ' + String(k.utgar_manad).padStart(2, '0') + '/' + String(k.utgar_ar).slice(-2) : null,
           'sparat ' + kortDatum(k.sparat)].filter(Boolean).join(' · '),
          '<button class="btn btn-ghost btn-sm" type="button" data-dp-kort-bort="' + esc(p.id) + '">Ta bort kortet</button>')
      : dpRad('Inget kort sparat', 'Passen nedan betalas efter passet om familjen inte sparar ett.', '');
    const passrader = öppna.map(r => {
      const b = S.bokningar.find(x => x.id === r.booking_id);
      const när = b ? datumText(b.wanted_date) + (b.wanted_time ? ' ' + String(b.wanted_time).slice(0, 5) : '') : 'Passet';
      const under = [KORTRES_LAGE[r.lage] + (r.lage === 'misslyckad' && r.fel ? ' (' + r.fel + ')' : ''),
        r.reserverat_ore && r.lage !== 'vald' ? kronor(r.reserverat_ore) : null,
        r.lage === 'reserverad' && r.reserverat_till ? 'dras senast ' + kortDatum(r.reserverat_till) : null
      ].filter(Boolean).join(' · ');
      return dpRad(när, under, '');
    }).join('');
    return dpRubrik('Kortet', S.kortFlagga && S.kortFlagga.aktiv
      ? 'priset reserveras två dagar före passet och dras efter rapporten'
      : 'reserveras inte längre: familjen betalar med Betala nu') + kortrad + passrader;
  }

  /* EGNA UPPLÄGG (egna_upplagg, 2026-10-27, Leo: "admin säljer 6 h till
     familjen därför att det är lov och då skickar vi ett upplägg,
     villkoren är samma men det är bara 6h istället", och samma dag: "Samma
     sak som vanliga planer bara annat antal timmar ... Mejl ska gå ut när
     de fått möjlighet till eget upplägg"). Det som skickats, senaste först,
     med läget, Dra tillbaka på det som väntar och Skriv i Gmail för ett eget
     ord, och formuläret för ett nytt: timmarna, namnet och hur många dagar
     familjen kan köpa det. Timpriset är planernas, som databasen sätter
     (skicka_eget_upplagg), och familjen får ett mejl om det av sig själv.
     Bara superadmin. */
  let upplaggBesked = null;   // { id, text, ok }: kvittot efter ett skickat upplägg, visas en gång
  const ORDINARIE_KR = Number((NX.CFG && NX.CFG.PRIS_PER_TIMME) || 399);
  /* Planernas timpris, 5 % av ordinarie nedåt till hel krona (379 kr), bara
     för rutan före Skicka: databasen sätter priset ur planerna. */
  const PLANPRIS_KR = Math.floor(ORDINARIE_KR * 95 / 100);
  const upplaggTimmar = n => (Number(n) === 1 ? '1 timme' : n + ' timmar');

  function upplaggMejl(p, u) {
    const text = 'Hej!\n\nVi har lagt in ett upplägg åt er: ' + u.namn + ', ' + upplaggTimmar(u.timmar) + ' för '
      + kronor(u.pris_ore) + ' (' + kronor(u.timpris_ore) + ' i timmen, planernas pris). Ni köper det när ni loggar in '
      + 'på nextrum.se/foralder, under Betalning & planer, senast ' + datumText(u.giltigt_till) + '. Timmarna gäller i 30 '
      + 'dagar från köpet, som en plan, och samma villkor gäller.\n\nHör av er om ni har frågor!\n\nVänliga hälsningar\nNextrum';
    return gmailLänk(p.email || '', 'Ett upplägg till er från Nextrum', text);
  }

  function dpUpplagg(p, d) {
    if (!fullAdmin() || d.upplaggSaknas) return '';
    const idag = isoFor(new Date());
    const rader = d.upplaggFel ? tomt('Uppläggen gick inte att läsa', d.upplaggFel)
      : (d.upplagg || []).map(u => {
        const väntar = !u.kopt_at && !u.aterkallad_at && String(u.giltigt_till) >= idag;
        const lägeTxt = u.kopt_at ? pill('Köpt ' + kortDatum(u.kopt_at), 'ar-klar')
          : u.aterkallad_at ? pill('Tillbakadraget', '') : väntar ? pill('Väntar på familjen', 'ar-vantar') : pill('Gick ut', '');
        const knappar = väntar
          ? ' <a class="btn btn-ghost btn-sm" href="' + esc(upplaggMejl(p, u)) + '" target="_blank" rel="noopener">Skriv i Gmail</a>'
            + ' <button class="btn btn-ghost btn-sm" type="button" data-dp-upplagg-bort="' + esc(u.id) + '">Dra tillbaka</button>'
          : '';
        return dpRad(u.namn + ': ' + upplaggTimmar(u.timmar) + ', ' + kronor(u.pris_ore),
          kronor(u.timpris_ore) + ' i timmen · skickat ' + kortDatum(u.skapad_at)
            + (väntar ? ' · köps senast ' + kortDatum(u.giltigt_till) : ''),
          lägeTxt + knappar);
      }).join('');
    const besked = upplaggBesked && upplaggBesked.id === p.id ? upplaggBesked : null;
    upplaggBesked = null;
    return dpRubrik('Egna upplägg', 'en plan med egna timmar, samma pris och villkor')
      + (rader || tomt('Inga upplägg', 'Skicka ett nedan, till exempel timmar för ett lov.'))
      + '<form class="dp-gratis dp-upplagg" data-dp-upplagg="' + esc(p.id) + '">'
      + '<b class="dp-gratis-rubrik">Skicka ett upplägg</b>'
      + '<div class="dp-gratis-falt"><label for="dp-upp-timmar">Timmar</label>'
      + '<input class="inp" id="dp-upp-timmar" name="timmar" type="number" min="1" max="40" step="1" inputmode="numeric" value="6" required></div>'
      + '<div class="dp-gratis-falt dp-gratis-orsak"><label for="dp-upp-namn">Namn, som familjen ser</label>'
      + '<input class="inp" id="dp-upp-namn" name="namn" maxlength="60" autocomplete="off" placeholder="Till exempel: Höstlovet"></div>'
      + '<div class="dp-gratis-falt"><label for="dp-upp-dagar">Kan köpas i dagar</label>'
      + '<input class="inp" id="dp-upp-dagar" name="dagar" type="number" min="1" max="60" step="1" inputmode="numeric" value="14" required></div>'
      + '<button class="btn btn-primary" type="submit">Skicka</button>'
      + '<span class="dp-gratis-not">Familjen får ett mejl om upplägget, ser det under Betalning & planer och köper det '
      + 'med kort eller Klarna, en gång: när det är köpt försvinner det, och vill de ha ett till skickar ni ett nytt. '
      + 'Det är en plan med andra timmar: planernas timpris, ' + PLANPRIS_KR + ' kr i dag, timmarna gäller i 30 dagar '
      + 'från köpet, och villkoren, familjerabatten, rabattkoderna och Köp till timmar är planens. Namnet ser familjen, '
      + 'och det står på kvittot: skriv vad det är, inget om barnet.</span>'
      + (besked ? '<p class="ok-msg show' + (besked.ok ? '' : ' is-err') + '">' + esc(besked.text) + '</p>' : '')
      + '</form>';
  }

  async function efterUpplagg(id, text, ok) {
    upplaggBesked = { id, text, ok };
    delete S.detaljCache['familj:' + id];
    await hämtaDetalj('familj', id);
    if (DP.typ === 'familj' && DP.id === id) ritaDetalj();
  }

  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-dp-upplagg]');
    if (!f) return;
    ev.preventDefault();
    const id = f.dataset.dpUpplagg;
    const timmar = Number(String(f.elements.timmar.value).trim());
    const dagar = Number(String(f.elements.dagar.value).trim());
    const namn = String(f.elements.namn.value || '').trim();
    if (!Number.isInteger(timmar) || timmar < 1 || timmar > 40) { alert('Välj mellan 1 och 40 timmar.'); return; }
    if (!Number.isInteger(dagar) || dagar < 1 || dagar > 60) { alert('Familjen kan köpa upplägget i 1–60 dagar.'); return; }
    const visas = namn || upplaggTimmar(timmar);
    const ja = await bekräfta({
      titel: 'Skicka ' + visas + ' till ' + namnFör(id) + '?',
      text: upplaggTimmar(timmar) + ' för ' + kronor(timmar * PLANPRIS_KR * 100) + ' (planernas ' + PLANPRIS_KR
        + ' kr i timmen, före en familjerabatt och en kod). Familjen får ett mejl om det och kan köpa det i ' + dagar
        + ' dagar, och timmarna gäller sedan i 30 dagar från köpet, som en plan. Upplägget ändras inte när det '
        + 'skickats, men ni kan dra tillbaka det tills det köpts.',
      knapp: 'Skicka upplägget'
    });
    if (!ja) return;
    await medan(f.querySelector('button[type="submit"]'), 'Skickar…', async () => {
      const { error } = await supa.rpc('skicka_eget_upplagg', {
        p_familj: id, p_timmar: timmar, p_namn: namn || null, p_dagar: dagar
      });
      if (error) {
        await efterUpplagg(id, 'Kunde inte skicka: ' + (error.code === 'PGRST202'
          ? 'funktionen finns inte i databasen än (migrationen egna_upplagg).' : felText(error)), false);
        return;
      }
      await efterUpplagg(id, visas + ' är skickat. Familjen får ett mejl om några minuter och ser det under Betalning & planer.', true);
    });
  });

  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-upplagg-bort]');
    if (!k) return;
    const familj = DP.typ === 'familj' ? DP.id : null;
    if (!familj) return;
    const ja = await bekräfta({
      titel: 'Dra tillbaka upplägget?',
      text: namnFör(familj) + ' ser det inte längre och kan inte köpa det, och har mejlet inte gått än går det inte. '
        + 'Står en kassa redan öppen och betalas ändå står köpet, och det blir en uppgift under Att göra.',
      knapp: 'Dra tillbaka'
    });
    if (!ja) return;
    await medan(k, 'Drar tillbaka…', async () => {
      const { data, error } = await supa.rpc('aterkalla_eget_upplagg', { p_id: k.dataset.dpUpplaggBort });
      if (error) { await efterUpplagg(familj, 'Kunde inte dra tillbaka: ' + felText(error), false); return; }
      await efterUpplagg(familj, data === true ? 'Upplägget är tillbakadraget.' : 'Upplägget var redan köpt eller tillbakadraget.', data === true);
    });
  });

  /* Familjens betalningar och återbetalningar (2026-10-27): Liggaren har
     dem, med Återbetala på passet, köpet eller raden, och Återbetalningar
     vem som betalat tillbaka och varför. Länken öppnar Liggaren med
     familjen sökt. Liggaren är superadminens. */
  function dpBetalningar(p) {
    if (!fullAdmin()) return '';
    return dpRubrik('Betalningar', 'betalas tillbaka under Liggaren')
      + dpRad('Familjens kortbetalningar', 'Varje betalning med det som gått tillbaka, och Återbetala på passet, köpet eller raden',
        '<a class="btn btn-ghost btn-sm" href="#ekonomi/liggaren" data-dp-stang data-lig-familj="'
          + esc(p.full_name || p.email || '') + '">Öppna i Liggaren</a>');
  }

  function dpRubrik(text, extra) {
    return '<div class="dp-rubrik"><span>' + esc(text) + '</span>'
      + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</div>';
  }

  function dpTal(par) {
    return '<div class="dp-tal">' + par.map(p =>
      '<div><b>' + esc(String(p[0])) + '</b><span>' + esc(p[1]) + '</span></div>').join('') + '</div>';
  }

  function dpRad(rubrik, under, höger) {
    return '<div class="dp-rad"><div><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '') + '</div>'
      + '<span class="dp-rad-hoger">' + (höger || '') + '</span></div>';
  }

  function passFör(filter) {
    return S.bokningar.filter(filter).sort((a, b) =>
      String(b.wanted_date + (b.wanted_time || ''))
        .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));
  }

  /* ------------------------------------------------------------
     KUNDTIDSLINJEN (Fas 7.1)

     Allt som hänt familjen i en enda lista, nyast först. Den svarar
     på frågan "vad har hänt med de här?", som annars kräver fem
     flikar och ett gott minne.

     INGEN HÄNDELSE HITTAS PÅ. Varje rad har en tidsstämpel ur
     databasen. Matchningen står därför INTE här: students har
     ingen kolumn som säger när den gjordes, och att använda
     radens created_at hade satt matchningen till den dag barnet
     lades in. Ett ungefärligt datum i en tidslinje är värre än
     inget datum, för det ser exakt ut.
     ------------------------------------------------------------ */
  const TL_MAX = 80;

  function tlKort(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > (max || 90) ? t.slice(0, (max || 90) - 1) + '…' : t;
  }

  /* Tidpunkten i klartext. närText säger "för 2 timmar sedan" och
     byggdes för aktivitetsflödet, som bara innehåller dåtid — för
     något som ligger framåt svarar den med enbart ett klockslag, och
     då stod "5 oktober kl. 16" som "16:00" mitt bland gårdagens
     rader. Tidslinjen innehåller både och, så framtiden får sitt
     datum utskrivet. */
  function tlNär(iso, framtid) {
    if (!framtid) return närText(iso);
    const d = new Date(iso);
    const tid = isNaN(d) ? '' : ' kl. '
      + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return kortDatum(String(iso).slice(0, 10)) + (tid === ' kl. 00:00' ? '' : tid);
  }

  function dpTidslinje(p, d) {
    const h = [];
    const lägg = (när, rubrik, under) => {
      if (när) h.push({ när: när, rubrik: rubrik, under: under || '' });
    };

    lägg(p.created_at, 'Konto skapat', p.email || '');

    (d.anmalningar || []).forEach(l => {
      lägg(l.created_at, 'Intresseanmälan',
        [l.subject, l.tjanst].filter(Boolean).join(' · '));
      lägg(l.kontaktad_at, 'Anmälan kontaktad', '');
    });

    const barn = S.elever[p.id] || [];
    barn.forEach(e => lägg(e.created_at, 'Barn inlagt', e.name || ''));

    const pass = passFör(b => b.parent_id === p.id);
    pass.forEach(b => {
      const när = b.wanted_date
        ? b.wanted_date + 'T' + String(b.wanted_time || '00:00').slice(0, 5)
        : b.created_at;
      const vad = b.status === 'completed' ? 'Pass genomfört'
        : b.status === 'cancelled' ? 'Pass avbokat'
        : 'Pass bokat';
      /* elevNamn svarar med ett tankstreck när passet inte har något
         barn valt, och det tecknet ska inte stå som ett namn. */
      const vem = elevNamn(b.student_id);
      lägg(när, vad, [vem && vem !== '—' ? vem : null, b.subject,
        (b.duration_min || 60) + ' min'].filter(Boolean).join(' · '));
    });

    (d.meddelanden || []).forEach(m => {
      /* namnFör svarar med ett tankstreck för en profil som inte
         finns kvar, aldrig med tomt — reservvärdet måste därför
         pröva tecknet, inte falsiskhet. */
      const n = namnFör(m.sender_id);
      const vem = m.sender_id === p.id ? 'Familjen skrev'
        : (n && n !== '—' ? n : 'Någon') + ' skrev';
      lägg(m.created_at, vem, tlKort(m.body, 110));
    });

    (d.noteringar || []).forEach(n =>
      lägg(n.created_at, 'Anteckning', tlKort(n.text, 110)));

    /* Uppgifter som hör till familjen, vilken rad de än pekar på.
       De ligger redan i S — ingen fråga till. */
    const mina = new Set([p.id]
      .concat((d.anmalningar || []).map(l => l.id))
      .concat(barn.map(e => e.id))
      .concat(pass.map(b => b.id)));
    (S.uppgifter || []).filter(u => u.kopplad_id && mina.has(u.kopplad_id)).forEach(u => {
      lägg(u.created_at, 'Uppgift skapad',
        tlKort(u.titel, 90) + (u.skapad_av_typ === 'manniska' ? '' : ' · automatisk'));
      lägg(u.klar_at, 'Uppgift klar', tlKort(u.titel, 90));
    });

    /* Sorteras på tidpunkt, inte på text. Passen har ingen tidszon
       ('2026-09-24T15:00' är lokal tid) medan allt annat är ISO med
       +00:00, och en strängjämförelse mellan de två lägger ett
       meddelande klockan 17 under ett pass klockan 16 samma dag —
       alltid åt samma håll, och alltid fel. */
    h.forEach(x => { x.ms = new Date(x.när).getTime(); });
    h.sort((a, b) => (b.ms || 0) - (a.ms || 0));

    const fel = [d.anmalningarFel, d.meddelandenFel].filter(Boolean);
    const varning = fel.length
      ? '<p class="xsmall" style="color:var(--fel)">Delar av tidslinjen kunde inte hämtas: '
        + esc(fel.join(' · ')) + '</p>'
      : '';

    if (!h.length) {
      return varning + tomt('Inget har hänt än',
        'Anmälan, pass och meddelanden dyker upp här allteftersom.');
    }

    /* "Nytt" betyder det senaste dygnet, inte framtiden. Ett pass om
       två veckor är inte en nyhet, och utan den övre gränsen blev
       det den prick som lyste starkast i hela tidslinjen. */
    const nu = Date.now();
    const dygnet = nu - 86400000;
    return varning
      + '<div class="adm-flode">' + h.slice(0, TL_MAX).map(x =>
        '<div class="adm-flode-post'
        + (x.ms > dygnet && x.ms <= nu ? ' ar-ny' : '') + '">'
        + '<span class="adm-flode-nar">' + esc(tlNär(x.när, x.ms > nu)) + '</span>'
        + '<span class="adm-flode-text"><b>' + esc(x.rubrik) + '</b>'
        + '<span>' + esc(x.under) + '</span></span>'
        + '</div>').join('') + '</div>'
      /* Meddelandena är hämtade med limit 60. Står det bara "de 80
         senaste av N" ser N ut som hela sanningen, och den som letar
         efter ett äldre meddelande letar förgäves utan att förstå
         varför. */
      + (h.length > TL_MAX
        ? '<p class="xsmall">Visar de ' + TL_MAX + ' senaste av ' + h.length + ' händelser.</p>'
        : '')
      + ((d.meddelanden || []).length >= 60
        ? '<p class="xsmall">Bara de 60 senaste meddelandena är med. Hela tråden finns under Kommunikation.</p>'
        : '');
  }

  function passLista(pass, visaVem) {
    if (!pass.length) return tomt('Inga pass', 'Bokade pass dyker upp här.');
    return pass.slice(0, 30).map(b => dpRad(
      kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
      [b.subject, b.format, (b.duration_min || 60) + ' min',
        visaVem ? visaVem(b) : null].filter(Boolean).join(' · '),
      läge(BOK_LAGE, b.status)
        + ' <button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(b.id) + '">Öppna</button>')).join('');
  }

  /* ------------------------------------------------------------
     PASSET (Fas 20.1 och 20.2)

     Vad som bokades, vad som hölls och vad det kostar. Den hållna
     tiden är studiehjälparens egen uppgift i rapporten, och skälet till
     en avvikelse är hens fritext: det escapas som allt annat, och det
     visas bara här och för familjen, aldrig i ett mejl.

     Talen för betalt och lön kommer ur passunderlag, samma vy som
     månadskörningen och bokslutet räknar på. Att räkna dem en gång
     till här hade gett en tredje definition av samma minuter.
     ------------------------------------------------------------ */
  const minText = m => m == null ? '—' : m + ' min';

  function dpPass(b, d) {
    const pu = (S.passunderlag || []).find(p => p.id === b.id) || null;
    const extra = (d.pass || [])[0] || {};
    const rapporter = d.rapporter || [];
    const rapport = rapporter.find(r => r.start_tid) || rapporter[0] || null;
    const tillägg = (d.tillagg || [])[0] || null;
    const rabatt = Number(((d.passRabatt || [])[0] || {}).familjerabatt_ore || 0);
    const bokat = b.duration_min || 60;
    const klock = t => String(t || '').slice(0, 5);
    const knapp = (typ, id, text) => '<button class="btn btn-ghost btn-sm" type="button" data-dp="'
      + typ + ':' + esc(id) + '">' + esc(text) + '</button>';

    let h = dpFakta([
      ['När', esc(kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + klock(b.wanted_time) : ''))],
      ['Bokat', esc(NXBetalning.timmar(bokat) + ' (' + bokat + ' min)')],
      ['Ämne', b.subject ? esc(b.subject) : null],
      ['Elev', b.student_id ? knapp('elev', b.student_id, elevNamn(b.student_id)) : null, 'inget barn valt'],
      ['Familj', b.parent_id ? knapp('familj', b.parent_id, namnFör(b.parent_id)) : null],
      ['Studiehjälpare', b.tutor_id ? knapp('studiehjalpare', b.tutor_id, namnFör(b.tutor_id)) : null, 'ingen'],
      /* Priset som frystes när passet bokades (Fas 19.5), och sedan
         2026-10-15 familjens rabatt som redan är dragen i det. */
      ['Timpris', b.timpris_ore != null ? esc(kronor(b.timpris_ore) + ' per timme'
        + (rabatt > 0 ? ', med familjerabatten ' + kronor(rabatt) + ' dragen' : '')) : null, 'fryses när passet bokas'],
      ['Betalning', esc((KORT_LAGE[b.betalning_status || 'ingen'] || b.betalning_status)
        + (b.klippkort_id ? ', med timmar' : '')
        + (b.betalt_ore != null ? ' · ' + kronor(b.betalt_ore) : '')
        + (extra.stripe_minuter ? ' för ' + minText(extra.stripe_minuter) : '')
        + (Number(b.aterbetald_ore || 0) > 0 ? ' · ' + kronor(b.aterbetald_ore) + ' tillbaka' : ''))
        + (b.stripe_skarp === false ? ' ' + pill('Test', '') : '')]
    ]);

    h += dpRubrik('Hållen tid');
    if (d.rapporterFel) {
      h += tomt('Rapporten gick inte att läsa', d.rapporterFel);
    } else if (!rapport) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Ingen rapport än. '
        + 'Studiehjälparen skriver in tiden med rapporten.</p>';
    } else if (!rapport.start_tid) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Rapporten har ingen tid, så det bokade gäller: '
        + esc(minText(bokat)) + '.</p>';
    } else {
      const deb = rapport.debiterade_min;
      const skillnad = deb - bokat;
      h += dpFakta([
        ['Hölls', esc(klock(rapport.start_tid) + '–' + klock(rapport.slut_tid) + ' (' + minText(rapport.hallna_min) + ')')],
        ['Debiteras', esc(minText(deb) + ' mot ' + bokat + ' bokade')
          + (skillnad ? ' ' + pill((skillnad > 0 ? '+' : '−') + Math.abs(skillnad) + ' min', 'ar-vantar') : '')],
        ['Skäl', rapport.avvikelse_skal ? esc(rapport.avvikelse_skal) : null,
          skillnad ? 'inget skäl angivet' : 'ingen avvikelse']
      ]);
    }
    if (pu) {
      h += dpFakta([
        ['Familjen har betalat för', esc(minText(pu.betalda_min))],
        ['Studiehjälparen får lön för', esc(minText(pu.lon_min))]
      ]);
    }

    h += dpRubrik('Tillägg för övertid');
    if (d.tillaggFel) {
      h += tomt('Tillägget gick inte att läsa', d.tillaggFel);
    } else if (!tillägg) {
      h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Inget tillägg.</p>';
    } else {
      const l = TILLAGG_LAGE[tillägg.status] || [tillägg.status, ''];
      h += dpFakta([
        ['Läge', pill(l[0], l[1]) + (tillägg.stripe_skarp === false ? ' ' + pill('Test', '') : '')],
        ['Övertid', esc(minText(tillägg.minuter))],
        ['Begärt', esc(kronor(tillägg.begart_ore))],
        ['Betalt', tillägg.betalt_ore != null
          ? esc(kronor(tillägg.betalt_ore) + (tillägg.betald_at ? ' · ' + kortDatum(tillägg.betald_at) : '')) : null, 'inte betalt'],
        ['Återbetalt', Number(tillägg.aterbetald_ore || 0) > 0 ? esc(kronor(tillägg.aterbetald_ore)) : null, 'inget']
      ]);
    }

    /* Sen avbokning (sen_avbokning, 2026-10-22): passet räknas som hållet i
       halva tiden, och familjen betalar det eller fick tiden dragen ur
       timmarna. Bara superadmin efterskänker avgiften (stampla_avbokningen
       prövar is_admin()), och då är passet en vanlig avbokning igen. */
    const sen = (d.passSen || [])[0] || null;
    if (b.status === 'cancelled' && sen && (sen.sen_avbokning_minuter != null || sen.avbokad_for_familjen)) {
      const medTimmar = b.klippkort_id || (S.timbankPass && S.timbankPass.has(b.id));
      h += dpRubrik('Sen avbokning');
      if (sen.sen_avbokning_minuter == null) {
        h += '<p class="xsmall" style="color:var(--bl-3);margin:0 0 14px">Avbokat av oss på familjens begäran, utan '
          + 'avgift: den är efterskänkt, eller så bokades passet innan familjen godkänt villkoren med regeln.</p>';
      } else {
        const avgift = Number(sen.sen_avbokning_ore || 0);
        h += dpFakta([
          ['Räknas som hållet', esc(minText(sen.sen_avbokning_minuter) + ' av ' + bokat + ' bokade')],
          ['Avgift', avgift > 0 ? esc(kronor(avgift)) : null,
            medTimmar ? 'ingen: tiden drogs ur timmarna' : 'ingen: timmen var på köpet'],
          ['Avbokades', esc(sen.avbokad_for_familjen ? 'av oss, på familjens begäran' : 'av familjen')]
        ]);
        if (ärSuperadmin()) {
          h += '<div class="dp-atgard"><button class="btn btn-ghost btn-sm" type="button" data-dp-sen-efterskank="'
            + esc(b.id) + '">Efterskänk avgiften</button></div>';
        }
      }
    }

    /* Larmen för just det här passet, med samma ord som i Ekonomi. */
    const larm = (S.avvikelser || []).filter(a => a.objekt_tabell === 'bookings' && a.objekt_id === b.id);
    if (larm.length) {
      const text = a => (NXAdmin.rita.avvText ? NXAdmin.rita.avvText(a) : [a.typ, '']);
      h += dpRubrik('Larm', String(larm.length))
        + larm.map(a => dpRad(text(a)[0], text(a)[1], '')).join('');
    }
    return h;
  }

  /* Samma fem steg och samma ord som studievyerna (NXStudie.STEG).
     Här stod förr en egen tabell över de tre gamla nivåerna, och den
     hade redan en gång visat råvärdet i stället för texten för att
     nycklarna inte stämde. Färgen följer steget: rött är långt kvar,
     grönt är säkert. */
  function stegPill(x) {
    const st = NXStudie.stegFör(x);
    return pill(NXStudie.stegText(st), st >= 4 ? 'ar-klar' : st === 3 ? 'ar-vantar' : 'ar-ny');
  }

  /* ------------------------------------------------------------
     DOKUMENTEN (2026-09-29)

     Avtalen och det andra under System → Dokument som gäller
     personen, och om hen ser dem i sin egen vy. Samma rader som där
     (S.handlingar, hämtade när vyn startar), samma Öppna, och en länk
     dit med personen redan vald. Leo: "anställningsavtal med lärare
     eller annat avtal med kund" — den som öppnar personen ska se att
     avtalet finns utan att leta i en annan lista. Ett avtal som
     klistrats in som text (2026-10-05) öppnas likadant: Öppna visar
     texten i samma ruta som under System → Dokument, och sedan
     2026-10-26 skärmdumparna (dokument_med_bilder).
     ------------------------------------------------------------ */
  function dpDokument(p) {
    const egna = (S.handlingar || []).filter(h => h.kopplad_tabell === 'profiles' && h.kopplad_id === p.id);
    const rader = egna.map(h => dpRad(h.titel,
      [kör('dokTyp', h.typ), h.delad_med_personen ? 'ser det i sin vy' : 'bara vi ser det',
       h.giltig_till ? 'giltigt till ' + kortDatum(h.giltig_till) : null].filter(Boolean).join(' · '),
      h.fil || typeof h.innehall === 'string' || (Array.isArray(h.bilder) && h.bilder.length)
        ? '<button class="btn btn-ghost btn-sm" type="button" data-dok-oppna="' + esc(h.id) + '">Öppna</button>' : ''
    )).join('');
    return dpRubrik('Dokument', egna.length ? String(egna.length) : '')
      + (S.handlingarFel ? tomt('Dokumenten gick inte att läsa', S.handlingarFel)
        : rader || '<p class="xsmall" style="color:var(--bl-3);margin:0 0 12px">Inga dokument.</p>')
      // Dokumenten under System är superadminens: för andra är länken död.
      + (ärSuperadmin()
        ? '<div class="dp-atgard"><a class="btn btn-ghost btn-sm" href="#system/dokument" data-dok-ny="'
          + esc(p.id) + '" data-dp-stang>Lägg till ett dokument</a></div>'
        : '');
  }

  /* ------------------------------------------------------------
     CHATTEN (2026-09-29)

     Leo: "vi på admin ska kunna gå in i elevers och lärares chattar
     utan att de ser det. det gör vi från vår admin genom att trycka på
     öppna chatt".

     Tråden läses genom chatt_las() och aldrig genom NXKontakt.tråd().
     Den markerar det den visar som läst, och i adminvyn hade det varit
     vår läsning som tog bort "oläst" hos den som skrev: ett kvitto på
     att mottagaren läst något hen aldrig sett. Databasen nekar det ändå
     (admin har ingen update-policy på messages), men vyn försöker inte
     ens. Ingen Realtime-kanal och ingen skrivruta heller: vi läser, vi
     deltar inte i samtalet.

     Osynligt för dem är inte hemligt för dem. Att vi kan läsa chatten
     står i integritetspolicyn, och varje öppning står i auditloggen
     (chatt.oppnad), skriven av funktionen i samma transaktion som
     läsningen.
     ------------------------------------------------------------ */

  /* Raderna som säger vilka trådar en person har. PostgREST lämnar ändå
     inte ut fler i ett svar, och en familj med över tusen meddelanden
     har sina studiehjälpare bland dem. */
  const TRAD_MAX = 1000;

  function klockslag(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* "Idag" och "Igår", som tråden i vyerna (NXKontakt.dagText, som
     adminvyn inte laddar), men på den svenska dagen: ett meddelande
     klockan halv ett på natten hör till den dag det skrevs. */
  function chattDag(iso) {
    const dag = isoFor(new Date(iso));
    const igår = new Date(); igår.setDate(igår.getDate() - 1);
    if (dag === isoFor(new Date())) return 'Idag';
    if (dag === isoFor(igår)) return 'Igår';
    return datumText(dag);
  }

  function dpChatt(t, d) {
    if (d.chattSaknas) {
      return tomt('Chatten går inte att öppna än',
        'Funktionen chatt_las finns inte i databasen: migrationen admin_oppnar_chatten är inte körd. '
        + 'Ingenting har lästs.');
    }
    if (d.chattFel) return tomt('Chatten gick inte att hämta', d.chattFel);

    /* Nyast först ur databasen, äldst först här: tråden läses uppifrån
       och ned, som i vyerna. */
    const rader = (d.chatt || []).slice().reverse();
    const totalt = rader.length ? (Number(rader[0].totalt) || rader.length) : 0;
    /* Namnet under varje bubbla. I vyerna säger sidan vem som skrev
       (egna till höger); här finns inget "jag". */
    const vem = id => {
      const n = namnFör(id);
      if (n && n !== '—') return n.split(' ')[0];
      return id === t.hjälpare ? 'Studiehjälparen' : 'Familjen';
    };
    const namn = (id, reserv) => {
      const n = namnFör(id);
      return n && n !== '—' ? n : reserv;
    };

    let h = '<p class="dp-chatt-not">Bara läsning. Familjen och studiehjälparen ser inte att du läser: '
      + 'ingenting markeras som läst och ingen notis går ut. Att du öppnade chatten står i '
      + 'auditloggen, utan texten.</p>';

    if (!rader.length) {
      h += '<div style="margin-top:16px">'
        + tomt('Inga meddelanden än', 'Tråden fylls när familjen eller studiehjälparen skriver.') + '</div>';
    } else {
      if (totalt > rader.length) {
        h += '<p class="xsmall" style="color:var(--bl-3);margin:12px 0 0">Visar de ' + rader.length
          + ' senaste av ' + totalt + ' meddelanden.</p>';
      }
      h += '<div class="tr">';
      let förraDagen = '';
      rader.forEach(m => {
        const dag = chattDag(m.created_at);
        if (dag !== förraDagen) { h += '<div class="tr-dag">' + esc(dag) + '</div>'; förraDagen = dag; }
        /* Familjen till vänster, studiehjälparen till höger. */
        h += '<div class="tr-rad ' + (m.sender_id === t.hjälpare ? 'min' : 'deras') + '">'
          + '<div class="tr-bubbla">' + esc(m.body) + '</div>'
          + '<span class="tr-tid">' + esc(vem(m.sender_id) + ' · ' + klockslag(m.created_at))
          + (m.read_at ? '' : ' · <span class="oläst" title="Mottagaren har inte öppnat det än">oläst</span>')
          + '</span></div>';
      });
      h += '</div>';
    }

    h += dpBarnchatt(t, d);

    return h + '<div class="dp-atgard" style="margin-top:22px">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(t.förälder) + '">'
      + esc(namn(t.förälder, 'Familjen')) + '</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp="studiehjalpare:' + esc(t.hjälpare) + '">'
      + esc(namn(t.hjälpare, 'Studiehjälparen')) + '</button>'
      + '</div>';
  }

  /* Barnens trådar med studiehjälparen (barnets_chatt, 2026-10-06): en
     per barn med egen inloggning, under familjens. Samma läsning som
     ovan: ingenting markeras som läst, och öppningen står i loggen.
     Utan funktionen i databasen, eller utan trådar, står ingenting. */
  function dpBarnchatt(t, d) {
    if (d.barnchattSaknas) return '';
    if (d.barnchattFel) return '<div style="margin-top:20px">' + tomt('Barnens trådar gick inte att hämta', d.barnchattFel) + '</div>';
    const rader = (d.barnchatt || []).slice().reverse();
    if (!rader.length) return '';
    const totalt = Number(rader[0].totalt) || rader.length;
    const perBarn = {};
    rader.forEach(m => { (perBarn[m.student_id] = perBarn[m.student_id] || []).push(m); });
    const hjälpare = (namnFör(t.hjälpare) || 'Studiehjälparen').split(' ')[0];
    let h = dpRubrik('Barnens trådar', totalt > rader.length ? 'de ' + rader.length + ' senaste av ' + totalt : '');
    Object.keys(perBarn).forEach(id => {
      const e = (S.elevlista || []).find(x => x.id === id);
      const barn = e ? String(e.name || 'Barnet').split(' ')[0] : 'Barnet';
      h += '<p class="bc-barn-namn" style="margin-top:12px">' + esc(barn) + ', i sin egen inloggning</p><div class="tr">';
      let förraDagen = '';
      perBarn[id].forEach(m => {
        const dag = chattDag(m.created_at);
        if (dag !== förraDagen) { h += '<div class="tr-dag">' + esc(dag) + '</div>'; förraDagen = dag; }
        /* Barnet till vänster, studiehjälparen till höger, som ovan. */
        h += '<div class="tr-rad ' + (m.fran === 'studiehjalpare' ? 'min' : 'deras') + '">'
          + '<div class="tr-bubbla">' + esc(m.body) + '</div>'
          + '<span class="tr-tid">' + esc((m.fran === 'studiehjalpare' ? hjälpare : barn) + ' · ' + klockslag(m.created_at))
          + (m.read_at ? '' : ' · <span class="oläst" title="Mottagaren har inte öppnat det än">oläst</span>')
          + '</span></div>';
      });
      h += '</div>';
    });
    return '<div style="margin-top:20px">' + h + '</div>';
  }

  /* Trådarna på en familjs eller en studiehjälpares Översikt, med Öppna
     chatt på var och en. En tråd finns när någon skrivit, och kan
     finnas när de är matchade: då står den med utan datum, så att det
     syns att ingen skrivit. Vem och när, aldrig texten. */
  function dpChattar(p, d, sort) {
    const ärFamilj = sort === 'familj';
    const motpart = ärFamilj ? 'tutor_id' : 'parent_id';
    const trådar = {};
    /* Nyast först, så den första raden per motpart är den senaste. */
    (d.tradar || []).forEach(m => {
      const id = m[motpart];
      if (id && !trådar[id]) trådar[id] = { id: id, senast: m.created_at };
    });
    const matchade = ärFamilj
      ? (S.elever[p.id] || []).filter(e => e.matched_tutor_id && e.match_status === 'matched')
          .map(e => e.matched_tutor_id)
      : S.elevlista.filter(e => e.matched_tutor_id === p.id && e.match_status === 'matched')
          .map(e => e.parent_id);
    matchade.forEach(id => { if (id && !trådar[id]) trådar[id] = { id: id, senast: null }; });

    const lista = Object.values(trådar).sort((a, b) =>
      String(b.senast || '').localeCompare(String(a.senast || ''))
      || namnFör(a.id).localeCompare(namnFör(b.id), 'sv'));

    const rader = lista.map(t => dpRad(namnFör(t.id),
      t.senast ? 'senast ' + kortDatum(t.senast) : 'ingen har skrivit än',
      // chatt_las och barnchatt_las släpper bara fram en superadmin.
      ärSuperadmin()
        ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="chatt:'
          + esc(ärFamilj ? p.id + '|' + t.id : t.id + '|' + p.id) + '">Öppna chatt</button>'
        : '')).join('');

    return dpRubrik('Chatt', lista.length > 1 ? lista.length + ' trådar' : '')
      + (d.tradarFel ? tomt('Chattarna gick inte att läsa', d.tradarFel)
        : rader || '<p class="xsmall" style="color:var(--bl-3);margin:0 0 12px">'
          + (ärFamilj ? 'Ingen studiehjälpare och ingen tråd än.' : 'Inga elever och ingen tråd än.') + '</p>');
  }

  /* Intagen (2026-10-21): när familjen togs in och varifrån den kom, ur
     anmälan som flyttades hit (intagna_anmalningar). En familj som togs
     in före flytten, eller utan anmälan, har bara raden Intagen. */
  function dpIntagen(p) {
    const r = (S.intagenFör || {})[p.id];
    if (!r) return [];
    return [
      ['Intagen', esc(kortDatum(r.intagen_at)) + (r.anmald_at ? ' <span class="xsmall">anmälde sig '
        + esc(kortDatum(r.anmald_at)) + '</span>' : '')],
      ['Kom via', kör('källText', r) ? '<span title="' + esc(kör('källTitel', r) || '') + '">'
        + esc(kör('källText', r)) + '</span>' : null, 'okänt'],
      ['Kod', r.kod ? esc(r.kod) : null, 'ingen'],
      ['Ur anmälan', r.meddelande ? '<div class="dp-text">' + esc(r.meddelande) + '</div>' : null,
        'gallrat eller tomt']
    ];
  }

  function dpFamilj(p, d) {
    const barn = S.elever[p.id] || [];
    const pass = passFör(b => b.parent_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const idag = isoFor(new Date());
    const nästa = pass.filter(b => b.wanted_date >= idag && b.status !== 'cancelled').pop();

    if (DP.flik === 'barn') {
      if (!barn.length) return tomt('Inga barn inlagda', 'Familjen lägger till dem i studievyn.');
      return barn.map(e => {
        const t = elevHjälpare(e);
        return '<div class="dp-rad"><div>'
          + '<b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, e.school, (e.subjects || []).join(', ')]
              .filter(Boolean).join(' · ') || 'Inga uppgifter') + '</span>'
          + '<span>' + (t ? 'Studiehjälpare: ' + esc(t.full_name || t.email || '—')
                          : 'Ingen studiehjälpare') + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + (t ? pill('Matchad', 'ar-klar') : pill('Ej matchad', 'ar-ny')) + ' '
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    /* Med vem (2026-10-06): Leo ville se när och med vem familjen hade
       sina pass, och raden sa bara vilket barn. */
    if (DP.flik === 'pass') return passLista(pass, b => [elevNamn(b.student_id),
      b.tutor_id ? 'med ' + namnFör(b.tutor_id) : null].filter(v => v && v !== '—').join(' · '));

    if (DP.flik === 'ekonomi') {
      /* Fakturorna och fakturaspärren stod här från Fas 14.6 till
         2026-10-21. Nu: hur passen är betalda, timbanken, rabatten och
         kortet. Obetalda är avvikelsen ej_betalt, samma som Att göra. */
      const obetalda = (S.avvikelser || []).filter(a => a.typ === 'ej_betalt' && a.kund_id === p.id).length;
      const betalda = pass.filter(b => b.betalning_status === 'betald' || b.betalning_status === 'tvist').length;
      return dpTal([
        [obetalda, 'Hållna, inte betalda'],
        [betalda, 'Betalda pass']
      ])
      + dpTimbank(p, d)
      + dpRabatt(p)
      + dpPartner(p)
      + dpUpplagg(p, d)
      + dpKortet(p, d)
      + dpBetalningar(p);
    }

    if (DP.flik === 'tidslinje') return dpTidslinje(p, d);

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    /* Utestående var de skickade fakturorna till 2026-10-21. Nu är det
       de hållna passen som inte är betalda, som under Ekonomi. */
    return dpTal([
      [barn.length, barn.length === 1 ? 'Barn' : 'Barn'],
      [genomförda.length, 'Genomförda pass'],
      [(S.avvikelser || []).filter(a => a.typ === 'ej_betalt' && a.kund_id === p.id).length, 'Hållna, inte betalda']
    ])
    + dpRubrik('Kontakt')
    + dpFakta([
      ['E-post', dpMejl(p.email)],
      ['Telefon', dpTelefon(p.phone)],
      ['Konto skapat', p.created_at ? esc(kortDatum(p.created_at)) : null],
      ...dpIntagen(p),
      ['Senast inloggad', dpSenast(p)],
      ['Användarvillkoren', dpVillkor(d), 'okänt'],
      ...(fullAdmin() ? [['Timbanken', dpTimbankKort(p), 'okänt'], ['Familjerabatt', dpRabattKort(p), 'okänt']] : []),
      ...(fullAdmin() && familjensPartner(p) ? [['Partner', esc(familjensPartner(p).partner), 'okänt']] : []),
      ['Om familjen', p.bio ? esc(p.bio) : null]
    ])
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [elevNamn(nästa.student_id), nästa.subject, namnFör(nästa.tutor_id)]
            .filter(Boolean).join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'))
    /* När och med vem (2026-10-06): de senaste hållna passen. */
    + dpRubrik('Senaste passen', genomförda.length > 5 ? 'alla under Pass' : '')
    + (genomförda.length
      ? genomförda.slice(0, 5).map(b => dpRad(kortDatum(b.wanted_date)
          + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
          [b.tutor_id ? 'med ' + namnFör(b.tutor_id) : 'ingen studiehjälpare', b.subject, elevNamn(b.student_id)]
            .filter(v => v && v !== '—').join(' · '),
          '<button class="btn btn-ghost btn-sm" type="button" data-dp="pass:' + esc(b.id) + '">Öppna</button>')).join('')
      : tomt('Inga hållna pass än', 'Ett pass står här när det är genomfört.'))
    + dpChattar(p, d, 'familj')
    + dpDokument(p)
    + dpHantera('familj', p, {
        rubrik: 'Radera familjen',
        text: 'När familjen inte vill ha tjänsten längre. Kontot, barnen, chatten och det de skrivit '
          + 'tas bort ur våra system. Pass som hållits eller betalats står kvar utan namn, för '
          + 'bokföringen. Rutan säger exakt vad innan något händer.'
      });
  }

  /* Betygsgarantin (2026-10-07): ämnena föräldern anmält under Profil,
     läsår för läsår, med betyget hen angav. Vid ett anspråk är det
     kopian som gäller. Ett fel (tabellen saknas, eller policyn ger inte
     den här admin raderna) ger ingen rubrik alls i stället för ett fel
     mitt i eleven.

     Familjen kan inte ändra en anmälan; vi rättar den här (Leo: "bara vi
     kan ändra den och då står det senast ändrad"). Knappen står för den
     som får redigera personer, och databasen prövar det igen
     (andra_betygsgaranti). Ett gallrat betyg rättas inte. */
  const kanRättaGaranti = () => får('anvandare_redigera');

  function dpGaranti(d) {
    if (d.garantierFel) return '';
    const g = d.garantier || [];
    const läsår = läsårText;
    const kanRätta = kanRättaGaranti();
    const åren = [...new Set(g.map(x => x.lasar))].sort();
    const val = (lista, nu) => lista.map(v => '<option' + (v === nu ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
    return dpRubrik('Betygsgaranti', g.length ? 'låst för familjen' : '')
      + (g.length
        ? g.map(x => dpRad(x.amne,
            'läsåret ' + läsår(x.lasar) + ' · anmäld ' + kortDatum(x.anmald_at)
              + (x.andrad_at ? ' · senast ändrad ' + kortDatum(x.andrad_at) : ''),
            pill(x.betyg ? 'Betyg ' + x.betyg : 'Betyget gallrat', '')
              + (kanRätta && x.betyg ? ' <button class="btn btn-ghost btn-sm" type="button" data-dp-garanti-ratta="'
                + esc(x.id) + '">Rätta</button>' : ''))
            + (kanRätta && x.betyg
              ? '<form data-dp-garanti="' + esc(x.id) + '" hidden style="margin:4px 0 14px">'
                + '<div class="vy-form-rad">'
                + '<div class="fgroup"><label for="dpg-a-' + esc(x.id) + '">Ämne</label>'
                + '<select class="sel" id="dpg-a-' + esc(x.id) + '" name="amne">' + val(NX.GARANTI_AMNEN, x.amne) + '</select></div>'
                + '<div class="fgroup"><label for="dpg-b-' + esc(x.id) + '">Betyg vid anmälan</label>'
                + '<select class="sel" id="dpg-b-' + esc(x.id) + '" name="betyg">' + val(['F', 'E', 'D', 'C', 'B'], x.betyg) + '</select></div>'
                + '</div>'
                + '<p class="xsmall" style="margin:6px 0 0;color:var(--muted-2);line-height:1.5">Familjen ser att '
                + 'anmälan är ändrad och när, men inte av vem.</p>'
                + '<button class="btn btn-primary btn-sm" type="submit" style="margin-top:9px">Spara rättelsen</button>'
                + '<p class="ok-msg" data-dp-garanti-msg></p></form>'
              : '')).join('')
          /* Prövningen av ett anspråk, ett läsår i taget. Bara superadmin. */
          + (ärSuperadmin() ? åren.map(år => '<div class="dp-atgard">'
              + '<button class="btn btn-ghost btn-sm" type="button" data-dp-garanti-prova="' + esc(år) + '">'
              + (underlag[DP.id + ':' + år] ? 'Räkna om underlaget för ' : 'Pröva ett anspråk för ') + 'läsåret '
              + esc(läsår(år)) + '</button></div>' + dpUnderlag(DP.id, år)).join('') : '')
        : tomt('Ingen anmäld', 'Föräldern anmäler den under Profil i studievyn, senast den 31 december.'));
  }

  /* PRÖVNINGEN AV ETT ANSPRÅK (betygsgarantin_provas, 2026-10-15). Villkoren
     säger att vi prövar "bara det som står här, ur det som står i er vy:
     hållen tid, rapporterna, uteblivna pass, uppgifterna och
     betalningarna". betygsgaranti_underlag räknar det, och det som inte
     går att räkna står sist under Bedöms av er, i villkorens ordning.
     Underlaget står kvar i panelen tills sidan laddas om, och räknas om
     vid nästa tryck. */
  const underlag = {};   // 'elev:läsår' → svaret, eller { fel }

  function läsårText(år) { return år + '/' + String((år + 1) % 100).padStart(2, '0'); }

  function timText(min) {
    const h = Math.floor(Number(min) / 60), m = Number(min) % 60;
    return h && m ? h + ' h ' + m + ' min' : h ? h + ' h' : m + ' min';
  }

  /* Veckans nummer, ISO 8601, ur måndagens datum. */
  function veckoNr(iso) {
    const t = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
    return Math.ceil(((t - jan1) / 864e5 + 1) / 7);
  }

  const BEDÖMS = [
    'Betyget som räknas: årskursens sista betyg, ur kopian, jämfört med betyget vid anmälan (eller kopian av det).',
    'Vilka veckor som var lov eller efter skolavslutningen: de står med ovan, och räknas inte.',
    'En vecka med för lite som vi eller studiehjälparen avbokade: då räcker det att familjen tog den nya tiden vi föreslog.',
    'Om ett ämne inte gick upp för att tiden lagts på ett annat av ämnena med garanti: timmarna per ämne står ovan.',
    'Vilket ämne de oklara passen gällde.',
    'Att anspråket kom inom 30 dagar efter betyget, och att garantin inte redan har använts för eleven och ämnet.'
  ];

  function dpUnderlag(elevId, år) {
    const u = underlag[elevId + ':' + år];
    if (!u) return '';
    if (u.fel) return tomt('Underlaget gick inte att räkna', u.fel);
    if (!(u.amnen || []).length) return tomt('Ingen anmälan läsåret ' + läsårText(år), '');
    const veckor = u.veckor || [], under = veckor.filter(v => v.under);
    const lista = (rader, tom, rita) => rader.length ? rader.map(rita).join('')
      : '<p class="xsmall" style="margin:0 0 12px;color:var(--bl-3)">' + esc(tom) + '</p>';
    const betalt = (u.obetalda || []).length;
    return '<div class="dp-underlag" style="margin:6px 0 18px">'
      + '<p class="xsmall" style="margin:0 0 12px;line-height:1.6;color:var(--bl-3)">'
      + esc((u.fran ? 'Från första passet ' + kortDatum(u.fran) : 'Inget pass efter anmälan än') + ' till ' + kortDatum(u.till)
        + ', räknat ur rapporterna, uppgifterna och betalningarna så som familjen ser dem. Det som inte går att '
        + 'räkna står sist.') + '</p>'
      + dpRubrik('Ämnena')
      + u.amnen.map(a => {
          const upp = a.uppgifter || { totalt: 0, i_tid: 0 };
          const andel = upp.totalt ? Math.round(100 * upp.i_tid / upp.totalt) : null;
          return dpRad(a.amne, [
              'betyg vid anmälan ' + (a.betyg || 'gallrat'), 'anmäld ' + kortDatum(a.anmald),
              a.forsta_pass ? 'första passet ' + kortDatum(a.forsta_pass) : 'inget pass efter anmälan',
              timText(a.minuter) + ' på ' + a.pass + ' pass',
              upp.totalt ? 'uppgifterna klara i tid ' + upp.i_tid + ' av ' + upp.totalt + ' (' + andel + ' %)'
                : 'inga uppgifter med passerat slutdatum'
            ].join(' · '),
            pill(a.i_tid ? 'Började i tid' : 'Började inte i tid', a.i_tid ? 'ar-klar' : 'ar-ny')
              + (upp.totalt ? ' ' + pill(andel >= 90 ? 'Uppgifter minst 90 %' : 'Uppgifter under 90 %',
                  andel >= 90 ? 'ar-klar' : 'ar-ny') : ''));
        }).join('')
      + dpRubrik('Två timmar i veckan', under.length + ' av ' + veckor.length + ' veckor under')
      + lista(under, 'Ingen vecka under två timmar.', v => dpRad('Vecka ' + veckoNr(v.vecka) + ', från ' + kortDatum(v.vecka),
          [timText(v.minuter) + ' i ämnena med garanti',
           v.oklara ? timText(v.oklara) + ' oklart ämne' : null,
           v.andra ? timText(v.andra) + ' i andra ämnen' : null].filter(Boolean).join(' · '),
          pill(v.igen === true ? 'Togs igen' : v.igen === false ? 'Togs inte igen' : 'Väntar',
            v.igen === true ? 'ar-klar' : v.igen === false ? 'ar-ny' : 'ar-vantar')))
      + '<p class="xsmall" style="margin:0 0 12px;color:var(--bl-3)">' + esc((u.utan_tider
          ? u.utan_tider + ' pass saknar tider i rapporten och räknas med bokad längd. ' : '')
          + '"Togs igen" räknar tiden över två timmar de två veckorna efter.') + '</p>'
      + dpRubrik('Oklara ämnen', 'räknas inte förrän ni bestämt')
      + lista(u.oklara || [], 'Inga.', x => dpRad(kortDatum(x.datum), (x.amne || 'inget ämne i rapporten')
          + ' · ' + timText(x.minuter), ''))
      + dpRubrik('Uteblivna pass')
      + lista(u.uteblivna || [], 'Inga.', x => dpRad(kortDatum(x.datum), x.amne || '',
          pill('Garantin gäller inte längre', 'ar-ny')))
      + dpRubrik('Avbokade pass')
      + lista(u.avbokade || [], 'Inga.', x => dpRad(kortDatum(x.datum), 'av ' + x.av
          + (x.skal ? ' · ' + ((AVBOKNINGSSKAL[x.skal] || [x.skal])[0]).toLowerCase() : ''), ''))
      + dpRubrik('Betalningarna')
      + (betalt
        ? (u.obetalda || []).map(x => dpRad(kortDatum(x.datum), 'passet är inte betalt', pill('Obetalt', 'ar-ny'))).join('')
        : lista([], 'Alla pass är betalda.', null))
      + dpRubrik('Bedöms av er')
      + '<ul class="xsmall" style="margin:0 0 12px;padding-left:18px;line-height:1.6">'
      + BEDÖMS.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>'
      + '</div>';
  }

  document.addEventListener('click', async e => {
    const k = e.target.closest('[data-dp-garanti-prova]');
    if (!k || DP.typ !== 'elev') return;
    const elev = DP.id, år = Number(k.dataset.dpGarantiProva);
    await medan(k, 'Räknar…', async () => {
      const { data, error } = await supa.rpc('betygsgaranti_underlag', { p_elev: elev, p_lasar: år });
      underlag[elev + ':' + år] = error ? { fel: felText(error) } : (data || {});
    });
    if (DP.typ === 'elev' && DP.id === elev) ritaDetalj();
  });

  /* BARNETS INLOGGNING (2026-10-15). Det föräldern ser under Barnen:
     användarnamnet, om inloggningen är pausad, när barnet senast loggade
     in och vad det får. Aldrig adressen: den tekniska finns bara för
     Auth, och barnets egen e-post når ingen inloggad. Bara föräldern
     skapar, pausar och tar bort inloggningen (barn-konto), så här finns
     inga knappar. Kolumnerna står på students, som panelen läser hela.

     Valen har samma namn som i föräldrarnas ruta (BARN_FÅR), och
     kolla-behorigheter.py jämför listan med databasens. Rapporterna och
     förslagen står i egna kolumner, visa_rapporter och far_boka. */
  const BARNETS_VAL = {
    pass: 'se sina pass',
    boka: 'föreslå pass',
    studieplan: 'se studieplanen',
    rapporter: 'läsa rapporterna',
    nexlax: 'göra NexLäx',
    meddelanden: 'se notiserna från Nextrum',
    chatt: 'skriva till studiehjälparen'
  };

  function dpInloggning(e) {
    if (!e.user_id) {
      return dpRubrik('Egen inloggning')
        + tomt('Ingen', 'Föräldern skapar den i studievyn, under Barnen.');
    }
    const har = k => k === 'rapporter' ? !!e.visa_rapporter
      : k === 'boka' ? !!e.far_boka
      : (e.barn_behorigheter || []).indexOf(k) !== -1;
    const val = Object.keys(BARNETS_VAL).filter(har).map(k => BARNETS_VAL[k]);
    return dpRubrik('Egen inloggning', e.barn_aktiv === false ? 'pausad av föräldern' : 'aktiv')
      + dpFakta([
        ['Användarnamn', e.anvandarnamn ? esc(e.anvandarnamn) : null, 'okänt'],
        ['Senast inloggad', e.senast_inloggad ? esc(kortDatum(e.senast_inloggad)) : null, 'aldrig'],
        ['Får', val.length ? esc(val.join(', ')) : null, 'bara logga in'],
        ['Förälderns ja', e.vardnadshavare_godkand_at ? esc(kortDatum(e.vardnadshavare_godkand_at)) : null, 'saknas']
      ]);
  }

  function dpElev(e, d) {
    const f = S.personer[e.parent_id];
    const t = elevHjälpare(e);
    const pass = passFör(b => b.student_id === e.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const plan = (d.plan || [])[0];
    /* passFör sorterar nyast först, så det närmaste kommande står sist. */
    const idag = isoFor(new Date());
    const nästa = pass.filter(b => b.wanted_date >= idag && b.status !== 'cancelled').pop();

    if (DP.flik === 'pass') return passLista(pass, b => namnFör(b.tutor_id));

    if (DP.flik === 'uppgifter') {
      const öppna = (d.laxor || []).filter(h => h.status !== 'klar');
      return dpRubrik('Läxor', öppna.length ? öppna.length + ' öppna' : 'allt avbockat')
        + ((d.laxor || []).length
          ? d.laxor.map(h => dpRad(h.title,
              [h.subject, h.due_date ? 'till ' + kortDatum(h.due_date) : null]
                .filter(Boolean).join(' · '),
              pill(h.status === 'klar' ? 'Klar' : h.status === 'pagaende' ? 'Pågående' : 'Ej påbörjad',
                h.status === 'klar' ? 'ar-klar' : h.status === 'pagaende' ? 'ar-vantar' : ''))).join('')
          : tomt('Inga läxor', 'Studiehjälparen lägger upp dem i sin vy.'))
        + dpMaterial(e, d);
    }

    if (DP.flik === 'utveckling') {
      const u = d.utveckling || [];
      if (!u.length) return tomt('Inga områden satta',
        'Studiehjälparen sätter dem efter hand som de arbetar.');
      return u.map(x => dpRad(x.area, [x.subject, x.comment].filter(Boolean).join(' · '),
        stegPill(x))).join('');
    }

    if (DP.flik === 'rapporter') {
      const r = d.rapporter || [];
      if (!r.length) return tomt('Inga rapporter än',
        'Studiehjälparen skriver en efter varje pass. Utan den räknas passet inte som genomfört.');
      return r.map(x => '<div style="margin-bottom:18px">'
        + dpRubrik(kortDatum(x.lesson_date))
        + dpFakta([
          ['Gick bra', x.went_well ? esc(x.went_well) : null],
          ['Att öva på', x.needs_practice ? esc(x.needs_practice) : null],
          ['Nästa gång', x.next_focus ? esc(x.next_focus) : null]
        ]) + '</div>').join('');
    }

    return dpTal([
      [genomförda.length, 'Genomförda pass'],
      [(d.laxor || []).filter(h => h.status !== 'klar').length, 'Öppna läxor'],
      [(d.utveckling || []).length, 'Områden']
    ])
    + dpRubrik('Eleven')
    + dpFakta([
      ['Årskurs', e.grade ? esc(e.grade) : null],
      /* Könet (kon_i_matchningen, 2026-10-26), när kolumnen finns. */
      'kon' in e ? ['Kön', e.kon ? esc((NX.KON_ELEV.find(x => x.kod === e.kon) || {}).text || e.kon) : null,
        'inte angivet'] : null,
      ['Skola', e.school ? esc(e.school) : null],
      ['Ämnen', (e.subjects || []).length ? esc(e.subjects.join(', ')) : null],
      /* Det familjen skrivit för matchningen (2026-09-24). Koderna blir
         text ur NX.BEHOV och NX.FORMAT_ONSKEMAL — samma listor som
         familjen valde ur. */
      ['Behöver', (e.behov || []).length
        ? esc(e.behov.map(k => (NX.BEHOV.find(x => x.kod === k) || {}).text).filter(Boolean).join(', ')) : null],
      ['Format', e.format_onskemal
        ? esc((NX.FORMAT_ONSKEMAL.find(x => x.kod === e.format_onskemal) || {}).text || '') : null],
      ['Mål', e.goals ? esc(e.goals) : null],
      ['Lär sig bäst', e.about ? esc(e.about) : null],
      ['Familj', f ? '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(f.id) + '">'
        + esc(f.full_name || f.email || '—') + '</button>' : null],
      ['Studiehjälpare', t
        ? '<button class="btn btn-ghost btn-sm" data-dp="studiehjalpare:' + esc(t.id) + '">'
          + esc(t.full_name || t.email || '—') + '</button>'
        : null, 'ingen matchad än']
    ])
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [nästa.subject, namnFör(nästa.tutor_id)].filter(x => x && x !== '—').join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'))
    + dpRubrik('Studieplan', plan && plan.updated_at ? 'uppdaterad ' + kortDatum(plan.updated_at) : '')
    + (plan && (plan.plan_text || plan.goals)
      ? '<div class="dp-text">' + esc(plan.plan_text || plan.goals) + '</div>'
      : tomt('Ingen studieplan', 'Studiehjälparen skriver den efter första passet.'))
    + dpGaranti(d)
    + dpInloggning(e)
    + dpHantera('elev', e, {
        /* Matchningen görs under Matchning, med eleven redan vald. */
        knappar: '<a class="btn btn-ghost btn-sm" href="#matchning" data-mt-hoppa="' + esc(e.id)
          + '" data-dp-stang>' + (t ? 'Byt studiehjälpare' : 'Matcha') + '</a>',
        rubrik: 'Radera eleven',
        text: 'När barnet inte ska ha hjälp längre men familjen stannar. Läxorna, studieplanen, '
          + 'materialet och det familjen skrev om barnet tas bort. Rapporter och pass som hållits '
          + 'står kvar utan namn och text, för bokföringen och studiehjälparens lön.'
      });
  }

  function dpStudiehjalpare(p, d) {
    const tp = S.tutorProfiler[p.id] || {};
    const elever = S.elevlista.filter(e => e.matched_tutor_id === p.id && e.match_status === 'matched');
    const pass = passFör(b => b.tutor_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);
    const utb = S.utbetalningar.filter(u => u.tutor_id === p.id);

    if (DP.flik === 'elever') {
      if (!elever.length) return tomt('Inga elever',
        'Matcha någon under Matchning, så syns de här.');
      return elever.map(e => {
        const fam = S.personer[e.parent_id];
        return '<div class="dp-rad"><div><b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, fam && (fam.full_name || fam.email)]
              .filter(Boolean).join(' · ')) + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    if (DP.flik === 'pass') return passLista(pass, b => elevNamn(b.student_id) || namnFör(b.parent_id));

    if (DP.flik === 'ersattning') {
      const väntar = utb.filter(u => u.status === 'utkast' || u.status === 'godkand')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      const utbetalt = utb.filter(u => u.status === 'utbetald')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      return dpTal([
        [kronor(väntar), 'Väntar'],
        [kronor(utbetalt), 'Utbetalt'],
        [tp.hourly_rate ? NX.kr(tp.hourly_rate) : '—', 'Per timme']
      ])
      + dpRubrik('Underlag')
      + (utb.length
        ? utb.map(u => dpRad(
            NX.MANADER[Number(String(u.period).slice(5, 7)) - 1] + ' ' + String(u.period).slice(0, 4),
            kronor(u.belopp_ore) + ' · ' + NXBetalning.timmar(u.minuter || 0),
            läge(UTB_LAGE, u.status))).join('')
        : tomt('Inga underlag än', 'De skapas av månadskörningen efter varje månad.'));
    }

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    return dpTal([
      [elever.length, 'Elever'],
      [genomförda.length, 'Genomförda pass'],
      [NXBetalning.timmar(minuter), 'Undervisad tid']
    ])
    + dpRubrik('Profilen')
    + dpFakta([
      ['E-post', dpMejl(p.email)],
      ['Telefon', dpTelefon(p.phone)],
      ['Ålder', tp.age ? esc(String(tp.age) + ' år') : null],
      ['Skola', tp.school ? esc(tp.school) : null],
      ['Ort', tp.city ? esc(tp.city) : null],
      ['Ämnen', (tp.subjects || []).length ? esc(tp.subjects.join(', ')) : null],
      ['Årskurser', (tp.grade_levels || []).length ? esc(tp.grade_levels.join(', ')) : null],
      ['Format', (tp.formats || []).length ? esc(tp.formats.join(', ')) : null],
      ['Timpenning', tp.hourly_rate ? esc(NX.kr(tp.hourly_rate)) : null, 'ej satt'],
      ['Senast inloggad', dpSenast(p)],
      ['Användarvillkoren', dpVillkor(d), 'okänt']
    ])
    + (tp.bio ? dpRubrik('Om hen') + '<div class="dp-text">' + esc(tp.bio) + '</div>' : '')
    + dpKonOchElever(p, d)
    /* Läget och startsidan stod förut i listan. Publiceringen är ett
       eget beslut, inte en följd av att vara godkänd (schema-v23), och
       knappen står därför bara när hen är godkänd. */
    + dpRubrik('Läge')
    /* Läget och startsidan ändrar bara den som får godkänna
       (skydda_tutorfalt); för andra går ändringen tyst tillbaka. */
    + (tp.id ? (får('studiehjalpare_godkann') ? lägesväljare(SH_LAGE, tp.status, 'data-sh="' + esc(p.id) + '"')
      : läge(SH_LAGE, tp.status)) : '')
    + '<div class="dp-atgard">'
    + (tp.status === 'approved' && får('studiehjalpare_godkann')
      ? '<button class="btn btn-ghost btn-sm" type="button" data-sh-publik="' + esc(p.id) + '">'
        + (tp.visa_publikt ? 'Syns på startsidan: dölj' : 'Visa på startsidan') + '</button>'
      : '')
    /* Kontakt bara när adressen finns. En knapp som öppnar ett
       mejlutkast utan mottagare ser ut att fungera och gör det inte. */
    + (p.email
      ? '<button class="btn btn-ghost btn-sm" type="button" data-sh-kontakt="' + esc(p.id) + '">Kontakta</button>'
      : '')
    + '</div>'
    + dpProvet(p, d)
    + dpChattar(p, d, 'studiehjalpare')
    + dpDokument(p)
    + dpHantera('studiehjalpare', p, {
        rubrik: 'Radera studiehjälparen',
        text: 'När hen slutar eller inte ska anställas. Kontot, ansökan, chatten och profilen tas bort '
          + 'ur våra system. Pass, rapporter och underlag som redan finns står kvar utan namn, för '
          + 'bokföringen och lönen. Elever ska matchas om först.'
      });
  }

  /* KÖN OCH ELEVER (kon_i_matchningen, 2026-10-26)

     Leo: studiehjälparen väljer om hen bara vill hjälpa elever av samma
     kön, och vill hen inte hjälpa det andra syns hen inte i matchningen.
     Valet görs i studiehjälparens profil och står i matchningsval, som
     bara hen och den som läser studiehjälparna ser. Här syns det, och en
     superadmin kan sätta det åt hen när hen bett om det: databasen
     släpper bara fram en superadmin. Före migrationen står ingenting. */
  let konBesked = null;
  function dpKonOchElever(p, d) {
    if (d.matchningsvalSaknas) return '';
    if (d.matchningsvalFel) return dpRubrik('Kön och elever') + tomt('Valet gick inte att läsa', d.matchningsvalFel);
    const mv = (d.matchningsval || [])[0] || { kon: null, bara_samma_kon: false };
    const besked = konBesked && konBesked.id === p.id ? konBesked : null;
    konBesked = null;
    const kvitto = besked ? '<p class="ok-msg show' + (besked.ok ? '' : ' is-err') + '">' + esc(besked.text) + '</p>' : '';
    const kön = (NX.KON_VUXEN.find(x => x.kod === mv.kon) || {}).text || null;
    return dpRubrik('Kön och elever', 'bara vi och studiehjälparen ser det')
      + dpFakta([
        ['Kön', kön ? esc(kön) : null, 'inte angivet'],
        ['Hjälper', esc(mv.bara_samma_kon ? 'Bara elever av samma kön som hen' : 'Alla elever')],
        mv.andrad_at ? ['Ändrat', esc(kortDatum(mv.andrad_at))] : null
      ])
      + (ärSuperadmin()
        ? '<form class="dp-rabatt dp-kon" data-dp-kon="' + esc(p.id) + '">'
          + '<label for="dp-kon-kon">Kön</label>'
          + '<select class="sel" id="dp-kon-kon" name="kon"><option value="">Inte angivet</option>'
          + NX.KON_VUXEN.map(k => '<option value="' + esc(k.kod) + '"' + (mv.kon === k.kod ? ' selected' : '') + '>'
            + esc(k.text) + '</option>').join('')
          + '</select>'
          + '<label for="dp-kon-elever">Hjälper</label>'
          + '<select class="sel" id="dp-kon-elever" name="elever">'
          + '<option value="alla"' + (mv.bara_samma_kon ? '' : ' selected') + '>Alla elever</option>'
          + '<option value="samma"' + (mv.bara_samma_kon ? ' selected' : '') + '>Bara elever av samma kön</option>'
          + '</select>'
          + '<button class="btn btn-primary" type="submit">Spara</button>'
          + '<span class="dp-gratis-not">Studiehjälparen väljer själv i sin profil; ändra här bara när hen bett om det. '
          + 'Med bara samma kön visas hen inte i matchningen för en elev av ett annat kön eller utan angivet kön. '
          + 'Elever hen redan har står kvar, och en som krockar blir en uppgift under Att göra.</span>'
          + kvitto
          + '</form>'
        : kvitto);
  }

  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-dp-kon]');
    if (!f) return;
    ev.preventDefault();
    const id = f.dataset.dpKon;
    const kon = f.elements.kon.value || null;
    const samma = f.elements.elever.value === 'samma';
    if (samma && !kon) {
      konBesked = { id, text: 'Välj ett kön först. Utan det finns inget "samma".', ok: false };
      ritaDetalj();
      return;
    }
    await medan(f.querySelector('button[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.from('matchningsval')
        .upsert({ tutor_id: id, kon: kon, bara_samma_kon: samma }, { onConflict: 'tutor_id' });
      konBesked = error
        ? { id, text: 'Kunde inte spara: ' + felText(error), ok: false }
        : { id, text: samma ? 'Sparat. Hen visas bara för elever av samma kön.' : 'Sparat. Hen visas för alla elever.', ok: true };
      if (!error) {
        delete S.detaljCache['studiehjalpare:' + id];
        await hämtaDetalj('studiehjalpare', id);
        /* Matchningen läser valet ur sin vy. */
        await hämtaMatchunderlag();
        kör('ritaMatchning');
      }
      if (DP.typ === 'studiehjalpare' && DP.id === id) ritaDetalj();
    });
  });

  /* Utbildningsprovet i studiehjälparvyn (2026-10-21): om det krävs, när
     det godkändes, och försöken med poängen (aldrig svaren). Nollställ
     och Kräv provet för den som får godkänna studiehjälpare. Utan
     migrationen, eller utan läsrätt, står ingenting. */
  function dpProvet(p, d) {
    if (d.provSaknas || d.provForsokSaknas || d.provFel) return '';
    const st = (d.prov || [])[0] || null;
    const försök = d.provForsok || [];
    const lage = d.provLage && !Array.isArray(d.provLage) ? d.provLage : null;
    const godkänt = st && st.utbildningsprov_godkant_at;
    const krävs = !st || st.kravs !== false;
    const läget = godkänt ? 'Godkänt ' + kortDatum(godkänt)
      : !krävs ? 'Krävs inte' + (st && st.undantagen ? ' (' + st.undantagen + ')' : '')
      : 'Krävs, inte godkänt än';
    const spärr = lage && !lage.sparr_galler && krävs && !godkänt
      ? 'Gäller inte än: ' + lage.aktiva + ' aktiva frågor, och spärren börjar vid ' + lage.min_aktiva_fragor + '.'
      : null;
    const kan = får('studiehjalpare_godkann');
    return dpRubrik('Utbildningsprovet', 'görs vid första inloggningen')
      + dpFakta([
        ['Läget', esc(läget)],
        ...(spärr ? [['Spärren', esc(spärr)]] : []),
        ...(st && st.aterstalld_at ? [['Nollställt', esc(kortDatum(st.aterstalld_at))]] : [])
      ])
      + försök.map(f => dpRad(kortDatum(f.inlamnad_at), f.ratt + ' av ' + f.antal + ' rätt',
          f.godkand ? pill('Godkänt', 'ar-klar') : pill('Underkänt', 'ar-ny'))).join('')
      + (kan
        ? '<div class="dp-atgard">'
          + (godkänt || försök.length
            ? '<button class="btn btn-ghost btn-sm" type="button" data-prov-aterstall="' + esc(p.id) + '">'
              + 'Nollställ provet</button>'
            : '')
          + '<button class="btn btn-ghost btn-sm" type="button" data-prov-krav="' + esc(p.id) + ':'
          + (krävs ? 'nej' : 'ja') + '">' + (krävs ? 'Kräv inte provet' : 'Kräv provet') + '</button>'
          + '</div>'
        : '');
  }

  document.addEventListener('click', async e => {
    const nollställ = e.target.closest('[data-prov-aterstall]');
    const krav = e.target.closest('[data-prov-krav]');
    if (!nollställ && !krav) return;
    const knapp = nollställ || krav;
    const id = nollställ ? nollställ.dataset.provAterstall : krav.dataset.provKrav.split(':')[0];
    const på = krav ? krav.dataset.provKrav.split(':')[1] === 'ja' : null;
    const vem = namnFör(id);
    const ja = await bekräfta(nollställ
      ? { titel: 'Nollställa provet för ' + vem + '?',
          text: vem + ' gör om provet vid nästa inloggning, utan väntetid, och kommer inte åt elever, pass och '
            + 'meddelanden förrän det är godkänt. Försöken står kvar.',
          knapp: 'Nollställ', avbryt: 'Avbryt' }
      : på
        ? { titel: 'Kräva provet av ' + vem + '?',
            text: 'Har ' + vem + ' inte klarat provet stängs elever, pass och meddelanden tills det är godkänt.',
            knapp: 'Kräv provet', avbryt: 'Avbryt' }
        : { titel: 'Ta bort kravet för ' + vem + '?',
            text: vem + ' kommer in i studiehjälparvyn utan provet.',
            knapp: 'Ta bort kravet', avbryt: 'Avbryt' });
    if (!ja) return;
    await medan(knapp, '…', async () => {
      const { error } = nollställ
        ? await supa.rpc('aterstall_utbildningsprov', { p_studiehjalpare: id })
        : await supa.rpc('satt_provkrav', { p_studiehjalpare: id, p_kravs: på });
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      delete S.detaljCache['studiehjalpare:' + id];
      await hämtaDetalj('studiehjalpare', id);
      if (DP.typ === 'studiehjalpare' && DP.id === id) ritaDetalj();
      if (NXAdmin.rita.ritaProvet) NXAdmin.rita.ritaProvet();
    });
  });

  function dpNoteringar(profilId, d) {
    // admin_noteringar läser och skriver bara en superadmin.
    if (!ärSuperadmin()) return '';
    const n = d.noteringar || [];
    return dpRubrik('Interna anteckningar', 'syns bara för admin')
      + '<form data-dp-not="' + esc(profilId) + '" style="margin-bottom:16px">'
      + '<textarea class="inp" name="text" style="min-height:74px" '
      + 'placeholder="Vad behöver vi minnas om den här personen?" required></textarea>'
      + '<button class="btn btn-primary btn-sm" type="submit" style="margin-top:9px">Spara anteckning</button>'
      + '<p class="ok-msg" data-dp-not-msg></p></form>'
      + (d.noteringarFel
        ? tomt('Kunde inte hämta anteckningarna', d.noteringarFel + ' — är schema-v13.sql kört?')
        : n.length
          ? n.map(x => dpRad(x.text, namnFör(x.skriven_av) + ' · ' + kortDatum(x.created_at), ''))
              .join('')
          : tomt('Inga anteckningar än', 'Den första du skriver hamnar överst.'));
  }

  /* ------------------------------------------------------------
     ANMÄLAN OCH ANSÖKAN (2026-09-28)

     Samma uppgifter som tabellerna hade, och samma knappar, men för en
     person i taget. Tabellerna visade ett nittio tecken långt utdrag ur
     det familjen och den sökande skrivit; här står hela texten.
     ------------------------------------------------------------ */
  /* Koden familjen skickade med (2026-09-30): vem som tipsade, eller
     vilken affisch. Personen öppnas i panelen; namnet står i profiles
     och aldrig på koden. */
  function dpKod(l) {
    if (!l.kod) return null;
    const k = (S.tipskod || {})[l.kod];
    if (!k) return esc(l.kod);
    if (k.sort === 'kampanj') {
      return esc(k.namn || 'Kampanj') + ' <span class="xsmall">' + esc(k.kod) + (k.aktiv ? '' : ', avstängd') + '</span>';
    }
    const typ = k.sort === 'studiehjalpare' ? 'studiehjalpare' : 'familj';
    return 'Tipsad av <button class="btn btn-ghost btn-sm" type="button" data-dp="' + typ + ':' + esc(k.person_id) + '">'
      + esc(namnFör(k.person_id)) + '</button> <span class="xsmall">'
      + (typ === 'studiehjalpare' ? 'studiehjälpare' : 'familj') + ', ' + esc(k.kod) + '</span>';
  }

  function dpAnmalan(l) {
    const familj = kör('anmälansFamilj', l);
    const källa = kör('källText', l);
    const tjänst = (S.tjanster || []).find(t => t.kod === l.tjanst);
    return dpRubrik('Anmälan', 'kom in ' + kortDatum(l.created_at))
      + dpFakta([
        ['Förälder', l.parent_name ? esc(l.parent_name) : null],
        ['E-post', dpMejl(l.email)],
        ['Barn', l.child_name ? esc(l.child_name) : null],
        ['Årskurs', l.grade ? esc(l.grade) : null],
        ['Ämne', l.subject ? esc(l.subject) : null],
        ['Tjänst', l.tjanst ? esc((tjänst && tjänst.namn) || l.tjanst) : null],
        /* Tomt är okänt, inte "direkt" (Fas 9.5). */
        ['Källa', källa ? '<span title="' + esc(kör('källTitel', l) || '') + '">' + esc(källa) + '</span>' : null,
          'okänd'],
        ['Kod', dpKod(l), 'ingen'],
        ['Kontaktad', l.kontaktad_at ? esc(kortDatum(l.kontaktad_at)) : null, 'inte än'],
        ['Familj', familj
          ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(familj.id) + '">'
            + esc(familj.full_name || familj.email || '—') + '</button>'
          : null, 'inget konto än']
      ])
      + dpRubrik('Vad de skrev')
      + (l.message ? '<div class="dp-text">' + esc(l.message) + '</div>'
        : tomt('Inget meddelande', 'Familjen skrev ingenting i rutan.'))
      + (l.notering ? dpRubrik('Vår notering') + '<div class="dp-text">' + esc(l.notering) + '</div>' : '')
      /* Vägen vidare. Matchningskön arbetar på elever, inte på
         anmälningar, så utan Skapa elev når ingen familj fram. Utan
         konto heter knappen Ta in familjen: kontot skapas i samma
         tryck (2026-10-06). */
      + dpRubrik('Läge')
      + lägesväljare(LEAD_LAGE, l.status, 'data-lead="' + esc(l.id) + '"')
      + '<div class="dp-atgard">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-lead-kontakt="' + esc(l.id) + '">'
      + (l.kontaktad_at ? 'Skriv igen' : 'Kontakta') + '</button>'
      // Kontot, eleven och timmarna skapar bara en superadmin (bjud-in, is_admin).
      + (l.status !== 'matched' && ärSuperadmin()
        ? '<button class="btn btn-primary btn-sm" type="button" data-lead-elev="' + esc(l.id) + '">'
          + (familj ? 'Skapa elev' : 'Ta in familjen') + '</button>'
        : '')
      /* Intagen men kvar i listan (intagen före 2026-10-21, eller flytten
         föll): flytta den till familjen, som Ta in familjen gör sist. */
      + (l.status === 'matched' && familj && ärSuperadmin()
        ? '<button class="btn btn-primary btn-sm" type="button" data-lead-intag="' + esc(l.id) + '">'
          + 'Flytta till familjen</button>'
        : '')
      + '</div>'
      + dpHantera('anmalan', l, {
          rubrik: 'Radera anmälan',
          text: 'När familjen inte vill ha tjänsten. Namnet, adressen och det de skrev tas bort, också ur '
            + 'andra anmälningar och meddelanden med samma adress. Raden står kvar utan dem, så att '
            + 'statistiken över anmälningar räknar rätt. Har familjen ett konto raderas det under Familjer.'
        });
  }

  /* Ansökan (2026-10-21, ansokningarnas_steg). Leo: "Gör hela profilen
     enkel att läsa: tydlig rubrik, uppgifterna kompakt, en tydlig
     nästa-åtgärd." Steget och dess knappar står först (nästaSteg i
     nextrum-admin-rekrytering.js), sedan uppgifterna, det hen skrev och
     mejlen till hen, hopfällda. Fliken Rekryteringen med fyra steg är
     borta: stegen byts med knapparna, och databasen vaktar ordningen. */
  function dpAnsokan(a) {
    const text = kör('ansökansText', a);
    const cv = kör('cvKnapp', a);
    const tjänster = (a.tjanster || []).map(k => ((S.tjanster || []).find(t => t.kod === k) || {}).namn || k);
    /* Kontot ansökan blev, eller ett studiehjälparkonto med samma adress
       (en ansökan som togs in före 2026-10-21 kan sakna kopplingen). */
    const epost = String(a.email || '').toLowerCase();
    const konto = (a.konto_id && S.personer[a.konto_id]) || (epost && Object.values(S.personer).find(p =>
      p.role === 'tutor' && !ärRaderad(p) && String(p.email || '').toLowerCase() === epost));

    return (kör('nästaSteg', a) || '')
      + dpRubrik('Ansökan', 'kom in ' + kortDatum(a.created_at))
      + dpFakta([
        ['E-post', a.email
          ? dpMejl(a.email) + ' <button class="btn btn-ghost btn-sm" type="button" data-ans-kontakt="'
            + esc(a.id) + '">Skriv till hen</button>'
          : null],
        ['Ålder', a.age ? esc(a.age + ' år') : null],
        /* Under 18: vårdnadshavaren och godkännandet (2026-10-05). */
        ...(kör('vhFakta', a) || []),
        ['Skola', a.school ? esc(a.school) : null],
        ['Ämnen', a.subjects ? esc(a.subjects) : null],
        ['Kan jobba', a.availability ? esc(a.availability) : null],
        ['Söker till', tjänster.length ? esc(tjänster.join(', ')) : null],
        ['CV', cv || null, 'inget bifogat'],
        ['Konto', konto
          ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="studiehjalpare:' + esc(konto.id) + '">'
            + esc(konto.full_name || konto.email) + '</button>'
          : null, 'inget än: det skapas med Skapa konto och skicka inbjudan'],
        /* Koden (2026-10-13): en studiehjälpares, som får värvningsbonusen
           (varvningsbonus, 2026-10-21) när hen får sitt konto. Bara en kod
           som gällde står här; databasen tömde de andra. Värvaren står på
           ansökan (varvad_av_profil_id) och följer koden. */
        ['Kod', dpKod(a), 'ingen'],
        ...(a.kod ? [['Värvningsbonus', (() => {
          const b = (S.varvningsbonus || []).find(x => x.varvad_ansokan_id === a.id);
          if (!b) return esc(S.bonusFlagga && !S.bonusFlagga.aktiv
            ? 'ingen: bonusen är avstängd under Koder'
            : 'ingen rad');
          if (b.status === 'annullerad') return esc('ingen: ' + (b.annullerad_orsak || 'annullerad'));
          if (b.status === 'vantar') return esc(NXBetalning.kronor(b.brutto_ore) + ', väntar: tjänas in när hen får sitt konto');
          if (b.status === 'utbetald') return esc(NXBetalning.kronor(b.brutto_ore) + ', utbetald med lönen för ' + (b.utbetald_period || ''));
          /* Lönen för månaden den tjänades in, som betalas den 25:e månaden efter. */
          const [år, mån] = String(b.manad || '').split('-').map(Number);
          return esc(NXBetalning.kronor(b.brutto_ore) + ', intjänad' + (år ? ', i lönen den 25 '
            + NXStudie.månadsNamn(NXStudie.månadIso(new Date(år, mån, 1, 12))) : ''));
        })()]] : [])
      ])
      + dpRubrik('Varför hen söker')
      + (text ? '<div class="dp-text">' + esc(text) + '</div>' : tomt('Inget skrivet', ''))
      + (a.notering ? dpRubrik('Vår notering') + '<div class="dp-text">' + esc(a.notering) + '</div>' : '')
      + (a.vardnadshavare_godkand_at
        ? dpRubrik('Vårdnadshavarens svar', 'inlagt ' + kortDatum(a.vardnadshavare_godkand_at)) + (kör('vhSvar', a) || '')
        : '')
      + (kör('beskedLista', a) || '')
      + (a.status !== 'rejected'
        ? '<div class="dp-atgard"><button class="btn btn-ghost btn-sm" type="button" data-ans-nej="' + esc(a.id) + '">'
          + 'Avböj ansökan</button></div>'
        : '')
      + dpHantera('ansokan', a, {
          rubrik: 'Radera ansökan',
          text: 'När hen själv ber om det, eller ansökan är skräp. Ansökan, CV:t och meddelanden med '
            + 'samma adress tas bort ur våra system, och ett nej som inte gått än går aldrig. Ska hen '
            + 'få ett: avböj och radera först när nejet gått (det står under Mejlen till hen). Har hen '
            + 'ett konto raderas det under Studiehjälpare.'
        });
  }

  /* ------------------------------------------------------------
     EN RADERAD PERSON

     radera_person() tar bort det som pekar ut någon men lämnar det
     bokföringen kräver (supabase/migrations/…_personer_redigeras_och_
     raderas.sql). Kontot eller barnet står då kvar utan namn och syns
     inte i någon lista, men ett gammalt pass pekar på det och går att
     öppna därifrån. Här står varför det finns kvar, och ingenting går
     att ändra.
     ------------------------------------------------------------ */
  function dpRaderad(typ, p) {
    const pass = typ === 'elev' ? passFör(b => b.student_id === p.id)
      : passFör(b => b.parent_id === p.id || b.tutor_id === p.id);
    const vad = typ === 'elev'
      ? 'Namnet och allt familjen och studiehjälparen skrev om barnet är borta. Rapporterna står kvar utan text, för att studiehjälparens lön räknas på dem.'
      : typ === 'studiehjalpare'
        ? 'Namnet, kontaktuppgifterna, profilen och inloggningen är borta. Rapporterna och underlagen står kvar, för lönen och bokföringen.'
        : 'Namnet, kontaktuppgifterna, inloggningen och barnens uppgifter är borta. Passen och köpen av timmar står kvar, för bokföringen.';
    return '<div class="dp-text">Raderad ' + esc(kortDatum(p.raderad_at)) + '. ' + esc(vad)
      + ' Det sparas i sju år (bokföringslagen).</div>'
      + dpRubrik('Pass', pass.length ? String(pass.length) : '')
      + passLista(pass, b => typ === 'studiehjalpare' ? namnFör(b.parent_id) : namnFör(b.tutor_id));
  }

  /* ------------------------------------------------------------
     REDIGERA OCH RADERA (2026-09-28)

     Leo: "alla personer som finns i våra system i admin, ska vi kunna
     redigera och trycka ta bort på." Två knappar sist i Översikt, för
     varje sorts person. Radera öppnar en ruta som först frågar
     databasen vad raderingen tar med sig (nextrum-admin-radera.js);
     här är det bara knappen. Ett adminkonto raderas inte härifrån:
     databasen vägrar, och knappen ritas inte.
     ------------------------------------------------------------ */
  function dpHantera(typ, rad, o) {
    /* Redigera kräver behörigheten att ändra (en anmälan: leads), och
       raderingen är superadminens (2026-10-15). Förut stod båda för alla,
       och databasen sparade ingenting eller bara matchningen. */
    const redigera = typ === 'anmalan' ? får('leads') : får('anvandare_redigera');
    return '<div class="dp-atgard dp-hantera">'
      + (redigera ? '<button class="btn btn-ghost btn-sm" type="button" data-dp-redigera>Redigera uppgifterna</button>' : '')
      + (o.knappar || '')
      + '</div>'
      + (rad.is_admin || !ärSuperadmin() ? ''
        : '<div class="dp-fara">'
          + '<div class="dp-fara-text"><b>' + esc(o.rubrik) + '</b><span>' + esc(o.text) + '</span></div>'
          + '<button class="btn btn-fara btn-sm" type="button" data-radera="' + esc(typ + ':' + rad.id) + '">'
          + esc(o.rubrik) + '…</button>'
          + '</div>');
  }

  /* Fälten som går att rätta, per sort. Samma kolumner som vyerna och
     formulären själva skriver, och inget annat: läget, matchningen och
     tidsstämplarna har egna knappar, och e-posten på ett konto är
     inloggningen. En adress som ändras här men inte i Auth hade gett ett
     konto som loggar in med en adress och får mejlen till en annan.

     max följer längdtaken i skydda_leadfalt och skydda_ansokningsfalt,
     och formulären i studievyerna för resten. */
  const RED = {
    anmalan: { tabell: 'leads', fält: [
      { k: 'parent_name', et: 'Förälderns namn', krav: true, max: 120 },
      { k: 'email', et: 'E-post', krav: true, epost: true, max: 200 },
      { k: 'child_name', et: 'Barnets namn', max: 120 },
      { k: 'grade', et: 'Årskurs', max: 60 },
      { k: 'subject', et: 'Ämne', max: 200 },
      { k: 'message', et: 'Vad de skrev', text: true, max: 4000 },
      { k: 'notering', et: 'Vår notering', text: true, max: 2000 }
    ] },
    ansokan: { tabell: 'applications', fält: [
      { k: 'name', et: 'Namn', krav: true, max: 120 },
      { k: 'email', et: 'E-post', krav: true, epost: true, max: 200 },
      /* 2026-10-05. En ny eller rättad adress mejlas av databasen
         (ansokan_besked), en gång per adress, så länge godkännandet
         saknas. Bara när kolumnen finns: om() tar bort fältet annars. */
      { k: 'vardnadshavare_epost', et: 'Vårdnadshavarens e-post', epost: true, max: 200,
        om: r => 'vardnadshavare_epost' in r },
      { k: 'age', et: 'Ålder', tal: [10, 99] },
      { k: 'school', et: 'Skola', max: 120 },
      { k: 'subjects', et: 'Ämnen', max: 200 },
      { k: 'availability', et: 'Kan jobba', max: 200 },
      /* Utan CV-raden, som läggs tillbaka när det sparas: den är enda
         kopplingen mellan ansökan och filen (CV_RAD i
         nextrum-admin-rekrytering.js), och gallringen läser den. */
      { k: 'why', et: 'Varför hen söker', text: true, max: 3800, cv: true },
      { k: 'notering', et: 'Vår notering', text: true, max: 2000 }
    ] },
    familj: { tabell: 'profiles', fält: [
      { k: 'full_name', et: 'Namn', krav: true, max: 120 },
      { k: 'phone', et: 'Telefon', max: 40, typ: 'tel' },
      { k: 'bio', et: 'Om familjen', text: true, max: 1000 }
    ] },
    elev: { tabell: 'students', fält: [
      { k: 'name', et: 'Namn', krav: true, max: 80 },
      { k: 'grade', et: 'Årskurs', val: () => NX.ARSKURSER.map(a => a.text) },
      /* Könet för matchningen (kon_i_matchningen, 2026-10-26): koden
         sparas, flicka eller pojke visas. Bara när kolumnen finns. */
      { k: 'kon', et: 'Kön', koder: () => NX.KON_ELEV, om: r => 'kon' in r },
      { k: 'school', et: 'Skola', max: 120 },
      { k: 'subjects', et: 'Ämnen, med komma emellan', lista: true, max: 400 },
      { k: 'goals', et: 'Mål', text: true, max: 600 },
      { k: 'about', et: 'Lär sig bäst', text: true, max: 800 }
    ] },
    studiehjalpare: { tabell: 'profiles', fält: [
      { k: 'full_name', et: 'Namn', krav: true, max: 120 },
      { k: 'phone', et: 'Telefon', max: 40, typ: 'tel' },
      { k: 'age', et: 'Ålder', tal: [13, 99], tabell: 'tutor_profiles' },
      { k: 'school', et: 'Skola', max: 120, tabell: 'tutor_profiles' },
      { k: 'city', et: 'Ort', max: 80, tabell: 'tutor_profiles' },
      { k: 'subjects', et: 'Ämnen, med komma emellan', lista: true, max: 400, tabell: 'tutor_profiles' },
      /* Utan timpenning hoppar månadskörningen över hen: passen hålls
         och ingen lön räknas ut. Därför krävs den för en godkänd. */
      // Timpenningen ändrar bara en superadmin: för andra går den tyst tillbaka.
      { k: 'hourly_rate', et: 'Timpenning, kronor', tal: [1, 10000], tabell: 'tutor_profiles', om: () => ärSuperadmin() },
      { k: 'availability', et: 'Kan jobba', max: 200, tabell: 'tutor_profiles' },
      { k: 'bio', et: 'Om hen', text: true, max: 1000, tabell: 'tutor_profiles' }
    ] }
  };

  /* Raden ett fält läser ur och skrivs till. */
  function redRad(typ, id, f) {
    if (f.tabell === 'tutor_profiles') return S.tutorProfiler[id] || null;
    if (typ === 'anmalan') return S.leads.find(x => x.id === id) || null;
    if (typ === 'ansokan') return S.ansokningar.find(x => x.id === id) || null;
    if (typ === 'elev') return (S.allaElever || S.elevlista).find(x => x.id === id) || null;
    return S.personer[id] || null;
  }

  const CV_RADER = /^CV: .*$/gm;

  function redVärde(typ, id, f) {
    const r = redRad(typ, id, f);
    const v = r ? r[f.k] : null;
    if (f.cv) return String(v || '').replace(CV_RADER, '').trim();
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : String(v);
  }

  function redFält(typ, id, f) {
    const fid = 'dp-red-' + f.k + (f.tabell ? '-tp' : '');
    const namn = f.k + (f.tabell ? '@tp' : '');
    const v = redVärde(typ, id, f);
    let fält;
    if (f.text) {
      fält = '<textarea class="inp" id="' + fid + '" name="' + namn + '" maxlength="' + f.max + '" rows="4">'
        + esc(v) + '</textarea>';
    } else if (f.val) {
      /* Ett värde som inte står i listan (en äldre stavning) visas
         ändå, så att det inte byts ut bara för att formuläret sparas. */
      const val = f.val();
      const alla = v && val.indexOf(v) === -1 ? [v].concat(val) : val;
      fält = '<select class="sel" id="' + fid + '" name="' + namn + '">'
        + '<option value="">Ej angivet</option>'
        + alla.map(x => '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('')
        + '</select>';
    } else if (f.koder) {
      /* En kod sparas och dess text visas, som könet. */
      fält = '<select class="sel" id="' + fid + '" name="' + namn + '">'
        + '<option value="">Ej angivet</option>'
        + f.koder().map(x => '<option value="' + esc(x.kod) + '"' + (x.kod === v ? ' selected' : '') + '>'
          + esc(x.text) + '</option>').join('')
        + '</select>';
    } else if (f.tal) {
      fält = '<input class="inp" id="' + fid + '" name="' + namn + '" type="number" inputmode="numeric"'
        + ' min="' + f.tal[0] + '" max="' + f.tal[1] + '" step="1" value="' + esc(v) + '">';
    } else {
      fält = '<input class="inp" id="' + fid + '" name="' + namn + '" type="'
        + (f.epost ? 'email' : f.typ || 'text') + '" maxlength="' + f.max + '" value="' + esc(v) + '">';
    }
    return '<div class="fgroup"><label for="' + fid + '">' + esc(f.et)
      + (f.krav ? '' : ' <span class="dp-red-valfri">valfritt</span>') + '</label>' + fält + '</div>';
  }

  function dpRedigera(typ, rad) {
    const spec = RED[typ];
    if (!spec) return tomt('Går inte att redigera här', '');
    return '<form class="dp-red" data-dp-red="' + esc(typ + ':' + rad.id) + '" novalidate>'
      + dpRubrik('Redigera uppgifterna')
      + (typ === 'familj' || typ === 'studiehjalpare'
        ? '<p class="dp-red-not">E-post: <b>' + esc(rad.email || '—') + '</b>. Adressen är '
          + 'inloggningen och ändras inte här.</p>'
        : '')
      + spec.fält.filter(f => !f.om || f.om(rad)).map(f => redFält(typ, rad.id, f)).join('')
      + '<p class="ok-msg" data-dp-red-msg></p>'
      + '<div class="dp-atgard">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-red-avbryt>Avbryt</button>'
      + '<button class="btn btn-primary btn-sm" type="submit">Spara</button>'
      + '</div></form>';
  }

  /* Samma värde? Tomt och null är samma sak, och ett tal ur en
     numeric-kolumn jämförs som tal. Utan det hade varje sparning
     skrivit om fält ingen rört, med en rad i auditloggen var. */
  function sammaVärde(ny, gammal) {
    if (Array.isArray(ny) || Array.isArray(gammal)) {
      return JSON.stringify(ny || []) === JSON.stringify(gammal || []);
    }
    if (ny == null || ny === '') return gammal == null || gammal === '';
    if (typeof ny === 'number') return gammal != null && gammal !== '' && Number(gammal) === ny;
    return String(ny) === String(gammal == null ? '' : gammal);
  }

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-dp-red]');
    if (!form) return;
    ev.preventDefault();
    const [typ, id] = form.dataset.dpRed.split(':');
    const spec = RED[typ];
    const msg = form.querySelector('[data-dp-red-msg]');
    rensa(msg);
    if (!spec) return;

    const ändringar = {};
    for (const f of spec.fält) {
      const el = form.elements[f.k + (f.tabell ? '@tp' : '')];
      if (!el) continue;
      const rå = String(el.value || '').trim();
      const r = redRad(typ, id, f);
      let värde;

      if (f.krav && !rå) { säg(msg, '⚠️ ' + f.et + ' får inte vara tomt.', false); el.focus(); return; }
      if (f.epost && rå && !NX.epostOk(rå)) {
        säg(msg, '⚠️ E-postadressen ser inte ut att stämma.', false); el.focus(); return;
      }
      if (f.tal) {
        const n = Number(rå);
        if (rå && (!Number.isInteger(n) || n < f.tal[0] || n > f.tal[1])) {
          säg(msg, '⚠️ ' + f.et + ' ska vara ett heltal mellan ' + f.tal[0] + ' och ' + f.tal[1] + '.', false);
          el.focus(); return;
        }
        värde = rå ? n : null;
      } else if (f.lista) {
        värde = rå.split(',').map(x => x.trim()).filter(Boolean);
      } else if (f.cv) {
        const cvRader = String((r && r.why) || '').match(CV_RADER) || [];
        värde = (rå + (cvRader.length ? '\n\n' + cvRader.join('\n') : '')).trim() || null;
      } else {
        värde = rå || null;
      }

      if (f.k === 'hourly_rate' && värde == null && (S.tutorProfiler[id] || {}).status === 'approved') {
        säg(msg, '⚠️ En godkänd studiehjälpare behöver en timpenning. Utan den räknas ingen lön ut för passen.', false);
        el.focus(); return;
      }

      if (!sammaVärde(värde, r ? r[f.k] : null)) {
        const tabell = f.tabell || spec.tabell;
        (ändringar[tabell] = ändringar[tabell] || {})[f.k] = värde;
      }
    }

    const tabeller = Object.keys(ändringar);
    if (!tabeller.length) { DP.redigera = false; ritaDetalj(); return; }

    await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
      for (const tabell of tabeller) {
        /* Raden tillbaka, så att det som står i panelen är det
           databasen sparade: triggrarna kortar av och skriver om. */
        const { data, error } = await supa.from(tabell).update(ändringar[tabell])
          .eq('id', id).select('*').maybeSingle();
        if (error) { säg(msg, '⚠️ Kunde inte spara: ' + felText(error), false); return; }
        if (!data) {
          säg(msg, '⚠️ Ingenting sparades. Raden finns inte längre, eller så nekade databasen ändringen.', false);
          return;
        }
        const mål = tabell === 'tutor_profiles' ? S.tutorProfiler[id]
          : redRad(typ, id, { tabell: null });
        if (mål) Object.assign(mål, data);
      }

      DP.redigera = false;
      if (typ === 'anmalan') kör('ritaLeads');
      else if (typ === 'ansokan') kör('ritaAnsokningar');
      else if (typ === 'familj') { kör('ritaFamiljer'); kör('ritaElever'); }
      else if (typ === 'elev') { kör('ritaElever'); kör('ritaFamiljer'); }
      else if (typ === 'studiehjalpare') kör('ritaStudiehjalpare');
      /* Matchningen läser namn, ämnen och årskurs ur en egen vy. */
      if (typ === 'elev' || typ === 'studiehjalpare') {
        await hämtaMatchunderlag();
        kör('ritaMatchning');
      }
      ritaDetalj();
    });
  });

  /* ------------------------------------------------------------
     MATERIAL, INLAGT AV ADMIN

     Material har hittills bara kunnat läggas upp av studiehjälparen
     själv, i sin egen vy. Det förutsätter att en gymnasieelev som
     håller sitt tredje pass också vet vilka uppgifter som ligger på
     rätt nivå — och det stödet är precis vad vi säger att vi ger.

     Här kan admin lägga in uppgifter åt en elev, med AI som skriver
     ut förslag. Förslagen är uppgifter i KLARTEXT, aldrig länkar.
     Skälet står i supabase/functions/material-forslag/index.ts och
     är värt en rad även här: en modell som ombeds hitta en länk
     hittar på en länk, och det märks först när eleven sitter med
     läxan på söndagkvällen.

     TVÅ VAL SOM MED FLIT INTE FINNS HÄR

     Filuppladdning. Hinken "material" har en policy som kräver att
     den som laddar upp är elevens studiehjälpare. Att öppna hinken
     för admin vore att lossa ett lås för en bekvämlighets skull.
     Filer läggs upp av studiehjälparen, som förut.

     Att välja avsändare. tutor_id sätts till elevens matchade
     studiehjälpare när det finns en, annars till den admin som lade
     in raden. Familjen ska se materialet komma från sin egen
     studiehjälpare, inte från ett kontor de aldrig träffat — och
     studiehjälparen ska kunna ta bort det i sin egen vy, vilket RLS
     bara tillåter för rader där tutor_id är hen.
     ------------------------------------------------------------ */
  const MAT_SORT = { fil: 'fil', lank: 'länk', anteckning: 'uppgift' };

  function matForslagHtml() {
    const f = S.matForslag || [];
    if (!f.length) return '';
    return '<div class="dp-forslag">' + f.map((x, i) =>
      '<div class="dp-forslag-kort"><b>' + esc(x.titel) + '</b>'
      + '<pre>' + esc(x.uppgift) + '</pre>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-anv="' + i + '">'
      + 'Använd den här</button></div>').join('') + '</div>';
  }

  function dpMaterial(e, d) {
    // Elevens mapp och AI-förslagen är superadminens (materials, material-forslag).
    if (!ärSuperadmin()) return '';
    const lista = d.material || [];

    return dpRubrik('Material', lista.length ? lista.length + ' st' : '')
      + (d.materialFel
        ? tomt('Kunde inte hämta materialet', d.materialFel)
        : lista.length
          ? lista.map(m => dpRad(m.title,
              [m.subject, MAT_SORT[m.kind] || m.kind, kortDatum(m.created_at)]
                .filter(Boolean).join(' · '),
              '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-bort="'
                + esc(m.id) + '">Ta bort</button>')).join('')
          : tomt('Inget material än',
              'Det här är elevens egen mapp, inte biblioteket. Biblioteket ligger under Material i menyn.'))

      /* SANNINGEN OM VEM SOM SER DET HÄR (Fas 13.3)

         Stod "syns hos familjen direkt" till Fas 13.2, och det var
         sant då. Sedan föräldravyns materialflik togs bort ser
         familjen bara det material som hänger på en LÄXA, och en
         läxa pekar på biblioteket — inte hit.

         Raden är alltså inte kosmetik: en admin som tror att en fil
         här når familjen laddar upp den och slutar tänka på saken.
         Vägen till familjen går genom Material i menyn och en läxa. */
      + dpRubrik('Lägg till', 'elevens egen mapp — familjen ser det inte')
      + '<p class="xsmall" style="margin:0 0 10px;line-height:1.6;color:var(--bl-3)">'
      + 'Det här är vårt eget underlag om eleven. Ska familjen se något: lägg det i '
      + '<a href="#bibliotek">Material</a>, så kan studiehjälparen ge det som läxa.</p>'
      + '<form data-dp-mat="' + esc(e.id) + '" class="dp-mat">'
      + '<div class="dp-mat-par">'
      + '<input class="inp" name="titel" placeholder="Rubrik" maxlength="200" required>'
      + '<input class="inp" name="amne" placeholder="Ämne" maxlength="80">'
      + '</div>'
      + '<div class="dp-mat-typ" role="group" aria-label="Sorts material">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-typ="anteckning"'
      + ' aria-pressed="true">Uppgift</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-typ="lank"'
      + ' aria-pressed="false">Länk</button>'
      + '</div>'
      + '<textarea class="inp" name="text" data-dp-mat-falt="anteckning"'
      + ' placeholder="Skriv uppgiften — eller hämta ett förslag längre ned."></textarea>'
      + '<input class="inp" name="url" data-dp-mat-falt="lank" hidden'
      + ' placeholder="https://…" maxlength="500">'
      + '<button class="btn btn-primary btn-sm" type="submit">Spara material</button>'
      + '<p class="ok-msg" data-dp-mat-msg></p>'
      + '</form>'

      + dpRubrik('Föreslå uppgifter med AI', 'skrivs ut i klartext, aldrig som länk')
      + '<div class="dp-mat" data-dp-ai>'
      + '<div class="dp-mat-par">'
      + '<input class="inp" data-ai-amne placeholder="Ämne, t.ex. Matematik" maxlength="80">'
      + '<input class="inp" data-ai-arskurs placeholder="Årskurs" maxlength="40" value="'
      + esc(e.grade || '') + '">'
      + '</div>'
      + '<input class="inp" data-ai-fokus maxlength="400"'
      + ' placeholder="Vad behöver eleven öva på? T.ex. ekvationer med parentes">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-dp-mat-ai>'
      + 'Föreslå tre uppgifter</button>'
      + '<p class="ok-msg" data-dp-ai-msg></p>'
      + '<div data-dp-ai-lista>' + matForslagHtml() + '</div>'
      + '</div>';
  }

  /* En lyssnare för hela materialrutan: typväxlaren, AI-knappen,
     "Använd den här" och borttagningen. Panelen ritas om i sin
     helhet vid varje flikbyte, så inget får bindas vid uppritning. */
  document.addEventListener('click', async ev => {
    const typ = ev.target.closest('[data-dp-mat-typ]');
    if (typ) {
      const form = typ.closest('form');
      const v = typ.dataset.dpMatTyp;
      form.querySelectorAll('[data-dp-mat-typ]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.dpMatTyp === v)));
      form.querySelectorAll('[data-dp-mat-falt]').forEach(f => {
        f.hidden = f.dataset.dpMatFalt !== v;
      });
      rensa(form.querySelector('[data-dp-mat-msg]'));
      return;
    }

    const anv = ev.target.closest('[data-dp-mat-anv]');
    if (anv) {
      const x = (S.matForslag || [])[Number(anv.dataset.dpMatAnv)];
      const form = DP.panel && DP.panel.querySelector('[data-dp-mat]');
      if (!x || !form) return;
      form.titel.value = x.titel;
      form.text.value = x.uppgift;
      const ämne = DP.panel.querySelector('[data-ai-amne]');
      if (ämne && ämne.value.trim() && !form.amne.value.trim()) {
        form.amne.value = ämne.value.trim().slice(0, 80);
      }
      /* Ett förslag är alltid en uppgift, aldrig en länk. */
      form.querySelectorAll('[data-dp-mat-typ]').forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.dpMatTyp === 'anteckning')));
      form.querySelectorAll('[data-dp-mat-falt]').forEach(f => {
        f.hidden = f.dataset.dpMatFalt !== 'anteckning';
      });
      form.titel.focus();
      return;
    }

    const ai = ev.target.closest('[data-dp-mat-ai]');
    if (ai) {
      const ruta = ai.closest('[data-dp-ai]');
      const msg = ruta.querySelector('[data-dp-ai-msg]');
      const amne = ruta.querySelector('[data-ai-amne]').value.trim();
      rensa(msg);
      if (!amne) { säg(msg, '⚠️ Skriv vilket ämne det gäller.', false); return; }

      await medan(ai, 'Tänker…', async () => {
        const { data, error } = await supa.functions.invoke('material-forslag', {
          body: {
            amne: amne,
            arskurs: ruta.querySelector('[data-ai-arskurs]').value.trim(),
            fokus: ruta.querySelector('[data-ai-fokus]').value.trim(),
            antal: 3
          }
        });

        /* invoke ger error på allt som inte är 2xx, men funktionen
           lägger sin förklaring i svarskroppen. Utan det här steget
           blir en saknad API-nyckel "non-2xx status code". */
        let svar = data;
        if (error && error.context && typeof error.context.json === 'function') {
          try { svar = await error.context.json(); } catch (e2) { /* behåll error */ }
        }
        if (!svar || svar.error || !Array.isArray(svar.forslag)) {
          säg(msg, '⚠️ ' + ((svar && svar.error) || felText(error) || 'Tomt svar.'), false);
          return;
        }

        S.matForslag = svar.forslag;
        ruta.querySelector('[data-dp-ai-lista]').innerHTML = matForslagHtml();
        säg(msg, '✓ Läs igenom dem innan du sparar. Facit står sist i varje uppgift.', true);
      });
      return;
    }

    const bort = ev.target.closest('[data-dp-mat-bort]');
    if (!bort) return;
    const d = S.detaljCache['elev:' + DP.id];
    const m = ((d && d.material) || []).find(x => x.id === bort.dataset.dpMatBort);
    const ja = await bekräfta({
      titel: 'Ta bort materialet?',
      text: '"' + ((m && m.title) || 'Materialet') + '" försvinner för både eleven och studiehjälparen.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    await medan(bort, 'Tar bort…', async () => {
      /* Filen i hinken först. Går raden bort men filen ligger kvar
         blir den omöjlig att nå och omöjlig att städa: sökvägen
         fanns bara i raden.

         Svaret LÄSES. Fram till Fas 9.2 hade admin ingen policy på
         hinken, så borttagningen nekades tyst medan raden försvann —
         och koden ovan beskrev en ordning som aldrig hölls. Nekas
         den igen ska raden stå kvar, så att filen går att hitta. */
      if (m && m.kind === 'fil' && m.url) {
        const { error: filfel } = await supa.storage.from('material').remove([m.url]);
        if (filfel) {
          alert('Filen kunde inte tas bort ur lagringen: ' + felText(filfel)
            + '\n\nRaden står kvar, annars hade filen blivit omöjlig att hitta.');
          return;
        }
      }
      const { error } = await supa.from('materials').delete().eq('id', bort.dataset.dpMatBort);
      if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
      delete S.detaljCache['elev:' + DP.id];
      await hämtaDetalj('elev', DP.id);
      ritaDetalj();
    });
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-dp-mat]');
    if (!form) return;
    ev.preventDefault();

    const msg = form.querySelector('[data-dp-mat-msg]');
    rensa(msg);

    const elevId = form.dataset.dpMat;
    const elev = S.elevlista.find(x => x.id === elevId);
    const vald = form.querySelector('[data-dp-mat-typ][aria-pressed="true"]');
    const sort = (vald && vald.dataset.dpMatTyp) || 'anteckning';
    const titel = form.titel.value.trim();
    const text = form.text.value.trim();
    const url = form.url.value.trim();

    const fel = !titel ? 'Ge materialet en rubrik.'
      : sort === 'anteckning' && !text ? 'Skriv uppgiften.'
      : sort === 'lank' && !url ? 'Klistra in adressen.'
      : sort === 'lank' && !/^https?:\/\//i.test(url)
        ? 'Adressen måste börja med http:// eller https://.'
        : null;
    if (fel) { säg(msg, '⚠️ ' + fel, false); return; }

    /* Se kommentaren över dpMaterial: hellre studiehjälparens namn
       än vårt, och alltid någon som får ta bort raden igen. */
    const hjälpare = elev && elevHjälpare(elev);
    const rad = {
      student_id: elevId,
      tutor_id: (hjälpare && hjälpare.id) || S.user.id,
      title: titel.slice(0, 200),
      kind: sort,
      subject: form.amne.value.trim() || null
    };
    if (sort === 'lank') rad.url = url; else rad.body = text;

    await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.from('materials').insert(rad);
      if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
      S.matForslag = [];
      delete S.detaljCache['elev:' + elevId];
      await hämtaDetalj('elev', elevId);
      ritaDetalj();
    });
  });

  function ritaDetalj(laddarÄn) {
    if (!DP.panel || !DP.typ) return;
    let flikar = DP_FLIKAR[DP.typ] || [];
    let person, rubrik, under, märken = '';

    if (DP.typ === 'pass') {
      person = S.bokningar.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      rubrik = 'Pass ' + kortDatum(person.wanted_date);
      under = [person.subject, elevNamn(person.student_id), namnFör(person.tutor_id)]
        .filter(x => x && x !== '—').join(' · ');
      märken = läge(BOK_LAGE, person.status)
        + (person.attendance === 'franvarande' ? ' ' + pill('Uteblev', 'ar-ny') : '');
    } else if (DP.typ === 'chatt') {
      const [förälder, hjälpare] = String(DP.id).split('|');
      person = { förälder: förälder, hjälpare: hjälpare };
      rubrik = namnFör(förälder) + ' och ' + namnFör(hjälpare);
      under = 'Chatten mellan familjen och studiehjälparen';
      märken = pill('Bara läsning', '');
    } else if (DP.typ === 'anmalan') {
      person = S.leads.find(x => x.id === DP.id);
      if (!person || ärRaderad(person)) { stängDetalj(); return; }
      rubrik = person.parent_name || person.email || '(namn saknas)';
      under = [person.child_name, person.grade, person.subject].filter(Boolean).join(' · ');
      märken = läge(LEAD_LAGE, person.status);
    } else if (DP.typ === 'ansokan') {
      person = S.ansokningar.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      rubrik = person.name || person.email || '(namn saknas)';
      under = [person.age ? person.age + ' år' : null, person.school].filter(Boolean).join(' · ');
      /* Var i rekryteringen hen står, som i listan (2026-10-13). Läget
         längre ned är fortfarande det som sparas. */
      märken = kör('stegLäge', person) || läge(ANS_LAGE, person.status);
    } else if (DP.typ === 'elev') {
      /* Ur alla elever, också de raderade: ett gammalt pass pekar på
         dem, och därifrån ska det gå att se varför namnet är borta. */
      person = (S.allaElever || S.elevlista).find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      const f = S.personer[person.parent_id];
      rubrik = person.name || '(namn saknas)';
      under = [person.grade, person.school, f && (f.full_name || f.email)]
        .filter(Boolean).join(' · ');
      märken = elevHjälpare(person) ? pill('Matchad', 'ar-klar') : pill('Ingen studiehjälpare', 'ar-ny');
    } else {
      person = S.personer[DP.id];
      if (!person) { stängDetalj(); return; }
      rubrik = person.full_name || person.email || '(namn saknas)';
      under = person.email || '';
      if (DP.typ === 'studiehjalpare') {
        const tp = S.tutorProfiler[DP.id] || {};
        märken = läge(SH_LAGE, tp.status);
      } else {
        /* Familjen är intagen; matchad är barnet (2026-10-21). Barnen
           står med sin studiehjälpare under fliken Barn. */
        const intagen = (S.intagenFör || {})[DP.id];
        märken = pill(intagen ? 'Intagen ' + kortDatum(intagen.intagen_at) : 'Intagen', 'ar-klar');
      }
      if (person.is_admin) märken += ' ' + pill('Admin', 'ar-vantar');
    }

    /* Ett pass och en chatt är ingen person: inget att radera eller
       redigera här. En raderad person har en flik, och inget att ändra. */
    const ärPerson = DP.typ !== 'pass' && DP.typ !== 'chatt';
    const raderad = ärPerson && ärRaderad(person);
    if (raderad) {
      flikar = [['oversikt', 'Raderad']];
      DP.flik = 'oversikt';
      DP.redigera = false;
      märken = pill('Raderad', '');
    }

    const d = S.detaljCache[DP.typ + ':' + DP.id];
    let kropp;
    if (laddarÄn || !d) kropp = laddar();
    else if (raderad) kropp = dpRaderad(DP.typ, person);
    else if (DP.redigera && ärPerson) kropp = dpRedigera(DP.typ, person);
    else if (DP.typ === 'pass') kropp = dpPass(person, d);
    else if (DP.typ === 'chatt') kropp = dpChatt(person, d);
    else if (DP.typ === 'anmalan') kropp = dpAnmalan(person);
    else if (DP.typ === 'ansokan') kropp = dpAnsokan(person);
    else if (DP.typ === 'familj') kropp = dpFamilj(person, d);
    else if (DP.typ === 'elev') kropp = dpElev(person, d);
    else kropp = dpStudiehjalpare(person, d);

    /* Chatten ritas om när en lista gör det (ritaPanelen), och en ny
       panel står överst. Den som läst sig bakåt i tråden ska stå kvar
       där; första gången tråden ritas står den vid det senaste, som i
       vyerna. */
    const förraKropp = DP.panel.querySelector('.dp-kropp');
    const rullning = DP.typ === 'chatt' && DP.chattRitad === DP.id && förraKropp ? förraKropp.scrollTop : null;

    DP.panel.innerHTML =
      '<div class="dp-topp">'
      /* Ett pass har inget ansikte; ämnet får ge initialen. Aldrig
         avatar_url: den är en sökväg i den privata hinken avatarer, inte
         en adress, och som bildadress blir den en trasig bild. */
      + M.avatar(DP.typ === 'pass' ? (person.subject || 'Pass') : DP.typ === 'chatt' ? 'Chatt' : rubrik, null, {})
      + '<span class="dp-namn"><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '')
      + (märken ? '<span class="dp-marken">' + märken + '</span>' : '')
      + '</span>'
      + '<button class="dp-stang" type="button" data-dp-stang aria-label="Stäng">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>'
      + '</div>'
      + '<div class="dp-flikar" role="tablist">'
      + flikar.map(f => '<button class="dp-flik" type="button" role="tab" data-dp-flik="' + f[0] + '"'
        + ' aria-selected="' + (f[0] === DP.flik) + '">' + esc(f[1]) + '</button>').join('')
      + '</div>'
      + '<div class="dp-kropp">' + kropp + '</div>';

    if (DP.typ === 'chatt' && d && !laddarÄn) {
      const nyKropp = DP.panel.querySelector('.dp-kropp');
      if (rullning != null) nyKropp.scrollTop = rullning;
      else { nyKropp.scrollTop = nyKropp.scrollHeight; DP.chattRitad = DP.id; }
    }
  }

  /* Skicka inbjudan igen (dpSenast). Mejlet är riktigt, så frågan
     kommer först; svaret säger vad som gick. */
  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-bjud-igen]');
    if (!k) return;
    const p = S.personer[k.dataset.dpBjudIgen];
    if (!p || !p.email) return;
    /* Varje ny länk gör den förra oanvändbar: frågan säger att det är det
       senaste mejlet som gäller. Mejlet har tiden i ämnet, så Gmail lägger
       det inte i samma tråd som de förra (_delad/notiser/konto.ts). */
    const ja = await bekräfta({
      titel: 'Skicka länken igen till ' + (p.full_name || p.email) + '?',
      text: (p.last_seen_at
        ? 'En länk där hen väljer ett nytt lösenord går till ' + p.email + ', samma som Glömt lösenordet. '
          + 'Det nuvarande lösenordet fungerar tills hen valt ett nytt.'
        : 'Har hen inte tryckt på länken i inbjudan går en ny inbjudan till ' + p.email + '. Har hen tryckt '
          + 'men inte valt lösenord går en länk för att välja det.')
        + ' Bara länken i det nya mejlet fungerar sedan.',
      knapp: 'Skicka'
    });
    if (!ja) return;
    await medan(k, 'Skickar…', async () => {
      const res = await supa.functions.invoke('bjud-in', { body: { epost: p.email, igen: true } });
      const fel = res.error || (res.data && res.data.error);
      if (fel) { alert(await funktionsFel(fel)); return; }
      alert(res.data.skickat === 'losenord'
        ? 'En länk för att välja lösenord har gått till ' + res.data.till + '.'
        : 'En ny inbjudan har gått till ' + res.data.till + '.');
    });
  });

  /* Gratistimmarna (dpTimbank). Databasen avgör: bara en superadmin
     sätter in och tar tillbaka, 1–40 timmar åt gången. Efter en ändring
     hämtas allt om, för timmarna kan ha betalat familjens pass, och
     Betalningar → Köpta timmar ritas om med panelen. */
  const gratisTimmar = n => (n === 1 ? '1 gratistimme' : n + ' gratistimmar');
  const saknasFunktion = fel => fel && (fel.code === 'PGRST202' || /could not find the function/i.test(String(fel.message || '')));

  async function efterGratis(id, text, ok) {
    gratisBesked = { id, text, ok };
    await hämtaAllt();
    // Insättningarnas rader står i panelens egen hämtning.
    delete S.detaljCache['familj:' + id];
    await hämtaDetalj('familj', id);
    kör('ritaKortbetalningar');
    if (DP.typ === 'familj' && DP.id === id) ritaDetalj();
  }

  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-dp-gratis]');
    if (!f) return;
    ev.preventDefault();
    const id = f.dataset.dpGratis;
    const n = Number(String(f.elements.timmar.value).trim());
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      alert('Sätt in ett helt antal timmar, mellan 1 och 40.');
      return;
    }
    /* Orsaken krävs och prövas igen i databasen (3–500 tecken). */
    const orsak = String(f.elements.orsak.value || '').trim();
    if (orsak.length < 3) {
      alert('Skriv varför timmarna sätts in, minst tre tecken.');
      f.elements.orsak.focus();
      return;
    }
    const manad = f.elements.manad.value || null;
    const sista = new Date();
    sista.setDate(sista.getDate() + 60);
    const ja = await bekräfta({
      titel: 'Sätt in ' + gratisTimmar(n) + '?',
      text: namnFör(id) + ' får dem i sin timbank i dag, och de gäller till och med ' + datumText(isoFor(sista)) + '. '
        + 'De avser ' + (manad ? månadText(manad) : 'den här månaden') + ', och orsaken sparas: "' + orsak + '". '
        + 'De betalar familjens pass före köpta timmar, också förslag och bokade pass som inte är betalda. '
        + 'Studiehjälparen får lön för passen som vanligt.',
      knapp: 'Sätt in ' + gratisTimmar(n)
    });
    if (!ja) return;
    await medan(f.querySelector('button[type="submit"]'), 'Sätter in…', async () => {
      const { data, error } = await supa.rpc('ge_gratistimmar', { p_familj: id, p_timmar: n, p_orsak: orsak, p_manad: manad });
      if (error) {
        alert('Kunde inte sätta in: ' + (saknasFunktion(error)
          ? 'funktionen med orsak finns inte i databasen än (migrationen timmar_med_orsak).' : felText(error)));
        return;
      }
      const betalda = Number((data && data.betalda_pass) || 0);
      await efterGratis(id, gratisTimmar(n) + ' insatta, till och med ' + datumText(String(data.giltigt_till)) + '.'
        + (betalda ? ' De betalade ' + (betalda === 1 ? '1 pass' : betalda + ' pass') + ' direkt.' : ''), true);
    });
  });

  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-gratis-tillbaka]');
    if (!k) return;
    const kortId = k.dataset.dpGratisTillbaka;
    const kortet = (S.klippkort || []).find(x => x.id === kortId);
    if (!kortet) return;
    const ja = await bekräfta({
      titel: 'Ta tillbaka gratistimmarna?',
      text: (Number(kortet.kvar) === 1 ? 'Den gratistimme' : 'De ' + gratisTimmar(Number(kortet.kvar)))
        + ' som inte används försvinner ur timbanken hos ' + namnFör(kortet.parent_id)
        + '. Timmar som redan ligger på ett förslag eller ett bokat pass står kvar där.',
      knapp: 'Ta tillbaka'
    });
    if (!ja) return;
    await medan(k, 'Tar tillbaka…', async () => {
      const { data, error } = await supa.rpc('ta_tillbaka_gratistimmar', { p_id: kortId });
      if (error) { alert('Kunde inte ta tillbaka: ' + felText(error)); return; }
      const tillbaka = Number((data && data.tillbaka) || 0);
      await efterGratis(kortet.parent_id, tillbaka
        ? gratisTimmar(tillbaka) + ' togs tillbaka.'
          + (Number(data.pa_pass) ? ' ' + (Number(data.pa_pass) === 1 ? '1 timme' : data.pa_pass + ' timmar')
            + ' står kvar på familjens pass.' : '')
        : 'Inget att ta tillbaka: alla timmarna ligger redan på familjens pass.', true);
    });
  });

  /* Familjerabatten (dpRabatt). Databasen avgör: bara en superadmin sätter,
     byter och tar bort, och bara en aktiv kod. Efter ändringen hämtas
     koderna och familjernas rader om, och fliken Familjerabatter med. */
  async function efterRabatt(id, text, ok) {
    rabattBesked = { id, text, ok };
    await kör('hämtaFamiljerabatter');
    kör('ritaFamiljerabatter');
    if (DP.typ === 'familj' && DP.id === id) ritaDetalj();
  }

  document.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-dp-rabatt]');
    if (!f) return;
    ev.preventDefault();
    const id = f.dataset.dpRabatt;
    const kod = (S.familjerabatter || []).find(k => k.kod === f.elements.kod.value);
    if (!kod) return;
    const nu = ((S.familjensRabatt || {})[id] || {}).kod || null;
    if (nu === kod.kod) return;
    const ja = await bekräfta({
      titel: (nu ? 'Byt till ' : 'Ge ') + kod.kod + '?',
      text: namnFör(id) + ' betalar ' + kronor(kod.ore_per_timme) + ' mindre för varje timme: pass, planer och '
        + 'timmar till en plan, för det som bokas och köps från och med nu, tills ni tar bort rabatten. Familjen ser aldrig '
        + 'koden, bara det lägre priset. Det som redan är bokat och köpt behåller sitt pris.',
      knapp: nu ? 'Byt' : 'Ge rabatten'
    });
    if (!ja) return;
    await medan(f.querySelector('button[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.rpc('satt_familjerabatt', { p_familj: id, p_kod: kod.kod });
      if (error) { await efterRabatt(id, 'Kunde inte spara: ' + felText(error), false); return; }
      await efterRabatt(id, kod.kod + ' gäller nu: ' + kronor(kod.ore_per_timme) + ' av per timme på det som bokas och köps.', true);
    });
  });

  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-rabatt-bort]');
    if (!k) return;
    const id = k.dataset.dpRabattBort;
    const nu = ((S.familjensRabatt || {})[id] || {}).kod || null;
    if (!nu) return;
    const ja = await bekräfta({
      titel: 'Ta bort familjerabatten?',
      text: namnFör(id) + ' betalar ordinarie pris för det som bokas och köps från och med nu. Det som redan är bokat och '
        + 'köpt behåller priset med rabatten.',
      knapp: 'Ta bort'
    });
    if (!ja) return;
    await medan(k, 'Tar bort…', async () => {
      const { error } = await supa.rpc('satt_familjerabatt', { p_familj: id, p_kod: null });
      if (error) { await efterRabatt(id, 'Kunde inte ta bort: ' + felText(error), false); return; }
      await efterRabatt(id, 'Familjerabatten ' + nu + ' är borttagen.', true);
    });
  });

  /* Ta bort familjens kort (dpKortet), till exempel när familjen ber om
     det. stripe-checkout prövar att den som frågar är admin, kopplar bort
     kortet hos Stripe och tar bort raden; jobbet släpper det som är
     reserverat. */
  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-kort-bort]');
    if (!k) return;
    const id = k.dataset.dpKortBort;
    const ja = await bekräfta({
      titel: 'Ta bort kortet?',
      text: 'Kortet tas bort hos Stripe för ' + namnFör(id) + '. Pass där familjen valt kort betalas efter passet i '
        + 'stället, och det som är reserverat släpps inom några minuter.',
      knapp: 'Ta bort kortet'
    });
    if (!ja) return;
    await medan(k, 'Tar bort…', async () => {
      const res = await supa.functions.invoke('stripe-checkout', { body: { kort: 'ta_bort', familj: id } });
      const fel = res.error || (res.data && res.data.error);
      if (fel) { alert(await funktionsFel(fel)); return; }
      delete S.detaljCache['familj:' + id];
      await hämtaDetalj('familj', id);
      if (DP.typ === 'familj' && DP.id === id) ritaDetalj();
    });
  });

  /* Efterskänk avgiften för en sen avbokning (sen_avbokning, 2026-10-22).
     Båda kolumnerna blir null och inget annat (stampla_avbokningen). Var
     passet betalt med timmar kommer de tillbaka; var avgiften betald med
     kort ligger hela beloppet under Att göra som något att återbetala. */
  document.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-dp-sen-efterskank]');
    if (!k) return;
    const id = k.dataset.dpSenEfterskank;
    const b = (S.bokningar || []).find(x => x.id === id);
    if (!b) return;
    const ja = await bekräfta({
      titel: 'Efterskänk avgiften?',
      text: 'Passet ' + kortDatum(b.wanted_date) + ' blir en vanlig avbokning för ' + namnFör(b.parent_id) + ', utan avgift. '
        + (b.klippkort_id || (S.timbankPass && S.timbankPass.has(b.id))
          ? 'Tiden som drogs kommer tillbaka till timmarna.'
          : Number(b.betalt_ore || 0) > 0
            ? 'Det familjen betalat ska då tillbaka: återbetala det under Betalningar → Att göra.'
            : 'Familjen har inget att betala för passet.'),
      knapp: 'Efterskänk'
    });
    if (!ja) return;
    await medan(k, 'Sparar…', async () => {
      const { data, error } = await supa.from('bookings')
        .update({ sen_avbokning_minuter: null, sen_avbokning_ore: null }).eq('id', id)
        .select('id, betalning_status, betald_at, sen_avbokning_minuter, sen_avbokning_ore');
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      if (!data || !data.length) {
        alert('Ingenting sparades. Raden finns inte längre, eller så får du inte ändra den.');
        return;
      }
      Object.assign(b, data[0]);
      delete S.detaljCache['pass:' + id];
      await hämtaDetalj('pass', id);
      if (DP.typ === 'pass' && DP.id === id) ritaDetalj();
      await kör('laddaOmEkonomi');
    });
  });

  /* Öppnas från vilken lista som helst, och från panelen själv:
     en elev leder till sin familj, en familj till sina barn. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-dp]');
    if (!k) return;
    const [typ, id] = String(k.dataset.dp).split(':');
    öppnaDetalj(typ, id, k.dataset.dpStart);
  });

  /* Rättelsen av en anmälan till betygsgarantin: knappen fäller ut
     formuläret under raden, och efter sparandet hämtas eleven om. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-dp-garanti-ratta]');
    if (!k) return;
    const f = document.querySelector('form[data-dp-garanti="' + k.dataset.dpGarantiRatta + '"]');
    if (f) f.hidden = !f.hidden;
  });

  document.addEventListener('submit', async e => {
    const f = e.target.closest('form[data-dp-garanti]');
    if (!f) return;
    e.preventDefault();
    const msg = f.querySelector('[data-dp-garanti-msg]');
    rensa(msg);
    const elev = DP.id;
    await medan(f.querySelector('button[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.rpc('andra_betygsgaranti',
        { p_id: f.dataset.dpGaranti, p_amne: f.amne.value, p_betyg: f.betyg.value });
      if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
      delete S.detaljCache['elev:' + elev];
      await hämtaDetalj('elev', elev);
      if (DP.typ === 'elev' && DP.id === elev) ritaDetalj();
    });
  });

  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-dp-not]');
    if (!f) return;
    e.preventDefault();
    const msg = f.querySelector('[data-dp-not-msg]');
    const text = f.text.value.trim();
    if (!text) return;
    const profilId = f.dataset.dpNot;
    const { error } = await supa.from('admin_noteringar')
      .insert({ om_profil: profilId, text, skriven_av: S.user.id });
    if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
    /* Cachen är nu inaktuell för den här personen. Att tömma den
       och hämta om är billigare än att gissa vad servern satte
       för id och tidsstämpel. */
    delete S.detaljCache[DP.typ + ':' + profilId];
    await hämtaDetalj(DP.typ, profilId);
    ritaDetalj();
  });



  /* Det andra områden anropar. stängDetalj anropas av raderingen, som
     inte har något kvar att visa efteråt, och öppnaDetalj av Flytta till
     familjen, som visar familjen anmälan flyttades till. */
  Object.assign(NXAdmin.rita, {
    ritaDetalj, stängDetalj, öppnaDetalj
  });
})();
