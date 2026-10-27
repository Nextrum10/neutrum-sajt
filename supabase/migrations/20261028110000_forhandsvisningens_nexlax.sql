-- ============================================================
-- NEXTRUM — förhandsvisningens NexLäx (2026-10-27)
--
-- Leo: "eleven ska kunna ha tillgång till alla ämnen och årskurser" i
-- förhandsvisningen av studievyn. Förut hade den påhittade eleven sju
-- påhittade nivåer i matematik åk 6. Nu läser förhandsvisningen den
-- riktiga banan (nivaer, som varje inloggad redan läser) och spelar den
-- riktiga frågorna genom de två funktionerna här.
--
-- Ingenting sparas: inget försök, inget svar, ingen XP. Försöket och
-- stjärnorna står i webbläsaren, som resten av förhandsvisningen.
-- Frågorna går ut utan facit, som ur niva_starta, och svaret rättas av
-- samma intern.niva_ratta som elevens: talregeln står på ett ställe.
-- Bara superadmin, som läser frågorna med facit redan ("admin sköter
-- frågorna"), så funktionerna lämnar inget ut som inte redan var deras.
-- ============================================================

create or replace function public.forhandsvisning_niva(p_niva uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_niva   public.nivaer;
  v_fragor uuid[];
begin
  if not public.is_admin() then
    raise exception 'Förhandsvisningen är bara för admin.' using errcode = '42501';
  end if;
  select * into v_niva from public.nivaer where id = p_niva and aktiv;
  if not found then
    raise exception 'Nivån finns inte längre.' using errcode = 'P0002';
  end if;
  if v_niva.sort = 'repetition' then
    raise exception 'Repetitionen bygger på elevens egna svar och går inte att göra i förhandsvisningen.'
      using errcode = 'P0001';
  elsif v_niva.sort = 'mastare' then
    v_fragor := intern.nexlax_mastarfragor(v_niva);
  else
    select array_agg(f.id order by f.ordning, f.id) into v_fragor
      from public.niva_fragor f where f.niva_id = p_niva and f.aktiv;
  end if;
  if v_fragor is null then
    raise exception 'Nivån har inga frågor än.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'niva', jsonb_build_object('id', v_niva.id, 'titel', v_niva.titel, 'amne', v_niva.amne,
                               'omrade', v_niva.omrade, 'arskurs', v_niva.arskurs,
                               'sort', v_niva.sort, 'lastext', v_niva.lastext),
    'fragor', (select jsonb_agg(intern.niva_fraga_ut(f) order by u.nr)
                 from unnest(v_fragor) with ordinality u(id, nr)
                 join public.niva_fragor f on f.id = u.id));
end $$;

create or replace function public.forhandsvisning_ratta(p_fraga uuid, p_svar jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  q public.niva_fragor;
begin
  if not public.is_admin() then
    raise exception 'Förhandsvisningen är bara för admin.' using errcode = '42501';
  end if;
  if p_svar is null or length(p_svar::text) > 2000 then
    raise exception 'Svaret är för långt.' using errcode = '22023';
  end if;
  select * into q from public.niva_fragor where id = p_fraga;
  if not found then
    raise exception 'Frågan finns inte.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('ratt', intern.niva_ratta(q, p_svar), 'facit', intern.niva_facit(q),
                            'forklaring', q.forklaring);
end $$;

revoke all on function public.forhandsvisning_niva(uuid) from public, anon;
revoke all on function public.forhandsvisning_ratta(uuid, jsonb) from public, anon;
grant execute on function public.forhandsvisning_niva(uuid) to authenticated;
grant execute on function public.forhandsvisning_ratta(uuid, jsonb) to authenticated;

comment on function public.forhandsvisning_niva(uuid) is
  'Förhandsvisningen (2026-10-27): en nivås frågor utan facit, för superadmin. Sparar inget.';
comment on function public.forhandsvisning_ratta(uuid, jsonb) is
  'Förhandsvisningen (2026-10-27): rättar ett svar som niva_svara, för superadmin. Sparar inget.';
