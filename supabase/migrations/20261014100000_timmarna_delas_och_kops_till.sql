-- ============================================================
-- Timmarna delas, och timmar köps till planen (2026-10-14)
--
-- Leo 2026-10-13, på frågorna samma kväll:
--   · "tipstimmen används också före planerna då den är gratis": ett pass
--     med en timme på köpet (tipstimmen, eller första timmen pass för pass)
--     betalas med timmar för resten. Förut betalades resten med kort, medan
--     planens timmar gick ut (Fas 19.5: "timmarna dras ur passets hela
--     längd").
--   · Ett pass kan delas mellan gratistimmarna och planen. Förut valdes
--     bara ett kort som räckte till HELA passet, så en gratistimme som var
--     kvar när passen var på två timmar användes aldrig och gick ut.
--   · "man kan köpa till timmar med plan men de går ut när månaden är slut.
--     man ska kunna välja hur många timmar man köper, det ska finnas välj
--     själv knapp och checkout för de specifika timmarna": 1–20 timmar, till
--     planens timpris (379 kr, Leos val), som går ut samma dag som planen.
--
-- 1. ETT PASS DRAS FRÅN HÖGST TVÅ KORT. Det som dras först står i
--    bookings.forsta_klippkort_id och forsta_klippkort_timmar, och resten
--    på bookings.klippkort_id som förut. Ordningen är densamma som innan:
--    gratis timmar först (gratistimmar, och planens gratis timme medan den
--    gäller), sedan det som går ut först. Räcker första kortet till hela
--    passet dras bara det. Två kort räcker för pass på högst tre timmar;
--    behövs tre betalas passet som förut, pass för pass.
-- 2. ETT PASS MED EN TIMME PÅ KÖPET drar timmarna minus en ur korten
--    (intern.passets_korttimmar). Ett pass på en timme med timmen på
--    köpet kostar ingenting och dras inte alls. Timbanken (de sparade
--    minuterna) betalar fortfarande bara hela pass utan timme på köpet.
-- 3. HUR MÅNGA TIMMAR ETT KORT ANVÄNT räknas ur båda kolumnerna
--    (intern.kortets_anvanda, och samma uttryck i klippkort_saldo och
--    klippkort_rorelser). Blir ett pass kortare än bokat kommer timmarna
--    tillbaka bakifrån: det som drogs sist först, så att de gratis timmarna
--    är de som använts.
-- 4. GRATISTIMMAR TAS TILLBAKA UTAN ATT RADERAS. ta_tillbaka_gratistimmar
--    tog bort kortet när inga timmar låg på något pass; nu märks det
--    klippkort.aterkallad_at och räknas inte längre, och historiken står
--    kvar. Ett pass kan dessutom peka på kortet som första kort.
-- 5. KÖP TILL TIMMAR är ett köp i klippkort med erbjudandet 'plan_extra'
--    (en rad i katalogen som aldrig säljs därifrån, som 'gratis') och
--    till_plan, planen det hör till. Priset räknas i
--    extra_timmar_erbjudande() ur planens eget timpris och rabatt, aldrig
--    ur anropet, och klippkort_betald ger timmarna planens sista dag.
-- 6. RÄTTELSE: klippkort_dra körs som service_role (klippkort-betala), men
--    gratistimmarna_60_dagar gav inte service_role rätt att köra
--    intern.kortets_timmar, intern.gratis_till och intern.kortets_sista_dag,
--    så Betala med timmar svarade "permission denied" för varje riktigt
--    pass. Hjälparna här får samma rätt.
-- 7. Påminnelsen tio dagar innan (intern.timmar_gar_ut_koa) räknar timmar
--    som köpts till en plan ihop med planen, så att familjen får ett mejl
--    om dagen, inte ett per köp.
-- 8. Bonusen för tips är 300 kr inklusive semesterersättning (Leo samma
--    kväll: "300kr är inklusive semesterersättning"). Beloppet ändras
--    inte; strömbrytarens text säger det, som villkoren.
-- 9. Villkoren (version 2026-10-14): alla får frågan igen.
--
-- Funktionerna och vyerna som skrivs om prövas först mot det som lästes i
-- en databas byggd ur alla migrationer 2026-10-13 (md5 på
-- pg_get_functiondef och pg_get_viewdef). En som redan bär
-- timmarna_delas släpps igenom, så filen går att köra två gånger. Filen
-- tar inte bort något, varken objekt eller rader, så den kan köras hel i
-- ett do-block utan verktygets bekräftelse (CLAUDE.md avsnitt 5).
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
      ('intern.timmar_betala(public.bookings,boolean)',                         'a39ace95ebabecc1ff8c95c3ae31c1c5'),
      ('public.klippkort_dra(uuid,uuid)',                                       '726e5de2f5bd6a0f54a53f140fa18c39'),
      ('intern.timmar_betalar_kommande()',                                      '0b884e8bc7f3e3819599a6be6d38bdb2'),
      ('intern.timmar_betalar_obetalda(uuid)',                                  'c933624f27f6ef13b63f1a8a2b44dadf'),
      ('intern.timbank_in(public.bookings)',                                    '6f6bb3579d3af678156c8970b5ec8ff2'),
      ('public.klippkort_betald(uuid,integer,text,text,text,integer,integer,boolean)', '40fac5477f547ece45abe81fb7ac4d45'),
      ('public.skydda_klippkortet()',                                           'd38852ec1e37222ae8560a94173873fa'),
      ('intern.timmar_gar_ut_koa(timestamptz)',                                 'fdb6fee4b005a2c91c7397c3ef2b5046')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('timmarna_delas' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan timmarna_delas_och_kops_till skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;

  -- Avsnitt 7 i gratistimmar kördes aldrig i driften (bekräftelsen syntes
  -- inte), så funktionen kan saknas. Finns den ska den vara filens.
  if to_regprocedure('public.ta_tillbaka_gratistimmar(uuid)') is not null then
    def := pg_get_functiondef('public.ta_tillbaka_gratistimmar(uuid)'::regprocedure);
    if position('timmarna_delas' in def) = 0 and md5(def) <> '822e9dd9142f05b6fa38d7c30fbf13c5' then
      raise exception 'ta_tillbaka_gratistimmar är inte den i gratistimmar (md5 %). Läs driften.', md5(def);
    end if;
  end if;

  def := pg_get_viewdef('public.klippkort_saldo'::regclass, true);
  if position('forsta_klippkort' in def) = 0 and md5(def) <> '1eeacc6857dd0cac6eff8a1f8b46cdf3' then
    raise exception 'klippkort_saldo har ändrats sedan timmarna_delas_och_kops_till skrevs (md5 %). Läs driften.', md5(def);
  end if;
  def := pg_get_viewdef('public.klippkort_rorelser'::regclass, true);
  if position('forsta_klippkort' in def) = 0 and md5(def) <> '685a8db39084fa6252dff85f70661982' then
    raise exception 'klippkort_rorelser har ändrats sedan timmarna_delas_och_kops_till skrevs (md5 %). Läs driften.', md5(def);
  end if;
end $$;


-- ---------- 1. kolumnerna ----------
alter table public.bookings add column if not exists forsta_klippkort_id uuid
  references public.klippkort(id) on delete set null;
alter table public.bookings add column if not exists forsta_klippkort_timmar smallint;

alter table public.klippkort add column if not exists aterkallad_at timestamptz;
alter table public.klippkort add column if not exists till_plan uuid
  references public.klippkort(id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass
                  and conname = 'bookings_forsta_kortet_paret') then
    alter table public.bookings add constraint bookings_forsta_kortet_paret
      check ((forsta_klippkort_id is null) = (forsta_klippkort_timmar is null)
             and (forsta_klippkort_timmar is null or forsta_klippkort_timmar between 1 and 2));
  end if;
  -- Första kortet finns bara bredvid ett huvudkort, och är inte samma kort.
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass
                  and conname = 'bookings_forsta_kortet_med_kort') then
    alter table public.bookings add constraint bookings_forsta_kortet_med_kort
      check (forsta_klippkort_id is null
             or (klippkort_id is not null and forsta_klippkort_id <> klippkort_id));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_aterkallad_bara_gratis') then
    alter table public.klippkort add constraint klippkort_aterkallad_bara_gratis
      check (aterkallad_at is null or erbjudande = 'gratis');
  end if;
  -- Timmar som köpts till hör till en plan, och bara de.
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_till_plan_bara_extra') then
    alter table public.klippkort add constraint klippkort_till_plan_bara_extra
      check ((erbjudande = 'plan_extra') = (till_plan is not null));
  end if;
end $$;

create index if not exists bookings_forsta_klippkort on public.bookings (forsta_klippkort_id)
  where forsta_klippkort_id is not null;

comment on column public.bookings.forsta_klippkort_id is
  'timmarna_delas (2026-10-14): kortet passet drogs från först, när ett kort inte räckte till hela passet. '
  'Resten drogs från klippkort_id. Null när passet bara drogs från ett kort.';
comment on column public.bookings.forsta_klippkort_timmar is
  'timmarna_delas: hur många timmar som drogs från forsta_klippkort_id (1–2). Blir passet kortare kommer '
  'timmarna tillbaka bakifrån, så de här används först.';
comment on column public.klippkort.aterkallad_at is
  'timmarna_delas: när admin tog tillbaka gratistimmar som inte låg på något pass (ta_tillbaka_gratistimmar). '
  'Kortet räknas då inte längre, men står kvar.';
comment on column public.klippkort.till_plan is
  'timmarna_delas: planen som timmar köpts till (erbjudandet plan_extra). De går ut samma dag som planen.';

-- Katalogen: en rad som aldrig säljs därifrån, som 'gratis'. Priset räknas
-- ur familjens plan i extra_timmar_erbjudande().
insert into public.erbjudanden (kod, sort, namn, timmar, rabatt_procent, giltig_manader, ordning, aktiv)
values ('plan_extra', 'klippkort', 'Extra timmar till planen', 1, 0, 1, 800, false)
on conflict (kod) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.erbjudanden'::regclass
                  and conname = 'erbjudanden_extra_saljs_inte') then
    alter table public.erbjudanden
      add constraint erbjudanden_extra_saljs_inte check (kod <> 'plan_extra' or not aktiv);
  end if;
