-- ============================================================
-- NEXTRUM — barnkontot skapas genom Auth (rättelse av barnkonton_och_admin)
--
-- VAD SOM VAR FEL
-- GoTrue skapar ett konto i flera steg i en och samma transaktion
-- (supabase/auth, internal/api/admin.go, adminUserCreate): raden skrivs
-- med app_metadata {provider, providers}, och anropets app_metadata,
-- rollen och bekräftelsen kommer i var sin UPDATE efteråt.
-- auth_barnkonto_skapas krävde roll = barn redan vid INSERT och nekade
-- därför varje barnkonto. Provat i driften 2026-09-30: POST /admin/users
-- svarade 500, "Adresser på barn.nextrum.se är barnkonton och skapas
-- bara från studievyn." rls-test.sql skrev raderna direkt, med
-- app_metadata redan i INSERT, och kunde inte se det.
--
-- SKAPANDEFÖNSTRET
-- barn-konto prövar föräldern, väljer kontots id själv och öppnar ett
-- fönster (barn_andringsfonster, andring = 'skapa') med id:t, barnet och
-- användarnamnet. Sedan anropar den Auth med samma id. Triggern släpper
-- bara in en barnadress som har ett öppet fönster för exakt det id:t och
-- användarnamnet, tar familjen ur fönstret och barnets rad, aldrig ur
-- anropet, skriver app_metadata själv och förbrukar fönstret. En
-- registrering genom signUp får sitt id av Auth och hittar inget
-- fönster, inte ens medan föräldern skapar samma användarnamn.
--
-- ETT BARNKONTO FÖRBLIR ETT BARNKONTO
-- nu genom att databasen skriver tillbaka roll, barn_id och forald_id i
-- stället för att neka. GoTrue skriver app_metadata ur sitt minne, och
-- en sådan skrivning ska varken göra barnet till ett vanligt konto eller
-- fälla anropet. Ett vanligt konto som får roll = barn nekas som förut.
--
-- MEJLSPÄRREN
-- GoTrue skickar sina mejl INNAN den sparar token (internal/api/mail.go),
-- men prövar först sin frekvensspärr mot *_sent_at. För ett barnkonto
-- står de fyra kolumnerna år 2999, så att Auth svarar 429 i stället för
-- att skicka: återställning, magisk länk, ny bekräftelse,
-- omautentisering och adressbyte. Inget mejl går till en barnadress,
-- null-MX eller inte.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Vakten: funktionerna ser ut som barnkonton_och_admin lämnade dem
-- ------------------------------------------------------------
do $$
declare
  v text;
begin
  select prosrc into v from pg_proc where oid = 'intern.auth_barnkonto_skapas()'::regprocedure;
  if md5(v) <> '90ac130a7cfc06fc13d8782cb7164281' and position('barnkonto_skapas_genom_auth' in v) = 0 then
    raise exception 'intern.auth_barnkonto_skapas ser inte ut som barnkonton_och_admin lämnade den. Läs driften.';
  end if;
  select prosrc into v from pg_proc where oid = 'intern.auth_barnkonto_las()'::regprocedure;
  if md5(v) <> '483a41cfae2ad198de40e230abbd776d' and position('barnkonto_skapas_genom_auth' in v) = 0 then
    raise exception 'intern.auth_barnkonto_las ser inte ut som barnkonton_och_admin lämnade den. Läs driften.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. Fönstret: ett lösenordsbyte eller ett nytt konto
-- ------------------------------------------------------------
alter table public.barn_andringsfonster add column if not exists user_id uuid;
alter table public.barn_andringsfonster add column if not exists anvandarnamn text;

alter table public.barn_andringsfonster drop constraint if exists barn_andringsfonster_andring;
alter table public.barn_andringsfonster add constraint barn_andringsfonster_andring check (
  (andring = 'losenord' and user_id is null and anvandarnamn is null)
  or (andring = 'skapa' and user_id is not null and anvandarnamn ~ '^[a-z0-9._-]{3,20}$')
);

comment on table public.barn_andringsfonster is
  'Ett fönster på högst 60 sekunder för barnets inloggning, öppnat av edge-funktionen barn-konto efter '
  'att den prövat att anroparen är barnets förälder. losenord: lösenordet får bytas en gång (förbrukas av '
  'auth_barnkonto_las). skapa: kontot med exakt user_id och anvandarnamn får skapas (förbrukas av '
  'auth_barnkonto_skapas). RLS utan policy: bara service_role, inte ens admin.';
