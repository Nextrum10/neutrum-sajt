-- ============================================================
-- FAS 14.2 — familjen får ingen månadsfaktura, och spärren
-- "ingen betalning, inget pass" finns att slå på
--
-- Beslutet: familjen betalar varje pass med kort, FÖRE passet, och
-- ett pass som inte är betalt hålls inte. Ingen månadsfaktura till
-- familjen. Studiehjälparens underlag den 25:e står orört.
--
-- Fyra saker, alla i databasen, för det är där skyddet bor:
--
-- 1. SPÄRREN ÄR EN FLAGGA, OCH DEN STÅR AV. En rad i flaggor, samma
--    mekanism som notismejlen: admin slår om, alla inloggade läser,
--    auditloggen ser vem. Av tills en provbetalning gått hela vägen.
--    Ingen kortbetalning har någonsin gått igenom, så påslagen i dag
--    hade den låst varje studiehjälpare ute från att rapportera.
--
-- 2. skydda_bokningsfalt nekar "genomfört" på ett obetalt pass när
--    flaggan är på. Rapporten gör passet genomfört i samma skrivning
--    (rapport_gor_passet_genomfort), så spärren stoppar rapporten
--    också — och utan rapport kommer passet aldrig med på underlaget.
--
-- 3. ej_fakturerat blir ej_betalt. Den gamla avvikelsen sa "kör
--    månadskörningen", och den körningen skapar ingen faktura längre.
--    Öppna uppgifter med den gamla nyckeln avbryts med skälet
--    utskrivet: de pekade på en åtgärd som inte finns.
--
-- 4. En RUT-berättigad tjänst går inte att slå på för kunder. RUT
--    drogs bara i månadsfakturan. Kortbetalningen tar hela beloppet,
--    så en sådan tjänst hade tagit fullt pris av en kund som lovats
--    avdrag, och ingen hade begärt resten från Skatteverket.
-- ============================================================

-- ---------- 1. flaggan ----------
-- Beskrivningen och vantar_pa fryses av stampla_flaggan() vid varje
-- uppdatering. Texterna ska alltså vara sanna så länge raden finns,
-- och säger därför vad som ska vara uppfyllt, inte hur det ser ut i dag.
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa)
values (
  'kortsparr',
  false,
  'Ingen betalning, inget pass. På: ett pass som familjen inte har betalat '
    || 'går inte att rapportera, och studiehjälparen ser i sin vy att det inte '
    || 'ska hållas. Av: passen rapporteras som förut, och ett pass som hölls '
    || 'utan betalning syns under Ekonomi → Avvikelser som Inte betalt.',
  'En provbetalning ska ha gått hela vägen: familjen betalar i studievyn, '
    || 'webhooken kommer fram och passet står som betalt under Kortbetalningar '
    || '(DEPLOY-BETALNING.md, avsnitt 9). Familjen ska få veta att passet '
    || 'betalas i förväg: i villkoren, på prissidan, i bekräftelsemejlet och i '
    || 'påminnelsen före passet.'
)
on conflict (kod) do nothing;


-- ---------- 2. spärren i bokningstriggern ----------
-- Hela funktionen, eftersom create or replace kräver det. Det enda
-- som är nytt är blocket märkt FAS 14.2 sist i grenen för completed.
create or replace function public.skydda_bokningsfalt()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  jag   uuid := auth.uid();
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  fria  text[] := array['status', 'wanted_date', 'wanted_time', 'created_by', 'attendance',
                          'avbokningsskal'];
  flytt boolean;