end $$;


-- ---------- 2. hjälparna ----------
/* Hur många timmar ett pass drar ur korten nu: varje påbörjad timme av
   den tid som hölls (eller det bokade, före passet), minus timmen på köpet. */
create or replace function intern.passets_korttimmar(b public.bookings)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(greatest(1, ceil(least(coalesce(b.duration_min, 60),
                                         coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) / 60.0))::int
                  - case when b.startrabatt then 1 else 0 end, 0)
$$;

/* Timmarna ett kort använt, på pass som inte är avbokade. Ett pass som
   drogs från två kort använder först forsta_klippkort_timmar ur det
   första, och resten ur huvudkortet. */
create or replace function intern.kortets_anvanda(p_kort uuid, p_utom uuid default null)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(case when x.forsta_klippkort_id = p_kort
                           then least(x.forsta_klippkort_timmar, d.a)
                           else greatest(d.a - coalesce(x.forsta_klippkort_timmar, 0), 0) end), 0)::int
    from public.bookings x
    cross join lateral (select intern.passets_korttimmar(x) as a) d
   where (x.klippkort_id = p_kort or x.forsta_klippkort_id = p_kort)
     and x.klippkort_id is not null
     and x.status <> 'cancelled'
     and x.id is distinct from p_utom
$$;

