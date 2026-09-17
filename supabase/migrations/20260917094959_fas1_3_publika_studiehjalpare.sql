-- ============================================================
-- NEXTRUM — Fas 1.3 (F-1)
-- STUDIEHJÄLPARNAS PROFILER STÄNGS FÖR ANONYMA
--
-- Förutsätter att generate-message (Fas 1.2) är driftsatt först.
-- Dess gamla rollkontroll läste "en" godkänd profil utan filter och
-- hade släppt igenom varje inloggad familj så fort policyn nedan
-- ger familjen läsrätt till sin studiehjälpares rad.
--
--
-- VAD SOM VAR FEL
--
-- Policyn "alla kan läsa godkända profiler" lydde
-- status = 'approved' för rollen public, alltså även anon. En
-- oinloggad besökare hämtade skola, ålder, ort, text och
-- timpenning på /rest/v1/tutor_profiles — oavsett visa_publikt,
-- som v23 införde just för att publicering ska vara ett aktivt val.
--
-- Två saker vilade på den öppna policyn:
--
--   1. Studievyn (foralder.html) läser den matchade
--      studiehjälparens rad direkt. Den får en egen policy nedan,
--      bara för inloggade, bara den egna matchningen.
--
--   2. Startsidans lista. Vyn studiehjalpare_publika har
--      security_invoker = true och joinar profiles, som anon aldrig
--      får läsa — så vyn var ALLTID tom för besökare, oavsett
--      visa_publikt. Den ersätts av funktionen nedan, som läser med
--      ägarens rättigheter men bara lämnar ut de kolumner vyn redan
--      lovade: förnamn, ålder, ort, ämnen, årskurser och text.
--      Aldrig skola, e-post, telefon eller timpenning.
--
-- Vyn tas inte bort här. Startsidan på main frågar fortfarande
-- efter den tills den nya koden är driftsatt, och den svarar tomt
-- precis som förut. Den tas bort i en egen migration efteråt.
-- ============================================================

create or replace function public.publika_studiehjalpare()
returns table (
  id uuid,
  fornamn text,
  age integer,
  city text,
  subjects text[],
  grade_levels text[],
  bio text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select tp.id,
         upper(left(split_part(btrim(p.full_name), ' ', 1), 1))
           || substr(split_part(btrim(p.full_name), ' ', 1), 2) as fornamn,
         tp.age,
         tp.city,
         tp.subjects,
         tp.grade_levels,
         tp.bio
  from public.tutor_profiles tp
  join public.profiles p on p.id = tp.id
  where tp.status = 'approved'
    and tp.visa_publikt
    and btrim(coalesce(p.full_name, '')) <> ''
$function$;

comment on function public.publika_studiehjalpare() is
  'Startsidans lista. Bara studiehjälpare med visa_publikt, och bara förnamn, ålder, ort, ämnen, årskurser och text. Lägg aldrig till skola, kontaktuppgifter eller timpenning.';

revoke execute on function public.publika_studiehjalpare() from public;
grant execute on function public.publika_studiehjalpare() to anon, authenticated;

drop policy if exists "alla kan läsa godkända profiler" on public.tutor_profiles;

drop policy if exists "familj läser matchad studiehjälpare" on public.tutor_profiles;
create policy "familj läser matchad studiehjälpare"
  on public.tutor_profiles
  for select
  to authenticated
  using (status = 'approved' and public.is_my_matched_tutor(id));
