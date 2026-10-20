-- ============================================================
-- Kortdragningen försöker igen, larmar efter ett dygn och väcks direkt
-- (2026-10-21, Fas 3.3)
--
-- Beställningen (Leo, 2026-10-21), för passen som betalas med det
-- sparade kortet: reservation 48 timmar före passet, direkt om passet
-- bokas närmare än så, dragning när passet är genomfört, och en ny
-- dragning utan familjen om reservationen hunnit gå ut. Nekas kortet
-- får familjen ett mejl med en länk dit kortet byts, vi försöker igen,
-- och efter ett dygn får vi en uppgift. Passet avbokas aldrig för att
-- betalningen inte gick. En konstant sen_avbokning_timmar, 0 som förval.
--
-- Det mesta fanns (kortet_reserveras, 2026-10-13): reservationen,
-- dragningen, dragningen utan reservation (debitera), släppet och
-- mejlet. Det här lägger till:
--
--   1. betalning_installning: en rad med inställningarna för kortet,
--      på ett ställe: hur många automatiska försök (3, alltså två nya
--      efter det första), timmar mellan dem (6), när vi larmas (24) och
--      sen_avbokning_timmar (0). Den sista är låst på 0, som kortsparr:
--      villkoren har ingen avbokningsavgift, och höjs den behövs nya
--      villkor och en väg att dra en sent avbokad reservation. Med 0
--      släpps reservationen för ett avbokat pass, som förut.
--   2. kortreservationer.nekad_sedan: när kortet nekades första gången
--      i en serie. Sätts när läget blir misslyckad, står kvar under de
--      nya försöken och töms när en reservation eller dragning går
--      igenom eller släpps.
--   3. intern.kortreservation_forsok_igen(): körs varje gång jobbet
--      väcks (var tionde minut). Ett nekat kort med en kod där ett nytt
--      försök kan gå (card_declined, insufficient_funds med flera, inte
--      authentication_required eller ett utgånget kort) blir valt igen
--      efter sex timmar, högst tills tre försök gjorts; jobbet
--      reserverar eller drar då som vanligt. Har kortet varit nekat i
--      ett dygn och passet fortfarande ska betalas med det blir det en
--      uppgift till oss (skapa_uppgift, en per serie).
--   4. Mejlet till familjen går en gång per serie: vid första nekandet
--      (forsok = 1), inte vid de automatiska försöken. Familjens egna
--      försök (Försök igen, ett nytt kort) börjar en ny serie av mejl.
--      Mejlet säger att vi försöker igen bara när vi gör det (kortet:
--      'igen', intern.kortet_provas_igen, samma regel som jobbet).
--   5. intern.kortreservation_vack_nu(): väcker stripe-reservation
--      direkt när ett kort väljs eller ett pass bekräftas eller blir
--      genomfört och något ska göras nu, i stället för vid nästa
--      tiotal minuter. Anropet köas av pg_net efter att transaktionen
--      gått igenom.
--   6. kortreservation_forsok_nu(): admin försöker igen direkt från
--      listan över nekade kort i adminvyn.
--
-- Ingen betalning avbokar ett pass: inget i den här filen eller i
-- kortet_reserveras rör bookings.status.
--
-- Vakterna prövar funktionerna mot driften som den byggs ur
-- migrationerna (md5), och en kropp som redan bär ändringen släpps
-- igenom, så filen går att köra två gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('intern.kortreservation_vack()',              '9833e602ae5c6a2e9498a1636ad8d18e'),
      ('intern.kortreservation_notis()',             '845b8fddbb9db6f54f117f6ce0f5e6f6'),
      ('public.kortreservation_att_gora(integer)',   '50edfd71140880c3aa079db8035487f4')
    ) as x(fn, summa)
  loop
    def := pg_get_functiondef(f.fn::regprocedure);
    if position('kortdragningen_forsoker_igen' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan kortdragningen skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.fn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 1. inställningarna ----------
create table if not exists public.betalning_installning (
  id                    smallint primary key default 1 check (id = 1),
  automatiska_forsok    integer not null default 3 check (automatiska_forsok between 1 and 10),
  timmar_mellan_forsok  integer not null default 6 check (timmar_mellan_forsok between 1 and 72),
  larm_efter_timmar     integer not null default 24 check (larm_efter_timmar between 1 and 168),
  sen_avbokning_timmar  integer not null default 0,
  andrad_at             timestamptz,
  constraint betalning_installning_sen_avbokning_lst check (sen_avbokning_timmar = 0)
);
insert into public.betalning_installning (id) values (1) on conflict (id) do nothing;

comment on table public.betalning_installning is
  '2026-10-21 (kortdragningen_forsoker_igen). En rad. Hur många gånger ett nekat kort provas (det första försöket '
  'inräknat), timmar mellan försöken, när vi får en uppgift om ett nekat kort, och sen_avbokning_timmar.';
comment on column public.betalning_installning.sen_avbokning_timmar is
  'Timmar före passet då en avbokning räknas som sen och reservationen står kvar i stället för att släppas. Låst på '
  '0 (villkoret betalning_installning_sen_avbokning_lst): villkoren har ingen avbokningsavgift. Höjs den behövs nya '
  'villkor och en väg att dra en sent avbokad reservation, i samma ändring som villkoret tas bort.';

alter table public.betalning_installning enable row level security;
revoke all on public.betalning_installning from anon, authenticated;
grant select on public.betalning_installning to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.betalning_installning from nextrum_barn';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'betalning_installning'
                  and policyname = 'admin läser betalningsinställningen') then
    create policy "admin läser betalningsinställningen" on public.betalning_installning for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;

