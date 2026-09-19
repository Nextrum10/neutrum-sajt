-- Fas 6.2 — uppgifter, ekonomiska avvikelser och en rikare översikt.
--
-- UPPGIFTER: det någon ska göra, kopplat till det det gäller. Skapas av
-- admin nu; i Fas 7 av schemalagda kontroller och i Fas 8 av AI-agentens
-- flag_issue/create_task. Därför skapad_av_typ: människa, AI eller
-- system. Bara admin läser och skriver.
--
-- EKONOMISKA AVVIKELSER: en funktion, inte en vy. En av kontrollerna —
-- RUT-pass där kunden saknar skatteuppgifter — måste titta i
-- kund_skatteuppgifter, som ingen inloggad får läsa. Funktionen kör som
-- ägaren, kräver admin, och lämnar bara ut id, datum och belopp. Samma
-- regler som faktureringen (pris.ts) och adminvyns lista över pass utan
-- rapport, så att siffrorna stämmer överens.
--
-- ADMIN_LAGE får nya kolumner SIST (befintliga ändras inte): pass som
-- saknar rapport, förfallna fakturor, öppna och försenade uppgifter,
-- klientfel senaste dygnet och antalet avvikelser. Anon får inte längre
-- läsa vyn (fick 0 rader ändå, genom RLS).

-- ---------- uppgifter ----------
create table public.uppgifter (
  id              uuid primary key default gen_random_uuid(),
  typ             text not null default 'ovrigt'
                  check (typ in ('uppfoljning', 'kontroll', 'problem', 'ovrigt')),
  titel           text not null check (char_length(btrim(titel)) between 1 and 200),
  beskrivning     text check (beskrivning is null or char_length(beskrivning) <= 2000),
  status          text not null default 'oppen'
                  check (status in ('oppen', 'pagar', 'klar', 'avbruten')),
  ansvarig        uuid references public.profiles(id) on delete set null,
  kopplad_tabell  text check (kopplad_tabell is null or kopplad_tabell in
                  ('leads', 'applications', 'profiles', 'students', 'bookings',
                   'invoices', 'payouts', 'uppdrag', 'tjanster', 'lesson_reports')),
  kopplad_id      text,
  skapad_av       uuid references public.profiles(id) on delete set null,
  skapad_av_typ   text not null default 'manniska'
                  check (skapad_av_typ in ('manniska', 'ai', 'system')),
  forfallodag     date,
  created_at      timestamptz not null default now(),
  uppdaterad      timestamptz not null default now(),
  klar_at         timestamptz,
  check ((kopplad_tabell is null) = (kopplad_id is null))
);
create index uppgifter_oppna_idx on public.uppgifter (status, forfallodag) where status in ('oppen', 'pagar');
create index uppgifter_koppling_idx on public.uppgifter (kopplad_tabell, kopplad_id);

comment on table public.uppgifter is
  'Något som ska göras, kopplat till det det gäller. Skapas av admin, schemalagda kontroller (Fas 7) eller AI (Fas 8).';

alter table public.uppgifter enable row level security;
revoke all on public.uppgifter from anon;
create policy "admin hanterar uppgifter" on public.uppgifter
  for all using (public.is_admin()) with check (public.is_admin());

-- En uppgift som en människa skapar i adminvyn är hennes egen — den kan
-- inte utge sig för att komma från AI eller systemet. Service_role (Fas
-- 7 och 8) har ingen inloggning och sätter själv skapad_av_typ.
create or replace function public.uppgift_stampel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.skapad_av := auth.uid();
      new.skapad_av_typ := 'manniska';
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    new.skapad_av := old.skapad_av;
    new.skapad_av_typ := old.skapad_av_typ;
    new.created_at := old.created_at;
  end if;
  new.uppdaterad := now();
  if new.status = 'klar' and (tg_op = 'INSERT' or old.status is distinct from 'klar') then
    new.klar_at := now();
  elsif new.status <> 'klar' then
    new.klar_at := null;
  end if;
  return new;
