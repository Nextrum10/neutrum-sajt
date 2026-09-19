-- Fas 5 — rättningar efter granskningen av 5.2 och 5.3.
--
-- 1. koppla_passets_uppdrag: den som inte är admin väljer inte uppdrag
--    till ett barn. Förut räckte det att uppdraget hörde till familjen,
--    så ett pass för barn 1 kunde läggas på syskonets uppdrag.
-- 2. koppla_passets_uppdrag: när admin byter familj på ett pass härleds
--    uppdraget på nytt, i stället för att ändringen nekades med ett
--    missvisande "uppdraget hör inte till familjen".
-- 3. koppla_passets_uppdrag och elevens_uppdrag: ett uppdrag som tas
--    bort (främmande nyckel sätter null) eller som admin kopplar bort
--    lämnar raden utan uppdrag. Förut skapades ett nytt i tysthet för
--    varje barn som pekat på det.
-- 4. rut_underlag räknar RUT på BETALNINGSÅRET — betald_at, annars
--    förfallodagen, och bara i sista hand fakturaperioden. Skatteverket
--    räknar avdraget och taket på året köparen betalar; en faktura för
--    december betalas i januari och hör till det nya årets tak.
--
-- Funktionerna och vyn är skrivna i 5.2 och 5.3 och lästa ur driften
-- (pg_get_functiondef, pg_get_viewdef) före ändringen.

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
    -- Kvar: familjen byttes (admin), eller en icke-admin försökte välja
    -- ett främmande uppdrag vid INSERT. Barnet får ett eget, nytt.
    new.uppdrag_id := null;
  end if;

  insert into public.uppdrag (kund_id, tjanst, status)
  values (new.parent_id, public.standard_tjanst(),
          case when new.match_status = 'paused' then 'pausat' else 'aktivt' end)
  returning id into new.uppdrag_id;

  return new;
end $function$;

create or replace function public.koppla_passets_uppdrag()
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

    if new.parent_id is not distinct from old.parent_id then
      -- Bara uppdraget ändrades. Null (borttaget eller bortkopplat) får
      -- stå; ett annat uppdrag måste höra till familjen. Övriga
      -- ändringar för icke-admin stoppas sedan av skydda_bokningsfalt.
      if new.uppdrag_id is null then
        return new;
      end if;
      if exists (select 1 from public.uppdrag u
                 where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
        return new;
      end if;
      raise exception using errcode = '42501',
        message = 'Uppdraget hör inte till familjen.';
    end if;

    -- Familjen byttes (bara admin kommer hit; skydda_bokningsfalt nekar
    -- alla andra). Hör uppdraget till den nya familjen står det kvar,
    -- annars härleds det som för ett nytt pass.
    if new.uppdrag_id is not null and exists (
         select 1 from public.uppdrag u
          where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
      return new;
    end if;
    new.uppdrag_id := null;
  else
    -- Den som inte är admin väljer inte uppdrag till ett barn: passet
    -- hamnar på barnets eget, oavsett vad klienten skickade.
    if not fri and new.student_id is not null then
      new.uppdrag_id := null;
    end if;

    if new.uppdrag_id is not null then
      if not exists (select 1 from public.uppdrag u
                     where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
        raise exception using errcode = '42501',
          message = 'Uppdraget hör inte till familjen.';
      end if;
      return new;
    end if;
  end if;

  -- Härled: barnets uppdrag, annars familjens enda öppna.
  if new.student_id is not null then
    select s.uppdrag_id into new.uppdrag_id
      from public.students s
     where s.id = new.student_id and s.parent_id = new.parent_id;
  end if;
  if new.uppdrag_id is null then
    select case when count(*) = 1 then (array_agg(u.id))[1] end
      into new.uppdrag_id
      from public.uppdrag u
     where u.kund_id = new.parent_id and u.status <> 'avslutat';
  end if;

  return new;
end $function$;

revoke execute on function public.elevens_uppdrag()        from public, anon, authenticated;
revoke execute on function public.koppla_passets_uppdrag() from public, anon, authenticated;

-- RUT på betalningsåret.
create or replace view public.rut_underlag with (security_invoker = true) as
with f as (
  select i.parent_id,
         i.rut_ore,
         coalesce(extract(year from (i.betald_at at time zone 'Europe/Stockholm')),
                  extract(year from i.forfaller),
                  extract(year from i.period))::int as ar
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
  'RUT per köpare och BETALNINGSÅR (betald_at, annars förfallodagen, annars perioden), med årets tak ur rut_tak.';
