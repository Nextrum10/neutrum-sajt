-- ============================================================
-- NEXTRUM — intresseanmälan, jobbansökan och kontaktformuläret får tak
--
-- 2026-10-31, Leo: "främst intresseanmälan knappen fråge knappen och bli
-- studiehjälpare knappen". De tre formulären är öppna för vem som helst,
-- och anon-nyckeln är publik, så en robot postar rakt mot PostgREST förbi
-- honungsfällan i nextrum-app.js.
--
-- Före den här migrationen:
--   leads          policyn är with check (true) och inget räknade. Bara
--                  kvittot till familjen bromsades (lead_kvitto_broms), och
--                  lead-notis mejlade info@ för varje rad: en robot fyllde
--                  både listan och inkorgen.
--   applications   samma: bara kvittot (ansokan_besked) och direktmejlet
--                  till oss (fem på tio minuter) bromsades, inte raderna.
--   contact_messages  trettio i timmen och tre per adress
--                  (anonyma_skrivningar_far_tak), men inget per avsändare,
--                  så en robot stängde formuläret för alla i en timme.
--
-- Nu nekas ett inskick med ett besked när något av det här är nått:
--   1. trettio i timmen i tabellen totalt (aldrig fler än en i timmen i
--      driften 2026-10-31: två anmälningar, tretton ansökningar och ett
--      meddelande sammanlagt);
--   2. tre i timmen från samma adress (intern.epost_nyckel, som förut), så
--      att den som skrev fel och skickar igen kommer fram;
--   3. fem i timmen från samma IP-nummer, så att EN robot stoppas innan den
--      når totaltaket och stänger formuläret för alla andra.
--
-- IP-numret sparas aldrig. Det räknas som en HMAC med notis_konfig.barn_nyckel
-- i intern.rabattkod_forsok, som prova_jobbkod redan gör, och raderna gallras
-- efter ett dygn när ett nytt försök sparas (intern.rabattkod_forsok_notera).
-- Ett inskick räknas först när det får gå in; ett nekat räknas inte, för
-- undantaget rullar tillbaka raden. Numret läses ur Cloudflares
-- cf-connecting-ip, som en klient inte kan sätta själv genom Cloudflare,
-- annars det första i x-forwarded-for, som prova_jobbkod. Saknas det (ett
-- anrop utanför PostgREST) prövas bara 1 och 2: ett okänt nummer delat av
-- alla vore ett totaltak till.
--
-- Bara anon och authenticated räknas. Databasens egna vägar, tjänstekontot
-- och rls-test.sql:s fixturer (som postgres) går förbi, för taket finns mot
-- det som kommer utifrån. Kontaktformulärets två gamla tak gäller som förut
-- också för postgres; där läggs bara IP-taket till.
--
-- Beskedet börjar med "För många" och nämner info@, så att ingen familj
-- försvinner: felText() i nextrum-app.js visar det som felSparr.
--
-- Ett totaltak kan stänga ute en riktig familj medan en robot med många
-- nummer håller på. Med vår volym är trettio i timmen långt över det vanliga,
-- och beskedet leder till mejlen. En kampanj som ger mer än så höjer talen
-- här, i en ny migration.
-- ============================================================

-- ---------- IP-numret som en nyckel ----------
create or replace function intern.formular_ip_nyckel(p_sort text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h  json;
  ip text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  ip := coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''),
                 nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
                 nullif(btrim(h ->> 'x-real-ip'), ''));
  if ip is null then
    return null;
  end if;
  return 'formular:' || p_sort || ':' || coalesce(
    (select encode(extensions.hmac(convert_to('formular:v1:' || ip, 'UTF8'),
                                   decode(k.barn_nyckel, 'base64'), 'sha256'), 'base64')
       from public.notis_konfig k where k.id = 1 and k.barn_nyckel is not null),
    encode(extensions.digest(convert_to('formular:v1:' || ip, 'UTF8'), 'sha256'), 'base64'));
end
$$;
revoke all on function intern.formular_ip_nyckel(text) from public, anon, authenticated;

-- ---------- nej, eller räkna inskicket ----------
-- p_ovrigt är tak 1 och 2, räknade av triggern på sin egen tabell.
create or replace function intern.formular_prova(p_sort text, p_ovrigt boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nyckel text := intern.formular_ip_nyckel(p_sort);
begin
  if p_ovrigt
     or (v_nyckel is not null
         and (select count(*) from intern.rabattkod_forsok f
               where f.nyckel = v_nyckel and f.tid > now() - interval '1 hour') >= 5) then
    raise exception 'För många inskick just nu. Mejla oss på info@nextrum.se i stället.'
      using errcode = 'P0001';
  end if;
  if v_nyckel is not null then
    perform intern.rabattkod_forsok_notera(v_nyckel);
  end if;
end
$$;
revoke all on function intern.formular_prova(text, boolean) from public, anon, authenticated;

-- Taket gäller det som kommer genom PostgREST. I en SECURITY DEFINER-funktion
-- är current_user ägaren, så rollen läses ur inställningen PostgREST sätter.
create or replace function intern.formular_utifran()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), 'none') in ('anon', 'authenticated')
$$;
revoke all on function intern.formular_utifran() from public, anon, authenticated;

-- ---------- intresseanmälan ----------
-- leads_broms går före leads_skydda (namnordning), så att ett nej kommer
-- innan något annat i raden prövas. Tiden är databasens: leads_skydda sätter
-- created_at, och raderna i tabellen har alla databasens tid (Fas 16.1c).
create or replace function intern.leads_broms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not intern.formular_utifran() then
    return new;
  end if;
  perform intern.formular_prova('anmalan',
    (select count(*) from public.leads l
      where l.created_at > now() - interval '1 hour') >= 30
    or (select count(*) from public.leads l
         where l.created_at > now() - interval '1 hour'
           and intern.epost_nyckel(l.email) = intern.epost_nyckel(new.email)) >= 3);
  return new;
end
$$;
revoke all on function intern.leads_broms() from public, anon, authenticated;

create trigger leads_broms
  before insert on public.leads
  for each row execute function intern.leads_broms();

-- ---------- jobbansökan ----------
create or replace function intern.applications_broms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not intern.formular_utifran() then
    return new;
  end if;
  perform intern.formular_prova('ansokan',
    (select count(*) from public.applications a
      where a.created_at > now() - interval '1 hour') >= 30
    or (select count(*) from public.applications a
         where a.created_at > now() - interval '1 hour'
           and intern.epost_nyckel(a.email) = intern.epost_nyckel(new.email)) >= 3);
  return new;
end
$$;
revoke all on function intern.applications_broms() from public, anon, authenticated;

create trigger applications_broms
  before insert on public.applications
  for each row execute function intern.applications_broms();

-- ---------- kontaktformuläret ----------
-- Samma två tak som förut, för alla, och nu IP-taket för det som kommer
-- utifrån. Beskedet är detsamma som de andra formulärens.
create or replace function intern.kontakt_broms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ovrigt boolean;
begin
  new.created_at := now();
  ovrigt := (select count(*) from public.contact_messages
              where created_at > now() - interval '1 hour') >= 30
         or (select count(*) from public.contact_messages
              where created_at > now() - interval '1 hour'
                and intern.epost_nyckel(email) = intern.epost_nyckel(new.email)) >= 3;
  if intern.formular_utifran() then
    perform intern.formular_prova('kontakt', ovrigt);
  elsif ovrigt then
    raise exception 'För många inskick just nu. Mejla oss på info@nextrum.se i stället.'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke execute on function intern.kontakt_broms() from public, anon, authenticated;
