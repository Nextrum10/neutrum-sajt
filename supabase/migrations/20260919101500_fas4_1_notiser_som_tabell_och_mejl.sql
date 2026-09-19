-- ============================================================
-- NEXTRUM — Fas 4.1
-- NOTISER BLIR EN RAD, OCH EN RAD BLIR ETT MEJL
--
-- Körs efter 20260917105600. Idempotent.
--
-- Skapar:
--   1. public.notiser — notisen som data, inte som en uträkning
--   2. fem triggrar som skriver dit när något händer
--   3. en trigger på notiser som ropar på edge-funktionen notis-mejl
--
-- Tar bort:
--   4. "nytt-passforslag" och "nytt-meddelande" (schema-v25)
--
--
-- VAD SOM VAR FEL
--
-- En notis fanns inte. nextrum-larare-vy.js och nextrum-studie-vy.js
-- räknade fram den vid varje sidladdning — "3 pass att bekräfta" är
-- en filtrering av S.bokningar i webbläsaren, ingenting annat. Det
-- fungerar för den som loggar in. För den som inte gör det finns
-- notisen inte.
--
-- Vid sidan om låg två edge-funktioner som mejlade var sin händelse.
-- Tillsammans täckte de två av de fem notiser vyerna visar:
--
--   pass_forslag    studiehjälparen föreslår en tid   → pass-notis
--   meddelande      någon skriver i tråden            → meddelande-notis
--   pass_onskemal   FAMILJEN önskar en tid            → ingenting
--   rapport         rapporten efter passet är klar    → ingenting
--   laxa            ny uppgift till nästa gång        → ingenting
--
-- Den tredje raden är den som kostar pengar. Familjen som önskar en
-- tid får ett mejl när studiehjälparen svarar — men studiehjälparen
-- som ska svara får inget, och ser förfrågan först nästa gång hen
-- loggar in. Passet ligger och väntar på någon som inte vet om det.
--
--
-- VARFÖR EN TABELL OCH INTE TRE FUNKTIONER TILL
--
-- Varje ny notistyp hade annars krävt en egen edge-funktion, en egen
-- trigger och en egen kopia av brevmallen. Två kopior hade redan
-- glidit isär: båda hade kvar knappfärgen #9C4520, som sajten slutat
-- använda.
--
-- Nu skriver triggern en rad med VAD som hänt och TILL VEM. En enda
-- funktion, notis-mejl, bestämmer hur det låter. Nästa notistyp är
-- ett fall i TEXTER i den funktionen plus en trigger här — ingen ny
-- funktion, ingen ny webhook, ingen ny hemlighet.
--
-- Och raden finns kvar efteråt. Går mejlet fel står notisen kvar med
-- mejlad_at = null, går att se i adminvyn och går att skicka om.
-- Förut var mejlet det enda spåret: kom det inte fram hade händelsen
-- aldrig aviserats, och ingen visste om det.
--
--
-- VYERNA RÖRS INTE I DEN HÄR MIGRATIONEN
--
-- larare-vy och studie-vy fortsätter räkna fram sina notiser som
-- förut. Tabellen är driftsatt och fylld från dag ett, men det som
-- ritas i webbläsaren byter källa först när någon läser om de två
-- filerna. Det är ett separat steg med egen risk, och det behöver
-- inte ligga före mejlen.
--
-- Följden så länge: last_at sätts aldrig, eftersom ingenting markerar
-- en notis som läst än. Kolumnen finns för det steget. Att den står
-- tom påverkar inte utskicken — tystnadsfönstret i notis-mejl räknar
-- på mejlad_at.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABELLEN
--
-- data är jsonb och inte fem kolumner, för fälten skiljer sig åt
-- mellan typerna: en passnotis har datum och längd, en läxnotis har
-- titel och förfallodag. En kolumn per fält hade gett en tabell där
-- de flesta är null i de flesta rader, och en ny notistyp hade
-- krävt en migration i stället för ett fält.
--
-- BRÖDTEXT SKRIVS ALDRIG HIT. Inte meddelandet, inte rapporten.
-- notis-mejl skickar med det som står i data, och det som inte står
-- där kan inte läcka ut i en inkorg. Innehållet kan gälla ett barns
-- skolgång; den som vill läsa loggar in.
-- ------------------------------------------------------------
create table if not exists public.notiser (
  id         uuid primary key default gen_random_uuid(),
  mottagare  uuid not null references public.profiles(id) on delete cascade,
  typ        text not null check (typ in
               ('pass_forslag','pass_onskemal','meddelande','rapport','laxa')),
  data       jsonb not null default '{}'::jsonb,

  -- Ankaret i vyn, t.ex. '#pass-lista'. notis-mejl sätter '/larare'
  -- eller '/foralder' framför utifrån mottagarens roll, så samma
  -- rad fungerar åt båda håll.
  mal        text,

  skapad     timestamptz not null default now(),
  last_at    timestamptz,
  mejlad_at  timestamptz
);

