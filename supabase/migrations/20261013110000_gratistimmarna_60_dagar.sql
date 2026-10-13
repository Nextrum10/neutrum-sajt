-- ============================================================
-- Gratis timmar gäller i 60 dagar och dras först (2026-10-13)
--
-- Leo: "gratis timmar går ut efter 60 dagar att de läggs in, planerna man
-- köper går ut samma månad", "gratis timmar går ut först sen planerna",
-- och om den första planen: "så får man gratis timmen inkluderad, alltså
-- 9h vid köp av 8 exempelvis". Och om villkoren: "fixa villkoren".
--
-- 1. PLANENS GRATIS TIMME står kvar i planen (timmar_pa_kopet, som
--    intern.planens_forsta_timme lägger till när planen blir betald). Den
--    dras först, så den är oanvänd bara så länge planen har använts mindre
--    än så. Planen går ut en månad efter köpet, som förut; en gratis timme
--    som inte använts gäller sedan till 60 dagar efter köpet. Det räknas i
--    intern.kortets_timmar, som timmarna (intern.timmar_betala), Betala
--    med timmar (klippkort_dra) och vyn (klippkort_saldo: brukbar,
--    gratis_kvar, gratis_till) läser.
-- 2. GRATIS FÖRST. Bland familjens kort väljs först ett med gratis timmar
--    kvar som gäller passets dag, sedan kortet som går ut först.
-- 3. TIPSTIMMEN gäller i 60 dagar från dagen den nya familjen haft sina
--    två timmar (intern.tva_timmar_hallna), för ett pass som föreslås inom
--    den tiden och för en dag inom den. Ett pass med timmen tar den äldsta
--    som gällde (intern.tipstimmar_kvar). Den är fortfarande ett avdrag på
--    nästa pass, inte en timme i timbanken.
-- 4. FÖRSTA TIMMEN PASS FÖR PASS, för en familj vi valt, gäller i 60 dagar
--    från att vi gav den (forsta_timmen_beviljad.beviljad_at).
-- 5. PÅMINNELSEN om timmar som går ut räknar bara de timmar som går ut den
--    dagen: en gratis timme som inte använts går inte ut med planen. Ingen
--    påminnelse om gratistimmen själv, för mejlet säger "köpta timmar" och
--    att resten betalas tillbaka, och en gratis timme betalas aldrig ut.
-- 6. Återbetalningen räknas som förut (vid_anger_ore, vid_uppsagning_ore).
-- 7. Villkoren (version 2026-10-13): alla får frågan igen.
--
-- Funktionerna som skrivs om helt prövas först mot det som lästes i
-- driften 2026-10-13 (md5 på pg_get_functiondef), och de som lappas med
-- replace() och en vakt som räknar träffarna. En funktion som redan bär
-- gratistimmarna_60_dagar hoppas över, så filen går att köra två gånger.
-- Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('intern.timmar_betala(public.bookings,boolean)', 'ba9100a99219a3bd52caa3b80d2883b8'),
      ('public.klippkort_dra(uuid,uuid)',               '282bdbd2adbd63fc0f8e65f6b824b613')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('gratistimmarna_60_dagar' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan gratistimmarna_60_dagar skrevs. Läs driften och skriv om migrationen.', f.namn;
    end if;
  end loop;
  def := pg_get_viewdef('public.klippkort_saldo'::regclass, true);
  if position('gratis_kvar' in def) = 0 and md5(def) <> '53f4760fd042e7c238d8daea6fe67a90' then
    raise exception 'klippkort_saldo har ändrats sedan gratistimmarna_60_dagar skrevs. Läs driften och skriv om migrationen.';
  end if;
end $$;


-- ---------- 1. hjälparna ----------
/* Sista dagen för ett korts gratis timmar: 60 dagar från köpet. */
create or replace function intern.gratis_till(p_betald timestamptz)
returns date
language sql
stable
set search_path = pg_temp
as $$
  select (p_betald at time zone 'Europe/Stockholm')::date + 60
$$;

/* Hur många timmar ett kort räcker till för ett pass på dagen p_dag (som
   aldrig är före i dag): alla som är kvar fram till kortets sista dag, och
   efter den de gratis timmar som är kvar, till 60 dagar efter köpet. De
   gratis timmarna dras först, så de är kvar bara så länge färre har
   använts. */
create or replace function intern.kortets_timmar(p_till date, p_betald timestamptz, p_timmar int,
                                                 p_gratis int, p_anvanda int, p_dag date)
returns int
language sql
stable
set search_path = pg_temp
as $$
  select case
    when p_till >= p_dag then greatest(p_timmar - coalesce(p_anvanda, 0), 0)
    when coalesce(p_gratis, 0) > 0 and p_betald is not null
         and intern.gratis_till(p_betald) >= p_dag
      then greatest(p_gratis - coalesce(p_anvanda, 0), 0)
    else 0
  end
$$;

/* Dagen kortet går ut för ett pass på dagen p_dag, för ordningen. */
create or replace function intern.kortets_sista_dag(p_till date, p_betald timestamptz, p_dag date)
returns date
language sql
stable
set search_path = pg_temp
as $$
  select case when p_till >= p_dag then p_till else intern.gratis_till(p_betald) end
$$;

revoke execute on function intern.gratis_till(timestamptz) from public, anon, authenticated;
revoke execute on function intern.kortets_timmar(date, timestamptz, int, int, int, date) from public, anon, authenticated;
revoke execute on function intern.kortets_sista_dag(date, timestamptz, date) from public, anon, authenticated;


-- ---------- 2. klippkort_saldo ----------
/* Samma kolumner i samma ordning, och två till sist. brukbar räknar med
   en gratis timme som gäller efter planens månad. Beräknat här i stället
   för med hjälparna: vyn är security_invoker och läses av familjen. */
create or replace view public.klippkort_saldo
with (security_invoker = true) as
 SELECT k.id,
    k.parent_id,
    k.erbjudande,
    k.namn,
    k.sort,
    k.timmar,
    COALESCE(a.anvanda, 0) AS anvanda,
    GREATEST(k.timmar - COALESCE(a.anvanda, 0), 0) AS kvar,
    k.giltigt_till,
    k.status,
    k.begart_ore,
    k.betalt_ore,
    k.aterbetald_ore,
    k.timpris_ore,
    k.betald_at,
    k.created_at,
    k.status = 'betald'::text
      AND (k.giltigt_till >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date
             AND (k.timmar - COALESCE(a.anvanda, 0)) > 0
           OR k.timmar_pa_kopet > COALESCE(a.anvanda, 0) AND k.betald_at IS NOT NULL
             AND (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60
                 >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS brukbar,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - COALESCE(a.anvanda, 0) * k.timpris_ore, 0) AS vid_uppsagning_ore,
    (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 14 AS angerfrist_till,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - floor(COALESCE(a.anvanda, 0)::numeric * COALESCE(k.betalt_ore, 0)::numeric / k.timmar::numeric)::integer, 0) AS vid_anger_ore,
    GREATEST(k.timmar_pa_kopet - COALESCE(a.anvanda, 0), 0) AS gratis_kvar,
    CASE WHEN k.timmar_pa_kopet > 0 AND k.betald_at IS NOT NULL
         THEN (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60 END AS gratis_till
   FROM klippkort k
     LEFT JOIN LATERAL ( SELECT sum(GREATEST(1::numeric, ceil(LEAST(COALESCE(b.duration_min, 60), COALESCE(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0)))::integer AS anvanda
           FROM bookings b
          WHERE b.klippkort_id = k.id AND b.status <> 'cancelled'::text) a ON true;

comment on column public.klippkort_saldo.gratis_kvar is
  'gratistimmarna_60_dagar: de gratis timmar (timmar_pa_kopet) som inte använts. De dras först.';
comment on column public.klippkort_saldo.gratis_till is
  'gratistimmarna_60_dagar: sista dagen för kortets gratis timmar, 60 dagar efter köpet. Efter giltigt_till räcker kortet bara till gratis_kvar.';


-- ---------- 3. timmarna betalar passet ----------
create or replace function intern.timmar_betala(rad public.bookings, vanta boolean default true)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  dag   date;
  behov int;
  kort  uuid;
  saldo int;
begin
  if rad.klippkort_id is not null
     or rad.betalning_status not in ('ingen', 'vantar', 'misslyckad')
     or rad.parent_id is null
     or not rad.fakturerbar
     or coalesce(rad.antal_barn, 1) > 1
     or rad.startrabatt
     or not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false)
     or intern.timbank_betalt(rad.id) then
    return rad;
  end if;

  behov := greatest(1, ceil(least(coalesce(rad.duration_min, 60),
                                  coalesce(intern.debiterade_min(rad.id), rad.duration_min, 60)) / 60.0))::int;
  -- Kortet ska gälla passets dag och i dag.
  dag := greatest(coalesce(rad.wanted_date, idag), idag);

  if vanta then
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update;
  else
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update nowait;
  end if;

  /* gratistimmarna_60_dagar (2026-10-13): ett kort räcker med alla sina
     timmar fram till sista dagen, och efter den med de gratis timmar som
     är kvar, till 60 dagar efter köpet (intern.kortets_timmar). Gratis
     timmar dras först (Leo: "gratis timmar går ut först sen planerna"),
     sedan kortet som går ut först. */
  select k.id into kort
    from public.klippkort k
    cross join lateral (
      select coalesce(sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                          coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int, 0) as anv
        from public.bookings x
       where x.klippkort_id = k.id and x.status <> 'cancelled' and x.id <> rad.id) a
   where k.parent_id = rad.parent_id
     and k.status = 'betald'
     and intern.kortets_timmar(k.giltigt_till, k.betald_at, k.timmar, k.timmar_pa_kopet, a.anv, dag) >= behov
   order by coalesce(k.timmar_pa_kopet > a.anv and intern.gratis_till(k.betald_at) >= dag, false) desc,
            intern.kortets_sista_dag(k.giltigt_till, k.betald_at, dag),
            k.created_at
   limit 1;

  if found then
    rad.klippkort_id := kort;
    rad.betalning_status := 'betald';
    rad.betald_at := now();
    return rad;
  end if;

  /* Timbanken betalar det bokade, som timbank_dra. Blev passet kortare
     går resten tillbaka in (intern.timbank_in), och drog det över tar
     banken övertiden när rapporten skrivs. */
  if vanta then
    perform pg_advisory_xact_lock(hashtextextended('timbank:' || rad.parent_id::text, 0));
  elsif not pg_try_advisory_xact_lock(hashtextextended('timbank:' || rad.parent_id::text, 0)) then
    raise exception using errcode = 'lock_not_available', message = 'Timbanken skrivs i just nu.';
  end if;
  saldo := coalesce(intern.timbank_saldo(rad.parent_id), 0);
  if saldo >= coalesce(rad.duration_min, 60) then
    insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
    values (rad.parent_id, rad.id, 'pass', coalesce(rad.duration_min, 60))
    on conflict (booking_id, sort) where booking_id is not null
    do update set minuter = excluded.minuter, created_at = now();
    rad.betalning_status := 'betald';
    rad.betald_at := now();
  end if;
  return rad;
end $$;

revoke execute on function intern.timmar_betala(public.bookings, boolean) from public, anon, authenticated;


-- ---------- 4. Betala med timmar ----------
create or replace function public.klippkort_dra(p_pass uuid, p_foralder uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  b      public.bookings;
  behov  int;
  dag    date;
  kort   record;
begin
  select * into b from public.bookings where id = p_pass for update;
  if not found then
    return jsonb_build_object('fel', 'Passet finns inte.');
  end if;
  if b.parent_id is distinct from p_foralder then
    return jsonb_build_object('fel', 'Det är familjen som betalar passet.');
  end if;
  if b.status not in ('confirmed', 'completed') then
    return jsonb_build_object('fel', 'Passet betalas när det är bekräftat.');
  end if;
  if not b.fakturerbar then
    return jsonb_build_object('fel', 'Passet är undantaget och ska inte betalas.');
  end if;
  if b.betalning_status not in ('ingen', 'vantar', 'misslyckad') then
    return jsonb_build_object('fel', 'Passet är redan betalt, eller betalas på annat sätt.');
  end if;
  /* Erbjudandena gäller ett barn per pass. Tillägget för syskon är ett
     eget pris, och ett klippkort för ett barn hade annars betalat det
     med timmar som kostat mindre. */
  if coalesce(b.antal_barn, 1) > 1 then
    return jsonb_build_object('fel', 'Timmarna gäller pass med ett barn. Det här passet betalas med kort.');
  end if;

  /* Fas 19.5. Timmarna dras ur passets hela längd, och ett pass med
     första timmen bjuden hade kostat en timme för mycket ur kortet. */
  if b.startrabatt then
    return jsonb_build_object('fel', 'Första timmen är på köpet på det här passet, så det betalas med kort.');
  end if;

  /* Fas 20.1: ett genomfört pass som blev kortare än bokat drar bara
     de påbörjade timmar som hölls. Samma uttryck som i klippkort_saldo. */
  behov := greatest(1, ceil(least(coalesce(b.duration_min, 60),
                                  coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) / 60.0))::int;
  dag := greatest(b.wanted_date, (now() at time zone 'Europe/Stockholm')::date);

  /* Alla familjens kort låses FÖRST, och timmarna räknas i en egen sats
     efteråt. I read committed får varje sats en ny ögonblicksbild, så
     två samtidiga dragningar ser varandras timmar. Räknades de i samma
     sats som låset hade den andra kunnat dra på ett saldo som redan
     var förbrukat. */
  perform 1 from public.klippkort where parent_id = p_foralder and status = 'betald' for update;

  /* gratistimmarna_60_dagar (2026-10-13): samma val som när timmarna
     betalar av sig själva (intern.timmar_betala). Gratis timmar först,
     sedan kortet som går ut först, så att inga timmar blir kvar på ett
     kort som hinner gå ut. Passets dag ska ligga inom giltigheten. */
  select k.id, intern.kortets_timmar(k.giltigt_till, k.betald_at, k.timmar, k.timmar_pa_kopet, a.anv, dag) as kvar
    into kort
    from public.klippkort k
    cross join lateral (
      select coalesce(sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                          coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int, 0) as anv
        from public.bookings x
       where x.klippkort_id = k.id and x.status <> 'cancelled') a
   where k.parent_id = p_foralder
     and k.status = 'betald'
     and intern.kortets_timmar(k.giltigt_till, k.betald_at, k.timmar, k.timmar_pa_kopet, a.anv, dag) >= behov
   order by coalesce(k.timmar_pa_kopet > a.anv and intern.gratis_till(k.betald_at) >= dag, false) desc,
            intern.kortets_sista_dag(k.giltigt_till, k.betald_at, dag),
            k.created_at
   limit 1;

  if not found then
    return jsonb_build_object('fel', 'Ni har inga timmar kvar som räcker till passet, eller som gäller den dagen.');
  end if;

  update public.bookings
     set klippkort_id = kort.id,
         betalning_status = 'betald',
         betald_at = now()
   where id = p_pass;

  return jsonb_build_object('ok', true, 'klippkort', kort.id, 'kvar', kort.kvar - behov,
                            'session', b.stripe_session_id);
end $$;

revoke execute on function public.klippkort_dra(uuid, uuid) from public, anon, authenticated;


-- ---------- 5. lappar: jobbet, påminnelsen, första timmen, tipstimmen ----------
/* Tipstimmarna familjen inte använt, med sista dagen för var och en: 60
   dagar från att den tjänades in. Samma urval som
   intern.tipstimmar_intjanade, med dagen varje timme tjänades in. Varje
   pass med timmen (TIPS), i den ordning de föreslogs, tar den äldsta
   timmen som gällde när passet föreslogs och för passets dag, eller den
   äldsta som var kvar om ingen gällde (ett pass från före regeln). */
create or replace function intern.tipstimmar_oanvanda(p_familj uuid)
returns setof date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  intjanade date[];
  tagen     boolean[];
  pass      record;
  i         integer;
  n         integer;
  hittad    boolean;
begin
  select coalesce(array_agg(h.dag order by h.dag), '{}'::date[]) into intjanade
    from public.tipskoder k
    cross join lateral intern.tipsade_familjer(k.kod) t
    cross join lateral (select intern.tva_timmar_hallna(t.kund_id) as dag) h
    left join public.flaggor f on f.kod = 'tipstimme'
   where k.person_id = p_familj and k.sort = 'familj' and h.dag is not null
     and (coalesce(f.aktiv, false)
          or h.dag < (f.uppdaterad at time zone 'Europe/Stockholm')::date);
  n := coalesce(array_length(intjanade, 1), 0);
  if n = 0 then
    return;
  end if;
  tagen := array_fill(false, array[n]);

  for pass in
    select greatest((x.created_at at time zone 'Europe/Stockholm')::date,
                    coalesce(x.wanted_date, (x.created_at at time zone 'Europe/Stockholm')::date)) as galler
      from public.bookings x
     where x.parent_id = p_familj and x.rabattkod = 'TIPS' and x.status <> 'cancelled'
     order by x.created_at, x.id
  loop
    hittad := false;
    for i in 1 .. n loop
      if not tagen[i] and intjanade[i] + 60 >= pass.galler then
        tagen[i] := true;
        hittad := true;
        exit;
      end if;
    end loop;
    if not hittad then
      for i in 1 .. n loop
        if not tagen[i] then
          tagen[i] := true;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  for i in 1 .. n loop
    if not tagen[i] then
      return next intjanade[i] + 60;
    end if;
  end loop;
end $$;

/* Hur många av dem som gäller ett pass på dagen p_dag (aldrig före i dag). */
create or replace function intern.tipstimmar_kvar(p_familj uuid, p_dag date default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from intern.tipstimmar_oanvanda(p_familj) till
   where till >= greatest(coalesce(p_dag, (now() at time zone 'Europe/Stockholm')::date),
                          (now() at time zone 'Europe/Stockholm')::date)
$$;

revoke execute on function intern.tipstimmar_oanvanda(uuid) from public, anon, authenticated;
revoke execute on function intern.tipstimmar_kvar(uuid, date) from public, anon, authenticated;

comment on function intern.tipstimmar_kvar(uuid, date) is
  'gratistimmarna_60_dagar (2026-10-13): tipstimmarna som gäller ett pass på dagen, 60 dagar från att de tjänades in.';

do $lapp$
declare
  lappar text[][] := array[
    -- Jobbet betalar också med en gratis timme som gäller efter planens månad.
    array['intern.timmar_betalar_obetalda(uuid)',
          $g$where k.parent_id = b.parent_id and k.brukbar and k.giltigt_till >= b.wanted_date)$g$,
          $n$where k.parent_id = b.parent_id and k.brukbar
                       -- gratistimmarna_60_dagar: en gratis timme gäller efter planens månad.
                       and (k.giltigt_till >= b.wanted_date or k.gratis_till >= b.wanted_date))$n$],
    -- Påminnelsen räknar bara timmarna som går ut den dagen.
    array['intern.timmar_gar_ut_koa(timestamp with time zone)',
          $g$    select s.id, s.parent_id, s.kvar, s.giltigt_till
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.kvar > 0
       and s.giltigt_till between idag and idag + dagar$g$,
          $n$    -- gratistimmarna_60_dagar: en gratis timme som inte använts går inte
    -- ut med planen, så den räknas inte här.
    select s.id, s.parent_id,
           s.kvar - case when s.gratis_till > s.giltigt_till then s.gratis_kvar else 0 end as kvar,
           s.giltigt_till
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.kvar - case when s.gratis_till > s.giltigt_till then s.gratis_kvar else 0 end > 0
       and s.giltigt_till between idag and idag + dagar$n$],
    -- Första timmen pass för pass gäller i 60 dagar från att vi gav den.
    array['public.forsta_timmen_bjuds()',
          $g$  if exists (select 1 from public.forsta_timmen_beviljad v where v.parent_id = new.parent_id)
     and not intern.forsta_timmen_tagen(new.parent_id) then$g$,
          $n$  -- gratistimmarna_60_dagar (2026-10-13): i 60 dagar från att vi gav den.
  if exists (select 1 from public.forsta_timmen_beviljad v
              where v.parent_id = new.parent_id
                and (v.beviljad_at at time zone 'Europe/Stockholm')::date + 60
                    >= greatest(coalesce(new.wanted_date, (now() at time zone 'Europe/Stockholm')::date),
                                (now() at time zone 'Europe/Stockholm')::date))
     and not intern.forsta_timmen_tagen(new.parent_id) then$n$],
    -- Tipstimmen gäller i 60 dagar från att den tjänades in.
    array['public.forsta_timmen_bjuds()',
          $g$  if intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then$g$,
          $n$  -- gratistimmarna_60_dagar: en timme som gäller passets dag (intern.tipstimmar_kvar).
  if intern.tipstimmar_kvar(new.parent_id, new.wanted_date) > 0 then$n$],
    -- Familjen ser när den beviljade timmen går ut.
    array['public.forsta_timmen_lage(uuid)',
          $g$    'beviljad_at', (select v.beviljad_at from public.forsta_timmen_beviljad v where v.parent_id = vem),$g$,
          $n$    'beviljad_at', (select v.beviljad_at from public.forsta_timmen_beviljad v where v.parent_id = vem),
    -- gratistimmarna_60_dagar: sista dagen för timmen pass för pass.
    'beviljad_till', (select (v.beviljad_at at time zone 'Europe/Stockholm')::date + 60
                        from public.forsta_timmen_beviljad v where v.parent_id = vem),$n$],
    -- Tipstimmarna som är kvar gäller i 60 dagar.
    array['public.mina_tips()',
          $g$    'kvar', case when timmar is null then null else greatest(timmar - anvanda, 0) end,$g$,
          $n$    -- gratistimmarna_60_dagar: bara de som gäller i dag, och sista dagen
    -- för den som gäller längst (priset vid knappen gäller en dag).
    'kvar', case when timmar is null then null else intern.tipstimmar_kvar(jag, null) end,
    'kvar_till', case when timmar is null then null
                      else (select max(till) from intern.tipstimmar_oanvanda(jag) till
                             where till >= (now() at time zone 'Europe/Stockholm')::date) end,$n$]
  ];
  funktioner text[] := array['intern.timmar_betalar_obetalda(uuid)', 'intern.timmar_gar_ut_koa(timestamp with time zone)',
                             'public.forsta_timmen_bjuds()', 'public.forsta_timmen_lage(uuid)', 'public.mina_tips()'];
  fn   text;
  fore text;
  ny   text;
  i    integer;
  n    integer;
begin
  foreach fn in array funktioner loop
    fore := pg_get_functiondef(fn::regprocedure);
    if position('gratistimmarna_60_dagar' in fore) > 0 then
      raise notice '% är redan lappad.', fn;
      continue;
    end if;
    ny := fore;
    for i in 1 .. array_length(lappar, 1) loop
      if lappar[i][1] <> fn then
        continue;
      end if;
      n := (length(ny) - length(replace(ny, lappar[i][2], ''))) / length(lappar[i][2]);
      if n <> 1 then
        raise exception '%: texten som ska bytas hittades % gånger, väntat 1. Läs driften.', fn, n;
      end if;
      ny := replace(ny, lappar[i][2], lappar[i][3]);
    end loop;
    execute ny;
  end loop;
end $lapp$;


-- ---------- 6. villkoren ----------
-- Sidans datum och versionen följs åt (kolla-villkor.py), och alla får
-- frågan igen vid nästa inloggning.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-13'::text $$;
