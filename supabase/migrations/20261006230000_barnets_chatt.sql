-- ============================================================
-- NEXTRUM — barnets chatt med studiehjälparen (2026-10-06)
--
-- Leo: "Man ska kunna skriva till sin studiehjälpare på barn vyn", och
-- på frågan vem som läser: "egen tråd, föräldern läser", och "på direkt
-- efter merge".
--
-- EN EGEN TABELL, INTE messages. Familjens tråd (messages) är förälderns:
-- barnet ser aldrig föräldern (barnkonton_och_admin), och
-- messages.sender_id pekar på profiles, där ett barnkonto inte har någon
-- rad. Hade barnets tråd stått i messages hade varje väg som läser
-- familjens chatt (vyerna, Realtime, notiserna, adminlistan, agenterna)
-- behövt ett filter till, och ett som saknades hade visat barnets text på
-- fel ställe. Här rörs ingen av dem.
--
-- En tråd per barn och studiehjälpare. Vem som läser:
--   · barnet: genom barn_chatt(), bara sin egen, med aktiv inloggning
--   · studiehjälparen: genom barnchatt_trad(), bara medan hen är barnets
--     studiehjälpare (students.matched_tutor_id, matched eller paused)
--   · föräldern: direkt i tabellen, för sina egna barn, utan att något
--     markeras som läst; föräldern skriver inte i tråden
--   · admin: som i familjens chatt, genom barnchatt_las(), som skriver
--     öppningen i auditloggen (chatt.oppnad), och raden i adminlistan
-- Ingen skriver i tabellen direkt: barnet och studiehjälparen skriver
-- genom var sin funktion, som prövar relationen och har ett tak.
-- Barnets roll (nextrum_barn) får inga tabellrättigheter, bara EXECUTE
-- på sina tre funktioner.
--
-- Studiehjälparen får en notis när barnet skriver: samma typ som
-- familjens tråd (meddelande), med barnets förnamn, så notiskedjan och
-- mallarna står som de är. Barnet får ingen notis och inget mejl: vyn
-- räknar det olästa.
--
-- Raderas en familj eller en studiehjälpare (radera_person, raderad_at)
-- går trådarna med, i samma transaktion: profiles_barnchatt_rensa.
-- Raderas barnet går tråden med det (on delete cascade).
--
-- barn_oversikt() får antalet genomförda och kommande pass (antal):
-- elevvyns Översikt visar antal pass i stället för timmar, och listan över
-- genomförda stannar vid 50.
--
-- Utan drop och utan delete utanför en funktion (CLAUDE.md avsnitt 5):
-- policyerna och triggrarna skapas bara när de saknas, och filen går att
-- köra två gånger.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tabellen
-- ------------------------------------------------------------
create table if not exists public.barn_meddelanden (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  tutor_id   uuid not null references public.profiles(id) on delete cascade,
  fran       text not null check (fran in ('barn', 'studiehjalpare')),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.barn_meddelanden is
  'Tråden mellan ett barn med barnkonto och barnets studiehjälpare (2026-10-06). Skrivs bara genom '
  'barn_chatt_skriv() och barnchatt_skriv(). Föräldern läser sina barns trådar, admin genom barnchatt_las().';
comment on column public.barn_meddelanden.parent_id is
  'Barnets förälder när meddelandet skrevs (students.parent_id). För förälderns läsning och för rensningen.';
comment on column public.barn_meddelanden.read_at is
  'När mottagaren läste: barnet i barn_chatt_last(), studiehjälparen i barnchatt_trad(). Föräldern och admin rör den inte.';

create index if not exists barn_meddelanden_trad_idx
  on public.barn_meddelanden (student_id, tutor_id, created_at);
create index if not exists barn_meddelanden_parent_idx
  on public.barn_meddelanden (parent_id, created_at);
create index if not exists barn_meddelanden_tutor_idx
  on public.barn_meddelanden (tutor_id, created_at);

alter table public.barn_meddelanden enable row level security;

-- Supabase ger anon och authenticated rättigheter på varje ny tabell.
-- RLS stoppar dem, men ingen ska skriva här annat än genom funktionerna,
-- och anon ska inte ens kunna läsa.
revoke all on public.barn_meddelanden from anon;
revoke insert, update, delete, truncate, references, trigger on public.barn_meddelanden from authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'barn_meddelanden'
                    and policyname = 'föräldern läser barnens trådar') then
    create policy "föräldern läser barnens trådar" on public.barn_meddelanden
      for select to authenticated
      using (parent_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'barn_meddelanden'
                    and policyname = 'admin läser barnens trådar') then
    create policy "admin läser barnens trådar" on public.barn_meddelanden
      for select to authenticated
      using (public.is_admin());
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. Barnets studiehjälpare
--
-- Den som står som barnets studiehjälpare, när relationen finns
-- (matched eller paused) och ingen av dem är raderad; annars null. En
-- vilande relation (paused) går att läsa men inte skriva i.
-- ------------------------------------------------------------
create or replace function intern.barnchatt_hjalpare(p_elev uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.matched_tutor_id
    from public.students s
    join public.profiles p on p.id = s.matched_tutor_id
   where s.id = p_elev
     and s.raderad_at is null
     and p.raderad_at is null
     and s.match_status in ('matched', 'paused')
$$;

revoke all on function intern.barnchatt_hjalpare(uuid) from public, anon, authenticated;

-- Tråden som json, äldst först, de 200 senaste.
create or replace function intern.barnchatt_rader(p_elev uuid, p_tutor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'fran', x.fran, 'text', x.body, 'skapad', x.created_at, 'last', x.read_at)
           order by x.created_at, x.id), '[]'::jsonb)
    from (select m.*
            from public.barn_meddelanden m
           where m.student_id = p_elev and m.tutor_id = p_tutor
           order by m.created_at desc, m.id desc
           limit 200) x
