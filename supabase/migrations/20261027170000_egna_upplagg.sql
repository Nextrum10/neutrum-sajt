-- ============================================================
-- NEXTRUM — egna upplägg som admin skickar till en familj (2026-10-27)
--
-- Leo: "gör en funktion att admin kan skicka egna upplägg att köpa, det
-- är tex så att admin säljer 6 h till familjen därför att det är lov och
-- då skickar vi ett upplägg, villkoren är samma men det är bara 6h
-- istället."
--
-- ETT UPPLÄGG ÄR EN PLAN MED ETT ANNAT ANTAL TIMMAR. Admin skickar det
-- till en familj (skicka_eget_upplagg(), bara is_admin()): ett namn,
-- 1–40 timmar och ett timpris i hela kronor, högst ordinarie timpris, och
-- hur länge familjen kan köpa det. Familjen ser det under Betalning &
-- planer och köper det med Köp, som en plan, med kort eller Klarna. Köpet
-- är en rad i klippkort med erbjudandet plan_eget och sorten plan, så det
-- som gäller en plan gäller upplägget: 30 dagar från betalningen
-- (klippkort_betald), timbanken, ordningen timmarna dras i, påminnelsen
-- tio dagar innan, första timmen gratis för den första planen familjen
-- köper, ångerrätten, Att sluta och återbetalningen under Liggaren.
--
-- Tre saker skiljer det från en plan i katalogen, och villkoren säger dem
-- (version 2026-10-27, #eget-upplagg):
--   · priset är upplägget, inte katalogens: timpriset gånger timmarna,
--     och familjerabatten dras på varje timme som på en plan;
--   · ingen rabattkod gäller det (intern.kod_galler_kopet, och
--     intern.klippkort_rabatt tar bort en kod som ändå följer med);
--   · till ett upplägg köper man inte till timmar (extra_timmar_erbjudande
--     väljer bara en plan ur katalogen): annars hade ett lovpris följt med
--     till tjugo timmar till.
--
-- Upplägget står fast när det skickats: bara att det köpts eller dragits
-- tillbaka skrivs (intern.egna_upplagg_vakt). Ett köp som betalas för ett
-- upplägg som redan köpts eller dragits tillbaka (två kassor, eller en
-- kassa som stod öppen) står som köpt, och en uppgift säger att admin ska
-- avgöra det. Ingen mejl går av sig själv: adminvyn har en länk till Gmail
-- med texten (mejl från adminvyn skrivs i Gmail, 2026-10-11).
--
-- Funktionerna som fanns lappas med replace() och en vakt som räknar
-- träffarna, och en kropp som redan bär ändringen släpps igenom: filen
-- går att köra två gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $vakt$
begin
  if to_regprocedure('public.klippkort_betald(uuid, integer, text, text, text, integer, integer, boolean)') is null then
    raise exception 'klippkort_betald saknas. Läs driften.';
  end if;
  if to_regprocedure('intern.familjerabatt(uuid)') is null then
    raise exception 'Familjerabatterna saknas. Kör familjerabatter först.';
  end if;
  -- Villkoren skrevs mot versionen 2026-10-26 (villkoren_utan_fyll_timbanken).
  if intern.villkor_version() not in ('2026-10-26', '2026-10-27') then
    raise exception 'Villkorens version är %, inte 2026-10-26 som den här filen utgår från. Läs driften.',
      intern.villkor_version();
  end if;
end $vakt$;


-- ---------- 1. katalogens rad ----------
/* Köpet pekar på katalogen (klippkort_erbjudande_fkey), som timmar till en
   plan och gratistimmarna gör. Raden säljs aldrig: den står inte aktiv, så
   den finns inte i erbjudanden_pris, på prissidan eller i studievyns
   planer, och villkoret nedan håller den så. */
insert into public.erbjudanden (kod, sort, namn, timmar, rabatt_procent, giltig_manader, ordning, aktiv, timmar_pa_kopet)
values ('plan_eget', 'plan', 'Eget upplägg', 1, 0, 1, 900, false, 0)
on conflict (kod) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.erbjudanden'::regclass
                  and conname = 'erbjudanden_eget_saljs_inte') then
    alter table public.erbjudanden add constraint erbjudanden_eget_saljs_inte check (kod <> 'plan_eget' or not aktiv);
  end if;
end $$;


