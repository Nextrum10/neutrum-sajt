-- ============================================================
-- NEXTRUM — program 2, Fas 1.2: förberedelsen inför ett pass
--
-- Passdetaljen ska visa "vad som ska göras" och "länk/plats". Plats
-- finns (bookings.location), men den skrivs av familjen när den
-- bokar och går sedan inte att ändra. Något som studiehjälparen
-- skriver inför passet fanns inte alls, och ingen länk till ett
-- möte fanns någonstans.
--
-- VARFÖR EN EGEN TABELL OCH INTE TVÅ KOLUMNER PÅ bookings
--
-- skydda_bokningsfalt (F-6) släpper bara status, tid, created_by och
-- närvaro på ett bokat pass. En ny kolumn hade antingen varit omöjlig
-- för studiehjälparen att sätta, eller krävt att listan över fria
-- fält i den triggern vidgades — och en kolumn i den listan blir
-- ändringsbar också för familjen, genom policyn "förälder uppdaterar
-- egna bokningar". F-6 får inte försvagas för ett nytt flöde. En
-- egen tabell med egen RLS rör inte triggern alls.
--
-- VEM SKRIVER: passets studiehjälpare, och bara om eleven är hens
-- (is_my_student). Kravet på eleven är inte dubbelt upp: en
-- studiehjälpare som är matchad med ett syskon kan annars skriva i
-- det andra barnets pass. Pass utan elev går inte att förbereda —
-- det är samma pass som inte går att rapportera (Fas 1.4).
-- Familjen läser. Admin gör allt.
--
-- LÄNKEN är bara https och bara till en känd mötestjänst. Den ritas
-- som en klickbar länk i en vy som familjer och barn öppnar, och en
-- länk som går vart som helst är en länk som kan gå till en falsk
-- inloggningssida. Listan står i villkoret; en ny tjänst är en ny
-- migration, med flit.
--
-- INGEN AUDITTRIGGER. att_gora är fritext om ett barn ("Elsa ska
-- öva på bråk"), och auditloggen går inte att rätta — samma skäl som
-- materials och admin_noteringar saknar en.
-- ============================================================

create table if not exists public.pass_forberedelse (
  booking_id    uuid primary key references public.bookings(id) on delete cascade,
  att_gora      text,
  lank          text,
  uppdaterad    timestamptz not null default now(),
  uppdaterad_av uuid references public.profiles(id) on delete set null
);

alter table public.pass_forberedelse
  drop constraint if exists pass_forberedelse_att_gora_check;
alter table public.pass_forberedelse
  add constraint pass_forberedelse_att_gora_check
  check (att_gora is null or char_length(att_gora) between 1 and 1000);

alter table public.pass_forberedelse
  drop constraint if exists pass_forberedelse_lank_check;
alter table public.pass_forberedelse
  add constraint pass_forberedelse_lank_check check (
    lank is null or (
      char_length(lank) <= 500
      and lank ~ '^https://(meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|([a-z0-9-]+\.)?zoom\.us|([a-z0-9-]+\.)?whereby\.com|meet\.jit\.si|facetime\.apple\.com)(/[^[:space:]<>"'']*)?$'
    ));

comment on table public.pass_forberedelse is
  'Det studiehjälparen skriver inför ett pass: vad som ska göras och länken till mötet. '
  'Egen tabell så att skydda_bokningsfalt (F-6) inte behöver vidgas. Ingen audittrigger: att_gora är fritext om ett barn.';
comment on column public.pass_forberedelse.lank is
  'Bara https och bara till en känd mötestjänst (se villkoret). Ritas som klickbar länk för familjen.';

alter table public.pass_forberedelse enable row level security;

revoke all on public.pass_forberedelse from anon, authenticated;
grant select, insert, update, delete on public.pass_forberedelse to authenticated;

-- Samma villkor för att skriva, uppdatera och ta bort. Ett pass som
-- är genomfört eller avbokat är fruset, precis som i F-6.
create or replace function public.far_forbereda_passet(p_pass uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
     where b.id = p_pass
       and b.tutor_id = auth.uid()
       and b.status in ('requested', 'confirmed')
       and b.student_id is not null
       and public.is_my_student(b.student_id)
  )
$$;

revoke execute on function public.far_forbereda_passet(uuid) from public, anon;
grant execute on function public.far_forbereda_passet(uuid) to authenticated;

drop policy if exists "admin hanterar förberedelser" on public.pass_forberedelse;
create policy "admin hanterar förberedelser" on public.pass_forberedelse
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "berörda läser förberedelsen" on public.pass_forberedelse;
create policy "berörda läser förberedelsen" on public.pass_forberedelse
  for select to authenticated using (
    exists (select 1 from public.bookings b
             where b.id = pass_forberedelse.booking_id
               and (b.parent_id = auth.uid() or b.tutor_id = auth.uid())));

drop policy if exists "studiehjälparen skriver förberedelsen" on public.pass_forberedelse;
create policy "studiehjälparen skriver förberedelsen" on public.pass_forberedelse
  for insert to authenticated with check (public.far_forbereda_passet(booking_id));

drop policy if exists "studiehjälparen ändrar förberedelsen" on public.pass_forberedelse;
create policy "studiehjälparen ändrar förberedelsen" on public.pass_forberedelse
  for update to authenticated
  using (public.far_forbereda_passet(booking_id))
  with check (public.far_forbereda_passet(booking_id));

drop policy if exists "studiehjälparen tar bort förberedelsen" on public.pass_forberedelse;
create policy "studiehjälparen tar bort förberedelsen" on public.pass_forberedelse
  for delete to authenticated using (public.far_forbereda_passet(booking_id));

-- Stämplarna sätts här, inte av klienten. booking_id går inte att
-- byta: en förberedelse flyttad till ett annat pass är en förberedelse
-- för fel barn.
create or replace function public.stampla_forberedelsen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.booking_id := old.booking_id;
  end if;
  new.att_gora      := nullif(btrim(coalesce(new.att_gora, '')), '');
  new.lank          := nullif(btrim(coalesce(new.lank, '')), '');
  new.uppdaterad    := now();
  new.uppdaterad_av := auth.uid();
  return new;
end $$;

revoke execute on function public.stampla_forberedelsen() from public, anon, authenticated;

drop trigger if exists pass_forberedelse_stampla on public.pass_forberedelse;
create trigger pass_forberedelse_stampla before insert or update on public.pass_forberedelse
  for each row execute function public.stampla_forberedelsen();