comment on column public.barn_andringsfonster.user_id is
  'Id:t barn-konto valt åt det nya kontot och skickat till Auth. En registrering genom signUp får ett annat av Auth.';


-- ------------------------------------------------------------
-- 3. Mejlspärren
-- ------------------------------------------------------------
create or replace function intern.barnkonto_mejlsparr()
returns timestamptz
language sql
immutable
set search_path to 'pg_catalog'
as $$
  -- GoTrue skickar inget mejl så länge *_sent_at plus frekvensen ligger
  -- efter nu. Står den här tiden i kolumnerna skickar den aldrig.
  select timestamptz '2999-12-31 00:00:00+00'
$$;


-- ------------------------------------------------------------
-- 4. Före insert: en barnadress bara genom ett skapandefönster
-- ------------------------------------------------------------
create or replace function intern.auth_barnkonto_skapas()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- barnkonto_skapas_genom_auth
  roll   text := new.raw_app_meta_data ->> 'roll';
  epost  text := lower(coalesce(new.email, ''));
  f      public.barn_andringsfonster%rowtype;
  forald uuid;
begin
  if epost not like '%@barn.nextrum.se' and roll is distinct from 'barn' then
    return new;
  end if;

  if epost !~ '^[a-z0-9._-]{3,20}@barn\.nextrum\.se$' then
    raise exception using errcode = '42501',
      message = 'Ett barnkonto har adressen <användarnamn>@barn.nextrum.se.';
  end if;

  -- Fönstret för just det här id:t och användarnamnet. GoTrue skriver
  -- raden innan anropets app_metadata finns på den, så familjen tas
  -- härifrån och ur barnets rad, aldrig ur anropet.
  delete from public.barn_andringsfonster w
   where w.id = (select g.id from public.barn_andringsfonster g
                  where g.andring = 'skapa'
                    and g.user_id = new.id
                    and g.anvandarnamn = split_part(epost, '@', 1)
                    and g.giltig_till > clock_timestamp()
                  order by g.giltig_till
                  limit 1
                  for update skip locked)
  returning w.* into f;
  if f.id is null then
    raise exception using errcode = '42501',
      message = 'Adresser på barn.nextrum.se är barnkonton och skapas bara från studievyn.';
  end if;

  select s.parent_id into forald
    from public.students s
   where s.id = f.barn_id and s.raderad_at is null and s.user_id is null;
  if forald is null then
    raise exception using errcode = '42501',
      message = 'Barnkontot pekar inte på ett barn i familjen, eller barnet har redan en inloggning.';
  end if;

  -- Står familjen ändå i anropet ska den vara fönstrets.
  if (new.raw_app_meta_data ? 'barn_id'
      and intern.uuid_eller_null(new.raw_app_meta_data ->> 'barn_id') is distinct from f.barn_id)
     or (new.raw_app_meta_data ? 'forald_id'
      and intern.uuid_eller_null(new.raw_app_meta_data ->> 'forald_id') is distinct from forald) then
    raise exception using errcode = '42501',
      message = 'Barnkontot pekar inte på ett barn i familjen, eller barnet har redan en inloggning.';
  end if;

  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('roll', 'barn', 'barn_id', f.barn_id, 'forald_id', forald);
  new.role := 'nextrum_barn';
  new.raw_user_meta_data := '{}'::jsonb;
  new.confirmation_sent_at     := intern.barnkonto_mejlsparr();
  new.recovery_sent_at         := intern.barnkonto_mejlsparr();
  new.email_change_sent_at     := intern.barnkonto_mejlsparr();
  new.reauthentication_sent_at := intern.barnkonto_mejlsparr();
  return new;
end $$;


-- ------------------------------------------------------------
-- 5. Före update: låset, och barnkontot står kvar som barnkonto
-- ------------------------------------------------------------
create or replace function intern.auth_barnkonto_las()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- barnkonto_skapas_genom_auth
  fore    text := old.raw_app_meta_data ->> 'roll';
  efter   text := new.raw_app_meta_data ->> 'roll';
  fonster uuid;
