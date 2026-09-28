-- ============================================================
-- NEXTRUM — Fas 23.1: uppgifterna blir digitala
--
-- Leo 2026-09-28: läxorna i studievyn ska vara roligare och göras
-- "lite som duolingo, du klarar en nivå och går vidare", i steg och
-- i mobilen, och Min utveckling ska fungera som rättningen av dem.
-- I vyerna heter läxorna uppgifter från och med nu. Tabellen heter
-- fortfarande homework: den har policyer, en trigger och tre vyer
-- som läser den, och ett namnbyte vinner ingenting.
--
-- FYRA TABELLER
--   nivaer        katalogen: en nivå är en kort uppgift, 5–12 frågor,
--                 i en bana per ämne och årskurs. Alla inloggade
--                 läser, bara admin skriver (och generatorn,
--                 verktyg/bygg-uppgifter.py, genom migrationerna).
--   niva_fragor   frågorna MED facit. Familjen läser dem aldrig
--                 direkt: frågorna lämnas ut utan facit av
--                 niva_starta(), och facit först efter ett svar.
--                 Godkända studiehjälpare och admin läser allt.
--   niva_forsok   ett försök på en nivå, med resultatet.
--   niva_svar     varje svar i ett försök, rättat.
--   De två sista skrivs BARA av funktionerna nedan. Ingen
--   skrivpolicy, med flit: ett resultat som går att skriva från en
--   vy är ett påstående, inte en rättning. Samma regel som
--   betalningen, där beloppet räknas i funktionen och aldrig i
--   anropet.
--
-- RÄTTNINGEN SKER HÄR, INTE I WEBBLÄSAREN
-- Facit är inte hemligt för den som svarar fel: då visas rätt svar,
-- som i Duolingo, och frågan kommer tillbaka sist i nivån. Poängen
-- är att ett resultat som står i Min utveckling och hos
-- studiehjälparen har räknats av databasen.
--
-- EN NIVÅ ÄR KLAR när varje fråga har besvarats rätt en gång. Fel
-- svar kommer tillbaka tills de är rätt. Betyget räknas bara på
-- FÖRSTA svaret på varje fråga:
--   3 stjärnor  allt rätt direkt
--   2 stjärnor  minst 80 procent rätt direkt
--   1 stjärna   minst 60 procent rätt direkt
--   0           under 60 procent: nivån räknas inte som klarad,
--               och nästa nivå låses inte upp
-- Gränserna står här och i STJÄRNOR i nextrum-uppgifter.js, som bara
-- förklarar dem. Ändras den ena ska den andra ändras.
--
-- UPPLÅSNINGEN ÄR EN SPELREGEL, INTE ETT SKYDD. Vilken nivå som är
-- öppen räknas i nextrum-uppgifter.js. niva_starta() prövar bara att
-- eleven är ens egen och att nivån finns; den som startar en låst
-- nivå genom API:t har bara hoppat fram i sitt eget spel.
--
-- EN DIGITAL UPPGIFT (homework.niva_id) blir påbörjad när nivån
-- startas och klar när den klaras, av databasen. Familjen kan inte
-- bocka av den för hand: skydda_laxa nekar det, och släpper bara
-- igenom ändringen när den kommer från rättningen
-- (nextrum.niva_rattning, satt i transaktionen). Studiehjälparen och
-- admin kan fortfarande ändra läget.
--
-- skydda_laxa lät dessutom familjen skriva om bibliotek_id, och
-- policyn "familj läser bibliotek via läxa" gav dem då läsrätt till
-- vilket material som helst vars id de kände till. Nu låses
-- bibliotek_id och niva_id som resten av läxan.
-- ============================================================