create or replace function intern.sen_avbokning(b public.bookings)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- kortdragningen_forsoker_igen (2026-10-21). Sant när passet avbokades
  -- närmare passet än sen_avbokning_timmar. Med 0 aldrig.
  select b.status = 'cancelled' and b.avbokad_at is not null
     and coalesce((select i.sen_avbokning_timmar from public.betalning_installning i where i.id = 1), 0) > 0
     and b.avbokad_at > intern.passets_start(b)
         - make_interval(hours => (select i.sen_avbokning_timmar from public.betalning_installning i where i.id = 1))
$function$;
revoke all on function intern.sen_avbokning(public.bookings) from public, anon, authenticated;


-- ---------- 2. när kortet nekades första gången ----------
alter table public.kortreservationer add column if not exists nekad_sedan timestamptz;
comment on column public.kortreservationer.nekad_sedan is
  '2026-10-21 (kortdragningen_forsoker_igen). När kortet nekades första gången i en serie. Står kvar under de nya '
  'försöken och töms när en reservation eller dragning går igenom eller reservationen släpps.';

create or replace function intern.kortreservation_nekad_sedan()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- kortdragningen_forsoker_igen (2026-10-21).
begin
  if new.lage = 'misslyckad' and new.nekad_sedan is null then
    new.nekad_sedan := now();
  elsif new.lage in ('reserverad', 'dragen', 'slappt', 'slapps') then
    new.nekad_sedan := null;
  end if;
  return new;
end $function$;
revoke all on function intern.kortreservation_nekad_sedan() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.kortreservationer'::regclass
                  and tgname = 'kortreservationer_nekad_sedan') then
    create trigger kortreservationer_nekad_sedan
      before insert or update on public.kortreservationer
      for each row execute function intern.kortreservation_nekad_sedan();
  end if;
end $$;


-- ---------- 3. nya försök och larmet ----------
-- Om ett nekat kort provas igen av sig självt: koden säger att ett nytt
-- försök kan gå (inte när banken vill att familjen bekräftar, eller när
-- kortet gått ut), och försöken räcker. Jobbet och mejlet frågar samma
-- funktion, så att mejlet aldrig lovar ett försök som inte görs.
create or replace function intern.kortet_provas_igen(p_fel text, p_forsok integer)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- kortdragningen_forsoker_igen (2026-10-21).
  select coalesce(p_fel, 'nekat') in ('card_declined', 'nekat', 'insufficient_funds', 'generic_decline',
                                      'do_not_honor', 'processing_error', 'try_again_later',
                                      'issuer_not_available', 'card_velocity_exceeded')
     and coalesce(p_forsok, 1) < coalesce((select i.automatiska_forsok from public.betalning_installning i
                                            where i.id = 1), 0)
$function$;
revoke all on function intern.kortet_provas_igen(text, integer) from public, anon, authenticated;

create or replace function intern.kortreservation_forsok_igen()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- kortdragningen_forsoker_igen (2026-10-21). Svarar med antalet rader
-- som blev valda igen.
declare
  ins  public.betalning_installning%rowtype;
  n    integer := 0;
  r    record;
