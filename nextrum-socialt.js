/* ============================================================
   NEXTRUM — Trustpilot och Instagram på startsidan (2026-10-27)

   Leo: "Integrera trustpilot sidan som jag skapa för nextrum i
   sektionen på main sidan där de står innan våra första omdömen ...
   där man ser vårat betyg och när de kommer in recensioner att de
   rullar på ett rullande band", och "de borde finnas någon liten pop
   up i sidan på sidan av någon sektion där de står följ oss på
   instgram och någon liten inspo bild från vårat instgram flöde".

   VARFÖR INTE TRUSTPILOTS EGEN RUTA: den är ett skript och en ram från
   widget.trustpilot.com, och de öppna sidorna laddar ingenting från
   andra domäner och sätter inga cookies utan ett ja (lagring.html,
   CLAUDE.md avsnitt 6). Betyget och omdömena står i stället i
   omdomen.json, som vi skriver av från Trustpilot, och här ritas de i
   sajtens egna former. Alla omdömen står med, de senaste först: vi
   väljer inte ut några (texten under bandet lovar det, och
   marknadsföringslagen kräver att det stämmer). Saknas filen står
   markupens "Inga omdömen än" kvar.

   Instagram: samma sak, ingen inbäddning. Kortet står i markupen med
   ett av våra egna foton, och här poppar det bara fram när bildväggen
   syns. Krysset stänger det för sidvisningen; inget sparas.
   ============================================================ */
const NXSocialt = (function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const EN = (document.documentElement.lang || '').slice(0, 2) === 'en';
  /* NX är en const i nextrum-app.js, inte en egenskap på window. */
  const t = (k, v) => (typeof NX !== 'undefined' && NX.t ? NX.t(k, v) : k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lugnt = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function tal(x) {
    return (Math.round(x * 10) / 10).toLocaleString(EN ? 'en-GB' : 'sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function dag(iso) {
    const d = new Date(String(iso || '') + 'T12:00:00');
    if (isNaN(d)) return '';
    return d.toLocaleDateString(EN ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function stjärnor(betyg, klass) {
    const s = $('[data-tp-stjarnor] .nx-tp-tom');
    const fem = s ? s.innerHTML : '';
    return '<span class="nx-tp-stjarnor ' + (klass || '') + '" style="--fyll:' + Math.max(0, Math.min(100, betyg / 5 * 100)) + '%" aria-hidden="true">'
      + '<span class="nx-tp-tom">' + fem + '</span><span class="nx-tp-full">' + fem + '</span></span>';
  }

  /* ---------- Trustpilot ---------- */
  function trustpilot() {
    const rot = $('[data-tp]');
    if (!rot || !window.fetch) return;
    fetch('/omdomen.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) rita(rot, d); })
      .catch(() => { /* filen saknas: markupens "Inga omdömen än" står kvar */ });
  }

  function rita(rot, d) {
    const lista = (Array.isArray(d.omdomen) ? d.omdomen : [])
      .filter(o => o && o.text && o.betyg)
      .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')));
    const antal = Math.max(Number(d.antal) || 0, lista.length);
    const betyg = Number(d.betyg);
    if (antal > 0 && betyg > 0) {
      const st = $('[data-tp-stjarnor]', rot);
      st.style.setProperty('--fyll', Math.min(100, betyg / 5 * 100) + '%');
      st.setAttribute('aria-label', t('tpBetygEtikett', { b: tal(betyg) }));
      $('[data-tp-betyg]', rot).textContent = t('tpBetyg', { b: tal(betyg) });
      $('[data-tp-antal]', rot).textContent = antal === 1 ? t('tpEttOmdome') : t('tpOmdomen', { n: antal.toLocaleString(EN ? 'en-GB' : 'sv-SE') });
      rot.classList.add('har-betyg');
    }
    if (!lista.length) return;

    const band = $('[data-tp-band]', rot);
    const rad = $('[data-tp-rad]', rot);
    rad.innerHTML = lista.map(o => '<li class="nx-tp-omd">'
      + stjärnor(Number(o.betyg), 'liten')
      + (o.rubrik ? '<b>' + esc(o.rubrik) + '</b>' : '')
      + '<p>' + esc(o.text) + '</p>'
      + '<span class="nx-tp-vem">' + esc(o.namn || '') + (o.datum ? ' · ' + esc(dag(o.datum)) : '') + '</span>'
      + '</li>').join('');
    band.hidden = false;
    rot.classList.add('har-omdomen');
    if (lugnt() || lista.length < 2) return;

    /* Bandet rullar: lika många kopior som behövs för att raden ska
       vara minst dubbelt så bred som bandet, och animationen flyttar
       den exakt en uppsättning, så att slutet möter början. Kopiorna
       är dolda för skärmläsare. */
    const orig = Array.from(rad.children);
    const sats = rad.scrollWidth;
    let varv = 0;
    while (rad.scrollWidth < band.clientWidth * 2 + sats && varv++ < 12) {
      orig.forEach(li => { const k = li.cloneNode(true); k.setAttribute('aria-hidden', 'true'); rad.appendChild(k); });
    }
    const steg = orig.length > 1 ? orig[orig.length - 1].offsetLeft + orig[orig.length - 1].offsetWidth - orig[0].offsetLeft : sats;
    const mellan = parseFloat(getComputedStyle(rad).columnGap) || 0;
    rad.style.setProperty('--tp-langd', (steg + mellan) + 'px');
    rad.style.setProperty('--tp-tid', Math.max(20, (steg + mellan) / 34) + 's');
    rad.classList.add('rullar');
  }

  /* ---------- Instagram ---------- */
  function instagram() {
    const kort = $('[data-ig]');
    if (!kort) return;
    const stäng = $('[data-ig-stang]', kort);
    if (stäng) stäng.addEventListener('click', () => {
      kort.classList.remove('syns');
      kort.classList.add('stangd');
      setTimeout(() => { kort.hidden = true; }, lugnt() ? 0 : 320);
    });
    if (lugnt() || !('IntersectionObserver' in window)) return;
    kort.classList.add('vantar');
    const sek = kort.closest('section') || kort.parentElement;
    const io = new IntersectionObserver(poster => {
      if (!poster.some(p => p.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => kort.classList.add('syns'), 600);
    }, { threshold: 0.35 });
    io.observe(sek);
  }

  try { trustpilot(); } catch (e) { console.warn('NXSocialt.trustpilot:', e); }
  try { instagram(); } catch (e) { console.warn('NXSocialt.instagram:', e); }
  return { trustpilot, instagram };
})();