$$;

revoke all on function intern.barnchatt_rader(uuid, uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3. Barnet: läser, markerar som läst, skriver
-- ------------------------------------------------------------
create or replace function public.barn_chatt()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  barn uuid := intern.mitt_aktiva_barn();
  hj   uuid;
begin
  if barn is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  hj := intern.barnchatt_hjalpare(barn);
  if hj is null then
    return jsonb_build_object('lage', 'ingen');
  end if;
  return jsonb_build_object(
    'lage', 'ok',
    'studiehjalpare', (select intern.fornamn(p.full_name) from public.profiles p where p.id = hj),
    'kan_skriva', (select s.match_status = 'matched' from public.students s where s.id = barn),
    'olasta', (select count(*) from public.barn_meddelanden m
                where m.student_id = barn and m.tutor_id = hj
                  and m.fran = 'studiehjalpare' and m.read_at is null),
    'meddelanden', intern.barnchatt_rader(barn, hj));
end $$;

comment on function public.barn_chatt() is
  'Elevvyn: barnets tråd med sin studiehjälpare, de 200 senaste, och antalet olästa. Bara barnet självt, '
  'med aktiv inloggning. Markerar ingenting som läst (barn_chatt_last).';

create or replace function public.barn_chatt_last()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barn uuid := intern.mitt_aktiva_barn();
  hj   uuid;
  n    integer;
begin
  if barn is null then
    return 0;
  end if;
  hj := intern.barnchatt_hjalpare(barn);
  if hj is null then
    return 0;
  end if;
  update public.barn_meddelanden
     set read_at = now()
   where student_id = barn and tutor_id = hj and fran = 'studiehjalpare' and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

comment on function public.barn_chatt_last() is
  'Elevvyn: barnet har öppnat Meddelanden. Det studiehjälparen skrivit står som läst.';

create or replace function public.barn_chatt_skriv(p_text text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  barn uuid := intern.mitt_aktiva_barn();
  s    public.students%rowtype;
  hj   uuid;
  t    text := btrim(coalesce(p_text, ''));
  ny   uuid;
begin
  if barn is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  select * into s from public.students x where x.id = barn;
  hj := intern.barnchatt_hjalpare(barn);
  if hj is null or s.match_status <> 'matched' then
    return jsonb_build_object('lage', 'ingen');
  end if;
  if t = '' then
    return jsonb_build_object('lage', 'tom');
  end if;
  if char_length(t) > 2000 then
    return jsonb_build_object('lage', 'lang');
  end if;
  -- Taket: tjugo meddelanden på tio minuter. Ett barn som skriver mer än
  -- så får vänta; ingenting sparas.
  if (select count(*) from public.barn_meddelanden m
       where m.student_id = barn and m.fran = 'barn'
         and m.created_at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('lage', 'tak');
  end if;
  insert into public.barn_meddelanden (student_id, parent_id, tutor_id, fran, body)
  values (barn, s.parent_id, hj, 'barn', t)
  returning id into ny;
  return jsonb_build_object('lage', 'ok', 'id', ny);
end $$;

comment on function public.barn_chatt_skriv(text) is
  'Elevvyn: barnet skriver till sin studiehjälpare. Bara med aktiv inloggning och en studiehjälpare '
  '(matched), högst 2000 tecken och tjugo meddelanden på tio minuter.';


-- ------------------------------------------------------------
-- 4. Studiehjälparen: trådarna, en tråd, skriver
-- ------------------------------------------------------------
create or replace function public.barnchatt_tradar()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  jag uuid := (select auth.uid());
begin
  if jag is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'elev', x.id, 'namn', x.namn, 'inloggning', x.inloggning, 'kan_skriva', x.kan_skriva,
             'olasta', x.olasta, 'senaste', x.senaste)
           order by x.senaste desc nulls last, x.namn)
      from (select s.id, intern.fornamn(s.name) as namn,
                   s.user_id is not null and s.barn_aktiv as inloggning,
                   s.user_id is not null and s.match_status = 'matched' as kan_skriva,
                   (select count(*) from public.barn_meddelanden m
                     where m.student_id = s.id and m.tutor_id = jag
                       and m.fran = 'barn' and m.read_at is null) as olasta,
                   (select max(m.created_at) from public.barn_meddelanden m
                     where m.student_id = s.id and m.tutor_id = jag) as senaste
              from public.students s
             where s.matched_tutor_id = jag
               and s.match_status in ('matched', 'paused')
               and s.raderad_at is null
               and (s.user_id is not null
                    or exists (select 1 from public.barn_meddelanden m
                                where m.student_id = s.id and m.tutor_id = jag))) x
  ), '[]'::jsonb);
