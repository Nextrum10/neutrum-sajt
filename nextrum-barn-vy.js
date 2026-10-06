/* ============================================================
   NEXTRUM — barnets vy (barn.html), barnkonton_och_admin

   Ett barn med egen inloggning gör NexLäx och ser sina pass, sina
   timmar, sin studieplan, sina notiser och, om föräldern slagit på det,
   rapporterna. Aldrig priser, betalningar, erbjudanden, förälderns
   uppgifter eller något om andra familjer. Det är inte den här filen som
   ser till det: barnets roll i databasen (nextrum_barn) når inga
   tabeller, bara barnets egna funktioner (barn_oversikt, barn_notiser,
   barn_markera_last, barn_nexlax, barn_uppgift) och NexLäx-funktionerna
   som prövar att det är barnets eget id (nexlax_for_barnet). Filen ritar
   det de svarar.

   Allt utom NexLäx ritas med textContent. Namn, ämnen och rapporttexter
   kommer ur databasen och skrivs av andra än barnet. NexLäx ritas av
   NXUppgifter, som i studievyn, med esc() på allt ur databasen.

   Barnet kan inte boka, avboka, svara på ett förslag, byta lösenord eller
   ändra något om sig själv. Allt sådant gör föräldern, och vyn säger det.
   Det barnet gör själv är NexLäx, bocken på en vanlig uppgift och, sedan
   2026-10-06, att skriva till sin studiehjälpare i en egen tråd.

   ELEVVYN (2026-10-06). Samma skal som studievyn: hälsningen överst
   (NXArbete.hero, med dagens bild och veckodagen) och en sidomeny med
   fem delar och inget mer: Översikt (antalet pass och de närmaste), Mina
   lektioner (passen, studieplanen och rapporterna, utan betalning),
   NexLäx, Meddelanden (tråden med studiehjälparen och det Nextrum
   berättar om passen) och Profil (inställningarna). Leo: "På elevvyn ska
   bara Översikt, nexläx, meddelanden, och profil för barnet finnas", och
   samma kväll Mina lektioner och chatten.

   BARNETS BEHÖRIGHETER (barnets_behorigheter, 2026-10-06). Föräldern
   väljer vad barnet får se och göra: passen, studieplanen, rapporterna,
   NexLäx, notiserna från Nextrum och tråden med studiehjälparen.
   Databasen lämnar inte ut det som är av, och NexLäx- och
   chattfunktionerna släpper inte in barnet; vyn gömmer delen och säger
   att föräldern valt det, i stället för att visa en tom lista som ser ut
   som ett fel. barn_oversikt() säger vad som är på (behorigheter); utan
   listan (en databas före migrationen) är allt på, som förut.

   BARNETS EGEN E-POST (barnets_epost). Under Profil ser barnet
   sitt användarnamn och sin adress, och väljer bort mejl det inte vill
   ha (barn_installningar, barn_notisval), när föräldern slagit på dem.
   Länken i bekräftelsemejlet öppnar vyn med ?bekrafta=, och då visas
   bara knappen som bekräftar (barn_epost_bekrafta), utan inloggning.
   ============================================================ */
