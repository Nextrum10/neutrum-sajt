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

   ------------------------------------------------------------
   BOKNINGSSIDAN FÖR INTERVJUN (INTERVJU_BOKNINGSLANK nedan)

   Den som går vidare till intervju bokar en tid själv på en
   bokningssida i Google Kalender. Ingen koppling till Google behövs:
   det är bara en länk. Så här skapar du sidan (Leo, 2026-10-21):

     1. Öppna Google Kalender inloggad som info@nextrum.se, aldrig ett
        privat Gmail: Workspace-avtalet med Google gäller bara där, och
        integritetspolicyn säger att bokningen ligger i vår kalender.
     2. Skapa → Bokningsschema (på engelska Appointment schedule).
     3. Titel: "Intervju med Nextrum". Längd: till exempel 20 minuter.
        Tillgänglighet: de dagar och tider ni kan intervjua. Under
        Bokningsfönster: hur långt fram man får boka och hur nära i tid
        (till exempel högst fyra veckor fram, minst 12 timmar innan).
        Gärna en buffert mellan mötena och ett tak per dag.
     4. Plats och konferens: Google Meet. Då får den som bokar
        Meet-länken i bekräftelsen.
     5. Bokningsformulär: förnamn, efternamn och e-post räcker. Lägg
        inte till frågor: svaren hamnar hos Google, och det vi behöver
        står redan i ansökan.
     6. Bekräftelser och påminnelser: låt Google mejla bekräftelsen och
        en påminnelse. Den som bokar behöver inget Google-konto.
     7. Spara. Öppna bokningssidan och kopiera dess adress (Dela →
        Kopiera länk). Den ser ut som https://calendar.app.google/XXXXXXXX.
     8. Klistra in adressen i INTERVJU_BOKNINGSLANK nedan, och samma
        adress i supabase/functions/_delad/notiser/intervju.ts (lank):
        mejlet läser inte den här filen. Kör
        python3 verktyg/kolla-mejltexter.py, som säger till om de två
        skiljer sig. Driftsätt sedan notis-ko, så att det automatiska
        mejlet bär den nya länken.
     9. Prova själv: öppna länken i ett privat fönster och boka en tid.
        Ta bort provbokningen i kalendern efteråt.

   Bokningarna står i kalendern, inte i adminvyn: vyn läser aldrig
   kalendern. Policyn lovar att en bokning tas bort för hand senast ett
   år efter intervjun.
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

  /* Tillägg när fler än ett barn sitter med i samma pass, per timme
     (hette PRIS_EXTRA_BARN till 2026-10-21). Databasens pris är tjänstens
     (tjanster.extra_personer_ore), och de ska vara samma tal; det här
     visas på de öppna sidorna, som läser det härifrån.

     I DAG FAST, inte per barn: två barn och tre barn kostar samma sak,
     och tre är taket (tjanster.extra_personer_max). Ett syskon som sitter
     med kostar alltså inte ett helt nytt pass — men studiehjälparen
     delar sin uppmärksamhet, och det ska synas.

     SYSKONTILLÄGGET SOM SKULD (syskontillagg_som_skuld, 2026-10-21) tar
     samma pris, lika mycket med ett som med två syskon (syskontillagget_fast,
     Leo: "Tre barn kostar 468 i timmen"), men som en skuld efter passet.
     Det gäller först när strömbrytaren syskonskuld slås på, och då ska
     prissidan, områdessidorna och FAQ:n säga att tillägget betalas efter
     passet, i samma ändring. Priset på dem står kvar. */
  PRIS_SYSKON_TILLAGG_KR_PER_TIMME: 69,

  /* Villkoren för syskontillägget: punkten #syskontillagg i
     användarvillkoren, skriven 2026-10-22 (Leo: "skriv villkorstexten
     själv"), och versionen står i databasen
     (tillagg_installning.villkor_version, 2026-10-23). Tom sträng = rutan
     säger bara att villkoren står i användarvillkoren, utan länk. */
  TILLAGG_VILLKOR_URL: '/anvandarvillkor#syskontillagg',
  /* Villkoren för värvningsbonusen (varvningsbonus, 2026-10-21): punkten
     #tips i användarvillkoren, omskriven för bonusen i versionen 2026-10-22
     (Leo: "Fixa nr 6"). Tom sträng = kortet Värva en kompis säger att
     villkoren skrivs. Beloppet, semesterersättningens del och händelsen
     står i databasen (varvning_installning), inte här. */
  VARVNING_VILLKOR_URL: '/anvandarvillkor#tips',

  /* BETALNINGSVILLKOR_DAGAR och BANKGIRO stod här, fakturans
     betalningstid och bankgiro, tills fakturan togs bort 2026-10-21. */

  // Kontaktuppgifter som visas i sidfoten och i formulärsvar.
  EPOST: 'info@nextrum.se',

  /* Länken den sökande får i steget Utbildning: introduktionen, som ska
     vara genomgången innan hen tas in i poolen. Provet om den görs i
     studiehjälparvyn, direkt efter lösenordet (nextrum-provet.js).

     Tom sträng = knappen skickar ingen länk, utan säger att den inte
     är satt. Samma regel som GOOGLE_RECENSION_URL: hellre en knapp
     som säger att något saknas än en som mejlar en tom rad.

     Kravet bakom den står i nextrum-admin-rekrytering.js: en
     studiehjälpare som inte vet hur rapporten fungerar lämnar inga
     rapporter, och utan rapport blir passet aldrig genomfört. */
  UTBILDNING_URL: '',

  /* Köpvillkoren i kassan (2026-10-21). Rutan före kassan kräver ett
     kryss och länkar hit. PLATSHÅLLARE: avsnittet #kopvillkor i
     anvandarvillkor.html (och en/anvandarvillkor.html) bär en platshållare
     tills Leo skrivit köpvillkoren. Byts adressen ändras bara den här. */
  KOPVILLKOR_URL: '/anvandarvillkor#kopvillkor',

  /* Bokningssidan för intervjun (2026-10-20; namnet INTERVJU_BOKNINGSLANK
     sedan 2026-10-21, förut INTERVJU_BOKNING_URL): ett bokningsschema i
     Google Kalender, med Google Meet som plats. Hur den skapas står
     överst i filen. Adressen ser ut som https://calendar.app.google/XXXXXXXX
     och står i det automatiska intervjumejlet (samma adress i
     intervju.ts), i Skicka intervjulänk igen och i Skriv till hen i
     Ansökningar, där den sökande väljer en tid själv. Google mejlar tiden
     och Meet-länken, och bokningen står i kalendern, inte i adminvyn.

     Bara i kalendern för info@nextrum.se: där gäller Workspace-avtalet
     med Google, och integritetspolicyn säger att bokningen ligger i vår
     kalender där. Ett privat Gmail har inget sådant avtal.

     Tom sträng = Skicka intervjulänk igen säger att länken saknas och
     skickar inget, och Skriv till hen föreslår tider som förut. */
  INTERVJU_BOKNINGSLANK: 'https://calendar.app.google/rRiTTLP5ymKQunSv7',

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
