-- ============================================================
-- Fas 20.4: ett återbetalt tillägg larmar inte som obetalt
--
-- Betalar admin tillbaka ett tillägg för övertid har Nextrum bestämt
-- att övertiden inte ska betalas. Larmet tillagg_obetalt räknade ändå
-- övertiden som obetald, eftersom betalda_min bara tar med betalda
-- tillägg, och föräldravyn erbjöd tillägget igen. En månad med det
-- passet hade aldrig gått att stänga (Fas 20.2), och familjen hade
-- fått betala det vi just betalat tillbaka.
--
-- Lönen rörs inte: övertiden är fortfarande obetald, så lon_min stannar
-- på det bokade. stripe-checkout vägrar samtidigt en ny kassa för ett
-- återbetalt tillägg.
--
-- Lappas med replace, som Fas 19.5 och 20.1 (se CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

do $$
declare
  fore  text := pg_get_functiondef('public.avvikelser_rader'::regproc);
  gammal text := $g$     and p.debiterade_min > p.betalda_min
  union all$g$;
  ny text := $n$     and p.debiterade_min > p.betalda_min
     -- Fas 20.4: ett återbetalt tillägg är ett beslut, inte en skuld.
     and not exists (select 1 from public.pass_tillagg t
                      where t.booking_id = p.id and t.status = 'aterbetald')
  union all$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'avvikelser_rader: tillagg_obetalt-villkoret hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

do $$
begin
  if position('Fas 20.4' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0
     or position('Fas 19.5' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0
     or position('tillagg_obetalt' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0 then
    raise exception 'avvikelser_rader blev inte ändrad, eller tappade en tidigare lapp.';
  end if;
end $$;
