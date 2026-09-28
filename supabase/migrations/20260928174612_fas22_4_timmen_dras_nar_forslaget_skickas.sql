-- ============================================================
-- Fas 22.4: timmen dras när familjen föreslår passet
--
-- Leo 2026-09-28: "när man skickar ett förslag försvinner en av de
-- förköpta timmarna man köpt, om studiehjälparen inte kan den tiden och
-- föreslår om är det den timmen som fortfarande betalar av passet."
--
-- Förut drogs timmarna när studiehjälparen bekräftade passet (Fas
-- 22.2), och ett förslag ägde ingen timme. Boka pass räknade bort
-- förslagen i förväg (lovadeTimmar), men databasen gav timmen till det
-- pass som bekräftades först. Fick familjens förslag ett motförslag och
-- hann ett senare förslag bekräftas medan familjen funderade, tog det
-- senare timmen, och passet med motförslaget fick betalas med kort.
-- Rutan Era timmar och Profil → Timbanken visade dessutom timmen som
-- kvar, medan Boka pass redan hade räknat bort den.
--
-- 1. FÖRSLAGET BETALAS NÄR DET SKAPAS. bookings_timmar_betalar_forslaget
--    kör samma val som bekräftelsen (intern.timmar_betala) när ett pass
--    skapas som förfrågan: klippkortet som går ut först och räcker,
--    annars timbanken när minuterna räcker till det bokade. Samma pass
--    som förut: ett barn, inte passet med första timmen bjuden, bara med
--    flaggan erbjudanden på. Namnet gör att triggern kör efter
--    skydda_bokningsfalt, skydda_klippkortet och bookings_startrabatt:
--    betalningen prövas inte som något familjen själv skrivit, och första
--    timmen är redan avgjord när timmarna väljer.
--
-- 2. TIMMEN FÖLJER PASSET. Ett motförslag flyttar tiden och gör passet
--    till förfrågan igen, men skydda_bokningsfalt släpper aldrig igenom
--    en ändrad betalning från en vy, så timmen ligger kvar. Bekräftelsen
--    hoppar över ett betalt pass, som förut, och drar ingenting till.
--
-- 3. ETT NEJ GER TILLBAKA TIMMEN. Avböjs förslaget, eller dras det
--    tillbaka, är passet avbokat, och klippkortspass_avbokat,
--    klippkort_saldo och timbank_saldo gör som för ett avbokat bekräftat
--    pass (Fas 21.1, 22.1). Inget nytt behövs för det.
--
-- 4. ETT FÖRSLAG SOM INGEN SVARAT PÅ LÄMNAR TILLBAKA TIMMEN när dagen
--    har gått (intern.obesvarade_forslag_slapper_timmarna, först i jobbet
--    timmar-betalar). Utan det hade timmen legat kvar på ett förslag som
--    aldrig blev ett pass, och en plans timmar går ut efter en månad.
--    Hölls passet ändå och studiehjälparen skriver rapporten, betalar
--    timmarna det igen när det blir genomfört (Fas 22.2).
--
-- 5. ETT PASS SOM BLIR FÖRFRÅGAN IGEN (en flyttad tid) prövas som ett nytt
--    förslag: bookings_timmar_betalar går också på status 'requested'.
--    Ett obetalt bekräftat pass som flyttas betalas då, och ett betalt
--    står kvar som det var.
--
-- 6. JOBBET OCH KÖPET BETALAR OCKSÅ FÖRSLAG. Timmar som blir lediga, och
--    ett köp som blir betalt, betalar familjens förslag och bekräftade
--    pass från och med i dag, i datumordning (Fas 22.2, 22.3). Förut bara
--    de bekräftade.
--
-- 7. timbank_uttag_booking_id_fkey prövas vid commit. Timbanken skriver
--    sitt uttag i samma BEFORE INSERT som skapar passet, och då finns
--    passets rad inte än. Bara databasens egna funktioner skriver i
--    tabellen, och alla pekar på ett pass som finns eller håller på att
--    skapas. ON DELETE CASCADE sker som förut direkt: bara själva
--    kontrollen väntar.
--
-- Funktionerna som skrivs om prövas först mot det som lästes i driften
-- (md5 på pg_get_functiondef). Har någon annan ändrat dem sedan dess
-- avbryts migrationen, i stället för att deras ändring skrivs över.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('intern.timmar_betala(public.bookings,boolean)', 'ba9100a99219a3bd52caa3b80d2883b8'),
      ('intern.timmar_betalar_passet()',                'e8ed694fb641b7657159d8172aaa8e7b'),
      ('intern.timmar_betalar_obetalda(uuid)',          '46991ff95ac3c9002a00506805458efa'),
      ('intern.timmar_betalar_kommande()',              'd336b826c5bda6f25e0a4b54ca261d71')) v(namn, summa)
  loop
    if md5(pg_get_functiondef(f.namn::regprocedure)) <> f.summa then
      raise exception '% har ändrats sedan Fas 22.4 skrevs. Läs driften och skriv om migrationen.', f.namn;
    end if;
  end loop;