/* Vilka kort som betalar p_behov timmar på dagen p_dag. Korten i samma
   ordning som förut: gratis timmar först, sedan det som går ut först.
   Räcker det första till hela passet dras bara det; annars dras allt som
   är kvar på det och resten från det första kort i ordningen som räcker
   till resten. Räcker inga två blir det inget (kort är null), och passet
   betalas som förut. Den som anropar har låst familjens kort. */
create or replace function intern.timmar_fordela(p_familj uuid, p_dag date, p_behov integer,
                                                 p_utom uuid default null,
                                                 out forsta uuid, out forsta_timmar integer,
                                                 out kort uuid, out kvar integer)
language plpgsql
stable
set search_path = public
as $$
declare
  k         record;
  forst_id  uuid;
  forst_har integer := 0;
begin
  if coalesce(p_behov, 0) <= 0 then
    return;
  end if;

  for k in
    select c.id, c.har
      from (select kk.id, kk.created_at,
                   intern.kortets_timmar(kk.giltigt_till, kk.betald_at, kk.timmar, kk.timmar_pa_kopet,
                                         a.anv, p_dag) as har,
                   (kk.erbjudande = 'gratis'
                    or coalesce(kk.timmar_pa_kopet > a.anv and intern.gratis_till(kk.betald_at) >= p_dag,
                                false)) as gratis,
                   intern.kortets_sista_dag(kk.giltigt_till, kk.betald_at, p_dag) as sista
              from public.klippkort kk
              cross join lateral (select intern.kortets_anvanda(kk.id, p_utom) as anv) a
             where kk.parent_id = p_familj
               and kk.status = 'betald'
               and kk.aterkallad_at is null) c
     where c.har > 0
     order by c.gratis desc, c.sista, c.created_at, c.id
  loop
    if forst_id is null then
      if k.har >= p_behov then
        kort := k.id;
        kvar := k.har - p_behov;
        return;
      end if;
      forst_id := k.id;
      forst_har := k.har;
    elsif k.har >= p_behov - forst_har then
      forsta := forst_id;
      forsta_timmar := forst_har;
      kort := k.id;
      kvar := k.har - (p_behov - forst_har);
      return;
    end if;
  end loop;
end $$;

revoke execute on function intern.passets_korttimmar(public.bookings) from public, anon, authenticated;
revoke execute on function intern.kortets_anvanda(uuid, uuid) from public, anon, authenticated;
revoke execute on function intern.timmar_fordela(uuid, date, integer, uuid) from public, anon, authenticated;

-- klippkort_dra körs som service_role (punkt 6 i huvudet).
grant execute on function intern.passets_korttimmar(public.bookings) to service_role;
grant execute on function intern.kortets_anvanda(uuid, uuid) to service_role;
grant execute on function intern.timmar_fordela(uuid, date, integer, uuid) to service_role;
grant execute on function intern.kortets_timmar(date, timestamptz, integer, integer, integer, date) to service_role;
grant execute on function intern.gratis_till(timestamptz) to service_role;
grant execute on function intern.kortets_sista_dag(date, timestamptz, date) to service_role;

comment on function intern.timmar_fordela(uuid, date, integer, uuid) is
  'timmarna_delas (2026-10-14): korten som betalar ett pass, högst två, gratis timmar först och sedan det '
  'som går ut först. Läses av intern.timmar_betala och klippkort_dra.';


-- ---------- 3. vyerna ----------
/* Samma kolumner i samma ordning, och tre till sist. anvanda räknar också
   pass där kortet drogs först; ett återkallat kort har inget kvar och är
   inte brukbart. Beräknat här i stället för med hjälparna: vyn är
   security_invoker och läses av familjen. */