alter table public.notiser enable row level security;

-- Listan hämtas alltid som "mina notiser, nyast först".
create index if not exists notiser_mottagare_idx
  on public.notiser (mottagare, skapad desc);

-- Tystnadsfönstret i notis-mejl frågar "har den här personen fått
-- ett mejl av den här typen den senaste timmen".
create index if not exists notiser_mejlad_idx
  on public.notiser (mottagare, typ, mejlad_at);


-- ------------------------------------------------------------
-- 2. RLS
--
-- Mottagaren läser sina egna och får markera dem lästa. Ingen får
-- skapa eller ta bort en notis med sin egen token: raderna skrivs av
-- triggrarna nedan, som kör som security definer. En notis som en
-- användare kan skriva själv är en notis som kan säga vad som helst
-- till vem som helst.
-- ------------------------------------------------------------
drop policy if exists "mottagaren läser sina notiser" on public.notiser;
create policy "mottagaren läser sina notiser" on public.notiser
  for select using (auth.uid() = mottagare);

drop policy if exists "mottagaren markerar sina notiser lästa" on public.notiser;
create policy "mottagaren markerar sina notiser lästa" on public.notiser
  for update using (auth.uid() = mottagare) with check (auth.uid() = mottagare);

drop policy if exists "admin läser alla notiser" on public.notiser;
create policy "admin läser alla notiser" on public.notiser
  for select using (public.is_admin());


-- ------------------------------------------------------------
-- 3. TRIGGRARNA SOM SKRIVER NOTISER
--
-- Alla är security definer med låst search_path. De måste vara det:
-- en studiehjälpare som lägger in en bokning skriver en notis till
-- FÖRÄLDERN, och RLS ovan ger ingen rätt att skriva till någon
-- annan. Definer-rättigheten används bara till insert i notiser och
-- till uppslagen som bygger raden.
--
-- search_path är satt av samma skäl som i migrationen
-- fast_search_path_pa_handle_new_user: en definer-funktion utan låst
-- sökväg kör med anroparens, och då avgör den vilken "students" som
-- menas.
--
-- INGEN AV DEM FÅR FÄLLA SIN EGEN HÄNDELSE. En bokning som inte går
-- igenom för att en notis inte kunde skrivas är ett sämre fel än en
-- notis som uteblir. Därför exception-blocket i varje funktion: det
-- loggar och låter raden gå igenom.
-- ------------------------------------------------------------

-- ---------- bokningar: förslag åt ena hållet, önskemål åt andra ----------
create or replace function public.notis_vid_bokning()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mottagaren uuid;
  sorten     text;
  malet      text;
  avsandaren text;
  elevens    text;