end $$;

-- ---------- 7. uttaget väntar in passet ----------
alter table public.timbank_uttag
  alter constraint timbank_uttag_booking_id_fkey deferrable initially deferred;

-- ---------- 1. förslaget ----------
drop trigger if exists bookings_timmar_betalar_forslaget on public.bookings;
create trigger bookings_timmar_betalar_forslaget
  before insert on public.bookings
  for each row
  when (new.status = 'requested')
  execute function intern.timmar_betalar_passet();

-- ---------- 5. bekräftelsen, och en flyttad tid ----------
drop trigger if exists bookings_timmar_betalar on public.bookings;
create trigger bookings_timmar_betalar
  before update of status on public.bookings
  for each row
  when (new.status in ('requested', 'confirmed', 'completed') and new.status is distinct from old.status)
  execute function intern.timmar_betalar_passet();

-- ---------- 4. förslag som ingen svarat på ----------
/* Ett förslag, eller ett motförslag, som fortfarande är en förfrågan när
   dagen det gällde har gått. Timmarna går tillbaka och passet står
   obetalt, precis som om det aldrig betalats: klippkortet släpps och
   timbankens uttag tas bort. Kortpengar rörs aldrig.

   Väntar aldrig på ett lås, av samma skäl som jobbet (Fas 22.3): ett
   pass någon skriver i just nu, eller en timbank som skrivs i, får vänta
   till nästa körning. */
create or replace function intern.obesvarade_forslag_slapper_timmarna(p_foralder uuid default null)
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
  for pass_id in
    select b.id
      from public.bookings b
     where (p_foralder is null or b.parent_id = p_foralder)
       and b.status = 'requested'
       and b.wanted_date < idag
       and b.betalning_status = 'betald'
       and coalesce(b.betalt_ore, 0) = 0
       and b.stripe_payment_intent_id is null
       and (b.klippkort_id is not null or intern.timbank_betalt(b.id))
     order by b.wanted_date, b.id
  loop
    begin
      select * into rad
        from public.bookings
       where id = pass_id
         and status = 'requested'
         and betalning_status = 'betald'
         and coalesce(betalt_ore, 0) = 0
         and stripe_payment_intent_id is null
         for update skip locked;
      if found then
        if rad.klippkort_id is null then
          if not pg_try_advisory_xact_lock(hashtextextended('timbank:' || rad.parent_id::text, 0)) then
            continue;
          end if;
          delete from public.timbank_uttag where booking_id = pass_id and sort = 'pass';
        end if;
        update public.bookings
           set klippkort_id = null,
               betalning_status = 'ingen',
               betald_at = null
         where id = pass_id;
        n := n + 1;
      end if;
    exception when others then
      perform public.skapa_uppgift(
        'Ett förslag som ingen svarat på gav inte tillbaka timmarna',
        'forslag_slapper:' || pass_id,
        'kontroll',
        'Förslagets dag har gått utan svar, men timmarna det betalades med kom inte tillbaka: '
          || left(sqlerrm, 300) || ' Jobbet prövar igen om fem minuter.',
        'bookings', pass_id::text);
    end;
  end loop;
  return n;
end $$;

revoke execute on function intern.obesvarade_forslag_slapper_timmarna(uuid) from public, anon, authenticated;

comment on function intern.obesvarade_forslag_slapper_timmarna(uuid) is
  'Fas 22.4: ett förslag som fortfarande är en förfrågan när dagen gått lämnar tillbaka timmarna det betalades med. Körs först i timmar_betalar_obetalda.';

-- ---------- 6. jobbet ----------
/* Samma jobb som Fas 22.3, med två ändringar: förslag som ingen svarat
   på lämnar först tillbaka sina timmar, och förslag betalas som
   bekräftade pass. Timmarna släpps oavsett flaggan, för de är inte
   använda. */
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
     passet avgör valet. */
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
       and not b.startrabatt
       and b.wanted_date >= idag
       and not intern.timbank_betalt(b.id)
       and (exists (select 1 from public.klippkort_saldo k
                     where k.parent_id = b.parent_id and k.brukbar and k.giltigt_till >= b.wanted_date)
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

comment on function intern.timmar_betalar_obetalda(uuid) is
  'Fas 22.3, 22.4: förslag som ingen svarat på när dagen gått lämnar tillbaka sina timmar, och timmar som blivit lediga (en avbokning, kortet som vann, timbanken som fyllts på, flaggan som slogs på) betalar förslagen och de bekräftade passen från och med i dag, i datumordning. pg_cron timmar-betalar var femte minut. Väntar aldrig på ett lås.';

-- ---------- 6. köpet ----------
/* Samma som Fas 22.2, men förslagen är med: ett förslag som skickades
   när timmarna var slut får dem när familjen köper nya. */
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
         and b.status in ('requested', 'confirmed')
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
         and status in ('requested', 'confirmed')
         and klippkort_id is null
         and betalning_status in ('ingen', 'vantar', 'misslyckad');
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
