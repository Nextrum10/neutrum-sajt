/* ============================================================
   NEXTRUM — nyhetsbrevet (2026-10-28)

   Två jobb, en fil:
   1. Formuläret. Det ritas i footern på varje öppen sida, och bara där
      (startsidans Nästa steg hade ett till, borttaget 2026-10-29, Leo:
      "Ta bort denna"). nextrum-samtycke.js
      laddar filen, för den står bara på de öppna sidorna: aldrig i
      vyerna, aldrig på /avanmal eller /nyhetsbrev, som har en nyckel i
      adressen. Footern ändras alltså inte i varje sida för hand.
   2. Sidan /nyhetsbrev, dit länkarna i mejlen går: ?b= bekräftar och
      ?a= avanmäler, men först när man trycker på knappen. Länkskannrar
      följer varje länk i ett mejl, och en sida som gjorde det själv
      hade anmält och avanmält folk åt dem.

   Inget sparas i webbläsaren. Texterna står här som par, för
   /en/-generatorn översätter aldrig <script>.
   ============================================================ */
(function () {
  'use strict';

  const EN = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv');
  const ORD = {
    rubrik:   ['Studietips och nyheter, två gånger i månaden', 'Study tips and news, twice a month'],
    text:     ['Konkreta tips för läxor och prov, och det som är nytt hos oss. Inget annat.',
               'Practical tips for homework and tests, and what is new with us. Nothing else.'],
    etikett:  ['Din e-post', 'Your email'],
    knapp:    ['Skriv upp mig', 'Sign me up'],
    policy:   ['Så hanterar vi din adress', 'How we handle your address'],
    nyheter:  ['Läs nyheterna', 'Read the news (in Swedish)'],
    skickar:  ['Skickar …', 'Sending …'],
    klart:    ['Kolla din inkorg och tryck på länken i mejlet, så är du med.',
               'Check your inbox and tap the link in the email to confirm.'],
    epost:    ['Det ser inte ut som en e-postadress.', 'That does not look like an email address.'],
    fel:      ['Det gick inte just nu. Försök igen om en stund.', 'That did not work just now. Try again in a little while.'],
    ingenKod: ['Länken saknar sin kod. Öppna den från mejlet en gång till.', 'The link is missing its code. Open it from the email again.'],
    bekraftad:['Klart! Du får nyhetsbrevet från och med nästa utskick.', 'Done! You will get the newsletter from the next issue.'],
    avanmald: ['Klart. Du får inga fler nyhetsbrev, och vi har raderat din adress.', 'Done. You will not get any more newsletters, and we have deleted your address.'],
    ogiltig:  ['Länken gäller inte längre. Anmäl dig igen i foten på sidan om du vill.', 'The link is no longer valid. Sign up again in the footer if you like.'],
    jaB:      ['Ja, skicka mig nyhetsbrevet', 'Yes, send me the newsletter'],
    jaA:      ['Avsluta nyhetsbrevet', 'Unsubscribe'],
    fragaB:   ['Tryck på knappen för att bekräfta din anmälan.', 'Tap the button to confirm your sign-up.'],
    fragaA:   ['Tryck på knappen så slutar vi skicka nyhetsbrevet och raderar din adress.', 'Tap the button and we will stop sending the newsletter and delete your address.']
  };
  const ord = (k) => ORD[k][EN ? 1 : 0];
  const ADRESS = () => (window.NEXTRUM_CONFIG || {}).SUPABASE_URL + '/functions/v1/nyhetsbrev';
  const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  async function posta(body) {
    return fetch(ADRESS(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  let nummer = 0;
  function formulär(kalla) {
    const id = 'nb-' + (++nummer);
    const f = document.createElement('form');
    f.className = 'nb';
    f.noValidate = true;
    f.setAttribute('aria-labelledby', id + '-r');
    f.innerHTML =
      '<p class="nb-rubrik" id="' + id + '-r"></p>' +
      '<p class="nb-text"></p>' +
      '<div class="nb-rad">' +
        '<label class="nb-dold" for="' + id + '-e"></label>' +
        '<input class="nb-inp" id="' + id + '-e" type="email" name="epost" autocomplete="email" inputmode="email" required>' +
        '<button class="btn btn-primary nb-knapp" type="submit"></button>' +
      '</div>' +
      /* Honungsfällan: dold för människor och skärmläsare, ifylld av botar. */
      '<input class="nb-falla" type="text" name="webbplats" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="nb-status" role="status" aria-live="polite"></p>' +
      '<p class="nb-not"><a href="' + (EN ? '/en' : '') + '/integritetspolicy#nyhetsbrev"></a>' +
      /* Nyheterna (2026-10-30) står på /nyheter, bara på svenska. Länken står
         här och inte i varje sidas footer, för formuläret är redan på varje sida. */
      ' · <a class="nb-nyheter" href="/nyheter"' + (EN ? ' hreflang="sv"' : '') + '></a></p>';
    f.querySelector('.nb-rubrik').textContent = ord('rubrik');
    f.querySelector('.nb-text').textContent = ord('text');
    f.querySelector('label').textContent = ord('etikett');
    f.querySelector('.nb-inp').placeholder = ord('etikett');
    f.querySelector('.nb-knapp').textContent = ord('knapp');
    f.querySelector('.nb-not a').textContent = ord('policy');
    f.querySelector('.nb-nyheter').textContent = ord('nyheter');

    const status = f.querySelector('.nb-status');
    const knapp = f.querySelector('.nb-knapp');
    const fält = f.querySelector('.nb-inp');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const epost = fält.value.trim();
      if (!EPOST.test(epost)) {
        status.textContent = ord('epost');
        fält.setAttribute('aria-invalid', 'true');
        fält.focus();
        return;
      }
      fält.removeAttribute('aria-invalid');
      knapp.disabled = true;
      status.textContent = ord('skickar');
      try {
        const svar = await posta({
          epost: epost,
          kalla: kalla,
          sida: location.pathname,
          webbplats: f.querySelector('.nb-falla').value
        });
        if (svar.ok) {
          status.textContent = ord('klart');
          f.querySelector('.nb-rad').hidden = true;
          return;
        }
        status.textContent = svar.status === 400 ? ord('epost') : ord('fel');
      } catch (_e) {
        status.textContent = ord('fel');
      }
      knapp.disabled = false;
    });
    return f;
  }

  function sidan() {
    const knapp = document.getElementById('nb-ja');
    const status = document.getElementById('nb-status');
    const fraga = document.getElementById('nb-fraga');
    if (!knapp || !status) return;
    const q = new URLSearchParams(location.search);
    const b = q.get('b') || '';
    const a = q.get('a') || '';
    const token = b || a;
    if (!token) {
      status.textContent = ord('ingenKod');
      knapp.remove();
      return;
    }
    fraga.textContent = ord(b ? 'fragaB' : 'fragaA');
    knapp.textContent = ord(b ? 'jaB' : 'jaA');
    knapp.hidden = false;
    const sprak = document.querySelector('.sprakval a[href]');
    if (sprak) sprak.href = sprak.getAttribute('href') + (b ? '?b=' : '?a=') + encodeURIComponent(token);

    knapp.addEventListener('click', async function () {
      knapp.disabled = true;
      status.textContent = ord('skickar');
      try {
        const svar = await posta(b ? { bekrafta: b } : { avanmal: a });
        if (svar.ok) {
          status.textContent = ord(b ? 'bekraftad' : 'avanmald');
          knapp.remove();
          fraga.remove();
          return;
        }
        status.textContent = svar.status === 403 ? ord('ogiltig') : ord('fel');
        if (svar.status === 403) { knapp.remove(); return; }
      } catch (_e) {
        status.textContent = ord('fel');
      }
      knapp.disabled = false;
    });
  }

  function start() {
    if (document.getElementById('nb-ja')) { sidan(); return; }
    const fot = document.querySelector('.ftr .ftr-brand');
    if (fot) fot.appendChild(formulär('footer'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
