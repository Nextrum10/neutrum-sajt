/* ============================================================
   NEXTRUM — /utbildningsprov: provet efter utbildningsmötet (Fas 22.1)

   Den som sökt jobb får länken i ett mejl när admin markerat att hen
   varit på utbildningsmötet. Nyckeln i adressen (?t=) öppnar provet
   för just den ansökan, i tre dagar. Hen har inget konto än, det
   skapas i steget efter provet.

   FACIT FINNS INTE HÄR

   Frågorna hämtas från edge-funktionen utbildningsprov utan svaren,
   och svaren skickas tillbaka dit för att rättas. Står något om vilket
   svar som är rätt i den här filen är det ett fel.

   SVAREN SPARAS I WEBBLÄSAREN TILLS PROVET LÄMNAS IN

   Tjugo minuter är lång tid på en telefon: ett samtal, en flik som
   laddas om, och allt är borta. Valen sparas därför i localStorage
   medan man svarar, och rensas när provet lämnats in. Nyckeln står
   inte i lagringen, bara en kort summa av den: en nyckel i lagringen
   hade legat kvar som en länk till provet på en delad dator. Går
   lagringen inte att använda (privat läge) fungerar provet ändå, det
   minns bara inte.

   MODULEN STÅR PÅ EGNA BEN

   Ingen supabase-js, inget NX utom sidhuvudets beteenden, som startas
   om de finns. Går något annat på sidan sönder ska provet ändå gå att
   göra. Sidan är bara svensk, så texterna står här direkt.
   ============================================================ */
