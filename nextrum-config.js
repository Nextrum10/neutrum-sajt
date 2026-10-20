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

  /* Pris per timme i kronor utan bindning, visas på sidan och i
     bokningen. 399 sedan 2026-10-08 (Leo): det är priset, aldrig ett
     "från"-pris. Paketen (planerna) kostar mindre i timmen, och det
     priset står bara i erbjudanden_pris. Samma tal som läxhjälpens
     pris_per_timme_ore i tjanster: ändras de, ändras båda. */
  PRIS_PER_TIMME: 399,

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

  /* BETALNINGSVILLKOR_DAGAR och BANKGIRO stod här, fakturans
     betalningstid och bankgiro, tills fakturan togs bort 2026-10-21. */

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

     GOOGLE_TAG_ID: Google Analytics 4 (bara G-…), också besöksstatistik
     och laddad först efter ja till den (2026-10-11). Sätter _ga och
     _ga_<id> i ett år, och Google kan behandla uppgifterna i USA; det
     står i lagring.html och integritetspolicyn på båda språken. Koppla
     inte egendomen till Google Ads: då blir statistiken annonsdata,
     som ingen sagt ja till.

     KALLSPARNING: webbläsaren minns varifrån besökaren kom tills
     fliken stängs, så att en anmälan krediteras annonsen och inte
     sidan den skickades från. Hör till annonsmätningen.

     META_PIXEL_ID och GOOGLE_ADS_LEAD (AW-…/etikett, konverteringen
     "Lead"; Ads-kontot är delen före snedstrecket): annonsmätning,
     tomma = av. INNAN ett id skrivs in: lagring.html och
     integritetspolicyn (båda språken) ska säga vem som får vad och att
     uppgifterna går till USA, CSP:n i vercel.json ska släppa in
     domänerna, och för Meta ska automatisk avancerad matchning vara AV
     i Events Manager. IMY har bötfällt svenska företag för Meta-pixeln
     2024. Ett nytt id gör att rutan frågar alla igen: ett ja till det
     gamla är inte ett ja till det.

     Rutan är inte ett eget reglage: den visas när något här är på, och
     står allt av finns ingen ruta och ingen länk i footern. Att dölja
     den och låta skripten gå vore att mäta utan samtycke. Ändras något
     här: kör satt-version.py. */
  SAMTYCKE: {
    STATISTIK: true,
    KALLSPARNING: true,
    META_PIXEL_ID: '',
    GOOGLE_TAG_ID: 'G-V6Y6Q0SRXX',
    GOOGLE_ADS_LEAD: '',
  },
};