-- ---------- katalogen ----------
create table if not exists public.nivaer (
  id           uuid primary key,
  nyckel       text not null unique check (nyckel ~ '^[a-z0-9-]{3,80}$'),
  amne         text not null check (length(btrim(amne)) between 1 and 80),
  arskurs      text not null check (arskurs in (
                 'ak1','ak2','ak3','ak4','ak5','ak6','ak7','ak8','ak9',
                 'gy1','gy2','gy3')),
  omrade       text not null check (length(btrim(omrade)) between 1 and 80),
  titel        text not null check (length(btrim(titel)) between 1 and 120),
  beskrivning  text check (beskrivning is null or length(beskrivning) <= 400),
  ordning      integer not null,
  antal_fragor smallint not null default 0,
  aktiv        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.nivaer is
  'De digitala uppgifterna (Fas 23.1): en nivå per rad, i en bana per ämne och '
  'årskurs. Id:t är ett uuid5 ur nyckeln, satt av verktyg/bygg-uppgifter.py.';
comment on column public.nivaer.omrade is
  'Kunskapsområdet, som Bråk. Samma namn som progress_items.area när '
  'studiehjälparen bedömt området, så att Min utveckling kan ställa dem bredvid varandra.';
comment on column public.nivaer.antal_fragor is
  'Antalet aktiva frågor. Räknas av triggern niva_fragor_antal, skrivs aldrig för hand.';

create index if not exists nivaer_bana on public.nivaer (amne, arskurs, ordning) where aktiv;

alter table public.nivaer enable row level security;
revoke all on public.nivaer from anon;

drop policy if exists "inloggade läser nivåerna" on public.nivaer;
create policy "inloggade läser nivåerna" on public.nivaer
  for select to authenticated using (true);

drop policy if exists "admin sköter nivåerna" on public.nivaer;
create policy "admin sköter nivåerna" on public.nivaer
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- frågorna, med facit ----------
-- alternativ: val → svarsalternativen; ordna → extra brickor som inte
-- hör till svaret (får vara null). ratt: val → index i alternativen;
-- skriv → de svar som godtas; ordna → brickorna i rätt ordning.
create table if not exists public.niva_fragor (
  id          uuid primary key,
  niva_id     uuid not null references public.nivaer(id) on delete cascade,
  ordning     integer not null,
  typ         text not null check (typ in ('val', 'skriv', 'ordna')),
  fraga       text not null check (length(btrim(fraga)) between 1 and 600),
  alternativ  jsonb,
  ratt        jsonb not null,
  forklaring  text check (forklaring is null or length(forklaring) <= 600),
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint niva_fragor_formen check (
    case typ
      when 'val' then
        coalesce(jsonb_typeof(alternativ) = 'array', false)
        and jsonb_array_length(alternativ) between 2 and 5
        and jsonb_typeof(ratt) = 'number'
        and (ratt #>> '{}') ~ '^[0-9]$'
        and (ratt #>> '{}')::int < jsonb_array_length(alternativ)
      when 'skriv' then
        jsonb_typeof(ratt) = 'array' and jsonb_array_length(ratt) between 1 and 12
      else
        jsonb_typeof(ratt) = 'array' and jsonb_array_length(ratt) between 2 and 14
        and (alternativ is null or jsonb_typeof(alternativ) = 'array')
    end)
);

comment on table public.niva_fragor is
  'Frågorna till nivåerna, med facit (Fas 23.1). Id:t är ett uuid5 ur nivån och '
  'frågans innehåll: en fråga som ändras får ett nytt id, och den gamla står kvar '
  'som inaktiv så att gamla svar fortfarande pekar på det som frågades.';

create index if not exists niva_fragor_niva on public.niva_fragor (niva_id, ordning) where aktiv;

alter table public.niva_fragor enable row level security;
revoke all on public.niva_fragor from anon;

drop policy if exists "admin sköter frågorna" on public.niva_fragor;
create policy "admin sköter frågorna" on public.niva_fragor
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Studiehjälparen ser frågorna och facit innan hen ger nivån som
-- uppgift. Familjen har ingen policy alls.
drop policy if exists "godkänd studiehjälpare läser frågorna" on public.niva_fragor;
create policy "godkänd studiehjälpare läser frågorna" on public.niva_fragor
  for select to authenticated using (public.ar_godkand_studiehjalpare());

-- antal_fragor följer frågorna. Utan triggern hade en fråga som lagts
-- till för hand i Table Editor gjort talet i banan fel utan att något
-- blev rött.
create or replace function intern.niva_fragor_antal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_niva uuid;
begin
  foreach v_niva in array array[
    case when tg_op <> 'INSERT' then old.niva_id end,
    case when tg_op <> 'DELETE' then new.niva_id end]
  loop
    if v_niva is not null then
      update public.nivaer n
         set antal_fragor = (select count(*) from public.niva_fragor f
                              where f.niva_id = v_niva and f.aktiv)
       where n.id = v_niva;
    end if;
  end loop;
  return null;
end $$;

revoke execute on function intern.niva_fragor_antal() from public, anon, authenticated;

drop trigger if exists niva_fragor_antal on public.niva_fragor;
create trigger niva_fragor_antal
  after insert or update or delete on public.niva_fragor
  for each row execute function intern.niva_fragor_antal();

-- ---------- försöken och svaren ----------
create table if not exists public.niva_forsok (
  id           uuid primary key default gen_random_uuid(),
  niva_id      uuid not null references public.nivaer(id) on delete restrict,
  student_id   uuid not null references public.students(id) on delete cascade,
  -- Frågorna i försöket, i den ordning de ställs. Ändras nivån medan
  -- ett försök pågår gäller försökets egna frågor.
  fragor       uuid[] not null check (cardinality(fragor) between 1 and 40),
  startad_av   uuid references public.profiles(id) on delete set null,
  startad_at   timestamptz not null default now(),
  klar_at      timestamptz,
  antal        smallint,
  ratt_direkt  smallint,
  stjarnor     smallint check (stjarnor between 0 and 3),
  godkand      boolean,
  constraint niva_forsok_klar_har_resultat check (
    klar_at is null
    or (antal is not null and ratt_direkt is not null and stjarnor is not null and godkand is not null))
);

comment on table public.niva_forsok is
  'Ett försök på en nivå (Fas 23.1). Skrivs bara av niva_starta() och niva_svara(). '
  'ratt_direkt är antalet frågor som var rätt på första svaret; det är betyget.';

create index if not exists niva_forsok_elev on public.niva_forsok (student_id, startad_at desc);
create index if not exists niva_forsok_niva on public.niva_forsok (niva_id);

create table if not exists public.niva_svar (
  id           bigint generated always as identity primary key,
  forsok_id    uuid not null references public.niva_forsok(id) on delete cascade,
  fraga_id     uuid not null references public.niva_fragor(id) on delete restrict,
  svar         jsonb not null check (length(svar::text) <= 2000),
  ratt         boolean not null,
  forsta       boolean not null,
  besvarad_at  timestamptz not null default now()
);

comment on table public.niva_svar is
  'Varje svar i ett försök, rättat av niva_svara() (Fas 23.1). forsta = det första '
  'svaret på frågan i försöket, det enda som räknas i betyget.';

create index if not exists niva_svar_forsok on public.niva_svar (forsok_id, fraga_id);

alter table public.niva_forsok enable row level security;
alter table public.niva_svar enable row level security;
revoke all on public.niva_forsok, public.niva_svar from anon;
revoke insert, update, delete, truncate on public.niva_forsok, public.niva_svar from authenticated;

drop policy if exists "familjen läser sitt barns försök" on public.niva_forsok;
create policy "familjen läser sitt barns försök" on public.niva_forsok
  for select to authenticated using (exists (
    select 1 from public.students s
     where s.id = niva_forsok.student_id and s.parent_id = auth.uid()));

drop policy if exists "studiehjälparen läser sin elevs försök" on public.niva_forsok;
create policy "studiehjälparen läser sin elevs försök" on public.niva_forsok
  for select to authenticated using (public.is_my_student(student_id));

drop policy if exists "admin läser försöken" on public.niva_forsok;
create policy "admin läser försöken" on public.niva_forsok
  for select to authenticated using (public.is_admin());

drop policy if exists "familjen läser sitt barns svar" on public.niva_svar;
create policy "familjen läser sitt barns svar" on public.niva_svar
  for select to authenticated using (exists (
    select 1 from public.niva_forsok f
      join public.students s on s.id = f.student_id
     where f.id = niva_svar.forsok_id and s.parent_id = auth.uid()));

drop policy if exists "studiehjälparen läser sin elevs svar" on public.niva_svar;
create policy "studiehjälparen läser sin elevs svar" on public.niva_svar
  for select to authenticated using (exists (
    select 1 from public.niva_forsok f
     where f.id = niva_svar.forsok_id and public.is_my_student(f.student_id)));

drop policy if exists "admin läser svaren" on public.niva_svar;
create policy "admin läser svaren" on public.niva_svar
  for select to authenticated using (public.is_admin());

-- ---------- uppgiften pekar på en nivå ----------
alter table public.homework
  add column if not exists niva_id uuid references public.nivaer(id) on delete set null;

comment on column public.homework.niva_id is
  'Den digitala nivån uppgiften går ut på (Fas 23.1). Blir påbörjad och klar av '
  'rättningen i databasen; familjen bockar inte av den för hand.';

create index if not exists homework_niva on public.homework (student_id, niva_id) where niva_id is not null;

create or replace function public.skydda_laxa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Satt av niva_starta() och niva_svara() i samma transaktion.
  v_rattning boolean := coalesce(current_setting('nextrum.niva_rattning', true), '') = '1';
begin
  if public.is_admin() or auth.uid() = old.tutor_id or auth.uid() is null then
    if new.status = 'klar' and old.status is distinct from 'klar' then
      new.completed_at := now();
    elsif new.status <> 'klar' then
      new.completed_at := null;
    end if;
    return new;
  end if;

  -- familjen: bara status
  new.id           := old.id;
  new.student_id   := old.student_id;
  new.tutor_id     := old.tutor_id;
  new.title        := old.title;
  new.instructions := old.instructions;
  new.subject      := old.subject;
  new.due_date     := old.due_date;
  new.created_at   := old.created_at;
  new.bibliotek_id := old.bibliotek_id;
  new.niva_id      := old.niva_id;

  if old.niva_id is not null and new.status is distinct from old.status and not v_rattning then
    raise exception 'En digital uppgift blir klar när nivån är klarad, inte med en bock.'
      using errcode = '42501';
  end if;

  if new.status = 'klar' and old.status is distinct from 'klar' then
    new.completed_at := now();
  elsif new.status <> 'klar' then
    new.completed_at := null;
  else
    new.completed_at := old.completed_at;
  end if;

  return new;
end $$;

-- ---------- rättningen ----------
-- Svaret som text: gemener, ett mellanslag i taget, inga skiljetecken
-- sist, och de streck och apostrofer telefonen byter ut av sig själv
-- tillbaka till de vanliga. "Went." och "went" är samma svar.
create or replace function intern.niva_norm(t text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(btrim(coalesce(t, ''))), '−–—’‘´`', '---' || repeat(chr(39), 4)),
             '\s+', ' ', 'g'),
           '[.!]+$', ''))
