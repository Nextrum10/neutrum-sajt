-- ============================================================
-- NEXTRUM — Fas 10.1: en tjänst får inte vara aktiv och oklar
--
-- I dag finns spärren mot att slå på en halvfärdig tjänst på ett enda
-- ställe: en if-sats i webbläsaren (nextrum-admin-tjanster.js:342).
-- CLAUDE.md §6 säger rakt ut att det inte är säkerhet. Avståndet
-- mellan internet och `update tjanster set aktiv = true` är i dag
-- exakt EN policyrad — anon har INSERT, UPDATE och DELETE på tabellen
-- (relacl `anon=awdDxtm`), och det enda som står emellan är policyn
-- "bara admin ändrar tjänster".
--
-- PLANEN SÄGER "pris, ersättning, krav och bokningstyp". Tre av de
-- fyra går inte att koda som skrivet, och att göra det ändå hade
-- gjort skada. Avvikelsen redovisas här, med skälen:
--
--   · bokningstyp är NOT NULL med förvalet 'pass'. Den kan aldrig
--     "saknas". Ett villkor på den hade varit en rad som aldrig
--     kan bli sann.
--
--   · krav är NOT NULL med förvalet '{}'. Tomt objekt är både
--     förvalet och ett tänkbart svar, så villkoret hade betytt
--     "någon har skrivit tecken i en ruta" — och `{"x":1}` uppfyller
--     det. Ett krav som går att uppfylla med skräp är teater.
--     Kravtexten hör hemma i lanseringschecklistan, där en MÄNNISKA
--     läser den.
--
--   · ersattning_per_timme_ore = NULL är ett BESLUT, inte en lucka.
--     Kolumnkommentaren säger det, och _delad/pris.ts:218 gör det:
--     null betyder studiehjälparens egen timpenning. Läxhjälp är
--     aktiv i drift med null. Ett ovillkorligt krav hade gjort
--     379-kronorsraden omöjlig att spara — inte bara att aktivera.
--     Och saknas BÅDA hoppar faktureringen redan över passet och
--     rapporterar det (`utanTimpenning`), alltså högljutt och rätt.
--
-- DET TRIGGERN KRÄVER ÄR I STÄLLET DET SYSTEMET ANNARS FÅR TYST FEL.
-- Varje villkor har en rad kod bakom sig:
--
--   1. for_kund utan pris → _delad/pris.ts:170 räknar
--      `p.timme || o.timprisOre` och rad 203 skriver samma tal som
--      radens timpris_ore. Ett barnvaktspass hade fakturerats 379 kr
--      i timmen, och fakturaraden hade PÅSTÅTT att det var
--      barnvaktens pris. En faktura som inte stämmer är enligt
--      CLAUDE.md §1 en tvist, inte ett skrivfel.
--
--   2. extra_personer_max > 1 utan extra_personer_ore → tillägget
--      blir tyst 0. Familjen underdebiteras utan att något syns.
--
--   3. varken for_kund eller for_jobb → en aktiv rad ingen kan
--      använda, som ändå vidgar tjanstkoder_finns().
--
-- VILLKOREN ÄR INVARIANTER, INTE EN GRIND. De prövas vid varje
-- skrivning på en aktiv rad, inte bara vid övergången — annars gick
-- det att aktivera rätt och sedan tömma priset. Läxhjälp uppfyller
-- alla tre i dag (pris 37900, extra 6900 vid max 3), så ingen
-- befintlig rad låses. Det är provat i verktyg/rls-test.sql, och de
-- två viktigaste raderna där är inte de som nekar utan de två som
-- ska fortsätta gå igenom.
--
-- AVSTÄNGNING SLÄPPS ALLTID IGENOM. Den är nödbromsen, och en broms
-- som kan vägra är ingen broms.
-- ============================================================

create or replace function public.skydda_tjansteaktivering()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Nödbromsen först: att stänga av en tjänst får aldrig nekas.
  if not new.aktiv then
    return new;
  end if;

  if not new.for_kund and not new.for_jobb then
    raise exception using errcode = '42501',
      message = 'En aktiv tjänst måste gå att antingen boka eller söka till. '
             || 'Kryssa i "för kund" eller "för jobb" först.';
  end if;

  if new.for_kund and (new.pris_per_timme_ore is null or new.pris_per_timme_ore <= 0) then
    raise exception using errcode = '42501',
      message = 'Tjänsten går att boka men saknar pris. Utan pris fakturerar '
             || 'månadskörningen den till läxhjälpens timpris och skriver det '
             || 'som om det vore tjänstens eget. Sätt ett pris först.';
  end if;

  if new.extra_personer_max > 1 and new.extra_personer_ore is null then
    raise exception using errcode = '42501',
      message = 'Tjänsten tillåter flera personer men saknar tillägg för dem. '
             || 'Tillägget blir då tyst noll. Sätt ett belopp, eller sänk '
             || 'antalet till en.';
  end if;

  return new;
end $function$;

comment on function public.skydda_tjansteaktivering() is
  'Invarianter för en AKTIV tjänst: den ska gå att använda, den ska ha ett '
  'pris om den går att boka, och ett tillägg om den tillåter flera personer. '
  'Prövas vid varje skrivning, inte bara vid aktivering — annars går det att '
  'aktivera rätt och sedan tömma priset. Avstängning släpps alltid igenom.';

revoke execute on function public.skydda_tjansteaktivering() from public, anon, authenticated;

drop trigger if exists tjanster_stoppa_oklar on public.tjanster;
create trigger tjanster_stoppa_oklar
  before insert or update on public.tjanster
  for each row execute function public.skydda_tjansteaktivering();

-- ---------- auditen lär sig ordningen ----------
-- `ordning` styr standard_tjanst(), alltså vilken tjänst ett nytt barn
-- hamnar på och vad bokningsformuläret väljer. Den har inte loggats.
-- Att flytta en tjänst till första plats är i praktiken att byta
-- förval för hela sajten, och det ska synas.
--
-- Läst ur driften med pg_get_triggerdef före ändringen. Allt utom
-- 'ordning' är ordagrant kvar.
drop trigger if exists tjanster_audit on public.tjanster;
create trigger tjanster_audit
  after insert or delete or update on public.tjanster
  for each row execute function public.logga_andring(
    'tjanst', 'kod', 'aktiv', 'ordning', 'for_kund', 'for_jobb',
    'pris_per_timme_ore', 'extra_personer_ore', 'extra_personer_max',
    'ersattning_per_timme_ore', 'bokningstyp', 'kundtyp', 'jobbtyp',
    'min_alder', 'rapportkrav', 'rut_berattigad', 'rut_procent',
    'krav', 'matchningsregler');
