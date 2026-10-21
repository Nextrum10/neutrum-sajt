-- ============================================================
-- Betala nu: kort eller Klarna när tiden är bekräftad, planerna i 30
-- dagar, och pengarna tillbaka av sig själva när passet blev kortare
-- (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): "Hela betalning är fel. De ska vara
-- att man betalar när man fått de bekräftat att man kan boka lektionen.
-- Eller att man köper planen direkt och den används 30 dagar framåt. Så
-- de ska finnas två alternativ för att köpa betala direkt med kort eller
-- betala med klarna. ... Alla betala knappar ska vara oranga och stå
-- betala nu. Så bekräfta rapport kan tas bort." På frågorna samma kväll:
-- ett pass som inte betalats före hålls ändå och följs upp av oss
-- ("Passet hålls, vi jagar"), en plan gäller 30 dagar från köpet, och
-- blir passet kortare betalas mellanskillnaden tillbaka.
--
-- I driften när filen skrevs: inga pass, inga sparade kort, inga
-- reservationer och ingen betald plan med en månad (planerna_per_manad
-- och kortet_reserveras hade inte hunnit användas).
--
--   1. Strömbrytaren kortreservation står av. Kortet reserveras inte
--      längre två dagar före passet; familjen betalar med Betala nu.
--      Jobbet kortreservation står kvar: det släpper det som ändå skulle
--      stå reserverat och betalar tillbaka (punkt 5).
--   2. En plan gäller 30 dagar från betalningen. intern.klippkort_manad
--      sätter ingen månad på ett nytt köp, och klippkort_betald räknar
--      30 dagar för en plan. Köp med en månad behåller sina datum.
--   3. Rapporten bekräftas inte: morgonmejlet räknar inte längre
--      rapporter som familjen inte bekräftat. rapport_bekraftelser står
--      kvar, som historik.
--   4. kortare_pass_att_aterbetala(): pass betalda med kort eller Klarna
--      där den hållna tiden blev kortare än den betalda, med beloppet
--      att betala tillbaka (samma räkning som avvikelsen
--      betalt_for_lange). Bara tjänstekontot.
--   5. intern.kortreservation_vack väcker stripe-reservation också när
--      något ska betalas tillbaka, och funktionen gör det.
--   6. Villkoren har versionen 2026-10-22: alla får frågan igen.
--
-- Funktionerna lappas med replace() och en vakt som räknar träffarna
-- (CLAUDE.md avsnitt 5): en kropp som redan bär ändringen släpps igenom,
-- så filen går att köra två gånger. Inget drop och inget delete.
-- ============================================================

-- ---------- 1. strömbrytaren av ----------
update public.flaggor
   set aktiv = false,
       beskrivning = 'Av sedan 2026-10-21 (betala_nu): familjen betalar varje pass med kort eller Klarna, '
         || 'med Betala nu så fort studiehjälparen bekräftat tiden. Förut kunde familjen välja kort när den '
         || 'föreslog ett pass: kortet sparades hos Stripe, beloppet reserverades två dagar före passet och '
         || 'drogs när rapporten var skriven.',
       vantar_pa = 'Ska inte slås på: villkoren (version 2026-10-22) lovar Betala nu och nämner ingen '
         || 'reservation. Slås den på ska villkoren, sidorna och mejlen ändras i samma veva.'
 where kod = 'kortreservation';

-- ---------- 2. planerna i 30 dagar ----------
create or replace function intern.klippkort_manad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
-- betala_nu (2026-10-21, Leo: planen "används 30 dagar framåt"). En plan
-- gäller 30 dagar från betalningen, och inget köp får en månad. Samma dag
-- köptes en plan för en kalendermånad (planerna_per_manad); ingen hann
-- köpa en. Timmar till planen tar planens månad, om den har en.
begin
  if new.till_plan is not null then
    new.galler_fran := (select p.galler_fran from public.klippkort p where p.id = new.till_plan);
  else
    new.galler_fran := null;
  end if;
  return new;
end $$;

do $$
declare
  f text := pg_get_functiondef('public.klippkort_betald(uuid,integer,text,text,text,integer,integer,boolean)'::regprocedure);
  gammal text := '                             -- planerna_per_manad (2026-10-21): en plan gäller sin kalendermånad.' || chr(10)
              || '                             when galler_fran is not null';
  ny text := '                             -- betala_nu (2026-10-21): en plan gäller 30 dagar från betalningen.' || chr(10)
          || '                             when sort = ''plan'' and galler_fran is null and erbjudande is distinct from ''gratis''' || chr(10)
          || '                             then idag + 30' || chr(10)
          || gammal;
