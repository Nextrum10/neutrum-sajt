-- ============================================================
-- NEXTRUM — schema v4: kontakten mellan familj och studiehjälpare
-- Kör EFTER schema.sql, schema-v2.sql och schema-v3.sql.
-- Rensar ingenting, går att köra om utan att något går sönder.
--
-- Vad den här filen lägger till:
--   1. meddelanden  — en tråd per matchning, båda kan skriva
--   2. bokningar    — studiehjälparen kan FÖRESLÅ en tid, inte bara
--                     bekräfta den familjen valt
--   3. ett hål täpps — en förälder kunde tidigare boka tider hos
--                     vilken studiehjälpare som helst
-- ============================================================


-- ============================================================
-- 1. HJÄLPFUNKTION — är de här två faktiskt matchade?
-- Samma princip som is_admin() i schema.sql: en policy som frågar
-- "profiles" trigger annars profiles egna RLS-regler igen. SECURITY
-- DEFINER bryter kedjan. Funktionen lämnar bara ut true/false.
-- ============================================================
create or replace function public.ar_matchade(parent_uuid uuid, tutor_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = parent_uuid
      and p.matched_tutor_id = tutor_uuid
      and p.match_status = 'matched'
  )
$$;


-- ============================================================
-- 2. MESSAGES — tråden mellan en familj och deras studiehjälpare
--
-- Tråden identifieras av paret (parent_id, tutor_id), inte av ett
-- eget conversation-id. Skälet: matchningen ÄR relationen, den finns
-- redan i profiles. En extra tabell hade bara kunnat hamna ur synk
-- med den.
--
-- sender_id säger vem som skrev. Den kollas mot auth.uid() i
-- policyn, så ingen kan skriva i någon annans namn.
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id  uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Tråden hämtas alltid som "alla meddelanden för det här paret,
-- i tidsordning". Indexet gör exakt den frågan billig.
create index if not exists messages_trad_idx
  on public.messages (parent_id, tutor_id, created_at);

drop policy if exists "deltagare läser tråden" on public.messages;
create policy "deltagare läser tråden" on public.messages
  for select using (auth.uid() = parent_id or auth.uid() = tutor_id);

-- Tre villkor, alla tre behövs:
--   sender_id = auth.uid()   → ingen skriver i någon annans namn
--   auth.uid() är deltagare  → ingen skriver in sig i andras tråd
--   ar_matchade(...)         → paret måste finnas på riktigt, annars
--                              kunde vem som helst med ett konto mejla
--                              vilken studiehjälpare som helst genom
--                              att gissa ett id
drop policy if exists "deltagare skriver i tråden" on public.messages;
create policy "deltagare skriver i tråden" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (auth.uid() = parent_id or auth.uid() = tutor_id)
    and public.ar_matchade(parent_id, tutor_id)
  );

-- Update finns bara för att kunna markera som läst. Vad som faktiskt
-- får ändras sköts av triggern nedan — RLS kan inte begränsa kolumner.
drop policy if exists "deltagare markerar som läst" on public.messages;
create policy "deltagare markerar som läst" on public.messages
  for update using (auth.uid() = parent_id or auth.uid() = tutor_id);

drop policy if exists "admin läser alla meddelanden" on public.messages;
create policy "admin läser alla meddelanden" on public.messages
  for select using (public.is_admin());

-- Ingen delete-policy, med flit: ett skickat meddelande går inte att
-- radera i efterhand. Tråden är en logg över vad som faktiskt sagts
-- mellan en vuxen och ett barns familj, och den ska gå att lita på.

-- ---------- vad en update får röra ----------
-- Utan den här kunde vem som helst i tråden skriva om ett gammalt
-- meddelande — sitt eget ELLER motpartens — eftersom RLS bara kan
-- säga ja eller nej till hela raden. Samma mönster som
-- skydda_profilfalt() i schema-v3.sql.
create or replace function public.skydda_meddelande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- allt utom read_at återställs
  new.id         := old.id;
  new.parent_id  := old.parent_id;
  new.tutor_id   := old.tutor_id;
  new.sender_id  := old.sender_id;
  new.body       := old.body;
  new.created_at := old.created_at;

  -- och read_at får bara sättas av mottagaren, inte av avsändaren
  if auth.uid() = old.sender_id then
    new.read_at := old.read_at;
  end if;

  return new;
end $$;

drop trigger if exists messages_skydda on public.messages;
create trigger messages_skydda
  before update on public.messages
  for each row execute function public.skydda_meddelande();


-- ============================================================
-- 3. BOOKINGS — vem föreslog tiden?
--
-- Hittills kunde bara familjen skapa ett pass. Studiehjälparen kunde
-- bekräfta eller avboka, men aldrig säga "jag kan på torsdag". Nu kan
-- båda lägga ett förslag; det får status 'requested' och motparten
-- bekräftar. created_by säger vem som föreslog, så vyerna kan visa
-- "du föreslog" respektive "familjen önskade".
-- ============================================================
alter table public.bookings
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists note text;

-- Gamla rader saknar created_by. De skapades alltid av föräldern,
-- så det är rätt värde att fylla i — och det görs bara en gång.
update public.bookings set created_by = parent_id where created_by is null;

-- ---------- föräldern: hårdare än förut ----------
-- Den gamla policyn krävde bara auth.uid() = parent_id. Alltså kunde
-- en inloggad förälder skapa bokningar mot VILKET tutor_id som helst.
-- Ingen fick se dem, men det unika indexet bookings_tutor_slot_unique
-- gäller ändå — så man kunde blockera en främmande studiehjälpares
-- kalender, tid för tid, utan att någon såg vem som gjorde det.
-- Nu måste tutor_id vara familjens egen matchning.
drop policy if exists "förälder skapar bokning" on public.bookings;
create policy "förälder skapar bokning" on public.bookings
  for insert with check (
    auth.uid() = parent_id
    and created_by = auth.uid()
    and (tutor_id is null or public.is_my_matched_tutor(tutor_id))
  );

-- ---------- studiehjälparen: får föreslå tider ----------
drop policy if exists "studiehjälpare föreslår tid" on public.bookings;
create policy "studiehjälpare föreslår tid" on public.bookings
  for insert with check (
    auth.uid() = tutor_id
    and created_by = auth.uid()
    and public.is_matched_tutor_of(parent_id)
  );


-- ============================================================
-- 4. OLÄSTA — en vy i stället för att räkna i webbläsaren
-- security_invoker gör att vyn lyder messages egna RLS-regler:
-- man ser bara sina egna trådar.
-- ============================================================
create or replace view public.olasta_meddelanden as
  select parent_id, tutor_id, sender_id, count(*) as antal
  from public.messages
  where read_at is null
  group by parent_id, tutor_id, sender_id;

alter view public.olasta_meddelanden set (security_invoker = true);
grant select on public.olasta_meddelanden to authenticated;


-- ============================================================
-- KLART.
--
-- Efter den här filen kan familjen och studiehjälparen:
--   · skriva till varandra i vyerna, utan att byta till mejl
--   · båda föreslå tider, och bekräfta varandras förslag
--
-- Fortfarande manuellt (och det är okej så länge ni är små):
--   · matchningen görs i Table Editor, se schema-v3.sql
--   · betalning ligger utanför plattformen
--   · ingen notis går ut när ett meddelande kommer — den som inte
--     är inloggad ser det först nästa gång hen loggar in. Vill ni
--     ändra det är det en Edge Function med e-post, inte en
--     ändring i det här schemat.
-- ============================================================
