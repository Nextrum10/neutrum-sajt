-- ============================================================
-- NEXTRUM — Fas 9.5: anmälans källa blir kolumner
--
-- Masterplanen vill ha "leads per källa". Mätningen finns redan:
-- NX.källa() läser utm-taggar, gclid, fbclid och hänvisare, och
-- NX.källrader() skriver in dem i intresseanmälans FRITEXT, sist i
-- message. Kommentaren i koden säger varför: "inga nya kolumner,
-- inget som kan gå sönder i schemat".
--
-- Det håller för en människa som läser en anmälan. Det håller inte
-- för en siffra:
--
--   · message kapas vid 4000 tecken av skydda_leadfalt. Familjens
--     egen text ligger FÖRST, källraderna sist — en lång text
--     klipper alltså bort exakt den del vi vill räkna.
--   · "Källa: google / cpc" är fritext. En vy som räknar kanaler
--     hade fått göra det med ett reguljärt uttryck mot ett fält
--     familjen själv skriver i. Skriver någon "Källa: facebook" i
--     sitt meddelande räknas det.
--   · Fältet är också det som AI:ns läsverktyg maskar hårdast,
--     eftersom det kan bära barnets namn. Räkningen skulle alltså
--     bygga på det fält vi litar minst på.
--
-- Källan får därför egna kolumner. INGEN BAKFYLLNAD ur message: att
-- läsa tillbaka siffror ur fritext är precis det den här migrationen
-- finns för att slippa. Anmälningar från före i dag får null, och
-- analysvyn måste visa dem som okända — inte som "direkt".
--
-- KOLUMNERNA ÄR INTE BETRODDA. Värdena kommer från adressraden hos
-- en anonym besökare: vem som helst kan lägga vad som helst i
-- ?utm_campaign=. Därför kapas de av samma trigger som resten, de
-- fryses vid uppdatering, och de står MED FLIT INTE i auditloggens
-- vitlista — auditloggen går inte att rätta, och en vitlista med
-- ett fält som en främling formulerar är ett läckage utan slut.
-- ============================================================

alter table public.leads
  add column if not exists kalla         text,
  add column if not exists medium        text,
  add column if not exists kampanj       text,
  add column if not exists annonsvariant text,
  add column if not exists sokord        text,
  add column if not exists hanvisare     text,
  add column if not exists landningssida text;

comment on column public.leads.kalla is
  'Kanalen: utm_source, annars google/facebook ur klick-id, annars hänvisarens '
  'värdnamn, annars "direkt". Null för anmälningar från före Fas 9.5 — okänt, '
  'inte direkt. Skrivs av en anonym besökare: behandla som otrodd text.';
comment on column public.leads.medium is 'utm_medium, eller gissningen i NX.källa().';
comment on column public.leads.landningssida is 'Sökväg och frågesträng, aldrig full adress.';

-- Kanalen är det enda fältet en vy grupperar på.
create index if not exists leads_kalla_idx on public.leads (kalla, created_at desc);

-- ---------- samma tak och samma frysning som resten ----------
-- Läst ur driften med pg_get_functiondef före ändringen. Allt utom
-- de sex nya raderna och frysningen i else-grenen är ordagrant kvar.

create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
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

    -- Längdtaken. Utan dem kan vem som helst posta en rad på flera
    -- megabyte mot det öppna API:et, och den raden läses sedan av
    -- adminvyn, av notismejlet och av AI:ns läsverktyg.
    new.parent_name := left(new.parent_name, 120);
    new.email       := left(new.email, 200);
    new.child_name  := left(new.child_name, 120);
    new.grade       := left(new.grade, 60);
    new.subject     := left(new.subject, 200);
    new.message     := left(new.message, 4000);

    -- Källfälten kommer ur adressraden och är alltså skrivna av
    -- besökaren själv. Samma tak, och tomt räknas som okänt: en
    -- tom sträng och null ska inte bli två kanaler i statistiken.
    new.kalla         := nullif(left(new.kalla, 120), '');
    new.medium        := nullif(left(new.medium, 120), '');
    new.kampanj       := nullif(left(new.kampanj, 120), '');
    new.annonsvariant := nullif(left(new.annonsvariant, 120), '');
    new.sokord        := nullif(left(new.sokord, 120), '');
    new.hanvisare     := nullif(left(new.hanvisare, 200), '');
    new.landningssida := nullif(left(new.landningssida, 200), '');
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.notering     := old.notering;

    -- Källan är en uppgift om besöket, inte om anmälan. Den kan
    -- aldrig bli sannare i efterhand, bara annorlunda.
    new.kalla         := old.kalla;
    new.medium        := old.medium;
    new.kampanj       := old.kampanj;
    new.annonsvariant := old.annonsvariant;
    new.sokord        := old.sokord;
    new.hanvisare     := old.hanvisare;
    new.landningssida := old.landningssida;
  end if;
  return new;
end $function$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;