begin
  -- Vem skapade raden, och vem ska alltså veta om den? Den som
  -- bokade har redan sett vad hen gjorde; ett mejl om det är ett
  -- kvitto ingen bett om.
  if new.created_by is null or new.parent_id is null then
    return new;
  end if;

  if new.created_by = new.parent_id then
    -- Familjen önskar en tid. Studiehjälparen ska bekräfta.
    mottagaren := new.tutor_id;
    sorten     := 'pass_onskemal';
    malet      := '#pass-lista';
  else
    -- Studiehjälparen föreslår en tid. Familjen ska svara.
    mottagaren := new.parent_id;
    sorten     := 'pass_forslag';
    malet      := '#pass-lista';
  end if;

  if mottagaren is null or mottagaren = new.created_by then
    return new;
  end if;

  select full_name into avsandaren from public.profiles where id = new.created_by;
  select name into elevens from public.students where id = new.student_id;

  insert into public.notiser (mottagare, typ, mal, data)
  values (mottagaren, sorten, malet, jsonb_strip_nulls(jsonb_build_object(
    'fran',   avsandaren,
    'elev',   elevens,
    'datum',  new.wanted_date,
    'tid',    new.wanted_time,
    'amne',   new.subject,
    'format', new.format,
    'plats',  new.location,
    'langd',  new.duration_min
  )));

  return new;
exception when others then
  raise warning 'notis_vid_bokning: %', sqlerrm;
  return new;
end $$;

drop trigger if exists "notis-bokning" on public.bookings;
create trigger "notis-bokning"
  after insert on public.bookings
  for each row
  when (new.status = 'requested')
  execute function public.notis_vid_bokning();


-- ---------- meddelanden: motparten, aldrig avsändaren ----------
create or replace function public.notis_vid_meddelande()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mottagaren uuid;
  avsandaren text;
begin
  if new.parent_id is null or new.tutor_id is null or new.sender_id is null then
    return new;
  end if;

  mottagaren := case when new.sender_id = new.parent_id then new.tutor_id else new.parent_id end;
  if mottagaren = new.sender_id then
    return new;
  end if;

  select full_name into avsandaren from public.profiles where id = new.sender_id;

  -- new.body skickas MED FLIT inte vidare. Se kommentaren vid
  -- tabellen: notisen säger att något kommit, inte vad som står.
  insert into public.notiser (mottagare, typ, mal, data)
  values (mottagaren, 'meddelande', '#trad',
          jsonb_strip_nulls(jsonb_build_object('fran', avsandaren)));

  return new;
exception when others then
  raise warning 'notis_vid_meddelande: %', sqlerrm;
  return new;
end $$;

drop trigger if exists "notis-meddelande" on public.messages;
create trigger "notis-meddelande"
  after insert on public.messages
  for each row
  execute function public.notis_vid_meddelande();


-- ---------- rapporten efter passet ----------
create or replace function public.notis_vid_rapport()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  foraldern uuid;
  elevens   text;
  amnet     text;
  vem       text;
begin
  select s.parent_id, s.name into foraldern, elevens
    from public.students s where s.id = new.student_id;

  if foraldern is null or foraldern = new.tutor_id then
    return new;
  end if;

  select full_name into vem from public.profiles where id = new.tutor_id;
  select b.subject into amnet from public.bookings b where b.id = new.booking_id;

  -- Varken raw_notes eller ai_feedback följer med. Rapporten är det
  -- mest privata som skrivs i plattformen.
  insert into public.notiser (mottagare, typ, mal, data)
  values (foraldern, 'rapport', '#rapporter', jsonb_strip_nulls(jsonb_build_object(
    'fran',  vem,
    'elev',  elevens,
    'amne',  amnet,
    'datum', new.lesson_date
  )));

  return new;
exception when others then
  raise warning 'notis_vid_rapport: %', sqlerrm;
  return new;
end $$;

drop trigger if exists "notis-rapport" on public.lesson_reports;
create trigger "notis-rapport"
  after insert on public.lesson_reports
  for each row
  execute function public.notis_vid_rapport();


