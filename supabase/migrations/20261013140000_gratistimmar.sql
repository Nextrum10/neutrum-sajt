-- ============================================================
-- Gratistimmar: timmar vi sätter in i familjens timbank (2026-10-13, Leo)
--
-- Leo: "när vi tar in en familj ska vi kunna fylla deras timbank med
-- önskade timmar som vi klickar in, inte de. vi kan även sätta in gratis
-- timmar som vi själva väljer när familjen redan är inne i system". På
-- frågan samma dag: timmarna är gratis också när familjen tas in, de
-- gäller i "60 dagar men de används först av alla timmar om man har
-- flera timmar", och det som blir över av en gratistimme sparas inte i
-- timbanken.
--
-- Det river en del av beskedet 2026-10-09 ("MAXIMALT en timme gratis ...
-- de kan spara genom timbanken men inte få gratis av oss"). Första
-- timmen står kvar som den är, högst en per familj
-- (intern.forsta_timmen_tagen), och gratistimmarna räknas inte dit, som
-- tipstimmen.
--
--
-- EN GÅVA ÄR EN RAD I KLIPPKORT
--
-- Med erbjudandet 'gratis', en rad i katalogen som aldrig säljs (aktiv
-- är falsk, och ett villkor håller den så). Då gäller allt som redan
-- finns för köpta timmar utan att något av det skrivs om: saldot
-- (klippkort_saldo), att timmarna betalar förslag och bokade pass av sig
-- själva (Fas 22.2–22.4), Er timbank och Profil → Timbanken i studievyn
-- och adminvyns Köpta timmar. Det som skiljer:
--
--   · Ingen betalning. betalt_ore är 0 och betald_at null: inget kom in,
--     och listorna över pengar (Betalningar, Översikt, Månadens ekonomi)
--     tar köp efter betald_at. vid_uppsagning_ore och vid_anger_ore blir
--     0, så inget betalas tillbaka. begart_ore får inte vara noll
--     (klippkort_begart_ore_check går inte att ändra utan en drop) och
--     bär timmarnas värde till ordinarie timpris: vad gåvan är värd, inte
--     något någon begärt.
--   · 60 dagar från dagen de sattes in, i giltigt_till. giltig_manader är
--     2, närmaste hela månad, och läses inte för en gåva.
--   · Först av alla timmar. gratistimmarna_60_dagar (samma dag, körs
--     före den här) låter planens gratis timme dras först; klippkort_dra
--     och intern.timmar_betala räknar nu också ett kort med gratistimmar
--     som gratis, och annars väljs det som går ut först, som där. Ett kort
--     väljs bara om det räcker till hela passet, som förut.
--   · Inga sparade minuter. intern.timbank_in ger noll för ett pass betalt
--     med gratistimmar: sparade minuter betalas tillbaka i kronor när
--     familjen slutar, och en gåva hade då blivit pengar.
--   · Ingen påminnelse. Mejlet tio dagar före sista dagen säger "köpta
--     timmar" och lovar att resten betalas tillbaka, så gratistimmarna
--     står utanför (intern.timmar_gar_ut_koa). Sista dagen står i vyn.
--   · Inga villkor först. En gåva är inget köp, så klippkort_kraver_villkor
--     släpper den, och den går att sätta in när familjen tas in, innan de
--     loggat in. Timmarna betalar inget förrän familjen godkänt villkoren
--     och föreslagit ett pass (bookings_kraver_villkor).
--
-- Lönen rörs inte: studiehjälparen får betalt för den tid som hölls
-- (passunderlag.lon_min), hur familjen än betalade. Gratistimmarna betalar
-- pass bara med strömbrytaren erbjudanden på, som köpta timmar.
--
-- Bara admin sätter in och tar tillbaka (ge_gratistimmar,
-- ta_tillbaka_gratistimmar), med is_admin() på första raden. Ingen
-- inloggad skriver i klippkort (ingen skrivpolicy), och kassan säljer bara
-- det som står i erbjudanden_pris, där 'gratis' aldrig står.
--
--
-- VILLKOREN
--
-- Villkoren säger det i Planer och timbanken (anvandarvillkor.html, båda
-- språken, #gratistimmar): timbanken rymmer också timmar vi gett, de dras
-- först, gäller i 60 dagar, sparar inga minuter och betalas aldrig ut.
-- Versionen 2026-10-13 sätts av gratistimmarna_60_dagar, som ändrade
-- samma sida samma dag. Har den körts, och någon hunnit godkänna
-- 2026-10-13, INNAN texten om gratistimmarna kom ut på sidan, har de inte
-- sett den: byt då datumet på båda sidorna och skriv villkor_version här
-- (kolla-villkor.py), så att alla får frågan igen.
--
-- klippkort_dra, intern.timmar_betala och intern.timmar_gar_ut_koa LAPPAS
-- med replace() på pg_get_functiondef(), med en vakt som räknar
-- träffarna, så som gratistimmarna_60_dagar lämnar dem (md5 nedan, läst ur
-- en databas byggd ur alla migrationer till och med den, för driften har
-- den inte än). intern.timbank_in och intern.kop_kraver_villkor skrivs om,
-- men bara om kroppen är den som lästes i driften 2026-10-13. Markörerna
-- är satserna själva: ordet gratis står redan i funktionerna. Ingen drop
-- och ingen delete utanför en funktion. Går att köra två gånger. Körs
-- efter merge, efter gratistimmarna_60_dagar: vyerna tål att den saknas
-- (utan katalograden finns inga gratistimmar, och knappen säger att
-- funktionen saknas).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Vakten
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  -- Som gratistimmarna_60_dagar lämnar dem.
  select prosrc into f from pg_proc where oid = 'public.klippkort_dra(uuid,uuid)'::regprocedure;
  if md5(f) is distinct from '2b1354f0420648fa386ebaaed6560a43'
     and position($m$k.erbjudande = 'gratis'$m$ in f) = 0 then
    raise exception 'klippkort_dra är inte den som gratistimmarna_60_dagar lämnar (md5 %). Läs databasen och skriv om migrationen.', md5(f);
  end if;
  select prosrc into f from pg_proc where oid = 'intern.timmar_betala(public.bookings,boolean)'::regprocedure;
  if md5(f) is distinct from 'fc20b497ebbb8c7e86ad44499abc135b'
     and position($m$k.erbjudande = 'gratis'$m$ in f) = 0 then
    raise exception 'intern.timmar_betala är inte den som gratistimmarna_60_dagar lämnar (md5 %). Läs databasen och skriv om migrationen.', md5(f);
  end if;
  select prosrc into f from pg_proc where oid = 'intern.timmar_gar_ut_koa(timestamptz)'::regprocedure;
  if md5(f) is distinct from '453b015bce566ba9c42cb949a79f8176'
     and position($m$s.erbjudande is distinct from 'gratis'$m$ in f) = 0 then
    raise exception 'intern.timmar_gar_ut_koa är inte den som gratistimmarna_60_dagar lämnar (md5 %). Läs databasen och skriv om migrationen.', md5(f);
  end if;
  -- Som de lästes i driften 2026-10-13 (gratistimmarna_60_dagar rör dem inte).
  select prosrc into f from pg_proc where oid = 'intern.timbank_in(public.bookings)'::regprocedure;
  if md5(f) is distinct from 'fa20cf854de8e737af00b828810eed77'
     and position('ar_gratistimmar' in f) = 0 then
    raise exception 'intern.timbank_in är inte den som lästes 2026-10-13 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
  select prosrc into f from pg_proc where oid = 'intern.kop_kraver_villkor()'::regprocedure;
  if md5(f) is distinct from 'b6566f7f45ed0e18afc9bc3e7f7095a3'
     and position($m$new.erbjudande = 'gratis'$m$ in f) = 0 then
    raise exception 'intern.kop_kraver_villkor är inte den som lästes 2026-10-13 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Katalogen: en rad som aldrig säljs
-- ------------------------------------------------------------
insert into public.erbjudanden (kod, sort, namn, timmar, rabatt_procent, giltig_manader, ordning, aktiv)
values ('gratis', 'klippkort', 'Gratistimmar från Nextrum', 1, 0, 2, 900, false)
on conflict (kod) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.erbjudanden'::regclass
                    and conname = 'erbjudanden_gratis_saljs_inte') then
    alter table public.erbjudanden
      add constraint erbjudanden_gratis_saljs_inte check (kod <> 'gratis' or not aktiv);
  end if;
  -- En gåva har ingen betalning, och ingen kassa skriver en.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.klippkort'::regclass
                    and conname = 'klippkort_gratis_utan_betalning') then
    alter table public.klippkort
      add constraint klippkort_gratis_utan_betalning
      check (erbjudande <> 'gratis'
             or (coalesce(betalt_ore, 0) = 0 and betald_at is null
                 and stripe_session_id is null and stripe_charge_id is null));
  end if;