begin
  if public.is_admin() or jag is null then
    return new;
  end if;

  -- ---------- ny bokning ----------
  if tg_op = 'INSERT' then
    if new.status is distinct from 'requested' then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass måste börja som förfrågan.';
    end if;

    if new.attendance is not null then
      raise exception using errcode = '42501',
        message = 'Närvaro sätts när passet rapporteras, inte när det bokas.';
    end if;

    if new.fakturerbar is distinct from true or new.fakturerbar_anledning is not null then
      raise exception using errcode = '42501',
        message = 'Bara Nextrum kan undanta ett pass från fakturering.';
    end if;

    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara bokas idag eller framåt.';
    end if;

    -- "is null" är Fas 9.7. Utan det var villkoret falskt för ett
    -- pass utan längd, och faktureringen räknade en timme på det.
    if new.duration_min is null or new.duration_min < 60 or new.duration_min > 180 then
      raise exception using errcode = '42501',
        message = 'Ett pass är en, två eller tre timmar.';
    end if;

    if not exists (
      select 1 from public.tjanster t
      where t.kod = new.tjanst and t.aktiv and t.for_kund
    ) then
      raise exception using errcode = '42501',
        message = 'Tjänsten går inte att boka.';
    end if;

    if new.student_id is not null and not exists (
      select 1 from public.students s
      where s.id = new.student_id and s.parent_id = new.parent_id
    ) then
      raise exception using errcode = '42501',
        message = 'Barnet hör inte till familjen.';
    end if;

    if jag = new.tutor_id then
      if new.student_id is not null and not public.ar_min_elev(new.student_id) then
        raise exception using errcode = '42501',
          message = 'Du kan bara föreslå pass för dina egna elever.';
      end if;
      if new.antal_barn <> 1 then
        raise exception using errcode = '42501',
          message = 'Antalet barn väljer familjen när den bokar.';
      end if;
    end if;

    return new;
  end if;

  -- ---------- befintlig bokning ----------
  if old.status in ('completed', 'cancelled') then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode = '42501',
        message = 'Ett genomfört eller avbokat pass går inte att ändra.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - fria) is distinct from (to_jsonb(old) - fria) then
    raise exception using errcode = '42501',
      message = 'På ett bokat pass kan bara status och tid ändras.';
  end if;

  flytt := new.wanted_date is distinct from old.wanted_date
        or new.wanted_time is distinct from old.wanted_time;

  if flytt then
    if new.status <> 'requested' or new.created_by is distinct from jag then
      raise exception using errcode = '42501',
        message = 'En flyttad tid måste bekräftas av motparten.';
    end if;
    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara flyttas till idag eller framåt.';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501',
      message = 'Vem som föreslog passet ändras bara när tiden flyttas.';
  end if;

  if new.attendance is distinct from old.attendance and new.status <> 'completed' then
    raise exception using errcode = '42501',
      message = 'Närvaro sätts när passet rapporteras.';
  end if;

  -- FAS 15.2. Skälet står i vitlistan, men bara i samma skrivning som
  -- avbokningen — ett skäl på ett pass som fortfarande gäller är
  -- ingenting, och ett skäl som byts efteråt hade gjort mejlet som
  -- redan gått till motparten osant. Rättelser i efterhand gör admin.
  if new.avbokningsskal is distinct from old.avbokningsskal then
    if new.status is distinct from 'cancelled' then
      raise exception using errcode = '42501',
        message = 'Skälet anges när passet avbokas.';
    end if;
    if new.avbokningsskal is null
       or new.avbokningsskal not in ('sjukdom', 'forhinder', 'ombokat', 'annat') then
      raise exception using errcode = '42501',
        message = 'Det skälet sätter bara Nextrum.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      /* FAS 13.1. Här stod tidigare bara "null" — avbokning var det
         enda statusbytet som inte prövades alls.

         Betalda pengar ligger på Nextrums konto och tillhör familjen
         tills någon bestämt något annat. Att låta avbokningen gå
         igenom hade lämnat dem där utan att någon fick veta det.

         Vi utlöser INTE en återbetalning automatiskt: hur mycket som
         ska tillbaka beror på när avbokningen sker, och den policyn
         är inte skriven än. Ett nej som säger varför är ärligare än
         en återbetalning ingen beslutat om. */
      if old.betalning_status in ('betald', 'tvist') then
        raise exception using errcode = '42501',
          message = 'Passet är betalt och går inte att avboka härifrån. Kontakta Nextrum, så tar vi hand om återbetalningen.';
      end if;

      /* FAS 15.2. Ett avbokat pass säger varför. Att AVBÖJA en tid
         motparten föreslagit gör det inte — det passet fanns aldrig.
         Skillnaden är densamma som notis_vid_pass gör mellan
         pass_avbojt och pass_avbokat, så ett mejl om ett avbokat pass
         från en familj eller en studiehjälpare har alltid ett skäl. */
      if not (old.status = 'requested' and old.created_by is distinct from jag)
         and new.avbokningsskal is null then
        raise exception using errcode = '42501',
          message = 'Välj ett skäl till avbokningen.';
      end if;

    elsif new.status = 'confirmed' then
      if old.status <> 'requested' or old.created_by is not distinct from jag then
        raise exception using errcode = '42501',
          message = 'Ett pass bekräftas av motparten, inte av den som föreslog det.';
      end if;

    elsif new.status = 'requested' then
      if not flytt then
        raise exception using errcode = '42501',
          message = 'Ett bekräftat pass blir förfrågan igen bara när tiden flyttas.';
      end if;

    elsif new.status = 'completed' then
      if jag is distinct from old.tutor_id then
        raise exception using errcode = '42501',
          message = 'Bara passets studiehjälpare kan markera det som genomfört.';
      end if;
      if flytt or old.wanted_date is null or old.wanted_date > idag then
        raise exception using errcode = '42501',
          message = 'Ett pass kan markeras som genomfört först när det har varit.';
      end if;
      if not (old.status = 'confirmed'
              or (old.status = 'requested' and old.created_by = old.parent_id)) then
        raise exception using errcode = '42501',
          message = 'Familjen har inte bekräftat passet, så det kan inte markeras som genomfört.';
      end if;
      if not exists (
        select 1 from public.lesson_reports r
        where r.booking_id = old.id
          and r.tutor_id = jag
          and (old.student_id is null or r.student_id = old.student_id)
      ) then
        raise exception using errcode = '42501',
          message = 'Passet saknar rapport och kan inte markeras som genomfört.';
      end if;

      /* FAS 14.2. Ingen betalning, inget pass — när flaggan kortsparr
         är på. Den står AV tills en provbetalning gått hela vägen; på
         utan en kortväg som bevisligen fungerar hade den låst varje
         studiehjälpare ute från att rapportera ett enda pass.

         Prövningen ligger här och inte i rapportformuläret, för att
         rapporten gör passet genomfört i databasen
         (rapport_gor_passet_genomfort) och den skrivningen går genom
         den här triggern. Ett obetalt pass får alltså ingen rapport,
         och utan rapport kommer det aldrig med på underlaget den 25:e.

         Tvist släpps igenom: familjen HAR betalat, och passet hölls på
         den betalningen. Ett pass Nextrum undantagit (fakturerbar =
         false) ska inte betalas och ska därför inte heller stoppas.
         Saknas flaggraden är spärren av, inte på — ett fel i en
         konfigurationstabell ska inte stänga ute alla studiehjälpare. */
      if old.fakturerbar
         and old.betalning_status not in ('betald', 'tvist')
         and coalesce((select f.aktiv from public.flaggor f where f.kod = 'kortsparr'), false) then
        raise exception using errcode = '42501',
          message = 'Passet är inte betalt, så rapporten kan inte sparas än. Familjen betalar passet i sin vy, och rapporten går att spara när betalningen kommit in.';
      end if;
    end if;
  end if;

  return new;
