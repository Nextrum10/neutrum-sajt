-- ============================================================
-- NEXTRUM — villkoren för kortet som reserveras (2026-10-15)
--
-- Leo 2026-10-13: "när man klickar på boka pass eller godkänn förslaget
-- från barnet ska man kunna betala nu, eller på faktura. då reserveras
-- pengar från stripe och när passet har hållits och läxhjälparen har
-- skrivit rapport så dras pengarna om man betalar med kort".
--
-- Villkoren säger hur kortet reserveras och dras (anvandarvillkor.html,
-- Kortet ni väljer när ni bokar), och betalningsmeningen på sidorna och i
-- mejlen säger att pengarna dras först när rapporten är skriven. Det är
-- en ny version, så alla får frågan igen vid nästa inloggning, och den
-- som väljer kortet ska ha godkänt den (avsnitt 2).
--
-- KÖRS NÄR STRÖMBRYTAREN SLÅS PÅ, inte före: med kortreservation av finns
-- Betala i förväg kvar i vyn, och då stämmer inte den nya texten. Datumet
-- är dagen villkoren går ut. Blir det en annan dag byts det här och på
-- båda sidorna (kolla-villkor.py), och ordningen står i DEPLOY-BETALNING.md
-- 9.14. Den körs efter kortet_reserveras, som skapar kortreservationer.
-- ============================================================

-- ---------- 1. versionen ----------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-15'::text $$;


-- ---------- 2. den som väljer kortet har godkänt villkoren ----------
-- Kortet ger oss rätt att reservera och dra passets pris utan att
-- familjen är med, så den som väljer det har godkänt versionen som säger
-- hur, som den som bokar (bookings_kraver_villkor) eller köper timmar
-- (klippkort_kraver_villkor). En trigger och inte en rad i valj_kort():
-- kortet_reserveras körs i driften före den här filen, och valj_kort()
-- står kvar som den är.
--
-- Prövas bara när familjen själv väljer kortet: en ny rad, eller en rad
-- som väljs igen efter att ha släppts, gått ut eller nekats. Att välja
-- bort går alltid, som en avbokning. Jobbet, webhooken och tjänstekontot
-- har ingen inloggad, och admin går förbi.
create or replace function intern.kortval_kraver_villkor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  vem uuid := auth.uid();
begin
  if vem is null or vem is distinct from new.parent_id or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (new.lage in ('vald', 'reserverad')
                               and old.lage in ('slapps', 'slappt', 'utgangen', 'misslyckad')) then
    return new;
  end if;
  if not intern.villkoren_godkanda(vem) then
    raise exception 'Godkänn användarvillkoren först. Ladda om sidan, så kommer frågan.'
      using errcode = 'P0001', hint = 'villkor';
  end if;
  return new;
end $$;

revoke all on function intern.kortval_kraver_villkor() from public, anon, authenticated;

create or replace trigger kortreservationer_kraver_villkor
  before insert or update of lage on public.kortreservationer
  for each row execute function intern.kortval_kraver_villkor();
