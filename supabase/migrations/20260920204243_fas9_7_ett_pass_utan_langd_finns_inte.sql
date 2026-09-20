-- ============================================================
-- NEXTRUM — Fas 9.7: ett pass utan längd finns inte
--
-- På elva ställen i klienten och ett i faktureringen står samma rad:
--
--     duration_min || 60
--
-- Den säger: "vet vi inte hur långt passet var, säg en timme."
-- I _delad/pris.ts är det inte en visning, det är ett BELOPP — en
-- familj faktureras för en timme ingen skrivit ner, och
-- studiehjälparen får ersättning för den. I analysvyerna hade samma
-- pass i stället räknats som noll minuter, eftersom sum() hoppar
-- över null. Samma rad, två olika sanningar.
--
-- Prislogiken får inte ändras (planens avsnitt D), och den ändras
-- inte här. I stället görs raden OMÖJLIG att nå: ett pass utan
-- längd ska aldrig kunna skrivas.
--
-- Hålet var verkligt. skydda_bokningsfalt prövade
--
--     if new.duration_min < 60 or new.duration_min > 180
--
-- och null jämfört med något är null, inte sant — så villkoret var
-- falskt och passet gick igenom utan längd. Det är alltså inget som
-- bara admin kunde göra: vem som helst kunde boka ett pass utan
-- längd mot det öppna API:et, och faktureringen hade räknat en
-- timme på det.
--
-- Två lager, av samma skäl som resten av systemet har två:
--   · triggern ger ett läsbart 42501 till den som bokar
--   · NOT NULL är ryggen som gäller även för service_role och för
--     framtida vägar som ingen tänkt på
--
-- Alla 13 pass i driften har en längd, så kolumnen kan låsas utan
-- att något behöver bakfyllas. Enda insert-vägen i klienten
-- (nextrum-studie-vy.js) skickar alltid v.minuter.
--
-- Läst ur driften med pg_get_functiondef före ändringen. Allt utom
-- de tre orden "is null or" är ordagrant kvar.
-- ============================================================

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

    -- "is null" är Fas 9.7. Utan det var villkoret falskt för ett
    -- pass utan längd, och faktureringen räknade en timme på det.
    if new.duration_min is null or new.duration_min < 60 or new.duration_min > 180 then
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

-- Ryggen. Gäller också service_role, admin och varje väg som inte
-- finns ännu.
alter table public.bookings alter column duration_min set not null;
