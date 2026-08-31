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

  // Kontaktuppgifter som visas i sidfoten och i formulärsvar.
  EPOST: 'info@nextrum.se',
};