(function () {
  'use strict';

  const KONF = window.NEXTRUM_CONFIG || {};
  const ADRESS = String(KONF.SUPABASE_URL || '') + '/functions/v1/utbildningsprov';
  const EPOST = KONF.EPOST || 'info@nextrum.se';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti',
                   'september', 'oktober', 'november', 'december'];
  const DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

  let nyckel = '';
  let fragor = [];
  let krav = 0;

  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* '2026-09-30' → 'onsdag 30 september'. Datumet är en dag, inte en
     tidpunkt: det läses som UTC för att inte flytta sig en dag bakåt i
     en webbläsare väster om Greenwich. */
  function dagText(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DAGAR[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MANADER[+m[2] - 1];
  }

  /* ---------- lagringen ---------- */
  function lagringsnyckel() {
    /* En kort summa av provnyckeln, inte nyckeln. Räcker för att två
       prov i samma webbläsare inte ska blanda ihop sina svar. */
    let h = 0;
    for (let i = 0; i < nyckel.length; i++) h = (h * 31 + nyckel.charCodeAt(i)) | 0;
    return 'nx-prov-' + (h >>> 0).toString(36);
  }
  function lasSparat() {
    try {
      const v = JSON.parse(localStorage.getItem(lagringsnyckel()) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  function spara(svar) {
    try { localStorage.setItem(lagringsnyckel(), JSON.stringify(svar)); } catch (e) { /* privat läge */ }
  }
  function glom() {
    try { localStorage.removeItem(lagringsnyckel()); } catch (e) { /* privat läge */ }
  }

  /* ---------- anropet ---------- */
  async function anropa(kropp) {
    let svar;
    try {
      svar = await fetch(ADRESS, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ t: nyckel }, kropp))
      });
    } catch (e) {
      return { natet: true };
    }
    const data = await svar.json().catch(() => ({}));
    return { status: svar.status, data: data || {} };
  }

  function lage(html) {
    $('prov-lage').innerHTML = html;
  }

  function felruta(text) {
    lage('<div class="nx-panel"><p style="margin:0">' + esc(text) + '</p></div>');
  }

  /* ---------- läget ---------- */
  async function start() {
    startaSidhuvudet();

    nyckel = (new URLSearchParams(location.search).get('t') || '').trim();
    if (!UUID.test(nyckel)) {
      felruta('Länken saknar sin kod. Öppna länken i mejlet en gång till, eller skriv till '
        + EPOST + ' så skickar vi den igen.');
      return;
    }

    lage('<p class="xsmall">Hämtar provet …</p>');
    const r = await anropa({ handling: 'hamta' });
    if (r.natet) {
      felruta('Ingen kontakt med servern. Kontrollera uppkopplingen och ladda om sidan.');
      return;
    }
    if (r.status === 404) {
      felruta('Länken gäller inte. Mejlprogram klipper ibland långa länkar, så prova att öppna den '
        + 'från mejlet igen. Fungerar det inte, skriv till ' + EPOST + '.');
      return;
    }
    if (r.status !== 200) {
      felruta('Provet gick inte att hämta just nu. Försök igen om en stund, eller skriv till ' + EPOST + '.');
      return;
    }

    const d = r.data;
    krav = d.krav || 0;
    const hej = d.fornamn ? 'Hej ' + esc(d.fornamn) + '! ' : '';

    if (d.lage === 'godkant') {
      glom();
      lage('<div class="nx-panel"><p style="margin:0">' + hej + '<b>Du har redan klarat provet.</b> '
        + 'Nästa steg är ditt konto. Mejlet om det har gått till dig; hittar du det inte, skriv till '
        + esc(EPOST) + '.</p></div>');
      return;
    }
    if (d.lage !== 'oppet') {
      lage('<div class="nx-panel"><p style="margin:0">' + hej + '<b>Provet är stängt.</b> '
        + 'Det var öppet i tre dagar efter utbildningen'
        + (d.sista_dag ? ', till och med ' + esc(dagText(d.sista_dag)) : '')
        + '. Skriv till ' + esc(EPOST) + ' så öppnar vi det igen.</p></div>');
      return;
    }

    fragor = Array.isArray(d.fragor) ? d.fragor : [];
    lage('<p style="margin:0">' + hej + 'Provet är öppet till och med <b>'
      + esc(dagText(d.sista_dag)) + '</b>. Det har ' + fragor.length + ' frågor och du behöver '
      + krav + ' rätt för att bli godkänd. Välj det svar som stämmer bäst med handboken.'
      + (d.forsok
        ? ' Du har gjort provet ' + d.forsok + (d.forsok === 1 ? ' gång' : ' gånger')
          + (d.basta ? ', som bäst ' + d.basta.ratt + ' av ' + d.basta.antal + ' rätt' : '') + '.'
        : '')
      + '</p>');
    ritaProvet();
  }

  /* ---------- formuläret ---------- */
  function ritaProvet() {
    const sparat = lasSparat();
    const avsnitt = [];
    fragor.forEach(f => {
      let a = avsnitt[avsnitt.length - 1];
      if (!a || a.namn !== f.avsnitt) avsnitt.push(a = { namn: f.avsnitt, fragor: [] });
      a.fragor.push(f);
    });

    let nr = 0;
    $('prov-fragor').innerHTML = avsnitt.map((a, ai) =>
      '<div class="nx-panel prov-avsnitt">'
      + '<h2>' + esc(a.namn) + '</h2>'
      + '<p class="prov-raknare">Del ' + (ai + 1) + ' av ' + avsnitt.length + '</p>'
      + a.fragor.map(f => {
        nr++;
        return '<fieldset class="prov-fraga" data-fraga="' + esc(f.id) + '">'
          + '<legend><em>' + nr + '.</em><span>' + esc(f.fraga) + '</span></legend>'
          + '<div class="prov-alt">'
          + f.alternativ.map(al =>
              '<label><input type="radio" name="f-' + esc(f.id) + '" value="' + esc(al.id) + '"'
              + (sparat[f.id] === al.id ? ' checked' : '') + '>'
              + '<span>' + esc(al.text) + '</span></label>').join('')
          + '</div>'
          + '<p class="prov-saknas">Den här frågan saknar svar.</p>'
          + '</fieldset>';
      }).join('')
      + '</div>').join('');

    $('prov-resultat').hidden = true;
    $('prov-form').hidden = false;
    raknaBesvarade();
  }

  function valda() {
    const svar = {};
    fragor.forEach(f => {
      const v = document.querySelector('input[name="f-' + CSS.escape(f.id) + '"]:checked');
      if (v) svar[f.id] = v.value;
    });
    return svar;
  }

  function raknaBesvarade() {
    const n = Object.keys(valda()).length;
    $('prov-besvarade').textContent = n + ' av ' + fragor.length + ' besvarade';
  }

  /* ---------- lämna in ---------- */
  async function lamna(e) {
    e.preventDefault();
    const svar = valda();

    /* Alla frågor ska ha ett svar. Den första som saknas får fokus, så
       att man hamnar där i stället för att leta. */
    let forsta = null;
    document.querySelectorAll('.prov-fraga').forEach(fs => {
      const saknas = !svar[fs.dataset.fraga];
      fs.classList.toggle('ar-obesvarad', saknas);
      if (saknas && !forsta) forsta = fs;
    });
    if (forsta) {
      $('prov-besvarade').textContent = (fragor.length - Object.keys(svar).length)
        + ' frågor saknar svar. De är markerade.';
      forsta.scrollIntoView({ block: 'center' });
      const r = forsta.querySelector('input');
      if (r) r.focus({ preventScroll: true });
      return;
    }

    const knapp = $('prov-skicka');
    knapp.disabled = true;
    knapp.textContent = 'Rättar …';
    const r = await anropa({ handling: 'lamna', svar: svar });
    knapp.disabled = false;
    knapp.textContent = 'Lämna in provet';

    if (r.natet) {
      $('prov-besvarade').textContent = 'Ingen kontakt med servern. Svaren finns kvar, försök igen.';
      return;
    }
    if (r.status !== 200) {
      $('prov-besvarade').textContent = r.status === 404
        ? 'Länken gäller inte längre. Skriv till ' + EPOST + '.'
        : 'Provet gick inte att lämna in just nu. Svaren finns kvar, försök igen om en stund.';
      return;
    }

    const d = r.data;
    if (d.utfall !== 'ok') {
      /* Läget ändrades medan provet stod öppet: tiden gick ut, eller
         taket för dagen nåddes. Svaren sparas kvar för nästa gång. */
      $('prov-besvarade').textContent = {
        stangt: 'Provet har stängt. Skriv till ' + EPOST + ' så öppnar vi det igen.',
        godkant: 'Du har redan klarat provet.',
        for_manga: 'Du har gjort provet tio gånger det senaste dygnet. Läs igenom handboken och försök igen i morgon.'
      }[d.utfall] || 'Provet gick inte att lämna in.';
      return;
    }

    glom();
    visaResultat(d);
  }

  function visaResultat(d) {
    const ruta = $('prov-resultat');
    const lista = '<ul>' + (d.avsnitt || []).map(a =>
      '<li class="' + (a.ratt < a.antal ? 'ar-miss' : '') + '"><span>' + esc(a.namn) + '</span>'
      + '<b>' + a.ratt + ' av ' + a.antal + '</b></li>').join('') + '</ul>';

    ruta.innerHTML = d.godkant
      ? '<h2>Grattis, du klarade provet!</h2>'
        + '<p class="prov-poang">' + d.ratt + ' av ' + d.antal + '</p>'
        + '<p>Introduktionen är klar. Nu kommer ett mejl om sista steget: att skapa ditt konto på '
        + 'nextrum.se med samma e-postadress som i ansökan. Sedan godkänner vi din profil.</p>'
        + lista
      : '<h2>Inte godkänt den här gången</h2>'
        + '<p class="prov-poang">' + d.ratt + ' av ' + d.antal + '</p>'
        + '<p>Du behöver ' + d.krav + ' rätt. Läs igen i handboken om de delar där det blev fel, '
        + 'och gör sedan om provet. Svarsalternativen kommer i ny ordning.</p>'
        + lista
        + '<div class="nx-cta-rad"><button type="button" class="btn btn-primary btn-lg" id="prov-igen">'
        + 'Gör om provet</button></div>';

    $('prov-form').hidden = true;
    lage('');
    ruta.hidden = false;
    ruta.scrollIntoView({ block: 'start' });
    ruta.focus({ preventScroll: true });

    const igen = $('prov-igen');
    if (igen) igen.addEventListener('click', () => {
      /* En ny hämtning: nya ordningen på alternativen, och läget på nytt
         om provet hunnit stänga. */
      ruta.hidden = true;
      window.scrollTo(0, 0);
      start();
    });
  }

  /* Sidhuvudet (menyn, inloggningslänken) om NX laddade. Utan NX
     fungerar provet ändå, bara utan mobilmenyn. */
  function startaSidhuvudet() {
    if (startaSidhuvudet.klar) return;
    startaSidhuvudet.klar = true;
    /* typeof, inte window.NX: en del moduler deklareras med const på
       toppnivå och hamnar då aldrig på window. */
    try {
      if (typeof NX !== 'undefined') {
        NX.initHeader();
        NX.initVagval();
        NX.märkInloggad();
      }
      if (typeof NXFin !== 'undefined') NXFin.allt();
    } catch (e) { /* sidhuvudet är inte provet */ }
  }

  function koppla() {
    const form = $('prov-form');
    if (!form) return;
    form.addEventListener('submit', lamna);
    form.addEventListener('change', e => {
      if (!e.target.matches('input[type="radio"]')) return;
      const fs = e.target.closest('.prov-fraga');
      if (fs) fs.classList.remove('ar-obesvarad');
      spara(valda());
      raknaBesvarade();
    });
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', koppla);
  } else {
    koppla();
  }
})();