(function () {
  'use strict';
  const { $, datumText } = NX;

  const VYER = ['view-loading', 'view-bekrafta', 'view-annan', 'view-stopp', 'view-app', 'view-fel'];
  const S = { user: null, data: null, notiser: [], inst: null, hämtad: 0, laddar: false, hero: null, sido: null, tillVal: false,
    aktiv: null, chatt: { data: null, ritare: null } };

  function visa(id) { NXStudie.visaVy(VYER, id); }

  /* ============ små byggstenar ============ */
  function el(tag, attr, ...barn) {
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

  /* Ikonerna är fasta strängar i nextrum-studie.js, aldrig data. */
  function ikon(namn) {
    const t = document.createElement('template');
    t.innerHTML = NXStudie.IKON[namn] || NXStudie.IKON.info;
    return t.content.firstChild;
  }

  function tomt(rubrik, text) {
    return el('div', { class: 'empty' }, el('b', {}, rubrik), text ? el('span', {}, text) : null);
  }

  const stor = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const tal = n => Number(n || 0).toLocaleString('sv-SE', { maximumFractionDigits: 1 });

  function dag(datum, tid) {
    return stor(NXStudie.dagMedVeckodag(datum)) + (tid ? ' kl. ' + String(tid).slice(0, 5) : '');
  }

  function när(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return NXStudie.kortTid(ts);
  }

  /* ============ sidhuvudet ============ */
  function ritaHuvud(namn) {
    const na = $('#nav-actions');
    if (!na) return;
    if (!S.user) { na.replaceChildren(); return; }
    na.replaceChildren(
      namn ? el('span', { class: 'who-chip' }, el('b', {}, namn), el('span', { class: 'roll' }, 'Elev')) : '',
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-logout': true }, 'Logga ut'));
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-logout]')) NXStudie.loggaUt(supa);
  });

  /* ============ inloggningen ============
     Står inte här sedan 2026-10-06. Leo: "när man väljer att logga in som
     elev ska man inte komma till en separat sida". Elev är ett läge i
     studievyns inloggning (/foralder#elev, NXStudie.elevLänk), som loggar
     in med samma loggaIn och skickar barnet hit. Den som öppnar /barn utan
     att vara inloggad, eller loggar ut härifrån, skickas dit. */
  const INLOGGNINGEN = '/foralder#elev';

  /* ============ start ============ */
  async function starta(user) {
    S.user = user;
    if (!NX.ärBarn(user)) {
      /* En vuxen är inloggad i samma webbläsare. Inget av dennes visas,
         och ingen länk till vuxnas vyer: bara vägen ut. */
      ritaHuvud(null);
      visa('view-annan');
      return;
    }
    NXStudie.vaktaInloggningen({
      supa, user,
      utloggad: () => { S.user = null; S.data = null; location.replace(INLOGGNINGEN); }
    });
    ritaHuvud(null);
    await ladda();
  }

  async function ladda() {
    if (S.laddar) return;
    S.laddar = true;
    try {
      const [ö, n, inst] = await Promise.all([
        supa.rpc('barn_oversikt'), supa.rpc('barn_notiser'), supa.rpc('barn_installningar')]);
      if (ö.error) throw ö.error;
      const d = ö.data || {};
      S.hämtad = Date.now();
      if (d.lage !== 'ok') {
        S.data = null;
        ritaHuvud(null);
        ritaStopp(d.lage);
        return;
      }
      S.data = d;
      /* Notiserna och inställningarna är inte vyns viktigaste: går de
         inte att hämta visas resten ändå. En databas utan barnets_epost
         svarar PGRST202, och då står Inställningar dold. */
      S.notiser = n.error ? null : (n.data || []);
      S.inst = inst.error || !inst.data || inst.data.lage !== 'ok' ? null : inst.data;
      if (inst.error && inst.error.code !== 'PGRST202' && inst.error.code !== '42883') {
        console.warn('barn_installningar:', inst.error.message);
      }
      ritaHuvud(d.fornamn || null);
      ritaAllt();
      visa('view-app');
      /* Länken "Ändra dina val" i ett mejl: förbi hälsningen, rakt till
         Profil, en gång och utan mjuk scrollning. */
      if (S.tillVal) {
        S.tillVal = false;
        $('#view-app .vy-layout').scrollIntoView({ block: 'start' });
      }
      /* NexLäx och tråden väntar inte resten av vyn in: de ritas när de
         kommer. */
      laddaNexlax();
      laddaChatt();
    } catch (fel) {
      NXStudie.felvy(visa, fel, 'din vy skulle hämtas');
    } finally {
      S.laddar = false;
    }
  }

  function ritaStopp(läge) {
    const pausad = läge === 'pausad';
    $('#bv-stopp-rubrik').textContent = pausad ? 'Din inloggning är pausad' : 'Inloggningen fungerar inte just nu';
    $('#bv-stopp-text').textContent = pausad
      ? 'Du kommer in igen när din förälder slår på inloggningen.'
      : 'Fråga din förälder om inloggningen, så kan de titta på den.';
    visa('view-stopp');
  }

  /* ============ behörigheterna ============ */
  const FÅR = {
    pass: 'se dina pass',
    studieplan: 'se studieplanen',
    rapporter: 'läsa rapporterna',
    nexlax: 'göra NexLäx',
    meddelanden: 'se notiserna från Nextrum',
    chatt: 'skriva till din studiehjälpare'
  };

  /* Rapporterna står också i visa_rapporter, som de alltid gjort. */
  function får(sak) {
    const lista = S.data && S.data.behorigheter;
    if (sak === 'rapporter') return !!(S.data && S.data.visa_rapporter);
    return !Array.isArray(lista) || lista.indexOf(sak) !== -1;
  }

  /* Det föräldern stängt av göms, och en rad överst i delen säger vad.
     Översikt: antalet pass och de närmaste (data-bv-far="pass"). Mina
     lektioner: flikarna Pass och Studieplan; Efter passen sköts av
     ritaRapporter, som körs före. Står ingen flik kvar säger raden det,
     och flikraden går. */
  function ritaBehörigheter() {
    NX.$$('[data-bv-far]').forEach(d => { d.hidden = !får(d.dataset.bvFar); });
    const rad = (id, text) => {
      const p = $(id);
      if (!p) return;
      p.hidden = !text;
      p.textContent = text ? text + ' Undrar du något? Fråga din förälder.' : '';
    };
    rad('#bv-avstangt-oversikt', får('pass') ? '' : 'Din förälder har valt att du inte ser dina pass här.');

    const rot = 'section[data-sek="lektioner"]';
    const pass = $('#bv-flik-pass'), plan = $('#bv-flik-plan'), rapporter = $('#bv-flik-rapporter');
    if (!pass || !plan) return;
    pass.hidden = !får('pass');
    plan.hidden = !får('studieplan');
    const synliga = [pass, plan, rapporter].filter(k => k && !k.hidden);
    const flikar = pass.closest('.vy-flikar');
    if (flikar) flikar.hidden = !synliga.length;
    if (!synliga.length) {
      NX.$$(rot + ' .vy-flik-panel').forEach(p => { p.hidden = true; });
      rad('#bv-avstangt-lektioner', 'Din förälder har valt att du inte ser dina pass, studieplanen eller rapporterna här.');
      return;
    }
    rad('#bv-avstangt-lektioner', '');
    const vald = synliga.find(k => k.getAttribute('aria-selected') === 'true');
    visaFlik(rot, (vald || synliga[0]).dataset.flik);
  }

  /* ============ vyn ============ */
  function ritaAllt() {
    ritaSkalet();
    ritaHej();
    ritaAntal();
    ritaKommande();
    ritaNotiser();
    ritaPlan();
    ritaGenomförda();
    ritaRapporter();
    ritaBehörigheter();
    ritaInställningar();
  }

  /* ============ inställningarna (barnets_epost) ============
     Vem barnet är inloggat som, adressen om föräldern lagt till en, och
     en rad per sorts mejl. Valen går att ändra bara när föräldern slagit
     på mejlen och adressen är bekräftad; annars säger rutan varför. Med
     flaggan barn_epost av står bara användarnamnet här. */
  const MEJLSORTER = {
    barn_pass_bokat: ['När ett pass är bokat', 'Ett mejl när ett nytt pass är bokat åt dig.'],
    barn_pass_avbokat: ['När ett pass är avbokat', 'Ett mejl när ett pass inte blir av.'],
    barn_paminnelse: ['Påminnelse före ett pass', 'Ett mejl en stund innan passet börjar.']
  };

  function ritaInställningar() {
    const host = $('#bv-inst');
    const i = S.inst;
    if (!host) return;
    /* Utan barn_installningar i databasen står namnet ur översikten,
       och resten av Profil som förut. */
    if (!i) {
      host.replaceChildren(el('dl', { class: 'bi-fakta' },
        el('dt', {}, 'Inloggad som'), el('dd', {}, (S.data && S.data.fornamn) || 'Elev')), vadDuFår());
      return;
    }

    const fakta = el('dl', { class: 'bi-fakta' },
      el('dt', {}, 'Användarnamn'), el('dd', {}, i.anvandarnamn || ''));
    const får_ = vadDuFår();
    if (får_) fakta.append(får_.firstChild, får_.lastChild);
    if (i.pa) {
      fakta.append(el('dt', {}, 'E-post'), el('dd', {},
        !i.epost ? 'Ingen. Din förälder kan lägga till din e-post.'
          : i.bekraftad ? i.epost
            : i.epost + ' (väntar på att du bekräftar den: titta efter ett mejl från Nextrum)'));
    }
    const delar = [fakta];

    if (i.pa) {
      /* Valen sparas också innan föräldern slagit på mejlen; de gäller
         från den dagen. Utan bekräftad adress finns inget att välja. */
      const varför = !i.epost || !i.bekraftad
        ? 'När din e-post är bekräftad och din förälder har slagit på mejl kan du välja här vilka mejl du får.'
        : !i.notiser ? 'Din förälder har inte slagit på mejl till dig. Ditt val sparas till dess.'
          : 'Välj vilka mejl du vill få. Det du stänger av här får du inte.';
      delar.push(el('p', { class: 'xsmall bi-hjalp bv-inst-text' }, varför));
      (i.typer || []).forEach(t => {
        const ord = MEJLSORTER[t.typ];
        if (!ord) return;
        delar.push(el('div', { class: 'nx-nval' },
          el('div', { class: 'nx-nval-text' }, el('b', {}, ord[0]), el('span', { class: 'xsmall' }, ord[1])),
          el('button', { class: 'chip', type: 'button', 'data-bv-val': t.typ,
            'aria-pressed': t.pa ? 'true' : 'false', disabled: !(i.epost && i.bekraftad) },
            t.pa ? 'På' : 'Av')));
      });
    }
    host.replaceChildren(...delar);
  }

  /* Vad föräldern valt att barnet får, i ord (barnets_behorigheter). Två
     rader i faktalistan; null utan listan från databasen. */
  function vadDuFår() {
    if (!S.data || !Array.isArray(S.data.behorigheter)) return null;
    const på = Object.keys(FÅR).filter(får).map(s => FÅR[s]);
    const text = på.length
      ? stor(på.length > 1 ? på.slice(0, -1).join(', ') + ' och ' + på[på.length - 1] : på[0]) + '.'
      : 'Bara din profil. Fråga din förälder om du vill se mer.';
    const dl = el('dl', { class: 'bi-fakta' }, el('dt', {}, 'Du får'), el('dd', {}, text));
    return dl;
  }

  document.addEventListener('click', async e => {
    const val = e.target.closest('[data-bv-val]');
    if (!val || !S.inst) return;
    const msg = $('#bv-inst-msg');
    NX.rensa(msg);
    const på = val.getAttribute('aria-pressed') !== 'true';
    await NXStudie.medan(val, 'Sparar…', async () => {
      const { data, error } = await supa.rpc('barn_notisval', { p_typ: val.dataset.bvVal, p_pa: på });
      if (error || !data || data.lage !== 'ok') {
        NX.säg(msg, 'Valet gick inte att spara. Försök igen om en stund.', false);
        return;
      }
      S.inst = data;
    });
    ritaInställningar();
  });

  /* ============ skalet ============
     Hälsningen och sidomenyn ritas en gång, när namnet har kommit: att
     rita hälsningen om vid varje hämtning hade startat om dagens bild.
     Det som ändras (nästa pass, nya meddelanden) går genom
     S.hero.uppdatera() i ritaHej(). */
  const IKON_ELEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 2.5 9 12 13.5 21.5 9z"/>'
    + '<path d="M6.5 11v4.3c0 1.5 2.5 2.9 5.5 2.9s5.5-1.4 5.5-2.9V11"/><path d="M21.5 9v5"/></svg>';

  function ritaSkalet() {
    if (S.sido) return;
    /* Länken "Ändra dina val" i mejlen pekar på #installningar, som
       står under Profil. replaceState utlöser ingen hashchange, och
       sidomenyn läser adressen först när den skapas nedan. */
    if (location.hash === '#installningar') {
      S.tillVal = true;
      history.replaceState(history.state, '', '#profil');
    }
    S.sido = NXStudie.sidomeny({
      nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt',
      /* Att öppna Meddelanden är att läsa det studiehjälparen skrivit. */
      onByt: sek => { S.aktiv = sek; if (sek === 'meddelanden') markeraChatt(); }
    });
    const d = S.data;
    S.hero = NXArbete.hero({
      host: $('#vy-hero'),
      namn: d.fornamn,
      etikett: 'Elevvy',
      lede: (d.studiehjalpare ? 'Du pluggar med ' + d.studiehjalpare + '. ' : '')
        + 'Här gör du NexLäx och ser dina pass och vad som hänt.',
      marke: { text: 'Elev', ikon: IKON_ELEV }
    });
  }

  /* Korten i hälsningen: nästa pass och meddelandena. Siffran är nya
     notiser och det studiehjälparen skrivit som barnet inte läst. */
  function ritaHej() {
    const d = S.data;
    if (!d) return;
    const nästa = (d.kommande || [])[0];
    const c = S.chatt.data;
    /* Det föräldern stängt av räknas inte (barnets_behorigheter): utan
       tråden är c null. */
    const olästa = (får('meddelanden') ? (S.notiser || []).filter(n => !n.last_at).length : 0)
      + ((c && c.olasta) || 0);
    if (S.sido) S.sido.märke('meddelanden', olästa);
    if (!S.hero) return;
    S.hero.uppdatera({
      namn: d.fornamn,
      /* Utan passen pekar första kortet på NexLäx, om det är på. */
      nasta: !får('pass')
        ? (får('nexlax')
          ? { href: '#nexlax', text: 'NexLäx', under: 'Välj ämne och öva i din egen takt' }
          : { href: '#oversikt', text: 'Översikt', under: 'Det din förälder valt att du ser' })
        : nästa
          ? { href: '#oversikt', text: 'Nästa pass · ' + dag(nästa.datum, nästa.tid),
              under: [nästa.amne, nästa.status === 'confirmed' ? 'Bekräftat' : 'Väntar på svar'].filter(Boolean).join(' · ') }
          : { href: '#oversikt', text: 'Inga pass bokade just nu', under: 'När din förälder bokat ett pass står det här' },
      chatt: { href: '#meddelanden', text: 'Meddelanden',
        under: olästa ? olästa + ' ny' + (olästa > 1 ? 'a' : '')
          : c ? 'Skriv till ' + (c.studiehjalpare || 'din studiehjälpare')
          : får('meddelanden') ? 'Från Nextrum om dina pass' : 'Avstängda av din förälder' }
    });
  }

  /* Antalet pass, inte timmar (2026-10-06, Leo: "antal genomförda
     lektioner. och kommande lektioner istället för timmar genomförda").
     Genomförda är pass med en rapport där barnet var med, kommande är
     bokade och föreslagna pass framåt, samma som listan under Mina
     lektioner. Talen räknas i databasen (barn_oversikt, antal), för
     listan över genomförda stannar vid 50; utan dem räknas listorna. */
  function ritaAntal() {
    const d = S.data, a = d.antal || {};
    const genomförda = a.genomforda != null ? Number(a.genomforda) : (d.genomforda || []).length;
    const kommande = a.kommande != null ? Number(a.kommande) : (d.kommande || []).length;
    const ruta = (antal, ett, flera) => el('div', { class: 'bv-tal' },
      el('b', {}, String(antal)), el('span', {}, antal === 1 ? ett : flera));
    $('#bv-antal').replaceChildren(
      ruta(genomförda, 'genomfört pass', 'genomförda pass'),
      ruta(kommande, 'kommande pass', 'kommande pass'));
  }

  function kommandeRad(p) {
    const bekräftat = p.status === 'confirmed';
    return el('div', { class: 'vy-rad' },
      el('span', { class: 'vy-rad-ik' + (bekräftat ? ' ar-mossa' : ' ar-ockra') }, ikon('dag')),
      el('span', { class: 'vy-rad-mitt' },
        el('span', { class: 'vy-rad-titel' }, dag(p.datum, p.tid)),
        el('span', { class: 'vy-rad-meta' },
          p.amne ? el('span', {}, p.amne) : null,
          p.langd_min ? el('span', {}, NXStudie.längdText(p.langd_min)) : null)),
      el('span', { class: 'vy-rad-hoger' },
        el('span', { class: 'lage' + (bekräftat ? ' klar' : ' vantar') }, bekräftat ? 'Bekräftat' : 'Väntar på svar')));
  }

  /* Alla kommande under Mina lektioner, de tre närmaste på Översikt. */
  function ritaKommande() {
    const lista = S.data.kommande || [];
    $('#bv-kommande-antal').textContent = lista.length ? String(lista.length) : '';
    const tom = () => tomt('Inga pass bokade just nu', 'När din förälder bokat ett pass står det här.');
    $('#bv-kommande').replaceChildren(...(lista.length ? lista.map(kommandeRad) : [tom()]));
    $('#bv-narmast').replaceChildren(...(lista.length ? lista.slice(0, 3).map(kommandeRad) : [tom()]));
  }

  function ritaNotiser() {
    const host = $('#bv-notiser');
    const antal = $('#bv-notiser-antal');
    if (!får('meddelanden')) {
      antal.textContent = '';
      host.replaceChildren(tomt('Notiserna är avstängda', 'Din förälder har valt att du inte får dem här.'));
      return;
    }
    if (S.notiser === null) {
      antal.textContent = '';
      host.replaceChildren(tomt('Notiserna gick inte att hämta', 'Ladda om sidan om en stund.'));
      return;
    }
    const olästa = S.notiser.filter(n => !n.last_at).length;
    antal.textContent = olästa ? olästa + ' ny' + (olästa > 1 ? 'a' : '') : '';
    if (!S.notiser.length) {
      host.replaceChildren(tomt('Inga notiser', 'När ett pass bekräftas, flyttas eller är klart står det här.'));
      return;
    }
    host.replaceChildren(...S.notiser.map(n => {
      const ny = !n.last_at;
      return el('div', { class: 'vy-rad bv-notis' + (ny ? ' ar-ny' : '') },
        el('span', { class: 'vy-rad-ik' + (n.typ === 'genomfort' || n.typ === 'bekraftat' ? ' ar-mossa' : ' ar-ockra') },
          ikon(n.typ === 'genomfort' ? 'bock' : n.typ === 'bekraftat' ? 'dag' : 'info')),
        el('span', { class: 'vy-rad-mitt' },
          el('span', { class: 'vy-rad-titel' }, n.text),
          el('span', { class: 'vy-rad-meta' }, el('span', {}, när(n.skapad)))),
        ny ? el('span', { class: 'vy-rad-hoger' },
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-bv-last': n.id }, 'Läst')) : null);
    }));
  }

  $('#bv-notiser').addEventListener('click', async e => {
    const knapp = e.target.closest('[data-bv-last]');
    if (!knapp) return;
    const id = knapp.dataset.bvLast;
    await NXStudie.medan(knapp, 'Sparar…', async () => {
      const { error } = await supa.rpc('barn_markera_last', { p_id: id });
      if (error) { console.warn('barn_markera_last:', error.message); return; }
      const n = (S.notiser || []).find(x => x.id === id);
      if (n) n.last_at = new Date().toISOString();
    });
    ritaNotiser();
    ritaHej();
  });

  function ritaPlan() {
    const p = S.data.studieplan;
    const host = $('#bv-plan');
    if (!p || !(p.text || p.mal || p.amne)) {
      host.replaceChildren(tomt('Ingen studieplan än', 'Din studiehjälpare skriver den efter ert första pass.'));
      return;
    }
    host.replaceChildren(
      p.amne ? el('p', { class: 'bv-plan-amne' }, p.amne) : '',
      p.mal ? el('div', { class: 'bv-plan-mal' }, el('b', {}, 'Målet'), el('p', {}, p.mal)) : '',
      p.text ? el('p', { class: 'bv-plan-text' }, p.text) : '',
      p.uppdaterad ? el('p', { class: 'xsmall bv-plan-datum' }, 'Uppdaterad ' + datumText(String(p.uppdaterad).slice(0, 10))) : '');
  }

  function ritaGenomförda() {
    const lista = S.data.genomforda || [];
    const host = $('#bv-genomforda');
    const a = S.data.antal || {};
    const antal = a.genomforda != null ? Number(a.genomforda) : lista.length;
    $('#bv-genomforda-antal').textContent = antal ? String(antal) : '';
    if (!lista.length) {
      host.replaceChildren(tomt('Inga genomförda pass än', 'Efter ditt första pass står det här.'));
      return;
    }
    host.replaceChildren(...lista.map(p => el('div', { class: 'vy-rad' },
      el('span', { class: 'vy-rad-ik ar-mossa' }, ikon('bock')),
      el('span', { class: 'vy-rad-mitt' },
        el('span', { class: 'vy-rad-titel' }, dag(p.datum, p.tid)),
        el('span', { class: 'vy-rad-meta' },
          p.amne ? el('span', {}, p.amne) : null,
          p.langd_min ? el('span', {}, NXStudie.längdText(p.langd_min)) : null)))));
  }

  /* Efter passen är en flik under Mina lektioner, bara när föräldern
     slagit på rapporterna. */
  function ritaRapporter() {
    const flik = $('#bv-flik-rapporter');
    const lista = S.data.visa_rapporter ? (S.data.rapporter || []) : null;
    flik.hidden = !lista;
    if (!lista) {
      if (flik.getAttribute('aria-selected') === 'true') visaFlik('section[data-sek="lektioner"]', 'pass');
      $('#bv-rapporter').replaceChildren();
      return;
    }
    if (!lista.length) {
      $('#bv-rapporter').replaceChildren(tomt('Inga rapporter än', 'Efter varje pass skriver din studiehjälpare vad ni gjorde.'));
      return;
    }
    $('#bv-rapporter').replaceChildren(...lista.map(r => el('div', { class: 'bv-rapport' },
      el('div', { class: 'bv-rapport-topp' },
        el('b', {}, stor(NXStudie.dagMedVeckodag(r.datum)) + (r.amne ? ' · ' + r.amne : '')),
        r.gick && NXStudie.GICK[r.gick] ? el('span', { class: 'rb-omdome ar-' + r.gick }, NXStudie.GICK[r.gick]) : null),
      r.text ? el('p', {}, r.text) : null,
      r.trana ? el('p', { class: 'bv-rapport-rad' }, el('b', {}, 'Träna på: '), r.trana) : null,
      r.nasta ? el('p', { class: 'bv-rapport-rad' }, el('b', {}, 'Nästa gång: '), r.nasta) : null)));
  }

  /* ============ NexLäx (nexlax_for_barnet, 2026-10-01) ============
     Leo: "Nexläx syns inte i barnens vy". Samma bana, spelare och
     rättning som i studievyn (NXUppgifter), men barnets roll når inga
     tabeller: banan kommer ur barn_nexlax(), och nivåerna startas och
     rättas i samma funktioner som familjens, som prövar att det är
     barnets eget id och att inloggningen är aktiv. En vanlig uppgift
     bockas av med barn_uppgift(). Studiehjälparens bedömning och passen
     visas inte här (barnvy i NXUppgifter); det barnet får läsa om passen
     står under Rapporter, och "Från passet" på vägen, när föräldern slagit
     på rapporterna. */
  const U = NXUppgifter;
  S.nl = { data: null, läge: null, öppen: null, nyss: null, alla: false, val: { amne: '', arskurs: '', spar: 'vag' } };

  async function laddaNexlax() {
    const sek = $('#bv-nexlax'), tom = $('#bv-nl-tom');
    if (!sek) return;
    /* NexLäx är en del i menyn, så den står aldrig tom: går banan inte att
       hämta säger rutan det. Ett fel efter att banan väl kommit lämnar
       den som den var: listan byts aldrig mot ett besked. */
    const saknas = () => {
      if (S.nl.data) return;
      sek.hidden = true;
      tom.replaceChildren(tomt('NexLäx går inte att öppna just nu', 'Försök igen om en stund.'));
      tom.hidden = false;
    };
    const { data, error } = await supa.rpc('barn_nexlax');
    if (error) {
      /* PGRST202: funktionen finns inte, migrationen är inte körd. */
      if (error.code !== 'PGRST202' && error.code !== '42883') console.warn('barn_nexlax:', error.message);
      saknas();
      return;
    }
    const d = data || {};
    /* Föräldern har stängt av NexLäx (barnets_behorigheter). */
    if (d.lage === 'avstangd') {
      S.nl.data = null;
      sek.hidden = true;
      tom.replaceChildren(tomt('NexLäx är avstängt', 'Din förälder har valt att du inte gör NexLäx här. '
        + 'Fråga din förälder om du vill.'));
      tom.hidden = false;
      return;
    }
    if (d.lage !== 'ok') { saknas(); return; }
    S.nl.data = d;
    /* XP och serien är ett tillägg: utan dem ritas vägen ändå. */
    S.nl.läge = await U.laddaLäge(supa, d.elev);
    tom.hidden = true;
    sek.hidden = false;
    ritaNexlax();
  }

  /* "Från passet" på vägen läser rapporterna, i studievyns form. */
  function nlRapporter() {
    if (!S.data || !S.data.visa_rapporter) return [];
    return (S.data.rapporter || []).map(r => ({
      lesson_date: r.datum, amne: r.amne, needs_practice: r.trana, next_focus: r.nasta
    }));
  }

  function nlUnderlag() {
    const d = S.nl.data || {};
    return {
      katalog: d.katalog || [], forsok: d.forsok || [], uppgifter: d.uppgifter || [],
      pågående: d.pagaende || {}, läge: S.nl.läge,
      elevKod: NX.årskursKod(d.arskurs), elevNamn: 'du',
      rapporter: nlRapporter(), progress: [], historik: {}, bokningar: []
    };
  }

  /* Banan vägen öppnar i: den barnet valt, annars det första av barnets
     ämnen som har en bana, sedan ämnet i en öppen digital uppgift,
     annars matematik (samma ordning som i studievyn). */
  function nlBana() {
    const d = S.nl.data || {};
    const finns = U.banor(d.katalog || []);
    const given = (d.uppgifter || []).find(h => h.niva_id && h.status !== 'klar' && h.nivaer);
    const amne = (S.nl.val.amne && finns[S.nl.val.amne]) ? S.nl.val.amne
      : (d.amnen || []).find(a => finns[a])
        || (given && finns[given.nivaer.amne] ? given.nivaer.amne : null)
        || (finns.Matematik ? 'Matematik' : null);
    return { amne, arskurs: S.nl.val.arskurs || '', spar: S.nl.val.spar || 'vag' };
  }

  function ritaVägen() {
    const host = $('#bv-nl-vag');
    if (!host || !S.nl.data) return;
    const b = nlBana();
    const ut = U.ritaVäg(Object.assign(nlUnderlag(), {
      host, amne: b.amne, arskurs: b.arskurs, spar: b.spar, öppen: S.nl.öppen, nyss: S.nl.nyss, barnvy: true,
      hjälpare: S.data && S.data.studiehjalpare ? { namn: S.data.studiehjalpare } : null
    }));
    S.nl.nyss = null;
    if (ut && ut.amne && !S.nl.val.amne) S.nl.val = { amne: ut.amne, arskurs: '', spar: 'vag' };
  }

  function ritaUtveckling() {
    const host = $('#bv-nl-utveckling');
    if (!host || !S.nl.data) return;
    U.ritaUtveckling(Object.assign(nlUnderlag(), { host, alla: S.nl.alla, barnvy: true }));
  }

  function ritaNexlax() {
    ritaVägen();
    ritaUtveckling();
  }

  /* Flikarna, under Mina lektioner och i NexLäx. Arbetsytan laddas bara
     för hälsningen, så flikarna sköts här. Pilarna flyttar mellan de
     flikar som syns, som en flikrad lovar. */
  function visaFlik(rot, namn) {
    NX.$$(rot + ' .vy-flik').forEach(k => {
      const vald = k.dataset.flik === namn;
      k.setAttribute('aria-selected', vald ? 'true' : 'false');
      k.tabIndex = vald ? 0 : -1;
    });
    NX.$$(rot + ' .vy-flik-panel').forEach(p => { p.hidden = p.dataset.flik !== namn; });
  }
  ['#bv-nexlax', 'section[data-sek="lektioner"]'].forEach(rot => {
    NX.$$(rot + ' .vy-flik').forEach(k => {
      k.addEventListener('click', () => visaFlik(rot, k.dataset.flik));
      k.addEventListener('keydown', e => {
        const steg = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!steg) return;
        e.preventDefault();
        const alla = NX.$$(rot + ' .vy-flik').filter(x => !x.hidden);
        const i = alla.indexOf(k);
        const nästa = alla[(i + steg + alla.length) % alla.length];
        visaFlik(rot, nästa.dataset.flik);
        nästa.focus();
      });
    });
  });

  /* Vägen ritas om, så knappen man tryckte på är en ny: den mäts före
     och efter och sidan flyttas med skillnaden (som i studievyn). */
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

  function spelaNivå(niva) {
    const d = S.nl.data;
    if (!niva || !d) return;
    U.spela({
      supa, niva, elev: d.elev,
      katalog: d.katalog || [], forsok: d.forsok || [], uppgifter: d.uppgifter || [],
      pågående: d.pagaende || {}, läge: S.nl.läge,
      hämtaLäge: () => U.laddaLäge(supa, d.elev),
      onStäng: ut => {
        if (!ut || !ut.ändrat) return;
        S.nl.öppen = null;
        S.nl.nyss = { klar: ut.klar, oppen: ut.oppen };
        laddaNexlax();
      }
    });
  }

  document.addEventListener('click', async e => {
    if (!S.nl.data) return;
    /* Väljaren och NP-knappen, som i studievyn: väljaren hålls still. */
    const host = $('#bv-nl-vag');
    const amne = e.target.closest('#bv-nl-vag [data-nl-amne]');
    if (amne) {
      const ak = amne.dataset.nlAk || '';
      S.nl.val = { amne: amne.dataset.nlAmne, arskurs: ak, spar: S.nl.val.spar || 'vag' };
      S.nl.öppen = null;
      ritaOchHåll('#bv-nl-vag .nl-valj', ritaVägen,
        '#bv-nl-vag .nl-amne[data-nl-amne="' + CSS.escape(amne.dataset.nlAmne) + '"]');
      return;
    }
    const ak = e.target.closest('#bv-nl-vag [data-nl-ak]');
    if (ak) {
      S.nl.val = { amne: host ? host.dataset.amne : '', arskurs: ak.dataset.nlAk, spar: S.nl.val.spar || 'vag' };
      S.nl.öppen = null;
      ritaOchHåll('#bv-nl-vag .nl-valj', ritaVägen, '#bv-nl-vag .nl-ak-knapp[data-nl-ak="' + CSS.escape(ak.dataset.nlAk) + '"]');
      return;
    }
    const spar = e.target.closest('#bv-nl-vag [data-nl-spar]');
    if (spar) {
      S.nl.val = { amne: host ? host.dataset.amne : '', arskurs: host ? host.dataset.arskurs : '', spar: spar.dataset.nlSpar };
      S.nl.öppen = null;
      ritaOchHåll('#bv-nl-vag .nl-spar', ritaVägen, '#bv-nl-vag [data-nl-spar="' + CSS.escape(spar.dataset.nlSpar) + '"]');
      return;
    }
    const nod = e.target.closest('[data-nl-nod]');
    if (nod) {
      const id = nod.dataset.nlNod;
      S.nl.öppen = S.nl.öppen === id ? null : id;
      ritaOchHåll('[data-nl-nod="' + CSS.escape(id) + '"]', ritaVägen);
      return;
    }
    const alla = e.target.closest('[data-nl-alla]');
    if (alla) {
      const öppnar = !S.nl.alla;
      if (öppnar) { S.nl.alla = true; ritaUtveckling(); }
      else ritaOchHåll('[data-nl-alla]', () => { S.nl.alla = false; ritaUtveckling(); });
      return;
    }
    const k = e.target.closest('[data-nl-starta]');
    if (k) {
      spelaNivå((S.nl.data.katalog || []).find(n => n.id === k.dataset.nlStarta));
      return;
    }
    const u = e.target.closest('[data-lax-starta]');
    if (u) {
      const h = (S.nl.data.uppgifter || []).find(x => x.id === u.dataset.laxStarta);
      if (!h || !h.nivaer) return;
      spelaNivå((S.nl.data.katalog || []).find(n => n.id === h.niva_id) || h.nivaer);
      return;
    }
    const g = e.target.closest('[data-upg-genomgang]');
    if (g) { U.genomgång(supa, g.dataset.upgGenomgang); return; }

    /* Materialet: bara länkar kommer hit (barn_nexlax). En fil öppnas
       i familjens inloggning. */
    const mat = e.target.closest('[data-lax-mat]');
    if (mat) {
      const h = (S.nl.data.uppgifter || []).find(x => x.bibliotek_id === mat.dataset.laxMat);
      const lank = h && h.biblioteksmaterial && h.biblioteksmaterial.lank;
      if (lank && /^https?:\/\//i.test(lank)) window.open(lank, '_blank', 'noopener');
      return;
    }

    /* Klar, Jag har börjat och Ångra på en vanlig uppgift. */
    const lax = e.target.closest('[data-lax]');
    if (lax) {
      const msg = $('#bv-nl-msg');
      NX.rensa(msg);
      await NXStudie.medan(lax, '…', async () => {
        const { error } = await supa.rpc('barn_uppgift', { p_id: lax.dataset.id, p_status: lax.dataset.lax });
        if (error) { NX.säg(msg, 'Uppgiften gick inte att spara. Försök igen om en stund.', false); return; }
        await laddaNexlax();
      });
    }
  });

  /* Den som låter fliken stå öppen ska se nya pass och notiser när den
     kommer tillbaka, utan att vyn blinkar: listorna byts först när det
     nya har kommit. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.data || !S.user) return;
    if (Date.now() - S.hämtad < 60000) return;
    ladda();
  });

  /* ============ tråden med studiehjälparen (barn_meddelanden, 2026-10-06) ============
     Leo: "Man ska kunna skriva till sin studiehjälpare på barn vyn".
     Barnets egen tråd, inte familjens: föräldern kan läsa den i studievyn
     men skriver inte i den, och vi kan läsa den, som familjens. Rutan
     säger båda. Barnets roll når ingen tabell, så allt går genom
     barn_chatt(), barn_chatt_last() och barn_chatt_skriv(), som prövar
     att inloggningen är aktiv och att barnet har en studiehjälpare.
     Utan funktionerna i databasen (PGRST202) står Meddelanden som förut,
     med notiserna. Ingen Realtime: tråden hämtas när vyn laddas, efter
     varje meddelande och var trettionde sekund medan Meddelanden står
     öppen. */
  async function laddaChatt() {
    const ruta = $('#bv-chatt'), ingen = $('#bv-skriva');
    const { data, error } = await supa.rpc('barn_chatt');
    if (error) {
      if (error.code !== 'PGRST202' && error.code !== '42883') console.warn('barn_chatt:', error.message);
      /* En tråd som redan står byts inte mot ingenting. */
      if (!S.chatt.data) { ruta.hidden = true; ingen.hidden = true; }
      return;
    }
    const d = data || {};
    const av = $('#bv-chatt-av');
    if (d.lage !== 'ok') {
      S.chatt.data = null;
      ruta.hidden = true;
      ingen.hidden = d.lage !== 'ingen';
      /* Föräldern har stängt av tråden (barnets_behorigheter). */
      if (av) av.hidden = d.lage !== 'avstangd';
      ritaHej();
      return;
    }
    S.chatt.data = d;
    if (av) av.hidden = true;
    ingen.hidden = true;
    ruta.hidden = false;
    $('#bv-chatt-vem').textContent = d.studiehjalpare || '';
    if (!S.chatt.ritare) {
      S.chatt.ritare = NXStudie.barnTråd({
        host: $('#bv-trad'), jag: 'barn',
        namn: { barn: 'Du', studiehjalpare: d.studiehjalpare || 'Studiehjälparen' },
        tom: 'Inga meddelanden än. Skriv första raden till ' + (d.studiehjalpare || 'din studiehjälpare') + ' här.',
        skriv: $('#bv-tr-text'), knapp: $('#bv-tr-skicka'), skicka: skickaChatt
      });
    }
    S.chatt.ritare.rita(d.meddelanden || []);
    ritaHej();
    if (S.aktiv === 'meddelanden') markeraChatt();
  }

  async function markeraChatt() {
    const c = S.chatt.data;
    if (!c || !c.olasta) return;
    const { error } = await supa.rpc('barn_chatt_last');
    if (error) { console.warn('barn_chatt_last:', error.message); return; }
    c.olasta = 0;
    ritaHej();
  }

  const SKRIV_FEL = {
    tak: 'Du har skrivit många meddelanden på kort tid. Vänta en stund och försök igen.',
    ingen: 'Du har ingen studiehjälpare just nu, så meddelandet gick inte iväg.',
    saknas: 'Din inloggning är pausad, så meddelandet gick inte iväg.',
    avstangd: 'Din förälder har stängt av tråden, så meddelandet gick inte iväg.',
    tom: 'Skriv något först.',
    lang: 'Meddelandet är för långt. Dela upp det i två.'
  };

  async function skickaChatt(text) {
    const msg = $('#bv-tr-msg');
    NX.rensa(msg);
    const { data, error } = await supa.rpc('barn_chatt_skriv', { p_text: text });
    const läge = data && data.lage;
    if (error || läge !== 'ok') {
      NX.säg(msg, SKRIV_FEL[läge] || 'Meddelandet gick inte iväg. Försök igen om en stund.', false);
      return { fel: true };
    }
    await laddaChatt();
    return {};
  }

  setInterval(() => {
    if (S.user && S.chatt.data && S.aktiv === 'meddelanden' && document.visibilityState === 'visible') laddaChatt();
  }, 30000);

  /* ============ bekräftelsen av barnets e-post (barnets_epost) ============
     Koden tas ur adressen direkt, så att den inte står kvar i historiken
     eller följer med om sidan delas. Knappen skickar den; ett ord kommer
     tillbaka. Samma vy oavsett vem som är inloggad i webbläsaren. */
  const BEKRÄFTAT = {
    ok: ['Klart, din e-post är bekräftad', 'Nu kan du logga in med den på nextrum.se, under Logga in och Elev, med lösenordet du fått av din förälder.'],
    redan: ['Adressen är redan bekräftad', 'Du kan logga in med den på nextrum.se, under Logga in och Elev.'],
    gammal: ['Länken har gått ut', 'Den gällde i sju dagar. Be din förälder skicka en ny från Nextrum.'],
    upptagen: ['Adressen används redan', 'Den hör redan till ett annat barnkonto hos Nextrum. Be din förälder om hjälp.'],
    av: ['Det går inte just nu', 'Adresser går inte att bekräfta just nu. Försök igen senare.'],
    ogiltig: ['Länken gäller inte', 'Öppna den från mejlet igen, eller be din förälder skicka en ny. Bara den senaste länken gäller.']
  };

  function visaBekräftelse(kod) {
    visa('view-bekrafta');
    const knapp = $('#bv-bek-knapp'), msg = $('#bv-bek-msg');
    knapp.addEventListener('click', async () => {
      NX.rensa(msg);
      await NXStudie.medan(knapp, 'Bekräftar…', async () => {
        const { data, error } = await supa.rpc('barn_epost_bekrafta', { p_kod: kod });
        if (error) {
          NX.säg(msg, 'Det gick inte att nå Nextrum. Försök igen om en stund.', false);
          return;
        }
        const [rubrik, text] = BEKRÄFTAT[data] || BEKRÄFTAT.ogiltig;
        $('#bv-bek-rubrik').textContent = rubrik;
        $('#bv-bek-text').textContent = text;
        knapp.hidden = true;
        $('#bv-bek-rubrik').focus();
      });
    });
  }

  /* ============ uppstart ============ */
  (async function () {
    const sök = new URLSearchParams(location.search);
    const kod = sök.get('bekrafta');
    if (kod != null) {
      history.replaceState(history.state, '', location.pathname);
      if (supa) { visaBekräftelse(kod.slice(0, 200)); return; }
    }
    if (!supa) {
      $('#fel-text').textContent = 'Inloggningen fungerar inte just nu. Försök igen senare.';
      visa('view-fel');
      return;
    }
    const user = await NX.hämtaSession();
    if (!user) { location.replace(INLOGGNINGEN); return; }
    await starta(user);
  })();

  $('#fel-igen').addEventListener('click', () => location.reload());
})();