end $$;

comment on table public.klippkort is
  'Fas 16.1. Köpta timmar, planer och Fyll timbanken, och sedan 2026-10-13 gratistimmar (erbjudande ''gratis'', '
  'ge_gratistimmar()). Ingen inloggad skriver: köpen skrivs av stripe-checkout och stripe-webhook med service_role. '
  'Kvar räknas i klippkort_saldo.';

comment on column public.klippkort.begart_ore is
  'Vad kassan begärde för köpet. För gratistimmar timmarnas värde till ordinarie timpris: ingen begärde det, och '
  'inget betalades (betalt_ore 0, betald_at null).';


-- ------------------------------------------------------------
-- 2. Är kortet gratistimmar?
-- ------------------------------------------------------------
/* timbank_in körs som anroparen (vyerna är security_invoker), och en
   studiehjälpare läser inte familjens kort. Svaret ska vara detsamma för
   alla, så frågan ställs här, som ägaren. Den säger bara ja eller nej om
   ett kort-id, som intern.timbank_betalt om ett pass. */
create or replace function intern.ar_gratistimmar(p_klippkort uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.klippkort k
                  where k.id = p_klippkort and k.erbjudande = 'gratis')
$$;

revoke all on function intern.ar_gratistimmar(uuid) from public, anon;
grant execute on function intern.ar_gratistimmar(uuid) to authenticated, service_role;

