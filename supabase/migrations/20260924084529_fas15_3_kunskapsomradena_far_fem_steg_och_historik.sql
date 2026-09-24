-- ============================================================
-- NEXTRUM — Fas 15.3: kunskapsområdena får fem steg, ett mål
-- och en historik
--
-- Leo 2026-09-24: "lägga in statistik om eleven inom olika ämnen och
-- kunskapsområden … gör detta lite mer avancerat än hur det är idag
-- med bara tre nivåer", och Min utveckling i studievyn ska visa mer
-- om lärandet.
--
-- Tre nivåer (behover_trana, pa_god_vag, bra) räcker inte för att se
-- en rörelse: ett barn som går från "kan inte alls" till "nästan"
-- står på samma nivå hela vägen. Och en nivå utan historik kan bara
-- säga var barnet ÄR, aldrig att det rört sig.
--
-- STEG 1–5 (NXStudie.STEG i nextrum-studie.js är samma lista):
--   1 Nytt   2 Övar   3 På god väg   4 Säker   5 Kan förklara
--
-- LEVEL BLIR KVAR, OCH FÖLJER STEG. Kolumnen läses av adminvyn, av
-- äldre flikar som fortfarande ligger i någons cache och kanske av
-- saker vi inte hittat. Triggern nedan håller de två i takt i båda
-- riktningarna: skriver en ny klient steg sätts level ur det; skriver
-- en gammal klient bara level sätts steg ur det. De kan alltså aldrig
-- säga olika saker. Omräkningen:
--   steg 1–2 → behover_trana,  3 → pa_god_vag,  4–5 → bra
--   behover_trana → 2,  pa_god_vag → 3,  bra → 4
-- (Bakåt landar de gamla nivåerna mitt i sina intervall, inte i
-- kanten: "behöver träna" betydde sällan "helt nytt".)
--
-- MÅLET (mal_steg) är valfritt och sätts av studiehjälparen. Null
-- betyder att inget mål satts, inte att målet är nått.
--
-- HISTORIKEN skrivs av databasen, aldrig av en klient. Varje gång
-- steget ändras läggs en rad i progress_historik med det nya steget,
-- vem som bedömde och när. Tabellen har ingen skrivpolicy alls: en
-- historik som går att skriva i är ingen historik. Den som får läsa
-- kunskapsområdet får läsa dess historik — samma tre grenar som
-- policyerna på progress_items (admin, familjen, elevens
-- studiehjälpare).
--
-- BAKFYLLNAD: de rader som finns får steg ur sin level och EN rad
-- historik, daterad till updated_at. Det är inte en påhittad
-- utveckling — det är det enda läge som faktiskt registrerades, vid
-- den tidpunkt det registrerades.
-- ============================================================

-- ---------- steg och mål ----------
alter table public.progress_items
  add column if not exists steg     smallint,
  add column if not exists mal_steg smallint;

update public.progress_items
   set steg = case level when 'behover_trana' then 2 when 'bra' then 4 else 3 end
 where steg is null;

alter table public.progress_items
  alter column steg set not null;

alter table public.progress_items
  drop constraint if exists progress_items_steg_check;
alter table public.progress_items
  add constraint progress_items_steg_check check (steg between 1 and 5);

alter table public.progress_items
  drop constraint if exists progress_items_mal_steg_check;
alter table public.progress_items
  add constraint progress_items_mal_steg_check check (mal_steg is null or mal_steg between 1 and 5);

comment on column public.progress_items.steg is
  'Var eleven står, 1–5: Nytt, Övar, På god väg, Säker, Kan förklara. '
  'Styr level (Fas 15.3). Varje ändring blir en rad i progress_historik.';
comment on column public.progress_items.mal_steg is
  'Studiehjälparens mål för området, 1–5. Null = inget mål satt, inte "nått".';
