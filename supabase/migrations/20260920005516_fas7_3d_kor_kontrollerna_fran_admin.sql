-- ============================================================
-- NEXTRUM — Fas 7.3d: kontrollerna går att köra för hand
--
-- De fyra kontrollerna är avsiktligt stängda för webbläsaren: de är
-- serverkod, och ska köras av ett schema. Men en automation som
-- ingen har sett köra är en automation ingen litar på — och
-- schemat installeras inte förrän någon sett den göra rätt.
--
-- Därför den här: samma körning, men med adminvakten framför. Den
-- är också det som gör pg_cron valfritt. Går kontrollerna att
-- starta från Automationer-fliken fungerar hela Fas 7 utan att
-- något schema finns, bara någon trycker på knappen.
--
-- Uppgifterna får skapad_av_typ 'system' även när en människa
-- tryckte. Det är rätt: det var REGELN som hittade dem, inte
-- personen. Vem som tryckte står i auditloggen.
-- ============================================================

create or replace function public.kor_kontrollerna()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kör kontrollerna.';
  end if;
  return public.dagliga_kontroller();
end $$;

comment on function public.kor_kontrollerna() is
  'Kör de fyra dagliga kontrollerna direkt, för admin. Skapar uppgifter, skickar ingenting.';

revoke execute on function public.kor_kontrollerna() from public, anon;
grant execute on function public.kor_kontrollerna() to authenticated;
