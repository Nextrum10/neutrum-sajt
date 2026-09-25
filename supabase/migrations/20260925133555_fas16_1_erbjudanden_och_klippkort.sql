-- ============================================================
-- Fas 16.1: erbjudandena — köpta timmar som dras per pass
--
-- Leo 2026-09-25: en Standardplan (ett pass i veckan, förbrukas på en
-- månad) och en Intensiv (två i veckan), båda med 10 % rabatt, och
-- klippkort på 10, 20, 30, 60 eller 100 timmar med 5 %.
--
-- ALLT ÄR KLIPPKORT I DATABASEN. En plan är fyra eller åtta timmar som
-- gäller en månad; ett klippkort är fler timmar som gäller längre. Det
-- är samma sak — förbetalda timmar med ett sista datum — och två
-- tabeller hade varit två regler för hur en timme dras.
--
--
-- VARFÖR skydda_bokningsfalt INTE RÖRS
--
-- #44 (faktura som betalsätt) ersatte funktionen i driften medan den
-- här grenen byggdes, och en CREATE OR REPLACE härifrån hade raderat
-- dess gren — eller tvärtom, beroende på vem som körde sist. Därför:
--
--   · kopplingen pass → klippkort vaktas av en EGEN trigger,
--     skydda_klippkortet, som bara ser på klippkort_id
--   · timmarna dras av klippkort_dra(), som bara service_role når.
--     Funktionen klippkort-betala prövar familjens egen token först
--     (CLAUDE.md avsnitt 6) och anropar sedan den här. Som service_role
--     är auth.uid() null, och skydda_bokningsfalt släpper igenom som
--     för webhooken.
--   · ett pass betalt med timmar står som 'betald', inte som ett nytt
--     läge. Då räknar kortspärren, avvikelserna och månadskörningen
--     det som betalt utan att någon av dem ändras. Det som skiljer är
--     klippkort_id, och betalt_ore står null: det är ett kvitto på
--     kortpengar, och de pengarna ligger på klippkortet.
--
--
-- TIMMARNA RÄKNAS, DE LAGRAS INTE
--
-- Kvar = köpta timmar minus timmarna i de pass som bär kortet och inte
-- är avbokade. Avbokas ett pass (av admin — ett betalt pass avbokas
-- inte från en vy) kommer timmarna tillbaka av sig själva. En kolumn
-- "kvar" hade behövt skrivas vid varje avbokning, och den gången den
-- glömdes hade saldot ljugit.
--
--
-- PRISET RÄKNAS I DATABASEN, EN GÅNG
--
-- erbjudanden_pris räknar priset ur läxhjälpens timpris, samma rad som
-- passen betalas efter, avrundat NEDÅT till hel krona: rabatten blir
-- aldrig mindre än den som står på sidan. Prissidan, studievyn och
-- stripe-checkout läser samma vy. Höjs timpriset följer erbjudandena
-- med, och ett köpt klippkort har sitt pris fryst i raden.
-- ============================================================

-- ---------- katalogen ----------
create table public.erbjudanden (
  kod            text primary key check (kod ~ '^[a-z0-9_]+$'),
  sort           text not null check (sort in ('plan', 'klippkort')),
  namn           text not null,
  timmar         int  not null check (timmar between 1 and 200),
  rabatt_procent int  not null check (rabatt_procent between 0 and 50),
  giltig_manader int  not null check (giltig_manader between 1 and 36),
  ordning        int  not null default 100,
  aktiv          boolean not null default true
);

comment on table public.erbjudanden is
  'Fas 16.1. Planer och klippkort som går att köpa. Priset räknas i erbjudanden_pris, aldrig här.';

alter table public.erbjudanden enable row level security;

create policy "alla läser aktiva erbjudanden" on public.erbjudanden
  for select to anon, authenticated using (aktiv or public.is_admin());
