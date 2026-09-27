-- ============================================================
-- Fas 19.1: familjen bekräftar rapporten
--
-- Leo 2026-09-27: föräldrarna ska få rapporten i en egen post i
-- menyn, läsa den och bekräfta den. Är passet inte betalt än
-- bekräftar de genom att välja hur det betalas (kort eller, när
-- flaggan faktura är på, faktura). Är det redan betalt, som det
-- normalt är, är bekräftelsen att de läst den.
--
-- BETALNINGEN ÄR INTE BEKRÄFTELSEN. Villkoren säger fortfarande kort
-- före passet, och ett pass som hölls är ett pass som ska betalas
-- oavsett om någon trycker här. Den här tabellen säger bara att
-- familjen tagit del av rapporten. Att göra betalningen beroende av
-- ett godkännande hade gett familjen en knapp som skjuter upp
-- betalningen för ett pass som redan hållits.
--
-- EGEN TABELL, INTE EN KOLUMN PÅ lesson_reports. En uppdatering av
-- rapporten kör fyra triggrar, bland dem rapport_gor_passet_genomfort
-- och notis_vid_rapport, och familjen har ingen skrivpolicy där — ska
-- inte heller få en: RLS kan inte begränsa enskilda kolumner.
--
-- Familjen får skriva EN kolumn, rapport_id. Vem och när sätts av
-- databasen (column-level grant), så en bekräftelse går varken att
-- skriva i någon annans namn eller att bakdatera. Ingen update- eller
-- delete-policy: en bekräftelse är något som hänt, inte ett läge.
-- ============================================================

create table public.rapport_bekraftelser (
  rapport_id   uuid primary key references public.lesson_reports(id) on delete cascade,
  foralder_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  bekraftad_at timestamptz not null default now()
);

comment on table public.rapport_bekraftelser is
  'Fas 19.1: familjen har läst och bekräftat rapporten. Säger ingenting om betalningen, den står på passet.';

alter table public.rapport_bekraftelser enable row level security;

revoke all on public.rapport_bekraftelser from anon, authenticated;
grant select on public.rapport_bekraftelser to authenticated;
grant insert (rapport_id) on public.rapport_bekraftelser to authenticated;

-- Rapporten läses med familjens egen RLS: den som inte ser rapporten
-- kan inte bekräfta den. Admin ser allt men bekräftar inget åt en
-- familj — då är det inte familjen som bekräftat.
create policy "förälder bekräftar sitt barns rapport"
  on public.rapport_bekraftelser for insert to authenticated
  with check (
    foralder_id = auth.uid()
    and exists (
      select 1
        from public.lesson_reports r
        join public.students s on s.id = r.student_id
       where r.id = rapport_id
         and s.parent_id = auth.uid()
    )
  );

create policy "förälder läser sina bekräftelser, admin alla"
  on public.rapport_bekraftelser for select to authenticated
  using (foralder_id = auth.uid() or public.is_admin());
