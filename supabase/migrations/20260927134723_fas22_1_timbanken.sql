-- ============================================================
-- Fas 22.1: timbanken — det som blev över på ett pass betalt med timmar
--
-- Leo 2026-09-27: "om man köper timmar i förväg genom klippkort ... och
-- använder till exempel 1 timme 45 minuter ska 15 minuter föras över
-- till timbanken för att kunna använda 15 minuter extra vid nästa
-- tillfälle gratis".
--
-- VARFÖR DEN BEHÖVS
--
-- Klippkortet drar en timme per påbörjad timme (villkoren, #erbjudanden),
-- men sedan Fas 20.1 kostar ett kortbetalt pass den hållna tiden per
-- påbörjad kvart. Ett pass bokat på två timmar som höll i 1 h 15 kostade
-- alltså 1 h 15 med kort men två hela timmar ur klippkortet: familjen som
-- köpt timmarna med rabatt betalade mer för samma pass. Klippkortet drar
-- som förut, och resten upp till hel timme, här 45 minuter, står i
-- familjens timbank.
--
-- TRE BESLUT, LEOS SAMMA DAG:
--
--   1. Bara köpta timmar fyller banken. Ett pass betalt med kort i förväg
--      som blev kortare får pengarna tillbaka, som villkoren lovar
--      (betalt_for_lange). Ett tillgodohavande i stället för en
--      återbetalning hade varit sämre för familjen än i dag.
--   2. Banken är familjens, inte elevens. Syskon delar den, som de delar
--      klippkortet.
--   3. Minuterna tar övertiden först, av sig själva, när rapporten skrivs.
--      Räcker de till ett helt pass går det att betala med timbanken, som
--      med ett klippkort. Utan det hade en familj vars pass ofta blir
--      korta samlat minuter ingen använder, och det är pengar vi är
--      skyldiga.
--
-- INSÄTTNINGARNA RÄKNAS, UTTAGEN LAGRAS
--
-- Det som går in räknas ur passen, som klippkortets saldo (Fas 16.1): en
-- avbokning eller en rättad tid ändrar saldot utan att någon skriver.
-- Uttagen lagras, för de beror på vad saldot var NÄR de gjordes. Övertiden
-- tas ur det som fanns när rapporten skrevs, och en insättning som kommer
-- senare ska inte göra ett betalt tillägg onödigt i efterhand.
--
-- MINUTERNA GÅR INTE UT. De är betalda timmar som inte hölls, och en sista
-- dag hade gjort något vi är skyldiga till en frist ingen godkänt.
-- Slutar familjen betalas de tillbaka (timbank_utbetald).
--
-- skydda_bokningsfalt, klippkortspass_avbokat och avvikelser_rader
-- LAPPAS, de skrivs inte om: Fas 21.1 ändrade de två första i driften
-- samma eftermiddag. passunderlag skrivs om, men bara om driftens
-- definition är den som lästes när migrationen skrevs.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- uttagen ----------
create table public.timbank_uttag (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references public.profiles(id) on delete restrict,
  booking_id  uuid references public.bookings(id) on delete cascade,
  sort        text not null check (sort in ('overtid', 'pass', 'utbetald')),
  minuter     int  not null check (minuter > 0),
  -- Bara en utbetalning har ett belopp: vad minuterna betalades tillbaka för.
  varde_ore   int  check (varde_ore is null or varde_ore >= 0),
  created_at  timestamptz not null default now(),
  constraint timbank_uttag_pass_eller_utbetalning check ((sort = 'utbetald') = (booking_id is null)),
  constraint timbank_uttag_utbetalning_har_belopp check ((sort = 'utbetald') = (varde_ore is not null))
);

comment on table public.timbank_uttag is
  'Fas 22.1: minuter familjen använt ur timbanken (övertid, ett helt pass) eller fått utbetalda. Insättningarna räknas ur passen. Skrivs bara av databasen.';

create unique index timbank_uttag_ett_per_pass on public.timbank_uttag (booking_id, sort)
  where booking_id is not null;
create index timbank_uttag_familj on public.timbank_uttag (parent_id);

alter table public.timbank_uttag enable row level security;
revoke all on public.timbank_uttag from anon, authenticated;
grant select on public.timbank_uttag to authenticated;

-- Ingen skrivpolicy, med flit, som klippkort och pass_tillagg.
-- Studiehjälparen läser uttaget på sina egna pass: övertiden hen skrev in
-- står där, och hens lön räknas ur det (passunderlag.lon_min).
create policy "familjen, studiehjälparen och admin läser uttagen"
  on public.timbank_uttag for select to authenticated
  using (
    parent_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.bookings b
                where b.id = booking_id and b.tutor_id = auth.uid())
  );