create or replace view public.klippkort_saldo
with (security_invoker = true) as
 SELECT k.id,
    k.parent_id,
    k.erbjudande,
    k.namn,
    k.sort,
    k.timmar,
    COALESCE(a.anvanda, 0) AS anvanda,
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar - COALESCE(a.anvanda, 0), 0) END AS kvar,
    k.giltigt_till,
    k.status,
    k.begart_ore,
    k.betalt_ore,
    k.aterbetald_ore,
    k.timpris_ore,
    k.betald_at,
    k.created_at,
    k.status = 'betald'::text AND k.aterkallad_at IS NULL
      AND (k.giltigt_till >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date
             AND (k.timmar - COALESCE(a.anvanda, 0)) > 0
           OR k.timmar_pa_kopet > COALESCE(a.anvanda, 0) AND k.betald_at IS NOT NULL
             AND (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60
                 >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS brukbar,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - COALESCE(a.anvanda, 0) * k.timpris_ore, 0) AS vid_uppsagning_ore,
    (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 14 AS angerfrist_till,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - floor(COALESCE(a.anvanda, 0)::numeric * COALESCE(k.betalt_ore, 0)::numeric / k.timmar::numeric)::integer, 0) AS vid_anger_ore,
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar_pa_kopet - COALESCE(a.anvanda, 0), 0) END AS gratis_kvar,
    CASE WHEN k.timmar_pa_kopet > 0 AND k.betald_at IS NOT NULL
         THEN (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60 END AS gratis_till,
    k.aterkallad_at,
    k.till_plan,
    (floor(k.timpris_ore::numeric * (100 - COALESCE(k.rabatt_procent, 0))::numeric / 10000::numeric) * 100::numeric)::integer
      AS rabatterat_timpris_ore
   FROM klippkort k
     LEFT JOIN LATERAL ( SELECT sum(CASE WHEN b.forsta_klippkort_id = k.id
                                         THEN LEAST(b.forsta_klippkort_timmar::numeric, d.a)
                                         ELSE GREATEST(d.a - COALESCE(b.forsta_klippkort_timmar, 0)::numeric, 0::numeric)
                                    END)::integer AS anvanda
           FROM bookings b
             CROSS JOIN LATERAL ( SELECT GREATEST(GREATEST(1::numeric, ceil(LEAST(COALESCE(b.duration_min, 60), COALESCE(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0))
                                                  - CASE WHEN b.startrabatt THEN 1 ELSE 0 END::numeric, 0::numeric) AS a) d
          WHERE (b.klippkort_id = k.id OR b.forsta_klippkort_id = k.id)
            AND b.klippkort_id IS NOT NULL
            AND b.status <> 'cancelled'::text) a ON true;

comment on column public.klippkort_saldo.aterkallad_at is
  'timmarna_delas: när admin tog tillbaka gratistimmarna. Kortet har då inget kvar.';
comment on column public.klippkort_saldo.till_plan is
  'timmarna_delas: planen timmarna köpts till (plan_extra).';
comment on column public.klippkort_saldo.rabatterat_timpris_ore is
  'timmarna_delas: timpriset kortet köptes för (timpris_ore minus rabatten, nedåt till hel krona). För en '
  'plan är det priset för timmar som köps till den.';

/* Samma kolumner. En rad per kort och pass: ett pass som drogs från två
   kort står på båda, med timmarna från vart och ett. */
create or replace view public.klippkort_rorelser
with (security_invoker = true) as
 SELECT k.parent_id,
    k.id AS klippkort_id,
    b.id AS booking_id,
    t.timmar,
    b.wanted_date AS datum,
    b.status
   FROM klippkort k
     JOIN bookings b ON b.klippkort_id = k.id OR b.forsta_klippkort_id = k.id
     CROSS JOIN LATERAL ( SELECT GREATEST(GREATEST(1::numeric, ceil(LEAST(COALESCE(b.duration_min, 60), COALESCE(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0))
                                          - CASE WHEN b.startrabatt THEN 1 ELSE 0 END::numeric, 0::numeric) AS a) d
     CROSS JOIN LATERAL ( SELECT (CASE WHEN b.forsta_klippkort_id = k.id
                                       THEN LEAST(b.forsta_klippkort_timmar::numeric, d.a)
                                       ELSE GREATEST(d.a - COALESCE(b.forsta_klippkort_timmar, 0)::numeric, 0::numeric)
                                  END)::integer AS timmar) t
  WHERE b.status <> 'cancelled'::text AND b.klippkort_id IS NOT NULL AND t.timmar > 0;


-- ---------- 4. timmarna betalar passet ----------
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
  saldo int;
  fd    record;
begin
  if rad.klippkort_id is not null
     or rad.betalning_status not in ('ingen', 'vantar', 'misslyckad')
     or rad.parent_id is null
     or not rad.fakturerbar
     or coalesce(rad.antal_barn, 1) > 1
     or not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false)
     or intern.timbank_betalt(rad.id) then
    return rad;
  end if;

  /* timmarna_delas (2026-10-14): ett pass med en timme på köpet betalas med
     timmar för resten (Leo: "tipstimmen används också före planerna då den
     är gratis"). Ett pass på en timme med timmen på köpet kostar inget. */
  behov := intern.passets_korttimmar(rad);
  if behov <= 0 then
    return rad;
  end if;
  -- Kortet ska gälla passets dag och i dag.
  dag := greatest(coalesce(rad.wanted_date, idag), idag);

  if vanta then
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update;
  else
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update nowait;
  end if;

  /* Gratis timmar först, sedan kortet som går ut först, och passet kan
     dras från två kort (intern.timmar_fordela). */
  select * into fd from intern.timmar_fordela(rad.parent_id, dag, behov, rad.id);
  if fd.kort is not null then
    rad.klippkort_id := fd.kort;
    rad.forsta_klippkort_id := fd.forsta;
    rad.forsta_klippkort_timmar := fd.forsta_timmar;
    rad.betalning_status := 'betald';
    rad.betald_at := now();
    return rad;
  end if;

  -- Timbanken betalar hela pass, inte resten av ett med en timme på köpet.
  if rad.startrabatt then
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


create or replace function public.klippkort_dra(p_pass uuid, p_foralder uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  b      public.bookings;
  behov  int;
  dag    date;
  fd     record;
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

  /* timmarna_delas (2026-10-14): ett pass med en timme på köpet drar
     resten ur timmarna (förut nekades det, Fas 19.5). Fas 20.1: ett
     genomfört pass som blev kortare än bokat drar bara de påbörjade
     timmar som hölls. */
  behov := intern.passets_korttimmar(b);
  if behov <= 0 then
    return jsonb_build_object('fel', 'Timmen på köpet täcker hela passet, så det finns inget att betala.');
  end if;
  dag := greatest(b.wanted_date, (now() at time zone 'Europe/Stockholm')::date);

  /* Alla familjens kort låses FÖRST, och timmarna räknas i en egen sats
     efteråt. I read committed får varje sats en ny ögonblicksbild, så
     två samtidiga dragningar ser varandras timmar. Räknades de i samma
     sats som låset hade den andra kunnat dra på ett saldo som redan
     var förbrukat. */
  perform 1 from public.klippkort where parent_id = p_foralder and status = 'betald' for update;

  -- Samma val som när timmarna betalar av sig själva (intern.timmar_betala).
  select * into fd from intern.timmar_fordela(p_foralder, dag, behov, b.id);
  if fd.kort is null then
    return jsonb_build_object('fel', 'Ni har inga timmar kvar som räcker till passet, eller som gäller den dagen.');
  end if;

  update public.bookings
     set klippkort_id = fd.kort,
         forsta_klippkort_id = fd.forsta,
         forsta_klippkort_timmar = fd.forsta_timmar,
         betalning_status = 'betald',
         betald_at = now()
   where id = p_pass;

  return jsonb_build_object('ok', true, 'klippkort', fd.kort, 'kvar', fd.kvar,
                            'forsta', fd.forsta, 'forsta_timmar', fd.forsta_timmar,
                            'session', b.stripe_session_id);
end $$;

revoke execute on function public.klippkort_dra(uuid, uuid) from public, anon, authenticated;


/* Ett köp som blir betalt betalar familjens kommande pass i datumordning,
   så långt timmarna räcker. timmarna_delas: med samma val som annars
   (intern.timmar_betala), alla kort och inte bara det nya, och också pass
   med en timme på köpet. */
create or replace function intern.timmar_betalar_kommande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  p     record;
  rad   public.bookings;
begin
  -- timmarna_delas (2026-10-14): alla kort, och pass med en timme på köpet.
  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false) then
    return null;
  end if;

  begin
    for p in
      select b.id
        from public.bookings b
       where b.parent_id = new.parent_id
         and b.status in ('requested', 'confirmed')
         and b.klippkort_id is null
         and b.betalning_status in ('ingen', 'vantar', 'misslyckad')
         and b.fakturerbar
         and coalesce(b.antal_barn, 1) <= 1
         and b.wanted_date >= idag
         and not intern.timbank_betalt(b.id)
       order by b.wanted_date, b.wanted_time nulls last, b.created_at, b.id
    loop
      select * into rad
        from public.bookings
       where id = p.id
         and status in ('requested', 'confirmed')
         and klippkort_id is null
         and betalning_status in ('ingen', 'vantar', 'misslyckad')
         for update skip locked;
      continue when not found;
      rad := intern.timmar_betala(rad, true);
      if rad.betalning_status = 'betald' then
        update public.bookings
           set klippkort_id = rad.klippkort_id,
               forsta_klippkort_id = rad.forsta_klippkort_id,
               forsta_klippkort_timmar = rad.forsta_klippkort_timmar,
               betalning_status = 'betald',
               betald_at = rad.betald_at
         where id = p.id;
      end if;
    end loop;
  exception when others then
    perform public.skapa_uppgift(
      'Köpta timmar betalade inte familjens bokade pass',
      'timmar_betalar:' || new.id,
      'kontroll',
      'Köpet är betalt och timmarna finns på kortet, men de betalade inte familjens förslag och bekräftade pass: '
        || left(sqlerrm, 300) || ' Jobbet timmar-betalar prövar igen inom fem minuter, och ett bekräftat pass går att betala med Betala med timmar i föräldravyn.',
      'profiles', new.parent_id::text);
  end;
  return null;
end $$;

revoke execute on function intern.timmar_betalar_kommande() from public, anon, authenticated;


create or replace function intern.timmar_betalar_obetalda(p_foralder uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  idag    date := (now() at time zone 'Europe/Stockholm')::date;
  pass_id uuid;
  rad     public.bookings;
  n       int := 0;
begin
  perform intern.obesvarade_forslag_slapper_timmarna(p_foralder);

  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false) then
    return 0;
  end if;

  /* Förurvalet frågar bara om familjen har ett kort som går att använda
     eller en bank som räcker. Om timmarna räcker till just det här
     passet avgör valet. timmarna_delas (2026-10-14): också pass med en
     timme på köpet. */
  for pass_id in
    select b.id
      from public.bookings b
     where (p_foralder is null or b.parent_id = p_foralder)
       and b.status in ('requested', 'confirmed')
       and b.klippkort_id is null
       and b.betalning_status in ('ingen', 'vantar', 'misslyckad')
       and b.parent_id is not null
       and b.fakturerbar
       and coalesce(b.antal_barn, 1) <= 1
       and b.wanted_date >= idag
       and not intern.timbank_betalt(b.id)
       and (exists (select 1 from public.klippkort_saldo k
                     where k.parent_id = b.parent_id and k.brukbar
                       -- gratistimmarna_60_dagar: en gratis timme gäller efter planens månad.
                       and (k.giltigt_till >= b.wanted_date or k.gratis_till >= b.wanted_date))
            or coalesce(intern.timbank_saldo(b.parent_id), 0) >= coalesce(b.duration_min, 60))
     order by b.wanted_date, b.wanted_time nulls last, b.created_at, b.id
  loop
    begin
      select * into rad
        from public.bookings
       where id = pass_id
         and status in ('requested', 'confirmed')
         and klippkort_id is null
         and betalning_status in ('ingen', 'vantar', 'misslyckad')
         for update skip locked;
      if found then
        rad := intern.timmar_betala(rad, false);
        if rad.betalning_status = 'betald' then
          update public.bookings
             set klippkort_id = rad.klippkort_id,
                 forsta_klippkort_id = rad.forsta_klippkort_id,
                 forsta_klippkort_timmar = rad.forsta_klippkort_timmar,
                 betalning_status = 'betald',
                 betald_at = rad.betald_at
           where id = pass_id;
          n := n + 1;
        end if;
      end if;
    exception
      when lock_not_available then
        null;  -- någon betalar eller bekräftar just nu; nästa körning
      when others then
        perform public.skapa_uppgift(
          'Köpta timmar betalade inte ett pass',
          'timmar_betalar_pass:' || pass_id,
          'kontroll',
          'Timmarna räcker till passet, men de kunde inte betala det: ' || left(sqlerrm, 300)
            || ' Är passet bekräftat kan familjen betala det med Betala med timmar, och jobbet prövar igen om fem minuter.',
          'bookings', pass_id::text);
    end;
  end loop;
  return n;
end $$;

revoke execute on function intern.timmar_betalar_obetalda(uuid) from public, anon, authenticated;


-- ---------- 5. de sparade minuterna ----------
create or replace function intern.timbank_in(b public.bookings)
returns integer
language sql
stable
set search_path = public
as $$
  select case
           when b.status is distinct from 'completed'
             or b.betalning_status not in ('betald', 'tvist') then 0
           when b.klippkort_id is not null then
             case
               -- timmarna_delas (2026-10-14): timmen på köpet täckte hela passet.
               when t.a <= 0 then 0
               -- Gratistimmar (2026-10-13) sparar inget: sparade minuter
               -- betalas tillbaka i kronor när familjen slutar, och en gåva
               -- hade då blivit pengar. Det som blir över är den sista
               -- timmen, och den kom från första kortet om passet inte drog
               -- längre än så.
               when intern.ar_gratistimmar(case when t.a <= coalesce(b.forsta_klippkort_timmar, 0)
                                                then b.forsta_klippkort_id else b.klippkort_id end) then 0
               else greatest(1, ceil(h.hallet / 60.0))::int * 60 - h.hallet
             end
           when exists (select 1 from public.timbank_uttag u
                         where u.booking_id = b.id and u.sort = 'pass')
             then coalesce(b.duration_min, 60) - h.hallet
           else 0
         end
    from (select least(coalesce(b.duration_min, 60),
                       coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) as hallet) h
    cross join lateral (select greatest(greatest(1, ceil(h.hallet / 60.0))::int
                                        - case when b.startrabatt then 1 else 0 end, 0) as a) t
$$;


-- ---------- 6. skydden ----------
create or replace function public.skydda_klippkortet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  -- timmarna_delas (2026-10-14): också det första kortet.
  if tg_op = 'INSERT' then
    if new.klippkort_id is not null or new.forsta_klippkort_id is not null
       or new.forsta_klippkort_timmar is not null then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass har ingen betalning. Den sätts när passet betalas.';
    end if;
  elsif new.klippkort_id is distinct from old.klippkort_id
     or new.forsta_klippkort_id is distinct from old.forsta_klippkort_id
     or new.forsta_klippkort_timmar is distinct from old.forsta_klippkort_timmar then
    raise exception using errcode = '42501',
      message = 'Timmarna dras när passet betalas, inte härifrån.';
  end if;
  return new;
end $$;

/* Släpps passets timmar (huvudkortet blir null: ett förslag ingen svarat
   på, eller ett kort som vann över timmarna i webhooken) släpps det
   första kortet med. Före de andra triggrarna, som kan dra timmarna igen. */
create or replace function intern.forsta_kortet_foljer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.klippkort_id is null and new.forsta_klippkort_id is not null then
    new.forsta_klippkort_id := null;
    new.forsta_klippkort_timmar := null;
  end if;
  return new;
end $$;

revoke execute on function intern.forsta_kortet_foljer() from public, anon, authenticated;

create or replace trigger bookings_forsta_kortet_foljer
  before update on public.bookings
  for each row execute function intern.forsta_kortet_foljer();

/* Skyddet körs också när bara det första kortet skrivs. En UPDATE OF-
   trigger körs bara för kolumnerna i själva UPDATE:n, och skyddet ska
   inte hänga på vitlistan i skydda_bokningsfalt. */
create or replace trigger bookings_skydda_klippkortet
  before insert or update of klippkort_id, forsta_klippkort_id, forsta_klippkort_timmar on public.bookings
  for each row execute function public.skydda_klippkortet();


-- ---------- 7. gratistimmar tas tillbaka utan att raderas ----------
/* För en nolla för mycket, eller ett ändrat beslut. Timmar som ligger på
   ett förslag eller ett pass står kvar: passet är familjens, och avbokas
   det kommer timmen tillbaka som förut. Resten tas tillbaka: kortet
   krymper till timmarna på passen, och ligger inga timmar på något pass
   återkallas kortet (aterkallad_at). timmarna_delas (2026-10-14): kortet
   tas inte bort längre. Ett pass kan peka på det som första kort, och
   historiken ska stå kvar. Auditen loggar både krympningen och
   återkallelsen. */
create or replace function public.ta_tillbaka_gratistimmar(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k       public.klippkort;
  pa_pass integer;
begin
  if not public.is_admin() then
    raise exception 'Bara admin tar tillbaka gratistimmar.' using errcode = '42501';
  end if;
  select * into k from public.klippkort where id = p_id;
  if not found or k.erbjudande is distinct from 'gratis' then
    raise exception 'Det finns inga gratistimmar med det id:t.' using errcode = 'P0002';
  end if;
  -- timmarna_delas (2026-10-14): ett återkallat kort har inget kvar att ta.
  if k.aterkallad_at is not null then
    return jsonb_build_object('ok', true, 'tillbaka', 0, 'pa_pass', 0, 'borttagen', true);
  end if;

  -- Familjens kort låses som när timmar dras (klippkort_dra,
  -- intern.timmar_betala), så att inget pass hinner ta en timme emellan.
  perform 1 from public.klippkort where parent_id = k.parent_id and status = 'betald' for update;

  -- Timmarna på förslag och pass, räknade som i klippkort_saldo.
  pa_pass := intern.kortets_anvanda(p_id, null);

  if pa_pass >= k.timmar then
    return jsonb_build_object('ok', true, 'tillbaka', 0, 'pa_pass', pa_pass);
  end if;

  if pa_pass > 0 then
    update public.klippkort set timmar = pa_pass where id = p_id;
    return jsonb_build_object('ok', true, 'tillbaka', k.timmar - pa_pass, 'pa_pass', pa_pass);
  end if;

  update public.klippkort set aterkallad_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'tillbaka', k.timmar, 'pa_pass', 0, 'borttagen', true);
end $$;

revoke all on function public.ta_tillbaka_gratistimmar(uuid) from public, anon;
grant execute on function public.ta_tillbaka_gratistimmar(uuid) to authenticated;

comment on function public.ta_tillbaka_gratistimmar(uuid) is
  '2026-10-13, timmarna_delas 2026-10-14. Admin tar tillbaka gratistimmar som inte ligger på något förslag '
  'eller pass. Timmarna på passen står kvar; ligger inga där återkallas kortet (aterkallad_at).';

-- Auditen loggar också när ett kort återkallas. Samma kolumner som förut,
-- och återkallelsen, utan namnet.
create or replace trigger klippkort_audit
  after insert or update of status, giltigt_till, aterbetald_ore, timmar, aterkallad_at or delete on public.klippkort
  for each row execute function public.logga_andring(
    'klippkort', 'id', 'parent_id', 'erbjudande', 'timmar', 'timmar_pa_kopet', 'status', 'giltigt_till',
    'begart_ore', 'betalt_ore', 'aterbetald_ore', 'aterkallad_at');


-- ---------- 8. köp till timmar ----------
/* Vad N timmar till familjens plan kostar, för kassan (stripe-checkout)
   och vyn. Den inloggade familjens senaste plan som gäller minst en dag
   till: timmarna går ut samma dag som den, och en kassa är öppen i högst
   ett dygn, så den hinner inte gå ut före betalningen. Priset är planens
   eget timpris och rabatt (rabatterat_timpris_ore i klippkort_saldo), inte
   katalogens: höjs priset gäller det inte en plan som redan är köpt.
   Svarar bara om den inloggade själv. */
create or replace function public.extra_timmar_erbjudande(p_timmar integer)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  jag     uuid := auth.uid();
  idag    date := (now() at time zone 'Europe/Stockholm')::date;
  p       record;
  timpris integer;
begin
  if jag is null then
    return jsonb_build_object('fel', 'Logga in först.');
  end if;
  if not exists (select 1 from public.profiles where id = jag and role = 'parent') then
    return jsonb_build_object('fel', 'Timmar köps av familjen.');
  end if;
  if p_timmar is null or p_timmar < 1 or p_timmar > 20 then
    return jsonb_build_object('fel', 'Välj mellan 1 och 20 timmar.');
  end if;

  select k.id, k.namn, k.giltigt_till, k.timpris_ore, coalesce(k.rabatt_procent, 0) as rabatt
    into p
    from public.klippkort k
   where k.parent_id = jag and k.sort = 'plan' and k.status = 'betald'
     and k.giltigt_till > idag
   order by k.giltigt_till desc, k.created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('fel', 'Timmar köps till en plan som gäller minst en dag till. Köp en plan eller '
                                     || 'Fyll timbanken i stället.');
  end if;

  timpris := (floor(p.timpris_ore::numeric * (100 - p.rabatt) / 10000) * 100)::integer;
  return jsonb_build_object('ok', true,
                            'plan', p.id,
                            'plan_namn', p.namn,
                            'timmar', p_timmar,
                            'timpris_ore', p.timpris_ore,
                            'rabatt_procent', p.rabatt,
                            'rabatterat_timpris_ore', timpris,
                            'pris_ore', timpris * p_timmar,
                            'giltigt_till', p.giltigt_till);
end $$;

revoke all on function public.extra_timmar_erbjudande(integer) from public, anon;
grant execute on function public.extra_timmar_erbjudande(integer) to authenticated, service_role;

comment on function public.extra_timmar_erbjudande(integer) is
  'timmarna_delas (2026-10-14): priset för 1–20 timmar till den inloggade familjens plan, och planens sista dag. '
  'Läses av stripe-checkout, som skapar köpet (erbjudandet plan_extra, till_plan).';

/* Webhooken: köpet är betalt. timmarna_delas (2026-10-14): timmar som
   köpts till en plan gäller till planens sista dag, aldrig kortare än i
   dag. Hann planen gå ut innan betalningen kom (kassan prövar att den
   gäller minst en dag till, så det ska inte hända) får admin en uppgift. */
create or replace function public.klippkort_betald(p_id uuid, p_betalt integer, p_pi text, p_charge text,
                                                   p_bt text, p_avgift integer, p_netto integer,
                                                   p_skarp boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  idag          date := (now() at time zone 'Europe/Stockholm')::date;
  planens_sista date;
  familj        uuid;
  blev          boolean;
begin
  -- timmarna_delas (2026-10-14): timmar till en plan går ut med planen.
  select p.giltigt_till, k.parent_id into planens_sista, familj
    from public.klippkort k
    join public.klippkort p on p.id = k.till_plan
   where k.id = p_id;

  update public.klippkort
     set status = 'betald',
         betald_at = now(),
         giltigt_till = case when till_plan is not null
                             then greatest(coalesce(planens_sista, idag), idag)
                             else ((now() at time zone 'Europe/Stockholm')::date
                                   + make_interval(months => giltig_manader))::date end,
         betalt_ore = p_betalt,
         stripe_payment_intent_id = p_pi,
         stripe_charge_id = p_charge,
         stripe_balanstransaktion_id = p_bt,
         stripe_avgift_ore = p_avgift,
         stripe_netto_ore = p_netto,
         stripe_skarp = p_skarp,
         aterbetald_ore = 0
   where id = p_id and status in ('vantar', 'misslyckad');
  blev := found;

  if blev and planens_sista is not null and planens_sista < idag then
    perform public.skapa_uppgift(
      'Timmar köptes till en plan som hunnit gå ut',
      'extra_timmar_efter_planen:' || p_id,
      'kontroll',
      'Familjen köpte till timmar till sin plan, men betalningen kom först efter planens sista dag. Timmarna '
        || 'gäller bara i dag. Hör av er till familjen och betala tillbaka det som inte hinner användas.',
      'profiles', familj::text);
  end if;
  return blev;
end $$;


/* Påminnelsen tio dagar innan: timmar som köpts till en plan går ut samma
   dag som planen och räknas med i planens mejl, så att familjen får ett
   mejl om dagen och inte ett per köp. Köps de när planens mejl redan gått
   kommer inget nytt: familjen har just valt dagen. Annars som förut. */
create or replace function intern.timmar_gar_ut_koa(p_nu timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  idag  date := (p_nu at time zone 'Europe/Stockholm')::date;
  timme int  := extract(hour from p_nu at time zone 'Europe/Stockholm')::int;
  -- Hur många dagar före sista dagen. Leo 2026-09-27.
  dagar constant int := 10;
  k     record;
  data  jsonb;
  nya   int := 0;
begin
  if timme < 9 or timme >= 20 then
    return 0;
  end if;

  for k in
    -- gratistimmarna_60_dagar: en gratis timme som inte använts går inte
    -- ut med planen, så den räknas inte här.
    -- timmarna_delas (2026-10-14): timmar köpta till planen räknas med den.
    select s.id, s.parent_id, x.kvar, s.giltigt_till
      from public.klippkort_saldo s
      cross join lateral (
        select s.kvar - case when s.gratis_till > s.giltigt_till then s.gratis_kvar else 0 end
               + coalesce((select sum(e.kvar)::int from public.klippkort_saldo e
                            where e.till_plan = s.id and e.status = 'betald'
                              and e.giltigt_till = s.giltigt_till), 0) as kvar) x
     where s.status = 'betald'
       -- gratistimmar (2026-10-13): mejlet gäller köpta timmar och lovar
       -- att resten betalas tillbaka. Sista dagen står i vyn.
       and s.erbjudande is distinct from 'gratis'
       and s.till_plan is null
       and x.kvar > 0
       and s.giltigt_till between idag and idag + dagar
  loop
    continue when exists (
      select 1 from public.notiser n
       where n.mottagare = k.parent_id and n.typ = 'timmar_gar_ut'
         and n.data ->> 'klippkort' = k.id::text
         and n.data ->> 'datum' = k.giltigt_till::text);

    data := jsonb_build_object('datum', k.giltigt_till, 'kvar', k.kvar, 'klippkort', k.id);

    insert into public.notiser (mottagare, typ, trad_parent, data)
    values (k.parent_id, 'timmar_gar_ut', k.parent_id, data);
    nya := nya + 1;

    if public.notis_vill(k.parent_id, 'timmar_gar_ut', 'mejl') then
      -- Sista chansen att skicka är sista dagens slut: efter det är
      -- påminnelsen om timmar som redan förfallit.
      perform intern.notis_koa(k.parent_id, 'mejl', 'timmar_gar_ut', null, k.parent_id, null, data, null,
        'timmar_gar_ut:mejl:' || k.parent_id || ':' || k.id || ':' || k.giltigt_till,
        p_nu, ((k.giltigt_till + 1)::timestamp at time zone 'Europe/Stockholm'));
    end if;
  end loop;
  return nya;
end $function$;

revoke execute on function intern.timmar_gar_ut_koa(timestamptz) from public, anon, authenticated;


-- ---------- 9. bonusens text ----------
-- Adminvyn visar beskrivningen under System. flaggor_stampla fryser
-- beskrivningen vid varje update, så den står av bara runt den här raden,
-- som i fyll_timbanken. aktiv och uppdaterad rörs inte.
alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set beskrivning = 'En studiehjälpare får 300 kr i lön, inklusive semesterersättning, när vi tar in någon som sökt '
                  || 'jobb med hens kod.'
 where kod = 'tipsbonus'
   and beskrivning = 'En studiehjälpare får 300 kr i lön när vi tar in någon som sökt jobb med hens kod.';

alter table public.flaggor enable trigger flaggor_stampla;

do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
end $$;


-- ---------- 10. villkoren ----------
-- Sidans datum och versionen följs åt (kolla-villkor.py), och alla får
-- frågan igen vid nästa inloggning.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-14'::text $$;
