-- ============================================================
-- NEXTRUM — schema v23
-- ATT SYNAS PÅ STARTSIDAN BLIR ETT AKTIVT VAL
--
-- Körs efter schema-v22.sql. Idempotent.
--
--
-- VAD SOM VAR FEL
--
-- Vyn studiehjalpare_publika lämnade ut VARJE godkänd
-- studiehjälpare med ett ifyllt namn. Att bli godkänd för att få
-- hålla pass innebar alltså automatiskt att förnamn, ålder, ort och
-- en personlig text publicerades på nextrum.se — utan att någon
-- valt det, och utan att någon kunde ta bort sig.
--
-- Studiehjälparna är gymnasie- och högskolestudenter, ofta under
-- arton. Kommentaren i index.html resonerar redan om precis det när
-- den förklarar varför skolan inte får skrivas ut. Samma resonemang
-- gäller själva publiceringen.
--
--
-- VARFÖR FÖRVALET ÄR NEJ
--
-- Att godkänna någon för arbete och att publicera dem som ansikte
-- utåt är två olika beslut. Med default true hade de vävts ihop
-- igen vid nästa godkännande, och den som glömmer kryssa ur får en
-- publicering ingen bett om. Med default false måste någon aktivt
-- säga ja, vilket är rätt ordning när frågan gäller en ung persons
-- namn och bild på en marknadssida.
--
-- Följden är att listan på startsidan är tom tills någon slås på.
-- Exempelkorten i markupen står kvar och visar vad ett kort är.
-- ============================================================

alter table public.tutor_profiles
  add column if not exists visa_publikt boolean not null default false;

comment on column public.tutor_profiles.visa_publikt is
  'Om studiehjälparen ska visas i listan på startsidan. Default false: att bli godkänd för arbete är inte samma sak som att samtycka till att publiceras. Sätts av admin, efter att ha frågat.';

-- Vyn filtrerar på flaggan. Allt annat är oförändrat: fortfarande
-- bara förnamn, ålder, ort, ämnen och text — aldrig e-post, telefon
-- eller skola.
create or replace view public.studiehjalpare_publika
with (security_invoker = true) as
select tp.id,
       upper("left"(split_part(btrim(p.full_name), ' '::text, 1), 1))
         || substr(split_part(btrim(p.full_name), ' '::text, 1), 2) as fornamn,
       tp.age,
       tp.city,
       tp.subjects,
       tp.grade_levels,
       tp.bio
from public.tutor_profiles tp
join public.profiles p on p.id = tp.id
where tp.status = 'approved'
  and tp.visa_publikt
  and btrim(coalesce(p.full_name, '')) <> '';

grant select on public.studiehjalpare_publika to anon, authenticated;

-- Flaggan är ett beslut vi fattar, inte något den enskilde sätter
-- själv. Samma lista som status, hourly_rate och tjanster.
create or replace function public.skydda_tutorfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.status            := old.status;
  new.id                := old.id;
  new.hourly_rate       := old.hourly_rate;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_klar       := old.stripe_klar;
  new.tjanster          := old.tjanster;
  new.visa_publikt      := old.visa_publikt;
  return new;
end $function$;


-- ============================================================
-- EFTERÅT
--
--   select count(*) from public.studiehjalpare_publika;
--   -- 0 tills någon slås på i adminvyn under Studiehjälpare
--
-- Startsidan visar då bara exempelkorten, som ligger i markupen och
-- föreställer ingen verklig person.
-- ============================================================