end $function$;


-- ---------- 3. avvikelsen och uppgifterna ----------
-- Hela funktionen. Det enda som är nytt är grenen ej_betalt, som
-- ersätter ej_fakturerat på samma plats.
create or replace function public.avvikelser_rader()
 returns table(typ text, objekt_tabell text, objekt_id text, datum date, belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  idag     date := (now() at time zone 'Europe/Stockholm')::date;
  manad    date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
  rut_ar   int  := extract(year from (now() at time zone 'Europe/Stockholm') + interval '10 days')::int;
begin
  return query
  -- Genomfört pass utan rapport: faktureras och betalas inte ut.
  select 'pass_utan_rapport', 'bookings', p.id::text, p.wanted_date, null::bigint, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.fakturerad and not p.pa_underlag
  union all
  -- Rapport som inte hör till något pass.
  select 'fristaende_rapport', 'lesson_reports', r.id::text, r.lesson_date, null, null, r.tutor_id
    from public.lesson_reports r where r.booking_id is null
  -- Hölls och rapporterades, men familjen har inte betalat (Fas 14.2).
  -- Ersätter ej_fakturerat: familjen får ingen månadsfaktura längre,
  -- så det finns ingen dag då ett obetalt pass blir betalt av sig
  -- självt, och därför ingen datumgräns. Ett pass på en äldre faktura
  -- drivs in genom den och räknas inte här.
  union all
  select 'ej_betalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.fakturerad
     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
  union all
  select 'ej_utbetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.pa_underlag and p.tutor_id is not null
     and p.wanted_date < manad
  union all
  -- Skickad faktura efter förfallodagen, obetald.
  select 'faktura_forfallen', 'invoices', i.id::text, i.forfaller, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.status in ('skickad', 'forfallen') and i.betald_at is null and i.forfaller < idag
  union all
  -- Utkast som aldrig skickats.
  select 'faktura_gammalt_utkast', 'invoices', i.id::text, i.period, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.status = 'utkast' and i.created_at < now() - interval '7 days'
  union all
  -- Utbetalning som inte gjorts, för en månad före förra.
  select 'utbetalning_vantar', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.status in ('utkast', 'godkand')
     and u.period < (manad - interval '1 month')::date
  union all
  select 'utbetalning_misslyckad', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u where u.status = 'misslyckad'
  union all
  -- Pass klart för utbetalning men ingen ersättning att räkna med.
  select 'timpenning_saknas', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, b.tutor_id
    from public.passunderlag b
    left join public.tutor_profiles tp on tp.id = b.tutor_id
    left join public.tjanster t on t.kod = b.tjanst
   where b.tutor_id is not null and b.fakturerbar and b.har_rapport and not b.pa_underlag
     and coalesce(tp.hourly_rate, 0) = 0 and coalesce(t.ersattning_per_timme_ore, 0) = 0
  union all
  select 'pass_utan_studiehjalpare', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, null
    from public.bookings b where b.status = 'completed' and b.tutor_id is null
  union all
  -- RUT-pass där kunden saknar skatteuppgifter: faktureras utan avdrag.
  select 'rut_utan_skatteuppgifter', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, b.tutor_id
    from public.passunderlag b
    join public.tjanster t on t.kod = b.tjanst
   where t.rut_berattigad and t.rut_procent > 0 and b.fakturerbar and b.har_rapport and not b.fakturerad
     and not exists (select 1 from public.kund_skatteuppgifter k where k.kund_id = b.parent_id)
  union all
  -- RUT-pass men inget tak inlagt för året avdraget räknas mot.
  select 'rut_utan_tak', 'rut_tak', rut_ar::text, null, null, null, null
   where exists (select 1 from public.passunderlag b join public.tjanster t on t.kod = b.tjanst
                  where t.rut_berattigad and t.rut_procent > 0 and b.fakturerbar and b.har_rapport and not b.fakturerad)
     and not exists (select 1 from public.rut_tak where ar = rut_ar)
  union all
  select 'rut_over_tak', 'profiles', r.kund_id::text, make_date(r.ar, 12, 31), r.rut_ore, r.kund_id, null
    from public.rut_underlag r where r.kvar_ore < 0
  union all
  -- Fakturans summa stämmer inte med raderna.
  select 'faktura_summa_fel', 'invoices', i.id::text, i.period, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.invoice_lines l where l.invoice_id = i.id), 0)
  union all
  select 'utbetalning_summa_fel', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.payout_lines l where l.payout_id = u.id), 0)
  union all
  -- Fakturerat pass som inte längre är genomfört eller fakturerbart.
  select 'fakturerat_ogiltigt_pass', 'invoice_lines', l.id::text, b.wanted_date, l.belopp_ore, b.parent_id, b.tutor_id
    from public.invoice_lines l join public.bookings b on b.id = l.booking_id
   where b.status <> 'completed' or not b.fakturerbar;