-- ---------- 2. upplägget ----------
create table if not exists public.egna_upplagg (
  id             uuid primary key default gen_random_uuid(),
  familj         uuid not null references public.profiles(id) on delete cascade,
  namn           text not null check (char_length(btrim(namn)) between 1 and 60),
  timmar         integer not null check (timmar between 1 and 40),
  timpris_ore    integer not null check (timpris_ore >= 100 and timpris_ore % 100 = 0),
  pris_ore       integer not null,
  -- Sista dagen familjen kan köpa det, i Stockholms tid. Inte hur länge timmarna gäller: det gör planens 30 dagar.
  giltigt_till   date not null,
  skapad_av      uuid references public.profiles(id) on delete set null,
  skapad_at      timestamptz not null default now(),
  aterkallad_at  timestamptz,
  kopt_at        timestamptz,
  klippkort_id   uuid references public.klippkort(id) on delete set null,
  constraint egna_upplagg_pris check (pris_ore = timmar * timpris_ore)
);
create index if not exists egna_upplagg_familj on public.egna_upplagg (familj, skapad_at desc);

comment on table public.egna_upplagg is
  '2026-10-27 (egna_upplagg). Ett upplägg admin skickat till en familj: en plan med ett eget antal timmar och timpris, '
  'som familjen köper under Betalning & planer. Står fast när det skickats; bara att det köpts eller dragits tillbaka '
  'skrivs. Familjen läser sina, admin alla. Skrivs bara av skicka_eget_upplagg(), aterkalla_eget_upplagg() och '
  'databasen när köpet blir betalt.';

-- Köpet som upplägget blev (2026-10-27). Bara ett köp av plan_eget har ett.
alter table public.klippkort add column if not exists upplagg_id uuid
  references public.egna_upplagg(id) on delete set null;
create index if not exists klippkort_upplagg on public.klippkort (upplagg_id) where upplagg_id is not null;
comment on column public.klippkort.upplagg_id is
  '2026-10-27 (egna_upplagg). Upplägget köpet gäller, för erbjudandet plan_eget. Null för allt annat.';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_upplagg_bara_eget') then
    alter table public.klippkort add constraint klippkort_upplagg_bara_eget
      check (upplagg_id is null or erbjudande = 'plan_eget');
  end if;
end $$;

/* Upplägget står fast. Det som får ändras är att det köptes (kopt_at och
   köpet, en gång) och att det drogs tillbaka (aterkallad_at, en gång),
   och köpet blir null när det tas bort (on delete set null). */
create or replace function intern.egna_upplagg_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- egna_upplagg (2026-10-27).
begin
  if tg_op = 'INSERT' then
    if new.aterkallad_at is not null or new.kopt_at is not null or new.klippkort_id is not null then
      raise exception using errcode = '42501', message = 'Ett nytt upplägg är inte köpt och inte tillbakadraget.';
    end if;
    new.skapad_at := now();
    return new;
  end if;
  if (new.id, new.familj, new.namn, new.timmar, new.timpris_ore, new.pris_ore, new.giltigt_till, new.skapad_at)
     is distinct from
     (old.id, old.familj, old.namn, old.timmar, old.timpris_ore, old.pris_ore, old.giltigt_till, old.skapad_at)
     or (new.skapad_av is distinct from old.skapad_av and new.skapad_av is not null) then
    raise exception using errcode = '42501', message = 'Ett upplägg står fast när det skickats.';
  end if;
  if old.aterkallad_at is not null and new.aterkallad_at is distinct from old.aterkallad_at then
    raise exception using errcode = '42501', message = 'Ett upplägg dras tillbaka en gång.';
  end if;
  if old.kopt_at is not null and new.kopt_at is distinct from old.kopt_at then
    raise exception using errcode = '42501', message = 'Ett upplägg köps en gång.';
  end if;
  if new.klippkort_id is distinct from old.klippkort_id
     and not (old.klippkort_id is null and new.kopt_at is not null)
     and new.klippkort_id is not null then
    raise exception using errcode = '42501', message = 'Köpet skrivs när upplägget köps.';
  end if;
  return new;
end $function$;

revoke all on function intern.egna_upplagg_vakt() from public, anon, authenticated;

create or replace trigger egna_upplagg_vakt
  before insert or update on public.egna_upplagg
  for each row execute function intern.egna_upplagg_vakt();