create policy "bara admin ändrar erbjudanden" on public.erbjudanden
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.erbjudanden (kod, sort, namn, timmar, rabatt_procent, giltig_manader, ordning) values
  ('standard', 'plan',      'Standardplan',          4, 10,  1, 10),
  ('intensiv', 'plan',      'Intensiv',              8, 10,  1, 20),
  ('klipp10',  'klippkort', 'Klippkort 10 timmar',  10,  5,  6, 30),
  ('klipp20',  'klippkort', 'Klippkort 20 timmar',  20,  5,  6, 40),
  ('klipp30',  'klippkort', 'Klippkort 30 timmar',  30,  5,  6, 50),
  ('klipp60',  'klippkort', 'Klippkort 60 timmar',  60,  5, 12, 60),
  ('klipp100', 'klippkort', 'Klippkort 100 timmar', 100, 5, 18, 70);

create trigger erbjudanden_audit
  after update of aktiv, timmar, rabatt_procent, giltig_manader on public.erbjudanden
  for each row execute function public.logga_andring(
    'erbjudande', 'kod', 'aktiv', 'timmar', 'rabatt_procent', 'giltig_manader');

-- ---------- priset ----------
create view public.erbjudanden_pris with (security_invoker = true) as
select e.kod, e.sort, e.namn, e.timmar, e.rabatt_procent, e.giltig_manader, e.ordning,
       t.pris_per_timme_ore                                   as timpris_ore,
       e.timmar * t.pris_per_timme_ore                        as ordinarie_ore,
       (floor(e.timmar::numeric * t.pris_per_timme_ore * (100 - e.rabatt_procent) / 10000) * 100)::int
                                                              as pris_ore
  from public.erbjudanden e
  /* Samma regel som standard_tjanst(): den första aktiva tjänsten
     kunder kan köpa. Funktionen själv går inte att anropa som anon, och
     vyn läses av prissidan utan inloggning — provet i fas16_1 föll på
     precis det. Tjänsterna som läses här är de som redan är publika. */
  cross join lateral (
    select pris_per_timme_ore from public.tjanster
     where aktiv and for_kund order by ordning, kod limit 1
  ) t
 where e.aktiv and t.pris_per_timme_ore > 0;

comment on view public.erbjudanden_pris is
  'Fas 16.1. Priset per erbjudande ur standardtjänstens timpris, nedåt till hel krona. Enda stället priset räknas.';

grant select on public.erbjudanden_pris to anon, authenticated;

-- ---------- köpen ----------
create table public.klippkort (
  id                          uuid primary key default gen_random_uuid(),
  parent_id                   uuid not null references public.profiles(id) on delete restrict,
  erbjudande                  text not null references public.erbjudanden(kod),
  -- Frysta vid köpet: en ändrad katalog ändrar inte ett köp.
  namn                        text not null,
  sort                        text not null check (sort in ('plan', 'klippkort')),
  timmar                      int  not null check (timmar > 0),
  giltig_manader              int  not null check (giltig_manader > 0),
  rabatt_procent              int  not null,
  -- Ordinarie timpris vid köpet. Återbetalningen när en familj slutar
  -- räknar de använda timmarna till det priset (Leo 2026-09-25).
  timpris_ore                 int  not null check (timpris_ore > 0),
  begart_ore                  int  not null check (begart_ore > 0),
  -- Bara webhooken skriver resten, som för passen (Fas 14.1).
  betalt_ore                  int,
  status                      text not null default 'vantar'
    check (status in ('vantar', 'betald', 'misslyckad', 'aterbetald', 'tvist')),
  giltigt_till                date,
  betald_at                   timestamptz,
  aterbetald_ore              int  not null default 0,
  stripe_session_id           text,
  stripe_payment_intent_id    text,
  stripe_charge_id            text,
  stripe_balanstransaktion_id text,
  stripe_avgift_ore           int,
  stripe_netto_ore            int,
  created_at                  timestamptz not null default now()
);

comment on table public.klippkort is
  'Fas 16.1. Köpta timmar, planer och klippkort. Skrivs bara med service_role (stripe-checkout, stripe-webhook). Kvar räknas i klippkort_saldo.';

create index klippkort_foralder on public.klippkort (parent_id, status);
create unique index klippkort_charge on public.klippkort (stripe_charge_id) where stripe_charge_id is not null;

