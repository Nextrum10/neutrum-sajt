-- ============================================================
-- NEXTRUM — Fas 7.4: rättningar efter granskningen
--
-- Sju fynd, varav ett som gjorde hela Automationer-fliken meningslös.
-- Varje funktion nedan lästes ur driften med pg_get_functiondef före
-- den skrevs om, och allt som inte nämns är ordagrant oförändrat.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MASKINENS STÄMPEL ÖVERLEVER NU TRIGGERN  (blockerande)
--
-- skapa_uppgift satte skapad_av_typ = 'system', och uppgift_stampel
-- skrev tillbaka 'manniska' med adminens id i samma andetag —
-- triggern bryr sig bara om att auth.uid() finns. Eftersom ingenting
-- är schemalagt är knappen i Automationer den ENDA väg kontrollerna
-- körs, och där finns alltid en inloggad admin. Följden: fliken
-- skrev "✓ 7 nya uppgifter" rakt ovanför "Inget som kontrollerna
-- hittat är öppet", Drift visade adminens namn som upphovsman, och
-- auditloggen — som inte går att ändra i efterhand — påstod att en
-- människa hittat det en regel hittat.
--
-- Rättningen får INTE bli "lita på värdet som skickas in". Då kan
-- vem som helst med insert-rätt klä sin egen uppgift som maskinens,
-- och provet i rls-test.sql (admin skriver skapad_av_typ = 'ai',
-- ska bli 'manniska') skulle gå från grönt till rött av rätt skäl.
--
-- I stället skiljer vi på VÄGEN in: skapa_uppgift, som bara
-- serverkod kan anropa, sätter en transaktionslokal flagga som
-- triggern läser. Ett direktinsert från en vy har ingen flagga och
-- stämplas som förut. Flaggan nollas direkt efter insert:en, så den
-- kan inte råka gälla en rad till.
-- ------------------------------------------------------------
create or replace function public.uppgift_stampel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('nextrum.maskin', true), '') = '1'
       and new.skapad_av_typ in ('system', 'ai') then
      -- Kom via skapa_uppgift. Maskinen är ingen person, och ska
      -- inte heller ärva den som råkade trycka på knappen.
      new.skapad_av := null;
    elsif auth.uid() is not null then
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
end $$;

