-- ============================================================
-- NEXTRUM — Fas 2.1 och 2.2 (databasdelen)
-- ETT PASS SOM KAN FAKTURERAS, OCH ETT SOM INTE KAN
--
--
-- VAD SOM VAR FEL
--
-- fakturering tog varje pass med status 'completed' och gjorde en
-- fakturarad och en ersättningsrad av det. Men 'completed' är inte
-- samma sak som "har rapport": i driften fanns fem genomförda pass
-- och bara två av dem hade en rapport kopplad. Rapporten är det som
-- visar att passet hölls — det är den som motiverar raden på
-- familjens faktura och på studiehjälparens underlag.
--
-- Och det fanns inget sätt för admin att säga "det här passet ska
-- inte med", utan att ändra passets status och därmed historiken.
--
--
-- DET HÄR GÖR MIGRATIONEN
--
-- 1. bookings.fakturerbar och fakturerbar_anledning.
--    Default true, så inget befintligt ändras. Ett pass som admin
--    undantar kommer varken på familjens faktura eller på
--    studiehjälparens underlag — samma regel på båda sidor, som
--    underlagsmejlet lovar. Anledningen sparas, för ett undantag
--    utan förklaring går inte att följa upp.
--
--    Bara admin kan ändra kolumnerna: skydda_bokningsfalt låser
--    redan allt utom status och tid. Men en NY bokning kunde födas
--    med fakturerbar = false — en familj som bokar ett pass den
--    aldrig faktureras för. Därför får triggern en regel till.
--
-- 2. Vyn passunderlag. En rad per genomfört pass, med tre svar:
--    har det en rapport, är det redan fakturerat, är det redan med
--    på ett underlag. fakturering läser urvalet härifrån i stället
--    för att bygga mängder i minnet (som dessutom tyst kapades vid
--    tusen rader). Adminvyn läser samma vy för avvikelserna.
--
-- 3. ofakturerat och ej_utbetalt — det familjen och studiehjälparen
--    ser som "pågående" — följer samma regel. Annars visar vyerna
--    ett belopp som körningen sedan inte fakturerar.
-- ============================================================

alter table public.bookings
  add column if not exists fakturerbar boolean not null default true;
alter table public.bookings
  add column if not exists fakturerbar_anledning text;

comment on column public.bookings.fakturerbar is
  'false = passet är undantaget: det kommer varken på familjens faktura eller på studiehjälparens underlag. Sätts bara av admin, med en anledning.';
comment on column public.bookings.fakturerbar_anledning is
  'Varför passet undantogs från fakturering. Skrivs av admin samtidigt som fakturerbar sätts till false.';


-- ------------------------------------------------------------
-- skydda_bokningsfalt: oförändrad från Fas 1.5, plus regeln om
-- fakturerbar vid ny bokning. Läst ur driften före ändringen.
-- ------------------------------------------------------------
create or replace function public.skydda_bokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  jag   uuid := auth.uid();
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  fria  text[] := array['status', 'wanted_date', 'wanted_time', 'created_by', 'attendance'];
  flytt boolean;