alter table public.klippkort enable row level security;

-- Ingen skrivpolicy, med flit: kan ingen skriva ett belopp från
-- webbläsaren kan ingen skriva fel belopp (samma regel som payouts).
create policy "familjen ser sina köp" on public.klippkort
  for select to authenticated using (parent_id = auth.uid() or public.is_admin());

create trigger klippkort_audit
  after insert or update of status, giltigt_till, aterbetald_ore on public.klippkort
  for each row execute function public.logga_andring(
    'klippkort', 'id', 'parent_id', 'erbjudande', 'timmar', 'status', 'giltigt_till',
    'begart_ore', 'betalt_ore', 'aterbetald_ore');

-- ---------- passet bär kortet ----------
alter table public.bookings
  add column klippkort_id uuid references public.klippkort(id) on delete restrict;

create index bookings_klippkort on public.bookings (klippkort_id) where klippkort_id is not null;

comment on column public.bookings.klippkort_id is
  'Fas 16.1. Klippkortet passet betalades med. Sätts bara av klippkort_dra() (service_role) eller admin.';

/* En egen trigger, inte en gren i skydda_bokningsfalt — se filhuvudet.
   Utan den hade en familj kunnat skapa ett pass med någon annans
   klippkort_id och bränna den familjens timmar: insert-grenen i
   skydda_bokningsfalt letar efter stripe_-kolumner, inte efter den här. */
create function public.skydda_klippkortet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.klippkort_id is not null then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass har ingen betalning. Den sätts när passet betalas.';
    end if;
  elsif new.klippkort_id is distinct from old.klippkort_id then
    raise exception using errcode = '42501',
      message = 'Timmarna dras när passet betalas, inte härifrån.';
  end if;
  return new;
end $$;

create trigger bookings_skydda_klippkortet
  before insert or update of klippkort_id on public.bookings
  for each row execute function public.skydda_klippkortet();

-- ---------- saldot ----------
/* security_invoker: familjen ser sina egna kort och sina egna pass, och
   därmed rätt antal använda timmar. En timme per påbörjad timme, som
   när passet betalas med kort. */
create view public.klippkort_saldo with (security_invoker = true) as
select k.id, k.parent_id, k.erbjudande, k.namn, k.sort, k.timmar,
       coalesce(a.anvanda, 0)                                        as anvanda,
       greatest(k.timmar - coalesce(a.anvanda, 0), 0)                as kvar,
       k.giltigt_till, k.status, k.begart_ore, k.betalt_ore, k.aterbetald_ore,
       k.timpris_ore, k.betald_at, k.created_at,
       (k.status = 'betald'
        and k.giltigt_till >= (now() at time zone 'Europe/Stockholm')::date
        and k.timmar - coalesce(a.anvanda, 0) > 0)                   as brukbar,
       /* Om familjen slutar i dag: de använda timmarna räknas till
          ordinarie pris, resten går tillbaka (Leo 2026-09-25). Aldrig
          under noll, och aldrig mer än det som finns kvar av betalningen. */
       greatest(coalesce(k.betalt_ore, 0) - k.aterbetald_ore
                - coalesce(a.anvanda, 0) * k.timpris_ore, 0)         as vid_uppsagning_ore
  from public.klippkort k
  left join lateral (
    select sum(greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0)))::int as anvanda
      from public.bookings b
     where b.klippkort_id = k.id and b.status <> 'cancelled'
  ) a on true;

grant select on public.klippkort_saldo to authenticated;

-- ---------- att dra timmar ----------
/* Bara service_role. klippkort-betala prövar familjens token och skickar
   in vem det är; funktionen litar ändå inte på anroparen utan prövar
   att passet och kortet hör till samma familj.

   Svarar med jsonb: {ok, klippkort, kvar, session} eller {fel}. Ett fel
   är ett BESKED till familjen, inte ett undantag — det ska kunna visas
   som det är. */
