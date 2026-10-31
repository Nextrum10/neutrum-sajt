-- ============================================================
-- Profilen fylls i (2026-10-30, profilen_ifylld)
--
-- Leo: "folk ska skriva in sitt postnummer när de skapar profil, alltså
-- man ska fylla i sin profil och det är obligatoriskt, bild och namn och
-- allt annat, adress behövs inte men postnummer behövs". Och om
-- postnumret: "matchning på avstånd samt för statistik som kommer visas
-- på hemsidan, live statistik, inga exakta siffror eller adresser, bara
-- områden vi har flest aktiva matchade studiehjälpare i".
--
-- Vad som krävs, ur Leos svar samma dag:
--   alla: namn, telefon och postnummer
--   studiehjälpare: dessutom profilbild och Om mig (tutor_profiles.bio)
--   familjer: minst ett barn, och varje barn med årskurs och kön
-- Bilden krävs bara av studiehjälparen (Leo valde det: en tvingad bild på
-- föräldern har inget syfte vi kan skriva i policyn). Barnkonton berörs
-- inte: de fyller inte i någon profil.
--
-- 1. postnummer: en egen tabell, aldrig en kolumn på profiles. Den
--    matchade studiehjälparen läser familjens rad i profiles (och familjen
--    hens), och RLS begränsar inga kolumner. Postnumret ser bara personen
--    själv och vi. Det skrivs bara genom spara_postnummer(), som tar bort
--    mellanslaget och prövar fem siffror.
-- 2. mitt_profillage(): vad som saknas, för rutan i vyerna. Rutan är
--    bekvämlighet, som villkorsrutan när databasen inte svarar; den
--    spärrar ingenting i databasen, för en halvfylld profil är ingen
--    säkerhetsfråga.
-- 3. intern.postnummer_region(): postnumrets tre första siffror till
--    navets fem regioner (bygg-omradessidor.py REGIONER). Det är en
--    grov indelning efter postnumrens serier, och ett postnummer utanför
--    dem får ingen region.
-- 4. omraden_med_studiehjalpare(): de regioner där flest aktiva,
--    matchade studiehjälpare bor, för den öppna sidan, utan antal. En
--    region visas bara med minst tre (intern.omraden_minsta_antal):
--    med två studiehjälpare säger "flest på Södermalm" var en namngiven
--    person bor. Adminkonton räknas inte.
-- 5. Postnumret raderas när kontot raderas (cascade) eller
--    avidentifieras (triggern på profiles.raderad_at).
-- ============================================================

-- ---------- 1. postnumret ----------
create table if not exists public.postnummer (
  profil_id  uuid primary key references public.profiles(id) on delete cascade,
  postnummer text not null constraint postnummer_fem_siffror check (postnummer ~ '^[0-9]{5}$'),
  andrad_at  timestamptz not null default now()
);

alter table public.postnummer enable row level security;

revoke all on table public.postnummer from public, anon, authenticated, nextrum_barn;
grant select on table public.postnummer to authenticated;

create policy "egen rad" on public.postnummer
  for select to authenticated using (profil_id = (select auth.uid()));