end $function$;

create trigger uppgifter_stampel
  before insert or update on public.uppgifter
  for each row execute function public.uppgift_stampel();

revoke execute on function public.uppgift_stampel() from public, anon, authenticated;

-- ---------- ekonomiska avvikelser ----------
create or replace function public.ekonomiska_avvikelser()
returns table (typ text, objekt_tabell text, objekt_id text, datum date,
               belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  idag     date := (now() at time zone 'Europe/Stockholm')::date;
  manad    date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
  rut_ar   int  := extract(year from (now() at time zone 'Europe/Stockholm') + interval '10 days')::int;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser avvikelserna.';
  end if;

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
end $function$;

revoke execute on function public.ekonomiska_avvikelser() from public, anon;
grant  execute on function public.ekonomiska_avvikelser() to authenticated;

-- ---------- admin_lage: nya kolumner sist ----------
create or replace view public.admin_lage with (security_invoker = true) as
 SELECT ( SELECT count(*) AS count
           FROM leads
          WHERE leads.status = 'new'::text) AS nya_leads,
    ( SELECT count(*) AS count
           FROM applications
          WHERE applications.status = 'new'::text) AS nya_ansokningar,
    ( SELECT count(*) AS count
           FROM tutor_profiles
          WHERE tutor_profiles.status = 'pending'::text) AS vantande_studiehjalpare,
    ( SELECT count(*) AS count
           FROM profiles
          WHERE profiles.role = 'parent'::text AND profiles.match_status = 'pending'::text) AS omatchade_familjer,
    ( SELECT count(*) AS count
           FROM contact_messages
          WHERE contact_messages.hanterad_at IS NULL) AS ohanterade_meddelanden,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE (bookings.status = ANY (ARRAY['requested'::text, 'confirmed'::text])) AND bookings.wanted_date >= CURRENT_DATE) AS kommande_pass,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.status = 'requested'::text) AS obesvarade_pass,
    ( SELECT count(*) AS count
           FROM invoices
          WHERE invoices.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AS obetalda_fakturor,
    ( SELECT COALESCE(sum(invoices.belopp_ore), 0::numeric) AS "coalesce"
           FROM invoices
          WHERE invoices.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AS obetalt_ore,
    ( SELECT count(*) AS count
           FROM payouts
          WHERE payouts.status = ANY (ARRAY['utkast'::text, 'godkand'::text])) AS vantande_utbetalningar,
    ( SELECT COALESCE(sum(payouts.belopp_ore), 0::numeric) AS "coalesce"
           FROM payouts
          WHERE payouts.status = ANY (ARRAY['utkast'::text, 'godkand'::text])) AS att_betala_ut_ore,
    ( SELECT count(*) AS count
           FROM passunderlag p
          WHERE p.fakturerbar AND NOT p.har_rapport AND NOT p.fakturerad AND NOT p.pa_underlag) AS pass_utan_rapport,
    ( SELECT count(*) AS count
           FROM invoices i
          WHERE (i.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AND i.betald_at IS NULL
            AND i.forfaller < (now() AT TIME ZONE 'Europe/Stockholm')::date) AS forfallna_fakturor,
    ( SELECT count(*) AS count
           FROM uppgifter u
          WHERE u.status = ANY (ARRAY['oppen'::text, 'pagar'::text])) AS oppna_uppgifter,
    ( SELECT count(*) AS count
           FROM uppgifter u
          WHERE (u.status = ANY (ARRAY['oppen'::text, 'pagar'::text]))
            AND u.forfallodag < (now() AT TIME ZONE 'Europe/Stockholm')::date) AS forsenade_uppgifter,
    ( SELECT count(*) AS count
           FROM klientfel k
          WHERE k.created_at > now() - interval '24 hours') AS klientfel_24h;
revoke all on public.admin_lage from anon;