begin
  if fore is distinct from 'barn' then
    if efter = 'barn' then
      raise exception using errcode = '42501',
        message = 'Ett barnkonto förblir ett barnkonto, och ett annat konto blir aldrig ett.';
    end if;
    -- Ingen annan tar en barnadress, inte heller genom ett adressbyte.
    if (lower(coalesce(new.email, '')) like '%@barn.nextrum.se' and new.email is distinct from old.email)
       or (lower(coalesce(new.email_change, '')) like '%@barn.nextrum.se'
           and new.email_change is distinct from old.email_change) then
      raise exception using errcode = '42501',
        message = 'Adresser på barn.nextrum.se är barnkonton och skapas bara från studievyn.';
    end if;
    return new;
  end if;

  -- Ett barnkonto. Familjen, rollen och mejlspärren skrivs tillbaka, vad
  -- uppdateringen än säger: GoTrue skriver app_metadata ur sitt minne,
  -- och ett lösenordsbyte nollar *_sent_at (UpdatePassword).
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('roll', 'barn',
                          'barn_id', old.raw_app_meta_data -> 'barn_id',
                          'forald_id', old.raw_app_meta_data -> 'forald_id');
  new.role := 'nextrum_barn';
  new.confirmation_sent_at     := intern.barnkonto_mejlsparr();
  new.recovery_sent_at         := intern.barnkonto_mejlsparr();
  new.email_change_sent_at     := intern.barnkonto_mejlsparr();
  new.reauthentication_sent_at := intern.barnkonto_mejlsparr();

  if coalesce(new.email, '')                      is distinct from coalesce(old.email, '')
     or coalesce(new.email_change, '')               is distinct from coalesce(old.email_change, '')
     or coalesce(new.email_change_token_new, '')     is distinct from coalesce(old.email_change_token_new, '')
     or coalesce(new.email_change_token_current, '') is distinct from coalesce(old.email_change_token_current, '')
     or coalesce(new.recovery_token, '')             is distinct from coalesce(old.recovery_token, '')
     or coalesce(new.confirmation_token, '')         is distinct from coalesce(old.confirmation_token, '')
     or coalesce(new.reauthentication_token, '')     is distinct from coalesce(old.reauthentication_token, '')
     or coalesce(new.phone, '')                      is distinct from coalesce(old.phone, '')
     or coalesce(new.phone_change, '')               is distinct from coalesce(old.phone_change, '')
     or coalesce(new.phone_change_token, '')         is distinct from coalesce(old.phone_change_token, '') then
    raise exception using errcode = '42501',
      message = 'Ett barnkontos e-post, telefon och återställning går inte att ändra. Föräldern byter lösenordet i studievyn.';
  end if;

  if new.encrypted_password is distinct from old.encrypted_password then
    delete from public.barn_andringsfonster f
     where f.id = (select g.id from public.barn_andringsfonster g
                    where g.barn_id = intern.uuid_eller_null(old.raw_app_meta_data ->> 'barn_id')
                      and g.andring = 'losenord'
                      and g.giltig_till > clock_timestamp()
                    order by g.giltig_till
                    limit 1
                    for update skip locked)
    returning f.id into fonster;
    if fonster is null then
      raise exception using errcode = '42501', message = 'Barnets lösenord byts av föräldern i studievyn.';
    end if;
  end if;

  -- Senast inloggad, för föräldern. Går den inte att skriva ska barnet
  -- ändå komma in: en tidsstämpel är inte värd en nekad inloggning.
  -- Felet hamnar i Postgres logg.
  if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
    begin
      update public.students s set senast_inloggad = new.last_sign_in_at where s.user_id = new.id;
    exception when others then
      raise warning 'senast_inloggad för ett barnkonto gick inte att skriva: %', sqlerrm;
    end;
  end if;
  return new;
end $$;


-- ------------------------------------------------------------
-- 6. Barnkonton som redan finns får mejlspärren (triggern skriver den)
-- ------------------------------------------------------------
update auth.users set updated_at = updated_at where raw_app_meta_data ->> 'roll' = 'barn';


-- ------------------------------------------------------------
-- 7. Ingen når funktionerna utom triggrarna
-- ------------------------------------------------------------
revoke execute on function intern.barnkonto_mejlsparr() from public, anon, authenticated;
revoke execute on function intern.auth_barnkonto_skapas() from public, anon, authenticated;
revoke execute on function intern.auth_barnkonto_las() from public, anon, authenticated;
