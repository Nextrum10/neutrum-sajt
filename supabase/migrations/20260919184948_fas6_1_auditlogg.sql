-- Fas 6.1 — en minimal auditlogg: vem, vad, när, objekt, före och efter.
--
-- Planens krav: loggning innan AI får göra mer (regel 7), fylld av
-- triggrar på matchning, faktura, utbetalning och tjänsteaktivering.
-- Här också några ändringar av samma allvar: adminbehörighet, undantagna
-- pass, kopplade rapporter, studiehjälparens status och timpenning,
-- rabattkoder — och varje gång ett personnummer sparas, läses eller tas
-- bort.
--
-- VAD SOM LOGGAS. Bara en uttrycklig lista kolumner per tabell: id,
-- status, belopp, datum, flaggor. Aldrig namn, e-post, telefon, fritext,
-- anteckningar om barn eller personnummer. En ny kolumn kommer alltså inte
-- med av sig själv. Vid en ändring loggas bara det som faktiskt ändrades.
--
-- VEM. auth.uid() — admin som ändrar via adminvyn syns med sitt id.
-- Ändringar som edge-funktionerna gör med service_role (faktureringen)
-- och migrationer har inget id och loggas som 'system'.
--
-- Tabellen går bara att läsa, och bara för admin. Ingen klient kan
-- skriva, ändra eller ta bort en rad: raderna skrivs av triggrarna och
-- skattefunktionerna, som kör med ägarens rättigheter.

create table public.audit_logg (
  id        bigint generated always as identity primary key,
  tid       timestamptz not null default now(),
  aktor     uuid,
  aktor_typ text not null check (aktor_typ in ('admin', 'anvandare', 'system')),
  handling  text not null check (handling ~ '^[a-z_]+\.[a-z_]+$'),
  tabell    text not null,
  objekt_id text not null,
  fore      jsonb,
  efter     jsonb
);
create index audit_logg_tid_idx    on public.audit_logg (tid desc);
create index audit_logg_objekt_idx on public.audit_logg (tabell, objekt_id);

comment on table public.audit_logg is
  'Vem som ändrade vad och när, för känsliga åtgärder. Bara id, status, belopp och datum — aldrig personuppgifter eller fritext.';

alter table public.audit_logg enable row level security;
revoke all on public.audit_logg from anon, authenticated;
grant select on public.audit_logg to authenticated;
create policy "admin läser auditloggen" on public.audit_logg
  for select using (public.is_admin());

-- ---------- den gemensamma triggern ----------
-- tg_argv[0] = vad objektet heter i loggen ('faktura', 'matchning' …),
-- resten   = kolumnerna som får loggas.
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
    -- Bara det som faktiskt ändrades. Ingen ändring i de loggade
    -- kolumnerna, ingen rad.
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

  objekt := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
                     to_jsonb(new) ->> 'kod', to_jsonb(old) ->> 'kod', '?');

  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, fore, efter)
  values (uid,
          case when uid is null then 'system' when public.is_admin() then 'admin' else 'anvandare' end,
          handling, tg_table_name, objekt, fore, efter);
  return null;
end $function$;

revoke execute on function public.logga_andring() from public, anon, authenticated;

-- ---------- triggrarna ----------
create trigger students_audit
  after update of matched_tutor_id, match_status on public.students
  for each row execute function public.logga_andring(
    'matchning', 'id', 'parent_id', 'matched_tutor_id', 'match_status', 'uppdrag_id');

create trigger invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function public.logga_andring(
    'faktura', 'id', 'parent_id', 'period', 'status', 'belopp_ore', 'rut_ore', 'rut_ar',
    'valuta', 'forfaller', 'skickad_at', 'betald_at', 'stripe_invoice_id');

create trigger payouts_audit
  after insert or update or delete on public.payouts
  for each row execute function public.logga_andring(
    'utbetalning', 'id', 'tutor_id', 'period', 'status', 'belopp_ore', 'minuter',
    'valuta', 'utbetald_at', 'stripe_transfer_id');

create trigger tjanster_audit
  after insert or update or delete on public.tjanster
  for each row execute function public.logga_andring(
    'tjanst', 'kod', 'aktiv', 'for_kund', 'for_jobb', 'pris_per_timme_ore', 'extra_personer_ore',
    'extra_personer_max', 'ersattning_per_timme_ore', 'bokningstyp', 'kundtyp', 'jobbtyp',
    'min_alder', 'rapportkrav', 'rut_berattigad', 'rut_procent', 'krav', 'matchningsregler');

create trigger profiles_audit
  after update of is_admin, role on public.profiles
  for each row execute function public.logga_andring('behorighet', 'id', 'is_admin', 'role');

create trigger bookings_audit
  after update of fakturerbar on public.bookings
  for each row execute function public.logga_andring('pass', 'id', 'fakturerbar');

