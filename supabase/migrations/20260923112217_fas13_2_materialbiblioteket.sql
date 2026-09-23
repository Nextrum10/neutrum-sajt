/* ============================================================
   Fas 13.2 — materialbiblioteket

   `materials` är elevens material: student_id är NOT NULL,
   skrivpolicyn kräver is_my_student(), och hinken `material`
   kräver att sökvägen börjar med ett elev-uuid. Ett delat bibliotek
   går alltså inte att bygga där — varje rad hade behövt en elev som
   inte finns, och den första som hittade på ett uuid hade fått en
   fil ingen kan hitta igen.

   Därför en egen tabell och en egen hink. Biblioteket hör till
   Nextrum, inte till ett barn: samma övningsblad ska kunna ges till
   femtio elever utan att ligga i femtio mappar.

   ÅRSKURSEN ÄR ENSKILD, INTE ETT SPANN.
   students.grade är enskild ("Åk 7"), och matchningen läser den.
   Ett bibliotek med spann ("Åk 7–9") hade krävt en översättning vid
   varje sökning, och den översättningen hade bara funnits i JS.

   LÄXAN PEKAR, DEN KOPIERAR INTE.
   homework.bibliotek_id refererar raden. Ett övningsblad som
   rättas ska rättas en gång, inte i femtio kopior — och en kopia
   per elev hade gjort hinken till det enda stället sanningen fanns.
   ============================================================ */

/* ---- vem är en godkänd studiehjälpare? ----
   Fanns inte. Noll policyer nämnde tutor_profiles, så "godkänd
   studiehjälpare" var något adminvyn visste och databasen inte.
   Biblioteket är det första som behöver frågan besvarad i RLS. */
create or replace function public.ar_godkand_studiehjalpare(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.tutor_profiles t
    where t.id = uid and t.status = 'approved'
  )
$$;

comment on function public.ar_godkand_studiehjalpare(uuid) is
  'Sant när uid har en godkänd profil i tutor_profiles. SECURITY DEFINER '
  'därför att den anropas ur policyer på tabeller anroparen inte får läsa.';

revoke all on function public.ar_godkand_studiehjalpare(uuid) from public;
grant execute on function public.ar_godkand_studiehjalpare(uuid) to authenticated;

/* ---- årskurserna ----
   Tolv värden, låsta i ett check-villkor. Fritext hade betytt att
   "åk7", "Åk 7" och "7" blir tre årskurser, och ett filter som
   missar två tredjedelar av biblioteket ser ut som ett tomt
   bibliotek. */
create table if not exists public.biblioteksmaterial (
  id           uuid primary key default gen_random_uuid(),
  titel        text not null check (length(btrim(titel)) between 1 and 200),
  beskrivning  text,
  amne         text not null check (length(btrim(amne)) between 1 and 80),
  arskurs      text not null check (arskurs in (
                 'ak1','ak2','ak3','ak4','ak5','ak6','ak7','ak8','ak9',
                 'gy1','gy2','gy3')),
  filvag       text,
  lank         text,
  aktiv        boolean not null default true,
  skapad_av    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  /* En rad utan fil och utan länk är en rubrik som inte leder
     någonstans. Beskrivningen räcker inte: en studiehjälpare som
     klickar "Ge som läxa" ska få med sig något eleven kan öppna. */
  constraint biblioteksmaterial_har_innehall
    check (filvag is not null or lank is not null)
);

comment on table public.biblioteksmaterial is
  'Nextrums delade materialbank. Hör till bolaget, inte till en elev — '
  'därför egen tabell och egen hink, inte materials.';

create index if not exists biblioteksmaterial_sok
  on public.biblioteksmaterial (arskurs, amne) where aktiv;

alter table public.biblioteksmaterial enable row level security;

drop policy if exists "admin sköter biblioteket" on public.biblioteksmaterial;
create policy "admin sköter biblioteket" on public.biblioteksmaterial
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/* Studiehjälparen läser, aldrig skriver. Biblioteket är kurerat —
   blir det ett fritt uppladdningsutrymme är det inte längre ett
   urval, och då är filtret på ämne och årskurs ingenting värt. */
drop policy if exists "godkänd studiehjälpare läser biblioteket" on public.biblioteksmaterial;
create policy "godkänd studiehjälpare läser biblioteket" on public.biblioteksmaterial
  for select to authenticated
  using (aktiv and public.ar_godkand_studiehjalpare());

/* ---- läxan pekar på biblioteket ---- */
alter table public.homework
  add column if not exists bibliotek_id uuid
    references public.biblioteksmaterial(id) on delete set null;

comment on column public.homework.bibliotek_id is
  'Materialet läxan bygger på. on delete set null: en läxa som gjorts '
  'ska inte försvinna för att ett övningsblad plockas bort ur banken.';

/* Familjen ska kunna se VAD läxan bygger på. Utan den här raden
   pekar läxan på något familjen får tomt svar om, och en läxa med
   ett material som inte går att öppna är en läxa som inte går att
   göra. */
drop policy if exists "familj läser bibliotek via läxa" on public.biblioteksmaterial;
create policy "familj läser bibliotek via läxa" on public.biblioteksmaterial
  for select to authenticated
  using (exists (
    select 1 from public.homework h
    join public.students s on s.id = h.student_id
    where h.bibliotek_id = biblioteksmaterial.id
      and s.parent_id = auth.uid()
  ));

/* ---- hinken ----
   Sökvägen är materialets uuid, aldrig ett namn. Ett filnamn heter
   i praktiken "Provräkning åk 8 v42.pdf", och sökvägen är det enda
   i en hink som syns innan man öppnat filen. Samma regel som
   `material` och `dokument`. */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bibliotek', 'bibliotek', false, 10485760, array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin laddar upp bibliotek" on storage.objects;
create policy "admin laddar upp bibliotek" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bibliotek'
    and public.is_admin()
    and exists (select 1 from public.biblioteksmaterial b
                 where b.id = public.mapp_uuid(storage.objects.name)));

drop policy if exists "admin ersätter bibliotek" on storage.objects;
create policy "admin ersätter bibliotek" on storage.objects
  for update to authenticated
  using (bucket_id = 'bibliotek' and public.is_admin())
  with check (bucket_id = 'bibliotek' and public.is_admin());

drop policy if exists "admin tar bort bibliotek" on storage.objects;
create policy "admin tar bort bibliotek" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bibliotek' and public.is_admin());

/* Läsning: admin, varje godkänd studiehjälpare, och den familj som
   har en läxa som pekar på raden. Alla tre går genom raden i
   biblioteksmaterial — en fil utan rad är oläsbar för alla, och det
   är med flit: då går den också att städa. */
drop policy if exists "bibliotek läses av admin, hjälpare och berörd familj" on storage.objects;
create policy "bibliotek läses av admin, hjälpare och berörd familj" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (
          public.is_admin()
          or (b.aktiv and public.ar_godkand_studiehjalpare())
          or exists (
            select 1 from public.homework h
            join public.students s on s.id = h.student_id
            where h.bibliotek_id = b.id and s.parent_id = auth.uid()
          )
        )));
