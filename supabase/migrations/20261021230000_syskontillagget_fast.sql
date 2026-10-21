-- ============================================================
-- Syskontillägget är fast: tre barn kostar 468 kr i timmen (2026-10-21)
--
-- Leo: "Tre barn kostar 468 i timmen". syskontillagg_som_skuld räknade
-- tillägget per extra barn: extra barn × tjänstens pris för extra barn och
-- timme × minuter / 60. Med strömbrytaren syskonskuld på hade tre barn då
-- blivit 399 + 2 × 69 = 537 kr i timmen. Nu är tillägget fast, som priset
-- sidorna säger i dag: tjänstens pris för fler barn och timme × minuter /
-- 60, lika mycket med ett som med två syskon. Det enda strömbrytaren
-- ändrar är att tillägget betalas som en skuld efter passet i stället för
-- i passets pris.
--
-- Antalet extra barn står kvar på posten (antal_extra_barn), för kvittot
-- och adminvyn, men räknas inte in i beloppet.
--
-- Vakten: inga poster får finnas. En post är fryst när passet bokas, och
-- en post räknad per extra barn ska inte få ett nytt villkor under sig.
-- Strömbrytaren har aldrig stått på, och i driften fanns inga poster
-- 2026-10-21.
--
-- Ett drop: villkoret tillagg_poster_belopp byts (drop constraint if
-- exists och add, som i syskontillagg_som_skuld). Inget delete. Filen går
-- att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.tillagg_poster) then
    raise exception 'syskontillagget_fast: tillagg_poster har poster räknade per extra barn. Bestäm vad som gäller för dem först; inget har ändrats.';
  end if;
end $$;

-- ---------- 1. beloppet ----------
-- Samma regel i _delad/tillagg.ts och nextrum-betalning.js (tillaggetsBelopp).
create or replace function intern.tillaggets_belopp(p_extra integer, p_pris_ore integer, p_minuter integer)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  -- syskontillagget_fast (2026-10-21, Leo: "Tre barn kostar 468 i timmen"): lika mycket oavsett antalet extra barn.
  select case when p_extra > 0 then round(p_pris_ore::numeric * p_minuter / 60)::integer else 0 end
$function$;

alter table public.tillagg_poster drop constraint if exists tillagg_poster_belopp;
alter table public.tillagg_poster add constraint tillagg_poster_belopp
  check (belopp_ore = round(pris_ore_per_timme::numeric * minuter / 60));

-- ---------- 2. kommentarerna ----------
comment on table public.tillagg_poster is
  '2026-10-21 (syskontillagg_som_skuld, syskontillagget_fast). En rad per pass med extra barn. Beloppet = pris för '
  'fler barn och timme × minuter / 60, lika mycket oavsett antalet extra barn (Leo: tre barn kostar 468 kr i timmen), '
  'fryst när passet bokas. antal_extra_barn står för kvittot och adminvyn. Lägena: bokad, upplupen (skulden), '
  'i_betalning, betald, frigjord, avskriven och aterbetald, och bara övergångarna i intern.tillagg_poster_vakt. Skrivs '
  'bara av databasen. Raderas aldrig: underlag för en skuld eller en betalning.';

comment on table public.tillagg_installning is
  '2026-10-21 (syskontillagg_som_skuld). Syskontilläggets gränser, en rad. Namnen motsvarar beställningens '
  'TILLAGG_*: villkor_version (TILLAGG_VILLKOR_VERSION), sen_avbokning_timmar, debitera_vid_sen_avbokning, '
  'obligatorisk_i_nasta_betalning, max_upplupet_ore (TILLAGG_MAX_UPPLUPET_KR i ören), sparr_efter_dagar och '
  'paminnelse_dagar. Priset för fler barn (ett pris, oavsett hur många; syskontillagget_fast) och taket för antalet '
  'barn är tjänstens (tjanster). Ändras med SQL.';

-- ---------- 3. strömbrytarens text ----------
-- Adminvyn visar beskrivningen och vad strömbrytaren väntar på.
-- flaggor_stampla fryser båda vid varje update, så den står av bara runt
-- den här raden, som i fyll_timbanken. flaggor_audit rörs inte: den
-- loggar bara när aktiv ändras, och det gör den inte här.
alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set beskrivning = 'Syskon på samma pass bokas med barnen, och tillägget för fler barn (69 kr i timmen, lika mycket '
                  || 'med ett som med två syskon) blir en skuld efter passet (syskontillagg_som_skuld, '
                  || 'syskontillagget_fast). Av: syskon bokas som förut, med tillägget i passets pris.',
       vantar_pa = 'Leos villkorstext för syskontillägget och versionen i tillagg_installning.villkor_version (går inte '
                || 'att slå på med utkast). Priset står som förut (tre barn 468 kr i timmen); prissidan, FAQ:n, '
                || 'villkoren och /en/ ska säga att tillägget betalas som en skuld efter passet, i samma ändring.'
 where kod = 'syskonskuld';

alter table public.flaggor enable trigger flaggor_stampla;

do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
end $$;