-- Uttagen styr pengar och hör till auditloggen. De tas bort när admin
-- rättar en tid (övertiden räknas om), och det ska också synas.
create trigger timbank_uttag_audit
  after insert or update or delete on public.timbank_uttag
  for each row execute function public.logga_andring(
    'timbank', 'id', 'parent_id', 'booking_id', 'sort', 'minuter', 'varde_ore');

-- ---------- insättningen, per pass ----------
/* Minuterna ett pass sätter in: det som betalades med köpta timmar men
   inte hölls. Noll för allt annat, också för ett pass betalt med kort.

   Klippkortet drar en timme per påbörjad timme av den hållna tiden
   (klippkort_dra), så det som går in är resten upp till hel timme:
   1 h 45 ger 15, 1 h 15 ger 45, jämna timmar ger noll. Ett pass betalt
   med timbanken drog det bokade, och det som inte hölls går tillbaka.

   Den hållna tiden är samma uttryck som i klippkort_saldo, aldrig mer
   än det bokade: övertid sätter inte in något. En elev som uteblev har
   ingen tid i rapporten, och då gäller det bokade (villkoren).

   Anroparens RLS gäller, också i intern.debiterade_min. Genom
   intern.timbank_saldo körs den som ägaren. */
create or replace function intern.timbank_in(b public.bookings)
returns int
language sql
stable
set search_path = public
as $$
  select case
           when b.status is distinct from 'completed'
             or b.betalning_status not in ('betald', 'tvist') then 0
           when b.klippkort_id is not null
             then greatest(1, ceil(h.hallet / 60.0))::int * 60 - h.hallet
           when exists (select 1 from public.timbank_uttag u
                         where u.booking_id = b.id and u.sort = 'pass')
             then coalesce(b.duration_min, 60) - h.hallet
           else 0
         end
    from (select least(coalesce(b.duration_min, 60),
                       coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) as hallet) h
$$;

-- ---------- saldot ----------
/* Familjens minuter. SECURITY DEFINER, för att studiehjälparen ska se
   familjens saldo på passet hen håller utan att se familjens andra pass.
   Därför is_admins vakt från första raden (avsnitt 6): den svarar för
   familjen själv, för en studiehjälpare som har ett pass med familjen,
   för admin och för databasen själv (triggern och funktionerna nedan,
   där auth.uid() är null). Alla andra får null.

   Ett uttag på ett avbokat pass räknas inte: timmarna kommer tillbaka
   av sig själva, som på klippkortet. */