$$;

-- Svaret som tal, eller null. Mellanslag mellan siffror är
-- tusentalsavgränsare, och decimalkomma och decimalpunkt är samma sak.
--
-- ENHETEN RÄTTAS INTE, men bara åt ett håll. Med p_enhet får talet ha
-- en enhet efter sig, högst två ord ("12 cm", "100 grader", "30 Ω",
-- "5 grader celsius"; Ω blir ω av lower()); det gäller elevens svar. Facit
-- läses UTAN (p_enhet = false): bara ett rent tal, med ett procenttecken
-- som enda tillägg, jämförs som tal. Annars hade facit "5y" till
-- "Förenkla 7y − 2y" lästs som talet 5 med enheten y, och både "5" och
-- "5x" hade rättats som rätt. Ett facit med bokstäver jämförs som text.
create or replace function intern.niva_tal(t text, p_enhet boolean default true)
returns numeric
language plpgsql
immutable
as $$
declare
  m text[];
begin
  t := regexp_replace(regexp_replace(t, '(\d) (\d)', '\1\2', 'g'), '(\d) (\d)', '\1\2', 'g');
  if p_enhet then
    m := regexp_match(t, '^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(?:%|[a-zåäö²³°ω]{1,12}\.?(?: [a-zåäö²³°ω]{1,12}\.?)?)?$');
  else
    m := regexp_match(t, '^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*%?$');
  end if;
  if m is null then
    return null;
  end if;
  return replace(m[1], ',', '.')::numeric;
