-- ============================================================
-- NEXTRUM — Fas 8.2: förslagstabellen
--
-- Regeln i masterplanen är att AI:n aldrig skriver i affärstabeller.
-- Den skriver FÖRSLAG. En människa läser, godkänner eller avvisar,
-- och det är en serverfunktion — inte modellen — som utför.
--
-- VARFÖR INTE BARA EN UPPGIFT?
-- uppgifter finns redan och beskriver vad någon ska GÖRA, i fri text.
-- Ett förslag är något annat: en maskinläsbar åtgärd som systemet kan
-- utföra åt dig när du trycker ja. Uppgiften "kolla matchningen för
-- Elin" och förslaget {typ: matchning, elev: …, hjalpare: …} ser lika
-- ut på skärmen men skiljer sig i vad ett klick betyder. Att blanda
-- dem hade gjort payload till ett fält som ibland betyder något.
--
-- TRE STATUS, INTE FYRA.
-- Planen nämner 'godkänd' som ett eget läge. Den finns inte här, och
-- det är med flit: godkännandet och utförandet sker i SAMMA
-- transaktion (8.5). Ett förslag kan alltså aldrig stå som godkänt
-- men inte utfört, och därmed finns inget läge där någon måste komma
-- ihåg att köra klart något. Misslyckas utförandet rullas allt
-- tillbaka och förslaget står kvar som föreslaget, med felet sparat.
--
-- EN NYCKEL, ETT FÖRSLAG, FÖR ALLTID.
-- Nyckeln bär vad förslaget gäller, ända ner till vilket par det
-- rör: 'match:elev:<id>:hjalpare:<id>'. Har det förslaget en gång
-- avvisats kommer det inte tillbaka nästa körning — beslutet står.
-- Ändras förutsättningarna blir det ett annat par, alltså en annan
-- nyckel, alltså ett nytt förslag. Det är skillnaden mot uppgifter,
-- där ett avslutat ärende får återkomma.
--
-- TYPERNA ÄR FÅ MED FLIT.
-- Bara åtgärder som har en färdig, prövad väg i databasen och en
-- motsvarande knapp i adminvyn. Att lägga till en typ är att skriva
-- en gren i godkann_forslag (8.5) — aldrig ett generiskt
-- "update <tabell> set <payload>", som hade gjort payload till en
-- kommandorad.
-- ============================================================

create table if not exists public.ai_forslag (
  id             uuid primary key default gen_random_uuid(),
  typ            text not null check (typ in ('matchning', 'pass_ej_fakturerbart', 'lead_status')),
  payload        jsonb not null default '{}'::jsonb,
  motivering     text check (motivering is null or char_length(motivering) <= 2000),
  status         text not null default 'foreslagen'
                 check (status in ('foreslagen', 'avvisad', 'utford')),
  nyckel         text not null check (char_length(nyckel) between 3 and 200),
  korning_id     uuid references public.agent_korningar(id) on delete set null,
  kopplad_tabell text check (kopplad_tabell is null or kopplad_tabell in
                   ('leads','applications','profiles','students','bookings','invoices',
                    'payouts','uppdrag','tjanster','lesson_reports')),
  kopplad_id     text,
  skapad         timestamptz not null default now(),
  beslutad_av    uuid references public.profiles(id) on delete set null,
  beslutad       timestamptz,
  utford         timestamptz,
  fel            text,
  check ((kopplad_tabell is null) = (kopplad_id is null)),
  check ((status = 'foreslagen') = (beslutad_av is null and beslutad is null)),
  check ((status = 'utford') = (utford is not null))
);

comment on table public.ai_forslag is
  'Åtgärder AI:n föreslår. Utförs bara av godkann_forslag(), aldrig av modellen. En nyckel = ett förslag, för alltid.';
comment on column public.ai_forslag.payload is
  'Maskinläsbara fält för åtgärden. Läses BARA av den gren i godkann_forslag som hör till typen — aldrig som en generisk uppdatering.';

create unique index if not exists ai_forslag_nyckel_idx on public.ai_forslag (nyckel);
create index if not exists ai_forslag_oppna_idx on public.ai_forslag (status, skapad desc);
create index if not exists ai_forslag_korning_idx on public.ai_forslag (korning_id);