create or replace function intern.timbank_saldo(p_foralder uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (auth.uid() is null or auth.uid() = p_foralder or public.is_admin()
          or exists (select 1 from public.bookings x
                      where x.parent_id = p_foralder and x.tutor_id = auth.uid())) then
    return null;
  end if;
  return coalesce((select sum(intern.timbank_in(b))
                     from public.bookings b
                    where b.parent_id = p_foralder and b.status = 'completed'), 0)::int
       - coalesce((select sum(u.minuter)
                     from public.timbank_uttag u
                     left join public.bookings b on b.id = u.booking_id
                    where u.parent_id = p_foralder
                      and (u.booking_id is null or b.status is distinct from 'cancelled')), 0)::int;
end $$;

/* Vad minuterna är värda när familjen slutar: det ordinarie timpriset
   på familjens senaste klippkort, per minut, uppåt till helt öre.

   ORDINARIE, INTE RABATTERAT. klippkort_saldo räknar de använda timmarna
   till ordinarie pris när familjen slutar (vid_uppsagning_ore), och de
   hela timmar minuterna kom ur är räknade som använda där. Tillbaka till
   samma pris tar de ut varandra: familjen har då betalat ordinarie pris
   för den tid som faktiskt hölls. Inom ångerfristen räknar klippkortet
   till det lägre, betalda priset, och då får familjen mer tillbaka för
   minuterna än vi hade behövt ge, aldrig mindre.

   Anroparens RLS: familjen och admin läser klippkortet, ingen annan. */
create or replace function intern.timbank_varde(p_foralder uuid, p_minuter int)
returns int
language sql
stable
set search_path = public
as $$
  select case when p_minuter > 0 then ceil(p_minuter * k.timpris_ore / 60.0)::int end
    from public.klippkort k
   where k.parent_id = p_foralder and k.status in ('betald', 'tvist', 'aterbetald')
   order by k.betald_at desc nulls last, k.created_at desc
   limit 1
$$;

/* Bokningarnas skydd frågar om ett pass är betalt med timbanken. Svarar
   bara ja eller nej om ett pass-id, och ligger i intern: inget API. */
create or replace function intern.timbank_betalt(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.timbank_uttag u
                  where u.booking_id = p_booking and u.sort = 'pass')
$$;

revoke all on function intern.timbank_in(public.bookings) from public, anon;
revoke all on function intern.timbank_saldo(uuid) from public, anon;
revoke all on function intern.timbank_varde(uuid, int) from public, anon;
revoke all on function intern.timbank_betalt(uuid) from public, anon;
-- Vyerna nedan är security_invoker och kör funktionerna som anroparen.
grant execute on function intern.timbank_in(public.bookings) to authenticated, service_role;
grant execute on function intern.timbank_saldo(uuid) to authenticated, service_role;
grant execute on function intern.timbank_varde(uuid, int) to authenticated, service_role;
grant execute on function intern.timbank_betalt(uuid) to authenticated, service_role;

create or replace view public.timbank_saldo with (security_invoker = true) as
select p.id as parent_id,
       s.saldo as saldo_min,
       -- Beloppet visas för familjen och admin; för alla andra är det null.
       intern.timbank_varde(p.id, s.saldo) as varde_ore
  from public.profiles p
  cross join lateral (select intern.timbank_saldo(p.id) as saldo) s
 where p.role = 'parent' and s.saldo is not null;

comment on view public.timbank_saldo is
  'Fas 22.1: familjens minuter i timbanken, och vad de är värda om familjen slutar.';

/* Vad som gått in och ut, rad för rad. Insättningen dateras med
   rapporten som gjorde den, ett uttag med när det gjordes. */
create or replace view public.timbank_rorelser with (security_invoker = true) as
select b.parent_id,
       b.id as booking_id,
       'in'::text as sort,
       i.minuter,
       null::int as varde_ore,
       b.wanted_date as datum,
       coalesce((select min(r.created_at) from public.lesson_reports r
                  where r.booking_id = b.id and r.start_tid is not null), b.betald_at) as tid
  from public.bookings b
  cross join lateral (select intern.timbank_in(b) as minuter) i
 where b.status = 'completed' and i.minuter > 0
union all
select u.parent_id,
       u.booking_id,
       u.sort,
       -u.minuter,
       u.varde_ore,
       coalesce(b.wanted_date, (u.created_at at time zone 'Europe/Stockholm')::date),
       u.created_at
  from public.timbank_uttag u
  left join public.bookings b on b.id = u.booking_id
 where u.booking_id is null or b.status is distinct from 'cancelled';

comment on view public.timbank_rorelser is
  'Fas 22.1: timbankens insättningar (positiva) och uttag (negativa).';

revoke all on public.timbank_saldo, public.timbank_rorelser from anon;
grant select on public.timbank_saldo, public.timbank_rorelser to authenticated;

-- ---------- övertiden, när rapporten skrivs ----------
/* Leo: "använda 15 minuter extra vid nästa tillfälle gratis". Övertiden
   tas ur banken innan någon ser ett tillägg: så mycket som finns, upp
   till övertiden. 15 minuter i banken och 30 över ger 15 ur banken och
   ett tillägg för resten. Hur passet betalas spelar ingen roll: i förväg
   eller efter, med kort, timmar eller faktura betalas bara det banken
   inte täckte.

   Ett pass med fler barn tar inget ur banken, av samma skäl som
   klippkortet inte betalar det: minuterna kostade priset för ett barn.
   Är ett tillägg redan betalt täcker banken bara det tillägget inte
   täckte, annars hade samma kvart betalats två gånger.

   Rättar admin tiden räknas uttaget om: det gamla tas bort, och det
   saldot ger tillbaka räknas med. Tas rapporten bort går minuterna
   tillbaka. Uttaget görs under ett lås per familj, så att två rapporter
   samma sekund inte tar samma minuter. */
create or replace function intern.timbank_overtid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bid    uuid := case when tg_op = 'DELETE' then old.booking_id else new.booking_id end;
  b      public.bookings;
  over   int;
  saldo  int;
begin
  if tg_op = 'UPDATE' and new.start_tid is not distinct from old.start_tid
     and new.slut_tid is not distinct from old.slut_tid
     and new.booking_id is not distinct from old.booking_id then
    return null;
  end if;
  if bid is null then
    return null;
  end if;
  select * into b from public.bookings where id = bid;
  if not found or b.parent_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('timbank:' || b.parent_id::text, 0));
  delete from public.timbank_uttag where booking_id = bid and sort = 'overtid';

  if tg_op = 'DELETE' or not b.fakturerbar or coalesce(b.antal_barn, 1) > 1 then
    return null;
  end if;

  over := coalesce(intern.debiterade_min(bid), b.duration_min, 60) - coalesce(b.duration_min, 60)
        - coalesce((select t.minuter from public.pass_tillagg t
                     where t.booking_id = bid and t.status in ('betald', 'tvist')), 0);
  if over <= 0 then
    return null;
  end if;

  saldo := coalesce(intern.timbank_saldo(b.parent_id), 0);
  if saldo > 0 then
    insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
    values (b.parent_id, bid, 'overtid', least(over, saldo));
  end if;
  return null;
