-- ============================================================
-- NEXTRUM — Fas 15.2: ett avbokat pass säger varför, och
-- skälet står i mejlet
--
-- Leo 2026-09-24: "När man avbokar en lektion behöver man lägga till
-- skäl för avbokningen, och då ska det skickas ett mejl till den som
-- inte avbokade om att lektionen avbokats och rekommendera en ny tid."
--
-- Fas 9.4 valde med flit att bara admin sätter skälet, i efterhand:
-- att släppa in avbokningsskal i skydda_bokningsfalt vitlista hade
-- vidgat F-6. Nu vidgas den, men smalt:
--
--   · skälet får bara sättas i SAMMA skrivning som status blir
--     'cancelled' — aldrig på ett pass som fortfarande gäller, och
--     aldrig ändras efteråt av någon annan än admin
--   · familjen och studiehjälparen får välja fyra av de sex koderna:
--     sjukdom, forhinder, ombokat, annat. ingen_hjalpare och
--     familjen_avslutar är Nextrums egna bedömningar
--   · skälet KRÄVS när ett pass avbokas, men inte när en föreslagen
--     tid avböjs (samma gräns som pass_avbojt/pass_avbokat)
--
-- Fortfarande en FAST KOD, aldrig fritext. Skälet står i auditloggen,
-- som inte går att rätta, och nu också i ett mejl. En ruta att skriva
-- i hade blivit en väg att skriva ett barns hälsa i en inkorg.
--
-- MEJLET. Notisen till den som INTE avbokade finns redan (regel 1 i
-- CLAUDE.md avsnitt 5: ingen får en notis om sin egen åtgärd). Det
-- som saknades var skälet: notis_vid_pass lägger nu koden i notisens
-- data, renData() släpper igenom den bara om den är en av de sex, och
-- mallen i _delad/notiser/mallar.ts skriver ut den med våra ord och
-- en knapp till där en ny tid väljs. Mallen och renData driftsätts
-- med notis-ko; en äldre notis-ko ignorerar nyckeln, eftersom den
-- aldrig läser den.
--
-- VARFÖR INGEN "REKOMMENDERAD TID": studiehjälparen har inget schema
-- längre (Fas 15.1). Det finns inget att räkna fram en ledig tid ur,
-- och en påhittad tid i ett mejl är ett löfte ingen gett. Mejlet
-- leder i stället familjen till Boka pass och studiehjälparen till
-- chatten.
--
-- Båda funktionerna skrivs om i sin helhet ur driftens nuvarande
-- definition (kontrollerad mot pg_get_functiondef 2026-09-24).
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
  fria  text[] := array['status', 'wanted_date', 'wanted_time', 'created_by', 'attendance',
                          'avbokningsskal'];
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

  -- FAS 15.2. Skälet står i vitlistan, men bara i samma skrivning som
  -- avbokningen — ett skäl på ett pass som fortfarande gäller är
  -- ingenting, och ett skäl som byts efteråt hade gjort mejlet som
  -- redan gått till motparten osant. Rättelser i efterhand gör admin.
  if new.avbokningsskal is distinct from old.avbokningsskal then
    if new.status is distinct from 'cancelled' then
      raise exception using errcode = '42501',
        message = 'Skälet anges när passet avbokas.';
    end if;
    if new.avbokningsskal is null
       or new.avbokningsskal not in ('sjukdom', 'forhinder', 'ombokat', 'annat') then
      raise exception using errcode = '42501',
        message = 'Det skälet sätter bara Nextrum.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      /* FAS 13.1. Här stod tidigare bara "null" — avbokning var det
         enda statusbytet som inte prövades alls.

         Betalda pengar ligger på Nextrums konto och tillhör familjen
         tills någon bestämt något annat. Att låta avbokningen gå
         igenom hade lämnat dem där utan att någon fick veta det.

         Vi utlöser INTE en återbetalning automatiskt: hur mycket som
         ska tillbaka beror på när avbokningen sker, och den policyn
         är inte skriven än. Ett nej som säger varför är ärligare än
         en återbetalning ingen beslutat om. */
      if old.betalning_status in ('betald', 'tvist') then
        raise exception using errcode = '42501',
          message = 'Passet är betalt och går inte att avboka härifrån. Kontakta Nextrum, så tar vi hand om återbetalningen.';
      end if;

      /* FAS 15.2. Ett avbokat pass säger varför. Att AVBÖJA en tid
         motparten föreslagit gör det inte — det passet fanns aldrig.
         Skillnaden är densamma som notis_vid_pass gör mellan
         pass_avbojt och pass_avbokat, så ett mejl om ett avbokat pass
         från en familj eller en studiehjälpare har alltid ett skäl. */
      if not (old.status = 'requested' and old.created_by is distinct from jag)
         and new.avbokningsskal is null then
        raise exception using errcode = '42501',
          message = 'Välj ett skäl till avbokningen.';
      end if;

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

create or replace function public.notis_vid_pass()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  aktor uuid := auth.uid();
  typ   text;
  bas   jsonb;
  elev  text;
  hjalp text;
  m     uuid;
begin
  if tg_op = 'INSERT' then
    typ := 'pass_nytt';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    typ := case when old.status = 'requested' and aktor is not null and aktor is distinct from old.created_by
                then 'pass_avbojt' else 'pass_avbokat' end;
  elsif new.status in ('requested', 'confirmed')
        and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    typ := 'pass_flyttat';
  elsif old.status = 'requested' and new.status = 'confirmed' then
    typ := 'pass_bekraftat';
  else
    return null;
  end if;

  select intern.fornamn(s.name) into elev from public.students s where s.id = new.student_id;
  select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = new.tutor_id;

  bas := jsonb_strip_nulls(jsonb_build_object(
    'datum', new.wanted_date, 'tid', new.wanted_time, 'langd_min', new.duration_min,
    'amne', intern.fornamn(new.subject), 'studiehjalpare', hjalp, 'status', new.status,
    'fran_datum', case when typ = 'pass_flyttat' then old.wanted_date end,
    'fran_tid', case when typ = 'pass_flyttat' then old.wanted_time end,
    -- En kod ur bookings_avbokningsskal_check, aldrig text. renData()
    -- släpper bara igenom de sex koderna, och mallen skriver orden.
    'skal', case when typ = 'pass_avbokat' then new.avbokningsskal end));

  foreach m in array array[new.parent_id, new.tutor_id] loop
    continue when m is null or m = aktor;
    perform intern.notis_skapa(m, typ, new.id, new.student_id, new.parent_id, new.tutor_id,
      case when elev is not null and intern.far_se_eleven(m, new.student_id)
           then bas || jsonb_build_object('elev', elev) else bas end);
  end loop;
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_pass ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke execute on function public.notis_vid_pass() from public, anon, authenticated;

comment on column public.bookings.avbokningsskal is
  'Fast kod. Sätts av den som avbokar, i samma skrivning som avbokningen (Fas 15.2), '
  'eller av admin i efterhand. Aldrig fritext: skälet hamnar i auditloggen och i mejlet till motparten.';