create trigger lesson_reports_audit
  after update of booking_id, narvaro on public.lesson_reports
  for each row execute function public.logga_andring('rapport', 'id', 'booking_id', 'narvaro');

create trigger tutor_profiles_audit
  after update of status, hourly_rate, visa_publikt on public.tutor_profiles
  for each row execute function public.logga_andring(
    'studiehjalpare', 'id', 'status', 'hourly_rate', 'visa_publikt');

create trigger rabattkoder_audit
  after insert or update or delete on public.rabattkoder
  for each row execute function public.logga_andring(
    'rabattkod', 'kod', 'aktiv', 'typ', 'varde', 'tjanst', 'giltig_fran', 'giltig_till', 'max_anvandningar');

-- ---------- personnummer: varje åtkomst loggas ----------
-- Samma funktioner som i 5.3 (lästa ur driften), med en loggrad var.
-- las_skatteuppgifter blir VOLATILE: den skriver nu en rad varje gång
-- någon läser ett personnummer.
create or replace function public.spara_skatteuppgifter(
  p_kund                 uuid,
  p_personnummer         text,
  p_fastighetsbeteckning text default null,
  p_brf_orgnr            text default null,
  p_lagenhetsnummer      text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pnr    text := regexp_replace(coalesce(p_personnummer, ''), '[^0-9]', '', 'g');
  nyckel text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan spara skatteuppgifter.';
  end if;
  if not public.personnummer_ok(pnr) then
    raise exception using errcode = '22023',
      message = 'Personnumret ska vara tolv siffror, ÅÅÅÅMMDD-XXXX, med rätt kontrollsiffra.';
  end if;
  if not exists (select 1 from public.profiles where id = p_kund) then
    raise exception using errcode = '22023', message = 'Kunden finns inte.';
  end if;

  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'rut_personnummer';
  if nyckel is null then
    raise exception using errcode = '55000', message = 'Krypteringsnyckeln saknas i Vault.';
  end if;

  insert into public.kund_skatteuppgifter as k
    (kund_id, personnummer, fastighetsbeteckning, brf_orgnr, lagenhetsnummer, uppdaterad, uppdaterad_av)
  values
    (p_kund,
     extensions.pgp_sym_encrypt(pnr, nyckel, 'cipher-algo=aes256'),
     nullif(btrim(coalesce(p_fastighetsbeteckning, '')), ''),
     nullif(btrim(coalesce(p_brf_orgnr, '')), ''),
     nullif(btrim(coalesce(p_lagenhetsnummer, '')), ''),
     now(), auth.uid())
  on conflict (kund_id) do update
    set personnummer         = excluded.personnummer,
        fastighetsbeteckning = excluded.fastighetsbeteckning,
        brf_orgnr            = excluded.brf_orgnr,
        lagenhetsnummer      = excluded.lagenhetsnummer,
        uppdaterad           = excluded.uppdaterad,
        uppdaterad_av        = excluded.uppdaterad_av;

  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
  values (auth.uid(), 'admin', 'skatteuppgifter.sparade', 'kund_skatteuppgifter', p_kund::text);
end $function$;

create or replace function public.las_skatteuppgifter(p_kund uuid)
returns table (kund_id uuid, personnummer text, fastighetsbeteckning text,
               brf_orgnr text, lagenhetsnummer text, uppdaterad timestamptz)
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  nyckel text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan läsa skatteuppgifter.';
  end if;
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
  values (auth.uid(), 'admin', 'skatteuppgifter.lasta', 'kund_skatteuppgifter', p_kund::text);
  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'rut_personnummer';
  return query
    select k.kund_id,
           substr(p.pnr, 1, 8) || '-' || substr(p.pnr, 9, 4),
           k.fastighetsbeteckning, k.brf_orgnr, k.lagenhetsnummer, k.uppdaterad
      from public.kund_skatteuppgifter k
      cross join lateral (select extensions.pgp_sym_decrypt(k.personnummer, nyckel) as pnr) p
     where k.kund_id = p_kund;
end $function$;

create or replace function public.radera_skatteuppgifter(p_kund uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan ta bort skatteuppgifter.';
  end if;
  delete from public.kund_skatteuppgifter where kund_id = p_kund;
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
  values (auth.uid(), 'admin', 'skatteuppgifter.raderade', 'kund_skatteuppgifter', p_kund::text);
end $function$;

-- Rättigheterna som i 5.3: bara inloggade, admin prövas inuti.
revoke execute on function public.spara_skatteuppgifter(uuid, text, text, text, text) from public, anon;
revoke execute on function public.las_skatteuppgifter(uuid)                           from public, anon;
revoke execute on function public.radera_skatteuppgifter(uuid)                        from public, anon;
grant  execute on function public.spara_skatteuppgifter(uuid, text, text, text, text) to authenticated;
grant  execute on function public.las_skatteuppgifter(uuid)                           to authenticated;
grant  execute on function public.radera_skatteuppgifter(uuid)                        to authenticated;