-- ---------- 3. admin skickar och drar tillbaka ----------
/* Ett upplägg till en familj. Timpriset är hela kronor, minst 1 kr och
   högst ordinarie timpris (samma som erbjudanden_pris läser): dyrare än
   pass för pass är inget upplägg. Familjen kan köpa det i p_dagar dagar
   (1–60, i Stockholms tid). Högst fem som väntar per familj. Svarar id:t. */
create or replace function public.skicka_eget_upplagg(
  p_familj uuid, p_timmar integer, p_timpris_ore integer, p_namn text default null, p_dagar integer default 14)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- egna_upplagg (2026-10-27).
declare
  idag      date := (now() at time zone 'Europe/Stockholm')::date;
  ordinarie integer;
  namn      text;
  ny        uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum skickar ett upplägg.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_familj and p.role = 'parent' and p.raderad_at is null) then
    raise exception using errcode = '22023', message = 'Familjen finns inte.';
  end if;
  if p_timmar is null or p_timmar < 1 or p_timmar > 40 then
    raise exception using errcode = '22023', message = 'Välj mellan 1 och 40 timmar.';
  end if;
  select t.pris_per_timme_ore into ordinarie
    from public.tjanster t where t.aktiv and t.for_kund order by t.ordning, t.kod limit 1;
  if ordinarie is null or ordinarie <= 0 then
    raise exception using errcode = '22023', message = 'Läxhjälpen saknar ett timpris. Sätt det under Tjänster först.';
  end if;
  if p_timpris_ore is null or p_timpris_ore % 100 <> 0 or p_timpris_ore < 100 or p_timpris_ore > ordinarie then
    raise exception using errcode = '22023',
      message = format('Timpriset är hela kronor, från 1 kr till ordinarie timpris, %s kr.', ordinarie / 100);
  end if;
  if p_dagar is null or p_dagar < 1 or p_dagar > 60 then
    raise exception using errcode = '22023', message = 'Familjen kan köpa upplägget i 1–60 dagar.';
  end if;
  namn := left(coalesce(nullif(btrim(p_namn), ''), p_timmar || case when p_timmar = 1 then ' timme' else ' timmar' end), 60);

  perform pg_advisory_xact_lock(hashtextextended('upplagg:' || p_familj::text, 0));
  if (select count(*) from public.egna_upplagg u
       where u.familj = p_familj and u.aterkallad_at is null and u.kopt_at is null and u.giltigt_till >= idag) >= 5 then
    raise exception using errcode = '22023', message = 'Familjen har redan fem upplägg som väntar. Dra tillbaka ett först.';
  end if;

  insert into public.egna_upplagg (familj, namn, timmar, timpris_ore, pris_ore, giltigt_till, skapad_av)
  values (p_familj, namn, p_timmar, p_timpris_ore, p_timmar * p_timpris_ore, idag + p_dagar, auth.uid())
  returning id into ny;
  return ny;
end $function$;

/* Ett upplägg som inte köpts dras tillbaka: familjen ser det inte längre
   och kan inte köpa det. En kassa som redan står öppen för det går ut av
   sig själv; betalas den ändå står köpet, och en uppgift säger det. */
