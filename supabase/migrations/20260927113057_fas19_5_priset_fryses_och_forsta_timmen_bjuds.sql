-- ============================================================
-- Fas 19.5: priset fryses på passet, och första timmen bjuds
--
-- Leo 2026-09-27 valde båda.
--
-- 1. PRISET FRYSES NÄR PASSET BOKAS.
--    Villkoren lovar priset vid bokningen, men stripe-checkout räknade
--    på tjänstens pris den dag familjen betalade. Höjdes priset mellan
--    bokningen och betalningen tog vi mer än vi lovat. Rabatten var redan
--    fryst (rabatt_ore); nu är timpriset och tillägget för flera barn
--    det också, i timpris_ore och extra_ore.
--
--    Triggern frys_passets_pris sätter dem vid INSERT. Från en vy skrivs
--    allt anroparen skickat över: ett pris är aldrig något familjen
--    väljer. Admin och systemet får sätta ett eget pris, och det som
--    saknas fylls i. Vid UPDATE följer priset med bara när tjänsten byts
--    och priset inte sätts i samma skrivning, och bara Nextrum kan byta
--    tjänst (skydda_bokningsfalt). En vy kan inte ändra kolumnerna alls:
--    skydda_bokningsfalt släpper bara igenom status, tid och skäl på ett
--    befintligt pass.
--
-- 2. FÖRSTA TIMMEN BJUDS (prissidans starterbjudande).
--    "Vi bjuder på första läxhjälpstimmen när ni köper två timmar.
--    Erbjudandet gäller nya familjer och dras av när ni betalar." Den
--    texten har stått på prissidan utan att någon kod drog av något.
--
--    Regeln: det läxhjälpspass som gör att familjen har bokat två timmar
--    får en timme avdragen, till passets eget timpris (med tillägget om
--    flera barn sitter med). En ny familj som bokar två pass på en timme
--    får alltså det andra gratis, och ett första pass på två eller tre
--    timmar får en timme avdragen direkt. Avbokade pass räknas inte, och
--    avbokas passet med rabatten får nästa pass som når två timmar den.
--    En familj som redan har två timmar bokade när regeln kommer är inte
--    ny och får den inte.
--
--    Rabatten ligger i rabatt_ore, som redan fryses vid bokningen och som
--    kortet, fakturan och månadskörningen redan drar av. startrabatt
--    säger varför, så att vyn kan skriva det och så att den bara ges en
--    gång. Triggern heter bookings_startrabatt för att köras EFTER
--    bookings_skydda_rabatt, som nollar rabatt_ore på varje ny rad från
--    en vy som saknar rabattkod. Triggrar på samma händelse körs i
--    namnordning.
--
--    SECURITY DEFINER, för att studiehjälparen som föreslår ett pass inte
--    ser familjens alla pass, och räkningen måste se dem för att bli rätt.
--
-- 3. ETT PASS PÅ NOLL KRONOR ÄR INTE OBETALT.
--    Det andra passet på en timme kostar ingenting. Det markeras INTE som
--    betalt: ett betalt pass går inte att avboka från en vy, och ingen
--    betalning har skett. Det står kvar som 'ingen', och avvikelsen
--    ej_betalt räknar inte ett pass där rabatten täcker hela priset.
--
-- 4. TIMMAR FRÅN ETT KLIPPKORT BETALAR INTE ETT PASS MED STARTRABATT.
--    klippkort_dra drar hela timmar ur passets längd. Ett pass med en
--    bjuden timme hade kostat familjen en timme för mycket ur kortet.
--    Det passet betalas med kort, vilket villkoren redan säger.
--
-- Triggerfunktionerna får ingen EXECUTE (Fas 19.4).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- kolumnerna ----------
alter table public.bookings
  add column timpris_ore bigint check (timpris_ore is null or timpris_ore >= 0),
  add column extra_ore   bigint check (extra_ore is null or extra_ore >= 0),
  add column startrabatt boolean not null default false;

comment on column public.bookings.timpris_ore is
  'Fas 19.5: tjänstens timpris i ören när passet bokades. Kortet, fakturan och månadskörningen räknar på det, inte på dagens pris.';