comment on function intern.ar_gratistimmar(uuid) is
  '2026-10-13. Om ett kort är gratistimmar. Bara ja eller nej om ett id; läses av intern.timbank_in.';


-- ------------------------------------------------------------
-- 3. Inga sparade minuter ur gratistimmar
-- ------------------------------------------------------------
create or replace function intern.timbank_in(b public.bookings)
returns integer
language sql
stable
set search_path = public
as $$
  select case
           when b.status is distinct from 'completed'
             or b.betalning_status not in ('betald', 'tvist') then 0
           -- Gratistimmar (2026-10-13) sparar inget: sparade minuter
           -- betalas tillbaka i kronor när familjen slutar, och en gåva
           -- hade då blivit pengar.
           when b.klippkort_id is not null and intern.ar_gratistimmar(b.klippkort_id) then 0
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


-- ------------------------------------------------------------
-- 4. En gåva är inget köp: inga villkor först
-- ------------------------------------------------------------
create or replace function intern.kop_kraver_villkor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Gratistimmar (2026-10-13) är inget köp. Admin sätter in dem, också
  -- när familjen tas in och inte har loggat in än.
  if new.erbjudande = 'gratis' then
    return new;
  end if;
  if not intern.villkoren_godkanda(new.parent_id) then
    raise exception 'Godkänn användarvillkoren först. Ladda om sidan, så kommer frågan.'
      using errcode = 'P0001', hint = 'villkor';
  end if;
  return new;
end $$;

revoke all on function intern.kop_kraver_villkor() from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. Gratistimmarna först, och ingen påminnelse om dem
-- ------------------------------------------------------------
do $$
declare
  f     text;
  ordn1 text := $g$   order by coalesce(k.timmar_pa_kopet > a.anv and intern.gratis_till(k.betald_at) >= dag, false) desc,
