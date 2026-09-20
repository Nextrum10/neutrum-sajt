-- ============================================================
-- NEXTRUM — Fas 7.1: anmälan minns vad den blev
--
-- En intresseanmälan har hittills varit en återvändsgränd. Admin
-- skapar en elev ur den och sätter status 'matched', men raden pekar
-- aldrig ut kunden som blev av den. Kundtidslinjen behöver den
-- kopplingen, och den är också svaret på frågan "hur kom den här
-- familjen in?" — den fråga hela CRM-delen finns för.
--
-- ON DELETE SET NULL, inte CASCADE: när sista barnet tas bort raderar
-- students_stada_uppdrag uppdraget, och anmälan ska inte följa med i
-- graven. Den är historik, inte en del av uppdraget.
--
-- INGEN BAKFYLLNAD. Att härleda kopplingen ur status='matched' eller
-- ur e-postadressen vore att skriva gissningar som ser ut som fakta:
-- den enda matchade anmälan i driften skapades EFTER den enda eleven,
-- och två av de kontaktade saknar kontaktad_at. Tomma kolumner är
-- ärligare än påhittade. Kopplingen skrivs hädanefter när den
-- faktiskt uppstår, i adminvyn.
--
-- INGEN NY POLICY BEHÖVS. leads läses och uppdateras redan bara av
-- admin ("endast admin läser intresseanmälningar", "admin uppdaterar
-- intresseanmälningar"). Men INSERT är öppen för vem som helst,
-- eftersom det är det publika formuläret — och RLS kan inte
-- begränsa enskilda kolumner. Därför skyddas fälten av en trigger,
-- samma mönster som skydda_studentfalt och skydda_bokningsfalt.
-- ============================================================

alter table public.leads
  add column if not exists kund_id uuid references public.profiles(id) on delete set null,
  add column if not exists uppdrag_id uuid references public.uppdrag(id) on delete set null;

comment on column public.leads.kund_id is
  'Familjen anmälan blev. Sätts av adminvyn vid inbjudan eller när en elev skapas. Null = anmälan har inte blivit en kund (än).';
comment on column public.leads.uppdrag_id is
  'Uppdraget anmälan blev. Sätts när eleven skapas; elevens eget uppdrag, som elevens_uppdrag() skapade.';

-- ------------------------------------------------------------
-- Kolumnskyddet: det publika formuläret får bara skriva det en
-- besökare rimligen kan veta om sig själv.
--
-- Utan det här kan vem som helst posta en anmälan med kund_id satt
-- till en befintlig familj, eller med status 'matched' och en
-- notering — och det syns sedan i adminvyn som om Nextrum själv
-- skrivit det. Att fältet inte finns i formuläret betyder ingenting:
-- anropet går mot ett öppet API.
--
-- Undantagen är admin (som sätter kopplingen) och service_role (som
-- är edge-funktionen bjud-in). auth.uid() duger INTE som undantag
-- här, till skillnad från i skydda_studentfalt: anmälan skickas just
-- av någon som inte är inloggad.
-- ------------------------------------------------------------
create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_admin()
     or current_user in ('service_role', 'postgres', 'supabase_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kund_id      := null;
    new.uppdrag_id   := null;
    new.status       := 'new';
    new.kontaktad_at := null;
    new.notering     := null;
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
  end if;
  return new;
end $$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;

drop trigger if exists leads_skydda on public.leads;
create trigger leads_skydda
  before insert or update on public.leads
  for each row execute function public.skydda_leadfalt();

-- ------------------------------------------------------------
-- Index. Adminvyn hämtar alltid nyast först, och tidslinjen frågar
-- per kund. Listorna är små i dag, men de växer med varje anmälan
-- och frågorna skrivs nu.
-- ------------------------------------------------------------
create index if not exists leads_skapad_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_kund_idx on public.leads (kund_id) where kund_id is not null;
create index if not exists applications_skapad_idx on public.applications (created_at desc);
create index if not exists applications_status_idx on public.applications (status);
