/* ============================================================
   NEXTRUM — inställningar

   DET HÄR ÄR DEN ENDA FILEN DU BEHÖVER ÄNDRA I.
   Alla tre sidorna (index, foralder, larare) läser härifrån.

   1. Gå till supabase.com → ditt projekt → Project Settings → API
   2. Kopiera "Project URL" och klistra in nedan
   3. Kopiera nyckeln som heter "anon" / "public" och klistra in nedan
   4. Spara filen. Klart.

   Nej, anon-nyckeln är inte hemlig. Den är byggd för att ligga i
   webbläsaren. Det som skyddar datan är RLS-reglerna i schema.sql,
   inte nyckeln. Service_role-nyckeln däremot får ALDRIG hamna här.
   ============================================================ */

window.NEXTRUM_CONFIG = {
  SUPABASE_URL: 'https://ddkfiuvcppalutfulvbi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_GNm2Tsgy2vFTL2BsRyIRPQ_Cu9YkZVw',

  // Pris per timme i kronor, visas på sidan och i bokningen.
  PRIS_PER_TIMME: 379,

  /* Länken familjen skickas till för att lämna en Google-recension.
     Hämtas i Google Business Profile → "Be om recensioner", och ser
     ut som https://g.page/r/XXXXXXXX/review.

     Tom sträng = ingen knapp ritas. Det är med flit: en knapp som
     leder ingenstans är sämre än ingen knapp, och profilen finns
     inte förrän någon verifierat den. Se GOOGLE-FORETAGSPROFIL.md. */
  GOOGLE_RECENSION_URL: '',

  /* Tillägg när fler än ett barn sitter med i samma pass, per timme.

     FAST, inte per barn: två barn och tre barn kostar samma sak, och
     tre är taket (tjanster.extra_personer_max). Ett syskon som sitter
     med kostar alltså inte ett helt nytt pass — men studiehjälparen
     delar sin uppmärksamhet, och det ska synas. */
  PRIS_EXTRA_BARN: 69,

  /* Betalningstiden på en månadsfaktura, i dagar (Fas 14.6). Samma
     siffra som BETALNINGSVILLKOR_DAGAR i
     supabase/functions/_delad/konstanter.ts, och samma som Wint ska stå
     på: fakturan skapas där, med Wints betalningsvillkor. Står det
     olika på fakturan och i villkoren är det en tvist, inte ett
     skrivfel. verktyg/kolla-betalningsvillkor.py jämför de två filerna. */
  BETALNINGSVILLKOR_DAGAR: 10,

  // Kontaktuppgifter som visas i sidfoten och i formulärsvar.
  EPOST: 'info@nextrum.se',

  /* Länken den sökande får i steget Utbildning: introduktionen och
     provet som ska vara gjort innan hen tas in i poolen.

     Tom sträng = knappen skickar ingen länk, utan säger att den inte
     är satt. Samma regel som GOOGLE_RECENSION_URL: hellre en knapp
     som säger att något saknas än en som mejlar en tom rad.

     Kravet bakom den står i nextrum-admin-rekrytering.js: en
     studiehjälpare som inte vet hur rapporten fungerar lämnar inga
     rapporter, och utan rapport blir passet aldrig genomfört. */
  UTBILDNING_URL: '',
};