exception when others then
  return null;
end $$;

create or replace function intern.niva_lika(p_facit text, p_svar text)
returns boolean
language plpgsql
immutable
as $$
declare
  a text := intern.niva_norm(p_facit);
  b text := intern.niva_norm(p_svar);
  ta numeric;
  tb numeric;
begin
  if b = '' then
    return false;
  end if;
  if a = b then
    return true;
  end if;
  ta := intern.niva_tal(a, false);
  tb := intern.niva_tal(b, true);
  return ta is not null and tb is not null and ta = tb;
end $$;

create or replace function intern.niva_ratta(q public.niva_fragor, p_svar jsonb)
returns boolean
language plpgsql
stable
as $$
declare
  v    text;
  gavs text[];
  ska  text[];
begin
  if q.typ = 'val' then
    v := p_svar ->> 'val';
    return coalesce(v ~ '^[0-9]$' and v::int = (q.ratt #>> '{}')::int, false);
  elsif q.typ = 'skriv' then
    v := p_svar ->> 'text';
    if v is null or length(v) > 200 then
      return false;
    end if;
    return exists (select 1 from jsonb_array_elements_text(q.ratt) a where intern.niva_lika(a, v));
  elsif q.typ = 'ordna' then
    if coalesce(jsonb_typeof(p_svar -> 'ordning'), '') <> 'array' then
      return false;
    end if;
    select array_agg(btrim(x) order by n) into gavs
      from jsonb_array_elements_text(p_svar -> 'ordning') with ordinality y(x, n);
    select array_agg(btrim(x) order by n) into ska
      from jsonb_array_elements_text(q.ratt) with ordinality y(x, n);
    return coalesce(gavs = ska, false);
  end if;
  return false;
end $$;

-- Frågan som den lämnas ut: utan facit. Brickorna i en ordna-fråga
-- blandas här, för i tabellen står de i rätt ordning.
create or replace function intern.niva_fraga_ut(q public.niva_fragor)
returns jsonb
language plpgsql
volatile
as $$
declare
  brickor jsonb;
  varv    int := 0;
begin
  if q.typ = 'val' then
    return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga, 'alternativ', q.alternativ);
  elsif q.typ = 'skriv' then
    -- Sifferknappsatsen bara när varje godtaget svar är ett tal utan
    -- minustecken: iPhones decimaltangentbord saknar minus.
    return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga,
      'numerisk', not exists (
        select 1 from jsonb_array_elements_text(q.ratt) a
         where intern.niva_tal(intern.niva_norm(a), false) is null or intern.niva_norm(a) like '-%'));
  end if;
  loop
    select jsonb_agg(b order by random()) into brickor
      from jsonb_array_elements(q.ratt || coalesce(q.alternativ, '[]'::jsonb)) b;
    varv := varv + 1;
    exit when brickor is distinct from q.ratt or varv >= 6;
  end loop;
  return jsonb_build_object('id', q.id, 'typ', q.typ, 'fraga', q.fraga, 'brickor', brickor);
