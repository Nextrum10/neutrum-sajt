-- ============================================================
-- Fas 22.2: timmarna betalar passen av sig själva
--
-- Leo 2026-09-27: "köper man klippkorten eller timmarna i förväg innan
-- bokade lektioner, då kostar ej nästkommande lektioner som man har
-- timmar för." Förut betalade familjen varje pass med ett tryck på
-- Betala med timmar. Ett pass de inte tryckt på stod som obetalt, och
-- larmade som obetalt när det hållits, med timmarna oanvända bredvid.
--
-- 1. NÄR ETT PASS BEKRÄFTAS ELLER GENOMFÖRS betalar timmarna det i samma
--    skrivning: klippkortet som går ut först och räcker, som
--    klippkort_dra väljer, och annars timbanken när minuterna räcker
--    till det bokade. Klippkortet först, för dess timmar går ut och
--    bankens minuter gör det inte. Samma pass som knappen betalade: ett
--    barn, inte passet med första timmen bjuden, inte ett undantaget
--    pass. Räcker inget betalas passet med kort, som förut, och knappen
--    står kvar för ett pass timmarna inte hann betala.
--
--    Triggern kör efter skydda_bokningsfalt och skydda_klippkortet
--    (namnordning), så betalningen den sätter prövas inte som en
--    ändring från vyn: det är databasen som betalar, inte den som
--    bekräftar. Den kör före bookings_timmarna_tillbaka, som ska stå
--    sist.
--
-- 2. NÄR ETT KÖP BLIR BETALT betalar de nya timmarna familjens bekräftade
--    och obetalda pass från och med i dag, i datumordning, så långt de
--    räcker. Ett pass som inte ryms hoppas över, och ett senare och
--    kortare får timmarna. Bara det nya kortet: att låsa familjens andra
--    kort här, med köpet redan låst, hade kunnat låsa fast mot en
--    bekräftelse som låser i andra ordningen. Blir något fel betalas
--    inga pass, köpet skrivs ändå, och admin får en uppgift: ett köp som
--    inte blev skrivet är pengar familjen inte kan använda.
--
-- 3. KASSAN STÄNGS INTE HÄRIFRÅN. Ett pass med en påbörjad kortbetalning
--    ('vantar') betalas också, för en kassa som aldrig slutförts står
--    kvar som 'vantar' för alltid. Betalar familjen ändå den gamla kassan
--    vinner kortet, och timmarna går tillbaka (stripe-webhook, Fas 16.1).
--
-- 4. Flaggan erbjudanden avgör, som för knappen. Står den av betalar
--    timmarna ingenting av sig själva.
--
-- 5. klippkort_rorelser säger vilka pass varje kort betalat, med samma
--    timmar som klippkort_saldo räknar, för Profil → Timbanken.
--
-- 6. Mejlet om ett bekräftat pass och påminnelsen säger att passet är
--    betalt med timmarna (betalsatt = 'timmar'), i stället för att be
--    familjen gå till betalningen.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. passet som bekräftas eller genomförs ----------
/* Timmarna räknas med samma uttryck som klippkort_saldo och
   klippkort_dra: en per påbörjad timme av det som hölls, upp till det
   bokade. Ett pass som bekräftas har ingen rapport, och då är det det
   bokade.

   Alla familjens kort låses först och timmarna räknas i en egen sats
   efteråt, av samma skäl som i klippkort_dra: två pass som bekräftas
   samtidigt ska inte båda dra på samma sista timme. Banken låses med
   samma lås som timbank_dra. */
create or replace function intern.timmar_betalar_passet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  behov int;
  kort  uuid;
  saldo int;
begin
  if new.klippkort_id is not null
     or new.betalning_status not in ('ingen', 'vantar', 'misslyckad')
     or new.parent_id is null
     or not new.fakturerbar
     or coalesce(new.antal_barn, 1) > 1
     or new.startrabatt
     or not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false)
     or intern.timbank_betalt(new.id) then
    return new;
  end if;

  behov := greatest(1, ceil(least(coalesce(new.duration_min, 60),
                                  coalesce(intern.debiterade_min(new.id), new.duration_min, 60)) / 60.0))::int;

  perform 1 from public.klippkort where parent_id = new.parent_id and status = 'betald' for update;

  select k.id into kort
    from public.klippkort k
   where k.parent_id = new.parent_id
     and k.status = 'betald'
     and k.giltigt_till >= new.wanted_date
     and k.giltigt_till >= idag
     and k.timmar - coalesce((
           select sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                                             coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int
             from public.bookings x
            where x.klippkort_id = k.id and x.status <> 'cancelled' and x.id <> new.id), 0) >= behov
   order by k.giltigt_till, k.created_at
   limit 1;

  if found then
    new.klippkort_id := kort;
    new.betalning_status := 'betald';
    new.betald_at := now();
    return new;
  end if;

  /* Timbanken betalar det bokade, som timbank_dra. Blev passet kortare
     går resten tillbaka in (intern.timbank_in), och drog det över tar
     banken övertiden när rapporten skrivs. */
  perform pg_advisory_xact_lock(hashtextextended('timbank:' || new.parent_id::text, 0));
  saldo := coalesce(intern.timbank_saldo(new.parent_id), 0);
  if saldo >= coalesce(new.duration_min, 60) then
    insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
    values (new.parent_id, new.id, 'pass', coalesce(new.duration_min, 60))
    on conflict (booking_id, sort) where booking_id is not null
    do update set minuter = excluded.minuter, created_at = now();
    new.betalning_status := 'betald';
    new.betald_at := now();
  end if;
  return new;
