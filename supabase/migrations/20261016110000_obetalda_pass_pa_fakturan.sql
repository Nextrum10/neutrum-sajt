-- ============================================================
-- NEXTRUM — obetalda pass på månadens faktura (2026-10-15)
--
-- Leo 2026-10-01: en familj som har ett pass den 30 september och
-- bekräftar i oktober "ska inte kunna välja hur de betalar utan bekräftar
-- de inte läggs det automatiskt på faktura". Beslutat då, byggt nu.
--
-- Ett pass som hållits och rapporterats, som kostar något och som inte är
-- betalt när månaden faktureras, läggs på familjens faktura av sig själv.
-- Månadskörningen (fakturering, natten efter månaden och sedan varje natt
-- för sent rapporterade pass) frågar fakturera_obetalda() innan den väljer
-- fakturapassen. Det är samma pass som avvikelsen Inte betalt räknar
-- (avvikelser_rader, ej_betalt), med fyra undantag:
--
--   · en kassa som kan stå öppen ('vantar', öppnad för mindre än 25
--     timmar sedan): betalningen kan vara på väg, och passet prövas igen
--     nästa natt. En kassa hos Stripe lever högst ett dygn
--   · ett kort som ska betala passet: kortjobbet drar eller debiterar det
--     (reserverat, draget, på väg att släppas, eller valt med ett sparat
--     kort och strömbrytaren kortreservation på), som kortreservation_att_gora
--   · faktura som inte är tillåten: strömbrytaren faktura av, eller
--     familjen spärrad (intern.faktura_tillaten). Passet står kvar som
--     Inte betalt, som förut
--   · ett pass som bokades innan familjen godkänt villkoren som säger det
--     här (version 2026-10-16, intern.obetalda_faktureras_fran): det
--     avtalet slöts med de gamla villkoren, där familjen valde själv
--
-- Bara pass före periodens slut. Månaden som pågår faktureras aldrig
-- (fakturering svarar 409), så ett pass läggs på fakturan först när dess
-- månad är slut. Kortet går att välja tills passet står på en faktura, som
-- förut (stripe-checkout).
--
-- Villkoren säger det i versionen 2026-10-16, samma som familjerabattens
-- punkt (villkoren_familjerabatt, PR #302), som gick ut samma förmiddag.
-- Ingen hade godkänt den versionen när meningen kom till på sidan (Leo:
-- "merga bara och fixa villkoren"), så den som godkänner 2026-10-16 har
-- sett den. Versionen står därför kvar, och vakten kräver att ingen har
-- godkänt den. Meningen om betalningen säger det på alla ställen
-- (kolla-betalningsvillkor.py). Filen tar inte bort något och kan köras
-- hel i ett do-block (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
begin
  -- Exakt 2026-10-16, och ingen har godkänt den. Familjerabattens punkt
  -- gick ut med den versionen samma förmiddag, före meningen om fakturan:
  -- den som godkänt 2026-10-16 innan dess har aldrig sett meningen, och
  -- obetalda_faktureras_fran() skulle räkna den som att den gjort det.
  -- Stannar vakten här får meningen ett eget, senare datum
  -- (DEPLOY-BETALNING.md 9.17).
  if intern.villkor_version() <> '2026-10-16' then
    raise exception 'Villkorens version är %, inte 2026-10-16. Läs driften och skriv om migrationen.',
      intern.villkor_version();
  end if;
  if exists (select 1 from public.villkor_godkannanden where version >= '2026-10-16') then
    raise exception 'Någon har redan godkänt villkor 2026-10-16. Meningen om fakturan behöver ett eget datum.';
  end if;
  -- Avsnitt 5 skriver om mitt_villkorslage() hel: kroppen ska vara den
  -- villkoren_godkanns skrev.
  if (select md5(p.prosrc) from pg_proc p where p.oid = 'public.mitt_villkorslage()'::regprocedure)
     <> '7b64c1bced9291a027930889ef3cf39e' then
    raise exception 'mitt_villkorslage() är inte den som lästes. Läs driften och skriv om migrationen.';
  end if;
end $$;


-- ---------- 1. från vilken version ----------
/* Versionen av villkoren som säger att ett obetalt pass läggs på
   fakturan. Ett pass faktureras av sig själv bara om familjen godkänt
   den, eller en senare, innan passet bokades. intern.villkor_version()
   står kvar på 2026-10-16 (villkoren_familjerabatt): sidan bytte text
   innan någon godkänt den versionen (avsnitt 0). */
create or replace function intern.obetalda_faktureras_fran()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-16'::text $$;

-- Inloggade får läsa den, som villkor_version(): mitt_villkorslage() körs
-- som den som frågar (avsnitt 5).
revoke all on function intern.obetalda_faktureras_fran() from public, anon;
grant execute on function intern.obetalda_faktureras_fran() to authenticated, service_role;


-- ---------- 2. när kassan öppnades ----------
/* Passet står som 'vantar' från att stripe-checkout öppnar kassan tills
   webhooken skriver betalningen eller ett nekat kort. En kassa som bara
   stängs, eller går ut efter ett dygn, lämnar passet där: ingen händelse
   skriver om det. Utan en tid hade ett pass där familjen öppnat kassan och
   gått därifrån aldrig kommit med på fakturan.

   Triggern skriver när kassan öppnades, och skriver om tiden bara när en
   ny kassa öppnas (ett nytt sessions-id). Stripe lämnar ut samma kassa
   igen för samma nyckel, och den har kvar sin första tid. En kassa lever
   som mest 24 timmar efter att den skapats (Stripes expires_at), och den
   skapas innan raden skrivs: en kassa som öppnades för mer än 25 timmar
   sedan kan inte betalas. */
create table if not exists intern.kassan_oppnad (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  session_id text,
  oppnad_at  timestamptz not null default now()
);
alter table intern.kassan_oppnad enable row level security;
revoke all on intern.kassan_oppnad from public, anon, authenticated;

create or replace function intern.kassan_oppnades()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into intern.kassan_oppnad (booking_id, session_id, oppnad_at)
  values (new.id, new.stripe_session_id, now())
  on conflict (booking_id) do update
    set session_id = excluded.session_id, oppnad_at = excluded.oppnad_at;
  return null;
end $$;

revoke all on function intern.kassan_oppnades() from public, anon, authenticated;

-- Efter skrivningen, så att den inte rör ordningen bland
-- before-triggrarna (bookings_timmarna_tillbaka står sist).
create or replace trigger bookings_kassan_oppnad
  after update on public.bookings
  for each row
  when (new.betalning_status = 'vantar'
        and (old.betalning_status is distinct from 'vantar'
             or old.stripe_session_id is distinct from new.stripe_session_id))
  execute function intern.kassan_oppnades();

-- Pass som redan står i 'vantar' har ingen tid. De räknas från nu, så att
-- en kassa som öppnades i går inte läggs på en faktura i natt.
insert into intern.kassan_oppnad (booking_id, session_id, oppnad_at)
select b.id, b.stripe_session_id, now()
  from public.bookings b
 where b.betalning_status = 'vantar'
on conflict (booking_id) do nothing;


-- ---------- 3. vilka pass som läggs på fakturan ----------
/* Allt utom att passet är genomfört, rapporterat, kostar något och inte
   står på en faktura: det prövar avvikelsen ej_betalt. Står i en egen
   funktion för att prövas två gånger, när passen väljs och när de skrivs
   (se fakturera_obetalda). Kortets del är kortreservation_att_gora:s
   regel för vad jobbet drar, debiterar eller släpper. */
create or replace function intern.obetalt_till_fakturan(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (b.betalning_status in ('ingen', 'misslyckad')
          or (b.betalning_status = 'vantar'
              and not exists (select 1 from intern.kassan_oppnad k
                               where k.booking_id = b.id
                                 and k.oppnad_at > now() - interval '25 hours')))
     and intern.faktura_tillaten(b.parent_id)
     and exists (select 1 from public.villkor_godkannanden v
                  where v.anvandare = b.parent_id
                    and v.version >= intern.obetalda_faktureras_fran()
                    and v.godkant_at <= b.created_at)
     and not exists (
       select 1 from public.kortreservationer r
        where r.booking_id = b.id
          and (r.lage in ('reserverad', 'dragen', 'slapps')
               or (r.lage in ('vald', 'utgangen')
                   and intern.kortreservation_pa()
                   and intern.kortet_betalar(b)
                   and exists (select 1 from public.sparade_kort k where k.parent_id = b.parent_id)
                   and exists (select 1 from public.stripe_kunder s where s.parent_id = b.parent_id))))
$$;

revoke all on function intern.obetalt_till_fakturan(public.bookings) from public, anon, authenticated;


-- ---------- 4. passen läggs på fakturan ----------
/* Månadskörningen anropar den med tjänstekontot innan den väljer
   fakturapassen, och med p_torr när den torrkör: då svarar den med
   passen utan att skriva. p_fore är första dagen efter perioden. Svaret
   är en lista med passens id, som jsonb, så att PostgREST lämnar ut den
   som den är.

   Passen låses när de väljs, och prövas igen när de skrivs. En kassa som
   öppnas under tiden väntar på låset och ser sedan ett fakturapass
   (stripe-checkout stänger den och svarar 409), och en betalning som kom
   före låset står i raden när den prövas igen. */
create or replace function public.fakturera_obetalda(p_fore date, p_torr boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  if coalesce(nullif(auth.role(), ''), 'service_role') <> 'service_role' then
    raise exception 'Bara månadskörningen lägger pass på fakturan.' using errcode = '42501';
  end if;
  if p_fore is null then
    raise exception 'Ange första dagen efter perioden.' using errcode = '22023';
  end if;

  select coalesce(array_agg(x.id order by x.wanted_date, x.id), '{}') into ids
    from (select b.id, b.wanted_date
            from public.avvikelser_rader() a
            join public.bookings b on b.id::text = a.objekt_id
           where a.typ = 'ej_betalt'
             and b.wanted_date < p_fore
             and intern.obetalt_till_fakturan(b)
             for update of b) x;

  if p_torr or cardinality(ids) = 0 then
    return to_jsonb(ids);
  end if;

  with skrivna as (
    update public.bookings b
       set betalning_status = 'faktura'
     where b.id = any (ids)
       and intern.obetalt_till_fakturan(b)
    returning b.id, b.wanted_date
  )
  select coalesce(array_agg(s.id order by s.wanted_date, s.id), '{}') into ids from skrivna s;
  return to_jsonb(ids);
end $$;

revoke execute on function public.fakturera_obetalda(date, boolean) from public, anon, authenticated;
grant execute on function public.fakturera_obetalda(date, boolean) to service_role;

comment on function public.fakturera_obetalda(date, boolean) is
  'obetalda_pass_pa_fakturan (2026-10-15). Lägger hållna, rapporterade och obetalda pass före p_fore på '
  'fakturan (betalning_status faktura), utom med en kassa som kan stå öppen, ett kort som betalar, faktura '
  'som inte är tillåten eller ett pass bokat innan familjen godkänt version 2026-10-16. p_torr svarar utan '
  'att skriva. Bara månadskörningen (tjänstekontot).';


-- ---------- 5. vyn ser vilka pass det gäller ----------
/* mitt_villkorslage() svarar också när kontot först godkände en version
   som säger att obetalda pass läggs på fakturan (obetalda_fran). Passets
   sida och Bekräfta rapport säger det då bara om pass det gäller: de som
   bokats efter det. Resten är som villkoren_godkanns skrev den. */
create or replace function public.mitt_villkorslage()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'version', intern.villkor_version(),
    'godkant_at', (select g.godkant_at from public.villkor_godkannanden g
                    where g.anvandare = (select auth.uid()) and g.version = intern.villkor_version()),
    'tidigare', exists (select 1 from public.villkor_godkannanden g
                         where g.anvandare = (select auth.uid()) and g.version <> intern.villkor_version()),
    'obetalda_fran', (select min(g.godkant_at) from public.villkor_godkannanden g
                       where g.anvandare = (select auth.uid())
                         and g.version >= intern.obetalda_faktureras_fran()))
$$;
