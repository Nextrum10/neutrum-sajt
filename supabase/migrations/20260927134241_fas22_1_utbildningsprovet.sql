-- ============================================================
-- NEXTRUM — Fas 22.1: utbildningsprovet
--
-- Utbildningssteget var två knappar: "Skicka utbildningen" och
-- "Markera utbildad". Ingenting i mellan sa om den som gått
-- utbildningen också förstått den. Nu kommer ett prov däremellan:
-- trettio flervalsfrågor om handledarhandboken, gjort på nätet utan
-- tidsgräns, godkänt vid 80 procent.
--
--   admin: "Utbildningsmötet är hållet"   utbildningsmote_at
--     → provet öppnas i tre dagar          prov_sista_dag = dagen + 3
--     → mejl med länken                    steg 'prov'
--     → påminnelse dagen efter kl. 9       steg 'prov_paminnelse'
--     → påminnelse sista dagen kl. 9       steg 'prov_sista_dagen'
--   den sökande gör provet, om och om igen
--     → 80 % rätt: prov_godkant_at, och utbildad_at om den inte
--       redan är satt. Då går mejlet om sista steget (kontot) av sig
--       självt, genom triggern som redan finns.
--
--
-- DEN SOM SÖKER HAR INGET KONTO
--
-- Kontot skapas i steg fyra, efter provet. Provet nås därför genom en
-- länk med en slumpad nyckel (prov_nyckel, 122 bitar), som bara står
-- i mejlen till den sökande och i adminvyn. Nyckeln öppnar ett prov
-- för en ansökan och inget annat: den kan inte läsa ansökan, inte
-- ändra den och inte logga in någon.
--
--
-- FACIT LÄMNAR ALDRIG SERVERN
--
-- Frågorna och de rätta svaren står i edge-funktionen
-- (_delad/utbildningsprov.ts), inte i sidan. Funktionen rättar och
-- skriver resultatet här genom utbildningsprov_lamna(), som bara
-- service_role når. Gränsen 80 procent räknas i databasen, inte i
-- anropet: en funktion som skrev "godkänd" rakt av hade varit en rad
-- från att godkänna alla.
--
--
-- TRE DAGAR, RÄKNAT I SVENSK TID
--
-- "Tillgängligt i tre dagar efter utbildningsdagen": hålls mötet en
-- måndag är provet öppet till och med torsdag, till midnatt i
-- Stockholm. Påminnelserna går tisdag och torsdag. Stänger provet
-- innan någon klarat det öppnar admin det igen med "Tre dagar till",
-- som sätter en ny sista dag och ger ett nytt mejl och nya
-- påminnelser. Nyckeln i mejlen bär sista dagen, så det gamla
-- fönstrets påminnelser skickas inte i det nya.
--
--
-- OM OCH OM IGEN, MEN INTE I EN SLINGA
--
-- Den som inte klarar provet får göra om det, så många gånger som
-- behövs. Högst tio försök per dygn: med omedelbart besked efter
-- varje försök går varje prov att gissa sig igenom med ett skript,
-- och tio om dagen är fler än en människa gör.
-- ============================================================

-- ---------- 1. kolumnerna ----------
alter table public.applications
  add column if not exists utbildningsmote_at timestamptz,
  add column if not exists prov_sista_dag     date,
  add column if not exists prov_nyckel        uuid,
  add column if not exists prov_godkant_at    timestamptz;

comment on column public.applications.utbildningsmote_at is
  'När admin markerade att den sökande deltagit i utbildningsmötet. Öppnar provet (Fas 22.1).';
comment on column public.applications.prov_sista_dag is
  'Sista dagen provet går att göra, i svensk tid. Sätts till utbildningsdagen + 3, '
  'eller av admin när provet öppnas igen. Null betyder att provet är stängt.';
comment on column public.applications.prov_nyckel is
  'Nyckeln i provlänken. Slumpad, öppnar bara provet för den här ansökan. Visas aldrig utanför mejlen och adminvyn.';