-- ------------------------------------------------------------
-- Rättigheter. Standardgrants ger anon och authenticated full DML på
-- nya tabeller i det här projektet (se agent_korningar, som fick just
-- det). Här skrivs de bort för hand innan tabellen finns i någon vy.
-- ------------------------------------------------------------
alter table public.ai_forslag enable row level security;

revoke all on public.ai_forslag from anon, authenticated;
grant select on public.ai_forslag to authenticated;

drop policy if exists "admin laser forslag" on public.ai_forslag;
create policy "admin laser forslag" on public.ai_forslag
  for select using (public.is_admin());

-- ------------------------------------------------------------
-- Det AI:n föreslog ska vara det admin godkänner. Triggern fryser
-- innehållet: efter att raden skapats går bara beslutsfälten att
-- ändra. Utan den hade en ändring mellan förslag och klick varit
-- osynlig — och det är just den sortens glapp hela konstruktionen
-- finns för att stänga.
-- ------------------------------------------------------------
create or replace function public.frys_forslaget()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.id         := old.id;
  new.typ        := old.typ;
  new.payload    := old.payload;
  new.motivering := old.motivering;
  new.nyckel     := old.nyckel;
  new.korning_id := old.korning_id;
  new.skapad     := old.skapad;
  new.kopplad_tabell := old.kopplad_tabell;
  new.kopplad_id     := old.kopplad_id;
  return new;
end $$;

revoke execute on function public.frys_forslaget() from public, anon, authenticated;

drop trigger if exists ai_forslag_frys on public.ai_forslag;
create trigger ai_forslag_frys
  before update on public.ai_forslag
  for each row execute function public.frys_forslaget();

-- Auditloggen följer besluten. Payload loggas INTE: den kan innehålla
-- fritext, och auditloggen ska bara bära tillstånd och kopplingar.
drop trigger if exists ai_forslag_audit on public.ai_forslag;
create trigger ai_forslag_audit
  after insert or delete or update on public.ai_forslag
  for each row execute function public.logga_andring(
    'ai_forslag', 'id', 'typ', 'status', 'nyckel', 'korning_id', 'beslutad_av');

-- ------------------------------------------------------------
-- Den enda skrivvägen in. Samma mönster som skapa_uppgift: nyckeln
-- är obligatorisk, funktionen svarar null när förslaget redan finns,
-- och ingen klient kommer åt den.
-- ------------------------------------------------------------
create or replace function public.ai_skapa_forslag(
  p_typ            text,
  p_nyckel         text,
  p_payload        jsonb default '{}'::jsonb,
  p_motivering     text default null,
  p_korning        uuid default null,
  p_kopplad_tabell text default null,
  p_kopplad_id     text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ny uuid;
begin
  if p_nyckel is null or char_length(p_nyckel) < 3 then
    raise exception using errcode = '22023',
      message = 'ai_skapa_forslag kräver en nyckel: den är det som hindrar att samma förslag återkommer.';
  end if;

  begin
    insert into public.ai_forslag (typ, nyckel, payload, motivering, korning_id, kopplad_tabell, kopplad_id)
    select p_typ, p_nyckel, coalesce(p_payload, '{}'::jsonb), left(p_motivering, 2000),
           p_korning, p_kopplad_tabell, p_kopplad_id
     where not exists (select 1 from public.ai_forslag f where f.nyckel = p_nyckel)
    returning id into ny;
  exception when unique_violation then
    return null;
  end;

  return ny;
end $$;

comment on function public.ai_skapa_forslag(text, text, jsonb, text, uuid, text, text) is
  'Skapar ett förslag om nyckeln är ledig. Svarar med id, eller null när förslaget redan finns. Bara för serverkod.';

revoke execute on function public.ai_skapa_forslag(text, text, jsonb, text, uuid, text, text)
  from public, anon, authenticated;

-- En uppgift ska kunna peka på ett förslag, och tvärtom. Listan finns
-- på två ställen — i check-villkoret och i skapa_uppgift — och båda
-- måste ändras, annars nollas kopplingen tyst.
alter table public.uppgifter drop constraint if exists uppgifter_kopplad_tabell_check;
alter table public.uppgifter
  add constraint uppgifter_kopplad_tabell_check
  check (kopplad_tabell is null or kopplad_tabell = any (array[
    'leads','applications','profiles','students','bookings','invoices',
    'payouts','uppdrag','tjanster','lesson_reports','ai_forslag']));