begin
  if public.is_admin() or jag is null then
    return new;
  end if;

  -- ---------- ny bokning ----------
  if tg_op = 'INSERT' then
    if new.status is distinct from 'requested' then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass måste börja som förfrågan.';
    end if;

    if new.attendance is not null then
      raise exception using errcode = '42501',
        message = 'Närvaro sätts när passet rapporteras, inte när det bokas.';
    end if;

    if new.fakturerbar is distinct from true or new.fakturerbar_anledning is not null then
      raise exception using errcode = '42501',
        message = 'Bara Nextrum kan undanta ett pass från fakturering.';
    end if;

    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara bokas idag eller framåt.';
    end if;

    if new.duration_min < 60 or new.duration_min > 180 then
      raise exception using errcode = '42501',
        message = 'Ett pass är en, två eller tre timmar.';
    end if;

    if not exists (
      select 1 from public.tjanster t
      where t.kod = new.tjanst and t.aktiv and t.for_kund
    ) then
      raise exception using errcode = '42501',
        message = 'Tjänsten går inte att boka.';
    end if;

    if new.student_id is not null and not exists (
      select 1 from public.students s
      where s.id = new.student_id and s.parent_id = new.parent_id
    ) then
      raise exception using errcode = '42501',
        message = 'Barnet hör inte till familjen.';
    end if;

    if jag = new.tutor_id then
      if new.student_id is not null and not public.ar_min_elev(new.student_id) then
        raise exception using errcode = '42501',
          message = 'Du kan bara föreslå pass för dina egna elever.';
      end if;
      if new.antal_barn <> 1 then
        raise exception using errcode = '42501',
          message = 'Antalet barn väljer familjen när den bokar.';
      end if;
    end if;

    return new;
  end if;

  -- ---------- befintlig bokning ----------
  if old.status in ('completed', 'cancelled') then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode = '42501',
        message = 'Ett genomfört eller avbokat pass går inte att ändra.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - fria) is distinct from (to_jsonb(old) - fria) then
    raise exception using errcode = '42501',
      message = 'På ett bokat pass kan bara status och tid ändras.';
  end if;

  flytt := new.wanted_date is distinct from old.wanted_date
        or new.wanted_time is distinct from old.wanted_time;

  if flytt then
    if new.status <> 'requested' or new.created_by is distinct from jag then
      raise exception using errcode = '42501',
        message = 'En flyttad tid måste bekräftas av motparten.';
    end if;
    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara flyttas till idag eller framåt.';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501',
      message = 'Vem som föreslog passet ändras bara när tiden flyttas.';
  end if;

  if new.attendance is distinct from old.attendance and new.status <> 'completed' then
    raise exception using errcode = '42501',
      message = 'Närvaro sätts när passet rapporteras.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      null;

    elsif new.status = 'confirmed' then
      if old.status <> 'requested' or old.created_by is not distinct from jag then
        raise exception using errcode = '42501',
          message = 'Ett pass bekräftas av motparten, inte av den som föreslog det.';
      end if;

    elsif new.status = 'requested' then
      if not flytt then
        raise exception using errcode = '42501',
          message = 'Ett bekräftat pass blir förfrågan igen bara när tiden flyttas.';
      end if;

    elsif new.status = 'completed' then
      if jag is distinct from old.tutor_id then
        raise exception using errcode = '42501',
          message = 'Bara passets studiehjälpare kan markera det som genomfört.';
      end if;
      if flytt or old.wanted_date is null or old.wanted_date > idag then
        raise exception using errcode = '42501',
          message = 'Ett pass kan markeras som genomfört först när det har varit.';
      end if;
      if not (old.status = 'confirmed'
              or (old.status = 'requested' and old.created_by = old.parent_id)) then
        raise exception using errcode = '42501',
          message = 'Familjen har inte bekräftat passet, så det kan inte markeras som genomfört.';
      end if;
      if not exists (
        select 1 from public.lesson_reports r
        where r.booking_id = old.id
          and r.tutor_id = jag
          and (old.student_id is null or r.student_id = old.student_id)
      ) then
        raise exception using errcode = '42501',
          message = 'Passet saknar rapport och kan inte markeras som genomfört.';
      end if;
    end if;
  end if;

  return new;
end $function$;

revoke execute on function public.skydda_bokningsfalt() from public, anon, authenticated;


-- ------------------------------------------------------------
-- passunderlag
-- ------------------------------------------------------------
create or replace view public.passunderlag
with (security_invoker = true) as
select b.id,
       b.parent_id,
       b.tutor_id,
       b.student_id,
       b.subject,
       b.tjanst,
       b.wanted_date,
       b.wanted_time,
       b.duration_min,
       b.antal_barn,
       b.rabatt_ore,
       b.fakturerbar,
       b.fakturerbar_anledning,
       exists (select 1 from public.lesson_reports r where r.booking_id = b.id) as har_rapport,
       exists (select 1 from public.invoice_lines l where l.booking_id = b.id) as fakturerad,
       exists (select 1 from public.payout_lines l where l.booking_id = b.id) as pa_underlag
from public.bookings b
where b.status = 'completed';

comment on view public.passunderlag is
  'Varje genomfört pass och om det kan behandlas: har_rapport, fakturerbar, fakturerad, pa_underlag. fakturering tar pass där har_rapport och fakturerbar är sanna. Läser med anroparens rättigheter.';

revoke all on public.passunderlag from anon;


-- ------------------------------------------------------------
-- ofakturerat och ej_utbetalt — samma kolumner som förut, samma
-- regel som körningen
-- ------------------------------------------------------------
create or replace view public.ofakturerat
with (security_invoker = true) as
select b.parent_id,
       count(*) as pass,
       coalesce(sum(b.duration_min), (0)::bigint) as minuter
from public.bookings b
left join public.invoice_lines l on l.booking_id = b.id
where b.status = 'completed'
  and l.id is null
  and b.parent_id is not null
  and b.fakturerbar
  and exists (select 1 from public.lesson_reports r where r.booking_id = b.id)
group by b.parent_id;

create or replace view public.ej_utbetalt
with (security_invoker = true) as
select b.tutor_id,
       count(*) as pass,
       coalesce(sum(b.duration_min), (0)::bigint) as minuter
from public.bookings b
left join public.payout_lines l on l.booking_id = b.id
where b.status = 'completed'
  and l.id is null
  and b.tutor_id is not null
  and b.fakturerbar
  and exists (select 1 from public.lesson_reports r where r.booking_id = b.id)
group by b.tutor_id;