$g$;
  ordn2 text := $n$   /* gratistimmar (2026-10-13): gratistimmar som admin satt in är gratis
      rakt igenom och går först, med planens gratis timmar (Leo: "de
      används först av alla timmar"). */
   order by (k.erbjudande = 'gratis'
             or coalesce(k.timmar_pa_kopet > a.anv and intern.gratis_till(k.betald_at) >= dag, false)) desc,
$n$;
  pam1  text := $g$     where s.status = 'betald'
$g$;
  pam2  text := $n$     where s.status = 'betald'
       -- gratistimmar (2026-10-13): mejlet gäller köpta timmar och lovar
       -- att resten betalas tillbaka. Sista dagen står i vyn.
       and s.erbjudande is distinct from 'gratis'
$n$;
begin
  f := pg_get_functiondef('public.klippkort_dra(uuid,uuid)'::regprocedure);
  if position($m$k.erbjudande = 'gratis'$m$ in f) = 0 then
    if (length(f) - length(replace(f, ordn1, ''))) / length(ordn1) <> 1 then
      raise exception 'klippkort_dra: ordningen hittades inte exakt en gång.';
    end if;
    execute replace(f, ordn1, ordn2);
  end if;

  f := pg_get_functiondef('intern.timmar_betala(public.bookings,boolean)'::regprocedure);
  if position($m$k.erbjudande = 'gratis'$m$ in f) = 0 then
    if (length(f) - length(replace(f, ordn1, ''))) / length(ordn1) <> 1 then
      raise exception 'intern.timmar_betala: ordningen hittades inte exakt en gång.';
    end if;
    execute replace(f, ordn1, ordn2);
  end if;

  f := pg_get_functiondef('intern.timmar_gar_ut_koa(timestamptz)'::regprocedure);
  if position($m$s.erbjudande is distinct from 'gratis'$m$ in f) = 0 then
    if (length(f) - length(replace(f, pam1, ''))) / length(pam1) <> 1 then
      raise exception 'intern.timmar_gar_ut_koa: raden med status hittades inte exakt en gång.';
    end if;
    execute replace(f, pam1, pam2);
  end if;
end $$;


-- ------------------------------------------------------------
-- 6. Admin sätter in gratistimmar
-- ------------------------------------------------------------
/* Ett kort med erbjudandet 'gratis', betalt utan pengar, som gäller i 60
   dagar. Sedan betalar timmarna familjens obetalda förslag och bokade pass
   direkt, med samma val som jobbet timmar-betalar gör var femte minut
   (gratistimmarna först). Går det inte står timmarna kvar, och jobbet
   prövar igen. Högst 40 timmar åt gången: rutan frågar en gång till, och
   taket fångar en nolla för mycket. */
