/* ============================================================
   NEXTRUM — /avanmal: knappen som stänger av en sorts notismejl

   Sidan är den enda vägen en människa möter notis-avanmal. Funktionen
   svarar bara på POST; en GET dit skickas hit med 303 i stället, för
   länkskannrar i företagsmejl och antivirus följer varje länk i varje
   mejl. Hade en GET avregistrerat hade folk blivit avregistrerade av
   sitt eget IT-skydd, utan att ha rört något.

   DÄRFÖR FRÅGAR SIDAN FÖRST, och det är knappen som POSTar.


   MODULEN STÅR PÅ EGNA BEN

   Ingen NX, ingen supabase-js, inget utom NEXTRUM_CONFIG. Sidan nås
   av någon som klickat i ett mejl och vill bli av med mejlet; går
   något annat på sidan sönder ska knappen ändå fungera. Det är också
   skälet till att uppstarten ligger här och inte i sidans eget
   uppstartsblock.


   TEXTERNA LIGGER HÄR, SOM PAR

   /en/-generatorn maskerar <script> och översätter dem aldrig (se
   project-nextrum-engelska, fälla 4). En status skriven i sidans eget
   skript hade blivit svensk på den engelska sidan, och ingen
   strukturkontroll hade sett det. Ligger den här är de två sidornas
   skript dessutom teckenidentiska, vilket är vad
   verktyg/jamfor-sprak.py kontrollerar.


   TOKENEN SKRIVS ALDRIG UT

   Den står i adressen och skickas i kroppen. Den hamnar inte i
   statusraden, inte i ett felmeddelande och inte i konsolen: en token
   som klistras in i ett supportärende är en avregistrering någon
   annan kan göra.
   ============================================================ */
(function () {
  'use strict';

  /* Samma språktest som nextrum-app.js och nextrum-tjanster.js. Att
     göra det annorlunda här vore att låta en sida hamna i två språk. */
  const EN = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv');

  const ORD = {
    ingenKod: ['Länken saknar sin kod. Öppna länken i mejlet en gång till, eller skriv till oss så ordnar vi det.',
               'The link is missing its code. Open the link in the email again, or write to us and we will sort it out.'],
    skickar:  ['Stänger av …',
               'Turning off …'],
    klart:    ['Klart. Du får inga fler mejl av den här sorten.',
               'Done. You will not receive any more emails of this kind.'],
    ogiltig:  ['Länken gäller inte. Mejlprogram klipper ibland långa länkar — prova att öppna den från mejlet igen.',
               'The link is not valid. Email programs sometimes cut long links — try opening it from the email again.'],
    borta:    ['Länken gäller inte längre.',
               'The link is no longer valid.'],
    fel:      ['Det gick inte just nu. Försök igen om en stund, eller skriv till info@nextrum.se.',
               'That did not work just now. Try again in a little while, or write to info@nextrum.se.'],
    natet:    ['Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen.',
               'No contact with the server. Check your connection and try again.'],
    knapp:    ['Stäng av de här mejlen',
               'Turn these emails off'],
    hem:      ['Till startsidan',
               'To the home page']
  };
  function ord(nyckel) {
    return (ORD[nyckel] || [nyckel, nyckel])[EN ? 1 : 0];
  }

  function start() {
    const knapp = document.getElementById('avanmal-ja');
    const status = document.getElementById('avanmal-status');
    const fraga = document.getElementById('avanmal-fraga');
    const nej = document.getElementById('avanmal-nej');
    if (!knapp || !status) return;

    const konf = window.NEXTRUM_CONFIG || {};
    const token = new URLSearchParams(location.search).get('t') || '';

    /* Utan kod finns inget att stänga av. Knappen stängs av direkt i
       stället för att låta någon trycka och få ett fel. */
    if (!token) {
      status.textContent = ord('ingenKod');
      knapp.disabled = true;
      return;
    }

    knapp.addEventListener('click', async function () {
      knapp.disabled = true;
      status.textContent = ord('skickar');

      let svar;
      try {
        svar = await fetch(konf.SUPABASE_URL + '/functions/v1/notis-avanmal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ t: token })
        });
      } catch (_e) {
        /* Nätet, inte servern. Knappen öppnas igen: ett nytt försök
           är det enda som hjälper, och tokenen gäller fortfarande. */
        status.textContent = ord('natet');
        knapp.disabled = false;
        return;
      }

      if (svar.ok) {
        status.textContent = ord('klart');
        /* Bekräftelsen är sidans huvudbudskap nu, inte en fotnot.
           xsmall bort, annars läser man den inte. */
        status.classList.remove('xsmall');
        /* Knappen tas bort helt. Kvar och avstängd ser ut som att
           något gick fel; borta är det enda som ser klart ut. */
        knapp.remove();
        if (fraga) fraga.remove();
        /* "Nej, behåll dem" är ett svar på en fråga som inte längre
           står kvar. Lämnad som den är ser den ut att ångra det man
           just gjorde, fast den bara går hem. */
        if (nej) nej.textContent = ord('hem');
        return;
      }

      /* 403 är en token som inte stämmer, 400 ett konto som inte
         finns kvar. Allt annat är vårt fel, inte länkens. */
      status.textContent = svar.status === 403 ? ord('ogiltig')
        : svar.status === 400 ? ord('borta')
        : ord('fel');

      /* Ett fel hos oss går över; en trasig länk gör det inte, och
         en knapp som går att trycka om och om igen på en länk som
         aldrig kommer att gälla är bara elak. */
      if (svar.status !== 403 && svar.status !== 400) {
        knapp.disabled = false;
        knapp.textContent = ord('knapp');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