-- ------------------------------------------------------------
-- 2. skapa_uppgift: flaggan, avbrutna uppgifter och id-formatet
--
--  · Sätter och nollar flaggan ovan.
--  · 'avbruten' räknas nu som ett svar. Förut kom en uppgift som
--    admin avfärdat tillbaka vid nästa körning, vilket gör "avbryt"
--    till en knapp utan verkan. 'klar' släpper fortfarande igenom:
--    samma faktura kan förfalla igen nästa månad.
--  · kopplad_id måste se ut som ett id för de tabeller vars nycklar
--    är uuid. Ingen av dagens kontroller kan skicka något annat, men
--    en koppling som pekar på ingenting är en länk som tyst leder fel.
-- ------------------------------------------------------------
create or replace function public.skapa_uppgift(
  p_titel          text,
  p_nyckel         text,
  p_typ            text default 'kontroll',
  p_beskrivning    text default null,
  p_kopplad_tabell text default null,
  p_kopplad_id     text default null,
  p_forfallodag    date default null,
  p_skapad_av_typ  text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tillatna text[] := array['leads','applications','profiles','students','bookings',
                           'invoices','payouts','uppdrag','tjanster','lesson_reports'];
  tab text := p_kopplad_tabell;
  idt text := p_kopplad_id;
  ny  uuid;
begin
  if p_nyckel is null or char_length(p_nyckel) < 3 then
    raise exception using errcode = '22023',
      message = 'skapa_uppgift kräver en nyckel: det är den som hindrar dubbletter.';
  end if;

  if tab is null or idt is null or not (tab = any (tillatna)) then
    tab := null;
    idt := null;
  elsif tab <> 'tjanster'
        and idt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    tab := null;
    idt := null;
  end if;

  begin
    perform set_config('nextrum.maskin', '1', true);

    insert into public.uppgifter
      (typ, titel, beskrivning, kopplad_tabell, kopplad_id, nyckel, forfallodag, skapad_av_typ)
    select coalesce(p_typ, 'kontroll'),
           left(btrim(p_titel), 200),
           left(p_beskrivning, 2000),
           tab, idt, p_nyckel, p_forfallodag,
           case when p_skapad_av_typ in ('system', 'ai') then p_skapad_av_typ else 'system' end
     where not exists (
       select 1 from public.uppgifter u
        where u.nyckel = p_nyckel and u.status in ('oppen', 'pagar', 'avbruten'))
    returning id into ny;

    perform set_config('nextrum.maskin', '', true);
  exception when unique_violation then
    -- Två körningar samtidigt. Den andra vann, och det är rätt svar.
    perform set_config('nextrum.maskin', '', true);
    return null;
  end;

  return ny;
end $$;

revoke execute on function public.skapa_uppgift(text, text, text, text, text, text, date, text)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. skydda_leadfalt: undantaget förankras i förfrågans roll
--
-- current_user är 'anon' i en vanlig PostgREST-förfrågan, men blir
-- funktionens ägare så snart insert:en går genom någon annan
-- SECURITY DEFINER-funktion som postgres äger — och kodbasen skriver
-- nästan allt känsligt genom sådana. Då hade undantaget släppt en
-- anonym besökare rakt igenom. Det är samma fälla som 7.1b stängde,
-- en nivå upp.
--
-- Nu läses rollen ur förfrågans egna claims, som ingen funktionsram
-- ändrar: 'service_role' är edge-funktionerna, inga claims alls är
-- SQL Editor och kommande cron-jobb. Allt annat skyddas.
--
-- Två saker till:
--  · UPDATE-grenen återställer nu samma fält som INSERT-grenen
--    nollar. RLS ger inga familjer skrivrätt på leads i dag, men
--    triggern är enligt husets regel det andra lagret, och ett lager
--    som bara finns på ena vägen är inget lager.
--  · tjanst sätts till standardtjänsten när anmälan gäller något som
--    inte är aktivt och kundvänt. Fältet var det enda affärsfält
--    triggern inte rörde, och Fas 7 gjorde det verksamt: "Skapa elev"
--    skriver anmälans tjänst rakt in på uppdraget. En handskriven
--    POST mot det öppna API:et hade annars kunnat lägga ett uppdrag
--    på barnvakt, som ska vara osynlig ända till lansering.
-- ------------------------------------------------------------
create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and current_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kund_id      := null;
    new.uppdrag_id   := null;
    new.status       := 'new';
    new.kontaktad_at := null;
    new.notering     := null;
    if new.tjanst is null
       or not exists (select 1 from public.tjanster t
                       where t.kod = new.tjanst and t.aktiv and t.for_kund) then
      new.tjanst := public.standard_tjanst();
    end if;
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.notering     := old.notering;
  end if;
  return new;
end $$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. kontroll_saknade_rapporter: genomförda pass räknas med, och
--    en trasig tid fäller inte körningen
--
-- Förut lästes bara status 'confirmed'. Ett pass som står som
-- 'completed' utan rapport — det finns tre i driften, från tiden före
-- rapporttriggern — föll då mellan stolarna: den här kontrollen
-- hoppade över dem för att de inte var bekräftade, och
-- kontroll_ekonomiska_avvikelser hoppade över dem för att "de har en
-- egen kontroll". Precis de pass som varken faktureras eller betalas
-- ut var alltså de enda som ingen uppgift skapades för.
--
-- Tidsformatet kontrolleras nu före pass_intervall, med samma uttryck
-- som bekrafta_inom_schemat använder. Ett enda pass med en tid som
-- inte är HH:00 hade annars fällt hela körningen med 22P02 — alla
-- fyra kontrollerna, inte bara den här.
-- ------------------------------------------------------------
create or replace function public.kontroll_saknade_rapporter(p_timmar integer default 24)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r record;
begin
  for r in
    select b.id, b.wanted_date
      from public.bookings b
     where b.status in ('confirmed', 'completed')
       and b.fakturerbar
       and b.wanted_date is not null
       and b.wanted_time is not null
       and b.wanted_time ~ '^\d{2}:00'
       and upper(public.pass_intervall(b.wanted_date, b.wanted_time, b.duration_min))
           < (now() at time zone 'Europe/Stockholm') - make_interval(hours => greatest(p_timmar, 1))
       and not exists (select 1 from public.lesson_reports lr where lr.booking_id = b.id)
     order by b.wanted_date
  loop
    if public.skapa_uppgift(
         'Pass utan rapport ' || to_char(r.wanted_date, 'YYYY-MM-DD'),
         'kontroll:saknad_rapport:bookings:' || r.id::text,
         'kontroll',
         'Passet har varit, men ingen rapport är skriven. Utan rapport räknas passet '
           || 'inte som genomfört: det faktureras inte och betalas inte ut. '
           || 'Öppna passet under Drift → Lektioner och koppla en rapport, eller markera '
           || 'passet som ej fakturerbart med en anledning.',
         'bookings', r.id::text,
         idag + 2) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 5. uppfoljning_leads_och_ansokningar: datumet i svensk tid
--
-- to_char på en timestamptz renderar i sessionens tidszon, som är
-- UTC i driften. En anmälan som kom in kvart i midnatt svensk tid
-- fick därför en uppgift som sa att den legat obesvarad sedan dagen
-- före — exakt det fel filhuvudet säger att ingen kontroll ska göra.
-- ------------------------------------------------------------
create or replace function public.uppfoljning_leads_och_ansokningar(
  p_dagar_obesvarad integer default 2,
  p_dagar_efter_kontakt integer default 7
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
  nu timestamptz := now();
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r record;
begin
  for r in
    select l.id, 'obesvarad' as steg,
           (l.created_at at time zone 'Europe/Stockholm')::date as sedan
      from public.leads l
     where l.status = 'new'
       and l.created_at < nu - make_interval(days => greatest(p_dagar_obesvarad, 1))
    union all
    select l.id, 'efter_kontakt',
           (coalesce(l.kontaktad_at, l.created_at) at time zone 'Europe/Stockholm')::date
      from public.leads l
     where l.status = 'contacted'
       and coalesce(l.kontaktad_at, l.created_at)
           < nu - make_interval(days => greatest(p_dagar_efter_kontakt, 1))
  loop
    if public.skapa_uppgift(
         case r.steg
           when 'obesvarad' then 'Obesvarad intresseanmälan sedan ' || to_char(r.sedan, 'YYYY-MM-DD')
           else 'Kontaktad familj utan beslut sedan ' || to_char(r.sedan, 'YYYY-MM-DD')
         end,
         'uppfoljning:lead:' || r.id::text || ':' || r.steg,
         'uppfoljning',
         case r.steg
           when 'obesvarad' then 'Anmälan har legat obesvarad. Ring familjen eller bjud in dem, '
             || 'och markera anmälan som kontaktad så att den lämnar kön.'
           else 'Familjen är kontaktad men har varken blivit elev eller fått anmälan stängd. '
             || 'Följ upp, eller sätt status till stängd om det inte blir något.'
         end,
         'leads', r.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;

  for r in
    select a.id, 'obesvarad' as steg,
           (a.created_at at time zone 'Europe/Stockholm')::date as sedan
      from public.applications a
     where a.status = 'new'
       and a.created_at < nu - make_interval(days => greatest(p_dagar_obesvarad, 1))
  loop
    if public.skapa_uppgift(
         'Obesvarad ansökan sedan ' || to_char(r.sedan, 'YYYY-MM-DD'),
         'uppfoljning:ansokan:' || r.id::text || ':' || r.steg,
         'uppfoljning',
         'Ansökan till studiehjälpare har legat obesvarad. Ta ställning under Rekrytering.',
         'applications', r.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;

  return n;
end $$;

-- ------------------------------------------------------------
-- 6. dagliga_kontroller: en trasig kontroll tar inte de andra med sig
--
-- Fyra kontroller i rad utan skydd betyder att ett enda fel i den
-- första gör att de tre andra aldrig körs — och det enda admin ser
-- är felmeddelandet. Nu rapporteras felet per kontroll, och resten
-- gör sitt jobb.
-- ------------------------------------------------------------
create or replace function public.dagliga_kontroller()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a integer; b integer; c integer; d integer;
  fel jsonb := '[]'::jsonb;
begin
  begin a := public.kontroll_saknade_rapporter();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'saknade_rapporter', 'fel', sqlerrm);
  end;
  begin b := public.kontroll_ekonomiska_avvikelser();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'ekonomiska_avvikelser', 'fel', sqlerrm);
  end;
  begin c := public.paminnelse_forfallna_fakturor();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'forfallna_fakturor', 'fel', sqlerrm);
  end;
  begin d := public.uppfoljning_leads_och_ansokningar();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'uppfoljningar', 'fel', sqlerrm);
  end;

  return jsonb_build_object(
    'kord', (now() at time zone 'Europe/Stockholm'),
    'saknade_rapporter', a,
    'ekonomiska_avvikelser', b,
    'forfallna_fakturor', c,
    'uppfoljningar', d,
    'nya_uppgifter', coalesce(a, 0) + coalesce(b, 0) + coalesce(c, 0) + coalesce(d, 0),
    'fel', fel);
end $$;

revoke execute on function public.kontroll_saknade_rapporter(integer) from public, anon, authenticated;
revoke execute on function public.uppfoljning_leads_och_ansokningar(integer, integer) from public, anon, authenticated;
revoke execute on function public.dagliga_kontroller() from public, anon, authenticated;
