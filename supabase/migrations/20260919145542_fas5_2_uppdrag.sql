-- Fas 5.2 — uppdrag: vad kunden har köpt, skilt från vem det gäller.
--
-- Hittills var allt en elev. En elev är ett barn; ett uppdrag är att
-- Nextrum utför en tjänst åt en kund. För läxhjälp är det ett uppdrag
-- per barn, och så bakfylls det här. För en framtida tjänst (barnvakt,
-- hushållsnära) finns inget barn att hänga upp det på — då är uppdraget
-- det som finns.
--
-- Läxhjälpen ändras inte:
--   * students.uppdrag_id och bookings.uppdrag_id är nullable, och
--     sätts av triggrar — ingen klient behöver skicka dem.
--   * Inga befintliga policyer ändras.
--   * skydda_studentfalt får EN rad till: uppdrag_id låses för den som
--     inte är admin, precis som parent_id redan är låst. Annars kunde en
--     familj peka sitt barn på någon annans uppdrag. (Läst med
--     pg_get_functiondef före ändringen.)
--   * bookings.uppdrag_id är redan låst för icke-admin efter att raden
--     skapats: skydda_bokningsfalt släpper bara status, tid, created_by
--     och närvaro.

-- ---------- tabellen ----------
create table public.uppdrag (
  id          uuid primary key default gen_random_uuid(),
  kund_id     uuid not null references public.profiles(id) on delete cascade,
  tjanst      text not null references public.tjanster(kod),
  typ         text not null default 'lopande' check (typ in ('lopande', 'engang')),
  status      text not null default 'aktivt'  check (status in ('aktivt', 'pausat', 'avslutat')),
  beskrivning text check (beskrivning is null or char_length(beskrivning) <= 500),
  created_at  timestamptz not null default now()
);
create index uppdrag_kund_idx on public.uppdrag (kund_id);

comment on table public.uppdrag is
  'En tjänst som Nextrum utför åt en kund. Läxhjälp: ett uppdrag per barn (students.uppdrag_id).';

alter table public.uppdrag enable row level security;
-- anon har inget här att göra; inloggade styrs av policyerna nedan.
revoke all on public.uppdrag from anon;

-- Samma form som policyerna på students: admin allt, kunden sina egna,
-- den matchade studiehjälparen läser. Ingen skriver utom admin — raderna
-- skapas av triggern när ett barn läggs till.
create policy "admin fullständig åtkomst uppdrag" on public.uppdrag
  for all using (public.is_admin()) with check (public.is_admin());
create policy "kunden ser egna uppdrag" on public.uppdrag
  for select using (auth.uid() = kund_id);
create policy "matchad studiehjälpare ser uppdraget" on public.uppdrag
  for select using (public.is_matched_tutor_of(kund_id));

-- ---------- kopplingarna ----------
alter table public.students add column uppdrag_id uuid references public.uppdrag(id) on delete set null;
alter table public.bookings add column uppdrag_id uuid references public.uppdrag(id) on delete set null;
create index students_uppdrag_idx on public.students (uppdrag_id) where uppdrag_id is not null;
create index bookings_uppdrag_idx on public.bookings (uppdrag_id) where uppdrag_id is not null;

-- ---------- standardtjänsten ----------
-- Den tjänst ett nytt uppdrag får när inget annat är sagt: den första
-- aktiva som kunder kan köpa. I dag läxhjälp. Faller tillbaka på den
-- första i katalogen, så att ett barn aldrig kan bli omöjligt att lägga
-- till bara för att alla tjänster råkar vara pausade.
create or replace function public.standard_tjanst()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select kod from public.tjanster where aktiv and for_kund order by ordning, kod limit 1),
    (select kod from public.tjanster order by ordning, kod limit 1))
$function$;

