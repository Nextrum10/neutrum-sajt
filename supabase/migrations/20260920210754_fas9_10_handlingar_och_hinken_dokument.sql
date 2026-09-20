-- ============================================================
-- NEXTRUM — Fas 9.10: handlingar och hinken dokument
--
-- Planen vill ha "en privat hink dokument och en tabell för avtal
-- och underlag". Tabellen heter handlingar, inte underlag: UNDERLAG
-- är redan ett ord i den här verksamheten och betyder vad
-- studiehjälparen ska få betalt (payouts). Två betydelser för ett
-- ord i samma admin är hur en utbetalning en dag hamnar under fel
-- rubrik.
--
-- VAD SOM FÅR LIGGA HÄR: avtal med studiehjälpare och familjer,
-- intyg, försäkringsbrev, revisorns papper. Alltså handlingar OM
-- verksamheten.
--
-- VAD SOM INTE FÅR: allt som hör till ett barns undervisning. Det
-- har redan en hink (material) med policyer som släpper in familjen
-- och studiehjälparen. Dokument är ADMIN ENSAM, och en provräkning
-- som hamnar här blir osynlig för dem den gäller.
--
-- SÖKVÄGEN ÄR handlingens id, inte ett namn. mapp_uuid() plockar ut
-- den och policyn kräver att raden finns. Ett filnamn kan heta
-- "Avtal Alva Berg 2026.pdf", och en sökväg är det enda i en hink
-- som syns innan man öppnat filen.
--
-- AUDITEN LOGGAR ATT-DET-HÄNDE, ALDRIG VAD. Vitlistan bär typ,
-- koppling, giltighet och vem som laddade upp. Inte titel, inte
-- filnamn, inte anteckning — samma regel som materials och
-- admin_noteringar fick i 9.3, och av samma skäl: auditloggen går
-- inte att rätta i efterhand.
-- ============================================================

create table if not exists public.handlingar (
  id             uuid primary key default gen_random_uuid(),
  typ            text not null,
  titel          text not null,
  fil            text,
  mimetyp        text,
  storlek        bigint,
  kopplad_tabell text,
  kopplad_id     text,
  giltig_fran    date,
  giltig_till    date,
  anteckning     text,
  uppladdad_av   uuid references public.profiles(id) on delete set null,
  uppladdad      timestamptz not null default now()
);

alter table public.handlingar
  drop constraint if exists handlingar_typ_check;
alter table public.handlingar
  add constraint handlingar_typ_check check (typ in (
    'avtal', 'intyg', 'forsakring', 'bolagshandling', 'policy', 'ovrigt'));

alter table public.handlingar
  drop constraint if exists handlingar_koppling_check;
alter table public.handlingar
  add constraint handlingar_koppling_check check (
    kopplad_tabell is null
    or kopplad_tabell in ('profiles', 'students', 'uppdrag', 'tutor_profiles', 'invoices', 'payouts'));

comment on table public.handlingar is
  'Handlingar OM verksamheten: avtal, intyg, försäkringar, bolagspapper. '
  'Admin ensam. Undervisningsmaterial hör hemma i materials och hinken material — '
  'en provräkning som hamnar här blir osynlig för familjen den gäller.';
comment on column public.handlingar.fil is
  'Sökväg i hinken dokument, formen <handlingens id>/<filnamn>.';

create index if not exists handlingar_typ_idx on public.handlingar (typ, uppladdad desc);
create index if not exists handlingar_koppling_idx
  on public.handlingar (kopplad_tabell, kopplad_id);

alter table public.handlingar enable row level security;

drop policy if exists "admin ser handlingar" on public.handlingar;
create policy "admin ser handlingar" on public.handlingar
  for select to authenticated using (public.is_admin());

drop policy if exists "admin skriver handlingar" on public.handlingar;
create policy "admin skriver handlingar" on public.handlingar
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin ändrar handlingar" on public.handlingar;
create policy "admin ändrar handlingar" on public.handlingar
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin tar bort handlingar" on public.handlingar;
create policy "admin tar bort handlingar" on public.handlingar
  for delete to authenticated using (public.is_admin());

-- Att en handling kom till, ändrades eller togs bort. Aldrig titeln,
-- aldrig filnamnet, aldrig anteckningen.
drop trigger if exists handlingar_audit on public.handlingar;
create trigger handlingar_audit
  after insert or update or delete on public.handlingar
  for each row execute function public.logga_andring(
    'handling', 'id', 'typ', 'kopplad_tabell', 'kopplad_id',
    'giltig_fran', 'giltig_till', 'uppladdad_av');

-- ---------- hinken ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokument', 'dokument', false, 20971520, array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Fyra policyer, alla admin, alla med kravet att handlingen finns.
-- Utan det kravet hade hinken varit ett fritt filutrymme där
-- sökvägen var den enda ordningen — och en fil utan rad är en fil
-- ingen hittar och ingen kan städa. Samma fel som 9.2 rättade.
drop policy if exists "admin läser dokument" on storage.objects;
create policy "admin läser dokument" on storage.objects
  for select to authenticated
  using (bucket_id = 'dokument' and public.is_admin());

drop policy if exists "admin laddar upp dokument" on storage.objects;
create policy "admin laddar upp dokument" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dokument'
    and public.is_admin()
    and exists (select 1 from public.handlingar h
                 where h.id = public.mapp_uuid(storage.objects.name)));

drop policy if exists "admin ersätter dokument" on storage.objects;
create policy "admin ersätter dokument" on storage.objects
  for update to authenticated
  using (bucket_id = 'dokument' and public.is_admin())
  with check (bucket_id = 'dokument' and public.is_admin());

drop policy if exists "admin tar bort dokument" on storage.objects;
create policy "admin tar bort dokument" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dokument' and public.is_admin());