end $$;

-- Rätt svar som det visas efter ett svar: indexet för val, det
-- första godtagna svaret för skriv, brickorna för ordna.
create or replace function intern.niva_facit(q public.niva_fragor)
returns jsonb
language sql
immutable
as $$
  select case q.typ
           when 'val' then q.ratt
           when 'skriv' then to_jsonb(q.ratt ->> 0)
           else q.ratt
         end
$$;

revoke execute on function intern.niva_norm(text), intern.niva_tal(text, boolean), intern.niva_lika(text, text),
  intern.niva_ratta(public.niva_fragor, jsonb), intern.niva_fraga_ut(public.niva_fragor),
  intern.niva_facit(public.niva_fragor)
  from public, anon, authenticated;

-- ---------- starta en nivå ----------
-- Fortsätter ett påbörjat försök från det senaste dygnet: ett barn som
-- blir avbrutet mitt i nivån i mobilen ska inte börja om.
create or replace function public.niva_starta(p_niva uuid, p_elev uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_niva   public.nivaer;
  v_forsok public.niva_forsok;
  v_fragor uuid[];
  v_idag   int;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid()) then
    raise exception 'Eleven hör inte till ert konto.' using errcode = '42501';
  end if;

  select * into v_niva from public.nivaer where id = p_niva and aktiv;
  if not found then
    raise exception 'Nivån finns inte längre.' using errcode = 'P0002';
  end if;

  select * into v_forsok from public.niva_forsok
   where niva_id = p_niva and student_id = p_elev and klar_at is null
     and startad_at > now() - interval '1 day'
   order by startad_at desc
   limit 1;

  if not found then
    -- Ett tak, så att en slinga inte kan fylla tabellen. Ett barn som
    -- gör hundra nivåer på ett dygn har redan gjort tillräckligt.
    select count(*) into v_idag from public.niva_forsok
     where student_id = p_elev and startad_at > now() - interval '1 day';
    if v_idag >= 100 then
      raise exception 'Det har blivit väldigt många nivåer i dag. Ta en paus och fortsätt i morgon.'
        using errcode = '54000';
    end if;

    select array_agg(f.id order by f.ordning, f.id) into v_fragor
      from public.niva_fragor f where f.niva_id = p_niva and f.aktiv;
    if v_fragor is null then
      raise exception 'Nivån har inga frågor än.' using errcode = 'P0002';
    end if;

    insert into public.niva_forsok (niva_id, student_id, fragor, startad_av)
    values (p_niva, p_elev, v_fragor, auth.uid())
    returning * into v_forsok;

    perform set_config('nextrum.niva_rattning', '1', true);
    update public.homework set status = 'pagaende'
     where student_id = p_elev and niva_id = p_niva and status = 'ej_paborjad';
    perform set_config('nextrum.niva_rattning', '', true);
  end if;

  return jsonb_build_object(
    'forsok', v_forsok.id,
    'niva', jsonb_build_object('id', v_niva.id, 'titel', v_niva.titel, 'amne', v_niva.amne,
                               'omrade', v_niva.omrade, 'arskurs', v_niva.arskurs),
    'fragor', (select jsonb_agg(intern.niva_fraga_ut(f) order by u.nr)
                 from unnest(v_forsok.fragor) with ordinality u(id, nr)
                 join public.niva_fragor f on f.id = u.id),
    'klara', (select coalesce(jsonb_agg(distinct s.fraga_id), '[]'::jsonb)
                from public.niva_svar s where s.forsok_id = v_forsok.id and s.ratt));
