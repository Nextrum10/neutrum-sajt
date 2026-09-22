-- ============================================================
-- NEXTRUM — program 2, Fas 2.1: notisernas grund
--
-- I dag går inget mejl alls vid bokning, flytt, bekräftelse eller
-- avbokning. De två webhookarna som skulle göra det har aldrig körts i
-- driften: nytt-passforslag kräver en insert från studiehjälparen, som
-- vyn inte längre gör, och nytt-meddelande har inte haft något
-- meddelande att reagera på sedan den kom till. I vyerna räknas
-- "notiser" i webbläsaren ur det som råkar vara hämtat, och ingenting
-- minns vad som är läst.
--
-- Den här migrationen lägger grunden, utan triggrar (2.2) och utan
-- arbetare (2.3):
--
--   notiser           det användaren ser i appen, med oläst-markering.
--   notis_val         vad användaren vill ha som mejl och SMS, per typ.
--                     Bara avvikelser från förvalet lagras.
--   notis_utskick     kön för mejl och SMS.
--   notis_installning det som gäller för alla: påminnelsetider och hur
--                     länge ett chattmejl väntar på fler meddelanden.
--                     Alla inloggade får läsa den.
--   notis_drift       det som bara admin ska se: sandlådeadressen och
--                     SMS-läget och dygnstaket.
--   notis_fel         när en notis inte gick att skapa. Triggrarna får
--                     aldrig fälla en bokning, men ett fel som bara
--                     blev en varning i loggen hade ingen sett.
--   notis_korningar   varje gång arbetaren körts, så att en tyst cron
--                     syns i adminvyn.
--
-- VARFÖR NOTIS_VAL INTE LIGGER I PROFILES: profilen läses av
-- motparten. Vad någon vill ha som SMS ska ingen annan se.
--
-- INGEN BRÖDTEXT, NÅGONSIN. En notis bär typ, koppling och ett litet
-- data-fält med datum, tid, ämne och förnamn. Aldrig meddelandets text,
-- rapportens anteckningar, en plats eller en anteckning från bokningen.
--
-- NAMNEN ÄR NYA med flit. notis-ko och notis-avanmal i driften väntar
-- på notis_ko, notis_hamta, notis_klar, notis_avanmal och kolumnerna
-- lage och avanmal_nyckel. Inget av det skapas här.
--
-- STANDARDRÄTTIGHETERNA i public ger anon och authenticated allt på nya
-- tabeller och EXECUTE på nya funktioner. Varje objekt nedan drar in
-- dem uttryckligen och ger sedan tillbaka exakt det som behövs.
-- ============================================================

-- ---------- ett klockslag är ett klockslag ----------

-- Påminnelserna räknar ut när passet börjar ur wanted_time, som är
-- fritext utan villkor. En enda rad med 'efter skolan' hade fällt
-- hela körningen för alla. Alla rader i driften följer formatet.
alter table public.bookings
  drop constraint if exists bookings_tid_format;
alter table public.bookings
  add constraint bookings_tid_format check (wanted_time is null or wanted_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ---------- typerna ----------

-- Typerna står på ett ställe, så att triggrarna, valen, kön och
-- mallarna är överens. Ingen CHECK på tabellerna: en CHECK som anropar
-- en funktion körs som anroparen (CLAUDE.md), och typerna skrivs bara
-- av databasens egna funktioner.
create or replace function public.notis_typer()
returns text[] language sql immutable set search_path = public as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'rapport', 'paminnelse']
$$;

-- De typer som kan bli mejl. Leo räknade upp bokning, ändring,
-- avbokning, påminnelse och chatt; en ny rapport syns bara i appen.
create or replace function public.notis_mejlbara()
returns text[] language sql immutable set search_path = public as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'paminnelse']
$$;

revoke execute on function public.notis_typer() from public, anon;
revoke execute on function public.notis_mejlbara() from public, anon;
grant execute on function public.notis_typer() to authenticated;
grant execute on function public.notis_mejlbara() to authenticated;

-- ---------- flaggorna ----------

insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('notiser_mejl', false,
   'Mejl till familjer och studiehjälpare vid nytt pass, flytt, bekräftelse, avbokning, nya chattmeddelanden och påminnelser. Av betyder att allt köas och syns i adminvyn men att inget går till dem. En sandlådeadress kan ta emot allt under tiden.',
   'DKIM för resend._domainkey ska vara rättad (DEPLOY-EPOST.md, avsnitt 1) och ett provmejl ska ha kommit fram med DKIM PASS. Integritetspolicyn ska nämna e-postleverantören. Beslut om avsändare och svarsadress.'),
  ('notiser_sms', false,
   'SMS-påminnelser före ett pass, till den som själv slagit på det. Leverantören är 46elks. Även på skickas inget förrän SMS-läget i adminvyn är satt till skicka; förvalet är prov, som bara räknar kostnaden.',
   'Leo ska ha godkänt leverantör, budget och dygnstak. API-nyckeln ska vara satt som secret. Integritetspolicyn ska nämna telefonnumret, ändamålet och SMS-leverantören. Rättslig grund och SMS till studiehjälpare under 18 ska vara bedömda av jurist.')
on conflict (kod) do nothing;

-- ---------- inställningarna ----------

create table if not exists public.notis_installning (
  id                  smallint primary key default 1 check (id = 1),
  paminnelser_timmar  int[] not null default '{24,1}',
  chatt_samla_minuter int not null default 10,
  pass_samla_minuter  int not null default 3,
  uppdaterad          timestamptz not null default now(),
  uppdaterad_av       uuid references public.profiles(id) on delete set null
);

alter table public.notis_installning
  drop constraint if exists notis_installning_timmar_check;
alter table public.notis_installning
  add constraint notis_installning_timmar_check check (
    cardinality(paminnelser_timmar) <= 4
    and 1 <= all(paminnelser_timmar) and 168 >= all(paminnelser_timmar));
alter table public.notis_installning
  drop constraint if exists notis_installning_minuter_check;
alter table public.notis_installning
  add constraint notis_installning_minuter_check check (
    chatt_samla_minuter between 1 and 180 and pass_samla_minuter between 0 and 60);

comment on table public.notis_installning is
  'Gäller alla. paminnelser_timmar: timmar före passet en påminnelse går (tom = inga). chatt_samla_minuter: '
  'hur länge ett chattmejl väntar så att fler meddelanden i tråden blir ett mejl. pass_samla_minuter: samma '
  'sak för ändringar i ett och samma pass, så att flytt och bekräftelse strax efter blir ett mejl.';

insert into public.notis_installning (id) values (1) on conflict (id) do nothing;

alter table public.notis_installning enable row level security;
revoke all on public.notis_installning from anon, authenticated;
grant select on public.notis_installning to authenticated;
grant update (paminnelser_timmar, chatt_samla_minuter, pass_samla_minuter) on public.notis_installning to authenticated;

drop policy if exists "inloggade läser notisinställningen" on public.notis_installning;
create policy "inloggade läser notisinställningen" on public.notis_installning
  for select to authenticated using (true);