end $$;

revoke execute on function intern.timbank_overtid() from public, anon, authenticated;

-- Efter lesson_reports_gor_passet_genomfort (namnordning): passet är
-- genomfört när uttaget görs.
create trigger lesson_reports_timbank
  after insert or delete or update of start_tid, slut_tid, booking_id on public.lesson_reports
  for each row execute function intern.timbank_overtid();

-- ---------- ett helt pass, betalt med timbanken ----------
/* Samma regler som klippkort_dra, för samma pass: bekräftat eller
   genomfört, obetalt, ett barn, inte ett pass med första timmen bjuden
   (Fas 19.5). Banken betalar det bokade. Blir passet kortare går resten
   tillbaka av sig själv (intern.timbank_in); drar det över tas
   övertiden ur det som är kvar när rapporten skrivs.

   Passet står som 'betald' utan klippkort och utan betalt_ore: det är
   så passunderlag, avvikelserna och månadskörningen redan läser ett
   pass betalt utan kortpengar. Det som skiljer är uttaget.

   Bara service_role (klippkort-betala), som klippkort_dra: familjen
   kan inte själv skriva betalning_status. */
create or replace function public.timbank_dra(p_pass uuid, p_foralder uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  b      public.bookings;
  behov  int;
  saldo  int;
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
  if coalesce(b.antal_barn, 1) > 1 then
    return jsonb_build_object('fel', 'Timbanken gäller pass med ett barn. Det här passet betalas med kort.');
  end if;
  if b.startrabatt then
    return jsonb_build_object('fel', 'Första timmen är på köpet på det här passet, så det betalas med kort.');
  end if;

  behov := coalesce(b.duration_min, 60);
  perform pg_advisory_xact_lock(hashtextextended('timbank:' || p_foralder::text, 0));
  saldo := coalesce(intern.timbank_saldo(p_foralder), 0);
  if saldo < behov then
    return jsonb_build_object('fel', 'Timbanken räcker inte till passet. Det behöver '
      || behov || ' minuter, och banken har ' || greatest(saldo, 0) || '.');
  end if;

  insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
  values (p_foralder, p_pass, 'pass', behov)
  on conflict (booking_id, sort) where booking_id is not null
  do update set minuter = excluded.minuter, created_at = now();

  update public.bookings
     set betalning_status = 'betald',
         betald_at = now()
   where id = p_pass;

  return jsonb_build_object('ok', true, 'kvar', saldo - behov, 'session', b.stripe_session_id);
end $$;

revoke all on function public.timbank_dra(uuid, uuid) from public, anon, authenticated;
grant execute on function public.timbank_dra(uuid, uuid) to service_role;

/* Kortet vinner (stripe-webhook, punkt 6): kom en kortbetalning in på
   ett pass som redan betalats med timbanken, en kassa som stod öppen,
   är pengarna dragna och minuterna ska tillbaka. Uttaget tas bort och
   passet står som väntande, så att webhookens vanliga skrivning
   träffar. Svarar false när passet inte var betalt med timbanken. */
create or replace function public.timbank_kortet_vann(p_pass uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.bookings
     set betalning_status = 'vantar', betald_at = null
   where id = p_pass and betalning_status = 'betald' and klippkort_id is null
     and stripe_payment_intent_id is null and intern.timbank_betalt(p_pass);
  if not found then
    return false;
  end if;
  delete from public.timbank_uttag where booking_id = p_pass and sort = 'pass';
  return true;
end $$;

revoke all on function public.timbank_kortet_vann(uuid) from public, anon, authenticated;
grant execute on function public.timbank_kortet_vann(uuid) to service_role;

/* Familjen slutar: admin betalar tillbaka värdet tillsammans med det som
   är kvar på klippkortet, och markerar sedan banken utbetald här. Hela
   saldot, till värdet i timbank_saldo, på en rad som inte går att ändra
   från någon vy. Pengarna flyttas inte härifrån. */
create or replace function public.timbank_utbetald(p_foralder uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saldo int;
  varde int;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum betalar ut timbanken.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('timbank:' || p_foralder::text, 0));
  saldo := coalesce(intern.timbank_saldo(p_foralder), 0);
  if saldo <= 0 then
    return jsonb_build_object('fel', 'Timbanken är tom.');
  end if;
  varde := coalesce(intern.timbank_varde(p_foralder, saldo), 0);
  insert into public.timbank_uttag (parent_id, booking_id, sort, minuter, varde_ore)
  values (p_foralder, null, 'utbetald', saldo, varde);
  return jsonb_build_object('ok', true, 'minuter', saldo, 'varde_ore', varde);
end $$;

revoke all on function public.timbank_utbetald(uuid) from public, anon;
grant execute on function public.timbank_utbetald(uuid) to authenticated;

-- ---------- passunderlaget ----------
/* Övertiden banken tog räknas som betald: tillägget blir det banken
   inte täckte, lönen följer med uppåt (lon_min), och larmet
   tillagg_obetalt tystnar. timbank_min står sist, som en egen kolumn:
   kassan och fakturan tar debiterade_min minus den. */
do $$
begin
  if md5(pg_get_viewdef('public.passunderlag'::regclass, true)) <> '112bf41f963bf5bb497b731879a571e9' then
    raise exception 'passunderlag har ändrats i driften sedan migrationen skrevs. Läs den igen.';
  end if;
end $$;

create or replace view public.passunderlag with (security_invoker = true) as
select b.id,
       b.parent_id,
       b.tutor_id,
       b.student_id,
       b.subject,
       b.tjanst,
       b.wanted_date,
       b.wanted_time,
       b.duration_min,
       b.antal_barn,
       b.rabatt_ore,
       b.fakturerbar,
       b.fakturerbar_anledning,
       (exists (select 1 from public.lesson_reports r where r.booking_id = b.id)) as har_rapport,
       (exists (select 1 from public.invoice_lines l where l.booking_id = b.id)) as fakturerad,
       (exists (select 1 from public.payout_lines l where l.booking_id = b.id)) as pa_underlag,
       b.betalning_status,
       b.timpris_ore,
       b.extra_ore,
       b.startrabatt,
       t.deb as debiterade_min,
       t.betalda as betalda_min,
       case when t.deb <= b.duration_min or t.betalda >= t.deb then t.deb else b.duration_min end as lon_min,
       t.bank as timbank_min
  from public.bookings b
  cross join lateral (select coalesce(intern.debiterade_min(b.id), b.duration_min) as deb) d
  cross join lateral (
    select coalesce((select u.minuter from public.timbank_uttag u
                      where u.booking_id = b.id and u.sort = 'overtid'), 0) as bank
  ) tb
  cross join lateral (
    select d.deb,
           tb.bank,
           (case
              when b.betalning_status = 'faktura' then d.deb - tb.bank
              when b.betalning_status in ('betald', 'tvist') and b.klippkort_id is not null then b.duration_min
              when b.betalning_status in ('betald', 'tvist') then coalesce(b.stripe_minuter, b.duration_min)
              else 0
            end)
           + coalesce((select pt.minuter from public.pass_tillagg pt
                        where pt.booking_id = b.id and pt.status in ('betald', 'tvist')), 0)
           + tb.bank as betalda
  ) t
 where b.status = 'completed';

-- ---------- avbokningen ----------
/* Fas 21.1 lät familjen avboka ett pass betalt med timmar, för att inga
   pengar ligger på det och timmarna kommer tillbaka av sig själva. Ett
   pass betalt med timbanken är samma sak: uttaget på ett avbokat pass
   räknas inte i saldot. Två lappar, en rad var. */
do $$
declare
  fore   text := pg_get_functiondef('public.skydda_bokningsfalt'::regproc);
  gammal text := $g$and not (old.betalning_status = 'betald' and old.klippkort_id is not null$g$;
  ny     text := $n$and not (old.betalning_status = 'betald'
                  -- FAS 22.1: också ett pass betalt med timbanken.
                  and (old.klippkort_id is not null or intern.timbank_betalt(old.id))$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'skydda_bokningsfalt: villkoret från Fas 21.1 hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

do $$
declare
  fore   text := pg_get_functiondef('public.klippkortspass_avbokat'::regproc);
  gammal text := $g$and new.klippkort_id is not null and new.betalning_status = 'betald'$g$;
  ny     text := $n$and (new.klippkort_id is not null or intern.timbank_betalt(new.id)) -- Fas 22.1
     and new.betalning_status = 'betald'$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'klippkortspass_avbokat: villkoret från Fas 21.1 hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- larmen ----------
/* Fas 19.5:s villkor i ej_betalt räknar priset på den debiterade tiden.
   Den del av övertiden banken tog är betald, och ett pass med första
   timmen bjuden där banken tog resten har ingenting att betala. */
do $$
declare
  fore  text := pg_get_functiondef('public.avvikelser_rader'::regproc);
  gammal text := $g$                    * coalesce(p.debiterade_min, p.duration_min, 60) / 60.0))
  union all$g$;
  ny    text := $n$                    * (coalesce(p.debiterade_min, p.duration_min, 60) - coalesce(p.timbank_min, 0)) / 60.0))
  union all$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'avvikelser_rader: prisvillkoret i ej_betalt hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- bokslutet ----------
