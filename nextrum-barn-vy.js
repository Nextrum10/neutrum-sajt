/* ============================================================
   NEXTRUM — barnets vy (barn.html), barnkonton_och_admin

   Ett barn med egen inloggning ser sina pass, sina timmar, sin
   studieplan, sina notiser och, om föräldern slagit på det, rapporterna.
   Aldrig priser, betalningar, erbjudanden, förälderns uppgifter eller
   något om andra familjer. Det är inte den här filen som ser till det:
   barnets roll i databasen (nextrum_barn) når inga tabeller, bara de tre
   funktionerna barn_oversikt(), barn_notiser() och barn_markera_last(),
   och de svarar bara om barnet i token. Filen ritar det de svarar.

   Allt ritas med textContent. Namn, ämnen och rapporttexter kommer ur
   databasen och skrivs av andra än barnet.

   Barnet kan inte boka, avboka, svara på ett förslag, byta lösenord eller
   ändra något om sig själv. Allt sådant gör föräldern, och vyn säger det.
   ============================================================ */
(function () {
  'use strict';
  const { $, datumText } = NX;

  const VYER = ['view-loading', 'view-auth', 'view-annan', 'view-stopp', 'view-app', 'view-fel'];
  const S = { user: null, data: null, notiser: [], hämtad: 0, laddar: false };

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
     E-post eller användarnamn, som i alla vyer (NXStudie.loggaIn). Barnet
     loggar in med användarnamnet: adressen i Auth byggs i webbläsaren,
     barnet ser den aldrig, och den tar aldrig emot något mejl (notis-ko
     hoppar över domänen, och i Auth kan den inte bytas). En vuxen som
     skriver sin e-post här kommer till sin egen vy. Det är ingen länk
     dit: det krävs den vuxnes lösenord. */
  $('#bv-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg'), knapp = $('#bv-logga-in'), lösenfält = $('#a-pass');
    NX.rensa(msg);
    if (!supa) { NX.säg(msg, 'Inloggningen fungerar inte just nu. Försök igen senare.', false); return; }

    const anv = $('#bv-anv').value.trim();
    const lösen = lösenfält.value;
    if (!anv || !lösen) { NX.säg(msg, 'Fyll i användarnamn och lösenord.', false); return; }

    await NXStudie.medan(knapp, 'Loggar in…', async () => {
      const svar = await NXStudie.loggaIn(supa, anv, lösen);
      lösenfält.value = '';
      if (svar.fel) { NX.säg(msg, svar.fel, false); lösenfält.focus(); return; }
      if (svar.barn) { await starta(svar.user); return; }
      const profil = await NX.hämtaProfil(svar.user.id);
      location.replace(NX.vyFör(svar.user, profil));
    });
  });

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
      utloggad: () => { S.user = null; S.data = null; ritaHuvud(null); visa('view-auth'); }
    });
    ritaHuvud(null);
    await ladda();
  }

  async function ladda() {
    if (S.laddar) return;
    S.laddar = true;
    try {
      const [ö, n] = await Promise.all([supa.rpc('barn_oversikt'), supa.rpc('barn_notiser')]);
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
      /* Notiserna är inte vyns viktigaste: går de inte att hämta visas
         resten ändå. */
      S.notiser = n.error ? null : (n.data || []);
      ritaHuvud(d.fornamn || null);
      ritaAllt();
      visa('view-app');
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

  /* ============ vyn ============ */
  function ritaAllt() {
    ritaHej();
    ritaTimmar();
    ritaKommande();
    ritaNotiser();
    ritaPlan();
    ritaGenomförda();
    ritaRapporter();
  }

  function ritaHej() {
    const d = S.data;
    $('#bv-rubrik').textContent = d.fornamn ? 'Hej, ' + d.fornamn + '!' : 'Hej!';
    $('#bv-lede').textContent = (d.studiehjalpare ? 'Du pluggar med ' + d.studiehjalpare + '. ' : '')
      + 'Här ser du dina pass, din studieplan och vad som hänt.';
  }

  /* Timmarna räknas ur passen: genomförda är pass med en rapport där
     barnet var med, bokade är bekräftade pass framåt. Inga köpta timmar
     och inga saldon, för de är familjens pengar. */
  function ritaTimmar() {
    const t = S.data.timmar || {};
    const ruta = (antal, text) => el('div', { class: 'bv-tal' },
      el('b', {}, tal(antal)),
      el('span', {}, (Number(antal) === 1 ? 'timme ' : 'timmar ') + text));
    $('#bv-timmar').replaceChildren(
      ruta(t.genomforda, 'genomförda'),
      ruta(t.bokade, 'bokade framåt'));
  }

  function ritaKommande() {
    const lista = S.data.kommande || [];
    const host = $('#bv-kommande');
    $('#bv-kommande-antal').textContent = lista.length ? String(lista.length) : '';
    if (!lista.length) {
      host.replaceChildren(tomt('Inga pass bokade just nu', 'När din förälder bokat ett pass står det här.'));
      return;
    }
    host.replaceChildren(...lista.map(p => {
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
    }));
  }

  function ritaNotiser() {
    const host = $('#bv-notiser');
    const antal = $('#bv-notiser-antal');
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

  function ritaRapporter() {
    const del = $('#bv-rapporter-del');
    const lista = S.data.visa_rapporter ? (S.data.rapporter || []) : null;
    del.hidden = !lista;
    if (!lista) { $('#bv-rapporter').replaceChildren(); return; }
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

  /* Den som låter fliken stå öppen ska se nya pass och notiser när den
     kommer tillbaka, utan att vyn blinkar: listorna byts först när det
     nya har kommit. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.data || !S.user) return;
    if (Date.now() - S.hämtad < 60000) return;
    ladda();
  });

  /* ============ uppstart ============ */
  (async function () {
    if (!supa) {
      visa('view-auth');
      NX.säg($('#auth-msg'), 'Inloggningen fungerar inte just nu. Försök igen senare.', false);
      return;
    }
    const user = await NX.hämtaSession();
    if (!user) { visa('view-auth'); return; }
    await starta(user);
  })();

  $('#fel-igen').addEventListener('click', () => location.reload());
})();
