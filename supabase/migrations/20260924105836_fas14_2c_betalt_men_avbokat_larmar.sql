-- ============================================================
-- FAS 14.2c — ett avbokat pass som betalats larmar
--
-- Sedan Fas 14.2 betalar familjen FÖRE passet. Det öppnar ett läge
-- som månadsfakturan aldrig hade: betalsidan kan ligga öppen hos
-- familjen medan passet avbokas. Betalar de den efteråt drar Stripe
-- pengarna ändå, och webhooken måste skriva ner betalningen, för
-- pengarna är dragna. skydda_bokningsfalt stoppar bara avbokningen
-- av ett pass som REDAN är betalt, inte en betalning som kommer in
-- efter avbokningen. Admin kan också avboka ett betalt pass.
--
-- Villkoren lovar hela beloppet tillbaka för ett pass som aldrig
-- hölls. Tills det är gjort är det en avvikelse: betald_men_avbokad,
-- med beloppet som inte redan gått tillbaka. En delåterbetalning
-- lämnar raden som 'betald' (aterbetalningsLage i _delad/stripe.ts),
-- och resten är fortfarande familjens, så den räknas också.
--
-- Två funktioner, hela, eftersom create or replace kräver det:
--   avvikelser_rader()                 den nya grenen, och kommentaren
--                                      på första grenen som sa "faktureras"
--   kontroll_ekonomiska_avvikelser()   rubrik och text för den nya typen,
--                                      och fristaende_rapport utan faktura
-- ============================================================

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
  -- Genomfört pass utan rapport: räknas inte och betalas inte ut.
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
  -- Avbokat men betalt (Fas 14.2c). Beloppet är det som inte gått
  -- tillbaka än. Saknas betalt_ore på en betald rad är det också fel,
  -- och då larmar raden utan belopp i stället för att tiga.
  select 'betald_men_avbokad', 'bookings', b.id::text, b.wanted_date,
         (b.betalt_ore - coalesce(b.aterbetald_ore, 0))::bigint, b.parent_id, b.tutor_id
    from public.bookings b
   where b.status = 'cancelled' and b.betalning_status = 'betald'
     and (b.betalt_ore is null or b.betalt_ore > coalesce(b.aterbetald_ore, 0))
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
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken räknas eller betalas ut. Koppla den till rätt pass.'),
      ('ej_betalt',               'Inte betalt',              'Passet hölls och rapporterades, men familjen har inte betalat det. Betala-knappen ligger kvar på passet i familjens vy.'),
      ('betald_men_avbokad',      'Betalt men avbokat',       'Passet är avbokat men familjen har betalat det. Villkoren lovar hela beloppet tillbaka för ett pass som aldrig hölls: återbetala under Kortbetalningar.'),
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