begin
  select * into ins from public.betalning_installning i where i.id = 1;
  if not found or not intern.kortreservation_pa() then
    return 0;
  end if;

  -- Ett nytt försök när koden säger att det kan gå. Ett kort som kräver
  -- att familjen bekräftar, eller som gått ut, nekas igen: där väntar vi
  -- på familjen. Jobbet väcker funktionen själv efteråt, så raderna som
  -- blir valda väcker den inte en gång var (kortreservation_vack_trigger).
  perform set_config('nextrum.kortet_vacks_samlat', 'ja', true);
  update public.kortreservationer kr
     set lage = 'vald', andrad = now()
    from public.bookings b
   where b.id = kr.booking_id
     and kr.lage = 'misslyckad'
     and kr.andrad < now() - make_interval(hours => ins.timmar_mellan_forsok)
     and intern.kortet_provas_igen(kr.fel, kr.forsok)
     and b.status in ('confirmed', 'completed')
     and intern.kortet_betalar(b);
  get diagnostics n = row_count;

  -- Ett dygn: en uppgift till oss, en per serie.
  for r in
    select k.booking_id, k.parent_id, k.nekad_sedan, k.fel, k.forsok, b.wanted_date
      from public.kortreservationer k
      join public.bookings b on b.id = k.booking_id
     where k.nekad_sedan is not null
       and k.nekad_sedan < now() - make_interval(hours => ins.larm_efter_timmar)
       and k.lage in ('misslyckad', 'vald', 'utgangen')
       and intern.kortet_betalar(b)
  loop
    perform public.skapa_uppgift(
      'Kortet har nekats i ett dygn',
      'kort-nekat:' || r.booking_id || ':' || to_char(r.nekad_sedan at time zone 'UTC', 'YYYYMMDDHH24MISS'),
      'problem',
      'Familjens sparade kort nekades för passet den ' || to_char(r.wanted_date, 'YYYY-MM-DD')
        || ' (' || coalesce(r.fel, 'nekat') || ', ' || r.forsok || ' försök). Familjen har fått ett mejl. '
        || 'Passet står kvar: hör av er till familjen, eller försök igen under Betalningar → Kortet.',
      'bookings', r.booking_id::text);
  end loop;
  return n;
end $function$;
revoke all on function intern.kortreservation_forsok_igen() from public, anon, authenticated;

-- Jobbet gör nya försök innan det frågar om något ska göras.
do $$
declare
  def    text;
  gammal text := '  perform intern.kortval_stada();' || chr(10);
  ny     text := '  perform intern.kortval_stada();' || chr(10)
              || '  -- kortdragningen_forsoker_igen (2026-10-21): nekade kort provas igen, och efter ett dygn larmas vi.' || chr(10)
              || '  perform intern.kortreservation_forsok_igen();' || chr(10);
  n int;
