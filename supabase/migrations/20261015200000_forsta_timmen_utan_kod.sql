-- ============================================================
-- NEXTRUM — första timmen bara med den första planen, utan rabattkod
-- (2026-10-15)
--
-- Leo 2026-10-15: "när familjen köper en plan för pris 379kr utan
-- rabattkod, ska de automatiskt få en gratis timme och det ska stå som
-- erbjudande i deras erbjudanden. sen när de köpt sin plan för första
-- gången så ändras synen på erbjudande och man får inte längre gratis
-- timme."
--
-- Två regler, båda här:
--   · En plan som köps med en rabattkod får ingen gratis timme
--     (intern.planens_forsta_timme). Koden läggs aldrig ihop med något.
--   · Erbjudandet gäller familjens första plan. Har familjen redan en
--     betald plan, också en köpt med kod, en som betalats tillbaka eller
--     en köpt före 2026-10-09, är timmen tagen (intern.forsta_timmen_tagen).
--     Då får ingen senare plan den, och vyn slutar visa erbjudandet
--     (forsta_timmen_lage() säger tagen).
-- Villkoren säger båda i en ny version, och samma version tar bort
-- meningen om första timmen pass för pass, som inte ges sedan samma dag.
-- Ingen plan var köpt med en kod när filen skrevs, och ingen kod fanns
-- utom TIPS.
-- ============================================================

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('intern.planens_forsta_timme()',  '8a64b55c14362c3491a7eaafd1f6680d'),
      ('intern.forsta_timmen_tagen(uuid)', '76af72b3bae9b2235d85712b8094fb42')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('forsta_timmen_utan_kod' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan forsta_timmen_utan_kod skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;

  -- En nyare version av villkoren än den här filens ska inte skrivas över.
  if intern.villkor_version() > '2026-10-16' then
    raise exception 'Villkoren har redan versionen %. Läs driften och sidan innan versionen byts.',
      intern.villkor_version();
  end if;
end $$;


-- ---------- 1. tagen: en betald plan räknas ----------
-- Förut räknades bara en plan som fått timmen (forsta_timmen). En plan
-- köpt med kod får ingen, och då hade nästa plan fått den: erbjudandet
-- gäller den första planen, inte den första utan kod. betald_at står kvar
-- när en plan betalas tillbaka, som forsta_timmen gör: timmen kan ha
-- använts. En plan som bara väntar på kassan räknas inte. Kortet som
-- blir betalt i samma UPDATE ser sig självt utan betald_at, för
-- planens_forsta_timme är en BEFORE-trigger.
create or replace function intern.forsta_timmen_tagen(p_familj uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  -- forsta_timmen_utan_kod (2026-10-15)
  select exists (select 1 from public.bookings b
                  where b.parent_id = p_familj and b.startrabatt and b.status <> 'cancelled'
                    and b.rabattkod is distinct from 'TIPS')
      or exists (select 1 from public.klippkort k
                  where k.parent_id = p_familj
                    and (k.forsta_timmen or (k.sort = 'plan' and k.betald_at is not null)))
$function$;

comment on function intern.forsta_timmen_tagen(uuid) is
  '2026-10-15 (forsta_timmen_utan_kod). Sann när familjen fått första timmen på ett pass, i en plan, eller har betalat en plan alls: erbjudandet gäller den första planen.';


-- ---------- 2. ingen timme på en plan köpt med kod ----------
-- Koden står fast från köpet (klippkort_rabatt_star_fast), så den läses
-- ur OLD: en UPDATE som tar bort koden i samma stund som planen blir
-- betald får ändå ingen timme, för den andra triggern lägger tillbaka
-- koden efter den här.
create or replace function intern.planens_forsta_timme()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- forsta_timmen_utan_kod (2026-10-15)
  if new.sort is distinct from 'plan' or new.forsta_timmen or new.parent_id is null
     or old.rabattkod is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  if intern.forsta_timmen_tagen(new.parent_id) then
    return new;
  end if;

  new.timmar := new.timmar + 1;
  new.timmar_pa_kopet := coalesce(new.timmar_pa_kopet, 0) + 1;
  new.forsta_timmen := true;
  return new;
end $function$;

comment on function intern.planens_forsta_timme() is
  '2026-10-15 (forsta_timmen_utan_kod). Den första planen familjen betalar får en timme till, om den inte köptes med en rabattkod.';


-- ---------- 3. villkoren ----------
-- anvandarvillkor.html (och den engelska sidan) säger 16 oktober 2026:
-- Första timmen gratis gäller den första planen utan rabattkod, och
-- meningen om timmen pass för pass är borta. Alla får frågan igen.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-16'::text $$;