-- ---------- elevens uppdrag ----------
-- Körs efter students_skydda / students_skydda_ny (namnordning), så att
-- skydden redan låst det de låser.
create or replace function public.elevens_uppdrag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  fri boolean := public.is_admin() or auth.uid() is null;
begin
  if tg_op = 'UPDATE'
     and new.uppdrag_id is not distinct from old.uppdrag_id
     and new.parent_id  is not distinct from old.parent_id then
    return new;
  end if;

  if new.uppdrag_id is not null then
    if exists (select 1 from public.uppdrag u
               where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
      return new;
    end if;
    -- Admin som uttryckligen pekar på ett uppdrag som hör till någon
    -- annan är ett misstag, inte något att rätta i tysthet.
    if fri and tg_op = 'INSERT' then
      raise exception using errcode = '23514',
        message = 'Uppdraget hör inte till barnets familj.';
    end if;
    if fri and tg_op = 'UPDATE' and new.uppdrag_id is distinct from old.uppdrag_id then
      raise exception using errcode = '23514',
        message = 'Uppdraget hör inte till barnets familj.';
    end if;
    -- Kvar: familjen byttes (admin) och det gamla uppdraget hör inte
    -- längre ihop — eller en icke-admin försökte välja uppdrag vid
    -- INSERT. Då får barnet ett eget, nytt uppdrag.
    new.uppdrag_id := null;
  end if;

  insert into public.uppdrag (kund_id, tjanst, status)
  values (new.parent_id, public.standard_tjanst(),
          case when new.match_status = 'paused' then 'pausat' else 'aktivt' end)
  returning id into new.uppdrag_id;

  return new;
end $function$;

create trigger students_uppdrag
  before insert or update of uppdrag_id, parent_id on public.students
  for each row execute function public.elevens_uppdrag();

-- Ett barn som tas bort lämnar inget tomt uppdrag efter sig — om inget
-- pass och inget annat barn hänger på det.
create or replace function public.stada_elevens_uppdrag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.uppdrag_id is not null
     and not exists (select 1 from public.students s where s.uppdrag_id = old.uppdrag_id)
     and not exists (select 1 from public.bookings b where b.uppdrag_id = old.uppdrag_id) then
    delete from public.uppdrag where id = old.uppdrag_id;
  end if;
  return null;
end $function$;

create trigger students_stada_uppdrag
  after delete on public.students
  for each row execute function public.stada_elevens_uppdrag();

-- ---------- skydda_studentfalt: uppdraget låses som familjen ----------
create or replace function public.skydda_studentfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.matched_tutor_id := old.matched_tutor_id;
  new.match_status     := old.match_status;
  new.parent_id        := old.parent_id;
  new.id               := old.id;
  new.uppdrag_id       := old.uppdrag_id;
  return new;
end $function$;

-- ---------- passets uppdrag ----------
-- Ett nytt pass hamnar på barnets uppdrag. Utan barn: på familjens enda
-- öppna uppdrag, om det bara finns ett. Ett uppdrag som klienten skickar
-- med måste höra till familjen — annars nekas passet.
create or replace function public.koppla_passets_uppdrag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE'
     and new.uppdrag_id is not distinct from old.uppdrag_id
     and new.parent_id  is not distinct from old.parent_id then
    return new;
  end if;

  if new.uppdrag_id is not null then
    if not exists (select 1 from public.uppdrag u
                   where u.id = new.uppdrag_id and u.kund_id = new.parent_id) then
      raise exception using errcode = '42501',
        message = 'Uppdraget hör inte till familjen.';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
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
  end if;

  return new;
end $function$;

create trigger bookings_koppla_uppdrag
  before insert or update of uppdrag_id, parent_id on public.bookings
  for each row execute function public.koppla_passets_uppdrag();

-- Ingen av funktionerna ska gå att anropa direkt.
revoke execute on function public.standard_tjanst()         from public, anon, authenticated;
revoke execute on function public.elevens_uppdrag()         from public, anon, authenticated;
revoke execute on function public.stada_elevens_uppdrag()   from public, anon, authenticated;
revoke execute on function public.koppla_passets_uppdrag()  from public, anon, authenticated;
revoke execute on function public.skydda_studentfalt()      from public, anon, authenticated;

-- ---------- bakfyllning ----------
-- Som postgres: auth.uid() är null, så skydden släpper igenom. Ett
-- uppdrag per barn, med den tjänst barnets pass faktiskt har (i dag
-- alltid läxhjälp), annars standardtjänsten.
do $$
declare
  s  record;
  ny uuid;
begin
  for s in select * from public.students where uppdrag_id is null order by created_at loop
    insert into public.uppdrag (kund_id, tjanst, status, created_at)
    values (s.parent_id,
            coalesce((select b.tjanst from public.bookings b
                       where b.student_id = s.id order by b.created_at desc limit 1),
                     public.standard_tjanst()),
            case when s.match_status = 'paused' then 'pausat' else 'aktivt' end,
            s.created_at)
    returning id into ny;
    update public.students set uppdrag_id = ny where id = s.id;
  end loop;
end $$;

update public.bookings b
   set uppdrag_id = s.uppdrag_id
  from public.students s
 where b.student_id = s.id and b.uppdrag_id is null;

-- Pass utan barn: familjens enda uppdrag, om det bara finns ett.
update public.bookings b
   set uppdrag_id = (select u.id from public.uppdrag u where u.kund_id = b.parent_id)
 where b.student_id is null and b.uppdrag_id is null
   and (select count(*) from public.uppdrag u where u.kund_id = b.parent_id) = 1;