comment on column public.bookings.extra_ore is
  'Fas 19.5: tillägget per timme för fler än ett barn, fryst som timpris_ore.';
comment on column public.bookings.startrabatt is
  'Fas 19.5: passet fick prissidans starterbjudande, en timme avdragen i rabatt_ore.';

-- ---------- priset fryses ----------
create or replace function public.frys_passets_pris()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.tjanster%rowtype;
  reserv bigint;
  fran_vy boolean := auth.uid() is not null and not public.is_admin();
begin
  if tg_op = 'UPDATE' then
    if new.tjanst is not distinct from old.tjanst
       or new.timpris_ore is distinct from old.timpris_ore then
      return new;
    end if;
    new.timpris_ore := null;
    new.extra_ore := null;
  elsif fran_vy then
    new.timpris_ore := null;
    new.extra_ore := null;
  end if;

  if new.timpris_ore is not null and new.extra_ore is not null then
    return new;
  end if;

  -- Samma reservordning som stripe-checkout och pris.ts: passets tjänst,
  -- annars standardtjänsten, och prissattning om tjänsten saknar pris.
  select * into t from public.tjanster where kod = new.tjanst;
  if not found then
    select * into t from public.tjanster
     order by (aktiv and for_kund) desc, coalesce(ordning, 100), kod
     limit 1;
  end if;
  select p.pris_per_timme_ore into reserv from public.prissattning p limit 1;

  new.timpris_ore := coalesce(new.timpris_ore, nullif(t.pris_per_timme_ore, 0), reserv);
  new.extra_ore := coalesce(new.extra_ore, t.extra_personer_ore, 0);
  return new;
end $$;

create trigger bookings_frys_priset
  before insert or update on public.bookings
  for each row execute function public.frys_passets_pris();

-- ---------- första timmen bjuds ----------
create or replace function public.forsta_timmen_bjuds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fore   bigint;
  timme  bigint;
  brutto bigint;
begin
  if new.startrabatt or new.parent_id is null or not new.fakturerbar
     or new.status = 'cancelled' or new.tjanst is distinct from 'laxhjalp' then
    return new;
  end if;

  -- Två förslag samtidigt från samma familj ska inte båda få timmen.
  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  if exists (select 1 from public.bookings x
              where x.parent_id = new.parent_id and x.startrabatt and x.status <> 'cancelled') then
    return new;
  end if;

  select coalesce(sum(coalesce(x.duration_min, 60)), 0) into fore
    from public.bookings x
   where x.parent_id = new.parent_id and x.status <> 'cancelled'
     and x.fakturerbar and x.tjanst = 'laxhjalp';

  if fore >= 120 or fore + coalesce(new.duration_min, 60) < 120 then
    return new;
  end if;

  timme := coalesce(new.timpris_ore, 0)
         + case when coalesce(new.antal_barn, 1) > 1 then coalesce(new.extra_ore, 0) else 0 end;
  if timme <= 0 then
    return new;
  end if;
  brutto := round(timme * coalesce(new.duration_min, 60) / 60.0);

  new.startrabatt := true;
  new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
  return new;
end $$;

create trigger bookings_startrabatt
  before insert on public.bookings
  for each row execute function public.forsta_timmen_bjuds();

revoke execute on function public.frys_passets_pris()   from public, anon, authenticated;
revoke execute on function public.forsta_timmen_bjuds() from public, anon, authenticated;

-- ---------- befintliga pass får dagens pris ----------
-- Två pass i driften, båda läxhjälp. Priset har inte ändrats sedan de
-- bokades (prissattning 2026-09-15), så dagens pris ÄR bokningens.
update public.bookings b
   set timpris_ore = coalesce(nullif(t.pris_per_timme_ore, 0), (select pris_per_timme_ore from public.prissattning limit 1)),
       extra_ore = coalesce(t.extra_personer_ore, 0)
  from public.tjanster t
 where t.kod = coalesce(b.tjanst, 'laxhjalp') and b.timpris_ore is null;

