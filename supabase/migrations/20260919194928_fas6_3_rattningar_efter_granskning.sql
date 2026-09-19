-- Fas 6 — rättningar efter granskningen av 6.1 och 6.2.
--
-- 1. uppgift_stampel lade tillbaka skapad_av även när den främmande
--    nyckeln satte den till null (ON DELETE SET NULL). En profil som
--    tagits bort kunde då antingen inte tas bort, eller lämna en
--    uppgift som pekade på ingen. Nu får skapad_av bli null, men inte
--    bytas mot någon annan.
-- 2. uppgifter.nyckel: vad uppgiften gäller, t.ex.
--    'avvikelse:faktura_forfallen:invoices:<id>'. En öppen uppgift per
--    nyckel (unikt index), så att samma problem inte blir två uppgifter
--    — från adminvyn nu, från schemalagda kontroller i Fas 7.
-- 3. RUT-taket (rut_tak) loggas: det styr direkt hur mycket RUT
--    faktureringen drar. Objektet är året.
-- 4. Auditloggen går inte att ändra eller tömma, inte ens med
--    service_role: en loggrad som kan skrivas om är ingen logg.
-- 5. aktor_typ får värdet 'ai' inför Fas 8.
--
-- Rättelse av kommentaren i 6.2: admin_lage fick inte antalet
-- avvikelser (funktionen kräver admin och kan inte ligga i en vy som
-- läses av alla inloggade). Adminvyn räknar dem ur funktionen.
--
-- Funktionerna lästa ur driften före ändringen.

-- ---------- 1 och 2: uppgifter ----------
alter table public.uppgifter add column nyckel text
  check (nyckel is null or char_length(nyckel) between 3 and 200);
create unique index uppgifter_oppen_nyckel_idx on public.uppgifter (nyckel)
  where nyckel is not null and status in ('oppen', 'pagar');
comment on column public.uppgifter.nyckel is
  'Vad uppgiften gäller, för att undvika dubbletter: högst en öppen uppgift per nyckel.';

create or replace function public.uppgift_stampel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.skapad_av := auth.uid();
      new.skapad_av_typ := 'manniska';
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    -- Får bli null (profilen togs bort), men inte bytas mot någon annan.
    if new.skapad_av is not null then
      new.skapad_av := old.skapad_av;
    end if;
    new.skapad_av_typ := old.skapad_av_typ;
    new.created_at := old.created_at;
    new.nyckel := old.nyckel;
  end if;
  new.uppdaterad := now();
  if new.status = 'klar' and (tg_op = 'INSERT' or old.status is distinct from 'klar') then
    new.klar_at := now();
  elsif new.status <> 'klar' then
    new.klar_at := null;
  end if;
  return new;
end $function$;

revoke execute on function public.uppgift_stampel() from public, anon, authenticated;

-- ---------- 3 och 5: loggningen ----------
alter table public.audit_logg drop constraint audit_logg_aktor_typ_check;
alter table public.audit_logg add constraint audit_logg_aktor_typ_check
  check (aktor_typ in ('admin', 'anvandare', 'system', 'ai'));

create or replace function public.logga_andring()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  bas      text   := tg_argv[0];
  kolumner text[] := tg_argv[1:];
  fore     jsonb;
  efter    jsonb;
  uid      uuid   := auth.uid();
  handling text;
  objekt   text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select jsonb_object_agg(k, v) into fore
      from jsonb_each(to_jsonb(old)) as e(k, v) where k = any (kolumner);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select jsonb_object_agg(k, v) into efter
      from jsonb_each(to_jsonb(new)) as e(k, v) where k = any (kolumner);
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, fore -> k), jsonb_object_agg(k, efter -> k)
      into fore, efter
      from jsonb_object_keys(coalesce(efter, '{}'::jsonb)) as k
     where (fore -> k) is distinct from (efter -> k);
    if efter is null then
      return null;
    end if;
  end if;

  handling := bas || '.' || case tg_op
    when 'INSERT' then 'skapad'
    when 'DELETE' then 'borttagen'
    else case
      when efter ? 'aktiv'  then case when (efter ->> 'aktiv')::boolean then 'aktiverad' else 'avaktiverad' end
      when efter ? 'status' then 'status'
      else 'andrad'
    end
  end;

  -- id, annars kod (tjanster, rabattkoder), annars år (rut_tak).
  objekt := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
                     to_jsonb(new) ->> 'kod', to_jsonb(old) ->> 'kod',
                     to_jsonb(new) ->> 'ar', to_jsonb(old) ->> 'ar', '?');

  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, fore, efter)
  values (uid,
          case when uid is null then 'system' when public.is_admin() then 'admin' else 'anvandare' end,
          handling, tg_table_name, objekt, fore, efter);
  return null;
end $function$;

revoke execute on function public.logga_andring() from public, anon, authenticated;

-- Källan (fritext) loggas inte, bara året och beloppet.
create trigger rut_tak_audit
  after insert or update or delete on public.rut_tak
  for each row execute function public.logga_andring('rut_tak', 'ar', 'tak_ore');

-- ---------- 4: loggen går inte att skriva om ----------
create or replace function public.auditlogg_las()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  raise exception using errcode = '42501',
    message = 'Auditloggen går inte att ändra eller tömma.';
end $function$;

revoke execute on function public.auditlogg_las() from public, anon, authenticated;

create trigger audit_logg_las
  before update or delete on public.audit_logg
  for each row execute function public.auditlogg_las();
create trigger audit_logg_las_tomning
  before truncate on public.audit_logg
  for each statement execute function public.auditlogg_las();