end $$;

-- ---------- svara ----------
-- Rättar ett svar och sparar det. När varje fråga i försöket har ett
-- rätt svar är nivån klar: betyget räknas på de första svaren, och
-- uppgifterna som pekar på nivån blir klara om den klarades.
--
-- Samma svar två gånger (ett dubbeltryck, ett nät som försökte igen)
-- ger samma besked utan en ny rad, också efter att nivån blivit klar.
create or replace function public.niva_svara(p_forsok uuid, p_fraga uuid, p_svar jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f         public.niva_forsok;
  q         public.niva_fragor;
  v_ratt    boolean;
  v_forsta  boolean;
  v_klar    boolean;
  v_direkt  int;
  v_antal   int;
  v_stj     int;
  v_forut   int;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;

  select * into f from public.niva_forsok where id = p_forsok for update;
  if not found or not exists (
      select 1 from public.students s where s.id = f.student_id and s.parent_id = auth.uid()) then
    raise exception 'Försöket hör inte till ert konto.' using errcode = '42501';
  end if;
  if not (p_fraga = any (f.fragor)) then
    raise exception 'Frågan hör inte till nivån.' using errcode = '22023';
  end if;
  if p_svar is null or length(p_svar::text) > 2000 then
    raise exception 'Svaret är för långt.' using errcode = '22023';
  end if;

  select * into q from public.niva_fragor where id = p_fraga;

  if f.klar_at is not null
     or exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id and ratt) then
    v_ratt := exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id and ratt);
  else
    if (select count(*) from public.niva_svar where forsok_id = f.id) >= cardinality(f.fragor) * 10 then
      raise exception 'Det har blivit för många svar på den här nivån. Börja om den.' using errcode = '54000';
    end if;
    v_ratt := intern.niva_ratta(q, p_svar);
    v_forsta := not exists (select 1 from public.niva_svar where forsok_id = f.id and fraga_id = q.id);
    insert into public.niva_svar (forsok_id, fraga_id, svar, ratt, forsta)
    values (f.id, q.id, p_svar, v_ratt, v_forsta);
  end if;

  if f.klar_at is null then
    select count(distinct fraga_id) = cardinality(f.fragor) into v_klar
      from public.niva_svar where forsok_id = f.id and ratt;

    if v_klar then
      v_antal := cardinality(f.fragor);
      select count(*) into v_direkt from public.niva_svar where forsok_id = f.id and forsta and ratt;
      v_stj := case when v_direkt = v_antal then 3
                    when v_direkt * 5 >= v_antal * 4 then 2
                    when v_direkt * 5 >= v_antal * 3 then 1
                    else 0 end;
      update public.niva_forsok
         set klar_at = clock_timestamp(), antal = v_antal, ratt_direkt = v_direkt,
             stjarnor = v_stj, godkand = v_stj >= 1
       where id = f.id
       returning * into f;

      if v_stj >= 1 then
        perform set_config('nextrum.niva_rattning', '1', true);
        update public.homework set status = 'klar'
         where student_id = f.student_id and niva_id = f.niva_id and status <> 'klar';
        perform set_config('nextrum.niva_rattning', '', true);
      end if;
    end if;
  else
    v_klar := true;
  end if;

  if v_klar then
    select coalesce(max(stjarnor), 0) into v_forut from public.niva_forsok
     where student_id = f.student_id and niva_id = f.niva_id and klar_at is not null
       and id <> f.id and klar_at < f.klar_at;
  end if;

  return jsonb_build_object(
    'ratt', v_ratt,
    'facit', intern.niva_facit(q),
    'forklaring', q.forklaring,
    'klar', v_klar,
    'resultat', case when v_klar then jsonb_build_object(
        'antal', f.antal, 'ratt_direkt', f.ratt_direkt, 'stjarnor', f.stjarnor,
        'godkand', f.godkand, 'forut', v_forut, 'klar_at', f.klar_at) end);
