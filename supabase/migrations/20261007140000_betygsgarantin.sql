-- ============================================================
-- Betygsgarantin (2026-10-07)
-- ============================================================
-- Villkoren fick avsnittet Betygsgaranti (#betygsgaranti), och två
-- meningar ändrades med det: Vad Nextrum är och Vårt ansvar. Det är en
-- ändring i sak, så versionen byts till sidans nya datum, och alla får
-- frågan igen vid nästa inloggning (villkoren_godkanns). Den som inte
-- godkänt kan inte boka eller köpa timmar förrän hen gjort det.
--
-- Anmälan görs i föräldravyn, under Profil → Betygsgaranti: föräldern
-- väljer ämnena, högst tre per elev och läsår, och anger elevens
-- nuvarande betyg i varje. Prövningen vid ett anspråk läser det som
-- redan finns: hållen tid, rapporterna, bookings.attendance, homework
-- och betalningarna. Anspråket med betygskopiorna är fortfarande ett
-- mejl till info@.
--
-- Utan drop och utan delete, så att verktygen inte fastnar på en
-- bekräftelse (CLAUDE.md, avsnitt 5): policyerna skapas bakom en
-- kontroll, och jobbet byts med cron.unschedule.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 1. Versionen
--
-- kolla-villkor.py håller datumet här lika med anvandarvillkor.html.
-- Bara kroppen byts: create or replace behåller rättigheterna och
-- kommentaren från villkoren_godkanns.
-- ------------------------------------------------------------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-07'::text $$;


-- ------------------------------------------------------------
-- 2. Anmälningarna
--
-- En rad per elev, läsår och ämne. Läsåret är året det börjar: en
-- anmälan i oktober 2026 gäller läsåret 2026/27. Betyget är det
-- föräldern anger vid anmälan, F till B: garantin gäller inte ett ämne
-- där eleven redan har A. Vid anspråket är det betyget på kopian som
-- gäller, så det här är bara vad familjen sa, och det gallras när
-- tiden för anspråk sedan länge gått ut (avsnitt 6).
--
-- Ingen inloggad skriver i tabellen: bara anmal_betygsgaranti(), med
-- databasens tid. Ett anmält ämne kan inte bytas (villkoren), så det
-- finns ingen väg att ändra eller ta bort en rad.
-- ------------------------------------------------------------
create table if not exists public.betygsgarantier (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  lasar            integer not null check (lasar between 2020 and 2100),
  amne             text not null check (char_length(btrim(amne)) between 1 and 60),
  betyg            text check (betyg in ('F', 'E', 'D', 'C', 'B')),
  anmald_at        timestamptz not null default now(),
  betyg_gallrat_at timestamptz,
  unique (student_id, lasar, amne),
  check ((betyg is null) = (betyg_gallrat_at is not null))
);

comment on table public.betygsgarantier is
  'Betygsgarantin (2026-10-07): ämnena en förälder anmält, högst tre per elev och läsår, med elevens '
  'nuvarande betyg som föräldern angav. Skrivs bara av anmal_betygsgaranti(), med databasens tid.';
comment on column public.betygsgarantier.lasar is
  'Året läsåret börjar: 2026 är läsåret 2026/27. Anmälan är öppen 1 juli till 31 december.';
comment on column public.betygsgarantier.betyg is
  'Elevens nuvarande betyg i ämnet, som föräldern angav vid anmälan. Gallras den 1 oktober efter '
  'läsåret (betygsgarantier_gallra), och när eleven raderas.';

create index if not exists betygsgarantier_elev on public.betygsgarantier (student_id, lasar);

alter table public.betygsgarantier enable row level security;

-- Supabase ger anon och authenticated rättigheter på varje ny tabell.
-- Ingen inloggad skriver här, och anon ska inte ens kunna läsa.
revoke all on public.betygsgarantier from anon;
revoke insert, update, delete, truncate, references, trigger on public.betygsgarantier from authenticated;

-- Föräldern läser sina barns anmälningar. Underfrågan läser students
-- som föräldern, så ett raderat barns rader syns inte. Admin läser dem
-- med samma behörigheter som läser personerna: ett barns betyg är inget
-- för den som bara bokar eller matchar.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'betygsgarantier'
                    and policyname = 'föräldern läser barnens garantier') then
    create policy "föräldern läser barnens garantier" on public.betygsgarantier
      for select to authenticated
      using (exists (select 1 from public.students s
                      where s.id = betygsgarantier.student_id
                        and s.parent_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'betygsgarantier'
                    and policyname = 'behörighet läser garantierna') then
    create policy "behörighet läser garantierna" on public.betygsgarantier
      for select to authenticated
      using (public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera']));
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. Ämnena
--
-- Garantin jämför två betyg, så den gäller ämnen som har ett eget betyg
-- i skolan, inte vyns grupper ("NO / Fysik / Kemi / Biologi"): ämnena vi
-- hjälper till med (NX.AMNEN), uppdelade per betyg. Listan står också i
-- GARANTI_AMNEN i nextrum-studie-vy.js, och de ändras tillsammans. Den är
-- en funktion och inget villkor på tabellen: då byts den med create or
-- replace, utan drop.
-- ------------------------------------------------------------
create or replace function intern.betygsgaranti_amnen()
returns text[]
language sql
immutable
set search_path = pg_temp
as $$
  select array['Matematik', 'Svenska', 'Svenska som andraspråk', 'Engelska',
               'Biologi', 'Fysik', 'Kemi', 'Historia', 'Samhällskunskap',
               'Spanska', 'Tyska', 'Franska', 'Programmering']
$$;

revoke all on function intern.betygsgaranti_amnen() from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. Anmälan
--
-- Ett ämne per anrop. Allt som villkoren säger om anmälan prövas här,
-- inte i vyn:
--   · en vuxen med konto, och barnet är hens (och inte raderat)
--   · den gällande versionen av villkoren är godkänd, som för ett pass
--   · senast den 31 december: anmälan är öppen från den 1 juli, och
--     gäller läsåret som börjar den hösten. Klockan är svensk.
--   · ett ämne ur listan ovan, och ett betyg F till B; A går inte att
--     anmäla
--   · högst tre ämnen per elev och läsår, och samma ämne en gång
--
-- Låset gör att två anmälningar samtidigt inte båda ser två rader och
-- skriver en fjärde.
--
-- Felen bär en mening, för vyn visar databasens text (NX.felText), och
-- ledtråden villkor eller stangd, så att vyn kan känna igen dem.
-- ------------------------------------------------------------
create or replace function public.anmal_betygsgaranti(p_elev uuid, p_amne text, p_betyg text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  vem     uuid := auth.uid();
  nu      timestamp := now() at time zone 'Europe/Stockholm';
  lasaret integer;
  amnet   text := btrim(coalesce(p_amne, ''));
  betyget text := upper(btrim(coalesce(p_betyg, '')));
  rad     public.betygsgarantier;
begin
  if vem is null then
    raise exception 'Logga in för att anmäla betygsgarantin.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn' then
    raise exception 'Betygsgarantin anmäls av en vuxen med eget konto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s
                  where s.id = p_elev and s.parent_id = vem and s.raderad_at is null) then
    raise exception 'Eleven finns inte bland era barn.' using errcode = '42501';
  end if;
  if not intern.villkoren_godkanda(vem) then
    raise exception 'Godkänn användarvillkoren först. Ladda om sidan, så kommer frågan.'
      using errcode = 'P0001', hint = 'villkor';
  end if;
  if extract(month from nu) < 7 then
    raise exception 'Anmälan för det här läsåret stängde den 31 december. Från den 1 juli kan ni anmäla till nästa läsår.'
      using errcode = 'P0001', hint = 'stangd';
  end if;
  lasaret := extract(year from nu)::integer;

  if not (amnet = any (intern.betygsgaranti_amnen())) then
    raise exception 'Välj ett av ämnena i listan.' using errcode = '22023';
  end if;
  if betyget = 'A' then
    raise exception 'Garantin gäller inte ett ämne där eleven redan har A.' using errcode = '22023';
  end if;
  if betyget not in ('F', 'E', 'D', 'C', 'B') then
    raise exception 'Ange elevens nuvarande betyg i ämnet, F till B.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('betygsgaranti:' || p_elev::text, 0));
  if exists (select 1 from public.betygsgarantier g
              where g.student_id = p_elev and g.lasar = lasaret and lower(g.amne) = lower(amnet)) then
    raise exception '% är redan anmält för det här läsåret.', amnet using errcode = '23505';
  end if;
  if (select count(*) from public.betygsgarantier g
       where g.student_id = p_elev and g.lasar = lasaret) >= 3 then
    raise exception 'Garantin gäller högst tre ämnen per elev och läsår.' using errcode = 'P0001';
  end if;

  insert into public.betygsgarantier (student_id, lasar, amne, betyg)
  values (p_elev, lasaret, amnet, betyget)
  returning * into rad;

  return jsonb_build_object('id', rad.id, 'student_id', rad.student_id, 'lasar', rad.lasar,
                            'amne', rad.amne, 'betyg', rad.betyg, 'anmald_at', rad.anmald_at);
end $$;

revoke execute on function public.anmal_betygsgaranti(uuid, text, text) from public, anon;
grant execute on function public.anmal_betygsgaranti(uuid, text, text) to authenticated;


-- ------------------------------------------------------------
-- 5. Ett raderat barn tar betygen med sig
--
-- radera_person() avidentifierar en elev som har pass genom att sätta
-- raderad_at; det familjen skrivit om barnet ska bort då, och betyget
-- är det. Raden står kvar utan betyg (ämnet och läsåret pekar inte ut
-- någon), och raderas eleven helt tar on delete cascade resten. Ingen
-- UPDATE OF: den hade inte sett en kolumn som en annan trigger satt.
-- ------------------------------------------------------------
create or replace function intern.betygsgarantier_elev_raderad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.betygsgarantier
     set betyg = null, betyg_gallrat_at = now()
   where student_id = new.id and betyg is not null;
  return null;
end $$;

revoke all on function intern.betygsgarantier_elev_raderad() from public, anon, authenticated;

create or replace trigger students_betygsgarantier_raderas
  after update on public.students
  for each row
  when (new.raderad_at is not null and old.raderad_at is null)
  execute function intern.betygsgarantier_elev_raderad();


-- ------------------------------------------------------------
-- 6. Gallringen
--
-- Betyget behövs bara fram till att ett anspråk kan vara avgjort:
-- läsåret slutar i juni, anspråket ska in inom 30 dagar och svaret
-- inom 14. Den 1 oktober efter läsåret tas det bort, svensk tid.
-- Raden står kvar utan betyg: den säger vilka ämnen som hade garanti,
-- och garantin kan användas en gång per elev och ämne.
-- ------------------------------------------------------------
create or replace function intern.betygsgarantier_gallra()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  antal integer;
begin
  update public.betygsgarantier
     set betyg = null, betyg_gallrat_at = now()
   where betyg is not null
     and (now() at time zone 'Europe/Stockholm')::date >= make_date(lasar + 1, 10, 1);
  get diagnostics antal = row_count;
  return antal;
end $$;

revoke all on function intern.betygsgarantier_gallra() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'betygsgaranti-gallring';
select cron.schedule('betygsgaranti-gallring', '56 3 * * *', $$select intern.betygsgarantier_gallra()$$);