drop policy if exists "admin ändrar notisinställningen" on public.notis_installning;
create policy "admin ändrar notisinställningen" on public.notis_installning
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.notis_drift (
  id               smallint primary key default 1 check (id = 1),
  mejl_sandlada    text check (mejl_sandlada is null or mejl_sandlada ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  sms_lage         text not null default 'prov' check (sms_lage in ('prov', 'skicka')),
  sms_tak_per_dygn int not null default 50 check (sms_tak_per_dygn between 0 and 5000),
  uppdaterad       timestamptz not null default now(),
  uppdaterad_av    uuid references public.profiles(id) on delete set null
);

comment on table public.notis_drift is
  'Bara admin. mejl_sandlada: när flaggan notiser_mejl är av går varje mejl hit i stället för till mottagaren, '
  'så att hela vägen kan provas på riktiga händelser. Tomt = inget skickas. sms_lage prov = 46elks dryrun, '
  'inget skickas och inget kostar. sms_tak_per_dygn: fler SMS än så ett dygn hoppas över.';

insert into public.notis_drift (id) values (1) on conflict (id) do nothing;

alter table public.notis_drift enable row level security;
revoke all on public.notis_drift from anon, authenticated;
grant select on public.notis_drift to authenticated;
grant update (mejl_sandlada, sms_lage, sms_tak_per_dygn) on public.notis_drift to authenticated;

drop policy if exists "admin läser notisdriften" on public.notis_drift;
create policy "admin läser notisdriften" on public.notis_drift
  for select to authenticated using (public.is_admin());

drop policy if exists "admin ändrar notisdriften" on public.notis_drift;
create policy "admin ändrar notisdriften" on public.notis_drift
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.stampla_notisraden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id            := old.id;
  new.uppdaterad    := now();
  new.uppdaterad_av := auth.uid();
  return new;
end $$;

revoke execute on function public.stampla_notisraden() from public, anon, authenticated;

drop trigger if exists notis_installning_stampla on public.notis_installning;
create trigger notis_installning_stampla before update on public.notis_installning
  for each row execute function public.stampla_notisraden();
drop trigger if exists notis_drift_stampla on public.notis_drift;
create trigger notis_drift_stampla before update on public.notis_drift
  for each row execute function public.stampla_notisraden();

-- Auditen tar med läget och taket, inte sandlådeadressen (en e-post).
drop trigger if exists notis_installning_audit on public.notis_installning;
create trigger notis_installning_audit
  after update of paminnelser_timmar, chatt_samla_minuter, pass_samla_minuter on public.notis_installning
  for each row execute function public.logga_andring('notisinstallning', 'paminnelser_timmar', 'chatt_samla_minuter', 'pass_samla_minuter');
drop trigger if exists notis_drift_audit on public.notis_drift;
create trigger notis_drift_audit after update of sms_lage, sms_tak_per_dygn, mejl_sandlada on public.notis_drift
  for each row execute function public.logga_andring('notisdrift', 'sms_lage', 'sms_tak_per_dygn');

-- ---------- notiser ----------

create table if not exists public.notiser (
  id          uuid primary key default gen_random_uuid(),
  mottagare   uuid not null references public.profiles(id) on delete cascade,
  typ         text not null,
  pass_id     uuid references public.bookings(id) on delete cascade,
  elev_id     uuid references public.students(id) on delete cascade,
  trad_parent uuid references public.profiles(id) on delete cascade,
  trad_tutor  uuid references public.profiles(id) on delete cascade,
  antal       int not null default 1 check (antal >= 1),
  data        jsonb not null default '{}'::jsonb,
  skapad      timestamptz not null default now(),
  uppdaterad  timestamptz not null default now(),
  last_at     timestamptz
);

comment on table public.notiser is
  'Notiscentralen: en rad per händelse och mottagare. Bara databasens funktioner skriver; mottagaren läser och '
  'sätter last_at, inget annat. data bär datum, tid, ämne och förnamn, aldrig brödtext.';

create index if not exists notiser_mottagare_idx on public.notiser (mottagare, uppdaterad desc);
create index if not exists notiser_olasta_idx on public.notiser (mottagare) where last_at is null;
create index if not exists notiser_pass_idx on public.notiser (pass_id) where pass_id is not null;

alter table public.notiser enable row level security;
revoke all on public.notiser from anon, authenticated;
grant select on public.notiser to authenticated;
grant update (last_at) on public.notiser to authenticated;

drop policy if exists "mottagaren läser sina notiser" on public.notiser;
create policy "mottagaren läser sina notiser" on public.notiser
  for select to authenticated using (mottagare = auth.uid());

drop policy if exists "mottagaren markerar sina notiser som lästa" on public.notiser;
create policy "mottagaren markerar sina notiser som lästa" on public.notiser
  for update to authenticated using (mottagare = auth.uid()) with check (mottagare = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notiser') then
    execute 'alter publication supabase_realtime add table public.notiser';
  end if;
end $$;

-- ---------- notis_val ----------

create table if not exists public.notis_val (
  profil_id  uuid not null references public.profiles(id) on delete cascade,
  typ        text not null,
  kanal      text not null check (kanal in ('mejl', 'sms')),
  pa         boolean not null,
  uppdaterad timestamptz not null default now(),
  primary key (profil_id, typ, kanal)
);

comment on table public.notis_val is
  'Vad användaren vill ha som mejl och SMS, per typ. Saknas en rad gäller förvalet: mejl på, SMS av. '
  'Avregistreringslänken i mejlen skriver hit.';

alter table public.notis_val enable row level security;
revoke all on public.notis_val from anon, authenticated;
grant select, insert, update, delete on public.notis_val to authenticated;

drop policy if exists "användaren styr sina notisval" on public.notis_val;
create policy "användaren styr sina notisval" on public.notis_val
  for all to authenticated
  using (profil_id = auth.uid())
  with check (profil_id = auth.uid() and typ = any (public.notis_typer()));

create or replace function public.stampla_notisvalet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.uppdaterad := now();
  return new;
end $$;

revoke execute on function public.stampla_notisvalet() from public, anon, authenticated;

drop trigger if exists notis_val_stampla on public.notis_val;
create trigger notis_val_stampla before insert or update on public.notis_val
  for each row execute function public.stampla_notisvalet();

-- Förvalet står här och ingen annanstans: mejl på, SMS av. SMS ska vara
-- något man själv slår på (kostnad, samtycke, låsta skärmar).
create or replace function public.notis_vill(p_profil uuid, p_typ text, p_kanal text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select v.pa from public.notis_val v
      where v.profil_id = p_profil and v.typ = p_typ and v.kanal = p_kanal),
    p_kanal = 'mejl')
$$;

revoke execute on function public.notis_vill(uuid, text, text) from public, anon, authenticated;

-- ---------- notis_utskick ----------

create table if not exists public.notis_utskick (
  id             uuid primary key default gen_random_uuid(),
  mottagare      uuid not null references public.profiles(id) on delete cascade,
  kanal          text not null check (kanal in ('mejl', 'sms')),
  typ            text not null,
  pass_id        uuid references public.bookings(id) on delete set null,
  trad_parent    uuid references public.profiles(id) on delete set null,
  trad_tutor     uuid references public.profiles(id) on delete set null,
  antal          int not null default 1 check (antal >= 1),
  data           jsonb not null default '{}'::jsonb,
  samlingsnyckel text,
  idempotens     text not null unique,
  skicka_efter   timestamptz not null default now(),
  skicka_senast  timestamptz,
  status         text not null default 'vantar'
                 check (status in ('vantar', 'skickar', 'skickad', 'hoppad', 'loggad', 'fel')),
  forsok         int not null default 0,
  lanad_till     timestamptz,
  fel            text,
  leverantor_id  text,
  till_sandlada  boolean not null default false,
  skapad         timestamptz not null default now(),
  uppdaterad     timestamptz not null default now()
);

comment on table public.notis_utskick is
  'Kön för mejl och SMS. Skrivs bara av databasens funktioner, töms av edge-funktionen notis-ko. samlingsnyckel '
  'slår ihop: en väntande rad per chattråd och mottagare, och per pass och mottagare. idempotens hindrar att '
  'samma påminnelse köas två gånger. skicka_senast: därefter är utskicket inaktuellt och hoppas över. Admin läser.';

create unique index if not exists notis_utskick_samlas_idx
  on public.notis_utskick (samlingsnyckel) where status = 'vantar' and samlingsnyckel is not null;
create index if not exists notis_utskick_ko_idx on public.notis_utskick (status, skicka_efter);
create index if not exists notis_utskick_skapad_idx on public.notis_utskick (skapad desc);

alter table public.notis_utskick enable row level security;
revoke all on public.notis_utskick from anon, authenticated;
grant select on public.notis_utskick to authenticated;

drop policy if exists "admin läser utskicken" on public.notis_utskick;
create policy "admin läser utskicken" on public.notis_utskick
  for select to authenticated using (public.is_admin());

-- ---------- fel och körningar ----------

create table if not exists public.notis_fel (
  id     bigserial primary key,
  skapad timestamptz not null default now(),
  kalla  text not null,
  fel    text not null
);

alter table public.notis_fel enable row level security;
revoke all on public.notis_fel from anon, authenticated;
grant select on public.notis_fel to authenticated;

drop policy if exists "admin läser notisfelen" on public.notis_fel;
create policy "admin läser notisfelen" on public.notis_fel
  for select to authenticated using (public.is_admin());

create table if not exists public.notis_korningar (
  id          bigserial primary key,
  tid         timestamptz not null default now(),
  behandlade  int not null default 0,
  skickade    int not null default 0,
  misslyckade int not null default 0,
  meddelande  text
);

alter table public.notis_korningar enable row level security;
revoke all on public.notis_korningar from anon, authenticated;
grant select on public.notis_korningar to authenticated;

drop policy if exists "admin läser körningarna" on public.notis_korningar;
create policy "admin läser körningarna" on public.notis_korningar
  for select to authenticated using (public.is_admin());

-- ---------- att skapa en notis och köa ett utskick ----------

-- Förnamnet, och bara det, och bara bokstäver. Ett efternamn på en
-- låst skärm är mer än någon behöver, och full_name är fritext utan
-- gräns: ett "namn" som ser ut som en adress blir en länk i Gmail.
create or replace function intern.fornamn(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select nullif(left(regexp_replace(split_part(btrim(coalesce(p, '')), ' ', 1), '[^[:alpha:]-]', '', 'g'), 30), '')
$$;

revoke execute on function intern.fornamn(text) from public, anon, authenticated;

-- Köa ett utskick. Med samlingsnyckel räknas en väntande rad upp och
-- får det senaste läget, i stället för att en ny läggs till;
-- skicka_efter flyttas inte, så den första i en ström bestämmer när
-- utskicket går.
create or replace function intern.notis_koa(
  p_mottagare uuid, p_kanal text, p_typ text, p_pass uuid,
  p_trad_parent uuid, p_trad_tutor uuid, p_data jsonb,
  p_samlingsnyckel text, p_idempotens text, p_skicka_efter timestamptz, p_skicka_senast timestamptz)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_samlingsnyckel is not null then
    insert into public.notis_utskick as u
      (mottagare, kanal, typ, pass_id, trad_parent, trad_tutor, data, samlingsnyckel, idempotens,
       skicka_efter, skicka_senast)
    values (p_mottagare, p_kanal, p_typ, p_pass, p_trad_parent, p_trad_tutor, coalesce(p_data, '{}'::jsonb),
            p_samlingsnyckel, p_idempotens, p_skicka_efter, p_skicka_senast)
    on conflict (samlingsnyckel) where status = 'vantar' and samlingsnyckel is not null
    do update set antal = u.antal + 1, typ = excluded.typ, data = u.data || excluded.data, uppdaterad = now();
  else
    insert into public.notis_utskick
      (mottagare, kanal, typ, pass_id, trad_parent, trad_tutor, data, idempotens, skicka_efter, skicka_senast)
    values (p_mottagare, p_kanal, p_typ, p_pass, p_trad_parent, p_trad_tutor, coalesce(p_data, '{}'::jsonb),
            p_idempotens, p_skicka_efter, p_skicka_senast)
    on conflict (idempotens) do nothing;
  end if;
end $$;

revoke execute on function intern.notis_koa(uuid, text, text, uuid, uuid, uuid, jsonb, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;

-- En notis i appen, och ett mejl om typen mejlas och mottagaren vill.
-- Chattens notiser slås ihop per tråd så länge de är olästa, och
-- chattmejlen per tråd. Ändringar i ett och samma pass blir ett mejl
-- med det senaste läget.
create or replace function intern.notis_skapa(
  p_mottagare uuid, p_typ text, p_pass uuid, p_elev uuid,
  p_trad_parent uuid, p_trad_tutor uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inst public.notis_installning%rowtype;
begin
  if p_mottagare is null or p_mottagare = auth.uid() then
    return;
  end if;
  if not (p_typ = any (public.notis_typer())) then
    raise exception 'okänd notistyp %', p_typ;
  end if;
  select * into inst from public.notis_installning where id = 1;

  if p_typ = 'meddelande' then
    update public.notiser n
       set antal = n.antal + 1, data = n.data || coalesce(p_data, '{}'::jsonb), uppdaterad = now()
     where n.mottagare = p_mottagare and n.typ = 'meddelande' and n.last_at is null
       and n.trad_parent = p_trad_parent and n.trad_tutor = p_trad_tutor;
    if not found then
      insert into public.notiser (mottagare, typ, trad_parent, trad_tutor, data)
      values (p_mottagare, p_typ, p_trad_parent, p_trad_tutor, coalesce(p_data, '{}'::jsonb));
    end if;
  else
    insert into public.notiser (mottagare, typ, pass_id, elev_id, trad_parent, trad_tutor, data)
    values (p_mottagare, p_typ, p_pass, p_elev, p_trad_parent, p_trad_tutor, coalesce(p_data, '{}'::jsonb));
  end if;

  if not (p_typ = any (public.notis_mejlbara())) or not public.notis_vill(p_mottagare, p_typ, 'mejl') then
    return;
  end if;

  if p_typ = 'meddelande' then
    perform intern.notis_koa(p_mottagare, 'mejl', 'meddelande', null, p_trad_parent, p_trad_tutor,
      coalesce(p_data, '{}'::jsonb),
      'meddelande:' || p_mottagare || ':' || p_trad_parent || ':' || p_trad_tutor,
      'meddelande:' || p_mottagare || ':' || gen_random_uuid(),
      now() + make_interval(mins => coalesce(inst.chatt_samla_minuter, 10)), null);
  elsif p_pass is not null then
    perform intern.notis_koa(p_mottagare, 'mejl', p_typ, p_pass, p_trad_parent, p_trad_tutor,
      coalesce(p_data, '{}'::jsonb),
      'pass:' || p_mottagare || ':' || p_pass,
      p_typ || ':' || p_mottagare || ':' || p_pass || ':' || gen_random_uuid(),
      now() + make_interval(mins => coalesce(inst.pass_samla_minuter, 3)), null);
  end if;
end $$;

revoke execute on function intern.notis_skapa(uuid, text, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