create or replace function public.aterkalla_eget_upplagg(p_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- egna_upplagg (2026-10-27).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum drar tillbaka ett upplägg.';
  end if;
  update public.egna_upplagg set aterkallad_at = now()
   where id = p_id and aterkallad_at is null and kopt_at is null;
  return found;
end $function$;

revoke all on function public.skicka_eget_upplagg(uuid, integer, integer, text, integer) from public, anon;
revoke all on function public.aterkalla_eget_upplagg(uuid) from public, anon;
grant execute on function public.skicka_eget_upplagg(uuid, integer, integer, text, integer) to authenticated;
grant execute on function public.aterkalla_eget_upplagg(uuid) to authenticated;


-- ---------- 4. familjen köper ----------
/* Kassan (stripe-checkout, med tjänstekontot, efter att den läst
   upplägget med familjens token): köpet i klippkort, eller ett väntande
   köp av samma upplägg till samma pris, yngre än 23 timmar (samma
   idempotensnyckel hos Stripe, som för en plan). Priset är upplägget:
   timpriset minus familjerabatten (när den lämnar ett pris kvar), gånger
   timmarna. Villkoren prövas av köpets egen trigger (klippkort_kraver_villkor).
   Svarar {ok, klippkort, belopp_ore, familjerabatt_ore, namn, timmar,
   timpris_ore, aterbruk} eller {fel} med ett besked till familjen. */
create or replace function public.eget_upplagg_kop(p_upplagg uuid, p_familj uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- egna_upplagg (2026-10-27).
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  u     public.egna_upplagg%rowtype;
  d     integer;
  pris  integer;
  k     public.klippkort%rowtype;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan köper ett upplägg.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('upplagg:' || coalesce(p_familj::text, ''), 0));
  select * into u from public.egna_upplagg where id = p_upplagg for update;
  if not found or u.familj is distinct from p_familj then
    return jsonb_build_object('fel', 'Upplägget finns inte bland era.');
  end if;
  if u.kopt_at is not null then
    return jsonb_build_object('fel', 'Ni har redan köpt upplägget. Timmarna står i er timbank.');
  end if;
  if u.aterkallad_at is not null or u.giltigt_till < idag then
    return jsonb_build_object('fel', 'Upplägget går inte att köpa längre. Skriv till oss, så ordnar vi ett nytt.');
  end if;

  d := intern.familjerabatt(p_familj);
  if not (d > 0 and d < u.timpris_ore) then
    d := 0;
  end if;
  pris := (u.timpris_ore - d) * u.timmar;

  select * into k from public.klippkort x
   where x.upplagg_id = u.id and x.parent_id = p_familj and x.status = 'vantar'
     and x.begart_ore = pris and coalesce(x.familjerabatt_ore, 0) = d
     and x.created_at > now() - interval '23 hours'
   order by x.created_at desc
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'klippkort', k.id, 'belopp_ore', k.begart_ore, 'familjerabatt_ore', d,
                              'namn', u.namn, 'timmar', u.timmar, 'timpris_ore', u.timpris_ore, 'aterbruk', true);
  end if;

  insert into public.klippkort (parent_id, erbjudande, namn, sort, timmar, timmar_pa_kopet, giltig_manader,
                                rabatt_procent, timpris_ore, begart_ore, familjerabatt_ore, upplagg_id)
  values (p_familj, 'plan_eget', u.namn, 'plan', u.timmar, 0, 1, 0, u.timpris_ore, pris, nullif(d, 0), u.id)
  returning * into k;
  return jsonb_build_object('ok', true, 'klippkort', k.id, 'belopp_ore', k.begart_ore, 'familjerabatt_ore', d,
                            'namn', u.namn, 'timmar', u.timmar, 'timpris_ore', u.timpris_ore, 'aterbruk', false);
end $function$;

revoke all on function public.eget_upplagg_kop(uuid, uuid) from public, anon, authenticated;
grant execute on function public.eget_upplagg_kop(uuid, uuid) to service_role;

/* Köpet blev betalt: upplägget är köpt. Var det redan köpt (två kassor)
   eller tillbakadraget (kassan stod öppen) står köpet ändå, för pengarna
   kom, och en uppgift säger vad admin ska avgöra. */
create or replace function intern.eget_upplagg_kopt()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- egna_upplagg (2026-10-27).
declare
  u public.egna_upplagg%rowtype;
begin
  select * into u from public.egna_upplagg where id = new.upplagg_id for update;
  if not found then
    return null;
  end if;
  if u.kopt_at is not null then
    perform public.skapa_uppgift(
      'Ett eget upplägg betalades två gånger',
      'eget_upplagg_dubbel:' || new.id,
      'problem',
      'Familjen betalade samma upplägg i två kassor, och timmarna från båda köpen står i timbanken. Hör av er '
        || 'till familjen och betala tillbaka det ena köpet under Betalningar → Liggaren.',
      'profiles', new.parent_id::text);
    return null;
  end if;
  update public.egna_upplagg set kopt_at = now(), klippkort_id = new.id where id = u.id;
  if u.aterkallad_at is not null then
    perform public.skapa_uppgift(
      'Ett upplägg betalades efter att det dragits tillbaka',
      'eget_upplagg_aterkallat:' || new.id,
      'kontroll',
      'Familjen hade kassan öppen och betalade upplägget efter att ni dragit tillbaka det. Timmarna står i '
        || 'timbanken. Hör av er till familjen, och betala tillbaka köpet under Liggaren om det inte ska gälla.',
      'profiles', new.parent_id::text);
  end if;
  return null;
