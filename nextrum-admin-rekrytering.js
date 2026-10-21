/* ============================================================
   NEXTRUM — adminvyn, Rekrytering: ansökningarnas steg, intervju, utbildning, kontot

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, rensa, felText } = NX;
  const { bekräfta, medan } = NXStudie;
  const M = NXMedia;

  const { S, fråga, funktionsFel, gmailAdress, hämtaAllt, hämtaMatchunderlag, kontaktaRuta,
          kortDatum, läge, matchar, märkFlik, namnlista, närText, ritaPanelen, tomtText, visaRuta,
          ärNyNu, ärRaderad } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* ============================================================
     ANSÖKNINGARNAS STEG (2026-10-21)

     Leo: "Lägen: Ny, Intervju, Utbildning, Konto skapat. En ansökan finns
     i exakt ett läge åt gången. Vyn 'Alla ansökningar' visar bara de som
     ligger i Ny." Databasen räknar steget ur det ansökan bär
     (applications.steg, migrationen ansokningarnas_steg) och vaktar
     bytena: Ny till Intervju och tillbaka, Intervju till Utbildning,
     Utbildning till Konto skapat. Flikarna, listan och panelen läser
     samma steg, så en person står på ett ställe.

     Avböjd är inget steg utan ett beslut, och en avböjd ansökan står i
     sin egen flik. Före migrationen räknas steget här, med samma regel
     som intern.ansokan_steg.
     ============================================================ */
  function ansSteg(a) {
    if (!a) return 'ny';
    if (a.status === 'rejected') return 'avbojd';
    if (a.steg) return a.steg;
    if (a.konto_id || a.status === 'approved') return 'konto_skapat';
    if (a.intervju_at || a.utbildningsmote_at || a.utbildad_at) return 'utbildning';
    if (a.till_intervju_at) return 'intervju';
    return 'ny';
  }

  const ANS_STEG = {
    ny: ['Ny', 'ar-ny'], intervju: ['Intervju', 'ar-vantar'], utbildning: ['Utbildning', 'ar-vantar'],
    konto_skapat: ['Konto skapat', 'ar-klar'], avbojd: ['Avböjd', '']
  };
  const stegLäge = a => läge(ANS_STEG, ansSteg(a));

  /* Nya ansökningar: bara de som står i Ny. Söket går mot allt de skrev. */
  function ritaAnsokningar() {
    const sök = $('#ans-sok') ? $('#ans-sok').value.trim() : '';
    const nya = S.ansokningar.filter(a => ansSteg(a) === 'ny');
    const rader = nya.filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = sök ? rader.length + ' av ' + nya.length : (nya.length ? nya.length + ' st' : '');
    $('#ans-tabell').innerHTML = namnlista(rader, {
      typ: 'ansokan', id: a => a.id,
      namn: a => a.name || a.email,
      läge: stegLäge,
      /* Den som kom in sedan du tittade senast (2026-10-05, ärNyNu). */
      nytt: a => ärNyNu('ansokningar', a),
      under: a => (ärNyNu('ansokningar', a) ? 'Ny sedan du tittade senast · ' : '') + 'Kom in ' + närText(a.created_at),
      knapp: a => vidareKnapp('intervju', a, 'Till intervju'),
      tomt: tomtText(sök, 'Ingen ny ansökan matchar söket', 'Inga nya ansökningar')
    });

    ritaStegflikar();
    ritaPanelen();
  }

  function vidareKnapp(steg, a, text, primär) {
    return '<button type="button" class="btn ' + (primär ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-ans-vidare="'
      + steg + ':' + esc(a.id) + '">' + esc(text) + '</button>';
  }

  function hållenKnapp(a, primär) {
    return '<button type="button" class="btn ' + (primär ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-ans-hallen="'
      + esc(a.id) + '">Utbildning hållen</button>';
  }

  /* Intervjumejlet, kort: när länken gick, eller att den inte gått. */
  function länkenText(a) {
    if (!('intervju_mejl_skickat_at' in a)) return '';
    return a.intervju_mejl_skickat_at ? 'länken mejlad ' + kortDatum(a.intervju_mejl_skickat_at) : 'länken inte mejlad';
  }

  /* Stegen som egna flikar, med antal. I den ordning de kom till steget. */
  function ritaStegflikar() {
    const i = steg => S.ansokningar.filter(a => ansSteg(a) === steg);
    const efter = f => (a, b) => String(f(a) || a.created_at).localeCompare(String(f(b) || b.created_at));
    const intervju = i('intervju').sort(efter(a => a.till_intervju_at));
    const utbildning = i('utbildning').sort(efter(a => a.intervju_at || a.utbildningsmote_at));
    const konto = i('konto_skapat').sort(efter(a => a.utbildad_at)).reverse();
    const avbojda = i('avbojd').sort(efter(a => a.created_at)).reverse();

    märkFlik('#flik-ans-alla-mark', i('ny').length);
    märkFlik('#flik-ans-intervju-mark', intervju.length);
    märkFlik('#flik-ans-utbildning-mark', utbildning.length);
    märkFlik('#flik-ans-konto-mark', konto.length);
    märkFlik('#flik-ans-avbojda-mark', avbojda.length);

    const lista = (sel, rader, o) => {
      const el = $(sel);
      if (!el) return;
      const antal = $(sel + '-antal');
      if (antal) antal.textContent = rader.length ? rader.length + ' st' : '';
      el.innerHTML = namnlista(rader, Object.assign({ typ: 'ansokan', id: a => a.id, namn: a => a.name || a.email }, o));
    };

    lista('#ans-intervju', intervju, {
      under: a => ['I intervju sedan ' + kortDatum(a.till_intervju_at), länkenText(a)].filter(Boolean).join(' · '),
      knapp: a => vidareKnapp('utbildning', a, 'Till utbildning'),
      tomt: 'Ingen står i intervju. Skicka hit från Nya ansökningar.'
    });
    lista('#ans-utbildning', utbildning, {
      under: a => 'Intervjuad ' + kortDatum(a.intervju_at || a.utbildningsmote_at),
      knapp: a => hållenKnapp(a),
      tomt: 'Ingen är i utbildningen. Skicka hit från Intervju.'
    });
    lista('#ans-konto', konto, {
      under: a => 'Konto skapat' + (a.utbildad_at ? ' ' + kortDatum(a.utbildad_at) : ''),
      tomt: 'Ingen har fått sitt konto än.'
    });
    lista('#ans-avbojda', avbojda, {
      under: a => 'Sökte ' + kortDatum(a.created_at),
      tomt: 'Ingen är avböjd.'
    });
  }

  /* ---- skicka vidare: till intervju, till utbildning ----
     Till intervju köar intervjumejlet med länken till bokningssidan, en
     gång per ansökan, så den visar mejlet först. Till utbildning är
     intervjun hållen: den mejlar ett tack som säger att introduktionen är
     nästa steg. Ett mejl går inte att ta tillbaka, och knappen står ett
     tryck från listan, så båda frågar först. Databasen vaktar stegen
     (ansokningarnas_steg) och säger nej till ett steg i fel ordning. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vidare]');
    if (!knapp) return;
    const [steg, id] = knapp.dataset.ansVidare.split(':');
    const a = S.ansokningar.find(x => x.id === id);
    if (!a) return;

    let ändring;
    if (steg === 'intervju') {
      if (ansSteg(a) !== 'ny') return;
      if (!(await bekräftaIntervju(a))) return;
      ändring = { till_intervju_at: new Date().toISOString() };
    } else if (steg === 'utbildning') {
      if (ansSteg(a) !== 'intervju') return;
      const ja = await bekräfta({
        titel: 'Skicka ' + (a.name || 'den sökande') + ' till utbildningen?',
        text: 'Intervjun markeras som hållen, och ' + (a.name || 'hen') + ' får ett mejl som tackar för '
          + 'mötet och säger att introduktionen är nästa steg. Steget går inte att ångra. När utbildningen '
          + 'är hållen trycker du Utbildning hållen, som skapar kontot.',
        knapp: 'Skicka till utbildningen',
        avbryt: 'Avbryt'
      });
      if (!ja) return;
      ändring = { intervju_at: new Date().toISOString() };
    } else {
      return;
    }

    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update(ändring).eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte spara: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      await hämtaBesked(a.id);
      ritaOm();
    });
  });

  /* ---- Ångra intervju ----
     Tillbaka till Nya ansökningar. Mejlet som gått går inte att ta
     tillbaka, och det går inte igen om hen skickas vidare på nytt: då är
     det Skicka intervjulänk igen. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-angra]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansAngra);
    if (!a || ansSteg(a) !== 'intervju') return;
    const ja = await bekräfta({
      titel: 'Ångra intervjun för ' + (a.name || 'den sökande') + '?',
      text: (a.name || 'Den sökande') + ' flyttas tillbaka till Nya ansökningar. '
        + (a.intervju_mejl_skickat_at
          ? 'Intervjumejlet gick ' + kortDatum(a.intervju_mejl_skickat_at) + ' och går inte att ta tillbaka. '
            + 'Skickar du hen vidare igen går det inte en gång till; använd då Skicka intervjulänk igen.'
          : 'Inget mejl har gått.'),
      knapp: 'Ångra intervjun',
      avbryt: 'Avbryt'
    });
    if (!ja) return;
    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update({ till_intervju_at: null }).eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte ångra: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      ritaOm();
    });
  });

  /* ---- Skicka intervjulänk igen ----
     Samma mejl som när hen skickades vidare, köat en gång till genom
     notiskön (ansokan_intervjulank_igen), högst en gång i tio minuter
     och bara medan hen står i Intervju. Länken står i
     INTERVJU_BOKNINGSLANK: saknas den skickas inget. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-igen]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansIgen);
    if (!a || ansSteg(a) !== 'intervju') return;
    if (!bokningssida()) {
      alert('Ingen bokningssida är satt, så det finns ingen länk att skicka. Lägg länken till '
        + 'bokningsschemat i Google Kalender i INTERVJU_BOKNINGSLANK i nextrum-config.js först.');
      return;
    }
    const namn = förnamn(a.name);
    const ja = await bekräfta({
      titel: 'Skicka intervjulänken igen till ' + (a.name || 'den sökande') + '?',
      text: (a.name || 'Den sökande') + ' får mejlet nedan inom några minuter, till ' + (a.email || 'adressen i ansökan') + '.',
      forhandsvisning: intervjumejlet(namn),
      knapp: 'Skicka länken',
      avbryt: 'Avbryt'
    });
    if (!ja) return;
    await medan(knapp, 'Skickar…', async () => {
      const { data, error } = await supa.rpc('ansokan_intervjulank_igen', { p_ansokan: a.id });
      if (error) {
        alert(error.code === 'PGRST202'
          ? 'Funktionen finns inte i databasen än: migrationen ansokningarnas_steg är inte körd.'
          : 'Länken skickades inte: ' + felText(error));
        return;
      }
      if (!data || !data.ok) { alert((data && data.fel) || 'Länken skickades inte.'); return; }
      /* Kön skriver ingen tid på ansökan för ett mejl till; panelen säger
         det tills vyn hämtas om. */
      S.intervjulankIgen = Object.assign(S.intervjulankIgen || {}, { [a.id]: new Date().toISOString() });
      ritaOm();
    });
  });

  /* ============================================================
     CV:T

     Den som söker kan bifoga ett CV. NX.kopplaAnsökan i
     nextrum-app.js laddar upp det till den privata hinken "cv" och
     skriver sökvägen som raden "CV: cv/<sökväg>" i ansökans why. Den
     som söker har inget konto och ingen rad att peka på när filen
     laddas upp, så raden är den enda kopplingen mellan filen och
     ansökan. Ändras formatet där ska CV_RAD ändras här i samma
     ändring: annars försvinner knappen utan att något blir rött.

     Hinken hade ingen läsregel alls. CV:t kom fram, men bara
     service_role nådde det, och här stod sökvägen som text. Sedan
     migrationen admin_laser_ansokans_cv läser admin och ingen annan.

     Gick uppladdningen inte igenom står det som en egen rad i why.
     Det visas i stället för knappen, för den som sökt tror att CV:t
     kom fram, och då frågar ingen efter det.
     ============================================================ */
  const CV_RAD = /^CV: cv\/(\d+-[0-9a-z]*-[\w.\-]+)$/m;
  const CV_FEL = /^CV: bifogad fil .* kunde inte laddas upp.*$/m;

  function cvVäg(a) {
    const m = CV_RAD.exec(String(a.why || ''));
    return m ? m[1] : null;
  }

  /* Filens eget namn, utan tiden och slumpen som gör sökvägen unik. */
  function cvNamn(väg) { return väg.replace(/^\d+-[0-9a-z]*-/, ''); }

  /* En PDF visas i webbläsaren. Word gör det inte och laddas ned, och
     knappen säger vilket av dem som händer. Tom sträng när ansökan
     inte har något CV. */
  function cvKnapp(a) {
    const väg = cvVäg(a);
    if (väg) {
      return '<button type="button" class="btn btn-ghost btn-sm" data-ans-cv="' + esc(a.id)
        + '" title="' + esc(cvNamn(väg)) + '">'
        + (/\.pdf$/i.test(väg) ? 'Öppna CV' : 'Ladda ned CV') + '</button>';
    }
    return CV_FEL.test(String(a.why || ''))
      ? '<span class="adm-und">CV:t kom inte fram. Be om det via mejl.</span>'
      : '';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-cv]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansCv);
    const väg = a && cvVäg(a);
    if (!väg) return;

    if (/\.pdf$/i.test(väg)) {
      /* Fliken öppnas i samma tryck, innan länken finns. Ett fönster
         som öppnas efter en väntan på nätet räknas inte längre som
         användarens i Safari och stoppas tyst: knappen hade sett ut
         att inte göra någonting. */
      const flik = window.open('', '_blank');
      if (!flik) {
        alert('Webbläsaren stoppade fliken. Tillåt popupfönster för nextrum.se och tryck igen.');
        return;
      }
      flik.opener = null;
      await medan(knapp, 'Öppnar…', async () => {
        /* Fem minuter. Länken i adressfältet öppnar filen för vem som
           helst så länge den gäller, och det är ett CV, ofta en
           sextonårings. */
        const url = await M.signera('cv', väg, 300);
        if (!url) {
          flik.close();
          alert('CV:t gick inte att öppna. Filen kan ha tagits bort ur lagringen.');
          return;
        }
        flik.location.replace(url);
      });
      return;
    }

    /* Word hämtas hit och sparas med sitt eget namn. I en ny flik hade
       filen laddats ned och lämnat en tom flik efter sig. PDF:en kan
       inte gå samma väg: en blob-adress ärver adminvyns CSP, och
       object-src 'none' stoppar webbläsarens PDF-visare. */
    await medan(knapp, 'Hämtar…', async () => {
      const { data, error } = await supa.storage.from('cv').download(väg);
      if (error) { alert('CV:t gick inte att hämta: ' + felText(error)); return; }
      const url = URL.createObjectURL(data);
      const länk = document.createElement('a');
      länk.href = url;
      länk.download = cvNamn(väg);
      document.body.appendChild(länk);
      länk.click();
      länk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  });

  /* Mallarna. Skrivna för att kunna skickas som de är, men de är
     utkast: rutan är redigerbar just för att ingen familj ska få ett
     mejl som låter som ett formulär. */
  /* Mejlet går härifrån, från info@, genom ansokan-mejl (2026-10-20).
     Funktionen tar adressen ur ansökan, så bara id:t skickas. Svaret är
     felet som text, eller null när mejlet gått. */
  async function skickaTill(a, brev) {
    const { data, error } = await supa.functions.invoke('ansokan-mejl',
      { body: { ansokan: a.id, amne: brev.amne, text: brev.text, forsok: brev.forsok } });
    /* En funktion som inte är driftsatt svarar 404 med Supabases egen text
       på engelska: säg vad det betyder i stället. */
    if (error && error.context && error.context.status === 404) return 'ansokan-mejl är inte driftsatt än.';
    if (error) return await funktionsFel(error);
    return data && data.ok ? null : 'Okänt svar.';
  }

  /* Bokningssidan i Google Kalender (2026-10-20, INTERVJU_BOKNINGSLANK).
     Bara en https-adress, som möteslänken: mejlet går ut med vår
     avsändare, och en adress som inte är en länk hade stått som text. */
  function bokningssida() {
    const u = String(CFG.INTERVJU_BOKNINGSLANK || '').trim();
    return /^https:\/\/\S+$/.test(u) ? u : '';
  }

  /* Skriv till hen: ett eget mejl från info@, när något ska sägas som
     inget av stegens mejl säger. Länken till intervjun har sin egen
     knapp (Skicka intervjulänk igen, 2026-10-21), så mallen är bara
     hälsningen och rutan är redigerbar. */
  function mallSkriv(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n\n\n'
      + 'Hälsningar,\nLeo och Alex, Nextrum';
  }
  /* ---- skriv till en sökande ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-kontakt]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansKontakt);
    if (!a) return;

    kontaktaRuta({
      titel: 'Skriv till ' + (a.name || a.email || ''),
      namn: a.name, till: a.email,
      amne: 'Din ansökan till Nextrum',
      text: mallSkriv(a),
      skicka: brev => skickaTill(a, brev),
      /* Att vi skrivit står på ansökan (gallringen räknar från det), men
         det flyttar ingen: stegen byts med sina egna knappar. */
      efterat: async () => {
        const ändring = { kontaktad_at: new Date().toISOString() };
        const { error } = await supa.from('applications').update(ändring).eq('id', a.id);
        if (error) { alert('Det sparades inte att du skrev till hen: ' + felText(error)); return; }
        Object.assign(a, ändring);
        ritaOm();
      }
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
    sista_steget: 'Sista steget',
    valkommen: 'Välkomstmejlet',
    /* 2026-10-05 */
    vardnadshavare: 'Mejlet till vårdnadshavaren',
    avbojd: 'Nejet'
  };

  /* När ett köat mejl går, i svensk tid: "i dag kl. 14:35", "i morgon
     kl. 09:00". Bara nejet har en tid (skicka_efter). */
  const STHLM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function sthlm(d) {
    const p = {};
    STHLM.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return { dag: p.year + '-' + p.month + '-' + p.day, tim: Number(p.hour), klocka: p.hour + ':' + p.minute };
  }
  function dagOrd(dag) {
    const idag = sthlm(new Date()).dag;
    const imorgon = sthlm(new Date(Date.now() + 24 * 3600 * 1000)).dag;
    return dag === idag ? 'i dag' : dag === imorgon ? 'i morgon' : kortDatum(dag);
  }
  function närDetGår(iso) {
    const t = sthlm(new Date(iso));
    return dagOrd(t.dag) + ' kl. ' + t.klocka;
  }

  /* Omförsöken ger upp efter tredje försöket eller efter ett dygn
     (intern.ansokan_besked_igen). Därefter är det en människas tur. */
  const DYGN = 24 * 3600 * 1000;

  function besked(a, steg) {
    const rad = (S.ansokanUtskick[a.id] || []).find(r => r.steg === steg);
    if (!rad) return '';
    /* Dygnet räknas från när mejlet fick gå, som omförsöken gör. */
    const start = rad.skicka_efter || rad.skapad;
    const väntar = rad.status === 'vantar' && rad.skicka_efter && new Date(rad.skicka_efter).getTime() > Date.now();
    const uppgett = !väntar && (rad.forsok >= 3 || Date.now() - new Date(start).getTime() > DYGN);
    const läge = {
      skickad: '✓ mejlat ' + kortDatum(rad.uppdaterad),
      vantar: väntar ? 'går ' + närDetGår(rad.skicka_efter) + '. Byt läget före dess så går det inte.'
        : uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      skickar: uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      fel: 'gick inte fram' + (rad.fel ? ' (' + rad.fel + ')' : '')
        + (uppgett ? '. Försöker inte igen — skriv själv.' : '. Försöker igen om en stund.'),
      bromsad: 'skickades inte' + (rad.fel ? ': ' + rad.fel : ''),
      hoppad: 'skickades inte, ' + (rad.fel || 'beskedet hann bli inaktuellt')
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
    /* Alla kolumner: skicka_efter finns först med migrationen
       ansokan_vardnadshavare_och_nej (se hämtaAllt i kärnan). */
    const { data, error } = await supa.from('ansokan_utskick')
      .select('*')
      .eq('ansokan_id', id).order('skapad', { ascending: false });
    if (!error) S.ansokanUtskick[id] = data || [];
  }

  /* ============================================================
     PANELEN: VAR HEN STÅR (2026-10-21)

     Leo: "Korta ner intervjudelen kraftigt: status plus tre knappar,
     inget annat. ... Gör hela profilen enkel att läsa: tydlig rubrik,
     uppgifterna kompakt, en tydlig nästa-åtgärd." Förut var det en egen
     flik, Rekryteringen, med fyra steg, skälet till varje steg och
     knappar för mötet, utbildningsmötet och Markera utbildad. Nu ett
     block överst i ansökan: steget, när hen kom dit, och knapparna för
     just det steget. Boka digitalt möte är borta: hen bokar själv på
     bokningssidan (INTERVJU_BOKNINGSLANK), och Google mejlar tiden och
     Meet-länken.
     ============================================================ */
  function ritaOm() {
    ritaAnsokningar();
  }

  function stegRuta(rubrik, text, knappar) {
    return '<div class="ans-nu">'
      + '<div class="ans-nu-text"><b>' + esc(rubrik) + '</b>' + (text ? '<span>' + esc(text) + '</span>' : '') + '</div>'
      + (knappar ? '<div class="ans-nu-knappar">' + knappar + '</div>' : '')
      + '</div>';
  }

  /* Blocket överst i ansökan (dpAnsokan i nextrum-admin-detalj.js). */
  function nästaSteg(a) {
    const st = ansSteg(a);
    const id = esc(a.id);
    if (st === 'ny') {
      return stegRuta('Ny', 'Kom in ' + kortDatum(a.created_at) + '.',
        vidareKnapp('intervju', a, 'Skicka till intervju', true));
    }
    if (st === 'intervju') {
      const igen = (S.intervjulankIgen || {})[a.id];
      const länken = igen ? 'länken mejlad igen ' + närText(igen)
        : a.intervju_mejl_skickat_at ? 'länken mejlad ' + kortDatum(a.intervju_mejl_skickat_at)
          : 'länken inte mejlad';
      return stegRuta('Intervju', 'Sedan ' + kortDatum(a.till_intervju_at) + ' · ' + länken + '.',
        '<button type="button" class="btn btn-ghost btn-sm" data-ans-igen="' + id + '">Skicka intervjulänk igen</button>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-ans-angra="' + id + '">Ångra intervju</button>'
        + vidareKnapp('utbildning', a, 'Gå vidare till utbildning', true));
    }
    if (st === 'utbildning') {
      return stegRuta('Utbildning', 'Intervjuad ' + kortDatum(a.intervju_at || a.utbildningsmote_at)
        + '. Utbildning hållen skapar kontot och skickar inbjudan.', hållenKnapp(a, true));
    }
    if (st === 'konto_skapat') {
      const konto = a.konto_id ? S.personer[a.konto_id] : null;
      return stegRuta('Konto skapat', a.utbildad_at ? kortDatum(a.utbildad_at) + '.' : '',
        konto ? '<button type="button" class="btn btn-ghost btn-sm" data-dp="studiehjalpare:' + esc(konto.id) + '">'
          + 'Öppna ' + esc(konto.full_name || konto.email || 'kontot') + '</button>' : '');
    }
    return stegRuta('Avböjd', 'Står utanför stegen.',
      '<button type="button" class="btn btn-ghost btn-sm" data-ans-ja="' + id + '">Ta tillbaka nejet</button>');
  }

  /* Mejlen till hen, hopfällda: oftast är de bara ett kvitto på att allt
     gått. Ett mejl som inte gått fram fäller ut listan. */
  function beskedLista(a) {
    const rader = ['mottagen', 'vardnadshavare', 'mote', 'utbildning', 'sista_steget', 'valkommen', 'avbojd']
      .map(st => besked(a, st)).filter(Boolean);
    if (S.ansokanUtskickFel) {
      rader.push('<div class="ans-steg-fakta ar-fel">Mejlstatusen gick inte att läsa: ' + esc(S.ansokanUtskickFel) + '</div>');
    }
    if (!rader.length) return '';
    const fel = rader.some(r => r.indexOf('ar-fel') >= 0);
    return '<details class="ans-mejlen"' + (fel ? ' open' : '') + '><summary>Mejlen till hen</summary>'
      + rader.join('') + '</details>';
  }

  /* ---- avböj, och ta tillbaka ett nej ----
     Ett nej mejlas, tidigast en halvtimme senare och aldrig mellan 20 och 9
     (intern.ansokan_nej_tid), och rutan visar mejlet först (bekräftaNej).
     Tas nejet tillbaka innan det gått går det inte. Avböjd står utanför
     stegen, så det går i varje steg. */
  document.addEventListener('click', async e => {
    const nej = e.target.closest('[data-ans-nej]');
    const tillbaka = nej ? null : e.target.closest('[data-ans-ja]');
    const knapp = nej || tillbaka;
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === (nej ? knapp.dataset.ansNej : knapp.dataset.ansJa));
    if (!a) return;
    if (nej && (a.status === 'rejected' || !(await bekräftaNej(a)))) return;
    if (tillbaka && a.status !== 'rejected') return;
    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update({ status: nej ? 'rejected' : 'new' }).eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte spara: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      await hämtaBesked(a.id);
      ritaOm();
      await ritaÖversikt();
    });
  });
  /* ============================================================
     UTBILDNING HÅLLEN (2026-10-21): kontot och poolen

     Leo: "Från Utbildning: knappen 'Utbildning hållen'. Då skapas
     studiehjälparkontot (använd befintlig inbjudningsmekanism via edge
     function, rollen larare) och inbjudan skickas. Idempotent, kan inte
     skapa två konton för samma ansökan."

     Förut Ta in i poolen. Kontot skapas av bjud-in med adressen i
     ansökan och rollen tutor, och hen får länken där hen väljer
     lösenordet. ansokan_utbildning_hallen kopplar sedan kontot till
     ansökan, godkänner profilen med uppgifterna nedan och sätter ansökan
     utbildad och Godkänd, i en transaktion. Har adressen redan ett
     studiehjälparkonto används det. Samma knapp igen gör ingenting, och
     databasen kopplar aldrig ett andra konto till samma ansökan
     (applications.konto_id).

     Poolen är tutor_profiles med status 'approved', det urval
     matchningsunderlag lämnar ut. TIMPENNINGEN ÄR OBLIGATORISK: utan
     hourly_rate hoppar fakturering över studiehjälparen när ersättningen
     räknas, och passen hålls utan att någon får betalt.

     Provet om handledarhandboken gör hen vid första inloggningen, direkt
     efter lösenordet (nextrum-provet.js), och databasen spärrar elevernas
     uppgifter tills det är godkänt.
     ============================================================ */
  function adressensKonto(ans) {
    const epost = String(ans.email || '').trim().toLowerCase();
    return epost ? Object.values(S.personer).find(p =>
      !ärRaderad(p) && String(p.email || '').toLowerCase() === epost) || null : null;
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-hallen]');
    if (!knapp) return;

    const ans = S.ansokningar.find(a => a.id === knapp.dataset.ansHallen);
    if (!ans || ansSteg(ans) !== 'utbildning') return;

    /* Den som är under 18 behöver vårdnadshavarens godkännande för att
       börja jobba (2026-10-05). Saknas det i ansökan frågar vi: det kan
       finnas på annat sätt. */
    if (ärUnder18(ans) && harVhKolumner(ans) && !ans.vardnadshavare_godkand_at) {
      const ändå = await bekräfta({
        titel: 'Vårdnadshavarens godkännande saknas',
        text: (ans.name || 'Den sökande') + ' är ' + ans.age + ' år, och den som är under 18 behöver sin '
          + 'vårdnadshavares godkännande för att börja jobba. Lägg in det i ansökan först, eller '
          + 'fortsätt om du har det på annat sätt.',
        knapp: 'Fortsätt ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    const epost = String(ans.email || '').trim().toLowerCase();
    const finns = adressensKonto(ans);
    if (finns && finns.role !== 'tutor') {
      alert('Adressen ' + epost + ' har redan ett konto som inte är ett studiehjälparkonto. Öppna det under '
        + 'Familjer, eller rätta adressen i ansökan om hen har en annan.');
      return;
    }
    if (!finns && !NX.epostOk(epost)) {
      alert('Adressen i ansökan går inte att skicka till. Rätta den under Redigera uppgifterna först.');
      return;
    }

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="uh-t">'
      + '<h3 id="uh-t">Utbildning hållen för ' + esc(ans.name || 'den sökande') + '</h3>'
      + '<p>' + (finns
        ? 'Kontot med adressen <b>' + esc(epost) + '</b> finns redan. Det kopplas till ansökan, och profilen '
          + 'blir godkänd och syns i matchningen direkt.'
        : 'Ett studiehjälparkonto skapas med <b>' + esc(epost) + '</b>, och hen får ett mejl med en länk där '
          + 'hen väljer sitt lösenord. Profilen blir godkänd och syns i matchningen direkt.')
      + ' Vid första inloggningen gör hen provet om handledarhandboken. Uppgifterna nedan kommer från ansökan.</p>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="uh-amnen">Ämnen (kommaseparerat)</label>'
      + '<input class="inp" id="uh-amnen" value="' + esc(ans.subjects || '') + '"></div>'
      + '<div class="fgroup"><label for="uh-ort">Ort</label>'
      + '<input class="inp" id="uh-ort" value="Stockholm"></div>'
      + '<div class="fgroup"><label for="uh-timpenning">Timpenning, kronor</label>'
      + '<input class="inp" id="uh-timpenning" type="number" min="1" max="2000" step="1" inputmode="numeric" placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Utan timpenning räknas ingen ersättning ut: passen hålls men utbetalningen uteblir.</p>'
      + '<p class="ok-msg" id="uh-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-uh-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="uh-ok">'
      + (finns ? 'Koppla kontot och godkänn' : 'Skapa kontot och skicka inbjudan') + '</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-uh-stang]')) stäng();
    });

    $('#uh-ok', ruta).addEventListener('click', async () => {
      const msg = $('#uh-msg', ruta);
      rensa(msg);
      const timpenning = Number($('#uh-timpenning', ruta).value);
      if (!timpenning || timpenning < 1 || timpenning > 2000) { säg(msg, 'Fyll i timpenningen i kronor.', false); return; }
      /* Ämnena lagras som en lista. Fritexten delas på komma, och tomma
         bitar tas bort i databasen också. */
      const ämnen = String($('#uh-amnen', ruta).value || '').split(',').map(x => x.trim()).filter(Boolean);

      await medan($('#uh-ok', ruta), 'Sparar…', async () => {
        let konto = finns ? finns.id : null;
        let skapat = false;
        if (!konto) {
          const res = await supa.functions.invoke('bjud-in', {
            body: { epost: ans.email, namn: ans.name || '', roll: 'tutor' }
          });
          /* 409: adressen fick ett konto sedan vyn hämtades (ett tryck i
             en annan flik). Det kontot är hens, och det kopplas. */
          if (res.error && res.error.context && res.error.context.status === 409) {
            await hämtaAllt();
            const k = adressensKonto(ans);
            if (k && k.role === 'tutor') konto = k.id;
          } else if (res.error || (res.data && res.data.error)) {
            säg(msg, 'Kontot gick inte att skapa: ' + await funktionsFel(res.error || res.data.error), false);
            return;
          } else {
            konto = res.data && res.data.id;
            skapat = true;
          }
          if (!konto) { säg(msg, 'Kontot gick inte att hitta efter att det skapats. Ladda om och försök igen.', false); return; }
        }

        const { data, error } = await supa.rpc('ansokan_utbildning_hallen', {
          p_ansokan: ans.id, p_konto: konto, p_timpenning: timpenning,
          p_amnen: ämnen, p_ort: $('#uh-ort', ruta).value.trim() || null
        });
        if (error || !data || !data.ok) {
          const fel = error
            ? (error.code === 'PGRST202' ? 'migrationen ansokningarnas_steg är inte körd' : felText(error))
            : (data && data.fel) || 'okänt svar';
          säg(msg, (skapat
            ? 'Kontot är skapat och inbjudan skickad, men ansökan kopplades inte: ' + fel
              + '. Stäng rutan och tryck Utbildning hållen igen.'
            : 'Kunde inte spara: ' + fel), false);
          return;
        }

        ruta.querySelector('.nx-fraga-box').innerHTML =
          '<h3>' + esc(ans.name || 'Hen') + ' har fått sitt konto</h3>'
          + '<p>Profilen är godkänd och syns i matchningen. '
          + (skapat
            ? 'Ett mejl med en länk har gått till <b>' + esc(epost) + '</b>: där väljer hen sitt lösenord och gör '
              + 'sedan provet. Välkomstmejlet går som vanligt.</p>'
              + '<p class="xsmall" style="color:var(--muted-2)">Kommer inget fram: öppna hen under '
              + 'Studiehjälpare och tryck Skicka inbjudan igen.</p>'
            : 'Hen loggar in med kontot hen redan har. Välkomstmejlet går som vanligt.</p>')
          + '<div class="nx-fraga-knappar"><button type="button" class="btn btn-primary" data-uh-stang>Stäng</button></div>';
        await hämtaAllt();
        ritaAnsokningar();
        ritaStudiehjalpare();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();
      });
    });
  });


  /* ============================================================
     UNDER 18: VÅRDNADSHAVARENS GODKÄNNANDE (2026-10-05)

     Leo: "fråga om den sökande är under 18, är den det så ber du den
     skriva in sina föräldrars mail och dokumenterar det, föräldrarna får
     automatiskt ett mail ... efter det så kan vi dokumentera det och
     lägga in kopia av mail till barnet." Formuläret frågar efter
     vårdnadshavarens e-post när åldern är under 18, och databasen mejlar
     vårdnadshavaren direkt (steget vardnadshavare). Svaret kommer till
     info@, och läggs in här: när, och en kopia av mejlet. Ingenting
     mejlas när det läggs in.

     Raderna visas bara när kolumnerna finns (migrationen
     ansokan_vardnadshavare_och_nej): en knapp som sparar till en kolumn
     som saknas hade sett ut att fungera.
     ============================================================ */
  const ärUnder18 = a => a.age != null && a.age > 0 && a.age < 18;
  const harVhKolumner = a => !!a && 'vardnadshavare_godkand_at' in a;

  /* Det senaste mejlet till vårdnadshavaren, kort: det står i Ansökan,
     bredvid adressen. Hela beskedet står under Rekryteringen. */
  function vhMejlat(a) {
    const rad = (S.ansokanUtskick[a.id] || []).find(r => r.steg === 'vardnadshavare');
    if (!rad) return '';
    return {
      skickad: 'mejlad ' + kortDatum(rad.uppdaterad),
      vantar: 'mejlet är på väg', skickar: 'mejlet är på väg',
      fel: 'mejlet gick inte fram',
      bromsad: 'mejlades inte' + (rad.fel ? ': ' + rad.fel : ''),
      hoppad: 'mejlades inte'
    }[rad.status] || '';
  }

  /* Raderna i ansökans faktaruta (dpAnsokan). Tom för en vuxen. */
  function vhFakta(a) {
    if (!harVhKolumner(a)) return [];
    if (!ärUnder18(a) && !a.vardnadshavare_epost && !a.vardnadshavare_godkand_at) return [];
    const mejlat = vhMejlat(a);
    const adress = a.vardnadshavare_epost
      ? gmailAdress(a.vardnadshavare_epost)
        + (mejlat ? esc(' · ' + mejlat) : '')
      : null;
    const godkänt = a.vardnadshavare_godkand_at
      ? esc('Inlagt ' + kortDatum(a.vardnadshavare_godkand_at) + '. Mejlet står under Vårdnadshavarens svar.')
      : esc(a.vardnadshavare_epost ? 'Väntar på svar till info@.' : 'Inget mejl har gått: adressen saknas.')
        + ' <button type="button" class="btn btn-ghost btn-sm" data-ans-vh-in="'
        + esc(a.id) + '">Lägg in godkännandet</button>';
    return [
      ['Vårdnadshavare', adress, 'saknas. Lägg till adressen under Redigera uppgifterna, så mejlas hen.'],
      ['Godkännande', godkänt]
    ];
  }

  /* Kopian av vårdnadshavarens svar, och vägen att ta bort den. Tom
     sträng när inget är inlagt. */
  function vhSvar(a) {
    if (!harVhKolumner(a) || !a.vardnadshavare_godkand_at) return '';
    return '<div class="dp-text">' + esc(a.vardnadshavare_svar || '(ingen kopia)') + '</div>'
      + '<div class="dp-atgard"><button type="button" class="btn btn-ghost btn-sm" data-ans-vh-bort="'
      + esc(a.id) + '">Ta bort godkännandet</button></div>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vh-in]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansVhIn);
    if (!a) return;
    const svar = await fråga({
      titel: 'Vårdnadshavarens godkännande',
      text: 'Klistra in mejlet där ' + (a.vardnadshavare_epost || 'vårdnadshavaren') + ' godkänner ansökan, '
        + 'med avsändare och datum. Det sparas i ansökan och tas bort med den. Ingenting mejlas.',
      innehåll: '<div class="fgroup"><label for="vh-svar">Mejlet från vårdnadshavaren</label>'
        + '<textarea class="inp" id="vh-svar" rows="9" maxlength="20000"></textarea></div>',
      knapp: 'Lägg in godkännandet',
      läs: r => {
        const text = $('#vh-svar', r).value.trim();
        if (text.length < 10) return { fel: 'Klistra in mejlet där vårdnadshavaren godkänner ansökan.' };
        return { värde: text };
      }
    });
    if (!svar) return;
    const { data, error } = await supa.from('applications')
      .update({ vardnadshavare_godkand_at: new Date().toISOString(), vardnadshavare_svar: svar })
      .eq('id', a.id).select('*').maybeSingle();
    if (error || !data) { alert('Kunde inte spara: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
    Object.assign(a, data);
    ritaOm();
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vh-bort]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansVhBort);
    if (!a) return;
    const ja = await bekräfta({
      titel: 'Ta bort godkännandet?',
      text: 'Tidpunkten och kopian av mejlet tas bort ur ansökan. Gör det bara om det lades in av misstag.',
      knapp: 'Ta bort',
      avbryt: 'Behåll'
    });
    if (!ja) return;
    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update({ vardnadshavare_godkand_at: null, vardnadshavare_svar: null })
        .eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte ta bort: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      ritaOm();
    });
  });

  /* ============================================================
     NEJET (2026-10-05)

     Leo: "klickar vi i avböjd i ansökningarna så skickas automatiskt ett
     mail till den sökande om att vi har valt att gå vidare med en annan."
     Rullgardinen frågar först och visar mejlet, ord för ord. Databasen
     köar det tidigast en halvtimme senare och aldrig mellan 20 och 9
     (intern.ansokan_nej_tid); byts läget före dess går inget.

     TEXTEN STÅR PÅ TVÅ STÄLLEN: här och i mallen (NEJ i
     supabase/functions/_delad/notiser/ansokan.ts). verktyg/kolla-mejltexter.py
     håller dem lika i CI, för en förhandsvisning som säger något annat än
     mejlet är värre än ingen.
     ============================================================ */
  const NEJ_MEJLET = {
    amne: 'Om din ansökan till Nextrum',
    rubrik: 'Tack för din ansökan',
    mening: 'Tack för att du ville jobba som studiehjälpare hos oss, och för tiden du lade på ansökan. '
      + 'Vi har valt att gå vidare med andra sökande den här gången.',
    avslutning: 'Du är välkommen att söka igen längre fram. Undrar du något om beskedet? '
      + 'Svara på det här mejlet.'
  };

  /* ============================================================
     INTERVJUMEJLET (2026-10-21)

     Skicka vidare till intervju köar ett mejl till den som sökt, en gång
     per ansökan (intern.ansokan_intervjumejl, genom notiskön). Det går
     direkt, så frågan visar mejlet först, som nejet.

     TEXTEN ÄR LEOS OCH STÅR PÅ TVÅ STÄLLEN: här och i mallen (INTERVJU
     i supabase/functions/_delad/notiser/intervju.ts).
     verktyg/kolla-mejltexter.py håller dem lika. Länken till
     bokningssidan (2026-10-20, Leo) står med i mejlet och ska vara
     INTERVJU_BOKNINGSLANK, som kontrollen också prövar: mallen kan inte
     läsa configen, så frågan visar mallens adress, inte bokningssida().
     ============================================================ */
  const INTERVJU_MEJLET = {
    amne: 'Du går vidare till intervju',
    forsta: 'Tack för din ansökan till Nextrum. Vi har läst den och du går vidare till intervjufasen.',
    boka: 'Boka en tid för intervjun som passar dig här:',
    lank: 'https://calendar.app.google/rRiTTLP5ymKQunSv7',
    andra: 'Intervjun hålls i Google Meet, och länken till mötet kommer i bekräftelsen när du har bokat. '
      + 'Du behöver inget Google-konto. Passar ingen av tiderna får du gärna mejla oss på info@nextrum.se.',
    halsning: 'Hälsningar',
    signatur: 'Leo och Alex, Nextrum'
  };

  /* Utan migrationen intervjumejlet köar databasen inget, och frågan
     hade lovat ett mejl som aldrig går. */
  const harIntervjumejl = a => !!a && 'intervju_mejl_skickat_at' in a;

  /* Mejlet ord för ord, som frågorna visar det. */
  function intervjumejlet(namn) {
    return 'Ämne: ' + INTERVJU_MEJLET.amne + '\n\n'
      + (namn ? 'Hej ' + namn + '!' : 'Hej!') + '\n\n'
      + INTERVJU_MEJLET.forsta + '\n\n'
      + INTERVJU_MEJLET.boka + '\n'
      + INTERVJU_MEJLET.lank + '\n\n'
      + INTERVJU_MEJLET.andra + '\n\n'
      + INTERVJU_MEJLET.halsning + '\n'
      + INTERVJU_MEJLET.signatur;
  }

  /* Frågan innan steget sätts. Svarar true när det får sättas. */
  async function bekräftaIntervju(a) {
    if (!harIntervjumejl(a) || a.status === 'rejected') return true;
    const vem = a.name || 'Den sökande';
    if (a.intervju_mejl_skickat_at) {
      return bekräfta({
        titel: 'Skicka ' + vem + ' vidare till intervju?',
        text: vem + ' fick intervjumejlet ' + kortDatum(a.intervju_mejl_skickat_at)
          + '. Det mejlas en gång, så inget nytt mejl går.',
        knapp: 'Skicka vidare',
        avbryt: 'Avbryt'
      });
    }
    const namn = förnamn(a.name);
    return bekräfta({
      titel: 'Skicka ' + vem + ' vidare till intervju?',
      text: vem + ' får mejlet nedan inom några minuter. Det går en gång per ansökan, också om du ångrar steget.',
      forhandsvisning: intervjumejlet(namn),
      knapp: 'Skicka vidare och mejla',
      avbryt: 'Avbryt'
    });
  }

  /* Förnamnet som mallen tar det (fornamn() i _delad/notiser/typer.ts). */
  function förnamn(namn) {
    const första = String(namn || '').trim().split(/\s+/)[0] || '';
    const ren = första.replace(/[^\p{L}-]/gu, '').slice(0, 30);
    return /\p{L}/u.test(ren) ? ren : null;
  }

  /* När nejet går om det sätts nu: samma regel som intern.ansokan_nej_tid. */
  function nejNär() {
    const t = sthlm(new Date(Date.now() + 30 * 60000));
    if (t.tim < 9) return dagOrd(t.dag) + ' kl. 09:00';
    if (t.tim >= 20) return 'i morgon kl. 09:00';
    return dagOrd(t.dag) + ' kl. ' + t.klocka;
  }

  /* Frågan innan läget blir Avböjd. Svarar true när det får sättas. */
  async function bekräftaNej(a) {
    /* Utan migrationen köar databasen inget nej, och rutan hade lovat
       ett mejl som aldrig går. */
    if (!harVhKolumner(a)) return true;
    const vem = a.name || 'Den sökande';
    const gått = (S.ansokanUtskick[a.id] || []).find(r => r.steg === 'avbojd' && r.status === 'skickad');
    if (gått) {
      return bekräfta({
        titel: 'Avböja ' + vem + '?',
        text: vem + ' fick ett nej ' + kortDatum(gått.uppdaterad) + '. Ett nej mejlas en gång, så inget nytt mejl går.',
        knapp: 'Avböj',
        avbryt: 'Avbryt'
      });
    }
    const namn = förnamn(a.name);
    return bekräfta({
      titel: 'Avböja och mejla ' + vem + '?',
      text: vem + ' får mejlet nedan ' + nejNär() + '. Byter du läget innan dess går det inte iväg.',
      forhandsvisning: 'Ämne: ' + NEJ_MEJLET.amne + '\n\n'
        + (namn ? 'Hej ' + namn + ',' : 'Hej,') + '\n\n'
        + NEJ_MEJLET.rubrik + '\n\n'
        + NEJ_MEJLET.mening + '\n\n'
        + NEJ_MEJLET.avslutning,
      knapp: 'Avböj och mejla',
      avbryt: 'Avbryt'
    });
  }

  /* Det de skrev under "Varför", utan CV-raden: den står som en knapp
     i panelen i stället för som en sökväg. */
  function ansökansText(a) {
    return String(a.why || '').replace(CV_RAD, '').replace(CV_FEL, '').trim();
  }

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ansökansText, beskedLista, bekräftaNej, cvKnapp, hämtaBesked, nästaSteg, ritaAnsokningar, stegLäge,
    vhFakta, vhSvar
  });
})();