end $$;

revoke execute on function intern.timmar_betalar_passet() from public, anon, authenticated;

drop trigger if exists bookings_timmar_betalar on public.bookings;
create trigger bookings_timmar_betalar
  before update of status on public.bookings
  for each row
  when (new.status in ('confirmed', 'completed') and new.status is distinct from old.status)
  execute function intern.timmar_betalar_passet();

-- ---------- 2. köpet som blir betalt ----------
create or replace function intern.timmar_betalar_kommande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  p     record;
  behov int;
  kvar  int;
begin
  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false) then
    return null;
  end if;

  begin
    for p in
      select b.id, b.duration_min
        from public.bookings b
       where b.parent_id = new.parent_id
         and b.status = 'confirmed'
         and b.klippkort_id is null
         and b.betalning_status in ('ingen', 'vantar', 'misslyckad')
         and b.fakturerbar
         and coalesce(b.antal_barn, 1) <= 1
         and not b.startrabatt
         and b.wanted_date >= idag
         and b.wanted_date <= new.giltigt_till
         and not intern.timbank_betalt(b.id)
       order by b.wanted_date, b.wanted_time nulls last, b.created_at, b.id
    loop
      kvar := new.timmar - coalesce((
        select sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                                          coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int
          from public.bookings x
         where x.klippkort_id = new.id and x.status <> 'cancelled'), 0);
      exit when kvar <= 0;
      behov := greatest(1, ceil(coalesce(p.duration_min, 60) / 60.0))::int;
      continue when behov > kvar;

      update public.bookings
         set klippkort_id = new.id,
             betalning_status = 'betald',
             betald_at = now()
       where id = p.id
         and status = 'confirmed'
         and klippkort_id is null
         and betalning_status in ('ingen', 'vantar', 'misslyckad');
    end loop;
  exception when others then
    perform public.skapa_uppgift(
      'Köpta timmar betalade inte familjens bokade pass',
      'timmar_betalar:' || new.id,
      'kontroll',
      'Köpet är betalt och timmarna finns på kortet, men de betalade inte familjens bekräftade pass: '
        || left(sqlerrm, 300) || ' Passen går att betala med Betala med timmar i föräldravyn.',
      'profiles', new.parent_id::text);
  end;
  return null;
end $$;

revoke execute on function intern.timmar_betalar_kommande() from public, anon, authenticated;

drop trigger if exists klippkort_betalar_passen on public.klippkort;
create trigger klippkort_betalar_passen
  after update of status on public.klippkort
  for each row
  when (new.status = 'betald' and old.status is distinct from 'betald')
  execute function intern.timmar_betalar_kommande();

-- ---------- 5. vilka pass korten betalat ----------
/* Samma timmar som klippkort_saldo räknar som använda, pass för pass.
   Summan per kort är kortets anvanda; rls-test.sql prövar det. */
create or replace view public.klippkort_rorelser with (security_invoker = true) as
select k.parent_id,
       k.id as klippkort_id,
       b.id as booking_id,
       greatest(1, ceil(least(coalesce(b.duration_min, 60),
                              coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) / 60.0))::int as timmar,
       b.wanted_date as datum,
       b.status
  from public.klippkort k
  join public.bookings b on b.klippkort_id = k.id
 where b.status <> 'cancelled';

revoke all on public.klippkort_rorelser from anon;
grant select on public.klippkort_rorelser to authenticated;

-- ---------- 6. mejlen ----------
/* En kod, aldrig text, som 'faktura' (Fas 14.6): renData() släpper bara
   igenom de kända koderna, och mallen skriver orden. 'timmar' när
   passet är betalt med ett klippkort eller timbanken och inga kortpengar
   ligger på det. */
create or replace function intern.betalsatt_kod(p_pass uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when b.betalning_status = 'faktura' then 'faktura'
           when b.betalning_status = 'betald'
                and b.stripe_payment_intent_id is null
                and coalesce(b.betalt_ore, 0) = 0
                and (b.klippkort_id is not null or intern.timbank_betalt(b.id)) then 'timmar'
         end
    from public.bookings b
   where b.id = p_pass
$$;

revoke all on function intern.betalsatt_kod(uuid) from public, anon, authenticated;

do $$
declare
  fore   text := pg_get_functiondef('public.notis_vid_pass'::regproc);
  gammal text := $g$'betalsatt', case when new.betalning_status = 'faktura' then 'faktura' end));$g$;
  ny     text := $n$'betalsatt', intern.betalsatt_kod(new.id)));  -- Fas 22.2: också 'timmar'$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'notis_vid_pass: betalsättet från Fas 14.6 hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

do $$
declare
  fore   text := pg_get_functiondef('public.notis_planera'::regproc);
  gammal text := $g$'betalsatt', case when b.betalning_status = 'faktura' then 'faktura' end));$g$;
  ny     text := $n$'betalsatt', intern.betalsatt_kod(b.id)));  -- Fas 22.2: också 'timmar'$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'notis_planera: betalsättet från Fas 14.6 hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;