create or replace function public.ge_gratistimmar(p_familj uuid, p_timmar integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  idag    date := (now() at time zone 'Europe/Stockholm')::date;
  timpris integer;
  ny      public.klippkort;
  betalda integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Bara admin sätter in gratistimmar.' using errcode = '42501';
  end if;
  if p_timmar is null or p_timmar < 1 or p_timmar > 40 then
    raise exception 'Sätt in mellan 1 och 40 timmar åt gången.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = p_familj and p.role = 'parent' and p.raderad_at is null) then
    raise exception 'Familjen finns inte.' using errcode = 'P0002';
  end if;

  -- Läxhjälpens timpris, samma rad som erbjudanden_pris räknar på: vad
  -- timmarna är värda (begart_ore, och timbank_varde om familjen har
  -- sparade minuter men inget köp).
  select t.pris_per_timme_ore into timpris
    from public.tjanster t
   where t.aktiv and t.for_kund
   order by t.ordning, t.kod
   limit 1;
  if coalesce(timpris, 0) <= 0 then
    raise exception 'Det finns inget timpris att räkna timmarnas värde på.' using errcode = 'P0001';
  end if;

  insert into public.klippkort (parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                timpris_ore, begart_ore, betalt_ore, status, giltigt_till)
  values (p_familj, 'gratis', 'Gratistimmar från Nextrum', 'klippkort', p_timmar, 2, 0,
          timpris, p_timmar * timpris, 0, 'betald', idag + 60)
  returning * into ny;

  begin
    betalda := intern.timmar_betalar_obetalda(p_familj);
  exception when others then
    betalda := 0;
  end;

  return jsonb_build_object('ok', true, 'id', ny.id, 'timmar', ny.timmar,
                            'giltigt_till', ny.giltigt_till, 'betalda_pass', betalda);
end $$;

revoke all on function public.ge_gratistimmar(uuid, integer) from public, anon;
grant execute on function public.ge_gratistimmar(uuid, integer) to authenticated;

comment on function public.ge_gratistimmar(uuid, integer) is
  '2026-10-13. Admin sätter in 1–40 gratistimmar i familjens timbank. De gäller i 60 dagar, används före köpta '
  'timmar, sparar inga minuter och betalas aldrig ut. Betalar familjens obetalda förslag och bokade pass direkt.';


-- ------------------------------------------------------------
-- 7. Admin tar tillbaka det som inte används
-- ------------------------------------------------------------
/* För en nolla för mycket, eller ett ändrat beslut. Timmar som ligger på
   ett förslag eller ett pass står kvar: passet är familjens, och avbokas
   det kommer timmen tillbaka som förut. Resten tas bort: kortet krymper
   till timmarna på passen, och ligger inga timmar på något pass tas kortet
   bort helt. Ett avbokat pass kan bära kortet (klippkortspass_avbokat
   nollar bara betalningen), och den kopplingen släpps först. Auditen
   loggar både krympningen och borttagningen (klippkort_audit nedan). */
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

  -- Familjens kort låses som när timmar dras (klippkort_dra,
  -- intern.timmar_betala), så att inget pass hinner ta en timme emellan.
  perform 1 from public.klippkort where parent_id = k.parent_id and status = 'betald' for update;

  -- Timmarna på förslag och pass, räknade som i klippkort_saldo.
  select coalesce(sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                                             coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int, 0)
    into pa_pass
    from public.bookings x
   where x.klippkort_id = p_id and x.status <> 'cancelled';

  if pa_pass >= k.timmar then
    return jsonb_build_object('ok', true, 'tillbaka', 0, 'pa_pass', pa_pass);
  end if;

  if pa_pass > 0 then
    update public.klippkort set timmar = pa_pass where id = p_id;
    return jsonb_build_object('ok', true, 'tillbaka', k.timmar - pa_pass, 'pa_pass', pa_pass);
  end if;

  update public.bookings set klippkort_id = null where klippkort_id = p_id and status = 'cancelled';
  delete from public.klippkort where id = p_id;
  return jsonb_build_object('ok', true, 'tillbaka', k.timmar, 'pa_pass', 0, 'borttagen', true);
end $$;

revoke all on function public.ta_tillbaka_gratistimmar(uuid) from public, anon;
grant execute on function public.ta_tillbaka_gratistimmar(uuid) to authenticated;

comment on function public.ta_tillbaka_gratistimmar(uuid) is
  '2026-10-13. Admin tar tillbaka gratistimmar som inte ligger på något förslag eller pass. Timmarna på passen '
  'står kvar; ligger inga där tas kortet bort.';

-- Auditen loggar nu också när timmarna på ett kort ändras och när ett kort
-- tas bort (bara gratistimmar tas bort, av funktionen ovan). Samma kolumner
-- som förut, utan namnet.
create or replace trigger klippkort_audit
  after insert or update of status, giltigt_till, aterbetald_ore, timmar or delete on public.klippkort
  for each row execute function public.logga_andring(
    'klippkort', 'id', 'parent_id', 'erbjudande', 'timmar', 'timmar_pa_kopet', 'status', 'giltigt_till',
    'begart_ore', 'betalt_ore', 'aterbetald_ore');