create function public.klippkort_dra(p_pass uuid, p_foralder uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  b      public.bookings;
  behov  int;
  kort   record;
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
  /* Erbjudandena gäller ett barn per pass. Tillägget för syskon är ett
     eget pris, och ett klippkort för ett barn hade annars betalat det
     med timmar som kostat mindre. */
  if coalesce(b.antal_barn, 1) > 1 then
    return jsonb_build_object('fel', 'Timmarna gäller pass med ett barn. Det här passet betalas med kort.');
  end if;

  behov := greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0))::int;

  /* Alla familjens kort låses FÖRST, och timmarna räknas i en egen sats
     efteråt. I read committed får varje sats en ny ögonblicksbild, så
     två samtidiga dragningar ser varandras timmar. Räknades de i samma
     sats som låset hade den andra kunnat dra på ett saldo som redan
     var förbrukat. */
  perform 1 from public.klippkort where parent_id = p_foralder and status = 'betald' for update;

  /* Kortet som går ut först, så att inga timmar blir kvar på ett kort
     som hinner gå ut. Passets dag ska ligga inom giltigheten. */
  select k.id, k.timmar - coalesce((
           select sum(greatest(1, ceil(coalesce(x.duration_min, 60) / 60.0)))::int
             from public.bookings x
            where x.klippkort_id = k.id and x.status <> 'cancelled'), 0) as kvar
    into kort
    from public.klippkort k
   where k.parent_id = p_foralder
     and k.status = 'betald'
     and k.giltigt_till >= b.wanted_date
     and k.giltigt_till >= (now() at time zone 'Europe/Stockholm')::date
     and k.timmar - coalesce((
           select sum(greatest(1, ceil(coalesce(x.duration_min, 60) / 60.0)))::int
             from public.bookings x
            where x.klippkort_id = k.id and x.status <> 'cancelled'), 0) >= behov
   order by k.giltigt_till, k.created_at
   limit 1;

  if not found then
    return jsonb_build_object('fel', 'Ni har inga timmar kvar som räcker till passet, eller som gäller den dagen.');
  end if;

  update public.bookings
     set klippkort_id = kort.id,
         betalning_status = 'betald',
         betald_at = now()
   where id = p_pass;

  return jsonb_build_object('ok', true, 'klippkort', kort.id, 'kvar', kort.kvar - behov,
                            'session', b.stripe_session_id);
end $$;

revoke all on function public.klippkort_dra(uuid, uuid) from public, anon, authenticated;
grant execute on function public.klippkort_dra(uuid, uuid) to service_role;

-- ---------- när köpet är betalt ----------
/* Webhooken anropar den här, med vad Stripe faktiskt drog. Datumet
   räknas här, i Stockholmstid, så att "en månad" betyder samma sak som
   i kalendern familjen tittar på. Bara ett köp som väntar blir betalt:
   två leveranser av samma händelse ger en ändring, inte två. */
create function public.klippkort_betald(
  p_id uuid, p_betalt int, p_pi text, p_charge text, p_bt text, p_avgift int, p_netto int)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update public.klippkort
     set status = 'betald',
         betald_at = now(),
         giltigt_till = ((now() at time zone 'Europe/Stockholm')::date
                         + make_interval(months => giltig_manader))::date,
         betalt_ore = p_betalt,
         stripe_payment_intent_id = p_pi,
         stripe_charge_id = p_charge,
         stripe_balanstransaktion_id = p_bt,
         stripe_avgift_ore = p_avgift,
         stripe_netto_ore = p_netto,
         aterbetald_ore = 0
   where id = p_id and status in ('vantar', 'misslyckad');
  return found;
end $$;

revoke all on function public.klippkort_betald(uuid, int, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.klippkort_betald(uuid, int, text, text, text, int, int) to service_role;

-- ---------- strömbrytaren ----------
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('erbjudanden', false,
   'Planer och klippkort går att köpa i studievyn, och pass går att betala med köpta timmar. Av: erbjudandena syns men går inte att köpa.',
   'Samma provbetalning som kortspärren väntar på (DEPLOY-BETALNING.md, avsnitt 9), och stripe-webhook driftsatt FÖRE stripe-checkout och klippkort-betala: en äldre webhook känner inte igen ett köpt klippkort och kvitterar betalningen utan att skriva ner den.');