create policy "admin läser postnummer" on public.postnummer
  for select to authenticated
  using (public.is_admin()
         or public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning']));

comment on table public.postnummer is
  '2026-10-30 (profilen_ifylld). Familjens och studiehjälparens postnummer, för matchningen och regionerna på den öppna '
  'sidan. Aldrig på profiles: den matchade läser den raden. Skrivs bara genom spara_postnummer().';

create or replace function public.spara_postnummer(p_postnummer text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
-- profilen_ifylld (2026-10-30).
declare
  pn text := regexp_replace(coalesce(p_postnummer, ''), '\s', '', 'g');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;
  if exists (select 1 from public.students s where s.user_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Ett barnkonto har inget postnummer.';
  end if;
  if pn !~ '^[0-9]{5}$' then
    raise exception using errcode = '22023', message = 'Ett postnummer är fem siffror, till exempel 123 45.';
  end if;
  insert into public.postnummer (profil_id, postnummer)
  values (auth.uid(), pn)
  on conflict (profil_id) do update set postnummer = excluded.postnummer, andrad_at = now();
  return pn;
end $$;

revoke all on function public.spara_postnummer(text) from public, anon, nextrum_barn;
grant execute on function public.spara_postnummer(text) to authenticated;
comment on function public.spara_postnummer(text) is
  '2026-10-30 (profilen_ifylld). Sparar den inloggades postnummer, fem siffror utan mellanslag.';

-- ---------- 2. vad som saknas ----------
create or replace function public.mitt_profillage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- profilen_ifylld (2026-10-30).
declare
  uid     uuid := auth.uid();
  p       public.profiles%rowtype;
  tutor   boolean;
  tbio    text;
  pn      text;
  saknas  text[] := '{}';
  barn    jsonb := '[]';
begin
  if uid is null then
    return null;
  end if;
  select * into p from public.profiles where id = uid;
  if not found or exists (select 1 from public.students s where s.user_id = uid) then
    return null;
  end if;

  select true, t.bio into tutor, tbio from public.tutor_profiles t where t.id = uid;
  tutor := coalesce(tutor, false);
  select x.postnummer into pn from public.postnummer x where x.profil_id = uid;

  if coalesce(btrim(p.full_name), '') = '' then saknas := array_append(saknas, 'namn'); end if;
  if length(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')) < 7 then saknas := array_append(saknas, 'telefon'); end if;
  if pn is null then saknas := array_append(saknas, 'postnummer'); end if;

  if tutor then
    if p.avatar_url is null then saknas := array_append(saknas, 'bild'); end if;
    if coalesce(btrim(tbio), '') = '' then saknas := array_append(saknas, 'om_mig'); end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'namn', s.name, 'arskurs', s.grade, 'kon', s.kon)
                              order by s.created_at, s.id), '[]')
      into barn
      from public.students s
     where s.parent_id = uid and s.raderad_at is null;
    if jsonb_array_length(barn) = 0
       or exists (select 1 from jsonb_array_elements(barn) b
                   where b->>'arskurs' is null or b->>'kon' is null) then
      saknas := array_append(saknas, 'barn');
    end if;
  end if;

  return jsonb_build_object(
    'roll', case when tutor then 'studiehjalpare' else 'foralder' end,
    'saknas', to_jsonb(saknas),
    'namn', p.full_name,
    'telefon', p.phone,
    'postnummer', pn,
    'om_mig', tbio,
    'barn', barn);
end $$;

revoke all on function public.mitt_profillage() from public, anon, nextrum_barn;
grant execute on function public.mitt_profillage() to authenticated;
comment on function public.mitt_profillage() is
  '2026-10-30 (profilen_ifylld). Vad den inloggades profil saknar (namn, telefon, postnummer, för studiehjälparen bild '
  'och om_mig, för familjen barn med årskurs och kön). Null för ett barnkonto.';

-- ---------- 3. regionen ----------
create or replace function intern.postnummer_region(p_postnummer text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- profilen_ifylld (2026-10-30). Navets regioner (bygg-omradessidor.py REGIONER), efter postnumrens serier.
  select case
    when p_postnummer !~ '^[0-9]{5}$' then null
    when left(p_postnummer, 3)::int between 100 and 119 then 'innerstaden'
    when left(p_postnummer, 3)::int between 120 and 129 then 'soderort'
    when left(p_postnummer, 3)::int between 130 and 159 then 'soder-och-oster'
    when left(p_postnummer, 3)::int between 160 and 168 then 'vasterort'
    when left(p_postnummer, 3)::int between 169 and 199 then 'norr-och-vaster'
    else null
  end
$$;

revoke all on function intern.postnummer_region(text) from public;

create or replace function intern.omraden_minsta_antal()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

revoke all on function intern.omraden_minsta_antal() from public;

-- ---------- 4. regionerna på den öppna sidan ----------
create or replace function public.omraden_med_studiehjalpare()
returns table (region text)
language sql
stable
security definer
set search_path = ''
as $$
  -- profilen_ifylld (2026-10-30). Inga antal ut, och ingen region med färre än intern.omraden_minsta_antal().
  select r.region
    from (select intern.postnummer_region(x.postnummer) as region, count(*) as antal
            from public.tutor_profiles t
            join public.profiles p on p.id = t.id and p.raderad_at is null
            join public.postnummer x on x.profil_id = t.id
           where t.status = 'approved'
             and not exists (select 1 from public.admin_roller a where a.user_id = t.id)
             and exists (select 1 from public.students s
                          where s.matched_tutor_id = t.id and s.match_status <> 'pending' and s.raderad_at is null)
           group by 1) r
   where r.region is not null and r.antal >= intern.omraden_minsta_antal()
   order by r.antal desc, r.region
$$;

revoke all on function public.omraden_med_studiehjalpare() from public, nextrum_barn;
grant execute on function public.omraden_med_studiehjalpare() to anon, authenticated;
comment on function public.omraden_med_studiehjalpare() is
  '2026-10-30 (profilen_ifylld). Navets regioner där flest aktiva, matchade studiehjälpare bor, flest först, utan antal. '
  'En region med färre än intern.omraden_minsta_antal() (3) visas inte.';

-- ---------- 5. avidentifieringen ----------
create or replace function intern.postnummer_vid_avidentifiering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
-- profilen_ifylld (2026-10-30).
begin
  delete from public.postnummer where profil_id = new.id;
  return null;
end $$;

revoke all on function intern.postnummer_vid_avidentifiering() from public;

create trigger profiles_postnummer_bort
  after update on public.profiles
  for each row
  when (new.raderad_at is not null and old.raderad_at is null)
  execute function intern.postnummer_vid_avidentifiering();