begin
  if position('betala_nu (2026-10-21)' in f) > 0 then
    raise notice 'klippkort_betald bär redan 30 dagar';
  elsif (length(f) - length(replace(f, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'klippkort_betald har ändrats sedan betala_nu skrevs. Läs driften och skriv om migrationen.';
  else
    execute replace(f, gammal, ny);
  end if;
end $$;

-- ---------- 3. ingen rapport att bekräfta i morgonmejlet ----------
do $$
declare
  f text := pg_get_functiondef('intern.admin_att_gora()'::regprocedure);
  gammal text := '  -- Bara här: rapporten är skriven men familjen har inte bekräftat den.' || chr(10)
              || '  union all' || chr(10)
              || '  select ''rapport_obekraftad'', r.id::text from public.lesson_reports r' || chr(10)
              || '    join public.students s on s.id = r.student_id and s.raderad_at is null' || chr(10)
              || '   where not exists (select 1 from public.rapport_bekraftelser b where b.rapport_id = r.id)' || chr(10);
  ny text := '  -- betala_nu (2026-10-21): familjen bekräftar inte rapporten längre.' || chr(10);
begin
  if position('betala_nu (2026-10-21)' in f) > 0 then
    raise notice 'admin_att_gora räknar redan inga obekräftade rapporter';
  elsif (length(f) - length(replace(f, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'admin_att_gora har ändrats sedan betala_nu skrevs. Läs driften och skriv om migrationen.';
  else
    execute replace(f, gammal, ny);
  end if;
end $$;

-- ---------- 4. pass som ska ha pengar tillbaka ----------
create or replace function public.kortare_pass_att_aterbetala(p_grans integer)
returns table(booking_id uuid, belopp_ore bigint, payment_intent text, betalt_ore integer, aterbetald_ore integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- betala_nu (2026-10-21). Samma räkning som avvikelsen betalt_for_lange:
  -- det betalda, minus det som redan gått tillbaka, minus priset för den
  -- hållna tiden. Bara ett pass som står som betalt, med ett PaymentIntent:
  -- ett i tvist eller helt återbetalt rörs inte.
  select b.id, a.belopp_ore, b.stripe_payment_intent_id, b.betalt_ore, coalesce(b.aterbetald_ore, 0)
    from public.avvikelser_rader() a
    join public.bookings b on b.id::text = a.objekt_id
   where a.typ = 'betalt_for_lange'
     and a.belopp_ore > 0
     and b.betalning_status = 'betald'
     and b.stripe_payment_intent_id is not null
     and b.betalt_ore is not null
   order by a.datum, b.id
   limit greatest(coalesce(p_grans, 20), 1)
$$;
revoke all on function public.kortare_pass_att_aterbetala(integer) from public, anon, authenticated;
grant execute on function public.kortare_pass_att_aterbetala(integer) to service_role;
comment on function public.kortare_pass_att_aterbetala(integer) is
  'betala_nu (2026-10-21). Pass som betalats för mer tid än de höll, och beloppet att betala tillbaka. '
  'stripe-reservation betalar tillbaka dem. Bara tjänstekontot.';

-- ---------- 5. jobbet väcker funktionen för det också ----------
do $$
declare
  f text := pg_get_functiondef('intern.kortreservation_vack()'::regprocedure);
  gammal text := '  if not exists (select 1 from public.kortreservation_att_gora(1)) then';
  ny text := '  -- betala_nu (2026-10-21): också när ett kortare pass ska ha pengar tillbaka.' || chr(10)
          || '  if not exists (select 1 from public.kortreservation_att_gora(1))' || chr(10)
          || '     and not exists (select 1 from public.kortare_pass_att_aterbetala(1)) then';
begin
  if position('betala_nu (2026-10-21)' in f) > 0 then
    raise notice 'kortreservation_vack väcker redan för återbetalningarna';
  elsif (length(f) - length(replace(f, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'kortreservation_vack har ändrats sedan betala_nu skrevs. Läs driften och skriv om migrationen.';
  else
    execute replace(f, gammal, ny);
  end if;
end $$;

-- ---------- 6. användarvillkoren ----------
-- Betala nu, Klarna, planerna i 30 dagar och återbetalningen när passet
-- blev kortare (anvandarvillkor.html, båda språken). Punkten om kortet som
-- reserveras och meningarna om att bekräfta rapporten är borta. En hade
-- godkänt 2026-10-21 när filen skrevs, så versionen är nästa dag.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-22'::text $$;
