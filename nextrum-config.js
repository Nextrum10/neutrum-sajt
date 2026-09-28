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
     supabase/functions/_delad/konstanter.ts, och samma som ska stå i
     Fortnox: fakturan skapas där, med betalningsvillkoret som är satt
     i Fortnox. Står det olika på fakturan och i villkoren är det en
     tvist, inte ett skrivfel. verktyg/kolla-betalningsvillkor.py
     jämför de två filerna. */
  BETALNINGSVILLKOR_DAGAR: 10,

  /* Bankgironumret familjen betalar en faktura till (Fas 19.6), som
     det står på fakturan i Fortnox, till exempel '123-4567'. Tom sträng
     = inte satt: rutan Fakturor att betala hänvisar då till fakturan i
     stället för att visa ett nummer. Fylls i när bolaget har bankgiro,
     samma dag som flaggan faktura slås på. */
  BANKGIRO: '',

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

  /* Det som kräver besökarens samtycke (nextrum-samtycke.js).
     Står allt här av visas ingen ruta och ingenting lagras.

     STATISTIK: Vercel Web Analytics och Speed Insights. Inga cookies,
     men skriptet får webbläsaren att skicka sidadress och enhet, och
     det räknas som åtkomst i enheten (EDPB 2/2023). Laddas först
     efter ja till besöksstatistik.

     KALLSPARNING: webbläsaren minns varifrån besökaren kom tills
     fliken stängs, så att en anmälan krediteras annonsen och inte
     sidan den skickades från. Hör till annonsmätningen.

     META_PIXEL_ID, GOOGLE_TAG_ID (G-… eller AW-…) och GOOGLE_ADS_LEAD
     (AW-…/etikett, konverteringen "Lead"): tomma = av. INNAN ett id
     skrivs in: lagring.html och integritetspolicyn (båda språken) ska
     säga vem som får vad och att uppgifterna går till USA, CSP:n i
     vercel.json ska släppa in domänerna, och för Meta ska automatisk
     avancerad matchning vara AV i Events Manager. IMY har bötfällt
     svenska företag för Meta-pixeln 2024. Ett nytt id gör att rutan
     frågar alla igen: ett ja till det gamla är inte ett ja till det. */
  SAMTYCKE: {
    STATISTIK: true,
    KALLSPARNING: true,
    META_PIXEL_ID: '',
    GOOGLE_TAG_ID: '',
    GOOGLE_ADS_LEAD: '',
  },
};