end $function$;

-- Hela funktionen. Det enda som är nytt är raden för ej_betalt, som
-- ersätter raden för ej_fakturerat på samma plats.
create or replace function public.kontroll_ekonomiska_avvikelser()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  a record;
  rubrik text;
  text_ text;
  tabell text;
begin
  for a in select * from public.avvikelser_rader()
            where typ not in ('pass_utan_rapport', 'faktura_forfallen')
  loop
    select t.rubrik, t.beskrivning into rubrik, text_ from (values
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken faktureras eller betalas ut. Koppla den till rätt pass.'),
      ('ej_betalt',               'Inte betalt',              'Passet hölls och rapporterades, men familjen har inte betalat det. Betala-knappen ligger kvar på passet i familjens vy.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('faktura_gammalt_utkast',  'Gammalt fakturautkast',    'Fakturan har stått som utkast i över en vecka. Skicka den eller ta bort den.'),
      ('utbetalning_vantar',      'Utbetalning väntar',       'Underlaget är äldre än förra månaden och pengarna har inte gått iväg.'),
      ('utbetalning_misslyckad',  'Utbetalning misslyckades', 'Överföringen gick inte igenom. Ta reda på varför innan nästa körning.'),
      ('timpenning_saknas',       'Timpenning saknas',        'Passet kan inte betalas ut: varken studiehjälparen eller tjänsten har en ersättning.'),
      ('pass_utan_studiehjalpare','Pass utan studiehjälpare', 'Passet är genomfört men ingen studiehjälpare står på det.'),
      ('rut_utan_skatteuppgifter','RUT utan skatteuppgifter', 'Passet är RUT-berättigat men kunden saknar skatteuppgifter. Fakturan skulle skickas utan avdrag.'),
      ('rut_utan_tak',            'RUT-taket saknas',         'Ingen rad i rut_tak för året avdraget räknas mot. Fyll i taket under System → Inställningar.'),
      ('rut_over_tak',            'RUT över taket',           'Kunden har dragit av mer än årets tak tillåter.'),
      ('faktura_summa_fel',       'Fakturasumman stämmer inte','Fakturans belopp är inte summan av dess rader.'),
      ('utbetalning_summa_fel',   'Utbetalningssumman stämmer inte','Underlagets belopp är inte summan av dess rader.'),
      ('fakturerat_ogiltigt_pass','Fakturerat ogiltigt pass', 'En fakturarad pekar på ett pass som inte längre är genomfört eller fakturerbart.')
    ) as t(typ, rubrik, beskrivning) where t.typ = a.typ;

    tabell := a.objekt_tabell;

    if public.skapa_uppgift(
         coalesce(rubrik, a.typ) || case when a.datum is not null
                                    then ' ' || to_char(a.datum, 'YYYY-MM-DD') else '' end,
         'avvikelse:' || a.typ || ':' || a.objekt_tabell || ':' || a.objekt_id,
         'problem',
         text_,
         tabell,
         a.objekt_id,
         idag + 5) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

-- Uppgifter som skapats av den gamla avvikelsen säger "kör
-- månadskörningen". Den körningen tar inte längre med familjens halva,
-- så åtgärden finns inte. Avbrutna, inte klara: ingen har gjort något,
-- och är passet fortfarande obetalt skapar kontrollen en ny uppgift
-- med rätt text nästa gång den körs.
update public.uppgifter
   set status = 'avbruten',
       beskrivning = left(coalesce(beskrivning || E'\n\n', '')
         || 'Avbruten i Fas 14.2: familjen får ingen månadsfaktura längre, så '
         || 'det finns ingen körning som tar med passet. Är det obetalt kommer '
         || 'det tillbaka som "Inte betalt".', 2000)
 where nyckel like 'avvikelse:ej\_fakturerat:%' escape '\'
   and status in ('oppen', 'pagar');


-- ---------- 4. RUT-invarianten ----------
-- Hela funktionen. Nytt: den fjärde invarianten, och texten i den
-- andra, som sa att månadskörningen fakturerar till läxhjälpens pris.
-- Kortbetalningen har samma reserv (stripe-checkout läser prissattning
-- när tjänsten saknar pris), så invarianten gäller lika mycket nu.
-- Ändras något här måste spegeln i nextrum-admin-tjanster.js följa med.
create or replace function public.skydda_tjansteaktivering()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Nödbromsen först: att stänga av en tjänst får aldrig nekas.
  if not new.aktiv then
    return new;
  end if;

  if not new.for_kund and not new.for_jobb then
    raise exception using errcode = '42501',
      message = 'En aktiv tjänst måste gå att antingen boka eller söka till. '
             || 'Kryssa i "för kund" eller "för jobb" först.';
  end if;

  if new.for_kund and (new.pris_per_timme_ore is null or new.pris_per_timme_ore <= 0) then
    raise exception using errcode = '42501',
      message = 'Tjänsten går att boka men saknar pris. Utan pris tar '
             || 'kortbetalningen läxhjälpens timpris för den och skriver det '
             || 'som om det vore tjänstens eget. Sätt ett pris först.';
  end if;

  if new.extra_personer_max > 1 and new.extra_personer_ore is null then
    raise exception using errcode = '42501',
      message = 'Tjänsten tillåter flera personer men saknar tillägg för dem. '
             || 'Tillägget blir då tyst noll. Sätt ett belopp, eller sänk '
             || 'antalet till en.';
  end if;

  -- FAS 14.2. RUT drogs bara i familjens månadsfaktura, och den finns
  -- inte längre. Kortbetalningen tar hela beloppet.
  if new.for_kund and new.rut_berattigad then
    raise exception using errcode = '42501',
      message = 'Kortbetalningen drar inte RUT-avdraget, så en RUT-berättigad '
             || 'tjänst kan inte bokas av kunder än. Kunden hade betalat hela '
             || 'priset och ingen hade begärt resten från Skatteverket. Ta bort '
             || 'RUT-andelen, eller vänta tills kortbetalningen kan dra avdraget.';
  end if;

  return new;
end $function$;