comment on column public.applications.prov_godkant_at is
  'När den sökande fick minst 80 procent rätt på utbildningsprovet. Sätts bara av utbildningsprov_lamna().';

create unique index if not exists applications_prov_nyckel
  on public.applications (prov_nyckel) where prov_nyckel is not null;

-- ---------- 2. fälten sätts av Nextrum, aldrig av den som söker ----------
-- Ansökningsformuläret är öppet för vem som helst. Utan de här raderna
-- hade en främling kunnat skicka in en ansökan med en egen adress och
-- en satt prov_sista_dag, och påminnelsejobbet hade mejlat hen från
-- vår domän.
create or replace function public.skydda_ansokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  giltiga text[];
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Läget och tidsstämplarna sätts av Nextrum, aldrig av den som söker.
    new.status       := 'new';
    new.kontaktad_at := null;
    new.intervju_at  := null;
    new.utbildad_at  := null;
    new.notering     := null;
    -- Fas 16.1: mötet också. Ett mötesmejl byggs på de här två fälten,
    -- och en länk som den som söker själv skrivit in är en nätfiskelänk
    -- i ett mejl från vår domän.
    new.mote_tid     := null;
    new.mote_lank    := null;
    -- Fas 16.1c: och när ansökan kom in. Kvittobromsen räknar på den,
    -- och en tid den som postar själv väljer är ingen broms.
    new.created_at   := now();
    -- Fas 22.1: och provet. Påminnelsejobbet mejlar alla med en satt
    -- sista dag, och en egen nyckel hade varit ett prov man själv
    -- bestämt facit till.
    new.utbildningsmote_at := null;
    new.prov_sista_dag     := null;
    new.prov_nyckel        := null;
    new.prov_godkant_at    := null;

    -- Bara tjänster som faktiskt går att söka till. En kod som inte
    -- gör det skrivs om i stället för att neka ansökan — vi ska inte
    -- straffa någon för att vår katalog ändrats under tiden.
    select array_agg(k) into giltiga
      from unnest(coalesce(new.tjanster, '{}'::text[])) as k
     where exists (select 1 from public.tjanster t
                    where t.kod = k and t.aktiv and t.for_jobb);

    if giltiga is null or cardinality(giltiga) = 0 then
      select array[t.kod] into giltiga
        from public.tjanster t
       where t.aktiv and t.for_jobb
       order by t.ordning, t.kod
       limit 1;
    end if;
    new.tjanster := coalesce(giltiga, array['laxhjalp']);

    -- Längdtaken. Samma skäl som för leads: utan dem kan vem som
    -- helst posta en rad på flera megabyte mot det öppna API:et, och
    -- den raden läses sedan av adminvyn och av notismejlet.
    new.name         := left(new.name, 120);
    new.email        := left(new.email, 200);
    new.school       := left(new.school, 120);
    new.subjects     := left(new.subjects, 200);
    new.availability := left(new.availability, 200);
    new.why          := left(new.why, 4000);
  else
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.intervju_at  := old.intervju_at;
    new.utbildad_at  := old.utbildad_at;
    new.notering     := old.notering;
    new.tjanster     := old.tjanster;
    new.mote_tid     := old.mote_tid;
    new.mote_lank    := old.mote_lank;
    new.created_at   := old.created_at;
    new.utbildningsmote_at := old.utbildningsmote_at;
    new.prov_sista_dag     := old.prov_sista_dag;
    new.prov_nyckel        := old.prov_nyckel;
    new.prov_godkant_at    := old.prov_godkant_at;
  end if;
  return new;
end $function$;