-- ---------- ny uppgift till nästa gång ----------
--
-- Går till förälderns konto, inte till eleven. Det finns ingen
-- elevinloggning: profiles.role är parent, tutor eller admin, och
-- studievyn delas av förälder och elev. Ändras det någon gång är
-- det här raden som ska byta mottagare.
create or replace function public.notis_vid_laxa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  foraldern uuid;
  vem       text;
begin
  select s.parent_id into foraldern from public.students s where s.id = new.student_id;

  if foraldern is null or foraldern = new.tutor_id then
    return new;
  end if;

  select full_name into vem from public.profiles where id = new.tutor_id;

  -- new.instructions stannar i vyn. Titeln räcker för att veta vad
  -- notisen gäller.
  insert into public.notiser (mottagare, typ, mal, data)
  values (foraldern, 'laxa', '#lax-lista', jsonb_strip_nulls(jsonb_build_object(
    'fran',      vem,
    'titel',     new.title,
    'amne',      new.subject,
    'forfaller', new.due_date
  )));

  return new;
exception when others then
  raise warning 'notis_vid_laxa: %', sqlerrm;
  return new;
end $$;

drop trigger if exists "notis-laxa" on public.homework;
create trigger "notis-laxa"
  after insert on public.homework
  for each row
  execute function public.notis_vid_laxa();


-- ------------------------------------------------------------
-- 4. RADEN → MEJLET
--
-- Samma mönster som schema-v25: hemligheten hämtas ur notis_konfig
-- och byggs in i triggerdefinitionen med format(), så att värdet
-- aldrig syns på en skärm och aldrig skrivs av för hand. Det var så
-- NOTIS_HEMLIGHET en gång blev den bokstavliga texten
-- "openssl rand -hex 32".
--
-- Roteras hemligheten (blocket längst ned i schema-v17) byts den här
-- triggern i samma transaktion som de övriga.
-- ------------------------------------------------------------
do $$
declare
  h   text;
  bas text := 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/';
begin
  select hemlighet into strict h from public.notis_konfig where id = 1;

  execute format(
    'create or replace trigger "ny-notis"
       after insert on public.notiser
       for each row
       execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    bas || 'notis-mejl',
    'POST',
    json_build_object('x-nextrum-notis', h)::text,
    '{}',
    '5000'
  );
end $$;


-- ------------------------------------------------------------
-- 5. DE GAMLA TRIGGRARNA BORT
--
-- Måste ske i samma migration som den nya. Ligger båda uppsättningarna
-- kvar får en familj TVÅ mejl om samma föreslagna tid, från två
-- funktioner med olika formgivning. Det är värre än det vi kom ifrån.
--
-- Funktionerna pass-notis och meddelande-notis ligger kvar i repot och
-- i driften, men anropas inte längre av något. De tas bort i ett eget
-- steg när den här uppsättningen har fått gå ett tag — en trigger går
-- att sätta tillbaka på en driftsatt funktion, inte på en raderad.
-- Se DEPLOY-EPOST.md.
-- ------------------------------------------------------------
drop trigger if exists "nytt-passforslag" on public.bookings;
drop trigger if exists "nytt-meddelande" on public.messages;


-- ============================================================
-- EFTERÅT
--
--   select tgname from pg_trigger
--    where tgname in ('notis-bokning','notis-meddelande','notis-rapport',
--                     'notis-laxa','ny-notis');
--   -- fem rader
--
--   select tgname from pg_trigger
--    where tgname in ('nytt-passforslag','nytt-meddelande');
--   -- noll rader
--
-- Ett riktigt prov: skriv ett meddelande i tråden som en av parterna.
--
--   select typ, mottagare, mal, mejlad_at from public.notiser
--    order by skapad desc limit 5;
--
-- mejlad_at satt = mejlet gick iväg. Står den tom kom raden fram men
-- inte mejlet: titta i Edge Functions → notis-mejl → Logs.
-- ============================================================
