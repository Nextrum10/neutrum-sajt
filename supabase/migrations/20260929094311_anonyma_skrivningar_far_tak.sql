-- ============================================================
-- NEXTRUM — det anonyma får tak, och en länk är en webbadress
--
-- Ur granskningen 2026-09-29. Fyra vägar in tog emot vad som helst:
--
-- 1. biblioteksmaterial.lank hade inget villkor alls. En studiehjälpare
--    lägger sitt eget material, och familjen öppnar länken med
--    window.open. Vyn prövade https? före sparandet, men databasen gjorde
--    det inte, och en javascript:-adress stoppades bara av CSP:n. Nu är
--    en länk en http- eller https-adress utan mellanslag. Alla tolv
--    länkar i driften följde regeln när den skrevs.
--
-- 2. klientfel tog emot text utan längd och utan tak, från vem som
--    helst. nextrum-fel.js kapar redan (500, 300, 2000, 300 tecken) och
--    skickar högst fem per besök, men det är webbläsarens löfte. Nu kapar
--    databasen till samma längder, och över sextio rader på en minut tas
--    raden tyst bort: ett fel som inte rapporteras under en flod är
--    bättre än en tabell som fylls. Tyst, för att felrapporteringen
--    aldrig ska ge ett nytt fel.
--
-- 3. contact_messages tog emot text utan längd och utan tak. Nu har
--    fälten en längd, och formuläret nekas med ett besked över trettio
--    meddelanden i timmen, eller tre från samma adress. created_at sätts
--    av databasen, som för leads och applications (Fas 16.1c): annars går
--    bromsen runt med en bakdaterad rad.
--
-- 4. Hinken cv tog emot hur många filer som helst från anon. Nu måste
--    sökvägen se ut som den NX.kopplaAnsökan bygger (tid, slump,
--    filnamnet), och över tjugo filer i timmen nekas uppladdningen.
--    Ansökan går då in ändå, med filnamnet noterat, som när hinken är
--    stängd. Räkningen görs av en SECURITY DEFINER-funktion i intern:
--    policyn körs som anon, som inte ser hinkens rader, och ett villkor
--    som anropar en funktion kräver EXECUTE hos anroparen (Fas 10).
-- ============================================================

-- ---------- 1. länken ----------
alter table public.biblioteksmaterial
  add constraint biblioteksmaterial_lank_webbadress
  check (lank is null or lank ~* '^https?://\S+$');

-- ---------- 2. klientfel ----------
create or replace function intern.klientfel_tak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.meddelande := left(new.meddelande, 500);
  new.sida       := left(new.sida, 300);
  new.stack      := left(new.stack, 2000);
  new.webblasare := left(new.webblasare, 300);
  if (select count(*) from public.klientfel
       where created_at > now() - interval '1 minute') >= 60 then
    return null;
  end if;
  return new;
end
$$;
revoke execute on function intern.klientfel_tak() from public, anon, authenticated;

create trigger klientfel_tak
  before insert on public.klientfel
  for each row execute function intern.klientfel_tak();

-- ---------- 3. kontaktformuläret ----------
alter table public.contact_messages
  add constraint contact_messages_langd check (
    length(coalesce(name, '')) <= 200
    and length(coalesce(email, '')) <= 320
    and length(coalesce(role, '')) <= 50
    and length(coalesce(message, '')) <= 5000
  );

create or replace function intern.kontakt_broms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (select count(*) from public.contact_messages
       where created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.contact_messages
          where created_at > now() - interval '1 hour'
            and intern.epost_nyckel(email) = intern.epost_nyckel(new.email)) >= 3 then
    raise exception 'För många meddelanden just nu. Mejla oss i stället.'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke execute on function intern.kontakt_broms() from public, anon, authenticated;

create trigger contact_messages_broms
  before insert on public.contact_messages
  for each row execute function intern.kontakt_broms();

-- ---------- 4. hinken cv ----------
create or replace function intern.cv_uppladdning_tillaten()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 20 from storage.objects
   where bucket_id = 'cv' and created_at > now() - interval '1 hour'
$$;
revoke execute on function intern.cv_uppladdning_tillaten() from public;
grant execute on function intern.cv_uppladdning_tillaten() to anon, authenticated;

drop policy if exists "vem som helst kan ladda upp cv" on storage.objects;
create policy "vem som helst kan ladda upp cv"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'cv'
    and length(name) <= 300
    and name ~ '^[0-9]{13}-[a-z0-9]{1,6}-[A-Za-z0-9_.-]+$'
    and intern.cv_uppladdning_tillaten()
  );