-- ---------- 3. mötet öppnar provet ----------
-- Egen trigger, efter applications_skydda i namnordning: skyddet har
-- då redan återställt allt en icke-admin försökt ändra, och det här
-- ser bara det admin faktiskt satt.
create or replace function intern.utbildningsprov_oppnas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.utbildningsmote_at is not null and old.utbildningsmote_at is null then
    -- Utbildningsdagen i svensk tid, inte i UTC: ett möte som markeras
    -- klockan halv ett på natten hör till dagen efter i Stockholm.
    new.prov_sista_dag := (new.utbildningsmote_at at time zone 'Europe/Stockholm')::date + 3;
  elsif new.utbildningsmote_at is null and old.utbildningsmote_at is not null then
    -- Ångrat: mötet hölls inte, och då är provet inte öppet heller.
    new.prov_sista_dag := null;
  end if;

  -- Samma nyckel genom varje nytt fönster: länken i det första mejlet
  -- ska fortsätta gälla när admin ger tre dagar till.
  if new.prov_sista_dag is not null and new.prov_nyckel is null then
    new.prov_nyckel := gen_random_uuid();
  end if;
  return new;
end $$;

revoke execute on function intern.utbildningsprov_oppnas() from public, anon, authenticated;

drop trigger if exists applications_utbildningsprov on public.applications;
create trigger applications_utbildningsprov
  before update of utbildningsmote_at, prov_sista_dag on public.applications
  for each row execute function intern.utbildningsprov_oppnas();

-- ---------- 4. auditloggen tar med provets steg ----------
-- Tidsstämplarna och sista dagen, aldrig nyckeln: auditloggen går inte
-- att rätta, och en nyckel där vore en länk till provet för alltid.
drop trigger if exists applications_audit on public.applications;
create trigger applications_audit
  after update of status, kontaktad_at, intervju_at, utbildad_at,
                  utbildningsmote_at, prov_sista_dag, prov_godkant_at
  on public.applications
  for each row execute function public.logga_andring('ansokan', 'id', 'status', 'kontaktad_at',
    'intervju_at', 'utbildad_at', 'utbildningsmote_at', 'prov_sista_dag', 'prov_godkant_at');

-- ---------- 5. tre nya besked ----------
alter table public.ansokan_utskick drop constraint if exists ansokan_utskick_steg_check;
alter table public.ansokan_utskick add constraint ansokan_utskick_steg_check
  check (steg in ('mottagen', 'mote', 'utbildning', 'prov', 'prov_paminnelse', 'prov_sista_dagen',
                  'sista_steget', 'valkommen'));

create or replace function intern.ansokan_besked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  minut integer;
  timme integer;
  samma integer;
  broms text := null;
begin
  -- Ett fel här får aldrig stoppa ansökan eller adminens klick. Ett
  -- uteblivet mejl är ett mindre fel än en ansökan som inte sparas.
  begin
    if tg_op = 'INSERT' then
      -- BARA kvittot. Ingenting annat i raden läses, eftersom raden
      -- kan vara skriven av vem som helst. created_at är satt av
      -- skydda_ansokningsfalt (Fas 16.1c), inte av den som postade.
      select count(*) filter (where a.created_at > now() - interval '1 minute'),
             count(*)
        into minut, timme
        from public.applications a
       where a.created_at > now() - interval '1 hour';
      select count(*) into samma from public.applications a
       where intern.epost_nyckel(a.email) = intern.epost_nyckel(new.email)
         and a.id <> new.id
         and a.created_at > now() - interval '24 hours';
      if minut > 5 then
        broms := 'Fler än fem ansökningar den senaste minuten.';
      elsif timme > 20 then
        broms := 'Fler än tjugo ansökningar den senaste timmen.';
      elsif samma > 0 then
        broms := 'Adressen har redan sökt det senaste dygnet.';
      end if;
      perform intern.ansokan_besked_koa(new.id, 'mottagen', 'mottagen', broms);
      return new;
    end if;

    if new.status = 'rejected' then
      return new;
    end if;

    -- Mötet: en ny tid eller en ny länk ger ett nytt mejl. Ett möte som
    -- redan varit (admin som för in det i efterhand) mejlas inte.
    if new.mote_tid is not null and new.mote_tid > now()
       and new.status is distinct from 'approved' and new.intervju_at is null
       and (old.mote_tid is distinct from new.mote_tid
            or old.mote_lank is distinct from new.mote_lank) then
      perform intern.ansokan_besked_koa(new.id, 'mote',
        'mote:' || extract(epoch from new.mote_tid)::bigint || ':' || md5(coalesce(new.mote_lank, '')));
    end if;

    if old.intervju_at is null and new.intervju_at is not null
       and new.utbildad_at is null and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'utbildning', 'utbildning');
    end if;

    -- Fas 22.1: provet öppnas, eller öppnas igen med nya dagar. Nyckeln
    -- bär sista dagen, så varje fönster mejlas en gång.
    if new.prov_sista_dag is not null
       and new.prov_sista_dag is distinct from old.prov_sista_dag
       and new.prov_sista_dag >= (now() at time zone 'Europe/Stockholm')::date
       and new.prov_godkant_at is null and new.utbildad_at is null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'prov', 'prov:' || new.prov_sista_dag);
    end if;

    if old.utbildad_at is null and new.utbildad_at is not null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'sista_steget', 'sista_steget');
    end if;

    if new.status = 'approved' and old.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'valkommen', 'valkommen');
    end if;
  exception when others then
    raise warning 'ansokan_besked: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end $$;

