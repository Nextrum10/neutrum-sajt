/* ============================================================
   NEXTRUM — /lank, länken i kontomejlen (2026-10-01)

   Mallarna i Supabase leder hit i stället för direkt till Auth:
   https://nextrum.se/lank#{{ .ConfirmationURL }}. Supabase fyller
   mallarna med Go:s html/template, som procentkodar allt efter # (provat
   2026-10-01: & i en vanlig href blev &amp;), så adressen avkodas en gång
   här. En okodad adress godtas också, om en mall någon gång skrivs om.

   Knappen är det enda som använder länken; lank.html säger varför. Länken
   godtas bara om den går till verify hos vårt eget Supabase och har en
   token. En sida som tar vilken adress som helst efter # och lägger den
   bakom en knapp med vårt namn vore en omdirigering som vem som helst
   kunde använda i ett nätfiske.

   Ingen Supabase-klient här, med flit: den hade läst adressen själv.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.NEXTRUM_CONFIG || {};

  /* Typen står i Auths länk: rubriken och knappen. */
  var TEXTER = {
    recovery:     ['Välj ett nytt lösenord', 'Välj nytt lösenord'],
    invite:       ['Välkommen till Nextrum', 'Välj lösenord'],
    signup:       ['Bekräfta din e-postadress', 'Bekräfta e-postadressen'],
    email:        ['Bekräfta din e-postadress', 'Bekräfta e-postadressen'],
    magiclink:    ['Logga in', 'Logga in'],
    email_change: ['Byt e-postadress', 'Byt e-postadress']
  };

  function avkoda(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  /* Auths länk ur adressen, eller null. */
  function länken() {
    var rå = String(location.hash || '').replace(/^#/, '');
    var text = /^https?%3a/i.test(rå) ? avkoda(rå) : rå;
    var url, bas;
    try {
      url = new URL(text);
      bas = new URL(String(CFG.SUPABASE_URL || ''));
    } catch (e) { return null; }
    if (bas.protocol !== 'https:' || url.origin !== bas.origin) return null;
    if (url.pathname !== '/auth/v1/verify' || !url.searchParams.get('token')) return null;
    return url;
  }

  function el(id) { return document.getElementById(id); }

  var år = el('year');
  if (år) år.textContent = new Date().getFullYear();

  var url = länken();
  var knapp = el('lank-knapp');

  if (!url) {
    el('lank-titel').textContent = 'Länken är inte hel';
    el('lank-text').textContent = 'Öppna länken i mejlet en gång till. Går det inte, be om en ny med '
      + 'Glömt lösenordet? när du loggar in.';
    knapp.remove();
    var varför = el('lank-varfor');
    varför.textContent = '';
    var till = document.createElement('a');
    till.href = '/foralder';
    till.textContent = 'Till inloggningen';
    varför.appendChild(till);
    return;
  }

  var typ = TEXTER[url.searchParams.get('type')];
  if (typ) {
    el('lank-titel').textContent = typ[0];
    knapp.textContent = typ[1];
  }
  var knapptext = knapp.textContent;

  knapp.addEventListener('click', function () {
    if (knapp.disabled) return;
    knapp.disabled = true;
    knapp.setAttribute('aria-busy', 'true');
    knapp.textContent = 'Öppnar…';
    location.assign(url.href);
  });

  /* Bakåt från vyn visar sidan ur webbläsarens cache, med knappen
     avstängd. Länken är förbrukad då, men ett nytt tryck ska ändå leda
     vidare: vyn säger att den inte gick att använda och erbjuder en ny. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    knapp.disabled = false;
    knapp.removeAttribute('aria-busy');
    knapp.textContent = knapptext;
  });
})();
