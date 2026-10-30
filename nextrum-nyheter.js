/* ============================================================
   NEXTRUM — sidan /nyheter (2026-10-30)

   Leo: "bygg en sida för nyhetsbrev, nyheter och när vi postar de får
   medlemmar automatiskt mejl om de nyheterna".

   Nyheterna står i tabellen nyheter och skrivs i adminvyn (Nyheter,
   nextrum-admin-nyheter.js). Den här filen hämtar de publicerade med
   anon-nyckeln, som bara når dem och bara sex kolumner (policyn i
   migrationen nyheter), och ritar listan. Med ?n=<adress> ritas en
   nyhet; adressen står i mejlet till nyhetsbrevet.

   TEXTEN är vanlig text: en tom rad är ett nytt stycke, en radbrytning
   en ny rad, och en adress som börjar med https:// blir en länk. Allt
   escapas först. Samma regel står i _delad/nyheter.ts för mejlet, och
   de ändras tillsammans.

   Sidan finns bara på svenska, som nyheterna. Inget sparas i webbläsaren.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.NEXTRUM_CONFIG || {};
  const LANK = /https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function stycken(text) {
    return String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/)
      .map(s => s.trim()).filter(Boolean)
      .map(s => '<p>' + esc(s).replace(LANK, u => '<a href="' + u + '" rel="noopener">' + u + '</a>')
        .replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  function datum(iso) {
    try {
      return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
    } catch (_e) {
      return String(iso).slice(0, 10);
    }
  }

  async function hämta() {
    const svar = await fetch(CFG.SUPABASE_URL + '/rest/v1/nyheter'
      + '?select=slug,rubrik,ingress,text,publicerad_at&order=publicerad_at.desc&limit=200', {
      headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY }
    });
    if (!svar.ok) throw new Error('HTTP ' + svar.status);
    return svar.json();
  }

  function lista(rader) {
    if (!rader.length) {
      return '<p class="nyh-tom">Inga nyheter än. Anmäl dig till nyhetsbrevet längst ner på sidan, '
        + 'så får du den första i mejlen.</p>';
    }
    return '<ol class="nyh-kort">' + rader.map(n => '<li>'
      + '<a class="nyh-a" href="/nyheter?n=' + encodeURIComponent(n.slug) + '">'
      + '<time datetime="' + esc(n.publicerad_at) + '">' + esc(datum(n.publicerad_at)) + '</time>'
      + '<h2>' + esc(n.rubrik) + '</h2>'
      + (n.ingress ? '<p>' + esc(n.ingress) + '</p>' : '')
      + '<span class="nyh-las">Läs nyheten</span>'
      + '</a></li>').join('') + '</ol>';
  }

  function artikel(n) {
    document.title = n.rubrik + ' | Nextrum';
    return '<article class="nyh-art">'
      + '<a class="nx-back" href="/nyheter"><svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg> Alla nyheter</a>'
      + '<time datetime="' + esc(n.publicerad_at) + '">' + esc(datum(n.publicerad_at)) + '</time>'
      + '<h2 class="nyh-rubrik">' + esc(n.rubrik) + '</h2>'
      + (n.ingress ? '<p class="nyh-ingress">' + esc(n.ingress) + '</p>' : '')
      + '<div class="nyh-text">' + stycken(n.text) + '</div>'
      + '</article>';
  }

  async function start() {
    const host = document.getElementById('nyh-lista');
    if (!host) return;
    const slug = new URLSearchParams(location.search).get('n') || '';
    if (!String(CFG.SUPABASE_URL || '').startsWith('https://')) return;
    let rader;
    try {
      rader = await hämta();
    } catch (e) {
      console.warn('Nextrum: nyheterna kunde inte hämtas —', e.message);
      host.innerHTML = '<p class="nyh-tom">Nyheterna gick inte att hämta just nu. Försök igen om en stund.</p>';
      return;
    }
    if (!Array.isArray(rader)) rader = [];
    if (slug) {
      const n = rader.find(r => r.slug === slug);
      host.innerHTML = n ? artikel(n)
        : '<p class="nyh-tom">Den nyheten finns inte längre. <a href="/nyheter">Se alla nyheter</a>.</p>';
      return;
    }
    host.innerHTML = lista(rader);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