/* Månadens pass betalda med timbanken och övertiden den tog, bredvid
   klippkortets. Minuterna i banken är betalda timmar som inte hållits:
   för bokföringen en skuld till familjen, inte en intäkt. */
do $$
declare
  fore   text := pg_get_functiondef('public.manad_lage'::regproc);
  gammal text := $g$    'faktura', ($g$;
  ny     text := $n$    'timbank', (
      select jsonb_build_object(
        'pass', count(*) filter (where u.sort = 'pass'),
        'pass_min', coalesce(sum(u.minuter) filter (where u.sort = 'pass'), 0),
        'overtid_min', coalesce(sum(u.minuter) filter (where u.sort = 'overtid'), 0))
        from public.timbank_uttag u
        join public.bookings b on b.id = u.booking_id
       where b.wanted_date >= forsta and b.wanted_date < sista and b.status <> 'cancelled'),
    'faktura', ($n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'manad_lage: faktura-nyckeln hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- vakten ----------
do $$
begin
  if position('FAS 22.1' in pg_get_functiondef('public.skydda_bokningsfalt'::regproc)) = 0
     or position('FAS 21.1' in pg_get_functiondef('public.skydda_bokningsfalt'::regproc)) = 0 then
    raise exception 'skydda_bokningsfalt blev inte ändrad, eller tappade Fas 21.1.';
  end if;
  if position('timbank_betalt' in pg_get_functiondef('public.klippkortspass_avbokat'::regproc)) = 0 then
    raise exception 'klippkortspass_avbokat blev inte ändrad.';
  end if;
  if position('timbank_min' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0
     or position('tillagg_obetalt' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0 then
    raise exception 'avvikelser_rader blev inte ändrad, eller tappade Fas 20.1.';
  end if;
  if position('''timbank''' in pg_get_functiondef('public.manad_lage'::regproc)) = 0 then
    raise exception 'manad_lage blev inte ändrad.';
  end if;
  if has_function_privilege('authenticated', 'intern.timbank_overtid()', 'execute')
     or has_function_privilege('authenticated', 'public.timbank_dra(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.timbank_utbetald(uuid)', 'execute') then
    raise exception 'En timbanksfunktion går att anropa av fel roll.';
  end if;
  -- Namnordningen från Fas 21.1 ÄR konstruktionen: nollningen kommer sist.
  if (select max(tgname) from pg_trigger
       where tgrelid = 'public.bookings'::regclass and not tgisinternal
         and tgtype & 2 = 2) <> 'bookings_timmarna_tillbaka' then
    raise exception 'bookings_timmarna_tillbaka är inte längre den sista before-triggern.';
  end if;
end $$;
