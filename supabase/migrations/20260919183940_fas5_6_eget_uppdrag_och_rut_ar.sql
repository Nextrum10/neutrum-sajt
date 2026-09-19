-- Fas 5 — två luckor från kravgranskningen.
--
-- 1. elevens_uppdrag: en familj kunde lägga till ett barn på syskonets
--    uppdrag genom att skicka dess uppdrag_id. Ett uppdrag per barn är
--    regeln, och för pass stängdes samma lucka i 5.4. Nu gäller det för
--    barn också: den som inte är admin väljer inte uppdrag — ett nytt
--    barn får alltid ett eget.
--
-- 2. invoices.rut_ar: året RUT-avdraget räknades mot, sparat när
--    fakturan skapas. Faktureringen prövar taket för förfallodagens år;
--    rut_underlag flyttade sedan fakturan till betalningsåret när den
--    betalades, så ett avdrag kunde räknas mot ett år och bokföras mot
--    ett annat. Nu räknar vyn med samma år som avdraget gjordes mot.
--    Låses som beloppen av las_fakturabelopp.
--
-- Funktionerna och vyn lästa ur driften före ändringen.

create or replace function public.elevens_uppdrag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  fri boolean := public.is_admin() or auth.uid() is null;
begin
  if tg_op = 'UPDATE' then
    if new.uppdrag_id is not distinct from old.uppdrag_id
       and new.parent_id  is not distinct from old.parent_id then
      return new;
    end if;
    -- Borttaget uppdrag eller bortkopplat av admin: barnet står utan.
    if new.uppdrag_id is null and new.parent_id is not distinct from old.parent_id then
      return new;
    end if;
  end if;

  -- Den som inte är admin väljer inte uppdrag till ett nytt barn: det
  -- får alltid ett eget, även om ett syskons uppdrag skickades med.
  if tg_op = 'INSERT' and not fri then
    new.uppdrag_id := null;
  end if;

  if new.uppdrag_id is not null then
    if exists (select 1 from public.uppdrag u
               where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
      return new;
    end if;
    -- Admin som uttryckligen pekar på ett uppdrag som hör till någon
    -- annan är ett misstag, inte något att rätta i tysthet.
    if fri and (tg_op = 'INSERT' or new.uppdrag_id is distinct from old.uppdrag_id) then
      raise exception using errcode = '23514',
        message = 'Uppdraget hör inte till barnets familj.';
    end if;
    -- Kvar: familjen byttes (admin). Barnet får ett eget, nytt.
    new.uppdrag_id := null;
  end if;

  insert into public.uppdrag (kund_id, tjanst, status)
  values (new.parent_id, public.standard_tjanst(),
          case when new.match_status = 'paused' then 'pausat' else 'aktivt' end)
  returning id into new.uppdrag_id;

  return new;
end $function$;

revoke execute on function public.elevens_uppdrag() from public, anon, authenticated;

-- ---------- året avdraget räknades mot ----------
alter table public.invoices add column rut_ar smallint;
alter table public.invoices add constraint invoices_rut_ar_check
  check (rut_ar is null or rut_ar between 2020 and 2100);
comment on column public.invoices.rut_ar is
  'Året RUT-avdraget prövades mot taket för (förfallodagens år när fakturan skapades). Satt när rut_ore > 0.';

create or replace function public.las_fakturabelopp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.belopp_ore := old.belopp_ore;
  new.rut_ore    := old.rut_ore;
  new.rut_ar     := old.rut_ar;
  new.period     := old.period;
  new.parent_id  := old.parent_id;
  return new;
end;
$function$;

revoke execute on function public.las_fakturabelopp() from public, anon, authenticated;

create or replace view public.rut_underlag with (security_invoker = true) as
with f as (
  select i.parent_id,
         i.rut_ore,
         coalesce(i.rut_ar::int,
                  extract(year from (i.betald_at at time zone 'Europe/Stockholm'))::int,
                  extract(year from i.forfaller)::int,
                  extract(year from i.period)::int) as ar
    from public.invoices i
   where i.status <> 'makulerad'
     and i.rut_ore > 0
)
select f.parent_id                        as kund_id,
       f.ar,
       sum(f.rut_ore)::bigint             as rut_ore,
       count(*)::int                      as fakturor,
       t.tak_ore,
       t.tak_ore - sum(f.rut_ore)::bigint as kvar_ore
  from f
  left join public.rut_tak t on t.ar = f.ar
 group by f.parent_id, f.ar, t.tak_ore;
revoke all on public.rut_underlag from anon;

comment on view public.rut_underlag is
  'RUT per köpare och år: året avdraget räknades mot (rut_ar), annars betalningsåret, förfallodagen eller perioden. Med årets tak ur rut_tak.';