begin
  def := pg_get_functiondef('intern.kortreservation_vack()'::regprocedure);
  if position('kortdragningen_forsoker_igen' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'kortreservation_vack: väntade en träff, fick %', n;
  end if;
  execute replace(def, gammal, ny);
end $$;


-- ---------- 4. ett mejl per serie ----------
do $$
declare
  def    text;
  gammal text := '  select * into b from public.bookings where id = new.booking_id;' || chr(10)
              || '  if not found then' || chr(10)
              || '    return null;' || chr(10)
              || '  end if;' || chr(10);
  ny     text := '  -- kortdragningen_forsoker_igen (2026-10-21): ett mejl när kortet nekas första gången, inte' || chr(10)
              || '  -- för de automatiska försöken efter det. Familjens egna försök börjar om på ett.' || chr(10)
              || '  if coalesce(new.forsok, 1) > 1 then' || chr(10)
              || '    return null;' || chr(10)
              || '  end if;' || chr(10)
              || gammal;
  -- Mejlet säger att vi försöker igen bara när vi gör det (kortet_provas_igen).
  gammal2 text := '                     then ''bekrafta'' else ''nekat'' end)));';
  ny2     text := '                     then ''bekrafta''' || chr(10)
               || '                     when intern.kortet_provas_igen(new.fel, new.forsok) then ''igen''' || chr(10)
               || '                     else ''nekat'' end)));';
  n int;
  n2 int;
begin
  def := pg_get_functiondef('intern.kortreservation_notis()'::regprocedure);
  if position('kortdragningen_forsoker_igen' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  n2 := (length(def) - length(replace(def, gammal2, ''))) / length(gammal2);
  if n <> 1 or n2 <> 1 then
    raise exception 'kortreservation_notis: väntade en träff var, fick % och %', n, n2;
  end if;
  execute replace(replace(def, gammal, ny), gammal2, ny2);
end $$;


-- ---------- 5. väck jobbet direkt ----------
create or replace function intern.kortreservation_vack_nu(p_bokning uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- kortdragningen_forsoker_igen (2026-10-21). Väcker stripe-reservation
-- när just det här passet har något att göra nu. pg_net skickar anropet
-- först när transaktionen gått igenom; går den inte igenom skickas inget.
-- Ett fel här stoppar aldrig det som väckte den.
declare
  k public.notis_konfig%rowtype;
begin
  if not exists (select 1 from public.kortreservation_att_gora(200) a where a.booking_id = p_bokning) then
    return;
  end if;
  select * into k from public.notis_konfig where id = 1;
  if k.kortreservation_url is null or k.hemlighet is null then
    return;
  end if;
  perform intern.natanrop(
    mal := 'stripe-reservation',
    url := k.kortreservation_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
exception when others then
  insert into public.notis_fel (kalla, fel)
  values ('kortreservation_vack_nu ' || coalesce(p_bokning::text, ''), left(sqlerrm, 500));
end $function$;
revoke all on function intern.kortreservation_vack_nu(uuid) from public, anon, authenticated;

create or replace function intern.kortreservation_vack_trigger()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- kortdragningen_forsoker_igen (2026-10-21).
begin
  if coalesce(current_setting('nextrum.kortet_vacks_samlat', true), '') = 'ja' then
    return null;
  end if;
  if tg_table_name = 'kortreservationer' then
    perform intern.kortreservation_vack_nu(new.booking_id);
  elsif exists (select 1 from public.kortreservationer r where r.booking_id = new.id) then
    perform intern.kortreservation_vack_nu(new.id);
  end if;
  return null;
end $function$;
revoke all on function intern.kortreservation_vack_trigger() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.kortreservationer'::regclass
                  and tgname = 'kortreservationer_vack') then
    create trigger kortreservationer_vack
      after insert or update of lage on public.kortreservationer
      for each row when (new.lage = 'vald')
      execute function intern.kortreservation_vack_trigger();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.bookings'::regclass
                  and tgname = 'bookings_vacker_kortet') then
    create trigger bookings_vacker_kortet
      after update of status on public.bookings
      for each row when (new.status in ('confirmed', 'completed') and new.status is distinct from old.status)
      execute function intern.kortreservation_vack_trigger();
  end if;
end $$;


-- ---------- 6. en sen avbokning släpps inte (låst av med 0) ----------
do $$
declare
  def    text;
  gammal text := '             when x.lage = ''reserverad'' and not intern.kortet_betalar(x.pass) then ''slapp''';
  ny     text := '             -- kortdragningen_forsoker_igen (2026-10-21): en sen avbokning släpps inte (sen_avbokning_timmar, 0).' || chr(10)
              || '             when x.lage = ''reserverad'' and not intern.kortet_betalar(x.pass)' || chr(10)
              || '                  and not intern.sen_avbokning(x.pass) then ''slapp''';
  n int;
begin
  def := pg_get_functiondef('public.kortreservation_att_gora(integer)'::regprocedure);
  if position('kortdragningen_forsoker_igen' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'kortreservation_att_gora: väntade en träff, fick %', n;
  end if;
  execute replace(def, gammal, ny);
end $$;


-- ---------- 7. admin försöker igen ----------
create or replace function public.kortreservation_forsok_nu(p_bokning uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- kortdragningen_forsoker_igen (2026-10-21). Ett nekat kort provas igen
-- direkt, från adminvyn. Försöken räknas vidare. Bara superadmin.
declare
  b public.bookings;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin.';
  end if;
  select * into b from public.bookings where id = p_bokning;
  if not found or not intern.kortet_betalar(b) then
    return 'betalas inte med kortet';
  end if;
  update public.kortreservationer r set lage = 'vald', andrad = now()
   where r.booking_id = p_bokning and r.lage in ('misslyckad', 'utgangen');
  if not found then
    return 'inget att försöka igen';
  end if;
  return 'vald';
end $function$;
revoke all on function public.kortreservation_forsok_nu(uuid) from public, anon;
grant execute on function public.kortreservation_forsok_nu(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on function public.kortreservation_forsok_nu(uuid) from nextrum_barn';
  end if;
end $$;