-- utbildningsmote_at står i listan fast triggern aldrig läser den. En
-- UPDATE OF-trigger går bara när kolumnen står i själva UPDATE:n, inte
-- när en BEFORE-trigger ändrar den: "Utbildningsmötet är hållet"
-- skriver bara utbildningsmote_at, och prov_sista_dag sätts av
-- applications_utbildningsprov. Utan den här raden gick provmejlet
-- aldrig. Ett rullat prov fångade det.
drop trigger if exists ansokan_besked on public.applications;
create trigger ansokan_besked
  after insert or update of status, mote_tid, mote_lank, intervju_at, utbildad_at,
                            utbildningsmote_at, prov_sista_dag
  on public.applications
  for each row execute function intern.ansokan_besked();

-- ---------- 6. funktionens dörr får provets nyckel och sista dag ----------
-- Returtypen ändras, och det kräver drop. ansokan-notis läser kolumnerna
-- med namn, så en äldre version av funktionen fortsätter fungera.
drop function if exists public.ansokan_besked_ta(uuid);
create function public.ansokan_besked_ta(p_id uuid)
returns table (id uuid, steg text, namn text, epost text, mote_tid timestamptz,
               mote_lank text, ombokat boolean, forsok integer,
               prov_nyckel uuid, prov_sista_dag date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.ansokan_utskick%rowtype;
  a public.applications%rowtype;
begin
  update public.ansokan_utskick u
     set status = 'skickar', forsok = u.forsok + 1,
         lanad_till = now() + interval '2 minutes', uppdaterad = now()
   where u.id = p_id
     and u.forsok < 3
     and (u.status in ('vantar', 'fel') or (u.status = 'skickar' and u.lanad_till < now()))
  returning u.* into r;
  if not found then
    return;
  end if;

  select * into a from public.applications x where x.id = r.ansokan_id;

  -- Läget kan ha ändrats sedan raden köades. Ett nej, eller ett möte
  -- som redan fått en nyare tid, ska inte ge ett mejl om det gamla.
  if a.id is null or a.status = 'rejected' then
    update public.ansokan_utskick set status = 'hoppad', fel = 'ansökan är avböjd eller borta',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;
  if r.steg = 'mote' and (a.mote_tid is null or r.nyckel is distinct from
       'mote:' || extract(epoch from a.mote_tid)::bigint || ':' || md5(coalesce(a.mote_lank, ''))) then
    update public.ansokan_utskick set status = 'hoppad', fel = 'mötet har fått en nyare tid',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  -- Fas 22.1: ett provmejl om ett prov som redan är klart, stängt
  -- eller har fått nya dagar är fel besked. Nyckeln bär sista dagen.
  if r.steg in ('prov', 'prov_paminnelse', 'prov_sista_dagen') then
    if a.prov_godkant_at is not null or a.utbildad_at is not null or a.status = 'approved' then
      update public.ansokan_utskick set status = 'hoppad', fel = 'provet är redan klart',
             lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
      return;
    end if;
    if a.prov_sista_dag is null or a.prov_nyckel is null
       or split_part(r.nyckel, ':', 2) is distinct from a.prov_sista_dag::text
       or a.prov_sista_dag < (now() at time zone 'Europe/Stockholm')::date then
      update public.ansokan_utskick set status = 'hoppad', fel = 'provet är stängt eller har fått nya dagar',
             lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
      return;
    end if;
  end if;

  return query select r.id, r.steg, a.name, a.email, a.mote_tid, a.mote_lank,
    exists (select 1 from public.ansokan_utskick x
             where x.ansokan_id = r.ansokan_id and x.steg = 'mote' and x.id <> r.id
               and x.status = 'skickad'),
    r.forsok,
    case when r.steg like 'prov%' then a.prov_nyckel end,
    case when r.steg like 'prov%' then a.prov_sista_dag end;
end $$;

revoke execute on function public.ansokan_besked_ta(uuid) from public, anon, authenticated;
grant execute on function public.ansokan_besked_ta(uuid) to service_role;

-- ---------- 7. påminnelserna ----------
-- Dagen efter utbildningen och sista dagen, klockan nio eller strax
-- efter. Jobbet går varje timme; nyckeln (steg + sista dag) är unik,
-- så en påminnelse går en gång oavsett hur många gånger jobbet kör.
-- Före nio går ingenting: en påminnelse om ett prov ska inte väcka
-- en sextonåring klockan sju över tolv.
create or replace function intern.utbildningsprov_paminn()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nu    timestamp := now() at time zone 'Europe/Stockholm';
  idag  date := nu::date;
  r     record;
  steg  text;
  n     integer := 0;
begin
  if extract(hour from nu) < 9 then
    return 0;
  end if;
  for r in
    select a.id, a.prov_sista_dag from public.applications a
     where a.prov_sista_dag is not null
       and a.prov_godkant_at is null and a.utbildad_at is null
       and a.status is distinct from 'approved' and a.status is distinct from 'rejected'
       and idag in (a.prov_sista_dag - 2, a.prov_sista_dag)
  loop
    steg := case when idag = r.prov_sista_dag then 'prov_sista_dagen' else 'prov_paminnelse' end;
    perform intern.ansokan_besked_koa(r.id, steg, steg || ':' || r.prov_sista_dag);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function intern.utbildningsprov_paminn() from public, anon, authenticated;

-- ---------- 8. försöken ----------
create table if not exists public.utbildningsprov_forsok (
  id          uuid primary key default gen_random_uuid(),
  ansokan_id  uuid not null references public.applications(id) on delete cascade,
  ratt        integer not null check (ratt >= 0),
  antal       integer not null check (antal > 0 and ratt <= antal),
  godkant     boolean not null,
  -- Vilket alternativ som valdes per fråga, {"fraga-id": "alternativ-id"}.
  -- Bara koder ur provet, aldrig fritext: funktionen skriver bara
  -- id:n den själv känner igen. Finns för att se vilka frågor som
  -- blir fel för många, alltså var utbildningen är otydlig.
  svar        jsonb not null default '{}'::jsonb,
  skapad      timestamptz not null default now()
);

comment on table public.utbildningsprov_forsok is
  'Varje försök på utbildningsprovet (Fas 22.1). Skrivs bara av utbildningsprov_lamna(), läses bara av admin.';

create index if not exists utbildningsprov_forsok_ansokan
  on public.utbildningsprov_forsok (ansokan_id, skapad desc);

alter table public.utbildningsprov_forsok enable row level security;
revoke all on public.utbildningsprov_forsok from anon, authenticated;
grant select on public.utbildningsprov_forsok to authenticated;

drop policy if exists "admin läser provförsöken" on public.utbildningsprov_forsok;
create policy "admin läser provförsöken" on public.utbildningsprov_forsok
  for select to authenticated using (public.is_admin());

-- ---------- 9. provets två dörrar, bara för service_role ----------
-- Läget för en nyckel. Inga rader betyder en nyckel som inte finns,
-- och sidan säger då att länken inte gäller. Ingen adress, inget
-- efternamn: förnamnet räcker för att hälsa.
create or replace function public.utbildningsprov_lage(p_nyckel uuid)
returns table (lage text, fornamn text, sista_dag date, forsok integer,
               forsok_idag integer, basta_ratt integer, basta_antal integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when a.prov_godkant_at is not null then 'godkant'
           when a.status = 'rejected' then 'stangt'
           when a.prov_sista_dag is null then 'stangt'
           when a.prov_sista_dag < (now() at time zone 'Europe/Stockholm')::date then 'stangt'
           else 'oppet'
         end,
         intern.fornamn(a.name),
         a.prov_sista_dag,
         (select count(*)::integer from public.utbildningsprov_forsok f where f.ansokan_id = a.id),
         (select count(*)::integer from public.utbildningsprov_forsok f
           where f.ansokan_id = a.id and f.skapad > now() - interval '24 hours'),
         b.ratt, b.antal
    from public.applications a
    left join lateral (
      select f.ratt, f.antal from public.utbildningsprov_forsok f
       where f.ansokan_id = a.id
       order by f.ratt::numeric / f.antal desc, f.skapad desc
       limit 1) b on true
   where p_nyckel is not null and a.prov_nyckel = p_nyckel
$$;

-- Ett försök. Funktionen har rättat; här prövas att provet är öppet,
-- taket per dygn och gränsen. utfall: 'ok', 'okand' (ingen sådan
-- nyckel), 'stangt', 'godkant' (redan klart), 'for_manga'.
create or replace function public.utbildningsprov_lamna(
  p_nyckel uuid, p_ratt integer, p_antal integer, p_svar jsonb)
returns table (utfall text, godkant boolean, forsok integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a      public.applications%rowtype;
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  senast integer;
  ok     boolean;
begin
  if p_nyckel is null then
    return query select 'okand'::text, false, 0;
    return;
  end if;

  -- Raden låses: två försök som lämnas samtidigt ska räknas mot taket
  -- ett i taget, och bara ett av dem ska sätta utbildad_at.
  select * into a from public.applications x where x.prov_nyckel = p_nyckel for update;
  if not found then
    return query select 'okand'::text, false, 0;
    return;
  end if;

  if a.prov_godkant_at is not null then
    return query select 'godkant'::text, true, 0;
    return;
  end if;
  if a.status = 'rejected' or a.prov_sista_dag is null or a.prov_sista_dag < idag then
    return query select 'stangt'::text, false, 0;
    return;
  end if;

  select count(*) into senast from public.utbildningsprov_forsok f
   where f.ansokan_id = a.id and f.skapad > now() - interval '24 hours';
  if senast >= 10 then
    return query select 'for_manga'::text, false, senast;
    return;
  end if;

  if p_antal is null or p_antal < 1 or p_antal > 200
     or p_ratt is null or p_ratt < 0 or p_ratt > p_antal then
    raise exception 'Ogiltigt resultat: % av %', p_ratt, p_antal using errcode = '22023';
  end if;

  -- 80 procent, i heltal: 24 av 30 är godkänt, 23 är det inte.
  ok := p_ratt * 5 >= p_antal * 4;

  insert into public.utbildningsprov_forsok (ansokan_id, ratt, antal, godkant, svar)
  values (a.id, p_ratt, p_antal, ok,
          case when jsonb_typeof(p_svar) = 'object' then p_svar else '{}'::jsonb end);

  if ok then
    -- utbildad_at bara om den inte redan är satt. Triggern ansokan_besked
    -- mejlar då sista steget, precis som när admin klickar.
    update public.applications
       set prov_godkant_at = now(),
           utbildad_at = coalesce(utbildad_at, now())
     where id = a.id;
  end if;

  return query select 'ok'::text, ok, senast + 1;
end $$;

revoke execute on function public.utbildningsprov_lage(uuid) from public, anon, authenticated;
revoke execute on function public.utbildningsprov_lamna(uuid, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.utbildningsprov_lage(uuid) to service_role;
grant execute on function public.utbildningsprov_lamna(uuid, integer, integer, jsonb) to service_role;
