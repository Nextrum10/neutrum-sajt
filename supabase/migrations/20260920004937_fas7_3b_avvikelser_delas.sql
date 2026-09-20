-- ============================================================
-- NEXTRUM — Fas 7.3b: avvikelserna delas i en räkning och en vakt
--
-- ekonomiska_avvikelser() har både frågan och behörighetskontrollen
-- i samma kropp: "är du admin, annars 42501". Det är rätt för
-- adminvyn, men det gör funktionen omöjlig att använda från ett
-- cron-jobb — ett schema har ingen auth.uid(), och is_admin() svarar
-- då false.
--
-- Lösningen är inte att lätta på vakten. Den är att flytta ut
-- RÄKNINGEN till en intern funktion som ingen klient kommer åt, och
-- låta den publika funktionen vara kvar exakt som den är, med sin
-- vakt och sitt svar.
--
-- Frågan nedan är ordagrant den som stod i ekonomiska_avvikelser
-- sedan 6.2. Inte en rad är omskriven: det enda som händer är att
-- den bytt hus. Beteendet i adminvyn ska vara identiskt, och det är
-- också provet.
-- ============================================================

create or replace function public.avvikelser_rader()
returns table(typ text, objekt_tabell text, objekt_id text, datum date,
              belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
  -- Klart för faktura men inte fakturerat, fast månaden det hölls är slut.
  union all
  select 'ej_fakturerat', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.fakturerad and p.wanted_date < manad
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
end $$;

comment on function public.avvikelser_rader() is
  'Räkningen bakom ekonomiska_avvikelser(). Ingen behörighetskontroll — får därför bara anropas av serverkod, aldrig exponeras.';

revoke execute on function public.avvikelser_rader() from public, anon, authenticated;

-- Den publika vägen är oförändrad utåt: samma namn, samma kolumner,
-- samma vakt. Bara kroppen är nu ett anrop.
create or replace function public.ekonomiska_avvikelser()
returns table(typ text, objekt_tabell text, objekt_id text, datum date,
              belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser avvikelserna.';
  end if;
  return query select * from public.avvikelser_rader();
end $$;

revoke execute on function public.ekonomiska_avvikelser() from anon;
