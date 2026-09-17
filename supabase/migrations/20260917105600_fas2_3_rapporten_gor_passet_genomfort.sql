-- ============================================================
-- NEXTRUM — Fas 2.3
-- RAPPORTEN OCH "GENOMFÖRT" SKRIVS I SAMMA TRANSAKTION
--
-- VAD SOM VAR FEL
--
-- Rapportformuläret i studiehjälparvyn gjorde två anrop: först
-- rapporten, sedan en uppdatering av passet till 'completed' med
-- närvaron. Gick det andra fel stod rapporten kvar och passet låg
-- orört — och ett pass som inte är 'completed' faktureras aldrig.
--
--
-- DET HÄR GÖR MIGRATIONEN
--
-- Rapporten får en egen kolumn för närvaron, och en trigger efter
-- varje ny rapport markerar passet genomfört med just den närvaron.
-- Allt i samma transaktion: vägrar databasen passet — fel
-- studiehjälpare, obekräftat förslag, avbokat pass — sparas inte
-- heller rapporten, och studiehjälparen får veta varför.
--
-- Triggern kör med anroparens rättigheter. RLS gäller alltså som
-- vanligt, och skydda_bokningsfalt prövar övergången exakt som när
-- webbläsaren gjorde den själv.
--
--
-- VARFÖR BARA NÄR RAPPORTEN BÄR NÄRVARON
--
-- Studiehjälparvyn som ligger ute när det här körs skickar närvaron
-- i ett eget anrop efter rapporten. Hade triggern redan markerat
-- passet genomfört hade det anropet nekats (ett genomfört pass går
-- inte att ändra), och närvaron hade gått förlorad. Därför gör
-- triggern bara något när rapporten själv bär närvaron — vilket den
-- nya vyn gör och den gamla inte gör. Båda fungerar alltså under
-- övergången.
--
-- När den gamla vyn inte längre kan vara igång (Fas 3) görs
-- narvaro obligatorisk för rapporter med booking_id, och då finns
-- det ingen väg kvar till en rapport utan genomfört pass.
-- ============================================================

alter table public.lesson_reports
  add column if not exists narvaro text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lesson_reports_narvaro_check'
      and conrelid = 'public.lesson_reports'::regclass
  ) then
    alter table public.lesson_reports
      add constraint lesson_reports_narvaro_check
      check (narvaro is null or narvaro = any (array['narvarande', 'sen', 'franvarande']));
  end if;
end $$;

comment on column public.lesson_reports.narvaro is
  'Närvaron vid passet, som rapporten skrev. Kopieras till bookings.attendance av triggern lesson_reports_gor_passet_genomfort.';

create or replace function public.rapport_gor_passet_genomfort()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if new.booking_id is null or new.narvaro is null then
    return null;
  end if;

  update public.bookings
  set status = 'completed',
      attendance = new.narvaro
  where id = new.booking_id
    and status <> 'completed';

  if not found and not exists (
    select 1 from public.bookings
    where id = new.booking_id and status = 'completed'
  ) then
    raise exception using errcode = '42501',
      message = 'Passet går inte att markera som genomfört, så rapporten sparades inte.';
  end if;

  return null;
end $function$;

revoke execute on function public.rapport_gor_passet_genomfort() from public, anon, authenticated;

drop trigger if exists lesson_reports_gor_passet_genomfort on public.lesson_reports;
create trigger lesson_reports_gor_passet_genomfort
  after insert on public.lesson_reports
  for each row execute function public.rapport_gor_passet_genomfort();