comment on column public.progress_items.level is
  'De gamla tre nivåerna. Sätts av triggern ur steg sedan Fas 15.3 — '
  'skriv steg, inte level.';

-- ---------- steg och level i takt ----------
-- I intern: det här är något databasen gör för sin egen skull, inte
-- ett gränssnitt. Ingen SECURITY DEFINER — funktionen rör bara NEW.
create or replace function intern.progress_steg_och_niva()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.steg is null then
      new.steg := case new.level when 'behover_trana' then 2 when 'bra' then 4 else 3 end;
    end if;
  elsif new.steg is not distinct from old.steg and new.level is distinct from old.level then
    -- En äldre klient som bara skriver level.
    new.steg := case new.level when 'behover_trana' then 2 when 'bra' then 4 else 3 end;
  end if;

  new.level := case when new.steg <= 2 then 'behover_trana'
                    when new.steg = 3  then 'pa_god_vag'
                    else 'bra' end;
  return new;
end $$;

revoke execute on function intern.progress_steg_och_niva() from public, anon, authenticated;

drop trigger if exists progress_items_steg_och_niva on public.progress_items;
create trigger progress_items_steg_och_niva
  before insert or update on public.progress_items
  for each row execute function intern.progress_steg_och_niva();

-- ---------- historiken ----------
create table if not exists public.progress_historik (
  id          uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.progress_items(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  subject     text not null,
  area        text not null,
  steg        smallint not null check (steg between 1 and 5),
  bedomd_av   uuid references public.profiles(id) on delete set null,
  bedomd_at   timestamptz not null default now()
);

create index if not exists progress_historik_elev_idx on public.progress_historik (student_id, bedomd_at);
create index if not exists progress_historik_omrade_idx on public.progress_historik (progress_id, bedomd_at);

comment on table public.progress_historik is
  'Varje bedömning av ett kunskapsområde: steget, vem och när. Skrivs BARA av '
  'triggern progress_items_historik (Fas 15.3). Ingen skrivpolicy, med flit.';

alter table public.progress_historik enable row level security;
revoke all on public.progress_historik from anon;
revoke insert, update, delete, truncate on public.progress_historik from authenticated;

drop policy if exists "admin läser historiken" on public.progress_historik;
create policy "admin läser historiken" on public.progress_historik
  for select to authenticated using (public.is_admin());

drop policy if exists "familjen läser sitt barns historik" on public.progress_historik;
create policy "familjen läser sitt barns historik" on public.progress_historik
  for select to authenticated using (exists (
    select 1 from public.students s
    where s.id = progress_historik.student_id and s.parent_id = auth.uid()));

drop policy if exists "studiehjälparen läser sin elevs historik" on public.progress_historik;
create policy "studiehjälparen läser sin elevs historik" on public.progress_historik
  for select to authenticated using (public.is_my_student(student_id));

-- SECURITY DEFINER: tabellen har ingen skrivpolicy, och ska inte ha
-- det. Funktionen ägs av postgres och är den enda vägen in.
create or replace function intern.progress_historik_skriv()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' or new.steg is distinct from old.steg then
    insert into public.progress_historik (progress_id, student_id, subject, area, steg, bedomd_av)
    values (new.id, new.student_id, new.subject, new.area, new.steg, auth.uid());
  end if;
  return null;
end $$;

revoke execute on function intern.progress_historik_skriv() from public, anon, authenticated;

drop trigger if exists progress_items_historik on public.progress_items;
create trigger progress_items_historik
  after insert or update of steg on public.progress_items
  for each row execute function intern.progress_historik_skriv();

-- ---------- bakfyllnad: det läge som faktiskt registrerades ----------
insert into public.progress_historik (progress_id, student_id, subject, area, steg, bedomd_av, bedomd_at)
select p.id, p.student_id, p.subject, p.area, p.steg, p.tutor_id, p.updated_at
  from public.progress_items p
 where not exists (select 1 from public.progress_historik h where h.progress_id = p.id);