end $$;

-- ---------- genomgången ----------
-- Ett klart försök fråga för fråga: vad som frågades, vad eleven
-- svarade, rätt svar och förklaringen. Det är rättningen familjen och
-- studiehjälparen läser i Min utveckling och på uppgiften. Bara klara
-- försök: facit till en fråga eleven inte kommit till än lämnas inte ut.
create or replace function public.niva_genomgang(p_forsok uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  f public.niva_forsok;
  n public.nivaer;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  select * into f from public.niva_forsok where id = p_forsok;
  if not found or not (
       exists (select 1 from public.students s where s.id = f.student_id and s.parent_id = auth.uid())
       or public.is_my_student(f.student_id)
       or public.is_admin()) then
    raise exception 'Försöket finns inte, eller hör inte till er.' using errcode = '42501';
  end if;
  if f.klar_at is null then
    raise exception 'Nivån är inte klar än.' using errcode = '22023';
  end if;
  select * into n from public.nivaer where id = f.niva_id;

  return jsonb_build_object(
    'forsok', jsonb_build_object('id', f.id, 'startad_at', f.startad_at, 'klar_at', f.klar_at,
                                 'antal', f.antal, 'ratt_direkt', f.ratt_direkt,
                                 'stjarnor', f.stjarnor, 'godkand', f.godkand),
    'niva', jsonb_build_object('id', n.id, 'titel', n.titel, 'amne', n.amne,
                               'omrade', n.omrade, 'arskurs', n.arskurs),
    'fragor', (select jsonb_agg(jsonb_build_object(
                   'nr', u.nr, 'typ', q.typ, 'fraga', q.fraga,
                   'alternativ', case when q.typ = 'val' then q.alternativ end,
                   'facit', intern.niva_facit(q), 'forklaring', q.forklaring,
                   'svar', (select coalesce(jsonb_agg(jsonb_build_object('svar', s.svar, 'ratt', s.ratt)
                                                      order by s.besvarad_at, s.id), '[]'::jsonb)
                              from public.niva_svar s where s.forsok_id = f.id and s.fraga_id = q.id))
                 order by u.nr)
                 from unnest(f.fragor) with ordinality u(id, nr)
                 join public.niva_fragor q on q.id = u.id));
end $$;

revoke execute on function public.niva_starta(uuid, uuid), public.niva_svara(uuid, uuid, jsonb),
  public.niva_genomgang(uuid) from public, anon;
grant execute on function public.niva_starta(uuid, uuid), public.niva_svara(uuid, uuid, jsonb),
  public.niva_genomgang(uuid) to authenticated;

comment on function public.niva_starta(uuid, uuid) is
  'Startar eller fortsätter en nivå för ett av familjens barn och lämnar ut frågorna utan facit (Fas 23.1).';
comment on function public.niva_svara(uuid, uuid, jsonb) is
  'Rättar ett svar i databasen och avslutar nivån när allt är rätt besvarat (Fas 23.1).';
comment on function public.niva_genomgang(uuid) is
  'Ett klart försök fråga för fråga, med svaren och facit, för familjen, studiehjälparen och admin (Fas 23.1).';