end $$;

comment on function public.barnchatt_tradar() is
  'Studiehjälparvyn: mina elever med egen inloggning eller en tråd med mig, med olästa och senaste. '
  'Bara elever jag är studiehjälpare för just nu.';

create or replace function public.barnchatt_trad(p_elev uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  jag uuid := (select auth.uid());
  s   public.students%rowtype;
begin
  select * into s from public.students x where x.id = p_elev;
  if jag is null or s.id is null or intern.barnchatt_hjalpare(s.id) is distinct from jag then
    return jsonb_build_object('lage', 'ingen');
  end if;
  update public.barn_meddelanden
     set read_at = now()
   where student_id = s.id and tutor_id = jag and fran = 'barn' and read_at is null;
  return jsonb_build_object(
    'lage', 'ok',
    'namn', intern.fornamn(s.name),
    'kan_skriva', s.user_id is not null and s.match_status = 'matched',
    'meddelanden', intern.barnchatt_rader(s.id, jag));
end $$;

comment on function public.barnchatt_trad(uuid) is
  'Studiehjälparvyn: tråden med en elev, de 200 senaste. Det eleven skrivit står som läst efteråt. '
  'Bara elevens studiehjälpare.';

create or replace function public.barnchatt_skriv(p_elev uuid, p_text text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  jag uuid := (select auth.uid());
  s   public.students%rowtype;
  t   text := btrim(coalesce(p_text, ''));
  ny  uuid;
begin
  select * into s from public.students x where x.id = p_elev;
  if jag is null or s.id is null or intern.barnchatt_hjalpare(s.id) is distinct from jag
     or s.match_status <> 'matched' then
    return jsonb_build_object('lage', 'ingen');
  end if;
  -- Utan inloggning kan barnet inte läsa det som skrivs.
  if s.user_id is null then
    return jsonb_build_object('lage', 'ingen_inloggning');
  end if;
  if t = '' then
    return jsonb_build_object('lage', 'tom');
  end if;
  if char_length(t) > 2000 then
    return jsonb_build_object('lage', 'lang');
  end if;
  if (select count(*) from public.barn_meddelanden m
       where m.tutor_id = jag and m.fran = 'studiehjalpare'
         and m.created_at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('lage', 'tak');
  end if;
  insert into public.barn_meddelanden (student_id, parent_id, tutor_id, fran, body)
  values (s.id, s.parent_id, jag, 'studiehjalpare', t)
  returning id into ny;
  return jsonb_build_object('lage', 'ok', 'id', ny);
end $$;

comment on function public.barnchatt_skriv(uuid, text) is
  'Studiehjälparvyn: skriver till en elev med egen inloggning. Bara elevens studiehjälpare (matched), '
  'högst 2000 tecken och trettio meddelanden på tio minuter.';


-- ------------------------------------------------------------
-- 5. Admin läser, som familjens chatt (chatt_las)
-- ------------------------------------------------------------
create or replace function public.barnchatt_las(p_parent uuid, p_tutor uuid)
returns table (id uuid, student_id uuid, fran text, body text, read_at timestamptz,
               created_at timestamptz, totalt bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  antal bigint;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan öppna en chatt.';
  end if;
  if p_parent is null or p_tutor is null then
    raise exception using errcode = '22023',
      message = 'Barnens trådar hör till en familj och en studiehjälpare. Båda behövs.';
  end if;

  select count(*) into antal
    from public.barn_meddelanden m
   where m.parent_id = p_parent and m.tutor_id = p_tutor;

  -- Bara när det finns något att läsa. Raden säger familjen, studiehjälparen
  -- och antalet, aldrig namn eller text.
  if antal > 0 then
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values ((select auth.uid()), 'admin', 'chatt.oppnad', 'barn_meddelanden', p_parent::text,
            jsonb_build_object('tutor_id', p_tutor, 'meddelanden', antal));
  end if;

  return query
    select m.id, m.student_id, m.fran, m.body, m.read_at, m.created_at, antal
      from public.barn_meddelanden m
     where m.parent_id = p_parent and m.tutor_id = p_tutor
     order by m.created_at desc, m.id desc
     limit 500;
end $$;

comment on function public.barnchatt_las(uuid, uuid) is
  'Adminvyns Öppna chatt: barnens trådar i en familj med en studiehjälpare, de 500 senaste, nyast först. '
  'Bara admin. Skriver chatt.oppnad i audit_logg när det finns något att läsa. Rör aldrig read_at.';


-- ------------------------------------------------------------
-- 6. Notisen till studiehjälparen
--
-- Samma typ som familjens tråd, slagen ihop per familj och
-- studiehjälpare (intern.notis_skapa), med barnets förnamn. Det
-- studiehjälparen skriver ger ingen notis: barnet har ingen profil att
-- få den på, och vyn räknar det olästa.
-- ------------------------------------------------------------
create or replace function intern.notis_vid_barnmeddelande()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  namn text;
begin
  if new.fran <> 'barn' then
    return null;
  end if;
  select intern.fornamn(s.name) into namn from public.students s where s.id = new.student_id;
  perform intern.notis_skapa(new.tutor_id, 'meddelande', null, new.student_id, new.parent_id, new.tutor_id,
    jsonb_strip_nulls(jsonb_build_object('fran', namn)));
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel)
  values ('notis_vid_barnmeddelande ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke all on function intern.notis_vid_barnmeddelande() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'barn_meddelanden_notis'
                    and tgrelid = 'public.barn_meddelanden'::regclass) then
    create trigger barn_meddelanden_notis after insert on public.barn_meddelanden
      for each row execute function intern.notis_vid_barnmeddelande();
  end if;
end $$;


-- ------------------------------------------------------------
-- 7. Rensningen när en person raderas
--
-- radera_person() sätter raderad_at först, i båda sätten (helt och
-- avidentifierat). Familjens och studiehjälparens trådar med barnen går
-- då, i samma transaktion; rullas raderingen tillbaka står de kvar.
-- ------------------------------------------------------------
create or replace function intern.barnchatt_rensa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.barn_meddelanden where parent_id = new.id or tutor_id = new.id;
  return null;
end $$;

revoke all on function intern.barnchatt_rensa() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'profiles_barnchatt_rensa'
                    and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_barnchatt_rensa after update of raderad_at on public.profiles
      for each row when (old.raderad_at is null and new.raderad_at is not null)
      execute function intern.barnchatt_rensa();
  end if;
end $$;


-- ------------------------------------------------------------
-- 8. Antalet pass i barnets översikt
--
-- Lappen prövar att ankaret står exakt en gång (CLAUDE.md avsnitt 5) och
-- gör ingenting om antalet redan finns.
-- ------------------------------------------------------------
do $lapp$
declare
  fore   text := pg_get_functiondef('public.barn_oversikt()'::regprocedure);
  ankare text := $a$    'timmar', jsonb_build_object($a$;
  tillagg text := $n$    'antal', jsonb_build_object(
      'genomforda', (select count(*)
                       from public.bookings x
                      where x.student_id = b.id and x.status = 'completed'
                        and exists (select 1 from public.lesson_reports r
                                     where r.booking_id = x.id and r.narvaro is distinct from 'franvarande')),
      'kommande', (select count(*)
                     from public.bookings x
                    where x.student_id = b.id and x.status in ('requested', 'confirmed')
                      and (x.wanted_date + coalesce(x.wanted_time, '00:00')::time) at time zone 'Europe/Stockholm'
                          + make_interval(mins => coalesce(x.duration_min, 60)) > nu)),
$n$;
  traffar integer;
begin
  if position($t$'antal', jsonb_build_object($t$ in fore) > 0 then
    raise notice 'barn_oversikt räknar redan antalet pass.';
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
  if traffar <> 1 then
    raise exception 'barn_oversikt: ankaret står % gånger, inte en. Läs driften.', traffar;
  end if;
  execute replace(fore, ankare, tillagg || ankare);
end $lapp$;


-- ------------------------------------------------------------
-- 9. Rättigheterna
--
-- Supabase ger varje ny funktion EXECUTE till alla. Barnets tre går bara
-- till barnets roll, studiehjälparens och adminens till authenticated
-- (funktionerna prövar själva vem det är).
-- ------------------------------------------------------------
revoke execute on function public.barn_chatt() from public, anon, authenticated;
revoke execute on function public.barn_chatt_last() from public, anon, authenticated;
revoke execute on function public.barn_chatt_skriv(text) from public, anon, authenticated;
grant execute on function public.barn_chatt() to nextrum_barn;
grant execute on function public.barn_chatt_last() to nextrum_barn;
grant execute on function public.barn_chatt_skriv(text) to nextrum_barn;

revoke execute on function public.barnchatt_tradar() from public, anon;
revoke execute on function public.barnchatt_trad(uuid) from public, anon;
revoke execute on function public.barnchatt_skriv(uuid, text) from public, anon;
revoke execute on function public.barnchatt_las(uuid, uuid) from public, anon;
grant execute on function public.barnchatt_tradar() to authenticated;
grant execute on function public.barnchatt_trad(uuid) to authenticated;
grant execute on function public.barnchatt_skriv(uuid, text) to authenticated;
grant execute on function public.barnchatt_las(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