-- ---------- rabattkoden räknar på det frysta priset ----------
create or replace function public.skydda_rabatt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  facit bigint;
  brutto bigint;
  t_rad public.tjanster%rowtype;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.rabattkod := old.rabattkod;
    new.rabatt_ore := old.rabatt_ore;
    return new;
  end if;

  if new.rabattkod is null then
    new.rabatt_ore := null;
    return new;
  end if;

  -- Fas 19.5: bookings_frys_priset har redan satt passets pris.
  select * into t_rad from public.tjanster where kod = new.tjanst;
  brutto := round(
      (coalesce(new.timpris_ore, t_rad.pris_per_timme_ore, 0)
        + case when coalesce(new.antal_barn, 1) > 1
               then coalesce(new.extra_ore, t_rad.extra_personer_ore, 0) else 0 end)
      * coalesce(new.duration_min, 60) / 60.0);

  select k.rabatt_ore into facit
  from public.kolla_rabattkod(new.rabattkod, new.tjanst, brutto) k
  where k.giltig;

  if facit is null then
    new.rabattkod := null;
    new.rabatt_ore := null;
  else
    new.rabatt_ore := least(coalesce(new.rabatt_ore, facit), facit);
  end if;

  return new;
end $$;

-- ---------- passunderlag bär priset ----------
create or replace view public.passunderlag with (security_invoker = true) as
 SELECT id,
    parent_id,
    tutor_id,
    student_id,
    subject,
    tjanst,
    wanted_date,
    wanted_time,
    duration_min,
    antal_barn,
    rabatt_ore,
    fakturerbar,
    fakturerbar_anledning,
    (EXISTS ( SELECT 1
           FROM lesson_reports r
          WHERE r.booking_id = b.id)) AS har_rapport,
    (EXISTS ( SELECT 1
           FROM invoice_lines l
          WHERE l.booking_id = b.id)) AS fakturerad,
    (EXISTS ( SELECT 1
           FROM payout_lines l
          WHERE l.booking_id = b.id)) AS pa_underlag,
    betalning_status,
    timpris_ore,
    extra_ore,
    startrabatt
   FROM bookings b
  WHERE status = 'completed'::text;

-- ---------- ett pass på noll kronor är inte obetalt ----------
-- Ändringen görs i den befintliga texten och prövas: blir ingenting
-- ersatt rullas migrationen tillbaka, i stället för att larmet tyst
-- fortsätter som förut.
do $$
declare
  fore text := pg_get_functiondef('public.avvikelser_rader'::regproc);
  gammal text := $g$     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
  union all$g$;
  ny text := $n$     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
     -- Fas 19.5: ett pass där rabatten täcker hela priset (första timmen
     -- bjuds) har ingenting att betala.
     and not (p.timpris_ore is not null
              and coalesce(p.rabatt_ore, 0) >= round((p.timpris_ore
                    + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                    * coalesce(p.duration_min, 60) / 60.0))
  union all$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'avvikelser_rader: ej_betalt-villkoret hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- klippkortet betalar inte ett pass med startrabatt ----------
do $$
declare
  fore text := pg_get_functiondef('public.klippkort_dra'::regproc);
  gammal text := $g$  behov := greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0))::int;$g$;
  ny text := $n$  /* Fas 19.5. Timmarna dras ur passets hela längd, och ett pass med
     första timmen bjuden hade kostat en timme för mycket ur kortet. */
  if b.startrabatt then
    return jsonb_build_object('fel', 'Första timmen är på köpet på det här passet, så det betalas med kort.');
  end if;

  behov := greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0))::int;$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'klippkort_dra: raden med behov hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- vakten ----------
do $$
begin
  if exists (select 1 from public.bookings where timpris_ore is null) then
    raise exception 'Ett pass fick inget fryst pris.';
  end if;
  if position('Fas 19.5' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0
     or position('startrabatt' in pg_get_functiondef('public.klippkort_dra'::regproc)) = 0 then
    raise exception 'avvikelser_rader eller klippkort_dra blev inte ändrad.';
  end if;
  if has_function_privilege('authenticated', 'public.frys_passets_pris()', 'execute')
     or has_function_privilege('authenticated', 'public.forsta_timmen_bjuds()', 'execute') then
    raise exception 'En ny triggerfunktion går att anropa.';
  end if;
end $$;
