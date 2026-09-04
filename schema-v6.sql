-- ============================================================
-- NEXTRUM — schema v6: lagring för material och profilbilder
-- Kör EFTER v5. Rensar ingenting.
--
-- Båda hinkarna är PRIVATA. Det hade varit enklare med publika —
-- då blir avatar_url en vanlig adress som funkar överallt — men en
-- publik hink betyder att vem som helst med länken kan öppna filen,
-- för alltid. Det här är bilder på barn och material knutet till
-- namngivna elever. Sidan hämtar signerade länkar i stället; de
-- slutar gälla av sig själva.
-- ============================================================


-- ============================================================
-- 1. HINKARNA
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('material', 'material', false, 10485760,
   array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'text/plain']),
  ('avatarer', 'avatarer', false, 5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2. HJÄLPFUNKTION — första mappen som uuid, eller null
--
-- Sökvägarna är "<elev-id>/<filnamn>" och "<användar-id>/<filnamn>".
-- Policyerna måste läsa ut id:t ur sökvägen, men en rå ::uuid-cast
-- kastar fel om någon laddar upp till "hej/fil.pdf" — och ett fel i
-- en policy blir ett obegripligt 500-svar i stället för ett nekat
-- försök. Den här returnerar null i stället, och null nekar.
-- ============================================================
create or replace function public.mapp_uuid(sokvag text)
returns uuid
language plpgsql
immutable
as $$
declare u uuid;
begin
  begin
    u := (storage.foldername(sokvag))[1]::uuid;
  exception when others then
    return null;
  end;
  return u;
end $$;


-- ============================================================
-- 3. MATERIAL — filerna
-- Sökväg: <elev-id>/<tidsstämpel>-<filnamn>
-- ============================================================
drop policy if exists "studiehjälpare laddar upp material" on storage.objects;
create policy "studiehjälpare laddar upp material" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material'
    and public.is_my_student(public.mapp_uuid(name))
  );

drop policy if exists "studiehjälpare tar bort material" on storage.objects;
create policy "studiehjälpare tar bort material" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material'
    and public.is_my_student(public.mapp_uuid(name))
  );

-- Både studiehjälparen och familjen ska kunna öppna filen — men
-- bara för sin egen elev.
drop policy if exists "berörda läser material" on storage.objects;
create policy "berörda läser material" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material'
    and (
      public.is_my_student(public.mapp_uuid(name))
      or exists (
        select 1 from public.students s
        where s.id = public.mapp_uuid(name) and s.parent_id = auth.uid()
      )
    )
  );


-- ============================================================
-- 4. PROFILBILDER
-- Sökväg: <användar-id>/<tidsstämpel>.webp
-- Man äger sin egen bild och ingen annans.
-- ============================================================
drop policy if exists "egen profilbild upp" on storage.objects;
create policy "egen profilbild upp" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatarer' and public.mapp_uuid(name) = auth.uid());

drop policy if exists "egen profilbild ersätt" on storage.objects;
create policy "egen profilbild ersätt" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatarer' and public.mapp_uuid(name) = auth.uid());

drop policy if exists "egen profilbild bort" on storage.objects;
create policy "egen profilbild bort" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatarer' and public.mapp_uuid(name) = auth.uid());

-- Inloggade får se varandras profilbilder. Sökvägen innehåller ett
-- uuid, så den går inte att gissa, och en signerad länk slutar
-- gälla. Alternativet — att bara matchade motparter får se — hade
-- krävt en fråga per bild i varje lista.
drop policy if exists "inloggade ser profilbilder" on storage.objects;
create policy "inloggade ser profilbilder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatarer');


-- ============================================================
-- 5. MATERIALRADEN VET VAR FILEN LIGGER
-- url används för både länkar utåt och sökvägar i hinken. kind
-- säger vilket det är, så frontend vet om den ska signera eller
-- bara öppna.
-- ============================================================
alter table public.materials
  add column if not exists file_name text,
  add column if not exists file_size int;


-- ============================================================
-- KLART.
--
-- Att veta om signerade länkar: de gäller en timme och skapas när
-- sidan laddar. Delar någon vidare en sådan länk slutar den funka
-- av sig själv — vilket är hela poängen.
-- ============================================================