end $function$;

revoke all on function intern.eget_upplagg_kopt() from public, anon, authenticated;

create or replace trigger klippkort_upplagg_kopt
  after update of status on public.klippkort
  for each row
  when (new.status = 'betald' and old.status is distinct from 'betald' and new.upplagg_id is not null)
  execute function intern.eget_upplagg_kopt();


-- ---------- 5. priset är upplägget, och ingen kod ----------
/* intern.klippkort_rabatt räknar ett köp ur katalogen. Upplägget står
   inte i erbjudanden_pris, och dess pris och familjerabatt räknas i
   eget_upplagg_kop(): triggern lämnar dem och tar bort en kod, som för
   timmar till en plan. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$  if new.erbjudande = 'plan_extra' then$a$;
  b1 text := $b$  -- egna_upplagg (2026-10-27): ett eget upplägg räknas i eget_upplagg_kop(), som timmar till en plan.
  if new.erbjudande in ('plan_extra', 'plan_eget') then$b$;
begin
  fore := pg_get_functiondef('intern.klippkort_rabatt()'::regprocedure);
  if position('egna_upplagg' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'klippkort_rabatt: % träffar på timmar till en plan. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;

-- Ingen rabattkod på ett upplägg: det har redan sitt pris.
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$  select exists (select 1 from public.erbjudanden e where e.kod = p_erbjudande and e.sort = 'plan')$a$;
  b1 text := $b$  -- egna_upplagg (2026-10-27): inte ett eget upplägg, som har sitt eget pris.
  select exists (select 1 from public.erbjudanden e where e.kod = p_erbjudande and e.sort = 'plan'
                   and e.kod <> 'plan_eget')$b$;
begin
  fore := pg_get_functiondef('intern.kod_galler_kopet(text)'::regprocedure);
  if position('egna_upplagg' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'kod_galler_kopet: % träffar på planen. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;

-- Timmar köps till en plan ur katalogen, aldrig till ett upplägg: annars hade lovpriset följt med.
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$   where k.parent_id = jag and k.sort = 'plan' and k.status = 'betald'$a$;
  b1 text := $b$   where k.parent_id = jag and k.sort = 'plan' and k.status = 'betald'
     -- egna_upplagg (2026-10-27): aldrig till ett eget upplägg.
     and k.erbjudande is distinct from 'plan_eget'$b$;
begin
  fore := pg_get_functiondef('public.extra_timmar_erbjudande(integer)'::regprocedure);
  if position('egna_upplagg' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'extra_timmar_erbjudande: % träffar på planen. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;


-- ---------- 6. rättigheter ----------
alter table public.egna_upplagg enable row level security;
revoke all on public.egna_upplagg from anon, authenticated;
do $$
declare
  roll text;
begin
  foreach roll in array array['nextrum_barn', 'nextrum_ai'] loop
    if exists (select 1 from pg_roles where rolname = roll) then
      execute format('revoke all on public.egna_upplagg from %I', roll);
    end if;
  end loop;
  -- Inte heller tjänstekontot: kassan köper genom eget_upplagg_kop().
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate on public.egna_upplagg from service_role';
  end if;
end $$;
grant select on public.egna_upplagg to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'egna_upplagg'
                  and policyname = 'familjen läser sina upplägg') then
    create policy "familjen läser sina upplägg" on public.egna_upplagg
      for select to authenticated using (familj = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'egna_upplagg'
                  and policyname = 'admin läser upplägget') then
    create policy "admin läser upplägget" on public.egna_upplagg
      for select to authenticated using (public.is_admin());
  end if;
end $$;


-- ---------- 7. villkoren ----------
/* Version 2026-10-27: punkten Eget upplägg (#eget-upplagg) under Planer
   och timbanken. Alla får frågan igen vid nästa inloggning, och ingen
   föreslår pass eller köper timmar innan dess (bookings_kraver_villkor,
   klippkort_kraver_villkor). Den sena avbokningen gäller som förut
   (intern.familjen_har_avbokningsregeln jämför med >= 2026-10-23). Datumet
   är dagen villkoren går ut; blir det en annan dag byts det här och på
   båda sidorna (kolla-villkor.py). */
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-27'::text $$;
