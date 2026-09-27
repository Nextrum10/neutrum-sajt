-- ============================================================
-- Fas 20.5: bokslutet räknar utbetalda underlag
--
-- manad_lage() (Fas 20.2) räknade underlagen som betalda på
-- status = 'betald', men payouts har 'utkast', 'godkand', 'utbetald' och
-- 'misslyckad'. Talet blev alltid noll, och summeringen som sparas när
-- en månad stängs hade sagt att ingen lön betalats ut. Fakturornas
-- 'betald' stämmer (invoices har det läget) och rörs inte.
--
-- Hittat av den som byggde adminvyns panel, som räknade talet själv i
-- väntan på rättelsen. Lappas med replace (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

do $$
declare
  fore   text := pg_get_functiondef('public.manad_lage(date)'::regprocedure);
  gammal text := $g$'betalda', count(*) filter (where u.status = 'betald'))$g$;
  ny     text := $n$'betalda', count(*) filter (where u.status = 'utbetald'))$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'manad_lage: underlagens betalda hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

do $$
begin
  if position($p$u.status = 'utbetald'$p$ in pg_get_functiondef('public.manad_lage(date)'::regprocedure)) = 0 then
    raise exception 'manad_lage blev inte ändrad.';
  end if;
end $$;
