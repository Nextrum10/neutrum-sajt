-- ============================================================
-- NEXTRUM — fripass på Din väg i NexLäx (2026-10-27)
--
-- Leo: "de ska gå att göra de nivåer som är låsta men då ska de stå är du
-- säker att du ska göra denna nivå innan denna. och sen har man typ 5 såna
-- hoppa nivåer fripass per vecka på nexläx som man kan förbruka".
--
-- Låset på vägen är en spelregel i nextrum-uppgifter.js (ett steg i taget,
-- 2026-10-27), inget skydd: niva_starta() startar vilken nivå som helst. En
-- låst nivå går nu att göra med ett fripass. Eleven har fem i veckan
-- (måndag till söndag, svensk tid), och de som inte används sparas inte.
-- Ett fripass öppnar den nivån för gott: att göra om den kostar inget mer.
--
-- Det som sparas är bara att ett försök startades med ett fripass
-- (niva_forsok.fripass). Hur många som är kvar räknas ur försöken, som XP:n
-- och serien, och sparas aldrig för sig. Det räknas i databasen och inte i
-- webbläsaren, så att det följer barnet mellan barnets och förälderns
-- inloggning och mellan telefonen och datorn.
--
--   niva_forsok.fripass          försöket startades med ett fripass
--   intern.nexlax_fripass_per_vecka()  5, det enda stället för talet
--   intern.nexlax_fripass(elev)  { per_vecka, kvar, nivaer, nya }
--   public.niva_hoppa(niva, elev)  startar en låst nivå med ett fripass
--   nexlax_lage().fripass        det vyerna ritar
--
-- Vem som får hoppa prövas som i niva_starta: familjens eget barn, eller
-- barnet självt med NexLäx påslaget (intern.mitt_nexlax_barn()).
--
-- nexlax_lage() lappas med replace() och en vakt som räknar träffarna. En
-- kropp som redan bär ändringen släpps igenom: filen går att köra två
-- gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $vakt$
begin
  if to_regprocedure('public.niva_starta(uuid, uuid)') is null then
    raise exception 'niva_starta saknas. Läs driften.';
  end if;
  if to_regprocedure('public.nexlax_lage(uuid)') is null then
    raise exception 'nexlax_lage saknas. Läs driften.';
  end if;
  if to_regprocedure('intern.mitt_nexlax_barn()') is null then
    raise exception 'intern.mitt_nexlax_barn saknas. Kör barnets_behorigheter först.';
  end if;
end $vakt$;


-- ---------- 1. försöket bär fripasset ----------
alter table public.niva_forsok
  add column if not exists fripass boolean not null default false;

comment on column public.niva_forsok.fripass is
  '2026-10-27 (nexlax_fripass). Försöket startades med ett fripass, på en nivå som var låst på vägen. Sätts bara av niva_hoppa().';


-- ---------- 2. hur många, och vilka ----------
create or replace function intern.nexlax_fripass_per_vecka()
returns integer
language sql
immutable
as $$ select 5 $$;

comment on function intern.nexlax_fripass_per_vecka() is
  '2026-10-27 (nexlax_fripass). Fripass per vecka i NexLäx. Det enda stället för talet; vyerna läser det ur nexlax_lage().fripass.';

-- Veckan är måndag till söndag i svensk tid. Ett fripass räknas per nivå:
-- två försök på samma hoppade nivå samma vecka är ett fripass.
create or replace function intern.nexlax_fripass(p_elev uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with v as (
    select date_trunc('week', now() at time zone 'Europe/Stockholm') as mandag
  )
  select jsonb_build_object(
    'per_vecka', intern.nexlax_fripass_per_vecka(),
    'kvar', greatest(0, intern.nexlax_fripass_per_vecka() - (
      select count(distinct f.niva_id)::int
        from public.niva_forsok f, v
       where f.student_id = p_elev and f.fripass
         and f.startad_at >= (v.mandag at time zone 'Europe/Stockholm'))),
    'nivaer', coalesce((
      select jsonb_agg(distinct f.niva_id)
        from public.niva_forsok f
       where f.student_id = p_elev and f.fripass), '[]'::jsonb),
    'nya', (select (v.mandag + interval '7 days')::date from v))
$$;

comment on function intern.nexlax_fripass(uuid) is
  '2026-10-27 (nexlax_fripass). Elevens fripass: per_vecka, kvar den här veckan, nivaer (hoppade någon gång, och därför öppna på vägen) och nya (måndagen då veckans fripass kommer). Prövar ingen behörighet: anroparen gör det.';

revoke all on function intern.nexlax_fripass_per_vecka() from public, anon, authenticated;
revoke all on function intern.nexlax_fripass(uuid) from public, anon, authenticated;


-- ---------- 3. hoppa till en låst nivå ----------
create or replace function public.niva_hoppa(p_niva uuid, p_elev uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ut jsonb;
begin
  if auth.uid() is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if not (exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid())
          or coalesce(intern.mitt_nexlax_barn() = p_elev, false)) then
    raise exception 'Eleven hör inte till ert konto.' using errcode = '42501';
  end if;

  -- Ett hopp i taget per elev: två tryck samtidigt ska inte ta det sista
  -- fripasset två gånger.
  perform pg_advisory_xact_lock(hashtextextended('nexlax_fripass:' || p_elev::text, 0));

  -- En nivå som redan hoppats till är öppen: den kostar inget mer.
  if exists (select 1 from public.niva_forsok f
              where f.student_id = p_elev and f.niva_id = p_niva and f.fripass) then
    return public.niva_starta(p_niva, p_elev) || jsonb_build_object('fripass', intern.nexlax_fripass(p_elev));
  end if;

  if (intern.nexlax_fripass(p_elev) ->> 'kvar')::int <= 0 then
    raise exception 'Veckans fripass är slut. Nya kommer på måndag.' using errcode = 'P0001';
  end if;

  v_ut := public.niva_starta(p_niva, p_elev);
  update public.niva_forsok set fripass = true where id = (v_ut ->> 'forsok')::uuid;
  return v_ut || jsonb_build_object('fripass', intern.nexlax_fripass(p_elev));
end $$;

comment on function public.niva_hoppa(uuid, uuid) is
  '2026-10-27 (nexlax_fripass). Startar en nivå som är låst på vägen med ett av veckans fripass, som niva_starta() och med samma behörighet. Svaret är niva_startas med fripass (intern.nexlax_fripass). Låset är en spelregel i vyn; det här räknar fripassen.';

revoke all on function public.niva_hoppa(uuid, uuid) from public, anon;
grant execute on function public.niva_hoppa(uuid, uuid) to authenticated, nextrum_barn;


-- ---------- 4. nexlax_lage() säger hur många som är kvar ----------
do $lapp$
declare
  fore   text := pg_get_functiondef('public.nexlax_lage(uuid)'::regprocedure);
  ankare text := $a$    'idag', v_idag)
  into v_ut;$a$;
  ny     text := $n$    'fripass', intern.nexlax_fripass(p_elev),
    'idag', v_idag)
  into v_ut;$n$;
  n      integer;
begin
  if position('intern.nexlax_fripass(p_elev)' in fore) > 0 then
    raise notice 'nexlax_lage är redan lappad.';
    return;
  end if;
  n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
  if n <> 1 then
    raise exception 'nexlax_lage: texten som ska bytas hittades % gånger, väntat en. Läs driften.', n;
  end if;
  execute replace(fore, ankare, ny);
end $lapp$;
