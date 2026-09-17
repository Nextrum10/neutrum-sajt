-- ============================================================
-- NEXTRUM — Fas 1.5 (F-6)
-- EN BOKNING GÅR INTE ATT SKRIVA OM FRÅN WEBBLÄSAREN
--
-- VAD SOM VAR FEL
--
-- Policyerna på bookings kontrollerar bara VEM raden tillhör:
-- auth.uid() = tutor_id respektive parent_id. Den enda triggern var
-- skydda_rabatt, som bara låser rabattfälten. Via PostgREST kunde
-- därför
--
--   en studiehjälpare  sätta status = 'completed' utan rapport,
--                      höja duration_min, antal_barn eller byta
--                      tjanst och parent_id på sitt eget pass;
--   en förälder        sätta 'completed', byta tutor_id eller
--                      duration_min på sitt eget pass;
--   båda               skapa ett pass direkt som 'completed',
--                      bakåt i tiden, på tio timmar.
--
-- fakturering fakturerar familjen och räknar studiehjälparens
-- ersättning på exakt de fälten, för varje pass som är 'completed'.
-- Det här är alltså integriteten i hela pengaflödet, inte kosmetik.
--
-- Webbläsaren skyddade inte heller: larare.html och foralder.html
-- skriver den status som den klickade knappen bär.
--
--
-- REGLERNA (för alla utom admin och service_role)
--
-- Ny bokning
--   • status 'requested', ingen närvaro, datum idag eller framåt
--   • 1–3 timmar, samma val som gränssnitten erbjuder
--   • en aktiv tjänst som familjer kan boka
--   • barnet tillhör familjen
--   • föreslår studiehjälparen: barnet är hens egen elev, och
--     flerbarnstillägget sätts inte av hen
--
-- Befintlig bokning
--   • genomförd eller avbokad: ingenting får ändras
--   • bara status, datum, tid, created_by och närvaro kan ändras —
--     allt annat är låst, även kolumner som läggs till senare
--   • flytt: ny tid idag eller framåt, status tillbaka till
--     'requested' och created_by = den som flyttar, så att
--     motparten måste bekräfta igen (precis vad båda vyerna gör)
--   • bekräfta: bara motparten, bara från 'requested'
--   • avboka: båda, från 'requested' eller 'confirmed'
--   • genomförd: bara passets studiehjälpare, bara om passet har
--     varit, bara om det finns en rapport från hen med just det här
--     passets booking_id, och bara om familjen stått bakom tiden —
--     antingen bekräftad, eller bokad av familjen själv. Ett pass
--     studiehjälparen föreslagit och familjen aldrig svarat på kan
--     alltså inte bli en fakturarad.
--   • närvaro sätts bara i samma steg som passet blir genomfört
--
-- Brott mot en regel avvisas med ett fel, inte genom att värdet
-- tyst återställs. Gränssnittet ska få veta att något inte gick.
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

-- Namnet sorterar före bookings_skydda_rabatt, så den här körs först
-- och ser det klienten faktiskt skickade.
drop trigger if exists bookings_skydda_bokningsfalt on public.bookings;
create trigger bookings_skydda_bokningsfalt
  before insert or update on public.bookings
  for each row execute function public.skydda_bokningsfalt();
